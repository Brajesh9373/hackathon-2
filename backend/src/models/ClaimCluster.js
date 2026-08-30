const mongoose = require('mongoose');
module.exports = mongoose.model('ClaimCluster', new mongoose.Schema({ fingerprint: { type: String, index: true }, normalized_text: String, complaint_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Complaint' }], citizen_count: Number, first_seen: Date, last_seen: Date, coordination_score: Number }, { timestamps: true }));
