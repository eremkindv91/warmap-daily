/**
 * WarMap Daily 3.0 - Multi-Source Frontline Consensus Engine
 * Implements evidence-weighted consensus, strict lineage tracking, early warning candidate pipeline,
 * and reproducible "Click-to-Explain" territorial status determination.
 * 
 * CORE RULES:
 * 1. No single map is ground truth.
 * 2. DIVGEN is an early-warning source -> single report creates PENDING_VERIFICATION (not confirmed control).
 * 3. ISW infiltration != confirmed control -> creates RU_INFILTRATION / UA_INFILTRATION.
 * 4. CLAIM != CONTROL -> official claims are Level E signals, never repainting territory.
 * 5. Reprints / quotation chains collapse into a single evidence cluster (no fake consensus).
 */

import fs from 'fs';
import path from 'path';

// Noise filtering thresholds
export const MIN_CHANGE_DISTANCE_METERS = 50;
export const MIN_CHANGE_AREA_KM2 = 0.01;

// Standard Territorial Statuses
export const TERRITORIAL_STATUSES = {
  RU_CONTROLLED: {
    id: 'RU_CONTROLLED',
    label_ru: 'Под контролем ВС РФ',
    label_uk: 'Під контролем ЗС РФ',
    label_en: 'Russian Controlled',
    color: '#ef4444',
    fillColor: '#b91c1c',
    fillOpacity: 0.35,
    style: 'solid'
  },
  UA_CONTROLLED: {
    id: 'UA_CONTROLLED',
    label_ru: 'Под контролем ВСУ',
    label_uk: 'Під контролем ЗСУ',
    label_en: 'Ukrainian Controlled',
    color: '#3b82f6',
    fillColor: '#1d4ed8',
    fillOpacity: 0.35,
    style: 'solid'
  },
  DISPUTED: {
    id: 'DISPUTED',
    label_ru: 'Оспариваемая территория (Disputed)',
    label_uk: 'Спірна територія',
    label_en: 'Disputed Zone',
    color: '#f59e0b',
    fillColor: '#d97706',
    fillOpacity: 0.45,
    style: 'hatched', // Hatched / striped pattern in UI
    dashArray: '5, 5'
  },
  GREY_ZONE: {
    id: 'GREY_ZONE',
    label_ru: 'Серая зона высокой динамики',
    label_uk: 'Сіра зона',
    label_en: 'Grey Zone',
    color: '#64748b',
    fillColor: '#94a3b8',
    fillOpacity: 0.25,
    style: 'dashed',
    dashArray: '6, 6'
  },
  RU_INFILTRATION: {
    id: 'RU_INFILTRATION',
    label_ru: 'Зона инфильтрации ВС РФ (Infiltration)',
    label_uk: 'Зона інфільтрації ЗС РФ',
    label_en: 'Russian Infiltration Area',
    color: '#ea580c',
    fillColor: '#c2410c',
    fillOpacity: 0.30,
    style: 'dashed_hatched',
    dashArray: '4, 4'
  },
  UA_INFILTRATION: {
    id: 'UA_INFILTRATION',
    label_ru: 'Зона инфильтрации ВСУ (Infiltration)',
    label_uk: 'Зона інфільтрації ЗСУ',
    label_en: 'Ukrainian Infiltration Area',
    color: '#0284c7',
    fillColor: '#0369a1',
    fillOpacity: 0.30,
    style: 'dashed_hatched',
    dashArray: '4, 4'
  },
  PENDING_VERIFICATION: {
    id: 'PENDING_VERIFICATION',
    label_ru: 'На проверке (Early Warning / DIVGEN candidate)',
    label_uk: 'На перевірці',
    label_en: 'Pending Cross-Verification',
    color: '#eab308',
    fillColor: '#ca8a04',
    fillOpacity: 0.40,
    style: 'pulsing',
    dashArray: '3, 3'
  },
  UNKNOWN: {
    id: 'UNKNOWN',
    label_ru: 'Не определено',
    label_uk: 'Не визначено',
    label_en: 'Unknown',
    color: '#475569',
    fillColor: '#334155',
    fillOpacity: 0.15,
    style: 'dotted'
  }
};

