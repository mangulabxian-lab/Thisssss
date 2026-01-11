// server.js - COMPLETELY FIXED VERSION WITH PENDING EXAMS NOTIFICATION SYSTEM
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const path = require("path");
const jwt = require("jsonwebtoken");
const adminAuthRoutes = require('./routes/adminAuth');
const adminDashboardRoutes = require('./routes/adminDashboard');

// ✅ LOAD ENV FIRST
dotenv.config();

// ✅ ADD BACK PASSPORT CONFIGURATION
require("./config/passport");

const app = express();
const server = http.createServer(app);

// ===== PASSPORT INITIALIZATION =====
const passport = require("passport");
app.use(passport.initialize());

// ===== SOCKET.IO SETUP =====
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:3000"
    ],
    credentials: true,
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling'],
  allowEIO3: false,
  connectTimeout: 8000,
  pingTimeout: 20000,
  pingInterval: 10000
});

// ===== MIDDLEWARES =====
app.use(cors({ 
  origin: [
    "http://localhost:5173",
    "http://127.0.0.1:5173", 
    "http://localhost:3000"
  ],
  credentials: true 
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));


//========ADMIN============
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);

// ===== ROUTES =====
app.use("/api/auth", require("./routes/auth"));
app.use("/api/class", require("./routes/classes"));
app.use("/api/exams", require("./routes/examRoutes"));
app.use("/api/classwork", require("./routes/classwork"));
app.use("/api/announcements", require("./routes/announcements"));
app.use("/api/student-management", require("./routes/studentManagement"));
app.use("/api/notifications", require("./routes/notifications"));

// CHAT ROUTES COMPLETELY REMOVED
// THEME ROUTES COMPLETELY REMOVED

// ✅ ADD DEBUG ROUTE TO TEST ALL REGISTERED ROUTES
app.get("/api/debug-routes", (req, res) => {
  const routes = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      // Regular route
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods),
        type: 'route'
      });
    } else if (middleware.name === 'router') {
      // Router middleware
      routes.push({
        path: middleware.regexp.toString(),
        type: 'router',
        mounted: true
      });
    }
  });
  res.json({ 
    success: true,
    message: 'All registered routes',
    routes: routes
  });
});

// Sa server.js, idagdag ito bago ang health check:
app.post('/api/proctoring-alert', async (req, res) => {
  try {
    const alertData = req.body;
    console.log('🚨 Received proctoring alert from Python:', alertData);

    const { examId, studentSocketId, message, type, severity } = alertData;
    
    if (!examId) {
      return res.status(400).json({ error: 'examId is required' });
    }

    // Broadcast to teacher room
    io.to(`exam-${examId}`).emit('proctoring-alert', {
      ...alertData,
      timestamp: new Date().toISOString(),
      source: 'python_backend'
    });

    console.log(`✅ Proctoring alert forwarded to exam-${examId}`);
    res.json({ success: true, message: 'Alert forwarded' });
    
  } catch (error) {
    console.error('❌ Error forwarding proctoring alert:', error);
    res.status(500).json({ error: 'Failed to forward alert' });
  }
});

// ===== HEALTH CHECK =====
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "OK", 
    message: "Server is running",
    socketIO: "ENABLED",
    realTimeComments: "ENABLED",
    pendingExamsSystem: "ENABLED", // ✅ ADDED
    timestamp: new Date().toISOString()
  });
});

// ===== COMMENT BROADCASTING FUNCTIONS =====
const broadcastNewComment = (quizId, comment) => {
  console.log(`📝 Broadcasting new comment to quiz-comments-${quizId}:`, comment._id);
  io.to(`quiz-comments-${quizId}`).emit('new-comment', comment);
};

const broadcastDeletedComment = (quizId, commentId) => {
  console.log(`🗑️ Broadcasting deleted comment to quiz-comments-${quizId}:`, commentId);
  io.to(`quiz-comments-${quizId}`).emit('comment-deleted', commentId);
};

// ===== REAL-TIME TIMER UPDATE FUNCTIONS =====
// ✅ ADDED: Socket.IO handler for server time requests
const requestServerTime = async (data) => {
  const { examId, studentId } = data;
  
  const timerService = require('./services/examTimerService');
  const timeData = await timerService.getExamStatus(examId, studentId);
  
  return {
    examId,
    timeData,
    serverTime: new Date().toISOString()
  };
};

// ✅ ADDED: Broadcast timer updates to all students
const broadcastTimerUpdate = (examId, updateData) => {
  io.to(`exam-${examId}`).emit('server-timer-update', {
    examId,
    ...updateData,
    timestamp: new Date().toISOString()
  });
};

// ===== TIMER MANAGEMENT FUNCTIONS =====
const activeTimers = new Map();

function startTimerCountdown(examId, duration) {
  const roomId = `exam-${examId}`;
  
  // Clear existing timer if any
  if (activeTimers.has(examId)) {
    clearInterval(activeTimers.get(examId));
  }
  
  let remaining = duration;
  
  const timerInterval = setInterval(async () => {
    remaining--;
    
    // Broadcast remaining time to all in room
    io.to(roomId).emit('timer-update', {
      examId,
      remaining,
      formatted: formatTime(remaining)
    });
    
    // Check if timer reached 0
    if (remaining <= 0) {
      clearInterval(timerInterval);
      activeTimers.delete(examId);
      
      // Auto-disconnect all students if enabled
      const Exam = require('./models/Exam');
      const exam = await Exam.findById(examId);
      
      if (exam?.liveClassSettings?.autoDisconnect) {
        console.log(`⏰ Timer ended for exam ${examId}, disconnecting students...`);
        
        // Broadcast timer ended event
        io.to(roomId).emit('timer-ended', {
          examId,
          message: 'Time is up! Exam session has ended.',
          forcedExit: true
        });
        
        // Force disconnect all students
        if (examRooms.has(roomId)) {
          const room = examRooms.get(roomId);
          room.students.forEach((studentInfo, studentSocketId) => {
            const studentSocket = io.sockets.sockets.get(studentSocketId);
            if (studentSocket) {
              studentSocket.emit('force-exit-exam', {
                reason: 'time_up',
                examId: examId,
                message: 'Exam time has expired',
                submitAnswers: true
              });
            }
          });
        }
      }
    }
  }, 1000);
  
  activeTimers.set(examId, timerInterval);
}

// ADD THIS HELPER FUNCTION:
function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

