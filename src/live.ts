import SITES from './data/unesco.json';
import type { BookQuestion } from './data/books';
import { shuffle } from './games/game';

/**
 * Contenu chargé en direct depuis Wikipédia, pour que les questions se renouvellent.
 * Chaque fonction peut échouer (pas de réseau…) : les ateliers retombent alors sur leur contenu intégré.
 */

const WIKI = 'https://fr.wikipedia.org';
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

async function getJSON<T>(url: string, timeoutMs = 8000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export function escapeHTML(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)];

interface Summary {
  extract: string;
  thumbnail?: { source: string };
  content_urls: { desktop: { page: string } };
}

function summary(title: string) {
  return getJSON<Summary>(`${WIKI}/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
}

// ---------- Globe : sites du patrimoine mondial (liste Wikidata + résumé Wikipédia en direct) ----------

export interface LiveSite {
  name: string;
  country: string;
  lat: number;
  lon: number;
  extract: string;
  image?: string;
  url: string;
  /** Question insolite (jamais le pays : l'épingle sur le globe le montre déjà). La bonne réponse est choices[0]. */
  question: { q: string; choices: string[] };
  /** Le nom du lieu reste caché tant qu'on n'a pas répondu (question « Quel est ce lieu ? »). */
  hideName: boolean;
}

const ROMAN: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
const toRoman = (n: number) => ROMAN.reduce((s, [v, r]) => { while (n >= v) { s += r; n -= v; } return s; }, '');
const fromRoman = (r: string) => [...r].reduce((n, c, i, a) => {
  const v = { I: 1, V: 5, X: 10 }[c as 'I' | 'V' | 'X'];
  const next = { I: 1, V: 5, X: 10 }[a[i + 1] as 'I' | 'V' | 'X'] ?? 0;
  return n + (v < next ? -v : v);
}, 0);

/**
 * « Complète la description » : une date ou un siècle de l'article est masqué.
 * Renvoie null si l'article n'en contient pas.
 */
function blankQuestion(extract: string) {
  const sentences = extract.split(/(?<=[.!?])\s/).filter((p) => p.length < 260);
  for (const sentence of sentences) {
    const century = sentence.match(/\b([IVX]+)e siècle/);
    if (century) {
      const n = fromRoman(century[1]);
      const others = shuffle([-3, -2, -1, 1, 2, 3].map((d) => n + d).filter((x) => x > 0 && x <= 21)).slice(0, 2);
      return { q: `Complète la description : « ${escapeHTML(sentence.replace(century[0], '____ siècle'))} »`, choices: [n, ...others].map((x) => `${toRoman(x)}e`) };
    }
    const year = sentence.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
    if (year) {
      return { q: `Complète la description : « ${escapeHTML(sentence.replace(year[0], '____'))} »`, choices: [year[0], ...yearDistractors(Number(year[0])).slice(0, 2)] };
    }
  }
  return null;
}

export async function randomUnescoSite(): Promise<LiveSite> {
  const site = freshFirst('unesco', SITES, (x) => x.wiki, 1)[0];
  const s = await summary(site.wiki);
  // Deviner le lieu d'après sa photo, ou compléter une date de sa description
  const blank = blankQuestion(s.extract);
  const guessName = !!s.thumbnail && (!blank || Math.random() < 0.5);
  const otherNames = shuffle(SITES.filter((x) => x.wiki !== site.wiki)).slice(0, 2).map((x) => x.name);
  const question = guessName || !blank ? { q: 'Quel est ce lieu ? Observe bien la photo…', choices: [site.name, ...otherNames].map(escapeHTML) } : blank;
  return {
    ...site,
    extract: s.extract,
    image: s.thumbnail?.source,
    url: s.content_urls.desktop.page,
    question,
    hideName: guessName || !blank,
  };
}

// ---------- Livre « Le saviez-vous ? » : anecdotes archivées de Wikipédia, à compléter ----------

interface Anecdote {
  before: string;
  answer: string;
  after: string;
}

interface AnecdoteYear {
  year: number;
  list: Anecdote[];
}

const randomYear = () => 2008 + Math.floor(Math.random() * (new Date().getFullYear() - 2008));

/** Les archives d'une année (≈ 1 Mo, plusieurs secondes) sont gardées dans le navigateur. */
async function anecdotesOfYear(year: number): Promise<AnecdoteYear> {
  const key = `le-labo:anecdotes:${year}`;
  try {
    const cached = localStorage.getItem(key);
    if (cached) return { year, list: JSON.parse(cached) };
  } catch {
    // stockage indisponible (navigation privée…) : on recharge
  }
  const page = `Wikipédia:Le saviez-vous ?/Archives/${year}`;
  const data = await getJSON<{ parse: { text: { '*': string } } }>(
    `${WIKI}/w/api.php?action=parse&page=${encodeURIComponent(page)}&prop=text&format=json&origin=*`,
    20000,
  );
  const doc = new DOMParser().parseFromString(data.parse.text['*'], 'text/html');
  const list: Anecdote[] = [];
  for (const li of doc.querySelectorAll('li')) {
    li.querySelectorAll('dl, figure, sup, i').forEach((n) => n.remove()); // dates de passage, images, « (photo) »
    const bold = li.querySelector('b');
    if (!bold) continue;
    const answer = bold.textContent!.trim();
    const marker = '\u0000';
    bold.textContent = marker;
    const [before, after] = li.textContent!.replace(/\s+/g, ' ').trim().split(marker);
    if (answer.length < 2 || answer.length > 40 || (before + after).length > 280) continue;
    list.push({ before, answer, after });
  }
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // stockage plein ou indisponible : ce sera rechargé la prochaine fois
  }
  return { year, list };
}

let nextAnecdotes: Promise<AnecdoteYear> | null = null;

/** Charge à l'avance les anecdotes d'une année au hasard (au démarrage, puis après chaque livre). */
export function prefetchDidYouKnow() {
  if (nextAnecdotes) return;
  nextAnecdotes = anecdotesOfYear(randomYear());
  nextAnecdotes.catch(() => (nextAnecdotes = null));
}

export async function didYouKnowQuestions(count: number): Promise<BookQuestion[]> {
  prefetchDidYouKnow();
  const { year, list: all } = await nextAnecdotes!;
  nextAnecdotes = null;
  prefetchDidYouKnow(); // une autre année pour la prochaine fois
  if (all.length < count + 3) throw new Error('trop peu d’anecdotes');
  return freshFirst('anecdotes', all, (a) => a.before + a.answer, count).map((a) => {
    const others = shuffle(all.filter((x) => x.answer !== a.answer)).slice(0, 3).map((x) => x.answer);
    return {
      title: 'Complète l’anecdote',
      q: `${escapeHTML(a.before)}<span class="blank">……</span>${escapeHTML(a.after)}`,
      choices: [a.answer, ...others].map(escapeHTML),
      explain: `${escapeHTML(a.before)}<b class="answer">${escapeHTML(a.answer)}</b>${escapeHTML(a.after)} <span class="source">— « Le saviez-vous ? » de Wikipédia, ${year}</span>`,
    };
  });
}

// ---------- Livre « Ce jour-là » : les événements du jour, renouvelés quotidiennement ----------

interface OnThisDay {
  events: { year: number; text: string; pages: { extract?: string }[] }[];
}

/** Trois années plausibles mais fausses autour de la vraie. */
function yearDistractors(year: number) {
  const now = new Date().getFullYear();
  const spread = year > 1900 ? 15 : year > 1500 ? 60 : 150;
  const set = new Set<number>();
  while (set.size < 3) {
    const y = year + Math.round((Math.random() * 2 - 1) * spread);
    if (y !== year && y <= now && y > 0) set.add(y);
  }
  return [...set].map(String);
}

/** Événements d'un jour de l'année (Wikipédia), avec le jour écrit en toutes lettres. */
async function eventsOfDay(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const data = await getJSON<OnThisDay>(`${WIKI}/api/rest_v1/feed/onthisday/events/${mm}/${dd}`, 15000);
  return { events: data.events, day: `${d.getDate() === 1 ? '1er' : d.getDate()} ${MONTHS[d.getMonth()]}` };
}

const today = cached(() => eventsOfDay(new Date()));
const randomDay = () => new Date(2001, Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 28));
let nextDay: Promise<Awaited<ReturnType<typeof eventsOfDay>>> | null = null;
function prefetchRandomDay() {
  if (nextDay) return;
  nextDay = eventsOfDay(randomDay());
  nextDay.catch(() => (nextDay = null));
}

export async function onThisDayQuestions(count: number): Promise<BookQuestion[]> {
  const todays = await today.get();
  const usable = (list: OnThisDay['events']) => list.filter((e) => e.year > 0 && e.text.length < 260);
  const seen = new Set(seenList('ephemeride'));
  let source = todays;
  if (usable(todays.events).filter((e) => !seen.has(e.text)).length < count) {
    prefetchRandomDay();
    source = await nextDay!;
    nextDay = null;
    prefetchRandomDay();
  }
  const { day } = source;
  const events = usable(source.events);
  if (events.length < count) throw new Error('trop peu d’événements');
  return freshFirst('ephemeride', events, (e) => e.text, count).map((e) => {
    const context = e.pages.find((p) => p.extract)?.extract?.split(/(?<=\.)\s/)[0] ?? '';
    return {
      title: `Un ${day}…`,
      q: `${escapeHTML(e.text.charAt(0).toUpperCase() + e.text.slice(1))}<br/><br/>En quelle année ?`,
      choices: [String(e.year), ...yearDistractors(e.year)],
      explain: `C'était le ${day} ${e.year}. ${escapeHTML(context)} <span class="source">— Éphéméride de Wikipédia</span>`,
    };
  });
}