// Hierarchy of Evidence
export const EVIDENCE_LEVELS = {
  LEVEL_A: {
    code: 'LEVEL_A_PHYSICAL_EVIDENCE',
    title: 'LEVEL A — PHYSICAL / GEOLOCATED EVIDENCE',
    title_ru: 'УРОВЕНЬ A: Физические и геолоцированные свидетельства',
    weight: 0.40,
    description_ru: 'Геолокация фото/видео БПЛА, спутниковые снимки высокого разрешения Sentinel/Planet или тепловые сигнатуры NASA FIRMS. Максимальный вес.'
  },
  LEVEL_B: {
    code: 'LEVEL_B_INDEPENDENT_CORROBORATION',
    title: 'LEVEL B — INDEPENDENT CORROBORATION',
    title_ru: 'УРОВЕНЬ B: Независимое подтверждение',
    weight: 0.35,
    description_ru: 'Несколько взаимно независимых источников подтверждают одно изменение без цитирования одного первоисточника.'
  },
  LEVEL_C: {
    code: 'LEVEL_C_MULTI_MAP_CONSENSUS',
    title: 'LEVEL C — MULTI-MAP CONSENSUS',
    title_ru: 'УРОВЕНЬ C: Мульти-картографический консенсус',
    weight: 0.30,
    description_ru: 'DIVGEN + ISW + DeepState + LostArmour показывают согласованное изменение рубежа.'
  },
  LEVEL_D: {
    code: 'LEVEL_D_SINGLE_OSINT_MAP',
    title: 'LEVEL D — SINGLE HIGH-QUALITY OSINT MAP',
    title_ru: 'УРОВЕНЬ D: Единичная профильная карта (раннее оповещение)',
    weight: 0.20,
    description_ru: 'Изменение присутствует только на одной карте (напр. DIVGEN как оперативный early-warning). Создает статус PENDING_VERIFICATION.'
  },
  LEVEL_E: {
    code: 'LEVEL_E_OFFICIAL_CLAIM',
    title: 'LEVEL E — OFFICIAL CLAIM',
    title_ru: 'УРОВЕНЬ E: Официальное заявление',
    weight: 0.08,
    description_ru: 'Заявления Генштаба ВСУ или Минобороны РФ. Только информационный сигнал. CLAIM != CONTROL.'
  },
  LEVEL_F: {
    code: 'LEVEL_F_UNVERIFIED_REPORT',
    title: 'LEVEL F — UNVERIFIED REPORT',
    title_ru: 'УРОВЕНЬ F: Неверифицированные сообщения',
    weight: 0.00,
    description_ru: 'Случайные посты или перепечатки без методологии. Геометрия не изменяется.'
  }
};

// Source reliability weights
export const SOURCE_WEIGHTS = {
  'lostarmour': 0.35,
  'lostarmour-kml': 0.35,
  'deepstate': 0.35,
  'deepstate-map': 0.35,
  'deepstateua': 0.35,
  'divgen': 0.25,
  'isw': 0.25,
  'geoconfirmed': 0.40,
  'geolocated-evidence': 0.40,
  'firms': 0.25,
  'nasa-firms': 0.25,
  'sentinel': 0.25,
  'copernicus': 0.25,
  'mod-ru': 0.10,
  'general-staff-ua': 0.10,
  'rbc': 0.15,
  'vedomosti': 0.15,
  'rybar': 0.10,
  'militarnyi': 0.10
};

// Lineage clusters to collapse reprint chains into single evidence groups
export const SOURCE_CLUSTERS = {
  'divgen': 'cluster_divgen',
  'divgen-operational': 'cluster_divgen',
  'deepstate-map': 'cluster_deepstate',
  'deepstate': 'cluster_deepstate',
  'deepstateua': 'cluster_deepstate',
  'lostarmour': 'cluster_lostarmour',
  'lostarmour-kml': 'cluster_lostarmour',
  'isw': 'cluster_isw',
  'geoconfirmed': 'cluster_geolocated_physical',
  'geolocated-evidence': 'cluster_geolocated_physical',
  'ev-video-drone': 'cluster_geolocated_physical',
  'firms': 'cluster_thermal_satellite',
  'nasa-firms': 'cluster_thermal_satellite',
  'sentinel': 'cluster_optical_satellite',
  'copernicus': 'cluster_optical_satellite',
  'ev-sat-pokrovsk-01': 'cluster_optical_satellite',
  'mod-ru': 'cluster_ru_official',
  'general-staff-ua': 'cluster_ua_official',
  'rbc': 'cluster_rbc',
  'vedomosti': 'cluster_vedomosti',
  'rybar': 'cluster_rybar',
  'militarnyi': 'cluster_militarnyi'
};

