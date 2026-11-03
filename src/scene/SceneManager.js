import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Board } from './Board.js';
import { CameraController } from './CameraController.js';
import { Animations, easeInOutCubic, easeOutBack, easeOutCubic } from './Animations.js';
import { createMaterials } from './materials.js';
import { createPiece } from './pieces.js';
import { FILES } from '../core/constants.js';

function createContactShadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(256, 256, 30, 256, 256, 250);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  gradient.addColorStop(0.45, 'rgba(0, 0, 0, 0.42)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class SceneManager {
  constructor(container, settings) {
    this.container = container;
    this.settings = settings;
    this.pieces = new Map();
    this.handlers = {};
    this.orientation = 'w';
    this.destroyed = false;
    this.pointerState = null;
    this.activePointers = new Set();

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x0b0e13, 26, 58);

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);

    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 120);
    this.camera.position.set(0, 10.4, 12.2);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.setAttribute('aria-label', 'Interactive 3D chessboard');
    this.renderer.domElement.tabIndex = 0;
    container.appendChild(this.renderer.domElement);

    this.animations = new Animations();
    this.materials = createMaterials(this.renderer);

    this.board = new Board(this.materials);
    this.scene.add(this.board.root);

    this.piecesRoot = new THREE.Group();
    this.piecesRoot.name = 'pieces';
    this.board.root.add(this.piecesRoot);

    this.cameraController = new CameraController(
      this.camera,
      this.renderer.domElement,
      this.animations,
    );

    this.setupEnvironment();
    this.setupLights();
    this.setupGround();
    this.bindPointerEvents();
    this.bindResize();

    this.board.setCoordinatesVisible(settings.coordinates !== false);
    this.loop = this.loop.bind(this);
    this.animationFrame = requestAnimationFrame(this.loop);
  }

  setupEnvironment() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const environmentScene = new RoomEnvironment();
    const envMap = pmrem.fromScene(environmentScene, 0.04).texture;
    this.scene.environment = envMap;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();
    environmentScene.traverse((child) => {
      if (child.isMesh) {
        child.geometry?.dispose?.();
        child.material?.dispose?.();
      }
    });
  }

  setupLights() {
    const hemisphere = new THREE.HemisphereLight(0xcfdef5, 0x17110b, 0.55);
    this.scene.add(hemisphere);

    const key = new THREE.DirectionalLight(0xfff0d4, 2.7);
    key.position.set(6.5, 13, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -11;
    key.shadow.camera.right = 11;
    key.shadow.camera.top = 11;
    key.shadow.camera.bottom = -11;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 38;
    key.shadow.bias = -0.00035;
    key.shadow.normalBias = 0.022;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x9db9e8, 0.75);
    fill.position.set(-9, 8, -6);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xd5aa62, 0.9);
    rim.position.set(2, 6, -11);
    this.scene.add(rim);

    const topLight = new THREE.PointLight(0xffe6b8, 14, 18, 2);
    topLight.position.set(0, 7, 1.5);
    this.scene.add(topLight);

    const boardGlow = new THREE.PointLight(0xd5aa62, 7, 9, 2.2);
    boardGlow.position.set(0, 2.7, 0);
    this.scene.add(boardGlow);
  }

  setupGround() {
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(30, 72),
      new THREE.MeshStandardMaterial({
        color: 0x080a0e,
        roughness: 0.92,
        metalness: 0.18,
        envMapIntensity: 0.25,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.745;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(6.4, 6.46, 96),
      new THREE.MeshBasicMaterial({
        color: 0xd5aa62,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.738;
    this.scene.add(ring);

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(17, 17),
      new THREE.MeshBasicMaterial({
        map: createContactShadowTexture(),
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.74;
    this.scene.add(shadow);
  }

  bindResize() {
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);
    this.handleResize();
  }

  handleResize() {
    if (this.destroyed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (this.cameraController.preset !== 'free' && !this.cameraController.tweening) {
      this.cameraController.applyPreset(this.cameraController.preset, { instant: true });
    } else {
      this.cameraController.fitCurrent();
    }
  }

  bindPointerEvents() {
    const dom = this.renderer.domElement;
    this.onPointerDown = (event) => this.handlePointerDown(event);
    this.onPointerMove = (event) => this.handlePointerMove(event);
    this.onPointerUp = (event) => this.handlePointerUp(event);
    this.onDoubleClick = (event) => this.handleDoubleClick(event);
    this.onContextMenu = (event) => event.preventDefault();

    dom.addEventListener('pointerdown', this.onPointerDown);
    dom.addEventListener('pointermove', this.onPointerMove);
    dom.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('pointercancel', this.onPointerUp);
    dom.addEventListener('dblclick', this.onDoubleClick);
    dom.addEventListener('contextmenu', this.onContextMenu);
  }

  setHandlers(handlers) {
    this.handlers = handlers;
  }

  setCameraInteractionHandler(handler) {
    this.cameraController.onUserInteract = handler;
  }

  getNDC(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  pick(event) {
    const ndc = this.getNDC(event);
    this.raycaster = this.raycaster ?? new THREE.Raycaster();
    this.raycaster.setFromCamera(ndc, this.camera);
    const objects = [...this.board.getSquareMeshes(), this.piecesRoot];
    const hits = this.raycaster.intersectObjects(objects, true);
    for (const hit of hits) {
      let object = hit.object;
      while (object) {
        if (object.userData?.square) {
          return {
            square: object.userData.square,
            piece: this.pieces.get(object.userData.square) ?? null,
            object: hit.object,
          };
        }
        object = object.parent;
      }
    }
    return null;
  }

  pickFromGround(event, y = 0.55) {
    const ndc = this.getNDC(event);
    this.raycaster = this.raycaster ?? new THREE.Raycaster();
    this.raycaster.setFromCamera(ndc, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
    const point = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(plane, point)) return null;
    const local = this.board.root.worldToLocal(point.clone());
    return { local, square: this.board.squareFromLocal(local) };
  }

  handlePointerDown(event) {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    this.activePointers.add(event.pointerId);

    if (this.activePointers.size > 1) {
      if (this.draggingState()) {
        this.cancelDrag();
      }
      return;
    }

    const hit = this.pick(event);
    const state = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      downSquare: hit?.square ?? null,
      from: null,
      piece: null,
      dragging: false,
      moved: false,
    };

    if (hit?.square && this.handlers.canDrag?.(hit.square)) {
      state.from = hit.square;
      state.piece = this.pieces.get(hit.square) ?? null;
      this.cameraController.controls.enabled = false;
      try {
        this.renderer.domElement.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture may be unavailable.
      }
    }

    this.pointerState = state;
  }

  handlePointerMove(event) {
    if (!this.pointerState) {
      if (!this.activePointers.size) {
        const hover = this.pick(event);
        this.board.setHover(hover?.square ?? null);
      }
      return;
    }

    const state = this.pointerState;
    if (state.pointerId !== event.pointerId) return;

    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    const distance = Math.hypot(dx, dy);

    if (!state.dragging && state.from && distance > 6) {
      state.dragging = true;
      state.moved = true;
      this.cameraController.controls.enabled = false;
      this.handlers.onDragStart?.(state.from);
      if (state.piece) {
        state.piece.position.y = 0.55;
        state.piece.scale.setScalar(1.06);
      }
    }

    if (state.moved) state.moved = true;

    if (state.dragging && state.piece) {
      const ground = this.pickFromGround(event, 0.55);
      if (ground) {
        state.piece.position.x = ground.local.x;
        state.piece.position.z = ground.local.z;
        state.piece.rotation.y = 0;
        this.board.setHover(ground.square);
        this.handlers.onDragHover?.(state.from, ground.square);
      }
    } else if (distance > 6) {
      state.moved = true;
    }
  }

  draggingState() {
    return Boolean(this.pointerState?.dragging);
  }

  handlePointerUp(event) {
    this.activePointers.delete(event.pointerId);
    const state = this.pointerState;
    if (!state || state.pointerId !== event.pointerId) return;
    this.pointerState = null;

    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    const distance = Math.hypot(dx, dy);

    if (state.dragging && state.piece) {
      const ground = this.pickFromGround(event, 0.55);
      const target = ground?.square ?? null;
      let accepted = false;
      if (target) {
        accepted = Boolean(this.handlers.onDrop?.(state.from, target));
      }
      if (!accepted) {
        this.snapPieceBack(state.piece, state.from);
      }
      this.board.setHover(null);
      this.handlers.onDragHover?.(state.from, null);
    } else if (distance < 7 && state.downSquare) {
      this.handlers.onSquareClick?.(state.downSquare);
    }

    state.piece?.scale.setScalar(1);
    if (!this.cameraController.tweening) {
      this.cameraController.controls.enabled = true;
    }
    try {
      this.renderer.domElement.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may be unavailable.
    }
  }

  cancelDrag() {
    const state = this.pointerState;
    if (!state) return;
    if (state.dragging && state.piece) {
      this.snapPieceBack(state.piece, state.from);
    }
    this.board.setHover(null);
    this.pointerState = null;
    if (!this.cameraController.tweening) {
      this.cameraController.controls.enabled = true;
    }
  }

  snapPieceBack(piece, square) {
    if (!piece || !square) return;
    const start = piece.position.clone();
    const end = this.board.localPosition(square, 0.005);
    const duration = this.settings.animations === false ? 0 : 220;
    this.animations.cancelTag(`snap-${square}`);
    this.animations.add({
      tag: `snap-${square}`,
      duration,
      ease: easeOutCubic,
      onUpdate: (_raw, eased) => {
        piece.position.lerpVectors(start, end, eased);
      },
      onComplete: () => {
        piece.position.copy(end);
        piece.scale.setScalar(1);
      },
    });
  }

  handleDoubleClick(event) {
    const hit = this.pick(event);
    if (hit?.square) {
      this.handlers.onDoubleClick?.(hit.square);
    }
  }

  buildPieces(chess) {
    while (this.piecesRoot.children.length) {
      this.piecesRoot.remove(this.piecesRoot.children[0]);
    }
    this.pieces.clear();
    const board = chess.board();
    for (let row = 0; row < 8; row += 1) {
      for (let file = 0; file < 8; file += 1) {
        const cell = board[row][file];
        if (!cell) continue;
        const rank = 8 - row;
        const square = `${FILES[file]}${rank}`;
        const group = createPiece(cell.type, cell.color, this.materials);
        group.position.copy(this.board.localPosition(square, 0.006));
        group.userData.square = square;
        this.piecesRoot.add(group);
        this.pieces.set(square, group);
      }
    }
  }

  setOrientation(side, animate = true) {
    if (this.orientation === side && this.board.root.rotation.y === 0) {
      this.cameraController.setOrientation(side);
      return;
    }
    this.orientation = side;
    this.cameraController.setOrientation(side);
    const target = side === 'w' ? 0 : Math.PI;
    const start = this.board.root.rotation.y;
    const duration = animate && this.settings.animations !== false ? 620 : 0;

    this.animations.cancelTag('orientation');
    if (duration === 0) {
      this.board.root.rotation.y = target;
      if (this.cameraController.preset === 'white' || this.cameraController.preset === 'black') {
        this.cameraController.applyPreset(this.cameraController.preset, { instant: true });
      }
      return;
    }

    this.animations.add({
      tag: 'orientation',
      duration,
      ease: easeInOutCubic,
      onUpdate: (_raw, eased) => {
        this.board.root.rotation.y = start + (target - start) * eased;
      },
      onComplete: () => {
        this.board.root.rotation.y = target;
        if (this.cameraController.preset === 'white' || this.cameraController.preset === 'black') {
          this.cameraController.applyPreset(this.cameraController.preset);
        }
      },
    });
  }

  applyMoveVisual(move) {
    const animate = this.settings.animations !== false;
    const duration = animate ? 320 : 0;
    const moving = this.pieces.get(move.from);
    if (!moving) return Promise.resolve();

    const flagString = typeof move.flags === 'string' ? move.flags : '';
    const isEnPassant =
      (typeof move.isEnPassant === 'function' && move.isEnPassant()) || flagString.includes('e');
    const isKingside =
      (typeof move.isKingsideCastle === 'function' && move.isKingsideCastle()) ||
      flagString.includes('k');
    const isQueenside =
      (typeof move.isQueensideCastle === 'function' && move.isQueensideCastle()) ||
      flagString.includes('q');

    const captureSquare = isEnPassant ? `${move.to[0]}${move.from[1]}` : move.to;
    const captured = this.pieces.get(captureSquare);
    if (captured && captureSquare !== move.from) {
      this.pieces.delete(captureSquare);
      this.animateCapture(captured, animate);
    }

    this.pieces.delete(move.from);
    moving.userData.square = move.to;
    moving.scale.setScalar(1);
    const end = this.board.localPosition(move.to, 0.006);
    const start = moving.position.clone();
    const lift = animate ? (move.piece === 'n' ? 0.52 : 0.28) : 0;

    const promises = [];

    promises.push(
      this.animations.add({
        tag: `piece-${move.to}`,
        duration,
        ease: easeInOutCubic,
        onUpdate: (raw, eased) => {
          moving.position.x = start.x + (end.x - start.x) * eased;
          moving.position.z = start.z + (end.z - start.z) * eased;
          moving.position.y = start.y + (end.y - start.y) * eased + Math.sin(Math.PI * raw) * lift;
        },
        onComplete: () => {
          moving.position.copy(end);
          if (move.promotion) {
            this.promoteVisual(move, moving, animate);
          } else {
            this.pieces.set(move.to, moving);
          }
        },
      }),
    );

    if (isKingside || isQueenside) {
      const rank = move.from[1];
      const rookFrom = isKingside ? `h${rank}` : `a${rank}`;
      const rookTo = isKingside ? `f${rank}` : `d${rank}`;
      const rook = this.pieces.get(rookFrom);
      if (rook) {
        this.pieces.delete(rookFrom);
        rook.userData.square = rookTo;
        const rookStart = rook.position.clone();
        const rookEnd = this.board.localPosition(rookTo, 0.006);
        promises.push(
          this.animations.add({
            tag: `rook-${rookTo}`,
            duration,
            ease: easeInOutCubic,
            onUpdate: (_raw, eased) => {
              rook.position.lerpVectors(rookStart, rookEnd, eased);
            },
            onComplete: () => {
              rook.position.copy(rookEnd);
              this.pieces.set(rookTo, rook);
            },
          }),
        );
      }
    }

    return Promise.all(promises);
  }

  animateCapture(piece, animate) {
    const duration = animate ? 260 : 0;
    const start = piece.position.clone();
    const scale = piece.scale.clone();
    this.animations.add({
      tag: 'capture',
      duration,
      ease: easeOutCubic,
      onUpdate: (raw, eased) => {
        piece.position.y = start.y + eased * 0.25;
        piece.position.x = start.x + Math.sin(raw * Math.PI) * 0.04;
        piece.scale.setScalar(1 - eased * 0.92);
        piece.rotation.y = eased * 0.9;
      },
      onComplete: () => {
        piece.scale.copy(scale);
        this.piecesRoot.remove(piece);
      },
    });
  }

  promoteVisual(move, pawn, animate) {
    const end = this.board.localPosition(move.to, 0.006);
    this.piecesRoot.remove(pawn);
    const promoted = createPiece(
      move.promotion ?? 'q',
      move.color ?? (move.to[1] === '8' ? 'w' : 'b'),
      this.materials,
    );
    promoted.position.copy(end);
    promoted.userData.square = move.to;
    promoted.scale.setScalar(animate ? 0.05 : 1);
    this.piecesRoot.add(promoted);
    this.pieces.set(move.to, promoted);

    if (animate) {
      this.animations.add({
        tag: `promotion-${move.to}`,
        duration: 320,
        ease: easeOutBack,
        onUpdate: (_raw, eased) => {
          promoted.scale.setScalar(0.05 + eased * 0.95);
        },
        onComplete: () => {
          promoted.scale.setScalar(1);
        },
      });
    }
  }

  showSelection(square, moves) {
    if (this.settings.hints === false) {
      this.board.showSelection(square, []);
      return;
    }
    this.board.showSelection(square, moves);
  }

  setLastMove(move) {
    this.board.setLastMove(move, this.settings.lastMove !== false);
  }

  setCheck(square) {
    this.board.setCheck(square);
  }

  setCoordinatesVisible(visible) {
    this.board.setCoordinatesVisible(visible);
  }

  focusSquare(square) {
    const world = this.board.squareToWorld(square);
    this.cameraController.focusOn(world);
  }

  loop(now) {
    if (this.destroyed) return;
    this.animations.update(now);
    this.board.pulseCheck(now);
    this.cameraController.update();
    this.renderer.render(this.scene, this.camera);
    this.animationFrame = requestAnimationFrame(this.loop);
  }

  dispose() {
    this.destroyed = true;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver?.disconnect();
    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    dom.removeEventListener('pointermove', this.onPointerMove);
    dom.removeEventListener('pointerup', this.onPointerUp);
    dom.removeEventListener('pointercancel', this.onPointerUp);
    dom.removeEventListener('dblclick', this.onDoubleClick);
    dom.removeEventListener('contextmenu', this.onContextMenu);
    this.renderer.dispose();
  }
}
