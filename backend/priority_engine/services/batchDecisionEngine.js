/**
 * Batch Decision Engine
 * 
 * Orchestrates evaluation + optimization for multiple issues
 * 
 * Key responsibilities:
 * 1. Evaluate all issues using the single-issue engine
 * 2. Collect available resources
 * 3. Generate all possible action combinations
 * 4. Evaluate each combination's Expected Civic Value
 * 5. Select the optimal plan
 * 6. Generate explanations for the selection
 */

const PriorityEngine = require('../PriorityEngine');
const { Constraints } = require('../optimization/constraints');
const { ObjectiveBuilder } = require('../optimization/objectiveBuilder');
const { GreedySolver } = require('../optimization/solvers/greedySolver');
const OrToolsSolver = require('../optimization/solvers/orToolsWrapper');

class BatchDecisionEngine {
  /**
   * Main entry point: optimize a batch of issues
   */
  static async optimize(issues, availableResources, options = {}) {
    const {
      timeHorizon = 8,           // hours to plan for
      maxAlternatives = 3,       // top alternatives to return
      includeDetails = true       // include full issue details
    } = options;

    try {
      // Step 1: Evaluate each issue independently
      const evaluations = await this.evaluateAll(issues, availableResources);
      
      // Step 2: Build the optimization problem
      const problem = this.buildProblem(evaluations, availableResources, timeHorizon);
      
      // Step 3: Solve the optimization problem
      const { plan, alternatives, objectiveValue } = await this.solve(problem, maxAlternatives);
      
      // Step 4: Build the response
      const result = this.buildResult(plan, evaluations, alternatives, problem, objectiveValue);
      
      return result;
      
    } catch (error) {
      console.error('Batch optimization error:', error);
      return { error: true, message: `Optimization failed: ${error.message}` };
    }
  }

  /**
   * Evaluate all issues using the single-issue engine
   */
  static async evaluateAll(issues, availableResources) {
    return issues.map(issue => ({
      issue,
      evaluation: PriorityEngine.evaluate(issue, availableResources)
    }));
  }

  /**
   * Build the optimization problem structure
   */
  static buildProblem(evaluations, availableResources, timeHorizon) {
    // Extract decisions from evaluations
    const decisions = evaluations.map(e => e.evaluation);
    
    // Build problem structure
    const problem = {
      id: this.generatePlanId(),
      timeHorizon,
      availableResources: { ...availableResources },
      
      // Issues with their possible actions
      actionableIssues: decisions
        .filter(d => !d.error)
        .map((d, idx) => {
          const issue = evaluations[idx].issue;
          return {
            issueId: d.issue_id,
            issueType: d.type,
            domain: d.domain,
            priority: d.priority,
            confidence: d.confidence,
            decision: d.decision,
            
            // All possible actions for this issue
            possibleActions: this.getPossibleActions(d),
            
            // Resource requirements per action
            resourceRequirements: this.getActionResources(d),
            
            // Expected outcomes per action
            expectedOutcomes: this.getActionOutcomes(d),
            
            // Temporal constraints
            temporal: {
              deteriorationDeadline: this.estimateDeadline(d, timeHorizon),
              urgency: d.priority.breakdown.urgency,
              timeScore: d.priority.breakdown.time
            }
          };
        })
        .filter(i => i.possibleActions.length > 0),
      
      // Resource pool
      resources: this.buildResourcePool(availableResources)
    };
    
    return problem;
  }

  /**
   * Get all possible actions for a decision
   */
  static getPossibleActions(decision) {
    const actions = [];
    const { action, reason_codes } = decision.decision;
    
    // Primary action is always possible
    actions.push({
      type: action,
      isPrimary: true,
      confidence: decision.confidence.score,
      priority: decision.priority.score,
      priorityBand: decision.priority.band
    });
    
    // Add alternatives if available
    if (decision.alternatives) {
      decision.alternatives.forEach(alt => {
        if (alt.type !== action) { // Don't duplicate primary
          actions.push({
            type: alt.type,
            isPrimary: false,
            confidence: decision.confidence.score,
            priority: decision.priority.score,
            priorityBand: decision.priority.band
          });
        }
      });
    }
    
    // If HIGH/CRITICAL priority, ACT is always an option (even if primary is VERIFY)
    if (decision.priority.band === 'HIGH' || decision.priority.band === 'CRITICAL') {
      if (!actions.find(a => a.type === 'ACT')) {
        actions.push({
          type: 'ACT',
          isPrimary: false,
          isEmergency: true,
          confidence: decision.confidence.score,
          priority: decision.priority.score,
          priorityBand: decision.priority.band
        });
      }
    }
    
    return actions;
  }

