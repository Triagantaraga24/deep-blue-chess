import { Chess } from 'chess.js';
import { ChessClock } from './ChessClock.js';
import { DIFFICULTIES, TIME_CONTROLS, START_FEN } from '../core/constants.js';

function colorName(color) {
  return color === 'w' ? 'White' : 'Black';
}

function serializeMove(move) {
  return {
    from: move.from,
    to: move.to,
    promotion: move.promotion ?? null,
    piece: move.piece,
    color: move.color,
    captured: move.captured ?? null,
    san: move.san,
    enPassant: typeof move.isEnPassant === 'function' ? move.isEnPassant() : false,
    kingside: typeof move.isKingsideCastle === 'function' ? move.isKingsideCastle() : false,
    queenside: typeof move.isQueensideCastle === 'function' ? move.isQueensideCastle() : false,
  };
}

function halfmoveClock(fen) {
  return Number(fen.split(' ')[4]) || 0;
}

function findKingSquare(chess, color) {
  const found = chess.findPiece({ type: 'k', color });
  return found?.[0] ?? null;
}

function formatResult(winner) {
  if (!winner) return '½ – ½';
  return winner === 'w' ? '1 – 0' : '0 – 1';
}

export class Game extends EventTarget {
  constructor(engineClient, analysisClient, store, settings) {
    super();
    this.engineClient = engineClient;
    this.analysisClient = analysisClient;
    this.store = store;
    this.settings = settings;

    this.chess = new Chess();
    this.clock = new ChessClock();
    this.moves = [];
    this.snapshots = [{ fen: this.chess.fen(), lastMove: null }];
    this.redoStack = [];
    this.reviewIndex = null;
    this.captured = { w: [], b: [] };
    this.mode = 'ai';
    this.humanColor = 'w';
    this.difficulty = settings.difficulty ?? 'master';
    this.timeControlKey = settings.timeControl ?? '10,0';
    this.orientation = 'w';
    this.gameOver = false;
    this.result = null;
    this.thinking = false;
    this.pendingPromotion = null;
    this.lastAnalysis = null;

    this.aiToken = 0;
    this.analysisToken = 0;
    this.analysisTimer = null;
    this.aiDelayTimer = null;
    this.analysisPendingToken = 0;
    this.startedAt = Date.now();
    this.finishedAt = null;
    this.saved = false;

    this.clock.addEventListener('change', (event) => {
      this.emit('clock', event.detail);
    });
    this.clock.addEventListener('timeout', (event) => {
      this.handleTimeout(event.detail.color);
    });
  }

