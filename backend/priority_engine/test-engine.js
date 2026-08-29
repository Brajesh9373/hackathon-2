/**
 * Priority Engine Test Script
 * Tests the complete priority evaluation pipeline
 */

const PriorityEngine = require('./PriorityEngine');

console.log('='.repeat(60));
console.log('PRIORITY ENGINE TEST');
console.log('='.repeat(60));

// Test 1: Basic evaluation
console.log('\n[TEST 1] Single Issue Evaluation');
console.log('-'.repeat(40));

const testIssue = {
  issue_id: 'INF-001',
  domain: 'infrastructure',
  type: 'blocked_drain',
  ward: 'W6',
  location: { lat: 19.88, lon: 74.47 },
  reported_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
  severity: 4,
  description: 'Drain completely blocked near hospital',
  photo_available: true,
  citizen_reports: 5,
  near_facilities: ['hospital'],
  nearby_complaints: 7,
  is_repeat_location: true,
  weather_condition: 'heavy_rain',
  traffic_level: 'high',
  population_exposed: 'high'
};

const availableResources = {
  available_workers: 8,
  available_vehicles: 3,
  equipment_status: {
    'drain_equipment': 'available',
    'suction_machine': 'available'
  }
};

const decision = PriorityEngine.evaluate(testIssue, availableResources);
console.log('\nDecision:', JSON.stringify(decision, null, 2));

// Test 2: Generate explanation
console.log('\n[TEST 2] Explanation Generation');
console.log('-'.repeat(40));

const explanation = PriorityEngine.explain(decision, 1, 1);
console.log('\nExplanation:', JSON.stringify(explanation, null, 2));

// Test 3: Batch evaluation
console.log('\n[TEST 3] Batch Evaluation');
console.log('-'.repeat(40));

const issues = [
  {
    issue_id: 'INF-101',
    domain: 'infrastructure',
    type: 'blocked_drain',
    reported_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    severity: 4,
    near_facilities: ['hospital'],
    weather_condition: 'heavy_rain',
    population_exposed: 'high'
  },
  {
    issue_id: 'INF-102',
    domain: 'infrastructure',
    type: 'pothole',
    reported_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    severity: 2,
    weather_condition: 'clear',
    population_exposed: 'medium'
  },
  {
    issue_id: 'INF-103',
    domain: 'infrastructure',
    type: 'streetlight',
    reported_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    severity: 3,
    weather_condition: 'cloudy',
    population_exposed: 'high'
  }
];

const batchResult = PriorityEngine.evaluateBatch(issues, availableResources);
console.log('\nBatch Summary:', JSON.stringify(batchResult.summary, null, 2));
console.log('\nRanked Decisions:');
batchResult.decisions.forEach(d => {
  console.log(`  #${d.rank}: ${d.issue_id} - Score: ${d.priority_score} (${d.priority_band}) - Action: ${d.recommended_action}`);
});

// Test 4: Context change (rain starts)
console.log('\n[TEST 4] Context Recalculation');
console.log('-'.repeat(40));

const contextChanges = { weather: 'heavy_rain' };
const recalculated = PriorityEngine.recalculate(decision, contextChanges, availableResources);
console.log('\nOriginal Score:', decision.priority_score);
console.log('Recalculated Score:', recalculated.priority_score);
console.log('Context Change:', JSON.stringify(contextChanges));

// Test 5: Different issue types
console.log('\n[TEST 5] Different Issue Types');
console.log('-'.repeat(40));

const issueTypes = [
  { issue_id: 'INF-A', type: 'blocked_drain', near_facilities: ['school'], weather_condition: 'rainy' },
  { issue_id: 'INF-B', type: 'flooding', near_facilities: ['hospital'], weather_condition: 'heavy_rain' },
  { issue_id: 'INF-C', type: 'pothole', near_facilities: [], weather_condition: 'clear' },
  { issue_id: 'INF-D', type: 'streetlight', near_facilities: [], weather_condition: 'normal' }
];

issueTypes.forEach(issue => {
  const result = PriorityEngine.evaluate({
    ...issue,
    domain: 'infrastructure',
    reported_at: new Date().toISOString(),
    severity: 3
  }, availableResources);
  console.log(`  ${issue.type.padEnd(15)} => Score: ${result.priority_score.toString().padStart(3)} (${result.priority_band})`);
});

console.log('\n' + '='.repeat(60));
console.log('ALL TESTS COMPLETED');
console.log('='.repeat(60));
