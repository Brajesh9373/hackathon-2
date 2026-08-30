const { buildRoleFirstMessage, buildRoleSystemPrompt, normalizePhone } = require('./callScriptService');

async function startRoleCall({ designation, recipient, context, firstMessage, geofence, fetchImpl = fetch, callbackUrl, metadata = {} }) {
  if (geofence?.canCall !== true) return { status: 'BLOCKED', provider: 'radar', reason: geofence?.reason || 'Radar safety verification did not pass.' };
  const token = process.env.VAPI_SERVER_PRIVATE_KEY;
  if (!token) throw new Error('VAPI private key is not configured');
  const payload = {
    assistantId: process.env.VAPI_ASSISTANT_ID,
    type: 'outboundPhoneCall',
    phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
    customer: { number: normalizePhone(recipient) },
    metadata,
    assistantOverrides: {
      firstMessage: firstMessage || buildRoleFirstMessage({ designation, purpose: context }),
      model: {
        provider: process.env.VAPI_MODEL_PROVIDER || 'openai',
        model: process.env.VAPI_MODEL || 'gpt-4.1',
        messages: [{ role: 'system', content: buildRoleSystemPrompt({ designation, purpose: context }) }],
      },
    },
  };
  // VAPI accepts server URL configuration on the assistant or phone-number
  // resource, not on POST /call. Keep the URL in metadata for an installed
  // Make/VAPI webhook and let the app's authenticated poller close the loop
  // when the assistant resource has no server configured.
  if (callbackUrl) payload.metadata = { ...metadata, callbackUrl };
  const response = await fetchImpl('https://api.vapi.ai/call', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `VAPI rejected the call (${response.status})`);
  return { status: data.status || 'queued', provider: 'vapi', callId: data.id || data.callId, raw: data };
}

module.exports = { startRoleCall };