  emit(type, detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  newGame(options = {}) {
    this.cancelPendingWork();

    this.mode = options.mode === 'human' ? 'human' : 'ai';
    let side = options.side ?? 'w';
    if (side === 'random') side = Math.random() < 0.5 ? 'w' : 'b';
    this.humanColor = side === 'b' ? 'b' : 'w';
    this.difficulty = DIFFICULTIES[options.difficulty] ? options.difficulty : 'master';
    this.timeControlKey = TIME_CONTROLS[options.timeControl] ? options.timeControl : '10,0';

    this.settings.difficulty = this.difficulty;
    this.settings.timeControl = this.timeControlKey;

    this.chess = new Chess();
    this.moves = [];
    this.snapshots = [{ fen: this.chess.fen(), lastMove: null }];
    this.redoStack = [];
    this.reviewIndex = null;
    this.captured = { w: [], b: [] };
    this.gameOver = false;
    this.result = null;
    this.thinking = false;
    this.pendingPromotion = null;
    this.lastAnalysis = null;
    this.saved = false;
    this.startedAt = Date.now();
    this.finishedAt = null;
    this.orientation = this.mode === 'ai' ? this.humanColor : 'w';

    const control = TIME_CONTROLS[this.timeControlKey];
    this.clock.configure(control.initial, control.increment);
    this.clock.setActive(this.chess.turn());
    this.clock.start();

    this.emit('reset', this.resetDetail());
    this.emit('thinking', { thinking: false });
    this.emitStatus();
    this.requestAnalysis();

    if (this.mode === 'ai' && this.chess.turn() !== this.humanColor) {
      this.scheduleAI(420);
    }
    return this.resetDetail();
  }

  resetDetail() {
    const control = TIME_CONTROLS[this.timeControlKey] ?? TIME_CONTROLS['0,0'];
    return {
      fen: this.chess.fen(),
      orientation: this.orientation,
      mode: this.mode,
      humanColor: this.humanColor,
      difficulty: this.difficulty,
      timeControl: this.timeControlKey,
      timeLabel: control.label,
      gameOver: this.gameOver,
      result: this.result,
    };
  }

  cancelPendingWork() {
    this.aiToken += 1;
    this.analysisToken += 1;
    clearTimeout(this.aiDelayTimer);
    clearTimeout(this.analysisTimer);
    this.aiDelayTimer = null;
    this.analysisTimer = null;
    if (this.thinking) {
      this.thinking = false;
      this.engineClient.stop();
      this.emit('thinking', { thinking: false });
    }
    if (this.analysisPendingToken) {
      this.analysisPendingToken = 0;
      this.analysisClient.stop();
    }
    this.clock.stop();
  }

  get fen() {
    return this.chess.fen();
  }

  get turn() {
    return this.chess.turn();
  }

  get totalMoves() {
    return this.moves.length;
  }

  get liveIndex() {
    return this.moves.length;
  }

  isHumanTurn() {
    return this.mode === 'human' || this.chess.turn() === this.humanColor;
  }

  canHumanMove() {
    return (
      !this.gameOver &&
      this.reviewIndex === null &&
      this.pendingPromotion === null &&
      !this.thinking &&
      this.isHumanTurn()
    );
  }

  canSelect(square) {
    if (!this.canHumanMove()) return false;
    const piece = this.chess.get(square);
    return Boolean(piece && piece.color === this.chess.turn());
  }

  getLegalMoves(square) {
    if (!this.canHumanMove()) return [];
    const piece = this.chess.get(square);
    if (!piece || piece.color !== this.chess.turn()) return [];
    return this.chess.moves({ square, verbose: true });
  }

  attemptMove(from, to, promotion = null) {
    if (!this.canHumanMove() || !from || !to || from === to) {
      return { ok: false };
    }
    const candidates = this.chess
      .moves({ square: from, verbose: true })
      .filter((move) => move.to === to);
    if (candidates.length === 0) return { ok: false, illegal: true };

    const promotionMoves = candidates.filter((move) => move.promotion);
    if (promotionMoves.length > 0 && !promotion) {
      this.pendingPromotion = { from, to, color: this.chess.turn() };
      this.emit('promotion', { from, to, color: this.chess.turn() });
      return { ok: false, pending: true };
    }

    const chosen = promotion
      ? candidates.find((move) => move.promotion === promotion)
      : candidates[0];
    if (!chosen) return { ok: false, illegal: true };

    this.pendingPromotion = null;
    this.applyMoveObject(chosen, { ai: false });
    return { ok: true, move: chosen };
  }

  completePromotion(piece) {
    if (!this.pendingPromotion) return false;
    const { from, to } = this.pendingPromotion;
    const move = this.chess
      .moves({ square: from, verbose: true })
      .find((candidate) => candidate.to === to && candidate.promotion === piece);
    this.pendingPromotion = null;
    if (!move) {
      this.emit('promotion-cancelled');
      return false;
    }
    this.applyMoveObject(move, { ai: false });
    return true;
  }

  cancelPromotion() {
    if (!this.pendingPromotion) return;
    this.pendingPromotion = null;
    this.emit('promotion-cancelled');
  }

  applyMoveObject(move, { ai = false } = {}) {
    const applied = this.chess.move({
      from: move.from,
      to: move.to,
      ...(move.promotion ? { promotion: move.promotion } : {}),
    });
    if (!applied) return false;

    const plain = serializeMove(applied);
    this.moves.push(plain);
    this.snapshots.push({ fen: this.chess.fen(), lastMove: plain });
    this.redoStack = [];
    this.reviewIndex = null;
    this.updateCaptured();

    if (this.mode === 'human' && this.thinking) {
      this.thinking = false;
    }
    if (ai) this.thinking = false;

    this.clock.completeMove(applied.color);

    this.emit('move', {
      move: applied,
      plain,
      fen: this.chess.fen(),
      lastMove: plain,
      ai,
      live: true,
    });

    if (this.thinking) {
      this.thinking = false;
    }
    this.emit('thinking', { thinking: false });

    this.checkGameEnd();
    if (!this.gameOver) {
      this.emitStatus();
      this.requestAnalysis();
      this.scheduleAI(ai ? 260 : 220);
    }
    return true;
  }

  updateCaptured() {
    this.captured = { w: [], b: [] };
    for (const move of this.moves) {
      if (move.captured) {
        this.captured[move.color].push(move.captured);
      }
    }
  }

  checkGameEnd() {
    if (this.chess.isCheckmate()) {
      const winner = this.chess.turn() === 'w' ? 'b' : 'w';
      this.finishGame(winner, 'Checkmate');
      return true;
    }
    if (this.chess.isStalemate()) {
      this.finishGame(null, 'Stalemate');
      return true;
    }
    if (this.chess.isInsufficientMaterial()) {
      this.finishGame(null, 'Insufficient material');
      return true;
    }
    if (this.chess.isThreefoldRepetition()) {
      this.finishGame(null, 'Threefold repetition');
      return true;
    }
    if (halfmoveClock(this.chess.fen()) >= 150) {
      this.finishGame(null, 'Seventy-five-move rule');
      return true;
    }
    if (this.chess.isDrawByFiftyMoves()) {
      this.finishGame(null, 'Fifty-move rule');
      return true;
    }
    if (this.chess.isDraw()) {
      this.finishGame(null, 'Draw');
      return true;
    }
    return false;
  }

  finishGame(winner, reason) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.finishedAt = Date.now();
    this.thinking = false;
    this.pendingPromotion = null;
    this.aiToken += 1;
    this.analysisToken += 1;
    clearTimeout(this.aiDelayTimer);
    this.aiDelayTimer = null;
    this.clock.stop();
    this.engineClient.stop();
    if (this.analysisPendingToken) {
      this.analysisPendingToken = 0;
      this.analysisClient.stop();
    }
    this.emit('thinking', { thinking: false });

    this.result = {
      winner,
      reason,
      resultText: formatResult(winner),
      title: winner ? `${colorName(winner)} wins` : 'Draw',
    };
    this.reviewIndex = null;

    this.emit('gameover', {
      winner,
      reason,
      resultText: this.result.resultText,
      title: this.result.title,
      moves: this.moves.length,
      time: this.getElapsed(),
      pgn: this.getPgn(),
      mode: this.mode,
      humanColor: this.humanColor,
      difficulty: this.difficulty,
      timeControl: this.timeControlKey,
    });
    this.emitStatus();
    this.saveGame();
  }

