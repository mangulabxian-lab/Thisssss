// routes/examRoutes.js - FIXED VERSION
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const Exam = require("../models/Exam");
const Class = require("../models/Class");
const auth = require("../middleware/authMiddleware");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const axios = require('axios');

// ===== INITIALIZE ROUTER FIRST =====
const router = express.Router();

// ===== APPLY AUTH MIDDLEWARE TO ALL ROUTES =====
router.use(auth);

// ✅ REMOVED DUPLICATE DEBUG MIDDLEWARE - CAUSING DOUBLE REQUESTS

// ===== MULTER SETUP =====
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1E9) + "-" + file.originalname;
    cb(null, uniqueName);
  },
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.docx', '.doc', '.txt'];
    const fileExt = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(fileExt)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type. Allowed types: ${allowedTypes.join(', ')}`), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024,
  }
});

// ===== QUIZ COMMENT ROUTES =====

// ✅ GET comments for a specific quiz/exam
router.get("/:examId/comments", async (req, res) => {
  try {
    const { examId } = req.params;
    
    console.log("🎯 GET QUIZ COMMENTS ROUTE HIT:", examId);

    const exam = await Exam.findById(examId)
      .populate("comments.author", "name email profileImage role")
      .select("comments");
    
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found"
      });
    }
    
    // Check if user has access to this exam
    const classData = await Class.findById(exam.classId);
    const hasAccess = classData && (
      classData.ownerId.toString() === req.user.id ||
      classData.members.some(m => m.userId && m.userId.toString() === req.user.id)
    );

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this quiz"
      });
    }
    
    // Sort comments by creation date (newest first)
    const sortedComments = exam.comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({
      success: true,
      data: sortedComments
    });
  } catch (err) {
    console.error("❌ Get quiz comments error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch comments"
    });
  }
});

// ✅ ADD comment to quiz/exam
router.post("/:examId/comments", async (req, res) => {
  try {
    const { examId } = req.params;
    const { content } = req.body;
    
    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: "Comment content is required"
      });
    }
    
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found"
      });
    }
    
    // Check if user has access to this exam
    const classData = await Class.findById(exam.classId);
    const hasAccess = classData && (
      classData.ownerId.toString() === req.user.id ||
      classData.members.some(m => m.userId && m.userId.toString() === req.user.id)
    );

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to comment on this quiz"
      });
    }
    
    const newComment = {
      content: content.trim(),
      author: req.user.id,
      role: req.user.role || "student",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    exam.comments.push(newComment);
    await exam.save();
    
    // Populate author info for response
    await exam.populate("comments.author", "name email profileImage role");
    
    const addedComment = exam.comments[exam.comments.length - 1];
    
    res.json({
      success: true,
      message: "Comment added successfully",
      data: addedComment
    });
  } catch (err) {
    console.error("❌ Add comment error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to add comment"
    });
  }
});

// ✅ DELETE comment from quiz/exam
router.delete("/:examId/comments/:commentId", async (req, res) => {
  try {
    const { examId, commentId } = req.params;
    
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found"
      });
    }
    
    const comment = exam.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found"
      });
    }
    
    // Check if user is authorized to delete (author or teacher)
    const isAuthor = comment.author.toString() === req.user.id;
    const isTeacher = req.user.role === "teacher";
    
    if (!isAuthor && !isTeacher) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this comment"
      });
    }
    
    exam.comments.pull(commentId);
    await exam.save();
    
    res.json({
      success: true,
      message: "Comment deleted successfully"
    });
  } catch (err) {
    console.error("❌ Delete comment error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete comment"
    });
  }
});

// ✅ TEST COMMENTS ENDPOINT
router.get("/test-comments/:examId", async (req, res) => {
  try {
    const { examId } = req.params;
    
    console.log("🧪 TESTING COMMENTS ENDPOINT FOR EXAM:", examId);
    
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }
    
    res.json({
      success: true,
      message: "Comments endpoint is working!",
      examId: examId,
      hasCommentsField: exam.comments !== undefined,
      commentsCount: exam.comments ? exam.comments.length : 0,
      user: req.user
    });
    
  } catch (err) {
    console.error("❌ Test comments error:", err);
    res.status(500).json({
      success: false,
      message: "Test failed",
      error: err.message
    });
  }
});

// ===== TEST ROUTE =====
router.get("/test-session-routes", async (req, res) => {
  console.log("✅ TEST ROUTE HIT - Session routes are working");
  res.json({
    success: true,
    message: "Session routes are working correctly",
    user: req.user,
    availableRoutes: [
      "POST /api/exams/:examId/start-session",
      "POST /api/exams/:examId/end-session", 
      "POST /api/exams/:examId/join",
      "GET /api/exams/:examId/session-status"
    ],
    timestamp: new Date().toISOString()
  });
});

// ===== EXAM SESSION ROUTES =====

// ✅ DEBUG ENDPOINT
router.get("/debug/token-check", (req, res) => {
  console.log("✅ Token is valid for user:", req.user);
  res.json({
    success: true,
    message: "Token is valid",
    user: req.user
  });
});

// ✅ GET EXAM DETAILS
router.get("/:examId/details", async (req, res) => {
  try {
    const { examId } = req.params;
    
    console.log("🎯 GET EXAM DETAILS ROUTE HIT:", examId);
    console.log("🔍 User ID:", req.user.id);

    // Validate examId
    if (!mongoose.Types.ObjectId.isValid(examId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid exam ID format"
      });
    }

    const exam = await Exam.findById(examId).populate('classId');
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    // Check if user has access to this exam
    const classData = await Class.findById(exam.classId);
    const hasAccess = classData && (
      classData.ownerId.toString() === req.user.id ||
      classData.members.some(m => m.userId && m.userId.toString() === req.user.id)
    );

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this exam"
      });
    }

    console.log("✅ Exam details loaded for teacher session:", exam.title);

    res.json({
      success: true,
      data: exam
    });

  } catch (err) {
    console.error("❌ Get exam details error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load exam details"
    });
  }
});

// ✅ START EXAM SESSION
router.post("/:examId/start-session", async (req, res) => {
  try {
    const { examId } = req.params;
    
    console.log("🎯 START EXAM SESSION ROUTE HIT:", examId);
    console.log("🔍 User ID:", req.user.id);

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    // Check if user is teacher for this class
    const classData = await Class.findById(exam.classId);
    if (!classData || classData.ownerId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Only teachers can start exam sessions"
      });
    }

    // Update exam to active
    const updatedExam = await Exam.findByIdAndUpdate(
      examId,
      { 
        isActive: true,
        isDeployed: true,
        isPublished: true,
        startedAt: new Date(),
        updatedAt: new Date()
      },
      { new: true }
    );

    console.log("✅ Exam session started:", examId);

    res.json({
      success: true,
      message: "Exam session started successfully",
      data: updatedExam
    });

  } catch (err) {
    console.error("❌ Start exam session error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to start exam session"
    });
  }
});

// ✅ END EXAM SESSION
router.post("/:examId/end-session", async (req, res) => {
  try {
    const { examId } = req.params;
    
    console.log("🎯 END EXAM SESSION ROUTE HIT:", examId);
    console.log("🔍 User ID:", req.user.id); 

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    // Check if user is teacher for this class
    const classData = await Class.findById(exam.classId);
    if (!classData || classData.ownerId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Only teachers can end exam sessions"
      });
    }

    // Update exam to inactive and clear joined students
    const updatedExam = await Exam.findByIdAndUpdate(
      examId,
      { 
        isActive: false,
        endedAt: new Date(),
        joinedStudents: [], // Clear joined students
        updatedAt: new Date()
      },
      { new: true }
    );

    console.log("✅ Exam session ended:", examId);

    res.json({
      success: true,
      message: "Exam session ended successfully",
      data: updatedExam
    });

  } catch (err) {
    console.error("❌ End exam session error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to end exam session"
    });
  }
});

// ✅ STUDENT JOIN EXAM SESSION
router.post("/:examId/join", async (req, res) => {
  try {
    const { examId } = req.params;
    const studentId = req.user.id;
    
    console.log("🎯 STUDENT JOINING EXAM:", examId, "Student:", studentId);
    
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }
    
    // Check if user is student in this class
    const classData = await Class.findById(exam.classId);
    const isStudent = classData.members.some(member => 
      member.userId && member.userId.toString() === studentId
    );
    
    if (!isStudent) {
      return res.status(403).json({
        success: false,
        message: "Only students in this class can join the exam"
      });
    }
    
    // Check if exam session is active
    if (!exam.isActive) {
      return res.status(403).json({
        success: false,
        message: "Exam session is not active"
      });
    }
    
    // Check if student already joined
    const alreadyJoined = exam.joinedStudents.some(js => 
      js.studentId.toString() === studentId
    );
    
    if (!alreadyJoined) {
      // Add student to joined students
      exam.joinedStudents.push({
        studentId: studentId,
        joinedAt: new Date(),
        status: "connected",
        cameraEnabled: true,
        microphoneEnabled: true
      });
      
      await exam.save();
    }
    
    console.log("✅ Student joined exam session:", studentId);
    
    res.json({
      success: true,
      message: "Joined exam session successfully",
      data: {
        exam: {
          _id: exam._id,
          title: exam.title,
          timeLimit: exam.timeLimit || 60
        },
        requiresCamera: true,
        isExamSession: true
      }
    });
    
  } catch (err) {
    console.error("❌ Join exam session error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to join exam session"
    });
  }
});

// ✅ GET EXAM SESSION STATUS
router.get("/:examId/session-status", async (req, res) => {
  try {
    const { examId } = req.params;
    
    console.log("🎯 EXAM SESSION STATUS ROUTE HIT:", examId);

    const exam = await Exam.findById(examId).populate('classId');
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    // Check if user has access to this exam
    const classData = await Class.findById(exam.classId);
    const hasAccess = classData && (
      classData.ownerId.toString() === req.user.id ||
      classData.members.some(m => m.userId && m.userId.toString() === req.user.id)
    );

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this exam session"
      });
    }

    console.log("✅ Exam session status loaded:", examId, "Active:", exam.isActive);

    res.json({
      success: true,
      data: {
        exam: {
          _id: exam._id,
          title: exam.title,
          isActive: exam.isActive || false,
          isDeployed: exam.isDeployed,
          startedAt: exam.startedAt,
          timeLimit: exam.timeLimit || 60
        },
        isActive: exam.isActive || false,
        timeLeft: exam.timeLimit ? exam.timeLimit * 60 : 3600
      }
    });

  } catch (err) {
    console.error("❌ Exam session status error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to get exam session status",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ✅ GET JOINED STUDENTS
router.get("/:examId/joined-students", async (req, res) => {
  try {
    const { examId } = req.params;
    
    const exam = await Exam.findById(examId)
      .populate('joinedStudents.studentId', 'name email')
      .populate('classId', 'name');
    
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }
    
    // Check if user is teacher for this class
    const classData = await Class.findById(exam.classId);
    const isTeacher = classData.ownerId.toString() === req.user.id;
    
    if (!isTeacher) {
      return res.status(403).json({
        success: false,
        message: "Only teachers can view joined students"
      });
    }
    
    res.json({
      success: true,
      data: {
        exam: {
          _id: exam._id,
          title: exam.title,
          isActive: exam.isActive
        },
        joinedStudents: exam.joinedStudents || []
      }
    });
    
  } catch (err) {
    console.error("❌ Get joined students error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to get joined students"
    });
  }
});

// ===== LIVE CLASS ROUTES =====

// ✅ START LIVE CLASS
router.post("/:examId/start-live-class", async (req, res) => {
  try {
    const { examId } = req.params;
    
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }
    
    // Check if user is teacher
    const classData = await Class.findById(exam.classId);
    if (!classData || classData.ownerId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Only teachers can start live classes"
      });
    }
    
    // Check if exam is a live class
    if (exam.examType !== 'live-class' && !exam.isLiveClass) {
      return res.status(400).json({
        success: false,
        message: "This is not a live class exam"
      });
    }
    
    // Update exam to active live class
    const updatedExam = await Exam.findByIdAndUpdate(
      examId,
      { 
        isActive: true,
        isDeployed: true,
        startedAt: new Date(),
        updatedAt: new Date()
      },
      { new: true }
    );
    
    res.json({
      success: true,
      message: "Live class started",
      data: updatedExam
    });
    
  } catch (err) {
    console.error("Start live class error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to start live class"
    });
  }
});

// ✅ JOIN LIVE CLASS
router.post("/:examId/join-live-class", async (req, res) => {
  try {
    const { examId } = req.params;
    const userId = req.user.id;
    
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }
    
    // Check if exam is active live class
    if (!exam.isActive || (exam.examType !== 'live-class' && !exam.isLiveClass)) {
      return res.status(400).json({
        success: false,
        message: "Live class is not active"
      });
    }
    
    // Check if user is in class
    const classData = await Class.findById(exam.classId);
    const isMember = classData.members.some(m => 
      m.userId && m.userId.toString() === userId
    ) || classData.ownerId.toString() === userId;
    
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this class"
      });
    }
    
    res.json({
      success: true,
      message: "Joined live class",
      data: {
        examId: exam._id,
        title: exam.title,
        userId: userId,
        isHost: classData.ownerId.toString() === userId
      }
    });
    
  } catch (err) {
    console.error("Join live class error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to join live class"
    });
  }
});

// ✅ END LIVE CLASS
router.post("/:examId/end-live-class", async (req, res) => {
  try {
    const { examId } = req.params;
    
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }
    
    // Check if user is teacher
    const classData = await Class.findById(exam.classId);
    if (!classData || classData.ownerId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Only teachers can end live classes"
      });
    }
    
    // Update exam to inactive
    const updatedExam = await Exam.findByIdAndUpdate(
      examId,
      { 
        isActive: false,
        endedAt: new Date(),
        updatedAt: new Date()
      },
      { new: true }
    );
    
    res.json({
      success: true,
      message: "Live class ended",
      data: updatedExam
    });
    
  } catch (err) {
    console.error("End live class error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to end live class"
    });
  }
});

// ===== COMPLETION TRACKING ROUTES =====

// ✅ MARK EXAM AS COMPLETED
router.post("/:examId/complete", async (req, res) => {
  try {
    const { examId } = req.params;
    const studentId = req.user.id;
    const { score, maxScore, percentage, answers } = req.body;

    console.log("🎯 MARKING EXAM AS COMPLETED:", { examId, studentId, score });

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    // Check if student already completed this exam
    const alreadyCompleted = exam.completedBy.some(completion => 
      completion.studentId.toString() === studentId
    );

    if (alreadyCompleted) {
      return res.status(400).json({
        success: false,
        message: "You have already completed this exam"
      });
    }

    // Add completion record
    exam.completedBy.push({
      studentId: studentId,
      completedAt: new Date(),
      score: score || 0,
      maxScore: maxScore || exam.totalPoints,
      percentage: percentage || 0,
      answers: answers || [],
      submittedAt: new Date()
    });

    await exam.save();

    console.log("✅ Exam marked as completed for student:", studentId);

    res.json({
      success: true,
      message: "Exam completed successfully",
      data: {
        examId: exam._id,
        completed: true,
        score: score,
        percentage: percentage
      }
    });

  } catch (err) {
    console.error("❌ Mark exam complete error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to mark exam as completed"
    });
  }
});

// ✅ GET COMPLETED EXAMS FOR STUDENT
router.get("/student/completed", async (req, res) => {
  try {
    const studentId = req.user.id;

    console.log("📋 GETTING COMPLETED EXAMS FOR STUDENT:", studentId);

    // Find all exams that this student has completed
    const exams = await Exam.find({
      'completedBy.studentId': studentId
    })
    .populate('classId', 'name code')
    .populate('createdBy', 'name')
    .sort({ 'completedBy.submittedAt': -1 });

    const completedExams = exams.map(exam => {
      const completion = exam.completedBy.find(c => 
        c.studentId.toString() === studentId
      );
      
      return {
        _id: exam._id,
        title: exam.title,
        description: exam.description,
        classId: exam.classId,
        className: exam.classId?.name,
        classCode: exam.classId?.code,
        teacherName: exam.createdBy?.name,
        completedAt: completion?.completedAt,
        submittedAt: completion?.submittedAt,
        score: completion?.score,
        maxScore: completion?.maxScore,
        percentage: completion?.percentage,
        type: "exam",
        isQuiz: exam.isQuiz,
        totalPoints: exam.totalPoints
      };
    });

    console.log("✅ Found completed exams:", completedExams.length);

    res.json({
      success: true,
      data: completedExams
    });

  } catch (err) {
    console.error("❌ Get completed exams error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to get completed exams"
    });
  }
});

// ✅ CHECK IF STUDENT HAS COMPLETED EXAM
router.get("/:examId/completion-status", async (req, res) => {
  try {
    const { examId } = req.params;
    const studentId = req.user.id;

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    const hasCompleted = exam.completedBy.some(completion => 
      completion.studentId.toString() === studentId
    );
    
    const completionData = hasCompleted ? 
      exam.completedBy.find(c => c.studentId.toString() === studentId) : null;

    res.json({
      success: true,
      data: {
        hasCompleted,
        completion: completionData
      }
    });

  } catch (err) {
    console.error("❌ Get completion status error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to get completion status"
    });
  }
});

// ===== CONTINUE WITH THE REST OF YOUR EXISTING ROUTES =====

// ✅ GET EXAM FOR STUDENT TO TAKE
router.get("/take/:examId", async (req, res) => {
  try {
    const { examId } = req.params;
    
    console.log("🎯 STUDENT QUIZ ACCESS - Take route HIT!");
    console.log("🔍 Exam ID:", examId);
    console.log("🔍 User ID:", req.user.id);

    // Validate examId
    if (!mongoose.Types.ObjectId.isValid(examId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid exam ID format"
      });
    }

    const exam = await Exam.findById(examId);
    if (!exam) {
      console.log("❌ Exam not found:", examId);
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    // Check if user has access to this exam's class
    const classData = await Class.findById(exam.classId);
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found"
      });
    }

    const isTeacher = classData.ownerId.toString() === req.user.id;
    const isStudent = classData.members.some(member => 
      member.userId && member.userId.toString() === req.user.id
    );

    if (!isTeacher && !isStudent) {
      return res.status(403).json({
        success: false,
        message: "You are not enrolled in this class"
      });
    }

    // Check if exam is available for students
    if (!isTeacher && !exam.isPublished && !exam.isDeployed) {
      return res.status(403).json({
        success: false,
        message: "This exam is not available yet"
      });
    }

    console.log("✅ Exam access granted:", exam.title, "for user:", req.user.id);

    // Prepare exam data for student (hide correct answers)
    const examForStudent = {
      _id: exam._id,
      title: exam.title,
      description: exam.description,
      classId: exam.classId,
      questions: exam.questions.map((question, index) => {
        // For students, hide correct answers but keep question structure
        if (isTeacher) {
          return question; // Teachers see everything
        } else {
          return {
            type: question.type,
            title: question.title,
            required: question.required,
            points: question.points,
            options: question.options,
            order: question.order,
            // Hide correct answers from students
            correctAnswer: undefined,
            correctAnswers: undefined,
            answerKey: undefined
          };
        }
      }),
      totalPoints: exam.totalPoints,
      isPublished: exam.isPublished,
      isDeployed: exam.isDeployed,
      isActive: exam.isActive,
      timeLimit: exam.timeLimit,
      examType: exam.examType, // ✅ ADDED EXAM TYPE
      isLiveClass: exam.isLiveClass, // ✅ ADDED LIVE CLASS FLAG
      createdAt: exam.createdAt,
      updatedAt: exam.updatedAt
    };

    res.json({
      success: true,
      data: examForStudent,
      userRole: isTeacher ? "teacher" : "student"
    });

  } catch (err) {
    console.error("❌ Student exam access error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load exam",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ✅ UPDATED SUBMIT EXAM ANSWERS ROUTE TO AUTO-COMPLETE
router.post("/:examId/submit", async (req, res) => {
  try {
    const { examId } = req.params;
    const { answers } = req.body;

    console.log("📝 Student submitting answers for exam:", examId, "User:", req.user.id);

    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({
        success: false,
        message: "Answers are required"
      });
    }

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    // Check if user is student in the class
    const classData = await Class.findById(exam.classId);
    const isStudent = classData.members.some(member => 
      member.userId && member.userId.toString() === req.user.id
    );

    if (!isStudent) {
      return res.status(403).json({
        success: false,
        message: "Only students can submit answers"
      });
    }

    // Check if exam is available
    if (!exam.isPublished && !exam.isDeployed) {
      return res.status(403).json({
        success: false,
        message: "This exam is not available for submission"
      });
    }

    // Calculate score
    let score = 0;
    let maxScore = exam.totalPoints || exam.questions.reduce((sum, q) => sum + (q.points || 1), 0);
    let detailedAnswers = [];
    
    exam.questions.forEach((question, index) => {
      const studentAnswer = answers[index];
      let isCorrect = false;
      let pointsEarned = 0;
      
      if (studentAnswer) {
        // Basic scoring logic
        if (question.type === 'multiple-choice' && question.correctAnswer !== undefined) {
          if (studentAnswer === question.options[question.correctAnswer]) {
            score += question.points || 1;
            pointsEarned = question.points || 1;
            isCorrect = true;
          }
        } else if (question.type === 'checkboxes' && question.correctAnswers) {
          // For checkboxes, check if all correct answers are selected
          const correctOptions = question.correctAnswers.map(idx => question.options[idx]);
          const isCorrect = correctOptions.every(opt => studentAnswer.includes(opt)) && 
                           correctOptions.length === studentAnswer.length;
          if (isCorrect) {
            score += question.points || 1;
            pointsEarned = question.points || 1;
            isCorrect = true;
          }
        }
        // For essay/short-answer questions, you might want manual grading
      }
      
      detailedAnswers.push({
        questionIndex: index,
        answer: studentAnswer,
        isCorrect: isCorrect,
        points: pointsEarned
      });
    });

    const percentage = Math.round((score / maxScore) * 100);

    console.log("✅ Answers submitted. Score:", score, "/", maxScore, "Percentage:", percentage + "%");

    // ✅ AUTO-MARK AS COMPLETED
    const alreadyCompleted = exam.completedBy.some(completion => 
      completion.studentId.toString() === req.user.id
    );

    if (!alreadyCompleted) {
      exam.completedBy.push({
        studentId: req.user.id,
        completedAt: new Date(),
        score: score,
        maxScore: maxScore,
        percentage: percentage,
        answers: detailedAnswers,
        submittedAt: new Date()
      });
      await exam.save();
      console.log("✅ Auto-marked exam as completed for student");
    }

    res.json({
      success: true,
      message: "Answers submitted successfully",
      data: {
        score,
        maxScore,
        percentage,
        completed: true
      }
    });

  } catch (err) {
    console.error("❌ Submit answers error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to submit answers",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ===== EXISTING QUIZ CREATION ROUTES =====

// ✅ CREATE QUIZ - UPDATED WITH EXAM TYPE
router.post("/create/:classId", async (req, res) => {
  try {
    const { classId } = req.params;
    const { 
      title, 
      description, 
      questions, 
      settings, 
      theme, 
      isPublished, 
      totalPoints,
      examType = 'asynchronous', // ✅ ADDED DEFAULT
      timeLimit = 60, // ✅ ADDED DEFAULT
      isLiveClass = false // ✅ ADDED DEFAULT
    } = req.body;

    console.log("🎯 CREATE QUIZ ROUTE HIT:", { 
      classId, 
      title, 
      examType, // ✅ LOG EXAM TYPE
      timeLimit,
      isLiveClass
    });

    // Validate required fields
    if (!title || !classId) {
      return res.status(400).json({
        success: false,
        message: "Title and classId are required"
      });
    }

    // Check if user is teacher for this class
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found"
      });
    }

    if (classData.ownerId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Only teachers can create quizzes"
      });
    }

    // Create new exam/quiz with exam type
    const newExam = new Exam({
      title,
      description: description || "Form description",
      classId,
      createdBy: req.user.id,
      questions: questions || [],
      totalPoints: totalPoints || 0,
      isQuiz: true,
      examType: examType, // ✅ SAVE EXAM TYPE
      timeLimit: examType === 'live-class' ? 0 : timeLimit, // ✅ SET TIME LIMIT
      isLiveClass: examType === 'live-class', // ✅ SET LIVE CLASS FLAG
      isPublished: isPublished || false,
      settings: settings || {
        collectEmails: false,
        limitOneResponse: false,
        showProgressBar: true,
        confirmationMessage: "Your response has been recorded.",
        allowEditing: true,
        shuffleQuestions: false
      },
      theme: theme || {
        headerColor: "#4285f4",
        themeColor: "#4285f4", 
        fontStyle: "default"
      },
      isDeployed: false,
      fileUrl: null
    });

    const savedExam = await newExam.save();

    // Add to class's exams array
    await Class.findByIdAndUpdate(
      classId,
      { $addToSet: { exams: savedExam._id } }
    );

    console.log("✅ Quiz created successfully:", savedExam._id, "Type:", examType);

    res.status(201).json({
      success: true,
      message: "Quiz created successfully",
      data: savedExam
    });

  } catch (err) {
    console.error("❌ Create quiz error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to create quiz",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ✅ UPDATE QUIZ QUESTIONS - UPDATED WITH EXAM TYPE
router.put("/:examId/quiz-questions", async (req, res) => {
  try {
    const { examId } = req.params;
    const { 
      title, 
      description, 
      questions, 
      settings, 
      theme, 
      isPublished, 
      totalPoints,
      examType, // ✅ ADDED
      timeLimit, // ✅ ADDED
      isLiveClass // ✅ ADDED
    } = req.body;

    console.log("🎯 UPDATE QUIZ QUESTIONS ROUTE HIT:", examId, "Exam Type:", examType);

    // Validate examId
    if (!mongoose.Types.ObjectId.isValid(examId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid exam ID format"
      });
    }

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found"
      });
    }

    // Check if user is authorized to update this quiz
    const classData = await Class.findById(exam.classId);
    if (!classData || classData.ownerId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this quiz"
      });
    }

    // Update quiz with exam type fields
    const updateData = {
      updatedAt: new Date()
    };
    
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (questions !== undefined) updateData.questions = questions;
    if (settings !== undefined) updateData.settings = settings;
    if (theme !== undefined) updateData.theme = theme;
    if (totalPoints !== undefined) updateData.totalPoints = totalPoints;
    if (examType !== undefined) {
      updateData.examType = examType;
      updateData.isLiveClass = examType === 'live-class';
      if (examType === 'live-class') {
        updateData.timeLimit = 0;
      } else if (timeLimit !== undefined) {
        updateData.timeLimit = timeLimit;
      }
    }
    if (timeLimit !== undefined && (!examType || examType !== 'live-class')) {
      updateData.timeLimit = timeLimit;
    }
    if (isLiveClass !== undefined) updateData.isLiveClass = isLiveClass;
    if (isPublished !== undefined) {
      updateData.isPublished = isPublished;
      if (isPublished && !exam.publishedAt) {
        updateData.publishedAt = new Date();
      }
    }

    const updatedExam = await Exam.findByIdAndUpdate(
      examId,
      updateData,
      { new: true, runValidators: true }
    );

    console.log("✅ Quiz updated successfully:", examId, "Type:", updatedExam.examType);

    res.json({
      success: true,
      message: "Quiz updated successfully",
      data: updatedExam
    });

  } catch (err) {
    console.error("❌ Update quiz error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update quiz",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ✅ DEPLOY/PUBLISH EXAM
router.patch("/deploy/:examId", async (req, res) => {
  try {
    const { examId } = req.params;

    console.log("🎯 DEPLOY EXAM ROUTE HIT:", examId);

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    // Check if user is authorized
    const classData = await Class.findById(exam.classId);
    if (!classData || classData.ownerId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to deploy this exam"
      });
    }

    const updatedExam = await Exam.findByIdAndUpdate(
      examId,
      { 
        isPublished: true,
        isDeployed: true,
        publishedAt: new Date(),
        updatedAt: new Date()
      },
      { new: true }
    );

    console.log("✅ Exam deployed successfully:", examId);

    res.json({
      success: true,
      message: "Exam published successfully",
      data: updatedExam
    });

  } catch (err) {
    console.error("❌ Deploy exam error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to deploy exam",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ✅ GET QUIZ FOR EDITING
router.get("/:examId/edit", async (req, res) => {
  try {
    const { examId } = req.params;

    console.log("🎯 GET QUIZ FOR EDIT ROUTE HIT:", examId);

    // Validate examId
    if (!mongoose.Types.ObjectId.isValid(examId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid exam ID format"
      });
    }

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found"
      });
    }

    // Check if user has access to this quiz's class
    const classData = await Class.findById(exam.classId);
    const hasAccess = classData && (
      classData.ownerId.toString() === req.user.id ||
      classData.members.some(m => m.userId && m.userId.toString() === req.user.id)
    );

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this quiz"
      });
    }

    console.log("✅ Quiz loaded for editing:", examId, "Type:", exam.examType);

    res.json({
      success: true,
      data: exam
    });

  } catch (err) {
    console.error("❌ Get quiz for edit error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load quiz",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ===== FILE UPLOAD & PARSING ROUTES =====

// Updated upload-parse route using Python service
router.post("/upload-parse", upload.single("file"), async (req, res) => {
  try {
    console.log("🎯 UPLOAD-PARSE STARTED");
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded"
      });
    }

    const filePath = req.file.path;
    const fileType = req.file.mimetype;
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    
    console.log("📁 File:", req.file.originalname);

    let questions = [];
    let usePython = false;

    // Try Python service first (PORT 5001)
    try {
      console.log("🔄 Attempting Python service on port 5001...");
      const FormData = require('form-data');
      const fs = require('fs');
      
      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath));

      const pythonResponse = await axios.post('http://localhost:5001/parse-file', formData, {
        headers: {
          ...formData.getHeaders(),
        },
        timeout: 15000,
      });

      console.log("✅ Python service successful");
      questions = pythonResponse.data.data?.questions || [];
      usePython = true;
      
    } catch (pythonError) {
      console.log("⚠️ Python service failed:", pythonError.message);
      
      // Fallback to Node.js parsing
      console.log("🔄 Using Node.js fallback parser...");
      let extractedText = '';
      
      if (fileType === 'application/pdf') {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        extractedText = data.text;
      } else if (fileType.includes('word') || fileType.includes('document') || fileExt === '.docx' || fileExt === '.doc') {
        const result = await mammoth.extractRawText({ path: filePath });
        extractedText = result.value;
      } else if (fileType === 'text/plain' || fileExt === '.txt') {
        extractedText = fs.readFileSync(filePath, 'utf8');
      }
      
      console.log("📝 Extracted text length:", extractedText.length);
      questions = parseFormattedDocument(extractedText);
    }

    // Clean up uploaded file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    if (questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No questions could be extracted from the file."
      });
    }

    res.json({
      success: true,
      data: {
        questions: questions,
        title: `Quiz from ${req.file.originalname}`,
        description: `Automatically imported from ${req.file.originalname}`,
        parsedWith: usePython ? 'python' : 'nodejs'
      }
    });

  } catch (error) {
    console.error("❌ Upload-parse error:", error);
    
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      message: "Failed to process file: " + error.message
    });
  }
});

// ===== OTHER EXISTING ROUTES =====

// ✅ GET ALL EXAMS FOR A CLASS
router.get("/:classId", async (req, res) => {
  try {
    const classId = new mongoose.Types.ObjectId(req.params.classId);
    
    // Check if user has access to this class
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found"
      });
    }

    const hasAccess = classData.ownerId.toString() === req.user.id ||
                     classData.members.some(m => m.userId && m.userId.toString() === req.user.id);
    
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this class"
      });
    }

    const exams = await Exam.find({ classId }).sort({ createdAt: -1 });

    const updatedExams = exams.map((exam) => {
      const relativePath = exam.fileUrl && exam.fileUrl.startsWith("/uploads")
        ? exam.fileUrl
        : exam.fileUrl ? `/uploads/${exam.fileUrl}` : null;
      
      return {
        ...exam._doc,
        fileUrl: relativePath ? `${req.protocol}://${req.get("host")}${relativePath}` : null,
      };
    });

    res.json({ 
      success: true, 
      message: "Exams fetched successfully", 
      data: updatedExams 
    });
  } catch (err) {
    console.error("❌ Fetch exams error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch exams",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ✅ GET DEPLOYED EXAM FOR A CLASS
router.get("/deployed/:classId", async (req, res) => {
  try {
    const classId = new mongoose.Types.ObjectId(req.params.classId);
    
    // Check if user has access to this class
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found"
      });
    }

    const hasAccess = classData.ownerId.toString() === req.user.id ||
                     classData.members.some(m => m.userId && m.userId.toString() === req.user.id);
    
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this class"
      });
    }

    const exam = await Exam.findOne({ 
      classId, 
      $or: [
        { isDeployed: true },
        { isPublished: true }
      ]
    });
    
    return res.status(200).json({
      success: true,
      message: exam ? "Deployed exam found" : "No deployed exam",
      data: exam || null,
    });
  } catch (err) {
    console.error("❌ Fetch deployed exam error:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to fetch deployed exam",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ✅ IMPROVED DELETE EXAM ENDPOINT
router.delete("/:examId", async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const examId = req.params.examId;
    const userId = req.user.id;
    
    console.log("🗑️ DELETE EXAM REQUEST:", { 
      examId, 
      userId, 
      timestamp: new Date().toISOString() 
    });

    // Validate examId format
    if (!mongoose.Types.ObjectId.isValid(examId)) {
      await session.abortTransaction();
      return res.status(400).json({ 
        success: false, 
        message: "Invalid exam ID format" 
      });
    }

    // Find exam with session for transaction consistency
    const exam = await Exam.findById(examId).session(session);
    if (!exam) {
      await session.abortTransaction();
      console.log("❌ Exam not found for deletion:", examId);
      return res.status(404).json({ 
        success: false, 
        message: "Exam not found" 
      });
    }
    
    // ✅ Enhanced authorization check
    const classData = await Class.findById(exam.classId).session(session);
    if (!classData) {
      await session.abortTransaction();
      return res.status(404).json({ 
        success: false, 
        message: "Class not found" 
      });
    }

    // Check if user is class owner or has admin privileges
    const isClassOwner = classData.ownerId.toString() === userId;
    const isAdmin = req.user.role === 'admin'; // If you have admin role
    
    if (!isClassOwner && !isAdmin) {
      await session.abortTransaction();
      console.log("❌ Unauthorized deletion attempt:", { userId, classOwner: classData.ownerId });
      return res.status(403).json({ 
        success: false, 
        message: "Not authorized to delete this exam. Only class teachers can delete exams." 
      });
    }

    // ✅ Prevent deletion of active exam sessions
    if (exam.isActive) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: "Cannot delete an active exam session. Please end the session first."
      });
    }

    // ✅ Async file deletion with error handling
    if (exam.fileUrl) {
      try {
        const filename = exam.fileUrl.split('/').pop();
        const filePath = path.join(uploadDir, filename);
        
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
          console.log("✅ Deleted associated file:", filename);
        }
      } catch (fileError) {
        console.warn("⚠️ Could not delete file, continuing with exam deletion:", fileError.message);
        // Don't fail the entire operation if file deletion fails
      }
    }

    // ✅ Remove from class's exams array
    await Class.findByIdAndUpdate(
      exam.classId, 
      { $pull: { exams: exam._id } },
      { session }
    );

    // ✅ Delete the exam
    await Exam.findByIdAndDelete(examId, { session });

    // ✅ Commit the transaction
    await session.commitTransaction();
    
    console.log("✅ Exam deleted successfully:", examId);

    res.json({ 
      success: true, 
      message: "Exam deleted successfully",
      deletedExamId: examId,
      deletedAt: new Date().toISOString()
    });

  } catch (err) {
    // ✅ Abort transaction on error
    await session.abortTransaction();
    
    console.error("❌ Delete exam error:", err);
    
    // Handle specific error types
    let errorMessage = "Failed to delete exam";
    let statusCode = 500;
    
    if (err.name === 'CastError') {
      errorMessage = "Invalid exam ID";
      statusCode = 400;
    } else if (err.name === 'ValidationError') {
      errorMessage = "Validation error during deletion";
      statusCode = 400;
    }
    
    res.status(statusCode).json({ 
      success: false, 
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    // ✅ Always end the session
    session.endSession();
  }
});

