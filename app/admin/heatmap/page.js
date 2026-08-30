'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import PortalShell from '../../ui/PortalShell';
import { complaints } from '../../lib/api';
import { PageIntro, readList } from '../../ui/PortalBlocks';

const ComplaintHeatmap = dynamic(() => import('../../components/ComplaintHeatmap'), { ssr: false });

export default function AdminHeatmapPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = () => {
    setLoading(true);
    complaints.list({ limit: 100 }).then(result => {
      setItems(readList(result));
      setError(result?.error || '');
    }).catch(() => setError('Could not load the complaint map.')).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  return <PortalShell role="admin"><PageIntro eyebrow="NETWORK MAP" title="See where demand is gathering." detail="Density, priority and ownership come from the live complaint register. This pilot keeps every complaint at Sanjivani University, Kopargaon." action={<button className="v-button v-button-ghost" onClick={load}>Refresh map</button>} />{error && <p className="v-form-error">{error}</p>}{loading ? <div className="v-loading" style={{ minHeight: 420 }}><div className="v-loading-mark">N</div><p>Preparing the live map</p></div> : <ComplaintHeatmap complaints={items} />}</PortalShell>;
}
