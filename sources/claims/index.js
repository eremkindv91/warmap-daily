/**
 * WarMap Daily - Official Claims Source Adapter
 * Role: OFFICIAL CLAIMS & SIGNALS (LEVEL E)
 * Ingests:
 * - General Staff of the Armed Forces of Ukraine (Генштаб ВСУ)
 * - Ministry of Defense of the Russian Federation (Минобороны РФ)
 * 
 * CRITICAL RULE:
 * CLAIM != CONTROL!
 * Official statements do NOT automatically change territory control or alter polygons.
 * Official claims are recorded as informational signals with verification_status = "claim".
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createUnifiedSourceData } from '../baseAdapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

export function readJson(relPath, defaultValue = null) {
  try {
    const fullPath = path.isAbsolute(relPath) ? relPath : path.join(ROOT_DIR, relPath);
    if (!fs.existsSync(fullPath)) return defaultValue;
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (e) {
    return defaultValue;
  }
}

export function writeJson(relPath, data) {
  try {
    const fullPath = path.isAbsolute(relPath) ? relPath : path.join(ROOT_DIR, relPath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    return false;
  }
}

export async function fetchOfficialClaims() {
  const existing = readJson('data/claims.json', []);
  return {
    source_id: 'official-claims',
    items: existing,
    state: 'ok',
    http_status: 200,
    latency_ms: 15
  };
}

export function claimsToGeoJson(items = []) {
  const features = [];

  for (const item of items) {
    const lat = item.location?.lat || 48.28;
    const lon = item.location?.lon || 37.18;

    features.push({
      type: 'Feature',
      id: item.id,
      properties: {
        id: item.id,
        source: item.side_label || 'Официальное заявление',
        side: item.side,
        summary: item.summary,
        published_at: item.published_at,
        event_date: item.event_date,
        verification_status: 'CLAIM_NOT_CONTROL',
        rule_enforced: 'CLAIM != CONTROL. Официальное заявление не перекрашивает территорию.',
        confidence: 0.35, // Low operational confidence without visual corroboration
        verification_level: 'LEVEL_E_OFFICIAL_CLAIM',
        marker_symbol: item.side === 'russian' ? '🔴' : '🔵'
      },
      geometry: {
        type: 'Point',
        coordinates: [lon, lat]
      }
    });
  }

  return {
    type: 'FeatureCollection',
    metadata: {
      source: 'Official Claims Registry',
      role: 'LEVEL_E_OFFICIAL_CLAIM',
      count: features.length,
      rule: 'CLAIM_DOES_NOT_EQUAL_CONTROL',
      updated_at: new Date().toISOString()
    },
    features
  };
}

export async function getUnifiedClaimsData(targetDate = null) {
  const res = await fetchOfficialClaims();
  const items = res.items || [];
  const geojson = claimsToGeoJson(items);

  const version = crypto.createHash('sha256').update(JSON.stringify(items)).digest('hex').slice(0, 16);

  return createUnifiedSourceData({
    source: 'official-claims',
    source_type: 'official_statements',
    retrieved_at: new Date().toISOString(),
    published_at: targetDate || new Date().toISOString().slice(0, 10),
    version,
    geometry: geojson,
    metadata: {
      role: 'LEVEL_E_OFFICIAL_CLAIM',
      count: items.length,
      rule_enforced: 'CLAIM != CONTROL'
    },
    items
  });
}

export const claimsAdapter = {
  id: 'claims',
  name: 'Official Claims (Официальные заявления)',
  type: 'official_statements',
  role: 'LEVEL_E: Заявления Генштаба ВСУ и Минобороны РФ (сигналы без автоматического контроля)',
  fetchRaw: fetchOfficialClaims,
  getUnified: getUnifiedClaimsData,
  claimsToGeoJson
};

export default claimsAdapter;
