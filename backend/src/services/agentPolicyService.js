const TRANSITIONS = {
  INTAKE: { COMPLAINT_FILED: 'TRIAGE' },
  TRIAGE: { SUPERVISOR_ASSIGNED: 'ROUTING' },
  ROUTING: { WORKER_ASSIGNED: 'ASSIGNED' },
  ASSIGNED: { WORK_STARTED: 'ACTIVE_WORK' },
  ACTIVE_WORK: { WORK_SUBMITTED: 'VERIFICATION' },
  VERIFICATION: { CITIZEN_CONFIRMED: 'COMPLETED', CITIZEN_REJECTED: 'REOPENED' },
  REOPENED: { WORKER_ASSIGNED: 'ASSIGNED' },
  COMPLETED: {},
};

function transitionAgent(state, event) {
  const stage = String(state?.stage || 'INTAKE');
  const next = TRANSITIONS[stage]?.[event?.type];
  if (!next) throw new Error(`Invalid case transition: ${stage} cannot accept ${event?.type || 'unknown'}`);
  return { ...state, stage: next, last_event: event.type, last_transition_at: event.timestamp || new Date() };
}

function evaluateNextAction(agent, complaint) {
  if (complaint?.sla_breached && !['COMPLETED', 'VERIFICATION'].includes(agent?.stage)) {
    return { id: `sla-${complaint._id || complaint.complaint_id || 'case'}`, type: 'ESCALATE', reason: 'SLA deadline breached', requires_approval: true, allowed_roles: ['admin', 'supervisor'] };
  }
  const actions = { TRIAGE: 'ROUTE_TO_SUPERVISOR', ROUTING: 'ASSIGN_WORKER', ASSIGNED: 'START_WORK', ACTIVE_WORK: 'MONITOR_WORK', VERIFICATION: 'WAIT_FOR_CITIZEN', REOPENED: 'REASSIGN' };
  return { type: actions[agent?.stage] || 'MONITOR', requires_approval: false };
}

module.exports = { TRANSITIONS, transitionAgent, evaluateNextAction };
