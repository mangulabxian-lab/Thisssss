// TeacherExamSession.jsx - WITH CHAT FEATURE
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import api, { startExamSession, endExamSession } from '../lib/api';
import './TeacherExamSession.css';

export default function TeacherExamSession() {
  const { examId } = useParams();
  const navigate = useNavigate();
  
  // State Management
  const [exam, setExam] = useState(null);
  const [students, setStudents] = useState([]);
  const [timeLeft, setTimeLeft] = useState(3600);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [socketStatus, setSocketStatus] = useState('connecting');
  const [socket, setSocket] = useState(null);
  const [studentStreams, setStudentStreams] = useState({});
  const [peerConnections, setPeerConnections] = useState({});
  
  // ✅ NEW: Chat State
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Refs
  const timerRef = useRef(null);
  const videoRefs = useRef({});
  const socketRef = useRef(null);
  const activeConnections = useRef(new Set());
  const messagesEndRef = useRef(null);

  // ==================== UTILITY FUNCTIONS ====================
  const getAvatarColor = (index) => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    return colors[index % colors.length];
  };

  const getSafeStudentId = (student) => {
    if (!student) return 'N/A';
    const studentId = student.studentId || student._id || student.socketId || 'Unknown';
    return String(studentId).substring(0, 8);
  };

  const getSafeStudentName = (student) => {
    if (!student) return 'Unknown Student';
    const name = student.name || student.studentName || `Student ${getSafeStudentId(student)}`;
    return String(name);
  };

  const isSocketConnected = () => {
    return socketRef.current && socketRef.current.connected;
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ==================== CHAT FUNCTIONS ====================
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !socketRef.current) return;

    const messageData = {
      id: Date.now().toString(),
      text: newMessage.trim(),
      sender: 'teacher',
      senderName: 'Teacher',
      timestamp: new Date(),
      type: 'broadcast'
    };

    // Send to all students
    socketRef.current.emit('send-chat-message', {
      roomId: `exam-${examId}`,
      message: messageData
    });

    // Add to local messages
    setMessages(prev => [...prev, messageData]);
    setNewMessage('');
  };

  const handleChatMessage = (data) => {
    console.log('💬 Received chat message:', data);
    const newMessage = {
      ...data.message,
      timestamp: new Date(data.message.timestamp)
    };
    
    setMessages(prev => [...prev, newMessage]);
    
    // Increment unread count if chat is closed
    if (!showChat) {
      setUnreadCount(prev => prev + 1);
    }
  };

  const toggleChat = () => {
    setShowChat(prev => {
      if (!prev) {
        setUnreadCount(0); // Reset unread count when opening chat
      }
      return !prev;
    });
  };

  // ==================== SOCKET.IO SETUP ====================
  useEffect(() => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.error('❌ No token available for socket connection');
      setSocketStatus('error');
      return;
    }

    console.log('🔑 Connecting teacher socket...');
    setSocketStatus('connecting');

    const newSocket = io('http://localhost:3000', {
      auth: { token: token },
      query: { examId: examId, userRole: 'teacher' },
      transports: ['websocket', 'polling'],
      timeout: 10000,
      forceNew: true
    });

    // Socket Event Handlers
    newSocket.on('connect', () => {
      console.log('✅ Teacher Socket connected successfully with ID:', newSocket.id);
      setSocketStatus('connected');
      
      newSocket.emit('join-exam-room', {
        roomId: `exam-${examId}`,
        userName: 'Teacher',
        userId: 'teacher',
        userRole: 'teacher'
      });
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Teacher Socket connection failed:', error.message);
      setSocketStatus('error');
    });

    newSocket.on('disconnect', (reason) => {
      console.log('🔌 Teacher Socket disconnected. Reason:', reason);
      setSocketStatus('disconnected');
    });

    // Application Event Handlers
    newSocket.on('student-joined', handleStudentJoined);
    newSocket.on('student-left', handleStudentLeft);
    newSocket.on('room-participants', handleRoomParticipants);
    newSocket.on('webrtc-offer', handleWebRTCOffer);
    newSocket.on('webrtc-answer', handleWebRTCAnswer);
    newSocket.on('ice-candidate', handleICECandidate);
    newSocket.on('camera-response', handleCameraResponse);
    
    // ✅ NEW: Chat Event Handler
    newSocket.on('chat-message', handleChatMessage);

    setSocket(newSocket);
    socketRef.current = newSocket;

    return () => {
      console.log('🛑 Cleaning up teacher socket');
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current.close();
        socketRef.current = null;
      }
      cleanupAllConnections();
    };
  }, [examId]);

  // ==================== WEBRTC HANDLERS ====================
  const handleWebRTCOffer = async (data) => {
    console.log('🎯 Received WebRTC offer from:', data.from);
    
    // Clean up existing connection
    if (peerConnections[data.from]) {
      cleanupStudentConnection(data.from);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    try {
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      });

      let streamReceived = false;
      
      peerConnection.ontrack = (event) => {
        console.log('📹 ontrack event fired for:', data.from);
        
        if (event.streams && event.streams.length > 0 && !streamReceived) {
          streamReceived = true;
          const stream = event.streams[0];
          
          console.log('🎬 Stream received with tracks:', {
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length,
            streamActive: stream.active
          });

          setStudentStreams(prev => ({
            ...prev,
            [data.from]: stream
          }));

          setStudents(prev => prev.map(student => 
            student.socketId === data.from 
              ? { ...student, cameraEnabled: true }
              : student
          ));

          setTimeout(() => {
            const videoElement = videoRefs.current[data.from];
            if (videoElement && stream.active) {
              console.log('🎬 Setting up video for:', data.from);
              
              videoElement.srcObject = null;
              videoElement.srcObject = stream;
              videoElement.muted = true;
              videoElement.playsInline = true;
              
              const forcePlay = async (attempt = 0) => {
                try {
                  await videoElement.play();
                  console.log('✅ Video playing successfully!');
                } catch (error) {
                  console.log(`⚠️ Play attempt ${attempt + 1} failed:`, error.name);
                  if (attempt < 10) {
                    setTimeout(() => forcePlay(attempt + 1), 200);
                  }
                }
              };
              
              forcePlay();
            }
          }, 100);
        }
      };

      peerConnection.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          socketRef.current.emit('ice-candidate', {
            target: data.from,
            candidate: event.candidate
          });
        }
      };

      setPeerConnections(prev => ({
        ...prev,
        [data.from]: peerConnection
      }));

      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      console.log('✅ Remote description set');
      
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      console.log('✅ Answer created');

      if (socketRef.current) {
        socketRef.current.emit('webrtc-answer', {
          target: data.from,
          answer: answer
        });
        console.log('✅ Sent WebRTC answer to student');
      }

    } catch (error) {
      console.error('❌ Error handling WebRTC offer:', error);
      cleanupStudentConnection(data.from);
    }
  };

  const handleICECandidate = async (data) => {
    const peerConnection = peerConnections[data.from];
    if (peerConnection && data.candidate) {
      try {
        if (data.candidate.candidate && data.candidate.sdpMid !== null) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } catch (error) {
        console.error('❌ Error adding ICE candidate:', error);
      }
    }
  };

  const handleWebRTCAnswer = async (data) => {
    const peerConnection = peerConnections[data.from];
    if (peerConnection) {
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        console.log('✅ Set remote description from answer for:', data.from);
      } catch (error) {
        console.error('❌ Error setting remote description from answer:', error);
      }
    }
  };

  // ==================== VIDEO MANAGEMENT ====================
  const setupVideoElement = (socketId, stream) => {
    const videoElement = videoRefs.current[socketId];
    if (!videoElement || !stream) {
      console.log('❌ Video element or stream not found for:', socketId);
      return;
    }

    console.log('🎬 Setting up video for:', socketId);

    videoElement.style.transform = 'scaleX(-1)';
    videoElement.srcObject = null;
    videoElement.srcObject = stream;
    videoElement.muted = true;
    videoElement.playsInline = true;
    
    const playWithRetry = async (attempt = 0) => {
      try {
        await videoElement.play();
        console.log('✅ Video playing successfully on attempt:', attempt + 1);
      } catch (error) {
        console.log(`⚠️ Play attempt ${attempt + 1} failed:`, error.name);
        if (attempt < 5) {
          setTimeout(() => playWithRetry(attempt + 1), 300);
        }
      }
    };
    
    playWithRetry();
  };

  const setVideoRef = (socketId, element) => {
    if (element) {
      videoRefs.current[socketId] = element;
      
      const stream = studentStreams[socketId];
      if (stream && element.srcObject !== stream) {
        console.log('🎬 Setting existing stream for student:', socketId);
        setupVideoElement(socketId, stream);
      }
    }
  };

  // ==================== STUDENT MANAGEMENT ====================
  const handleStudentJoined = (data) => {
    console.log('🎯 Student joined:', data);
    
    setStudents(prev => {
      const exists = prev.find(s => s.socketId === data.socketId);
      if (!exists) {
        return [...prev, {
          studentId: String(data.studentId || data.socketId),
          name: String(data.studentName || 'Student'),
          email: String(data.studentEmail || ''),
          socketId: data.socketId,
          joinedAt: new Date(),
          cameraEnabled: false,
          _id: String(data.studentId || data.socketId),
          isConnected: true,
          connectionStatus: 'connected',
          lastSeen: new Date()
        }];
      }
      return prev.map(student => 
        student.socketId === data.socketId 
          ? { 
              ...student, 
              isConnected: true,
              connectionStatus: 'connected',
              lastSeen: new Date()
            }
          : student
      );
    });

    // Request camera after student joins
    setTimeout(() => {
      requestStudentCamera(data.socketId);
    }, 1000);
  };

  const handleStudentLeft = (data) => {
    console.log('🚪 Student left:', data);
    setStudents(prev => prev.map(student => 
      student.socketId === data.socketId 
        ? { 
            ...student, 
            isConnected: false,
            connectionStatus: 'disconnected',
            cameraEnabled: false
          }
        : student
    ));
    cleanupStudentConnection(data.socketId);
  };

  const handleRoomParticipants = (data) => {
    console.log('👥 Room participants:', data);
    if (data.students && data.students.length > 0) {
      const formattedStudents = data.students.map(student => ({
        studentId: String(student.studentId || student.socketId),
        name: String(student.studentName || 'Student'),
        email: String(student.studentEmail || ''),
        socketId: student.socketId,
        joinedAt: new Date(),
        cameraEnabled: false,
        _id: String(student.studentId || student.socketId),
        isConnected: true,
        connectionStatus: 'connected',
        lastSeen: new Date()
      }));
      setStudents(formattedStudents);

      // Request cameras for all connected students
      formattedStudents.forEach((student, index) => {
        setTimeout(() => {
          requestStudentCamera(student.socketId);
        }, 2000 + (index * 1000));
      });
    }
  };

  const handleCameraResponse = (data) => {
    console.log('📹 Camera response:', data);
    setStudents(prev => prev.map(student => 
      student.socketId === data.socketId 
        ? { ...student, cameraEnabled: data.enabled }
        : student
    ));
  };

  // ==================== CAMERA REQUEST MANAGEMENT ====================
  const requestStudentCamera = (studentSocketId) => {
    if (!isSocketConnected() || !studentSocketId) {
      console.warn('⚠️ Socket not connected for camera request');
      return;
    }

    if (studentStreams[studentSocketId]) {
      console.log('✅ Already have stream for:', studentSocketId);
      return;
    }

    if (activeConnections.current.has(studentSocketId)) {
      console.log('⏳ Already processing camera for:', studentSocketId);
      return;
    }

    console.log('📹 Requesting camera from student:', studentSocketId);
    activeConnections.current.add(studentSocketId);
    
    socketRef.current.emit('request-student-camera', {
      studentSocketId: studentSocketId,
      roomId: `exam-${examId}`
    });
  };

  // ==================== CONNECTION CLEANUP ====================
  const cleanupStudentConnection = (socketId) => {
    console.log('🧹 Cleaning up connection for:', socketId);
    
    activeConnections.current.delete(socketId);
    
    if (peerConnections[socketId]) {
      const pc = peerConnections[socketId];
      try {
        pc.close();
      } catch (error) {
        console.warn('Error closing peer connection:', error);
      }
      setPeerConnections(prev => {
        const newPCs = { ...prev };
        delete newPCs[socketId];
        return newPCs;
      });
    }
    
    if (studentStreams[socketId]) {
      const stream = studentStreams[socketId];
      if (stream && stream.getTracks) {
        stream.getTracks().forEach(track => {
          try {
            track.stop();
          } catch (error) {
            console.warn('Error stopping track:', error);
          }
        });
      }
      setStudentStreams(prev => {
        const newStreams = { ...prev };
        delete newStreams[socketId];
        return newStreams;
      });
    }
    
    if (videoRefs.current[socketId]) {
      const videoElement = videoRefs.current[socketId];
      if (videoElement) {
        videoElement.srcObject = null;
        
        
      }
      delete videoRefs.current[socketId];
    }
  };

  const cleanupAllConnections = () => {
    console.log('🧹 Cleaning up ALL connections');
    Object.keys(peerConnections).forEach(cleanupStudentConnection);
    activeConnections.current.clear();
  };

  // ==================== EXAM SESSION MANAGEMENT ====================
  useEffect(() => {
    const loadExamData = async () => {
      try {
        setLoading(true);
        
        const token = localStorage.getItem('token');
        if (!token) {
          navigate('/login');
          return;
        }
        
        const examResponse = await api.get(`/exams/${examId}/details`);
        
        if (examResponse.success) {
          setExam(examResponse.data);
          setTimeLeft(examResponse.data.timeLimit * 60 || 3600);
          setSessionStarted(examResponse.data.isActive || false);
        }
        
      } catch (error) {
        console.error('❌ Failed to load exam data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadExamData();
  }, [examId, navigate]);

  const handleStartExam = async () => {
    try {
      const response = await startExamSession(examId);
      if (response.success) {
        setSessionStarted(true);
        setIsTimerRunning(true);
        console.log('✅ Exam session started');
        
        // Request cameras for currently connected students
        const connectedStudents = students.filter(student => student.socketId);
        console.log(`📹 Requesting cameras from ${connectedStudents.length} connected students`);
        
        connectedStudents.forEach((student, index) => {
          setTimeout(() => {
            requestStudentCamera(student.socketId);
          }, 1000 + (index * 1000));
        });
      }
    } catch (error) {
      console.error('Failed to start exam:', error);
      alert('Failed to start exam session');
    }
  };

  const handleEndExam = async () => {
    try {
      cleanupAllConnections();
      
      const response = await endExamSession(examId);
      if (response.success) {
        setSessionStarted(false);
        setIsTimerRunning(false);
        setStudents([]);
        setStudentStreams({});
        setPeerConnections({});
        setMessages([]);
      }
    } catch (error) {
      console.error('Failed to end exam:', error);
    }
  };

  // Timer control
  useEffect(() => {
    if (isTimerRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft <= 0 && isTimerRunning) {
      handleEndExam();
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning, timeLeft]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // ==================== RENDER FUNCTIONS ====================
  
  // ✅ Only show connected students (those with socketId)
  const connectedStudents = students.filter(student => student.socketId && student.isConnected);

  const renderStudentVideos = () => {
    const studentsWithStreams = connectedStudents
      .filter(student => studentStreams[student.socketId])
      .sort((a, b) => getSafeStudentName(a).localeCompare(getSafeStudentName(b)));

    console.log('🎬 Rendering videos for connected students:', studentsWithStreams.length);

    if (studentsWithStreams.length === 0) {
      return (
        <div className="no-videos">
          <div className="empty-state">
            <div className="camera-icon">📹</div>
            <h4>No Active Cameras</h4>
            <p>Student cameras will appear here when they join and grant camera access</p>
            <div className="connection-stats">
              <p><strong>Connection Status:</strong></p>
              <p>Connected Students: {connectedStudents.length}</p>
              <p>Active Cameras: {studentsWithStreams.length}</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="video-grid-container">
        <div className="grid-header">
          <span>Live Student Cameras ({studentsWithStreams.length})</span>
        </div>
        
        <div className="video-grid">
          {studentsWithStreams.map((student, index) => {
            const socketId = student.socketId;
            const stream = studentStreams[socketId];

            return (
              <div key={socketId} className="student-video-card">
                <div className="video-header">
                  <span className="student-badge">#{index + 1}</span>
                  <span className="student-name">{getSafeStudentName(student)}</span>
                </div>
                
                <div className="video-container">
                  <video 
                    ref={(element) => setVideoRef(socketId, element)}
                    autoPlay 
                    muted
                    playsInline
                    className="student-video"
                  />
                  
                  <div className="video-overlay-info">
                    
                  </div>
                </div>
                
                <div className="video-footer">
                  <div className="student-info-compact">
                    <span className="student-id">ID: {getSafeStudentId(student)}</span>
                    <span className="connection-type">🟢 Online</span>
                  </div>
                  <button 
                    onClick={() => requestStudentCamera(socketId)}
                    className="retry-camera-btn"
                    title="Request camera again"
                  >
                    🔄
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ✅ NEW: Render Chat Component
  const renderChat = () => {
    if (!showChat) return null;

    return (
      <div className="chat-panel">
        <div className="chat-header">
          <h3>💬 Exam Chat</h3>
          <button className="close-chat-btn" onClick={toggleChat}>✕</button>
        </div>
        
        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="no-messages">
              <div className="chat-icon">💬</div>
              <p>No messages yet</p>
              <small>Start a conversation with students</small>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={`message ${message.sender === 'teacher' ? 'sent' : 'received'}`}>
                <div className="message-header">
                  <span className="sender-name">
                    {message.sender === 'teacher' ? 'You' : message.senderName}
                  </span>
                  <span className="message-time">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="message-content">
                  {message.text}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <form className="chat-input-form" onSubmit={handleSendMessage}>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message to all students..."
            className="chat-input"
            maxLength={500}
          />
          <button 
            type="submit" 
            className="send-message-btn"
            disabled={!newMessage.trim()}
          >
            Send
          </button>
        </form>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="teacher-exam-loading">
        <div className="loading-spinner"></div>
        <p>Loading exam session...</p>
      </div>
    );
  }

  return (
    <div className="teacher-exam-session">
      <div className="teacher-exam-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate('/dashboard')}>
            ← Back to Dashboard
          </button>
          <div className="exam-info">
            <h1>{exam?.title || 'Exam Session'}</h1>
            <p>Class: {exam?.classId?.name || 'Current Class'}</p>
          </div>
        </div>
        
        <div className="header-center">
          <div className="timer-display">
            <span className="timer-text">{formatTime(timeLeft)}</span>
          </div>
          <div className="student-count">
            👥 {connectedStudents.length} Students Connected
          </div>
          <div className={`socket-status ${socketStatus}`}>
            {socketStatus === 'connected' && '🟢 Connected'}
            {socketStatus === 'connecting' && '🟡 Connecting...'}
            {socketStatus === 'error' && '🔴 Error'}
            {socketStatus === 'disconnected' && '⚫ Disconnected'}
          </div>
        </div>
        
        <div className="header-right">
          {/* ✅ NEW: Chat Toggle Button */}
          <button 
            className={`chat-toggle-btn ${unreadCount > 0 ? 'has-unread' : ''}`}
            onClick={toggleChat}
          >
            💬 Chat
            {unreadCount > 0 && (
              <span className="unread-badge">{unreadCount}</span>
            )}
          </button>
          
          {!sessionStarted ? (
            <button className="start-exam-btn" onClick={handleStartExam}>
              🚀 Start Exam
            </button>
          ) : (
            <button className="end-exam-btn" onClick={handleEndExam}>
              ⏹️ End Exam
            </button>
          )}
        </div>
      </div>

      <div className="teacher-exam-content">
        <div className="videos-section">
          {renderStudentVideos()}
        </div>

        <div className="students-section">
          <div className="students-header">
            <h3>Connected Students ({connectedStudents.length})</h3>
            <div className="student-stats">
              <span className="stat cameras">
                📹 {connectedStudents.filter(s => s.cameraEnabled).length} Active Cameras
              </span>
            </div>
          </div>
          
          <div className="students-list">
            {connectedStudents.length > 0 ? (
              connectedStudents.map((student, index) => (
                <div key={student.socketId} className="student-card">
                  <div className="student-info">
                    <div className="student-avatar" style={{backgroundColor: getAvatarColor(index)}}>
                      {getSafeStudentName(student).charAt(0).toUpperCase()}
                    </div>
                    <div className="student-details">
                      <span className="student-name">{getSafeStudentName(student)}</span>
                      <div className="student-meta">
                        <span className="student-id">
                          ID: {getSafeStudentId(student)}
                        </span>
                        <span className="join-time">
                          Joined: {student.joinedAt.toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="student-status">
                    <div className="connection-status-indicator">
                      <span className={`status-dot ${student.connectionStatus}`}></span>
                      <span className="status-text">
                        {student.connectionStatus === 'connected' ? '🟢 Connected' : '🔴 Disconnected'}
                      </span>
                    </div>
                    <span className={`camera-indicator ${student.cameraEnabled ? 'active' : 'inactive'}`}>
                      {student.cameraEnabled ? '📹 Camera Live' : '📹 Camera Off'}
                    </span>
                  </div>
                  {!student.cameraEnabled && (
                    <button 
                      className="request-camera-btn"
                      onClick={() => requestStudentCamera(student.socketId)}
                    >
                      Request Camera
                    </button>
                  )}
                </div>
              ))
            ) : (
              <div className="no-students">
                <div className="empty-students">
                  <div className="student-icon">👥</div>
                  <h4>No Students Connected</h4>
                  <p>Waiting for students to join the exam session...</p>
                  <div className="connection-instructions">
                    <p><strong>Students should:</strong></p>
                    <ul>
                      <li>Join using the exam code</li>
                      <li>Grant camera permissions when prompted</li>
                      <li>Stay connected throughout the exam</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ✅ NEW: Chat Panel */}
        {renderChat()}
      </div>
    </div>
  );
}