import type { Network } from '../net';
import { el, type Game, type GameContext } from './game';
import './portal.css';

const NAME_KEY = 'le-labo:nom';

function savedName() {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

/** Atelier du portail : ouvrir un portail (héberger) ou traverser celui d'un ami (rejoindre). */
export class PortalGame implements Game {
  private ctx!: GameContext;
  private root: HTMLElement;
  private active = false;
  private error = '';
  private busy = false;

  constructor(private net: Network) {
    this.root = el('div', 'portal hidden');
    document.body.appendChild(this.root);
    const previous = net.onChange;
    net.onChange = () => {
      previous();
      if (this.active) this.render();
    };
  }

  open(ctx: GameContext) {
    this.ctx = ctx;
    this.active = true;
    this.error = '';
    const { pos, target } = ctx.refs.anchors.portal.view;
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
    const net = this.net;
    const others = [...net.others.values()];
    let body: string;
    if (net.connected) {
      body = `
        <p class="pt-code-label">${net.isHost ? 'Ton portail est ouvert. Donne ce code à tes amis :' : 'Tu as traversé le portail'}</p>
        <div class="pt-code">${net.code}</div>
        <h4>Savants présents</h4>
        <ul class="pt-list"><li>${escape(net.name)} <small>(toi)</small></li>${others.map((o) => `<li>${escape(o.name)}</li>`).join('')}</ul>
        ${others.length ? '' : `<p class="pt-wait">En attente d'autres savants…</p>`}
        <div class="btn-row"><button class="ghost pt-leave">Refermer le portail</button><button class="pt-back">Retourner explorer</button></div>`;
    } else {
      body = `
        <p>Ce portail relie ton laboratoire à celui d'autres savants : vous vous verrez vous promener et explorer ensemble.</p>
        <label class="pt-field">Ton nom de savant <input class="pt-name" maxlength="16" value="${escape(savedName())}" placeholder="ex. Professeure Curie" /></label>
        <div class="pt-choices">
          <div class="pt-box">
            <h4>Ouvrir un portail</h4>
            <p>Tu recevras un code à donner à tes amis.</p>
            <button class="pt-host">Ouvrir</button>
          </div>
          <div class="pt-box">
            <h4>Traverser un portail</h4>
            <input class="pt-join-code" maxlength="4" placeholder="CODE" />
            <button class="pt-join">Traverser</button>
          </div>
        </div>
        ${this.busy ? '<p class="pt-wait">Le portail s’éveille…</p>' : ''}
        ${this.error ? `<p class="pt-error">${escape(this.error)}</p>` : ''}
        <div class="btn-row"><button class="ghost pt-back">Retour au labo</button></div>`;
    }
    this.root.innerHTML = `<div class="pt-panel"><div class="kicker">Magie et sciences</div><h2>Le portail des savants</h2>${body}</div>`;
    this.root.querySelector('.pt-back')?.addEventListener('click', () => this.ctx.exit());
    this.root.querySelector('.pt-leave')?.addEventListener('click', () => net.leave());
    this.root.querySelector('.pt-host')?.addEventListener('click', () => this.connect(() => net.host(this.readName())));
    this.root.querySelector('.pt-join')?.addEventListener('click', () => {
      const code = (this.root.querySelector('.pt-join-code') as HTMLInputElement).value;
      if (code.trim().length !== 4) {
        this.error = 'Le code fait 4 lettres.';
        return this.render();
      }
      this.connect(() => net.join(this.readName(), code));
    });
  }

  private readName() {
    const name = (this.root.querySelector('.pt-name') as HTMLInputElement | null)?.value.trim() || 'Savant mystère';
    try {
      localStorage.setItem(NAME_KEY, name);
    } catch {
      // stockage indisponible : le nom ne sera pas retenu
    }
    return name;
  }

  private async connect(action: () => Promise<unknown>) {
    this.error = '';
    this.busy = true;
    this.render();
    try {
      await action();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Le portail est resté fermé.';
    }
    this.busy = false;
    if (this.active) this.render();
  }
}

function escape(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
