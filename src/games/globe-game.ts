import * as THREE from 'three';
import { ANECDOTES } from '../data/anecdotes';
import { escapeHTML, randomUnescoSite, type LiveSite } from '../live';
import { resultsHTML, speedPoints, waitingHTML, type Result } from '../match';
import { brass, GLOBE_RADIUS } from '../props';
import { lookQuat } from '../camera-rig';
import { choiceButtons, el, wait, type Game, type GameContext } from './game';
import './globe.css';

const UP = new THREE.Vector3(0, 1, 0);
const VIEW_DIST = 1.7; // distance caméra ↔ centre du globe
const SPIN_TIME = 2.0;

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);

/** Direction (sphère unité) d'un point lat/lon, avec la même convention que THREE.SphereGeometry. */
function latLonDir(lat: number, lon: number) {
  const phi = ((lon + 180) / 360) * Math.PI * 2;
  const theta = ((90 - lat) / 180) * Math.PI;
  return new THREE.Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
}

function dms(value: number, pos: string, neg: string) {
  const v = Math.abs(value);
  const d = Math.floor(v);
  const m = Math.round((v - d) * 60);
  return `${d}°${String(m).padStart(2, '0')}′ ${value >= 0 ? pos : neg}`;
}

/** Une fiche du globe (textes en HTML). */
interface Entry {
  key: string;
  title: string;
  place: string;
  lat: number;
  lon: number;
  details: string[];
  facts: string[];
  question: { q: string; choices: string[]; answer: number };
  image?: string;
  link?: string;
  /** Pour les sites en direct : le texte n'apparaît qu'après la réponse (il la dévoilerait). */
  hideTitle?: boolean;
  revealAfter?: boolean;
}

const STATIC_ENTRIES: Entry[] = ANECDOTES.map((a) => ({ key: a.title, ...a }));
const SHARED_ROUNDS = 5;

/** Fiche d'un site UNESCO chargé en direct : le texte n'apparaît qu'après la réponse. */
function siteEntry(s: LiveSite): Entry {
  return {
    key: `unesco:${s.name}`,
    title: escapeHTML(s.name),
    place: escapeHTML(s.country),
    lat: s.lat,
    lon: s.lon,
    details: [escapeHTML(s.extract)],
    facts: ['Inscrit au patrimoine mondial de l’UNESCO.', `<a href="${s.url}" target="_blank" rel="noopener">Lire l’article sur Wikipédia</a>`],
    question: { ...s.question, answer: 0 },
    image: s.image,
    link: s.url,
    revealAfter: true,
    hideTitle: s.hideName,
  };
}

interface Spin {
  entry: Entry;
  from: number;
  to: number;
  t: number;
  camFrom: THREE.Vector3;
  camTo: THREE.Vector3;
}

/** Atelier Géographie : le globe tourne jusqu'à un lieu (anecdote intégrée ou site UNESCO en direct). */
export class GlobeGame implements Game {
  private ctx!: GameContext;
  private ui: HTMLElement;
  private body: HTMLElement;
  private counter: HTMLElement;
  private spinBtn: HTMLButtonElement;
  private seen = new Set<string>();
  private score = 0;
  private spin: Spin | null = null;
  private pin: THREE.Group | null = null;
  private ripple: THREE.Mesh | null = null;
  private pinAge = 0;
  private active = false;
  /** Prochain site chargé en direct, prêt à être utilisé (chargé à l'avance pour ne pas faire attendre). */
  private liveQueue: Entry[] = [];
  private liveLoading = false;
  /** Multijoueur : la série de lieux commune et l'étape en cours. */
  private shared: Entry[] | null = null;
  private sharedIndex = 0;

