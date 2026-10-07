import * as THREE from 'three';
import { pbrMaterial } from './assets';
import {
  blueprintTexture,
  canvasTexture,
  chalkboardTexture,
  labelTexture,
  LEATHER,
  pageEdgeTexture,
  spineTexture,
  starChartTexture,
} from './textures';

/** Objets fabriqués sur mesure (ceux qui n'existent pas en modèle 3D, ou qu'il faut animer). */

const PI = Math.PI;

let rosewoodMat: THREE.MeshStandardMaterial | null = null;
let darkWoodMat: THREE.MeshStandardMaterial | null = null;
const rosewood = () => (rosewoodMat ??= pbrMaterial('rosewood_veneer1', 1, 1, { color: 0x9a6a48 }));
const darkWood = () => (darkWoodMat ??= pbrMaterial('dark_wood', 1, 1, { color: 0x6a4a34 }));

export const brass = new THREE.MeshStandardMaterial({ color: 0xd4a752, metalness: 1, roughness: 0.28 });
const blackEnamel = new THREE.MeshStandardMaterial({ color: 0x141210, metalness: 0.3, roughness: 0.35 });

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) =>
  mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);

const cyl = (rt: number, rb: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 24) =>
  mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z);

/** Cylindre orienté d'un point à un autre (pieds de trépied, barreaux…). */
function rod(from: THREE.Vector3, to: THREE.Vector3, r: number, mat: THREE.Material) {
  const dir = to.clone().sub(from);
  const m = cyl(r, r, dir.length(), mat, 0, 0, 0, 10);
  m.position.copy(from).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

/** Profil tourné (pieds de table, balustres…) à partir de couples [rayon, hauteur]. */
function turned(profile: [number, number][], mat: THREE.Material) {
  return mesh(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 24), mat);
}

export function seeded(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

// =====================================================================
// Globe terrestre ancien sur pied
// =====================================================================
export const GLOBE_RADIUS = 0.42;
export const GLOBE_CENTER_Y = 1.12;

export function buildAntiqueGlobe(map: THREE.Texture) {
  const g = new THREE.Group();
  const R = GLOBE_RADIUS;
  const cy = GLOBE_CENTER_Y;

  // Cercle d'horizon gradué
  const horizonTex = canvasTexture(1024, 1024, (c, w) => {
    const mid = w / 2;
    c.fillStyle = '#d9c79c';
    c.fillRect(0, 0, w, w);
    c.strokeStyle = '#3a2412';
    c.fillStyle = '#3a2412';
    c.lineWidth = 3;
    for (const r of [mid * 0.99, mid * 0.86, mid * 0.79]) {
      c.beginPath();
      c.arc(mid, mid, r, 0, PI * 2);
      c.stroke();
    }
    c.lineWidth = 1.5;
    for (let i = 0; i < 360; i += 2) {
      const a = (i / 180) * PI;
      const r1 = i % 10 === 0 ? mid * 0.93 : mid * 0.96;
      c.beginPath();
      c.moveTo(mid + Math.cos(a) * r1, mid + Math.sin(a) * r1);
      c.lineTo(mid + Math.cos(a) * mid * 0.99, mid + Math.sin(a) * mid * 0.99);
      c.stroke();
    }
    const signs = ['BÉLIER', 'TAUREAU', 'GÉMEAUX', 'CANCER', 'LION', 'VIERGE', 'BALANCE', 'SCORPION', 'SAGITTAIRE', 'CAPRICORNE', 'VERSEAU', 'POISSONS'];
    c.font = 'bold 22px Georgia, serif';
    c.textAlign = 'center';
    signs.forEach((s, i) => {
      const a = ((i + 0.5) / 12) * PI * 2;
      c.save();
      c.translate(mid + Math.cos(a) * mid * 0.825, mid + Math.sin(a) * mid * 0.825);
      c.rotate(a + PI / 2);
      c.fillText(s, 0, 8);
      c.restore();
      const b = (i / 12) * PI * 2;
      c.beginPath();
      c.moveTo(mid + Math.cos(b) * mid * 0.79, mid + Math.sin(b) * mid * 0.79);
      c.lineTo(mid + Math.cos(b) * mid * 0.86, mid + Math.sin(b) * mid * 0.86);
      c.stroke();
    });
  });
  const ringGeo = new THREE.RingGeometry(R + 0.03, R + 0.14, 128, 1);
  const ring = mesh(ringGeo, new THREE.MeshStandardMaterial({ map: horizonTex, roughness: 0.6 }), 0, cy, 0);
  ring.rotation.x = -PI / 2;
  g.add(ring);
  const rim = mesh(new THREE.CylinderGeometry(R + 0.14, R + 0.14, 0.04, 96, 1, true), rosewood(), 0, cy - 0.02, 0);
  g.add(rim);
  const rimIn = mesh(new THREE.CylinderGeometry(R + 0.03, R + 0.03, 0.04, 96, 1, true), rosewood(), 0, cy - 0.02, 0);
  g.add(rimIn);
  const under = mesh(new THREE.RingGeometry(R + 0.03, R + 0.14, 96, 1), rosewood(), 0, cy - 0.04, 0);
  under.rotation.x = PI / 2;
  g.add(under);

  // Pieds tournés et entretoise
  const legProfile: [number, number][] = [
    [0.0, 0], [0.035, 0], [0.04, 0.04], [0.025, 0.08], [0.022, 0.3], [0.04, 0.36], [0.045, 0.4],
    [0.03, 0.46], [0.022, 0.75], [0.03, 0.85], [0.04, 0.92], [0.03, 0.98], [0.035, cy - 0.04], [0, cy - 0.04],
  ];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * PI * 2 + PI / 4;
    const leg = turned(legProfile, rosewood());
    leg.position.set(Math.cos(a) * (R + 0.09), 0, Math.sin(a) * (R + 0.09));
    g.add(leg);
  }
  for (const rot of [PI / 4, -PI / 4]) {
    const bar = box(2 * (R + 0.09), 0.035, 0.04, rosewood(), 0, 0.38, 0);
    bar.rotation.y = rot;
    g.add(bar);
  }
  const finial = turned([[0, 0], [0.05, 0], [0.06, 0.04], [0.03, 0.1], [0.045, 0.16], [0, 0.2]], rosewood());
  finial.position.y = 0.39;
  g.add(finial);

  // Méridien en laiton (vertical) et globe incliné à l'intérieur
  const meridian = mesh(new THREE.TorusGeometry(R + 0.03, 0.011, 12, 128), brass, 0, cy, 0);
  g.add(meridian);
  const meridianSupport = cyl(0.015, 0.025, 0.12, brass, 0, cy - R - 0.08, 0);
  g.add(meridianSupport);

  const tilt = new THREE.Group();
  tilt.position.y = cy;
  tilt.rotation.z = 0.41;
  g.add(tilt);
  const earth = mesh(
    new THREE.SphereGeometry(R, 96, 64),
    new THREE.MeshPhysicalMaterial({ map, roughness: 0.55, clearcoat: 0.5, clearcoatRoughness: 0.35 }),
  );
  tilt.add(earth);
  for (const sgn of [1, -1]) tilt.add(cyl(0.008, 0.008, 0.06, brass, 0, sgn * (R + 0.02), 0, 8));

  return { group: g, tilt, earth };
}

