import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import {
  formatSolarDateVN,
  formatTimeVN,
  getLunarInfoVN,
  getTodayKeyVN,
  getVNNowParts,
} from '../utils/vnTime';

interface ClockWidgetProps {
  selectedDateKey?: string;
  onSelectDate?: (dateKey: string) => void;
}

const WEEKDAY_HEADERS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function toDateKey(yy: number, mm: number, dd: number): string {
  return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

export const ClockWidget: React.FC<ClockWidgetProps> = ({
  selectedDateKey,
  onSelectDate,
}) => {
  const [now, setNow] = useState<Date>(() => new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);

  const initialParts = getVNNowParts(now);
  const [viewYear, setViewYear] = useState<number>(initialParts.yy);
  const [viewMonth, setViewMonth] = useState<number>(initialParts.mm); // 1..12

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Close calendar popover on outside click or Escape
  useEffect(() => {
    if (!calendarOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setCalendarOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCalendarOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [calendarOpen]);

  const parts = getVNNowParts(now);
  const todayKey = getTodayKeyVN(now);
  const isMorning = parts.hh < 12;
  const timeStr = formatTimeVN(now);
  const solarFull = formatSolarDateVN(now);
  const solarShort = `${String(parts.dd).padStart(2, '0')}/${String(parts.mm).padStart(2, '0')}/${parts.yy}`;
  const lunarToday = getLunarInfoVN(parts.dd, parts.mm, parts.yy);

  const toggleCalendar = () => {
    if (!calendarOpen) {
      const m = selectedDateKey?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) {
        setViewYear(parseInt(m[1], 10));
        setViewMonth(parseInt(m[2], 10));
      } else {
        setViewYear(parts.yy);
        setViewMonth(parts.mm);
      }
    }
    setCalendarOpen((prev) => !prev);
  };

  const shiftMonth = (delta: number) => {
    let nextMonth = viewMonth + delta;
    let nextYear = viewYear;
    if (nextMonth < 1) {
      nextMonth = 12;
      nextYear -= 1;
    } else if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    setViewMonth(nextMonth);
    setViewYear(nextYear);
  };

  const monthCells = useMemo(() => {
    const firstDayOfMonth = new Date(Date.UTC(viewYear, viewMonth - 1, 1));
    const utcDay = firstDayOfMonth.getUTCDay(); // 0=Sun..6=Sat
    const leadingBlanks = (utcDay + 6) % 7; // Convert to Monday=0..Sunday=6
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate();
    const prevMonthDays = new Date(Date.UTC(viewYear, viewMonth - 1, 0)).getUTCDate();

    const prevMonth = viewMonth === 1 ? 12 : viewMonth - 1;
    const prevYear = viewMonth === 1 ? viewYear - 1 : viewYear;
    const nextMonth = viewMonth === 12 ? 1 : viewMonth + 1;
    const nextYear = viewMonth === 12 ? viewYear + 1 : viewYear;

    const cells: Array<{
      yy: number;
      mm: number;
      dd: number;
      inCurrentMonth: boolean;
      dateKey: string;
      lunarCompact: string;
      isLunarFirst: boolean;
    }> = [];

    for (let i = leadingBlanks - 1; i >= 0; i--) {
      const dd = prevMonthDays - i;
      const lunar = getLunarInfoVN(dd, prevMonth, prevYear);
      cells.push({
        yy: prevYear,
        mm: prevMonth,
        dd,
        inCurrentMonth: false,
        dateKey: toDateKey(prevYear, prevMonth, dd),
        lunarCompact: lunar.compactDate,
        isLunarFirst: lunar.lunarDay === 1,
      });
    }

    for (let dd = 1; dd <= daysInMonth; dd++) {
      const lunar = getLunarInfoVN(dd, viewMonth, viewYear);
      cells.push({
        yy: viewYear,
        mm: viewMonth,
        dd,
        inCurrentMonth: true,
        dateKey: toDateKey(viewYear, viewMonth, dd),
        lunarCompact: lunar.compactDate,
        isLunarFirst: lunar.lunarDay === 1,
      });
    }

    const trailingCount = (7 - (cells.length % 7)) % 7;
    for (let dd = 1; dd <= trailingCount; dd++) {
      const lunar = getLunarInfoVN(dd, nextMonth, nextYear);
      cells.push({
        yy: nextYear,
        mm: nextMonth,
        dd,
        inCurrentMonth: false,
        dateKey: toDateKey(nextYear, nextMonth, dd),
        lunarCompact: lunar.compactDate,
        isLunarFirst: lunar.lunarDay === 1,
      });
    }

    return cells;
  }, [viewYear, viewMonth]);

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <div className="inline-flex items-stretch h-10 rounded-lg border border-[#B6CBE3] dark:border-slate-700 bg-white dark:bg-slate-800 shadow-[0_1px_2px_rgba(8,53,120,0.06)] overflow-hidden">
        {/* Left Segment: Real-Time Digital Clinical Clock */}
        <div
          className="flex items-center gap-2 px-3 bg-[#083578] dark:bg-sky-950 text-white select-none shrink-0"
          aria-label={`Giờ Việt Nam hiện tại ${timeStr}, ${isMorning ? 'Ca sáng' : 'Ca chiều'}`}
        >
          <Clock className="w-3.5 h-3.5 text-sky-300 shrink-0" aria-hidden="true" />
          <div className="leading-none">
            <div className="font-mono text-sm sm:text-[15px] font-extrabold tracking-wide tabular-nums text-white">
              {timeStr}
            </div>
            <div className="text-[10px] font-semibold text-sky-200 mt-0.5 whitespace-nowrap">
              {isMorning ? 'Ca sáng' : 'Ca chiều'} · VN
            </div>
          </div>
        </div>

        {/* Right Segment: Structured Solar & Lunar Calendar Trigger */}
        <button
          type="button"
          onClick={toggleCalendar}
          aria-expanded={calendarOpen}
          aria-label="Mở lịch Dương lịch và Âm lịch để xem nhanh hoặc chọn ngày"
          title="Nhấn để mở lịch Dương & Âm lịch"
          className="flex items-center gap-2 px-3 bg-[#F4F8FF] dark:bg-slate-800 hover:bg-[#E4EEFF] dark:hover:bg-slate-700/80 text-left transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0D4EA6]"
        >
          <CalendarDays className="w-3.5 h-3.5 text-[#0D4EA6] dark:text-sky-400 shrink-0 hidden sm:block" aria-hidden="true" />
          <div className="leading-tight">
            <div className="text-[11.5px] font-extrabold text-[#083578] dark:text-slate-100 whitespace-nowrap">
              <span className="hidden sm:inline">{solarFull}</span>
              <span className="sm:hidden font-mono tabular-nums">{solarShort}</span>
            </div>
            <div className="text-[10.5px] font-semibold text-[#334155] dark:text-sky-300 whitespace-nowrap tabular-nums">
              {lunarToday.fullText}
            </div>
          </div>
          <ChevronDown
            className={`w-3.5 h-3.5 text-[#334155] dark:text-slate-400 shrink-0 transition-transform duration-150 ${
              calendarOpen ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Interactive Solar + Lunar Monthly Calendar Popover */}
      {calendarOpen && (
        <div
          role="dialog"
          aria-label="Lịch Dương lịch và Âm lịch Việt Nam"
          className="absolute right-0 mt-2 w-[312px] sm:w-[332px] rounded-xl border border-[#B6CBE3] dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-3.5 z-50"
        >
          {/* Popover Header */}
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#E2EAF2] dark:border-slate-800">
            <div>
              <div className="text-sm font-extrabold text-[#083578] dark:text-slate-100 tabular-nums">
                Tháng {String(viewMonth).padStart(2, '0')} / {viewYear}
              </div>
              <div className="text-[11px] font-semibold text-[#334155] dark:text-slate-400 mt-0.5">
                {lunarToday.fullText}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="Tháng trước"
                className="p-1.5 rounded-lg border border-[#C7D6E8] dark:border-slate-700 text-[#0F172A] dark:text-slate-200 hover:bg-[#DCEBFF] dark:hover:bg-slate-800 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewYear(parts.yy);
                  setViewMonth(parts.mm);
                  if (onSelectDate) {
                    onSelectDate(todayKey);
                    setCalendarOpen(false);
                  }
                }}
                className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-[#93BCEB] dark:border-sky-800 bg-[#DCEBFF] dark:bg-sky-950/60 text-[#083578] dark:text-sky-200 hover:bg-[#C6DFFF] cursor-pointer whitespace-nowrap"
              >
                Hôm nay
              </button>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="Tháng sau"
                className="p-1.5 rounded-lg border border-[#C7D6E8] dark:border-slate-700 text-[#0F172A] dark:text-slate-200 hover:bg-[#DCEBFF] dark:hover:bg-slate-800 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday Row */}
          <div className="grid grid-cols-7 gap-1 mt-2.5 mb-1">
            {WEEKDAY_HEADERS.map((wd, idx) => (
              <div
                key={wd}
                className={`text-center text-[11px] font-extrabold py-1 ${
                  idx === 6
                    ? 'text-red-700 dark:text-red-400'
                    : 'text-[#334155] dark:text-slate-400'
                }`}
              >
                {wd}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {monthCells.map((cell) => {
              const isTodayCell = cell.dateKey === todayKey;
              const isSelectedCell = selectedDateKey === cell.dateKey;
              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  onClick={() => {
                    if (onSelectDate) {
                      onSelectDate(cell.dateKey);
                      setCalendarOpen(false);
                    }
                  }}
                  className={`flex flex-col items-center justify-center py-1.5 rounded-lg border text-center transition-colors cursor-pointer ${
                    isSelectedCell
                      ? 'bg-[#0D4EA6] border-[#0D4EA6] text-white shadow-xs'
                      : isTodayCell
                      ? 'bg-[#DCEBFF] dark:bg-sky-950/60 border-[#0D4EA6] text-[#083578] dark:text-sky-200'
                      : cell.inCurrentMonth
                      ? 'border-transparent hover:bg-[#EEF4FB] dark:hover:bg-slate-800 text-[#0F172A] dark:text-slate-200'
                      : 'border-transparent text-[#94A3B8] dark:text-slate-600 hover:bg-[#EEF4FB]/50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <span className="font-mono text-xs font-extrabold tabular-nums leading-none">
                    {cell.dd}
                  </span>
                  <span
                    className={`font-mono text-[9.5px] font-semibold tabular-nums leading-none mt-1 ${
                      isSelectedCell
                        ? 'text-blue-100'
                        : cell.isLunarFirst
                        ? 'text-[#0D4EA6] dark:text-sky-400 font-extrabold'
                        : cell.inCurrentMonth
                        ? 'text-[#475569] dark:text-slate-400'
                        : 'text-[#94A3B8] dark:text-slate-600'
                    }`}
                  >
                    {cell.lunarCompact}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Footer hint */}
          <div className="mt-2.5 pt-2 border-t border-[#E2EAF2] dark:border-slate-800 flex items-center justify-between text-[11px] font-medium text-[#334155] dark:text-slate-400">
            <span>Số nhỏ phía dưới là ngày Âm lịch</span>
            <span className="font-semibold text-[#0D4EA6] dark:text-sky-400">Chọn ngày để xem</span>
          </div>
        </div>
      )}
    </div>
  );
};
