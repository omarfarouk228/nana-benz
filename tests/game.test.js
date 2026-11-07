import { describe, it, expect, beforeAll } from 'vitest';
import * as G from '../src/game.js';
import { CARS, MARKETS } from '../src/data.js';
import { playGame, median } from './bot.js';

beforeAll(() => { globalThis.localStorage = { _: {}, getItem(k) { return this._[k] ?? null; }, setItem(k, v) { this._[k] = v; }, removeItem(k) { delete this._[k]; } }; });

describe('la caisse et les coups durs', () => {
  it('la taxe impayée reste due, la caisse ne passe jamais sous zéro', () => {
    const s = G.newGame('T', { seed: 1 });
    G.startDay(s); s.money = 200;
    G.endDay(s, {});
    expect(s.money).toBe(0);
    expect(s.arrears).toBe(400);
  });
  it('une joueuse ruinée trouve toujours une issue (tontine, puis tante Ama)', () => {
    const s = G.newGame('T', { seed: 2 });
    G.startDay(s); s.money = 0; s.stock = {};
    expect(G.needsTontine(s)).toBe(true);
    G.takeTontine(s); s.money = 0; G.takeTontine(s); s.money = 0;
    expect(G.needsTontine(s)).toBe(false);
    expect(G.needsAunt(s)).toBe(true);
  });
  it('la gourmande ne finit jamais avec une caisse négative', () => {
    for (let i = 0; i < 6; i++) expect(playGame('greedy', 500 + i, { maxDays: 90 }).minMoney).toBeGreaterThanOrEqual(0);
  });
});

describe('équilibrage', () => {
  const days = (strat) => Array.from({ length: 10 }, (_, i) => playGame(strat, 1000 + i * 97).won ?? 999);
  it('marchander en lisant la cliente paie mieux que vendre au prix affiché', () => {
    const smart = median(days('smart')), honest = median(days('honest'));
    expect(smart).toBeLessThan(honest);
    expect(smart).toBeGreaterThanOrEqual(22);
    expect(honest).toBeLessThanOrEqual(60);
  });
  it('trop demander ne mène pas à la Benz', () => {
    expect(days('greedy').filter((d) => d < 999).length).toBe(0);
  });
});

describe('marchandage', () => {
  const setup = () => {
    const s = G.newGame('T', { seed: 3 }); G.startDay(s);
    s.stock = { p8: { q: 5, cost: 4000 } }; s.shelf = ['p8'];
    const rng = () => 0.5;
    const c = G.makeCustomer(s, rng, 'fonctionnaire');
    return { s, h: G.startHaggle(s, c, 'p8', rng), rng };
  };
  it('après un refus, ses gestes trahissent son prix maximum', () => {
    const { s, h, rng } = setup();
    G.propose(s, h, h.M * 1.5, rng);
    expect(h.cue).toBeTruthy();
    expect(['far', 'neutral']).toContain(h.cue.kind);
  });
  it('la réputation récompense le prix juste et punit le prix écorché', () => {
    expect(G.repForSale(1.0, false)).toBe(1);
    expect(G.repForSale(1.2, false)).toBe(0);
    expect(G.repForSale(1.5, false)).toBe(-1);
  });
});

