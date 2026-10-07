import * as THREE from 'three';
import type { PlayerState } from './net';
import { canvasTexture } from './textures';

/**
 * Les autres joueurs : des savants explorateurs (chapeau, veste de toile, sacoche, foulard, bottes),
 * avec des bras visibles. Ceux qui ont reçu la bénédiction du grimoire portent des bracelets d'or lumineux.
 */

const skin = new THREE.MeshStandardMaterial({ color: 0xd9a77e, roughness: 0.7 });
const leather = new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.65 });
const darkLeather = new THREE.MeshStandardMaterial({ color: 0x2e1d10, roughness: 0.6 });
const brass = new THREE.MeshStandardMaterial({ color: 0xc8a050, metalness: 1, roughness: 0.35 });
const goldGlow = new THREE.MeshStandardMaterial({ color: 0xffd060, emissive: 0xffb020, emissiveIntensity: 2, metalness: 0.8, roughness: 0.3 });
const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1008 });
const haloMat = new THREE.SpriteMaterial({
  map: canvasTexture(64, 64, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(255,220,120,0.9)');
    r.addColorStop(1, 'rgba(255,180,40,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, w, w);
  }),
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  transparent: true,
});

// tenues variées, choisies d'après l'identifiant du joueur
const OUTFITS = [
  { jacket: 0xb09a6a, shirt: 0xe8dcc0, pants: 0x6a5a3a, hat: 0x6a4a2a, scarf: 0x8e2a1a },
  { jacket: 0x6a6a3e, shirt: 0xd8d0b0, pants: 0x4a3e2a, hat: 0x3a2a1a, scarf: 0x2a4a6a },
  { jacket: 0x8a5a3a, shirt: 0xf0e6cc, pants: 0x3e3a30, hat: 0xc8b48a, scarf: 0x6a2a5a },
  { jacket: 0xc8b48a, shirt: 0xe0d0b0, pants: 0x5a4a32, hat: 0x5a3a20, scarf: 0x2a5a3a },
];

function nameLabel(name: string) {
  const tex = canvasTexture(256, 64, (g, w, h) => {
    g.fillStyle = 'rgba(30,20,10,0.7)';
    g.beginPath();
    g.roundRect(2, 2, w - 4, h - 4, 30);
    g.fill();
    g.fillStyle = '#f0e2c0';
    g.font = '30px Alegreya, Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(name.slice(0, 16), w / 2, h / 2 + 2);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  s.scale.set(0.6, 0.15, 1);
  s.layers.set(1); // calque ignoré par l'occlusion ambiante (sinon un carré sombre apparaît autour)
  return s;
}

const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
};

/** Un bras pendant depuis l'épaule (le groupe pivote à l'épaule) : manche retroussée, avant-bras, brassard, main. */
function buildArm(side: number, jacket: THREE.Material, golden: THREE.Object3D[]) {
  const arm = new THREE.Group();
  arm.add(mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.3, 10), jacket, 0, -0.15, 0));
  arm.add(mesh(new THREE.TorusGeometry(0.052, 0.018, 6, 12), jacket, 0, -0.3, 0).rotateX(Math.PI / 2)); // revers de manche
  arm.add(mesh(new THREE.CylinderGeometry(0.042, 0.036, 0.26, 10), skin, 0, -0.43, 0));
  arm.add(mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.08, 10), leather, 0, -0.5, 0)); // brassard de cuir
  const hand = mesh(new THREE.SphereGeometry(0.045, 10, 8), skin, 0, -0.6, 0);
  hand.scale.set(0.8, 1.1, 0.6);
  arm.add(hand);
  if (side < 0) {
    // boussole au poignet gauche, comme les bras du joueur
    arm.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 14), brass, 0, -0.5, -0.045).rotateX(Math.PI / 2));
  }
  // bracelets d'or de la bénédiction et leur halo (affichés seulement si le joueur l'a reçue)
  const blessing = new THREE.Group();
  for (const y of [-0.545, -0.575]) blessing.add(mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 18), goldGlow, 0, y, 0).rotateX(Math.PI / 2));
  const halo = new THREE.Sprite(haloMat);
  halo.scale.set(0.22, 0.22, 1);
  halo.position.y = -0.56;
  halo.layers.set(1);
  blessing.add(halo);
  blessing.visible = false;
  arm.add(blessing);
  golden.push(blessing);
  return arm;
}

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

interface Avatar {
  group: THREE.Group;
  name: string;
  legs: THREE.Group[];
  arms: THREE.Group[];
  golden: THREE.Object3D[];
  phase: number;
  last: THREE.Vector3;
}

