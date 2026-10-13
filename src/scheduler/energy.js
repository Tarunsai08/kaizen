import { clamp } from './learn.js';

// Default curve (0..1) by hour: peaks early morning, evening and night; mid-afternoon low.
const DEFAULT = [0.30, 0.25, 0.2, 0.2, 0.3, 0.55, 0.75, 0.9, 0.95, 0.9, 0.8, 0.7, 0.55, 0.42, 0.35, 0.33, 0.4, 0.55, 0.75, 0.9, 0.92, 0.85, 0.7, 0.45];
export const defaultEnergy = (hour) => DEFAULT[Math.floor(hour) % 24];

/** Mood / energy / sleep from today's check-in shift the whole curve (range about +-0.2). */
export function moodShift(ctx = {}) {
  if (!ctx) return 0;
  let s = 0;
  if (ctx.mood != null) s += (ctx.mood - 3) * 0.07;
  if (ctx.energy != null) s += (ctx.energy - 3) * 0.05;
  if (ctx.sleepH != null) s += clamp((ctx.sleepH - 7) * 0.04, -0.12, 0.06);
  return clamp(s, -0.25, 0.2);
}

/** Energy at a given hour. Learned data blends in, with full trust after ~30 sessions in that hour bucket. */
export function energyAt(hour, dow, stats = {}, shift = 0) {
  const def = defaultEnergy(hour);
  const h = stats.energy?.hours?.[Math.floor(hour)];
  let e = def;
  if (h) { const w = Math.min(1, h.n / 30); e = def * (1 - w) + (h.s * 0.8 + 0.1) * w; }
  const d = stats.energy?.dow?.[dow];
  if (d && d.n >= 5) e += clamp((d.s - 0.5) * 0.2 * Math.min(1, d.n / 30), -0.08, 0.08);
  return clamp(e + shift, 0, 1);
}