  /**
   * Get resource requirements per action type
   */
  static getActionResources(decision) {
    // decision here is the full evaluation object from PriorityEngine
    const base = decision.resources?.required || {
      workers_min: 2,
      workers_preferred: 3,
      vehicles: 0,
      hours: 2,
      equipment: []
    };
    
    return {
      // Full action requires full resources (map ACT to FULL_DEPLOY)
      FULL_DEPLOY: {
        workers: base.workers_preferred || base.workers_min,
        vehicles: base.vehicles,
        equipment: base.equipment,
        hours: base.hours
      },
      
      ACT: {
        workers: base.workers_preferred || base.workers_min,
        vehicles: base.vehicles,
        equipment: base.equipment,
        hours: base.hours
      },
      
      // Partial action requires minimum resources
      ACT_PARTIAL: {
        workers: base.workers_min,
        vehicles: base.vehicles,
        equipment: (base.equipment || []).slice(0, 1),
        hours: Math.ceil((base.hours || 2) * 0.6)
      },
      
      // Verify action requires smaller team
      VERIFY: {
        workers: 1,
        vehicles: 0,
        equipment: [],
        hours: 2
      },
      
      // Schedule uses no immediate resources
      SCHEDULE: {
        workers: 0,
        vehicles: 0,
        equipment: [],
        hours: 0
      },
      
      // Monitor uses no resources
      MONITOR: {
        workers: 0,
        vehicles: 0,
        equipment: [],
        hours: 0
      },
      
      // Escalate uses minimal resources
      ESCALATE: {
        workers: 1,
        vehicles: 1,
        equipment: [],
        hours: 1
      }
    };
  }

  /**
   * Get expected outcomes per action
   * This is where Expected Civic Value is calculated
   */
  static getActionOutcomes(decision) {
    const { priority, confidence, risk_factors, deterioration } = decision;
    
    // Handle both field name formats: breakdown or score_breakdown
    const breakdown = priority.breakdown || priority.score_breakdown || {};
    
    // Base civic value components
    const impact = (breakdown.impact || breakdown.severity_pct || 50) / 100;
    const urgency = (breakdown.urgency || breakdown.safety_pct || 50) / 100;
    const risk = (breakdown.risk || breakdown.impact_pct || 50) / 100;
    const timeSensitivity = (breakdown.time || breakdown.age_pct || 50) / 100;
    
    // Confidence as a modifier (but NOT multiplying priority!)
    const evidenceStrength = confidence.evidence_strength || confidence.score / 100 || 0.5;
    
    // Time decay factor (issues get worse if not addressed)
    const deteriorationRate = deterioration?.rate || 0.1;
    
    return {
      FULL_DEPLOY: {
        // Full resolution: maximum impact reduction
        impactReduction: impact * 1.0,           // 100% of potential
        riskAvoidance: risk * 1.0,                // 100% of risk mitigated
        urgencyMultiplier: urgency,                 // Urgency of acting now
        
        // Confidence affects expected quality, not necessity
        expectedSuccessRate: evidenceStrength,
        expectedDuration: 1.0,                    // Relative to estimated
      },
      ACT: {
        // Full resolution: maximum impact reduction
        impactReduction: impact * 1.0,           // 100% of potential
        riskAvoidance: risk * 1.0,                // 100% of risk mitigated
        urgencyMultiplier: urgency,                 // Urgency of acting now
        
        // Confidence affects expected quality, not necessity
        expectedSuccessRate: evidenceStrength,
        expectedDuration: 1.0,                    // Relative to estimated
      },
      
      ACT_PARTIAL: {
        // Partial resolution: reduced but still valuable
        impactReduction: impact * 0.6,           // 60% of potential
        riskAvoidance: risk * 0.5,               // 50% risk reduction
        urgencyMultiplier: urgency,
        
        expectedSuccessRate: evidenceStrength * 0.9, // Slightly lower
        expectedDuration: 0.6,
      },
      
      VERIFY: {
        // Verification: no immediate resolution, but gathers evidence
        impactReduction: 0,                        // No immediate impact
        riskAvoidance: 0,
        urgencyMultiplier: urgency * 0.5,         // Gathers info for future action
        
        expectedSuccessRate: 0.9,                 // Verification almost always succeeds
        expectedDuration: 0.2,                    // Quick
      },
      
      SCHEDULE: {
        // Scheduled: delayed but planned
        impactReduction: impact * 0.3,            // Some value, but delayed
        riskAvoidance: risk * 0.3,
        urgencyMultiplier: urgency * 0.3,
        
        expectedSuccessRate: evidenceStrength,
        expectedDuration: 0.5,                   // Some prep time
      },
      
      MONITOR: {
        // Monitor: minimal value, maintains awareness
        impactReduction: impact * 0.1,
        riskAvoidance: risk * 0.1,
        urgencyMultiplier: urgency * 0.2,
        
        expectedSuccessRate: 0.8,
        expectedDuration: 0.1,
      },
      
      ESCALATE: {
        // Escalation: gets help from above
        impactReduction: impact * 0.8,            // May result in better resolution
        riskAvoidance: risk * 0.8,
        urgencyMultiplier: urgency,
        
        expectedSuccessRate: 0.7,                 // Escalation not always successful
        expectedDuration: 0.5,
      }
    };
  }

