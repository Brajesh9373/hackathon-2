/**
 * Priority Engine Integration Service
 * 
 * Bridges the NagarSetu complaint model with the Kopargaon Priority Engine
 * 
 * Converts complaint data to priority engine format, calls the engine,
 * and stores results back into the complaint model.
 */

const PriorityEngine = require('../../priority_engine/PriorityEngine');
const BatchDecisionEngine = require('../../priority_engine/services/batchDecisionEngine');

// Default resources available in Kopargaon MC
const DEFAULT_RESOURCES = {
  available_workers: 10,
  available_vehicles: 5,
  equipment_status: {
    'excavator': 'available',
    'suction_machine': 'available',
    'drain_equipment': 'available',
    'road_tools': 'available',
    'garbage_vehicle': 'available',
    'water_pump': 'available'
  },
  budget_available: 100000
};

const EMERGENCY_PATTERNS = [
  { pattern: /\b(?:baby|infant|child|minor|person)\b[\s\S]{0,28}\b(?:missing|lost|abduct|kidnap(?:ped|ping)?)\b/i, reason: 'Missing-person report involving a child or vulnerable person' },
  { pattern: /\b(?:missing|lost|abduct|kidnap(?:ped|ping)?)\b[\s\S]{0,28}\b(?:baby|infant|child|minor|person)\b/i, reason: 'Missing-person report involving a child or vulnerable person' },
  { pattern: /\b(?:kidnap(?:ped|ping)?|abduction|hostage|child\s+trafficking)\b/i, reason: 'Possible abduction or immediate public-safety threat' },
  { pattern: /\b(?:fire|explosion|gas\s+leak|live\s+wire|electrocut(?:ed|ion)|building\s+collapse)\b/i, reason: 'Immediate life-safety hazard reported' },
  { pattern: /\b(?:not\s+breathing|unconscious|heart\s+attack|medical\s+emergency|critical\s+patient)\b/i, reason: 'Medical emergency reported' },
  { pattern: /\b(?:assault|violence|rape|robbery\s+in\s+progress|crime\s+in\s+progress)\b/i, reason: 'Immediate personal-safety threat reported' },
];

function detectEmergencySignal(text) {
  const value = String(text || '').trim();
  return EMERGENCY_PATTERNS.find(({ pattern }) => pattern.test(value)) || null;
}

// Complaint forms store severity on a 1–10 civic scale while the decision
// engine intentionally accepts a 1–5 normalized scale. Convert explicitly;
// silently clamping every value above 5 made ordinary and urgent complaints
// indistinguishable.
function mapSeverityToEngine(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 3;
  return Math.max(1, Math.min(5, 1 + ((numeric - 1) / 9) * 4));
}

/**
 * Convert NagarSetu complaints to priority-engine input
 */
function complaintToIssue(complaint) {
  const impact = complaint.impact_factors || {};
  const emergency = detectEmergencySignal(complaint.complaint_text);
  const weatherRisk = impact.weather_risk;
  const weatherCondition = typeof weatherRisk === 'string'
    ? weatherRisk
    : Number(weatherRisk) >= 9 ? 'storm'
      : Number(weatherRisk) >= 7 ? 'heavy_rain'
        : Number(weatherRisk) >= 5 ? 'rainy' : 'clear';
  const coords = complaint.location?.coords;
  
  return {
    issue_id: complaint.complaint_id,
    type: emergency ? 'public_safety_emergency' : mapCategoryToType(complaint.category),
    domain: complaint.module === 'WASTE' ? 'waste' : 'infrastructure',
    
    // Raw features
    reported_at: complaint.createdAt?.toISOString() || new Date().toISOString(),
    severity: emergency ? 5 : mapSeverityToEngine(impact.severity),
    weather_condition: weatherCondition,
    population_exposed: emergency ? 'very_high' : mapImpactToPopulation(impact.public_impact),
    near_facilities: [...extractFacilities(complaint), ...(emergency ? ['police'] : [])],
    ward: complaint.location?.ward,
    
    // Evidence
    citizen_reports: impact.repeat_count || 1,
    photo_available: (complaint.media_urls?.length || 0) > 0,
    location: coords ? { lat: coords.lat, lon: coords.lng ?? coords.lon } : undefined,
    
    // Special flags
    is_repeat_location: (impact.repeat_count || 0) > 0,
    emergency_signal: Boolean(emergency),
    emergency_reason: emergency?.reason || null
  };
}

/**
 * Map NagarSetu categories to priority-engine types
 */
function mapCategoryToType(category) {
  const mapping = {
    'BLOCKED_DRAIN': 'blocked_drain',
    'BLOCKED_SEWAGE': 'blocked_drain',
    'POTHOLE': 'pothole',
    'MANHOLE_ISSUE': 'open_manhole',
    'ROAD_DAMAGE': 'road_damage',
    'FLOODING': 'flooding',
    'WATER_LOGGING': 'water_logging',
    'STREETLIGHT': 'streetlight',
    'ELECTRICITY': 'electrical',
    'GARBAGE_NOT_COLLECTED': 'garbage_dumping',
    'BIN_OVERFLOW': 'garbage_dumping',
    'ILLEGAL_DUMPING': 'garbage_dumping',
    'WASTE_ACCUMULATION': 'garbage_dumping',
    'MISSED_COLLECTION': 'missed_collection'
  };
  
  return mapping[category] || 'general';
}

/**
 * Map impact score (1-10) to population_exposed string
 */
function mapImpactToPopulation(impactScore) {
  if (!impactScore) return 'medium';
  if (impactScore >= 8) return 'very_high';
  if (impactScore >= 6) return 'high';
  if (impactScore >= 4) return 'medium';
  return 'low';
}

/**
 * Extract facilities from location
 */
