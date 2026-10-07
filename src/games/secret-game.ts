import { escapeHTML, shortAnecdote } from '../live';
import { el, wait, type Game, type GameContext } from './game';
import './secret.css';

/**
 * L'énigme du passage secret : une longue chaîne de liens, sans aucune aide en jeu.
 *  1. Quatre inscriptions donnent un rang et un symbole chimique :
 *     I · Fe (tableau noir, à la craie), II · Sn (carte du ciel),
 *     III · Ag (vitre noire de la pendule, qui ne s'éclaire qu'avec le rivet caché sur son flanc),
 *     IV · Au (dans le cabinet gothique, dont la porte s'ouvre quand la lunette, tournée à la manivelle,
 *     renvoie le soleil de la fenêtre sur le cristal serti dans la porte).
 *  2. Les bocaux de l'apothicaire traduisent les symboles en métaux (Fe → FER…).
 *  3. La table des Anciens, dans le livre « De Metallis et Astris » de la bibliothèque, relie chaque métal à son astre : ♂ ♃ ☽ ☉.
 *  4. Le cercle de déclinaison de la lunette donne le jour de chaque astre, en latin
 *     (♂ DIES MARTIS → mardi, ♃ IOVIS → jeudi, ☽ LVNAE → lundi, ☉ SOLIS → dimanche).
 *  5. Au fond du coffre (une fois le cryptogramme résolu), une grille : lignes I–IV, colonnes L M M J V S D.
 *  6. Le livre noir au soleil d'or donne la règle : « Ordo lineam, dies columnam tenet. »
 *  7. Les lettres aux croisements forment le mot de la serrure.
 */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const CODE = 'NOVA';
export const MASTER_KEY = 'le-labo:grand-maitre';

/** Le socle du buste : la caméra s'approche de la plaque gravée, qui ne porte que l'indice. */
export class BustPlaqueGame implements Game {
  private ctx!: GameContext;
  private root: HTMLElement;
  private active = false;

  constructor() {
    this.root = el('div', 'secret hidden');
    this.root.innerHTML = '<button class="ghost secret-leave">S\'éloigner</button>';
    this.root.querySelector('button')!.addEventListener('click', () => this.ctx.exit());
    document.body.appendChild(this.root);
  }

  open(ctx: GameContext) {
    this.ctx = ctx;
    this.active = true;
    const { pos, target } = ctx.refs.anchors.bust.view;
    ctx.rig.lookFrom(pos, target, 0.45).then(() => {
      if (this.active) this.root.classList.remove('hidden');
    });
  }

  close() {
    this.active = false;
    this.root.classList.add('hidden');
  }
}

/** La serrure sur le flanc de la vitrine : quatre molettes de lettres. */
export class CabinetLockGame implements Game {
  private ctx!: GameContext;
  private root: HTMLElement;
  private dials = [0, 0, 0, 0];
  private active = false;

  constructor() {
    this.root = el('div', 'secret hidden');
    document.body.appendChild(this.root);
  }

  open(ctx: GameContext) {
    this.ctx = ctx;
    this.active = true;
    const { pos, target } = ctx.refs.anchors.lock.view;
    ctx.rig.lookFrom(pos, target, 0.45).then(() => {
      if (!this.active) return;
      this.root.classList.remove('hidden');
      this.render();
    });
  }

  close() {
    this.active = false;
    this.root.classList.add('hidden');
  }

  private render() {
    const opened = this.ctx.refs.secret.isOpen();
    this.root.innerHTML = `
      <div class="secret-panel">
        <div class="kicker">Le flanc de la vitrine</div>
        <h2>Une serrure à quatre molettes</h2>
        ${opened ? '<p class="secret-ok">Le mécanisme a déjà été activé : le passage est ouvert.</p>' : `
        <div class="symbol-dials">${this.dials.map((d, i) => `<div class="sdial" data-i="${i}"><button class="ghost" data-d="1">▲</button><span>${LETTERS[d]}</span><button class="ghost" data-d="-1">▼</button></div>`).join('')}</div>
        <button class="secret-try">Activer le mécanisme</button>
        <p class="secret-msg"></p>`}
        <div class="btn-row"><button class="ghost secret-quit">S'éloigner</button></div>
      </div>`;
    this.root.querySelector('.secret-quit')!.addEventListener('click', () => this.ctx.exit());
    this.root.querySelectorAll<HTMLElement>('.sdial').forEach((dial) => {
      const i = Number(dial.dataset.i);
      const turn = (d: number) => {
        this.dials[i] = (this.dials[i] + d + LETTERS.length) % LETTERS.length;
        dial.querySelector('span')!.textContent = LETTERS[this.dials[i]];
      };
      dial.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.addEventListener('click', () => turn(Number(b.dataset.d))));
      dial.addEventListener('wheel', (e) => {
        e.preventDefault();
        turn(-Math.sign(e.deltaY));
      });
    });
    this.root.querySelector('.secret-try')?.addEventListener('click', () => this.tryCode());
  }

  private async tryCode() {
    const msg = this.root.querySelector('.secret-msg')!;
    if (this.dials.every((d, i) => LETTERS[d] === CODE[i])) {
      msg.innerHTML = '<b>Un lourd déclic résonne…</b>';
      msg.className = 'secret-msg secret-ok';
      await wait(700);
      if (!this.active) return;
      // on recule pour voir la vitrine pivoter et dévoiler l'escalier
      this.root.classList.add('hidden');
      const { pos, target } = this.ctx.refs.secret.watch;
      await this.ctx.rig.lookFrom(pos, target, 0.6);
      this.ctx.refs.secret.open();
      await wait(3200);
      if (this.active) this.ctx.exit();
      return;
    }
    this.root.querySelector('.symbol-dials')!.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], { duration: 300 });
    msg.textContent = 'Le mécanisme grince… mais rien ne se passe.';
    msg.className = 'secret-msg';
  }
}

