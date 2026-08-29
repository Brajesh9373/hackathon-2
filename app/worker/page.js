'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredUser, clearToken } from '../lib/api';

function getPriorityInfo(score) {
  if (score >= 90) return { label: 'CRITICAL', color: '#D50000', icon: '🔴' };
  if (score >= 75) return { label: 'HIGH', color: '#E65100', icon: '🟠' };
  if (score >= 50) return { label: 'MEDIUM', color: '#F57F17', icon: '🟡' };
  return { label: 'LOW', color: '#2E7D32', icon: '🟢' };
}

function getStatusBadge(status) {
  switch (status) {
    case 'AWAITING_VERIFICATION':
      return { label: 'Calling Citizen', color: '#1565C0', bg: '#E3F2FD' };
    case 'COMPLETED':
      return { label: 'Completed', color: '#2E7D32', bg: '#E8F5E9' };
    case 'ASSIGNED':
      return { label: 'Reopened', color: '#6A1B9A', bg: '#F3E5F5' };
    default:
      return { label: status, color: '#546E7A', bg: '#ECEFF1' };
  }
}

export default function WorkerPortal() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTasks, setActiveTasks] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('active'); // 'active' or 'completed'

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored || stored.role !== 'worker') {
      router.push('/');
      return;
    }
    setUser(stored);
    fetchTasks();
    
    // Poll for verification results every 5 seconds
    const pollInterval = setInterval(pollVerification, 5000);
    return () => clearInterval(pollInterval);
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/complaints/worker/tasks');
      const data = await res.json();
      setActiveTasks(data.activeTasks || []);
      setCompletedTasks(data.completedTasks || []);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    }
    setLoading(false);
  };

  // Poll for verification results
  const pollVerification = async () => {
    // Find tasks awaiting verification
    const awaitingTasks = completedTasks.filter(t => t.status === 'AWAITING_VERIFICATION' && t.verification?.call_id);
    if (awaitingTasks.length === 0) return;

    for (const task of awaitingTasks) {
      try {
        const res = await fetch(`/api/verification/${task.complaint_id}`);
        const data = await res.json();
        
        if (data.decision && data.decision !== 'pending') {
          // Verification completed, refresh tasks
          fetchTasks();
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    }
  };

  const handleLogout = () => {
    clearToken();
    router.push('/');
  };

  const handleCompleteTask = async () => {
    if (!selectedTask) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/complaints/${selectedTask._id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution_note: resolutionNote })
      });
      const data = await res.json();
      
      if (res.ok || res.status === 202) {
        setSelectedTask(null);
        setResolutionNote('');
        fetchTasks();
        setActiveTab('completed'); // Switch to completed tab
      } else {
        alert(data.error || 'Failed to complete task');
      }
    } catch (err) {
      console.error('Failed to complete task:', err);
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem' }}>🔄</div>
          <div>Loading Worker Portal...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, var(--c1) 0%, var(--c2) 100%)',
        color: 'white', padding: '16px 24px',
        borderBottom: '4px solid var(--c3)'
      }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: 48, height: 48, background: 'rgba(255,255,255,0.15)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem' }}>
              👷
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>Worker Portal</div>
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

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: 'white', borderRadius: 12, padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: 48, height: 48, background: '#FFF8E1', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>🔧</div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{activeTasks.length}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--t2)' }}>Active Tasks</div>
            </div>
          </div>
          <div style={{ background: 'white', borderRadius: 12, padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: 48, height: 48, background: '#E8F5E9', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>✅</div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{completedTasks.length}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--t2)' }}>Completed</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          <button
            onClick={() => setActiveTab('active')}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600,
              background: activeTab === 'active' ? 'var(--c1)' : 'white',
              color: activeTab === 'active' ? 'white' : 'var(--t)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
          >
            🔧 Active Tasks ({activeTasks.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600,
              background: activeTab === 'completed' ? 'var(--c1)' : 'white',
              color: activeTab === 'completed' ? 'white' : 'var(--t)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
          >
            ✅ Completed & Verification ({completedTasks.length})
          </button>
        </div>

        {/* Active Tasks */}
        {activeTab === 'active' && (
          <>
            <h2 style={{ marginBottom: '16px' }}>🔧 My Active Tasks</h2>
            {activeTasks.length === 0 ? (
              <div style={{ background: 'white', borderRadius: 12, padding: '32px', textAlign: 'center', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📭</div>
                <p>No active tasks assigned to you.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                {activeTasks.map(task => {
                  const priority = getPriorityInfo(task.priority_score || 50);
                  return (
                    <div key={task._id} style={{ background: 'white', borderRadius: 12, padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', borderLeft: `4px solid ${priority.color}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--c1)' }}>
                            {task.complaint_id}
                          </span>
                          <span style={{ marginLeft: '12px', background: task.module === 'WASTE' ? '#E8F5E9' : '#E3F2FD', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>
                            {task.module}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1.2rem' }}>{priority.icon}</span>
                          <span style={{ fontWeight: 700, fontSize: '1.125rem', color: priority.color }}>
                            {task.priority_score || 50}
                          </span>
                        </div>
                      </div>

                      <p style={{ margin: '0 0 12px 0', fontWeight: 500 }}>{task.complaint_text}</p>

                      <div style={{ display: 'flex', gap: '16px', fontSize: '0.875rem', color: 'var(--t2)', marginBottom: '12px' }}>
                        <span>📍 {task.location?.address || 'No address'}</span>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-outline btn-sm" onClick={() => { setSelectedTask(task); setResolutionNote(''); }}>
                          ✅ Mark Complete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Completed Tasks */}
        {activeTab === 'completed' && (
          <>
            <h2 style={{ marginBottom: '16px' }}>✅ Completed & Verification</h2>
            {completedTasks.length === 0 ? (
              <div style={{ background: 'white', borderRadius: 12, padding: '32px', textAlign: 'center', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📭</div>
                <p style={{ color: 'var(--t2)' }}>No completed tasks yet.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {completedTasks.map(task => {
                  const statusBadge = getStatusBadge(task.status);
                  const verification = task.verification;
                  
                  return (
                    <div key={task._id} style={{ background: 'white', borderRadius: 12, padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--c1)' }}>
                            {task.complaint_id}
                          </span>
                          <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: 'var(--t2)' }}>
                            {task.complaint_text?.substring(0, 40)}...
                          </span>
                        </div>
                        <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: '0.75rem', fontWeight: 600, background: statusBadge.bg, color: statusBadge.color }}>
                          {statusBadge.label}
                        </span>
                      </div>
                      
                      {/* Resolution Note */}
                      {task.resolution?.resolution_note && (
                        <div style={{ fontSize: '0.875rem', color: 'var(--t2)', marginBottom: '8px', padding: '8px', background: '#f5f5f5', borderRadius: 6 }}>
                          📝 {task.resolution.resolution_note}
                        </div>
                      )}
                      
                      {/* Verification Status */}
                      {task.status === 'AWAITING_VERIFICATION' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', background: '#E3F2FD', borderRadius: 6, color: '#1565C0', fontSize: '0.875rem' }}>
                          <span>📞</span>
                          <span>Calling citizen to verify...</span>
                          <span style={{ marginLeft: 'auto', animation: 'pulse 1.5s infinite' }}>⏳</span>
                        </div>
                      )}
                      
                      {task.status === 'COMPLETED' && task.citizen_confirmation?.response === 'CONFIRMED' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', background: '#E8F5E9', borderRadius: 6, color: '#2E7D32', fontSize: '0.875rem' }}>
                          <span>✅</span>
                          <span>Citizen confirmed - Issue resolved</span>
                        </div>
                      )}
                      
                      {task.status === 'ASSIGNED' && task.citizen_confirmation?.response === 'NOT_FIXED' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', background: '#FFEBEE', borderRadius: 6, color: '#C62828', fontSize: '0.875rem' }}>
                          <span>⚠️</span>
                          <span>Citizen reported not fixed - Returned to supervisor</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Complete Task Modal */}
      {selectedTask && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: 12, padding: '24px', width: 450, maxWidth: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #eee' }}>
              <h3 style={{ margin: 0 }}>✅ Complete Task</h3>
              <button onClick={() => setSelectedTask(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem' }}>✕</button>
            </div>
            
            <div style={{ background: '#f5f5f5', padding: '12px', borderRadius: 8, marginBottom: '16px' }}>
              <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--c1)', marginBottom: '8px' }}>
                {selectedTask.complaint_id}
              </div>
              <p style={{ margin: 0, fontSize: '0.875rem' }}>{selectedTask.complaint_text}</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--t2)' }}>
                📍 {selectedTask.location?.address}
              </p>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px', color: 'var(--t2)', fontSize: '0.875rem' }}>
                Resolution Note
              </label>
              <textarea
                rows={4}
                value={resolutionNote}
                onChange={e => setResolutionNote(e.target.value)}
                placeholder="Describe what work was done..."
                style={{ width: '100%', padding: '12px', border: '1.5px solid var(--bd)', borderRadius: 8, fontSize: '1rem', fontFamily: 'inherit', resize: 'vertical' }}
              />
            </div>

            <div style={{ background: '#E3F2FD', padding: '12px', borderRadius: 8, marginBottom: '16px', fontSize: '0.875rem', color: '#1565C0' }}>
              📞 Clicking "Submit" will initiate an AI call to the citizen to verify if the work is actually completed.
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setSelectedTask(null)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1.5px solid var(--bd)', background: 'white', cursor: 'pointer', fontWeight: 600 }}>
                Cancel
              </button>
              <button
                onClick={handleCompleteTask}
                disabled={submitting}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#2E7D32', color: 'white', cursor: 'pointer', fontWeight: 600, opacity: submitting ? 0.6 : 1 }}
              >
                {submitting ? 'Submitting...' : '✅ Submit Completion'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
