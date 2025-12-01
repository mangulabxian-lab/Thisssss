const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const Admin = require('../models/Admin');
const { adminAuth } = require('../middleware/adminAuth');
const auditLog = require('../middleware/auditLog');

// Admin Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email, isActive: true });
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    // If 2FA is enabled, require token
    if (admin.twoFactorEnabled) {
      return res.json({
        success: true,
        requires2FA: true,
        message: '2FA token required'
      });
    }

    // Generate token
    const token = jwt.sign(
      { adminId: admin._id, role: admin.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '8h' }
    );

    res.json({
      success: true,
      token,
      admin: {
        id: admin._id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        permissions: admin.permissions
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Verify 2FA Token
router.post('/verify-2fa', async (req, res) => {
  try {
    const { email, token } = req.body;

    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const verified = speakeasy.totp.verify({
      secret: admin.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 1
    });

    if (!verified) {
      return res.status(401).json({
        success: false,
        message: 'Invalid 2FA token'
      });
    }

    // Generate final token
    const authToken = jwt.sign(
      { adminId: admin._id, role: admin.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '8h' }
    );

    res.json({
      success: true,
      token: authToken,
      admin: {
        id: admin._id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        permissions: admin.permissions
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Setup 2FA
router.post('/setup-2fa', adminAuth, async (req, res) => {
  try {
    const admin = req.admin;
    
    const secret = speakeasy.generateSecret({
      name: `E-Learning Admin (${admin.email})`
    });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    admin.twoFactorSecret = secret.base32;
    await admin.save();

    res.json({
      success: true,
      secret: secret.base32,
      qrCodeUrl,
      otpauth_url: secret.otpauth_url
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Enable/Disable 2FA
router.post('/toggle-2fa', adminAuth, async (req, res) => {
  try {
    const { token, enable } = req.body;
    const admin = req.admin;

    if (enable) {
      const verified = speakeasy.totp.verify({
        secret: admin.twoFactorSecret,
        encoding: 'base32',
        token,
        window: 1
      });

      if (!verified) {
        return res.status(400).json({
          success: false,
          message: 'Invalid token'
        });
      }

      admin.twoFactorEnabled = true;
    } else {
      admin.twoFactorEnabled = false;
    }

    await admin.save();

    res.json({
      success: true,
      message: `2FA ${enable ? 'enabled' : 'disabled'} successfully`,
      twoFactorEnabled: admin.twoFactorEnabled
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get current admin profile
router.get('/profile', adminAuth, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id)
      .select('-password -twoFactorSecret');

    res.json({
      success: true,
      admin
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update profile
router.put('/profile', adminAuth, async (req, res) => {
  try {
    const { name, currentPassword, newPassword } = req.body;
    const admin = req.admin;

    if (name) admin.name = name;

    if (currentPassword && newPassword) {
      const isMatch = await admin.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }
      admin.password = newPassword;
    }

    await admin.save();

    const adminData = await Admin.findById(admin._id)
      .select('-password -twoFactorSecret');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      admin: adminData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Logout (client-side only, just returns success)
router.post('/logout', adminAuth, (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

module.exports = router;