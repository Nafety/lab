import * as THREE from 'three';
import { ROOM, SECRET_DOOR, type Collider } from './room';
import { canvasTexture } from './textures';

/**
 * Derrière la vitrine du mur est : un grand escalier sombre qui descend vers la salle au trésor.
 * Une torche brûle au fond, au-dessus du grimoire des maîtres.
 */

type Model = (id: string, x: number, y: number, z: number, rotY?: number, scale?: number, collide?: boolean) => Promise<THREE.Object3D>;

const HW = ROOM.w / 2;
const STEPS = 12;
const RISE = 0.2;
const RUN = 0.32;
const X0 = HW + 0.4; // palier, puis première marche
const X1 = X0 + STEPS * RUN; // pied de l'escalier = entrée de la salle
const F = -STEPS * RISE; // sol de la salle au trésor
const C = F + 3.2; // son plafond
const ROOM_X2 = X1 + 4;
const ROOM_Z1 = 0.3;
const ROOM_Z2 = 3.94;

function stoneTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#4e473f';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) {
      const v = 50 + Math.random() * 60;
      g.fillStyle = `rgba(${v},${v - 6},${v - 14},0.3)`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    g.strokeStyle = 'rgba(20,16,12,0.65)';
    g.lineWidth = 3;
    for (let y = 0; y < h; y += 64) {
      g.strokeRect(-2, y, w + 4, 64);
      for (let x = (y / 64) % 2 ? 0 : 64; x < w; x += 128) {
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x, y + 64);
        g.stroke();
      }
    }
  }, [2, 2]);
}

