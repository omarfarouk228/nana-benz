// Scène du Grand marché (canvas 2D) : décor, foule de passage, stand, clientes qui arrivent et attendent.
import { drawFigure } from './people.js';
import { waxPattern } from './wax.js';
import { pattern, makeCustomer, chooseItem, crowdSize, sisterSale, dayRng } from './game.js';
import { TIERS, STYLE_ICONS } from './data.js';
import { mulberry32, clamp, rand, pick } from './util.js';

export const DAY_SECONDS = 160; // durée réelle d'une journée de marché (7 h → 18 h)
const OPEN_H = 7, CLOSE_H = 18;
const SPOTS = [-0.24, 0, 0.24]; // places devant le stand (fraction de la largeur)
export const SELF = { skin: 1, style: 0, seed: 424242, age: 1 };
export const SISTER = { skin: 2, style: 2, seed: 7777, age: 0 };

export class Market {
  constructor(canvas, s, cb) {
    this.cv = canvas;
    this.g = canvas.getContext('2d');
    this.s = s;
    this.cb = cb; // { tap(c), served(c, sale), left(c, why), tick(hour) }
    this.t = 0;
    this.time = 0; // secondes de marché écoulées
    this.running = false;
    this.paused = false;
    this.customers = [];
    this.passers = [];
    this.fx = []; // échanges visibles : tissu qui part, billets qui arrivent, montant qui s'envole
    this.bg = null;
    this.resize();
    addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', (e) => this.onTap(e));
  }

  resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const r = this.cv.getBoundingClientRect();
    this.W = Math.max(320, r.width); this.H = Math.max(400, r.height);
    this.cv.width = Math.round(this.W * dpr); this.cv.height = Math.round(this.H * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.dpr = dpr;
    this.bg = null;
    this.layout();
  }

  layout() {
    const { W, H } = this;
    const narrow = W < 700;
    // la file des clientes reste au-dessus de la barre du bas (plus haute en portrait)
    const bottomPad = narrow ? 128 : 78;
    this.lane = Math.min(H * 0.8, H - bottomPad);
    this.figH = clamp(Math.min(H * 0.27, (this.lane - 70) * 0.42), 70, 230);
    this.backLane = Math.min(H * 0.56, this.lane - this.figH * 0.75);
    this.stallW = Math.min(W * (narrow ? 0.92 : 0.6), 720);
    this.stallX = W / 2;
    this.spots = SPOTS.map((f) => this.stallX + f * this.stallW * (narrow ? 1.25 : 1.1));
  }

  get hour() { return OPEN_H + (CLOSE_H - OPEN_H) * clamp(this.time / DAY_SECONDS, 0, 1); }

  /* ------------------------------------------------------------ journée */
  open() {
    const s = this.s;
    this.rng = dayRng(s, 9);
    this.time = 0; this.running = true; this.paused = false;
    this.customers = [];
    const n = crowdSize(s);
    this.schedule = [];
    for (let k = 0; k < n; k++) this.schedule.push({ at: rand(this.rng, 0.02, 0.86) * DAY_SECONDS });
    if (s.event && s.event.vip) this.schedule.push({ at: DAY_SECONDS * 0.35, forced: s.event.vip });
    this.schedule.sort((a, b) => a.at - b.at);
    this.sisterT = 0;
    this.passers = [];
    for (let k = 0; k < 14; k++) this.passers.push(this.makePasser(true));
  }

  close() { this.running = false; }
  get free() { return SPOTS.map((_, i) => !this.customers.some((c) => c.spot === i && c.state !== 'leave')); }

  makePasser(spread) {
    const rng = Math.random;
    const dir = rng() < 0.5 ? 1 : -1;
    return {
      x: spread ? rng() * this.W : dir > 0 ? -40 : this.W + 40, dir, sp: 28 + rng() * 26, walk: rng() * 6,
      look: { skin: Math.floor(rng() * 5), style: Math.floor(rng() * 3), seed: Math.floor(rng() * 1e6) },
      man: rng() < 0.3, load: rng() < 0.3 ? pick(Math.random, ['#c9ced3', '#2f78a8', '#e0a526', '#c0392b']) : null,
      depth: rng(),
    };
  }

