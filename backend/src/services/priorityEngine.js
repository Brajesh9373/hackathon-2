/**
 * Kopargaon Civic Platform - Priority Engine
 * Calculates priority scores for complaints based on multiple factors
 */

// Weight configuration for priority calculation
const WEIGHTS = {
  DEVELOPMENT: {
    severity: 0.25,
    safety_risk: 0.25,
    public_impact: 0.20,
    location_importance: 0.10,
    age: 0.10,
    repeat: 0.10
  },
  WASTE: {
    waste_level: 0.25,
    days_since_collection: 0.25,
    health_risk: 0.20,
    population_affected: 0.15,
    location: 0.10,
    repeat: 0.05
  }
};

// Critical locations that increase priority
const CRITICAL_LOCATIONS = [
  'hospital', 'school', 'market', 'main_road', 'junction'
];

// High-risk categories
const HIGH_SEVERITY_CATEGORIES = [
  'FLOODING', 'WATER_LOGGING', 'BLOCKED_SEWAGE', 'ELECTRICITY'
];

const HIGH_SAFETY_RISK = [
  'STREETLIGHT', 'ELECTRICITY', 'FLOODING', 'MANHOLE_ISSUE', 'ROAD_DAMAGE'
];

// Category-based base scores
const CATEGORY_BASE_SCORES = {
  // Development
  'FLOODING': { severity: 9, safety: 10 },
  'WATER_LOGGING': { severity: 7, safety: 8 },
  'BLOCKED_SEWAGE': { severity: 6, safety: 7 },
  'BLOCKED_DRAIN': { severity: 5, safety: 6 },
  'MANHOLE_ISSUE': { severity: 6, safety: 9 },
  'ROAD_DAMAGE': { severity: 5, safety: 7 },
  'POTHOLE': { severity: 4, safety: 5 },
  'STREETLIGHT': { severity: 4, safety: 8 },
  'ELECTRICITY': { severity: 7, safety: 9 },
  // Waste
  'GARBAGE_NOT_COLLECTED': { severity: 4, health: 6 },
  'BIN_OVERFLOW': { severity: 5, health: 7 },
  'ILLEGAL_DUMPING': { severity: 5, health: 6 },
  'WASTE_ACCUMULATION': { severity: 6, health: 8 },
  'MISSED_COLLECTION': { severity: 3, health: 5 }
};

/**
 * Calculate priority score for a Development complaint
 */
