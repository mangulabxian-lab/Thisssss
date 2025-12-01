// backend/models/Exam.js - UPDATED VERSION WITH EXAM TYPE & LIVE CLASS SUPPORT
const mongoose = require("mongoose");

// ✅ COMMENT SCHEMA
const commentSchema = new mongoose.Schema({
  content: { type: String, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  role: { type: String, enum: ["teacher", "student"], required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const examSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: "Quiz description" },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  
  // ✅ NEW EXAM TYPE & LIVE CLASS FIELDS
  examType: {
    type: String,
    enum: ['asynchronous', 'live-class'],
    default: 'asynchronous'
  },
  isLiveClass: {
    type: Boolean,
    default: false
  },
  
  // ✅ STATUS & SCHEDULING FIELDS
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'published', 'completed', 'archived'],
    default: 'draft'
  },
  scheduledAt: {
    type: Date,
    default: null
  },
  isDeployed: {
    type: Boolean,
    default: false
  },
  
  // ✅ LIVE EXAM SESSION FIELDS
  isActive: { type: Boolean, default: false },
  startedAt: { type: Date },
  endedAt: { type: Date },
  timeLimit: { 
    type: Number, 
    default: 60 // in minutes
  },
  
  // ✅ JOINED STUDENTS TRACKING
  joinedStudents: [{
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    joinedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ["connected", "disconnected"], default: "connected" },
    cameraEnabled: { type: Boolean, default: true },
    microphoneEnabled: { type: Boolean, default: true }
  }],

  // ✅ COMPLETION TRACKING
  completedBy: [{
    studentId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },
    completedAt: { 
      type: Date, 
      default: Date.now 
    },
    score: { 
      type: Number 
    },
    maxScore: {
      type: Number
    },
    percentage: {
      type: Number
    },
    answers: [{
      questionIndex: Number,
      answer: mongoose.Schema.Types.Mixed,
      isCorrect: Boolean,
      points: Number
    }],
    submittedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // ✅ ADD COMMENT FUNCTIONALITY
  comments: [commentSchema],

  // Quiz/Exam specific fields
  isQuiz: { type: Boolean, default: false },
  isPublished: { type: Boolean, default: false },
  totalPoints: { type: Number, default: 0 },
  
  // Questions array
  questions: [{
    type: { 
      type: String, 
      enum: [
        "multiple-choice", 
        "checkboxes", 
        "dropdown", 
        "short-answer", 
        "paragraph", 
        "linear-scale", 
        "multiple-choice-grid", 
        "checkbox-grid"
      ],
      required: true 
    },
    title: { type: String, required: true },
    required: { type: Boolean, default: false },
    points: { type: Number, default: 1 },
    order: { type: Number, default: 0 },
    
    // For multiple choice, checkboxes, dropdown
    options: [String],
    
    // ✅ ANSWER KEY FIELDS
    correctAnswer: { 
      type: mongoose.Schema.Types.Mixed, 
      default: null 
    },
    correctAnswers: { 
      type: [mongoose.Schema.Types.Mixed], 
      default: [] 
    },
    answerKey: { 
      type: String, 
      default: "" 
    },
    
    // For linear scale
    scale: {
      min: { type: Number, default: 1 },
      max: { type: Number, default: 5 },
      minLabel: { type: String, default: "" },
      maxLabel: { type: String, default: "" }
    },
    
    // For grid types
    rows: [String],
    columns: [String]
  }],
  
  // File upload fields
  fileUrl: { type: String },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  publishedAt: { type: Date }
});