// ✅ DELETE ALL QUIZZES FOR A CLASS
router.delete("/class/:classId/delete-all", async (req, res) => {
  try {
    const { classId } = req.params;
    const teacherId = req.user.id;

    console.log("🎯 DELETE ALL QUIZZES ROUTE HIT:", { classId, teacherId });

    // Validate classId
    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid class ID format"
      });
    }

    // Verify the teacher owns this class
    const classObj = await Class.findById(classId);
    if (!classObj) {
      return res.status(404).json({
        success: false,
        message: "Class not found"
      });
    }

    if (classObj.ownerId.toString() !== teacherId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete quizzes from this class"
      });
    }

    // Delete all quizzes/exams for this class
    const result = await Exam.deleteMany({ 
      classId: classId,
      createdBy: teacherId
    });

    console.log("✅ Quizzes deletion result:", result);

    // Also remove exams from class's exams array
    await Class.findByIdAndUpdate(
      classId,
      { $set: { exams: [] } }
    );

    res.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} quizzes from this class`,
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error("❌ Error deleting all quizzes:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting quizzes",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ✅ GET PARSED QUESTIONS
router.get("/:examId/questions", async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) return res.status(404).json({ 
      success: false, 
      message: "Exam not found" 
    });

    // ✅ Check if user has access to this exam's class
    const classData = await Class.findById(exam.classId);
    const hasAccess = classData && (
      classData.ownerId.toString() === req.user.id ||
      classData.members.some(m => m.userId && m.userId.toString() === req.user.id)
    );

    if (!hasAccess) {
      return res.status(403).json({ 
        success: false, 
        message: "Not authorized to access these questions" 
      });
    }

    res.json({ 
      success: true, 
      message: "Questions fetched successfully", 
      data: exam.questions 
    });
  } catch (err) {
    console.error("❌ Fetch questions error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch questions",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ✅ HEALTH CHECK - UPDATED WITH ALL ROUTES INCLUDING COMMENTS AND LIVE CLASS
router.get("/health", (req, res) => {
  console.log("✅ EXAM HEALTH CHECK ROUTE HIT");
  res.json({
    success: true,
    message: "Exam routes are working with STUDENT QUIZ & COMMENT & LIVE CLASS features",
    user: req.user,
    routes: [
      "POST /create/:classId",
      "POST /upload-parse",
      "PUT /:examId/quiz-questions", 
      "GET /:examId/edit",
      "GET /take/:examId",
      "POST /:examId/submit",
      "GET /:examId/results",
      "GET /form/:examId",
      "GET /deployed/:classId", 
      "POST /upload/:classId",
      "GET /:classId",
      "DELETE /:examId",
      "DELETE /class/:classId/delete-all",
      "GET /:examId/questions",
      "PATCH /deploy/:examId",
      "POST /:examId/start-session",
      "POST /:examId/end-session",
      "POST /:examId/join",
      "GET /:examId/session-status",
      "GET /:examId/joined-students",
      // New completion tracking routes
      "POST /:examId/complete",
      "GET /student/completed", 
      "GET /:examId/completion-status",
      // ✅ COMMENT ROUTES
      "GET /:examId/comments",
      "POST /:examId/comments", 
      "DELETE /:examId/comments/:commentId",
      "GET /test-comments/:examId",
      // ✅ LIVE CLASS ROUTES
      "POST /:examId/start-live-class",
      "POST /:examId/join-live-class",
      "POST /:examId/end-live-class"
    ],
    timestamp: new Date().toISOString()
  });
});

// ===== HELPER FUNCTIONS =====
function parseFormattedDocument(text) {
  console.log("🔄 STARTING ENHANCED PARSING...");
  
  const questions = [];
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  
  let currentQuestion = null;
  let questionCounter = 0;

  console.log("📄 Total lines to process:", lines.length);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    console.log(`📖 Line ${i}: "${line}"`);

    // Skip empty lines
    if (!line) continue;

    // Detect question with number (1., 2., etc.)
    const questionMatch = line.match(/^(\d+)\.\s*(.+)$/);
    if (questionMatch) {
      // Save previous question
      if (currentQuestion) {
        questions.push(currentQuestion);
        console.log("💾 Saved question:", {
          title: currentQuestion.title?.substring(0, 30),
          type: currentQuestion.type,
          options: currentQuestion.options,
          answer: currentQuestion.correctAnswer ?? currentQuestion.correctAnswers ?? currentQuestion.answerKey
        });
      }
      
      questionCounter++;
      currentQuestion = {
        type: 'multiple-choice', // default type
        title: questionMatch[2],
        required: false,
        points: 1,
        options: [],
        correctAnswer: null,
        correctAnswers: [],
        answerKey: '',
        order: questionCounter - 1
      };
      
      console.log("❓ New question started:", currentQuestion.title.substring(0, 50));
      continue;
    }

    // Detect options (A), B), C), D) - FIXED REGEX
    const optionMatch = line.match(/^([A-D])[\)\.]\s*(.+)$/i);
    if (optionMatch && currentQuestion) {
      const optionText = optionMatch[2].trim();
      currentQuestion.options.push(optionText);
      console.log("📝 Added option:", optionMatch[1], optionText);
      continue;
    }

    // Detect ANSWER (single choice) - CASE INSENSITIVE
    const answerMatch = line.match(/^ANSWER:\s*(.+)$/i);
    if (answerMatch && currentQuestion) {
      const answerValue = answerMatch[1].trim();
      console.log("🎯 Processing ANSWER:", answerValue);
      
      // Check if there are options to determine question type
      if (currentQuestion.options.length > 0) {
        // Has options = multiple choice or checkboxes
        if (answerValue.includes(',')) {
          // Multiple answers = checkboxes
          const answers = answerValue.split(',').map(a => a.trim().toUpperCase());
          const answerIndices = answers.map(a => 'ABCD'.indexOf(a)).filter(idx => idx !== -1);
          
          if (answerIndices.length > 0) {
            currentQuestion.correctAnswers = answerIndices;
            currentQuestion.type = 'checkboxes';
            console.log("✅ Set CHECKBOX answers:", answers, "-> indices:", answerIndices);
          }
        } else {
          // Single answer = multiple choice
          const answerIndex = 'ABCD'.indexOf(answerValue.toUpperCase());
          if (answerIndex !== -1) {
            currentQuestion.correctAnswer = answerIndex;
            currentQuestion.type = 'multiple-choice';
            console.log("✅ Set MULTIPLE-CHOICE answer:", answerValue, "-> index:", answerIndex);
          } else {
            console.log("❌ Invalid answer for multiple-choice:", answerValue);
          }
        }
      } else {
        // No options = text answer
        currentQuestion.answerKey = answerValue;
        // Auto-detect short vs paragraph based on length
        currentQuestion.type = answerValue.length > 50 ? 'paragraph' : 'short-answer';
        console.log("✅ Set TEXT answer:", currentQuestion.type, "->", answerValue);
      }
      continue;
    }

    // Also detect "ANSWERS:" format for checkboxes
    const answersMatch = line.match(/^ANSWERS?:\s*([A-D,\s]+)$/i);
    if (answersMatch && currentQuestion && currentQuestion.options.length > 0) {
      const answersStr = answersMatch[1];
      const answers = answersStr.split(',').map(a => a.trim().toUpperCase());
      const answerIndices = answers.map(a => 'ABCD'.indexOf(a)).filter(idx => idx !== -1);
      
      if (answerIndices.length > 0) {
        currentQuestion.correctAnswers = answerIndices;
        currentQuestion.type = 'checkboxes';
        console.log("✅ Set CHECKBOX answers (ANSWERS: format):", answers, "-> indices:", answerIndices);
      }
      continue;
    }

    // Detect POINTS
    const pointsMatch = line.match(/^POINTS?:\s*(\d+)/i);
    if (pointsMatch && currentQuestion) {
      currentQuestion.points = parseInt(pointsMatch[1]);
      console.log("⭐ Set points:", currentQuestion.points);
      continue;
    }

    // If line looks like an option but didn't match regex, try to add it
    if (currentQuestion && line.match(/^[A-D][\s\.].+/i) && !line.match(/ANSWER|POINTS/i)) {
      const optionText = line.substring(2).trim();
      if (optionText && currentQuestion.options.length < 4) {
        currentQuestion.options.push(optionText);
        console.log("📝 Added inferred option:", line.substring(0, 2), optionText);
      }
    }
  }

  // Add the last question
  if (currentQuestion && currentQuestion.title) {
    questions.push(currentQuestion);
    console.log("💾 Saved final question:", {
      title: currentQuestion.title?.substring(0, 30),
      type: currentQuestion.type,
      options: currentQuestion.options,
      answer: currentQuestion.correctAnswer ?? currentQuestion.correctAnswers ?? currentQuestion.answerKey
    });
  }

  console.log("🎉 PARSING COMPLETE. Total questions:", questions.length);
  
  // Final detailed debug log
  questions.forEach((q, index) => {
    console.log(`📊 FINAL Question ${index + 1}:`, {
      type: q.type,
      title: q.title?.substring(0, 40) + '...',
      options: q.options,
      correctAnswer: q.correctAnswer,
      correctAnswers: q.correctAnswers,
      answerKey: q.answerKey,
      points: q.points
    });
  });
  
  return questions;
}

// ✅ DOCX PARSING FUNCTION
const parseDOCX = async (filePath) => {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    const text = result.value;
    
    console.log("📝 Extracted DOCX text length:", text.length);
    
    // Try the improved formatted parsing
    const formattedQuestions = parseFormattedDocument(text);
    
    if (formattedQuestions.length > 0) {
      console.log("✅ Successfully parsed formatted document:", formattedQuestions.length, "questions");
      return formattedQuestions;
    }
    
    // Enhanced fallback parsing
    console.log("⚠️ No formatted questions found, using enhanced fallback parsing");
    const questions = [];
    const lines = text.split('\n');
    let currentQuestion = null;
    
    lines.forEach((line, index) => {
      line = line.trim();
      if (!line) return;
      
      // Detect question lines
      const isQuestion = line.endsWith('?') || /^\d+\./.test(line) || (line.length > 20 && /^[A-Z]/.test(line));
      
      if (isQuestion) {
        // Save previous question
        if (currentQuestion) {
          questions.push(currentQuestion);
        }
        
        currentQuestion = {
          type: "essay", // default type
          title: line,
          required: false,
          points: 1,
          options: [],
          correctAnswer: null,
          correctAnswers: [],
          answerKey: "",
          order: questions.length
        };
      }
      // Look for answer patterns in subsequent lines
      else if (currentQuestion && line.match(/^(Answer|ANSWER)/i)) {
        const answerMatch = line.match(/^(?:Answer|ANSWER):\s*(.+)$/i);
        if (answerMatch) {
          currentQuestion.answerKey = answerMatch[1];
          // Auto-detect type based on answer length
          currentQuestion.type = answerMatch[1].length > 50 ? "paragraph" : "short-answer";
        }
      }
    });
    
    // Add the last question
    if (currentQuestion) {
      questions.push(currentQuestion);
    }
    
    console.log("📝 Fallback parsing found:", questions.length, "questions");
    return questions;
    
  } catch (error) {
    console.error("DOCX parsing error:", error);
    throw error;
  }
};

module.exports = router;