// Personnages dessinés en 2D : portraits détaillés (marchandage), mains, et silhouettes en pied (marché).
// Tout est tracé au canvas : volumes par dégradés, plis des tissus, traits du visage qui réagissent.
import { waxPattern } from './wax.js';
import { CATALOG } from './data.js';
import { mulberry32, clamp } from './util.js';

const TAU = Math.PI * 2;
export const SKINS = ['#5b3a26', '#6b432d', '#7b5036', '#8b5d3e', '#4a2d1d'];
const TOURIST_SKINS = ['#e6c0a2', '#efcfb6', '#d9ab8a'];
const INK = '#160e09';

/* ------------------------------------------------------------ couleurs */
function rgb(h) {
  if (h[0] === '#') { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  return h.match(/\d+/g).slice(0, 3).map(Number);
}
const tcache = new Map();
// f > 0 éclaircit, f < 0 assombrit
export function tone(h, f) {
  const k = h + f;
  if (tcache.has(k)) return tcache.get(k);
  const [r, g, b] = rgb(h), m = f >= 0 ? 255 : 0, a = Math.abs(f);
  const out = `rgb(${Math.round(r + (m - r) * a)},${Math.round(g + (m - g) * a)},${Math.round(b + (m - b) * a)})`;
  tcache.set(k, out);
  return out;
}
function blend(a, b, t) {
  const A = rgb(a), B = rgb(b);
  return `rgb(${A.map((v, i) => Math.round(v * (1 - t) + B[i] * t)).join(',')})`;
}

/* ------------------------------------------------------------ traits d'un personnage */
// look : { skin, style, seed, kind? } ; kind est le profil de cliente (fidele, touriste, etudiante…)
const tr = new Map();
export function traits(look, man = false) {
  const key = `${look.seed}|${look.kind || ''}|${man ? 1 : 0}|${look.skin}|${look.style}`;
  if (tr.has(key)) return tr.get(key);
  const rng = mulberry32((look.seed || 1) ^ 0x5bd1e995);
  const kind = look.kind || '';
  const pick = (a) => a[Math.floor(rng() * a.length)];
  const tourist = kind === 'touriste' || kind === 'epouse';
  const age = look.age ?? (kind === 'fidele' ? 2 : kind === 'etudiante' ? 0 : kind === 'fiancee' || kind === 'chorale' ? 1 : rng() < 0.3 ? 0 : rng() < 0.82 ? 1 : 2);
  let a = CATALOG[Math.floor(rng() * CATALOG.length)], b = CATALOG[Math.floor(rng() * CATALOG.length)];
  // une famille en deuil porte du sombre : noir, rouge sombre, blanc
  if (kind === 'funerailles') { a = { spec: { ...a.spec, bg: '#16120f', fg: '#8e2a1d', ac: '#f4efe4' } }; b = { spec: { ...b.spec, bg: '#1d1714', fg: '#f4efe4', ac: '#5c1a14' } }; }
  const skin = tourist ? pick(TOURIST_SKINS) : SKINS[(look.skin ?? 0) % SKINS.length];
  let hair = 'wrap';
  if (man) hair = 'short';
  else if (kind === 'enfant') hair = rng() < 0.5 ? 'threads' : 'afro';
  else if (tourist) hair = 'loose';
  else if (kind === 'etudiante' || (age === 0 && !kind && rng() < 0.45)) hair = rng() < 0.55 ? 'threads' : 'afro';
  const T = {
    kind, man, age, tourist, skin, hair,
    wrap: a.spec, dress: b.spec,
    hairCol: tourist ? pick(['#5e3f24', '#a2733c', '#d4ad66', '#33251a']) : age === 2 ? '#bdb6aa' : '#120c08',
    eyeCol: tourist ? pick(['#4e7aa3', '#5d7c4b', '#6b4a2e']) : '#2e1a0f',
    fw: 1.02 + rng() * 0.1, // largeur du visage
    nw: tourist ? 0.72 : 1 + rng() * 0.18, // largeur du nez
    lip: tourist ? 0.8 : 1 + rng() * 0.15,
    glasses: (age === 2 && rng() < 0.5) || (kind === 'fonctionnaire' && rng() < 0.2) || (kind === 'institutrice' && rng() < 0.6) || (man && rng() < 0.15),
    earring: !man && rng() < 0.8, hoops: !man && age === 0 && rng() < 0.6,
    beads: !man && !tourist && (kind === 'fiancee' || rng() < 0.45),
    moustache: man && rng() < 0.65, cap: man && rng() < 0.5,
    smock: kind === 'ghaneen' || kind === 'planteur' || (man && rng() < 0.2),
    hat: tourist && rng() < 0.55, camera: kind === 'touriste',
    style: (look.style ?? 0) % 3,
    lean: rng() * 0.6 - 0.3,
    bangles: !man && rng() < 0.7,
  };
  tr.set(key, T);
  return T;
}
// compatibilité : les deux motifs d'un personnage
export function outfit(look) { const T = traits(look); return { wrap: T.wrap, dress: T.dress }; }

// remplit un tracé de wax, puis ajoute le volume (lumière en haut à gauche, ombre de l'autre côté)
function waxFill(g, path, spec, sc, x0, y0, x1, y1, dark = 0.34) {
  g.fillStyle = waxPattern(g, spec, 120, sc);
  g.fill(path);
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  gr.addColorStop(0, 'rgba(255,248,230,.16)');
  gr.addColorStop(0.45, 'rgba(0,0,0,0)');
  gr.addColorStop(1, `rgba(0,0,0,${dark})`);
  g.fillStyle = gr; g.fill(path);
}
// tissu à rayures (fugu, la blouse tissée du Nord du Ghana)
let fuguCv = null;
function fuguPattern(g) {
  if (!fuguCv) {
    fuguCv = document.createElement('canvas'); fuguCv.width = 24; fuguCv.height = 8;
    const c = fuguCv.getContext('2d');
    const cols = ['#1f2c55', '#e9e2cf', '#1f2c55', '#8b2c24', '#1f2c55', '#e9e2cf'];
    cols.forEach((col, i) => { c.fillStyle = col; c.fillRect(i * 4, 0, 4, 8); });
    c.fillStyle = 'rgba(255,255,255,.12)'; for (let y = 0; y < 8; y += 2) c.fillRect(0, y, 24, 1);
  }
  return g.createPattern(fuguCv, 'repeat');
}

/* ============================================================ PORTRAIT (buste) */
// Repère : centre de la tête vers (0,-50), menton à y = 17, épaules jusqu'à y = 160. 1 unité ≈ 1/300 du cadre.
// opts : mood 0 fâchée … 1 ravie ; talk 0…1 ; turn −1…1 (tête tournée) ; nod (hochement) ; gaze {x,y} ;
// place {x, y, s} pour poser le buste dans une scène sans effacer le canvas.
export function drawPortrait(g, W, H, look, opts = {}) {
  const { mood = 0.6, talk = 0, man = false, blink = false, t = 0, turn = 0, nod = 0, gaze = null, place = null, breath = 1 } = opts;
  const T = traits(look, man);
  if (!place) g.clearRect(0, 0, W, H);
  const s = place ? place.s : Math.min(W, H) / 300;
  g.save();
  g.translate(place ? place.x : W / 2, (place ? place.y : H * 0.56) + Math.sin(t * 1.6) * 1.2 * s * breath);
  g.scale(s, s);
  drawBody(g, T, t, breath);
  // la tête bouge un peu indépendamment du buste
  g.save();
  g.translate(turn * 6, nod * 5 + (T.age === 2 ? 4 : 0));
  g.rotate(turn * 0.05 + T.lean * 0.04 + Math.sin(t * 0.7) * 0.012);
  drawHead(g, T, { mood, talk, blink, turn, gaze, t });
  g.restore();
  g.restore();
}

function drawBody(g, T, t, breath) {
  const rise = Math.sin(t * 1.6) * 1.2 * breath;
  // cheveux longs derrière les épaules (touriste)
  if (T.hair === 'loose') {
    const P = new Path2D();
    P.moveTo(-52, -92); P.bezierCurveTo(-74, -40, -70, 20, -58, 52); P.lineTo(58, 52); P.bezierCurveTo(70, 20, 74, -40, 52, -92); P.closePath();
    g.fillStyle = tone(T.hairCol, -0.25); g.fill(P);
  }
  // cou
  const neck = new Path2D();
  neck.moveTo(-23, -12); neck.lineTo(23, -12); neck.bezierCurveTo(24, 20, 30, 40, 44, 52); neck.lineTo(-44, 52); neck.bezierCurveTo(-30, 40, -24, 20, -23, -12); neck.closePath();
  g.fillStyle = T.skin; g.fill(neck);
  let gr = g.createLinearGradient(0, -12, 0, 40);
  gr.addColorStop(0, 'rgba(0,0,0,.42)'); gr.addColorStop(0.45, 'rgba(0,0,0,.08)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fill(neck);
  gr = g.createLinearGradient(-40, 0, 40, 0);
  gr.addColorStop(0, 'rgba(0,0,0,.18)'); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.25)');
  g.fillStyle = gr; g.fill(neck);
  // clavicules
  g.strokeStyle = 'rgba(0,0,0,.14)'; g.lineWidth = 1.6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-34, 47); g.quadraticCurveTo(-18, 42, -6, 46); g.moveTo(34, 47); g.quadraticCurveTo(18, 42, 6, 46); g.stroke();
  if (!T.man && T.age >= 1) { // plis du cou (« colliers de Vénus »)
    g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(-20, 14); g.quadraticCurveTo(0, 19, 20, 14); g.moveTo(-21, 24); g.quadraticCurveTo(0, 29, 21, 24); g.stroke();
  }

  g.save(); g.translate(0, rise);
  if (T.man) {
    const P = new Path2D();
    P.moveTo(-160, 170); P.bezierCurveTo(-158, 90, -140, 62, -96, 50); P.bezierCurveTo(-70, 42, -46, 38, -30, 36);
    P.lineTo(0, 64); P.lineTo(30, 36); P.bezierCurveTo(46, 38, 70, 42, 96, 50); P.bezierCurveTo(140, 62, 158, 90, 160, 170); P.closePath();
    if (T.smock) {
      g.fillStyle = fuguPattern(g); g.fill(P);
      const gr2 = g.createLinearGradient(-160, 0, 160, 0); gr2.addColorStop(0, 'rgba(0,0,0,.35)'); gr2.addColorStop(0.5, 'rgba(0,0,0,0)'); gr2.addColorStop(1, 'rgba(0,0,0,.4)');
      g.fillStyle = gr2; g.fill(P);
      // encolure brodée
      g.strokeStyle = '#e0a526'; g.lineWidth = 3; g.setLineDash([4, 3]);
      g.beginPath(); g.moveTo(-30, 38); g.lineTo(0, 66); g.lineTo(30, 38); g.stroke(); g.setLineDash([]);
    } else {
      waxFill(g, P, T.wrap, 0.75, -160, 40, 160, 170);
      // col de chemise
      for (const sd of [-1, 1]) {
        const C = new Path2D();
        C.moveTo(sd * 30, 30); C.lineTo(sd * 4, 66); C.lineTo(sd * 22, 72); C.lineTo(sd * 46, 44); C.closePath();
        waxFill(g, C, T.wrap, 0.75, sd * 4, 30, sd * 46, 72, 0.45);
        g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.4; g.stroke(C);
      }
      g.fillStyle = '#efe8d8'; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(0, 84 + k * 26, 3, 0, TAU); g.fill(); }
    }
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-100, 110); g.quadraticCurveTo(-92, 140, -96, 170); g.moveTo(102, 108); g.quadraticCurveTo(94, 140, 98, 170); g.stroke();
  } else if (T.tourist) {
    const P = new Path2D();
    P.moveTo(-150, 170); P.bezierCurveTo(-148, 92, -128, 64, -88, 52); P.bezierCurveTo(-64, 44, -44, 42, -34, 42);
    P.quadraticCurveTo(0, 74, 34, 42); P.bezierCurveTo(44, 42, 64, 44, 88, 52); P.bezierCurveTo(128, 64, 148, 92, 150, 170); P.closePath();
    g.fillStyle = '#f1ece0'; g.fill(P);
    const gr2 = g.createLinearGradient(-150, 0, 150, 0); gr2.addColorStop(0, 'rgba(60,40,20,.25)'); gr2.addColorStop(0.5, 'rgba(0,0,0,0)'); gr2.addColorStop(1, 'rgba(60,40,20,.3)');
    g.fillStyle = gr2; g.fill(P);
    // bretelle et appareil photo
    if (T.camera) {
      g.strokeStyle = '#3a2a1e'; g.lineWidth = 4; g.beginPath(); g.moveTo(-40, 44); g.quadraticCurveTo(-30, 100, 10, 118); g.moveTo(40, 44); g.quadraticCurveTo(44, 90, 34, 118); g.stroke();
      g.fillStyle = '#1c1b1a'; roundRect(g, -6, 108, 54, 34, 5); g.fill();
      g.fillStyle = '#bfbab0'; g.fillRect(-6, 108, 54, 7);
      g.fillStyle = '#0b0b0b'; g.beginPath(); g.arc(21, 128, 11, 0, TAU); g.fill();
      g.fillStyle = 'rgba(160,190,230,.5)'; g.beginPath(); g.arc(18, 125, 4, 0, TAU); g.fill();
    }
  } else {
    // kaba à manches bouffantes, encolure ronde brodée
    for (const sd of [-1, 1]) {
      const Sl = new Path2D(); Sl.ellipse(sd * 112, 82, 46, 44, sd * 0.3, 0, TAU);
      waxFill(g, Sl, T.dress, 0.8, sd * 70, 40, sd * 150, 126, 0.45);
      g.strokeStyle = 'rgba(0,0,0,.16)'; g.lineWidth = 1.5;
      for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(sd * (96 + k * 14), 44); g.quadraticCurveTo(sd * (104 + k * 18), 82, sd * (98 + k * 14), 124); g.stroke(); }
    }
    const P = new Path2D();
    P.moveTo(-138, 170); P.bezierCurveTo(-130, 110, -110, 70, -78, 54); P.bezierCurveTo(-58, 44, -42, 42, -32, 40);
    P.quadraticCurveTo(0, 70, 32, 40); P.bezierCurveTo(42, 42, 58, 44, 78, 54); P.bezierCurveTo(110, 70, 130, 110, 138, 170); P.closePath();
    waxFill(g, P, T.dress, 0.8, -120, 40, 140, 170);
    // plis de poitrine
    g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-50, 100); g.quadraticCurveTo(-30, 118, -6, 112); g.moveTo(50, 100); g.quadraticCurveTo(30, 118, 6, 112); g.stroke();
    g.strokeStyle = 'rgba(255,240,210,.12)'; g.beginPath(); g.moveTo(-60, 90); g.quadraticCurveTo(-36, 104, -16, 100); g.stroke();
    // broderie de l'encolure
    g.strokeStyle = '#f2d27a'; g.lineWidth = 2.4; g.setLineDash([3, 3]);
    g.beginPath(); g.moveTo(-34, 44); g.quadraticCurveTo(0, 76, 34, 44); g.stroke(); g.setLineDash([]);
    g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-32, 41); g.quadraticCurveTo(0, 71, 32, 41); g.stroke();
  }
  g.restore();
  // perles de corail (plusieurs rangs) sur la peau
  if (T.beads) {
    for (let row = 0; row < (T.kind === 'fiancee' ? 3 : 1); row++) {
      const y0 = 30 + row * 8, rr = 26 + row * 6;
      for (let k = -8; k <= 8; k++) {
        const a = k / 8, x = a * rr, y = y0 + (1 - Math.cos(a * 1.2)) * 18 * 0 + a * a * 10;
        g.fillStyle = (k + row) % 4 === 0 ? '#e0a526' : '#b8322a';
        g.beginPath(); g.arc(x, y + rise * 0.5, 3.1, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(x - 1, y - 1 + rise * 0.5, 1, 0, TAU); g.fill();
      }
    }
  }
}