/** Le grimoire du cabinet secret : la récompense. */
export class GrimoireGame implements Game {
  private ctx!: GameContext;
  private root: HTMLElement;
  private active = false;

  constructor() {
    this.root = el('div', 'secret hidden');
    document.body.appendChild(this.root);
  }

  open(ctx: GameContext) {
    this.ctx = ctx;
    this.active = true;
    try {
      localStorage.setItem(MASTER_KEY, '1');
    } catch {
      // stockage indisponible : le titre ne durera que cette partie
    }
    dispatchEvent(new Event('le-labo:grand-maitre'));
    const { pos, target } = ctx.refs.anchors.grimoire.view;
    const secret = shortAnecdote().catch(() => null);
    ctx.rig.lookFrom(pos, target, 0.45).then(async () => {
      if (!this.active) return;
      const a = await Promise.race([secret, wait(1500).then(() => null)]);
      this.root.classList.remove('hidden');
      this.root.innerHTML = `
        <div class="secret-panel golden">
          <div class="kicker">Le grimoire des maîtres</div>
          <h2>Grand Maître du Labo</h2>
          <p>Tu as percé le secret du cabinet. Peu de savants sont parvenus jusqu'ici.</p>
          <p>En récompense, la lumière des maîtres s'est posée sur tes poignets : regarde tes mains en repartant explorer.</p>
          ${a ? `<h4>Une page du grimoire</h4><blockquote>${escapeHTML(a.text)}</blockquote><p class="source">— « Le saviez-vous ? » de Wikipédia, ${a.year}</p>` : ''}
          <div class="btn-row"><button class="secret-quit">Refermer le grimoire</button></div>
        </div>`;
      this.root.querySelector('.secret-quit')!.addEventListener('click', () => this.ctx.exit());
    });
  }

  close() {
    this.active = false;
    this.root.classList.add('hidden');
  }
}

/** Le livre noir au soleil d'or : une seule phrase, en latin. */
export class TomeGame implements Game {
  private ctx!: GameContext;
  private root: HTMLElement;
  private active = false;

  constructor() {
    this.root = el('div', 'secret hidden');
    this.root.innerHTML = `
      <div class="secret-panel tome">
        <div class="kicker">Folio VII</div>
        <blockquote>Ordo lineam, dies columnam tenet.</blockquote>
        <div class="btn-row"><button class="ghost secret-quit">Refermer le livre</button></div>
      </div>`;
    this.root.querySelector('.secret-quit')!.addEventListener('click', () => this.ctx.exit());
    document.body.appendChild(this.root);
  }

  open(ctx: GameContext) {
    this.ctx = ctx;
    this.active = true;
    const { pos, target } = ctx.refs.anchors.tome.view;
    ctx.rig.lookFrom(pos, target, 0.45).then(() => {
      if (this.active) this.root.classList.remove('hidden');
    });
  }

  close() {
    this.active = false;
    this.root.classList.add('hidden');
  }
}

/** « De Metallis et Astris » : la table des correspondances des Anciens. */
export class MetalsGame implements Game {
  private ctx!: GameContext;
  private root: HTMLElement;

  constructor() {
    this.root = el('div', 'secret hidden');
    const rows = [['☉', 'or'], ['☽', 'argent'], ['♂', 'fer'], ['♀', 'cuivre'], ['☿', 'mercure'], ['♃', 'étain'], ['♄', 'plomb']];
    this.root.innerHTML = `
      <div class="secret-panel">
        <div class="kicker">De Metallis et Astris</div>
        <table class="metals">${rows.map(([a, m]) => `<tr><td class="sym">${a}</td><td>${m}</td></tr>`).join('')}</table>
        <div class="btn-row"><button class="ghost secret-quit">Refermer le livre</button></div>
      </div>`;
    this.root.querySelector('.secret-quit')!.addEventListener('click', () => this.ctx.exit());
    document.body.appendChild(this.root);
  }

  open(ctx: GameContext) {
    this.ctx = ctx;
    this.root.classList.remove('hidden');
  }

  close() {
    this.root.classList.add('hidden');
  }
}
