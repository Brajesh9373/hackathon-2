/**
 * Priority Engine - Main Orchestrator
 * Combines all components: Normalizer, Feature Builder, Confidence, Calculator, Resource Model, Explanation
 * 
 * OUTPUT STRUCTURE:
 * - priority: score, band, breakdown (independent of feasibility)
 * - confidence: score, level, missing_data
 * - resources: required vs available
 * - feasibility: status, score, shortfall
 * - decision: action, reason_codes
 * - explanation: structured, consistent with decision
 */

const DataNormalizer = require('./utils/normalizer');
const FeatureBuilder = require('./services/featureBuilder');
const ConfidenceEngine = require('./services/confidenceEngine');
const PriorityCalculator = require('./services/priorityCalculator');
const ResourceModel = require('./services/resourceModel');
const ExplanationGenerator = require('./services/explanationGenerator');

class PriorityEngine {
  /**
   * Evaluate a single issue
   */
  static evaluate(issue, availableResources = null) {
    try {
      // Step 1: Normalize input data
      const normalizedData = DataNormalizer.normalize(issue);
      
      // Step 2: Build features (Impact, Urgency, Risk, Time, Context)
      const features = FeatureBuilder.buildFeatures(normalizedData);
      
      // Step 3: Calculate priority (independent of resources)
      const priorityResult = PriorityCalculator.calculatePriority(features);
      
      // Step 4: Calculate confidence (independent of priority)
      const confidenceResult = ConfidenceEngine.analyze(
        normalizedData, 
        features,
        priorityResult.final,
        priorityResult.band
      );
      
      // Step 5: Calculate resource requirements
      const resourceRequirements = ResourceModel.calculateRequirements(features, issue.type);
      
      // Step 6: Check feasibility (separate from priority)
      let feasibility = { status: 'UNKNOWN', score: 0, shortfall: null };
      let alternatives = [];
      
      if (availableResources) {
        feasibility = ResourceModel.checkFeasibility(resourceRequirements, availableResources);
        alternatives = ResourceModel.generateAlternatives(resourceRequirements, feasibility, issue.type);
      }
      
      // Step 7: Adjust action based on feasibility
      const actionStrategy = this.adjustActionForFeasibility(
        confidenceResult.action_strategy,
        feasibility
      );
      
      // Step 8: Build complete decision
      const decision = this.buildDecision(
        issue,
        features,
        priorityResult,
        confidenceResult,
        resourceRequirements,
        feasibility,
        actionStrategy,
        alternatives
      );
      
      return decision;
      
    } catch (error) {
      console.error('Priority evaluation error:', error);
      return {
        error: true,
        message: `Priority evaluation failed: ${error.message}`,
        issue_id: issue.issue_id
      };
    }
  }

  /**
   * Adjust action based on feasibility
   * This is where priority meets resource reality
   */
  static adjustActionForFeasibility(actionStrategy, feasibility) {
    // If resources are blocked, escalate regardless of other factors
    if (feasibility.status === 'BLOCKED') {
      return {
        action: 'ESCALATE',
        description: 'Resources unavailable - escalation required',
        caution: 'Cannot proceed without additional resources',
        reason_codes: [...(actionStrategy.reason_codes || []), 'RESOURCE_BLOCKED']
      };
    }
    
    // If partially feasible, consider partial options
    if (feasibility.status === 'PARTIAL') {
      // For high/critical priority, still act but note constraint
      if (actionStrategy.action === 'ACT' || actionStrategy.action === 'ACT_VERIFY') {
        return {
          action: 'ACT_PARTIAL',
          description: 'Act with available resources, request additional',
          caution: 'Limited resources - may need follow-up',
          reason_codes: [...(actionStrategy.reason_codes || []), 'LIMITED_RESOURCES']
        };
      }
    }
    
    // Otherwise, return original action
    return actionStrategy;
  }

