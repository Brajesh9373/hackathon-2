// Kopargaon Civic Platform - Complaints Data
// Kopargaon Municipal Council, Nashik, Maharashtra

export const COMPLAINT_STATUS = {
  FILED: 'filed',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  VERIFIED: 'verified',
  CLOSED: 'closed',
  REOPENED: 'reopened',
};

export const PRIORITY_LEVELS = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

export const COMPLAINT_CATEGORIES = [
  { id: 'blocked_drain', label: 'Blocked Drain / ब्लॉक नाला', icon: '💧', department: 'Drainage' },
  { id: 'sewage_overflow', label: 'Sewage Overflow / सीवर ओवरफ्लो', icon: '🚰', department: 'Drainage' },
  { id: 'garbage', label: 'Garbage Collection / कचरा संग्रह', icon: '🗑️', department: 'Sanitation' },
  { id: 'pothole', label: 'Pothole / खड्डा', icon: '🛣️', department: 'Roads' },
  { id: 'road_damage', label: 'Road Damage / रोड नुकसान', icon: '🛣️', department: 'Roads' },
  { id: 'streetlight', label: 'Street Light / रस्त्याचा दिवा', icon: '💡', department: 'Electrical' },
  { id: 'water_supply', label: 'Water Supply / पाणी पुरवठा', icon: '🚰', department: 'Water Supply' },
  { id: 'flooding', label: 'Flooding / पूर', icon: '🌊', department: 'Drainage' },
  { id: 'manhole', label: 'Open Manhole / मॅनहोल', icon: '🕳️', department: 'Drainage' },
  { id: 'illegal_dumping', label: 'Illegal Dumping / अवैध डंपिंग', icon: '🏭', department: 'Sanitation' },
  { id: 'drainage', label: 'Drainage Issue / जलनिकास', icon: '🌊', department: 'Drainage' },
  { id: 'other', label: 'Other / इतर', icon: '📋', department: 'General' },
];

export const KOPARGAON_WARDS = [
  { id: 'ward_1', name: 'Ward 1 - Main Market', nameHi: 'वार्ड 1 - मुख्य बाजार', lat: 19.8844, lng: 74.4772 },
  { id: 'ward_2', name: 'Ward 2 - Station Road', nameHi: 'वार्ड 2 - स्टेशन रोड', lat: 19.8862, lng: 74.4798 },
  { id: 'ward_3', name: 'Ward 3 - Temple Area', nameHi: 'वार्ड 3 - मंदिर परिसर', lat: 19.8831, lng: 74.4756 },
  { id: 'ward_4', name: 'Ward 4 - New Layout', nameHi: 'वार्ड 4 - नवीन लेआउट', lat: 19.8880, lng: 74.4810 },
  { id: 'ward_5', name: 'Ward 5 - Old Town', nameHi: 'वार्ड 5 - जुना शहर', lat: 19.8820, lng: 74.4740 },
  { id: 'ward_6', name: 'Ward 6 - Hospital Area', nameHi: 'वार्ड 6 - रुग्णालय परिसर', lat: 19.8870, lng: 74.4780 },
  { id: 'ward_7', name: 'Ward 7 - School Zone', nameHi: 'वार्ड 7 - शाळा क्षेत्र', lat: 19.8810, lng: 74.4765 },
  { id: 'ward_8', name: 'Ward 8 - Industrial', nameHi: 'वार्ड 8 - औद्योगिक', lat: 19.8900, lng: 74.4830 },
];

export const DEPARTMENTS = [
  { id: 'drainage', name: 'Drainage Department', nameHi: 'जलनिकास विभाग', shortName: 'DRG', color: '#3498db', complaints: 450, resolved: 380 },
  { id: 'sanitation', name: 'Sanitation & Cleaning', nameHi: 'स्वच्छता व सफाई', shortName: 'SAN', color: '#27ae60', complaints: 620, resolved: 550 },
  { id: 'roads', name: 'Roads & Infrastructure', nameHi: 'रोड व पायाभूत सुविधा', shortName: 'ROD', color: '#e67e22', complaints: 380, resolved: 290 },
  { id: 'electrical', name: 'Electrical Department', nameHi: 'विद्युत विभाग', shortName: 'ELC', color: '#f1c40f', complaints: 210, resolved: 180 },
  { id: 'water', name: 'Water Supply', nameHi: 'पाणी पुरवठा', shortName: 'WTR', color: '#2980b9', complaints: 180, resolved: 150 },
  { id: 'admin', name: 'Municipal Administration', nameHi: 'नगरपरिषद प्रशासन', shortName: 'ADM', color: '#8e44ad', complaints: 120, resolved: 100 },
];

