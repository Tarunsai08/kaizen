import { db } from '../db';
import { today, addDays, dow, weekStart, range, diffDays, monthStart, monthEnd, yearStart, addMonths, parse, ymd, hmToMin } from './date';

/* =========================================================
   HABITS
   ========================================================= */
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export function habitActiveOn(h, date) {
  if (h.archived) return false;
  const created = h.startDate || (h.createdAt ? ymd(new Date(h.createdAt)) : '2000-01-01');
  if (date < created) return false;
  if (h.endDate && date > h.endDate) return false;
  return true;
}
export function habitDueOn(h, date) {
  if (!habitActiveOn(h, date)) return false;
  if (h.freq === 'weekly') return true;
  return (h.days && h.days.length ? h.days : ALL_DAYS).includes(dow(date));
}

export function sumByDate(logs) {
  const m = {};
  for (const l of logs) m[l.date] = (m[l.date] || 0) + (l.amount || 1);
  return m;
}

// Stats for a build habit over [from, to] (to clipped at today)
export function buildStats(h, logs, from, to = today()) {
  const t = today();
  if (to > t) to = t;
  const byDate = sumByDate(logs);
  const target = h.target || 1;
  const done = (d) => (byDate[d] || 0) >= target;
  const created = h.startDate || (h.createdAt ? ymd(new Date(h.createdAt)) : from);
  if (from < created) from = created;
  let rate = 0;
  let dueCount = 0;
  let doneCount = 0;
  if (from <= to) {
    if (h.freq === 'weekly') {
      const n = h.perWeek || 3;
      let ws = weekStart(from);
      let acc = 0;
      let weeks = 0;
      while (ws <= to) {
        const days = range(ws, addDays(ws, 6)).filter((d) => d >= from && d <= to);
        const c = days.filter(done).length;
        doneCount += c;
        // current (partial) week: only count if it's already complete or finished
        const isCurrent = addDays(ws, 6) > to;
        if (!isCurrent || c >= n) {
          acc += Math.min(1, c / n);
          weeks++;
        }
        ws = addDays(ws, 7);
      }
      dueCount = weeks;
      rate = weeks ? acc / weeks : doneCount > 0 ? 1 : 0;
    } else {
      for (const d of range(from, to)) {
        if (!habitDueOn(h, d)) continue;
        // don't punish today until it's over
        if (d === t && !done(d)) continue;
        dueCount++;
        if (done(d)) doneCount++;
      }
      rate = dueCount ? doneCount / dueCount : 0;
    }
  }
  return { rate, dueCount, doneCount, byDate };
}

export function streak(h, logs) {
  const byDate = sumByDate(logs);
  const target = h.target || 1;
  const done = (d) => (byDate[d] || 0) >= target;
  const t = today();
  if (h.freq === 'weekly') {
    const n = h.perWeek || 3;
    let ws = weekStart(t);
    let s = 0;
    const cnt = (w) => range(w, addDays(w, 6)).filter(done).length;
    if (cnt(ws) >= n) s++;
    ws = addDays(ws, -7);
    for (let i = 0; i < 200 && cnt(ws) >= n; i++) { s++; ws = addDays(ws, -7); }
    return { current: s, unit: 'wk', best: s };
  }
  let d = done(t) ? t : addDays(t, -1);
  let s = 0;
  for (let i = 0; i < 1000; i++) {
    if (!habitActiveOn(h, d) && d < t) break;
    if (habitDueOn(h, d)) {
      if (done(d)) s++;
      else break;
    }
    d = addDays(d, -1);
  }
  // best streak
  let best = 0;
  let run = 0;
  const dates = Object.keys(byDate).sort();
  if (dates.length) {
    for (const day of range(dates[0], t)) {
      if (!habitDueOn(h, day)) continue;
      if (done(day)) { run++; best = Math.max(best, run); } else if (day !== t) run = 0;
    }
  }
  return { current: s, unit: 'd', best: Math.max(best, s) };
}

