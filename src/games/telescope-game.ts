import * as THREE from 'three';
import { CONSTELLATIONS, PLANET_FACTS, PLANETS, type Constellation, type Planet, type Star } from '../data/sky';
import { constellationNames, freshFirst, moons, takeConstellations, wikiIntro } from '../live';
import { resultsHTML, speedPoints, waitingHTML, type Result } from '../match';
import { choiceButtons, el, scoreComment, shuffle, type Game, type GameContext } from './game';
import './telescope.css';

type Question =
  | { kind: 'constellation'; c: Constellation; rot: number; choices: string[] }
  | { kind: 'planet'; p: Planet; choices: string[] }
  | { kind: 'fact'; q: string; p: Planet; choices: string[] }
  | { kind: 'moon'; moon: string; count: number; p: Planet; choices: string[] }
  | { kind: 'star'; star: string; c: Constellation; choices: string[] };

const QUESTION_COUNT = 8;
const RED_STARS = ['Bételgeuse', 'Antarès'];
const BLUE_STARS = ['Rigel', 'Deneb', 'Régulus', 'Acrux', 'Mimosa'];

/** Projection gnomonique (comme une photo du ciel), nord en haut, est à gauche. */
function project(stars: Star[]) {
  const vecs = stars.map(([, ra, dec]) => {
    const a = (ra / 12) * Math.PI;
    const d = (dec / 180) * Math.PI;
    return new THREE.Vector3(Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d));
  });
  const c = vecs.reduce((s, v) => s.add(v), new THREE.Vector3()).normalize();
  let east = new THREE.Vector3(0, 0, 1).cross(c);
  if (east.lengthSq() < 1e-8) east = new THREE.Vector3(0, 1, 0);
  east.normalize();
  const north = c.clone().cross(east).normalize();
  const pts = vecs.map((v) => {
    const k = 1 / v.dot(c);
    return { x: -v.dot(east) * k, y: -v.dot(north) * k }; // y vers le bas pour le canvas
  });
  // centrer et normaliser dans [-1, 1]
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const ext = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 || 1;
  return pts.map((p) => ({ x: (p.x - cx) / ext, y: (p.y - cy) / ext }));
}

/** Relie les étoiles par l'arbre le plus court (algorithme de Prim) : une silhouette proche du tracé habituel. */
function shortestLinks(stars: Star[]): [number, number][] {
  const pts = project(stars);
  const linked = new Set([0]);
  const lines: [number, number][] = [];
  while (linked.size < pts.length) {
    let best: [number, number] | null = null;
    let bestD = Infinity;
    for (const a of linked) {
      for (let b = 0; b < pts.length; b++) {
        if (linked.has(b)) continue;
        const d = Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y);
        if (d < bestD) {
          bestD = d;
          best = [a, b];
        }
      }
    }
    linked.add(best![1]);
    lines.push(best!);
  }
  return lines;
}

function pickChoices(correct: string, pool: string[]) {
  return [correct, ...shuffle(pool.filter((n) => n !== correct)).slice(0, 3)];
}

/** Atelier Astronomie : on regarde dans la lunette et on reconnaît constellations et planètes. */
export class TelescopeGame implements Game {
  private ctx!: GameContext;
  private root: HTMLElement;
  private lens: HTMLElement;
  private skyCanvas: HTMLCanvasElement;
  private sky: CanvasRenderingContext2D;
  private planetCanvas: HTMLCanvasElement;
  private log: HTMLElement;
  private visible = false;
  private active = false;

  private questions: Question[] = [];
  private index = 0;
  private score = 0;
  private revealedAt = -1;
  private time = 0;
  private bgStars: { x: number; y: number; r: number; phase: number; speed: number }[] = [];

  // Vue des planètes (petit rendu 3D à part)
  private renderer3d: THREE.WebGLRenderer | null = null;
  private scene3d = new THREE.Scene();
  private cam3d = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  private planetGroup = new THREE.Group();
  private planetMesh: THREE.Mesh;
  private ring: THREE.Mesh;
  private textures = new Map<string, THREE.Texture>();
  private loader = new THREE.TextureLoader();
  private showPlanet = false;

