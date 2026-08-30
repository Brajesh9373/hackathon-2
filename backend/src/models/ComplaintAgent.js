const mongoose = require('mongoose');

const agentEventSchema = new mongoose.Schema({
  type: { type: String, required: true },
  summary: { type: String, required: true },
  actor: String,
  metadata: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const complaintAgentSchema = new mongoose.Schema({
  complaint_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', required: true, unique: true, index: true },
  name: { type: String, default: 'NagarSetu Case Officer' },
  status: { type: String, enum: ['MONITORING', 'WAITING_APPROVAL', 'ESCALATED', 'RESOLVED'], default: 'MONITORING' },
  next_action: { type: String, default: 'Watch for a routing decision' },
  last_action: { type: String, default: 'Case officer created' },
  escalation_level: { type: Number, default: 0 },
  pending_approval: { type: Boolean, default: false },
  case_memory: { type: mongoose.Schema.Types.Mixed, default: {} },
  event_log: { type: [agentEventSchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('ComplaintAgent', complaintAgentSchema);