// ===== SOCKET.IO AUTHENTICATION =====
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      console.log('❌ No token provided');
      return next(new Error('Authentication error'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    socket.userName = decoded.name;
    socket.userRole = decoded.role || 'student';
    console.log('✅ Socket authenticated:', socket.userName, 'Role:', socket.userRole);
    next();
    
  } catch (err) {
    console.log('❌ Socket auth failed');
    next(new Error('Authentication failed'));
  }
});

// ===== SOCKET.IO ROOM MANAGEMENT =====
const examRooms = new Map();
const pendingCameraRequests = new Set();
const endedExams = new Set(); // ✅ ADD THIS: Track ended exams
const classRooms = new Map(); // ✅ ADDED: Track class rooms for notifications

// Add this helper function
const isExamEnded = (examId) => {
  return endedExams.has(`exam-${examId}`);
};

// ✅ ADDED: Pending exams tracker
const pendingExamsTracker = new Map(); // classId -> Set of studentIds with pending exams

// ✅ ADDED: Helper function to update pending exams for a student
const updatePendingExamsForStudent = async (classId, studentId) => {
  try {
    const Class = require('./models/Class');
    const Exam = require('./models/Exam');
    
    const classItem = await Class.findById(classId);
    if (!classItem) return 0;

    // Find all exams in this class
    const exams = await Exam.find({
      classId: classId,
      $or: [
        { isPublished: true },
        { isDeployed: true },
        { status: 'published' }
      ]
    }).select('title examType isLiveClass timeLimit isActive isDeployed isPublished completedBy');

    // Count pending exams
    const pendingCount = exams.filter(exam => {
      const hasCompleted = exam.completedBy?.some(completion => {
        const compStudentId = completion.studentId?._id || completion.studentId;
        return compStudentId && compStudentId.toString() === studentId.toString();
      });
      return !hasCompleted && (exam.isPublished || exam.isDeployed);
    }).length;

    // Store in tracker
    if (!pendingExamsTracker.has(classId)) {
      pendingExamsTracker.set(classId, new Map());
    }
    const classTracker = pendingExamsTracker.get(classId);
    classTracker.set(studentId, pendingCount);

    return pendingCount;
  } catch (error) {
    console.error('Error updating pending exams:', error);
    return 0;
  }
};

