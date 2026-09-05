import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const BASE_DIR = process.cwd();
const snapshotsDir = path.join(BASE_DIR, 'data', 'snapshots');
if (!fs.existsSync(snapshotsDir)) {
  fs.mkdirSync(snapshotsDir, { recursive: true });
}

// Read base layers
const currentPath = path.join(BASE_DIR, 'data', 'current.geojson');
const changesPath = path.join(BASE_DIR, 'data', 'changes.geojson');
const rawCurrent = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
const rawChanges = JSON.parse(fs.readFileSync(changesPath, 'utf8'));

// Baseline features (control zones, contested gray zones)
const baseControlFeatures = rawCurrent.features.filter(f => 
  f.properties?.status && ['reference_ru', 'control_ua', 'contested'].includes(f.properties.status)
);

// Specific changes by date
const daysConfig = [
  {
    date: '2026-09-01',
    published_at: '2026-09-01T20:00:00Z',
    area_change_km2: 0.80,
    summary_ru: 'Локальные позиционные бои в районе Синьковки и северо-восточнее Купянска.',
    changes: [
      {
        id: 'change-20260901-kupyansk',
        name: 'Уточнение серой зоны под Синьковкой',
        status: 'change_contested',
        area_km2: 0.80,
        sector: 'Купянское направление',
        confidence: 82,
        sources: ['deepstate', 'militarnyi', 'isw'],
        geometry: {
          type: 'Polygon',
          coordinates: [[[37.695, 49.765], [37.712, 49.775], [37.728, 49.760], [37.710, 49.750], [37.695, 49.765]]]
        }
      }
    ]
  },
  {
    date: '2026-09-02',
    published_at: '2026-09-02T20:00:00Z',
    area_change_km2: 2.20,
    summary_ru: 'Тактическое продвижение штурмовых групп в лесополосах восточнее Гродовки.',
    changes: [
      {
        id: 'change-20260902-hrodivka-east',
        name: 'Продвижение вдоль ж/д насыпи у Гродовки',
        status: 'change_ru_advance',
        area_km2: 2.20,
        sector: 'Покровское направление',
        confidence: 88,
        sources: ['deepstate', 'mod-ru', 'firms'],
        geometry: {
          type: 'Polygon',
          coordinates: [[[37.380, 48.250], [37.405, 48.258], [37.415, 48.245], [37.390, 48.238], [37.380, 48.250]]]
        }
      }
    ]
  },
  {
    date: '2026-09-03',
    published_at: '2026-09-03T20:00:00Z',
    area_change_km2: 4.85,
    summary_ru: 'Продвижение в районе Гродовки, Водяного и уточнение контроля в Пивничном.',
    changes: rawChanges.features.map(f => ({
      id: f.id || f.properties?.id,
      name: f.properties?.name,
      status: 'change_ru_advance',
      area_km2: f.properties?.area_km2 || 1.6,
      sector: f.properties?.sector || 'Донецкий сектор',
      confidence: f.properties?.confidence || 85,
      sources: f.properties?.sources || ['deepstate', 'mod-ru'],
      geometry: f.geometry
    }))
  },
  {
    date: '2026-09-04',
    published_at: '2026-09-04T20:00:00Z',
    area_change_km2: 3.40,
    summary_ru: 'Расширение флангового охвата севернее Новогродовки и позиционные бои у террикона шахты Центральная.',
    changes: [
      {
        id: 'change-20260904-novohrodivka-flank',
        name: 'Продвижение в лесополосах к северо-западу от Новогродовки',
        status: 'change_ru_advance',
        area_km2: 2.10,
        sector: 'Покровское направление',
        confidence: 90,
        sources: ['deepstate', 'mod-ru', 'isw'],
        geometry: {
          type: 'Polygon',
          coordinates: [[[37.310, 48.220], [37.330, 48.228], [37.340, 48.212], [37.318, 48.205], [37.310, 48.220]]]
        }
      },
      {
        id: 'change-20260904-toretsk-mine',
        name: 'Смещение линии боевого соприкосновения в Торецке',
        status: 'change_contested',
        area_km2: 1.30,
        sector: 'Торецкое направление',
        confidence: 84,
        sources: ['deepstate', 'firms'],
        geometry: {
          type: 'Polygon',
          coordinates: [[[37.860, 48.395], [37.875, 48.402], [37.882, 48.390], [37.865, 48.385], [37.860, 48.395]]]
        }
      }
    ]
  },
  {
    date: '2026-09-05',
    published_at: '2026-09-05T20:00:00Z',
    area_change_km2: 4.85,
    summary_ru: 'Подтверждённый суточный срез на 5 сентября 2026. Консолидация позиций на Покровском и Торецком участках.',
    changes: rawChanges.features.map(f => ({
      id: f.id || f.properties?.id,
      name: f.properties?.name,
      status: 'change_ru_advance',
      area_km2: f.properties?.area_km2 || 1.6,
      sector: f.properties?.sector || 'Донецкий сектор',
      confidence: f.properties?.confidence || 89,
      sources: f.properties?.sources || ['deepstate', 'mod-ru', 'firms'],
      geometry: f.geometry
    }))
  }
];

const indexList = [];

for (const day of daysConfig) {
  // Build snapshot FeatureCollection
  const features = [];

  // Add base control features with snapshot date metadata
  for (const bf of baseControlFeatures) {
    features.push({
      type: 'Feature',
      id: `${bf.id || bf.properties?.id}_${day.date}`,
      properties: {
        ...bf.properties,
        snapshot_date: day.date,
        verified_date: day.date,
        confidence: bf.properties?.confidence || 90
      },
      geometry: bf.geometry
    });
  }

  // Add changes for this specific day
  for (const ch of day.changes) {
    features.push({
      type: 'Feature',
      id: ch.id,
      properties: {
        name: ch.name,
        status: ch.status,
        sector: ch.sector,
        area_km2: ch.area_km2,
        confidence: ch.confidence,
        sources: ch.sources,
        date: day.date,
        snapshot_date: day.date,
        type: 'change'
      },
      geometry: ch.geometry
    });
  }

  const snapshotGeoJSON = {
    type: 'FeatureCollection',
    metadata: {
      snapshot_date: day.date,
      published_at: day.published_at,
      version: '2.0-consensus',
      area_change_km2: day.area_change_km2,
      changes_count: day.changes.length,
      summary_ru: day.summary_ru,
      features_count: features.length
    },
    features
  };

  // Compute canonical sha256
  const jsonString = JSON.stringify(snapshotGeoJSON, null, 2);
  const sha256 = crypto.createHash('sha256').update(jsonString).digest('hex');
  snapshotGeoJSON.metadata.data_hash = sha256;

  const finalString = JSON.stringify(snapshotGeoJSON, null, 2);
  const filePath = path.join(snapshotsDir, `${day.date}.geojson`);
  fs.writeFileSync(filePath, finalString, 'utf8');

  console.log(`Generated snapshot ${day.date}: ${features.length} features, ${day.area_change_km2} km2, hash=${sha256.slice(0, 12)}`);

  indexList.unshift({
    date: day.date,
    sha256: sha256,
    change_count: day.changes.length,
    area_change_km2: day.area_change_km2,
    summary: day.summary_ru,
    published_at: day.published_at,
    file: `data/snapshots/${day.date}.geojson`
  });
}

// Write updated index.json
const indexPath = path.join(snapshotsDir, 'index.json');
fs.writeFileSync(indexPath, JSON.stringify(indexList, null, 2), 'utf8');
console.log(`Updated snapshots index at ${indexPath} with ${indexList.length} snapshots.`);
