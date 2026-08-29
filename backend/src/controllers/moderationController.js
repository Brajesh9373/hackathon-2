/**
 * Moderation Controller
 * Handles fact-checking and moderation of complaints
 */

const verificationEngine = require('../services/verificationEngine');
const Claim = require('../models/Claim'); // We'll create this

// Get all claims pending moderation
exports.getPendingClaims = async (req, res) => {
  try {
    const { status = 'PENDING', page = 1, limit = 20 } = req.query;
    
    // Mock data for demo
    const pendingClaims = [
      {
        _id: '1',
        complaint_id: 'KCP-2026-0001',
        citizenName: 'राजेश कुमार',
        citizenPhone: '+91 9876543210',
        ward: 'ward_1',
        category: 'water',
        complaint_text: 'Water contamination reported in Ward 1 area. Please check immediately.',
        submittedAt: new Date(Date.now() - 3600000).toISOString(),
        verificationStatus: 'PENDING',
        trustScore: 75,
        flaggedReason: null
      },
      {
        _id: '2',
        complaint_id: 'KCP-2026-0002',
        citizenName: 'प्रिया शर्मा',
        citizenPhone: '+91 9876543211',
        ward: 'ward_2',
        category: 'transport',
        complaint_text: 'Bus route KOP-NAS cancelled without notice. Students stranded.',
        submittedAt: new Date(Date.now() - 7200000).toISOString(),
        verificationStatus: 'PENDING',
        trustScore: 60,
        flaggedReason: 'Transport-related claim needs verification'
      },
      {
        _id: '3',
        complaint_id: 'KCP-2026-0003',
        citizenName: 'सुनील पाटील',
        citizenPhone: '+91 9876543212',
        ward: 'ward_3',
        category: 'food',
        complaint_text: 'Food poisoning from local sweets. Multiple people affected.',
        submittedAt: new Date(Date.now() - 10800000).toISOString(),
        verificationStatus: 'FLAGGED',
        trustScore: 45,
        flaggedReason: 'Pattern detected: Similar complaints from multiple sources'
      }
    ];

    res.json({
      success: true,
      claims: pendingClaims,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: pendingClaims.length
      }
    });
  } catch (error) {
    console.error('Error fetching pending claims:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch claims' });
  }
};

// Verify a single claim
exports.verifyClaim = async (req, res) => {
  try {
    const { claimId } = req.params;
    
    // Mock claim data
    const claim = {
      _id: claimId,
      complaint_id: 'KCP-2026-0001',
      citizenName: 'राजेश कुमार',
      ward: 'ward_1',
      complaint_text: 'Water contamination reported in Ward 1 area.'
    };

    // Run verification
    const verification = await verificationEngine.verifyComplaint(claim);
    
    res.json({
      success: true,
      claimId,
      verification
    });
  } catch (error) {
    console.error('Error verifying claim:', error);
    res.status(500).json({ success: false, error: 'Failed to verify claim' });
  }
};

// Moderate a claim (approve, reject, or flag)
exports.moderateClaim = async (req, res) => {
  try {
    const { claimId } = req.params;
    const { action, reason, notes } = req.body; // action: APPROVED, REJECTED, FLAGGED
    
    if (!['APPROVED', 'REJECTED', 'FLAGGED'].includes(action)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid action. Must be APPROVED, REJECTED, or FLAGGED' 
      });
    }

    // Mock response
    res.json({
      success: true,
      claimId,
      action,
      reason: reason || 'No reason provided',
      notes,
      moderatedAt: new Date().toISOString(),
      moderatedBy: req.user?.name || 'Moderator'
    });
  } catch (error) {
    console.error('Error moderating claim:', error);
    res.status(500).json({ success: false, error: 'Failed to moderate claim' });
  }
};

// Check for coordinated fakes
exports.checkCoordinatedFakes = async (req, res) => {
  try {
    const { ward } = req.query;
    
    // Mock recent complaints
    const recentComplaints = [
      { complaint_id: 'KCP-2026-0001', ward: 'ward_1', complaint_text: 'Water issue', citizenPhone: '+91 1111111111', createdAt: new Date() },
      { complaint_id: 'KCP-2026-0002', ward: 'ward_1', complaint_text: 'Same water issue', citizenPhone: '+91 2222222222', createdAt: new Date(Date.now() - 300000) },
      { complaint_id: 'KCP-2026-0003', ward: 'ward_1', complaint_text: 'Water problem', citizenPhone: '+91 3333333333', createdAt: new Date(Date.now() - 600000) },
    ];

    const analysis = await verificationEngine.detectCoordinatedFakes(recentComplaints);
    
    res.json({
      success: true,
      analysis,
      recentComplaints: recentComplaints.length,
      analyzedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking coordinated fakes:', error);
    res.status(500).json({ success: false, error: 'Failed to analyze patterns' });
  }
};

// Get fact-check for a claim
exports.getFactCheck = async (req, res) => {
  try {
    const { claimId } = req.params;
    
    // Mock fact-check result
    const factCheck = {
      claimId,
      claim: 'Water contamination in Ward 1',
      verified: false,
      verdict: 'LIKELY_FALSE',
      truth: 'Water supply in Ward 1 is tested and meets BIS standards. Last test: 2026-08-28',
      sources: [
        { name: 'Kopargaon Municipal Water Dept', type: 'OFFICIAL', url: null },
        { name: 'Water Quality Testing Lab', type: 'OFFICIAL', url: null }
      ],
      factChecker: 'VAANI Verification Engine',
      checkedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      factCheck
    });
  } catch (error) {
    console.error('Error getting fact check:', error);
    res.status(500).json({ success: false, error: 'Failed to get fact check' });
  }
};

// Get verification stats
exports.getStats = async (req, res) => {
  try {
    const stats = {
      totalProcessed: 156,
      verified: 89,
      rejected: 23,
      pending: 44,
      falseClaimsDetected: 12,
      coordinatedFakesDetected: 5,
      avgTrustScore: 72,
      recentAlerts: [
        { type: 'FALSE_CLAIM', message: 'Water contamination rumor in Ward 1 debunked', time: '2 hours ago' },
        { type: 'COORDINATED_FAKE', message: '5 fake complaints from same IP blocked', time: '5 hours ago' }
      ]
    };

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
};

// Report false information spreading
exports.reportMisinformation = async (req, res) => {
  try {
    const { claimId, type, description, source } = req.body;
    
    res.json({
      success: true,
      reportId: `MIS-${Date.now()}`,
      status: 'INVESTIGATING',
      message: 'Your report has been submitted. Our team will investigate and take necessary action.',
      submittedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error reporting misinformation:', error);
    res.status(500).json({ success: false, error: 'Failed to submit report' });
  }
};
