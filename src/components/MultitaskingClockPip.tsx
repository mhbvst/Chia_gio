import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { GripHorizontal, X } from 'lucide-react';
import { describeLastPickOffsetVN, formatTimeVN, getVNNowParts } from '../utils/vnTime';

export interface MultitaskingClockPipHandle {
  toggle: () => void;
}

interface MultitaskingClockPipProps {
  machineName: string;
  lastPickedStart: string | null;
  lastPickTone: 'empty' | 'neutral' | 'now' | 'past' | 'overdue' | 'upcoming';
  isToday: boolean;
  onOpenStateChange?: (open: boolean) => void;
  onNotify?: (type: 'info' | 'error' | 'success', message: string) => void;
}

const CANVAS_W = 520;
const CANVAS_H = 260;

function getLastPickHex(
  lastPickedStart: string | null,
  tone: MultitaskingClockPipProps['lastPickTone']
): string {
  if (!lastPickedStart) return '#CBD5E1';
  switch (tone) {
    case 'upcoming':
      return '#22C55E';
    case 'past':
    case 'now':
      return '#FACC15';
    case 'overdue':
      return '#F87171';
    case 'neutral':
    default:
      return '#F8FAFC';
  }
}

function getLastPickClass(
  lastPickedStart: string | null,
  tone: MultitaskingClockPipProps['lastPickTone']
): string {
  if (!lastPickedStart) return 'text-slate-400 dark:text-slate-400';
  switch (tone) {
    case 'upcoming':
      return 'text-[#16A34A] dark:text-[#22C55E]';
    case 'past':
    case 'now':
      return 'text-[#CA8A04] dark:text-[#FACC15]';
    case 'overdue':
      return 'text-[#DC2626] dark:text-[#F87171]';
    case 'neutral':
    default:
      return 'text-[#0F172A] dark:text-[#F8FAFC]';
  }
}

export const MultitaskingClockPip = forwardRef<
  MultitaskingClockPipHandle,
  MultitaskingClockPipProps