function drawHead(g, T, { mood, talk, blink, turn, gaze, t }) {
  const fw = T.fw, fx = turn * 7, skin = T.skin;
  const dark = tone(skin, -0.32), light = tone(skin, 0.16);

  // volume du foulard derrière la tête
  if (T.hair === 'wrap') drawWrapBack(g, T, turn);
  if (T.hair === 'afro') {
    g.fillStyle = T.hairCol;
    g.beginPath(); g.ellipse(0, -80, 70 * fw, 58, 0, 0, TAU); g.fill();
    const rr = mulberry32(7);
    for (let k = 0; k < 46; k++) { const a = (k / 46) * TAU; g.beginPath(); g.arc(Math.cos(a) * 68 * fw, -80 + Math.sin(a) * 56, 7 + rr() * 3, 0, TAU); g.fill(); }
  }
  if (T.hair === 'threads') drawThreads(g, T);

  // oreilles (côté opposé à la rotation un peu plus visible)
  for (const sd of [-1, 1]) {
    const ex = sd * 46 * fw - turn * 4;
    g.fillStyle = skin; g.beginPath(); g.ellipse(ex, -44, 8.5, 14, sd * 0.12, 0, TAU); g.fill();
    g.fillStyle = tone(skin, -0.22); g.beginPath(); g.ellipse(ex + sd * 1.5, -44, 4.5, 9, sd * 0.12, 0, TAU); g.fill();
    if (T.earring) {
      if (T.hoops) { g.strokeStyle = '#d9a22a'; g.lineWidth = 2.2; g.beginPath(); g.arc(ex, -22, 7, 0, TAU); g.stroke(); }
      else {
        g.fillStyle = '#e0a526'; g.beginPath(); g.arc(ex, -31, 3.2, 0, TAU); g.fill();
        g.beginPath(); g.moveTo(ex - 3.5, -27); g.quadraticCurveTo(ex, -14, ex + 3.5, -27); g.fill();
        g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.arc(ex - 1, -32, 1, 0, TAU); g.fill();
      }
    }
  }

  // visage
  const F = new Path2D();
  F.moveTo(-45 * fw, -72);
  F.bezierCurveTo(-47 * fw, -118, 47 * fw, -118, 45 * fw, -72);
  F.bezierCurveTo(47 * fw, -46, 44 * fw, -22, 32 * fw, -4);
  F.bezierCurveTo(22 * fw, 10, 11, 17, 0, 17);
  F.bezierCurveTo(-11, 17, -22 * fw, 10, -32 * fw, -4);
  F.bezierCurveTo(-44 * fw, -22, -47 * fw, -46, -45 * fw, -72);
  let gr = g.createRadialGradient(-12 + fx, -62, 4, fx * 0.5, -44, 80);
  gr.addColorStop(0, light); gr.addColorStop(0.55, skin); gr.addColorStop(1, dark);
  g.fillStyle = gr; g.fill(F);
  gr = g.createLinearGradient(-50, 0, 50, 0);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.6 - turn * 0.15, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.2)');
  g.fillStyle = gr; g.fill(F);
  // pommettes et reflets
  for (const sd of [-1, 1]) {
    gr = g.createRadialGradient(fx + sd * 27, -36, 1, fx + sd * 27, -36, 16);
    gr.addColorStop(0, sd < 0 ? 'rgba(255,235,210,.16)' : 'rgba(255,235,210,.08)'); gr.addColorStop(1, 'rgba(255,235,210,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(fx + sd * 27, -36, 16, 0, TAU); g.fill();
    if (T.tourist) { g.fillStyle = 'rgba(220,90,80,.1)'; g.beginPath(); g.arc(fx + sd * 26, -30, 11, 0, TAU); g.fill(); }
  }
  g.fillStyle = 'rgba(255,240,220,.08)'; g.beginPath(); g.ellipse(fx * 0.7, 9, 10, 4, 0, 0, TAU); g.fill();

  // cheveux visibles sous le foulard, ou coiffure
  if (T.hair === 'wrap') {
    g.fillStyle = T.hairCol;
    for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * 46 * fw, -72); g.quadraticCurveTo(sd * 44 * fw, -60, sd * 40 * fw, -56); g.quadraticCurveTo(sd * 41 * fw, -66, sd * 36 * fw, -74); g.fill(); }
  } else if (T.hair === 'short' || T.hair === 'threads' || T.hair === 'afro') drawShortHair(g, T);
  else if (T.hair === 'loose') drawLooseHair(g, T);

  // rides de l'âge
  if (T.age === 2) {
    g.strokeStyle = 'rgba(0,0,0,.16)'; g.lineWidth = 1.1;
    for (const sd of [-1, 1]) {
      const ox = fx + sd * 33;
      for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(ox, -50 + k * 3); g.lineTo(ox + sd * 6, -51 + k * 5); g.stroke(); }
      g.beginPath(); g.moveTo(fx + sd * 12, -40); g.quadraticCurveTo(fx + sd * 19, -36, fx + sd * 27, -40); g.stroke();
    }
  }

  // yeux
  const look = gaze || { x: Math.sin(t * 0.37) * 0.25, y: 0 };
  for (const sd of [-1, 1]) drawEye(g, T, fx + sd * 19, -50, sd, { blink, mood, look });
  // nez
  drawNose(g, T, fx);
  // bouche
  drawMouth(g, T, fx, mood, talk);
  // moustache
  if (T.moustache) {
    g.fillStyle = T.age === 2 ? '#8f887d' : '#120c08';
    g.beginPath(); g.moveTo(fx - 20, -9); g.quadraticCurveTo(fx - 10, -18, fx, -15); g.quadraticCurveTo(fx + 10, -18, fx + 20, -9);
    g.quadraticCurveTo(fx + 10, -12, fx, -11); g.quadraticCurveTo(fx - 10, -12, fx - 20, -9); g.fill();
  }
  // lunettes
  if (T.glasses) {
    g.strokeStyle = T.man ? '#2a1d14' : '#6b3b24'; g.lineWidth = 2.2;
    for (const sd of [-1, 1]) {
      roundRect(g, fx + sd * 19 - 14, -61, 28, 21, 7); g.stroke();
      g.fillStyle = 'rgba(200,220,240,.1)'; g.fill();
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(fx + sd * 19 - 8, -56); g.lineTo(fx + sd * 19 - 2, -60); g.stroke();
      g.strokeStyle = T.man ? '#2a1d14' : '#6b3b24'; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(fx + sd * 33, -54); g.lineTo(sd * 46 * fw - turn * 4, -50); g.stroke();
    }
    g.beginPath(); g.moveTo(fx - 5, -54); g.quadraticCurveTo(fx, -58, fx + 5, -54); g.stroke();
  }

  // foulard noué (devant), casquette, chapeau
  if (T.hair === 'wrap') drawWrapFront(g, T, turn);
  if (T.man && T.cap) {
    const C = new Path2D();
    C.moveTo(-46 * fw, -80); C.bezierCurveTo(-46 * fw, -122, 46 * fw, -122, 46 * fw, -80); C.quadraticCurveTo(0, -90, -46 * fw, -80); C.closePath();
    if (T.smock) { g.fillStyle = fuguPattern(g); g.fill(C); }
    else { g.fillStyle = '#ece5d4'; g.fill(C); g.strokeStyle = 'rgba(120,90,50,.35)'; g.lineWidth = 1; for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(k * 11, -86); g.quadraticCurveTo(k * 9, -104, k * 4, -114); g.stroke(); } }
    const gr2 = g.createLinearGradient(-46, 0, 46, 0); gr2.addColorStop(0, 'rgba(0,0,0,.05)'); gr2.addColorStop(1, 'rgba(0,0,0,.3)'); g.fillStyle = gr2; g.fill(C);
  }
  if (T.hat) {
    g.fillStyle = '#d6b36c';
    g.beginPath(); g.ellipse(0, -96, 92, 18, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(120,80,30,.35)'; g.lineWidth = 1; for (let r = 60; r < 92; r += 8) { g.beginPath(); g.ellipse(0, -96, r, r * 0.2, 0, 0, TAU); g.stroke(); }
    g.fillStyle = '#ccaa62'; g.beginPath(); g.moveTo(-44, -98); g.bezierCurveTo(-46, -150, 46, -150, 44, -98); g.closePath(); g.fill();
    g.fillStyle = '#8b2c24'; g.fillRect(-45, -110, 90, 10);
    const gr3 = g.createLinearGradient(-90, 0, 90, 0); gr3.addColorStop(0, 'rgba(255,255,255,.12)'); gr3.addColorStop(1, 'rgba(0,0,0,.25)');
    g.fillStyle = gr3; g.beginPath(); g.ellipse(0, -96, 92, 18, 0, 0, TAU); g.fill();
  }
}

