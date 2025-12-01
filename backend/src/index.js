// server.js - COMPLETELY FIXED VERSION WITH CHAT FORUM (THEME REMOVED)
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const path = require("path");
const jwt = require("jsonwebtoken");
const ChatMessage = require("./models/ChatMessage"); // ✅ ADD CHAT MESSAGE MODEL
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
app.use("/api/chat", require("./routes/chatRoutes")); // ✅ ADD CHAT ROUTES
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
    chat: "ENABLED",
    // THEME STATUS REMOVED
    timestamp: new Date().toISOString()
  });
});

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

io.on("connection", (socket) => {
  console.log("✅ Socket connected:", socket.id, "User:", socket.userName, "Role:", socket.userRole);

  let currentRoom = null;
  


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


  // ===== CLASS CHAT HANDLERS =====
  socket.on("join-class-chat", async ({ classId }) => {
    try {
      socket.join(`class-chat-${classId}`);
      console.log(`💬 User ${socket.userName} joined class chat: ${classId}`);
      
      // Send chat history to the user
      const messages = await ChatMessage.find({ 
        classId, 
        isDeleted: false 
      })
      .populate("userId", "name email")
      .sort({ createdAt: 1 })
      .limit(50)
      .lean();

      const formattedMessages = messages.map(msg => ({
        _id: msg._id,
        classId: msg.classId,
        userId: {
          _id: msg.userId._id,
          name: msg.userId.name,
          email: msg.userId.email
        },
        userName: msg.userName || msg.userId.name,
        userRole: msg.userRole,
        message: msg.message,
        replies: msg.replies || [],
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt
      }));

      socket.emit("chat-history", formattedMessages);
      
    } catch (error) {
      console.error('❌ Error joining class chat:', error);
    }
  });


  // ✅ ADDED: Main class chat message handler
  socket.on("send-chat-message", async (data) => {
    try {
      const { classId, message } = data;
      
      if (!message || !message.trim()) {
        return;
      }

      // Save to database
      const chatMessage = new ChatMessage({
        classId,
        userId: socket.userId,
        userName: socket.userName,
        userRole: socket.userRole,
        message: message.trim()
      });

      await chatMessage.save();
      
      // Populate user data for response
      await chatMessage.populate("userId", "name email");

      // Broadcast to all users in the class chat room
      const messageData = {
        _id: chatMessage._id,
        classId: chatMessage.classId,
        userId: {
          _id: chatMessage.userId._id,
          name: chatMessage.userId.name,
          email: chatMessage.userId.email
        },
        userName: chatMessage.userName,
        userRole: chatMessage.userRole,
        message: chatMessage.message,
        replies: chatMessage.replies || [],
        createdAt: chatMessage.createdAt,
        updatedAt: chatMessage.updatedAt
      };

      io.to(`class-chat-${classId}`).emit("new-chat-message", messageData);
      
      console.log(`💬 New chat message in class ${classId} from ${socket.userName}`);

    } catch (error) {
      console.error('❌ Error sending chat message:', error);
      socket.emit("chat-error", { message: "Failed to send message" });
    }
  });


  
  // ✅ ADD THIS NEW HANDLER FOR EXAM CHAT (after the class chat handlers)
  socket.on("send-exam-chat-message", async (data) => {
    try {
      console.log('💬 Received exam chat message:', data);
      
      const { roomId, message } = data;
      
      // ✅ SAFELY EXTRACT MESSAGE TEXT
      let messageText;
      if (typeof message === 'object' && message.text) {
        messageText = message.text;
      } else if (typeof message === 'string') {
        messageText = message;
      } else {
        console.error('❌ Invalid message format in exam chat:', message);
        return;
      }
      
      if (!messageText || !messageText.trim()) {
        return;
      }

      const messageData = {
        id: message.id || Date.now().toString(),
        text: messageText.trim(),
        sender: message.sender || socket.userRole,
        senderName: message.senderName || socket.userName,
        timestamp: message.timestamp || new Date(),
        type: message.type || socket.userRole
      };

      // ✅ BROADCAST TO EXAM ROOM
      io.to(roomId).emit("chat-message", {
        message: messageData,
        userName: socket.userName,
        userRole: socket.userRole
      });

      console.log(`💬 Exam chat broadcast to ${roomId}:`, messageData);

    } catch (error) {
      console.error('❌ Error in exam chat:', error);
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

// ✅ DAGDAG - STUDENT VIOLATION ALERTS (eto yung existing mo na tama)
// REPLACE the existing student-violation handler with this:
socket.on('student-violation', (data) => {
  console.log('🚨 Student violation detected:', data);
  
  const { studentSocketId, violationType, severity, examId } = data;
  
  // Get student info to get their actual student ID
  const studentInfo = connected_clients[studentSocketId];
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

  socket.on("delete-chat-message", async (data) => {
    try {
      const { messageId, classId } = data;
      
      // Find and soft delete the message
      const message = await ChatMessage.findById(messageId);
      if (message) {
        // Check if user has permission to delete (owner or teacher)
        if (message.userId.toString() === socket.userId || socket.userRole === 'teacher') {
          message.isDeleted = true;
          message.deletedAt = new Date();
          await message.save();

          // Broadcast deletion to all users in the class chat room
          io.to(`class-chat-${classId}`).emit("message-deleted", { messageId });
          
          console.log(`🗑️ Message ${messageId} deleted by ${socket.userName}`);
        } else {
          socket.emit("chat-error", { message: "Not authorized to delete this message" });
        }
      }
    } catch (error) {
      console.error('❌ Error deleting chat message:', error);
      socket.emit("chat-error", { message: "Failed to delete message" });
    }
  });

  socket.on("add-chat-reply", async (data) => {
    try {
      const { messageId, classId, replyMessage } = data;
      
      if (!replyMessage || !replyMessage.trim()) {
        socket.emit("chat-error", { message: "Reply cannot be empty" });
        return;
      }

      const parentMessage = await ChatMessage.findById(messageId);
      
      if (!parentMessage) {
        socket.emit("chat-error", { message: "Message not found" });
        return;
      }

      const replyData = {
        userId: socket.userId,
        userName: socket.userName,
        userRole: socket.userRole,
        message: replyMessage.trim(),
        createdAt: new Date()
      };

      parentMessage.replies.push(replyData);
      await parentMessage.save();

      // Broadcast new reply to all users in the class chat room
      io.to(`class-chat-${classId}`).emit("reply-added", {
        messageId,
        reply: replyData
      });

      console.log(`💬 Reply added to message ${messageId} by ${socket.userName}`);
    } catch (error) {
      console.error('❌ Error adding chat reply:', error);
      socket.emit("chat-error", { message: "Failed to add reply" });
    }
  });

  // Handle typing indicators
  socket.on("typing-start", (data) => {
    socket.to(`class-chat-${data.classId}`).emit("user-typing", {
      userName: socket.userName,
      isTyping: true
    });
  });

  socket.on("typing-stop", (data) => {
    socket.to(`class-chat-${data.classId}`).emit("user-typing", {
      userName: socket.userName,
      isTyping: false
    });
  });

  // Leave class chat
  socket.on("leave-class-chat", ({ classId }) => {
    socket.leave(`class-chat-${classId}`);
    console.log(`💬 User ${socket.userName} left class chat: ${classId}`);
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

  socket.on('exam-ended', (data) => {
    console.log('🛑 Teacher ended exam, broadcasting to room:', data.roomId);
    // Broadcast to all students in the room
    socket.to(data.roomId).emit('exam-ended', data);
    
    // Disconnect all students in the room
    if (examRooms.has(data.roomId)) {
      const room = examRooms.get(data.roomId);
      room.students.forEach((studentInfo, studentSocketId) => {
        socket.to(studentSocketId).emit('teacher-disconnect', {
          reason: data.message || 'Exam ended by teacher',
          examId: data.examId
        });
      });
      // Clear the room
      room.students.clear();
    }
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
  socket.on('exam-time-update', (data) => {
  console.log('🕒 Broadcasting timer update to room:', {
    roomId: data.roomId,
    timeLeft: data.timeLeft,
    isTimerRunning: data.isTimerRunning,
    formatted: formatTime(data.timeLeft)
  });
  
  // ✅ BROADCAST TO ALL STUDENTS IN ROOM (REAL-TIME)
  socket.to(data.roomId).emit('exam-time-update', data);
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
      examStarted: false
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
      console.log(`✅ CHAT SYSTEM: ENABLED with real-time messaging`);
      console.log(`✅ CORS: Enabled for ${process.env.FRONTEND_URL || "http://localhost:5173"}`);
      console.log(`✅ TIMER SYNC: Enabled for exam sessions`);
      console.log(`✅ DETECTION SETTINGS: Enabled for individual student control`);
      console.log(`✅ DEBUG: Routes available at /api/debug-routes`);
    });
  } catch (err) {
    console.error("❌ Server startup error:", err);
    process.exit(1);
  }
};

startServer();