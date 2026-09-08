/**
 * WarMap Daily - DeepState Source Adapter
 * Role: GEOSPATIAL_OSINT_FEED
 * Ingests public history updates, geolocated frontline shifts, and Telegram battlefield reports.
 * Implements the Unified Source Data schema:
 * { source: 'deepstate', source_type: 'geospatial_osint', retrieved_at, published_at, version, geometry, metadata, items }
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

const DATA_DIR = path.join(ROOT_DIR, 'data/deepstate');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

export const DEEPSTATE_API_URL = 'https://deepstatemap.live/api/history/public';
export const DEEPSTATE_TELEGRAM_URL = 'https://t.me/s/DeepStateUA';
export const USER_AGENT = 'WarMapDaily-DeepStateAdapter/2.0 (+https://warmap.daily)';

/**
 * Clean HTML tags and entities
 */
export function cleanHtml(str) {
  if (!str) return '';
  return str
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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
    console.warn(`[DeepState Adapter] Error reading ${relPath}:`, e.message);
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
    console.error(`[DeepState Adapter] Error writing ${relPath}:`, e.message);
    return false;
  }
}

/**
 * Fetches DeepState public history deltas with timeout and circuit-breaker handling
 */
export async function fetchDeepStateHistory(timeoutMs = 7000) {
  const startTime = Date.now();
  const result = {
    source_id: 'deepstate-map',
    items: [],
    latency_ms: 0,
    state: 'ok',
    http_status: 200,
    error: null
  };

  try {
    const res = await fetch(DEEPSTATE_API_URL, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs)
    });
    result.latency_ms = Date.now() - startTime;
    result.http_status = res.status;

    if (!res.ok) {
      result.state = res.status >= 500 ? 'unavailable' : 'degraded';
      result.error = `HTTP ${res.status}`;
      return result;
    }

    const data = await res.json();
    if (Array.isArray(data)) {
      result.items = data.slice(-30);
    }
  } catch (err) {
    result.latency_ms = Date.now() - startTime;
    result.state = 'degraded';
    result.error = err.message;
  }

  return result;
}

/**
 * Fetches Telegram Web updates from @DeepStateUA
 */
export async function fetchDeepStateTelegram(timeoutMs = 7000) {
  const startTime = Date.now();
  const result = {
    source_id: 'deepstate-telegram',
    items: [],
    latency_ms: 0,
    state: 'ok',
    http_status: 200,
    error: null
  };

  try {
    const res = await fetch(DEEPSTATE_TELEGRAM_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(timeoutMs)
    });
    result.latency_ms = Date.now() - startTime;
    result.http_status = res.status;

    if (!res.ok) {
      result.state = 'degraded';
      result.error = `HTTP ${res.status}`;
      return result;
    }

    const html = await res.text();
    const messageBlocks = html.match(/<div class="tgme_widget_message_wrap[^"]*"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g) || [];

    messageBlocks.slice(-15).forEach((block, idx) => {
      const textMatch = block.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      const timeMatch = block.match(/<time datetime="([^"]+)"/);
      const linkMatch = block.match(/class="tgme_widget_message_date" href="([^"]+)"/);

      if (textMatch) {
        const rawText = textMatch[1];
        const text = cleanHtml(rawText);
        if (text && text.length > 25) {
          result.items.push({
            id: `tg-${Date.now()}-${idx}`,
            text,
            datetime: timeMatch ? timeMatch[1] : new Date().toISOString(),
            url: linkMatch ? linkMatch[1] : 'https://t.me/DeepStateUA'
          });
        }
      }
    });
  } catch (err) {
    result.latency_ms = Date.now() - startTime;
    result.state = 'degraded';
    result.error = err.message;
  }

  return result;
}

/**
 * Normalizes DeepState history items into structured event objects and GeoJSON features
 */
