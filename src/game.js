// Moteur du jeu : état, journée, tendances, comptoir, crédit, clientèle, marchandage, fidèles, revendeuses, rivale, sauvegarde.
import {
  CATALOG, byId, TIERS, TIER_ORDER, PERSONAS, AGENTS, MARGINS, UPGRADES, BENZ_PRICE, RANDOM_EVENTS, REACTIONS, ARGUMENTS,
  RIVAL, CLIENT_NAMES, CLIENT_TITLE, BAPTISMS, SEASON_END, AMBITIONS, CARS, MARKETS, marketById, MANAGER_WAGE,
  COLLECTIONS, COLLECTION_PATTERNS, PALETTES, STYLES, PERSONA_REACTIONS, CONTEXT_LINES, PLAYER_LINES, dateOf, feastOf, dayOfDate,
} from './data.js';
import { mulberry32, clamp, rand, pick, weighted, round50, shuffle } from './util.js';

const KEYS = { main: 'nb.save.v1', defi: 'nb.defi.v1' };
export const DEFI_DAYS = 6; // le défi du jour : une semaine de marché, du lundi au samedi

export function newGame(name = 'Dédévi', opts = {}) {
  const seed = opts.seed ?? ((Math.random() * 1e9) | 0);
  const trend = {};
  const rng = mulberry32(seed);
  for (const p of CATALOG) trend[p.id] = +(0.8 + rng() * 0.5).toFixed(2);
  return migrate({
    v: 1, seed, name, day: 0, mode: opts.mode || 'main', defiDate: opts.defiDate || null,
    money: 60000, rep: 8, debt: 0,
    stock: {}, // id -> { q, cost } (coût moyen)
    shelf: [], // ids exposés
    trend,
    upgrades: {},
    agents: [], // missions en cours : { agentId, items:[{id,q}], amount, due, margin }
    event: null, // événement du jour
    offers: [], // comptoir du matin
    history: [], // bilans des journées
    stats: { sold: 0, revenue: 0, bestSale: 0, customers: 0, lost: 0, haggles: 0 },
    flags: {},
    phase: 'morning',
    won: false,
  });
}

// complète une sauvegarde ancienne avec les nouveaux champs
export function migrate(s) {
  s.mode ||= 'main';
  s.arrears ??= 0; // taxe de place impayée
  // les anciennes versions laissaient la caisse passer sous zéro : la dette devient une taxe due
  if (s.money < 0) { s.arrears += -s.money; s.money = 0; }
  s.credit ||= { owed: 0, due: null, frozen: false }; // crédit du comptoir
  s.clients ||= []; // clientes fidèles
  s.names ||= {}; // motifs baptisés : id -> surnom
  s.namedDay ??= -99;
  s.rival ||= { money: RIVAL.start, benzDay: null };
  s.flags ||= {};
  s.flags.amb ||= {};
  s.stats.loans ??= 0;
  s.places ||= { assigame: true }; // places achetées dans les marchés
  s.where ||= 'assigame'; // le marché où tu vends aujourd'hui
  s.cars ||= s.won ? ['benz200'] : [];
  s.flags.nov ||= {};
  for (const p of releasedPatterns(s)) s.trend[p.id] ??= 1.45;
  return s;
}

const keyOf = (mode) => KEYS[mode] || KEYS.main;
export function save(s) { try { localStorage.setItem(keyOf(s.mode), JSON.stringify(s)); } catch { /* stockage indisponible */ } }
export function load(mode = 'main') { try { const s = JSON.parse(localStorage.getItem(keyOf(mode)) || 'null'); return s && s.v === 1 ? migrate(s) : null; } catch { return null; } }
export function wipe(mode = 'main') { try { localStorage.removeItem(keyOf(mode)); } catch { /* ignore */ } }

export const dayRng = (s, salt = 0) => mulberry32(s.seed + s.day * 7919 + salt);
export const stockCount = (s) => Object.values(s.stock).reduce((a, b) => a + b.q, 0);
export const stockCap = (s) => (s.upgrades.magasin ? 120 : 40);
export const shelfSlots = (s) => (s.upgrades.boutique ? 8 : s.upgrades.etal ? 6 : 4);
export const agentsAvailable = (s) => AGENTS.filter((a) => (s.upgrades.reseau ? true : !['a4', 'a5'].includes(a.id)));
export const hasExclusive = (s) => !!s.upgrades.exclusif;
export const stockValue = (s) => Object.values(s.stock).reduce((a, b) => a + b.q * b.cost, 0);