function extractFacilities(complaint) {
  const facilities = [];
  const address = (complaint.location?.address || '').toLowerCase();
  
  if (address.includes('hospital')) facilities.push('hospital');
  if (address.includes('school')) facilities.push('school');
  if (address.includes('market')) facilities.push('market');
  if (address.includes('temple') || address.includes('mosque') || address.includes('church')) {
    facilities.push('religious');
  }
  
  return facilities;
}

/**
 * Evaluate a single complaint
 */
async function evaluateComplaint(complaint, resources = DEFAULT_RESOURCES) {
  const issue = complaintToIssue(complaint);
  const result = PriorityEngine.evaluate(issue, resources);
  let explanation = result.error
    ? { summary: result.message || 'Priority evaluation failed.', factors: [] }
    : (result.explanation || PriorityEngine.generateExplanation(result, 1, 1));

  if (issue.emergency_signal && !result.error) {
    explanation = {
      ...explanation,
      summary: `Critical safety signal: ${issue.emergency_reason}. Treat this complaint as an immediate escalation.`,
      factors: [issue.emergency_reason, ...(explanation.factors || [])],
      recommendation: 'Escalate immediately and verify with the appropriate emergency authority.'
    };
  }
  
  return {
    complaint_id: complaint.complaint_id,
    
    // Priority (independent)
    priority: result.priority,
    
    // Confidence (separate from priority)
    confidence: result.confidence,
    
    // Resources needed
    resources_required: result.resources,
    
    // Feasibility (separate from priority)
    feasibility: result.feasibility,
    
    // Decision
    decision: result.decision,
    
    // Explanation
    explanation
  };
}

/**
 * Optimize batch of complaints
 */
async function optimizeComplaints(complaints, resources = DEFAULT_RESOURCES, options = {}) {
  const issues = complaints.map(complaintToIssue);
  
  const result = await BatchDecisionEngine.optimize(issues, resources, options);
  
  // Map results back to complaints
  const selectedComplaints = [];
  const scheduledComplaints = [];
  const deferredComplaints = [];
  
  // Map issue_id back to complaint
  const complaintMap = new Map();
  complaints.forEach(c => complaintMap.set(c.complaint_id, c));
  
  // Process selected actions
  (result.selectedActions || []).forEach(action => {
    const complaint = complaintMap.get(action.issueId);
    if (complaint) {
      selectedComplaints.push({
        complaint,
        action: action.action,
        priority: action.priority,
        reason: action.reason
      });
    }
  });
  
  // Process scheduled actions
  (result.scheduledActions || []).forEach(action => {
    const complaint = complaintMap.get(action.issueId);
    if (complaint) {
      scheduledComplaints.push({
        complaint,
        action: action.action,
        priority: action.priority,
        reason: action.reason
      });
    }
  });
  
  // Process deferred actions
  (result.deferredActions || []).forEach(action => {
    const complaint = complaintMap.get(action.issueId);
    if (complaint) {
      deferredComplaints.push({
        complaint,
        priority: action.priority,
        reason: action.reason
      });
    }
  });
  
  return {
    plan_id: result.planId,
    
    // Actions to take now
    selected: selectedComplaints,
    
    // Actions scheduled for later
    scheduled: scheduledComplaints,
    
    // Actions deferred due to constraints
    deferred: deferredComplaints,
    
    // Alternative plans
    alternatives: result.alternatives,
    
    // Resource utilization
    resource_utilization: result.resourceUtilization,
    
    // Tradeoffs explanation
    tradeoffs: result.tradeoffs,
    
    // Human-readable explanation
    explanation: result.explanation
  };
}

/**
 * Recalculate priority when context changes
 */
async function recalculateComplaint(complaint, contextChanges, resources = DEFAULT_RESOURCES) {
  const issue = complaintToIssue(complaint);
  
  // Apply context changes
  if (contextChanges.weather) {
    issue.weather_condition = contextChanges.weather;
  }
  if (contextChanges.severity) {
    issue.severity = contextChanges.severity;
  }
  if (contextChanges.new_reports) {
    issue.citizen_reports = (issue.citizen_reports || 1) + contextChanges.new_reports;
  }
  if (contextChanges.resolved_nearby) {
    issue.resolved_nearby = contextChanges.resolved_nearby;
  }
  
  const result = PriorityEngine.evaluate(issue, resources);
  
  return {
    complaint_id: complaint.complaint_id,
    previous_priority: complaint.priority_score,
    new_priority: result.priority,
    priority_change: (result.priority?.score || 0) - (complaint.priority_score || 0),
    decision: result.decision,
    explanation: result.explanation
  };
}

/**
 * Get priority factor information
 */
function getFactorInfo() {
  return {
    factors: {
      impact: { weight: 0.30, description: 'Public impact level' },
      urgency: { weight: 0.25, description: 'Time sensitivity' },
      risk: { weight: 0.20, description: 'Risk if not addressed' },
      time: { weight: 0.10, description: 'Issue age' },
      context: { weight: 0.15, description: 'Current circumstances' }
    },
    bands: {
      CRITICAL: { min: 75, max: 100, action: 'ACT immediately' },
      HIGH: { min: 55, max: 74, action: 'ACT soon' },
      MEDIUM: { min: 35, max: 54, action: 'SCHEDULE' },
      LOW: { min: 15, max: 34, action: 'MONITOR' },
      MINIMAL: { min: 0, max: 14, action: 'DEFER' }
    },
    confidence_levels: {
      HIGH: '≥70% evidence strength',
      MEDIUM: '40-70% evidence strength',
      LOW: '<40% evidence strength'
    }
  };
}

module.exports = {
  evaluateComplaint,
  optimizeComplaints,
  recalculateComplaint,
  complaintToIssue,
  getFactorInfo,
  DEFAULT_RESOURCES
};