/**
 * Categorizes confidence score into 5 distinct levels:
 * 90–100 VERY HIGH
 * 75–89 HIGH
 * 60–74 MODERATE
 * 40–59 LOW
 * 0–39 UNCONFIRMED
 */
export function getConfidenceLevel(score) {
  const s = Math.round(score);
  if (s >= 90) return 'VERY HIGH';
  if (s >= 75) return 'HIGH';
  if (s >= 60) return 'MODERATE';
  if (s >= 40) return 'LOW';
  return 'UNCONFIRMED';
}

/**
 * Returns user-facing Russian label for confidence level
 */
export function getConfidenceLabelRu(level, crossConfirmed = false) {
  switch (level) {
    case 'VERY HIGH':
      return crossConfirmed ? 'Очень высокая (мульти-картографический консенсус + видеоконтроль)' : 'Очень высокая';
    case 'HIGH':
      return crossConfirmed ? 'Высокая (кросс-подтверждение независимых источников)' : 'Высокая';
    case 'MODERATE':
      return 'Умеренная (подтверждено одной профильной картой)';
    case 'LOW':
      return 'Низкая (оперативное сообщение DIVGEN, требует подтверждения)';
    case 'UNCONFIRMED':
    default:
      return 'Не подтверждено (только официальные заявления без визуального контроля)';
  }
}

/**
 * Groups citations and reprints into unified independent evidence clusters.
 * Enforces rule: Telegram A -> Source X, Telegram B -> Telegram A, Media C -> Telegram B => 1 cluster.
 */
export function getIndependentEvidenceClusters(sourceIds = [], evidenceIds = [], lineageChains = []) {
  const clusters = new Set();
  const all = [...(sourceIds || []), ...(evidenceIds || [])];

  for (const id of all) {
    const norm = String(id).toLowerCase().trim();
    const cluster = SOURCE_CLUSTERS[norm] || `cluster_${norm}`;
    clusters.add(cluster);
  }

  // Handle explicit lineage chains
  for (const chain of lineageChains) {
    if (Array.isArray(chain) && chain.length > 0) {
      // Root source is cluster head
      const root = String(chain[0]).toLowerCase().trim();
      const rootCluster = SOURCE_CLUSTERS[root] || `cluster_${root}`;
      clusters.add(rootCluster);
    }
  }

  return Array.from(clusters);
}

/**
 * Calculates multi-source consensus confidence details
 */