  /**
   * Build the complete decision object
   */
  static buildDecision(issue, features, priorityResult, confidenceResult, resourceRequirements, feasibility, actionStrategy, alternatives) {
    const decision = {
      // Identity
      issue_id: issue.issue_id,
      domain: issue.domain || 'infrastructure',
      type: issue.type,
      ward: issue.ward,
      timestamp: new Date().toISOString(),
      
      // Priority (independent)
      priority: {
        score: priorityResult.final,
        band: priorityResult.band,
        breakdown: {
          impact: features.scores.impact,
          urgency: features.scores.urgency,
          risk: features.scores.risk,
          time: features.scores.time,
          context: features.scores.context
        },
        context_modifiers: priorityResult.contextReasons || []
      },
      
      // Confidence (independent)
      confidence: {
        score: confidenceResult.confidence.score,
        level: confidenceResult.confidence.level,
        missing_data: confidenceResult.missing_data,
        evidence_strength: confidenceResult.evidenceStrength
      },
      
      // Resources
      resources: {
        required: {
          workers_min: resourceRequirements.workers.min,
          workers_preferred: resourceRequirements.workers.preferred,
          vehicles: resourceRequirements.vehicles.required,
          hours: resourceRequirements.estimated_hours,
          equipment: resourceRequirements.equipment.required
        },
        estimated_cost: resourceRequirements.estimated_cost
      },
      
      // Feasibility (separate from priority)
      feasibility: {
        status: feasibility.status,
        score: feasibility.score,
        shortfall: feasibility.shortfall
      },
      
      // Decision
      decision: {
        action: actionStrategy.action,
        primary_action: actionStrategy.description,
        caution: actionStrategy.caution,
        reason_codes: actionStrategy.reason_codes
      },
      
      // Alternatives
      alternatives: alternatives.map(a => ({
        type: a.type,
        description: a.description,
        priority: a.priority,
        reason_codes: a.reason_codes
      })),
      
      // Risk factors for display
      risk_factors: {
        safety: Math.round(features.risk.breakdown.safety * 100),
        health: Math.round(features.risk.breakdown.health * 100),
        cascade: Math.round(features.risk.breakdown.cascade * 100)
      },
      
      // Deterioration
      deterioration: {
        rate: features.deterioration,
        horizon_hours: 6
      }
    };
    
    return decision;
  }

  /**
   * Evaluate batch of issues with ranking
   */
  static evaluateBatch(issues, availableResources = null) {
    try {
      // Evaluate each issue
      const decisions = issues.map(issue => this.evaluate(issue, availableResources));
      
      // Filter errors
      const validDecisions = decisions.filter(d => !d.error);
      const errors = decisions.filter(d => d.error);
      
      // Rank by priority (not by feasibility)
      const ranked = validDecisions
        .sort((a, b) => b.priority.score - a.priority.score)
        .map((decision, index) => ({
          ...decision,
          rank: index + 1
        }));
      
      // Generate summary
      const summary = {
        total: issues.length,
        evaluated: validDecisions.length,
        errors: errors.length,
        
        priority_distribution: {
          CRITICAL: ranked.filter(d => d.priority.band === 'CRITICAL').length,
          HIGH: ranked.filter(d => d.priority.band === 'HIGH').length,
          MEDIUM: ranked.filter(d => d.priority.band === 'MEDIUM').length,
          LOW: ranked.filter(d => d.priority.band === 'LOW').length,
          MINIMAL: ranked.filter(d => d.priority.band === 'MINIMAL').length
        },
        
        action_distribution: this.distribution(ranked, 'decision.action'),
        
        feasibility_distribution: this.distribution(ranked, 'feasibility.status'),
        
        resource_estimate: {
          workers_min: ranked.reduce((sum, d) => sum + d.resources.required.workers_min, 0),
          workers_preferred: ranked.reduce((sum, d) => sum + d.resources.required.workers_preferred, 0),
          vehicles: ranked.reduce((sum, d) => sum + d.resources.required.vehicles, 0),
          hours: ranked.reduce((sum, d) => sum + d.resources.required.hours, 0)
        },
        
        top_issues: ranked.slice(0, 5).map(d => ({
          issue_id: d.issue_id,
          type: d.type,
          priority: d.priority,
          decision: d.decision
        }))
      };
      
      // Generate explanations for each decision
      ranked.forEach((decision, index) => {
        decision.explanation = this.generateExplanation(decision, index + 1, ranked.length);
      });
      
      return {
        decisions: ranked,
        summary,
        errors: errors.map(e => ({ issue_id: e.issue_id, error: e.message }))
      };
      
    } catch (error) {
      console.error('Batch evaluation error:', error);
      return { error: true, message: `Batch evaluation failed: ${error.message}` };
    }
  }

