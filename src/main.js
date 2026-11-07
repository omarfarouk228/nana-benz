import * as G from './game.js';
import { Market, DAY_SECONDS, SELF } from './market.js';
import { HaggleScene } from './scene.js';
import { Music } from './music.js';
import { playCine } from './cine.js';
import { drawPortrait, drawFigure } from './people.js';
import { waxURL, waxPattern } from './wax.js';
import { PALETTES, MOTIF_NAMES, TIERS, PERSONAS, ARGUMENTS, AGENTS, MARGINS, UPGRADES, BENZ_PRICE, CATALOG, CARS, MARKETS, RIVAL, AMBITIONS, MANAGER_WAGE, dateOf, rankOf, seasonRankOf } from './data.js';
import { drawCarCard, playCarReveal } from './reveal.js';
import { Sound } from './audio.js';
import { $, $$, esc, fmt, clamp, mulberry32, pick, shuffle, round50 } from './util.js';

const sound = new Sound();
const music = new Music(sound);
let S = G.load();
let dayLog = null;
let haggle = null;

/* ------------------------------------------------------------ outils d'interface */
const screen = $('#screen');
function show(html) { screen.innerHTML = html; screen.classList.add('on'); screen.scrollTop = 0; }
function hideScreen() { screen.classList.remove('on'); screen.innerHTML = ''; }
function toast(text, kind = '', ms = 2600) {
  const box = $('#toasts');
  while (box.children.length > 2) box.firstChild.remove();
  const el = document.createElement('div');
  el.className = 'toast ' + kind; el.textContent = text;
  box.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, ms);
}
// la journée en cours est sauvegardée après chaque vente : recharger la page ne fait rien perdre
function saveToday() { if (!S || !dayLog) return; S.today = dayLog; G.save(S); }
const sw = (spec, size = 64) => `background-image:url(${waxURL(spec, 96)});background-size:${size}px ${size}px`;
const tierTag = (t) => `<span class="tier" style="background:${TIERS[t].color}">${TIERS[t].name}</span>`;
function trendTag(v) {
  if (v >= 1.25) return '<span class="trend up">▲ à la mode</span>';
  if (v <= 0.8) return '<span class="trend down">▼ démodé</span>';
  return '<span class="muted">stable</span>';
}
const repLabel = (r) => (r >= 80 ? 'Reine du marché' : r >= 60 ? 'Grande commerçante' : r >= 40 ? 'Commerçante connue' : r >= 20 ? 'On parle de toi' : 'Nouvelle au marché');
document.documentElement.style.setProperty('--wax', `url(${waxURL({ motif: 'zigzag', bg: '#1d2f6f', fg: '#f2c230', ac: '#b8322a', seed: 5 }, 48)})`);

/* ------------------------------------------------------------ scène */
const market = new Market($('#scene'), S || G.newGame(), {
  tap: (c) => openHaggle(c),
  served: (c, sale) => { sound.coin(); toast(`Afi a vendu ${sale.qty} pièce${sale.qty > 1 ? 's' : ''} à ${fmt(sale.price)}`, 'good'); dayLog.sales.push({ who: 'Afi (ta petite sœur)', qty: sale.qty, total: sale.price * sale.qty, margin: sale.margin }); saveToday(); updateBar(); updateShelf(); },
  left: (c, why) => {
    dayLog.lost++; saveToday();
    if (why === 'tired') toast(`${c.label} ${c.P.man ? 'est parti, lassé' : 'est partie, lassée'} d’attendre.`, 'bad');
    // indice pour apprendre à garnir son étal
    else if (why === 'nothing') toast(`${c.label} cherchait du ${c.tiers.map((t) => TIERS[t].name.toLowerCase()).join(' ou ')}, plutôt motif ${c.prefStyle}.`, '', 3200);
  },
  tick: () => updateBar(),
  sfx: (name, p, text) => {
    if (name === 'bell') { sound.tone(2350, 0.14, 'sine', 0.035); sound.tone(2350, 0.18, 'sine', 0.035, 0.16); }
    else if (name === 'say' && text) sound.speak(text, { base: p.man ? 130 : p.kind === 'child' ? 300 : 225, vol: 0.016 });
  },
  closing: () => { if (market.running) endMarket(); },
});
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  market.update(dt);
  market.draw();
}
requestAnimationFrame(frame);

/* ------------------------------------------------------------ titre */
function title() {
  $('#bar').hidden = true; $('#shelf').hidden = true;
  const saved = G.load();
  const today = todayStr();
  const defi = G.load('defi');
  const defiToday = defi && defi.defiDate === today ? defi : null;
  const best = bestDefi(today);
  show(`
    <section class="title">
      <div>
        <div class="kicker">Lomé, 1974</div>
        <div class="logo">Nana<em>Benz</em></div>
        <p class="tagline">Une place au Grand marché, quelques pièces de wax, et un rêve : rouler en Benz comme les grandes dames d’Assigamé.</p>
        <div class="namefield"><label for="t-name">Ton nom de commerçante</label><input id="t-name" maxlength="16" value="${esc(saved?.name || 'Dédévi')}" autocomplete="off"></div>
        <div class="actions">
          ${saved ? `<button class="btn gold" id="t-cont">Continuer · jour ${saved.day + 1}</button>` : ''}
          <button class="btn ${saved ? 'ghost' : 'gold'}" id="t-new">${saved ? 'Nouvelle partie' : 'Ouvrir mon étal'}</button>
          <button class="btn ghost" id="t-defi">${defiToday && !defiToday.flags.defiDone ? `Défi du jour · reprendre jour ${defiToday.day + 1}` : 'Défi du jour'}${best ? ` · record ${fmt(best)}` : ''}</button>
        </div>
        <p class="muted" style="font-size:12.5px;margin:10px 0 0;max-width:46ch">Le défi du jour : la même semaine de marché pour tout le monde aujourd’hui (mêmes arrivages, mêmes clientes). Six jours pour faire la plus grosse fortune.</p>
        <details class="howto"><summary>Comment on joue ?</summary>
          <ol>
            <li><b>Le matin, au comptoir du port</b> : achète des pièces de wax. Fancy pour les petites bourses, anglais, hollandais, et les nouveautés « super wax ». Regarde ce qui est à la mode. Plus tard, le comptoir te fera crédit.</li>
            <li><b>Choisis ce que tu exposes</b> sur ton étal : les clientes ne voient que ça.</li>
            <li><b>Au marché</b>, si personne ne s’arrête, <b>hèle les passants</b>. Touche une cliente pour la servir et <b>marchande</b>. Après chaque refus, <b>regarde ses gestes</b> : elle recule, elle hésite, elle cherche son porte-monnaie… Ils trahissent son vrai prix.</li>
            <li><b>Un prix juste</b> fait ta réputation, et une cliente bien servie revient avec son nom. Écorcher ou vexer se paie.</li>
            <li><b>Le soir</b>, confie des pièces à tes revendeuses, achète un parasol, une boutique, une place dans d’autres marchés de Lomé et d’ailleurs.</li>
            <li><b>Objectif</b> : ${fmt(BENZ_PRICE)} pour la Benz avant la fête de l’Indépendance, le 27 avril 1975. Puis d’autres voitures, toujours plus belles.</li>
            <li><b>Au clavier</b> : 1, 2, 3 pour servir une cliente, H pour héler. Pendant le marchandage, ← et → changent ton prix (Maj : par 500), Entrée propose, A accepte.</li>
          </ol>
        </details>
        <p class="credits">Jeu original. Les motifs sont dessinés par le programme ; leurs surnoms sont ceux qu’on entend au marché. Hommage aux commerçantes de wax de Lomé.</p>
      </div>
      <div class="hero"><canvas id="t-hero"></canvas></div>
    </section>`);
  heroLoop($('#t-hero'));
  $('#t-new').onclick = () => {
    sound.init(); sound.click();
    if (saved && !confirmReset()) return;
    S = G.newGame(cleanName($('#t-name').value));
    market.s = S;
    G.save(S);
    morning();
  };
  if (saved) $('#t-cont').onclick = () => { sound.init(); sound.click(); S = saved; S.name = cleanName($('#t-name').value) || S.name; resume(); };
  $('#t-defi').onclick = () => {
    sound.init(); sound.click();
    if (defiToday && defiToday.flags.defiDone) { S = defiToday; market.s = S; defiEnd(); return; }
    if (defiToday) { S = defiToday; resume(); return; }
    S = G.newGame(cleanName($('#t-name').value), { mode: 'defi', seed: G.defiSeed(today), defiDate: today });
    market.s = S; G.save(S); morning();
  };
}
// reprendre une partie là où elle s'était arrêtée
function resume() {
  market.s = S;
  if (S.phase === 'evening') { music.play('evening'); evening(true); return; }
  if (S.phase === 'market') {
    // la page a été fermée pendant le marché : la journée se termine avec les ventes déjà faites
    dayLog = S.today || { sales: [], lost: 0, bought: 0, startMoney: S.dayStartMoney ?? S.money };
    music.play('evening');
    toast('Le marché a fermé pendant ton absence. Voici le bilan de la journée.', '', 3600);
    evening();
    return;
  }
  morning();
}
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function bestDefi(date) { try { return +(localStorage.getItem('nb.defi.best.' + date) || 0); } catch { return 0; } }
function setBestDefi(date, v) { try { if (v > bestDefi(date)) localStorage.setItem('nb.defi.best.' + date, String(v)); } catch { /* ignore */ } }
function confirmReset() {
  // pas de boîte de dialogue du navigateur : second appui pour confirmer
  const b = $('#t-new');
  if (b.dataset.sure) return true;
  b.dataset.sure = '1'; b.textContent = 'Effacer et recommencer ?'; b.classList.add('red');
  return false;
}
const cleanName = (v) => String(v || '').replace(/[<>]/g, '').trim().slice(0, 16) || 'Dédévi';

