import * as G from './game.js';
import { Market, DAY_SECONDS, SELF } from './market.js';
import { HaggleScene } from './scene.js';
import { Music } from './music.js';
import { playCine } from './cine.js';
import { drawPortrait, drawFigure } from './people.js';
import { waxURL, waxPattern } from './wax.js';
import { TIERS, PERSONAS, ARGUMENTS, AGENTS, MARGINS, UPGRADES, BENZ_PRICE, CATALOG, dateOf } from './data.js';
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
  served: (c, sale) => { sound.coin(); toast(`Afi a vendu ${sale.qty} pièce${sale.qty > 1 ? 's' : ''} à ${fmt(sale.price)}`, 'good'); dayLog.sales.push({ who: 'Afi (ta petite sœur)', qty: sale.qty, total: sale.price * sale.qty, margin: sale.margin }); updateBar(); updateShelf(); },
  left: (c, why) => {
    dayLog.lost++;
    if (why === 'tired') toast(`${c.P.label} est partie, lassée d’attendre.`, 'bad');
    // indice pour apprendre à garnir son étal
    else if (why === 'nothing') toast(`${c.P.label} cherchait du ${c.tiers.map((t) => TIERS[t].name.toLowerCase()).join(' ou ')}, plutôt motif ${c.prefStyle}.`, '', 3200);
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
        </div>
        <details class="howto"><summary>Comment on joue ?</summary>
          <ol>
            <li><b>Le matin, au comptoir du port</b> : achète des pièces de wax. Fancy pour les petites bourses, anglais, hollandais, et les nouveautés « super wax ». Regarde ce qui est à la mode.</li>
            <li><b>Choisis ce que tu exposes</b> sur ton étal : les clientes ne voient que ça.</li>
            <li><b>Au marché</b>, touche une cliente pour la servir et <b>marchande</b> : annonce ton prix, écoute sa contre-offre, sors tes arguments, offre un foulard… Trop cher, elle part fâchée ; trop bas, tu perds de l’argent.</li>
            <li><b>Le soir</b>, confie des pièces à tes revendeuses (Aného, Kpalimé, Cotonou…), achète un parasol, un étal plus grand, une boutique.</li>
            <li><b>Objectif</b> : réunir ${fmt(BENZ_PRICE)} pour t’offrir la Benz et devenir une Nana Benz.</li>
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
  if (saved) $('#t-cont').onclick = () => { sound.init(); sound.click(); S = saved; S.name = cleanName($('#t-name').value) || S.name; market.s = S; if (S.phase === 'evening') { music.play('evening'); evening(true); } else morning(); };
}
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
  if (!resumed) playCine('dawn', { kicker: `Jour ${S.day + 1}`, title: esc(dateOf(S.day).label), line: dawnLine(ev) }, SELF);
  dayLog = { sales: [], lost: 0, bought: 0, startMoney: S.dayStartMoney ?? S.money };
  const evIcon = ev.feast ? '🎉' : { pluie: '🌧', bateau: '🚢', arrivage: '📦', rumeur: '👂', malheur: '🙊', mariage: '💍', paie: '💰', debut: '🌅' }[ev.id] || '☀';
  const ret = returns.map((r) => r.ok === true ? `<div class="pill" style="background:#e3f1e8">${esc(r.ag.name)} revient de ${esc(r.ag.town)} : +${fmt(r.amount)}</div>`
    : r.ok === 'partial' ? `<div class="pill" style="background:#fff1d6">${esc(r.ag.name)} n’a vendu qu’une partie : +${fmt(r.amount)}</div>`
    : `<div class="pill" style="background:#f8dcd8">${esc(r.ag.name)} n’est pas revenue de ${esc(r.ag.town)}…</div>`).join('');
  show(`
    <div class="veil"><div class="wrap">
      <div class="spread">
        <div><div class="kicker">Jour ${S.day + 1} · ${esc(date.label)}</div><h2>${ev.sunday ? 'Dimanche, jour du Seigneur' : 'Le comptoir du port'}</h2></div>
        <div style="text-align:right"><div class="money" id="m-money">${fmt(S.money)}</div><div class="muted" style="font-size:12.5px">${repLabel(S.rep)} · réputation ${Math.round(S.rep)}</div></div>
      </div>
      <div class="card waxed" style="margin-top:14px"><div class="in event">
        <div class="ico">${evIcon}</div>
        <div><h3>${esc(ev.feast ? ev.feast.name : ev.title || 'Journée ordinaire')}</h3><p class="lead" style="margin-top:4px;font-size:15px">${esc(ev.feast ? ev.feast.text : ev.text || 'Le marché vit son rythme habituel.')}${ev.saturday ? ' C’est samedi : le marché sera plein.' : ''}</p>
        ${ret ? `<div class="row" style="margin-top:8px">${ret}</div>` : ''}</div>
      </div></div>
      ${ev.sunday ? `
        <p class="lead">Le marché est fermé. Les dames vont à la messe… et regardent les pagnes des autres. Profite-en pour t’occuper de ton réseau.</p>
        <div class="sticky-go"><button class="btn gold" id="go-even">Passer la journée</button></div>` : `
      ${S.day === 0 ? `<div class="card" style="margin-top:14px"><div class="in">
        <h3>Les conseils de tante Ama</h3>
        <ul class="tips">
          <li>Commence petit : quelques pièces de <b>fancy</b> pour les étudiantes et les chorales, et de l’<b>anglais</b> pour les dames. Le hollandais rapporte plus, mais il coûte cher.</li>
          <li>Varie les motifs : chaque cliente préfère un style (symboles, nature, géométrique). Ce qui est <b>à la mode</b> part plus cher.</li>
          <li>Au marché, annonce un prix plus haut que ce que tu espères, puis descends doucement. Si tu demandes trop, elle s’en va fâchée et on en parle au marché.</li>
        </ul>
      </div></div>` : ''}
      ${G.needsTontine(S) ? `<div class="card" style="margin-top:14px;border:2px solid var(--gold)"><div class="in spread">
        <div><h3>La tontine du quartier</h3><p class="muted" style="margin:4px 0 0">Ta caisse est vide. Les femmes de ta tontine te prêtent ${fmt(G.TONTINE.lend)}, à rendre ${fmt(G.TONTINE.back)} dès que tes affaires reprennent.</p></div>
        <button class="btn gold" id="tontine">Accepter le prêt</button></div></div>` : S.debt ? `<p class="muted" style="margin:12px 0 0">Tu dois encore ${fmt(S.debt)} à la tontine : ce sera remboursé un soir où ta caisse le permet.</p>` : ''}
      <div class="grid2">
        <div class="card"><div class="in">
          <div class="spread"><h3>Arrivages du jour</h3><span class="pill" id="stockpill">Stock ${G.stockCount(S)} / ${G.stockCap(S)}</span></div>
          <div class="offers" id="offers"></div>
        </div></div>
        <div class="card"><div class="in">
          <div class="spread"><h3>Ton étal</h3><span class="pill" id="slots"></span></div>
          <p class="muted" style="margin:4px 0 0;font-size:13px">Touche un tissu pour l’exposer ou le retirer. Les clientes ne voient que ce qui est sur l’étal.</p>
          <div class="stocklist" id="stocklist"></div>
        </div></div>
      </div>
      <div class="sticky-go"><button class="btn gold" id="go-market">Ouvrir le stand</button></div>`}
    </div></div>`);
  if (ev.sunday) { $('#go-even').onclick = () => { dayLog = { sales: [], lost: 0, bought: 0, startMoney: S.money, closed: true }; evening(); }; return; }
  const qtys = {};
  const renderOffers = () => {
    if ($('#stockpill')) $('#stockpill').textContent = `Stock ${G.stockCount(S)} / ${G.stockCap(S)}`;
    $('#offers').innerHTML = S.offers.map((o, i) => {
      const p = G.pattern(S, o.id);
      const q = qtys[i] || 0;
      return `<div class="offer">
        <div class="swatch" style="${sw(p.spec)}"></div>
        <div><div class="nm">${esc(p.name)}</div><div class="meta">${tierTag(p.tier)} ${trendTag(G.trendOf(S, o.id))} <span>se vend ~${fmt(G.marketValue(S, o.id))}</span></div></div>
        <div class="buy">
          <div class="price">${fmt(o.price)} <span class="muted" style="font-weight:600">· ${o.stock} dispo</span></div>
          <div class="qty" style="justify-content:flex-end;margin-top:6px"><button data-i="${i}" data-d="-1" aria-label="Moins">−</button><b>${q}</b><button data-i="${i}" data-d="1" aria-label="Plus">+</button>
          <button class="btn small" data-buy="${i}" ${q ? '' : 'disabled'}>Acheter ${q ? fmt(q * o.price) : ''}</button></div>
        </div>
      </div>`;
    }).join('');
    $$('#offers [data-d]').forEach((b) => b.onclick = () => {
      const i = +b.dataset.i, o = S.offers[i];
      const max = Math.min(o.stock, Math.floor(S.money / o.price), G.stockCap(S) - G.stockCount(S));
      qtys[i] = clamp((qtys[i] || 0) + +b.dataset.d, 0, Math.max(0, max));
      sound.click(); renderOffers();
    });
    $$('#offers [data-buy]').forEach((b) => b.onclick = () => {
      const i = +b.dataset.buy;
      if (G.buy(S, S.offers[i], qtys[i])) { sound.coin(); dayLog.bought += qtys[i]; qtys[i] = 0; G.save(S); $('#m-money').textContent = fmt(S.money); renderOffers(); renderStock(); }
    });
  };
  const renderStock = () => {
    const ids = Object.keys(S.stock);
    $('#slots').textContent = `${S.shelf.length} / ${G.shelfSlots(S)} exposés`;
    $('#stocklist').innerHTML = ids.length ? ids.map((id) => {
      const p = G.pattern(S, id), st = S.stock[id];
      return `<div class="stockitem ${S.shelf.includes(id) ? 'on' : ''}" data-id="${id}">
        <div class="swatch sm" style="${sw(p.spec, 40)}"></div>
        <div><div class="nm">${esc(p.name)}</div><small>${TIERS[p.tier].name} · ${st.q} pièce${st.q > 1 ? 's' : ''} · payé ${fmt(st.cost)} · ${trendTag(G.trendOf(S, id))}</small>
        <button class="dump" data-dump="${id}" title="Revendre une pièce au comptoir">Brader 1 pièce · +${fmt(round50(st.cost * 0.6))}</button></div>
        <div class="check">${S.shelf.includes(id) ? '✓' : ''}</div></div>`;
    }).join('') : '<p class="muted">Ton stock est vide : achète au moins quelques pièces.</p>';
    $$('#stocklist [data-dump]').forEach((b) => b.onclick = (e) => {
      e.stopPropagation();
      const got = G.dump(S, b.dataset.dump, 1);
      if (got) { sound.coin(); toast(`Bradé au comptoir : +${fmt(got)}`); $('#m-money').textContent = fmt(S.money); G.save(S); renderOffers(); renderStock(); }
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
  if ($('#tontine')) $('#tontine').onclick = () => { G.takeTontine(S); G.save(S); sound.coin(); toast(`+${fmt(G.TONTINE.lend)} de la tontine.`, 'good'); morning(); };
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
  sound.ambience(true);
  music.play('market');
  updateBar(); updateShelf();
  toast('Touche une cliente qui attend devant ton étal pour la servir.', 'gold', 4200);
}
function updateBar() {
  if ($('#bar').hidden) return;
  const d = dateOf(S.day);
  $('#b-day').textContent = `Jour ${S.day + 1}`;
  $('#b-date').textContent = d.label;
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
  haggle.price = round50(Math.max(haggle.h.V * 1.35, st.cost * 1.3));
  haggle.min = round50(st.cost * 0.6);
  haggle.max = round50(Math.max(haggle.h.V * 2.1, st.cost * 2.6));
  // trois arguments proposés, dont celui qui la touche
  const keys = Object.keys(ARGUMENTS).filter((k) => k !== c.P.args);
  haggle.args = shuffle(rng, [c.P.args, ...shuffle(rng, keys).slice(0, 2)]);
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
        <div class="hg-who"><b>${esc(c.P.label)}</b><small>Veut ${h.qty} pièce${h.qty > 1 ? 's' : ''}${c.P.uniform ? ' du même motif' : ''}</small>
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
        ${haggle.argOpen ? `<div class="args">${haggle.args.map((k) => `<button data-arg="${k}">« ${esc(ARGUMENTS[k].line)} »</button>`).join('')}</div>` : ''}
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
  $('#hg-r').oninput = (e) => setPrice(+e.target.value);
  $$('.steps button').forEach((b) => b.onclick = () => { sound.click(); setPrice(haggle.price + +b.dataset.s); });
  $('#hg-prop').onclick = () => act(() => G.propose(S, h, haggle.price, haggle.rng), `Je te le fais à ${fmt(haggle.price)}.`, 'propose', fmt(haggle.price));
  $('#hg-acc').onclick = () => act(() => G.acceptOffer(S, h, haggle.rng), 'D’accord, c’est bon pour moi.', 'propose', 'D’accord');
  $('#hg-go').onclick = () => act(() => G.letGo(S, h, haggle.rng), 'Désolée, je ne peux pas descendre plus bas.', 'shrug');
  $('#hg-arg').onclick = () => { if (haggle.busy) return; sound.click(); haggle.argOpen = !haggle.argOpen; renderHaggle(); };
  $('#hg-gift').onclick = () => act(() => G.giveGift(S, h, haggle.rng), null, 'gift');
  $$('[data-arg]').forEach((b) => b.onclick = () => { haggle.argOpen = false; act(() => G.useArgument(S, h, b.dataset.arg, haggle.rng), null, 'present', null, b.dataset.arg); });
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
  const before = { offer: h.offer, mood: h.mood, n: h.log.length };
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
      dayLog.sales.push({ who: c.P.label, name: h.p.name, qty: h.qty, total: r.total, margin: r.margin });
    } else {
      if (r.insulted) sc.play('recoil'); else sc.play('shake');
      sc.play('leave', {}, 1);
      sound.fail();
    }
  } else {
    sc.setMood(h.mood);
    if (h.mood > before.mood + 0.04) { sc.play('nod'); if (arg === 'qualite' || h.usedGift) sc.play('touch', {}, 0.5); }
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
      <div class="muted">${h.qty} pièce${h.qty > 1 ? 's' : ''} à ${fmt(r.price)} · ${r.margin >= 0 ? 'bénéfice' : 'perte'} ${fmt(Math.abs(r.margin))}${r.repGain ? ` · réputation +${r.repGain}` : ''}</div></div>
      <button class="btn gold" id="hg-back" style="width:100%">Retour à l’étal</button>`;
  }
  return `<div class="result"><div class="kicker" style="color:var(--red)">Pas de vente</div><b class="neg">${h.c.P.man ? (r.insulted ? 'Il est vexé' : 'Il est parti') : (r.insulted ? 'Elle est vexée' : 'Elle est partie')}</b>
    <div class="muted">Réputation −${r.insulted ? 2 : 1}. Trop cher, on part ; trop bas, on y perd.</div></div>
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
    eveTab = 'bilan';
  }
  G.save(S);
  renderEvening();
}

