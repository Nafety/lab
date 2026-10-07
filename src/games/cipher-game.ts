import { anagramAnecdote, escapeHTML } from '../live';
import { resultsHTML, waitingHTML, type Result } from '../match';
import { el, shuffle, wait, type Game, type GameContext } from './game';
import './cipher.css';

/**
 * Atelier du coffre : une vraie énigme à résoudre pour l'ouvrir.
 * Quatre sortes, tirées au hasard : cadenas logique, anagramme, suite logique, devinette.
 */

const OPEN_ANGLE = -1.2; // assez pour voir l'intérieur, sans que le couvercle touche le mur

type Puzzle =
  | { kind: 'lock'; clues: { guess: string; text: string }[]; answer: string }
  | { kind: 'anagram'; before: string; after: string; answer: string; letters: string[]; year: number }
  | { kind: 'sequence'; terms: number[]; answer: number; rule: string }
  | { kind: 'riddle'; text: string; answers: string[]; hint: string; solution: string };

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const rand = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));

// ---------- Cadenas logique (indices générés, solution toujours unique) ----------

function feedback(secret: string, guess: string) {
  let good = 0;
  let misplaced = 0;
  for (let i = 0; i < 3; i++) {
    if (guess[i] === secret[i]) good++;
    else if (secret.includes(guess[i])) misplaced++;
  }
  return { good, misplaced };
}

function clueText({ good, misplaced }: { good: number; misplaced: number }) {
  if (!good && !misplaced) return 'Aucun chiffre n’est dans le code.';
  const parts = [];
  if (good) parts.push(`${good} chiffre${good > 1 ? 's' : ''} bon${good > 1 ? 's' : ''} et bien placé${good > 1 ? 's' : ''}`);
  if (misplaced) parts.push(`${misplaced} chiffre${misplaced > 1 ? 's' : ''} bon${misplaced > 1 ? 's' : ''} mais mal placé${misplaced > 1 ? 's' : ''}`);
  return parts.join(', ') + '.';
}

const ALL_CODES = Array.from({ length: 1000 }, (_, i) => String(i).padStart(3, '0')).filter((c) => new Set(c).size === 3);

function makeLock(): Puzzle {
  for (;;) {
    const secret = ALL_CODES[rand(0, ALL_CODES.length - 1)];
    let candidates = ALL_CODES;
    const clues: { guess: string; text: string }[] = [];
    while (candidates.length > 1 && clues.length < 6) {
      const guess = ALL_CODES[rand(0, ALL_CODES.length - 1)];
      if (guess === secret) continue;
      const fb = feedback(secret, guess);
      const next = candidates.filter((c) => {
        const f = feedback(c, guess);
        return f.good === fb.good && f.misplaced === fb.misplaced;
      });
      if (next.length < candidates.length) {
        clues.push({ guess, text: clueText(fb) });
        candidates = next;
      }
    }
    if (candidates.length === 1 && clues.length >= 4) return { kind: 'lock', clues, answer: secret };
  }
}

// ---------- Suite logique (règles variées) ----------

