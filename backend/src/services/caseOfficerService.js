const { evaluateNextAction } = require('./agentPolicyService');
const ComplaintAgent = require('../models/ComplaintAgent');
const Complaint = require('../models/Complaint');

function buildProposal(agent, complaint, now = new Date()) {
  const action = evaluateNextAction(agent, complaint);
  return { id: `${action.type.toLowerCase()}-${complaint.complaint_id || complaint._id}-${new Date(now).getTime()}`, complaint_id: complaint._id, type: action.type, reason: action.reason || `Next case action: ${action.type}`, requires_approval: Boolean(action.requires_approval), allowed_roles: action.allowed_roles || [], status: 'PENDING', created_at: new Date(now).toISOString() };
}

function canApprove(proposal, actor) { return Boolean(proposal?.requires_approval && proposal.allowed_roles?.includes(actor?.role)); }

async function runCaseOfficerSweep(now = new Date()) {
  const complaints = await Complaint.find({ status: { $nin: ['COMPLETED', 'CLOSED'] } }).lean(); let processed = 0; let escalated = 0;
  for (const complaint of complaints) {
    const agent = await ComplaintAgent.findOne({ complaint_id: complaint._id }); if (!agent) continue;
    const proposal = buildProposal(agent.toObject(), complaint, now); processed++;
    if (proposal.type === 'ESCALATE' && !agent.proposals.some(item => item.type === 'ESCALATE' && item.status === 'PENDING')) { agent.proposals.push(proposal); agent.pending_approval = true; agent.status = 'WAITING_APPROVAL'; await agent.save(); escalated++; }
  }
  return { processed, escalated };
}

module.exports = { buildProposal, canApprove, runCaseOfficerSweep };
