import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  KeyRound,
  Lock,
  MonitorCog,
  Plus,
  RotateCcw,
  Settings2,
  Sparkles,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import { MachineKey } from '../data/schedules';
import {
  analyzeScheduleSettings,
  DEFAULT_SCHEDULE_SETTINGS,
  generateMachineKeyFromName,
  MachineMetaConfig,
  ScheduleCollision,
  ScheduleSettings,
} from '../utils/scheduleGenerator';

interface ScheduleSettingsModalProps {
  open: boolean;
  initialSettings: ScheduleSettings;
  activeMachineKey: MachineKey;
  lockedMachine: MachineKey | null;
  viewedDateLabel: string;
  canChangePassword: boolean;
  saving: boolean;
  resettingMachineKey: MachineKey | null;
  onClose: () => void;
  onSave: (nextSettings: ScheduleSettings) => void;
  onLockMachine: (machineKey: MachineKey | null) => void;
  onResetMachineDay: (machineKey: MachineKey) => Promise<void> | void;
  onOpenChangePassword: () => void;
}

function cloneSettings(s: ScheduleSettings): ScheduleSettings {
  return {
    ...s,
    machines: (s.machines || DEFAULT_SCHEDULE_SETTINGS.machines).map((m) => ({ ...m })),
  };
}

function formatCollisionSummary(c: ScheduleCollision): string {
  const names = c.slots
    .map((s) => `${s.machineName} (${s.sessionLabel} STT ${s.stt})`)
    .join(' & ');
  return `${c.time}: ${names}`;
}

