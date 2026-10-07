import * as THREE from 'three';
import { buildCandle, brass, seeded } from './props';
import { canvasTexture, LEATHER } from './textures';

/** La part de magie du labo : portail, runes, bougies flottantes, livres volants, boule de cristal. */

const PI = Math.PI;

/** Les objets additifs (lumière pure) sont sur le calque 1, ignoré par l'occlusion ambiante. */
function glowLayer<T extends THREE.Object3D>(o: T) {
  o.layers.set(1);
  return o;
}

/** Glyphes de runes inventés, tracés au trait. */
function drawRune(g: CanvasRenderingContext2D, x: number, y: number, s: number, rand: () => number) {
  g.beginPath();
  g.moveTo(x, y - s);
  g.lineTo(x, y + s);
  for (let k = 0; k < 2; k++) {
    const y0 = y - s + rand() * s * 1.5;
    g.moveTo(x, y0);
    g.lineTo(x + (rand() < 0.5 ? -1 : 1) * s * 0.7, y0 + (rand() - 0.5) * s);
  }
  if (rand() < 0.5) {
    g.moveTo(x - s * 0.5, y + s * 0.3);
    g.arc(x, y + s * 0.3, s * 0.5, PI, 0);
  }
  g.stroke();
}

// ---------- Portail : une forme magique qui flotte dans les airs ----------

const portalVertex = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const portalFragment = `
  uniform float uTime; varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    float a = atan(p.y, p.x);
    float swirl = a + uTime * 1.1 - r * 5.0;
    float bands = sin(swirl * 3.0) * 0.5 + 0.5;
    float sparkle = sin(swirl * 9.0 + r * 20.0 - uTime * 3.0) * 0.5 + 0.5;
    vec3 col = mix(vec3(0.35, 0.1, 0.8), vec3(0.75, 0.4, 1.0), bands);
    col = mix(col, vec3(0.45, 1.0, 1.0), pow(sparkle * bands, 3.0));
    col += vec3(1.0) * pow(max(0.0, 1.0 - r * 1.6), 3.0);
    // bord qui se dissout en volutes : pas de contour net
    float edge = 1.0 - smoothstep(0.55 + 0.12 * sin(a * 5.0 + uTime * 2.0), 1.0, r);
    gl_FragColor = vec4(col * edge * 1.3, 1.0);
  }`;

export function buildPortal() {
  const g = new THREE.Group();
  const uniforms = { uTime: { value: 0 } };
  // Ovale additif (lumière pure, calque 1) : 1,2 m de haut environ
  const vortex = glowLayer(
    new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 1.3),
      new THREE.ShaderMaterial({ uniforms, vertexShader: portalVertex, fragmentShader: portalFragment, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
    ),
  );
  g.add(vortex);

  // Filaments de lumière qui tournent autour de l'ovale
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x9af4ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const rings = [0, 1].map((i) => {
    const ring = glowLayer(new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.006, 6, 64, PI * 1.3), ringMat));
    ring.scale.set(1, 1.3, 1);
    ring.rotation.z = i * PI;
    g.add(ring);
    return ring;
  });

  // Étincelles aspirées vers le centre
  const count = 140;
  const seeds = Array.from({ length: count }, () => ({ a: Math.random() * PI * 2, r: 0.3 + Math.random() * 0.8, speed: 0.3 + Math.random() * 0.6, phase: Math.random() }));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
  const sparks = glowLayer(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xc8b0ff, size: 0.022, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })));
  g.add(sparks);

  const light = new THREE.PointLight(0x9a6aff, 3, 4, 2);
  light.position.set(0, 0, 0.4);
  g.add(light);
  const baseY = { value: NaN };

  return {
    group: g,
    update: (t: number) => {
      if (Number.isNaN(baseY.value)) baseY.value = g.position.y;
      g.position.y = baseY.value + Math.sin(t * 0.9) * 0.05; // il ondule doucement dans les airs
      uniforms.uTime.value = t;
      rings[0].rotation.z = t * 0.8;
      rings[1].rotation.z = PI - t * 0.6;
      light.intensity = 3 + Math.sin(t * 1.7) * 1;
      const pos = geo.attributes.position as THREE.BufferAttribute;
      seeds.forEach((s, i) => {
        const k = (t * s.speed * 0.25 + s.phase) % 1; // 0 → 1 : de l'extérieur vers le centre
        const r = s.r * (1 - k);
        const a = s.a + k * 4;
        pos.setXYZ(i, Math.cos(a) * r * 0.8, Math.sin(a) * r, (1 - k) * 0.3);
      });
      pos.needsUpdate = true;
    },
  };
}

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ---------- Cercle de runes au sol ----------

