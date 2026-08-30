const { buildRoleFirstMessage, buildRoleSystemPrompt, normalizePhone } = require('./callScriptService');

const CATEGORIES = new Set(['BLOCKED_DRAIN', 'BLOCKED_SEWAGE', 'POTHOLE', 'MANHOLE_ISSUE', 'ROAD_DAMAGE', 'FLOODING', 'WATER_LOGGING', 'STREETLIGHT', 'ELECTRICITY', 'GARBAGE_NOT_COLLECTED', 'BIN_OVERFLOW', 'ILLEGAL_DUMPING', 'WASTE_ACCUMULATION', 'MISSED_COLLECTION', 'OTHER']);

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

function buildVoiceIntakePayload({ phone, assistantId, phoneNumberId, callbackUrl, metadata = {} }) {
  const intakePurpose = 'Tell me only three things: what happened, where it happened, and the category. I will prepare a complaint for your review before anything is submitted.';
  const firstMessage = buildRoleFirstMessage({ designation: 'Citizen', purpose: intakePurpose });
  const payload = {
    assistantId,
    phoneNumberId,
    type: 'outboundPhoneCall',
    customer: { number: normalizePhone(phone) },
    metadata,
    assistantOverrides: {
      firstMessage,
      model: { provider: process.env.VAPI_MODEL_PROVIDER || 'openai', model: process.env.VAPI_MODEL || 'gpt-4.1', messages: [{ role: 'system', content: buildRoleSystemPrompt({ designation: 'Citizen', purpose: 'Collect only three structured civic complaint fields. Ask exactly for what happened, the location or landmark, and the category. Ask one short question at a time. Do not ask for urgency, ward, evidence, phone number, identity, timing, photos, or any other information. If the caller volunteers extra details, do not add them to structured output. Do not submit the complaint during the call; return only these three fields for citizen review.' }) }] },
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

module.exports = { CATEGORIES, validateDraft, buildVoiceIntakePayload, extractDraftFromCall, startVoiceIntake, pollVoiceIntake };
