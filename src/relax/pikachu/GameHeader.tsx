import React from 'react';
import { Trophy } from 'lucide-react';
import { PikachuDifficulty } from '../GameStorage';
import { formatDurationMMSS, GravityMode, PIKACHU_DIFFICULTIES } from './GameEngine';

interface GameHeaderProps {
  level: number;
  shufflesLeft: number;
  score: number;
  bestScore: number;
  moves: number;
  matchedPairs: number;
  initialPairs: number;
  remainingSec: number | null;
  totalTimeSec: number | null;
  elapsedSec: number;
  difficulty: PikachuDifficulty;
  basicMode: boolean;
  gravityMode: GravityMode;
  combo: number;
  onOpenLeaderboard: () => void;
}

export const GameHeader: React.FC<GameHeaderProps> = ({
  level,
  shufflesLeft,
  score,
  bestScore,
  moves,
  matchedPairs,
  initialPairs,
  remainingSec,
  totalTimeSec,
  elapsedSec,
  difficulty,
  basicMode,
  gravityMode,
  combo,
  onOpenLeaderboard,
}) => {
  const diffLabel = basicMode
    ? 'Cơ bản (Không giới hạn giờ)'
    : PIKACHU_DIFFICULTIES[difficulty].label;

  const progressRatio =
    remainingSec !== null && totalTimeSec && totalTimeSec > 0
      ? Math.max(0, Math.min(100, (remainingSec / totalTimeSec) * 100))
      : initialPairs > 0
      ? Math.max(0, Math.min(100, (matchedPairs / initialPairs) * 100))
      : 0;

  const isTimeLow = remainingSec !== null && remainingSec <= 30;

  return (
    <div className="w-full max-w-[820px] mx-auto space-y-2.5">
      {/* Top 5 Retro Metric Cards centered cleanly like the reference arcade HUD */}
      <div className="max-w-[540px] mx-auto grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-2.5">
        <div className="rounded-xl border border-white/10 bg-[#1A3B4C]/85 px-2.5 py-1.5 text-center shadow-sm">
          <div className="text-[10px] font-bold tracking-wider text-slate-300 uppercase">
            Bàn
          </div>
          <div className="mt-0.5 font-mono text-xl sm:text-2xl font-extrabold tabular-nums text-sky-400 leading-tight">
            {level}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#1A3B4C]/85 px-2.5 py-1.5 text-center shadow-sm">
          <div className="text-[10px] font-bold tracking-wider text-slate-300 uppercase">
            Lượt đổi
          </div>
          <div className="mt-0.5 font-mono text-xl sm:text-2xl font-extrabold tabular-nums text-violet-300 leading-tight">
            {shufflesLeft}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#1A3B4C]/85 px-2.5 py-1.5 text-center shadow-sm">
          <div className="text-[10px] font-bold tracking-wider text-slate-300 uppercase">
            Điểm
          </div>
          <div className="mt-0.5 font-mono text-xl sm:text-2xl font-extrabold tabular-nums text-amber-300 leading-tight">
            {score.toLocaleString('vi-VN')}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#1A3B4C]/85 px-2.5 py-1.5 text-center shadow-sm col-span-2 sm:col-span-1">
          <div className="text-[10px] font-bold tracking-wider text-slate-300 uppercase">
            Kỷ lục
          </div>
          <div className="mt-0.5 font-mono text-xl sm:text-2xl font-extrabold tabular-nums text-emerald-400 leading-tight">
            {bestScore.toLocaleString('vi-VN')}
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenLeaderboard}
          title="Xem bảng xếp hạng & kỷ lục cá nhân"
          className="rounded-xl border border-white/15 bg-[#1A3B4C]/90 hover:bg-[#224C62] px-2.5 py-1.5 text-center shadow-sm transition-colors cursor-pointer flex flex-col items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <div className="text-[10px] font-bold tracking-wider text-slate-300 uppercase">
            Xếp hạng
          </div>
          <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-amber-300 mt-0.5" aria-hidden="true" />
        </button>
      </div>

      {/* Live Telemetry Line + Glowing Emerald Progress / Timer Bar */}
      <div className="space-y-1 px-0.5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-300">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sky-200">{diffLabel}</span>
            {gravityMode !== 'none' && (
              <>
                <span aria-hidden="true" className="text-slate-500">·</span>
                <span className="text-amber-200">
                  {gravityMode === 'down'
                    ? 'Rơi xuống'
                    : gravityMode === 'up'
                    ? 'Đẩy lên'
                    : gravityMode === 'left'
                    ? 'Dồn trái'
                    : 'Dồn phải'}
                </span>
              </>
            )}
            <span aria-hidden="true" className="text-slate-500">·</span>
            <span className="font-mono tabular-nums">
              Lượt đi: <strong className="text-white">{moves}</strong>
            </span>
            <span aria-hidden="true" className="text-slate-500">·</span>
            <span className="font-mono tabular-nums">
              Đã ghép: <strong className="text-emerald-300">{matchedPairs}/{initialPairs}</strong>
            </span>
            {combo >= 2 && !basicMode && (
              <>
                <span aria-hidden="true" className="text-slate-500">·</span>
                <span className="font-mono font-extrabold text-amber-300">
                  Chuỗi ×{combo}
                </span>
              </>
            )}
          </div>

          <div
            className={`font-mono font-bold tabular-nums ${
              isTimeLow ? 'text-rose-300' : 'text-emerald-300'
            }`}
          >
            {remainingSec !== null
              ? `Còn ${formatDurationMMSS(remainingSec)}`
              : `Thời gian: ${formatDurationMMSS(elapsedSec)}`}
          </div>
        </div>

        <div
          className="w-full h-2 rounded-full bg-[#091D2B] border border-white/10 overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progressRatio)}
          aria-label={remainingSec !== null ? 'Thời gian còn lại' : 'Tiến độ hoàn thành'}
        >
          <div
            className={`h-full rounded-full transition-[width] duration-300 ${
              isTimeLow
                ? 'bg-gradient-to-r from-amber-500 to-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.45)]'
                : 'bg-gradient-to-r from-emerald-400 to-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.45)]'
            }`}
            style={{ width: `${progressRatio}%` }}
          />
        </div>
      </div>
    </div>
  );
};
