const test = require('node:test');
const assert = require('node:assert/strict');
const { transitionAgent, evaluateNextAction } = require('../src/services/agentPolicyService');

test('moves a filed case through routing, assignment and field work', () => {
  let state = { stage: 'INTAKE', escalation_level: 0 };
  state = transitionAgent(state, { type: 'COMPLAINT_FILED' });
  state = transitionAgent(state, { type: 'SUPERVISOR_ASSIGNED' });
  state = transitionAgent(state, { type: 'WORKER_ASSIGNED' });
  state = transitionAgent(state, { type: 'WORK_STARTED' });
  assert.equal(state.stage, 'ACTIVE_WORK');
});

test('refuses an invalid completion transition before citizen verification', () => {
  assert.throws(() => transitionAgent({ stage: 'ACTIVE_WORK' }, { type: 'CITIZEN_CONFIRMED' }), /Invalid case transition/);
});

test('creates an approval-bound escalation when an active case breaches SLA', () => {
  const proposal = evaluateNextAction({ stage: 'ACTIVE_WORK', escalation_level: 0 }, { sla_breached: true });
  assert.equal(proposal.type, 'ESCALATE');
  assert.equal(proposal.requires_approval, true);
});