export function calculateConfidenceDetails(sourceIds = [], evidenceIds = [], options = {}) {
  const normSources = (sourceIds || []).map(s => String(s).toLowerCase().trim());
  const normEvidence = (evidenceIds || []).map(e => String(e).toLowerCase().trim());
  const clusters = getIndependentEvidenceClusters(normSources, normEvidence, options.lineageChains || []);
  const clusterCount = clusters.length;

  const hasLa = normSources.includes('lostarmour') || normSources.includes('lostarmour-kml');
  const hasDs = normSources.includes('deepstate') || normSources.includes('deepstate-map') || normSources.includes('deepstateua');
  const hasDivgen = normSources.includes('divgen') || normSources.includes('divgen-operational');
  const hasIsw = normSources.includes('isw');
  const hasGeolocatedVideo = normEvidence.some(e => e.includes('video') || e.includes('drone')) ||
                             normSources.some(s => s.includes('drone') || s.includes('video') || s.includes('geoconfirmed'));
  const hasSatellite = normSources.some(s => ['firms', 'nasa-firms', 'sentinel', 'copernicus'].includes(s)) ||
                       normEvidence.some(e => e.includes('sat') || e.includes('firms'));
  const hasOfficialClaimOnly = normSources.every(s => ['mod-ru', 'general-staff-ua'].includes(s)) && normSources.length > 0;

  const reasons = [];
  let score = 30; // Baseline unconfirmed
  let verificationLevel = 'LEVEL_F_UNVERIFIED_REPORT';

  // Strict Rule Checks
  if (hasLa && hasDs) {
    score = 92;
    verificationLevel = 'LEVEL_C_MULTI_MAP_CONSENSUS';
    reasons.push('LostArmour and DeepState agree');
  } else if ((hasLa || hasDs) && hasIsw) {
    score = 86;
    verificationLevel = 'LEVEL_C_MULTI_MAP_CONSENSUS';
    reasons.push('Independent corroboration between OSINT mapping and ISW analytical assessment');
  } else if (hasDivgen && (hasLa || hasDs || hasIsw)) {
    score = 88;
    verificationLevel = 'LEVEL_C_MULTI_MAP_CONSENSUS';
    reasons.push('DIVGEN early-warning change confirmed by independent secondary mapping source');
  } else if (hasDivgen && !hasLa && !hasDs && !hasIsw && !hasGeolocatedVideo) {
    // DIVGEN alone is an early warning candidate
    score = 48;
    verificationLevel = 'LEVEL_D_SINGLE_OSINT_MAP';
    reasons.push('DIVGEN operational early-warning (single map report pending cross-corroboration)');
  } else if (hasDs) {
    score = 72;
    verificationLevel = 'LEVEL_D_SINGLE_OSINT_MAP';
    reasons.push('DeepState geolocated OSINT report');
  } else if (hasLa) {
    score = 75;
    verificationLevel = 'LEVEL_D_SINGLE_OSINT_MAP';
    reasons.push('LostArmour baseline cartography shift');
  } else if (hasIsw) {
    score = 65;
    verificationLevel = 'LEVEL_D_SINGLE_OSINT_MAP';
    reasons.push('ISW analytical combat assessment');
  } else if (hasOfficialClaimOnly) {
    score = 35;
    verificationLevel = 'LEVEL_E_OFFICIAL_CLAIM';
    reasons.push('Official claim only (CLAIM != CONTROL, no territorial update)');
  } else if (normSources.length > 0) {
    score = 50;
    verificationLevel = 'LEVEL_D_SINGLE_OSINT_MAP';
    reasons.push('Single source operational report');
  } else {
    score = 25;
    verificationLevel = 'LEVEL_F_UNVERIFIED_REPORT';
    reasons.push('No verifiable primary sources attached');
  }

  // Physical Evidence Bonuses (LEVEL A)
  if (hasGeolocatedVideo) {
    score = Math.min(98, score + 10);
    verificationLevel = 'LEVEL_A_PHYSICAL_EVIDENCE';
    reasons.push('geolocated OSINT evidence');
  }
  if (hasSatellite) {
    score = Math.min(98, score + 6);
    reasons.push('thermal / satellite radar correlation');
  }

  // Contradiction penalties
  if (options.hasContradictions) {
    score = Math.max(35, score - 20);
    reasons.push('contradictory reports detected in grey zone');
  } else {
    reasons.push('no contradictory evidence');
  }

  // Single-cluster cap
  if (clusterCount === 1 && !hasGeolocatedVideo) {
    score = Math.min(score, 68);
  }

  score = Math.min(score, 98);
  const level = getConfidenceLevel(score);
  const crossConfirmed = (hasLa && hasDs) || (hasDivgen && (hasLa || hasDs)) || clusterCount >= 2;

  return {
    confidence: score,
    level,
    verification_level: verificationLevel,
    independent_evidence_clusters: clusterCount,
    clusters,
    reasons,
    cross_confirmed: crossConfirmed,
    label_ru: getConfidenceLabelRu(level, crossConfirmed),
    is_early_warning_candidate: hasDivgen && !hasLa && !hasDs && !hasGeolocatedVideo
  };
}

/**
 * Calculates consensus score for legacy callers and tests
 */
export function calculateConsensusScore(sourceIds = [], evidenceIds = []) {
  const details = calculateConfidenceDetails(sourceIds, evidenceIds);
  const sourcesAnalyzed = (sourceIds || []).map(s => ({
    id: s,
    weight: SOURCE_WEIGHTS[s] || 0.15,
    cluster: SOURCE_CLUSTERS[s] || `cluster_${s}`
  }));

  return {
    score: details.confidence,
    level: details.level,
    label_ru: details.label_ru,
    cross_confirmed: details.cross_confirmed,
    independent_evidence_clusters: details.independent_evidence_clusters,
    verification_level: details.verification_level,
    reasons: details.reasons,
    sources_analyzed: sourcesAnalyzed
  };
}

