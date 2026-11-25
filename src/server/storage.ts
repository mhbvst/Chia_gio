import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Pool, PoolClient } from 'pg';
import {
  DEFAULT_SCHEDULE_SETTINGS,
  sanitizeScheduleSettings,
  ScheduleSettings,
} from '../utils/scheduleGenerator';

const SLOT_KEY_RE = /^(m|a):([1-9]\d{0,2})$/;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'data'));
const STORE_PATH = path.join(DATA_DIR, 'schedule-store.json');
const SETTINGS_PATH = path.join(DATA_DIR, 'schedule-settings.json');
const AUTH_PATH = path.join(DATA_DIR, 'auth-config.json');

export interface MachineDayRecord {
  slots: Record<string, boolean>;
  updatedAt: string | null;
}

export interface SettingsRecord {
  settings: ScheduleSettings;
  updatedAt: string | null;
}

export interface AuthConfig {
  salt: string;
  hash: string;
  updatedAt: string;
}

type ScheduleStore = Record<string, { slots: Record<string, boolean>; updatedAt: string }>;

export function sanitizeSlots(raw: unknown): Record<string, boolean> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const cleaned: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!SLOT_KEY_RE.test(k)) continue;
    if (v === true) {
      cleaned[k] = true;
    }
  }
  return cleaned;
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

export function verifyPasswordAgainstConfig(password: string, config: AuthConfig): boolean {
  const candidate = Buffer.from(hashPassword(password, config.salt), 'hex');
  const expected = Buffer.from(config.hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

// ===== In-process mutex lock for JSON fallback & coordinated auth updates =====
let lockChain: Promise<void> = Promise.resolve();

async function withLock<T>(fn: () => Promise<T> | T): Promise<T> {
  let release!: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  const prev = lockChain;
  lockChain = prev.then(() => next);
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

// ===== JSON File Fallback Helpers =====
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function buildKey(machineKey: string, dateKey: string): string {
  return `STATE_${dateKey}_${machineKey}`;
}

function readJsonStore(): ScheduleStore {
  ensureDataDir();
  if (!fs.existsSync(STORE_PATH)) return {};
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeJsonStore(store: ScheduleStore): void {
  ensureDataDir();
  const tmpPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmpPath, STORE_PATH);
}

function readJsonSettingsRecord(): SettingsRecord {
  ensureDataDir();
  if (!fs.existsSync(SETTINGS_PATH)) {
    return { settings: { ...DEFAULT_SCHEDULE_SETTINGS }, updatedAt: null };
  }
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');
    const parsed = JSON.parse(raw) as { settings?: unknown; updatedAt?: string };
    const clean = sanitizeScheduleSettings(parsed?.settings ?? parsed);
    if (!clean) {
      return { settings: { ...DEFAULT_SCHEDULE_SETTINGS }, updatedAt: null };
    }
    return { settings: clean, updatedAt: parsed?.updatedAt || null };
  } catch {
    return { settings: { ...DEFAULT_SCHEDULE_SETTINGS }, updatedAt: null };
  }
}

function writeJsonSettingsRecord(settings: ScheduleSettings): string {
  ensureDataDir();
  const updatedAt = new Date().toISOString();
  const tmpPath = `${SETTINGS_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify({ settings, updatedAt }, null, 2), 'utf8');
  fs.renameSync(tmpPath, SETTINGS_PATH);
  return updatedAt;
}

function readJsonAuthConfig(): AuthConfig | null {
  ensureDataDir();
  if (!fs.existsSync(AUTH_PATH)) return null;
  try {
    const raw = fs.readFileSync(AUTH_PATH, 'utf8');
    const parsed = JSON.parse(raw) as AuthConfig;
    if (parsed?.salt && parsed?.hash) return parsed;
    return null;
  } catch {
    return null;
  }
}

function writeJsonAuthConfig(password: string): AuthConfig {
  ensureDataDir();
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  const payload: AuthConfig = {
    salt,
    hash,
    updatedAt: new Date().toISOString(),
  };
  const tmpPath = `${AUTH_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), 'utf8');
  fs.renameSync(tmpPath, AUTH_PATH);
  return payload;
}

// ===== PostgreSQL (Neon) Pool =====
let pgPool: Pool | null = null;

function resolvePgSslConfig(connectionString: string): false | { rejectUnauthorized: boolean } {
  if ((process.env.PGSSL || '').trim().toLowerCase() === 'disable') {
    return false;
  }
  try {
    const u = new URL(connectionString);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
      return false;
    }
  } catch {
    // Default to TLS for external hosts like Neon
  }
  return { rejectUnauthorized: false };
}

