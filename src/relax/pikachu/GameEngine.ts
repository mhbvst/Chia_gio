import { PikachuDifficulty } from '../GameStorage';
import { getSpritePack } from './GameAssets';

export interface GridPoint {
  r: number; // 0..rows-1 inside board, -1 or rows on outer border
  c: number; // 0..cols-1 inside board, -1 or cols on outer border
}

export type BoardMatrix = (string | null)[][];

export type GravityMode = 'none' | 'down' | 'up' | 'left' | 'right';

export interface DifficultyConfig {
  id: PikachuDifficulty;
  label: string;
  shortDesc: string;
  desktopRows: number;
  desktopCols: number;
  mobileRows: number;
  mobileCols: number;
  distinctSprites: number;
  timeLimitSec: number | null;
  initialHints: number;
  initialShuffles: number;
  scoreMultiplier: number;
  enableGravityLevels: boolean;
}

export const PIKACHU_DIFFICULTIES: Record<PikachuDifficulty, DifficultyConfig> = {
  easy: {
    id: 'easy',
    label: 'Dễ',
    shortDesc: '6×10 · Ít cặp hình · Thoải mái',
    desktopRows: 6,
    desktopCols: 10,
    mobileRows: 10,
    mobileCols: 6,
    distinctSprites: 15,
    timeLimitSec: 360,
    initialHints: 6,
    initialShuffles: 8,
    scoreMultiplier: 1.0,
    enableGravityLevels: false,
  },
  normal: {
    id: 'normal',
    label: 'Bình thường',
    shortDesc: '10×16 · Chuẩn cổ điển',
    desktopRows: 10,
    desktopCols: 16,
    mobileRows: 16,
    mobileCols: 10,
    distinctSprites: 26,
    timeLimitSec: 420,
    initialHints: 5,
    initialShuffles: 10,
    scoreMultiplier: 1.2,
    enableGravityLevels: true,
  },
  hard: {
    id: 'hard',
    label: 'Khó',
    shortDesc: '10×16 · Đủ 36 hình · Có trượt ô',
    desktopRows: 10,
    desktopCols: 16,
    mobileRows: 16,
    mobileCols: 10,
    distinctSprites: 36,
    timeLimitSec: 320,
    initialHints: 3,
    initialShuffles: 6,
    scoreMultiplier: 1.5,
    enableGravityLevels: true,
  },
  challenge: {
    id: 'challenge',
    label: 'Thử thách',
    shortDesc: '10×16 · Áp lực thời gian & ít gợi ý',
    desktopRows: 10,
    desktopCols: 16,
    mobileRows: 16,
    mobileCols: 10,
    distinctSprites: 36,
    timeLimitSec: 240,
    initialHints: 2,
    initialShuffles: 4,
    scoreMultiplier: 2.0,
    enableGravityLevels: true,
  },
};

export function getGravityForLevel(
  level: number,
  difficulty: PikachuDifficulty,
  basicMode: boolean
): GravityMode {
  if (basicMode) return 'none';
  if (!PIKACHU_DIFFICULTIES[difficulty].enableGravityLevels) return 'none';
  const mod = (Math.max(1, level) - 1) % 5;
  switch (mod) {
    case 1:
      return 'down';
    case 2:
      return 'up';
    case 3:
      return 'left';
    case 4:
      return 'right';
    default:
      return 'none';
  }
}

export function describeGravityMode(mode: GravityMode): string {
  switch (mode) {
    case 'down':
      return 'Trọng lực rơi xuống';
    case 'up':
      return 'Trọng lực đẩy lên';
    case 'left':
      return 'Dồn sang trái';
    case 'right':
      return 'Dồn sang phải';
    default:
      return 'Cố định cổ điển';
  }
}

export function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const DR = [-1, 0, 1, 0];
const DC = [0, 1, 0, -1];

