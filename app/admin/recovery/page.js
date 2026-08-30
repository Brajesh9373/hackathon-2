'use client';

import { useEffect, useState } from 'react';
import PortalShell from '../../ui/PortalShell';
import { InlineNotice, LoadingState, PageIntro } from '../../ui/PortalBlocks';
import { recovery } from '../../lib/api';
import { RecoveryDrill } from '../components/ChallengeLab';

function formatEvent(value) {
  return String(value || 'None yet').toLowerCase().replace(/[_-]+/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
}

export default function RecoveryPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    setError('');
    recovery.status()
      .then(result => {
        setData(result);
        if (result?.error) setError(result.error);
      })
      .catch(requestError => setError(requestError.message || 'Live recovery status is unavailable.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const restore = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await recovery.restore();
      if (result?.success) load();
      else setError(result?.error || 'Live restore could not be completed.');
    } catch (restoreError) {
      setError(restoreError.message || 'Live restore could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  const liveLedger = data?.ledger;
  const liveAvailable = Boolean(liveLedger);

  return <PortalShell role="admin">
    <PageIntro eyebrow="RECOVERY SENTINEL" title="Keep service moving when records disappear." detail="The challenge lab makes the recovery promise visible: a working operation stays online, the ledger proves what happened, and only recoverable records return." action={<button type="button" className="v-button v-button-ghost" onClick={load} disabled={loading}>{loading ? 'Reading live status' : 'Refresh live status'}</button>} />
    <RecoveryDrill />
    {error && <p className="v-form-error">{error}</p>}
    <section className="v-live-evidence" aria-labelledby="live-recovery-title">
      <div className="v-live-evidence-head"><div><span className="v-eyebrow">CONNECTED BACKEND</span><h2 id="live-recovery-title">Recovery chain status</h2><p>The encrypted append-only ledger backing NagarSetu. The drill above never mutates this live register.</p></div><span className={`v-live-badge ${liveAvailable && liveLedger.valid ? 'is-safe' : 'is-warm'}`}><i />{liveAvailable && liveLedger.valid ? 'Integrity verified' : 'Status unavailable'}</span></div>
      {loading ? <LoadingState label="Reading the live recovery chain" /> : liveAvailable ? <div className="v-live-evidence-grid"><div className="v-panel"><div className="v-live-stat"><span>Ledger events</span><strong>{liveLedger.eventCount ?? 0}</strong><small>{liveLedger.valid ? 'Hash chain is continuous' : 'Review needed before restore'}</small></div><div className="v-live-stat"><span>Last event</span><strong>{formatEvent(data.lastEvent)}</strong><small>Latest event type recorded</small></div><div className="v-live-stat"><span>Pending commands</span><strong>{data.pendingCommands ?? 0}</strong><small>Commands waiting for replay</small></div></div><div className="v-panel v-panel-soft"><span className="v-eyebrow">LIVE RESTORE</span><h3>Rebuild a lost case record</h3><p className="v-side-copy">Replay encrypted snapshots into the primary store. Existing records are updated idempotently.</p><button type="button" className="v-button v-button-primary" disabled={busy || !liveLedger.valid} onClick={restore}>{busy ? 'Restoring live records' : 'Restore recoverable cases'}</button></div></div> : <InlineNotice tone="warm">The live endpoint did not return a ledger snapshot. Use the safe challenge drill above to demonstrate the recovery path without changing production data.</InlineNotice>}
    </section>
  </PortalShell>;
}