  /**
   * Estimate when this issue will become critical
   */
  static estimateDeadline(decision, timeHorizon) {
    const { deterioration } = decision;
    const deteriorationRate = deterioration?.rate || 0.1;
    const currentScore = decision.priority.score;
    
    // Calculate hours until priority would drop below action threshold
    // Assuming priority decays with deterioration rate
    const hoursToCritical = Math.ceil((100 - currentScore) / (deteriorationRate * 10));
    
    return Math.min(hoursToCritical, timeHorizon);
  }

  /**
   * Build resource pool from available resources
   */
  static buildResourcePool(availableResources) {
    return {
      workers: availableResources.available_workers || 0,
      vehicles: availableResources.available_vehicles || 0,
      equipment: availableResources.equipment_status || {},
      
      // Named resources (equipment with IDs)
      namedResources: this.extractNamedResources(availableResources),
      
      // Budget (if available)
      budget: availableResources.budget || null,
      
      // Time
      planningHorizon: 8 // hours
    };
  }

  /**
   * Extract named resources for conflict resolution
   */
  static extractNamedResources(availableResources) {
    const named = [];
    
    // Vehicle assignments
    if (availableResources.vehicles) {
      Object.entries(availableResources.vehicles).forEach(([id, status]) => {
        named.push({
          id,
          type: 'vehicle',
          capacity: availableResources.vehicleCapacity?.[id] || 1,
          status
        });
      });
    }
    
    // Equipment
    if (availableResources.equipment_status) {
      Object.entries(availableResources.equipment_status).forEach(([type, status]) => {
        if (status === 'available') {
          named.push({
            type: 'equipment',
            equipmentType: type,
            status: 'available'
          });
        }
      });
    }
    
    return named;
  }

