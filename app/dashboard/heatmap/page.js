'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredUser, clearToken } from '../../lib/api';
import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues with Leaflet
const ComplaintHeatmap = dynamic(() => import('../../components/ComplaintHeatmap'), { 
  ssr: false,
  loading: () => <div style={{ height: '400px', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading Map...</div>
});

export default function HeatmapPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) {
      router.push('/');
      return;
    }
    setUser(stored);
    fetchComplaints();
  }, []);

  const fetchComplaints = async () => {
    try {
      const res = await fetch('/api/complaints');
      const data = await res.json();
      setComplaints(data.complaints || []);
    } catch (err) {
      console.error('Failed to fetch complaints:', err);
    }
    setLoading(false);
  };

  const handleLogout = () => {
    clearToken();
    router.push('/');
  };

  const filteredComplaints = complaints.filter(c => {
    if (filter === 'pending') return ['FILED', 'ASSIGNED', 'IN_PROGRESS', 'AWAITING_VERIFICATION'].includes(c.status);
    if (filter === 'resolved') return ['COMPLETED', 'VERIFIED', 'CLOSED'].includes(c.status);
    return true;
  });

  // Stats
  const totalComplaints = complaints.length;
  const pendingComplaints = complaints.filter(c => ['FILED', 'ASSIGNED', 'IN_PROGRESS'].includes(c.status)).length;
  const resolvedComplaints = complaints.filter(c => ['COMPLETED', 'VERIFIED', 'CLOSED'].includes(c.status)).length;
  const criticalComplaints = complaints.filter(c => c.priority_score >= 90).length;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem' }}>🔄</div>
          <div>Loading Dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, var(--c1) 0%, var(--c2) 100%)',
        color: 'white', padding: '16px 24px'
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontSize: '1.5rem' }}>🗺️</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>Kopargaon Complaint Heatmap</div>
              <div style={{ opacity: 0.7, fontSize: '0.875rem' }}>Ward-wise complaint density visualization</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ background: 'rgba(255,255,255,0.15)', padding: '6px 14px', borderRadius: 9999, fontWeight: 600 }}>
              {user?.name}
            </span>
            <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.35)', color: 'white', borderRadius: 9999, padding: '8px 18px', cursor: 'pointer', fontWeight: 700 }}>
              🚪 Logout
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: 'white', borderRadius: 12, padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--t2)', marginBottom: '8px' }}>Total Complaints</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--c1)' }}>{totalComplaints}</div>
          </div>
          <div style={{ background: 'white', borderRadius: 12, padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--t2)', marginBottom: '8px' }}>Pending</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#e74c3c' }}>{pendingComplaints}</div>
          </div>
          <div style={{ background: 'white', borderRadius: 12, padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--t2)', marginBottom: '8px' }}>Resolved</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#2ecc71' }}>{resolvedComplaints}</div>
          </div>
          <div style={{ background: 'white', borderRadius: 12, padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--t2)', marginBottom: '8px' }}>Critical</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#c0392b' }}>{criticalComplaints}</div>
          </div>
        </div>

        {/* Filter */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          <button
            onClick={() => setFilter('all')}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600,
              background: filter === 'all' ? 'var(--c1)' : 'white',
              color: filter === 'all' ? 'white' : 'var(--t)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            All Complaints
          </button>
          <button
            onClick={() => setFilter('pending')}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600,
              background: filter === 'pending' ? 'var(--c1)' : 'white',
              color: filter === 'pending' ? 'white' : 'var(--t)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            Pending Only
          </button>
          <button
            onClick={() => setFilter('resolved')}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600,
              background: filter === 'resolved' ? 'var(--c1)' : 'white',
              color: filter === 'resolved' ? 'white' : 'var(--t)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            Resolved Only
          </button>
        </div>

        {/* Heatmap */}
        <div style={{ background: 'white', borderRadius: 12, padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h2 style={{ marginBottom: '16px' }}>📍 Kopargaon Ward Heatmap</h2>
          <ComplaintHeatmap complaints={filteredComplaints} />
        </div>
      </div>
    </div>
  );
}
