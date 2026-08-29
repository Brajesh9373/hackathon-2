/**
 * Explanation Generator
 * Creates human-readable explanations for priority decisions
 * 
 * KEY PRINCIPLES:
 * - Explanations are GENERATED FROM the decision trace, not re-reasoned
 * - The explanation must be CONSISTENT with the actual decision
 * - Use TEMPLATE-BASED generation for consistency
 */

class ExplanationGenerator {
  /**
   * Generate top contributing factors
   * Returns structured factors, not free-form text
   */
  static generateFactors(features, priorityResult) {
    const factors = [];

    // Check each factor that contributed to priority
    if (features.scores.impact >= 70) {
      factors.push({
        factor: 'public_impact',
        value: features.scores.impact,
        label: 'High public impact'
      });
    }
    if (features.scores.urgency >= 70) {
      factors.push({
        factor: 'urgency',
        value: features.scores.urgency,
        label: 'High urgency'
      });
    }
    if (features.scores.risk >= 70) {
      factors.push({
        factor: 'risk',
        value: features.scores.risk,
        label: 'High risk potential'
      });
    }
    if (features.features.facility_proximity >= 0.7) {
      factors.push({
        factor: 'facility_proximity',
        value: Math.round(features.features.facility_proximity * 100),
        label: 'Near critical facility'
      });
    }
    if (features.features.weather >= 0.6) {
      factors.push({
        factor: 'weather',
        value: Math.round(features.features.weather * 100),
        label: 'Weather exacerbating issue'
      });
    }
    if (features.features.is_repeat) {
      factors.push({
        factor: 'repeat_issue',
        value: 1,
        label: 'Repeat complaint'
      });
    }
    if (features.features.age > 0.5) {
      factors.push({
        factor: 'duration',
        value: Math.round(features.features.age * 100),
        label: 'Extended unresolved duration'
      });
    }

    return factors.slice(0, 5);
  }

  /**
   * Generate action explanation based on ACTUAL decision
   * This is where consistency is enforced
   */
  static generateActionExplanation(decision) {
    const { action, priorityBand, confidence, feasibility } = decision;
    
    // Template-based explanation for each action type
    const templates = {
      'ACT': {
        primary: 'Deploy resources immediately.',
        conditions: {
          'CRITICAL,HIGH': 'High priority with adequate evidence supports immediate action.',
          'CRITICAL,MEDIUM': 'Critical severity requires action despite moderate confidence.',
          'default': 'Priority and evidence support immediate deployment.'
        }
      },
      'ACT_VERIFY': {
        primary: 'Emergency deployment with concurrent verification.',
        conditions: {
          'default': 'Critical issue with low confidence requires immediate action while verifying details.'
        }
      },
      'VERIFY_PREPARE': {
        primary: 'Verify and prepare for action.',
        conditions: {
          'default': 'High priority requires verification before committing full resources.'
        }
      },
      'SCHEDULE': {
        primary: 'Schedule for upcoming work cycle.',
        conditions: {
          'default': 'Medium priority with acceptable confidence supports scheduled action.'
        }
      },
      'MONITOR': {
        primary: 'Continue monitoring for additional reports.',
        conditions: {
          'default': 'Medium priority with limited evidence - monitor for more information.'
        }
      },
      'DEFER': {
        primary: 'Can be deferred to later date.',
        conditions: {
          'default': 'Low priority allows deferral until resources permit.'
        }
      },
      'ESCALATE': {
        primary: 'Escalate to municipal admin.',
        conditions: {
          'default': 'Resources unavailable at current level - escalation required.'
        }
      }
    };

    const template = templates[action] || templates['MONITOR'];
    const conditionKey = `${priorityBand},${confidence.level}`;
    const condition = template.conditions[conditionKey] || template.conditions['default'];

    return {
      primary: template.primary,
      rationale: condition
    };
  }

  /**
   * Generate trade-off explanation based on feasibility
   */
  static generateTradeoffs(feasibility) {
    if (!feasibility) return { summary: 'No resource constraints identified.' };

    switch (feasibility.status) {
      case 'FEASIBLE':
        return {
          summary: 'Resources available for optimal deployment.',
          constraints: []
        };
      
      case 'SUBOPTIMAL':
        return {
          summary: 'Resources available but below optimal levels.',
          constraints: [
            `Worker gap: ${feasibility.shortfall?.workers?.gap_preferred || 0} additional workers preferred`
          ]
        };
      
      case 'PARTIAL':
        return {
          summary: 'Resource constraints require trade-off decisions.',
          constraints: [
            `Worker shortfall: ${feasibility.shortfall?.workers?.gap_min || 0} minimum workers needed`,
            `Vehicle shortfall: ${feasibility.shortfall?.vehicles?.gap || 0} vehicles needed`
          ]
        };
      
      case 'BLOCKED':
        return {
          summary: 'Resources insufficient for deployment.',
          constraints: [
            'Minimum worker requirement not met',
            'Alternative approach or escalation required'
          ]
        };
      
      case 'EQUIPMENT_LIMITED':
        return {
          summary: 'Equipment constraints identified.',
          constraints: [
            `Missing equipment: ${feasibility.shortfall?.equipment?.missing?.join(', ') || 'unknown'}`
          ]
        };
      
      default:
        return {
          summary: 'Resource status unknown.',
          constraints: []
        };
    }
  }

