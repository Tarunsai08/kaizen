// Local notification scheduling (Android app). In the browser this is a no-op.
import { LocalNotifications } from '@capacitor/local-notifications';
import { db, getKV } from '../db';
import { isNative } from './native';
import { hmToMin, today, dow, addDays } from './date';
import { checkinDays, DEFAULT_CHECKIN, habitActiveOn } from './logic';

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
      { id: 'GENERIC', actions: [{ id: 'snooze', title: 'Snooze 15m' }] },
    ],
  });
  await LocalNotifications.removeAllListeners();
  LocalNotifications.addListener('localNotificationActionPerformed', async (ev) => {
    const n = ev.notification;
    const extra = n.extra || {};
    if (ev.actionId === 'snooze') {
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
      const base = { title: `${h.icon || '•'} ${h.name}`, body: h.type === 'break' ? 'Check in with yourself.' : `Time for ${h.name.toLowerCase()}${h.target > 1 ? ` · target ${h.target} ${h.unit || ''}` : ''}`, actionTypeId: 'HABIT', extra: { kind: 'habit', habitId: h.id } };
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
    if (at > Date.now()) push({ title: t.title, body: t.reminder ? `Due ${t.dueTime ? 'at ' + t.dueTime : 'today'}` : 'Reminder', actionTypeId: 'TASK', extra: { kind: 'task', taskId: t.id }, schedule: { at: new Date(at), allowWhileIdle: true } });
  }

  // Night review, ~30 min before bedtime
  if (settings.bedtimeTarget) {
    const m = (hmToMin(settings.bedtimeTarget) - (settings.nightReviewLead ?? 30) + 1440) % 1440;
    push({ title: '🌙 Night review', body: 'Two minutes to close the day. Then phone away.', extra: { kind: 'route', route: 'night' }, schedule: { on: HM(minToHM(m)), allowWhileIdle: true } });
  }
  // Morning check-in
  if (settings.morningReminder) {
    push({ title: '☀️ Good morning', body: 'Log your wake time and see today’s plan.', extra: { kind: 'route', route: 'morning' }, schedule: { on: HM(settings.morningReminder), allowWhileIdle: true } });
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
    const last = inter.filter((i) => i.personId === p.id).map((i) => i.date).sort().pop() || p.since || today();
    const [y, mo, d] = last.split('-').map(Number);
    let at = new Date(y, mo - 1, d + (p.every || 7), 18, 30);
    if (at.getTime() < Date.now()) { const n = new Date(); at = new Date(n.getFullYear(), n.getMonth(), n.getDate() + (n.getHours() >= 18 ? 1 : 0), 18, 30); }
    push({ title: `Reach out to ${p.name}?`, body: p.notes ? p.notes.slice(0, 80) : 'A quick message counts.', extra: { kind: 'route', route: 'person', id: p.id }, schedule: { at, allowWhileIdle: true } });
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
        push({ title: `📚 ${s.title} · ${s.dailyMins || 30} min`, body: `Next up: ${next.title}${path.length ? ` (${path[path.length - 1].title})` : ''}`, extra: { kind: 'route', route: 'lesson', sid: s.sid, id: next.id }, schedule: { at: d, allowWhileIdle: true } });
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
      push({ title: `🧠 ${n} card${n > 1 ? 's' : ''} to revise`, body: 'A 2-minute recall keeps what you learned. Tap to start.', extra: { kind: 'route', route: 'review' }, schedule: { at: d, allowWhileIdle: true } });
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
          push({ title: `💡 ${l.title.slice(0, 60)}`, body: (l.body || l.source || 'Remember this?').slice(0, 160), extra: { kind: 'route', route: 'nugget', id: l.id }, schedule: { at: d, allowWhileIdle: true } });
        }
      }
    }
  }
  return out;
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
