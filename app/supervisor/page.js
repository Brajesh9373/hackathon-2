'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PortalShell from '../ui/PortalShell';
import { complaints } from '../lib/api';
import { DashboardStats, EmptyState, PageIntro, QueueList, deriveStats, readList } from '../ui/PortalBlocks';

export default function SupervisorOverview() {
  const router = useRouter(); const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => { complaints.list({ limit: 100 }).then(result => { setItems(readList(result)); setError(result?.error || ''); setLoading(false); }); }, []);
  return <PortalShell role="supervisor"><PageIntro eyebrow="FIELD SUPERVISION" title="Keep the next move obvious." detail="Prioritise the work your area needs, then hand it to a named field owner." action={<button className="v-button v-button-primary" onClick={() => router.push('/supervisor/queue')}>Open priority queue <span>→</span></button>} />{error && <p className="v-form-error">{error}</p>}<DashboardStats stats={deriveStats(items)} /><div className="v-dashboard-grid"><section className="v-panel"><div className="v-section-heading"><div><span className="v-eyebrow">YOUR AREA</span><h2>What needs a decision</h2><p>Urgent and unassigned records rise to the top.</p></div></div>{loading ? <div className="v-loading" style={{ minHeight: 180 }}><div className="v-loading-mark">V</div></div> : <QueueList items={items.filter(item => !['CLOSED','RESOLVED'].includes(String(item.status).toUpperCase()))} onOpen={item => router.push(`/supervisor/queue?focus=${item.complaint_id || item._id}`)} limit={7} showPriority />}</section><section className="v-panel v-panel-soft"><span className="v-eyebrow">SUPERVISOR SIGNAL</span><h2 className="v-side-title">Capacity is a civic resource.</h2><p className="v-side-copy">Assign by proximity and availability. The owner’s name stays attached to the citizen’s record.</p><button className="v-button v-button-secondary" onClick={() => router.push('/supervisor/routes')}>See route view <span>→</span></button></section></div></PortalShell>;
}