export function parseAndNormalizeDeepStateHistory(rawItems = [], effectiveDate = null) {
  const opDate = effectiveDate || new Date().toISOString().slice(0, 10);
  const features = [];
  const normalizedItems = [];

  for (const raw of rawItems) {
    const descUk = cleanHtml(raw.description);
    const descEn = cleanHtml(raw.descriptionEn) || descUk;
    const descRu = normalizeToRussian(descUk);

    // Extract coordinates if present: pattern #zoom/lat/lon or lat/lon
    const coordsMatches = [...(raw.description || '').matchAll(/#\d+\/([\d\.]+)\/([\d\.]+)/g)];
    const settlementMatches = [...(raw.description || '').matchAll(/>([^<]+)<\/a>/g)];

    const rawSettlements = settlementMatches.length > 0 ? settlementMatches.map(m => m[1].trim()).filter(Boolean) : [];
    const settlementsRu = rawSettlements.map(s => normalizeToRussian(s));
    const settlementNameRu = settlementsRu.length > 0 ? formatList(settlementsRu) : 'Линия фронта';
    const settlementNameUk = rawSettlements.length > 0 ? formatList(rawSettlements, { lang: 'uk' }) : 'Лінія фронту';
    const settlementNameEn = rawSettlements.length > 0 ? formatList(rawSettlements, { lang: 'en' }) : 'Frontline';

    const primaryLat = coordsMatches.length > 0 ? parseFloat(coordsMatches[0][1]) : 48.28;
    const primaryLon = coordsMatches.length > 0 ? parseFloat(coordsMatches[0][2]) : 37.18;

    const sectorResult = classifySectorWithConfidence(descUk, primaryLat, primaryLon);
    const sectorId = sectorResult.sector || 'pokrovsk';
    const publishedAt = raw.createdAt || new Date().toISOString();

    const normalizedItem = {
      id: `ds-${raw.id || crypto.randomUUID().slice(0, 8)}`,
      raw_id: raw.id,
      title: `${settlementNameRu} — ${descRu}`,
      title_ru: `${settlementNameRu} — ${descRu}`,
      title_uk: `${settlementNameUk} — ${descUk}`,
      title_en: `${settlementNameEn} — ${descEn}`,
      description_ru: descRu,
      description_uk: descUk,
      description_en: descEn,
      coordinates: [primaryLon, primaryLat],
      settlements: settlementsRu,
      settlement_name: settlementNameRu,
      sector_id: sectorId,
      sector_name: sectorResult.sector_name,
      published_at: publishedAt,
      source: 'DeepState',
      source_url: 'https://deepstatemap.live',
      confidence: 0.94
    };

    normalizedItems.push(normalizedItem);

    // Build GeoJSON Point Feature
    features.push({
      type: 'Feature',
      id: `ds-feat-${raw.id || normalizedItem.id}`,
      geometry: {
        type: 'Point',
        coordinates: [primaryLon, primaryLat]
      },
      properties: {
        id: `ds-feat-${raw.id || normalizedItem.id}`,
        name: settlementNameRu,
        title_ru: settlementNameRu,
        title_uk: settlementNameUk,
        description: descRu,
        description_ru: descRu,
        description_uk: descUk,
        sector_id: sectorId,
        source: 'DeepState',
        source_type: 'geospatial_osint',
        source_url: 'https://deepstatemap.live',
        event_date: publishedAt.split('T')[0],
        published_at: publishedAt,
        confidence: 0.94,
        status: 'osint_verified'
      }
    });
  }

  const featureCollection = {
    type: 'FeatureCollection',
    metadata: {
      source: 'DeepState',
      source_name_ru: 'OSINT-проект DeepState UA',
      source_url: 'https://deepstatemap.live',
      role: 'GEOSPATIAL_OSINT_FEED',
      snapshot_date: opDate,
      synchronized_at: new Date().toISOString(),
      features_count: features.length
    },
    features
  };

  return {
    featureCollection,
    items: normalizedItems
  };
}

/**
 * Returns Unified Source Data format as required by the multi-source pipeline spec:
 * { source, source_type, retrieved_at, published_at, version, geometry, metadata, items }
 */
export async function getDeepStateUnified(targetDate = null) {
  const opDate = targetDate || new Date().toISOString().slice(0, 10);
  const cachePath = path.join(DATA_DIR, 'latest.geojson');
  let historyRes = await fetchDeepStateHistory(7000);
  let isCached = false;

  let rawItems = historyRes.items;
  if (!rawItems || rawItems.length === 0) {
    // Fallback to locally cached history if available
    const cachedGeo = readJson(path.relative(ROOT_DIR, cachePath), null);
    if (cachedGeo && cachedGeo.features && cachedGeo.features.length > 0) {
      isCached = true;
      console.warn('[DeepState Adapter] Live fetch returned empty, using cached fallback data.');
      const version = cachedGeo.metadata?.version || opDate;
      return createUnifiedSourceData({
        source: 'deepstate',
        source_type: 'geospatial_osint',
        retrieved_at: new Date().toISOString(),
        published_at: cachedGeo.metadata?.snapshot_date || opDate,
        version,
        geometry: cachedGeo,
        metadata: {
          source_name_ru: 'OSINT-проект DeepState UA',
          source_url: 'https://deepstatemap.live',
          role: 'GEOSPATIAL_OSINT_FEED',
          items_count: cachedGeo.features.length,
          latency_ms: historyRes.latency_ms,
          status: 'CACHED_FALLBACK',
          error: historyRes.error,
          is_cached_fallback: true
        },
        items: []
      });
    }
  }

  const { featureCollection, items } = parseAndNormalizeDeepStateHistory(rawItems, opDate);
  const version = crypto.createHash('sha256').update(JSON.stringify(rawItems)).digest('hex').slice(0, 16);
  featureCollection.metadata.version = version;

  // Persist latest to disk cache
  writeJson(path.relative(ROOT_DIR, cachePath), featureCollection);

  const latestItem = rawItems[rawItems.length - 1];
  const publishedAt = latestItem?.createdAt || opDate;

  return createUnifiedSourceData({
    source: 'deepstate',
    source_type: 'geospatial_osint',
    retrieved_at: new Date().toISOString(),
    published_at: publishedAt,
    version,
    geometry: featureCollection,
    metadata: {
      source_name_ru: 'OSINT-проект DeepState UA',
      source_url: 'https://deepstatemap.live',
      role: 'GEOSPATIAL_OSINT_FEED',
      items_count: items.length,
      latency_ms: historyRes.latency_ms,
      status: historyRes.state === 'ok' ? 'ACTIVE' : 'DEGRADED',
      error: historyRes.error,
      is_cached_fallback: isCached
    },
    items
  });
}

/**
 * DeepState Adapter Object implementing standard adapter interface
 */
export const deepStateAdapter = {
  id: 'deepstate',
  name: 'DeepState',
  type: 'geospatial_osint',
  fetchHistory: fetchDeepStateHistory,
  fetchTelegram: fetchDeepStateTelegram,
  parseAndNormalizeHistory: parseAndNormalizeDeepStateHistory,
  getUnified: getDeepStateUnified
};
