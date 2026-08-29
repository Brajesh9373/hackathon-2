'use client';

import { useState, useEffect } from 'react';
import { initRadar, checkLocationForCalling } from '../lib/geofencing';

export default function GeofencingStatus({ complaint, onStatusChange }) {
  const [status, setStatus] = useState('checking'); // checking, allowed, restricted, error
  const [locationInfo, setLocationInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (complaint?.citizenPhone) {
      checkCitizenLocation();
    }
  }, [complaint]);

  const checkCitizenLocation = async () => {
    setLoading(true);
    setStatus('checking');
    
    try {
      // Initialize Radar
      initRadar();
      
      // Check location
      const result = await checkLocationForCalling();
      
      setLocationInfo(result);
      
      if (result.canCall) {
        setStatus('allowed');
        onStatusChange?.('allowed', result);
      } else {
        setStatus('restricted');
        onStatusChange?.('restricted', result);
      }
    } catch (error) {
      console.error('Geofencing check failed:', error);
      setStatus('error');
      setLocationInfo({
        reason: 'Location check failed',
        error: error.message,
      });
    }
    
    setLoading(false);
  };

  const getStatusColor = () => {
    switch (status) {
      case 'allowed': return '#2ecc71';
      case 'restricted': return '#e74c3c';
      case 'error': return '#f39c12';
      default: return '#95a5a6';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'allowed': return '✅';
      case 'restricted': return '🚫';
      case 'error': return '⚠️';
      default: return '⏳';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'allowed': return 'Location Verified - Can Call';
      case 'restricted': return 'Restricted Zone - Skip Calling';
      case 'error': return 'Location Check Failed';
      default: return 'Checking Location...';
    }
  };

  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      padding: '16px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      border: `2px solid ${getStatusColor()}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            background: `${getStatusColor()}20`,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.3rem',
          }}>
            📍
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>Location Verification</div>
            <div style={{ fontSize: '0.8rem', color: '#666' }}>
              {complaint?.complaint_id || 'Complaint'}
            </div>
          </div>
        </div>
        
        <button
          onClick={checkCitizenLocation}
          disabled={loading}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: '#3498db',
            color: 'white',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? '🔄 Checking...' : '🔄 Recheck'}
        </button>
      </div>

      {/* Status Banner */}
      <div style={{
        background: `${getStatusColor()}15`,
        borderRadius: '8px',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '12px',
      }}>
        <span style={{ fontSize: '1.5rem' }}>{getStatusIcon()}</span>
        <div>
          <div style={{ fontWeight: 700, color: getStatusColor() }}>{getStatusText()}</div>
          {locationInfo?.reason && (
            <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '2px' }}>
              {locationInfo.reason}
            </div>
          )}
        </div>
      </div>

      {/* Location Details */}
      {locationInfo?.userLocation && (
        <div style={{
          background: '#f8f9fa',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '12px',
        }}>
          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '4px' }}>User Location</div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
            {locationInfo.userLocation.latitude.toFixed(6)}, {locationInfo.userLocation.longitude.toFixed(6)}
          </div>
        </div>
      )}

      {/* Nearby Places */}
      {locationInfo?.nearbyPlaces?.length > 0 && (
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px' }}>
            Nearby Places:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {locationInfo.nearbyPlaces.slice(0, 5).map((place, i) => (
              <span
                key={i}
                style={{
                  padding: '4px 10px',
                  background: '#f0f0f0',
                  borderRadius: '16px',
                  fontSize: '0.75rem',
                }}
              >
                {place.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Restricted Place Warning */}
      {status === 'restricted' && (
        <div style={{
          marginTop: '12px',
          padding: '12px',
          background: '#ffebee',
          borderRadius: '8px',
          border: '1px solid #ef9a9a',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>🚫</span>
            <span style={{ fontWeight: 700, color: '#c62828' }}>Call Restricted</span>
          </div>
          <div style={{ fontSize: '0.85rem', color: '#666' }}>
            The citizen is near a restricted location. This complaint will be added to the queue 
            without automated calling.
          </div>
          {locationInfo?.nearbyPlaces?.[0] && (
            <div style={{ marginTop: '8px', fontSize: '0.8rem' }}>
              <strong>Reason:</strong> Near {locationInfo.nearbyPlaces[0].name}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