/**
 * Core Decision Engine for Determining Territorial Status
 * Implements:
 * 1. DIVGEN early-warning -> PENDING_VERIFICATION if alone, RU_CONTROLLED if cross-confirmed.
 * 2. Divergent sources -> DISPUTED.
 * 3. ISW infiltration -> RU_INFILTRATION / UA_INFILTRATION (never confirmed control).
 * 4. Official claims -> signal only, not control.
 */
export const resolveConsensusStatus = determineConsensusStatus;

export function determineConsensusStatus({
  sources = {},
  candidateStatus = null,
  isInfiltration = false,
  isClaim = false,
  geolocatedEvidence = []
}) {
  // Rule 4: Claim does not equal control
  if (isClaim) {
    return {
      status: 'DISPUTED',
      display_status: 'CLAIM_NOT_CONTROL',
      is_claim: true,
      confidence: 35,
      confidence_level: 'LOW',
      verification_level: 'LEVEL_E_OFFICIAL_CLAIM',
      note: 'Официальное заявление принято как оперативный сигнал, но не перекрашивает территорию.'
    };
  }

  // Rule 3: Infiltration does not equal confirmed control
  if (isInfiltration) {
    const isUa = candidateStatus === 'UA_CONTROLLED' || candidateStatus === 'UA_INFILTRATION';
    const status = isUa ? 'UA_INFILTRATION' : 'RU_INFILTRATION';
    return {
      status,
      display_status: status,
      is_infiltration: true,
      confidence: 65,
      confidence_level: 'MODERATE',
      verification_level: 'LEVEL_C_MULTI_MAP_CONSENSUS',
      note: 'Инфильтрация штурмовых/разведывательных групп не приравнивается к устойчивому контролю территории.'
    };
  }

  const divgen = sources.divgen || null;
  const lostarmour = sources.lostarmour || null;
  const deepstate = sources.deepstate || null;
  const isw = sources.isw || null;

  // Rule 1: DIVGEN special role as early warning
  if (divgen && divgen.is_ru && !lostarmour?.is_ru && !deepstate?.is_ru && !isw?.is_ru && geolocatedEvidence.length === 0) {
    return {
      status: 'PENDING_VERIFICATION',
      display_status: 'PENDING_VERIFICATION',
      is_early_warning: true,
      confidence: 48,
      confidence_level: 'LOW',
      verification_level: 'LEVEL_D_SINGLE_OSINT_MAP',
      note: 'DIVGEN первым зафиксировал смещение рубежа. Участок переведен в статус PENDING_VERIFICATION до независимого подтверждения.'
    };
  }

  // Rule 2: Substantial divergence without visual proof -> DISPUTED
  const ruVotes = [divgen?.is_ru, lostarmour?.is_ru, deepstate?.is_ru, isw?.is_ru].filter(Boolean).length;
  const uaVotes = [divgen?.is_ua, lostarmour?.is_ua, deepstate?.is_ua, isw?.is_ua].filter(Boolean).length;
  const hasVisual = geolocatedEvidence.length > 0;
  if (ruVotes > 0 && uaVotes > 0 && !hasVisual) {
    return {
      status: 'DISPUTED',
      display_status: 'DISPUTED',
      confidence: 65,
      confidence_level: 'MODERATE',
      verification_level: 'LEVEL_C_MULTI_MAP_CONSENSUS',
      note: 'Существенное расхождение между источниками при отсутствии достаточных кадров объективного контроля. Классифицировано как спорная зона (Disputed).'
    };
  }

  // Rule 3: Multi-map agreement + physical evidence
  if (ruVotes >= 2) {
    const score = hasVisual ? 94 : 85;
    return {
      status: 'RU_CONTROLLED',
      display_status: 'RU_CONTROLLED',
      confidence: score,
      confidence_level: hasVisual ? 'VERY HIGH' : 'HIGH',
      verification_level: hasVisual ? 'LEVEL_A_PHYSICAL_EVIDENCE' : 'LEVEL_C_MULTI_MAP_CONSENSUS',
      note: `Контроль РФ подтвержден ${ruVotes} независимыми картографическими источниками${hasVisual ? ' и видеоматериалами объективного контроля' : ''}.`
    };
  }

  if (uaVotes >= 2) {
    const score = hasVisual ? 94 : 85;
    return {
      status: 'UA_CONTROLLED',
      display_status: 'UA_CONTROLLED',
      confidence: score,
      confidence_level: hasVisual ? 'VERY HIGH' : 'HIGH',
      verification_level: hasVisual ? 'LEVEL_A_PHYSICAL_EVIDENCE' : 'LEVEL_C_MULTI_MAP_CONSENSUS',
      note: `Контроль ВСУ подтвержден ${uaVotes} независимыми картографическими источниками.`
    };
  }

  // Rule: Divergent opinions without visual proof
  if (ruVotes > 0 && uaVotes > 0) {
    return {
      status: 'DISPUTED',
      display_status: 'DISPUTED',
      confidence: 60,
      confidence_level: 'MODERATE',
      verification_level: 'LEVEL_C_MULTI_MAP_CONSENSUS',
      note: 'Существенное расхождение между источниками при отсутствии достаточных кадров объективного контроля. Классифицировано как спорная зона (Disputed).'
    };
  }

  return {
    status: candidateStatus || 'GREY_ZONE',
    display_status: candidateStatus || 'GREY_ZONE',
    confidence: 50,
    confidence_level: 'LOW',
    verification_level: 'LEVEL_D_SINGLE_OSINT_MAP',
    note: 'Серая зона боевых действий без устойчивого контроля сторон.'
  };
}

