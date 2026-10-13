// Glue between Kaizen's data (Dexie) and the pure scheduler. Everything here is on-device.
import { db, getKV, setKV, DEFAULT_SETTINGS } from '../db';
import { today, addDays, parse, hmToMin, ymd, dayOf } from '../lib/date';
import { sleepMinutes } from '../lib/logic';
import { buildPlan, estimateHours, updateCorrection, updateEnergy, DEFAULT_FACTORS } from '../scheduler';

export const BLOCK_TYPES = [
  { value: 'CLASS', label: 'Class', color: '#60a5fa' }, { value: 'MEAL', label: 'Meal', color: '#fb923c' },
  { value: 'BATH', label: 'Bath', color: '#2dd4bf' }, { value: 'GYM', label: 'Gym', color: '#f87171' },
  { value: 'SLEEP', label: 'Sleep', color: '#a78bfa' }, { value: 'CALL', label: 'Call', color: '#f472b6' },
  { value: 'COMMUTE', label: 'Commute', color: '#94a3b8' }, { value: 'OTHER', label: 'Other', color: '#facc15' },
];
export const typeColor = (t) => BLOCK_TYPES.find((x) => x.value === t)?.color || '#94a3b8';
export const TEMPLATES = [
  { title: 'Breakfast', type: 'MEAL', start: 8 * 60, end: 8 * 60 + 30, days: [0, 1, 2, 3, 4, 5, 6] },
  { title: 'Lunch', type: 'MEAL', start: 13 * 60, end: 13 * 60 + 45, days: [0, 1, 2, 3, 4, 5, 6] },
  { title: 'Dinner', type: 'MEAL', start: 20 * 60, end: 20 * 60 + 45, days: [0, 1, 2, 3, 4, 5, 6] },
  { title: 'Bath', type: 'BATH', start: 7 * 60, end: 7 * 60 + 30, days: [0, 1, 2, 3, 4, 5, 6] },
  { title: 'Gym', type: 'GYM', start: 18 * 60, end: 19 * 60, days: [1, 3, 5], flexible: true, flexStart: 17 * 60, flexEnd: 20 * 60 },
  { title: 'Sleep', type: 'SLEEP', start: 23 * 60, end: 7 * 60, days: [0, 1, 2, 3, 4, 5, 6] },
  { title: 'Call home', type: 'CALL', start: 21 * 60, end: 21 * 60 + 20, days: [0, 6] },
];
const tsOf = (date, hm) => { const d = parse(date); const [h, m] = (hm || '23:59').split(':').map(Number); d.setHours(h, m, 0, 0); return d.getTime(); };
const minOf = (ts) => { const d = new Date(ts); return d.getHours() * 60 + d.getMinutes(); };
export const plannerSettings = (settings) => ({ ...DEFAULT_SETTINGS.planner, ...(settings.planner || {}) });

/* ---------- day context from Kaizen's own check-ins ---------- */
export async function dayContext(date, settings) {
  const [sleep, moods, lowKV] = await Promise.all([db.sleep.where('date').equals(date).first(), db.moods.where('date').equals(date).toArray(), getKV('lowEnergy', '')]);
  moods.sort((a, b) => a.ts - b.ts);
  const morning = moods.find((m) => m.kind === 'morning') || moods[0];
  const withEnergy = [...moods].reverse().find((m) => m.energy);
  const sm = sleep ? sleepMinutes(sleep) : null;
  return {
    mood: morning?.mood ?? null,
    energy: withEnergy?.energy ?? null,
    sleepH: sm ? sm / 60 : null,
    wakeMin: sleep?.wakeTs ? minOf(sleep.wakeTs) : null,
    lowEnergy: lowKV === date,
  };
}

