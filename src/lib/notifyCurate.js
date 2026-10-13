// Smart notifications: decide which reminders are worth interrupting you for.
// Pure functions (no Capacitor, no database) so they can be unit-tested.
//
// Every notification carries a priority:
//   critical: reminders you set yourself on a task          → always sent
//   high:     planner session starts, morning/night check-ins, goal check-ins, a habit's own reminder time
//   low:      repeating habit nudges, study, revision, people, learning nuggets, session "time check"
//
// Modes:
//   essential: critical + high only
//   smart:     (default) high/critical as usual; low ones respect quiet hours, a daily limit, are skipped when
//              already done, at most one nugget a day, and low ones that land close together become one notification
//   all:       everything, as before

const DAY = 864e5;

/** Turn repeating schedules ({ on: { hour, minute, weekday? } }) into one-shots for the next `days` days. */
export function expand(list, now = Date.now(), days = 7) {
  const out = [];
  const base = new Date(now); base.setHours(0, 0, 0, 0);
  for (const n of list) {
    const on = n.schedule?.on;
    if (!on) { if (n.schedule?.at && +new Date(n.schedule.at) > now) out.push(n); continue; }
    for (let d = 0; d < days; d++) {
      const at = new Date(base.getTime() + d * DAY);
      at.setHours(on.hour ?? 9, on.minute ?? 0, 0, 0);
      if (on.weekday && at.getDay() + 1 !== on.weekday) continue;
      if (at.getTime() <= now) continue;
      out.push({ ...n, schedule: { at, allowWhileIdle: true } });
    }
  }
  return out;
}

const dayKey = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };

/**
 * @param list   notifications with schedule.at (run expand() first)
 * @param opts   { mode, now, quiet(ms) → bool, budget, gapMin, doneToday: Set of `${kind}:${id}` }
 */
export function curate(list, { mode = 'smart', now = Date.now(), quiet = () => false, budget = 4, gapMin = 40, doneToday = new Set() } = {}) {
  const at = (n) => +new Date(n.schedule.at);
  let items = list.filter((n) => n.schedule?.at && at(n) > now).sort((a, b) => at(a) - at(b));
  if (mode === 'all') return items;
  const pri = (n) => n.pri || 'low';
  if (mode === 'essential') return items.filter((n) => pri(n) !== 'low');

  const today = dayKey(now);
  // 1. things already done today don't need a reminder today
  items = items.filter((n) => !(n.ref && dayKey(at(n)) === today && doneToday.has(n.ref)));
  // 2. the after-session "time check" belongs in the app, not in a notification
  items = items.filter((n) => n.extra?.end !== true);
  // 3. quiet hours (sleep, class) silence everything that isn't critical
  items = items.filter((n) => pri(n) === 'critical' || !quiet(at(n)));
  // 4. repeating nudges for the same habit: at most 3 a day (first, middle, last)
  const byHabitDay = new Map();
  items.forEach((n) => { if (n.repeatOf) { const k = n.repeatOf + '|' + dayKey(at(n)); (byHabitDay.get(k) || byHabitDay.set(k, []).get(k)).push(n); } });
  const dropRepeat = new Set();
  byHabitDay.forEach((arr) => { if (arr.length > 3) { const keep = new Set([arr[0], arr[Math.floor(arr.length / 2)], arr[arr.length - 1]]); arr.forEach((n) => !keep.has(n) && dropRepeat.add(n)); } });
  items = items.filter((n) => !dropRepeat.has(n));
  // 5. at most one learning nugget a day
  const nug = new Set();
  items = items.filter((n) => { if (n.extra?.route !== 'nugget') return true; const k = dayKey(at(n)); if (nug.has(k)) return false; nug.add(k); return true; });
  // 6. low-priority ones close together become one, and each day has a limit
  const out = [];
  const lowCount = new Map();
  for (const n of items) {
    if (pri(n) !== 'low') { out.push(n); continue; }
    const k = dayKey(at(n));
    const prev = out[out.length - 1];
    if (prev && pri(prev) === 'low' && at(n) - at(prev) <= gapMin * 60000 && dayKey(at(prev)) === k) {
      const parts = prev.parts || [prev];
      const merged = [...parts, n];
      out[out.length - 1] = {
        ...prev, parts: merged,
        title: `${merged.length} small things`,
        body: merged.map((x) => '• ' + clean(x.title)).join('\n'),
      };
      continue;
    }
    if ((lowCount.get(k) || 0) >= budget) continue;
    lowCount.set(k, (lowCount.get(k) || 0) + 1);
    out.push(n);
  }
  return out.map(({ parts, ...n }) => n);
}

const clean = (s) => String(s || '').replace(/^[^\p{L}\p{N}]+\s*/u, '');