function heroLoop(cv) {
  const g = cv.getContext('2d');
  const look = { skin: 1, style: 0, seed: 424242, age: 1 };
  const loop = (t) => {
    if (!document.body.contains(cv)) return;
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = waxPattern(g, { motif: 'eventail', bg: '#1d2f6f', fg: '#f2c230', ac: '#b8322a', seed: 9 }, 160, 1);
    g.fillRect(0, 0, r.width, r.height);
    g.fillStyle = 'rgba(29,47,111,.35)'; g.fillRect(0, 0, r.width, r.height);
    drawPortraitOn(g, r.width, r.height, look, t / 1000);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
// portrait centré dans une zone
const _pc = document.createElement('canvas');
function drawPortraitOn(g, W, H, look, t, opts = {}) {
  const S2 = Math.min(W, H * 1.05);
  _pc.width = _pc.height = Math.round(S2 * Math.min(2, devicePixelRatio || 1));
  const pg = _pc.getContext('2d');
  pg.setTransform(_pc.width / S2, 0, 0, _pc.width / S2, 0, 0);
  drawPortrait(pg, S2, S2, look, { mood: 0.85, t, blink: (t % 4) < 0.12, ...opts });
  g.drawImage(_pc, (W - S2) / 2, H - S2, S2, S2);
}

/* ------------------------------------------------------------ matin : comptoir du port */
function morning() {
  $('#bar').hidden = true; $('#shelf').hidden = true;
  // une journée déjà commencée (reprise de partie) n'est pas recalculée
  const resumed = S.startedDay === S.day;
  const { date, ev, returns } = resumed ? { date: dateOf(S.day), ev: S.event, returns: [] } : G.startDay(S);
  if (!resumed) S.dayStartMoney = S.money;
  G.save(S);
  sound.init(); if (!resumed) sound.morning();
  music.play('morning');
  if (!resumed) playCine('dawn', { kicker: S.mode === 'defi' ? `Défi du jour · jour ${S.day + 1} sur ${G.DEFI_DAYS}` : `Jour ${S.day + 1}`, title: esc(dateOf(S.day).label), line: dawnLine(ev) }, SELF);
  dayLog = { sales: [], lost: 0, bought: 0, startMoney: S.dayStartMoney ?? S.money };
  const evIcon = ev.feast ? '🎉' : { pluie: '🌧', bateau: '🚢', arrivage: '📦', rumeur: '👂', malheur: '🙊', mariage: '💍', paie: '💰', debut: '🌅', phosphates: '⛏', rafle: '🏃🏾‍♀️', casse: '📉' }[ev.id] || '☀';
  const ret = returns.map((r) => r.ok === true ? `<div class="pill" style="background:#e3f1e8">${esc(r.ag.name)} revient de ${esc(r.ag.town)} : +${fmt(r.amount)}</div>`
    : r.ok === 'partial' ? `<div class="pill" style="background:#fff1d6">${esc(r.ag.name)} n’a vendu qu’une partie : +${fmt(r.amount)}</div>`
    : `<div class="pill" style="background:#f8dcd8">${esc(r.ag.name)} n’est pas revenue de ${esc(r.ag.town)}…</div>`).join('');
  const NEWS_ICON = { collection: '🚢', client: '👥', market: '🏬', credit: '📒', name: '✒', car: '🚘' };
  const news = (S.news || []).slice(0, 4).map((n) => `<div class="news"><div class="ico">${NEWS_ICON[n.kind] || '★'}</div><div><div class="kicker">Nouveau</div><b>${esc(n.title)}</b><p>${esc(n.text)}</p></div></div>`).join('');
  const rivalNews = S.rival.benzDay != null && !S.flags.rivalSeen && !S.won;
  if (rivalNews) { S.flags.rivalSeen = S.day; G.save(S); }
  const places = MARKETS.filter((m) => S.places[m.id]);
  const managed = G.managedPlaces(S);
  const credit = G.creditLimit(S);
  const left = G.daysLeft(S);
  show(`
    <div class="veil"><div class="wrap">
      <div class="spread">
        <div><div class="kicker">${S.mode === 'defi' ? `Défi du jour · jour ${S.day + 1} sur ${G.DEFI_DAYS}` : `Jour ${S.day + 1}`} · ${esc(date.label)}</div><h2>${ev.sunday ? 'Dimanche, jour du Seigneur' : 'Le comptoir du port'}</h2>
          ${S.mode !== 'defi' && !S.won && left > 0 ? `<div class="muted" style="font-size:13px;margin-top:4px">${left} jour${left > 1 ? 's' : ''} avant la fête de l’Indépendance, le 27 avril 1975</div>` : ''}</div>
        <div style="text-align:right"><div class="money" id="m-money">${fmt(S.money)}</div><div class="muted" style="font-size:12.5px">${repLabel(S.rep)} · réputation ${Math.round(S.rep)}</div></div>
      </div>
      <div class="card waxed" style="margin-top:14px"><div class="in event">
        <div class="ico">${evIcon}</div>
        <div><h3>${esc(ev.feast ? ev.feast.name : ev.title || 'Journée ordinaire')}</h3><p class="lead" style="margin-top:4px;font-size:15px">${esc(ev.feast ? ev.feast.text : ev.text || 'Le marché vit son rythme habituel.')}${ev.saturday ? ' C’est samedi : le marché sera plein.' : ''}</p>
        ${ret ? `<div class="row" style="margin-top:8px">${ret}</div>` : ''}</div>
      </div></div>
      ${news || rivalNews ? `<div class="newsbox">${news}${rivalNews ? `<div class="news rival"><div class="ico">🚗</div><div><div class="kicker">Au marché, on ne parle que de ça</div><b>${RIVAL.name} a sa Benz</b><p>Ta rivale est passée devant Assigamé au volant d’une Mercedes neuve. Rien n’est perdu : la course continue jusqu’au 27 avril.</p></div></div>` : ''}</div>` : ''}
      ${ev.sunday ? `
        <p class="lead">Le marché est fermé. Les dames vont à la messe… et regardent les pagnes des autres. Profite-en pour t’occuper de ton réseau.</p>
        <div class="sticky-go"><button class="btn gold" id="go-even">Passer la journée</button></div>` : `
      ${S.day === 0 ? `<div class="card" style="margin-top:14px"><div class="in">
        <h3>Les conseils de tante Ama</h3>
        <ul class="tips">
          <li>Commence petit : quelques pièces de <b>fancy</b> pour les étudiantes et les chorales, et de l’<b>anglais</b> pour les dames. Le hollandais rapporte plus, mais il coûte cher.</li>
          <li>Varie les motifs : chaque cliente préfère un style (symboles, nature, géométrique). Ce qui est <b>à la mode</b> part plus cher.</li>
          <li>Au marché, annonce plus haut que ce que tu espères, puis <b>regarde ses gestes</b> : si elle recule, tu es bien trop cher ; si elle hésite, tu y es presque. Une touriste paie plus qu’une étudiante.</li>
          <li>Un <b>prix juste</b> fait ta réputation, et une cliente contente revient. Écorcher une cliente se sait vite au marché.</li>
        </ul>
      </div></div>` : ''}
      ${G.needsTontine(S) ? `<div class="card" style="margin-top:14px;border:2px solid var(--gold)"><div class="in spread">
        <div><h3>La tontine du quartier</h3><p class="muted" style="margin:4px 0 0">Ta caisse est vide. Les femmes de ta tontine te prêtent ${fmt(G.TONTINE.lend)}, à rendre ${fmt(G.TONTINE.back)} petit à petit, quand tes affaires reprennent.</p></div>
        <button class="btn gold" id="tontine">Accepter le prêt</button></div></div>`
      : G.needsAunt(S) ? `<div class="card" style="margin-top:14px;border:2px solid var(--gold)"><div class="in spread">
        <div><h3>Tante Ama passe te voir</h3><p class="muted" style="margin:4px 0 0">« Ma fille, la tontine ne peut plus rien pour toi. Prends ces ${fmt(G.AUNT_GIFT)}, et cette fois, ne demande pas trop cher. »</p></div>
        <button class="btn gold" id="aunt">Merci, tantie</button></div></div>` : ''}
      ${S.debt || S.arrears || S.credit.owed ? `<p class="muted" style="margin:12px 0 0">${[
        S.debt ? `Tontine : il reste ${fmt(S.debt)} à rendre.` : '',
        S.arrears ? `Taxe de place en retard : ${fmt(S.arrears)}.` : '',
        S.credit.owed ? `Crédit du comptoir : ${fmt(S.credit.owed)} à payer ${S.credit.frozen ? '<b class="neg">en retard, le comptoir ne te fait plus crédit</b>' : `avant le jour ${S.credit.due + 1}`}.` : '',
      ].filter(Boolean).join(' ')}</p>` : ''}
      ${places.length > 1 ? `<div class="card" style="margin-top:14px"><div class="in">
        <div class="spread"><h3>Où vends-tu aujourd’hui ?</h3>${managed.length ? `<span class="pill">Tes gérantes prendront jusqu’à ${G.managerDemand(S)} pièces ce soir</span>` : ''}</div>
        <div class="tabs places" style="margin:10px 0 0">${places.map((m) => `<button data-where="${m.id}" class="${S.where === m.id ? 'on' : ''}">${esc(m.short)}</button>`).join('')}</div>
        <p class="muted" style="margin:8px 0 0;font-size:13px">${esc(G.placeOf(S).desc)}${managed.length ? ` Ailleurs (${managed.map((m) => esc(m.short)).join(', ')}), ta gérante vend ton stock au prix du marché.` : ''}</p>
      </div></div>` : ''}
      <div class="grid2">
        <div class="card"><div class="in">
          <div class="spread"><h3>Arrivages du jour</h3><span class="pill" id="stockpill">Stock ${G.stockCount(S)} / ${G.stockCap(S)}</span></div>
          ${credit ? `<div class="paywith"><span class="muted">Payer</span><div class="tabs" style="margin:0"><button data-pay="cash">Caisse</button><button data-pay="credit">Crédit · reste <span id="c-room">${fmt(G.creditRoom(S))}</span></button></div></div>` : ''}
          <div class="offers" id="offers"></div>
        </div></div>
        <div class="card"><div class="in">
          <div class="spread"><h3>Ton étal</h3><span class="pill" id="slots"></span></div>
          <p class="muted" style="margin:4px 0 0;font-size:13px">Touche un tissu pour l’exposer ou le retirer. Les clientes ne voient que ce qui est sur l’étal.</p>
          <div class="stocklist" id="stocklist"></div>
        </div></div>
      </div>
      <div class="sticky-go"><button class="btn rest" id="go-rest" title="${esc(G.restHelpers(S).length ? 'Tiendront le marché : ' + G.restHelpers(S).join(', ') : 'Personne ne tiendra tes places')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg><span>Me reposer</span></button><button class="btn gold" id="go-market">Ouvrir le stand${places.length > 1 ? ` · ${esc(G.placeOf(S).short)}` : ''}</button></div>`}
    </div></div>`);
  if ($('#tontine')) $('#tontine').onclick = () => { G.takeTontine(S); G.save(S); sound.coin(); toast(`+${fmt(G.TONTINE.lend)} de la tontine.`, 'good'); morning(); };
  if ($('#aunt')) $('#aunt').onclick = () => { G.takeAunt(S); G.save(S); sound.coin(); toast(`+${fmt(G.AUNT_GIFT)} de tante Ama.`, 'good'); morning(); };
  if (ev.sunday) { $('#go-even').onclick = () => { dayLog = { sales: [], lost: 0, bought: 0, startMoney: S.money, closed: true }; evening(); }; return; }
  $$('[data-where]').forEach((b) => b.onclick = () => { sound.click(); S.where = b.dataset.where; G.save(S); morning(); });
  const qtys = {};
  let pay = 'cash';
  const setPay = (v) => { pay = v; $$('[data-pay]').forEach((b) => b.classList.toggle('on', b.dataset.pay === v)); };
  $$('[data-pay]').forEach((b) => b.onclick = () => { sound.click(); setPay(b.dataset.pay); for (const k in qtys) qtys[k] = 0; renderOffers(); });
  setPay('cash');
  const refreshMoney = () => { $('#m-money').textContent = fmt(S.money); if ($('#c-room')) $('#c-room').textContent = fmt(G.creditRoom(S)); };
  const maxOf = (o) => Math.min(o.stock, pay === 'credit' ? Math.floor(G.creditRoom(S) / (o.price * (1 + G.CREDIT_FEE))) : Math.floor(S.money / o.price), G.stockCap(S) - G.stockCount(S));
  const renderOffers = () => {
    if ($('#stockpill')) $('#stockpill').textContent = `Stock ${G.stockCount(S)} / ${G.stockCap(S)}`;
    $('#offers').innerHTML = S.offers.map((o, i) => {
      const p = G.pattern(S, o.id);
      const q = qtys[i] || 0;
      const total = pay === 'credit' ? round50(q * o.price * (1 + G.CREDIT_FEE)) : q * o.price;
      return `<div class="offer${o.taken ? ' taken' : ''}">
        <div class="swatch" style="${sw(p.spec)}"></div>
        <div><div class="nm">${esc(p.name)}${G.isNew(S, o.id) ? ' <span class="newtag">Nouveau</span>' : ''}</div><div class="meta">${tierTag(p.tier)} ${trendTag(G.trendOf(S, o.id))} <span>se vend ~${fmt(G.marketValue(S, o.id))}</span></div></div>
        <div class="buy">
          ${o.taken ? `<div class="price muted">Raflé par ${esc(RIVAL.name)}</div>` : `
          <div class="price">${fmt(o.price)} <span class="muted" style="font-weight:600">· ${o.stock} dispo</span></div>
          <div class="qty" style="justify-content:flex-end;margin-top:6px"><button data-i="${i}" data-d="-1" aria-label="Moins">−</button><b>${q}</b><button data-i="${i}" data-d="1" aria-label="Plus">+</button>
          <button class="btn small" data-buy="${i}" ${q ? '' : 'disabled'}>${pay === 'credit' ? 'À crédit' : 'Acheter'} ${q ? fmt(total) : ''}</button></div>`}
        </div>
      </div>`;
    }).join('');
    $$('#offers [data-d]').forEach((b) => b.onclick = () => {
      const i = +b.dataset.i, o = S.offers[i];
      qtys[i] = clamp((qtys[i] || 0) + +b.dataset.d, 0, Math.max(0, maxOf(o)));
      sound.click(); renderOffers();
    });
    $$('#offers [data-buy]').forEach((b) => b.onclick = () => {
      const i = +b.dataset.buy;
      if (G.buy(S, S.offers[i], qtys[i], pay === 'credit')) { sound.coin(); dayLog.bought += qtys[i]; qtys[i] = 0; G.save(S); refreshMoney(); renderOffers(); renderStock(); }
    });
  };
  let naming = null;
  const renderStock = () => {
    const ids = Object.keys(S.stock);
    const canName = G.canBaptize(S);
    $('#slots').textContent = `${S.shelf.length} / ${G.shelfSlots(S)} exposés`;
    $('#stocklist').innerHTML = ids.length ? ids.map((id) => {
      const p = G.pattern(S, id), st = S.stock[id];
      return `<div class="stockitem ${S.shelf.includes(id) ? 'on' : ''}" data-id="${id}">
        <div class="swatch sm" style="${sw(p.spec, 40)}"></div>
        <div><div class="nm">${esc(p.name)}${p.baptized ? ' <span class="newtag" title="Ancien nom : ' + esc(p.oldName) + '">Ton nom</span>' : ''}</div><small>${TIERS[p.tier].name} · ${st.q} pièce${st.q > 1 ? 's' : ''} · payé ${fmt(st.cost)} · ${trendTag(G.trendOf(S, id))}</small>
        <div class="row" style="gap:6px"><button class="dump" data-dump="${id}" title="Revendre une pièce au comptoir">Brader 1 pièce · +${fmt(round50(st.cost * 0.6))}</button>
        ${canName && id !== 'excl' && !p.baptized ? `<button class="dump" data-name="${id}">Baptiser ce motif</button>` : ''}</div>
        ${naming === id ? `<div class="naming"><small>Quel surnom lui donner ? Chance que le nom prenne : ${Math.round(G.baptismChance(S) * 100)} %</small>${G.baptismChoices(S, id).map((n) => `<button data-nm="${esc(n)}">« ${esc(n)} »</button>`).join('')}</div>` : ''}</div>
        <div class="check">${S.shelf.includes(id) ? '✓' : ''}</div></div>`;
    }).join('') : '<p class="muted">Ton stock est vide : achète au moins quelques pièces.</p>';
    $$('#stocklist [data-dump]').forEach((b) => b.onclick = (e) => {
      e.stopPropagation();
      const got = G.dump(S, b.dataset.dump, 1);
      if (got) { sound.coin(); toast(`Bradé au comptoir : +${fmt(got)}`); refreshMoney(); G.save(S); renderOffers(); renderStock(); }
    });
    $$('#stocklist [data-name]').forEach((b) => b.onclick = (e) => { e.stopPropagation(); sound.click(); naming = naming === b.dataset.name ? null : b.dataset.name; renderStock(); });
    $$('#stocklist [data-nm]').forEach((b) => b.onclick = (e) => {
      e.stopPropagation();
      const r = G.baptize(S, naming, b.dataset.nm);
      naming = null;
      if (r) {
        if (r.ok) { sound.deal(); toast(`« ${r.name} » : le nom prend ! Tout le marché le répète.`, 'gold', 4200); }
        else { sound.fail(); toast(`« ${r.name} » ne prend pas. Réessaie dans ${G.BAPTISM_EVERY} jours.`, 'bad', 3600); }
        G.save(S); renderOffers();
      }
      renderStock();
    });
    $$('#stocklist .stockitem').forEach((el) => el.onclick = () => {
      const id = el.dataset.id;
      if (S.shelf.includes(id)) S.shelf = S.shelf.filter((x) => x !== id);
      else if (S.shelf.length < G.shelfSlots(S)) S.shelf.push(id);
      else toast(`Ton étal ne montre que ${G.shelfSlots(S)} tissus à la fois.`);
      sound.click(); G.save(S); renderStock();
    });
  };
  renderOffers(); renderStock();
  $('#go-rest').onclick = () => {
    sound.click();
    const helpers = G.restHelpers(S);
    if (!$('#go-rest').dataset.sure) {
      // second appui pour confirmer, avec ce qui va se passer
      $('#go-rest').dataset.sure = '1';
      $('#go-rest span').textContent = helpers.length ? 'Confirmer le repos' : 'Fermer toute la journée ?';
      $('#go-rest').classList.add('sure');
      toast(helpers.length ? `Pendant ton repos : ${helpers.join(', ')} ${helpers.length > 1 ? 'vendront' : 'vendra'} ton stock. Tes revendeuses continuent leur route.` : 'Personne ne tiendra ton étal : pas de vente aujourd’hui, mais pas de taxe de place non plus.', '', 4200);
      return;
    }
    G.rest(S);
    dayLog = { sales: [], lost: 0, bought: dayLog.bought, startMoney: dayLog.startMoney, rested: true };
    music.play('evening');
    playCine('dusk', { kicker: 'Une journée de repos', title: `${esc(S.name)} se repose`, line: helpers.length ? `Pendant ce temps, ${helpers.join(', ')} ${helpers.length > 1 ? 'tiennent' : 'tient'} le marché.` : 'L’étal reste fermé. Demain, tu repars de plus belle.' }, SELF);
    evening();
  };
  $('#go-market').onclick = () => {
    S.shelf = S.shelf.filter((id) => S.stock[id]);
    if (!S.shelf.length) { toast('Expose au moins un tissu sur ton étal.', 'bad'); return; }
    openMarket();
  };
}

/* ------------------------------------------------------------ marché */
function openMarket() {
  hideScreen();
  $('#bar').hidden = false; $('#shelf').hidden = false;
  S.phase = 'market';
  market.s = S;
  market.open();
  saveToday();
  sound.ambience(true);
  music.play('market');
  updateBar(); updateShelf();
  toast('Touche une cliente qui attend devant ton étal pour la servir.', 'gold', 4200);
}
function updateBar() {
  if ($('#bar').hidden) return;
  const d = dateOf(S.day);
  $('#b-day').textContent = `Jour ${S.day + 1}`;
  $('#b-date').textContent = Object.keys(S.places).length > 1 ? `${d.label} · ${G.placeOf(S).short}` : d.label;
  const h = market.hour, hh = Math.floor(h), mm = Math.floor((h - hh) * 60 / 5) * 5;
  $('#b-hour').textContent = `${hh} h ${String(mm).padStart(2, '0')}`;
  $('#b-sun').style.width = `${clamp(market.time / DAY_SECONDS, 0, 1) * 100}%`;
  $('#b-money').textContent = fmt(S.money);
  $('#b-rep').textContent = `${repLabel(S.rep)} · ${Math.round(S.rep)}`;
}
function updateShelf() {
  $('#sh-items').innerHTML = S.shelf.filter((id) => S.stock[id]).map((id) => {
    const p = G.pattern(S, id);
    return `<div class="sh-item"><div class="swatch" style="${sw(p.spec, 30)}"></div>${esc(p.name)} · ${S.stock[id].q}</div>`;
  }).join('') || '<span class="muted" style="font-size:13px;padding:6px">Étal vide</span>';
}
$('#b-close').onclick = () => { sound.click(); endMarket(); };
// héler : un boniment, puis un temps de repos de la voix
const HAIL_CD = 9;
let hailReady = 0;
$('#b-hail').onclick = () => hail();
function hail() {
  const now = performance.now() / 1000;
  if (now < hailReady || !market.running || market.paused) return;
  const r = market.hail();
  if (!r) return;
  sound.speak(market.sellerSay?.text || 'Venez voir !', { base: 215, vol: 0.06, bright: 1.05 });
  if (r.why === 'plein') toast('Ton étal est déjà entouré : sers d’abord les clientes qui attendent.', '', 2800);
  else if (r.why === 'personne') toast('Personne ne passe assez près pour t’entendre.', '', 2400);
  hailReady = now + HAIL_CD;
  const b = $('#b-hail'); b.disabled = true; b.style.setProperty('--cd', '0');
  const t0 = now;
  const tick = () => { const k = (performance.now() / 1000 - t0) / HAIL_CD; if (k >= 1) { b.disabled = false; b.style.removeProperty('--cd'); return; } b.style.setProperty('--cd', k.toFixed(3)); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
$('#b-mute').onclick = () => { sound.init(); sound.setMuted(!sound.muted); $('#b-mute').classList.toggle('off', sound.muted); };
$('#b-mute').classList.toggle('off', sound.muted);

function endMarket() {
  if (!market.running) return;
  market.close();
  sound.ambience(false);
  closeModal();
  music.play('evening');
  const rev = dayLog.sales.reduce((a, b) => a + b.total, 0), n = dayLog.sales.length;
  playCine('dusk', { kicker: 'Le soir', title: 'Le soleil se couche sur Assigamé', line: n ? `Recette du jour : ${fmt(rev)} en ${n} vente${n > 1 ? 's' : ''}.` : 'Pas une seule vente aujourd’hui. Demain sera meilleur.' }, SELF);
  evening();
}

// une phrase pour ouvrir la journée
function dawnLine(ev) {
  if (S.day === 0) return 'Ta tante t’a laissé sa place au Grand marché. Aujourd’hui, la commerçante, c’est toi.';
  if (ev?.feast) return `${ev.feast.name}. ${ev.feast.text}`;
  if (ev?.sunday) return 'Dimanche : le marché est fermé, Lomé se repose.';
  if (ev && ev.id !== 'calme' && ev.title) return `${ev.title}. ${ev.text || ''}`.trim();
  if (S.money >= BENZ_PRICE * 0.6) return 'La Benz n’est plus très loin. Au marché, on commence à parler de toi.';
  return pick(Math.random, [
    'Les pirogues rentrent de la pêche, Lomé se réveille.',
    'L’harmattan voile le soleil. Sur la route du port, les vendeuses pressent le pas.',
    'Le comptoir ouvre tôt : les plus belles pièces partent vite.',
    'Encore une journée pour se rapprocher de la Benz.',
  ]);
}

/* ------------------------------------------------------------ marchandage */
const modal = $('#modal');
function closeModal() { modal.hidden = true; modal.innerHTML = ''; haggle = null; }

function openHaggle(c) {
  if (haggle || !c.item || !S.stock[c.item]) return;
  sound.init(); sound.click();
  market.paused = true;
  c.state = 'haggle';
  const rng = mulberry32((S.seed + S.day * 31 + c.id * 977) >>> 0);
  haggle = { h: G.startHaggle(S, c, c.item, rng), rng, c, talkT: 1, argOpen: false, busy: false, typing: false };
  const h0 = haggle.h;
  haggle.shown = h0.log.length; haggle.typeLast = true;
  haggle.scene = new HaggleScene({
    c, p: h0.p, qty: h0.qty, self: SELF,
    others: S.shelf.filter((id) => id !== c.item && S.stock[id]).map((id) => G.pattern(S, id).spec),
    roof: S.upgrades.boutique ? 'boutique' : S.upgrades.parasol ? 'parasol' : 'tole',
    onEvent: (e) => { if (e === 'note') sound.paper(); else if (e === 'cash') sound.coin(); else if (e === 'rub') sound.rustle(); },
  });
  setTimeout(() => { if (haggle && haggle.h === h0) haggle.scene.speak(sound.speak(h0.log[0].text, voiceOf(c)) || 1.4); }, 350);
  const st = S.stock[c.item];
  haggle.price = round50(c.item === 'excl' && G.exclusiveOf(S).price ? G.exclusiveOf(S).price : Math.max(haggle.h.V * 1.35, st.cost * 1.3));
  haggle.min = round50(st.cost * 0.6);
  haggle.max = round50(Math.max(haggle.h.V * 2.1, st.cost * 2.6, haggle.price));
  // trois arguments proposés, dont celui qui la touche
  const keys = Object.keys(ARGUMENTS).filter((k) => k !== c.P.args);
  haggle.args = shuffle(rng, [c.P.args, ...shuffle(rng, keys).slice(0, 2)]);
  // une formulation différente à chaque marchandage
  haggle.argText = Object.fromEntries(haggle.args.map((k) => [k, pick(rng, ARGUMENTS[k].lines)]));
  modal.hidden = false;
  renderHaggle();
  portraitLoop();
}

function renderHaggle() {
  const { h, c } = haggle;
  const p = h.p, st = S.stock[h.id] || { cost: h.result?.cost || 0 };
  const cost = st.cost;
  const margin = haggle.price - cost;
  const dots = Array.from({ length: Math.max(h.patience, 0) + (h.round ? 0 : 0) }, () => '<i class="on"></i>').join('');
  modal.innerHTML = `
    <div class="card haggle">
      <div class="hg-side"><canvas id="hg-face"></canvas>
        <div class="hg-who"><b>${esc(c.label)}</b>${c.regular ? `<small class="regular">Cliente fidèle · ${c.regular.visits} visite${c.regular.visits > 1 ? 's' : ''}</small>` : ''}<small>Veut ${h.qty} pièce${h.qty > 1 ? 's' : ''}${c.P.uniform ? ' du même motif' : ''}</small>
        <div class="muted" style="font-size:12px;margin-top:6px">Patience</div><div class="meter">${dots || '<span class="muted" style="font-size:12px">à bout</span>'}</div></div>
      </div>
      <div class="hg-main">
        <div class="hg-item"><div class="swatch" style="${sw(p.spec, 56)}"></div>
          <div><div class="nm">${esc(p.name)}</div><div class="meta">${tierTag(p.tier)} ${trendTag(G.trendOf(S, h.id))} <span>tu l’as payé ${fmt(cost)}</span></div></div></div>
        <div class="chat" id="chat">${h.log.slice(0, haggle.shown).map((m) => `<div class="msg ${m.who}">${esc(m.text)}</div>`).join('')}${haggle.typing ? '<div class="msg her typing" aria-label="Réflexion en cours"><i></i><i></i><i></i></div>' : ''}</div>
        ${h.done && !haggle.busy ? resultHTML() : `
        <div class="offerline"><span class="muted">${c.P.man ? 'Il' : 'Elle'} propose</span><b>${fmt(h.offer)}${h.qty > 1 ? ' <small class="muted" style="font:700 13px var(--sans)">la pièce</small>' : ''}</b></div>
        <div class="myprice">
          <div class="val"><span class="muted">Ton prix${h.qty > 1 ? ' (la pièce)' : ''}</span><b id="hg-p">${fmt(haggle.price)}</b></div>
          <input type="range" id="hg-r" min="${haggle.min}" max="${haggle.max}" step="50" value="${haggle.price}" aria-label="Ton prix">
          <div class="spread"><span class="margin ${margin >= 0 ? 'pos' : 'neg'}" id="hg-m">${margin >= 0 ? 'Bénéfice' : 'Perte'} : ${fmt(Math.abs(margin) * h.qty)}</span>
          <div class="steps" style="flex:0 0 auto;gap:4px"><button data-s="-500">−500</button><button data-s="-100">−100</button><button data-s="100">+100</button><button data-s="500">+500</button></div></div>
        </div>
        ${haggle.argOpen ? `<div class="args">${haggle.args.map((k) => `<button data-arg="${k}">« ${esc(haggle.argText[k])} »</button>`).join('')}</div>` : ''}
        <div class="hg-acts${haggle.busy ? ' busy' : ''}">
          <button class="btn wide" id="hg-prop">Proposer ${fmt(haggle.price)}</button>
          <button class="btn green" id="hg-acc">Accepter ${fmt(h.offer)}</button>
          <button class="btn ghost" id="hg-arg" ${h.usedArg ? 'disabled' : ''}>Argumenter</button>
          <button class="btn ghost" id="hg-gift" ${h.usedGift || S.money < G.GIFT_COST ? 'disabled' : ''}>Offrir un foulard (${fmt(G.GIFT_COST)})</button>
          <button class="btn ghost" id="hg-go">Laisser partir</button>
        </div>`}
      </div>
    </div>`;
  const chat = $('#chat'); chat.scrollTop = chat.scrollHeight;
  if (haggle.typeLast) {
    haggle.typeLast = false;
    const el = [...chat.querySelectorAll('.msg.her:not(.typing)')].pop();
    if (el) {
      const full = el.textContent; el.textContent = ''; let i = 0;
      const tick = () => { if (!el.isConnected) return; i += 2; el.textContent = full.slice(0, i); chat.scrollTop = chat.scrollHeight; if (i < full.length) setTimeout(tick, 24); };
      tick();
    }
  }
  if (h.done && !haggle.busy) { $('#hg-back').onclick = finishHaggle; return; }
  if (h.done) return;
  const setPrice = (v) => {
    haggle.price = clamp(round50(v), haggle.min, haggle.max);
    const m = haggle.price - cost;
    $('#hg-p').textContent = fmt(haggle.price);
    $('#hg-r').value = haggle.price;
    $('#hg-m').textContent = `${m >= 0 ? 'Bénéfice' : 'Perte'} : ${fmt(Math.abs(m) * h.qty)}`;
    $('#hg-m').className = `margin ${m >= 0 ? 'pos' : 'neg'}`;
    $('#hg-prop').textContent = `Proposer ${fmt(haggle.price)}`;
  };
  haggle.setPrice = (v) => { sound.click(); setPrice(v); };
  $('#hg-r').oninput = (e) => setPrice(+e.target.value);
  $$('.steps button').forEach((b) => b.onclick = () => { sound.click(); setPrice(haggle.price + +b.dataset.s); });
  const mine = h.log.filter((m) => m.who === 'me').map((m) => m.text);
  $('#hg-prop').onclick = () => act(() => G.propose(S, h, haggle.price, haggle.rng), G.playerLine('propose', fmt(haggle.price), Math.random, mine), 'propose', fmt(haggle.price));
  $('#hg-acc').onclick = () => act(() => G.acceptOffer(S, h, haggle.rng), G.playerLine('accept'), 'propose', 'D’accord');
  $('#hg-go').onclick = () => act(() => G.letGo(S, h, haggle.rng), G.playerLine('letgo'), 'shrug');
  $('#hg-arg').onclick = () => { if (haggle.busy) return; sound.click(); haggle.argOpen = !haggle.argOpen; renderHaggle(); };
  $('#hg-gift').onclick = () => act(() => G.giveGift(S, h, haggle.rng), null, 'gift');
  $$('[data-arg]').forEach((b) => b.onclick = () => { haggle.argOpen = false; act(() => G.useArgument(S, h, b.dataset.arg, haggle.rng, haggle.argText[b.dataset.arg]), null, 'present', null, b.dataset.arg); });
}

// voix de la cliente selon son profil
function voiceOf(c) {
  const T = haggle?.scene?.T;
  const base = c.P.man ? 125 : c.kind === 'fidele' ? 185 : c.kind === 'etudiante' ? 245 : c.kind === 'touriste' ? 230 : 210;
  return { base: base * (0.95 + ((c.look.seed % 100) / 100) * 0.12), vol: 0.055, bright: T?.tourist ? 1.15 : 1 };
}
const MY_VOICE = { base: 200, vol: 0.035, bright: 0.9 };

// le joueur agit : geste immédiat, puis la cliente réfléchit un instant avant de répondre
function act(fn, myLine, kind, chip, arg) {
  if (!haggle || haggle.busy) return;
  const h = haggle.h, sc = haggle.scene;
  const before = { offer: h.offer, mood: h.mood, n: h.log.length, cue: h.cue };
  if (myLine) h.log.push({ who: 'me', text: myLine });
  fn();
  let i = before.n; while (i < h.log.length && h.log[i].who === 'me') i++;
  haggle.shown = i;
  sound.click();
  const said = h.log.slice(before.n, i).map((m) => m.text).join(' ');
  sound.speak(said, MY_VOICE);
  if (kind) sc.play(kind);
  if (chip) sc.chip(chip, 'me', 0.2);
  haggle.busy = true; haggle.typing = true;
  market.spend(4);
  renderHaggle();
  const wait = 650 + Math.min(900, said.length * 14) + Math.random() * 350;
  setTimeout(() => reveal(before, arg), wait);
}

function reveal(before, arg) {
  if (!haggle) return;
  const h = haggle.h, sc = haggle.scene, c = haggle.c;
  const lines = h.log.slice(haggle.shown).filter((m) => m.who === 'her').map((m) => m.text).join(' ');
  haggle.shown = h.log.length; haggle.typing = false; haggle.typeLast = !!lines;
  if (lines) sc.speak(Math.max(sound.speak(lines, voiceOf(c)), lines.length * 0.035));
  if (h.done) {
    const r = h.result;
    sc.setMood(r.sold ? 0.95 : 0.08);
    if (r.sold) {
      sc.play('deal', { notes: clamp(Math.ceil(r.total / 4000), 1, 6) });
      setTimeout(() => sound.deal(), 1500);
      dayLog.sales.push({ who: c.label, name: h.p.name, qty: h.qty, total: r.total, margin: r.margin });
      saveToday();
    } else {
      if (r.insulted) sc.play('recoil'); else sc.play('shake');
      sc.play('leave', {}, 1);
      sound.fail();
    }
  } else {
    sc.setMood(h.mood);
    // ses gestes trahissent son prix : elle recule, elle replie le tissu, elle le caresse, elle cherche son porte-monnaie
    const CUE_ANIM = { far: 'recoil', above: 'shake', close: 'touch', yes: 'nod' };
    if (h.cue && h.cue !== before.cue && CUE_ANIM[h.cue.kind]) { sc.play(CUE_ANIM[h.cue.kind]); if (h.offer !== before.offer) sc.chip(fmt(h.offer), 'her', 0.6); }
    else if (h.mood > before.mood + 0.04) { sc.play('nod'); if (arg === 'qualite' || h.usedGift) sc.play('touch', {}, 0.5); }
    else if (h.offer !== before.offer) { sc.play('counter'); sc.chip(fmt(h.offer), 'her', 0.3); }
    else sc.play('shake');
  }
  haggle.busy = false;
  renderHaggle();
  updateBar();
}

function resultHTML() {
  const h = haggle.h, r = h.result;
  if (r.sold) {
    return `<div class="result"><div class="kicker">Vendu</div><b class="${r.margin >= 0 ? 'pos' : 'neg'}">${fmt(r.total)}</b>
      <div class="muted">${h.qty} pièce${h.qty > 1 ? 's' : ''} à ${fmt(r.price)} · ${r.margin >= 0 ? 'bénéfice' : 'perte'} ${fmt(Math.abs(r.margin))}${r.repDelta > 0 ? ` · réputation +${r.repDelta}` : r.repDelta < 0 ? ` · réputation ${String(r.repDelta).replace('-', '−')} (on dira que tu es chère)` : ''}</div>
      ${r.newClient ? `<div class="pill" style="margin-top:8px;background:#e3f1e8">${esc(r.newClient)} reviendra chez toi : une nouvelle cliente fidèle</div>` : ''}</div>
      <button class="btn gold" id="hg-back" style="width:100%">Retour à l’étal</button>`;
  }
  return `<div class="result"><div class="kicker" style="color:var(--red)">Pas de vente</div><b class="neg">${h.c.P.man ? (r.insulted ? 'Il est vexé' : 'Il est parti') : (r.insulted ? 'Elle est vexée' : 'Elle est partie')}</b>
    <div class="muted">Réputation −${r.insulted ? 2 : 1}. Trop cher, on part ; trop bas, on y perd.</div>
    ${r.lostClient ? `<div class="pill" style="margin-top:8px;background:#f8dcd8">${esc(r.lostClient)} ne reviendra plus, et elle le dira au marché</div>` : ''}</div>
    <button class="btn" id="hg-back" style="width:100%">Retour à l’étal</button>`;
}

function finishHaggle() {
  const { h, c } = haggle;
  market.finish(c, h.result.sold, h.result.sold ? h.result.total : 0);
  closeModal();
  market.paused = false;
  S.shelf = S.shelf.filter((id) => S.stock[id]);
  updateBar(); updateShelf();
  if (!S.shelf.length) toast('Ton étal est vide ! Ferme le stand pour aller racheter demain.', 'bad', 3800);
}

function portraitLoop() {
  const loop = (t) => {
    if (!haggle) return;
    requestAnimationFrame(loop);
    const cv = $('#hg-face');
    if (!cv) return;
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    haggle.scene.draw(g, r.width, r.height);
  };
  requestAnimationFrame(loop);
}

/* ------------------------------------------------------------ soir */
let eveTab = 'bilan';
function evening(resume) {
  $('#bar').hidden = true; $('#shelf').hidden = true;
  if (!resume) {
    const entry = G.endDay(S, { revenue: dayLog.sales.reduce((a, b) => a + b.total, 0), sales: dayLog.sales.length, lost: dayLog.lost });
    S.lastEntry = { ...entry, list: dayLog.sales, startMoney: dayLog.startMoney, closed: !!dayLog.closed };
    S.today = null;
    eveTab = 'bilan';
    for (const a of entry.ambitions || []) toast(`Ambition atteinte : ${a}`, 'gold', 4200);
  }
  G.save(S);
  if (G.defiOver(S)) { defiEnd(); return; }
  if (S.mode !== 'defi' && !S.won && S.day >= G.SEASON_DAY && !S.flags.seasonDone) { seasonEnd(); return; }
  renderEvening();
}

function renderEvening() {
  const e = S.lastEntry || { list: [], rent: 0, startMoney: S.money };
  const date = dateOf(S.day);
  const delta = S.money - e.startMoney;
  const mgr = e.managers || [];
  const profit = e.list.reduce((a, x) => a + (x.margin || 0), 0) + mgr.reduce((a, m) => a + m.margin, 0) - (e.rent || 0);
  const car = G.nextCar(S);
  const tabs = [['bilan', 'Bilan du jour'], ['reseau', 'Revendeuses'], ['achats', 'Améliorations'], ['marches', 'Marchés'], ['garage', S.won ? 'Le garage' : 'La Benz']];
  const lastDefi = S.mode === 'defi' && S.day >= G.DEFI_DAYS - 1;
  show(`
    <div class="veil"><div class="wrap">
      <div class="spread">
        <div><div class="kicker">Le soir · ${esc(date.label)}${S.mode === 'defi' ? ` · défi, jour ${S.day + 1} sur ${G.DEFI_DAYS}` : ''}</div><h2>${e.rested ? 'Pendant que tu te reposais' : e.closed ? 'Une journée de repos' : !e.list.length && !mgr.some((m) => m.sold) ? 'Une journée sans vente' : profit > 15000 ? 'Une très bonne journée' : profit >= 0 ? 'Une bonne journée' : 'Une journée difficile'}</h2></div>
        <div style="text-align:right"><div class="money">${fmt(S.money)}</div><div class="muted" style="font-size:12.5px">${repLabel(S.rep)} · réputation ${Math.round(S.rep)}</div></div>
      </div>
      <div class="tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${eveTab === k ? 'on' : ''}">${l}${k === 'garage' && car && S.money >= car.price ? ' ●' : ''}</button>`).join('')}</div>
      <div id="eve"></div>
      <div class="sticky-go"><button class="btn gold" id="sleep">${lastDefi ? 'Voir mon score' : `Dormir · jour ${S.day + 2}`}</button></div>
    </div></div>`);
  $$('[data-tab]').forEach((b) => b.onclick = () => { eveTab = b.dataset.tab; sound.click(); renderEvening(); });
  $('#sleep').onclick = () => { sound.click(); if (lastDefi) { defiEnd(); return; } G.nextDay(S); morning(); };
  const box = $('#eve');
  if (eveTab === 'bilan') {
    const rows = e.list.map((x) => `<div class="l"><span>${esc(x.who)}${x.name ? ` · ${esc(x.name)}` : ''} · ${x.qty} pièce${x.qty > 1 ? 's' : ''}</span><span class="pos">+${fmt(x.total)}</span></div>`).join('');
    const mrows = mgr.map((m) => `<div class="l"><span>${m.who === 'Afi' ? 'Afi' : 'Ta gérante'} à ${esc(m.place)} · ${m.sold} pièce${m.sold > 1 ? 's' : ''} (${m.who === 'Afi' ? 'taxe de place' : 'place et salaire'} ${fmt(m.cost)})</span><span class="${m.total - m.cost >= 0 ? 'pos' : 'neg'}">${m.total - m.cost >= 0 ? '+' : '−'}${fmt(Math.abs(m.total - m.cost))}</span></div>`).join('');
    const recap = e.rested ? (() => {
      const n = mgr.reduce((a, m) => a + m.sold, 0), tot = mgr.reduce((a, m) => a + m.total, 0);
      const back = (S.lastReturns || []).length;
      return `<div class="news" style="margin-bottom:14px"><div class="ico">🌙</div><div><div class="kicker">Récapitulatif</div><b>${n ? `${n} pièce${n > 1 ? 's' : ''} vendue${n > 1 ? 's' : ''} sans toi : +${fmt(tot)}` : 'Personne n’a vendu aujourd’hui'}</b>
        <p>${mgr.length ? mgr.map((m) => `${m.who === 'Afi' ? 'Afi' : 'Ta gérante'} à ${esc(m.place)} : ${m.sold} pièce${m.sold > 1 ? 's' : ''}, ${fmt(m.total)}`).join(' · ') : 'Ton étal est resté fermé.'}${S.agents.length ? ` · ${S.agents.length} revendeuse${S.agents.length > 1 ? 's' : ''} encore en route` : ''}${back ? ` · ${back} revendeuse${back > 1 ? 's sont rentrées' : ' est rentrée'} ce matin` : ''}. Ta caisse : ${fmt(S.money)}.</p></div></div>`;
    })() : '';
    box.innerHTML = `${recap}<div class="grid2" style="margin-top:0">
      <div class="card waxed"><div class="in ledger">
        ${rows || `<p class="muted">${e.rested ? 'Tu t’es reposée : pas de vente de ta main aujourd’hui.' : 'Aucune vente à ton étal aujourd’hui.'}</p>`}
        ${mrows}
        ${e.rent ? `<div class="l"><span>Taxe de place au marché</span><span class="neg">−${fmt(e.rent)}</span></div>` : ''}
        ${e.arrears ? `<div class="l"><span>Taxe impayée, à régler demain soir</span><span class="neg">${fmt(e.arrears)}</span></div>` : ''}
        ${e.creditPaid ? `<div class="l"><span>Remboursement du crédit du comptoir</span><span class="neg">−${fmt(e.creditPaid)}</span></div>` : ''}
        ${e.creditLate ? `<div class="l"><span><b class="neg">Crédit en retard : le comptoir ne te fait plus crédit (réputation −3)</b></span><span></span></div>` : ''}
        ${e.repaid ? `<div class="l"><span>Remboursement de la tontine</span><span class="neg">−${fmt(e.repaid)}</span></div>` : ''}
        <div class="l tot"><span>Caisse ce soir</span><span>${fmt(S.money)}</span></div>
        <div class="l"><span>Bénéfice sur les ventes (taxes déduites)</span><span class="${profit >= 0 ? 'pos' : 'neg'}">${profit >= 0 ? '+' : '−'}${fmt(Math.abs(profit))}</span></div>
        <div class="l"><span>Évolution de la caisse (achats de stock compris)</span><span class="${delta >= 0 ? 'pos' : 'neg'}">${delta >= 0 ? '+' : '−'}${fmt(Math.abs(delta))}</span></div>
        ${e.lost ? `<div class="l"><span>Clientes reparties sans acheter</span><span>${e.lost}</span></div>` : ''}
        ${S.clients.length ? `<div class="l"><span>Clientes fidèles</span><span>${S.clients.length}</span></div>` : ''}
      </div></div>
      <div class="card"><div class="in">
        <h3>Ton stock</h3>
        <div class="stocklist">${Object.keys(S.stock).map((id) => { const p = G.pattern(S, id); const st = S.stock[id]; return `<div class="stockitem" style="cursor:default"><div class="swatch sm" style="${sw(p.spec, 40)}"></div><div><div class="nm">${esc(p.name)}</div><small>${st.q} pièce${st.q > 1 ? 's' : ''} · ${trendTag(G.trendOf(S, id))}</small></div><div></div></div>`; }).join('') || '<p class="muted">Plus rien en stock.</p>'}</div>
      </div></div></div>`;
  } else if (eveTab === 'reseau') renderAgents(box);
  else if (eveTab === 'achats') renderShop(box);
  else if (eveTab === 'marches') renderMarkets(box);
  else renderGarage(box);
}

function renderAgents(box) {
  const ids = Object.keys(S.stock);
  box.innerHTML = `<div class="card waxed"><div class="in">
    <p class="muted" style="margin-top:0">Confie des pièces à une revendeuse : elle les vend dans sa ville et te rapporte l’argent quelques jours plus tard. Plus tu demandes cher, plus elle tarde… et plus le risque grandit. Tu peux aussi la <b>motiver</b> : un petit billet, et elle rentre un jour plus tôt.</p>
    ${G.agentsAvailable(S).map((a) => {
      const idx = S.agents.findIndex((x) => x.agentId === a.id), busy = S.agents[idx];
      const hurry = busy && G.canHurry(S, busy);
      return `<div class="agent"><div><b>${esc(a.name)}</b> <span class="muted">· ${esc(a.town)} · jusqu’à ${a.cap} pièces · ${a.days} jours</span>
        <div class="muted" style="font-size:12.5px">Sérieux : ${'★'.repeat(Math.round(a.reliability * 5))}${'☆'.repeat(5 - Math.round(a.reliability * 5))}</div>
        ${busy ? `<div class="pill" style="margin-top:6px">En route · doit rapporter ${fmt(busy.amount)} ${busy.due === S.day + 1 ? 'demain matin' : `le jour ${busy.due + 1}`}${busy.hurried ? ` · motivée ${busy.hurried} fois` : ''}</div>` : ''}</div>
        <div>${busy ? (hurry ? `<button class="btn small gold" data-hurry="${idx}" ${S.money >= G.hurryCost(busy) ? '' : 'disabled'}>Motiver · ${fmt(G.hurryCost(busy))}</button>` : '') : `<button class="btn small" data-agent="${a.id}" ${ids.length ? '' : 'disabled'}>Lui confier</button>`}</div></div>`;
    }).join('')}
    <div id="entrust"></div>
  </div></div>`;
  $$('[data-agent]').forEach((b) => b.onclick = () => entrustForm(AGENTS.find((a) => a.id === b.dataset.agent)));
  $$('[data-hurry]').forEach((b) => b.onclick = () => {
    const a = S.agents[+b.dataset.hurry], ag = AGENTS.find((x) => x.id === a.agentId);
    if (G.hurryAgent(S, +b.dataset.hurry)) { sound.coin(); toast(`${ag.name} a reçu ton billet : elle se dépêche de rentrer de ${ag.town}.`, 'good'); G.save(S); renderEvening(); }
  });
}

function entrustForm(agent) {
  const ids = Object.keys(S.stock);
  let pid = ids[0], q = 1, margin = 'juste';
  const render = () => {
    const st = S.stock[pid], m = MARGINS.find((x) => x.id === margin);
    q = clamp(q, 1, Math.min(agent.cap, st.q));
    $('#entrust').innerHTML = `<div class="card" style="margin-top:12px;box-shadow:none"><div class="in">
      <h3>Pour ${esc(agent.name)}, à ${esc(agent.town)}</h3>
      <div class="stocklist">${ids.map((id) => { const p = G.pattern(S, id); return `<div class="stockitem ${id === pid ? 'on' : ''}" data-p="${id}"><div class="swatch sm" style="${sw(p.spec, 40)}"></div><div><div class="nm">${esc(p.name)}</div><small>${S.stock[id].q} en stock · payé ${fmt(S.stock[id].cost)}</small></div><div class="check">${id === pid ? '✓' : ''}</div></div>`; }).join('')}</div>
      <div class="spread" style="margin-top:12px"><span>Quantité</span><div class="qty"><button data-q="-1">−</button><b>${q}</b><button data-q="1">+</button></div></div>
      <div class="tabs" style="margin:10px 0">${MARGINS.map((x) => `<button data-m="${x.id}" class="${x.id === margin ? 'on' : ''}">${x.label}</button>`).join('')}</div>
      <div class="spread"><span class="muted">Elle te rapportera</span><b class="money">${fmt(round50(st.cost * q * m.mul))}</b></div>
      <button class="btn gold" id="ent-ok" style="margin-top:12px;width:100%">Confier ${q} pièce${q > 1 ? 's' : ''}</button>
    </div></div>`;
    $$('#entrust [data-p]').forEach((el) => el.onclick = () => { pid = el.dataset.p; render(); });
    $$('#entrust [data-q]').forEach((el) => el.onclick = () => { q += +el.dataset.q; render(); });
    $$('#entrust [data-m]').forEach((el) => el.onclick = () => { margin = el.dataset.m; render(); });
    $('#ent-ok').onclick = () => {
      if (G.entrust(S, agent, [{ id: pid, q }], margin)) { sound.coin(); toast(`${agent.name} part pour ${agent.town} avec ${q} pièce${q > 1 ? 's' : ''}.`, 'good'); G.save(S); renderEvening(); }
    };
  };
  render();
}

function renderShop(box) {
  box.innerHTML = `${S.upgrades.exclusif ? '<div id="excl-ed"></div>' : ''}<div class="shop">${UPGRADES.map((u) => {
    const owned = S.upgrades[u.id];
    const lock = u.need && ((u.need.rep && S.rep < u.need.rep) || (u.need.upg && !S.upgrades[u.need.upg]));
    return `<div class="card waxed"><div class="in"><h3>${esc(u.name)}</h3><p>${esc(u.desc)}</p>
      ${owned ? '<div class="owned">✓ Acquis</div>' : lock ? `<div class="muted" style="font-size:12.5px">Il faut ${u.need.rep ? `une réputation de ${u.need.rep}` : ''}${u.need.upg ? ' et la boutique' : ''}.</div>`
      : `<button class="btn small ${S.money >= u.price ? 'gold' : ''}" data-up="${u.id}" ${S.money >= u.price ? '' : 'disabled'}>Acheter · ${fmt(u.price)}</button>`}
    </div></div>`;
  }).join('')}</div>`;
  $$('[data-up]').forEach((b) => b.onclick = () => {
    if (!G.buyUpgrade(S, b.dataset.up)) return;
    sound.deal(); G.save(S);
    toast(b.dataset.up === 'exclusif' ? 'Le comptoir attend ton dessin : choisis ton motif, tes couleurs et ton prix.' : 'C’est à toi !', 'gold', 4200);
    renderEvening();
    if (b.dataset.up === 'exclusif') $('#excl-ed')?.scrollIntoView({ behavior: 'smooth' });
  });
  if (S.upgrades.exclusif) exclusiveEditor($('#excl-ed'));
}

// atelier du pagne exclusif : motif, couleurs, nom, prix de vente
function exclusiveEditor(box) {
  const e = G.exclusiveOf(S);
  const draft = { ...e, price: e.price || round50(G.marketValue(S, 'excl') * 1.1) };
  const specOf = (motif, pal) => ({ motif, bg: PALETTES[pal][0], fg: PALETTES[pal][1], ac: PALETTES[pal][2], seed: 77 });
  const render = () => {
    const value = G.marketValue(S, 'excl');
    const appeal = clamp((value * 1.15) / draft.price, 0.35, 1.3);
    const verdict = appeal >= 1.1 ? 'Prix doux : les dames vont s’arrêter nombreuses.' : appeal >= 0.9 ? 'Prix juste : ton pagne attire bien.' : appeal >= 0.6 ? 'Prix fort : moins de clientes, mais de belles ventes.' : 'Trop cher : peu de dames oseront demander.';
    box.innerHTML = `<div class="card waxed excl"><div class="in">
      <div class="spread"><h3>Ton pagne exclusif</h3><span class="pill">Toi seule le vends · il ne se démode jamais</span></div>
      <div class="excl-grid">
        <div class="excl-prev" style="${sw(specOf(draft.motif, draft.pal), 120)}"></div>
        <div>
          <label class="lbl" for="ex-name">Son nom au marché</label>
          <input id="ex-name" class="field" maxlength="32" value="${esc(draft.name)}">
          <div class="lbl">Le motif</div>
          <div class="motifs">${Object.keys(MOTIF_NAMES).map((m) => `<button data-motif="${m}" class="${m === draft.motif ? 'on' : ''}" title="${esc(MOTIF_NAMES[m])}"><i style="${sw(specOf(m, draft.pal), 44)}"></i><small>${esc(MOTIF_NAMES[m])}</small></button>`).join('')}</div>
          <div class="lbl">Les couleurs</div>
          <div class="pals">${PALETTES.map((p, i) => `<button data-pal="${i}" class="${i === draft.pal ? 'on' : ''}" aria-label="Couleurs ${i + 1}">${p.map((c) => `<i style="background:${c}"></i>`).join('')}</button>`).join('')}</div>
          <div class="lbl">Ton prix de vente (la pièce)</div>
          <div class="spread"><b class="money" id="ex-p">${fmt(draft.price)}</b><span class="muted" style="font-size:13px">Les dames l’estiment à ~${fmt(value)} · le comptoir te le vend ~${fmt(TIERS.super.buy * 1.15)}</span></div>
          <input type="range" id="ex-r" min="10000" max="70000" step="500" value="${draft.price}" aria-label="Prix de vente">
          <p class="muted" id="ex-v" style="margin:6px 0 0;font-size:13px">${verdict} Au marchandage, tu commenceras à ce prix.</p>
          <button class="btn gold" id="ex-ok" style="margin-top:12px">Envoyer le dessin au comptoir</button>
        </div>
      </div></div></div>`;
    $$('[data-motif]', box).forEach((b) => b.onclick = () => { sound.click(); draft.name = $('#ex-name').value; draft.motif = b.dataset.motif; render(); });
    $$('[data-pal]', box).forEach((b) => b.onclick = () => { sound.click(); draft.name = $('#ex-name').value; draft.pal = +b.dataset.pal; render(); });
    $('#ex-r').oninput = (ev) => { draft.price = +ev.target.value; draft.name = $('#ex-name').value; $('#ex-p').textContent = fmt(draft.price); const a = clamp((value * 1.15) / draft.price, 0.35, 1.3); $('#ex-v').textContent = `${a >= 1.1 ? 'Prix doux : les dames vont s’arrêter nombreuses.' : a >= 0.9 ? 'Prix juste : ton pagne attire bien.' : a >= 0.6 ? 'Prix fort : moins de clientes, mais de belles ventes.' : 'Trop cher : peu de dames oseront demander.'} Au marchandage, tu commenceras à ce prix.`; };
    $('#ex-ok').onclick = () => {
      draft.name = $('#ex-name').value;
      G.setExclusive(S, draft); G.save(S); sound.deal();
      toast(`« ${G.exclusiveOf(S).name} » sera au comptoir demain matin, à ton nom.`, 'gold', 4200);
      render();
    };
  };
  render();
}

// les places dans les autres marchés de Lomé et d'ailleurs
function renderMarkets(box) {
  box.innerHTML = `<p class="muted" style="margin:0 0 12px">Achète une place dans un autre marché. Chaque matin, tu choisis où tu vends ; ailleurs, une gérante tient ta place et vend quelques pièces de ton stock (${fmt(MANAGER_WAGE)} de salaire les jours où elle vend, plus la taxe de place). Chaque marché a sa clientèle.</p>
  <div class="shop">${MARKETS.map((m) => {
    const owned = S.places[m.id];
    const lock = m.need && S.rep < m.need.rep;
    return `<div class="card waxed"><div class="in"><h3>${esc(m.name)}</h3><p>${esc(m.desc)}</p>
      ${owned ? `<div class="owned">✓ ${S.where === m.id ? 'Tu y vends en ce moment' : m.id === 'assigame' ? 'Ta place de départ' : 'Ta gérante y tient la place'}</div>`
      : lock ? `<div class="muted" style="font-size:12.5px">Il faut une réputation de ${m.need.rep} pour qu’on t’y vende une place.</div>`
      : `<button class="btn small ${S.money >= m.price ? 'gold' : ''}" data-place="${m.id}" ${S.money >= m.price ? '' : 'disabled'}>Acheter la place · ${fmt(m.price)}</button>`}
    </div></div>`;
  }).join('')}</div>`;
  $$('[data-place]').forEach((b) => b.onclick = () => {
    if (G.buyPlace(S, b.dataset.place)) { sound.deal(); toast('Une nouvelle place est à toi. Choisis-la demain matin au comptoir.', 'gold', 3600); G.save(S); renderEvening(); }
  });
}

function renderGarage(box) {
  const car = G.nextCar(S);
  const pct = car ? clamp(S.money / car.price, 0, 1) : 1;
  const rival = S.rival.benzDay != null ? `${RIVAL.name} a eu sa Benz le ${esc(dateOf(S.rival.benzDay).label)}.` : `${RIVAL.name}, ta rivale, a déjà ${fmt(S.rival.money)} de côté pour sa Benz.`;
  box.innerHTML = `<div class="card waxed benz"><div class="in goal">
    <h3>${car ? (S.won ? `Prochaine voiture : ${esc(car.name)}` : 'La Mercedes-Benz des grandes dames') : 'Le garage est complet'}</h3>
    <p class="muted" style="margin:0">${car ? esc(car.desc) : 'Tu as toutes les voitures. Lomé n’a jamais vu une commerçante comme toi.'}${!S.won ? ' Dans les années 1970, le commerce du wax pesait plus lourd que les phosphates du Togo.' : ''}</p>
    ${car ? `<canvas id="car-cv" style="aspect-ratio:16/7"></canvas>
    <div class="spread"><span>${fmt(S.money)} sur ${fmt(car.price)}</span><b>${Math.floor(pct * 100)} %</b></div>
    <div class="bar"><i style="width:${pct * 100}%"></i></div>
    <button class="btn ${pct >= 1 ? 'gold' : ''}" id="buy-car" ${pct >= 1 ? '' : 'disabled'}>Acheter la ${esc(car.name)}</button>` : ''}
    ${S.mode !== 'defi' ? `<p class="muted" style="margin:0;font-size:13px">${rival}</p>` : ''}
  </div></div>
  <div class="garage">${CARS.map((c) => `<div class="card ${S.cars.includes(c.id) ? '' : 'locked'}"><canvas data-car="${c.id}"></canvas><div class="in"><b>${esc(c.name)}</b><small class="muted">${S.cars.includes(c.id) ? `✓ Achetée le ${esc(dateOf(S.flags['car_' + c.id] ?? S.day).label)}` : fmt(c.price)}</small></div></div>`).join('')}</div>
  ${S.won ? `<div class="card waxed" style="margin-top:14px"><div class="in"><h3>Tes ambitions</h3>
    <ul class="amb">${AMBITIONS.map((a) => `<li class="${S.flags.amb[a.id] != null ? 'ok' : ''}">${S.flags.amb[a.id] != null ? '✓' : '○'} ${esc(a.label)}</li>`).join('')}</ul></div></div>` : ''}`;
  if (car) drawCarCard($('#car-cv'), car, true);
  $$('[data-car]').forEach((cv) => { const c = CARS.find((x) => x.id === cv.dataset.car); drawCarCard(cv, c, S.cars.includes(c.id)); });
  if (car) $('#buy-car').onclick = async () => {
    const bought = G.buyCar(S);
    if (!bought) return;
    G.save(S);
    music.play('evening');
    const first = bought.id === 'benz200';
    await playCarReveal(bought, sound, first
      ? { kicker: esc(dateOf(S.day).label), title: `${esc(S.name)}, voici ta Benz`, line: 'Toute la rue est sortie la voir. Les dames d’Assigamé murmurent ton nom.' }
      : { kicker: 'Une nouvelle voiture au garage', title: esc(bought.name), line: esc(bought.desc) });
    if (first) ending(); else renderEvening();
  };
}

/* ------------------------------------------------------------ fin */
function ending() {
  sound.fanfare(); music.play('evening');
  $('#bar').hidden = true; $('#shelf').hidden = true;
  const rank = rankOf(S.day + 1);
  const beat = S.rival.benzDay == null ? `Tu as eu ta Benz avant ${RIVAL.name}.` : `${RIVAL.name} t’a devancée, mais c’est de toi qu’on parle.`;
  show(`<div class="veil"><div class="wrap ending">
    <div class="kicker">${esc(dateOf(S.day).label)}</div>
    <h2>${esc(S.name)}, ${esc(rank.title)}</h2>
    <p class="lead" style="margin:10px auto 0">La Benz est garée devant le Grand marché. ${esc(rank.text)} ${esc(beat)}</p>
    <div class="card benz" style="margin-top:18px"><canvas id="end-cv" style="aspect-ratio:16/7"></canvas></div>
    <div class="card waxed" style="margin-top:14px"><div class="in ledger">
      <div class="l"><span>Jours au marché</span><b>${S.day + 1}</b></div>
      <div class="l"><span>Titre</span><b>${esc(rank.title)}</b></div>
      <div class="l"><span>Pièces vendues</span><b>${S.stats.sold}</b></div>
      <div class="l"><span>Chiffre d’affaires</span><b>${fmt(S.stats.revenue)}</b></div>
      <div class="l"><span>Plus belle vente</span><b>${fmt(S.stats.bestSale)}</b></div>
      <div class="l"><span>Clientes fidèles</span><b>${S.clients.length}</b></div>
      <div class="l"><span>Réputation</span><b>${repLabel(S.rep)} · ${Math.round(S.rep)}</b></div>
    </div></div>
    <p class="muted" style="margin-top:14px">La suite : d’autres marchés, d’autres voitures (jusqu’à la 600 Pullman à ${fmt(CARS[CARS.length - 1].price)}), et tes ambitions de grande dame.</p>
    <div class="row" style="justify-content:center;margin-top:18px"><button class="btn gold" id="end-cont">Continuer à commercer</button><button class="btn ghost" id="end-title">Écran titre</button></div>
  </div></div>`);
  drawCarCard($('#end-cv'), CARS[0], true);
  $('#end-cont').onclick = () => { eveTab = 'garage'; renderEvening(); };
  $('#end-title').onclick = title;
}

// le 27 avril 1975 sans la Benz : la saison se termine, mais on peut continuer
function seasonEnd() {
  S.flags.seasonDone = S.day; G.save(S);
  const f = G.fortune(S), rank = seasonRankOf(f);
  sound.fanfare();
  show(`<div class="veil"><div class="wrap ending">
    <div class="kicker">27 avril 1975 · fête de l’Indépendance</div>
    <h2>${esc(S.name)}, ${esc(rank.title)}</h2>
    <p class="lead" style="margin:10px auto 0">Les associations défilent en pagnes neufs. Tu n’as pas encore ta Benz, mais ${esc(rank.text.charAt(0).toLowerCase() + rank.text.slice(1))}</p>
    <div class="card waxed" style="margin-top:14px"><div class="in ledger">
      <div class="l"><span>Ta fortune (caisse, stock, moins les dettes)</span><b>${fmt(f)}</b></div>
      <div class="l"><span>Pièces vendues</span><b>${S.stats.sold}</b></div>
      <div class="l"><span>Réputation</span><b>${repLabel(S.rep)} · ${Math.round(S.rep)}</b></div>
    </div></div>
    <div class="row" style="justify-content:center;margin-top:18px"><button class="btn gold" id="end-cont">Continuer jusqu’à la Benz</button><button class="btn ghost" id="end-title">Écran titre</button></div>
  </div></div>`);
  $('#end-cont').onclick = renderEvening;
  $('#end-title').onclick = title;
}

// fin du défi du jour : le score et le texte à partager
function defiEnd() {
  S.flags.defiDone = true; S.phase = 'evening'; G.save(S);
  const f = G.fortune(S);
  setBestDefi(S.defiDate, f);
  const dl = new Date(S.defiDate + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const text = `Nana Benz · défi du ${dl} : ${fmt(f)} en ${G.DEFI_DAYS} jours de marché, réputation ${Math.round(S.rep)}. À toi de faire mieux : https://omarfarouk228.github.io/nana-benz/`;
  sound.fanfare();
  show(`<div class="veil"><div class="wrap ending">
    <div class="kicker">Défi du ${esc(dl)}</div>
    <h2>${fmt(f)}</h2>
    <p class="lead" style="margin:10px auto 0">Ta fortune après une semaine au marché (caisse, stock au prix d’achat, revendeuses en route, moins les dettes). Ton record du jour : ${fmt(bestDefi(S.defiDate))}.</p>
    <div class="card waxed" style="margin-top:14px"><div class="in ledger">
      <div class="l"><span>Pièces vendues</span><b>${S.stats.sold}</b></div>
      <div class="l"><span>Plus belle vente</span><b>${fmt(S.stats.bestSale)}</b></div>
      <div class="l"><span>Réputation</span><b>${Math.round(S.rep)}</b></div>
    </div></div>
    <div class="row" style="justify-content:center;margin-top:18px"><button class="btn gold" id="d-share">Partager mon score</button><button class="btn ghost" id="d-again">Rejouer le défi</button><button class="btn ghost" id="end-title">Écran titre</button></div>
  </div></div>`);
  $('#d-share').onclick = async () => {
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast('Score copié : colle-le où tu veux.', 'good'); } } catch { /* partage annulé */ }
  };
  $('#d-again').onclick = () => { S = G.newGame(S.name, { mode: 'defi', seed: G.defiSeed(S.defiDate), defiDate: S.defiDate }); market.s = S; G.save(S); morning(); };
  $('#end-title').onclick = title;
}

/* ------------------------------------------------------------ clavier */
addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input, textarea')) return;
  if (document.getElementById('cine')) return;
  if (haggle && !modal.hidden) {
    if (haggle.h.done && !haggle.busy) { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); $('#hg-back')?.click(); } return; }
    const step = e.shiftKey ? 500 : 100;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); haggle.setPrice?.(haggle.price + step); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); haggle.setPrice?.(haggle.price - step); }
    else if (e.key === 'Enter') { e.preventDefault(); $('#hg-prop')?.click(); }
    else if (e.key === 'a' || e.key === 'A') $('#hg-acc')?.click();
    return;
  }
  if (market.running && !market.paused) {
    if (['1', '2', '3'].includes(e.key)) market.tapSpot(+e.key - 1);
    else if (e.key === 'h' || e.key === 'H') hail();
  }
});

/* ------------------------------------------------------------ démarrage */
addEventListener('pointerdown', () => { if (sound.ctx && sound.ctx.state !== 'running') sound.ctx.resume(); }, { passive: true });
document.fonts?.ready.then(() => { market.bg = null; setTimeout(() => $('#loading').classList.add('done'), 200); });
setTimeout(() => $('#loading').classList.add('done'), 2500);
title();

// jeu hors ligne (seulement dans la version publiée)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').then(() => navigator.serviceWorker.ready).then((reg) => {
    const urls = [location.href, ...performance.getEntriesByType('resource').map((e) => e.name)];
    reg.active?.postMessage({ cache: urls });
  }).catch(() => { /* pas de cache hors ligne */ });
}

// accès de débogage pour les tests
window.__nb = { get S() { return S; }, market, G };
