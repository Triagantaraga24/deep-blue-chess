import { Chess } from 'chess.js';
import { ChessEngine } from './search.js';
import { probeBook } from './openingBook.js';
import { scoreToDisplay } from './search.js';

const engine = new ChessEngine();

self.postMessage({ type: 'ready' });

function post(message) {
  self.postMessage(message);
}

function serializeMove(move) {
  if (!move) return null;
  return {
    from: move.from,
    to: move.to,
    promotion: move.promotion ?? null,
    san: move.san,
    captured: move.captured ?? null,
    piece: move.piece,
    color: move.color,
    flags: typeof move.flags === 'string' ? move.flags : '',
    isEnPassant: typeof move.isEnPassant === 'function' ? move.isEnPassant() : false,
    isKingsideCastle: typeof move.isKingsideCastle === 'function' ? move.isKingsideCastle() : false,
    isQueensideCastle: typeof move.isQueensideCastle === 'function' ? move.isQueensideCastle() : false,
  };
}

self.onmessage = (event) => {
  const message = event.data;
  if (message.type === 'search') {
    const {
      id,
      fen,
      maxDepth = 4,
      timeLimit = 2000,
      useBook = false,
      randomness = 0,
      analysis = false,
    } = message;

    let chess;
    try {
      chess = new Chess(fen);
    } catch {
      post({ type: 'error', id, message: 'Invalid position.' });
      return;
    }

    const turn = chess.turn();
    const canMove = chess.moves({ verbose: true }).length > 0;

    if (!canMove) {
      const result = {
        type: 'bestmove',
        id,
        from: null,
        to: null,
        promotion: null,
        san: null,
        score: 0,
        whiteScore: 0,
        scoreText: '0.00',
        mate: false,
        depth: 0,
        nodes: 0,
        time: 0,
        pv: [],
        book: false,
        analysis,
        turn,
        gameOver: true,
      };
      post(result);
      return;
    }

    let bookMove = null;
    if (useBook && !analysis) {
      try {
        bookMove = probeBook(chess);
      } catch {
        bookMove = null;
      }
    }

    const startedAt = Date.now();
    const result = engine.search(chess, {
      maxDepth,
      timeLimit,
      useBook: Boolean(bookMove),
      bookMove,
      onProgress: (progress) => {
        const display = scoreToDisplay(progress.score, turn);
        post({
          type: 'progress',
          id,
          depth: progress.depth,
          score: progress.score,
          whiteScore: display.white,
          scoreText: display.text,
          mate: display.mate,
          nodes: progress.nodes,
          time: progress.time,
          pv: progress.pv,
          turn,
          analysis,
        });
      },
    });

    let bestMove = result.bestMove;
    let book = result.book;
    let pv = result.pv;

    if (randomness > 0 && bestMove && Math.random() < randomness) {
      const legal = chess.moves({ verbose: true });
      if (legal.length > 2) {
        const alternatives = legal.filter((move) => move.san !== bestMove.san);
        bestMove = alternatives[Math.floor(Math.random() * alternatives.length)];
        book = false;
        pv = [bestMove.san];
      }
    }

    const display = scoreToDisplay(result.score, turn);
    const elapsed = Math.max(1, Date.now() - startedAt);

    post({
      type: 'bestmove',
      id,
      ...serializeMove(bestMove),
      score: result.score,
      whiteScore: display.white,
      scoreText: display.text,
      mate: display.mate,
      depth: result.depth,
      nodes: result.nodes,
      time: elapsed,
      nps: Math.round(result.nodes / (elapsed / 1000)),
      pv,
      book,
      analysis,
      turn,
      complete: result.complete,
    });
  }
};