// le motif exclusif (débloqué tard) : à ton nom, il ne se démode pas
// tu choisis son motif, ses couleurs, son nom et ton prix de vente
export const exclusiveOf = (s) => ({ motif: 'eventail', pal: 4, name: `Le pagne de ${s.name}`, price: 0, ...(s.excl || {}) });
export function exclusivePattern(s) {
  const e = exclusiveOf(s), pal = PALETTES[e.pal % PALETTES.length];
  return { id: 'excl', name: e.name, motif: e.motif, tier: 'super', style: STYLES[e.motif], spec: { motif: e.motif, bg: pal[0], fg: pal[1], ac: pal[2], seed: 77 } };
}
export function setExclusive(s, e) {
  const name = String(e.name ?? '').replace(/[<>]/g, '').trim().slice(0, 32);
  s.excl = { ...exclusiveOf(s), ...e, name: name || exclusiveOf(s).name, price: round50(clamp(+e.price || 0, 0, 80000)) };
}
// ton prix affiché : plus il dépasse la valeur que les dames lui donnent, moins elles s'arrêtent
export const exclusiveAppeal = (s) => { const p = exclusiveOf(s).price; return p ? clamp((marketValue(s, 'excl') * 1.15) / p, 0.35, 1.3) : 1; };
export function pattern(s, id) {
  if (id === 'excl') return exclusivePattern(s);
  const p = byId[id];
  return s.names && s.names[id] ? { ...p, name: s.names[id], oldName: p.name, baptized: true } : p;
}
// le catalogue grandit : les collections arrivent au fil des semaines
export const releasedPatterns = (s) => COLLECTION_PATTERNS.filter((p) => COLLECTIONS[p.col].day <= s.day);
export const catalogOf = (s) => [...CATALOG, ...releasedPatterns(s)];
export const isNew = (s, id) => { const p = byId[id]; return !!p && p.col != null && s.day - COLLECTIONS[p.col].day < 7; };
export const placeOf = (s) => marketById[s.where] || MARKETS[0];
export const trendOf = (s, id) => (id === 'excl' ? 1.3 : s.trend[id] || 1);

// valeur de marché d'une pièce aujourd'hui
export function marketValue(s, id) {
  const p = pattern(s, id);
  return TIERS[p.tier].value * trendOf(s, id);
}

// fin de saison (27 avril 1975), calculée une fois
export const SEASON_DAY = dayOfDate(SEASON_END);
export const daysLeft = (s) => SEASON_DAY - s.day;

/* ------------------------------------------------------------ matin : événement du jour et comptoir */
export function startDay(s) {
  const rng = dayRng(s, 1);
  const date = dateOf(s.day);
  s.phase = 'morning';
  s.today = null;
  s.resting = false;
  s.repToday = 0; // la réputation gagnée par les ventes plafonne chaque jour
  // évolution des modes : marche aléatoire qui revient vers 1 (vers 1,3 pour un motif que tu as baptisé)
  for (const p of releasedPatterns(s)) s.trend[p.id] ??= 1.45;
  for (const p of catalogOf(s)) {
    const t = s.trend[p.id];
    const home = s.names[p.id] ? 1.3 : 1;
    s.trend[p.id] = +clamp(t + (home - t) * 0.12 + (rng() - 0.5) * 0.16, 0.55, 1.75).toFixed(2);
  }
  // événement
  const feast = feastOf(date);
  const evId = weighted(rng, Object.fromEntries(RANDOM_EVENTS.map((e) => [e.id, e.w * (e.rival && s.day < 3 ? 0 : 1)])));
  let ev = { ...RANDOM_EVENTS.find((e) => e.id === evId) };
  if (s.day === 0) ev = { id: 'debut', title: 'Ton premier jour', text: 'Ta tante t’a laissé sa place au marché et 60 000 F. Le reste dépend de toi.' };
  if (ev.trendUp || ev.trendDown) {
    const p = pick(rng, CATALOG.filter((c) => c.tier !== 'fancy'));
    s.trend[p.id] = ev.trendUp ? 1.7 : 0.6;
    ev.text = ev.text.replace('{p}', `« ${pattern(s, p.id).name} »`);
    ev.pattern = p.id;
  }
  ev.text = (ev.text || '').replace('{r}', RIVAL.name);
  ev.feast = feast;
  ev.sunday = date.wd === 0;
  ev.saturday = date.wd === 6;
  s.event = ev;
  // offres du comptoir : 7 motifs, dont une nouveauté « super » quand la réputation le permet
  const avail = catalogOf(s).filter((p) => p.tier !== 'super' || s.rep >= 20 || p.col != null);
  const offers = [];
  // les nouveautés de la semaine sont toujours au comptoir
  for (const p of avail) if (isNew(s, p.id)) offers.push(p.id);
  const pool = avail.filter((p) => !offers.includes(p.id));
  while (offers.length < 7 + Math.min(3, offers.length) && pool.length) {
    const k = Math.floor(rng() * pool.length);
    const p = pool.splice(k, 1)[0];
    if (p.tier === 'hollandais' && s.rep < 6 && rng() < 0.6) continue;
    offers.push(p.id);
  }
  if (hasExclusive(s)) offers.unshift('excl');
  const priceMul = (ev.priceMul || 1) * (s.upgrades.boutique ? 0.92 : 1);
  s.offers = offers.map((id) => {
    const p = pattern(s, id);
    const base = TIERS[p.tier].buy * (id === 'excl' ? 1.15 : 1);
    return { id, price: round50(base * priceMul * (0.94 + rng() * 0.14) * (0.75 + trendOf(s, id) * 0.25)), stock: id === 'excl' ? 12 : 3 + Math.floor(rng() * 10) };
  });
  // la rivale rafle le motif le plus à la mode
  if (ev.rival === 'rafle') {
    const o = s.offers.filter((x) => x.id !== 'excl').sort((a, b) => trendOf(s, b.id) - trendOf(s, a.id))[0];
    if (o) { o.stock = 0; o.taken = true; ev.text = ev.text.replace('{p}', `« ${pattern(s, o.id).name} »`); }
  }
  // retours des revendeuses
  const returns = settleAgents(s);
  s.startedDay = s.day;
  s.lastReturns = returns.map((r) => ({ ...r, ag: { name: r.ag.name, town: r.ag.town } }));
  if (!s.places[s.where]) s.where = 'assigame';
  s.news = novelties(s);
  return { date, ev, returns, news: s.news };
}

