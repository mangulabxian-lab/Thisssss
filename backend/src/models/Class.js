// backend/src/models/Class.js - UPDATED WITH MUTE FIELD
const mongoose = require("mongoose");

const classSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  members: [{ 
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["teacher", "student"], default: "student" },
    joinedAt: { type: Date, default: Date.now },
    isMuted: { type: Boolean, default: false } // ✅ ADD THIS LINE
  }],
  exams: [{ type: mongoose.Schema.Types.ObjectId, ref: "Exam", unique: true }],
  classwork: [{ type: mongoose.Schema.Types.ObjectId, ref: "Assignment" }],
  topics: [{ type: String }],
  isArchived: { type: Boolean, default: false },
  archivedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

// Middleware to ensure exams array has unique values
classSchema.pre("save", function(next) {
  if (this.exams && this.exams.length > 1) {
    this.exams = [...new Set(this.exams.map(id => id.toString()))];
  }
  next();
});

module.exports = mongoose.models.Class || mongoose.model("Class", classSchema);
