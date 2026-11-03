import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { FILES, RANKS } from '../core/constants.js';
import { createTextSprite } from './materials.js';

const BOARD_HALF = 4;

export class Board {
  constructor(materials) {
    this.materials = materials;
    this.root = new THREE.Group();
    this.root.name = 'board';
    this.squareMeshes = [];
    this.squareMap = new Map();
    this.coordinateSprites = [];
    this.highlightRoot = new THREE.Group();
    this.highlightRoot.name = 'highlights';

    this.selectedMesh = null;
    this.legalRoot = new THREE.Group();
    this.lastMoveMeshes = [];
    this.checkMesh = null;
    this.hoverMesh = null;

    this.squareGeometry = new THREE.BoxGeometry(0.985, 0.09, 0.985);
    this.dotGeometry = new THREE.CircleGeometry(0.135, 28);
    this.ringGeometry = new THREE.RingGeometry(0.32, 0.405, 32);
    this.planeGeometry = new THREE.PlaneGeometry(0.97, 0.97);

    this.buildBase();
    this.buildSquares();
    this.buildCoordinates();
    this.buildHighlights();
  }

  buildBase() {
    const base = new THREE.Mesh(
      new RoundedBoxGeometry(9.25, 0.52, 9.25, 4, 0.09),
      this.materials.frame,
    );
    base.position.y = -0.345;
    base.castShadow = true;
    base.receiveShadow = true;
    this.root.add(base);

    const underBase = new THREE.Mesh(
      new RoundedBoxGeometry(9.55, 0.16, 9.55, 3, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x201811, roughness: 0.62, metalness: 0.15 }),
    );
    underBase.position.y = -0.66;
    underBase.receiveShadow = true;
    this.root.add(underBase);

    const trimGeometry = new THREE.BoxGeometry(8.92, 0.035, 0.045);
    const trimFront = new THREE.Mesh(trimGeometry, this.materials.gold);
    trimFront.position.set(0, -0.055, 4.47);
    trimFront.castShadow = true;
    this.root.add(trimFront);

    const trimBack = trimFront.clone();
    trimBack.position.z = -4.47;
    this.root.add(trimBack);