/* ------------------------------------------------------------ nouveautés : ce qui s'ouvre au fil de la partie */
export function novelties(s) {
  const out = [];
  const add = (key, kind, title, text) => { if (s.flags.nov[key]) return; s.flags.nov[key] = s.day; out.push({ kind, title, text }); };
  for (const [ci, col] of COLLECTIONS.entries()) if (col.day <= s.day) add('col' + ci, 'collection', col.title, `Le bateau a débarqué ${col.items.length} motifs nouveaux : ${col.items.map((x) => `« ${x[0]} »`).join(', ')}. Les dames vont se les arracher cette semaine.`);
  for (const [k, P] of Object.entries(PERSONAS)) {
    const u = P.unlock; if (!u || u.market) continue;
    if ((u.day == null || s.day >= u.day) && (u.rep == null || s.rep >= u.rep)) add('p' + k, 'client', 'Nouvelle clientèle', `${P.label} commence à passer au marché.`);
  }
  for (const m of MARKETS) if (m.need && s.rep >= m.need.rep && !s.places[m.id]) add('m' + m.id, 'market', `Une place se libère : ${m.short}`, `${m.desc} Une place y est à vendre ${m.price.toLocaleString('fr-FR')} F (le soir, onglet « Marchés »).`);
  if (s.rep >= CREDIT_REP) add('credit', 'credit', 'Le comptoir te fait crédit', `Ta réputation t’ouvre le crédit du comptoir : prends le tissu maintenant, paie dans les ${CREDIT_DAYS} jours (${Math.round(CREDIT_FEE * 100)} % de frais).`);
  if (s.rep >= BAPTISM_REP) add('bapteme', 'name', 'Tu peux baptiser un motif', 'Les dames t’écoutent : donne un surnom à un de tes motifs. S’il prend, tout Lomé le voudra.');
  if (s.cars.length && s.cars.length < CARS.length) add('car' + s.cars.length, 'car', 'Le garage', `Prochaine voiture : ${CARS[s.cars.length].name}, ${CARS[s.cars.length].price.toLocaleString('fr-FR')} F.`);
  // plusieurs nouveautés du même genre tiennent dans une seule carte
  const merged = [];
  for (const n of out) {
    const same = merged.find((m) => m.kind === n.kind && (n.kind === 'client' || n.kind === 'market'));
    if (!same) { merged.push({ ...n }); continue; }
    same.title = n.kind === 'client' ? 'Nouvelles clientèles' : 'Des places se libèrent';
    same.text += ' ' + n.text;
  }
  return merged;
}

/* ------------------------------------------------------------ crédit du comptoir */
// les maisons de commerce faisaient crédit aux commerçantes connues : on prend le tissu, on paie après la vente
export const CREDIT_FEE = 0.05;
export const CREDIT_DAYS = 7;
export const CREDIT_REP = 15;
export const creditLimit = (s) => (s.rep < CREDIT_REP || s.credit.frozen ? 0 : round50(20000 + s.rep * 2000));
export const creditRoom = (s) => Math.max(0, creditLimit(s) - s.credit.owed);

export function buy(s, offer, q, onCredit = false) {
  const cost = offer.price * q;
  if (q <= 0 || q > offer.stock || stockCount(s) + q > stockCap(s)) return false;
  if (onCredit) {
    const owed = round50(cost * (1 + CREDIT_FEE));
    if (owed > creditRoom(s)) return false;
    s.credit.owed += owed;
    if (s.credit.due == null) s.credit.due = s.day + CREDIT_DAYS;
  } else {
    if (cost > s.money) return false;
    s.money -= cost;
  }
  offer.stock -= q;
  const st = (s.stock[offer.id] ||= { q: 0, cost: 0 });
  st.cost = (st.cost * st.q + cost) / (st.q + q);
  st.q += q;
  if (!s.shelf.includes(offer.id) && s.shelf.length < shelfSlots(s)) s.shelf.push(offer.id);
  return true;
}

/* ------------------------------------------------------------ clientèle du jour */
export function crowdSize(s) {
  const ev = s.event || {};
  let n = (5 + s.rep * 0.05 + Math.min(3, s.clients.length * 0.25)) * placeOf(s).crowd;
  if (s.upgrades.parasol) n *= 1.1;
  if (s.upgrades.boutique && s.where === 'assigame') n *= 1.25;
  if (ev.saturday) n *= 1.35;
  if (ev.crowd) n *= ev.crowd;
  if (ev.feast) n *= ev.feast.mul;
  return Math.round(clamp(n, 4, 22));
}

let cid = 0;
export function resetCustomers() { cid = 0; }

function labelOf(kind, P, regular) {
  if (!regular) return P.label;
  const t = CLIENT_TITLE[kind];
  return `${t ? t + ' ' : ''}${regular.name}`;
}

