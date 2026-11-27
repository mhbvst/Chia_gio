import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Clock,
  Gamepad2,
  Play,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import relaxBannerImg from '../assets/images/relax_hub_banner_1795777279771.jpg';
import { RELAX_GAME_LIBRARY, RelaxGameCatalogItem, RelaxGameId } from './GameLibrary';
import { soundManager } from './GameSound';
import {
  loadGlobalRelaxSettings,
  loadPikachuRecords,
  PikachuRecords,
  saveGlobalRelaxSettings,
} from './GameStorage';
import { formatDurationMMSS } from './pikachu/GameEngine';
import { PikachuGame } from './pikachu/PikachuGame';

interface RelaxMenuProps {
  onBackToApp: () => void;
}

function renderUpcomingArtwork(item: RelaxGameCatalogItem): React.ReactNode {
  switch (item.id) {
    case 'sudoku':
      return (
        <svg viewBox="0 0 120 72" className="w-24 h-14 text-sky-300" aria-hidden="true">
          <rect x="24" y="6" width="72" height="60" rx="6" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <line x1="48" y1="6" x2="48" y2="66" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.6" />
          <line x1="72" y1="6" x2="72" y2="66" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.6" />
          <line x1="24" y1="26" x2="96" y2="26" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.6" />
          <line x1="24" y1="46" x2="96" y2="46" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.6" />
          <text x="36" y="21" textAnchor="middle" fill="#E0F2FE" fontSize="13" fontWeight="800" fontFamily="monospace">5</text>
          <text x="60" y="41" textAnchor="middle" fill="#38BDF8" fontSize="13" fontWeight="800" fontFamily="monospace">9</text>
          <text x="84" y="61" textAnchor="middle" fill="#E0F2FE" fontSize="13" fontWeight="800" fontFamily="monospace">3</text>
        </svg>
      );
    case 'minesweeper':
      return (
        <svg viewBox="0 0 120 72" className="w-24 h-14" aria-hidden="true">
          <rect x="22" y="10" width="24" height="24" rx="4" fill="#334155" stroke="#64748B" strokeWidth="1.5" />
          <rect x="48" y="10" width="24" height="24" rx="4" fill="#1E293B" stroke="#475569" strokeWidth="1.5" />
          <rect x="74" y="10" width="24" height="24" rx="4" fill="#334155" stroke="#64748B" strokeWidth="1.5" />
          <text x="60" y="27" textAnchor="middle" fill="#38BDF8" fontSize="14" fontWeight="800" fontFamily="monospace">2</text>
          <path d="M86 15 v14 M86 15 l8 4 l-8 4" stroke="#EF4444" strokeWidth="2.2" fill="#EF4444" strokeLinecap="round" />
          <circle cx="60" cy="52" r="9" fill="#EF4444" fillOpacity="0.22" stroke="#F87171" strokeWidth="2" />
          <circle cx="60" cy="52" r="4" fill="#F87171" />
        </svg>
      );
    case '2048':
      return (
        <svg viewBox="0 0 120 72" className="w-24 h-14" aria-hidden="true">
          <rect x="18" y="16" width="38" height="40" rx="6" fill="#F59E0B" fillOpacity="0.22" stroke="#FBBF24" strokeWidth="2" />
          <rect x="64" y="16" width="38" height="40" rx="6" fill="#F59E0B" stroke="#FDE68A" strokeWidth="2" />
          <text x="37" y="41" textAnchor="middle" fill="#FDE68A" fontSize="14" fontWeight="800" fontFamily="monospace">512</text>
          <text x="83" y="41" textAnchor="middle" fill="#0F172A" fontSize="13" fontWeight="900" fontFamily="monospace">2048</text>
        </svg>
      );
    case 'caro':
      return (
        <svg viewBox="0 0 120 72" className="w-24 h-14" aria-hidden="true">
          <line x1="48" y1="10" x2="48" y2="62" stroke="#475569" strokeWidth="2" />
          <line x1="72" y1="10" x2="72" y2="62" stroke="#475569" strokeWidth="2" />
          <line x1="24" y1="28" x2="96" y2="28" stroke="#475569" strokeWidth="2" />
          <line x1="24" y1="46" x2="96" y2="46" stroke="#475569" strokeWidth="2" />
          <path d="M31 14 L41 24 M41 14 L31 24" stroke="#34D399" strokeWidth="2.8" strokeLinecap="round" />
          <circle cx="60" cy="37" r="6" fill="none" stroke="#F87171" strokeWidth="2.8" />
          <path d="M79 50 L89 60 M89 50 L79 60" stroke="#34D399" strokeWidth="2.8" strokeLinecap="round" />
        </svg>
      );
    case 'memory':
      return (
        <svg viewBox="0 0 120 72" className="w-24 h-14" aria-hidden="true">
          <rect x="26" y="12" width="28" height="48" rx="6" fill="#7C3AED" fillOpacity="0.25" stroke="#A78BFA" strokeWidth="2" />
          <rect x="66" y="12" width="28" height="48" rx="6" fill="#7C3AED" fillOpacity="0.25" stroke="#A78BFA" strokeWidth="2" />
          <polygon points="40,26 46,36 40,46 34,36" fill="#C4B5FD" />
          <polygon points="80,26 86,36 80,46 74,36" fill="#C4B5FD" />
        </svg>
      );
    case 'puzzle':
      return (
        <svg viewBox="0 0 120 72" className="w-24 h-14" aria-hidden="true">
          <rect x="28" y="10" width="28" height="24" rx="4" fill="#FB7185" fillOpacity="0.3" stroke="#FB7185" strokeWidth="2" />
          <rect x="64" y="10" width="28" height="24" rx="4" fill="#FB7185" fillOpacity="0.18" stroke="#FDA4AF" strokeWidth="2" />
          <rect x="28" y="38" width="28" height="24" rx="4" fill="#FB7185" fillOpacity="0.18" stroke="#FDA4AF" strokeWidth="2" />
          <rect x="64" y="38" width="28" height="24" rx="4" fill="none" stroke="#64748B" strokeDasharray="4 3" strokeWidth="1.5" />
        </svg>
      );
    case 'snake':
    default:
      return (
        <svg viewBox="0 0 120 72" className="w-24 h-14" aria-hidden="true">
          <path d="M22 48 H56 V26 H86" fill="none" stroke="#34D399" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="88" cy="26" r="5" fill="#10B981" />
          <circle cx="98" cy="48" r="5" fill="#F87171" />
        </svg>
      );
  }
}