/** Pages manuscrites du grimoire : lignes d'écriture et une enluminure. */
function pageTexture(right: boolean) {
  return canvasTexture(256, 360, (g, w, h) => {
    g.fillStyle = '#efdcae';
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(60,30,10,0.75)';
    for (let y = 40; y < h - 30; y += 16) {
      if (!right && y < 130) continue;
      let x = 24;
      while (x < w - 30) {
        const len = 8 + Math.random() * 26;
        g.fillRect(x, y, Math.min(len, w - 24 - x), 2.4);
        x += len + 6;
      }
    }
    if (!right) {
      g.strokeStyle = '#8e1b14';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(w / 2, 80, 42, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = '#b8862a';
      g.font = '56px "Segoe UI Symbol", "DejaVu Sans", serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('☉', w / 2, 82);
    }
  });
}

export async function buildSecretRoom(scene: THREE.Scene, colliders: Collider[], model: Model) {
  const { z1, z2, h } = SECRET_DOOR;
  const zc = (z1 + z2) / 2;
  const stone = new THREE.MeshStandardMaterial({ map: stoneTexture(), roughness: 0.95, side: THREE.DoubleSide, envMapIntensity: 0.12 }); // souterrain : presque pas de lumière ambiante
  const g = new THREE.Group();
  scene.add(g);

  const plane = (w: number, hh: number, x: number, y: number, z: number, rotY: number, rotX = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), stone);
    m.position.set(x, y, z);
    m.rotation.set(rotX, rotY, 0, 'YXZ');
    m.receiveShadow = true;
    g.add(m);
  };
  const block = (x1: number, x2: number, top: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x2 - x1, top - F + 0.1, z2 - z1), stone);
    m.position.set((x1 + x2) / 2, (top + F - 0.1) / 2, zc);
    m.receiveShadow = true;
    g.add(m);
    colliders.push({ minX: x1, maxX: x2, minZ: z1, maxZ: z2, top });
  };

  // ---------- L'escalier ----------
  block(HW, X0, 0);
  for (let i = 0; i < STEPS; i++) block(X0 + i * RUN, X0 + (i + 1) * RUN, -(i + 1) * RISE);
  // murs latéraux et plafond en pente (assez haut pour voir la torche depuis le haut des marches)
  const ceilBottom = 0.5;
  plane(X1 - HW, h - F, (HW + X1) / 2, (h + F) / 2, z1, 0);
  plane(X1 - HW, h - F, (HW + X1) / 2, (h + F) / 2, z2, 0);
  plane(X0 - HW, z2 - z1, (HW + X0) / 2, h, zc, 0, Math.PI / 2);
  const slope = Math.atan2(h - ceilBottom, X1 - X0);
  plane(Math.hypot(X1 - X0, h - ceilBottom), z2 - z1, (X0 + X1) / 2, (h + ceilBottom) / 2, zc, 0, Math.PI / 2);
  g.children[g.children.length - 1].rotation.set(Math.PI / 2, 0, -slope, 'ZYX');
  // plafonds : passage et palier, puis chaque marche (sous la pente, côté bas de la marche)
  colliders.push({ minX: HW - 0.05, maxX: X0, minZ: z1, maxZ: z2, top: -Infinity, ceil: h });
  for (let i = 0; i < STEPS; i++) {
    const xEnd = X0 + (i + 1) * RUN;
    colliders.push({ minX: X0 + i * RUN, maxX: xEnd, minZ: z1, maxZ: z2, top: -Infinity, ceil: h - ((h - ceilBottom) * (xEnd - X0)) / (X1 - X0) });
  }
  colliders.push(
    { minX: HW, maxX: X1, minZ: z1 - 0.3, maxZ: z1, top: Infinity },
    { minX: HW, maxX: X1, minZ: z2, maxZ: z2 + 0.3, top: Infinity },
  );

  // ---------- La salle au trésor ----------
  const rw = ROOM_X2 - X1;
  const rd = ROOM_Z2 - ROOM_Z1;
  const rz = (ROOM_Z1 + ROOM_Z2) / 2;
  plane(rw, rd, X1 + rw / 2, F + 0.001, rz, 0, -Math.PI / 2);
  (g.children[g.children.length - 1] as THREE.Mesh).material = new THREE.MeshStandardMaterial({ map: flagstoneTexture(), roughness: 0.85, envMapIntensity: 0.12 });
  plane(rw, rd, X1 + rw / 2, C, rz, 0, Math.PI / 2);
  plane(rw, C - F, X1 + rw / 2, (C + F) / 2, ROOM_Z1, 0);
  plane(rw, C - F, X1 + rw / 2, (C + F) / 2, ROOM_Z2, 0);
  plane(rd, C - F, ROOM_X2, (C + F) / 2, rz, Math.PI / 2);
  // mur d'entrée, percé à la largeur de l'escalier
  plane(z1 - ROOM_Z1, C - F, X1, (C + F) / 2, (ROOM_Z1 + z1) / 2, Math.PI / 2);
  plane(ROOM_Z2 - z2, C - F, X1, (C + F) / 2, (z2 + ROOM_Z2) / 2, Math.PI / 2);
  plane(z2 - z1, C - ceilBottom, X1, (C + ceilBottom) / 2, zc, Math.PI / 2);
  const t = 0.3;
  colliders.push(
    { minX: X1, maxX: ROOM_X2, minZ: ROOM_Z1, maxZ: ROOM_Z2, top: F },
    { minX: X1, maxX: ROOM_X2, minZ: ROOM_Z1, maxZ: ROOM_Z2, top: -Infinity, ceil: C - 0.24 }, // sous les poutres
    { minX: X1 - t, maxX: X1, minZ: ROOM_Z1 - t, maxZ: z1, top: Infinity },
    { minX: X1 - t, maxX: X1, minZ: z2, maxZ: ROOM_Z2 + t, top: Infinity },
    { minX: X1, maxX: ROOM_X2 + t, minZ: ROOM_Z1 - t, maxZ: ROOM_Z1, top: Infinity },
    { minX: X1, maxX: ROOM_X2 + t, minZ: ROOM_Z2, maxZ: ROOM_Z2 + t, top: Infinity },
    { minX: ROOM_X2, maxX: ROOM_X2 + t, minZ: ROOM_Z1 - t, maxZ: ROOM_Z2 + t, top: Infinity },
  );

  const gold = new THREE.MeshStandardMaterial({ color: 0xe0b040, metalness: 1, roughness: 0.25, emissive: 0x3a2400, emissiveIntensity: 0.6 });

  // Monceaux de pièces d'or
  const piles: [number, number, number][] = [[X1 + 0.6, ROOM_Z1 + 0.5, 0.45], [X1 + 0.5, ROOM_Z2 - 0.55, 0.4], [ROOM_X2 - 0.6, ROOM_Z1 + 0.5, 0.5], [ROOM_X2 - 0.6, ROOM_Z2 - 0.5, 0.45], [X1 + 2.3, ROOM_Z2 - 0.45, 0.35]];
  const perPile = 220;
  const coins = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.02, 0.02, 0.004, 12), gold, piles.length * perPile);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  let k = 0;
  for (const [px, pz, pr] of piles) {
    for (let i = 0; i < perPile; i++) {
      const r = Math.sqrt(Math.random()) * pr;
      const a = Math.random() * Math.PI * 2;
      const y = F + 0.002 + (pr - r) * 0.7 * Math.random();
      q.setFromEuler(new THREE.Euler((Math.random() - 0.5) * 0.9, 0, (Math.random() - 0.5) * 0.9));
      coins.setMatrixAt(k++, m.compose(new THREE.Vector3(px + Math.cos(a) * r, y, pz + Math.sin(a) * r), q, one));
    }
    colliders.push({ minX: px - pr * 0.6, maxX: px + pr * 0.6, minZ: pz - pr * 0.6, maxZ: pz + pr * 0.6, top: F + pr * 0.35 });
  }
  g.add(coins);

  // Lingots empilés
  const bar = new THREE.BoxGeometry(0.2, 0.05, 0.09);
  for (let layer = 0; layer < 3; layer++) {
    for (let i = 0; i < 3 - layer; i++) {
      const b = new THREE.Mesh(bar, gold);
      b.position.set(X1 + 1.4 + (i - (2 - layer) / 2) * 0.21, F + 0.025 + layer * 0.05, ROOM_Z1 + 0.25);
      g.add(b);
    }
  }

  // Grappes de cristaux lumineux
  for (const [x, z, color] of [[X1 + 0.3, zc - 0.95, 0x7ad8ff], [ROOM_X2 - 0.3, ROOM_Z1 + 1.2, 0xb88aff], [ROOM_X2 - 0.35, ROOM_Z2 - 1.1, 0x8affc8]] as const) {
    for (let n = 0; n < 6; n++) {
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.05 + Math.random() * 0.06), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.5, roughness: 0.1 }));
      c.scale.y = 2.2;
      c.position.set(x + (Math.random() - 0.5) * 0.25, F + 0.09, z + (Math.random() - 0.5) * 0.25);
      c.rotation.set((Math.random() - 0.5) * 0.7, Math.random() * 3, (Math.random() - 0.5) * 0.7);
      g.add(c);
    }
  }

  // Coffres, commode et vases
  await model('treasure_chest', X1 + 1.3, F, ROOM_Z2 - 0.4, Math.PI, 1, true);
  openLid(await model('treasure_chest', X1 + 2.45, F, ROOM_Z1 + 0.5, 0, 0.9, true));
  await model('antique_ceramic_vase_01', ROOM_X2 - 1.3, F, ROOM_Z2 - 0.35, 0, 1, true);

  // Sphère armillaire dorée sur un socle de pierre (hors de l'axe de l'escalier, pour voir la torche)
  const sx = X1 + 2.2;
  const sz = ROOM_Z2 - 1.15;
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.9, 20), stone);
  pedestal.position.set(sx, F + 0.45, sz);
  g.add(pedestal);
  colliders.push({ minX: sx - 0.25, maxX: sx + 0.25, minZ: sz - 0.25, maxZ: sz + 0.25, top: F + 0.9 });
  const sphere = new THREE.Group();
  sphere.position.set(sx, F + 1.3, sz);
  g.add(sphere);
  const rings = [0, 1, 2].map((i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22 - i * 0.03, 0.008, 8, 64), gold);
    ring.rotation.x = (i * Math.PI) / 3;
    sphere.add(ring);
    return ring;
  });
  sphere.add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 16), new THREE.MeshStandardMaterial({ color: 0xffd060, emissive: 0xffa020, emissiveIntensity: 2 })));

  // Pupitre et grimoire ouvert, tourné vers celui qui descend l'escalier (vers -x)
  const wood = new THREE.MeshStandardMaterial({ color: 0x4a2e1a, roughness: 0.7 });
  const lx = ROOM_X2 - 0.75;
  const lectern = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.95, 0.5), wood);
  lectern.position.set(lx, F + 0.475, zc);
  g.add(lectern);
  const tilt = 0.4; // le bord du fond est relevé, comme un pupitre
  const deskTop = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.03, 0.46), wood);
  deskTop.position.set(lx, F + 1.0, zc);
  deskTop.rotation.set(tilt, -Math.PI / 2, 0, 'YXZ');
  g.add(deskTop);
  colliders.push({ minX: lx - 0.3, maxX: lx + 0.3, minZ: zc - 0.32, maxZ: zc + 0.32, top: F + 1.05 });

  // Construit pour un lecteur placé en +z local, puis tourné face à -x
  const grimoire = new THREE.Group();
  grimoire.position.set(lx, F + 1.03, zc);
  grimoire.rotation.set(tilt, -Math.PI / 2, 0, 'YXZ');
  g.add(grimoire);
  const cover = new THREE.MeshStandardMaterial({ color: 0x3a0e2a, roughness: 0.6 });
  for (const s of [-1, 1]) {
    const half = new THREE.Group();
    half.rotation.z = s * -0.1;
    half.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.012, 0.3), cover).translateX(s * 0.11));
    const pages = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.025, 0.28), new THREE.MeshStandardMaterial({ color: 0xf2e2b8, roughness: 0.9 }));
    half.add(pages.translateX(s * 0.105).translateY(0.018));
    const ink = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.27), new THREE.MeshStandardMaterial({ map: pageTexture(s > 0), emissive: 0x806020, emissiveIntensity: 0.25, emissiveMap: null, roughness: 0.9 }));
    ink.rotation.x = -Math.PI / 2;
    ink.position.set(s * 0.105, 0.0315, 0);
    half.add(ink);
    grimoire.add(half);
  }

  // La torche du fond, au-dessus du grimoire : on l'aperçoit dès le haut de l'escalier ; deux autres sur les piliers
  const iron = new THREE.MeshStandardMaterial({ color: 0x2a2622, metalness: 0.8, roughness: 0.5 });
  const torches = [
    { pos: new THREE.Vector3(ROOM_X2 - 0.06, F + 1.75, zc), tilt: new THREE.Euler(0, 0, 0.35), light: new THREE.Vector3(ROOM_X2 - 0.35, F + 2.15, zc), power: 9 },
    { pos: new THREE.Vector3(X1 + rw / 2, F + 1.7, ROOM_Z1 + 0.33), tilt: new THREE.Euler(0.35, 0, 0), light: new THREE.Vector3(X1 + rw / 2, F + 2.1, ROOM_Z1 + 0.6), power: 3.5 },
    { pos: new THREE.Vector3(X1 + rw / 2, F + 1.7, ROOM_Z2 - 0.33), tilt: new THREE.Euler(-0.35, 0, 0), light: new THREE.Vector3(X1 + rw / 2, F + 2.1, ROOM_Z2 - 0.6), power: 3.5 },
  ].map((t) => {
    const { torch, flame } = makeTorch(wood, iron);
    torch.position.copy(t.pos);
    torch.rotation.copy(t.tilt);
    g.add(torch);
    const light = new THREE.PointLight(0xff8a30, t.power, t.power > 5 ? 10 : 5, 1.6);
    light.position.copy(t.light);
    g.add(light);
    return { flame, light, power: t.power };
  });
  const bracket = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 16), iron);
  bracket.position.set(ROOM_X2 - 0.04, F + 1.72, zc);
  bracket.rotation.x = Math.PI / 2;
  g.add(bracket);

  // ---------- Décor de la salle au trésor ----------
  const gem = (color: number) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, roughness: 0.1 });
  const darkStone = new THREE.MeshStandardMaterial({ map: stoneTexture(), color: 0xb8a890, roughness: 0.9, envMapIntensity: 0.12 });

  // Piliers aux coins et au milieu des longs murs
  for (const [px, pz] of [[X1 + 0.18, ROOM_Z1 + 0.18], [X1 + 0.18, ROOM_Z2 - 0.18], [ROOM_X2 - 0.18, ROOM_Z1 + 0.18], [ROOM_X2 - 0.18, ROOM_Z2 - 0.18], [X1 + rw / 2, ROOM_Z1 + 0.16], [X1 + rw / 2, ROOM_Z2 - 0.16]]) {
    const p = new THREE.Group();
    p.add(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.36), darkStone).translateY(0.11));
    p.add(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, C - F - 0.5, 16), darkStone).translateY((C - F) / 2));
    p.add(new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.26, 0.38), darkStone).translateY(C - F - 0.13));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.02, 6, 20), gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = C - F - 0.32;
    p.add(ring);
    p.position.set(px, F, pz);
    g.add(p);
    colliders.push({ minX: px - 0.18, maxX: px + 0.18, minZ: pz - 0.18, maxZ: pz + 0.18, top: Infinity });
  }
  // Poutres de chêne sombre au plafond
  const beamWood = new THREE.MeshStandardMaterial({ color: 0x2e1c10, roughness: 0.8 });
  for (const bx of [X1 + 1, X1 + 2, X1 + 3]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, rd), beamWood);
    beam.position.set(bx, C - 0.12, rz);
    g.add(beam);
  }

  // Rosace dorée au sol, sur le chemin du grimoire
  const rose = new THREE.Mesh(new THREE.CircleGeometry(0.75, 48), new THREE.MeshBasicMaterial({ map: roseTexture(), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  rose.rotation.x = -Math.PI / 2;
  rose.position.set(X1 + 1.75, F + 0.004, zc);
  rose.layers.set(1);
  g.add(rose);

  // Tapisseries pourpres au soleil d'or
  const tapMat = new THREE.MeshStandardMaterial({ map: tapestryTexture(), roughness: 0.95, side: THREE.DoubleSide });
  for (const [tx, tz, ry] of [[X1 + 0.95, ROOM_Z1, 0], [X1 + 2.95, ROOM_Z2, Math.PI]] as const) {
    const geo = new THREE.PlaneGeometry(0.8, 1.6, 24, 1);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 22) * 0.012);
    geo.computeVertexNormals();
    const tap = new THREE.Mesh(geo, tapMat);
    tap.position.set(tx, F + 1.95, tz + (ry ? -0.04 : 0.04));
    tap.rotation.y = ry;
    g.add(tap);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.95, 8), gold);
    rod.rotation.z = Math.PI / 2;
    rod.position.set(tx, F + 2.77, tz + (ry ? -0.06 : 0.06));
    g.add(rod);
  }

  // Bouclier et épées croisées sur le mur sud
  const steel = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, metalness: 1, roughness: 0.25 });
  const shield = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 32), new THREE.MeshStandardMaterial({ color: 0x5a1418, roughness: 0.6 }));
  disc.rotation.x = Math.PI / 2;
  shield.add(disc);
  shield.add(new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.02, 8, 32), gold));
  const boss = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 10), gold);
  boss.position.z = 0.02;
  shield.add(boss);
  for (const s of [-1, 1]) {
    const sword = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.85, 0.008), steel);
    blade.position.y = 0.3;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.03), gold);
    guard.position.y = -0.13;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 8), beamWood);
    grip.position.y = -0.23;
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), gold);
    pommel.position.y = -0.32;
    sword.add(blade, guard, grip, pommel);
    sword.rotation.z = s * 0.7;
    sword.position.z = -0.03;
    shield.add(sword);
  }
  shield.position.set(X1 + 1.6, F + 1.75, ROOM_Z2 - 0.06);
  shield.rotation.y = Math.PI;
  g.add(shield);

  // Couronne sur un coussin de velours, posée sur une stèle
  const stele = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 0.4), darkStone);
  stele.position.set(ROOM_X2 - 0.9, F + 0.4, ROOM_Z2 - 0.95);
  g.add(stele);
  colliders.push({ minX: stele.position.x - 0.22, maxX: stele.position.x + 0.22, minZ: stele.position.z - 0.22, maxZ: stele.position.z + 0.22, top: F + 0.8 });
  const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.34), new THREE.MeshStandardMaterial({ color: 0x6a1020, roughness: 0.9 }));
  cushion.position.set(stele.position.x, F + 0.835, stele.position.z);
  g.add(cushion);
  const crown = new THREE.Group();
  crown.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.07, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0xe0b040, metalness: 1, roughness: 0.25, side: THREE.DoubleSide })));
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.07, 6), gold);
    spike.position.set(Math.cos(a) * 0.1, 0.07, Math.sin(a) * 0.1);
    crown.add(spike);
    const j = new THREE.Mesh(new THREE.OctahedronGeometry(0.012), gem([0xd02030, 0x2050d0, 0x20a050][k % 3]));
    j.position.set(Math.cos(a) * 0.102, 0, Math.sin(a) * 0.102);
    crown.add(j);
  }
  crown.position.set(stele.position.x, F + 0.905, stele.position.z);
  g.add(crown);

  // Calices d'or posés çà et là
  const gobletGeo = new THREE.LatheGeometry(
    [[0, 0], [0.04, 0], [0.04, 0.006], [0.008, 0.02], [0.008, 0.07], [0.035, 0.09], [0.045, 0.14], [0.042, 0.14], [0.03, 0.095], [0, 0.09]].map(([x, y]) => new THREE.Vector2(x, y)),
    20,
  );
  for (const [gx, gy, gz, tip] of [[X1 + 0.75, F + 0.08, ROOM_Z1 + 0.35 + 0.4, 0.5], [ROOM_X2 - 0.5, F + 0.12, ROOM_Z2 - 0.55, -0.9], [ROOM_X2 - 1.02, F + 0.87, ROOM_Z2 - 1.05, 0]]) {
    const cup = new THREE.Mesh(gobletGeo, gold);
    cup.position.set(gx, gy, gz);
    cup.rotation.z = tip;
    g.add(cup);
  }
  // Pierres précieuses semées sur les tas d'or
  for (let k = 0; k < 26; k++) {
    const [px, pz, pr] = piles[k % piles.length];
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * pr * 0.7;
    const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.018 + Math.random() * 0.015), gem([0xd02030, 0x2050d0, 0x20a050, 0x9030c0][k % 4]));
    s.position.set(px + Math.cos(a) * r, F + (pr - r) * 0.35 + 0.02, pz + Math.sin(a) * r);
    s.rotation.set(Math.random(), Math.random(), Math.random());
    g.add(s);
  }
  // Paillettes d'or qui scintillent au-dessus du trésor
  const sparkPos: number[] = [];
  for (let k = 0; k < 140; k++) {
    const [px, pz, pr] = piles[k % piles.length];
    sparkPos.push(px + (Math.random() - 0.5) * pr * 2, F + 0.1 + Math.random() * 0.9, pz + (Math.random() - 0.5) * pr * 2);
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.Float32BufferAttribute(sparkPos, 3));
  const sparkMat = new THREE.PointsMaterial({ color: 0xffd880, size: 0.025, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.layers.set(1);
  g.add(sparks);

  // lueur dorée des trésors, très douce
  const goldLight = new THREE.PointLight(0xffc860, 2.5, 5, 2);
  goldLight.position.set(X1 + 1.6, F + 1.4, zc);
  g.add(goldLight);

  return {
    grimoire: grimoire.position.clone(),
    grimoireObjects: [lectern, deskTop, grimoire],
    update: (time: number) => {
      rings.forEach((r, i) => (r.rotation.y = time * (0.4 + i * 0.25)));
      sphere.position.y = F + 1.3 + Math.sin(time * 1.2) * 0.04;
      torches.forEach((t, i) => {
        const f = 1 + Math.sin(time * 11 + i * 2) * 0.08 + Math.sin(time * 23.7 + i) * 0.06 + Math.sin(time * 4.3 + i * 3) * 0.05;
        t.light.intensity = t.power * f;
        t.flame.scale.set(1, f * (1 + Math.sin(time * 17 + i) * 0.1), 1);
        t.flame.rotation.y = time * 3;
      });
      sparkMat.opacity = 0.55 + Math.sin(time * 5) * 0.25;
      crown.rotation.y = time * 0.15;
    },
  };
}

const brass = () => new THREE.MeshStandardMaterial({ color: 0xc89a3c, metalness: 0.9, roughness: 0.35 });

/** Serrure à quatre molettes, vissée sur le flanc de la vitrine (face +z). */
export function buildCabinetLock() {
  const g = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.13, 0.008), brass());
  g.add(plate);
  for (let i = 0; i < 4; i++) {
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.02, 16), brass());
    dial.rotation.x = Math.PI / 2;
    dial.position.set(-0.105 + i * 0.07, 0, 0.012);
    g.add(dial);
  }
  return g;
}

