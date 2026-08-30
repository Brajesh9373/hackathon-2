const Complaint = require('../models/Complaint'); const FactCheckCase = require('../models/FactCheckCase'); const ClaimCluster = require('../models/ClaimCluster'); const { assessIntegrity } = require('../services/misinformationService'); const { listTrustedSources } = require('../services/trustedSourceService'); const { appendLedgerEvent } = require('../services/recoveryLedgerService');
exports.assess = async (req, res) => { const result = assessIntegrity(req.body || {}); res.json({ success: true, assessment: result }); };
exports.queue = async (req, res) => { const cases = await FactCheckCase.find({ status: 'PENDING' }).sort('-createdAt').limit(100).lean(); const sources = await listTrustedSources(); res.json({ success: true, cases, sources }); };
exports.resolve = async (req, res) => { const item = await FactCheckCase.findById(req.params.id); if (!item) return res.status(404).json({ error: 'Fact check case not found' }); const allowed = ['SUPPORTED', 'CONTRADICTED', 'UNVERIFIED', 'DISMISSED']; if (!allowed.includes(req.body?.decision)) return res.status(400).json({ error: 'Invalid fact check decision' }); item.status = req.body.decision; item.reviewer_id = req.user._id; item.reviewer_reason = String(req.body.reason || '').trim(); item.resolved_at = new Date(); await item.save(); appendLedgerEvent({ aggregateType: 'FactCheckCase', aggregateId: item._id, eventType: 'TRUTH_REVIEW_RESOLVED', actor: req.user.name || 'admin', payload: item.toObject() }); res.json({ success: true, case: item }); };
exports.cluster = async (req, res) => {
  const result = assessIntegrity(req.body || {});
  const cluster = await ClaimCluster.findOneAndUpdate(
    { fingerprint: result.fingerprint },
    { $set: { normalized_text: String(req.body?.text || '').toLowerCase().trim(), last_seen: new Date() }, $setOnInsert: { first_seen: new Date() }, $inc: { citizen_count: 1 } },
    { upsert: true, new: true }
  );
  let factCheckCase = null;
  if (result.status === 'REVIEW_REQUIRED') {
    factCheckCase = await FactCheckCase.findOneAndUpdate(
      { claim_cluster_id: cluster._id, status: 'PENDING' },
      { $set: { claim: String(req.body?.text || '').trim(), signals: result.signals } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  res.json({ success: true, cluster, assessment: result, factCheckCase });
};