// ---------- Wikidata (requêtes SPARQL) ----------

async function sparql<T extends Record<string, string>>(query: string, timeoutMs = 25000): Promise<T[]> {
  const data = await getJSON<{ results: { bindings: Record<string, { value: string }>[] } }>(
    `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`,
    timeoutMs,
  );
  return data.results.bindings.map((b) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value])) as T);
}

/** Garde une seule requête en cours / un seul résultat par source. */
function cached<T>(load: () => Promise<T>) {
  let p: Promise<T> | null = null;
  let value: T | null = null;
  return {
    get: () => {
      p ??= load().then((v) => (value = v));
      p.catch(() => (p = null));
      return p;
    },
    now: () => value,
  };
}

// ---------- Chimie : les éléments du tableau périodique ----------

export interface Element {
  name: string;
  symbol: string;
  number: number;
  year?: number;
  discoverer?: string;
}

export const elements = cached(async () => {
  const rows = await sparql<{ name: string; sym: string; num: string; year?: string; disc?: string }>(`
    SELECT ?name ?sym ?num ?year ?disc WHERE {
      ?el wdt:P31 wd:Q11344; wdt:P246 ?sym; wdt:P1086 ?num.
      OPTIONAL { ?el wdt:P575 ?d. BIND(YEAR(?d) AS ?year) }
      OPTIONAL { ?el wdt:P61 ?dd. ?dd rdfs:label ?disc. FILTER(LANG(?disc) = "fr") }
      ?el rdfs:label ?name. FILTER(LANG(?name) = "fr")
    }`);
  const byNumber = new Map<number, Element>();
  for (const r of rows) {
    const number = Number(r.num);
    if (!(number >= 1 && number <= 118) || byNumber.has(number)) continue;
    byNumber.set(number, { name: r.name, symbol: r.sym, number, year: r.year ? Number(r.year) : undefined, discoverer: r.disc });
  }
  return [...byNumber.values()];
});

