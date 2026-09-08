/**
 * Test Suite: Source Adapters & Unified Output Specification
 * Tests LostArmour, DeepState, and the Unified Source Data schema.
 */

import assert from 'assert';
import { validateUnifiedSourceData, createUnifiedSourceData } from '../sources/baseAdapter.js';
import { lostArmourAdapter, parseAndNormalizeLostArmour, validateLostArmourData } from '../sources/lostarmour/index.js';
import { deepStateAdapter, parseAndNormalizeDeepStateHistory } from '../sources/deepstate/index.js';
import { fetchAllUnifiedSources, sourceAdapters } from '../sources/index.js';

console.log('--- RUNNING SOURCE ADAPTERS & UNIFIED PIPELINE TEST SUITE ---');

// Test 1: validateUnifiedSourceData rejects malformed envelopes
{
  const invalid1 = { source: '' };
  assert.strictEqual(validateUnifiedSourceData(invalid1).valid, false, 'Should reject empty source');

  const invalid2 = { source: 'test', source_type: 'geo', retrieved_at: 'bad-date' };
  assert.strictEqual(validateUnifiedSourceData(invalid2).valid, false, 'Should reject invalid date');

  const invalid3 = {
    source: 'test',
    source_type: 'geo',
    retrieved_at: new Date().toISOString(),
    published_at: '2026-09-07',
    version: '1.0',
    geometry: { type: 'InvalidType' },
    metadata: {}
  };
  assert.strictEqual(validateUnifiedSourceData(invalid3).valid, false, 'Should reject invalid geometry type');
  console.log('[PASS] Test 1: validateUnifiedSourceData rejects invalid payloads');
}

// Test 2: createUnifiedSourceData builds a valid envelope
{
  const envelope = createUnifiedSourceData({
    source: 'test-source',
    source_type: 'reference_baseline',
    retrieved_at: new Date().toISOString(),
    published_at: '2026-09-07',
    version: 'v1.0.0',
    geometry: { type: 'FeatureCollection', features: [] },
    metadata: { author: 'Test' }
  });

  const val = validateUnifiedSourceData(envelope);
  assert.strictEqual(val.valid, true, `Validation failed: ${val.error}`);
  assert.strictEqual(envelope.source, 'test-source');
  assert.strictEqual(envelope.source_type, 'reference_baseline');
  assert.strictEqual(envelope.version, 'v1.0.0');
  assert.strictEqual(envelope.geometry.type, 'FeatureCollection');
  console.log('[PASS] Test 2: createUnifiedSourceData produces valid unified envelope');
}

// Test 3: LostArmour KML parsing & GeoJSON normalization
{
  const sampleKml = `<?xml version="1.0" encoding="UTF-8"?>
  <kml xmlns="http://www.opengis.net/kml/2.2">
    <Document>
      <Placemark>
        <name>Покровский участок</name>
        <description>Покровское направление</description>
        <Polygon>
          <outerBoundaryIs>
            <LinearRing>
              <coordinates>
                37.18,48.28,0 37.25,48.30,0 37.28,48.25,0 37.18,48.28,0
              </coordinates>
            </LinearRing>
          </outerBoundaryIs>
        </Polygon>
      </Placemark>
      <Placemark>
        <name>Линия боевого соприкосновения</name>
        <LineString>
          <coordinates>
            37.18,48.28,0 37.25,48.30,0
          </coordinates>
        </LineString>
      </Placemark>
    </Document>
  </kml>`;

  const result = parseAndNormalizeLostArmour(sampleKml, '2026-09-07');
  assert.ok(result.normalizedGeo, 'Should produce normalizedGeo');
  assert.strictEqual(result.controlPolygons.length, 1, 'Should extract 1 polygon');
  assert.strictEqual(result.frontlineLines.length, 1, 'Should extract 1 line');
  assert.ok(result.totalControlAreaKm2 > 0, 'Area should be calculated and > 0');

  const poly = result.controlPolygons[0];
  assert.strictEqual(poly.properties.source, 'LostArmour');
  assert.strictEqual(poly.properties.source_type, 'Reference Baseline');
  assert.strictEqual(poly.properties.status, 'control_ru');
  assert.ok(poly.properties.area_km2 > 0, 'Polygon properties should include area_km2');
  console.log('[PASS] Test 3: LostArmour KML parsing and feature enrichment succeed');
}

