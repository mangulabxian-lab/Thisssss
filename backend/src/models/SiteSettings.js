const mongoose = require('mongoose');

const SiteSettingsSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  value: mongoose.Schema.Types.Mixed,
  category: {
    type: String,
    default: 'general'
  },
  description: String,
  isPublic: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('SiteSettings', SiteSettingsSchema);