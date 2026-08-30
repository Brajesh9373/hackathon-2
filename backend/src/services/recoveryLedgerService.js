const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const LEDGER = process.env.RECOVERY_LEDGER_PATH || path.join(__dirname, '../../data/nagarsetu-ledger.jsonl');
const key = () => crypto.createHash('sha256').update(process.env.RECOVERY_LEDGER_KEY || 'local-demo-ledger-key').digest();
function encrypt(value) { const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv); const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]); return { iv: iv.toString('base64'), data: data.toString('base64'), tag: cipher.getAuthTag().toString('base64') }; }
function decrypt(value) { const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(value.iv, 'base64')); decipher.setAuthTag(Buffer.from(value.tag, 'base64')); return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.data, 'base64')), decipher.final()]).toString('utf8')); }
function readEvents() { try { return fs.readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)); } catch (_) { return []; } }
function appendLedgerEvent({ aggregateType, aggregateId, eventType, actor = 'system', payload = {} }) { fs.mkdirSync(path.dirname(LEDGER), { recursive: true }); const events = readEvents(); const previous = events.at(-1); const event = { sequence: (previous?.sequence || 0) + 1, timestamp: new Date().toISOString(), aggregateType, aggregateId: String(aggregateId), eventType, actor, encryptedPayload: encrypt(payload), previousHash: previous?.hash || '' }; event.hash = crypto.createHash('sha256').update(JSON.stringify(event)).digest('hex'); const fd = fs.openSync(LEDGER, 'a', 0o600); try { fs.writeSync(fd, `${JSON.stringify(event)}\n`); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } return event; }
function verifyLedger() { let previous = ''; let count = 0; try { for (const source of readEvents()) { const event = { ...source }; const expected = event.hash; delete event.hash; const actual = crypto.createHash('sha256').update(JSON.stringify(event)).digest('hex'); if (actual !== expected || event.previousHash !== previous || event.sequence !== count + 1) return { valid: false, eventCount: count, firstInvalidSequence: event.sequence }; previous = expected; count += 1; } } catch (error) { return { valid: false, eventCount: count, error: error.message }; } return { valid: true, eventCount: count, lastHash: previous }; }
function reconstructAggregate(aggregateId) {
  const relevant = readEvents().filter(event => String(event.aggregateId) === String(aggregateId));
  if (!relevant.length) return { complaint: null, agent: null, events: [] };
  const complaint = {};
  const agent = {};
  for (const event of relevant) {
    const payload = decrypt(event.encryptedPayload);
    Object.assign(event.aggregateType === 'ComplaintAgent' ? agent : complaint, payload);
  }
  return {
    complaint: Object.keys(complaint).length ? complaint : null,
    agent: Object.keys(agent).length ? agent : null,
    events: relevant,
  };
}
function recordPendingCommand(command) { return appendLedgerEvent({ ...command, eventType: command.eventType || 'PENDING_COMMAND', actor: command.actor || 'system' }); }
module.exports = { appendLedgerEvent, verifyLedger, decrypt, readEvents, reconstructAggregate, recordPendingCommand };