export interface ChemQuestion {
  q: string;
  choices: string[];
  explain: string;
}

/** Questions fabriquées à partir des données des éléments (symbole, numéro, découvreur, date). */
export async function chemistryQuestions(count: number): Promise<ChemQuestion[]> {
  const all = await elements.get();
  const others = (e: Element, f: (x: Element) => string | undefined) =>
    shuffle([...new Set(all.filter((x) => x !== e).map(f).filter((v): v is string => !!v && v !== f(e)))]).slice(0, 3);
  const make: ((e: Element) => ChemQuestion | null)[] = [
    (e) => ({ q: `Quel élément a pour symbole chimique « ${e.symbol} » ?`, choices: [e.name, ...others(e, (x) => x.name)], explain: '' }),
    (e) => ({ q: `Quel est le symbole chimique de l'élément « ${e.name} » ?`, choices: [e.symbol, ...others(e, (x) => x.symbol)], explain: '' }),
    (e) => ({ q: `Quel élément occupe la case n° ${e.number} du tableau périodique ?`, choices: [e.name, ...others(e, (x) => x.name)], explain: '' }),
    (e) => (e.discoverer && e.year && e.year > 1600 ? { q: `Qui a découvert l'élément « ${e.name} » ?`, choices: [e.discoverer, ...others(e, (x) => x.discoverer)], explain: '' } : null),
    (e) => (e.year && e.year > 1600 ? { q: `En quelle année a-t-on découvert l'élément « ${e.name} » ?`, choices: [String(e.year), ...yearDistractors(e.year)], explain: '' } : null),
  ];
  const out: ChemQuestion[] = [];
  for (const e of shuffle(all)) {
    const q = shuffle(make).map((m) => m(e)).find((x) => x && x.choices.length === 4);
    if (!q) continue;
    const disc = e.discoverer && e.year ? ` Il a été découvert en ${e.year} par ${e.discoverer}.` : e.year ? ` Il a été découvert en ${e.year}.` : '';
    q.explain = `L'élément « ${e.name} », de symbole ${e.symbol}, porte le numéro atomique ${e.number} : son noyau contient ${e.number} proton${e.number > 1 ? 's' : ''}.${disc} (Source : Wikidata)`;
    out.push(q);
  }
  return freshFirst('chimie', out, (q) => q.q, count);
}

