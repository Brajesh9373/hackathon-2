/**
 * Priority Calculator
 * Combines all factor scores into a final priority score
 * Uses weighted formula with context modifiers
 */

class PriorityCalculator {
  // Default weights for Infrastructure domain
  // CRITICAL principle: severity=5 should result in HIGH/CRITICAL band
  // Band thresholds: MINIMAL(0-20), LOW(20-40), MEDIUM(40-60), HIGH(60-80), CRITICAL(80-100)
  static DEFAULT_WEIGHTS = {
    impact: 0.40,    // Severity is primary driver of priority
    urgency: 0.25,   // How time-sensitive is this?
    risk: 0.20,      // Safety/harm risk
    time: 0.10,      // Age/deterioration
    context: 0.05    // Modifiers (bounded separately)
  };

  // Band thresholds - calibrated so severity=5 with other factors hits CRITICAL
  static BANDS = {
    CRITICAL: { min: 75, label: 'CRITICAL', color: 'red' },
    HIGH: { min: 55, label: 'HIGH', color: 'orange' },
    MEDIUM: { min: 35, label: 'MEDIUM', color: 'yellow' },
    LOW: { min: 15, label: 'LOW', color: 'blue' },
    MINIMAL: { min: 0, label: 'MINIMAL', color: 'gray' }
  };

  /**
   * Calculate base priority score (0-100)
   */
  static calculateBasePriority(features) {
    const weights = this.DEFAULT_WEIGHTS;
    
    const priority = (
      weights.impact * features.impact.score +
      weights.urgency * features.urgency.score +
      weights.risk * features.risk.score +
      weights.time * features.time.score +
      weights.context * features.context.score
    );

    return Math.round(priority * 100);
  }

  /**
   * Calculate context modifiers (bounded adjustments)
   * These can add or subtract from the base priority
   */
  static calculateContextModifiers(features) {
    let modifier = 0;
    const reasons = [];

    // Emergency context: critical facility + bad weather
    if (features.features.facility_proximity >= 0.7 && features.features.weather >= 0.6) {
      modifier += 5;
      reasons.push('Critical facility under current weather threat');
    }

    // Multiple recent reports at same location
    if (features.features.nearby_complaints > 10 && features.features.is_repeat) {
      modifier += 4;
      reasons.push('Repeat issue with multiple recent complaints');
    }

    // High population impact + safety risk
    if (features.features.exposure >= 0.7 && features.risk.breakdown.safety >= 0.7) {
      modifier += 3;
      reasons.push('High population exposure combined with safety risk');
    }

    // Stale issue (old + getting worse)
    if (features.features.age > 0.5 && features.deterioration > 0.1) {
      modifier += 3;
      reasons.push('Unresolved issue deteriorating over time');
    }

    // Reduce priority for very old issues that haven't escalated
    if (features.features.age > 0.8 && features.features.exposure < 0.5) {
      modifier -= 2;
      reasons.push('Low-impact issue persisting without escalation');
    }

    // Bound modifier between -5 and +10
    modifier = Math.max(-5, Math.min(10, modifier));

    return { modifier, reasons };
  }

  /**
   * Calculate "Cost of Waiting" adjustment
   * How much worse will this get if we don't act soon?
   */
  static calculateCostOfWaiting(features) {
    // Estimate expected deterioration over next 6 hours
    const expectedDeterioration = features.deterioration * 0.2; // 6 hours worth
    const riskIncrease = features.risk.score * expectedDeterioration;

    // Calculate cost
    let costOfWaiting = 0;
    let timeHorizon = '6 hours';

    if (expectedDeterioration > 0.15) {
      costOfWaiting = Math.round(features.urgency.score * 10);
      timeHorizon = '4 hours';
    } else if (expectedDeterioration > 0.1) {
      costOfWaiting = Math.round(features.urgency.score * 7);
      timeHorizon = '6 hours';
    } else if (expectedDeterioration > 0.05) {
      costOfWaiting = Math.round(features.urgency.score * 4);
      timeHorizon = '12 hours';
    }

    return {
      cost: costOfWaiting,
      horizon: timeHorizon,
      expectedImpact: Math.round(expectedDeterioration * 100)
    };
  }

  /**
   * Determine priority band/category
   * Using calibrated thresholds: MINIMAL(0-14), LOW(15-34), MEDIUM(35-54), HIGH(55-74), CRITICAL(75-100)
   */
  static getPriorityBand(score) {
    if (score >= 75) return 'CRITICAL';
    if (score >= 55) return 'HIGH';
    if (score >= 35) return 'MEDIUM';
    if (score >= 15) return 'LOW';
    return 'MINIMAL';
  }

  /**
   * Calculate final priority with all adjustments
   */
  static calculatePriority(features) {
    // Base priority from weighted factors
    const basePriority = this.calculateBasePriority(features);

    // Context modifiers
    const contextMod = this.calculateContextModifiers(features);

    // Cost of waiting
    const costOfWaiting = this.calculateCostOfWaiting(features);

    // Calculate final priority
    let finalPriority = basePriority + contextMod.modifier;

    // Add cost of waiting to priority
    finalPriority += costOfWaiting.cost;

    // Cap at 100
    finalPriority = Math.min(100, Math.max(0, Math.round(finalPriority)));

    // Get priority band
    const priorityBand = this.getPriorityBand(finalPriority);

    return {
      base: basePriority,
      contextModifier: contextMod.modifier,
      costOfWaiting: costOfWaiting.cost,
      final: finalPriority,
      band: priorityBand,
      contextReasons: contextMod.reasons,
      costOfWaitingDetails: costOfWaiting,
      weights: this.DEFAULT_WEIGHTS
    };
  }

  /**
   * Rank multiple issues by priority
   */
  static rankIssues(issuesWithPriority) {
    return issuesWithPriority
      .sort((a, b) => b.priority.final - a.priority.final)
      .map((issue, index) => ({
        ...issue,
        rank: index + 1
      }));
  }

  /**
   * Generate score breakdown for display
   */
  static getScoreBreakdown(features, priorityResult) {
    return {
      impact: {
        score: features.scores.impact,
        weight: Math.round(priorityResult.weights.impact * 100),
        contribution: Math.round(priorityResult.weights.impact * features.impact.score * 100)
      },
      urgency: {
        score: features.scores.urgency,
        weight: Math.round(priorityResult.weights.urgency * 100),
        contribution: Math.round(priorityResult.weights.urgency * features.urgency.score * 100)
      },
      risk: {
        score: features.scores.risk,
        weight: Math.round(priorityResult.weights.risk * 100),
        contribution: Math.round(priorityResult.weights.risk * features.risk.score * 100)
      },
      time: {
        score: features.scores.time,
        weight: Math.round(priorityResult.weights.time * 100),
        contribution: Math.round(priorityResult.weights.time * features.time.score * 100)
      },
      context: {
        score: features.scores.context,
        weight: Math.round(priorityResult.weights.context * 100),
        contribution: Math.round(priorityResult.weights.context * features.context.score * 100)
      }
    };
  }
}

module.exports = PriorityCalculator;