async function withPgTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  if (!pgPool) {
    throw new Error('PostgreSQL pool is not initialized.');
  }
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback errors
    }
    throw err;
  } finally {
    client.release();
  }
}

export function getStorageMode(): 'postgres' | 'json' {
  return pgPool ? 'postgres' : 'json';
}

export async function initStorage(): Promise<'postgres' | 'json'> {
  const dbUrl = (process.env.DATABASE_URL || '').trim();
  if (!dbUrl) {
    ensureDataDir();
    return 'json';
  }

  const pool = new Pool({
    connectionString: dbUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    ssl: resolvePgSslConfig(dbUrl),
  });

  pool.on('error', (err) => {
    console.error('PostgreSQL pool error:', err.message);
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schedule_states (
      machine_key TEXT NOT NULL,
      date_key TEXT NOT NULL,
      slots JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (machine_key, date_key)
    );
    CREATE TABLE IF NOT EXISTS app_settings (
      id TEXT PRIMARY KEY,
      settings JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS auth_config (
      id TEXT PRIMARY KEY,
      salt TEXT NOT NULL,
      hash TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  pgPool = pool;
  return 'postgres';
}

function getEnvAuthConfig(): AuthConfig | null {
  const envPwd = (process.env.ADMIN_PASSWORD || '').trim();
  if (!envPwd) return null;
  const salt = crypto
    .createHash('sha256')
    .update('hospital-pro-env-salt')
    .digest('hex')
    .slice(0, 32);
  return {
    salt,
    hash: hashPassword(envPwd, salt),
    updatedAt: 'env',
  };
}

export async function readAuthConfig(): Promise<AuthConfig | null> {
  const envCfg = getEnvAuthConfig();
  if (envCfg) return envCfg;

  if (pgPool) {
    const res = await pgPool.query<{ salt: string; hash: string; updated_at: Date | string }>(
      'SELECT salt, hash, updated_at FROM auth_config WHERE id = $1',
      ['admin']
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      salt: row.salt,
      hash: row.hash,
      updatedAt:
        row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    };
  }

  return withLock(() => readJsonAuthConfig());
}

export async function claimInitialAuthConfig(
  password: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (getEnvAuthConfig()) {
    return { ok: false, message: 'Mật khẩu quản trị đã được thiết lập trên máy chủ.' };
  }

  if (pgPool) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(password, salt);
    const nowIso = new Date().toISOString();
    const res = await pgPool.query(
      `INSERT INTO auth_config (id, salt, hash, updated_at)
       VALUES ($1, $2, $3, $4::timestamptz)
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      ['admin', salt, hash, nowIso]
    );
    if (res.rowCount === 0) {
      return { ok: false, message: 'Mật khẩu quản trị đã được thiết lập trên máy chủ.' };
    }
    return { ok: true };
  }

  return withLock(() => {
    if (readJsonAuthConfig()) {
      return { ok: false as const, message: 'Mật khẩu quản trị đã được thiết lập trên máy chủ.' };
    }
    writeJsonAuthConfig(password);
    return { ok: true as const };
  });
}

export async function changeStoredAuthPassword(
  currentPassword: string,
  nextPassword: string
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  if (getEnvAuthConfig()) {
    return {
      ok: false,
      status: 400,
      message: 'Mật khẩu đang quản lý qua biến môi trường ADMIN_PASSWORD trên máy chủ.',
    };
  }

  if (pgPool) {
    return withPgTransaction(async (client) => {
      const res = await client.query<{ salt: string; hash: string; updated_at: Date | string }>(
        'SELECT salt, hash, updated_at FROM auth_config WHERE id = $1 FOR UPDATE',
        ['admin']
      );
      const row = res.rows[0];
      if (!row) {
        return { ok: false, status: 412, message: 'Chưa thiết lập mật khẩu quản trị.' };
      }
      const cfg: AuthConfig = {
        salt: row.salt,
        hash: row.hash,
        updatedAt:
          row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
      };
      if (!currentPassword || !verifyPasswordAgainstConfig(currentPassword, cfg)) {
        return { ok: false, status: 401, message: 'Mật khẩu hiện tại không đúng.' };
      }
      const nextSalt = crypto.randomBytes(16).toString('hex');
      const nextHash = hashPassword(nextPassword, nextSalt);
      const nowIso = new Date().toISOString();
      await client.query(
        'UPDATE auth_config SET salt = $1, hash = $2, updated_at = $3::timestamptz WHERE id = $4',
        [nextSalt, nextHash, nowIso, 'admin']
      );
      return { ok: true };
    });
  }

  return withLock(() => {
    const cfg = readJsonAuthConfig();
    if (!cfg) {
      return { ok: false as const, status: 412, message: 'Chưa thiết lập mật khẩu quản trị.' };
    }
    if (!currentPassword || !verifyPasswordAgainstConfig(currentPassword, cfg)) {
      return { ok: false as const, status: 401, message: 'Mật khẩu hiện tại không đúng.' };
    }
    writeJsonAuthConfig(nextPassword);
    return { ok: true as const };
  });
}

async function readSettingsWithClient(client: PoolClient): Promise<SettingsRecord> {
  const res = await client.query<{ settings: unknown; updated_at: Date | string }>(
    'SELECT settings, updated_at FROM app_settings WHERE id = $1',
    ['default']
  );
  const row = res.rows[0];
  if (!row) {
    return { settings: { ...DEFAULT_SCHEDULE_SETTINGS }, updatedAt: null };
  }
  const clean = sanitizeScheduleSettings(row.settings);
  if (!clean) {
    return { settings: { ...DEFAULT_SCHEDULE_SETTINGS }, updatedAt: null };
  }
  return {
    settings: clean,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

export async function readSettingsRecord(): Promise<SettingsRecord> {
  if (pgPool) {
    const res = await pgPool.query<{ settings: unknown; updated_at: Date | string }>(
      'SELECT settings, updated_at FROM app_settings WHERE id = $1',
      ['default']
    );
    const row = res.rows[0];
    if (!row) {
      return { settings: { ...DEFAULT_SCHEDULE_SETTINGS }, updatedAt: null };
    }
    const clean = sanitizeScheduleSettings(row.settings);
    if (!clean) {
      return { settings: { ...DEFAULT_SCHEDULE_SETTINGS }, updatedAt: null };
    }
    return {
      settings: clean,
      updatedAt:
        row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    };
  }

  return withLock(() => readJsonSettingsRecord());
}

export async function writeSettingsRecord(settings: ScheduleSettings): Promise<string> {
  if (pgPool) {
    const updatedAt = new Date().toISOString();
    await pgPool.query(
      `INSERT INTO app_settings (id, settings, updated_at)
       VALUES ($1, $2::jsonb, $3::timestamptz)
       ON CONFLICT (id) DO UPDATE
         SET settings = EXCLUDED.settings,
             updated_at = EXCLUDED.updated_at`,
      ['default', JSON.stringify(settings), updatedAt]
    );
    return updatedAt;
  }

  return withLock(() => writeJsonSettingsRecord(settings));
}

export async function readStatesBundle(dateKey: string): Promise<{
  settingsRec: SettingsRecord;
  recordsByMachine: Record<string, MachineDayRecord>;
}> {
  if (pgPool) {
    const settingsRec = await readSettingsRecord();
    const keys = settingsRec.settings.machines.map((m) => m.key);
    const res = await pgPool.query<{
      machine_key: string;
      slots: unknown;
      updated_at: Date | string;
    }>(
      'SELECT machine_key, slots, updated_at FROM schedule_states WHERE date_key = $1 AND machine_key = ANY($2::text[])',
      [dateKey, keys]
    );

    const recordsByMachine: Record<string, MachineDayRecord> = {};
    for (const row of res.rows) {
      recordsByMachine[row.machine_key] = {
        slots: sanitizeSlots(row.slots) || {},
        updatedAt:
          row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
      };
    }
    return { settingsRec, recordsByMachine };
  }

  return withLock(() => {
    const store = readJsonStore();
    const settingsRec = readJsonSettingsRecord();
    const recordsByMachine: Record<string, MachineDayRecord> = {};
    for (const m of settingsRec.settings.machines) {
      const rec = store[buildKey(m.key, dateKey)];
      recordsByMachine[m.key] = {
        slots: rec?.slots || {},
        updatedAt: rec?.updatedAt || null,
      };
    }
    return { settingsRec, recordsByMachine };
  });
}

export async function readSingleState(
  machineKey: string,
  dateKey: string,
  isValidMachine: (mk: string, settings: ScheduleSettings) => boolean
): Promise<{ invalidMachine: true } | { invalidMachine: false; record: MachineDayRecord }> {
  if (pgPool) {
    const settingsRec = await readSettingsRecord();
    if (!isValidMachine(machineKey, settingsRec.settings)) {
      return { invalidMachine: true };
    }
    const res = await pgPool.query<{ slots: unknown; updated_at: Date | string }>(
      'SELECT slots, updated_at FROM schedule_states WHERE machine_key = $1 AND date_key = $2',
      [machineKey, dateKey]
    );
    const row = res.rows[0];
    return {
      invalidMachine: false,
      record: {
        slots: row ? sanitizeSlots(row.slots) || {} : {},
        updatedAt: row
          ? row.updated_at instanceof Date
            ? row.updated_at.toISOString()
            : String(row.updated_at)
          : null,
      },
    };
  }

  return withLock(() => {
    const settingsRec = readJsonSettingsRecord();
    if (!isValidMachine(machineKey, settingsRec.settings)) {
      return { invalidMachine: true as const };
    }
    const store = readJsonStore();
    const rec = store[buildKey(machineKey, dateKey)];
    return {
      invalidMachine: false as const,
      record: {
        slots: rec?.slots || {},
        updatedAt: rec?.updatedAt || null,
      },
    };
  });
}

export async function toggleSlotAtomic(
  machineKey: string,
  dateKey: string,
  slotId: string,
  checked: boolean,
  isValidMachine: (mk: string, settings: ScheduleSettings) => boolean
): Promise<
  | { invalidMachine: true }
  | { invalidMachine: false; state: Record<string, boolean>; count: number; updatedAt: string }
> {
  if (pgPool) {
    return withPgTransaction(async (client) => {
      const settingsRec = await readSettingsWithClient(client);
      if (!isValidMachine(machineKey, settingsRec.settings)) {
        return { invalidMachine: true as const };
      }
      const existing = await client.query<{ slots: unknown }>(
        'SELECT slots FROM schedule_states WHERE machine_key = $1 AND date_key = $2 FOR UPDATE',
        [machineKey, dateKey]
      );
      const current = existing.rows[0] ? sanitizeSlots(existing.rows[0].slots) || {} : {};
      if (checked) {
        current[slotId] = true;
      } else {
        delete current[slotId];
      }
      const updatedAt = new Date().toISOString();
      await client.query(
        `INSERT INTO schedule_states (machine_key, date_key, slots, updated_at)
         VALUES ($1, $2, $3::jsonb, $4::timestamptz)
         ON CONFLICT (machine_key, date_key) DO UPDATE
           SET slots = EXCLUDED.slots,
               updated_at = EXCLUDED.updated_at`,
        [machineKey, dateKey, JSON.stringify(current), updatedAt]
      );
      return {
        invalidMachine: false as const,
        state: current,
        count: Object.keys(current).length,
        updatedAt,
      };
    });
  }

  return withLock(() => {
    const settingsRec = readJsonSettingsRecord();
    if (!isValidMachine(machineKey, settingsRec.settings)) {
      return { invalidMachine: true as const };
    }
    const store = readJsonStore();
    const key = buildKey(machineKey, dateKey);
    const current = store[key]?.slots ? { ...store[key].slots } : {};
    if (checked) {
      current[slotId] = true;
    } else {
      delete current[slotId];
    }
    const updatedAt = new Date().toISOString();
    store[key] = { slots: current, updatedAt };
    writeJsonStore(store);
    return {
      invalidMachine: false as const,
      state: current,
      count: Object.keys(current).length,
      updatedAt,
    };
  });
}

export async function saveFullStateAtomic(
  machineKey: string,
  dateKey: string,
  cleanedSlots: Record<string, boolean>,
  isValidMachine: (mk: string, settings: ScheduleSettings) => boolean
): Promise<{ invalidMachine: true } | { invalidMachine: false; updatedAt: string }> {
  if (pgPool) {
    return withPgTransaction(async (client) => {
      const settingsRec = await readSettingsWithClient(client);
      if (!isValidMachine(machineKey, settingsRec.settings)) {
        return { invalidMachine: true as const };
      }
      const updatedAt = new Date().toISOString();
      await client.query(
        `INSERT INTO schedule_states (machine_key, date_key, slots, updated_at)
         VALUES ($1, $2, $3::jsonb, $4::timestamptz)
         ON CONFLICT (machine_key, date_key) DO UPDATE
           SET slots = EXCLUDED.slots,
               updated_at = EXCLUDED.updated_at`,
        [machineKey, dateKey, JSON.stringify(cleanedSlots), updatedAt]
      );
      return { invalidMachine: false as const, updatedAt };
    });
  }

  return withLock(() => {
    const settingsRec = readJsonSettingsRecord();
    if (!isValidMachine(machineKey, settingsRec.settings)) {
      return { invalidMachine: true as const };
    }
    const store = readJsonStore();
    const ts = new Date().toISOString();
    store[buildKey(machineKey, dateKey)] = { slots: cleanedSlots, updatedAt: ts };
    writeJsonStore(store);
    return { invalidMachine: false as const, updatedAt: ts };
  });
}

export async function deleteStateForDay(
  machineKey: string,
  dateKey: string,
  isValidMachine: (mk: string, settings: ScheduleSettings) => boolean
): Promise<{ invalidMachine: boolean }> {
  if (pgPool) {
    return withPgTransaction(async (client) => {
      const settingsRec = await readSettingsWithClient(client);
      if (!isValidMachine(machineKey, settingsRec.settings)) {
        return { invalidMachine: true };
      }
      await client.query(
        'DELETE FROM schedule_states WHERE machine_key = $1 AND date_key = $2',
        [machineKey, dateKey]
      );
      return { invalidMachine: false };
    });
  }

  return withLock(() => {
    const settingsRec = readJsonSettingsRecord();
    if (!isValidMachine(machineKey, settingsRec.settings)) {
      return { invalidMachine: true };
    }
    const store = readJsonStore();
    delete store[buildKey(machineKey, dateKey)];
    writeJsonStore(store);
    return { invalidMachine: false };
  });
}