// ---------- Lunette : les lunes des planètes ----------

export const moons = cached(async () => {
  const rows = await sparql<{ moon: string; planet: string }>(`
    SELECT ?moon ?planet WHERE {
      VALUES ?p { wd:Q111 wd:Q319 wd:Q193 wd:Q324 wd:Q332 }
      ?m wdt:P397 ?p; wdt:P31/wdt:P279* wd:Q2537.
      ?a schema:about ?m; schema:isPartOf <https://fr.wikipedia.org/>.
      ?m rdfs:label ?moon. FILTER(LANG(?moon) = "fr")
      ?p rdfs:label ?planet. FILTER(LANG(?planet) = "fr")
    }`);
  // on écarte les désignations techniques (« S/2003 J 10 », « Jupiter LI »…)
  return rows.filter((r) => !/^S\/|anneau|^\d|^Q\d|^\S+ [LXVI]+$/i.test(r.moon));
});

/** Texte d'introduction d'un article Wikipédia (première ou deux premières phrases). */
export async function wikiIntro(title: string, sentences = 2) {
  const s = await summary(title);
  return s.extract.split(/(?<=[.!?])\s/).slice(0, sentences).join(' ');
}

// ---------- Anecdotes pour d'autres jeux (fact-checking, cryptogramme) ----------

async function anecdotePool() {
  prefetchDidYouKnow();
  const pool = await nextAnecdotes!;
  return pool;
}

export interface HoaxCard {
  text: string;
  isTrue: boolean;
  truth: string;
  year: number;
}