// =====================================================================
// Lunette astronomique en laiton sur trépied en bois
// =====================================================================
export function buildTelescope(dir: THREE.Vector3) {
  const g = new THREE.Group();
  const apex = new THREE.Vector3(0, 1.45, 0);

  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * PI * 2 + 0.3;
    const foot = new THREE.Vector3(Math.cos(a) * 0.6, 0, Math.sin(a) * 0.6);
    g.add(rod(apex.clone().add(new THREE.Vector3(0, -0.05, 0)), foot, 0.028, rosewood()));
    g.add(cyl(0.035, 0.03, 0.05, brass, foot.x, 0.025, foot.z, 12));
    // tirant d'écartement
    const mid = foot.clone().lerp(apex, 0.35);
    g.add(rod(mid, new THREE.Vector3(0, mid.y, 0), 0.008, brass));
  }
  g.add(cyl(0.05, 0.05, 0.06, brass, 0, 0.55, 0, 16));
  g.add(cyl(0.07, 0.06, 0.1, brass, 0, apex.y - 0.06, 0));
  // fourche
  for (const s of [-1, 1]) g.add(box(0.02, 0.16, 0.05, brass, 0, apex.y + 0.05, s * 0.09));

  const tube = new THREE.Group();
  tube.position.copy(apex).add(new THREE.Vector3(0, 0.1, 0));
  tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  g.add(tube);
  tube.add(cyl(0.062, 0.058, 1.5, brass, 0, 0.1, 0, 32));
  tube.add(cyl(0.08, 0.075, 0.28, brass, 0, 0.95, 0, 32)); // pare-buée
  tube.add(mesh(new THREE.CircleGeometry(0.072, 32), new THREE.MeshPhysicalMaterial({ color: 0x223040, roughness: 0, metalness: 0.2, clearcoat: 1 }), 0, 1.07, 0));
  tube.children[tube.children.length - 1].rotation.x = -PI / 2;
  for (const y of [-0.4, 0.1, 0.55]) tube.add(cyl(0.066, 0.066, 0.025, blackEnamel, 0, y, 0, 32));
  tube.add(cyl(0.035, 0.04, 0.2, brass, 0, -0.75, 0, 24)); // porte-oculaire
  tube.add(cyl(0.022, 0.022, 0.1, blackEnamel, 0, -0.9, 0, 16)); // oculaire
  const knob = cyl(0.02, 0.02, 0.12, brass, 0.0, -0.68, 0, 12);
  knob.rotation.z = PI / 2;
  tube.add(knob);
  // chercheur
  tube.add(cyl(0.018, 0.018, 0.4, brass, 0.1, 0.2, 0, 12));
  tube.add(box(0.06, 0.02, 0.02, brass, 0.06, 0.05, 0));
  tube.add(box(0.06, 0.02, 0.02, brass, 0.06, 0.35, 0));

  // Position de l'oculaire (repère du groupe) : sert à placer la caméra
  const eyepiece = new THREE.Vector3(0, -0.95, 0).applyQuaternion(tube.quaternion).add(tube.position);
  return { group: g, eyepiece };
}

