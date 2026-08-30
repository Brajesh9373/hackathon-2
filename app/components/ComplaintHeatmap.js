'use client';

import { useEffect, useRef, useState } from 'react';
import WardAIChat from './WardAIChat';

// Kopargaon area boundaries - entire Kopargaon town
const KOPARGAON_BOUNDS = {
  minLat: 19.8780,
  maxLat: 19.8950,
  minLng: 74.4680,
  maxLng: 74.4900
};

// Uniform grid size (~300 meters)
const GRID_SIZE = 0.003;

// Named areas in Kopargaon (for reference)
const NAMED_AREAS = [
  { name: 'Sanjivani College', nameHi: 'संजीवनी कॉलेज', lat: 19.8895, lng: 74.4815 },
  { name: 'Main Market', nameHi: 'मुख्य बाजार', lat: 19.8844, lng: 74.4772 },
  { name: 'Temple Area', nameHi: 'मंदिर परिसर', lat: 19.8831, lng: 74.4756 },
  { name: 'Station Road', nameHi: 'स्टेशन रोड', lat: 19.8862, lng: 74.4798 },
  { name: 'Hospital', nameHi: 'रुग्णालय', lat: 19.8870, lng: 74.4780 },
  { name: 'Old Town', nameHi: 'जुना शहर', lat: 19.8820, lng: 74.4740 },
  { name: 'Industrial', nameHi: 'औद्योगिक', lat: 19.8900, lng: 74.4830 },
  { name: 'New Layout', nameHi: 'नवीन लेआउट', lat: 19.8880, lng: 74.4810 },
  { name: 'Cotton Market', nameHi: 'कॉटन मार्केट', lat: 19.8848, lng: 74.4778 },
  { name: 'Sonwane Road', nameHi: 'सोनवणे रोड', lat: 19.8855, lng: 74.4765 },
  { name: 'Talegoan Road', nameHi: 'तळेगाव रोड', lat: 19.8865, lng: 74.4800 },
  { name: 'Wagholi Road', nameHi: 'वाघोली रोड', lat: 19.8835, lng: 74.4730 },
];

// Find the closest named area for a coordinate
function getClosestArea(lat, lng) {
  let closest = null;
  let minDist = Infinity;
  
  NAMED_AREAS.forEach(area => {
    const dist = Math.sqrt(Math.pow(area.lat - lat, 2) + Math.pow(area.lng - lng, 2));
    if (dist < minDist) {
      minDist = dist;
      closest = area;
    }
  });
  
  return closest;
}

// Generate uniform grid clusters covering entire Kopargaon
function generateClusters() {
  const clusters = [];
  let clusterId = 1;
  
  for (let lat = KOPARGAON_BOUNDS.minLat; lat < KOPARGAON_BOUNDS.maxLat; lat += GRID_SIZE) {
    for (let lng = KOPARGAON_BOUNDS.minLng; lng < KOPARGAON_BOUNDS.maxLng; lng += GRID_SIZE) {
      const centerLat = lat + GRID_SIZE / 2;
      const centerLng = lng + GRID_SIZE / 2;
      
      // Find the closest named area
      const closestArea = getClosestArea(centerLat, centerLng);
      
      clusters.push({
        id: `cluster_${clusterId}`,
        name: closestArea?.name || 'Kopargaon',
        nameHi: closestArea?.nameHi || 'कोपरगाव',
        center: [centerLat, centerLng],
        bounds: {
          minLat: lat,
          maxLat: lat + GRID_SIZE,
          minLng: lng,
          maxLng: lng + GRID_SIZE
        }
      });
      
      clusterId++;
    }
  }
  
  return clusters;
}

const KOPARGAON_CLUSTERS = generateClusters();

