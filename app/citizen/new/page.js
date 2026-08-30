'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PortalShell from '../../ui/PortalShell';
import { complaints } from '../../lib/api';
import { PageIntro, friendlyError } from '../../ui/PortalBlocks';

const categories = [
  ['GARBAGE_NOT_COLLECTED', 'Waste & cleanliness'],
  ['WATER_LOGGING', 'Water / flooding'],
  ['ROAD_DAMAGE', 'Roads & footpaths'],
  ['BLOCKED_SEWAGE', 'Drains & sewage'],
  ['STREETLIGHT', 'Street lighting'],
  ['OTHER', 'Something else'],
];

// Kopargaon locations with coordinates
const locations = [
  { id: 'sanjivani', name: 'Sanjivani College of Engineering', nameHi: 'संजीवनी इंजिनिअरिंग कॉलेज', lat: 19.8895, lng: 74.4815, ward: 'Ward 8' },
  { id: 'main_market', name: 'Main Market', nameHi: 'मुख्य बाजार', lat: 19.8844, lng: 74.4772, ward: 'Ward 1' },
  { id: 'temple', name: 'Shri Saibaba Temple Area', nameHi: 'श्री साईबाबा मंदिर', lat: 19.8831, lng: 74.4756, ward: 'Ward 3' },
  { id: 'station', name: 'Station Road / Bus Stand', nameHi: 'स्टेशन रोड', lat: 19.8862, lng: 74.4798, ward: 'Ward 2' },
  { id: 'hospital', name: 'Government Hospital Area', nameHi: 'सरकारी रुग्णालय', lat: 19.8870, lng: 74.4780, ward: 'Ward 6' },
  { id: 'old_town', name: 'Old Town', nameHi: 'जुना शहर', lat: 19.8820, lng: 74.4740, ward: 'Ward 5' },
  { id: 'industrial', name: 'Industrial Area', nameHi: 'औद्योगिक वसाहत', lat: 19.8900, lng: 74.4830, ward: 'Ward 8' },
];