  /**
   * Generate explanation for a decision
   */
  static generateExplanation(decision, rank, total) {
    // Normalize missing_data to array of strings
    const missingDataArray = (decision.confidence.missing_data || []).map(m => 
      typeof m === 'string' ? m : (m.issue || '')
    );
    
    // Reconstruct the data structures needed by ExplanationGenerator
    const features = {
      scores: decision.priority.breakdown,
      features: {
        severity: decision.priority.breakdown.urgency / 100,
        age: decision.priority.breakdown.time / 100,
        exposure: decision.priority.breakdown.impact / 100,
        weather: decision.priority.breakdown.context / 100,
        facility_proximity: decision.risk_factors.safety / 100,
        is_repeat: missingDataArray.some(m => m.includes('Single report')) ? false : decision.confidence.evidence_strength > 0.5,
        nearby_complaints: 0
      },
      risk: {
        breakdown: {
          safety: decision.risk_factors.safety / 100,
          health: decision.risk_factors.health / 100,
          cascade: decision.risk_factors.cascade / 100
        }
      },
      deterioration: decision.deterioration.rate
    };
    
    const priorityResult = {
      final: decision.priority.score,
      band: decision.priority.band,
      contextReasons: decision.priority.context_modifiers
    };
    
    const confidenceResult = {
      confidence: {
        score: decision.confidence.score,
        level: decision.confidence.level
      },
      missing_data: missingDataArray.map(issue => ({ issue })),
      action_strategy: {
        action: decision.decision.action,
        description: decision.decision.primary_action,
        caution: decision.decision.caution,
        reason_codes: decision.decision.reason_codes
      },
      evidenceStrength: decision.confidence.evidence_strength
    };
    
    const feasibility = {
      status: decision.feasibility.status,
      score: decision.feasibility.score,
      shortfall: decision.feasibility.shortfall
    };
    
    const resourceRequirements = {
      workers: {
        min: decision.resources.required.workers_min,
        preferred: decision.resources.required.workers_preferred,
        display: `${decision.resources.required.workers_min}-${decision.resources.required.workers_preferred}`
      },
      vehicles: { required: decision.resources.required.vehicles },
      estimated_hours: decision.resources.required.hours,
      estimated_cost: decision.resources.estimated_cost,
      equipment: { required: decision.resources.required.equipment },
      adjustment_reasons: []
    };
    
    return ExplanationGenerator.generateExplanation(
      { features, resourceRequirements },
      priorityResult,
      confidenceResult,
      feasibility,
      decision.alternatives,
      rank,
      total
    );
  }

  /**
   * Recalculate when context changes
   */
  static recalculate(originalDecision, contextChanges, availableResources = null) {
    try {
      // Build issue from original decision
      const updatedIssue = {
        issue_id: originalDecision.issue_id,
        domain: originalDecision.domain,
        type: originalDecision.type,
        ward: originalDecision.ward,
        reported_at: originalDecision.timestamp,
        severity: 3, // Default
        photo_available: originalDecision.confidence?.evidence_strength > 0.5,
        citizen_reports: 1,
        near_facilities: [],
        nearby_complaints: 0,
        is_repeat_location: false,
        weather_condition: contextChanges.weather || 'normal',
        traffic_level: contextChanges.traffic || 'medium',
        population_exposed: contextChanges.population_exposed || 'medium'
      };
      
      const newDecision = this.evaluate(updatedIssue, availableResources);
      
      newDecision.recalculated = true;
      newDecision.previous_priority = originalDecision.priority?.score || originalDecision.priority_score;
      newDecision.context_changes = contextChanges;
      
      return newDecision;
      
    } catch (error) {
      return { error: true, message: `Recalculation failed: ${error.message}` };
    }
  }

  /**
   * Helper: create distribution summary
   */
  static distribution(items, path) {
    const dist = {};
    items.forEach(item => {
      const keys = path.split('.');
      let value = item;
      for (const key of keys) {
        value = value?.[key];
      }
      dist[value] = (dist[value] || 0) + 1;
    });
    return dist;
  }

  /**
   * Generate explanation for a single decision (convenience method)
   */
  static explain(decision, rank = null, total = 1) {
    return this.generateExplanation(decision, rank || 1, total);
  }
}

module.exports = PriorityEngine;
