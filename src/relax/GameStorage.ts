export type PikachuDifficulty = 'easy' | 'normal' | 'hard' | 'challenge';

export interface RelaxGlobalSettings {
  soundEnabled: boolean;
  playerName: string;
}

export interface PikachuGameSettings {
  difficulty: PikachuDifficulty;
  basicMode: boolean;
  soundEnabled: boolean;
  spritePackId: string;
}

export interface PikachuLeaderboardEntry {
  id: string;
  playerName: string;
  difficulty: PikachuDifficulty;
  basicMode: boolean;
  level: number;
  score: number;
  timeSec: number;
  moves: number;
  hintsUsed: number;
  shufflesUsed: number;
  achievedAt: string;
}

export interface DifficultyRecord {
  bestScore: number;
  bestTimeSec: number | null;
}

export interface PikachuRecords {
  bestScore: number;
  bestTimeSec: number | null;
  totalPlayed: number;
  totalWins: number;
  totalMatchedPairs: number;
  bestByDifficulty: Record<PikachuDifficulty, DifficultyRecord>;
  leaderboard: PikachuLeaderboardEntry[];
}

export interface PikachuSavedProgress {
  difficulty: PikachuDifficulty;
  basicMode: boolean;
  level: number;
  rows: number;
  cols: number;
  board: (string | null)[][];
  score: number;
  moves: number;
  hintsUsed: number;
  shufflesUsed: number;
  combo: number;
  elapsedSec: number;
  remainingSec: number | null;
  initialPairs: number;
  matchedPairs: number;
  savedAt: string;
}

const GLOBAL_SETTINGS_KEY = 'relax_games_global_settings';
const PIKACHU_SETTINGS_KEY = 'relax_games_pikachu_settings';
const PIKACHU_RECORDS_KEY = 'relax_games_pikachu_records';
const PIKACHU_PROGRESS_KEY = 'relax_games_pikachu_progress';

export const DEFAULT_GLOBAL_SETTINGS: RelaxGlobalSettings = {
  soundEnabled: true,
  playerName: 'Kỹ thuật viên',
};

export const DEFAULT_PIKACHU_SETTINGS: PikachuGameSettings = {
  difficulty: 'normal',
  basicMode: false,
  soundEnabled: true,
  spritePackId: 'kanto-retro',
};

export const DEFAULT_PIKACHU_RECORDS: PikachuRecords = {
  bestScore: 0,
  bestTimeSec: null,
  totalPlayed: 0,
  totalWins: 0,
  totalMatchedPairs: 0,
  bestByDifficulty: {
    easy: { bestScore: 0, bestTimeSec: null },
    normal: { bestScore: 0, bestTimeSec: null },
    hard: { bestScore: 0, bestTimeSec: null },
    challenge: { bestScore: 0, bestTimeSec: null },
  },
  leaderboard: [],
};

function safeReadJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeWriteJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota or private mode errors
  }
}

function normalizeDifficulty(val: unknown): PikachuDifficulty {
  if (val === 'easy' || val === 'normal' || val === 'hard' || val === 'challenge') {
    return val;
  }
  return 'normal';
}

export function loadGlobalRelaxSettings(): RelaxGlobalSettings {
  const parsed = safeReadJson<Partial<RelaxGlobalSettings>>(GLOBAL_SETTINGS_KEY);
  if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_GLOBAL_SETTINGS };
  return {
    soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : true,
    playerName:
      typeof parsed.playerName === 'string' && parsed.playerName.trim()
        ? parsed.playerName.trim().slice(0, 32)
        : DEFAULT_GLOBAL_SETTINGS.playerName,
  };
}

export function saveGlobalRelaxSettings(settings: RelaxGlobalSettings): void {
  safeWriteJson(GLOBAL_SETTINGS_KEY, {
    soundEnabled: Boolean(settings.soundEnabled),
    playerName:
      (settings.playerName || '').trim().slice(0, 32) || DEFAULT_GLOBAL_SETTINGS.playerName,
  });
}

export function loadPikachuSettings(): PikachuGameSettings {
  const parsed = safeReadJson<Partial<PikachuGameSettings>>(PIKACHU_SETTINGS_KEY);
  if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_PIKACHU_SETTINGS };
  return {
    difficulty: normalizeDifficulty(parsed.difficulty),
    basicMode: Boolean(parsed.basicMode),
    soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : true,
    spritePackId:
      typeof parsed.spritePackId === 'string' && parsed.spritePackId
        ? parsed.spritePackId
        : 'kanto-retro',
  };
}

export function savePikachuSettings(settings: PikachuGameSettings): void {
  safeWriteJson(PIKACHU_SETTINGS_KEY, settings);
}