  /**
   * Solve the optimization problem
   * Uses OR-Tools if available, falls back to greedy
   */
  static async solve(problem, maxAlternatives = 3) {
    // Try OR-Tools first
    const orToolsSolver = new OrToolsSolver(problem);
    const orToolsResult = await orToolsSolver.solve();
    
    let primaryPlan;
    let alternatives = [];
    let solverUsed = 'GREEDY';
    let greedySolver = null;
    
    if (!orToolsResult.error && orToolsResult.selectedActions) {
      // OR-Tools succeeded
      primaryPlan = {
        selectedActions: orToolsResult.selectedActions,
        objectiveValue: orToolsResult.objectiveValue || 0,
        statistics: orToolsResult.statistics,
        solver: 'OR_TOOLS'
      };
      solverUsed = 'OR_TOOLS';
      
      // Get greedy baseline for comparison
      greedySolver = new GreedySolver(problem);
      const greedyPlan = greedySolver.solve();
      
      // Store greedy for alternatives if different
      if (greedyPlan.objectiveValue !== primaryPlan.objectiveValue) {
        alternatives.push({
          ...greedyPlan,
          solver: 'GREEDY',
          comparisonNote: 'Baseline solution for comparison'
        });
      }
    } else {
      // Fall back to greedy
      greedySolver = new GreedySolver(problem);
      primaryPlan = greedySolver.solve();
      solverUsed = 'GREEDY';
    }
    
    // Get alternative greedy plans if using greedy
    if (solverUsed === 'GREEDY' && greedySolver) {
      for (let i = 1; i < maxAlternatives; i++) {
        const altPlan = greedySolver.solveAlternative(i);
        if (altPlan && altPlan.objectiveValue < primaryPlan.objectiveValue * 0.95) {
          alternatives.push({ ...altPlan, solver: 'GREEDY' });
        }
      }
    }
    
    // Sort alternatives by objective value
    alternatives.sort((a, b) => b.objectiveValue - a.objectiveValue);
    
    return {
      plan: primaryPlan,
      alternatives: alternatives.slice(0, maxAlternatives - 1),
      objectiveValue: primaryPlan.objectiveValue || 0,
      solverUsed,
      orToolsAvailable: !orToolsResult.error,
      statistics: primaryPlan.statistics || null
    };
  }

  /**
   * Build the final result structure
   */
  static buildResult(plan, evaluations, alternatives, problem, objectiveValue) {
    // Separate selected, scheduled, deferred
    const selected = [];
    const scheduled = [];
    const deferred = [];
    const escalated = [];
    
    // Handle plan format - might be {selectedActions} or the array directly
    const actions = plan.selectedActions || plan.actions || [];
    
    actions.forEach(action => {
      const issueEval = evaluations.find(e => e.evaluation.issue_id === action.issueId);
      const issue = issueEval?.issue;
      const evaluation = issueEval?.evaluation;
      
      const actionType = action.actionType || action.type || 'MONITOR';
      
      const actionRecord = {
        issueId: action.issueId,
        issueType: action.issueType,
        action: actionType,
        priority: evaluation?.priority,
        confidence: evaluation?.confidence,
        
        resources: action.resources,
        expectedOutcome: action.expectedOutcomes || action.expectedOutcome,
        
        reason: action.reason || this.generateActionReason({ ...action, type: actionType }, evaluation),
        
        // For display
        summary: this.generateActionSummary({ ...action, type: actionType }, issue, evaluation)
      };
      
      if (actionType === 'SCHEDULE' || actionType === 'MONITOR') {
        scheduled.push(actionRecord);
      } else if (actionType === 'ESCALATE') {
        escalated.push(actionRecord);
      } else {
        selected.push(actionRecord);
      }
    });
    
    // Find deferred issues (not selected but still in queue)
    const selectedIds = new Set(actions.map(a => a.issueId));
    evaluations.forEach(e => {
      if (!selectedIds.has(e.evaluation.issue_id) && !e.evaluation.error) {
        deferred.push({
          issueId: e.evaluation.issue_id,
          issueType: e.evaluation.type,
          priority: e.evaluation.priority,
          reason: 'Resource capacity exhausted or lower civic value',
          deferralReason: this.generateDeferralReason(e.evaluation, plan)
        });
      }
    });
    
    // Calculate resource utilization
    const resourceUtilization = this.calculateResourceUtilization(plan);
    
    // Generate tradeoffs
    const tradeoffs = this.generateTradeoffs(plan, deferred);
    
    // Build explanation
    const explanation = this.generatePlanExplanation(plan, resourceUtilization, tradeoffs);
    
    return {
      planId: problem.id,
      timestamp: new Date().toISOString(),
      
      // Main output
      selectedActions: selected,
      scheduledActions: scheduled,
      escalatedActions: escalated,
      deferredActions: deferred,
      
      // Summary
      summary: {
        totalIssues: evaluations.length,
        evaluated: evaluations.filter(e => !e.evaluation.error).length,
        selected: selected.length,
        scheduled: scheduled.length,
        escalated: escalated.length,
        deferred: deferred.length,
        
        objectiveValue: Math.round(objectiveValue * 100) / 100,
        resourceUtilization
      },
      
      // Alternatives (for officer to review)
      alternatives: alternatives.map((alt, idx) => ({
        planId: `${problem.id}-ALT${idx + 1}`,
        solver: alt.solver,
        actions: alt.selectedActions.map(a => ({
          issueId: a.issueId,
          action: a.actionType || a.type,
          reason: a.reason
        })),
        objectiveValue: Math.round(alt.objectiveValue * 100) / 100,
        tradeoffs: alt.tradeoffs || []
      })),
      
      // Resource utilization
      resourceUtilization,
      
      // Tradeoffs
      tradeoffs,
      
      // Decision Quality Metrics
      decisionQuality: this.calculateDecisionQuality(plan, evaluations, selected, deferred),
      
      // Solver info
      solverInfo: {
        solverUsed: plan.solver || 'GREEDY',
        orToolsAvailable: true,
        objectiveValue: Math.round((plan.objectiveValue || 0) * 100) / 100,
        statistics: plan.statistics || null
      },
      
      // Explanation
      explanation
    };
  }

