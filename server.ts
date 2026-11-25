import crypto from 'crypto';
import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import {
  analyzeScheduleSettings,
  MACHINE_KEY_RE,
  sanitizeScheduleSettings,
  ScheduleSettings,
} from './src/utils/scheduleGenerator';
import {
  changeStoredAuthPassword,
  claimInitialAuthConfig,
  deleteStateForDay,
  getStorageMode,
  initStorage,
  readAuthConfig,
  readSettingsRecord,
  readSingleState,
  readStatesBundle,
  sanitizeSlots,
  saveFullStateAtomic,
  toggleSlotAtomic,
  verifyPasswordAgainstConfig,
  writeSettingsRecord,
} from './src/server/storage';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const TZ = 'Asia/Ho_Chi_Minh';
const SLOT_KEY_RE = /^(m|a):([1-9]\d{0,2})$/;
const ADMIN_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;
const TOKEN_SECRET =
  (process.env.SESSION_SECRET || '').trim() || crypto.randomBytes(32).toString('hex');
let tokenValidAfterMs = 0;

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

// ===== Rate limiter & token helpers =====
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

async function requireAdminAuth(req: express.Request, res: express.Response): Promise<boolean> {
  const ip = req.ip || 'local';
  const rl = checkRateLimit(ip);
  if (!rl.allowed) {
    res.status(429).json({
      ok: false,
      message: `Thử sai quá nhiều lần. Vui lòng thử lại sau ${rl.retryAfterSec} giây.`,
    });
    return false;
  }

  const cfg = await readAuthConfig();
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
  const storageMode = await initStorage();
  console.log(`Storage initialized: ${storageMode}`);

  const app = express();
  app.set('trust proxy', 1);

  const extraOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  const allowedOrigins = new Set(['https://mhbvst.github.io', ...extraOrigins]);

  app.use((req, res, next) => {
    const origin =
      typeof req.headers.origin === 'string' ? req.headers.origin.replace(/\/+$/, '') : '';
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
    res.json({ ok: true, storage: getStorageMode() });
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
    try {
      const today = todayKey();
      const { settingsRec, recordsByMachine } = await readStatesBundle(dk);
      const machines: Record<
        string,
        { state: Record<string, boolean>; count: number; updatedAt: string | null }
      > = {};

      for (const machineMeta of settingsRec.settings.machines) {
        const mk = machineMeta.key;
        const rec = recordsByMachine[mk];
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
    } catch (err) {
      console.error('GET /api/states error:', err instanceof Error ? err.message : err);
      res.status(500).json({ ok: false, message: 'Không thể tải dữ liệu từ cơ sở dữ liệu.' });
    }
  });

  // GET /api/settings
  app.get('/api/settings', async (_req, res) => {
    try {
      const rec = await readSettingsRecord();
      res.json({
        ok: true,
        settings: rec.settings,
        updatedAt: rec.updatedAt,
      });
    } catch (err) {
      console.error('GET /api/settings error:', err instanceof Error ? err.message : err);
      res.status(500).json({ ok: false, message: 'Không thể tải cài đặt từ máy chủ.' });
    }
  });

  // POST /api/settings (requires admin authentication)
  app.post('/api/settings', async (req, res) => {
    try {
      if (!(await requireAdminAuth(req, res))) return;

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

      const updatedAt = await writeSettingsRecord(candidate);
      res.json({
        ok: true,
        settings: candidate,
        updatedAt,
      });
    } catch (err) {
      console.error('POST /api/settings error:', err instanceof Error ? err.message : err);
      res.status(500).json({ ok: false, message: 'Không thể lưu cài đặt lên máy chủ.' });
    }
  });

  // GET /api/state?machineKey=...&dateKey=...
  app.get('/api/state', async (req, res) => {
    const mk = String(req.query.machineKey || '').trim().toUpperCase();
    const dk = normDateKey(req.query.dateKey);
    if (!dk) {
      res.status(400).json({ ok: false, message: 'Định dạng ngày không hợp lệ (yyyy-MM-dd).' });
      return;
    }
    try {
      const today = todayKey();
      const readRes = await readSingleState(mk, dk, isConfiguredMachineKey);
      if (readRes.invalidMachine) {
        res.status(400).json({ ok: false, message: 'Mã máy chụp không hợp lệ.' });
        return;
      }
      const state = readRes.record.slots;
      res.json({
        ok: true,
        machineKey: mk,
        dateKey: dk,
        today,
        isToday: dk === today,
        state,
        count: Object.values(state).filter(Boolean).length,
        updatedAt: readRes.record.updatedAt,
      });
    } catch (err) {
      console.error('GET /api/state error:', err instanceof Error ? err.message : err);
      res.status(500).json({ ok: false, message: 'Không thể tải dữ liệu máy chụp.' });
    }
  });

  // POST /api/slot (atomic slot toggle)
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

    try {
      const result = await toggleSlotAtomic(mk, dk, slotId, checked, isConfiguredMachineKey);
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
    } catch (err) {
      console.error('POST /api/slot error:', err instanceof Error ? err.message : err);
      res.status(500).json({ ok: false, message: 'Không thể lưu trạng thái ca chụp.' });
    }
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

    try {
      const saveRes = await saveFullStateAtomic(mk, dk, cleaned, isConfiguredMachineKey);
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
    } catch (err) {
      console.error('POST /api/state error:', err instanceof Error ? err.message : err);
      res.status(500).json({ ok: false, message: 'Không thể lưu lịch chụp.' });
    }
  });

  // GET /api/auth/status
  app.get('/api/auth/status', async (_req, res) => {
    try {
      const cfg = await readAuthConfig();
      res.json({
        ok: true,
        configured: Boolean(cfg),
        source: cfg?.updatedAt === 'env' ? 'env' : cfg ? 'server' : 'unconfigured',
      });
    } catch (err) {
      console.error('GET /api/auth/status error:', err instanceof Error ? err.message : err);
      res.status(500).json({ ok: false, message: 'Không thể kiểm tra trạng thái xác thực.' });
    }
  });

  // POST /api/auth/setup (only allowed when no admin password is configured yet)
  app.post('/api/auth/setup', async (req, res) => {
    const { password } = req.body || {};
    const pwd = typeof password === 'string' ? password : '';
    if (pwd.length < 6) {
      res.status(400).json({ ok: false, message: 'Mật khẩu quản trị phải có tối thiểu 6 ký tự.' });
      return;
    }

    try {
      const result = await claimInitialAuthConfig(pwd);
      if (!result.ok) {
        res.status(409).json({ ok: false, message: result.message });
        return;
      }
      res.json({
        ok: true,
        token: issueAdminToken(),
        message: 'Đã thiết lập mật khẩu quản trị máy chủ.',
      });
    } catch (err) {
      console.error('POST /api/auth/setup error:', err instanceof Error ? err.message : err);
      res.status(500).json({ ok: false, message: 'Không thể thiết lập mật khẩu quản trị.' });
    }
  });

  // POST /api/auth/verify
  app.post('/api/auth/verify', async (req, res) => {
    const ip = req.ip || 'local';
    const rl = checkRateLimit(ip);
    if (!rl.allowed) {
      res.status(429).json({
        ok: false,
        message: `Thử sai quá nhiều lần. Vui lòng thử lại sau ${rl.retryAfterSec} giây.`,
      });
      return;
    }

    try {
      const cfg = await readAuthConfig();
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
    } catch (err) {
      console.error('POST /api/auth/verify error:', err instanceof Error ? err.message : err);
      res.status(500).json({ ok: false, message: 'Không thể xác thực quản trị.' });
    }
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

    try {
      const result = await changeStoredAuthPassword(cur, next);
      if (!result.ok) {
        if (result.status === 401) recordFailedAuth(ip);
        res.status(result.status).json({ ok: false, message: result.message });
        return;
      }
      tokenValidAfterMs = Date.now();
      clearAuthFailures(ip);
      res.json({
        ok: true,
        token: issueAdminToken(),
        message: 'Đã cập nhật mật khẩu quản trị thành công.',
      });
    } catch (err) {
      console.error('POST /api/auth/change-password error:', err instanceof Error ? err.message : err);
      res.status(500).json({ ok: false, message: 'Không thể đổi mật khẩu quản trị.' });
    }
  });

  // POST /api/reset (requires Bearer admin token OR password)
  app.post('/api/reset', async (req, res) => {
    try {
      if (!(await requireAdminAuth(req, res))) return;

      const { machineKey, dateKey } = req.body || {};
      const mk = String(machineKey || '').trim().toUpperCase();
      const dk = normDateKey(dateKey);
      if (!dk) {
        res.status(400).json({ ok: false, message: 'Định dạng ngày không hợp lệ.' });
        return;
      }

      const resetRes = await deleteStateForDay(mk, dk, isConfiguredMachineKey);
      if (resetRes.invalidMachine) {
        res.status(400).json({ ok: false, message: 'Mã máy chụp không hợp lệ.' });
        return;
      }

      res.json({ ok: true, machineKey: mk, dateKey: dk });
    } catch (err) {
      console.error('POST /api/reset error:', err instanceof Error ? err.message : err);
      res.status(500).json({ ok: false, message: 'Không thể reset dữ liệu ngày.' });
    }
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

startServer().catch((err) => {
  console.error('Failed to start server:', err instanceof Error ? err.message : err);
  process.exit(1);
});
