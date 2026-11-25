import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GripHorizontal, Tv, X } from 'lucide-react';
import { formatTimeVN } from '../utils/vnTime';

interface MultitaskingClockPipProps {
  machineName: string;
  lastPickedStart: string | null;
  lastPickTone: 'empty' | 'neutral' | 'now' | 'past' | 'overdue' | 'upcoming';
  isToday: boolean;
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
    case 'now':
      return '#34D399';
    case 'overdue':
      return '#F87171';
    case 'past':
      return '#FBBF24';
    case 'upcoming':
    case 'neutral':
    default:
      return '#F8FAFC';
  }
}

export const MultitaskingClockPip: React.FC<MultitaskingClockPipProps> = ({
  machineName,
  lastPickedStart,
  lastPickTone,
  isToday,
  onNotify,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [pipActive, setPipActive] = useState(false);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [nowText, setNowText] = useState(() => formatTimeVN(new Date()));

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
    const liveTime = formatTimeVN(new Date());
    setNowText(liveTime);

    // Background
    ctx.fillStyle = '#0B1220';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Subtle divider line between rows
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(32, 134);
    ctx.lineTo(CANVAS_W - 32, 134);
    ctx.stroke();

    // Subtle machine context centered near top (away from Chrome PiP corner buttons)
    ctx.fillStyle = '#64748B';
    ctx.font = '700 15px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const subLabel = todayFlag ? curMachine : `${curMachine} · Chỉ xem`;
    ctx.fillText(subLabel, CANVAS_W / 2, 26);

    // Row 1: Giờ hiện tại
    ctx.textAlign = 'left';
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 28px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
    ctx.fillText('Giờ hiện tại:', 34, 88);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#149CE0';
    ctx.font = '800 50px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(liveTime, CANVAS_W - 34, 88);

    // Row 2: Giờ đã chọn
    ctx.textAlign = 'left';
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 28px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
    ctx.fillText('Giờ đã chọn:', 34, 184);

    ctx.textAlign = 'right';
    ctx.fillStyle = getLastPickHex(picked, tone);
    ctx.font = '800 50px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(picked || '--:--', CANVAS_W - 34, 184);
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
      {fallbackOpen && (
        <div
          ref={popupCardRef}
          role="dialog"
          aria-label="Đồng hồ đa nhiệm"
          style={
            dragPos
              ? { left: dragPos.x, top: dragPos.y, right: 'auto', bottom: 'auto' }
              : undefined
          }
          className="no-print fixed bottom-20 right-5 z-50 w-[320px] rounded-xl border border-slate-700 bg-[#0B1220] text-slate-100 shadow-2xl overflow-hidden select-none"
        >
          <div
            onPointerDown={handleStartDrag}
            className="flex items-center justify-between px-3.5 py-2 bg-[#111A2E] border-b border-slate-800 cursor-grab active:cursor-grabbing"
          >
            <div className="flex items-center gap-2 min-w-0">
              <GripHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-700/80 text-[10px] font-bold tracking-wider text-slate-200 uppercase">
                TRỰC TIẾP
              </span>
              <span className="text-[11px] font-semibold text-slate-400 truncate">
                {machineName}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setFallbackOpen(false)}
              aria-label="Đóng đồng hồ đa nhiệm"
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-4 py-3.5 space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold text-slate-400">Giờ hiện tại:</span>
              <span className="font-mono text-2xl font-extrabold tabular-nums text-[#149CE0]">
                {nowText}
              </span>
            </div>
            <div className="pt-2.5 border-t border-slate-800/80 flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold text-slate-400">Giờ đã chọn:</span>
              <span
                style={{ color: getLastPickHex(lastPickedStart, lastPickTone) }}
                className="font-mono text-2xl font-extrabold tabular-nums"
              >
                {lastPickedStart || '--:--'}
              </span>
            </div>
            <div className="h-0.5 w-full rounded-full bg-emerald-500/80" />
          </div>
        </div>
      )}

      {/* Floating Bottom-Right Launcher Button */}
      <button
        type="button"
        onClick={() => void handleTogglePip()}
        title={
          isAnyOpen
            ? 'Đang bật đồng hồ đa nhiệm (nhấn để tắt)'
            : 'Mở cửa sổ đồng hồ nổi luôn hiển thị trên các ứng dụng khác'
        }
        className={`no-print fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white shadow-[0_6px_18px_rgba(22,163,74,0.34)] transition-all cursor-pointer whitespace-nowrap ${
          isAnyOpen
            ? 'bg-[#083578] hover:bg-[#06275B] ring-2 ring-emerald-400/70'
            : 'bg-[#16A34A] hover:bg-[#15803D]'
        }`}
      >
        <Tv className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>{isAnyOpen ? 'Đóng đồng hồ đa nhiệm' : 'Mở đồng hồ đa nhiệm'}</span>
        {isAnyOpen && (
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        )}
      </button>
    </>
  );
};
