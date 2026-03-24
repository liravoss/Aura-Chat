const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  avatarUrl: { type: String },
  language: { type: String, required: true }, // 'en', 'hi', etc.
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
