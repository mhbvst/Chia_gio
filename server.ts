import crypto from 'crypto';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import {
  analyzeScheduleSettings,
  DEFAULT_SCHEDULE_SETTINGS,
  MACHINE_KEY_RE,
  sanitizeScheduleSettings,
  ScheduleSettings,
} from './src/utils/scheduleGenerator';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const TZ = 'Asia/Ho_Chi_Minh';
const SLOT_KEY_RE = /^(m|a):([1-9]\d{0,2})$/;
const ADMIN_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;
const TOKEN_SECRET =
  (process.env.SESSION_SECRET || '').trim() || crypto.randomBytes(32).toString('hex');
let tokenValidAfterMs = 0;

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'data'));
const STORE_PATH = path.join(DATA_DIR, 'schedule-store.json');
const SETTINGS_PATH = path.join(DATA_DIR, 'schedule-settings.json');
const AUTH_PATH = path.join(DATA_DIR, 'auth-config.json');

interface MachineDayRecord {
  slots: Record<string, boolean>;
  updatedAt: string;
}

type ScheduleStore = Record<string, MachineDayRecord>;

interface AuthConfig {
  salt: string;
  hash: string;
  updatedAt: string;
}

// ===== In-process mutex lock (mirrors Google Apps Script LockService) =====
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

