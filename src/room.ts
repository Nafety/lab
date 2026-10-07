import * as THREE from 'three';
import { pbrMaterial, loadTexture } from './assets';
import { leadedGlassTexture, rugTexture, wallpaperTexture } from './textures';

/** Obstacle au sol (rectangle vu du dessus) pour les collisions du joueur. */
export interface Collider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Hauteur du dessus : on peut grimper sur les objets assez bas. */
  top: number;
  /** Zone de plafond (avec top = -Infinity) : la tête ne monte pas plus haut que cette hauteur. */
  ceil?: number;
}

export const ROOM = { w: 11, d: 8, h: 3.8 };
const HW = ROOM.w / 2;
const HD = ROOM.d / 2;
const WAINSCOT = 1.1;

/** Fenêtres du mur ouest (x = -HW) : centre en z, largeur, bas, haut. */
export const WINDOWS = [-1.6, 1.6].map((z) => ({ z, w: 1.3, y1: WAINSCOT, y2: 3.2 }));

/** Passage secret dans le mur est (entre z1 et z2), caché derrière la vitrine près de la pendule. */
export const SECRET_DOOR = { z1: 1.37, z2: 2.87, h: 1.9 }; // plus bas que le haut de la vitrine (1,92 m à ses bords) : invisible tant qu'elle est fermée

/** Direction du soleil (du dehors vers la pièce). */
export const SUN_DIR = new THREE.Vector3(14, -9, -3).normalize();

export function colliderOf(obj: THREE.Object3D, pad = 0): Collider {
  const b = new THREE.Box3().setFromObject(obj);
  return { minX: b.min.x - pad, maxX: b.max.x + pad, minZ: b.min.z - pad, maxZ: b.max.z + pad, top: b.max.y };
}

