const mongoose = require('mongoose');
module.exports = mongoose.model('TrustSource', new mongoose.Schema({ publisher: { type: String, required: true }, official_url: { type: String, required: true }, topics: [String], valid_from: Date, valid_until: Date, retrieved_at: Date, digest: String, active: { type: Boolean, default: true } }, { timestamps: true }));
