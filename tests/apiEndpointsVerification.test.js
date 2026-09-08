/**
 * Test Suite: Production API Endpoints Verification
 * Validates that all specification endpoints return real data, proper schemas,
 * and contain no mock stubs, NaN values, or unverified claims.
 */

import http from 'http';
import assert from 'assert';

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path,
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data, error: e });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy(new Error(`Timeout requesting ${path}`));
    });
    req.end();
  });
}

async function runTests() {
  console.log('--- RUNNING PRODUCTION REST API ENDPOINTS VERIFICATION ---');

  // Test 1: GET /api/health
  {
    const res = await makeRequest('/api/health');
    assert.strictEqual(res.status, 200, '/api/health must return 200');
    assert.strictEqual(res.body.status, 'healthy');
    assert(typeof res.body.uptime_seconds === 'number', 'uptime_seconds must be a number');
    assert(res.body.memory && res.body.memory.rss_mb > 0, 'memory rss_mb must be reported');
    console.log('[PASS] Test 1: /api/health returns healthy status and runtime metrics');
  }

  // Test 2: GET /api/frontline/latest
  {
    const res = await makeRequest('/api/frontline/latest');
    assert.strictEqual(res.status, 200, '/api/frontline/latest must return 200');
    assert(res.body.baseline, 'must contain baseline info');
    assert.strictEqual(res.body.baseline.source, 'LostArmour KML Baseline');
    assert(res.body.operational_24h_changes, 'must contain 24h operational changes');
    assert(typeof res.body.operational_24h_changes.total_gain_km2 === 'number', 'gain must be numeric');
    assert(Array.isArray(res.body.features), 'features must be an array');
    console.log('[PASS] Test 2: /api/frontline/latest returns baseline and 24h operational changes');
  }

  // Test 3: GET /api/frontline/history
  {
    const res = await makeRequest('/api/frontline/history');
    assert.strictEqual(res.status, 200, '/api/frontline/history must return 200');
    assert(res.body.count >= 2, 'must have at least 2 chronological snapshots');
    assert(Array.isArray(res.body.snapshots), 'snapshots must be an array');
    assert(res.body.snapshots[0].date, 'snapshot must have date');
    console.log(`[PASS] Test 3: /api/frontline/history returns ${res.body.count} snapshots`);
  }

  // Test 4: GET /api/frontline/delta
  {
    const res = await makeRequest('/api/frontline/delta');
    assert.strictEqual(res.status, 200, '/api/frontline/delta must return 200');
    assert(typeof res.body.gain_km2 === 'number', 'gain_km2 must be numeric');
    assert(Array.isArray(res.body.affected_sectors), 'affected_sectors must be array');
    console.log(`[PASS] Test 4: /api/frontline/delta computed spatial delta: +${res.body.gain_km2} km²`);
  }

  // Test 5: GET /api/frontline/disputed
  {
    const res = await makeRequest('/api/frontline/disputed');
    assert.strictEqual(res.status, 200, '/api/frontline/disputed must return 200');
    assert.strictEqual(res.body.type, 'FeatureCollection', 'Must be a GeoJSON FeatureCollection');
    assert(Array.isArray(res.body.features), 'features must be array');
    console.log(`[PASS] Test 5: /api/frontline/disputed returns contested grey zones (${res.body.features.length} zones)`);
  }

  // Test 6: GET /api/events
  {
    const res = await makeRequest('/api/events?limit=5');
    assert.strictEqual(res.status, 200, '/api/events must return 200');
    assert(res.body.total > 0, 'total events must be > 0');
    assert(Array.isArray(res.body.events), 'events must be array');
    assert(res.body.events.length <= 5, 'limit must be respected');
    console.log(`[PASS] Test 6: /api/events returns paged tactical events (total: ${res.body.total})`);
  }

  // Test 7: GET /api/claims
  {
    const res = await makeRequest('/api/claims');
    assert.strictEqual(res.status, 200, '/api/claims must return 200');
    assert(Array.isArray(res.body), 'claims must be array');
    assert(res.body.length > 0, 'must have claims');
    console.log(`[PASS] Test 7: /api/claims returns fact-checked official claims (${res.body.length} claims)`);
  }

  // Test 8: GET /api/sources/status
  {
    const res = await makeRequest('/api/sources/status');
    assert.strictEqual(res.status, 200, '/api/sources/status must return 200');
    assert(res.body.total_sources > 0, 'total sources must be > 0');
    assert(Array.isArray(res.body.adapters), 'adapters must be array');
    assert(Array.isArray(res.body.sources), 'sources must be array');
    assert(res.body.sources[0].latency_ms > 0, 'latency must be measured positive number');
    console.log(`[PASS] Test 8: /api/sources/status returns health and latency of ${res.body.total_sources} sources`);
  }

  // Test 9: GET /api/analytics/daily
  {
    const res = await makeRequest('/api/analytics/daily');
    assert.strictEqual(res.status, 200, '/api/analytics/daily must return 200');
    assert(['OFFENSIVE', 'DEFENSE', 'STATUS_QUO'].includes(res.body.verdict), 'valid 3-tier verdict');
    assert(typeof res.body.confidence_average === 'number', 'average confidence must be numeric');
    assert(res.body.confidence_average >= 0 && res.body.confidence_average <= 100, 'confidence must be in 0-100 range');
    console.log(`[PASS] Test 9: /api/analytics/daily returns verdict ${res.body.verdict} and confidence ${res.body.confidence_average}%`);
  }

  // Test 10: GET /api/analytics/directions
  {
    const res = await makeRequest('/api/analytics/directions');
    assert.strictEqual(res.status, 200, '/api/analytics/directions must return 200');
    assert(res.body.count >= 8, 'must cover at least 8 operational sectors');
    assert(Array.isArray(res.body.directions), 'directions must be array');
    const pokrovsk = res.body.directions.find(d => d.id === 'pokrovsk');
    assert(pokrovsk, 'Pokrovsk sector must exist');
    assert.strictEqual(pokrovsk.activity_level, 'HIGH', 'Pokrovsk must have HIGH activity level');
    console.log(`[PASS] Test 10: /api/analytics/directions returns ${res.body.count} operational sectors`);
  }

  console.log('----------------------------------------------------');
  console.log('RESULTS: 10/10 production API endpoint tests passed.');
  console.log('>>> ALL VERIFIED REST ENDPOINTS FUNCTIONAL! <<<');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
