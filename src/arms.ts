import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { canvasTexture } from './textures';

/**
 * Bras d'explorateur-magicien, visibles en bas de l'écran.
 * Repère de la caméra : x à droite, y en haut, -z devant.
 */

// ---------- Matières ----------

/** Peau avec égratignures et taches de rousseur. */
function skinTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#d6a283';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '120,60,40' : '255,220,200'},${Math.random() * 0.12})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    for (let i = 0; i < 40; i++) {
      g.fillStyle = 'rgba(140,80,50,0.35)';
      g.beginPath();
      g.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 1.5, 0, Math.PI * 2);
      g.fill();
    }
    // égratignures : traits fins rouge foncé avec un halo rosé
    for (let i = 0; i < 5; i++) {
      const x = 30 + Math.random() * (w - 60);
      const y = 30 + Math.random() * (h - 60);
      const len = 30 + Math.random() * 60;
      const a = -0.6 + Math.random() * 1.2;
      for (const [width, color] of [[6, 'rgba(220,120,110,0.35)'], [1.6, 'rgba(130,20,20,0.85)']] as const) {
        g.strokeStyle = color;
        g.lineWidth = width;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + 6, y + Math.sin(a) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
        g.stroke();
      }
    }
  });
}

function leatherTexture() {
  return canvasTexture(256, 128, (g, w, h) => {
    g.fillStyle = '#5a3418';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '160,110,60'},${Math.random() * 0.2})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 1);
    }
    // coutures
    g.strokeStyle = 'rgba(230,200,150,0.8)';
    g.setLineDash([6, 5]);
    g.lineWidth = 2;
    for (const y of [10, h - 10]) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
  }, [3, 1]);
}

/** Cadran de boussole. */
function compassFace() {
  return canvasTexture(256, 256, (g, w) => {
    const c = w / 2;
    g.fillStyle = '#efe4c6';
    g.fillRect(0, 0, w, w);
    g.strokeStyle = '#3a2a18';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(c, c, c * 0.92, 0, Math.PI * 2);
    g.stroke();
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      const r1 = i % 8 === 0 ? 0.68 : 0.8;
      g.beginPath();
      g.moveTo(c + Math.cos(a) * c * r1, c + Math.sin(a) * c * r1);
      g.lineTo(c + Math.cos(a) * c * 0.9, c + Math.sin(a) * c * 0.9);
      g.stroke();
    }
    g.font = 'bold 34px Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    ['N', 'E', 'S', 'O'].forEach((t, k) => {
      const a = (k / 4) * Math.PI * 2 - Math.PI / 2;
      g.fillStyle = t === 'N' ? '#9a1a12' : '#3a2a18';
      g.fillText(t, c + Math.cos(a) * c * 0.52, c + Math.sin(a) * c * 0.52);
    });
  });
}

const skin = new THREE.MeshStandardMaterial({ map: skinTexture(), roughness: 0.6 });
const leather = new THREE.MeshStandardMaterial({ map: leatherTexture(), roughness: 0.7 });
const velvet = new THREE.MeshStandardMaterial({ color: 0x1f2a5c, roughness: 0.9 });
const gold = new THREE.MeshStandardMaterial({ color: 0xd9a84a, metalness: 1, roughness: 0.3 });
const bandage = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 1 });

// ---------- Construction ----------

const UP = new THREE.Vector3(0, 1, 0);

/** Orientation d'un objet dont -z suit `forward` et +y se rapproche de `up`. */
function basisQuat(forward: THREE.Vector3, up: THREE.Vector3) {
  const z = forward.clone().normalize().negate();
  const x = up.clone().cross(z).normalize();
  const y = z.clone().cross(x);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/** Cylindre posé d'un point à un autre. */
function segment(from: THREE.Vector3, to: THREE.Vector3, r1: number, r2: number, mat: THREE.Material) {
  const dir = to.clone().sub(from);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, dir.length(), 20), mat);
  m.position.copy(from).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(UP, dir.normalize());
  return m;
}

function capsule(radius: number, length: number, mat: THREE.Material) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 10), mat);
  m.rotation.x = -Math.PI / 2; // la capsule pointe vers -z
  m.position.z = -length / 2 - radius;
  return m;
}

/** Doigt en deux phalanges, légèrement replié vers la paume (-y). */
function finger(length: number, radius: number, curl: number) {
  const base = new THREE.Group();
  base.rotation.x = -curl;
  base.add(capsule(radius, length * 0.5, skin));
  const tip = new THREE.Group();
  tip.position.z = -length * 0.5 - radius * 2;
  tip.rotation.x = -curl * 1.3;
  tip.add(capsule(radius * 0.9, length * 0.35, skin));
  base.add(tip);
  return { base, tip };
}

