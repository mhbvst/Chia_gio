import { MachineKey } from '../data/schedules';
import {
  analyzeScheduleSettings,
  DEFAULT_SCHEDULE_SETTINGS,
  MACHINE_KEY_RE,
  sanitizeScheduleSettings,
  ScheduleSettings,
} from '../utils/scheduleGenerator';
import type { AuthStatusResponse, MachineStatePayload, StatesResponse } from './scheduleApi';

const TZ = 'Asia/Ho_Chi_Minh';
const SLOT_KEY_RE = /^(m|a):([1-9]\d{0,2})$/;
const SETTINGS_KEY = 'xq_gh_schedule_settings_v1';
const AUTH_KEY = 'xq_gh_admin_auth_v1';
const STATE_PREFIX = 'xq_gh_state_v1__';
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

interface LocalAuthRecord {
  salt: string;
  hash: string;
  updatedAt: string;
}

interface LocalDayRecord {
  slots: Record<string, boolean>;
  updatedAt: string | null;
}

// Session token held ONLY in JS memory (never written to localStorage/sessionStorage)
let inMemoryToken: string | null = null;
let inMemoryTokenExp = 0;
let failCount = 0;
let lockedUntilMs = 0;

function makeError(message: string, status = 400, code?: string): Error {
  const err = new Error(message) as Error & { status?: number; code?: string };
  err.status = status;
  if (code) err.code = code;
  return err;
}

function getTodayKeyVN(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  return `${map.year}-${map.month}-${map.day}`;
}

function normDateKey(dateStr?: string): string | null {
  if (!dateStr || !dateStr.trim()) return getTodayKeyVN();
  const s = dateStr.trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return s;
}

function readSettingsRecord(): { settings: ScheduleSettings; updatedAt: string | null } {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { settings?: unknown; updatedAt?: string };
      const clean = sanitizeScheduleSettings(parsed?.settings ?? parsed);
      if (clean) {
        return { settings: clean, updatedAt: parsed?.updatedAt || null };
      }
    }
  } catch {
    // ignore storage errors
  }
  return {
    settings: {
      ...DEFAULT_SCHEDULE_SETTINGS,
      machines: DEFAULT_SCHEDULE_SETTINGS.machines.map((m) => ({ ...m })),
    },
    updatedAt: null,
  };
}

function writeSettingsRecord(settings: ScheduleSettings): string {
  const updatedAt = new Date().toISOString();
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ settings, updatedAt }));
  } catch {
    // ignore storage errors
  }
  return updatedAt;
}

function readDayRecord(machineKey: MachineKey, dateKey: string): LocalDayRecord {
  try {
    const raw = window.localStorage.getItem(`${STATE_PREFIX}${dateKey}__${machineKey}`);
    if (raw) {
      const parsed = JSON.parse(raw) as { slots?: Record<string, unknown>; updatedAt?: string };
      const cleaned: Record<string, boolean> = {};
      if (parsed?.slots && typeof parsed.slots === 'object') {
        for (const [k, v] of Object.entries(parsed.slots)) {
          if (SLOT_KEY_RE.test(k) && v === true) cleaned[k] = true;
        }
      }
      return { slots: cleaned, updatedAt: parsed?.updatedAt || null };
    }
  } catch {
    // ignore
  }
  return { slots: {}, updatedAt: null };
}