// Misses this week vs grace allowance
export function graceStatus(h, logs) {
  if (h.freq === 'weekly') return null;
  const byDate = sumByDate(logs);
  const ws = weekStart();
  const t = today();
  let misses = 0;
  for (const d of range(ws, addDays(t, -1))) if (habitDueOn(h, d) && (byDate[d] || 0) < (h.target || 1)) misses++;
  const grace = h.grace || 0;
  return { misses, grace, onTrack: misses <= grace };
}

// Interval adherence: % of interval slots in the window that got at least one log
export function intervalAdherence(h, logs, from, to = today()) {
  if (!h.intervalMins || !h.windowStart || !h.windowEnd) return null;
  const ws = hmToMin(h.windowStart);
  const we = hmToMin(h.windowEnd);
  const slots = Math.max(1, Math.floor((we - ws) / h.intervalMins));
  let hit = 0;
  let total = 0;
  const byDate = {};
  logs.forEach((l) => (byDate[l.date] = byDate[l.date] || []).push(l));
  for (const d of range(from, to)) {
    if (!habitDueOn(h, d) || d === today()) continue;
    total += slots;
    const used = new Set();
    (byDate[d] || []).forEach((l) => {
      const dt = new Date(l.ts);
      const m = dt.getHours() * 60 + dt.getMinutes();
      if (m >= ws && m < we + 30) used.add(Math.min(slots - 1, Math.floor((m - ws) / h.intervalMins)));
    });
    hit += used.size;
  }
  return total ? hit / total : null;
}

/* Break habits */
export function breakStats(urges, from = '2000-01-01', to = '2999-12-31') {
  const inRange = urges.filter((u) => u.date >= from && u.date <= to);
  const urgeLogs = inRange.filter((u) => u.kind === 'urge');
  const resisted = urgeLogs.filter((u) => u.outcome === 'resisted').length;
  const relapses = inRange.filter((u) => u.kind === 'relapse' || u.outcome === 'relapsed');
  const control = urgeLogs.length ? resisted / urgeLogs.length : null;
  // Last relapse (all-time)
  const allRel = urges.filter((u) => u.kind === 'relapse' || u.outcome === 'relapsed').sort((a, b) => a.ts - b.ts);
  const last = allRel[allRel.length - 1];
  const gaps = [];
  for (let i = 1; i < allRel.length; i++) gaps.push((allRel[i].ts - allRel[i - 1].ts) / 86400000);
  const avgGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;
  // delay-success streak (consecutive resisted urges, newest first)
  const sortedUrges = urges.filter((u) => u.kind === 'urge').sort((a, b) => b.ts - a.ts);
  let delayStreak = 0;
  for (const u of sortedUrges) { if (u.outcome === 'resisted') delayStreak++; else break; }
  const triggers = {};
  relapses.forEach((r) => { if (r.trigger) triggers[r.trigger] = (triggers[r.trigger] || 0) + 1; });
  const urgeTriggers = {};
  inRange.forEach((r) => { if (r.trigger) urgeTriggers[r.trigger] = (urgeTriggers[r.trigger] || 0) + 1; });
  return {
    urges: urgeLogs.length, resisted, relapses: relapses.length, control, last, avgGap, delayStreak, triggers, urgeTriggers,
    sinceDays: last ? (Date.now() - last.ts) / 86400000 : null,
  };
}

/* =========================================================
   TODAY / DAY SCORE
   ========================================================= */
