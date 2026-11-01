// Cinématiques entre les journées : l'aube sur la plage de Lomé, le soir sur le Grand marché.
// Bandes noires, parallaxe, soleil qui monte ou descend, brume d'harmattan, texte qui s'écrit. Touche pour passer.
import { drawFigure } from './people.js';
import { mulberry32, clamp } from './util.js';

const TAU = Math.PI * 2;
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const lerpC = (a, b, t) => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
};

let el = null;
export function playCine(kind, info, self) {
  if (el) el.remove();
  el = document.createElement('div');
  el.id = 'cine';
  el.innerHTML = `<canvas></canvas><div class="cine-txt"><div class="kicker">${info.kicker}</div><h2>${info.title}</h2><p></p></div><div class="cine-skip">Toucher pour passer</div>`;
  document.body.appendChild(el);
  const cv = el.querySelector('canvas'), g = cv.getContext('2d');
  const p = el.querySelector('p');
  const dur = kind === 'dawn' ? 5.6 : 4.8;
  const t0 = performance.now();
  let done = false, out = 0;
  return new Promise((resolve) => {
    const finish = () => {
      if (done) return; done = true; out = performance.now();
      el.classList.add('out');
      setTimeout(() => { el?.remove(); el = null; resolve(); }, 650);
    };
    el.addEventListener('pointerdown', finish);
    const key = (e) => { if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') { finish(); removeEventListener('keydown', key); } };
    addEventListener('keydown', key);
    setTimeout(() => el && el.classList.add('show'), 30);
    const loop = (now) => {
      if (!el || !document.body.contains(cv)) return;
      const t = (now - t0) / 1000, k = clamp(t / dur, 0, 1);
      const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
      if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      (kind === 'dawn' ? dawn : dusk)(g, r.width, r.height, t, k, self);
      // texte écrit au fil du temps
      const full = info.line || '', n = Math.floor(clamp((t - 1) / 2.2, 0, 1) * full.length);
      if (p.textContent.length !== n) p.textContent = full.slice(0, n);
      if (t >= dur && !done) finish();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}

function palms(g, W, H, base, shift, rng, col, n = 5) {
  for (let i = 0; i < n; i++) {
    const x = ((rng() * 1.4 - 0.2) * W + shift) % (W * 1.4) - W * 0.2, h = H * (0.32 + rng() * 0.22), lean = (rng() - 0.5) * 0.5;
    g.strokeStyle = col; g.lineWidth = Math.max(3, H * 0.012); g.lineCap = 'round';
    const tx = x + lean * h, ty = base - h;
    g.beginPath(); g.moveTo(x, base); g.quadraticCurveTo(x + lean * h * 0.2, base - h * 0.6, tx, ty); g.stroke();
    g.lineWidth = Math.max(2, H * 0.006);
    for (let f = 0; f < 8; f++) {
      const a = (f / 8) * TAU + rng() * 0.3, L = h * (0.26 + rng() * 0.08);
      const ex = tx + Math.cos(a) * L, ey = ty + Math.sin(a) * L * 0.45 + L * 0.35;
      g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(tx + Math.cos(a) * L * 0.6, ty - L * 0.25, ex, ey); g.stroke();
    }
  }
}

function letterbox(g, W, H, t) {
  const sh = g.createLinearGradient(0, H * 0.5, 0, H); sh.addColorStop(0, 'rgba(10,5,3,0)'); sh.addColorStop(1, 'rgba(10,5,3,.6)');
  g.fillStyle = sh; g.fillRect(0, H * 0.5, W, H * 0.5);
  const b = Math.min(1, t / 0.6) * H * 0.09;
  g.fillStyle = '#0b0705'; g.fillRect(0, 0, W, b); g.fillRect(0, H - b, W, b);
}

// aube sur la plage : pirogues qui rentrent, la commerçante part au marché avec sa bassine
function dawn(g, W, H, t, k, self) {
  const hz = H * 0.56, e = ease(k);
  const sky = g.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, lerpC('#1b1f45', '#6f9fd0', e)); sky.addColorStop(0.65, lerpC('#7d4a6e', '#f3c58e', e)); sky.addColorStop(1, lerpC('#e9894e', '#fbe2b4', e));
  g.fillStyle = sky; g.fillRect(0, 0, W, hz);
  // soleil qui se lève (voilé par l'harmattan)
  const sx = W * 0.68, sy = hz - e * H * 0.24 + H * 0.03;
  const sg = g.createRadialGradient(sx, sy, 0, sx, sy, H * 0.22); sg.addColorStop(0, 'rgba(255,236,190,.95)'); sg.addColorStop(0.18, 'rgba(255,200,130,.6)'); sg.addColorStop(1, 'rgba(255,180,120,0)');
  g.fillStyle = sg; g.fillRect(0, 0, W, hz);
  g.fillStyle = '#fff3d6'; g.beginPath(); g.arc(sx, sy, H * 0.04, 0, TAU); g.fill();
  // mer
  const sea = g.createLinearGradient(0, hz, 0, H * 0.74); sea.addColorStop(0, lerpC('#3b4a7a', '#4b86a8', e)); sea.addColorStop(1, lerpC('#26305a', '#2f6488', e));
  g.fillStyle = sea; g.fillRect(0, hz, W, H * 0.2);
  g.fillStyle = 'rgba(255,220,170,.35)';
  for (let i = 0; i < 26; i++) { const y = hz + 4 + i * 3.5, w = (40 - i) * 2 * (1 + Math.sin(t * 2 + i) * 0.2); g.fillRect(sx - w / 2 + Math.sin(t * 1.3 + i * 1.7) * 6, y, w, 1.5); }
  // pirogues de pêcheurs
  for (let i = 0; i < 4; i++) {
    const x = ((i * 0.27 + t * 0.012 * (i % 2 ? 1 : 0.7)) % 1.2) * W - W * 0.1, y = hz + 10 + i * 9;
    g.fillStyle = '#1a120d';
    g.beginPath(); g.moveTo(x - 26, y); g.quadraticCurveTo(x, y + 7, x + 26, y); g.lineTo(x + 20, y + 3); g.lineTo(x - 20, y + 3); g.fill();
    for (let m = -1; m <= 1; m++) g.fillRect(x + m * 9, y - 9, 2, 9);
  }
  // vagues et sable
  g.fillStyle = 'rgba(255,255,255,.4)';
  for (let i = 0; i < 3; i++) { const y = H * 0.73 + Math.sin(t * 1.2 + i) * 2; g.fillRect(0, y + i * 3, W, 1.2); }
  const sand = g.createLinearGradient(0, H * 0.74, 0, H); sand.addColorStop(0, lerpC('#8c6a50', '#e2c08c', e)); sand.addColorStop(1, lerpC('#5d4232', '#b98a5c', e));
  g.fillStyle = sand; g.fillRect(0, H * 0.74, W, H * 0.26);
  // cocotiers en parallaxe
  palms(g, W, H, H * 0.78, -t * 14, mulberry32(4), lerpC('#120c0a', '#3c2a1c', e * 0.6), 4);
  // la commerçante, bassine de wax sur la tête
  const fx = W * (0.12 + k * 0.5), fh = Math.min(H * 0.3, W * 0.38);
  drawFigure(g, fx, H * 0.84, fh, self, { walk: t * 6.5, dir: 1, load: '#2f78a8', t });
  palms(g, W, H, H * 1.02, -t * 40, mulberry32(9), '#0d0806', 2);
  // brume d'harmattan
  g.fillStyle = `rgba(232,198,150,${0.16 + (1 - e) * 0.08})`; g.fillRect(0, 0, W, H);
  letterbox(g, W, H, t);
}

// fin de journée : le Grand marché se vide, lampes à pétrole, la commerçante rentre
function dusk(g, W, H, t, k, self) {
  const e = ease(k), hz = H * 0.62;
  const sky = g.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, lerpC('#e8875a', '#2a1f4a', e)); sky.addColorStop(0.6, lerpC('#f2b066', '#a2506a', e)); sky.addColorStop(1, lerpC('#f7d08a', '#e07a4a', e));
  g.fillStyle = sky; g.fillRect(0, 0, W, hz);
  const sx = W * 0.3, sy = hz - H * 0.18 + e * H * 0.2;
  g.fillStyle = 'rgba(255,215,150,.9)'; g.beginPath(); g.arc(sx, sy, H * 0.05, 0, TAU); g.fill();
  // silhouette du Grand marché
  g.fillStyle = lerpC('#5a3a2a', '#24161a', e);
  g.fillRect(W * 0.1, hz - H * 0.26, W * 0.8, H * 0.26);
  g.fillStyle = lerpC('#3c271d', '#160d10', e);
  for (let x = W * 0.12; x < W * 0.88; x += W * 0.045) { g.beginPath(); g.moveTo(x, hz); g.lineTo(x, hz - H * 0.1); g.arc(x + W * 0.0125, hz - H * 0.1, W * 0.0125, Math.PI, 0); g.lineTo(x + W * 0.025, hz); g.fill(); }
  // fenêtres qui s'allument
  for (let i = 0; i < 14; i++) {
    const on = e > 0.3 + (i % 5) * 0.1;
    if (!on) continue;
    g.fillStyle = `rgba(255,${190 + (i % 3) * 15},110,${0.6 + Math.sin(t * 7 + i) * 0.15})`;
    g.fillRect(W * (0.13 + i * 0.055), hz - H * 0.22, W * 0.015, H * 0.03);
  }
  const road = g.createLinearGradient(0, hz, 0, H); road.addColorStop(0, lerpC('#9a6040', '#3a2220', e)); road.addColorStop(1, lerpC('#6e4028', '#1c1012', e));
  g.fillStyle = road; g.fillRect(0, hz, W, H - hz);
  // lampes à pétrole des vendeuses de nuit
  for (let i = 0; i < 5; i++) {
    const x = W * (0.08 + i * 0.21), y = hz + H * 0.08 + (i % 2) * H * 0.04;
    const a = clamp(e * 1.6 - i * 0.08, 0, 1);
    if (a <= 0) continue;
    const lg = g.createRadialGradient(x, y, 0, x, y, H * 0.1); lg.addColorStop(0, `rgba(255,200,110,${0.55 * a})`); lg.addColorStop(1, 'rgba(255,200,110,0)');
    g.fillStyle = lg; g.beginPath(); g.arc(x, y, H * 0.1, 0, TAU); g.fill();
    g.fillStyle = `rgba(255,236,180,${a})`; g.beginPath(); g.arc(x, y, 2.5 + Math.sin(t * 9 + i) * 0.6, 0, TAU); g.fill();
    g.fillStyle = 'rgba(20,10,6,.8)'; g.fillRect(x - W * 0.03, y + 4, W * 0.06, 4);
  }
  // elle rentre, la bassine plus légère
  const fx = W * (0.85 - k * 0.5), fh = Math.min(H * 0.26, W * 0.34);
  drawFigure(g, fx, H * 0.74, fh, self, { walk: t * 5.5, dir: -1, load: '#c9ced3', t, alpha: 1 });
  g.fillStyle = `rgba(30,10,30,${e * 0.25})`; g.fillRect(0, 0, W, H);
  letterbox(g, W, H, t);
}
