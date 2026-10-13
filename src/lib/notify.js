// Local notification scheduling (Android app). In the browser this is a no-op.
import { LocalNotifications } from '@capacitor/local-notifications';
import { db, getKV } from '../db';
import { isNative } from './native';
import { hmToMin, today, dow, addDays } from './date';
import { checkinDays, DEFAULT_CHECKIN, habitActiveOn } from './logic';
import { blockSegments } from '../scheduler';
import { expand, curate } from './notifyCurate';

let scheduling = null;
let timer = null;

export async function ensurePermission() {
  if (!isNative) {
    if ('Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch {}
    }
    return false;
  }
  const p = await LocalNotifications.checkPermissions();
  if (p.display !== 'granted') {
    const r = await LocalNotifications.requestPermissions();
    return r.display === 'granted';
  }
  return true;
}

export async function registerActions(handlers) {
  if (!isNative) return;
  await LocalNotifications.registerActionTypes({
    types: [
      { id: 'GOAL', actions: [{ id: 'yes', title: 'Yes, made progress' }, { id: 'no', title: 'Not today' }, { id: 'snooze', title: 'Snooze' }] },
      { id: 'TASK', actions: [{ id: 'done', title: 'Mark done' }, { id: 'snooze', title: 'Snooze 15m' }] },
      { id: 'HABIT', actions: [{ id: 'log', title: 'Log it' }, { id: 'snooze', title: 'Snooze' }] },
      { id: 'SESSION', actions: [{ id: 'start', title: 'Start' }, { id: 'snooze', title: 'Snooze 10 min' }, { id: 'skip', title: 'Skip' }] },
      { id: 'SESSION_END', actions: [{ id: 'done', title: 'Done' }, { id: 'more', title: 'Need 15 more min' }, { id: 'partial', title: 'Partially done' }] },
      { id: 'GENERIC', actions: [{ id: 'snooze', title: 'Snooze 15m' }] },
    ],
  });
  await LocalNotifications.removeAllListeners();
  LocalNotifications.addListener('localNotificationActionPerformed', async (ev) => {
    const n = ev.notification;
    const extra = n.extra || {};
    if (ev.actionId === 'snooze' && extra.kind !== 'session') {
      await LocalNotifications.schedule({ notifications: [{ ...n, id: Math.floor(Math.random() * 1e9), schedule: { at: new Date(Date.now() + 15 * 60000), allowWhileIdle: true } }] });
      return;
    }
    handlers && handlers(ev.actionId, extra);
  });
}

