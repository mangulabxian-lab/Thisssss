const mongoose = require('mongoose');

const StudentExamSessionSchema = new mongoose.Schema({
  studentId: {
    type: String,
    ref: 'User',
    required: true
  },
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  socketId: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['waiting', 'in_progress', 'completed', 'disconnected'],
    default: 'waiting'
  },
  attempts: {
    current: { type: Number, default: 0 },
    max: { type: Number, default: 10 },
    history: [{
      timestamp: Date,
      violationType: String,
      message: String,
      severity: String
    }]
  },
  answers: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  reconnectionCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Compound index for unique student-exam session
StudentExamSessionSchema.index({ studentId: 1, examId: 1 }, { unique: true });

module.exports = mongoose.model('StudentExamSession', StudentExamSessionSchema);