// XP, levels, companion growth and streak freezes. Everything is derived from existing data,
// so it can never drift out of sync and is recomputed on the fly.
import { db, setKV } from '../db';
import { today, addDays, ymd, monthStart, addMonths, monthEnd } from './date';
import { sumByDate, sleepMinutes } from './logic';

export const AREAS = {
  body: { label: 'Body', color: 'var(--fit)', icon: 'i:Dumbbell' },
  mind: { label: 'Mind', color: 'var(--mood)', icon: 'i:Brain' },
  work: { label: 'Work', color: 'var(--task)', icon: 'i:Laptop' },
  learn: { label: 'Learning', color: '#a78bfa', icon: 'i:GraduationCap' },
  money: { label: 'Money', color: 'var(--money)', icon: 'i:Wallet' },
  social: { label: 'People', color: 'var(--goal)', icon: 'i:Users' },
};
const CAT_AREA = { health: 'body', fitness: 'body', mindfulness: 'mind', productivity: 'work', relationships: 'social', career: 'work', money: 'money', growth: 'mind' };

// Level curve: thresholds grow like 0, 100, 300, 600, 1000 … (×unit)
export function levelFor(xp, unit = 100) {
  const lvl = Math.floor((Math.sqrt(1 + (8 * xp) / unit) - 1) / 2) + 1;
  const cur = (unit * (lvl - 1) * lvl) / 2;
  const next = (unit * lvl * (lvl + 1)) / 2;
  return { level: lvl, xp, cur, next, progress: (xp - cur) / (next - cur) };
}

export async function computeXP() {
  const [habits, cats, logs, urges, workouts, sleep, moods, journal, tasks, goals, focus, breaths, reframes, wheels, interactions, boredom, steps, txs] = await Promise.all([
    db.habits.toArray(), db.categories.toArray(), db.habitLogs.toArray(), db.urges.toArray(), db.workouts.toArray(), db.sleep.toArray(),
    db.moods.toArray(), db.journal.toArray(), db.tasks.toArray(), db.goals.toArray(), db.focus.toArray(), db.breaths.toArray(),
    db.reframes.toArray(), db.wheels.toArray(), db.interactions.toArray(), db.boredom.toArray(), db.steps.toArray(), db.transactions.toArray(),
  ]);
  const t = today();
  const areas = { body: 0, mind: 0, work: 0, learn: 0, money: 0, social: 0 };
  const todayXP = { v: 0 };
  const add = (area, xp, date) => { areas[area] += xp; if (date === t) todayXP.v += xp; };

  const catName = (id) => (cats.find((c) => c.id === id)?.name || '').toLowerCase();
  for (const h of habits) {
    if (h.type !== 'build') continue;
    const area = h.area || CAT_AREA[catName(h.categoryId)] || 'mind';
    const byDate = sumByDate(logs.filter((l) => l.habitId === h.id));
    for (const [d, v] of Object.entries(byDate)) if (v >= (h.target || 1)) add(area, 10, d);
  }
  urges.forEach((u) => { if (u.kind === 'urge' && u.outcome === 'resisted') add('mind', 15, u.date); });
  workouts.forEach((w) => { if (w.completed) add('body', w.willing === false ? 20 : 30, w.date); });
  sleep.forEach((s) => { if (sleepMinutes(s) > 0) add('body', 5, s.date); });
  const moodPerDay = {};
  moods.forEach((m) => { moodPerDay[m.date] = (moodPerDay[m.date] || 0) + 1; if (moodPerDay[m.date] <= 3) add('mind', 2, m.date); });
  journal.forEach((j) => add('mind', j.quick ? 8 : 15, j.date));
  tasks.forEach((x) => { if (x.done && x.doneAt) add('work', x.priority === 'high' ? 15 : 8, ymd(new Date(x.doneAt))); });
  goals.forEach((g) => {
    const d = g.reviewedAt ? ymd(new Date(g.reviewedAt)) : g.periodEnd;
    const area = CAT_AREA[catName(g.categoryId)] || 'work';
    if (g.status === 'achieved') add(area, 100, d);
    else if (g.status === 'partial') add(area, 40, d);
  });
  focus.forEach((f) => add('work', Math.round((f.minutes || 0) / 5) * 2, f.date));
  breaths.forEach((b) => add('mind', 5, b.date));
  reframes.forEach((r) => add('mind', 10, r.date));
  wheels.forEach((w) => add('mind', 10, w.date || w.month));
  interactions.forEach((i) => add('social', 12, i.date));
  boredom.forEach((b) => add('mind', 4, b.date));
  steps.forEach((s) => { if (s.count >= 8000) add('body', 10, s.date); else if (s.count >= 5000) add('body', 5, s.date); });
  const tagged = {};
  txs.forEach((x) => { if (x.tagged) { tagged[x.date] = (tagged[x.date] || 0) + 1; if (tagged[x.date] <= 5) add('money', 2, x.date); } });
  // positive savings months
  const months = {};
  txs.forEach((x) => { const m = x.date.slice(0, 7); months[m] = (months[m] || 0) + (x.direction === 'credit' ? x.amount : -x.amount); });
  Object.entries(months).forEach(([m, v]) => { if (v > 0 && m < t.slice(0, 7)) add('money', 50, monthEnd(m + '-01')); });

  const [prog, revs, expLogs, learnings] = await Promise.all([db.progress.toArray(), db.reviews.toArray(), db.expLogs.toArray(), db.learnings.toArray()]);
  prog.forEach((p) => { if (p.done && p.doneAt) add('learn', p.bulk ? 2 : 20, p.doneAt); });
  revs.forEach((r) => add('learn', 3, r.date));
  expLogs.forEach((l) => { if (l.did) add('mind', 6, l.date); });
  learnings.forEach((l) => add('learn', 3, l.date));
  const total = Object.values(areas).reduce((a, b) => a + b, 0);
  const out = { total: levelFor(total, 100), today: todayXP.v, areas: {} };
  for (const k of Object.keys(areas)) out.areas[k] = levelFor(areas[k], 40);
  return out;
}