  /**
   * Calculate decision quality metrics
   */
  static calculateDecisionQuality(plan, evaluations, selected, deferred) {
    const selectedActions = plan.selectedActions || [];
    
    // Critical tasks served
    const criticalServed = selectedActions.filter(a => 
      a.priorityBand === 'CRITICAL' || a.priority?.band === 'CRITICAL'
    ).length;
    const criticalTotal = evaluations.filter(e => 
      e.evaluation.priority?.band === 'CRITICAL'
    ).length;
    
    // High priority tasks served
    const highPriorityServed = selectedActions.filter(a => 
      a.priorityBand === 'HIGH' || a.priority?.band === 'HIGH' ||
      a.priorityScore >= 75 || a.priority?.score >= 75
    ).length;
    const highPriorityTotal = evaluations.filter(e => 
      e.evaluation.priority?.band === 'HIGH' || e.evaluation.priority?.score >= 75
    ).length;
    
    // Resource utilization
    const utilization = this.calculateResourceUtilization(plan);
    const workerUtilRate = utilization.workers > 0 ? 
      Math.min(1, (evaluations.length > 0 ? 0.7 : 0)) : 0; // Simplified
    
    // Average ECV of selected
    const avgECV = selectedActions.length > 0 ?
      selectedActions.reduce((sum, a) => sum + (a.ecv?.netECV || a.ecv || 0), 0) / selectedActions.length : 0;
    
    // Deferred critical
    const deferredCritical = deferred.filter(d => 
      d.priority?.band === 'CRITICAL'
    ).length;
    
    return {
      criticalTasks: {
        served: criticalServed,
        total: criticalTotal,
        servedRate: criticalTotal > 0 ? criticalServed / criticalTotal : 1
      },
      highPriorityTasks: {
        served: highPriorityServed,
        total: highPriorityTotal,
        servedRate: highPriorityTotal > 0 ? highPriorityServed / highPriorityTotal : 1
      },
      deferredCriticalTasks: deferredCritical,
      resourceUtilization: {
        workers: utilization.workers,
        vehicles: utilization.vehicles
      },
      averageECV: Math.round(avgECV * 100) / 100,
      optimizationScore: Math.round((plan.objectiveValue || 0) * 100) / 100
    };
  }

  /**
   * Calculate resource utilization
   */
  static calculateResourceUtilization(plan) {
    const utilized = {
      workers: 0,
      vehicles: 0,
      equipmentTypes: new Set()
    };
    
    plan.selectedActions.forEach(action => {
      if (action.resources) {
        utilized.workers += action.resources.workers || 0;
        utilized.vehicles += action.resources.vehicles || 0;
        (action.resources.equipment || []).forEach(eq => utilized.equipmentTypes.add(eq));
      }
    });
    
    return {
      workers: utilized.workers,
      vehicles: utilized.vehicles,
      equipmentTypes: Array.from(utilized.equipmentTypes)
    };
  }

