import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Calendar,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Lock,
  Menu,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Printer,
  Settings,
  ShieldAlert,
  X,
} from 'lucide-react';
import radiologyBannerImg from './assets/images/xray_department_banner_1795454558629.jpg';
import {
  MACHINES,
  MachineKey,
  ScheduleRow,
} from './data/schedules';
import {
  changeAdminPassword,
  fetchAuthStatus,
  fetchScheduleSettings,
  fetchStatesForDate,
  fetchToday,
  resetMachineDay,
  saveScheduleSettings,
  setupAdminPassword,
  toggleSlot,
  verifyAdminPassword,
} from './services/scheduleApi';
import {
  applyThemeToDocument,
  THEME_LIST,
  ThemeId,
  THEMES,
} from './utils/themes';
import {
  compareDateWithToday,
  formatDateDisplayVN,
  getTodayKeyVN,
  nowSecondsVN,
  parseHHMM,
} from './utils/vnTime';
import {
  buildMachinesFromSettings,
  countCheckedSlotsInRows,
  countTotalSlots,
  DEFAULT_SCHEDULE_SETTINGS,
  MACHINE_KEY_RE,
  sanitizeScheduleSettings,
  ScheduleSettings,
} from './utils/scheduleGenerator';
import { ClockWidget } from './components/ClockWidget';
import {
  DEFAULT_TABLE_DISPLAY_SETTINGS,
  ScheduleTable,
  ScheduleTableHandle,
  TableDisplaySettings,
  TableFontWeight,
  TableRowSpacing,
} from './components/ScheduleTable';
import {
  AuthModal,
  ChangePasswordModal,
  PrintPdfModal,
  QuickPickConfirmModal,
  UncheckConfirmModal,
} from './components/Modals';
import { ScheduleSettingsModal } from './components/ScheduleSettingsModal';
import { ToastContainer, ToastItem } from './components/Toast';
import {
  MultitaskingClockPip,
  MultitaskingClockPipHandle,
} from './components/MultitaskingClockPip';
import { exportScheduleExcel } from './utils/excelExport';
import { exportSchedulePdf } from './utils/pdfExport';

const LOCK_STORAGE_KEY = 'xq_locked_machine';
const DENSITY_STORAGE_KEY = 'xq_density_mode';
const DISPLAY_SETTINGS_STORAGE_KEY = 'xq_display_settings_v1';
const MOBILE_SEG_STORAGE_KEY = 'xq_mobile_segment';
const SIDEBAR_STORAGE_KEY = 'xq_sidebar_collapsed';
const SETTINGS_STORAGE_KEY = 'xq_schedule_settings_v1';
const PICK_ORDER_STORAGE_KEY = 'xq_pick_order_v1';

function themeStorageKey(mk: MachineKey): string {
  return `xq_v2_theme__${mk}`;
}

function getInitials(name: string): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'NV';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function shiftDateKey(dateKey: string, deltaDays: number): string {
  const m = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateKey;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + deltaDays));
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

function normalizeDisplaySettings(
  raw: Partial<TableDisplaySettings> | null | undefined
): TableDisplaySettings {
  const rs: TableRowSpacing =
    raw?.rowSpacing === 'standard' || raw?.rowSpacing === 'spacious'
      ? raw.rowSpacing
      : 'compact';
  const fsNum = Number(raw?.fontSize);
  const fontSize = Number.isFinite(fsNum)
    ? Math.min(22, Math.max(12, Math.round(fsNum)))
    : DEFAULT_TABLE_DISPLAY_SETTINGS.fontSize;
  const fwNum = Number(raw?.fontWeight);
  const fontWeight: TableFontWeight =
    fwNum === 400 || fwNum === 500 || fwNum === 600 || fwNum === 700 || fwNum === 800
      ? fwNum
      : DEFAULT_TABLE_DISPLAY_SETTINGS.fontWeight;
  return { rowSpacing: rs, fontSize, fontWeight };
}

function readCookieValue(name: string): string | null {
  try {
    const prefix = `${encodeURIComponent(name)}=`;
    const parts = document.cookie ? document.cookie.split('; ') : [];
    for (const part of parts) {
      if (part.startsWith(prefix)) {
        return decodeURIComponent(part.slice(prefix.length));
      }
    }
  } catch {
    // Ignore cookie errors
  }
  return null;
}

