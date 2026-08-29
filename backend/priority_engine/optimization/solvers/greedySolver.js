/**
 * Greedy Solver
 * 
 * Baseline solver for the batch optimization problem.
 * Uses a greedy approach with fallback exploration.
 * 
 * This is the JS implementation. Can be replaced with OR-Tools later.
 */

const { Constraints } = require('../constraints');
const { ObjectiveBuilder } = require('../objectiveBuilder');

class GreedySolver {
  /**
   * Constructor
   */
  constructor(problem) {
    this.problem = problem;
    this.constraints = new Constraints();
    
    // Build action candidates
    this.actionCandidates = this.buildActionCandidates();
  }

  /**
   * Build all possible action candidates
   */
  buildActionCandidates() {
    const candidates = [];
    
    this.problem.actionableIssues.forEach(issue => {
      issue.possibleActions.forEach(action => {
        // Get expected outcomes for this action
        const outcomes = issue.expectedOutcomes?.[action.type] || {
          impactReduction: 0.5,
          riskAvoidance: 0.5,
          urgencyMultiplier: 0.5
        };
        
        // Get resource requirements
        const resources = issue.resourceRequirements?.[action.type] || {
          workers: 2,
          vehicles: 0,
          equipment: [],
          hours: 2
        };
        
        // Get decision info
        const decision = {
          issueId: issue.issueId,
          issueType: issue.issueType,
          domain: issue.domain,
          priority: issue.priority,
          confidence: issue.confidence,
          decision: issue.decision,
          temporal: issue.temporal,
          
          // Action-specific
          actionType: action.type,
          isPrimary: action.isPrimary,
          isEmergency: action.isEmergency || false,
          
          // For optimization
          resources,
          expectedOutcomes: outcomes,
          deadline: issue.temporal?.deteriorationDeadline,
          deadlineHours: issue.temporal?.deteriorationDeadline
        };
        
        // Calculate ECV - pass the action-specific decision object which has expectedOutcomes
        const ecv = ObjectiveBuilder.calculateECV(
          decision,  // This has actionType, expectedOutcomes for this action
          { priority: issue.priority, confidence: issue.confidence },
          this.buildConstraintContext()
        );
        
        decision.ecv = ecv;
        decision.priorityScore = issue.priority?.score || 0;
        decision.priorityBand = issue.priority?.band || 'LOW';
        
        candidates.push(decision);
      });
    });
    
    return candidates;
  }

  /**
   * Build constraint context for ECV calculation
   */
  buildConstraintContext() {
    return {
      availableWorkers: this.problem.resources.workers,
      availableVehicles: this.problem.resources.vehicles,
      equipmentStatus: this.problem.resources.equipment,
      usedWorkers: 0,
      usedVehicles: 0
    };
  }

  /**
   * Main solve method
   */
  solve() {
    const selectedActions = [];
    const resourcePool = { ...this.problem.resources };
    let usedWorkers = 0;
    let usedVehicles = 0;
    
    // Sort candidates by ECV
    const sortedCandidates = [...this.actionCandidates]
      .filter(c => !['MONITOR', 'DEFER'].includes(c.actionType))
      .sort((a, b) => b.ecv.netECV - a.ecv.netECV);
    
    // Greedy selection
    for (const candidate of sortedCandidates) {
      // Check constraints
      const canAdd = this.canAddToPlan(candidate, selectedActions, {
        workers: resourcePool.workers - usedWorkers,
        vehicles: resourcePool.vehicles - usedVehicles,
        equipment: resourcePool.equipment
      });
      
      if (canAdd) {
        // Add to plan
        selectedActions.push(this.createSelectedAction(candidate));
        
        // Update used resources
        usedWorkers += candidate.resources.workers || 0;
        usedVehicles += candidate.resources.vehicles || 0;
      }
    }
    
    // Add SCHEDULE actions for unselected high-priority items
    this.addScheduledActions(sortedCandidates, selectedActions, usedWorkers);
    
    // Calculate total objective value
    const objectiveValue = selectedActions.reduce(
      (sum, a) => sum + (a.ecv?.netECV || 0), 0
    );
    
    return {
      planId: this.problem.id,
      selectedActions,
      objectiveValue: Math.round(objectiveValue * 100) / 100,
      resourceUsage: {
        workers: usedWorkers,
        vehicles: usedVehicles,
        availableWorkers: resourcePool.workers,
        availableVehicles: resourcePool.vehicles
      }
    };
  }

