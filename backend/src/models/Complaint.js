const mongoose = require('mongoose');

// Timeline entry for audit trail
const timelineEntrySchema = new mongoose.Schema({
  event: { type: String, required: true },
  actor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  actor_name: String,
  actor_role: String,
  note: String,
  media_urls: [String],
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

// Resolution info
const resolutionSchema = new mongoose.Schema({
  resolution_photos: [{
    url: String,
    gps: { lat: Number, lng: Number },
    uploaded_at: Date
  }],
  resolution_note: String,
  completed_at: Date,
  completed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  supervisor_verified: { type: Boolean, default: false },
  supervisor_verified_at: Date,
  supervisor_verified_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { _id: false });

const complaintSchema = new mongoose.Schema({
  // Unique complaint ID
  complaint_id: { type: String, required: true, unique: true },
  
  // Who filed
  citizen_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  citizen_name: String,
  citizen_mobile: String,
  
  // Complaint details
  complaint_text: { type: String, required: true },
  media_urls: [{
    url: String,
    type: { type: String, enum: ['photo', 'video'] },
    uploaded_at: Date,
    gps: { lat: Number, lng: Number }
  }],
  
  // Location
  location: {
    coords: {
      lat: { type: Number },
      lng: { type: Number }
    },
    address: String,
    ward: String,
    zone: String,
    pincode: String
  },
  
  // Category - simplified for Kopargaon
  category: { 
    type: String, 
    required: true,
    enum: [
      // Development / Infrastructure
      'BLOCKED_DRAIN', 'BLOCKED_SEWAGE', 'POTHOLE', 'MANHOLE_ISSUE', 'ROAD_DAMAGE', 'FLOODING',
      'WATER_LOGGING', 'STREETLIGHT', 'ELECTRICITY',
      // Waste
      'GARBAGE_NOT_COLLECTED', 'BIN_OVERFLOW', 'ILLEGAL_DUMPING', 'WASTE_ACCUMULATION', 'MISSED_COLLECTION',
      // Other
      'OTHER'
    ]
  },
  
  // Module - Development or Waste
  module: {
    type: String,
    enum: ['DEVELOPMENT', 'WASTE'],
    required: true
  },
  
  // Impact factors for priority calculation
  impact_factors: {
    severity: { type: Number, min: 1, max: 10, default: 5 },
    safety_risk: { type: Number, min: 1, max: 10, default: 5 },
    public_impact: { type: Number, min: 1, max: 10, default: 5 },
    location_importance: { type: Number, min: 1, max: 10, default: 5 }, // school, hospital, main road
    days_old: { type: Number, default: 0 },
    repeat_count: { type: Number, default: 0 },
    weather_risk: { type: Number, min: 1, max: 10, default: 5 }
  },
  
  // Priority scoring
  priority_score: { type: Number, default: 0 },
  priority_breakdown: {
    severity_pct: Number,
    safety_pct: Number,
    impact_pct: Number,
    location_pct: Number,
    age_pct: Number,
    repeat_pct: Number,
    weather_pct: Number
  },
  priority_reason: String, // Why this priority?
  
  // Simple status flow
  status: {
    type: String,
    enum: [
      'FILED',               // Citizen submitted
      'ASSIGNED',            // Admin assigned to supervisor
      'IN_PROGRESS',         // Worker started working
      'AWAITING_VERIFICATION', // Worker marked done, AI calling citizen
      'COMPLETED',           // Citizen confirmed via AI
      'VERIFIED',            // Supervisor verified
      'CLOSED',             // Citizen confirmed
      'REOPENED'            // Citizen said not fixed
    ],
    default: 'FILED'
  },
  
  // Assigned to
  assigned_supervisor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assigned_supervisor_name: String,
  assigned_at: Date,
  
  assigned_worker_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assigned_worker_name: String,
  worker_assigned_at: Date,
  
  // Resources used
  assigned_equipment: [String],
  
  // Resolution
  resolution: resolutionSchema,
  
  // AI Verification (Vapi call)
  verification: {
    status: { type: String, enum: ['pending', 'calling', 'confirmed', 'unresolved', 'no_answer'], default: null },
    call_id: String,
    initiated_at: Date,
    completed_at: Date,
    transcript: String,
    completion_notes: String,
    evidence: String
  },
  
  // Citizen confirmation
  citizen_confirmation: {
    sent_at: Date,
    response: { type: String, enum: ['CONFIRMED', 'NOT_FIXED', 'NO_RESPONSE'] },
    responded_at: Date,
    confirmed_at: Date
  },
  
  // SLA
  sla_deadline: Date,
  sla_breached: { type: Boolean, default: false },
  
  // Follow-up requests from citizen
  follow_up_requests: [{
    reason: { type: String, enum: ['NOT_STARTED', 'INCOMPLETE', 'RETURNED', 'URGENT', 'OTHER'] },
    citizen_note: String,
    requested_at: Date,
    status: { type: String, enum: ['PENDING', 'ADDRESSED'], default: 'PENDING' }
  }],
  
  // Source
  source: {
    type: String,
    enum: ['web', 'mobile', 'whatsapp', 'call'],
    default: 'web'
  },
  
  // Timeline for audit
  timeline: [timelineEntrySchema],
  
  // Duplicate detection
  duplicate_of: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint' },
  linked_complaints: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Complaint' }],
  integrity_assessment: {
    status: { type: String, enum: ['SUPPORTED', 'UNVERIFIED', 'REVIEW_REQUIRED', 'CONTRADICTED'], default: 'UNVERIFIED' },
    confidence: Number,
    fingerprint: String,
    signals: [String],
    routing_allowed: { type: Boolean, default: true },
    amplification_allowed: { type: Boolean, default: true },
    assessed_at: Date,
  },
  
}, { timestamps: true });

// Indexes
complaintSchema.index({ module: 1, status: 1 });
complaintSchema.index({ assigned_supervisor_id: 1, status: 1 });
complaintSchema.index({ assigned_worker_id: 1, status: 1 });
complaintSchema.index({ citizen_id: 1 });
complaintSchema.index({ priority_score: -1 });
complaintSchema.index({ 'location.coords': '2dsphere' });

module.exports = mongoose.model('Complaint', complaintSchema);
