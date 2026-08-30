/**
 * Priority Engine API Routes
 * REST endpoints for priority evaluation
 * 
 * API Contract:
 * - /evaluate    → "How important is this issue?" (single issue)
 * - /optimize   → "Given all issues and resources, what should we do?" (batch optimization)
 * - /recalculate → "The situation changed; rebuild the decision"
 */

const express = require('express');
const router = express.Router();
const PriorityEngine = require('./PriorityEngine');
const BatchDecisionEngine = require('./services/batchDecisionEngine');

// Default available resources (can be overridden by request)
const DEFAULT_RESOURCES = {
  available_workers: 10,
  available_vehicles: 5,
  equipment_status: {
    'excavator': 'available',
    'suction_machine': 'available',
    'water_pump': 'available',
    'drain_equipment': 'available',
    'road_tools': 'available',
    'electrical_tools': 'available'
  },
  budget_available: 500000
};

/**
 * POST /api/priority/evaluate
 * Evaluate priority for a single issue
 */
router.post('/evaluate', (req, res) => {
  try {
    const { issue, resources } = req.body;
    
    if (!issue || !issue.issue_id || !issue.type) {
      return res.status(400).json({
        error: 'Missing required fields: issue_id, type'
      });
    }
    
    // Set default domain if not provided
    if (!issue.domain) {
      issue.domain = 'infrastructure';
    }
    
    // Use provided resources or defaults
    const availableResources = resources || DEFAULT_RESOURCES;
    
    // Evaluate priority
    const decision = PriorityEngine.evaluate(issue, availableResources);
    
    // Generate explanation
    const explanation = PriorityEngine.explain(decision, null, 1);
    
    res.json({
      success: true,
      decision,
      explanation
    });
    
  } catch (error) {
    console.error('Priority evaluation error:', error);
    res.status(500).json({
      error: true,
      message: 'Priority evaluation failed',
      details: error.message
    });
  }
});

/**
 * POST /api/priority/evaluate-batch
 * Evaluate and rank multiple issues (simple sorting)
 */
router.post('/evaluate-batch', (req, res) => {
  try {
    const { issues, resources } = req.body;
    
    if (!issues || !Array.isArray(issues) || issues.length === 0) {
      return res.status(400).json({
        error: 'Missing or invalid issues array'
      });
    }
    
    // Use provided resources or defaults
    const availableResources = resources || DEFAULT_RESOURCES;
    
    // Evaluate batch
    const result = PriorityEngine.evaluateBatch(issues, availableResources);
    
    // Generate explanations for top issues
    if (result.decisions && result.decisions.length > 0) {
      result.decisions = result.decisions.map((decision, index) => ({
        ...decision,
        explanation: PriorityEngine.explain(decision, index + 1, result.decisions.length)
      }));
    }
    
    res.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    console.error('Batch evaluation error:', error);
    res.status(500).json({
      error: true,
      message: 'Batch evaluation failed',
      details: error.message
    });
  }
});

/**
 * POST /api/priority/optimize
 * Optimize batch of issues with resource constraints
 * 
 * This endpoint:
 * - Evaluates all issues
 * - Generates all possible action combinations
 * - Calculates Expected Civic Value for each
 * - Returns optimal plan with alternatives
 * 
 * Request:
 * {
 *   "issues": [...],           // Array of issues to optimize
 *   "resources": {...},        // Available resources (optional)
 *   "options": {              // Optimization options (optional)
 *     "timeHorizon": 8,       // Hours to plan for
 *     "maxAlternatives": 3    // Number of alternatives to return
 *   }
 * }
 * 
 * Response:
 * {
 *   "planId": "PLAN-xxx",
 *   "selectedActions": [...],   // Actions to take now
 *   "scheduledActions": [...],  // Actions scheduled for later
 *   "deferredActions": [...],   // Actions deferred due to constraints
 *   "alternatives": [...],      // Alternative plans for officer review
 *   "resourceUtilization": {...},
 *   "tradeoffs": [...],         // Why certain actions were chosen
 *   "explanation": {...}        // Human-readable explanation
 * }
 */
router.post('/optimize', async (req, res) => {
  try {
    const { issues, resources, options } = req.body;
    
    if (!issues || !Array.isArray(issues) || issues.length === 0) {
      return res.status(400).json({
        error: 'Missing or invalid issues array'
      });
    }
    
    // Validate issues have required fields
    for (const issue of issues) {
      if (!issue.issue_id || !issue.type) {
        return res.status(400).json({
          error: `Each issue must have issue_id and type. Missing in: ${JSON.stringify(issue)}`
        });
      }
      // Set default domain if not provided
      if (!issue.domain) {
        issue.domain = 'infrastructure';
      }
    }
    
    // Use provided resources or defaults
    const availableResources = resources || DEFAULT_RESOURCES;
    
    // Optimize
    const result = await BatchDecisionEngine.optimize(issues, availableResources, options || {});
    
    if (result.error) {
      return res.status(500).json(result);
    }
    
    res.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    console.error('Optimization error:', error);
    res.status(500).json({
      error: true,
      message: 'Optimization failed',
      details: error.message
    });
  }
});

/**
 * POST /api/priority/recalculate
 * Recalculate priority when context changes
 */
router.post('/recalculate', (req, res) => {
  try {
    const { original_decision, context_changes, resources } = req.body;
    
    if (!original_decision) {
      return res.status(400).json({
        error: 'Missing original_decision'
      });
    }
    
    if (!context_changes) {
      return res.status(400).json({
        error: 'Missing context_changes'
      });
    }
    
    const availableResources = resources || DEFAULT_RESOURCES;
    
    const updatedDecision = PriorityEngine.recalculate(
      original_decision,
      context_changes,
      availableResources
    );
    
    const explanation = PriorityEngine.explain(updatedDecision, null, 1);
    
    res.json({
      success: true,
      decision: updatedDecision,
      explanation
    });
    
  } catch (error) {
    console.error('Recalculation error:', error);
    res.status(500).json({
      error: true,
      message: 'Priority recalculation failed',
      details: error.message
    });
  }
});

/**
 * GET /api/priority/factors
 * Get information about priority factors and weights
 */
router.get('/factors', (req, res) => {
  res.json({
    success: true,
    factors: {
      impact: {
        description: 'How much public impact does this cause?',
        weight: 0.30,
        components: ['population_exposure', 'traffic', 'facility_proximity', 'service_disruption']
      },
      urgency: {
        description: 'How quickly does this need action?',
        weight: 0.25,
        components: ['current_severity', 'deterioration', 'deadline', 'active_risk']
      },
      risk: {
        description: 'What happens if we do not act?',
        weight: 0.20,
        components: ['safety', 'health', 'cascade', 'future_damage']
      },
      time: {
        description: 'How long has it been unresolved?',
        weight: 0.10,
        components: ['issue_age', 'sla_breach']
      },
      context: {
        description: 'What is happening right now?',
        weight: 0.15,
        components: ['weather', 'events', 'spike', 'seasonal']
      }
    },
    bands: {
      CRITICAL: { min: 75, max: 100, action: 'ACT immediately' },
      HIGH: { min: 55, max: 74, action: 'ACT soon' },
      MEDIUM: { min: 35, max: 54, action: 'SCHEDULE' },
      LOW: { min: 15, max: 34, action: 'MONITOR' },
      MINIMAL: { min: 0, max: 14, action: 'DEFER' }
    }
  });
});

/**
 * GET /api/priority/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    engine: 'Infrastructure Priority Engine',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