function calculateDevelopmentPriority(complaint) {
  const w = WEIGHTS.DEVELOPMENT;
  const factors = complaint.impact_factors || {};
  const category = complaint.category;
  const baseScores = CATEGORY_BASE_SCORES[category] || { severity: 5, safety: 5 };
  
  // Base severity from category
  let severity = factors.severity || baseScores.severity || 5;
  
  // Safety risk from category
  let safety = factors.safety_risk || baseScores.safety || 5;
  
  // Public impact
  let impact = factors.public_impact || 5;
  
  // Location importance (check address/location for critical places)
  let location = factors.location_importance || 5;
  const address = (complaint.location?.address || '').toLowerCase();
  for (const loc of CRITICAL_LOCATIONS) {
    if (address.includes(loc)) {
      location = Math.min(10, location + 3);
      if (loc === 'hospital' || loc === 'school') {
        safety = Math.min(10, safety + 2);
      }
    }
  }
  
    // Days old (escalates priority over time)
  const createdAt = complaint.createdAt ? new Date(complaint.createdAt) : new Date();
  const daysOld = factors.days_old || Math.max(0, Math.floor(
    (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
  ));
  const age = Math.min(10, 5 + (daysOld * 0.5)); // +0.5 per day, max 10
  
  // Repeat count (increases priority if same issue reported multiple times)
  const repeat = factors.repeat_count || 0;
  const repeatScore = Math.min(10, 5 + (repeat * 2));
  
  // Weather risk
  let weather = factors.weather_risk || 5;
  
  // Calculate weighted score
  const priority_score = Math.round(
    (severity * w.severity * 10) +
    (safety * w.safety_risk * 10) +
    (impact * w.public_impact * 10) +
    (location * w.location_importance * 10) +
    (age * w.age * 10) +
    (repeatScore * w.repeat * 10)
  );
  
  // Generate explanation
  const reasons = [];
  if (severity >= 7) reasons.push('High severity issue');
  if (safety >= 8) reasons.push('High safety risk');
  if (location >= 8) reasons.push('Critical location (school/hospital/market)');
  if (daysOld >= 3) reasons.push(`Reported ${daysOld} days ago`);
  if (repeat >= 2) reasons.push(`${repeat} previous reports of same issue`);
  if (weather >= 7) reasons.push('Weather may worsen the situation');
  
  const priority_reason = reasons.length > 0 
    ? reasons.join(' + ') 
    : 'Standard priority based on complaint type';
  
  return {
    priority_score: Math.min(100, priority_score),
    priority_breakdown: {
      severity_pct: Math.round(severity * w.severity * 10),
      safety_pct: Math.round(safety * w.safety_risk * 10),
      impact_pct: Math.round(impact * w.public_impact * 10),
      location_pct: Math.round(location * w.location_importance * 10),
      age_pct: Math.round(age * w.age * 10),
      repeat_pct: Math.round(repeatScore * w.repeat * 10),
      weather_pct: 0
    },
    priority_reason
  };
}

/**
 * Calculate priority score for a Waste complaint
 */
function calculateWastePriority(complaint) {
  const w = WEIGHTS.WASTE;
  const factors = complaint.impact_factors || {};
  
  // Base scores from category
  const category = complaint.category;
  const baseScores = CATEGORY_BASE_SCORES[category] || { severity: 5, health: 5 };
  
  // Waste level
  let wasteLevel = factors.severity || baseScores.severity || 5;
  
  // Days since last collection
  const daysOld = factors.days_since_collection || factors.days_old || 
    Math.floor((Date.now() - new Date(complaint.createdAt).getTime()) / (1000 * 60 * 60 * 24));
  const daysScore = Math.min(10, 3 + (daysOld * 1.5)); // +1.5 per day, starts at 3
  
  // Health risk
  let healthRisk = factors.safety_risk || baseScores.health || 5;
  
  // Population affected
  let population = factors.public_impact || 5;
  
  // Location (hospital/school markets get higher priority)
  let location = factors.location_importance || 5;
  const address = (complaint.location?.address || '').toLowerCase();
  if (address.includes('hospital')) location = Math.min(10, location + 4);
  if (address.includes('school')) location = Math.min(10, location + 3);
  if (address.includes('market')) location = Math.min(10, location + 2);
  
  // Repeat count
  const repeat = factors.repeat_count || 0;
  const repeatScore = Math.min(10, 5 + repeat);
  
  const priority_score = Math.round(
    (wasteLevel * w.severity * 10) +
    (daysScore * w.safety_risk * 10) +
    (healthRisk * w.public_impact * 10) +
    (population * w.location_importance * 10) +
    (location * w.age * 10) +
    (repeatScore * w.repeat * 10)
  );
  
  // Generate explanation
  const reasons = [];
  if (wasteLevel >= 7) reasons.push('High waste accumulation');
  if (daysOld >= 3) reasons.push(`Not collected for ${daysOld} days`);
  if (healthRisk >= 7) reasons.push('High health/hygiene risk');
  if (location >= 8) reasons.push('Near sensitive location');
  if (repeat >= 2) reasons.push(`${repeat} previous reports`);
  
  const priority_reason = reasons.length > 0
    ? reasons.join(' + ')
    : 'Standard priority based on waste type';
  
  return {
    priority_score: Math.min(100, priority_score),
    priority_breakdown: {
      severity_pct: Math.round(wasteLevel * w.severity * 10),
      safety_pct: Math.round(daysScore * w.safety_risk * 10),
      impact_pct: Math.round(healthRisk * w.public_impact * 10),
      location_pct: Math.round(population * w.location_importance * 10),
      age_pct: Math.round(location * w.age * 10),
      repeat_pct: Math.round(repeatScore * w.repeat * 10),
      weather_pct: 0
    },
    priority_reason
  };
}

/**
 * Main function to calculate priority for any complaint
 */
function calculatePriority(complaint) {
  if (!complaint) {
    return {
      priority_score: 50,
      priority_reason: 'Default priority - calculation unavailable'
    };
  }
  
  const complaintModule = complaint.module || 'DEVELOPMENT';
  
  if (complaintModule === 'WASTE') {
    return calculateWastePriority(complaint);
  }
  
  return calculateDevelopmentPriority(complaint);
}

/**
 * Get priority label from score
 */
function getPriorityLabel(score) {
  if (score >= 75) return { label: 'CRITICAL', color: '#D50000', icon: '🔴' };
  if (score >= 55) return { label: 'HIGH', color: '#E65100', icon: '🟠' };
  if (score >= 35) return { label: 'MEDIUM', color: '#F57F17', icon: '🟡' };
  if (score >= 15) return { label: 'LOW', color: '#2E7D32', icon: '🟢' };
  return { label: 'MINIMAL', color: '#607D8B', icon: '⚪' };
}

/**
 * Auto-assign category to module
 */
function getModuleFromCategory(category) {
  const WASTE_CATEGORIES = [
    'GARBAGE_NOT_COLLECTED', 'BIN_OVERFLOW', 'ILLEGAL_DUMPING', 
    'WASTE_ACCUMULATION', 'MISSED_COLLECTION'
  ];
  
  return WASTE_CATEGORIES.includes(category) ? 'WASTE' : 'DEVELOPMENT';
}

module.exports = {
  calculatePriority,
  calculateDevelopmentPriority,
  calculateWastePriority,
  getPriorityLabel,
  getModuleFromCategory,
  WEIGHTS,
  CATEGORY_BASE_SCORES
};
