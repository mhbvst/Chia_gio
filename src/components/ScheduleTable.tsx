import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Clock3,
  FileSpreadsheet,
  LocateFixed,
  Printer,
} from 'lucide-react';
import { MachineConfig, ScheduleRow } from '../data/schedules';
import { countCheckedSlotsInRows, countTotalSlots } from '../utils/scheduleGenerator';
import { formatDateDisplayVN, formatTimeVN, nowSecondsVN, parseHHMM } from '../utils/vnTime';

interface ScheduleTableProps {
  machine: MachineConfig;
  slots: Record<string, boolean>;
  isToday: boolean;
  isReadOnly: boolean;
  loading: boolean;
  density: 'compact' | 'standard';
  mobileSegment: 'morning' | 'afternoon';
  viewedDateKey: string;
  nowTick: number;
  lastPickedStart: string | null;
  lastPickTone?: 'empty' | 'neutral' | 'now' | 'past' | 'overdue' | 'upcoming';
  pendingSlots: Record<string, boolean>;
  onSlotClick: (row: ScheduleRow, session: 'm' | 'a', nextChecked: boolean) => void;
  onPrint: () => void;
  onCopy: (visibleRows: ScheduleRow[]) => void;
  onSwitchMobileSegment?: (seg: 'morning' | 'afternoon') => void;
}

