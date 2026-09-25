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
