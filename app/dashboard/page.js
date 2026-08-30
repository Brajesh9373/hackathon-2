'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredUser, clearToken } from '../lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

function PriorityBadge({ score }) {
  if (score >= 90) return <span style={{ color: '#D50000', fontWeight: 'bold' }}>CRITICAL</span>;
  if (score >= 75) return <span style={{ color: '#E65100', fontWeight: 'bold' }}>HIGH</span>;
  if (score >= 50) return <span style={{ color: '#F57F17' }}>MEDIUM</span>;
  return <span style={{ color: '#2E7D32' }}>LOW</span>;
}

function ActionBadge({ action }) {
  const styles = {
    'ACT': { bg: '#D50000', label: 'ACT NOW' },
    'ACT_PARTIAL': { bg: '#E65100', label: 'PARTIAL' },
    'VERIFY': { bg: '#1565C0', label: 'VERIFY' },
    'SCHEDULE': { bg: '#F57F17', label: 'SCHEDULE' },
    'MONITOR': { bg: '#43A047', label: 'MONITOR' },
    'ESCALATE': { bg: '#7B1FA2', label: 'ESCALATE' },
    'FULL_DEPLOY': { bg: '#D50000', label: 'DEPLOY' },
  };
  const style = styles[action] || { bg: '#666', label: action };
  return (
    <span style={{ background: style.bg, color: 'white', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 'bold' }}>
      {style.label}
    </span>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({});
  const [complaints, setComplaints] = useState([]);
  const [optimizedPlan, setOptimizedPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);

  async function fetchData() {
    setLoading(true);
    try {
      const token = localStorage.getItem('nagarsetu_token');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const statsRes = await fetch(`${API_BASE}/complaints/admin/stats`, { headers });
      const statsData = await statsRes.json();
      setStats(statsData);
      
      const complaintsRes = await fetch(`${API_BASE}/complaints?limit=20`, { headers });
      const complaintsData = await complaintsRes.json();
      setComplaints(complaintsData.complaints || []);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    }
    setLoading(false);
  }

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) {
      router.push('/');
      return;
    }
    setUser(stored);
    void fetchData();
  }, []);

  const runOptimization = async () => {
    setOptimizing(true);
    try {
      const token = localStorage.getItem('nagarsetu_token');
      const headers = { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      
      const res = await fetch(`${API_BASE}/priority/optimize`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          status: ['FILED', 'ASSIGNED'],
          options: { timeHorizon: 8, maxAlternatives: 2 }
        })
      });
      
      const data = await res.json();
      if (data.success) {
        setOptimizedPlan(data);
      }
    } catch (err) {
      console.error('Optimization failed:', err);
    }
    setOptimizing(false);
  };

  const handleLogout = () => {
    clearToken();
    router.push('/');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem' }}>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <div style={{
        background: 'linear-gradient(135deg, #1a237e 0%, #0d47a1 100%)',
        color: 'white', padding: '16px 24px', borderBottom: '4px solid #FF9933'
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: '2rem' }}>KCP</div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '1.25rem' }}>Kopargaon Civic Platform</div>
              <div style={{ opacity: 0.7, fontSize: '0.875rem' }}>Admin Dashboard</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ background: 'rgba(255,255,255,0.15)', padding: '6px 14px', borderRadius: 20 }}>
              {user?.role?.toUpperCase()}
            </span>
            <span>{user?.name}</span>
            <button onClick={handleLogout} style={{
              background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.35)',
              color: 'white', borderRadius: 20, padding: '8px 18px', cursor: 'pointer', fontWeight: 'bold'
            }}>
              Logout
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div style={{ background: 'white', padding: 20, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>📋</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1a237e' }}>{stats.total || 0}</div>
            <div style={{ color: '#666' }}>Total Complaints</div>
          </div>
          <div style={{ background: 'white', padding: 20, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>📝</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1976D2' }}>{stats.filed || 0}</div>
            <div style={{ color: '#666' }}>Filed</div>
          </div>
          <div style={{ background: 'white', padding: 20, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔧</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#F57F17' }}>{stats.inProgress || 0}</div>
            <div style={{ color: '#666' }}>In Progress</div>
          </div>
          <div style={{ background: 'white', padding: 20, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2E7D32' }}>{stats.closed || 0}</div>
            <div style={{ color: '#666' }}>Resolved</div>
          </div>
        </div>

        <div style={{ background: 'white', padding: 24, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0 }}>🎯 Priority Optimization</h2>
              <p style={{ margin: '8px 0 0', color: '#666', fontSize: '0.875rem' }}>
                AI-powered resource allocation
              </p>
            </div>
            <button onClick={runOptimization} disabled={optimizing} style={{
              background: optimizing ? '#ccc' : '#1a237e', color: 'white', border: 'none',
              borderRadius: 8, padding: '12px 24px', cursor: optimizing ? 'not-allowed' : 'pointer', fontWeight: 'bold'
            }}>
              {optimizing ? 'Optimizing...' : '⚡ Run Optimization'}
            </button>
          </div>

          {optimizedPlan && (
            <div style={{ background: '#f8f9fa', padding: 16, borderRadius: 8 }}>
              <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 300 }}>
                  <h4 style={{ margin: '0 0 8px', color: '#D50000' }}>🔴 Immediate Action</h4>
                  {optimizedPlan.selected?.length > 0 ? optimizedPlan.selected.map((item, i) => (
                    <div key={i} style={{ background: 'white', padding: 12, borderRadius: 8, borderLeft: '4px solid #D50000', marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{item.complaint?.complaint_id}</span>
                        <ActionBadge action={item.action} />
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#666', marginTop: 4 }}>
                        {item.complaint?.complaint_text?.substring(0, 60)}...
                      </div>
                    </div>
                  )) : <div style={{ color: '#999', fontStyle: 'italic' }}>None</div>}
                </div>

                <div style={{ flex: 1, minWidth: 300 }}>
                  <h4 style={{ margin: '0 0 8px', color: '#F57F17' }}>📅 Scheduled</h4>
                  {optimizedPlan.scheduled?.length > 0 ? optimizedPlan.scheduled.map((item, i) => (
                    <div key={i} style={{ background: 'white', padding: 12, borderRadius: 8, borderLeft: '4px solid #F57F17', marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{item.complaint?.complaint_id}</span>
                        <ActionBadge action={item.action} />
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#666', marginTop: 4 }}>
                        {item.complaint?.complaint_text?.substring(0, 60)}...
                      </div>
                    </div>
                  )) : <div style={{ color: '#999', fontStyle: 'italic' }}>None</div>}
                </div>
              </div>

              {optimizedPlan.tradeoffs?.length > 0 && (
                <div style={{ marginTop: 16, padding: 12, background: '#fff3e0', borderRadius: 8 }}>
                  <h4 style={{ margin: '0 0 8px' }}>⚖️ Tradeoffs</h4>
                  {optimizedPlan.tradeoffs.slice(0, 2).map((t, i) => (
                    <div key={i} style={{ fontSize: '0.875rem', color: '#666', marginBottom: 4 }}>
                      <strong>{t.type}:</strong> {t.explanation || t.reason}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ background: 'white', padding: 24, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h2 style={{ margin: '0 0 16px' }}>Recent Complaints</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {complaints.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>No complaints found</div>
            ) : complaints.map(c => (
              <div key={c._id} style={{ 
                padding: 16, borderRadius: 8, border: '1px solid #eee',
                borderLeft: c.priority_score >= 75 ? '4px solid #D50000' : 
                           c.priority_score >= 50 ? '4px solid #F57F17' : '4px solid #2E7D32'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#1a237e' }}>
                      {c.complaint_id}
                    </span>
                    <span style={{ marginLeft: 12, fontSize: '0.75rem', padding: '2px 8px', background: c.module === 'WASTE' ? '#e8f5e9' : '#e3f2fd', borderRadius: 4 }}>
                      {c.module}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 'bold', fontSize: '1.25rem' }}>{c.priority_score || 50}</span>
                    <PriorityBadge score={c.priority_score} />
                  </div>
                </div>
                <p style={{ margin: '8px 0', color: '#333' }}>{c.complaint_text}</p>
                <div style={{ display: 'flex', gap: 16, fontSize: '0.75rem', color: '#666' }}>
                  <span>{c.location?.address || 'No address'}</span>
                  <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                  <span style={{ background: c.status === 'CLOSED' ? '#e8f5e9' : '#e3f2fd', padding: '2px 8px', borderRadius: 4 }}>{c.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