function writeCookieValue(name: string, value: string): void {
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; max-age=31536000; path=/; SameSite=Lax${secure}`;
  } catch {
    // Ignore cookie errors
  }
}

function loadPersistedDisplaySettings(): TableDisplaySettings {
  const candidates: (string | null)[] = [];
  try {
    candidates.push(localStorage.getItem(DISPLAY_SETTINGS_STORAGE_KEY));
  } catch {
    // Ignore storage errors
  }
  candidates.push(readCookieValue(DISPLAY_SETTINGS_STORAGE_KEY));

  for (const raw of candidates) {
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as Partial<TableDisplaySettings>;
      if (parsed && typeof parsed === 'object') {
        return normalizeDisplaySettings(parsed);
      }
    } catch {
      // Ignore malformed JSON
    }
  }

  let legacyDensity: string | null = null;
  try {
    legacyDensity = localStorage.getItem(DENSITY_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
  if (!legacyDensity) legacyDensity = readCookieValue(DENSITY_STORAGE_KEY);
  const rowSpacing: TableRowSpacing =
    legacyDensity === 'standard' || legacyDensity === 'spacious' ? legacyDensity : 'compact';
  return {
    ...DEFAULT_TABLE_DISPLAY_SETTINGS,
    rowSpacing,
    fontSize: rowSpacing === 'standard' ? 15 : DEFAULT_TABLE_DISPLAY_SETTINGS.fontSize,
  };
}

function persistDisplaySettings(settings: TableDisplaySettings): void {
  const serialized = JSON.stringify(settings);
  try {
    localStorage.setItem(DISPLAY_SETTINGS_STORAGE_KEY, serialized);
    localStorage.setItem(DENSITY_STORAGE_KEY, settings.rowSpacing);
  } catch {
    // Ignore storage errors
  }
  writeCookieValue(DISPLAY_SETTINGS_STORAGE_KEY, serialized);
}

export default function App() {
  // ===== Device machine lock =====
  const [lockedMachine, setLockedMachine] = useState<MachineKey | null>(() => {
    const saved = localStorage.getItem(LOCK_STORAGE_KEY);
    return saved && MACHINE_KEY_RE.test(saved) ? saved : null;
  });

  const [activeMachine, setActiveMachine] = useState<MachineKey>(() => {
    const saved = localStorage.getItem(LOCK_STORAGE_KEY);
    return saved && MACHINE_KEY_RE.test(saved) ? saved : 'TITAN2000';
  });

  // ===== Sidebar state =====
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(
    () => localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1'
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // ===== Dates & server state =====
  const [todayKey, setTodayKey] = useState<string>(() => getTodayKeyVN());
  const [viewedDateKey, setViewedDateKey] = useState<string>(() => getTodayKeyVN());
  const [dateInput, setDateInput] = useState<string>(() => getTodayKeyVN());
  const [statesByMachine, setStatesByMachine] = useState<
    Record<MachineKey, Record<string, boolean>>
  >({});
  const [pickedOrderByCtx, setPickedOrderByCtx] = useState<Record<string, string[]>>(() => {
    try {
      const raw = localStorage.getItem(PICK_ORDER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const clean: Record<string, string[]> = {};
          for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
            if (Array.isArray(v)) {
              clean[k] = v.filter((x): x is string => typeof x === 'string').slice(-40);
            }
          }
          return clean;
        }
      }
    } catch {
      // Ignore storage errors
    }
    return {};
  });
  const lastStatesByDateRef = useRef<
    Record<string, Record<MachineKey, Record<string, boolean>>>
  >({});
  const [loadingStates, setLoadingStates] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingSlots, setPendingSlots] = useState<Record<string, boolean>>({});

  // ===== UI preferences =====
  const [displaySettings, setDisplaySettings] = useState<TableDisplaySettings>(
    loadPersistedDisplaySettings
  );
  const [mobileSegment, setMobileSegment] = useState<'morning' | 'afternoon'>(() =>
    localStorage.getItem(MOBILE_SEG_STORAGE_KEY) === 'afternoon' ? 'afternoon' : 'morning'
  );
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [machineThemes, setMachineThemes] = useState<Record<MachineKey, ThemeId>>(() => {
    const readTheme = (mk: MachineKey): ThemeId => {
      const saved = localStorage.getItem(themeStorageKey(mk)) as ThemeId | null;
      return saved && THEMES[saved] ? saved : 'light';
    };
    return {
      TITAN2000: readTheme('TITAN2000'),
      DR_GEM: readTheme('DR_GEM'),
    };
  });

  // ===== Real-time tick for NOW & last-pick status =====
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const [logoError, setLogoError] = useState(false);
  const [bannerError, setBannerError] = useState(false);

  // ===== Modals & Auth =====
  const [authConfigured, setAuthConfigured] = useState<boolean>(false);
  const [authSource, setAuthSource] = useState<'env' | 'server' | 'unconfigured'>('unconfigured');
  const [authModalMode, setAuthModalMode] = useState<'reset' | 'switch-machine' | 'open-settings' | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [settingsToken, setSettingsToken] = useState<string | null>(null);
  const [changePwdModalOpen, setChangePwdModalOpen] = useState(false);
  const [changePwdError, setChangePwdError] = useState<string | null>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [resettingMachineKey, setResettingMachineKey] = useState<MachineKey | null>(null);
  const [scheduleSettings, setScheduleSettings] = useState<ScheduleSettings>(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) {
        const parsed = sanitizeScheduleSettings(JSON.parse(raw));
        if (parsed) return parsed;
      }
    } catch {
      // Ignore storage errors
    }
    return DEFAULT_SCHEDULE_SETTINGS;
  });
  const [uncheckTarget, setUncheckTarget] = useState<{
    row: ScheduleRow;
    session: 'm' | 'a';
  } | null>(null);
  const [quickPickTarget, setQuickPickTarget] = useState<{
    row: ScheduleRow;
    session: 'm' | 'a';
    sessionLabel: string;
    startTime: string;
    endTime: string;
    relativeNote: string;
  } | null>(null);

  // ===== Toasts =====
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastIdRef = useRef(1);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const scheduleAreaRef = useRef<HTMLDivElement>(null);
  const scheduleTableRef = useRef<ScheduleTableHandle | null>(null);
  const pipClockRef = useRef<MultitaskingClockPipHandle | null>(null);
  const [floatingClockOpen, setFloatingClockOpen] = useState(false);

  const pushToast = useCallback((type: ToastItem['type'], message: string) => {
    const id = toastIdRef.current++;
    setToasts((prev) => [...prev.slice(-3), { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ===== Apply theme when activeMachine or machineThemes changes =====
  const activeThemeId = machineThemes[activeMachine] || 'light';
  useEffect(() => {
    applyThemeToDocument(activeThemeId);
  }, [activeThemeId]);

  // Close theme menu on outside click
  useEffect(() => {
    if (!themeMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setThemeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [themeMenuOpen]);

  // Real-time 1s timer for NOW marker & overdue status
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const syncInFlightRef = useRef(false);
  const silentFailStreakRef = useRef(0);

  // ===== Load states from backend =====
  const loadDateStates = useCallback(async (dk: string, silent = false) => {
    if (silent && syncInFlightRef.current) {
      return;
    }
    syncInFlightRef.current = true;
    if (!silent) {
      setLoadingStates(true);
      setLoadError(null);
    }
    try {
      const data = await fetchStatesForDate(dk);
      silentFailStreakRef.current = 0;
      if (typeof data?.today === 'string' && data.today) {
        setTodayKey(data.today);
      }
      if (typeof data?.dateKey === 'string' && data.dateKey) {
        setViewedDateKey(data.dateKey);
        setDateInput(data.dateKey);
      }
      const nextStates: Record<string, Record<string, boolean>> = {};
      if (data.machines && typeof data.machines === 'object') {
        for (const mk of Object.keys(data.machines)) {
          nextStates[mk] = data.machines[mk]?.state || {};
        }
      }
      const resolvedDk = typeof data?.dateKey === 'string' && data.dateKey ? data.dateKey : dk;
      const prevForDate = resolvedDk ? lastStatesByDateRef.current[resolvedDk] : undefined;
      if (resolvedDk) {
        lastStatesByDateRef.current[resolvedDk] = nextStates;
        setPickedOrderByCtx((prevHist) => {
          let changed = false;
          const nextHist = { ...prevHist };
          for (const mk of Object.keys(nextStates)) {
            const ctxKey = `${resolvedDk}__${mk}`;
            const curState = nextStates[mk] || {};
            const existingOrder = prevHist[ctxKey] || [];
            let updatedOrder = existingOrder.filter((sk) => Boolean(curState[sk]));
            if (updatedOrder.length !== existingOrder.length) changed = true;
            if (prevForDate) {
              const oldState = prevForDate[mk] || {};
              for (const sk of Object.keys(curState)) {
                if (curState[sk] && !oldState[sk] && updatedOrder[updatedOrder.length - 1] !== sk) {
                  updatedOrder = [...updatedOrder.filter((x) => x !== sk), sk];
                  changed = true;
                }
              }
            }
            if (updatedOrder.length > 0) {
              nextHist[ctxKey] = updatedOrder.slice(-40);
            } else if (nextHist[ctxKey]) {
              delete nextHist[ctxKey];
              changed = true;
            }
          }
          if (!changed) return prevHist;
          try {
            localStorage.setItem(PICK_ORDER_STORAGE_KEY, JSON.stringify(nextHist));
          } catch {
            // Ignore storage errors
          }
          return nextHist;
        });
      }
      setStatesByMachine(nextStates);
      if (data.settings) {
        const clean = sanitizeScheduleSettings(data.settings);
        if (clean) {
          setScheduleSettings(clean);
          try {
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(clean));
          } catch {
            // Ignore storage errors
          }
        }
      }
      setLoadError(null);
    } catch (err) {
      if (silent) {
        silentFailStreakRef.current = Math.min(silentFailStreakRef.current + 1, 3);
      } else {
        const msg =
          err instanceof Error ? err.message : 'Không thể kết nối máy chủ để tải dữ liệu lịch.';
        setLoadError(msg);
      }
    } finally {
      syncInFlightRef.current = false;
      if (!silent) setLoadingStates(false);
    }
  }, []);

  // Initial load: get server today (Asia/Ho_Chi_Minh), states, auth status, and settings
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [todayRes, auth, settingsRes] = await Promise.all([
          fetchToday(),
          fetchAuthStatus(),
          fetchScheduleSettings().catch(() => null),
        ]);
        if (!mounted) return;
        const resolvedToday =
          typeof todayRes?.today === 'string' && todayRes.today ? todayRes.today : getTodayKeyVN();
        setTodayKey(resolvedToday);
        setViewedDateKey(resolvedToday);
        setDateInput(resolvedToday);
        setAuthConfigured(Boolean(auth?.configured));
        setAuthSource(auth?.source || 'unconfigured');
        if (settingsRes?.settings) {
          const clean = sanitizeScheduleSettings(settingsRes.settings);
          if (clean) {
            setScheduleSettings(clean);
            try {
              localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(clean));
            } catch {
              // Ignore
            }
          }
        }
        await loadDateStates(resolvedToday, false);
      } catch (err) {
        if (!mounted) return;
        setLoadingStates(false);
        setLoadError(
          err instanceof Error
            ? err.message
            : 'Không thể kết nối máy chủ. Vui lòng thử tải lại.'
        );
      }
    })();
    return () => {
      mounted = false;
    };
  }, [loadDateStates]);

  // Periodic background sync (15-19s jittered + exponential backoff on error + focus sync)
  useEffect(() => {
    let timerId: number | null = null;
    let cancelled = false;

    const scheduleNext = () => {
      if (cancelled) return;
      const streak = silentFailStreakRef.current;
      const baseMs = streak === 0 ? 15_000 : Math.min(60_000, 15_000 * Math.pow(2, streak));
      const jitterMs = Math.floor(Math.random() * 4_000);
      timerId = window.setTimeout(async () => {
        if (cancelled) return;
        if (document.visibilityState === 'visible') {
          await loadDateStates(viewedDateKey, true);
        }
        scheduleNext();
      }, baseMs + jitterMs);
    };

    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        void loadDateStates(viewedDateKey, true);
      }
    };

    scheduleNext();
    window.addEventListener('focus', handleFocus);
    return () => {
      cancelled = true;
      if (timerId !== null) window.clearTimeout(timerId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [viewedDateKey, loadDateStates]);

  // ===== Derived date & session stats =====
  const dateRelation = compareDateWithToday(viewedDateKey, todayKey);
  const isToday = dateRelation === 'today';
  const isReadOnly = !isToday;

  const { machines: dynamicMachines, machineMap: dynamicMachineMap } = useMemo(
    () => buildMachinesFromSettings(MACHINES, scheduleSettings),
    [scheduleSettings]
  );

  useEffect(() => {
    if (dynamicMachines.length === 0) return;
    if (!dynamicMachineMap[activeMachine]) {
      const fallback =
        lockedMachine && dynamicMachineMap[lockedMachine]
          ? lockedMachine
          : dynamicMachines[0].key;
      setActiveMachine(fallback);
    }
    if (lockedMachine && !dynamicMachineMap[lockedMachine]) {
      localStorage.removeItem(LOCK_STORAGE_KEY);
      setLockedMachine(null);
    }
  }, [dynamicMachines, dynamicMachineMap, activeMachine, lockedMachine]);

  const activeMachineConfig = dynamicMachineMap[activeMachine] || dynamicMachines[0];
  const activeSlots = statesByMachine[activeMachineConfig.key] || {};

  const checkedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of dynamicMachines) {
      counts[m.key] = countCheckedSlotsInRows(
        m.rows,
        statesByMachine[m.key] || {}
      ).totalChecked;
    }
    return counts;
  }, [dynamicMachines, statesByMachine]);

  const totalSlotsByMachine = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const m of dynamicMachines) {
      totals[m.key] = countTotalSlots(m.rows);
    }
    return totals;
  }, [dynamicMachines]);

  // Start time of the most recently selected slot (ca chụp đã chọn sau cùng)
  const lastPickedStart = useMemo(() => {
    const ctxKey = `${viewedDateKey}__${activeMachineConfig.key}`;
    const order = pickedOrderByCtx[ctxKey] || [];
    const rowByStt = new Map<number, ScheduleRow>();
    for (const row of activeMachineConfig.rows) {
      rowByStt.set(row.stt, row);
    }

    for (let i = order.length - 1; i >= 0; i--) {
      const sk = order[i];
      if (!activeSlots[sk]) continue;
      const m = sk.match(/^(m|a):(\d+)$/);
      if (!m) continue;
      const row = rowByStt.get(Number(m[2]));
      if (!row) continue;
      const startTime = m[1] === 'm' ? row.morningStart : row.afternoonStart;
      if (startTime) return startTime;
    }

    // Fallback when opening a day with pre-existing picks from server/other devices
    let best: string | null = null;
    let bestMin = -1;
    for (const row of activeMachineConfig.rows) {
      if (activeSlots[`m:${row.stt}`]) {
        const m = parseHHMM(row.morningStart);
        if (m !== null && m > bestMin) {
          bestMin = m;
          best = row.morningStart;
        }
      }
      if (activeSlots[`a:${row.stt}`]) {
        const a = parseHHMM(row.afternoonStart);
        if (a !== null && a > bestMin) {
          bestMin = a;
          best = row.afternoonStart;
        }
      }
    }
    return best;
  }, [activeMachineConfig.key, activeMachineConfig.rows, activeSlots, pickedOrderByCtx, viewedDateKey]);

  const lastPickStatus = useMemo(() => {
    if (!lastPickedStart) return { label: 'Chưa có ca chọn', tone: 'empty' as const };
    if (!isToday) return { label: `Ngày ${formatDateDisplayVN(viewedDateKey)}`, tone: 'neutral' as const };
    void nowTick;
    const tMin = parseHHMM(lastPickedStart);
    if (tMin === null) return { label: '', tone: 'neutral' as const };
    const deltaSec = tMin * 60 - nowSecondsVN();
    if (deltaSec > 3) return { label: 'Lớn hơn giờ thực tế > 3 giây', tone: 'upcoming' as const };
    if (deltaSec >= 0) return { label: 'Trong khoảng 3 giây đến bằng giờ thực tế', tone: 'past' as const };
    return { label: 'Nhỏ hơn giờ thực tế', tone: 'overdue' as const };
  }, [lastPickedStart, isToday, viewedDateKey, nowTick]);

  // ===== Handlers =====
  const toggleSidebarCollapse = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? '1' : '0');
      return next;
    });
  };

  const handleSelectMachineTab = (mk: MachineKey) => {
    if (lockedMachine && lockedMachine !== mk) {
      const lockedName = dynamicMachineMap[lockedMachine]?.name || lockedMachine;
      pushToast(
        'info',
        `Thiết bị đang khóa cố định vào máy ${lockedName}. Vào "Cài đặt" nếu cần đổi máy.`
      );
      return;
    }
    setActiveMachine(mk);
    setMobileSidebarOpen(false);
  };

  const handleLockFirstTime = (mk: MachineKey) => {
    localStorage.setItem(LOCK_STORAGE_KEY, mk);
    setLockedMachine(mk);
    setActiveMachine(mk);
    const name = dynamicMachineMap[mk]?.name || mk;
    pushToast('success', `Đã khóa thiết bị này theo máy ${name}.`);
  };

  const commitSlotToggle = async (row: ScheduleRow, session: 'm' | 'a', checked: boolean) => {
    if (isReadOnly) {
      pushToast('error', 'Đang xem ngày khác (chỉ xem), không thể chỉnh sửa.');
      return;
    }
    const slotKey = `${session}:${row.stt}`;
    const mk = activeMachine;
    const dk = viewedDateKey;
    const ctxKey = `${dk}__${mk}`;

    const updatePickOrder = (isChecked: boolean) => {
      setPickedOrderByCtx((prevHist) => {
        const list = (prevHist[ctxKey] || []).filter((k) => k !== slotKey);
        const updated = isChecked ? [...list, slotKey].slice(-40) : list;
        const nextHist = { ...prevHist };
        if (updated.length > 0) nextHist[ctxKey] = updated;
        else delete nextHist[ctxKey];
        try {
          localStorage.setItem(PICK_ORDER_STORAGE_KEY, JSON.stringify(nextHist));
        } catch {
          // Ignore storage errors
        }
        return nextHist;
      });
    };

    setPendingSlots((p) => ({ ...p, [slotKey]: true }));
    setStatesByMachine((prev) => {
      const nextMachineState = { ...(prev[mk] || {}) };
      if (checked) nextMachineState[slotKey] = true;
      else delete nextMachineState[slotKey];
      const nextAll = { ...prev, [mk]: nextMachineState };
      lastStatesByDateRef.current[dk] = nextAll;
      return nextAll;
    });
    updatePickOrder(checked);

    try {
      const res = await toggleSlot(mk, dk, slotKey, checked);
      setStatesByMachine((prev) => {
        const nextAll = { ...prev, [mk]: res.state };
        lastStatesByDateRef.current[dk] = nextAll;
        return nextAll;
      });
    } catch (err) {
      setStatesByMachine((prev) => {
        const reverted = { ...(prev[mk] || {}) };
        if (checked) delete reverted[slotKey];
        else reverted[slotKey] = true;
        const nextAll = { ...prev, [mk]: reverted };
        lastStatesByDateRef.current[dk] = nextAll;
        return nextAll;
      });
      updatePickOrder(!checked);
      pushToast(
        'error',
        err instanceof Error ? err.message : 'Lỗi lưu dữ liệu lên máy chủ. Đã khôi phục trạng thái.'
      );
    } finally {
      setPendingSlots((p) => {
        const next = { ...p };
        delete next[slotKey];
        return next;
      });
    }
  };

  const handleSlotClick = (row: ScheduleRow, session: 'm' | 'a', nextChecked: boolean) => {
    if (isReadOnly) return;
    if (!nextChecked) {
      setUncheckTarget({ row, session });
      return;
    }
    void commitSlotToggle(row, session, true);
  };

  const handleRequestQuickPick = useCallback(() => {
    if (!isToday || isReadOnly) {
      pushToast('info', 'Phím tắt [T] chỉ hỗ trợ chọn nhanh khi đang xem lịch ngày hôm nay.');
      return;
    }
    if (loadingStates) return;

    const nowSec = nowSecondsVN();
    let best: {
      row: ScheduleRow;
      session: 'm' | 'a';
      startTime: string;
      endTime: string;
      diffSec: number;
      absDiff: number;
    } | null = null;

    for (const row of activeMachineConfig.rows) {
      if (row.morningStart) {
        const key = `m:${row.stt}`;
        if (!activeSlots[key] && !pendingSlots[key]) {
          const min = parseHHMM(row.morningStart);
          if (min !== null) {
            const diffSec = min * 60 - nowSec;
            const absDiff = Math.abs(diffSec);
            if (
              !best ||
              absDiff < best.absDiff ||
              (absDiff === best.absDiff && diffSec >= 0 && best.diffSec < 0)
            ) {
              best = {
                row,
                session: 'm',
                startTime: row.morningStart,
                endTime: row.morningEnd,
                diffSec,
                absDiff,
              };
            }
          }
        }
      }
      if (row.afternoonStart) {
        const key = `a:${row.stt}`;
        if (!activeSlots[key] && !pendingSlots[key]) {
          const min = parseHHMM(row.afternoonStart);
          if (min !== null) {
            const diffSec = min * 60 - nowSec;
            const absDiff = Math.abs(diffSec);
            if (
              !best ||
              absDiff < best.absDiff ||
              (absDiff === best.absDiff && diffSec >= 0 && best.diffSec < 0)
            ) {
              best = {
                row,
                session: 'a',
                startTime: row.afternoonStart,
                endTime: row.afternoonEnd,
                diffSec,
                absDiff,
              };
            }
          }
        }
      }
    }

    if (!best) {
      pushToast(
        'info',
        `Tất cả khung giờ hôm nay của máy ${activeMachineConfig.name} đều đã được chọn.`
      );
      return;
    }

    let relativeNote = 'Trùng thời gian hiện tại';
    if (best.diffSec > 60) {
      relativeNote = `Còn khoảng ${Math.round(best.diffSec / 60)} phút nữa so với hiện tại`;
    } else if (best.diffSec > 0) {
      relativeNote = `Còn ${best.diffSec} giây nữa so với hiện tại`;
    } else if (best.diffSec < -60) {
      relativeNote = `Đã qua khoảng ${Math.round(Math.abs(best.diffSec) / 60)} phút so với hiện tại`;
    } else if (best.diffSec < 0) {
      relativeNote = `Đã qua ${Math.abs(best.diffSec)} giây so với hiện tại`;
    }

    setQuickPickTarget({
      row: best.row,
      session: best.session,
      sessionLabel: best.session === 'm' ? 'Ca Sáng' : 'Ca Chiều',
      startTime: best.startTime,
      endTime: best.endTime,
      relativeNote,
    });
  }, [
    isToday,
    isReadOnly,
    loadingStates,
    activeMachineConfig.rows,
    activeMachineConfig.name,
    activeSlots,
    pendingSlots,
    pushToast,
  ]);

  const shortcutHandlersRef = useRef({
    onJumpNow: () => {
      if (!isToday) {
        pushToast('info', 'Phím tắt [G] chỉ hỗ trợ cuộn tới ca hiện tại khi xem ngày hôm nay.');
        return;
      }
      if (!loadingStates) scheduleTableRef.current?.jumpToNow();
    },
    onQuickPick: handleRequestQuickPick,
    onToggleFloating: () => pipClockRef.current?.toggle(),
  });
  shortcutHandlersRef.current = {
    onJumpNow: () => {
      if (!isToday) {
        pushToast('info', 'Phím tắt [G] chỉ hỗ trợ cuộn tới ca hiện tại khi xem ngày hôm nay.');
        return;
      }
      if (!loadingStates) scheduleTableRef.current?.jumpToNow();
    },
    onQuickPick: handleRequestQuickPick,
    onToggleFloating: () => pipClockRef.current?.toggle(),
  };

  const hasOpenModal =
    authModalMode !== null ||
    changePwdModalOpen ||
    printModalOpen ||
    settingsModalOpen ||
    uncheckTarget !== null ||
    quickPickTarget !== null;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (hasOpenModal) return;

      const active = document.activeElement as HTMLElement | null;
      if (active) {
        if (active.isContentEditable) return;
        const tag = active.tagName;
        if (tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (tag === 'INPUT') {
          const inpType = (active as HTMLInputElement).type;
          if (inpType !== 'checkbox' && inpType !== 'radio' && inpType !== 'button') {
            return;
          }
        }
      }

      const key = e.key.toLowerCase();
      if (key === 'g') {
        e.preventDefault();
        shortcutHandlersRef.current.onJumpNow();
      } else if (key === 't') {
        e.preventDefault();
        shortcutHandlersRef.current.onQuickPick();
      } else if (key === 'h') {
        e.preventDefault();
        shortcutHandlersRef.current.onToggleFloating();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hasOpenModal]);

  const handleViewToday = () => {
    const targetToday = todayKey || getTodayKeyVN();
    setDateInput(targetToday);
    void loadDateStates(targetToday, false);
    setMobileSidebarOpen(false);
    scheduleAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const handleViewSelectedDate = (dk?: string) => {
    const target = dk || dateInput;
    if (!target) return;
    void loadDateStates(target, false);
  };

  useEffect(() => {
    persistDisplaySettings(displaySettings);
  }, [displaySettings]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== DISPLAY_SETTINGS_STORAGE_KEY || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue) as Partial<TableDisplaySettings>;
        if (parsed && typeof parsed === 'object') {
          setDisplaySettings(normalizeDisplaySettings(parsed));
        }
      } catch {
        // Ignore malformed cross-tab value
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const handleChangeDisplaySettings = useCallback(
    (nextOrUpdater: React.SetStateAction<TableDisplaySettings>) => {
      setDisplaySettings((prev) => {
        const rawNext =
          typeof nextOrUpdater === 'function' ? nextOrUpdater(prev) : nextOrUpdater;
        const normalized = normalizeDisplaySettings(rawNext);
        persistDisplaySettings(normalized);
        return normalized;
      });
    },
    []
  );

  const handleStepDate = (deltaDays: number) => {
    const base = dateInput || viewedDateKey || todayKey || getTodayKeyVN();
    const target = shiftDateKey(base, deltaDays);
    if (!target) return;
    setDateInput(target);
    void loadDateStates(target, false);
  };

  const handleMobileSegment = (seg: 'morning' | 'afternoon') => {
    setMobileSegment(seg);
    localStorage.setItem(MOBILE_SEG_STORAGE_KEY, seg);
  };

  const handleSelectTheme = (themeId: ThemeId) => {
    localStorage.setItem(themeStorageKey(activeMachine), themeId);
    setMachineThemes((prev) => ({ ...prev, [activeMachine]: themeId }));
    setThemeMenuOpen(false);
  };

  const handleExportExcel = (visibleRows: ScheduleRow[]) => {
    try {
      const { fileName, rowCount } = exportScheduleExcel(
        activeMachineConfig,
        activeSlots,
        viewedDateKey,
        visibleRows
      );
      pushToast(
        'success',
        `Đã xuất file Excel (${fileName}) gồm ${rowCount} khung giờ.`
      );
    } catch (err) {
      pushToast(
        'error',
        err instanceof Error ? err.message : 'Không thể xuất file Excel. Vui lòng thử lại.'
      );
    }
  };

  // ===== Auth modal flows (Password-protected Settings) =====
  const openAuthModal = async (mode: 'reset' | 'switch-machine' | 'open-settings') => {
    setAuthError(null);
    setMobileSidebarOpen(false);
    try {
      const st = await fetchAuthStatus();
      setAuthConfigured(st.configured);
      setAuthSource(st.source);
    } catch {
      // Keep current known status
    }
    setAuthModalMode(mode);
  };

  const executeAuthAction = async (password: string, presetToken?: string) => {
    if (!authModalMode) return;
    setAuthSubmitting(true);
    setAuthError(null);
    try {
      if (authModalMode === 'open-settings') {
        let token = presetToken;
        if (!token) {
          const res = await verifyAdminPassword(password);
          token = res.token;
        }
        setSettingsToken(token || null);
        setAuthModalMode(null);
        setSettingsModalOpen(true);
      } else if (authModalMode === 'reset') {
        await resetMachineDay(activeMachineConfig.key, viewedDateKey, {
          password,
          token: presetToken,
        });
        setStatesByMachine((prev) => {
          const nextAll = { ...prev, [activeMachineConfig.key]: {} };
          lastStatesByDateRef.current[viewedDateKey] = nextAll;
          return nextAll;
        });
        setPickedOrderByCtx((prevHist) => {
          const nextHist = { ...prevHist };
          delete nextHist[`${viewedDateKey}__${activeMachineConfig.key}`];
          try {
            localStorage.setItem(PICK_ORDER_STORAGE_KEY, JSON.stringify(nextHist));
          } catch {
            // Ignore
          }
          return nextHist;
        });
        setAuthModalMode(null);
        pushToast(
          'success',
          `Đã reset lịch máy ${activeMachineConfig.name} ngày ${formatDateDisplayVN(viewedDateKey)}.`
        );
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Xác thực thất bại.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleSetupAndContinue = async (newPassword: string) => {
    setAuthSubmitting(true);
    setAuthError(null);
    try {
      const res = await setupAdminPassword(newPassword);
      setAuthConfigured(true);
      setAuthSource('server');
      pushToast('success', 'Đã lưu mật khẩu quản trị trên máy chủ.');
      await executeAuthAction(newPassword, res.token);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Không thể thiết lập mật khẩu.');
      setAuthSubmitting(false);
    }
  };

  const handleLockMachineFromSettings = (mk: MachineKey | null) => {
    if (!mk) {
      localStorage.removeItem(LOCK_STORAGE_KEY);
      setLockedMachine(null);
      pushToast('info', 'Đã mở khóa máy trạm (chế độ tự do).');
      return;
    }
    localStorage.setItem(LOCK_STORAGE_KEY, mk);
    setLockedMachine(mk);
    setActiveMachine(mk);
    const name = dynamicMachineMap[mk]?.name || mk;
    pushToast('success', `Đã chuyển khóa thiết bị sang máy ${name}.`);
  };

  const handleResetMachineFromSettings = async (mk: MachineKey) => {
    if (!settingsToken) {
      pushToast('error', 'Phiên xác thực đã hết hạn. Vui lòng mở lại Cài đặt.');
      setSettingsModalOpen(false);
      return;
    }
    setResettingMachineKey(mk);
    try {
      await resetMachineDay(mk, viewedDateKey, { token: settingsToken });
      setStatesByMachine((prev) => {
        const nextAll = { ...prev, [mk]: {} };
        lastStatesByDateRef.current[viewedDateKey] = nextAll;
        return nextAll;
      });
      setPickedOrderByCtx((prevHist) => {
        const nextHist = { ...prevHist };
        delete nextHist[`${viewedDateKey}__${mk}`];
        try {
          localStorage.setItem(PICK_ORDER_STORAGE_KEY, JSON.stringify(nextHist));
        } catch {
          // Ignore
        }
        return nextHist;
      });
      const name = dynamicMachineMap[mk]?.name || mk;
      pushToast(
        'success',
        `Đã reset lịch máy ${name} ngày ${formatDateDisplayVN(viewedDateKey)}.`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể reset dữ liệu ngày.';
      pushToast('error', msg);
      if ((err as { status?: number })?.status === 401) {
        setSettingsModalOpen(false);
        setSettingsToken(null);
      }
    } finally {
      setResettingMachineKey(null);
    }
  };

  const handleChangePassword = async (cur: string, next: string) => {
    setAuthSubmitting(true);
    setChangePwdError(null);
    try {
      const res = await changeAdminPassword(cur, next);
      if (res.token) {
        setSettingsToken(res.token);
      }
      setChangePwdModalOpen(false);
      pushToast('success', 'Đã cập nhật mật khẩu quản trị mới.');
    } catch (err) {
      setChangePwdError(err instanceof Error ? err.message : 'Không thể đổi mật khẩu.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleOpenPrintPdf = () => {
    setMobileSidebarOpen(false);
    setPrintModalOpen(true);
  };

  const handleDownloadPdf = () => {
    setExportingPdf(true);
    try {
      const { fileName, pageCount } = exportSchedulePdf(
        activeMachineConfig,
        activeSlots,
        viewedDateKey
      );
      setPrintModalOpen(false);
      pushToast('success', `Đã xuất ${pageCount} trang PDF A4 (${fileName}).`);
    } catch (err) {
      pushToast(
        'error',
        err instanceof Error ? err.message : 'Không thể tạo file PDF. Vui lòng thử lại.'
      );
    } finally {
      setExportingPdf(false);
    }
  };

  const handleDirectPrint = () => {
    setPrintModalOpen(false);
    window.setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleOpenSettings = () => {
    void openAuthModal('open-settings');
  };

  const handleCloseSettings = () => {
    setSettingsModalOpen(false);
    setSettingsToken(null);
  };

  const handleSaveScheduleSettings = async (nextSettings: ScheduleSettings) => {
    setSavingSettings(true);
    try {
      const res = await saveScheduleSettings(nextSettings, settingsToken);
      const saved = sanitizeScheduleSettings(res.settings) || nextSettings;
      setScheduleSettings(saved);
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(saved));
      } catch {
        // Ignore storage errors
      }
      setSettingsModalOpen(false);
      setSettingsToken(null);
      const firstName =
        saved.machines.find((m) => m.key === saved.firstMachine)?.name || saved.firstMachine;
      pushToast(
        'success',
        `Đã lưu cài đặt hệ thống (${firstName} bắt đầu trước từ ${saved.morningStart}).`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể lưu cài đặt lịch chụp.';
      pushToast('error', msg);
      if ((err as { status?: number })?.status === 401) {
        setSettingsModalOpen(false);
        setSettingsToken(null);
      }
    } finally {
      setSavingSettings(false);
    }
  };

  // Sidebar content reused for desktop rail & mobile drawer
  const renderSidebarContent = (isMobileDrawer: boolean) => {
    const compact = !isMobileDrawer && sidebarCollapsed;
    return (
      <div className="flex flex-col h-full bg-white dark:bg-slate-900 text-[#0F172A] dark:text-slate-100">
        {/* Brand Header */}
        <div
          className={`flex items-center ${
            compact ? 'justify-center px-2' : 'justify-between px-4'
          } h-16 border-b border-[#C7D6E8] dark:border-slate-800 shrink-0`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {!logoError ? (
              <img
                src={`${import.meta.env.BASE_URL}hospital-logo.png`}
                alt="Logo Bệnh viện"
                referrerPolicy="no-referrer"
                onError={() => setLogoError(true)}
                className="w-9 h-9 rounded-lg object-contain bg-white border border-[#C7D6E8] dark:border-slate-700 p-0.5 shrink-0"
              />
            ) : (
              <div
                className="w-9 h-9 rounded-lg bg-[#0D4EA6] flex items-center justify-center text-white font-display font-extrabold text-base shrink-0"
                aria-hidden="true"
              >
                H+
              </div>
            )}
            {!compact && (
              <div className="min-w-0">
                <div className="text-sm font-extrabold tracking-tight text-[#083578] dark:text-sky-300 truncate">
                  Hospital Pro
                </div>
                <div className="text-[11px] font-semibold text-[#334155] dark:text-slate-400 truncate">
                  Chẩn đoán Hình ảnh
                </div>
              </div>
            )}
          </div>

          {!isMobileDrawer ? (
            <button
              type="button"
              onClick={toggleSidebarCollapse}
              title={compact ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
              aria-label={compact ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
              className="hidden lg:inline-flex p-1.5 rounded-lg text-[#334155] hover:text-[#083578] hover:bg-[#DCEBFF] dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {compact ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              aria-label="Đóng menu điều hướng"
              className="p-1.5 rounded-lg text-[#334155] hover:text-[#083578] hover:bg-[#DCEBFF] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Groups */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* Group 1: Machines */}
          <div>
            {!compact && (
              <div className="px-2.5 mb-2 text-[11px] font-bold tracking-wider text-[#334155] dark:text-slate-400 uppercase">
                Máy chụp X-quang
              </div>
            )}
            <div className="space-y-1.5" role="tablist" aria-label="Danh sách máy X-quang">
              {dynamicMachines.map((m) => {
                const isActive = activeMachine === m.key;
                const isTabLocked = lockedMachine !== null && lockedMachine !== m.key;
                const count = checkedCounts[m.key];
                const totalCap = totalSlotsByMachine[m.key];

                return (
                  <button
                    key={m.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-disabled={isTabLocked}
                    disabled={isTabLocked}
                    title={`${m.name} (${count}/${totalCap})`}
                    onClick={() => handleSelectMachineTab(m.key)}
                    className={`w-full flex items-center ${
                      compact ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2.5'
                    } rounded-lg text-sm font-bold transition-colors ${
                      isTabLocked
                        ? 'opacity-45 cursor-not-allowed text-[#475569] bg-[#EEF4FB] dark:bg-slate-800/40'
                        : isActive
                        ? 'bg-[#DCEBFF] dark:bg-sky-950/60 text-[#083578] dark:text-sky-200 border border-[#93BCEB] dark:border-sky-800 cursor-pointer'
                        : 'text-[#0F172A] dark:text-slate-300 hover:bg-[#EEF4FB] dark:hover:bg-slate-800 cursor-pointer'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Activity
                        className={`w-4 h-4 shrink-0 ${
                          isActive
                            ? 'text-[#0D4EA6] dark:text-sky-400'
                            : 'text-[#334155] dark:text-slate-400'
                        }`}
                      />
                      {!compact && <span className="truncate">{m.name}</span>}
                    </span>
                    {!compact && (
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs tabular-nums shrink-0">
                        {isTabLocked && <Lock className="w-3 h-3 text-[#475569]" />}
                        <span
                          className={
                            isActive
                              ? 'text-[#083578] dark:text-sky-300 font-extrabold'
                              : 'text-[#334155] dark:text-slate-400 font-semibold'
                          }
                        >
                          {count}/{totalCap}
                        </span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Group 2: Operations & View */}
          <div>
            {!compact && (
              <div className="px-2.5 mb-2 text-[11px] font-bold tracking-wider text-[#334155] dark:text-slate-400 uppercase">
                Tác vụ lịch chụp
              </div>
            )}
            <div className="space-y-1">
              <button
                type="button"
                onClick={handleViewToday}
                title="Xem lịch hôm nay"
                className={`w-full flex items-center ${
                  compact ? 'justify-center px-2' : 'gap-2.5 px-3'
                } py-2 rounded-lg text-sm font-semibold text-[#0F172A] dark:text-slate-300 hover:bg-[#EEF4FB] dark:hover:bg-slate-800 transition-colors cursor-pointer`}
              >
                <CalendarCheck className="w-4 h-4 text-[#0D4EA6] dark:text-sky-400 shrink-0" />
                {!compact && <span className="truncate">Lịch chụp hôm nay</span>}
              </button>

              <button
                type="button"
                onClick={handleOpenPrintPdf}
                title="In lịch A4 / Xuất PDF"
                className={`w-full flex items-center ${
                  compact ? 'justify-center px-2' : 'gap-2.5 px-3'
                } py-2 rounded-lg text-sm font-semibold text-[#0F172A] dark:text-slate-300 hover:bg-[#EEF4FB] dark:hover:bg-slate-800 transition-colors cursor-pointer`}
              >
                <Printer className="w-4 h-4 text-[#0D4EA6] dark:text-sky-400 shrink-0" />
                {!compact && <span className="truncate">In lịch A4 / PDF</span>}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMobileSidebarOpen(false);
                  handleExportExcel(activeMachineConfig.rows);
                }}
                title="Xuất file Excel (.xlsx)"
                className={`w-full flex items-center ${
                  compact ? 'justify-center px-2' : 'gap-2.5 px-3'
                } py-2 rounded-lg text-sm font-semibold text-[#0F172A] dark:text-slate-300 hover:bg-[#EEF4FB] dark:hover:bg-slate-800 transition-colors cursor-pointer`}
              >
                <FileSpreadsheet className="w-4 h-4 text-[#0D4EA6] dark:text-sky-400 shrink-0" />
                {!compact && <span className="truncate">Xuất file Excel</span>}
              </button>

              <button
                type="button"
                onClick={handleOpenSettings}
                title="Cài đặt hệ thống (yêu cầu mật khẩu): đổi máy, reset, quản lý máy & giờ chụp"
                className={`w-full flex items-center ${
                  compact ? 'justify-center px-2' : 'gap-2.5 px-3'
                } py-2 rounded-lg text-sm font-semibold text-[#0F172A] dark:text-slate-300 hover:bg-[#EEF4FB] dark:hover:bg-slate-800 transition-colors cursor-pointer`}
              >
                <Settings className="w-4 h-4 text-[#0D4EA6] dark:text-sky-400 shrink-0" />
                {!compact && <span className="truncate">Cài đặt hệ thống</span>}
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Workstation Footer */}
        <div className="px-3 py-3 border-t border-[#C7D6E8] dark:border-slate-800 bg-[#EEF4FB]/80 dark:bg-slate-900/80">
          {compact ? (
            <div
              className="flex justify-center"
              title={
                lockedMachine
                  ? `Đang khóa máy ${dynamicMachineMap[lockedMachine]?.name || lockedMachine}`
                  : 'Chưa khóa máy trạm'
              }
            >
              <Lock
                className={`w-4 h-4 ${
                  lockedMachine ? 'text-[#0D4EA6]' : 'text-[#475569]'
                }`}
              />
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-1">
              <Lock
                className={`w-4 h-4 shrink-0 ${
                  lockedMachine ? 'text-[#0D4EA6]' : 'text-[#475569]'
                }`}
              />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-[#334155] dark:text-slate-400">
                  Trạng thái thiết bị
                </div>
                <div className="text-xs font-bold text-[#0F172A] dark:text-slate-200 truncate">
                  {lockedMachine
                    ? `Đã khóa: ${dynamicMachineMap[lockedMachine]?.name || lockedMachine}`
                    : 'Chế độ tự do (Chưa khóa)'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="print-root h-dvh overflow-hidden flex bg-[#EEF4FB] dark:bg-slate-950 text-[#0F172A] dark:text-slate-100 transition-colors">
      {/* ===== Desktop Left Sidebar ===== */}
      <aside
        className={`no-print hidden lg:block shrink-0 border-r border-[#C7D6E8] dark:border-slate-800 bg-white dark:bg-slate-900 h-full transition-[width] duration-200 ${
          sidebarCollapsed ? 'w-[76px]' : 'w-[260px]'
        }`}
        aria-label="Thanh điều hướng chính"
      >
        {renderSidebarContent(false)}
      </aside>

      {/* ===== Mobile Slide-over Sidebar ===== */}
      {mobileSidebarOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#0F172A]/45 backdrop-blur-[1px]"
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-[272px] max-w-[85vw] h-full border-r border-[#C7D6E8] dark:border-slate-800 shadow-2xl">
            {renderSidebarContent(true)}
          </aside>
        </div>
      )}

      {/* ===== Right Workspace Column (Independent Page Vertical Scrollbar) ===== */}
      <div
        data-outer-scroll="true"
        className="print-scroll-reset dual-scroll flex-1 min-w-0 h-full overflow-y-auto flex flex-col"
      >
        {/* Top Header */}
        <header className="no-print relative z-30 bg-white dark:bg-slate-900 border-b border-[#C7D6E8] dark:border-slate-800 px-4 sm:px-6 py-2.5">
          <div className="max-w-[1360px] mx-auto flex flex-wrap items-center justify-between gap-3">
            {/* Left: Mobile drawer button + Contextual Breadcrumb */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                aria-label="Mở menu điều hướng"
                className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg border border-[#B6CBE3] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#083578] dark:text-slate-200 hover:bg-[#DCEBFF] cursor-pointer shrink-0"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-medium text-[#334155] dark:text-slate-400">
                  <span className="font-bold text-[#0D4EA6] dark:text-sky-400 truncate">
                    Hospital Pro
                  </span>
                  <span aria-hidden="true">/</span>
                  <span className="truncate">Quản lý lịch giờ chụp</span>
                  <span aria-hidden="true">/</span>
                  <span className="font-bold text-[#0F172A] dark:text-slate-200 truncate">
                    {activeMachineConfig.name}
                  </span>
                </div>
                <h1 className="text-base sm:text-[17px] font-extrabold tracking-tight text-[#083578] dark:text-slate-100 truncate">
                  Hệ thống Điều phối Lịch Chụp X-quang
                </h1>
              </div>
            </div>

            {/* Right: Upgraded Clock + Calendar + Theme + Supervisor */}
            <div className="flex flex-wrap items-center gap-2.5 flex-1 sm:flex-initial justify-end">
              <ClockWidget
                selectedDateKey={viewedDateKey}
                onSelectDate={(dk) => {
                  if (!dk) return;
                  setDateInput(dk);
                  void loadDateStates(dk, false);
                }}
              />

              {/* Theme Picker */}
              <div className="relative" ref={themeMenuRef}>
                <button
                  type="button"
                  onClick={() => setThemeMenuOpen((o) => !o)}
                  aria-expanded={themeMenuOpen}
                  aria-label="Chọn chủ đề màu sắc"
                  title="Tùy chỉnh chủ đề giao diện"
                  className="inline-flex items-center gap-1.5 h-10 px-3 text-xs font-bold rounded-lg border border-[#B6CBE3] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#0F172A] dark:text-slate-200 hover:bg-[#DCEBFF] dark:hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Palette className="w-4 h-4 text-[#0D4EA6] dark:text-sky-400" />
                  <span className="hidden xl:inline">Giao diện</span>
                </button>

                {themeMenuOpen && (
                  <div
                    role="menu"
                    aria-label="Chọn chủ đề"
                    className="absolute right-0 mt-2 w-72 sm:w-80 rounded-xl border border-[#B6CBE3] dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1.5 z-40"
                  >
                    {THEME_LIST.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        role="menuitem"
                        onClick={() => handleSelectTheme(t.id)}
                        className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-xs font-bold rounded-lg text-left transition-colors cursor-pointer whitespace-nowrap ${
                          activeThemeId === t.id
                            ? 'bg-[#DCEBFF] dark:bg-slate-800 text-[#083578] dark:text-slate-100'
                            : 'text-[#0F172A] dark:text-slate-300 hover:bg-[#EEF4FB] dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-3 h-3 rounded-full border border-black/20 shrink-0"
                            style={{ backgroundColor: t.swatch }}
                          />
                          <span className="whitespace-nowrap">{t.label}</span>
                        </span>
                        {activeThemeId === t.id && (
                          <span className="text-[11px] font-extrabold text-[#0D4EA6] dark:text-sky-400 whitespace-nowrap shrink-0">
                            Đang dùng
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Supervisor Info */}
              <div className="hidden xl:flex items-center gap-2.5 pl-2.5 border-l border-[#C7D6E8] dark:border-slate-800 text-xs">
                <div className="w-8 h-8 rounded-lg bg-[#DCEBFF] dark:bg-sky-950/70 text-[#083578] dark:text-sky-300 font-extrabold text-xs flex items-center justify-center shrink-0">
                  {getInitials(activeMachineConfig.supervisor)}
                </div>
                <div className="leading-tight">
                  <div className="text-[11px] font-semibold text-[#475569] dark:text-slate-400">
                    Phụ trách máy
                  </div>
                  <div className="font-bold text-[#0F172A] dark:text-slate-200 whitespace-nowrap">
                    {activeMachineConfig.supervisor}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Viewport */}
        <main className="flex-1 px-4 sm:px-6 py-3.5 sm:py-4">
          <div className="max-w-[1360px] mx-auto space-y-3.5">
            {/* ===== Radiology Department Hero Banner ===== */}
            {(() => {
              const activeChecked = checkedCounts[activeMachineConfig.key] ?? 0;
              const activeTotal = totalSlotsByMachine[activeMachineConfig.key] ?? 0;
              const progressPct = activeTotal > 0 ? Math.round((activeChecked / activeTotal) * 100) : 0;
              return (
                <section
                  aria-label="Banner Khoa Chẩn đoán Hình ảnh"
                  className="no-print relative h-[92px] sm:h-[104px] rounded-xl overflow-hidden border border-[#B6CBE3] dark:border-slate-800 bg-[#083578] shadow-[0_2px_10px_rgba(8,53,120,0.12)]"
                >
                  {!bannerError ? (
                    <img
                      src={radiologyBannerImg}
                      alt="Phòng chụp X-quang kỹ thuật số Bệnh viện"
                      referrerPolicy="no-referrer"
                      onError={() => setBannerError(true)}
                      className="absolute inset-0 w-full h-full object-cover object-[78%_48%]"
                    />
                  ) : (
                    <div
                      className="absolute inset-0 bg-gradient-to-br from-[#06275B] via-[#0D4EA6] to-[#1D6CE0]"
                      aria-hidden="true"
                    />
                  )}

                  {/* Contrast Scrim protecting left text while keeping right progress crisp */}
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-[#06275B]/95 via-[#083578]/85 via-58% to-[#083578]/35"
                    aria-hidden="true"
                  />

                  <div className="relative z-10 h-full px-5 sm:px-6 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] font-semibold text-sky-200">
                        <span>Khoa Chẩn đoán Hình ảnh</span>
                        <span aria-hidden="true">·</span>
                        <span>Hệ thống X-quang kỹ thuật số</span>
                      </div>
                      <h2 className="text-lg sm:text-[21px] font-extrabold tracking-tight text-white mt-0.5 leading-snug truncate">
                        Điều phối Lịch Chụp X-quang
                      </h2>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-blue-100 mt-1">
                        <span className="font-bold text-white">{activeMachineConfig.name}</span>
                        <span aria-hidden="true">·</span>
                        <span>Phụ trách: {activeMachineConfig.supervisor}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          Ngày {formatDateDisplayVN(viewedDateKey)}
                        </span>
                      </div>
                    </div>

                    {/* Right live shift progress readout */}
                    <div className="hidden md:flex flex-col justify-center min-w-[216px] rounded-lg bg-white/10 backdrop-blur-[2px] border border-white/15 px-4 py-2 shrink-0">
                      <div className="flex items-center justify-between gap-3 text-[11px] font-semibold text-sky-100">
                        <span>Tiến độ ca chụp</span>
                        <span className="font-mono font-bold tabular-nums text-white">
                          {progressPct}%
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-2 mt-1">
                        <span className="font-mono text-lg font-extrabold tabular-nums text-white leading-none">
                          {activeChecked}
                          <span className="text-xs font-semibold text-sky-200">
                            /{activeTotal} ca
                          </span>
                        </span>
                      </div>
                      <div className="mt-2 w-full h-1.5 rounded-full bg-white/20 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-sky-300 transition-[width] duration-300"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </section>
              );
            })()}

            {/* ===== First-time device lock prompt (non-blocking) ===== */}
            {!lockedMachine && (
              <div className="no-print flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl border border-[#93BCEB] bg-[#DCEBFF] dark:border-sky-800/60 dark:bg-sky-950/30">
                <div className="flex items-center gap-2.5 text-sm font-medium text-[#0F172A] dark:text-slate-200">
                  <Lock className="w-4 h-4 text-[#0D4EA6] dark:text-sky-400 shrink-0" />
                  <span>
                    <strong className="text-[#083578] dark:text-sky-200 font-bold">
                      Thiết lập máy trạm:
                    </strong>{' '}
                    Chọn máy chụp cố định để khóa trên trình duyệt này nhằm tránh tích nhầm máy.
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {dynamicMachines.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => handleLockFirstTime(m.key)}
                      className="px-3.5 py-2 text-xs font-bold rounded-lg bg-[#0D4EA6] hover:bg-[#083578] text-white transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Khóa {m.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ===== Control & Date Filter Toolbar ===== */}
            <div className="no-print bg-white dark:bg-slate-900 border border-[#C7D6E8] dark:border-slate-800 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
              {/* Left: Machine Switch Tabs */}
              <div className="flex flex-wrap items-center gap-2">
                <div
                  className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#EEF4FB] dark:bg-slate-800 border border-[#B6CBE3] dark:border-slate-700"
                  role="tablist"
                  aria-label="Chọn máy chụp X-quang"
                >
                  {dynamicMachines.map((m) => {
                    const isActive = activeMachine === m.key;
                    const isLockedThis = lockedMachine === m.key;
                    const isTabLocked = lockedMachine !== null && lockedMachine !== m.key;
                    const count = checkedCounts[m.key];
                    const totalCap = totalSlotsByMachine[m.key];

                    return (
                      <button
                        key={m.key}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        aria-disabled={isTabLocked}
                        disabled={isTabLocked}
                        onClick={() => handleSelectMachineTab(m.key)}
                        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-bold transition-colors whitespace-nowrap shrink-0 ${
                          isTabLocked
                            ? 'opacity-45 cursor-not-allowed text-[#475569]'
                            : isActive
                            ? 'bg-[#0D4EA6] text-white shadow-xs cursor-pointer'
                            : 'text-[#0F172A] dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 cursor-pointer'
                        }`}
                      >
                        <span>{m.name}</span>
                        <span
                          className={`font-mono text-xs tabular-nums ${
                            isActive ? 'text-blue-100' : 'text-[#334155] dark:text-slate-400'
                          }`}
                        >
                          {count}/{totalCap}
                        </span>
                        {isLockedThis && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              void openAuthModal('open-settings');
                            }}
                            title={`Đang khóa máy ${m.name} trên thiết bị này — vào Cài đặt để đổi máy`}
                            aria-label={`Đang khóa máy ${m.name}`}
                            className={`inline-flex items-center justify-center rounded p-0.5 transition-colors cursor-pointer shrink-0 ${
                              isActive
                                ? 'text-white hover:bg-white/20'
                                : 'text-[#0D4EA6] dark:text-sky-300 hover:bg-[#DCEBFF]'
                            }`}
                          >
                            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right: Date Picker + Prev/Next Day + Settings */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1 p-1 rounded-lg border border-[#B6CBE3] dark:border-slate-700 bg-[#F4F8FF] dark:bg-slate-800/90">
                  <button
                    type="button"
                    onClick={() => handleStepDate(-1)}
                    title="Ngày hôm trước"
                    aria-label="Xem ngày trước"
                    className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[#334155] dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-[#083578] transition-colors cursor-pointer shrink-0"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={handleViewToday}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      isToday
                        ? 'bg-[#0D4EA6] text-white shadow-xs'
                        : 'text-[#0F172A] dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700'
                    }`}
                  >
                    Hôm nay
                  </button>

                  <label className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white dark:bg-slate-950 border border-[#C7D6E8] dark:border-slate-700 focus-within:border-[#0D4EA6] focus-within:ring-2 focus-within:ring-[#0D4EA6]/20">
                    <Calendar className="w-3.5 h-3.5 text-[#0D4EA6] dark:text-sky-400 shrink-0" />
                    <input
                      type="date"
                      value={dateInput ?? ''}
                      onChange={(e) => setDateInput(e.target.value ?? '')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleViewSelectedDate();
                      }}
                      aria-label="Chọn ngày xem lịch"
                      className="text-xs font-mono font-bold bg-transparent text-[#0F172A] dark:text-slate-100 focus:outline-none cursor-pointer"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => handleViewSelectedDate()}
                    className="px-3 py-1.5 text-xs font-bold rounded-md bg-[#DCEBFF] hover:bg-[#C6DFFF] dark:bg-sky-950/70 dark:hover:bg-sky-900 text-[#083578] dark:text-sky-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Xem ngày
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStepDate(1)}
                    title="Ngày tiếp theo"
                    aria-label="Xem ngày sau"
                    className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[#334155] dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-[#083578] transition-colors cursor-pointer shrink-0"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleOpenSettings}
                  title="Cài đặt hệ thống (yêu cầu mật khẩu)"
                  className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-bold rounded-lg border border-[#B6CBE3] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#0F172A] dark:text-slate-200 hover:bg-[#DCEBFF] dark:hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Settings className="w-3.5 h-3.5 text-[#0D4EA6] dark:text-sky-400" />
                  <span>Cài đặt</span>
                </button>
              </div>
            </div>

            {/* Mobile Morning/Afternoon Segment Bar */}
            <div className="no-print flex md:hidden items-center justify-between gap-2 bg-white dark:bg-slate-900 border border-[#C7D6E8] dark:border-slate-800 rounded-xl px-3 py-2">
              <span className="text-xs font-bold text-[#334155] dark:text-slate-400">
                Buổi hiển thị:
              </span>
              <div
                className="flex items-center gap-1 p-1 rounded-lg bg-[#EEF4FB] dark:bg-slate-800 border border-[#B6CBE3] dark:border-slate-700"
                role="tablist"
                aria-label="Chọn buổi hiển thị trên di động"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mobileSegment === 'morning'}
                  onClick={() => handleMobileSegment('morning')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                    mobileSegment === 'morning'
                      ? 'bg-[#0D4EA6] text-white'
                      : 'text-[#334155] dark:text-slate-400'
                  }`}
                >
                  Ca Sáng
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mobileSegment === 'afternoon'}
                  onClick={() => handleMobileSegment('afternoon')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                    mobileSegment === 'afternoon'
                      ? 'bg-[#0D4EA6] text-white'
                      : 'text-[#334155] dark:text-slate-400'
                  }`}
                >
                  Ca Chiều
                </button>
              </div>
            </div>

            {/* ===== Read-Only Banner for Non-Today Dates ===== */}
            {isReadOnly && (
              <div
                role="status"
                className="no-print flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50/85 dark:border-amber-800/60 dark:bg-amber-950/30 text-sm text-amber-900 dark:text-amber-200"
              >
                <div className="flex items-center gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>
                    Đang ở <strong>chế độ chỉ xem</strong> cho ngày{' '}
                    <span className="font-mono font-bold tabular-nums">
                      {formatDateDisplayVN(viewedDateKey)}
                    </span>
                    . Không thể chỉnh sửa ca chụp để bảo toàn dữ liệu ngày hôm nay.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleViewToday}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 cursor-pointer whitespace-nowrap"
                >
                  Quay về hôm nay
                </button>
              </div>
            )}

            {/* ===== Backend Connection Error Banner ===== */}
            {loadError && (
              <div
                role="alert"
                className="no-print flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl border border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/40 text-sm text-red-900 dark:text-red-200"
              >
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                  <span>{loadError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void loadDateStates(viewedDateKey, false)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-300 dark:border-red-700 bg-white dark:bg-slate-900 hover:bg-red-100 cursor-pointer whitespace-nowrap"
                >
                  Thử lại
                </button>
              </div>
            )}

            {/* ===== Active Machine Schedule Table ===== */}
            <div ref={scheduleAreaRef}>
              <ScheduleTable
                ref={scheduleTableRef}
                machine={activeMachineConfig}
                slots={activeSlots}
                isToday={isToday}
                isReadOnly={isReadOnly}
                loading={loadingStates}
                displaySettings={displaySettings}
                mobileSegment={mobileSegment}
                viewedDateKey={viewedDateKey}
                nowTick={nowTick}
                lastPickedStart={lastPickedStart}
                lastPickTone={lastPickStatus.tone}
                floatingClockOpen={floatingClockOpen}
                pendingSlots={pendingSlots}
                onSlotClick={handleSlotClick}
                onChangeDisplaySettings={handleChangeDisplaySettings}
                onSwitchMobileSegment={handleMobileSegment}
                onToggleFloatingClock={() => pipClockRef.current?.toggle()}
                onRequestQuickPick={handleRequestQuickPick}
              />
            </div>
          </div>
        </main>
      </div>

      {/* ===== Modals ===== */}
      <UncheckConfirmModal
        target={
          uncheckTarget
            ? {
                machineName: activeMachineConfig.name,
                stt: uncheckTarget.row.stt,
                sessionLabel: uncheckTarget.session === 'm' ? 'Ca Sáng' : 'Ca Chiều',
                startTime:
                  uncheckTarget.session === 'm'
                    ? uncheckTarget.row.morningStart
                    : uncheckTarget.row.afternoonStart,
                endTime:
                  uncheckTarget.session === 'm'
                    ? uncheckTarget.row.morningEnd
                    : uncheckTarget.row.afternoonEnd,
              }
            : null
        }
        onCancel={() => setUncheckTarget(null)}
        onConfirm={() => {
          if (uncheckTarget) {
            void commitSlotToggle(uncheckTarget.row, uncheckTarget.session, false);
          }
          setUncheckTarget(null);
        }}
      />

      <QuickPickConfirmModal
        target={
          quickPickTarget
            ? {
                machineName: activeMachineConfig.name,
                stt: quickPickTarget.row.stt,
                sessionLabel: quickPickTarget.sessionLabel,
                startTime: quickPickTarget.startTime,
                endTime: quickPickTarget.endTime,
                relativeNote: quickPickTarget.relativeNote,
              }
            : null
        }
        onCancel={() => setQuickPickTarget(null)}
        onConfirm={() => {
          if (quickPickTarget) {
            const { row, session } = quickPickTarget;
            void commitSlotToggle(row, session, true);
            scheduleTableRef.current?.scrollToSlot(row.stt, session);
          }
          setQuickPickTarget(null);
        }}
      />

      <AuthModal
        open={authModalMode !== null}
        mode={authModalMode || 'open-settings'}
        authConfigured={authConfigured}
        machineName={activeMachineConfig.name}
        dateLabel={formatDateDisplayVN(viewedDateKey)}
        submitting={authSubmitting}
        errorMsg={authError}
        onClose={() => {
          setAuthModalMode(null);
          setAuthError(null);
        }}
        onSetupAndContinue={(pwd) => void handleSetupAndContinue(pwd)}
        onSubmitPassword={(pwd) => void executeAuthAction(pwd)}
      />

      <ChangePasswordModal
        open={changePwdModalOpen}
        submitting={authSubmitting}
        errorMsg={changePwdError}
        onClose={() => {
          setChangePwdModalOpen(false);
          setChangePwdError(null);
        }}
        onSubmit={(cur, next) => void handleChangePassword(cur, next)}
      />

      <PrintPdfModal
        open={printModalOpen}
        machineName={activeMachineConfig.name}
        supervisor={activeMachineConfig.supervisor}
        dateLabel={formatDateDisplayVN(viewedDateKey)}
        totalRows={activeMachineConfig.totalRows}
        totalSlotsCount={totalSlotsByMachine[activeMachineConfig.key] ?? 0}
        checkedCount={checkedCounts[activeMachineConfig.key] ?? 0}
        exporting={exportingPdf}
        onClose={() => setPrintModalOpen(false)}
        onDownloadPdf={handleDownloadPdf}
        onDirectPrint={handleDirectPrint}
      />

      <ScheduleSettingsModal
        open={settingsModalOpen}
        initialSettings={scheduleSettings}
        activeMachineKey={activeMachineConfig.key}
        lockedMachine={lockedMachine}
        viewedDateLabel={formatDateDisplayVN(viewedDateKey)}
        canChangePassword={authConfigured && authSource === 'server'}
        saving={savingSettings}
        resettingMachineKey={resettingMachineKey}
        onClose={handleCloseSettings}
        onSave={(next) => void handleSaveScheduleSettings(next)}
        onLockMachine={handleLockMachineFromSettings}
        onResetMachineDay={handleResetMachineFromSettings}
        onOpenChangePassword={() => {
          setChangePwdError(null);
          setChangePwdModalOpen(true);
        }}
      />

      <MultitaskingClockPip
        ref={pipClockRef}
        machineName={activeMachineConfig.name}
        lastPickedStart={lastPickedStart}
        lastPickTone={lastPickStatus.tone}
        isToday={isToday}
        onOpenStateChange={setFloatingClockOpen}
        onNotify={pushToast}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
