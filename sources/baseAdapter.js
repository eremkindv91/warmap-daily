/**
 * WarMap Daily - Base Adapter & Unified Source Schema
 * Enforces the unified adapter contract:
 * {
 *   source: string,
 *   source_type: string,
 *   retrieved_at: string (ISO),
 *   published_at: string (ISO/date),
 *   version: string,
 *   geometry: Object (GeoJSON FeatureCollection or null),
 *   metadata: Object,
 *   items?: Array
 * }
 */

import crypto from 'crypto';

/**
 * Validates that an object strictly conforms to the Unified Source Data schema.
 * @param {Object} data
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateUnifiedSourceData(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Data must be a non-null object' };
  }

  if (typeof data.source !== 'string' || !data.source.trim()) {
    return { valid: false, error: 'Field "source" must be a non-empty string' };
  }

  if (typeof data.source_type !== 'string' || !data.source_type.trim()) {
    return { valid: false, error: 'Field "source_type" must be a non-empty string' };
  }

  if (typeof data.retrieved_at !== 'string' || !Date.parse(data.retrieved_at)) {
    return { valid: false, error: 'Field "retrieved_at" must be a valid ISO date string' };
  }

  if (typeof data.published_at !== 'string' || !data.published_at.trim()) {
    return { valid: false, error: 'Field "published_at" must be a non-empty string' };
  }

  if (data.version === undefined || data.version === null || typeof data.version !== 'string' && typeof data.version !== 'number') {
    return { valid: false, error: 'Field "version" must be a string or number' };
  }

  if (data.geometry !== null) {
    if (typeof data.geometry !== 'object') {
      return { valid: false, error: 'Field "geometry" must be null or a GeoJSON object' };
    }
    if (data.geometry.type !== 'FeatureCollection' && data.geometry.type !== 'Feature') {
      return { valid: false, error: 'Field "geometry" must have type "FeatureCollection" or "Feature"' };
    }
    if (data.geometry.type === 'FeatureCollection' && !Array.isArray(data.geometry.features)) {
      return { valid: false, error: 'Field "geometry.features" must be an array for FeatureCollection' };
    }
  }

  if (!data.metadata || typeof data.metadata !== 'object' || Array.isArray(data.metadata)) {
    return { valid: false, error: 'Field "metadata" must be a non-null object' };
  }

  return { valid: true };
}

/**
 * Creates and validates a standardized UnifiedSourceData envelope.
 */
export function createUnifiedSourceData({
  source,
  source_type,
  retrieved_at = new Date().toISOString(),
  published_at = new Date().toISOString(),
  version = null,
  geometry = null,
  metadata = {},
  items = []
}) {
  const computedVersion = version != null
    ? String(version)
    : crypto.createHash('sha256').update(JSON.stringify({ geometry, metadata, published_at })).digest('hex').slice(0, 16);

  const envelope = {
    source,
    source_type,
    retrieved_at,
    published_at,
    version: computedVersion,
    geometry,
    metadata: {
      ...metadata,
      adapter_version: '2.0.0'
    },
    items
  };

  const val = validateUnifiedSourceData(envelope);
  if (!val.valid) {
    throw new Error(`UnifiedSourceData validation failed: ${val.error}`);
  }

  return envelope;
}
