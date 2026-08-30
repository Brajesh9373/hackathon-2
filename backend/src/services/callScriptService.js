const ALLOWED_DESIGNATIONS = new Set(['Citizen', 'Admin', 'Supervisor', 'Worker']);

function normalizePhone(phone) {
  const raw = String(phone || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (raw.startsWith('+') && digits.length >= 8) return `+${digits}`;
  throw new Error('A valid phone number is required');
}

function buildRoleFirstMessage({ designation, purpose }) {
  const normalized = String(designation || '').trim().replace(/^./, value => value.toUpperCase());
  if (!ALLOWED_DESIGNATIONS.has(normalized)) throw new Error(`Unsupported designation: ${designation}`);
  const detail = String(purpose || '').trim();
  return `Hello ${normalized}. This is NagarSetu. ${detail || 'There is an update on a civic complaint.'}`;
}

function buildRoleSystemPrompt({ designation, purpose }) {
  const normalized = String(designation || '').trim().replace(/^./, value => value.toUpperCase());
  if (!ALLOWED_DESIGNATIONS.has(normalized)) throw new Error(`Unsupported designation: ${designation}`);
  const detail = String(purpose || '').trim();
  const isResolutionVerification = normalized === 'Citizen'
    && /verification|fully\s+(?:fixed|completed|resolved)|yes\s+or\s+no/i.test(detail);
  return [
    `You are the NagarSetu AI Officer speaking to a ${normalized}.`,
    'This is a live civic-service call. Identify yourself as NagarSetu, be concise, respectful, and never claim an action was completed unless the system confirms it.',
    detail || 'Give the caller a clear update about the civic case and record the response.',
    isResolutionVerification
      ? 'For resolution verification, ask one direct question: is the reported issue fully fixed? Treat only a clear yes as confirmation. A no, uncertainty, silence, or unrelated answer must keep the case open.'
      : 'Do not request passwords, OTPs, payment details, or sensitive personal information beyond the details named in the call purpose.',
  ].join(' ');
}

module.exports = { buildRoleFirstMessage, buildRoleSystemPrompt, normalizePhone, ALLOWED_DESIGNATIONS };