export const ScheduleTable: React.FC<ScheduleTableProps> = ({
  machine,
  slots,
  isToday,
  isReadOnly,
  loading,
  density,
  mobileSegment,
  viewedDateKey,
  nowTick,
  lastPickedStart,
  lastPickTone = 'empty',
  pendingSlots,
  onSlotClick,
  onPrint,
  onCopy,
  onSwitchMobileSegment,
}) => {
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const theadRef = useRef<HTMLTableSectionElement | null>(null);
  const grpRowRef = useRef<HTMLTableRowElement | null>(null);
  const rowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});
  const [toolbarHeight, setToolbarHeight] = useState<number>(68);
  const [grpHeight, setGrpHeight] = useState<number>(33);
  const [pendingScrollStt, setPendingScrollStt] = useState<number | null>(null);
  const [flashStt, setFlashStt] = useState<number | null>(null);

  useEffect(() => {
    const tbEl = toolbarRef.current;
    const grpEl = grpRowRef.current;
    if (!tbEl && !grpEl) return;
    const syncHeights = () => {
      if (tbEl) {
        const h = Math.floor(tbEl.getBoundingClientRect().height);
        if (h > 0) setToolbarHeight(h);
      }
      if (grpEl) {
        const gh = Math.floor(grpEl.getBoundingClientRect().height);
        if (gh > 0) setGrpHeight(gh);
      }
    };
    syncHeights();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(syncHeights);
      if (tbEl) ro.observe(tbEl);
      if (grpEl) ro.observe(grpEl);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', syncHeights);
    return () => window.removeEventListener('resize', syncHeights);
  }, [loading]);

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
    const rowEl = rowRefs.current[stt];
    if (!rowEl) return;

    const tbH = toolbarRef.current ? Math.floor(toolbarRef.current.getBoundingClientRect().height) : toolbarHeight;
    const theadHeight = theadRef.current?.offsetHeight || 72;
    const stickyTop = tbH + theadHeight;
    const rect = rowEl.getBoundingClientRect();
    const rowTopOnPage = window.scrollY + rect.top;
    const visibleBodyHeight = Math.max(120, window.innerHeight - stickyTop);
    const targetTop =
      rowTopOnPage - stickyTop - visibleBodyHeight / 2 + rect.height / 2;

    window.scrollTo({
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

  const liveClockVN = formatTimeVN(new Date(nowTick));
  const lastPickColorClass = !lastPickedStart
    ? 'text-[#475569] dark:text-slate-400'
    : lastPickTone === 'overdue'
    ? 'text-red-700 dark:text-red-300'
    : lastPickTone === 'now'
    ? 'text-emerald-700 dark:text-emerald-300'
    : lastPickTone === 'past'
    ? 'text-amber-700 dark:text-amber-300'
    : 'text-[#083578] dark:text-sky-300';

  const cellPad = density === 'compact' ? 'py-1.5 px-2.5' : 'py-2.5 px-3';
  const timeText = density === 'compact' ? 'text-[14px]' : 'text-[15.5px]';
  const hideMorningMobile = mobileSegment === 'afternoon' ? 'hidden md:table-cell print-show-col' : '';
  const hideAfternoonMobile = mobileSegment === 'morning' ? 'hidden md:table-cell print-show-col' : '';

  return (
    <section
      id={machine.id}
      role="tabpanel"
      aria-label={machine.fullTitle}
      className="print-card-shell bg-white dark:bg-slate-900 border border-[#C7D6E8] dark:border-slate-800 rounded-xl overflow-x-clip shadow-[0_2px_6px_rgba(8,53,120,0.06)]"
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
      <div
        ref={toolbarRef}
        className="no-print sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3.5 rounded-t-xl border-b border-[#C7D6E8] dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_1px_2px_rgba(8,53,120,0.04)]"
      >
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
          <h2 className="text-base sm:text-lg font-extrabold text-[#083578] dark:text-slate-100 mt-0.5 truncate">
            {machine.fullTitle}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#B6CBE3] dark:border-slate-700 bg-[#EEF4FB] dark:bg-slate-800 whitespace-nowrap shrink-0"
            title="Thời gian bắt đầu đã chọn gần nhất / Đồng hồ thời gian thực (Giờ Việt Nam)"
            aria-label="Thời gian bắt đầu đã chọn gần nhất và đồng hồ thời gian thực"
          >
            <Clock3 className="w-4 h-4 text-[#0D4EA6] dark:text-sky-400 shrink-0" />
            <div className="leading-tight">
              <div className="text-[10px] font-bold uppercase tracking-wide text-[#334155] dark:text-slate-400">
                Bắt đầu gần nhất / Hiện tại
              </div>
              <div className="font-mono text-xs sm:text-sm font-extrabold tabular-nums flex items-center gap-1.5">
                <span className={lastPickColorClass}>
                  {lastPickedStart || '--:--'}
                </span>
                <span className="text-[#64748B] dark:text-slate-500" aria-hidden="true">
                  /
                </span>
                <span className="text-[#0F172A] dark:text-slate-100">
                  {liveClockVN}
                </span>
              </div>
            </div>
          </div>

          {isToday && jumpTarget && !loading && (
            <button
              type="button"
              onClick={handleJumpToNow}
              title="Tự động cuộn tới vị trí thời gian hiện tại"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-bold rounded-lg border border-[#93BCEB] dark:border-sky-800 bg-[#DCEBFF] dark:bg-sky-950/50 text-[#083578] dark:text-sky-200 hover:bg-[#C6DFFF] dark:hover:bg-sky-900/60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <LocateFixed className="w-4 h-4 text-[#0D4EA6] dark:text-sky-400" />
              <span>Tới ca hiện tại</span>
            </button>
          )}
          <button
            type="button"
            onClick={onPrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-bold rounded-lg border border-[#B6CBE3] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#0F172A] dark:text-slate-200 hover:bg-[#EEF4FB] dark:hover:bg-slate-700/70 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Printer className="w-4 h-4 text-[#0D4EA6] dark:text-sky-400" />
            <span>In / PDF</span>
          </button>
          <button
            type="button"
            onClick={() => onCopy(rows)}
            style={{ backgroundColor: 'var(--accent-500)' }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-bold rounded-lg text-white hover:opacity-95 transition-opacity cursor-pointer whitespace-nowrap shrink-0 shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Xuất Excel</span>
          </button>
        </div>
      </div>

      {/* Single-page scrollable Schedule Table */}
      <div
        ref={tableScrollRef}
        className="print-table-wrap overflow-x-clip rounded-b-xl"
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
                  style={{ top: toolbarHeight }}
                  className="sticky z-20 bg-[#DCEBFF] dark:bg-slate-800 text-[#083578] dark:text-slate-200 text-xs font-extrabold uppercase tracking-wider px-3 py-2.5 border-b border-r border-[#B6CBE3] dark:border-slate-700 text-center"
                >
                  STT
                </th>
                <th
                  colSpan={3}
                  style={{ top: toolbarHeight }}
                  className={`sticky z-20 bg-[#D0E4FF] dark:bg-sky-950/80 text-[#083578] dark:text-sky-200 text-xs leading-4 font-extrabold uppercase tracking-wider px-3 py-2 border-b border-r border-[#B6CBE3] dark:border-slate-700 text-center ${hideMorningMobile}`}
                >
                  BUỔI SÁNG
                </th>
                <th
                  colSpan={3}
                  style={{ top: toolbarHeight }}
                  className={`sticky z-20 bg-[#DCEBFF] dark:bg-blue-950/80 text-[#083578] dark:text-blue-200 text-xs leading-4 font-extrabold uppercase tracking-wider px-3 py-2 border-b border-[#B6CBE3] dark:border-slate-700 text-center ${hideAfternoonMobile}`}
                >
                  BUỔI CHIỀU
                </th>
              </tr>
              <tr>
                <th
                  style={{ top: toolbarHeight + grpHeight }}
                  className={`sticky z-20 bg-[#EEF5FF] dark:bg-slate-900 text-[#0F172A] dark:text-slate-300 text-xs font-bold px-2.5 py-2 border-b border-r border-[#B6CBE3] dark:border-slate-800 text-center ${hideMorningMobile}`}
                >
                  TG bắt đầu
                </th>
                <th
                  style={{ top: toolbarHeight + grpHeight }}
                  className={`sticky z-20 bg-[#EEF5FF] dark:bg-slate-900 text-[#0F172A] dark:text-slate-300 text-xs font-bold px-2.5 py-2 border-b border-r border-[#B6CBE3] dark:border-slate-800 text-center ${hideMorningMobile}`}
                >
                  TG kết thúc
                </th>
                <th
                  style={{ top: toolbarHeight + grpHeight }}
                  className={`sticky z-20 bg-[#EEF5FF] dark:bg-slate-900 text-[#0F172A] dark:text-slate-300 text-xs font-bold px-2.5 py-2 border-b border-r border-[#B6CBE3] dark:border-slate-800 text-center ${hideMorningMobile}`}
                >
                  Chọn
                </th>
                <th
                  style={{ top: toolbarHeight + grpHeight }}
                  className={`sticky z-20 bg-[#EEF5FF] dark:bg-slate-900 text-[#0F172A] dark:text-slate-300 text-xs font-bold px-2.5 py-2 border-b border-r border-[#B6CBE3] dark:border-slate-800 text-center ${hideAfternoonMobile}`}
                >
                  TG bắt đầu
                </th>
                <th
                  style={{ top: toolbarHeight + grpHeight }}
                  className={`sticky z-20 bg-[#EEF5FF] dark:bg-slate-900 text-[#0F172A] dark:text-slate-300 text-xs font-bold px-2.5 py-2 border-b border-r border-[#B6CBE3] dark:border-slate-800 text-center ${hideAfternoonMobile}`}
                >
                  TG kết thúc
                </th>
                <th
                  style={{ top: toolbarHeight + grpHeight }}
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
                      className={`${cellPad} border-b border-r border-[#C7D6E8] dark:border-slate-800 text-center font-mono text-xs sm:text-sm font-extrabold text-[#083578] dark:text-slate-300 bg-[#EEF4FB]/70 dark:bg-slate-900 tabular-nums`}
                    >
                      {row.stt}
                    </td>

                    {/* SÁNG: Bắt đầu */}
                    <td
                      data-selected={mChecked ? 'true' : undefined}
                      data-now={isMNow ? 'true' : undefined}
                      style={mChecked ? selectedCellStyle : undefined}
                      className={`xq-m-cell xq-m-start ${cellPad} ${timeText} ${hideMorningMobile} time-cell border-b border-r border-[#C7D6E8] dark:border-slate-800/80 text-center font-extrabold text-[#0F172A] dark:text-slate-100 relative ${
                        isMNow
                          ? 'ring-2 ring-inset ring-amber-500/85 bg-amber-50/90 dark:bg-amber-950/35'
                          : ''
                      }`}
                    >
                      {hasMorning ? (
                        <>
                          <span>{row.morningStart}</span>
                          {isMNow && (
                            <span className="ml-1.5 inline-block text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-200 text-amber-950 dark:bg-amber-900/60 dark:text-amber-200 align-middle">
                              HIỆN TẠI
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-[#94A3B8] dark:text-slate-600 font-medium">—</span>
                      )}
                    </td>

                    {/* SÁNG: Kết thúc */}
                    <td
                      data-selected={mChecked ? 'true' : undefined}
                      style={mChecked ? selectedCellStyle : undefined}
                      className={`xq-m-cell ${cellPad} ${timeText} ${hideMorningMobile} time-cell border-b border-r border-[#C7D6E8] dark:border-slate-800/80 text-center font-bold text-[#1E293B] dark:text-slate-300`}
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
                      className={`xq-m-cell xq-m-pick ${hideMorningMobile} border-b border-r border-[#B6CBE3] dark:border-slate-800 text-center p-0`}
                    >
                      {hasMorning ? (
                        <label className="flex items-center justify-center w-full h-full min-h-[40px] cursor-pointer">
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
                        <div className="flex items-center justify-center min-h-[40px] text-xs text-[#94A3B8] dark:text-slate-600">
                          —
                        </div>
                      )}
                    </td>

                    {/* CHIỀU: Bắt đầu */}
                    <td
                      data-selected={aChecked ? 'true' : undefined}
                      data-now={isANow ? 'true' : undefined}
                      style={aChecked ? selectedCellStyle : undefined}
                      className={`xq-a-cell xq-a-start ${cellPad} ${timeText} ${hideAfternoonMobile} time-cell border-b border-r border-[#C7D6E8] dark:border-slate-800/80 text-center font-extrabold text-[#0F172A] dark:text-slate-100 relative ${
                        !aChecked && !isFlashed ? 'bg-[#F7FAFE] dark:bg-slate-900' : ''
                      } ${
                        isANow
                          ? 'ring-2 ring-inset ring-amber-500/85 bg-amber-50/90 dark:bg-amber-950/35'
                          : ''
                      }`}
                    >
                      {hasAfternoon ? (
                        <>
                          <span>{row.afternoonStart}</span>
                          {isANow && (
                            <span className="ml-1.5 inline-block text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-200 text-amber-950 dark:bg-amber-900/60 dark:text-amber-200 align-middle">
                              HIỆN TẠI
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-[#94A3B8] dark:text-slate-600 font-medium">—</span>
                      )}
                    </td>

                    {/* CHIỀU: Kết thúc */}
                    <td
                      data-selected={aChecked ? 'true' : undefined}
                      style={aChecked ? selectedCellStyle : undefined}
                      className={`xq-a-cell ${cellPad} ${timeText} ${hideAfternoonMobile} time-cell border-b border-r border-[#C7D6E8] dark:border-slate-800/80 text-center font-bold text-[#1E293B] dark:text-slate-300 ${
                        !aChecked && !isFlashed ? 'bg-[#F7FAFE] dark:bg-slate-900' : ''
                      }`}
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
                      className={`xq-a-cell xq-a-pick ${hideAfternoonMobile} border-b border-[#C7D6E8] dark:border-slate-800 text-center p-0 ${
                        !aChecked && !isFlashed ? 'bg-[#F7FAFE] dark:bg-slate-900' : ''
                      }`}
                    >
                      {hasAfternoon ? (
                        <label className="flex items-center justify-center w-full h-full min-h-[40px] cursor-pointer">
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
                        <div className="flex items-center justify-center min-h-[40px] text-xs text-[#94A3B8] dark:text-slate-600">
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
        <div className="no-print flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-2.5 border-t border-[#C7D6E8] dark:border-slate-800 bg-[#EEF4FB]/80 dark:bg-slate-900/80 text-xs font-semibold text-[#334155] dark:text-slate-400">
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
};
