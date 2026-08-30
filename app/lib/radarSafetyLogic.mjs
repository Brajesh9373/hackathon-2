const EXCLUDED_PLACE_HINTS = [
  'pharmacy',
  'medical-store',
  'chemist',
  'drug-store',
  'drugstore',
];

const CATEGORY_RULES = [
  { type: 'hospital', tokens: ['hospital', 'medical-center', 'medical-centre', 'health-center', 'health-centre'] },
  { type: 'clinic', tokens: ['clinic', 'doctor-office', 'doctors-office'] },
  { type: 'school', tokens: ['school', 'primary-school', 'secondary-school'] },
  { type: 'college', tokens: ['college', 'university'] },
  { type: 'police', tokens: ['police', 'police-station'] },
  { type: 'fire_station', tokens: ['fire-station', 'fire-department'] },
  { type: 'government', tokens: ['government-office', 'government-building', 'public-services-government'] },
  { type: 'court', tokens: ['court', 'courthouse'] },
  { type: 'bank', tokens: ['bank', 'bank-branch'] },
  { type: 'place_of_worship', tokens: ['church', 'mosque', 'temple', 'place-of-worship', 'religion'] },
];

export const SEARCH_RADIUS_METERS = 100;
export const MAX_LOCATION_ACCURACY_METERS = 100;

function normalizeToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getCategoryTokens(place) {
  const categories = Array.isArray(place?.categories) ? place.categories : [];
  return categories.flatMap(category => {
    if (typeof category === 'string') return [category];
    return [category?.id, category?.name];
  }).filter(Boolean).map(normalizeToken);
}

function tokenMatches(token, candidate) {
  return token === candidate || token.startsWith(`${candidate}-`) || token.endsWith(`-${candidate}`);
}

function hasExcludedHint(place) {
  const tokens = [...getCategoryTokens(place), normalizeToken(place?.name)];
  return tokens.some(token => EXCLUDED_PLACE_HINTS.some(hint => token === hint || token.includes(hint)));
}

function categoryMatches(place, rule) {
  return getCategoryTokens(place).some(token => rule.tokens.some(candidate => tokenMatches(token, candidate)));
}

/**
 * Classify only explicit Radar facility categories. A pharmacy or medical
 * store is not a restricted facility, even when Radar loosely labels it as a
 * clinic or returns it in a medical-health result.
 */
export function classifyRestrictedPlace(place) {
  const excluded = hasExcludedHint(place);
  const matchedRule = CATEGORY_RULES.find(rule => categoryMatches(place, rule));
  if (excluded && !/\b(?:hospital|police\s+station|fire\s+station|school|college|court|church|mosque|temple)\b/i.test(String(place?.name || ''))) {
    return null;
  }
  return matchedRule?.type || null;
}

function finiteCoordinate(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

export function getPlaceCoordinates(place) {
  const location = place?.location || {};
  if (Array.isArray(location.coordinates) && location.coordinates.length >= 2) {
    // GeoJSON coordinates are [longitude, latitude].
    const longitude = finiteCoordinate(location.coordinates[0]);
    const latitude = finiteCoordinate(location.coordinates[1]);
    if (latitude !== null && longitude !== null) return { latitude, longitude };
  }
  const latitude = finiteCoordinate(location.latitude ?? location.lat ?? place?.latitude ?? place?.lat);
  const longitude = finiteCoordinate(location.longitude ?? location.lon ?? location.lng ?? place?.longitude ?? place?.lon ?? place?.lng);
  return latitude !== null && longitude !== null ? { latitude, longitude } : null;
}

function validCoordinates(coordinates) {
  return coordinates && Number.isFinite(Number(coordinates.latitude)) && Number.isFinite(Number(coordinates.longitude))
    && Number(coordinates.latitude) >= -90 && Number(coordinates.latitude) <= 90
    && Number(coordinates.longitude) >= -180 && Number(coordinates.longitude) <= 180;
}

export function getPlaceDistanceMeters(place, userLocation) {
  const placeCoordinates = getPlaceCoordinates(place);
  if (!validCoordinates(placeCoordinates) || !validCoordinates(userLocation)) return null;
  const earthRadiusMeters = 6371000;
  const toRadians = degrees => degrees * (Math.PI / 180);
  const deltaLatitude = toRadians(Number(placeCoordinates.latitude) - Number(userLocation.latitude));
  const deltaLongitude = toRadians(Number(placeCoordinates.longitude) - Number(userLocation.longitude));
  const latitudeOne = toRadians(Number(userLocation.latitude));
  const latitudeTwo = toRadians(Number(placeCoordinates.latitude));
  const arc = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(latitudeOne) * Math.cos(latitudeTwo) * Math.sin(deltaLongitude / 2) ** 2;
  return earthRadiusMeters * (2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc)));
}

export function filterRestrictedPlaces(places, userLocation, radiusMeters = SEARCH_RADIUS_METERS) {
  if (!Array.isArray(places) || !validCoordinates(userLocation)) return [];
  return places.map(place => {
    const type = classifyRestrictedPlace(place);
    if (!type) return null;
    const distanceMeters = getPlaceDistanceMeters(place, userLocation);
    // Never block on a loosely classified place without a verifiable distance.
    if (distanceMeters === null || distanceMeters > radiusMeters) return null;
    return { ...place, type, distanceMeters: Math.round(distanceMeters) };
  }).filter(Boolean).sort((first, second) => first.distanceMeters - second.distanceMeters);
}

export function isLocationAccurateEnough(accuracy) {
  return accuracy === undefined || accuracy === null || !Number.isFinite(Number(accuracy)) || Number(accuracy) <= MAX_LOCATION_ACCURACY_METERS;
}