export function makeCustomer(s, rng, forced) {
  const ev = s.event || {};
  // une habituée revient parfois
  // une habituée ne revient pas plus d'une fois par semaine, et seulement là où elle t'a connue
  const pool = forced ? [] : s.clients.filter((c) => s.day - (c.seen ?? -9) >= 6 && (c.place || 'assigame') === s.where);
  if (pool.length && rng() < Math.min(0.2, 0.04 + pool.length * 0.02)) {
    const reg = pick(rng, pool);
    reg.seen = s.day;
    return customerOf(s, rng, reg.kind, reg);
  }
  const mix = placeOf(s).mix;
  const weights = Object.fromEntries(Object.entries(PERSONAS).filter(([k]) => personaOpen(s, k)).map(([k, p]) => [k, p.weight
    * (k === 'touriste' && s.rep < 15 ? 0.4 : 1) * (k === 'fidele' && s.rep < 10 ? 0.2 : 1)
    * (ev.feast && ev.feast.boost === k ? 3 : 1) * (mix[k] ?? 1)]));
  return customerOf(s, rng, forced || weighted(rng, weights), null, forced);
}

export function personaOpen(s, k) {
  const u = PERSONAS[k].unlock;
  if (!u) return true;
  if (u.market) return s.where === u.market;
  return (u.day == null || s.day >= u.day) && (u.rep == null || s.rep >= u.rep);
}

function customerOf(s, rng, kind, regular, forced) {
  const P = PERSONAS[kind];
  const qty = P.qty[0] + Math.floor(rng() * (P.qty[1] - P.qty[0] + 1));
  const prefStyle = regular ? regular.prefStyle : pick(rng, ['symboles', 'nature', 'géométrique']);
  const tiers = forced === 'fiancee' ? ['hollandais', 'super'] : P.tiers;
  const look = regular ? { ...regular.look } : { kind, skin: Math.floor(rng() * 5), wrap: Math.floor(rng() * 1000), style: Math.floor(rng() * 3), seed: Math.floor(rng() * 1e6) };
  return {
    id: ++cid, kind, P, qty, prefStyle, tiers, regular,
    label: labelOf(kind, P, regular),
    wantTrend: kind === 'fonctionnaire' || kind === 'fiancee',
    female: !P.man,
    look,
    rich: (s.event && s.event.rich) || 1,
    mood: 1,
  };
}

// le motif exposé qui plaît le plus à cette cliente, ou null
export function chooseItem(s, c) {
  let best = null, bestScore = 0;
  for (const id of s.shelf) {
    const st = s.stock[id];
    if (!st || st.q <= 0) continue;
    if (c.P.uniform && st.q < Math.min(c.qty, 4)) continue;
    const p = pattern(s, id);
    let sc = c.tiers.includes(p.tier) ? 1 : 0.25;
    sc *= p.style === c.prefStyle ? 1.35 : 0.85;
    sc *= c.wantTrend ? trendOf(s, id) * 1.2 : 0.7 + trendOf(s, id) * 0.3;
    if (c.regular && c.regular.lastId === id) sc *= 1.15;
    if (id === 'excl') sc *= exclusiveAppeal(s);
    if (sc > bestScore) { bestScore = sc; best = id; }
  }
  return bestScore >= 0.45 ? best : null;
}

/* ------------------------------------------------------------ marchandage */
// Le prix que la cliente juge juste (V) et son vrai maximum (M) restent cachés.
// Ses gestes trahissent M : à toi de les lire.
export function startHaggle(s, c, id, rng) {
  const p = pattern(s, id);
  const st = s.stock[id];
  const qty = Math.min(c.qty, st.q);
  const ev = s.event || {};
  const V = marketValue(s, id) * c.P.mul * c.rich * (1 + s.rep / 650) * rand(rng, 0.92, 1.08) * (c.P.uniform && qty >= 6 ? 0.9 : 1) * (ev.haggleMul || 1);
  const M = V * rand(rng, 1.02, 1.22) * (c.P.loyal || c.regular ? 1.05 : 1);
  const offer = round50(V * rand(rng, 0.5, 0.68) * (1 - c.P.skill * 0.12));
  s.stats.haggles++;
  const first = c.regular ? regularGreeting(s, c, rng) : openingLine(s, c, id, rng);
  return {
    c, id, p, qty, V, M, offer, patience: c.P.patience + (s.upgrades.parasol ? 1 : 0) + (c.regular ? 1 : 0), round: 0,
    usedArg: false, usedGift: false, done: false, log: [{ who: 'her', text: first }],
    mood: 0.6, // 0 fâchée … 1 ravie
    cue: null,
  };
}

