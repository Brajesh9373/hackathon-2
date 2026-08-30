'use client';

import { useEffect, useState } from 'react';
import PortalShell from '../../ui/PortalShell';
import { complaints } from '../../lib/api';
import { EmptyState, PageIntro, RouteSummary, readList } from '../../ui/PortalBlocks';

export default function SupervisorRoutesPage() {
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true);
  useEffect(() => { complaints.list({ limit: 100 }).then(result => { setItems(readList(result)); setLoading(false); }); }, []);
  const active = items.filter(item => !['CLOSED','RESOLVED'].includes(String(item.status).toUpperCase()));
  return <PortalShell role="supervisor"><PageIntro eyebrow="ROUTES" title="See the work in motion." detail="A simple route view for today’s active field movement." action={<button className="v-button v-button-ghost" onClick={() => window.location.reload()}>Refresh</button>} /><div className="v-dashboard-grid"><section className="v-panel"><div className="v-route-map"><span className="v-route-pin v-route-pin-a">!</span><span className="v-route-pin v-route-pin-b">W</span><span className="v-route-pin v-route-pin-c">C</span></div><div className="v-map-legend"><span><i className="dot-coral" />Needs attention</span><span><i className="dot-teal" />Worker</span><span><i className="dot-ink" />Crew</span></div></section><RouteSummary items={loading ? [] : active.slice(0, 6).map(item => ({ ...item, id: item._id, title: item.complaint_id, detail: `${item.category || 'Civic issue'} · ${item.location?.area || item.location?.address || 'Area pending'}` }))} /></div></PortalShell>;
}