// =====================================================================
// Bibliothèque : grandes étagères pleines de livres anciens
// =====================================================================
interface BookSlot {
  matrix: THREE.Matrix4;
  variant: number;
  standing?: boolean;
}

export function buildLibrary(width: number, count: number) {
  const g = new THREE.Group();
  const H = 3.4;
  const D = 0.45;
  const shelves = [0.15, 0.62, 1.09, 1.56, 2.03, 2.5, 2.97];
  const rand = seeded(7);
  const slots: BookSlot[] = [];
  const total = width * count;
  const decorSpots: THREE.Vector3[] = [];

  for (let b = 0; b < count; b++) {
    const cx = -total / 2 + width * (b + 0.5);
    g.add(box(0.06, H, D, darkWood(), cx - width / 2 + 0.03, H / 2, 0));
    g.add(box(0.06, H, D, darkWood(), cx + width / 2 - 0.03, H / 2, 0));
    g.add(box(width, H, 0.02, darkWood(), cx, H / 2, -D / 2 + 0.01));
    for (const y of shelves) g.add(box(width - 0.1, 0.035, D - 0.03, darkWood(), cx, y, 0));
    g.add(box(width, 0.14, D + 0.02, darkWood(), cx, 0.07, 0.01)); // socle
    g.add(box(width + 0.06, 0.12, D + 0.08, darkWood(), cx, H + 0.06, 0.03)); // corniche
    g.add(box(width + 0.12, 0.05, D + 0.14, darkWood(), cx, H + 0.14, 0.05));

    for (let s = 0; s < shelves.length; s++) {
      const y = shelves[s] + 0.0175;
      let x = cx - width / 2 + 0.08;
      const end = cx + width / 2 - 0.08;
      while (x < end - 0.05) {
        const r = rand();
        if (r < 0.04 && end - x > 0.35) {
          decorSpots.push(new THREE.Vector3(x + 0.15, y, 0.02));
          x += 0.32;
          continue;
        }
        if (r < 0.1) {
          // pile de livres couchés
          let py = y;
          const pw = 0.22 + rand() * 0.08;
          for (let k = 0; k < 2 + Math.floor(rand() * 3); k++) {
            const th = 0.035 + rand() * 0.03;
            const m = new THREE.Matrix4().compose(
              new THREE.Vector3(x + pw / 2, py + th / 2, 0.01),
              new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (rand() - 0.5) * 0.2, PI / 2)),
              new THREE.Vector3(th, pw, 0.2 + rand() * 0.05),
            );
            slots.push({ matrix: m, variant: Math.floor(rand() * 16) });
            py += th;
          }
          x += pw + 0.02;
          continue;
        }
        const bw = 0.03 + rand() * 0.045;
        const bh = 0.25 + rand() * 0.17;
        const bd = 0.2 + rand() * 0.08;
        const lean = rand() < 0.06 ? 0.18 : 0;
        const m = new THREE.Matrix4().compose(
          new THREE.Vector3(x + bw / 2 + lean * bh * 0.5, y + bh / 2, D / 2 - 0.04 - bd / 2),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -lean)),
          new THREE.Vector3(bw, bh, bd),
        );
        slots.push({ matrix: m, variant: Math.floor(rand() * 16), standing: lean === 0 });
        x += bw + 0.003 + lean * bh;
        if (rand() < 0.05) x += 0.05 + rand() * 0.08;
      }
    }
  }

  // Un livre à part, rangé parmi les autres à hauteur d'yeux : « De Metallis et Astris »
  const pos = new THREE.Vector3();
  let sIdx = -1;
  let best = Infinity;
  slots.forEach((s, i) => {
    pos.setFromMatrixPosition(s.matrix);
    const d = Math.abs(pos.x - 0.45);
    if (s.standing && pos.y > 1.65 && pos.y < 1.9 && d < best) [best, sIdx] = [d, i];
  });
  const metals = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  if (sIdx >= 0) {
    const leather = new THREE.MeshStandardMaterial({ color: 0x1e3426, roughness: 0.7 });
    const spine = new THREE.MeshStandardMaterial({ map: spineTexture('#1e3426', 3), roughness: 0.55 });
    const edges = new THREE.MeshStandardMaterial({ map: pageEdgeTexture(), roughness: 0.95 });
    metals.material = [leather, leather, edges, edges, spine, edges];
    metals.applyMatrix4(slots.splice(sIdx, 1)[0].matrix);
    g.add(metals);
  }

  // Un InstancedMesh par variante de reliure ; chaque livre peut être pris (voir l'atelier Livres)
  const pages = new THREE.MeshStandardMaterial({ map: pageEdgeTexture(), roughness: 0.95 });
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const books: THREE.InstancedMesh[] = [];
  for (let v = 0; v < 16; v++) {
    const color = LEATHER[v % LEATHER.length];
    const list = slots.filter((s) => s.variant === v);
    if (!list.length) continue;
    const cover = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
    const spine = new THREE.MeshStandardMaterial({ map: spineTexture(color, v), roughness: 0.55 });
    const inst = new THREE.InstancedMesh(geo, [cover, cover, pages, pages, spine, pages], list.length);
    list.forEach((s, i) => inst.setMatrixAt(i, s.matrix));
    inst.castShadow = true;
    inst.receiveShadow = true;
    inst.userData = { color, variant: v };
    g.add(inst);
    books.push(inst);
  }

  // Copie d'un livre, utilisée pour l'animation quand on en sort un de l'étagère
  const proxy = mesh(geo, pages);
  proxy.visible = false;
  g.add(proxy);

  return { group: g, books, proxy, decorSpots, metals };
}