  constructor() {
    this.ui = el('div', 'globe-ui paper-panel hidden');
    this.ui.innerHTML = `
      <div class="kicker">Atelier de géographie</div>
      <h2>Le globe terrestre</h2>
      <div class="g-counter"></div>
      <div class="g-body"></div>
      <div class="btn-row">
        <button class="g-spin">Tourner encore <kbd>E</kbd></button>
        <button class="ghost g-back">Retour au labo</button>
      </div>`;
    document.body.appendChild(this.ui);
    this.prefetchLive();
    this.body = this.ui.querySelector('.g-body')!;
    this.counter = this.ui.querySelector('.g-counter')!;
    this.spinBtn = this.ui.querySelector('.g-spin')!;
    this.spinBtn.addEventListener('click', () => this.startSpin());
    this.ui.querySelector('.g-back')!.addEventListener('click', () => this.ctx.exit());
    // E ou Espace relance le globe
    addEventListener('keydown', (e) => {
      if (this.active && !this.shared && !this.spin && !this.spinBtn.disabled && (e.code === 'KeyE' || e.code === 'Space')) {
        e.preventDefault();
        this.startSpin();
      }
    });
  }

  open(ctx: GameContext, payload?: unknown) {
    this.ctx = ctx;
    this.active = true;
    // multijoueur : la même série de lieux pour tout le monde
    this.shared = (payload as Entry[] | undefined) ?? null;
    this.sharedIndex = 0;
    this.spinBtn.classList.toggle('hidden', !!this.shared);
    this.prefetchLive();
    const center = ctx.refs.globe.center;
    const dir = ctx.camera.position.clone().sub(center).setY(0).normalize();
    const pos = center.clone().addScaledVector(dir, VIEW_DIST).add(new THREE.Vector3(0, 0.12, 0));
    this.updateCounter();
    // Pas d'écran intermédiaire : dès que la caméra est devant le globe, il se met à tourner
    ctx.rig.flyTo(pos, this.viewQuat(pos), 0.5).then(() => {
      if (this.active) this.startSpin();
    });
  }

  close() {
    this.active = false;
    this.ui.classList.add('hidden');
    if (this.spin) {
      this.ctx.refs.globe.earth.rotation.y = this.spin.to;
      this.spin = null;
    }
    this.removePin();
  }

  /** Multijoueur, chez l'hôte : une série de lieux en direct (ou intégrés si le réseau traîne). */
  async makePayload(): Promise<Entry[]> {
    const timeout = <T>(p: Promise<T>) => Promise.race([p, wait(4000).then(() => Promise.reject(new Error('délai dépassé')))]);
    const live = await Promise.allSettled(Array.from({ length: SHARED_ROUNDS }, () => timeout(randomUnescoSite())));
    const entries = live.flatMap((r) => (r.status === 'fulfilled' ? [siteEntry(r.value)] : []));
    while (entries.length < SHARED_ROUNDS) entries.push(STATIC_ENTRIES[Math.floor(Math.random() * STATIC_ENTRIES.length)]);
    return entries;
  }

  onReveal(i: number, results: Result[]) {
    if (this.sharedIndex !== i) return;
    const box = this.body.querySelector('.g-multi');
    if (!box) return;
    box.innerHTML = resultsHTML(results, !!this.ctx.match?.isHost, i + 1 >= (this.shared?.length ?? 0));
    box.querySelector('.mp-next')?.addEventListener('click', () => this.ctx.match?.next(i + 1));
  }

  onNext(i: number) {
    if (!this.shared) return;
    this.sharedIndex = i;
    if (i < this.shared.length) return this.startSpin();
    this.body.innerHTML = `<h3>Tour du monde terminé</h3><p>${this.score} bonne${this.score > 1 ? 's' : ''} réponse${this.score > 1 ? 's' : ''}. Le classement des savants s’affiche…</p>`;
    this.ctx.match?.finish();
  }

  private prefetchLive() {
    if (this.liveQueue.length >= 2 || this.liveLoading) return;
    this.liveLoading = true;
    randomUnescoSite()
      .then((s) => {
        this.liveQueue.push(siteEntry(s));
        this.liveLoading = false;
        this.prefetchLive(); // on garde toujours deux sites d'avance
      })
      .catch((e) => {
        // pas de nouvel essai en boucle si le réseau est coupé : on réessaiera au prochain tour
        this.liveLoading = false;
        console.warn('Site UNESCO indisponible, anecdotes intégrées utilisées :', e);
      });
  }

