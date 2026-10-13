// One hook that gathers *everything* the Today screen shows, so every layout can
// render the full day in its own style (no layout has to reuse Classic's cards).
import { useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, setKV } from '../../db';
import { useApp } from '../../ctx';
import { today, calendarToday, beforeDayStart, greeting, addDays, dow, hmToMin, fmtHM, fmtDay, diffDays, lastNDays, weekStart, DAYS_SHORT, MONTHS, parse } from '../../lib/date';
import { computeDay, habitDueOn, checkinDueToday, completeTask, goalProgress, timeLeft, money } from '../../lib/logic';
import { dayItems, nowNext } from '../../lib/day';
import { momentumUntil, stageFor } from '../../lib/xp';
import { success, tap } from '../../lib/native';
import { sfxComplete } from '../../lib/sound';
import { useXP, companionMood } from '../You';
import { useEnergy } from '../Health';
import { useStudy, useStudyToday } from '../Study';
import { personStatus } from '../People';
import { GOAL_TYPE_COLOR } from '../../ui/rows';

const PRIO = { high: 0, medium: 1, low: 2 };

export function useToday() {
  const app = useApp();
  const { settings, push, goTab, celebrate, toast } = app;
  const t = today();

  const raw = useLiveQuery(async () => {
    const [habits, logs, tasks, goals, checkins, moods, sleepToday, journal, journalY, txToday, untagged, workouts, projects, intention, people, inter, presets, exps, expLogs] = await Promise.all([
      db.habits.filter((h) => !h.archived && h.type === 'build').toArray(),
      db.habitLogs.where('date').between(addDays(t, -7), t, true, true).toArray(),
      db.tasks.filter((x) => !x.skipped).toArray(),
      db.goals.where('status').equals('active').toArray(),
      db.goalCheckins.toArray(),
      db.moods.where('date').equals(t).toArray(),
      db.sleep.where('date').equals(t).first(),
      db.journal.where('date').equals(t).first(),
      db.journal.where('date').equals(addDays(t, -1)).first(),
      db.transactions.where('date').equals(t).toArray(),
      db.transactions.where('tagged').equals(0).count(),
      db.workouts.where('date').equals(t).toArray(),
      db.projects.toArray(),
      db.intentions.where('date').equals(t).first(),
      db.people.toArray(),
      db.interactions.toArray(),
      db.presets.toArray(),
      db.experiments.where('status').equals('active').toArray(),
      db.expLogs.where('date').equals(t).toArray(),
    ]);
    const day = await computeDay(t, settings);
    const timeline = await dayItems(t, settings);
    return { habits, logs, tasks, goals, checkins, moods, sleepToday, journal, journalY, txToday, untagged, workouts, projects, intention, people, inter, presets, exps, expLogs, day, timeline };
  }, [t, settings.schedule, settings.frozenDays?.length]);
  const xp = useXP();
  const energy = useEnergy();
  const study = useStudy();
  const st = useStudyToday();

  // keep the per-day score history (streaks, Wrapped) current whatever layout is shown
  const scores = settings.scores || {};
  useEffect(() => {
    if (!raw || scores[t] === raw.day.score) return;
    const next = { ...scores, [t]: raw.day.score };
    const keys = Object.keys(next).sort();
    if (keys.length > 800) keys.slice(0, keys.length - 800).forEach((k) => delete next[k]);
    setKV('scores', next);
  }, [raw?.day.score]);

  const D = useMemo(() => {
    if (!raw) return null;
    const { habits, logs, tasks, goals, checkins, sleepToday, journal, journalY, txToday, untagged, workouts, projects, intention, people, inter, presets, exps, expLogs, day, timeline } = raw;
    const d = parse(t);
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();

    /* habits */
    const week = lastNDays(7, t);
    const habitList = habits.filter((h) => habitDueOn(h, t)).map((h) => {
      const mine = logs.filter((l) => l.habitId === h.id);
      const by = {};
      mine.forEach((l) => (by[l.date] = (by[l.date] || 0) + (l.amount || 1)));
      const amt = by[t] || 0;
      const target = h.target || 1;
      const done = amt >= target;
      const sub = target > 1 ? `${amt}/${target}${h.unit ? ' ' + h.unit : ''}`
        : h.freq === 'weekly' ? `${Object.keys(by).filter((x) => x >= weekStart(t) && by[x] >= target).length}/${h.perWeek} this week`
        : h.windowStart ? `${fmtHM(h.windowStart)}–${fmtHM(h.windowEnd)}` : h.unit ? `${target} ${h.unit}` : 'once today';
      return { key: 'h' + h.id, h, id: h.id, name: h.name, icon: h.icon, amt, target, done, prog: Math.min(1, amt / target), color: h.color || 'var(--habit)', sub, week: week.map((x) => Math.min(1, (by[x] || 0) / target)), time: h.reminderTime || h.windowStart || '' };
    }).sort((a, b) => (a.done - b.done) || (a.time || '99').localeCompare(b.time || '99'));

    /* tasks */
    const taskList = tasks
      .filter((x) => (!x.done && x.due && x.due <= t) || (x.done && x.due === t))
      .sort((a, b) => (a.done - b.done) || (PRIO[a.priority] ?? 3) - (PRIO[b.priority] ?? 3) || (a.dueTime || '99').localeCompare(b.dueTime || '99'))
      .map((x) => {
        const proj = projects.find((p) => p.id === x.projectId);
        const goal = goals.find((g) => g.id === x.goalId);
        const subs = x.subtasks || [];
        const meta = [x.due && x.due !== t ? fmtDay(x.due) : '', x.dueTime ? fmtHM(x.dueTime) : '', subs.length ? `${subs.filter((s) => s.done).length}/${subs.length}` : '', proj ? proj.name : '', goal ? goal.title : ''].filter(Boolean);
        return { key: 't' + x.id, task: x, id: x.id, title: x.title, done: !!x.done, overdue: !x.done && x.due < t, prio: x.priority && x.priority !== 'none' ? x.priority : null, meta, study: !!x.study };
      });
    const peopleDue = people.map((p) => ({ p, s: personStatus(p, inter) })).filter((x) => x.s.due)
      .map(({ p, s }) => ({ key: 'p' + p.id, p, name: p.name, color: p.color || '#a78bfa', sub: s.since == null ? 'Say hi' : `${s.since} days since you talked`, go: () => push('PersonDetail', { id: p.id }) }));

    /* goals */
    const lastCheck = {};
    checkins.forEach((c) => { if (!lastCheck[c.goalId] || c.date > lastCheck[c.goalId]) lastCheck[c.goalId] = c.date; });
    const needsReview = goals.filter((g) => g.periodEnd && g.periodEnd < t);
    const order = { weekly: 0, monthly: 1, yearly: 2, casual: 3 };
    const goalList = goals.filter((g) => !(g.periodEnd && g.periodEnd < t)).sort((a, b) => order[a.type] - order[b.type]).map((g) => {
      const p = goalProgress(g, tasks);
      const checkinDue = checkinDueToday(g, lastCheck[g.id]);
      return { key: 'g' + g.id, g, title: g.title, value: p.value, label: p.label, color: GOAL_TYPE_COLOR[g.type], kind: g.type === 'casual' ? 'Someday' : `This ${g.type.replace('ly', '').replace('dai', 'day')}`, left: timeLeft(g), checkinDue, go: () => push('GoalDetail', { id: g.id, checkin: checkinDue }) };
    });

    /* prompts */
    const bed = hmToMin(settings.bedtimeTarget || '23:00');
    const prompts = [];
    if (!journalY && !journal && !sleepToday?.wakeTs && now.getHours() < 12 && !beforeDayStart() && t === calendarToday())
      prompts.push({ k: 'yesterday', tone: 'sleep', title: 'Close yesterday', sub: 'Last night’s review is still open', go: () => push('NightReview') });
    if (!sleepToday?.wakeTs && mins >= 240 && mins < 780)
      prompts.push({ k: 'morning', tone: 'goal', title: 'Morning check-in', sub: 'Wake time, sleep quality & today’s plan', go: () => push('Morning') });
    if (!journal && (mins >= Math.max(1080, bed - 180) || beforeDayStart()))
      prompts.push({ k: 'night', tone: 'sleep', title: 'Night review', sub: `2 minutes to close the day${untagged ? ` · ${untagged} to tag` : ''}`, go: () => push('NightReview') });
    if (needsReview.length)
      prompts.push({ k: 'goals', tone: 'goal', title: `Review ${needsReview.length} finished goal${needsReview.length > 1 ? 's' : ''}`, sub: 'Achieved? Carry over or archive', go: () => push('GoalReview') });

    /* now / next */
    const nn = nowNext(timeline.items);
    const agenda = [...(nn.cur ? [{ ...nn.cur, when: 'Now' }] : []), ...nn.next.map((x, i) => ({ ...x, when: i === 0 && !nn.cur ? 'Next' : 'Then' }))];

    /* workout */
    const sched = (settings.schedule || {})[dow(t)] || [];
    const pname = (id) => presets.find((p) => p.id === id)?.name || '?';
    const w0 = workouts[0];
    const workout = sched.length || workouts.length ? {
      done: workouts.some((w) => w.completed),
      summary: w0 ? w0.entries.map((e) => `${pname(e.presetId)} L${e.level}`).join(' + ') : sched.map((s) => `${pname(s.presetId)} (L${s.level})`).join(' + '),
      parts: (w0 ? w0.entries : sched).map((e) => ({ name: pname(e.presetId), level: e.level })),
      go: () => push('Workout', { date: t }),
    } : null;

    /* study */
    const subjects = study.ready ? study.data.filter((x) => x.s.active !== false && x.next).slice(0, 3).map(({ s, next, t: tally }) => {
      const m = st?.mins[s.sid] || 0;
      const goal = s.dailyMins || 30;
      return { key: 's' + s.id, s, title: s.title, icon: s.icon, color: s.color, next: next.title, mins: m, goal, prog: Math.min(1, m / goal), lessons: st?.lessons[s.sid] || 0, overall: tally && tally.total ? tally.done / tally.total : 0, doneN: tally?.done || 0, totalN: tally?.total || 0, go: () => push('Lesson', { sid: s.sid, id: next.id }) };
    }) : [];
    const studyBlock = st && (subjects.length || st.due) ? { subjects, due: st.due, streak: st.streak, studied: st.studiedToday, review: () => push('ReviewDeck'), all: () => goTab('study') } : null;

    /* experiments */
    const experiments = exps.filter((e) => e.start <= t).map((e) => {
      const log = expLogs.find((l) => l.expId === e.id);
      return { key: 'e' + e.id, e, title: e.title, day: Math.min(e.days, diffDays(t, e.start) + 1), days: e.days, over: t > e.end || e.endedEarly, log, go: () => push('ExperimentDetail', { id: e.id }) };
    });

    /* score */
    const frozen = settings.frozenDays || [];
    const sc = { ...scores, [t]: day.score };
    const streak = momentumUntil(sc, frozen, t) || momentumUntil(sc, frozen, addDays(t, -1));
    const best = Math.max(day.score, ...Object.values(scores).map(Number).filter((n) => !isNaN(n)), 0);
    const spent = txToday.filter((x) => x.direction === 'debit').reduce((a, b) => a + b.amount, 0);
    const lvl = xp?.total.level || 1;
    const stage = stageFor(lvl);
    const items = habitList.length + taskList.length;
    const doneItems = habitList.filter((x) => x.done).length + taskList.filter((x) => x.done).length;

    return {
      t, d, dateLabel: `${DAYS_SHORT[d.getDay()]} · ${d.getDate()} ${MONTHS[d.getMonth()]}`, weekday: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()],
      greeting: greeting(), name: settings.name || '', hour: now.getHours(), mins,
      score: day.score, rings: day.rings, day, best, streak, restDay: frozen.includes(t),
      xp: { level: lvl, progress: xp?.total.progress || 0, today: xp?.today || 0, total: xp?.total.xp || 0 }, stage, kaiMood: companionMood(day.score),
      intention: intention?.text || '',
      energy: energy ? { label: energy.zone.label, until: energy.zone.untilLabel, tip: energy.zone.tip, debt: energy.debt?.hours ?? 0 } : null,
      agenda, prompts, habits: habitList, tasks: taskList, people: peopleDue, goals: goalList,
      workout, study: studyBlock, experiments,
      spent, spentLabel: money(spent, settings.currency), untagged, items, doneItems, allDone: items > 0 && doneItems === items,
      sleep: sleepToday || null,
    };
  }, [raw, xp, energy, study.ready, study.data, st, settings.bedtimeTarget, settings.name, settings.currency, scores]);

  /* ---------------- actions ---------------- */
  const logHabit = async (x, { sfx = sfxComplete } = {}) => {
    const { h, amt, target, done } = x;
    if (done && target === 1) {
      tap();
      const ls = await db.habitLogs.where('[habitId+date]').equals([h.id, t]).toArray();
      await db.habitLogs.bulkDelete(ls.map((l) => l.id));
      return 'undo';
    }
    if (done) { push('HabitDetail', { id: h.id }); return 'detail'; }
    const step = h.step || 1;
    await db.habitLogs.add({ habitId: h.id, date: t, ts: Date.now(), amount: step });
    if (amt + step >= target) {
      success(); sfx && sfx();
      const all = await db.habits.where('type').equals('build').filter((y) => !y.archived && habitDueOn(y, t) && y.freq !== 'weekly').toArray();
      const ls = await db.habitLogs.where('date').equals(t).toArray();
      const s = {}; ls.forEach((l) => (s[l.habitId] = (s[l.habitId] || 0) + (l.amount || 1)));
      if (all.every((y) => (s[y.id] || 0) >= (y.target || 1))) { celebrate(); toast('Every habit done today'); }
      return 'complete';
    }
    tap('medium');
    return 'step';
  };
  const toggleTask = async (x, { sfx = sfxComplete } = {}) => {
    if (!x.done) { success(); sfx && sfx(); } else tap();
    await completeTask(x.task, !x.done);
    return x.done ? 'undo' : 'complete';
  };
  const openTask = (x) => (x.task.study ? push('Lesson', { sid: x.task.study.sid, id: x.task.study.id }) : push('TaskForm', { id: x.id }));
  const openHabit = (x) => push('HabitDetail', { id: x.id });
  const go = {
    you: () => push('You'), plan: () => goTab('plan'), habits: () => goTab('habits'), study: () => goTab('study'),
    addTask: () => push('TaskForm', { due: t }), addHabit: () => push('HabitForm', {}), money: () => push('MoneyScreen'),
    bored: () => push('Boredom'), insights: () => push('Insights'), goals: () => goTab('plan'),
  };
  return { D, logHabit, toggleTask, openTask, openHabit, go };
}
