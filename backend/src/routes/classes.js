// routes/classes.js - COMPLETELY FIXED WITH ALL MISSING ROUTES
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Class = require("../models/Class");
const authMiddleware = require("../middleware/authMiddleware");
const { checkClassAccess, checkTeacherAccess } = require("../middleware/classAuth");

// ✅ Create class - ANYONE can create
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    const ownerId = req.user.id;

    if (!name) {
      return res.status(400).json({ 
        success: false,
        message: "Class name is required" 
      });
    }

    // Generate unique class code
    const generateCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    let code;
    let existingClass;
    
    // Ensure unique code
    do {
      code = generateCode();
      existingClass = await Class.findOne({ code });
    } while (existingClass);

    const newClass = await Class.create({ 
      name, 
      code, 
      ownerId,
      members: [{ userId: ownerId, role: "teacher" }]
    });

    res.status(201).json({
      success: true,
      message: "Class created successfully",
      data: newClass
    });
  } catch (err) {
    console.error("❌ Create class error:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to create class",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ✅ Join class - ANYONE can join
router.post("/join", authMiddleware, async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user.id;

    if (!code) {
      return res.status(400).json({ 
        success: false,
        message: "Class code is required" 
      });
    }

    const classData = await Class.findOne({ code });
    if (!classData) {
      return res.status(404).json({ 
        success: false,
        message: "Class not found" 
      });
    }

    // Check if already member
    const isMember = classData.members.some(m => m.userId.toString() === userId);
    if (isMember) {
      return res.status(400).json({ 
        success: false,
        message: "You have already joined this class" 
      });
    }

    // Add as student member
    classData.members.push({ userId, role: "student" });
    await classData.save();

    res.json({ 
      success: true,
      message: "Joined class successfully", 
      data: classData 
    });
  } catch (err) {
    console.error("❌ Join class error:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to join class",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ✅ Get user's classes (both owned and joined) - EXCLUDE ARCHIVED - FIXED VERSION
router.get("/my-classes", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`📚 Getting classes for user ${userId}`);

    const classes = await Class.find({
      $or: [
        { ownerId: userId },
        { "members.userId": userId }
      ],
      isArchived: false
    })
    .populate("ownerId", "name email profileImage") // ✅ ADD PROFILE IMAGE
    .populate("members.userId", "name email profileImage") // ✅ ADD PROFILE IMAGE
    .sort({ createdAt: -1 });

    console.log(`✅ Found ${classes.length} classes`);

    // ✅ FIX: Add null checking for populated fields
    const classesWithRole = classes.map(classData => {
      // Check if ownerId is populated properly - ADD NULL CHECK
      const isOwner = classData.ownerId && 
                     classData.ownerId._id && 
                     classData.ownerId._id.toString() === userId;
      
      // Find member with null checking - ADD NULL CHECK
      let member = null;
      if (classData.members && Array.isArray(classData.members)) {
        member = classData.members.find(m => 
          m.userId && m.userId._id && m.userId._id.toString() === userId
        );
      }

      return {
        _id: classData._id,
        name: classData.name,
        code: classData.code,
        ownerId: classData.ownerId,
        members: classData.members,
        createdAt: classData.createdAt,
        updatedAt: classData.updatedAt,
        isArchived: classData.isArchived,
        userRole: isOwner ? "teacher" : (member?.role || "student")
      };
    });

    // ✅ FIX: Filter out any classes with null owner (corrupted data)
    const validClasses = classesWithRole.filter(classData => 
      classData.ownerId && classData.ownerId._id
    );

    console.log(`✅ Returning ${validClasses.length} valid classes`);

    res.json({
      success: true,
      data: validClasses
    });
  } catch (err) {
    console.error("❌ Get my classes error:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch classes",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ✅ Get class details with user role
router.get("/:classId", authMiddleware, checkClassAccess, async (req, res) => {
  try {
    const classData = await Class.findById(req.params.classId)
      .populate("ownerId", "name email profileImage") // ✅ ADD PROFILE IMAGE
      .populate("members.userId", "name email profileImage") // ✅ ADD PROFILE IMAGE
      .populate("exams");

    res.json({
      success: true,
      data: {
        ...classData._doc,
        userRole: req.user.classRole
      }
    });
  } catch (err) {
    console.error("❌ Get class details error:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch class details",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ✅ GET CLASS MEMBERS WITH PROFILE IMAGES - UPDATED
router.get("/:classId/members", authMiddleware, checkClassAccess, async (req, res) => {
  try {
    const classData = await Class.findById(req.params.classId)
      .populate("ownerId", "name email profileImage") // ✅ ADD PROFILE IMAGE
      .populate("members.userId", "name email profileImage"); // ✅ ADD PROFILE IMAGE

    const members = classData.members.map(member => ({
      ...member.userId._doc,
      role: member.role,
      joinedAt: member.joinedAt
    }));

    // Add owner as teacher
    const ownerAsMember = {
      ...classData.ownerId._doc,
      role: "teacher",
      joinedAt: classData.createdAt
    };

    // Combine owner and members, remove duplicates
    const allMembers = [ownerAsMember, ...members.filter(m => 
      m._id.toString() !== classData.ownerId._id.toString()
    )];

    res.json({
      success: true,
      data: allMembers
    });
  } catch (err) {
    console.error("❌ Get class members error:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch class members",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ✅ UNENROLL FROM CLASS
router.delete("/:classId/unenroll", authMiddleware, async (req, res) => {
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

    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ 
        success: false,
        message: "Class not found" 
      });
    }

    // Check if user is the owner
    if (classData.ownerId.toString() === userId) {
      return res.status(400).json({ 
        success: false,
        message: "Teachers cannot unenroll from their own class" 
      });
    }

    // Check if user is actually enrolled
    const isEnrolled = classData.members.some(member => member.userId.toString() === userId);
    if (!isEnrolled) {
      return res.status(400).json({ 
        success: false,
        message: "You are not enrolled in this class" 
      });
    }

    // Remove user from members array
    classData.members = classData.members.filter(
      member => member.userId.toString() !== userId
    );

    await classData.save();

    res.json({
      success: true,
      message: "Successfully unenrolled from class"
    });
  } catch (err) {
    console.error("❌ Unenroll error:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to unenroll from class",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ✅ ARCHIVE CLASS (Teacher only)
router.put("/:classId/archive", authMiddleware, async (req, res) => {
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

    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ 
        success: false,
        message: "Class not found" 
      });
    }

    // Check if user is the teacher/owner
    if (classData.ownerId.toString() !== userId) {
      return res.status(403).json({ 
        success: false,
        message: "Only the teacher can archive this class" 
      });
    }

    // Archive the class
    classData.isArchived = true;
    classData.archivedAt = new Date();
    await classData.save();

    res.json({
      success: true,
      message: "Class archived successfully",
      data: classData
    });
  } catch (err) {
    console.error("❌ Archive error:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to archive class",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ✅ RESTORE CLASS (Teacher only)
router.put("/:classId/restore", authMiddleware, async (req, res) => {
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

    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ 
        success: false,
        message: "Class not found" 
      });
    }

    // Check if user is the teacher/owner
    if (classData.ownerId.toString() !== userId) {
      return res.status(403).json({ 
        success: false,
        message: "Only the teacher can restore this class" 
      });
    }

    // Restore the class
    classData.isArchived = false;
    classData.archivedAt = null;
    await classData.save();

    res.json({
      success: true,
      message: "Class restored successfully",
      data: classData
    });
  } catch (err) {
    console.error("❌ Restore error:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to restore class",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ✅ GET ARCHIVED CLASSES (FIXED VERSION)
router.get("/archived", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Find archived classes where user is either owner or member
    const archivedClasses = await Class.find({
      $or: [
        { ownerId: userId, isArchived: true },
        { "members.userId": userId, isArchived: true }
      ]
    })
    .populate("ownerId", "name email profileImage") // ✅ ADD PROFILE IMAGE
    .populate("members.userId", "name email profileImage") // ✅ ADD PROFILE IMAGE
    .sort({ archivedAt: -1 });

    res.json({
      success: true,
      data: archivedClasses
    });
  } catch (err) {
    console.error("❌ Fetch archived error:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch archived classes",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ✅ GET ITEMS TO REVIEW COUNT (Teacher only) - NEW ROUTE
router.get("/items-to-review", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Mock data for now - replace with actual logic later
    const reviewCount = 0; // Default to 0

    res.json({
      success: true,
      count: reviewCount
    });
  } catch (err) {
    console.error("❌ Fetch review count error:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch review count",
      count: 0
    });
  }
});

module.exports = router;