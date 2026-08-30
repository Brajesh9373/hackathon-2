const test = require('node:test');
const assert = require('node:assert/strict');
const { validateDraft, buildVoiceIntakePayload, extractDraftFromCall } = require('../src/services/voiceIntakeService');

test('validates and normalizes a complete structured voice complaint', () => {
  const result = validateDraft({ complaint_text: 'Large pothole near school gate', category: 'POTHOLE', address: 'School Road', ward: '7', urgency: 'high', language: 'English' });
  assert.equal(result.valid, true);
  assert.equal(result.draft.location.address, 'School Road');
  assert.deepEqual(result.missingFields, []);
});

test('keeps an incomplete voice result as a draft and lists missing fields', () => {
  const result = validateDraft({ complaint_text: 'Garbage everywhere' });
  assert.equal(result.valid, false);
  assert.deepEqual(result.missingFields, ['category', 'location.address']);
});

test('builds an outbound VAPI call with structured extraction and a citizen greeting', () => {
  const payload = buildVoiceIntakePayload({ phone: '8282909044', assistantId: 'assistant-1', phoneNumberId: 'phone-1', callbackUrl: 'https://example.test/callback' });
  assert.equal(payload.customer.number, '+918282909044');
  assert.match(payload.assistantOverrides.firstMessage, /^Hello Citizen\. This is NagarSetu\./);
  assert.equal(payload.assistantOverrides.model.provider, 'openai');
  assert.equal(payload.assistantOverrides.model.model, 'gpt-4.1');
  assert.equal(payload.assistantOverrides.analysisPlan.structuredDataPlan.enabled, true);
  assert.equal(payload.metadata.callbackUrl, 'https://example.test/callback');
});

test('extracts a structured draft from a completed VAPI call response', () => {
  const draft = extractDraftFromCall({ artifact: { structuredOutputs: { voice_intake: { complaint_text: 'Drain blocked', category: 'BLOCKED_DRAIN', address: 'Market Lane' } } } });
  assert.equal(draft.complaint_text, 'Drain blocked');
  assert.equal(draft.location.address, 'Market Lane');
});