  /**
   * Generate tradeoffs explanation
   */
  static generateTradeoffs(plan, deferred) {
    const tradeoffs = [];
    
    // Explain what was deferred
    deferred.forEach(d => {
      tradeoffs.push({
        type: 'DEFERRED',
        issueId: d.issueId,
        reason: d.reason,
        detail: d.deferralReason
      });
    });
    
    // Explain resource conflicts
    if (plan.resourceConflicts) {
      plan.resourceConflicts.forEach(conflict => {
        tradeoffs.push({
          type: 'RESOURCE_CONFLICT',
          ...conflict
        });
      });
    }
    
    // Generate conflict explanations for decisions
    const conflictExplanations = this.generateConflictExplanations(plan, deferred);
    tradeoffs.push(...conflictExplanations);
    
    return tradeoffs;
  }

  /**
   * Generate human-readable conflict explanations
   * 
   * Example:
   * "Excavator assigned to Drain A instead of Road B because Drain A has 
   *  greater expected risk reduction if completed within the current rainfall window. 
   *  Road B is projected to tolerate a 6-hour delay with limited additional risk."
   */
  static generateConflictExplanations(plan, deferred) {
    const explanations = [];
    
    // Find cases where two issues needed the same resource
    const selectedActions = plan.selectedActions || [];
    const actionByResource = new Map();
    
    // Group by resource type
    selectedActions.forEach(action => {
      if (action.resources?.equipment) {
        action.resources.equipment.forEach(eq => {
          if (!actionByResource.has(eq)) {
            actionByResource.set(eq, []);
          }
          actionByResource.get(eq).push(action);
        });
      }
    });
    
    // For each resource used by multiple issues, generate explanation
    actionByResource.forEach((actions, resource) => {
      if (actions.length > 1) {
        // Multiple actions using same resource - need conflict resolution
        const winner = actions[0]; // First one won
        const losers = actions.slice(1);
        
        explanations.push({
          type: 'RESOURCE_ASSIGNMENT',
          resource: resource,
          assignedTo: winner.issueId,
          explanation: this.explainResourceAssignment(winner, losers, resource)
        });
      }
    });
    
    // Explain why something was deferred over another
    if (selectedActions.length > 0 && deferred.length > 0) {
      const lowestSelected = [...selectedActions].sort((a, b) => 
        (a.priorityScore || 0) - (b.priorityScore || 0)
      )[0];
      
      if (lowestSelected && deferred.length > 0) {
        explanations.push({
          type: 'DEFER_DECISION',
          selected: lowestSelected.issueId,
          deferredIssues: deferred.map(d => d.issueId),
          explanation: this.explainDeferDecision(lowestSelected, deferred)
        });
      }
    }
    
    return explanations;
  }

  /**
   * Explain why a resource was assigned to one issue over others
   */
  static explainResourceAssignment(winner, losers, resource) {
    const winnerScore = winner.priorityScore || 0;
    const winnerRiskAvoidance = winner.expectedOutcomes?.riskAvoidance || 0;
    
    const loserReasons = losers.map(l => {
      const lossScore = l.priorityScore || 0;
      const deferReason = l.priorityScore < winnerScore 
        ? `lower civic value (${lossScore} vs ${winnerScore})`
        : 'resource conflict';
      return `${l.issueId} (${deferReason})`;
    }).join(', ');
    
    let reason = `${winner.issueId} selected for ${resource} because it has higher Expected Civic Value`;
    
    if (winnerRiskAvoidance > 0.6) {
      reason += ` and greater expected risk reduction`;
    }
    
    reason += `. ${loserReasons} deferred to protect this intervention.`;
    
    return reason;
  }