export function buildRuneCircle(radius: number) {
  const tex = canvasTexture(1024, 1024, (g, w) => {
    const c = w / 2;
    g.strokeStyle = 'rgba(140,240,255,0.95)';
    g.lineWidth = 6;
    for (const r of [0.96, 0.86, 0.5]) {
      g.beginPath();
      g.arc(c, c, c * r, 0, PI * 2);
      g.stroke();
    }
    g.lineWidth = 4;
    // étoile à sept branches
    g.beginPath();
    for (let i = 0; i <= 7; i++) {
      const a = ((i * 3) / 7) * PI * 2 - PI / 2;
      g.lineTo(c + Math.cos(a) * c * 0.84, c + Math.sin(a) * c * 0.84);
    }
    g.stroke();
    const rand = seeded(9);
    g.lineWidth = 5;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * PI * 2;
      g.save();
      g.translate(c + Math.cos(a) * c * 0.91, c + Math.sin(a) * c * 0.91);
      g.rotate(a + PI / 2);
      drawRune(g, 0, 0, 16, rand);
      g.restore();
    }
  });
  const m = glowLayer(
    new THREE.Mesh(
      new THREE.PlaneGeometry(radius * 2, radius * 2),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    ),
  );
  m.rotation.x = -PI / 2;
  return {
    group: m,
    update: (t: number) => {
      m.rotation.z = t * 0.05;
      (m.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(t * 1.3) * 0.12;
    },
  };
}

// ---------- Bougies flottantes ----------

export function buildFloatingCandles(count: number, center: THREE.Vector3, radius: number) {
  const g = new THREE.Group();
  const candles = Array.from({ length: count }, (_, i) => {
    const c = buildCandle(0.14 + Math.random() * 0.08);
    const a = (i / count) * PI * 2 + Math.random() * 0.4;
    const r = radius * (0.5 + Math.random() * 0.5);
    c.group.position.set(center.x + Math.cos(a) * r, center.y + Math.random() * 0.5, center.z + Math.sin(a) * r);
    g.add(c.group);
    return { ...c, baseY: c.group.position.y, phase: Math.random() * 10 };
  });
  const light = new THREE.PointLight(0xffb860, 3, 6, 2);
  light.position.copy(center);
  g.add(light);
  return {
    group: g,
    update: (t: number) => {
      for (const c of candles) {
        c.group.position.y = c.baseY + Math.sin(t * 0.8 + c.phase) * 0.06;
        c.flame.scale.y = 2.2 * (1 + Math.sin(t * 15 + c.phase) * 0.12);
      }
      light.intensity = 3 + Math.sin(t * 9) * 0.25;
    },
  };
}

// ---------- Livres qui lévitent ----------

export function buildFlyingBooks(center: THREE.Vector3) {
  const g = new THREE.Group();
  g.position.copy(center);
  const pages = new THREE.MeshStandardMaterial({ color: 0xefe3c4, roughness: 0.9, side: THREE.DoubleSide });
  const books = [0, 1, 2].map((i) => {
    const book = new THREE.Group();
    const cover = new THREE.MeshStandardMaterial({ color: LEATHER[(i * 3) % LEATHER.length], roughness: 0.7, side: THREE.DoubleSide });
    const halves: THREE.Group[] = [];
    for (const s of [-1, 1]) {
      const half = new THREE.Group();
      half.add(mesh(new THREE.BoxGeometry(0.15, 0.006, 0.22), cover, s * 0.075, 0, 0));
      half.add(mesh(new THREE.BoxGeometry(0.14, 0.02, 0.2), pages, s * 0.072, 0.012, 0));
      book.add(half);
      halves.push(half);
    }
    g.add(book);
    return { book, halves, phase: i * ((PI * 2) / 3) };
  });
  return {
    group: g,
    update: (t: number) => {
      for (const b of books) {
        const a = t * 0.35 + b.phase;
        b.book.position.set(Math.cos(a) * 0.55, Math.sin(t * 0.9 + b.phase) * 0.12, Math.sin(a) * 0.55);
        b.book.rotation.set(0.3, -a, Math.sin(t + b.phase) * 0.15);
        const open = 0.35 + Math.sin(t * 3 + b.phase) * 0.12; // les pages battent comme des ailes
        b.halves[0].rotation.z = open;
        b.halves[1].rotation.z = -open;
      }
    },
  };
}