export function loadPikachuRecords(): PikachuRecords {
  const parsed = safeReadJson<Partial<PikachuRecords>>(PIKACHU_RECORDS_KEY);
  if (!parsed || typeof parsed !== 'object') {
    return {
      ...DEFAULT_PIKACHU_RECORDS,
      bestByDifficulty: { ...DEFAULT_PIKACHU_RECORDS.bestByDifficulty },
      leaderboard: [],
    };
  }
  const byDiff = parsed.bestByDifficulty || ({} as Partial<Record<PikachuDifficulty, DifficultyRecord>>);
  const cleanDiff = (d: PikachuDifficulty): DifficultyRecord => {
    const rec = byDiff[d];
    return {
      bestScore: typeof rec?.bestScore === 'number' && rec.bestScore >= 0 ? rec.bestScore : 0,
      bestTimeSec:
        typeof rec?.bestTimeSec === 'number' && rec.bestTimeSec >= 0 ? rec.bestTimeSec : null,
    };
  };
  const leaderboard = Array.isArray(parsed.leaderboard)
    ? parsed.leaderboard
        .filter(
          (e): e is PikachuLeaderboardEntry =>
            Boolean(e) &&
            typeof e.id === 'string' &&
            typeof e.score === 'number' &&
            typeof e.timeSec === 'number'
        )
        .slice(0, 50)
    : [];

  return {
    bestScore: typeof parsed.bestScore === 'number' && parsed.bestScore >= 0 ? parsed.bestScore : 0,
    bestTimeSec:
      typeof parsed.bestTimeSec === 'number' && parsed.bestTimeSec >= 0
        ? parsed.bestTimeSec
        : null,
    totalPlayed:
      typeof parsed.totalPlayed === 'number' && parsed.totalPlayed >= 0 ? parsed.totalPlayed : 0,
    totalWins:
      typeof parsed.totalWins === 'number' && parsed.totalWins >= 0 ? parsed.totalWins : 0,
    totalMatchedPairs:
      typeof parsed.totalMatchedPairs === 'number' && parsed.totalMatchedPairs >= 0
        ? parsed.totalMatchedPairs
        : 0,
    bestByDifficulty: {
      easy: cleanDiff('easy'),
      normal: cleanDiff('normal'),
      hard: cleanDiff('hard'),
      challenge: cleanDiff('challenge'),
    },
    leaderboard,
  };
}

export function savePikachuRecords(records: PikachuRecords): void {
  safeWriteJson(PIKACHU_RECORDS_KEY, records);
}

export function recordPikachuRoundStart(): PikachuRecords {
  const current = loadPikachuRecords();
  const next: PikachuRecords = {
    ...current,
    totalPlayed: current.totalPlayed + 1,
  };
  savePikachuRecords(next);
  return next;
}

export function addPikachuMatchedPairsStat(pairsDelta: number): PikachuRecords {
  const current = loadPikachuRecords();
  const next: PikachuRecords = {
    ...current,
    totalMatchedPairs: current.totalMatchedPairs + Math.max(0, pairsDelta),
  };
  savePikachuRecords(next);
  return next;
}

export function recordPikachuWin(params: {
  playerName: string;
  difficulty: PikachuDifficulty;
  basicMode: boolean;
  level: number;
  score: number;
  timeSec: number;
  moves: number;
  hintsUsed: number;
  shufflesUsed: number;
}): { records: PikachuRecords; isNewBestScore: boolean; isNewBestTime: boolean } {
  const current = loadPikachuRecords();
  const isNewBestScore = params.score > current.bestScore;
  const isNewBestTime =
    current.bestTimeSec === null || params.timeSec < current.bestTimeSec;

  const prevDiff = current.bestByDifficulty[params.difficulty];
  const nextDiff: DifficultyRecord = {
    bestScore: Math.max(prevDiff.bestScore, params.score),
    bestTimeSec:
      prevDiff.bestTimeSec === null
        ? params.timeSec
        : Math.min(prevDiff.bestTimeSec, params.timeSec),
  };

  const entry: PikachuLeaderboardEntry = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    playerName: (params.playerName || '').trim() || DEFAULT_GLOBAL_SETTINGS.playerName,
    difficulty: params.difficulty,
    basicMode: params.basicMode,
    level: params.level,
    score: params.score,
    timeSec: params.timeSec,
    moves: params.moves,
    hintsUsed: params.hintsUsed,
    shufflesUsed: params.shufflesUsed,
    achievedAt: new Date().toISOString(),
  };

  const leaderboard = [entry, ...current.leaderboard]
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.timeSec - b.timeSec))
    .slice(0, 30);

  const next: PikachuRecords = {
    ...current,
    bestScore: Math.max(current.bestScore, params.score),
    bestTimeSec:
      current.bestTimeSec === null
        ? params.timeSec
        : Math.min(current.bestTimeSec, params.timeSec),
    totalWins: current.totalWins + 1,
    bestByDifficulty: {
      ...current.bestByDifficulty,
      [params.difficulty]: nextDiff,
    },
    leaderboard,
  };

  savePikachuRecords(next);
  return { records: next, isNewBestScore, isNewBestTime };
}

export function loadPikachuProgress(): PikachuSavedProgress | null {
  const parsed = safeReadJson<PikachuSavedProgress>(PIKACHU_PROGRESS_KEY);
  if (!parsed || typeof parsed !== 'object') return null;
  if (!Array.isArray(parsed.board) || parsed.board.length === 0) return null;
  if (typeof parsed.rows !== 'number' || typeof parsed.cols !== 'number') return null;
  return parsed;
}

export function savePikachuProgress(progress: PikachuSavedProgress): void {
  safeWriteJson(PIKACHU_PROGRESS_KEY, progress);
}

export function clearPikachuProgress(): void {
  try {
    localStorage.removeItem(PIKACHU_PROGRESS_KEY);
  } catch {
    // Ignore storage errors
  }
}
