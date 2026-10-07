import * as THREE from 'three';
import { BOOK_THEMES, type BookQuestion, type BookTheme } from '../data/books';
import { resultsHTML, speedPoints, waitingHTML, type Result } from '../match';
import { choiceButtons, el, scoreComment, shuffle, wait, type Game, type GameContext } from './game';
import './history.css';

const QUESTION_COUNT = 8;
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/**
 * Thème d'un livre de la bibliothèque, toujours le même pour un livre donné.
 * Tous les livres sont alimentés en direct par Wikipédia (anecdotes ou éphémérides) : questions infinies.
 * Les thèmes intégrés ne servent que de secours sans réseau.
 */
export function bookTheme(mesh: THREE.InstancedMesh, index: number): BookTheme {
  const live = BOOK_THEMES.filter((t) => t.live);
  return live[(mesh.userData.variant * 7 + index) % 3 === 0 ? 1 : 0] ?? BOOK_THEMES[0];
}

interface BookPayload {
  variant: number;
  index: number;
  questions: BookQuestion[];
}

interface BookTween {
  t: number;
  duration: number;
  from: { pos: THREE.Vector3; quat: THREE.Quaternion };
  to: { pos: THREE.Vector3; quat: THREE.Quaternion };
  done: () => void;
}

/** Atelier Livres : n'importe quel livre sort de la bibliothèque et s'ouvre sur un questionnaire de son thème. */
export class BookGame implements Game {
  private ctx!: GameContext;
  private stage: HTMLElement;
  private book: HTMLElement;
  private leftInner: HTMLElement;
  private rightInner: HTMLElement;
  private theme!: BookTheme;
  private questions: BookQuestion[] = [];
  private index = 0;
  private score = 0;
  private picked: { mesh: THREE.InstancedMesh; index: number; matrix: THREE.Matrix4 } | null = null;
  private tween: BookTween | null = null;
  private opened = false;
  private loading: Promise<void> | null = null;

  constructor() {
    this.stage = el('div', 'book-stage hidden');
    this.stage.innerHTML = `
      <div class="book closed">
        <div class="page right-page"><div class="page-inner"></div></div>
        <div class="cover">
          <div class="cover-front">
            <div class="cover-frame">
              <div class="cover-orn">✦ ❦ ✦</div>
              <div class="cover-title"></div>
              <div class="cover-orn">— MDCCCLXXX —</div>
            </div>
          </div>
          <div class="cover-back page left-page"><div class="page-inner"></div></div>
        </div>
      </div>
      <button class="ghost book-close">Ranger le livre</button>`;
    document.body.appendChild(this.stage);
    this.book = this.stage.querySelector('.book')!;
    this.leftInner = this.stage.querySelector('.left-page .page-inner')!;
    this.rightInner = this.stage.querySelector('.right-page .page-inner')!;
    this.stage.querySelector('.book-close')!.addEventListener('click', () => this.ctx.exit());
  }

  open(ctx: GameContext, payload?: unknown) {
    this.ctx = ctx;
    // multijoueur : tout le monde ouvre le même livre, avec les mêmes questions
    const shared = payload as BookPayload | undefined;
    if (shared) {
      const mesh = ctx.refs.library.books.find((b) => b.userData.variant === shared.variant);
      if (mesh) ctx.refs.library.selected = { mesh, index: shared.index };
    }
    const sel = ctx.refs.library.selected;
    if (!sel) return;
    this.opened = true;

    // On remplace le livre instancié par une copie animable, au même endroit
    const proxy = ctx.refs.library.proxy;
    const matrix = new THREE.Matrix4();
    sel.mesh.getMatrixAt(sel.index, matrix);
    this.picked = { mesh: sel.mesh, index: sel.index, matrix: matrix.clone() };
    matrix.decompose(proxy.position, proxy.quaternion, proxy.scale);
    proxy.material = sel.mesh.material;
    proxy.visible = true;
    sel.mesh.setMatrixAt(sel.index, new THREE.Matrix4().makeScale(0, 0, 0));
    sel.mesh.instanceMatrix.needsUpdate = true;

    this.theme = bookTheme(sel.mesh, sel.index);
    if (shared) this.questions = shared.questions;
    this.loading = shared ? Promise.resolve() : this.loadQuestions();
    this.index = 0;
    this.score = 0;
    this.stage.querySelector('.cover-title')!.textContent = this.theme.title;
    this.stage.style.setProperty('--leather', sel.mesh.userData.color);

    const bookWorld = proxy.getWorldPosition(new THREE.Vector3());
    const camPos = new THREE.Vector3(bookWorld.x + 0.15, THREE.MathUtils.clamp(bookWorld.y + 0.1, 1.2, 1.9), bookWorld.z + 1.25);
    ctx.rig.lookFrom(camPos, bookWorld, 0.45).then(() => this.pullOutBook());
  }