interface ArmParts {
  group: THREE.Group;
  /** Bracelet de lumière dorée, révélé au Grand Maître du Labo. */
  aura: THREE.Mesh;
  needle?: THREE.Object3D;
  crystal?: THREE.Mesh;
}

/** Bras droit (side = 1) ou gauche (side = -1). */
function buildArm(side: number): ArmParts {
  const g = new THREE.Group();
  const elbow = new THREE.Vector3(side * 0.27, -0.33, -0.22);
  const wrist = new THREE.Vector3(side * 0.16, -0.21, -0.46);
  const forward = wrist.clone().sub(elbow).normalize();
  const along = (k: number) => elbow.clone().lerp(wrist, k);
  const armQuat = basisQuat(forward, UP);

  // Avant-bras (manche retroussée) et bourrelet de velours au coude
  g.add(segment(elbow, wrist, 0.047, 0.04, skin));
  g.add(segment(along(-0.15), along(0.1), 0.068, 0.062, velvet));
  const trim = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.006, 8, 24), gold);
  trim.position.copy(along(0.1));
  trim.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), forward);
  g.add(trim);

  // Brassard en cuir clouté
  g.add(segment(along(0.55), along(0.9), 0.05, 0.046, leather));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 8), gold);
    rivet.position.copy(along(0.6)).add(new THREE.Vector3(Math.cos(a) * 0.05, Math.sin(a) * 0.05, 0).applyQuaternion(armQuat));
    g.add(rivet);
  }

  // Main : doigts vers l'avant, dos de la main vers le haut, légèrement tournée vers l'intérieur
  const hand = new THREE.Group();
  hand.position.copy(wrist);
  const fingersDir = forward.clone().add(new THREE.Vector3(-side * 0.2, -0.25, -0.2)).normalize();
  const back = UP.clone().applyAxisAngle(fingersDir, -side * 0.45);
  hand.quaternion.copy(basisQuat(fingersDir, back));
  g.add(hand);

  const palm = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.028, 0.09, 3, 0.012), skin);
  palm.position.z = -0.045;
  hand.add(palm);
  [0.072, 0.08, 0.075, 0.062].forEach((len, i) => {
    const f = finger(len, 0.0088 - i * 0.0004, 0.35 + i * 0.1);
    f.base.position.set(side * (-0.028 + i * 0.0185), 0.002, -0.088);
    f.base.rotation.y = side * (i - 1.5) * 0.04;
    hand.add(f.base);
    // bagues sur l'index et l'annulaire de la main droite
    if (side === 1 && (i === 0 || i === 2)) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0105, 0.0028, 8, 18), gold);
      ring.position.z = -len * 0.18;
      f.base.add(ring);
    }
  });
  const thumb = finger(0.055, 0.0105, 0.1);
  thumb.base.position.set(side * -0.036, -0.004, -0.024);
  thumb.base.rotation.y = side * 0.5; // pointé vers l'avant et l'intérieur, le long de la paume
  hand.add(thumb.base);
  // base charnue du pouce, qui le relie à la paume
  const thenar = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 12), skin);
  thenar.scale.set(0.9, 0.65, 1.5);
  thenar.position.set(side * -0.028, -0.004, -0.03);
  hand.add(thenar);

  const aura = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.006, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffd060, toneMapped: false }));
  aura.position.copy(along(0.93));
  aura.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), forward);
  aura.visible = false;
  g.add(aura);
  const parts: ArmParts = { group: g, aura };

  if (side === -1) {
    // Boussole de poignet : l'aiguille indique vraiment le nord
    const compass = new THREE.Group();
    compass.position.copy(along(0.74));
    compass.quaternion.copy(armQuat);
    compass.translateY(0.052);
    g.add(compass);
    compass.add(new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.036, 0.012, 32), gold));
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.029, 32), new THREE.MeshStandardMaterial({ map: compassFace(), roughness: 0.5 }));
    face.rotation.x = -Math.PI / 2;
    face.position.y = 0.0065;
    compass.add(face);
    const needle = new THREE.Group();
    needle.position.y = 0.009;
    needle.add(new THREE.Mesh(new THREE.ConeGeometry(0.004, 0.024, 4).rotateX(-Math.PI / 2).translate(0, 0, -0.012), new THREE.MeshStandardMaterial({ color: 0xb01a12 })));
    needle.add(new THREE.Mesh(new THREE.ConeGeometry(0.004, 0.024, 4).rotateX(Math.PI / 2).translate(0, 0, 0.012), new THREE.MeshStandardMaterial({ color: 0xe8e8e8 })));
    compass.add(needle);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, roughness: 0, clearcoat: 1 }),
    );
    dome.scale.y = 0.35;
    dome.position.y = 0.006;
    compass.add(dome);
    parts.needle = needle;

    // Cristal lumineux serti sur le côté du brassard
    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.012),
      new THREE.MeshStandardMaterial({ color: 0x6ad8ff, emissive: 0x3ab8ff, emissiveIntensity: 2, roughness: 0.1 }),
    );
    crystal.scale.y = 1.6;
    crystal.position.copy(along(0.62)).add(new THREE.Vector3(side * 0.05, 0.01, 0).applyQuaternion(armQuat));
    g.add(crystal);
    parts.crystal = crystal;
  } else {
    // Pansement de fortune sur l'avant-bras droit
    g.add(segment(along(0.3), along(0.4), 0.049, 0.048, bandage));
  }
  return parts;
}

