/**
 * WarMap Daily - LostArmour Sync Service (Adapter Proxy)
 * Re-exports the production-grade adapter from sources/lostarmour/
 * Maintaining 100% backward compatibility for all existing routes and callers.
 */

export {
  polygonAreaKm2,
  polygonCentroid,
  fetchLostArmourKml,
  parseAndNormalizeLostArmour,
  validateLostArmourData,
  computeDiscrepancies,
  syncLostArmour,
  getLostArmourLatest,
  getLostArmourSnapshot,
  getLostArmourDiscrepancies,
  getLostArmourComparison,
  getLostArmourUnified,
  lostArmourAdapter
} from '../sources/lostarmour/index.js';
