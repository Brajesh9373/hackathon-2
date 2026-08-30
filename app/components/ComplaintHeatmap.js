'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const KOPARGAON_CENTER = [19.885, 74.478];
const KOPARGAON_BOUNDS = [[19.875, 74.465], [19.9, 74.495]];

function readCoordinates(complaint) {
  const source = complaint?.location?.coords || complaint?.location || complaint || {};
  const latitude = Number(source.lat ?? source.latitude);
  const longitude = Number(source.lng ?? source.lon ?? source.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < 19.7 || latitude > 20.1 || longitude < 74.2 || longitude > 74.8) return null;
  return { latitude, longitude };
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function scoreOf(complaint) {
  const score = Number(complaint?.priority_score ?? complaint?.priority);
  return Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
}

function colorFor(score) {
  if (score >= 75) return '#c64d43';
  if (score >= 55) return '#d98332';
  if (score >= 35) return '#b19a2d';
  return '#15958f';
}

function statusLabel(status) {
  return String(status || 'FILED').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, character => character.toUpperCase());
}

function loadLeaflet() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Map is browser-only'));
  if (window.L) return Promise.resolve(window.L);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-nagarsetu-leaflet]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.L), { once: true });
      existing.addEventListener('error', () => reject(new Error('Map library could not load')), { once: true });
      return;
    }
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    stylesheet.dataset.nagarsetuLeaflet = 'true';
    document.head.appendChild(stylesheet);
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.dataset.nagarsetuLeaflet = 'true';
    script.onload = () => window.L ? resolve(window.L) : reject(new Error('Map library did not initialise'));
    script.onerror = () => reject(new Error('Map library could not load'));
    document.body.appendChild(script);
  });
}

export default function ComplaintHeatmap({ complaints = [] }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');
  const [activeId, setActiveId] = useState('');

  const points = useMemo(() => complaints.map((complaint, index) => {
    const coordinates = readCoordinates(complaint);
    if (!coordinates) return null;
    return {
      id: complaint._id || complaint.complaint_id || `mapped-${index}`,
      complaint,
      ...coordinates,
      score: scoreOf(complaint),
    };
  }).filter(Boolean), [complaints]);

  const clusters = useMemo(() => {
    const grouped = new Map();
    points.forEach(point => {
      const key = `${point.latitude.toFixed(3)},${point.longitude.toFixed(3)}`;
      const current = grouped.get(key) || { latitude: point.latitude, longitude: point.longitude, count: 0, maxScore: 0 };
      current.count += 1;
      current.maxScore = Math.max(current.maxScore, point.score);
      grouped.set(key, current);
    });
    return [...grouped.values()];
  }, [points]);

  const areas = useMemo(() => {
    const grouped = new Map();
    complaints.forEach(complaint => {
      const label = complaint.location?.ward || complaint.location?.area || complaint.location?.address;
      if (!label) return;
      const key = String(label).trim();
      const current = grouped.get(key) || { label: key, total: 0, open: 0 };
      current.total += 1;
      if (!['COMPLETED', 'VERIFIED', 'CLOSED'].includes(String(complaint.status || '').toUpperCase())) current.open += 1;
      grouped.set(key, current);
    });
    return [...grouped.values()].sort((left, right) => right.total - left.total).slice(0, 6);
  }, [complaints]);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then(L => {
      if (cancelled || !mapRef.current || mapInstanceRef.current) return;
      const map = L.map(mapRef.current, { zoomControl: true, attributionControl: true }).setView(KOPARGAON_CENTER, 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 18 }).addTo(map);
      map.setMaxBounds(KOPARGAON_BOUNDS);
      layersRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
      setMapReady(true);
      window.setTimeout(() => map.invalidateSize(), 80);
    }).catch(error => { if (!cancelled) setMapError(error.message || 'Map could not be loaded.'); });
    return () => {
      cancelled = true;
      if (mapInstanceRef.current) mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      layersRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !layersRef.current || !window.L) return;
    const L = window.L;
    layersRef.current.clearLayers();
    clusters.forEach(cluster => {
      const color = colorFor(cluster.maxScore);
      const area = L.circle([cluster.latitude, cluster.longitude], { radius: Math.min(260, 90 + cluster.count * 34), color, fillColor: color, fillOpacity: .16, weight: 2 });
      area.bindTooltip(`${cluster.count} mapped ${cluster.count === 1 ? 'complaint' : 'complaints'}`, { direction: 'top', opacity: .9 });
      area.addTo(layersRef.current);
    });
    points.forEach(point => {
      const complaint = point.complaint;
      const marker = L.circleMarker([point.latitude, point.longitude], { radius: 7, color: '#fff', weight: 2, fillColor: colorFor(point.score), fillOpacity: 1 });
      marker.bindPopup(`<strong>${escapeHtml(complaint.complaint_id || 'Complaint')}</strong><br>${escapeHtml(complaint.complaint_text || 'Civic issue')}<br><small>${escapeHtml(statusLabel(complaint.status))}</small>`);
      marker.on('click', () => setActiveId(String(point.id)));
      marker.addTo(layersRef.current);
    });
    if (points.length > 1) mapInstanceRef.current.fitBounds(L.latLngBounds(points.map(point => [point.latitude, point.longitude])), { padding: [24, 24], maxZoom: 15 });
  }, [clusters, mapReady, points]);

  const focus = point => {
    setActiveId(String(point.id));
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView([point.latitude, point.longitude], 16, { animate: true });
  };
  const unmapped = complaints.length - points.length;

  return <section className="v-heatmap" aria-label="Live complaint heat map">
    <div className="v-heatmap-head"><div><span className="v-eyebrow">NETWORK MAP</span><h2>Complaint density</h2><p>Only records with real coordinates are plotted. Nothing is invented when the register is empty.</p></div><span className="v-map-count"><strong>{points.length}</strong> mapped / {complaints.length} total</span></div>
    <div className="v-heatmap-canvas"><div ref={mapRef} className="v-heatmap-map" aria-label="OpenStreetMap showing complaint density" />{!mapReady && !mapError && <div className="v-map-overlay">Preparing the live map</div>}{mapError && <div className="v-map-overlay is-error">{mapError}</div>}</div>
    <div className="v-heatmap-meta"><div className="v-map-legend"><span><i className="dot-teal" />Low priority</span><span><i className="dot-amber" />Medium priority</span><span><i className="dot-coral" />High priority</span></div>{unmapped > 0 && <span className="v-map-unmapped">{unmapped} record{unmapped === 1 ? '' : 's'} without coordinates</span>}</div>
    {areas.length > 0 && <div className="v-map-areas">{areas.map(area => <div className="v-map-area" key={area.label}><span>{area.label}</span><strong>{area.total}</strong><small>{area.open} open</small></div>)}</div>}
    {!complaints.length && <div className="v-map-empty-copy"><strong>No complaint signal yet</strong><span>New citizen submissions will appear here after they include a map location.</span></div>}
    {points.length > 0 && <div className="v-map-records">{points.slice(0, 5).map(point => <button type="button" key={point.id} className={`v-map-record ${String(activeId) === String(point.id) ? 'is-active' : ''}`} onClick={() => focus(point)}><span><strong>{point.complaint.complaint_id || 'Complaint'}</strong><small>{point.complaint.location?.address || point.complaint.location?.ward || 'Mapped location'}</small></span><b style={{ color: colorFor(point.score) }}>{point.score || 0}</b></button>)}</div>}
  </section>;
}
