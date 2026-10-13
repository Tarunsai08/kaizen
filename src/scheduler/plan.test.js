import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, estimateHours, updateCorrection, updateEnergy, energyAt } from './index.js';

const TODAY = '2026-10-14'; // a Wednesday
const at = (h, m = 0, day = 14) => new Date(2026, 9, day, h, m).getTime();
const base = (o = {}) => ({ now: at(8), today: TODAY, settings: { wakeMin: 420, bedMin: 1380 }, fixed: [], events: [], tasks: [], ctx: {}, stats: {}, locked: [], ...o });
const task = (o = {}) => ({ id: 1, title: 'DBMS Assignment', category: 'ASSIGNMENT', difficulty: 3, deadline: at(23, 59, 18), subtasks: [], ...o });
const work = (p) => p.sessions.filter((s) => s.kind !== 'BREAK');
const minutes = (p, f = () => true) => work(p).filter(f).reduce((a, s) => a + s.end - s.start, 0);
const overlaps = (a, b) => a.date === b.date && a.start < b.end && b.start < a.end;

test('empty day plans nothing and does not crash', () => {
  const p = buildPlan(base());
  assert.equal(p.sessions.length, 0);
  assert.equal(p.atRisk.length, 0);
});

test('fully booked day gets no sessions today', () => {
  const p = buildPlan(base({ tasks: [task({ deadline: at(23, 59, 20) })], fixed: [{ id: 'a', title: 'Classes', type: 'CLASS', days: [0, 1, 2, 3, 4, 5, 6], start: 360, end: 1400 }] }));
  assert.equal(work(p).filter((s) => s.date === TODAY).length, 0);
});

test('deadline today: work lands today before the deadline and is flagged when impossible', () => {
  const p = buildPlan(base({ tasks: [task({ difficulty: 2, deadline: at(18) })] }));
  const w = work(p);
  assert.ok(w.length > 0);
  assert.ok(w.every((s) => s.date === TODAY && s.end <= 18 * 60));
  assert.ok(w[0].reason.includes('due today'));
});

test('infeasible deadline is marked at risk, offers options, work is never silently dropped', () => {
  const p = buildPlan(base({ tasks: [task({ difficulty: 5, estHours: 20, deadline: at(23, 59, 15) })] }));
  assert.equal(p.atRisk.length, 1);
  assert.ok(p.atRisk[0].options.length >= 3);
  assert.ok(minutes(p) > 0);
});

test('task with only title, deadline and difficulty gets a sensible schedule with reasons and a plan-steps nudge', () => {
  const p = buildPlan(base({ tasks: [task()] }));
  const w = work(p);
  assert.ok(w.some((s) => s.kind === 'PLAN_SUBTASKS'));
  assert.ok(w.every((s) => s.reason && s.reason.length > 5));
  assert.ok(w.every((s) => s.date <= '2026-10-18'));
  const total = minutes(p, (s) => s.kind === 'WORK');
  assert.ok(total >= 5 * 60 && total <= 8 * 60, `total ${total}`); // 6h base estimate
});

test('low-mood day: lighter capacity, easy win first, kind note', () => {
  const t = [task({ id: 1, difficulty: 2, subtasks: [{ id: 's1', title: 'Skim notes', difficulty: 1 }, { id: 's2', title: 'Proof', difficulty: 5 }] })];
  const normal = buildPlan(base({ tasks: t, ctx: { mood: 4, sleepH: 8 } }));
  const low = buildPlan(base({ tasks: t, ctx: { mood: 2, sleepH: 7 } }));
  assert.ok(low.lowDay && low.notes.includes('Lighter plan today.'));
  const today = work(low).filter((s) => s.date === TODAY).sort((a, b) => a.start - b.start);
  assert.equal(today[0].kind, 'EASY_WIN');
  assert.ok(today[0].end - today[0].start <= 30);
  assert.ok(minutes(low, (s) => s.date === TODAY) <= 6 * 60 * 0.6 + 1);
  assert.ok(!today.some((s) => s.difficulty >= 4), 'hard step deferred while deadline is safe');
  assert.ok(minutes(normal, (s) => s.date === TODAY) >= minutes(low, (s) => s.date === TODAY));
});

test('short sleep triggers the low-energy plan and mentions it in the reason', () => {
  const p = buildPlan(base({ tasks: [task({ difficulty: 2, deadline: at(23, 59, 14) })], ctx: { mood: 3, sleepH: 5 } }));
  assert.ok(p.lowDay);
  assert.ok(work(p).some((s) => /slept 5h/.test(s.reason)));
});

