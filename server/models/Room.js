const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name:         { type: String, required: true, unique: true },
  isPrivate:    { type: Boolean, default: false },
  passwordHash: { type: String, default: '' },
  members:      [{ type: String }],
  admins:       [{ type: String }],
  description:  { type: String, default: '' },
  createdBy:    { type: String },
  createdAt:    { type: Date, default: Date.now }
});

module.exports = mongoose.model('Room', roomSchema);
