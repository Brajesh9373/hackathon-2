'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PortalShell from '../ui/PortalShell';
import { complaints } from '../lib/api';
import { ComplaintQueue, DashboardStats, EmptyState, PageIntro, QueueList, deriveStats, readList } from '../ui/PortalBlocks';

export default function CitizenOverview() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { complaints.myComplaints().then(result => { setItems(readList(result)); setError(result?.error || ''); setLoading(false); }).catch(() => { setError('Could not load your complaints.'); setLoading(false); }); }, []);
  const stats = deriveStats(items);
  return <PortalShell role="citizen"><PageIntro eyebrow="YOUR CIVIC RECORD" title="Good morning, your voice is on the record." detail="File a local issue, see who owns it, and get a clear answer when the work is done." action={<button className="v-button v-button-primary" onClick={() => router.push('/citizen/new')}>+ New complaint</button>} />
    {error && <p className="v-form-error">{error}</p>}
    <DashboardStats stats={stats} variant="citizen" />
    <div className="v-dashboard-grid"><section className="v-panel"><div className="v-section-heading"><div><span className="v-eyebrow">RECENTLY FILED</span><h2>Your complaints</h2><p>Follow every hand-off from filing to confirmation.</p></div><button className="v-button v-button-ghost" onClick={() => router.push('/citizen/complaints')}>View all</button></div>{loading ? <div className="v-loading" style={{ minHeight: 180 }}><div className="v-loading-mark">V</div></div> : <ComplaintQueue items={items} onOpen={item => router.push(`/citizen/complaints/${item.complaint_id || item._id}`)} emptyTitle="Your record is empty" emptyDetail="When you raise your first complaint, its progress will stay visible here." />}</section><section className="v-panel v-panel-soft"><span className="v-eyebrow">HOW IT MOVES</span><h2 className="v-side-title">One clear loop.</h2><div className="v-steps"><div><b>01</b><span><strong>Tell us</strong><small>Describe the issue and add a photo.</small></span></div><div><b>02</b><span><strong>We route it</strong><small>A civic owner takes responsibility.</small></span></div><div><b>03</b><span><strong>You confirm</strong><small>Only your yes closes the loop.</small></span></div></div><button className="v-button v-button-secondary" onClick={() => router.push('/citizen/new')}>Start a complaint <span>→</span></button></section></div>
  </PortalShell>;
}
