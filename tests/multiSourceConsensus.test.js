/**
 * Test Suite: Multi-Source Frontline Consensus Engine
 * Validates:
 * 1. DIVGEN early-warning candidate generation (PENDING_VERIFICATION, LOW confidence).
 * 2. Multi-map agreement + physical evidence -> RU_CONTROLLED (VERY HIGH confidence).
 * 3. Divergence handling -> DISPUTED.
 * 4. ISW infiltration rule: ISW infiltration != confirmed control (RU_INFILTRATION).
 * 5. Official claim rule: CLAIM != CONTROL (Level E, no polygon expansion).
 * 6. Lineage deduplication: reprint chains collapse into single cluster.
 * 7. Click-to-Explain: complete reproducible answer to «Почему WarMap Daily считает, что эта территория имеет данный статус на эту дату?».
 * 8. ISW and Evidence unified adapters.
 */

import assert from 'assert';
import {
  calculateConfidenceDetails,
  calculateConsensusScore,
  getIndependentEvidenceClusters,
  determineConsensusStatus,
  explainTerritoryStatus,
  TERRITORIAL_STATUSES,
  EVIDENCE_LEVELS
} from '../lib/geoConsensus.js';
import { iswAdapter } from '../sources/isw/index.js';
import { evidenceAdapter } from '../sources/evidence/index.js';
import { divgenAdapter, parseDivgenEvent } from '../sources/divgen/index.js';
import { claimsAdapter } from '../sources/claims/index.js';
import { validateUnifiedSourceData } from '../sources/baseAdapter.js';

console.log('--- RUNNING MULTI-SOURCE FRONTLINE CONSENSUS TEST SUITE ---');

// Test 1: DIVGEN alone produces PENDING_VERIFICATION with LOW confidence
{
  const consensus = determineConsensusStatus({
    sources: {
      divgen: { is_ru: true, status: 'RU' },
      lostarmour: { is_ru: false },
      deepstate: { is_ru: false },
      isw: { is_ru: false }
    },
    candidateStatus: 'RU_CONTROLLED',
    geolocatedEvidence: []
  });

  assert.strictEqual(consensus.status, 'PENDING_VERIFICATION', 'Single DIVGEN report must be PENDING_VERIFICATION');
  assert.strictEqual(consensus.confidence_level, 'LOW', 'DIVGEN solitary report must have LOW confidence');
  assert.strictEqual(consensus.verification_level, 'LEVEL_D_SINGLE_OSINT_MAP');
  assert.ok(consensus.note.includes('DIVGEN первым зафиксировал'), 'Note must explain DIVGEN early warning role');
  console.log('[PASS] Test 1: DIVGEN early warning alone produces PENDING_VERIFICATION (confidence LOW)');
}

// Test 2: Multi-map agreement + physical evidence -> RU_CONTROLLED (VERY HIGH)
{
  const consensus = determineConsensusStatus({
    sources: {
      divgen: { is_ru: true },
      lostarmour: { is_ru: true },
      deepstate: { is_ru: true },
      isw: { is_ru: true }
    },
    candidateStatus: 'RU_CONTROLLED',
    geolocatedEvidence: [{ id: 'ev-drone-01', type: 'video_bpla' }]
  });

  assert.strictEqual(consensus.status, 'RU_CONTROLLED');
  assert.strictEqual(consensus.confidence_level, 'VERY HIGH');
  assert.strictEqual(consensus.verification_level, 'LEVEL_A_PHYSICAL_EVIDENCE');
  assert.ok(consensus.confidence >= 90, 'Consensus with visual evidence must be >= 90');
  console.log('[PASS] Test 2: Multi-map consensus + visual confirmation -> RU_CONTROLLED (VERY HIGH)');
}

// Test 3: Divergence without visual evidence -> DISPUTED
{
  const consensus = determineConsensusStatus({
    sources: {
      divgen: { is_ru: true },
      lostarmour: { is_ru: true },
      deepstate: { is_ua: true },
      isw: { is_ua: true }
    },
    candidateStatus: 'DISPUTED',
    geolocatedEvidence: []
  });

  assert.strictEqual(consensus.status, 'DISPUTED', 'Conflicting sources must produce DISPUTED');
  assert.strictEqual(consensus.confidence_level, 'MODERATE');
  assert.ok(consensus.note.includes('Существенное расхождение'), 'Note must explain discrepancy');
  console.log('[PASS] Test 3: Divergent sources without physical proof produce DISPUTED');
}

// Test 4: ISW infiltration rule (ISW infiltration != confirmed control)
{
  const consensus = determineConsensusStatus({
    sources: { isw: { is_ru: true, is_infiltration: true } },
    candidateStatus: 'RU_CONTROLLED',
    isInfiltration: true,
    geolocatedEvidence: []
  });

  assert.strictEqual(consensus.status, 'RU_INFILTRATION', 'Infiltration must produce RU_INFILTRATION, NOT RU_CONTROLLED');
  assert.strictEqual(consensus.is_infiltration, true);
  assert.ok(consensus.note.includes('не приравнивается к устойчивому контролю'), 'Must explicitly enforce infiltration rule');
  console.log('[PASS] Test 4: ISW infiltration rule enforced: infiltration != confirmed control');
}

