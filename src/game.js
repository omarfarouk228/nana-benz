// Moteur du jeu : état, journée, tendances, grossiste, clientèle, marchandage, revendeuses, sauvegarde.
import { CATALOG, byId, TIERS, TIER_ORDER, PERSONAS, AGENTS, MARGINS, UPGRADES, BENZ_PRICE, RANDOM_EVENTS, REACTIONS, ARGUMENTS, dateOf, feastOf } from './data.js';
import { mulberry32, clamp, rand, pick, weighted, round50 } from './util.js';

const SAVE_KEY = 'nb.save.v1';

export function newGame(name = 'Dédévi') {
  const seed = (Math.random() * 1e9) | 0;
  const trend = {};
  const rng = mulberry32(seed);
  for (const p of CATALOG) trend[p.id] = +(0.8 + rng() * 0.5).toFixed(2);
  return {
    v: 1, seed, name, day: 0,
    money: 60000, rep: 8, debt: 0,
    stock: {}, // id -> { q, cost } (coût moyen)
    shelf: [], // ids exposés
    trend,
    upgrades: {},
    agents: [], // missions en cours : { agentId, items:[{id,q}], unit, due, margin }
    event: null, // événement du jour
    offers: [], // grossiste du matin
    history: [], // bilans des journées
    stats: { sold: 0, revenue: 0, bestSale: 0, customers: 0, lost: 0, haggles: 0 },
    flags: {},
    phase: 'morning',
    won: false,
  };
}

export function save(s) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* stockage indisponible */ } }
export function load() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return s && s.v === 1 ? s : null; } catch { return null; } }
export function wipe() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }

export const dayRng = (s, salt = 0) => mulberry32(s.seed + s.day * 7919 + salt);
export const stockCount = (s) => Object.values(s.stock).reduce((a, b) => a + b.q, 0);
export const stockCap = (s) => (s.upgrades.magasin ? 120 : 40);
export const shelfSlots = (s) => (s.upgrades.boutique ? 8 : s.upgrades.etal ? 6 : 4);
export const agentsAvailable = (s) => AGENTS.filter((a) => (s.upgrades.reseau ? true : !['a4', 'a5'].includes(a.id)));
export const hasExclusive = (s) => !!s.upgrades.exclusif;

// le motif exclusif (débloqué tard) : à ton nom, il ne se démode pas
export function exclusivePattern(s) {
  return { id: 'excl', name: `Le pagne de ${s.name}`, motif: 'oeil', tier: 'super', style: 'symboles', spec: { motif: 'eventail', bg: '#16120f', fg: '#e0a526', ac: '#c2185b', seed: 77 } };
}
export const pattern = (s, id) => (id === 'excl' ? exclusivePattern(s) : byId[id]);
export const trendOf = (s, id) => (id === 'excl' ? 1.3 : s.trend[id] || 1);

// valeur de marché d'une pièce aujourd'hui
export function marketValue(s, id) {
  const p = pattern(s, id);
  return TIERS[p.tier].value * trendOf(s, id);
}

