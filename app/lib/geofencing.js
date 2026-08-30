/**
 * Radar safety gate for automated citizen calls.
 *
 * radar-sdk-js 3.x exposes callback-based browser methods. Keeping the
 * callback bridge here prevents a false "allowed" result from an unresolved
 * promise and gives every caller the same fail-closed contract.
 */
import Radar from 'radar-sdk-js';
import {
  SEARCH_RADIUS_METERS,
  MAX_LOCATION_ACCURACY_METERS,
  filterRestrictedPlaces,
  isLocationAccurateEnough,
} from './radarSafetyLogic.mjs';

export const RESTRICTED_PLACE_TYPES = {
  hospital: 'Hospital',
  clinic: 'Clinic / medical centre',
  school: 'School',
  college: 'College',
  church: 'Church',
  mosque: 'Mosque',
  temple: 'Temple',
  bank: 'Bank',
  court: 'Court',
  government: 'Government office',
  police: 'Police station',
  fire_station: 'Fire station',
};

export const KOPARGAON_CENTER = { latitude: 19.8850, longitude: 74.4780 };
// Radar's places endpoint requires at least one filter. Keep the query scoped
// to the sensitive place categories we actually use for call safety, rather
// than requesting an unfiltered (and rejected) nearby-place search.
const SAFETY_PLACE_CATEGORIES = [
  'hospital',
  'clinic',
  'school',
  'college',
  'police',
  'fire_station',
  'government',
  'court',
  'bank',
  'place_of_worship',
];
let radarInitialized = false;

function radarCall(method, options) {
  return new Promise((resolve, reject) => {
    try {
      Radar[method](options, (error, result) => {
        if (error) reject(error);
        else resolve(result || {});
      });
    } catch (error) {
      reject(error);
    }
  });
}

export function initRadar() {
  if (typeof window === 'undefined') return false;
  if (radarInitialized) return true;
  const apiKey = process.env.NEXT_PUBLIC_RADAR_PUBLISHABLE_KEY;
  if (!apiKey) return false;
  try {
    Radar.initialize(apiKey);
    radarInitialized = true;
    return true;
  } catch (error) {
    console.error('Radar initialization failed:', error);
    return false;
  }
}

export function isRadarInitialized() { return radarInitialized; }

function blocked(reason, extra = {}) {
  return { canCall: false, reason, nearbyPlaces: [], ...extra };
}

/** Check a known citizen/complaint coordinate without using the worker's GPS. */
export async function checkCoordinatesForCalling(coordinates) {
  if (!coordinates || !Number.isFinite(Number(coordinates.latitude)) || !Number.isFinite(Number(coordinates.longitude))) {
    return blocked('Citizen location is missing, so the automated call is held.');
  }
  if (Number(coordinates.latitude) < -90 || Number(coordinates.latitude) > 90 || Number(coordinates.longitude) < -180 || Number(coordinates.longitude) > 180) {
    return blocked('Citizen location is invalid, so the automated call is held.');
  }
  if (!radarInitialized && !initRadar()) {
    return blocked('Radar safety verification is not configured, so the automated call is held.');
  }
  const accuracy = Number.isFinite(Number(coordinates.accuracy)) ? Number(coordinates.accuracy) : undefined;
  const userLocation = { latitude: Number(coordinates.latitude), longitude: Number(coordinates.longitude), ...(accuracy === undefined ? {} : { accuracy }) };
  if (!isLocationAccurateEnough(accuracy)) {
    return blocked(`Location accuracy is ${Math.round(accuracy)}m, so Radar cannot safely determine whether a restricted facility is nearby.`, {
      userLocation,
      accuracyMeters: accuracy,
      maxAccuracyMeters: MAX_LOCATION_ACCURACY_METERS,
    });
  }
  try {
    const placesResult = await radarCall('searchPlaces', {
      near: userLocation,
      radius: SEARCH_RADIUS_METERS,
      categories: SAFETY_PLACE_CATEGORIES,
      limit: 20,
    });
    const places = Array.isArray(placesResult.places) ? placesResult.places : [];
    const restricted = filterRestrictedPlaces(places, userLocation, SEARCH_RADIUS_METERS);
    if (restricted.length) {
      const place = restricted[0];
      const typeLabel = RESTRICTED_PLACE_TYPES[place.type] || 'restricted facility';
      return blocked(`Citizen is within ${place.distanceMeters}m of ${place.name || typeLabel}; automated call skipped.`, {
        nearbyPlaces: restricted,
        userLocation,
        restrictedPlace: place.name || typeLabel,
        distanceMeters: place.distanceMeters,
      });
    }
    return { canCall: true, reason: 'Citizen location verified; no restricted place nearby.', nearbyPlaces: places.slice(0, 5), userLocation };
  } catch (error) {
    console.error('Radar place check failed:', error);
    return blocked('Radar could not verify the citizen location, so the automated call is held.', { userLocation, error: error.message });
  }
}

/** Check the current browser location, used only by the safety diagnostics UI. */
export async function checkLocationForCalling() {
  if (!radarInitialized && !initRadar()) {
    return blocked('Radar safety verification is not configured, so the automated call is held.');
  }
  try {
    const tracked = await radarCall('trackOnce');
    const location = tracked.location || {};
    const coordinates = location.coordinates || location;
    return checkCoordinatesForCalling({
      latitude: coordinates.latitude ?? coordinates.lat,
      longitude: coordinates.longitude ?? coordinates.lon ?? coordinates.lng,
      accuracy: coordinates.accuracy ?? location.accuracy,
    });
  } catch (error) {
    console.error('Radar location check failed:', error);
    return blocked('Could not verify the current location, so the automated call is held.', { error: error.message });
  }
}

export async function searchNearbyPlaces(location, tags = [], radius = 500) {
  if (!radarInitialized && !initRadar()) return [];
  try {
    const result = await radarCall('searchPlaces', { near: location, radius, categories: tags, limit: 10 });
    return result.places || [];
  } catch (error) {
    console.error('Error searching places:', error);
    return [];
  }
}

export async function reverseGeocode(latitude, longitude) {
  if (!radarInitialized && !initRadar()) return null;
  try {
    const result = await radarCall('reverseGeocode', { latitude, longitude });
    return result.addresses?.[0] || null;
  } catch (error) {
    console.error('Reverse geocode error:', error);
    return null;
  }
}

export function isWithinKopargaonArea(latitude, longitude) {
  return calculateDistance(KOPARGAON_CENTER.latitude, KOPARGAON_CENTER.longitude, latitude, longitude) <= 10;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function toRad(deg) { return deg * (Math.PI / 180); }
