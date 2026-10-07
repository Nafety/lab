import { SCIENCE } from '../data/science';
import { escapeHTML, hoaxCards, type HoaxCard } from '../live';
import { resultsHTML, speedPoints, waitingHTML, type Result } from '../match';
import { el, scoreComment, shuffle, wait, type Game, type GameContext } from './game';
import './hoax.css';

const ROUNDS = 10;

/** Si Wikipédia ne répond pas : affirmations tirées des questions intégrées (bonne ou mauvaise réponse). */
function fallbackCards(): HoaxCard[] {
  return shuffle(SCIENCE).slice(0, ROUNDS).map((q) => {
    const isTrue = Math.random() < 0.5;
    const answer = isTrue ? q.choices[0] : q.choices[1 + Math.floor(Math.random() * (q.choices.length - 1))];
    return { text: `${q.q} — ${answer}.`, isTrue, truth: `${q.q} — ${q.choices[0]}.`, year: 0 };
  });
}

/** Atelier du bureau : « Fact-checking ». On tamponne chaque information VRAI ou FAKE NEWS. */
export class HoaxGame implements Game {
  private ctx!: GameContext;
  private root: HTMLElement;
  private cards: HoaxCard[] = [];
  private index = 0;
  private score = 0;
  private streak = 0;
  private answered = false;
  private active = false;
  private shownAt = 0;

  constructor() {
    this.root = el('div', 'hoax hidden');
    document.body.appendChild(this.root);
    addEventListener('keydown', (e) => {
      if (!this.active || this.root.classList.contains('hidden')) return;
      if (!this.answered && (e.code === 'ArrowLeft' || e.code === 'KeyA')) this.judge(true);
      else if (!this.answered && (e.code === 'ArrowRight' || e.code === 'KeyC')) this.judge(false);
      else if (this.answered && !this.ctx.match && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        this.next();
      }
    });
  }

  open(ctx: GameContext, payload?: unknown) {
    this.ctx = ctx;
    this.active = true;
    this.index = 0;
    this.score = 0;
    this.streak = 0;
    if (payload) this.cards = payload as HoaxCard[];
    const loading = payload ? Promise.resolve() : this.load();
    const { pos, target } = ctx.refs.anchors.bureau.view;
    Promise.all([ctx.rig.lookFrom(pos, target, 0.45), loading]).then(() => {
      if (!this.active) return;
      this.root.classList.remove('hidden');
      this.render();
    });
  }

  async makePayload() {
    await this.load();
    return this.cards;
  }

  close() {
    this.active = false;
    this.root.classList.add('hidden');
  }

  onReveal(i: number, results: Result[]) {
    if (this.index !== i) return;
    const box = this.root.querySelector('.hoax-multi')!;
    box.innerHTML = resultsHTML(results, !!this.ctx.match?.isHost, i + 1 >= this.cards.length);
    box.querySelector('.mp-next')?.addEventListener('click', () => this.ctx.match?.next(i + 1));
  }

  onNext(i: number) {
    this.index = i;
    if (i < this.cards.length) this.render();
    else this.summary();
  }

  private async load() {
    try {
      const timeout = wait(1500).then(() => Promise.reject(new Error('délai dépassé')));
      this.cards = await Promise.race([hoaxCards(ROUNDS), timeout]);
    } catch (e) {
      console.warn('Anecdotes indisponibles, contenu intégré utilisé :', e);
      this.cards = fallbackCards();
    }
  }