function drawEye(g, T, x, y, sd, { blink, mood, look }) {
  const w = 12, h = 6.2 * (mood < 0.25 ? 0.82 : 1);
  g.save(); g.translate(x, y); g.scale(sd, 1); // x local négatif = vers le nez
  // creux de l'orbite
  g.fillStyle = 'rgba(0,0,0,.11)'; g.beginPath(); g.ellipse(0, -2, 17, 10, 0, 0, TAU); g.fill();
  const E = new Path2D();
  E.moveTo(-w, 1); E.bezierCurveTo(-w * 0.5, -h * 1.25, w * 0.45, -h * 1.35, w, -h * 0.15);
  E.bezierCurveTo(w * 0.5, h * 0.95, -w * 0.45, h * 0.9, -w, 1);
  if (blink) {
    g.fillStyle = tone(T.skin, -0.06); g.fill(E);
    g.strokeStyle = INK; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-w, 1); g.bezierCurveTo(-w * 0.4, h * 0.7, w * 0.4, h * 0.6, w, -h * 0.15); g.stroke();
  } else {
    g.fillStyle = T.tourist ? '#f3eee6' : '#ece2d1'; g.fill(E);
    g.save(); g.clip(E);
    const ix = look.x * 3.2 * sd, iy = look.y * 2.5 + 0.4;
    const gr = g.createRadialGradient(ix, iy, 0.5, ix, iy, 5.6);
    gr.addColorStop(0, tone(T.eyeCol, 0.25)); gr.addColorStop(0.7, T.eyeCol); gr.addColorStop(1, tone(T.eyeCol, -0.5));
    g.fillStyle = gr; g.beginPath(); g.arc(ix, iy, 5.6, 0, TAU); g.fill();
    g.fillStyle = '#070403'; g.beginPath(); g.arc(ix, iy, 2.4, 0, TAU); g.fill();
    // ombre de la paupière sur le globe
    const sh = g.createLinearGradient(0, -h, 0, 1); sh.addColorStop(0, 'rgba(30,15,5,.45)'); sh.addColorStop(1, 'rgba(30,15,5,0)');
    g.fillStyle = sh; g.fillRect(-w, -h * 1.4, w * 2, h * 1.6);
    g.restore();
    g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(ix - 1.6 * sd, iy - 2, 1.3, 0, TAU); g.fill();
    // paupière supérieure et cils
    g.strokeStyle = INK; g.lineWidth = 2.6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-w, 1); g.bezierCurveTo(-w * 0.5, -h * 1.25, w * 0.45, -h * 1.35, w, -h * 0.15); g.stroke();
    if (!T.man) { g.lineWidth = 1.4; g.beginPath(); g.moveTo(w - 1, -h * 0.3); g.lineTo(w + 4, -h * 0.9); g.moveTo(w - 4, -h * 0.75); g.lineTo(w - 1, -h * 1.5); g.stroke(); }
    g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(-w + 1, 1.5); g.bezierCurveTo(-w * 0.45, h * 0.95, w * 0.5, h * 1, w, -h * 0.1); g.stroke();
  }
  // pli de la paupière
  g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(-w * 0.8, -h * 0.9); g.quadraticCurveTo(0, -h * 2.1, w * 0.9, -h * 0.9); g.stroke();
  if (T.age === 2) { g.beginPath(); g.moveTo(-w * 0.6, h * 1.4); g.quadraticCurveTo(0, h * 2.3, w * 0.7, h * 1.2); g.stroke(); }
  // sourcil : le bout intérieur descend quand elle se fâche, remonte quand elle est surprise ou ravie
  const lift = (mood - 0.5) * 4, inner = (0.5 - mood) * 7;
  g.fillStyle = T.hairCol === '#bdb6aa' ? '#4a423a' : T.tourist ? tone(T.hairCol, -0.2) : INK;
  g.beginPath();
  g.moveTo(-13, -12 + inner);
  g.quadraticCurveTo(0, -20 - lift, 16, -13);
  g.quadraticCurveTo(2, -16 - lift, -13, -9 + inner);
  g.fill();
  g.restore();
}