  getElapsed() {
    const end = this.finishedAt ?? Date.now();
    return Math.max(0, end - this.startedAt);
  }

  getPgn() {
    try {
      const white =
        this.mode === 'ai' ? (this.humanColor === 'w' ? 'You' : 'Deep Blue') : 'White';
      const black =
        this.mode === 'ai' ? (this.humanColor === 'b' ? 'You' : 'Deep Blue') : 'Black';
      this.chess.setHeader('Event', 'Deep Blue: Grandmaster Chess');
      this.chess.setHeader('Site', 'Local Browser');
      this.chess.setHeader('Date', new Date().toISOString().slice(0, 10).replaceAll('-', '.'));
      this.chess.setHeader('White', white);
      this.chess.setHeader('Black', black);
      this.chess.setHeader('Result', this.result?.resultText ?? '*');
      return this.chess.pgn();
    } catch {
      return '';
    }
  }

  saveGame() {
    if (this.saved || !this.store || this.moves.length < 2) return;
    this.saved = true;
    const record = {
      fen: this.chess.fen(),
      startFen: this.snapshots[0].fen,
      moves: this.moves.map((move) => ({
        from: move.from,
        to: move.to,
        promotion: move.promotion,
        san: move.san,
      })),
      result: this.result?.resultText ?? '½ – ½',
      reason: this.result?.reason ?? 'Draw',
      winner: this.result?.winner ?? null,
      mode: this.mode,
      difficulty: this.difficulty,
      humanColor: this.humanColor,
      timeControl: this.timeControlKey,
      pgn: this.getPgn(),
      date: Date.now(),
    };
    this.store.addGame(record).then((id) => {
      if (id) this.emit('saved', { id, record });
    });
  }