/** Plan dont les UV suivent la taille réelle (1 répétition de texture tous les `tile` mètres). */
function plane(w: number, h: number, tile: number, mat: THREE.Material) {
  const geo = new THREE.PlaneGeometry(w, h);
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * h) / tile);
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true;
  m.castShadow = true;
  return m;
}

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function buildRoom(scene: THREE.Scene): { colliders: Collider[]; update: (t: number) => void } {
  const { w, d, h } = ROOM;

  const parquet = pbrMaterial('herringbone_parquet', 1, 1, { color: 0xa87c50, envMapIntensity: 0.15 });
  parquet.roughnessMap = null; // parquet ciré mais pas miroir
  parquet.roughness = 0.7;
  const panels = pbrMaterial('dark_paneled_wood', 1, 1, { color: 0x8a6a50 });
  const plaster = pbrMaterial('white_plaster_02', 1, 1, { color: 0xe8dcc4 });
  const darkWood = pbrMaterial('dark_wood', 1, 1, { color: 0x6a4a34 });
  const wallNormal = loadTexture('assets/textures/beige_wall_001/nor.jpg', false);
  wallNormal.wrapS = wallNormal.wrapT = THREE.RepeatWrapping;
  const wallpaper = new THREE.MeshStandardMaterial({
    map: wallpaperTexture(),
    normalMap: wallNormal,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.85,
  });

  // Sol et plafond
  const floor = plane(w, d, 2, parquet);
  floor.rotation.x = -Math.PI / 2;
  floor.castShadow = false;
  scene.add(floor);
  const ceiling = plane(w, d, 3, plaster);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = h;
  scene.add(ceiling);

  // Murs : boiserie en bas, papier peint en haut
  const walls: { len: number; pos: THREE.Vector3; rot: number; windows?: boolean; secret?: boolean }[] = [
    { len: w, pos: new THREE.Vector3(0, 0, -HD), rot: 0 },
    { len: w, pos: new THREE.Vector3(0, 0, HD), rot: Math.PI },
    { len: d, pos: new THREE.Vector3(-HW, 0, 0), rot: Math.PI / 2, windows: true },
    { len: d, pos: new THREE.Vector3(HW, 0, 0), rot: -Math.PI / 2, secret: true }, // x local = z monde
  ];
  for (const wall of walls) {
    const group = new THREE.Group();
    group.position.copy(wall.pos);
    group.rotation.y = wall.rot;
    scene.add(group);

    // Tronçons pleins du mur (le mur nord a une ouverture pour le passage secret)
    const spans: [number, number][] = wall.secret
      ? [[-wall.len / 2, SECRET_DOOR.z1], [SECRET_DOOR.z2, wall.len / 2]]
      : [[-wall.len / 2, wall.len / 2]];
    for (const [x1, x2] of spans) {
      const low = plane(x2 - x1, WAINSCOT, 1.1, panels);
      low.position.set((x1 + x2) / 2, WAINSCOT / 2, 0);
      group.add(low);
    }

    // Sur le mur ouest, le papier peint est découpé autour des fenêtres (x local = -z monde)
    const pieces: [number, number, number, number][] = []; // x1, x2, y1, y2 en local
    if (wall.windows) {
      const half = WINDOWS[0].w / 2;
      let x = -wall.len / 2;
      for (const cx of WINDOWS.map((win) => -win.z).sort((a, b) => a - b)) {
        pieces.push([x, cx - half, WAINSCOT, h]);
        pieces.push([cx - half, cx + half, WINDOWS[0].y2, h]);
        x = cx + half;
      }
      pieces.push([x, wall.len / 2, WAINSCOT, h]);
    } else if (wall.secret) {
      pieces.push([-wall.len / 2, SECRET_DOOR.z1, WAINSCOT, h], [SECRET_DOOR.z1, SECRET_DOOR.z2, SECRET_DOOR.h, h], [SECRET_DOOR.z2, wall.len / 2, WAINSCOT, h]);
    } else {
      pieces.push([-wall.len / 2, wall.len / 2, WAINSCOT, h]);
    }
    for (const [x1, x2, y1, y2] of pieces) {
      const p = plane(x2 - x1, y2 - y1, 0.55, wallpaper);
      p.position.set((x1 + x2) / 2, (y1 + y2) / 2, 0);
      group.add(p);
    }

    // Plinthe, cimaise, corniche
    for (const [x1, x2] of spans) {
      group.add(box(x2 - x1, 0.16, 0.04, darkWood, (x1 + x2) / 2, 0.08, 0.02));
      group.add(box(x2 - x1, 0.06, 0.06, darkWood, (x1 + x2) / 2, WAINSCOT, 0.03));
    }
    group.add(box(wall.len, 0.12, 0.1, darkWood, 0, h - 0.06, 0.05));
    group.add(box(wall.len, 0.05, 0.16, darkWood, 0, h - 0.14, 0.08));
  }

  // Poutres du plafond
  for (const x of [-3.3, -1.1, 1.1, 3.3]) scene.add(box(0.26, 0.3, d, darkWood, x, h - 0.15, 0));

  buildWindows(scene);
  const updateDust = buildSunlight(scene);

  // Tapis persan sous le globe
  const rug = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 2.6),
    new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 1 }),
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(-0.6, 0.006, 0.6);
  rug.receiveShadow = true;
  scene.add(rug);

  scene.add(new THREE.HemisphereLight(0xf0e2c8, 0x4a3020, 0.6));

  const t = 1;
  return {
    colliders: [
      { minX: -HW - t, maxX: HW + t, minZ: -HD - t, maxZ: -HD, top: Infinity },
      { minX: -HW - t, maxX: HW + t, minZ: HD, maxZ: HD + t, top: Infinity },
      { minX: -HW - t, maxX: -HW, minZ: -HD - t, maxZ: HD + t, top: Infinity },
      { minX: HW, maxX: HW + t, minZ: -HD - t, maxZ: SECRET_DOOR.z1, top: Infinity },
      { minX: HW, maxX: HW + t, minZ: SECRET_DOOR.z2, maxZ: HD + t, top: Infinity },
      // le sol du labo : on peut désormais descendre plus bas (escalier secret)
      { minX: -HW, maxX: HW, minZ: -HD, maxZ: HD, top: 0 },
      // le plafond, sous les poutres : on ne le traverse pas en sautant depuis un meuble
      { minX: -HW, maxX: HW, minZ: -HD, maxZ: HD, top: -Infinity, ceil: h - 0.32 },
    ],
    update: updateDust,
  };
}

