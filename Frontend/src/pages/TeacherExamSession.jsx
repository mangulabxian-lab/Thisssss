// TeacherExamSession.jsx - COMPLETE FIXED VERSION WITH PROCTORING ALERTS
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
  const [timeLeft, setTimeLeft] = useState(3600);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [socketStatus, setSocketStatus] = useState('connecting');
  const [socket, setSocket] = useState(null);
  const [studentStreams, setStudentStreams] = useState({});
  const [peerConnections, setPeerConnections] = useState({});
  
  // Chat State
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Timer Control State
  const [showTimerControls, setShowTimerControls] = useState(false);
  const [timerEditMode, setTimerEditMode] = useState(false);
  const [customTime, setCustomTime] = useState({ hours: 1, minutes: 0, seconds: 0 });

  // PROCTORING CONTROLS POPUP STATE
  const [showProctoringControls, setShowProctoringControls] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // ✅ PROCTORING ALERTS STATE
  const [proctoringAlerts, setProctoringAlerts] = useState({});
  const [expandedAlerts, setExpandedAlerts] = useState({});

  // Refs
  const timerRef = useRef(null);
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

    const alertMessage = data.message || 'Suspicious activity detected';
    const messageString = typeof alertMessage === 'string' ? alertMessage : String(alertMessage);

    const newAlert = {
      id: Date.now() + Math.random(),
      message: messageString,
      type: data.type || 'warning',
      severity: data.severity || 'medium',
      timestamp: new Date().toLocaleTimeString(),
      details: data.details || {},
      studentSocketId: data.studentSocketId
    };

    console.log('📝 Storing alert for student:', data.studentSocketId, newAlert);

    setProctoringAlerts(prev => {
      const studentAlerts = prev[data.studentSocketId] || [];
      const updatedAlerts = {
        ...prev,
        [data.studentSocketId]: [
          newAlert,
          ...studentAlerts.slice(0, 19)
        ]
      };
      return updatedAlerts;
    });

    // Update student status
    setStudents(prev => prev.map(student => {
      if (student.socketId === data.studentSocketId) {
        const currentAlerts = proctoringAlerts[data.studentSocketId] || [];
        const newAlertCount = currentAlerts.length + 1;
        
        return { 
          ...student, 
          hasAlerts: true,
          lastAlert: newAlert.timestamp,
          alertCount: newAlertCount
        };
      }
      return student;
    }));

    console.log('🔔 Alert processed successfully for teacher view:', messageString);
  }, [proctoringAlerts]);

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

  // ==================== TIMER SYNC FUNCTIONS ====================
  const broadcastTimeUpdate = useCallback((newTime, runningState = null) => {
    if (socketRef.current) {
      const broadcastData = {
        roomId: `exam-${examId}`,
        timeLeft: newTime,
        isTimerRunning: runningState !== null ? runningState : isTimerRunning,
        timestamp: Date.now(),
        teacherName: 'Teacher'
      };
      
      socketRef.current.emit('exam-time-update', broadcastData);
      console.log('🕒 Broadcasting time to students:', {
        time: newTime,
        running: runningState !== null ? runningState : isTimerRunning,
        formatted: formatTime(newTime)
      });
    }
  }, [examId, isTimerRunning]);

  // ==================== TIMER CONTROL FUNCTIONS ====================
  const toggleTimerControls = () => {
    setShowTimerControls(!showTimerControls);
    if (showProctoringControls) {
      setShowProctoringControls(false);
    }
  };

  const startTimerEdit = () => {
    const hrs = Math.floor(timeLeft / 3600);
    const mins = Math.floor((timeLeft % 3600) / 60);
    const secs = timeLeft % 60;
    
    setCustomTime({
      hours: hrs,
      minutes: mins,
      seconds: secs
    });
    setTimerEditMode(true);
    setShowTimerControls(false);
  };

  const applyCustomTime = () => {
    const totalSeconds = (customTime.hours * 3600) + (customTime.minutes * 60) + customTime.seconds;
    
    if (totalSeconds <= 0) {
      alert('Please enter a valid time (greater than 0 seconds)');
      return;
    }

    console.log('⏰ Teacher setting new time:', {
      hours: customTime.hours,
      minutes: customTime.minutes,
      seconds: customTime.seconds,
      totalSeconds: totalSeconds,
      formatted: formatTime(totalSeconds)
    });

    setTimeLeft(totalSeconds);
    setTimerEditMode(false);
    
    // BROADCAST NEW TIME TO ALL STUDENTS
    broadcastTimeUpdate(totalSeconds, isTimerRunning);
    
    alert(`✅ Timer set to ${formatTime(totalSeconds)}. All students will see this time.`);
  };

  const cancelTimerEdit = () => {
    setTimerEditMode(false);
  };

  const handleTimeInputChange = (field, value) => {
    const numValue = parseInt(value) || 0;
    
    let limitedValue = numValue;
    if (field === 'hours') limitedValue = Math.min(23, Math.max(0, numValue));
    if (field === 'minutes') limitedValue = Math.min(59, Math.max(0, numValue));
    if (field === 'seconds') limitedValue = Math.min(59, Math.max(0, numValue));
    
    setCustomTime(prev => ({
      ...prev,
      [field]: limitedValue
    }));
  };

  const addTime = (minutes) => {
    const additionalSeconds = minutes * 60;
    const newTime = timeLeft + additionalSeconds;
    
    console.log('➕ Adding time:', {
      minutes: minutes,
      additionalSeconds: additionalSeconds,
      currentTime: timeLeft,
      newTime: newTime,
      formatted: formatTime(newTime)
    });

    setTimeLeft(newTime);
    broadcastTimeUpdate(newTime);
    alert(`✅ Added ${minutes} minutes. New time: ${formatTime(newTime)}`);
  };

  const pauseTimer = () => {
    console.log('⏸️ Teacher pausing timer');
    setIsTimerRunning(false);
    setShowTimerControls(false);
    broadcastTimeUpdate(timeLeft, false);
  };

  const resumeTimer = () => {
    console.log('▶️ Teacher resuming timer');
    setIsTimerRunning(true);
    setShowTimerControls(false);
    broadcastTimeUpdate(timeLeft, true);
  };

  const resetTimer = () => {
    if (!window.confirm('Are you sure you want to reset the timer to the original exam duration?')) {
      return;
    }
    
    const originalTime = exam?.timeLimit * 60 || 3600;
    console.log('🔄 Resetting timer to original:', {
      originalTime: originalTime,
      formatted: formatTime(originalTime)
    });

    setTimeLeft(originalTime);
    setIsTimerRunning(false);
    setShowTimerControls(false);
    broadcastTimeUpdate(originalTime, false);
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

    socketRef.current.emit('send-chat-message', {
      roomId: `exam-${examId}`,
      message: messageData
    });

    setMessages(prev => [...prev, messageData]);
    setNewMessage('');
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
    console.log('💬 Received chat message:', data);
    
    if (!data.message) {
      console.error('❌ Invalid chat message format:', data);
      return;
    }

    const newMessage = {
      id: data.message.id || Date.now().toString(),
      text: data.message.text,
      sender: data.message.sender,
      senderName: data.message.senderName || data.userName || 'Unknown',
      timestamp: new Date(data.message.timestamp || Date.now()),
      type: data.message.type
    };
    
    setMessages(prev => [...prev, newMessage]);
    
    if (!showChat) {
      setUnreadCount(prev => prev + 1);
    }
  }, [showChat]);

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
    
    newSocket.on('student-time-request', (data) => {
      console.log('🕒 Student requesting current time:', data.studentSocketId);
      newSocket.emit('send-current-time', {
        studentSocketId: data.studentSocketId,
        timeLeft: timeLeft,
        isTimerRunning: isTimerRunning
      });
    });

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
  }, [examId, handleProctoringAlert]);

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

  // ==================== TIMER CONTROL ====================
  useEffect(() => {
    if (isTimerRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          const newTime = prev - 1;
          
          if (newTime === 300 || newTime === 60 || newTime === 30 || newTime === 10) {
            broadcastTimeUpdate(newTime);
          }
          
          return newTime;
        });
      }, 1000);
    } else if (timeLeft <= 0 && isTimerRunning) {
      broadcastTimeUpdate(0, false);
      handleEndExam();
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning, timeLeft]);

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
          const initialTime = examResponse.data.timeLimit * 60 || 3600;
          setTimeLeft(initialTime);
          setSessionStarted(examResponse.data.isActive || false);
          
          console.log('📊 Exam loaded with time:', {
            timeLimit: examResponse.data.timeLimit,
            initialTime: initialTime,
            formatted: formatTime(initialTime)
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

  const handleStartExam = async () => {
    try {
      console.log('🚀 Starting exam session...');
      
      const response = await startExamSession(examId);
      if (response.success) {
        setSessionStarted(true);
        setIsTimerRunning(true);
        console.log('✅ Exam session started successfully');
        
        // BROADCAST EXAM START TO ALL STUDENTS
        if (socketRef.current) {
          console.log('📢 Broadcasting exam start to students...');
          
          const startData = {
            roomId: `exam-${examId}`,
            examId: examId,
            examTitle: exam?.title || 'Exam',
            timestamp: new Date().toISOString(),
            requiresCamera: true,
            requiresMicrophone: true
          };
          
          console.log('🎯 Sending exam-started event:', startData);
          
          socketRef.current.emit('exam-started', startData);
          
          const connectedStudents = students.filter(student => student.socketId);
          connectedStudents.forEach(student => {
            if (student.socketId) {
              socketRef.current.emit('exam-started', {
                ...startData,
                targetStudent: student.socketId
              });
            }
          });
        }
        
        // BROADCAST INITIAL TIME
        setTimeout(() => {
          broadcastTimeUpdate(timeLeft, true);
        }, 1000);
        
        // Request cameras for connected students
        const connectedStudents = students.filter(student => student.socketId);
        console.log(`📹 Requesting cameras from ${connectedStudents.length} connected students`);
        
        connectedStudents.forEach((student, index) => {
          setTimeout(() => {
            requestStudentCamera(student.socketId);
          }, 1000 + (index * 1000));
        });
        
        alert('✅ Exam started! Students can now see the quiz.');
      } else {
        alert('❌ Failed to start exam session');
      }
    } catch (error) {
      console.error('Failed to start exam:', error);
      alert('Failed to start exam session');
    }
  };

  const handleEndExam = async () => {
    try {
      console.log('🛑 Ending exam session and disconnecting all students...');
      
      // BROADCAST EXAM END TO ALL STUDENTS
      if (socketRef.current) {
        socketRef.current.emit('exam-ended', {
          roomId: `exam-${examId}`,
          message: 'Exam has been ended by teacher',
          timestamp: new Date().toISOString()
        });
      }
      
      // Disconnect all students
      const connectedStudents = students.filter(student => student.socketId);
      connectedStudents.forEach(student => {
        if (socketRef.current) {
          socketRef.current.emit('disconnect-student', {
            studentSocketId: student.socketId,
            reason: 'Exam ended by teacher',
            examId: examId
          });
        }
      });
      
      cleanupAllConnections();
      
      const response = await endExamSession(examId);
      if (response.success) {
        setSessionStarted(false);
        setIsTimerRunning(false);
        setStudents([]);
        setStudentStreams({});
        setPeerConnections({});
        setMessages([]);
        setProctoringAlerts({});
        setExpandedAlerts({});
        alert('✅ Exam ended! All students have been disconnected.');
      }
    } catch (error) {
      console.error('Failed to end exam:', error);
      alert('Failed to end exam session');
    }
  };

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

  // Timer Controls Component
  const renderTimerControls = () => {
    if (!showTimerControls) return null;

    return (
      <div className="timer-controls-panel">
        <div className="timer-controls-header">
          <h4>⏰ Timer Controls</h4>
          <button className="close-controls-btn" onClick={toggleTimerControls}>✕</button>
        </div>
        
        <div className="timer-controls-content">
          <div className="time-adjust-buttons">
            <h5>➕ Add Time</h5>
            <div className="time-buttons-grid">
              <button className="time-btn" onClick={() => addTime(5)}>+5 min</button>
              <button className="time-btn" onClick={() => addTime(10)}>+10 min</button>
              <button className="time-btn" onClick={() => addTime(15)}>+15 min</button>
              <button className="time-btn" onClick={() => addTime(30)}>+30 min</button>
            </div>
          </div>

          <div className="timer-control-buttons">
            <h5>⏱️ Timer Controls</h5>
            <div className="control-buttons-grid">
              {isTimerRunning ? (
                <button className="control-btn pause" onClick={pauseTimer}>
                  ⏸️ Pause Timer
                </button>
              ) : (
                <button className="control-btn resume" onClick={resumeTimer}>
                  ▶️ Resume Timer
                </button>
              )}
              <button className="control-btn edit" onClick={startTimerEdit}>
                ⚙️ Set Custom Time
              </button>
              <button className="control-btn reset" onClick={resetTimer}>
                🔄 Reset to Original
              </button>
            </div>
          </div>
          
          <div className="timer-info">
            <p><strong>Current Time:</strong> {formatTime(timeLeft)}</p>
            <p><strong>Status:</strong> {isTimerRunning ? 'Running' : 'Paused'}</p>
            <p><strong>Students:</strong> Will see EXACTLY this time</p>
          </div>
        </div>
      </div>
    );
  };

  // Timer Edit Modal
  const renderTimerEditModal = () => {
    if (!timerEditMode) return null;

    return (
      <div className="timer-edit-modal">
        <div className="timer-edit-content">
          <h3>⏰ Set Custom Time</h3>
          <p className="edit-description">This time will be shown to ALL students</p>
          
          <div className="time-inputs">
            <div className="time-input-group">
              <label>Hours</label>
              <input
                type="number"
                min="0"
                max="23"
                value={customTime.hours}
                onChange={(e) => handleTimeInputChange('hours', e.target.value)}
                className="time-input"
              />
            </div>
            
            <div className="time-input-group">
              <label>Minutes</label>
              <input
                type="number"
                min="0"
                max="59"
                value={customTime.minutes}
                onChange={(e) => handleTimeInputChange('minutes', e.target.value)}
                className="time-input"
              />
            </div>
            
            <div className="time-input-group">
              <label>Seconds</label>
              <input
                type="number"
                min="0"
                max="59"
                value={customTime.seconds}
                onChange={(e) => handleTimeInputChange('seconds', e.target.value)}
                className="time-input"
              />
            </div>
          </div>

          <div className="preview-time">
            <strong>All students will see:</strong> 
            <span className="preview-display">
              {formatTime((customTime.hours * 3600) + (customTime.minutes * 60) + customTime.seconds)}
            </span>
          </div>

          <div className="timer-edit-actions">
            <button className="cancel-btn" onClick={cancelTimerEdit}>
              Cancel
            </button>
            <button className="apply-btn" onClick={applyCustomTime}>
              ✅ Apply to Everyone
            </button>
          </div>
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

  // ✅ RENDER PROCTORING ALERTS IN VIDEO FOOTER
  const renderProctoringAlerts = (student) => {
    const studentAlerts = proctoringAlerts[student.socketId] || [];
    const isExpanded = expandedAlerts[student.socketId];
    
    console.log(`📊 Rendering alerts for ${student.name}:`, studentAlerts.length, 'alerts');

    if (studentAlerts.length === 0) {
      return (
        <div className="no-alerts-message">
          <span className="alert-icon">✅</span>
          No alerts
        </div>
      );
    }

    return (
      <div className="proctoring-alerts-footer">
        <div 
          className="alerts-header"
          onClick={() => {
            console.log('📂 Toggling alerts for:', student.name);
            toggleAlertsDropdown(student.socketId);
          }}
        >
          <div className="alerts-summary">
            <span className="alert-icon">🚨</span>
            <span className="alert-count">{studentAlerts.length} alert(s)</span>
            <span className="latest-alert-time">
              Latest: {studentAlerts[0]?.timestamp}
            </span>
          </div>
          <div className="alerts-controls">
            <button 
              className="clear-alerts-btn"
              onClick={(e) => {
                e.stopPropagation();
                console.log('🗑️ Clearing alerts for:', student.name);
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
        
        {isExpanded && (
          <div className="alerts-dropdown">
            <div className="alerts-list">
              {studentAlerts.map((alert, index) => (
                <div key={alert.id || index} className={`alert-item ${alert.type}`}>
                  <div className="alert-icon-small">
                    {alert.type === 'warning' ? '⚠️' : 
                     alert.type === 'danger' ? '🚨' : 'ℹ️'}
                  </div>
                  <div className="alert-content">
                    <div className="alert-message">{alert.message}</div>
                    <div className="alert-time">{alert.timestamp}</div>
                    {alert.details && (
                      <div className="alert-details">
                        {JSON.stringify(alert.details)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="alerts-footer">
              <span className="total-alerts">Total: {studentAlerts.length} alerts</span>
              <button 
                className="test-alert-btn"
                onClick={() => {
                  handleProctoringAlert({
                    studentSocketId: student.socketId,
                    message: 'TEST ALERT: System is working',
                    type: 'warning',
                    severity: 'medium',
                    timestamp: new Date().toLocaleTimeString()
                  });
                }}
              >
                Test Alert
              </button>
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
                  <button 
                    className="student-settings-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      openProctoringControls(student);
                    }}
                    title="Detection Settings"
                  >
                    ⚙️
                  </button>
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
                    <span className="student-id">ID: {getSafeStudentId(student)}</span>
                    <span className="connection-type">🟢 Online</span>
                  </div>
                  
                  {/* ✅ PROCTORING ALERTS SECTION */}
                  <div className="proctoring-alerts-section">
                    {renderProctoringAlerts(student)}
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
            ← Back to Dashboard
          </button>
          <div className="exam-info">
            <h1>{exam?.title || 'Exam Session'}</h1>
            <p>Class: {exam?.classId?.name || 'Current Class'}</p>
          </div>
        </div>
        
        <div className="header-center">
          {/* Timer with Controls */}
          <div className="timer-section">
            <div className="timer-display" onClick={toggleTimerControls}>
              <span className="timer-text">{formatTime(timeLeft)}</span>
            </div>
            <button 
              className="timer-controls-btn"
              onClick={toggleTimerControls}
              title="Timer Controls"
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
              🚀 Start Exam
            </button>
          ) : (
            <button className="end-exam-btn" onClick={handleEndExam}>
              ⏹️ End Exam
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

      {/* Timer Controls Panel */}
      {renderTimerControls()}

      {/* Timer Edit Modal */}
      {renderTimerEditModal()}

      {/* PROCTORING CONTROLS POPUP */}
      {renderProctoringControlsPopup()}
    </div>
  );
}