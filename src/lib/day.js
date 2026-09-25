// Builds the Structured-style timeline for one day from tasks, workouts, habits, focus sessions and sleep targets.
import { db } from '../db';
import { dow, hmToMin, today } from './date';
import { habitDueOn } from './logic';

export async function dayItems(date, settings) {
  const [tasks, habits, focus, workouts, presets, sleep] = await Promise.all([
    db.tasks.where('due').equals(date).filter((t) => !t.skipped).toArray(),
    db.habits.filter((h) => !h.archived && h.type === 'build' && h.reminder && !!h.reminderTime && !h.intervalMins).toArray(),
    db.focus.where('date').equals(date).toArray(),
    db.workouts.where('date').equals(date).toArray(),
    db.presets.toArray(),
    db.sleep.where('date').equals(date).first(),
  ]);
  const items = [];
  const wake = sleep?.wakeTs ? new Date(sleep.wakeTs) : null;
  const wakeHM = wake ? `${String(wake.getHours()).padStart(2, '0')}:${String(wake.getMinutes()).padStart(2, '0')}` : settings.wakeTarget;
  items.push({ key: 'wake', kind: 'wake', start: wakeHM, dur: 0, title: 'Rise and shine', sub: wake ? 'Logged' : 'Target', color: 'var(--goal)', icon: 'i:Sunrise', done: !!wake });

  tasks.filter((t) => t.dueTime).forEach((t) => items.push({
    key: 't' + t.id, kind: 'task', ref: t, start: t.dueTime, dur: t.duration || 30, title: t.title,
    color: t.color || 'var(--task)', icon: t.icon || 'i:CheckCircle2', done: !!t.done,
  }));
  const sched = (settings.schedule || {})[dow(date)] || [];
  if (sched.length || workouts.length) {
    const w = workouts[0];
    const names = (w ? w.entries : sched).map((e) => presets.find((p) => p.id === e.presetId)?.name).filter(Boolean).join(' + ');
    items.push({ key: 'workout', kind: 'workout', start: settings.workoutTime || '18:00', dur: settings.workoutDuration || 45, title: names || 'Workout', color: 'var(--fit)', icon: 'i:Dumbbell', done: !!w?.completed });
  }
  habits.filter((h) => habitDueOn(h, date)).forEach((h) => items.push({
    key: 'h' + h.id, kind: 'habit', ref: h, start: h.reminderTime, dur: 0, title: h.name, color: h.color || 'var(--habit)', icon: h.icon, done: false,
  }));
  focus.forEach((f) => {
    const d = new Date(f.ts);
    items.push({ key: 'f' + f.id, kind: 'focus', ref: f, start: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, dur: f.minutes, title: f.label || 'Focus session', color: 'var(--bored)', icon: 'i:Timer', done: true });
  });
  const lead = settings.nightReviewLead ?? 30;
  const rev = (hmToMin(settings.bedtimeTarget) - lead + 1440) % 1440;
  items.push({ key: 'review', kind: 'review', start: `${String(Math.floor(rev / 60)).padStart(2, '0')}:${String(rev % 60).padStart(2, '0')}`, dur: lead, title: 'Night review', color: 'var(--mood)', icon: 'i:PenLine', done: !!(await db.journal.where('date').equals(date).first()) });
  items.push({ key: 'bed', kind: 'bed', start: settings.bedtimeTarget, dur: 0, title: 'Wind down & sleep', sub: 'Phone away', color: 'var(--sleep)', icon: 'i:Moon', done: false });

  // sort; times after midnight but before wake (e.g. 00:30 bedtime) go to the end
  const wakeMin = hmToMin(wakeHM);
  const key = (it) => { const m = hmToMin(it.start); return m < wakeMin - 60 ? m + 1440 : m; };
  items.sort((a, b) => key(a) - key(b));
  items.forEach((it) => { it.startMin = key(it); it.endMin = it.startMin + (it.dur || 0); });
  const inbox = tasks.filter((t) => !t.dueTime);
  return { items, inbox };
}

export function nowNext(items) {
  const n = new Date();
  const now = n.getHours() * 60 + n.getMinutes();
  const cur = items.find((it) => it.dur && now >= it.startMin && now < it.endMin && !it.done);
  const next = items.filter((it) => it.startMin > now && !it.done).slice(0, cur ? 1 : 2);
  return { now, cur, next };
}
export { today };
