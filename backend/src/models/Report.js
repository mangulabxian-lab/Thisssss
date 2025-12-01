const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['user', 'class', 'exam', 'system', 'violation'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: String,
  data: mongoose.Schema.Types.Mixed,
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  parameters: mongoose.Schema.Types.Mixed,
  startDate: Date,
  endDate: Date,
  filePath: String,
  status: {
    type: String,
    enum: ['pending', 'generating', 'completed', 'failed'],
    default: 'pending'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Report', ReportSchema);