  /**
   * Solve with alternative objective (for comparison)
   */
  solveAlternative(alternativeIndex) {
    const selectedActions = [];
    const resourcePool = { ...this.problem.resources };
    let usedWorkers = 0;
    let usedVehicles = 0;
    
    let sortedCandidates;
    
    switch (alternativeIndex) {
      case 1:
        // Alternative 1: Prioritize by risk avoidance
        sortedCandidates = [...this.actionCandidates]
          .filter(c => !['MONITOR', 'DEFER'].includes(c.actionType))
          .sort((a, b) => 
            (b.ecv?.components?.risk || 0) - (a.ecv?.components?.risk || 0)
          );
        break;
        
      case 2:
        // Alternative 2: Prioritize by time sensitivity
        sortedCandidates = [...this.actionCandidates]
          .filter(c => !['MONITOR', 'DEFER'].includes(c.actionType))
          .sort((a, b) => 
            (b.priority?.breakdown?.time || 0) - (a.priority?.breakdown?.time || 0)
          );
        break;
        
      default:
        return null;
    }
    
    // Same greedy selection logic
    for (const candidate of sortedCandidates) {
      const canAdd = this.canAddToPlan(candidate, selectedActions, {
        workers: resourcePool.workers - usedWorkers,
        vehicles: resourcePool.vehicles - usedVehicles,
        equipment: resourcePool.equipment
      });
      
      if (canAdd) {
        selectedActions.push(this.createSelectedAction(candidate));
        usedWorkers += candidate.resources.workers || 0;
        usedVehicles += candidate.resources.vehicles || 0;
      }
    }
    
    this.addScheduledActions(sortedCandidates, selectedActions, usedWorkers);
    
    const objectiveValue = selectedActions.reduce(
      (sum, a) => sum + (a.ecv?.netECV || 0), 0
    );
    
    return {
      planId: `${this.problem.id}-ALT${alternativeIndex}`,
      selectedActions,
      objectiveValue: Math.round(objectiveValue * 100) / 100,
      resourceUsage: {
        workers: usedWorkers,
        vehicles: usedVehicles,
        availableWorkers: resourcePool.workers,
        availableVehicles: resourcePool.vehicles
      }
    };
  }

  /**
   * Check if action can be added to plan
   */
  canAddToPlan(candidate, currentPlan, availableResources) {
    // Skip if already have action for this issue
    if (currentPlan.find(a => a.issueId === candidate.issueId)) {
      return false;
    }
    
    // Check resources
    const needed = candidate.resources || {};
    
    if ((availableResources.workers || 0) < (needed.workers || 0)) {
      return false;
    }
    
    if ((availableResources.vehicles || 0) < (needed.vehicles || 0)) {
      return false;
    }
    
    // Check equipment
    if (needed.equipment && needed.equipment.length > 0) {
      const availableEquipment = availableResources.equipment || {};
      for (const eq of needed.equipment) {
        if (availableEquipment[eq] === 'unavailable' || availableEquipment[eq] === 'broken') {
          return false;
        }
      }
    }
    
    return true;
  }

  /**
   * Add SCHEDULE actions for unselected high-priority items
   */
  addScheduledActions(sortedCandidates, selectedActions, usedWorkers) {
    const selectedIds = new Set(selectedActions.map(a => a.issueId));
    
    // Find high-priority items not selected
    const unselected = sortedCandidates
      .filter(c => !selectedIds.has(c.issueId))
      .filter(c => c.priorityScore >= 50)
      .filter(c => c.isPrimary)
      .slice(0, 5); // Max 5 scheduled
    
    unselected.forEach(candidate => {
      selectedActions.push({
        issueId: candidate.issueId,
        issueType: candidate.issueType,
        actionType: 'SCHEDULE',
        priority: candidate.priority,
        resources: { workers: 0, vehicles: 0, equipment: [], hours: 0 },
        ecv: { netECV: candidate.ecv.netECV * 0.3 }, // Lower value for scheduled
        reason: 'Resource constraints - scheduled for later',
        expectedOutcome: {
          impactReduction: 0.3,
          riskAvoidance: 0.3,
          urgencyMultiplier: 0.3
        }
      });
    });
  }

  /**
   * Create selected action record
   */
  createSelectedAction(candidate) {
    return {
      issueId: candidate.issueId,
      issueType: candidate.issueType,
      domain: candidate.domain,
      actionType: candidate.actionType,
      priority: candidate.priority,
      confidence: candidate.confidence,
      priorityScore: candidate.priorityScore,
      priorityBand: candidate.priorityBand,
      
      resources: candidate.resources,
      ecv: candidate.ecv,
      expectedOutcome: candidate.expectedOutcomes,
      
      reason: this.generateReason(candidate),
      deadline: candidate.deadline
    };
  }

  /**
   * Generate reason for selection
   */
  generateReason(candidate) {
    const ecv = candidate.ecv;
    const parts = [];
    
    // ECV components
    if (ecv?.components?.impact > 70) {
      parts.push(`High impact (${Math.round(ecv.components.impact)})`);
    }
    if (ecv?.components?.risk > 70) {
      parts.push(`High risk (${Math.round(ecv.components.risk)})`);
    }
    if (ecv?.components?.urgency > 70) {
      parts.push(`Time-sensitive`);
    }
    
    // Priority
    parts.push(`Priority ${candidate.priorityScore} (${candidate.priorityBand})`);
    
    // Confidence
    if (candidate.confidence?.level === 'LOW') {
      parts.push('Low confidence - verification recommended');
    }
    
    // Resource efficiency
    const efficiency = candidate.ecv?.netECV / Math.max(1, candidate.ecv?.resourceCost || 1);
    if (efficiency > 2) {
      parts.push('Resource-efficient');
    }
    
    return parts.join('; ');
  }
}

module.exports = { GreedySolver };
