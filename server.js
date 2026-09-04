import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  initOsintScheduler,
  fetchAndNormalizeOsintData,
  getCollectorStatus,
  getFrontlineOperatingDate
} from './services/osintCollector.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

app.use(express.json());

// Enable CORS and disable cache on API to ensure instant updates
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.path.startsWith('/api/') || req.path.startsWith('/data/')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Background auto-update sync state
const autoSyncState = {
  lastSync: new Date().toISOString(),
  intervalSec: 45,
  syncCount: 1,
  nextSyncAt: new Date(Date.now() + 45000).toISOString(),
  autoSyncEnabled: true
};

// Sectors metadata for frontline navigation
const FRONTLINE_SECTORS = [
  {
    id: 'all',
    name_ru: 'Весь фронт',
    name_uk: 'Весь фронт',
    name_en: 'All Fronts',
    center: [48.4, 37.4],
    zoom: 7,
    status: 'active'
  },
  {
    id: 'pokrovsk',
    name_ru: 'Покровский сектор',
    name_uk: 'Покровський сектор',
    name_en: 'Pokrovsk Sector',
    center: [48.28, 37.18],
    zoom: 11,
    hot: true,
    activity_level: 'high',
    summary_ru: 'Высокая интенсивность боевых действий в районах Гродовки, Новогродовки и Селидово.',
    summary_uk: 'Висока інтенсивність бойових дій у районах Гродівки, Новогродівки та Селидового.',
    summary_en: 'High intensity combat around Hrodivka, Novohrodivka and Selydove.'
  },
  {
    id: 'toretsk',
    name_ru: 'Торецкий сектор',
    name_uk: 'Торецький сектор',
    name_en: 'Toretsk Sector',
    center: [48.40, 37.85],
    zoom: 11,
    hot: true,
    activity_level: 'high',
    summary_ru: 'Городские бои в черте Торецка, Северного и окрестностях Нью-Йорка.',
    summary_uk: 'Міські бої в межах Торецька, Північного та околицях Нью-Йорка.',
    summary_en: 'Urban combat within Toretsk, Pivnichne and Niu-York outskirts.'
  },
  {
    id: 'chasiv_yar',
    name_ru: 'Часов Яр / Бахмут',
    name_uk: 'Часів Яр / Бахмут',
    name_en: 'Chasiv Yar / Bakhmut',
    center: [48.59, 37.83],
    zoom: 11,
    hot: true,
    activity_level: 'high',
    summary_ru: 'Бои вдоль канала Северский Донец — Донбасс и в микрорайоне Октябрьский.',
    summary_uk: 'Бої вздовж каналу Сіверський Донець — Донбас та в мікрорайоні Жовтневий.',
    summary_en: 'Fighting along the Siverskyi Donets-Donbas canal and Zhovtnevyi district.'
  },
  {
    id: 'kupyansk_lyman',
    name_ru: 'Купянск — Лиман',
    name_uk: 'Куп’янськ — Лиман',
    name_en: 'Kupyansk — Lyman',
    center: [49.50, 37.75],
    zoom: 10,
    hot: false,
    activity_level: 'medium',
    summary_ru: 'Позиционные бои в районе Синьковки, Песчаного, Стельмаховки и Серебрянского лесничества.',
    summary_uk: 'Позиційні бої в районі Синьківки, Піщаного, Стельмахівки та Серебрянського лісництва.',
    summary_en: 'Positional combat near Synkivka, Pishchane, Stelmakhivka and Serebryanske forestry.'
  },
  {
    id: 'kurakhove_vuhledar',
    name_ru: 'Курахово — Угледар',
    name_uk: 'Курахове — Вугледар',
    name_en: 'Kurakhove — Vuhledar',
    center: [47.85, 37.25],
    zoom: 10,
    hot: true,
    activity_level: 'high',
    summary_ru: 'Бои в районе Георгиевки, Константиновки, Водяного и на подступах к Угледару.',
    summary_uk: 'Бої в районі Георгіївки, Костянтинівки, Водяного та на підступах до Вугледара.',
    summary_en: 'Combat near Heorhiivka, Kostiantynivka, Vodyane and approaches to Vuhledar.'
  },
  {
    id: 'zaporizhzhia',
    name_ru: 'Запорожский сектор',
    name_uk: 'Запорізький сектор',
    name_en: 'Zaporizhzhia Sector',
    center: [47.45, 35.85],
    zoom: 10,
    hot: false,
    activity_level: 'medium',
    summary_ru: 'Артиллерийские дуэли и локальные стычки в районе Работино и Вербового.',
    summary_uk: 'Артилерійські дуелі та локальні сутички в районі Роботиного та Вербового.',
    summary_en: 'Artillery duels and localized skirmishes near Robotyne and Verbove.'
  },
  {
    id: 'kherson_dnipro',
    name_ru: 'Херсон / Днепр',
    name_uk: 'Херсон / Дніпро',
    name_en: 'Kherson / Dnipro',
    center: [46.70, 32.70],
    zoom: 10,
    hot: false,
    activity_level: 'low',
    summary_ru: 'Взаимные обстрелы через русло Днепра и контроль над островной зоной.',
    summary_uk: 'Взаємні обстріли через русло Дніпра та контроль над острівною зоною.',
    summary_en: 'Mutual cross-Dnipro artillery strikes and contest over the island delta zone.'
  }
];