  emitStatus() {
    const turn = this.chess.turn();
    let check = this.chess.isCheck();
    let checkSquare = check ? findKingSquare(this.chess, turn) : null;
    let title;
    let sub;
    let reviewing = false;

    if (this.reviewIndex !== null) {
      reviewing = true;
      const snapshot = this.snapshots[this.reviewIndex];
      const reviewChess = new Chess(snapshot.fen);
      check = reviewChess.isCheck();
      checkSquare = check ? findKingSquare(reviewChess, reviewChess.turn()) : null;
      title = 'Position review';
      sub = `Move ${this.reviewIndex} of ${this.moves.length} in the game.`;
    } else if (this.gameOver && this.result) {
      title = this.result.title;
      sub = this.result.reason;
    } else if (this.thinking) {
      title = `${colorName(turn)} to move`;
      sub = 'Deep Blue is calculating.';
    } else if (check) {
      title = `${colorName(turn)} to move`;
      sub = `${colorName(turn)} is in check.`;
    } else {
      title = `${colorName(turn)} to move`;
      const last = this.moves[this.moves.length - 1];
      sub = last ? `Last move ${last.san}.` : 'The game is underway.';
    }

    this.emit('status', {
      title,
      sub,
      turn,
      check,
      checkSquare,
      gameOver: this.gameOver,
      result: this.result,
      thinking: this.thinking,
      reviewing,
      reviewIndex: this.reviewIndex,
      totalMoves: this.moves.length,
      lastMove: this.moves[this.moves.length - 1] ?? null,
    });
  }

  scheduleAI(delay = 200) {
    clearTimeout(this.aiDelayTimer);
    if (this.gameOver || this.mode !== 'ai') return;
    if (this.reviewIndex !== null) return;
    if (this.chess.turn() === this.humanColor) return;
    if (this.chess.moves().length === 0) return;
    if (this.thinking) return;

    const token = ++this.aiToken;
    this.thinking = true;
    this.emit('thinking', { thinking: true });
    this.emitStatus();

    this.aiDelayTimer = setTimeout(() => {
      if (token !== this.aiToken || this.gameOver || this.reviewIndex !== null) return;
      this.runAI(token);
    }, delay);
  }

  runAI(token) {
    if (token !== this.aiToken || this.gameOver) return;
    const aiColor = this.chess.turn();
    const config = DIFFICULTIES[this.difficulty] ?? DIFFICULTIES.master;
    const fen = this.chess.fen();
    let budget = config.timeMs;
    if (this.clock.initial > 0) {
      const remaining = this.clock.remaining[aiColor];
      budget = Math.min(budget, Math.max(120, remaining * 0.12));
    }

    this.emit('engineprogress', {
      source: 'ai',
      depth: 0,
      nodes: 0,
      time: 0,
      score: 0,
      scoreText: '0.00',
      whiteScore: 0,
      mate: false,
      pv: [],
      turn: aiColor,
    });

    this.engineClient
      .search(
        fen,
        {
          maxDepth: config.depth,
          timeLimit: Math.round(budget),
          useBook: this.settings.book !== false,
          randomness: config.randomness ?? 0,
        },
        (progress) => {
          if (token !== this.aiToken) return;
          this.emit('engineprogress', { ...progress, source: 'ai' });
        },
      )
      .then((result) => {
        if (token !== this.aiToken || this.gameOver) return;
        if (this.chess.fen() !== fen) return;
        if (!result.from) {
          this.thinking = false;
          this.emit('thinking', { thinking: false });
          if (!this.checkGameEnd()) {
            this.finishGame(null, 'No legal moves');
          }
          return;
        }
        const legal = this.chess.moves({ verbose: true });
        const move = legal.find(
          (candidate) =>
            candidate.from === result.from &&
            candidate.to === result.to &&
            (candidate.promotion ?? null) === (result.promotion ?? null),
        );
        if (!move) {
          this.thinking = false;
          this.emit('thinking', { thinking: false });
          this.scheduleAI(300);
          return;
        }
        this.thinking = false;
        this.applyMoveObject(move, { ai: true });
      })
      .catch(() => {
        if (token !== this.aiToken || this.gameOver) return;
        this.thinking = false;
        this.emit('thinking', { thinking: false });
        this.fallbackAIMove();
      });
  }

