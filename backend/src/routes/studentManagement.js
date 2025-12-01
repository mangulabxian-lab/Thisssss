// backend/routes/studentManagement.js
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Class = require("../models/Class");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

// ✅ GET ALL STUDENTS IN CLASS (with profile images)
router.get("/:classId/students", authMiddleware, async (req, res) => {
  try {
    const { classId } = req.params;
    const userId = req.user.id;

    // Validate classId
    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid class ID" 
      });
    }

    const classData = await Class.findById(classId)
      .populate("ownerId", "name email profileImage") // ✅ ADD profileImage
      .populate("members.userId", "name email profileImage"); // ✅ ADD profileImage

    if (!classData) {
      return res.status(404).json({ 
        success: false,
        message: "Class not found" 
      });
    }

    // Check if user is teacher
    const isTeacher = classData.ownerId._id.toString() === userId;
    if (!isTeacher) {
      return res.status(403).json({ 
        success: false,
        message: "Only teachers can view student management" 
      });
    }

    // ✅ FIXED: Format teachers data with profile images
    const teachers = [{
      _id: classData.ownerId._id,
      name: classData.ownerId.name,
      email: classData.ownerId.email,
      profileImage: classData.ownerId.profileImage, // ✅ ADDED
      role: "teacher",
      joinedAt: classData.createdAt
    }];

    // ✅ FIXED: Format students data with profile images
    const students = classData.members
      .filter(member => member.role === "student")
      .map(member => ({
        _id: member.userId._id,
        name: member.userId.name,
        email: member.userId.email,
        profileImage: member.userId.profileImage, // ✅ ADDED
        role: member.role,
        joinedAt: member.joinedAt,
        isMuted: member.isMuted || false
      }));

    console.log('👥 People data fetched:', {
      teachers: teachers.length,
      students: students.length,
      teachersWithImages: teachers.filter(t => t.profileImage).length,
      studentsWithImages: students.filter(s => s.profileImage).length
    });

    res.json({
      success: true,
      data: {
        teachers,
        students
      }
    });
  } catch (err) {
    console.error("❌ Get students error:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch students",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ✅ REMOVE STUDENT FROM CLASS
router.delete("/:classId/students/:studentId", authMiddleware, async (req, res) => {
  try {
    const { classId, studentId } = req.params;
    const teacherId = req.user.id;

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(classId) || !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid class or student ID" 
      });
    }

    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ 
        success: false,
        message: "Class not found" 
      });
    }

    // Check if user is the teacher
    if (classData.ownerId.toString() !== teacherId) {
      return res.status(403).json({ 
        success: false,
        message: "Only the teacher can remove students" 
      });
    }

    // Check if trying to remove self
    if (studentId === teacherId) {
      return res.status(400).json({ 
        success: false,
        message: "Cannot remove yourself from the class" 
      });
    }

    // Find and remove student
    const studentIndex = classData.members.findIndex(
      member => member.userId.toString() === studentId && member.role === "student"
    );

    if (studentIndex === -1) {
      return res.status(404).json({ 
        success: false,
        message: "Student not found in this class" 
      });
    }

    // Remove student from members array
    classData.members.splice(studentIndex, 1);
    await classData.save();

    res.json({
      success: true,
      message: "Student removed successfully"
    });
  } catch (err) {
    console.error("❌ Remove student error:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to remove student",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ✅ TOGGLE MUTE STUDENT
router.patch("/:classId/students/:studentId/mute", authMiddleware, async (req, res) => {
  try {
    const { classId, studentId } = req.params;
    const teacherId = req.user.id;

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(classId) || !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid class or student ID" 
      });
    }

    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ 
        success: false,
        message: "Class not found" 
      });
    }

    // Check if user is the teacher
    if (classData.ownerId.toString() !== teacherId) {
      return res.status(403).json({ 
        success: false,
        message: "Only the teacher can mute students" 
      });
    }

    // Find student
    const studentMember = classData.members.find(
      member => member.userId.toString() === studentId && member.role === "student"
    );

    if (!studentMember) {
      return res.status(404).json({ 
        success: false,
        message: "Student not found in this class" 
      });
    }

    // Toggle mute status
    studentMember.isMuted = !studentMember.isMuted;
    await classData.save();

    res.json({
      success: true,
      message: `Student ${studentMember.isMuted ? 'muted' : 'unmuted'} successfully`,
      data: {
        isMuted: studentMember.isMuted
      }
    });
  } catch (err) {
    console.error("❌ Mute student error:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to update student mute status",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ✅ EMAIL STUDENTS (Bulk action)
router.post("/:classId/email-students", authMiddleware, async (req, res) => {
  try {
    const { classId } = req.params;
    const { studentIds, subject, message } = req.body;
    const teacherId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid class ID" 
      });
    }

    const classData = await Class.findById(classId).populate("members.userId", "email name");
    if (!classData) {
      return res.status(404).json({ 
        success: false,
        message: "Class not found" 
      });
    }

    // Check if user is the teacher
    if (classData.ownerId.toString() !== teacherId) {
      return res.status(403).json({ 
        success: false,
        message: "Only the teacher can email students" 
      });
    }

    // Get student emails
    let studentsToEmail = classData.members.filter(member => member.role === "student");
    
    // If specific student IDs provided, filter to those students
    if (studentIds && studentIds.length > 0) {
      studentsToEmail = studentsToEmail.filter(member => 
        studentIds.includes(member.userId._id.toString())
      );
    }

    const studentEmails = studentsToEmail.map(member => member.userId.email);

    // In a real application, you would integrate with an email service here
    console.log(`📧 Email prepared for ${studentEmails.length} students:`);
    console.log(`Subject: ${subject}`);
    console.log(`Message: ${message}`);

    res.json({
      success: true,
      message: `Email prepared for ${studentEmails.length} students`,
      data: {
        recipients: studentEmails.length,
        subject,
        message
      }
    });
  } catch (err) {
    console.error("❌ Email students error:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to send emails",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;