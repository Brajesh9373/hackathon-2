'use client';

import { useState, useEffect, useCallback } from 'react';
import { auth } from '../lib/api';

/**
 * Voice Complaint Button Component
 * Simple call button that initiates Vapi outbound call for complaint registration
 */
export default function VoiceComplaintButton({ onStartCall, className = '' }) {
  return (
    <button 
      className={`v-voice-call-button ${className}`}
      onClick={onStartCall}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px 24px',
        background: 'linear-gradient(135deg, #FF9933 0%, #138808 100%)',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: '600',
        boxShadow: '0 4px 12px rgba(255, 153, 51, 0.3)',
        transition: 'all 0.2s',
        width: '100%',
        justifyContent: 'center',
      }}
    >
      <span style={{ fontSize: '24px' }}>📞</span>
      <div style={{ textAlign: 'left' }}>
        <div>Register your complain</div>
        <div style={{ fontSize: '12px', opacity: 0.9, fontWeight: 'normal' }}>through our AI Agent</div>
      </div>
    </button>
  );
}

/**
 * Voice Complaint Modal Component
 * Shows after call ends - displays collected data for verification
 */
export function VoiceComplaintVerification({ session, onConfirm, onEdit, onCancel, loading }) {
  const [draft, setDraft] = useState(session?.draft || {});
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState(draft);

  useEffect(() => {
    if (session?.draft) {
      setDraft(session.draft);
      setEditData(session.draft);
    }
  }, [session]);

  const handleFieldEdit = (field, value) => {
    setEditData({ ...editData, [field]: value });
  };

  const handleSaveEdits = () => {
    onEdit(editData);
    setDraft(editData);
    setEditing(false);
  };

  const categories = [
    { id: 'GARBAGE', label: 'Garbage / कचरा' },
    { id: 'DRAINAGE', label: 'Drainage / जलनिकास' },
    { id: 'ROADS', label: 'Roads / रस्ते' },
    { id: 'WATER', label: 'Water Supply / पाणी' },
    { id: 'LIGHTS', label: 'Street Lights / दिवे' },
    { id: 'SEWAGE', label: 'Sewage / सीवर' },
  ];

  const wards = [
    { id: 'Ward 1', label: 'Ward 1 - Main Market' },
    { id: 'Ward 2', label: 'Ward 2 - Station Road' },
    { id: 'Ward 3', label: 'Ward 3 - Temple Area' },
    { id: 'Ward 4', label: 'Ward 4 - New Layout' },
    { id: 'Ward 5', label: 'Ward 5 - Old Town' },
    { id: 'Ward 6', label: 'Ward 6 - Hospital' },
    { id: 'Ward 7', label: 'Ward 7 - School Zone' },
    { id: 'Ward 8', label: 'Ward 8 - Industrial' },
  ];

  const displayData = editing ? editData : draft;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        padding: '32px',
      }}>
        <h2 style={{ margin: '0 0 8px 0', color: '#333' }}>
          📋 Verify Your Complaint
        </h2>
        <p style={{ margin: '0 0 24px 0', color: '#666', fontSize: '14px' }}>
          Please review the information collected from your call. You can edit any field before submitting.
        </p>

        {!draft || Object.keys(draft).length === 0 ? (
          <div style={{
            background: '#fff3cd',
            padding: '20px',
            borderRadius: '8px',
            textAlign: 'center',
          }}>
            <p style={{ color: '#856404', margin: 0 }}>
              No complaint data was collected during the call. Please try again or file a complaint manually.
            </p>
            <button 
              className="v-button v-button-primary"
              onClick={onCancel}
              style={{ marginTop: '16px' }}
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Display collected data */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Location */}
              <div style={{
                padding: '16px',
                background: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #e0e0e0',
              }}>
                <label style={{ fontSize: '12px', color: '#666', fontWeight: '600' }}>Location / ठिकाण</label>
                {editing ? (
                  <select 
                    value={editData.location?.area || ''}
                    onChange={(e) => handleFieldEdit('location', { ...editData.location, area: e.target.value })}
                    style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #ddd' }}
                  >
                    <option value="">Select Location</option>
                    {wards.map(w => (
                      <option key={w.id} value={w.id}>{w.label}</option>
                    ))}
                  </select>
                ) : (
                  <div style={{ fontSize: '16px', fontWeight: '500', marginTop: '4px' }}>
                    {draft.location?.area || draft.location || 'Not specified'}
                  </div>
                )}
              </div>

              {/* Category */}
              <div style={{
                padding: '16px',
                background: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #e0e0e0',
              }}>
                <label style={{ fontSize: '12px', color: '#666', fontWeight: '600' }}>Category / विभाग</label>
                {editing ? (
                  <select 
                    value={editData.category || ''}
                    onChange={(e) => handleFieldEdit('category', e.target.value)}
                    style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #ddd' }}
                  >
                    <option value="">Select Category</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                ) : (
                  <div style={{ fontSize: '16px', fontWeight: '500', marginTop: '4px' }}>
                    {categories.find(c => c.id === draft.category)?.label || draft.category || 'Not specified'}
                  </div>
                )}
              </div>

              {/* Description */}
              <div style={{
                padding: '16px',
                background: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #e0e0e0',
              }}>
                <label style={{ fontSize: '12px', color: '#666', fontWeight: '600' }}>Problem Description / समस्येचे वर्णन</label>
                {editing ? (
                  <textarea 
                    value={editData.complaint_text || ''}
                    onChange={(e) => handleFieldEdit('complaint_text', e.target.value)}
                    placeholder="Describe the issue..."
                    style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #ddd', minHeight: '100px' }}
                  />
                ) : (
                  <div style={{ fontSize: '14px', marginTop: '4px', lineHeight: '1.5' }}>
                    {draft.complaint_text || 'Not specified'}
                  </div>
                )}
              </div>

              {/* Ward */}
              <div style={{
                padding: '16px',
                background: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #e0e0e0',
              }}>
                <label style={{ fontSize: '12px', color: '#666', fontWeight: '600' }}>Ward / वार्ड</label>
                {editing ? (
                  <select 
                    value={editData.location?.ward || ''}
                    onChange={(e) => handleFieldEdit('location', { ...editData.location, ward: e.target.value })}
                    style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #ddd' }}
                  >
                    <option value="">Select Ward</option>
                    {wards.map(w => (
                      <option key={w.id} value={w.id}>{w.label}</option>
                    ))}
                  </select>
                ) : (
                  <div style={{ fontSize: '16px', fontWeight: '500', marginTop: '4px' }}>
                    {draft.location?.ward || 'Not specified'}
                  </div>
                )}
              </div>

            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              {editing ? (
                <>
                  <button 
                    className="v-button v-button-primary"
                    onClick={handleSaveEdits}
                    disabled={loading}
                    style={{ flex: 1 }}
                  >
                    Save Changes
                  </button>
                  <button 
                    className="v-button v-button-ghost"
                    onClick={() => { setEditing(false); setEditData(draft); }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button 
                    className="v-button v-button-outline"
                    onClick={() => setEditing(true)}
                    style={{ flex: 1 }}
                  >
                    ✏️ Edit
                  </button>
                  <button 
                    className="v-button v-button-primary"
                    onClick={onConfirm}
                    disabled={loading}
                    style={{ 
                      flex: 2,
                      background: 'linear-gradient(135deg, #FF9933 0%, #138808 100%)',
                      border: 'none',
                    }}
                  >
                    {loading ? 'Submitting...' : '✅ Submit Complaint'}
                  </button>
                </>
              )}
              <button 
                className="v-button v-button-ghost"
                onClick={onCancel}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Call Status Component
 * Shows call status during the call
 */
export function CallStatus({ status, onCancel }) {
  const statusConfig = {
    connecting: { icon: '📞', text: 'Connecting to AI Agent...', subtext: 'Please wait, the call will start shortly.' },
    ringing: { icon: '🔔', text: 'Calling your phone...', subtext: 'Answer the call to speak with our AI Agent.' },
    active: { icon: '🎙️', text: 'Call in progress', subtext: 'Speak with our AI Agent to register your complaint.' },
    ended: { icon: '📴', text: 'Call ended', subtext: 'Processing your complaint data...' },
    error: { icon: '❌', text: 'Call failed', subtext: 'Please try again or file manually.' },
  };

  const config = statusConfig[status] || statusConfig.connecting;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.9)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{ textAlign: 'center', color: 'white' }}>
        <div style={{ fontSize: '80px', marginBottom: '24px' }}>
          {config.icon}
        </div>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '24px' }}>{config.text}</h2>
        <p style={{ margin: '0 0 32px 0', opacity: 0.8 }}>{config.subtext}</p>
        
        {(status === 'connecting' || status === 'ringing' || status === 'active') && (
          <button 
            onClick={onCancel}
            style={{
              padding: '12px 32px',
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.4)',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            Cancel Call
          </button>
        )}

        {status === 'active' && (
          <div style={{
            marginTop: '32px',
            padding: '16px 32px',
            background: 'rgba(46, 204, 113, 0.2)',
            borderRadius: '8px',
            display: 'inline-block',
          }}>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>
              The AI Agent will ask you:<br/>
              1. Your location<br/>
              2. Type of problem<br/>
              3. Description of the issue<br/>
              4. Your ward number
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