function drawNose(g, T, fx) {
  const nw = T.nw, skin = T.skin;
  g.strokeStyle = 'rgba(0,0,0,.13)'; g.lineWidth = 3.4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(fx + 6, -56); g.quadraticCurveTo(fx + 9, -42, fx + 11 * nw, -32); g.stroke();
  // ombre sous le nez
  g.fillStyle = 'rgba(0,0,0,.14)'; g.beginPath(); g.ellipse(fx + 1, -17, 13 * nw, 3.4, 0, 0, TAU); g.fill();
  // ailes
  for (const sd of [-1, 1]) {
    g.fillStyle = tone(skin, -0.1); g.beginPath(); g.ellipse(fx + sd * 11 * nw, -24, 6.6 * nw, 5.6, 0, 0, TAU); g.fill();
    g.strokeStyle = tone(skin, -0.38); g.lineWidth = 1.4;
    g.beginPath(); g.ellipse(fx + sd * 11 * nw, -24, 6.6 * nw, 5.6, 0, sd < 0 ? Math.PI * 0.55 : -Math.PI * 0.2, sd < 0 ? Math.PI * 1.2 : Math.PI * 0.45); g.stroke();
  }
  // bout du nez
  const gr = g.createRadialGradient(fx - 2, -30, 1, fx, -27, 10 * nw);
  gr.addColorStop(0, tone(skin, 0.14)); gr.addColorStop(1, skin);
  g.fillStyle = gr; g.beginPath(); g.ellipse(fx, -27, 9 * nw, 7.4, 0, 0, TAU); g.fill();
  // narines
  g.fillStyle = '#1a0d07';
  for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(fx + sd * 6.4 * nw, -20.8, 3.6 * nw, 1.9, sd * 0.35, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(255,245,230,.2)'; g.beginPath(); g.arc(fx - 2.5, -30.5, 2.4, 0, TAU); g.fill();
  // sillon au-dessus de la lèvre
  g.strokeStyle = 'rgba(0,0,0,.1)'; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(fx - 3, -16); g.lineTo(fx - 4, -11); g.moveTo(fx + 3, -16); g.lineTo(fx + 4, -11); g.stroke();
}

function drawMouth(g, T, fx, mood, talk) {
  const my = -5, lw = 19 * T.lip, c = (mood - 0.5) * 9, o = talk * 8;
  const up = T.tourist ? '#a8575a' : blend(T.skin, '#3a1510', 0.42);
  const lo = T.tourist ? '#c27272' : blend(T.skin, '#8f4a40', 0.42);
  const Lx = fx - lw, Rx = fx + lw, Ly = my - c;
  // plis qui vont du nez aux coins de la bouche
  g.strokeStyle = `rgba(0,0,0,${0.08 + (T.age === 2 ? 0.1 : 0) + Math.max(0, c) * 0.012})`; g.lineWidth = 1.6;
  for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(fx + sd * 15 * T.nw, -23); g.quadraticCurveTo(fx + sd * 24, -14, fx + sd * (lw + 5), Ly + 3); g.stroke(); }
  const midIn = my + 2 + c;
  // intérieur de la bouche
  if (o > 0.4) {
    const M = new Path2D(); M.moveTo(Lx + 2, Ly); M.quadraticCurveTo(fx, midIn, Rx - 2, Ly); M.quadraticCurveTo(fx, midIn + o * 2, Lx + 2, Ly);
    g.fillStyle = '#2a0c09'; g.fill(M);
    g.save(); g.clip(M); g.fillStyle = '#efe7da'; g.fillRect(fx - lw, midIn - 3, lw * 2, 3.5 + o * 0.25); g.restore();
  }
  // lèvre inférieure
  const Lo = new Path2D(); Lo.moveTo(Lx, Ly); Lo.quadraticCurveTo(fx, midIn + o * 2, Rx, Ly); Lo.quadraticCurveTo(fx, my + 15 * T.lip + o, Lx, Ly);
  g.fillStyle = lo; g.fill(Lo);
  g.fillStyle = 'rgba(255,235,225,.2)'; g.beginPath(); g.ellipse(fx - 3, my + 5 + o, 6, 1.8, 0, 0, TAU); g.fill();
  // lèvre supérieure (arc de Cupidon)
  const Up = new Path2D(); Up.moveTo(Lx, Ly);
  Up.bezierCurveTo(fx - lw * 0.55, my - 6, fx - lw * 0.25, my - 8.5, fx, my - 6);
  Up.bezierCurveTo(fx + lw * 0.25, my - 8.5, fx + lw * 0.55, my - 6, Rx, Ly);
  Up.quadraticCurveTo(fx, midIn, Lx, Ly);
  g.fillStyle = up; g.fill(Up);
  g.strokeStyle = '#1e0b07'; g.lineWidth = 1.1;
  g.beginPath(); g.moveTo(Lx, Ly); g.quadraticCurveTo(fx, midIn, Rx, Ly); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 1;
  for (const sd of [-1, 1]) { g.beginPath(); g.arc(fx + sd * (lw + 1), Ly + 0.5, 2.2, sd < 0 ? -0.6 : Math.PI - 0.6, sd < 0 ? 1.2 : Math.PI + 1.2); g.stroke(); }
}