/* ---------- tasks -> scheduler input ---------- */
const isPlannerTask = (t) => t.difficulty != null || !!t.pcat;
export function toSchedTasks(rows, logs, t) {
  const spent = {};
  logs.forEach((l) => { spent[l.taskId] = (spent[l.taskId] || 0) + l.actualMin; });
  const busy = [];
  const seen = new Map();
  const out = [];
  const open = rows.filter((x) => !x.done && !x.skipped).sort((a, b) => (a.due || '9').localeCompare(b.due || '9'));
  for (const x of open) {
    const planner = isPlannerTask(x);
    if (!x.due && x.plan !== true) continue; // someday tasks only join the plan when asked
    if (x.due && x.dueTime && !planner) { busy.push({ date: x.due, start: hmToMin(x.dueTime), end: hmToMin(x.dueTime) + (x.duration || 30), taskId: x.id }); continue; }
    const rec = x.recurrence && x.recurrence !== 'none';
    if (rec) { const k = x.title + '|' + x.recurrence; if (seen.has(k)) continue; seen.set(k, 1); }
    const subs = (x.subtasks || []).map((s) => ({ id: s.id, title: s.title, done: !!s.done, difficulty: s.difficulty, estHours: s.estHours }));
    const o = {
      id: x.id, title: x.title, category: x.pcat || 'OTHER', difficulty: x.difficulty ?? 1,
      estHours: x.estHours ?? (planner ? undefined : (x.duration || 30) / 60),
      deadline: x.due ? tsOf(x.due, x.dueTime || '23:59') : null, subtasks: subs, spentMin: spent[x.id] || 0, planNudged: !!x.planNudged,
    };
    if (rec) {
      const days = x.recurrence === 'weekdays' ? [1, 2, 3, 4, 5] : x.recurrence === 'weekly' ? [parse(x.due || t).getDay()] : null;
      o.recurring = { minutes: Math.round((x.estHours ?? (x.duration || 60) / 60) * 60), days, from: x.due || t, ghost: true };
      o.deadline = null;
    }
    out.push(o);
  }
  return { tasks: out, busy };
}

let running = Promise.resolve();
/** Re-plan today (future part) and the next 6 days. Never touches pinned, done, partial or skipped sessions. */
export function replan(settings, reason = 'edit') {
  running = running.then(() => doReplan(settings, reason)).catch((e) => { console.warn('replan', e); return null; });
  return running;
}

async function doReplan(settings, reason) {
  const t = today();
  const ps = plannerSettings(settings);
  const now = Date.now();
  const nowMin = minOf(now);
  const [rows, logs, fixed, events, sessions, stats, ctx, swapped, calib, pull] = await Promise.all([
    db.tasks.toArray(), db.workLogs.toArray(), db.fixedBlocks.toArray(), db.calEvents.toArray(), db.plannedSessions.where('date').aboveOrEqual(t).toArray(),
    getKV('plannerStats', DEFAULT_SETTINGS.plannerStats), dayContext(t, settings), getKV('swapped', {}), getKV('capCalib', null), getKV('pull', null),
  ]);
  // sessions whose time passed without an answer count as skipped (quietly, no learning)
  const stale = sessions.filter((s) => s.state === 'PLANNED' && !s.pinned && s.kind !== 'BREAK' && s.date === t && s.end + 15 <= nowMin);
  const before = sessions.filter((s) => s.state === 'PLANNED' && !s.pinned && !(s.date === t && s.start < nowMin));
  const locked = sessions.filter((s) => s.kind !== 'BREAK' && (s.pinned || s.state !== 'PLANNED' || (s.date === t && s.start < nowMin)));
  const { tasks, busy } = toSchedTasks(rows, logs.filter((l) => !subDone(rows, l)), t);
  tasks.forEach((x) => { if (swapped[x.id] === t) x.deferToday = true; if (pull && pull.date === t && pull.taskId === x.id) x.boost = true; });
  const bedMin = hmToMin(settings.bedtimeTarget || '23:00');
  const out = buildPlan({
    now, today: t, tasks, busy, fixed, locked,
    events: events.filter((e) => !ps.calendars.length || ps.calendars.includes(e.calendarId)).map((e) => ({ ...e })),
    ctx, stats,
    settings: { sessionMin: ps.sessionMin, breakMin: ps.breakMin, capacityH: ps.capacityH, bufferMin: ps.bufferMin, deadlineBufferDays: ps.deadlineBufferDays, factors: { ...DEFAULT_FACTORS, ...ps.factors }, wakeMin: hmToMin(settings.wakeTarget || '07:00'), bedMin: bedMin < hmToMin(settings.wakeTarget || '07:00') ? 1380 : bedMin },
    todayFactor: calib && calib.for === t ? calib.f : 1,
    nextFactor: 1,
  });
  await db.transaction('rw', db.plannedSessions, db.kv, async () => {
    await db.plannedSessions.bulkDelete(before.map((s) => s.id));
    for (const s of stale) await db.plannedSessions.update(s.id, { state: 'SKIPPED', auto: true });
    await db.plannedSessions.bulkAdd(out.sessions.map((s) => ({ ...s, state: 'PLANNED', pinned: false })));
  });
  // a small, dismissible note describing what moved
  let note = null;
  if (reason !== 'open' && reason !== 'startup') {
    const key = (s) => `${s.taskId}|${s.subId}`;
    const prev = new Map(before.filter((s) => s.date === t && s.kind !== 'BREAK').map((s) => [key(s), s]));
    const moved = out.sessions.find((s) => s.date === t && s.kind !== 'BREAK' && prev.has(key(s)) && prev.get(key(s)).start !== s.start);
    if (moved) note = `Plan updated: moved “${moved.title}” to ${hm12(moved.start)}`;
    else if (out.lowDay && reason === 'checkin') note = 'Lighter plan today. Starting with an easy win.';
    else if (reason === 'skip' || reason === 'partial' || reason === 'overrun') note = 'Plan updated: remaining work moved forward';
  }
  await setKV('planMeta', { at: now, note, noteId: note ? now : null, atRisk: out.atRisk, offers: out.offers, lowDay: out.lowDay, goodDay: out.goodDay, notes: out.notes, unplaced: out.unplaced.length });
  return out;
}
const subDone = (rows, l) => { if (!l.subId) return false; const t = rows.find((x) => x.id === l.taskId); const s = t?.subtasks?.find((z) => z.id === l.subId); return !!s?.done; };
export const hm12 = (m) => { const h = Math.floor(m / 60) % 24, mm = m % 60; return `${h % 12 || 12}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
export const dur = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`);

