// Générateur de motifs wax : chaque motif est une tuile raccordable dessinée sur un canvas.
// Effets du vrai wax : léger décalage de l'impression de la couleur d'accent et « craquelures »
// laissées par la cire (fines veines plus sombres).

import { mulberry32 } from './util.js';

const TAU = Math.PI * 2;

// dessine `fn` à la position (x, y) et à ses répliques de bord, pour une tuile sans couture
function wrap(g, S, x, y, r, fn) {
  for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
    const px = x + dx, py = y + dy;
    if (px + r < 0 || px - r > S || py + r < 0 || py - r > S) continue;
    g.save(); g.translate(px, py); fn(g); g.restore();
  }
}

// grille décalée de positions (quinconce)
function grid(S, n, stagger = true) {
  const pts = [], step = S / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    pts.push([(i + 0.5 + (stagger && j % 2 ? 0.5 : 0)) * step, (j + 0.5) * step]);
  }
  return pts;
}

/* ------------------------------------------------------------ motifs */
const MOTIFS = {
  // « L'œil de ma rivale » : anneaux concentriques et pupille
  oeil(g, S, c, rnd) {
    for (const [x, y] of grid(S, 3)) wrap(g, S, x, y, S / 6, (g) => {
      const R = S / 7.2;
      g.fillStyle = c.fg; g.beginPath(); g.ellipse(0, 0, R * 1.35, R, 0, 0, TAU); g.fill();
      g.fillStyle = c.bg; g.beginPath(); g.ellipse(0, 0, R * 1.05, R * 0.72, 0, 0, TAU); g.fill();
      g.fillStyle = c.ac; g.beginPath(); g.arc(0, 0, R * 0.5, 0, TAU); g.fill();
      g.fillStyle = c.fg; g.beginPath(); g.arc(0, 0, R * 0.22, 0, TAU); g.fill();
      g.strokeStyle = c.fg; g.lineWidth = S / 90;
      for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(k * R * 0.32, -R * 1.02); g.lineTo(k * R * 0.42, -R * 1.35); g.stroke(); }
    });
  },
  // « Hirondelles »
  hirondelles(g, S, c, rnd) {
    for (const [x, y] of grid(S, 4)) wrap(g, S, x, y, S / 7, (g) => {
      const a = S / 13;
      g.rotate(-0.35 + rnd() * 0.2);
      g.fillStyle = c.fg;
      g.beginPath();
      g.moveTo(-a * 1.6, -a * 0.2); g.quadraticCurveTo(-a * 0.6, -a * 0.9, 0, -a * 0.1);
      g.quadraticCurveTo(a * 0.6, -a * 0.9, a * 1.6, -a * 0.2); g.quadraticCurveTo(a * 0.6, -a * 0.2, a * 0.2, a * 0.35);
      g.lineTo(a * 0.55, a * 1.1); g.lineTo(0, a * 0.6); g.lineTo(-a * 0.55, a * 1.1); g.lineTo(-a * 0.2, a * 0.35);
      g.quadraticCurveTo(-a * 0.6, -a * 0.2, -a * 1.6, -a * 0.2); g.fill();
      g.fillStyle = c.ac; g.beginPath(); g.arc(0, -a * 0.05, a * 0.22, 0, TAU); g.fill();
    });
  },
  // « Les bulles »
  bulles(g, S, c, rnd) {
    for (let k = 0; k < 14; k++) {
      const x = rnd() * S, y = rnd() * S, r = S * (0.03 + rnd() * 0.08);
      wrap(g, S, x, y, r, (g) => {
        g.fillStyle = k % 3 ? c.fg : c.ac; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
        g.fillStyle = c.bg; g.beginPath(); g.arc(-r * 0.25, -r * 0.25, r * 0.42, 0, TAU); g.fill();
      });
    }
  },
  // losanges imbriqués
  losanges(g, S, c) {
    for (const [x, y] of grid(S, 3, true)) wrap(g, S, x, y, S / 5, (g) => {
      const a = S / 6.5;
      for (const [k, col] of [[1, c.fg], [0.68, c.bg], [0.42, c.ac], [0.16, c.fg]]) {
        g.fillStyle = col; g.beginPath(); g.moveTo(0, -a * k); g.lineTo(a * k * 0.8, 0); g.lineTo(0, a * k); g.lineTo(-a * k * 0.8, 0); g.closePath(); g.fill();
      }
    });
  },
  // « L'éventail »
  eventail(g, S, c) {
    for (const [x, y] of grid(S, 3)) wrap(g, S, x, y, S / 5, (g) => {
      const R = S / 6;
      g.fillStyle = c.fg; g.beginPath(); g.moveTo(0, R * 0.4); g.arc(0, R * 0.4, R, Math.PI * 1.05, Math.PI * 1.95); g.closePath(); g.fill();
      g.strokeStyle = c.bg; g.lineWidth = S / 70;
      for (let k = 0; k <= 6; k++) { const a = Math.PI * (1.08 + k * 0.14); g.beginPath(); g.moveTo(0, R * 0.4); g.lineTo(Math.cos(a) * R, R * 0.4 + Math.sin(a) * R); g.stroke(); }
      g.fillStyle = c.ac; g.beginPath(); g.arc(0, R * 0.4, R * 0.2, 0, TAU); g.fill();
    });
  },
  // feuilles de manioc
  feuilles(g, S, c, rnd) {
    for (const [x, y] of grid(S, 3)) wrap(g, S, x, y, S / 5, (g) => {
      g.rotate(rnd() * TAU);
      const L = S / 7;
      for (let k = 0; k < 5; k++) {
        g.save(); g.rotate((k - 2) * 0.55);
        g.fillStyle = k % 2 ? c.fg : c.ac;
        g.beginPath(); g.ellipse(0, -L * 0.6, L * 0.16, L * 0.62, 0, 0, TAU); g.fill();
        g.restore();
      }
      g.strokeStyle = c.fg; g.lineWidth = S / 80; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, L * 0.5); g.stroke();
    });
  },
  // escargots (spirales)
  escargot(g, S, c) {
    for (const [x, y] of grid(S, 3)) wrap(g, S, x, y, S / 5, (g) => {
      g.strokeStyle = c.fg; g.lineWidth = S / 34; g.lineCap = 'round';
      g.beginPath();
      for (let t = 0; t < 14; t += 0.2) { const r = t * S / 120; const px = Math.cos(t) * r, py = Math.sin(t) * r; t ? g.lineTo(px, py) : g.moveTo(px, py); }
      g.stroke();
      g.fillStyle = c.ac; g.beginPath(); g.arc(0, 0, S / 40, 0, TAU); g.fill();
    });
  },
  // cauris
  cauris(g, S, c, rnd) {
    for (const [x, y] of grid(S, 4)) wrap(g, S, x, y, S / 8, (g) => {
      g.rotate(rnd() * TAU);
      const a = S / 16;
      g.fillStyle = c.fg; g.beginPath(); g.ellipse(0, 0, a * 0.75, a * 1.15, 0, 0, TAU); g.fill();
      g.fillStyle = c.ac; g.beginPath(); g.ellipse(0, 0, a * 0.55, a * 0.95, 0, 0, TAU); g.fill();
      g.strokeStyle = c.fg; g.lineWidth = S / 90;
      g.beginPath(); g.moveTo(0, -a * 0.8); g.lineTo(0, a * 0.8); g.stroke();
      for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(-a * 0.14, k * a * 0.22); g.lineTo(a * 0.14, k * a * 0.22); g.stroke(); }
    });
  },
  // chevrons
  zigzag(g, S, c) {
    const n = 6, h = S / n;
    for (let j = 0; j < n; j++) {
      g.strokeStyle = j % 2 ? c.ac : c.fg; g.lineWidth = h * 0.36; g.lineJoin = 'miter';
      g.beginPath();
      for (let i = 0; i <= 8; i++) { const x = i * S / 8, y = j * h + (i % 2 ? h * 0.35 : -h * 0.05) + h * 0.3; i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    }
  },
  // « Le disque » (33 tours)
  disques(g, S, c) {
    for (const [x, y] of grid(S, 2)) wrap(g, S, x, y, S / 3.5, (g) => {
      const R = S / 4.6;
      g.fillStyle = c.fg; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
      g.strokeStyle = c.bg; g.lineWidth = S / 160;
      for (let k = 0.45; k < 1; k += 0.11) { g.beginPath(); g.arc(0, 0, R * k, 0, TAU); g.stroke(); }
      g.fillStyle = c.ac; g.beginPath(); g.arc(0, 0, R * 0.32, 0, TAU); g.fill();
      g.fillStyle = c.bg; g.beginPath(); g.arc(0, 0, R * 0.06, 0, TAU); g.fill();
    });
  },
  // « Les clés de la maison »
  cles(g, S, c, rnd) {
    for (const [x, y] of grid(S, 3)) wrap(g, S, x, y, S / 5, (g) => {
      g.rotate(-0.7 + rnd() * 0.3);
      const a = S / 18;
      g.strokeStyle = c.fg; g.lineWidth = a * 0.45;
      g.beginPath(); g.arc(-a * 1.6, 0, a * 0.8, 0, TAU); g.stroke();
      g.beginPath(); g.moveTo(-a * 0.8, 0); g.lineTo(a * 2, 0); g.lineTo(a * 2, a * 0.8); g.moveTo(a * 1.2, 0); g.lineTo(a * 1.2, a * 0.6); g.stroke();
      g.fillStyle = c.ac; g.beginPath(); g.arc(-a * 1.6, 0, a * 0.35, 0, TAU); g.fill();
    });
  },
  // fleurs à six pétales
  fleurs(g, S, c) {
    for (const [x, y] of grid(S, 3)) wrap(g, S, x, y, S / 5, (g) => {
      const R = S / 11;
      for (let k = 0; k < 6; k++) { g.save(); g.rotate(k * TAU / 6); g.fillStyle = c.fg; g.beginPath(); g.ellipse(0, -R, R * 0.45, R * 0.85, 0, 0, TAU); g.fill(); g.restore(); }
      g.fillStyle = c.ac; g.beginPath(); g.arc(0, 0, R * 0.55, 0, TAU); g.fill();
      g.fillStyle = c.bg; g.beginPath(); g.arc(0, 0, R * 0.2, 0, TAU); g.fill();
    });
  },
  // « Si tu sors, je sors » : oiseaux qui sortent d'une cage
  cage(g, S, c) {
    for (const [x, y] of grid(S, 2)) wrap(g, S, x, y, S / 3.6, (g) => {
      const a = S / 9;
      g.strokeStyle = c.fg; g.lineWidth = S / 70;
      g.beginPath(); g.moveTo(-a, a); g.lineTo(-a, -a * 0.2); g.quadraticCurveTo(0, -a * 1.5, a, -a * 0.2); g.lineTo(a, a); g.closePath(); g.stroke();
      for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(k * a * 0.4, a); g.lineTo(k * a * 0.4, -a * 0.55 + Math.abs(k) * a * 0.15); g.stroke(); }
      g.fillStyle = c.ac;
      for (const [bx, by] of [[a * 1.5, -a * 0.9], [a * 2.1, -a * 0.2]]) { g.beginPath(); g.ellipse(bx, by, a * 0.35, a * 0.2, -0.4, 0, TAU); g.fill(); }
    });
  },
  // ampoules
  ampoules(g, S, c, rnd) {
    for (const [x, y] of grid(S, 3)) wrap(g, S, x, y, S / 5, (g) => {
      g.rotate(rnd() * 0.6 - 0.3);
      const a = S / 14;
      g.fillStyle = c.ac; g.beginPath(); g.arc(0, -a * 0.3, a, 0, TAU); g.fill();
      g.fillStyle = c.fg; g.fillRect(-a * 0.45, a * 0.55, a * 0.9, a * 0.7);
      g.strokeStyle = c.fg; g.lineWidth = S / 120;
      for (let k = 0; k < 8; k++) { const t = k * TAU / 8; g.beginPath(); g.moveTo(Math.cos(t) * a * 1.25, -a * 0.3 + Math.sin(t) * a * 1.25); g.lineTo(Math.cos(t) * a * 1.6, -a * 0.3 + Math.sin(t) * a * 1.6); g.stroke(); }
    });
  },
  // tambours (djembé vu de dessus)
  tambours(g, S, c) {
    for (const [x, y] of grid(S, 3)) wrap(g, S, x, y, S / 5, (g) => {
      const R = S / 8;
      g.fillStyle = c.fg; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
      g.fillStyle = c.ac; g.beginPath(); g.arc(0, 0, R * 0.78, 0, TAU); g.fill();
      g.fillStyle = c.fg;
      for (let k = 0; k < 10; k++) { const t = k * TAU / 10; g.beginPath(); g.arc(Math.cos(t) * R * 0.9, Math.sin(t) * R * 0.9, R * 0.08, 0, TAU); g.fill(); }
    });
  },
  // bandes kente
  kente(g, S, c) {
    const n = 8, w = S / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = i % 2 ? c.ac : c.fg; g.fillRect(i * w, 0, w * 0.5, S);
      for (let j = 0; j < n; j++) if ((i + j) % 2) { g.fillStyle = c.bg; g.fillRect(i * w + w * 0.5, j * w + w * 0.3, w * 0.5, w * 0.4); }
    }
  },
};
export const MOTIF_NAMES = Object.keys(MOTIFS);

