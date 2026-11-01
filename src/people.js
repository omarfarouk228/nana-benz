// Personnages dessinés en 2D : portraits (marchandage) et silhouettes en pied (marché).
import { waxPattern } from './wax.js';
import { CATALOG } from './data.js';
import { mulberry32 } from './util.js';

const TAU = Math.PI * 2;
export const SKINS = ['#5a3420', '#6e4229', '#7f4e33', '#8f5c3c', '#4a2a19'];
const DARK = '#1c120c';

// foulard et pagne : deux motifs du catalogue choisis par la graine du personnage
export function outfit(look) {
  const rng = mulberry32(look.seed || 1);
  const a = CATALOG[Math.floor(rng() * CATALOG.length)];
  const b = CATALOG[Math.floor(rng() * CATALOG.length)];
  return { wrap: a.spec, dress: b.spec, earring: rng() < 0.6, beads: rng() < 0.5 };
}

/* ------------------------------------------------------------ portrait (buste) */
// mood : 0 fâchée … 1 ravie ; talk : bouche entrouverte
export function drawPortrait(g, W, H, look, { mood = 0.6, talk = 0, man = false, blink = false, t = 0 } = {}) {
  const o = outfit(look);
  const skin = SKINS[look.skin % SKINS.length];
  g.clearRect(0, 0, W, H);
  const cx = W / 2, s = Math.min(W, H) / 300;
  g.save();
  g.translate(cx, H * 0.56 + Math.sin(t * 1.6) * 2 * s);
  // épaules et vêtement
  g.fillStyle = waxPattern(g, o.dress, 120, 0.8 * s);
  g.beginPath();
  g.moveTo(-130 * s, 140 * s); g.quadraticCurveTo(-120 * s, 55 * s, -55 * s, 40 * s);
  g.lineTo(55 * s, 40 * s); g.quadraticCurveTo(120 * s, 55 * s, 130 * s, 140 * s); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2 * s; g.stroke();
  // cou
  g.fillStyle = skin;
  g.beginPath(); g.moveTo(-22 * s, 0); g.lineTo(22 * s, 0); g.lineTo(26 * s, 48 * s); g.quadraticCurveTo(0, 62 * s, -26 * s, 48 * s); g.closePath(); g.fill();
  // encolure
  g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(0, 46 * s, 34 * s, 10 * s, 0, 0, Math.PI); g.fill();
  if (o.beads && !man) {
    for (let k = -6; k <= 6; k++) { g.fillStyle = k % 2 ? '#e0a526' : '#c0392b'; g.beginPath(); g.arc(k * 4.6 * s, 42 * s + Math.abs(k) * k * 0.05 * s + (k * k) * 0.18 * s, 3.2 * s, 0, TAU); g.fill(); }
  }
  // tête
  g.fillStyle = skin;
  g.beginPath(); g.ellipse(0, -48 * s, 50 * s, 62 * s, 0, 0, TAU); g.fill();
  // oreilles
  for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(sd * 49 * s, -42 * s, 9 * s, 14 * s, 0, 0, TAU); g.fill(); }
  if (o.earring && !man) for (const sd of [-1, 1]) { g.fillStyle = '#e0a526'; g.beginPath(); g.arc(sd * 50 * s, -24 * s, 5 * s, 0, TAU); g.fill(); }
  // ombre de joue
  g.fillStyle = 'rgba(0,0,0,.12)'; g.beginPath(); g.ellipse(18 * s, -30 * s, 26 * s, 34 * s, 0, 0, TAU); g.fill();
  // yeux
  const eyeY = -52 * s;
  for (const sd of [-1, 1]) {
    g.fillStyle = '#f4ece0';
    g.beginPath(); g.ellipse(sd * 19 * s, eyeY, 10 * s, blink ? 1.2 * s : 6.5 * s, 0, 0, TAU); g.fill();
    if (!blink) { g.fillStyle = DARK; g.beginPath(); g.arc(sd * 19 * s + 1.5 * s, eyeY + 0.5 * s, 4.2 * s, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(sd * 19 * s + 3 * s, eyeY - 1.5 * s, 1.2 * s, 0, TAU); g.fill(); }
    // sourcils : froncés quand elle est fâchée
    const ang = (0.5 - mood) * 0.55 * sd;
    g.strokeStyle = DARK; g.lineWidth = 3.5 * s; g.lineCap = 'round';
    g.beginPath(); g.moveTo(sd * 8 * s, eyeY - 13 * s - ang * 8 * s); g.lineTo(sd * 30 * s, eyeY - 14 * s + ang * 8 * s); g.stroke();
  }
  // nez
  g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(0, -30 * s, 12 * s, 7 * s, 0, 0, TAU); g.fill();
  // bouche
  const my = -8 * s, curve = (mood - 0.5) * 16 * s;
  g.fillStyle = '#9a4436';
  g.beginPath();
  g.moveTo(-17 * s, my - curve * 0.2);
  g.quadraticCurveTo(0, my + curve + talk * 8 * s, 17 * s, my - curve * 0.2);
  g.quadraticCurveTo(0, my + curve * 0.3 + 3 * s + talk * 14 * s, -17 * s, my - curve * 0.2);
  g.fill();
  g.strokeStyle = '#3a0f0c'; g.lineWidth = 2 * s; g.stroke();
  // cheveux / foulard
  if (man) {
    g.fillStyle = DARK; g.beginPath(); g.ellipse(0, -95 * s, 50 * s, 26 * s, 0, Math.PI, TAU); g.fill();
    g.fillStyle = waxPattern(g, o.wrap, 120, 0.6 * s);
    g.beginPath(); g.ellipse(0, -100 * s, 48 * s, 18 * s, 0, Math.PI, TAU); g.fill(); // calotte
  } else {
    g.fillStyle = waxPattern(g, o.wrap, 120, 0.7 * s);
    g.beginPath();
    g.moveTo(-56 * s, -62 * s);
    g.bezierCurveTo(-78 * s, -150 * s, 80 * s, -168 * s, 60 * s, -62 * s);
    g.quadraticCurveTo(0, -84 * s, -56 * s, -62 * s);
    g.fill();
    // nœud du foulard (gélé) en éventail
    const style = look.style % 3;
    g.beginPath();
    if (style === 0) { g.ellipse(30 * s, -140 * s, 46 * s, 24 * s, -0.5, 0, TAU); g.ellipse(-26 * s, -142 * s, 40 * s, 20 * s, 0.6, 0, TAU); }
    else if (style === 1) { g.moveTo(-10 * s, -120 * s); g.lineTo(60 * s, -190 * s); g.lineTo(80 * s, -120 * s); g.closePath(); }
    else { g.ellipse(0, -150 * s, 62 * s, 22 * s, 0, 0, TAU); }
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 2 * s; g.stroke();
  }
  g.restore();
}