export function buildLadder(height: number) {
  const g = new THREE.Group();
  const lean = 0.28;
  for (const x of [-0.22, 0.22]) {
    g.add(rod(new THREE.Vector3(x, 0, lean * height), new THREE.Vector3(x, height, 0), 0.025, darkWood()));
  }
  for (let y = 0.3; y < height - 0.1; y += 0.3) {
    const z = lean * (height - y);
    g.add(rod(new THREE.Vector3(-0.22, y, z), new THREE.Vector3(0.22, y, z), 0.016, darkWood()));
  }
  // rail et crochets en laiton
  g.add(cyl(0.03, 0.03, 0.05, brass, -0.22, height, 0, 10));
  g.add(cyl(0.03, 0.03, 0.05, brass, 0.22, height, 0, 10));
  return g;
}

// =====================================================================
// Verrerie de chimie
// =====================================================================
const glassMat = new THREE.MeshPhysicalMaterial({
  color: 0xffffff,
  transmission: 1,
  roughness: 0.04,
  thickness: 0.01,
  ior: 1.5,
  transparent: true,
  opacity: 0.6,
});

function liquidMat(color: number) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.15, emissive: color, emissiveIntensity: 0.25, transparent: true, opacity: 0.85 });
}

const lathe = (pts: [number, number][], mat: THREE.Material) =>
  mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 32), mat);