  fallbackAIMove() {
    if (this.gameOver || this.chess.turn() === this.humanColor) return;
    const legal = this.chess.moves({ verbose: true });
    if (legal.length === 0) {
      this.checkGameEnd();
      return;
    }
    const capture = legal.filter((move) => move.captured);
    const pool = capture.length ? capture : legal;
    const move = pool[Math.floor(Math.random() * pool.length)];
    this.emit('toast', { message: 'Engine timed out — playing a legal move.', type: 'error' });
    this.applyMoveObject(move, { ai: true });
  }

  requestAnalysis() {
    clearTimeout(this.analysisTimer);
    const token = ++this.analysisToken;
    if (!this.settings.liveAnalysis) {
      if (this.analysisPendingToken) {
        this.analysisPendingToken = 0;
        this.analysisClient.stop();
      }
      this.emit('analysis', { idle: true });
      return;
    }

    const reviewing = this.reviewIndex !== null;
    const fen = reviewing ? this.snapshots[this.reviewIndex].fen : this.chess.fen();

    this.analysisTimer = setTimeout(() => {
      if (token !== this.analysisToken) return;
      if (this.analysisPendingToken) {
        this.analysisPendingToken = 0;
        this.analysisClient.stop();
      }
      this.analysisPendingToken = token;
      const depth = Math.max(2, Math.min(6, Number(this.settings.analysisDepth) || 3));
      const timeLimit = Math.min(3200, 420 + depth * 430);

      this.analysisClient
        .analyze(
          fen,
          { maxDepth: depth, timeLimit },
          (progress) => {
            if (token !== this.analysisToken) return;
            this.emit('engineprogress', {
              ...progress,
              source: 'analysis',
              reviewing,
              fen,
            });
          },
        )
        .then((result) => {
          if (token !== this.analysisToken) return;
          this.analysisPendingToken = 0;
          this.lastAnalysis = { ...result, fen, reviewing };
          this.emit('analysis', { ...result, fen, reviewing });
        })
        .catch(() => {
          if (token === this.analysisToken) this.analysisPendingToken = 0;
        });
    }, 140);
  }

  undo() {
    if (this.moves.length === 0) {
      if (this.reviewIndex !== null) this.goLive();
      return false;
    }
    this.thinking = false;
    this.aiToken += 1;
    clearTimeout(this.aiDelayTimer);
    this.aiDelayTimer = null;
    this.engineClient.stop();
    this.emit('thinking', { thinking: false });
    this.pendingPromotion = null;
    this.reviewIndex = null;

    let undone = 0;
    do {
      const move = this.chess.undo();
      if (!move) break;
      const snapshot = this.snapshots.pop();
      const plain = this.moves.pop();
      this.redoStack.push({ move: plain, snapshot });
      undone += 1;
      if (this.mode !== 'ai') break;
      if (this.chess.turn() === this.humanColor) break;
    } while (this.moves.length > 0);

    if (undone === 0) return false;

    this.gameOver = false;
    this.result = null;
    this.finishedAt = null;
    this.saved = false;
    this.updateCaptured();
    this.clock.setActive(this.chess.turn());
    if (this.clock.initial > 0) this.clock.resume();

    const lastMove = this.moves[this.moves.length - 1] ?? null;
    this.emit('undo', {
      fen: this.chess.fen(),
      lastMove,
      orientation: this.orientation,
      undone,
    });
    this.emitStatus();
    this.requestAnalysis();
    this.scheduleAI(320);
    return true;
  }