// la première phrase : son profil, mais aussi le temps qu'il fait, la fête, la mode du motif
function openingLine(s, c, id, rng) {
  const ev = s.event || {}, t = trendOf(s, id);
  const ctx = [
    ...(ev.id === 'pluie' ? CONTEXT_LINES.pluie : []), ...(ev.id === 'casse' ? CONTEXT_LINES.casse : []),
    ...(ev.id === 'paie' ? CONTEXT_LINES.paie : []), ...(ev.feast ? CONTEXT_LINES.feast : []),
    ...(ev.saturday ? CONTEXT_LINES.saturday : []), ...(t >= 1.3 ? CONTEXT_LINES.trendUp : t <= 0.75 ? CONTEXT_LINES.trendDown : []),
  ];
  return ctx.length && rng() < 0.4 ? pick(rng, ctx) : pick(rng, c.P.lines);
}
function regularGreeting(s, c, rng) {
  const r = c.regular, last = r.lastId && byId[r.lastId] ? pattern(s, r.lastId).name : null;
  return pick(rng, [
    `C’est encore moi, ${r.name}. Tu te souviens ?`,
    'Ma fille, je reviens chez toi, comme promis.',
    r.visits > 2 ? 'Tu sais que je ne vais que chez toi.' : 'On m’a bien servie la dernière fois.',
    ...(last ? [`Ton « ${last} » de la dernière fois, tout le monde m’a demandé où je l’ai eu !`, `J’ai porté « ${last} » à la messe : on ne parlait que de ça.`] : []),
    ...(s.day - (r.lastDay ?? s.day) > 14 ? ['Ça fait longtemps, hein ! J’étais au village.'] : []),
  ]);
}
// une réplique variée : celles de sa clientèle d'abord, sans répéter ce qu'elle a déjà dit
export function lineFor(h, rng, cat) {
  const own = (PERSONA_REACTIONS[h.c.kind] || {})[cat] || [];
  const all = [...own, ...own, ...REACTIONS[cat]];
  const fresh = all.filter((t) => !h.log.some((m) => m.text.startsWith(t)));
  return pick(rng, fresh.length ? fresh : all);
}
export function playerLine(cat, price, rng = Math.random, avoid = []) {
  const all = PLAYER_LINES[cat];
  const fresh = all.filter((t) => !avoid.some((a) => a.startsWith(t.split('{p}')[0]) && t.split('{p}')[0]));
  const t = pick(rng, fresh.length ? fresh : all);
  return price == null ? t : t.replace('{p}', price);
}

// ce que trahit son attitude après ton prix (les marchandes aguerries cachent mieux leur jeu)
const CUES = {
  far: ['Elle repose le pagne sur l’étal, sans même le regarder.', 'Elle recule d’un pas et croise les bras.'],
  above: ['Elle jette un coup d’œil à l’étal d’à côté.', 'Elle replie le tissu, lentement.'],
  close: ['Elle caresse encore le tissu, hésitante.', 'Elle tâte son porte-monnaie sous son pagne.'],
  yes: ['Elle a déjà la main sur son porte-monnaie.', 'Elle sourit à moitié et regarde le motif de près.'],
  neutral: ['Son visage ne dit rien.', 'Elle te regarde sans rien laisser paraître.'],
};
export function readCue(h, price, rng) {
  const r = price / h.M;
  let kind = r > 1.35 ? 'far' : r > 1.1 ? 'above' : r > 1 ? 'close' : 'yes';
  if (rng() < h.c.P.skill * 0.55) kind = 'neutral';
  const text = pick(rng, CUES[kind]);
  return { kind, text: h.c.P.man ? text.replace(/^Elle /, 'Il ').replace(/ son pagne/, ' sa poche') : text };
}

// le joueur annonce un prix unitaire
export function propose(s, h, price, rng) {
  h.round++;
  price = round50(price);
  const { M } = h;
  if (price <= h.offer) return close(s, h, price, rng, 'accept');
  // une habituée se souvient du prix de la dernière fois
  if (h.c.regular && !h.remembered && h.c.regular.lastFair && price / h.V > Math.max(1.08, h.c.regular.lastFair + 0.15)) {
    h.remembered = true; h.patience -= 1; h.mood = Math.max(0, h.mood - 0.15);
    h.log.push({ who: 'her', text: 'La dernière fois, tu me l’as fait bien moins cher, ma fille !' });
    if (h.patience <= 0) return leave(s, h, rng, false);
  }
  if (price > M * 1.6) {
    h.patience -= 2; h.mood = Math.max(0, h.mood - 0.35);
    h.log.push({ who: 'her', text: lineFor(h, rng, 'insult') });
    return h.patience <= 0 ? leave(s, h, rng, true) : h;
  }
  if (price <= M) {
    // plus on s'approche de son maximum, plus elle hésite ; l'usure des tours la fait céder
    const p = clamp(0.35 + (M - price) / M * 3 + h.round * 0.12 + (h.usedGift ? 0.1 : 0), 0, 0.97);
    if (rng() < p) return close(s, h, price, rng, 'accept');
  }
  h.patience -= 1;
  h.mood = Math.max(0, h.mood - (price > M ? 0.12 : 0.05));
  if (h.patience <= 0) return leave(s, h, rng, false);
  h.cue = readCue(h, price, rng);
  h.log.push({ who: 'cue', text: h.cue.text });
  // contre-offre : elle remonte vers ton prix sans dépasser son maximum
  const target = Math.min(price, M);
  h.offer = round50(Math.max(h.offer, h.offer + (target - h.offer) * rand(rng, 0.25, 0.5) * (1.2 - h.c.P.skill * 0.5)));
  h.log.push({ who: 'her', text: `${lineFor(h, rng, 'counter')} ${fmtUnit(h.offer, h.qty)}` });
  return h;
}

export function useArgument(s, h, key, rng, text) {
  h.usedArg = true;
  h.log.push({ who: 'me', text: text || pick(rng, ARGUMENTS[key].lines) });
  const ok = key === h.c.P.args || (key === 'qualite' && ['hollandais', 'super'].includes(h.p.tier)) || (key === 'mode' && trendOf(s, h.id) > 1.25);
  if (ok) { h.M *= 1.1; h.mood = Math.min(1, h.mood + 0.2); h.log.push({ who: 'her', text: lineFor(h, rng, 'argOk') }); }
  else { h.patience -= 1; h.mood = Math.max(0, h.mood - 0.1); h.log.push({ who: 'her', text: lineFor(h, rng, 'argKo') }); if (h.patience <= 0) return leave(s, h, rng, false); }
  return h;
}