function makeSequence(): Puzzle {
  const type = rand(0, 5);
  const terms: number[] = [];
  let rule = '';
  if (type === 0) {
    const a = rand(1, 20);
    const d = rand(3, 12);
    for (let i = 0; i < 6; i++) terms.push(a + i * d);
    rule = `On ajoute ${d} à chaque fois.`;
  } else if (type === 1) {
    const a = rand(1, 5);
    const r = rand(2, 3);
    for (let i = 0; i < 6; i++) terms.push(a * r ** i);
    rule = `On multiplie par ${r} à chaque fois.`;
  } else if (type === 2) {
    const s = rand(1, 6);
    for (let i = 0; i < 6; i++) terms.push((s + i) ** 2);
    rule = 'Ce sont des carrés : chaque nombre est un entier multiplié par lui-même.';
  } else if (type === 3) {
    let a = rand(1, 4);
    let b = rand(2, 6);
    terms.push(a, b);
    for (let i = 2; i < 6; i++) [a, b] = [b, a + b], terms.push(b);
    rule = 'Chaque nombre est la somme des deux précédents (comme la suite de Fibonacci).';
  } else if (type === 4) {
    const a = rand(1, 10);
    const d = rand(1, 3);
    terms.push(a);
    for (let i = 1; i < 6; i++) terms.push(terms[i - 1] + d * i);
    rule = `L'écart augmente de ${d} à chaque fois (+${d}, +${2 * d}, +${3 * d}…).`;
  } else {
    const a = rand(2, 6);
    const add = rand(1, 5);
    terms.push(a);
    for (let i = 1; i < 6; i++) terms.push(i % 2 ? terms[i - 1] * 2 : terms[i - 1] + add);
    rule = `On alterne : ×2, puis +${add}.`;
  }
  return { kind: 'sequence', terms: terms.slice(0, 5), answer: terms[5], rule };
}

// ---------- Devinettes ----------

const RIDDLES: { text: string; answers: string[]; hint: string; solution: string }[] = [
  { text: 'Plus j’ai de gardiens, moins je suis gardé. Qui suis-je ?', answers: ['SECRET'], hint: 'On le confie à voix basse…', solution: 'Un secret' },
  { text: 'Je commence la nuit et je termine le matin. Qui suis-je ?', answers: ['N'], hint: 'Regarde bien les mots eux-mêmes.', solution: 'La lettre N' },
  { text: 'Plus on m’enlève de matière, plus je deviens grand. Qui suis-je ?', answers: ['TROU'], hint: 'On le creuse avec une pelle.', solution: 'Un trou' },
  { text: 'J’ai des villes sans maisons, des forêts sans arbres et des rivières sans eau. Qui suis-je ?', answers: ['CARTE'], hint: 'Les explorateurs ne partent jamais sans moi.', solution: 'Une carte' },
  { text: 'Je suis plein de trous, et pourtant je retiens l’eau. Qui suis-je ?', answers: ['EPONGE'], hint: 'On me trouve près de l’évier.', solution: 'Une éponge' },
  { text: 'Il faut me casser avant de pouvoir m’utiliser. Qui suis-je ?', answers: ['OEUF', 'ŒUF'], hint: 'Une poule pourrait t’aider.', solution: 'Un œuf' },
  { text: 'Plus je sèche, plus je suis mouillée. Qui suis-je ?', answers: ['SERVIETTE'], hint: 'On m’utilise en sortant du bain.', solution: 'Une serviette' },
  { text: 'J’ai un col mais pas de cou, des manches mais pas de bras. Qui suis-je ?', answers: ['CHEMISE', 'VESTE', 'PULL'], hint: 'On me boutonne.', solution: 'Une chemise' },
  { text: 'Je réponds dans la montagne sans qu’on me voie, et je répète toujours la fin. Qui suis-je ?', answers: ['ECHO'], hint: 'Crie « bonjour » face à une falaise…', solution: 'L’écho' },
  { text: 'Je monte et je descends sans jamais bouger. Qui suis-je ?', answers: ['ESCALIER', 'ROUTE'], hint: 'On me trouve entre deux étages.', solution: 'Un escalier' },
  { text: 'Je t’appartiens, mais les autres m’utilisent bien plus que toi. Qui suis-je ?', answers: ['PRENOM', 'NOM'], hint: 'On t’appelle avec.', solution: 'Ton prénom' },
  { text: 'J’ai des dents, mais je ne mords jamais. Qui suis-je ?', answers: ['PEIGNE', 'SCIE', 'FERMETURE'], hint: 'Je passe dans les cheveux.', solution: 'Un peigne' },
  { text: 'Je cours sans avoir de jambes, et j’ai un lit sans jamais dormir. Qui suis-je ?', answers: ['RIVIERE', 'FLEUVE', 'RUISSEAU'], hint: 'Je finis souvent dans la mer.', solution: 'Une rivière' },
  { text: 'On me prend souvent sans jamais me rendre, et je ne m’arrête jamais. Qui suis-je ?', answers: ['TEMPS'], hint: 'Les horloges me mesurent.', solution: 'Le temps' },
  { text: 'Je suis toujours devant toi, mais tu ne peux jamais m’atteindre. Qui suis-je ?', answers: ['AVENIR', 'FUTUR', 'DEMAIN', 'HORIZON'], hint: 'Je n’existe pas encore.', solution: 'L’avenir' },
  { text: 'Je vole sans ailes et je pleure sans yeux. Qui suis-je ?', answers: ['NUAGE'], hint: 'Regarde le ciel un jour de pluie.', solution: 'Un nuage' },
];