  redo() {
    if (this.redoStack.length === 0) return false;
    this.thinking = false;
    this.aiToken += 1;
    clearTimeout(this.aiDelayTimer);
    this.engineClient.stop();
    const item = this.redoStack.pop();
    const applied = this.chess.move({
      from: item.move.from,
      to: item.move.to,
      ...(item.move.promotion ? { promotion: item.move.promotion } : {}),
    });
    if (!applied) {
      this.redoStack = [];
      return false;
    }
    this.moves.push(item.move);
    this.snapshots.push(item.snapshot);
    this.updateCaptured();
    this.clock.setActive(applied.color === 'w' ? 'b' : 'w');
    if (!this.gameOver && this.clock.initial > 0) this.clock.resume();

    const plain = item.move;
    this.emit('move', {
      move: applied,
      plain,
      fen: this.chess.fen(),
      lastMove: plain,
      ai: false,
      redo: true,
      live: true,
    });
    this.emit('thinking', { thinking: false });
    this.checkGameEnd();
    if (!this.gameOver) {
      this.emitStatus();
      this.requestAnalysis();
      if (this.redoStack.length === 0) this.scheduleAI(260);
    }
    return true;
  }

  reviewTo(index) {
    const clamped = Math.max(0, Math.min(this.moves.length, Number(index) || 0));
    if (clamped === this.moves.length) {
      this.goLive();
      return;
    }
    if (this.thinking) {
      this.thinking = false;
      this.aiToken += 1;
      clearTimeout(this.aiDelayTimer);
      this.engineClient.stop();
      this.emit('thinking', { thinking: false });
    }
    this.clock.pause();
    this.reviewIndex = clamped;
    const snapshot = this.snapshots[clamped];
    this.emit('review', {
      fen: snapshot.fen,
      lastMove: snapshot.lastMove,
      index: clamped,
      total: this.moves.length,
    });
    this.emitStatus();
    this.requestAnalysis();
  }

  goLive() {
    if (this.reviewIndex === null) return;
    this.reviewIndex = null;
    this.clock.setActive(this.chess.turn());
    if (!this.gameOver && this.clock.initial > 0) this.clock.resume();
    const lastMove = this.moves[this.moves.length - 1] ?? null;
    this.emit('live', { fen: this.chess.fen(), lastMove });
    this.emitStatus();
    this.requestAnalysis();
    if (!this.gameOver) this.scheduleAI(260);
  }

  reviewStep(delta) {
    const current = this.reviewIndex ?? this.moves.length;
    this.reviewTo(current + delta);
  }

  setOrientation(side) {
    const next = side === 'b' ? 'b' : 'w';
    if (this.orientation === next) return;
    this.orientation = next;
    this.emit('orientation', { orientation: next });
  }

  flipOrientation() {
    this.setOrientation(this.orientation === 'w' ? 'b' : 'w');
  }

  resign() {
    if (this.gameOver) return;
    const resigning = this.mode === 'ai' ? this.humanColor : this.chess.turn();
    const winner = resigning === 'w' ? 'b' : 'w';
    this.finishGame(winner, 'Resignation');
  }

  offerDraw() {
    if (this.gameOver) return;
    if (this.mode === 'human') {
      this.finishGame(null, 'Draw agreed');
      return;
    }
    const aiColor = this.humanColor === 'w' ? 'b' : 'w';
    const analysis = this.lastAnalysis;
    let accept = true;
    if (analysis && analysis.fen === this.chess.fen()) {
      const aiScore = aiColor === 'w' ? analysis.whiteScore : -analysis.whiteScore;
      accept = aiScore <= 0.45;
    }
    if (accept) {
      this.finishGame(null, 'Draw agreed');
    } else {
      this.emit('toast', { message: 'Deep Blue declines the draw offer.', type: 'error' });
    }
  }

  handleTimeout(color) {
    if (this.gameOver) return;
    const winner = color === 'w' ? 'b' : 'w';
    this.finishGame(winner, 'Timeout');
  }

