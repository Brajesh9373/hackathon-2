const test = require('node:test');
const assert = require('node:assert/strict');
const Complaint = require('../src/models/Complaint');
const { SANJIVANI_LOCATION } = require('../src/config/civicLocation');

test('complaint model enforces the fixed Sanjivani pilot location', async () => {
  const complaint = new Complaint({
    complaint_id: 'TEST-CAMPUS-LOCATION',
    citizen_id: '000000000000000000000001',
    complaint_text: 'Test complaint',
    category: 'OTHER',
    module: 'DEVELOPMENT',
    location: { address: 'A caller supplied a different place', coords: { lat: 28.6, lng: 77.2 } },
  });
  await complaint.validate();
  assert.equal(complaint.location.coords.lat, SANJIVANI_LOCATION.coords.lat);
  assert.equal(complaint.location.coords.lng, SANJIVANI_LOCATION.coords.lng);
  assert.equal(complaint.location.address, SANJIVANI_LOCATION.address);
  assert.equal(complaint.location.district, SANJIVANI_LOCATION.district);
});
