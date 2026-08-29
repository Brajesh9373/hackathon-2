/**
 * Objective Builder
 * 
 * Builds the Expected Civic Value (ECV) for each intervention option.
 * 
 * KEY PRINCIPLE: This operates on ACTIONS, not tickets.
 * 
 * The corrected formula structure:
 * 
 *   Expected Civic Value (ECV) = Potential Civic Benefit × Action Success Probability
 * 
 * Where:
 *   Potential Civic Benefit = Impact × Urgency × Risk × Time_Sensitivity
 *   Action Success Probability = f(Evidence Strength, Priority Band)
 * 
 * Important: Confidence affects SUCCESS PROBABILITY, not the importance of the issue.
 * Low confidence on a CRITICAL issue still needs investigation.
 */

class ObjectiveBuilder {
  /**
   * Calculate Expected Civic Value for an action
   * 
   * @param {Object} action - The action being considered
   * @param {Object} decision - The priority decision for this issue
   * @param {Object} constraints - Resource constraints
   * @returns {Object} ECV breakdown
   */
  static calculateECV(action, decision, constraints) {
    const actionType = action.actionType || action.type || 'ACT';
    const allOutcomes = action.expectedOutcomes || decision.expectedOutcomes || {};
    const outcomes = allOutcomes[actionType] || allOutcomes;

    // ============================================================
    // STEP 1: Calculate POTENTIAL CIVIC BENEFIT (PCB)
    // This represents the inherent value of addressing this issue
    // ============================================================
    
    const impactValue = this.normalizeComponent(outcomes.impactReduction || decision.priority?.breakdown?.impact || 50);
    const urgencyValue = this.normalizeComponent(outcomes.urgencyMultiplier || decision.priority?.breakdown?.urgency || 50);
    const riskValue = this.normalizeComponent(outcomes.riskAvoidance || decision.priority?.breakdown?.risk || 50);
    const timeValue = this.normalizeComponent(decision.priority?.breakdown?.time || 30);

    // PCB = geometric mean of components (avoids extreme suppression)
    // Using a weighted average instead of simple multiplication
    const weights = { impact: 0.30, urgency: 0.25, risk: 0.25, time: 0.20 };
    const pcb = (
      weights.impact * impactValue +
      weights.urgency * urgencyValue +
      weights.risk * riskValue +
      weights.time * timeValue
    );

    // ============================================================
    // STEP 2: Calculate ACTION SUCCESS PROBABILITY (ASP)
    // This is where confidence enters - but carefully
    // ============================================================
    
    const evidenceStrength = decision.confidence?.evidence_strength || 
                           decision.confidence?.score / 100 || 0.5;
    const priorityBand = decision.priority?.band || 'MEDIUM';

    const asp = this.getActionSuccessProbability(evidenceStrength, priorityBand);

    // ============================================================
    // STEP 3: Calculate NET ECV
    // ECV = PCB × ASP, then subtract costs
    // ============================================================

    const grossECV = pcb * asp;

    // Calculate costs
    const resourceCost = this.calculateResourceCost(action.resources, constraints);
    const displacementCost = this.calculateDisplacementCost(action, constraints);
    const netECV = Math.max(0, grossECV - resourceCost - displacementCost);

    return {
      // Components for transparency
      components: {
        // Potential Civic Benefit
        pcb: Math.round(pcb * 100) / 100,
        pcb_breakdown: {
          impact: Math.round(impactValue * 100) / 100,
          urgency: Math.round(urgencyValue * 100) / 100,
          risk: Math.round(riskValue * 100) / 100,
          time: Math.round(timeValue * 100) / 100
        },
        // Action Success Probability
        asp: Math.round(asp * 100) / 100,
        asp_breakdown: {
          evidenceStrength: Math.round(evidenceStrength * 100) / 100,
          priorityBand
        }
      },

      // Intermediate values
      grossECV: Math.round(grossECV * 100) / 100,
      resourceCost: Math.round(resourceCost * 100) / 100,
      displacementCost: Math.round(displacementCost * 100) / 100,

      // Final value
      netECV: Math.round(netECV * 100) / 100,

      // For explanation
      breakdown: this.getBreakdownText(pcb, asp, evidenceStrength, priorityBand),
      formula: 'ECV = PCB × ASP - Costs',
      formulaExplanation: 'PCB (Potential Civic Benefit) × ASP (Action Success Probability) - Resource Costs'
    };
  }