  constructor() {
    this.root = el('div', 'scope hidden');
    this.root.innerHTML = `
      <div class="scope-lens">
        <canvas class="scope-sky"></canvas>
        <canvas class="scope-planet"></canvas>
        <div class="scope-reticle"></div>
      </div>
      <div class="scope-log paper-panel"></div>`;
    document.body.appendChild(this.root);
    this.lens = this.root.querySelector('.scope-lens')!;
    this.skyCanvas = this.root.querySelector('.scope-sky')!;
    this.sky = this.skyCanvas.getContext('2d')!;
    this.planetCanvas = this.root.querySelector('.scope-planet')!;
    this.log = this.root.querySelector('.scope-log')!;

    this.planetMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), new THREE.MeshStandardMaterial({ roughness: 1 }));
    const ringGeo = new THREE.RingGeometry(1.24, 2.27, 128, 1);
    const pos = ringGeo.attributes.position as THREE.BufferAttribute;
    const uv = ringGeo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (Math.hypot(pos.getX(i), pos.getY(i)) - 1.24) / (2.27 - 1.24), 0.5);
    this.ring = new THREE.Mesh(
      ringGeo,
      new THREE.MeshStandardMaterial({ map: this.texture('saturn_ring_alpha.png'), transparent: true, side: THREE.DoubleSide, roughness: 1 }),
    );
    this.ring.rotation.x = -Math.PI / 2 + 0.45;
    this.planetGroup.add(this.planetMesh, this.ring);
    this.planetGroup.rotation.z = 0.15;
    this.scene3d.add(this.planetGroup);
    this.scene3d.add(new THREE.AmbientLight(0xffffff, 0.15));
    const sun = new THREE.DirectionalLight(0xffffff, 3);
    sun.position.set(-3, 1, 2.2);
    this.scene3d.add(sun);
    this.cam3d.position.set(0, 0, 6.5);

    addEventListener('resize', () => this.visible && this.resize());
  }

  private texture(file: string) {
    if (!this.textures.has(file)) {
      const t = this.loader.load(`assets/planets/${file}`);
      t.colorSpace = THREE.SRGBColorSpace;
      this.textures.set(file, t);
    }
    return this.textures.get(file)!;
  }

  open(ctx: GameContext, payload?: unknown) {
    this.ctx = ctx;
    this.active = true;
    const { eyepiece, dir } = ctx.refs.telescope;
    const camPos = eyepiece.clone().addScaledVector(dir, -0.12);
    if (payload) {
      // multijoueur : le même ciel pour tout le monde
      this.questions = payload as Question[];
      this.index = 0;
      this.score = 0;
    } else this.buildQuestions();
    ctx.rig.lookFrom(camPos, eyepiece.clone().add(dir), 0.5).then(() => {
      if (!this.active) return; // quitté pendant le trajet
      this.root.classList.remove('hidden');
      this.visible = true;
      this.resize();
      requestAnimationFrame(() => this.root.classList.add('on'));
      this.showQuestion(0);
    });
  }

  close() {
    this.active = false;
    this.visible = false;
    this.root.classList.remove('on');
    this.root.classList.add('hidden');
  }

  async makePayload() {
    this.buildQuestions();
    return this.questions;
  }

  onReveal(i: number, results: Result[]) {
    if (this.index !== i) return;
    const box = this.log.querySelector('.s-multi')!;
    box.innerHTML = resultsHTML(results, !!this.ctx.match?.isHost, i + 1 >= this.questions.length);
    box.querySelector('.mp-next')?.addEventListener('click', () => this.ctx.match?.next(i + 1));
  }

  onNext(i: number) {
    if (i < this.questions.length) this.showQuestion(i);
    else this.showSummary();
  }

  private resize() {
    const size = this.lens.clientWidth;
    const dpr = Math.min(devicePixelRatio, 2);
    this.skyCanvas.width = this.skyCanvas.height = size * dpr;
    if (!this.renderer3d) {
      this.renderer3d = new THREE.WebGLRenderer({ canvas: this.planetCanvas, alpha: true, antialias: true });
      this.renderer3d.toneMapping = THREE.ACESFilmicToneMapping;
    }
    this.renderer3d.setPixelRatio(dpr);
    this.renderer3d.setSize(size, size, false);
  }

  private buildQuestions() {
    const names = CONSTELLATIONS.map((c) => c.name);
    const planetNames = PLANETS.map((p) => p.name);
    const realPlanets = PLANETS.filter((p) => p.id !== 'moon').map((p) => p.name);
    // Lunes des planètes : liste Wikidata préchargée au démarrage (si elle est arrivée)
    const moonList = moons.now() ?? [];
    const moonQs: Question[] = freshFirst('lunes', moonList, (m) => m.moon, 2).flatMap((m) => {
      const p = PLANETS.find((x) => x.name === m.planet);
      if (!p) return [];
      const count = moonList.filter((x) => x.planet === m.planet).length;
      return [{ kind: 'moon' as const, moon: m.moon, count, p, choices: pickChoices(p.name, ['Mars', 'Jupiter', 'Saturne', 'Uranus', 'Neptune']) }];
    });
    const nConst = moonQs.length ? 3 : 4;
    // Constellations : d'abord celles chargées en direct depuis Wikidata (88 possibles), sinon les 8 intégrées
    const liveNames = constellationNames();
    const live: Constellation[] = takeConstellations(nConst).map((lc) => {
      const known = CONSTELLATIONS.find((c) => c.wiki === lc.wiki);
      // tracé traditionnel si on le connaît, sinon les étoiles sont reliées au plus court
      return known ?? { name: lc.name, wiki: lc.wiki, stars: lc.stars, lines: shortestLinks(lc.stars), info: '' };
    });
    const pool = [...live, ...shuffle(CONSTELLATIONS.filter((c) => !live.some((l) => l.wiki === c.wiki)))].slice(0, nConst);
    const consts: Question[] = pool.map((c) => ({
      kind: 'constellation',
      c,
      rot: (Math.random() - 0.5) * 0.6,
      choices: pickChoices(c.name, liveNames ?? names),
    }));
    const planets: Question[] = freshFirst('planetes', PLANETS, (p) => p.id, 1).map((p) => ({ kind: 'planet', p, choices: pickChoices(p.name, planetNames) }));
    // Étoiles nommées des constellations chargées en direct : « dans quelle constellation se trouve… ? »
    const named = live.flatMap((c) => c.stars.filter(([n]) => /^[A-ZÀ-Ý][a-zà-ÿ]+$/.test(n)).map(([n]) => ({ star: n, c })));
    const starQs: Question[] = freshFirst('etoiles', named, (s) => s.star, 2).map((s) => ({
      kind: 'star' as const,
      star: s.star,
      c: s.c,
      choices: pickChoices(s.c.name, liveNames ?? names),
    }));
    const facts: Question[] = freshFirst('faits-planetes', PLANET_FACTS, (f) => f.q, starQs.length ? 0 : 1).map((f) => {
      const p = PLANETS.find((x) => x.id === f.planet)!;
      return { kind: 'fact', q: f.q, p, choices: pickChoices(p.name, realPlanets) };
    });
    const rest = shuffle([...consts.slice(1), ...planets, ...facts, ...moonQs, ...starQs]);
    this.questions = [consts[0], ...rest].slice(0, QUESTION_COUNT);
    this.index = 0;
    this.score = 0;
  }

  private refocus() {
    this.lens.classList.remove('focusing');
    void this.lens.offsetWidth; // relance l'animation CSS
    this.lens.classList.add('focusing');
  }

  private showQuestion(i: number) {
    this.index = i;
    const q = this.questions[i];
    this.revealedAt = -1;
    this.newStarField();
    this.setPlanetView(q.kind === 'planet' ? q.p : null);
    this.refocus();

    const prompt =
      q.kind === 'constellation'
        ? 'Quelle constellation observes-tu ?'
        : q.kind === 'planet'
          ? 'Quel astre observes-tu dans la lunette ?'
          : q.kind === 'moon'
            ? `Autour de quelle planète tourne la lune « ${q.moon} » ?`
            : q.kind === 'star'
              ? `Dans quelle constellation se trouve l'étoile « ${q.star} » ?`
              : q.q;
    this.log.innerHTML = `
      <div class="kicker">Journal d'observation · ${i + 1} / ${this.questions.length}</div>
      <h3>${prompt}</h3>
      <div class="s-choices"></div>
      <div class="feedback"></div>
      <p class="s-info hidden"></p>
      <div class="s-multi"></div>
      <div class="btn-row"><button class="s-next hidden">Observation suivante</button><button class="ghost s-quit">Quitter la lunette</button></div>`;
    const shownAt = performance.now();
    this.log.querySelector('.s-quit')!.addEventListener('click', () => this.ctx.exit());
    const next = this.log.querySelector('.s-next') as HTMLButtonElement;
    next.addEventListener('click', () => (i + 1 < this.questions.length ? this.showQuestion(i + 1) : this.showSummary()));
    if (i + 1 === this.questions.length) next.textContent = 'Voir le bilan';

    const correct = q.kind === 'constellation' || q.kind === 'star' ? q.c.name : q.p.name;
    choiceButtons(this.log.querySelector('.s-choices')!, q.choices, 0, (ok) => {
      if (ok) this.score++;
      const fb = this.log.querySelector('.feedback')!;
      const label = correct.replace(/^(La |Le )/, (m: string) => m.toLowerCase());
      fb.textContent = ok ? `Exact : c'est ${label} !` : `Non, c'était ${label}.`;
      fb.className = `feedback ${ok ? 'ok' : 'ko'}`;
      const info = this.log.querySelector('.s-info')!;
      info.textContent =
        q.kind === 'constellation'
          ? q.c.info || 'Consultation des archives de l’observatoire…'
          : q.kind === 'star'
            ? `${q.star} est l'une des étoiles les plus brillantes de la constellation ${q.c.name}.`
            : q.kind === 'moon'
              ? `${q.moon} est l'une des ${q.count} lunes de ${q.p.name} recensées par Wikidata. ${q.p.info}`
              : q.p.info;
      // Description fraîche de Wikipédia, si elle arrive pendant qu'on lit
      if (q.kind !== 'moon') {
        const prefix = q.kind === 'star' ? `${info.textContent} ` : '';
        wikiIntro(q.kind === 'constellation' || q.kind === 'star' ? q.c.wiki : q.p.wiki)
          .then((text) => {
            if (this.index === i && this.visible) info.textContent = `${prefix}${text} (Wikipédia)`;
          })
          .catch(() => {});
      }
      info.classList.remove('hidden');
      info.classList.add('reveal');
      if (this.ctx.match) {
        // multijoueur : on attend les autres, l'hôte fera passer à la suite
        this.log.querySelector('.s-multi')!.innerHTML = waitingHTML;
        this.ctx.match.submit(i, speedPoints(ok, (performance.now() - shownAt) / 1000), ok ? 'Juste' : 'Faux', ok);
      } else next.classList.remove('hidden');
      this.revealedAt = this.time;
      if (q.kind === 'fact' || q.kind === 'moon') {
        this.setPlanetView(q.p);
        this.refocus();
      }
    });
  }

  private showSummary() {
    this.setPlanetView(null);
    this.newStarField();
    this.log.innerHTML = `
      <div class="kicker">Fin de l'observation</div>
      <h3>${this.score} / ${this.questions.length} bonnes réponses</h3>
      <p>${this.ctx.match ? 'Le classement des savants s’affiche…' : scoreComment(this.score, this.questions.length)}</p>
      <div class="btn-row">${this.ctx.match ? '' : '<button class="s-again">Nouvelle nuit d\'observation</button>'}<button class="ghost s-quit">Quitter la lunette</button></div>`;
    this.log.querySelector('.s-again')?.addEventListener('click', () => {
      this.buildQuestions();
      this.showQuestion(0);
    });
    this.log.querySelector('.s-quit')!.addEventListener('click', () => this.ctx.exit());
    if (this.ctx.match) this.ctx.match.finish();
  }

  private setPlanetView(p: Planet | null) {
    this.showPlanet = !!p;
    this.planetCanvas.style.opacity = p ? '1' : '0';
    if (!p) return;
    const mat = this.planetMesh.material as THREE.MeshStandardMaterial;
    mat.map = this.texture(p.texture);
    mat.needsUpdate = true;
    this.ring.visible = !!p.ring;
    this.planetGroup.scale.setScalar(p.ring ? 0.7 : 1.0);
    this.planetGroup.rotation.z = p.id === 'uranus' ? 1.6 : 0.15;
  }

  private newStarField() {
    this.bgStars = Array.from({ length: 320 }, () => ({
      x: Math.random() * 2 - 1,
      y: Math.random() * 2 - 1,
      r: Math.random() < 0.08 ? 1.4 : 0.4 + Math.random() * 0.7,
      phase: Math.random() * 10,
      speed: 1 + Math.random() * 3,
    }));
  }

  update(_t: number, dt: number) {
    if (!this.visible) return;
    this.time += dt;
    this.drawSky();
    if (this.showPlanet && this.renderer3d) {
      this.planetMesh.rotation.y += dt * 0.12;
      this.renderer3d.render(this.scene3d, this.cam3d);
    }
  }

  private drawSky() {
    const g = this.sky;
    const s = this.skyCanvas.width;
    const half = s / 2;
    const dpr = Math.min(devicePixelRatio, 2);
    const t = this.time;
    const bg = g.createRadialGradient(half, half, 0, half, half, half);
    bg.addColorStop(0, '#0b1222');
    bg.addColorStop(1, '#020308');
    g.fillStyle = bg;
    g.fillRect(0, 0, s, s);

    const q = this.questions[this.index];
    g.save();
    g.translate(half, half);
    g.rotate((q?.kind === 'constellation' ? q.rot : 0) + t * 0.006); // le ciel tourne lentement

    for (const b of this.bgStars) {
      g.globalAlpha = 0.35 + 0.35 * Math.sin(t * b.speed + b.phase);
      g.fillStyle = '#dfe6ff';
      g.beginPath();
      g.arc(b.x * half * 1.2, b.y * half * 1.2, b.r * dpr, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;

    if (q?.kind === 'constellation' || (q?.kind === 'star' && this.revealedAt >= 0)) {
      const pts = project(q.c.stars).map((p) => ({ x: p.x * half * 0.62, y: p.y * half * 0.62 }));
      const progress = this.revealedAt < 0 ? 0 : Math.min(1, (t - this.revealedAt) / 1.8);

      // Lignes qui se tracent une à une
      if (progress > 0) {
        g.strokeStyle = 'rgba(232, 196, 120, 0.85)';
        g.lineWidth = 1.6 * dpr;
        g.shadowColor = 'rgba(232, 196, 120, 0.9)';
        g.shadowBlur = 8 * dpr;
        q.c.lines.forEach(([a, b], i) => {
          const k = Math.min(1, Math.max(0, progress * q.c.lines.length - i));
          if (k <= 0) return;
          g.beginPath();
          g.moveTo(pts[a].x, pts[a].y);
          g.lineTo(pts[a].x + (pts[b].x - pts[a].x) * k, pts[a].y + (pts[b].y - pts[a].y) * k);
          g.stroke();
        });
        g.shadowBlur = 0;
      }

      q.c.stars.forEach(([name, , , mag], i) => {
        const r = Math.max(1.3, (4.6 - mag) * 1.5) * dpr;
        const color = RED_STARS.includes(name) ? '255,180,140' : BLUE_STARS.includes(name) ? '200,220,255' : '255,250,235';
        const tw = 0.85 + 0.15 * Math.sin(t * 2.3 + i * 1.7);
        const glow = g.createRadialGradient(pts[i].x, pts[i].y, 0, pts[i].x, pts[i].y, r * 4);
        glow.addColorStop(0, `rgba(${color},${0.9 * tw})`);
        glow.addColorStop(0.25, `rgba(${color},${0.35 * tw})`);
        glow.addColorStop(1, `rgba(${color},0)`);
        g.fillStyle = glow;
        g.beginPath();
        g.arc(pts[i].x, pts[i].y, r * 4, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = `rgba(${color},1)`;
        g.beginPath();
        g.arc(pts[i].x, pts[i].y, r * 0.6, 0, Math.PI * 2);
        g.fill();
      });

      // Noms des étoiles brillantes, une fois les lignes tracées
      if (progress > 0.7) {
        g.globalAlpha = Math.min(1, (progress - 0.7) / 0.3);
        g.fillStyle = 'rgba(232, 210, 160, 0.95)';
        g.font = `italic ${13 * dpr}px "Alegreya", Georgia, serif`;
        q.c.stars.forEach(([name, , , mag], i) => {
          if (mag < 2.7) g.fillText(name, pts[i].x + 8 * dpr, pts[i].y - 6 * dpr);
        });
        g.globalAlpha = 1;
      }
    }
    g.restore();
  }
}
