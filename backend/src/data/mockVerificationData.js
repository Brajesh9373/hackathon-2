/**
 * Mock External Data Sources for Fact-Checking
 * These simulate official government databases that we would cross-reference
 */

module.exports = {
  // Water Quality Data - Kopargaon Area
  waterQualityData: {
    lastUpdated: new Date().toISOString(),
    source: 'Kopargaon Municipal Water Supply Department',
    stations: {
      'ward_1': { 
        status: 'SAFE', 
        contaminationLevel: 'LOW',
        lastTest: '2026-08-28',
        ph: 7.2,
        bacteria: 'NEGATIVE',
        notes: 'Water meets BIS standards'
      },
      'ward_2': { 
        status: 'SAFE', 
        contaminationLevel: 'LOW',
        lastTest: '2026-08-28',
        ph: 7.0,
        bacteria: 'NEGATIVE',
        notes: 'Water meets BIS standards'
      },
      'ward_3': { 
        status: 'SAFE', 
        contaminationLevel: 'LOW',
        lastTest: '2026-08-27',
        ph: 7.1,
        bacteria: 'NEGATIVE',
        notes: 'Water meets BIS standards'
      },
      'ward_4': { 
        status: 'CAUTION', 
        contaminationLevel: 'MODERATE',
        lastTest: '2026-08-25',
        ph: 6.8,
        bacteria: 'TRACE',
        notes: 'Minor sediment, ongoing investigation'
      },
      'ward_5': { 
        status: 'SAFE', 
        contaminationLevel: 'LOW',
        lastTest: '2026-08-28',
        ph: 7.3,
        bacteria: 'NEGATIVE',
        notes: 'Water meets BIS standards'
      },
      'ward_6': { 
        status: 'SAFE', 
        contaminationLevel: 'LOW',
        lastTest: '2026-08-26',
        ph: 7.1,
        bacteria: 'NEGATIVE',
        notes: 'Water meets BIS standards'
      },
      'ward_7': { 
        status: 'SAFE', 
        contaminationLevel: 'LOW',
        lastTest: '2026-08-28',
        ph: 7.2,
        bacteria: 'NEGATIVE',
        notes: 'Water meets BIS standards'
      },
      'ward_8': { 
        status: 'CAUTION', 
        contaminationLevel: 'MODERATE',
        lastTest: '2026-08-24',
        ph: 6.9,
        bacteria: 'TRACE',
        notes: 'Industrial runoff monitoring'
      },
    }
  },

  // Transport Schedule Data
  transportData: {
    lastUpdated: new Date().toISOString(),
    source: 'MSRTC Kopargaon Depot',
    routes: {
      'KOP-NAS': { 
        status: 'ACTIVE', 
        frequency: 'Every 30 mins',
        lastCancelled: null,
        schedule: '06:00 - 22:00'
      },
      'KOP-SHN': { 
        status: 'ACTIVE', 
        frequency: 'Every 1 hour',
        lastCancelled: null,
        schedule: '07:00 - 19:00'
      },
      'KOP-MAN': { 
        status: 'ACTIVE', 
        frequency: 'Every 45 mins',
        lastCancelled: null,
        schedule: '06:30 - 21:30'
      },
      'KOP-KOP': { 
        status: 'ACTIVE', 
        frequency: 'Every 20 mins',
        lastCancelled: null,
        schedule: '07:00 - 21:00'
      },
    },
    alerts: [
      { type: 'DELAY', route: 'KOP-NAS', message: 'Minor delay due to road repair near Shirdi junction', until: '2026-08-30' },
    ]
  },

  // Food Safety Data
  foodSafetyData: {
    lastUpdated: new Date().toISOString(),
    source: 'Food & Drug Administration, Nashik',
    batches: {
      'BATCH-2026-001': { 
        status: 'SAFE', 
        product: 'Packaged Drinking Water - Kopargaon Pure',
        manufacturer: 'Kopargaon Water Works',
        testDate: '2026-08-20',
        result: 'PASSED',
        notes: 'All parameters within limits'
      },
      'BATCH-2026-002': { 
        status: 'UNDER_INVESTIGATION', 
        product: 'Local Bakery Products',
        manufacturer: 'Various small vendors',
        testDate: '2026-08-25',
        result: 'PENDING',
        notes: 'Routine sampling, results expected 2026-09-01'
      },
    },
    alerts: [
      { 
        id: 'ALERT-001',
        type: 'RECALL',
        product: 'Sweets - M/s Sweet Mart',
        reason: 'Preservative level slightly above permissible',
        issued: '2026-08-15',
        status: 'RESOLVED',
        notes: 'Vendor has corrected formulation'
      },
    ]
  },

  // Health Department Data
  healthData: {
    lastUpdated: new Date().toISOString(),
    source: 'District Health Office, Nashik',
    screenings: {
      'WARD-1-CAMP': { 
        status: 'COMPLETED',
        date: '2026-08-20',
        result: 'NORMAL',
        participants: 156,
        findings: 'No epidemic conditions detected'
      },
      'WARD-3-CAMP': { 
        status: 'COMPLETED',
        date: '2026-08-18',
        result: 'NORMAL',
        participants: 142,
        findings: 'Minor water-borne cases below threshold'
      },
    },
    alerts: [
      { 
        type: 'SEASONAL',
        message: 'Monsoon health advisory in effect',
        until: '2026-09-30',
        precautions: ['Drink boiled water', 'Use ORS packets', 'Report fever immediately']
      },
    ]
  },

  // Government Schemes Database
  schemesData: {
    lastUpdated: new Date().toISOString(),
    source: 'Digital India Portal',
    activeSchemes: [
      {
        id: 'SCHEME-001',
        name: 'Pradhan Mantri Gram Sadak Yojana',
        description: 'Rural road connectivity',
        status: 'ACTIVE',
        benefits: 'All-weather roads',
        eligible: 'Rural areas with population >500'
      },
      {
        id: 'SCHEME-002',
        name: 'Jal Jeevan Mission',
        description: 'Tap water to every household',
        status: 'ACTIVE',
        benefits: 'Piped water supply',
        eligible: 'All rural households'
      },
      {
        id: 'SCHEME-003',
        name: 'Swachh Bharat Mission',
        description: 'Clean India - sanitation',
        status: 'ACTIVE',
        benefits: 'Toilet construction, waste management',
        eligible: 'All households'
      },
      {
        id: 'SCHEME-004',
        name: 'Pradhan Mantri Awas Yojana',
        description: 'Affordable housing',
        status: 'ACTIVE',
        benefits: 'Subsidized home loans',
        eligible: 'Economically weaker sections'
      },
    ]
  },

  // Known False Claims Database (for pattern matching)
  falseClaimsDatabase: [
    {
      id: 'FC-001',
      claim: ' contaminated water in Kopargaon',
      truth: 'Water supply is regularly tested and meets BIS standards',
      factCheckDate: '2026-08-28',
      source: 'Municipal Water Department',
      spreadCount: 45,
      verifiedBy: 'Kopargaon Municipal Council'
    },
    {
      id: 'FC-002',
      claim: 'bus route KOP-NAS cancelled',
      truth: 'Route is active with regular service',
      factCheckDate: '2026-08-27',
      source: 'MSRTC Kopargaon Depot',
      spreadCount: 12,
      verifiedBy: 'MSRTC'
    },
    {
      id: 'FC-003',
      claim: 'food poisoning from local sweets',
      truth: 'No confirmed cases reported to health department',
      factCheckDate: '2026-08-26',
      source: 'FDA Nashik',
      spreadCount: 8,
      verifiedBy: 'FDA Nashik'
    },
  ]
};