function renderEvening() {
  const e = S.lastEntry || { list: [], rent: 0, startMoney: S.money };
  const date = dateOf(S.day);
  const delta = S.money - e.startMoney;
  const profit = e.list.reduce((a, x) => a + (x.margin || 0), 0) - (e.rent || 0);
  const tabs = [['bilan', 'Bilan du jour'], ['reseau', 'Revendeuses'], ['achats', 'Améliorations'], ['benz', 'La Benz']];
  show(`
    <div class="veil"><div class="wrap">
      <div class="spread">
        <div><div class="kicker">Le soir · ${esc(date.label)}</div><h2>${e.closed ? 'Une journée de repos' : !e.list.length ? 'Une journée sans vente' : profit > 15000 ? 'Une très bonne journée' : profit >= 0 ? 'Une bonne journée' : 'Une journée difficile'}</h2></div>
        <div style="text-align:right"><div class="money">${fmt(S.money)}</div><div class="muted" style="font-size:12.5px">${repLabel(S.rep)} · réputation ${Math.round(S.rep)}</div></div>
      </div>
      <div class="tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${eveTab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div id="eve"></div>
      <div class="sticky-go"><button class="btn gold" id="sleep">Dormir · jour ${S.day + 2}</button></div>
    </div></div>`);
  $$('[data-tab]').forEach((b) => b.onclick = () => { eveTab = b.dataset.tab; sound.click(); renderEvening(); });
  $('#sleep').onclick = () => { sound.click(); G.nextDay(S); morning(); };
  const box = $('#eve');
  if (eveTab === 'bilan') {
    const rows = e.list.map((x) => `<div class="l"><span>${esc(x.who)}${x.name ? ` · ${esc(x.name)}` : ''} · ${x.qty} pièce${x.qty > 1 ? 's' : ''}</span><span class="pos">+${fmt(x.total)}</span></div>`).join('');
    box.innerHTML = `<div class="grid2" style="margin-top:0">
      <div class="card waxed"><div class="in ledger">
        ${rows || '<p class="muted">Aucune vente aujourd’hui.</p>'}
        ${e.rent ? `<div class="l"><span>Taxe de place au marché</span><span class="neg">−${fmt(e.rent)}</span></div>` : ''}
        ${e.repaid ? `<div class="l"><span>Remboursement de la tontine</span><span class="neg">−${fmt(e.repaid)}</span></div>` : ''}
        <div class="l tot"><span>Caisse ce soir</span><span>${fmt(S.money)}</span></div>
        <div class="l"><span>Bénéfice sur les ventes (taxe déduite)</span><span class="${profit >= 0 ? 'pos' : 'neg'}">${profit >= 0 ? '+' : '−'}${fmt(Math.abs(profit))}</span></div>
        <div class="l"><span>Évolution de la caisse (achats de stock compris)</span><span class="${delta >= 0 ? 'pos' : 'neg'}">${delta >= 0 ? '+' : '−'}${fmt(Math.abs(delta))}</span></div>
        ${e.lost ? `<div class="l"><span>Clientes reparties sans acheter</span><span>${e.lost}</span></div>` : ''}
      </div></div>
      <div class="card"><div class="in">
        <h3>Ton stock</h3>
        <div class="stocklist">${Object.keys(S.stock).map((id) => { const p = G.pattern(S, id); const st = S.stock[id]; return `<div class="stockitem" style="cursor:default"><div class="swatch sm" style="${sw(p.spec, 40)}"></div><div><div class="nm">${esc(p.name)}</div><small>${st.q} pièce${st.q > 1 ? 's' : ''} · ${trendTag(G.trendOf(S, id))}</small></div><div></div></div>`; }).join('') || '<p class="muted">Plus rien en stock.</p>'}</div>
      </div></div></div>`;
  } else if (eveTab === 'reseau') renderAgents(box);
  else if (eveTab === 'achats') renderShop(box);
  else renderBenz(box);
}