/* ------------------------------------------------------------ silhouette en pied (marché) */
// h : hauteur en pixels ; walk : phase de marche ; dir : 1 vers la droite, -1 vers la gauche
export function drawFigure(g, x, y, h, look, { walk = 0, dir = 1, man = false, load = null, alpha = 1 } = {}) {
  const o = outfit(look);
  const skin = SKINS[look.skin % SKINS.length];
  const u = h / 100;
  const bob = Math.abs(Math.sin(walk)) * 1.5 * u;
  g.save();
  g.globalAlpha = alpha;
  g.translate(x, y - bob);
  g.scale(dir, 1);
  // ombre au sol
  g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(0, bob, 16 * u, 4 * u, 0, 0, TAU); g.fill();
  // jambes / pieds
  const sw = Math.sin(walk) * 7 * u;
  g.fillStyle = skin;
  g.fillRect(-6 * u + sw * 0.6, -14 * u, 5 * u, 14 * u);
  g.fillRect(1 * u - sw * 0.6, -14 * u, 5 * u, 14 * u);
  g.fillStyle = DARK;
  g.fillRect(-7 * u + sw * 0.6, -2 * u, 8 * u, 2.5 * u);
  g.fillRect(0 * u - sw * 0.6, -2 * u, 8 * u, 2.5 * u);
  // pagne (ou pantalon et chemise pour un homme)
  g.fillStyle = waxPattern(g, man ? o.wrap : o.dress, 120, 0.35 * u);
  if (man) {
    g.fillStyle = '#e9e2cf'; g.fillRect(-12 * u, -60 * u, 24 * u, 46 * u);
    g.fillStyle = waxPattern(g, o.wrap, 120, 0.35 * u); g.fillRect(-12 * u, -60 * u, 24 * u, 30 * u);
  } else {
    g.beginPath(); g.moveTo(-13 * u, -58 * u); g.lineTo(13 * u, -58 * u); g.lineTo(15 * u, -12 * u); g.lineTo(-15 * u, -12 * u); g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(-14 * u, -36 * u, 28 * u, 2 * u);
  }
  // bras
  g.fillStyle = skin;
  const arm = Math.sin(walk) * 6 * u;
  if (load) {
    g.fillRect(10 * u, -82 * u, 4 * u, 26 * u); // bras levé pour tenir la charge
  } else {
    g.save(); g.translate(12 * u, -56 * u); g.rotate(-arm * 0.02); g.fillRect(-2 * u, 0, 4.5 * u, 24 * u); g.restore();
  }
  g.save(); g.translate(-12 * u, -56 * u); g.rotate(arm * 0.02); g.fillRect(-2.5 * u, 0, 4.5 * u, 24 * u); g.restore();
  // tête
  g.fillStyle = skin; g.beginPath(); g.ellipse(0, -68 * u, 7.5 * u, 9 * u, 0, 0, TAU); g.fill();
  if (man) { g.fillStyle = DARK; g.beginPath(); g.ellipse(0, -75 * u, 7.5 * u, 4 * u, 0, Math.PI, TAU); g.fill(); }
  else {
    g.fillStyle = waxPattern(g, o.wrap, 120, 0.3 * u);
    g.beginPath(); g.ellipse(0, -77 * u, 11 * u, 7 * u, 0, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(4 * u, -83 * u, 9 * u, 4.5 * u, -0.5, 0, TAU); g.fill();
  }
  // charge sur la tête (bassine)
  if (load) {
    g.fillStyle = load;
    g.beginPath(); g.ellipse(0, -86 * u, 16 * u, 4 * u, 0, 0, TAU); g.fill();
    g.fillRect(-13 * u, -92 * u, 26 * u, 6 * u);
  }
  g.restore();
}
