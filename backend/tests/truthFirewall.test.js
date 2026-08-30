const test = require('node:test');
const assert = require('node:assert/strict');
const { assessIntegrity, normalizeClaim, fingerprintClaim } = require('../src/services/misinformationService');

test('normalizes equivalent civic claims to the same fingerprint', () => {
  assert.equal(fingerprintClaim('  Water is UNSAFE!!! '), fingerprintClaim('water is unsafe'));
  assert.equal(normalizeClaim('Road   Closed?'), 'road closed');
});

test('flags coordinated copy-paste bursts without blocking public safety routing', () => {
  const result = assessIntegrity({ text: 'Hospital water is poisoned', matchingRecentClaims: 14, uniqueCitizens: 12, minutes: 8, isPublicSafety: true });
  assert.equal(result.status, 'REVIEW_REQUIRED');
  assert.equal(result.signals.includes('COORDINATED_BURST'), true);
  assert.equal(result.routingAllowed, true);
});

test('marks ordinary unique complaints as unverified but routable', () => {
  const result = assessIntegrity({ text: 'Streetlight outside my house is not working', matchingRecentClaims: 0, uniqueCitizens: 1, minutes: 60 });
  assert.equal(result.status, 'UNVERIFIED');
  assert.equal(result.routingAllowed, true);
});
