const { buildRoleFirstMessage, buildRoleSystemPrompt, normalizePhone } = require('./callScriptService');
const { canonicalCivicLocation } = require('../config/civicLocation');

const CATEGORIES = new Set(['BLOCKED_DRAIN', 'BLOCKED_SEWAGE', 'POTHOLE', 'MANHOLE_ISSUE', 'ROAD_DAMAGE', 'FLOODING', 'WATER_LOGGING', 'STREETLIGHT', 'ELECTRICITY', 'GARBAGE_NOT_COLLECTED', 'BIN_OVERFLOW', 'ILLEGAL_DUMPING', 'WASTE_ACCUMULATION', 'MISSED_COLLECTION', 'OTHER']);
const INTAKE_END_PHRASE = 'Thank you for filing a complaint with NagarSetu.';

function validateDraft(input = {}) {
  const category = CATEGORIES.has(String(input.category || '').toUpperCase()) ? String(input.category).toUpperCase() : '';
  const address = input.location?.address || input.address || '';
  const draft = {
    complaint_text: String(input.complaint_text || input.issue || '').trim(),
    category,
    location: { ...(input.location || {}), address: String(address).trim(), ward: String(input.location?.ward || input.ward || '').trim() },
    urgency: String(input.urgency || 'medium').toLowerCase(),
    language: String(input.language || 'English'),
    evidence_available: Boolean(input.evidence_available),
    confidence: Math.max(0, Math.min(1, Number(input.confidence ?? 0.5))),
  };
  const missingFields = [];
  if (!draft.complaint_text) missingFields.push('complaint_text');
  if (!draft.category) missingFields.push('category');
  if (!draft.location.address) missingFields.push('location.address');
  return { valid: missingFields.length === 0, draft, missingFields };
}

function canonicalizeDraftLocation(checked) {
  if (!checked || typeof checked !== 'object') return checked;
  return { ...checked, draft: { ...(checked.draft || {}), location: canonicalCivicLocation() } };
}

function buildVoiceIntakePayload({ phone, assistantId, phoneNumberId, callbackUrl, metadata = {} }) {
  const intakePurpose = 'Tell me only three things: what happened, where it happened, and the category.';
  const firstMessage = buildRoleFirstMessage({ designation: 'Citizen', purpose: intakePurpose });
  const intakePrompt = 'Collect exactly three structured civic complaint fields and nothing else. Ask one short question at a time: first what happened, then where it happened, then the category. Do not reveal that Sanjivani University is the fixed pilot location before the caller answers the location question. If the caller gives any location other than Sanjivani University, say exactly: "We cannot use any other location because we are currently at Sanjivani University and your real-time location is being fetched using Radar." Then ask the caller to confirm Sanjivani University as the location, and do not mark the location field complete until they confirm it. If the caller gives or confirms Sanjivani University, continue directly to the category question without asking for an address, landmark, ward, or other location detail. Do not ask for urgency, ward, evidence, phone number, identity, timing, photos, language, contact details, or any other information. If the caller volunteers extra details, do not add them to structured output. Do not submit the complaint during the call; return only complaint_text, address, and category for citizen review. After your third answer, once all three fields are captured, do not ask a follow-up question. Say exactly "Thank you for filing a complaint with NagarSetu." once, then use the end-call action immediately.';
  const payload = {
    assistantId,
    phoneNumberId,
    type: 'outboundPhoneCall',
    customer: { number: normalizePhone(phone) },
    metadata,
    assistantOverrides: {
      firstMessage,
      endCallMessage: INTAKE_END_PHRASE,
      endCallPhrases: [INTAKE_END_PHRASE],
      model: { provider: process.env.VAPI_MODEL_PROVIDER || 'openai', model: process.env.VAPI_MODEL || 'gpt-4.1', messages: [{ role: 'system', content: buildRoleSystemPrompt({ designation: 'Citizen', purpose: intakePrompt }) }] },
      analysisPlan: {
        structuredDataPlan: {
          enabled: true,
          schema: {
            type: 'object',
            properties: {
              complaint_text: { type: 'string', description: 'What happened, in the citizen\'s own words.' }, category: { type: 'string', enum: [...CATEGORIES], description: 'The civic issue category.' }, address: { type: 'string', description: 'The location, address, or landmark.' },
            },
            required: ['complaint_text', 'category', 'address'],
            additionalProperties: false,
          },
        },
      },
    },
  };
  if (callbackUrl) payload.metadata = { ...(payload.metadata || {}), callbackUrl };
  return payload;
}

function extractDraftFromCall(call = {}) {
  const source = call.artifact?.structuredOutputs?.voice_intake || call.artifact?.structuredData || call.analysis?.structuredData || call.structuredData || {};
  return validateDraft(source).draft;
}

async function startVoiceIntake({ citizen, safeLocation, fetchImpl = fetch, callbackUrl, metadata = {} }) {
  if (safeLocation?.canCall !== true) return { blocked: true, status: 'BLOCKED', reason: safeLocation?.reason || 'Radar safety verification is required' };
  const token = process.env.VAPI_SERVER_PRIVATE_KEY;
  if (!token) throw new Error('VAPI private key is not configured');
  const target = process.env.DEMO_MODE === 'true' && process.env.DEMO_CALL_TARGET ? process.env.DEMO_CALL_TARGET : citizen.mobile;
  const payload = buildVoiceIntakePayload({ phone: target, assistantId: process.env.VAPI_ASSISTANT_ID, phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID, callbackUrl, metadata });
  const response = await fetchImpl('https://api.vapi.ai/call', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `VAPI rejected the call (${response.status})`);
  return { blocked: false, status: data.status || 'queued', callId: data.id || data.callId, provider: 'vapi' };
}

async function pollVoiceIntake(callId, fetchImpl = fetch) {
  const response = await fetchImpl(`https://api.vapi.ai/call/${callId}`, { headers: { Authorization: `Bearer ${process.env.VAPI_SERVER_PRIVATE_KEY}` } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Unable to read call (${response.status})`);
  return { status: data.status, endedReason: data.endedReason, draft: extractDraftFromCall(data), transcript: data.artifact?.transcript || data.transcript || '' };
}

module.exports = { CATEGORIES, INTAKE_END_PHRASE, validateDraft, canonicalizeDraftLocation, buildVoiceIntakePayload, extractDraftFromCall, startVoiceIntake, pollVoiceIntake };