  spawn(forced) {
    const free = this.free.map((f, i) => (f ? i : -1)).filter((i) => i >= 0);
    if (!free.length) return false;
    const c = makeCustomer(this.s, this.rng, forced);
    c.spot = this.rng() < 0.5 ? free[0] : free[free.length - 1];
    c.dir = this.rng() < 0.5 ? 1 : -1;
    c.x = c.dir > 0 ? -60 : this.W + 60;
    c.state = 'arrive';
    c.wait = 0;
    c.maxWait = (22 + c.P.patience * 4) * (this.s.upgrades.parasol ? 1.25 : 1);
    c.walk = 0;
    c.item = null;
    this.customers.push(c);
    return true;
  }

  update(dt) {
    this.t += dt;
    // passants en arrière-plan (toujours animés)
    for (const p of this.passers) {
      p.x += p.dir * p.sp * dt; p.walk += dt * 6;
      if (p.x < -60 || p.x > this.W + 60) Object.assign(p, this.makePasser(false));
    }
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < f.d);
    if (!this.running || this.paused) return;
    this.time += dt;
    this.cb.tick?.(this.hour);
    while (this.schedule.length && this.schedule[0].at <= this.time) {
      const sch = this.schedule[0];
      if (this.spawn(sch.forced)) this.schedule.shift();
      else { sch.at += 3; this.schedule.sort((a, b) => a.at - b.at); break; }
    }
    const s = this.s;
    for (const c of this.customers) {
      c.walk += dt * 7;
      if (c.giving > 0) c.giving -= dt;
      if (c.state === 'arrive') {
        const tx = this.spots[c.spot];
        const d = tx - c.x;
        c.x += Math.sign(d) * Math.min(Math.abs(d), 120 * dt);
        if (Math.abs(d) < 2) {
          c.state = 'wait'; c.walk = 0;
          c.item = chooseItem(s, c);
          if (!c.item) { c.bubble = 'nothing'; c.state = 'leave'; c.dir = this.rng() < 0.5 ? 1 : -1; c.leaveDelay = 1.6; this.cb.left?.(c, 'nothing'); }
        }
      } else if (c.state === 'wait') {
        c.wait += dt;
        if (c.item && !s.stock[c.item]) c.item = chooseItem(s, c);
        if (!c.item || c.wait > c.maxWait) { c.state = 'leave'; c.bubble = 'tired'; c.leaveDelay = 1.2; c.dir = this.rng() < 0.5 ? 1 : -1; this.cb.left?.(c, c.item ? 'tired' : 'nothing'); }
      } else if (c.state === 'leave') {
        if (c.leaveDelay > 0) { c.leaveDelay -= dt; continue; }
        c.x += c.dir * 110 * dt;
      }
    }
    this.customers = this.customers.filter((c) => c.x > -90 && c.x < this.W + 90);
    // la petite sœur sert une cliente simple qui attend depuis un moment
    if (s.upgrades.soeur) {
      this.sisterT -= dt;
      if (this.sisterT <= 0) {
        const c = this.customers.find((c) => c.state === 'wait' && c.item && c.wait > 5 && !c.P.uniform && c.kind !== 'fiancee');
        if (c) {
          const spec = pattern(s, c.item).spec;
          const sale = sisterSale(s, c, c.item);
          c.state = 'leave'; c.bag = true; c.leaveDelay = 2; c.dir = this.rng() < 0.5 ? 1 : -1;
          this.exchange(c, spec, sale.price * sale.qty, this.stallX + this.stallW * 0.16);
          this.cb.served?.(c, sale);
          this.sisterT = 9;
        } else this.sisterT = 1.5;
      }
    }
    if (this.time >= DAY_SECONDS && !this.customers.some((c) => c.state === 'wait')) this.cb.closing?.();
  }

  // un marchandage fait avancer l'horloge
  spend(minutes) { this.time = Math.min(DAY_SECONDS, this.time + (minutes / 60) / (CLOSE_H - OPEN_H) * DAY_SECONDS); }

  onTap(e) {
    const r = this.cv.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    let best = null, bd = 1e9;
    for (const c of this.customers) {
      if (c.state !== 'wait' || !c.item) continue;
      const dx = Math.abs(x - c.x), dy = y - (this.lane - this.figH * 0.5);
      if (dx < this.figH * 0.3 && Math.abs(dy) < this.figH * 0.7 && dx < bd) { best = c; bd = dx; }
    }
    if (best) this.cb.tap?.(best);
  }

  finish(c, sold, total = 0) {
    c.state = 'leave'; c.bag = sold; c.leaveDelay = sold ? 1.9 : 0.8; c.dir = this.rng() < 0.5 ? 1 : -1;
    c.bubble = sold ? 'happy' : 'angry';
    if (sold && c.item) this.exchange(c, pattern(this.s, c.item).spec, total, this.stallX - (this.s.upgrades.soeur ? this.stallW * 0.12 : 0));
  }

  // la commerçante tend le tissu plié, la cliente donne les billets
  exchange(c, spec, total, sellerX) {
    const tableY = this.lane - this.figH * 0.62;
    c.carry = spec; c.giving = 1.6;
    this.fx.push({ kind: 'cloth', spec, x0: sellerX, y0: tableY - this.figH * 0.2, x1: c.x, y1: this.lane - this.figH * 0.5, t: 0, d: 0.7 });
    const notes = Math.min(5, Math.max(1, Math.round(total / 2500)));
    for (let k = 0; k < notes; k++) this.fx.push({ kind: 'note', x0: c.x, y0: this.lane - this.figH * 0.62, x1: sellerX, y1: tableY - this.figH * 0.35, t: -0.55 - k * 0.12, d: 0.6, k });
    if (total) this.fx.push({ kind: 'text', text: `+${total.toLocaleString('fr-FR')} F`, x0: sellerX, y0: tableY - this.figH * 0.9, t: -0.9, d: 1.6 });
  }

  /* ------------------------------------------------------------ dessin */
  drawBackground() {
    const { W, H } = this;
    const cv = document.createElement('canvas');
    cv.width = Math.round(W * this.dpr); cv.height = Math.round(H * this.dpr);
    const g = cv.getContext('2d');
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const rng = mulberry32(42);
    // bâtiment du Grand marché (arcades, étages)
    const by = H * 0.18, bh = H * 0.32;
    g.fillStyle = '#d9c7a1'; g.fillRect(0, by, W, bh);
    g.fillStyle = '#c9b48a'; g.fillRect(0, by, W, bh * 0.12);
    for (let fl = 0; fl < 2; fl++) {
      for (let x = 10; x < W; x += 46) {
        g.fillStyle = '#7d6a4a';
        const y = by + bh * (0.22 + fl * 0.38);
        g.beginPath(); g.moveTo(x, y + bh * 0.3); g.lineTo(x, y + bh * 0.08); g.arc(x + 14, y + bh * 0.08, 14, Math.PI, 0); g.lineTo(x + 28, y + bh * 0.3); g.fill();
        g.fillStyle = 'rgba(30,20,10,.35)'; g.fillRect(x, y + bh * 0.24, 28, bh * 0.06);
      }
    }
    g.fillStyle = '#2a1a12'; g.font = `700 ${Math.round(H * 0.026)}px Fraunces, Georgia, serif`; g.textAlign = 'center';
    g.fillText('GRAND MARCHÉ DE LOMÉ', W / 2, by + bh * 0.085);
    // rangée d'étals et de parasols au fond
    const sy = H * 0.5;
    g.fillStyle = '#8c6a46'; g.fillRect(0, sy, W, H * 0.06);
    for (let x = -20; x < W + 40; x += 70 + rng() * 40) {
      const col = pick(rng, ['#c0392b', '#1d2f6f', '#e0a526', '#1e6b4a', '#f08a24', '#5b2a86']);
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + 28, sy - H * 0.06, 3, H * 0.09);
      g.fillStyle = col; g.beginPath(); g.moveTo(x - 6, sy - H * 0.05); g.quadraticCurveTo(x + 30, sy - H * 0.12, x + 66, sy - H * 0.05); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(x + 30, sy - H * 0.095); g.lineTo(x + 66, sy - H * 0.05); g.lineTo(x + 46, sy - H * 0.05); g.closePath(); g.fill();
      // marchandises colorées
      for (let k = 0; k < 4; k++) { g.fillStyle = pick(rng, ['#f2c230', '#d0382b', '#2f78a8', '#f4efe4', '#7aa63a', '#c2185b']); g.fillRect(x + 4 + k * 14, sy + 2, 12, H * 0.025); }
    }
    // sol en latérite et pavés
    const gy = H * 0.56;
    const grd = g.createLinearGradient(0, gy, 0, H);
    grd.addColorStop(0, '#b77a4c'); grd.addColorStop(1, '#8e5634');
    g.fillStyle = grd; g.fillRect(0, gy, W, H - gy);
    g.fillStyle = 'rgba(255,255,255,.05)';
    for (let k = 0; k < 120; k++) g.fillRect(rng() * W, gy + rng() * (H - gy), 2 + rng() * 6, 1 + rng() * 2);
    this.bg = cv;
  }

  draw() {
    const g = this.g, { W, H } = this;
    if (!this.bg) this.drawBackground();
    // ciel selon l'heure
    const h = this.running ? this.hour : 9;
    const k = clamp((h - 7) / 11, 0, 1);
    const sky = g.createLinearGradient(0, 0, 0, H * 0.5);
    const warm = k > 0.75 ? (k - 0.75) * 4 : 0;
    sky.addColorStop(0, mix('#7db7e8', '#e89a5a', warm));
    sky.addColorStop(1, mix('#f7e6c4', '#f6c27a', warm));
    g.fillStyle = sky; g.fillRect(0, 0, W, H * 0.5);
    // soleil
    const sx = W * (0.1 + k * 0.8), syy = H * (0.2 - Math.sin(k * Math.PI) * 0.15);
    g.fillStyle = 'rgba(255,240,200,.85)'; g.beginPath(); g.arc(sx, syy, H * 0.035, 0, Math.PI * 2); g.fill();
    g.drawImage(this.bg, 0, 0, W, H);
    // passants (arrière-plan, plus petits et voilés)
    const ph = this.figH * 0.55;
    const back = [...this.passers].sort((a, b) => a.depth - b.depth);
    for (const p of back) drawFigure(g, p.x, this.backLane + p.depth * H * 0.04, ph * (0.9 + p.depth * 0.2), p.look, { walk: p.walk, dir: p.dir, man: p.man, load: p.load, alpha: 0.6 + p.depth * 0.3, t: this.t });
    this.drawStall();
    // clientes (premier plan)
    const order = [...this.customers].sort((a, b) => a.x - b.x);
    for (const c of order) {
      const still = c.state === 'wait' || c.state === 'haggle' || (c.state === 'leave' && c.leaveDelay > 0);
      // en attente, elle regarde l'étal (de dos) et montre de temps en temps le tissu qui lui plaît
      let point = 0;
      if (c.giving > 0) point = Math.min(1, c.giving * 2);
      else if (c.state === 'wait') { const ph2 = (c.wait * 0.55 + c.id * 1.7) % 6; point = ph2 < 1.4 ? Math.sin((ph2 / 1.4) * Math.PI) : 0; }
      else if (c.state === 'haggle') point = 0.5 + Math.sin(this.t * 3) * 0.2;
      drawFigure(g, c.x, this.lane, this.figH, c.look, { walk: still ? 0 : c.walk, dir: c.dir, view: still ? 'back' : 'side', point, man: c.P.man, carry: c.bag ? c.carry : null, t: this.t });
      this.drawBubble(c);
    }
    this.drawFx();
    // lumière de fin de journée
    if (warm > 0) { g.fillStyle = `rgba(232,120,40,${warm * 0.18})`; g.fillRect(0, 0, W, H); }
  }

  drawStall() {
    const g = this.g, s = this.s;
    const w = this.stallW, x0 = this.stallX - w / 2;
    const top = this.lane - this.figH * 0.62, tableH = this.figH * 0.42;
    const boutique = s.upgrades.boutique;
    // toit : parasol, auvent de tôle, ou boutique
    if (boutique) {
      g.fillStyle = '#efe4cc'; g.fillRect(x0 - 10, top - this.figH * 1.05, w + 20, this.figH * 1.05);
      g.fillStyle = '#1d2f6f'; g.fillRect(x0 - 16, top - this.figH * 1.12, w + 32, this.figH * 0.2);
      g.fillStyle = '#f2c230'; g.font = `700 ${Math.round(this.figH * 0.11)}px Fraunces, Georgia, serif`; g.textAlign = 'center';
      g.fillText(`Chez ${s.name} · Wax hollandais`, this.stallX, top - this.figH * 0.98);
    } else if (s.upgrades.parasol) {
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(this.stallX - 3, top - this.figH * 1.1, 6, this.figH * 1.1);
      g.fillStyle = waxPattern(g, { motif: 'zigzag', bg: '#c0392b', fg: '#f2c230', ac: '#1d2f6f', seed: 3 }, 120, 0.6);
      g.beginPath(); g.moveTo(x0 - 20, top - this.figH * 0.92); g.quadraticCurveTo(this.stallX, top - this.figH * 1.4, x0 + w + 20, top - this.figH * 0.92); g.closePath(); g.fill();
    } else {
      g.fillStyle = '#8a8f94'; g.beginPath(); g.moveTo(x0 - 14, top - this.figH * 0.85); g.lineTo(x0 + w + 14, top - this.figH * 0.92); g.lineTo(x0 + w + 14, top - this.figH * 0.8); g.lineTo(x0 - 14, top - this.figH * 0.74); g.fill();
      g.fillStyle = 'rgba(255,255,255,.12)'; for (let x = x0 - 10; x < x0 + w + 10; x += 12) g.fillRect(x, top - this.figH * (0.86 + (x - x0) / w * 0.07), 4, this.figH * 0.1);
      for (const px of [x0 + 6, x0 + w - 10]) { g.fillStyle = '#5a4030'; g.fillRect(px, top - this.figH * 0.8, 5, this.figH * 0.9); }
    }
    // la commerçante derrière l'étal (et sa petite sœur)
    drawFigure(g, this.stallX + (s.upgrades.soeur ? -w * 0.12 : 0), top + this.figH * 0.32, this.figH * 0.88, SELF, { view: 'front', t: this.t });
    if (s.upgrades.soeur) drawFigure(g, this.stallX + w * 0.16, top + this.figH * 0.32, this.figH * 0.78, SISTER, { view: 'front', t: this.t + 2 });
    // table
    g.fillStyle = '#6b4a2e'; g.fillRect(x0, top, w, tableH);
    g.fillStyle = '#7d583a'; g.fillRect(x0, top, w, tableH * 0.18);
    g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(x0, top + tableH - 4, w, 4);
    // piles de pièces de tissu exposées
    const slots = s.shelf.length ? s.shelf : [];
    const n = Math.max(4, slots.length);
    const bw = (w - 20) / n;
    slots.forEach((id, i) => {
      const st = s.stock[id];
      if (!st) return;
      const p = pattern(s, id);
      const bx = x0 + 10 + i * bw + bw * 0.08, bwi = bw * 0.84;
      const layers = Math.min(6, Math.max(1, Math.ceil(st.q / 2)));
      const lh = tableH * 0.12;
      for (let l = 0; l < layers; l++) {
        const ly = top - (l + 1) * lh + 2;
        g.fillStyle = waxPattern(g, p.spec, 120, 0.42);
        g.fillRect(bx, ly, bwi, lh - 1);
        g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(bx, ly + lh - 3, bwi, 2);
      }
      // étiquette : quantité et qualité
      g.fillStyle = TIERS[p.tier].color; g.fillRect(bx, top + tableH * 0.3, bwi, tableH * 0.32);
      g.fillStyle = '#fff'; g.font = `700 ${Math.round(tableH * 0.2)}px Manrope, system-ui, sans-serif`; g.textAlign = 'center';
      g.fillText(`${st.q}`, bx + bwi / 2, top + tableH * 0.53);
    });
  }

  drawFx() {
    const g = this.g, fh = this.figH;
    for (const f of this.fx) {
      if (f.t < 0) continue;
      const k = Math.min(1, f.t / f.d), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      if (f.kind === 'text') {
        g.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
        g.fillStyle = '#1e6b4a'; g.strokeStyle = '#fffaf0'; g.lineWidth = 4; g.textAlign = 'center';
        g.font = `900 ${Math.round(fh * 0.13)}px Fraunces, Georgia, serif`;
        const y = f.y0 - e * fh * 0.3;
        g.strokeText(f.text, f.x0, y); g.fillText(f.text, f.x0, y);
        g.globalAlpha = 1;
        continue;
      }
      const x = f.x0 + (f.x1 - f.x0) * e, y = f.y0 + (f.y1 - f.y0) * e - Math.sin(k * Math.PI) * fh * 0.22;
      g.save(); g.translate(x, y);
      if (f.kind === 'cloth') {
        const w = fh * 0.16, h = fh * 0.07;
        g.rotate(Math.sin(k * Math.PI) * 0.2);
        g.fillStyle = waxPattern(g, f.spec, 120, 0.3); g.fillRect(-w / 2, -h / 2, w, h);
        g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(-w / 2, h * 0.2, w, h * 0.3);
      } else {
        const w = fh * 0.1, h = fh * 0.05;
        g.rotate(-0.4 + k * 0.8 + f.k * 0.15);
        g.fillStyle = ['#b3804a', '#6f8a52', '#9b5a3a'][f.k % 3]; g.fillRect(-w / 2, -h / 2, w, h);
        g.strokeStyle = 'rgba(255,250,230,.6)'; g.lineWidth = 1; g.strokeRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4);
      }
      g.restore();
    }
  }

  drawBubble(c) {
    const g = this.g;
    const x = c.x, y = this.lane - this.figH * 1.08;
    const r = this.figH * 0.13;
    let icon = null, col = '#fffaf0';
    if (c.state === 'wait' && c.item) {
      const p = pattern(this.s, c.item);
      // pastille du tissu voulu + anneau de patience
      g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.save(); g.beginPath(); g.arc(x, y, r * 0.72, 0, Math.PI * 2); g.clip();
      g.fillStyle = waxPattern(g, p.spec, 120, 0.3); g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
      const left = 1 - c.wait / c.maxWait;
      g.strokeStyle = left > 0.5 ? '#1e6b4a' : left > 0.25 ? '#e0a526' : '#c0392b'; g.lineWidth = r * 0.16;
      g.beginPath(); g.arc(x, y, r * 0.9, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2); g.stroke();
      if (c.qty > 1) { g.fillStyle = '#2a1a12'; g.font = `800 ${Math.round(r * 0.6)}px Manrope, sans-serif`; g.textAlign = 'center'; g.fillText(`×${c.qty}`, x + r * 1.05, y - r * 0.7); }
      // tapez pour servir
      g.fillStyle = 'rgba(42,26,18,.75)'; g.font = `700 ${Math.round(r * 0.42)}px Manrope, sans-serif`; g.fillText('Servir', x, y + r * 1.55);
      return;
    }
    if (c.bubble === 'happy') icon = '♥';
    else if (c.bubble === 'angry') icon = '✗';
    else if (c.bubble === 'nothing') icon = '?';
    else if (c.bubble === 'tired') icon = '…';
    if (icon && (c.leaveDelay > 0 || c.state !== 'leave')) {
      g.fillStyle = col; g.beginPath(); g.arc(x, y, r * 0.75, 0, Math.PI * 2); g.fill();
      g.fillStyle = icon === '♥' ? '#c0392b' : '#2a1a12'; g.font = `800 ${Math.round(r * 0.9)}px Manrope, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(icon, x, y + 1); g.textBaseline = 'alphabetic';
    }
  }
}

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return `rgb(${r},${g},${bl})`;
}
export { STYLE_ICONS };