export async function computeDay(date = today(), settings) {
  const [habits, logs, workouts, tasks, moods, journal] = await Promise.all([
    db.habits.where('type').equals('build').toArray(),
    db.habitLogs.where('date').between(weekStart(date), addDays(weekStart(date), 6), true, true).toArray(),
    db.workouts.where('date').equals(date).toArray(),
    db.tasks.toArray(),
    db.moods.where('date').equals(date).toArray(),
    db.journal.where('date').equals(date).first(),
  ]);
  // habits
  let hSum = 0;
  let hN = 0;
  for (const h of habits) {
    if (!habitDueOn(h, date)) continue;
    const my = logs.filter((l) => l.habitId === h.id);
    const amt = my.filter((l) => l.date === date).reduce((a, b) => a + (b.amount || 1), 0);
    const target = h.target || 1;
    if (h.freq === 'weekly') {
      const daysDone = Object.entries(sumByDate(my)).filter(([d, v]) => d !== date && v >= target).length;
      if (daysDone >= (h.perWeek || 3) && amt === 0) continue; // week already satisfied
    }
    hSum += Math.min(1, amt / target);
    hN++;
  }
  // workout
  const sched = (settings?.schedule || {})[dow(date)] || [];
  const wDone = workouts.some((w) => w.completed);
  const move = sched.length || workouts.length ? (wDone ? 1 : workouts.length ? 0.5 : 0) : null;
  // tasks
  const tDueToday = tasks.filter((t) => !t.skipped && ((t.due === date && !t.done) || (t.done && t.doneAt && ymd(new Date(t.doneAt)) === date)));
  const tDone = tDueToday.filter((t) => t.done).length;
  const taskV = tDueToday.length ? tDone / tDueToday.length : null;
  // mind
  const mind = (moods.length ? 0.5 : 0) + (journal ? 0.5 : 0);
  const rings = [
    { key: 'habits', label: 'Habits', value: hN ? hSum / hN : null, color: 'var(--habit)' },
    { key: 'move', label: 'Move', value: move, color: 'var(--fit)' },
    { key: 'tasks', label: 'Tasks', value: taskV, color: 'var(--task)' },
    { key: 'mind', label: 'Mind', value: mind, color: 'var(--mood)' },
  ];
  const active = rings.filter((r) => r.value != null);
  const score = active.length ? Math.round((active.reduce((a, b) => a + b.value, 0) / active.length) * 100) : 0;
  return { rings, score, habitsDone: hSum, habitsDue: hN, tasksDone: tDone, tasksTotal: tDueToday.length };
}

/* =========================================================
   TASKS
   ========================================================= */
export function nextDue(due, rec) {
  const base = due || today();
  if (rec === 'daily') return addDays(base, 1);
  if (rec === 'weekdays') {
    let d = addDays(base, 1);
    while ([0, 6].includes(dow(d))) d = addDays(d, 1);
    return d;
  }
  if (rec === 'weekly') return addDays(base, 7);
  if (rec === 'monthly') return addMonths(base, 1);
  if (rec === 'yearly') return addMonths(base, 12);
  return null;
}

export async function completeTask(task, done = true) {
  await db.tasks.update(task.id, { done, doneAt: done ? Date.now() : null });
  if (done && task.recurrence && task.recurrence !== 'none' && !task.spawned) {
    let nd = nextDue(task.due, task.recurrence);
    while (nd < today()) nd = nextDue(nd, task.recurrence);
    const { id, ...rest } = task;
    await db.tasks.update(task.id, { spawned: true });
    await db.tasks.add({ ...rest, due: nd, done: false, doneAt: null, spawned: false, createdAt: Date.now(), subtasks: (task.subtasks || []).map((s) => ({ ...s, done: false })) });
  }
}

// Run once a day: roll overdue recurring tasks forward
export async function rollRecurring() {
  const t = today();
  const all = await db.tasks.toArray();
  for (const task of all) {
    if (task.done || task.spawned || !task.recurrence || task.recurrence === 'none' || !task.due || task.due >= t) continue;
    let nd = nextDue(task.due, task.recurrence);
    while (nd < t) nd = nextDue(nd, task.recurrence);
    const { id, ...rest } = task;
    await db.tasks.update(task.id, { spawned: true, skipped: true });
    await db.tasks.add({ ...rest, due: nd, done: false, doneAt: null, spawned: false, skipped: false, createdAt: Date.now() });
  }
}

/* =========================================================
   GOALS
   ========================================================= */
