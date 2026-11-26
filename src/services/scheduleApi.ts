import { MachineKey } from '../data/schedules';
import { ScheduleSettings } from '../utils/scheduleGenerator';
import { localStoreAdapter } from './localStoreAdapter';

export interface MachineStatePayload {
  state: Record<string, boolean>;
  count: number;
  updatedAt: string | null;
}

export interface StatesResponse {
  ok: boolean;
  dateKey: string;
  today: string;
  isToday: boolean;
  machines: Record<MachineKey, MachineStatePayload>;
  settings?: ScheduleSettings;
  settingsUpdatedAt?: string | null;
}

export interface AuthStatusResponse {
  ok: boolean;
  configured: boolean;
  source: 'env' | 'server' | 'unconfigured';
}

const RAW_API_BASE = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
const RESOLVED_API_BASE =
  RAW_API_BASE ||
  (typeof window !== 'undefined' && window.location.hostname === 'mhbvst.github.io'
    ? 'https://hospital-pro-xray-scheduler.onrender.com'
    : '');

function isGithubPagesStaticHost(): boolean {
  if (typeof window === 'undefined') return false;
  return !RESOLVED_API_BASE && window.location.hostname.endsWith('.github.io');
}

function apiUrl(path: string): string {
  return `${RESOLVED_API_BASE}${path}`;
}

let useLocalFallback = isGithubPagesStaticHost();

async function parseJson<T>(res: Response): Promise<T & { ok?: boolean; message?: string; code?: string }> {
  if (!res.ok) {
    const errData = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
    const err = new Error(errData.message || `Lỗi máy chủ (${res.status})`) as Error & {
      status?: number;
      code?: string;
    };
    err.status = res.status;
    err.code = errData.code;
    throw err;
  }
  const data = (await res.json()) as T & { ok?: boolean; message?: string; code?: string };
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new SyntaxError('Phản hồi JSON từ máy chủ không hợp lệ.');
  }
  return data;
}

async function withBackendOrStatic<T>(
  remoteFn: () => Promise<T>,
  localFn: () => Promise<T>
): Promise<T> {
  if (useLocalFallback) {
    return localFn();
  }
  try {
    return await remoteFn();
  } catch (err) {
    // If deployed to static hosting without /api backend (404/405 HTML or invalid JSON when no remote API base is set)
    const status = (err as { status?: number })?.status;
    const isMissingStaticApi =
      !RESOLVED_API_BASE && (status === 404 || status === 405 || err instanceof SyntaxError);
    if (isMissingStaticApi) {
      useLocalFallback = true;
      return localFn();
    }
    throw err;
  }
}

async function fetchJsonWithRetry<T>(path: string): Promise<T & { ok?: boolean; message?: string; code?: string }> {
  const url = apiUrl(path);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if ((res.status === 502 || res.status === 503 || res.status === 504) && attempt === 0) {
        await new Promise((r) => setTimeout(r, 2500));
        continue;
      }
      return await parseJson<T>(res);
    } catch (err) {
      lastErr = err;
      const status = (err as { status?: number })?.status;
      const isTransientNet = err instanceof TypeError;
      if (attempt === 0 && (isTransientNet || status === 502 || status === 503 || status === 504)) {
        await new Promise((r) => setTimeout(r, 2500));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

export async function fetchToday(): Promise<{ today: string; timezone: string }> {
  return withBackendOrStatic(
    async () => fetchJsonWithRetry('/api/today'),
    () => localStoreAdapter.fetchToday()
  );
}

export async function fetchStatesForDate(dateKey?: string): Promise<StatesResponse> {
  const q = dateKey ? `?dateKey=${encodeURIComponent(dateKey)}` : '';
  return withBackendOrStatic(
    async () => fetchJsonWithRetry(`/api/states${q}`),
    () => localStoreAdapter.fetchStatesForDate(dateKey)
  );
}

export async function toggleSlot(
  machineKey: MachineKey,
  dateKey: string,
  slotId: string,
  checked: boolean
): Promise<{ ok: boolean; state: Record<string, boolean>; count: number; updatedAt: string }> {
  return withBackendOrStatic(
    async () =>
      parseJson(
        await fetch(apiUrl('/api/slot'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ machineKey, dateKey, slotId, checked }),
        })
      ),
    () => localStoreAdapter.toggleSlot(machineKey, dateKey, slotId, checked)
  );
}

export async function resetMachineDay(
  machineKey: MachineKey,
  dateKey: string,
  credential: { password?: string; token?: string | null } | string
): Promise<{ ok: boolean }> {
  return withBackendOrStatic(
    async () => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const body: Record<string, unknown> = { machineKey, dateKey };
      if (typeof credential === 'string') {
        body.password = credential;
      } else {
        if (credential.token) {
          headers.Authorization = `Bearer ${credential.token}`;
        }
        if (credential.password) {
          body.password = credential.password;
        }
      }
      return parseJson(
        await fetch(apiUrl('/api/reset'), {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        })
      );
    },
    () => localStoreAdapter.resetMachineDay(machineKey, dateKey, credential)
  );
}

export async function fetchAuthStatus(): Promise<AuthStatusResponse> {
  return withBackendOrStatic(
    async () => fetchJsonWithRetry('/api/auth/status'),
    () => localStoreAdapter.fetchAuthStatus()
  );
}

export async function setupAdminPassword(
  password: string
): Promise<{ ok: boolean; token?: string; message?: string }> {
  return withBackendOrStatic(
    async () =>
      parseJson(
        await fetch(apiUrl('/api/auth/setup'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        })
      ),
    () => localStoreAdapter.setupAdminPassword(password)
  );
}

export async function verifyAdminPassword(
  password: string
): Promise<{ ok: boolean; token?: string }> {
  return withBackendOrStatic(
    async () =>
      parseJson(
        await fetch(apiUrl('/api/auth/verify'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        })
      ),
    () => localStoreAdapter.verifyAdminPassword(password)
  );
}

export async function changeAdminPassword(
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean; token?: string; message?: string }> {
  return withBackendOrStatic(
    async () =>
      parseJson(
        await fetch(apiUrl('/api/auth/change-password'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword, newPassword }),
        })
      ),
    () => localStoreAdapter.changeAdminPassword(currentPassword, newPassword)
  );
}

export async function fetchScheduleSettings(): Promise<{
  ok: boolean;
  settings: ScheduleSettings;
  updatedAt: string | null;
}> {
  return withBackendOrStatic(
    async () => fetchJsonWithRetry('/api/settings'),
    () => localStoreAdapter.fetchScheduleSettings()
  );
}

export async function saveScheduleSettings(
  settings: ScheduleSettings,
  adminToken?: string | null
): Promise<{
  ok: boolean;
  settings: ScheduleSettings;
  updatedAt: string;
}> {
  return withBackendOrStatic(
    async () => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminToken) {
        headers.Authorization = `Bearer ${adminToken}`;
      }
      return parseJson(
        await fetch(apiUrl('/api/settings'), {
          method: 'POST',
          headers,
          body: JSON.stringify({ settings }),
        })
      );
    },
    () => localStoreAdapter.saveScheduleSettings(settings, adminToken)
  );
}
