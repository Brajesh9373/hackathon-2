/**
 * Priority Engine Data Schemas
 * Defines the input/output structures for the priority engine
 */

/**
 * Input schema for a civic issue
 */
const IssueInputSchema = {
  issue_id: { type: 'string', required: true },
  domain: { type: 'string', required: true, enum: ['infrastructure', 'waste', 'development'] },
  type: { type: 'string', required: true },
  ward: { type: 'string', required: false },
  location: {
    lat: { type: 'number', required: false },
    lon: { type: 'number', required: false }
  },
  reported_at: { type: 'string', required: true },
  severity: { type: 'number', min: 1, max: 5, required: false },
  description: { type: 'string', required: false },
  photo_available: { type: 'boolean', default: false },
  citizen_reports: { type: 'number', min: 1, default: 1 },
  near_facilities: { type: 'array', items: 'string', default: [] },
  nearby_complaints: { type: 'number', default: 0 },
  is_repeat_location: { type: 'boolean', default: false },
  weather_condition: { type: 'string', default: 'normal' },
  traffic_level: { type: 'string', default: 'medium' },
  population_exposed: { type: 'string', default: 'medium' }
};

/**
 * Output schema for priority decision
 */
const PriorityDecisionSchema = {
  issue_id: { type: 'string' },
  domain: { type: 'string' },
  priority_score: { type: 'number', min: 0, max: 100 },
  priority_band: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'MINIMAL'] },
  rank: { type: 'number' },
  confidence: { type: 'number', min: 0, max: 100 },
  
  score_breakdown: {
    impact: { type: 'number' },
    urgency: { type: 'number' },
    risk: { type: 'number' },
    time_factor: { type: 'number' },
    context: { type: 'number' }
  },
  
  risk_factors: {
    safety: { type: 'number' },
    health: { type: 'number' },
    cascade: { type: 'number' }
  },
  
  deterioration_rate: { type: 'number' },
  
  resource_requirements: {
    workers: { type: 'number' },
    vehicles: { type: 'number' },
    equipment: { type: 'array', items: 'string' },
    estimated_hours: { type: 'number' },
    estimated_cost: { type: 'number' }
  },
  
  feasibility: { type: 'string', enum: ['IMMEDIATE', 'PARTIAL', 'DEFERRED', 'BLOCKED'] },
  
  recommended_action: { type: 'string', enum: ['ACT', 'SCHEDULE', 'VERIFY', 'ESCALATE', 'MONITOR'] },
  
  assigned_resources: {
    workers: { type: 'array', items: 'string' },
    vehicles: { type: 'array', items: 'string' }
  },
  
  alternatives: { type: 'array' },
  
  explanation: {
    summary: { type: 'string' },
    factors: { type: 'array', items: 'string' },
    tradeoffs: { type: 'string' }
  },
  
  timestamp: { type: 'string' }
};

/**
 * Resource availability schema
 */
const ResourceAvailabilitySchema = {
  available_workers: { type: 'number' },
  available_vehicles: { type: 'number' },
  equipment_status: { type: 'object' },
  budget_available: { type: 'number' }
};

module.exports = {
  IssueInputSchema,
  PriorityDecisionSchema,
  ResourceAvailabilitySchema
};