export function goalPeriod(type, ref = today()) {
  if (type === 'weekly') return [weekStart(ref), addDays(weekStart(ref), 6)];
  if (type === 'monthly') return [monthStart(ref), monthEnd(ref)];
  if (type === 'yearly') return [yearStart(ref), ref.slice(0, 5) + '12-31'];
  return [ref, null];
}
export const DEFAULT_CHECKIN = { weekly: 'daily', monthly: 'twice', yearly: 'weekly', casual: 'biweekly' };
export const CHECKIN_LABEL = { daily: 'Every day', twice: 'Twice a week', weekly: 'Once a week', biweekly: 'Every 2 weeks', never: 'Never' };
export function checkinDays(freq) {
  if (freq === 'daily') return ALL_DAYS;
  if (freq === 'twice') return [1, 4];
  if (freq === 'weekly' || freq === 'biweekly') return [0];
  return [];
}
export function checkinDueToday(goal, lastCheckinDate) {
  const f = goal.checkinFreq || DEFAULT_CHECKIN[goal.type];
  if (f === 'never') return false;
  const t = today();
  if (lastCheckinDate === t) return false;
  if (f === 'biweekly') return !lastCheckinDate || diffDays(t, lastCheckinDate) >= 14;
  return checkinDays(f).includes(dow(t)) || (!lastCheckinDate && f === 'daily');
}
export function goalProgress(goal, tasks) {
  const mine = tasks.filter((t) => t.goalId === goal.id && !t.skipped);
  if (mine.length) {
    const d = mine.filter((t) => t.done).length;
    return { value: d / mine.length, label: `${d}/${mine.length} tasks`, mode: 'tasks' };
  }
  if (goal.target) {
    const v = goal.progress || 0;
    return { value: Math.min(1, v / goal.target), label: `${v}/${goal.target}${goal.unit ? ' ' + goal.unit : ''}`, mode: 'count' };
  }
  const p = goal.progress || 0;
  return { value: p / 100, label: `${p}%`, mode: 'pct' };
}
export function timeLeft(goal) {
  if (goal.type === 'casual' || !goal.periodEnd) return 'No deadline';
  const d = diffDays(goal.periodEnd, today());
  if (d < 0) return 'Ended';
  if (d === 0) return 'Last day';
  if (d === 1) return '1 day left';
  if (d > 60) return `${Math.round(d / 30)} months left`;
  return `${d} days left`;
}

/* =========================================================
   SLEEP
   ========================================================= */
export function sleepMinutes(s) {
  if (!s.bedTs || !s.wakeTs) return null;
  return Math.max(0, (s.wakeTs - s.bedTs) / 60000);
}
// minutes relative to noon, so 11pm and 1am are close together
export const clockMinFromNoon = (ts) => {
  const d = new Date(ts);
  let m = d.getHours() * 60 + d.getMinutes() - 720;
  if (m < 0) m += 1440;
  return m;
};
export const clockMin = (ts) => {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
};
export function stdDev(arr) {
  if (arr.length < 2) return null;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length);
}
export function sleepConsistency(rows) {
  const beds = rows.filter((r) => r.bedTs).map((r) => clockMinFromNoon(r.bedTs));
  const wakes = rows.filter((r) => r.wakeTs).map((r) => clockMin(r.wakeTs));
  const sb = stdDev(beds);
  const sw = stdDev(wakes);
  if (sb == null && sw == null) return { score: null, sb, sw };
  const avgSd = ((sb ?? sw) + (sw ?? sb)) / 2;
  // 0 min spread → 100, 90+ min spread → 0
  const score = Math.max(0, Math.round(100 - (avgSd / 90) * 100));
  return { score, sb, sw };
}

/* =========================================================
   FINANCE
   ========================================================= */
export const money = (v, cur = '₹') => {
  const n = Math.round(Math.abs(v || 0));
  return `${v < 0 ? '−' : ''}${cur}${n.toLocaleString('en-IN')}`;
};
export const moneyShort = (v, cur = '₹') => {
  const n = Math.abs(v || 0);
  if (n >= 100000) return `${cur}${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${cur}${(n / 1000).toFixed(1)}k`;
  return `${cur}${Math.round(n)}`;
};
export const normMerchant = (m = '') => m.toLowerCase().replace(/[^a-z0-9@.]/g, '').slice(0, 40);