export const GIFT_COST = 400;
export function giveGift(s, h, rng) {
  h.usedGift = true;
  s.money -= GIFT_COST;
  h.M *= 1.06; h.patience += 1; h.mood = Math.min(1, h.mood + 0.25);
  h.log.push({ who: 'me', text: pick(rng, PLAYER_LINES.gift) });
  h.log.push({ who: 'her', text: lineFor(h, rng, 'gift') });
  return h;
}

export function acceptOffer(s, h, rng) { return close(s, h, h.offer, rng, 'accept'); }

// réputation : on la gagne avec un prix juste, on la perd quand on écorche ou qu'on vexe
export const FAIR_MAX = 1.12;
export const REP_DAY_CAP = 1.5;
export function repForSale(fair, gift) {
  let r = 0;
  if (fair <= FAIR_MAX) r += 1;
  else if (fair > 1.35) r -= 1;
  if (gift && fair <= 1.25) r += 1;
  return r;
}

function close(s, h, price, rng) {
  const st = s.stock[h.id];
  const total = price * h.qty;
  s.money += total;
  st.q -= h.qty;
  if (st.q <= 0) delete s.stock[h.id];
  const fair = price / h.V; // 1 : le prix qu'elle juge juste
  const repGain = repForSale(fair, h.usedGift);
  let gain = repGain;
  if (gain > 0) { gain = Math.min(gain * (s.rep < 30 ? 1 : s.rep < 60 ? 0.5 : 0.25), Math.max(0, REP_DAY_CAP - (s.repToday || 0))); s.repToday = (s.repToday || 0) + gain; }
  s.rep = clamp(s.rep + gain, 0, 100);
  s.stats.sold += h.qty; s.stats.revenue += total; s.stats.customers++;
  s.stats.bestSale = Math.max(s.stats.bestSale, total);
  h.done = true; h.result = { sold: true, price, total, margin: total - st.cost * h.qty, cost: st.cost, repGain, repDelta: Math.round(gain * 10) / 10, fair };
  // fidélité : une cliente bien servie revient, et elle en parle
  const c = h.c;
  if (c.regular) {
    const reg = s.clients.find((x) => x.rid === c.regular.rid);
    if (reg) { reg.visits++; reg.lastFair = fair; reg.lastId = h.id; reg.lastDay = s.day; }
  } else if (fair <= FAIR_MAX + 0.03 && c.kind !== 'touriste' && s.clients.length < 14 && rng() < 0.4) {
    const used = new Set(s.clients.map((x) => x.name));
    const names = (c.P.man ? CLIENT_NAMES.m : CLIENT_NAMES.f).filter((n) => !used.has(n));
    if (names.length) {
      const name = pick(rng, names);
      s.clients.push({ rid: `${s.day}-${c.id}`, name, kind: c.kind, place: s.where, look: c.look, prefStyle: c.prefStyle, lastFair: fair, lastId: h.id, lastDay: s.day, visits: 1, seen: s.day });
      h.result.newClient = labelOf(c.kind, c.P, { name });
    }
  }
  h.log.push({ who: 'her', text: lineFor(h, rng, 'accept') });
  return h;
}

function leave(s, h, rng, insulted) {
  s.rep = clamp(s.rep - (insulted ? 2 : 1), 0, 100);
  s.stats.lost++;
  h.done = true; h.result = { sold: false, insulted };
  // une habituée vexée ne revient plus, et le dit autour d'elle
  if (h.c.regular && insulted) {
    s.clients = s.clients.filter((x) => x.rid !== h.c.regular.rid);
    s.rep = clamp(s.rep - 1, 0, 100);
    h.result.lostClient = h.c.label;
  }
  h.log.push({ who: 'her', text: lineFor(h, rng, 'leave') });
  return h;
}
export function letGo(s, h, rng) { return leave(s, h, rng, false); }

// la petite sœur sert une cliente simple au prix juste
export function sisterSale(s, c, id) {
  const st = s.stock[id];
  const qty = Math.min(c.qty, st.q, 2);
  const price = round50(marketValue(s, id) * c.P.mul * 0.98);
  const margin = (price - st.cost) * qty;
  s.money += price * qty; st.q -= qty;
  if (st.q <= 0) delete s.stock[id];
  s.stats.sold += qty; s.stats.revenue += price * qty; s.stats.customers++;
  return { qty, price, margin };
}

export const fmtUnit = (price, qty) => qty > 1 ? `${price.toLocaleString('fr-FR')} F la pièce` : `${price.toLocaleString('fr-FR')} F`;

/* ------------------------------------------------------------ baptiser un motif */
// les Nana Benz donnaient leurs surnoms aux motifs ; un nom qui prend fait la mode
export const BAPTISM_REP = 25;
export const BAPTISM_EVERY = 7;
export const canBaptize = (s) => s.rep >= BAPTISM_REP && s.day - s.namedDay >= BAPTISM_EVERY;
export function baptismChoices(s, id) {
  const used = new Set(Object.values(s.names));
  const rng = dayRng(s, 77 + id.length + (+id.slice(1) || 0));
  return shuffle(rng, BAPTISMS.filter((n) => !used.has(n))).slice(0, 3);
}
export const baptismChance = (s) => clamp(0.35 + s.rep / 150, 0, 0.9);
export function baptize(s, id, name) {
  if (!canBaptize(s) || id === 'excl' || s.names[id] || !s.stock[id]) return null;
  s.namedDay = s.day;
  const ok = dayRng(s, 91)() < baptismChance(s);
  if (ok) { s.names[id] = name; s.trend[id] = Math.max(s.trend[id], 1.6); s.rep = clamp(s.rep + 2, 0, 100); }
  return { ok, name };
}

