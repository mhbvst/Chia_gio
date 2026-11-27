import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  CheckSquare,
  Clock3,
  LocateFixed,
  Minus,
  PictureInPicture2,
  Plus,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { MachineConfig, ScheduleRow } from '../data/schedules';
import { countCheckedSlotsInRows, countTotalSlots } from '../utils/scheduleGenerator';
import {
  describeLastPickOffsetVN,
  formatDateDisplayVN,
  formatTimeVN,
  getVNNowParts,
  nowSecondsVN,
  parseHHMM,
} from '../utils/vnTime';

export type TableRowSpacing = 'compact' | 'standard' | 'spacious';
export type TableFontWeight = 400 | 500 | 600 | 700 | 800;

export interface TableDisplaySettings {
  rowSpacing: TableRowSpacing;
  fontSize: number;
  fontWeight: TableFontWeight;
}

export const DEFAULT_TABLE_DISPLAY_SETTINGS: TableDisplaySettings = {
  rowSpacing: 'compact',
  fontSize: 14,
  fontWeight: 700,
};

export interface ScheduleTableHandle {
  jumpToNow: () => void;
  scrollToSlot: (stt: number, session: 'm' | 'a') => void;
}

interface ScheduleTableProps {
  machine: MachineConfig;
  slots: Record<string, boolean>;
  isToday: boolean;
  isReadOnly: boolean;
  loading: boolean;
  displaySettings: TableDisplaySettings;
  mobileSegment: 'morning' | 'afternoon';
  viewedDateKey: string;
  nowTick: number;
  lastPickedStart: string | null;
  lastPickTone?: 'empty' | 'neutral' | 'now' | 'past' | 'overdue' | 'upcoming';
  floatingClockOpen?: boolean;
  pendingSlots: Record<string, boolean>;
  onSlotClick: (row: ScheduleRow, session: 'm' | 'a', nextChecked: boolean) => void;
  onChangeDisplaySettings: (next: React.SetStateAction<TableDisplaySettings>) => void;
  onSwitchMobileSegment?: (seg: 'morning' | 'afternoon') => void;
  onToggleFloatingClock?: () => void;
  onRequestQuickPick?: () => void;
}