/** Plaque de laiton gravée, sur le socle du buste : seul l'indice y est écrit. */
export function buildPlaque(lines: string[]) {
  const tex = canvasTexture(512, 360, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#e8c870');
    grad.addColorStop(1, '#a87a2a');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#5a3c10';
    g.lineWidth = 8;
    g.strokeRect(14, 14, w - 28, h - 28);
    g.fillStyle = '#2a1a06';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'italic 26px Georgia, serif';
    lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * 44));
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.14), new THREE.MeshStandardMaterial({ map: tex, metalness: 0.5, roughness: 0.4 }));
}

const SYM_FONT = '"Segoe UI Symbol", "DejaVu Sans", serif';

/** Cercle de déclinaison de la lunette : les sept astres et leurs jours, gravés en latin. */
export function buildDeclinationCircle() {
  const days: [string, string][] = [['☉', 'SOLIS'], ['☽', 'LVNAE'], ['♂', 'MARTIS'], ['☿', 'MERCVRII'], ['♃', 'IOVIS'], ['♀', 'VENERIS'], ['♄', 'SATVRNI']];
  const tex = canvasTexture(1024, 1024, (g, w) => {
    const c = w / 2;
    const grad = g.createRadialGradient(c * 0.8, c * 0.7, 40, c, c, c);
    grad.addColorStop(0, '#e8c878');
    grad.addColorStop(1, '#8a6224');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(c, c, c - 4, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#3a2408';
    g.lineWidth = 6;
    for (const r of [c - 14, c - 70, 150]) {
      g.beginPath();
      g.arc(c, c, r, 0, Math.PI * 2);
      g.stroke();
    }
    // graduations
    g.lineWidth = 2;
    for (let i = 0; i < 360; i += 5) {
      const a = (i * Math.PI) / 180;
      const l = i % 30 ? 22 : 44;
      g.beginPath();
      g.moveTo(c + Math.cos(a) * (c - 14), c + Math.sin(a) * (c - 14));
      g.lineTo(c + Math.cos(a) * (c - 14 - l), c + Math.sin(a) * (c - 14 - l));
      g.stroke();
    }
    g.fillStyle = '#2a1806';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    days.forEach(([sym, name], i) => {
      const a = (i / days.length) * Math.PI * 2 - Math.PI / 2;
      g.save();
      g.translate(c, c);
      g.rotate(a + Math.PI / 2);
      g.font = `64px ${SYM_FONT}`;
      g.fillText(sym, 0, -(c - 125));
      g.font = 'bold 40px Georgia, serif';
      g.fillText('DIES', 0, -(c - 200));
      g.fillText(name, 0, -(c - 248));
      g.restore();
    });
    g.font = 'italic 34px Georgia, serif';
    g.fillText('Hebdomas', c, c);
  });
  const g = new THREE.Group();
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.15, 48), new THREE.MeshStandardMaterial({ map: tex, metalness: 0.6, roughness: 0.35 }));
  face.position.z = 0.0055; // devant le bord en laiton (pas de faces confondues)
  g.add(face);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.152, 0.152, 0.008, 48), brass());
  rim.rotation.x = Math.PI / 2;
  g.add(rim);
  return g;
}