/**
 * Finds the shortest Pikachu Connect path (max 2 turns = max 3 straight segments)
 * between two distinct non-empty cells `a` and `b`.
 * Path is allowed to traverse outside the grid border via a 1-cell padding ring.
 */
export function findConnectPath(
  board: BoardMatrix,
  a: GridPoint,
  b: GridPoint
): GridPoint[] | null {
  if (a.r === b.r && a.c === b.c) return null;
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  if (rows === 0 || cols === 0) return null;
  if (
    a.r < 0 ||
    a.r >= rows ||
    a.c < 0 ||
    a.c >= cols ||
    b.r < 0 ||
    b.r >= rows ||
    b.c < 0 ||
    b.c >= cols
  ) {
    return null;
  }

  const valA = board[a.r][a.c];
  const valB = board[b.r][b.c];
  if (!valA || !valB || valA !== valB) return null;

  // Pad grid by 1 on all 4 sides: padded indices 0..rows+1 and 0..cols+1
  const pRows = rows + 2;
  const pCols = cols + 2;
  const startR = a.r + 1;
  const startC = a.c + 1;
  const endR = b.r + 1;
  const endC = b.c + 1;

  // Store minimum turns achieved for each (r, c, dir)
  const totalStates = pRows * pCols * 4;
  const bestTurns = new Int8Array(totalStates);
  bestTurns.fill(99);

  interface Node {
    r: number;
    c: number;
    dir: number; // 0..3
    turns: number;
    prev: number; // index into nodes array
  }

  const nodes: Node[] = [];
  const queue: number[] = [];

  for (let d = 0; d < 4; d++) {
    const nr = startR + DR[d];
    const nc = startC + DC[d];
    if (nr < 0 || nr >= pRows || nc < 0 || nc >= pCols) continue;
    const isTarget = nr === endR && nc === endC;
    const isEmpty =
      nr === 0 ||
      nr === pRows - 1 ||
      nc === 0 ||
      nc === pCols - 1 ||
      board[nr - 1][nc - 1] === null;

    if (!isTarget && !isEmpty) continue;

    if (isTarget) {
      return [a, b];
    }

    const stateIdx = (nr * pCols + nc) * 4 + d;
    bestTurns[stateIdx] = 0;
    const nodeIdx = nodes.length;
    nodes.push({ r: nr, c: nc, dir: d, turns: 0, prev: -1 });
    queue.push(nodeIdx);
  }

  // BFS by turns (0 turns -> 1 turn -> 2 turns) to prioritize fewer turns
  let head = 0;
  let foundNodeIdx = -1;
  let foundTurns = 99;

  while (head < queue.length) {
    const curIdx = queue[head++];
    const cur = nodes[curIdx];
    if (cur.turns >= foundTurns) continue;

    for (let nd = 0; nd < 4; nd++) {
      // Cannot immediately reverse direction 180 degrees
      if ((nd + 2) % 4 === cur.dir) continue;
      const nextTurns = nd === cur.dir ? cur.turns : cur.turns + 1;
      if (nextTurns > 2 || nextTurns >= foundTurns) continue;

      const nr = cur.r + DR[nd];
      const nc = cur.c + DC[nd];
      if (nr < 0 || nr >= pRows || nc < 0 || nc >= pCols) continue;

      if (nr === endR && nc === endC) {
        foundTurns = nextTurns;
        const winIdx = nodes.length;
        nodes.push({ r: nr, c: nc, dir: nd, turns: nextTurns, prev: curIdx });
        foundNodeIdx = winIdx;
        if (foundTurns === 0) break;
        continue;
      }

      const isEmpty =
        nr === 0 ||
        nr === pRows - 1 ||
        nc === 0 ||
        nc === pCols - 1 ||
        board[nr - 1][nc - 1] === null;
      if (!isEmpty) continue;

      const stateIdx = (nr * pCols + nc) * 4 + nd;
      if (bestTurns[stateIdx] <= nextTurns) continue;
      bestTurns[stateIdx] = nextTurns;

      const nextNodeIdx = nodes.length;
      nodes.push({ r: nr, c: nc, dir: nd, turns: nextTurns, prev: curIdx });
      queue.push(nextNodeIdx);
    }
    if (foundTurns === 0) break;
  }

  if (foundNodeIdx === -1) return null;

  // Reconstruct padded coordinates -> convert back to board coordinates & compress collinear segments
  const rawPts: GridPoint[] = [];
  let trace = foundNodeIdx;
  while (trace !== -1) {
    const n = nodes[trace];
    rawPts.push({ r: n.r - 1, c: n.c - 1 });
    trace = n.prev;
  }
  rawPts.push(a);
  rawPts.reverse();

  // Keep only endpoints and corner vertices
  const corners: GridPoint[] = [rawPts[0]];
  for (let i = 1; i < rawPts.length - 1; i++) {
    const pPrev = corners[corners.length - 1];
    const pCur = rawPts[i];
    const pNext = rawPts[i + 1];
    const sameRow = pPrev.r === pCur.r && pCur.r === pNext.r;
    const sameCol = pPrev.c === pCur.c && pCur.c === pNext.c;
    if (!sameRow && !sameCol) {
      corners.push(pCur);
    }
  }
  corners.push(rawPts[rawPts.length - 1]);
  return corners;
}