/* ---------- Companion ---------- */
export const STAGES = [
  { min: 1, name: 'Seed', line: 'Something is starting.' },
  { min: 2, name: 'Sprout', line: 'First leaves. Keep going.' },
  { min: 4, name: 'Seedling', line: 'Getting sturdier every day.' },
  { min: 7, name: 'Sapling', line: 'Roots are deep now.' },
  { min: 11, name: 'Young tree', line: 'Weathering storms.' },
  { min: 16, name: 'Tree', line: 'Solid, steady, growing.' },
  { min: 22, name: 'Blooming tree', line: 'Look at you.' },
  { min: 30, name: 'Fruit tree', line: 'Your habits are bearing fruit.' },
  { min: 40, name: 'Golden tree', line: 'Rare. Consistent. Yours.' },
  { min: 55, name: 'Starlit tree', line: 'Growing even while you sleep.' },
  { min: 75, name: 'Ancient tree', line: 'Deep roots, quiet strength.' },
  { min: 100, name: 'Eternal tree', line: 'Kaizen: it never stops.' },
];
// Past level 100 Kai keeps growing: one extra ✦ every 25 levels, forever.
export function stageFor(level) {
  let i = 0;
  STAGES.forEach((s, k) => { if (level >= s.min) i = k; });
  const last = STAGES.length - 1;
  if (i === last && level >= 125) {
    const stars = Math.floor((level - 100) / 25);
    return { index: i, stars, min: 100 + stars * 25, name: `${STAGES[last].name} ${'✦'.repeat(Math.min(stars, 5))}${stars > 5 ? stars : ''}`, line: STAGES[last].line, next: { min: 100 + (stars + 1) * 25, name: `${STAGES[last].name} ✦${stars + 1}` } };
  }
  return { index: i, stars: 0, ...STAGES[i], next: STAGES[i + 1] || { min: 125, name: `${STAGES[last].name} ✦` } };
}

/* ---------- Streak freezes ----------
   • Earn 1 freeze for every 7 good days in a row (day score ≥ 60). Hold up to 3.
   • If yesterday wasn't a good day and you had momentum, a freeze is spent automatically.
   • You can also spend one in advance on a sick / travel day ("rest day").
   Frozen days count as good days for momentum and don't count as misses for habits. */
export const GOOD = 60;
export function isGood(scores, frozen, d) {
  return (scores[d] ?? -1) >= GOOD || frozen.includes(d);
}
export function momentumUntil(scores, frozen, end) {
  let n = 0;
  for (let d = end; isGood(scores, frozen, d) && n < 3650; d = addDays(d, -1)) n++;
  return n;
}
export async function maintainFreezes(settings) {
  const t = today();
  if (settings.freezeChecked === t) return;
  const scores = settings.scores || {};
  let frozen = [...(settings.frozenDays || [])];
  let freezes = settings.freezes ?? 0;
  const y = addDays(t, -1);
  const y2 = addDays(t, -2);
  // auto-protect yesterday
  if (!isGood(scores, frozen, y) && freezes > 0 && momentumUntil(scores, frozen, y2) >= 2 && scores[y] !== undefined) {
    frozen.push(y);
    freezes--;
    await setKV('freezeUsedNotice', y);
  }
  // earn
  const m = momentumUntil(scores, frozen, y);
  if (m > 0 && m % 7 === 0 && settings.freezeEarnedFor !== y && freezes < 3) {
    freezes++;
    await setKV('freezeEarnedFor', y);
    await setKV('freezeEarnedNotice', y);
  }
  frozen = frozen.filter((d) => d >= addDays(t, -400));
  await setKV('frozenDays', frozen);
  await setKV('freezes', freezes);
  await setKV('freezeChecked', t);
}
export async function takeRestDay(settings) {
  const t = today();
  const frozen = settings.frozenDays || [];
  if (frozen.includes(t) || (settings.freezes ?? 0) <= 0) return false;
  await setKV('frozenDays', [...frozen, t]);
  await setKV('freezes', settings.freezes - 1);
  return true;
}

export { monthStart, addMonths };
