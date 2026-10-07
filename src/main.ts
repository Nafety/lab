import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import './style.css';
import { loadEnvironment, manager } from './assets';
import { buildLab, type AnchorId } from './lab';
import { Player } from './player';
import { CameraRig } from './camera-rig';
import { Arms } from './arms';
import { prefetchAll } from './live';
import type { Game, GameContext } from './games/game';
import { GlobeGame } from './games/globe-game';
import { TelescopeGame } from './games/telescope-game';
import { BookGame, bookTheme } from './games/history-game';
import { createChemistryGame } from './games/workshops';
import { HoaxGame } from './games/hoax-game';
import { CipherGame } from './games/cipher-game';
import { TimelineGame } from './games/timeline-game';
import { PortalGame } from './games/portal-game';
import { Network } from './net';
import { Avatars } from './avatars';
import { Match, type MatchApi, type Standing } from './match';
import './multi.css';
import { BustPlaqueGame, CabinetLockGame, GrimoireGame, MASTER_KEY, MetalsGame, TomeGame } from './games/secret-game';

const $ = (id: string) => document.getElementById(id)!;

// --- Rendu ---
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.autoUpdate = false; // décor presque immobile : ombres recalculées 10 fois par seconde (voir la boucle)
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
$('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1410);
const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.03, 80);

// Post-traitement : occlusion ambiante (ombres de contact dans les coins et sous les objets)
const composer = new EffectComposer(
  renderer,
  new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 }),
);
composer.addPass(new RenderPass(scene, camera));
const gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
gtao.blendIntensity = 0.9;
// Les faisceaux de lumière (calque 1) ne doivent pas assombrir l'image : on les cache pendant le calcul
camera.layers.enable(1);
const renderGtao = gtao.render.bind(gtao);
gtao.render = (...args) => {
  camera.layers.disable(1);
  renderGtao(...args);
  camera.layers.enable(1);
};
composer.addPass(gtao);
composer.addPass(new OutputPass());

const rig = new CameraRig(camera);
scene.add(camera); // les bras sont accrochés à la caméra
const arms = new Arms(camera);

// --- Multijoueur (portail) ---
const net = new Network();
const avatars = new Avatars(scene);
const netHud = document.createElement('div');
netHud.id = 'net-hud';
netHud.className = 'hidden';
document.body.appendChild(netHud);
net.onChange = () => {
  netHud.classList.toggle('hidden', !net.connected);
  const n = net.others.size + 1;
  netHud.textContent = `Portail ${net.code} · ${n} savant${n > 1 ? 's' : ''} · Tab : classement`;
  match?.shareScores(); // les nouveaux arrivants reçoivent le classement en cours
};
let netClock = 0;
const yawEuler = new THREE.Euler(0, 0, 0, 'YXZ');

// --- Ateliers ---
type StationId = 'globe' | 'history' | 'telescope' | 'chemistry' | 'bureau' | 'chest' | 'clock' | 'portal' | 'bust' | 'lock' | 'tome' | 'metals' | 'grimoire';
/** Ateliers toujours joués seul, même avec d'autres savants connectés. */
const SOLO_ONLY: StationId[] = ['portal', 'bust', 'lock', 'tome', 'metals', 'grimoire'];
interface Station {
  id: StationId;
  action: string;
  focus: THREE.Vector2;
  reach: number;
  /** mécanisme du décor : action immédiate, sans atelier */
  use?: () => void;
}
/** Les points d'interaction viennent du labo (voir lab.ts) ; ici, le texte affiché et la portée. */
const STATIONS: Station[] = [
  { id: 'globe', action: 'Faire tourner le globe', focus: new THREE.Vector2(), reach: 2.0 },
  { id: 'telescope', action: 'Regarder dans la lunette', focus: new THREE.Vector2(), reach: 1.9 },
  { id: 'chemistry', action: 'Utiliser la paillasse', focus: new THREE.Vector2(), reach: 2.2 },
  { id: 'bureau', action: 'Fact-checking', focus: new THREE.Vector2(), reach: 2.2 },
  { id: 'chest', action: 'Déchiffrer le coffre', focus: new THREE.Vector2(), reach: 1.8 },
  { id: 'clock', action: 'Remonter la pendule du temps', focus: new THREE.Vector2(), reach: 1.8 },
  { id: 'portal', action: 'Entrer dans le portail des savants', focus: new THREE.Vector2(), reach: 2.0 },
  { id: 'bust', action: 'Examiner le socle du buste', focus: new THREE.Vector2(), reach: 2.0 },
  { id: 'lock', action: 'Examiner la serrure de la vitrine', focus: new THREE.Vector2(), reach: 2.0 },
  { id: 'grimoire', action: 'Lire le grimoire des maîtres', focus: new THREE.Vector2(), reach: 2.0 },
];
const BOOK_STATION: Station = { id: 'history', action: '', focus: new THREE.Vector2(), reach: 2.4 };
const raycaster = new THREE.Raycaster();
const games: Partial<Record<StationId, Game>> = {
  globe: new GlobeGame(),
  telescope: new TelescopeGame(),
  history: new BookGame(),
  bureau: new HoaxGame(),
  chest: new CipherGame(),
  clock: new TimelineGame(),
  chemistry: createChemistryGame(),
  portal: new PortalGame(net),
  bust: new BustPlaqueGame(),
  lock: new CabinetLockGame(),
  tome: new TomeGame(),
  metals: new MetalsGame(),
  grimoire: new GrimoireGame(),
};