  loadGame(record) {
    this.cancelPendingWork();
    const startFen = record.startFen || START_FEN;
    let chess;
    try {
      chess = new Chess(startFen);
    } catch {
      this.emit('toast', { message: 'Saved game is not a valid position.', type: 'error' });
      return false;
    }

    const snapshots = [{ fen: startFen, lastMove: null }];
    const moves = [];
    for (const move of record.moves ?? []) {
      const applied = chess.move({
        from: move.from,
        to: move.to,
        ...(move.promotion ? { promotion: move.promotion } : {}),
      });
      if (!applied) break;
      const plain = serializeMove(applied);
      moves.push(plain);
      snapshots.push({ fen: chess.fen(), lastMove: plain });
    }

    const finished = Boolean(record.reason);
    this.chess = chess;
    this.moves = moves;
    this.snapshots = snapshots;
    this.redoStack = [];
    this.reviewIndex = null;
    this.mode = record.mode === 'ai' ? 'ai' : 'human';
    this.humanColor = record.humanColor === 'b' ? 'b' : 'w';
    this.difficulty = DIFFICULTIES[record.difficulty] ? record.difficulty : 'master';
    this.timeControlKey = '0,0';
    this.orientation = this.mode === 'ai' ? this.humanColor : 'w';
    this.gameOver = finished;
    this.result = finished
      ? {
          winner: record.winner ?? null,
          reason: record.reason,
          resultText: record.result ?? formatResult(record.winner ?? null),
          title: record.winner ? `${colorName(record.winner)} wins` : 'Draw',
        }
      : null;
    this.thinking = false;
    this.pendingPromotion = null;
    this.lastAnalysis = null;
    this.saved = finished;
    this.startedAt = Date.now();
    this.finishedAt = finished ? (record.date ?? Date.now()) : null;
    this.updateCaptured();

    this.clock.configure(0, 0);
    this.clock.setActive(this.chess.turn());

    this.emit('reset', { ...this.resetDetail(), loaded: true });
    this.emit('thinking', { thinking: false });
    this.emitStatus();
    this.requestAnalysis();
    if (!finished) this.scheduleAI(400);
    this.emit('toast', { message: 'Saved game loaded.', type: 'success' });
    return true;
  }

  loadPosition(fen, name = 'Position') {
    let chess;
    try {
      chess = new Chess(fen);
    } catch {
      this.emit('toast', { message: 'That position is not valid.', type: 'error' });
      return false;
    }
    this.cancelPendingWork();
    this.chess = chess;
    this.moves = [];
    this.snapshots = [{ fen: this.chess.fen(), lastMove: null }];
    this.redoStack = [];
    this.reviewIndex = null;
    this.mode = 'human';
    this.humanColor = this.chess.turn();
    this.difficulty = 'master';
    this.timeControlKey = '0,0';
    this.orientation = this.humanColor;
    this.gameOver = false;
    this.result = null;
    this.thinking = false;
    this.pendingPromotion = null;
    this.lastAnalysis = null;
    this.saved = false;
    this.startedAt = Date.now();
    this.finishedAt = null;
    this.updateCaptured();
    this.clock.configure(0, 0);
    this.clock.setActive(this.chess.turn());

    this.emit('reset', { ...this.resetDetail(), loaded: true });
    this.emit('thinking', { thinking: false });
    this.emitStatus();
    this.requestAnalysis();
    this.emit('toast', { message: `${name} loaded.`, type: 'success' });
    return true;
  }

  saveCurrentPosition(name = 'Saved position') {
    if (!this.store) return Promise.resolve(false);
    return this.store
      .addPosition({ fen: this.chess.fen(), name, date: Date.now(), moves: this.moves.length })
      .then((id) => {
        if (id) this.emit('toast', { message: 'Position saved to library.', type: 'success' });
        return Boolean(id);
      });
  }

  setSettings(settings) {
    this.settings = settings;
    if (this.settings.liveAnalysis) this.requestAnalysis();
    else {
      clearTimeout(this.analysisTimer);
      this.analysisToken += 1;
      if (this.analysisPendingToken) {
        this.analysisPendingToken = 0;
        this.analysisClient.stop();
      }
      this.emit('analysis', { idle: true });
    }
  }

  dispose() {
    this.cancelPendingWork();
    this.clock.stop();
    this.engineClient.dispose();
    this.analysisClient.dispose();
  }
}
