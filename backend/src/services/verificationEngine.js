/**
 * Misinformation Detection & Fact-Checking Engine
 * Cross-references complaints against official/mock data sources
 */

const mockData = require('../data/mockVerificationData');

class VerificationEngine {
  constructor() {
    this.claimPatterns = {
      water: ['water', 'contaminat', 'dirty', 'unsafe', 'bacteria', 'drinking water', 'pipeline'],
      transport: ['bus', 'route', 'cancelled', 'transport', 'msrtc', 'stop'],
      food: ['food', 'poison', 'contaminat', 'batch', 'expired', 'unsafe'],
      health: ['screening', 'health camp', 'medical', 'disease', 'epidemic'],
      scheme: ['scheme', 'subsidy', 'government', 'benefits', 'yojana']
    };
  }

  /**
   * Main verification function - checks a complaint against all data sources
   */
  async verifyComplaint(complaint) {
    const { complaint_text, category, ward, location } = complaint;
    const text = (complaint_text || '').toLowerCase();
    
    const results = {
      verified: false,
      claimType: null,
      matchesFound: [],
      verificationStatus: 'UNVERIFIED',
      factCheck: null,
      confidence: 0,
      warnings: [],
      recommendations: []
    };

    // Check water-related claims
    if (this.matchesCategory(text, this.claimPatterns.water)) {
      const waterResult = this.checkWaterClaim(ward, text);
      results.matchesFound.push(waterResult);
      if (waterResult.isMatch) {
        results.claimType = 'water';
      }
    }

    // Check transport-related claims
    if (this.matchesCategory(text, this.claimPatterns.transport)) {
      const transportResult = this.checkTransportClaim(text);
      results.matchesFound.push(transportResult);
      if (transportResult.isMatch) {
        results.claimType = 'transport';
      }
    }

    // Check food-related claims
    if (this.matchesCategory(text, this.claimPatterns.food)) {
      const foodResult = this.checkFoodClaim(text);
      results.matchesFound.push(foodResult);
      if (foodResult.isMatch) {
        results.claimType = 'food';
      }
    }

    // Check health-related claims
    if (this.matchesCategory(text, this.claimPatterns.health)) {
      const healthResult = this.checkHealthClaim(text);
      results.matchesFound.push(healthResult);
      if (healthResult.isMatch) {
        results.claimType = 'health';
      }
    }

    // Check for known false claims
    const falseClaimMatch = this.checkAgainstFalseClaims(text);
    if (falseClaimMatch) {
      results.factCheck = falseClaimMatch;
      results.verificationStatus = 'FALSE_CLAIM';
      results.confidence = 0.95;
      results.warnings.push({
        level: 'HIGH',
        message: 'This claim matches a known false rumor'
      });
    }

    // Calculate overall verification status
    results.verificationStatus = this.calculateStatus(results);
    
    return results;
  }

  /**
   * Check water-related claims against official data
   */
  checkWaterClaim(ward, text) {
    const waterData = mockData.waterQualityData;
    const wardKey = ward || 'ward_1';
    const stationData = waterData.stations[wardKey] || waterData.stations['ward_1'];

    // Check if claim mentions contamination
    const mentionsContamination = text.includes('contaminat') || 
                                text.includes('dirty') || 
                                text.includes('unsafe') ||
                                text.includes('bacteria');

    if (!mentionsContamination) {
      return { isMatch: false, type: 'water', status: 'NOT_APPLICABLE' };
    }

    // Compare with official data
    if (stationData.status === 'SAFE') {
      return {
        isMatch: true,
        type: 'water',
        status: 'CONTRADICTS_DATA',
        officialStatus: stationData.status,
        officialData: stationData,
        message: `Official data shows water in this area is ${stationData.status}. Last tested: ${stationData.lastTest}`,
        truth: `Water quality meets BIS standards. ${stationData.notes}`,
        riskLevel: stationData.contaminationLevel === 'LOW' ? 'HIGH' : 'MEDIUM'
      };
    } else if (stationData.status === 'CAUTION') {
      return {
        isMatch: true,
        type: 'water',
        status: 'PARTIALLY_VERIFIED',
        officialStatus: stationData.status,
        officialData: stationData,
        message: `Area is under ${stationData.status} - investigation ongoing`,
        truth: `${stationData.notes}`,
        riskLevel: 'LOW'
      };
    }

    return { isMatch: false, type: 'water', status: 'NO_MATCH' };
  }

