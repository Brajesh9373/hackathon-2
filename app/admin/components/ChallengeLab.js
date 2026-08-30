'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const recoveryStages = [
  { key: 'ready', label: 'Live operation', detail: 'A field update is in flight.', marker: '01' },
  { key: 'wiped', label: 'Primary store lost', detail: 'The working copy disappears mid-operation.', marker: '02' },
  { key: 'detected', label: 'Gap detected', detail: 'The integrity monitor finds the missing records.', marker: '03' },
  { key: 'restoring', label: 'Ledger replay', detail: 'Encrypted checkpoints rebuild the recoverable state.', marker: '04' },
  { key: 'restored', label: 'Continuity restored', detail: 'Service stays online and the audit trail is intact.', marker: '05' },
];

const recoveryRecords = [
  { id: 'SIM-042', title: 'Drain response', owner: 'Worker 07', recoverable: true },
  { id: 'SIM-043', title: 'Streetlight repair', owner: 'Worker 03', recoverable: true },
  { id: 'SIM-044', title: 'Citizen callback', owner: 'NagarSetu officer', recoverable: false },
];

const firewallClaims = [
  { id: 'TF-01', text: 'Water at Sanjivani University is contaminated!', source: 'Resident report', time: '11:42', matches: 12, cluster: true },
  { id: 'TF-02', text: 'WATER at Sanjivani University is contaminated', source: 'Resident report', time: '11:44', matches: 11, cluster: true },
  { id: 'TF-03', text: 'Water at Sanjivani University is contaminated.', source: 'Resident report', time: '11:49', matches: 10, cluster: true },
  { id: 'TF-04', text: 'Streetlight outside the library is not working', source: 'Resident report', time: '11:51', matches: 0, cluster: false },
];

const firewallStages = [
  { key: 'idle', label: 'Ready', detail: 'A contained scenario is waiting to run.' },
  { key: 'ingesting', label: 'Ingesting', detail: 'Four reports arrive in quick succession.' },
  { key: 'clustered', label: 'Clustered', detail: 'Three reports resolve to one claim fingerprint.' },
  { key: 'complete', label: 'Decision ready', detail: 'Routing stays open while amplification is held.' },
];

const recoveryIndex = recoveryStages.reduce((result, item, index) => ({ ...result, [item.key]: index }), {});
const firewallIndex = firewallStages.reduce((result, item, index) => ({ ...result, [item.key]: index }), {});

function clearTimers(timerRef) {
  timerRef.current.forEach(timer => window.clearTimeout(timer));
  timerRef.current = [];
}

function recoveryRecordState(stage, record) {
  if (stage === 'ready') return { label: 'Primary copy', tone: 'cool' };
  if (stage === 'wiped' || stage === 'detected') return { label: 'Missing from store', tone: 'danger' };
  if (stage === 'restoring') return { label: 'Replaying checkpoint', tone: 'warm' };
  return record.recoverable ? { label: 'Restored', tone: 'success' } : { label: 'Manual review', tone: 'warm' };
}

function firewallClaimState(stage, claim, decision) {
  if (stage === 'idle') return { label: 'Queued', tone: 'cool' };
  if (stage === 'ingesting') return { label: claim.cluster ? 'Arriving' : 'Queued', tone: claim.cluster ? 'warm' : 'cool' };
  if (stage === 'clustered') return { label: claim.cluster ? 'Matched cluster' : 'Unique report', tone: claim.cluster ? 'warm' : 'success' };
  if (claim.cluster && decision === 'released') return { label: 'Released', tone: 'success' };
  if (claim.cluster) return { label: 'Review required', tone: 'danger' };
  return { label: 'Routable', tone: 'success' };
}

