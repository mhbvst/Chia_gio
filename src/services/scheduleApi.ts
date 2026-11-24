import { MachineKey } from '../data/schedules';
import { ScheduleSettings } from '../utils/scheduleGenerator';

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

export async function fetchToday(): Promise<{ today: string; timezone: string }> {
  const res = await fetch('/api/today', { cache: 'no-store' });
  return parseJson(res);
}

export async function fetchStatesForDate(dateKey?: string): Promise<StatesResponse> {
  const q = dateKey ? `?dateKey=${encodeURIComponent(dateKey)}` : '';
  const res = await fetch(`/api/states${q}`, { cache: 'no-store' });
  return parseJson(res);
}

export async function toggleSlot(
  machineKey: MachineKey,
  dateKey: string,
  slotId: string,
  checked: boolean
): Promise<{ ok: boolean; state: Record<string, boolean>; count: number; updatedAt: string }> {
  const res = await fetch('/api/slot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ machineKey, dateKey, slotId, checked }),
  });
  return parseJson(res);
}

export async function resetMachineDay(
  machineKey: MachineKey,
  dateKey: string,
  credential: { password?: string; token?: string | null } | string
): Promise<{ ok: boolean }> {
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
  const res = await fetch('/api/reset', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function fetchAuthStatus(): Promise<AuthStatusResponse> {
  const res = await fetch('/api/auth/status', { cache: 'no-store' });
  return parseJson(res);
}

export async function setupAdminPassword(
  password: string
): Promise<{ ok: boolean; token?: string; message?: string }> {
  const res = await fetch('/api/auth/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return parseJson(res);
}

export async function verifyAdminPassword(
  password: string
): Promise<{ ok: boolean; token?: string }> {
  const res = await fetch('/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return parseJson(res);
}

export async function changeAdminPassword(
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean; token?: string; message?: string }> {
  const res = await fetch('/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  return parseJson(res);
}

export async function fetchScheduleSettings(): Promise<{
  ok: boolean;
  settings: ScheduleSettings;
  updatedAt: string | null;
}> {
  const res = await fetch('/api/settings', { cache: 'no-store' });
  return parseJson(res);
}

export async function saveScheduleSettings(
  settings: ScheduleSettings,
  adminToken?: string | null
): Promise<{
  ok: boolean;
  settings: ScheduleSettings;
  updatedAt: string;
}> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (adminToken) {
    headers.Authorization = `Bearer ${adminToken}`;
  }
  const res = await fetch('/api/settings', {
    method: 'POST',
    headers,
    body: JSON.stringify({ settings }),
  });
  return parseJson(res);
}