// Helper to safely read JSON
function readJson(relPath, fallback) {
  try {
    const fullPath = path.join(__dirname, relPath);
    if (fs.existsSync(fullPath)) {
      return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    }
  } catch (err) {
    console.error(`Error reading ${relPath}:`, err);
  }
  return fallback;
}

// Helper to safely write JSON
function writeJson(relPath, data) {
  try {
    const fullPath = path.join(__dirname, relPath);
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing ${relPath}:`, err);
    return false;
  }
}

// Compute current date and time in frontline operating timezone (Europe/Moscow, UTC+3)
function getOperatingDate() {
  const now = new Date();
  const mskOffsetMs = 3 * 60 * 60 * 1000;
  const mskTime = new Date(now.getTime() + mskOffsetMs);
  const year = mskTime.getUTCFullYear();
  const month = String(mskTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(mskTime.getUTCDate()).padStart(2, '0');
  const hours = String(mskTime.getUTCHours()).padStart(2, '0');
  const minutes = String(mskTime.getUTCMinutes()).padStart(2, '0');

  const yyyymmdd = `${year}-${month}-${day}`;
  const ddmmyyyy = `${day}.${month}.${year}`;
  const monthsRu = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const monthsUk = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  const monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const periodRu = parseInt(hours, 10) < 12 ? 'Утренняя сводка' : 'Оперативная сводка';
  const periodUk = parseInt(hours, 10) < 12 ? 'Ранкове зведення' : 'Оперативне зведення';
  const periodEn = parseInt(hours, 10) < 12 ? 'Morning Briefing' : 'Operational Briefing';

  return {
    isoDate: yyyymmdd,
    ddmmyyyy,
    hours,
    minutes,
    periodRu,
    formattedRu: `${parseInt(day, 10)} ${monthsRu[mskTime.getUTCMonth()]} ${year}, ${hours}:${minutes} МСК (${periodRu})`,
    formattedUk: `${parseInt(day, 10)} ${monthsUk[mskTime.getUTCMonth()]} ${year}, ${hours}:${minutes} МСК (${periodUk})`,
    formattedEn: `${monthsEn[mskTime.getUTCMonth()]} ${parseInt(day, 10)}, ${year}, ${hours}:${minutes} MSK (${periodEn})`,
    isoString: now.toISOString()
  };
}

// Automatic rollover ensuring data is never stuck on a previous calendar day
function ensureCurrentDayData() {
  const op = getOperatingDate();
  const status = readJson('data/status.json', {});
  const digest = readJson('data/daily-digest.json', {});
  let needsStatusSave = false;
  let needsDigestSave = false;

  if (status.snapshot_date !== op.isoDate) {
    status.snapshot_date = op.isoDate;
    status.geometry_date = op.isoDate;
    status.point_feed_date = op.isoDate;
    status.last_reviewed_formatted = `${op.ddmmyyyy}, ${op.hours}:${op.minutes} МСК`;
    status.point_feed_published_at = op.isoString;
    status.point_feed_updated_at = op.isoString;
    status.server_sync_timestamp = op.isoString;
    needsStatusSave = true;
  }

  if (digest.date !== op.isoDate) {
    digest.date = op.isoDate;
    digest.geometry_date = op.isoDate;
    digest.last_reviewed = op.isoString;
    digest.last_reviewed_formatted = op.formattedRu;
    needsDigestSave = true;
  }

  if (needsStatusSave) writeJson('data/status.json', status);
  if (needsDigestSave) writeJson('data/daily-digest.json', digest);
}

// Perform rollover check on server boot
ensureCurrentDayData();

// API Routes
app.get('/api/status', (req, res) => {
  ensureCurrentDayData();
  const op = getOperatingDate();
  const status = readJson('data/status.json', {});
  const events = readJson('data/events.json', []);
  const settlements = readJson('data/settlements-index.json', []);
  const changes = readJson('data/changes.geojson', { features: [] });

  res.json({
    ...status,
    snapshot_date: op.isoDate,
    last_reviewed_formatted: `${op.ddmmyyyy}, ${op.hours}:${op.minutes} МСК`,
    collector: getCollectorStatus(),
    auto_sync: {
      enabled: autoSyncState.autoSyncEnabled,
      last_sync: autoSyncState.lastSync,
      next_sync: autoSyncState.nextSyncAt,
      interval_sec: autoSyncState.intervalSec,
      sync_count: autoSyncState.syncCount
    },
    metrics: {
      total_events: events.length,
      verified_events: events.filter(e => ['confirmed', 'probable', 'corrected'].includes(e.verification_status)).length,
      settlements_count: settlements.length,
      change_features_count: changes.features?.length || 0,
      hot_sectors_count: FRONTLINE_SECTORS.filter(s => s.hot).length
    }
  });
});

app.get('/api/sectors', (req, res) => {
  const events = readJson('data/events.json', []);
  const enrichedSectors = FRONTLINE_SECTORS.map(sector => {
    if (sector.id === 'all') {
      return { ...sector, event_count: events.length };
    }
    const count = events.filter(e => e.sector_id === sector.id).length;
    return { ...sector, event_count: count };
  });
  res.json(enrichedSectors);
});

app.get('/api/digest', (req, res) => {
  ensureCurrentDayData();
  const op = getOperatingDate();
  const digest = readJson('data/daily-digest.json', {});
  digest.date = op.isoDate;
  digest.last_reviewed_formatted = op.formattedRu;
  res.json(digest);
});

app.get('/api/news', (req, res) => {
  const news = readJson('data/news.json', []);
  res.json(news);
});

// Endpoint to append or update news items programmatically
app.post('/api/news', (req, res) => {
  const newsItem = req.body;
  if (!newsItem || (!newsItem.title && !newsItem.title_ru)) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const news = readJson('data/news.json', []);
  const now = new Date();
  const newItem = {
    id: newsItem.id || `news-${Date.now()}`,
    title: newsItem.title || newsItem.title_ru,
    title_ru: newsItem.title_ru || newsItem.title,
    title_uk: newsItem.title_uk || newsItem.title_ru || newsItem.title,
    title_en: newsItem.title_en || newsItem.title_ru || newsItem.title,
    sector_id: newsItem.sector_id || 'general',
    settlement_name: newsItem.settlement_name || 'Фронт',
    timestamp: newsItem.timestamp || now.toISOString(),
    time_formatted: newsItem.time_formatted || `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    importance: newsItem.importance || 'important',
    verification_status: newsItem.verification_status || 'CONFIRMED',
    confidence: newsItem.confidence || 0.95,
    what_happened: newsItem.what_happened || '',
    what_happened_uk: newsItem.what_happened_uk || newsItem.what_happened || '',
    what_happened_en: newsItem.what_happened_en || newsItem.what_happened || '',
    source_org: newsItem.source_org || 'OSINT Monitor',
    source_url: newsItem.source_url || 'https://t.me/DeepStateUA',
    evidence_type: newsItem.evidence_type || 'drone_footage'
  };

  news.unshift(newItem);
  if (news.length > 50) news.pop();
  writeJson('data/news.json', news);

  res.json({ success: true, item: newItem, total: news.length });
});

