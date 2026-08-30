'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PortalShell from '../ui/PortalShell';
import { complaints } from '../lib/api';
import { ComplaintQueue, DashboardStats, EmptyState, PageIntro, QueueList, deriveStats, readList } from '../ui/PortalBlocks';

export default function AdminOverview() {
  const router = useRouter(); const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => { complaints.list({ limit: 100 }).then(result => { setItems(readList(result)); setError(result?.error || ''); setLoading(false); }); }, []);
  return <PortalShell role="admin"><PageIntro eyebrow="ADMIN CONTROL" title="See the network, then move it." detail="A compact operating view for routing demand to the right person without losing the citizen context." action={<button className="v-button v-button-primary" onClick={() => router.push('/admin/complaints')}>Open routing desk</button>} />{error && <p className="v-form-error">{error}</p>}<DashboardStats stats={deriveStats(items)} /><div className="v-dashboard-grid"><section className="v-panel"><div className="v-section-heading"><div><span className="v-eyebrow">LIVE REGISTER</span><h2>Recent demand</h2><p>Prioritised by the records that need a hand-off.</p></div><button className="v-button v-button-ghost" onClick={() => router.push('/admin/complaints')}>Routing desk</button></div>{loading ? <div className="v-loading" style={{ minHeight: 180 }}><div className="v-loading-mark">N</div></div> : <QueueList items={items} onOpen={item => router.push(`/admin/complaints?focus=${item.complaint_id || item._id}`)} showPriority />}</section><section className="v-panel v-panel-soft"><span className="v-eyebrow">OPERATING PRINCIPLE</span><h2 className="v-side-title">No orphaned work.</h2><p className="v-side-copy">Every submitted complaint should have a visible owner, a next step and a record of what happened.</p><div className="v-principle"><span>01</span><strong>Route</strong><small>Choose the person with capacity.</small></div><div className="v-principle"><span>02</span><strong>Watch</strong><small>Supervisors see the priority queue.</small></div><div className="v-principle"><span>03</span><strong>Prove</strong><small>Evidence closes the loop.</small></div></section></div></PortalShell>;
}