// ---------- Boule de cristal ----------

export function buildCrystalBall() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * PI * 2;
    const leg = mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.16, 8), brass, Math.cos(a) * 0.07, 0.07, Math.sin(a) * 0.07);
    leg.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
    g.add(leg);
  }
  g.add(mesh(new THREE.TorusGeometry(0.08, 0.01, 8, 32).rotateX(PI / 2), brass, 0, 0.15, 0));
  const uniforms = { uTime: { value: 0 } };
  const smoke = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 32, 24),
    new THREE.ShaderMaterial({
      uniforms,
      toneMapped: false,
      vertexShader: `varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uTime; varying vec3 vP;
        void main() {
          float s = sin(vP.y * 30.0 + uTime * 2.0 + sin(vP.x * 25.0 + uTime)) * sin(vP.z * 28.0 - uTime * 1.5);
          vec3 col = mix(vec3(0.15, 0.05, 0.35), vec3(0.6, 0.35, 1.0), s * 0.5 + 0.5);
          col = mix(col, vec3(0.4, 1.0, 0.95), pow(max(0.0, s), 4.0));
          gl_FragColor = vec4(col, 1.0);
        }`,
    }),
  );
  smoke.position.y = 0.24;
  g.add(smoke);
  const glass = new THREE.Mesh(
    new THREE.SphereGeometry(0.115, 32, 24),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 1, roughness: 0.02, thickness: 0.05, ior: 1.45, transparent: true, opacity: 0.35, clearcoat: 1 }),
  );
  glass.position.y = 0.24;
  g.add(glass);
  const light = new THREE.PointLight(0xa070ff, 1.5, 2.5, 2);
  light.position.y = 0.3;
  g.add(light);
  return {
    group: g,
    update: (t: number) => {
      uniforms.uTime.value = t;
      smoke.rotation.y = t * 0.4;
      light.intensity = 1.5 + Math.sin(t * 2.2) * 0.5;
    },
  };
}

// ---------- Herbes séchées suspendues aux poutres ----------

export function buildHerbBundle() {
  const g = new THREE.Group();
  const string = new THREE.MeshStandardMaterial({ color: 0x8a7050, roughness: 1 });
  g.add(mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.35, 4), string, 0, -0.175, 0));
  const colors = [0x6a7a3a, 0x8a7a4a, 0x5a6a30, 0x9a6a4a];
  for (let i = 0; i < 7; i++) {
    const stem = mesh(new THREE.ConeGeometry(0.03, 0.28, 6), new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 1 }), (Math.random() - 0.5) * 0.06, -0.48, (Math.random() - 0.5) * 0.06);
    stem.rotation.set((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4);
    g.add(stem);
  }
  return g;
}

/** Poussière magique dorée qui flotte dans toute la pièce. */
export function buildMagicDust(box: THREE.Box3, count: number) {
  const size = box.getSize(new THREE.Vector3());
  const base = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    base[i * 3] = box.min.x + Math.random() * size.x;
    base[i * 3 + 1] = box.min.y + Math.random() * size.y;
    base[i * 3 + 2] = box.min.z + Math.random() * size.z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(base.slice(), 3));
  const points = glowLayer(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffd98a, size: 0.018, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })));
  return {
    group: points,
    update: (t: number) => {
      const pos = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < count; i++) {
        pos.setXYZ(i, base[i * 3] + Math.sin(t * 0.3 + i) * 0.15, base[i * 3 + 1] + Math.sin(t * 0.5 + i * 1.3) * 0.2, base[i * 3 + 2] + Math.cos(t * 0.25 + i) * 0.15);
      }
      pos.needsUpdate = true;
      (points.material as THREE.PointsMaterial).opacity = 0.5 + Math.sin(t * 0.8) * 0.2;
    },
  };
}
