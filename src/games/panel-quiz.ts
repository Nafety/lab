import type * as THREE from 'three';
import type { SimpleQuestion } from '../data/science';
import { resultsHTML, speedPoints, waitingHTML, type Result } from '../match';
import { el, scoreComment, shuffle, wait, type Game, type GameContext } from './game';

export interface PanelQuizConfig {
  /** Classe CSS de l'habillage (carnet, apothicaire…). */
  className: string;
  title: string;
  kicker: (i: number, n: number) => string;
  pool: SimpleQuestion[];
  count: number;
  quitLabel: string;
  /** Pose de la caméra devant l'atelier. */
  view: (ctx: GameContext) => { pos: THREE.Vector3; target: THREE.Vector3 };
  /** Dessine les choix ; la bonne réponse est q.choices[0]. */
  renderChoices: (container: HTMLElement, q: SimpleQuestion, onDone: (ok: boolean) => void) => void;
  /** Questions chargées en direct ; `pool` sert de secours. */
  live?: (count: number) => Promise<SimpleQuestion[]>;
}

/** Atelier en forme de questionnaire : la caméra se place devant le meuble, un panneau propose les questions. */
export class PanelQuiz implements Game {
  private ctx!: GameContext;
  private root: HTMLElement;
  private panel: HTMLElement;
  private questions: SimpleQuestion[] = [];
  private score = 0;
  private index = 0;
  private active = false;

  constructor(private cfg: PanelQuizConfig) {
    this.root = el('div', `pq-root ${cfg.className} hidden`);
    this.panel = el('div', 'pq-panel');
    this.root.appendChild(this.panel);
    document.body.appendChild(this.root);
  }

  open(ctx: GameContext, payload?: unknown) {
    this.ctx = ctx;
    this.active = true;
    this.score = 0;
    // en multijoueur, tout le monde reçoit les questions préparées par l'hôte
    if (payload) this.questions = payload as SimpleQuestion[];
    const loading = payload ? Promise.resolve() : this.loadQuestions();
    const { pos, target } = this.cfg.view(ctx);
    Promise.all([ctx.rig.lookFrom(pos, target, 0.45), loading]).then(() => {
      if (!this.active) return; // quitté pendant le trajet
      this.showQuestion(0);
      this.root.classList.remove('hidden');
    });
  }

  async makePayload() {
    await this.loadQuestions();
    return this.questions;
  }

  /** Questions en direct (déjà préchargées en général), sinon celles intégrées si elles tardent. */
  private async loadQuestions() {
    this.questions = shuffle(this.cfg.pool).slice(0, this.cfg.count);
    if (!this.cfg.live) return;
    try {
      const timeout = wait(1500).then(() => Promise.reject(new Error('délai dépassé')));
      this.questions = await Promise.race([this.cfg.live(this.cfg.count), timeout]);
    } catch (e) {
      console.warn('Questions en direct indisponibles, contenu intégré utilisé :', e);
    }
  }

  close() {
    this.active = false;
    this.root.classList.add('hidden');
  }

  onReveal(i: number, results: Result[]) {
    if (this.index !== i) return;
    const box = this.panel.querySelector('.pq-multi')!;
    box.innerHTML = resultsHTML(results, !!this.ctx.match?.isHost, i + 1 >= this.questions.length);
    box.querySelector('.mp-next')?.addEventListener('click', () => this.ctx.match?.next(i + 1));
  }

  onNext(i: number) {
    if (i < this.questions.length) this.showQuestion(i);
    else this.showSummary();
  }

  private header(sub: string) {
    return `<div class="kicker">${sub}</div><h2 class="pq-title">${this.cfg.title}</h2>`;
  }

  private showQuestion(i: number) {
    this.index = i;
    const q = this.questions[i];
    const n = this.questions.length;
    const multi = !!this.ctx.match;
    const shownAt = performance.now();
    this.panel.innerHTML = `
      ${this.header(this.cfg.kicker(i, n))}
      <h3 class="pq-q">${q.q}</h3>
      <div class="pq-choices"></div>
      <div class="feedback"></div>
      <p class="pq-explain hidden"></p>
      <div class="pq-multi"></div>
      <div class="btn-row">
        <button class="pq-next hidden">${i + 1 < n ? 'Question suivante' : 'Voir le bilan'}</button>
        <button class="ghost pq-quit">${this.cfg.quitLabel}</button>
      </div>
      <div class="pq-score">Score : ${this.score} / ${i}</div>`;
    this.panel.querySelector('.pq-quit')!.addEventListener('click', () => this.ctx.exit());
    const next = this.panel.querySelector('.pq-next')!;
    next.addEventListener('click', () => (i + 1 < n ? this.showQuestion(i + 1) : this.showSummary()));
    this.restartAnimation();

    this.cfg.renderChoices(this.panel.querySelector('.pq-choices')!, q, (ok) => {
      if (ok) this.score++;
      const fb = this.panel.querySelector('.feedback')!;
      fb.textContent = ok ? 'Bonne réponse !' : `Raté… La bonne réponse était : ${q.choices[0]}.`;
      fb.className = `feedback ${ok ? 'ok' : 'ko'}`;
      const ex = this.panel.querySelector('.pq-explain')!;
      ex.textContent = q.explain;
      ex.classList.remove('hidden');
      ex.classList.add('reveal');
      this.panel.querySelector('.pq-score')!.textContent = `Score : ${this.score} / ${i + 1}`;
      if (multi) {
        // on attend les autres : c'est l'hôte qui fera passer tout le monde à la suite
        this.panel.querySelector('.pq-multi')!.innerHTML = waitingHTML;
        this.ctx.match!.submit(i, speedPoints(ok, (performance.now() - shownAt) / 1000), ok ? 'Juste' : 'Faux', ok);
      } else next.classList.remove('hidden');
    });
  }

  private showSummary() {
    const n = this.questions.length;
    const multi = !!this.ctx.match;
    this.panel.innerHTML = `
      ${this.header('Bilan')}
      <p class="pq-big">${this.score} / ${n}</p>
      <p>${multi ? 'Le classement des savants s’affiche…' : scoreComment(this.score, n)}</p>
      <div class="btn-row">${multi ? '' : '<button class="pq-again">Recommencer</button>'}<button class="ghost pq-quit">${this.cfg.quitLabel}</button></div>`;
    this.panel.querySelector('.pq-again')?.addEventListener('click', () => {
      this.score = 0;
      this.loadQuestions().then(() => this.showQuestion(0));
    });
    this.panel.querySelector('.pq-quit')!.addEventListener('click', () => this.ctx.exit());
    this.restartAnimation();
    if (multi) this.ctx.match!.finish();
  }

  /** Rejoue l'animation d'arrivée de la page. */
  private restartAnimation() {
    this.panel.classList.remove('turn');
    void this.panel.offsetWidth;
    this.panel.classList.add('turn');
  }
}
