import { evaluate, isNonPawnMaterial } from './evaluation.js';
import { MATE_SCORE } from '../core/constants.js';

const INFINITY = 1000000;
const MATE_BOUND = MATE_SCORE - 2000;
const PIECE_VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const MAX_PLY = 96;

const clockNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function squareIndex(square) {
  return square.charCodeAt(0) - 97 + (Number(square[1]) - 1) * 8;
}

function moveKey(move) {
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}

function sameMove(a, b) {
  if (!a || !b) return false;
  return a.from === b.from && a.to === b.to && (a.promotion ?? '') === (b.promotion ?? '');
}

function playMove(chess, move) {
  const payload = { from: move.from, to: move.to };
  if (move.promotion) payload.promotion = move.promotion;
  return chess.move(payload);
}

export class ChessEngine {
  constructor() {
    this.tt = new Map();
    this.maxTT = 320000;
    this.generation = 1;
    this.killers = Array.from({ length: MAX_PLY }, () => []);
    this.history = new Int32Array(64 * 64);
    this.nodes = 0;
    this.startTime = 0;
    this.deadline = Infinity;
    this.stopped = false;
    this.onProgress = null;
  }

  resetForSearch(timeLimit) {
    this.nodes = 0;
    this.stopped = false;
    this.startTime = clockNow();
    this.deadline = timeLimit > 0 ? this.startTime + timeLimit : Infinity;
    this.generation += 1;
    for (let i = 0; i < this.history.length; i += 1) {
      this.history[i] >>= 2;
    }
  }

  timeUp() {
    if (this.stopped) return true;
    if ((this.nodes & 1023) === 0 && clockNow() >= this.deadline) {
      this.stopped = true;
    }
    return this.stopped;
  }

  toTTScore(score, ply) {
    if (score > MATE_BOUND) return score + ply;
    if (score < -MATE_BOUND) return score - ply;
    return score;
  }

  fromTTScore(score, ply) {
    if (score > MATE_BOUND) return score - ply;
    if (score < -MATE_BOUND) return score + ply;
    return score;
  }

  storeTT(key, depth, score, flag, move, ply) {
    const existing = this.tt.get(key);
    if (existing && existing.depth > depth && existing.generation === this.generation) {
      return;
    }
    if (this.tt.size >= this.maxTT) {
      this.tt.clear();
    }
    this.tt.set(key, {
      depth,
      score: this.toTTScore(score, ply),
      flag,
      move,
      generation: this.generation,
    });
  }

