const test = require('node:test');
const assert = require('node:assert/strict');
const { replayAggregateEvents } = require('../src/services/recoveryReplayService');

test('replays complaint snapshots in sequence and ignores duplicate sequences', () => {
  const result = replayAggregateEvents([
    { sequence: 1, aggregateType: 'Complaint', eventType: 'FILED', payload: { complaint_id: 'KCP-1', status: 'FILED' } },
    { sequence: 2, aggregateType: 'Complaint', eventType: 'ASSIGNED', payload: { complaint_id: 'KCP-1', status: 'ASSIGNED', assigned_worker_name: 'Ravi' } },
    { sequence: 2, aggregateType: 'Complaint', eventType: 'ASSIGNED', payload: { complaint_id: 'KCP-1', status: 'FILED' } },
  ]);
  assert.equal(result.complaint.status, 'ASSIGNED');
  assert.equal(result.complaint.assigned_worker_name, 'Ravi');
  assert.equal(result.appliedSequences, 2);
});