export function buildGlassware() {
  const g = new THREE.Group();
  const bubbles: THREE.Mesh[] = [];

  // Erlenmeyers
  const erlen: [number, number][] = [[0, 0], [0.07, 0], [0.072, 0.01], [0.025, 0.13], [0.022, 0.19], [0.026, 0.2]];
  const erlenLiq: [number, number][] = [[0, 0.004], [0.066, 0.004], [0.045, 0.06], [0, 0.06]];
  [[0x3f9a4a, -0.55, 0.12], [0xa02a5a, -0.38, 0.18], [0xd8a020, 0.62, 0.15]].forEach(([c, x, z]) => {
    const f = lathe(erlen, glassMat);
    f.position.set(x, 0, z);
    const l = lathe(erlenLiq, liquidMat(c));
    l.position.set(x, 0, z);
    g.add(f, l);
  });

  // Ballon à fond rond sur support, chauffé par une lampe à alcool (avec bulles)
  const flaskX = 0.2;
  g.add(mesh(new THREE.SphereGeometry(0.08, 32, 24), glassMat, flaskX, 0.3, 0.12));
  g.add(cyl(0.02, 0.02, 0.15, glassMat, flaskX, 0.44, 0.12, 16));
  const liquid = mesh(new THREE.SphereGeometry(0.074, 32, 24, 0, PI * 2, PI * 0.45, PI * 0.55), liquidMat(0x2a7ab8), flaskX, 0.3, 0.12);
  g.add(liquid);
  g.add(rod(new THREE.Vector3(flaskX - 0.15, 0, 0.12), new THREE.Vector3(flaskX - 0.15, 0.6, 0.12), 0.008, blackEnamel));
  g.add(box(0.2, 0.012, 0.12, blackEnamel, flaskX - 0.08, 0.006, 0.12));
  g.add(rod(new THREE.Vector3(flaskX - 0.15, 0.38, 0.12), new THREE.Vector3(flaskX - 0.02, 0.38, 0.12), 0.006, brass));
  const ringStand = mesh(new THREE.TorusGeometry(0.06, 0.005, 8, 24), blackEnamel, flaskX, 0.22, 0.12);
  ringStand.rotation.x = PI / 2;
  g.add(ringStand);
  g.add(lathe([[0, 0], [0.045, 0], [0.05, 0.03], [0.04, 0.07], [0.012, 0.08], [0.008, 0.1]], glassMat).translateX(flaskX).translateZ(0.12));
  const flame = mesh(new THREE.ConeGeometry(0.012, 0.06, 12), new THREE.MeshBasicMaterial({ color: 0x6aa8ff, transparent: true, opacity: 0.7 }), flaskX, 0.13, 0.12);
  g.add(flame);
  for (let i = 0; i < 8; i++) {
    const b = mesh(new THREE.SphereGeometry(0.006 + Math.random() * 0.006, 8, 8), glassMat, flaskX, 0.26, 0.12);
    b.userData.phase = Math.random();
    bubbles.push(b);
    g.add(b);
  }

  // Béchers
  [[0.42, 0.05, 0x9a5a20], [0.85, 0.08, 0xd0d0c0]].forEach(([x, z, c]) => {
    g.add(cyl(0.04, 0.04, 0.11, glassMat, x, 0.055, z, 24));
    g.add(cyl(0.037, 0.037, 0.05, liquidMat(c), x, 0.028, z, 24));
  });

  // Portoir à tubes à essai
  g.add(box(0.3, 0.015, 0.07, rosewood(), -0.85, 0.08, -0.05));
  g.add(box(0.3, 0.015, 0.07, rosewood(), -0.85, 0.01, -0.05));
  for (const x of [-0.99, -0.71]) g.add(box(0.015, 0.09, 0.07, rosewood(), x, 0.045, -0.05));
  [0xc03020, 0x30a050, 0xe0c030, 0x6040a0, 0x2080c0].forEach((c, i) => {
    const x = -0.95 + i * 0.05;
    g.add(cyl(0.01, 0.01, 0.15, glassMat, x, 0.1, -0.05, 12));
    g.add(cyl(0.009, 0.009, 0.06, liquidMat(c), x, 0.06, -0.05, 12));
  });

  // Mortier et pilon
  g.add(lathe([[0, 0], [0.05, 0], [0.065, 0.04], [0.06, 0.07], [0.05, 0.07], [0.04, 0.03], [0, 0.02]], new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 0.8 })).translateX(0.95).translateZ(-0.12));
  const pestle = cyl(0.008, 0.014, 0.13, new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 0.8 }), 0.97, 0.08, -0.12, 12);
  pestle.rotation.z = 0.5;
  g.add(pestle);

  return {
    group: g,
    update: (t: number) => {
      for (const b of bubbles) {
        const k = (t * 0.6 + b.userData.phase) % 1;
        b.position.y = 0.25 + k * 0.1;
        b.position.x = flaskX + Math.sin(k * 12 + b.userData.phase * 9) * 0.02;
        b.scale.setScalar(1 - k * 0.5);
      }
      flame.scale.y = 1 + Math.sin(t * 18) * 0.12 + Math.sin(t * 7.3) * 0.08;
    },
  };
}

/** Étagère murale de bocaux d'apothicaire étiquetés. */
export function buildJarShelf(width: number) {
  const g = new THREE.Group();
  const labels = [
    ['SOUFRE', 'S'], ['MERCURE', 'Hg'], ['CUIVRE', 'Cu'], ['SEL', 'NaCl'], ['FER', 'Fe'], ['ZINC', 'Zn'],
    ['IODE', 'I'], ['PLOMB', 'Pb'], ['ÉTAIN', 'Sn'], ['ARGENT', 'Ag'], ['CHAUX', 'CaO'], ['OR', 'Au'],
  ];
  const contents = [0xd8c020, 0xb0b0b8, 0xb06030, 0xeeeeee, 0x5a4a40, 0x9aa0a8, 0x5a2050, 0x606068, 0xa0a0a0, 0xc8c8d4, 0xf0ece0, 0xd8b040];
  const cork = new THREE.MeshStandardMaterial({ color: 0x9a7048, roughness: 0.9 });
  for (const [i, y] of [0, 0.42].entries()) {
    g.add(box(width, 0.03, 0.24, darkWood(), 0, y, 0));
    for (const x of [-width / 2 + 0.1, width / 2 - 0.1]) {
      const bracket = box(0.03, 0.12, 0.2, darkWood(), x, y - 0.075, -0.02);
      g.add(bracket);
    }
    const n = 6;
    for (let k = 0; k < n; k++) {
      const idx = i * n + k;
      const x = -width / 2 + 0.2 + (k * (width - 0.4)) / (n - 1);
      const hh = 0.18 + (k % 3) * 0.03;
      g.add(cyl(0.055, 0.055, hh, glassMat, x, y + 0.015 + hh / 2, 0, 24));
      g.add(cyl(0.051, 0.051, hh * 0.65, new THREE.MeshStandardMaterial({ color: contents[idx], roughness: 0.9 }), x, y + 0.015 + hh * 0.33, 0, 20));
      g.add(cyl(0.04, 0.035, 0.035, cork, x, y + 0.015 + hh + 0.015, 0, 16));
      const label = mesh(new THREE.PlaneGeometry(0.08, 0.05), new THREE.MeshStandardMaterial({ map: labelTexture(labels[idx][0], labels[idx][1], ''), roughness: 0.9 }), x, y + 0.015 + hh * 0.45, 0.057);
      g.add(label);
    }
  }
  return g;
}

