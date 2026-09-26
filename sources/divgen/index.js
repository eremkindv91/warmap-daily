/**
 * WarMap Daily - DIVGEN Source Adapter
 * Role: HIGH-VALUE OPERATIONAL SOURCE (Early-Warning)
 * Ingests live operational events and situation metrics from https://divgen.ru/api/events and /api/situation.
 * 
 * Rules:
 * 1. DIVGEN is an early-warning source, NOT absolute ground truth.
 * 2. If DIVGEN is first to report a change: mark PENDING_VERIFICATION / CANDIDATE.
 * 3. Never turn an operational event into confirmed control without multi-source or visual corroboration.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createUnifiedSourceData } from '../baseAdapter.js';
import { normalizeToRussian, formatList } from '../../lib/languageValidator.js';
import { classifySectorWithConfidence } from '../../services/warRelevanceFilter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

const DATA_DIR = path.join(ROOT_DIR, 'data/divgen');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

export const DIVGEN_EVENTS_URL = 'https://divgen.ru/api/events';
export const DIVGEN_SITUATION_URL = 'https://divgen.ru/api/situation';
export const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 WarMapDaily/3.0';

/**
 * Safe JSON reader
 */
export function readJson(relPath, defaultValue = null) {
  try {
    const fullPath = path.isAbsolute(relPath) ? relPath : path.join(ROOT_DIR, relPath);
    if (!fs.existsSync(fullPath)) return defaultValue;
    const raw = fs.readFileSync(fullPath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`[DIVGEN Adapter] Error reading ${relPath}:`, e.message);
    return defaultValue;
  }
}

/**
 * Safe JSON writer
 */