  orderMoves(moves, ttMove, ply, capturesOnly = false) {
    const killers = this.killers[Math.min(ply, MAX_PLY - 1)] ?? [];
    const scored = [];
    for (const move of moves) {
      let score = 0;
      const key = moveKey(move);
      if (ttMove && sameMove(move, ttMove)) score += 2000000;
      if (move.captured) {
        score += 100000 + PIECE_VALUE[move.captured] * 10 - PIECE_VALUE[move.piece];
      }
      if (move.promotion) {
        score += 90000 + PIECE_VALUE[move.promotion];
      }
      if (!move.captured && killers.includes(key)) {
        score += killers[0] === key ? 85000 : 84000;
      }
      if (!move.captured && !move.promotion) {
        score += this.history[squareIndex(move.from) * 64 + squareIndex(move.to)] ?? 0;
      }
      if (capturesOnly) score += 0;
      scored.push({ move, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.map((item) => item.move);
  }

  addKiller(ply, move) {
    const key = moveKey(move);
    const slot = this.killers[Math.min(ply, MAX_PLY - 1)];
    if (!slot) return;
    if (slot[0] === key) return;
    slot[1] = slot[0];
    slot[0] = key;
  }

  bumpHistory(move, depth) {
    const index = squareIndex(move.from) * 64 + squareIndex(move.to);
    this.history[index] = Math.min(500000, this.history[index] + depth * depth);
  }

  search(chess, options = {}) {
    const {
      maxDepth = 5,
      timeLimit = 3000,
      useBook = false,
      bookMove = null,
      onProgress = null,
    } = options;

    this.resetForSearch(timeLimit);
    this.onProgress = onProgress;

    if (useBook && bookMove) {
      const legal = chess.moves({ verbose: true });
      const match = legal.find((move) => move.san === bookMove);
      if (match) {
        return {
          bestMove: match,
          score: 0,
          depth: 0,
          nodes: 0,
          time: 0,
          pv: [match.san],
          book: true,
          complete: true,
        };
      }
    }

    const rootEntry = this.tt.get(chess.hash());
    let previous = null;
    const alpha = -INFINITY;
    const beta = INFINITY;
    let lastPv = [];

    const maxIterations = Math.max(1, maxDepth);
    for (let depth = 1; depth <= maxIterations; depth += 1) {
      let result = null;
      let attempt = 0;
      let windowAlpha = alpha;
      let windowBeta = beta;

      if (depth >= 4 && previous && previous.depth >= depth - 2) {
        const window = depth >= 6 ? 32 : 48;
        windowAlpha = previous.score - window;
        windowBeta = previous.score + window;
      }

      while (attempt < 4) {
        result = this.searchRoot(chess, depth, windowAlpha, windowBeta, rootEntry);
        if (this.stopped || result.complete) break;
        attempt += 1;
        if (result.score <= windowAlpha) {
          windowAlpha = -INFINITY;
        } else if (result.score >= windowBeta) {
          windowBeta = INFINITY;
        } else {
          break;
        }
        windowAlpha = Math.max(windowAlpha, -INFINITY);
        windowBeta = Math.min(windowBeta, INFINITY);
      }

      if (!result || !result.bestMove) break;

      if (!result.complete && previous) break;

      previous = {
        bestMove: result.bestMove,
        score: result.score,
        depth,
        complete: result.complete,
      };

      lastPv = this.extractPV(chess, Math.max(2, Math.min(depth, 12)));

      if (this.onProgress) {
        this.onProgress({
          depth,
          score: result.score,
          nodes: this.nodes,
          time: Math.round(clockNow() - this.startTime),
          pv: lastPv,
        });
      }

      if (this.stopped) break;
      if (Math.abs(result.score) > MATE_BOUND && depth >= 2) break;

      const elapsed = clockNow() - this.startTime;
      if (elapsed > 0) {
        const estimated = (elapsed / depth) * 1.7;
        if (elapsed + estimated > timeLimit) break;
      }
    }

    if (!previous) {
      const legal = chess.moves({ verbose: true });
      if (legal.length === 0) {
        return {
          bestMove: null,
          score: chess.isCheck() ? -MATE_SCORE : 0,
          depth: 0,
          nodes: this.nodes,
          time: Math.round(clockNow() - this.startTime),
          pv: [],
          book: false,
          complete: true,
        };
      }
      previous = {
        bestMove: legal[0],
        score: 0,
        depth: 0,
        complete: false,
      };
      lastPv = [legal[0].san];
    }

    return {
      bestMove: previous.bestMove,
      score: previous.score,
      depth: previous.depth,
      nodes: this.nodes,
      time: Math.round(clockNow() - this.startTime),
      pv: lastPv.length ? lastPv : [previous.bestMove.san],
      book: false,
      complete: previous.complete,
    };
  }

  searchRoot(chess, depth, alpha, beta, rootEntry) {
    const key = chess.hash();
    let moves = chess.moves({ verbose: true });
    if (moves.length === 0) {
      return {
        score: chess.isCheck() ? -MATE_SCORE : 0,
        bestMove: null,
        complete: true,
      };
    }

    const ttMove = rootEntry?.move ?? null;
    moves = this.orderMoves(moves, ttMove, 0);

    const alphaOrig = alpha;
    let bestScore = -INFINITY;
    let bestMove = null;
    let searched = 0;

    for (const move of moves) {
      const moveObject = playMove(chess, move);
      let score;
      if (searched === 0) {
        score = -this.negamax(chess, depth - 1, -beta, -alpha, 1, true);
      } else {
        score = -this.negamax(chess, depth - 1, -alpha - 1, -alpha, 1, true);
        if (score > alpha && score < beta) {
          score = -this.negamax(chess, depth - 1, -beta, -alpha, 1, true);
        }
      }
      chess.undo();
      searched += 1;

      if (this.stopped && searched < moves.length) {
        if (score > bestScore && moveObject) {
          bestScore = score;
          bestMove = move;
        }
        break;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }

    const complete = !this.stopped;
    if (bestMove) {
      const flag = bestScore <= alphaOrig ? -1 : bestScore >= beta ? 1 : 0;
      this.storeTT(key, depth, bestScore, flag, bestMove, 0);
    }

    return { score: bestScore, bestMove, complete };
  }

  negamax(chess, depth, alpha, beta, ply, allowNull) {
    if (this.timeUp()) return 0;
    this.nodes += 1;
    if (ply >= MAX_PLY - 2) return evaluate(chess);

    const key = chess.hash();
    const entry = this.tt.get(key);
    let ttMove = null;
    const alphaOrig = alpha;
    const betaOrig = beta;

    if (entry) {
      ttMove = entry.move;
      if (entry.depth >= depth && ply > 0) {
        const score = this.fromTTScore(entry.score, ply);
        if (entry.flag === 0) return score;
        if (entry.flag === 1 && score >= beta) return score;
        if (entry.flag === -1 && score <= alpha) return score;
      }
    }

    if (depth <= 0) return this.quiescence(chess, alpha, beta, ply, 0);

    const inCheck = chess.isCheck();
    if (inCheck && depth < 20 && ply < 60) depth += 1;

    if (
      allowNull &&
      !inCheck &&
      depth >= 3 &&
      Math.abs(beta) < MATE_BOUND &&
      isNonPawnMaterial(chess, chess.turn())
    ) {
      chess.move('--');
      const nullScore = -this.negamax(chess, depth - 3, -beta, -beta + 1, ply + 1, false);
      chess.undo();
      if (this.stopped) return 0;
      if (nullScore >= beta) return beta;
    }

    if (!inCheck && depth <= 2 && Math.abs(alpha) < MATE_BOUND) {
      const staticEval = evaluate(chess);
      if (staticEval - 110 * depth >= beta) return staticEval;
      if (staticEval + 110 * depth <= alpha) return staticEval;
    }

    const moves = chess.moves({ verbose: true });
    if (moves.length === 0) {
      return inCheck ? -MATE_SCORE + ply : 0;
    }

    const ordered = this.orderMoves(moves, ttMove, ply);
    let bestScore = -INFINITY;
    let bestMove = null;
    let searched = 0;

    for (const move of ordered) {
      playMove(chess, move);
      let score;
      const quiet = !move.captured && !move.promotion;
      const canReduce =
        depth >= 3 && searched >= 3 && quiet && !inCheck && ply > 0;

      if (searched === 0) {
        score = -this.negamax(chess, depth - 1, -beta, -alpha, ply + 1, true);
      } else {
        const reduction = canReduce ? (searched >= 10 && depth >= 5 ? 2 : 1) : 0;
        score = -this.negamax(chess, depth - 1 - reduction, -alpha - 1, -alpha, ply + 1, true);
        if (score > alpha && reduction > 0) {
          score = -this.negamax(chess, depth - 1, -alpha - 1, -alpha, ply + 1, true);
        }
        if (score > alpha && score < beta) {
          score = -this.negamax(chess, depth - 1, -beta, -alpha, ply + 1, true);
        }
      }
      chess.undo();
      searched += 1;

      if (this.stopped) return 0;

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
      if (score > alpha) alpha = score;

      if (alpha >= beta) {
        if (quiet) {
          this.addKiller(ply, move);
          this.bumpHistory(move, depth);
        }
        break;
      }
    }

    if (bestMove) {
      const flag = bestScore <= alphaOrig ? -1 : bestScore >= betaOrig ? 1 : 0;
      this.storeTT(key, depth, bestScore, flag, bestMove, ply);
    }

    return bestScore;
  }

  quiescence(chess, alpha, beta, ply, qdepth) {
    if (this.timeUp()) return 0;
    this.nodes += 1;

    const inCheck = chess.isCheck();
    if (qdepth >= 6) return evaluate(chess);

    let bestScore = -INFINITY;
    let stand = 0;

    if (!inCheck) {
      stand = evaluate(chess);
      bestScore = stand;
      if (stand >= beta) return stand;
      if (stand > alpha) alpha = stand;
    }

    let moves = chess.moves({ verbose: true });
    if (moves.length === 0) {
      return inCheck ? -MATE_SCORE + ply : stand;
    }
    if (!inCheck) {
      moves = moves.filter((move) => move.captured || move.promotion);
    }
    if (moves.length === 0) return bestScore;

    moves = this.orderMoves(moves, null, ply, true);

    for (const move of moves) {
      if (
        !inCheck &&
        move.captured &&
        !move.promotion &&
        bestScore + PIECE_VALUE[move.captured] + 140 < alpha
      ) {
        continue;
      }
      playMove(chess, move);
      const score = -this.quiescence(chess, -beta, -alpha, ply + 1, qdepth + 1);
      chess.undo();
      if (this.stopped) return 0;

      if (score > bestScore) bestScore = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }

    return bestScore;
  }

  extractPV(chess, maxLength) {
    const pv = [];
    for (let i = 0; i < maxLength; i += 1) {
      const entry = this.tt.get(chess.hash());
      if (!entry || !entry.move) break;
      const legal = chess.moves({ verbose: true });
      const move = legal.find((candidate) => sameMove(candidate, entry.move));
      if (!move) break;
      pv.push(move.san);
      playMove(chess, move);
    }
    for (let i = 0; i < pv.length; i += 1) {
      chess.undo();
    }
    return pv;
  }
}

export function scoreToDisplay(score, turn) {
  const whiteScore = turn === 'w' ? score : -score;
  if (Math.abs(whiteScore) > MATE_BOUND) {
    const mateDistance = Math.ceil((MATE_SCORE - Math.abs(whiteScore)) / 2);
    return {
      text: `${whiteScore > 0 ? '+' : '-'}M${Math.max(1, mateDistance)}`,
      white: whiteScore > 0 ? 1 : -1,
      mate: true,
    };
  }
  const pawns = whiteScore / 100;
  return {
    text: `${pawns > 0 ? '+' : ''}${pawns.toFixed(2)}`,
    white: pawns,
    mate: false,
  };
}
