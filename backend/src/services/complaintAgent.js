const ComplaintAgent = require('../models/ComplaintAgent');
const { transitionAgent } = require('./agentPolicyService');
const { appendLedgerEvent } = require('./recoveryLedgerService');

async function createCaseOfficer(complaint, metadata = {}) {
  const agent = await ComplaintAgent.findOneAndUpdate(
    { complaint_id: complaint._id },
    {
      $setOnInsert: {
        name: 'NagarSetu Case Officer',
        stage: 'TRIAGE',
        status: 'MONITORING',
        next_action: 'Watch for a routing decision',
        last_action: 'Case officer created',
        case_memory: { complaint_id: complaint.complaint_id, category: complaint.category, source: complaint.source, priority_score: complaint.priority_score || 0 },
        event_log: [{ type: 'CASE_CREATED', summary: 'Case officer created for this complaint', actor: 'system', metadata }],
      },
    },
    { upsert: true, new: true }
  );
  appendLedgerEvent({
    aggregateType: 'ComplaintAgent',
    aggregateId: agent._id,
    eventType: 'CASE_CREATED',
    actor: metadata.actor || 'system',
    payload: agent.toObject(),
  });
  return agent;
}

async function recordCaseEvent(complaintId, event) {
  const current = await ComplaintAgent.findOne({ complaint_id: complaintId }).lean();
  let stage = current?.stage || 'INTAKE';
  try { stage = transitionAgent({ stage }, { type: event.type }).stage; } catch (_) { /* legacy events remain observable without blocking workflow */ }
  const updated = await ComplaintAgent.findOneAndUpdate(
    { complaint_id: complaintId },
    { $set: { name: 'NagarSetu Case Officer', stage, last_action: event.summary, next_action: event.next_action || 'Monitor the next workflow event', status: event.status || 'MONITORING' }, $push: { event_log: { type: event.type || 'WORKFLOW', summary: event.summary, actor: event.actor || 'system', metadata: event.metadata } } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  if (updated) {
    appendLedgerEvent({
      aggregateType: 'ComplaintAgent',
      aggregateId: updated._id,
      eventType: event.type || 'WORKFLOW',
      actor: event.actor || 'system',
      payload: updated.toObject(),
    });
  }
  return updated;
}

module.exports = { createCaseOfficer, recordCaseEvent };