const HM = (s) => ({ hour: Math.floor(hmToMin(s) / 60), minute: hmToMin(s) % 60 });
const minToHM = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// Build every notification from current data and replace everything that's pending.
async function buildAll() {
  const settings = {};
  (await db.kv.toArray()).forEach((r) => (settings[r.key] = r.value));
  if (settings.notifications === false) return [];
  const out = [];
  let id = 1000;
  const push = (n) => out.push({ id: id++, smallIcon: 'ic_stat_icon', ...n });

  // Habit reminders
  const habits = await db.habits.toArray();
  for (const h of habits) {
    if (h.type === 'break' || !h.reminder || h.archived || !habitActiveOn(h, today()) && h.startDate > today()) continue;
    const days = h.freq === 'weekly' || !h.days || !h.days.length || h.days.length === 7 ? null : h.days;
    const times = [];
    if (h.intervalMins && h.windowStart && h.windowEnd) {
      for (let m = hmToMin(h.windowStart); m <= hmToMin(h.windowEnd); m += h.intervalMins) times.push(minToHM(m));
    } else if (h.reminderTime) times.push(h.reminderTime);
    for (const t of times.slice(0, 24)) {
      const base = { pri: times.length > 1 ? 'low' : 'high', ref: `habit:${h.id}`, ...(times.length > 1 ? { repeatOf: `h${h.id}` } : {}), title: `${h.icon || '•'} ${h.name}`, body: h.type === 'break' ? 'Check in with yourself.' : `Time for ${h.name.toLowerCase()}${h.target > 1 ? ` · target ${h.target} ${h.unit || ''}` : ''}`, actionTypeId: 'HABIT', extra: { kind: 'habit', habitId: h.id } };
      if (days) days.forEach((d) => push({ ...base, schedule: { on: { weekday: d + 1, ...HM(t) }, allowWhileIdle: true } }));
      else push({ ...base, schedule: { on: HM(t), allowWhileIdle: true } });
    }
  }

  // Task reminders (one-shot, future only)
  const tasks = await db.tasks.filter((t) => !t.done && !t.skipped && t.due && t.reminder != null).toArray();
  for (const t of tasks) {
    const [y, mo, d] = t.due.split('-').map(Number);
    const [hh, mm] = (t.dueTime || '09:00').split(':').map(Number);
    const at = new Date(y, mo - 1, d, hh, mm).getTime() - (t.reminder || 0) * 60000;
    if (at > Date.now()) push({ pri: 'critical', title: t.title, body: t.reminder ? `Due ${t.dueTime ? 'at ' + t.dueTime : 'today'}` : 'Reminder', actionTypeId: 'TASK', extra: { kind: 'task', taskId: t.id }, schedule: { at: new Date(at), allowWhileIdle: true } });
  }

  // Planner: session start / end (quiet during sleep and class) and the evening wrap-up
  const pl = { alertSession: true, alertWrap: true, wrapTime: '21:30', ...(settings.planner || {}) };
  if (pl.alertSession) {
    const t0 = today();
    const at = (date, min) => { const [y, m, d] = date.split('-').map(Number); return new Date(y, m - 1, d, 0, min).getTime(); };
    const fixed = await db.fixedBlocks.toArray();
    const quiet = (date, min) => blockSegments(fixed, date).some(({ b, seg }) => (b.type === 'SLEEP' || b.type === 'CLASS') && min >= seg[0] && min < seg[1]);
    const sess = (await db.plannedSessions.where('date').between(t0, addDays(t0, 2), true, true).filter((s) => s.state === 'PLANNED' && s.kind !== 'BREAK').toArray()).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start).slice(0, 14);
    for (const s of sess) {
      if (at(s.date, s.start) > Date.now() + 30000 && !quiet(s.date, s.start)) push({ pri: 'high', title: s.title, body: s.reason, actionTypeId: 'SESSION', extra: { kind: 'session', id: s.id }, schedule: { at: new Date(at(s.date, s.start)), allowWhileIdle: true } });
      if (at(s.date, s.end) > Date.now() + 30000 && !quiet(s.date, s.end)) push({ pri: 'low', title: `Time check · ${s.title}`, body: 'How did it go?', actionTypeId: 'SESSION_END', extra: { kind: 'session', id: s.id, end: true }, schedule: { at: new Date(at(s.date, s.end)), allowWhileIdle: true } });
    }
  }
  if (pl.alertWrap) push({ pri: 'high', title: 'Wrap up your day', body: 'Tick what you did, then a quick check-in.', extra: { kind: 'route', route: 'wrap' }, schedule: { on: HM(pl.wrapTime), allowWhileIdle: true } });

  // Night review, ~30 min before bedtime (replaced by the wrap-up above when that is on)
  if (settings.bedtimeTarget && !pl.alertWrap) {
    const m = (hmToMin(settings.bedtimeTarget) - (settings.nightReviewLead ?? 30) + 1440) % 1440;
    push({ pri: 'high', title: '🌙 Night review', body: 'Two minutes to close the day. Then phone away.', extra: { kind: 'route', route: 'night' }, schedule: { on: HM(minToHM(m)), allowWhileIdle: true } });
  }
  // Morning check-in
  if (settings.morningReminder) {
    push({ pri: 'high', title: '☀️ Good morning', body: 'Log your wake time and see today’s plan.', extra: { kind: 'route', route: 'morning' }, schedule: { on: HM(settings.morningReminder), allowWhileIdle: true } });
  }

  // Goal check-ins, grouped by weekday+time so several goals become one notification
  const goals = await db.goals.where('status').equals('active').toArray();
  const groups = {};
  for (const g of goals) {
    const f = g.checkinFreq || DEFAULT_CHECKIN[g.type];
    if (f === 'never') continue;
    for (const d of checkinDays(f)) {
      const k = `${d}|${g.checkinTime || '20:00'}`;
      (groups[k] = groups[k] || []).push(g);
    }
  }
  for (const [k, list] of Object.entries(groups)) {
    const [d, t] = k.split('|');
    const one = list.length === 1;
    push({
      pri: 'high',
      title: one ? `Are you working towards: ${list[0].title}?` : `Goal check-in · ${list.length} goals`,
      body: one ? list[0].why || 'Tap to update your progress.' : list.map((g) => '• ' + g.title).join('\n'),
      actionTypeId: one ? 'GOAL' : 'GENERIC',
      extra: one ? { kind: 'goal', goalId: list[0].id } : { kind: 'route', route: 'goals' },
      schedule: { on: { weekday: Number(d) + 1, ...HM(t) }, allowWhileIdle: true },
    });
  }
  // Keep-in-touch nudges: one on the day each person becomes due
  const people = await db.people.toArray();
  const inter = await db.interactions.toArray();
  for (const p of people) {
    const every = Math.max(1, p.every || 7);
    const last = inter.filter((i) => i.personId === p.id).map((i) => i.date).sort().pop();
    // never talked → due now (matches the People screen); otherwise last chat + frequency
    let first;
    const [ph, pm] = (settings.peopleTime || '09:30').split(':').map(Number);
    const weekendOnly = !!settings.peopleWeekends;
    // move a date to the reminder time, and to the next Saturday/Sunday when "weekends only" is on
    const fit = (dt) => { const x = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), ph, pm); if (weekendOnly) while (x.getDay() !== 0 && x.getDay() !== 6) x.setDate(x.getDate() + 1); return x; };
    if (last) { const [y, mo, d] = last.split('-').map(Number); first = fit(new Date(y, mo - 1, d + every)); }
    else first = new Date(0);
    if (first.getTime() < Date.now()) { const n = new Date(); first = fit(new Date(n.getFullYear(), n.getMonth(), n.getDate())); if (first.getTime() < Date.now()) first = fit(new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1)); }
    // the due-day nudge plus two gentle follow-ups at the same rhythm, in case the app isn't opened
    for (let k = 0; k < 3; k++) {
      const at = k ? fit(new Date(first.getTime() + k * Math.min(every, 7) * 86400000)) : first;
      push({ pri: 'low', title: `Reach out to ${p.name}?`, body: k ? `It’s been a while — a quick message counts.` : p.notes ? p.notes.slice(0, 80) : 'A quick message counts.', extra: { kind: 'route', route: 'person', id: p.id }, schedule: { at, allowWhileIdle: true } });
    }
  }
  // Study: one reminder per active subject per day (next 3 days), skipped today once the daily goal is met
  const subjects = (await db.subjects.toArray()).filter((s) => s.active !== false && s.reminder !== false);
  if (settings.studyReminders !== false && subjects.length) {
    const prog = await db.progress.toArray();
    const done = new Set(prog.filter((p) => p.done).map((p) => p.id));
    const sess = await db.studySessions.where('date').equals(today()).toArray();
    const foc = await db.focus.where('date').equals(today()).toArray();
    const { firstUndone, findNode } = await import('./study');
    for (const s of subjects) {
      const next = firstUndone(s.children, done);
      if (!next) continue;
      const path = findNode(s, next.id)?.path || [];
      const minsToday = sess.filter((x) => x.sid === s.sid).reduce((a, b) => a + (b.mins || 0), 0) + foc.filter((f) => f.study === s.sid).reduce((a, b) => a + (b.minutes || 0), 0);
      const lessonsToday = sess.filter((x) => x.sid === s.sid && x.kind === 'lesson').length;
      const [hh, mm] = (s.reminderTime || '20:00').split(':').map(Number);
      for (let k = 0; k < 3; k++) {
        const d = new Date(); d.setDate(d.getDate() + k); d.setHours(hh, mm, 0, 0);
        if (d.getTime() < Date.now()) continue;
        if (k === 0 && (minsToday >= (s.dailyMins || 30) || lessonsToday > 0)) continue;
        push({ pri: 'low', title: `📚 ${s.title} · ${s.dailyMins || 30} min`, body: `Next up: ${next.title}${path.length ? ` (${path[path.length - 1].title})` : ''}`, extra: { kind: 'route', route: 'lesson', sid: s.sid, id: next.id }, schedule: { at: d, allowWhileIdle: true } });
      }
    }
  }
  // Spaced repetition: one notification a day with the number of cards due by then
  const cards = await db.cards.toArray();
  if (cards.length && settings.reviewTime) {
    const reviewedToday = await db.reviews.where('date').equals(today()).count();
    const [hh, mm] = settings.reviewTime.split(':').map(Number);
    for (let k = 0; k < 4; k++) {
      const d = new Date(); d.setDate(d.getDate() + k); d.setHours(hh, mm, 0, 0);
      if (d.getTime() < Date.now()) continue;
      const day = addDays(today(), k);
      let n = cards.filter((c) => c.due <= day).length;
      if (k === 0) n = Math.min(n, Math.max(0, (settings.reviewCap || 12) - reviewedToday));
      n = Math.min(n, settings.reviewCap || 12);
      if (!n) continue;
      push({ pri: 'low', title: `🧠 ${n} card${n > 1 ? 's' : ''} to revise`, body: 'A 2-minute recall keeps what you learned. Tap to start.', extra: { kind: 'route', route: 'review' }, schedule: { at: d, allowWhileIdle: true } });
    }
  }
  // Learnings: a few random “nuggets” during the day (10:00–21:00)
  if (settings.nuggets !== false) {
    const learn = (await db.learnings.where('kind').equals('learn').toArray()).filter((l) => l.status !== 'archived');
    if (learn.length) {
      const per = Math.max(1, Math.min(5, settings.nuggetsPerDay || 3));
      const pickW = (arr) => { const w = arr.map((l) => 1 / (1 + (l.shown || 0))); let r = Math.random() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < arr.length; i++) { r -= w[i]; if (r <= 0) return arr[i]; } return arr[arr.length - 1]; };
      for (let k = 0; k < 2; k++) {
        const slots = [];
        const span = (21 - 10) * 60 / per;
        for (let j = 0; j < per; j++) slots.push(10 * 60 + Math.round(j * span + Math.random() * span * 0.8));
        for (const m of slots) {
          const d = new Date(); d.setDate(d.getDate() + k); d.setHours(Math.floor(m / 60), m % 60, 0, 0);
          if (d.getTime() < Date.now() + 5 * 60000) continue;
          const l = pickW(learn);
          push({ pri: 'low', title: `💡 ${l.title.slice(0, 60)}`, body: (l.body || l.source || 'Remember this?').slice(0, 160), extra: { kind: 'route', route: 'nugget', id: l.id }, schedule: { at: d, allowWhileIdle: true } });
        }
      }
    }
  }
  return smart(out, settings);
}

