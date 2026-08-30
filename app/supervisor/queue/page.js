'use client';

import { useEffect, useMemo, useState } from 'react';
import PortalShell from '../../ui/PortalShell';
import { complaints, resources } from '../../lib/api';
import { AssignSelect, EmptyState, PageIntro, PriorityBrief, friendlyError, readList, readPeople } from '../../ui/PortalBlocks';
import { PriorityPill, StatusPill, complaintLocation } from '../../ui/CivicUI';

const CLOSED = ['CLOSED', 'VERIFIED', 'COMPLETED'];

export default function SupervisorQueuePage() {
  const [items, setItems] = useState([]);
  const [people, setPeople] = useState([]);
  const [filter, setFilter] = useState('active');
  const [focused, setFocused] = useState(null);
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([complaints.supervisorQueue(), resources.officers()])
      .then(([records, owners]) => {
        setItems(readList(records));
        setPeople(readPeople(owners));
        setError(records?.error || owners?.error || '');
      })
      .catch(() => setError('Could not load the priority queue.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const focus = new URLSearchParams(window.location.search).get('focus');
    if (focus) setFocused(focus);
  }, []);

  const visible = useMemo(() => items.filter(item => {
    const status = String(item.status || '').toUpperCase();
    if (filter === 'all') return true;
    if (filter === 'unassigned') return !item.assigned_worker_id;
    return !CLOSED.includes(status);
  }), [filter, items]);

  const assign = async (item, workerId) => {
    if (!workerId) return;
    setBusy(item._id);
    setError('');
    const result = await complaints.assignWorker(item._id, workerId);
    setBusy('');
    if (result?.success) load();
    else setError(friendlyError(result?.error));
  };

  return <PortalShell role="supervisor">
    <PageIntro eyebrow="PRIORITY QUEUE" title="Decide, assign, move on." detail="The engine explains urgency; you choose the field owner." action={<button className="v-button v-button-ghost" onClick={load}>Refresh</button>} />
    <div className="v-filterbar"><button className={`v-filter ${filter === 'active' ? 'is-active' : ''}`} onClick={() => setFilter('active')}>Active</button><button className={`v-filter ${filter === 'unassigned' ? 'is-active' : ''}`} onClick={() => setFilter('unassigned')}>Needs an owner</button><button className={`v-filter ${filter === 'all' ? 'is-active' : ''}`} onClick={() => setFilter('all')}>All</button><span className="v-result-count">{visible.length} records</span></div>
    {error && <p className="v-form-error">{error}</p>}
    {loading ? <div className="v-loading" style={{ minHeight: 300 }}><div className="v-loading-mark">N</div><p>Reading the queue</p></div> : visible.length ? <>
      <div className="v-table-wrap"><table className="v-table"><thead><tr><th>Complaint</th><th>Priority</th><th>Status</th><th>Field owner</th></tr></thead><tbody>{visible.map(item => {
        const key = item._id || item.complaint_id;
        const assignedName = item.assigned_worker_id?.name || item.assigned_worker_name;
        return <tr key={key} className={focused === key || focused === item.complaint_id ? 'is-focused' : ''}><td><strong>{item.complaint_id}</strong><small>{item.complaint_text || 'Civic issue'}</small><small>{complaintLocation(item)}</small></td><td><div className="v-priority-cell"><PriorityPill value={item.priority_score} /><button className="v-text-button" onClick={() => setFocused(key)}>Explain</button></div></td><td><StatusPill value={item.status} /></td><td><AssignSelect complaint={{ ...item, assigned_officer_id: item.assigned_worker_id?._id || item.assigned_worker_id }} people={people} busy={busy === item._id} onAssign={assign} />{assignedName && <small className="v-assigned-name">Assigned to {assignedName}</small>}</td></tr>;
      })}</tbody></table></div>
      {focused && (() => { const item = items.find(entry => (entry._id || entry.complaint_id) === focused || entry.complaint_id === focused); return item ? <PriorityBrief complaint={item} onClose={() => setFocused(null)} /> : null; })()}
    </> : <EmptyState title="Nothing needs attention" detail="New complaints will appear here after the admin routes them." />}
  </PortalShell>;
}
