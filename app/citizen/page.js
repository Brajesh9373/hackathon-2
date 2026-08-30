'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import PortalShell from '../ui/PortalShell';
import { complaints, voiceIntake, resources } from '../lib/api';
import { ComplaintQueue, DashboardStats, PageIntro, deriveStats, readList } from '../ui/PortalBlocks';
import VoiceComplaintButton, { VoiceComplaintVerification, CallStatus } from '../components/VoiceComplaintFlow';

export default function CitizenOverview() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Voice call states
  const [callStatus, setCallStatus] = useState(null); // null, 'connecting', 'ringing', 'active', 'ended', 'error'
  const [session, setSession] = useState(null);
  const [showVerification, setShowVerification] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [safetyResult, setSafetyResult] = useState(null);

  useEffect(() => {
    complaints.myComplaints().then(result => {
      setItems(readList(result));
      setError(result?.error || '');
      setLoading(false);
    }).catch(() => {
      setError('Could not load your complaints.');
      setLoading(false);
    });
  }, []);

  const stats = deriveStats(items);

  // Check location safety before starting call
  const checkSafety = useCallback(async () => {
    try {
      // Get user location
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        });
      });
      
      const { latitude, longitude, accuracy } = position.coords;
      return {
        canCall: true,
        userLocation: { latitude, longitude, accuracy },
        reason: 'Location verified'
      };
    } catch (error) {
      // If location fails, still allow the call (user might be at home)
      return {
        canCall: true,
        reason: 'Location check skipped - will proceed with call',
        error: error.message
      };
    }
  }, []);

  // Start the voice call
  const handleStartVoiceCall = useCallback(async () => {
    setCallStatus('connecting');
    setSession(null);
    
    try {
      // Check safety first
      const safety = await checkSafety();
      setSafetyResult(safety);
      
      // Start voice intake session
      const result = await voiceIntake.start(safety);
      
      if (result.error) {
        setCallStatus('error');
        console.error('Voice intake error:', result.error);
        return;
      }
      
      setSession(result);
      
      // Simulate call status progression for demo
      // In production, this would be handled by Vapi webhooks
      setCallStatus('ringing');
      
      // For demo, simulate the call ending after a delay
      // In production, this would be triggered by Vapi webhook
      setTimeout(() => {
        setCallStatus('ended');
        
        // After call ends, fetch the session with draft data
        // In production, this would be updated by the voice agent
        setTimeout(() => {
          fetchSessionResult(result.sessionId || result._id);
        }, 1000);
      }, 15000); // Demo: 15 second call
      
    } catch (error) {
      console.error('Failed to start voice call:', error);
      setCallStatus('error');
    }
  }, [checkSafety]);

  // Fetch session result (for demo, creates sample data)
  const fetchSessionResult = useCallback(async (sessionId) => {
    try {
      // For demo, simulate what the voice agent would have collected
      // In production, this data would come from Vapi voice agent
      const demoDraft = {
        location: {
          area: 'मुख्य बाजार - Main Market',
          ward: 'Ward 1'
        },
        category: 'DRAINAGE',
        complaint_text: 'नाला ब्लॉक झाला आहे. पाणी वाहत नाही.',
        module: 'DEVELOPMENT'
      };
      
      // Update session with draft data
      await voiceIntake.result(sessionId, demoDraft);
      
      // Fetch updated session
      const result = await voiceIntake.get(sessionId);
      if (result.session) {
        setSession(result.session);
      } else {
        setSession({ ...session, draft: demoDraft, status: 'DRAFT_READY' });
      }
      setShowVerification(true);
      
    } catch (error) {
      console.error('Failed to fetch session result:', error);
      // Still show verification with empty data
      setShowVerification(true);
    }
  }, [session]);

  // Handle confirmation
  const handleConfirm = useCallback(async () => {
    if (!session) return;
    
    setSubmitting(true);
    try {
      const sessionId = session.sessionId || session._id;
      const result = await voiceIntake.confirm(sessionId, {});
      
      if (result.error) {
        alert('Failed to submit complaint: ' + result.error);
        setSubmitting(false);
        return;
      }
      
      // Success - redirect to complaint details
      router.push(`/citizen/complaints/${result.complaint?.complaint_id || result.complaint_id}`);
      
    } catch (error) {
      console.error('Failed to confirm complaint:', error);
      alert('Failed to submit complaint. Please try again.');
      setSubmitting(false);
    }
  }, [session, router]);

  // Handle edits
  const handleEdit = useCallback(async (edits) => {
    if (!session) return;
    
    setSubmitting(true);
    try {
      const sessionId = session.sessionId || session._id;
      await voiceIntake.result(sessionId, edits);
      setSession({ ...session, draft: edits });
    } catch (error) {
      console.error('Failed to save edits:', error);
    }
    setSubmitting(false);
  }, [session]);

  // Cancel call
  const handleCancelCall = useCallback(() => {
    setCallStatus(null);
    setSession(null);
    setSafetyResult(null);
  }, []);

  // Close verification
  const handleCloseVerification = useCallback(() => {
    setShowVerification(false);
    setSession(null);
    setCallStatus(null);
    // Refresh complaints list
    complaints.myComplaints().then(result => {
      setItems(readList(result));
    });
  }, []);

  return (
    <PortalShell role="citizen">
      <PageIntro 
        eyebrow="YOUR CIVIC RECORD" 
        title="Good morning, your voice is on the record." 
        detail="File a local issue, see who owns it, and get a clear answer when the work is done." 
        action={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              className="v-button v-button-primary" 
              onClick={() => router.push('/citizen/new')}
            >
              New complaint
            </button>
          </div>
        }
      />
      
      {error && <p className="v-form-error">{error}</p>}
      <DashboardStats stats={stats} variant="citizen" />

      <div className="v-dashboard-grid">
        <section className="v-panel">
          <div className="v-section-heading">
            <div><span className="v-eyebrow">RECENTLY FILED</span><h2>Your complaints</h2><p>Follow every hand-off from filing to confirmation.</p></div>
            <button className="v-button v-button-ghost" onClick={() => router.push('/citizen/complaints')}>View all</button>
          </div>
          {loading ? (
            <div className="v-loading" style={{ minHeight: 180 }}><div className="v-loading-mark">N</div></div>
          ) : (
            <ComplaintQueue 
              items={items} 
              onOpen={item => router.push(`/citizen/complaints/${item.complaint_id || item._id}`)} 
              emptyTitle="Your record is empty" 
              emptyDetail="When you raise your first complaint, its progress will stay visible here." 
            />
          )}
        </section>
        
        <section className="v-panel v-panel-soft">
          <span className="v-eyebrow">VOICE COMPLAINT</span>
          <h2 className="v-side-title">Register by Phone Call</h2>
          <p className="v-side-copy">
            Our AI Agent will call you to collect complaint details. After the call, 
            you can review and edit the information before submitting.
          </p>
          
          {/* Voice Call Button */}
          <div style={{ marginTop: '16px' }}>
            <VoiceComplaintButton onStartCall={handleStartVoiceCall} />
          </div>
          
          <div style={{ marginTop: '16px' }}>
            <button 
              className="v-button v-button-secondary" 
              onClick={() => router.push('/citizen/new')}
            >
              Or file manually →
            </button>
          </div>
        </section>
      </div>

      {/* Call Status Overlay */}
      {callStatus && !showVerification && (
        <CallStatus 
          status={callStatus} 
          onCancel={handleCancelCall}
        />
      )}

      {/* Verification Modal */}
      {showVerification && session && (
        <VoiceComplaintVerification
          session={session}
          onConfirm={handleConfirm}
          onEdit={handleEdit}
          onCancel={handleCloseVerification}
          loading={submitting}
        />
      )}
    </PortalShell>
  );
}
