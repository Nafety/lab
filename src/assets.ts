import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

/** Chargement des ressources avec suivi de progression (écran de chargement). */
export const manager = new THREE.LoadingManager();

const gltfLoader = new GLTFLoader(manager);
const texLoader = new THREE.TextureLoader(manager);
const models = new Map<string, Promise<THREE.Group>>();

/** Retourne une copie du modèle (géométries et matériaux partagés entre les copies). */
export async function loadModel(id: string): Promise<THREE.Group> {
  if (!models.has(id)) {
    models.set(
      id,
      gltfLoader.loadAsync(`assets/models/${id}/${id}.gltf`).then((g) => {
        g.scene.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        return g.scene;
      }),
    );
  }
  return (await models.get(id)!).clone(true);
}

export function loadTexture(path: string, srgb = true) {
  const tex = texLoader.load(path);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function loadImage(path: string): Promise<HTMLImageElement> {
  return new THREE.ImageLoader(manager).loadAsync(path);
}

/** Matériau PBR Poly Haven (couleur, normales, AO/rugosité/métal), répété repeatX × repeatY fois. */
export function pbrMaterial(id: string, repeatX = 1, repeatY = 1, extra: THREE.MeshStandardMaterialParameters = {}) {
  const base = `assets/textures/${id}`;
  const maps = {
    map: loadTexture(`${base}/diff.jpg`),
    normalMap: loadTexture(`${base}/nor.jpg`, false),
    arm: loadTexture(`${base}/arm.jpg`, false),
  };
  for (const t of Object.values(maps)) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX, repeatY);
  }
  return new THREE.MeshStandardMaterial({
    map: maps.map,
    normalMap: maps.normalMap,
    aoMap: maps.arm,
    roughnessMap: maps.arm,
    metalnessMap: maps.arm,
    ...extra,
  });
}

export function loadEnvironment(renderer: THREE.WebGLRenderer): Promise<THREE.Texture> {
  return new HDRLoader(manager).loadAsync('assets/hdri/vintage_measuring_lab.hdr').then((hdr) => {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromEquirectangular(hdr).texture;
    hdr.dispose();
    pmrem.dispose();
    return env;
  });
}