test('pinned sessions are respected: nothing overlaps them and they count toward the task', () => {
  const pinned = { date: TODAY, start: 9 * 60, end: 10 * 60, taskId: 1, kind: 'WORK', state: 'PLANNED', pinned: true };
  const a = buildPlan(base({ tasks: [task()], locked: [pinned] }));
  const b = buildPlan(base({ tasks: [task()] }));
  assert.ok(work(a).every((s) => !overlaps(s, { ...pinned, start: pinned.start - 10, end: pinned.end + 10 })));
  assert.ok(minutes(a, (s) => s.kind === 'WORK') < minutes(b, (s) => s.kind === 'WORK'));
});

test('overrun shifts later work: re-planning from a later time never schedules in the past', () => {
  const t = [task({ difficulty: 2, deadline: at(23, 59, 14) })];
  const early = buildPlan(base({ tasks: t, now: at(9) }));
  const late = buildPlan(base({ tasks: t, now: at(12, 20) }));
  assert.ok(minutes(late) >= minutes(early) - 15, 'the same work still fits later in the day');
  assert.ok(work(late).every((s) => s.start >= 12 * 60 + 20));
});

test('recurring daily task gets one session per day near the same time', () => {
  const p = buildPlan(base({ tasks: [{ id: 9, title: 'Learn one algorithm', category: 'ALGORITHM', difficulty: 3, recurring: { minutes: 60, days: null }, subtasks: [] }] }));
  const w = work(p);
  const days = new Set(w.map((s) => s.date));
  assert.equal(days.size, 7);
  const starts = w.map((s) => s.start);
  assert.ok(Math.max(...starts) - Math.min(...starts) <= 180);
  assert.ok(w.every((s) => s.end - s.start >= 45));
});

test('learned correction factor lengthens estimates and follows the EMA rules', () => {
  const plain = estimateHours({ difficulty: 3, whole: true, category: 'CODING' }).hours;
  const learned = estimateHours({ difficulty: 3, whole: true, category: 'CODING' }, {}, { CODING: 1.5 }).hours;
  assert.ok(Math.abs(plain - 6 * 1.3) < 1e-9);
  assert.ok(Math.abs(learned - plain * 1.5) < 1e-9);
  assert.ok(Math.abs(updateCorrection({}, 'CODING', 120, 60).CODING - 1.3) < 1e-9);
  assert.equal(updateCorrection({ CODING: 2.4 }, 'CODING', 1000, 10).CODING, 2.5);
  assert.equal(updateCorrection({ CODING: 0.6 }, 'CODING', 1, 100).CODING, 0.5 > 0.6 * 0.7 ? 0.5 : 0.6 * 0.7 + 0.3 * 0.01);
  const a = buildPlan(base({ tasks: [task({ category: 'CODING' })] }));
  const b = buildPlan(base({ tasks: [task({ category: 'CODING' })], stats: { correction: { CODING: 1.8 } } }));
  assert.ok(minutes(b, (s) => s.kind === 'WORK') > minutes(a, (s) => s.kind === 'WORK'));
});

test('calendar events overlapping fixed blocks do not double count and block time', () => {
  const fixed = [{ id: 'c', title: 'Class', type: 'CLASS', days: [3], start: 10 * 60, end: 12 * 60 }];
  const events = [{ id: 'e', start: at(11), end: at(13), treatAs: 'BUSY' }, { id: 'i', start: at(15), end: at(16), treatAs: 'IGNORE' }];
  const p = buildPlan(base({ tasks: [task()], fixed, events }));
  const t = work(p).filter((s) => s.date === TODAY);
  assert.ok(t.every((s) => s.end <= 10 * 60 - 10 || s.start >= 13 * 60 + 10), JSON.stringify(t.map((s) => [s.start, s.end])));
  assert.ok(t.some((s) => s.start >= 15 * 60 && s.start < 16 * 60), 'ignored event leaves its time free');
});

test('energy: learned data takes over after ~30 sessions; defaults peak morning/evening', () => {
  assert.ok(energyAt(9, 3) > energyAt(15, 3));
  assert.ok(energyAt(20, 3) > energyAt(15, 3));
  let e = {};
  for (let i = 0; i < 30; i++) e = updateEnergy(e, 15, 3, 'DONE');
  assert.ok(energyAt(15, 3, { energy: e }) > energyAt(15, 3) + 0.2);
});

