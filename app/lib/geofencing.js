/**
 * Geofencing Utility using Radar SDK
 * Checks if user location is in restricted zones (hospital, school, etc.)
 */

import Radar from 'radar-sdk-js';

// Restricted place types that should not be called
export const RESTRICTED_PLACE_TYPES = {
  hospital: 'Hospital',
  school: 'School',
  church: 'Church',
  mosque: 'Mosque',
  temple: 'Temple',
  bank: 'Bank',
  court: 'Court',
  government: 'Government Office',
  police: 'Police Station',
  fire_station: 'Fire Station',
};

// Kopargaon area coordinates
export const KOPARGAON_CENTER = {
  latitude: 19.8850,
  longitude: 74.4780,
};

// Default radius in meters
const DEFAULT_RADIUS = 100; // 100 meters from place center

let radarInitialized = false;

/**
 * Initialize Radar SDK with API key from env
 */
export function initRadar() {
  if (radarInitialized) return;
  
  const apiKey = process.env.NEXT_PUBLIC_RADAR_PUBLISHABLE_KEY;
  if (!apiKey) {
    console.warn('Radar API key not provided in env');
    return false;
  }
  
  Radar.initialize(apiKey, {
    logLevel: 'error',
  });
  
  radarInitialized = true;
  return true;
}

/**
 * Check if Radar is initialized
 */
export function isRadarInitialized() {
  return radarInitialized;
}

/**
 * Get user's current location and check for restricted places
 * @returns {Object} - { canCall: boolean, reason: string, nearbyPlaces: Array }
 */
export async function checkLocationForCalling() {
  if (!radarInitialized) {
    // Fallback without Radar - just get location
    return await checkLocationWithFallback();
  }
  
  try {
    // Track user's current location
    const result = await Radar.trackOnce();
    const { location, events } = result;
    
    if (!location) {
      return {
        canCall: true,
        reason: 'Could not determine location',
        nearbyPlaces: [],
      };
    }
    
    // Search for nearby places
    const placesResult = await Radar.searchPlaces({
      near: {
        latitude: location.coordinates.latitude,
        longitude: location.coordinates.longitude,
      },
      radius: 200, // 200 meters radius
      limit: 20,
    });
    
    const places = placesResult.places || [];
    
    // Check for restricted places
    const restrictedPlaces = places.filter(place => {
      const category = place.categories?.[0]?.toLowerCase() || '';
      return Object.keys(RESTRICTED_PLACE_TYPES).some(
        type => category.includes(type) || place.name?.toLowerCase().includes(type)
      );
    });
    
    if (restrictedPlaces.length > 0) {
      return {
        canCall: false,
        reason: `User is near a restricted location: ${restrictedPlaces[0].name}`,
        nearbyPlaces: restrictedPlaces,
        distance: restrictedPlaces[0].metadata?.distance,
        userLocation: location.coordinates,
      };
    }
    
    return {
      canCall: true,
      reason: 'Location verified - no restricted zones nearby',
      nearbyPlaces: places.slice(0, 5),
      userLocation: location.coordinates,
    };
    
  } catch (error) {
    console.error('Radar error:', error);
    return {
      canCall: true,
      reason: 'Location service unavailable - proceeding with call',
      nearbyPlaces: [],
      error: error.message,
    };
  }
}

/**
 * Fallback location check without Radar SDK
 */
async function checkLocationWithFallback() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({
        canCall: true,
        reason: 'Geolocation not supported',
        nearbyPlaces: [],
      });
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          canCall: true,
          reason: 'Location accessed (Radar not configured)',
          userLocation: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          nearbyPlaces: [],
        });
      },
      (error) => {
        resolve({
          canCall: true,
          reason: `Location access denied: ${error.message}`,
          nearbyPlaces: [],
        });
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  });
}

/**
 * Search for specific place types near a location
 */
export async function searchNearbyPlaces(location, tags = [], radius = 500) {
  if (!radarInitialized) {
    return [];
  }
  
  try {
    const result = await Radar.searchPlaces({
      near: location,
      radius,
      tags,
      limit: 10,
    });
    
    return result.places || [];
  } catch (error) {
    console.error('Error searching places:', error);
    return [];
  }
}

/**
 * Reverse geocode a location to get address
 */
export async function reverseGeocode(latitude, longitude) {
  if (!radarInitialized) {
    return null;
  }
  
  try {
    const result = await Radar.reverseGeocode({
      latitude,
      longitude,
    });
    
    return result.addresses?.[0] || null;
  } catch (error) {
    console.error('Reverse geocode error:', error);
    return null;
  }
}

/**
 * Check if coordinates are within Kopargaon area
 */
export function isWithinKopargaonArea(latitude, longitude) {
  const center = KOPARGAON_CENTER;
  const maxDistanceKm = 10; // 10km radius from center
  
  const distance = calculateDistance(
    center.latitude, center.longitude,
    latitude, longitude
  );
  
  return distance <= maxDistanceKm;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}