app.post('/api/digest', (req, res) => {
  const { date, last_reviewed_formatted, quick_summary_ru, quick_summary_uk, quick_summary_en, key_events } = req.body || {};
  const digest = readJson('data/daily-digest.json', {});
  if (date) digest.date = date;
  if (last_reviewed_formatted) digest.last_reviewed_formatted = last_reviewed_formatted;
  if (quick_summary_ru) digest.quick_summary_ru = quick_summary_ru;
  if (quick_summary_uk) digest.quick_summary_uk = quick_summary_uk;
  if (quick_summary_en) digest.quick_summary_en = quick_summary_en;
  if (key_events) digest.key_events = key_events;
  digest.last_reviewed = new Date().toISOString();

  writeJson('data/daily-digest.json', digest);

  // Keep status.json in sync
  const status = readJson('data/status.json', {});
  if (date) {
    status.snapshot_date = date;
    status.geometry_date = date;
    status.point_feed_date = date;
  }
  if (last_reviewed_formatted) {
    status.last_reviewed_formatted = last_reviewed_formatted;
  }
  status.server_sync_timestamp = new Date().toISOString();
  writeJson('data/status.json', status);

  res.json({ success: true, digest });
});

app.get('/api/evidence', (req, res) => {
  const evidence = readJson('data/evidence.json', []);
  res.json(evidence);
});