function drawShortHair(g, T) {
  const fw = T.fw;
  const P = new Path2D();
  P.moveTo(-47 * fw, -62);
  P.bezierCurveTo(-52 * fw, -128, 52 * fw, -128, 47 * fw, -62);
  P.quadraticCurveTo(44 * fw, -78, 34 * fw, -84); P.quadraticCurveTo(0, -94, -34 * fw, -84); P.quadraticCurveTo(-44 * fw, -78, -47 * fw, -62);
  g.fillStyle = T.hairCol; g.fill(P);
  // texture crépue
  const rr = mulberry32(31);
  g.fillStyle = 'rgba(255,255,255,.06)';
  for (let k = 0; k < 90; k++) { const a = Math.PI + rr() * Math.PI, r = rr() * 44; g.beginPath(); g.arc(Math.cos(a) * r * fw, -86 + Math.sin(a) * r * 0.8, 1.6, 0, TAU); g.fill(); }
  const gr = g.createLinearGradient(-50, -120, 50, -70); gr.addColorStop(0, 'rgba(255,255,255,.08)'); gr.addColorStop(1, 'rgba(0,0,0,.3)');
  g.fillStyle = gr; g.fill(P);
}

// coiffure à fils : mèches gainées de fil noir dressées en pointes
function drawThreads(g, T) {
  const rr = mulberry32(T.style * 7 + 3);
  const n = 7;
  for (let k = 0; k < n; k++) {
    const a = -Math.PI * 0.85 + (k / (n - 1)) * Math.PI * 0.7;
    const bx = Math.cos(a) * 32, by = -88 + Math.sin(a) * 26;
    const len = 46 + rr() * 22, tilt = a + Math.PI * 0.5 * 0 + (rr() - 0.5) * 0.3;
    const tx = bx + Math.cos(tilt) * len, ty = by + Math.sin(tilt) * len;
    const cx = bx + Math.cos(tilt) * len * 0.5 + (k < n / 2 ? -8 : 8), cy = by + Math.sin(tilt) * len * 0.5;
    g.strokeStyle = '#0d0907'; g.lineCap = 'round';
    g.lineWidth = 9; g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(cx, cy, tx, ty); g.stroke();
    g.lineWidth = 5; g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo((cx + tx) / 2, (cy + ty) / 2, tx, ty); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1;
    for (let q = 0.2; q < 0.95; q += 0.12) {
      const x = (1 - q) * (1 - q) * bx + 2 * (1 - q) * q * cx + q * q * tx, y = (1 - q) * (1 - q) * by + 2 * (1 - q) * q * cy + q * q * ty;
      g.beginPath(); g.moveTo(x - 3, y + 2); g.lineTo(x + 3, y - 2); g.stroke();
    }
  }
}

