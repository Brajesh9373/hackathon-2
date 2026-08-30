const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('encrypts sensitive payloads and detects ledger tampering', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nagarsetu-ledger-'));
  process.env.RECOVERY_LEDGER_PATH = path.join(dir, 'ledger.jsonl');
  process.env.RECOVERY_LEDGER_KEY = '01234567890123456789012345678901';
  delete require.cache[require.resolve('../src/services/recoveryLedgerService')];
  const ledger = require('../src/services/recoveryLedgerService');
  ledger.appendLedgerEvent({ aggregateType: 'Complaint', aggregateId: 'KCP-1', eventType: 'FILED', payload: { phone: '+918282909044', complaint_text: 'Blocked drain' } });
  const raw = fs.readFileSync(process.env.RECOVERY_LEDGER_PATH, 'utf8');
  assert.equal(raw.includes('+918282909044'), false);
  assert.equal(ledger.verifyLedger().valid, true);
  fs.appendFileSync(process.env.RECOVERY_LEDGER_PATH, '{"sequence":99}\n');
  assert.equal(ledger.verifyLedger().valid, false);
});

test('reconstructs the latest encrypted aggregate snapshot from a valid chain', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nagarsetu-ledger-replay-'));
  process.env.RECOVERY_LEDGER_PATH = path.join(dir, 'ledger.jsonl');
  delete require.cache[require.resolve('../src/services/recoveryLedgerService')];
  const ledger = require('../src/services/recoveryLedgerService');
  ledger.appendLedgerEvent({ aggregateType: 'Complaint', aggregateId: 'case-2', eventType: 'FILED', payload: { status: 'FILED', complaint_id: 'KCP-2' } });
  ledger.appendLedgerEvent({ aggregateType: 'Complaint', aggregateId: 'case-2', eventType: 'ASSIGNED', payload: { status: 'ASSIGNED', complaint_id: 'KCP-2', assigned_supervisor_name: 'Asha' } });
  const rebuilt = ledger.reconstructAggregate('case-2');
  assert.equal(rebuilt.complaint.status, 'ASSIGNED');
  assert.equal(rebuilt.complaint.assigned_supervisor_name, 'Asha');
});