function buildWindows(scene: THREE.Scene) {
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1e, roughness: 0.6 });
  const stone = new THREE.MeshStandardMaterial({ color: 0xcdbfa6, roughness: 0.9 });
  // Verre ancien opaque mais lumineux (vitrail + verre dépoli) : on ne voit pas dehors, la lumière passe
  const glassTex = leadedGlassTexture();
  const glass = new THREE.MeshStandardMaterial({ map: glassTex, emissive: 0xffffff, emissiveMap: glassTex, emissiveIntensity: 0.85, roughness: 0.25 });
  const velvet = new THREE.MeshStandardMaterial({ color: 0x5a1418, roughness: 0.95, side: THREE.DoubleSide });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc8a050, metalness: 1, roughness: 0.35 });
  const depth = 0.4;

  for (const win of WINDOWS) {
    const g = new THREE.Group();
    g.position.set(-HW, 0, win.z);
    scene.add(g);
    const hgt = win.y2 - win.y1;
    const cy = (win.y1 + win.y2) / 2;

    // Embrasure (épaisseur du mur) : elle limite aussi la lumière qui entre
    // (en retrait de 1 cm derrière le papier peint, sinon les faces se confondent et scintillent)
    for (const s of [-1, 1]) g.add(box(depth, hgt, 0.1, stone, -depth / 2 - 0.01, cy, s * (win.w / 2 + 0.05)));
    g.add(box(depth, 0.7, win.w + 0.2, stone, -depth / 2 - 0.01, win.y2 + 0.35, 0));
    g.add(box(depth + 0.12, 0.06, win.w + 0.3, stone, -depth / 2 + 0.06, win.y1 - 0.03, 0));

    // Châssis : cadre, montant central, petits bois
    const fx = -depth + 0.08;
    g.add(box(0.06, hgt, 0.07, frameMat, fx, cy, -win.w / 2 + 0.035));
    g.add(box(0.06, hgt, 0.07, frameMat, fx, cy, win.w / 2 - 0.035));
    g.add(box(0.06, 0.07, win.w, frameMat, fx, win.y2 - 0.035, 0));
    g.add(box(0.06, 0.07, win.w, frameMat, fx, win.y1 + 0.035, 0));
    g.add(box(0.06, hgt, 0.05, frameMat, fx, cy, 0));
    for (let i = 1; i < 4; i++) g.add(box(0.04, 0.035, win.w, frameMat, fx, win.y1 + (hgt * i) / 4, 0));
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(win.w, hgt), glass);
    pane.rotation.y = Math.PI / 2;
    pane.position.set(fx, cy, 0);
    g.add(pane);

    // Rideaux de velours plissés + tringle
    for (const s of [-1, 1]) {
      const geo = new THREE.PlaneGeometry(0.55, 3.0, 40, 1);
      const pos = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 38) * 0.04);
      geo.computeVertexNormals();
      const curtain = new THREE.Mesh(geo, velvet);
      curtain.rotation.y = Math.PI / 2;
      curtain.position.set(0.12, 1.95, s * (win.w / 2 + 0.3));
      curtain.castShadow = true;
      curtain.receiveShadow = true;
      g.add(curtain);
    }
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, win.w + 1.4, 12), brass);
    rod.rotation.x = Math.PI / 2;
    rod.position.set(0.14, 3.45, 0);
    g.add(rod);
    for (const s of [-1, 1]) {
      const end = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), brass);
      end.position.set(0.14, 3.45, s * (win.w / 2 + 0.7));
      g.add(end);
    }
  }
}

/** Soleil qui entre par les fenêtres : lumière avec ombres, faisceaux et poussière en suspension. */
function buildSunlight(scene: THREE.Scene) {
  const sun = new THREE.DirectionalLight(0xffe7c4, 4.5);
  sun.position.copy(SUN_DIR).multiplyScalar(-20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const cam = sun.shadow.camera;
  cam.left = -11;
  cam.right = 11;
  cam.top = 11;
  cam.bottom = -11;
  cam.near = 1;
  cam.far = 45;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  // Faisceaux : un volume extrudé depuis chaque fenêtre dans la direction du soleil
  const beamMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(1, 0.86, 0.62) } },
    vertexShader: `attribute float fade; varying float vFade;
      void main() { vFade = fade; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uColor; varying float vFade;
      void main() { gl_FragColor = vec4(uColor * 0.018 * pow(1.0 - vFade, 1.5), 1.0); }`,
  });
  const len = 7;
  const dustPositions: number[] = [];
  for (const win of WINDOWS) {
    const corners = [
      [win.z - win.w / 2, win.y1],
      [win.z + win.w / 2, win.y1],
      [win.z + win.w / 2, win.y2],
      [win.z - win.w / 2, win.y2],
    ].map(([z, y]) => new THREE.Vector3(-HW, y, z));
    const far = corners.map((c) => c.clone().addScaledVector(SUN_DIR, len));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([...corners, ...far].flatMap((p) => p.toArray()), 3));
    geo.setAttribute('fade', new THREE.Float32BufferAttribute([0, 0, 0, 0, 1, 1, 1, 1], 1));
    geo.setIndex([0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]);
    const beam = new THREE.Mesh(geo, beamMat);
    beam.layers.set(1); // calque ignoré par l'occlusion ambiante (voir main.ts)
    scene.add(beam);

    for (let i = 0; i < 250; i++) {
      const p = corners[0]
        .clone()
        .lerp(corners[1], Math.random())
        .setY(win.y1 + Math.random() * (win.y2 - win.y1))
        .addScaledVector(SUN_DIR, Math.random() * len * 0.8);
      if (p.y > 0.05) dustPositions.push(p.x, p.y, p.z);
    }
  }

  const dustGeo = new THREE.BufferGeometry();
  const base = new Float32Array(dustPositions);
  dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(dustPositions, 3));
  scene.add(
    new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({
        color: 0xfff0d0,
        size: 0.007,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    ),
  );

  return (t: number) => {
    const pos = dustGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const k = i * 3;
      pos.setXYZ(
        i,
        base[k] + Math.sin(t * 0.15 + i) * 0.08,
        base[k + 1] + Math.sin(t * 0.1 + i * 1.7) * 0.12,
        base[k + 2] + Math.cos(t * 0.12 + i * 0.7) * 0.08,
      );
    }
    pos.needsUpdate = true;
  };
}