// ✅ UPDATED Calculate total points and handle exam type logic
examSchema.pre("save", function(next) {
  this.updatedAt = Date.now();
  
  // Calculate total points
  if (this.questions && this.questions.length > 0) {
    this.totalPoints = this.questions.reduce((total, question) => {
      return total + (question.points || 1);
    }, 0);
  } else {
    this.totalPoints = 0;
  }
  
  // ✅ Auto-update status based on scheduling and deployment
  if (this.scheduledAt && this.scheduledAt > new Date() && !this.isDeployed) {
    this.status = 'scheduled';
  } else if (this.isDeployed) {
    this.status = 'published';
  } else {
    this.status = 'draft';
  }
  
  // ✅ AUTO-SET isLiveClass AND TIME LIMIT BASED ON examType
  if (this.examType === 'live-class') {
    this.isLiveClass = true;
    this.timeLimit = 0; // No time limit for live classes
  } else {
    this.isLiveClass = false;
    // For async, ensure timeLimit is set (default 60 minutes)
    if (!this.timeLimit || this.timeLimit <= 0) {
      this.timeLimit = 60;
    }
  }
  
  // Auto-set publishedAt if published
  if (this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  next();
});

// ✅ ADDED Method to get exam info (as requested)
examSchema.methods.getExamInfo = function() {
  return {
    _id: this._id,
    title: this.title,
    description: this.description,
    classId: this.classId,
    examType: this.examType || 'asynchronous',
    isLiveClass: this.isLiveClass || false,
    timeLimit: this.timeLimit || 60,
    isActive: this.isActive || false,
    status: this.status || 'draft',
    isDeployed: this.isDeployed || false,
    scheduledAt: this.scheduledAt,
    isPublished: this.isPublished || false,
    totalPoints: this.totalPoints || 0,
    questionCount: this.questions ? this.questions.length : 0,
    createdAt: this.createdAt,
    publishedAt: this.publishedAt,
    joinedStudentsCount: this.joinedStudents ? this.joinedStudents.length : 0,
    completedCount: this.completedBy ? this.completedBy.length : 0
  };
};

// ✅ Method to check if student has completed the exam
examSchema.methods.hasStudentCompleted = function(studentId) {
  return this.completedBy.some(completion => 
    completion.studentId.toString() === studentId.toString()
  );
};

// ✅ Method to get student completion data
examSchema.methods.getStudentCompletion = function(studentId) {
  return this.completedBy.find(completion => 
    completion.studentId.toString() === studentId.toString()
  );
};

// ✅ Method to add a comment to the exam
examSchema.methods.addComment = function(content, author, role) {
  this.comments.push({
    content,
    author,
    role,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  return this.save();
};

// ✅ Method to remove a comment from the exam
examSchema.methods.removeComment = function(commentId) {
  this.comments = this.comments.filter(comment => 
    comment._id.toString() !== commentId.toString()
  );
  return this.save();
};

// ✅ Method to update a comment
examSchema.methods.updateComment = function(commentId, content) {
  const comment = this.comments.id(commentId);
  if (comment) {
    comment.content = content;
    comment.updatedAt = new Date();
    return this.save();
  }
  return Promise.reject(new Error('Comment not found'));
};

// ✅ Method to schedule an exam
examSchema.methods.scheduleExam = function(scheduledAt) {
  this.scheduledAt = scheduledAt;
  this.status = 'scheduled';
  return this.save();
};

// ✅ Method to publish exam immediately
examSchema.methods.publishExam = function() {
  this.isDeployed = true;
  this.status = 'published';
  this.publishedAt = new Date();
  this.scheduledAt = null; // Clear schedule if publishing immediately
  return this.save();
};

// ✅ Method to set exam type
examSchema.methods.setExamType = function(examType) {
  this.examType = examType;
  this.isLiveClass = (examType === 'live-class');
  // Auto-adjust timeLimit for live classes
  if (examType === 'live-class') {
    this.timeLimit = 0;
  } else if (!this.timeLimit || this.timeLimit <= 0) {
    this.timeLimit = 60;
  }
  return this.save();
};

// ✅ Method to check if exam is currently available to students
examSchema.methods.isAvailable = function() {
  const now = new Date();
  if (this.status === 'published') {
    return true;
  }
  if (this.status === 'scheduled' && this.scheduledAt && this.scheduledAt <= now) {
    return true;
  }
  return false;
};

// ✅ Method to check if exam is a live class session
examSchema.methods.isLiveSession = function() {
  return this.examType === 'live-class' && this.isActive;
};

// ✅ Method to start a live session
examSchema.methods.startLiveSession = function() {
  if (this.examType !== 'live-class') {
    return Promise.reject(new Error('Only live-class exams can start live sessions'));
  }
  this.isActive = true;
  this.startedAt = new Date();
  this.status = 'published';
  this.isDeployed = true;
  return this.save();
};

// ✅ Method to end a live session
examSchema.methods.endLiveSession = function() {
  this.isActive = false;
  this.endedAt = new Date();
  this.status = 'completed';
  return this.save();
};

module.exports = mongoose.models.Exam || mongoose.model("Exam", examSchema);