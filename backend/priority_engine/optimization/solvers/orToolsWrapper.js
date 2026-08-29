/**
 * OR-Tools Solver Wrapper
 * 
 * Wrapper for the Python OR-Tools solver.
 * Falls back to greedy solver if OR-Tools is not available.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class OrToolsSolver {
  constructor(problem) {
    this.problem = problem;
    this.solverPath = path.join(__dirname, 'orToolsSolver.py');
    this.isAvailable = null;
  }

  /**
   * Check if OR-Tools Python solver is available
   */
  static async checkAvailability() {
    return new Promise((resolve) => {
      const python = spawn('python3', ['--version']);
      python.on('close', (code) => {
        resolve(code === 0);
      });
      python.on('error', () => resolve(false));
    });
  }

  /**
   * Prepare problem data for OR-Tools
   */
  prepareProblem() {
    const { availableResources, actionableIssues, timeHorizon } = this.problem;

    // Transform actionable issues to what OR-Tools expects
    const transformedIssues = actionableIssues.map((issue, idx) => {
      // Get the best action for this issue
      const primaryAction = issue.possibleActions?.find(a => a.isPrimary) || 
                          { type: 'ACT', resources: issue.resourceRequirements?.ACT || {} };
      
      // Get ECV from objective builder or estimate
      const ecv = issue.ecv || this.estimateECV(issue);

      // Get resources for primary action
      const resources = this.getResourcesForAction(issue, primaryAction.type);

      return {
        issue_id: issue.issueId,
        issue_type: issue.issueType,
        action_type: primaryAction.type,
        priority_score: issue.priority?.score || 50,
        priority_band: issue.priority?.band || 'MEDIUM',
        confidence: issue.confidence?.score || 50,
        ecv,
        workers_needed: resources.workers,
        vehicles_needed: resources.vehicles,
        hours_needed: resources.hours,
        equipment_needed: resources.equipment,
        deadline: issue.temporal?.deteriorationDeadline || timeHorizon
      };
    });

    return {
      availableResources: {
        available_workers: availableResources?.available_workers || 10,
        available_vehicles: availableResources?.available_vehicles || 5,
        equipment_status: availableResources?.equipment_status || {}
      },
      actionableIssues: transformedIssues,
      timeHorizon: timeHorizon || 8
    };
  }

  /**
   * Estimate ECV if not already calculated
   */
  estimateECV(issue) {
    const priority = issue.priority || { score: 50, band: 'MEDIUM' };
    const confidence = issue.confidence || { score: 50 };
    
    // Simple ECV estimate: priority × confidence factor
    const confidenceFactor = confidence.score >= 70 ? 1.0 :
                           confidence.score >= 50 ? 0.8 : 0.6;
    
    // CRITICAL band gets a boost
    const bandBoost = priority.band === 'CRITICAL' ? 1.2 :
                     priority.band === 'HIGH' ? 1.1 : 1.0;
    
    return (priority.score / 100) * confidenceFactor * bandBoost * 100;
  }

  /**
   * Get resources for an action type
   */
  getResourcesForAction(issue, actionType) {
    const resources = issue.resourceRequirements || {};

    switch (actionType) {
      case 'ACT':
      case 'FULL_DEPLOY':
        return {
          workers: resources.workers_preferred || resources.workers_min || 3,
          vehicles: resources.vehicles || 1,
          hours: resources.hours || 4,
          equipment: resources.equipment || []
        };
      
      case 'ACT_PARTIAL':
        return {
          workers: resources.workers_min || 2,
          vehicles: Math.ceil((resources.vehicles || 0) / 2),
          hours: Math.ceil((resources.hours || 4) * 0.6),
          equipment: (resources.equipment || []).slice(0, 1)
        };
      
      case 'VERIFY':
        return { workers: 1, vehicles: 0, hours: 2, equipment: [] };
      
      case 'SCHEDULE':
      case 'MONITOR':
        return { workers: 0, vehicles: 0, hours: 0, equipment: [] };
      
      case 'ESCALATE':
        return { workers: 1, vehicles: 1, hours: 1, equipment: [] };
      
      default:
        return { workers: 2, vehicles: 1, hours: 3, equipment: [] };
    }
  }

  /**
   * Solve using OR-Tools
   */
  async solve() {
    return new Promise(async (resolve) => {
      // Check availability first
      if (this.isAvailable === null) {
        this.isAvailable = await OrToolsSolver.checkAvailability();
      }

      if (!this.isAvailable) {
        resolve({
          error: true,
          message: 'OR-Tools not available. Install with: pip install ortools',
          solver: 'OR_TOOLS',
          fallback: 'GREEDY'
        });
        return;
      }

      try {
        const problemData = this.prepareProblem();
        const problemJson = JSON.stringify(problemData);

        const python = spawn('python3', [this.solverPath], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        python.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        python.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        python.on('close', (code) => {
          if (code === 0 && stdout) {
            try {
              const result = JSON.parse(stdout);
              resolve({
                ...result,
                solver: 'OR_TOOLS',
                fallback: null
              });
            } catch (e) {
              resolve({
                error: true,
                message: 'Failed to parse OR-Tools output',
                details: stdout,
                solver: 'OR_TOOLS',
                fallback: 'GREEDY'
              });
            }
          } else {
            resolve({
              error: true,
              message: 'OR-Tools solver failed',
              details: stderr || stdout,
              solver: 'OR_TOOLS',
              fallback: 'GREEDY'
            });
          }
        });

        python.on('error', (err) => {
          resolve({
            error: true,
            message: `Failed to start OR-Tools: ${err.message}`,
            solver: 'OR_TOOLS',
            fallback: 'GREEDY'
          });
        });

        // Send problem to Python
        python.stdin.write(problemJson);
        python.stdin.end();

        // Timeout after 30 seconds
        setTimeout(() => {
          python.kill();
          resolve({
            error: true,
            message: 'OR-Tools solver timed out',
            solver: 'OR_TOOLS',
            fallback: 'GREEDY'
          });
        }, 30000);

      } catch (err) {
        resolve({
          error: true,
          message: err.message,
          solver: 'OR_TOOLS',
          fallback: 'GREEDY'
        });
      }
    });
  }

  /**
   * Compare with greedy solver
   */
  async compareWithGreedy(greedyResult) {
    const orToolsResult = await this.solve();

    if (orToolsResult.error) {
      return {
        comparison: null,
        orToolsResult,
        greedyResult,
        message: 'OR-Tools comparison failed - using greedy result',
        bestSolver: 'GREEDY'
      };
    }

    const orToolsECV = orToolsResult.objectiveValue || 0;
    const greedyECV = greedyResult.objectiveValue || 0;
    const improvement = greedyECV > 0 ? 
      ((orToolsECV - greedyECV) / greedyECV) * 100 : 0;

    return {
      comparison: {
        orTools: {
          objectiveValue: orToolsECV,
          selectedCount: orToolsResult.selectedActions?.length || 0,
          statistics: orToolsResult.statistics
        },
        greedy: {
          objectiveValue: greedyECV,
          selectedCount: greedyResult.selectedActions?.length || 0
        },
        improvement: {
          absolute: orToolsECV - greedyECV,
          percent: Math.round(improvement * 100) / 100
        },
        verdict: improvement > 5 ? 'OR-TOOLS BETTER' :
                improvement < -5 ? 'GREEDY BETTER' : 'EQUIVALENT'
      },
      orToolsResult,
      greedyResult,
      bestSolver: improvement > 0 ? 'OR_TOOLS' : 'GREEDY'
    };
  }
}

module.exports = OrToolsSolver;
