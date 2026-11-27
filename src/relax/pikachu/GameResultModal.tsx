import React from 'react';
import { Award, Clock, Home, Play, RotateCcw, Sparkles } from 'lucide-react';
import { formatDurationMMSS } from './GameEngine';

interface GameResultModalProps {
  status: 'VICTORY' | 'GAME_OVER';
  level: number;
  score: number;
  bonusPoints: number;
  elapsedSec: number;
  moves: number;
  hintsUsed: number;
  shufflesUsed: number;
  isNewBestScore: boolean;
  isNewBestTime: boolean;
  onNextLevel: () => void;
  onRestart: () => void;
  onExitToHub: () => void;
}

export const GameResultModal: React.FC<GameResultModalProps> = ({
  status,
  level,
  score,
  bonusPoints,
  elapsedSec,
  moves,
  hintsUsed,
  shufflesUsed,
  isNewBestScore,
  isNewBestTime,
  onNextLevel,
  onRestart,
  onExitToHub,
}) => {
  const isWin = status === 'VICTORY';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isWin ? 'Hoàn thành bàn chơi' : 'Hết thời gian'}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-2xl border border-cyan-400/25 bg-[#0D2130] text-slate-100 shadow-2xl overflow-hidden">
        <div className="px-6 pt-6 pb-4 text-center border-b border-white/10 bg-[#0A1A26]">
          <div
            className={`mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${
              isWin
                ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                : 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
            }`}
          >
            {isWin ? <Award className="w-7 h-7" /> : <Clock className="w-7 h-7" />}
          </div>
          <h2 className="text-xl font-extrabold font-display text-white">
            {isWin ? `Hoàn thành Bàn ${level}` : `Hết thời gian ở Bàn ${level}`}
          </h2>
          <p className="mt-1 text-xs font-medium text-slate-300">
            {isWin
              ? 'Toàn bộ các cặp hình trên bàn đã được ghép chính xác.'
              : 'Thời gian quy định đã kết thúc. Bạn có thể thử lại bàn chơi mới.'}
          </p>

          {(isNewBestScore || isNewBestTime) && isWin && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-xs font-extrabold text-emerald-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {isNewBestScore ? 'Kỷ lục điểm số mới!' : 'Kỷ lục thời gian hoàn thành mới!'}
              </span>
            </div>
          )}
        </div>

        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-white/10 bg-[#132E41] p-3">
              <div className="text-[11px] font-bold uppercase text-slate-400">Tổng điểm</div>
              <div className="mt-0.5 font-mono text-2xl font-extrabold tabular-nums text-amber-300">
                {score.toLocaleString('vi-VN')}
              </div>
              {isWin && bonusPoints > 0 && (
                <div className="text-[11px] font-mono text-emerald-300">
                  Bao gồm +{bonusPoints.toLocaleString('vi-VN')} thưởng
                </div>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-[#132E41] p-3">
              <div className="text-[11px] font-bold uppercase text-slate-400">Thời gian</div>
              <div className="mt-0.5 font-mono text-2xl font-extrabold tabular-nums text-sky-300">
                {formatDurationMMSS(elapsedSec)}
              </div>
              <div className="text-[11px] text-slate-400">Hoàn thành</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-white/10 bg-[#132E41] p-2.5">
              <div className="text-[10.5px] font-bold uppercase text-slate-400">Lượt đi</div>
              <div className="font-mono text-lg font-extrabold tabular-nums text-white mt-0.5">
                {moves}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#132E41] p-2.5">
              <div className="text-[10.5px] font-bold uppercase text-slate-400">Gợi ý đã dùng</div>
              <div className="font-mono text-lg font-extrabold tabular-nums text-white mt-0.5">
                {hintsUsed}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#132E41] p-2.5">
              <div className="text-[10.5px] font-bold uppercase text-slate-400">Đổi vị trí</div>
              <div className="font-mono text-lg font-extrabold tabular-nums text-white mt-0.5">
                {shufflesUsed}
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
            {isWin && (
              <button
                type="button"
                onClick={onNextLevel}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-extrabold rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 transition-colors cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Chơi Bàn {level + 1}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onRestart}
              className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-colors cursor-pointer ${
                isWin
                  ? 'border border-white/15 bg-white/10 hover:bg-white/15 text-white'
                  : 'bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              <span>Chơi lại</span>
            </button>
            <button
              type="button"
              onClick={onExitToHub}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl border border-white/15 bg-slate-900/70 hover:bg-slate-800 text-slate-200 transition-colors cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>Thoát</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
