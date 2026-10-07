import type * as THREE from 'three';
import type { CameraRig } from '../camera-rig';
import type { LabRefs } from '../lab';
import type { MatchApi, Result } from '../match';
import './common.css';

/** Ce que le jeu principal fournit à chaque atelier. */
export interface GameContext {
  camera: THREE.PerspectiveCamera;
  rig: CameraRig;
  refs: LabRefs;
  /** Quitter l'atelier et revenir à l'exploration. */
  exit: () => void;
  /** Partie commune en multijoueur (null en solo). */
  match: MatchApi | null;
}

export interface Game {
  /** payload : contenu imposé par l'hôte en multijoueur (sinon l'atelier le prépare lui-même). */
  open(ctx: GameContext, payload?: unknown): void;
  /** Multijoueur, chez l'hôte : prépare le contenu commun (doit être sérialisable en JSON). */
  makePayload?(hint?: unknown): Promise<unknown>;
  /** Multijoueur : résultats de tous pour l'étape i. */
  onReveal?(i: number, results: Result[]): void;
  /** Multijoueur : l'hôte fait passer tout le monde à l'étape i. */
  onNext?(i: number): void;
  /** Appelé quand on quitte l'atelier (bouton ou Échap) : ranger l'interface et remettre les objets en place. */
  close(): void;
  update?(t: number, dt: number): void;
}

export function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Crée un élément HTML avec classe et contenu. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', html = '') {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (html) e.innerHTML = html;
  return e;
}

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function scoreComment(score: number, total: number) {
  const r = score / total;
  if (r === 1) return 'Sans faute ! Un vrai savant.';
  if (r >= 0.7) return 'Très bien, belle culture !';
  if (r >= 0.4) return 'Pas mal, il reste des choses à découvrir.';
  return "C'est en se trompant qu'on apprend. On recommence ?";
}

/**
 * Affiche des choix de réponse (mélangés). Au clic : bonne réponse en vert, mauvaise en rouge,
 * puis onDone(juste ?). `answer` est l'index de la bonne réponse dans `choices`.
 */
export function choiceButtons(
  parent: HTMLElement,
  choices: string[],
  answer: number,
  onDone: (ok: boolean) => void,
  className = 'choice',
) {
  const order = shuffle(choices.map((text, i) => ({ text, i })));
  const buttons = order.map(({ text, i }) => {
    const b = el('button', className, text);
    b.addEventListener('click', () => {
      buttons.forEach((x) => (x.disabled = true));
      const ok = i === answer;
      b.classList.add(ok ? 'right' : 'wrong');
      if (!ok) buttons[order.findIndex((o) => o.i === answer)].classList.add('right');
      onDone(ok);
    });
    parent.appendChild(b);
    return b;
  });
  return buttons;
}
