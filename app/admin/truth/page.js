'use client';

import { useEffect, useState } from 'react';
import PortalShell from '../../ui/PortalShell';
import { EmptyState, LoadingState, PageIntro } from '../../ui/PortalBlocks';
import { truth } from '../../lib/api';
import { TruthFirewallDrill } from '../components/ChallengeLab';

export default function TruthPage() {
  const [data, setData] = useState({ cases: [], sources: [] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    truth.queue()
      .then(result => {
        setData({ cases: result?.cases || [], sources: result?.sources || [] });
        if (result?.error) setError(result.error);
      })
      .catch(requestError => setError(requestError.message || 'Live truth queue is unavailable.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const resolve = async (item, decision, reason) => {
    setBusy(item._id);
    setError('');
    try {
      const result = await truth.resolve(item._id, decision, reason);
      if (result?.success) load();
      else setError(result?.error || 'The live case could not be updated.');
    } catch (resolveError) {
      setError(resolveError.message || 'The live case could not be updated.');
    } finally {
      setBusy('');
    }
  };

  return <PortalShell role="admin">
    <PageIntro eyebrow="TRUTH CENTER" title="Slow false signals before they spread." detail="The challenge lab turns a coordinated fake complaint burst into an explainable, human-reviewable decision without blocking legitimate public-safety routing." action={<button type="button" className="v-button v-button-ghost" onClick={load} disabled={loading}>{loading ? 'Reading live queue' : 'Refresh live queue'}</button>} />
    <TruthFirewallDrill />
    {error && <p className="v-form-error">{error}</p>}
    <section className="v-live-evidence" aria-labelledby="live-truth-title">
      <div className="v-live-evidence-head"><div><span className="v-eyebrow">CONNECTED BACKEND</span><h2 id="live-truth-title">Live review queue</h2><p>Real fact-check cases stay separate from the contained simulation. Reviewers can still resolve them here.</p></div><span className="v-live-badge is-safe"><i />Routing remains open</span></div>
      {loading ? <LoadingState label="Reading the live truth queue" /> : data.cases.length ? <div className="v-truth-list">{data.cases.map(item => <article className="v-panel v-live-truth-card" key={item._id}><div className="v-card-topline"><span className="v-reference">LIVE REVIEW</span><span className="v-pill v-pill-warm"><i />Review required</span></div><h3>{item.claim || 'Unverified civic claim'}</h3><div className="v-chip-row">{(item.signals || []).map(signal => <span className="v-code-chip" key={signal}>{String(signal).replaceAll('_', ' ')}</span>)}</div><div className="v-form-actions"><button type="button" className="v-button v-button-primary" disabled={busy === item._id} onClick={() => resolve(item, 'UNVERIFIED', 'Reviewed by municipal admin')}>{busy === item._id ? 'Saving' : 'Keep routable'}</button><button type="button" className="v-button v-button-danger" disabled={busy === item._id} onClick={() => resolve(item, 'CONTRADICTED', 'Contradicted by trusted source')}>Mark contradicted</button></div></article>)}</div> : <EmptyState title="No live truth reviews waiting" detail="New coordinated or contradicted claims will appear here. The challenge lab is ready to demonstrate the policy now." />}
    </section>
  </PortalShell>;
}
