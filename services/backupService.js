/**
 * WarMap Daily - Data Backup & Recovery Service
 * Specification Item 20: Backup before data modifications, snapshot rollback, recovery audit.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const BACKUP_DIR = path.join(ROOT_DIR, 'data/backups');

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

export const CRITICAL_FILES = [
  'data/status.json',
  'data/news.json',
  'data/events.json',
  'data/claims.json',
  'data/evidence.json',
  'data/changes.geojson',
  'data/daily-digest.json',
  'data/source-health.json',
  'data/settlements-index.json'
];

/**
 * Creates a timestamped backup archive of critical data files
 */
export function createBackup(label = 'pre_modification') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupId = `backup_${timestamp}_${label}`;
  const targetDir = path.join(BACKUP_DIR, backupId);
  fs.mkdirSync(targetDir, { recursive: true });

  const manifest = {
    backup_id: backupId,
    created_at: new Date().toISOString(),
    label,
    files_backed_up: []
  };

  for (const relFile of CRITICAL_FILES) {
    const src = path.join(ROOT_DIR, relFile);
    if (fs.existsSync(src)) {
      const dest = path.join(targetDir, path.basename(relFile));
      fs.copyFileSync(src, dest);
      manifest.files_backed_up.push(relFile);
    }
  }

  fs.writeFileSync(path.join(targetDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  // Maintain max 15 backups to avoid disk bloat
  pruneBackups(15);

  return manifest;
}

/**
 * Lists all existing backups sorted by date desc
 */
export function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  const entries = fs.readdirSync(BACKUP_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.startsWith('backup_'))
    .map(d => {
      const manifestPath = path.join(BACKUP_DIR, d.name, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        try {
          return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        } catch (e) {
          return { backup_id: d.name, error: e.message };
        }
      }
      return { backup_id: d.name };
    })
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

  return entries;
}

/**
 * Rolls back critical data to a previous backup
 */
export function rollbackTo(backupId) {
  const backupPath = path.join(BACKUP_DIR, backupId);
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup "${backupId}" not found.`);
  }

  // Create safety backup before rolling back
  createBackup('pre_rollback_safety');

  const manifestPath = path.join(backupPath, 'manifest.json');
  let restored = 0;

  for (const relFile of CRITICAL_FILES) {
    const filename = path.basename(relFile);
    const backupFile = path.join(backupPath, filename);
    if (fs.existsSync(backupFile)) {
      const target = path.join(ROOT_DIR, relFile);
      fs.copyFileSync(backupFile, target);
      restored++;
    }
  }

  return {
    success: true,
    backup_id: backupId,
    files_restored: restored,
    rolled_back_at: new Date().toISOString()
  };
}

/**
 * Rolls back to a previous frontline GeoJSON snapshot
 */
export function rollbackToSnapshot(snapshotDate) {
  const snapshotFile = path.join(ROOT_DIR, `data/snapshots/${snapshotDate}.geojson`);
  if (!fs.existsSync(snapshotFile)) {
    throw new Error(`Snapshot for ${snapshotDate} does not exist.`);
  }

  createBackup(`pre_snapshot_rollback_${snapshotDate}`);
  const dest = path.join(ROOT_DIR, 'data/changes.geojson');
  fs.copyFileSync(snapshotFile, dest);

  return {
    success: true,
    snapshot_date: snapshotDate,
    rolled_back_at: new Date().toISOString()
  };
}

function pruneBackups(maxKeep = 15) {
  try {
    const list = fs.readdirSync(BACKUP_DIR)
      .filter(d => d.startsWith('backup_'))
      .map(name => ({ name, path: path.join(BACKUP_DIR, name), mtime: fs.statSync(path.join(BACKUP_DIR, name)).mtime }))
      .sort((a, b) => b.mtime - a.mtime);

    if (list.length > maxKeep) {
      for (const item of list.slice(maxKeep)) {
        fs.rmSync(item.path, { recursive: true, force: true });
      }
    }
  } catch (e) {
    console.warn('[Backup Service] Prune warning:', e.message);
  }
}