io.on("connection", (socket) => {
  console.log("✅ Socket connected:", socket.id, "User:", socket.userName, "Role:", socket.userRole);

  let currentRoom = null;
  
  // ✅ ADDED: Join class room for pending exams notifications
  socket.on('join-class-for-notifications', async ({ classId }) => {
    const roomName = `class-notifications-${classId}`;
    socket.join(roomName);
    console.log(`📢 User ${socket.userName} joined class notifications: ${roomName}`);
    
    // Initialize class room tracking
    if (!classRooms.has(classId)) {
      classRooms.set(classId, {
        students: new Map(),
        teachers: new Map()
      });
    }
    
    const classRoom = classRooms.get(classId);
    
    // Add user to class room
    if (socket.userRole === 'student') {
      classRoom.students.set(socket.userId, {
        socketId: socket.id,
        studentId: socket.userId,
        studentName: socket.userName,
        lastActive: new Date()
      });
      
      // Calculate pending exams for this student
      const pendingCount = await updatePendingExamsForStudent(classId, socket.userId);
      
      // Send initial pending count to student
      socket.emit('pending-exams-update', {
        classId: classId,
        pendingCount: pendingCount,
        timestamp: new Date().toISOString()
      });
      
    } else if (socket.userRole === 'teacher') {
      classRoom.teachers.set(socket.userId, {
        socketId: socket.id,
        teacherId: socket.userId,
        teacherName: socket.userName
      });
    }
    
    console.log(`🏫 Class ${classId} now has ${classRoom.students.size} students and ${classRoom.teachers.size} teachers online`);
  });

  // ✅ ADDED: Leave class room
  socket.on('leave-class-notifications', ({ classId }) => {
    const roomName = `class-notifications-${classId}`;
    socket.leave(roomName);
    
    // Remove from class room tracking
    if (classRooms.has(classId)) {
      const classRoom = classRooms.get(classId);
      if (socket.userRole === 'student') {
        classRoom.students.delete(socket.userId);
      } else if (socket.userRole === 'teacher') {
        classRoom.teachers.delete(socket.userId);
      }
    }
    
    console.log(`📢 User ${socket.userName} left class notifications: ${roomName}`);
  });

  // ✅ ADDED: REQUEST SERVER TIME HANDLER
  socket.on('request-server-time', async (data) => {
    try {
      console.log('🕒 Requesting server time for:', data);
      const { examId, studentId } = data;
      
      const timerService = require('./services/examTimerService');
      const timeData = await timerService.getExamStatus(examId, studentId);
      
      socket.emit('server-time-response', {
        examId,
        timeData,
        serverTime: new Date().toISOString()
      });
      
      console.log('✅ Server time response sent for exam:', examId);
    } catch (error) {
      console.error('❌ Error in request-server-time:', error);
      socket.emit('server-time-error', {
        error: 'Failed to get server time',
        examId: data.examId
      });
    }
  });

  // ✅ ADDED: BROADCAST TIMER UPDATE HANDLER
  socket.on('broadcast-timer-update', (data) => {
    try {
      console.log('📢 Broadcasting timer update:', data);
      const { examId, ...updateData } = data;
      
      broadcastTimerUpdate(examId, updateData);
      
      console.log(`✅ Timer update broadcasted to exam-${examId}`);
    } catch (error) {
      console.error('❌ Error broadcasting timer update:', error);
    }
  });

  // ✅ ADDED: TIMER MANAGEMENT HANDLERS
  socket.on('start-exam-timer', async (data) => {
    try {
      const { examId, duration } = data; // duration in seconds
      console.log('⏱️ Starting exam timer:', examId, duration);
      
      const Exam = require('./models/Exam');
      const exam = await Exam.findById(examId);
      
      if (!exam) {
        socket.emit('timer-error', { message: 'Exam not found' });
        return;
      }
      
      // Update exam with timer
      const durationMinutes = Math.floor(duration / 60);
      await exam.startTimer(durationMinutes);
      
      const roomId = `exam-${examId}`;
      
      // Broadcast to all connected clients
      io.to(roomId).emit('timer-started', {
        examId,
        startedAt: exam.liveClassSettings.timerStartedAt,
        endsAt: exam.liveClassSettings.timerEndsAt,
        duration,
        roomId
      });
      
      console.log(`✅ Timer started for exam ${examId}, broadcasting to room ${roomId}`);
      
      // Start countdown interval
      startTimerCountdown(examId, duration);
      
    } catch (error) {
      console.error('❌ Error starting timer:', error);
      socket.emit('timer-error', { message: 'Failed to start timer' });
    }
  });

  socket.on('get-timer-status', async (data) => {
    try {
      const { examId } = data;
      const Exam = require('./models/Exam');
      const exam = await Exam.findById(examId);
      
      if (!exam || !exam.liveClassSettings?.hasTimer) {
        socket.emit('timer-status', { 
          hasTimer: false,
          remaining: 0
        });
        return;
      }
      
      const remaining = exam.getRemainingTime();
      
      socket.emit('timer-status', {
        hasTimer: true,
        remaining,
        startedAt: exam.liveClassSettings.timerStartedAt,
        endsAt: exam.liveClassSettings.timerEndsAt,
        autoDisconnect: exam.liveClassSettings.autoDisconnect
      });
      
    } catch (error) {
      console.error('❌ Error getting timer status:', error);
    }
  });

  // ✅ ADDED: Broadcast when teacher publishes/deploys an exam
  socket.on('exam-published', async (data) => {
    console.log('📢 Teacher published/deployed exam:', data);
    
    const { examId, classId, title, examType } = data;
    
    // Broadcast to all students in this class
    io.to(`class-notifications-${classId}`).emit('new-exam-notification', {
      examId,
      title,
      examType,
      classId,
      timestamp: new Date().toISOString(),
      type: 'new_exam',
      action: 'published'
    });
    
    // Update pending exams for all students in this class
    if (classRooms.has(classId)) {
      const classRoom = classRooms.get(classId);
      classRoom.students.forEach(async (studentInfo, studentId) => {
        const pendingCount = await updatePendingExamsForStudent(classId, studentId);
        
        // Notify individual student
        const studentSocket = io.sockets.sockets.get(studentInfo.socketId);
        if (studentSocket) {
          studentSocket.emit('pending-exams-update', {
            classId: classId,
            pendingCount: pendingCount,
            newExam: { examId, title, examType },
            timestamp: new Date().toISOString()
          });
        }
      });
    }
    
    console.log(`✅ Notified class ${classId} about new exam "${title}"`);
  });

  // ✅ ADDED: Broadcast when exam is completed by student
  socket.on('exam-completed', async (data) => {
    console.log('✅ Student completed exam:', data);
    
    const { examId, studentId, classId, title } = data;
    
    // Update pending exams for this student
    const pendingCount = await updatePendingExamsForStudent(classId, studentId);
    
    // Notify student about updated pending count
    if (classRooms.has(classId)) {
      const classRoom = classRooms.get(classId);
      const studentInfo = classRoom.students.get(studentId);
      
      if (studentInfo) {
        const studentSocket = io.sockets.sockets.get(studentInfo.socketId);
        if (studentSocket) {
          studentSocket.emit('pending-exams-update', {
            classId: classId,
            pendingCount: pendingCount,
            completedExam: { examId, title },
            timestamp: new Date().toISOString()
          });
        }
      }
    }
    
    console.log(`✅ Updated pending exams for student ${studentId}: ${pendingCount} pending`);
  });

  // ✅ ADDED: Request pending exams update
  socket.on('request-pending-update', async ({ classId }) => {
    if (socket.userRole === 'student') {
      const pendingCount = await updatePendingExamsForStudent(classId, socket.userId);
      
      socket.emit('pending-exams-update', {
        classId: classId,
        pendingCount: pendingCount,
        timestamp: new Date().toISOString()
      });
      
      console.log(`🔄 Sent pending update to ${socket.userName}: ${pendingCount} exams`);
    }
  });

  // ===== ATTEMPTS PERSISTENCE =====
  const studentAttemptsStorage = new Map(); // Store attempts by student ID

  // Function to get student attempts
  const getStudentAttempts = (studentId, examId) => {
    const key = `${examId}_${studentId}`;
    if (!studentAttemptsStorage.has(key)) {
      studentAttemptsStorage.set(key, {
        currentAttempts: 0,
        maxAttempts: 10,
        attemptsLeft: 10,
        history: []
      });
    }
    return studentAttemptsStorage.get(key);
  };

  // Function to save student attempts
  const saveStudentAttempts = (studentId, examId, attempts) => {
    const key = `${examId}_${studentId}`;
    studentAttemptsStorage.set(key, attempts);
  };

  // ===== REAL-TIME COMMENT HANDLERS =====
  socket.on('join-quiz-comments', ({ quizId }) => {
    const roomName = `quiz-comments-${quizId}`;
    socket.join(roomName);
    console.log(`📝 User ${socket.userName} joined quiz comments room: ${roomName}`);
  });

  // ✅ UPDATED: Unified chat handler for both teacher and student
  socket.on('send-exam-chat-message', async (data) => {
    try {
      console.log('💬 Received chat message:', {
        from: socket.userName,
        role: socket.userRole,
        data: data
      });
      
      const { roomId, message } = data;
      
      if (!roomId || !message) {
        console.error('❌ Invalid chat data:', data);
        return;
      }

      // ✅ SAFELY EXTRACT MESSAGE TEXT
      let messageText;
      if (typeof message === 'object' && message.text) {
        messageText = message.text;
      } else if (typeof message === 'string') {
        messageText = message;
      } else {
        console.error('❌ Invalid message format:', message);
        return;
      }
      
      if (!messageText || !messageText.trim()) {
        return;
      }

      const messageData = {
        id: Date.now().toString(),
        text: messageText.trim(),
        sender: socket.userRole, // 'teacher' or 'student'
        senderName: socket.userName,
        timestamp: new Date().toISOString(),
        type: 'chat'
      };

      console.log(`💬 Broadcasting chat to ${roomId}:`, {
        from: socket.userName,
        message: messageText,
        toRoom: roomId
      });

      // ✅ BROADCAST TO EXAM ROOM - USING SAME EVENT NAME
      io.to(roomId).emit('exam-chat-message', {
        message: messageData,
        userName: socket.userName,
        userRole: socket.userRole,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error handling chat message:', error);
    }
  });

  // Sa server.js, tiyakin na tama ang proctoring alert handler:
  socket.on('proctoring-alert', (data) => {
    console.log('🚨 Received proctoring alert from student:', data);
    
    // Multiple ways to get examId
    const examId = data.examId || 
                  (data.roomId ? data.roomId.replace('exam-', '') : null) ||
                  (socket.rooms ? Array.from(socket.rooms).find(room => room.startsWith('exam-'))?.replace('exam-', '') : null);
    
    if (examId) {
      console.log(`📤 Forwarding alert to exam room: exam-${examId}`);
      
      // ✅ CRITICAL: Include studentSocketId in the forwarded data
      const alertData = {
        ...data,
        studentSocketId: data.studentSocketId || socket.id, // Ensure studentSocketId is included
        examId: examId,
        timestamp: new Date().toISOString(),
        forwardedAt: Date.now()
      };
      
      // Forward to teacher room with enhanced data
      io.to(`exam-${examId}`).emit('proctoring-alert', alertData);
      
      console.log(`✅ Alert forwarded successfully to exam-${examId}:`, alertData);
    } else {
      console.error('❌ No examId found in proctoring alert. Data:', data);
      console.log('📋 Available rooms:', socket.rooms);
    }
  });

  // Manual violation from teacher
  socket.on('manual-violation', (data) => {
    console.log(`⚠️ Manual violation for ${data.studentSocketId}: ${data.violationType}`);
    
    // ✅ CORRECT: Use io.to() instead of sio.emit()
    io.to(`exam-${data.examId}`).emit('student-violation', {
      studentSocketId: data.studentSocketId,
      violationType: data.violationType,
      severity: 'manual',
      examId: data.examId,
      timestamp: new Date().toISOString()
    });
  });

  // Auto violations from proctoring
  socket.on('proctoring-violation', (data) => {
    console.log(`⚠️ Auto violation for ${data.studentSocketId}: ${data.violationType}`);
    
    // ✅ CORRECT: Use io.to() instead of sio.emit()
    io.to(`exam-${data.examId}`).emit('student-violation', {
      studentSocketId: data.studentSocketId,
      violationType: data.violationType,
      severity: data.severity || 'auto',
      examId: data.examId,
      timestamp: new Date().toISOString()
    });
  });

  // Sa socket.on('student-time-request')
  socket.on('student-time-request', (data) => {
    console.log('🕒 Student requesting current time:', data.studentSocketId);
    
    const room = examRooms.get(data.roomId);
    if (room) {
      socket.emit('send-current-time', {
        studentSocketId: data.studentSocketId,
        timeLeft: room.timeLeft || 600,
        isTimerRunning: room.isTimerRunning || false,
        examStarted: room.examStarted || false
      });
      
      console.log('✅ Sent current time to student:', {
        time: room.timeLeft,
        running: room.isTimerRunning,
        student: data.studentSocketId
      });
    }
  });

  // ===== TIMER MANAGEMENT FUNCTIONS =====
  const calculateRemainingTime = (timerState) => {
    if (!timerState || !timerState.isRunning || !timerState.startedAt) {
      return timerState?.remainingSeconds || 0;
    }
    
    const now = new Date();
    const lastUpdated = timerState.lastUpdated || timerState.startedAt;
    const elapsedSeconds = Math.floor((now - lastUpdated) / 1000);
    const remaining = Math.max(0, (timerState.remainingSeconds || 0) - elapsedSeconds);
    
    return remaining;
  };

  const updateRoomTimer = (roomId, room) => {
    if (!room || !room.timerState) return;
    
    const remaining = calculateRemainingTime(room.timerState);
    room.timeLeft = remaining;
    
    // Update the room's timer state
    room.timerState.remainingSeconds = remaining;
    room.timerState.lastUpdated = new Date();
    
    return remaining;
  };

  const startTimerForRoom = async (roomId, examId, totalSeconds) => {
    const room = examRooms.get(roomId);
    if (!room) return;
    
    room.timerState = {
      remainingSeconds: totalSeconds,
      totalDuration: totalSeconds,
      isRunning: true,
      startedAt: new Date(),
      lastUpdated: new Date(),
      pausedAt: null
    };
    
    room.timeLeft = totalSeconds;
    room.isTimerRunning = true;
    
    // Also update in database
    try {
      const Exam = require('./models/Exam');
      await Exam.findByIdAndUpdate(examId, {
        'timerState.remainingSeconds': totalSeconds,
        'timerState.totalDuration': totalSeconds,
        'timerState.isRunning': true,
        'timerState.startedAt': new Date(),
        'timerState.lastUpdated': new Date()
      });
    } catch (error) {
      console.error('Error saving timer to DB:', error);
    }
  };

  const pauseTimerForRoom = async (roomId, examId) => {
    const room = examRooms.get(roomId);
    if (!room || !room.timerState) return;
    
    const remaining = calculateRemainingTime(room.timerState);
    
    room.timerState.isRunning = false;
    room.timerState.remainingSeconds = remaining;
    room.timerState.pausedAt = new Date();
    room.timerState.lastUpdated = new Date();
    
    room.timeLeft = remaining;
    room.isTimerRunning = false;
    
    // Update in database
    try {
      const Exam = require('./models/Exam');
      await Exam.findByIdAndUpdate(examId, {
        'timerState.remainingSeconds': remaining,
        'timerState.isRunning': false,
        'timerState.pausedAt': new Date(),
        'timerState.lastUpdated': new Date()
      });
    } catch (error) {
      console.error('Error pausing timer in DB:', error);
    }
  };

  const resumeTimerForRoom = async (roomId, examId) => {
    const room = examRooms.get(roomId);
    if (!room || !room.timerState) return;
    
    room.timerState.isRunning = true;
    room.timerState.pausedAt = null;
    room.timerState.lastUpdated = new Date();
    
    room.isTimerRunning = true;
    
    // Update in database
    try {
      const Exam = require('./models/Exam');
      await Exam.findByIdAndUpdate(examId, {
        'timerState.isRunning': true,
        'timerState.pausedAt': null,
        'timerState.lastUpdated': new Date()
      });
    } catch (error) {
      console.error('Error resuming timer in DB:', error);
    }
  };

  // Timer interval to update all rooms
  const timerInterval = setInterval(() => {
    examRooms.forEach((room, roomId) => {
      if (room.timerState && room.timerState.isRunning) {
        const remaining = calculateRemainingTime(room.timerState);
        room.timeLeft = remaining;
        
        // Broadcast update to all in room
        io.to(roomId).emit('exam-time-update', {
          roomId: roomId,
          timeLeft: remaining,
          isTimerRunning: true,
          timestamp: Date.now(),
          teacherName: 'System'
        });
        
        // ✅ ALSO BROADCAST SERVER TIMER UPDATE
        broadcastTimerUpdate(roomId.replace('exam-', ''), {
          timeLeft: remaining,
          isTimerRunning: true,
          roomId: roomId,
          action: 'auto-update'
        });
        
        // Auto-end if time is up
        if (remaining <= 0) {
          console.log(`⏰ Time expired for room ${roomId}`);
          io.to(roomId).emit('exam-ended', {
            roomId: roomId,
            message: 'Time is up!',
            examId: roomId.replace('exam-', '')
          });
          
          // Stop timer
          room.timerState.isRunning = false;
          room.isTimerRunning = false;
        }
      }
    });
  }, 1000); // Update every second

  // ✅ TIMER CONTROL HANDLERS
  socket.on('start-exam-timer', async (data) => {
    console.log('⏰ Starting persistent timer for exam:', {
      examId: data.examId,
      roomId: data.roomId,
      totalSeconds: data.totalSeconds
    });
    
    await startTimerForRoom(data.roomId, data.examId, data.totalSeconds);
    
    // Broadcast to all in room
    io.to(data.roomId).emit('exam-time-update', {
      roomId: data.roomId,
      timeLeft: data.totalSeconds,
      isTimerRunning: true,
      timestamp: Date.now(),
      teacherName: 'Teacher'
    });
    
    // ✅ ALSO BROADCAST SERVER TIMER UPDATE
    broadcastTimerUpdate(data.examId, {
      timeLeft: data.totalSeconds,
      isTimerRunning: true,
      roomId: data.roomId,
      action: 'started'
    });
  });

  socket.on('pause-exam-timer', async (data) => {
    console.log('⏸️ Pausing timer for exam:', data.examId);
    await pauseTimerForRoom(data.roomId, data.examId);
    
    // Broadcast pause state
    const room = examRooms.get(data.roomId);
    if (room) {
      io.to(data.roomId).emit('exam-time-update', {
        roomId: data.roomId,
        timeLeft: room.timeLeft,
        isTimerRunning: false,
        timestamp: Date.now(),
        teacherName: 'Teacher'
      });
      
      // ✅ ALSO BROADCAST SERVER TIMER UPDATE
      broadcastTimerUpdate(data.examId, {
        timeLeft: room.timeLeft,
        isTimerRunning: false,
        roomId: data.roomId,
        action: 'paused'
      });
    }
  });

  socket.on('resume-exam-timer', async (data) => {
    console.log('▶️ Resuming timer for exam:', data.examId);
    await resumeTimerForRoom(data.roomId, data.examId);
    
    // Broadcast resume state
    const room = examRooms.get(data.roomId);
    if (room) {
      io.to(data.roomId).emit('exam-time-update', {
        roomId: data.roomId,
        timeLeft: room.timeLeft,
        isTimerRunning: true,
        timestamp: Date.now(),
        teacherName: 'Teacher'
      });
      
      // ✅ ALSO BROADCAST SERVER TIMER UPDATE
      broadcastTimerUpdate(data.examId, {
        timeLeft: room.timeLeft,
        isTimerRunning: true,
        roomId: data.roomId,
        action: 'resumed'
      });
    }
  });

  socket.on('add-time-to-exam', async (data) => {
    console.log('➕ Adding time to exam:', {
      examId: data.examId,
      additionalSeconds: data.additionalSeconds
    });
    
    const room = examRooms.get(data.roomId);
    if (room && room.timerState) {
      const additionalSeconds = data.additionalSeconds || 300; // default 5 minutes
      
      if (room.timerState.isRunning) {
        // If running, add to remaining time
        room.timerState.remainingSeconds += additionalSeconds;
      } else {
        // If paused, add to total duration
        room.timerState.totalDuration += additionalSeconds;
        room.timerState.remainingSeconds += additionalSeconds;
      }
      
      room.timeLeft = room.timerState.remainingSeconds;
      room.timerState.lastUpdated = new Date();
      
      // Update database
      try {
        const Exam = require('./models/Exam');
        await Exam.findByIdAndUpdate(data.examId, {
          'timerState.remainingSeconds': room.timerState.remainingSeconds,
          'timerState.totalDuration': room.timerState.totalDuration,
          'timerState.lastUpdated': new Date()
        });
      } catch (error) {
        console.error('Error updating timer in DB:', error);
      }
      
      // Broadcast new time
      io.to(data.roomId).emit('exam-time-update', {
        roomId: data.roomId,
        timeLeft: room.timeLeft,
        isTimerRunning: room.isTimerRunning,
        timestamp: Date.now(),
        teacherName: 'Teacher',
        message: `Added ${Math.floor(additionalSeconds/60)} minutes`
      });
      
      // ✅ ALSO BROADCAST SERVER TIMER UPDATE
      broadcastTimerUpdate(data.examId, {
        timeLeft: room.timeLeft,
        isTimerRunning: room.isTimerRunning,
        roomId: data.roomId,
        action: 'time-added',
        additionalSeconds: additionalSeconds
      });
    }
  });

  // ✅ DAGDAG - STUDENT VIOLATION ALERTS (eto yung existing mo na tama)
  // REPLACE the existing student-violation handler with this:
  socket.on('student-violation', (data) => {
    console.log('🚨 Student violation detected:', data);
    
    const { studentSocketId, violationType, severity, examId } = data;
    
    // Get student info to get their actual student ID
    const studentInfo = connected_clients ? connected_clients[studentSocketId] : null;
    const studentId = studentInfo?.userId || studentSocketId;
    
    // Get current attempts from storage
    const currentAttempts = getStudentAttempts(studentId, examId);
    
    const newAttempts = currentAttempts.currentAttempts + 1;
    const attemptsLeft = Math.max(0, currentAttempts.maxAttempts - newAttempts);
    
    const updatedAttempts = {
      ...currentAttempts,
      currentAttempts: newAttempts,
      attemptsLeft: attemptsLeft,
      history: [
        ...currentAttempts.history,
        {
          timestamp: new Date().toISOString(),
          violationType: violationType,
          severity: severity,
          attemptsUsed: newAttempts,
          attemptsLeft: attemptsLeft
        }
      ].slice(-10)
    };
    
    // Save to persistent storage
    saveStudentAttempts(studentId, examId, updatedAttempts);
    
    // Broadcast to teacher
    io.to(`exam-${examId}`).emit('student-violation', {
      ...data,
      studentId: studentId,
      currentAttempts: newAttempts,
      attemptsLeft: attemptsLeft
    });
    
    // Auto-disconnect logic
    if (attemptsLeft <= 0) {
      console.log(`🔌 Auto-disconnecting student ${studentSocketId} - attempts exhausted`);
      socket.to(studentSocketId).emit('teacher-disconnect', {
        reason: 'Attempts exhausted',
        examId: examId
      });
    }
  });

  // Add this AFTER the student-violation handler
  socket.on('request-attempts-sync', (data) => {
    const { studentId, examId, studentSocketId } = data;
    
    console.log(`🔄 Student requesting attempts sync:`, { studentId, examId, studentSocketId });
    
    const attempts = getStudentAttempts(studentId, examId);
    
    // Send attempts back to student
    socket.emit('attempts-sync-response', {
      studentId: studentId,
      examId: examId,
      attempts: attempts
    });
    
    // Also update teacher
    if (examId) {
      socket.to(`exam-${examId}`).emit('student-attempts-update', {
        studentSocketId: studentSocketId,
        studentId: studentId,
        attempts: attempts
      });
    }
  });

  // ===== EXAM START/END HANDLERS =====
  socket.on('exam-started', (data) => {
    console.log('📢 Teacher started exam, broadcasting to room:', data.roomId);
    // Broadcast to all students in the room
    socket.to(data.roomId).emit('exam-started', data);
    
    // Also log who's in the room
    const room = examRooms.get(data.roomId);
    if (room) {
      console.log(`👥 Room ${data.roomId} has ${room.students.size} students`);
    }
  });

  // ✅ ADDED: Exam deployed event handler
  socket.on('exam-deployed', (data) => {
    console.log('📢 Teacher deployed exam, broadcasting to room:', data.roomId);
    // Broadcast to all students in the room
    socket.to(data.roomId).emit('exam-deployed', data);
    
    // Also log who's in the room
    const room = examRooms.get(data.roomId);
    if (room) {
      console.log(`👥 Room ${data.roomId} has ${room.students.size} students`);
    }
  });

  // ===== EXAM END HANDLER =====
  // ✅ ADD EXAM ENDED HANDLER
  socket.on('exam-ended', (data) => {
    console.log('🛑 Teacher ending exam:', data);
    
    const { roomId, examId } = data;
    
    // ✅ MARK EXAM AS ENDED
    endedExams.add(roomId);
    
    // ✅ BROADCAST TO ALL STUDENTS
    io.to(roomId).emit('exam-ended', {
      ...data,
      forcedExit: true
    });
    
    // ✅ DISCONNECT ALL STUDENTS
    const room = examRooms.get(roomId);
    if (room) {
      room.students.forEach((studentInfo, studentSocketId) => {
        const studentSocket = io.sockets.sockets.get(studentSocketId);
        if (studentSocket) {
          studentSocket.emit('force-exit-exam', {
            reason: 'Exam session has been ended by teacher',
            examId: examId,
            timestamp: new Date().toISOString()
          });
          
          // Kick student from room
          studentSocket.leave(roomId);
          console.log(`🔌 Kicked student ${studentSocketId} from room ${roomId}`);
        }
      });
      
      // Clear room data
      room.students.clear();
      room.examStarted = false;
      room.isTimerRunning = false;
    }
    
    console.log(`✅ Exam ${examId} marked as ended. Students cannot rejoin.`);
  });

  // ✅ ADD LIVE-CLASS-ENDED HANDLER
  socket.on('live-class-ended', (data) => {
    console.log('🛑 Live class ended by teacher:', data);
    
    const { examId, classId, endedAt } = data;
    const roomId = `exam-${examId}`;
    
    // Mark as ended
    endedExams.add(roomId);
    
    // Broadcast to all in class (not just exam room)
    if (classRooms.has(classId)) {
      io.to(`class-notifications-${classId}`).emit('live-class-ended', {
        examId: examId,
        classId: classId,
        endedAt: endedAt || new Date().toISOString(),
        message: 'Live class has ended'
      });
    }
    
    console.log(`✅ Live class ${examId} ended in class ${classId}`);
  });

  // ===== FORCE DISCONNECT HANDLER =====
  socket.on('force-disconnect-student', (data) => {
    console.log(`🔌 Teacher force-disconnecting student:`, data);
    
    const { studentSocketId, reason, examId } = data;
    
    const studentSocket = io.sockets.sockets.get(studentSocketId);
    if (studentSocket) {
      // Send forced exit message
      studentSocket.emit('force-exit-exam', {
        reason: reason,
        examId: examId,
        forced: true,
        timestamp: new Date().toISOString()
      });
      
      // Remove from room
      const roomId = `exam-${examId}`;
      studentSocket.leave(roomId);
      
      // Update room state
      if (examRooms.has(roomId)) {
        const room = examRooms.get(roomId);
        room.students.delete(studentSocketId);
      }
      
      console.log(`✅ Force-disconnected student ${studentSocketId}`);
    }
  });

  // ===== EXAM STATUS CHECK =====
  socket.on('check-exam-status', (data) => {
    const { examId, studentId } = data;
    const roomId = `exam-${examId}`;
    
    const status = {
      examId: examId,
      roomId: roomId,
      isActive: examRooms.has(roomId) && examRooms.get(roomId).examStarted,
      isEnded: isExamEnded(examId) || endedExams.has(roomId),
      canJoin: false,
      message: ''
    };
    
    if (status.isEnded) {
      status.message = 'This exam session has ended.';
      status.canJoin = false;
    } else if (status.isActive) {
      status.message = 'Exam is active. You can join.';
      status.canJoin = true;
    } else {
      status.message = 'Exam has not started yet.';
      status.canJoin = false;
    }
    
    socket.emit('exam-status-response', status);
    console.log(`📊 Exam status for ${examId}:`, status);
  });

  // Handle teacher manually disconnecting students
  socket.on('disconnect-student', (data) => {
    console.log(`🔌 Teacher disconnecting student: ${data.studentSocketId} - Reason: ${data.reason}`);
    
    // Send disconnect command to student
    socket.to(data.studentSocketId).emit('teacher-disconnect', {
      reason: data.reason,
      examId: data.examId
    });
    
    // Remove student from room
    const room = examRooms.get(`exam-${data.examId}`);
    if (room && room.students.has(data.studentSocketId)) {
      room.students.delete(data.studentSocketId);
    }
  });

  // Broadcast timer updates to all students in room
  // In server.js, fix the exam-time-update handler:
  socket.on('exam-time-update', (data) => {
    // ✅ ENSURE WE ALWAYS SEND SECONDS
    let timeToSend = data.timeLeft;
    
    // If teacher sent minutes (value < 100), convert to seconds
    if (timeToSend < 100 && timeToSend > 0) {
      timeToSend = timeToSend * 60;
      console.log(`🔄 Converted teacher time from ${data.timeLeft}min to ${timeToSend}sec`);
    }
    
    // Broadcast with proper seconds
    io.to(data.roomId).emit('exam-time-update', {
      ...data,
      timeLeft: timeToSend, // Always send as seconds
      unit: 'seconds' // Add unit clarification
    });
  });

  // Add this utility function to server.js
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

  // ===== DETECTION SETTINGS HANDLER =====
  socket.on('update-detection-settings', (data) => {
    console.log('🎯 Teacher updating detection settings for student:', data.studentSocketId);
    
    // Send to specific student
    socket.to(data.studentSocketId).emit('detection-settings-update', {
      settings: data.settings,
      customMessage: data.customMessage,
      examId: data.examId
    });
    
    console.log(`Settings updated for student ${data.studentSocketId}:`, data.settings);
  });

  // Join exam room
  socket.on("join-exam-room", ({ roomId, userName, userId, userRole }) => {
    try {
      // ✅ CHECK IF EXAM HAS ENDED
      if (isExamEnded(roomId.replace('exam-', '')) || endedExams.has(roomId)) {
        console.log(`❌ Blocked ${userName} from joining ended exam: ${roomId}`);
        socket.emit('exam-unavailable', {
          message: 'This exam session has ended',
          examId: roomId.replace('exam-', ''),
          endedAt: new Date().toISOString()
        });
        return;
      }
      
      currentRoom = roomId;
      socket.join(roomId);
      
      // Store user role for chat
      socket.userRole = userRole;
      
      // Initialize room if not exists
      if (!examRooms.has(roomId)) {
        examRooms.set(roomId, {
          teacher: null,
          students: new Map(),
          timeLeft: 3600, // Default 1 hour
          isTimerRunning: false,
          examStarted: false,
          // ✅ ADD PERSISTENT TIMER STATE
          timerState: {
            remainingSeconds: 0,
            totalDuration: 0,
            isRunning: false,
            startedAt: null,
            lastUpdated: new Date(),
            pausedAt: null
          }
        });
      }
      
      const room = examRooms.get(roomId);
      
      if (userRole === 'teacher') {
        room.teacher = socket.id;
        console.log(`👨‍🏫 Teacher ${userName} joined room ${roomId}`);
        
        // Send current time to all students when teacher joins
        setTimeout(() => {
          socket.to(roomId).emit('exam-time-update', {
            timeLeft: 10, // Default 1 hour
            isTimerRunning: false,
            roomId: roomId,
            timestamp: Date.now(),
            teacherName: userName
          });
        }, 1000);
        
      } else if (userRole === 'student') {
        room.students.set(socket.id, {
          studentId: userId || socket.userId,
          studentName: userName || socket.userName,
          socketId: socket.id,
          joinedAt: new Date(),
          cameraEnabled: false
        });
        console.log(`👨‍🎓 Student ${userName} joined room ${roomId}`);
        
        // ✅ IMMEDIATELY SEND CURRENT TIMER TO NEW STUDENT
        setTimeout(() => {
          socket.emit('send-current-time', {
            studentSocketId: socket.id,
            timeLeft: room.timeLeft || 3600,
            isTimerRunning: room.isTimerRunning || false,
            examStarted: room.examStarted || false,
            roomId: roomId
          });
          
          console.log(`🕒 Sent timer to new student ${socket.id}:`, {
            time: room.timeLeft,
            running: room.isTimerRunning
          });
        }, 500);
        
        // Request current time from teacher
        setTimeout(() => {
          if (room.teacher) {
            socket.emit('student-time-request', {
              studentSocketId: socket.id,
              roomId: roomId
            });
          }
        }, 1500);
        
        // Notify teacher about student joining
        if (room.teacher) {
          socket.to(room.teacher).emit("student-joined", {
            studentId: userId || socket.userId,
            studentName: userName || socket.userName,
            socketId: socket.id,
            joinedAt: new Date()
          });
        }
      }

      // Send current room state to the new user
      const participants = {
        teacher: room.teacher,
        students: Array.from(room.students.values())
      };
      socket.emit("room-participants", participants);

    } catch (error) {
      console.error('❌ Error joining room:', error);
      socket.emit("room-join-error", { message: "Failed to join room" });
    }
  });

  // Add a function to clear timer cache
  const clearAllTimerCache = () => {
    // Clear localStorage
    localStorage.removeItem(`timer-${examId}`);
    
    // Clear state
    setTimeLeft(null);
    setIsTimerRunning(false);
    
    // Request fresh timer from teacher
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('student-time-request', {
        studentSocketId: socketRef.current.id,
        roomId: `exam-${examId}`,
        examId: examId,
        forceRefresh: true
      });
    }
    
    console.log('🧹 Timer cache cleared, requesting fresh timer from teacher');
  };

  // Sa server.js, idagdag ito sa socket handlers
  socket.on('student-timer-sync', (data) => {
    console.log('🔄 Student timer sync:', {
      student: data.studentSocketId,
      timeLeft: data.timeLeft,
      isRunning: data.isTimerRunning,
      examId: data.examId
    });
    
    // Store in room for persistence
    const roomId = data.roomId || `exam-${data.examId}`;
    if (examRooms.has(roomId)) {
      const room = examRooms.get(roomId);
      if (room.students.has(data.studentSocketId)) {
        const student = room.students.get(data.studentSocketId);
        student.timerState = {
          timeLeft: data.timeLeft,
          isRunning: data.isTimerRunning,
          lastUpdated: new Date()
        };
        console.log(`💾 Timer saved for student ${data.studentSocketId}:`, student.timerState);
      }
    }
  });

  // Add in socket.io connection handler
  socket.on('force-timer-sync', (data) => {
    console.log('🔄 Force timer sync requested:', data);
    
    // Update room state
    if (examRooms.has(data.roomId)) {
      const room = examRooms.get(data.roomId);
      room.timeLeft = data.timeLeft;
      room.isTimerRunning = data.isTimerRunning;
    }
    
    // Broadcast to all students with priority
    io.to(data.roomId).emit('exam-time-update', {
      roomId: data.roomId,
      timeLeft: data.timeLeft,
      isTimerRunning: data.isTimerRunning,
      timestamp: Date.now(),
      teacherName: 'Teacher',
      priority: 'high',
      forceUpdate: true
    });
  });

  socket.on('clear-student-timers', (data) => {
    io.to(data.roomId).emit('clear-timer-cache', {
      examId: data.examId
    });
  });

  // ✅ FIXED: Request student camera (teacher to student)
  socket.on("request-student-camera", ({ studentSocketId, roomId }) => {
    const requestKey = `${studentSocketId}-${roomId}`;
    
    if (pendingCameraRequests.has(requestKey)) {
      console.log('⚠️ Duplicate camera request blocked:', requestKey);
      return;
    }
    
    pendingCameraRequests.add(requestKey);
    console.log('📹 Teacher requesting camera from student:', studentSocketId);
    
    socket.to(studentSocketId).emit("camera-request", {
      from: socket.id,
      roomId
    });
    
    // Remove from pending after 10 seconds
    setTimeout(() => {
      pendingCameraRequests.delete(requestKey);
    }, 10000);
  });

  // WebRTC Signaling Events
  socket.on("webrtc-offer", (data) => {
    console.log('📹 Forwarding WebRTC offer to:', data.target);
    socket.to(data.target).emit("webrtc-offer", {
      offer: data.offer,
      from: socket.id,
      userInfo: {
        userId: socket.userId,
        name: socket.userName
      }
    });
  });

  socket.on("webrtc-answer", (data) => {
    console.log('📹 Forwarding WebRTC answer to:', data.target);
    socket.to(data.target).emit("webrtc-answer", {
      answer: data.answer,
      from: socket.id
    });
  });

  socket.on("ice-candidate", (data) => {
    console.log('🧊 Forwarding ICE candidate to:', data.target);
    socket.to(data.target).emit("ice-candidate", {
      candidate: data.candidate,
      from: socket.id
    });
  });

  // Student camera response
  socket.on("camera-response", (data) => {
    console.log('📹 Student camera response from:', socket.id, 'Enabled:', data.enabled);
    socket.to(data.teacherSocketId).emit("camera-response", {
      enabled: data.enabled,
      socketId: socket.id,
      studentId: socket.userId,
      studentName: socket.userName
    });

    // Update room state
    if (currentRoom && examRooms.has(currentRoom)) {
      const room = examRooms.get(currentRoom);
      if (room.students.has(socket.id)) {
        room.students.get(socket.id).cameraEnabled = data.enabled;
      }
    }
  });

  // Get room participants
  socket.on("get-room-participants", (roomId) => {
    if (examRooms.has(roomId)) {
      const room = examRooms.get(roomId);
      socket.emit("room-participants", {
        teacher: room.teacher,
        students: Array.from(room.students.values())
      });
    }
  });

  // Disconnect
  socket.on("disconnect", (reason) => {
    console.log(`🔌 Socket disconnected: ${socket.id} - Reason: ${reason}`);
    
    // Leave all comment rooms
    const rooms = Array.from(socket.rooms);
    rooms.forEach(room => {
      if (room.startsWith('quiz-comments-')) {
        console.log(`📝 User automatically left comment room: ${room}`);
      }
      if (room.startsWith('class-notifications-')) {
        const classId = room.replace('class-notifications-', '');
        if (classRooms.has(classId)) {
          const classRoom = classRooms.get(classId);
          if (socket.userRole === 'student') {
            classRoom.students.delete(socket.userId);
          } else if (socket.userRole === 'teacher') {
            classRoom.teachers.delete(socket.userId);
          }
          console.log(`📢 User ${socket.userName} removed from class ${classId} tracking`);
        }
      }
    });
    
    if (currentRoom && examRooms.has(currentRoom)) {
      const room = examRooms.get(currentRoom);
      
      // Remove from room
      if (room.teacher === socket.id) {
        room.teacher = null;
        console.log(`👨‍🏫 Teacher left room ${currentRoom}`);
        // Notify all students that teacher left
        socket.to(currentRoom).emit("teacher-left");
      } else if (room.students.has(socket.id)) {
        const studentInfo = room.students.get(socket.id);
        room.students.delete(socket.id);
        console.log(`👨‍🎓 Student ${studentInfo.studentName} left room ${currentRoom}`);
        
        // Notify teacher that student left
        if (room.teacher) {
          socket.to(room.teacher).emit("student-left", {
            socketId: socket.id,
            studentId: studentInfo.studentId
          });
        }
      }

      // Clean up empty rooms
      if (!room.teacher && room.students.size === 0) {
        examRooms.delete(currentRoom);
        console.log(`🗑️ Room ${currentRoom} cleaned up`);
      }
    }
  });

  // Connection error handling
  socket.on("connect_error", (error) => {
    console.error('❌ Socket connection error:', error);
  });

  socket.on("error", (error) => {
    console.error('❌ Socket error:', error);
  });
});

// ===== EXPORT COMMENT FUNCTIONS FOR USE IN ROUTES =====
module.exports = {
  app,
  io,
  endedExams, // ✅ Export for use in routes
  examRooms,
  classRooms, // ✅ Export class rooms for pending exams
  pendingExamsTracker, // ✅ Export for use in routes
  broadcastNewComment,
  broadcastDeletedComment,
  isExamEnded, // ✅ Export the helper function
  requestServerTime, // ✅ Export server time function
  broadcastTimerUpdate // ✅ Export timer update function
};

// ===== START SERVER =====
const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("✅ MongoDB connected");

    // ✅ FIXED: Changed from 3001 to 3000
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log(`✅ Server running at http://localhost:${PORT}`);
      console.log(`✅ Socket.IO: ENABLED with room management`);
      console.log(`✅ REAL-TIME COMMENTS: ENABLED for quizzes`);
      console.log(`✅ PENDING EXAMS SYSTEM: ENABLED with real-time notifications`);
      console.log(`✅ TIMER SYNC: Enabled for exam sessions`);
      console.log(`✅ DETECTION SETTINGS: Enabled for individual student control`);
      console.log(`✅ DEBUG: Routes available at /api/debug-routes`);
      console.log(`✅ CLASS NOTIFICATIONS: Enabled for pending exams tracking`);
      console.log(`✅ SERVER TIMER UPDATES: ENABLED for real-time synchronization`);
    });
  } catch (err) {
    console.error("❌ Server startup error:", err);
    process.exit(1);
  }
};