function renderAgents(box) {
  const ids = Object.keys(S.stock);
  box.innerHTML = `<div class="card waxed"><div class="in">
    <p class="muted" style="margin-top:0">Confie des pièces à une revendeuse : elle les vend dans sa ville et te rapporte l’argent quelques jours plus tard. Plus tu demandes cher, plus elle tarde… et plus le risque grandit.</p>
    ${G.agentsAvailable(S).map((a) => {
      const busy = S.agents.find((x) => x.agentId === a.id);
      return `<div class="agent"><div><b>${esc(a.name)}</b> <span class="muted">· ${esc(a.town)} · jusqu’à ${a.cap} pièces · ${a.days} jours</span>
        <div class="muted" style="font-size:12.5px">Sérieux : ${'★'.repeat(Math.round(a.reliability * 5))}${'☆'.repeat(5 - Math.round(a.reliability * 5))}</div>
        ${busy ? `<div class="pill" style="margin-top:6px">En route · doit rapporter ${fmt(busy.amount)} le jour ${busy.due + 1}</div>` : ''}</div>
        <div>${busy ? '' : `<button class="btn small" data-agent="${a.id}" ${ids.length ? '' : 'disabled'}>Lui confier</button>`}</div></div>`;
    }).join('')}
    <div id="entrust"></div>
  </div></div>`;
  $$('[data-agent]').forEach((b) => b.onclick = () => entrustForm(AGENTS.find((a) => a.id === b.dataset.agent)));
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
  box.innerHTML = `<div class="shop">${UPGRADES.map((u) => {
    const owned = S.upgrades[u.id];
    const lock = u.need && ((u.need.rep && S.rep < u.need.rep) || (u.need.upg && !S.upgrades[u.need.upg]));
    return `<div class="card waxed"><div class="in"><h3>${esc(u.name)}</h3><p>${esc(u.desc)}</p>
      ${owned ? '<div class="owned">✓ Acquis</div>' : lock ? `<div class="muted" style="font-size:12.5px">Il faut ${u.need.rep ? `une réputation de ${u.need.rep}` : ''}${u.need.upg ? ' et la boutique' : ''}.</div>`
      : `<button class="btn small ${S.money >= u.price ? 'gold' : ''}" data-up="${u.id}" ${S.money >= u.price ? '' : 'disabled'}>Acheter · ${fmt(u.price)}</button>`}
    </div></div>`;
  }).join('')}</div>`;
  $$('[data-up]').forEach((b) => b.onclick = () => { if (G.buyUpgrade(S, b.dataset.up)) { sound.deal(); toast('C’est à toi !', 'gold'); G.save(S); renderEvening(); } });
}

