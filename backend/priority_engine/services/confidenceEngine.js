/**
 * Confidence Engine
 * Determines how sure the system is about its assessment
 * 
 * KEY PRINCIPLES:
 * - Priority and Confidence are INDEPENDENT
 * - High priority + Low confidence = VERIFY (not suppressed priority)
 * - Critical priority issues ALWAYS need action, even with low confidence
 * - Confidence affects HOW we act, not WHETHER we act
 */

class ConfidenceEngine {
  /**
   * Calculate overall confidence score (0-100)
   * Based on evidence quality and data completeness
   */
  static calculateConfidence(normalizedData, features) {
    const { features: f } = normalizedData;
    
    // Evidence weights
    const weights = {
      gps: 0.15,
      photo: 0.20,
      reports: 0.25,
      verification: 0.25,
      freshness: 0.15
    };

    // GPS/Location confidence
    const gpsScore = f.has_gps;
    
    // Photo evidence score
    const photoScore = f.has_photo ? 0.8 : 0.2;
    
    // Multiple reports score
    const reportsScore = Math.min(1.0, f.reports * 0.15 + 0.3);
    
    // Supervisor verification score (0.5 if not available)
    const verificationScore = 0.5;
    
    // Freshness score
    const freshnessScore = Math.max(0.3, 1.0 - f.age * 0.5);

    // Calculate overall confidence
    const confidence = (
      weights.gps * gpsScore +
      weights.photo * photoScore +
      weights.reports * reportsScore +
      weights.verification * verificationScore +
      weights.freshness * freshnessScore
    );

    const confidencePercent = Math.round(confidence * 100);

    return {
      score: confidencePercent,
      breakdown: {
        gps: Math.round(gpsScore * 100),
        photo: Math.round(photoScore * 100),
        reports: Math.round(reportsScore * 100),
        verification: Math.round(verificationScore * 100),
        freshness: Math.round(freshnessScore * 100)
      },
      level: this.getConfidenceLevel(confidencePercent)
    };
  }

