const VoiceIntakeSession = require('../models/VoiceIntakeSession');
const Complaint = require('../models/Complaint');
const { createCaseOfficer } = require('../services/complaintAgent');

const normalizePhone = phone => { const d = String(phone || '').replace(/\D/g, ''); return d.length === 10 ? `+91${d}` : d.startsWith('91') ? `+${d}` : `+${d}`; };

exports.start = async (req, res) => {
  try {
    const safety = req.body?.safety || null;
    if (!safety || safety.canCall !== true) return res.status(400).json({ error: safety?.reason || 'Location safety check is required before the call.' });
    const session = await VoiceIntakeSession.create({ citizen_id: req.user._id, safety });
    const token = process.env.VAPI_SERVER_PRIVATE_KEY;
    let callId = null;
    if (token) {
      const response = await fetch('https://api.vapi.ai/call', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ assistantId: process.env.VAPI_ASSISTANT_ID, type: 'outboundPhoneCall', phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID, customer: { number: normalizePhone(req.user.mobile) }, assistantOverrides: { firstMessage: 'Hello Citizen. This is NagarSetu. Tell me what civic issue needs attention, where it is, and how urgent it feels. I will prepare a complaint for your review.' } }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Voice provider rejected the call');
      callId = data.id || data.callId;
    }
    session.call_id = callId; await session.save();
    res.status(202).json({ success: true, sessionId: session._id, callId, status: session.status, provider: token ? 'vapi' : 'demo' });
  } catch (error) { res.status(502).json({ error: error.message || 'Could not start voice intake' }); }
};

exports.result = async (req, res) => {
  const session = await VoiceIntakeSession.findById(req.params.id);
  if (!session) return res.status(404).json({ error: 'Intake session not found' });
  session.draft = req.body?.draft || req.body || {}; session.status = 'DRAFT_READY'; await session.save();
  res.json({ success: true, session });
};

exports.confirm = async (req, res) => {
  const session = await VoiceIntakeSession.findOne({ _id: req.params.id, citizen_id: req.user._id });
  if (!session) return res.status(404).json({ error: 'Intake session not found' });
  if (session.status === 'CONFIRMED' && session.draft?.complaint_id) return res.json({ success: true, complaint_id: session.draft.complaint_id });
  const draft = { ...(session.draft || {}), ...(req.body?.edits || {}) };
  if (!draft.complaint_text || !draft.category) return res.status(400).json({ error: 'The voice draft needs an issue and category before confirmation.' });
  const complaint = await Complaint.create({ complaint_id: `KCP-${Date.now()}`, citizen_id: req.user._id, citizen_name: req.user.name, citizen_mobile: req.user.mobile, complaint_text: draft.complaint_text, category: draft.category, module: draft.module || 'DEVELOPMENT', location: draft.location || {}, source: 'call', status: 'FILED', timeline: [{ event: 'Complaint filed by voice', actor_id: req.user._id, actor_name: req.user.name, actor_role: 'citizen', note: 'Confirmed from NagarSetu voice intake' }] });
  await createCaseOfficer(complaint, { source: 'voice' }); session.status = 'CONFIRMED'; session.draft = { ...draft, complaint_id: complaint.complaint_id }; await session.save();
  res.status(201).json({ success: true, complaint });
};
