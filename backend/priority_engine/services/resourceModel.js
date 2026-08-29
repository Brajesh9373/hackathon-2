/**
 * Resource Requirement Model
 * Estimates what resources are needed to resolve an issue
 * Separates REQUIRED (minimum) from RECOMMENDED (optimal) resources
 */

class ResourceModel {
  /**
   * Base resource requirements by issue type
   * Structure: workers_min, workers_preferred, vehicles
   */
  static BASE_REQUIREMENTS = {
    'pothole': { 
      workers_min: 2, workers_preferred: 2, vehicles: 0, hours: 2, 
      equipment: ['road_tools'] 
    },
    'road_damage': { 
      workers_min: 2, workers_preferred: 3, vehicles: 1, hours: 4, 
      equipment: ['excavator', 'road_tools'] 
    },
    'blocked_drain': { 
      workers_min: 2, workers_preferred: 3, vehicles: 1, hours: 3, 
      equipment: ['drain_equipment', 'suction_machine'] 
    },
    'flooding': { 
      workers_min: 3, workers_preferred: 5, vehicles: 2, hours: 6, 
      equipment: ['water_pump', 'suction_machine', 'sandbags'] 
    },
    'sewage_overflow': { 
      workers_min: 3, workers_preferred: 4, vehicles: 1, hours: 4, 
      equipment: ['drain_equipment', 'suction_machine', 'disinfectant'] 
    },
    'streetlight': { 
      workers_min: 2, workers_preferred: 2, vehicles: 1, hours: 2, 
      equipment: ['electrical_tools'] 
    },
    'electrical': { 
      workers_min: 2, workers_preferred: 3, vehicles: 1, hours: 3, 
      equipment: ['electrical_tools', 'safety_gear'] 
    },
    'footpath': { 
      workers_min: 2, workers_preferred: 3, vehicles: 0, hours: 3, 
      equipment: ['construction_tools'] 
    },
    'water_leak': { 
      workers_min: 2, workers_preferred: 3, vehicles: 1, hours: 3, 
      equipment: ['pipe_tools', 'welding_equipment'] 
    },
    'default': { 
      workers_min: 2, workers_preferred: 2, vehicles: 0, hours: 2, 
      equipment: ['basic_tools'] 
    }
  };

  /**
   * Severity-based worker adjustment
   */
  static getSeverityWorkerAdjustment(severityScore) {
    // severityScore is 0-1
    if (severityScore >= 0.8) return { min: 1, preferred: 1 }; // +1 min, +1 preferred
    if (severityScore >= 0.6) return { min: 0, preferred: 1 }; // +0 min, +1 preferred
    if (severityScore >= 0.4) return { min: 0, preferred: 0 }; // no change
    return { min: -1, preferred: -1 }; // can reduce by 1
  }

  /**
   * Context-based adjustments (weather, facility, etc.)
   */
  static getContextWorkerAdjustment(features) {
    let min_adj = 0;
    let preferred_adj = 0;
    const reasons = [];

    // Bad weather = more workers preferred
    if (features.features.weather >= 0.6) {
      preferred_adj += 1;
      reasons.push('Adverse weather conditions');
    }
    
    // Critical facility = more careful, more workers
    if (features.features.facility_proximity >= 0.7) {
      min_adj += 1;
      preferred_adj += 1;
      reasons.push('Critical facility requires extra personnel');
    }
    
    // Repeat issue may need more work
    if (features.features.is_repeat) {
      preferred_adj += 1;
      reasons.push('Repeat issue may need additional work');
    }

    return { min_adj, preferred_adj, reasons };
  }

  /**
   * Calculate estimated resource requirements
   * Returns separate min and preferred values
   */
  static calculateRequirements(features, issueType) {
    const base = this.BASE_REQUIREMENTS[issueType] || this.BASE_REQUIREMENTS['default'];

    // Get severity adjustment
    const severityAdj = this.getSeverityWorkerAdjustment(features.features.severity);
    
    // Get context adjustment
    const contextAdj = this.getContextWorkerAdjustment(features);

    // Calculate workers
    const workers_min = Math.max(1, base.workers_min + severityAdj.min + contextAdj.min_adj);
    const workers_preferred = Math.max(1, base.workers_preferred + severityAdj.preferred + contextAdj.preferred_adj);

    // Calculate hours based on context
    let hoursMultiplier = 1.0;
    if (features.features.weather >= 0.6) hoursMultiplier *= 1.3;
    if (features.features.facility_proximity >= 0.7) hoursMultiplier *= 1.2;
    if (features.features.is_repeat) hoursMultiplier *= 1.15;

    const estimatedHours = Math.round(base.hours * hoursMultiplier * 10) / 10;

    // Equipment is required (not optional)
    const equipment_required = [...base.equipment];

    // Cost calculation
    const baseCost = 8000; // Default base cost
    const estimatedCost = Math.round(baseCost * hoursMultiplier);

    return {
      workers: {
        min: workers_min,
        preferred: workers_preferred,
        display: `${workers_min}-${workers_preferred}`
      },
      vehicles: {
        required: base.vehicles,
        optional: 0
      },
      equipment: {
        required: equipment_required,
        optional: []
      },
      estimated_hours: estimatedHours,
      estimated_cost: estimatedCost,
      adjustment_reasons: contextAdj.reasons
    };
  }

