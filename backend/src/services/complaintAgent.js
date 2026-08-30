const ComplaintAgent = require('../models/ComplaintAgent');

async function createCaseOfficer(complaint, metadata = {}) {
  return ComplaintAgent.findOneAndUpdate(
    { complaint_id: complaint._id },
    {
      $setOnInsert: {
        name: 'NagarSetu Case Officer',
        status: 'MONITORING',
        next_action: 'Watch for a routing decision',
        last_action: 'Case officer created',
        case_memory: { complaint_id: complaint.complaint_id, category: complaint.category, source: complaint.source, priority_score: complaint.priority_score || 0 },
        event_log: [{ type: 'CASE_CREATED', summary: 'Case officer created for this complaint', actor: 'system', metadata }],
      },
    },
    { upsert: true, new: true }
  );
}

async function recordCaseEvent(complaintId, event) {
  return ComplaintAgent.findOneAndUpdate(
    { complaint_id: complaintId },
    { $set: { last_action: event.summary, next_action: event.next_action || 'Monitor the next workflow event', status: event.status || 'MONITORING' }, $push: { event_log: { type: event.type || 'WORKFLOW', summary: event.summary, actor: event.actor || 'system', metadata: event.metadata } } },
    { new: true }
  );
}

module.exports = { createCaseOfficer, recordCaseEvent };