function buildAvatar(id: string, name: string): Avatar {
  const o = OUTFITS[hash(id) % OUTFITS.length];
  const jacket = new THREE.MeshStandardMaterial({ color: o.jacket, roughness: 0.85 });
  const shirt = new THREE.MeshStandardMaterial({ color: o.shirt, roughness: 0.9 });
  const pants = new THREE.MeshStandardMaterial({ color: o.pants, roughness: 0.9 });
  const hatMat = new THREE.MeshStandardMaterial({ color: o.hat, roughness: 0.8 });
  const scarf = new THREE.MeshStandardMaterial({ color: o.scarf, roughness: 0.9 });
  const g = new THREE.Group();
  const golden: THREE.Object3D[] = [];

  // jambes : pantalon de toile et bottes, pivot à la hanche
  const legs = [-1, 1].map((s) => {
    const leg = new THREE.Group();
    leg.position.set(s * 0.09, 0.82, 0);
    leg.add(mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.5, 10), pants, 0, -0.25, 0));
    leg.add(mesh(new THREE.CylinderGeometry(0.068, 0.072, 0.3, 10), darkLeather, 0, -0.62, 0));
    leg.add(mesh(new THREE.BoxGeometry(0.11, 0.07, 0.2), darkLeather, 0, -0.785, -0.04));
    g.add(leg);
    return leg;
  });

  // buste : chemise, veste ouverte, ceinture, bretelle et sacoche
  g.add(mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.55, 14), shirt, 0, 1.07, 0));
  const vest = mesh(new THREE.CylinderGeometry(0.185, 0.17, 0.5, 14, 1, true, Math.PI * 0.15, Math.PI * 1.7), jacket, 0, 1.08, 0);
  vest.rotation.y = Math.PI; // ouverture tournée vers le devant (-z)
  (vest.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  g.add(vest);
  g.add(mesh(new THREE.CylinderGeometry(0.162, 0.162, 0.05, 14), leather, 0, 0.84, 0));
  g.add(mesh(new THREE.BoxGeometry(0.04, 0.03, 0.02), brass, 0, 0.84, -0.165));
  const strap = mesh(new THREE.BoxGeometry(0.035, 0.62, 0.012), leather, 0, 1.06, -0.19);
  strap.rotation.z = 0.6;
  g.add(strap);
  g.add(mesh(new THREE.BoxGeometry(0.22, 0.17, 0.08), leather, 0.17, 0.82, 0.02)); // sacoche sur la hanche
  // foulard noué au cou
  g.add(mesh(new THREE.TorusGeometry(0.075, 0.03, 8, 16), scarf, 0, 1.37, 0).rotateX(Math.PI / 2));
  const knot = mesh(new THREE.ConeGeometry(0.04, 0.1, 8), scarf, 0.03, 1.3, -0.08);
  knot.rotation.x = Math.PI;
  g.add(knot);

  // épaules arrondies
  for (const s of [-1, 1]) g.add(mesh(new THREE.SphereGeometry(0.075, 12, 10), jacket, s * 0.18, 1.3, 0));
  // tête : visage, yeux, nez, chapeau à large bord
  g.add(mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 10), skin, 0, 1.4, 0));
  const head = mesh(new THREE.SphereGeometry(0.11, 18, 14), skin, 0, 1.53, 0);
  head.scale.set(0.95, 1.08, 1);
  g.add(head);
  for (const s of [-1, 1]) g.add(mesh(new THREE.SphereGeometry(0.014, 8, 6), eyeMat, s * 0.038, 1.55, -0.098));
  g.add(mesh(new THREE.SphereGeometry(0.02, 8, 6), skin, 0, 1.525, -0.108)); // nez
  const hat = new THREE.Group();
  hat.position.set(0, 1.62, 0);
  hat.add(mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.012, 24), hatMat));
  hat.add(mesh(new THREE.CylinderGeometry(0.1, 0.115, 0.12, 18), hatMat, 0, 0.06, 0));
  hat.add(mesh(new THREE.CylinderGeometry(0.117, 0.117, 0.025, 18), darkLeather, 0, 0.02, 0)); // ruban
  hat.rotation.x = -0.08;
  g.add(hat);

  // bras, pivot à l'épaule
  const arms = [-1, 1].map((s) => {
    const arm = buildArm(s, jacket, golden);
    arm.position.set(s * 0.215, 1.3, 0);
    arm.rotation.z = s * 0.08;
    g.add(arm);
    return arm;
  });

  const label = nameLabel(name);
  label.position.y = 1.98;
  g.add(label);
  return { group: g, name, legs, arms, golden, phase: 0, last: new THREE.Vector3() };
}

export class Avatars {
  private avatars = new Map<string, Avatar>();

  constructor(private scene: THREE.Scene) {}

  update(players: Map<string, PlayerState>, dt: number, t: number) {
    // apparitions et départs
    for (const [id, p] of players) {
      let a = this.avatars.get(id);
      if (!a || a.name !== p.name) {
        if (a) this.scene.remove(a.group);
        a = buildAvatar(id, p.name);
        a.group.position.set(p.p[0], p.p[1] - 1.65, p.p[2]);
        a.last.copy(a.group.position);
        this.scene.add(a.group);
        this.avatars.set(id, a);
      }
      for (const r of a.golden) r.visible = !!p.gold;
      // déplacement adouci vers la dernière position reçue
      const k = Math.min(1, dt * 10);
      a.group.position.lerp(new THREE.Vector3(p.p[0], p.p[1] - 1.65, p.p[2]), k);
      let dy = p.yaw - a.group.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      a.group.rotation.y += dy * k;
      // marche : jambes et bras se balancent selon la vitesse ; à l'arrêt, une légère respiration
      const speed = dt > 0 ? Math.hypot(a.group.position.x - a.last.x, a.group.position.z - a.last.z) / dt : 0;
      a.last.copy(a.group.position);
      const swing = Math.min(1, speed / 3);
      a.phase += dt * (4 + speed * 2.5);
      const sw = Math.sin(a.phase) * 0.6 * swing;
      a.legs[0].rotation.x = sw;
      a.legs[1].rotation.x = -sw;
      a.arms[0].rotation.x = -sw * 0.8;
      a.arms[1].rotation.x = sw * 0.8 + Math.sin(t * 1.6) * 0.03;
    }
    for (const [id, a] of this.avatars) {
      if (!players.has(id)) {
        this.scene.remove(a.group);
        this.avatars.delete(id);
      }
    }
  }
}