/* ------------------------------------------------------------ tuiles */
const cache = new Map();

// spec : { motif, bg, fg, ac, seed, scale }
export function waxTile(spec, S = 160) {
  const key = `${spec.motif}|${spec.bg}|${spec.fg}|${spec.ac}|${spec.seed}|${S}`;
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const rnd = mulberry32(spec.seed || 1);
  g.fillStyle = spec.bg; g.fillRect(0, 0, S, S);
  // fond légèrement marbré
  for (let k = 0; k < 30; k++) {
    g.fillStyle = `rgba(0,0,0,${0.015 + rnd() * 0.03})`;
    const x = rnd() * S, y = rnd() * S, r = S * (0.05 + rnd() * 0.2);
    wrap(g, S, x, y, r, (g) => { g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); });
  }
  const c = { bg: spec.bg, fg: spec.fg, ac: spec.ac };
  (MOTIFS[spec.motif] || MOTIFS.bulles)(g, S, c, rnd);
  // craquelures de la cire : fines veines sombres
  g.strokeStyle = 'rgba(20,12,8,0.18)';
  g.lineWidth = Math.max(0.6, S / 260);
  for (let k = 0; k < 9; k++) {
    let x = rnd() * S, y = rnd() * S;
    g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 7; s++) { x += (rnd() - 0.5) * S * 0.12; y += (rnd() - 0.5) * S * 0.12; g.lineTo(x, y); }
    g.stroke();
  }
  cache.set(key, cv);
  return cv;
}

// motif utilisable comme `fillStyle` dans un contexte 2D
export function waxPattern(g, spec, S = 160, scale = 1) {
  const p = g.createPattern(waxTile(spec, S), 'repeat');
  if (scale !== 1 && p.setTransform) p.setTransform(new DOMMatrix().scale(scale));
  return p;
}

// image CSS (data URL) pour les éléments d'interface
const urlCache = new Map();
export function waxURL(spec, S = 120) {
  const key = JSON.stringify(spec) + S;
  if (!urlCache.has(key)) urlCache.set(key, waxTile(spec, S).toDataURL('image/png'));
  return urlCache.get(key);
}