export interface ValidMovePair {
  a: GridPoint;
  b: GridPoint;
  path: GridPoint[];
}

export function findValidHintPair(board: BoardMatrix): ValidMovePair | null {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const bySprite = new Map<string, GridPoint[]>();

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = board[r][c];
      if (!id) continue;
      const list = bySprite.get(id);
      if (list) list.push({ r, c });
      else bySprite.set(id, [{ r, c }]);
    }
  }

  for (const positions of bySprite.values()) {
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const path = findConnectPath(board, positions[i], positions[j]);
        if (path) {
          return { a: positions[i], b: positions[j], path };
        }
      }
    }
  }
  return null;
}

export function countRemainingTiles(board: BoardMatrix): number {
  let count = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell !== null) count++;
    }
  }
  return count;
}

/**
 * Shuffles only remaining non-null tiles while preserving exact pair counts
 * and guaranteeing at least one valid move if >= 2 tiles remain.
 */
export function shuffleRemainingTiles(board: BoardMatrix): BoardMatrix {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const positions: GridPoint[] = [];
  const tileIds: string[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = board[r][c];
      if (cell !== null) {
        positions.push({ r, c });
        tileIds.push(cell);
      }
    }
  }

  if (positions.length < 2) {
    return board.map((r) => [...r]);
  }

  for (let attempt = 0; attempt < 30; attempt++) {
    const shuffled = shuffleArray(tileIds);
    const nextBoard: BoardMatrix = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => null)
    );
    for (let i = 0; i < positions.length; i++) {
      const { r, c } = positions[i];
      nextBoard[r][c] = shuffled[i];
    }
    if (findValidHintPair(nextBoard)) {
      return nextBoard;
    }
  }

  // Deterministic fallback if random attempts all hit a rare checkerboard lock:
  // force one matching pair next to each other in the first two occupied slots.
  const forced = shuffleArray(tileIds);
  const firstId = forced[0];
  const partnerIdx = forced.findIndex((id, idx) => idx > 0 && id === firstId);
  if (partnerIdx > 1) {
    [forced[1], forced[partnerIdx]] = [forced[partnerIdx], forced[1]];
  }
  const nextBoard: BoardMatrix = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => null)
  );
  for (let i = 0; i < positions.length; i++) {
    const { r, c } = positions[i];
    nextBoard[r][c] = forced[i];
  }
  return nextBoard;
}

