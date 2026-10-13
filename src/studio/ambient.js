// Generated ambient sound for Focus and Zen (no audio files): rain, waves, or a soft brown-noise "room".
let ctx = null;
let nodes = [];

function noiseBuffer(c, seconds = 4, brown = false) {
  const len = c.sampleRate * seconds;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
  }
  return buf;
}

export const SOUNDS = [
  { k: 'rain', l: 'Rain' },
  { k: 'waves', l: 'Waves' },
  { k: 'room', l: 'Calm' },
];

export function playAmbient(kind = 'rain', volume = 0.5) {
  stopAmbient();
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.linearRampToValueAtTime(volume, ctx.currentTime + 2.5);
    out.connect(ctx.destination);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 4, kind !== 'rain');
    src.loop = true;
    const f = ctx.createBiquadFilter();
    if (kind === 'rain') { f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.5; }
    else { f.type = 'lowpass'; f.frequency.value = kind === 'waves' ? 700 : 420; }
    src.connect(f).connect(out);
    // waves: a slow swell on the volume
    if (kind === 'waves') {
      const lfo = ctx.createOscillator(); const lg = ctx.createGain();
      lfo.frequency.value = 0.09; lg.gain.value = volume * 0.6;
      lfo.connect(lg).connect(out.gain); lfo.start(); nodes.push(lfo);
    }
    src.start();
    nodes.push(src, out);
  } catch { /* no audio available */ }
}

export function stopAmbient() {
  if (!ctx) return;
  const t = ctx.currentTime;
  nodes.forEach((n) => {
    try {
      if (n.gain) { n.gain.cancelScheduledValues(t); n.gain.setValueAtTime(n.gain.value, t); n.gain.linearRampToValueAtTime(0, t + 0.6); }
      else n.stop(t + 0.7);
    } catch { /* already stopped */ }
  });
  nodes = [];
}
