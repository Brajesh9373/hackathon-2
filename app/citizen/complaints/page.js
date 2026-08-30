'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PortalShell from '../../ui/PortalShell';
import { complaints } from '../../lib/api';
import { ComplaintQueue, EmptyState, PageIntro, readList } from '../../ui/PortalBlocks';

export default function CitizenComplaintsPage() {
  const router = useRouter();
  const [items, setItems] = useState([]); const [filter, setFilter] = useState('all'); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => { complaints.myComplaints().then(result => { setItems(readList(result)); setError(result?.error || ''); setLoading(false); }); }, []);
  const visible = useMemo(() => filter === 'all' ? items : items.filter(item => {
    const status = String(item.status || '').toUpperCase();
    if (filter === 'COMPLETED') return ['COMPLETED', 'VERIFIED', 'CLOSED'].includes(status);
    if (filter === 'AWAITING_VERIFICATION') return ['AWAITING_VERIFICATION', 'PENDING_CLOSURE'].includes(status);
    return status === filter;
  }), [filter, items]);
  return <PortalShell role="citizen"><PageIntro eyebrow="MY COMPLAINTS" title="Your full civic record." detail="Every issue stays addressable, with a progress trail and the next action in view." action={<button className="v-button v-button-primary" onClick={() => router.push('/citizen/new')}>New complaint</button>} /><div className="v-filterbar"><button className={`v-filter ${filter === 'all' ? 'is-active' : ''}`} onClick={() => setFilter('all')}>All <b>{items.length}</b></button>{[['IN_PROGRESS','In progress'],['AWAITING_VERIFICATION','Needs my check'],['COMPLETED','Completed']].map(([value,label]) => <button className={`v-filter ${filter === value ? 'is-active' : ''}`} key={value} onClick={() => setFilter(value)}>{label}</button>)}</div>{error && <p className="v-form-error">{error}</p>}{loading ? <div className="v-loading" style={{ minHeight: 250 }}><div className="v-loading-mark">N</div><p>Loading your record…</p></div> : visible.length ? <ComplaintQueue items={visible} onOpen={item => router.push(`/citizen/complaints/${item.complaint_id || item._id}`)} /> : <EmptyState icon="" title={items.length ? 'No complaints match this filter' : 'Nothing filed yet'} detail={items.length ? 'Choose another view to see the rest of your record.' : 'Start with a short description and the location of the issue.'} action={!items.length && <button className="v-button v-button-primary" onClick={() => router.push('/citizen/new')}>File an issue</button>} />}</PortalShell>;
}
