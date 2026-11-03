import * as THREE from 'three';

function lathePoints(points) {
  return points.map(([x, y]) => new THREE.Vector2(x, y));
}

function makeLathe(points, segments = 44) {
  return new THREE.LatheGeometry(lathePoints(points), segments);
}

function buildKnightHeadGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.16, 0.18);
  shape.bezierCurveTo(-0.3, 0.24, -0.27, 0.45, -0.15, 0.53);
  shape.bezierCurveTo(-0.09, 0.58, -0.06, 0.66, -0.02, 0.7);
  shape.lineTo(0.03, 0.83);
  shape.lineTo(0.09, 0.68);
  shape.bezierCurveTo(0.17, 0.66, 0.23, 0.6, 0.34, 0.56);
  shape.lineTo(0.39, 0.49);
  shape.lineTo(0.45, 0.45);
  shape.lineTo(0.39, 0.4);
  shape.lineTo(0.26, 0.39);
  shape.bezierCurveTo(0.19, 0.38, 0.16, 0.33, 0.15, 0.26);
  shape.bezierCurveTo(0.14, 0.21, 0.02, 0.17, -0.16, 0.18);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.21,
    bevelEnabled: true,
    bevelThickness: 0.028,
    bevelSize: 0.025,
    bevelSegments: 4,
    curveSegments: 16,
  });
  geometry.translate(0, 0, -0.105);
  geometry.computeVertexNormals();
  return geometry;
}

const GEOMETRY_CACHE = new Map();

function getGeometry(type) {
  if (GEOMETRY_CACHE.has(type)) return GEOMETRY_CACHE.get(type);

  let geometry;
  switch (type) {
    case 'p':
      geometry = {
        body: makeLathe([
          [0, 0],
          [0.32, 0],
          [0.32, 0.05],
          [0.275, 0.075],
          [0.275, 0.115],
          [0.18, 0.155],
          [0.145, 0.215],
          [0.125, 0.3],
          [0.11, 0.36],
          [0.15, 0.39],
          [0.19, 0.42],
          [0.17, 0.445],
          [0.11, 0.455],
          [0.105, 0.49],
          [0.135, 0.52],
          [0.155, 0.55],
          [0.13, 0.575],
          [0, 0.585],
        ]),
        head: new THREE.SphereGeometry(0.145, 22, 18),
      };
      break;
    case 'r':
      geometry = {
        body: makeLathe([
          [0, 0],
          [0.36, 0],
          [0.36, 0.055],
          [0.305, 0.085],
          [0.305, 0.13],
          [0.21, 0.17],
          [0.19, 0.25],
          [0.18, 0.42],
          [0.205, 0.47],
          [0.265, 0.51],
          [0.3, 0.55],
          [0.3, 0.62],
          [0.27, 0.665],
          [0.255, 0.69],
          [0, 0.695],
        ]),
        crown: new THREE.BoxGeometry(0.14, 0.125, 0.12),
      };
      break;
    case 'n':
      geometry = {
        base: makeLathe([
          [0, 0],
          [0.36, 0],
          [0.36, 0.055],
          [0.305, 0.085],
          [0.305, 0.13],
          [0.21, 0.17],
          [0.19, 0.23],
          [0.155, 0.28],
          [0, 0.285],
        ]),
        head: buildKnightHeadGeometry(),
      };
      break;
    case 'b':
      geometry = {
        body: makeLathe([
          [0, 0],
          [0.35, 0],
          [0.35, 0.055],
          [0.3, 0.085],
          [0.3, 0.13],
          [0.2, 0.17],
          [0.155, 0.25],
          [0.13, 0.36],
          [0.12, 0.44],
          [0.16, 0.47],
          [0.225, 0.5],
          [0.2, 0.525],
          [0.13, 0.535],
          [0.11, 0.575],
          [0.15, 0.62],
          [0.175, 0.66],
          [0.16, 0.7],
          [0, 0.705],
        ]),
        head: new THREE.SphereGeometry(0.135, 24, 20),
        tip: new THREE.ConeGeometry(0.042, 0.1, 18),
        slit: new THREE.BoxGeometry(0.19, 0.026, 0.032),
      };
      break;
    case 'q':
      geometry = {
        body: makeLathe([
          [0, 0],
          [0.37, 0],
          [0.37, 0.055],
          [0.32, 0.09],
          [0.32, 0.135],
          [0.22, 0.175],
          [0.17, 0.25],
          [0.14, 0.36],
          [0.12, 0.46],
          [0.16, 0.5],
          [0.23, 0.54],
          [0.2, 0.57],
          [0.13, 0.58],
          [0.12, 0.62],
          [0.15, 0.66],
          [0.18, 0.7],
          [0.17, 0.72],
          [0, 0.725],
        ]),
        ring: new THREE.TorusGeometry(0.19, 0.026, 10, 32),
        orb: new THREE.SphereGeometry(0.045, 14, 12),
        finial: new THREE.SphereGeometry(0.058, 16, 14),
      };
      break;
    case 'k':
      geometry = {
        body: makeLathe([
          [0, 0],
          [0.375, 0],
          [0.375, 0.055],
          [0.325, 0.09],
          [0.325, 0.135],
          [0.225, 0.175],
          [0.175, 0.25],
          [0.145, 0.37],
          [0.125, 0.48],
          [0.165, 0.52],
          [0.235, 0.56],
          [0.205, 0.59],
          [0.135, 0.6],
          [0.125, 0.65],
          [0.155, 0.69],
          [0.185, 0.73],
          [0.17, 0.76],
          [0, 0.765],
        ]),
        ring: new THREE.TorusGeometry(0.185, 0.028, 10, 32),
        crossV: new THREE.BoxGeometry(0.06, 0.23, 0.06),
        crossH: new THREE.BoxGeometry(0.18, 0.06, 0.06),
      };
      break;
    default:
      geometry = { body: new THREE.SphereGeometry(0.2, 16, 12) };
  }

  GEOMETRY_CACHE.set(type, geometry);
  return geometry;
}

