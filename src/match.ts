import type { GameMessage, Network } from './net';

/**
 * Parties communes en multijoueur. L'hôte est l'arbitre :
 * il prépare le contenu de l'atelier (le même pour tous), attend les réponses de chacun,
 * révèle les résultats, fait passer à la suite et tient le classement général.
 */

export interface Result {
  id: string;
  name: string;
  points: number;
  /** Ce qu'a répondu le joueur, en quelques mots (« Juste », « 3/5 bien placés »…). */
  summary: string;
  ok: boolean;
}

export interface Standing {
  id: string;
  name: string;
  points: number;
  wins: number;
}

/** Ce qu'un atelier voit d'une partie commune. */
export interface MatchApi {
  isHost: boolean;
  players: { id: string; name: string }[];
  /** Envoie notre résultat pour la question i (puis on attend les autres). */
  submit(i: number, points: number, summary: string, ok: boolean): void;
  /** Hôte : tout le monde passe à l'étape i. */
  next(i: number): void;
  /** Hôte : fin de l'atelier, on compte les points. */
  finish(): void;
}

export interface MatchHooks {
  /** Tout le monde entre dans l'atelier avec le même contenu. */
  start(station: string, payload: unknown, api: MatchApi, launchedBy: string): void;
  reveal(i: number, results: Result[]): void;
  next(i: number): void;
  end(ranking: Standing[], scores: Standing[]): void;
  /** Hôte : prépare le contenu d'un atelier (questions identiques pour tous). */
  makePayload(station: string, hint?: unknown): Promise<unknown>;
}

const ANSWER_TIMEOUT = 45000;
const CIPHER_TIMEOUT = 150000;
const WIN_BONUS = 100;

export class Match {
  private matchId = 0;
  private station = '';
  private participants: { id: string; name: string }[] = [];
  private answers = new Map<number, Map<string, Result>>();
  private revealed = new Set<number>();
  private timers = new Map<number, ReturnType<typeof setTimeout>>();
  private matchPoints = new Map<string, number>();
  /** Classement général de la session (tenu par l'hôte, recopié chez les invités). */
  scores: Standing[] = [];
  active = false;

  constructor(private net: Network, private hooks: MatchHooks) {
    net.onGame = (m, from) => this.receive(m, from);
  }

  get multiplayer() {
    return this.net.connected && this.net.others.size > 0;
  }

  /** Un joueur veut lancer un atelier : l'hôte prépare et lance pour tous. */
  request(station: string, hint?: unknown) {
    this.net.toHost({ t: 'match-request', station, hint });
  }

  /** Hôte qui quitte l'atelier en cours : la partie s'arrête et les points sont comptés. */
  abortIfHost() {
    if (this.active && this.net.isHost) this.endMatch();
  }

  private api(): MatchApi {
    const id = this.matchId;
    return {
      isHost: this.net.isHost,
      players: this.participants,
      submit: (i, points, summary, ok) => this.net.toHost({ t: 'answer', matchId: id, i, points, summary, ok }),
      next: (i) => this.net.isHost && this.net.toAll({ t: 'next', matchId: id, i }),
      finish: () => this.net.isHost && this.endMatch(),
    };
  }

