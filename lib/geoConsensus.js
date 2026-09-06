/**
 * WarMap Daily 2.0 - GeoConsensus & Change Detection Engine
 * Computes multi-source consensus, change deltas, confidence scores, and noise threshold filtering.
 */

import fs from 'fs';
import path from 'path';

// Noise filtering thresholds
export const MIN_CHANGE_DISTANCE_METERS = 50;
export const MIN_CHANGE_AREA_KM2 = 0.01;

// Source reliability weights
export const SOURCE_WEIGHTS = {
  'deepstate-map': 0.35,
  'deepstate': 0.35,
  'isw': 0.25,
  'firms': 0.20,
  'nasa-firms': 0.20,
  'sentinel': 0.20,
  'copernicus': 0.20,
  'mod-ru': 0.15,
  'general-staff-ua': 0.15,
  'rbc': 0.15,
  'vedomosti': 0.15,
  'rybar': 0.10,
  'militarnyi': 0.10
};

/**
 * Calculates consensus confidence for a claimed change or boundary based on sources
 */
export function calculateConsensusScore(sourceIds = []) {
  if (!sourceIds || sourceIds.length === 0) {
    return {
      score: 35,
      level: 'UNCONFIRMED',
      label_ru: 'Не подтверждено (нет проверяемых источников)',
      cross_confirmed: false,
      sources_analyzed: []
    };
  }
  
  let totalWeight = 0;
  let hasCrossConfirmation = false;
  const sourcesAnalyzed = [];

  const uaSources = ['general-staff-ua', 'deepstate', 'deepstate-map', 'militarnyi'];
  const ruSources = ['mod-ru', 'rybar', 'mil_ru', 'rbc', 'vedomosti'];
  const indSources = ['isw', 'firms', 'nasa-firms', 'sentinel', 'copernicus'];

  const hasUA = sourceIds.some(s => uaSources.includes(s));
  const hasRU = sourceIds.some(s => ruSources.includes(s));
  const hasIndependent = sourceIds.some(s => indSources.includes(s));

  if ((hasUA && hasRU) || (hasIndependent && (hasUA || hasRU))) {
    hasCrossConfirmation = true;
  }

  for (const s of sourceIds) {
    const weight = SOURCE_WEIGHTS[s] || 0.10;
    totalWeight += weight;
    let side = 'independent';
    if (uaSources.includes(s)) side = 'ua';
    else if (ruSources.includes(s)) side = 'ru';

    sourcesAnalyzed.push({ id: s, weight, side });
  }

  let score = Math.min(Math.round(totalWeight * 100), 96);
  if (hasCrossConfirmation) {
    score = Math.max(score, 88);
  }
  if (sourceIds.length === 1) {
    score = Math.min(score, 62);
  }

  const level = getConfidenceLevel(score);
  const labelRu = getConfidenceLabelRu(level, hasCrossConfirmation);

  return {
    score,
    level,
    label_ru: labelRu,
    cross_confirmed: hasCrossConfirmation,
    sources_analyzed: sourcesAnalyzed
  };
}

/**
 * Categorizes confidence level: HIGH, MEDIUM, LOW, UNCONFIRMED
 */
export function getConfidenceLevel(score) {
  if (score >= 80) return 'HIGH';
  if (score >= 60) return 'MEDIUM';
  if (score >= 40) return 'LOW';
  return 'UNCONFIRMED';
}

/**
 * Returns user-facing Russian label for confidence level
 */
export function getConfidenceLabelRu(level, crossConfirmed = false) {
  switch (level) {
    case 'HIGH':
      return crossConfirmed ? 'Высокая (кросс-верификация)' : 'Высокая (независимые источники)';
    case 'MEDIUM':
      return 'Средняя (один профильный источник)';
    case 'LOW':
      return 'Низкая (требует подтверждения объективным контролем)';
    case 'UNCONFIRMED':
    default:
      return 'Не подтверждено (неверифицированные заявления)';
  }
}

/**
 * Evaluates and annotates a GeoJSON feature with full consensus metrics
 */
export function evaluateFeatureConfidence(feature) {
  if (!feature || !feature.properties) return feature;
  const p = feature.properties;
  const sourceIds = p.source_ids || (p.sources ? p.sources.map(s => String(s).toLowerCase()) : []);
  const consensus = calculateConsensusScore(sourceIds);

  p.consensus_score = consensus.score;
  p.confidence = consensus.score / 100;
  p.confidence_level = consensus.level;
  p.confidence_label_ru = consensus.label_ru;
  p.cross_confirmed = consensus.cross_confirmed;
  p.verification_sources = consensus.sources_analyzed;

  return feature;
}

/**
 * Finds nearby settlements affected by a change polygon or point
 */
