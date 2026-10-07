// Tiny synthesized sound effects (Web Audio) — no audio files, works offline.
let ctx = null;
let enabled = true;
export function setSoundEnabled(v) { enabled = v !== false; }
function ac() {
  if (!enabled) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch { return null; }
}
function tone(c, freq, start, dur, { type = 'sine', gain = 0.16, to } = {}) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime + start);
  if (to) o.frequency.exponentialRampToValueAtTime(to, c.currentTime + start + dur);
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.05);
}
/** Lesson complete: bright two-note chime */
export function sfxComplete() {
  const c = ac(); if (!c) return;
  tone(c, 784, 0, 0.18, { type: 'triangle', gain: 0.18 });
  tone(c, 1175, 0.1, 0.32, { type: 'triangle', gain: 0.16 });
  tone(c, 1568, 0.1, 0.32, { type: 'sine', gain: 0.05 });
}
/** Travelling to the next topic: soft rising glide with rhythmic ticks */
export function sfxTravel(ms = 800) {
  const c = ac(); if (!c) return;
  const d = ms / 1000;
  tone(c, 220, 0, d, { type: 'sine', gain: 0.07, to: 520 });
  for (let t = 0; t < d; t += 0.16) tone(c, 1400, t, 0.03, { type: 'square', gain: 0.012 });
}
/** Arrived at the next topic */
export function sfxArrive() {
  const c = ac(); if (!c) return;
  tone(c, 988, 0, 0.12, { type: 'sine', gain: 0.12 });
  tone(c, 1319, 0.08, 0.22, { type: 'sine', gain: 0.1 });
}
/** Whole topic finished: short fanfare */
export function sfxFanfare() {
  const c = ac(); if (!c) return;
  [523, 659, 784, 1047].forEach((f, i) => tone(c, f, i * 0.09, 0.28, { type: 'triangle', gain: 0.14 }));
  tone(c, 1568, 0.36, 0.5, { type: 'sine', gain: 0.08 });
}

/* ---- Today layout sounds ---- */
/** 8-bit coin */
export function sfxCoin() {
  const c = ac(); if (!c) return;
  tone(c, 988, 0, 0.07, { type: 'square', gain: 0.07 });
  tone(c, 1319, 0.07, 0.28, { type: 'square', gain: 0.07 });
}
/** 8-bit power-up arpeggio */
export function sfxPower() {
  const c = ac(); if (!c) return;
  [523, 659, 784, 1047, 1319].forEach((f, i) => tone(c, f, i * 0.05, 0.09, { type: 'square', gain: 0.05 }));
}
/** short UI blip */
export function sfxBlip(f = 880) {
  const c = ac(); if (!c) return;
  tone(c, f, 0, 0.06, { type: 'square', gain: 0.04 });
}
/** toggle switch click */
export function sfxSwitch(on = true) {
  const c = ac(); if (!c) return;
  tone(c, on ? 2200 : 1500, 0, 0.025, { type: 'square', gain: 0.05 });
  tone(c, on ? 140 : 110, 0, 0.06, { type: 'sine', gain: 0.12 });
  if (on) tone(c, 1760, 0.05, 0.12, { type: 'sine', gain: 0.05 });
}
function noise(c, start, dur, { gain = 0.08, freq = 3000, q = 0.8 } = {}) {
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = c.createBufferSource(); s.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain(); g.gain.value = gain;
  s.connect(f).connect(g).connect(c.destination);
  s.start(c.currentTime + start);
}
/** pencil scribble */
export function sfxScribble() {
  const c = ac(); if (!c) return;
  for (let i = 0; i < 4; i++) noise(c, i * 0.055, 0.05, { gain: 0.09, freq: 2600 + i * 400, q: 1.2 });
}
/** rubber stamp thud */
export function sfxStamp() {
  const c = ac(); if (!c) return;
  tone(c, 180, 0, 0.12, { type: 'sine', gain: 0.22, to: 70 });
  noise(c, 0, 0.06, { gain: 0.07, freq: 900, q: 0.6 });
}
/** soft whoosh (orbit zoom) */
export function sfxWhoosh() {
  const c = ac(); if (!c) return;
  noise(c, 0, 0.35, { gain: 0.05, freq: 700, q: 0.4 });
  tone(c, 330, 0, 0.3, { type: 'sine', gain: 0.05, to: 660 });
}