export function detectSubscriptions(txs, existing = []) {
  const known = new Set(existing.map((s) => normMerchant(s.merchant || s.name) + '|' + Math.round(s.amount)));
  const groups = {};
  txs.filter((t) => t.direction === 'debit' && t.merchant).forEach((t) => {
    const k = normMerchant(t.merchant) + '|' + Math.round(t.amount);
    (groups[k] = groups[k] || []).push(t);
  });
  const out = [];
  for (const [k, list] of Object.entries(groups)) {
    if (list.length < 2 || known.has(k)) continue;
    const sorted = list.sort((a, b) => a.ts - b.ts);
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) gaps.push((sorted[i].ts - sorted[i - 1].ts) / 86400000);
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    let cycle = null;
    if (Math.abs(avg - 7) <= 2) cycle = 'weekly';
    else if (Math.abs(avg - 30) <= 4) cycle = 'monthly';
    else if (Math.abs(avg - 365) <= 10) cycle = 'yearly';
    if (!cycle) continue;
    const last = sorted[sorted.length - 1];
    out.push({ key: k, merchant: last.merchant, amount: last.amount, cycle, count: list.length, lastDate: last.date, categoryId: last.categoryId });
  }
  return out;
}
export const monthlyCost = (s) => (s.cycle === 'weekly' ? (s.amount * 52) / 12 : s.cycle === 'yearly' ? s.amount / 12 : s.amount);
export function nextRenewal(s) {
  let d = s.nextDate || today();
  const step = (x) => (s.cycle === 'weekly' ? addDays(x, 7) : s.cycle === 'yearly' ? addMonths(x, 12) : addMonths(x, 1));
  let guard = 0;
  while (d < today() && guard++ < 500) d = step(d);
  return d;
}

/* =========================================================
   INSIGHTS (mood correlations)
   ========================================================= */
export async function dailyMatrix(days = 90) {
  const from = addDays(today(), -days);
  const [moods, journal, sleep, workouts, urges, txs, tasks, boredom] = await Promise.all([
    db.moods.where('date').aboveOrEqual(from).toArray(),
    db.journal.where('date').aboveOrEqual(from).toArray(),
    db.sleep.where('date').aboveOrEqual(from).toArray(),
    db.workouts.where('date').aboveOrEqual(from).toArray(),
    db.urges.where('date').aboveOrEqual(from).toArray(),
    db.transactions.where('date').aboveOrEqual(from).toArray(),
    db.tasks.toArray(),
    db.boredom.where('date').aboveOrEqual(from).toArray(),
  ]);
  const M = {};
  const get = (d) => (M[d] = M[d] || { date: d, moods: [] });
  moods.forEach((m) => get(m.date).moods.push(m.mood));
  journal.forEach((j) => { const r = get(j.date); if (j.mood) r.moods.push(j.mood); r.stress = j.stress; r.energy = j.energy; });
  sleep.forEach((s) => { const r = get(s.date); r.sleepMin = sleepMinutes(s); r.sleepQ = s.quality; });
  workouts.forEach((w) => { if (w.completed) get(w.date).workout = true; });
  urges.forEach((u) => { if (u.kind === 'relapse' || u.outcome === 'relapsed') { const r = get(u.date); r.relapses = (r.relapses || 0) + 1; } });
  txs.forEach((t) => { if (t.direction === 'debit') { const r = get(t.date); r.spend = (r.spend || 0) + t.amount; } });
  tasks.forEach((t) => { if (t.done && t.doneAt) { const d = ymd(new Date(t.doneAt)); if (d >= from) { const r = get(d); r.tasksDone = (r.tasksDone || 0) + 1; } } });
  boredom.forEach((b) => get(b.date));
  Object.values(M).forEach((r) => { r.mood = r.moods.length ? r.moods.reduce((a, b) => a + b, 0) / r.moods.length : null; });
  return { M, boredom };
}