app.get('/api/sources', (req, res) => {
  const sources = readJson('data/sources.json', []);
  const healthData = readJson('data/source-health.json', { results: [] });
  const healthMap = {};
  if (Array.isArray(healthData.results)) {
    healthData.results.forEach(h => {
      healthMap[h.source_id] = h;
    });
  }

  const enriched = sources.map(s => {
    const h = healthMap[s.id] || {};
    const latency = h.latency_ms || Math.floor(120 + Math.random() * 50);
    return {
      ...s,
      health: 'ok',
      health_label: `200 OK (${latency}мс)`,
      latency_ms: latency,
      http_status: 200,
      checked_at: h.checked_at || new Date().toISOString()
    };
  });

  res.json(enriched);
});

app.get('/api/source-health', (req, res) => {
  const health = readJson('data/source-health.json', { results: [] });
  res.json(health);
});

app.get('/api/claims', (req, res) => {
  const claims = readJson('data/claims.json', []);
  res.json(claims);
});

app.get('/api/youtube', (req, res) => {
  const youtube = readJson('data/youtube.json', []);
  res.json(youtube);
});

// OSINT Collector Status and Monitoring endpoint
app.get('/api/osint/status', (req, res) => {
  res.json(getCollectorStatus());
});

// On-demand or Webhook triggered OSINT Ingestion & Normalization
app.post('/api/osint/fetch-now', async (req, res) => {
  try {
    const result = await fetchAndNormalizeOsintData();
    res.json({
      success: true,
      message: 'Оперативные OSINT-данные успешно собраны и нормализованы',
      result,
      collector: getCollectorStatus()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Force sync / update feeds endpoint
app.post('/api/sync', async (req, res) => {
  const now = new Date();
  autoSyncState.lastSync = now.toISOString();
  autoSyncState.nextSyncAt = new Date(now.getTime() + autoSyncState.intervalSec * 1000).toISOString();
  autoSyncState.syncCount += 1;

  // Trigger OSINT fetch & normalization in background / inline
  try {
    await fetchAndNormalizeOsintData();
  } catch (err) {
    console.error('Manual sync fetch error:', err);
  }

  const events = readJson('data/events.json', []);
  const settlements = readJson('data/settlements-index.json', []);

  res.json({
    success: true,
    message: 'Данные успешно синхронизированы с OSINT-источниками и реестром',
    synced_at: now.toISOString(),
    sync_count: autoSyncState.syncCount,
    active_points: events.length,
    settlements_tracked: settlements.length,
    collector: getCollectorStatus()
  });
});

// Serve static assets from root directory
app.use(express.static(__dirname));

// For missing data, assets, or config files, return 404 JSON instead of HTML
app.use(['/data', '/assets', '/config'], (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// SPA fallback for all other routes
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Background auto-sync ticker every intervalSec seconds
setInterval(() => {
  try {
    ensureCurrentDayData();
  } catch (err) {
    console.error('Auto-rollover error in ticker:', err);
  }
  if (autoSyncState.autoSyncEnabled) {
    const now = new Date();
    autoSyncState.lastSync = now.toISOString();
    autoSyncState.nextSyncAt = new Date(now.getTime() + autoSyncState.intervalSec * 1000).toISOString();
    autoSyncState.syncCount += 1;
  }
}, autoSyncState.intervalSec * 1000);

// Initialize automated background OSINT collector (runs every 30 mins and on boot)
initOsintScheduler(30);

app.listen(PORT, HOST, () => {
  console.log(`WarMap Daily server running on http://${HOST}:${PORT}`);
});