describe('progression', () => {
  it('les clientes fidèles reviennent, mais pas tous les jours', () => {
    const r = playGame('honest', 4242, { maxDays: 40 });
    expect(r.S.clients.length).toBeGreaterThan(0);
  });
  it('de nouvelles clientèles et collections arrivent avec les semaines', () => {
    const s = G.newGame('T', { seed: 5 });
    expect(G.personaOpen(s, 'funerailles')).toBe(false);
    s.day = 20; G.startDay(s);
    expect(G.personaOpen(s, 'funerailles')).toBe(true);
    expect(G.releasedPatterns(s).length).toBe(3);
    expect(s.news.some((n) => n.kind === 'collection')).toBe(true);
  });
  it('le garage se remplit dans l’ordre, la première voiture fait gagner', () => {
    const s = G.newGame('T', { seed: 6 }); s.money = 100e6;
    for (const car of CARS) expect(G.buyCar(s).id).toBe(car.id);
    expect(s.won).toBe(true);
    expect(G.buyCar(s)).toBe(null);
  });
  it('une place dans un autre marché vend ton stock par une gérante', () => {
    const s = G.newGame('T', { seed: 7 }); G.startDay(s);
    s.rep = 25; s.money = 200000;
    expect(G.buyPlace(s, 'adawlato')).toBe(true);
    s.stock = { p8: { q: 10, cost: 4000 } };
    const e = G.endDay(s, {});
    expect(e.managers[0].sold).toBeGreaterThan(0);
    expect(s.stock.p8.q).toBeLessThan(10);
    expect(MARKETS.length).toBeGreaterThanOrEqual(4);
  });
  it('payer une revendeuse la fait revenir un jour plus tôt', () => {
    const s = G.newGame('T', { seed: 8 }); G.startDay(s);
    s.stock = { p8: { q: 4, cost: 4000 } };
    G.entrust(s, { id: 'a3', days: 4 }, [{ id: 'p8', q: 4 }], 'juste');
    const due = s.agents[0].due, m = s.money;
    expect(G.hurryAgent(s, 0)).toBe(true);
    expect(s.agents[0].due).toBe(due - 1);
    expect(s.money).toBe(m - G.hurryCost(s.agents[0]));
  });
  it('le crédit du comptoir s’ouvre avec la réputation et se rembourse le soir', () => {
    const s = G.newGame('T', { seed: 9 }); G.startDay(s);
    expect(G.creditLimit(s)).toBe(0);
    s.rep = 20; s.money = 0;
    const o = { id: 'p8', price: 4000, stock: 5 };
    expect(G.buy(s, o, 2, true)).toBe(true);
    expect(s.credit.owed).toBe(8400);
    s.money = 30000; G.endDay(s, {});
    expect(s.credit.owed).toBe(0);
  });
  it('baptiser un motif : réussi, il prend son nouveau nom', () => {
    const s = G.newGame('T', { seed: 10 }); G.startDay(s);
    s.rep = 100; s.stock = { p8: { q: 2, cost: 4000 } };
    const name = G.baptismChoices(s, 'p8')[0];
    const r = G.baptize(s, 'p8', name);
    if (r.ok) expect(G.pattern(s, 'p8').name).toBe(name);
    expect(G.canBaptize(s)).toBe(false);
  });
});

describe('sauvegarde', () => {
  it('une ancienne sauvegarde est complétée', () => {
    const old = { v: 1, seed: 1, name: 'A', day: 3, money: 1000, rep: 5, debt: 0, stock: {}, shelf: [], trend: {}, upgrades: {}, agents: [], history: [], stats: { sold: 0 }, flags: {}, won: true };
    localStorage.setItem('nb.save.v1', JSON.stringify(old));
    const s = G.load();
    expect(s.cars).toEqual(['benz200']);
    expect(s.places.assigame).toBe(true);
    expect(s.credit.owed).toBe(0);
  });
  it('le défi du jour a sa propre sauvegarde', () => {
    const d = G.newGame('A', { mode: 'defi', seed: G.defiSeed('2026-11-07') });
    G.save(d);
    expect(G.load('defi').mode).toBe('defi');
    expect(G.defiSeed('2026-11-07')).toBe(G.defiSeed('2026-11-07'));
  });
});

describe('se reposer', () => {
  it('Afi et les gérantes vendent pendant ton repos, sans taxe pour ta place fermée', () => {
    const s = G.newGame('T', { seed: 11 }); G.startDay(s);
    s.upgrades.soeur = true; s.places.adawlato = true;
    s.stock = { p8: { q: 20, cost: 4000 } }; s.money = 5000;
    G.rest(s);
    const e = G.endDay(s, {});
    expect(e.rested).toBe(true);
    expect(e.managers.map((m) => m.who).sort()).toEqual(['Afi', 'ta gérante']);
    expect(e.managers.every((m) => m.sold > 0)).toBe(true);
  });
  it('sans aide, la place reste fermée et rien ne se vend', () => {
    const s = G.newGame('T', { seed: 12 }); G.startDay(s);
    s.stock = { p8: { q: 5, cost: 4000 } }; s.money = 5000;
    G.rest(s);
    const e = G.endDay(s, {});
    expect(e.managers.length).toBe(0);
    expect(e.rent).toBe(0);
    expect(s.stock.p8.q).toBe(5);
  });
});
