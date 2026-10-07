import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Rotation d'une caméra placée en `pos` qui regarde `target`. */
export function lookQuat(pos: THREE.Vector3, target: THREE.Vector3) {
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(pos, target, UP));
}

interface Tween {
  fromPos: THREE.Vector3;
  fromQ: THREE.Quaternion;
  toPos: THREE.Vector3;
  toQ: THREE.Quaternion;
  t: number;
  duration: number;
  done: () => void;
}

/** Déplace la caméra en douceur vers une pose (position + orientation). */
export class CameraRig {
  private tween: Tween | null = null;

  constructor(private camera: THREE.Camera) {}

  get busy() {
    return this.tween !== null;
  }

  flyTo(pos: THREE.Vector3, quat: THREE.Quaternion, duration = 1.2): Promise<void> {
    this.tween?.done();
    return new Promise((done) => {
      this.tween = {
        fromPos: this.camera.position.clone(),
        fromQ: this.camera.quaternion.clone(),
        toPos: pos.clone(),
        toQ: quat.clone(),
        t: 0,
        duration,
        done,
      };
    });
  }

  lookFrom(pos: THREE.Vector3, target: THREE.Vector3, duration = 1.2) {
    return this.flyTo(pos, lookQuat(pos, target), duration);
  }

  update(dt: number) {
    const tw = this.tween;
    if (!tw) return;
    tw.t = Math.min(1, tw.t + dt / tw.duration);
    const k = ease(tw.t);
    this.camera.position.lerpVectors(tw.fromPos, tw.toPos, k);
    this.camera.quaternion.slerpQuaternions(tw.fromQ, tw.toQ, k);
    if (tw.t >= 1) {
      this.tween = null;
      tw.done();
    }
  }
}