export function writeJson(relPath, data) {
  try {
    const fullPath = path.isAbsolute(relPath) ? relPath : path.join(ROOT_DIR, relPath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error(`[DIVGEN Adapter] Error writing ${relPath}:`, e.message);
    return false;
  }
}

/**
 * Classify event intent and operational change candidate
 */
export function parseDivgenEvent(ev) {
  if (!ev) return null;

  const title = (ev.title || '').trim();
  const desc = (ev.description || '').trim();
  const combined = `${title} ${desc}`.toLowerCase();

  // Determine operational direction and assessment
  let status = 'PENDING_VERIFICATION';
  let changeType = 'tactical_event';
  let isAdvanceRu = false;
  let isAdvanceUa = false;
  let isContested = false;

  if (
    combined.includes('освободили') ||
    combined.includes('заняли') ||
    combined.includes('продвигается') ||
    combined.includes('вошла в') ||
    combined.includes('зачистку') ||
    combined.includes('ликвидирован выступ') ||
    combined.includes('закрыли карман')
  ) {
    isAdvanceRu = true;
    status = 'PENDING_VERIFICATION'; // DIVGEN change starts as pending verification!
    changeType = 'ru_advance_candidate';
  } else if (
    combined.includes('всу восстановили') ||
    combined.includes('контрудар всу') ||
    combined.includes('силы обороны отбили') ||
    combined.includes('зачистили позиции')
  ) {
    isAdvanceUa = true;
    status = 'PENDING_VERIFICATION';
    changeType = 'ua_advance_candidate';
  } else if (
    combined.includes('серая зона') ||
    combined.includes('встречные бои') ||
    combined.includes('бои на окраинах')
  ) {
    isContested = true;
    status = 'DISPUTED';
    changeType = 'contested_candidate';
  }

  // Classify front sector
  const sectorInfo = classifySectorWithConfidence(title + ' ' + desc);

  // Parse temporal timestamps
  const eventTime = ev.date || (ev.pdate ? `${ev.pdate}T00:00:00Z` : new Date().toISOString());
  const discoveryTime = new Date().toISOString();

  // Extract clean coordinates
  const lat = parseFloat(ev.lat);
  const lng = parseFloat(ev.lng);
  const hasCoords = !isNaN(lat) && !isNaN(lng) && lat > 44 && lat < 55 && lng > 25 && lng < 45;

  return {
    id: `divgen-${ev.id || ev.idx || crypto.randomUUID()}`,
    source_id: 'divgen',
    source_name: 'DIVGEN Operational Map',
    source_type: 'operational_early_warning',
    external_id: String(ev.id || ''),
    idx: ev.idx || null,
    title: normalizeToRussian(title),
    description: normalizeToRussian(desc),
    event_time: eventTime,
    publication_time: ev.date || eventTime,
    discovery_time: discoveryTime,
    coordinates: hasCoords ? [lng, lat] : null,
    zoom: ev.zoom || 13,
    status,
    change_type: changeType,
    is_advance_ru: isAdvanceRu,
    is_advance_ua: isAdvanceUa,
    is_contested: isContested,
    sector_id: sectorInfo.sector || 'donetsk',
    sector_name: sectorInfo.sector_display || 'Донецкий сектор',
    sector_confidence: sectorInfo.confidence,
    requires_cross_verification: true,
    verification_level: 'LEVEL_D_SINGLE_OSINT_MAP',
    provenance: {
      source: 'DIVGEN',
      source_url: 'https://divgen.ru',
      role: 'EARLY_WARNING_OPERATIONAL',
      initial_confidence: 0.50, // Starts at 0.50 until corroboration
      lineage: ['DIVGEN direct operational report'],
      independent_cluster: 'cluster_divgen'
    }
  };
}

/**
 * Fetches situation metrics from DIVGEN (/api/situation)
 */
export async function fetchDivgenSituation(timeoutMs = 7000) {
  try {
    const res = await fetch(DIVGEN_SITUATION_URL, {
      headers: { 'User-Agent': USER_AGENT, 'Referer': 'https://divgen.ru/' },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.ok && json.data) {
      writeJson('data/divgen/situation.json', json.data);
      return json.data;
    }
    return null;
  } catch (e) {
    console.warn('[DIVGEN Adapter] fetchSituation fallback:', e.message);
    return readJson('data/divgen/situation.json', { today: 0, month: 0, fresh: false });
  }
}

/**
 * Fetches DIVGEN live events with circuit-breaker & caching
 */
export async function fetchDivgenEvents(timeoutMs = 3500, forceRefresh = false) {
  const startTime = Date.now();
  const cachePath = 'data/divgen/latest.json';
  const cached = readJson(cachePath, null);

  // Return fresh cache instantly (TTL: 15 minutes) to avoid blocking HTTP clients
  if (!forceRefresh && cached && cached.events && cached.events.length > 0) {
    const ageMs = Date.now() - new Date(cached.metadata?.retrieved_at || 0).getTime();
    if (ageMs < 15 * 60 * 1000) {
      return {
        source_id: 'divgen',
        items: cached.events,
        situation: cached.metadata?.situation || null,
        latency_ms: 1,
        state: 'cached',
        http_status: 200,
        error: null
      };
    }
  }

  const result = {
    source_id: 'divgen',
    items: [],
    situation: null,
    latency_ms: 0,
    state: 'ok',
    http_status: 200,
    error: null
  };

  try {
    const [eventsRes, situationData] = await Promise.all([
      fetch(DIVGEN_EVENTS_URL, {
        headers: { 'User-Agent': USER_AGENT, 'Referer': 'https://divgen.ru/' },
        signal: AbortSignal.timeout(timeoutMs)
      }),
      fetchDivgenSituation(timeoutMs)
    ]);

    result.situation = situationData;

    if (!eventsRes.ok) {
      throw new Error(`DIVGEN events HTTP ${eventsRes.status}`);
    }

    const json = await eventsRes.json();
    const rawEvents = json.data?.events || [];

    // Parse and normalize events
    const parsedEvents = rawEvents
      .map(ev => parseDivgenEvent(ev))
      .filter(Boolean);

    result.items = parsedEvents;
    result.latency_ms = Date.now() - startTime;

    // Cache latest
    writeJson('data/divgen/latest.json', {
      metadata: {
        source: 'DIVGEN',
        source_url: 'https://divgen.ru',
        retrieved_at: new Date().toISOString(),
        total_events: parsedEvents.length,
        situation: situationData
      },
      events: parsedEvents.slice(-200) // keep last 200 operational events
    });

    return result;
  } catch (err) {
    result.state = 'error';
    result.error = err.message;
    result.latency_ms = Date.now() - startTime;

    // Fallback to cached
    const cached = readJson('data/divgen/latest.json', null);
    if (cached && cached.events) {
      result.items = cached.events;
      result.situation = cached.metadata?.situation || null;
      result.state = 'cached';
    }

    return result;
  }
}

/**
 * Converts DIVGEN candidate events into GeoJSON FeatureCollection
 */
export function divgenEventsToGeoJson(events = []) {
  const features = [];

  for (const ev of events) {
    if (!ev.coordinates) continue;

    const [lng, lat] = ev.coordinates;
    const radiusKm = 1.2; // ~1.2km radius area of interest for candidate change
    const deltaLat = radiusKm / 111.32;
    const deltaLng = radiusKm / (111.32 * Math.cos(lat * Math.PI / 180));

    // Create a local candidate operational polygon
    const polyCoords = [
      [
        [lng - deltaLng, lat - deltaLat],
        [lng + deltaLng, lat - deltaLat],
        [lng + deltaLng * 1.1, lat + deltaLat * 0.9],
        [lng - deltaLng * 0.9, lat + deltaLat * 1.1],
        [lng - deltaLng, lat - deltaLat]
      ]
    ];

    features.push({
      type: 'Feature',
      id: ev.id,
      properties: {
        id: ev.id,
        source: 'DIVGEN',
        source_name: 'DIVGEN Operational Early-Warning',
        title: ev.title,
        description: ev.description,
        status: ev.status, // PENDING_VERIFICATION or DISPUTED
        verification_status: ev.status,
        change_type: ev.change_type,
        sector_id: ev.sector_id,
        sector: ev.sector_name,
        event_time: ev.event_time,
        publication_time: ev.publication_time,
        discovery_time: ev.discovery_time,
        confidence: 0.50, // Candidate initial confidence
        confidence_level: 'LOW',
        requires_cross_verification: true,
        methodology_note: 'Оперативное сообщение DIVGEN. Требует кросс-валидации по фото/видео объективного контроля или другим картам перед утверждением контроля.',
        independent_cluster: 'cluster_divgen'
      },
      geometry: {
        type: 'Polygon',
        coordinates: polyCoords
      }
    });

    // Also push a point marker feature
    features.push({
      type: 'Feature',
      id: `${ev.id}-point`,
      properties: {
        ...ev,
        type: 'point_event',
        marker_symbol: ev.is_advance_ru ? '⚡' : (ev.is_advance_ua ? '🔄' : '⚠️')
      },
      geometry: {
        type: 'Point',
        coordinates: [lng, lat]
      }
    });
  }

  return {
    type: 'FeatureCollection',
    metadata: {
      source: 'DIVGEN',
      role: 'EARLY_WARNING_OPERATIONAL',
      updated_at: new Date().toISOString(),
      features_count: features.length
    },
    features
  };
}

/**
 * Unified Source Data Interface for DIVGEN
 */
export async function getUnifiedDivgenData(targetDate = null) {
  const fetchResult = await fetchDivgenEvents();
  const events = fetchResult.items || [];

  // Filter by date if requested
  const filtered = targetDate
    ? events.filter(e => (e.event_time || '').startsWith(targetDate) || (e.publication_time || '').startsWith(targetDate))
    : events;

  const geojson = divgenEventsToGeoJson(filtered.length ? filtered : events.slice(-50));

  return createUnifiedSourceData({
    source: 'divgen',
    source_type: 'operational_early_warning',
    retrieved_at: new Date().toISOString(),
    published_at: filtered[filtered.length - 1]?.publication_time || new Date().toISOString(),
    version: crypto.createHash('md5').update(JSON.stringify(filtered.slice(-20))).digest('hex').slice(0, 16),
    geometry: geojson,
    metadata: {
      total_events: events.length,
      recent_candidates: filtered.length,
      situation: fetchResult.situation,
      state: fetchResult.state,
      latency_ms: fetchResult.latency_ms
    },
    items: filtered
  });
}

export const divgenAdapter = {
  id: 'divgen',
  name: 'DIVGEN (Оперативный мониторинг ЛБС)',
  type: 'operational_early_warning',
  role: 'Оперативное раннее оповещение (early-warning)',
  fetchRaw: fetchDivgenEvents,
  getUnified: getUnifiedDivgenData,
  parseEvent: parseDivgenEvent
};

export default divgenAdapter;
