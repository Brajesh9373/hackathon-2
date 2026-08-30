/**
 * Feature Builder
 * Converts normalized features into grouped factor scores
 * Groups: Impact, Urgency, Risk, Time, Context
 */

class FeatureBuilder {
  /**
   * Calculate IMPACT score (how much public impact does this cause?)
   * Weight: 30% of priority
   */
  static calculateImpact(features, issueType) {
    if (features.emergency_signal) {
      return {
        score: 1.0,
        breakdown: { population: 1.0, traffic: 1.0, facility: 1.0, service: 1.0 }
      };
    }

    const weights = {
      population: 0.35,    // How many people affected
      traffic: 0.25,       // Traffic disruption
      facility: 0.25,       // Critical facility proximity
      service: 0.15        // Service disruption
    };

    // Population exposure score
    const populationScore = features.exposure;

    // Traffic impact based on location type
    let trafficScore = features.traffic;
    // Roads/highways get higher traffic weight
    if (issueType === 'road_damage' || issueType === 'pothole') {
      trafficScore = Math.min(1.0, trafficScore * 1.2);
    }

    // Critical facility proximity score
    const facilityScore = features.facility_proximity;

    // Service disruption (based on issue type and nearby complaints)
    const serviceScore = Math.min(1.0, features.nearby_complaints * 0.2 + (features.is_repeat ? 0.3 : 0));

    return {
      score: (
        weights.population * populationScore +
        weights.traffic * trafficScore +
        weights.facility * facilityScore +
        weights.service * serviceScore
      ),
      breakdown: {
        population: populationScore,
        traffic: trafficScore,
        facility: facilityScore,
        service: serviceScore
      }
    };
  }

  /**
   * Calculate URGENCY score (how quickly does this need action?)
   * Weight: 25% of priority
   */
  static calculateUrgency(features, issueType) {
    if (features.emergency_signal) {
      return {
        score: 1.0,
        breakdown: { currentSeverity: 1.0, deterioration: 1.0, deadline: 1.0, activeRisk: 1.0 }
      };
    }

    const weights = {
      currentSeverity: 0.40,   // How bad is it now?
      deterioration: 0.30,      // Is it getting worse?
      deadline: 0.15,           // Any time constraints?
      activeRisk: 0.15          // Immediate danger?
    };

    // Current severity score
    const severityScore = features.severity;

    // Deterioration indicator (based on weather + repeat status)
    let deteriorationScore = 0;
    if (features.weather >= 0.6) deteriorationScore += 0.4; // Rain/Storm
    if (features.is_repeat) deteriorationScore += 0.4;
    if (features.nearby_complaints > 5) deteriorationScore += 0.2;
    deteriorationScore = Math.min(1.0, deteriorationScore);

    // Deadline urgency (based on issue type)
    let deadlineScore = 0;
    if (issueType === 'flooding' || issueType === 'sewage_overflow') {
      deadlineScore = 0.9; // Immediate deadline
    } else if (issueType === 'blocked_drain' || issueType === 'road_damage') {
      deadlineScore = 0.6; // Soon
    } else {
      deadlineScore = 0.3; // Can wait
    }

    // Active risk during current conditions
    let activeRiskScore = features.weather * 0.5;
    if (features.weather >= 0.6 && (issueType === 'blocked_drain' || issueType === 'flooding')) {
      activeRiskScore = 1.0; // Critical during rain
    }

    return {
      score: (
        weights.currentSeverity * severityScore +
        weights.deterioration * deteriorationScore +
        weights.deadline * deadlineScore +
        weights.activeRisk * activeRiskScore
      ),
      breakdown: {
        currentSeverity: severityScore,
        deterioration: deteriorationScore,
        deadline: deadlineScore,
        activeRisk: activeRiskScore
      }
    };
  }

  /**
   * Calculate RISK score (what happens if we don't act?)
   * Weight: 20% of priority
   */
  static calculateRisk(features, issueType) {
    if (features.emergency_signal) {
      return {
        score: 1.0,
        breakdown: { safety: 1.0, health: 1.0, cascade: 1.0, futureDamage: 1.0 }
      };
    }

    const weights = {
      safety: 0.40,    // Safety hazard potential
      health: 0.25,     // Health risk
      cascade: 0.20,     // Can it cause other problems?
      futureDamage: 0.15 // Potential for worse damage
    };

    // Safety risk based on issue type and conditions
    let safetyScore = 0;
    if (issueType === 'electrical' || issueType === 'streetlight') {
      safetyScore = 0.8; // High safety risk
    } else if (issueType === 'flooding' || issueType === 'sewage_overflow') {
      safetyScore = 0.9; // Very high
    } else if (issueType === 'blocked_drain') {
      safetyScore = features.weather >= 0.6 ? 0.9 : 0.5;
    } else {
      safetyScore = features.severity * 0.8;
    }

    // Health risk
    let healthScore = 0;
    if (issueType === 'sewage_overflow' || issueType === 'garbage') {
      healthScore = 0.9;
    } else if (issueType === 'flooding') {
      healthScore = 0.8;
    } else if (issueType === 'blocked_drain') {
      healthScore = features.weather >= 0.6 ? 0.7 : 0.3;
    }

    // Cascade potential (can this cause other problems?)
    let cascadeScore = 0;
    if (issueType === 'blocked_drain') {
      cascadeScore = features.weather >= 0.6 ? 0.9 : 0.5;
    } else if (issueType === 'road_damage' || issueType === 'pothole') {
      cascadeScore = 0.6;
    } else if (issueType === 'flooding') {
      cascadeScore = 1.0;
    }

    // Future damage potential
    const futureDamageScore = features.age * 0.5 + features.severity * 0.5;

    return {
      score: (
        weights.safety * Math.min(1.0, safetyScore) +
        weights.health * Math.min(1.0, healthScore) +
        weights.cascade * cascadeScore +
        weights.futureDamage * futureDamageScore
      ),
      breakdown: {
        safety: Math.min(1.0, safetyScore),
        health: Math.min(1.0, healthScore),
        cascade: cascadeScore,
        futureDamage: futureDamageScore
      }
    };
  }

