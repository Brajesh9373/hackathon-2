const test = require('node:test');
const assert = require('node:assert/strict');
const { buildProposal, canApprove } = require('../src/services/caseOfficerService');

test('builds a readable approval proposal for SLA escalation', () => {
  const proposal = buildProposal({ _id: 'case-1', stage: 'ACTIVE_WORK', escalation_level: 0 }, { _id: 'complaint-1', complaint_id: 'KCP-1', sla_breached: true });
  assert.equal(proposal.type, 'ESCALATE');
  assert.equal(proposal.requires_approval, true);
  assert.match(proposal.reason, /SLA/);
});

test('only an admin or assigned supervisor can approve an escalation', () => {
  assert.equal(canApprove({ type: 'ESCALATE', requires_approval: true, allowed_roles: ['admin', 'supervisor'] }, { role: 'admin' }), true);
  assert.equal(canApprove({ type: 'ESCALATE', requires_approval: true, allowed_roles: ['admin', 'supervisor'] }, { role: 'worker' }), false);
});
