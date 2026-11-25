import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Calendar,
  CalendarCheck,
  FileSpreadsheet,
  Lock,
  Menu,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Printer,
  Rows3,
  Settings,
  ShieldAlert,
  UserCheck,
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
  nowMinutesVN,
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
import { ScheduleTable } from './components/ScheduleTable';
import {
  AuthModal,
  ChangePasswordModal,
  PrintPdfModal,
  UncheckConfirmModal,
} from './components/Modals';
import { ScheduleSettingsModal } from './components/ScheduleSettingsModal';
import { ToastContainer, ToastItem } from './components/Toast';
import { exportScheduleExcel } from './utils/excelExport';
import { exportSchedulePdf } from './utils/pdfExport';

const LOCK_STORAGE_KEY = 'xq_locked_machine';
const DENSITY_STORAGE_KEY = 'xq_density_mode';
const MOBILE_SEG_STORAGE_KEY = 'xq_mobile_segment';
const SIDEBAR_STORAGE_KEY = 'xq_sidebar_collapsed';
const SETTINGS_STORAGE_KEY = 'xq_schedule_settings_v1';

function themeStorageKey(mk: MachineKey): string {
  return `xq_v2_theme__${mk}`;
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
  const [loadingStates, setLoadingStates] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingSlots, setPendingSlots] = useState<Record<string, boolean>>({});

  // ===== UI preferences =====
  const [density, setDensity] = useState<'compact' | 'standard'>(() =>
    localStorage.getItem(DENSITY_STORAGE_KEY) === 'standard' ? 'standard' : 'compact'
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

  // ===== Toasts =====
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastIdRef = useRef(1);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const scheduleAreaRef = useRef<HTMLDivElement>(null);

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

  // ===== Load states from backend =====
  const loadDateStates = useCallback(async (dk: string, silent = false) => {
    if (!silent) {
      setLoadingStates(true);
      setLoadError(null);
    }
    try {
      const data = await fetchStatesForDate(dk);
      setTodayKey(data.today);
      setViewedDateKey(data.dateKey);
      setDateInput(data.dateKey);
      const nextStates: Record<string, Record<string, boolean>> = {};
      if (data.machines && typeof data.machines === 'object') {
        for (const mk of Object.keys(data.machines)) {
          nextStates[mk] = data.machines[mk]?.state || {};
        }
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
      const msg =
        err instanceof Error ? err.message : 'Không thể kết nối máy chủ để tải dữ liệu lịch.';
      if (!silent) {
        setLoadError(msg);
      }
    } finally {
      if (!silent) setLoadingStates(false);
    }
  }, []);

  // Initial load: get server today (Asia/Ho_Chi_Minh), states, auth status, and settings
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [{ today }, auth, settingsRes] = await Promise.all([
          fetchToday(),
          fetchAuthStatus(),
          fetchScheduleSettings().catch(() => null),
        ]);
        if (!mounted) return;
        setTodayKey(today);
        setViewedDateKey(today);
        setDateInput(today);
        setAuthConfigured(auth.configured);
        setAuthSource(auth.source);
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
        await loadDateStates(today, false);
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

  // Periodic background sync (every 15s + on window focus)
  useEffect(() => {
    const sync = () => {
      if (document.visibilityState === 'visible') {
        void loadDateStates(viewedDateKey, true);
      }
    };
    const interval = setInterval(sync, 15000);
    window.addEventListener('focus', sync);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', sync);
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

  // Latest selected start time for active machine & viewed date
  const lastPickedStart = useMemo(() => {
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
  }, [activeMachineConfig.rows, activeSlots]);

  const lastPickStatus = useMemo(() => {
    if (!lastPickedStart) return { label: 'Chưa có ca chọn', tone: 'empty' as const };
    if (!isToday) return { label: `Ngày ${formatDateDisplayVN(viewedDateKey)}`, tone: 'neutral' as const };
    void nowTick;
    const tMin = parseHHMM(lastPickedStart);
    if (tMin === null) return { label: '', tone: 'neutral' as const };
    const diff = nowMinutesVN() - tMin;
    if (diff === 0) return { label: 'Đang đến giờ', tone: 'now' as const };
    if (diff > 30) return { label: 'Quá giờ > 30 phút', tone: 'overdue' as const };
    if (diff > 0) return { label: 'Đã qua ≤ 30 phút', tone: 'past' as const };
    return { label: 'Sắp tới', tone: 'upcoming' as const };
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

    setPendingSlots((p) => ({ ...p, [slotKey]: true }));
    setStatesByMachine((prev) => {
      const nextMachineState = { ...(prev[mk] || {}) };
      if (checked) nextMachineState[slotKey] = true;
      else delete nextMachineState[slotKey];
      return { ...prev, [mk]: nextMachineState };
    });

    try {
      const res = await toggleSlot(mk, dk, slotKey, checked);
      setStatesByMachine((prev) => ({ ...prev, [mk]: res.state }));
    } catch (err) {
      setStatesByMachine((prev) => {
        const reverted = { ...(prev[mk] || {}) };
        if (checked) delete reverted[slotKey];
        else reverted[slotKey] = true;
        return { ...prev, [mk]: reverted };
      });
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

  const handleViewToday = () => {
    setDateInput(todayKey);
    void loadDateStates(todayKey, false);
    setMobileSidebarOpen(false);
    scheduleAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const handleViewSelectedDate = (dk?: string) => {
    const target = dk || dateInput;
    if (!target) return;
    void loadDateStates(target, false);
  };

  const handleToggleDensity = () => {
    const next = density === 'compact' ? 'standard' : 'compact';
    setDensity(next);
    localStorage.setItem(DENSITY_STORAGE_KEY, next);
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
        setStatesByMachine((prev) => ({ ...prev, [activeMachineConfig.key]: {} }));
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
      setStatesByMachine((prev) => ({ ...prev, [mk]: {} }));
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
                onClick={handleToggleDensity}
                title="Chuyển độ giãn dòng bảng"
                className={`w-full flex items-center ${
                  compact ? 'justify-center px-2' : 'gap-2.5 px-3'
                } py-2 rounded-lg text-sm font-semibold text-[#0F172A] dark:text-slate-300 hover:bg-[#EEF4FB] dark:hover:bg-slate-800 transition-colors cursor-pointer`}
              >
                <Rows3 className="w-4 h-4 text-[#0D4EA6] dark:text-sky-400 shrink-0" />
                {!compact && (
                  <span className="truncate">
                    {density === 'compact' ? 'Hiển thị: Gọn' : 'Hiển thị: Chuẩn'}
                  </span>
                )}
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
    <div className="print-root min-h-screen flex bg-[#EEF4FB] dark:bg-slate-950 text-[#0F172A] dark:text-slate-100 transition-colors">
      {/* ===== Desktop Left Sidebar ===== */}
      <aside
        className={`no-print hidden lg:block shrink-0 border-r border-[#C7D6E8] dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 h-screen transition-[width] duration-200 ${
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

      {/* ===== Right Workspace Column (Header + Main Content) ===== */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Header */}
        <header className="no-print sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-[#C7D6E8] dark:border-slate-800 px-4 sm:px-6 py-3">
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
                <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-[#083578] dark:text-slate-100 truncate">
                  Hệ thống Điều phối Lịch Chụp X-quang
                </h1>
              </div>
            </div>

            {/* Right: Upgraded Clock + Calendar + Theme + Supervisor */}
            <div className="flex flex-wrap items-center gap-2.5 flex-1 sm:flex-initial justify-end">
              <ClockWidget
                selectedDateKey={viewedDateKey}
                onSelectDate={(dk) => {
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
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold rounded-xl border border-[#B6CBE3] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#0F172A] dark:text-slate-200 hover:bg-[#DCEBFF] dark:hover:bg-slate-700 cursor-pointer whitespace-nowrap shrink-0"
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
              <div className="hidden xl:flex items-center gap-2 pl-2.5 border-l border-[#C7D6E8] dark:border-slate-800 text-xs">
                <div className="w-8 h-8 rounded-lg bg-[#DCEBFF] dark:bg-sky-950/60 text-[#0D4EA6] dark:text-sky-300 flex items-center justify-center shrink-0">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div className="leading-tight">
                  <div className="text-[11px] font-semibold text-[#334155] dark:text-slate-400">Phụ trách máy</div>
                  <div className="font-bold text-[#0F172A] dark:text-slate-200 whitespace-nowrap">
                    {activeMachineConfig.supervisor}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Viewport */}
        <main className="flex-1 px-4 sm:px-6 py-4 sm:py-5">
          <div className="max-w-[1360px] mx-auto space-y-4">
            {/* ===== Radiology Department Hero Banner ===== */}
            <section
              aria-label="Banner Khoa Chẩn đoán Hình ảnh"
              className="no-print relative h-[126px] sm:h-[144px] rounded-xl overflow-hidden border border-[#B6CBE3] dark:border-slate-800 bg-[#083578] shadow-[0_2px_10px_rgba(8,53,120,0.12)]"
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

              {/* Contrast Scrim protecting left editorial text while keeping X-ray unit bright on right */}
              <div
                className="absolute inset-0 bg-gradient-to-r from-[#06275B]/95 via-[#083578]/82 via-55% to-[#083578]/15"
                aria-hidden="true"
              />

              <div className="relative z-10 h-full px-5 sm:px-7 flex flex-col justify-center max-w-2xl">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-sky-200">
                  <span>Khoa Chẩn đoán Hình ảnh</span>
                  <span aria-hidden="true">·</span>
                  <span>Hệ thống X-quang kỹ thuật số</span>
                </div>
                <h2 className="text-lg sm:text-2xl font-extrabold tracking-tight text-white mt-0.5 leading-snug">
                  Điều phối Lịch Chụp X-quang
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-xs sm:text-[13px] font-medium text-blue-100 mt-1.5">
                  <span className="font-bold text-white">{activeMachineConfig.name}</span>
                  <span aria-hidden="true">·</span>
                  <span>Phụ trách: {activeMachineConfig.supervisor}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    Ngày {formatDateDisplayVN(viewedDateKey)}
                  </span>
                </div>
              </div>
            </section>

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
            <div className="no-print bg-white dark:bg-slate-900 border border-[#C7D6E8] dark:border-slate-800 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
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

              {/* Right: Date Picker + View Mode + Settings + Reset */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1 p-1 rounded-lg border border-[#B6CBE3] dark:border-slate-700 bg-[#F4F8FF] dark:bg-slate-800/90">
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
                      value={dateInput}
                      onChange={(e) => setDateInput(e.target.value)}
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
                </div>

                <button
                  type="button"
                  onClick={handleToggleDensity}
                  aria-pressed={density === 'compact'}
                  title="Chuyển đổi độ giãn dòng bảng"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border border-[#B6CBE3] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#0F172A] dark:text-slate-200 hover:bg-[#EEF4FB] dark:hover:bg-slate-700 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Rows3 className="w-3.5 h-3.5 text-[#0D4EA6]" />
                  <span>{density === 'compact' ? 'Dòng: Gọn' : 'Dòng: Chuẩn'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenSettings}
                  title="Cài đặt hệ thống (yêu cầu mật khẩu)"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border border-[#B6CBE3] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#0F172A] dark:text-slate-200 hover:bg-[#DCEBFF] dark:hover:bg-slate-700 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Settings className="w-3.5 h-3.5 text-[#0D4EA6]" />
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
                machine={activeMachineConfig}
                slots={activeSlots}
                isToday={isToday}
                isReadOnly={isReadOnly}
                loading={loadingStates}
                density={density}
                mobileSegment={mobileSegment}
                viewedDateKey={viewedDateKey}
                nowTick={nowTick}
                lastPickedStart={lastPickedStart}
                lastPickTone={lastPickStatus.tone}
                pendingSlots={pendingSlots}
                onSlotClick={handleSlotClick}
                onPrint={handleOpenPrintPdf}
                onCopy={(rows) => handleExportExcel(rows)}
                onSwitchMobileSegment={handleMobileSegment}
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

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