  /**
   * Calculate TIME score (how long has it been unresolved?)
   * Weight: 10% of priority
   */
  static calculateTime(features) {
    // Simple time-based score - older issues get higher score
    // This rewards addressing older complaints
    return {
      score: features.age,
      breakdown: {
        age: features.age,
        daysOld: Math.round(features.age * 30) // Convert back to approximate days
      }
    };
  }

  /**
   * Calculate CONTEXT score (what is happening right now?)
   * Weight: 15% of priority
   */
  static calculateContext(features, issueType) {
    if (features.emergency_signal) {
      return {
        score: 1.0,
        breakdown: { weather: 1.0, event: 1.0, spike: 1.0, seasonal: 1.0 }
      };
    }

    const weights = {
      weather: 0.35,      // Current weather conditions
      event: 0.25,         // Special events/festivals
      spike: 0.20,         // Complaint spike?
      seasonal: 0.20       // Seasonal factors
    };

    // Weather context - rain makes many issues worse
    let weatherContext = features.weather;
    if (features.weather >= 0.6) {
      // Rain intensifies certain issues
      if (['blocked_drain', 'flooding', 'road_damage', 'pothole'].includes(issueType)) {
        weatherContext = 1.0;
      }
    }

    // Event context (simplified - could be expanded)
    const eventContext = 0.0; // No special event by default

    // Complaint spike context
    const spikeContext = features.nearby_complaints > 10 ? 0.8 : 
                        features.nearby_complaints > 5 ? 0.5 : 0.2;

    // Seasonal context (simplified)
    const seasonalContext = 0.0;

    return {
      score: (
        weights.weather * weatherContext +
        weights.event * eventContext +
        weights.spike * spikeContext +
        weights.seasonal * seasonalContext
      ),
      breakdown: {
        weather: weatherContext,
        event: eventContext,
        spike: spikeContext,
        seasonal: seasonalContext
      }
    };
  }

  /**
   * Calculate deterioration rate (how fast is this getting worse?)
   * Used for "cost of waiting" analysis
   */
  static calculateDeterioration(features, issueType) {
    if (features.emergency_signal) return 1.0;

    let baseRate = features.severity * 0.1; // Base deterioration
    
    // Weather accelerates deterioration
    if (features.weather >= 0.6) {
      baseRate *= 2.0; // Double during rain
    }

    // Issue type specific rates
    const typeRates = {
      'blocked_drain': 0.15,
      'flooding': 0.25,
      'sewage_overflow': 0.2,
      'road_damage': 0.1,
      'pothole': 0.08,
      'streetlight': 0.02,
      'electrical': 0.15
    };

    baseRate = typeRates[issueType] || 0.05;

    // Repeat locations deteriorate faster
    if (features.is_repeat) {
      baseRate *= 1.5;
    }

    return Math.min(1.0, baseRate);
  }

  /**
   * Build all features for an issue
   */
  static buildFeatures(normalizedData) {
    const { features, issue_id, domain, type } = normalizedData;

    const impact = this.calculateImpact(features, type);
    const urgency = this.calculateUrgency(features, type);
    const risk = this.calculateRisk(features, type);
    const time = this.calculateTime(features);
    const context = this.calculateContext(features, type);
    const deterioration = this.calculateDeterioration(features, type);

    return {
      issue_id,
      domain,
      type,
      features,
      
      impact,
      urgency,
      risk,
      time,
      context,
      deterioration,
      
      // Raw scores for breakdown
      scores: {
        impact: Math.round(impact.score * 100),
        urgency: Math.round(urgency.score * 100),
        risk: Math.round(risk.score * 100),
        time: Math.round(time.score * 100),
        context: Math.round(context.score * 100),
        deterioration: deterioration
      }
    };
  }
}

module.exports = FeatureBuilder;
