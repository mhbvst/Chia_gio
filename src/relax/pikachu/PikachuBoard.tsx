import React from 'react';
import { Play, Pause, RotateCcw, Home } from 'lucide-react';
import { PikachuSpriteDef } from './GameAssets';
import { BoardMatrix, GridPoint } from './GameEngine';
import { PikachuTile } from './PikachuTile';

interface PikachuBoardProps {
  board: BoardMatrix;
  spriteMap: Record<string, PikachuSpriteDef>;
  selected: GridPoint | null;
  hintPair: { a: GridPoint; b: GridPoint } | null;
  activePath: GridPoint[] | null;
  matchedFlashKeys: Set<string>;
  mismatchKeys: Set<string>;
  basicMode: boolean;
  paused: boolean;
  onTileSelect: (pt: GridPoint) => void;
  onResume: () => void;
  onRestart: () => void;
  onExitToHub: () => void;
}

function pointKey(r: number, c: number): string {
  return `${r}:${c}`;
}

function toSvgCoord(pt: GridPoint, rows: number, cols: number): { x: number; y: number } {
  const x = pt.c < 0 ? -0.3 : pt.c >= cols ? cols + 0.3 : pt.c + 0.5;
  const y = pt.r < 0 ? -0.3 : pt.r >= rows ? rows + 0.3 : pt.r + 0.5;
  return { x, y };
}

export const PikachuBoard: React.FC<PikachuBoardProps> = ({
  board,
  spriteMap,
  selected,
  hintPair,
  activePath,
  matchedFlashKeys,
  mismatchKeys,
  basicMode,
  paused,
  onTileSelect,
  onResume,
  onRestart,
  onExitToHub,
}) => {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;

  // Calibrate board width so 48px-based pixel sprites align crisply (1x=48px, 2x Retina=96px) while keeping the full board visible
  const maxBoardWidthPx =
    cols >= 16 ? 860 : cols >= 12 ? 700 : cols >= 10 ? 560 : 440;

  const polylinePoints =
    activePath && activePath.length >= 2
      ? activePath
          .map((pt) => {
            const { x, y } = toSvgCoord(pt, rows, cols);
            return `${x},${y}`;
          })
          .join(' ')
      : null;

  return (
    <div className="w-full flex justify-center">
      <div
        className="relative w-full p-1 sm:p-1.5 select-none"
        style={{ maxWidth: `${maxBoardWidthPx}px` }}
      >
        <div
          className="relative w-full grid gap-[2px]"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          }}
        >
          {board.map((rowArr, r) =>
            rowArr.map((spriteId, c) => {
              const key = pointKey(r, c);
              const isSelected = Boolean(selected && selected.r === r && selected.c === c);
              const isHinted = Boolean(
                hintPair &&
                  ((hintPair.a.r === r && hintPair.a.c === c) ||
                    (hintPair.b.r === r && hintPair.b.c === c))
              );
              const isMatchedFlash = matchedFlashKeys.has(key);
              const isMismatchShake = mismatchKeys.has(key);

              return (
                <PikachuTile
                  key={key}
                  sprite={spriteId ? spriteMap[spriteId] : undefined}
                  isSelected={isSelected}
                  isHinted={isHinted}
                  isMatchedFlash={isMatchedFlash}
                  isMismatchShake={isMismatchShake}
                  basicMode={basicMode}
                  disabled={paused || !spriteId}
                  onSelect={() => onTileSelect({ r, c })}
                />
              );
            })
          )}

          {/* SVG Path Overlay: aligns 1:1 with grid cells & extends smoothly into outer ring */}
          {polylinePoints && (
            <svg
              viewBox={`0 0 ${cols} ${rows}`}
              className="pointer-events-none absolute inset-0 w-full h-full overflow-visible z-20"
              aria-hidden="true"
            >
              {!basicMode && (
                <polyline
                  points={polylinePoints}
                  fill="none"
                  stroke="#FACC15"
                  strokeOpacity="0.45"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              <polyline
                points={polylinePoints}
                fill="none"
                stroke="#38BDF8"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          )}
        </div>

        {/* Pause Screen Overlay (hides tiles cleanly while paused) */}
        {paused && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Trò chơi đang tạm dừng"
            className="absolute inset-0 z-30 rounded-2xl bg-[#071521]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center border border-cyan-400/20"
          >
            <div className="w-12 h-12 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-300 mb-3">
              <Pause className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-extrabold font-display text-white">
              Đang tạm dừng
            </h3>
            <p className="mt-1.5 text-sm text-slate-300 max-w-sm">
              Bộ đếm thời gian đã được dừng lại. Nhấn Tiếp tục để quay lại ván chơi hiện tại.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onResume}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 transition-colors cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Tiếp tục</span>
              </button>
              <button
                type="button"
                onClick={onRestart}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl border border-white/15 bg-white/10 hover:bg-white/15 text-white transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Chơi lại</span>
              </button>
              <button
                type="button"
                onClick={onExitToHub}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl border border-white/15 bg-slate-900/80 hover:bg-slate-800 text-slate-200 transition-colors cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Về Menu Thư giãn</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
