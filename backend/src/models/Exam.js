// backend/models/Exam.js - UPDATED VERSION - LIVE CLASS WITH TIME LIMITS (TIMER FIELDS ADDED)
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
  
  // ✅ UPDATED: LIVE CLASS ONLY
  examType: {
    type: String,
    enum: ['live-class'],
    default: 'live-class'
  },
  isLiveClass: {
    type: Boolean,
    default: true
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
  
  // ✅ NEW FIELD: isStarted - Indicates if the exam has been started by the teacher
  isStarted: {
    type: Boolean,
    default: false
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

  // ✅ LIVE CLASS TIMER FIELDS
  liveClassSettings: {
    hasTimer: {
      type: Boolean,
      default: false
    },
    timerDuration: {
      type: Number, // in minutes
      default: 0
    },
    timerStartedAt: {
      type: Date
    },
    timerEndsAt: {
      type: Date
    },
    autoDisconnect: {
      type: Boolean,
      default: true
    }
  },

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

// ✅ UPDATED pre-save middleware - LIVE CLASS WITH TIME LIMITS
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
  
  // ✅ FORCE ALL EXAMS TO BE LIVE-CLASS
  this.examType = 'live-class';
  this.isLiveClass = true;
  
  // ✅ UPDATED STATUS LOGIC FOR LIVE CLASSES ONLY
  if (this.isDeployed || this.isPublished) {
    this.status = 'published';
    if (!this.publishedAt) {
      this.publishedAt = new Date();
    }
  } else {
    this.status = 'draft';
  }
  
  // ✅ Clear scheduledAt if publishing immediately
  if (this.status === 'published' && this.scheduledAt) {
    this.scheduledAt = null;
  }
  
  next();
});

