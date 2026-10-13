import test from 'node:test';
import assert from 'node:assert/strict';
import { expand, curate } from './notifyCurate.js';

const NOW = new Date(2026, 9, 14, 8, 0).getTime(); // Wed 08:00
const at = (h, m = 0, day = 14) => new Date(2026, 9, day, h, m);
const n = (title, h, m, o = {}) => ({ title, schedule: { at: at(h, m, o.day) }, ...o });

test('expand turns daily and weekly repeats into one-shots and skips the past', () => {
  const out = expand([{ title: 'daily', schedule: { on: { hour: 7, minute: 0 } } }, { title: 'thu', schedule: { on: { hour: 9, minute: 0, weekday: 5 } } }], NOW, 7);
  assert.equal(out.filter((x) => x.title === 'daily').length, 6); // today 07:00 already passed
  const thu = out.filter((x) => x.title === 'thu');
  assert.equal(thu.length, 1);
  assert.equal(new Date(thu[0].schedule.at).getDay(), 4);
});

test('everything mode keeps all future notifications', () => {
  const list = [n('a', 9, 0), n('b', 9, 5), n('old', 7, 0)];
  assert.equal(curate(list, { mode: 'all', now: NOW }).length, 2);
});

test('essential mode keeps only critical and high', () => {
  const list = [n('task', 10, 0, { pri: 'critical' }), n('session', 11, 0, { pri: 'high' }), n('nugget', 12, 0)];
  assert.deepEqual(curate(list, { mode: 'essential', now: NOW }).map((x) => x.title), ['task', 'session']);
});

test('smart: quiet hours silence everything except critical', () => {
  const quiet = (ms) => new Date(ms).getHours() >= 23 || new Date(ms).getHours() < 7;
  const list = [n('late habit', 23, 30, { pri: 'high' }), n('my reminder', 23, 45, { pri: 'critical' }), n('ok', 20, 0, { pri: 'high' })];
  assert.deepEqual(curate(list, { now: NOW, quiet }).map((x) => x.title), ['ok', 'my reminder']);
});

test('smart: low ones close together are merged into one', () => {
  const list = [n('📚 DSA', 20, 0), n('🧠 3 cards', 20, 15), n('Reach out to Ravi', 20, 30)];
  const out = curate(list, { now: NOW });
  assert.equal(out.length, 1);
  assert.equal(out[0].title, '3 small things');
  assert.match(out[0].body, /DSA/);
  assert.match(out[0].body, /Reach out to Ravi/);
});

test('smart: a daily limit on low-priority notifications', () => {
  const list = [9, 11, 13, 15, 17, 19].map((h) => n('low ' + h, h, 0));
  assert.equal(curate(list, { now: NOW, budget: 4 }).length, 4);
});

test('smart: skip reminders for things already done today, but not tomorrow', () => {
  const list = [n('water', 10, 0, { pri: 'high', ref: 'habit:1' }), n('water tmrw', 10, 0, { pri: 'high', ref: 'habit:1', day: 15 })];
  assert.deepEqual(curate(list, { now: NOW, doneToday: new Set(['habit:1']) }).map((x) => x.title), ['water tmrw']);
});

test('smart: at most one nugget a day and no after-session time checks', () => {
  const list = [n('💡 a', 10, 0, { extra: { route: 'nugget' } }), n('💡 b', 14, 0, { extra: { route: 'nugget' } }), n('Time check', 12, 0, { pri: 'low', extra: { kind: 'session', end: true } })];
  assert.deepEqual(curate(list, { now: NOW }).map((x) => x.title), ['💡 a']);
});

test('smart: an hourly water nudge becomes at most 3 a day', () => {
  const list = [9, 10, 11, 12, 13, 14, 15, 16].map((h) => n('water ' + h, h, 0, { repeatOf: 'h1' }));
  const out = curate(list, { now: NOW, budget: 10, gapMin: 0 });
  assert.equal(out.length, 3);
  assert.deepEqual(out.map((x) => x.title), ['water 9', 'water 13', 'water 16']);
});