/* ---------- session actions ---------- */
async function learnFrom(s, state, actualMin) {
  const stats = await getKV('plannerStats', DEFAULT_SETTINGS.plannerStats);
  const task = s.taskId ? await db.tasks.get(s.taskId) : null;
  let next = { ...stats, energy: updateEnergy(stats.energy, Math.floor(s.start / 60), new Date(s.date + 'T12:00').getDay(), state) };
  if (state !== 'SKIPPED' && task && actualMin && s.timed) next.correction = updateCorrection(stats.correction, task.pcat || 'OTHER', actualMin, s.end - s.start);
  await setKV('plannerStats', next);
}
export async function startSession(id) {
  const s = await db.plannedSessions.get(id);
  if (s && !s.startedAt) await db.plannedSessions.update(id, { startedAt: Date.now() });
}
export async function finishSession(id, state = 'DONE', actualMin = null, perceived = null) {
  const s = await db.plannedSessions.get(id);
  if (!s) return;
  const planned = s.end - s.start;
  const timed = s.startedAt ? Math.max(1, Math.round((Date.now() - s.startedAt) / 60000)) : null;
  const actual = actualMin ?? (state === 'PARTIAL' ? Math.round(planned / 2) : timed && timed < 240 ? timed : planned);
  await db.plannedSessions.update(id, { state, actualMin: actual, doneAt: Date.now(), timed: !!(s.startedAt || actualMin) });
  if (state !== 'SKIPPED' && s.taskId) await db.workLogs.add({ sessionId: id, taskId: s.taskId, subId: s.subId ?? null, date: s.date, actualMin: actual, completedAt: Date.now(), perceived });
  if (!s.auto) await learnFrom({ ...s, timed: !!(s.startedAt || actualMin) }, state, actual);
  return actual;
}
export async function extendSession(id, mins = 15) {
  const s = await db.plannedSessions.get(id);
  if (s) await db.plannedSessions.update(id, { end: s.end + mins, pinned: true });
}
export async function snoozeSession(id, mins = 10) {
  const s = await db.plannedSessions.get(id);
  if (s) await db.plannedSessions.update(id, { start: s.start + mins, end: s.end + mins, pinned: true });
}
export async function editSession(id, patch) { await db.plannedSessions.update(id, { ...patch, pinned: patch.pinned ?? true }); }
export async function swapSession(id) {
  const s = await db.plannedSessions.get(id);
  if (!s) return;
  const sw = await getKV('swapped', {});
  await setKV('swapped', { ...sw, [s.taskId]: today() });
  await db.plannedSessions.update(id, { state: 'SKIPPED', swapped: true, auto: true });
}
export async function setLowEnergy(on) { await setKV('lowEnergy', on ? today() : ''); }