  close() {
    this.opened = false;
    this.tween = null;
    this.stage.classList.add('hidden');
    this.stage.classList.remove('on');
    this.book.classList.remove('open');
    this.book.classList.add('closed');
    this.stage.querySelector('.leaf')?.remove();
    // Remet le livre sur son étagère
    if (this.picked) {
      this.picked.mesh.setMatrixAt(this.picked.index, this.picked.matrix);
      this.picked.mesh.instanceMatrix.needsUpdate = true;
      this.picked = null;
    }
    this.ctx.refs.library.proxy.visible = false;
  }

  /** Le livre glisse hors de l'étagère puis vient devant les yeux, couverture face à nous. */
  private async pullOutBook() {
    if (!this.opened) return; // quitté pendant le trajet
    const proxy = this.ctx.refs.library.proxy;
    const out = proxy.position.clone().add(new THREE.Vector3(0, 0.02, 0.26));
    await this.animateBook(out, proxy.quaternion.clone(), 0.25);
    if (!this.opened) return;

    const cam = this.ctx.camera;
    const front = new THREE.Vector3(0, -0.04, -0.5).applyQuaternion(cam.quaternion).add(cam.position);
    const localFront = proxy.parent!.worldToLocal(front);
    const coverToCamera = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, -Math.PI / 2, 0));
    await this.animateBook(localFront, coverToCamera, 0.35);
    if (!this.opened) return;

    proxy.visible = false;
    await this.loading; // les questions en direct ont eu le temps d'arriver pendant l'animation
    if (!this.opened) return;
    this.showQuestionPages(0, true);
    this.stage.classList.remove('hidden');
    requestAnimationFrame(() => this.stage.classList.add('on'));
    await wait(120);
    if (!this.opened) return;
    this.book.classList.remove('closed');
    this.book.classList.add('open');
  }

  private animateBook(pos: THREE.Vector3, quat: THREE.Quaternion, duration: number) {
    const proxy = this.ctx.refs.library.proxy;
    return new Promise<void>((done) => {
      this.tween = { t: 0, duration, from: { pos: proxy.position.clone(), quat: proxy.quaternion.clone() }, to: { pos, quat }, done };
    });
  }

  update(_t: number, dt: number) {
    const tw = this.tween;
    if (!tw) return;
    tw.t = Math.min(1, tw.t + dt / tw.duration);
    const k = ease(tw.t);
    const proxy = this.ctx.refs.library.proxy;
    proxy.position.lerpVectors(tw.from.pos, tw.to.pos, k);
    proxy.quaternion.slerpQuaternions(tw.from.quat, tw.to.quat, k);
    if (tw.t >= 1) {
      this.tween = null;
      tw.done();
    }
  }

  /** Multijoueur, chez l'hôte : le livre visé par celui qui lance la partie (ou un livre au hasard). */
  async makePayload(hint?: unknown): Promise<BookPayload> {
    const books = this.ctxBooks();
    const h = hint as { variant: number; index: number } | undefined;
    const mesh = (h && books.find((b) => b.userData.variant === h.variant)) || books[Math.floor(Math.random() * books.length)];
    const index = h?.index ?? Math.floor(Math.random() * mesh.count);
    this.theme = bookTheme(mesh, index);
    await this.loadQuestions();
    return { variant: mesh.userData.variant, index, questions: this.questions };
  }

  /** Les livres de la bibliothèque (le contexte peut ne pas encore exister chez l'hôte). */
  private ctxBooks() {
    return this.books ?? this.ctx.refs.library.books;
  }

  /** Donné par main.ts dès que le labo est construit. */
  books: THREE.InstancedMesh[] | null = null;

  onReveal(i: number, results: Result[]) {
    if (this.index !== i) return;
    const box = this.rightInner.querySelector('.pg-multi')!;
    box.innerHTML = resultsHTML(results, !!this.ctx.match?.isHost, i + 1 >= this.questions.length);
    box.querySelector('.mp-next')?.addEventListener('click', () => this.ctx.match?.next(i + 1));
  }

  onNext(i: number) {
    if (i === this.index + 1) this.turnPage();
  }

  /** Questions du livre : en direct si le thème le permet, sinon (ou en cas d'échec) celles intégrées. */
  private async loadQuestions() {
    const fallback = this.theme.questions.length ? this.theme.questions : BOOK_THEMES.flatMap((t) => t.questions);
    this.questions = shuffle(fallback).slice(0, QUESTION_COUNT);
    if (!this.theme.live) return;
    try {
      const timeout = wait(12000).then(() => Promise.reject(new Error('délai dépassé')));
      this.questions = await Promise.race([this.theme.live(QUESTION_COUNT), timeout]);
    } catch (e) {
      console.warn('Questions en direct indisponibles, contenu intégré utilisé :', e);
    }
  }

  // ---------- Contenu des pages ----------

  private leftPageHTML(i: number) {
    const q = this.questions[i];
    const big = q.title ?? q.q;
    return `
      <div class="pg-head">Chapitre ${ROMAN[i]} · ${this.theme.title}</div>
      <div class="pg-orn">❦</div>
      <p class="pg-event"><span class="dropcap">${big.charAt(0)}</span>${big.slice(1)}</p>
      <div class="pg-rule"></div>
      ${q.title ? `<p class="pg-q">${q.q}</p>` : ''}
      <div class="pg-num">— ${i * 2 + 1} —</div>`;
  }

  private renderRightPage(i: number) {
    this.rightInner.innerHTML = `
      <div class="pg-head">Réponses</div>
      <ol class="ink-list"></ol>
      <p class="pg-explain"></p>
      <div class="pg-multi"></div>
      <div class="pg-foot"><span class="pg-score">Score : ${this.score} / ${i}</span><button class="pg-turn hidden">Tourner la page ⟶</button></div>
      <div class="pg-num">— ${i * 2 + 2} —</div>`;
    const q = this.questions[i];
    const shownAt = performance.now();
    choiceButtons(this.rightInner.querySelector('.ink-list')!, q.choices, 0, (ok) => {
      if (ok) this.score++;
      const explain = this.rightInner.querySelector('.pg-explain')!;
      explain.innerHTML = `<b>${ok ? 'Exact !' : 'Hélas, non.'}</b> ${q.explain}`;
      explain.classList.add('reveal');
      this.rightInner.querySelector('.pg-score')!.textContent = `Score : ${this.score} / ${i + 1}`;
      if (this.ctx.match) {
        // multijoueur : on attend les autres, l'hôte tournera la page pour tout le monde
        this.rightInner.querySelector('.pg-multi')!.innerHTML = waitingHTML;
        this.ctx.match.submit(i, speedPoints(ok, (performance.now() - shownAt) / 1000), ok ? 'Juste' : 'Faux', ok);
        return;
      }
      const turn = this.rightInner.querySelector('.pg-turn')!;
      turn.textContent = i + 1 < this.questions.length ? 'Tourner la page ⟶' : 'Voir le bilan ⟶';
      turn.classList.remove('hidden');
      turn.addEventListener('click', () => this.turnPage());
    }, 'ink-choice');
  }

  private showQuestionPages(i: number, immediate = false) {
    this.index = i;
    if (immediate) this.leftInner.innerHTML = this.leftPageHTML(i);
    this.renderRightPage(i);
  }

  /** Tourne la page : un feuillet passe de droite à gauche, en montrant au verso la nouvelle page de gauche. */
  private async turnPage() {
    const next = this.index + 1;
    const leaf = el('div', 'leaf');
    const front = el('div', 'leaf-front page right-page');
    front.innerHTML = `<div class="page-inner">${this.rightInner.innerHTML}</div>`;
    front.querySelectorAll('button').forEach((b) => (b.disabled = true));
    const back = el('div', 'leaf-back page left-page');
    const newLeft = next < this.questions.length ? this.leftPageHTML(next) : this.endLeftHTML();
    back.innerHTML = `<div class="page-inner">${newLeft}</div>`;
    leaf.append(front, back);
    this.book.appendChild(leaf);

    if (next < this.questions.length) this.showQuestionPages(next);
    else this.renderSummary();

    void leaf.offsetWidth;
    leaf.classList.add('turning');
    await wait(500);
    this.leftInner.innerHTML = newLeft;
    leaf.remove();
  }

  private endLeftHTML() {
    return `
      <div class="pg-head">Épilogue</div>
      <div class="pg-orn big">❦</div>
      <p class="pg-event center">Ainsi s'achève « ${this.theme.title} ». D'autres volumes t'attendent sur les étagères…</p>
      <div class="pg-rule"></div>
      <div class="pg-num">— ${this.questions.length * 2 + 1} —</div>`;
  }

  private renderSummary() {
    this.rightInner.innerHTML = `
      <div class="pg-head">Bilan</div>
      <p class="pg-big">${this.score} / ${this.questions.length}</p>
      <p class="pg-event center">${this.ctx.match ? 'Le classement des savants s’affiche…' : scoreComment(this.score, this.questions.length)}</p>
      <div class="pg-foot">${this.ctx.match ? '' : '<button class="pg-again">Relire ce livre</button>'}</div>`;
    this.rightInner.querySelector('.pg-again')?.addEventListener('click', () => {
      this.score = 0;
      this.index = -1;
      this.loadQuestions().then(() => this.turnPage());
    });
    if (this.ctx.match) this.ctx.match.finish();
  }
}
