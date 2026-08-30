/**
 * Kopargaon Civic Platform - Database Seed Script
 * Creates: admin, supervisors, workers, and citizens.
 * Sample complaints are opt-in with SEED_SAMPLE_DATA=true.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });
const mongoose = require('mongoose');
const User = require('../../models/User');
const Complaint = require('../../models/Complaint');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nagarsetu';

// Kopargaon-specific complaint data with Marathi/Hindi text
const complaintData = {
  DEVELOPMENT: [
    { category: 'BLOCKED_DRAIN', text: 'नाला पूर्णपणे ब्लॉक झाला आहे. पाणी वाहत नाही. वासाची समस्या जाणवते.' },
    { category: 'BLOCKED_DRAIN', text: 'मुख्य रस्त्यावर नाला ब्लॉक झाला आहे. पाणी रस्त्यावर साचले आहे.' },
    { category: 'BLOCKED_SEWAGE', text: 'सीवर ओवरफ्लो होत आहे. घरात घुसमट जाणवते. आरोग्यास धोका.' },
    { category: 'BLOCKED_SEWAGE', text: 'सीवर लाइन फुटली आहे. रस्त्यावर गटाराचे पाणी येत आहे.' },
    { category: 'POTHOLE', text: 'रस्त्यावर मोठे खड्डे पडले आहेत. वाहतूक धोकादायक आहे.' },
    { category: 'POTHOLE', text: 'कोपरगाव-शिर्डी रोडवर खड्डे आहेत. वाहनांचे नुकसान होत आहे.' },
    { category: 'MANHOLE_ISSUE', text: 'मॅनहोलचे झाकण नाही. अपघात होण्याचा धोका आहे.' },
    { category: 'MANHOLE_ISSUE', text: 'खुला मॅनहोल शाळेच्या वाटेवर आहे. मुलांसाठी धोकादायक.' },
    { category: 'ROAD_DAMAGE', text: 'रोडची पृष्ठभाग खराब झाली आहे. विशेष करून पावसाळ्यानंतर.' },
    { category: 'FLOODING', text: 'पावसाळ्यात पूर येतो. घरात पाणी शिरते. त्वरित मदत हवी.' },
    { category: 'FLOODING', text: 'नाला ब्लॉक झाल्याने पाणी साचते. वाहतूक ठप्प.' },
    { category: 'WATER_LOGGING', text: 'श्री साईबाबा मंदिर परिसरात पाणी साचते. भाविकांना अडचण.' },
    { category: 'STREETLIGHT', text: 'रस्त्याचे दिवे बंद आहेत. रात्री वाहतूक अंधारात होते.' },
    { category: 'STREETLIGHT', text: 'कॉलनीत रात्री अंधार असतो. चोरीच्या घटना घडत आहेत.' },
    { category: 'ELECTRICITY', text: 'औद्योगिक वसाहतीत वारंवार वीज तुटते. उत्पादनावर परिणाम.' },
  ],
  WASTE: [
    { category: 'GARBAGE_NOT_COLLECTED', text: 'कचरा 5 दिवस जमा झाला आहे. उन्हाळ्यात दुर्गंधी फोफावते.' },
    { category: 'GARBAGE_NOT_COLLECTED', text: 'कचरा पेटी ओव्हरफ्लो आहे. सफाई कर्मचारी येत नाहीत.' },
    { category: 'BIN_OVERFLOW', text: 'बस स्टँडजवळ कचरा पेटी भरलेली आहे. स्वच्छता नाही.' },
    { category: 'ILLEGAL_DUMPING', text: 'अवैध डंपिंग नालेजवळ होत आहे. पाणी प्रदूषित होत आहे.' },
    { category: 'ILLEGAL_DUMPING', text: 'शेतात कचरा टाकला जात आहे. श्वास घेणे कठीण.' },
    { category: 'WASTE_ACCUMULATION', text: 'सोडलेल्या जागेत कचरा जमा झाला आहे. डासांचा स्रोत.' },
    { category: 'MISSED_COLLECTION', text: 'निर्धारित कचरा संग्रह दोन वेळा रद्द झाला.' },
  ]
};

// Kopargaon-specific locations
const kopargaonLocations = [
  { ward: 'Ward 1', area: 'मुख्य बाजार', zone: 'Central Zone', address: 'मुख्य बाजार, कोपरगाव' },
  { ward: 'Ward 1', area: 'कॉटन मार्केट', zone: 'Central Zone', address: 'कॉटन मार्केट, कोपरगाव' },
  { ward: 'Ward 1', area: 'सोनवणे रोड', zone: 'North Zone', address: 'सोनवणे रोड, कोपरगाव' },
  { ward: 'Ward 2', area: 'स्टेशन रोड', zone: 'East Zone', address: 'स्टेशन रोड, कोपरगाव' },
  { ward: 'Ward 2', area: 'तळेकर रोड', zone: 'East Zone', address: 'तळेकर रोड, कोपरगाव' },
  { ward: 'Ward 3', area: 'श्री साईबाबा मंदिर परिसर', zone: 'Central Zone', address: 'श्री साईबाबा मंदिर, कोपरगाव' },
  { ward: 'Ward 3', area: 'श्रीराम चौक', zone: 'West Zone', address: 'श्रीराम चौक, कोपरगाव' },
  { ward: 'Ward 4', area: 'साईनगर', zone: 'South Zone', address: 'साईनगर, कोपरगाव' },
  { ward: 'Ward 4', area: 'नवीन लेआउट', zone: 'South Zone', address: 'नवीन लेआउट, कोपरगाव' },
  { ward: 'Ward 5', area: 'जुना शहर', zone: 'North Zone', address: 'जुना शहर, कोपरगाव' },
  { ward: 'Ward 5', area: 'गणेश कॉलनी', zone: 'North Zone', address: 'गणेश कॉलनी, कोपरगाव' },
  { ward: 'Ward 6', area: 'रुग्णालय रोड', zone: 'East Zone', address: 'सरकारी रुग्णालय रोड, कोपरगाव' },
  { ward: 'Ward 6', area: 'वर्धा रोड', zone: 'East Zone', address: 'वर्धा रोड, कोपरगाव' },
  { ward: 'Ward 7', area: 'आयटीआय परिसर', zone: 'West Zone', address: 'आयटीआय परिसर, कोपरगाव' },
  { ward: 'Ward 8', area: 'औद्योगिक वसाहत', zone: 'South Zone', address: 'औद्योगिक वसाहत, कोपरगाव' },
];

// Kopargaon citizen names (Marathi)
const citizenNames = [
  'गणेश मोरे', 'सविता थोमबेरे', 'महेश शिंदे', 'लक्ष्मी जगताप', 'संतोष भांड',
  'अंजली पवार', 'विजय कांबळे', 'सुजय ढेरे', 'प्रिया सुतार', 'राहुल शेख',
  'नम्रता पाटील', 'संजय गायकवाड', 'कविता भोसले', 'विकास महाजन', 'सुनील जाधव',
  'अर्चना पाटणकर', 'रवींद्र कोल्हे', 'सीमा वाघ', 'मिलिंद सोनावणे', 'पिंटू पवार',
  'विजयाताई शिंदे', 'रमेश तनवर', 'कमल काळे', 'दिपक पवार', 'मनिषा निकम',
];

function generateComplaintId() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `KCP-${dateStr}-${random}`;
}

async function seed() {
  console.log('कोपरगाव नागरी सेवा प्लॅटफॉर्म - Database Seeding...');
  await mongoose.connect(MONGODB_URI);
  console.log('MongoDB Connected');

  // Clear existing data
  await User.deleteMany({});
  await Complaint.deleteMany({});
  console.log('Cleared existing data');

  // 1. Create Admin
  const admin = await User.create({
    name: 'मुख्य आयुक्त - Chief Commissioner',
    mobile: '+919999000001',
    role: 'admin',
    ward: 'All Wards',
    zone: 'All Zones',
    module: 'BOTH'
  });
  console.log('Admin Created:', admin.name);

  // 2. Create Supervisors (all 8 wards covered)
  const supervisors = await User.insertMany([
    {
      name: 'रमेश पाटील - Ramesh Patil',
      mobile: '+919999000002',
      role: 'supervisor',
      module: 'DEVELOPMENT',
      ward: 'Ward 1-2',
      zone: 'Central & East Zone'
    },
    {
      name: 'सुनीता देसमुख - Sunita Deshmukh',
      mobile: '+919999000003',
      role: 'supervisor',
      module: 'DEVELOPMENT',
      ward: 'Ward 3-4',
      zone: 'West & South Zone'
    },
    {
      name: 'अजित जाधव - Ajit Jadhav',
      mobile: '+919999000004',
      role: 'supervisor',
      module: 'WASTE',
      ward: 'Ward 5-6',
      zone: 'North & East Zone'
    },
    {
      name: 'प्रिया काळे - Priya Kale',
      mobile: '+919999000005',
      role: 'supervisor',
      module: 'WASTE',
      ward: 'Ward 7-8',
      zone: 'West & South Zone'
    }
  ]);
  console.log('Supervisors Created:', supervisors.length);

  // 3. Create Workers for each supervisor
  const workers = [];
  const workerNames = [
    'भरत कुमार', 'दत्तात्रय पवार', 'मनोज शेख', 'संजय मोरे', 
    'गौरव जगताप', 'संतोष भोसले', 'विजय काळे', 'प्रकाश तनवर'
  ];
  
  for (let i = 0; i < supervisors.length; i++) {
    const sup = supervisors[i];
    const supWorkers = await User.insertMany([
      {
        name: `${workerNames[i * 2]} - Worker ${i * 2 + 1}`,
        mobile: `+9199990000${10 + i * 2}`,
        role: 'worker',
        supervisor_id: sup._id,
        worker_profile: {
          employee_id: `KCP-W${String(i * 2 + 1).padStart(3, '0')}`,
          designation: 'फील्ड वर्कर - Field Worker',
          active_tasks: 0,
          max_capacity: 8,
          is_available: true,
          status: 'AVAILABLE'
        }
      },
      {
        name: `${workerNames[i * 2 + 1]} - Worker ${i * 2 + 2}`,
        mobile: `+9199990000${11 + i * 2}`,
        role: 'worker',
        supervisor_id: sup._id,
        worker_profile: {
          employee_id: `KCP-W${String(i * 2 + 2).padStart(3, '0')}`,
          designation: 'फील्ड वर्कर - Field Worker',
          active_tasks: Math.floor(Math.random() * 5),
          max_capacity: 8,
          is_available: true,
          status: 'AVAILABLE'
        }
      }
    ]);
    workers.push(...supWorkers);
  }
  console.log('Workers Created:', workers.length);

  // 4. Create Citizens
  const citizens = [];
  for (let i = 0; i < citizenNames.length; i++) {
    const citizen = await User.create({
      name: citizenNames[i],
      mobile: `+919800000${String(i + 1).padStart(3, '0')}`,
      role: 'citizen'
    });
    citizens.push(citizen);
  }
  console.log('Citizens Created:', citizens.length);

  // 5. Create sample complaints only when explicitly requested. The default
  // seed leaves the register empty so demo KPIs start at zero and every
  // complaint shown in the product is real user input.
  if (process.env.SEED_SAMPLE_DATA === 'true') {
  const complaints = [];
  
  for (let i = 0; i < 40; i++) {
    const complaintModule = Math.random() > 0.5 ? 'DEVELOPMENT' : 'WASTE';
    const dataList = complaintData[complaintModule];
    const data = dataList[Math.floor(Math.random() * dataList.length)];
    const citizen = citizens[Math.floor(Math.random() * citizens.length)];
    const location = kopargaonLocations[Math.floor(Math.random() * kopargaonLocations.length)];
    
    // Random status - weighted toward FILED and ASSIGNED
    const statusOptions = ['FILED', 'FILED', 'ASSIGNED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'];
    const status = statusOptions[Math.floor(Math.random() * statusOptions.length)];
    
    // Random days ago for creation
    const daysAgo = Math.floor(Math.random() * 15);
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    
    // Create basic complaint
    const complaint = {
      complaint_id: generateComplaintId(),
      citizen_id: citizen._id,
      citizen_name: citizen.name,
      citizen_mobile: citizen.mobile,
      complaint_text: data.text,
      category: data.category,
      module: complaintModule,
      location: {
        address: location.address,
        ward: location.ward,
        wardName: location.ward,
        zone: location.zone,
        area: location.area,
        pincode: '423601'
      },
      status: status,
      source: ['web', 'mobile', 'whatsapp', 'call'][Math.floor(Math.random() * 4)],
      createdAt: createdAt,
      updatedAt: new Date(),
      timeline: [{
        event: 'शिकायत दाखल - Complaint Filed',
        actor_id: citizen._id,
        actor_name: citizen.name,
        actor_role: 'citizen',
        note: 'नागरिकाने ऑनलाइन दाखल केली - Filed via web portal',
        timestamp: createdAt
      }]
    };
    
    // Calculate priority score
    let priority_score = 50 + Math.floor(Math.random() * 30);
    if (['MANHOLE_ISSUE', 'FLOODING'].includes(data.category)) priority_score += 20;
    if (daysAgo > 5) priority_score += 10;
    priority_score = Math.min(100, priority_score);
    complaint.priority_score = priority_score;
    
    // Add supervisor assignment
    if (['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'].includes(status)) {
      const relevantSups = supervisors.filter(s => s.module === complaintModule);
      const sup = relevantSups[Math.floor(Math.random() * relevantSups.length)] || supervisors[0];
      complaint.assigned_supervisor_id = sup._id;
      complaint.assigned_supervisor_name = sup.name;
      complaint.assigned_at = new Date(createdAt.getTime() + 2 * 60 * 60 * 1000);
      complaint.timeline.push({
        event: 'सुपरवायझरला नेमले - Assigned to Supervisor',
        actor_id: admin._id,
        actor_name: admin.name,
        actor_role: 'admin',
        note: `${sup.name} ला नेमले`,
        timestamp: complaint.assigned_at
      });
    }
    
    // Add worker assignment
    if (['IN_PROGRESS', 'COMPLETED', 'CLOSED'].includes(status)) {
      const supWorkers = workers.filter(w => String(w.supervisor_id) === String(complaint.assigned_supervisor_id));
      if (supWorkers.length > 0) {
        const worker = supWorkers[Math.floor(Math.random() * supWorkers.length)];
        complaint.assigned_worker_id = worker._id;
        complaint.assigned_worker_name = worker.name;
        complaint.worker_assigned_at = new Date(complaint.assigned_at.getTime() + 4 * 60 * 60 * 1000);
        complaint.timeline.push({
          event: 'वर्करला नेमले - Worker Assigned',
          actor_id: complaint.assigned_supervisor_id,
          actor_name: complaint.assigned_supervisor_name,
          actor_role: 'supervisor',
          note: `${worker.name} ला काम दिले`,
          timestamp: complaint.worker_assigned_at
        });
      }
    }
    
    // Add completion if needed
    if (['COMPLETED', 'CLOSED'].includes(status)) {
      const completedAt = new Date(complaint.worker_assigned_at?.getTime() || Date.now() + 24 * 60 * 60 * 1000);
      complaint.resolution = {
        resolution_note: 'समस्या सुधारण्यात आली - Issue has been addressed.',
        completed_at: completedAt,
        completed_by: complaint.assigned_worker_id
      };
      complaint.timeline.push({
        event: 'काम पूर्ण - Work Completed',
        actor_id: complaint.assigned_worker_id,
        actor_name: complaint.assigned_worker_name,
        actor_role: 'worker',
        note: 'कार्यवाही यशस्वी - Task completed',
        timestamp: completedAt
      });
    }
    
    if (status === 'CLOSED') {
      complaint.citizen_confirmation = {
        response: 'CONFIRMED',
        responded_at: new Date(),
        confirmed_at: new Date()
      };
      complaint.timeline.push({
        event: 'नागरिकाने पुष्टी केली - Citizen Confirmed',
        actor_id: citizen._id,
        actor_name: citizen.name,
        actor_role: 'citizen',
        note: 'समस्या सुधारली - Issue resolved',
        timestamp: new Date()
      });
    }
    
    // Set SLA
    const slaHours = priority_score > 75 ? 24 : priority_score > 50 ? 48 : 72;
    complaint.sla_deadline = new Date(createdAt.getTime() + slaHours * 60 * 60 * 1000);
    
    complaints.push(complaint);
  }
  
  await Complaint.insertMany(complaints);
  console.log('Complaints Created:', complaints.length);
  } else {
    console.log('Complaints Created: 0 (set SEED_SAMPLE_DATA=true to load fixtures)');
  }

  console.log('\n===========================================');
  console.log('कोपरगाव नागरी सेवा प्लॅटफॉर्म - Database Seeded!');
  console.log('===========================================\n');
  console.log('Demo Credentials (OTP: 123456):');
  console.log('');
  console.log('ADMIN:');
  console.log('  Mobile: +919999000001');
  console.log('');
  console.log('SUPERVISORS:');
  supervisors.forEach((s, i) => {
    console.log(`  ${s.name.split(' - ')[0]}: ${s.mobile}`);
  });
  console.log('');
  console.log('CITIZENS (Sample):');
  console.log('  गणेश मोरे: +919800000001');
  console.log('  सविता थोमबेरे: +919800000002');
  console.log('  (and more...)');
  console.log('');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