/* ---------- calendar (CalendarContract via the native plugin) ---------- */
export async function syncCalendar(settings, Kaizen, isAndroid) {
  if (!isAndroid) return { ok: false };
  try {
    const st = await Kaizen.calendarStatus();
    if (!st.granted) return { ok: false, needsPermission: true };
    const from = parse(today()).getTime(), to = from + 8 * 864e5;
    const { events } = await Kaizen.getCalendarEvents({ from, to });
    const ps = plannerSettings(settings);
    const prev = Object.fromEntries((await db.calEvents.toArray()).map((e) => [e.id, e]));
    const rows = events.map((e) => {
      const allDay = !!e.allDay;
      // all-day events come back as UTC midnights: show them on the same calendar date
      const start = allDay ? new Date(new Date(e.start).getUTCFullYear(), new Date(e.start).getUTCMonth(), new Date(e.start).getUTCDate()).getTime() : e.start;
      const end = allDay ? new Date(new Date(e.end).getUTCFullYear(), new Date(e.end).getUTCMonth(), new Date(e.end).getUTCDate()).getTime() : e.end;
      const suggest = !!ps.taskPrefix && (e.title || '').trim().startsWith(ps.taskPrefix);
      return { id: e.id, calendarId: e.calendarId, title: e.title || '(no title)', start, end, allDay, treatAs: prev[e.id]?.treatAs || 'BUSY', suggest };
    });
    const sig = (r) => JSON.stringify(r.map((e) => [e.id, e.start, e.end, e.treatAs]).sort());
    const changed = sig(rows) !== sig(Object.values(prev));
    if (changed) await db.transaction('rw', db.calEvents, async () => { await db.calEvents.clear(); await db.calEvents.bulkPut(rows); });
    return { ok: true, changed, count: rows.length };
  } catch (e) { console.warn('calendar', e); return { ok: false }; }
}
export async function eventToTask(ev) {
  const d = ymd(new Date(ev.start));
  const pre = '';
  const id = await db.tasks.add({ title: ev.title.replace(/^\[T\]\s*/i, '') || ev.title, due: d, dueTime: '', done: false, createdAt: Date.now(), subtasks: [], priority: 'none', recurrence: 'none', difficulty: 2, pcat: 'PERSONAL', from: pre + 'calendar' });
  await db.calEvents.update(ev.id, { treatAs: 'CONVERTED_TO_TASK' });
  return id;
}

/* ---------- queries for screens ---------- */
export async function dayData(date, settings) {
  const [sessions, fixed, events, ctx, tasks] = await Promise.all([
    db.plannedSessions.where('date').equals(date).toArray(), db.fixedBlocks.toArray(), db.calEvents.toArray(), dayContext(date, settings), db.tasks.toArray(),
  ]);
  return { sessions, fixed, events, ctx, tasks };
}
export { estimateHours, dayOf, addDays, today };

/** Estimated hours for a task row (for lists and the form). Sum of open steps when it has them. */
export function taskEstimate(t, settings, detail = false) {
  const ps = plannerSettings(settings);
  const factors = { ...DEFAULT_FACTORS, ...ps.factors };
  const cat = t.pcat || 'OTHER';
  const planner = t.difficulty != null || !!t.pcat;
  if (!planner && !detail) return null;
  const subs = (t.subtasks || []).filter((s) => !s.done);
  let hours = 0, guessed = true;
  if (subs.length && !(t.estHours > 0)) {
    subs.forEach((s) => { const e = estimateHours({ difficulty: s.difficulty ?? t.difficulty, hours: s.estHours, whole: false, category: cat }, factors); hours += e.hours; guessed = guessed && e.guessed; });
  } else {
    const e = estimateHours({ difficulty: t.difficulty ?? 1, hours: t.estHours, whole: true, category: cat }, factors);
    hours = e.hours; guessed = e.guessed;
  }
  return detail ? { hours, guessed } : { text: `~${hours < 1 ? Math.round(hours * 60) + 'm' : Math.round(hours * 10) / 10 + 'h'}${guessed ? '' : ''}`, hours };
}