const STATION_LABELS: Record<StationId, string> = {
  globe: 'le globe',
  history: 'un livre de la bibliothèque',
  telescope: 'la lunette',
  chemistry: 'la paillasse',
  bureau: 'le fact-checking',
  chest: 'le coffre chiffré',
  clock: 'la pendule du temps',
  portal: 'le portail',
  bust: 'le socle du buste',
  lock: 'la serrure de la vitrine',
  tome: 'le livre noir',
  metals: 'le livre des métaux',
  grimoire: 'le grimoire',
};

// --- Parties communes (multijoueur) ---
const match = new Match(net, {
  start(station, payload, api, by) {
    if (mode === 'loading') return;
    toast(`${by} lance ${STATION_LABELS[station as StationId]} : tous les savants y participent !`);
    // si on était déjà dans un atelier, on le quitte sans revenir à sa place
    if (mode === 'station' && activeGame) {
      activeGame.close();
      activeGame = null;
    } else {
      saved.pos.copy(camera.position);
      saved.quat.copy(camera.quaternion);
    }
    enterStation(STATIONS.find((s) => s.id === station) ?? BOOK_STATION, payload, api, false);
  },
  reveal: (i, results) => activeGame?.onReveal?.(i, results),
  next: (i) => activeGame?.onNext?.(i),
  end: (ranking, scores) => showScores(ranking, scores),
  makePayload: async (station, hint) => (await games[station as StationId]?.makePayload?.(hint)) ?? null,
});

const toastEl = document.createElement('div');
toastEl.id = 'toast';
toastEl.className = 'hidden';
document.body.appendChild(toastEl);
let toastTimer: ReturnType<typeof setTimeout> | undefined;
function toast(text: string) {
  toastEl.textContent = text;
  toastEl.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 4000);
}

