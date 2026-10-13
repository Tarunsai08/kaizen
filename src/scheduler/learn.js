// Light on-device learning: moving averages only.
export const ALPHA = 0.3;
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/** EMA of actual/estimated per category, clamped 0.5-2.5. Returns new correction map. */
export function updateCorrection(correction = {}, category, actualMin, estimatedMin) {
  if (!category || !(actualMin > 0) || !(estimatedMin > 0)) return correction;
  const prev = correction[category] ?? 1;
  const next = clamp(prev * (1 - ALPHA) + (actualMin / estimatedMin) * ALPHA, 0.5, 2.5);
  return { ...correction, [category]: next };
}

const OUT = { DONE: 1, PARTIAL: 0.5, SKIPPED: 0 };
/** energy = { hours: {h: {s, n}}, dow: {d: {s, n}} } ; s is the running score 0..1 */
export function updateEnergy(energy = {}, hour, dow, state, defaultScore = 0.5) {
  const o = OUT[state];
  if (o == null) return energy;
  const hours = { ...(energy.hours || {}) };
  const days = { ...(energy.dow || {}) };
  const h = hours[hour] || { s: defaultScore, n: 0 };
  hours[hour] = { s: h.s + 0.15 * (o - h.s), n: h.n + 1 };
  const d = days[dow] || { s: 0.5, n: 0 };
  days[dow] = { s: d.s + 0.1 * (o - d.s), n: d.n + 1 };
  return { hours, dow: days };
}
