import { Chess } from 'chess.js';
import {
  DEFAULT_SETTINGS,
  DIFFICULTIES,
  PIECE_GLYPHS,
  PIECE_NAMES,
  PIECE_VALUES,
  TIME_CONTROLS,
} from '../core/constants.js';
import { saveSettings } from '../core/storage.js';
import { SoundEngine } from '../core/sound.js';

const $ = (id) => document.getElementById(id);

function colorName(color) {
  return color === 'w' ? 'White' : 'Black';
}

function otherColor(color) {
  return color === 'w' ? 'b' : 'w';
}

function formatClock(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '0:00.0';
  const seconds = ms / 1000;
  if (seconds < 20) {
    const whole = Math.floor(seconds);
    const tenths = Math.floor((ms % 1000) / 100);
    return `0:${String(whole).padStart(2, '0')}.${tenths}`;
  }
  const total = Math.ceil(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function formatElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatNodes(nodes) {
  const value = Number(nodes) || 0;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${(value / 1000).toFixed(0)}k`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

function formatSearchTime(ms) {
  const value = Number(ms) || 0;
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(2)} s`;
}

function formatDate(timestamp) {
  if (!timestamp) return 'Unknown date';
  try {
    return new Date(timestamp).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Unknown date';
  }
}

function describeEvaluation(whiteScore, scoreText, mate) {
  if (mate) {
    if (scoreText.startsWith('-')) return 'Black forces mate';
    return 'White forces mate';
  }
  const value = Number(whiteScore) || 0;
  if (value >= 2) return 'White is winning';
  if (value >= 0.75) return 'White is better';
  if (value >= 0.25) return 'White slightly better';
  if (value <= -2) return 'Black is winning';
  if (value <= -0.75) return 'Black is better';
  if (value <= -0.25) return 'Black slightly better';
  return 'Equal position';
}

function formatPv(pv, fen) {
  if (!Array.isArray(pv) || pv.length === 0) return '';
  const parts = fen.split(' ');
  let turn = parts[1] === 'b' ? 'b' : 'w';
  let moveNumber = Number(parts[5]) || 1;
  const words = [];
  pv.slice(0, 12).forEach((san) => {
    if (turn === 'w') {
      words.push(`${moveNumber}.`);
    } else if (words.length === 0) {
      words.push(`${moveNumber}...`);
    }
    words.push(san);
    if (turn === 'w') {
      turn = 'b';
    } else {
      turn = 'w';
      moveNumber += 1;
    }
  });
  return words.join(' ');
}

export class AppUI {
  constructor({ game, scene, store, settings }) {
    this.game = game;
    this.scene = scene;
    this.store = store;
    this.settings = settings;
    this.sound = new SoundEngine();
    this.sound.setEnabled(settings.sound !== false);

    this.selection = null;
    this.animating = false;
    this.mobileTab = null;
    this.activeModal = null;
    this.confirmResolve = null;
    this.lastFocused = null;
    this.clockState = null;
    this.lastRematch = null;
    this.gameOverTimer = null;
    this.analysisDepthTimer = null;
    this.libraryTab = 'games';
    this.newGameState = {
      mode: 'ai',
      side: 'w',
      difficulty: settings.difficulty ?? 'master',
      timeControl: settings.timeControl ?? '10,0',
    };
  }

  init() {
    this.cacheDom();
    this.bindScene();
    this.bindGame();
    this.bindActions();
    this.bindModals();
    this.bindNewGameForm();
    this.bindSettingsForm();
    this.bindCamera();
    this.bindMobileTabs();
    this.bindKeyboard();
    this.bindSoundUnlock();

    this.syncSettingsForm();
    this.updateEngineConfig();
    this.updateMeta();
    this.setEngineState(this.settings.liveAnalysis ? 'Idle' : 'Off', this.settings.liveAnalysis ? '' : 'off');
    this.setCameraActive('standard');
    this.updateNewGameStateFromGame();
    this.syncNewGameForm();

    this.game.newGame({
      mode: 'ai',
      side: 'w',
      difficulty: this.settings.difficulty,
      timeControl: this.settings.timeControl,
    });
  }

  cacheDom() {
    this.modalRoot = $('modal-root');
    this.toastStack = $('toast-stack');
    this.sceneContainer = $('scene-container');

    this.opponentCard = $('player-opponent');
    this.playerCard = $('player-you');
    this.opponentAvatar = $('opponent-avatar');
    this.playerAvatar = $('player-avatar');
    this.opponentName = $('opponent-name');
    this.playerName = $('player-name');
    this.opponentRating = $('opponent-rating');
    this.playerRating = $('player-rating');
    this.opponentClock = $('opponent-clock');
    this.playerClock = $('player-clock');
    this.opponentCaptured = $('opponent-captured');
    this.playerCaptured = $('player-captured');
    this.opponentMaterial = $('opponent-material');
    this.playerMaterial = $('player-material');

    this.statusEyebrow = $('status-eyebrow');
    this.statusTitle = $('status-title');
    this.statusSub = $('status-sub');
    this.tagCheck = $('tag-check');
    this.tagLastMove = $('tag-last-move');
    this.stageTurnText = $('stage-turn-text');
    this.stageTurn = $('stage-turn');
    this.stageEngineText = $('stage-engine-text');
    this.enginePulse = $('engine-pulse');

    this.thinkingOverlay = $('thinking-overlay');
    this.thinkingTitle = $('thinking-title');
    this.thinkingDetail = $('thinking-detail');
    this.reviewBanner = $('review-banner');
    this.reviewText = $('review-text');
    this.promotionDialog = $('promotion-dialog');

    this.engineState = $('engine-state');
    this.statDepth = $('stat-depth');
    this.statNodes = $('stat-nodes');
    this.statNps = $('stat-nps');
    this.statTime = $('stat-time');
    this.engineEvalScore = $('engine-eval-score');
    this.engineEvalLabel = $('engine-eval-label');
    this.searchProgress = $('search-progress');
    this.pvLine = $('pv-line');
    this.engineConfig = $('engine-config');

    this.positionEval = $('position-eval');
    this.evalFill = $('eval-fill');

    this.moveList = $('move-list');
    this.moveCount = $('move-count');
    this.gameModeLabel = $('game-mode-label');
    this.metaDifficulty = $('meta-difficulty');
    this.metaTime = $('meta-time');
    this.metaSide = $('meta-side');
    this.metaBook = $('meta-book');

    this.aiOptions = $('ai-options');
    this.newDifficulty = $('new-difficulty');

    this.libraryList = $('library-list');
    this.confirmEyebrow = $('confirm-eyebrow');
    this.confirmTitle = $('confirm-title');
    this.confirmText = $('confirm-text');
    this.confirmAccept = $('confirm-accept');
    this.gameoverCrest = $('gameover-crest');
    this.gameoverTitle = $('gameover-title');
    this.gameoverReason = $('gameover-reason');
    this.gameoverMoves = $('gameover-moves');
    this.gameoverTime = $('gameover-time');
    this.gameoverResult = $('gameover-result');
  }

  bindScene() {
    this.scene.setHandlers({
      canDrag: (square) => this.canInteract() && this.game.canSelect(square),
      onDragStart: (square) => this.selectSquare(square),
      onDragHover: () => {},
      onDrop: (from, to) => this.handleDrop(from, to),
      onSquareClick: (square) => this.handleSquareClick(square),
      onDoubleClick: (square) => this.scene.focusSquare(square),
    });
    this.scene.setCameraInteractionHandler((mode) => {
      if (mode === 'free') this.setCameraActive(null);
    });
    this.sceneContainer.addEventListener('pointerdown', () => this.closeMobilePanels());
  }

  bindGame() {
    this.game.addEventListener('reset', (event) => this.handleReset(event.detail));
    this.game.addEventListener('move', (event) => this.handleMove(event.detail));
    this.game.addEventListener('undo', (event) => this.handleUndo(event.detail));
    this.game.addEventListener('review', (event) => this.handleReview(event.detail));
    this.game.addEventListener('live', (event) => this.handleLive(event.detail));
    this.game.addEventListener('promotion', (event) => this.handlePromotion(event.detail));
    this.game.addEventListener('promotion-cancelled', () => this.handlePromotionCancelled());
    this.game.addEventListener('status', (event) => this.handleStatus(event.detail));
    this.game.addEventListener('clock', (event) => this.handleClock(event.detail));
    this.game.addEventListener('thinking', (event) => this.handleThinking(event.detail));
    this.game.addEventListener('engineprogress', (event) => this.handleEngineProgress(event.detail));
    this.game.addEventListener('analysis', (event) => this.handleAnalysis(event.detail));
    this.game.addEventListener('gameover', (event) => this.handleGameOver(event.detail));
    this.game.addEventListener('orientation', (event) => this.handleOrientation(event.detail));
    this.game.addEventListener('toast', (event) => this.showToast(event.detail));
    this.game.addEventListener('saved', () => {
      if (this.activeModal === 'modal-library' && this.libraryTab === 'games') {
        this.renderLibrary();
      }
    });
  }

  bindActions() {
    document.addEventListener('click', (event) => {
      const actionEl = event.target.closest('[data-action]');
      if (!actionEl) return;
      this.handleAction(actionEl.dataset.action, actionEl, event);
    });
  }

  bindModals() {
    this.modalRoot.addEventListener('click', (event) => {
      if (event.target.closest('[data-close-modal]')) {
        this.closeModal();
      }
    });
    this.confirmAccept.addEventListener('click', () => {
      if (this.confirmResolve) {
        const resolve = this.confirmResolve;
        this.confirmResolve = null;
        resolve(true);
      }
      this.closeModal({ restoreFocus: false });
    });
    this.promotionDialog.addEventListener('click', (event) => {
      const option = event.target.closest('[data-promotion]');
      if (option) {
        this.game.completePromotion(option.dataset.promotion);
      }
    });
  }

  bindNewGameForm() {
    document.querySelectorAll('.segmented').forEach((group) => {
      group.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-value]');
        if (!button) return;
        const key = group.dataset.group;
        this.newGameState[key] = button.dataset.value;
        group.querySelectorAll('button').forEach((item) => {
          item.classList.toggle('active', item === button);
        });
        if (key === 'mode') this.syncNewGameForm();
      });
    });

    document.querySelectorAll('[data-time]').forEach((button) => {
      button.addEventListener('click', () => {
        this.newGameState.timeControl = button.dataset.time;
        document.querySelectorAll('[data-time]').forEach((item) => {
          item.classList.toggle('active', item === button);
        });
      });
    });

    this.newDifficulty.addEventListener('change', () => {
      this.newGameState.difficulty = this.newDifficulty.value;
    });

    document.querySelectorAll('[data-library-tab]').forEach((button) => {
      button.addEventListener('click', () => {
        this.libraryTab = button.dataset.libraryTab;
        document.querySelectorAll('[data-library-tab]').forEach((item) => {
          item.classList.toggle('active', item === button);
        });
        this.renderLibrary();
      });
    });

    this.moveList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-move-index]');
      if (!button) return;
      this.game.reviewTo(Number(button.dataset.moveIndex));
    });
  }

  bindSettingsForm() {
    const bindSwitch = (id, key) => {
      const input = $(id);
      if (!input) return;
      input.addEventListener('change', () => {
        this.settings[key] = input.checked;
        saveSettings(this.settings);
        this.applySetting(key);
      });
    };

    bindSwitch('setting-sound', 'sound');
    bindSwitch('setting-animations', 'animations');
    bindSwitch('setting-hints', 'hints');
    bindSwitch('setting-coordinates', 'coordinates');
    bindSwitch('setting-lastmove', 'lastMove');
    bindSwitch('setting-analysis', 'liveAnalysis');
    bindSwitch('setting-book', 'book');

    const depth = $('setting-analysis-depth');
    const depthValue = $('analysis-depth-value');
    depth?.addEventListener('input', () => {
      this.settings.analysisDepth = Number(depth.value);
      depthValue.textContent = `${depth.value} ply`;
      saveSettings(this.settings);
      this.updateEngineConfig();
      clearTimeout(this.analysisDepthTimer);
      this.analysisDepthTimer = setTimeout(() => this.applySetting('analysisDepth'), 180);
    });
  }

  bindCamera() {
    document.querySelectorAll('[data-camera]').forEach((button) => {
      button.addEventListener('click', () => {
        const preset = button.dataset.camera;
        this.scene.cameraController.applyPreset(preset);
        this.setCameraActive(preset);
      });
    });

    document.querySelectorAll('[data-camera-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.cameraAction;
        const controller = this.scene.cameraController;
        if (action === 'rotate-left') controller.rotate(Math.PI / 8);
        if (action === 'rotate-right') controller.rotate(-Math.PI / 8);
        if (action === 'zoom-in') controller.zoom(0.86);
        if (action === 'zoom-out') controller.zoom(1.16);
        if (action === 'reset') {
          controller.applyPreset('standard');
          this.setCameraActive('standard');
        }
        if (action === 'flip') this.game.flipOrientation();
      });
    });
  }

  bindMobileTabs() {
    document.querySelectorAll('[data-mobile-tab]').forEach((button) => {
      button.addEventListener('click', () => this.toggleMobilePanel(button.dataset.mobileTab));
    });
  }

  bindKeyboard() {
    document.addEventListener('keydown', (event) => {
      if (event.target.closest('input, select, textarea, [contenteditable="true"]')) return;
      if (event.key === 'Escape') {
        if (this.promotionDialog.classList.contains('visible')) {
          this.game.cancelPromotion();
          return;
        }
        if (this.activeModal) {
          this.closeModal();
          return;
        }
        this.closeMobilePanels();
        return;
      }
      if (this.activeModal) return;
      const key = event.key.toLowerCase();
      if (key === 'n') {
        event.preventDefault();
        this.openNewGame();
      } else if (key === 'u') {
        event.preventDefault();
        this.game.undo();
      } else if (key === 'r') {
        event.preventDefault();
        this.game.redo();
      } else if (key === 'f') {
        event.preventDefault();
        this.game.flipOrientation();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        this.game.reviewStep(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        this.game.reviewStep(1);
      }
    });
  }

  bindSoundUnlock() {
    const unlock = () => this.sound.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  handleAction(action, element, event) {
    switch (action) {
      case 'new-game':
        this.openNewGame();
        break;
      case 'start-game':
        this.startNewGameFromModal();
        break;
      case 'library':
        this.openLibrary();
        break;
      case 'settings':
        this.openSettings();
        break;
      case 'help':
        this.openModal('modal-help');
        break;
      case 'offer-draw':
        this.game.offerDraw();
        break;
      case 'resign':
        this.requestConfirm({
          eyebrow: 'RESIGN',
          title: 'Resign this game?',
          text: 'The game will end immediately and be recorded in your library.',
          acceptLabel: 'Resign',
        }).then((confirmed) => {
          if (confirmed) this.game.resign();
        });
        break;
      case 'cancel-promotion':
        this.game.cancelPromotion();
        break;
      case 'go-live':
        this.game.goLive();
        break;
      case 'history-start':
        this.game.reviewTo(0);
        break;
      case 'history-end':
        this.game.goLive();
        break;
      case 'undo':
        this.game.undo();
        break;
      case 'redo':
        this.game.redo();
        break;
      case 'review-game':
        this.closeModal();
        this.game.reviewTo(0);
        break;
      case 'rematch':
        this.closeModal();
        this.startRematch();
        break;
      case 'reset-settings':
        this.resetSettings();
        break;
      case 'save-position':
        this.saveCurrentPosition();
        break;
      case 'load-library-entry': {
        event.stopPropagation();
        const id = Number(element.dataset.id);
        this.loadLibraryEntry(id);
        break;
      }
      case 'delete-library-entry': {
        event.stopPropagation();
        this.deleteLibraryEntry(Number(element.dataset.id));
        break;
      }
      default:
        break;
    }
  }

  handleReset(detail) {
    this.cancelGameOverTimer();
    if (this.activeModal === 'modal-gameover') this.closeModal({ restoreFocus: false });
    this.animating = false;
    this.clearSelection();
    this.hidePromotion();
    this.reviewBanner.classList.remove('visible');
    this.thinkingOverlay.classList.remove('visible');
    this.enginePulse.classList.remove('thinking');

    this.scene.setOrientation(detail.orientation, false);
    this.scene.buildPieces(this.game.chess);
    this.scene.setLastMove(null);
    this.scene.setCheck(null);

    this.updatePlayers();
    this.updateMeta();
    this.updateMoveList();
    this.updateCaptured();
    this.updateClocksFromGame();
    this.resetAnalysisPanel();
    this.updateNewGameStateFromGame();
    this.syncNewGameForm();
    this.setEngineState(this.settings.liveAnalysis ? 'Idle' : 'Off', this.settings.liveAnalysis ? '' : 'off');
    this.stageEngineText.textContent = 'Engine ready';
    this.saveSettings();
    this.updateReviewBanner(null);
  }

  handleMove(detail) {
    this.hidePromotion();
    this.scene.setLastMove(detail.lastMove);
    const animation = this.scene.applyMoveVisual(detail.move);
    this.animating = true;
    Promise.resolve(animation).finally(() => {
      this.animating = false;
    });
    this.clearSelection();
    this.updateMoveList();
    this.updateCaptured();
    this.updateClocksFromGame();
    this.playMoveSound(detail);
  }

  handleUndo(detail) {
    this.cancelGameOverTimer();
    if (this.activeModal === 'modal-gameover') this.closeModal({ restoreFocus: false });
    this.animating = false;
    this.hidePromotion();
    this.reviewBanner.classList.remove('visible');
    this.clearSelection();
    this.scene.buildPieces(this.game.chess);
    this.scene.setLastMove(detail.lastMove);
    this.scene.setCheck(null);
    this.updateMoveList();
    this.updateCaptured();
    this.updateClocksFromGame();
    this.updateReviewBanner(null);
  }

  handleReview(detail) {
    if (this.game.pendingPromotion) this.game.cancelPromotion();
    this.animating = false;
    this.clearSelection();
    this.hidePromotion();
    const position = new Chess(detail.fen);
    this.scene.buildPieces(position);
    this.scene.setLastMove(detail.lastMove);
    this.scene.setCheck(null);
    this.reviewBanner.classList.add('visible');
    this.updateReviewBanner(detail);
    this.updateMoveList();
    this.updateClocksFromGame();
  }

  handleLive(detail) {
    this.animating = false;
    this.clearSelection();
    this.scene.buildPieces(this.game.chess);
    this.scene.setLastMove(detail.lastMove);
    this.scene.setCheck(null);
    this.reviewBanner.classList.remove('visible');
    this.updateMoveList();
    this.updateClocksFromGame();
  }

  handlePromotion(detail) {
    this.clearSelection();
    this.promotionDialog.querySelectorAll('[data-promotion]').forEach((button) => {
      const type = button.dataset.promotion;
      const glyph = button.querySelector('.piece-glyph');
      glyph.textContent = PIECE_GLYPHS[detail.color][type];
      glyph.classList.toggle('white', detail.color === 'w');
      glyph.classList.toggle('black', detail.color === 'b');
    });
    this.promotionDialog.classList.add('visible');
  }

  handlePromotionCancelled() {
    this.hidePromotion();
    this.clearSelection();
    this.scene.buildPieces(this.game.chess);
    this.scene.setLastMove(this.game.moves[this.game.moves.length - 1] ?? null);
    this.scene.setCheck(this.game.chess.isCheck() ? this.findKing(this.game.chess) : null);
  }

  handleStatus(detail) {
    this.statusEyebrow.textContent = detail.reviewing
      ? 'POSITION REVIEW'
      : detail.gameOver
        ? 'GAME OVER'
        : 'GAME STATUS';
    this.statusTitle.textContent = detail.title;
    this.statusSub.textContent = detail.sub;

    this.tagCheck.hidden = !detail.check;
    this.tagLastMove.textContent = detail.lastMove
      ? `Last move ${detail.lastMove.san}`
      : 'Last move —';

    const turnDot = this.stageTurn.querySelector('.turn-dot');
    turnDot?.classList.toggle('black', detail.turn === 'b');
    if (detail.gameOver) {
      this.stageTurnText.textContent = 'Game over';
    } else if (detail.reviewing) {
      this.stageTurnText.textContent = `Review · ${detail.reviewIndex}/${detail.totalMoves}`;
    } else {
      this.stageTurnText.textContent = `${colorName(detail.turn)} to move`;
    }

    this.scene.setCheck(detail.checkSquare);
    this.updateReviewBanner(detail.reviewing ? detail : null);
    this.updatePlayerActive();
  }

  handleClock(detail) {
    this.clockState = detail;
    this.updateClocks();
  }

  handleThinking(detail) {
    this.thinkingOverlay.classList.toggle('visible', detail.thinking);
    this.enginePulse.classList.toggle('thinking', detail.thinking);
    if (detail.thinking) {
      this.thinkingTitle.textContent = 'Deep Blue is thinking';
      this.thinkingDetail.textContent = 'Preparing search…';
      this.setEngineState('Thinking', 'thinking');
      this.stageEngineText.textContent = 'Thinking…';
    } else {
      this.stageEngineText.textContent = this.settings.liveAnalysis ? 'Analyzing position' : 'Engine ready';
      if (!this.game.gameOver) {
        this.setEngineState(this.settings.liveAnalysis ? 'Analyzing' : 'Ready', 'thinking');
      }
    }
  }

  handleEngineProgress(detail) {
    const source = detail.source === 'analysis' ? 'analysis' : 'ai';
    if (source === 'ai') {
      if (this.game.thinking) {
        this.thinkingDetail.textContent = `Depth ${detail.depth ?? 0} · ${formatNodes(detail.nodes)} nodes`;
        this.stageEngineText.textContent = `Thinking · depth ${detail.depth ?? 0}`;
        this.setEngineState('Thinking', 'thinking');
      }
    } else {
      this.setEngineState('Analyzing', 'thinking');
    }

    const fen = detail.fen ?? this.game.fen;
    const depth = Number(detail.depth) || 0;
    const nodes = Number(detail.nodes) || 0;
    const time = Number(detail.time) || 0;
    const targetDepth = Math.max(1, Number(this.settings.analysisDepth) || 3);

    this.statDepth.textContent = depth ? String(depth) : '—';
    this.statNodes.textContent = nodes ? formatNodes(nodes) : '—';
    this.statNps.textContent = nodes && time ? formatNodes(Math.round(nodes / (time / 1000))) : '—';
    this.statTime.textContent = time ? formatSearchTime(time) : '—';
    this.searchProgress.style.width = `${Math.min(100, (depth / targetDepth) * 100)}%`;

    if (detail.scoreText !== undefined) {
      this.updateEvaluation(detail.whiteScore ?? 0, detail.scoreText, Boolean(detail.mate));
    }

    const pv = formatPv(detail.pv, fen);
    this.pvLine.textContent = pv || 'Calculating principal variation…';
  }

  handleAnalysis(detail) {
    if (detail.idle) {
      this.setEngineState('Off', 'off');
      this.statDepth.textContent = '—';
      this.statNodes.textContent = '—';
      this.statNps.textContent = '—';
      this.statTime.textContent = '—';
      this.searchProgress.style.width = '0%';
      this.pvLine.textContent = 'Live analysis is disabled.';
      return;
    }

    this.setEngineState(this.game.thinking ? 'Thinking' : 'Ready', this.game.thinking ? 'thinking' : '');
    this.searchProgress.style.width = '100%';
    this.statDepth.textContent = String(detail.depth ?? 0);
    this.statNodes.textContent = formatNodes(detail.nodes);
    this.statNps.textContent = formatNodes(detail.nps ?? 0);
    this.statTime.textContent = formatSearchTime(detail.time);
    this.updateEvaluation(detail.whiteScore ?? 0, detail.scoreText ?? '0.00', Boolean(detail.mate));
    const pv = formatPv(detail.pv, detail.fen ?? this.game.fen);
    this.pvLine.textContent = pv || 'No principal variation available.';
  }

  handleGameOver(detail) {
    this.cancelGameOverTimer();
    this.clearSelection();
    this.hidePromotion();
    this.animating = false;
    this.thinkingOverlay.classList.remove('visible');
    this.enginePulse.classList.remove('thinking');
    this.reviewBanner.classList.remove('visible');
    this.setEngineState('Idle', 'off');
    this.updateCaptured();
    this.updateClocksFromGame();

    this.lastRematch = {
      mode: detail.mode,
      side: detail.mode === 'ai' ? detail.humanColor : 'w',
      difficulty: detail.difficulty,
      timeControl: detail.timeControl,
    };

    let title = detail.title;
    if (detail.mode === 'ai') {
      if (!detail.winner) title = 'Draw';
      else if (detail.winner === detail.humanColor) title = 'You win';
      else title = 'Deep Blue wins';
    }

    this.gameoverCrest.textContent = detail.winner
      ? PIECE_GLYPHS[detail.winner].k
      : '½';
    this.gameoverTitle.textContent = title;
    this.gameoverReason.textContent = detail.reason;
    this.gameoverMoves.textContent = String(detail.moves);
    this.gameoverTime.textContent = formatElapsed(detail.time);
    this.gameoverResult.textContent = detail.resultText;

    if (detail.mode === 'ai' && detail.winner === detail.humanColor) {
      this.sound.play('win');
    } else {
      this.sound.play('gameover');
    }

    this.gameOverTimer = setTimeout(() => {
      this.gameOverTimer = null;
      this.openModal('modal-gameover');
    }, 650);
  }

  handleOrientation(detail) {
    this.scene.setOrientation(detail.orientation);
    this.updatePlayers();
    this.updateClocksFromGame();
    this.updateCaptured();
    this.updatePlayerActive();
  }

  updateReviewBanner(detail) {
    if (!detail) {
      this.reviewBanner.classList.remove('visible');
      return;
    }
    this.reviewBanner.classList.add('visible');
    this.reviewText.textContent = `Reviewing move ${detail.reviewIndex} of ${detail.totalMoves}`;
  }

  handleDrop(from, to) {
    if (!this.canInteract() || from === to) return false;
    const result = this.game.attemptMove(from, to);
    if (result.ok) {
      this.clearSelection();
      return true;
    }
    if (result.pending) {
      this.clearSelection();
      return true;
    }
    if (result.illegal) this.sound.play('illegal');
    return false;
  }

  handleSquareClick(square) {
    if (!this.canInteract()) return;
    if (this.selection) {
      if (this.selection === square) {
        this.clearSelection();
        return;
      }
      const result = this.game.attemptMove(this.selection, square);
      if (result.ok || result.pending) {
        this.clearSelection();
        return;
      }
      if (result.illegal) this.sound.play('illegal');
    }

    if (this.game.canSelect(square)) {
      this.selectSquare(square);
    } else {
      this.clearSelection();
    }
  }

  selectSquare(square) {
    const moves = this.game.getLegalMoves(square);
    if (moves.length === 0) return;
    this.selection = square;
    this.scene.showSelection(square, moves);
    this.sound.play('select');
  }

  clearSelection() {
    this.selection = null;
    this.scene.showSelection(null, []);
  }

  canInteract() {
    return !this.animating && this.game.canHumanMove();
  }

  hidePromotion() {
    this.promotionDialog.classList.remove('visible');
  }

  playMoveSound(detail) {
    const move = detail.plain;
    if (move.kingside || move.queenside) {
      this.sound.play('castle');
    } else if (move.captured) {
      this.sound.play('capture');
    } else {
      this.sound.play('move');
    }
    if (this.game.chess.isCheck()) {
      this.sound.play('check');
    }
  }

  updatePlayers() {
    const bottom = this.game.orientation;
    const top = otherColor(bottom);
    const mode = this.game.mode;
    const human = this.game.humanColor;
    const config = DIFFICULTIES[this.game.difficulty] ?? DIFFICULTIES.master;

    const topName = mode === 'ai' ? (top === human ? 'You' : 'Deep Blue') : colorName(top);
    const bottomName = mode === 'ai' ? (bottom === human ? 'You' : 'Deep Blue') : colorName(bottom);
    const topSub =
      mode === 'ai'
        ? top === human
          ? `${colorName(top)} · Human`
          : `${colorName(top)} · ${config.label} · ${config.rating}`
        : `${colorName(top)} · Local player`;
    const bottomSub =
      mode === 'ai'
        ? bottom === human
          ? `${colorName(bottom)} · Human`
          : `${colorName(bottom)} · ${config.label} · ${config.rating}`
        : `${colorName(bottom)} · Local player`;

    this.opponentName.textContent = topName;
    this.opponentRating.textContent = topSub;
    this.playerName.textContent = bottomName;
    this.playerRating.textContent = bottomSub;

    this.opponentAvatar.querySelector('span').textContent = PIECE_GLYPHS[top].k;
    this.playerAvatar.querySelector('span').textContent = PIECE_GLYPHS[bottom].k;
    this.opponentAvatar.classList.toggle('black', top === 'b');
    this.playerAvatar.classList.toggle('black', bottom === 'b');

    this.updateClocks();
    this.updatePlayerActive();
    this.updateCaptured();
  }

  playerColors() {
    const bottom = this.game.orientation;
    return { bottom, top: otherColor(bottom) };
  }

  updateClocks() {
    const { top, bottom } = this.playerColors();
    const state = this.clockState ?? {
      w: this.game.clock.remaining.w,
      b: this.game.clock.remaining.b,
      active: this.game.clock.running ? this.game.clock.active : null,
      initial: this.game.clock.initial,
    };
    this.setClockText(this.opponentClock, state[top], state.initial);
    this.setClockText(this.playerClock, state[bottom], state.initial);
    this.updatePlayerActive();
  }

  setClockText(element, milliseconds, initial) {
    element.textContent = initial > 0 ? formatClock(milliseconds) : '∞';
    element.classList.toggle('low', initial > 0 && milliseconds <= 20_000);
    element.classList.toggle('off', initial <= 0);
  }

  updateClocksFromGame() {
    this.clockState = {
      w: this.game.clock.remaining.w,
      b: this.game.clock.remaining.b,
      active: this.game.clock.running ? this.game.clock.active : null,
      initial: this.game.clock.initial,
    };
    this.updateClocks();
  }

  updatePlayerActive() {
    const { top, bottom } = this.playerColors();
    const state = this.clockState;
    const paused = this.game.gameOver || this.game.reviewIndex !== null;
    let active = null;
    if (!paused) {
      if (state && state.initial > 0) active = state.active;
      else active = this.game.turn;
    }
    this.opponentCard.classList.toggle('active', active === top);
    this.playerCard.classList.toggle('active', active === bottom);
  }

  updateCaptured() {
    const { top, bottom } = this.playerColors();
    const captured = this.game.captured ?? { w: [], b: [] };
    this.renderCaptured(this.opponentCaptured, captured[top] ?? [], otherColor(top));
    this.renderCaptured(this.playerCaptured, captured[bottom] ?? [], otherColor(bottom));

    const score = { w: 0, b: 0 };
    for (const color of ['w', 'b']) {
      for (const piece of captured[color] ?? []) {
        score[color] += PIECE_VALUES[piece] ?? 0;
      }
    }
    const difference = score[top] - score[bottom];
    this.opponentMaterial.textContent = difference > 0 ? `+${difference}` : '';
    this.playerMaterial.textContent = difference < 0 ? `+${Math.abs(difference)}` : '';
  }

  renderCaptured(element, pieces, color) {
    element.replaceChildren();
    const counts = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 };
    for (const piece of pieces) counts[piece] = (counts[piece] ?? 0) + 1;
    for (const type of ['q', 'r', 'b', 'n', 'p']) {
      for (let i = 0; i < counts[type]; i += 1) {
        const span = document.createElement('span');
        span.className = `cap${color === 'w' ? ' white-cap' : ''}`;
        span.textContent = PIECE_GLYPHS[color][type];
        span.title = `${colorName(color)} ${PIECE_NAMES[type]}`;
        element.appendChild(span);
      }
    }
  }

  updateMeta() {
    const config = DIFFICULTIES[this.game.difficulty] ?? DIFFICULTIES.master;
    const control = TIME_CONTROLS[this.game.timeControlKey] ?? TIME_CONTROLS['0,0'];
    this.gameModeLabel.textContent = this.game.mode === 'ai' ? 'Vs Computer' : 'Local Match';
    this.metaDifficulty.textContent = this.game.mode === 'ai' ? config.label : 'Human';
    this.metaTime.textContent = control.label;
    this.metaSide.textContent =
      this.game.mode === 'ai' ? (this.game.humanColor === 'w' ? 'White' : 'Black') : 'Both';
    this.metaBook.textContent = this.settings.book !== false ? 'Enabled' : 'Disabled';
  }

  updateMoveList() {
    const moves = this.game.moves;
    this.moveCount.textContent = `${moves.length} move${moves.length === 1 ? '' : 's'}`;
    this.moveList.replaceChildren();

    if (moves.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'move-empty';
      empty.append('No moves yet.');
      const hint = document.createElement('span');
      hint.textContent = 'The game begins with White.';
      empty.append(document.createElement('br'), hint);
      this.moveList.appendChild(empty);
      return;
    }

    for (let i = 0; i < moves.length; i += 2) {
      const row = document.createElement('div');
      row.className = 'move-row';
      const number = document.createElement('span');
      number.className = 'move-no';
      number.textContent = `${i / 2 + 1}.`;
      row.appendChild(number);

      for (let offset = 0; offset < 2; offset += 1) {
        const index = i + offset;
        const move = moves[index];
        if (!move) {
          row.appendChild(document.createElement('span'));
          continue;
        }
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'move-btn';
        button.dataset.moveIndex = String(index + 1);
        button.textContent = move.san;
        if (this.game.reviewIndex === index + 1) button.classList.add('active');
        if (this.game.reviewIndex === null && index === moves.length - 1) {
          button.classList.add('current');
        }
        row.appendChild(button);
      }

      this.moveList.appendChild(row);
    }
  }

  resetAnalysisPanel() {
    this.statDepth.textContent = '—';
    this.statNodes.textContent = '—';
    this.statNps.textContent = '—';
    this.statTime.textContent = '—';
    this.searchProgress.style.width = '0%';
    this.pvLine.textContent = this.settings.liveAnalysis
      ? 'Analyzing the starting position…'
      : 'Live analysis is disabled.';
    this.updateEvaluation(0, '0.00', false);
  }

  updateEvaluation(whiteScore, scoreText, mate) {
    const value = Number(whiteScore) || 0;
    const percent = mate
      ? value >= 0
        ? 98
        : 2
      : Math.max(0, Math.min(100, 50 + (value / 8) * 50));
    this.positionEval.textContent = scoreText;
    this.engineEvalScore.textContent = scoreText;
    this.engineEvalLabel.textContent = describeEvaluation(value, scoreText, mate);
    this.evalFill.style.width = `${percent}%`;
  }

  setEngineState(label, mode = '') {
    this.engineState.classList.toggle('thinking', mode === 'thinking');
    this.engineState.classList.toggle('off', mode === 'off');
    const dot = document.createElement('span');
    dot.className = 'dot';
    this.engineState.replaceChildren(dot, document.createTextNode(label));
  }

  updateEngineConfig() {
    const depth = Number(this.settings.analysisDepth) || 3;
    const seconds = (Math.min(3200, 420 + depth * 430) / 1000).toFixed(1);
    this.engineConfig.textContent = `Depth ${depth} · ${seconds}s`;
  }

  syncSettingsForm() {
    const mapping = {
      'setting-sound': 'sound',
      'setting-animations': 'animations',
      'setting-hints': 'hints',
      'setting-coordinates': 'coordinates',
      'setting-lastmove': 'lastMove',
      'setting-analysis': 'liveAnalysis',
      'setting-book': 'book',
    };
    for (const [id, key] of Object.entries(mapping)) {
      const input = $(id);
      if (input) input.checked = this.settings[key] !== false;
    }
    const depth = $('setting-analysis-depth');
    if (depth) depth.value = String(this.settings.analysisDepth ?? 3);
    const depthValue = $('analysis-depth-value');
    if (depthValue) depthValue.textContent = `${this.settings.analysisDepth ?? 3} ply`;
    this.updateEngineConfig();
    this.updateMeta();
  }

  applySetting(key) {
    if (key === 'sound') {
      this.sound.setEnabled(this.settings.sound !== false);
    } else if (key === 'animations') {
      this.scene.settings.animations = this.settings.animations !== false;
    } else if (key === 'hints') {
      if (!this.settings.hints) this.clearSelection();
      else if (this.selection) this.selectSquare(this.selection);
    } else if (key === 'coordinates') {
      this.scene.setCoordinatesVisible(this.settings.coordinates !== false);
    } else if (key === 'lastMove') {
      this.scene.setLastMove(this.game.moves[this.game.moves.length - 1] ?? null);
    } else if (key === 'book') {
      this.updateMeta();
    } else if (key === 'liveAnalysis' || key === 'analysisDepth') {
      this.updateEngineConfig();
      this.game.setSettings(this.settings);
    }
  }

  resetSettings() {
    Object.assign(this.settings, DEFAULT_SETTINGS);
    saveSettings(this.settings);
    this.syncSettingsForm();
    this.sound.setEnabled(this.settings.sound);
    this.scene.settings.animations = this.settings.animations;
    this.scene.setCoordinatesVisible(this.settings.coordinates);
    this.scene.setLastMove(this.game.moves[this.game.moves.length - 1] ?? null);
    this.clearSelection();
    this.updateEngineConfig();
    this.updateMeta();
    this.game.setSettings(this.settings);
    this.showToast({ message: 'Settings restored to defaults.', type: 'success' });
  }

  saveSettings() {
    saveSettings(this.settings);
  }

  openModal(id) {
    const modal = $(id);
    if (!modal) return;
    if (this.activeModal) this.closeModal({ restoreFocus: false });
    this.closeMobilePanels();
    this.lastFocused = document.activeElement;
    this.activeModal = id;
    this.modalRoot.classList.add('open');
    this.modalRoot.setAttribute('aria-hidden', 'false');
    this.modalRoot.querySelectorAll('.modal').forEach((item) => {
      item.classList.toggle('active', item === modal);
    });
    const focusable = modal.querySelector('button, select, input');
    focusable?.focus?.({ preventScroll: true });
  }

  closeModal({ restoreFocus = true } = {}) {
    if (this.activeModal === 'modal-confirm' && this.confirmResolve) {
      const resolve = this.confirmResolve;
      this.confirmResolve = null;
      resolve(false);
    }
    this.activeModal = null;
    this.modalRoot.classList.remove('open');
    this.modalRoot.setAttribute('aria-hidden', 'true');
    this.modalRoot.querySelectorAll('.modal').forEach((item) => item.classList.remove('active'));
    if (restoreFocus && this.lastFocused?.focus) {
      try {
        this.lastFocused.focus({ preventScroll: true });
      } catch {
        this.lastFocused = null;
      }
    }
    this.lastFocused = null;
  }

  requestConfirm({ eyebrow = 'CONFIRM', title, text, acceptLabel = 'Confirm' }) {
    if (this.confirmResolve) {
      this.confirmResolve(false);
      this.confirmResolve = null;
    }
    this.confirmEyebrow.textContent = eyebrow;
    this.confirmTitle.textContent = title;
    this.confirmText.textContent = text;
    this.confirmAccept.textContent = acceptLabel;
    this.openModal('modal-confirm');
    return new Promise((resolve) => {
      this.confirmResolve = resolve;
    });
  }

  openNewGame() {
    this.updateNewGameStateFromGame();
    this.syncNewGameForm();
    this.openModal('modal-new-game');
  }

  updateNewGameStateFromGame() {
    this.newGameState = {
      mode: this.game.mode,
      side: this.game.mode === 'ai' ? this.game.humanColor : 'w',
      difficulty: this.game.difficulty,
      timeControl: this.game.timeControlKey || this.settings.timeControl,
    };
  }

  syncNewGameForm() {
    document.querySelectorAll('.segmented').forEach((group) => {
      const key = group.dataset.group;
      const value = this.newGameState[key];
      group.querySelectorAll('button').forEach((button) => {
        button.classList.toggle('active', button.dataset.value === value);
      });
    });
    this.newDifficulty.value = this.newGameState.difficulty;
    document.querySelectorAll('[data-time]').forEach((button) => {
      button.classList.toggle('active', button.dataset.time === this.newGameState.timeControl);
    });
    this.aiOptions.style.display = this.newGameState.mode === 'ai' ? '' : 'none';
  }

  startNewGameFromModal() {
    const options = {
      mode: this.newGameState.mode,
      side: this.newGameState.mode === 'human' ? 'w' : this.newGameState.side,
      difficulty: this.newGameState.difficulty,
      timeControl: this.newGameState.timeControl,
    };
    this.closeModal({ restoreFocus: false });
    this.settings.difficulty = options.difficulty;
    this.settings.timeControl = options.timeControl;
    saveSettings(this.settings);
    this.game.newGame(options);
  }

  startRematch() {
    const options =
      this.lastRematch ?? {
        mode: this.game.mode,
        side: this.game.mode === 'ai' ? this.game.humanColor : 'w',
        difficulty: this.game.difficulty,
        timeControl: this.game.timeControlKey,
      };
    this.game.newGame(options);
  }

  openSettings() {
    this.syncSettingsForm();
    this.openModal('modal-settings');
  }

  async openLibrary() {
    this.libraryTab = 'games';
    document.querySelectorAll('[data-library-tab]').forEach((button) => {
      button.classList.toggle('active', button.dataset.libraryTab === 'games');
    });
    this.openModal('modal-library');
    await this.renderLibrary();
  }

  async renderLibrary() {
    this.libraryList.replaceChildren();
    const loading = document.createElement('div');
    loading.className = 'library-empty';
    loading.textContent = 'Loading library…';
    this.libraryList.appendChild(loading);

    if (!this.store) {
      loading.textContent = 'Local storage is unavailable in this browser.';
      return;
    }

    const entries =
      this.libraryTab === 'games' ? await this.store.getGames() : await this.store.getPositions();
    entries.sort((a, b) => (b.date ?? 0) - (a.date ?? 0));
    this.libraryList.replaceChildren();

    if (entries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'library-empty';
      empty.textContent =
        this.libraryTab === 'games' ? 'No saved games yet.' : 'No saved positions yet.';
      this.libraryList.appendChild(empty);
      return;
    }

    for (const entry of entries) {
      this.libraryList.appendChild(this.createLibraryItem(entry));
    }
  }

  createLibraryItem(entry) {
    const item = document.createElement('div');
    item.className = 'library-item';

    const icon = document.createElement('div');
    icon.className = 'library-icon';
    icon.textContent = this.libraryTab === 'games' ? '♜' : '◆';

    const info = document.createElement('div');
    info.className = 'library-info';
    const title = document.createElement('strong');
    if (this.libraryTab === 'games') {
      title.textContent =
        entry.mode === 'ai'
          ? `You (${entry.humanColor === 'b' ? 'Black' : 'White'}) vs Deep Blue · ${entry.result ?? '—'}`
          : `White vs Black · ${entry.result ?? '—'}`;
    } else {
      title.textContent = entry.name || 'Saved position';
    }
    const detail = document.createElement('span');
    if (this.libraryTab === 'games') {
      detail.textContent = `${formatDate(entry.date)} · ${entry.moves?.length ?? 0} ply · ${entry.reason ?? ''}`;
    } else {
      detail.textContent = `${formatDate(entry.date)} · ${entry.moves ?? 0} moves played`;
    }
    info.append(title, detail);

    const actions = document.createElement('div');
    actions.className = 'library-actions';
    const load = document.createElement('button');
    load.type = 'button';
    load.className = 'btn btn-subtle btn-small';
    load.dataset.action = 'load-library-entry';
    load.dataset.id = String(entry.id);
    load.textContent = 'Load';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'icon-btn';
    remove.dataset.action = 'delete-library-entry';
    remove.dataset.id = String(entry.id);
    remove.title = 'Delete';
    remove.textContent = '×';
    actions.append(load, remove);

    item.append(icon, info, actions);
    return item;
  }

  async loadLibraryEntry(id) {
    const entries =
      this.libraryTab === 'games' ? await this.store.getGames() : await this.store.getPositions();
    const entry = entries.find((item) => item.id === id);
    if (!entry) {
      this.showToast({ message: 'That entry could not be found.', type: 'error' });
      return;
    }
    this.closeModal({ restoreFocus: false });
    if (this.libraryTab === 'games') {
      this.game.loadGame(entry);
    } else {
      this.game.loadPosition(entry.fen, entry.name || 'Position');
    }
  }

  async deleteLibraryEntry(id) {
    const removed =
      this.libraryTab === 'games'
        ? await this.store.deleteGame(id)
        : await this.store.deletePosition(id);
    if (removed) {
      this.showToast({ message: 'Library entry deleted.', type: 'success' });
      await this.renderLibrary();
    } else {
      this.showToast({ message: 'Could not delete that entry.', type: 'error' });
    }
  }

  async saveCurrentPosition() {
    const name = `Position · ${new Date().toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}`;
    const saved = await this.game.saveCurrentPosition(name);
    if (!saved) return;
    if (this.activeModal === 'modal-library') {
      this.libraryTab = 'positions';
      document.querySelectorAll('[data-library-tab]').forEach((button) => {
        button.classList.toggle('active', button.dataset.libraryTab === 'positions');
      });
      await this.renderLibrary();
    }
  }

  toggleMobilePanel(name) {
    const config = {
      info: { panel: 'panel-info', scroll: null },
      engine: { panel: 'panel-engine', scroll: '.engine-card' },
      moves: { panel: 'panel-engine', scroll: '.moves-card' },
    }[name];
    if (!config) return;
    const panel = $(config.panel);
    const alreadyOpen = this.mobileTab === name && panel.classList.contains('mobile-visible');
    document.querySelectorAll('.side-panel').forEach((item) => {
      item.classList.remove('mobile-visible');
    });
    document.querySelectorAll('[data-mobile-tab]').forEach((button) => {
      button.classList.toggle('active', !alreadyOpen && button.dataset.mobileTab === name);
    });
    if (alreadyOpen) {
      this.mobileTab = null;
      return;
    }
    this.mobileTab = name;
    panel.classList.add('mobile-visible');
    if (config.scroll) {
      const target = panel.querySelector(config.scroll);
      if (target) {
        requestAnimationFrame(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    }
  }

  closeMobilePanels() {
    this.mobileTab = null;
    document.querySelectorAll('.side-panel').forEach((item) => {
      item.classList.remove('mobile-visible');
    });
    document.querySelectorAll('[data-mobile-tab]').forEach((button) => {
      button.classList.remove('active');
    });
  }

  setCameraActive(preset) {
    document.querySelectorAll('[data-camera]').forEach((button) => {
      button.classList.toggle('active', button.dataset.camera === preset);
    });
  }

  showToast({ message, type = '' }) {
    if (!message) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`.trim();
    toast.textContent = message;
    this.toastStack.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('leaving');
      setTimeout(() => toast.remove(), 240);
    }, 3200);
  }

  cancelGameOverTimer() {
    if (this.gameOverTimer) {
      clearTimeout(this.gameOverTimer);
      this.gameOverTimer = null;
    }
  }

  findKing(chess) {
    const found = chess.findPiece({ type: 'k', color: chess.turn() });
    return found?.[0] ?? null;
  }
}
