'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PortalShell from '../../../ui/PortalShell';
import { agents, complaints, verification } from '../../../lib/api';
import CaseStatusRail from '../../../ui/CaseStatusRail';
import { ActivityList, EmptyState, InlineNotice, LoadingState, PageIntro, readComplaint } from '../../../ui/PortalBlocks';
import { PriorityPill, StatusPill, complaintLocation, formatDate, formatRelative, ProgressRail } from '../../../ui/CivicUI';

export default function CitizenComplaintDetail() {
  const { id } = useParams(); const router = useRouter();
  const [item, setItem] = useState(null); const [agent, setAgent] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const load = () => complaints.get(id).then(result => { const complaint = readComplaint(result); setItem(complaint); setError(result?.error || ''); setLoading(false); if (complaint) agents.forComplaint(id).then(agentResult => setAgent(agentResult?.agent || null)).catch(() => null); }).catch(() => { setError('Could not find this complaint.'); setLoading(false); });
  useEffect(() => { load(); const interval = setInterval(load, 10000); return () => clearInterval(interval); }, [id]);
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
  useEffect(() => { if (item?.verification?.status === 'calling') setNotice('NagarSetu is calling the citizen now. The call response will update this record automatically.'); else if (item?.verification?.status === 'confirmed' || ['COMPLETED', 'CLOSED'].includes(String(item?.status || '').toUpperCase())) setNotice('The citizen confirmed the work by phone. This complaint is complete.'); else if (item?.verification?.status === 'unresolved' || item?.status === 'REOPENED') setNotice('The citizen reported that the issue is still present. A supervisor can route follow-up work.'); }, [item]);
  if (loading) return <PortalShell role="citizen"><LoadingState /></PortalShell>;
  if (!item) return <PortalShell role="citizen"><EmptyState title="Complaint not found" detail={error || 'This record may have moved.'} action={<button className="v-button v-button-ghost" onClick={() => router.push('/citizen/complaints')}>Back to complaints</button>} /></PortalShell>;
  const owner = item.assigned_worker_id?.name || item.assigned_supervisor_id?.name || item.assigned_worker_name || item.assigned_supervisor_name;
  const waitingForCall = ['AWAITING_VERIFICATION', 'PENDING_CLOSURE', 'PROVISIONALLY_CLOSED'].includes(String(item.status).toUpperCase());
  return <PortalShell role="citizen"><PageIntro eyebrow={item.complaint_id || 'COMPLAINT'} title="A clear view of what happens next." detail={`Filed ${formatDate(item.createdAt)} / ${complaintLocation(item)}`} action={<button className="v-button v-button-ghost" onClick={() => router.push('/citizen/complaints')}>All complaints</button>} /><div className="v-detail-grid"><div className="v-panel"><div className="v-detail-title"><div><span className="v-eyebrow">ISSUE</span><h1>{item.complaint_text || 'Civic issue'}</h1><p>{complaintLocation(item)}</p></div><div style={{ display: 'grid', justifyItems: 'end', gap: 8 }}><PriorityPill value={item.priority_score} /><StatusPill value={item.status} /></div></div><ProgressRail status={item.status} />{waitingForCall && <InlineNotice tone="warm"><strong>Work submitted for phone verification.</strong><span>NagarSetu will call the citizen. There are no manual closure controls on this page.</span></InlineNotice>}{notice && <InlineNotice tone="success">{notice}</InlineNotice>}<div className="v-section-heading"><div><span className="v-eyebrow">TIMELINE</span><h2>What has happened</h2></div></div><ActivityList timeline={item.timeline || []} /></div><aside className="v-detail-aside"><CaseStatusRail agent={agent} complaint={item} /><section className="v-panel"><span className="v-eyebrow">AT A GLANCE</span><div className="v-key-list"><div><span>Reference</span><strong>{item.complaint_id || '-'}</strong></div><div><span>Category</span><strong>{String(item.category || 'Other').replace(/_/g, ' ')}</strong></div><div><span>Assigned owner</span><strong>{owner || 'Being routed'}</strong></div><div><span>Call status</span><strong>{item.verification?.status || 'Not started'}</strong></div><div><span>Last update</span><strong>{formatRelative(item.updatedAt || item.createdAt)}</strong></div></div>{item.media_urls?.length > 0 && <><div className="v-section-heading" style={{ marginTop: 30 }}><div><span className="v-eyebrow">EVIDENCE</span><h2>Photos</h2></div></div><div className="v-photo-preview">{item.media_urls.map((media, index) => <img src={media.url || media} alt={`Complaint evidence ${index + 1}`} key={`${media.url || media}-${index}`} />)}</div></>}</section></aside></div>{error && <p className="v-form-error">{error}</p>}</PortalShell>;
}