export class Arms {
  readonly group = new THREE.Group();
  private right: ArmParts;
  private left: ArmParts;
  private phase = 0;
  private reachT = 0;
  private visibility = 1;
  private lastYaw = 0;
  private lastPitch = 0;
  private sway = new THREE.Vector2();
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');

  constructor(private camera: THREE.Camera) {
    this.right = buildArm(1);
    this.left = buildArm(-1);
    this.group.add(this.right.group, this.left.group);
    camera.add(this.group);
  }

  /** Récompense du passage secret : bracelets de lumière dorée et cristal doré. */
  setGolden(on: boolean) {
    this.right.aura.visible = on;
    this.left.aura.visible = on;
    const crystal = this.left.crystal?.material as THREE.MeshStandardMaterial | undefined;
    if (crystal && on) {
      crystal.color.set(0xffd060);
      crystal.emissive.set(0xffa020);
    }
  }

  /** La main droite se tend vers l'objet. */
  reach() {
    this.reachT = 1;
  }

  update(dt: number, t: number, state: { visible: boolean; moving: boolean; running: boolean; height: number }) {
    this.visibility += ((state.visible ? 1 : 0) - this.visibility) * Math.min(1, dt * 10);
    this.group.visible = this.visibility > 0.02;
    if (!this.group.visible) return;

    // Balancement de la marche, respiration au repos
    if (state.moving) this.phase += dt * (state.running ? 13 : 8.5);
    const amp = state.moving ? (state.running ? 1.6 : 1) : 0;
    const bobX = Math.cos(this.phase) * 0.01 * amp;
    const bobY = Math.abs(Math.sin(this.phase)) * 0.012 * amp + Math.sin(t * 1.6) * 0.002;

    // Les bras « traînent » un peu quand on tourne la tête
    this.euler.setFromQuaternion(this.camera.quaternion);
    let dYaw = this.euler.y - this.lastYaw;
    if (dYaw > Math.PI) dYaw -= Math.PI * 2;
    if (dYaw < -Math.PI) dYaw += Math.PI * 2;
    const dPitch = this.euler.x - this.lastPitch;
    this.lastYaw = this.euler.y;
    this.lastPitch = this.euler.x;
    const k = Math.min(1, dt * 10);
    this.sway.x += (THREE.MathUtils.clamp(dYaw * 1.5, -0.04, 0.04) - this.sway.x) * k;
    this.sway.y += (THREE.MathUtils.clamp(dPitch * 1.5, -0.04, 0.04) - this.sway.y) * k;

    const jump = THREE.MathUtils.clamp(state.height * 0.08, 0, 0.04);
    this.group.position.set(bobX + this.sway.x, -bobY - this.sway.y + jump - (1 - this.visibility) * 0.4, 0);

    // Geste vers l'objet
    this.reachT = Math.max(0, this.reachT - dt * 3);
    const r = Math.sin(this.reachT * Math.PI);
    this.right.group.position.set(-r * 0.05, r * 0.07, -r * 0.14);

    // Boussole : l'aiguille compense la rotation de la tête pour viser le nord (-z du labo)
    if (this.left.needle) this.left.needle.rotation.y = -this.euler.y + Math.sin(t * 3) * 0.04;
    for (const a of [this.right.aura, this.left.aura]) if (a.visible) a.scale.setScalar(1 + Math.sin(t * 3) * 0.06);
    if (this.left.crystal) {
      (this.left.crystal.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.6 + Math.sin(t * 2.5) * 0.8;
      this.left.crystal.rotation.y = t * 0.8;
    }
  }
}
