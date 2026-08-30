const VoiceIntakeSession = require('../models/VoiceIntakeSession');
const Complaint = require('../models/Complaint');
const { createCaseOfficer } = require('../services/complaintAgent');
const { startVoiceIntake, pollVoiceIntake, validateDraft } = require('../services/voiceIntakeService');
const { assessIntegrity, fingerprintClaim } = require('../services/misinformationService');
const { appendLedgerEvent } = require('../services/recoveryLedgerService');
const { calculatePriority, getModuleFromCategory } = require('../services/priorityEngine');
const { evaluateComplaint } = require('../services/priorityIntegration');

function complaintId() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `KCP-${date}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
}

function persistPriority(complaint, result) {
  const priority = result?.priority || {};
  const breakdown = priority.breakdown || {};
  if (!Number.isFinite(Number(priority.score))) return false;
  complaint.priority_score = Number(priority.score);
  complaint.priority_breakdown = {
    severity_pct: Number(breakdown.urgency || 0),
    safety_pct: Number(breakdown.risk || 0),
    impact_pct: Number(breakdown.impact || 0),
    location_pct: Number(breakdown.context || 0),
    age_pct: Number(breakdown.time || 0),
    repeat_pct: 0,
    weather_pct: 0,
  };
  complaint.priority_reason = result.explanation?.summary || `${priority.band || 'MEDIUM'} priority issue (${priority.score}/100).`;
  return true;
}

exports.start = async (req, res) => {
  let session;
  try {
    const safety = req.body?.safety || null;
    if (safety?.canCall !== true) return res.status(400).json({ error: safety?.reason || 'Location safety check is required before the call.' });
    session = await VoiceIntakeSession.create({ citizen_id: req.user._id, safety });
    const callbackBase = String(process.env.PUBLIC_CALLBACK_URL || '').replace(/\/$/, '');
    const callbackPath = callbackBase ? `${callbackBase}/api/voice-intake/${session._id}/result` : undefined;
    const callbackUrl = callbackPath && process.env.CIVIC_CALLBACK_TOKEN
      ? `${callbackPath}?token=${encodeURIComponent(process.env.CIVIC_CALLBACK_TOKEN)}`
      : callbackPath;
    const result = await startVoiceIntake({ citizen: req.user, safeLocation: safety, metadata: { voiceIntakeSessionId: String(session._id), purpose: 'complaint_intake' }, callbackUrl });
    session.call_id = result.callId;
    session.provider = result.provider;
    session.status = result.status === 'BLOCKED' ? 'BLOCKED' : 'CALLING';
    await session.save();
    res.status(202).json({ success: true, sessionId: session._id, callId: result.callId, status: session.status, provider: result.provider });
  } catch (error) {
    if (session) {
      session.status = 'FAILED';
      session.error = error.message || 'Could not start voice intake';
      await session.save().catch(() => null);
    }
    res.status(502).json({ error: error.message || 'Could not start voice intake' });
  }
};

exports.result = async (req, res) => {
  if (process.env.CIVIC_CALLBACK_TOKEN && (req.headers['x-civic-callback-token'] || req.query.token) !== process.env.CIVIC_CALLBACK_TOKEN) return res.status(401).json({ error: 'Invalid callback token' });
  const session = await VoiceIntakeSession.findById(req.params.id);
  if (!session) return res.status(404).json({ error: 'Intake session not found' });
  const checked = validateDraft(req.body?.draft || req.body?.message?.analysis?.structuredData || req.body || {});
  session.draft = checked.draft;
  session.missing_fields = checked.missingFields;
  session.transcript = req.body?.transcript || req.body?.message?.artifact?.transcript || '';
  session.status = 'DRAFT_READY';
  await session.save();
  res.json({ success: true, session });
};

exports.get = async (req, res) => {
  const session = await VoiceIntakeSession.findOne({ _id: req.params.id, citizen_id: req.user._id }).lean();
  if (!session) return res.status(404).json({ error: 'Intake session not found' });
  res.json({ success: true, session });
};

exports.poll = async (req, res) => {
  const session = await VoiceIntakeSession.findOne({ _id: req.params.id, citizen_id: req.user._id });
  if (!session) return res.status(404).json({ error: 'Intake session not found' });
  if (!session.call_id || ['DRAFT_READY', 'CONFIRMED', 'FAILED', 'NO_ANSWER'].includes(session.status)) return res.json({ success: true, session });
  try {
    const result = await pollVoiceIntake(session.call_id);
    if (result.status === 'ended') {
      const checked = validateDraft(result.draft);
      session.draft = checked.draft;
      session.missing_fields = checked.missingFields;
      session.transcript = result.transcript;
      session.status = result.endedReason === 'customer-did-not-answer' ? 'NO_ANSWER' : 'DRAFT_READY';
    } else session.status = 'CALLING';
    await session.save();
    res.json({ success: true, session });
  } catch (error) { res.status(502).json({ error: error.message }); }
};

exports.confirm = async (req, res) => {
  const session = await VoiceIntakeSession.findOne({ _id: req.params.id, citizen_id: req.user._id });
  if (!session) return res.status(404).json({ error: 'Intake session not found' });
  if (session.status === 'CONFIRMED' && session.confirmed_complaint_id) return res.json({ success: true, complaint_id: session.draft?.complaint_id, complaint: await Complaint.findById(session.confirmed_complaint_id) });
  const checked = validateDraft({ ...(session.draft || {}), ...(req.body?.edits || {}) });
  if (!checked.valid) return res.status(400).json({ error: 'Complete the missing voice details before confirmation.', missingFields: checked.missingFields });
  const matching = await Complaint.find({
    'integrity_assessment.fingerprint': fingerprintClaim(checked.draft.complaint_text),
    createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) },
  }).select('citizen_id').lean();
  const integrity = assessIntegrity({
    text: checked.draft.complaint_text,
    matchingRecentClaims: matching.length,
    uniqueCitizens: new Set(matching.map(item => String(item.citizen_id))).size,
    minutes: 15,
  });
  const urgencyToSeverity = { low: 3, medium: 5, high: 8, critical: 10 };
  const complaint = new Complaint({
    complaint_id: complaintId(),
    citizen_id: req.user._id,
    citizen_name: req.user.name,
    citizen_mobile: req.user.mobile,
    complaint_text: checked.draft.complaint_text,
    category: checked.draft.category,
    module: getModuleFromCategory(checked.draft.category),
    location: checked.draft.location,
    impact_factors: { severity: urgencyToSeverity[checked.draft.urgency] || 5, safety_risk: 5, public_impact: 5, location_importance: 5, days_old: 0, repeat_count: 0, weather_risk: 5 },
    source: 'call',
    status: 'FILED',
    integrity_assessment: { status: integrity.status, confidence: integrity.confidence, fingerprint: integrity.fingerprint, signals: integrity.signals, routing_allowed: integrity.routingAllowed, amplification_allowed: integrity.amplificationAllowed, assessed_at: new Date() },
    timeline: [{ event: 'Complaint filed by voice', actor_id: req.user._id, actor_name: req.user.name, actor_role: 'citizen', note: 'Confirmed from NagarSetu voice intake' }],
    sla_deadline: new Date(Date.now() + 48 * 60 * 60 * 1000),
  });
  try {
    const priorityResult = await evaluateComplaint(complaint);
    if (!persistPriority(complaint, priorityResult)) throw new Error('Priority engine returned no score');
  } catch (error) {
    const fallback = calculatePriority(complaint);
    complaint.priority_score = fallback.priority_score;
    complaint.priority_breakdown = fallback.priority_breakdown;
    complaint.priority_reason = fallback.priority_reason;
  }
  await complaint.save();
  if (integrity.status === 'REVIEW_REQUIRED') {
    const FactCheckCase = require('../models/FactCheckCase');
    await FactCheckCase.create({ complaint_id: complaint._id, claim: complaint.complaint_text, status: 'PENDING', signals: integrity.signals });
  }
  appendLedgerEvent({ aggregateType: 'Complaint', aggregateId: complaint._id, eventType: 'COMPLAINT_FILED_BY_VOICE', actor: req.user.name || 'citizen', payload: complaint.toObject() });
  await createCaseOfficer(complaint, { source: 'voice' });
  session.status = 'CONFIRMED';
  session.confirmed_complaint_id = complaint._id;
  session.draft = { ...checked.draft, complaint_id: complaint.complaint_id };
  await session.save();
  res.status(201).json({ success: true, complaint });
};
