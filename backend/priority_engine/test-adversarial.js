/**
 * Priority Engine Adversarial Tests
 * Tests edge cases and verifies internal consistency
 */

const PriorityEngine = require('./PriorityEngine');

console.log('='.repeat(70));
console.log('PRIORITY ENGINE - ADVERSARIAL TESTS');
console.log('='.repeat(70));

// Test resources
const FULL_RESOURCES = {
  available_workers: 10,
  available_vehicles: 5,
  equipment_status: { drain_equipment: 'available', suction_machine: 'available' }
};

const LIMITED_RESOURCES = {
  available_workers: 2,
  available_vehicles: 1,
  equipment_status: { drain_equipment: 'available', suction_machine: 'available' }
};

const NO_RESOURCES = {
  available_workers: 0,
  available_vehicles: 0,
  equipment_status: { drain_equipment: 'unavailable' }
};

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    const result = fn();
    if (result.pass) {
      console.log(`\n[PASS] ${name}`);
      if (result.details) console.log(`       ${result.details}`);
      passed++;
    } else {
      console.log(`\n[FAIL] ${name}`);
      console.log(`       Expected: ${result.expected}`);
      console.log(`       Got: ${result.actual}`);
      failed++;
    }
  } catch (e) {
    console.log(`\n[ERROR] ${name}`);
    console.log(`        ${e.message}`);
    failed++;
  }
}

// ============================================
// TEST 1: Priority vs Feasibility Separation
// ============================================
console.log('\n--- TEST SUITE 1: Priority-Feasibility Separation ---\n');

test('High priority with NO resources should still show high priority (not suppressed)', () => {
  const issue = {
    issue_id: 'ADV-001',
    type: 'blocked_drain',
    reported_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(), // 20 days old
    severity: 5,
    weather_condition: 'heavy_rain',
    near_facilities: ['hospital'],
    population_exposed: 'very_high',
    citizen_reports: 15,
    photo_available: true,
    is_repeat_location: true,
    location: { lat: 19.88, lon: 74.47 }
  };
  
  const result = PriorityEngine.evaluate(issue, NO_RESOURCES);
  
  // Priority should still be high, feasibility blocked
  const pass = result.priority.score >= 75 && result.feasibility.status === 'BLOCKED';
  
  return {
    pass,
    expected: 'priority >= 75 AND feasibility = BLOCKED',
    actual: `priority = ${result.priority.score}, feasibility = ${result.feasibility.status}`,
    details: `Action: ${result.decision.action}`
  };
});

test('Critical issue should force ESCALATE even with no resources', () => {
  const issue = {
    issue_id: 'ADV-002',
    type: 'flooding',
    reported_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(), // 25 days old
    severity: 5,
    weather_condition: 'storm',
    near_facilities: ['hospital'],
    population_exposed: 'very_high',
    citizen_reports: 25,
    photo_available: true,
    is_repeat_location: true,
    location: { lat: 19.88, lon: 74.47 }
  };
  
  const result = PriorityEngine.evaluate(issue, NO_RESOURCES);
  
  // Should show blocked feasibility, not deferred
  const pass = result.feasibility.status === 'BLOCKED' && result.decision.action === 'ESCALATE';
  
  return {
    pass,
    expected: 'feasibility = BLOCKED, action = ESCALATE',
    actual: `feasibility = ${result.feasibility.status}, action = ${result.decision.action}`,
    details: `Priority: ${result.priority.band} (${result.priority.score})`
  };
});

// ============================================
// TEST 2: Confidence Does NOT Suppress Priority
// ============================================
console.log('\n--- TEST SUITE 2: Confidence-Priority Independence ---\n');

test('High priority + LOW confidence = VERIFY_PREPARE (not suppressed)', () => {
  // Make the issue more severe to reach HIGH or CRITICAL band
  const issue = {
    issue_id: 'ADV-003',
    type: 'flooding',
    reported_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    severity: 5,
    weather_condition: 'heavy_rain',
    near_facilities: ['hospital'],
    population_exposed: 'very_high',
    citizen_reports: 1,
    photo_available: false,
    is_repeat_location: true
  };
  
  const result = PriorityEngine.evaluate(issue, FULL_RESOURCES);
  
  // Priority should be HIGH or CRITICAL, confidence low
  const isHighPriority = result.priority.band === 'HIGH' || result.priority.band === 'CRITICAL';
  const pass = isHighPriority && 
               result.confidence.level === 'LOW' &&
               result.decision.action.includes('VERIFY');
  
  return {
    pass,
    expected: 'priority = HIGH/CRITICAL, confidence = LOW, action contains VERIFY',
    actual: `priority = ${result.priority.band}, confidence = ${result.confidence.level}, action = ${result.decision.action}`,
    details: `Missing: ${result.confidence.missing_data?.map(m => m.issue).join(', ')}`
  };
});