/** Anecdotes vraies, ou piégées en échangeant le mot-clé avec celui d'une autre anecdote. */
export async function hoaxCards(count: number): Promise<HoaxCard[]> {
  const { year, list } = await anecdotePool();
  return freshFirst('fact-checking', list, (a) => a.before + a.answer, count).map((a) => {
    const truth = `${a.before}${a.answer}${a.after}`;
    if (Math.random() < 0.5) return { text: truth, isTrue: true, truth, year };
    // un mot de même allure (majuscule ou non, longueur proche), pour que le piège ne saute pas aux yeux
    const isCap = (s: string) => s.charAt(0) === s.charAt(0).toUpperCase();
    const similar = list.filter(
      (x) => x.answer !== a.answer && isCap(x.answer) === isCap(a.answer) && x.answer.length < a.answer.length * 1.8 && x.answer.length > a.answer.length * 0.55,
    );
    const fake = pick(similar.length ? similar : list).answer;
    return { text: `${a.before}${fake}${a.after}`, isTrue: fake === a.answer, truth, year };
  });
}

/** Une anecdote dont le mot-clé est un seul mot de 5 à 10 lettres : pour l'anagramme du coffre. */
export async function anagramAnecdote(): Promise<{ before: string; answer: string; after: string; year: number }> {
  const { year, list } = await anecdotePool();
  const usable = list.filter((a) => /^[A-Za-zÀ-ÿ]{5,10}$/.test(a.answer) && (a.before + a.after).length < 220);
  const a = freshFirst('anagrammes', usable, (x) => x.before + x.answer, 1)[0];
  if (!a) throw new Error('aucun mot adapté');
  return { ...a, year };
}

/** Une anecdote courte, pour le cryptogramme du coffre. */
export async function shortAnecdote(): Promise<{ text: string; year: number }> {
  const { year, list } = await anecdotePool();
  const short = list.map((a) => `${a.before}${a.answer}${a.after}`).filter((t) => t.length > 50 && t.length < 150);
  return { text: freshFirst('cryptogramme', short, (t) => t, 1)[0], year };
}

// ---------- Pendule du temps : événements de dates au hasard ----------

export async function timelineEvents(count: number): Promise<{ year: number; text: string; day: string }[]> {
  prefetchRandomDay();
  const { events, day } = await nextDay!;
  nextDay = null;
  prefetchRandomDay(); // un autre jour pour la série suivante
  // des années bien espacées, pour que l'ordre soit faisable
  const picked: { year: number; text: string; day: string }[] = [];
  const candidates = events.filter((x) => x.year > 0 && x.text.length < 200);
  for (const e of freshOrder('pendule', candidates, (x) => x.text)) {
    if (picked.every((p) => Math.abs(p.year - e.year) >= 8)) picked.push({ year: e.year, text: e.text, day });
    if (picked.length === count) break;
  }
  if (picked.length < count) throw new Error('trop peu d’événements');
  markSeen('pendule', picked.map((p) => p.text));
  return picked;
}

/** Lancé au démarrage : tout ce qui est lent se charge pendant qu'on se promène. */
export function prefetchAll() {
  prefetchDidYouKnow();
  prefetchRandomDay();
  today.get().catch(() => {});
  elements.get().catch(() => {});
  moons.get().catch(() => {});
  prefetchConstellations();
}

// ---------- Lunette : constellations et leurs étoiles (Wikidata) ----------

export interface LiveConstellation {
  name: string;
  wiki: string;
  /** [nom, ascension droite en heures, déclinaison en degrés, magnitude] */
  stars: [string, number, number, number][];
}

const constellationList = cached(async () => {
  const rows = await sparql<{ c: string; name: string; article: string }>(`
    SELECT ?c ?name ?article WHERE {
      ?c wdt:P31 wd:Q8928. ?article schema:about ?c; schema:isPartOf <https://fr.wikipedia.org/>.
      ?c rdfs:label ?name. FILTER(LANG(?name) = "fr")
    }`);
  return rows.map((r) => ({ id: r.c.split('/').pop()!, name: r.name, wiki: decodeURIComponent(r.article.split('/wiki/')[1]) }));
});