  private render() {
    const c = this.cards[this.index];
    this.answered = false;
    this.shownAt = performance.now();
    this.root.innerHTML = `
      <div class="hoax-folder">
        <div class="hoax-tab">Dossier n° ${String(this.index + 1).padStart(2, '0')} / ${this.cards.length}</div>
        <div class="kicker">Bureau du fact-checking</div>
        <h2>Vrai ou fake news ?</h2>
        <div class="hoax-card"><p>${escapeHTML(c.text)}</p><div class="hoax-stamp"></div></div>
        <div class="hoax-verdict"></div>
        <div class="hoax-multi"></div>
        <div class="hoax-actions">
          <button class="stamp-btn ok" data-v="1">Vrai <kbd>←</kbd></button>
          <button class="stamp-btn ko" data-v="0">Fake news <kbd>→</kbd></button>
        </div>
        <div class="hoax-foot"><span>Score : ${this.score} / ${this.index}</span><span>Série : ${this.streak}</span>
          <button class="ghost hoax-quit">Se lever du bureau</button></div>
      </div>`;
    this.root.querySelectorAll<HTMLButtonElement>('.stamp-btn').forEach((b) => b.addEventListener('click', () => this.judge(b.dataset.v === '1')));
    this.root.querySelector('.hoax-quit')!.addEventListener('click', () => this.ctx.exit());
  }

  private judge(saysTrue: boolean) {
    if (this.answered) return;
    this.answered = true;
    const c = this.cards[this.index];
    const ok = saysTrue === c.isTrue;
    if (ok) {
      this.score++;
      this.streak++;
    } else this.streak = 0;

    const stamp = this.root.querySelector('.hoax-stamp')!;
    stamp.textContent = saysTrue ? 'VRAI' : 'FAKE NEWS';
    stamp.className = `hoax-stamp on ${saysTrue ? 'ok' : 'ko'}`;
    const source = c.year ? ` <span class="source">— « Le saviez-vous ? » de Wikipédia, ${c.year}</span>` : '';
    const multi = !!this.ctx.match;
    this.root.querySelector('.hoax-verdict')!.innerHTML = `
      <b class="${ok ? 'good' : 'bad'}">${ok ? 'Bien vérifié !' : 'Tu t’es fait avoir…'}</b>
      ${c.isTrue ? 'Cette information est vraie.' : `C'était une fake news. La vraie version : « ${escapeHTML(c.truth)} »`}${source}
      ${multi ? '' : `<div class="btn-row"><button class="hoax-next">${this.index + 1 < this.cards.length ? 'Dossier suivant' : 'Voir le bilan'} <kbd>Entrée</kbd></button></div>`}`;
    this.root.querySelectorAll<HTMLButtonElement>('.stamp-btn').forEach((b) => (b.disabled = true));
    this.root.querySelector('.hoax-next')?.addEventListener('click', () => this.next());
    this.root.querySelector('.hoax-foot span')!.textContent = `Score : ${this.score} / ${this.index + 1}`;
    this.root.querySelectorAll('.hoax-foot span')[1].textContent = `Série : ${this.streak}`;
    if (multi) {
      this.root.querySelector('.hoax-multi')!.innerHTML = waitingHTML;
      this.ctx.match!.submit(this.index, speedPoints(ok, (performance.now() - this.shownAt) / 1000), saysTrue ? 'Vrai' : 'Fake news', ok);
    }
  }

  private next() {
    if (++this.index < this.cards.length) return this.render();
    this.summary();
  }

  private summary() {
    const multi = !!this.ctx.match;
    this.root.innerHTML = `
      <div class="hoax-folder">
        <div class="kicker">Enquête terminée</div>
        <h2>${this.score} / ${this.cards.length}</h2>
        <p>${multi ? 'Le classement des savants s’affiche…' : scoreComment(this.score, this.cards.length)}</p>
        <div class="btn-row">${multi ? '' : '<button class="hoax-again">Nouvelle enquête</button>'}<button class="ghost hoax-quit">Se lever du bureau</button></div>
      </div>`;
    this.root.querySelector('.hoax-again')?.addEventListener('click', () => {
      this.index = 0;
      this.score = 0;
      this.streak = 0;
      this.load().then(() => this.render());
    });
    this.root.querySelector('.hoax-quit')!.addEventListener('click', () => this.ctx.exit());
    if (multi) this.ctx.match!.finish();
  }
}