export const ScheduleTable = forwardRef<ScheduleTableHandle, ScheduleTableProps>(({
  machine,
  slots,
  isToday,
  isReadOnly,
  loading,
  displaySettings,
  mobileSegment,
  viewedDateKey,
  nowTick,
  lastPickedStart,
  lastPickTone = 'empty',
  floatingClockOpen = false,
  pendingSlots,
  onSlotClick,
  onChangeDisplaySettings,
  onSwitchMobileSegment,
  onToggleFloatingClock,
  onRequestQuickPick,
}, ref) => {
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const cardShellRef = useRef<HTMLElement | null>(null);
  const theadRef = useRef<HTMLTableSectionElement | null>(null);
  const grpRowRef = useRef<HTMLTableRowElement | null>(null);
  const rowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});
  const displayMenuRef = useRef<HTMLDivElement | null>(null);
  const [grpHeight, setGrpHeight] = useState<number>(33);
  const [pendingScrollStt, setPendingScrollStt] = useState<number | null>(null);
  const [flashStt, setFlashStt] = useState<number | null>(null);
  const [displayMenuOpen, setDisplayMenuOpen] = useState(false);

  useEffect(() => {
    if (!displayMenuOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (displayMenuRef.current && !displayMenuRef.current.contains(e.target as Node)) {
        setDisplayMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDisplayMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [displayMenuOpen]);

  useEffect(() => {
    const grpEl = grpRowRef.current;
    if (!grpEl) return;
    const syncHeights = () => {
      const gh = Math.floor(grpEl.getBoundingClientRect().height);
      if (gh > 0) setGrpHeight(gh);
    };
    syncHeights();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(syncHeights);
      ro.observe(grpEl);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', syncHeights);
    return () => window.removeEventListener('resize', syncHeights);
  }, [loading]);

  // Khi cuộn xuống từ bên trong bảng: cuộn thanh cuộn bên ngoài xuống hết mượt mà trước, rồi mới cuộn bảng bên trong
  useEffect(() => {
    const inner = tableScrollRef.current;
    if (!inner) return;

    const getOuter = () =>
      inner.closest('[data-outer-scroll="true"]') as HTMLElement | null;

    let rafId: number | null = null;
    let lastTs = 0;
    let smoothTop = 0;
    let targetTop = 0;
    let lastWrittenTop = -1;
    let pendingInner = 0;

    const stopAnim = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      pendingInner = 0;
      lastWrittenTop = -1;
    };

    const stepAnim = (ts: number) => {
      const outer = getOuter();
      if (!outer) {
        stopAnim();
        return;
      }

      // Nếu người dùng tự kéo thanh cuộn ngoài trong lúc đang chạy hiệu ứng, dừng ngay để tránh giật
      if (lastWrittenTop >= 0 && Math.abs(outer.scrollTop - lastWrittenTop) > 3) {
        stopAnim();
        return;
      }

      const dt = lastTs > 0 ? Math.min(0.05, (ts - lastTs) / 1000) : 1 / 60;
      lastTs = ts;

      const maxOuterTop = Math.max(0, outer.scrollHeight - outer.clientHeight);
      if (targetTop > maxOuterTop) targetTop = maxOuterTop;

      const diff = targetTop - smoothTop;
      if (Math.abs(diff) <= 0.6) {
        outer.scrollTop = targetTop;
        const leftover = pendingInner;
        stopAnim();
        if (leftover > 0) {
          inner.scrollTop += leftover;
        }
        return;
      }

      // Nội suy hàm mũ chuẩn hóa theo thời gian (mượt đều trên cả 60Hz và 120Hz)
      const factor = 1 - Math.exp(-20 * dt);
      smoothTop += diff * factor;
      outer.scrollTop = smoothTop;
      lastWrittenTop = outer.scrollTop;
      rafId = window.requestAnimationFrame(stepAnim);
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16;
      else if (e.deltaMode === 2) dy *= inner.clientHeight;
      if (dy === 0) return;

      let dx = e.deltaX;
      if (e.deltaMode === 1) dx *= 16;
      else if (e.deltaMode === 2) dx *= inner.clientWidth;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dy) < 2) return;

      const outer = getOuter();
      if (!outer) return;

      // Nếu đảo chiều cuộn lên trong lúc ngoại đang trượt xuống, dừng mượt để phản hồi ngay
      if (dy < 0) {
        stopAnim();
        return;
      }

      const maxOuterTop = Math.max(0, outer.scrollHeight - outer.clientHeight);
      const currentTarget = rafId !== null ? targetTop : outer.scrollTop;
      const remOuterDown = maxOuterTop - currentTarget;

      if (remOuterDown > 1 || (rafId !== null && outer.scrollTop < maxOuterTop - 1)) {
        e.preventDefault();
        if (rafId === null) {
          smoothTop = outer.scrollTop;
          targetTop = outer.scrollTop;
          lastWrittenTop = outer.scrollTop;
          lastTs = 0;
        }
        const addOuter = Math.min(dy, Math.max(0, maxOuterTop - targetTop));
        targetTop += addOuter;
        const leftover = dy - addOuter;
        if (leftover > 0) {
          pendingInner += leftover;
        }
        if (rafId === null) {
          rafId = window.requestAnimationFrame(stepAnim);
        }
      }
    };

    let lastTouchY: number | null = null;
    const handleTouchStart = (e: TouchEvent) => {
      stopAnim();
      lastTouchY = e.touches.length === 1 ? e.touches[0].clientY : null;
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1 || lastTouchY === null) return;
      const curY = e.touches[0].clientY;
      const dy = lastTouchY - curY;
      lastTouchY = curY;
      if (dy <= 0) return;

      const outer = getOuter();
      if (!outer) return;

      const maxOuterTop = Math.max(0, outer.scrollHeight - outer.clientHeight);
      const remOuterDown = maxOuterTop - outer.scrollTop;
      if (remOuterDown > 1) {
        if (e.cancelable) e.preventDefault();
        const moveOuter = Math.min(dy, remOuterDown);
        outer.scrollTop += moveOuter;
        const leftover = dy - moveOuter;
        if (leftover > 0) {
          inner.scrollTop += leftover;
        }
      }
    };
    const handleTouchEnd = () => {
      lastTouchY = null;
    };

    inner.addEventListener('wheel', handleWheel, { passive: false });
    inner.addEventListener('touchstart', handleTouchStart, { passive: true });
    inner.addEventListener('touchmove', handleTouchMove, { passive: false });
    inner.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      stopAnim();
      inner.removeEventListener('wheel', handleWheel);
      inner.removeEventListener('touchstart', handleTouchStart);
      inner.removeEventListener('touchmove', handleTouchMove);
      inner.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  const rows = machine.rows;

  // Tìm giờ bắt đầu gần nhất đã qua (<= giờ Việt Nam hiện tại) — chỉ áp dụng khi xem ngày hôm nay
  const nearestNowCell = useMemo<{ stt: number; session: 'm' | 'a' } | null>(() => {
    if (!isToday) return null;
    void nowTick;
    const nowSec = nowSecondsVN();
    let best: { diff: number; stt: number; session: 'm' | 'a' } | null = null;

    for (const r of rows) {
      const mMin = parseHHMM(r.morningStart);
      if (mMin !== null && mMin * 60 <= nowSec) {
        const diff = nowSec - mMin * 60;
        if (!best || diff < best.diff) best = { diff, stt: r.stt, session: 'm' };
      }
      const aMin = parseHHMM(r.afternoonStart);
      if (aMin !== null && aMin * 60 <= nowSec) {
        const diff = nowSec - aMin * 60;
        if (!best || diff < best.diff) best = { diff, stt: r.stt, session: 'a' };
      }
    }
    return best ? { stt: best.stt, session: best.session } : null;
  }, [rows, isToday, nowTick]);

  // Vị trí mục tiêu khi nhấn "Tới ca hiện tại" (tính trên toàn bộ danh sách ca của máy)
  const jumpTarget = useMemo<{ stt: number; session: 'm' | 'a' } | null>(() => {
    if (!isToday || machine.rows.length === 0) return null;
    void nowTick;
    const nowSec = nowSecondsVN();
    let best: { diff: number; stt: number; session: 'm' | 'a' } | null = null;

    for (const r of machine.rows) {
      const mMin = parseHHMM(r.morningStart);
      if (mMin !== null && mMin * 60 <= nowSec) {
        const diff = nowSec - mMin * 60;
        if (!best || diff < best.diff) best = { diff, stt: r.stt, session: 'm' };
      }
      const aMin = parseHHMM(r.afternoonStart);
      if (aMin !== null && aMin * 60 <= nowSec) {
        const diff = nowSec - aMin * 60;
        if (!best || diff < best.diff) best = { diff, stt: r.stt, session: 'a' };
      }
    }
    // Nếu trước ca đầu tiên trong ngày (trước 07:30), cuộn tới ca 1 buổi sáng
    return best
      ? { stt: best.stt, session: best.session }
      : { stt: machine.rows[0].stt, session: 'm' };
  }, [isToday, machine.rows, nowTick]);

  const scrollToRow = (stt: number) => {
    const container = tableScrollRef.current;
    const rowEl = rowRefs.current[stt];
    if (!container || !rowEl) return;

    cardShellRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });

    const theadHeight = theadRef.current?.offsetHeight || 72;
    const containerRect = container.getBoundingClientRect();
    const rowRect = rowEl.getBoundingClientRect();
    const rowOffsetInContainer = container.scrollTop + (rowRect.top - containerRect.top);
    const visibleBodyHeight = Math.max(120, container.clientHeight - theadHeight);
    const targetTop =
      rowOffsetInContainer - theadHeight - visibleBodyHeight / 2 + rowRect.height / 2;

    container.scrollTo({
      top: Math.max(0, targetTop),
      behavior: 'smooth',
    });

    setFlashStt(stt);
    window.setTimeout(() => {
      setFlashStt((prev) => (prev === stt ? null : prev));
    }, 1800);
  };

  useEffect(() => {
    if (pendingScrollStt === null) return;
    const id = window.requestAnimationFrame(() => {
      scrollToRow(pendingScrollStt);
      setPendingScrollStt(null);
    });
    return () => window.cancelAnimationFrame(id);
  }, [pendingScrollStt, rows, mobileSegment]);

  const handleJumpToNow = () => {
    if (!jumpTarget) return;
    const targetSession = jumpTarget.session === 'm' ? 'morning' : 'afternoon';
    if (onSwitchMobileSegment && mobileSegment !== targetSession) {
      onSwitchMobileSegment(targetSession);
    }

    if (rowRefs.current[jumpTarget.stt]) {
      scrollToRow(jumpTarget.stt);
    } else {
      setPendingScrollStt(jumpTarget.stt);
    }
  };

  const scrollToSlot = (stt: number, session: 'm' | 'a') => {
    const targetSession = session === 'm' ? 'morning' : 'afternoon';
    if (onSwitchMobileSegment && mobileSegment !== targetSession) {
      onSwitchMobileSegment(targetSession);
    }
    if (rowRefs.current[stt]) {
      scrollToRow(stt);
    } else {
      setPendingScrollStt(stt);
    }
  };

  const imperativeHandlersRef = useRef({ handleJumpToNow, scrollToSlot });
  imperativeHandlersRef.current = { handleJumpToNow, scrollToSlot };

  useImperativeHandle(
    ref,
    () => ({
      jumpToNow: () => imperativeHandlersRef.current.handleJumpToNow(),
      scrollToSlot: (stt, session) => imperativeHandlersRef.current.scrollToSlot(stt, session),
    }),
    []
  );

  const totalSelectable = useMemo(() => countTotalSlots(rows), [rows]);
  const { morningCount, afternoonCount } = useMemo(() => {
    let mCnt = 0;
    let aCnt = 0;
    for (const r of rows) {
      if (r.morningStart) mCnt++;
      if (r.afternoonStart) aCnt++;
    }
    return { morningCount: mCnt, afternoonCount: aCnt };
  }, [rows]);
  const mobileRowCount = mobileSegment === 'morning' ? morningCount : afternoonCount;
  const totalChecked = useMemo(
    () => countCheckedSlotsInRows(rows, slots).totalChecked,
    [rows, slots]
  );

  const nowDateObj = new Date(nowTick);
  const liveClockVN = formatTimeVN(nowDateObj);
  const vnPartsNow = getVNNowParts(nowDateObj);
  const liveDateVN = `${String(vnPartsNow.dd).padStart(2, '0')}/${String(vnPartsNow.mm).padStart(2, '0')}/${vnPartsNow.yy}`;
  const liveShiftVN = vnPartsNow.hh >= 12 ? 'Ca chiều' : 'Ca sáng';
  const pickTelemetry = describeLastPickOffsetVN(
    lastPickedStart,
    isToday,
    viewedDateKey,
    nowDateObj
  );
  const lastPickColorClass = !lastPickedStart
    ? 'text-slate-400 dark:text-slate-500'
    : lastPickTone === 'upcoming'
    ? 'text-[#16A34A] dark:text-[#22C55E]'
    : lastPickTone === 'past' || lastPickTone === 'now'
    ? 'text-[#CA8A04] dark:text-[#FACC15]'
    : lastPickTone === 'overdue'
    ? 'text-[#DC2626] dark:text-[#F87171]'
    : 'text-[#0F172A] dark:text-slate-50';
  const lastPickMetaClass = !lastPickedStart
    ? 'text-[#64748B] dark:text-slate-500'
    : lastPickTone === 'upcoming'
    ? 'text-[#15803D] dark:text-[#4ADE80]'
    : lastPickTone === 'past' || lastPickTone === 'now'
    ? 'text-[#B45309] dark:text-[#FACC15]'
    : lastPickTone === 'overdue'
    ? 'text-[#B91C1C] dark:text-[#F87171]'
    : 'text-[#334155] dark:text-slate-400';

  const rowSpacingMeta =
    displaySettings.rowSpacing === 'compact'
      ? { py: 4, px: 10, minH: 30, lineHeight: 1.2, label: 'Gọn' }
      : displaySettings.rowSpacing === 'spacious'
      ? { py: 12, px: 14, minH: 48, lineHeight: 1.55, label: 'Thoáng' }
      : { py: 8, px: 12, minH: 38, lineHeight: 1.35, label: 'Chuẩn' };

  const clampedFontSize = Math.min(22, Math.max(12, Math.round(displaySettings.fontSize || 14)));
  const activeFontWeight = displaySettings.fontWeight || 700;
  const sttFontSize = Math.max(11, clampedFontSize - 1);

  const cellBaseStyle: React.CSSProperties = {
    paddingTop: `${rowSpacingMeta.py}px`,
    paddingBottom: `${rowSpacingMeta.py}px`,
    paddingLeft: `${rowSpacingMeta.px}px`,
    paddingRight: `${rowSpacingMeta.px}px`,
    fontSize: `${clampedFontSize}px`,
    fontWeight: activeFontWeight,
    lineHeight: rowSpacingMeta.lineHeight,
  };

  const sttCellStyle: React.CSSProperties = {
    paddingTop: `${rowSpacingMeta.py}px`,
    paddingBottom: `${rowSpacingMeta.py}px`,
    paddingLeft: `${rowSpacingMeta.px}px`,
    paddingRight: `${rowSpacingMeta.px}px`,
    fontSize: `${sttFontSize}px`,
    fontWeight: activeFontWeight,
    lineHeight: rowSpacingMeta.lineHeight,
  };

  const hideMorningMobile = mobileSegment === 'afternoon' ? 'hidden md:table-cell print-show-col' : '';
  const hideAfternoonMobile = mobileSegment === 'morning' ? 'hidden md:table-cell print-show-col' : '';

  const isCustomDisplay =
    displaySettings.rowSpacing !== DEFAULT_TABLE_DISPLAY_SETTINGS.rowSpacing ||
    clampedFontSize !== DEFAULT_TABLE_DISPLAY_SETTINGS.fontSize ||
    activeFontWeight !== DEFAULT_TABLE_DISPLAY_SETTINGS.fontWeight;

  return (
    <section
      ref={cardShellRef}
      id={machine.id}
      role="tabpanel"
      aria-label={machine.fullTitle}
      className="print-card-shell bg-white dark:bg-slate-900 border border-[#C7D6E8] dark:border-slate-800 rounded-xl shadow-[0_2px_6px_rgba(8,53,120,0.06)]"
    >
      {/* Print-only hospital header */}
      <div className="hidden print-only px-4 pt-3 pb-2 border-b border-slate-400">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h2 className="text-base font-bold uppercase text-[#083578]">
              {machine.fullTitle}
            </h2>
            <p className="text-xs font-medium text-[#0F172A] mt-0.5">
              Người phụ trách: {machine.supervisor} · Ngày lịch: {formatDateDisplayVN(viewedDateKey)}
            </p>
          </div>
          <div className="text-xs font-bold text-[#0F172A] tabular-nums">
            Đã chọn: {totalChecked} / {totalSelectable} ca
          </div>
        </div>
      </div>

      {/* Table toolbar header */}
      <div className="no-print relative z-30 rounded-t-xl flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 px-4 sm:px-5 py-3 border-b border-[#C7D6E8] dark:border-slate-800 bg-white dark:bg-slate-900">
        {/* Left: Machine identity + single-line action controls */}
        <div className={`min-w-0 space-y-2 ${floatingClockOpen ? 'w-full' : ''}`}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#334155] dark:text-slate-400">
              <span className="font-bold text-[#0D4EA6] dark:text-sky-400">Chẩn đoán hình ảnh</span>
              <span aria-hidden="true">·</span>
              <span>Phụ trách: {machine.supervisor}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono font-bold tabular-nums text-[#0F172A] dark:text-slate-300">
                <span className="md:hidden">
                  {mobileRowCount} ca ({mobileSegment === 'morning' ? 'Sáng' : 'Chiều'})
                </span>
                <span className="hidden md:inline">
                  {rows.length} hàng · Sáng {morningCount} / Chiều {afternoonCount} ca
                </span>
              </span>
            </div>
            <h2 className="text-base sm:text-[17px] font-extrabold tracking-tight text-[#083578] dark:text-slate-100 mt-0.5 truncate">
              {machine.fullTitle}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isToday && jumpTarget && !loading && (
              <button
                type="button"
                onClick={handleJumpToNow}
                title="Tự động cuộn tới vị trí thời gian hiện tại (Phím G)"
                className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-bold rounded-lg border border-[#93BCEB] dark:border-sky-800 bg-[#DCEBFF] dark:bg-sky-950/50 text-[#083578] dark:text-sky-200 hover:bg-[#C6DFFF] dark:hover:bg-sky-900/60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <LocateFixed className="w-3.5 h-3.5 text-[#0D4EA6] dark:text-sky-400 shrink-0" />
                <span>Tới ca hiện tại</span>
                <kbd className="hidden sm:inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-mono font-extrabold leading-none rounded border border-[#93BCEB] dark:border-sky-700 bg-white/90 dark:bg-sky-900/70 text-[#083578] dark:text-sky-200">
                  G
                </kbd>
              </button>
            )}
            {isToday && !isReadOnly && !loading && onRequestQuickPick && (
              <button
                type="button"
                onClick={onRequestQuickPick}
                title="Chọn nhanh giờ bắt đầu trống gần nhất, ưu tiên phút hiện tại nếu chưa được đánh dấu (Phím T)"
                className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-bold rounded-lg border border-[#86EFAC] dark:border-emerald-800 bg-[#ECFDF5] dark:bg-emerald-950/45 text-[#047857] dark:text-emerald-200 hover:bg-[#D1FAE5] dark:hover:bg-emerald-900/50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <CheckSquare className="w-3.5 h-3.5 text-[#059669] dark:text-emerald-400 shrink-0" />
                <span>Chọn nhanh trống</span>
                <kbd className="hidden sm:inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-mono font-extrabold leading-none rounded border border-[#86EFAC] dark:border-emerald-700 bg-white/90 dark:bg-emerald-900/60 text-[#047857] dark:text-emerald-200">
                  T
                </kbd>
              </button>
            )}

            {/* Display Settings Popover Control */}
            <div className="relative" ref={displayMenuRef}>
              <button
                type="button"
                onClick={() => setDisplayMenuOpen((o) => !o)}
                aria-expanded={displayMenuOpen}
                aria-haspopup="dialog"
                title={`Điều chỉnh hiển thị (${rowSpacingMeta.label} · ${clampedFontSize}px · ${activeFontWeight})`}
                className={`inline-flex items-center gap-1.5 h-9 px-3 text-xs font-bold rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  displayMenuOpen || isCustomDisplay
                    ? 'border-[#0D4EA6] dark:border-sky-500 bg-[#EEF5FF] dark:bg-sky-950/60 text-[#083578] dark:text-sky-200'
                    : 'border-[#B6CBE3] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#0F172A] dark:text-slate-200 hover:bg-[#EEF4FB] dark:hover:bg-slate-700/70'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#0D4EA6] dark:text-sky-400 shrink-0" />
                <span>Cài đặt hiển thị</span>
                {isCustomDisplay && (
                  <span className="font-mono text-[10.5px] font-bold tabular-nums text-[#0D4EA6] dark:text-sky-300">
                    ({clampedFontSize}px)
                  </span>
                )}
              </button>

              {displayMenuOpen && (
                <div
                  role="dialog"
                  aria-label="Cài đặt hiển thị bảng lịch"
                  className="absolute left-0 sm:left-auto sm:right-0 xl:left-0 xl:right-auto mt-2 w-[min(336px,calc(100vw-2rem))] rounded-xl border border-[#B6CBE3] dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-4 z-50 space-y-4"
                >
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#E2ECF7] dark:border-slate-800">
                    <div>
                      <div className="text-sm font-extrabold text-[#083578] dark:text-slate-100">
                        Cài đặt hiển thị
                      </div>
                      <div className="text-[11px] font-medium text-[#475569] dark:text-slate-400">
                        Tự động lưu theo trình duyệt này
                      </div>
                    </div>
                    {isCustomDisplay && (
                      <button
                        type="button"
                        onClick={() => onChangeDisplaySettings(DEFAULT_TABLE_DISPLAY_SETTINGS)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold text-[#0D4EA6] dark:text-sky-300 hover:bg-[#EEF4FB] dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Mặc định</span>
                      </button>
                    )}
                  </div>

                  {/* 1. Độ giãn dòng */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#0F172A] dark:text-slate-200">
                        Độ giãn dòng
                      </span>
                      <span className="font-mono font-bold text-[#0D4EA6] dark:text-sky-300 tabular-nums">
                        {rowSpacingMeta.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#EEF4FB] dark:bg-slate-800 border border-[#C7D6E8] dark:border-slate-700">
                      {(
                        [
                          { id: 'compact', label: 'Gọn' },
                          { id: 'standard', label: 'Chuẩn' },
                          { id: 'spacious', label: 'Thoáng' },
                        ] as const
                      ).map((opt) => {
                        const active = displaySettings.rowSpacing === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() =>
                              onChangeDisplaySettings((prev) => ({
                                ...prev,
                                rowSpacing: opt.id,
                              }))
                            }
                            aria-pressed={active}
                            className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                              active
                                ? 'bg-[#0D4EA6] text-white shadow-xs'
                                : 'text-[#334155] dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Kích thước chữ */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#0F172A] dark:text-slate-200">
                        Kích thước chữ
                      </span>
                      <span className="font-mono font-extrabold text-[#0D4EA6] dark:text-sky-300 tabular-nums">
                        {clampedFontSize}px
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onChangeDisplaySettings((prev) => ({
                            ...prev,
                            fontSize: Math.max(12, Math.round(prev.fontSize || 14) - 1),
                          }))
                        }
                        disabled={clampedFontSize <= 12}
                        aria-label="Giảm kích thước chữ"
                        className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-[#C7D6E8] dark:border-slate-700 bg-[#F8FBFF] dark:bg-slate-800 text-[#0F172A] dark:text-slate-200 hover:bg-[#DCEBFF] dark:hover:bg-slate-700 disabled:opacity-40 cursor-pointer shrink-0"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="range"
                        min={12}
                        max={22}
                        step={1}
                        value={clampedFontSize}
                        onChange={(e) => {
                          const nextSize = Number(e.target.value);
                          onChangeDisplaySettings((prev) => ({
                            ...prev,
                            fontSize: nextSize,
                          }));
                        }}
                        aria-label="Thanh trượt kích thước chữ"
                        className="flex-1 accent-[#0D4EA6] dark:accent-sky-400 cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          onChangeDisplaySettings((prev) => ({
                            ...prev,
                            fontSize: Math.min(22, Math.round(prev.fontSize || 14) + 1),
                          }))
                        }
                        disabled={clampedFontSize >= 22}
                        aria-label="Tăng kích thước chữ"
                        className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-[#C7D6E8] dark:border-slate-700 bg-[#F8FBFF] dark:bg-slate-800 text-[#0F172A] dark:text-slate-200 hover:bg-[#DCEBFF] dark:hover:bg-slate-700 disabled:opacity-40 cursor-pointer shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 3. Độ đậm của ký tự */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#0F172A] dark:text-slate-200">
                        Độ đậm ký tự
                      </span>
                      <span className="font-mono font-bold text-[#0D4EA6] dark:text-sky-300 tabular-nums">
                        {activeFontWeight}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-[#EEF4FB] dark:bg-slate-800 border border-[#C7D6E8] dark:border-slate-700">
                      {(
                        [
                          { val: 400, label: 'Thường' },
                          { val: 500, label: 'Vừa' },
                          { val: 700, label: 'Đậm' },
                          { val: 800, label: 'Rất đậm' },
                        ] as const
                      ).map((opt) => {
                        const active = activeFontWeight === opt.val;
                        return (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() =>
                              onChangeDisplaySettings((prev) => ({
                                ...prev,
                                fontWeight: opt.val,
                              }))
                            }
                            aria-pressed={active}
                            style={{ fontWeight: opt.val }}
                            className={`px-2 py-1.5 rounded-md text-xs transition-colors cursor-pointer whitespace-nowrap ${
                              active
                                ? 'bg-[#0D4EA6] text-white shadow-xs'
                                : 'text-[#334155] dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {floatingClockOpen && onToggleFloatingClock && (
              <button
                type="button"
                onClick={onToggleFloatingClock}
                aria-pressed={true}
                title="Đóng cửa sổ đồng hồ nổi và hiện lại đồng hồ gốc (Phím H)"
                className="md:ml-auto inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-xs font-bold border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <PictureInPicture2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Đóng đồng hồ nổi · Hiện đồng hồ</span>
                <kbd className="hidden sm:inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-mono font-extrabold leading-none rounded border border-emerald-300 dark:border-emerald-700 bg-white/85 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                  H
                </kbd>
              </button>
            )}
          </div>
        </div>

        {/* Right: Balanced clinical dual-time console (hidden when floating clock is open) */}
        {!floatingClockOpen && (
          <div
            className="w-full xl:w-auto xl:ml-auto shrink-0 rounded-lg border border-[#C7D6E8] dark:border-slate-700/80 bg-white dark:bg-[#0B1220] shadow-[0_2px_8px_rgba(8,53,120,0.08)] dark:shadow-[0_4px_16px_rgba(2,6,23,0.4)] overflow-hidden"
            title="Giờ bắt đầu của ca chụp đã chọn sau cùng và đồng hồ thời gian thực (Giờ Việt Nam)"
            aria-label="Giờ bắt đầu của ca chụp đã chọn sau cùng và đồng hồ thời gian thực"
          >
            <div className="flex items-center justify-between gap-4 px-3.5 sm:px-4 py-1.5 border-b border-[#C7D6E8] dark:border-slate-800/90 bg-[#E8F1FC] dark:bg-[#111A2E]">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-[#083578] dark:text-slate-200 whitespace-nowrap min-w-0">
                <Clock3 className="w-3.5 h-3.5 text-[#0D4EA6] dark:text-[#38BDF8] shrink-0" aria-hidden="true" />
                <span className="uppercase">Đồng hồ ca chụp</span>
                <span className="hidden sm:inline font-semibold text-[#475569] dark:text-slate-400" aria-hidden="true">
                  ·
                </span>
                <span className="hidden sm:inline font-semibold text-[#334155] dark:text-slate-400 truncate">
                  {isToday ? liveShiftVN : `Ngày ${formatDateDisplayVN(viewedDateKey)}`}
                </span>
              </div>
              {onToggleFloatingClock && (
                <button
                  type="button"
                  onClick={onToggleFloatingClock}
                  aria-pressed={false}
                  title="Chuyển đồng hồ thành cửa sổ nổi luôn hiển thị (Phím H)"
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11.5px] font-bold border border-[#93BCEB] dark:border-sky-400/35 bg-white dark:bg-sky-500/15 hover:bg-[#DCEBFF] dark:hover:bg-sky-500/25 text-[#083578] dark:text-sky-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <PictureInPicture2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Đồng hồ nổi</span>
                  <kbd className="hidden sm:inline-flex items-center justify-center px-1 py-0.5 text-[9.5px] font-mono font-extrabold leading-none rounded border border-[#93BCEB] dark:border-sky-400/40 bg-[#F4F8FF] dark:bg-slate-900/70 text-[#083578] dark:text-sky-200">
                    H
                  </kbd>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 divide-x divide-[#C7D6E8] dark:divide-slate-800">
              <div className="px-3.5 sm:px-4 py-2.5 flex flex-col justify-center min-w-[164px] sm:min-w-[214px] bg-white dark:bg-transparent">
                <div className="flex items-center justify-between gap-2 text-[11px] leading-tight">
                  <span className="font-semibold text-[#475569] dark:text-slate-400 whitespace-nowrap">
                    Đã chọn sau cùng
                  </span>
                  <span
                    className={`hidden sm:inline font-bold whitespace-nowrap truncate ${lastPickMetaClass}`}
                  >
                    {pickTelemetry.statusLabel}
                  </span>
                </div>
                <div className="mt-1.5 flex items-baseline justify-between gap-2.5">
                  <div
                    className={`font-mono text-[26px] sm:text-[32px] xl:text-[34px] leading-none font-extrabold tabular-nums tracking-tight ${lastPickColorClass}`}
                  >
                    {lastPickedStart || '--:--'}
                  </div>
                  <div
                    className={`font-mono text-[11.5px] sm:text-xs font-bold tabular-nums whitespace-nowrap ${lastPickMetaClass}`}
                  >
                    {pickTelemetry.deltaLabel}
                  </div>
                </div>
              </div>

              <div className="px-3.5 sm:px-4 py-2.5 flex flex-col justify-center min-w-[172px] sm:min-w-[228px] bg-[#F4F8FF] dark:bg-slate-900/55">
                <div className="flex items-center justify-between gap-2 text-[11px] leading-tight">
                  <span className="font-semibold text-[#0D4EA6] dark:text-sky-300/90 whitespace-nowrap">
                    Giờ hiện tại (VN)
                  </span>
                  <span className="hidden sm:inline font-semibold text-[#475569] dark:text-slate-400 whitespace-nowrap">
                    {liveShiftVN} · UTC+7
                  </span>
                </div>
                <div className="mt-1.5 flex items-baseline justify-between gap-2.5">
                  <div className="font-mono text-[26px] sm:text-[32px] xl:text-[34px] leading-none font-extrabold tabular-nums tracking-tight text-[#083578] dark:text-[#38BDF8]">
                    {liveClockVN}
                  </div>
                  <div className="hidden md:inline font-mono text-[11.5px] sm:text-xs font-semibold tabular-nums text-[#334155] dark:text-slate-400 whitespace-nowrap">
                    {liveDateVN}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dedicated vertically scrollable Schedule Table */}
      <div
        ref={tableScrollRef}
        className={`print-table-wrap dual-scroll ${
          floatingClockOpen
            ? 'h-[calc(100dvh-216px)] md:h-[calc(100dvh-178px)]'
            : 'h-[calc(100dvh-196px)] xl:h-[calc(100dvh-208px)]'
        } ${rows.length === 0 || loading ? 'rounded-b-xl' : ''} min-h-[360px] max-h-[1200px] overflow-y-auto overflow-x-auto bg-white dark:bg-slate-900`}
      >
        {loading ? (
          <div className="p-4 space-y-2" aria-busy="true" aria-label="Đang tải dữ liệu lịch chụp">
            {Array.from({ length: 10 }).map((_, idx) => (
              <div
                key={idx}
                className="h-10 rounded-lg bg-[#EEF4FB] dark:bg-slate-800/70 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <table
            className="xq-print-table w-full border-separate border-spacing-0"
            data-machine={machine.name}
          >
            <colgroup>
              <col className="w-[10%] md:w-[8%]" />
              <col className={`w-[32%] md:w-[17%] ${hideMorningMobile}`} />
              <col className={`w-[32%] md:w-[17%] ${hideMorningMobile}`} />
              <col className={`w-[26%] md:w-[8%] ${hideMorningMobile}`} />
              <col className={`w-[32%] md:w-[17%] ${hideAfternoonMobile}`} />
              <col className={`w-[32%] md:w-[17%] ${hideAfternoonMobile}`} />
              <col className={`w-[26%] md:w-[8%] ${hideAfternoonMobile}`} />
            </colgroup>
            <thead ref={theadRef}>
              <tr ref={grpRowRef}>
                <th
                  rowSpan={2}
                  style={{ top: 0 }}
                  className="sticky z-20 bg-[#DCEBFF] dark:bg-slate-800 text-[#083578] dark:text-slate-200 text-xs font-extrabold uppercase tracking-wider px-3 py-2.5 border-b border-r-2 border-r-[#94B0CE] border-b-[#B6CBE3] dark:border-b-slate-700 dark:border-r-slate-700 text-center"
                >
                  STT
                </th>
                <th
                  colSpan={3}
                  style={{ top: 0 }}
                  className={`sticky z-20 bg-[#D0E4FF] dark:bg-sky-950 text-[#083578] dark:text-sky-200 text-xs leading-4 font-extrabold uppercase tracking-wider px-3 py-2 border-b border-r-2 border-r-[#94B0CE] border-b-[#B6CBE3] dark:border-b-slate-700 dark:border-r-slate-700 text-center ${hideMorningMobile}`}
                >
                  BUỔI SÁNG
                </th>
                <th
                  colSpan={3}
                  style={{ top: 0 }}
                  className={`sticky z-20 bg-[#DCEBFF] dark:bg-blue-950 text-[#083578] dark:text-blue-200 text-xs leading-4 font-extrabold uppercase tracking-wider px-3 py-2 border-b border-[#B6CBE3] dark:border-slate-700 text-center ${hideAfternoonMobile}`}
                >
                  BUỔI CHIỀU
                </th>
              </tr>
              <tr>
                <th
                  style={{ top: grpHeight }}
                  className={`sticky z-20 bg-[#EEF5FF] dark:bg-slate-900 text-[#0F172A] dark:text-slate-300 text-xs font-bold px-2.5 py-2 border-b border-r border-[#B6CBE3] dark:border-slate-800 text-center ${hideMorningMobile}`}
                >
                  TG bắt đầu
                </th>
                <th
                  style={{ top: grpHeight }}
                  className={`sticky z-20 bg-[#EEF5FF] dark:bg-slate-900 text-[#0F172A] dark:text-slate-300 text-xs font-bold px-2.5 py-2 border-b border-r border-[#B6CBE3] dark:border-slate-800 text-center ${hideMorningMobile}`}
                >
                  TG kết thúc
                </th>
                <th
                  style={{ top: grpHeight }}
                  className={`sticky z-20 bg-[#EEF5FF] dark:bg-slate-900 text-[#0F172A] dark:text-slate-300 text-xs font-bold px-2.5 py-2 border-b border-r-2 border-r-[#94B0CE] border-b-[#B6CBE3] dark:border-b-slate-800 dark:border-r-slate-700 text-center ${hideMorningMobile}`}
                >
                  Chọn
                </th>
                <th
                  style={{ top: grpHeight }}
                  className={`sticky z-20 bg-[#EEF5FF] dark:bg-slate-900 text-[#0F172A] dark:text-slate-300 text-xs font-bold px-2.5 py-2 border-b border-r border-[#B6CBE3] dark:border-slate-800 text-center ${hideAfternoonMobile}`}
                >
                  TG bắt đầu
                </th>
                <th
                  style={{ top: grpHeight }}
                  className={`sticky z-20 bg-[#EEF5FF] dark:bg-slate-900 text-[#0F172A] dark:text-slate-300 text-xs font-bold px-2.5 py-2 border-b border-r border-[#B6CBE3] dark:border-slate-800 text-center ${hideAfternoonMobile}`}
                >
                  TG kết thúc
                </th>
                <th
                  style={{ top: grpHeight }}
                  className={`sticky z-20 bg-[#EEF5FF] dark:bg-slate-900 text-[#0F172A] dark:text-slate-300 text-xs font-bold px-2.5 py-2 border-b border-[#B6CBE3] dark:border-slate-800 text-center ${hideAfternoonMobile}`}
                >
                  Chọn
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const hasMorning = Boolean(row.morningStart);
                const hasAfternoon = Boolean(row.afternoonStart);
                const mKey = `m:${row.stt}`;
                const aKey = `a:${row.stt}`;
                const mChecked = hasMorning && Boolean(slots[mKey]);
                const aChecked = hasAfternoon && Boolean(slots[aKey]);
                const mPending = Boolean(pendingSlots[mKey]);
                const aPending = Boolean(pendingSlots[aKey]);

                const isMNow = hasMorning && nearestNowCell?.stt === row.stt && nearestNowCell.session === 'm';
                const isANow = hasAfternoon && nearestNowCell?.stt === row.stt && nearestNowCell.session === 'a';
                const isFlashed = flashStt === row.stt;

                const selectedCellStyle: React.CSSProperties = {
                  backgroundColor: 'var(--sel-bg)',
                  boxShadow: 'inset 0 0 0 1px var(--sel-border)',
                };

                const hideRowOnMobile =
                  (mobileSegment === 'morning' && !hasMorning) ||
                  (mobileSegment === 'afternoon' && !hasAfternoon);

                return (
                  <tr
                    key={row.stt}
                    ref={(el) => {
                      rowRefs.current[row.stt] = el;
                    }}
                    className={`${
                      hideRowOnMobile ? 'hidden md:table-row print-show-row ' : ''
                    }${
                      isFlashed
                        ? 'bg-[#CBE0FF] dark:bg-sky-900/35'
                        : ''
                    }`}
                  >
                    {/* STT */}
                    <td
                      style={sttCellStyle}
                      className="border-b border-r-2 border-b-[#C7D6E8] border-r-[#94B0CE] dark:border-b-slate-800 dark:border-r-slate-700 text-center font-mono text-[#083578] dark:text-slate-300 bg-[#EEF4FB]/70 dark:bg-slate-900/90 tabular-nums"
                    >
                      {row.stt}
                    </td>

                    {/* SÁNG: Bắt đầu */}
                    <td
                      data-selected={mChecked ? 'true' : undefined}
                      data-now={isMNow ? 'true' : undefined}
                      style={mChecked ? { ...cellBaseStyle, ...selectedCellStyle } : cellBaseStyle}
                      className={`xq-m-cell xq-m-start ${hideMorningMobile} time-cell border-b border-r border-[#C7D6E8] dark:border-slate-800/80 text-center text-[#0F172A] dark:text-slate-100 relative ${
                        isMNow
                          ? 'ring-2 ring-inset ring-amber-500/85 bg-amber-50/90 dark:bg-amber-950/35'
                          : ''
                      }`}
                    >
                      {hasMorning ? (
                        <span className="inline-flex items-center justify-center gap-1.5">
                          <span>{row.morningStart}</span>
                          {isMNow && (
                            <span className="inline-block text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-700/70 bg-amber-100 text-amber-950 dark:bg-amber-900/60 dark:text-amber-200 leading-none">
                              HIỆN TẠI
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-[#94A3B8] dark:text-slate-600 font-medium">—</span>
                      )}
                    </td>

                    {/* SÁNG: Kết thúc */}
                    <td
                      data-selected={mChecked ? 'true' : undefined}
                      style={mChecked ? { ...cellBaseStyle, ...selectedCellStyle } : cellBaseStyle}
                      className={`xq-m-cell ${hideMorningMobile} time-cell border-b border-r border-[#C7D6E8] dark:border-slate-800/80 text-center text-[#1E293B] dark:text-slate-300`}
                    >
                      {hasMorning ? (
                        row.morningEnd
                      ) : (
                        <span className="text-[#94A3B8] dark:text-slate-600 font-medium">—</span>
                      )}
                    </td>

                    {/* SÁNG: Chọn */}
                    <td
                      data-selected={mChecked ? 'true' : undefined}
                      style={mChecked ? selectedCellStyle : undefined}
                      className={`xq-m-cell xq-m-pick ${hideMorningMobile} border-b border-r-2 border-b-[#C7D6E8] border-r-[#94B0CE] dark:border-b-slate-800 dark:border-r-slate-700 text-center p-0`}
                    >
                      {hasMorning ? (
                        <label
                          style={{ minHeight: `${rowSpacingMeta.minH}px` }}
                          className="flex items-center justify-center w-full h-full cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="xq-checkbox"
                            checked={Boolean(mChecked)}
                            disabled={isReadOnly || mPending}
                            aria-label={`Chọn ca sáng STT ${row.stt}, ${row.morningStart} đến ${row.morningEnd}`}
                            onChange={(e) => onSlotClick(row, 'm', e.target.checked)}
                          />
                        </label>
                      ) : (
                        <div
                          style={{ minHeight: `${rowSpacingMeta.minH}px` }}
                          className="flex items-center justify-center text-xs text-[#94A3B8] dark:text-slate-600"
                        >
                          —
                        </div>
                      )}
                    </td>

                    {/* CHIỀU: Bắt đầu */}
                    <td
                      data-selected={aChecked ? 'true' : undefined}
                      data-now={isANow ? 'true' : undefined}
                      style={aChecked ? { ...cellBaseStyle, ...selectedCellStyle } : cellBaseStyle}
                      className={`xq-a-cell xq-a-start ${hideAfternoonMobile} time-cell border-b border-r border-[#C7D6E8] dark:border-slate-800/80 text-center text-[#0F172A] dark:text-slate-100 relative ${
                        isANow
                          ? 'ring-2 ring-inset ring-amber-500/85 bg-amber-50/90 dark:bg-amber-950/35'
                          : ''
                      }`}
                    >
                      {hasAfternoon ? (
                        <span className="inline-flex items-center justify-center gap-1.5">
                          <span>{row.afternoonStart}</span>
                          {isANow && (
                            <span className="inline-block text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-700/70 bg-amber-100 text-amber-950 dark:bg-amber-900/60 dark:text-amber-200 leading-none">
                              HIỆN TẠI
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-[#94A3B8] dark:text-slate-600 font-medium">—</span>
                      )}
                    </td>

                    {/* CHIỀU: Kết thúc */}
                    <td
                      data-selected={aChecked ? 'true' : undefined}
                      style={aChecked ? { ...cellBaseStyle, ...selectedCellStyle } : cellBaseStyle}
                      className={`xq-a-cell ${hideAfternoonMobile} time-cell border-b border-r border-[#C7D6E8] dark:border-slate-800/80 text-center text-[#1E293B] dark:text-slate-300`}
                    >
                      {hasAfternoon ? (
                        row.afternoonEnd
                      ) : (
                        <span className="text-[#94A3B8] dark:text-slate-600 font-medium">—</span>
                      )}
                    </td>

                    {/* CHIỀU: Chọn */}
                    <td
                      data-selected={aChecked ? 'true' : undefined}
                      style={aChecked ? selectedCellStyle : undefined}
                      className={`xq-a-cell xq-a-pick ${hideAfternoonMobile} border-b border-[#C7D6E8] dark:border-slate-800 text-center p-0`}
                    >
                      {hasAfternoon ? (
                        <label
                          style={{ minHeight: `${rowSpacingMeta.minH}px` }}
                          className="flex items-center justify-center w-full h-full cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="xq-checkbox"
                            checked={Boolean(aChecked)}
                            disabled={isReadOnly || aPending}
                            aria-label={`Chọn ca chiều STT ${row.stt}, ${row.afternoonStart} đến ${row.afternoonEnd}`}
                            onChange={(e) => onSlotClick(row, 'a', e.target.checked)}
                          />
                        </label>
                      ) : (
                        <div
                          style={{ minHeight: `${rowSpacingMeta.minH}px` }}
                          className="flex items-center justify-center text-xs text-[#94A3B8] dark:text-slate-600"
                        >
                          —
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Single-page table summary footer */}
      {!loading && rows.length > 0 && (
        <div className="no-print rounded-b-xl flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-2.5 border-t border-[#C7D6E8] dark:border-slate-800 bg-[#EEF4FB]/80 dark:bg-slate-900/80 text-xs font-semibold text-[#334155] dark:text-slate-400">
          <span>
            Hiển thị{' '}
            <strong className="md:hidden font-mono tabular-nums text-[#0F172A] dark:text-slate-200">
              {mobileRowCount}/{mobileRowCount} ca {mobileSegment === 'morning' ? 'buổi sáng' : 'buổi chiều'}
            </strong>
            <strong className="hidden md:inline font-mono tabular-nums text-[#0F172A] dark:text-slate-200">
              {rows.length} hàng (Sáng {morningCount} · Chiều {afternoonCount} ca)
            </strong>{' '}
            theo cài đặt giờ
          </span>
          <span className="font-mono tabular-nums">
            Đã chọn: <strong className="text-[#083578] dark:text-sky-300">{totalChecked}/{totalSelectable}</strong> ca
          </span>
        </div>
      )}
    </section>
  );
});

ScheduleTable.displayName = 'ScheduleTable';