async function loadConstellation(): Promise<LiveConstellation | null> {
  const list = await constellationList.get();
  const c = freshFirst('constellations', list, (x) => x.id, 1)[0];
  const rows = await sparql<{ star: string; ra: string; dec: string; mag: string }>(`
    SELECT ?star ?ra ?dec (MIN(?m) AS ?mag) WHERE {
      ?s wdt:P59 wd:${c.id}; wdt:P6257 ?ra; wdt:P6258 ?dec; wdt:P1215 ?m. FILTER(?m < 4.6)
      ?s rdfs:label ?star. FILTER(LANG(?star) = "fr")
    } GROUP BY ?star ?ra ?dec`);
  const seen = new Set<string>();
  const stars = rows
    .filter((r) => !/nébuleuse|amas|galaxie|^HD |^HR |^Q\d/i.test(r.star))
    .map((r) => [r.star, Number(r.ra) / 15, Number(r.dec), Number(r.mag)] as [string, number, number, number])
    .sort((a, b) => a[3] - b[3])
    .filter(([name]) => !seen.has(name) && seen.add(name))
    .slice(0, 12);
  return stars.length >= 5 ? { name: c.name, wiki: c.wiki, stars } : null;
}

const constellationQueue: LiveConstellation[] = [];
let constellationLoading = false;

/** Garde trois constellations d'avance (chacune demande quelques secondes à Wikidata). */
export function prefetchConstellations() {
  if (constellationQueue.length >= 3 || constellationLoading) return;
  constellationLoading = true;
  loadConstellation()
    .then((c) => {
      if (c && !constellationQueue.some((x) => x.name === c.name)) constellationQueue.push(c);
      constellationLoading = false;
      prefetchConstellations();
    })
    .catch(() => (constellationLoading = false));
}

export function takeConstellations(count: number) {
  const taken = constellationQueue.splice(0, count);
  prefetchConstellations();
  return taken;
}

export const constellationNames = () => constellationList.now()?.map((c) => c.name) ?? null;

// ---------- Mémoire des questions déjà vues (pour ne pas retomber souvent sur les mêmes) ----------

const SEEN_PREFIX = 'le-labo:vus:';
const SEEN_MAX = 4000;
const seenCache = new Map<string, string[]>();

function seenList(ns: string): string[] {
  if (!seenCache.has(ns)) {
    let list: string[] = [];
    try {
      list = JSON.parse(localStorage.getItem(SEEN_PREFIX + ns) ?? '[]');
    } catch {
      // stockage indisponible : la mémoire ne durera que cette partie
    }
    seenCache.set(ns, list);
  }
  return seenCache.get(ns)!;
}

/**
 * Choisit `count` éléments en donnant la priorité à ceux jamais vus, puis les retient comme vus.
 * Les anciens ne reviennent qu'une fois tout le reste épuisé.
 */
export function freshFirst<T>(ns: string, items: T[], key: (item: T) => string, count: number): T[] {
  const chosen = freshOrder(ns, items, key).slice(0, count);
  markSeen(ns, chosen.map(key));
  return chosen;
}

/** Mélange en plaçant d'abord les éléments jamais vus (sans rien retenir). */
export function freshOrder<T>(ns: string, items: T[], key: (item: T) => string): T[] {
  const seen = new Set(seenList(ns));
  const mixed = shuffle(items);
  return [...mixed.filter((i) => !seen.has(key(i))), ...mixed.filter((i) => seen.has(key(i)))];
}

export function markSeen(ns: string, keys: string[]) {
  const list = seenList(ns);
  list.push(...keys);
  if (list.length > SEEN_MAX) list.splice(0, list.length - SEEN_MAX);
  try {
    localStorage.setItem(SEEN_PREFIX + ns, JSON.stringify(list));
  } catch {
    // stockage plein ou indisponible
  }
}