async function makePuzzle(): Promise<Puzzle> {
  const kind = rand(0, 3);
  if (kind === 0) return makeLock();
  if (kind === 1) {
    try {
      const timeout = wait(1500).then(() => Promise.reject(new Error('délai dépassé')));
      const a = await Promise.race([anagramAnecdote(), timeout]);
      const answer = normalize(a.answer);
      let letters = shuffle([...answer]);
      while (letters.join('') === answer) letters = shuffle([...answer]);
      return { kind: 'anagram', before: a.before, after: a.after, answer, letters, year: a.year };
    } catch (e) {
      console.warn('Anagramme indisponible, autre énigme choisie :', e);
      return makeLock();
    }
  }
  if (kind === 2) return makeSequence();
  return { kind: 'riddle', ...RIDDLES[rand(0, RIDDLES.length - 1)] };
}

const TITLES: Record<Puzzle['kind'], string> = {
  lock: 'Le cadenas du cartographe',
  anagram: 'Les lettres en désordre',
  sequence: 'La suite du mathématicien',
  riddle: 'La devinette du sphinx',
};

export class CipherGame implements Game {
  private ctx!: GameContext;
  private root: HTMLElement;
  private puzzle!: Puzzle;
  private solved = false;
  private active = false;
  private lidTarget = 0;
  private startedAt = 0;
  private tries = 0;
  private dial = [0, 0, 0];
  private picked: number[] = [];

  constructor() {
    this.root = el('div', 'cipher hidden');
    document.body.appendChild(this.root);
  }

  open(ctx: GameContext, payload?: unknown) {
    this.ctx = ctx;
    this.active = true;
    // multijoueur : la même énigme pour tous, et c'est une course
    const loading = payload ? Promise.resolve(this.setPuzzle(payload as Puzzle)) : this.newPuzzle();
    const { pos, target } = ctx.refs.anchors.chest.view;
    Promise.all([ctx.rig.lookFrom(pos, target, 0.45), loading]).then(() => {
      if (!this.active) return;
      this.root.classList.remove('hidden');
      this.render();
    });
  }

  close() {
    this.active = false;
    this.lidTarget = 0;
    this.root.classList.add('hidden');
  }

  makePayload() {
    return makePuzzle();
  }

  onReveal(i: number, results: Result[]) {
    const box = this.root.querySelector('.cipher-multi');
    if (!box || i !== 0) return;
    box.innerHTML = resultsHTML(results, !!this.ctx.match?.isHost, true);
    box.querySelector('.mp-next')?.addEventListener('click', () => this.ctx.match?.next(1));
  }

  onNext() {
    this.ctx.match?.finish();
  }

  update(_t: number, dt: number) {
    const { lid, glow } = this.ctx.refs.chest;
    lid.rotation.x += (this.lidTarget - lid.rotation.x) * Math.min(1, dt * 5);
    glow.intensity += ((this.lidTarget ? 0.6 : 0) - glow.intensity) * Math.min(1, dt * 4);
  }

  private async newPuzzle() {
    this.setPuzzle(await makePuzzle());
  }

