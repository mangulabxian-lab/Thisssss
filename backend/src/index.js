// server.js - COMPLETELY FIXED VERSION (CHAT REMOVED) WITH COMMENT SUPPORT
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const path = require("path");
const jwt = require("jsonwebtoken");

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
    // CHAT STATUS REMOVED
    // THEME STATUS REMOVED
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

  // ===== REAL-TIME COMMENT HANDLERS =====
  socket.on('join-quiz-comments', ({ quizId }) => {
    const roomName = `quiz-comments-${quizId}`;
    socket.join(roomName);
    console.log(`📝 User ${socket.userName} joined quiz comments room: ${roomName}`);
  });

  socket.on('leave-quiz-comments', ({ quizId }) => {
    const roomName = `quiz-comments-${quizId}`;
    socket.leave(roomName);
    console.log(`📝 User ${socket.userName} left quiz comments room: ${roomName}`);
  });

  // ALL CHAT HANDLERS COMPLETELY REMOVED

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

// ✅ DAGDAG - STUDENT VIOLATION ALERTS
socket.on('student-violation', (data) => {
  console.log('⚠️ Student violation:', data);
  if (data.examId) {
    io.to(`exam-${data.examId}`).emit('student-violation', data);
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
          students: new Map()
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
    
    // Leave all comment rooms
    const rooms = Array.from(socket.rooms);
    rooms.forEach(room => {
      if (room.startsWith('quiz-comments-')) {
        console.log(`📝 User automatically left comment room: ${room}`);
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
  broadcastNewComment,
  broadcastDeletedComment
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
      console.log(`✅ CHAT SYSTEM: DISABLED (removed)`);
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