// Backwards compatibility
export const DELHI_DISTRICTS = KOPARGAON_WARDS;

// Generate complaint ID
function generateComplaintId(index) {
  const year = '2026';
  const prefix = 'KCP';
  return `${prefix}-${year}-${String(index).padStart(6, '0')}`;
}

const citizenNames = [
  'राजेश कुमार', 'प्रिया शर्मा', 'अमित वर्मा', 'सुनिता देवी', 'मोहम्मद असलम',
  'रेखा यादव', 'विक्रम सिंग', 'अनिता गुप्ता', 'सुरेश चंद', 'कविता जैन',
  'रमेश पांडे', 'निशा मलिक', 'दीपक चौहान', 'पूजा रानी', 'हरिश कुमार',
  'सुमन लता', 'अब्दुल रहमान', 'गीता देवी', 'मनोज तिवारी', 'रेनू बाला',
  'सतीश कुमार', 'मीरा चोप्रा', 'योगेश सैनी', 'किरण बेडी', 'अशोक तनवर',
  'बाबिता शर्मा', 'गौरव मिश्रा', 'सरिता जोशी', 'पवन कुमार', 'आशा रानी',
];

const locations = [
  { area: 'मुख्य बाजार', ward: 'ward_1', pin: '423601' },
  { area: 'स्टेशन रोड', ward: 'ward_2', pin: '423601' },
  { area: 'मंदिर परिसर', ward: 'ward_3', pin: '423602' },
  { area: 'नवीन लेआउट', ward: 'ward_4', pin: '423603' },
  { area: 'जुना शहर', ward: 'ward_5', pin: '423601' },
  { area: 'रुग्णालय परिसर', ward: 'ward_6', pin: '423602' },
  { area: 'शाळा क्षेत्र', ward: 'ward_7', pin: '423601' },
  { area: 'औद्योगिक वसाहत', ward: 'ward_8', pin: '423603' },
  { area: 'सोनवणे रोड', ward: 'ward_1', pin: '423601' },
  { area: 'तळेकर रोड', ward: 'ward_2', pin: '423601' },
  { area: 'श्रीराम चौक', ward: 'ward_3', pin: '423602' },
  { area: 'साईनगर', ward: 'ward_4', pin: '423603' },
  { area: 'गणेश कॉलनी', ward: 'ward_5', pin: '423601' },
  { area: 'वर्धा रोड', ward: 'ward_6', pin: '423602' },
  { area: 'सरकारी आयुर्वेदिक रुग्णालय परिसर', ward: 'ward_6', pin: '423602' },
  { area: 'श्री साईबाबा मंदिर परिसर', ward: 'ward_3', pin: '423602' },
  { area: 'कॉटन मार्केट', ward: 'ward_1', pin: '423601' },
  { area: 'आयटीआय परिसर', ward: 'ward_7', pin: '423601' },
];