/* ------------------------------------------------------------ revendeuses */
export function entrust(s, agent, items, marginId) {
  const m = MARGINS.find((x) => x.id === marginId);
  let value = 0;
  for (const { id, q } of items) {
    const st = s.stock[id];
    if (!st || st.q < q) return false;
    value += st.cost * q * m.mul;
  }
  for (const { id, q } of items) { s.stock[id].q -= q; if (s.stock[id].q <= 0) delete s.stock[id]; }
  s.shelf = s.shelf.filter((id) => s.stock[id]);
  s.agents.push({ agentId: agent.id, items, amount: round50(value), due: s.day + agent.days + m.extra, margin: marginId });
  return true;
}

function settleAgents(s) {
  const out = [];
  const rng = dayRng(s, 5);
  s.agents = s.agents.filter((a) => {
    if (a.due > s.day) return true;
    const ag = AGENTS.find((x) => x.id === a.agentId);
    const m = MARGINS.find((x) => x.id === a.margin);
    const r = rng();
    if (r < ag.reliability - m.risk) { s.money += a.amount; s.rep = clamp(s.rep + 1, 0, 100); out.push({ ag, ok: true, amount: a.amount }); }
    else if (r < ag.reliability - m.risk + 0.12) { const part = round50(a.amount * 0.5); s.money += part; out.push({ ag, ok: 'partial', amount: part }); }
    else out.push({ ag, ok: false, amount: 0 });
    return false;
  });
  return out;
}
export const agentBusy = (s, id) => s.agents.some((a) => a.agentId === id);

/* ------------------------------------------------------------ soir */
export const rentOf = (s) => (s.where === 'assigame' ? (s.upgrades.boutique ? 2500 : 600) : placeOf(s).rent);

// brader au comptoir un tissu qui ne se vend pas (60 % du prix payé)
export function dump(s, id, q = 1) {
  const st = s.stock[id];
  if (!st || st.q < q) return 0;
  const back = round50(st.cost * 0.6 * q);
  s.money += back; st.q -= q;
  if (st.q <= 0) { delete s.stock[id]; s.shelf = s.shelf.filter((x) => x !== id); }
  return back;
}

// coups de main quand la caisse et l'étal sont vides : la tontine (deux prêts au plus), puis tante Ama
export const TONTINE = { lend: 40000, back: 48000, max: 2 };
export const AUNT_GIFT = 20000;
function broke(s) {
  const cheapest = Math.min(...(s.offers || []).map((o) => o.price), 99999);
  return s.money < cheapest * 2 && stockCount(s) === 0 && !s.agents.length;
}
export function needsTontine(s) { return broke(s) && s.debt <= TONTINE.back * (TONTINE.max - 1); }
export function needsAunt(s) { return broke(s) && !needsTontine(s) && creditRoom(s) < 10000; }
export function takeTontine(s) { s.money += TONTINE.lend; s.debt += TONTINE.back; s.stats.loans++; }
export function takeAunt(s) { s.money += AUNT_GIFT; s.flags.aunt = (s.flags.aunt || 0) + 1; }

export function endDay(s, dayLog) {
  // la taxe de place : ce qu'on ne peut pas payer reste dû (la caisse ne passe jamais sous zéro)
  const due = (s.event && s.event.sunday || s.resting ? 0 : rentOf(s)) + s.arrears;
  const rent = Math.min(due, Math.max(0, s.money));
  s.money -= rent; s.arrears = due - rent;
  // les gérantes tiennent tes autres places : elles vendent quelques pièces de ton stock au prix du marché
  const managers = s.event && s.event.sunday ? [] : managerSales(s);
  // le crédit du comptoir se rembourse avec ce qui dépasse 10 000 F
  let creditPaid = 0, creditLate = false;
  if (s.credit.owed > 0) {
    creditPaid = Math.min(s.credit.owed, Math.max(0, s.money - 10000));
    s.money -= creditPaid; s.credit.owed -= creditPaid;
    if (s.credit.owed <= 0) { s.credit = { owed: 0, due: null, frozen: false }; }
    else if (s.day >= s.credit.due && !s.credit.frozen) { s.credit.frozen = true; creditLate = true; s.rep = clamp(s.rep - 3, 0, 100); }
  }
  // la tontine se rembourse petit à petit : la moitié de ce qui dépasse 20 000 F
  let repaid = 0;
  if (s.debt > 0 && s.money > 20000) { repaid = round50(Math.min(s.debt, (s.money - 20000) * 0.5)); s.money -= repaid; s.debt -= repaid; }
  // la rivale aussi fait ses affaires
  const rng = dayRng(s, 33);
  if (!s.rival.benzDay) {
    s.rival.money += round50(40000 * (1 + s.day / 80) * rand(rng, 0.55, 1.45) * (s.event && s.event.sunday ? 0.2 : 1));
    if (s.rival.money >= BENZ_PRICE) { s.rival.benzDay = s.day; s.rival.money -= BENZ_PRICE; }
  }
  const entry = { day: s.day, ...dayLog, rested: !!s.resting, rent, arrears: s.arrears, repaid, creditPaid, creditLate, managers, money: s.money, rep: s.rep };
  s.history.push(entry);
  if (s.history.length > 60) s.history.shift();
  s.phase = 'evening';
  // ambitions atteintes ce soir
  entry.ambitions = [];
  for (const a of AMBITIONS) if (!s.flags.amb[a.id] && s.won && a.test(s)) { s.flags.amb[a.id] = s.day; entry.ambitions.push(a.label); }
  return entry;
}

