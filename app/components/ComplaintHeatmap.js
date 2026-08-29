'use client';

import { useEffect, useRef, useState } from 'react';
import WardAIChat from './WardAIChat';

// Kopargaon ward coordinates (approximate boundaries)
const KOPARGAON_WARDS = [
  { id: 'ward_1', name: 'Ward 1 - Main Market', center: [19.8844, 74.4772], color: '#e74c3c' },
  { id: 'ward_2', name: 'Ward 2 - Station Road', center: [19.8862, 74.4798], color: '#3498db' },
  { id: 'ward_3', name: 'Ward 3 - Temple Area', center: [19.8831, 74.4756], color: '#2ecc71' },
  { id: 'ward_4', name: 'Ward 4 - New Layout', center: [19.8880, 74.4810], color: '#f39c12' },
  { id: 'ward_5', name: 'Ward 5 - Old Town', center: [19.8820, 74.4740], color: '#9b59b6' },
  { id: 'ward_6', name: 'Ward 6 - Hospital Area', center: [19.8870, 74.4780], color: '#1abc9c' },
  { id: 'ward_7', name: 'Ward 7 - School Zone', center: [19.8810, 74.4765], color: '#e67e22' },
  { id: 'ward_8', name: 'Ward 8 - Industrial', center: [19.8900, 74.4830], color: '#34495e' },
];

export default function ComplaintHeatmap({ complaints = [], showAIChat = true }) {
  const mapRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedWard, setSelectedWard] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const mapInstanceRef = useRef(null);

  const getComplaintsByWard = () => {
    const counts = {};
    complaints.forEach(c => {
      const ward = c.location?.ward || c.ward || 'ward_1';
      counts[ward] = (counts[ward] || 0) + 1;
    });
    return counts;
  };

  const getHeatColor = (count, maxCount) => {
    if (count === 0) return 'rgba(46, 204, 113, 0.3)';
    const intensity = Math.min(count / Math.max(maxCount, 1), 1);
    if (intensity < 0.33) return `rgba(241, 196, 15, ${0.3 + intensity * 0.4})`;
    else if (intensity < 0.66) return `rgba(230, 126, 34, ${0.4 + intensity * 0.3})`;
    else return `rgba(231, 76, 60, ${0.5 + intensity * 0.3})`;
  };

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      const L = window.L;
      const map = L.map(mapRef.current).setView([19.8850, 74.4780], 14);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map);

      const counts = getComplaintsByWard();
      const maxCount = Math.max(...Object.values(counts), 1);

      KOPARGAON_WARDS.forEach(ward => {
        const count = counts[ward.id] || 0;
        const radius = Math.max(100, count * 30 + 150);
        
        const circle = L.circle(ward.center, {
          color: getHeatColor(count, maxCount),
          fillColor: getHeatColor(count, maxCount),
          fillOpacity: 0.6,
          radius: radius,
          weight: 2,
        }).addTo(map);

        circle.bindPopup(`
          <div style="text-align: center; min-width: 150px;">
            <strong style="font-size: 14px;">${ward.name}</strong>
            <hr style="margin: 8px 0;">
            <div style="font-size: 24px; font-weight: bold; color: ${count > 0 ? '#e74c3c' : '#2ecc71'};">
              ${count}
            </div>
            <div style="color: #666; font-size: 12px;">Complaints</div>
            ${showAIChat ? '<div style="margin-top: 8px; font-size: 11px; color: #3498db;">Click to chat with AI</div>' : ''}
          </div>
        `);

        circle.on('click', () => {
          setSelectedWard(ward.id);
          if (showAIChat) {
            setShowChat(true);
          }
        });
      });

      KOPARGAON_WARDS.forEach(ward => {
        const count = counts[ward.id] || 0;
        const icon = L.divIcon({
          html: `
            <div style="
              background: white;
              border: 2px solid ${getHeatColor(count, maxCount)};
              border-radius: 20px;
              padding: 4px 10px;
              font-size: 12px;
              font-weight: bold;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              text-align: center;
              white-space: nowrap;
              cursor: pointer;
            ">
              <div style="font-size: 16px; font-weight: bold;">${count}</div>
              <div style="font-size: 10px; color: #666;">${ward.id.replace('ward_', 'W')}</div>
            </div>
          `,
          className: 'ward-label',
          iconAnchor: [0, 0],
        });
        
        L.marker(ward.center, { icon }).addTo(map);
      });

      mapInstanceRef.current = map;
      setMapLoaded(true);
    };
    document.head.appendChild(script);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const wardComplaints = selectedWard 
    ? complaints.filter(c => (c.location?.ward || c.ward) === selectedWard)
    : [];

  const selectedWardInfo = KOPARGAON_WARDS.find(w => w.id === selectedWard);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
      {/* Map Container */}
      <div style={{ 
        borderRadius: '12px', 
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        position: 'relative'
      }}>
        <div 
          ref={mapRef} 
          style={{ 
            height: '450px', 
            width: '100%',
            background: '#e8e8e8'
          }} 
        />
        
        {/* Legend */}
        <div style={{
          position: 'absolute',
          bottom: '16px',
          left: '16px',
          background: 'white',
          padding: '12px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          fontSize: '12px',
          zIndex: 1000
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Click any ward to chat with AI</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <div style={{ width: '20px', height: '20px', background: 'rgba(46, 204, 113, 0.4)', borderRadius: '4px' }} />
            <span>Low / None</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <div style={{ width: '20px', height: '20px', background: 'rgba(241, 196, 15, 0.6)', borderRadius: '4px' }} />
            <span>Medium</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <div style={{ width: '20px', height: '20px', background: 'rgba(230, 126, 34, 0.7)', borderRadius: '4px' }} />
            <span>High</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '20px', height: '20px', background: 'rgba(231, 76, 60, 0.8)', borderRadius: '4px' }} />
            <span>Critical</span>
          </div>
        </div>

        {/* Instruction */}
        {showAIChat && (
          <div style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(255, 153, 51, 0.95)',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 600,
            zIndex: 1000,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
          }}>
            🤖 Click a ward to chat with AI
          </div>
        )}
      </div>

      {/* Ward Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '12px'
      }}>
        {KOPARGAON_WARDS.map(ward => {
          const count = getComplaintsByWard()[ward.id] || 0;
          const pending = complaints.filter(c => (c.location?.ward || c.ward) === ward.id && ['FILED', 'ASSIGNED', 'IN_PROGRESS'].includes(c.status)).length;
          return (
            <div 
              key={ward.id}
              onClick={() => { setSelectedWard(ward.id); setShowChat(true); }}
              style={{
                padding: '16px',
                background: 'white',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                cursor: 'pointer',
                borderLeft: `4px solid ${getHeatColor(count, Math.max(...Object.values(getComplaintsByWard()), 1))}`,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#666' }}>{ward.id.replace('ward_', 'Ward ')}</span>
                <span style={{ fontSize: '14px' }}>🤖</span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: count > 0 ? '#e74c3c' : '#2ecc71' }}>{count}</div>
              <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>Total Complaints</div>
              {pending > 0 && (
                <div style={{ marginTop: '8px', fontSize: '10px', color: '#f39c12' }}>
                  ⏳ {pending} pending
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* AI Chat Modal */}
      {showChat && selectedWard && showAIChat && (
        <WardAIChat 
          wardId={selectedWard}
          wardComplaints={wardComplaints}
          onClose={() => { setShowChat(false); setSelectedWard(null); }}
        />
      )}
    </div>
  );
}