  /**
   * Normalize a component to 0-1 range
   */
  static normalizeComponent(value) {
    if (value === null || value === undefined) return 0.5;
    return Math.max(0, Math.min(1, value / 100));
  }

  /**
   * Calculate Action Success Probability (ASP)
   * 
   * CRITICAL principle: Low confidence does NOT make an important 
   * problem unimportant. Instead, it affects whether we can ACT
   * vs need to VERIFY first.
   * 
   * @param {number} evidenceStrength - 0 to 1
   * @param {string} priorityBand - CRITICAL, HIGH, MEDIUM, LOW, MINIMAL
   * @returns {number} Success probability 0 to 1
   */
  static getActionSuccessProbability(evidenceStrength, priorityBand) {
    // CRITICAL priority: high ASP even with moderate evidence
    // These issues need investigation regardless of uncertainty
    if (priorityBand === 'CRITICAL') {
      return Math.max(0.75, 0.5 + evidenceStrength * 0.5);
    }

    // HIGH priority: slightly higher ASP floor
    if (priorityBand === 'HIGH') {
      if (evidenceStrength >= 0.7) return 1.0;
      if (evidenceStrength >= 0.5) return 0.85;
      if (evidenceStrength >= 0.3) return 0.65;
      return 0.50;
    }

    // MEDIUM priority: standard confidence curve
    if (priorityBand === 'MEDIUM') {
      if (evidenceStrength >= 0.7) return 1.0;
      if (evidenceStrength >= 0.5) return 0.80;
      if (evidenceStrength >= 0.3) return 0.55;
      return 0.35;
    }

    // LOW/MINIMAL priority: confidence more important
    if (priorityBand === 'LOW' || priorityBand === 'MINIMAL') {
      if (evidenceStrength >= 0.7) return 1.0;
      if (evidenceStrength >= 0.5) return 0.70;
      if (evidenceStrength >= 0.3) return 0.45;
      return 0.25;
    }

    return 0.5;
  }

  /**
   * Calculate resource cost
   * 
   * Represents the "cost" of using resources on this action
   * compared to alternative uses.
   */
  static calculateResourceCost(resources, constraints) {
    if (!resources) return 0;
    
    const workerCost = (resources.workers || 0) * 5;        // 5 points per worker-hour
    const vehicleCost = (resources.vehicles || 0) * 10;   // 10 points per vehicle-hour
    const equipmentCost = (resources.equipment || []).length * 3;

    const totalCost = workerCost + vehicleCost + equipmentCost;

    // Scale by resource scarcity
    const scarcityMultiplier = this.getResourceScarcityMultiplier(resources, constraints);

    return totalCost * scarcityMultiplier;
  }

  /**
   * Calculate scarcity multiplier
   * Resources in high demand cost more
   */
  static getResourceScarcityMultiplier(resources, constraints) {
    if (!constraints) return 1.0;

    let multiplier = 1.0;

    if (constraints.availableWorkers) {
      const workerUtilization = constraints.usedWorkers / constraints.availableWorkers;
      if (workerUtilization > 0.8) multiplier += 0.3;
      else if (workerUtilization > 0.6) multiplier += 0.15;
    }

    if (constraints.availableVehicles) {
      const vehicleUtilization = constraints.usedVehicles / constraints.availableVehicles;
      if (vehicleUtilization > 0.8) multiplier += 0.5;
      else if (vehicleUtilization > 0.6) multiplier += 0.25;
    }

    return Math.min(2.0, multiplier);
  }

  /**
   * Calculate displacement cost
   * 
   * Opportunity cost: what else could we do with these resources?
   */
  static calculateDisplacementCost(action, constraints) {
    if (!constraints || !constraints.pendingActions) return 0;

    const displacedActions = constraints.pendingActions
      .filter(pending => this.isDisplaced(action, pending, constraints));

    if (displacedActions.length === 0) return 0;

    const bestDisplaced = displacedActions
      .map(a => this.calculateECV(a, a.decision, null))
      .sort((a, b) => b.netECV - a.netECV)[0];

    return bestDisplaced?.netECV || 0;
  }

