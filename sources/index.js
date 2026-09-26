/**
 * WarMap Daily - Master Multi-Source Adapters Registry
 * Registers all multi-source adapters conforming to the Unified Source Data schema:
 * { source, source_type, retrieved_at, published_at, version, geometry, metadata }
 */

import { lostArmourAdapter } from './lostarmour/index.js';
import { deepStateAdapter } from './deepstate/index.js';
import { divgenAdapter } from './divgen/index.js';
import { iswAdapter } from './isw/index.js';
import { evidenceAdapter } from './evidence/index.js';
import { claimsAdapter } from './claims/index.js';
import { validateUnifiedSourceData, createUnifiedSourceData } from './baseAdapter.js';

export const sourceAdapters = {
  lostarmour: lostArmourAdapter,
  deepstate: deepStateAdapter,
  divgen: divgenAdapter,
  isw: iswAdapter,
  evidence: evidenceAdapter,
  claims: claimsAdapter
};

export function getSourceAdapter(sourceId) {
  return sourceAdapters[sourceId] || null;
}

export function listAvailableAdapters() {
  return Object.values(sourceAdapters).map(a => ({
    id: a.id,
    name: a.name,
    type: a.type,
    role: a.role
  }));
}

/**
 * Fetches unified data from all registered source adapters in parallel
 */
export async function fetchAllUnifiedSources(targetDate = null) {
  const results = {};
  const adapterEntries = Object.entries(sourceAdapters);

  const promises = adapterEntries.map(async ([key, adapter]) => {
    try {
      const data = await adapter.getUnified(targetDate);
      return { key, data, error: null };
    } catch (err) {
      console.error(`[Sources Registry] Error getting unified data for ${key}:`, err.message);
      return { key, data: null, error: err.message };
    }
  });

  const settled = await Promise.all(promises);
  for (const s of settled) {
    results[s.key] = s.data || { error: s.error };
  }

  return results;
}

export {
  validateUnifiedSourceData,
  createUnifiedSourceData,
  lostArmourAdapter,
  deepStateAdapter,
  divgenAdapter,
  iswAdapter,
  evidenceAdapter,
  claimsAdapter
};
