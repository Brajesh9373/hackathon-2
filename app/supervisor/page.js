'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredUser, setToken, setStoredUser, clearToken, complaints, resources } from '../lib/api';
import dynamic from 'next/dynamic';
import { initRadar, checkLocationForCalling, RESTRICTED_PLACE_TYPES } from '../lib/geofencing';

// Dynamic imports for Leaflet (SSR issue)
const ComplaintHeatmap = dynamic(() => import('../components/ComplaintHeatmap'), { 
  ssr: false,
  loading: () => <div style={{ padding: '40px', textAlign: 'center' }}>Loading Map...</div>
});

const GeofencingStatus = dynamic(() => import('../components/GeofencingStatus'), { 
  ssr: false,
  loading: () => <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>
});

const KOPARGAON_CATEGORIES = [
  // Development
  { id: 'BLOCKED_DRAIN', label: 'Blocked Drain', module: 'DEVELOPMENT' },
  { id: 'BLOCKED_SEWAGE', label: 'Blocked Sewage', module: 'DEVELOPMENT' },
  { id: 'POTHOLE', label: 'Pothole', module: 'DEVELOPMENT' },
  { id: 'MANHOLE_ISSUE', label: 'Manhole Issue', module: 'DEVELOPMENT' },
  { id: 'ROAD_DAMAGE', label: 'Road Damage', module: 'DEVELOPMENT' },
  { id: 'FLOODING', label: 'Flooding', module: 'DEVELOPMENT' },
  { id: 'WATER_LOGGING', label: 'Water Logging', module: 'DEVELOPMENT' },
  { id: 'STREETLIGHT', label: 'Streetlight Issue', module: 'DEVELOPMENT' },
  { id: 'ELECTRICITY', label: 'Electricity Issue', module: 'DEVELOPMENT' },
  // Waste
  { id: 'GARBAGE_NOT_COLLECTED', label: 'Garbage Not Collected', module: 'WASTE' },
  { id: 'BIN_OVERFLOW', label: 'Bin Overflow', module: 'WASTE' },
  { id: 'ILLEGAL_DUMPING', label: 'Illegal Dumping', module: 'WASTE' },
  { id: 'WASTE_ACCUMULATION', label: 'Waste Accumulation', module: 'WASTE' },
  { id: 'MISSED_COLLECTION', label: 'Missed Collection', module: 'WASTE' },
];

const PRIORITY_COLORS = {
  CRITICAL: '#D50000',
  HIGH: '#E65100',
  MEDIUM: '#F57F17',
  LOW: '#2E7D32'
};

function getPriorityInfo(score) {
  if (score >= 90) return { label: 'CRITICAL', color: PRIORITY_COLORS.CRITICAL, icon: '🔴' };
  if (score >= 75) return { label: 'HIGH', color: PRIORITY_COLORS.HIGH, icon: '🟠' };
  if (score >= 50) return { label: 'MEDIUM', color: PRIORITY_COLORS.MEDIUM, icon: '🟡' };
  return { label: 'LOW', color: PRIORITY_COLORS.LOW, icon: '🟢' };
}