  /**
   * Get confidence level category
   */
  static getConfidenceLevel(score) {
    if (score >= 85) return 'HIGH';
    if (score >= 60) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Determine action based on PRIORITY and CONFIDENCE
   * 
   * CRITICAL priority (90+): 
   *   - Always ACT, even with low confidence
   *   - Low confidence means send verification team WITH action team
   * 
   * HIGH priority (75-89):
   *   - High confidence = ACT
   *   - Low confidence = VERIFY (verify AND prepare for action)
   * 
   * MEDIUM priority (50-74):
   *   - High confidence = SCHEDULE
   *   - Low confidence = MONITOR
   * 
   * LOW priority (<50):
   *   - MONITOR or DEFER
   */
  static determineAction(priorityScore, priorityBand, confidenceScore, features) {
    const HIGH_CONFIDENCE = 70;
    const MEDIUM_CONFIDENCE = 60;

    // CRITICAL priority - always act, but verify concurrently if low confidence
    if (priorityBand === 'CRITICAL') {
      if (confidenceScore >= HIGH_CONFIDENCE) {
        return {
          action: 'ACT',
          description: 'Critical priority with strong evidence - deploy immediately',
          caution: null,
          reason_codes: ['CRITICAL_PRIORITY', 'HIGH_CONFIDENCE']
        };
      } else if (confidenceScore >= MEDIUM_CONFIDENCE) {
        return {
          action: 'ACT',
          description: 'Critical priority - act immediately, verification in parallel',
          caution: 'Evidence is moderate - verify concurrently',
          reason_codes: ['CRITICAL_PRIORITY', 'MEDIUM_CONFIDENCE']
        };
      } else {
        return {
          action: 'ACT_VERIFY',
          description: 'Critical priority - emergency deployment with concurrent verification',
          caution: 'Low confidence but critical severity prevents delay',
          reason_codes: ['CRITICAL_PRIORITY', 'LOW_CONFIDENCE']
        };
      }
    }

    // HIGH priority
    if (priorityBand === 'HIGH') {
      if (confidenceScore >= HIGH_CONFIDENCE) {
        return {
          action: 'ACT',
          description: 'High priority with strong evidence - deploy immediately',
          caution: null,
          reason_codes: ['HIGH_PRIORITY', 'HIGH_CONFIDENCE']
        };
      } else {
        return {
          action: 'VERIFY_PREPARE',
          description: 'High priority with weak evidence - verify then act',
          caution: 'Evidence gathering required before full deployment',
          reason_codes: ['HIGH_PRIORITY', 'LOW_CONFIDENCE']
        };
      }
    }

    // MEDIUM priority
    if (priorityBand === 'MEDIUM') {
      if (confidenceScore >= MEDIUM_CONFIDENCE) {
        return {
          action: 'SCHEDULE',
          description: 'Medium priority with acceptable evidence - schedule for action',
          caution: null,
          reason_codes: ['MEDIUM_PRIORITY', 'ADEQUATE_CONFIDENCE']
        };
      } else {
        return {
          action: 'MONITOR',
          description: 'Medium priority with weak evidence - monitor for more reports',
          caution: 'Gathering additional evidence before committing resources',
          reason_codes: ['MEDIUM_PRIORITY', 'LOW_CONFIDENCE']
        };
      }
    }

    // LOW/MINIMAL priority
    return {
      action: priorityScore < 25 ? 'DEFER' : 'MONITOR',
      description: priorityScore < 25 ? 
        'Low priority - can be deferred' : 
        'Low priority - continue monitoring',
      caution: null,
      reason_codes: ['LOW_PRIORITY']
    };
  }

  /**
   * Calculate evidence strength for duplicate detection
   * Multiple reports = stronger evidence, NOT higher priority
   */
  static calculateEvidenceStrength(normalizedData) {
    const { features } = normalizedData;
    
    let strength = 0.3;
    
    if (features.has_gps) strength += 0.15;
    if (features.has_photo) strength += 0.20;
    if (features.reports >= 3) strength += 0.15;
    if (features.reports >= 10) strength += 0.10;
    if (features.is_repeat) strength += 0.10;
    
    return Math.min(1.0, strength);
  }

  /**
   * Get missing data warnings
   */
  static getMissingData(normalizedData) {
    const missing = [];
    const { features, raw } = normalizedData;

    if (!features.has_gps) {
      missing.push({ field: 'location', issue: 'No GPS coordinates provided' });
    }
    if (!features.has_photo) {
      missing.push({ field: 'photo', issue: 'No photo evidence available' });
    }
    if (raw.citizen_reports < 2) {
      missing.push({ field: 'reports', issue: 'Single report only' });
    }
    if (!raw.severity) {
      missing.push({ field: 'severity', issue: 'Severity not specified' });
    }
    if (features.age > 0.7) {
      missing.push({ field: 'freshness', issue: 'Report is more than 20 days old' });
    }

    return missing;
  }

  /**
   * Build complete confidence analysis
   */
  static analyze(normalizedData, features, priorityScore, priorityBand) {
    const confidence = this.calculateConfidence(normalizedData, features);
    const evidenceStrength = this.calculateEvidenceStrength(normalizedData);
    const missingData = this.getMissingData(normalizedData);
    
    // Determine action based on priority + confidence
    const actionStrategy = this.determineAction(
      priorityScore, 
      priorityBand,
      confidence.score, 
      normalizedData.features
    );

    return {
      confidence,
      evidenceStrength,
      missing_data: missingData,
      action_strategy: actionStrategy,
      canProceed: confidence.score >= 60 || priorityBand === 'CRITICAL',
      needsVerification: missingData.length > 2 || (missingData.length > 0 && confidence.score < 60)
    };
  }
}

module.exports = ConfidenceEngine;
