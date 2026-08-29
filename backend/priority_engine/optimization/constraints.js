/**
 * Constraints Module
 * 
 * Defines all constraints for the batch optimization problem:
 * - Resource constraints (workers, vehicles, equipment)
 * - Temporal constraints (deadlines, deterioration windows)
 * - Priority constraints (minimum thresholds)
 * - Mutual exclusion constraints
 * - Dependency constraints
 */

class Constraints {
  /**
   * Check if adding an action would violate any constraints
   */
  static canAddAction(action, currentPlan, resourcePool, allIssues) {
    const violations = [];
    
    // Check resource constraints
    const resourceViolation = this.checkResourceConstraints(action, currentPlan, resourcePool);
    if (resourceViolation) {
      violations.push(resourceViolation);
    }
    
    // Check temporal constraints
    const temporalViolation = this.checkTemporalConstraints(action, currentPlan, allIssues);
    if (temporalViolation) {
      violations.push(temporalViolation);
    }
    
    // Check mutual exclusion
    const exclusionViolation = this.checkMutualExclusion(action, currentPlan);
    if (exclusionViolation) {
      violations.push(exclusionViolation);
    }
    
    return {
      canAdd: violations.length === 0,
      violations
    };
  }

  /**
   * Check resource constraints
   */
  static checkResourceConstraints(action, currentPlan, resourcePool) {
    const resources = action.resources || {};
    const workersNeeded = resources.workers || 0;
    const vehiclesNeeded = resources.vehicles || 0;
    const equipmentNeeded = resources.equipment || [];
    
    // Calculate current utilization
    let currentWorkers = 0;
    let currentVehicles = 0;
    const usedEquipment = new Set();
    
    currentPlan.forEach(planned => {
      const plannedResources = planned.resources || {};
      currentWorkers += plannedResources.workers || 0;
      currentVehicles += plannedResources.vehicles || 0;
      (plannedResources.equipment || []).forEach(eq => usedEquipment.add(eq));
    });
    
    // Check workers
    if (currentWorkers + workersNeeded > resourcePool.workers) {
      return {
        type: 'RESOURCE',
        resource: 'workers',
        needed: workersNeeded,
        available: resourcePool.workers - currentWorkers,
        totalNeeded: currentWorkers + workersNeeded,
        message: `Insufficient workers: need ${workersNeeded}, only ${resourcePool.workers - currentWorkers} available`
      };
    }
    
    // Check vehicles
    if (currentVehicles + vehiclesNeeded > resourcePool.vehicles) {
      return {
        type: 'RESOURCE',
        resource: 'vehicles',
        needed: vehiclesNeeded,
        available: resourcePool.vehicles - currentVehicles,
        totalNeeded: currentVehicles + vehiclesNeeded,
        message: `Insufficient vehicles: need ${vehiclesNeeded}, only ${resourcePool.vehicles - currentVehicles} available`
      };
    }
    
    // Check equipment
    const unavailableEquipment = equipmentNeeded.filter(eq => {
      // Check if equipment type is available
      const equipmentStatus = resourcePool.equipment?.[eq];
      if (equipmentStatus === 'unavailable' || equipmentStatus === 'broken') {
        return true;
      }
      // Check if already used
      if (usedEquipment.has(eq)) {
        return true;
      }
      return false;
    });
    
    if (unavailableEquipment.length > 0) {
      return {
        type: 'RESOURCE',
        resource: 'equipment',
        equipment: unavailableEquipment,
        message: `Equipment unavailable: ${unavailableEquipment.join(', ')}`
      };
    }
    
    return null;
  }

  /**
   * Check temporal constraints
   */
  static checkTemporalConstraints(action, currentPlan, allIssues) {
    // Check deadline
    if (action.deadline && currentPlan.length > 0) {
      const currentEndTime = this.calculateEndTime(currentPlan);
      if (currentEndTime > action.deadline) {
        return {
          type: 'TEMPORAL',
          deadline: action.deadline,
          estimatedEnd: currentEndTime,
          message: `Would exceed deadline: ${action.deadline}h`
        };
      }
    }
    
    // Check deterioration window
    if (action.temporal?.deteriorationDeadline !== undefined) {
      const hoursRemaining = action.temporal.deteriorationDeadline;
      
      // Calculate if we can complete before deterioration
      const estimatedDuration = action.resources?.hours || 2;
      const currentEndTime = this.calculateEndTime(currentPlan);
      
      if (currentEndTime + estimatedDuration > hoursRemaining) {
        return {
          type: 'TEMPORAL',
          deadline: hoursRemaining,
          estimatedEnd: currentEndTime + estimatedDuration,
          urgency: action.temporal.urgency,
          message: `Deterioration window closing: ${hoursRemaining}h remaining, ${estimatedDuration}h needed`
        };
      }
    }
    
    return null;
  }

