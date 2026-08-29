const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { 
  evaluateComplaint, 
  optimizeComplaints, 
  recalculateComplaint, 
  getFactorInfo 
} = require('../services/priorityIntegration');
const Complaint = require('../models/Complaint');
const User = require('../models/User');

/**
 * GET /api/priority/factors
 * Get information about priority factors and weights
 */
router.get('/factors', (req, res) => {
  res.json({
    success: true,
    ...getFactorInfo()
  });
});

/**
 * POST /api/priority/evaluate/:id
 * Evaluate priority for a single complaint
 */
router.post('/evaluate/:id', auth, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }
    
    // Get available resources
    const resources = await getAvailableResources();
    
    const result = await evaluateComplaint(complaint, resources);
    
    // Optionally update complaint with new priority
    if (req.body.update_complaint) {
      complaint.priority_score = result.priority?.score;
      complaint.priority_reason = result.explanation?.summary;
      await complaint.save();
    }
    
    res.json({
      success: true,
      complaint_id: complaint.complaint_id,
      ...result
    });
  } catch (err) {
    console.error('Evaluate error:', err);
    res.status(500).json({ error: 'Evaluation failed' });
  }
});

/**
 * POST /api/priority/optimize
 * Optimize batch of complaints for supervisor
 */
router.post('/optimize', auth, async (req, res) => {
  try {
    const { status, module } = req.body;
    
    // Get complaints to optimize
    const filter = {};
    if (status) filter.status = status;
    else filter.status = { $in: ['FILED', 'ASSIGNED', 'IN_PROGRESS'] };
    if (module) filter.module = module;
    
    // Supervisors only see their assigned complaints
    if (req.user.role === 'supervisor') {
      filter.assigned_supervisor_id = req.user._id;
    }
    
    const complaints = await Complaint.find(filter)
      .sort('-priority_score')
      .limit(50);
    
    if (complaints.length === 0) {
      return res.json({
        success: true,
        message: 'No complaints to optimize',
        plan_id: null,
        selected: [],
        scheduled: [],
        deferred: []
      });
    }
    
    // Get available resources
    const resources = await getAvailableResources();
    
    // Optimize
    const result = await optimizeComplaints(complaints, resources, {
      timeHorizon: 8,
      maxAlternatives: 3
    });
    
    res.json({
      success: true,
      complaint_count: complaints.length,
      ...result
    });
  } catch (err) {
    console.error('Optimize error:', err);
    res.status(500).json({ error: 'Optimization failed' });
  }
});

/**
 * POST /api/priority/recalculate/:id
 * Recalculate priority when context changes
 */
router.post('/recalculate/:id', auth, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }
    
    const { context_changes } = req.body;
    if (!context_changes) {
      return res.status(400).json({ error: 'context_changes required' });
    }
    
    // Get available resources
    const resources = await getAvailableResources();
    
    const result = await recalculateComplaint(complaint, context_changes, resources);
    
    // Optionally update complaint
    if (req.body.update_complaint && result.priority_change !== 0) {
      complaint.priority_score = result.new_priority?.score;
      complaint.priority_reason = result.explanation?.summary;
      complaint.timeline.push({
        event: 'Priority Recalculated',
        actor_id: req.user._id,
        actor_role: req.user.role,
        note: `Changed from ${result.previous_priority} to ${result.new_priority?.score}. Reason: ${JSON.stringify(context_changes)}`,
        timestamp: new Date()
      });
      await complaint.save();
    }
    
    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error('Recalculate error:', err);
    res.status(500).json({ error: 'Recalculation failed' });
  }
});

/**
 * GET /api/priority/batch
 * Get priority evaluation for multiple complaints
 */
router.get('/batch', auth, async (req, res) => {
  try {
    const { ids } = req.query;
    
    if (!ids) {
      return res.status(400).json({ error: 'ids required (comma-separated)' });
    }
    
    const idArray = ids.split(',').map(id => id.trim());
    const complaints = await Complaint.find({ _id: { $in: idArray } });
    
    const resources = await getAvailableResources();
    const results = await Promise.all(
      complaints.map(c => evaluateComplaint(c, resources))
    );
    
    res.json({
      success: true,
      results,
      total: complaints.length
    });
  } catch (err) {
    console.error('Batch evaluate error:', err);
    res.status(500).json({ error: 'Batch evaluation failed' });
  }
});

/**
 * Helper: Get available resources
 */
async function getAvailableResources() {
  // Count available workers
  const availableWorkers = await User.countDocuments({
    role: 'worker',
    'worker_profile.status': 'AVAILABLE'
  });
  
  return {
    available_workers: availableWorkers + 5, // Include supervisors
    available_vehicles: 3,
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
}

module.exports = router;