function drawLooseHair(g, T) {
  const fw = T.fw, col = T.hairCol;
  const P = new Path2D();
  P.moveTo(-50 * fw, -30); P.bezierCurveTo(-60 * fw, -130, 60 * fw, -130, 50 * fw, -30);
  P.quadraticCurveTo(46 * fw, -60, 30, -86); P.quadraticCurveTo(-4, -70, -36, -78); P.quadraticCurveTo(-44 * fw, -60, -50 * fw, -30);
  g.fillStyle = col; g.fill(P);
  g.strokeStyle = tone(col, 0.25); g.lineWidth = 1.2;
  for (let k = -4; k <= 4; k++) { g.beginPath(); g.moveTo(k * 6, -108); g.quadraticCurveTo(k * 11, -92, k * 12 + 4, -76); g.stroke(); }
  const gr = g.createLinearGradient(-50, -120, 50, -40); gr.addColorStop(0, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(0,0,0,.28)');
  g.fillStyle = gr; g.fill(P);
}

// foulard (gélé) : volume arrière selon le style de nouage
function drawWrapBack(g, T, turn) {
  const P = new Path2D();
  if (T.style === 0) { // éventail dressé
    P.moveTo(-58, -74); P.bezierCurveTo(-120, -140, -50, -218, 26, -206); P.bezierCurveTo(104, -194, 112, -122, 60, -72); P.closePath();
  } else if (T.style === 1) { // turban haut et arrondi
    P.moveTo(-56, -70); P.bezierCurveTo(-74, -150, -24, -178, 8, -174); P.bezierCurveTo(60, -170, 76, -124, 56, -70); P.closePath();
  } else { // larges ailes
    P.moveTo(-52, -70); P.bezierCurveTo(-134, -92, -126, -156, -52, -146); P.quadraticCurveTo(0, -186, 52, -146); P.bezierCurveTo(126, -156, 134, -92, 52, -70); P.closePath();
  }
  g.save(); g.translate(-turn * 4, 0);
  waxFill(g, P, T.wrap, 0.62, -80, -200, 90, -70, 0.42);
  // plis amidonnés
  g.lineWidth = 2; g.lineCap = 'round';
  const folds = T.style === 0 ? [[-40, -96, -64, -170], [-14, -100, -20, -196], [12, -100, 30, -196], [36, -94, 76, -160]]
    : T.style === 1 ? [[-46, -92, 10, -168], [-30, -84, 44, -150], [-50, -120, 34, -170]]
      : [[-40, -88, -110, -124], [-20, -100, -70, -150], [40, -88, 110, -124], [20, -100, 70, -150]];
  for (const [x0, y0, x1, y1] of folds) {
    g.strokeStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + 10, (y0 + y1) / 2, x1, y1); g.stroke();
    g.strokeStyle = 'rgba(255,245,220,.22)'; g.beginPath(); g.moveTo(x0 + 3, y0); g.quadraticCurveTo((x0 + x1) / 2 + 13, (y0 + y1) / 2, x1 + 3, y1); g.stroke();
  }
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1.4; g.stroke(P);
  g.restore();
}
function drawWrapFront(g, T, turn) {
  const P = new Path2D();
  P.moveTo(-50 * T.fw, -68); P.bezierCurveTo(-58, -138, 58, -138, 50 * T.fw, -68); P.quadraticCurveTo(0, -95, -50 * T.fw, -68); P.closePath();
  g.save(); g.translate(-turn * 2, 0);
  waxFill(g, P, T.wrap, 0.62, -50, -120, 50, -62, 0.38);
  // bandes enroulées
  g.lineWidth = 2;
  for (const k of [0, 1]) {
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.moveTo(-50, -80 - k * 16); g.quadraticCurveTo(0, -106 - k * 18, 50, -88 - k * 14); g.stroke();
    g.strokeStyle = 'rgba(255,245,220,.2)'; g.beginPath(); g.moveTo(-50, -77 - k * 16); g.quadraticCurveTo(0, -103 - k * 18, 50, -85 - k * 14); g.stroke();
  }
  // pan du nœud qui retombe sur le côté
  const K = new Path2D(); K.moveTo(36, -78); K.quadraticCurveTo(62, -88, 66, -62); K.quadraticCurveTo(56, -66, 44, -66); K.closePath();
  waxFill(g, K, T.wrap, 0.62, 36, -90, 66, -60, 0.45);
  g.strokeStyle = 'rgba(0,0,0,.32)'; g.lineWidth = 1.3; g.stroke(P); g.stroke(K);
  g.restore();
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

/* ============================================================ MAIN */
// Main vue de dessus, doigts vers -y, poignet à l'origine. sc : échelle. curl 0 ouverte … 1 serrée.
// sleeve : motif wax de la manche. bangles : bracelets en or.
export function drawHand(g, x, y, sc, skin, { rot = 0, flip = 1, curl = 0, sleeve = null, bangles = false, arm = 140 } = {}) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(sc * flip, sc);
  // avant-bras
  const A = new Path2D(); A.moveTo(-15, 0); A.lineTo(-19, arm); A.lineTo(19, arm); A.lineTo(15, 0); A.closePath();
  g.fillStyle = skin; g.fill(A);
  let gr = g.createLinearGradient(-19, 0, 19, 0); gr.addColorStop(0, 'rgba(255,240,220,.12)'); gr.addColorStop(1, 'rgba(0,0,0,.3)');
  g.fillStyle = gr; g.fill(A);
  if (bangles) for (let k = 0; k < 3; k++) { g.fillStyle = k === 1 ? '#c98f1e' : '#e3ad35'; g.fillRect(-16.5, 10 + k * 5, 33, 4); g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(-16, 10.5 + k * 5, 33, 1); }
  if (sleeve) {
    const sy = arm < 80 ? 22 : arm * 0.42;
    const S = new Path2D(); S.moveTo(-24, sy); S.quadraticCurveTo(0, sy - 6, 24, sy); S.lineTo(28, arm + 24); S.lineTo(-28, arm + 24); S.closePath();
    waxFill(g, S, sleeve, 0.5, -28, 0, 28, 0, 0.4);
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1.4; g.stroke(S);
  }
  // paume
  const P = new Path2D(); P.moveTo(-15, 2); P.bezierCurveTo(-20, -18, -18, -34, -14, -40); P.lineTo(14, -42); P.bezierCurveTo(19, -32, 19, -16, 15, 2); P.closePath();
  g.fillStyle = skin; g.fill(P);
  // doigts (raccourcis quand la main se referme)
  const fing = [[-10.5, 24], [-3.5, 28], [3.5, 27], [10.5, 21]];
  g.lineCap = 'round';
  for (const [fx, len] of fing) {
    const L = len * (1 - curl * 0.62);
    g.strokeStyle = skin; g.lineWidth = 7.4;
    g.beginPath(); g.moveTo(fx, -38); g.lineTo(fx * 1.08, -38 - L); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(fx - 2, -38 - L * 0.5); g.lineTo(fx + 2, -38 - L * 0.5); g.stroke();
    // ongle
    g.fillStyle = 'rgba(235,205,180,.22)'; g.beginPath(); g.ellipse(fx * 1.08, -38 - L + 2.8, 2.2, 2.6, 0, 0, TAU); g.fill();
  }
  // pouce
  g.strokeStyle = skin; g.lineWidth = 8.4;
  g.beginPath(); g.moveTo(-14, -12); g.quadraticCurveTo(-26, -20, -28 + curl * 10, -34 + curl * 8); g.stroke();
  gr = g.createLinearGradient(-20, 0, 20, 0); gr.addColorStop(0, 'rgba(255,240,220,.1)'); gr.addColorStop(1, 'rgba(0,0,0,.25)');
  g.fillStyle = gr; g.fill(P);
  g.strokeStyle = 'rgba(0,0,0,.14)'; g.lineWidth = 1;
  for (const fx of [-7, 0, 7]) { g.beginPath(); g.moveTo(fx, -36); g.lineTo(fx, -28); g.stroke(); }
  g.restore();
}