export default function ComplaintHeatmap({ complaints = [], showAIChat = true }) {
  const mapRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const mapInstanceRef = useRef(null);

  // Assign complaints to clusters based on location
  const getComplaintsByCluster = () => {
    const counts = {};
    const pendingCounts = {};
    KOPARGAON_CLUSTERS.forEach(c => { 
      counts[c.id] = 0; 
      pendingCounts[c.id] = 0;
    });
    
    complaints.forEach(complaint => {
      let lat = complaint.location?.lat || complaint.lat;
      let lng = complaint.location?.lng || complaint.lng;
      
      // Generate coordinates based on ward if not present
      if (!lat || !lng) {
        const rawWard = complaint.location?.ward || complaint.ward || '';
        const match = rawWard.match(/Ward\s*(\d+)/i);
        if (match) {
          const wardNum = parseInt(match[1]);
          const wardCoords = {
            1: [19.8844, 74.4772], 2: [19.8862, 74.4798], 3: [19.8831, 74.4756],
            4: [19.8880, 74.4810], 5: [19.8820, 74.4740], 6: [19.8870, 74.4780],
            7: [19.8810, 74.4765], 8: [19.8900, 74.4830]
          };
          [lat, lng] = wardCoords[wardNum] || [19.8850, 74.4780];
        } else {
          [lat, lng] = [19.8850, 74.4780];
        }
      }
      
      // Find cluster
      const cluster = KOPARGAON_CLUSTERS.find(c => 
        lat >= c.bounds.minLat && lat < c.bounds.maxLat &&
        lng >= c.bounds.minLng && lng < c.bounds.maxLng
      );
      
      if (cluster) {
        counts[cluster.id]++;
        if (['FILED', 'ASSIGNED', 'IN_PROGRESS'].includes(complaint.status)) {
          pendingCounts[cluster.id]++;
        }
      }
    });
    
    return { counts, pendingCounts };
  };

  const getHeatColor = (count, maxCount) => {
    if (count === 0) return 'rgba(46, 204, 113, 0.4)';
    const intensity = Math.min(count / Math.max(maxCount, 1), 1);
    if (intensity < 0.33) return `rgba(241, 196, 15, ${0.4 + intensity * 0.3})`;
    else if (intensity < 0.66) return `rgba(230, 126, 34, ${0.5 + intensity * 0.3})`;
    else return `rgba(231, 76, 60, ${0.6 + intensity * 0.3})`;
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
      const map = L.map(mapRef.current).setView([19.8855, 74.4780], 14);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map);

      const { counts } = getComplaintsByCluster();
      const maxCount = Math.max(...Object.values(counts), 1);

      // Draw cluster heat spots
      KOPARGAON_CLUSTERS.forEach(cluster => {
        const count = counts[cluster.id] || 0;
        if (count > 0) {
          const radius = Math.max(50, count * 25 + 80);
          
          const circle = L.circle(cluster.center, {
            color: getHeatColor(count, maxCount),
            fillColor: getHeatColor(count, maxCount),
            fillOpacity: 0.5,
            radius: radius,
            weight: 1,
          }).addTo(map);

          circle.bindPopup(`
            <div style="text-align: center; min-width: 180px;">
              <strong style="font-size: 13px;">${cluster.name}</strong>
              <div style="font-size: 11px; color: #666;">${cluster.nameHi}</div>
              <hr style="margin: 6px 0;">
              <div style="font-size: 22px; font-weight: bold; color: ${count > 0 ? '#e74c3c' : '#2ecc71'};">${count}</div>
              <div style="color: #666; font-size: 11px;">Complaints</div>
            </div>
          `);

          circle.on('click', () => {
            setSelectedCluster(cluster.id);
            if (showAIChat) setShowChat(true);
          });
        }
      });

      // Add landmark markers
      NAMED_AREAS.forEach(landmark => {
        const icon = L.divIcon({
          html: `
            <div style="
              background: ${landmark.name.includes('College') ? '#9b59b6' : landmark.name.includes('Hospital') ? '#e74c3c' : '#3498db'};
              border: 2px solid white;
              border-radius: 50%;
              width: 24px;
              height: 24px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            ">📍</div>
          `,
          className: 'landmark-marker',
          iconAnchor: [12, 12],
        });
        
        L.marker(landmark.center, { icon }).addTo(map).bindPopup(`
          <div style="text-align: center;">
            <strong>${landmark.name}</strong>
            <div style="font-size: 11px; color: #666;">${landmark.nameHi}</div>
          </div>
        `);
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

  const { counts: clusterCounts, pendingCounts: clusterPending } = getComplaintsByCluster();
  const selectedClusterData = KOPARGAON_CLUSTERS.find(c => c.id === selectedCluster);
  const clusterComplaints = selectedCluster 
    ? complaints.filter(c => {
        let lat = c.location?.lat || c.lat;
        let lng = c.location?.lng || c.lng;
        if (!lat || !lng) {
          const rawWard = c.location?.ward || c.ward || '';
          const match = rawWard.match(/Ward\s*(\d+)/i);
          if (match) {
            const wardCoords = {
              1: [19.8844, 74.4772], 2: [19.8862, 74.4798], 3: [19.8831, 74.4756],
              4: [19.8880, 74.4810], 5: [19.8820, 74.4740], 6: [19.8870, 74.4780],
              7: [19.8810, 74.4765], 8: [19.8900, 74.4830]
            };
            [lat, lng] = wardCoords[parseInt(match[1])] || [19.8850, 74.4780];
          } else {
            [lat, lng] = [19.8850, 74.4780];
          }
        }
        return lat >= selectedClusterData?.bounds.minLat && lat < selectedClusterData?.bounds.maxLat &&
               lng >= selectedClusterData?.bounds.minLng && lng < selectedClusterData?.bounds.maxLng;
      })
    : [];

  // Get unique areas with complaints
  const areasWithComplaints = NAMED_AREAS.map(landmark => {
    const landmarkClusters = KOPARGAON_CLUSTERS.filter(c => 
      c.name === landmark.name && clusterCounts[c.id] > 0
    );
    const total = landmarkClusters.reduce((sum, c) => sum + clusterCounts[c.id], 0);
    const pending = landmarkClusters.reduce((sum, c) => sum + clusterPending[c.id], 0);
    return { ...landmark, total, pending };
  }).filter(a => a.total > 0).sort((a, b) => b.total - a.total);

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
          style={{ height: '400px', width: '100%', background: '#e8e8e8' }} 
        />
        
        {/* Legend */}
        <div style={{
          position: 'absolute', bottom: '16px', left: '16px',
          background: 'white', padding: '12px', borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)', fontSize: '11px', zIndex: 1000
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>Complaint Density</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
            <div style={{ width: '16px', height: '16px', background: 'rgba(46, 204, 113, 0.4)', borderRadius: '3px' }} />
            <span>Low</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
            <div style={{ width: '16px', height: '16px', background: 'rgba(241, 196, 15, 0.6)', borderRadius: '3px' }} />
            <span>Medium</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
            <div style={{ width: '16px', height: '16px', background: 'rgba(230, 126, 34, 0.7)', borderRadius: '3px' }} />
            <span>High</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '16px', height: '16px', background: 'rgba(231, 76, 60, 0.8)', borderRadius: '3px' }} />
            <span>Critical</span>
          </div>
        </div>

        {/* Landmark Legend */}
        <div style={{
          position: 'absolute', bottom: '16px', right: '16px',
          background: 'white', padding: '10px', borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)', fontSize: '10px', zIndex: 1000
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Landmarks</div>
          {NAMED_AREAS.slice(0, 4).map((l, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
              <span>📍</span>
              <span>{l.nameHi || l.name}</span>
            </div>
          ))}
        </div>

        {showAIChat && (
          <div style={{
            position: 'absolute', top: '16px', right: '16px',
            background: 'rgba(255, 153, 51, 0.95)', color: 'white',
            padding: '8px 14px', borderRadius: '8px', fontSize: '11px', fontWeight: 600,
            zIndex: 1000, boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
          }}>
            🤖 Click a cluster to chat with AI
          </div>
        )}
      </div>

      {/* Area Summary Cards */}
      {areasWithComplaints.length > 0 && (
        <div>
          <h3 style={{ marginBottom: '12px', fontSize: '14px', color: '#666' }}>
            Areas with Complaints - क्षेत्रात तक्रारी
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '10px'
          }}>
            {areasWithComplaints.map((area, i) => {
              const clusterId = KOPARGAON_CLUSTERS.find(c => 
                c.name === area.name && 
                Math.abs(c.center[0] - area.lat) < 0.003 &&
                Math.abs(c.center[1] - area.lng) < 0.003
              )?.id;
              
              return (
                <div 
                  key={i}
                  onClick={() => { 
                    const cluster = KOPARGAON_CLUSTERS.find(c => 
                      c.name === area.name && clusterCounts[c.id] > 0
                    );
                    if (cluster) {
                      setSelectedCluster(cluster.id);
                      setShowChat(true);
                    }
                  }}
                  style={{
                    padding: '14px',
                    background: 'white',
                    borderRadius: '10px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                    cursor: 'pointer',
                    borderLeft: `4px solid ${area.type === 'college' ? '#9b59b6' : area.type === 'hospital' ? '#e74c3c' : '#3498db'}`,
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#666' }}>{area.name}</span>
                    <span style={{ fontSize: '12px' }}>🤖</span>
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#e74c3c' }}>{area.total}</div>
                  <div style={{ fontSize: '10px', color: '#999', marginTop: '2px' }}>Total Complaints</div>
                  {area.pending > 0 && (
                    <div style={{ marginTop: '6px', fontSize: '10px', color: '#f39c12' }}>
                      ⏳ {area.pending} pending
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sanjivani College Highlight */}
      <div style={{
        background: 'linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)',
        borderRadius: '12px',
        padding: '16px',
        color: 'white',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '2rem' }}>🎓</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>Sanjivani College of Engineering</div>
            <div style={{ opacity: 0.8, fontSize: '0.85rem' }}>संजीवनी इंजिनिअरिंग कॉलेज</div>
          </div>
        </div>
      </div>

      {/* AI Chat Modal */}
      {showChat && selectedCluster && selectedClusterData && showAIChat && (
        <WardAIChat 
          wardId={selectedCluster}
          wardComplaints={clusterComplaints}
          onClose={() => { setShowChat(false); setSelectedCluster(null); }}
        />
      )}
    </div>
  );
}
