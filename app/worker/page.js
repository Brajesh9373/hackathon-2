'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PortalShell from '../ui/PortalShell';
import { complaints } from '../lib/api';
import { checkCoordinatesForCalling, initRadar } from '../lib/geofencing';
import { EmptyState, InlineNotice, PageIntro, friendlyError } from '../ui/PortalBlocks';
import { PriorityPill, StatusPill, complaintLocation, formatDate } from '../ui/CivicUI';

function WorkDoneForm({ item, onClose, onSaved }) {
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [safety, setSafety] = useState(null);

  const readPhoto = event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result);
    reader.readAsDataURL(file);
  };

  const submit = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    initRadar();
    const coords = item.location?.coords;
    const safetyResult = await checkCoordinatesForCalling(coords ? { latitude: coords.lat, longitude: coords.lng } : null);
    setSafety(safetyResult);
    const result = await complaints.completeWork(item._id, {
      resolution_note: note.trim(),
      resolution_photos: photo ? [{ url: photo }] : [],
      geofence: safetyResult,
    });
    setBusy(false);
    if (result?.success) onSaved(safetyResult, result);
    else setError(friendlyError(result?.error));
  };

  return <form className="v-worker-form" onSubmit={submit}>
    <div className="v-field"><label>Completion note <span style={{ color: 'var(--v-muted)', fontWeight: 500 }}>(optional)</span></label><textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Add a short note about what was repaired (optional)." /></div>
    <div className="v-field"><label>Completion photo <span style={{ color: 'var(--v-muted)', fontWeight: 500 }}>(optional)</span></label><div className="v-upload"><strong>Upload proof from the site</strong><small>A photo helps the citizen verify the result, but it is not required.</small><input type="file" accept="image/*" onChange={readPhoto} /></div>{photo && <div className="v-photo-preview"><img src={photo} alt="Completion preview" /></div>}</div>
    {safety && <div className={`v-safety-note ${safety.canCall ? 'is-allowed' : 'is-blocked'}`}><strong>{safety.canCall ? '✓ Call safety check passed' : '⦸ Automated call held'}</strong><span>{safety.reason}</span></div>}
    {error && <p className="v-form-error">{error}</p>}
    <div className="v-form-actions"><button type="button" className="v-button v-button-ghost" onClick={onClose}>Cancel</button><button className="v-button v-button-primary" disabled={busy}>{busy ? 'Checking and submitting…' : 'Submit work done'}</button></div>
  </form>;
}

export default function WorkerPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState('');

  const load = () => {
    setLoading(true);
    complaints.workerTasks().then(result => {
      setItems(result?.activeTasks || result?.complaints || []);
      setError(result?.error || '');
    }).catch(() => setError('Could not load your work queue.')).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const start = async item => {
    const result = await complaints.startWork(item._id);
    if (result?.success) load();
    else setError(friendlyError(result?.error));
  };

  return <PortalShell role="worker">
    <PageIntro eyebrow="MY WORK" title="A focused queue for the field." detail="Start the job, capture proof, and submit a closure proposal. The citizen confirmation is the final gate." action={<button className="v-button v-button-ghost" onClick={load}>Refresh</button>} />
    {notice && <InlineNotice tone="success">{notice}</InlineNotice>}
    {error && <p className="v-form-error">{error}</p>}
    {loading ? <div className="v-loading" style={{ minHeight: 280 }}><div className="v-loading-mark">N</div><p>Loading your queue…</p></div> : items.length ? <div className="v-worker-list">{items.map(item => <article className="v-worker-card" key={item._id || item.complaint_id}>
      <div className="v-worker-top"><div><span className="v-reference">{item.complaint_id}</span><h2>{item.complaint_text || 'Civic issue'}</h2><p>{complaintLocation(item)} · Filed {formatDate(item.createdAt)}</p></div><PriorityPill value={item.priority_score} /></div>
      <div className="v-worker-bottom"><StatusPill value={item.status} /><span className="v-worker-dept">{item.module || 'Civic network'}</span><div className="v-worker-actions">{String(item.status).toUpperCase() === 'ASSIGNED' && <button className="v-button v-button-ghost" onClick={() => start(item)}>Start work</button>}<button className="v-button v-button-primary" onClick={() => setSelected(item)} disabled={String(item.status).toUpperCase() !== 'IN_PROGRESS'}>Work done</button></div></div>
      {selected?._id === item._id && <WorkDoneForm item={item} onClose={() => setSelected(null)} onSaved={(safetyResult, result) => { setSelected(null); setNotice(safetyResult.canCall ? 'Work submitted and the automated citizen verification call can proceed.' : `Work submitted. The automated call was held: ${safetyResult.reason}`); load(); if (result?.complaint?.complaint_id) router.push(`/worker/work/${result.complaint.complaint_id}`); }} />}
    </article>)}</div> : <EmptyState icon="Done" title="Your queue is clear" detail="New assignments will appear here. Completed work stays available in the Completed tab." action={<button className="v-button v-button-ghost" onClick={() => router.push('/worker/completed')}>View completed work</button>} />}
  </PortalShell>;
}