  /** Un site en direct s'il en reste un de prêt, sinon une anecdote intégrée pas encore vue. */
  private nextEntry(): Entry {
    if (this.shared) return this.shared[this.sharedIndex];
    const live = this.liveQueue.shift();
    this.prefetchLive();
    if (live) return live;
    const unseen = STATIC_ENTRIES.filter((e) => !this.seen.has(e.key));
    const pool = unseen.length ? unseen : STATIC_ENTRIES;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /** La caméra vise un point à droite du globe, pour que le globe soit à gauche et le panneau à droite. */
  private viewQuat(pos: THREE.Vector3) {
    const center = this.ctx.refs.globe.center;
    const forward = center.clone().sub(pos).normalize();
    const right = forward.clone().cross(UP).normalize();
    return lookQuat(pos, center.clone().addScaledVector(right, 0.32));
  }

  private startSpin() {
    if (this.spin) return;
    const { earth, tilt, center } = this.ctx.refs.globe;
    const entry = this.nextEntry();

    // Angle de rotation qui amène le lieu face à la caméra (recherche par pas d'un demi-degré)
    const p = latLonDir(entry.lat, entry.lon);
    const tiltQ = tilt.getWorldQuaternion(new THREE.Quaternion());
    const camDir = this.ctx.camera.position.clone().sub(center).normalize();
    let best = 0;
    let bestDot = -2;
    for (let k = 0; k < 720; k++) {
      const th = (k / 720) * Math.PI * 2;
      const d = p.clone().applyAxisAngle(UP, th).applyQuaternion(tiltQ).dot(camDir);
      if (d > bestDot) {
        bestDot = d;
        best = th;
      }
    }
    const from = earth.rotation.y;
    const delta = (((best - from) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    // Face au lieu, mais sans passer sous le globe (pieds et cercle d'horizon) ni trop au-dessus
    const camTo = p.clone().applyAxisAngle(UP, best).applyQuaternion(tiltQ);
    camTo.y = THREE.MathUtils.clamp(camTo.y, -0.05, 0.5);
    camTo.normalize();
    this.spin = { entry, from, to: from + delta + Math.PI * 4, t: 0, camFrom: camDir, camTo };

    this.removePin();
    this.spinBtn.disabled = true;
    this.ui.classList.add('hidden'); // le panneau revient avec le nouveau lieu
  }

  update(_t: number, dt: number) {
    const { earth, center } = this.ctx?.refs.globe ?? {};
    if (this.spin && earth && center) {
      const s = this.spin;
      s.t = Math.min(1, s.t + dt / SPIN_TIME);
      const k = easeOut(s.t);
      earth.rotation.y = THREE.MathUtils.lerp(s.from, s.to, k);
      // La caméra glisse autour du globe jusqu'à se placer face au lieu
      const q = new THREE.Quaternion().setFromUnitVectors(s.camFrom, s.camTo);
      const dir = s.camFrom.clone().applyQuaternion(new THREE.Quaternion().slerp(q, THREE.MathUtils.smoothstep(k, 0, 1)));
      const pos = center.clone().addScaledVector(dir, VIEW_DIST);
      this.ctx.camera.position.copy(pos);
      this.ctx.camera.quaternion.copy(this.viewQuat(pos));
      if (s.t >= 1) {
        this.spin = null;
        this.plantPin(s.entry);
        setTimeout(() => this.showEntry(s.entry), 150);
      }
    }

    if (this.pin && this.ripple) {
      this.pinAge += dt;
      this.pin.scale.setScalar(easeOutBack(Math.min(1, this.pinAge / 0.5)));
      const r = (this.pinAge % 1.4) / 1.4;
      this.ripple.scale.setScalar(1 + r * 7);
      (this.ripple.material as THREE.MeshBasicMaterial).opacity = (1 - r) * 0.9;
    }
  }

  /** Épingle en laiton à tête rouge plantée sur le lieu, avec une onde qui s'élargit. */
  private plantPin(entry: Entry) {
    const n = latLonDir(entry.lat, entry.lon);
    const pin = new THREE.Group();
    pin.position.copy(n).multiplyScalar(GLOBE_RADIUS);
    pin.quaternion.setFromUnitVectors(UP, n);
    const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.06, 6), brass);
    needle.position.y = 0.02;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.009, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xb0181a, roughness: 0.3 }),
    );
    head.position.y = 0.05;
    pin.add(needle, head);
    pin.scale.setScalar(0);
    this.ctx.refs.globe.earth.add(pin);

    const ripple = new THREE.Mesh(
      new THREE.RingGeometry(0.008, 0.011, 32),
      new THREE.MeshBasicMaterial({ color: 0xb0181a, transparent: true, side: THREE.DoubleSide, depthWrite: false }),
    );
    ripple.position.copy(n).multiplyScalar(GLOBE_RADIUS + 0.001);
    ripple.lookAt(n.clone().multiplyScalar(2));
    this.ctx.refs.globe.earth.add(ripple);

    this.pin = pin;
    this.ripple = ripple;
    this.pinAge = 0;
  }

  private removePin() {
    for (const o of [this.pin, this.ripple]) o?.removeFromParent();
    this.pin = null;
    this.ripple = null;
  }

  private showEntry(a: Entry) {
    if (!this.active) return;
    const firstTime = !this.seen.has(a.key);
    this.seen.add(a.key);
    this.updateCounter();

    let i = 0;
    const r = () => `class="reveal" style="--i:${i++}"`;
    const coords = `${dms(a.lat, 'N', 'S')} · ${dms(a.lon, 'E', 'O')}`;
    const text = `
      ${a.details.map((p) => `<p>${p}</p>`).join('')}
      ${a.facts.length ? `<div class="g-facts"><h4>Le saviez-vous ?</h4><ul>${a.facts.map((f) => `<li>${f}</li>`).join('')}</ul></div>` : ''}`;
    this.body.innerHTML = `
      <div ${r()} class="g-place">${a.revealAfter ? 'Patrimoine mondial de l’UNESCO' : a.place} <span class="g-coords">${coords}</span></div>
      <h3 ${r()} class="g-title">${a.hideTitle ? 'Lieu mystère' : a.title}</h3>
      ${a.image ? `<img ${r()} class="g-photo" src="${a.image}" alt="" />` : ''}
      ${a.revealAfter ? `<div class="g-text hidden">${text}</div>` : `<div ${r()} class="g-text">${text}</div>`}
      <div ${r()} class="g-quiz"><div class="g-q">${a.question.q}</div><div class="g-choices"></div><div class="feedback"></div></div>
      <div class="g-multi"></div>`;
    const feedback = this.body.querySelector('.feedback')!;
    const shownAt = performance.now();
    choiceButtons(this.body.querySelector('.g-choices')!, a.question.choices, a.question.answer, (ok) => {
      if (ok && (firstTime || this.shared)) this.score++;
      if (this.ctx.match) {
        this.body.querySelector('.g-multi')!.innerHTML = waitingHTML;
        this.ctx.match.submit(this.sharedIndex, speedPoints(ok, (performance.now() - shownAt) / 1000), ok ? 'Juste' : 'Faux', ok);
      }
      feedback.innerHTML = ok ? 'Exact ! Bien vu.' : `Raté ! La réponse était : ${a.question.choices[a.question.answer]}.`;
      feedback.className = `feedback ${ok ? 'ok' : 'ko'}`;
      this.updateCounter();
      if (a.hideTitle) this.body.querySelector('.g-title')!.innerHTML = a.title;
      const hidden = this.body.querySelector('.g-text.hidden');
      if (hidden) {
        hidden.classList.remove('hidden');
        hidden.classList.add('reveal');
      }
    });
    this.spinBtn.disabled = false;
    this.ui.classList.remove('hidden', 'panel-in');
    void this.ui.offsetWidth; // rejoue l'animation d'arrivée
    this.ui.classList.add('panel-in');
    this.ui.scrollTop = 0;
  }

  private updateCounter() {
    this.counter.textContent = `Lieux découverts : ${this.seen.size} · Bonnes réponses : ${this.score}`;
  }
}