/* Smart filter (see notifyCurate.js): quiet during sleep and class, skip what's already done, merge small ones, daily limit. */
async function smart(out, settings) {
  const mode = settings.notifyMode || 'smart';
  if (mode === 'all') return out;
  const t0 = today();
  const fixed = await db.fixedBlocks.toArray();
  const bed = hmToMin(settings.bedtimeTarget || '23:00'), wake = hmToMin(settings.wakeTarget || '07:00');
  const quiet = (ms) => {
    const d = new Date(ms), m = d.getHours() * 60 + d.getMinutes();
    if (bed > wake ? m >= bed || m < wake : m >= bed && m < wake) return true;
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return blockSegments(fixed, date).some(({ b, seg }) => (b.type === 'SLEEP' || b.type === 'CLASS') && m >= seg[0] && m < seg[1]);
  };
  const [habits, logs] = await Promise.all([db.habits.toArray(), db.habitLogs.where('date').equals(t0).toArray()]);
  const amt = {}; logs.forEach((l) => (amt[l.habitId] = (amt[l.habitId] || 0) + (l.amount || 1)));
  const doneToday = new Set(habits.filter((h) => (amt[h.id] || 0) >= (h.target || 1)).map((h) => `habit:${h.id}`));
  const list = curate(expand(out, Date.now(), 7), { mode, quiet, doneToday, budget: settings.notifyBudget || 4 });
  return list.map((n, i) => { const { pri, ref, repeatOf, ...rest } = n; return { ...rest, id: 1000 + i }; });
}

export function rescheduleSoon() {
  clearTimeout(timer);
  timer = setTimeout(rescheduleAll, 1200);
}

export async function rescheduleAll() {
  if (!isNative) return;
  if (scheduling) return scheduling;
  scheduling = (async () => {
    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
      const all = await buildAll();
      for (let i = 0; i < all.length; i += 60) await LocalNotifications.schedule({ notifications: all.slice(i, i + 60) });
    } catch (e) {
      console.warn('notify', e);
    } finally {
      scheduling = null;
    }
  })();
  return scheduling;
}

export async function notifyNow(title, body) {
  if (isNative) {
    await LocalNotifications.schedule({ notifications: [{ id: Math.floor(Math.random() * 1e9), title, body, schedule: { at: new Date(Date.now() + 500) } }] });
  } else if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification(title, { body }); } catch {}
  }
}
export { dow, getKV };