test('Critical priority + LOW confidence = ACT_VERIFY (not DEFERRED)', () => {
  const issue = {
    issue_id: 'ADV-004',
    type: 'flooding',
    reported_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    severity: 5,
    weather_condition: 'heavy_rain',
    near_facilities: ['hospital'],
    population_exposed: 'very_high',
    citizen_reports: 1,
    photo_available: false,
    is_repeat_location: true
  };
  
  const result = PriorityEngine.evaluate(issue, FULL_RESOURCES);
  
  // Critical issues act even with low confidence
  const pass = result.priority.band === 'CRITICAL' && 
               result.decision.action.includes('ACT');
  
  return {
    pass,
    expected: 'priority = CRITICAL, action contains ACT',
    actual: `priority = ${result.priority.band}, action = ${result.decision.action}`
  };
});

// ============================================
// TEST 3: Resource Model - Min vs Preferred
// ============================================
console.log('\n--- TEST SUITE 3: Resource Model ---\n');

test('Resources should show min AND preferred workers', () => {
  const issue = {
    issue_id: 'ADV-005',
    type: 'blocked_drain',
    reported_at: new Date().toISOString(),
    severity: 3,
    weather_condition: 'heavy_rain',
    near_facilities: ['hospital']
  };
  
  const result = PriorityEngine.evaluate(issue, FULL_RESOURCES);
  
  const hasMin = result.resources.required.workers_min !== undefined;
  const hasPreferred = result.resources.required.workers_preferred !== undefined;
  const minLessThanPreferred = result.resources.required.workers_min <= result.resources.required.workers_preferred;
  
  const pass = hasMin && hasPreferred && minLessThanPreferred;
  
  return {
    pass,
    expected: 'workers_min <= workers_preferred',
    actual: `min=${result.resources.required.workers_min}, preferred=${result.resources.required.workers_preferred}`
  };
});

test('Feasibility should show shortfall details', () => {
  const issue = {
    issue_id: 'ADV-006',
    type: 'blocked_drain',
    reported_at: new Date().toISOString(),
    severity: 4,
    near_facilities: ['hospital']
  };
  
  const result = PriorityEngine.evaluate(issue, LIMITED_RESOURCES);
  
  const hasShortfall = result.feasibility.shortfall !== null;
  const hasWorkerGap = result.feasibility.shortfall?.workers?.gap_min > 0;
  
  const pass = hasShortfall && hasWorkerGap;
  
  return {
    pass,
    expected: 'has shortfall with worker gap',
    actual: `shortfall=${!!result.feasibility.shortfall}, worker_gap=${result.feasibility.shortfall?.workers?.gap_min}`
  };
});

// ============================================
// TEST 4: Explanation Consistency
// ============================================
console.log('\n--- TEST SUITE 4: Explanation Consistency ---\n');

test('Explanation action should match decision.action', () => {
  const issue = {
    issue_id: 'ADV-007',
    type: 'pothole',
    reported_at: new Date().toISOString(),
    severity: 2,
    weather_condition: 'clear'
  };
  
  const result = PriorityEngine.evaluate(issue, FULL_RESOURCES);
  
  // Get explanation
  const explanation = PriorityEngine.explain(result, 1, 1);
  
  const actionMatch = explanation.action?.recommendation === result.decision.action;
  
  return {
    pass: actionMatch,
    expected: `explanation.action = ${result.decision.action}`,
    actual: `explanation.action = ${explanation.action?.recommendation}`
  };
});

test('Explanation should NOT claim "immediate" when action is not ACT', () => {
  const issue = {
    issue_id: 'ADV-008',
    type: 'pothole',
    reported_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    severity: 2,
    weather_condition: 'clear'
  };
  
  const result = PriorityEngine.evaluate(issue, FULL_RESOURCES);
  
  const explanation = PriorityEngine.explain(result, 1, 1);
  
  // If action is not ACT/ACT_VERIFY, primary should not suggest immediate action
  const isNonAct = !['ACT', 'ACT_VERIFY', 'ACT_PARTIAL'].includes(result.decision.action);
  const noImmediateClaim = isNonAct ? 
    !explanation.action?.primary?.toLowerCase().includes('immediately') : true;
  
  return {
    pass: noImmediateClaim,
    expected: `No "immediate" claim for action ${result.decision.action}`,
    actual: `action = ${result.decision.action}, primary = ${explanation.action?.primary}`
  };
});

