// TeacherExamSession.jsx - UPDATED VERSION WITHOUT ASYNC TIMER LOGIC
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import api, { startExamSession, endExamSession } from '../lib/api';
import './TeacherExamSession.css';
import TeacherProctoringControls from './TeacherProctoringControls';

export default function TeacherExamSession() {
  const { examId } = useParams();
  const navigate = useNavigate();
  
  // State Management
  const [exam, setExam] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [socketStatus, setSocketStatus] = useState('connecting');
  const [socket, setSocket] = useState(null);
  const [studentStreams, setStudentStreams] = useState({});
  const [peerConnections, setPeerConnections] = useState({});
  const [studentAttempts, setStudentAttempts] = useState({});

  // Chat State
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Timer Control State - REMOVED ASYNC TIMER STATES
  const [showTimerControls, setShowTimerControls] = useState(false);

  // PROCTORING CONTROLS POPUP STATE
  const [showProctoringControls, setShowProctoringControls] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // ✅ PROCTORING ALERTS STATE
  const [proctoringAlerts, setProctoringAlerts] = useState({});
  const [expandedAlerts, setExpandedAlerts] = useState({});

  // Refs
  const videoRefs = useRef({});
  const socketRef = useRef(null);
  const activeConnections = useRef(new Set());
  const messagesEndRef = useRef(null);

  // ==================== PROCTORING ALERTS FUNCTIONS ====================
  const handleProctoringAlert = useCallback((data) => {
    console.log('🚨 Teacher received proctoring alert:', data);
    
    if (!data.studentSocketId) {
      console.error('❌ No student socket ID in proctoring alert');
      return;
    }

    // ✅ UPDATE ATTEMPTS FROM SERVER DATA
    if (data.attemptsInfo) {
      setStudentAttempts(prev => ({
        ...prev,
        [data.studentSocketId]: data.attemptsInfo
      }));
      
      // Update students list with attempts info
      setStudents(prev => prev.map(student => 
        student.socketId === data.studentSocketId 
          ? { 
              ...student, 
              violations: data.attemptsInfo.currentAttempts,
              attemptsLeft: data.attemptsInfo.attemptsLeft
            }
          : student
      ));
    }
    
    // ✅ FIXED: Use unique ID to prevent duplicates
    const alertId = `${data.studentSocketId}_${Date.now()}_${data.detectionType || 'alert'}`;
    
    // Add to alerts display with duplicate prevention
    setProctoringAlerts(prev => {
      const studentAlerts = prev[data.studentSocketId] || [];
      
      // Check if this exact alert already exists (within 5 seconds)
      const isDuplicate = studentAlerts.some(alert => 
        alert.message === data.message && 
        Date.now() - new Date(alert.timestamp).getTime() < 5000
      );
      
      if (isDuplicate) {
        console.log('🛑 Skipping duplicate alert:', data.message);
        return prev;
      }
      
      const newAlert = {
        id: alertId,
        message: data.message,
        type: data.type || 'warning',
        severity: data.severity || 'medium',
        timestamp: new Date().toLocaleTimeString(),
        detectionType: data.detectionType,
        confidence: data.confidence
      };
      
      return {
        ...prev,
        [data.studentSocketId]: [
          newAlert,
          ...studentAlerts
        ].slice(0, 20)
      };
    });
  }, [examId, students]);

  // ==================== ALERTS MANAGEMENT FUNCTIONS ====================
  const toggleAlertsDropdown = (studentSocketId) => {
    setExpandedAlerts(prev => ({
      ...prev,
      [studentSocketId]: !prev[studentSocketId]
    }));
  };

  const clearStudentAlerts = (studentSocketId, e) => {
    e.stopPropagation();
    console.log('🗑️ Clearing alerts for student:', studentSocketId);
    
    setProctoringAlerts(prev => {
      const updated = { ...prev };
      delete updated[studentSocketId];
      return updated;
    });
    
    setExpandedAlerts(prev => {
      const updated = { ...prev };
      delete updated[studentSocketId];
      return updated;
    });
    
    // Update student status
    setStudents(prev => prev.map(student => 
      student.socketId === studentSocketId 
        ? { ...student, hasAlerts: false, alertCount: 0 }
        : student
    ));
  };

  // ==================== PROCTORING CONTROLS FUNCTIONS ====================
  const openProctoringControls = (student) => {
    console.log('🎯 Opening proctoring controls for:', student);
    setSelectedStudent(student);
    setShowProctoringControls(true);
  };

  const closeProctoringControls = () => {
    setShowProctoringControls(false);
    setSelectedStudent(null);
  };

  // ==================== TIMER CONTROL FUNCTIONS ====================
  // REMOVED: startTimerEdit, cancelTimerEdit, handleTimeInputChange, applyCustomTime, addTime, pauseTimer, resumeTimer, resetTimer

  const toggleTimerControls = () => {
    setShowTimerControls(!showTimerControls);
    if (showProctoringControls) {
      setShowProctoringControls(false);
    }
  };

  const handleEndExamSession = async () => {
    // ✅ TRY BOTH SOURCES
    const examIdFromState = exam?._id?.toString();
    const examIdFromParams = examId; // from useParams()
    
    console.log('🔍 Exam IDs:', {
      fromState: examIdFromState,
      fromParams: examIdFromParams,
      examState: exam
    });
    
    const currentExamId = examIdFromState || examIdFromParams;
    
    if (!currentExamId) {
      alert('Cannot end session: Exam ID not found. Please refresh the page.');
      console.error('❌ Both exam ID sources are null:', {
        examState: exam,
        params: examId
      });
      return;
    }
    
    console.log('🔍 Ending session with examId:', currentExamId);
    
    try {
      const response = await api.post(`/exams/${currentExamId}/end-session`);
      
      if (response.data.success) {
        console.log("✅ Session ended successfully");
        
        // ✅ Update exam state
        const endedAt = new Date();
        setExam(prev => ({
          ...prev,
          isActive: false,
          endedAt: endedAt
        }));
        
        // ✅ Notify socket
        if (socketRef.current) {
          socketRef.current.emit('broadcast-live-class-end', {
            examId: currentExamId,
            classId: exam?.classId?._id,
            endedAt: endedAt.toISOString()
          });

          socketRef.current.emit('exam-ended', {
            roomId: `exam-${currentExamId}`,
            examId: currentExamId,
            message: 'Live class has been ended by teacher',
            endedAt: endedAt.toISOString(),
            forcedExit: true
          });
        }
        
        // ✅ Clear timer caches
        if (socketRef.current) {
          socketRef.current.emit('clear-timer-cache', {
            examId: currentExamId,
            reason: 'session_ended'
          });
        }
        
        localStorage.removeItem(`timer-${currentExamId}`);
        localStorage.removeItem(`last-save-${currentExamId}`);
        
        alert('✅ Exam session ended! Students cannot join anymore.');
        
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      }
    } catch (error) {
      console.error('❌ Failed to end exam session:', error);
      console.error('❌ Error details:', {
        url: error.config?.url,
        method: error.config?.method,
        examId: currentExamId,
        errorMessage: error.message
      });
      
      alert('❌ Failed to end exam session. Please check console for details.');
    }
  };

  // ==================== LIVE CLASS START FUNCTION ====================
  const handleStartExam = async () => {
    try {
      console.log('🚀 Starting live class session...');
      
      // ✅ LIVE CLASS HAS NO TIMER
      const initialTime = 0; // No timer for live classes
      
      const response = await startExamSession(examId);
      if (response.success) {
        setSessionStarted(true);
        
        // ✅ BROADCAST LIVE CLASS START
        if (socketRef.current) {
          socketRef.current.emit('broadcast-live-class-start', {
            classId: exam?.classId,
            examId: examId,
            examTitle: exam?.title || 'Live Class',
            teacherName: 'Teacher'
          });
          
          console.log('✅ Live class started!');
          alert('✅ Live class started! Students can now join.');
        }
      }
    } catch (error) {
      console.error('Failed to start live class:', error);
      alert('Failed to start live class session');
    }
  };

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
    if (seconds === null || seconds === undefined) return '00:00';
    
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  };

  // ==================== CHAT FUNCTIONS ====================
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const toggleChat = () => {
    setShowChat(prev => {
      if (!prev) {
        setUnreadCount(0);
      }
      return !prev;
    });
  };

  const handleChatMessage = useCallback((data) => {
    console.log('💬 Teacher received chat message:', data);
    
    if (!data.message) {
      console.error('❌ Invalid chat message format:', data);
      return;
    }

    const newMessage = {
      id: data.message.id || Date.now().toString(),
      text: data.message.text,
      sender: data.message.sender,
      senderName: data.message.senderName || data.userName || 'Student',
      timestamp: new Date(data.message.timestamp || Date.now()),
      type: data.message.type || 'student'
    };
    
    console.log('💾 Adding message to teacher state:', newMessage);
    
    setMessages(prev => {
      const updatedMessages = [...prev, newMessage];
      console.log('📝 Teacher messages count:', updatedMessages.length);
      return updatedMessages;
    });
    
    if (!showChat) {
      setUnreadCount(prev => prev + 1);
    }
  }, [showChat]);

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

    // ✅ FIXED: Use consistent event name
    socketRef.current.emit('send-chat-message', {
      roomId: `exam-${examId}`,
      message: messageData
    });

    // Add to local messages immediately
    
    setNewMessage('');
    
    console.log('📤 Teacher sent message:', messageData);
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

    // Add this in your socket event listeners section
    newSocket.on('student-attempts-update', (data) => {
      console.log('📊 Student attempts updated:', data);
      
      setStudentAttempts(prev => ({
        ...prev,
        [data.studentSocketId]: data.attempts
      }));
      
      // Update students list with attempts info
      setStudents(prev => prev.map(student => 
        student.socketId === data.studentSocketId 
          ? { 
              ...student, 
              violations: data.attempts.currentAttempts,
              attemptsLeft: data.attempts.attemptsLeft
            }
          : student
      ));
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Teacher Socket connection failed:', error.message);
      setSocketStatus('error');
    });

    newSocket.on('disconnect', (reason) => {
      console.log('🔌 Teacher Socket disconnected. Reason:', reason);
      setSocketStatus('disconnected');
    });

    // Event Handlers
    newSocket.on('detection-settings-update', (data) => {
      console.log('✅ Detection settings applied to student:', data);
    });

    newSocket.on('detection-settings-confirmation', (data) => {
      console.log('✅ Student confirmed settings received:', {
        studentName: data.studentName,
        settings: data.settings,
        receivedAt: data.receivedAt
      });
      alert(`✅ ${data.studentName} received the detection settings update!`);
    });

    newSocket.on('exam-started', (data) => {
      console.log('✅ Exam started by teacher');
      setSessionStarted(true);
    });

    // Add this in your socket event listeners section
    // DAGDAGIN ito sa teacher socket event listeners:
    newSocket.on('proctoring-violation', (data) => {
      console.log('📊 Proctoring violation received:', data);
      
      // This will trigger the handleProctoringAlert function
      handleProctoringAlert({
        studentSocketId: data.studentSocketId,
        message: data.message,
        type: 'warning',
        severity: data.severity,
        timestamp: data.timestamp,
        detectionType: data.violationType,
        confidence: data.confidence
      });
    });

    newSocket.on('proctoring-alert', handleProctoringAlert);
    newSocket.on('student-joined', handleStudentJoined);
    newSocket.on('student-left', handleStudentLeft);
    newSocket.on('room-participants', handleRoomParticipants);
    newSocket.on('webrtc-offer', handleWebRTCOffer);
    newSocket.on('webrtc-answer', handleWebRTCAnswer);
    newSocket.on('ice-candidate', handleICECandidate);
    newSocket.on('camera-response', handleCameraResponse);
    newSocket.on('chat-message', handleChatMessage);
    newSocket.on('send-detection-settings', handleDetectionSettingsUpdate);
    
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

  // Handle detection settings updates
  const handleDetectionSettingsUpdate = useCallback((data) => {
    console.log('🎯 Sending detection settings to student:', data);
    
    if (socketRef.current && data.studentSocketId) {
      socketRef.current.emit('update-detection-settings', {
        studentSocketId: data.studentSocketId,
        settings: data.settings,
        customMessage: data.customMessage,
        examId: examId
      });
    }
  }, [examId]);

  // DAGDAGIN ito after the main socket effect:
  useEffect(() => {
    if (!socketRef.current) return;

    // ✅ Add proctoring alert listener separately
    const currentSocket = socketRef.current;
    
    const proctoringHandler = (data) => {
      handleProctoringAlert(data);
    };
    
    currentSocket.on('proctoring-alert', proctoringHandler);
    
    return () => {
      if (currentSocket) {
        currentSocket.off('proctoring-alert', proctoringHandler);
      }
    };
  }, [handleProctoringAlert]); // ✅ Now this is safe

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
          const examData = examResponse.data;
          setExam(examData);
          
          // For live classes, no timer needed
          if (examData.examType === 'live-class' || examData.isLiveClass) {
            console.log("🎥 Live class loaded - no timer needed");
          }
          
          setSessionStarted(examData.isActive || false);
          
          console.log('📊 Exam loaded:', {
            examTitle: examData.title,
            examType: examData.examType,
            isLiveClass: examData.isLiveClass
          });
        }
        
      } catch (error) {
        console.error('❌ Failed to load exam data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadExamData();
  }, [examId, navigate]);

  // ==================== WEBRTC HANDLERS ====================
  const handleWebRTCOffer = async (data) => {
    console.log('🎯 Received WebRTC offer from:', data.from);
    
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
          lastSeen: new Date(),
          hasAlerts: false,
          alertCount: 0
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
        lastSeen: new Date(),
        hasAlerts: false,
        alertCount: 0
      }));
      setStudents(formattedStudents);

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
      roomId: `exam-${examId}`,
      teacherSocketId: socketRef.current.id
    });
    
    setTimeout(() => {
      activeConnections.current.delete(studentSocketId);
    }, 15000);
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

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // ==================== RENDER FUNCTIONS ====================
  
  const connectedStudents = students.filter(student => student.socketId && student.isConnected);

  // Timer Controls Component - UPDATED FOR LIVE CLASSES ONLY
  const renderTimerControls = () => {
    if (!showTimerControls) return null;

    return (
      <div className="timer-controls-panel">
        <div className="timer-controls-header">
          <h4>⏰ Live Class Timer</h4>
          <button className="close-controls-btn" onClick={toggleTimerControls}>✕</button>
        </div>
        
        <div className="timer-controls-content">
          {/* LIVE CLASS SPECIFIC CONTROLS */}
          <div className="live-class-controls">
            <h5>🎥 Live Class Controls</h5>
            <div className="control-buttons-grid">
              <button className="control-btn start" onClick={handleStartExam}>
                🚀 Start Live Class
              </button>
              <button className="control-btn end" onClick={handleEndExamSession}>
                🛑 End Live Class
              </button>
            </div>
          </div>
          
          {/* REMOVED ASYNC TIMER CONTROLS */}
        </div>
      </div>
    );
  };

  // PROCTORING CONTROLS POPUP
  const renderProctoringControlsPopup = () => {
    if (!showProctoringControls || !selectedStudent) return null;

    return (
      <div className="proctoring-controls-popup">
        <div className="proctoring-popup-content">
          <div className="proctoring-popup-header">
            <h3>🎯 Proctoring Controls</h3>
            <div className="student-info-popup">
              <div 
                className="student-avatar-popup"
                style={{ backgroundColor: getAvatarColor(connectedStudents.findIndex(s => s.socketId === selectedStudent.socketId)) }}
              >
                {getSafeStudentName(selectedStudent).charAt(0).toUpperCase()}
              </div>
              <div className="student-details-popup">
                <span className="student-name-popup">{getSafeStudentName(selectedStudent)}</span>
                <span className="student-id-popup">ID: {getSafeStudentId(selectedStudent)}</span>
              </div>
            </div>
            <button className="close-proctoring-btn" onClick={closeProctoringControls}>✕</button>
          </div>
          
          <div className="proctoring-popup-body">
            <TeacherProctoringControls 
              examId={examId}
              socket={socketRef.current}
              students={[selectedStudent]}
              onDetectionSettingsChange={(settings) => {
                console.log('Detection settings updated for student:', selectedStudent.name, settings);
              }}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderGlobalProctoringControls = () => {
    if (!showProctoringControls) return null;

    return (
      <div className="global-proctoring-popup">
        <div className="global-proctoring-content">
          <div className="global-proctoring-header">
            <h3>🎯 Global Proctoring Controls</h3>
            <button 
              className="close-global-proctoring-btn" 
              onClick={() => setShowProctoringControls(false)}
            >
              ✕
            </button>
          </div>
          
          <div className="global-proctoring-body">
            <TeacherProctoringControls 
              examId={examId}
              socket={socketRef.current}
              students={students}
              onDetectionSettingsChange={(settings) => {
                console.log('Global detection settings updated:', settings);
              }}
            />
          </div>
        </div>
      </div>
    );
  };

  // ✅ IMPROVED PROCTORING ALERTS RENDER FUNCTION - INTEGRATED IN FOOTER
  const renderProctoringAlerts = (student) => {
    const studentAlerts = proctoringAlerts[student.socketId] || [];
    
    // ✅ FIX: Use the correct state variable name
    const attemptsData = studentAttempts[student.socketId];
    
    const isExpanded = expandedAlerts[student.socketId];
    
    return (
      <div className="proctoring-alerts-footer">
        {/* ATTEMPTS DISPLAY */}
        {attemptsData && (
          <div className={`attempts-display-mini ${
            attemptsData.attemptsLeft <= 3 ? 'warning' : ''
          } ${
            attemptsData.attemptsLeft === 0 ? 'danger' : ''
          }`}>
            <span className="attempts-icon">⚠️</span>
            <span className="attempts-text">
              {attemptsData.attemptsLeft}/{attemptsData.maxAttempts}
            </span>
          </div>
        )}
        
        {/* ALERTS DISPLAY */}
        <div 
          className={`alerts-header ${isExpanded ? 'expanded' : ''}`}
          onClick={() => toggleAlertsDropdown(student.socketId)}
        >
          <div className="alerts-summary">
            <span className="alert-icon">🚨</span>
            <span className="alert-count">{studentAlerts.length}</span>
            <span className="latest-alert-time">
              {studentAlerts[0]?.timestamp}
            </span>
          </div>
          <div className="alerts-controls">
            <button 
              className="clear-alerts-btn"
              onClick={(e) => {
                e.stopPropagation();
                clearStudentAlerts(student.socketId, e);
              }}
              title="Clear all alerts"
            >
              🗑️
            </button>
            <span className="dropdown-arrow">
              {isExpanded ? '▲' : '▼'}
            </span>
          </div>
        </div>
        
        {/* ALERTS DROPDOWN */}
        {isExpanded && (
          <div className="alerts-dropdown">
            {/* ATTEMPTS SUMMARY */}
            {attemptsData && (
              <div className="attempts-summary-card">
                <div className="attempts-header">
                  <h5>📊 Violation Summary</h5>
                  <span className="attempts-total">
                    {attemptsData.currentAttempts}/{attemptsData.maxAttempts}
                  </span>
                </div>
                <div className="attempts-progress">
                  <div 
                    className="attempts-progress-bar"
                    style={{ 
                      width: `${(attemptsData.currentAttempts / attemptsData.maxAttempts) * 100}%`
                    }}
                  ></div>
                </div>
                <div className="attempts-left">
                  {attemptsData.attemptsLeft} attempts remaining
                </div>
              </div>
            )}
            
            {/* ALERTS LIST */}
            <div className="alerts-list">
              {studentAlerts.slice(0, 5).map((alert, index) => (
                <div key={alert.id || index} className={`alert-item ${alert.type}`}>
                  <div className="alert-content">
                    <div className="alert-message">
                      <span className={`alert-severity ${alert.severity}`}></span>
                      {alert.message}
                    </div>
                    <div className="alert-time">{alert.timestamp}</div>
                    {alert.detectionType && (
                      <div className="alert-type">{alert.detectionType}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderStudentVideos = () => {
    const studentsWithStreams = connectedStudents
      .filter(student => studentStreams[student.socketId])
      .sort((a, b) => getSafeStudentName(a).localeCompare(getSafeStudentName(b)));

    if (studentsWithStreams.length === 0) {
      return (
        <div className="no-videos">
          <div className="empty-state">
            <div className="camera-icon"></div>
            <h4>No one is here</h4>
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
                </div>
                
                {/* ✅ VIDEO FOOTER WITH PROCTORING ALERTS */}
                <div className="video-footer">
                  <div className="student-info-compact">
                    <span className="connection-type">🟢 Online</span>
                    {studentAttempts[student.socketId] && (
                      <span className={`attempts-display ${
                        studentAttempts[student.socketId].attemptsLeft <= 3 ? 'warning' : ''
                      } ${
                        studentAttempts[student.socketId].attemptsLeft === 0 ? 'danger' : ''
                      }`}>
                        Attempts: {studentAttempts[student.socketId].attemptsLeft}/{studentAttempts[student.socketId].maxAttempts}
                      </span>
                    )}
                  </div>
                  
                  {/* ✅ PROCTORING ALERTS SECTION */}
                  <div className="proctoring-alerts-section">
                    {renderProctoringAlerts(student)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render Chat Component
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
            Back to Dashboard
          </button>
          <div className="exam-info">
            <h1>{exam?.title || 'Exam Session'}</h1>
            <p>Class: {exam?.classId?.name || 'Current Class'}</p>
          </div>
        </div>
        
        <div className="header-center">
          {/* Timer Controls - Simplified for Live Class */}
          <div className="timer-section">
            <div className="timer-display" onClick={toggleTimerControls}>
              <span className="timer-text">🎥 LIVE CLASS</span>
            </div>
            <button 
              className="timer-controls-btn"
              onClick={toggleTimerControls}
              title="Live Class Controls"
            >
              ⚙️
            </button>
          </div>
          
          <div className="student-count">
            👥 {connectedStudents.length} Students
          </div>
          <div className={`socket-status ${socketStatus}`}>
            {socketStatus === 'connected' && '🟢 Connected'}
            {socketStatus === 'connecting' && '🟡 Connecting...'}
            {socketStatus === 'error' && '🔴 Error'}
            {socketStatus === 'disconnected' && '⚫ Disconnected'}
          </div>
        </div>
        
        <div className="header-right">
          <button 
            className="global-proctoring-btn"
            onClick={() => setShowProctoringControls(!showProctoringControls)}
            title="Global Proctoring Controls"
          >
            🎯 Proctoring
          </button>
          
          {/* Chat Toggle Button */}
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
              🚀 Start Live Class
            </button>
          ) : (
            <button className="end-exam-btn" onClick={handleEndExamSession}>
              ⏹️ End Live Class
            </button>
          )}
        </div>
      </div>

      {/* Main Content Layout - Videos Only */}
      <div className="teacher-exam-content-compact">
        {/* Videos Column Only */}
        <div className="content-column videos-column-full">
          <div className="section-card">
            <div className="card-section-header">
              <h3></h3>
              <span className="card-section-badge">
                {connectedStudents.filter(s => studentStreams[s.socketId]).length} Active
              </span>
            </div>
            {renderStudentVideos()}
          </div>
        </div>
      </div>

      {/* Chat Panel */}
      {renderChat()}

      {/* Timer Controls Panel - Now Live Class Controls */}
      {renderTimerControls()}

      {/* Global Proctoring Controls Popup */}
      {renderGlobalProctoringControls()}

      {/* PROCTORING CONTROLS POPUP */}
      {renderProctoringControlsPopup()}
    </div>
  );
}