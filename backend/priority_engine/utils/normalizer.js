/**
 * Data Normalizer
 * Converts raw civic data into standardized, normalized values (0-1 scale)
 * This ensures consistent scoring regardless of input format
 */

class DataNormalizer {
  /**
   * Normalize any numeric value to 0-1 range
   */
  static normalizeValue(value, min, max) {
    if (value === null || value === undefined) return null;
    if (max === min) return 0.5;
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }

  /**
   * Normalize severity (1-5 scale)
   */
  static normalizeSeverity(severity) {
    return this.normalizeValue(severity, 1, 5);
  }

  /**
   * Normalize age in days to 0-1 scale
   * 0 days = 0, 30+ days = 1
   */
  static normalizeAge(reportedAt) {
    if (!reportedAt) return 0.5;
    const ageInDays = (Date.now() - new Date(reportedAt).getTime()) / (1000 * 60 * 60 * 24);
    return this.normalizeValue(ageInDays, 0, 30);
  }

  /**
   * Normalize number of reports (more reports = higher evidence)
   */
  static normalizeReports(count) {
    return this.normalizeValue(count, 1, 20);
  }

  /**
   * Normalize population exposure
   * low=0.25, medium=0.5, high=0.75, very_high=1.0
   */
  static normalizeExposure(exposure) {
    const mapping = {
      'very_low': 0.1,
      'low': 0.25,
      'medium': 0.5,
      'high': 0.75,
      'very_high': 1.0
    };
    return mapping[exposure?.toLowerCase()] ?? 0.5;
  }

  /**
   * Normalize traffic level
   * low=0.25, medium=0.5, high=0.75, very_high=1.0
   */
  static normalizeTraffic(traffic) {
    const mapping = {
      'low': 0.25,
      'medium': 0.5,
      'high': 0.75,
      'very_high': 1.0
    };
    return mapping[traffic?.toLowerCase()] ?? 0.5;
  }

  /**
   * Normalize weather condition
   * normal=0.2, cloudy=0.3, rainy=0.6, heavy_rain=0.9, storm=1.0
   */
  static normalizeWeather(weather) {
    const mapping = {
      'clear': 0.1,
      'normal': 0.2,
      'cloudy': 0.3,
      'light_rain': 0.4,
      'rainy': 0.6,
      'heavy_rain': 0.9,
      'storm': 1.0,
      'flood': 1.0
    };
    return mapping[weather?.toLowerCase()] ?? 0.2;
  }

  /**
   * Normalize distance to critical facility (in meters)
   * 0-50m = 1.0, 50-200m = 0.7, 200-500m = 0.4, 500m+ = 0.1
   */
  static normalizeFacilityDistance(distance) {
    if (!distance) return 0;
    if (distance <= 50) return 1.0;
    if (distance <= 200) return 0.7;
    if (distance <= 500) return 0.4;
    return 0.1;
  }

  /**
   * Normalize nearby complaints count
   */
  static normalizeNearbyComplaints(count) {
    return this.normalizeValue(count, 0, 50);
  }

  /**
   * Check if issue is near specific facility types
   */
  static normalizeFacilityType(facilities) {
    const criticalFacilities = ['hospital', 'school', 'fire_station', 'police', 'government_office'];
    if (!facilities || facilities.length === 0) return 0;
    
    const hasCritical = facilities.some(f => 
      criticalFacilities.some(cf => f.toLowerCase().includes(cf))
    );
    return hasCritical ? 1.0 : 0.3;
  }

  /**
   * Normalize GPS availability
   */
  static normalizeGPS(location) {
    return (location && location.lat && location.lon) ? 1.0 : 0.0;
  }

  /**
   * Main normalization function - processes entire issue object
   */
  static normalize(issue) {
    return {
      // Basic info
      issue_id: issue.issue_id,
      domain: issue.domain,
      type: issue.type,
      ward: issue.ward,
      
      // Normalized features
      features: {
        severity: this.normalizeSeverity(issue.severity),
        age: this.normalizeAge(issue.reported_at),
        reports: this.normalizeReports(issue.citizen_reports || 1),
        exposure: this.normalizeExposure(issue.population_exposed),
        traffic: this.normalizeTraffic(issue.traffic_level),
        weather: this.normalizeWeather(issue.weather_condition),
        facility_proximity: this.normalizeFacilityType(issue.near_facilities),
        nearby_complaints: this.normalizeNearbyComplaints(issue.nearby_complaints),
        has_gps: this.normalizeGPS(issue.location),
        has_photo: issue.photo_available ? 1.0 : 0.0,
        is_repeat: issue.is_repeat_location ? 1.0 : 0.0
      },
      
      // Raw values for reference
      raw: {
        severity: issue.severity,
        reported_at: issue.reported_at,
        citizen_reports: issue.citizen_reports,
        weather: issue.weather_condition,
        facilities: issue.near_facilities,
        nearby_complaints: issue.nearby_complaints
      }
    };
  }
}

module.exports = DataNormalizer;
