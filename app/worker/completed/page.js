'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PortalShell from '../../ui/PortalShell';
import { complaints } from '../../lib/api';
import { ComplaintQueue, EmptyState, PageIntro } from '../../ui/PortalBlocks';

export default function WorkerCompletedPage() {
  const router = useRouter(); const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => { complaints.workerTasks().then(result => { setItems(result?.completedTasks || []); setError(result?.error || ''); setLoading(false); }).catch(() => { setError('Could not load completed work.'); setLoading(false); }); }, []);
  return <PortalShell role="worker"><PageIntro eyebrow="COMPLETED WORK" title="Proof of work, kept visible." detail="Your completed jobs remain addressable after they leave the active queue." action={<button className="v-button v-button-primary" onClick={() => router.push('/worker')}>Back to active work</button>} />{error && <p className="v-form-error">{error}</p>}{loading ? <div className="v-loading" style={{ minHeight: 250 }}><div className="v-loading-mark">N</div></div> : items.length ? <ComplaintQueue items={items} onOpen={item => router.push(`/worker/work/${item.complaint_id || item._id}`)} /> : <EmptyState icon="Done" title="No completed work yet" detail="When a citizen confirms a resolution, the job will appear here." />}</PortalShell>;
}