  /**
   * Check transport-related claims
   */
  checkTransportClaim(text) {
    const transportData = mockData.transportData;
    
    // Check for route-specific claims
    const routeMatch = text.match(/KOP-[A-Z]{2,4}/i) || text.match(/route\s+([a-z]+)/i);
    const mentionsCancellation = text.includes('cancel') || text.includes('stop');
    
    if (routeMatch || mentionsCancellation) {
      // Check all routes
      for (const [routeId, routeData] of Object.entries(transportData.routes)) {
        if (text.includes(routeId) || text.includes(routeId.replace('KOP-', ''))) {
          if (routeData.status === 'ACTIVE' && mentionsCancellation) {
            return {
              isMatch: true,
              type: 'transport',
              status: 'CONTRADICTS_DATA',
              officialStatus: routeData.status,
              routeData,
              message: `Route ${routeId} is ${routeData.status}`,
              truth: `${routeData.status}: Service every ${routeData.frequency}`,
              riskLevel: 'HIGH'
            };
          }
        }
      }
    }

    return { isMatch: false, type: 'transport', status: 'NO_MATCH' };
  }

  /**
   * Check food-related claims
   */
  checkFoodClaim(text) {
    const foodData = mockData.foodSafetyData;
    
    const mentionsBatch = text.match(/batch/i);
    const mentionsPoisoning = text.includes('poison') || text.includes('contamination');
    
    if (mentionsPoisoning) {
      // Check recent alerts
      for (const alert of foodData.alerts) {
        if (alert.type === 'RECALL' && alert.status === 'RESOLVED') {
          return {
            isMatch: true,
            type: 'food',
            status: 'OUTDATED_ALERT',
            alertData: alert,
            message: `Previous alert was issued but is now RESOLVED`,
            truth: `${alert.product}: ${alert.notes}`,
            riskLevel: 'MEDIUM'
          };
        }
      }
    }

    return { isMatch: false, type: 'food', status: 'NO_MATCH' };
  }

  /**
   * Check health-related claims
   */
  checkHealthClaim(text) {
    const healthData = mockData.healthData;
    
    const mentionsEpidemic = text.includes('epidemic') || 
                            text.includes('outbreak') ||
                            text.includes('disease spread');
    
    if (mentionsEpidemic) {
      // Check for active health alerts
      for (const alert of healthData.alerts) {
        if (alert.type === 'SEASONAL' && alert.message.toLowerCase().includes('monsoon')) {
          return {
            isMatch: true,
            type: 'health',
            status: 'PARTIALLY_VERIFIED',
            alertData: alert,
            message: `Seasonal advisory in effect but no epidemic declared`,
            truth: `${alert.message}. Precautions: ${alert.precautions.join(', ')}`,
            riskLevel: 'LOW'
          };
        }
      }
    }

    return { isMatch: false, type: 'health', status: 'NO_MATCH' };
  }