export function RecoveryDrill() {
  const [stage, setStage] = useState('ready');
  const [running, setRunning] = useState(false);
  const timerRef = useRef([]);
  const current = recoveryStages[recoveryIndex[stage]];
  const progress = { ready: 0, wiped: 28, detected: 54, restoring: 79, restored: 100 }[stage];
  const isReady = stage === 'ready';
  const canRestore = stage === 'detected';

  useEffect(() => () => clearTimers(timerRef), []);

  const reset = () => {
    clearTimers(timerRef);
    setRunning(false);
    setStage('ready');
  };

  const run = () => {
    clearTimers(timerRef);
    setRunning(true);
    setStage('wiped');
    timerRef.current.push(window.setTimeout(() => {
      setStage('detected');
      setRunning(false);
    }, 1150));
  };

  const restore = () => {
    clearTimers(timerRef);
    setRunning(true);
    setStage('restoring');
    timerRef.current.push(window.setTimeout(() => {
      setStage('restored');
      setRunning(false);
    }, 1650));
  };

  return <section className="v-challenge-card v-recovery-drill" aria-labelledby="recovery-drill-title">
    <div className="v-challenge-head">
      <div>
        <div className="v-challenge-kicker"><span className="v-eyebrow">CHALLENGE 01</span><span className="v-demo-badge">Frontend simulation</span></div>
        <h2 id="recovery-drill-title">Resilience under data loss</h2>
        <p>Watch an operation continue while the primary store disappears, then recover only what the ledger can prove.</p>
      </div>
      <div className="v-challenge-actions"><button type="button" className="v-button v-button-primary" onClick={run} disabled={!isReady || running}>{running && stage === 'wiped' ? 'Running drill' : 'Run data loss drill'}</button><button type="button" className="v-button v-button-ghost" onClick={reset} disabled={isReady && !running}>Reset</button></div>
    </div>

    <div className="v-challenge-status" aria-live="polite">
      <div className="v-status-orbit"><span className={`v-orbit-core is-${stage}`} /><span className="v-orbit-ring" /></div>
      <div><span className="v-eyebrow">CURRENT STATE</span><strong>{current.label}</strong><p>{current.detail}</p></div>
      <div className="v-progress-readout"><strong>{progress}%</strong><span>recovery path</span></div>
    </div>
    <div className="v-challenge-progress" role="progressbar" aria-label="Recovery drill progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>

    <div className="v-challenge-systems">
      <div><span>Primary store</span><strong className={stage === 'ready' ? 'is-safe' : stage === 'restored' ? 'is-safe' : 'is-risk'}>{stage === 'ready' ? 'Healthy' : stage === 'wiped' || stage === 'detected' ? 'Unavailable' : stage === 'restoring' ? 'Rebuilding' : 'Healthy again'}</strong></div>
      <div><span>Immutable ledger</span><strong className="is-safe">Verified</strong></div>
      <div><span>Citizen service</span><strong className="is-safe">Still online</strong></div>
      <div><span>Recoverable</span><strong>{stage === 'restored' ? '2 of 3 records' : '2 checkpoints'}</strong></div>
    </div>

    <div className="v-challenge-body">
      <div className="v-challenge-timeline" aria-label="Recovery drill stages">
        {recoveryStages.map(item => { const itemIndex = recoveryIndex[item.key]; const active = item.key === stage; const done = itemIndex < recoveryIndex[stage]; return <div className={`v-challenge-step ${active ? 'is-active' : ''} ${done ? 'is-done' : ''}`} key={item.key}><span>{item.marker}</span><div><strong>{item.label}</strong><small>{item.detail}</small></div></div>; })}
      </div>
      <div className="v-challenge-case">
        <div className="v-card-topline"><span className="v-reference">ACTION IN FLIGHT</span><span className={`v-pill v-pill-${stage === 'restored' ? 'success' : stage === 'ready' ? 'cool' : 'warm'}`}><i />{stage === 'restored' ? 'Verified' : stage === 'ready' ? 'Live' : 'Continues'}</span></div>
        <strong>SIM-042 / Drain response</strong>
        <p>Worker 07 has acknowledged the next stop. This event remains visible through the loss and replay.</p>
        <div className="v-case-mini"><span>Owner</span><strong>Supervisor queue</strong><span>Audit</span><strong>Ledger checkpoint 184</strong></div>
      </div>
    </div>

    <div className="v-challenge-records"><div className="v-challenge-section-label"><span className="v-eyebrow">RECORDS IN THE DRILL</span><span>{stage === 'restored' ? '2 restored, 1 manual review' : stage === 'ready' ? 'Ready to simulate' : 'Primary copy unavailable'}</span></div><div className="v-record-grid">{recoveryRecords.map(record => { const state = recoveryRecordState(stage, record); return <div className="v-record-card" key={record.id}><div><strong>{record.id}</strong><span>{record.title}</span></div><small>{record.owner}</small><span className={`v-pill v-pill-${state.tone}`}><i />{state.label}</span></div>; })}</div></div>

    <div className="v-challenge-footer"><span>{stage === 'detected' ? 'The ledger is ready. Restore the recoverable snapshot to complete the drill.' : stage === 'restored' ? 'Continuity is restored. The unrecoverable record is explicitly left for manual review.' : 'Safe demo mode. Nothing on this page writes to the live complaint register.'}</span>{canRestore && <button type="button" className="v-button v-button-secondary" onClick={restore} disabled={running}>{running ? 'Replaying ledger' : 'Restore ledger snapshot'}</button>}{stage === 'restoring' && <span className="v-inline-progress" aria-live="polite">Replaying encrypted checkpoints</span>}</div>
  </section>;
}

