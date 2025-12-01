const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const adminAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      throw new Error();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const admin = await Admin.findOne({ 
      _id: decoded.adminId,
      isActive: true 
    });

    if (!admin) {
      throw new Error();
    }

    req.admin = admin;
    req.token = token;
    next();
  } catch (error) {
    res.status(401).json({ 
      success: false, 
      message: 'Please authenticate as admin' 
    });
  }
};

const requirePermission = (module, action) => {
  return (req, res, next) => {
    if (req.admin.role === 'superadmin') {
      return next();
    }

    const permission = req.admin.permissions.find(p => p.module === module);
    
    if (!permission || !permission.actions.includes(action)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

module.exports = { adminAuth, requirePermission };