/** Classement : celui de l'atelier qui vient de finir (s'il y en a un) et le classement général. */
const scoresEl = document.createElement('div');
scoresEl.id = 'scoreboard';
scoresEl.className = 'hidden';
document.body.appendChild(scoresEl);
let scoresTimer: ReturnType<typeof setTimeout> | undefined;
function showScores(ranking: Standing[] | null, scores: Standing[], autoHide = true) {
  const rows = (list: Standing[]) =>
    list
      .map((s, i) => `<li><span class="rank">${['🥇', '🥈', '🥉'][i] ?? i + 1}</span><span class="who">${escapeName(s.name)}</span><span class="pts">${s.points} pts</span>${s.wins ? `<span class="wins">${s.wins} victoire${s.wins > 1 ? 's' : ''}</span>` : ''}</li>`)
      .join('');
  scoresEl.innerHTML = `
    <div class="sb-card">
      ${ranking ? `<div class="kicker">Fin de l'atelier</div><h3>${escapeName(ranking[0]?.name ?? '')} remporte la partie !</h3><ol>${rows(ranking)}</ol>` : ''}
      <div class="kicker">Classement général</div>
      ${scores.length ? `<ol>${rows(scores)}</ol>` : '<p>Aucune partie jouée pour l’instant.</p>'}
      <p class="sb-hint">Maintiens <kbd>Tab</kbd> pour revoir le classement.</p>
    </div>`;
  scoresEl.classList.remove('hidden');
  clearTimeout(scoresTimer);
  if (autoHide) scoresTimer = setTimeout(() => scoresEl.classList.add('hidden'), 9000);
}
function escapeName(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
addEventListener('keydown', (e) => {
  if (e.code === 'Tab' && net.connected) {
    e.preventDefault();
    if (!e.repeat) showScores(null, match.scores, false);
  }
});
addEventListener('keyup', (e) => {
  if (e.code === 'Tab') scoresEl.classList.add('hidden');
});

// --- État ---
type Mode = 'loading' | 'explore' | 'station' | 'returning';
let mode: Mode = 'loading';
let player: Player;
let ctx: GameContext;
let activeGame: Game | null = null;
let target: Station | null = null;
const saved = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
let labUpdate: (t: number) => void = () => {};
/** bénédiction du grimoire reçue : bracelets d'or, visibles aussi par les autres savants */
let blessed = false;

const startEl = $('start');
const promptEl = $('prompt');

// --- Chargement ---
manager.onProgress = (_url, loaded, total) => {
  ($('load-bar') as HTMLElement).style.width = `${Math.round((loaded / total) * 100)}%`;
};

async function init() {
  const [lab, env] = await Promise.all([buildLab(scene), loadEnvironment(renderer)]);
  scene.environment = env;
  scene.environmentIntensity = 0.6;
  labUpdate = lab.update;
  $('load-text').textContent = 'On allume les bougies…';
  await warmUp();

  player = new Player(camera, renderer.domElement, lab.colliders);
  player.controls.addEventListener('lock', () => {
    startEl.classList.add('hidden');
    document.body.classList.add('playing');
  });
  player.controls.addEventListener('unlock', () => {
    document.body.classList.remove('playing');
    if (mode === 'explore') showPause();
  });

  ctx = { camera, rig, refs: lab.refs, exit: () => leaveStation(true), match: null };
  for (const s of STATIONS) if (s.id !== 'history' && s.id !== 'metals' && s.id !== 'tome') s.focus.copy(lab.refs.anchors[s.id].focus);
  (games.history as BookGame).books = lab.refs.library.books; // pour que l'hôte puisse préparer un livre
  // Récompense du passage secret, conservée d'une partie à l'autre
  try {
    if (localStorage.getItem(MASTER_KEY)) blessed = true;
  } catch {
    // stockage indisponible
  }
  if (blessed) arms.setGolden(true);
  addEventListener('le-labo:grand-maitre', () => {
    blessed = true;
    arms.setGolden(true);
  });

  $('loading').classList.add('hidden');
  $('play').classList.remove('hidden');
  mode = 'explore';
  // contenus Wikipédia et Wikidata chargés à l'avance, une fois le labo bien lancé : les ateliers s'ouvrent sans attendre
  setTimeout(prefetchAll, 2500);
}

/**
 * Tout préparer avant d'entrer : shaders compilés, textures envoyées à la carte graphique,
 * quelques images rendues depuis plusieurs points de vue. Sinon les premières secondes saccadent.
 */
async function warmUp() {
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  arms.update(0, 0, { visible: true, moving: false, running: false, height: 0 }); // leurs matériaux aussi
  scene.traverse((o) => {
    const mats = (o as THREE.Mesh).material;
    for (const m of Array.isArray(mats) ? mats : mats ? [mats] : []) {
      for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap'] as const) {
        const tex = (m as THREE.MeshStandardMaterial)[k];
        if (tex) renderer.initTexture(tex);
      }
    }
  });
  await renderer.compileAsync(scene, camera);
  const views = [
    [1.4, 1.65, 2.9, -0.6, 1.3, 0.6],
    [0, 1.65, 0, 0, 1.4, -4],
    [0, 1.65, 0, 5, 1.4, 0],
    [0, 1.65, 0, -5, 1.4, 0],
    [0, 1.65, 0, 0, 1.4, 4],
    [5.2, 1.6, 2.1, 9.5, 0.3, 2.1],
    [10.2, -0.8, 2.1, 13.7, -1.4, 2.1],
  ];
  for (const v of views) {
    camera.position.set(v[0], v[1], v[2]);
    camera.lookAt(v[3], v[4], v[5]);
    renderer.shadowMap.needsUpdate = true;
    composer.render();
    await frame();
  }
  arms.update(0, 0, { visible: false, moving: false, running: false, height: 0 });
}

function showPause() {
  $('play').textContent = 'Reprendre';
  startEl.classList.remove('hidden');
}

$('play').addEventListener('click', () => player.controls.lock());
document.addEventListener('pointerlockerror', showPause);

function enterStation(s: Station, payload?: unknown, api: MatchApi | null = null, savePose = true) {
  const game = games[s.id];
  if (!game) return;
  mode = 'station';
  if (savePose) {
    saved.pos.copy(camera.position);
    saved.quat.copy(camera.quaternion);
  }
  promptEl.classList.add('hidden');
  player.controls.unlock();
  activeGame = game;
  arms.reach();
  game.open({ ...ctx, match: api }, payload);
}

/** Avec d'autres savants, un atelier se joue ensemble : on demande à l'hôte de lancer la partie pour tous. */
function useStation(s: Station) {
  if (s.use) return s.use();
  if (!match.multiplayer || SOLO_ONLY.includes(s.id)) return enterStation(s);
  if (match.active) return toast('Une partie est déjà en cours : attends qu’elle se termine.');
  const sel = ctx.refs.library.selected;
  match.request(s.id, s.id === 'history' && sel ? { variant: sel.mesh.userData.variant, index: sel.index } : undefined);
  toast('Le portail prévient les autres savants…');
}

/** relock = false quand on sort avec Échap : le navigateur refuse alors de recapturer la souris. */
async function leaveStation(relock: boolean) {
  if (mode !== 'station' || !activeGame) return;
  match.abortIfHost(); // l'hôte qui s'en va termine la partie commune
  activeGame.close();
  activeGame = null;
  mode = 'returning';
  if (relock) player.controls.lock();
  await rig.flyTo(saved.pos, saved.quat, 0.45);
  mode = 'explore';
  if (!relock) showPause();
}

addEventListener('keydown', (e) => {
  if (e.code === 'KeyE' && mode === 'explore' && player?.controls.isLocked && target) useStation(target);
  else if (e.code === 'Escape' && mode === 'station') leaveStation(false);
});

/** Ce que vise le centre exact de l'écran : un mécanisme, un atelier ou un livre, à portée et non caché. */
function findTarget(): Station | null {
  const lib = ctx.refs.library;
  lib.selected = null;
  // racine visée → ce qu'elle déclenche (les mécanismes d'abord : la manivelle est montée sur la lunette)
  const owners = new Map<THREE.Object3D, Station | 'book'>();
  for (const h of ctx.refs.hotspots) owners.set(h.object, { id: h.station ?? 'metals', action: h.action, focus: new THREE.Vector2(), reach: 2.1, use: h.use });
  for (const s of STATIONS) {
    if (s.id === 'grimoire' && !ctx.refs.secret.isOpen()) continue; // caché tant que le passage est fermé
    if (s.id === 'lock' && ctx.refs.secret.isOpen()) continue; // la vitrine a pivoté
    if (s.id === 'telescope' && !ctx.refs.telescope.towardSky()) continue; // détournée de la fenêtre
    for (const o of ctx.refs.anchors[s.id as AnchorId].objects) if (!owners.has(o)) owners.set(o, s);
  }
  for (const b of lib.books) owners.set(b, 'book');

  raycaster.layers.enableAll(); // le portail est sur le calque 1
  raycaster.far = 2.6;
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hits = raycaster.intersectObjects([...owners.keys()], true);
  raycaster.layers.set(0);
  for (const hit of hits) {
    let o: THREE.Object3D | null = hit.object;
    while (o && !owners.has(o)) o = o.parent;
    if (!o) continue;
    const owner = owners.get(o)!;
    const reach = owner === 'book' ? BOOK_STATION.reach : owner.reach;
    if (hit.distance > reach) return null;
    // rien ne doit le cacher (on ne déclenche pas le rivet à travers la pendule)
    raycaster.far = hit.distance - 0.03;
    const blocker = raycaster
      .intersectObject(scene, true)
      .find((b) => (b.object as THREE.Mesh).isMesh && ((b.object as THREE.Mesh).material as THREE.Material).visible !== false && !o!.getObjectById(b.object.id) && b.object !== o);
    if (blocker) return null;
    if (owner !== 'book') return owner;
    if (hit.instanceId === undefined) return null;
    const mesh = hit.object as THREE.InstancedMesh;
    lib.selected = { mesh, index: hit.instanceId };
    BOOK_STATION.action = `Ouvrir le livre « ${bookTheme(mesh, hit.instanceId).title} »`;
    return BOOK_STATION;
  }
  return null;
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

// --- Boucle ---
const timer = new THREE.Timer();
let aimClock = 0;
let shadowClock = 0;
renderer.setAnimationLoop((time) => {
  timer.update(time);
  const dt = Math.min(timer.getDelta(), 0.1);
  const t = timer.getElapsed();
  if (mode === 'loading') return;

  rig.update(dt);
  labUpdate(t);
  activeGame?.update?.(t, dt);

  if (mode === 'explore') {
    player.update(dt);
    // la visée (des rayons sur beaucoup d'objets) est recalculée une douzaine de fois par seconde
    aimClock += dt;
    if (aimClock > 0.08) {
      aimClock = 0;
      target = player.controls.isLocked ? findTarget() : null;
    }
    promptEl.classList.toggle('hidden', !target);
    if (target) promptEl.innerHTML = `<kbd>E</kbd> ${target.action}`;
  }

  arms.update(dt, t, {
    visible: mode === 'explore' && !!player?.controls.isLocked,
    moving: !!player?.moving,
    running: !!player?.running,
    height: player?.heightAboveGround ?? 0,
  });

  // Positions échangées une dizaine de fois par seconde avec les autres savants
  netClock += dt;
  if (net.connected && netClock > 0.1) {
    netClock = 0;
    yawEuler.setFromQuaternion(camera.quaternion);
    net.sendState(camera.position.toArray() as [number, number, number], yawEuler.y, blessed);
    net.prune();
  }
  avatars.update(net.others, dt, t);

  shadowClock += dt;
  if (shadowClock > 0.1) {
    shadowClock = 0;
    renderer.shadowMap.needsUpdate = true;
  }
  composer.render();
});

init();