export function TruthFirewallDrill() {
  const [stage, setStage] = useState('idle');
  const [decision, setDecision] = useState('held');
  const timerRef = useRef([]);
  const running = stage === 'ingesting' || stage === 'clustered';
  const stagePosition = firewallIndex[stage];
  const arrived = stage === 'idle' ? 0 : 4;
  const held = stage === 'complete' && decision !== 'released' ? 3 : 0;
  const routed = stage === 'idle' ? 0 : 1;

  useEffect(() => () => clearTimers(timerRef), []);

  const reset = () => {
    clearTimers(timerRef);
    setStage('idle');
    setDecision('held');
  };

  const run = () => {
    clearTimers(timerRef);
    setDecision('held');
    setStage('ingesting');
    timerRef.current.push(window.setTimeout(() => setStage('clustered'), 900));
    timerRef.current.push(window.setTimeout(() => setStage('complete'), 1900));
  };

  const summary = useMemo(() => firewallStages.find(item => item.key === stage) || firewallStages[0], [stage]);

  return <section className="v-challenge-card v-firewall-drill" aria-labelledby="truth-drill-title">
    <div className="v-challenge-head">
      <div>
        <div className="v-challenge-kicker"><span className="v-eyebrow">CHALLENGE 02</span><span className="v-demo-badge">Frontend simulation</span></div>
        <h2 id="truth-drill-title">Truth Firewall</h2>
        <p>Replay a coordinated complaint burst and see the difference between holding amplification and keeping a public-safety route open.</p>
      </div>
      <div className="v-challenge-actions"><button type="button" className="v-button v-button-primary" onClick={run} disabled={running || stage === 'complete'}>{running ? 'Analysing burst' : 'Run truth firewall'}</button><button type="button" className="v-button v-button-ghost" onClick={reset} disabled={stage === 'idle'}>Reset</button></div>
    </div>

    <div className="v-firewall-summary" aria-live="polite"><div className="v-firewall-signal"><span className={`v-signal-pulse is-${stage}`} /><div><span className="v-eyebrow">FIREWALL STATUS</span><strong>{summary.label}</strong><p>{summary.detail}</p></div></div><div className="v-firewall-metrics"><div><strong>{arrived}</strong><span>reports in burst</span></div><div><strong>{held}</strong><span>held for review</span></div><div><strong>{routed}</strong><span>still routable</span></div><div><strong>0</strong><span>blocked outright</span></div></div></div>

    <div className="v-challenge-progress v-firewall-progress" role="progressbar" aria-label="Truth Firewall progress" aria-valuemin="0" aria-valuemax="3" aria-valuenow={stagePosition}><span style={{ width: `${(stagePosition / 3) * 100}%` }} /></div>
    <div className="v-firewall-steps">{firewallStages.map(item => { const itemIndex = firewallIndex[item.key]; return <div key={item.key} className={`v-firewall-step ${item.key === stage ? 'is-active' : ''} ${itemIndex < stagePosition ? 'is-done' : ''}`}><span>{String(itemIndex + 1).padStart(2, '0')}</span><strong>{item.label}</strong></div>; })}</div>

    <div className="v-firewall-layout"><div className="v-firewall-claims"><div className="v-challenge-section-label"><span className="v-eyebrow">INCOMING CLAIMS</span><span>Simulation records only</span></div>{firewallClaims.map(claim => { const state = firewallClaimState(stage, claim, decision); return <article className={`v-firewall-claim ${claim.cluster ? 'is-clustered' : 'is-unique'}`} key={claim.id}><div className="v-firewall-claim-top"><strong>{claim.id}</strong><span className={`v-pill v-pill-${state.tone}`}><i />{state.label}</span></div><p>{claim.text}</p><div className="v-firewall-claim-meta"><span>{claim.source}</span><span>{claim.time}</span><span>{claim.cluster ? 'Same normalized fingerprint' : 'Unique fingerprint'}</span><span>{claim.matches ? `${claim.matches} similar reports` : 'No matching burst'}</span></div></article>; })}</div><aside className="v-firewall-decision"><span className="v-eyebrow">POLICY READOUT</span><h3>Safety without silencing</h3><div className="v-policy-row"><span>Public-safety routing</span><strong className="is-safe">Open</strong></div><div className="v-policy-row"><span>Amplification gate</span><strong className={decision === 'released' ? 'is-safe' : 'is-risk'}>{decision === 'released' ? 'Released' : 'Held'}</strong></div><p>{decision === 'released' ? 'An admin marked the cluster supported. The claims can continue through the civic workflow.' : 'The similar claims remain visible to reviewers, but the system will not amplify an unverified burst.'}</p><div className="v-firewall-actions"><button type="button" className="v-button v-button-secondary" onClick={() => setDecision('released')} disabled={stage !== 'complete' || decision === 'released'}>Release as supported</button><button type="button" className="v-button v-button-ghost" onClick={() => setDecision('held')} disabled={stage !== 'complete' || decision === 'held'}>Keep cluster held</button></div></aside></div>

    <div className="v-challenge-footer"><span>{stage === 'complete' ? 'The decision is local to this drill. Live fact-check cases remain untouched.' : 'A claim is never erased by this policy. It is clustered, explained and routed for human review.'}</span></div>
  </section>;
}