  private setPuzzle(p: Puzzle) {
    this.puzzle = p;
    this.solved = false;
    this.lidTarget = 0;
    this.tries = 0;
    this.dial = [0, 0, 0];
    this.picked = [];
  }

  private render() {
    const p = this.puzzle;
    this.startedAt = performance.now();
    this.root.innerHTML = `
      <div class="cipher-panel">
        <div class="kicker">Le coffre scellé</div>
        <h2>${TITLES[p.kind]}</h2>
        <div class="enigma"></div>
        <div class="cipher-feedback feedback"></div>
        <div class="cipher-result"></div>
        <div class="cipher-multi"></div>
        <div class="btn-row"><button class="ghost cipher-giveup">Donner sa langue au chat</button><button class="ghost cipher-quit">Laisser le coffre</button></div>
      </div>`;
    this.root.querySelector('.cipher-quit')!.addEventListener('click', () => this.ctx.exit());
    this.root.querySelector('.cipher-giveup')!.addEventListener('click', () => this.finish(false));
    this.renderEnigma();
  }

  /** Le contenu propre à chaque sorte d'énigme. */
  private renderEnigma() {
    const box = this.root.querySelector('.enigma')!;
    const p = this.puzzle;
    if (p.kind === 'lock') {
      box.innerHTML = `
        <p class="cipher-help">Le coffre est fermé par un cadenas à 3 chiffres, tous différents. Un savant a laissé ces indices :</p>
        <ul class="lock-clues">${p.clues.map((c) => `<li><b>${c.guess.split('').join(' ')}</b> ${c.text}</li>`).join('')}</ul>
        <div class="lock">${this.dial.map((d, i) => `<div class="lock-dial" data-i="${i}"><button class="ghost" data-d="1">▲</button><span>${d}</span><button class="ghost" data-d="-1">▼</button></div>`).join('')}
          <button class="lock-try">Ouvrir</button></div>`;
      box.querySelectorAll<HTMLElement>('.lock-dial').forEach((dial) => {
        const i = Number(dial.dataset.i);
        const turn = (d: number) => {
          this.dial[i] = (this.dial[i] + d + 10) % 10;
          dial.querySelector('span')!.textContent = String(this.dial[i]);
        };
        dial.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.addEventListener('click', () => turn(Number(b.dataset.d))));
        dial.addEventListener('wheel', (e) => {
          e.preventDefault();
          turn(-Math.sign(e.deltaY));
        });
      });
      box.querySelector('.lock-try')!.addEventListener('click', () => this.check(this.dial.join('') === p.answer));
    } else if (p.kind === 'anagram') {
      const slots = Array.from({ length: p.answer.length }, (_, i) => `<span class="slot">${this.picked[i] !== undefined ? p.letters[this.picked[i]] : ''}</span>`).join('');
      box.innerHTML = `
        <p class="cipher-help">Remets les lettres dans l'ordre pour retrouver le mot qui manque dans cette anecdote :</p>
        <blockquote>${escapeHTML(p.before)}<b>____</b>${escapeHTML(p.after)}</blockquote>
        <div class="slots">${slots}</div>
        <div class="tiles">${p.letters.map((l, i) => `<button class="tile" data-i="${i}" ${this.picked.includes(i) ? 'disabled' : ''}>${l}</button>`).join('')}</div>
        <button class="ghost undo">Effacer la dernière lettre</button>`;
      box.querySelectorAll<HTMLButtonElement>('.tile').forEach((t) =>
        t.addEventListener('click', () => {
          this.picked.push(Number(t.dataset.i));
          this.renderEnigma();
          if (this.picked.length === p.answer.length) {
            const word = this.picked.map((i) => p.letters[i]).join('');
            if (word === p.answer) this.check(true);
            else {
              this.check(false);
              this.picked = [];
              setTimeout(() => !this.solved && this.renderEnigma(), 700);
            }
          }
        }),
      );
      box.querySelector('.undo')!.addEventListener('click', () => {
        this.picked.pop();
        this.renderEnigma();
      });
    } else if (p.kind === 'sequence') {
      box.innerHTML = `
        <p class="cipher-help">Le code du coffre est le nombre qui continue cette suite :</p>
        <div class="sequence">${p.terms.map((n) => `<span>${n}</span>`).join('')}<span class="q">?</span></div>
        <form class="answer-form"><input type="number" class="answer" placeholder="Ton nombre" /><button>Essayer</button></form>`;
      this.bindForm((v) => Number(v) === p.answer);
    } else {
      box.innerHTML = `
        <p class="cipher-help">Une inscription est gravée sur le couvercle :</p>
        <blockquote class="riddle">${p.text}</blockquote>
        <form class="answer-form"><input class="answer" placeholder="Ta réponse" /><button>Répondre</button></form>
        <p class="riddle-hint hidden">Indice : ${p.hint}</p>`;
      this.bindForm((v) => p.answers.some((a) => normalize(v).split(/[^A-Z]+/).includes(normalize(a)) || normalize(v) === normalize(a)));
    }
  }

  private bindForm(test: (value: string) => boolean) {
    const form = this.root.querySelector('.answer-form') as HTMLFormElement;
    const input = form.querySelector('input')!;
    input.focus();
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!input.value.trim()) return;
      this.check(test(input.value));
      if (!this.solved) input.select();
    });
  }

  private check(ok: boolean) {
    if (this.solved) return;
    if (ok) return this.finish(true);
    this.tries++;
    const fb = this.root.querySelector('.cipher-feedback')!;
    fb.textContent = this.puzzle.kind === 'lock' ? 'Le cadenas résiste… relis les indices.' : 'Ce n’est pas ça. Essaie encore !';
    fb.className = 'cipher-feedback feedback ko';
    this.root.querySelector('.enigma')!.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], { duration: 300 });
    if (this.tries >= 2) this.root.querySelector('.riddle-hint')?.classList.remove('hidden');
  }

  /** Énigme résolue (ou abandonnée) : le coffre s'ouvre et dévoile la solution. */
  private finish(ok: boolean) {
    if (this.solved) return;
    this.solved = true;
    this.lidTarget = OPEN_ANGLE;
    const p = this.puzzle;
    const solution =
      p.kind === 'lock'
        ? `Le code était <b>${p.answer}</b>.`
        : p.kind === 'anagram'
          ? `« ${escapeHTML(p.before)}<b>${p.answer}</b>${escapeHTML(p.after)} » <span class="source">— « Le saviez-vous ? » de Wikipédia, ${p.year}</span>`
          : p.kind === 'sequence'
            ? `La réponse était <b>${p.answer}</b>. ${p.rule}`
            : `La réponse était : <b>${p.solution}</b>.`;
    const multi = !!this.ctx.match;
    const fb = this.root.querySelector('.cipher-feedback')!;
    fb.textContent = ok ? 'Bravo, le coffre s’ouvre !' : 'Le coffre s’ouvre quand même… cette fois.';
    fb.className = `cipher-feedback feedback ${ok ? 'ok' : 'ko'}`;
    this.root.querySelector('.cipher-giveup')?.remove();
    this.root.querySelector('.cipher-result')!.innerHTML = `
      <p>${solution}</p>
      ${multi ? '' : '<div class="btn-row"><button class="cipher-again">Une autre énigme</button></div>'}`;
    this.root.querySelector('.cipher-again')?.addEventListener('click', () => this.newPuzzle().then(() => this.render()));
    if (multi) {
      // course : plus on résout vite, plus on marque (et les mauvais essais coûtent un peu)
      const seconds = Math.round((performance.now() - this.startedAt) / 1000);
      const points = ok ? Math.max(50, 400 - seconds * 3 - this.tries * 20) : 0;
      this.root.querySelector('.cipher-multi')!.innerHTML = waitingHTML;
      this.ctx.match!.submit(0, points, ok ? `Résolu en ${seconds} s` : 'Abandon', ok);
    }
  }
}
