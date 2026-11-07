// Simulation de l'équilibrage : `npm run sim`
import { playGame, median } from '../tests/bot.js';
for (const strat of ['honest', 'smart', 'greedy']) {
  const runs = Array.from({ length: 16 }, (_, i) => playGame(strat, 1000 + i * 97));
  const won = runs.filter((r) => r.won).map((r) => r.won);
  console.log(`${strat.padEnd(7)} Benz ${won.length}/16 · jour médian ${won.length ? median(won) : '-'} (min ${Math.min(...won)}, max ${Math.max(...won)}) · réputation médiane ${median(runs.map((r) => r.rep))} · caisse min ${Math.min(...runs.map((r) => r.minMoney))} · places ${median(runs.map((r) => r.places || 1))}`);
}
