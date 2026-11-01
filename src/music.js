// Musique générée en direct (WebAudio), aucun fichier.
// Marché : groove highlife en 12/8 sur la cloche gankogui des Ewe, hochet axatse, basse et guitare.
// Matin : kalimba et nappe douce. Soir : guitare lente. Les styles s'enchaînent en fondu.
const BELL = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1]; // motif standard de la cloche, 12 pulsations
const N = (m) => 440 * Math.pow(2, (m - 69) / 12);
const STYLES = {
  market: { bpm: 112, prog: [[48, 'M'], [53, 'M'], [55, 'M'], [48, 'M']], bell: 1, shaker: 1, bass: 1, guitar: 1, kalimba: 0.5, pad: 0, vol: 0.5 },
  morning: { bpm: 84, prog: [[53, 'M'], [48, 'M'], [50, 'm'], [55, 'M']], bell: 0.25, shaker: 0.35, bass: 0.5, guitar: 0, kalimba: 1, pad: 1, vol: 0.62 },
  evening: { bpm: 74, prog: [[45, 'm'], [53, 'M'], [48, 'M'], [55, 'M']], bell: 0, shaker: 0.2, bass: 0.7, guitar: 0.8, kalimba: 0.3, pad: 1, vol: 0.6 },
};

export class Music {
  constructor(sound) { this.sound = sound; this.style = null; this.timer = null; }
  get ctx() { return this.sound.ctx; }
  setup() {
    const c = this.ctx;
    if (!c || this.bus) return !!c;
    this.bus = c.createGain(); this.bus.gain.value = 0; this.bus.connect(this.sound.master);
    const len = c.sampleRate * 0.3, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    return true;
  }
  play(style) {
    if (!this.setup() || !STYLES[style]) return;
    const c = this.ctx;
    if (this.style === style) return;
    this.next = style;
    if (!this.style) { this.style = style; this.pulse = 0; this.t = c.currentTime + 0.1; }
    this.bus.gain.cancelScheduledValues(c.currentTime);
    this.bus.gain.setTargetAtTime(STYLES[style].vol, c.currentTime, 0.8);
    if (!this.timer) this.timer = setInterval(() => this.schedule(), 60);
  }
  stop() {
    if (!this.bus) return;
    this.bus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
    clearInterval(this.timer); this.timer = null; this.style = null;
  }
  schedule() {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    if (this.t < c.currentTime - 0.2) this.t = c.currentTime + 0.05; // l'onglet était en veille
    while (this.t < c.currentTime + 0.25) {
      // changement de style au début d'une mesure
      if (this.pulse % 48 === 0 && this.next) { this.style = this.next; this.next = null; }
      const S = STYLES[this.style];
      const dur = 60 / S.bpm / 3;
      this.step(S, this.pulse, this.t, dur);
      this.pulse++; this.t += dur;
    }
  }
  step(S, p, t, dur) {
    const k = p % 12, bar = Math.floor(p / 12) % S.prog.length;
    const [root, q] = S.prog[bar];
    const third = q === 'm' ? 3 : 4;
    const chord = [root, root + third, root + 7, root + 12, root + 12 + third, root + 19];
    // swing léger, comme une main humaine
    const tt = t + (k % 3 === 1 ? dur * 0.06 : 0) + (Math.random() - 0.5) * 0.006;
    if (S.bell && BELL[k] && Math.random() < S.bell + 0.2) this.bellHit(tt, k === 0 ? 0.75 : 1, S.bell);
    if (S.shaker) this.shake(tt, k % 3 === 0 ? 0.03 : 0.013, S.shaker);
    if (S.bass) {
      const bp = { 0: root - 12, 5: root - 5, 6: root - 12, 9: root - 10 + (q === 'm' ? 0 : 1), 10: root - 5 };
      if (bp[k] !== undefined && (S.bpm > 90 || k === 0 || k === 6)) this.bassNote(tt, N(bp[k]), dur * (k === 0 ? 2.6 : 1.6), 0.07 * S.bass);
    }
    if (S.guitar) {
      const pat = S.bpm > 90 ? { 0: 3, 2: 4, 3: 2, 5: 4, 6: 3, 8: 5, 9: 2, 11: 4 } : { 0: 0, 3: 2, 6: 3, 9: 4 };
      if (pat[k] !== undefined) this.pluck(tt, N(chord[pat[k]] + 12), 0.035 * S.guitar, 0.45);
      if (S.bpm > 90 && (k === 3 || k === 9) && Math.random() < 0.4) this.pluck(tt + 0.01, N(chord[2] + 12), 0.02, 0.3);
    }
    if (S.kalimba && k % (S.bpm > 90 ? 3 : 2) === 0 && Math.random() < S.kalimba * 0.55) {
      const scale = [0, 2, 4, 7, 9, 12, 14, 16];
      const m = root + 12 + scale[Math.floor(Math.random() * scale.length)];
      this.kalimba(tt, N(m + (S.bpm > 90 ? 12 : 0)), 0.03 * Math.max(0.6, S.kalimba));
    }
    if (S.pad && k === 0) for (const m of [chord[0], chord[1], chord[2]]) this.padNote(tt, N(m), dur * 12, 0.012 * S.pad);
  }
  // cloche de fer : deux partiels inharmoniques, attaque sèche
  bellHit(t, pitch, v) {
    const c = this.ctx, g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03 * Math.min(1, v + 0.3), t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    for (const [f, a] of [[1150 * pitch, 1], [2930 * pitch, 0.4]]) {
      const o = c.createOscillator(), og = c.createGain(); o.type = 'sine'; o.frequency.value = f; og.gain.value = a;
      o.connect(og); og.connect(g); o.start(t); o.stop(t + 0.18);
    }
    g.connect(this.bus);
  }
  shake(t, vol, v) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6500;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    s.connect(f); f.connect(g); g.connect(this.bus); s.start(t, Math.random() * 0.2, 0.09);
  }
  bassNote(t, f, d, vol) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = 500;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(lp); lp.connect(g); g.connect(this.bus); o.start(t); o.stop(t + d + 0.02);
  }
  // guitare pincée : corde (dent de scie filtrée qui se ferme vite)
  pluck(t, f, vol, d) {
    const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = f; o2.type = 'triangle'; o2.frequency.value = f * 2.002;
    lp.type = 'lowpass'; lp.Q.value = 2; lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(600, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    const g2 = c.createGain(); g2.gain.value = 0.3;
    o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(this.bus);
    o.start(t); o2.start(t); o.stop(t + d + 0.02); o2.stop(t + d + 0.02);
  }
  kalimba(t, f, vol) {
    const c = this.ctx;
    for (const [m, a, d] of [[1, 1, 0.9], [5.4, 0.18, 0.12]]) {
      const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f * m;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * a, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + d + 0.02);
    }
  }
  padNote(t, f, d, vol) {
    const c = this.ctx, g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + d * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    for (const det of [-6, 6]) { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.detune.value = det; o.connect(g); o.start(t); o.stop(t + d + 0.05); }
    g.connect(this.bus);
  }
}