const complaintDescriptions = {
  blocked_drain: [
    'नाला पूर्णपणे ब्लॉक झाला आहे. पाणी वाहत नाही. वासाची समस्या.',
    'मुख्य रस्त्यावर नाला ब्लॉक झाला आहे. पाणी रस्त्यावर साचले आहे.',
    'कॉलनीत नाला ब्लॉक झाल्याने दुर्गंधी पसरत आहे.',
    'पावसाळ्यात नाला ब्लॉक होऊन पूर परिस्थिती निर्माण होते.',
  ],
  sewage_overflow: [
    'सीवर ओवरफ्लो होत आहे. घरात घुसमट जाणवते.',
    'सीवर लाइन फुटली आहे. रस्त्यावर गटाराचे पाणी.',
    'सीवर मॅनहोलमधून पाणी बाहेर येत आहे.',
    'शेजारील शेतात सीवर पाणी जात आहे. स्वच्छतेची समस्या.',
  ],
  garbage: [
    'कचरा 5 दिवस जमा झाला आहे. विशेष करून उन्हाळ्यात दुर्गंधी.',
    'कचरा पेटी ओव्हरफ्लो आहे. सफाई कर्मचारी येत नाहीत.',
    'रस्त्यावर कचरा पडला आहे. स्वच्छता विभागाचे कर्मचारी हवे.',
    'कॉलनीत कचरा उचलण्यात आला नाही. डासांचा त्रास.',
  ],
  pothole: [
    'रस्त्यावर मोठे खड्डे पडले आहेत. वाहतूक धोकादायक आहे.',
    'दुचाकी वाहनधारकांना खड्ड्यांमुळे अपघात होत आहेत.',
    'पावसाळ्यात खड्ड्यांमध्ये पाणी साचल्याने खड्डे दिसत नाहीत.',
    'मुख्य रस्त्यावर अनेक खड्डे आहेत. त्वरित दुरुस्ती हवी.',
  ],
  road_damage: [
    'रोडची पृष्ठभाग खराब झाली आहे. विशेष करून पावसाळ्यानंतर.',
    'रस्त्यावर खड्डे पडले आहेत. वाहनांचे नुकसान होत आहे.',
    'बांधकामामुळे रस्ता खराब झाला आहे.',
    'पाणीपुरवठा विभागाने रस्ता खोदला आणि व्यवस्थित बंद केला नाही.',
  ],
  streetlight: [
    'रस्त्याचे दिवे बंद आहेत. रात्री वाहतूक अंधारात होते.',
    'स्ट्रीट लाइट खराब झाल्या आहेत. सुरक्षिततेचा प्रश्न.',
    'कॉलनीत रात्री अंधार असतो. चोरीच्या घटना घडत आहेत.',
    'दिवे लागलेले नाहीत. विद्युत विभागाचे कर्मचारी पाहिजेत.',
  ],
  water_supply: [
    'पाणी पुरवठा बंद आहे. 3 दिवस झाले.',
    'पाण्याचा दाब कमी आहे. वरच्या मजल्यावर पाणी येत नाही.',
    'पाणी गटारात जात आहे. पाइप फुटला असावा.',
    'टँकरने पाणी द्यावे अशी विनंती.',
  ],
  flooding: [
    'पावसाळ्यात पूर येतो. घरात पाणी शिरते.',
    'नाला ब्लॉक झाल्याने पाणी साचते.',
    'रस्त्यावर पाणी साचले आहे. वाहतूक ठप्प.',
    'शेजारील नदीला पूर आला आहे. धोका आहे.',
  ],
  manhole: [
    'मॅनहोलचे झाकण नाही. अपघात होण्याचा धोका.',
    'खुला मॅनहोल शाळेच्या वाटेवर आहे. मुलांसाठी धोकादायक.',
    'मॅनहोलचे झाकण तुटले आहे. त्वरित दुरुस्ती हवी.',
  ],
  illegal_dumping: [
    'अवैध डंपिंग साइट वाढत आहे. रोगराई होण्याचा धोका.',
    'शेतात कचरा टाकला जात आहे. श्वास घेणे कठीण.',
    'जंगलात कचरा टाकला जात आहे. पर्यावरणाचा प्रश्न.',
  ],
  drainage: [
    'जलनिकास व्यवस्थित होत नाही. पाणी साचते.',
    'नाले स्वच्छ केले जात नाहीत. डासांचा स्रोत.',
    'पावसाळ्यात पूर येतो. नाली साफ कराव्यात.',
  ],
  other: [
    'सामान्य तक्रार. त्वरित कारवाई हवी.',
    'नगरपरिषद विभागाच्या मदतीची गरज.',
  ],
};

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomDate(daysBack) {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysBack));
  date.setHours(Math.floor(Math.random() * 24));
  date.setMinutes(Math.floor(Math.random() * 60));
  return date.toISOString();
}