export default function SupervisorDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [complaints, setComplaints] = useState([]);
  const [availableWorkers, setAvailableWorkers] = useState([]);
  const [stats, setStats] = useState({});
  const [activeTab, setActiveTab] = useState('queue');
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const [overridePriority, setOverridePriority] = useState(50);
  const [overrideReason, setOverrideReason] = useState('');
  const [showGeofencingModal, setShowGeofencingModal] = useState(false);
  const [geofencingStatus, setGeofencingStatus] = useState(null);
  const [geofencingLoading, setGeofencingLoading] = useState(false);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored || stored.role !== 'supervisor') {
      router.push('/');
      return;
    }
    setUser(stored);
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/complaints/supervisor/queue');
      const data = await res.json();
      if (data.complaints) {
        setComplaints(data.complaints);
        setAvailableWorkers(data.availableWorkers || []);
      }
      
      const statsRes = await fetch('/api/complaints/admin/stats');
      const statsData = await statsRes.json();
      setStats(statsData);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    }
    setLoading(false);
  };

  const handleLogout = () => {
    clearToken();
    router.push('/');
  };

  const handlePriorityOverride = async () => {
    if (!selectedComplaint) return;
    try {
      const res = await fetch(`/api/complaints/${selectedComplaint._id}/priority`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priority_score: overridePriority,
          priority_reason: overrideReason
        })
      });
      if (res.ok) {
        fetchData();
        setShowPriorityModal(false);
      }
    } catch (err) {
      console.error('Failed to update priority:', err);
    }
  };

  const handleAssignWorker = async (workerId) => {
    if (!selectedComplaint) return;
    try {
      const res = await fetch(`/api/complaints/${selectedComplaint._id}/assign-worker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId })
      });
      if (res.ok) {
        fetchData();
        setShowAssignModal(false);
        setSelectedComplaint(null);
      }
    } catch (err) {
      console.error('Failed to assign worker:', err);
    }
  };

  const handleVerify = async (complaintId) => {
    try {
      const res = await fetch(`/api/complaints/${complaintId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Failed to verify:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem' }}>🔄</div>
          <div>Loading Supervisor Dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
        color: 'white', padding: 'var(--space-4) var(--space-6)',
        borderBottom: '4px solid var(--color-saffron)'
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <div style={{ width: 48, height: 48, background: 'rgba(255,255,255,0.15)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem' }}>
              🏗️
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>Kopargaon Civic Platform</div>
              <div style={{ opacity: 0.7, fontSize: 'var(--text-sm)' }}>Supervisor Dashboard</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <span style={{ background: 'rgba(255,255,255,0.15)', padding: '6px 14px', borderRadius: 'var(--radius-full)', fontWeight: 600 }}>
              {user?.module || 'BOTH'} Module
            </span>
            <span style={{ background: 'rgba(255,255,255,0.15)', padding: '6px 14px', borderRadius: 'var(--radius-full)', fontWeight: 600 }}>
              {user?.name}
            </span>
            <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.35)', color: 'white', borderRadius: 'var(--radius-full)', padding: '8px 18px', cursor: 'pointer', fontWeight: 700 }}>
              🚪 Logout
            </button>
          </div>
        </div>
      </div>

      <div style={{ height: 4, background: 'linear-gradient(to right, #FF9933 33%, #FFFFFF 33% 66%, #138808 66%)' }} />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 'var(--space-6)' }}>
        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          <div className="stat-card">
            <div className="stat-card-icon" style={{ background: 'var(--status-new-bg)' }}>📋</div>
            <div className="stat-card-value">{stats.total || 0}</div>
            <div className="stat-card-label">Total Assigned</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon" style={{ background: 'var(--status-assigned-bg)' }}>⏳</div>
            <div className="stat-card-value">{stats.assigned || 0}</div>
            <div className="stat-card-label">Pending</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon" style={{ background: 'var(--status-in-progress-bg)' }}>🔧</div>
            <div className="stat-card-value">{stats.inProgress || 0}</div>
            <div className="stat-card-label">In Progress</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon" style={{ background: 'var(--status-resolved-bg)' }}>✅</div>
            <div className="stat-card-value">{stats.closed || 0}</div>
            <div className="stat-card-label">Resolved</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
          <button className={`btn ${activeTab === 'queue' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('queue')}>
            📋 Priority Queue
          </button>
          <button className={`btn ${activeTab === 'workers' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('workers')}>
            👷 Workers
          </button>
          <button className={`btn ${activeTab === 'heatmap' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('heatmap')}>
            🗺️ Ward Heatmap
          </button>
          <button className={`btn ${activeTab === 'geofencing' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('geofencing')}>
            📍 Geofencing
          </button>
        </div>

        {/* Priority Queue */}
        {activeTab === 'queue' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>Complaint Priority Queue</h2>
              <button className="btn btn-ghost" onClick={fetchData}>🔄 Refresh</button>
            </div>

            {complaints.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>📭</div>
                <p>No complaints assigned to you yet.</p>
              </div>
            ) : (
              complaints.map(complaint => {
                const priority = getPriorityInfo(complaint.priority_score || 50);
                return (
                  <div key={complaint._id} className="card" style={{ borderLeft: `4px solid ${priority.color}` }}>
                    <div style={{ padding: 'var(--space-4)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                        <div>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-primary)' }}>
                            {complaint.complaint_id}
                          </span>
                          <span style={{ marginLeft: 'var(--space-3)', background: complaint.module === 'WASTE' ? '#E8F5E9' : '#E3F2FD', padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                            {complaint.module}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <span style={{ fontSize: '1.5rem' }}>{priority.icon}</span>
                          <span style={{ fontWeight: 800, fontSize: 'var(--text-2xl)', color: priority.color }}>
                            {complaint.priority_score || 50}
                          </span>
                        </div>
                      </div>

                      <p style={{ margin: '0 0 var(--space-3) 0', fontWeight: 500 }}>{complaint.complaint_text}</p>

                      {complaint.priority_reason && (
                        <div style={{ background: 'var(--color-surface-hover)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)', borderLeft: '3px solid var(--color-primary)' }}>
                          💡 {complaint.priority_reason}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
                        <span>📍 {complaint.location?.address || 'No address'}</span>
                        <span>📅 {new Date(complaint.createdAt).toLocaleDateString()}</span>
                        <span className={`badge badge-${complaint.status?.toLowerCase()}`}>{complaint.status}</span>
                      </div>

                      {complaint.assigned_worker_name ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                          <span style={{ fontSize: 'var(--text-sm)' }}>👷 Assigned to: <strong>{complaint.assigned_worker_name}</strong></span>
                          {complaint.status === 'COMPLETED' && (
                            <button className="btn btn-success btn-sm" onClick={() => handleVerify(complaint._id)}>
                              ✅ Verify Completion
                            </button>
                          )}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                          <button className="btn btn-outline btn-sm" onClick={() => { setSelectedComplaint(complaint); setShowPriorityModal(true); setOverridePriority(complaint.priority_score || 50); }}>
                            📊 Override Priority
                          </button>
                          <button className="btn btn-primary btn-sm" onClick={() => { setSelectedComplaint(complaint); setShowAssignModal(true); }}>
                            👷 Assign Worker
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Workers Tab */}
        {activeTab === 'workers' && (
          <div>
            <h2 style={{ marginBottom: 'var(--space-4)' }}>Your Workers</h2>
            {availableWorkers.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>👷</div>
                <p>No workers available.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 'var(--space-4)' }}>
                {availableWorkers.map(worker => (
                  <div key={worker._id} className="card">
                    <div style={{ padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                      <div style={{ width: 48, height: 48, background: 'var(--color-primary-surface)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                        👷
                      </div>
                      <div>
                        <div style={{ fontWeight: 700 }}>{worker.name}</div>
                        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                          {worker.worker_profile?.designation || 'Field Worker'}
                        </div>
                        <span className={`badge ${worker.worker_profile?.status === 'AVAILABLE' ? 'badge-low' : 'badge-medium'}`}>
                          {worker.worker_profile?.status || 'UNKNOWN'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Ward Heatmap Tab */}
        {activeTab === 'heatmap' && (
          <div>
            <h2 style={{ marginBottom: 'var(--space-4)' }}>🗺️ Ward-wise Complaint Heatmap</h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
              Visualize complaint density across Kopargaon wards. Click on a ward to see details.
            </p>
            <div className="card" style={{ padding: 'var(--space-4)' }}>
              <ComplaintHeatmap complaints={complaints} />
            </div>
          </div>
        )}

        {/* Geofencing Tab */}
        {activeTab === 'geofencing' && (
          <div>
            <h2 style={{ marginBottom: 'var(--space-4)' }}>📍 Location Verification</h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
              Verify citizen location before making automated calls. Restricted zones (hospitals, schools, etc.) will skip calling.
            </p>
            
            {/* Info Banner */}
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              padding: '16px 20px',
              borderRadius: '12px',
              marginBottom: '20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '1.5rem' }}>ℹ️</span>
                <div>
                  <div style={{ fontWeight: 700 }}>How it works</div>
                  <div style={{ opacity: 0.9, fontSize: '0.85rem' }}>
                    When verifying a complaint, the system checks if the citizen is in a restricted zone.
                    If yes, the call is skipped and the complaint is added to the manual queue.
                  </div>
                </div>
              </div>
            </div>

            {/* Restricted Zones */}
            <div className="card" style={{ marginBottom: '20px' }}>
              <div className="card-header">
                <div className="card-title">🚫 Restricted Zones</div>
              </div>
              <div className="card-body">
                <p style={{ marginBottom: '12px', color: 'var(--color-text-secondary)' }}>
                  Automated calls will NOT be made if the citizen is within these zones:
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {Object.entries(RESTRICTED_PLACE_TYPES).map(([key, label]) => (
                    <span key={key} style={{
                      padding: '6px 14px',
                      background: '#ffebee',
                      color: '#c62828',
                      borderRadius: '20px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                    }}>
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Test Location Check */}
            <div className="card" style={{ marginBottom: '20px' }}>
              <div className="card-header">
                <div className="card-title">🧪 Test Location Check</div>
              </div>
              <div className="card-body">
                <p style={{ marginBottom: '12px', color: 'var(--color-text-secondary)' }}>
                  Click the button below to test geofencing with your current location.
                </p>
                <button
                  onClick={async () => {
                    setGeofencingLoading(true);
                    try {
                      initRadar();
                      const result = await checkLocationForCalling();
                      setGeofencingStatus(result);
                    } catch (err) {
                      setGeofencingStatus({
                        canCall: true,
                        reason: 'Error: ' + err.message,
                        nearbyPlaces: [],
                      });
                    }
                    setGeofencingLoading(false);
                  }}
                  disabled={geofencingLoading}
                  style={{
                    padding: '12px 24px',
                    background: geofencingLoading ? '#ccc' : 'linear-gradient(135deg, #667eea, #764ba2)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: geofencingLoading ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                    fontSize: '1rem',
                  }}
                >
                  {geofencingLoading ? '🔄 Checking Location...' : '📍 Check My Location'}
                </button>

                {geofencingStatus && (
                  <div style={{
                    marginTop: '16px',
                    padding: '16px',
                    background: geofencingStatus.canCall ? '#e8f5e9' : '#ffebee',
                    borderRadius: '8px',
                    border: `2px solid ${geofencingStatus.canCall ? '#4caf50' : '#f44336'}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '2rem' }}>
                        {geofencingStatus.canCall ? '✅' : '🚫'}
                      </span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1.1rem', color: geofencingStatus.canCall ? '#2e7d32' : '#c62828' }}>
                          {geofencingStatus.canCall ? 'Location Verified - Calls Allowed' : 'Restricted Zone - Calls Blocked'}
                        </div>
                        <div style={{ color: '#666', fontSize: '0.9rem' }}>{geofencingStatus.reason}</div>
                      </div>
                    </div>

                    {geofencingStatus.userLocation && (
                      <div style={{
                        background: 'white',
                        padding: '12px',
                        borderRadius: '6px',
                        marginBottom: '12px',
                      }}>
                        <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '4px' }}>Coordinates</div>
                        <div style={{ fontFamily: 'monospace' }}>
                          {geofencingStatus.userLocation.latitude.toFixed(6)}, {geofencingStatus.userLocation.longitude.toFixed(6)}
                        </div>
                      </div>
                    )}

                    {geofencingStatus.nearbyPlaces?.length > 0 && (
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px' }}>
                          Nearby Places:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {geofencingStatus.nearbyPlaces.map((place, i) => (
                            <span key={i} style={{
                              padding: '4px 12px',
                              background: geofencingStatus.canCall ? '#c8e6c9' : '#ffcdd2',
                              color: geofencingStatus.canCall ? '#2e7d32' : '#c62828',
                              borderRadius: '16px',
                              fontSize: '0.8rem',
                            }}>
                              {place.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Queue Stats */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">📊 Geofencing Stats</div>
              </div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  <div style={{ textAlign: 'center', padding: '16px', background: '#e8f5e9', borderRadius: '8px' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#2e7d32' }}>
                      {complaints.filter(c => c.geofencingStatus === 'allowed' || !c.geofencingStatus).length}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#666' }}>Calls Allowed</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '16px', background: '#ffebee', borderRadius: '8px' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#c62828' }}>
                      {complaints.filter(c => c.geofencingStatus === 'restricted').length}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#666' }}>Calls Blocked</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '16px', background: '#fff3e0', borderRadius: '8px' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#e65100' }}>
                      {complaints.length}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#666' }}>Total Verified</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Priority Override Modal */}
      {showPriorityModal && selectedComplaint && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: 400, maxWidth: '90%' }}>
            <div className="card-header">
              <div className="card-title">📊 Override Priority</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowPriorityModal(false)}>✕</button>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Priority Score (0-100)</label>
                <input type="number" className="form-input" min="0" max="100" value={overridePriority} onChange={e => setOverridePriority(parseInt(e.target.value))} />
              </div>
              <div className="form-group">
                <label className="form-label">Reason for Override</label>
                <textarea className="form-textarea" rows={3} value={overrideReason} onChange={e => setOverrideReason(e.target.value)} placeholder="e.g., Equipment unavailable, crew already deployed to emergency..." />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
                <button className="btn btn-outline" onClick={() => setShowPriorityModal(false)} style={{ flex: 1 }}>Cancel</button>
                <button className="btn btn-primary" onClick={handlePriorityOverride} style={{ flex: 1 }}>Save Priority</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Worker Modal */}
      {showAssignModal && selectedComplaint && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: 400, maxWidth: '90%' }}>
            <div className="card-header">
              <div className="card-title">👷 Assign Worker</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAssignModal(false)}>✕</button>
            </div>
            <div className="card-body">
              <p style={{ marginBottom: 'var(--space-4)' }}>Select a worker for this complaint:</p>
              {availableWorkers.length === 0 ? (
                <p style={{ color: 'var(--priority-critical)' }}>No workers available.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {availableWorkers.map(worker => (
                    <button key={worker._id} className="btn btn-outline" onClick={() => handleAssignWorker(worker._id)} style={{ justifyContent: 'flex-start', padding: 'var(--space-3)' }}>
                      👷 {worker.name}
                      <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: worker.worker_profile?.status === 'AVAILABLE' ? 'var(--color-green)' : 'var(--priority-high)' }}>
                        {worker.worker_profile?.status || 'AVAILABLE'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
