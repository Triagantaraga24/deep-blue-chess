import { PIECE_VALUES } from '../core/constants.js';

const MG = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 5, 5, 0, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20,
    20, 30, 10, 0, 0, 10, 30, 20,
  ],
};

const EG = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0,
    80, 80, 80, 80, 80, 80, 80, 80,
    50, 50, 50, 50, 50, 50, 50, 50,
    30, 30, 30, 30, 30, 30, 30, 30,
    15, 15, 15, 15, 15, 15, 15, 15,
    5, 5, 5, 5, 5, 5, 5, 5,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0,
    10, 10, 10, 10, 10, 10, 10, 10,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    -5, 0, 5, 5, 5, 5, 0, -5,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  k: [
    -50, -40, -30, -20, -20, -30, -40, -50,
    -30, -20, -10, 0, 0, -10, -20, -30,
    -30, -10, 20, 30, 30, 20, -10, -30,
    -30, -10, 30, 40, 40, 30, -10, -30,
    -30, -10, 30, 40, 40, 30, -10, -30,
    -30, -10, 20, 30, 30, 20, -10, -30,
    -30, -30, 0, 0, 0, 0, -30, -30,
    -50, -30, -30, -30, -30, -30, -30, -50,
  ],
};

const PASSED_BONUS = [0, 8, 16, 30, 52, 82, 128, 0];

const PIECE_MG_VALUE = {
  p: PIECE_VALUES.p * 100,
  n: PIECE_VALUES.n * 100,
  b: PIECE_VALUES.b * 100,
  r: PIECE_VALUES.r * 100,
  q: PIECE_VALUES.q * 100,
  k: 0,
};

const PIECE_EG_VALUE = {
  p: 118,
  n: 330,
  b: 345,
  r: 530,
  q: 940,
  k: 0,
};

export function evaluate(chess) {
  const board = chess.board();
  let materialMg = 0;
  let materialEg = 0;
  let mg = 0;
  let eg = 0;
  let phase = 0;
  let whiteBishops = 0;
  let blackBishops = 0;

  const pawns = {
    w: { files: [0, 0, 0, 0, 0, 0, 0, 0], list: [] },
    b: { files: [0, 0, 0, 0, 0, 0, 0, 0], list: [] },
  };
  const rooks = { w: [], b: [] };
  const kings = { w: null, b: null };

  for (let row = 0; row < 8; row += 1) {
    const rank = board[row];
    for (let file = 0; file < 8; file += 1) {
      const piece = rank[file];
      if (!piece) continue;
      const index = row * 8 + file;
      const mirrored = index ^ 56;
      const tableIndex = piece.color === 'w' ? index : mirrored;
      const sign = piece.color === 'w' ? 1 : -1;
      const type = piece.type;

      materialMg += sign * PIECE_MG_VALUE[type];
      materialEg += sign * PIECE_EG_VALUE[type];
      mg += sign * MG[type][tableIndex];
      eg += sign * EG[type][tableIndex];

      if (type === 'n' || type === 'b') phase += 1;
      else if (type === 'r') phase += 2;
      else if (type === 'q') phase += 4;

      if (type === 'p') {
        pawns[piece.color].files[file] += 1;
        pawns[piece.color].list.push({ row, file });
      } else if (type === 'r') {
        rooks[piece.color].push({ row, file });
      } else if (type === 'b') {
        if (piece.color === 'w') whiteBishops += 1;
        else blackBishops += 1;
      } else if (type === 'k') {
        kings[piece.color] = { row, file };
      }
    }
  }

  let pawnMg = 0;
  let pawnEg = 0;

  for (const color of ['w', 'b']) {
    const own = pawns[color];
    const enemy = pawns[color === 'w' ? 'b' : 'w'];
    const sign = color === 'w' ? 1 : -1;

    for (let file = 0; file < 8; file += 1) {
      const count = own.files[file];
      if (count > 1) {
        pawnMg -= sign * 11 * (count - 1);
        pawnEg -= sign * 16 * (count - 1);
      }
      if (count > 0) {
        const left = file > 0 ? own.files[file - 1] : 0;
        const right = file < 7 ? own.files[file + 1] : 0;
        if (left === 0 && right === 0) {
          pawnMg -= sign * 14;
          pawnEg -= sign * 12;
        }
      }
    }

    for (const pawn of own.list) {
      const advance = color === 'w' ? 7 - pawn.row : pawn.row;
      const enemyAheadStart = color === 'w' ? pawn.row - 1 : pawn.row + 1;
      let blocked = false;
      for (let df = -1; df <= 1; df += 1) {
        const file = pawn.file + df;
        if (file < 0 || file > 7) continue;
        for (const enemyPawn of enemy.list) {
          if (enemyPawn.file !== file) continue;
          if (color === 'w' ? enemyPawn.row <= enemyAheadStart : enemyPawn.row >= enemyAheadStart) {
            blocked = true;
            break;
          }
        }
        if (blocked) break;
      }
      if (!blocked) {
        pawnMg += sign * PASSED_BONUS[advance] * 0.35;
        pawnEg += sign * PASSED_BONUS[advance];
      }
    }
  }

  mg += pawnMg;
  eg += pawnEg;

  let rookMg = 0;
  let rookEg = 0;
  for (const color of ['w', 'b']) {
    const sign = color === 'w' ? 1 : -1;
    const ownPawns = pawns[color].files;
    const enemyPawns = pawns[color === 'w' ? 'b' : 'w'].files;
    for (const rook of rooks[color]) {
      if (ownPawns[rook.file] === 0) {
        if (enemyPawns[rook.file] === 0) {
          rookMg += sign * 22;
          rookEg += sign * 16;
        } else {
          rookMg += sign * 10;
          rookEg += sign * 6;
        }
      }
    }
  }
  mg += rookMg;
  eg += rookEg;

  if (whiteBishops >= 2) {
    mg += 28;
    eg += 48;
  }
  if (blackBishops >= 2) {
    mg -= 28;
    eg -= 48;
  }

  for (const color of ['w', 'b']) {
    const king = kings[color];
    if (!king) continue;
    const sign = color === 'w' ? 1 : -1;
    const ownPawns = pawns[color].files;
    let shield = 0;
    for (let df = -1; df <= 1; df += 1) {
      const file = king.file + df;
      if (file < 0 || file > 7) continue;
      const one = color === 'w' ? king.row - 1 : king.row + 1;
      const two = color === 'w' ? king.row - 2 : king.row + 2;
      if (pawns[color].list.some((p) => p.file === file && p.row === one)) shield += 9;
      else if (pawns[color].list.some((p) => p.file === file && p.row === two)) shield += 4;
      if (ownPawns[file] === 0) shield -= 13;
    }
    mg += sign * shield;
  }

  const phaseWeight = Math.min(24, phase) / 24;
  const mgScore = materialMg + mg;
  const egScore = materialEg + eg + (materialEg < 0 ? -materialEg * 0.03 : materialEg * 0.03);
  const whiteScore = mgScore * phaseWeight + egScore * (1 - phaseWeight);
  const tempo = chess.turn() === 'w' ? 9 : -9;
  const total = whiteScore + tempo;
  return Math.round(chess.turn() === 'w' ? total : -total);
}

export function isNonPawnMaterial(chess, color) {
  const board = chess.board();
  for (const row of board) {
    for (const piece of row) {
      if (piece && piece.color === color && piece.type !== 'p' && piece.type !== 'k') {
        return true;
      }
    }
  }
  return false;
}
