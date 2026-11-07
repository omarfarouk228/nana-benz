// Joueuses automatiques pour vérifier l'équilibrage (utilisées par les tests et par `npm run sim`).
import * as G from '../src/game.js';
import { UPGRADES, MARKETS } from '../src/data.js';
import { mulberry32 } from '../src/util.js';

// stratégies de marchandage : à partir de ce qu'elle juge juste (V), on annonce puis on descend selon ses gestes
const STRATS = {
  // annonce le prix juste, accepte vite
  honest: { open: 1.0, step: () => 0.96 },
  // annonce haut et lit les gestes : elle recule, on descend fort ; elle hésite, on descend à peine
  smart: { reads: true, open: 1.3, step: (cue) => ({ far: 0.85, above: 0.92, close: 0.98, yes: 1, neutral: 0.95 }[cue] ?? 0.95) },
  // demande beaucoup trop et descend lentement
  greedy: { open: 2.2, step: () => 0.97 },
};

export function playGame(strat, seed, { maxDays = 160, places = true } = {}) {
  const S = G.newGame('Test', { seed });
  const st = STRATS[strat];
  let minMoney = Infinity;
  for (let d = 0; d < maxDays; d++) {
    G.startDay(S);
    if (G.needsTontine(S)) G.takeTontine(S);
    else if (G.needsAunt(S)) G.takeAunt(S);
    if (!S.event.sunday) {
      // va vendre au marché le plus récent qu'elle possède
      if (places) S.where = [...MARKETS].reverse().find((m) => S.places[m.id]).id;
      const keep = S.money * 0.15;
      for (const o of [...S.offers].sort((a, b) => G.marketValue(S, b.id) / b.price - G.marketValue(S, a.id) / a.price)) {
        let q = Math.min(o.stock, Math.floor((S.money - keep) / o.price), G.stockCap(S) - G.stockCount(S));
        while (q > 0 && !G.buy(S, o, q)) q--;
      }
      S.shelf = Object.keys(S.stock).sort((a, b) => G.trendOf(S, b) - G.trendOf(S, a)).slice(0, G.shelfSlots(S));
      G.resetCustomers();
      const rng = mulberry32(seed + d * 13);
      const n = G.crowdSize(S);
      for (let k = 0; k < n; k++) {
        const c = G.makeCustomer(S, rng);
        const id = G.chooseItem(S, c);
        if (!id) continue;
        const h = G.startHaggle(S, c, id, rng);
        const cost = S.stock[id].cost;
        // elle ne connaît pas le prix caché : elle part du prix affiché « se vend ~ »
        // la joueuse aguerrie sait qu'une touriste paie plus qu'une chorale (elle lit le profil, pas le prix caché)
        let price = G.marketValue(S, id) * st.open * (st.reads ? c.P.mul : 1);
        while (!h.done) {
          if (h.round > 7 || price <= h.offer) { G.acceptOffer(S, h, rng); break; }
          G.propose(S, h, Math.max(price, cost * 1.05), rng);
          price = Math.max(h.offer + 50, price * st.step(h.cue?.kind));
        }
        S.shelf = S.shelf.filter((i) => S.stock[i]);
      }
    }
    G.endDay(S, { revenue: 0, sales: 0, lost: 0 });
    minMoney = Math.min(minMoney, S.money);
    for (const u of UPGRADES) if (S.money > u.price * 2.2 && u.id !== 'exclusif') G.buyUpgrade(S, u.id);
    if (places) for (const m of MARKETS) if (S.money > m.price * 2.5) G.buyPlace(S, m.id);
    if (G.buyBenz(S)) return { won: d + 1, rep: Math.round(S.rep), minMoney, clients: S.clients.length, places: Object.keys(S.places).length, S };
    G.nextDay(S);
  }
  return { won: null, rep: Math.round(S.rep), money: S.money, minMoney, S };
}

export const median = (a) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
