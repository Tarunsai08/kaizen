// Sleep debt & daily energy curve (inspired by Rise). These are estimates from a simple
// circadian model, not medical measurements — the UI says so.
import { today, addDays, fmtHM } from './date';
import { sleepMinutes } from './logic';

// Weighted deficit over the last 14 nights: last night counts most, 14 nights ago least.
export function sleepDebt(rows, needHours = 8) {
  const t = today();
  let debt = 0;
  let nights = 0;
  for (let i = 0; i < 14; i++) {
    const d = addDays(t, -i);
    const r = rows.find((x) => x.date === d);
    const m = r ? sleepMinutes(r) : null;
    if (!m) continue;
    nights++;
    const w = 1 - (i / 14) * 0.7;
    const diff = needHours - m / 60;
    debt += (diff > 0 ? diff : diff * 0.5) * w;
  }
  debt = Math.max(0, debt);
  const level = debt < 2 ? 'Low' : debt < 5 ? 'Moderate' : 'High';
  return { hours: debt, nights, level };
}

const g = (x, mu, s) => Math.exp(-((x - mu) ** 2) / (2 * s * s));

// Energy (0..1) at `h` hours after waking
export function energyAt(h, debtHours = 0) {
  let e = 0.34 + 0.46 * g(h, 3.6, 2.3) + 0.36 * g(h, 11, 2.1) - 0.24 * g(h, 7.8, 1.3) - 0.32 * g(h, 0.2, 0.7);
  if (h > 13.5) e -= (h - 13.5) * 0.09;
  e *= 1 - Math.min(0.3, debtHours / 16);
  return Math.max(0.05, Math.min(1, e));
}

const minToHM = (m) => {
  m = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

// wakeMin/bedMin: minutes after midnight
export function energyDay(wakeMin, bedMin, debtHours) {
  let span = bedMin - wakeMin;
  if (span <= 0) span += 1440;
  const pts = [];
  for (let m = 0; m <= span; m += 15) pts.push({ min: wakeMin + m, h: m / 60, e: energyAt(m / 60, debtHours) });
  const zones = [
    { key: 'groggy', label: 'Grogginess', from: wakeMin, to: wakeMin + 90, tip: 'Get daylight, water, move a little.' },
    { key: 'peak1', label: 'Morning peak', from: wakeMin + 150, to: wakeMin + 330, tip: 'Best time for deep, hard work.' },
    { key: 'dip', label: 'Afternoon dip', from: wakeMin + 390, to: wakeMin + 570, tip: 'Easy tasks, a walk, or a 20-min nap.' },
    { key: 'peak2', label: 'Evening peak', from: wakeMin + 600, to: wakeMin + 750, tip: 'Good for exercise and social time.' },
    { key: 'wind', label: 'Wind down', from: wakeMin + span - 120, to: wakeMin + span, tip: 'Dim lights, no screens, no caffeine.' },
  ];
  return { pts, zones, span };
}

export function currentZone(wakeMin, bedMin, debtHours, nowMin) {
  const { zones } = energyDay(wakeMin, bedMin, debtHours);
  let n = nowMin;
  if (n < wakeMin) n += 1440;
  const z = zones.find((x) => n >= x.from && n < x.to);
  if (z) return { ...z, untilLabel: fmtHM(minToHM(z.to)) };
  const next = zones.find((x) => x.from > n);
  return next ? { key: 'steady', label: 'Steady energy', tip: `${next.label} from ${fmtHM(minToHM(next.from))}`, untilLabel: fmtHM(minToHM(next.from)) } : { key: 'late', label: 'Past bedtime', tip: 'Sleep is the best productivity tool.', untilLabel: '' };
}
export { minToHM };
