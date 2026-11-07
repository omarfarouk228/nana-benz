// Le garage : dessin des voitures et grande scène de livraison quand on en achète une.
// Nuit sur le boulevard, projecteurs, la voiture arrive en glissant, phares, éclat, pluie de pagnes et foule qui acclame.
import { waxPattern } from './wax.js';
import { CATALOG } from './data.js';
import { mulberry32, clamp } from './util.js';

const TAU = Math.PI * 2;
const easeOut = (k) => 1 - Math.pow(1 - k, 3);

// berline des années 1970 de profil ; len allonge la caisse (la Pullman a trois vitres de côté)
export function drawCar(g, cx, by, u, car, { lights = 0, shine = 0 } = {}) {
  const L = 100 * (car.len || 1), ox = cx - L * u / 2, oy = by;
  const X = (x) => ox + x * (car.len || 1) * u; // abscisse étirée
  g.save();
  g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(cx, oy + 8 * u, L * u * 0.5, 4 * u, 0, 0, TAU); g.fill();
  g.fillStyle = car.color; g.strokeStyle = '#120c08'; g.lineWidth = Math.max(1.5, 0.45 * u); g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(X(4), oy); g.lineTo(X(2), oy - 9 * u); g.lineTo(X(18), oy - 12 * u); g.lineTo(X(30), oy - 22 * u);
  g.lineTo(X(62), oy - 22 * u); g.lineTo(X(74), oy - 12 * u); g.lineTo(X(96), oy - 10 * u); g.lineTo(X(98), oy); g.closePath();
  g.fill(); g.stroke();
  // reflet de carrosserie
  const sh = g.createLinearGradient(0, oy - 22 * u, 0, oy);
  sh.addColorStop(0, `rgba(255,255,255,${0.28 + shine * 0.3})`); sh.addColorStop(0.45, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.25)');
  g.fillStyle = sh; g.fill();
  // vitres
  g.fillStyle = '#9fb7c9';
  const panes = car.len > 1.25 ? 3 : 2, x0 = 31, x1 = 61, step = (x1 - x0) / panes;
  for (let i = 0; i < panes; i++) {
    const a = x0 + i * step + (i ? 1 : 0), b = x0 + (i + 1) * step - 1;
    g.beginPath();
    g.moveTo(X(a), oy - 20 * u); g.lineTo(X(b), oy - 20 * u);
    g.lineTo(i === panes - 1 ? X(b + 8) : X(b), oy - 13 * u); g.lineTo(i === 0 ? X(a - 8) : X(a), oy - 13 * u);
    g.closePath(); g.fill();
  }
  g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(X(33), oy - 19.5 * u, 6 * u, 1 * u);
  // chromes, calandre, feux
  g.fillStyle = '#c9ced3';
  g.fillRect(X(0), oy - 3 * u, 8 * u, 2 * u); g.fillRect(X(92), oy - 3 * u, 7 * u, 2 * u);
  g.fillRect(X(2), oy - 8 * u, (X(96) - X(2)), 0.8 * u);
  g.fillRect(X(94), oy - 9 * u, 3.5 * u, 6 * u);
  g.fillStyle = '#e8e2d0'; g.beginPath(); g.arc(X(96.5), oy - 10.6 * u, 0.9 * u, 0, TAU); g.fill(); // l'étoile sur le capot
  g.fillStyle = lights ? '#fffbe0' : '#f6e7a8'; g.beginPath(); g.ellipse(X(95), oy - 7.5 * u, 1.3 * u, 1.8 * u, 0, 0, TAU); g.fill();
  g.fillStyle = '#c0392b'; g.fillRect(X(1.5), oy - 8 * u, 2 * u, 3 * u);
  g.fillStyle = '#8a8f94'; for (let i = 0; i < panes; i++) g.fillRect(X(x0 + 8 + i * step), oy - 11 * u, 4 * u, 0.9 * u);
  g.strokeStyle = 'rgba(18,12,8,.35)'; g.lineWidth = 0.4 * u;
  for (let i = 1; i < panes; i++) { g.beginPath(); g.moveTo(X(x0 + i * step), oy - 20 * u); g.lineTo(X(x0 + i * step), oy - 1 * u); g.stroke(); }
  for (const wx of [22, 78]) {
    g.fillStyle = '#1c1714'; g.beginPath(); g.arc(X(wx), oy, 8 * u, 0, TAU); g.fill();
    g.fillStyle = '#c9ced3'; g.beginPath(); g.arc(X(wx), oy, 4.2 * u, 0, TAU); g.fill();
    g.fillStyle = '#8a8f94'; g.beginPath(); g.arc(X(wx), oy, 1.4 * u, 0, TAU); g.fill();
  }
  // faisceau des phares
  if (lights) {
    const bx = X(97), byy = oy - 7.5 * u;
    const gr = g.createRadialGradient(bx, byy, 0, bx, byy, 70 * u);
    gr.addColorStop(0, `rgba(255,248,210,${0.55 * lights})`); gr.addColorStop(1, 'rgba(255,248,210,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(bx, byy); g.lineTo(bx + 80 * u, byy - 18 * u); g.lineTo(bx + 80 * u, byy + 16 * u); g.closePath(); g.fill();
  }
  g.restore();
}

// vignette de garage (onglet du soir)
export function drawCarCard(cv, car, owned = true) {
  const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = r.width, H = r.height, u = Math.min(W / (120 * (car.len || 1)), H / 52);
  g.fillStyle = waxPattern(g, { motif: 'cauris', bg: '#efe3c6', fg: '#e2d2ad', ac: '#e9dbb9', seed: 4 }, 120, 1); g.fillRect(0, 0, W, H);
  if (!owned) g.globalAlpha = 0.28;
  drawCar(g, W / 2, H * 0.74, u, owned ? car : { ...car, color: '#8a7563' });
  g.globalAlpha = 1;
}

let el = null;
export function playCarReveal(car, sound, { kicker = 'Livraison', title, line } = {}) {
  if (el) el.remove();
  el = document.createElement('div');
  el.id = 'cine'; el.className = 'reveal';
  el.innerHTML = `<canvas></canvas><div class="cine-txt"><div class="kicker">${kicker}</div><h2>${title || car.name}</h2><p>${line || car.desc}</p></div><div class="cine-skip">Toucher pour continuer</div>`;
  document.body.appendChild(el);
  const cv = el.querySelector('canvas'), g = cv.getContext('2d');
  const t0 = performance.now();
  const rng = mulberry32(car.price);
  const confetti = Array.from({ length: 90 }, () => ({ x: rng(), y: -rng() * 0.6, vx: (rng() - 0.5) * 0.25, vy: 0.12 + rng() * 0.25, r: rng() * TAU, vr: (rng() - 0.5) * 6, s: 8 + rng() * 14, spec: CATALOG[Math.floor(rng() * CATALOG.length)].spec }));
  const crowd = Array.from({ length: 26 }, (_, i) => ({ x: i / 25 + (rng() - 0.5) * 0.03, h: 0.7 + rng() * 0.5, ph: rng() * TAU, wrap: ['#c0392b', '#1d2f6f', '#e0a526', '#1e6b4a', '#f08a24', '#5b2a86'][i % 6] }));
  const pats = new Map();
  // les sons : roulement, klaxon, fanfare
  if (sound) {
    for (let i = 0; i < 14; i++) sound.tone(90 + i * 4, 0.08, 'triangle', 0.05, i * 0.08);
    setTimeout(() => sound.horn(), 2300);
    setTimeout(() => sound.fanfare(), 2700);
    setTimeout(() => sound.deal(), 3900);
  }
  let done = false;
  return new Promise((resolve) => {
    const finish = () => {
      if (done || performance.now() - t0 < 1800) return;
      done = true; el.classList.add('out');
      setTimeout(() => { el?.remove(); el = null; resolve(); }, 650);
    };
    el.addEventListener('pointerdown', finish);
    const key = (e) => { if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') { finish(); if (done) removeEventListener('keydown', key); } };
    addEventListener('keydown', key);
    setTimeout(() => el && el.classList.add('show'), 30);
    setTimeout(finish, 11000);
    const loop = (now) => {
      if (!el || !document.body.contains(cv)) return;
      const t = (now - t0) / 1000;
      const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
      if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const W = r.width, H = r.height;
      // nuit dorée
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#0b0705'); sky.addColorStop(0.6, '#2a1a12'); sky.addColorStop(1, '#5c3418');
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      // rayons qui tournent derrière la voiture
      const cx = W / 2, cy = H * 0.5, glow = clamp((t - 2.2) / 0.8, 0, 1);
      g.save(); g.translate(cx, cy); g.rotate(t * 0.15);
      for (let i = 0; i < 16; i++) {
        g.rotate(TAU / 16);
        g.fillStyle = `rgba(242,194,48,${0.05 + glow * 0.07})`;
        g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.max(W, H), -60); g.lineTo(Math.max(W, H), 60); g.closePath(); g.fill();
      }
      g.restore();
      // projecteurs qui balaient
      for (const [k, side] of [[0, -1], [1, 1]]) {
        const a = Math.sin(t * 1.3 + k * 2) * 0.35 + (side > 0 ? -0.25 : 0.25);
        g.save(); g.translate(cx + side * W * 0.42, H); g.rotate(a);
        const lg = g.createLinearGradient(0, 0, 0, -H);
        lg.addColorStop(0, 'rgba(255,246,226,.22)'); lg.addColorStop(1, 'rgba(255,246,226,0)');
        g.fillStyle = lg; g.beginPath(); g.moveTo(-8, 0); g.lineTo(-90, -H * 1.1); g.lineTo(90, -H * 1.1); g.lineTo(8, 0); g.closePath(); g.fill();
        g.restore();
      }
      // le boulevard
      const ry = H * 0.66;
      g.fillStyle = '#1a120d'; g.fillRect(0, ry, W, H - ry);
      g.fillStyle = 'rgba(242,194,48,.5)';
      for (let x = (-(t * 400) % 120); x < W; x += 120) g.fillRect(x, ry + (H - ry) * 0.35, 60, 4);
      // la voiture glisse depuis la droite et s'arrête
      const k = easeOut(clamp((t - 0.9) / 1.6, 0, 1));
      const u = Math.min(W / (125 * (car.len || 1)), H / 60) * 0.7;
      const x = cx + (1 - k) * W * 1.1;
      if (k < 1) { g.fillStyle = 'rgba(255,246,226,.12)'; for (let i = 0; i < 6; i++) g.fillRect(x + 50 * u * (car.len || 1) + i * 30, ry - 8 - i * 9 * u * 0.4, 80 + i * 20, 2); }
      drawCar(g, x, ry + 6 * u * 0.3, u, car, { lights: k >= 1 ? clamp((t - 2.5) / 0.3, 0, 1) : 0, shine: Math.sin(t * 2) * 0.5 + 0.5 });
      // éclat
      const flash = clamp(1 - Math.abs(t - 2.6) / 0.35, 0, 1);
      if (flash) { g.fillStyle = `rgba(255,251,224,${flash * 0.7})`; g.fillRect(0, 0, W, H); }
      // la foule acclame
      if (t > 2.4) {
        for (const p of crowd) {
          const px = p.x * W, base = H, hh = H * 0.13 * p.h, jump = Math.max(0, Math.sin(t * 7 + p.ph)) * H * 0.015;
          g.fillStyle = '#0d0907';
          g.beginPath(); g.ellipse(px, base - hh * 0.4 - jump, hh * 0.28, hh * 0.5, 0, 0, TAU); g.fill();
          g.beginPath(); g.arc(px, base - hh - jump, hh * 0.16, 0, TAU); g.fill();
          g.fillStyle = p.wrap; g.beginPath(); g.ellipse(px, base - hh * 1.12 - jump, hh * 0.2, hh * 0.09, 0, 0, TAU); g.fill();
          g.strokeStyle = '#0d0907'; g.lineWidth = Math.max(3, hh * 0.08); g.lineCap = 'round';
          const wave = Math.sin(t * 9 + p.ph) * 0.4;
          for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(px + sd * hh * 0.18, base - hh * 0.75 - jump); g.lineTo(px + sd * hh * (0.35 + wave * 0.1), base - hh * 1.35 - jump); g.stroke(); }
        }
      }
      // pluie de pagnes
      if (t > 2.6) {
        const tt = t - 2.6;
        for (const c of confetti) {
          const px = (c.x + c.vx * tt) * W, py = (c.y + c.vy * tt) * H;
          if (py > H + 20) continue;
          if (!pats.has(c.spec)) pats.set(c.spec, waxPattern(g, c.spec, 48, 1));
          g.save(); g.translate(px, py); g.rotate(c.r + c.vr * tt); g.scale(1, Math.cos(tt * 4 + c.r));
          g.fillStyle = pats.get(c.spec); g.fillRect(-c.s / 2, -c.s * 0.35, c.s, c.s * 0.7);
          g.restore();
        }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}