// =====================================================================
// Bureau : plans, équerre, compas, encrier, papiers
// =====================================================================
export function buildDeskItems() {
  const g = new THREE.Group();
  const paper = (w: number, h: number, tex: THREE.Texture | null, color = 0xe8dcc0) =>
    mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, color, roughness: 0.95, side: THREE.DoubleSide }));

  const plan = paper(0.9, 0.62, blueprintTexture(), 0xffffff);
  plan.rotation.set(-PI / 2, 0, 0.06);
  plan.position.set(-0.1, 0.002, 0.02);
  g.add(plan);
  for (let i = 0; i < 4; i++) {
    const sheet = paper(0.21, 0.297, null, 0xe6dbc0 - i * 0x030303);
    sheet.rotation.set(-PI / 2, 0, (Math.random() - 0.5) * 0.8);
    sheet.position.set(0.5 + Math.random() * 0.15, 0.001 + i * 0.0008, -0.15 + Math.random() * 0.2);
    g.add(sheet);
  }

  // Rouleaux de plans
  const rollMat = new THREE.MeshStandardMaterial({ color: 0xe2d5b5, roughness: 0.9 });
  for (let i = 0; i < 3; i++) {
    const r = cyl(0.025, 0.025, 0.6 - i * 0.08, rollMat, -0.55 + i * 0.03, 0.025 + (i === 2 ? 0.045 : 0), -0.28 + i * 0.055, 16);
    r.rotation.z = PI / 2;
    r.rotation.y = 0.15 * i;
    g.add(r);
  }

  // Équerre en bois avec évidement
  const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.36, 0), new THREE.Vector2(0, 0.24)]);
  shape.holes.push(new THREE.Path([new THREE.Vector2(0.05, 0.035), new THREE.Vector2(0.23, 0.035), new THREE.Vector2(0.05, 0.155)]));
  const square = mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.006, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: 0xc8a070, roughness: 0.5 }), 0.05, 0.007, 0.22);
  square.rotation.set(-PI / 2, 0, -0.35);
  g.add(square);

  // Règle graduée
  const rulerTex = canvasTexture(512, 32, (c, w, h) => {
    c.fillStyle = '#d8c090';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#2a1a0a';
    for (let i = 0; i <= 100; i++) c.fillRect((i / 100) * w, 0, 1.2, i % 10 === 0 ? 16 : i % 5 === 0 ? 11 : 6);
  });
  const ruler = box(0.5, 0.005, 0.035, new THREE.MeshStandardMaterial({ map: rulerTex, roughness: 0.6 }), 0.25, 0.003, -0.2);
  ruler.rotation.y = 0.25;
  g.add(ruler);

  // Compas à pointes sèches en laiton
  const compass = new THREE.Group();
  compass.position.set(-0.3, 0.004, 0.18);
  compass.rotation.y = 0.8;
  compass.add(rod(new THREE.Vector3(0, 0.01, 0), new THREE.Vector3(0.16, 0.003, 0.04), 0.004, brass));
  compass.add(rod(new THREE.Vector3(0, 0.01, 0), new THREE.Vector3(0.16, 0.003, -0.04), 0.004, brass));
  compass.add(cyl(0.012, 0.012, 0.01, brass, 0, 0.01, 0, 12));
  g.add(compass);

  // Encrier et plume
  g.add(cyl(0.035, 0.04, 0.05, glassMat, 0.62, 0.025, 0.25, 20));
  g.add(cyl(0.032, 0.036, 0.03, new THREE.MeshStandardMaterial({ color: 0x0a0a14, roughness: 0.1 }), 0.62, 0.016, 0.25, 20));
  const featherShape = new THREE.Shape();
  featherShape.moveTo(0, 0);
  featherShape.quadraticCurveTo(0.025, 0.12, 0.004, 0.26);
  featherShape.quadraticCurveTo(-0.018, 0.12, 0, 0);
  const feather = mesh(new THREE.ShapeGeometry(featherShape), new THREE.MeshStandardMaterial({ color: 0xf0ece0, roughness: 0.9, side: THREE.DoubleSide }), 0.62, 0.03, 0.25);
  feather.rotation.set(-0.5, 0.4, 0.35);
  g.add(feather);

  // Pile de livres
  let y = 0;
  for (let i = 0; i < 4; i++) {
    const th = 0.04 + Math.random() * 0.02;
    const b = box(0.24 - i * 0.015, th, 0.17 - i * 0.01, new THREE.MeshStandardMaterial({ color: LEATHER[(i * 3) % LEATHER.length], roughness: 0.7 }), -0.6, y + th / 2, 0.22);
    b.rotation.y = (Math.random() - 0.5) * 0.4;
    g.add(b);
    y += th;
  }
  return g;
}

