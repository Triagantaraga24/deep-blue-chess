import * as THREE from 'three';

function createWoodTexture(base, grain, highlight, size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 46; i += 1) {
    const y = Math.random() * size;
    const amplitude = 2 + Math.random() * 5;
    const frequency = 0.008 + Math.random() * 0.02;
    ctx.beginPath();
    ctx.strokeStyle = Math.random() > 0.42 ? grain : highlight;
    ctx.globalAlpha = 0.05 + Math.random() * 0.13;
    ctx.lineWidth = 0.6 + Math.random() * 1.8;
    for (let x = 0; x <= size; x += 4) {
      const offset = Math.sin(x * frequency + i) * amplitude;
      if (x === 0) ctx.moveTo(x, y + offset);
      else ctx.lineTo(x, y + offset);
    }
    ctx.stroke();
  }

  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 220; i += 1) {
    ctx.fillStyle = Math.random() > 0.5 ? grain : highlight;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1.5);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

export function createMaterials(renderer) {
  const maxAnisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 4;

  const lightTexture = createWoodTexture('#e6d5b8', '#b69f7e', '#f7ecd9');
  const darkTexture = createWoodTexture('#80664d', '#584433', '#a5886a');
  lightTexture.anisotropy = maxAnisotropy;
  darkTexture.anisotropy = maxAnisotropy;

  const lightSquareBase = new THREE.MeshStandardMaterial({
    color: 0xf0e3cb,
    map: lightTexture,
    roughness: 0.52,
    metalness: 0.04,
    envMapIntensity: 0.55,
  });

  const darkSquareBase = new THREE.MeshStandardMaterial({
    color: 0x94765a,
    map: darkTexture,
    roughness: 0.58,
    metalness: 0.05,
    envMapIntensity: 0.5,
  });

  const frameTexture = createWoodTexture('#39281d', '#20140d', '#5a4230');
  frameTexture.anisotropy = maxAnisotropy;

  const frame = new THREE.MeshPhysicalMaterial({
    color: 0x4a3324,
    map: frameTexture,
    roughness: 0.46,
    metalness: 0.08,
    clearcoat: 0.35,
    clearcoatRoughness: 0.45,
    envMapIntensity: 0.7,
  });

  const gold = new THREE.MeshStandardMaterial({
    color: 0xc9a15c,
    roughness: 0.26,
    metalness: 0.92,
    envMapIntensity: 1.15,
  });

  const goldDark = new THREE.MeshStandardMaterial({
    color: 0x7d5c2e,
    roughness: 0.34,
    metalness: 0.85,
    envMapIntensity: 0.9,
  });

  const whitePiece = new THREE.MeshPhysicalMaterial({
    color: 0xf0e6d2,
    roughness: 0.3,
    metalness: 0.03,
    clearcoat: 0.62,
    clearcoatRoughness: 0.2,
    sheen: 0.25,
    sheenColor: new THREE.Color(0xfff4dc),
    envMapIntensity: 0.85,
  });

  const blackPiece = new THREE.MeshPhysicalMaterial({
    color: 0x1b1e24,
    roughness: 0.24,
    metalness: 0.34,
    clearcoat: 0.75,
    clearcoatRoughness: 0.16,
    envMapIntensity: 1,
  });

  const accent = new THREE.MeshStandardMaterial({
    color: 0x6b5636,
    roughness: 0.3,
    metalness: 0.55,
  });

  const highlight = new THREE.MeshBasicMaterial({
    color: 0xe7c98c,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const selected = new THREE.MeshBasicMaterial({
    color: 0xe7c98c,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const legalMove = new THREE.MeshBasicMaterial({
    color: 0xd5aa62,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const legalCapture = new THREE.MeshBasicMaterial({
    color: 0xd98f62,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const check = new THREE.MeshBasicMaterial({
    color: 0xe2564d,
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const lastMove = new THREE.MeshBasicMaterial({
    color: 0xd5aa62,
    transparent: true,
    opacity: 0.13,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  return {
    lightSquareBase,
    darkSquareBase,
    frame,
    gold,
    goldDark,
    whitePiece,
    blackPiece,
    accent,
    highlight,
    selected,
    legalMove,
    legalCapture,
    check,
    lastMove,
    lightTexture,
    darkTexture,
  };
}

export function createTextSprite(text, color = '#d5aa62', size = 0.36) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  ctx.font = '600 64px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 6;
  ctx.fillText(text, 64, 66);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    opacity: 0.85,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(size, size, size);
  return sprite;
}
