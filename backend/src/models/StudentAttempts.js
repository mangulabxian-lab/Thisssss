const mongoose = require('mongoose');

const StudentAttemptsSchema = new mongoose.Schema({
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
  currentAttempts: {
    type: Number,
    default: 0,
    min: 0
  },
  maxAttempts: {
    type: Number,
    default: 10,
    min: 1,
    max: 50
  },
  attemptsLeft: {
    type: Number,
    default: 10,
    min: 0
  },
  history: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    violationType: String,
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical']
    },
    message: String,
    detectionSource: {
      type: String,
      enum: ['auto', 'manual', 'system']
    },
    attemptsUsed: Number,
    attemptsLeft: Number
  }],
  settingsSnapshot: {
    faceDetection: Boolean,
    gazeDetection: Boolean,
    phoneDetection: Boolean,
    mouthDetection: Boolean,
    multiplePeopleDetection: Boolean,
    audioDetection: Boolean,
    autoDisconnect: Boolean
  }
}, {
  timestamps: true
});

// Compound index
StudentAttemptsSchema.index({ studentId: 1, examId: 1 }, { unique: true });

// Method to add violation
StudentAttemptsSchema.methods.addViolation = function(violationData) {
  this.currentAttempts += 1;
  this.attemptsLeft = Math.max(0, this.maxAttempts - this.currentAttempts);
  
  this.history.push({
    ...violationData,
    attemptsUsed: this.currentAttempts,
    attemptsLeft: this.attemptsLeft
  });
  
  // Keep only last 20 violations
  if (this.history.length > 20) {
    this.history = this.history.slice(-20);
  }
  
  return this.save();
};

// Method to reset attempts
StudentAttemptsSchema.methods.resetAttempts = function() {
  this.currentAttempts = 0;
  this.attemptsLeft = this.maxAttempts;
  this.history = [];
  return this.save();
};

module.exports = mongoose.model('StudentAttempts', StudentAttemptsSchema);