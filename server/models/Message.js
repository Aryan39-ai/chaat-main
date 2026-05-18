const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  room: String,
  fromUsername: String,
  toUsername: String,
  type: { type: String, default: 'text' },
  text: String,
  imageData: String,
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', messageSchema);