/** Tableau noir mural encadré avec auget et craies. */
export function buildBlackboard() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.PlaneGeometry(1.9, 1.15), new THREE.MeshStandardMaterial({ map: chalkboardTexture(), roughness: 0.95 }), 0, 0, 0.03));
  const frame = darkWood();
  g.add(box(2.02, 0.07, 0.06, frame, 0, 0.61, 0.03));
  g.add(box(2.02, 0.07, 0.06, frame, 0, -0.61, 0.03));
  g.add(box(0.07, 1.29, 0.06, frame, -0.98, 0, 0.03));
  g.add(box(0.07, 1.29, 0.06, frame, 0.98, 0, 0.03));
  g.add(box(1.9, 0.03, 0.1, frame, 0, -0.66, 0.08));
  const chalk = new THREE.MeshStandardMaterial({ color: 0xf2f0e8, roughness: 1 });
  for (const x of [-0.4, -0.32, 0.5]) {
    const c = cyl(0.008, 0.008, 0.07, chalk, x, -0.635, 0.09, 8);
    c.rotation.z = PI / 2;
    g.add(c);
  }
  return g;
}

/** Cadre doré ou en bois contenant une texture (cartes du ciel, carte du monde). */
export function framed(tex: THREE.Texture, w: number, h: number, gold = true) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }), 0, 0, 0.02));
  const mat = gold ? new THREE.MeshStandardMaterial({ color: 0xb08a3e, metalness: 0.9, roughness: 0.4 }) : darkWood();
  const t = 0.06;
  g.add(box(w + t * 2, t, 0.04, mat, 0, h / 2 + t / 2, 0.02));
  g.add(box(w + t * 2, t, 0.04, mat, 0, -h / 2 - t / 2, 0.02));
  g.add(box(t, h, 0.04, mat, -w / 2 - t / 2, 0, 0.02));
  g.add(box(t, h, 0.04, mat, w / 2 + t / 2, 0, 0.02));
  return g;
}

export function starCharts() {
  return [starChartTexture('Hémisphère Boréal', 11, true), starChartTexture('Hémisphère Austral', 23)];
}

/** Colonne de marbre (support du buste). */
export function buildPedestal() {
  const marble = new THREE.MeshStandardMaterial({ color: 0xe8e2d8, roughness: 0.25 });
  const g = new THREE.Group();
  g.add(box(0.42, 0.08, 0.42, marble, 0, 0.04, 0));
  g.add(turned([[0.0, 0.08], [0.17, 0.08], [0.15, 0.14], [0.13, 0.18], [0.12, 0.9], [0.14, 0.96], [0.17, 1.0], [0, 1.0]], marble));
  g.add(box(0.38, 0.06, 0.38, marble, 0, 1.03, 0));
  return g;
}

/** Petite table ronde tournée. */
export function buildRoundTable(r = 0.32, h = 0.68) {
  const g = new THREE.Group();
  g.add(cyl(r, r, 0.035, rosewood(), 0, h, 0, 48));
  g.add(turned([[0, 0.04], [0.04, 0.06], [0.03, 0.15], [0.05, 0.3], [0.03, 0.45], [0.035, h - 0.02], [0, h - 0.02]], rosewood()));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * PI * 2;
    g.add(rod(new THREE.Vector3(0, 0.12, 0), new THREE.Vector3(Math.cos(a) * 0.26, 0.01, Math.sin(a) * 0.26), 0.018, rosewood()));
  }
  return g;
}

/** Planétaire mécanique en laiton (animé). */
export function buildOrrery() {
  const g = new THREE.Group();
  g.add(cyl(0.12, 0.14, 0.04, rosewood(), 0, 0.02, 0, 32));
  g.add(cyl(0.012, 0.012, 0.3, brass, 0, 0.17, 0, 10));
  g.add(mesh(new THREE.SphereGeometry(0.05, 24, 24), new THREE.MeshStandardMaterial({ color: 0xffc040, emissive: 0xff9020, emissiveIntensity: 0.6, metalness: 0.5, roughness: 0.3 }), 0, 0.34, 0));
  const arms: THREE.Group[] = [];
  [[0.1, 0.012, 0xa0a0a0], [0.15, 0.018, 0xd0a060], [0.21, 0.02, 0x3070c0], [0.27, 0.016, 0xc05030], [0.34, 0.035, 0xd0a070]].forEach(([r, size, color], i) => {
    const arm = new THREE.Group();
    arm.position.y = 0.3 - i * 0.025;
    arm.add(rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(r, 0, 0), 0.003, brass));
    arm.add(rod(new THREE.Vector3(r, 0, 0), new THREE.Vector3(r, 0.04, 0), 0.003, brass));
    arm.add(mesh(new THREE.SphereGeometry(size, 16, 16), new THREE.MeshStandardMaterial({ color, roughness: 0.5 }), r, 0.04 + size, 0));
    g.add(arm);
    arms.push(arm);
  });
  return { group: g, update: (t: number) => arms.forEach((a, i) => (a.rotation.y = t * (0.8 / (i + 1)))) };
}

