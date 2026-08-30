const crypto = require('crypto');

function normalizeClaim(value) {
  return String(value || '').toLowerCase().normalize('NFKC').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function fingerprintClaim(value) {
  return crypto.createHash('sha256').update(normalizeClaim(value)).digest('hex');
}

function assessIntegrity({ text, matchingRecentClaims = 0, uniqueCitizens = 1, minutes = 60, evidenceLocationMismatch = false, isPublicSafety = false }) {
  const signals = [];
  if (matchingRecentClaims >= 8 && uniqueCitizens >= 5 && minutes <= 15) signals.push('COORDINATED_BURST');
  if (evidenceLocationMismatch) signals.push('EVIDENCE_LOCATION_MISMATCH');
  const review = signals.length > 0;
  return { status: review ? 'REVIEW_REQUIRED' : 'UNVERIFIED', confidence: review ? 0.35 : 0.5, signals, fingerprint: fingerprintClaim(text), routingAllowed: true, amplificationAllowed: !review, publicSafety: Boolean(isPublicSafety) };
}

module.exports = { normalizeClaim, fingerprintClaim, assessIntegrity };