// ===== Date & validation helpers (Asia/Ho_Chi_Minh) =====
function todayKey(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

function isValidDateKey(dateStr: unknown): dateStr is string {
  if (typeof dateStr !== 'string') return false;
  const s = dateStr.trim();
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function normDateKey(dateStr: unknown): string | null {
  if (dateStr === undefined || dateStr === null || dateStr === '') {
    return todayKey();
  }
  if (!isValidDateKey(dateStr)) return null;
  return dateStr.trim();
}

function buildKey(machineKey: string, dateKey: string): string {
  return `STATE_${dateKey}_${machineKey}`;
}

function sanitizeSlots(raw: unknown): Record<string, boolean> | null {
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

// ===== Persistent store helpers =====
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStore(): ScheduleStore {
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

function writeStore(store: ScheduleStore): void {
  ensureDataDir();
  const tmpPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmpPath, STORE_PATH);
}

interface SettingsRecord {
  settings: ScheduleSettings;
  updatedAt: string | null;
}

function readSettingsRecord(): SettingsRecord {
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

function writeSettingsRecord(settings: ScheduleSettings): string {
  ensureDataDir();
  const updatedAt = new Date().toISOString();
  const tmpPath = `${SETTINGS_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify({ settings, updatedAt }, null, 2), 'utf8');
  fs.renameSync(tmpPath, SETTINGS_PATH);
  return updatedAt;
}

// ===== Secure Auth Helpers (No hardcoded passwords in frontend or backend) =====
function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function readAuthConfig(): AuthConfig | null {
  const envPwd = (process.env.ADMIN_PASSWORD || '').trim();
  if (envPwd) {
    const salt = crypto.createHash('sha256').update('hospital-pro-env-salt').digest('hex').slice(0, 32);
    return {
      salt,
      hash: hashPassword(envPwd, salt),
      updatedAt: 'env',
    };
  }
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

function writeAuthConfig(password: string): void {
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
}

function verifyPasswordAgainstConfig(password: string, config: AuthConfig): boolean {
  const candidate = Buffer.from(hashPassword(password, config.salt), 'hex');
  const expected = Buffer.from(config.hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

// Simple rate limiter for auth endpoints
const authAttempts = new Map<string, { count: number; lockedUntil: number }>();

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const entry = authAttempts.get(ip);
  if (entry && entry.lockedUntil > now) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.lockedUntil - now) / 1000) };
  }
  if (entry && entry.lockedUntil <= now) {
    authAttempts.delete(ip);
  }
  return { allowed: true };
}

function recordFailedAuth(ip: string): void {
  const now = Date.now();
  const entry = authAttempts.get(ip) || { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= 5) {
    entry.lockedUntil = now + 60_000;
    entry.count = 0;
  }
  authAttempts.set(ip, entry);
}

function clearAuthFailures(ip: string): void {
  authAttempts.delete(ip);
}

function issueAdminToken(): string {
  const now = Date.now();
  const payload = Buffer.from(
    JSON.stringify({ iat: now, exp: now + ADMIN_TOKEN_TTL_MS }),
    'utf8'
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifyAdminToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sigHex] = parts;
  if (!payload || !sigHex) return false;
  const expectedHex = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
  const sigBuf = Buffer.from(sigHex, 'hex');
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (sigBuf.length === 0 || sigBuf.length !== expectedBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      iat?: number;
      exp?: number;
    };
    const now = Date.now();
    if (typeof parsed.exp !== 'number' || parsed.exp <= now) return false;
    if (typeof parsed.iat !== 'number' || parsed.iat < tokenValidAfterMs) return false;
    return true;
  } catch {
    return false;
  }
}

function extractBearerToken(req: express.Request): string | null {
  const h = req.headers.authorization;
  if (typeof h !== 'string') return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function requireAdminAuth(req: express.Request, res: express.Response): boolean {
  const ip = req.ip || 'local';
  const rl = checkRateLimit(ip);
  if (!rl.allowed) {
    res.status(429).json({
      ok: false,
      message: `Thử sai quá nhiều lần. Vui lòng thử lại sau ${rl.retryAfterSec} giây.`,
    });
    return false;
  }

  const cfg = readAuthConfig();
  if (!cfg) {
    res.status(412).json({
      ok: false,
      code: 'AUTH_NOT_CONFIGURED',
      message: 'Chưa thiết lập mật khẩu quản trị trên máy chủ.',
    });
    return false;
  }

  const token = extractBearerToken(req);
  if (token && verifyAdminToken(token)) {
    clearAuthFailures(ip);
    return true;
  }

  const pwd = typeof req.body?.password === 'string' ? req.body.password : '';
  if (pwd && verifyPasswordAgainstConfig(pwd, cfg)) {
    clearAuthFailures(ip);
    return true;
  }

  recordFailedAuth(ip);
  res.status(401).json({
    ok: false,
    message: token
      ? 'Phiên xác thực quản trị đã hết hạn hoặc không hợp lệ. Vui lòng mở lại Cài đặt.'
      : 'Mật khẩu quản trị không đúng hoặc chưa xác thực.',
  });
  return false;
}

function isConfiguredMachineKey(mk: string, settings: ScheduleSettings): boolean {
  return MACHINE_KEY_RE.test(mk) && settings.machines.some((m) => m.key === mk);
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

  const extraOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  const allowedOrigins = new Set(['https://mhbvst.github.io', ...extraOrigins]);

  app.use((req, res, next) => {
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin.replace(/\/+$/, '') : '';
    if (origin && allowedOrigins.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use(express.json({ limit: '64kb' }));

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  // GET /api/today
  app.get('/api/today', (_req, res) => {
    res.json({
      ok: true,
      today: todayKey(),
      timezone: TZ,
    });
  });

  // GET /api/states?dateKey=yyyy-MM-dd
  app.get('/api/states', async (req, res) => {
    const dk = normDateKey(req.query.dateKey);
    if (!dk) {
      res.status(400).json({ ok: false, message: 'Định dạng ngày không hợp lệ (yyyy-MM-dd).' });
      return;
    }
    const today = todayKey();
    const { store, settingsRec } = await withLock(() => ({
      store: readStore(),
      settingsRec: readSettingsRecord(),
    }));
    const machines: Record<string, { state: Record<string, boolean>; count: number; updatedAt: string | null }> = {};

    for (const machineMeta of settingsRec.settings.machines) {
      const mk = machineMeta.key;
      const rec = store[buildKey(mk, dk)];
      const state = rec?.slots || {};
      machines[mk] = {
        state,
        count: Object.values(state).filter(Boolean).length,
        updatedAt: rec?.updatedAt || null,
      };
    }

    res.json({
      ok: true,
      dateKey: dk,
      today,
      isToday: dk === today,
      machines,
      settings: settingsRec.settings,
      settingsUpdatedAt: settingsRec.updatedAt,
    });
  });

  // GET /api/settings
  app.get('/api/settings', async (_req, res) => {
    const rec = await withLock(() => readSettingsRecord());
    res.json({
      ok: true,
      settings: rec.settings,
      updatedAt: rec.updatedAt,
    });
  });

  // POST /api/settings (requires admin authentication)
  app.post('/api/settings', async (req, res) => {
    if (!requireAdminAuth(req, res)) return;

    const candidate = sanitizeScheduleSettings(req.body?.settings ?? req.body);
    if (!candidate) {
      res.status(400).json({ ok: false, message: 'Dữ liệu cài đặt lịch chụp không hợp lệ.' });
      return;
    }

    const analysis = analyzeScheduleSettings(candidate);
    if (analysis.errors.length > 0) {
      res.status(400).json({ ok: false, message: analysis.errors[0], analysis });
      return;
    }
    if (analysis.startCollisions.length > 0) {
      const sample = analysis.startCollisions
        .slice(0, 3)
        .map((c) => c.time)
        .join(', ');
      res.status(400).json({
        ok: false,
        message: `Cảnh báo: Phát hiện ${analysis.startCollisions.length} mốc trùng thời gian bắt đầu giữa các máy (${sample}). Thời gian bắt đầu giữa các máy không được trùng nhau.`,
        analysis,
      });
      return;
    }
    if (analysis.endCollisions.length > 0) {
      const sample = analysis.endCollisions
        .slice(0, 3)
        .map((c) => c.time)
        .join(', ');
      res.status(400).json({
        ok: false,
        message: `Cảnh báo: Phát hiện ${analysis.endCollisions.length} mốc trùng thời gian kết thúc giữa các máy (${sample}). Vui lòng điều chỉnh thông số.`,
        analysis,
      });
      return;
    }

    const updatedAt = await withLock(() => writeSettingsRecord(candidate));
    res.json({
      ok: true,
      settings: candidate,
      updatedAt,
    });
  });

  // GET /api/state?machineKey=...&dateKey=...
  app.get('/api/state', async (req, res) => {
    const mk = String(req.query.machineKey || '').trim().toUpperCase();
    const dk = normDateKey(req.query.dateKey);
    if (!dk) {
      res.status(400).json({ ok: false, message: 'Định dạng ngày không hợp lệ (yyyy-MM-dd).' });
      return;
    }
    const today = todayKey();
    const { store, settingsRec } = await withLock(() => ({
      store: readStore(),
      settingsRec: readSettingsRecord(),
    }));
    if (!isConfiguredMachineKey(mk, settingsRec.settings)) {
      res.status(400).json({ ok: false, message: 'Mã máy chụp không hợp lệ.' });
      return;
    }
    const rec = store[buildKey(mk, dk)];
    const state = rec?.slots || {};
    res.json({
      ok: true,
      machineKey: mk,
      dateKey: dk,
      today,
      isToday: dk === today,
      state,
      count: Object.values(state).filter(Boolean).length,
      updatedAt: rec?.updatedAt || null,
    });
  });

  // POST /api/slot (atomic slot toggle with Lock to prevent multi-user overwrite)
  app.post('/api/slot', async (req, res) => {
    const { machineKey, dateKey, slotId, checked } = req.body || {};
    const mk = String(machineKey || '').trim().toUpperCase();
    const dk = normDateKey(dateKey);
    if (!dk) {
      res.status(400).json({ ok: false, message: 'Định dạng ngày không hợp lệ.' });
      return;
    }
    const today = todayKey();
    if (dk !== today) {
      res.status(403).json({
        ok: false,
        message: 'Chỉ được phép cập nhật ca chụp cho ngày hôm nay. Ngày khác đang ở chế độ chỉ xem.',
      });
      return;
    }
    if (typeof slotId !== 'string' || !SLOT_KEY_RE.test(slotId)) {
      res.status(400).json({ ok: false, message: 'Mã ca chụp không hợp lệ.' });
      return;
    }
    if (typeof checked !== 'boolean') {
      res.status(400).json({ ok: false, message: 'Trạng thái chọn ca không hợp lệ.' });
      return;
    }

    const result = await withLock(() => {
      const settingsRec = readSettingsRecord();
      if (!isConfiguredMachineKey(mk, settingsRec.settings)) {
        return { invalidMachine: true as const };
      }
      const store = readStore();
      const key = buildKey(mk, dk);
      const current = store[key]?.slots ? { ...store[key].slots } : {};
      if (checked) {
        current[slotId] = true;
      } else {
        delete current[slotId];
      }
      const updatedAt = new Date().toISOString();
      store[key] = { slots: current, updatedAt };
      writeStore(store);
      return {
        invalidMachine: false as const,
        state: current,
        count: Object.keys(current).length,
        updatedAt,
      };
    });

    if (result.invalidMachine) {
      res.status(400).json({ ok: false, message: 'Mã máy chụp không hợp lệ.' });
      return;
    }

    res.json({
      ok: true,
      machineKey: mk,
      dateKey: dk,
      state: result.state,
      count: result.count,
      updatedAt: result.updatedAt,
    });
  });

  // POST /api/state (full state save compatibility)
  app.post('/api/state', async (req, res) => {
    const { machineKey, dateKey, state } = req.body || {};
    const mk = String(machineKey || '').trim().toUpperCase();
    const dk = normDateKey(dateKey);
    if (!dk) {
      res.status(400).json({ ok: false, message: 'Định dạng ngày không hợp lệ.' });
      return;
    }
    const today = todayKey();
    if (dk !== today) {
      res.status(403).json({
        ok: false,
        message: 'Không thể ghi đè lịch của ngày khác. Chỉ ngày hôm nay được phép chỉnh sửa.',
      });
      return;
    }
    const cleaned = sanitizeSlots(state);
    if (!cleaned) {
      res.status(400).json({ ok: false, message: 'Dữ liệu trạng thái không đúng định dạng.' });
      return;
    }

    const saveRes = await withLock(() => {
      const settingsRec = readSettingsRecord();
      if (!isConfiguredMachineKey(mk, settingsRec.settings)) {
        return { invalidMachine: true as const };
      }
      const store = readStore();
      const ts = new Date().toISOString();
      store[buildKey(mk, dk)] = { slots: cleaned, updatedAt: ts };
      writeStore(store);
      return { invalidMachine: false as const, updatedAt: ts };
    });

    if (saveRes.invalidMachine) {
      res.status(400).json({ ok: false, message: 'Mã máy chụp không hợp lệ.' });
      return;
    }

    res.json({
      ok: true,
      machineKey: mk,
      dateKey: dk,
      state: cleaned,
      count: Object.keys(cleaned).length,
      updatedAt: saveRes.updatedAt,
    });
  });

  // GET /api/auth/status
  app.get('/api/auth/status', (_req, res) => {
    const cfg = readAuthConfig();
    res.json({
      ok: true,
      configured: Boolean(cfg),
      source: cfg?.updatedAt === 'env' ? 'env' : cfg ? 'server' : 'unconfigured',
    });
  });

  // POST /api/auth/setup (only allowed when no admin password is configured yet)
  app.post('/api/auth/setup', async (req, res) => {
    const { password } = req.body || {};
    const pwd = typeof password === 'string' ? password : '';
    if (pwd.length < 6) {
      res.status(400).json({ ok: false, message: 'Mật khẩu quản trị phải có tối thiểu 6 ký tự.' });
      return;
    }
    const result = await withLock(() => {
      const existing = readAuthConfig();
      if (existing) {
        return { ok: false, status: 409, message: 'Mật khẩu quản trị đã được thiết lập trên máy chủ.' };
      }
      writeAuthConfig(pwd);
      return { ok: true, status: 200 };
    });

    if (!result.ok) {
      res.status(result.status).json({ ok: false, message: result.message });
      return;
    }
    res.json({
      ok: true,
      token: issueAdminToken(),
      message: 'Đã thiết lập mật khẩu quản trị máy chủ.',
    });
  });

  // POST /api/auth/verify
  app.post('/api/auth/verify', (req, res) => {
    const ip = req.ip || 'local';
    const rl = checkRateLimit(ip);
    if (!rl.allowed) {
      res.status(429).json({
        ok: false,
        message: `Thử sai quá nhiều lần. Vui lòng thử lại sau ${rl.retryAfterSec} giây.`,
      });
      return;
    }

    const cfg = readAuthConfig();
    if (!cfg) {
      res.status(412).json({
        ok: false,
        code: 'AUTH_NOT_CONFIGURED',
        message: 'Chưa thiết lập mật khẩu quản trị trên máy chủ.',
      });
      return;
    }

    const pwd = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!pwd || !verifyPasswordAgainstConfig(pwd, cfg)) {
      recordFailedAuth(ip);
      res.status(401).json({ ok: false, message: 'Mật khẩu quản trị không đúng.' });
      return;
    }

    clearAuthFailures(ip);
    res.json({ ok: true, token: issueAdminToken() });
  });

  // POST /api/auth/change-password
  app.post('/api/auth/change-password', async (req, res) => {
    const ip = req.ip || 'local';
    const rl = checkRateLimit(ip);
    if (!rl.allowed) {
      res.status(429).json({
        ok: false,
        message: `Thử sai quá nhiều lần. Vui lòng thử lại sau ${rl.retryAfterSec} giây.`,
      });
      return;
    }

    const { currentPassword, newPassword } = req.body || {};
    const cur = typeof currentPassword === 'string' ? currentPassword : '';
    const next = typeof newPassword === 'string' ? newPassword : '';

    if (next.length < 6) {
      res.status(400).json({ ok: false, message: 'Mật khẩu mới phải có tối thiểu 6 ký tự.' });
      return;
    }

    const result = await withLock(() => {
      const cfg = readAuthConfig();
      if (!cfg) {
        return { ok: false, status: 412, message: 'Chưa thiết lập mật khẩu quản trị.' };
      }
      if (cfg.updatedAt === 'env') {
        return {
          ok: false,
          status: 400,
          message: 'Mật khẩu đang quản lý qua biến môi trường ADMIN_PASSWORD trên máy chủ.',
        };
      }
      if (!cur || !verifyPasswordAgainstConfig(cur, cfg)) {
        return { ok: false, status: 401, message: 'Mật khẩu hiện tại không đúng.' };
      }
      writeAuthConfig(next);
      tokenValidAfterMs = Date.now();
      return { ok: true, status: 200 };
    });

    if (!result.ok) {
      if (result.status === 401) recordFailedAuth(ip);
      res.status(result.status).json({ ok: false, message: result.message });
      return;
    }
    clearAuthFailures(ip);
    res.json({
      ok: true,
      token: issueAdminToken(),
      message: 'Đã cập nhật mật khẩu quản trị thành công.',
    });
  });

  // POST /api/reset (requires Bearer admin token OR password)
  app.post('/api/reset', async (req, res) => {
    if (!requireAdminAuth(req, res)) return;

    const { machineKey, dateKey } = req.body || {};
    const mk = String(machineKey || '').trim().toUpperCase();
    const dk = normDateKey(dateKey);
    if (!dk) {
      res.status(400).json({ ok: false, message: 'Định dạng ngày không hợp lệ.' });
      return;
    }

    const resetRes = await withLock(() => {
      const settingsRec = readSettingsRecord();
      if (!isConfiguredMachineKey(mk, settingsRec.settings)) {
        return { invalidMachine: true as const };
      }
      const store = readStore();
      delete store[buildKey(mk, dk)];
      writeStore(store);
      return { invalidMachine: false as const };
    });

    if (resetRes.invalidMachine) {
      res.status(400).json({ ok: false, message: 'Mã máy chụp không hợp lệ.' });
      return;
    }

    res.json({ ok: true, machineKey: mk, dateKey: dk });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Hospital Pro X-Ray Scheduler listening on port ${PORT}`);
  });
}

startServer();