function mesh(geometry, material) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function createPiece(type, color, materials) {
  const geometry = getGeometry(type);
  const pieceMaterial = color === 'w' ? materials.whitePiece : materials.blackPiece;
  const group = new THREE.Group();
  group.userData.type = type;
  group.userData.color = color;

  if (type === 'p') {
    const body = mesh(geometry.body, pieceMaterial);
    group.add(body);
    const head = mesh(geometry.head, pieceMaterial);
    head.position.y = 0.625;
    head.scale.set(1, 1.16, 1);
    group.add(head);
  } else if (type === 'r') {
    group.add(mesh(geometry.body, pieceMaterial));
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2;
      const crown = mesh(geometry.crown, pieceMaterial);
      crown.position.set(Math.cos(angle) * 0.23, 0.735, Math.sin(angle) * 0.23);
      crown.rotation.y = -angle;
      group.add(crown);
    }
    const ring = mesh(new THREE.TorusGeometry(0.245, 0.02, 8, 28), materials.goldDark);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.675;
    group.add(ring);
  } else if (type === 'n') {
    group.add(mesh(geometry.base, pieceMaterial));
    const head = mesh(geometry.head, pieceMaterial);
    head.rotation.y = color === 'w' ? Math.PI / 2 : -Math.PI / 2;
    group.add(head);
    const mane = mesh(new THREE.BoxGeometry(0.045, 0.28, 0.11), pieceMaterial);
    mane.position.set(0, 0.53, color === 'w' ? 0.11 : -0.11);
    mane.rotation.x = 0.25;
    group.add(mane);
  } else if (type === 'b') {
    group.add(mesh(geometry.body, pieceMaterial));
    const head = mesh(geometry.head, pieceMaterial);
    head.position.y = 0.775;
    head.scale.set(1.05, 1.28, 1.05);
    group.add(head);
    const tip = mesh(geometry.tip, pieceMaterial);
    tip.position.y = 0.925;
    group.add(tip);
    const slitFront = mesh(geometry.slit, materials.goldDark);
    slitFront.position.set(0, 0.8, 0.118);
    slitFront.rotation.z = 0.55;
    group.add(slitFront);
    const slitBack = mesh(geometry.slit, materials.goldDark);
    slitBack.position.set(0, 0.8, -0.118);
    slitBack.rotation.z = -0.55;
    group.add(slitBack);
  } else if (type === 'q') {
    group.add(mesh(geometry.body, pieceMaterial));
    const ring = mesh(geometry.ring, materials.goldDark);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.735;
    group.add(ring);
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      const orb = mesh(geometry.orb, pieceMaterial);
      orb.position.set(Math.cos(angle) * 0.2, 0.78, Math.sin(angle) * 0.2);
      group.add(orb);
    }
    const finial = mesh(geometry.finial, pieceMaterial);
    finial.position.y = 0.84;
    group.add(finial);
  } else if (type === 'k') {
    group.add(mesh(geometry.body, pieceMaterial));
    const ring = mesh(geometry.ring, materials.goldDark);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.78;
    group.add(ring);
    const crossV = mesh(geometry.crossV, pieceMaterial);
    crossV.position.y = 0.885;
    group.add(crossV);
    const crossH = mesh(geometry.crossH, pieceMaterial);
    crossH.position.y = 0.92;
    group.add(crossH);
  }

  group.traverse((child) => {
    if (child.isMesh) {
      child.userData.pieceRoot = group;
    }
  });

  return group;
}

export function disposePieceGeometries() {
  for (const group of GEOMETRY_CACHE.values()) {
    for (const geometry of Object.values(group)) {
      geometry.dispose?.();
    }
  }
  GEOMETRY_CACHE.clear();
}