function generateComplaints() {
  const complaints = [];
  const statuses = Object.values(COMPLAINT_STATUS);
  const priorities = Object.values(PRIORITY_LEVELS);

  for (let i = 1; i <= 50; i++) {
    const category = getRandomItem(COMPLAINT_CATEGORIES);
    const location = getRandomItem(locations);
    const status = getRandomItem(statuses);
    const priority = getRandomItem(priorities);
    const citizen = getRandomItem(citizenNames);
    const descriptions = complaintDescriptions[category.id] || ['सामान्य तक्रार. नगरपरिषदच्या मदतीची गरज.'];
    const description = getRandomItem(descriptions);
    const createdAt = getRandomDate(30);
    const isCritical = ['flooding', 'manhole'].includes(category.id) || priority === PRIORITY_LEVELS.CRITICAL;

    complaints.push({
      id: generateComplaintId(i),
      citizenName: citizen,
      citizenPhone: `+91 ${Math.floor(7000000000 + Math.random() * 2999999999)}`,
      category: category.id,
      categoryLabel: category.label,
      categoryIcon: category.icon,
      department: category.department,
      priority,
      status,
      isCritical,
      description,
      location: {
        area: location.area,
        ward: location.ward,
        wardName: KOPARGAON_WARDS.find(w => w.id === location.ward)?.name || location.ward,
        pincode: location.pin,
        lat: KOPARGAON_WARDS.find(w => w.id === location.ward)?.lat + (Math.random() - 0.5) * 0.01,
        lng: KOPARGAON_WARDS.find(w => w.id === location.ward)?.lng + (Math.random() - 0.5) * 0.01,
      },
      source: getRandomItem(['KCP App', 'Phone Call', 'WhatsApp', 'Walk-in', 'Gram Panchayat']),
      createdAt,
      updatedAt: new Date(new Date(createdAt).getTime() + Math.random() * 86400000 * 5).toISOString(),
      assignedTo: status !== COMPLAINT_STATUS.FILED ? getRandomItem(['सुपरवायझर पाटील', 'सुपरवायझर शर्मा', 'सफाई कर्मचारी कुमार', 'विद्युत तांत्रिक पवार']) : null,
      slaDeadline: new Date(new Date(createdAt).getTime() + (priority === 'critical' ? 86400000 : priority === 'high' ? 86400000 * 2 : 86400000 * 5)).toISOString(),
      slaBreached: Math.random() > 0.7,
      citizenVerified: status === COMPLAINT_STATUS.CLOSED,
      hasEvidence: Math.random() > 0.4,
      evidenceCount: Math.floor(Math.random() * 3),
      notes: Math.random() > 0.5 ? `कार्यवाही सुरू आहे. ${getRandomItem(['साहित्य आवश्यक आहे.', 'कर्मचारी नेमले आहेत.', 'आराखडा तयार आहे.'])}` : '',
    });
  }

  return complaints.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export const complaints = generateComplaints();

// Dashboard statistics for Kopargaon
export const dashboardStats = {
  totalComplaints: 2450,
  todayComplaints: 45,
  pendingComplaints: 620,
  resolvedToday: 32,
  criticalAlerts: 8,
  avgResolutionDays: 2.5,
  citizenSatisfaction: 78,
  slaCompliance: 85,
  escalated: 45,
  reopened: 23,
  wardWise: KOPARGAON_WARDS.map(w => ({
    ...w,
    totalComplaints: Math.floor(200 + Math.random() * 400),
    pending: Math.floor(50 + Math.random() * 100),
    resolved: Math.floor(100 + Math.random() * 250),
    critical: Math.floor(Math.random() * 5),
  })),
  departmentWise: DEPARTMENTS.map(d => ({
    ...d,
    avgResolutionDays: (1 + Math.random() * 5).toFixed(1),
    slaCompliance: Math.floor(70 + Math.random() * 28),
    satisfaction: Math.floor(65 + Math.random() * 30),
  })),
  weeklyTrend: [
    { day: 'सोम', complaints: 42, resolved: 38 },
    { day: 'मंगळ', complaints: 55, resolved: 48 },
    { day: 'बुध', complaints: 38, resolved: 35 },
    { day: 'गुरू', complaints: 48, resolved: 42 },
    { day: 'शुक्र', complaints: 62, resolved: 45 },
    { day: 'शनि', complaints: 35, resolved: 28 },
    { day: 'रवि', complaints: 25, resolved: 22 },
  ],
  monthlyTrend: [
    { month: 'जाने', complaints: 450, resolved: 380 },
    { month: 'फेब्रु', complaints: 520, resolved: 420 },
    { month: 'मार्च', complaints: 480, resolved: 410 },
    { month: 'एप्रिल', complaints: 380, resolved: 320 },
    { month: 'मे', complaints: 320, resolved: 280 },
    { month: 'जून', complaints: 300, resolved: 260 },
  ],
  topCategories: [
    { category: 'नाला ब्लॉक', count: 420, icon: '💧' },
    { category: 'कचरा संग्रह', count: 380, icon: '🗑️' },
    { category: 'खड्डे', count: 290, icon: '🛣️' },
    { category: 'सीवर', count: 250, icon: '🚰' },
    { category: 'रस्त्याचे दिवे', count: 180, icon: '💡' },
    { category: 'पाणी पुरवठा', count: 150, icon: '🚰' },
  ],
};

// Supervisors
export const officers = [
  { id: 1, name: 'सुनील पाटील', nameHi: 'सुनील पाटील', designation: 'सुपरवायझर', department: 'Drainage', ward: 'Ward 1-4', phone: '+91 9876543210', email: 'sunil@kcp.gov.in', activeComplaints: 23, resolvedThisMonth: 45, avgResolutionDays: 2.1, performance: 92, status: 'active', bandwidth: 'moderate' },
  { id: 2, name: 'राजेश शर्मा', nameHi: 'राजेश शर्मा', designation: 'सुपरवायझर', department: 'Sanitation', ward: 'Ward 1-4', phone: '+91 9876543211', email: 'rajesh@kcp.gov.in', activeComplaints: 34, resolvedThisMonth: 38, avgResolutionDays: 1.8, performance: 88, status: 'active', bandwidth: 'high' },
  { id: 3, name: 'अनिता पवार', nameHi: 'अनिता पवार', designation: 'सुपरवायझर', department: 'Roads', ward: 'Ward 5-8', phone: '+91 9876543212', email: 'anita@kcp.gov.in', activeComplaints: 18, resolvedThisMonth: 52, avgResolutionDays: 2.5, performance: 95, status: 'active', bandwidth: 'moderate' },
  { id: 4, name: 'दीपक कुमार', nameHi: 'दीपक कुमार', designation: 'सुपरवायझर', department: 'Electrical', ward: 'Ward 5-8', phone: '+91 9876543213', email: 'deepak@kcp.gov.in', activeComplaints: 15, resolvedThisMonth: 30, avgResolutionDays: 3.2, performance: 78, status: 'active', bandwidth: 'low' },
  { id: 5, name: 'कविता जोशी', nameHi: 'कविता जोशी', designation: 'सुपरवायझर', department: 'Water Supply', ward: 'All Wards', phone: '+91 9876543214', email: 'kavita@kcp.gov.in', activeComplaints: 12, resolvedThisMonth: 28, avgResolutionDays: 1.5, performance: 90, status: 'active', bandwidth: 'low' },
];

// Visit logs
export const visitLogs = [
  { id: 1, date: '2026-08-25', location: 'मुख्य बाजार, Ward 1', purpose: 'नाला सफाई तपासणी', complaintsNearby: 8, resolved: 5, notes: 'नाला साफ करण्यात आला. पुढील कारवाई सुरू.' },
  { id: 2, date: '2026-08-20', location: 'श्री साईबाबा मंदिर परिसर, Ward 3', purpose: 'सीवर समस्या पाहणी', complaintsNearby: 12, resolved: 8, notes: 'सीवर लाइन दुरुस्त करण्याचे आदेश दिले.' },
  { id: 3, date: '2026-08-15', location: 'सोनवणे रोड, Ward 1', purpose: 'खड्डे दुरुस्ती पाहणी', complaintsNearby: 15, resolved: 10, notes: 'खड्डे बुजण्याचे कंत्राट दिले.' },
  { id: 4, date: '2026-08-10', location: 'साईनगर, Ward 4', purpose: 'कचरा संग्रह तपासणी', complaintsNearby: 6, resolved: 6, notes: 'कचरा उचलण्यात आला. वेळापत्रक सुधारण्यात आले.' },
  { id: 5, date: '2026-08-05', location: 'रुग्णालय रोड, Ward 6', purpose: 'रस्त्याचे दिवे दुरुस्ती', complaintsNearby: 4, resolved: 4, notes: 'दिवे बदलण्यात आले. विद्युत विभागाला पुढील कारवाई करण्यास सांगितले.' },
];