// Test 4: LostArmour Adapter getUnified returns complete envelope
{
  const unified = await lostArmourAdapter.getUnified('2026-09-05');
  const val = validateUnifiedSourceData(unified);
  assert.strictEqual(val.valid, true, `Unified data failed validation: ${val.error}`);
  assert.strictEqual(unified.source, 'lostarmour');
  assert.strictEqual(unified.source_type, 'reference_baseline');
  assert.ok(unified.version, 'Version must be present');
  assert.ok(unified.geometry, 'Geometry FeatureCollection must be present');
  assert.ok(unified.geometry.features.length >= 15, 'LostArmour baseline must contain control polygons');
  assert.strictEqual(unified.metadata.role, 'PRIMARY_REFERENCE_BASEMAP');
  console.log(`[PASS] Test 4: lostArmourAdapter.getUnified returns valid schema with ${unified.geometry.features.length} features`);
}

// Test 5: DeepState History parsing extracts coordinates and Russian normalization
{
  const mockHistory = [
    {
      id: 991,
      createdAt: '2026-09-07T12:00:00.000Z',
      description: 'Уточнено лінію зіткнення біля <a href="#15/48.285/37.210">Покровська</a> та Новогродівки',
      descriptionEn: 'Clarified the line of contact near Pokrovsk and Novohrodivka'
    }
  ];

  const { featureCollection, items } = parseAndNormalizeDeepStateHistory(mockHistory, '2026-09-07');
  assert.strictEqual(featureCollection.features.length, 1, 'Should produce 1 GeoJSON feature');
  assert.strictEqual(items.length, 1, 'Should produce 1 normalized item');

  const feat = featureCollection.features[0];
  assert.strictEqual(feat.geometry.type, 'Point');
  assert.strictEqual(feat.geometry.coordinates[0], 37.21);
  assert.strictEqual(feat.geometry.coordinates[1], 48.285);
  assert.strictEqual(feat.properties.source, 'DeepState');
  assert.ok(feat.properties.title_ru.includes('Покровск'), 'Title should contain normalized Russian name');

  const item = items[0];
  assert.strictEqual(item.sector_id, 'pokrovsk');
  assert.ok(item.description_ru.toLowerCase().includes('уточнена линия'), 'Description should be normalized to Russian');
  console.log('[PASS] Test 5: DeepState history parsing produces valid geolocated Point features and Russian text');
}

// Test 6: DeepState Adapter getUnified returns complete envelope
{
  const unified = await deepStateAdapter.getUnified('2026-09-07');
  const val = validateUnifiedSourceData(unified);
  assert.strictEqual(val.valid, true, `DeepState unified data failed validation: ${val.error}`);
  assert.strictEqual(unified.source, 'deepstate');
  assert.strictEqual(unified.source_type, 'geospatial_osint');
  assert.ok(unified.version, 'Version must be present');
  assert.ok(unified.geometry, 'Geometry must be present');
  assert.strictEqual(unified.geometry.type, 'FeatureCollection');
  assert.ok(unified.metadata, 'Metadata must be present');
  console.log('[PASS] Test 6: deepStateAdapter.getUnified returns valid schema');
}

// Test 7: Master Source Registry executes all adapters
{
  const allSources = await fetchAllUnifiedSources('2026-09-07');
  assert.ok(allSources.lostarmour, 'Should have lostarmour in registry results');
  assert.ok(allSources.deepstate, 'Should have deepstate in registry results');
  assert.strictEqual(allSources.lostarmour.source, 'lostarmour');
  assert.strictEqual(allSources.deepstate.source, 'deepstate');
  console.log('[PASS] Test 7: Master sources registry fetchAllUnifiedSources succeeded');
}

console.log('----------------------------------------------------');
console.log('RESULTS: All 7 source adapter tests passed.');
console.log('>>> ALL ADAPTER & UNIFIED SCHEMA TESTS PASSED! <<<');
