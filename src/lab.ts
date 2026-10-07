import * as THREE from 'three';
import { loadImage, loadModel } from './assets';
import { buildRoom, colliderOf, ROOM, WINDOWS, type Collider } from './room';
import {
  buildAntiqueGlobe,
  buildBlackboard,
  buildBookPile,
  buildCandle,
  buildDeskExtras,
  buildDeskItems,
  buildGlassware,
  buildJarShelf,
  buildLadder,
  buildLibrary,
  buildOrrery,
  buildPedestal,
  buildRoundTable,
  buildTelescope,
  framed,
  GLOBE_CENTER_Y,
  starCharts,
} from './props';
import { buildCrystalBall, buildFloatingCandles, buildFlyingBooks, buildHerbBundle, buildMagicDust, buildPortal, buildRuneCircle } from './magic';
import { antiqueMapTexture, periodicTableTexture, vintagePostcardTexture } from './textures';
import { buildBeam, buildBlackTome, buildCabinetLock, buildDeclinationCircle, buildPlaque, buildSecretRoom, chestGridTexture, inscriptionTexture } from './secret';

const HW = ROOM.w / 2;
const HD = ROOM.d / 2;
const PI = Math.PI;
const UP = new THREE.Vector3(0, 1, 0);
const DOOR_OPEN = -1.52; // angle de la vitrine ouverte (elle pivote vers la pièce)

/** Point d'interaction d'un atelier et pose de caméra pour y jouer (objet à gauche, panneau à droite). */
export interface Anchor {
  focus: THREE.Vector2;
  view: { pos: THREE.Vector3; target: THREE.Vector3 };
  /** objets qu'il faut viser (centre de l'écran) pour utiliser l'atelier */
  objects: THREE.Object3D[];
}
export type AnchorId = keyof LabRefs['anchors'];

/** Tout ce dont les ateliers ont besoin pour leurs animations. */
/** Un objet du décor qu'on vise pour agir : soit une action immédiate, soit un atelier. */
export interface Hotspot {
  object: THREE.Object3D;
  action: string;
  use?: () => void;
  station?: 'metals' | 'tome';
}

export interface LabRefs {
  globe: { tilt: THREE.Group; earth: THREE.Mesh; center: THREE.Vector3 };
  telescope: { eyepiece: THREE.Vector3; dir: THREE.Vector3; /** tournée vers la fenêtre (sinon l'atelier est inutilisable) */ towardSky: () => boolean };
  /** Livres de la bibliothèque (tous interactifs) et la copie animée du livre pris. */
  library: { books: THREE.InstancedMesh[]; proxy: THREE.Mesh; selected: { mesh: THREE.InstancedMesh; index: number } | null };
  /** Couvercle du coffre (pivot sur la charnière) et sa lueur intérieure. */
  chest: { lid: THREE.Group; glow: THREE.PointLight; center: THREE.Vector3 };
  anchors: Record<'globe' | 'telescope' | 'chemistry' | 'bureau' | 'chest' | 'clock' | 'portal' | 'bust' | 'lock' | 'tome' | 'grimoire', Anchor>;
  /** Le passage secret : ouvert ou non, et comment l'ouvrir. */
  secret: { isOpen: () => boolean; open: () => void; watch: { pos: THREE.Vector3; target: THREE.Vector3 } };
  /** Petits mécanismes cachés, visés au centre de l'écran : bouton de la pendule, manivelle de la lunette, livre des métaux. */
  hotspots: Hotspot[];
}

/**
 * Caméra placée devant un objet (à `dist` mètres dans la direction `facing`, à hauteur `height`),
 * qui vise un peu à droite de l'objet pour le laisser à gauche de l'écran.
 */
function viewFor(object: THREE.Vector3, facing: THREE.Vector3, dist: number, height: number) {
  const pos = object.clone().addScaledVector(facing, dist).setY(height);
  const right = object.clone().sub(pos).normalize().cross(UP).normalize();
  return { pos, target: object.clone().addScaledVector(right, dist * 0.55) };
}