/** Parchemin au fond du coffre : une grille de lettres, rangs I à IV, jours L M M J V S D. */
export function chestGridTexture() {
  const rows = ['RNETSUI', 'EALOCRT', 'VSIENAM', 'OTREULA'];
  return canvasTexture(1024, 640, (g, w, h) => {
    g.fillStyle = '#e6d3a4';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(120,80,30,${Math.random() * 0.08})`;
      g.beginPath();
      g.arc(Math.random() * w, Math.random() * h, 20 + Math.random() * 80, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#3a1e0a';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const cw = 110;
    const ch = 118;
    const x0 = (w - cw * 8) / 2;
    const y0 = 50;
    g.font = 'italic 48px Georgia, serif';
    'LMMJVSD'.split('').forEach((d, c) => g.fillText(d, x0 + cw * (c + 1.5), y0 + ch / 2));
    ['I', 'II', 'III', 'IV'].forEach((r, i) => g.fillText(r, x0 + cw / 2, y0 + ch * (i + 1.5)));
    g.font = 'bold 64px Georgia, serif';
    rows.forEach((row, r) => row.split('').forEach((l, c) => g.fillText(l, x0 + cw * (c + 1.5), y0 + ch * (r + 1.5))));
    g.strokeStyle = 'rgba(58,30,10,0.6)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x0 + cw, y0 + 10);
    g.lineTo(x0 + cw, y0 + ch * 5);
    g.moveTo(x0, y0 + ch);
    g.lineTo(x0 + cw * 8, y0 + ch);
    g.stroke();
  });
}

/** Le livre noir au soleil d'or (fermé, posé à plat). */
export function buildBlackTome() {
  const tex = canvasTexture(256, 340, (g, w, h) => {
    g.fillStyle = '#16100c';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(200,160,70,0.5)';
    g.lineWidth = 3;
    g.strokeRect(14, 14, w - 28, h - 28);
    g.fillStyle = '#c8a046';
    g.font = `70px ${SYM_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('☉', w / 2, h / 2);
  });
  const leather = new THREE.MeshStandardMaterial({ color: 0x16100c, roughness: 0.6 });
  const top = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 });
  const pages = new THREE.MeshStandardMaterial({ color: 0xd8c8a0, roughness: 0.9 });
  return new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.045, 0.23), [pages, leather, top, leather, pages, pages]);
}

