import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyRestrictedPlace,
  filterRestrictedPlaces,
  getPlaceDistanceMeters,
} from '../../app/lib/radarSafetyLogic.mjs';

const citizen = { latitude: 19.885, longitude: 74.478 };

test('does not treat a pharmacy or medical store as a restricted facility', () => {
  const place = {
    name: 'Jay Janardhan Medical Store',
    categories: ['medical-health', 'medical-center', 'hospital'],
    location: { coordinates: [74.496566, 19.9010533] },
  };

  assert.equal(classifyRestrictedPlace(place), null);
  assert.deepEqual(filterRestrictedPlaces([place], citizen), []);
});

test('ignores a restricted place returned outside the configured radius', () => {
  const place = {
    name: 'District Hospital',
    categories: [{ id: 'hospital', name: 'Hospital' }],
    location: { lat: 19.887, lon: 74.478 },
  };

  assert.ok(getPlaceDistanceMeters(place, citizen) > 100);
  assert.deepEqual(filterRestrictedPlaces([place], citizen, 100), []);
});

test('blocks an explicitly classified restricted facility inside the radius', () => {
  const place = {
    name: 'Kopargaon General Hospital',
    categories: [{ id: 'hospital', name: 'Hospital' }],
    location: { coordinates: [74.4784, 19.8852] },
  };

  const restricted = filterRestrictedPlaces([place], citizen, 100);
  assert.equal(restricted.length, 1);
  assert.equal(restricted[0].type, 'hospital');
  assert.ok(restricted[0].distanceMeters <= 100);
});