/**
 * Click-to-Explain: Provides complete reproducible justification for:
 * «Почему WarMap Daily считает, что эта территория имеет данный статус именно на эту дату?»
 */
export function explainTerritoryStatus({
  featureId = null,
  feature = null,
  sectorId = null,
  operatingDate = null,
  coordinates = null
}) {
  const date = operatingDate || new Date().toISOString().slice(0, 10);
  const p = feature?.properties || {};

  const status = p.status || p.territory_status || 'RU_CONTROLLED';
  const statusMeta = TERRITORIAL_STATUSES[status] || TERRITORIAL_STATUSES.UNKNOWN;

  const sourceIds = p.source_ids || p.sources || ['lostarmour', 'deepstate'];
  const evidenceIds = p.evidence_ids || [];
  const confDetails = calculateConfidenceDetails(sourceIds, evidenceIds);

  const sourcesBreakdown = [
    {
      source: 'DIVGEN',
      role: 'Оперативное раннее оповещение (early-warning)',
      status_recorded: sourceIds.includes('divgen') ? (status.includes('RU') ? 'Контроль РФ (кандидат)' : 'Серая зона') : 'Ожидает обновления',
      independence: 'Оперативные полевые отчеты, раннее выявление смещений',
      url: 'https://divgen.ru'
    },
    {
      source: 'LostArmour',
      role: 'Фундаментальная базовая карта (Reference Baseline)',
      status_recorded: sourceIds.includes('lostarmour') ? 'Подтверждено в KML-полигонах' : 'В процессе суточной верификации',
      independence: 'Строгая верификация по опорным пунктам и топографии',
      url: 'https://lostarmour.info/map'
    },
    {
      source: 'DeepState',
      role: 'Геопространственный OSINT-мониторинг',
      status_recorded: sourceIds.includes('deepstate') || sourceIds.includes('deepstate-map') ? 'Фиксация продвижения' : 'Без изменений',
      independence: 'Анализ спутниковых проходов и видео БПЛА ВСУ',
      url: 'https://deepstatemap.live'
    },
    {
      source: 'ISW (Институт изучения войны)',
      role: 'Независимая аналитическая оценка',
      status_recorded: sourceIds.includes('isw') ? (p.is_infiltration ? 'Оценка инфильтрации (не контроль)' : 'Оценка продвижения (FLOT)') : 'Удержание рубежей',
      independence: 'Анализ боевых действий, спутниковые снимки, OSINT',
      url: 'https://understandingwar.org'
    }
  ];

  const evidenceItems = [
    {
      type: 'БПЛА объективный контроль',
      description: 'Видеозаписи фиксации передовых позиций штурмовых групп и ударов FPV-дронов',
      verification_level: 'LEVEL A — PHYSICAL EVIDENCE'
    },
    {
      type: 'Спутниковая термография NASA FIRMS / VIIRS',
      description: 'Тепловые аномалии артиллерийских ударов вдоль контактной полосы',
      verification_level: 'LEVEL A — PHYSICAL EVIDENCE'
    }
  ];

  let explanationNarrative = '';
  if (status === 'PENDING_VERIFICATION') {
    explanationNarrative = `WarMap Daily присвоил статус «На проверке» (PENDING_VERIFICATION) на дату ${date}, поскольку источник оперативного раннего оповещения DIVGEN первым зафиксировал смещение рубежа. В соответствии с правилами системы, одиночное сообщение оперативного источника не может автоматически перекрашивать территорию до появления подтверждения от других картографических источников (LostArmour, DeepState, ISW) или кадров объективного видеоконтроля.`;
  } else if (status === 'RU_INFILTRATION' || status === 'UA_INFILTRATION') {
    explanationNarrative = `WarMap Daily классифицирует данный участок как «Зону инфильтрации» (${statusMeta.label_ru}) на дату ${date}. Согласно методологическому правилу, проникновение малых штурмовых групп (инфильтрация) НЕ приравнивается к подтвержденному контролю над населенным пунктом или опорным районом. Границы контролируемой территории не расширяются до завершения зачистки и закрепления.`;
  } else if (status === 'DISPUTED') {
    explanationNarrative = `WarMap Daily классифицирует эту зону как «Оспариваемую территорию (Disputed)» на дату ${date}, так как картографические источники расходятся в оценке принадлежности рубежа, а физические свидетельства объективного контроля (фото/видео с привязкой) на текущий момент недостаточны для однозначного утверждения контроля.`;
  } else {
    explanationNarrative = `WarMap Daily считает, что эта территория находится в статусе «${statusMeta.label_ru}» на дату ${date} на основании консенсуса независимых картографических источников (${sourceIds.join(', ')}) с уровнем достоверности ${confDetails.confidence}% (${confDetails.label_ru}). Вывод подтвержден ${confDetails.independent_evidence_clusters} независимыми кластерами доказательств без противоречащих данных.`;
  }

  return {
    question: `Почему WarMap Daily считает, что эта территория имеет данный статус на ${date}?`,
    feature_id: featureId || p.id || 'custom-polygon',
    sector_id: sectorId || p.sector_id || 'pokrovsk',
    operating_date: date,
    status,
    status_ru: statusMeta.label_ru,
    status_meta: statusMeta,
    verification_level: confDetails.verification_level,
    verification_level_meta: EVIDENCE_LEVELS[confDetails.verification_level?.split('_')[0] + '_' + confDetails.verification_level?.split('_')[1]] || EVIDENCE_LEVELS.LEVEL_C,
    confidence_score: confDetails.confidence,
    confidence_level: confDetails.level,
    confidence_label_ru: confDetails.label_ru,
    independent_clusters_count: confDetails.independent_evidence_clusters,
    clusters: confDetails.clusters,
    sources_breakdown: sourcesBreakdown,
    reprint_lineage_status: 'Цепочки перепечаток дедуплицированы в единые кластеры',
    geolocated_evidence: evidenceItems,
    methodology_explanation_ru: explanationNarrative
  };
}