  /**
   * Check mutual exclusion constraints
   */
  static checkMutualExclusion(action, currentPlan) {
    // Check if same issue already has an action
    const existingAction = currentPlan.find(a => a.issueId === action.issueId);
    if (existingAction) {
      return {
        type: 'EXCLUSION',
        issueId: action.issueId,
        existingAction: existingAction.type,
        attemptedAction: action.type,
        message: `Issue ${action.issueId} already has action ${existingAction.type}`
      };
    }
    
    // Check for conflicting locations (same crew can't be in two places)
    if (action.location && currentPlan.length > 0) {
      const conflicting = currentPlan.find(a => 
        a.location && 
        this.isNearby(a.location, action.location) &&
        this.overlaps(a, action)
      );
      
      if (conflicting) {
        return {
          type: 'EXCLUSION',
          reason: 'LOCATION_CONFLICT',
          issueA: conflicting.issueId,
          issueB: action.issueId,
          message: `Geographic conflict: ${conflicting.issueId} and ${action.issueId} too close for same crew`
        };
      }
    }
    
    return null;
  }

  /**
   * Calculate end time of current plan
   */
  static calculateEndTime(currentPlan) {
    // Simple model: assume sequential execution
    let time = 0;
    currentPlan.forEach(action => {
      time += action.resources?.hours || 2;
    });
    return time;
  }

  /**
   * Check if two locations are nearby
   */
  static isNearby(loc1, loc2) {
    if (!loc1 || !loc2) return false;
    
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(loc2.lat - loc1.lat);
    const dLon = this.toRad(loc2.lon - loc1.lon);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRad(loc1.lat)) * Math.cos(this.toRad(loc2.lat)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return distance < 2; // Within 2km
  }

  /**
   * Check if two actions overlap in time
   */
  static overlaps(action1, action2) {
    // Simplified: assume same crew can't handle two tasks simultaneously
    // More sophisticated model would track crew assignments
    return true; // Placeholder
  }

  /**
   * Convert degrees to radians
   */
  static toRad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Get all constraint violations for a proposed plan
   */
  static validatePlan(plan, resourcePool, allIssues) {
    const violations = [];
    
    for (let i = 0; i < plan.length; i++) {
      const action = plan[i];
      const subPlan = plan.slice(0, i);
      const violation = this.canAddAction(action, subPlan, resourcePool, allIssues);
      
      if (!violation.canAdd) {
        violations.push({
          actionIndex: i,
          issueId: action.issueId,
          ...violation
        });
      }
    }
    
    return {
      isValid: violations.length === 0,
      violations
    };
  }

  /**
   * Find conflicts between actions in a plan
   */
  static findConflicts(plan) {
    const conflicts = [];
    
    // Group by shared resources
    const resourceUsage = new Map();
    
    plan.forEach((action, index) => {
      const resources = action.resources || {};
      
      // Check workers
      const workerKey = `workers_${action.issueId}`;
      if (resourceUsage.has(workerKey)) {
        conflicts.push({
          type: 'WORKER_CONFLICT',
          actions: [resourceUsage.get(workerKey), index],
          message: 'Both actions require workers simultaneously'
        });
      } else {
        resourceUsage.set(workerKey, index);
      }
      
      // Check equipment
      (resources.equipment || []).forEach(eq => {
        const eqKey = `equipment_${eq}`;
        if (resourceUsage.has(eqKey)) {
          conflicts.push({
            type: 'EQUIPMENT_CONFLICT',
            equipment: eq,
            actions: [resourceUsage.get(eqKey), index],
            message: `Both actions require ${eq}`
          });
        } else {
          resourceUsage.set(eqKey, index);
        }
      });
    });
    
    return conflicts;
  }

  /**
   * Resolve conflicts by priority
   */
  static resolveConflict(conflict, plan) {
    const [actionA, actionB] = conflict.actions;
    
    const priorityA = plan[actionA]?.priority?.score || 0;
    const priorityB = plan[actionB]?.priority?.score || 0;
    
    // Higher priority wins
    if (priorityA >= priorityB) {
      return { winner: actionA, loser: actionB };
    } else {
      return { winner: actionB, loser: actionA };
    }
  }
}

module.exports = { Constraints };
