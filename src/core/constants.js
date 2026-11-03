export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
export const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];

export const PIECE_GLYPHS = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};

export const PIECE_NAMES = {
  k: 'King',
  q: 'Queen',
  r: 'Rook',
  b: 'Bishop',
  n: 'Knight',
  p: 'Pawn',
};

export const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export const DIFFICULTIES = {
  novice: { label: 'Novice', depth: 2, timeMs: 400, randomness: 0.5, rating: 900 },
  club: { label: 'Club', depth: 3, timeMs: 900, randomness: 0.2, rating: 1400 },
  expert: { label: 'Expert', depth: 4, timeMs: 1700, randomness: 0.06, rating: 1800 },
  master: { label: 'Master', depth: 5, timeMs: 3000, randomness: 0.015, rating: 2200 },
  grandmaster: { label: 'Grandmaster', depth: 6, timeMs: 5200, randomness: 0, rating: 2500 },
};

export const TIME_CONTROLS = {
  '3,2': { initial: 180, increment: 2, label: '3 + 2' },
  '10,0': { initial: 600, increment: 0, label: '10 + 0' },
  '15,10': { initial: 900, increment: 10, label: '15 + 10' },
  '0,0': { initial: 0, increment: 0, label: 'Unlimited' },
};

export const CAMERA_PRESETS = {
  standard: { position: [0, 10.4, 12.2], target: [0, -0.15, 0], fov: 42 },
  top: { position: [0, 17.5, 0.01], target: [0, 0, 0], fov: 40 },
  white: { position: [0, 7.2, 11.6], target: [0, 0, -0.4], fov: 44 },
  black: { position: [0, 7.2, -11.6], target: [0, 0, 0.4], fov: 44 },
  cinematic: { position: [-8.8, 5.9, 9.2], target: [0, 0.15, 0], fov: 38 },
};

export const DEFAULT_SETTINGS = {
  sound: true,
  animations: true,
  hints: true,
  coordinates: true,
  lastMove: true,
  liveAnalysis: true,
  analysisDepth: 3,
  difficulty: 'master',
  timeControl: '10,0',
  book: true,
};

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const MATE_SCORE = 100000;