/* ============================================================ SILHOUETTE EN PIED (marché) */
// h : hauteur en pixels. walk : phase de marche. dir : 1 vers la droite, −1 vers la gauche.
// view : 'side' (marche), 'back' (de dos, face à l'étal), 'front' (la commerçante derrière la table).
// load : couleur d'une bassine portée sur la tête ; carry : motif d'un paquet de tissu porté à la main.
// point : 0…1, bras tendu vers l'étal.
export function drawFigure(g, x, y, h, look, opts = {}) {
  const { walk = 0, dir = 1, man = false, load = null, carry = null, alpha = 1, view = 'side', point = 0, t = 0, kind } = opts;
  const T = traits(kind ? { ...look, kind } : look, man);
  const u = h / 100;
  const moving = view === 'side' && walk !== 0;
  const bob = moving ? Math.abs(Math.sin(walk)) * 1.6 : Math.sin(t * 1.3 + (look.seed || 0)) * 0.4;
  const sw = moving ? Math.sin(walk) : 0;
  const skin = T.skin, side = view === 'side';
  g.save();
  g.globalAlpha = alpha;
  g.translate(x, y);
  g.scale(u * (side ? dir : 1), u);
  // ombre portée
  g.fillStyle = 'rgba(30,15,5,.22)'; g.beginPath(); g.ellipse(0, 0, 18, 4, 0, 0, TAU); g.fill();
  g.translate(0, -bob);
  const stoop = T.age === 2 ? 3 : 0;

  // bras arrière (côté caché)
  const armBack = () => {
    g.save(); g.translate(side ? -2 : -14, -78);
    g.rotate(side ? -sw * 0.45 : 0.08);
    limb(g, skin, T.man ? (T.smock ? null : T.wrap) : T.dress, 27);
    g.restore();
  };
  if (side || view === 'back') armBack();

  // jambes et pieds
  if (T.man || T.tourist) {
    for (const k of [-1, 1]) {
      const a = side ? sw * 0.42 * k : 0;
      g.save(); g.translate(side ? 0 : k * 5, -48); g.rotate(a);
      g.fillStyle = T.man ? (T.smock ? '#2b2b33' : '#3d3a35') : skin;
      g.fillRect(-4.2, 0, 8.4, T.tourist ? 46 : 46);
      if (T.tourist) { g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(1.5, 0, 2.7, 46); }
      g.fillStyle = T.man ? '#1b120c' : '#7a4a2a'; g.beginPath(); g.ellipse(side ? 3 : 0, 46.5, side ? 7 : 5, 2.6, 0, 0, TAU); g.fill();
      g.restore();
    }
  } else {
    // pieds en sandales sous le pagne
    for (const k of [-1, 1]) {
      const fx = side ? sw * 7 * k : k * 5;
      const lift = side ? Math.max(0, Math.sin(walk + (k > 0 ? 0 : Math.PI))) * 2 : 0;
      g.fillStyle = skin; g.fillRect(fx - 2.6, -7 - lift, 5.2, 6);
      g.fillStyle = '#2a1a12'; g.beginPath(); g.ellipse(fx + (side ? 2 : 0), -0.8 - lift, side ? 6.5 : 4.2, 1.8, 0, 0, TAU); g.fill();
      g.fillStyle = '#c0392b'; g.fillRect(fx - 2, -3.4 - lift, 5, 1.4);
    }
  }

  // corps
  if (T.man) {
    const P = new Path2D();
    P.moveTo(-13, -80 + stoop); P.quadraticCurveTo(-15, -60, -13, T.smock ? -38 : -46); P.lineTo(13, T.smock ? -38 : -46); P.quadraticCurveTo(15, -60, 13, -80 + stoop); P.closePath();
    if (T.smock) { g.fillStyle = fuguPattern(g); g.fill(P); } else waxFill(g, P, T.wrap, 0.3, -13, -80, 13, -46, 0.38);
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 0.8; g.stroke(P);
  } else if (T.tourist) {
    const sk = new Path2D(); sk.moveTo(-11, -58); sk.lineTo(11, -58); sk.lineTo(15 + sw * 2, -26); sk.lineTo(-15 + sw * 2, -26); sk.closePath();
    waxFill(g, sk, T.dress, 0.3, -15, -58, 15, -26, 0.35);
    const top = new Path2D(); top.moveTo(-12, -80); top.quadraticCurveTo(-14, -66, -11, -56); top.lineTo(11, -56); top.quadraticCurveTo(14, -66, 12, -80); top.closePath();
    g.fillStyle = '#f1ece0'; g.fill(top); g.fillStyle = 'rgba(0,0,0,.12)'; g.fill(top);
    if (T.camera) { g.fillStyle = '#1c1b1a'; g.fillRect(side ? 4 : -4, -70, 8, 6); }
  } else {
    // pagne noué jusqu'aux chevilles, qui balance à la marche
    const hem = sw * 3;
    const sk = new Path2D();
    sk.moveTo(-11.5, -60); sk.bezierCurveTo(-14, -48, -14.5, -30, -13.5 + hem, -6); sk.lineTo(13.5 + hem, -6); sk.bezierCurveTo(14.5, -30, 14, -48, 11.5, -60); sk.closePath();
    waxFill(g, sk, T.dress, 0.3, -14, -60, 14, -6, 0.42);
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(side ? -10 : 9, -59); g.quadraticCurveTo(side ? -2 : 4, -34, side ? 4 + hem : -2 + hem, -6); g.stroke(); // bord du pagne croisé
    g.strokeStyle = 'rgba(0,0,0,.14)'; g.beginPath(); g.moveTo(-6, -50); g.lineTo(-7 + hem, -8); g.moveTo(6, -46); g.lineTo(7 + hem, -8); g.stroke();
    // kaba (haut) avec basque évasée
    const top = new Path2D();
    top.moveTo(-12, -80 + stoop); top.quadraticCurveTo(-14, -68, -12.5, -60); top.quadraticCurveTo(-15, -55, -14, -52); top.quadraticCurveTo(0, -50, 14, -52); top.quadraticCurveTo(15, -55, 12.5, -60); top.quadraticCurveTo(14, -68, 12, -80 + stoop); top.closePath();
    waxFill(g, top, T.dress, 0.3, -14, -80, 14, -52, 0.4);
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 0.8; g.stroke(top);
    // manches bouffantes
    for (const k of side ? [1] : [-1, 1]) { const S = new Path2D(); S.ellipse(k * 12, -77 + stoop, 5.2, 4.6, 0, 0, TAU); waxFill(g, S, T.dress, 0.3, k * 7, -82, k * 17, -72, 0.45); }
  }

  // cou et tête
  const hx = side ? 1.5 + stoop * 0.8 : 0;
  g.fillStyle = skin; g.fillRect(hx - 3, -86 + stoop, 6, 7);
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(hx - 3, -86 + stoop, 6, 2.5);
  drawMiniHead(g, T, hx, -92 + stoop, view, t);

  // charge portée sur la tête : bassine émaillée
  if (load) {
    g.save(); g.translate(hx, -103 + stoop);
    g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(0, 1, 9, 2, 0, 0, TAU); g.fill();
    g.fillStyle = load; g.beginPath(); g.moveTo(-17, -6); g.lineTo(17, -6); g.lineTo(12, 2); g.lineTo(-12, 2); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(-17, -7, 34, 2);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(-12, 0, 24, 2);
    // marchandises : mangues, oranges ou tissus
    const goods = ['#f08a24', '#e9c23a', '#7aa63a', '#c0392b'];
    for (let k = -3; k <= 3; k++) { g.fillStyle = goods[(k + 3 + (look.seed || 0)) % 4]; g.beginPath(); g.arc(k * 4.2, -8 - (3 - Math.abs(k)) * 1.2, 3.3, 0, TAU); g.fill(); }
    g.restore();
  }

  // bras avant (vers la caméra)
  g.save();
  if (side) {
    g.translate(2, -78 + stoop);
    const raise = load ? -2.6 : point ? -1.1 * point : 0;
    g.rotate(sw * 0.45 + raise);
    limb(g, skin, T.man ? (T.smock ? null : T.wrap) : T.tourist ? null : T.dress, 27, T.smock, T.bangles);
    if (carry && !load) { g.fillStyle = waxPattern(g, carry, 120, 0.25); g.fillRect(-6, 24, 12, 8); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(-6, 30, 12, 2); }
  } else if (view === 'back') {
    // de dos : bras droit tendu vers l'étal quand elle montre un tissu
    g.translate(13, -78 + stoop); g.rotate(0.08 - point * 2.6);
    limb(g, skin, T.man ? (T.smock ? null : T.wrap) : T.tourist ? null : T.dress, 27, T.smock, T.bangles);
  } else {
    for (const k of [-1, 1]) {
      g.save(); g.translate(k * 13, -78 + stoop); g.rotate(k * 0.12 + Math.sin(t * 1.4 + k * 2) * 0.1);
      limb(g, skin, T.man ? T.wrap : T.dress, 24, false, T.bangles);
      g.restore();
    }
  }
  g.restore();
  g.restore();
}