/** Inscription dorée sur fond transparent (« III · Ag » dans la pendule, « IV · Au » dans le cabinet). */
export function inscriptionTexture(text: string) {
  return canvasTexture(512, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#e8c060';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'italic bold 96px Georgia, serif';
    g.fillText(text, w / 2, h / 2);
  });
}

/** Rayon de lumière additif entre deux points (sur le calque 1, hors occlusion ambiante). */
export function buildBeam(color = 0xffe0a0, radius = 0.025) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 10, 1, true), mat);
  mesh.layers.set(1);
  mesh.visible = false;
  const up = new THREE.Vector3(0, 1, 0);
  const d = new THREE.Vector3();
  return {
    mesh,
    set(a: THREE.Vector3, b: THREE.Vector3) {
      d.subVectors(b, a);
      mesh.position.copy(a).addScaledVector(d, 0.5);
      mesh.scale.set(1, d.length(), 1);
      mesh.quaternion.setFromUnitVectors(up, d.normalize());
    },
  };
}

/** Rosace dorée gravée dans le sol (cercles, rayons, les sept astres). */
function roseTexture() {
  return canvasTexture(512, 512, (g, w) => {
    const c = w / 2;
    g.clearRect(0, 0, w, w);
    g.strokeStyle = '#e8b850';
    g.fillStyle = '#e8b850';
    g.lineWidth = 4;
    for (const r of [240, 222, 150, 70]) {
      g.beginPath();
      g.arc(c, c, r, 0, Math.PI * 2);
      g.stroke();
    }
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      g.beginPath();
      g.moveTo(c + Math.cos(a) * 70, c + Math.sin(a) * 70);
      g.lineTo(c + Math.cos(a) * (k % 2 ? 150 : 222), c + Math.sin(a) * (k % 2 ? 150 : 222));
      g.stroke();
    }
    g.font = `30px ${SYM_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    ['☉', '☽', '♂', '☿', '♃', '♀', '♄'].forEach((sym, k) => {
      const a = (k / 7) * Math.PI * 2 - Math.PI / 2;
      g.fillText(sym, c + Math.cos(a) * 186, c + Math.sin(a) * 186);
    });
  });
}

/** Tapisserie pourpre, bordure d'or et grand soleil brodé. */
function tapestryTexture() {
  return canvasTexture(256, 512, (g, w, h) => {
    g.fillStyle = '#5a0e18';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) {
      g.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.06})`;
      g.fillRect(0, y, w, 1);
    }
    g.strokeStyle = '#c8a046';
    g.lineWidth = 10;
    g.strokeRect(14, 14, w - 28, h - 60);
    g.lineWidth = 3;
    g.strokeRect(30, 30, w - 60, h - 92);
    const c = w / 2;
    const cy = h * 0.42;
    g.fillStyle = '#d8b050';
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      g.beginPath();
      g.moveTo(c + Math.cos(a - 0.12) * 38, cy + Math.sin(a - 0.12) * 38);
      g.lineTo(c + Math.cos(a) * (k % 2 ? 62 : 80), cy + Math.sin(a) * (k % 2 ? 62 : 80));
      g.lineTo(c + Math.cos(a + 0.12) * 38, cy + Math.sin(a + 0.12) * 38);
      g.fill();
    }
    g.beginPath();
    g.arc(c, cy, 36, 0, Math.PI * 2);
    g.fill();
    // franges
    for (let x = 16; x < w - 16; x += 8) g.fillRect(x, h - 44, 3, 40);
  });
}

