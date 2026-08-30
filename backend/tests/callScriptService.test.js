const test = require('node:test');
const assert = require('node:assert/strict');
const { buildRoleFirstMessage, normalizePhone } = require('../src/services/callScriptService');

test('normalizes Indian demo numbers to E.164 without losing the plus sign', () => {
  assert.equal(normalizePhone('8282909044'), '+918282909044');
  assert.equal(normalizePhone('+91 82829 09044'), '+918282909044');
});

test('builds NagarSetu first messages with the exact recipient designation', () => {
  assert.match(buildRoleFirstMessage({ designation: 'Worker', purpose: 'A new task is ready.' }), /^Hello Worker\. This is NagarSetu\./);
  assert.match(buildRoleFirstMessage({ designation: 'Citizen', purpose: 'Please describe the issue.' }), /Please describe the issue\./);
});

test('rejects unknown call designations', () => {
  assert.throws(() => buildRoleFirstMessage({ designation: 'Mayor', purpose: 'Test' }), /Unsupported designation/);
});