/** Bougie avec flamme vacillante. */
export function buildCandle(height = 0.18) {
  const g = new THREE.Group();
  g.add(cyl(0.016, 0.017, height, new THREE.MeshStandardMaterial({ color: 0xf0e6cc, roughness: 0.6 }), 0, height / 2, 0, 16));
  const flame = mesh(new THREE.SphereGeometry(0.012, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffc860 }), 0, height + 0.02, 0);
  flame.scale.set(1, 2.2, 1);
  flame.castShadow = false;
  g.add(flame);
  return { group: g, flame };
}

/** Pile de livres posée au sol ou sur un meuble. */
export function buildBookPile(count: number, seed: number) {
  const rand = seeded(seed);
  const g = new THREE.Group();
  let y = 0;
  for (let i = 0; i < count; i++) {
    const th = 0.04 + rand() * 0.04;
    const w = 0.22 + rand() * 0.1;
    const color = LEATHER[Math.floor(rand() * LEATHER.length)];
    const b = box(w, th, w * 0.72, new THREE.MeshStandardMaterial({ color, roughness: 0.7 }), (rand() - 0.5) * 0.04, y + th / 2, (rand() - 0.5) * 0.04);
    b.rotation.y = (rand() - 0.5) * 0.6;
    g.add(b);
    y += th;
  }
  return g;
}

/** Petits objets en plus sur le bureau : sablier, lettres cachetées, papiers froissés. */
export function buildDeskExtras() {
  const paperMat = new THREE.MeshStandardMaterial({ color: 0xe9dfc6, roughness: 0.95 });

  // Sablier : deux bulbes de verre, sable, montants en bois
  const hourglass = new THREE.Group();
  for (const y of [0.012, 0.188]) hourglass.add(cyl(0.05, 0.05, 0.024, rosewood(), 0, y, 0, 24));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * PI * 2;
    hourglass.add(cyl(0.005, 0.005, 0.17, rosewood(), Math.cos(a) * 0.04, 0.1, Math.sin(a) * 0.04, 8));
  }
  const bulb: [number, number][] = [[0.001, 0.024], [0.03, 0.04], [0.034, 0.07], [0.006, 0.1], [0.034, 0.13], [0.03, 0.16], [0.001, 0.176]];
  hourglass.add(lathe(bulb, glassMat));
  const sand = new THREE.MeshStandardMaterial({ color: 0xd8b878, roughness: 1 });
  hourglass.add(lathe([[0, 0.026], [0.028, 0.04], [0.026, 0.055], [0, 0.07]], sand));
  hourglass.add(lathe([[0, 0.112], [0.012, 0.125], [0, 0.128]], sand));

  // Lettres cachetées à la cire
  const letters = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const env = box(0.16, 0.003, 0.11, paperMat, (Math.random() - 0.5) * 0.02, 0.0015 + i * 0.003, (Math.random() - 0.5) * 0.02);
    env.rotation.y = (Math.random() - 0.5) * 0.3;
    letters.add(env);
  }
  letters.add(cyl(0.012, 0.012, 0.004, new THREE.MeshStandardMaterial({ color: 0x8e1b14, roughness: 0.4 }), 0.02, 0.014, 0.01, 16));
  const ribbon = box(0.01, 0.002, 0.12, new THREE.MeshStandardMaterial({ color: 0x6a1a12, roughness: 0.8 }), 0, 0.0135, 0);
  letters.add(ribbon);

  // Boules de papier froissé
  const crumpled = () => {
    const geo = new THREE.IcosahedronGeometry(0.035, 1);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const k = 0.75 + Math.random() * 0.45;
      pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
    }
    geo.computeVertexNormals();
    return mesh(geo, paperMat);
  };
  const basketPapers = new THREE.Group();
  for (let i = 0; i < 5; i++) basketPapers.add(crumpled().translateX((Math.random() - 0.5) * 0.2).translateZ((Math.random() - 0.5) * 0.14).translateY(Math.random() * 0.04));
  const floorPaper = crumpled();

  return { hourglass, letters, basketPapers, floorPaper };
}
