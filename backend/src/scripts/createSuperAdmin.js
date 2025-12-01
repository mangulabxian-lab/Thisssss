const mongoose = require('mongoose');
const Admin = require('../models/Admin');
require('dotenv').config();

const createSuperAdmin = async () => {
  try {
    // Connect to your MongoDB database
    await mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/elearning');
    console.log('✅ Connected to MongoDB');
    
    // Check if super admin already exists
    const existingAdmin = await Admin.findOne({ email: 'superadmin@system.com' });
    
    if (existingAdmin) {
      console.log('⚠️ Super admin already exists!');
      console.log('📧 Email:', existingAdmin.email);
      console.log('👤 Name:', existingAdmin.name);
      console.log('🎭 Role:', existingAdmin.role);
      process.exit(0);
    }
    
    // Create super admin
    const superAdmin = new Admin({
      email: 'superadmin@system.com',
      password: 'Admin@123', // Will be hashed by pre-save middleware
      name: 'System Super Admin',
      role: 'superadmin',
      permissions: [
        { module: '*', actions: ['*'] }
      ],
      isActive: true
    });
    
    await superAdmin.save();
    
    console.log('✅ Super admin created successfully!');
    console.log('📧 Email:', superAdmin.email);
    console.log('🔑 Password: Admin@123');
    console.log('⚠️ Please change the password immediately!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating super admin:', error);
    process.exit(1);
  }
};

createSuperAdmin();