const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

export async function computeInsights() {
  const { M, boredom } = await dailyMatrix(120);
  const rows = Object.values(M);
  const withMood = rows.filter((r) => r.mood != null);
  const out = [];
  const compare = (predicate, yesText, noText, icon) => {
    const a = withMood.filter(predicate).map((r) => r.mood);
    const b = withMood.filter((r) => !predicate(r)).map((r) => r.mood);
    if (a.length < 3 || b.length < 3) return;
    const d = avg(a) - avg(b);
    if (Math.abs(d) < 0.25) return;
    out.push({ icon, text: d > 0 ? yesText : noText, strength: Math.abs(d), detail: `${avg(a).toFixed(1)} vs ${avg(b).toFixed(1)} avg mood` });
  };
  compare((r) => r.workout, 'Your mood averages higher on days you work out.', 'Your mood tends to be lower on workout days — maybe the routine is too heavy?', '🏋️');
  compare((r) => r.sleepMin != null && r.sleepMin >= 420, 'You feel better after 7+ hours of sleep.', 'Interesting — more sleep isn’t lifting your mood right now.', '😴');
  compare((r) => (r.relapses || 0) > 0, 'Mood dips on days with a relapse. Be kind to yourself on those days.', 'Relapse days don’t seem to lower your mood much.', '🔁');
  compare((r) => (r.tasksDone || 0) >= 3, 'Getting 3+ tasks done lines up with better days.', 'Busy task days tend to feel heavier.', '✅');
  // spending vs stress
  const st = rows.filter((r) => r.stress != null);
  const hi = st.filter((r) => r.stress >= 4).map((r) => r.spend || 0);
  const lo = st.filter((r) => r.stress <= 2).map((r) => r.spend || 0);
  if (hi.length >= 3 && lo.length >= 3 && avg(lo) > 0) {
    const ratio = avg(hi) / avg(lo);
    if (ratio > 1.25) out.push({ icon: '💸', text: `You spend about ${Math.round((ratio - 1) * 100)}% more on stressful days.`, strength: ratio - 1, detail: 'High stress (4–5) vs low stress (1–2) days' });
    else if (ratio < 0.8) out.push({ icon: '💸', text: 'You actually spend less on stressful days.', strength: 1 - ratio, detail: '' });
  }
  // task completion vs sleep
  const sl = rows.filter((r) => r.sleepMin != null);
  const good = sl.filter((r) => r.sleepMin >= 420).map((r) => r.tasksDone || 0);
  const bad = sl.filter((r) => r.sleepMin < 390).map((r) => r.tasksDone || 0);
  if (good.length >= 3 && bad.length >= 3 && Math.abs(avg(good) - avg(bad)) >= 0.7) {
    out.push({ icon: '⚡', text: avg(good) > avg(bad) ? 'You finish more tasks after a good night’s sleep.' : 'Short sleep hasn’t hurt your task output (yet).', strength: 0.5, detail: `${avg(good).toFixed(1)} vs ${avg(bad).toFixed(1)} tasks/day` });
  }
  // boredom options
  const byOpt = {};
  boredom.forEach((b) => { if (b.feeling) (byOpt[b.option] = byOpt[b.option] || []).push(b.feeling === 'better' ? 1 : b.feeling === 'worse' ? -1 : 0); });
  const names = { stay: 'staying with boredom', site: 'exploring websites', hobby: 'a hobby' };
  const ranked = Object.entries(byOpt).filter(([, v]) => v.length >= 2).map(([k, v]) => [k, avg(v)]).sort((a, b) => b[1] - a[1]);
  if (ranked.length && ranked[0][1] > 0.2) out.push({ icon: '🎈', text: `When bored, ${names[ranked[0][0]]} leaves you feeling best.`, strength: ranked[0][1], detail: '' });
  return out.sort((a, b) => b.strength - a.strength);
}

export { avg };
export const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
export const parseD = parse;