// bras : manche courte puis avant-bras, main au bout
function limb(g, skin, sleeve, len, smock = false, bangles = false) {
  g.lineCap = 'round';
  g.strokeStyle = skin; g.lineWidth = 4.4;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, len); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(1.4, 6); g.lineTo(1.4, len); g.stroke();
  if (bangles) { g.strokeStyle = '#e0a526'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-2.4, len - 5); g.lineTo(2.4, len - 5); g.stroke(); }
  g.fillStyle = skin; g.beginPath(); g.ellipse(0, len + 2, 2.8, 3.6, 0, 0, TAU); g.fill();
  if (sleeve || smock) {
    const S = new Path2D(); S.moveTo(-4, -2); S.lineTo(4, -2); S.lineTo(4.6, smock ? 15 : 10); S.lineTo(-4.6, smock ? 15 : 10); S.closePath();
    if (smock) { g.fillStyle = fuguPattern(g); g.fill(S); } else waxFill(g, S, sleeve, 0.3, -4, 0, 4, 0, 0.4);
  }
}

// tête miniature : de profil (yeux et nez tournés dans le sens de la marche), de dos, ou de face
function drawMiniHead(g, T, x, y, view, t) {
  const skin = T.skin;
  const gr = g.createRadialGradient(x - 2, y - 3, 0.5, x, y, 9);
  gr.addColorStop(0, tone(skin, 0.14)); gr.addColorStop(1, tone(skin, -0.2));
  g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, 6.4, 7.8, 0, 0, TAU); g.fill();
  if (view === 'side') {
    g.fillStyle = skin; g.beginPath(); g.ellipse(x + 6, y + 0.6, 1.6, 2, 0, 0, TAU); g.fill(); // nez
    g.fillStyle = tone(skin, -0.25); g.beginPath(); g.ellipse(x - 2, y, 1.6, 2.4, 0, 0, TAU); g.fill(); // oreille
    g.fillStyle = INK; g.beginPath(); g.ellipse(x + 3.4, y - 1.6, 0.9, 1, 0, 0, TAU); g.fill();
    g.fillStyle = blend(skin, '#3a1510', 0.35); g.fillRect(x + 3.2, y + 3.6, 2.6, 1);
  } else if (view === 'front') {
    const bl = (t % 4.3) < 0.13;
    g.fillStyle = INK;
    for (const k of [-1, 1]) { g.beginPath(); g.ellipse(x + k * 2.6, y - 1.4, 1, bl ? 0.25 : 1.1, 0, 0, TAU); g.fill(); }
    g.fillStyle = tone(skin, -0.2); g.beginPath(); g.ellipse(x, y + 1.6, 1.8, 1.2, 0, 0, TAU); g.fill();
    g.fillStyle = blend(skin, '#3a1510', 0.4); g.beginPath(); g.ellipse(x, y + 4.4, 2.6, 1, 0, 0, TAU); g.fill();
  }
  // coiffure
  const hc = T.hairCol;
  if (T.hair === 'wrap') {
    const fy = view === 'back' ? y - 3 : y - 5;
    const P = new Path2D();
    P.moveTo(x - 7.4, fy + 2); P.bezierCurveTo(x - 8.5, fy - 9, x + 8.5, fy - 9, x + 7.4, fy + 2); P.quadraticCurveTo(x, fy - 1, x - 7.4, fy + 2);
    if (view === 'back') { P.moveTo(x - 7.5, fy + 2); P.quadraticCurveTo(x, fy + 7, x + 7.5, fy + 2); }
    waxFill(g, P, T.wrap, 0.22, x - 8, fy - 9, x + 8, fy + 2, 0.4);
    const K = new Path2D();
    if (T.style === 0) K.ellipse(x + 2, fy - 9, 8.5, 4, -0.5, 0, TAU);
    else if (T.style === 1) K.ellipse(x, fy - 8, 6.5, 5.5, 0, 0, TAU);
    else { K.ellipse(x - 5, fy - 6, 6, 2.8, 0.4, 0, TAU); K.ellipse(x + 5, fy - 6, 6, 2.8, -0.4, 0, TAU); }
    waxFill(g, K, T.wrap, 0.22, x - 8, fy - 13, x + 8, fy - 3, 0.42);
  } else if (T.hair === 'short') {
    g.fillStyle = hc; g.beginPath(); g.ellipse(x, y - 3.4, 6.7, 5, 0, Math.PI, TAU); g.fill();
    if (view === 'back') { g.beginPath(); g.ellipse(x, y - 1, 6.6, 6, 0, Math.PI * 1.05, Math.PI * 1.95, true); g.fill(); }
    if (T.cap) { g.fillStyle = T.smock ? '#1f2c55' : '#ece5d4'; g.beginPath(); g.ellipse(x, y - 5, 6.8, 4.6, 0, Math.PI, TAU); g.fill(); }
  } else if (T.hair === 'afro') {
    g.fillStyle = hc; g.beginPath(); g.ellipse(x, y - 5, 9, 7.5, 0, 0, TAU); g.fill();
    if (view !== 'back') { g.fillStyle = tone(skin, 0); g.beginPath(); g.ellipse(x + (view === 'side' ? 2 : 0), y + 1, 5.8, 6.4, 0, 0, Math.PI); g.fill(); }
  } else if (T.hair === 'threads') {
    g.strokeStyle = hc; g.lineWidth = 1.8; g.lineCap = 'round';
    g.fillStyle = hc; g.beginPath(); g.ellipse(x, y - 3.4, 6.6, 5, 0, Math.PI, TAU); g.fill();
    for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(x + k * 2.5, y - 6); g.lineTo(x + k * 4.5, y - 15 + Math.abs(k)); g.stroke(); }
  } else if (T.hair === 'loose') {
    g.fillStyle = hc; g.beginPath(); g.ellipse(x - (view === 'side' ? 1.5 : 0), y - 2, 7.2, 7.6, 0, Math.PI * 0.9, Math.PI * 2.1); g.fill();
    g.fillRect(x - (view === 'side' ? 7.5 : 7), y - 2, view === 'back' ? 14 : 4, 10);
    if (T.hat) { g.fillStyle = '#d6b36c'; g.beginPath(); g.ellipse(x, y - 6, 12, 2.4, 0, 0, TAU); g.fill(); g.beginPath(); g.ellipse(x, y - 8, 6, 4, 0, Math.PI, TAU); g.fill(); g.fillStyle = '#8b2c24'; g.fillRect(x - 6, y - 8, 12, 1.6); }
  }
}

export { clamp };
