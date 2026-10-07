import { HISTORY } from '../data/history';
import { escapeHTML, timelineEvents } from '../live';
import { resultsHTML, waitingHTML, type Result } from '../match';
import { el, shuffle, wait, type Game, type GameContext } from './game';
import './timeline.css';

const COUNT = 5;
const SHARED_ROUNDS = 3;

interface Card {
  year: number;
  text: string;
}

interface Series {
  cards: Card[];
  day: string;
}

/** Si Wikipédia ne répond pas : des événements intégrés aux années bien espacées. */
function fallbackCards(): Card[] {
  const picked: Card[] = [];
  for (const h of shuffle(HISTORY)) {
    if (picked.every((p) => Math.abs(p.year - h.year) >= 20)) picked.push({ year: h.year, text: h.event });
    if (picked.length === COUNT) break;
  }
  return picked;
}

/** Une série de 5 événements : en direct (un jour au hasard), sinon intégrée. */
async function loadSeries(): Promise<Series> {
  try {
    const timeout = wait(2500).then(() => Promise.reject(new Error('délai dépassé')));
    const events = await Promise.race([timelineEvents(COUNT), timeout]);
    return { cards: shuffle(events.map((e) => ({ year: e.year, text: e.text }))), day: `Tous ces événements ont eu lieu un ${events[0].day}.` };
  } catch (e) {
    console.warn('Événements indisponibles, contenu intégré utilisé :', e);
    return { cards: shuffle(fallbackCards()), day: '' };
  }
}

const yearLabel = (y: number) => (y < 0 ? `${-y} av. J.-C.` : String(y));

/** Atelier de la pendule : remettre des événements dans l'ordre chronologique (glisser-déposer). */
export class TimelineGame implements Game {
  private ctx!: GameContext;
  private root: HTMLElement;
  private cards: Card[] = [];
  private day = '';
  private checked = false;
  private active = false;
  private rounds = 0;
  private total = 0;
  private shownAt = 0;
  /** Multijoueur : les séries communes et la série en cours. */
  private shared: Series[] | null = null;
  private round = 0;

  constructor() {
    this.root = el('div', 'timeline hidden');
    document.body.appendChild(this.root);
  }

  open(ctx: GameContext, payload?: unknown) {
    this.ctx = ctx;
    this.active = true;
    this.shared = (payload as Series[] | undefined) ?? null;
    this.round = 0;
    this.rounds = 0;
    this.total = 0;
    const loading = this.shared ? Promise.resolve(this.useSeries(this.shared[0])) : this.load();
    const { pos, target } = ctx.refs.anchors.clock.view;
    Promise.all([ctx.rig.lookFrom(pos, target, 0.45), loading]).then(() => {
      if (!this.active) return;
      this.root.classList.remove('hidden');
      this.render();
    });
  }

  async makePayload(): Promise<Series[]> {
    const series: Series[] = [];
    for (let i = 0; i < SHARED_ROUNDS; i++) series.push(await loadSeries());
    return series;
  }

  close() {
    this.active = false;
    this.root.classList.add('hidden');
  }

  onReveal(i: number, results: Result[]) {
    if (this.round !== i) return;
    const box = this.root.querySelector('.tl-multi')!;
    box.innerHTML = resultsHTML(results, !!this.ctx.match?.isHost, i + 1 >= (this.shared?.length ?? 0));
    box.querySelector('.mp-next')?.addEventListener('click', () => this.ctx.match?.next(i + 1));
  }

  onNext(i: number) {
    if (!this.shared) return;
    this.round = i;
    if (i < this.shared.length) {
      this.useSeries(this.shared[i]);
      return this.render();
    }
    this.root.querySelector('.tl-panel')!.innerHTML = `
      <div class="kicker">La pendule du temps</div>
      <h2>Fin des séries</h2>
      <p>${this.total} cartes bien placées sur ${this.rounds * COUNT}. Le classement des savants s’affiche…</p>
      <div class="btn-row"><button class="ghost tl-quit">Quitter la pendule</button></div>`;
    this.root.querySelector('.tl-quit')!.addEventListener('click', () => this.ctx.exit());
    this.ctx.match?.finish();
  }

  private useSeries(s: Series) {
    this.cards = [...s.cards];
    this.day = s.day;
    this.checked = false;
  }

  private async load() {
    this.useSeries(await loadSeries());
  }

  private render() {
    const multi = !!this.ctx.match;
    this.shownAt = performance.now();
    this.root.innerHTML = `
      <div class="tl-panel">
        <div class="kicker">La pendule du temps${multi ? ` · série ${this.round + 1} / ${this.shared?.length}` : ''}</div>
        <h2>Remets l'Histoire à l'heure</h2>
        <p class="tl-help">Range ces événements du <b>plus ancien</b> (en haut) au <b>plus récent</b> (en bas) : glisse les cartes ou utilise les flèches. ${this.day}</p>
        <ol class="tl-list"></ol>
        <div class="tl-result"></div>
        <div class="tl-multi"></div>
        <div class="btn-row"><button class="tl-check">Valider l'ordre</button><button class="ghost tl-quit">Quitter la pendule</button></div>
      </div>`;
    this.root.querySelector('.tl-check')!.addEventListener('click', () => (this.checked ? this.nextRound() : this.check()));
    this.root.querySelector('.tl-quit')!.addEventListener('click', () => this.ctx.exit());
    this.renderList();
  }