// ✅ UPDATED Method to get exam info (TIMER FIELDS ADDED)
examSchema.methods.getExamInfo = function() {
  const timerInfo = this.liveClassSettings ? {
    hasTimer: this.liveClassSettings.hasTimer || false,
    timerDuration: this.liveClassSettings.timerDuration || 0,
    isTimerActive: this.isTimerActive(),
    remainingTime: this.getRemainingTime(),
    timerEndsAt: this.liveClassSettings.timerEndsAt,
    autoDisconnect: this.liveClassSettings.autoDisconnect || true
  } : {
    hasTimer: false,
    timerDuration: 0,
    isTimerActive: false,
    remainingTime: 0,
    timerEndsAt: null,
    autoDisconnect: true
  };
  
  return {
    _id: this._id,
    title: this.title,
    description: this.description,
    classId: this.classId,
    examType: this.examType || 'live-class',
    isLiveClass: this.isLiveClass || true,
    isActive: this.isActive || false,
    isStarted: this.isStarted || false, // ✅ Added isStarted to exam info
    status: this.status || 'draft',
    isDeployed: this.isDeployed || false,
    scheduledAt: this.scheduledAt,
    isPublished: this.isPublished || false,
    totalPoints: this.totalPoints || 0,
    questionCount: this.questions ? this.questions.length : 0,
    createdAt: this.createdAt,
    publishedAt: this.publishedAt,
    joinedStudentsCount: this.joinedStudents ? this.joinedStudents.length : 0,
    completedCount: this.completedBy ? this.completedBy.length : 0,
    startedAt: this.startedAt,
    endedAt: this.endedAt,
    liveClassSettings: timerInfo
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

// ✅ UPDATED: Add completion (timer info included)
examSchema.methods.addStudentCompletion = function(studentId, completionData) {
  const existingIndex = this.completedBy.findIndex(
    completion => completion.studentId.toString() === studentId.toString()
  );
  
  if (existingIndex >= 0) {
    // Update existing completion
    this.completedBy[existingIndex] = {
      ...this.completedBy[existingIndex].toObject(),
      ...completionData,
      submittedAt: new Date()
    };
  } else {
    // Add new completion
    this.completedBy.push({
      studentId,
      ...completionData,
      completedAt: new Date(),
      submittedAt: new Date()
    });
  }
  
  return this.save();
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

// ✅ Method to schedule an exam (for live classes only)
examSchema.methods.scheduleExam = function(scheduledAt) {
  this.scheduledAt = scheduledAt;
  this.status = 'scheduled';
  return this.save();
};

// ✅ Method to publish exam immediately
examSchema.methods.publishExam = function() {
  this.isDeployed = true;
  this.isPublished = true;
  this.status = 'published';
  this.publishedAt = new Date();
  this.scheduledAt = null; // Clear schedule if publishing immediately
  return this.save();
};

// ✅ UPDATED Method to set exam type - LIVE CLASS ONLY
examSchema.methods.setExamType = function(examType) {
  // Force live-class only
  this.examType = 'live-class';
  this.isLiveClass = true;
  return this.save();
};

// ✅ UPDATED Method to check if exam is currently available to students
examSchema.methods.isAvailable = function() {
  // Live classes are available when published
  return this.status === 'published' || (this.isPublished && this.isDeployed);
};

// ✅ Method to check if exam is a live class session
examSchema.methods.isLiveSession = function() {
  return this.isActive && this.isLiveClass;
};

// ✅ Method to start a live session
examSchema.methods.startLiveSession = function() {
  // All exams are live-class now
  this.isActive = true;
  this.isStarted = true; // ✅ Set isStarted to true when starting live session
  this.startedAt = new Date();
  this.status = 'published';
  this.isDeployed = true;
  this.isPublished = true;
  return this.save();
};

// ✅ Method to mark exam as started
examSchema.methods.markAsStarted = function() {
  this.isStarted = true;
  return this.save();
};

// ✅ Method to mark exam as not started
examSchema.methods.markAsNotStarted = function() {
  this.isStarted = false;
  return this.save();
};

// ✅ Method to end a live session
examSchema.methods.endLiveSession = function() {
  this.isActive = false;
  this.endedAt = new Date();
  this.status = 'completed';
  return this.save();
};

// ✅ TIMER METHODS
examSchema.methods.isTimerActive = function() {
  if (!this.liveClassSettings?.hasTimer || !this.liveClassSettings.timerStartedAt) {
    return false;
  }
  
  const now = new Date();
  const endsAt = this.liveClassSettings.timerEndsAt;
  
  return endsAt && now < endsAt;
};

examSchema.methods.getRemainingTime = function() {
  if (!this.isTimerActive()) {
    return 0;
  }
  
  const now = new Date();
  const endsAt = this.liveClassSettings.timerEndsAt;
  const remainingMs = endsAt - now;
  
  return Math.max(0, Math.floor(remainingMs / 1000));
};

examSchema.methods.startTimer = async function(durationMinutes) {
  if (!this.liveClassSettings?.hasTimer || durationMinutes <= 0) {
    return false;
  }
  
  const now = new Date();
  const durationMs = durationMinutes * 60 * 1000;
  
  this.liveClassSettings.timerStartedAt = now;
  this.liveClassSettings.timerEndsAt = new Date(now.getTime() + durationMs);
  this.liveClassSettings.timerDuration = durationMinutes;
  
  await this.save();
  return true;
};

examSchema.methods.stopTimer = async function() {
  this.liveClassSettings.timerStartedAt = null;
  this.liveClassSettings.timerEndsAt = null;
  await this.save();
};

// ✅ Method to configure timer settings
examSchema.methods.configureTimer = function(settings) {
  if (!this.liveClassSettings) {
    this.liveClassSettings = {};
  }
  
  if (settings.hasTimer !== undefined) {
    this.liveClassSettings.hasTimer = settings.hasTimer;
  }
  
  if (settings.timerDuration !== undefined) {
    this.liveClassSettings.timerDuration = settings.timerDuration;
  }
  
  if (settings.autoDisconnect !== undefined) {
    this.liveClassSettings.autoDisconnect = settings.autoDisconnect;
  }
  
  return this.save();
};

module.exports = mongoose.models.Exam || mongoose.model("Exam", examSchema);