export async function buildLab(scene: THREE.Scene) {
  const room = buildRoom(scene);
  const colliders: Collider[] = [...room.colliders];
  const updates: ((t: number) => void)[] = [room.update];

  /** Ajoute un objet à la scène, avec ou sans collision. */
  const add = (obj: THREE.Object3D, x: number, y: number, z: number, rotY = 0, collide = false, pad = 0) => {
    obj.position.set(x, y, z);
    obj.rotation.y = rotY;
    scene.add(obj);
    if (collide) {
      obj.updateMatrixWorld(true);
      colliders.push(colliderOf(obj, pad));
    }
    return obj;
  };

  const model = async (id: string, x: number, y: number, z: number, rotY = 0, scale: number | [number, number, number] = 1, collide = false) => {
    const m = await loadModel(id);
    if (Array.isArray(scale)) m.scale.set(...scale);
    else m.scale.setScalar(scale);
    return add(m, x, y, z, rotY, collide);
  };

  const animate = <T extends { group: THREE.Object3D; update: (t: number) => void }>(o: T, x: number, y: number, z: number, rotY = 0) => {
    add(o.group, x, y, z, rotY);
    updates.push(o.update);
    return o;
  };

  // ---------- Centre : le globe sous le lustre et les bougies flottantes ----------
  const globePos = new THREE.Vector3(-0.6, 0, 0.6);
  const mapTex = antiqueMapTexture(await loadImage('textures/earth.jpg'));
  const globe = buildAntiqueGlobe(mapTex);
  add(globe.group, globePos.x, 0, globePos.z, 0, true, 0.05);
  await model('Chandelier_01', globePos.x, ROOM.h, globePos.z, 0, 1.2);
  const chandelierLight = new THREE.PointLight(0xffc98a, 32, 13, 2);
  chandelierLight.position.set(globePos.x, ROOM.h - 0.7, globePos.z);
  scene.add(chandelierLight);
  const candles = buildFloatingCandles(9, new THREE.Vector3(globePos.x, 2.5, globePos.z), 1.5);
  scene.add(candles.group);
  updates.push(candles.update);

  // ---------- Mur nord : bibliothèque, buste, portail magique, cabinet ----------
  const library = buildLibrary(1.6, 2);
  add(library.group, -2.2, 0, -HD + 0.235, 0, true);
  add(buildLadder(3.0), -1.15, 0, -HD + 0.47, 0, true);
  const decorIds = ['antique_ceramic_vase_01', 'seadogs_compass', 'mantel_clock_01'];
  for (let i = 0; i < Math.min(decorIds.length, library.decorSpots.length); i++) {
    const p = library.decorSpots[i].clone().applyMatrix4(library.group.matrixWorld);
    await model(decorIds[i], p.x, p.y, p.z, 0, decorIds[i] === 'antique_ceramic_vase_01' ? 0.7 : 1);
  }
  animate(buildFlyingBooks(new THREE.Vector3()), -2.2, 2.55, -2.8);
  const pedestal = add(buildPedestal(), 0.15, 0, -HD + 0.45, 0, true);
  const bust = await model('marble_bust_01', 0.15, 1.06, -HD + 0.45, -0.4, 1.1);
  const plaquePos = new THREE.Vector3(0.15, 0.62, -HD + 0.45 + 0.13);
  const plaque = add(buildPlaque(['Quatre astres veillent sur le passage.']), plaquePos.x, plaquePos.y, plaquePos.z);

  // Portail : une simple forme magique qui flotte dans les airs, au-dessus d'un cercle de runes
  const portalPos = new THREE.Vector3(1.65, 1.55, -HD + 0.95);
  const portal = animate(buildPortal(), portalPos.x, portalPos.y, portalPos.z);
  const runes = animate(buildRuneCircle(0.8), portalPos.x, 0.012, portalPos.z + 0.1);

  // Coffre du Cryptogramme : au mur sud, sous le tableau, à côté de la pendule
  const chest = await model('treasure_chest', 2.75, 0, HD - 0.65, PI, 1, true);
  // Couvercle articulé (atelier Cryptogramme) : rattaché à une charnière placée sur son bord arrière
  chest.updateMatrixWorld(true);
  const lid = chest.getObjectByName('treasure_chest_lid')!;
  const lidBox = new THREE.Box3().setFromObject(lid);
  const chestLid = new THREE.Group();
  chestLid.position.copy(chest.worldToLocal(new THREE.Vector3((lidBox.min.x + lidBox.max.x) / 2, lidBox.min.y, lidBox.max.z)));
  chest.add(chestLid);
  chestLid.attach(lid);
  const chestGlow = new THREE.PointLight(0xffc060, 0, 2.5, 2);
  chestGlow.position.set(0, 0.5, 0);
  chest.add(chestGlow);
  // un parchemin dort au fond du coffre : on ne le voit que couvercle ouvert
  // Il repose tout au fond : hauteur du fond intérieur mesurée par un rayon (couvercle exclu)
  const chestMid = new THREE.Vector3(chest.position.x, lidBox.min.y - 0.01, (lidBox.min.z + lidBox.max.z) / 2);
  const bottomHit = new THREE.Raycaster(chestMid, new THREE.Vector3(0, -1, 0)).intersectObject(chest, true).find((h) => !chestLid.getObjectById(h.object.id));
  const grid = new THREE.Mesh(
    new THREE.PlaneGeometry((lidBox.max.x - lidBox.min.x) * 0.62, (lidBox.max.z - lidBox.min.z) * 0.55),
    new THREE.MeshStandardMaterial({ map: chestGridTexture(), color: 0x857455, roughness: 1 }), // vieilli, terne
  );
  grid.position.set(chestMid.x, (bottomHit ? bottomHit.point.y : 0.08) + 0.003, chestMid.z + 0.05); // contre la paroi du fond
  grid.rotation.set(-PI / 2, 0, PI + 0.12); // lisible depuis la pièce (le coffre est dos au mur sud), un peu de travers
  scene.add(grid);

  const gothic = await model('GothicCabinet_01', 4.5, 0, -HD + 0.48, 0, 1, true);
  // Sa porte du haut à droite est fermée ; un cristal y est serti. Le rayon de la lunette l'ouvre.
  const gothicDoor = gothic.getObjectByName('GothicCabinet_01_door2')!;
  gothicDoor.rotation.set(0, 0, 0);
  const crystalMat = new THREE.MeshStandardMaterial({ color: 0x9ad8ff, emissive: 0x6ac0ff, emissiveIntensity: 0.5, roughness: 0.05, metalness: 0.1 });
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.045), crystalMat);
  crystal.scale.z = 0.6;
  crystal.position.set(-0.36, 0.12, 0.04);
  gothicDoor.add(crystal);
  const setting = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.007, 8, 32), new THREE.MeshStandardMaterial({ color: 0xc8a050, metalness: 1, roughness: 0.3 }));
  setting.position.copy(crystal.position).setZ(0.025);
  gothicDoor.add(setting);
  const auText = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), new THREE.MeshStandardMaterial({ map: inscriptionTexture('IV · Au'), transparent: true, metalness: 0.6, roughness: 0.4 }));
  auText.position.set(4.5 + 0.355, 1.75, -HD + 0.48 - 0.3); // contre le fond du meuble
  scene.add(auText);
  gothic.updateMatrixWorld(true);
  const crystalPos = crystal.getWorldPosition(new THREE.Vector3());
  await model('antique_ceramic_vase_01', 4.5, 2.36, -HD + 0.45);
  const pile = add(buildBookPile(5, 3), -4.0, 0, -3.55, 0.3, true);
  // le livre noir, posé tout en haut de la pile
  const pileTop = new THREE.Box3().setFromObject(pile).max.y;
  const tomePos = new THREE.Vector3(-4.0, pileTop + 0.0225, -3.55);
  const tome = add(buildBlackTome(), tomePos.x, tomePos.y, tomePos.z, 0.9);
  add(buildBookPile(3, 9), 0.75, 0, -3.6, -0.2, true);

  // ---------- Mur ouest : lunette près de la fenêtre, planétaire, carte du ciel ----------
  const scopeDir = new THREE.Vector3(-1, 0.55, -0.15).normalize();
  const telescope = buildTelescope(scopeDir);
  add(telescope.group, -4.45, 0, -1.25, 0, true, -0.1);
  // Manivelle sur le fût : elle fait pivoter la lunette d'un seizième de tour
  const crank = new THREE.Group();
  crank.add(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.09, 8), new THREE.MeshStandardMaterial({ color: 0xc8a050, metalness: 1, roughness: 0.3 })).rotateZ(PI / 2).translateY(-0.045));
  crank.add(new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: 0.6 })).translateX(0.09));
  crank.position.set(0.05, 0.55, 0);
  telescope.group.add(crank);
  const crankHit = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.1), new THREE.MeshBasicMaterial({ visible: false }));
  crankHit.position.set(0.08, 0.55, 0);
  telescope.group.add(crankHit);
  // cercle de déclinaison, contre la fourche
  telescope.group.add(buildDeclinationCircle().translateY(1.55).translateZ(0.125));
  const eyepiece = telescope.eyepiece.clone().add(telescope.group.position);
  add(buildRoundTable(0.3, 0.7), -4.85, 0, -3.3, 0, true);
  animate(buildOrrery(), -4.85, 0.72, -3.3);
  add(framed(starCharts()[0], 0.5, 0.68), -HW + 0.01, 2.2, 0, PI / 2);
  await model('potted_plant_02', -5.0, 0, 0, 0, 0.9, true);

  // ---------- Coin sud-ouest : le bureau du détective ----------
  const deskPos = new THREE.Vector3(-3.9, 0, HD - 0.55);
  const deskTop = 0.8;
  const desk = await model('wooden_table_02', deskPos.x, 0, deskPos.z, PI, [1.5, 1, 1.4], true);
  const deskItems = add(buildDeskItems(), deskPos.x, deskTop, deskPos.z, PI);
  await model('WoodenChair_01', deskPos.x, 0, deskPos.z - 0.95, 0, 0.8, true);
  await model('vintage_oil_lamp', deskPos.x - 0.7, deskTop, deskPos.z + 0.3, 0, 0.8);
  await model('magnifying_glass_01', deskPos.x + 0.55, deskTop, deskPos.z - 0.1, PI / 2).then((m) => (m.rotation.x = -PI / 2));
  const oilLight = new THREE.PointLight(0xffb060, 4, 5, 2);
  oilLight.position.set(deskPos.x - 0.7, 1.35, deskPos.z + 0.3);
  scene.add(oilLight);
  add(buildBlackboard(), deskPos.x, 2.1, HD - 0.01, PI);

  const extras = buildDeskExtras();
  add(extras.hourglass, deskPos.x - 0.2, deskTop, deskPos.z + 0.3);
  add(extras.letters, deskPos.x - 0.45, deskTop, deskPos.z - 0.33, 0.3);
  await model('stationery_supplies', deskPos.x + 0.68, deskTop + 0.07, deskPos.z + 0.32, PI);
  await model('round_spectacles', deskPos.x + 0.15, deskTop + 0.02, deskPos.z - 0.1, 2.4);
  await model('vintage_pocket_watch', deskPos.x + 0.35, deskTop + 0.006, deskPos.z - 0.28, 0).then((m) => (m.rotation.x = -PI / 2));
  const candlestick = await model('wooden_candlestick', deskPos.x + 0.35, deskTop, deskPos.z + 0.34);
  const wick = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffc860 }));
  wick.scale.set(1, 2.3, 1);
  wick.position.set(0, 0.235, 0);
  candlestick.add(wick);
  await model('ClassicNightstand_01', -5.15, 0, HD - 0.24, PI, 1, true);
  await model('Lantern_01', -5.05, 0.7, HD - 0.24, 0.4);
  add(buildBookPile(3, 33), -5.25, 0.7, HD - 0.26, 0.2);
  await model('painted_wooden_shelves', -5.15, 1.2, HD - 0.005, PI);
  await model('wicker_basket_01', -2.75, 0, deskPos.z - 0.2, 0.5, 1, true);
  add(extras.basketPapers, -2.75, 0.05, deskPos.z - 0.2);
  add(extras.floorPaper, -2.5, 0.03, deskPos.z - 0.6);

  // ---------- Mur sud : carte, valises, tableau ----------
  add(framed(mapTex, 1.5, 0.75, false), -1.75, 2.1, HD - 0.01, PI);
  await model('vintage_suitcase', 0.45, 0, HD - 0.14, PI, 1, true);
  // Cartes postales anciennes épinglées au mur, un peu de travers
  const pin = new THREE.MeshStandardMaterial({ color: 0x8e2a1a, roughness: 0.4 });
  for (let i = 0; i < 6; i++) {
    const card = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.1), new THREE.MeshStandardMaterial({ map: vintagePostcardTexture(i), roughness: 0.85 }));
    card.position.set(1.22 - (i % 3) * 0.19, 1.62 - Math.floor(i / 3) * 0.14, HD - 0.004 - i * 0.0004);
    card.rotation.set(0, PI, ((i * 37) % 11 - 5) * 0.02);
    scene.add(card);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), pin);
    head.position.set(card.position.x, card.position.y + 0.04, HD - 0.008);
    scene.add(head);
  }
  await model('fancy_picture_frame_02', 2.9, 2.1, HD - 0.01, PI, 1.5);

  // ---------- Coin sud-est : pendule, fauteuil, guéridon ----------
  const clockPos = new THREE.Vector3(3.95, 0, HD - 0.35); // un peu à gauche : on peut passer entre elle et la vitrine pour atteindre la serrure
  const clock = await model('vintage_grandfather_clock_01', clockPos.x, 0, clockPos.z, PI, 1, true);
  // Dans la vitrine noire de la pendule, une inscription invisible tant que l'intérieur n'est pas éclairé
  const clockBox = new THREE.Box3().setFromObject(clock);
  const clockCx = (clockBox.min.x + clockBox.max.x) / 2;
  // la vitre noire : on mesure où elle se trouve, l'inscription s'y allume (lueur additive, invisible éteinte)
  const glassMats: THREE.MeshStandardMaterial[] = [];
  clock.traverse((o) => {
    const mats = (o as THREE.Mesh).material;
    for (const m of Array.isArray(mats) ? mats : mats ? [mats] : []) if (m.name.includes('glass')) glassMats.push(m as THREE.MeshStandardMaterial);
  });
  const clockHits = new THREE.Raycaster(new THREE.Vector3(clockCx, 1.8, clockBox.min.z - 0.5), new THREE.Vector3(0, 0, 1)).intersectObject(clock, true);
  const glassHit = clockHits.find((h) => glassMats.includes((Array.isArray((h.object as THREE.Mesh).material) ? ((h.object as THREE.Mesh).material as THREE.Material[])[h.face?.materialIndex ?? 0] : (h.object as THREE.Mesh).material) as THREE.MeshStandardMaterial));
  const agMat = new THREE.MeshBasicMaterial({ map: inscriptionTexture('III · Ag'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const agText = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.13), agMat);
  const glassZ = glassHit ? glassHit.point.z : clockBox.min.z + 0.03;
  // Pas de cadran : un fond noir le masque, l'inscription est posée au fond, contre ce fond
  const dialHit = clockHits.find((h) => h !== glassHit && h.point.z > glassZ + 0.005);
  const backZ = (dialHit ? dialHit.point.z : glassZ + 0.03) - 0.002;
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.56), new THREE.MeshStandardMaterial({ color: 0x0b0806, roughness: 1, envMapIntensity: 0 }));
  backdrop.position.set(clockCx, 1.8, backZ);
  backdrop.rotation.y = PI;
  scene.add(backdrop);
  for (const n of ['vintage_grandfather_clock_01_minute_hand', 'vintage_grandfather_clock_01_houd_hand']) clock.getObjectByName(n)!.visible = false; // ni cadran ni aiguilles
  agText.position.set(clockCx, 1.8, backZ - 0.001);
  // la vitre reste noire, juste assez translucide pour laisser voir l'intérieur quand il s'éclaire
  for (const m of glassMats) Object.assign(m, { transparent: true, opacity: 0.6, depthWrite: false });
  const clockLight = new THREE.PointLight(0xffa850, 0, 0.35, 2);
  clockLight.position.set(clockCx, 2.0, backZ - 0.012);
  scene.add(clockLight);
  agText.rotation.y = PI;
  agText.layers.set(1);
  scene.add(agText);
  // le bouton : un minuscule rivet de laiton sur le flanc gauche (côté coffre), près de l'avant
  const button = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.008, 12), new THREE.MeshStandardMaterial({ color: 0xb08a40, metalness: 1, roughness: 0.4 }));
  button.rotation.z = PI / 2;
  // posé sur la vraie surface du flanc (la boîte englobante est élargie par la corniche)
  const sideZ = clockBox.min.z + 0.12;
  const sideHit = new THREE.Raycaster(new THREE.Vector3(clockBox.min.x - 0.5, 1.02, sideZ), new THREE.Vector3(1, 0, 0)).intersectObject(clock, true)[0];
  button.position.set((sideHit ? sideHit.point.x : clockBox.min.x) - 0.004, 1.02, sideZ);
  scene.add(button);
  const buttonHit = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.06), new THREE.MeshBasicMaterial({ visible: false }));
  buttonHit.position.copy(button.position);
  scene.add(buttonHit);
  let clockLit = false;
  const toggleClock = () => {
    clockLit = !clockLit;
    agMat.opacity = clockLit ? 0.55 : 0;
    clockLight.intensity = clockLit ? 0.5 : 0; // une petite lueur, venue du haut de la vitrine
  };
  // Coin lecture le long du mur sud (il ne cache plus la pendule)
  await model('ArmChair_01', -1.8, 0, HD - 0.75, PI, 1.1, true);
  add(buildRoundTable(0.28, 0.62), -0.95, 0, HD - 0.5, 0, true);
  await model('mantel_clock_01', -0.9, 0.655, HD - 0.45, PI);
  const candle = buildCandle();
  add(candle.group, -1.05, 0.655, HD - 0.62);
  const candleLight = new THREE.PointLight(0xffa850, 1.2, 3, 2);
  candleLight.position.set(-1.05, 0.9, HD - 0.62);
  scene.add(candleLight);

  // ---------- Mur est : paillasse de chimie, apothicaire, vitrine ----------
  const benchPos = new THREE.Vector3(HW - 0.48, 0, -1.2);
  const bench = await model('WoodenTable_01', benchPos.x, 0, benchPos.z, -PI / 2, [1.5, 1.6, 1.3], true);
  const chemSet = await model('chemistry_set', HW - 0.4, 0.88, benchPos.z - 0.6, -PI / 2);
  const glassware = animate(buildGlassware(), HW - 0.55, 0.88, benchPos.z + 0.15, -PI / 2);
  const microscope = await model('vintage_microscope', HW - 0.4, 0.88, benchPos.z + 1.1, -PI / 2 - 0.4);
  await model('seadogs_compass', HW - 0.4, 0.88, benchPos.z - 1.15, -PI / 2);
  add(buildJarShelf(2.4), HW - 0.13, 1.5, benchPos.z, -PI / 2);
  add(framed(periodicTableTexture(), 1.3, 0.92, false), HW - 0.01, 2.75, benchPos.z, -PI / 2);
  await model('fancy_picture_frame_01', HW - 0.01, 2.95, 2.15, -PI / 2, 1.6);
  // La vitrine est une porte secrète : une serrure à quatre molettes sur son flanc (côté pendule).
  // Une fois la combinaison trouvée, elle pivote sur son coin arrière et dévoile l'escalier.
  const cabinet = await model('vintage_cabinet_01', HW - 0.3, 0, 2.15, -PI / 2);
  cabinet.updateMatrixWorld(true);
  const cabBox = new THREE.Box3().setFromObject(cabinet);
  // objets posés sur le comptoir, à l'avant (le haut de la vitrine est en arc) : hauteur mesurée par un rayon
  const counterY = (z: number) => {
    const hit = new THREE.Raycaster(new THREE.Vector3(cabBox.min.x + 0.1, 1.5, z), new THREE.Vector3(0, -1, 0)).intersectObject(cabinet, true)[0];
    return hit ? hit.point.y : 0.95;
  };
  const onTop = [
    await model('brass_candleholders', cabBox.min.x + 0.14, counterY(1.55), 1.55, -PI / 2, 0.45),
    await model('vintage_binocular', cabBox.min.x + 0.14, counterY(2.75), 2.75, -PI / 2 + 0.4),
  ];
  // sur le flanc côté pendule, près du coin avant : posée sur la vraie surface (le comptoir déborde de la boîte englobante)
  const lockX = cabBox.min.x + 0.26;
  const lockY = 0.78;
  const lockHit = new THREE.Raycaster(new THREE.Vector3(lockX, lockY, cabBox.max.z + 0.5), new THREE.Vector3(0, 0, -1)).intersectObject(cabinet, true)[0];
  const lockPos = new THREE.Vector3(lockX, lockY, (lockHit ? lockHit.point.z : cabBox.max.z) + 0.005);
  const lock = buildCabinetLock();
  lock.position.copy(lockPos);
  scene.add(lock);
  const doorPivot = new THREE.Group();
  doorPivot.position.set(HW, 0, cabBox.min.z);
  scene.add(doorPivot);
  for (const o of [cabinet, ...onTop, lock]) doorPivot.attach(o);
  const cabinetCollider = colliderOf(cabinet);
  colliders.push(cabinetCollider);
  const secretRoom = await buildSecretRoom(scene, colliders, model);
  updates.push(secretRoom.update);
  let doorOpen = false;
  const openDoor = (animated = true) => {
    if (doorOpen) return;
    doorOpen = true;
    try {
      localStorage.setItem('le-labo:passage', '1');
    } catch {
      // stockage indisponible : il faudra rouvrir le passage la prochaine fois
    }
    // le meuble ne bloque plus le passage mais sa nouvelle position
    doorPivot.rotation.y = DOOR_OPEN;
    doorPivot.updateMatrixWorld(true);
    Object.assign(cabinetCollider, colliderOf(cabinet));
    if (animated) doorPivot.rotation.y = 0;
  };
  let lastT = 0;
  updates.push((t) => {
    const dt = Math.min(0.1, t - lastT);
    lastT = t;
    if (doorOpen) doorPivot.rotation.y += (DOOR_OPEN - doorPivot.rotation.y) * Math.min(1, dt * 1.6); // pivot lent et majestueux
  });
  try {
    if (localStorage.getItem('le-labo:passage')) openDoor(false);
  } catch {
    // stockage indisponible
  }
  const benchLight = new THREE.PointLight(0xffc070, 12, 5, 2);
  benchLight.position.set(HW - 0.9, 2.3, benchPos.z);
  scene.add(benchLight);
  const cabinetLight = new THREE.PointLight(0xffc070, 6, 4, 2);
  cabinetLight.position.set(HW - 1.2, 2.5, 2.2);
  scene.add(cabinetLight);

  // ---------- Magie au milieu de la pièce ----------
  add(buildRoundTable(0.28, 0.7), 2.4, 0, -1.3, 0, true);
  animate(buildCrystalBall(), 2.4, 0.72, -1.3);
  for (const [x, z] of [[-3.3, 1.9], [-3.3, 2.5], [3.3, -0.4], [3.3, -1.2], [3.3, -2.0], [1.1, 2.8]]) {
    const herbs = buildHerbBundle();
    herbs.rotation.y = Math.random() * PI;
    add(herbs, x, ROOM.h - 0.3, z);
  }
  const dust = buildMagicDust(new THREE.Box3(new THREE.Vector3(-HW + 0.5, 0.3, -HD + 0.5), new THREE.Vector3(HW - 0.5, ROOM.h - 0.4, HD - 0.5)), 220);
  scene.add(dust.group);
  updates.push(dust.update);

  // ---------- Jeu de lumière : la lunette tourne, l'objectif renvoie le soleil de la fenêtre vers le cabinet ----------
  const SCOPE_STEPS = 16;
  const scopeBaseDir = scopeDir.clone();
  const scopeLocalEye = eyepiece.clone().sub(telescope.group.position);
  const tubeBase = new THREE.Vector3(0, 1.55, 0); // pivot du tube, dans le repère de la lunette
  const flat = (v: THREE.Vector3) => Math.atan2(v.z, v.x);
  const toCrystal = crystalPos.clone().sub(telescope.group.position);
  // une rotation θ autour de Y diminue l'angle atan2(z, x) de θ
  const wanted = (((flat(scopeBaseDir) - flat(toCrystal)) % (2 * PI)) + 2 * PI) % (2 * PI);
  const goodStep = Math.round(wanted / ((2 * PI) / SCOPE_STEPS)) % SCOPE_STEPS;
  let scopeStep = 0;
  let scopeAngle = 0;
  const sunEntry = new THREE.Vector3(-HW + 0.05, 2.5, WINDOWS[0].z);
  const beamIn = buildBeam(0xfff0c0, 0.03);
  const beamOut = buildBeam(0xffe0a0, 0.02);
  scene.add(beamIn.mesh, beamOut.mesh);
  let alignedSince = -1; // instant où le rayon a touché le cristal
  const objective = new THREE.Vector3();
  const turnScope = () => (scopeStep += 1);
  let lastScopeT = 0;
  updates.push((t) => {
    const dt = Math.min(0.1, t - lastScopeT);
    lastScopeT = t;
    const target = (scopeStep * 2 * PI) / SCOPE_STEPS;
    if (Math.abs(target - scopeAngle) > 1e-4) {
      scopeAngle += (target - scopeAngle) * Math.min(1, dt * 5);
      telescope.group.rotation.y = scopeAngle;
      // l'atelier de la lunette suit sa nouvelle orientation
      scopeDir.copy(scopeBaseDir).applyAxisAngle(UP, scopeAngle);
      eyepiece.copy(scopeLocalEye).applyAxisAngle(UP, scopeAngle).add(telescope.group.position);
      const v = viewFor(eyepiece, scopeDir.clone().negate(), 0.12, eyepiece.y);
      refs.anchors.telescope.view.pos.copy(v.pos);
      refs.anchors.telescope.view.target.copy(v.target);
    }
    const aligned = scopeStep % SCOPE_STEPS === goodStep && Math.abs(target - scopeAngle) < 0.01;
    beamIn.mesh.visible = beamOut.mesh.visible = aligned;
    if (aligned) {
      objective.copy(scopeDir).multiplyScalar(1.07).add(tubeBase).add(telescope.group.position); // le pivot est sur l'axe : seule la direction tourne
      beamIn.set(sunEntry, objective);
      beamOut.set(objective, crystal.getWorldPosition(crystalPos)); // il suit le cristal, porte ouverte comprise : il ne traverse pas le meuble
      const flicker = 0.4 + Math.sin(t * 9) * 0.05;
      (beamIn.mesh.material as THREE.MeshBasicMaterial).opacity = flicker;
      (beamOut.mesh.material as THREE.MeshBasicMaterial).opacity = flicker;
      if (alignedSince < 0) alignedSince = t;
    } else alignedSince = -1;
    const gothicOpen = aligned && t - alignedSince > 1; // la porte se referme dès que le cristal n'est plus éclairé
    crystalMat.emissiveIntensity = aligned ? 3 : 0.5;
    gothicDoor.rotation.y += ((gothicOpen ? 1.6 : 0) - gothicDoor.rotation.y) * Math.min(1, dt * 1.5);
  });

  // Flammes qui vacillent
  updates.push((t) => {
    oilLight.intensity = 4 * (1 + Math.sin(t * 13) * 0.06 + Math.sin(t * 5.7) * 0.05);
    candleLight.intensity = 1.2 * (1 + Math.sin(t * 17) * 0.12 + Math.sin(t * 6.1) * 0.08);
    candle.flame.scale.y = 2.2 * (1 + Math.sin(t * 17) * 0.1);
  });

  const v2 = (p: THREE.Vector3, dx = 0, dz = 0) => new THREE.Vector2(p.x + dx, p.z + dz);
  const benchLook = benchPos.clone().setY(0.95);
  const refs: LabRefs = {
    globe: { tilt: globe.tilt, earth: globe.earth, center: new THREE.Vector3(globePos.x, GLOBE_CENTER_Y, globePos.z) },
    telescope: { eyepiece, dir: scopeDir, towardSky: () => scopeStep % SCOPE_STEPS === 0 },
    library: { books: library.books, proxy: library.proxy, selected: null },
    chest: { lid: chestLid, glow: chestGlow, center: chest.position.clone() },
    hotspots: [
      { object: buttonHit, action: 'Appuyer sur le petit rivet', use: toggleClock },
      { object: crankHit, action: 'Tourner la manivelle de la lunette', use: turnScope },
      { object: library.metals, action: 'Ouvrir le livre « De Metallis et Astris »', station: 'metals' },
      { object: tome, action: 'Ouvrir le livre noir', station: 'tome' },
    ],
    secret: { isOpen: () => doorOpen, open: () => openDoor(), watch: { pos: new THREE.Vector3(2.9, 1.75, 3.3), target: new THREE.Vector3(5.3, 1.0, 1.9) } },
    anchors: {
      globe: { objects: [globe.group], focus: v2(globePos), view: viewFor(globePos.clone().setY(1.1), new THREE.Vector3(0, 0, 1), 1.7, 1.3) },
      telescope: { objects: [telescope.group], focus: v2(telescope.group.position), view: viewFor(eyepiece, scopeDir.clone().negate(), 0.12, eyepiece.y) },
      chemistry: { objects: [bench, chemSet, glassware.group, microscope], focus: v2(benchPos), view: viewFor(benchLook, new THREE.Vector3(-1, 0, 0), 1.75, 1.75) },
      bureau: {
        objects: [desk, deskItems],
        focus: v2(deskPos),
        view: { pos: deskPos.clone().add(new THREE.Vector3(0.4, 1.6, -0.95)), target: deskPos.clone().add(new THREE.Vector3(-0.7, 0.8, 0)) },
      },
      chest: { objects: [chest, grid], focus: v2(chest.position, 0, -0.2), view: viewFor(chest.position.clone().setY(0.4), new THREE.Vector3(-0.45, 0, -1).normalize(), 1.5, 1.45) },
      clock: { objects: [clock], focus: v2(clockPos, 0, -0.2), view: viewFor(clockPos.clone().setY(1.35), new THREE.Vector3(-0.4, 0, -1).normalize(), 1.8, 1.65) },
      portal: { objects: [portal.group, runes.group], focus: v2(portalPos, 0, 0.6), view: viewFor(portalPos.clone(), new THREE.Vector3(0, 0, 1), 2.0, 1.6) },
      // gros plan sur la plaque du socle, face à elle
      bust: { objects: [pedestal, bust, plaque], focus: new THREE.Vector2(0.15, -HD + 0.75), view: { pos: plaquePos.clone().add(new THREE.Vector3(0, 0.1, 0.4)), target: plaquePos.clone() } },
      tome: { objects: [], focus: v2(tomePos), view: { pos: tomePos.clone().add(new THREE.Vector3(0.25, 0.55, 0.45)), target: tomePos.clone().add(new THREE.Vector3(0.3, 0, 0)) } },
      lock: { objects: [lock], focus: v2(lockPos), view: viewFor(lockPos, new THREE.Vector3(-0.5, 0, 0.87).normalize(), 0.75, 1.1) },
      grimoire: {
        objects: secretRoom.grimoireObjects,
        focus: new THREE.Vector2(secretRoom.grimoire.x - 0.6, secretRoom.grimoire.z),
        view: { pos: secretRoom.grimoire.clone().add(new THREE.Vector3(-0.6, 0.5, 0)), target: secretRoom.grimoire.clone().add(new THREE.Vector3(0, -0.05, 0.25)) },
      },
    },
  };

  return { colliders, refs, update: (t: number) => updates.forEach((u) => u(t)) };
}