  /**
   * Check if an action displaces another
   */
  static isDisplaced(action, pendingAction, constraints) {
    if (action.issueId === pendingAction.issueId) return false;

    const actionResources = action.resources || {};
    const pendingResources = pendingAction.resources || {};

    // Worker conflict
    if ((actionResources.workers || 0) + (pendingResources.workers || 0) > 
        (constraints.availableWorkers || 0)) {
      return true;
    }

    // Equipment conflict
    const actionEq = new Set(actionResources.equipment || []);
    const pendingEq = new Set(pendingResources.equipment || []);

    for (const eq of actionEq) {
      if (pendingEq.has(eq) && 
          (constraints.equipmentStatus?.[eq] || 'available') === 'available') {
        return true;
      }
    }

    return false;
  }

  /**
   * Get human-readable breakdown
   */
  static getBreakdownText(pcb, asp, evidenceStrength, priorityBand) {
    const parts = [];

    if (pcb > 0.70) parts.push(`High civic value (${Math.round(pcb * 100)}%)`);
    if (pcb > 0.50 && pcb <= 0.70) parts.push(`Moderate civic value (${Math.round(pcb * 100)}%)`);
    if (asp > 0.85) parts.push(`High success probability`);
    if (asp < 0.60 && priorityBand !== 'CRITICAL') {
      parts.push(`Moderate confidence - verification recommended`);
    }
    if (priorityBand === 'CRITICAL' && asp < 0.80) {
      parts.push(`CRITICAL priority - proceeding despite uncertainty`);
    }

    return parts.length > 0 ? parts.join(', ') : 'Moderate priority factors';
  }

  /**
   * Build objective function for optimizer
   */
  static buildObjectiveFunction(decisions, constraints) {
    return (action) => {
      const decision = decisions.find(d => d.issue_id === action.issueId);
      if (!decision) return { netECV: 0 };
      return this.calculateECV(action, decision, constraints);
    };
  }

  /**
   * Compare two plans
   */
  static comparePlans(planA, planB) {
    const valueA = planA.selectedActions.reduce((sum, a) => sum + (a.ecv?.netECV || 0), 0);
    const valueB = planB.selectedActions.reduce((sum, a) => sum + (a.ecv?.netECV || 0), 0);
    const costA = planA.selectedActions.reduce((sum, a) => sum + (a.ecv?.resourceCost || 0), 0);
    const costB = planB.selectedActions.reduce((sum, a) => sum + (a.ecv?.resourceCost || 0), 0);

    const netA = valueA - costA;
    const netB = valueB - costB;

    return netB - netA;
  }

  /**
   * Explain why one action was selected over another
   */
  static explainSelection(winner, loser, ecvWinner, ecvLoser) {
    const reasons = [];

    if (ecvWinner.components.pcb > ecvLoser.components.pcb + 0.10) {
      reasons.push(`Higher civic value (${Math.round(ecvWinner.components.pcb * 100)}% vs ${Math.round(ecvLoser.components.pcb * 100)}%)`);
    }

    if (ecvWinner.components.asp > ecvLoser.components.asp + 0.10) {
      reasons.push(`Better expected success (${Math.round(ecvWinner.components.asp * 100)}% vs ${Math.round(ecvLoser.components.asp * 100)}%)`);
    }

    const effWinner = ecvWinner.netECV / Math.max(0.1, ecvWinner.resourceCost);
    const effLoser = ecvLoser.netECV / Math.max(0.1, ecvLoser.resourceCost);

    if (effWinner > effLoser * 1.2) {
      reasons.push(`Better resource efficiency`);
    }

    return {
      winnerId: winner.issueId,
      loserId: loser.issueId,
      reasons: reasons.length > 0 ? reasons : ['Higher overall Expected Civic Value'],
      ecvDifference: Math.round((ecvWinner.netECV - ecvLoser.netECV) * 100) / 100
    };
  }
}

module.exports = { ObjectiveBuilder };