export const RelaxMenu: React.FC<RelaxMenuProps> = ({ onBackToApp }) => {
  const [activeGame, setActiveGame] = useState<RelaxGameId | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(
    () => loadGlobalRelaxSettings().soundEnabled
  );
  const [records, setRecords] = useState<PikachuRecords>(() => loadPikachuRecords());
  const [bannerImgError, setBannerImgError] = useState(false);

  useEffect(() => {
    soundManager.setEnabled(soundEnabled);
  }, [soundEnabled]);

  // Refresh stats when returning from game to hub
  useEffect(() => {
    if (activeGame === null) {
      setRecords(loadPikachuRecords());
    }
  }, [activeGame]);

  const handleToggleGlobalSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundManager.setEnabled(next);
    const cur = loadGlobalRelaxSettings();
    saveGlobalRelaxSettings({ ...cur, soundEnabled: next });
    if (next) soundManager.playSelect();
  };

  if (activeGame === 'pikachu') {
    return (
      <div className="max-w-[1360px] mx-auto">
        <PikachuGame
          globalSoundEnabled={soundEnabled}
          onSyncGlobalSound={(next) => setSoundEnabled(next)}
          onExitToHub={() => setActiveGame(null)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-[1360px] mx-auto space-y-5">
      {/* Section Header */}
      <div className="bg-white dark:bg-slate-900 border border-[#C7D6E8] dark:border-slate-800 rounded-2xl px-5 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-[#0D4EA6] dark:bg-amber-400/20 text-white dark:text-amber-300 flex items-center justify-center shrink-0">
            <Gamepad2 className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-extrabold font-display text-[#083578] dark:text-white tracking-tight">
              Góc thư giãn
            </h2>
            <p className="text-xs sm:text-sm font-medium text-[#334155] dark:text-slate-400">
              Một chút giải trí, một chút thư thái.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleToggleGlobalSound}
            aria-pressed={soundEnabled}
            className="inline-flex items-center gap-2 h-9 px-3.5 text-xs font-bold rounded-lg border border-[#B6CBE3] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#0F172A] dark:text-slate-200 hover:bg-[#DCEBFF] dark:hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-[#0D4EA6] dark:text-sky-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-400" />
            )}
            <span>{soundEnabled ? 'Âm thanh: Bật' : 'Âm thanh: Tắt'}</span>
          </button>

          <button
            type="button"
            onClick={onBackToApp}
            className="inline-flex items-center gap-2 h-9 px-4 text-xs font-bold rounded-lg bg-[#0D4EA6] hover:bg-[#083578] text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại Lịch X-quang</span>
          </button>
        </div>
      </div>

      {/* Retro Gaming + Modern Featured Banner */}
      <section
        aria-label="Giới thiệu Góc thư giãn"
        className="relative rounded-2xl overflow-hidden border border-[#B6CBE3] dark:border-slate-800 bg-[#0A1E2E] text-white shadow-md min-h-[210px] sm:min-h-[240px] flex items-center"
      >
        {!bannerImgError ? (
          <img
            src={relaxBannerImg}
            alt="Không gian giải trí retro thư giãn"
            referrerPolicy="no-referrer"
            onError={() => setBannerImgError(true)}
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
        ) : (
          <div
            className="absolute inset-0 bg-gradient-to-br from-[#0A1E2E] via-[#12384D] to-[#081521]"
            aria-hidden="true"
          />
        )}
        <div
          className="absolute inset-0 bg-gradient-to-r from-[#071521]/95 via-[#091E2E]/85 to-[#071521]/45"
          aria-hidden="true"
        />

        <div className="relative z-10 w-full p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-xl space-y-2.5">
            <div className="text-xs font-bold tracking-wide text-amber-300">
              Menu Thư giãn · Trò chơi cổ điển
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold font-display tracking-tight text-white [text-wrap:balance]">
              Pikachu Classic – Pokémon Connect
            </h3>
            <p className="text-sm text-slate-200 leading-relaxed">
              Giải trí nhẹ nhàng sau những ca chụp căng thẳng với bộ sprite pixel cổ điển, nhiều mức
              độ khó, gợi ý thông minh, xáo trộn không bế tắc và lưu kỷ lục cá nhân.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveGame('pikachu')}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-extrabold rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-lg transition-colors cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Chơi Pikachu ngay</span>
              </button>
            </div>
          </div>

          {/* Real Personal Stats Summary */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3 shrink-0">
            <div className="rounded-xl border border-white/15 bg-[#081A27]/80 backdrop-blur-xs px-4 py-3 text-center min-w-[96px]">
              <div className="text-[11px] font-bold text-slate-300 uppercase">Kỷ lục điểm</div>
              <div className="mt-1 font-mono text-xl font-extrabold tabular-nums text-amber-300">
                {records.bestScore.toLocaleString('vi-VN')}
              </div>
            </div>
            <div className="rounded-xl border border-white/15 bg-[#081A27]/80 backdrop-blur-xs px-4 py-3 text-center min-w-[96px]">
              <div className="text-[11px] font-bold text-slate-300 uppercase">Nhanh nhất</div>
              <div className="mt-1 font-mono text-xl font-extrabold tabular-nums text-sky-300">
                {records.bestTimeSec !== null ? formatDurationMMSS(records.bestTimeSec) : '--:--'}
              </div>
            </div>
            <div className="rounded-xl border border-white/15 bg-[#081A27]/80 backdrop-blur-xs px-4 py-3 text-center min-w-[96px]">
              <div className="text-[11px] font-bold text-slate-300 uppercase">Ván thắng</div>
              <div className="mt-1 font-mono text-xl font-extrabold tabular-nums text-emerald-300">
                {records.totalWins}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modular Game Library Grid */}
      <section aria-label="Danh sách trò chơi thư giãn" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <h3 className="text-base font-extrabold font-display text-[#083578] dark:text-white">
            Kho trò chơi giải trí
          </h3>
          <span className="text-xs font-semibold text-[#334155] dark:text-slate-400">
            1 trò chơi đang sẵn sàng · 7 trò chơi đang phát triển thêm
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {RELAX_GAME_LIBRARY.map((game) => {
            const isAvailable = game.status === 'available';
            return (
              <article
                key={game.id}
                className={`rounded-2xl border bg-white dark:bg-slate-900 overflow-hidden flex flex-col transition-transform duration-200 ${
                  isAvailable
                    ? 'border-[#93BCEB] dark:border-amber-400/35 hover:-translate-y-0.5 shadow-sm hover:shadow-md'
                    : 'border-[#C7D6E8] dark:border-slate-800 opacity-90'
                }`}
              >
                {/* Card Media */}
                <div className="relative aspect-[16/10] bg-[#0B1E2E] overflow-hidden flex items-center justify-center">
                  {game.coverImage ? (
                    <img
                      src={game.coverImage}
                      alt={game.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#0F273B] via-[#13324A] to-[#091824] flex items-center justify-center p-4">
                      {renderUpcomingArtwork(game)}
                    </div>
                  )}
                </div>

                {/* Card Body */}
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-center justify-between gap-2 text-[11.5px] font-semibold text-[#475569] dark:text-slate-400">
                    <span className="truncate">{game.genre}</span>
                    <span className="shrink-0">·</span>
                    <span
                      className={`shrink-0 font-bold ${
                        isAvailable
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {isAvailable ? 'Sẵn sàng' : 'Sắp ra mắt'}
                    </span>
                  </div>

                  <h4 className="mt-1.5 text-[15px] font-extrabold font-display text-[#083578] dark:text-white leading-snug">
                    {game.title}
                  </h4>

                  <p className="mt-1.5 text-xs leading-relaxed text-[#334155] dark:text-slate-400 flex-1">
                    {game.description}
                  </p>

                  {isAvailable && game.id === 'pikachu' && records.totalPlayed > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-[#E2EAF2] dark:border-slate-800 flex items-center justify-between text-[11px] font-mono font-bold tabular-nums text-[#334155] dark:text-slate-300">
                      <span className="inline-flex items-center gap-1">
                        <Trophy className="w-3.5 h-3.5 text-amber-500" />
                        Kỷ lục: {records.bestScore.toLocaleString('vi-VN')}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-sky-500" />
                        {records.bestTimeSec !== null
                          ? formatDurationMMSS(records.bestTimeSec)
                          : '--:--'}
                      </span>
                    </div>
                  )}

                  <div className="mt-4">
                    {isAvailable ? (
                      <button
                        type="button"
                        onClick={() => setActiveGame(game.id)}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-extrabold rounded-xl bg-[#0D4EA6] hover:bg-[#083578] dark:bg-amber-400 dark:hover:bg-amber-300 text-white dark:text-slate-950 transition-colors cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Chơi ngay</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        aria-disabled="true"
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl border border-[#C7D6E8] dark:border-slate-800 bg-[#EEF4FB] dark:bg-slate-800/60 text-[#64748B] dark:text-slate-400 cursor-not-allowed"
                      >
                        <span>Sắp ra mắt</span>
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
};
