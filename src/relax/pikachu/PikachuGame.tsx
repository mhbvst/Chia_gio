import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Info } from 'lucide-react';
import {
  addPikachuMatchedPairsStat,
  clearPikachuProgress,
  loadGlobalRelaxSettings,
  loadPikachuProgress,
  loadPikachuRecords,
  loadPikachuSettings,
  PikachuDifficulty,
  PikachuRecords,
  recordPikachuRoundStart,
  recordPikachuWin,
  saveGlobalRelaxSettings,
  savePikachuProgress,
  savePikachuSettings,
} from '../GameStorage';
import { soundManager } from '../GameSound';
import { getSpriteMap } from './GameAssets';
import {
  applyBoardGravity,
  BoardMatrix,
  calculateMatchScore,
  calculateWinBonus,
  countRemainingTiles,
  findConnectPath,
  findValidHintPair,
  generatePikachuBoard,
  getGravityForLevel,
  GridPoint,
  PIKACHU_DIFFICULTIES,
  shuffleRemainingTiles,
} from './GameEngine';
import { GameControls } from './GameControls';
import { GameHeader } from './GameHeader';
import { GameResultModal } from './GameResultModal';
import { GameSettingsModal } from './GameSettingsModal';
import { LeaderboardModal } from './LeaderboardModal';
import { PikachuBoard } from './PikachuBoard';

type RoundStatus = 'PLAYING' | 'PAUSED' | 'VICTORY' | 'GAME_OVER';

interface PikachuGameProps {
  globalSoundEnabled: boolean;
  onSyncGlobalSound: (enabled: boolean) => void;
  onExitToHub: () => void;
}

function getDefaultPortraitPreference(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 640;
}

