import * as THREE from 'three';
import type { PlayerState } from './net';
import { canvasTexture } from './textures';

/** Les autres joueurs apparaissent en savants spectraux : robe à capuche flottante, yeux lumineux, nom. */

const robe = new THREE.MeshStandardMaterial({ color: 0x2a2f6a, roughness: 0.8, emissive: 0x1a1450, emissiveIntensity: 0.6 });
const eyes = new THREE.MeshBasicMaterial({ color: 0x9af4ff, toneMapped: false });

function nameLabel(name: string) {
  const tex = canvasTexture(256, 64, (g, w, h) => {
    g.fillStyle = 'rgba(20,14,40,0.7)';
    g.beginPath();
    g.roundRect(2, 2, w - 4, h - 4, 30);
    g.fill();
    g.fillStyle = '#e8dcff';
    g.font = '30px Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(name.slice(0, 16), w / 2, h / 2 + 2);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  s.scale.set(0.6, 0.15, 1);
  s.layers.set(1); // calque ignoré par l'occlusion ambiante (sinon un carré sombre apparaît autour)
  return s;
}

function buildAvatar(name: string) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.25, 20, 1, true), robe);
  body.position.y = 0.85;
  g.add(body);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 16), robe);
  hood.position.y = 1.55;
  hood.scale.set(1, 1.15, 1);
  g.add(hood);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), new THREE.MeshBasicMaterial({ color: 0x05040c }));
  face.position.set(0, 1.53, -0.06);
  g.add(face);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), eyes);
    eye.position.set(s * 0.045, 1.56, -0.17);
    g.add(eye);
  }
  const label = nameLabel(name);
  label.position.y = 1.95;
  g.add(label);
  return g;
}

export class Avatars {
  private avatars = new Map<string, { group: THREE.Group; name: string }>();

  constructor(private scene: THREE.Scene) {}

  update(players: Map<string, PlayerState>, dt: number, t: number) {
    // apparitions et départs
    for (const [id, p] of players) {
      let a = this.avatars.get(id);
      if (!a || a.name !== p.name) {
        if (a) this.scene.remove(a.group);
        a = { group: buildAvatar(p.name), name: p.name };
        a.group.position.set(p.p[0], 0, p.p[2]);
        this.scene.add(a.group);
        this.avatars.set(id, a);
      }
      // déplacement adouci vers la dernière position reçue
      const k = Math.min(1, dt * 10);
      const target = new THREE.Vector3(p.p[0], p.p[1] - 1.65 + Math.sin(t * 2 + id.length) * 0.05, p.p[2]);
      a.group.position.lerp(target, k);
      let dy = p.yaw - a.group.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      a.group.rotation.y += dy * k;
    }
    for (const [id, a] of this.avatars) {
      if (!players.has(id)) {
        this.scene.remove(a.group);
        this.avatars.delete(id);
      }
    }
  }
}