export const ScheduleSettingsModal: React.FC<ScheduleSettingsModalProps> = ({
  open,
  initialSettings,
  activeMachineKey,
  lockedMachine,
  viewedDateLabel,
  canChangePassword,
  saving,
  resettingMachineKey,
  onClose,
  onSave,
  onLockMachine,
  onResetMachineDay,
  onOpenChangePassword,
}) => {
  const [draft, setDraft] = useState<ScheduleSettings>(() => cloneSettings(initialSettings));
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [resetTargetKey, setResetTargetKey] = useState<MachineKey>(activeMachineKey);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const savedMachines = useMemo(
    () =>
      initialSettings.machines && initialSettings.machines.length > 0
        ? initialSettings.machines
        : DEFAULT_SCHEDULE_SETTINGS.machines,
    [initialSettings.machines]
  );

  useEffect(() => {
    if (open) {
      setDraft(cloneSettings(initialSettings));
      setSubmitAttempted(false);
      setResetTargetKey(activeMachineKey);
      setConfirmResetOpen(false);
    }
  }, [open, initialSettings, activeMachineKey]);

  useEffect(() => {
    if (!savedMachines.some((m) => m.key === resetTargetKey)) {
      setResetTargetKey(savedMachines[0]?.key || 'TITAN2000');
      setConfirmResetOpen(false);
    }
  }, [savedMachines, resetTargetKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving && !resettingMachineKey) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, saving, resettingMachineKey, onClose]);

  const analysis = useMemo(() => analyzeScheduleSettings(draft), [draft]);

  if (!open) return null;

  const updateNumber = (
    field: 'scanDuration' | 'primaryInterval' | 'secondaryInterval' | 'secondaryFrequency',
    raw: string
  ) => {
    const num = parseInt(raw, 10);
    setDraft((prev) => ({
      ...prev,
      [field]: Number.isFinite(num) ? num : 0,
    }));
  };

  const updateMachineField = (
    index: number,
    field: keyof Pick<MachineMetaConfig, 'name' | 'supervisor'>,
    value: string
  ) => {
    setDraft((prev) => {
      const nextMachines = prev.machines.map((m, i) =>
        i === index ? { ...m, [field]: value } : m
      );
      return { ...prev, machines: nextMachines };
    });
  };

  const handleAddMachine = () => {
    setDraft((prev) => {
      if (prev.machines.length >= 6) return prev;
      const existing = new Set(prev.machines.map((m) => m.key));
      let idx = prev.machines.length + 1;
      let defaultName = `MÁY X-QUANG ${idx}`;
      while (prev.machines.some((m) => m.name.toUpperCase() === defaultName)) {
        idx++;
        defaultName = `MÁY X-QUANG ${idx}`;
      }
      const key = generateMachineKeyFromName(defaultName, existing);
      return {
        ...prev,
        machines: [
          ...prev.machines,
          { key, name: defaultName, supervisor: '' },
        ],
      };
    });
  };

  const handleDeleteMachine = (keyToDelete: MachineKey) => {
    setDraft((prev) => {
      if (prev.machines.length <= 1) return prev;
      const nextMachines = prev.machines.filter((m) => m.key !== keyToDelete);
      const nextFirst =
        prev.firstMachine === keyToDelete ? nextMachines[0].key : prev.firstMachine;
      return {
        ...prev,
        machines: nextMachines,
        firstMachine: nextFirst,
      };
    });
  };

  const handleApplySafeIntervals = () => {
    setDraft((prev) => ({
      ...prev,
      primaryInterval: 2,
      useSecondaryInterval: true,
      secondaryInterval: 3,
      secondaryFrequency: 3,
    }));
  };

  const handleResetDefaults = () => {
    setDraft(cloneSettings(DEFAULT_SCHEDULE_SETTINGS));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    if (analysis.hasConflict) return;
    const cleanedMachines = draft.machines.map((m) => ({
      key: m.key,
      name: m.name.trim(),
      supervisor: m.supervisor.trim(),
    }));
    onSave({
      ...draft,
      machines: cleanedMachines,
    });
  };

  const resetTargetMachine =
    savedMachines.find((m) => m.key === resetTargetKey) || savedMachines[0];

  const handleConfirmReset = async () => {
    if (!resetTargetMachine) return;
    await onResetMachineDay(resetTargetMachine.key);
    setConfirmResetOpen(false);
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0F172A]/55 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-settings-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving && !resettingMachineKey) onClose();
      }}
    >
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-xl border border-[#C7D6E8] dark:border-slate-800 bg-white dark:bg-slate-900 text-[#0F172A] dark:text-slate-100 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[#C7D6E8] dark:border-slate-800 bg-[#EEF4FB]/85 dark:bg-slate-900 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#0D4EA6] text-white flex items-center justify-center shrink-0 mt-0.5">
              <Settings2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="schedule-settings-title"
                className="text-base sm:text-lg font-extrabold font-display text-[#083578] dark:text-slate-100"
              >
                Cài đặt hệ thống &amp; Lịch giờ chụp X-quang
              </h2>
              <p className="mt-0.5 text-xs font-medium text-[#334155] dark:text-slate-400">
                Quản lý đổi máy trạm, reset dữ liệu ngày, chỉnh sửa hoặc xóa máy/người phụ trách và thông số ca chụp.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving || Boolean(resettingMachineKey)}
            aria-label="Đóng cài đặt"
            className="p-1.5 rounded-lg text-[#334155] hover:text-[#0F172A] hover:bg-[#DCEBFF] dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* 1. Đổi máy trạm, Reset dữ liệu ngày & Bảo mật */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#083578] dark:text-sky-300">
                1. Đổi máy trạm, Reset dữ liệu &amp; Bảo mật
              </h3>
              {canChangePassword && (
                <button
                  type="button"
                  onClick={onOpenChangePassword}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-[#B6CBE3] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#083578] dark:text-sky-300 hover:bg-[#DCEBFF] dark:hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Đổi mật khẩu quản trị</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Đổi / Khóa máy trạm */}
              <div className="p-3.5 rounded-xl border border-[#C7D6E8] dark:border-slate-800 bg-[#F8FBFF] dark:bg-slate-800/40 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#083578] dark:text-sky-300">
                    <MonitorCog className="w-4 h-4 shrink-0" />
                    <span>Đổi / Khóa máy trạm</span>
                  </div>
                  {lockedMachine && (
                    <button
                      type="button"
                      onClick={() => onLockMachine(null)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-md border border-[#B6CBE3] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#334155] dark:text-slate-300 hover:bg-[#DCEBFF] dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                    >
                      <Unlock className="w-3 h-3" />
                      <span>Mở khóa</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] font-medium text-[#475569] dark:text-slate-400">
                  {lockedMachine
                    ? `Trình duyệt đang khóa cố định vào máy ${
                        savedMachines.find((m) => m.key === lockedMachine)?.name || lockedMachine
                      }.`
                    : 'Đang ở chế độ tự do (chưa khóa máy trạm).'}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {savedMachines.map((m) => {
                    const isLockedThis = lockedMachine === m.key;
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => onLockMachine(m.key)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                          isLockedThis
                            ? 'border-[#0D4EA6] bg-[#0D4EA6] text-white'
                            : 'border-[#B6CBE3] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#0F172A] dark:text-slate-200 hover:bg-[#DCEBFF] dark:hover:bg-slate-800'
                        }`}
                      >
                        <Lock className="w-3 h-3 shrink-0" />
                        <span>{isLockedThis ? `Đang khóa: ${m.name}` : `Khóa ${m.name}`}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reset dữ liệu ngày đang xem */}
              <div className="p-3.5 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/55 dark:bg-red-950/20 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-red-800 dark:text-red-300">
                    <RotateCcw className="w-4 h-4 shrink-0" />
                    <span>Reset dữ liệu ngày ({viewedDateLabel})</span>
                  </div>
                </div>
                <p className="text-[11px] font-medium text-red-900/80 dark:text-red-200/80">
                  Xóa toàn bộ các ca đã chọn của máy được chọn trong ngày {viewedDateLabel}.
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={resetTargetMachine?.key || ''}
                    onChange={(e) => {
                      setResetTargetKey(e.target.value);
                      setConfirmResetOpen(false);
                    }}
                    aria-label="Chọn máy để reset dữ liệu ngày"
                    className="flex-1 min-w-[140px] px-2.5 py-1.5 text-xs font-bold rounded-lg border border-red-200 dark:border-red-900/60 bg-white dark:bg-slate-900 text-[#0F172A] dark:text-slate-100 focus:outline-none focus:border-red-500"
                  >
                    {savedMachines.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.name}
                      </option>
                    ))}
                  </select>

                  {!confirmResetOpen ? (
                    <button
                      type="button"
                      disabled={Boolean(resettingMachineKey)}
                      onClick={() => setConfirmResetOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset ngày này</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={Boolean(resettingMachineKey)}
                        onClick={() => void handleConfirmReset()}
                        className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-red-700 hover:bg-red-800 text-white cursor-pointer disabled:opacity-50 whitespace-nowrap"
                      >
                        {resettingMachineKey ? 'Đang xóa...' : 'Xác nhận xóa'}
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(resettingMachineKey)}
                        onClick={() => setConfirmResetOpen(false)}
                        className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-800 bg-white dark:bg-slate-900 text-[#334155] dark:text-slate-300 cursor-pointer whitespace-nowrap"
                      >
                        Hủy
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* 2. Quản lý Máy chụp & Người phụ trách */}
          <section className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#083578] dark:text-sky-300">
                  2. Quản lý Máy chụp &amp; Người phụ trách
                </h3>
                <span className="text-[11px] font-medium text-[#475569] dark:text-slate-400">
                  Thay đổi tên máy, người phụ trách, xóa hoặc thêm mới máy chụp (tối thiểu 1 máy).
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddMachine}
                disabled={draft.machines.length >= 6}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-[#0D4EA6] bg-[#DCEBFF] hover:bg-[#C6DFFF] dark:border-sky-600 dark:bg-sky-950/60 text-[#083578] dark:text-sky-200 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm máy chụp</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {draft.machines.map((m, idx) => {
                const canDelete = draft.machines.length > 1;
                return (
                  <div
                    key={m.key}
                    className="p-3 rounded-xl border border-[#C7D6E8] dark:border-slate-800 bg-[#F8FBFF] dark:bg-slate-800/40 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2.5 items-end"
                  >
                    <label className="block">
                      <span className="flex items-center justify-between text-[11px] font-bold text-[#334155] dark:text-slate-300 mb-1">
                        <span>Tên máy #{idx + 1}</span>
                        <span className="font-mono text-[10px] text-[#64748B]">{m.key}</span>
                      </span>
                      <input
                        type="text"
                        maxLength={40}
                        value={m.name}
                        onChange={(e) => updateMachineField(idx, 'name', e.target.value)}
                        placeholder="Ví dụ: TITAN 2000"
                        className="w-full px-3 py-2 text-sm font-bold rounded-lg border border-[#B6CBE3] dark:border-slate-700 bg-white dark:bg-slate-950 text-[#0F172A] dark:text-slate-100 focus:outline-none focus:border-[#0D4EA6] focus:ring-2 focus:ring-[#0D4EA6]/25"
                      />
                    </label>

                    <label className="block">
                      <span className="block text-[11px] font-bold text-[#334155] dark:text-slate-300 mb-1">
                        Người phụ trách
                      </span>
                      <input
                        type="text"
                        maxLength={60}
                        value={m.supervisor}
                        onChange={(e) => updateMachineField(idx, 'supervisor', e.target.value)}
                        placeholder="Chưa phân công"
                        className="w-full px-3 py-2 text-sm font-medium rounded-lg border border-[#B6CBE3] dark:border-slate-700 bg-white dark:bg-slate-950 text-[#0F172A] dark:text-slate-100 focus:outline-none focus:border-[#0D4EA6] focus:ring-2 focus:ring-[#0D4EA6]/25"
                      />
                    </label>

                    <button
                      type="button"
                      disabled={!canDelete}
                      onClick={() => handleDeleteMachine(m.key)}
                      title={canDelete ? `Xóa máy ${m.name}` : 'Phải giữ lại ít nhất 1 máy chụp'}
                      aria-label={`Xóa máy ${m.name}`}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border border-red-200 dark:border-red-900/60 bg-white dark:bg-slate-900 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa máy</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 3. Máy bắt đầu trước */}
          <section className="space-y-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#083578] dark:text-sky-300">
                3. Thứ tự bắt đầu giữa các máy
              </h3>
              <span className="text-xs font-medium text-[#475569] dark:text-slate-400">
                Máy trước mở ca +1 phút · Các máy còn lại lệch +2p, +3p…
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {draft.machines.map((m) => {
                const isFirst = draft.firstMachine === m.key;
                const label = m.name.trim() || m.key;
                const sum = analysis.summaries[m.key];
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setDraft((p) => ({ ...p, firstMachine: m.key }))}
                    className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left transition-colors cursor-pointer ${
                      isFirst
                        ? 'border-[#0D4EA6] bg-[#DCEBFF] dark:border-sky-500 dark:bg-sky-950/45 text-[#083578] dark:text-sky-100'
                        : 'border-[#C7D6E8] dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-[#EEF4FB] dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold truncate">{label} bắt đầu trước</div>
                      <div className="text-xs font-medium text-[#334155] dark:text-slate-400 mt-0.5 truncate">
                        {isFirst
                          ? `Đang chọn: mở ca +1 phút`
                          : `Hiện tại: mở ca +${sum ? sum.offsetMin : 2} phút`}
                      </div>
                    </div>
                    <span
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isFirst
                          ? 'border-[#0D4EA6] dark:border-sky-400'
                          : 'border-[#94A3B8] dark:border-slate-600'
                      }`}
                      aria-hidden="true"
                    >
                      {isFirst && (
                        <span className="w-2 h-2 rounded-full bg-[#0D4EA6] dark:bg-sky-400" />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 4. Khung giờ làm việc Sáng / Chiều */}
          <section className="space-y-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#083578] dark:text-sky-300">
                4. Thời gian ca làm việc
              </h3>
              <span className="text-xs font-medium text-[#475569] dark:text-slate-400">
                Ca đầu &gt; giờ bắt đầu · Ca cuối kết thúc ≤ giờ kết thúc làm việc
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Buổi sáng */}
              <div className="p-3.5 rounded-xl border border-[#C7D6E8] dark:border-slate-800 bg-[#F8FBFF] dark:bg-slate-800/40 space-y-2.5">
                <div className="text-xs font-extrabold text-[#083578] dark:text-sky-300 uppercase tracking-wide">
                  Ca làm việc Buổi sáng
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="block">
                    <span className="block text-[11px] font-bold text-[#334155] dark:text-slate-300 mb-1">
                      Bắt đầu làm việc
                    </span>
                    <input
                      type="time"
                      value={draft.morningStart}
                      onChange={(e) => setDraft((p) => ({ ...p, morningStart: e.target.value }))}
                      className="w-full px-2.5 py-2 text-sm font-mono font-bold tabular-nums rounded-lg border border-[#B6CBE3] dark:border-slate-700 bg-white dark:bg-slate-950 text-[#0F172A] dark:text-slate-100 focus:outline-none focus:border-[#0D4EA6] focus:ring-2 focus:ring-[#0D4EA6]/25"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-[11px] font-bold text-[#334155] dark:text-slate-300 mb-1">
                      Kết thúc làm việc
                    </span>
                    <input
                      type="time"
                      value={draft.morningEnd}
                      onChange={(e) => setDraft((p) => ({ ...p, morningEnd: e.target.value }))}
                      className="w-full px-2.5 py-2 text-sm font-mono font-bold tabular-nums rounded-lg border border-[#B6CBE3] dark:border-slate-700 bg-white dark:bg-slate-950 text-[#0F172A] dark:text-slate-100 focus:outline-none focus:border-[#0D4EA6] focus:ring-2 focus:ring-[#0D4EA6]/25"
                    />
                  </label>
                </div>
              </div>

              {/* Buổi chiều */}
              <div className="p-3.5 rounded-xl border border-[#C7D6E8] dark:border-slate-800 bg-[#F8FBFF] dark:bg-slate-800/40 space-y-2.5">
                <div className="text-xs font-extrabold text-[#083578] dark:text-sky-300 uppercase tracking-wide">
                  Ca làm việc Buổi chiều
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="block">
                    <span className="block text-[11px] font-bold text-[#334155] dark:text-slate-300 mb-1">
                      Bắt đầu làm việc
                    </span>
                    <input
                      type="time"
                      value={draft.afternoonStart}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, afternoonStart: e.target.value }))
                      }
                      className="w-full px-2.5 py-2 text-sm font-mono font-bold tabular-nums rounded-lg border border-[#B6CBE3] dark:border-slate-700 bg-white dark:bg-slate-950 text-[#0F172A] dark:text-slate-100 focus:outline-none focus:border-[#0D4EA6] focus:ring-2 focus:ring-[#0D4EA6]/25"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-[11px] font-bold text-[#334155] dark:text-slate-300 mb-1">
                      Kết thúc làm việc
                    </span>
                    <input
                      type="time"
                      value={draft.afternoonEnd}
                      onChange={(e) => setDraft((p) => ({ ...p, afternoonEnd: e.target.value }))}
                      className="w-full px-2.5 py-2 text-sm font-mono font-bold tabular-nums rounded-lg border border-[#B6CBE3] dark:border-slate-700 bg-white dark:bg-slate-950 text-[#0F172A] dark:text-slate-100 focus:outline-none focus:border-[#0D4EA6] focus:ring-2 focus:ring-[#0D4EA6]/25"
                    />
                  </label>
                </div>
              </div>
            </div>
          </section>

          {/* 5. Thời lượng chụp & Khoảng giãn cách */}
          <section className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#083578] dark:text-sky-300">
              5. Thời lượng ca chụp &amp; Khoảng cách giữa hai ca
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block p-3.5 rounded-xl border border-[#C7D6E8] dark:border-slate-800 bg-white dark:bg-slate-900">
                <span className="block text-xs font-bold text-[#0F172A] dark:text-slate-200">
                  Thời gian thực hiện ca chụp (phút)
                </span>
                <span className="block text-[11px] text-[#475569] dark:text-slate-400 mt-0.5 mb-2">
                  Dùng để tính TG kết thúc = TG bắt đầu + thời gian thực hiện
                </span>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={draft.scanDuration || ''}
                  onChange={(e) => updateNumber('scanDuration', e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono font-bold tabular-nums rounded-lg border border-[#B6CBE3] dark:border-slate-700 bg-[#F8FBFF] dark:bg-slate-950 text-[#0F172A] dark:text-slate-100 focus:outline-none focus:border-[#0D4EA6] focus:ring-2 focus:ring-[#0D4EA6]/25"
                />
              </label>

              <label className="block p-3.5 rounded-xl border border-[#C7D6E8] dark:border-slate-800 bg-white dark:bg-slate-900">
                <span className="block text-xs font-bold text-[#0F172A] dark:text-slate-200">
                  Khoảng thời gian chính giữa 2 ca (phút)
                </span>
                <span className="block text-[11px] text-[#475569] dark:text-slate-400 mt-0.5 mb-2">
                  Khoảng cách bắt đầu giữa hai ca chụp liên tiếp
                </span>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={draft.primaryInterval || ''}
                  onChange={(e) => updateNumber('primaryInterval', e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono font-bold tabular-nums rounded-lg border border-[#B6CBE3] dark:border-slate-700 bg-[#F8FBFF] dark:bg-slate-950 text-[#0F172A] dark:text-slate-100 focus:outline-none focus:border-[#0D4EA6] focus:ring-2 focus:ring-[#0D4EA6]/25"
                />
              </label>
            </div>

            {/* Khoảng phụ định kỳ */}
            <div className="p-3.5 rounded-xl border border-[#C7D6E8] dark:border-slate-800 bg-[#F8FBFF] dark:bg-slate-800/40 space-y-3">
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <div>
                  <span className="block text-xs sm:text-sm font-bold text-[#0F172A] dark:text-slate-200">
                    Sử dụng khoảng thời gian phụ theo tần suất
                  </span>
                  <span className="block text-[11px] text-[#475569] dark:text-slate-400">
                    Ví dụ: khoảng chính 2 phút và khoảng phụ 3 phút với tần suất 3 ca → cứ 3 bước chuyển ca có 1 bước 3 phút
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={draft.useSecondaryInterval}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, useSecondaryInterval: e.target.checked }))
                  }
                  className="xq-checkbox shrink-0"
                />
              </label>

              {draft.useSecondaryInterval && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#C7D6E8] dark:border-slate-700">
                  <label className="block">
                    <span className="block text-[11px] font-bold text-[#334155] dark:text-slate-300 mb-1">
                      Khoảng phụ (phút)
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={draft.secondaryInterval || ''}
                      onChange={(e) => updateNumber('secondaryInterval', e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono font-bold tabular-nums rounded-lg border border-[#B6CBE3] dark:border-slate-700 bg-white dark:bg-slate-950 text-[#0F172A] dark:text-slate-100 focus:outline-none focus:border-[#0D4EA6] focus:ring-2 focus:ring-[#0D4EA6]/25"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-[11px] font-bold text-[#334155] dark:text-slate-300 mb-1">
                      Tần suất (cứ mỗi N ca áp dụng 1 khoảng phụ)
                    </span>
                    <input
                      type="number"
                      min={2}
                      max={50}
                      value={draft.secondaryFrequency || ''}
                      onChange={(e) => updateNumber('secondaryFrequency', e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono font-bold tabular-nums rounded-lg border border-[#B6CBE3] dark:border-slate-700 bg-white dark:bg-slate-950 text-[#0F172A] dark:text-slate-100 focus:outline-none focus:border-[#0D4EA6] focus:ring-2 focus:ring-[#0D4EA6]/25"
                    />
                  </label>
                </div>
              )}
            </div>
          </section>

          {/* 6. Xem trước & Cảnh báo trùng giờ */}
          <section className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#083578] dark:text-sky-300">
              6. Xem trước khung giờ &amp; Kiểm tra trùng lịch
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {analysis.summaryList.map((s) => (
                <div
                  key={s.machineKey}
                  className="p-3.5 rounded-xl border border-[#C7D6E8] dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-sm text-[#083578] dark:text-sky-300 truncate">
                      {s.machineName}
                    </span>
                    <span className="font-semibold text-[#334155] dark:text-slate-400 whitespace-nowrap shrink-0">
                      {s.isFirst ? `Bắt đầu trước (+${s.offsetMin}p)` : `Bắt đầu sau (+${s.offsetMin}p)`}
                    </span>
                  </div>
                  <div className="space-y-1 font-mono tabular-nums text-[12px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-sans font-semibold text-[#475569] dark:text-slate-400">
                        Sáng ({s.morningCount} ca):
                      </span>
                      <span className="font-bold text-[#0F172A] dark:text-slate-200">
                        {s.firstMorning && s.lastMorning
                          ? `${s.firstMorning} ... ${s.lastMorning}`
                          : 'Không có ca'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-sans font-semibold text-[#475569] dark:text-slate-400">
                        Chiều ({s.afternoonCount} ca):
                      </span>
                      <span className="font-bold text-[#0F172A] dark:text-slate-200">
                        {s.firstAfternoon && s.lastAfternoon
                          ? `${s.firstAfternoon} ... ${s.lastAfternoon}`
                          : 'Không có ca'}
                      </span>
                    </div>
                  </div>
                  {s.sampleMorningStarts.length > 0 && (
                    <div className="pt-1.5 border-t border-[#E2ECF7] dark:border-slate-800 flex items-center gap-1.5 text-[11px] font-mono tabular-nums text-[#334155] dark:text-slate-400 overflow-hidden">
                      <Clock className="w-3.5 h-3.5 text-[#0D4EA6] dark:text-sky-400 shrink-0" />
                      <span className="truncate">{s.sampleMorningStarts.join(' → ')} …</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {analysis.hasConflict ? (
              <div
                role="alert"
                className={`p-4 rounded-xl border ${
                  submitAttempted
                    ? 'border-red-500 bg-red-50 dark:border-red-700 dark:bg-red-950/40'
                    : 'border-red-300 bg-red-50/90 dark:border-red-800/70 dark:bg-red-950/30'
                } text-red-950 dark:text-red-100 space-y-2.5`}
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-1.5 text-xs sm:text-[13px] min-w-0 flex-1">
                    <div className="font-extrabold text-red-800 dark:text-red-200">
                      Cảnh báo: Không thể áp dụng do phát hiện lỗi hoặc trùng giờ giữa các máy
                    </div>

                    {analysis.errors.map((err, i) => (
                      <div key={i} className="font-semibold text-red-800 dark:text-red-200">
                        • {err}
                      </div>
                    ))}

                    {analysis.startCollisions.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <div className="font-bold text-red-800 dark:text-red-200">
                          • Trùng thời gian BẮT ĐẦU ({analysis.startCollisions.length} mốc bị trùng):
                        </div>
                        <ul className="pl-4 space-y-0.5 font-mono text-[11.5px] tabular-nums text-red-900 dark:text-red-200">
                          {analysis.startCollisions.slice(0, 4).map((c) => (
                            <li key={`s-${c.timeMin}`}>{formatCollisionSummary(c)}</li>
                          ))}
                          {analysis.startCollisions.length > 4 && (
                            <li className="font-sans italic">
                              … và {analysis.startCollisions.length - 4} mốc trùng thời gian bắt đầu khác.
                            </li>
                          )}
                        </ul>
                      </div>
                    )}

                    {analysis.endCollisions.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <div className="font-bold text-red-800 dark:text-red-200">
                          • Trùng thời gian KẾT THÚC ({analysis.endCollisions.length} mốc bị trùng):
                        </div>
                        <ul className="pl-4 space-y-0.5 font-mono text-[11.5px] tabular-nums text-red-900 dark:text-red-200">
                          {analysis.endCollisions.slice(0, 4).map((c) => (
                            <li key={`e-${c.timeMin}`}>{formatCollisionSummary(c)}</li>
                          ))}
                          {analysis.endCollisions.length > 4 && (
                            <li className="font-sans italic">
                              … và {analysis.endCollisions.length - 4} mốc trùng thời gian kết thúc khác.
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleApplySafeIntervals}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-red-300 dark:border-red-700 bg-white dark:bg-slate-900 text-red-800 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Gợi ý giãn cách không trùng (2p / phụ 3p mỗi 3 ca)</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 p-3.5 rounded-xl border border-emerald-300 bg-emerald-50/90 dark:border-emerald-800/60 dark:bg-emerald-950/30 text-xs sm:text-[13px] font-semibold text-emerald-900 dark:text-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <span>
                  Hợp lệ: Không có ca nào bị trùng thời gian bắt đầu hoặc thời gian kết thúc giữa các máy.
                </span>
              </div>
            )}
          </section>

          {/* Footer actions */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-[#C7D6E8] dark:border-slate-800">
            <button
              type="button"
              onClick={handleResetDefaults}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg border border-[#C7D6E8] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#334155] dark:text-slate-300 hover:bg-[#EEF4FB] dark:hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Khôi phục mặc định</span>
            </button>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-[#C7D6E8] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#0F172A] dark:text-slate-200 hover:bg-[#EEF4FB] dark:hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving || analysis.hasConflict}
                className="px-4 py-2 text-sm font-bold rounded-lg bg-[#0D4EA6] hover:bg-[#083578] text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