  /**
   * Check feasibility given available resources
   * Returns detailed feasibility analysis
   */
  static checkFeasibility(requirements, availableResources) {
    const { available_workers, available_vehicles, equipment_status } = availableResources;

    // Check minimum requirements
    const minWorkersFeasible = requirements.workers.min <= available_workers;
    const preferredWorkersFeasible = requirements.workers.preferred <= available_workers;
    const vehiclesFeasible = requirements.vehicles.required <= available_vehicles;

    // Equipment check
    const missingEquipment = requirements.equipment.required.filter(eq => 
      equipment_status?.[eq] === 'unavailable' || equipment_status?.[eq] === 'broken'
    );
    const equipmentFeasible = missingEquipment.length === 0;

    // Calculate feasibility score (0-100)
    let score = 100;
    
    // Worker shortage penalty
    if (!minWorkersFeasible) {
      score -= 40; // Major penalty for not meeting minimum
    } else if (!preferredWorkersFeasible) {
      score -= 15; // Minor penalty for not meeting preferred
    }

    // Vehicle shortage penalty
    if (!vehiclesFeasible) {
      score -= 25;
    }

    // Equipment penalty
    if (missingEquipment.length > 0) {
      score -= 20 * Math.min(1, missingEquipment.length / 2);
    }

    score = Math.max(0, Math.min(100, score));

    // Determine status
    let status;
    if (!minWorkersFeasible && !vehiclesFeasible) {
      status = 'BLOCKED';
    } else if (!minWorkersFeasible || !vehiclesFeasible) {
      status = 'PARTIAL';
    } else if (!preferredWorkersFeasible) {
      status = 'SUBOPTIMAL';
    } else if (missingEquipment.length > 0) {
      status = 'EQUIPMENT_LIMITED';
    } else {
      status = 'FEASIBLE';
    }

    // Calculate shortfall
    const shortfall = {
      workers: {
        needed_min: requirements.workers.min,
        needed_preferred: requirements.workers.preferred,
        available: available_workers,
        gap_min: Math.max(0, requirements.workers.min - available_workers),
        gap_preferred: Math.max(0, requirements.workers.preferred - available_workers)
      },
      vehicles: {
        needed: requirements.vehicles.required,
        available: available_vehicles,
        gap: Math.max(0, requirements.vehicles.required - available_vehicles)
      },
      equipment: {
        missing: missingEquipment
      }
    };

    return {
      feasible: status === 'FEASIBLE',
      score: score,
      status: status,
      worker_status: minWorkersFeasible ? (preferredWorkersFeasible ? 'OPTIMAL' : 'SUBOPTIMAL') : 'INSUFFICIENT',
      vehicle_status: vehiclesFeasible ? 'OK' : 'INSUFFICIENT',
      equipment_status: equipmentFeasible ? 'OK' : 'MISSING',
      shortfall
    };
  }

  /**
   * Generate alternative actions based on feasibility
   */
  static generateAlternatives(requirements, feasibility, issueType) {
    const alternatives = [];

    if (feasibility.status === 'BLOCKED') {
      alternatives.push({
        type: 'ESCALATE',
        description: 'Escalate to municipal admin for emergency resource allocation',
        priority: 'critical',
        reason_codes: ['RESOURCE_BLOCKED'],
        resource_tradeoff: 'Uses emergency reserve resources'
      });
      
      alternatives.push({
        type: 'DELEGATE',
        description: 'Request resources from another supervisor team',
        priority: 'high',
        reason_codes: ['RESOURCE_BLOCKED'],
        resource_tradeoff: 'Temporarily reduces another team capacity'
      });
      
      alternatives.push({
        type: 'PARTIAL_STABILIZE',
        description: 'Send team to assess and stabilize (not full repair)',
        priority: 'medium',
        reason_codes: ['RESOURCE_BLOCKED'],
        reduced_requirements: {
          workers_min: 1,
          estimated_hours: 1
        }
      });
    }

    if (feasibility.status === 'PARTIAL' || feasibility.status === 'SUBOPTIMAL') {
      alternatives.push({
        type: 'PARTIAL_FIX',
        description: 'Partial repair with available resources, full repair later',
        priority: 'medium',
        reason_codes: ['LIMITED_RESOURCES'],
        resource_tradeoff: 'Reduces scope but enables faster response',
        reduced_requirements: {
          workers: feasibility.worker_status === 'SUBOPTIMAL' ? requirements.workers.min : 1,
          estimated_hours: Math.ceil(requirements.estimated_hours * 0.6)
        }
      });

      alternatives.push({
        type: 'SCHEDULE',
        description: 'Schedule for when full resources are available',
        priority: 'normal',
        reason_codes: ['LIMITED_RESOURCES'],
        resource_tradeoff: 'Delay may increase severity or cost'
      });
    }

    if (feasibility.status === 'EQUIPMENT_LIMITED') {
      alternatives.push({
        type: 'REQUEST_EQUIPMENT',
        description: 'Request specific equipment before deployment',
        priority: 'medium',
        reason_codes: ['EQUIPMENT_MISSING'],
        equipment_needed: feasibility.shortfall.equipment.missing
      });
    }

    if (feasibility.feasible) {
      alternatives.push({
        type: 'FULL_DEPLOY',
        description: 'Deploy full team with optimal resources',
        priority: 'high',
        reason_codes: ['RESOURCES_AVAILABLE']
      });
    }

    return alternatives;
  }

  /**
   * Get resource summary for display
   */
  static getResourceSummary(requirements) {
    return {
      workers: requirements.workers.display,
      vehicles: requirements.vehicles.required,
      hours: requirements.estimated_hours,
      equipment: requirements.equipment.required.join(', ')
    };
  }
}

module.exports = ResourceModel;