function renderBenz(box) {
  const pct = clamp(S.money / BENZ_PRICE, 0, 1);
  box.innerHTML = `<div class="card waxed benz"><div class="in goal">
    <h3>La Mercedes-Benz des grandes dames</h3>
    <p class="muted" style="margin:0">Dans les années 1970, les plus grandes commerçantes de wax de Lomé roulaient en Mercedes : on les appelait les Nana Benz.</p>
    <canvas id="benz-cv" style="aspect-ratio:16/7"></canvas>
    <div class="spread"><span>${fmt(S.money)} sur ${fmt(BENZ_PRICE)}</span><b>${Math.floor(pct * 100)} %</b></div>
    <div class="bar"><i style="width:${pct * 100}%"></i></div>
    ${S.won ? '<div class="owned">✓ La Benz est garée devant ta boutique.</div>' : `<button class="btn ${pct >= 1 ? 'gold' : ''}" id="buy-benz" ${pct >= 1 ? '' : 'disabled'}>Acheter la Benz</button>`}
  </div></div>`;
  drawBenz($('#benz-cv'));
  if (!S.won) $('#buy-benz').onclick = () => { if (G.buyBenz(S)) { G.save(S); ending(); } };
}

// berline des années 1970, vue de profil
function drawBenz(cv, color = '#efe6d2') {
  const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = r.width, H = r.height, u = Math.min(W / 120, H / 52);
  const ox = W / 2 - 50 * u, oy = H * 0.72;
  g.fillStyle = waxPattern(g, { motif: 'cauris', bg: '#efe3c6', fg: '#e2d2ad', ac: '#e9dbb9', seed: 4 }, 120, 1); g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(0,0,0,.15)'; g.beginPath(); g.ellipse(W / 2, oy + 8 * u, 48 * u, 4 * u, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = color; g.strokeStyle = '#2a1a12'; g.lineWidth = Math.max(1.5, 0.45 * u); g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(ox + 4 * u, oy); g.lineTo(ox + 2 * u, oy - 9 * u); g.lineTo(ox + 18 * u, oy - 12 * u); g.lineTo(ox + 30 * u, oy - 22 * u);
  g.lineTo(ox + 62 * u, oy - 22 * u); g.lineTo(ox + 74 * u, oy - 12 * u); g.lineTo(ox + 96 * u, oy - 10 * u); g.lineTo(ox + 98 * u, oy); g.closePath();
  g.fill(); g.stroke();
  g.fillStyle = '#9fb7c9';
  g.beginPath(); g.moveTo(ox + 32 * u, oy - 20 * u); g.lineTo(ox + 45 * u, oy - 20 * u); g.lineTo(ox + 45 * u, oy - 13 * u); g.lineTo(ox + 23 * u, oy - 13 * u); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(ox + 48 * u, oy - 20 * u); g.lineTo(ox + 61 * u, oy - 20 * u); g.lineTo(ox + 70 * u, oy - 13 * u); g.lineTo(ox + 48 * u, oy - 13 * u); g.closePath(); g.fill();
  g.fillStyle = '#c9ced3'; g.fillRect(ox, oy - 3 * u, 8 * u, 2 * u); g.fillRect(ox + 92 * u, oy - 3 * u, 7 * u, 2 * u);
  g.fillStyle = '#c9ced3'; g.fillRect(ox + 2 * u, oy - 8 * u, 94 * u, 0.8 * u);
  // calandre, phares, poignées
  g.fillStyle = '#c9ced3'; g.fillRect(ox + 94 * u, oy - 9 * u, 3.5 * u, 6 * u);
  g.fillStyle = '#f6e7a8'; g.beginPath(); g.ellipse(ox + 95 * u, oy - 7.5 * u, 1.3 * u, 1.8 * u, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#c0392b'; g.fillRect(ox + 1.5 * u, oy - 8 * u, 2 * u, 3 * u);
  g.fillStyle = '#8a8f94'; g.fillRect(ox + 40 * u, oy - 11 * u, 4 * u, 0.9 * u); g.fillRect(ox + 60 * u, oy - 11 * u, 4 * u, 0.9 * u);
  g.strokeStyle = 'rgba(42,26,18,.35)'; g.lineWidth = 0.4 * u; g.beginPath(); g.moveTo(ox + 46.5 * u, oy - 20 * u); g.lineTo(ox + 46.5 * u, oy - 1 * u); g.stroke();
  for (const wx of [22, 78]) {
    g.fillStyle = '#1c1714'; g.beginPath(); g.arc(ox + wx * u, oy, 8 * u, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c9ced3'; g.beginPath(); g.arc(ox + wx * u, oy, 4.2 * u, 0, Math.PI * 2); g.fill();
  }
}

/* ------------------------------------------------------------ fin */
function ending() {
  sound.fanfare(); music.play('evening');
  $('#bar').hidden = true; $('#shelf').hidden = true;
  show(`<div class="veil"><div class="wrap ending">
    <div class="kicker">${esc(dateOf(S.day).label)}</div>
    <h2>${esc(S.name)}, tu es une Nana Benz</h2>
    <p class="lead" style="margin:10px auto 0">La Benz est garée devant le Grand marché. Les dames d’Assigamé murmurent ton nom, et ton motif se porte jusqu’à Cotonou.</p>
    <div class="card benz" style="margin-top:18px"><canvas id="end-cv"></canvas></div>
    <div class="card waxed" style="margin-top:14px"><div class="in ledger">
      <div class="l"><span>Jours au marché</span><b>${S.day + 1}</b></div>
      <div class="l"><span>Pièces vendues</span><b>${S.stats.sold}</b></div>
      <div class="l"><span>Chiffre d’affaires</span><b>${fmt(S.stats.revenue)}</b></div>
      <div class="l"><span>Plus belle vente</span><b>${fmt(S.stats.bestSale)}</b></div>
      <div class="l"><span>Réputation</span><b>${repLabel(S.rep)} · ${Math.round(S.rep)}</b></div>
    </div></div>
    <div class="row" style="justify-content:center;margin-top:18px"><button class="btn gold" id="end-cont">Continuer à commercer</button><button class="btn ghost" id="end-title">Écran titre</button></div>
  </div></div>`);
  drawBenz($('#end-cv'));
  $('#end-cont').onclick = () => { eveTab = 'bilan'; renderEvening(); };
  $('#end-title').onclick = title;
}

/* ------------------------------------------------------------ démarrage */
addEventListener('pointerdown', () => { if (sound.ctx && sound.ctx.state !== 'running') sound.ctx.resume(); }, { passive: true });
document.fonts?.ready.then(() => { market.bg = null; setTimeout(() => $('#loading').classList.add('done'), 200); });
setTimeout(() => $('#loading').classList.add('done'), 2500);
title();

// accès de débogage pour les tests
window.__nb = { get S() { return S; }, market, G };