function writeDayRecord(machineKey: MachineKey, dateKey: string, slots: Record<string, boolean>): string {
  const updatedAt = new Date().toISOString();
  const key = `${STATE_PREFIX}${dateKey}__${machineKey}`;
  try {
    if (Object.keys(slots).length === 0) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, JSON.stringify({ slots, updatedAt }));
    }
  } catch {
    // ignore
  }
  return updatedAt;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function randomHex(byteCount = 16): string {
  const buf = new Uint8Array(byteCount);
  window.crypto.getRandomValues(buf);
  return toHex(buf);
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return toHex(new Uint8Array(digest));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function readAuthRecord(): LocalAuthRecord | null {
  try {
    const raw = window.localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalAuthRecord;
    if (parsed?.salt && parsed?.hash) return parsed;
  } catch {
    // ignore
  }
  return null;
}

function writeAuthRecord(salt: string, hash: string): void {
  try {
    window.localStorage.setItem(
      AUTH_KEY,
      JSON.stringify({ salt, hash, updatedAt: new Date().toISOString() })
    );
  } catch {
    // ignore
  }
}

function issueMemoryToken(): string {
  inMemoryToken = randomHex(24);
  inMemoryTokenExp = Date.now() + TOKEN_TTL_MS;
  return inMemoryToken;
}

async function requireLocalAdmin(credential?: { password?: string; token?: string | null } | string | null): Promise<void> {
  const cfg = readAuthRecord();
  if (!cfg) {
    throw makeError('Chưa thiết lập mật khẩu quản trị trên trình duyệt này.', 412, 'AUTH_NOT_CONFIGURED');
  }
  if (Date.now() < lockedUntilMs) {
    const waitSec = Math.ceil((lockedUntilMs - Date.now()) / 1000);
    throw makeError(`Thử sai quá nhiều lần. Vui lòng thử lại sau ${waitSec} giây.`, 429);
  }

  let token: string | null = null;
  let password = '';
  if (typeof credential === 'string') {
    password = credential;
  } else if (credential) {
    token = credential.token || null;
    password = credential.password || '';
  }

  if (token && inMemoryToken && Date.now() < inMemoryTokenExp && constantTimeEqual(token, inMemoryToken)) {
    return;
  }

  if (!password) {
    throw makeError('Cần xác thực mật khẩu quản trị để thực hiện thao tác này.', 401, 'AUTH_REQUIRED');
  }

  const candidate = await hashPassword(password, cfg.salt);
  if (!constantTimeEqual(candidate, cfg.hash)) {
    failCount++;
    if (failCount >= 5) {
      lockedUntilMs = Date.now() + 60000;
      failCount = 0;
    }
    throw makeError('Mật khẩu quản trị không đúng.', 401);
  }
  failCount = 0;
  lockedUntilMs = 0;
}

export const localStoreAdapter = {
  async fetchToday(): Promise<{ today: string; timezone: string }> {
    return { today: getTodayKeyVN(), timezone: TZ };
  },

  async fetchStatesForDate(dateKey?: string): Promise<StatesResponse> {
    const dk = normDateKey(dateKey);
    if (!dk) throw makeError('Định dạng ngày không hợp lệ (yyyy-MM-dd).', 400);
    const today = getTodayKeyVN();
    const { settings, updatedAt } = readSettingsRecord();
    const machines: Record<MachineKey, MachineStatePayload> = {};
    for (const meta of settings.machines) {
      const rec = readDayRecord(meta.key, dk);
      machines[meta.key] = {
        state: rec.slots,
        count: Object.values(rec.slots).filter(Boolean).length,
        updatedAt: rec.updatedAt,
      };
    }
    return {
      ok: true,
      dateKey: dk,
      today,
      isToday: dk === today,
      machines,
      settings,
      settingsUpdatedAt: updatedAt,
    };
  },

  async toggleSlot(
    machineKey: MachineKey,
    dateKey: string,
    slotId: string,
    checked: boolean
  ): Promise<{ ok: boolean; state: Record<string, boolean>; count: number; updatedAt: string }> {
    const mk = String(machineKey || '').trim().toUpperCase();
    const dk = normDateKey(dateKey);
    if (!dk) throw makeError('Định dạng ngày không hợp lệ.', 400);
    if (dk !== getTodayKeyVN()) {
      throw makeError('Chỉ được phép cập nhật ca chụp cho ngày hôm nay. Ngày khác đang ở chế độ chỉ xem.', 403);
    }
    if (!SLOT_KEY_RE.test(slotId)) throw makeError('Mã ca chụp không hợp lệ.', 400);
    const { settings } = readSettingsRecord();
    if (!MACHINE_KEY_RE.test(mk) || !settings.machines.some((m) => m.key === mk)) {
      throw makeError('Mã máy chụp không hợp lệ.', 400);
    }
    const cur = readDayRecord(mk, dk).slots;
    if (checked) cur[slotId] = true;
    else delete cur[slotId];
    const updatedAt = writeDayRecord(mk, dk, cur);
    return { ok: true, state: cur, count: Object.keys(cur).length, updatedAt };
  },

  async resetMachineDay(
    machineKey: MachineKey,
    dateKey: string,
    credential: { password?: string; token?: string | null } | string
  ): Promise<{ ok: boolean }> {
    await requireLocalAdmin(credential);
    const mk = String(machineKey || '').trim().toUpperCase();
    const dk = normDateKey(dateKey);
    if (!dk) throw makeError('Định dạng ngày không hợp lệ.', 400);
    const { settings } = readSettingsRecord();
    if (!MACHINE_KEY_RE.test(mk) || !settings.machines.some((m) => m.key === mk)) {
      throw makeError('Mã máy chụp không hợp lệ.', 400);
    }
    writeDayRecord(mk, dk, {});
    return { ok: true };
  },

  async fetchAuthStatus(): Promise<AuthStatusResponse> {
    const cfg = readAuthRecord();
    return { ok: true, configured: Boolean(cfg), source: cfg ? 'server' : 'unconfigured' };
  },

  async setupAdminPassword(password: string): Promise<{ ok: boolean; token?: string; message?: string }> {
    if (password.length < 6) {
      throw makeError('Mật khẩu quản trị phải có tối thiểu 6 ký tự.', 400);
    }
    if (readAuthRecord()) {
      throw makeError('Mật khẩu quản trị đã được thiết lập trước đó.', 409);
    }
    const salt = randomHex(16);
    const hash = await hashPassword(password, salt);
    writeAuthRecord(salt, hash);
    return {
      ok: true,
      token: issueMemoryToken(),
      message: 'Đã thiết lập mật khẩu quản trị trên trình duyệt.',
    };
  },

  async verifyAdminPassword(password: string): Promise<{ ok: boolean; token?: string }> {
    await requireLocalAdmin({ password });
    return { ok: true, token: issueMemoryToken() };
  },

  async changeAdminPassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ ok: boolean; token?: string; message?: string }> {
    if (newPassword.length < 6) {
      throw makeError('Mật khẩu mới phải có tối thiểu 6 ký tự.', 400);
    }
    await requireLocalAdmin({ password: currentPassword });
    const salt = randomHex(16);
    const hash = await hashPassword(newPassword, salt);
    writeAuthRecord(salt, hash);
    return {
      ok: true,
      token: issueMemoryToken(),
      message: 'Đã cập nhật mật khẩu quản trị thành công.',
    };
  },

  async fetchScheduleSettings(): Promise<{ ok: boolean; settings: ScheduleSettings; updatedAt: string | null }> {
    const rec = readSettingsRecord();
    return { ok: true, settings: rec.settings, updatedAt: rec.updatedAt };
  },

  async saveScheduleSettings(
    settings: ScheduleSettings,
    adminToken?: string | null
  ): Promise<{ ok: boolean; settings: ScheduleSettings; updatedAt: string }> {
    await requireLocalAdmin({ token: adminToken });
    const clean = sanitizeScheduleSettings(settings);
    if (!clean) throw makeError('Dữ liệu cài đặt lịch chụp không hợp lệ.', 400);
    const analysis = analyzeScheduleSettings(clean);
    if (analysis.errors.length > 0) throw makeError(analysis.errors[0], 400);
    if (analysis.startCollisions.length > 0) {
      throw makeError('Cảnh báo: Phát hiện các ca giữa các máy bị trùng thời gian bắt đầu.', 400);
    }
    if (analysis.endCollisions.length > 0) {
      throw makeError('Cảnh báo: Phát hiện các ca giữa các máy bị trùng thời gian kết thúc.', 400);
    }
    const updatedAt = writeSettingsRecord(clean);
    return { ok: true, settings: clean, updatedAt };
  },
};
