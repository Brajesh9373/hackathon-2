const mongoose = require('mongoose');

// Worker profile for supervisors and workers
const workerProfileSchema = new mongoose.Schema({
  employee_id: String,
  designation: String,
  active_tasks: { type: Number, default: 0 },
  max_capacity: { type: Number, default: 10 },
  is_available: { type: Boolean, default: true },
  status: {
    type: String,
    enum: ['AVAILABLE', 'ON_TASK', 'TRAVELLING', 'OFF_DUTY', 'UNAVAILABLE'],
    default: 'AVAILABLE'
  },
  current_location: {
    lat: Number,
    lng: Number,
    updated_at: Date
  },
  current_task_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint' },
  contact_phone: String,
  scorecard: {
    total_assigned: { type: Number, default: 0 },
    total_completed: { type: Number, default: 0 },
    avg_completion_time_hours: { type: Number, default: 0 },
    rating_avg: { type: Number, default: 0 },
  },
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobile: { type: String, required: true, unique: true },
  email: String,
  
  // Kopargaon roles - simplified from VAANI
  role: {
    type: String,
    required: true,
    enum: ['citizen', 'admin', 'supervisor', 'worker'],
    default: 'citizen',
  },
  
  // Location
  ward: String,
  zone: String,
  
  // For supervisor - their department
  module: {
    type: String,
    enum: ['DEVELOPMENT', 'WASTE', 'BOTH'],
    default: 'BOTH'
  },
  
  // Workers assigned to supervisor
  assigned_workers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  
  // For workers - which supervisor they report to
  supervisor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  language_preference: { type: String, enum: ['en', 'mr'], default: 'en' },
  
  worker_profile: workerProfileSchema,
  
  // Auth
  otp: String,
  otp_expires: Date,
  refresh_token: String,
  
  is_active: { type: Boolean, default: true },
  last_login: Date,
  
}, { timestamps: true });

// Indexes
userSchema.index({ mobile: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ supervisor_id: 1 });

module.exports = mongoose.model('User', userSchema);
