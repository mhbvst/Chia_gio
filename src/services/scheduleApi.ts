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

function isGithubPagesStaticHost(): boolean {
  if (typeof window === 'undefined') return false;
  return !RAW_API_BASE && window.location.hostname.endsWith('.github.io');
}

function apiUrl(path: string): string {
  return `${RAW_API_BASE}${path}`;
}

let useLocalFallback = isGithubPagesStaticHost();

async function parseJson<T>(res: Response): Promise<T & { ok?: boolean; message?: string; code?: string }> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as { message?: string }).message || `Lỗi máy chủ (${res.status})`) as Error & {
      status?: number;
      code?: string;
    };
    err.status = res.status;
    err.code = (data as { code?: string }).code;
    throw err;
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
    // If deployed to static hosting without /api backend (404/405 HTML or network error when no remote API base is set)
    const status = (err as { status?: number })?.status;
    const isMissingStaticApi =
      !RAW_API_BASE && (status === 404 || status === 405 || err instanceof SyntaxError);
    if (isMissingStaticApi) {
      useLocalFallback = true;
      return localFn();
    }
    throw err;
  }
}

export async function fetchToday(): Promise<{ today: string; timezone: string }> {
  return withBackendOrStatic(
    async () => parseJson(await fetch(apiUrl('/api/today'), { cache: 'no-store' })),
    () => localStoreAdapter.fetchToday()
  );
}

export async function fetchStatesForDate(dateKey?: string): Promise<StatesResponse> {
  const q = dateKey ? `?dateKey=${encodeURIComponent(dateKey)}` : '';
  return withBackendOrStatic(
    async () => parseJson(await fetch(apiUrl(`/api/states${q}`), { cache: 'no-store' })),
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
    async () => parseJson(await fetch(apiUrl('/api/auth/status'), { cache: 'no-store' })),
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
    async () => parseJson(await fetch(apiUrl('/api/settings'), { cache: 'no-store' })),
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
