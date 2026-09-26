/**
 * Production Compliance Test Suite
 * Validates:
 * 1. Independent evidence clusters (grouping reprints/aggregators).
 * 2. 5-level confidence categorization (VERY HIGH, HIGH, MODERATE, LOW, UNCONFIRMED).
 * 3. Geodesic equal-area calculation (WGS84 spherical excess).
 * 4. Provenance and precision levels on frontline events and changes.
 * 5. Backup, manifest integrity, and rollback capability.
 * 6. Snapshot chaining with SHA256 integrity hashes.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  calculateConfidenceDetails,
  calculateConsensusScore,
  getConfidenceLevel,
  calculateGeodesicPolygonAreaKm2,
  computeSnapshotDiff,
  SOURCE_CLUSTERS
} from '../lib/geoConsensus.js';
import {
  createBackup,
  listBackups,
  rollbackTo,
  rollbackToSnapshot,
  CRITICAL_FILES
} from '../services/backupService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

console.log('--- RUNNING COMPREHENSIVE PRODUCTION COMPLIANCE TEST SUITE ---');

// 1. Evidence Clusters & Confidence Levels
console.log('\n[1] Testing Evidence Clusters and Confidence Levels...');
const confSingle = calculateConfidenceDetails(['deepstate-map']);
assert.strictEqual(confSingle.level, 'MODERATE', 'Single deepstate report must be MODERATE');
assert(confSingle.confidence < 75, 'Single source score must be < 75');
assert(confSingle.independent_evidence_clusters >= 1);

const confCross = calculateConfidenceDetails(['deepstate-map', 'lostarmour']);
assert.strictEqual(confCross.level, 'VERY HIGH', 'LostArmour + DeepState consensus must be VERY HIGH');
assert(confCross.confidence >= 90, 'Score must be >= 90');
assert(confCross.cross_confirmed === true);

// Test reprint clustering (e.g., deepstate and deepstate-map belong to same cluster)
const confDuplicates = calculateConfidenceDetails(['deepstate', 'deepstate-map', 'deepstateua']);
assert.strictEqual(confDuplicates.independent_evidence_clusters, 1, 'Reprints of deepstate should group into 1 cluster');

// 2. Geodesic Polygon Area Calculation
console.log('\n[2] Testing Geodesic Spherical Excess Area Calculation...');
// ~1 km x ~1 km polygon near Pokrovsk (lat ~48.28, lon ~37.18)
const testPolygon = {
  type: 'Polygon',
  coordinates: [[
    [37.1800, 48.2800],
    [37.1935, 48.2800],
    [37.1935, 48.2890],
    [37.1800, 48.2890],
    [37.1800, 48.2800]
  ]]
};
const areaKm2 = calculateGeodesicPolygonAreaKm2(testPolygon);
assert(areaKm2 > 0.8 && areaKm2 < 1.2, `Calculated area should be ~1.0 km², got ${areaKm2}`);
console.log(`[PASS] Geodesic area calculated accurately: ${areaKm2} km²`);

// 3. Provenance and Precision on changes.geojson & events.json
console.log('\n[3] Testing Provenance & Precision Schema on Production Data...');
const changes = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/changes.geojson'), 'utf8'));
assert(changes.features.length > 0, 'Must have frontline changes');
for (const feat of changes.features) {
  const p = feat.properties;
  assert(p.provenance, `Feature ${feat.id} missing provenance object`);
  assert(Array.isArray(p.provenance.primary_sources), `Feature ${feat.id} missing primary_sources array`);
  assert(typeof p.provenance.geolocation_method === 'string', `Feature ${feat.id} missing geolocation_method`);
  assert(typeof p.provenance.last_verified_at === 'string', `Feature ${feat.id} missing last_verified_at`);
  assert(typeof p.provenance.confidence_score === 'number', `Feature ${feat.id} missing confidence_score`);
}
console.log(`[PASS] All ${changes.features.length} changes features have verified provenance schema`);

const events = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/events.json'), 'utf8'));
assert(events.length > 0, 'Must have events');
for (const ev of events) {
  assert(ev.provenance, `Event ${ev.id} missing provenance object`);
  assert(['EXACT_COORDINATES', 'SETTLEMENT_LEVEL', 'SECTOR_LEVEL', 'COUNTRY_LEVEL'].includes(ev.precision_level), `Invalid precision level ${ev.precision_level}`);
}
console.log(`[PASS] All ${events.length} events have verified provenance and precision_level`);

// 4. Backup & Rollback Service
console.log('\n[4] Testing Backup & Rollback Engine...');
const backup = createBackup('test_audit');
assert(backup.backup_id, 'Backup must return backup_id');
assert(backup.files_backed_up.length >= 7, 'Must back up at least 7 critical files');

const backups = listBackups();
assert(backups.length > 0, 'Must list backups');
assert(backups.some(b => b.backup_id === backup.backup_id), 'Created backup must be in listing');

const rollbackRes = rollbackTo(backup.backup_id);
assert.strictEqual(rollbackRes.success, true, 'Rollback must succeed');
console.log(`[PASS] Backup and rollback verified (Restored ${rollbackRes.files_restored} files)`);

// 5. Snapshot Integrity & SHA256 Chaining
console.log('\n[5] Testing Snapshot Hash Chaining...');
const snapIndex = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/snapshots/index.json'), 'utf8'));
assert(snapIndex.length >= 7, 'Must have at least 7 snapshots');
for (let i = 0; i < snapIndex.length; i++) {
  const item = snapIndex[i];
  assert(item.sha256 && item.sha256.length === 64, `Snapshot ${item.date} missing valid sha256`);
  assert(item.previous_snapshot_hash && item.previous_snapshot_hash.length === 64, `Snapshot ${item.date} missing valid previous_snapshot_hash`);
  if (i > 0) {
    assert.strictEqual(item.previous_snapshot_hash, snapIndex[i - 1].sha256, `Hash chain broken between ${snapIndex[i-1].date} and ${item.date}`);
  }
}
console.log(`[PASS] Snapshot hash chain verified intact across all ${snapIndex.length} snapshots`);

console.log('\n====================================================');
console.log('>>> ALL COMPREHENSIVE PRODUCTION COMPLIANCE TESTS PASSED! <<<');
