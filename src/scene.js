// Scène du marchandage, vue depuis l'étal : la cliente en face, le comptoir, le tissu, nos mains.
// Chaque action du joueur et chaque réponse de la cliente devient un geste : déplier le pagne,
// le toucher, annoncer un prix, secouer la tête, poser les billets, emporter le tissu.
import { Customer3D, USE3D } from './customer3d.js';
import { drawPortrait, drawHand, drawFigure, traits, tone } from './people.js';
import { waxPattern } from './wax.js';
import { TIERS } from './data.js';
import { clamp, mulberry32 } from './util.js';

const TAU = Math.PI * 2;
const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const seg = (k, a, b) => clamp((k - a) / (b - a), 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;

export class HaggleScene {
  // c : cliente ; p : motif marchandé ; self : apparence de la joueuse ; others : autres motifs exposés
  constructor({ c, p, qty, self, others = [], roof = 'tole', onEvent = () => {} }) {
    this.c = c; this.p = p; this.qty = qty; this.self = self; this.others = others.slice(0, 3);
    this.roof = roof; this.onEvent = onEvent;
    this.T = traits(c.look, c.P.man);
    this.ST = traits(self, false);
    this.acts = [];
    this.chips = [];
    this.speakUntil = 0;
    this.mood = 0.6;
    this.t0 = performance.now() / 1000;
    this.bg = null; this.bgKey = '';
    const rr = mulberry32(c.id * 13 + 5);
    this.passers = Array.from({ length: 4 }, (_, i) => ({
      x: rr(), sp: 0.03 + rr() * 0.04, dir: rr() < 0.5 ? 1 : -1, ph: rr() * 6,
      look: { skin: Math.floor(rr() * 5), style: Math.floor(rr() * 3), seed: Math.floor(rr() * 1e6) }, man: rr() < 0.3, d: rr(),
    }));
    this.cloth = { u: 0, x: 0, y: 0, owner: 'counter' };
    this.c3d = USE3D ? new Customer3D(c.look, c.P.man) : null; this.lastT = 0;
    this.notes = 0; this.notesHeld = 'none';
    this.play('intro');
    this.play('touch', {}, 1.5);
  }

  now() { return performance.now() / 1000 - this.t0; }
  play(kind, data = {}, delay = 0) {
    const D = { intro: 1.4, touch: 1.9, propose: 1.1, counter: 1.4, shake: 1, nod: 0.9, recoil: 1.2, gift: 1.6, deal: 3.8, leave: 1.8, present: 1.3, shrug: 1 };
    this.acts.push({ kind, data, t0: this.now() + delay, d: D[kind] || 1, fired: {} });
    if (kind === 'deal') this.dealing = true;
  }
  speak(sec) { this.speakUntil = Math.max(this.speakUntil, this.now() + sec); }
  chip(text, who, delay = 0) { this.chips.push({ text, who, t0: this.now() + delay, d: 2.2 }); }
  setMood(m) { this.mood = m; }

  // avancement d'une action en cours (0…1), ou −1 si elle n'est pas active
  prog(a, t) { return (t - a.t0) / a.d; }

  layout(W, H) {
    const counterY = H * 0.72;
    const s = Math.min(W / 330, (counterY - 6) / 292);
    return { counterY, s, cx: W / 2, py: counterY - 92 * s, hs: s * 0.92 };
  }

  background(g, W, H, L) {
    const key = `${W}x${H}|${this.roof}`;
    if (this.bg && this.bgKey === key) { g.drawImage(this.bg, 0, 0, W, H); return; }
    const dpr = Math.min(2, devicePixelRatio || 1);
    const cv = document.createElement('canvas'); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const b = cv.getContext('2d'); b.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sky = b.createLinearGradient(0, 0, 0, H * 0.5); sky.addColorStop(0, '#9cc6e8'); sky.addColorStop(1, '#f3e1bd');
    b.fillStyle = sky; b.fillRect(0, 0, W, H);
    // façade du Grand marché, floue au loin
    b.fillStyle = '#d8c6a0'; b.fillRect(0, H * 0.14, W, H * 0.3);
    b.fillStyle = 'rgba(110,90,60,.35)';
    for (let x = 6; x < W; x += 34) { b.beginPath(); b.moveTo(x, H * 0.36); b.lineTo(x, H * 0.24); b.arc(x + 10, H * 0.24, 10, Math.PI, 0); b.lineTo(x + 20, H * 0.36); b.fill(); }
    // étals voisins et parasols
    const rr = mulberry32(99);
    for (let x = -30; x < W + 40; x += 60 + rr() * 40) {
      const col = ['#c0392b', '#1d2f6f', '#e0a526', '#1e6b4a', '#f08a24', '#5b2a86'][Math.floor(rr() * 6)];
      b.globalAlpha = 0.75;
      b.fillStyle = col; b.beginPath(); b.moveTo(x - 10, H * 0.42); b.quadraticCurveTo(x + 30, H * 0.3, x + 70, H * 0.42); b.closePath(); b.fill();
      b.fillStyle = 'rgba(60,40,20,.5)'; b.fillRect(x + 29, H * 0.4, 2, H * 0.12);
      for (let k = 0; k < 4; k++) { b.fillStyle = ['#f2c230', '#d0382b', '#2f78a8', '#f4efe4', '#7aa63a'][Math.floor(rr() * 5)]; b.fillRect(x + k * 15, H * 0.5, 13, H * 0.05); }
      b.globalAlpha = 1;
    }
    const gr = b.createLinearGradient(0, H * 0.55, 0, H); gr.addColorStop(0, '#b98055'); gr.addColorStop(1, '#8a5532');
    b.fillStyle = gr; b.fillRect(0, H * 0.55, W, H * 0.45);
    // brume de chaleur : tout l'arrière-plan reste doux
    b.fillStyle = 'rgba(247,236,214,.32)'; b.fillRect(0, 0, W, H);
    this.bg = cv; this.bgKey = key;
    g.drawImage(cv, 0, 0, W, H);
  }

  roofEdge(g, W, H) {
    const h = Math.max(16, H * 0.06);
    if (this.roof === 'parasol' || this.roof === 'boutique') {
      const spec = this.roof === 'boutique' ? { motif: 'kente', bg: '#1d2f6f', fg: '#f2c230', ac: '#b8322a', seed: 2 } : { motif: 'zigzag', bg: '#c0392b', fg: '#f2c230', ac: '#1d2f6f', seed: 3 };
      g.fillStyle = waxPattern(g, spec, 120, 0.5);
      g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, h);
      const n = Math.ceil(W / 34);
      for (let i = n; i >= 0; i--) { const x = (i / n) * W; g.quadraticCurveTo(x + W / n / 2, h * 1.6, x, h); }
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 0, W, h * 0.3);
    } else {
      // bord de la tôle ondulée
      g.fillStyle = '#8d9398'; g.fillRect(0, 0, W, h);
      for (let x = 0; x < W; x += 9) { g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x, 0, 3, h); g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(x + 5, 0, 2, h); }
      g.fillStyle = 'rgba(120,60,30,.35)'; g.fillRect(0, h - 3, W, 3);
    }
    // ombre portée du toit sur la scène
    const sh = g.createLinearGradient(0, h, 0, h * 3.5); sh.addColorStop(0, 'rgba(40,20,10,.25)'); sh.addColorStop(1, 'rgba(40,20,10,0)');
    g.fillStyle = sh; g.fillRect(0, h, W, h * 2.5);
  }

  draw(g, W, H) {
    const t = this.now();
    const L = this.layout(W, H);
    const { counterY, s, cx, hs } = L;
    g.clearRect(0, 0, W, H);
    this.background(g, W, H, L);
    // passants derrière la cliente
    for (const p of this.passers) {
      p.x += p.sp * p.dir / 60; if (p.x < -0.15) p.x = 1.15; if (p.x > 1.15) p.x = -0.15;
      drawFigure(g, p.x * W, H * 0.57 + p.d * H * 0.03, H * (0.17 + p.d * 0.04), p.look, { walk: t * 6 + p.ph, dir: p.dir, man: p.man, t });
    }
    // voile de lointain sur les passants (sans les rendre transparents)
    g.fillStyle = 'rgba(247,236,214,.28)'; g.fillRect(0, H * 0.3, W, H * 0.4);

    // état courant à partir des actions
    let turn = 0, nod = 0, lean = 0, slide = 0, fade = 1, gazeY = 0, gazeX = null;
    let her = { x: cx + 62 * s, y: counterY + 6 * s, rot: Math.PI - 0.15, curl: 0.25, show: 1 };
    let herL = { x: cx - 66 * s, y: counterY + 4 * s, rot: Math.PI + 0.15, curl: 0.3 };
    let myR = { x: W * 0.74, y: H + 74 * hs, rot: -0.2, curl: 0.15 };
    let myL = { x: W * 0.26, y: H + 74 * hs, rot: 0.2, curl: 0.15 };
    const clothX = cx, clothTop = counterY + 4 * s;
    let unfold = this.cloth.u, clothDX = 0, clothDY = 0, clothScale = 1, clothHidden = false;
    let notesShown = 0, notesX = cx + 40 * s, notesY = counterY + 26 * s;
    let gift = null;
    for (const a of this.acts) {
      const k = this.prog(a, t);
      if (k < 0) continue;
      const e = Math.min(1, k);
      switch (a.kind) {
        case 'intro': {
          unfold = ease(seg(e, 0.15, 0.9)); this.cloth.u = unfold;
          const r = Math.sin(Math.min(1, e) * Math.PI);
          myL = { x: lerp(W * 0.26, clothX - 70 * s, r), y: lerp(H + 74 * hs, clothTop + (20 + unfold * 70) * s, r), rot: 0.5, curl: 0.4 };
          myR = { x: lerp(W * 0.74, clothX + 70 * s, r), y: lerp(H + 74 * hs, clothTop + (20 + unfold * 70) * s, r), rot: -0.5, curl: 0.4 };
          gazeY = 0.8 * r;
          break;
        }
        case 'touch': if (k < 1) {
          const r = Math.sin(e * Math.PI);
          her = { x: lerp(her.x, clothX + 10 * s + Math.sin(t * 9) * 9 * s * r, r), y: lerp(her.y, clothTop + 48 * s, r), rot: Math.PI - 0.05, curl: 0.35, show: 1 };
          gazeY = Math.max(gazeY, 0.9 * r); nod = 1.2 * r;
          if (!a.fired.voice && e > 0.3) { a.fired.voice = 1; this.onEvent('rub'); }
        } break;
        case 'present': if (k < 1) {
          const r = Math.sin(e * Math.PI);
          myR = { x: lerp(myR.x, clothX + 30 * s + Math.sin(t * 7) * 6 * s * r, r), y: lerp(myR.y, clothTop + 60 * s, r), rot: -0.3, curl: 0.1 };
          gazeY = Math.max(gazeY, 0.7 * r);
        } break;
        case 'propose': if (k < 1) {
          const r = Math.sin(e * Math.PI);
          myR = { x: lerp(myR.x, W * 0.66, r), y: lerp(myR.y, counterY + 30 * s, r), rot: -0.1 + Math.sin(e * 12) * 0.05, curl: 0 };
        } break;
        case 'shrug': if (k < 1) {
          const r = Math.sin(e * Math.PI);
          myL = { x: lerp(myL.x, W * 0.24, r), y: lerp(myL.y, counterY + 50 * s, r), rot: 0.6, curl: 0 };
          myR = { x: lerp(myR.x, W * 0.76, r), y: lerp(myR.y, counterY + 50 * s, r), rot: -0.6, curl: 0 };
        } break;
        case 'counter': if (k < 1) {
          const r = Math.sin(e * Math.PI);
          herL = { x: lerp(herL.x, cx - 40 * s, r), y: lerp(herL.y, counterY - 30 * s, r), rot: Math.PI + 0.9 * r, curl: 0.05 };
          turn += Math.sin(e * Math.PI * 3) * 0.25 * (1 - e);
        } break;
        case 'shake': if (k < 1) turn += Math.sin(e * Math.PI * 4) * 0.7 * (1 - e * 0.7); break;
        case 'nod': if (k < 1) nod += Math.sin(e * Math.PI * 3) * 1.6 * (1 - e * 0.5); break;
        case 'recoil': if (k < 1) {
          const r = Math.sin(e * Math.PI);
          lean = r; turn += 0.35 * r;
          herL = { x: lerp(herL.x, cx - 30 * s, r), y: lerp(herL.y, counterY - 50 * s, r), rot: Math.PI + 0.6 + Math.sin(t * 14) * 0.25 * r, curl: 0 };
        } break;
        case 'gift': if (k < 1) {
          const m = ease(seg(e, 0.1, 0.65));
          const gx = lerp(W * 0.72, cx + 40 * s, m), gy = lerp(H + 10, counterY + 10 * s, m);
          if (e < 0.7) myR = { x: gx + 8 * s, y: gy + 40 * hs, rot: -0.3, curl: 0.5 };
          gift = { x: gx, y: e < 0.7 ? gy : lerp(gy, counterY - 40 * s, ease(seg(e, 0.7, 1))), a: e < 0.85 ? 1 : 1 - seg(e, 0.85, 1) };
          if (e > 0.6) { const r = ease(seg(e, 0.6, 0.8)); her = { x: lerp(her.x, gx, r), y: lerp(her.y, gift.y + 30 * s, r), rot: Math.PI, curl: 0.6, show: 1 }; nod += Math.sin(seg(e, 0.7, 1) * Math.PI * 2) * 1.2; }
        } break;
        case 'deal': {
          // elle hoche la tête, pose les billets un à un, nous les ramassons, puis elle emporte le tissu plié
          const n = a.data.notes || 3;
          nod += e < 0.25 ? Math.sin(seg(e, 0, 0.25) * Math.PI * 3) * 1.5 : 0;
          const put = seg(e, 0.15, 0.45);
          if (put > 0 && put < 1) {
            const r = Math.sin(put * Math.PI);
            herL = { x: lerp(herL.x, cx + 30 * s, r), y: lerp(herL.y, counterY + 30 * s, r), rot: Math.PI - 0.3, curl: 0.55 };
          }
          notesShown = Math.min(n, Math.floor(put * (n + 0.99)));
          for (let i = 1; i <= notesShown; i++) if (!a.fired['n' + i]) { a.fired['n' + i] = 1; this.onEvent('note'); }
          const take = seg(e, 0.45, 0.62);
          if (take > 0) {
            myR = { x: lerp(W * 0.74, notesX, Math.sin(Math.min(1, take * 1.6) * Math.PI * 0.5)), y: lerp(H + 74 * hs, notesY + 40 * hs, Math.sin(take * Math.PI)), rot: -0.25, curl: 0.5 };
            if (take > 0.55) { notesX = lerp(notesX, W * 0.95, (take - 0.55) / 0.45); notesY = lerp(notesY, H + 20, (take - 0.55) / 0.45); }
            if (take >= 1) notesShown = 0;
            if (take > 0.6 && !a.fired.box) { a.fired.box = 1; this.onEvent('cash'); }
          }
          const fold = ease(seg(e, 0.58, 0.75));
          unfold = Math.min(this.cloth.u, 1 - fold);
          const lift = ease(seg(e, 0.75, 1));
          if (lift > 0) {
            clothDY = -lift * (counterY * 0.1); clothScale = 1 - lift * 0.2;
            her = { x: cx + 26 * s, y: clothTop + 26 * s + clothDY, rot: Math.PI - 0.2, curl: 0.7, show: 1 };
            herL = { x: cx - 26 * s, y: clothTop + 26 * s + clothDY, rot: Math.PI + 0.2, curl: 0.7 };
          }
          if (e >= 1) { this.cloth.u = 0; }
          break;
        }
        case 'leave': {
          turn += e < 0.4 ? Math.sin(seg(e, 0, 0.4) * Math.PI * 3) * 0.6 : 0;
          const go = ease(seg(e, 0.4, 1));
          turn += go * 0.9; slide = go; fade = 1 - go;
          break;
        }
      }
    }
    // les actions finies sont retirées, sauf l'état final de la vente ou du départ
    this.acts = this.acts.filter((a) => this.prog(a, t) < 1 || a.kind === 'deal' || a.kind === 'leave');
    const sold = this.acts.some((a) => a.kind === 'deal' && this.prog(a, t) >= 1);

    // la cliente
    const talking = t < this.speakUntil ? Math.abs(Math.sin(t * 17)) * 0.9 : 0;
    const blink = (t % 3.7) < 0.12;
    g.save();
    g.globalAlpha = fade;
    const px = cx + slide * W * 0.7, py = L.py + lean * 8 * s;
    const gz = { x: gazeX ?? Math.sin(t * 0.37) * 0.2, y: gazeY };
    const dt = Math.min(0.05, Math.max(0, t - this.lastT)); this.lastT = t;
    if (this.c3d && this.c3d.ready) {
      // buste 3D : rendu à la taille du canevas, recopié à la place du portrait (le comptoir le coupe à la taille)
      const dpr = Math.min(2, devicePixelRatio || 1), bh = counterY + 30 * s;
      this.c3d.render(Math.round(W * dpr), Math.round(bh * dpr), dt, { talking: talking > 0, turn, nod: nod + gazeY * 1.2, lean, gazeX: gz.x });
      g.drawImage(this.c3d.canvas, px - cx, lean * 6 * s, W, bh);
    } else drawPortrait(g, W, H, this.c.look, { place: { x: px, y: py, s: s * (1 - lean * 0.04) }, mood: this.mood, talk: talking, man: this.c.P.man, blink, t, turn, nod: nod + gazeY * 1.2, gaze: gz });
    g.restore();

    this.roofEdge(g, W, H);

    // comptoir
    const cg = g.createLinearGradient(0, counterY, 0, H);
    cg.addColorStop(0, '#8a5e38'); cg.addColorStop(0.08, '#74492a'); cg.addColorStop(1, '#4e2e18');
    g.fillStyle = cg; g.fillRect(0, counterY, W, H - counterY);
    g.fillStyle = '#9b6c43'; g.fillRect(0, counterY, W, Math.max(3, 4 * s));
    g.strokeStyle = 'rgba(30,15,5,.25)'; g.lineWidth = 1;
    for (let y = counterY + 14 * s; y < H; y += 18 * s) { g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(W * 0.3, y + 3, W * 0.6, y - 3, W, y + 1); g.stroke(); }

    // autres tissus pliés à gauche, boîte de la caisse à droite
    this.others.forEach((sp, i) => {
      const bw = 70 * s, bh = 12 * s, bx = W * 0.04 + i * 4 * s, by = counterY + 6 * s - (i + 1) * bh * 0.9;
      g.fillStyle = waxPattern(g, sp, 120, 0.35 * s); g.fillRect(bx, by + 20 * s, bw, bh);
      g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(bx, by + 20 * s + bh - 3, bw, 3);
    });
    const tx = W * 0.86, ty = counterY + 18 * s, tw = 48 * s, th = 30 * s;
    g.fillStyle = '#c9ced3'; g.fillRect(tx - tw / 2, ty, tw, th);
    g.fillStyle = '#e9ecee'; g.fillRect(tx - tw / 2, ty, tw, th * 0.18);
    g.fillStyle = '#c0392b'; g.fillRect(tx - tw / 2, ty + th * 0.35, tw, th * 0.32);
    g.fillStyle = '#fff'; g.font = `800 ${Math.max(7, 7 * s)}px Manrope, sans-serif`; g.textAlign = 'center'; g.fillText('CAISSE', tx, ty + th * 0.57);

    // le pagne marchandé
    if (!sold) this.drawCloth(g, clothX + clothDX, clothTop, s * clothScale, unfold, clothDY);
    else if (her.show && fade > 0) { /* parti avec elle */ }

    // billets posés sur le comptoir
    for (let i = 0; i < notesShown; i++) drawNote(g, notesX + i * 5 * s, notesY - i * 3 * s, s, i);

    // le foulard offert
    if (gift) {
      g.save(); g.globalAlpha = gift.a; g.translate(gift.x, gift.y); g.rotate(-0.2);
      const fs = 34 * s;
      g.fillStyle = waxPattern(g, { motif: 'fleurs', bg: '#f2c230', fg: '#b8322a', ac: '#1d2f6f', seed: 21 }, 120, 0.4 * s);
      g.beginPath(); g.moveTo(-fs, 0); g.lineTo(fs, 0); g.lineTo(0, fs * 0.8); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1; g.stroke();
      g.restore();
    }

    // mains de la cliente (au-dessus du comptoir), puis les nôtres
    g.save(); g.globalAlpha = fade;
    if (!slide) {
      const sl = this.T.man ? (this.T.smock ? null : this.T.wrap) : this.T.tourist ? null : this.T.dress;
      drawHand(g, herL.x, herL.y, hs * 0.72, this.T.skin, { rot: herL.rot, curl: herL.curl, sleeve: sl, bangles: this.T.bangles, flip: -1, arm: 46 });
      drawHand(g, her.x, her.y, hs * 0.72, this.T.skin, { rot: her.rot, curl: her.curl, sleeve: sl, bangles: false, arm: 46 });
      if (sold || this.acts.some((a) => a.kind === 'deal' && this.prog(a, t) > 0.75)) {
        // le tissu plié dans ses mains
        const k = this.acts.find((a) => a.kind === 'deal');
        const lift = k ? ease(seg(this.prog(k, t), 0.75, 1)) : 1;
        this.drawCloth(g, cx, clothTop, s * (1 - lift * 0.2), 0, -lift * counterY * 0.1);
      }
    }
    g.restore();
    drawHand(g, myL.x, myL.y, hs, this.ST.skin, { rot: myL.rot, curl: myL.curl, sleeve: this.ST.dress, bangles: true, flip: -1 });
    drawHand(g, myR.x, myR.y, hs, this.ST.skin, { rot: myR.rot, curl: myR.curl, sleeve: this.ST.dress, bangles: true });

    // étiquettes de prix (ce que je dis, ce qu'elle répond)
    this.chips = this.chips.filter((c) => t - c.t0 < c.d);
    for (const c of this.chips) {
      const k = (t - c.t0) / c.d;
      if (k < 0) continue;
      const a = k < 0.1 ? k / 0.1 : k > 0.8 ? (1 - k) / 0.2 : 1;
      const x = c.who === 'me' ? W * 0.66 : cx - 60 * s, y = (c.who === 'me' ? counterY - 6 * s : L.py - 10 * s) - k * 12;
      g.save(); g.globalAlpha = a;
      g.font = `900 ${Math.round(clamp(15 * s, 12, 20))}px Fraunces, Georgia, serif`;
      const tw2 = g.measureText(c.text).width + 18;
      g.fillStyle = c.who === 'me' ? '#2a1a12' : '#fffaf0';
      roundRect(g, x - tw2 / 2, y - 16, tw2, 26, 13); g.fill();
      g.strokeStyle = c.who === 'me' ? '#e0a526' : '#2a1a12'; g.lineWidth = 2; g.stroke();
      g.fillStyle = c.who === 'me' ? '#f6e7c4' : '#2a1a12'; g.textAlign = 'center'; g.fillText(c.text, x, y + 3);
      g.restore();
    }
    // vignette
    const vg = g.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(30,15,5,.35)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }

  // u : 0 plié … 1 déplié vers nous ; dy : décalage vertical (quand elle l'emporte)
  drawCloth(g, x, top, s, u, dy = 0) {
    const w = 92 * s + u * 50 * s, foldH = 16 * s, full = 104 * s;
    const len = lerp(foldH, full, u);
    const y = top + dy;
    g.save();
    // pile pliée (plusieurs pièces si elle en prend plusieurs)
    const layers = Math.min(4, this.qty);
    for (let l = layers - 1; l >= 1; l--) {
      g.fillStyle = waxPattern(g, this.p.spec, 120, 0.42 * s); g.fillRect(x - w / 2 + l * 2, y - l * 5 * s, w, foldH);
      g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x - w / 2 + l * 2, y - l * 5 * s + foldH - 3, w, 3);
    }
    // pièce dépliée : légère perspective (plus large vers nous)
    const spread = u * 18 * s;
    g.beginPath();
    g.moveTo(x - w / 2, y); g.lineTo(x + w / 2, y);
    g.lineTo(x + w / 2 + spread, y + len); g.lineTo(x - w / 2 - spread, y + len); g.closePath();
    g.fillStyle = waxPattern(g, this.p.spec, 120, (0.42 + u * 0.18) * s); g.fill();
    // plis marqués du pliage d'origine
    const n = Math.max(1, Math.round(len / foldH));
    for (let k = 1; k < n; k++) {
      const yy = y + (k / n) * len, sp = (k / n) * spread;
      g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(x - w / 2 - sp, yy - 1.5, w + sp * 2, 2);
      g.fillStyle = 'rgba(255,250,235,.12)'; g.fillRect(x - w / 2 - sp, yy + 0.5, w + sp * 2, 1.5);
    }
    // lisière imprimée
    g.fillStyle = '#f4ede0'; g.fillRect(x + w / 2 - 7 * s + spread * 0, y, 7 * s, foldH);
    if (u > 0.4) {
      g.save(); g.translate(x + w / 2 + spread * 0.5 - 3.5 * s, y + len * 0.5); g.rotate(Math.PI / 2);
      g.fillStyle = '#f4ede0'; g.fillRect(-len / 2, -3.5 * s, len, 7 * s);
      g.fillStyle = TIERS[this.p.tier]?.color || '#2a1a12'; g.font = `800 ${Math.max(5, 5 * s)}px Manrope, sans-serif`; g.textAlign = 'center';
      g.fillText(this.p.tier === 'hollandais' || this.p.tier === 'super' ? 'WAX HOLLANDAIS VÉRITABLE' : 'WAX IMPRIMÉ GARANTI', 0, 2 * s);
      g.restore();
    }
    // ombre sur le comptoir
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x - w / 2 - spread, y + len, w + spread * 2, 3 * s);
    g.restore();
  }
}

function drawNote(g, x, y, s, i) {
  const w = 52 * s, h = 26 * s;
  g.save(); g.translate(x, y); g.rotate(-0.12 + i * 0.07);
  g.fillStyle = ['#b98a52', '#7d9358', '#a0623f'][i % 3]; g.fillRect(-w / 2, -h / 2, w, h);
  g.strokeStyle = 'rgba(255,248,230,.55)'; g.lineWidth = 1; g.strokeRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6);
  g.fillStyle = 'rgba(40,25,10,.5)'; g.beginPath(); g.arc(w * 0.22, 0, h * 0.26, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,248,230,.75)'; g.font = `800 ${Math.max(6, 7 * s)}px Manrope, sans-serif`; g.textAlign = 'left';
  g.fillText('BCEAO', -w / 2 + 6, -h / 2 + 10 * s);
  g.font = `900 ${Math.max(7, 9 * s)}px Fraunces, serif`; g.fillText(['1000', '5000', '500'][i % 3], -w / 2 + 6, h / 2 - 5 * s);
  g.restore();
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
export { tone };
