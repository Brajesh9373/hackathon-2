'use client';

import { useState, useEffect } from 'react';
import { getStoredUser } from '../lib/api';

export default function ModerationDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [claims, setClaims] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [moderationAction, setModerationAction] = useState('');

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored || !['supervisor', 'admin'].includes(stored.role)) {
      return;
    }
    setUser(stored);
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch pending claims
      const res = await fetch('/api/moderation/claims?status=PENDING');
      const data = await res.json();
      if (data.claims) {
        setClaims(data.claims);
      }

      // Fetch stats
      const statsRes = await fetch('/api/moderation/stats');
      const statsData = await statsRes.json();
      if (statsData.stats) {
        setStats(statsData.stats);
      }
    } catch (err) {
      console.error('Failed to fetch moderation data:', err);
    }
    setLoading(false);
  };

  const handleVerifyClaim = async (claimId) => {
    try {
      const res = await fetch(`/api/moderation/claims/${claimId}/verify`);
      const data = await res.json();
      if (data.verification) {
        setVerificationResult(data.verification);
        setSelectedClaim(claims.find(c => c._id === claimId));
      }
    } catch (err) {
      console.error('Failed to verify claim:', err);
    }
  };

  const handleModerate = async (claimId, action) => {
    try {
      const res = await fetch(`/api/moderation/claims/${claimId}/moderate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: '' })
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        setSelectedClaim(null);
        setVerificationResult(null);
      }
    } catch (err) {
      console.error('Failed to moderate claim:', err);
    }
  };

  const getVerificationBadge = (status) => {
    switch (status) {
      case 'VERIFIED':
        return { bg: '#e8f5e9', color: '#2e7d32', label: '✓ Verified' };
      case 'LIKELY_FALSE':
        return { bg: '#ffebee', color: '#c62828', label: '⚠️ Likely False' };
      case 'PARTIALLY_VERIFIED':
        return { bg: '#fff3e0', color: '#e65100', label: '◐ Partially Verified' };
      case 'NEEDS_REVIEW':
        return { bg: '#fff8e1', color: '#f9a825', label: '👁️ Needs Review' };
      case 'FALSE_CLAIM':
        return { bg: '#ffcdd2', color: '#b71c1c', label: '✕ False Claim' };
      default:
        return { bg: '#eceff1', color: '#546e7a', label: '○ Unverified' };
    }
  };

  const getTrustBadge = (score) => {
    if (score >= 80) return { bg: '#e8f5e9', color: '#2e7d32' };
    if (score >= 50) return { bg: '#fff3e0', color: '#e65100' };
    return { bg: '#ffebee', color: '#c62828' };
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem' }}>🔄</div>
          <div>Loading Moderation Dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1a237e 0%, #283593 100%)',
        color: 'white',
        padding: '20px 24px',
        borderRadius: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem' }}>🛡️ Misinformation Detection Dashboard</h2>
            <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: '0.9rem' }}>
              Verify claims, detect fake patterns, and stop false information
            </p>
          </div>
          <button
            onClick={fetchData}
            style={{
              padding: '10px 20px',
              background: 'rgba(255,255,255,0.2)',
              border: '1.5px solid rgba(255,255,255,0.4)',
              color: 'white',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
          <div style={{ background: 'white', padding: '16px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1565c0' }}>{stats.totalProcessed}</div>
            <div style={{ fontSize: '0.8rem', color: '#666' }}>Total Processed</div>
          </div>
          <div style={{ background: 'white', padding: '16px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#2e7d32' }}>{stats.verified}</div>
            <div style={{ fontSize: '0.8rem', color: '#666' }}>Verified</div>
          </div>
          <div style={{ background: 'white', padding: '16px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#c62828' }}>{stats.falseClaimsDetected}</div>
            <div style={{ fontSize: '0.8rem', color: '#666' }}>False Claims</div>
          </div>
          <div style={{ background: 'white', padding: '16px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#e65100' }}>{stats.coordinatedFakesDetected}</div>
            <div style={{ fontSize: '0.8rem', color: '#666' }}>Coordinated Fakes</div>
          </div>
          <div style={{ background: 'white', padding: '16px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#546e7a' }}>{stats.pending}</div>
            <div style={{ fontSize: '0.8rem', color: '#666' }}>Pending Review</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {['pending', 'verified', 'rejected'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === tab ? '#1a237e' : '#e0e0e0',
              color: activeTab === tab ? 'white' : '#333',
              cursor: 'pointer',
              fontWeight: 600,
              textTransform: 'capitalize',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Claims List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {claims.length === 0 ? (
          <div style={{ background: 'white', padding: '40px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>✅</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>No {activeTab} claims</div>
          </div>
        ) : (
          claims.map(claim => {
            const badge = getVerificationBadge(claim.verificationStatus);
            const trustBadge = getTrustBadge(claim.trustScore);
            
            return (
              <div key={claim._id} style={{
                background: 'white',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                borderLeft: `4px solid ${badge.color}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1565c0' }}>
                        {claim.complaint_id}
                      </span>
                      <span style={{
                        padding: '2px 10px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        background: badge.bg,
                        color: badge.color,
                        fontWeight: 600,
                      }}>
                        {badge.label}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '4px' }}>
                      👤 {claim.citizenName} | 📍 Ward {claim.ward?.replace('ward_', '')} | 📱 {claim.citizenPhone}
                    </div>
                  </div>
                  <div style={{
                    padding: '4px 12px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    background: trustBadge.bg,
                    color: trustBadge.color,
                    fontWeight: 700,
                  }}>
                    Trust: {claim.trustScore}%
                  </div>
                </div>

                <div style={{
                  padding: '12px',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  marginBottom: '12px',
                  fontSize: '0.95rem',
                  lineHeight: 1.5,
                }}>
                  "{claim.complaint_text}"
                </div>

                {claim.flaggedReason && (
                  <div style={{
                    padding: '10px',
                    background: '#fff3e0',
                    borderRadius: '6px',
                    marginBottom: '12px',
                    fontSize: '0.85rem',
                    borderLeft: '3px solid #e65100',
                  }}>
                    <strong>⚠️ Flagged:</strong> {claim.flaggedReason}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => handleVerifyClaim(claim._id)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: '1.5px solid #1565c0',
                      background: 'white',
                      color: '#1565c0',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    🔍 Verify
                  </button>
                  <button
                    onClick={() => handleModerate(claim._id, 'APPROVED')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: 'none',
                      background: '#2e7d32',
                      color: 'white',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => handleModerate(claim._id, 'REJECTED')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: 'none',
                      background: '#c62828',
                      color: 'white',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    ✕ Reject
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Verification Modal */}
      {selectedClaim && verificationResult && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto',
            padding: '24px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>🔍 Verification Result</h3>
              <button
                onClick={() => { setSelectedClaim(null); setVerificationResult(null); }}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Verification Status */}
            <div style={{
              padding: '16px',
              background: getVerificationBadge(verificationResult.verificationStatus).bg,
              borderRadius: '10px',
              marginBottom: '16px',
            }}>
              <div style={{ fontWeight: 700, color: getVerificationBadge(verificationResult.verificationStatus).color, fontSize: '1.1rem' }}>
                Status: {verificationResult.verificationStatus}
              </div>
              {verificationResult.matchesFound?.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  {verificationResult.matchesFound.map((match, i) => (
                    <div key={i} style={{
                      padding: '10px',
                      background: 'white',
                      borderRadius: '6px',
                      marginTop: '8px',
                    }}>
                      <div style={{ fontWeight: 600 }}>📊 {match.type?.toUpperCase()} Claim</div>
                      <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '4px' }}>
                        {match.message}
                      </div>
                      {match.truth && (
                        <div style={{ fontSize: '0.85rem', color: '#2e7d32', marginTop: '4px' }}>
                          ✅ Official: {match.truth}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Warnings */}
            {verificationResult.warnings?.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                {verificationResult.warnings.map((warning, i) => (
                  <div key={i} style={{
                    padding: '10px',
                    background: '#fff3e0',
                    borderRadius: '6px',
                    marginBottom: '8px',
                    borderLeft: '3px solid #e65100',
                  }}>
                    ⚠️ {warning.message}
                  </div>
                ))}
              </div>
            )}

            {/* Fact Check */}
            {verificationResult.factCheck && (
              <div style={{
                padding: '16px',
                background: '#ffebee',
                borderRadius: '10px',
                marginBottom: '16px',
                borderLeft: '4px solid #c62828',
              }}>
                <div style={{ fontWeight: 700, color: '#c62828', marginBottom: '8px' }}>
                  🚫 Known False Claim
                </div>
                <div style={{ fontSize: '0.9rem' }}>
                  {verificationResult.factCheck.warning}
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setSelectedClaim(null); setVerificationResult(null); }}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: '1.5px solid #e0e0e0',
                  background: 'white',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleModerate(selectedClaim._id, 'REJECTED')}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#c62828',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Mark as False
              </button>
              <button
                onClick={() => handleModerate(selectedClaim._id, 'APPROVED')}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#2e7d32',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recent Alerts */}
      {stats?.recentAlerts?.length > 0 && (
        <div style={{
          background: 'white',
          padding: '16px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}>
          <h3 style={{ margin: '0 0 12px 0' }}>📢 Recent Alerts</h3>
          {stats.recentAlerts.map((alert, i) => (
            <div key={i} style={{
              padding: '10px',
              background: '#f8f9fa',
              borderRadius: '6px',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <span style={{ fontSize: '1.2rem' }}>{alert.type === 'FALSE_CLAIM' ? '🚫' : '🔍'}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{alert.message}</div>
                <div style={{ fontSize: '0.75rem', color: '#666' }}>{alert.time}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
