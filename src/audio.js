// Sons générés (WebAudio) : rumeur du marché, pièces, petites mélodies de kalimba. Aucun fichier.
export class Sound {
  constructor() {
    this.ctx = null;
    try { this.muted = localStorage.getItem('nb.muted') === '1'; } catch { this.muted = false; }
  }
  init() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* non pris en charge */ }
    const c = (this.ctx = new AC());
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.6; this.master.connect(c.destination);
    // rumeur de foule : bruit filtré, modulé lentement
    const len = c.sampleRate * 3;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) { b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); d[i] = b * 3; }
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.7;
    this.crowd = c.createGain(); this.crowd.gain.value = 0;
    src.connect(f); f.connect(this.crowd); this.crowd.connect(this.master); src.start();
    const lfo = c.createOscillator(); lfo.frequency.value = 0.13;
    const lg = c.createGain(); lg.gain.value = 250; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    this.chatterT = null;
  }
  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('nb.muted', m ? '1' : '0'); } catch { /* ignore */ }
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.05);
  }
  ambience(on) {
    if (!this.ctx) return;
    this.crowd.gain.setTargetAtTime(on ? 0.16 : 0, this.ctx.currentTime, 0.6);
    clearInterval(this.chatterT);
    if (on) this.chatterT = setInterval(() => { if (Math.random() < 0.5) this.voice(); if (Math.random() < 0.08) this.horn(); }, 900);
  }
  tone(f, dur, type = 'sine', vol = 0.12, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  // kalimba : note pincée avec harmonique
  pluck(f, when = 0, vol = 0.14) { this.tone(f, 0.6, 'sine', vol, when); this.tone(f * 3.01, 0.18, 'sine', vol * 0.25, when); }
  voice() {
    // syllabe lointaine (formant)
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(160 + Math.random() * 140, t); o.frequency.linearRampToValueAtTime(140 + Math.random() * 160, t + 0.25);
    f.type = 'bandpass'; f.frequency.value = 600 + Math.random() * 900; f.Q.value = 6;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.025, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(f); f.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.32);
  }
  // voix parlée : syllables formantées, timbre et hauteur selon la personne. Renvoie la durée en secondes.
  speak(text, { base = 210, vol = 0.05, bright = 1 } = {}) {
    if (!this.ctx || !text) return 0;
    const c = this.ctx;
    const n = Math.max(2, Math.min(16, Math.round(text.length / 5)));
    const V = [[800, 1250], [500, 1850], [330, 2300], [520, 920], [380, 820]];
    let t = c.currentTime + 0.03;
    for (let i = 0; i < n; i++) {
      const d = 0.075 + Math.random() * 0.075;
      const f0 = base * (0.92 + Math.random() * 0.22) * (i === n - 1 ? 0.84 : i === 0 ? 1.06 : 1);
      const o = c.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * (0.9 + Math.random() * 0.15), t + d);
      const env = c.createGain();
      env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(vol, t + 0.018); env.gain.setValueAtTime(vol * 0.8, t + d * 0.7); env.gain.exponentialRampToValueAtTime(0.0001, t + d);
      const [F1, F2] = V[Math.floor(Math.random() * V.length)];
      for (const [F, q, gv] of [[F1, 5, 1], [F2 * bright, 8, 0.55]]) {
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = F; bp.Q.value = q;
        const gg = c.createGain(); gg.gain.value = gv;
        o.connect(bp); bp.connect(gg); gg.connect(env);
      }
      env.connect(this.master); o.start(t); o.stop(t + d + 0.02);
      t += d + 0.022 + (Math.random() < 0.18 ? 0.09 : 0);
    }
    return t - c.currentTime;
  }
  // bruit filtré : froissement de billets ou de tissu
  noise(dur = 0.12, freq = 3000, vol = 0.06, q = 0.8) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const len = Math.round(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.3 ? 1 : 0.35);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const gn = c.createGain(); gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(gn); gn.connect(this.master); src.start(t);
  }
  paper() { this.noise(0.09, 4200, 0.08, 1.2); }
  rustle() { this.noise(0.35, 1800, 0.05, 0.6); setTimeout(() => this.noise(0.25, 2200, 0.04, 0.6), 220); }
  horn() { this.tone(520, 0.18, 'square', 0.02); this.tone(520, 0.12, 'square', 0.02, 0.24); }
  coin() { this.tone(1320, 0.09, 'triangle', 0.1); this.tone(1760, 0.14, 'triangle', 0.08, 0.07); this.tone(2640, 0.2, 'sine', 0.05, 0.14); }
  click() { this.tone(900, 0.04, 'triangle', 0.05); }
  deal() { [523, 659, 784, 1046].forEach((f, i) => this.pluck(f, i * 0.09)); }
  fail() { this.tone(220, 0.25, 'triangle', 0.1); this.tone(185, 0.35, 'triangle', 0.08, 0.15); }
  morning() { [392, 523, 587, 659, 784].forEach((f, i) => this.pluck(f, i * 0.13, 0.11)); }
  fanfare() { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.pluck(f, i * 0.12, 0.16)); }
}