export const PikachuGame: React.FC<PikachuGameProps> = ({
  globalSoundEnabled,
  onSyncGlobalSound,
  onExitToHub,
}) => {
  const initialSettings = useMemo(() => loadPikachuSettings(), []);
  const initialGlobal = useMemo(() => loadGlobalRelaxSettings(), []);

  const [difficulty, setDifficulty] = useState<PikachuDifficulty>(initialSettings.difficulty);
  const [basicMode, setBasicMode] = useState<boolean>(initialSettings.basicMode);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(globalSoundEnabled);
  const [portraitBoard, setPortraitBoard] = useState<boolean>(getDefaultPortraitPreference);
  const [playerName, setPlayerName] = useState<string>(initialGlobal.playerName);
  const [records, setRecords] = useState<PikachuRecords>(() => loadPikachuRecords());

  // Round state
  const [level, setLevel] = useState<number>(1);
  const [board, setBoard] = useState<BoardMatrix>(() => []);
  const [score, setScore] = useState<number>(0);
  const [moves, setMoves] = useState<number>(0);
  const [hintsUsed, setHintsUsed] = useState<number>(0);
  const [hintsLeft, setHintsLeft] = useState<number>(5);
  const [shufflesUsed, setShufflesUsed] = useState<number>(0);
  const [shufflesLeft, setShufflesLeft] = useState<number>(10);
  const [combo, setCombo] = useState<number>(0);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [totalTimeSec, setTotalTimeSec] = useState<number | null>(null);
  const [initialPairs, setInitialPairs] = useState<number>(0);
  const [matchedPairs, setMatchedPairs] = useState<number>(0);
  const [status, setStatus] = useState<RoundStatus>('PLAYING');

  // Interaction visual state
  const [selected, setSelected] = useState<GridPoint | null>(null);
  const [hintPair, setHintPair] = useState<{ a: GridPoint; b: GridPoint } | null>(null);
  const [activePath, setActivePath] = useState<GridPoint[] | null>(null);
  const [matchedFlashKeys, setMatchedFlashKeys] = useState<Set<string>>(() => new Set());
  const [mismatchKeys, setMismatchKeys] = useState<Set<string>>(() => new Set());
  const [noticeBanner, setNoticeBanner] = useState<string | null>(null);

  // Modals & result breakdown
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState<boolean>(false);
  const [restartConfirmOpen, setRestartConfirmOpen] = useState<boolean>(false);
  const [winSummary, setWinSummary] = useState<{
    bonusPoints: number;
    isNewBestScore: boolean;
    isNewBestTime: boolean;
  }>({ bonusPoints: 0, isNewBestScore: false, isNewBestTime: false });

  // Fullscreen
  const arenaRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const supportsFullscreen =
    typeof document !== 'undefined' && Boolean(document.documentElement.requestFullscreen);

  // Timing & timeout cleanup refs
  const lastMatchAtRef = useRef<number>(0);
  const noticeTimerRef = useRef<number | null>(null);
  const hintTimerRef = useRef<number | null>(null);
  const pathTimerRef = useRef<number | null>(null);
  const mismatchTimerRef = useRef<number | null>(null);
  const resolvingRef = useRef<boolean>(false);

  const spriteMap = useMemo(
    () => getSpriteMap(initialSettings.spritePackId),
    [initialSettings.spritePackId]
  );

  // Keep global & local sound synchronized without auto-playing audio
  useEffect(() => {
    setSoundEnabled(globalSoundEnabled);
    soundManager.setEnabled(globalSoundEnabled);
  }, [globalSoundEnabled]);

  const showNotice = useCallback((text: string) => {
    setNoticeBanner(text);
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => {
      setNoticeBanner(null);
    }, 3200);
  }, []);

  const clearTransientTimers = useCallback(() => {
    if (hintTimerRef.current !== null) window.clearTimeout(hintTimerRef.current);
    if (pathTimerRef.current !== null) window.clearTimeout(pathTimerRef.current);
    if (mismatchTimerRef.current !== null) window.clearTimeout(mismatchTimerRef.current);
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
  }, []);

  useEffect(() => {
    return () => clearTransientTimers();
  }, [clearTransientTimers]);

  const startFreshRound = useCallback(
    (opts: {
      nextDiff: PikachuDifficulty;
      nextBasic: boolean;
      nextPortrait: boolean;
      nextLevel: number;
      carryScore?: number;
    }) => {
      clearTransientTimers();
      resolvingRef.current = false;
      const cfg = PIKACHU_DIFFICULTIES[opts.nextDiff];
      const rows = opts.nextPortrait ? cfg.mobileRows : cfg.desktopRows;
      const cols = opts.nextPortrait ? cfg.mobileCols : cfg.desktopCols;
      const generated = generatePikachuBoard({
        rows,
        cols,
        distinctSprites: cfg.distinctSprites,
        spritePackId: initialSettings.spritePackId,
      });
      const pairs = (rows * cols) / 2;
      const timeLimit = opts.nextBasic ? null : cfg.timeLimitSec;
      const hints = opts.nextBasic ? 8 : cfg.initialHints;
      const shuffles = opts.nextBasic ? 12 : cfg.initialShuffles;

      setDifficulty(opts.nextDiff);
      setBasicMode(opts.nextBasic);
      setPortraitBoard(opts.nextPortrait);
      setLevel(opts.nextLevel);
      setBoard(generated);
      setScore(opts.carryScore ?? 0);
      setMoves(0);
      setHintsUsed(0);
      setHintsLeft(hints);
      setShufflesUsed(0);
      setShufflesLeft(shuffles);
      setCombo(0);
      setElapsedSec(0);
      setRemainingSec(timeLimit);
      setTotalTimeSec(timeLimit);
      setInitialPairs(pairs);
      setMatchedPairs(0);
      setStatus('PLAYING');
      setSelected(null);
      setHintPair(null);
      setActivePath(null);
      setMatchedFlashKeys(new Set());
      setMismatchKeys(new Set());
      setWinSummary({ bonusPoints: 0, isNewBestScore: false, isNewBestTime: false });
      lastMatchAtRef.current = 0;

      clearPikachuProgress();
      setRecords(recordPikachuRoundStart());
    },
    [clearTransientTimers, initialSettings.spritePackId]
  );

  // Initialize board from saved progress or start a fresh round
  useEffect(() => {
    const saved = loadPikachuProgress();
    const hasOnlyValidSprites =
      saved &&
      saved.board.length > 0 &&
      saved.board.every((row) => row.every((cell) => cell === null || Boolean(spriteMap[cell])));

    if (saved && hasOnlyValidSprites && countRemainingTiles(saved.board) >= 2) {
      const cfg = PIKACHU_DIFFICULTIES[saved.difficulty] || PIKACHU_DIFFICULTIES.normal;
      setDifficulty(saved.difficulty);
      setBasicMode(saved.basicMode);
      setPortraitBoard(saved.rows > saved.cols);
      setLevel(saved.level);
      setBoard(saved.board);
      setScore(saved.score);
      setMoves(saved.moves);
      setHintsUsed(saved.hintsUsed);
      setHintsLeft(Math.max(1, (saved.basicMode ? 8 : cfg.initialHints) - saved.hintsUsed));
      setShufflesUsed(saved.shufflesUsed);
      setShufflesLeft(Math.max(1, (saved.basicMode ? 12 : cfg.initialShuffles) - saved.shufflesUsed));
      setCombo(saved.combo);
      setElapsedSec(saved.elapsedSec);
      setRemainingSec(saved.basicMode ? null : saved.remainingSec);
      setTotalTimeSec(saved.basicMode ? null : cfg.timeLimitSec);
      setInitialPairs(saved.initialPairs);
      setMatchedPairs(saved.matchedPairs);
      setStatus('PLAYING');
      showNotice('Đã khôi phục ván chơi đang tạm lưu.');
      return;
    }

    if (saved && !hasOnlyValidSprites) {
      clearPikachuProgress();
    }

    startFreshRound({
      nextDiff: initialSettings.difficulty,
      nextBasic: initialSettings.basicMode,
      nextPortrait: getDefaultPortraitPreference(),
      nextLevel: 1,
    });
    // Only initialize on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist in-progress board state whenever core round state updates
  useEffect(() => {
    if (board.length === 0) return;
    if (status === 'VICTORY' || status === 'GAME_OVER') {
      clearPikachuProgress();
      return;
    }
    if (matchedPairs > 0 || moves > 0 || elapsedSec > 3) {
      savePikachuProgress({
        difficulty,
        basicMode,
        level,
        rows: board.length,
        cols: board[0]?.length ?? 0,
        board,
        score,
        moves,
        hintsUsed,
        shufflesUsed,
        combo,
        elapsedSec,
        remainingSec,
        initialPairs,
        matchedPairs,
        savedAt: new Date().toISOString(),
      });
    }
  }, [
    board,
    status,
    difficulty,
    basicMode,
    level,
    score,
    moves,
    hintsUsed,
    shufflesUsed,
    combo,
    elapsedSec,
    remainingSec,
    initialPairs,
    matchedPairs,
  ]);

  // 1-second timer while playing (pauses automatically when modal open or game paused)
  useEffect(() => {
    if (status !== 'PLAYING' || settingsOpen || leaderboardOpen || restartConfirmOpen) {
      return;
    }
    const id = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
      setRemainingSec((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          setStatus('GAME_OVER');
          soundManager.playGameOver();
          clearPikachuProgress();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [status, settingsOpen, leaderboardOpen, restartConfirmOpen]);

  // Fullscreen listener
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Escape key pauses/resumes active play if no modal is open
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (settingsOpen || leaderboardOpen || restartConfirmOpen) return;
      if (status === 'PLAYING') {
        setStatus('PAUSED');
      } else if (status === 'PAUSED') {
        setStatus('PLAYING');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [status, settingsOpen, leaderboardOpen, restartConfirmOpen]);

  const gravityMode = useMemo(
    () => getGravityForLevel(level, difficulty, basicMode),
    [level, difficulty, basicMode]
  );

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundManager.setEnabled(next);
    onSyncGlobalSound(next);
    savePikachuSettings({
      difficulty,
      basicMode,
      soundEnabled: next,
      spritePackId: initialSettings.spritePackId,
    });
    const global = loadGlobalRelaxSettings();
    saveGlobalRelaxSettings({ ...global, soundEnabled: next });
    if (next) soundManager.playSelect();
  };

  const handleShuffle = useCallback(
    (freeAutoShuffle = false) => {
      if (status !== 'PLAYING') return;
      if (!freeAutoShuffle && shufflesLeft <= 0) {
        showNotice('Bạn đã hết lượt đổi vị trí trong bàn này.');
        return;
      }
      setBoard((prev) => shuffleRemainingTiles(prev));
      setSelected(null);
      setHintPair(null);
      if (!freeAutoShuffle) {
        setShufflesLeft((c) => Math.max(0, c - 1));
        setShufflesUsed((c) => c + 1);
        showNotice('Đã xáo trộn lại vị trí các ô còn lại.');
      } else {
        showNotice('Không còn nước đi hợp lệ — hệ thống đã tự động xáo trộn.');
      }
      soundManager.playShuffle();
    },
    [status, shufflesLeft, showNotice]
  );

  const handleHint = () => {
    if (status !== 'PLAYING') return;
    if (hintsLeft <= 0) {
      showNotice('Bạn đã dùng hết lượt gợi ý ở bàn này.');
      return;
    }
    const found = findValidHintPair(board);
    if (!found) {
      showNotice('Hiện không còn cặp nối hợp lệ — hãy nhấn Đổi vị trí.');
      return;
    }
    setHintPair({ a: found.a, b: found.b });
    setHintsLeft((c) => Math.max(0, c - 1));
    setHintsUsed((c) => c + 1);
    soundManager.playHint();
    if (hintTimerRef.current !== null) window.clearTimeout(hintTimerRef.current);
    hintTimerRef.current = window.setTimeout(() => {
      setHintPair(null);
    }, 2600);
  };

  const handleToggleBasicMode = () => {
    const nextBasic = !basicMode;
    setBasicMode(nextBasic);
    savePikachuSettings({
      difficulty,
      basicMode: nextBasic,
      soundEnabled,
      spritePackId: initialSettings.spritePackId,
    });
    if (nextBasic) {
      setRemainingSec(null);
      setTotalTimeSec(null);
      showNotice('Đã bật Chế độ Cơ bản: tắt đồng hồ đếm ngược và hiệu ứng phụ.');
    } else {
      const cfg = PIKACHU_DIFFICULTIES[difficulty];
      const restored = cfg.timeLimitSec
        ? Math.max(60, cfg.timeLimitSec - elapsedSec)
        : null;
      setRemainingSec(restored);
      setTotalTimeSec(cfg.timeLimitSec);
      showNotice('Đã tắt Chế độ Cơ bản: bật lại đồng hồ thử thách.');
    }
  };

  const handleTileSelect = (pt: GridPoint) => {
    if (status !== 'PLAYING' || resolvingRef.current) return;
    const cellVal = board[pt.r]?.[pt.c];
    if (!cellVal) return;

    if (selected && selected.r === pt.r && selected.c === pt.c) {
      setSelected(null);
      soundManager.playDeselect();
      return;
    }

    if (!selected) {
      setSelected(pt);
      soundManager.playSelect();
      return;
    }

    // Attempting a pair match
    const first = selected;
    const path = findConnectPath(board, first, pt);

    if (!path) {
      // Mismatch or blocked path
      setMoves((m) => m + 1);
      setCombo(0);
      setSelected(null);
      const keys = new Set([`${first.r}:${first.c}`, `${pt.r}:${pt.c}`]);
      setMismatchKeys(keys);
      soundManager.playMismatch();
      if (mismatchTimerRef.current !== null) window.clearTimeout(mismatchTimerRef.current);
      mismatchTimerRef.current = window.setTimeout(() => {
        setMismatchKeys(new Set());
      }, 240);
      return;
    }

    // Valid match!
    resolvingRef.current = true;
    const nowMs = Date.now();
    const isChain = nowMs - lastMatchAtRef.current <= 4500;
    const nextCombo = isChain ? combo + 1 : 1;
    lastMatchAtRef.current = nowMs;

    const earned = calculateMatchScore({
      combo: nextCombo,
      difficulty,
      basicMode,
    });
    const nextScore = score + earned;
    const nextMoves = moves + 1;
    const nextMatched = matchedPairs + 1;

    setSelected(null);
    setHintPair(null);
    setCombo(nextCombo);
    setMoves(nextMoves);
    setScore(nextScore);
    setMatchedPairs(nextMatched);
    setActivePath(path);
    setMatchedFlashKeys(new Set([`${first.r}:${first.c}`, `${pt.r}:${pt.c}`]));
    soundManager.playMatch(nextCombo);
    setRecords(addPikachuMatchedPairsStat(1));

    if (pathTimerRef.current !== null) window.clearTimeout(pathTimerRef.current);
    pathTimerRef.current = window.setTimeout(() => {
      // Commit removal + gravity
      const cleared = board.map((r) => [...r]);
      cleared[first.r][first.c] = null;
      cleared[pt.r][pt.c] = null;
      let afterGravity = applyBoardGravity(cleared, gravityMode);
      const remCount = countRemainingTiles(afterGravity);

      setActivePath(null);
      setMatchedFlashKeys(new Set());
      resolvingRef.current = false;

      if (remCount === 0) {
        // Level Won!
        const bonusPoints = calculateWinBonus({
          difficulty,
          basicMode,
          remainingSec,
          elapsedSec,
          hintsUsed,
          shufflesUsed,
        });
        const finalScore = nextScore + bonusPoints;
        setBoard(afterGravity);
        setScore(finalScore);
        setStatus('VICTORY');
        soundManager.playWin();
        clearPikachuProgress();

        const winRes = recordPikachuWin({
          playerName,
          difficulty,
          basicMode,
          level,
          score: finalScore,
          timeSec: elapsedSec,
          moves: nextMoves,
          hintsUsed,
          shufflesUsed,
        });
        setRecords(winRes.records);
        setWinSummary({
          bonusPoints,
          isNewBestScore: winRes.isNewBestScore,
          isNewBestTime: winRes.isNewBestTime,
        });
        return;
      }

      // Check deadlock and auto-reshuffle cleanly if needed
      if (!findValidHintPair(afterGravity)) {
        afterGravity = shuffleRemainingTiles(afterGravity);
        showNotice('Không còn nước đi hợp lệ — hệ thống đã tự động xáo trộn.');
        soundManager.playShuffle();
      }
      setBoard(afterGravity);
    }, 220);
  };

  const requestRestart = () => {
    if ((status === 'PLAYING' || status === 'PAUSED') && (matchedPairs > 0 || moves > 0)) {
      setRestartConfirmOpen(true);
      return;
    }
    startFreshRound({
      nextDiff: difficulty,
      nextBasic: basicMode,
      nextPortrait: portraitBoard,
      nextLevel: 1,
    });
  };

  const handleToggleFullscreen = () => {
    if (!supportsFullscreen) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      void arenaRef.current?.requestFullscreen?.().catch(() => {});
    }
  };

  return (
    <div
      ref={arenaRef}
      className="min-h-full rounded-2xl bg-[radial-gradient(ellipse_at_50%_35%,#114357_0%,#0A2536_55%,#061420_100%)] text-slate-100 border border-cyan-500/20 shadow-xl px-2.5 sm:px-5 py-3 sm:py-4 flex flex-col gap-2.5 sm:gap-3 overflow-x-hidden"
    >
      {/* Compact Top Arena Navigation Row */}
      <div className="w-full max-w-[820px] mx-auto flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            if (document.fullscreenElement) {
              void document.exitFullscreen().catch(() => {});
            }
            onExitToHub();
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-slate-200 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Menu Thư giãn</span>
        </button>

        <div className="text-right">
          <h2 className="text-xs sm:text-sm font-extrabold font-display text-white tracking-tight">
            Pikachu Classic – Pokémon Connect
          </h2>
        </div>
      </div>

      {/* HUD Metrics & Progress Bar */}
      <GameHeader
        level={level}
        shufflesLeft={shufflesLeft}
        score={score}
        bestScore={records.bestScore}
        moves={moves}
        matchedPairs={matchedPairs}
        initialPairs={initialPairs}
        remainingSec={remainingSec}
        totalTimeSec={totalTimeSec}
        elapsedSec={elapsedSec}
        difficulty={difficulty}
        basicMode={basicMode}
        gravityMode={gravityMode}
        combo={combo}
        onOpenLeaderboard={() => setLeaderboardOpen(true)}
      />

      {/* Non-blocking live notice banner (auto-shuffle, hint limits, restore) */}
      {noticeBanner && (
        <div
          role="status"
          className="w-full max-w-[820px] mx-auto flex items-center justify-center gap-2 rounded-xl border border-sky-400/30 bg-sky-500/15 px-3 py-1.5 text-xs font-bold text-sky-200"
        >
          <Info className="w-4 h-4 shrink-0 text-sky-300" />
          <span>{noticeBanner}</span>
        </div>
      )}

      {/* Center Game Grid */}
      <PikachuBoard
        board={board}
        spriteMap={spriteMap}
        selected={selected}
        hintPair={hintPair}
        activePath={activePath}
        matchedFlashKeys={matchedFlashKeys}
        mismatchKeys={mismatchKeys}
        basicMode={basicMode}
        paused={status === 'PAUSED'}
        onTileSelect={handleTileSelect}
        onResume={() => setStatus('PLAYING')}
        onRestart={requestRestart}
        onExitToHub={onExitToHub}
      />

      {/* Bottom Arcade Controls */}
      <GameControls
        soundEnabled={soundEnabled}
        shufflesLeft={shufflesLeft}
        hintsLeft={hintsLeft}
        basicMode={basicMode}
        paused={status === 'PAUSED'}
        isFullscreen={isFullscreen}
        supportsFullscreen={supportsFullscreen}
        onToggleSound={handleToggleSound}
        onShuffle={() => handleShuffle(false)}
        onHint={handleHint}
        onToggleBasicMode={handleToggleBasicMode}
        onOpenSettings={() => setSettingsOpen(true)}
        onTogglePause={() => setStatus((s) => (s === 'PAUSED' ? 'PLAYING' : 'PAUSED'))}
        onRestart={requestRestart}
        onToggleFullscreen={handleToggleFullscreen}
      />

      {/* Settings Modal */}
      <GameSettingsModal
        open={settingsOpen}
        difficulty={difficulty}
        basicMode={basicMode}
        soundEnabled={soundEnabled}
        portraitBoard={portraitBoard}
        playerName={playerName}
        onClose={() => setSettingsOpen(false)}
        onApply={(next) => {
          setSettingsOpen(false);
          setSoundEnabled(next.soundEnabled);
          soundManager.setEnabled(next.soundEnabled);
          onSyncGlobalSound(next.soundEnabled);
          setPlayerName(next.playerName);
          savePikachuSettings({
            difficulty: next.difficulty,
            basicMode: next.basicMode,
            soundEnabled: next.soundEnabled,
            spritePackId: initialSettings.spritePackId,
          });
          saveGlobalRelaxSettings({
            soundEnabled: next.soundEnabled,
            playerName: next.playerName,
          });

          if (next.restartRequired) {
            startFreshRound({
              nextDiff: next.difficulty,
              nextBasic: next.basicMode,
              nextPortrait: next.portraitBoard,
              nextLevel: 1,
            });
          } else if (next.basicMode !== basicMode) {
            setBasicMode(next.basicMode);
            if (next.basicMode) {
              setRemainingSec(null);
              setTotalTimeSec(null);
            } else {
              const cfg = PIKACHU_DIFFICULTIES[next.difficulty];
              setRemainingSec(
                cfg.timeLimitSec ? Math.max(60, cfg.timeLimitSec - elapsedSec) : null
              );
              setTotalTimeSec(cfg.timeLimitSec);
            }
          }
        }}
      />

      {/* Leaderboard Modal */}
      <LeaderboardModal
        open={leaderboardOpen}
        records={records}
        onClose={() => setLeaderboardOpen(false)}
      />

      {/* Victory / Game Over Modal */}
      {(status === 'VICTORY' || status === 'GAME_OVER') && (
        <GameResultModal
          status={status}
          level={level}
          score={score}
          bonusPoints={winSummary.bonusPoints}
          elapsedSec={elapsedSec}
          moves={moves}
          hintsUsed={hintsUsed}
          shufflesUsed={shufflesUsed}
          isNewBestScore={winSummary.isNewBestScore}
          isNewBestTime={winSummary.isNewBestTime}
          onNextLevel={() =>
            startFreshRound({
              nextDiff: difficulty,
              nextBasic: basicMode,
              nextPortrait: portraitBoard,
              nextLevel: level + 1,
              carryScore: score,
            })
          }
          onRestart={() =>
            startFreshRound({
              nextDiff: difficulty,
              nextBasic: basicMode,
              nextPortrait: portraitBoard,
              nextLevel: 1,
            })
          }
          onExitToHub={onExitToHub}
        />
      )}

      {/* Unfinished Round Restart Confirmation */}
      {restartConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Xác nhận chơi lại"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRestartConfirmOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs"
        >
          <div className="w-full max-w-sm rounded-2xl border border-amber-400/25 bg-[#0D2130] text-slate-100 p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-extrabold font-display text-white">
              Xác nhận tạo bàn chơi mới?
            </h3>
            <p className="text-xs leading-relaxed text-slate-300">
              Ván chơi hiện tại chưa hoàn thành. Khi chơi lại, điểm số và lượt đi của ván này sẽ
              được đặt lại từ đầu (kỷ lục cá nhân vẫn được giữ nguyên).
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRestartConfirmOpen(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-slate-200 cursor-pointer"
              >
                Tiếp tục ván này
              </button>
              <button
                type="button"
                onClick={() => {
                  setRestartConfirmOpen(false);
                  startFreshRound({
                    nextDiff: difficulty,
                    nextBasic: basicMode,
                    nextPortrait: portraitBoard,
                    nextLevel: 1,
                  });
                }}
                className="px-4 py-2 text-xs font-extrabold rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer"
              >
                Chơi bàn mới
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