  private async receive(m: GameMessage, from: string) {
    const host = this.net.isHost;
    switch (m.t) {
      case 'match-request': {
        if (!host || this.active) return;
        this.active = true; // évite deux lancements simultanés
        let payload: unknown;
        try {
          payload = await this.hooks.makePayload(m.station as string, m.hint);
        } catch (e) {
          console.warn('Impossible de préparer la partie :', e);
          this.active = false;
          return;
        }
        const by = this.net.players().find((p) => p.id === from)?.name ?? 'Un savant';
        this.net.toAll({ t: 'match-start', matchId: Date.now(), station: m.station, payload, players: this.net.players(), by });
        break;
      }
      case 'match-start': {
        this.matchId = m.matchId as number;
        this.station = m.station as string;
        this.participants = m.players as { id: string; name: string }[];
        this.answers.clear();
        this.revealed.clear();
        this.matchPoints.clear();
        this.active = true;
        this.hooks.start(this.station, m.payload, this.api(), m.by as string);
        break;
      }
      case 'answer': {
        if (!host || m.matchId !== this.matchId) return;
        const i = m.i as number;
        if (this.revealed.has(i)) return;
        const name = this.participants.find((p) => p.id === from)?.name ?? '?';
        const forQ = this.answers.get(i) ?? new Map<string, Result>();
        this.answers.set(i, forQ);
        forQ.set(from, { id: from, name, points: m.points as number, summary: m.summary as string, ok: m.ok as boolean });
        // première réponse : on lance le compte à rebours pour les retardataires
        if (!this.timers.has(i)) this.timers.set(i, setTimeout(() => this.revealQuestion(i), this.station === 'chest' ? CIPHER_TIMEOUT : ANSWER_TIMEOUT));
        const stillHere = this.participants.filter((p) => p.id === this.net.id || this.net.others.has(p.id));
        if (stillHere.every((p) => forQ.has(p.id))) this.revealQuestion(i);
        break;
      }
      case 'reveal':
        if (m.matchId === this.matchId) this.hooks.reveal(m.i as number, m.results as Result[]);
        break;
      case 'next':
        if (m.matchId === this.matchId) this.hooks.next(m.i as number);
        break;
      case 'match-end':
        if (m.matchId !== this.matchId) return;
        this.active = false;
        this.scores = m.scores as Standing[];
        this.hooks.end(m.ranking as Standing[], this.scores);
        break;
      case 'scores':
        this.scores = m.scores as Standing[];
        break;
    }
  }

  /** Hôte : tout le monde a répondu (ou le temps est écoulé) → on révèle et on compte. */
  private revealQuestion(i: number) {
    if (this.revealed.has(i)) return;
    this.revealed.add(i);
    clearTimeout(this.timers.get(i));
    this.timers.delete(i);
    const forQ = this.answers.get(i) ?? new Map<string, Result>();
    const results = this.participants.map(
      (p) => forQ.get(p.id) ?? { id: p.id, name: p.name, points: 0, summary: 'Pas de réponse', ok: false },
    );
    for (const r of results) this.matchPoints.set(r.id, (this.matchPoints.get(r.id) ?? 0) + r.points);
    this.net.toAll({ t: 'reveal', matchId: this.matchId, i, results });
  }

  /** Hôte : classement de l'atelier, bonus au(x) gagnant(s), classement général. */
  private endMatch() {
    const ranking: Standing[] = this.participants
      .map((p) => ({ id: p.id, name: p.name, points: this.matchPoints.get(p.id) ?? 0, wins: 0 }))
      .sort((a, b) => b.points - a.points);
    const best = ranking[0]?.points ?? 0;
    for (const r of ranking) {
      if (best > 0 && r.points === best) {
        r.wins = 1;
        r.points += WIN_BONUS;
      }
      const total = this.scores.find((s) => s.id === r.id);
      if (total) {
        total.points += r.points;
        total.wins += r.wins;
        total.name = r.name;
      } else this.scores.push({ ...r });
    }
    this.scores.sort((a, b) => b.points - a.points);
    this.net.toAll({ t: 'match-end', matchId: this.matchId, ranking, scores: this.scores });
  }

  /** Hôte : renvoie le classement aux nouveaux arrivants. */
  shareScores() {
    if (this.net.isHost) this.net.toAll({ t: 'scores', scores: this.scores });
  }
}

/** Points d'une bonne réponse : 100, plus un bonus de rapidité (jusqu'à 50 dans les 10 premières secondes). */
export function speedPoints(ok: boolean, seconds: number) {
  return ok ? 100 + Math.max(0, Math.round(50 - seconds * 5)) : 0;
}

/** Bandeau des résultats d'une question, à insérer dans le panneau de l'atelier. */
export function resultsHTML(results: Result[], isHost: boolean, last: boolean) {
  const rows = results
    .map((r) => `<li class="${r.ok ? 'ok' : 'ko'}"><span>${r.ok ? '✓' : '✗'} ${escape(r.name)}</span><small>${escape(r.summary)}</small><b>+${r.points}</b></li>`)
    .join('');
  const action = isHost
    ? `<button class="mp-next">${last ? 'Voir le classement' : 'Suite pour tous'}</button>`
    : `<p class="mp-wait">L'hôte va passer à la suite…</p>`;
  return `<div class="mp-results"><h4>Réponses des savants</h4><ul>${rows}</ul>${action}</div>`;
}

export const waitingHTML = `<div class="mp-results"><p class="mp-wait">Réponse envoyée. En attente des autres savants…</p></div>`;

function escape(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
