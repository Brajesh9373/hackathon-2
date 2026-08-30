'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PortalShell from '../../ui/PortalShell';
import { complaints } from '../../lib/api';
import { PageIntro, RouteSummary, readList } from '../../ui/PortalBlocks';

export default function SupervisorRoutesPage() {
  const router = useRouter();
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true);
  useEffect(() => { complaints.list({ limit: 100 }).then(result => { setItems(readList(result)); setLoading(false); }); }, []);
  const active = items.filter(item => !['CLOSED','RESOLVED'].includes(String(item.status).toUpperCase()));
  const mapItems = active.slice(0, 8);
  return <PortalShell role="supervisor"><PageIntro eyebrow="ROUTES" title="See the work in motion." detail="Active map markers are drawn from assigned complaints only." action={<button className="v-button v-button-ghost" onClick={() => window.location.reload()}>Refresh</button>} /><div className="v-dashboard-grid"><section className="v-panel"><div className="v-route-map" aria-label="Active complaint routes">{loading ? <div className="v-map-loading">Reading active routes</div> : mapItems.length ? mapItems.map((item, index) => <button key={item._id || item.complaint_id} type="button" className={`v-route-pin ${item.assigned_worker_id ? 'is-worker' : 'is-unassigned'}`} style={{ left: `${18 + ((index * 29) % 68)}%`, top: `${24 + ((index * 37) % 52)}%` }} aria-label={`Open ${item.complaint_id || 'complaint'}`} onClick={() => router.push(`/supervisor/queue?focus=${item.complaint_id || item._id}`)} />) : <div className="v-map-empty">No active routes yet</div>}</div>{mapItems.length > 0 && <div className="v-map-legend"><span><i className="dot-coral" />Needs an owner</span><span><i className="dot-teal" />Assigned worker</span></div>}</section><RouteSummary items={loading ? [] : active.slice(0, 6).map(item => ({ ...item, id: item._id, title: item.complaint_id, detail: `${item.category || 'Civic issue'} / ${item.location?.area || item.location?.address || 'Area pending'}` }))} /></div></PortalShell>;
}
