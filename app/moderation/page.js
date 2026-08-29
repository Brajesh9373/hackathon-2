'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredUser, clearToken } from '../lib/api';
import ModerationDashboard from '../components/ModerationDashboard';

export default function ModerationPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored || !['supervisor', 'admin'].includes(stored.role)) {
      router.push('/');
      return;
    }
    setUser(stored);
    setLoading(false);
  }, []);

  const handleLogout = () => {
    clearToken();
    router.push('/');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem' }}>🔄</div>
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1a237e 0%, #283593 100%)',
        color: 'white',
        padding: '16px 24px'
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontSize: '1.5rem' }}>🛡️</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>Misinformation Detection Dashboard</div>
              <div style={{ opacity: 0.7, fontSize: '0.875rem' }}>Kopargaon Civic Platform</div>
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

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px' }}>
        <ModerationDashboard />
      </div>
    </div>
  );
}