export function buyUpgrade(s, id) {
  const u = UPGRADES.find((x) => x.id === id);
  if (!u || s.upgrades[id] || s.money < u.price) return false;
  if (u.need && ((u.need.rep && s.rep < u.need.rep) || (u.need.upg && !s.upgrades[u.need.upg]))) return false;
  s.money -= u.price;
  s.upgrades[id] = true;
  if (id === 'boutique') s.rep = clamp(s.rep + 8, 0, 100);
  return true;
}
/* ------------------------------------------------------------ le garage */
export const nextCar = (s) => CARS.find((c) => !s.cars.includes(c.id)) || null;
export function buyCar(s) {
  const car = nextCar(s);
  if (!car || s.money < car.price) return null;
  s.money -= car.price;
  s.cars.push(car.id);
  s.flags['car_' + car.id] = s.day;
  if (car.id === 'benz200') { s.won = true; s.flags.benzDay = s.day; }
  s.rep = clamp(s.rep + 5, 0, 100);
  return car;
}
export const buyBenz = (s) => !!(nextCar(s)?.id === 'benz200' && buyCar(s));

/* ------------------------------------------------------------ les autres marchés */
export function buyPlace(s, id) {
  const m = marketById[id];
  if (!m || s.places[id] || s.money < m.price || (m.need && s.rep < m.need.rep)) return false;
  s.money -= m.price;
  s.places[id] = true;
  return true;
}
// les places tenues par d'autres : partout où tu n'es pas ; les jours de repos, ta place aussi
// (à Assigamé, c'est ta petite sœur Afi qui tient l'étal, si elle travaille avec toi)
export const managedPlaces = (s) => MARKETS.filter((m) => s.places[m.id] && (m.id !== s.where || (s.resting && (m.id !== 'assigame' || s.upgrades.soeur))));
const isSister = (s, m) => m.id === 'assigame';
// se reposer : tu ne vas pas au marché, les autres travaillent pour toi
export function rest(s) { s.resting = true; }
export const restHelpers = (s) => managedPlaces({ ...s, resting: true }).map((m) => (isSister(s, m) ? `Afi à ${m.short}` : `ta gérante à ${m.short}`));
// pièces que les gérantes prendront ce soir
export const managerDemand = (s) => managedPlaces(s).reduce((a, m) => a + (m.flow || 3) + Math.floor(s.rep / 35), 0);
function managerSales(s) {
  const out = [];
  const rng = dayRng(s, 55);
  for (const m of managedPlaces(s)) {
    let n = (m.flow || 3) + Math.floor(s.rep / 35), total = 0, sold = 0, margin = 0;
    // elle prend d'abord ce qui se vend le mieux
    const ids = Object.keys(s.stock).sort((a, b) => marketValue(s, b) / s.stock[b].cost - marketValue(s, a) / s.stock[a].cost);
    for (const id of ids) {
      while (n > 0 && s.stock[id] && s.stock[id].q > 0) {
        const st = s.stock[id];
        const price = round50(marketValue(s, id) * rand(rng, 0.88, 1.02));
        total += price; margin += price - st.cost; sold++; n--;
        st.q--; if (st.q <= 0) { delete s.stock[id]; s.shelf = s.shelf.filter((x) => x !== id); }
      }
      if (n <= 0) break;
    }
    const sister = isSister(s, m);
    const cost = (sold && !sister ? MANAGER_WAGE : 0) + (m.id === 'assigame' ? (s.upgrades.boutique ? 2500 : 600) : m.rent);
    s.money += total - Math.min(cost, s.money + total);
    s.stats.sold += sold; s.stats.revenue += total;
    out.push({ place: m.short, who: sister ? 'Afi' : 'ta gérante', sold, total, margin: margin - cost, cost });
  }
  return out;
}

/* ------------------------------------------------------------ motiver une revendeuse */
export const hurryCost = (a) => round50(Math.max(1000, a.amount * 0.06));
export const canHurry = (s, a) => a.due > s.day + 1;
export function hurryAgent(s, idx) {
  const a = s.agents[idx];
  if (!a || !canHurry(s, a) || s.money < hurryCost(a)) return false;
  s.money -= hurryCost(a);
  a.due -= 1;
  a.hurried = (a.hurried || 0) + 1;
  return true;
}
export const BENZ = BENZ_PRICE;

export function nextDay(s) { s.day++; s.phase = 'morning'; }

// fin du défi : la caisse plus le stock au prix d'achat, moins les dettes
export const fortune = (s) => Math.round(s.money + stockValue(s) + s.agents.reduce((a, b) => a + b.amount * 0.8, 0) - s.debt - s.credit.owed - s.arrears);
export const defiOver = (s) => s.mode === 'defi' && s.day >= DEFI_DAYS - 1 && s.phase === 'evening';
export function defiSeed(dateStr) { let h = 2166136261; for (const ch of dateStr) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }

export function tierBadge(t) { return TIERS[t]; }
export { TIER_ORDER };
