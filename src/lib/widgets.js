// Pushes a small summary to the Android home-screen widgets.
import { db } from '../db';
import { today } from './date';
import { habitDueOn, sumByDate } from './logic';
import { Kaizen, isAndroid } from './native';
import { stageFor } from './xp';

export async function updateWidgets(settings, xp) {
  if (!isAndroid) return;
  try {
    const t = today();
    const [habits, logs, tasks] = await Promise.all([
      db.habits.filter((h) => !h.archived && h.type === 'build').toArray(),
      db.habitLogs.where('date').equals(t).toArray(),
      db.tasks.filter((x) => !x.done && !x.skipped && x.due && x.due <= t).count(),
    ]);
    const sums = sumByDate(logs.map((l) => ({ ...l, date: l.habitId })));
    const due = habits.filter((h) => habitDueOn(h, t) && h.freq !== 'weekly');
    const done = due.filter((h) => (sums[h.id] || 0) >= (h.target || 1)).length;
    const data = {
      score: (settings.scores || {})[t] ?? 0,
      habitsDone: done,
      habitsDue: due.length,
      tasksLeft: tasks,
      level: xp?.total.level || 1,
      stage: xp ? stageFor(xp.total.level).name : 'Seed',
      name: settings.companionName || 'Kai',
    };
    await Kaizen.updateWidgets({ json: JSON.stringify(data) });
  } catch (e) { console.warn('widgets', e); }
}
