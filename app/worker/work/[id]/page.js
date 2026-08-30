'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PortalShell from '../../../ui/PortalShell';
import { complaints, verification } from '../../../lib/api';
import { ActivityList, EmptyState, LoadingState, PageIntro, readComplaint } from '../../../ui/PortalBlocks';
import { PriorityPill, ProgressRail, StatusPill, complaintLocation, formatDate } from '../../../ui/CivicUI';

export default function WorkerWorkDetailPage() {
  const { id } = useParams(); const router = useRouter(); const [item, setItem] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = () => complaints.get(id).then(result => { setItem(readComplaint(result)); setError(result?.error || ''); setLoading(false); });
  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    if (!item?.verification?.call_id || !['calling', 'pending'].includes(item.verification.status)) return undefined;
    const poll = async () => {
      const result = await verification.status(id);
      if (['confirmed', 'unresolved'].includes(result?.decision)) load();
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [id, item?.verification?.call_id, item?.verification?.status]);
  if (loading) return <PortalShell role="worker"><LoadingState /></PortalShell>;
  if (!item) return <PortalShell role="worker"><EmptyState title="Work record not found" detail={error || 'This record is unavailable.'} action={<button className="v-button v-button-ghost" onClick={() => router.push('/worker/completed')}>Back to completed</button>} /></PortalShell>;
  const resolution = item.resolution || item.closure || {};
  return <PortalShell role="worker"><PageIntro eyebrow={item.complaint_id || 'COMPLETED WORK'} title="Work record." detail={`${complaintLocation(item)} / Filed ${formatDate(item.createdAt)}`} action={<button className="v-button v-button-ghost" onClick={() => router.push('/worker/completed')}>Back to completed work</button>} /><div className="v-detail-grid"><div className="v-panel"><div className="v-detail-title"><div><span className="v-eyebrow">CITIZEN ISSUE</span><h1>{item.complaint_text || 'Civic issue'}</h1><p>{complaintLocation(item)}</p></div><div style={{ display: 'grid', justifyItems: 'end', gap: 8 }}><PriorityPill value={item.priority_score} /><StatusPill value={item.status} /></div></div><ProgressRail status={item.status} /><div className="v-section-heading"><div><span className="v-eyebrow">WORK LOG</span><h2>Evidence trail</h2></div></div><ActivityList timeline={item.timeline || []} /></div><aside className="v-panel"><span className="v-eyebrow">AT A GLANCE</span><div className="v-key-list"><div><span>Category</span><strong>{String(item.category || 'Other').replace(/_/g, ' ')}</strong></div><div><span>Citizen confirmation</span><strong>{item.citizen_confirmation?.response || item.verification?.status || 'Pending'}</strong></div><div><span>Resolution note</span><strong>{resolution.resolution_note || '-'}</strong></div></div>{resolution.resolution_photos?.length > 0 && <><div className="v-section-heading" style={{ marginTop: 30 }}><div><span className="v-eyebrow">COMPLETION PROOF</span><h2>Photos</h2></div></div><div className="v-photo-preview">{resolution.resolution_photos.map((photo, index) => <img key={`${photo.url || photo}-${index}`} src={photo.url || photo} alt={`Completion proof ${index + 1}`} />)}</div></>}</aside></div></PortalShell>;
}