export function findAffectedSettlements(coords, settlementsIndex = [], maxDistanceKm = 8) {
  if (!coords || !settlementsIndex.length) return [];
  
  let centerLon = 0;
  let centerLat = 0;
  
  // Approximate center of coordinates
  if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
    const ring = coords[0];
    for (const pt of ring) {
      centerLon += pt[0];
      centerLat += pt[1];
    }
    centerLon /= ring.length;
    centerLat /= ring.length;
  } else if (Array.isArray(coords) && typeof coords[0] === 'number') {
    centerLon = coords[0];
    centerLat = coords[1];
  } else {
    return [];
  }

  const matches = [];
  for (const st of settlementsIndex) {
    const stLon = st.coords?.[0] || st.lon || st.lng;
    const stLat = st.coords?.[1] || st.lat;
    if (!stLon || !stLat) continue;

    // Haversine distance
    const dLat = (stLat - centerLat) * Math.PI / 180;
    const dLon = (stLon - centerLon) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(centerLat * Math.PI / 180) * Math.cos(stLat * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distKm = 6371 * c;

    if (distKm <= maxDistanceKm) {
      matches.push({
        name_ru: st.name_ru || st.name,
        name_uk: st.name_uk,
        distance_km: Math.round(distKm * 10) / 10,
        status: st.status || 'contested'
      });
    }
  }

  return matches.sort((a, b) => a.distance_km - b.distance_km).slice(0, 4);
}

/**
 * Compute detailed geometric delta between two historical snapshots
 */
export function computeSnapshotDiff(fromSnapshot, toSnapshot, settlementsIndex = []) {
  const fromDate = fromSnapshot?.metadata?.snapshot_date || 'unknown';
  const toDate = toSnapshot?.metadata?.snapshot_date || 'unknown';

  const toChanges = (toSnapshot?.features || []).filter(f => 
    (f.properties?.type === 'change' || (f.id && String(f.id).startsWith('change-'))) &&
    (Number(f.properties?.area_km2) >= MIN_CHANGE_AREA_KM2)
  );

  let ruAdvanceKm2 = 0;
  let uaAdvanceKm2 = 0;
  let contestedKm2 = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;
  let crossConfirmedCount = 0;
  const sectorsSummary = {};
  const affectedSettlements = [];
  const changesDetail = [];

  for (const feat of toChanges) {
    const p = feat.properties || {};
    const area = Number(p.area_km2) || 0;
    const sector = p.sector || p.sector_id || 'Донецкий сектор';
    const status = p.status || p.to_status || 'change_ru_advance';
    const confScore = p.consensus_score ?? (p.confidence ? (p.confidence <= 1 ? Math.round(p.confidence * 100) : p.confidence) : 92);
    const confLevel = p.confidence_level || getConfidenceLevel(confScore);
    const isCross = p.cross_confirmed || (p.source_ids && p.source_ids.length > 1);

    if (confScore >= 80) highCount++;
    else if (confScore >= 60) mediumCount++;
    else lowCount++;

    if (isCross) crossConfirmedCount++;

    changesDetail.push({
      id: feat.id || p.id,
      name: p.name || 'Смещение ЛБС',
      sector,
      area_km2: area,
      status,
      confidence_score: confScore,
      confidence_level: confLevel,
      cross_confirmed: isCross,
      sources: p.source_ids || p.sources || ['deepstate-map']
    });

    if (status.includes('ru_advance') || status === 'control_ru') {
      ruAdvanceKm2 += area;
    } else if (status.includes('ua_advance') || status === 'control_ua') {
      uaAdvanceKm2 += area;
    } else {
      contestedKm2 += area;
    }

    if (!sectorsSummary[sector]) {
      sectorsSummary[sector] = { sector, ru_km2: 0, ua_km2: 0, contested_km2: 0, changes_count: 0 };
    }
    if (status.includes('ru_advance') || status === 'control_ru') {
      sectorsSummary[sector].ru_km2 += area;
    } else if (status.includes('ua_advance') || status === 'control_ua') {
      sectorsSummary[sector].ua_km2 += area;
    } else {
      sectorsSummary[sector].contested_km2 += area;
    }
    sectorsSummary[sector].changes_count += 1;

    // Find affected settlements
    const near = findAffectedSettlements(feat.geometry?.coordinates, settlementsIndex, 8);
    for (const n of near) {
      if (!affectedSettlements.some(item => item.name_ru === n.name_ru)) {
        affectedSettlements.push({
          ...n,
          sector,
          change_name: p.name || 'Смещение ЛБС'
        });
      }
    }
  }

  // Round summary metrics
  ruAdvanceKm2 = Math.round(ruAdvanceKm2 * 100) / 100;
  uaAdvanceKm2 = Math.round(uaAdvanceKm2 * 100) / 100;
  contestedKm2 = Math.round(contestedKm2 * 100) / 100;
  const totalDeltaKm2 = Math.round((ruAdvanceKm2 + uaAdvanceKm2 + contestedKm2) * 100) / 100;

  return {
    from_date: fromDate,
    to_date: toDate,
    metrics: {
      ru_advance_km2: ruAdvanceKm2,
      ua_advance_km2: uaAdvanceKm2,
      contested_change_km2: contestedKm2,
      total_delta_km2: totalDeltaKm2
    },
    confidence_breakdown: {
      high: highCount,
      medium: mediumCount,
      low: lowCount,
      cross_confirmed: crossConfirmedCount,
      average_confidence: toChanges.length > 0 ? Math.round(changesDetail.reduce((acc, c) => acc + c.confidence_score, 0) / toChanges.length) : 90
    },
    sectors: Object.values(sectorsSummary).map(s => ({
      ...s,
      ru_km2: Math.round(s.ru_km2 * 100) / 100,
      ua_km2: Math.round(s.ua_km2 * 100) / 100,
      contested_km2: Math.round(s.contested_km2 * 100) / 100
    })),
    affected_settlements: affectedSettlements.slice(0, 10),
    changes: changesDetail,
    changes_count: toChanges.length
  };
}