  /**
   * Generate resource explanation
   */
  static generateResourceExplanation(requirements) {
    if (!requirements) return 'Resource requirements not calculated.';

    const parts = [
      `${requirements.workers?.display || requirements.workers} worker(s)`,
      `${requirements.vehicles?.required || 0} vehicle(s)`,
      `~${requirements.estimated_hours}h estimated`
    ];

    if (requirements.adjustment_reasons?.length > 0) {
      parts.push(`(${requirements.adjustment_reasons.join(', ')})`);
    }

    return parts.join(', ');
  }

  /**
   * Generate full explanation object
   * All text is derived from decision trace
   */
  static generateExplanation(issueData, priorityResult, confidenceResult, feasibility, alternatives, rank, totalIssues) {
    const { features } = issueData;
    const { confidence, missing_data, action_strategy } = confidenceResult;

    // Generate factors
    const factors = this.generateFactors(features, priorityResult);

    // Generate action explanation (consistent with decision)
    const actionExplanation = this.generateActionExplanation({
      action: action_strategy.action,
      priorityBand: priorityResult.band,
      confidence: confidence.level,
      feasibility
    });

    // Generate tradeoffs
    const tradeoffs = this.generateTradeoffs(feasibility);

    // Generate why this ranking
    const rankingReason = rank === 1 ? 
      'Highest priority among all pending issues.' :
      `Ranked #${rank} of ${totalIssues} pending issues.`;

    // Build structured explanation
    const explanation = {
      summary: `${this.getBandLabel(priorityResult.band)} priority issue (${priorityResult.final}/100). ${rankingReason}`,
      
      factors: factors.map(f => f.label),
      
      priority: {
        score: priorityResult.final,
        band: priorityResult.band,
        label: this.getBandLabel(priorityResult.band),
        breakdown: {
          impact: features.scores.impact,
          urgency: features.scores.urgency,
          risk: features.scores.risk,
          time: features.scores.time,
          context: features.scores.context
        },
        context_modifiers: priorityResult.contextReasons || []
      },
      
      confidence: {
        score: confidence.score,
        level: confidence.level,
        missing_data: missing_data.map(m => m.issue),
        verification_recommended: missing_data.length > 0
      },
      
      action: {
        recommendation: action_strategy.action,
        primary: actionExplanation.primary,
        rationale: actionExplanation.rationale,
        caution: action_strategy.caution,
        reason_codes: action_strategy.reason_codes
      },
      
      resources: {
        summary: this.generateResourceExplanation(issueData.resourceRequirements),
        required: {
          workers_min: issueData.resourceRequirements?.workers?.min,
          workers_preferred: issueData.resourceRequirements?.workers?.preferred,
          vehicles: issueData.resourceRequirements?.vehicles?.required,
          hours: issueData.resourceRequirements?.estimated_hours
        },
        estimated_cost: issueData.resourceRequirements?.estimated_cost
      },
      
      feasibility: {
        status: feasibility.status,
        score: feasibility.score,
        tradeoffs: tradeoffs
      },
      
      recommendation: this.generateRecommendation(
        action_strategy.action, 
        priorityResult.band, 
        feasibility, 
        actionExplanation
      )
    };

    return explanation;
  }

  /**
   * Generate human-readable recommendation
   */
  static generateRecommendation(action, priorityBand, feasibility, actionExplanation) {
    const parts = [];

    // Primary directive based on action
    const actionVerbs = {
      'ACT': 'Deploy immediately',
      'ACT_VERIFY': 'Deploy immediately with verification',
      'VERIFY_PREPARE': 'Verify and prepare for deployment',
      'SCHEDULE': 'Schedule for next available slot',
      'MONITOR': 'Continue monitoring',
      'DEFER': 'Defer to later date',
      'ESCALATE': 'Escalate to supervisor'
    };

    parts.push(actionVerbs[action] || 'Review');

    // Resource context
    if (feasibility.status === 'FEASIBLE') {
      parts.push('- resources available');
    } else if (feasibility.status === 'SUBOPTIMAL') {
      parts.push('- resources below optimal');
    } else if (feasibility.status === 'PARTIAL') {
      parts.push('- resource gap exists');
    } else if (feasibility.status === 'BLOCKED') {
      parts.push('- resources unavailable');
    }

    return parts.join(' ') + '.';
  }

  /**
   * Get human-readable band label
   */
  static getBandLabel(band) {
    const labels = {
      'CRITICAL': 'Critical',
      'HIGH': 'High',
      'MEDIUM': 'Medium',
      'LOW': 'Low',
      'MINIMAL': 'Minimal'
    };
    return labels[band] || band;
  }

  /**
   * Generate comparison explanation for batch
   */
  static generateComparisonExplanation(issues) {
    if (issues.length < 2) return null;

    const top = issues[0];
    const second = issues[1];
    const scoreDiff = top.priority.final - second.priority.final;

    return {
      summary: `${top.issue_id} leads by ${scoreDiff} points over ${second.issue_id}.`,
      reasoning: top.explanation?.action?.rationale || 'Highest combined priority factors.'
    };
  }
}

module.exports = ExplanationGenerator;