  /**
   * Check against known false claims database
   */
  checkAgainstFalseClaims(text) {
    const falseClaims = mockData.falseClaimsDatabase;
    
    for (const claim of falseClaims) {
      const claimLower = claim.claim.toLowerCase();
      if (text.includes(claimLower.replace(/"/g, ''))) {
        return {
          isKnownFalseClaim: true,
          claimId: claim.id,
          originalClaim: claim.claim,
          truth: claim.truth,
          factCheckDate: claim.factCheckDate,
          verifiedBy: claim.verifiedBy,
          spreadCount: claim.spreadCount,
          warning: `This claim is known to be false. ${claim.truth}`
        };
      }
    }
    
    return null;
  }

  /**
   * Pattern detection for coordinated fake submissions
   */
  async detectCoordinatedFakes(complaints) {
    const analysis = {
      hasCoordinatedPattern: false,
      suspiciousClusters: [],
      flags: []
    };

    // Group complaints by various attributes
    const byPhone = this.groupBy(complaints, 'citizenPhone');
    const byWard = this.groupBy(complaints, 'ward');
    const byText = this.groupBy(complaints, 'complaint_text');
    const byTime = this.groupByByTime(complaints, 60); // 60 minute windows

    // Check for phone number reuse
    for (const [phone, group] of Object.entries(byPhone)) {
      if (group.length > 3) {
        analysis.suspiciousClusters.push({
          type: 'PHONE_REUSE',
          identifier: phone,
          count: group.length,
          severity: group.length > 5 ? 'HIGH' : 'MEDIUM',
          complaintIds: group.map(c => c.complaint_id)
        });
        analysis.hasCoordinatedPattern = true;
      }
    }

    // Check for burst submissions (many complaints in short time)
    for (const [timeWindow, group] of Object.entries(byTime)) {
      if (group.length > 5) {
        analysis.suspiciousClusters.push({
          type: 'BURST_SUBMISSION',
          identifier: timeWindow,
          count: group.length,
          severity: 'HIGH',
          complaintIds: group.map(c => c.complaint_id)
        });
        analysis.hasCoordinatedPattern = true;
      }
    }

    // Check for duplicate text from different phones
    for (const [text, group] of Object.entries(byText)) {
      const uniquePhones = new Set(group.map(c => c.citizenPhone));
      if (group.length > 2 && uniquePhones.size > 1) {
        analysis.suspiciousClusters.push({
          type: 'DUPLICATE_TEXT_DIFFERENT_PHONES',
          identifier: text.substring(0, 50) + '...',
          count: group.length,
          severity: group.length > 3 ? 'HIGH' : 'MEDIUM',
          uniquePhones: Array.from(uniquePhones).slice(0, 5),
          complaintIds: group.map(c => c.complaint_id)
        });
        analysis.hasCoordinatedPattern = true;
      }
    }

    return analysis;
  }

  /**
   * Calculate overall verification status
   */
  calculateStatus(results) {
    if (results.verificationStatus === 'FALSE_CLAIM') {
      return 'FALSE_CLAIM';
    }
    
    const matches = results.matchesFound.filter(m => m.isMatch);
    if (matches.length === 0) {
      return 'UNVERIFIED';
    }

    const contradictions = matches.filter(m => m.status === 'CONTRADICTS_DATA');
    if (contradictions.length > 0) {
      const highRisk = contradictions.some(m => m.riskLevel === 'HIGH');
      return highRisk ? 'LIKELY_FALSE' : 'NEEDS_REVIEW';
    }

    const partial = matches.filter(m => m.status === 'PARTIALLY_VERIFIED');
    if (partial.length > 0) {
      return 'PARTIALLY_VERIFIED';
    }

    return 'VERIFIED';
  }

  /**
   * Helper: Check if text matches category patterns
   */
  matchesCategory(text, patterns) {
    return patterns.some(pattern => text.includes(pattern));
  }

  /**
   * Helper: Group array by key
   */
  groupBy(array, key) {
    return array.reduce((groups, item) => {
      const value = item[key] || 'unknown';
      if (!groups[value]) groups[value] = [];
      groups[value].push(item);
      return groups;
    }, {});
  }

  /**
   * Helper: Group by time window
   */
  groupByByTime(array, minutes) {
    return array.reduce((groups, item) => {
      const time = new Date(item.createdAt).getTime();
      const windowStart = Math.floor(time / (minutes * 60 * 1000)) * (minutes * 60 * 1000);
      const key = new Date(windowStart).toISOString();
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
      return groups;
    }, {});
  }
}

module.exports = new VerificationEngine();