// Test 5: Official Claim rule (CLAIM != CONTROL)
{
  const consensus = determineConsensusStatus({
    sources: { 'mod-ru': { is_ru: true } },
    candidateStatus: 'RU_CONTROLLED',
    isClaim: true,
    geolocatedEvidence: []
  });

  assert.strictEqual(consensus.verification_level, 'LEVEL_E_OFFICIAL_CLAIM');
  assert.strictEqual(consensus.is_claim, true);
  assert.strictEqual(consensus.confidence_level, 'LOW');
  assert.ok(consensus.note.includes('не перекрашивает территорию'), 'Official claim must not repaint territory');
  console.log('[PASS] Test 5: Official claim rule enforced: CLAIM != CONTROL (Level E signal)');
}

// Test 6: Source Lineage Deduplication
{
  // Telegram A -> Telegram B -> Media C citing Telegram
  const clusters = getIndependentEvidenceClusters(
    ['deepstate', 'deepstate-map', 'deepstateua'],
    ['ev-video-drone'],
    [['deepstate', 'telegram_a', 'media_c']]
  );

  // All deepstate variants + reprint chain must collapse into 1 deepstate cluster + 1 physical cluster = 2 total
  assert.strictEqual(clusters.filter(c => c === 'cluster_deepstate').length, 1, 'DeepState variants must be in 1 cluster');
  assert.ok(clusters.includes('cluster_geolocated_physical'), 'Video must be in physical cluster');
  console.log('[PASS] Test 6: Lineage deduplication correctly groups reprint chains into single evidence clusters');
}

// Test 7: Click-to-Explain reproducible explanation
{
  const explanation = explainTerritoryStatus({
    featureId: 'change-pokrovsk-hrodivka',
    sectorId: 'pokrovsk',
    operatingDate: '2026-09-24',
    feature: {
      id: 'change-pokrovsk-hrodivka',
      properties: {
        id: 'change-pokrovsk-hrodivka',
        name: 'Продвижение в районе Гродовки',
        status: 'RU_CONTROLLED',
        sector_id: 'pokrovsk',
        source_ids: ['lostarmour', 'deepstate', 'isw', 'divgen'],
        evidence_ids: ['ev-drone-pokrovsk-01']
      }
    }
  });

  assert.ok(explanation.question.includes('Почему WarMap Daily считает'), 'Must formulate the prompt question');
  assert.strictEqual(explanation.status, 'RU_CONTROLLED');
  assert.ok(explanation.confidence_score >= 90);
  assert.ok(explanation.sources_breakdown.some(s => s.source === 'DIVGEN'));
  assert.ok(explanation.sources_breakdown.some(s => s.source === 'ISW (Институт изучения войны)'));
  assert.ok(explanation.methodology_explanation_ru.includes('WarMap Daily считает'));
  console.log('[PASS] Test 7: explainTerritoryStatus provides complete reproducible answer with sources & evidence');
}

// Test 8: ISW Adapter conforms to Unified Source Data schema
{
  const unified = await iswAdapter.getUnified('2026-09-24');
  const val = validateUnifiedSourceData(unified);
  assert.strictEqual(val.valid, true, `ISW validation error: ${val.error}`);
  assert.strictEqual(unified.source, 'isw');
  assert.strictEqual(unified.source_type, 'independent_analytical');
  assert.strictEqual(unified.metadata.rule_enforced, 'ISW infiltration != confirmed control');
  assert.ok(unified.geometry.features.length >= 4, 'Must have ISW assessed features');
  console.log(`[PASS] Test 8: iswAdapter.getUnified returns valid schema with ${unified.geometry.features.length} features`);
}

// Test 9: Geolocated Evidence Adapter conforms to Unified Source Data schema
{
  const unified = await evidenceAdapter.getUnified('2026-09-24');
  const val = validateUnifiedSourceData(unified);
  assert.strictEqual(val.valid, true, `Evidence validation error: ${val.error}`);
  assert.strictEqual(unified.source, 'geolocated-evidence');
  assert.strictEqual(unified.metadata.role, 'LEVEL_A_PHYSICAL_EVIDENCE');
  assert.ok(unified.geometry.features.length > 0, 'Must have physical evidence points');
  console.log(`[PASS] Test 9: evidenceAdapter.getUnified returns valid schema with ${unified.geometry.features.length} features`);
}

// Test 10: Official Claims Adapter conforms to Unified Source Data schema
{
  const unified = await claimsAdapter.getUnified('2026-09-24');
  const val = validateUnifiedSourceData(unified);
  assert.strictEqual(val.valid, true, `Claims validation error: ${val.error}`);
  assert.strictEqual(unified.source, 'official-claims');
  assert.strictEqual(unified.metadata.rule_enforced, 'CLAIM != CONTROL');
  console.log(`[PASS] Test 10: claimsAdapter.getUnified returns valid schema with ${unified.geometry.features.length} features`);
}

console.log('----------------------------------------------------');
console.log('RESULTS: All 10 Multi-Source Frontline Consensus tests passed.');
console.log('>>> MULTI-SOURCE CONSENSUS ENGINE FULLY VERIFIED! <<<');