  private renderList() {
    const list = this.root.querySelector('.tl-list')!;
    list.innerHTML = '';
    this.cards.forEach((c, i) => {
      const li = el('li', 'tl-card', `
        <span class="tl-grip">⋮⋮</span>
        <span class="tl-text">${escapeHTML(c.text.charAt(0).toUpperCase() + c.text.slice(1))}</span>
        <span class="tl-year">${yearLabel(c.year)}</span>
        <span class="tl-moves"><button class="ghost" data-d="-1" ${i === 0 ? 'disabled' : ''}>▲</button><button class="ghost" data-d="1" ${i === this.cards.length - 1 ? 'disabled' : ''}>▼</button></span>`);
      li.draggable = !this.checked;
      li.dataset.i = String(i);
      li.querySelectorAll<HTMLButtonElement>('.tl-moves button').forEach((b) => b.addEventListener('click', () => this.move(i, i + Number(b.dataset.d))));
      li.addEventListener('dragstart', (e) => {
        e.dataTransfer!.setData('text/plain', String(i));
        li.classList.add('dragging');
      });
      li.addEventListener('dragend', () => li.classList.remove('dragging'));
      li.addEventListener('dragover', (e) => e.preventDefault());
      li.addEventListener('drop', (e) => {
        e.preventDefault();
        this.move(Number(e.dataTransfer!.getData('text/plain')), i);
      });
      list.appendChild(li);
    });
  }

  /** Déplace une carte, avec une petite animation de glissement (technique FLIP). */
  private move(from: number, to: number) {
    if (this.checked || from === to || to < 0 || to >= this.cards.length) return;
    const before = this.positions();
    const [c] = this.cards.splice(from, 1);
    this.cards.splice(to, 0, c);
    this.renderList();
    this.animateFrom(before);
  }

  private positions() {
    const map = new Map<Card, number>();
    this.root.querySelectorAll<HTMLElement>('.tl-card').forEach((li) => map.set(this.cards[Number(li.dataset.i)], li.getBoundingClientRect().top));
    return map;
  }

  private animateFrom(before: Map<Card, number>) {
    this.root.querySelectorAll<HTMLElement>('.tl-card').forEach((li) => {
      const old = before.get(this.cards[Number(li.dataset.i)]);
      if (old === undefined) return;
      const dy = old - li.getBoundingClientRect().top;
      if (!dy) return;
      li.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 220, easing: 'ease-out' });
    });
  }

  private async check() {
    this.checked = true;
    const sorted = [...this.cards].sort((a, b) => a.year - b.year);
    const good = this.cards.filter((c, i) => c === sorted[i]).length;
    this.rounds++;
    this.total += good;
    this.renderList();
    this.root.querySelectorAll<HTMLElement>('.tl-card').forEach((li, i) => {
      li.classList.add('revealed', this.cards[i] === sorted[i] ? 'right' : 'wrong');
    });
    this.root.querySelector('.tl-result')!.innerHTML = `<b>${good} / ${COUNT}</b> bien placés. ${good === COUNT ? 'Parfait, la pendule sonne juste !' : 'Voici le bon ordre…'}`;
    const checkBtn = this.root.querySelector('.tl-check') as HTMLButtonElement;
    if (this.ctx.match) {
      // multijoueur : 30 points par carte bien placée, bonus de rapidité pour un sans-faute
      checkBtn.classList.add('hidden');
      this.root.querySelector('.tl-multi')!.innerHTML = waitingHTML;
      const seconds = (performance.now() - this.shownAt) / 1000;
      const points = good * 30 + (good === COUNT ? Math.max(0, Math.round(60 - seconds * 2)) : 0);
      this.ctx.match.submit(this.round, points, `${good}/${COUNT} bien placés`, good === COUNT);
    } else checkBtn.textContent = 'Nouvelle série';
    if (good === COUNT) return;
    await wait(900);
    if (!this.active) return;
    const before = this.positions();
    this.cards = sorted;
    this.renderList();
    this.root.querySelectorAll<HTMLElement>('.tl-card').forEach((li) => li.classList.add('revealed', 'right'));
    this.animateFrom(before);
  }

  private async nextRound() {
    await this.load();
    this.render();
    const result = this.root.querySelector('.tl-result')!;
    result.textContent = `Total : ${this.total} cartes bien placées sur ${this.rounds * COUNT}.`;
  }
}
