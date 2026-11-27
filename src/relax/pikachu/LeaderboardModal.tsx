import React, { useEffect, useState } from 'react';
import { Trophy, X } from 'lucide-react';
import { PikachuDifficulty, PikachuRecords } from '../GameStorage';
import { formatDurationMMSS, PIKACHU_DIFFICULTIES } from './GameEngine';

interface LeaderboardModalProps {
  open: boolean;
  records: PikachuRecords;
  onClose: () => void;
}

type FilterDiff = 'all' | PikachuDifficulty;

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  open,
  records,
  onClose,
}) => {
  const [filterDiff, setFilterDiff] = useState<FilterDiff>('all');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const entries = records.leaderboard.filter(
    (item) => filterDiff === 'all' || item.difficulty === filterDiff
  );

  const winRate =
    records.totalPlayed > 0
      ? Math.round((records.totalWins / records.totalPlayed) * 100)
      : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bảng xếp hạng và kỷ lục cá nhân"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-cyan-400/20 bg-[#0D2130] text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[85dvh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#0A1A26] shrink-0">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-5 h-5 text-amber-300" />
            <div>
              <h2 className="text-base font-extrabold font-display text-white">
                Bảng xếp hạng & Thành tích cá nhân
              </h2>
              <p className="text-xs text-slate-400">
                Lưu trữ trực tiếp các ván thắng thực tế trên trình duyệt này
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng bảng xếp hạng"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Lifetime Personal Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-xl border border-white/10 bg-[#132E41] p-3">
              <div className="text-[11px] font-bold uppercase text-slate-400">Kỷ lục điểm</div>
              <div className="mt-0.5 font-mono text-xl font-extrabold tabular-nums text-amber-300">
                {records.bestScore.toLocaleString('vi-VN')}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#132E41] p-3">
              <div className="text-[11px] font-bold uppercase text-slate-400">Nhanh nhất</div>
              <div className="mt-0.5 font-mono text-xl font-extrabold tabular-nums text-sky-300">
                {records.bestTimeSec !== null ? formatDurationMMSS(records.bestTimeSec) : '--:--'}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#132E41] p-3">
              <div className="text-[11px] font-bold uppercase text-slate-400">Ván thắng / Chơi</div>
              <div className="mt-0.5 font-mono text-xl font-extrabold tabular-nums text-emerald-300">
                {records.totalWins}/{records.totalPlayed}
              </div>
              <div className="text-[10.5px] text-slate-400">Tỷ lệ thắng {winRate}%</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#132E41] p-3">
              <div className="text-[11px] font-bold uppercase text-slate-400">Cặp đã ghép</div>
              <div className="mt-0.5 font-mono text-xl font-extrabold tabular-nums text-white">
                {records.totalMatchedPairs.toLocaleString('vi-VN')}
              </div>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[#091823] border border-white/10">
            {(
              [
                { id: 'all', label: 'Tất cả' },
                { id: 'easy', label: 'Dễ' },
                { id: 'normal', label: 'Bình thường' },
                { id: 'hard', label: 'Khó' },
                { id: 'challenge', label: 'Thử thách' },
              ] as { id: FilterDiff; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterDiff(tab.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  filterDiff === tab.id
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Real entries list */}
          {entries.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-[#132E41]/60 py-10 px-4 text-center text-sm text-slate-300">
              Chưa có thành tích hoàn thành ván nào ở mục này. Hãy hoàn thành một bàn chơi để ghi danh kỷ lục cá nhân.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#102736]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0A1A26] text-slate-300 border-b border-white/10">
                  <tr>
                    <th className="py-2.5 px-3 font-bold">#</th>
                    <th className="py-2.5 px-3 font-bold">Người chơi</th>
                    <th className="py-2.5 px-3 font-bold">Độ khó</th>
                    <th className="py-2.5 px-3 font-bold text-right">Điểm</th>
                    <th className="py-2.5 px-3 font-bold text-right">Thời gian</th>
                    <th className="py-2.5 px-3 font-bold text-right">Ngày đạt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {entries.map((entry, idx) => {
                    const dateTxt = (() => {
                      try {
                        return new Intl.DateTimeFormat('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        }).format(new Date(entry.achievedAt));
                      } catch {
                        return '—';
                      }
                    })();
                    return (
                      <tr key={entry.id} className="hover:bg-white/5">
                        <td className="py-2.5 px-3 font-mono font-extrabold tabular-nums text-amber-300">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-white">
                          {entry.playerName}
                          <span className="ml-1.5 text-[11px] font-normal text-slate-400">
                            · Bàn {entry.level}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {PIKACHU_DIFFICULTIES[entry.difficulty]?.label || entry.difficulty}
                          {entry.basicMode ? ' (Cơ bản)' : ''}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-extrabold tabular-nums text-right text-amber-300">
                          {entry.score.toLocaleString('vi-VN')}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold tabular-nums text-right text-sky-300">
                          {formatDurationMMSS(entry.timeSec)}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-right text-slate-400">
                          {dateTxt}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
