const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  citizen_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['CALLING', 'DRAFT_READY', 'CONFIRMED', 'FAILED'], default: 'CALLING' },
  call_id: String,
  draft: { type: mongoose.Schema.Types.Mixed, default: {} },
  safety: mongoose.Schema.Types.Mixed,
  error: String,
}, { timestamps: true });
module.exports = mongoose.model('VoiceIntakeSession', schema);