/** Grandes dalles irrégulières pour le sol de la salle au trésor. */
function flagstoneTexture() {
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#2a241e';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 128) {
      const off = (y / 128) % 2 ? 64 : 0;
      for (let x = -off; x < w; x += 128 + Math.floor(Math.random() * 40)) {
        const v = 70 + Math.random() * 30;
        g.fillStyle = `rgb(${v},${v - 8},${v - 18})`;
        g.fillRect(x + 4, y + 4, 120 + Math.random() * 30, 120);
        for (let i = 0; i < 120; i++) {
          const d = v - 20 + Math.random() * 40;
          g.fillStyle = `rgba(${d},${d - 8},${d - 18},0.4)`;
          g.fillRect(x + 4 + Math.random() * 120, y + 4 + Math.random() * 120, 3, 3);
        }
      }
    }
  }, [2, 2]);
}

/** Torche murale : manche, coupelle, flamme additive. L'appelant choisit position et inclinaison. */
function makeTorch(wood: THREE.Material, iron: THREE.Material) {
  const torch = new THREE.Group();
  torch.add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.016, 0.45, 10), wood));
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.03, 0.09, 12, 1, true), iron);
  cup.position.y = 0.25;
  torch.add(cup);
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.06, 0.24, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  flame.position.y = 0.4;
  flame.layers.set(1);
  torch.add(flame);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  core.position.y = 0.32;
  core.layers.set(1);
  torch.add(core);
  torch.scale.setScalar(1.6);
  return { torch, flame };
}

