const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  citizen_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['CALLING', 'PROCESSING', 'DRAFT_READY', 'CONFIRMED', 'BLOCKED', 'NO_ANSWER', 'FAILED'], default: 'CALLING' },
  call_id: String,
  provider: String,
  transcript: String,
  missing_fields: [String],
  confirmed_complaint_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint' },
  draft: { type: mongoose.Schema.Types.Mixed, default: {} },
  safety: mongoose.Schema.Types.Mixed,
  error: String,
}, { timestamps: true });
module.exports = mongoose.model('VoiceIntakeSession', schema);
