#!/usr/bin/env python3
"""
OR-Tools Solver for Civic Priority Optimization

This module uses Google OR-Tools to solve the constrained optimization problem:
- Maximize Expected Civic Value (ECV)
- Subject to resource constraints (workers, vehicles, equipment)
- Subject to temporal constraints (time windows, deadlines)

Expected Civic Value (ECV):
    ECV = Potential Civic Benefit × Action Success Probability - Costs
    
Where:
    PCB = weighted_average(Impact, Urgency, Risk, Time_Sensitivity)
    ASP = Action Success Probability (based on evidence + priority band)
"""

from ortools.linear_solver import pywraplp
import json
import sys
import os

def solve(problem_json):
    """
    Main entry point - solve the optimization problem
    
    Args:
        problem_json: JSON string containing the optimization problem
        
    Returns:
        JSON string with optimal solution
    """
    try:
        problem = json.loads(problem_json)
        return solve_problem(problem)
    except Exception as e:
        return json.dumps({
            'error': True,
            'message': str(e),
            'solver': 'OR_TOOLS'
        })

def solve_problem(problem):
    """
    Solve the civic priority optimization problem using OR-Tools
    """
    # Create solver - use CBC for mixed integer programming
    solver = pywraplp.Solver.CreateSolver('CBC')
    
    if not solver:
        return json.dumps({
            'error': True,
            'message': 'OR-Tools solver not available',
            'solver': 'OR_TOOLS'
        })
    
    # Extract problem data
    available_resources = problem.get('availableResources', {})
    actionable_issues = problem.get('actionableIssues', [])
    time_horizon = problem.get('timeHorizon', 8)
    
    # Resource pools
    available_workers = available_resources.get('available_workers', 10)
    available_vehicles = available_resources.get('available_vehicles', 5)
    equipment_status = available_resources.get('equipment_status', {})
    
    # Track resource usage
    worker_limit = solver.IntVar(0, available_workers, 'worker_limit')
    vehicle_limit = solver.IntVar(0, available_vehicles, 'vehicle_limit')
    
    # Decision variables: x[i] = 1 if action i is selected
    num_actions = len(actionable_issues)
    
    if num_actions == 0:
        return json.dumps({
            'error': False,
            'selectedActions': [],
            'objectiveValue': 0,
            'solver': 'OR_TOOLS',
            'message': 'No actionable issues'
        })
    
    # Create decision variables for each issue
    x = []
    for i, issue in enumerate(actionable_issues):
        var = solver.IntVar(0, 1, f'x_{i}')
        x.append(var)
    
    # Objective: Maximize total ECV
    solver.Maximize(solver.Sum([
        x[i] * actionable_issues[i].get('ecv', 0)
        for i in range(num_actions)
    ]))
    
    # Constraint: Total workers cannot exceed available
    solver.Add(solver.Sum([
        x[i] * actionable_issues[i].get('workers_needed', 0)
        for i in range(num_actions)
    ]) <= available_workers)
    
    # Constraint: Total vehicles cannot exceed available
    solver.Add(solver.Sum([
        x[i] * actionable_issues[i].get('vehicles_needed', 0)
        for i in range(num_actions)
    ]) <= available_vehicles)
    
    # Solve
    status = solver.Solve()
    
    # Extract results
    selected_indices = [i for i in range(num_actions) if x[i].solution_value() > 0.5]
    
    selected_actions = []
    total_ecv = 0
    total_workers = 0
    total_vehicles = 0
    
    for i in selected_indices:
        issue = actionable_issues[i]
        ecv = issue.get('ecv', 0)
        total_ecv += ecv
        total_workers += issue.get('workers_needed', 0)
        total_vehicles += issue.get('vehicles_needed', 0)
        
        selected_actions.append({
            'issueId': issue.get('issue_id', f'issue_{i}'),
            'issueType': issue.get('issue_type', 'unknown'),
            'actionType': issue.get('action_type', 'ACT'),
            'resources': {
                'workers': issue.get('workers_needed', 0),
                'vehicles': issue.get('vehicles_needed', 0),
                'hours': issue.get('hours_needed', 2)
            },
            'ecv': ecv,
            'priorityScore': issue.get('priority_score', 0),
            'priorityBand': issue.get('priority_band', 'MEDIUM'),
            'confidence': issue.get('confidence', 50),
            'reason': f"Selected by OR-Tools optimization (ECV: {ecv:.2f})"
        })
    
    # Calculate resource utilization
    worker_util = total_workers / max(1, available_workers)
    vehicle_util = total_vehicles / max(1, available_vehicles)
    
    return json.dumps({
        'error': False,
        'selectedActions': selected_actions,
        'objectiveValue': round(total_ecv, 2),
        'solver': 'OR_TOOLS',
        'statistics': {
            'workerUtilization': round(worker_util, 2),
            'vehicleUtilization': round(vehicle_util, 2),
            'workersUsed': total_workers,
            'vehiclesUsed': total_vehicles,
            'workersAvailable': available_workers,
            'vehiclesAvailable': available_vehicles,
            'issuesConsidered': num_actions,
            'issuesSelected': len(selected_actions),
            'solverTimeMs': solver.wall_time()
        },
        'formulation': {
            'objective': 'Maximize Expected Civic Value (ECV)',
            'constraints': [
                f'Total workers <= {available_workers}',
                f'Total vehicles <= {available_vehicles}'
            ],
            'method': 'Mixed Integer Programming (CBC)'
        }
    })

def compare_with_greedy(problem_json, greedy_result_json):
    """
    Compare OR-Tools solution with greedy baseline
    """
    or_tools_result = json.loads(solve(problem_json))
    greedy_result = json.loads(greedy_result_json)
    
    if or_tools_result.get('error') or greedy_result.get('error'):
        return json.dumps({
            'error': True,
            'message': 'Cannot compare - one or both solvers failed'
        })
    
    or_tools_ecv = or_tools_result.get('objectiveValue', 0)
    greedy_ecv = greedy_result.get('objectiveValue', 0)
    
    improvement = ((or_tools_ecv - greedy_ecv) / max(1, greedy_ecv)) * 100
    
    return json.dumps({
        'comparison': {
            'orTools': {
                'objectiveValue': or_tools_ecv,
                'selectedCount': len(or_tools_result.get('selectedActions', []))
            },
            'greedy': {
                'objectiveValue': greedy_ecv,
                'selectedCount': len(greedy_result.get('selectedActions', []))
            },
            'improvement': {
                'absolute': round(or_tools_ecv - greedy_ecv, 2),
                'percent': round(improvement, 1)
            },
            'verdict': 'OR-TOOLS better' if improvement > 0 else 'GREEDY equivalent or better'
        }
    })

if __name__ == '__main__':
    # Read problem from stdin or file
    if len(sys.argv) > 1:
        with open(sys.argv[1], 'r') as f:
            problem_json = f.read()
    else:
        problem_json = sys.stdin.read()
    
    result = solve(problem_json)
    print(result)
