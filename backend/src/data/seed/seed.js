/**
 * Kopargaon Civic Platform - Database Seed Script
 * Creates: admin, supervisors, workers, citizens, and sample complaints
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });
const mongoose = require('mongoose');
const User = require('../../models/User');
const Complaint = require('../../models/Complaint');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vaani';

// Kopargaon-specific complaint data
const complaintData = {
  DEVELOPMENT: [
    { category: 'BLOCKED_DRAIN', text: 'Blocked drainage near main road. Water accumulating.' },
    { category: 'BLOCKED_DRAIN', text: 'Drainage blocked near market area. Bad smell.' },
    { category: 'BLOCKED_SEWAGE', text: 'Sewage overflow in residential area. Health hazard.' },
    { category: 'POTHOLE', text: 'Large pothole on Kopargaon-Shirdi road. Vehicles damaged.' },
    { category: 'MANHOLE_ISSUE', text: 'Open manhole near school. Safety concern.' },
    { category: 'ROAD_DAMAGE', text: 'Road surface damaged after rain.急需 repair.' },
    { category: 'FLOODING', text: 'Water logging near temple. Ripe for diseases.' },
    { category: 'WATER_LOGGING', text: 'Continuous water logging in Ward 3.' },
    { category: 'STREETLIGHT', text: 'Street lights not working for 10 days.' },
    { category: 'ELECTRICITY', text: 'Frequent power cuts in Industrial area.' },
  ],
  WASTE: [
    { category: 'GARBAGE_NOT_COLLECTED', text: 'Garbage not collected for 4 days. Residents suffering.' },
    { category: 'BIN_OVERFLOW', text: 'Dustbin near bus stand overflowing.' },
    { category: 'ILLEGAL_DUMPING', text: 'Illegal dumping of construction waste near nullah.' },
    { category: 'WASTE_ACCUMULATION', text: 'Waste accumulation near abandoned plot.' },
    { category: 'MISSED_COLLECTION', text: 'Scheduled waste collection missed twice.' },
  ]
};

const wards = ['Ward 1', 'Ward 2', 'Ward 3', 'Ward 4', 'Ward 5'];
const zones = ['North Zone', 'South Zone', 'East Zone', 'West Zone', 'Central Zone'];

function generateComplaintId() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `KCP-${dateStr}-${random}`;
}

async function seed() {
  console.log('Kopargaon Civic Platform - Seeding database...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  // Clear existing data
  await User.deleteMany({});
  await Complaint.deleteMany({});
  console.log('Cleared existing data');

  // 1. Create Admin
  const admin = await User.create({
    name: 'Municipal Commissioner',
    mobile: '+919999000001',
    role: 'admin',
    ward: 'All',
    zone: 'All',
    module: 'BOTH'
  });
  console.log('Created Admin:', admin.name);

  // 2. Create Supervisors
  const supervisors = await User.insertMany([
    {
      name: 'Ramesh Patil',
      mobile: '+919999000002',
      role: 'supervisor',
      module: 'DEVELOPMENT',
      ward: 'Ward 1',
      zone: 'North Zone'
    },
    {
      name: 'Sunita Deshmukh',
      mobile: '+919999000003',
      role: 'supervisor',
      module: 'DEVELOPMENT',
      ward: 'Ward 2',
      zone: 'South Zone'
    },
    {
      name: 'Ajit Jadhav',
      mobile: '+919999000004',
      role: 'supervisor',
      module: 'WASTE',
      ward: 'Ward 3',
      zone: 'East Zone'
    },
    {
      name: 'Priya Kale',
      mobile: '+919999000005',
      role: 'supervisor',
      module: 'WASTE',
      ward: 'Ward 4',
      zone: 'West Zone'
    }
  ]);
  console.log('Created', supervisors.length, 'Supervisors');

  // 3. Create Workers for each supervisor
  const workers = [];
  
  for (const sup of supervisors) {
    const supWorkers = await User.insertMany([
      {
        name: `Worker 1 (${sup.name.split(' ')[0]})`,
        mobile: `+9199990000${10 + workers.length}`,
        role: 'worker',
        supervisor_id: sup._id,
        worker_profile: {
          employee_id: `KCP-W${workers.length + 1}`,
          designation: 'Field Worker',
          active_tasks: 0,
          max_capacity: 8,
          is_available: true,
          status: 'AVAILABLE'
        }
      },
      {
        name: `Worker 2 (${sup.name.split(' ')[0]})`,
        mobile: `+9199990000${11 + workers.length}`,
        role: 'worker',
        supervisor_id: sup._id,
        worker_profile: {
          employee_id: `KCP-W${workers.length + 2}`,
          designation: 'Field Worker',
          active_tasks: 0,
          max_capacity: 8,
          is_available: true,
          status: 'AVAILABLE'
        }
      }
    ]);
    workers.push(...supWorkers);
  }
  console.log('Created', workers.length, 'Workers');

  // 4. Create Citizens
  const citizens = await User.insertMany([
    { name: 'Ganesh More', mobile: '+919800000001', role: 'citizen' },
    { name: 'Savita Thombare', mobile: '+919800000002', role: 'citizen' },
    { name: 'Mahesh Shinde', mobile: '+919800000003', role: 'citizen' },
    { name: 'Lakshmi Jagtap', mobile: '+919800000004', role: 'citizen' },
    { name: 'Santosh Bhand', mobile: '+919800000005', role: 'citizen' },
    { name: 'Anjali Pawar', mobile: '+919800000006', role: 'citizen' },
    { name: 'Vijay Kamble', mobile: '+919800000007', role: 'citizen' },
    { name: 'Sunanda Shelar', mobile: '+919800000008', role: 'citizen' },
  ]);
  console.log('Created', citizens.length, 'Citizens');

  // 5. Create Sample Complaints
  const complaints = [];
  
  for (let i = 0; i < 25; i++) {
    const module = Math.random() > 0.5 ? 'DEVELOPMENT' : 'WASTE';
    const dataList = complaintData[module];
    const data = dataList[Math.floor(Math.random() * dataList.length)];
    const citizen = citizens[Math.floor(Math.random() * citizens.length)];
    const ward = wards[Math.floor(Math.random() * wards.length)];
    const zone = zones[Math.floor(Math.random() * zones.length)];
    
    // Random status - weighted toward FILED and ASSIGNED
    const statusOptions = ['FILED', 'FILED', 'FILED', 'ASSIGNED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'];
    const status = statusOptions[Math.floor(Math.random() * statusOptions.length)];
    
    // Create basic complaint
    const complaint = {
      complaint_id: generateComplaintId(),
      citizen_id: citizen._id,
      citizen_name: citizen.name,
      citizen_mobile: citizen.mobile,
      complaint_text: data.text,
      category: data.category,
      module: module,
      location: {
        address: `${zone}, ${ward}, Kopargaon`,
        ward: ward,
        zone: zone
      },
      status: status,
      source: 'web',
      timeline: [{
        event: 'Complaint filed',
        actor_id: citizen._id,
        actor_name: citizen.name,
        actor_role: 'citizen',
        note: 'Filed via web portal',
        timestamp: new Date()
      }]
    };
    
    // Add supervisor assignment
    if (['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'CLOSED'].includes(status)) {
      const relevantSups = supervisors.filter(s => s.module === module || s.module === 'BOTH');
      const sup = relevantSups[Math.floor(Math.random() * relevantSups.length)] || supervisors[0];
      complaint.assigned_supervisor_id = sup._id;
      complaint.assigned_supervisor_name = sup.name;
      complaint.assigned_at = new Date();
      complaint.timeline.push({
        event: 'Assigned to Supervisor',
        actor_id: admin._id,
        actor_name: admin.name,
        actor_role: 'admin',
        note: `Assigned to ${sup.name}`,
        timestamp: new Date()
      });
    }
    
    // Add worker assignment
    if (['IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'CLOSED'].includes(status)) {
      const supWorkers = workers.filter(w => String(w.supervisor_id) === String(complaint.assigned_supervisor_id));
      if (supWorkers.length > 0) {
        const worker = supWorkers[Math.floor(Math.random() * supWorkers.length)];
        complaint.assigned_worker_id = worker._id;
        complaint.assigned_worker_name = worker.name;
        complaint.worker_assigned_at = new Date();
        complaint.timeline.push({
          event: 'Worker Assigned',
          actor_id: complaint.assigned_supervisor_id,
          actor_name: complaint.assigned_supervisor_name,
          actor_role: 'supervisor',
          note: `Assigned to ${worker.name}`,
          timestamp: new Date()
        });
      }
    }
    
    // Add completion if needed
    if (['COMPLETED', 'VERIFIED', 'CLOSED'].includes(status)) {
      complaint.resolution = {
        resolution_note: 'Issue has been addressed and resolved.',
        completed_at: new Date(),
        completed_by: complaint.assigned_worker_id
      };
      complaint.timeline.push({
        event: 'Work Completed',
        actor_id: complaint.assigned_worker_id,
        actor_name: complaint.assigned_worker_name,
        actor_role: 'worker',
        note: 'Task completed successfully',
        timestamp: new Date()
      });
    }
    
    if (['VERIFIED', 'CLOSED'].includes(status)) {
      complaint.resolution.supervisor_verified = true;
      complaint.resolution.supervisor_verified_at = new Date();
      complaint.timeline.push({
        event: 'Supervisor Verified',
        actor_id: complaint.assigned_supervisor_id,
        actor_name: complaint.assigned_supervisor_name,
        actor_role: 'supervisor',
        note: 'Verified completion',
        timestamp: new Date()
      });
    }
    
    if (status === 'CLOSED') {
      complaint.status = 'CLOSED';
      complaint.citizen_confirmation = {
        response: 'CONFIRMED',
        responded_at: new Date(),
        confirmed_at: new Date()
      };
      complaint.timeline.push({
        event: 'Citizen Confirmed',
        actor_id: citizen._id,
        actor_name: citizen.name,
        actor_role: 'citizen',
        note: 'Issue resolved',
        timestamp: new Date()
      });
    }
    
    // Calculate priority with defaults
    const createdAt = complaint.timeline[0].timestamp;
    const daysOld = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const baseScore = module === 'WASTE' ? 45 : 50;
    const priority_score = Math.min(100, baseScore + Math.min(daysOld * 2, 20) + Math.floor(Math.random() * 20));
    complaint.priority_score = priority_score;
    complaint.priority_breakdown = {
      severity_pct: Math.floor(priority_score * 0.25),
      safety_pct: Math.floor(priority_score * 0.25),
      impact_pct: Math.floor(priority_score * 0.20),
      location_pct: Math.floor(priority_score * 0.10),
      age_pct: Math.floor(priority_score * 0.10),
      repeat_pct: Math.floor(priority_score * 0.10),
      weather_pct: 0
    };
    complaint.priority_reason = 'Standard priority based on complaint type';
    
    // Set SLA
    complaint.sla_deadline = new Date(Date.now() + 48 * 60 * 60 * 1000);
    
    complaints.push(complaint);
  }
  
  await Complaint.insertMany(complaints);
  console.log('Created', complaints.length, 'Complaints');

  console.log('\n===========================================');
  console.log('Kopargaon Civic Platform - Database Seeded!');
  console.log('===========================================\n');
  console.log('Demo Credentials (OTP: 123456):');
  console.log('');
  console.log('ADMIN:');
  console.log('  Mobile: +919999000001');
  console.log('');
  console.log('SUPERVISORS (Development):');
  console.log('  Ramesh Patil: +919999000002');
  console.log('  Sunita Deshmukh: +919999000003');
  console.log('');
  console.log('SUPERVISORS (Waste):');
  console.log('  Ajit Jadhav: +919999000004');
  console.log('  Priya Kale: +919999000005');
  console.log('');
  console.log('CITIZENS:');
  console.log('  Ganesh More: +919800000001');
  console.log('  Savita Thombare: +919800000002');
  console.log('  (and more...)');
  console.log('');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
