import React from 'react';
import {
  Grid3X3,
  Lightbulb,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Shuffle,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface GameControlsProps {
  soundEnabled: boolean;
  shufflesLeft: number;
  hintsLeft: number;
  basicMode: boolean;
  paused: boolean;
  isFullscreen: boolean;
  supportsFullscreen: boolean;
  onToggleSound: () => void;
  onShuffle: () => void;
  onHint: () => void;
  onToggleBasicMode: () => void;
  onOpenSettings: () => void;
  onTogglePause: () => void;
  onRestart: () => void;
  onToggleFullscreen: () => void;
}

export const GameControls: React.FC<GameControlsProps> = ({
  soundEnabled,
  shufflesLeft,
  hintsLeft,
  basicMode,
  paused,
  isFullscreen,
  supportsFullscreen,
  onToggleSound,
  onShuffle,
  onHint,
  onToggleBasicMode,
  onOpenSettings,
  onTogglePause,
  onRestart,
  onToggleFullscreen,
}) => {
  return (
    <div className="w-full max-w-[820px] mx-auto flex flex-col items-center gap-2">
      {/* Primary 5-button arcade dock matching reference screenshot */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onToggleSound}
          aria-pressed={soundEnabled}
          className="inline-flex items-center gap-2 min-h-[42px] px-4 py-2 text-xs sm:text-sm font-bold rounded-xl border border-white/15 bg-[#1B3A4B]/90 hover:bg-[#234C61] text-slate-100 shadow-sm transition-colors cursor-pointer whitespace-nowrap"
        >
          {soundEnabled ? (
            <Volume2 className="w-4 h-4 text-slate-200 shrink-0" />
          ) : (
            <VolumeX className="w-4 h-4 text-slate-400 shrink-0" />
          )}
          <span>{soundEnabled ? 'Âm thanh' : 'Đã tắt tiếng'}</span>
        </button>

        <button
          type="button"
          disabled={paused || shufflesLeft <= 0}
          onClick={onShuffle}
          title={`Xáo trộn các ô còn lại trên bàn (còn ${shufflesLeft} lượt)`}
          className="inline-flex items-center gap-2 min-h-[42px] px-4 py-2 text-xs sm:text-sm font-bold rounded-xl border border-white/15 bg-[#1B3A4B]/90 hover:bg-[#234C61] text-slate-100 shadow-sm transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
        >
          <Shuffle className="w-4 h-4 text-slate-200 shrink-0" />
          <span>Đổi vị trí</span>
        </button>

        <button
          type="button"
          disabled={paused || hintsLeft <= 0}
          onClick={onHint}
          title={`Làm nổi bật một cặp có thể ghép hợp lệ (còn ${hintsLeft} lượt)`}
          className="relative inline-flex items-center gap-2 min-h-[42px] px-5 py-2 text-xs sm:text-sm font-extrabold rounded-xl bg-gradient-to-b from-[#FDE047] to-[#FACC15] hover:from-[#FEF08A] hover:to-[#FDE047] text-slate-950 border border-amber-300 shadow-[0_6px_18px_rgba(250,204,21,0.3)] transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
        >
          <Lightbulb className="w-4 h-4 shrink-0" />
          <span>Gợi ý</span>
          <span
            aria-label={`Còn ${hintsLeft} lượt gợi ý`}
            className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full text-[11px] font-mono font-extrabold bg-[#EF4444] text-white ring-2 ring-[#0A2536] shadow"
          >
            {hintsLeft}
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          title="Chọn cỡ bàn và độ khó"
          className="inline-flex items-center gap-2 min-h-[42px] px-4 py-2 text-xs sm:text-sm font-bold rounded-xl border border-white/15 bg-[#1B3A4B]/90 hover:bg-[#234C61] text-slate-100 shadow-sm transition-colors cursor-pointer whitespace-nowrap"
        >
          <Grid3X3 className="w-4 h-4 text-slate-200 shrink-0" />
          <span>Cỡ bàn</span>
        </button>

        <button
          type="button"
          onClick={onRestart}
          className="inline-flex items-center gap-2 min-h-[42px] px-4 py-2 text-xs sm:text-sm font-bold rounded-xl border border-white/15 bg-[#1B3A4B]/90 hover:bg-[#234C61] text-slate-100 shadow-sm transition-colors cursor-pointer whitespace-nowrap"
        >
          <RotateCcw className="w-4 h-4 text-slate-200 shrink-0" />
          <span>Chơi lại</span>
        </button>
      </div>

      {/* Compact Secondary Utilities Row */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={onToggleBasicMode}
          aria-pressed={basicMode}
          title="Bật/tắt chế độ Cơ bản: tắt đồng hồ đếm ngược & giảm hiệu ứng"
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
            basicMode
              ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
              : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span>{basicMode ? 'Chế độ Cơ bản: Bật' : 'Chế độ Cơ bản'}</span>
        </button>

        <button
          type="button"
          onClick={onTogglePause}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 transition-colors cursor-pointer whitespace-nowrap"
        >
          {paused ? (
            <Play className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
          ) : (
            <Pause className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          )}
          <span>{paused ? 'Tiếp tục (Esc)' : 'Tạm dừng (Esc)'}</span>
        </button>

        {supportsFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            title={isFullscreen ? 'Thoát toàn màn hình' : 'Chơi toàn màn hình'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5 text-sky-300 shrink-0" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 text-sky-300 shrink-0" />
            )}
            <span>{isFullscreen ? 'Thu gọn' : 'Toàn màn hình'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