// Function to cleanup old ended exams (run periodically)
const cleanupEndedExams = () => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  
  // Remove old ended exams from memory (optional - for memory management)
  endedExams.forEach((timestamp, examId) => {
    if (timestamp < oneHourAgo) {
      endedExams.delete(examId);
      console.log(`🧹 Cleaned up old ended exam: ${examId}`);
    }
  });
  
  // Also clean up examRooms for ended exams
  examRooms.forEach((room, roomId) => {
    if (endedExams.has(roomId) && room.students.size === 0) {
      examRooms.delete(roomId);
      console.log(`🧹 Cleaned up empty ended exam room: ${roomId}`);
    }
  });
  
  // Clean up old class room tracking
  classRooms.forEach((room, classId) => {
    const now = new Date();
    let removedStudents = 0;
    
    // Remove inactive students (not active for 24 hours)
    room.students.forEach((student, studentId) => {
      if (now - student.lastActive > 24 * 60 * 60 * 1000) {
        room.students.delete(studentId);
        removedStudents++;
      }
    });
    
    if (removedStudents > 0) {
      console.log(`🧹 Cleaned up ${removedStudents} inactive students from class ${classId}`);
    }
  });
};

// Run cleanup every hour
setInterval(cleanupEndedExams, 60 * 60 * 1000);

startServer();