  /**
   * Explain why certain issues were deferred
   */
  static explainDeferDecision(selected, deferred) {
    const selectedScore = selected.priorityScore || 0;
    
    const deferredSummary = deferred.map(d => {
      const score = d.priority?.score || d.priorityScore || 0;
      return `${d.issueId} (priority ${score})`;
    }).join(', ');
    
    let explanation = `${selected.issueId} was selected over others because it has the highest combination of priority and resource efficiency.`;
    
    if (deferred.length > 0) {
      explanation += ` ${deferredSummary} were deferred to protect resources for this intervention.`;
    }
    
    // Add time-sensitivity note if applicable
    if (selected.deadline) {
      explanation += ` This intervention has a time-sensitive deadline.`;
    }
    
    return explanation;
  }

  /**
   * Generate action reason
   */
  static generateActionReason(action, evaluation) {
    const reasons = [];
    
    if (action.type === 'ACT' || action.type === 'ACT_PARTIAL') {
      reasons.push(`Priority ${evaluation.priority.score} (${evaluation.priority.band})`);
      
      if (evaluation.decision.reason_codes?.length) {
        reasons.push(...evaluation.decision.reason_codes);
      }
      
      if (action.expectedOutcome?.impactReduction > 0.7) {
        reasons.push('High expected impact reduction');
      }
      
      if (action.expectedOutcome?.riskAvoidance > 0.7) {
        reasons.push('Significant risk mitigation');
      }
    } else if (action.type === 'SCHEDULE') {
      reasons.push('Medium priority with acceptable confidence');
      reasons.push('Resources preserved for higher-value interventions');
    } else if (action.type === 'ESCALATE') {
      reasons.push('Resources unavailable');
      reasons.push('Requires supervisor/admin intervention');
    }
    
    return reasons.join('; ');
  }

  /**
   * Generate deferral reason
   */
  static generateDeferralReason(evaluation, plan) {
    // Check if deferred due to resources
    if (plan.resourceConstraints) {
      const constraint = plan.resourceConstraints.find(c => 
        evaluation.priority.score < c.thresholdScore
      );
      if (constraint) {
        return `${constraint.resource} capacity exhausted. Issue scored ${evaluation.priority.score}, threshold was ${constraint.thresholdScore}.`;
      }
    }
    
    // Check if lower civic value than selected items
    const selectedWithLowerPriority = plan.selectedActions.filter(a => 
      a.priority < evaluation.priority.score
    );
    
    if (selectedWithLowerPriority.length > 0) {
      return 'Lower Expected Civic Value than selected interventions.';
    }
    
    return 'Resource constraints prevented selection.';
  }

  /**
   * Generate action summary for display
   */
  static generateActionSummary(action, issue, evaluation) {
    const typeLabels = {
      ACT: 'Deploy immediately',
      ACT_PARTIAL: 'Deploy with available resources',
      VERIFY: 'Verify and assess',
      SCHEDULE: 'Schedule for later',
      MONITOR: 'Continue monitoring',
      ESCALATE: 'Escalate to supervisor',
      DEFER: 'Defer to later date'
    };
    
    return `${typeLabels[action.type] || action.type}: ${issue?.title || action.issueId}`;
  }

  /**
   * Generate plan-level explanation
   */
  static generatePlanExplanation(plan, resourceUtilization, tradeoffs) {
    const selectedCount = plan.selectedActions.filter(a => 
      !['SCHEDULE', 'MONITOR'].includes(a.type)
    ).length;
    
    const highPriorityCount = plan.selectedActions.filter(a => a.priorityBand === 'HIGH' || a.priorityBand === 'CRITICAL').length;
    
    let summary = `This plan deploys ${selectedCount} immediate actions`;
    
    if (highPriorityCount > 0) {
      summary += `, including ${highPriorityCount} high/critical priority interventions`;
    }
    
    summary += '.';
    
    if (tradeoffs.length > 0) {
      summary += ` ${tradeoffs.length} issue(s) deferred due to resource constraints.`;
    }
    
    return {
      summary,
      detail: `Using ${resourceUtilization.workers} workers and ${resourceUtilization.vehicles} vehicles.`
    };
  }

  /**
   * Generate a unique plan ID
   */
  static generatePlanId() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `PLAN-${timestamp}-${random}`;
  }
}

module.exports = BatchDecisionEngine;