export default function NewComplaintPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    category: 'GARBAGE_NOT_COLLECTED',
    complaint_text: '',
    address: 'Main Market',
    locationId: 'main_market',
    district: 'Ward 1'
  });
  const [photos, setPhotos] = useState([]);
  const [coords, setCoords] = useState({ latitude: 19.8844, longitude: 74.4772 });
  const [locationStatus, setLocationStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const update = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));

  const onLocationChange = (locationId) => {
    const location = locations.find(l => l.id === locationId);
    if (location) {
      setForm(current => ({
        ...current,
        locationId,
        address: location.name,
        district: location.ward
      }));
      setCoords({ latitude: location.lat, longitude: location.lng });
      setLocationStatus(`Location set to ${location.name}`);
    }
  };

  const onPhotos = event => {
    const files = Array.from(event.target.files || []).slice(0, 3);
    Promise.all(files.map(file => new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve({ url: reader.result, name: file.name });
      reader.readAsDataURL(file);
    }))).then(setPhotos);
  };

  const submit = async event => {
    event.preventDefault();
    setError('');
    if (form.complaint_text.trim().length < 12) return setError('Add a little more detail so the right team can act.');
    if (!form.address.trim()) return setError('Add the location of the issue.');
    setBusy(true);

    const result = await complaints.file({
      complaint_text: form.complaint_text.trim(),
      category: form.category,
      media_urls: photos.map(photo => ({ url: photo.url, type: 'photo' })),
      location: {
        address: form.address.trim(),
        area: form.address.trim(),
        ward: form.district,
        lat: coords.latitude,
        lng: coords.longitude
      },
      source: 'web'
    });

    setBusy(false);
    if (result?.success && result.complaint?.complaint_id) {
      router.push(`/citizen/complaints/${result.complaint.complaint_id}`);
    } else {
      setError(friendlyError(result?.error));
    }
  };

  const captureLocation = () => {
    if (!navigator.geolocation) return setLocationStatus('Location is not available in this browser.');
    setLocationStatus('Finding your location…');
    navigator.geolocation.getCurrentPosition(
      position => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setLocationStatus('Location attached to this complaint.');
      },
      () => setLocationStatus('Location permission was not granted.')
    );
  };

  const selectedLocation = locations.find(l => l.id === form.locationId);

  return (
    <PortalShell role="citizen">
      <PageIntro
        eyebrow="NEW COMPLAINT"
        title="Put an issue on the record."
        detail="A few useful details help the civic network route your request without a detour."
        action={<button className="v-button v-button-ghost" onClick={() => router.back()}>Cancel</button>}
      />

      <form className="v-form" onSubmit={submit}>
        <div className="v-panel">
          <div className="v-form-grid">

            {/* Location Selection */}
            <div className="v-field v-field-full">
              <label htmlFor="locationId">Select Location in Kopargaon</label>
              <select
                id="locationId"
                name="locationId"
                value={form.locationId}
                onChange={(e) => onLocationChange(e.target.value)}
              >
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.nameHi})
                  </option>
                ))}
              </select>

              {form.locationId === 'sanjivani' && (
                <div style={{
                  marginTop: '10px',
                  padding: '12px',
                  background: 'linear-gradient(135deg, rgba(155, 89, 182, 0.15) 0%, rgba(142, 68, 173, 0.15) 100%)',
                  borderRadius: '8px',
                  border: '1px solid rgba(155, 89, 182, 0.3)',
                  fontSize: '13px',
                  color: '#8e44ad'
                }}>
                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>🎓 Sanjivani College of Engineering</div>
                  <div>Complaint will be filed for this campus area</div>
                </div>
              )}
            </div>

            <div className="v-field v-field-full">
              <label htmlFor="complaint_text">What needs attention?</label>
              <textarea
                id="complaint_text"
                name="complaint_text"
                value={form.complaint_text}
                onChange={update}
                placeholder="Example: The drain outside our lane has been blocked since yesterday…"
                maxLength={800}
              />
              <small>{form.complaint_text.length}/800</small>
            </div>

            <div className="v-field">
              <label htmlFor="category">Choose a category</label>
              <select id="category" name="category" value={form.category} onChange={update}>
                {categories.map(([value, label]) => (
                  <option value={value} key={value}>{label}</option>
                ))}
              </select>
            </div>

            <div className="v-field">
              <label htmlFor="district">Ward</label>
              <select id="district" name="district" value={form.district} onChange={update}>
                <option value="Ward 1">Ward 1</option>
                <option value="Ward 2">Ward 2</option>
                <option value="Ward 3">Ward 3</option>
                <option value="Ward 4">Ward 4</option>
                <option value="Ward 5">Ward 5</option>
                <option value="Ward 6">Ward 6</option>
                <option value="Ward 7">Ward 7</option>
                <option value="Ward 8">Ward 8</option>
              </select>
            </div>

            <div className="v-field v-field-full">
              <label htmlFor="address">Address / Landmark</label>
              <input
                id="address"
                name="address"
                value={form.address}
                onChange={update}
                placeholder="Street, landmark or neighbourhood"
              />
            </div>

            <div className="v-field v-field-full">
              <label>GPS Coordinates (auto-filled)</label>
              <div style={{
                padding: '10px',
                background: '#f8f9fa',
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#666'
              }}>
                {coords.latitude.toFixed(6)}, {coords.longitude.toFixed(6)}
              </div>
            </div>

            <div className="v-field v-field-full">
              <label>Location safety check <span style={{ color: 'var(--v-muted)', fontWeight: 500 }}>(recommended)</span></label>
              <button type="button" className="v-button v-button-ghost" onClick={captureLocation}>
                {coords ? '✓ Location attached' : 'Use device location'}
              </button>
              {locationStatus && <small style={{ display: 'block', marginTop: '4px' }}>{locationStatus}</small>}
            </div>

            <div className="v-field v-field-full">
              <label>Photo evidence <span style={{ color: 'var(--v-muted)', fontWeight: 500 }}>(optional)</span></label>
              <input type="file" accept="image/*" multiple onChange={onPhotos} />
              {photos.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                  {photos.map((photo, i) => (
                    <div key={i} style={{
                      width: '60px',
                      height: '60px',
                      background: `url(${photo.url}) center/cover`,
                      borderRadius: '8px',
                      border: '2px solid #eee'
                    }} />
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

        {error && <p className="v-form-error">{error}</p>}

        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button type="submit" className="v-button v-button-primary" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit complaint'}
          </button>
          <button type="button" className="v-button v-button-ghost" onClick={() => router.back()}>
            Cancel
          </button>
        </div>
      </form>
    </PortalShell>
  );
}
