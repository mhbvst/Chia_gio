import React, { useEffect, useState } from 'react';
import { Check, Grid3X3, RotateCw, Sparkles, Volume2, VolumeX, X } from 'lucide-react';
import { PikachuDifficulty } from '../GameStorage';
import { PIKACHU_DIFFICULTIES } from './GameEngine';

interface GameSettingsModalProps {
  open: boolean;
  difficulty: PikachuDifficulty;
  basicMode: boolean;
  soundEnabled: boolean;
  portraitBoard: boolean;
  playerName: string;
  onClose: () => void;
  onApply: (next: {
    difficulty: PikachuDifficulty;
    basicMode: boolean;
    soundEnabled: boolean;
    portraitBoard: boolean;
    playerName: string;
    restartRequired: boolean;
  }) => void;
}

const DIFF_ORDER: PikachuDifficulty[] = ['easy', 'normal', 'hard', 'challenge'];

export const GameSettingsModal: React.FC<GameSettingsModalProps> = ({
  open,
  difficulty,
  basicMode,
  soundEnabled,
  portraitBoard,
  playerName,
  onClose,
  onApply,
}) => {
  const [draftDiff, setDraftDiff] = useState<PikachuDifficulty>(difficulty);
  const [draftBasic, setDraftBasic] = useState(basicMode);
  const [draftSound, setDraftSound] = useState(soundEnabled);
  const [draftPortrait, setDraftPortrait] = useState(portraitBoard);
  const [draftName, setDraftName] = useState(playerName);

  useEffect(() => {
    if (!open) return;
    setDraftDiff(difficulty);
    setDraftBasic(basicMode);
    setDraftSound(soundEnabled);
    setDraftPortrait(portraitBoard);
    setDraftName(playerName);
  }, [open, difficulty, basicMode, soundEnabled, portraitBoard, playerName]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const restartRequired = draftDiff !== difficulty || draftPortrait !== portraitBoard;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cài đặt trò chơi Pikachu"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-2xl border border-cyan-400/20 bg-[#0D2130] text-slate-100 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#0A1A26]">
          <div className="flex items-center gap-2.5">
            <Grid3X3 className="w-5 h-5 text-sky-400" />
            <div>
              <h2 className="text-base font-extrabold font-display text-white">
                Cỡ bàn & Độ khó
              </h2>
              <p className="text-xs text-slate-400">
                Điều chỉnh kích thước lưới, chế độ chơi và tên hiển thị kỷ lục
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cài đặt"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[75dvh] overflow-y-auto">
          {/* Difficulty picker */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Độ khó bàn chơi
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DIFF_ORDER.map((id) => {
                const cfg = PIKACHU_DIFFICULTIES[id];
                const active = draftDiff === id;
                const rows = draftPortrait ? cfg.mobileRows : cfg.desktopRows;
                const cols = draftPortrait ? cfg.mobileCols : cfg.desktopCols;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDraftDiff(id)}
                    className={`text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                      active
                        ? 'border-amber-400 bg-amber-400/15 text-white'
                        : 'border-white/10 bg-[#132E41] text-slate-300 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-extrabold">{cfg.label}</span>
                      <span className="font-mono text-xs font-bold text-sky-300 tabular-nums">
                        {cols}×{rows}
                      </span>
                    </div>
                    <div className="mt-1 text-[11.5px] text-slate-400">
                      {cfg.distinctSprites} hình ·{' '}
                      {cfg.timeLimitSec ? `${Math.round(cfg.timeLimitSec / 60)} phút` : 'Không giới hạn'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Orientation + Basic mode + Sound toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setDraftPortrait((v) => !v)}
              className={`flex items-center justify-between gap-3 p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                draftPortrait
                  ? 'border-sky-400/60 bg-sky-500/15 text-white'
                  : 'border-white/10 bg-[#132E41] text-slate-200 hover:border-white/25'
              }`}
            >
              <div className="min-w-0">
                <div className="text-xs font-bold flex items-center gap-1.5">
                  <RotateCw className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                  <span>Chiều bàn chơi</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {draftPortrait ? 'Dọc (tối ưu điện thoại)' : 'Ngang (chuẩn 16×10)'}
                </div>
              </div>
              <span className="font-mono text-xs font-bold text-sky-300 shrink-0">
                {draftPortrait ? 'Dọc' : 'Ngang'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setDraftBasic((v) => !v)}
              className={`flex items-center justify-between gap-3 p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                draftBasic
                  ? 'border-emerald-400/60 bg-emerald-500/15 text-white'
                  : 'border-white/10 bg-[#132E41] text-slate-200 hover:border-white/25'
              }`}
            >
              <div className="min-w-0">
                <div className="text-xs font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                  <span>Chế độ Cơ bản</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Tắt đếm ngược & giảm hiệu ứng
                </div>
              </div>
              <span className="font-mono text-xs font-bold text-emerald-300 shrink-0">
                {draftBasic ? 'Bật' : 'Tắt'}
              </span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setDraftSound((v) => !v)}
              className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/10 bg-[#132E41] text-slate-200 hover:border-white/25 text-left cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2 text-xs font-bold">
                {draftSound ? (
                  <Volume2 className="w-4 h-4 text-sky-300" />
                ) : (
                  <VolumeX className="w-4 h-4 text-slate-400" />
                )}
                <span>Âm thanh hiệu ứng</span>
              </div>
              <span className="font-mono text-xs font-bold text-sky-300">
                {draftSound ? 'Bật' : 'Tắt'}
              </span>
            </button>

            <div className="p-2.5 rounded-xl border border-white/10 bg-[#132E41]">
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                Tên lưu bảng xếp hạng
              </label>
              <input
                type="text"
                maxLength={28}
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Nhập tên của bạn..."
                className="w-full px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#091722] border border-white/15 text-white focus:outline-none focus:border-sky-400"
              />
            </div>
          </div>

          {restartRequired && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-200">
              Thay đổi độ khó hoặc chiều bàn chơi sẽ khởi tạo lại bàn chơi mới.
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-white/10 bg-[#0A1A26]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-bold rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-slate-200 cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() =>
              onApply({
                difficulty: draftDiff,
                basicMode: draftBasic,
                soundEnabled: draftSound,
                portraitBoard: draftPortrait,
                playerName: draftName.trim() || 'Người chơi',
                restartRequired,
              })
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-extrabold rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{restartRequired ? 'Áp dụng & Tạo bàn mới' : 'Lưu cài đặt'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