    const trimSide = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.035, 8.92), this.materials.gold);
    trimSide.position.set(4.47, -0.055, 0);
    trimSide.castShadow = true;
    this.root.add(trimSide);

    const trimSide2 = trimSide.clone();
    trimSide2.position.x = -4.47;
    this.root.add(trimSide2);

    const innerGeometry = new THREE.BoxGeometry(8.12, 0.018, 0.022);
    for (const z of [-4.04, 4.04]) {
      const trim = new THREE.Mesh(innerGeometry, this.materials.goldDark);
      trim.position.set(0, -0.002, z);
      this.root.add(trim);
    }
    const innerSide = new THREE.Mesh(
      new THREE.BoxGeometry(0.022, 0.018, 8.12),
      this.materials.goldDark,
    );
    for (const x of [-4.04, 4.04]) {
      const trim = innerSide.clone();
      trim.position.set(x, -0.002, 0);
      this.root.add(trim);
    }

    const cornerGeometry = new THREE.CylinderGeometry(0.045, 0.045, 0.02, 20);
    for (const x of [-4.06, 4.06]) {
      for (const z of [-4.06, 4.06]) {
        const stud = new THREE.Mesh(cornerGeometry, this.materials.gold);
        stud.position.set(x, -0.045, z);
        stud.castShadow = true;
        this.root.add(stud);
      }
    }
  }

  buildSquares() {
    for (let rank = 0; rank < 8; rank += 1) {
      for (let file = 0; file < 8; file += 1) {
        const square = `${FILES[file]}${RANKS[rank]}`;
        const isDark = (file + rank) % 2 === 0;
        const baseMaterial = isDark
          ? this.materials.darkSquareBase
          : this.materials.lightSquareBase;
        const material = baseMaterial.clone();
        const mesh = new THREE.Mesh(this.squareGeometry, material);
        mesh.position.set(file - 3.5, -0.045, 3.5 - rank);
        mesh.receiveShadow = true;
        mesh.userData.square = square;
        mesh.userData.file = file;
        mesh.userData.rank = rank;
        this.root.add(mesh);
        this.squareMeshes.push(mesh);
        this.squareMap.set(square, mesh);
      }
    }
  }

  buildCoordinates() {
    this.coordinateRoot = new THREE.Group();
    for (let i = 0; i < 8; i += 1) {
      const letter = FILES[i];
      for (const side of [-1, 1]) {
        const sprite = createTextSprite(letter, '#c9a15c', 0.3);
        sprite.position.set(i - 3.5, 0.13, side * 4.285);
        this.coordinateRoot.add(sprite);
        this.coordinateSprites.push(sprite);
      }
      const number = RANKS[i];
      for (const side of [-1, 1]) {
        const sprite = createTextSprite(number, '#c9a15c', 0.3);
        sprite.position.set(side * 4.285, 0.13, 3.5 - i);
        this.coordinateRoot.add(sprite);
        this.coordinateSprites.push(sprite);
      }
    }
    this.root.add(this.coordinateRoot);
  }

  buildHighlights() {
    this.root.add(this.highlightRoot);

    const selected = new THREE.Mesh(
      new THREE.RingGeometry(0.285, 0.395, 40),
      this.materials.selected,
    );
    selected.rotation.x = -Math.PI / 2;
    selected.position.y = 0.018;
    selected.renderOrder = 3;
    selected.visible = false;
    this.root.add(selected);
    this.selectedMesh = selected;

    this.root.add(this.legalRoot);

    for (let i = 0; i < 2; i += 1) {
      const plane = new THREE.Mesh(this.planeGeometry, this.materials.lastMove);
      plane.rotation.x = -Math.PI / 2;
      plane.position.y = 0.011;
      plane.visible = false;
      plane.renderOrder = 1;
      this.root.add(plane);
      this.lastMoveMeshes.push(plane);
    }

    this.checkMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.99, 0.99),
      this.materials.check.clone(),
    );
    this.checkMesh.rotation.x = -Math.PI / 2;
    this.checkMesh.position.y = 0.014;
    this.checkMesh.visible = false;
    this.checkMesh.renderOrder = 2;
    this.root.add(this.checkMesh);

    this.hoverMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.99, 0.99),
      this.materials.highlight.clone(),
    );
    this.hoverMesh.rotation.x = -Math.PI / 2;
    this.hoverMesh.position.y = 0.012;
    this.hoverMesh.visible = false;
    this.hoverMesh.renderOrder = 1;
    this.root.add(this.hoverMesh);
  }

  localPosition(square, y = 0) {
    const file = square.charCodeAt(0) - 97;
    const rank = Number(square[1]) - 1;
    return new THREE.Vector3(file - 3.5, y, 3.5 - rank);
  }

  squareToWorld(square, target = new THREE.Vector3()) {
    const local = this.localPosition(square);
    return this.root.localToWorld(local, target);
  }

  squareFromLocal(point) {
    if (point.x < -BOARD_HALF || point.x >= BOARD_HALF) return null;
    if (point.z < -BOARD_HALF || point.z >= BOARD_HALF) return null;
    const file = Math.floor(point.x + 4);
    const rank = Math.floor(4 - point.z);
    if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
    return `${FILES[file]}${RANKS[rank]}`;
  }

  showSelection(square, moves = []) {
    this.clearLegalMoves();
    if (!square) {
      this.selectedMesh.visible = false;
      return;
    }
    const position = this.localPosition(square, 0.018);
    this.selectedMesh.position.copy(position);
    this.selectedMesh.visible = true;

    for (const move of moves) {
      const target = this.localPosition(move.to, 0.019);
      const isCapture = Boolean(move.captured) || move.flags?.includes('e');
      const object = new THREE.Mesh(
        isCapture ? this.ringGeometry : this.dotGeometry,
        isCapture ? this.materials.legalCapture : this.materials.legalMove,
      );
      object.rotation.x = -Math.PI / 2;
      if (isCapture) object.position.copy(target);
      else object.position.copy(target);
      object.renderOrder = 4;
      this.legalRoot.add(object);
    }
  }

  clearLegalMoves() {
    while (this.legalRoot.children.length) {
      this.legalRoot.remove(this.legalRoot.children[0]);
    }
  }

  setLastMove(move, visible = true) {
    if (!move || !visible) {
      for (const mesh of this.lastMoveMeshes) mesh.visible = false;
      return;
    }
    const from = this.localPosition(move.from, 0.011);
    const to = this.localPosition(move.to, 0.011);
    this.lastMoveMeshes[0].position.copy(from);
    this.lastMoveMeshes[0].visible = true;
    this.lastMoveMeshes[1].position.copy(to);
    this.lastMoveMeshes[1].visible = true;
  }

  setCheck(square) {
    if (!square) {
      this.checkMesh.visible = false;
      return;
    }
    const position = this.localPosition(square, 0.014);
    this.checkMesh.position.copy(position);
    this.checkMesh.visible = true;
  }

  pulseCheck(time) {
    if (!this.checkMesh.visible) return;
    const opacity = 0.24 + Math.sin(time * 0.004) * 0.13;
    this.checkMesh.material.opacity = opacity;
  }

  setHover(square) {
    if (!square) {
      this.hoverMesh.visible = false;
      return;
    }
    const position = this.localPosition(square, 0.012);
    this.hoverMesh.position.copy(position);
    this.hoverMesh.visible = true;
  }

  setCoordinatesVisible(visible) {
    this.coordinateRoot.visible = visible;
  }

  getSquareMeshes() {
    return this.squareMeshes;
  }
}