>(({ machineName, lastPickedStart, lastPickTone, isToday, onOpenStateChange, onNotify }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [pipActive, setPipActive] = useState(false);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [nowDate, setNowDate] = useState<Date>(() => new Date());
  const nowText = formatTimeVN(nowDate);

  // Draggable state for in-page floating popup fallback
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragStateRef = useRef<{
    dragging: boolean;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const popupCardRef = useRef<HTMLDivElement | null>(null);

  // Keep latest props in refs so background 1s interval always draws fresh data
  const latestPropsRef = useRef({
    machineName,
    lastPickedStart,
    lastPickTone,
    isToday,
  });
  latestPropsRef.current = { machineName, lastPickedStart, lastPickTone, isToday };

  const drawClockFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const {
      machineName: curMachine,
      lastPickedStart: picked,
      lastPickTone: tone,
      isToday: todayFlag,
    } = latestPropsRef.current;
    const now = new Date();
    const liveTime = formatTimeVN(now);
    const vnParts = getVNNowParts(now);
    const shiftText = vnParts.hh >= 12 ? 'Ca chiều' : 'Ca sáng';
    const telemetry = describeLastPickOffsetVN(picked, todayFlag, undefined, now);
    setNowDate(now);

    // Background
    ctx.fillStyle = '#0B1220';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Subtle header band
    ctx.fillStyle = '#111A2E';
    ctx.fillRect(0, 0, CANVAS_W, 44);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 44);
    ctx.lineTo(CANVAS_W, 44);
    ctx.stroke();

    // Subtle divider line between rows
    ctx.beginPath();
    ctx.moveTo(28, 146);
    ctx.lineTo(CANVAS_W - 28, 146);
    ctx.stroke();

    // Top context line
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '700 15px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const subLabel = todayFlag ? `${curMachine} · ${shiftText}` : `${curMachine} · Chỉ xem`;
    ctx.fillText(subLabel, CANVAS_W / 2, 22);

    // Row 1: Giờ hiện tại
    ctx.textAlign = 'left';
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 22px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
    ctx.fillText('Giờ hiện tại (VN)', 32, 95);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#38BDF8';
    ctx.font = '800 46px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(liveTime, CANVAS_W - 32, 95);

    // Row 2: Giờ đã chọn + live delta
    ctx.textAlign = 'left';
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 22px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
    ctx.fillText('Đã chọn sau cùng', 32, 186);

    const pickColor = getLastPickHex(picked, tone);
    ctx.fillStyle = pickColor;
    ctx.font = '700 17px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(
      picked ? `${telemetry.statusLabel} · ${telemetry.deltaLabel}` : telemetry.statusLabel,
      32,
      220
    );

    ctx.textAlign = 'right';
    ctx.fillStyle = pickColor;
    ctx.font = '800 46px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(picked || '--:--', CANVAS_W - 32, 200);
  }, []);

  // Redraw immediately when relevant props change and tick every 1s while active
  useEffect(() => {
    drawClockFrame();
  }, [machineName, lastPickedStart, lastPickTone, isToday, drawClockFrame]);

  useEffect(() => {
    if (!pipActive && !fallbackOpen) return;
    drawClockFrame();
    const timer = window.setInterval(drawClockFrame, 1000);
    return () => window.clearInterval(timer);
  }, [pipActive, fallbackOpen, drawClockFrame]);

  // Listen to native PiP enter/leave events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onEnter = () => setPipActive(true);
    const onLeave = () => {
      setPipActive(false);
      video.pause();
    };

    video.addEventListener('enterpictureinpicture', onEnter);
    video.addEventListener('leavepictureinpicture', onLeave);
    return () => {
      video.removeEventListener('enterpictureinpicture', onEnter);
      video.removeEventListener('leavepictureinpicture', onLeave);
    };
  }, []);

  // Cleanup MediaStream on unmount
  useEffect(() => {
    return () => {
      if (document.pictureInPictureElement && videoRef.current === document.pictureInPictureElement) {
        void document.exitPictureInPicture().catch(() => {});
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Drag handlers for fallback floating card
  useEffect(() => {
    if (!fallbackOpen) return;
    const onPointerMove = (e: PointerEvent) => {
      const ds = dragStateRef.current;
      if (!ds?.dragging) return;
      const dx = e.clientX - ds.startX;
      const dy = e.clientY - ds.startY;
      const maxX = Math.max(8, window.innerWidth - 330);
      const maxY = Math.max(8, window.innerHeight - 170);
      setDragPos({
        x: Math.min(maxX, Math.max(8, ds.origX + dx)),
        y: Math.min(maxY, Math.max(8, ds.origY + dy)),
      });
    };
    const onPointerUp = () => {
      if (dragStateRef.current) {
        dragStateRef.current.dragging = false;
      }
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [fallbackOpen]);

  const handleTogglePip = async () => {
    // Close if currently open
    if (pipActive) {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture().catch(() => {});
      }
      setPipActive(false);
      return;
    }
    if (fallbackOpen) {
      setFallbackOpen(false);
      return;
    }

    drawClockFrame();

    const canvas = canvasRef.current as
      | (HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream })
      | null;
    const video = videoRef.current;

    const canNativePip =
      Boolean(canvas && video) &&
      typeof canvas?.captureStream === 'function' &&
      typeof video?.requestPictureInPicture === 'function' &&
      Boolean(document.pictureInPictureEnabled);

    if (canNativePip && canvas && video) {
      try {
        if (!streamRef.current) {
          streamRef.current = canvas.captureStream!(10);
        }
        if (video.srcObject !== streamRef.current) {
          video.srcObject = streamRef.current;
        }
        await video.play();
        await video.requestPictureInPicture();
        setPipActive(true);
        setFallbackOpen(false);
        return;
      } catch {
        // Native PiP can be blocked in embedded iframes; fall back to floating popup
      }
    }

    setFallbackOpen(true);
    onNotify?.(
      'info',
      'Đã mở đồng hồ nổi trong trang (trình duyệt hoặc khung nhúng hiện tại chưa cho phép PiP ngoài cửa sổ).'
    );
  };

  const handleStartDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const card = popupCardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    dragStateRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: rect.left,
      origY: rect.top,
    };
  };

  const isAnyOpen = pipActive || fallbackOpen;

  const toggleFnRef = useRef<() => Promise<void>>(handleTogglePip);
  toggleFnRef.current = handleTogglePip;

  useImperativeHandle(
    ref,
    () => ({
      toggle: () => {
        void toggleFnRef.current();
      },
    }),
    []
  );

  useEffect(() => {
    onOpenStateChange?.(isAnyOpen);
  }, [isAnyOpen, onOpenStateChange]);

  return (
    <>
      {/* Hidden canvas + video used for Browser Native Picture-in-Picture */}
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        aria-hidden="true"
        className="fixed -left-[9999px] -top-[9999px] pointer-events-none"
      />
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        aria-hidden="true"
        className="fixed w-px h-px opacity-0 pointer-events-none bottom-0 right-0"
      />

      {/* Fallback Floating Multitasking Popup (when native PiP is blocked/unavailable) */}
      {fallbackOpen && (() => {
        const vnParts = getVNNowParts(nowDate);
        const shiftText = vnParts.hh >= 12 ? 'Ca chiều' : 'Ca sáng';
        const telemetry = describeLastPickOffsetVN(lastPickedStart, isToday, undefined, nowDate);
        const pickColorCls = getLastPickClass(lastPickedStart, lastPickTone);
        return (
          <div
            ref={popupCardRef}
            role="dialog"
            aria-label="Đồng hồ nổi"
            style={
              dragPos
                ? { left: dragPos.x, top: dragPos.y, right: 'auto', bottom: 'auto' }
                : undefined
            }
            className="no-print fixed bottom-5 right-5 z-50 w-[332px] rounded-xl border border-[#B6CBE3] dark:border-slate-700 bg-white dark:bg-[#0B1220] text-[#0F172A] dark:text-slate-100 shadow-[0_14px_34px_rgba(8,53,120,0.18)] dark:shadow-2xl overflow-hidden select-none"
          >
            <div
              onPointerDown={handleStartDrag}
              className="flex items-center justify-between px-3.5 py-2 bg-[#E8F1FC] dark:bg-[#111A2E] border-b border-[#C7D6E8] dark:border-slate-800 cursor-grab active:cursor-grabbing"
            >
              <div className="flex items-center gap-2 min-w-0 text-[11px] font-bold text-[#083578] dark:text-slate-200">
                <GripHorizontal className="w-3.5 h-3.5 text-[#475569] dark:text-slate-400 shrink-0" />
                <span className="uppercase tracking-wide whitespace-nowrap">Đồng hồ nổi</span>
                <span className="text-[#475569] dark:text-slate-500" aria-hidden="true">·</span>
                <span className="font-semibold text-[#334155] dark:text-slate-400 truncate">
                  {machineName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setFallbackOpen(false)}
                aria-label="Đóng đồng hồ nổi"
                className="p-1 rounded-md text-[#475569] dark:text-slate-400 hover:text-[#083578] dark:hover:text-white hover:bg-[#DCEBFF] dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-4 py-3.5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#0D4EA6] dark:text-sky-300">
                    Giờ hiện tại (VN)
                  </div>
                  <div className="text-[11px] font-semibold text-[#475569] dark:text-slate-400 mt-0.5">
                    {shiftText} · UTC+7
                  </div>
                </div>
                <span className="font-mono text-[26px] leading-none font-extrabold tabular-nums text-[#083578] dark:text-[#38BDF8]">
                  {nowText}
                </span>
              </div>

              <div className="pt-2.5 border-t border-[#E2EAF2] dark:border-slate-800/80 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#334155] dark:text-slate-300">
                    Đã chọn sau cùng
                  </div>
                  <div className={`text-[11px] font-mono font-bold tabular-nums mt-0.5 ${pickColorCls}`}>
                    {lastPickedStart
                      ? `${telemetry.statusLabel} · ${telemetry.deltaLabel}`
                      : telemetry.statusLabel}
                  </div>
                </div>
                <span
                  className={`font-mono text-[26px] leading-none font-extrabold tabular-nums ${pickColorCls}`}
                >
                  {lastPickedStart || '--:--'}
                </span>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
});

MultitaskingClockPip.displayName = 'MultitaskingClockPip';