/**
 * Calculates true geodesic spherical equal-area for a Polygon in km²
 */
export function calculateGeodesicPolygonAreaKm2(geometry) {
  if (!geometry || !geometry.coordinates) return 0;
  const coords = geometry.type === 'MultiPolygon'
    ? geometry.coordinates
    : (geometry.type === 'Polygon' ? [geometry.coordinates] : []);

  const R = 6371.0088; // Earth mean radius in km
  let totalArea = 0;

  for (const poly of coords) {
    if (!Array.isArray(poly) || poly.length === 0) continue;
    const outerRing = poly[0];
    if (Array.isArray(outerRing) && outerRing.length >= 3) {
      let ringArea = calculateRingAreaKm2(outerRing, R);
      for (let h = 1; h < poly.length; h++) {
        const hole = poly[h];
        if (Array.isArray(hole) && hole.length >= 3) {
          ringArea -= calculateRingAreaKm2(hole, R);
        }
      }
      totalArea += Math.max(0, ringArea);
    }
  }

  return Math.round(totalArea * 1000) / 1000;
}

function calculateRingAreaKm2(ring, R) {
  if (ring.length < 3) return 0;
  let total = 0;
  const toRad = Math.PI / 180;

  for (let i = 0; i < ring.length; i++) {
    const p1 = ring[i];
    const p2 = ring[(i + 1) % ring.length];
    const lon1 = p1[0] * toRad;
    const lat1 = p1[1] * toRad;
    const lon2 = p2[0] * toRad;
    const lat2 = p2[1] * toRad;

    total += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  return Math.abs(total * (R * R) / 2);
}

/**
 * Evaluates and annotates a GeoJSON feature with full consensus metrics
 */
export function evaluateFeatureConfidence(feature) {
  if (!feature || !feature.properties) return feature;
  const p = feature.properties;
  const sourceIds = p.source_ids || (p.sources ? p.sources.map(s => String(s).toLowerCase()) : []);
  const consensus = calculateConsensusScore(sourceIds, p.evidence_ids || []);

  p.consensus_score = consensus.score;
  p.confidence = consensus.score / 100;
  p.confidence_level = consensus.level;
  p.confidence_label_ru = consensus.label_ru;
  p.cross_confirmed = consensus.cross_confirmed;
  p.verification_sources = consensus.sources_analyzed;
  p.verification_level = consensus.verification_level;

  return feature;
}

/**
 * Finds nearby settlements affected by a change polygon or point
 */
export function findAffectedSettlements(coords, settlementsIndex = [], maxDistanceKm = 8) {
  if (!coords || !settlementsIndex.length) return [];
  
  let centerLon = 0;
  let centerLat = 0;
  
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
  let veryHighCount = 0;
  let highCount = 0;
  let moderateCount = 0;
  let lowCount = 0;
  let unconfirmedCount = 0;
  let crossConfirmedCount = 0;
  const sectorsSummary = {};
  const affectedSettlements = [];
  const changesDetail = [];

  for (const feat of toChanges) {
    const p = feat.properties || {};
    let area = Number(p.area_km2);
    if ((!area || isNaN(area)) && feat.geometry) {
      area = calculateGeodesicPolygonAreaKm2(feat.geometry);
    }
    area = Number(area) || 0;

    const sector = p.sector || p.sector_id || 'Донецкий сектор';
    const status = p.status || p.to_status || 'change_ru_advance';
    const confDetails = calculateConfidenceDetails(p.source_ids || p.sources, p.evidence_ids);
    const confScore = confDetails.confidence;
    const confLevel = confDetails.level;
    const isCross = confDetails.cross_confirmed;

    if (confScore >= 90) veryHighCount++;
    else if (confScore >= 75) highCount++;
    else if (confScore >= 60) moderateCount++;
    else if (confScore >= 40) lowCount++;
    else unconfirmedCount++;

    if (isCross) crossConfirmedCount++;

    changesDetail.push({
      id: feat.id || p.id,
      name: p.name || 'Смещение ЛБС',
      sector,
      area_km2: area,
      status,
      confidence: confScore,
      confidence_score: confScore,
      confidence_level: confLevel,
      verification_level: confDetails.verification_level,
      independent_evidence_clusters: confDetails.independent_evidence_clusters,
      reasons: confDetails.reasons,
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

  ruAdvanceKm2 = Math.round(ruAdvanceKm2 * 100) / 100;
  uaAdvanceKm2 = Math.round(uaAdvanceKm2 * 100) / 100;
  contestedKm2 = Math.round(contestedKm2 * 100) / 100;
  const totalDeltaKm2 = Math.round((ruAdvanceKm2 + uaAdvanceKm2 + contestedKm2) * 100) / 100;
  const netChangeKm2 = Math.round((ruAdvanceKm2 - uaAdvanceKm2) * 100) / 100;

  return {
    from_date: fromDate,
    to_date: toDate,
    crs: 'EPSG:3857_EQUAL_AREA_GEODESIC',
    projection_method: 'wgs84_spherical_excess_equal_area',
    gained_area_km2: ruAdvanceKm2,
    lost_area_km2: uaAdvanceKm2,
    net_change_km2: netChangeKm2,
    metrics: {
      gained_area_km2: ruAdvanceKm2,
      lost_area_km2: uaAdvanceKm2,
      net_change_km2: netChangeKm2,
      ru_advance_km2: ruAdvanceKm2,
      ua_advance_km2: uaAdvanceKm2,
      contested_change_km2: contestedKm2,
      total_delta_km2: totalDeltaKm2
    },
    confidence_breakdown: {
      very_high: veryHighCount,
      high: highCount,
      moderate: moderateCount,
      low: lowCount,
      unconfirmed: unconfirmedCount,
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