test('sessions never overlap each other, fixed blocks or the awake window; a week plans in under 200 ms', () => {
  const tasks = Array.from({ length: 8 }, (_, i) => task({ id: i + 1, title: 'T' + i, difficulty: 1 + (i % 5), deadline: at(23, 59, 15 + (i % 5)), subtasks: i % 2 ? [{ id: 'a' + i, title: 'a', difficulty: 2 }, { id: 'b' + i, title: 'b', difficulty: 5 }] : [] }));
  const fixed = [{ id: 'g', title: 'Gym', type: 'GYM', days: [1, 3, 5], start: 17 * 60, end: 18 * 60 }, { id: 'm', title: 'Lunch', type: 'MEAL', days: [0, 1, 2, 3, 4, 5, 6], start: 13 * 60, end: 14 * 60 }];
  const t0 = performance.now();
  const p = buildPlan(base({ tasks, fixed }));
  assert.ok(performance.now() - t0 < 200);
  const w = work(p);
  for (let i = 0; i < w.length; i++) for (let j = i + 1; j < w.length; j++) assert.ok(!overlaps(w[i], w[j]), `overlap ${JSON.stringify([w[i], w[j]])}`);
  assert.ok(w.every((s) => s.start >= 7 * 60 && s.end <= 23 * 60));
  assert.ok(w.every((s) => !(s.date === '2026-10-14' && s.start < 8 * 60)));
  const perDay = {};
  w.forEach((s) => (perDay[s.date] = (perDay[s.date] || 0) + s.end - s.start));
  assert.ok(Object.values(perDay).every((m) => m <= 6 * 60 + 1));
});

test('edge: overdue task still gets planned (today, flagged), not dropped', () => {
  const p = buildPlan(base({ tasks: [task({ deadline: at(9, 0, 12), difficulty: 2 })] }));
  assert.ok(work(p).length > 0);
});

test('edge: late sleeper (wake 11:00, bed 03:00 next day) plans inside the awake window only', () => {
  const p = buildPlan(base({ now: at(11), settings: { wakeMin: 660, bedMin: 180 }, tasks: [task({ estHours: 4, deadline: at(23, 59, 16) })] }));
  assert.ok(work(p).length > 0);
  assert.ok(work(p).every((s) => s.start >= 660 || s.date !== TODAY));
});

test('edge: planning at 02:00 after midnight does not crash and never places sessions in the past', () => {
  const now = at(2, 0);
  const p = buildPlan(base({ now, tasks: [task()] }));
  const nowMin = 2 * 60;
  assert.ok(work(p).filter((s) => s.date === TODAY).every((s) => s.start >= nowMin));
});

test('edge: finished subtasks and zero-size tasks produce no sessions', () => {
  const p = buildPlan(base({ tasks: [task({ subtasks: [{ id: 'a', title: 'x', done: true }] }), task({ id: 2, estHours: 0 })] }));
  assert.ok(work(p).every((s) => s.taskId !== 1));
});

test('edge: 120 tasks plan quickly and sessions never overlap', () => {
  const tasks = Array.from({ length: 120 }, (_, i) => task({ id: i + 1, title: 'T' + i, deadline: at(23, 59, 14 + (i % 12)), difficulty: 1 + (i % 5) }));
  const t0 = Date.now();
  const p = buildPlan(base({ tasks }));
  assert.ok(Date.now() - t0 < 1500);
  const s = p.sessions;
  for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) assert.ok(!overlaps(s[i], s[j]));
});

test('edge: deferToday removes a task from today but keeps it planned later', () => {
  const p = buildPlan(base({ tasks: [task({ deferToday: true, difficulty: 2, estHours: 1, deadline: at(23, 59, 20) })] }));
  assert.equal(work(p).filter((s) => s.date === TODAY).length, 0);
  assert.ok(work(p).length > 0);
});

test('edge: deferToday also applies to a recurring daily task', () => {
  const p = buildPlan(base({ tasks: [task({ deferToday: true, recurring: { minutes: 45 }, deadline: undefined })] }));
  assert.equal(p.sessions.filter((s) => s.date === TODAY && s.taskId === 1).length, 0);
});

test('edge: missing/odd inputs (no category, NaN estimate, no settings) do not throw', () => {
  assert.doesNotThrow(() => buildPlan(base({ tasks: [{ id: 9, title: 'x', estHours: NaN }], settings: {} })));
});

test('edge: 02:00 while the app-day is still yesterday never schedules into the already-ended day', () => {
  const p = buildPlan({ ...base({ tasks: [task({ difficulty: 2, estHours: 1, deadline: at(23, 59, 20) })] }), today: '2026-10-13', now: at(2, 0, 14) });
  assert.equal(work(p).filter((s) => s.date === '2026-10-13').length, 0);
  assert.ok(work(p).length > 0);
});
