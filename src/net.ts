import Peer, { type DataConnection } from 'peerjs';

/**
 * Multijoueur par le portail : les navigateurs se relient directement (WebRTC, via PeerJS).
 * L'hôte ouvre un portail identifié par un code de 4 lettres ; les autres le rejoignent,
 * et l'hôte relaie les positions de chacun à tous les autres.
 */

export interface PlayerState {
  id: string;
  name: string;
  p: [number, number, number];
  yaw: number;
}

/** Messages de jeu (parties communes) : transmis tels quels, voir match.ts. */
export interface GameMessage {
  t: string;
  [key: string]: unknown;
}

type Message = { t: 'state'; s: PlayerState } | { t: 'leave'; id: string } | { t: 'full' } | { t: 'welcome' } | { t: 'game'; m: GameMessage; from: string };

export const MAX_PLAYERS = 4;

const PREFIX = 'le-labo-portail-';
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sans I ni O, trop proches de 1 et 0

export class Network {
  code = '';
  isHost = false;
  name = 'Savant';
  /** Les autres joueurs, avec la date de leur dernier message. */
  readonly others = new Map<string, PlayerState & { seen: number }>();
  onChange: () => void = () => {};
  /** Reçoit les messages de jeu (sur l'hôte : ceux des invités ; chez les invités : ceux de l'hôte). */
  onGame: (m: GameMessage, from: string) => void = () => {};
  private peer: Peer | null = null;
  private onFull: () => void = () => {};
  private onWelcome: () => void = () => {};
  private welcomed = false;
  private conns: DataConnection[] = [];

  get connected() {
    return !!this.peer && (this.isHost || (this.welcomed && this.conns.some((c) => c.open)));
  }

  get id() {
    return this.peer?.id ?? '';
  }

  /** Ouvre un portail et renvoie son code. */
  host(name: string): Promise<string> {
    this.leave();
    this.name = name;
    this.isHost = true;
    this.code = Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
    return new Promise((resolve, reject) => {
      const peer = new Peer(PREFIX + this.code);
      this.peer = peer;
      peer.on('open', () => {
        this.onChange();
        resolve(this.code);
      });
      peer.on('connection', (conn) => {
        // portail complet : on prévient puis on referme
        if (this.conns.length >= MAX_PLAYERS - 1) {
          conn.on('open', () => {
            conn.send({ t: 'full' } satisfies Message);
            setTimeout(() => conn.close(), 500);
          });
          return;
        }
        this.setup(conn);
        conn.on('open', () => conn.send({ t: 'welcome' } satisfies Message)); // accueil : l'invité est bien entré
      });
      peer.on('error', (e) => {
        if (e.type === 'unavailable-id') this.host(name).then(resolve, reject); // code déjà pris : on en tire un autre
        else reject(e);
      });
    });
  }

  /** Traverse le portail d'un autre joueur. */
  join(name: string, code: string): Promise<void> {
    this.leave();
    this.name = name;
    this.isHost = false;
    this.code = code.toUpperCase().trim();
    return new Promise((resolve, reject) => {
      const peer = new Peer();
      this.peer = peer;
      const timer = setTimeout(() => reject(new Error('Aucun portail ne répond à ce code.')), 12000);
      peer.on('open', () => {
        const conn = peer.connect(PREFIX + this.code, { reliable: true });
        this.setup(conn);
        // on n'est vraiment entré qu'après l'accueil de l'hôte (il peut refuser si le portail est complet)
        this.onWelcome = () => {
          clearTimeout(timer);
          this.welcomed = true;
          this.onChange();
          resolve();
        };
      });
      peer.on('error', (e) => {
        clearTimeout(timer);
        reject(e.type === 'peer-unavailable' ? new Error('Aucun portail ne répond à ce code.') : e);
      });
      this.onFull = () => {
        clearTimeout(timer);
        this.leave();
        reject(new Error(`Ce portail est complet (${MAX_PLAYERS} savants au maximum).`));
      };
    });
  }

  leave() {
    this.welcomed = false;
    this.peer?.destroy();
    this.peer = null;
    this.conns = [];
    this.others.clear();
    this.code = '';
    this.onChange();
  }

  private setup(conn: DataConnection) {
    this.conns.push(conn);
    conn.on('data', (raw) => this.receive(raw as Message, conn));
    conn.on('close', () => {
      this.conns = this.conns.filter((c) => c !== conn);
      // l'hôte prévient les autres qu'un joueur est parti
      const gone = [...this.others.values()].find((o) => o.id === conn.peer);
      if (gone) {
        this.others.delete(gone.id);
        if (this.isHost) this.broadcast({ t: 'leave', id: gone.id });
      }
      if (!this.isHost) this.others.clear(); // l'hôte a fermé son portail
      this.onChange();
    });
  }

  private receive(msg: Message, from: DataConnection) {
    if (msg.t === 'state') {
      const isNew = !this.others.has(msg.s.id);
      this.others.set(msg.s.id, { ...msg.s, seen: performance.now() });
      if (isNew) this.onChange();
      if (this.isHost) this.broadcast(msg, from);
    } else if (msg.t === 'full') {
      this.onFull();
    } else if (msg.t === 'welcome') {
      this.onWelcome();
    } else if (msg.t === 'game') {
      this.onGame(msg.m, msg.from);
    } else if (msg.t === 'leave') {
      this.others.delete(msg.id);
      this.onChange();
    }
  }

  private broadcast(msg: Message, except?: DataConnection) {
    for (const c of this.conns) if (c !== except && c.open) c.send(msg);
  }

  /** Invité → hôte (sur l'hôte lui-même, le message est traité directement). */
  toHost(m: GameMessage) {
    if (this.isHost) this.onGame(m, this.id);
    else this.broadcast({ t: 'game', m, from: this.id });
  }

  /** Hôte → tout le monde, lui compris. */
  toAll(m: GameMessage) {
    if (!this.isHost) return;
    this.broadcast({ t: 'game', m, from: this.id });
    this.onGame(m, this.id);
  }

  /** Tous les joueurs connectés (soi compris), dans l'ordre d'arrivée. */
  players() {
    return [{ id: this.id, name: this.name }, ...[...this.others.values()].map((o) => ({ id: o.id, name: o.name }))];
  }

  /** Envoie notre position (appelé une dizaine de fois par seconde). */
  sendState(p: [number, number, number], yaw: number) {
    if (!this.connected) return;
    this.broadcast({ t: 'state', s: { id: this.id, name: this.name, p, yaw } });
  }

  /** Oublie les joueurs silencieux depuis plus de 5 secondes. */
  prune() {
    const now = performance.now();
    let changed = false;
    for (const [id, o] of this.others) {
      if (now - o.seen > 5000) {
        this.others.delete(id);
        changed = true;
      }
    }
    if (changed) this.onChange();
  }
}