export function applyBoardGravity(board: BoardMatrix, mode: GravityMode): BoardMatrix {
  if (mode === 'none') return board.map((r) => [...r]);
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const next: BoardMatrix = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => null)
  );

  if (mode === 'down') {
    for (let c = 0; c < cols; c++) {
      let writeR = rows - 1;
      for (let r = rows - 1; r >= 0; r--) {
        if (board[r][c] !== null) {
          next[writeR--][c] = board[r][c];
        }
      }
    }
  } else if (mode === 'up') {
    for (let c = 0; c < cols; c++) {
      let writeR = 0;
      for (let r = 0; r < rows; r++) {
        if (board[r][c] !== null) {
          next[writeR++][c] = board[r][c];
        }
      }
    }
  } else if (mode === 'left') {
    for (let r = 0; r < rows; r++) {
      let writeC = 0;
      for (let c = 0; c < cols; c++) {
        if (board[r][c] !== null) {
          next[r][writeC++] = board[r][c];
        }
      }
    }
  } else if (mode === 'right') {
    for (let r = 0; r < rows; r++) {
      let writeC = cols - 1;
      for (let c = cols - 1; c >= 0; c--) {
        if (board[r][c] !== null) {
          next[r][writeC--] = board[r][c];
        }
      }
    }
  }

  return next;
}

export function generatePikachuBoard(params: {
  rows: number;
  cols: number;
  distinctSprites: number;
  spritePackId?: string;
}): BoardMatrix {
  const totalCells = params.rows * params.cols;
  if (totalCells % 2 !== 0) {
    throw new Error('Số ô bàn chơi phải là số chẵn.');
  }
  const totalPairs = totalCells / 2;
  const pack = getSpritePack(params.spritePackId);
  const availableSprites = shuffleArray(pack.sprites).slice(
    0,
    Math.min(Math.max(4, params.distinctSprites), pack.sprites.length)
  );

  const deck: string[] = [];
  for (let i = 0; i < totalPairs; i++) {
    const sprite = availableSprites[i % availableSprites.length];
    deck.push(sprite.id, sprite.id);
  }

  const emptyBoard: BoardMatrix = Array.from({ length: params.rows }, () =>
    Array.from({ length: params.cols }, () => null)
  );

  for (let attempt = 0; attempt < 25; attempt++) {
    const shuffled = shuffleArray(deck);
    let idx = 0;
    for (let r = 0; r < params.rows; r++) {
      for (let c = 0; c < params.cols; c++) {
        emptyBoard[r][c] = shuffled[idx++];
      }
    }
    if (findValidHintPair(emptyBoard)) {
      return emptyBoard.map((r) => [...r]);
    }
  }

  return shuffleRemainingTiles(emptyBoard);
}

export function calculateMatchScore(params: {
  combo: number;
  difficulty: PikachuDifficulty;
  basicMode: boolean;
}): number {
  const mult = params.basicMode ? 1.0 : PIKACHU_DIFFICULTIES[params.difficulty].scoreMultiplier;
  const comboBonus = Math.min(params.combo, 8) * 15;
  return Math.round((100 + comboBonus) * mult);
}

export function calculateWinBonus(params: {
  difficulty: PikachuDifficulty;
  basicMode: boolean;
  remainingSec: number | null;
  elapsedSec: number;
  hintsUsed: number;
  shufflesUsed: number;
}): number {
  const mult = params.basicMode ? 1.0 : PIKACHU_DIFFICULTIES[params.difficulty].scoreMultiplier;
  const timeBonus =
    params.remainingSec !== null && params.remainingSec > 0
      ? params.remainingSec * 8
      : Math.max(0, 600 - params.elapsedSec * 2);
  const efficiencyBonus =
    Math.max(0, 4 - params.hintsUsed) * 90 + Math.max(0, 5 - params.shufflesUsed) * 60;
  return Math.round((timeBonus + efficiencyBonus) * mult);
}

export function formatDurationMMSS(totalSec: number): string {
  const clamped = Math.max(0, Math.floor(totalSec));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