// ============================================
// TEST 5: Context Modifiers Bounded
// ============================================
console.log('\n--- TEST SUITE 5: Context Modifiers ---\n');

test('Context modifiers should be bounded (not multiplicative)', () => {
  // Create an issue that triggers multiple context modifiers
  const issue = {
    issue_id: 'ADV-009',
    type: 'blocked_drain',
    reported_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days old
    severity: 4,
    weather_condition: 'heavy_rain',
    near_facilities: ['hospital'],
    population_exposed: 'high',
    citizen_reports: 15,
    is_repeat_location: true
  };
  
  const result = PriorityEngine.evaluate(issue, FULL_RESOURCES);
  
  // Priority should not exceed 100 (bounded)
  const pass = result.priority.score <= 100;
  
  return {
    pass,
    expected: 'priority <= 100',
    actual: `priority = ${result.priority.score}`
  };
});

// ============================================
// TEST 6: Duplicate Handling
// ============================================
console.log('\n--- TEST SUITE 6: Duplicate Handling ---\n');

test('Multiple reports at same location = higher evidence, not higher priority', () => {
  const singleReport = {
    issue_id: 'ADV-010A',
    type: 'blocked_drain',
    reported_at: new Date().toISOString(),
    severity: 3,
    citizen_reports: 1
  };
  
  const multipleReports = {
    issue_id: 'ADV-010B',
    type: 'blocked_drain',
    reported_at: new Date().toISOString(),
    severity: 3,
    citizen_reports: 10
  };
  
  const resultSingle = PriorityEngine.evaluate(singleReport, FULL_RESOURCES);
  const resultMultiple = PriorityEngine.evaluate(multipleReports, FULL_RESOURCES);
  
  // Priority should be similar (not 10x)
  const priorityDiff = Math.abs(resultSingle.priority.score - resultMultiple.priority.score);
  
  // But confidence should be higher
  const confidenceHigher = resultMultiple.confidence.score > resultSingle.confidence.score;
  
  const pass = priorityDiff < 20 && confidenceHigher;
  
  return {
    pass,
    expected: 'similar priority, higher confidence',
    actual: `priority diff=${priorityDiff}, single_conf=${resultSingle.confidence.score}, multi_conf=${resultMultiple.confidence.score}`
  };
});

// ============================================
// TEST 7: Weather Context
// ============================================
console.log('\n--- TEST SUITE 7: Weather Context ---\n');

test('Rain should increase urgency and context', () => {
  const noRain = {
    issue_id: 'ADV-011A',
    type: 'blocked_drain',
    reported_at: new Date().toISOString(),
    severity: 3,
    weather_condition: 'clear'
  };
  
  const heavyRain = {
    issue_id: 'ADV-011B',
    type: 'blocked_drain',
    reported_at: new Date().toISOString(),
    severity: 3,
    weather_condition: 'heavy_rain'
  };
  
  const resultNoRain = PriorityEngine.evaluate(noRain, FULL_RESOURCES);
  const resultRain = PriorityEngine.evaluate(heavyRain, FULL_RESOURCES);
  
  const rainHigher = resultRain.priority.score >= resultNoRain.priority.score;
  
  return {
    pass: rainHigher,
    expected: 'heavy_rain priority >= clear priority',
    actual: `clear=${resultNoRain.priority.score}, rain=${resultRain.priority.score}`
  };
});

// ============================================
// TEST 8: Action Reasons
// ============================================
console.log('\n--- TEST SUITE 8: Action Reason Codes ---\n');

test('Action should include reason codes for audit trail', () => {
  const issue = {
    issue_id: 'ADV-012',
    type: 'blocked_drain',
    reported_at: new Date().toISOString(),
    severity: 4,
    near_facilities: ['hospital']
  };
  
  const result = PriorityEngine.evaluate(issue, LIMITED_RESOURCES);
  
  const hasReasonCodes = result.decision.reason_codes?.length > 0;
  const hasAction = result.decision.action !== undefined;
  
  const pass = hasReasonCodes && hasAction;
  
  return {
    pass,
    expected: 'has reason_codes and action',
    actual: `action=${result.decision.action}, reasons=${result.decision.reason_codes?.join(', ')}`
  };
});

// ============================================
// SUMMARY
// ============================================
console.log('\n' + '='.repeat(70));
console.log('TEST SUMMARY');
console.log('='.repeat(70));
console.log(`\nTotal: ${passed + failed}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failed > 0) {
  console.log('\n⚠️  Some tests failed - review the output above');
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!');
}