/** Ouvre le couvercle d'un coffre et le remplit d'or (charnière sur le bord arrière, comme le coffre du labo). */
function openLid(chest: THREE.Object3D) {
  chest.updateMatrixWorld(true);
  const lid = chest.getObjectByName('treasure_chest_lid');
  if (!lid) return;
  const box = new THREE.Box3().setFromObject(lid);
  const hinge = new THREE.Group();
  hinge.position.copy(chest.worldToLocal(new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y, box.min.z)));
  chest.add(hinge);
  hinge.attach(lid);
  hinge.rotation.x = -1.15;
  // monceau d'or qui dépasse du bord
  const gold = new THREE.MeshStandardMaterial({ color: 0xe0b040, metalness: 1, roughness: 0.25, emissive: 0x3a2400, emissiveIntensity: 0.6 });
  const coins = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.02, 0.02, 0.004, 10), gold, 160);
  const m = new THREE.Matrix4();
  const w = (box.max.x - box.min.x) * 0.42;
  const d = (box.max.z - box.min.z) * 0.38;
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  for (let i = 0; i < 160; i++) {
    const u = (Math.random() - 0.5) * 2;
    const v = (Math.random() - 0.5) * 2;
    const y = box.min.y - 0.03 + (1 - Math.max(Math.abs(u), Math.abs(v))) * 0.07 * Math.random();
    m.compose(new THREE.Vector3(cx + u * w, y, cz + v * d), new THREE.Quaternion().setFromEuler(new THREE.Euler((Math.random() - 0.5) * 0.8, 0, (Math.random() - 0.5) * 0.8)), new THREE.Vector3(1, 1, 1));
    coins.setMatrixAt(i, m);
  }
  chest.parent!.add(coins);
  const glow = new THREE.PointLight(0xffc860, 1.5, 1.6, 2);
  glow.position.set(cx, box.min.y + 0.25, cz);
  chest.parent!.add(glow);
}
