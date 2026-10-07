import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import type { Collider } from './room';

const WALK_SPEED = 3.2;
const RUN_SPEED = 6;
const RADIUS = 0.35;
const EYE_HEIGHT = 1.65;
const GRAVITY = 18;
const JUMP_SPEED = 5.8; // ≈ 90 cm : de quoi monter sur un coffre ou un bureau
const HEAD = 0.15; // du regard au sommet du crâne
const STEP = 0.22; // marche franchie sans sauter (les marches de l'escalier secret font 20 cm)

/** Joueur à la première personne. event.code = position physique : ZQSD en AZERTY = WASD en QWERTY. */
export class Player {
  readonly controls: PointerLockControls;
  /** État du mouvement, utilisé pour animer les bras. */
  moving = false;
  running = false;
  onGround = true;
  private keys = new Set<string>();
  private forward = new THREE.Vector3();
  private velocityY = 0;

  constructor(
    private camera: THREE.PerspectiveCamera,
    dom: HTMLElement,
    private colliders: Collider[],
  ) {
    camera.position.set(1.4, EYE_HEIGHT, 2.9);
    camera.lookAt(-0.6, 1.3, 0.6);
    this.controls = new PointerLockControls(camera, dom);
    // Chrome envoie parfois un déplacement de souris aberrant quand la souris est capturée : la vue « saute ».
    // On l'intercepte avant PointerLockControls (phase de capture) et on l'ignore.
    addEventListener(
      'mousemove',
      (e) => {
        if (this.controls.isLocked && (Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250)) e.stopImmediatePropagation();
      },
      { capture: true },
    );

    addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space' && this.controls.isLocked && this.onGround) {
        e.preventDefault();
        this.velocityY = JUMP_SPEED;
        this.onGround = false;
      }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    this.controls.addEventListener('unlock', () => this.keys.clear());
  }

  private pressed(...codes: string[]) {
    return codes.some((c) => this.keys.has(c)) ? 1 : 0;
  }

  /** Direction du regard projetée au sol (normalisée). */
  lookDirection(): THREE.Vector3 {
    this.camera.getWorldDirection(this.forward);
    this.forward.y = 0;
    return this.forward.normalize();
  }

  /** Hauteur des pieds au-dessus de la surface sous le joueur (0 quand il est posé). */
  get heightAboveGround() {
    const p = this.camera.position;
    return p.y - EYE_HEIGHT - this.groundAt(p.x, p.z, p.y - EYE_HEIGHT);
  }

  update(dt: number) {
    if (!this.controls.isLocked) return;
    const p = this.camera.position;
    let feet = p.y - EYE_HEIGHT;

    const f = this.pressed('KeyW', 'ArrowUp') - this.pressed('KeyS', 'ArrowDown');
    const r = this.pressed('KeyD', 'ArrowRight') - this.pressed('KeyA', 'ArrowLeft');
    this.moving = f !== 0 || r !== 0;
    this.running = this.moving && (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'));
    if (this.moving) {
      const step = ((this.running ? RUN_SPEED : WALK_SPEED) * dt) / Math.hypot(f, r);
      const dir = this.lookDirection();
      const dx = (dir.x * f - dir.z * r) * step;
      const dz = (dir.z * f + dir.x * r) * step;
      // Par petits pas (pas de traversée d'objet quand l'image saccade), un axe à la fois pour glisser le long des obstacles
      const steps = Math.ceil(Math.hypot(dx, dz) / 0.05);
      for (let k = 0; k < steps; k++) {
        if (!this.blocked(p.x + dx / steps, p.z, feet, p.x, p.z)) p.x += dx / steps;
        if (!this.blocked(p.x, p.z + dz / steps, feet, p.x, p.z)) p.z += dz / steps;
      }
    }

    // Gravité : on tombe jusqu'à la surface la plus haute sous nos pieds (sol, table, coffre…)
    const ground = this.groundAt(p.x, p.z, feet);
    if (feet > ground + 0.001 || this.velocityY > 0) {
      this.onGround = false;
      this.velocityY -= GRAVITY * dt;
      feet += this.velocityY * dt;
      if (feet <= ground) {
        feet = ground;
        this.velocityY = 0;
        this.onGround = true;
      }
    } else {
      feet = ground;
      this.onGround = true;
    }
    // plafonds bas (passage secret, escalier, salle au trésor) : on ne saute pas au travers
    const ceiling = this.ceilingAt(p.x, p.z);
    if (feet + EYE_HEIGHT + HEAD > ceiling) {
      feet = Math.max(ground, ceiling - EYE_HEIGHT - HEAD);
      this.velocityY = Math.min(0, this.velocityY);
    }
    p.y = feet + EYE_HEIGHT;
  }

  private ceilingAt(x: number, z: number) {
    let ceiling = Infinity;
    for (const c of this.colliders) if (c.ceil !== undefined && c.ceil < ceiling && this.overlaps(c, x, z)) ceiling = c.ceil;
    return ceiling;
  }

  private overlaps(c: Collider, x: number, z: number) {
    return x + RADIUS > c.minX && x - RADIUS < c.maxX && z + RADIUS > c.minZ && z - RADIUS < c.maxZ;
  }

  /**
   * Un obstacle bloque seulement si son dessus est plus haut que nos pieds (sinon on marche dessus).
   * Si l'on est déjà coincé dedans (en fromX, fromZ), on peut toujours en sortir.
   */
  private blocked(x: number, z: number, feet: number, fromX: number, fromZ: number) {
    return this.colliders.some((c) => c.top > feet + STEP && this.overlaps(c, x, z) && !this.overlaps(c, fromX, fromZ));
  }

  /** Sol sous le joueur : le plus haut dessus atteignable (sol du labo, marches, meubles…). */
  private groundAt(x: number, z: number, feet: number) {
    let ground = -50;
    for (const c of this.colliders) if (c.top <= feet + STEP && c.top > ground && this.overlaps(c, x, z)) ground = c.top;
    return ground;
  }
}