/* ------------------------------------------------------------ matin : événement du jour et grossiste */
export function startDay(s) {
  const rng = dayRng(s, 1);
  const date = dateOf(s.day);
  s.phase = 'morning';
  // évolution des modes : marche aléatoire qui revient vers 1
  for (const p of CATALOG) {
    const t = s.trend[p.id];
    s.trend[p.id] = +clamp(t + (1 - t) * 0.12 + (rng() - 0.5) * 0.16, 0.55, 1.75).toFixed(2);
  }
  // événement
  const feast = feastOf(date);
  const evId = weighted(rng, Object.fromEntries(RANDOM_EVENTS.map((e) => [e.id, e.w])));
  let ev = { ...RANDOM_EVENTS.find((e) => e.id === evId) };
  if (s.day === 0) ev = { id: 'debut', title: 'Ton premier jour', text: 'Ta tante t’a laissé sa place au marché et 60 000 F. Le reste dépend de toi.' };
  if (ev.trendUp || ev.trendDown) {
    const p = pick(rng, CATALOG.filter((c) => c.tier !== 'fancy'));
    s.trend[p.id] = ev.trendUp ? 1.7 : 0.6;
    ev.text = ev.text.replace('{p}', `« ${p.name} »`);
    ev.pattern = p.id;
  }
  ev.feast = feast;
  ev.sunday = date.wd === 0;
  ev.saturday = date.wd === 6;
  s.event = ev;
  // offres du grossiste : 7 motifs, dont une nouveauté « super » quand la réputation le permet
  const avail = CATALOG.filter((p) => p.tier !== 'super' || s.rep >= 20);
  const offers = [];
  const pool = [...avail];
  while (offers.length < 7 && pool.length) {
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
  // retours des revendeuses
  const returns = settleAgents(s);
  s.startedDay = s.day;
  s.lastReturns = returns.map((r) => ({ ...r, ag: { name: r.ag.name, town: r.ag.town } }));
  return { date, ev, returns };
}

export function buy(s, offer, q) {
  const cost = offer.price * q;
  if (q <= 0 || cost > s.money || q > offer.stock || stockCount(s) + q > stockCap(s)) return false;
  s.money -= cost;
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
  let n = 6 + s.rep * 0.07;
  if (s.upgrades.parasol) n *= 1.1;
  if (s.upgrades.boutique) n *= 1.25;
  if (ev.saturday) n *= 1.35;
  if (ev.crowd) n *= ev.crowd;
  if (ev.feast) n *= ev.feast.mul;
  return Math.round(clamp(n, 4, 20));
}

let cid = 0;
export function makeCustomer(s, rng, forced) {
  const weights = Object.fromEntries(Object.entries(PERSONAS).map(([k, p]) => [k, p.weight * (k === 'touriste' && s.rep < 15 ? 0.4 : 1) * (k === 'fidele' && s.rep < 10 ? 0.2 : 1)]));
  const kind = forced || weighted(rng, weights);
  const P = PERSONAS[kind];
  const qty = P.qty[0] + Math.floor(rng() * (P.qty[1] - P.qty[0] + 1));
  const prefStyle = pick(rng, ['symboles', 'nature', 'géométrique']);
  const tiers = forced === 'fiancee' ? ['hollandais', 'super'] : P.tiers;
  return {
    id: ++cid, kind, P, qty, prefStyle, tiers,
    wantTrend: kind === 'fonctionnaire' || kind === 'fiancee',
    female: !P.man,
    look: { skin: Math.floor(rng() * 5), wrap: Math.floor(rng() * 1000), style: Math.floor(rng() * 3), seed: Math.floor(rng() * 1e6) },
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
    if (sc > bestScore) { bestScore = sc; best = id; }
  }
  return bestScore >= 0.45 ? best : null;
}

/* ------------------------------------------------------------ marchandage */
// Le prix que la cliente juge juste (V) et son vrai maximum (M) restent cachés.
export function startHaggle(s, c, id, rng) {
  const p = pattern(s, id);
  const st = s.stock[id];
  const qty = Math.min(c.qty, st.q);
  const V = marketValue(s, id) * c.P.mul * c.rich * (1 + s.rep / 500) * rand(rng, 0.92, 1.08) * (c.P.uniform && qty >= 6 ? 0.9 : 1);
  const M = V * rand(rng, 1.02, 1.22) * (c.P.loyal ? 1.05 : 1);
  const offer = round50(V * rand(rng, 0.5, 0.68) * (1 - c.P.skill * 0.12));
  s.stats.haggles++;
  return {
    c, id, p, qty, V, M, offer, patience: c.P.patience + (s.upgrades.parasol ? 1 : 0), round: 0,
    usedArg: false, usedGift: false, done: false, log: [{ who: 'her', text: pick(rng, c.P.lines) }],
    mood: 0.6, // 0 fâchée … 1 ravie
  };
}

// le joueur annonce un prix unitaire
export function propose(s, h, price, rng) {
  h.round++;
  price = round50(price);
  const { M } = h;
  if (price <= h.offer) return close(s, h, price, rng, 'accept');
  if (price > M * 1.6) {
    h.patience -= 2; h.mood = Math.max(0, h.mood - 0.35);
    h.log.push({ who: 'her', text: pick(rng, REACTIONS.insult) });
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
  // contre-offre : elle remonte vers ton prix sans dépasser son maximum
  const target = Math.min(price, M);
  h.offer = round50(Math.max(h.offer, h.offer + (target - h.offer) * rand(rng, 0.25, 0.5) * (1.2 - h.c.P.skill * 0.5)));
  h.log.push({ who: 'her', text: `${pick(rng, REACTIONS.counter)} ${fmtUnit(h.offer, h.qty)}` });
  return h;
}

export function useArgument(s, h, key, rng) {
  h.usedArg = true;
  h.log.push({ who: 'me', text: ARGUMENTS[key].line });
  const ok = key === h.c.P.args || (key === 'qualite' && ['hollandais', 'super'].includes(h.p.tier)) || (key === 'mode' && trendOf(s, h.id) > 1.25);
  if (ok) { h.M *= 1.1; h.mood = Math.min(1, h.mood + 0.2); h.log.push({ who: 'her', text: pick(rng, REACTIONS.argOk) }); }
  else { h.patience -= 1; h.mood = Math.max(0, h.mood - 0.1); h.log.push({ who: 'her', text: pick(rng, REACTIONS.argKo) }); if (h.patience <= 0) return leave(s, h, rng, false); }
  return h;
}

export const GIFT_COST = 400;
export function giveGift(s, h, rng) {
  h.usedGift = true;
  s.money -= GIFT_COST;
  h.M *= 1.06; h.patience += 1; h.mood = Math.min(1, h.mood + 0.25);
  h.log.push({ who: 'me', text: 'Tiens, je t’ajoute un foulard assorti.' });
  h.log.push({ who: 'her', text: pick(rng, REACTIONS.gift) });
  return h;
}

export function acceptOffer(s, h, rng) { return close(s, h, h.offer, rng, 'accept'); }

function close(s, h, price, rng, how) {
  const st = s.stock[h.id];
  const total = price * h.qty;
  s.money += total;
  st.q -= h.qty;
  if (st.q <= 0) delete s.stock[h.id];
  const fair = price / h.V; // < 1 : bonne affaire pour elle
  // la réputation se gagne lentement : un prix honnête, un cadeau, une cliente ravie
  const repGain = (fair <= 0.97 ? 1 : 0) + (h.usedGift && fair <= 1.1 ? 1 : 0);
  s.rep = clamp(s.rep + repGain * (s.rep < 40 ? 1 : 0.5), 0, 100);
  s.stats.sold += h.qty; s.stats.revenue += total; s.stats.customers++;
  s.stats.bestSale = Math.max(s.stats.bestSale, total);
  h.done = true; h.result = { sold: true, price, total, margin: total - st.cost * h.qty, cost: st.cost, repGain };
  h.log.push({ who: 'her', text: pick(rng, REACTIONS.accept) });
  return h;
}

function leave(s, h, rng, insulted) {
  s.rep = clamp(s.rep - (insulted ? 2 : 1), 0, 100);
  s.stats.lost++;
  h.done = true; h.result = { sold: false, insulted };
  h.log.push({ who: 'her', text: pick(rng, REACTIONS.leave) });
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
export const rentOf = (s) => (s.upgrades.boutique ? 2500 : 600);

// brader au comptoir un tissu qui ne se vend pas (60 % du prix payé)
export function dump(s, id, q = 1) {
  const st = s.stock[id];
  if (!st || st.q < q) return 0;
  const back = round50(st.cost * 0.6 * q);
  s.money += back; st.q -= q;
  if (st.q <= 0) { delete s.stock[id]; s.shelf = s.shelf.filter((x) => x !== id); }
  return back;
}

// la tontine du quartier dépanne quand la caisse est vide et l'étal aussi
export const TONTINE = { lend: 40000, back: 48000 };
export function needsTontine(s) {
  const cheapest = Math.min(...(s.offers || []).map((o) => o.price), 99999);
  return !s.debt && s.money < cheapest * 2;
}
export function takeTontine(s) { s.money += TONTINE.lend; s.debt = TONTINE.back; s.stats.loans = (s.stats.loans || 0) + 1; }

export function endDay(s, dayLog) {
  const rent = s.event && s.event.sunday ? 0 : rentOf(s);
  s.money -= rent;
  // remboursement de la tontine dès que la caisse le permet
  let repaid = 0;
  if (s.debt && s.money >= s.debt + 15000) { repaid = s.debt; s.money -= s.debt; s.debt = 0; }
  const entry = { day: s.day, ...dayLog, rent, repaid, money: s.money, rep: s.rep };
  s.history.push(entry);
  if (s.history.length > 60) s.history.shift();
  s.phase = 'evening';
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
export function buyBenz(s) {
  if (s.money < BENZ_PRICE) return false;
  s.money -= BENZ_PRICE;
  s.won = true;
  s.flags.benzDay = s.day;
  return true;
}
export const BENZ = BENZ_PRICE;

export function nextDay(s) { s.day++; s.phase = 'morning'; }

export function tierBadge(t) { return TIERS[t]; }
export { TIER_ORDER };
