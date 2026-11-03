import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CAMERA_PRESETS } from '../core/constants.js';
import { easeInOutCubic } from './Animations.js';

export class CameraController {
  constructor(camera, domElement, animations) {
    this.camera = camera;
    this.domElement = domElement;
    this.animations = animations;
    this.orientation = 'w';
    this.preset = 'standard';
    this.onUserInteract = null;

    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.rotateSpeed = 0.55;
    this.controls.panSpeed = 0.65;
    this.controls.zoomSpeed = 0.75;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 46;
    this.controls.minPolarAngle = 0.02;
    this.controls.maxPolarAngle = 1.47;
    this.controls.screenSpacePanning = false;
    this.controls.target.set(0, -0.15, 0);
    this.controls.touches.ONE = THREE.TOUCH.ROTATE;
    this.controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    this.controls.addEventListener('start', () => {
      if (!this.tweening && this.preset !== 'free') {
        this.preset = 'free';
        this.onUserInteract?.('free');
      }
    });

    this.applyPreset('standard', { instant: true });
  }

  setOrientation(orientation) {
    this.orientation = orientation;
  }

  fitDistance(position, target, fov, margin = 5.65) {
    const aspect = Math.max(0.25, this.camera.aspect);
    const vFov = THREE.MathUtils.degToRad(fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const neededHorizontal = margin / Math.tan(hFov / 2);
    const neededVertical = margin / Math.tan(vFov / 2);
    const needed = Math.max(neededHorizontal, neededVertical) * 1.03;
    const offset = position.clone().sub(target);
    const length = offset.length();
    if (length < needed) {
      offset.setLength(needed);
      return { position: target.clone().add(offset), distance: needed };
    }
    return { position, distance: length };
  }

  applyPreset(name, { instant = false } = {}) {
    const preset = CAMERA_PRESETS[name];
    if (!preset) return;
    this.preset = name;

    const target = new THREE.Vector3(...preset.target);
    const position = new THREE.Vector3(...preset.position);

    if (name === 'white') {
      position.z = this.orientation === 'w' ? Math.abs(position.z) : -Math.abs(position.z);
      position.x = 0;
    } else if (name === 'black') {
      position.z = this.orientation === 'w' ? -Math.abs(position.z) : Math.abs(position.z);
      position.x = 0;
    }

    const fitted = this.fitDistance(position, target, preset.fov);
    const endPosition = fitted.position;
    const endTarget = target;
    const endFov = preset.fov;

    const finish = () => {
      this.tweening = false;
      this.controls.enabled = true;
      this.controls.update();
    };

    this.animations.cancelTag('camera');

    if (instant) {
      this.camera.position.copy(endPosition);
      this.controls.target.copy(endTarget);
      this.camera.fov = endFov;
      this.camera.updateProjectionMatrix();
      this.controls.enabled = true;
      finish();
      return;
    }

    this.tweening = true;
    this.controls.enabled = false;
    const startPosition = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const startFov = this.camera.fov;

    this.animations.add({
      tag: 'camera',
      duration: 720,
      ease: easeInOutCubic,
      onUpdate: (_raw, eased) => {
        this.camera.position.lerpVectors(startPosition, endPosition, eased);
        this.controls.target.lerpVectors(startTarget, endTarget, eased);
        this.camera.fov = startFov + (endFov - startFov) * eased;
        this.camera.updateProjectionMatrix();
      },
      onComplete: finish,
    });
  }

  rotate(angle) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    this.camera.position.copy(this.controls.target).add(offset);
    this.preset = 'free';
    this.onUserInteract?.('free');
    this.controls.update();
  }

  zoom(factor) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const distance = THREE.MathUtils.clamp(
      offset.length() * factor,
      this.controls.minDistance,
      this.controls.maxDistance,
    );
    offset.setLength(distance);
    this.camera.position.copy(this.controls.target).add(offset);
    this.preset = 'free';
    this.onUserInteract?.('free');
    this.controls.update();
  }

  focusOn(worldPosition) {
    const target = worldPosition.clone();
    target.y = 0.05;
    const offset = this.camera.position.clone().sub(this.controls.target);
    const distance = THREE.MathUtils.clamp(offset.length() * 0.68, 7.2, 14);
    offset.setLength(distance);
    const endPosition = target.clone().add(offset);
    this.preset = 'free';

    this.animations.cancelTag('camera');
    const startPosition = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    this.tweening = true;
    this.controls.enabled = false;
    this.animations.add({
      tag: 'camera',
      duration: 620,
      ease: easeInOutCubic,
      onUpdate: (_raw, eased) => {
        this.camera.position.lerpVectors(startPosition, endPosition, eased);
        this.controls.target.lerpVectors(startTarget, target, eased);
      },
      onComplete: () => {
        this.tweening = false;
        this.controls.enabled = true;
        this.controls.update();
      },
    });
  }

  fitCurrent() {
    if (this.preset !== 'free') return;
    const fitted = this.fitDistance(
      this.camera.position.clone(),
      this.controls.target.clone(),
      this.camera.fov,
    );
    this.camera.position.copy(fitted.position);
  }

  update() {
    if (this.controls.enabled) this.controls.update();
  }
}
