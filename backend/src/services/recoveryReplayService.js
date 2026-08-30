const Complaint = require('../models/Complaint');
const ComplaintAgent = require('../models/ComplaintAgent');
const { readEvents, decrypt, verifyLedger } = require('./recoveryLedgerService');

function replayAggregateEvents(events = []) {
  const applied = new Set(); const complaint = {}; const agent = {};
  for (const event of [...events].sort((a, b) => a.sequence - b.sequence)) {
    if (applied.has(event.sequence)) continue;
    applied.add(event.sequence);
    const target = event.aggregateType === 'ComplaintAgent' ? agent : complaint;
    Object.assign(target, event.payload || {});
  }
  return { complaint: Object.keys(complaint).length ? complaint : null, agent: Object.keys(agent).length ? agent : null, appliedSequences: applied.size };
}

function decodedAggregateEvents(aggregateId) {
  return readEvents().filter(event => String(event.aggregateId) === String(aggregateId)).map(event => ({ ...event, payload: decrypt(event.encryptedPayload) }));
}

async function restorePrimaryStore({ aggregateIds = [] } = {}) {
  const integrity = verifyLedger();
  if (!integrity.valid) throw new Error(`Recovery ledger integrity failed at sequence ${integrity.firstInvalidSequence || 'unknown'}`);
  const selected = aggregateIds.length ? aggregateIds : [...new Set(readEvents().map(event => String(event.aggregateId)))];
  const restored = []; const skipped = [];
  for (const aggregateId of selected) {
    const state = replayAggregateEvents(decodedAggregateEvents(aggregateId));
    if (state.complaint?.complaint_id) {
      const snapshot = { ...state.complaint };
      delete snapshot._id;
      delete snapshot.__v;
      await Complaint.findOneAndUpdate({ complaint_id: state.complaint.complaint_id }, { $set: snapshot }, { upsert: true, new: true, setDefaultsOnInsert: true });
      restored.push(aggregateId);
    } else if (state.agent?.complaint_id) {
      const snapshot = { ...state.agent };
      delete snapshot._id;
      delete snapshot.__v;
      await ComplaintAgent.findOneAndUpdate({ complaint_id: state.agent.complaint_id }, { $set: snapshot }, { upsert: true, new: true, setDefaultsOnInsert: true });
      restored.push(aggregateId);
    }
    else skipped.push(aggregateId);
  }
  return { restored, skipped, conflicts: [] };
}

module.exports = { replayAggregateEvents, restorePrimaryStore };
