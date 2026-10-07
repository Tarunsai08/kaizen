// Alternative Today layouts (choose in Settings → Today layout). All share one data hook and the
// same actions, so habits, tasks, mood and prompts behave identically to the classic screen.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Plus, Sparkles, Moon, Sunrise, Wind, ChevronRight, Dumbbell, Wallet, Smile, CheckSquare, Flame, Timer, Zap, Brain,
  GraduationCap, Lightbulb, Check, Clock, ArrowRight, RotateCcw, Star, PenLine, Sun,
} from 'lucide-react';
import { db, setKV } from '../db';
import { useApp } from '../ctx';
import { today, calendarToday, beforeDayStart, greeting, addDays, hmToMin, fmtHM, DAYS_SHORT, MONTHS, parse } from '../lib/date';
import { computeDay, habitDueOn, completeTask, money, sumByDate } from '../lib/logic';
import { dayItems, nowNext } from '../lib/day';
import { MultiRing, Ring, MoodScale, Sheet } from '../ui/kit';
import { HIcon } from '../ui/icons';
import Companion from '../ui/Companion';
import { stageFor } from '../lib/xp';
import { success, tap } from '../lib/native';
import { sfxComplete, sfxArrive } from '../lib/sound';
import { useXP, companionMood } from './You';
import { useStudy, useStudyToday } from './Study';
import { MoodDetailSheet } from './Today';

export const TODAY_LAYOUTS = [
  { value: 'classic', label: 'Classic' },
  { value: 'bento', label: 'Widgets' },
  { value: 'focus', label: 'Focus' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'checklist', label: 'Checklist' },
  { value: 'sky', label: 'Sky' },
];

/* ============================================================ shared data + actions */
export function useTodayData() {
  const { settings, celebrate } = useApp();
  const t = today();
  const data = useLiveQuery(async () => {
    const [habits, logs, tasks, moods, sleepToday, journal, journalY, txToday, intention, workouts] = await Promise.all([
      db.habits.filter((h) => !h.archived && h.type === 'build').toArray(),
      db.habitLogs.where('date').between(addDays(t, -7), t, true, true).toArray(),
      db.tasks.filter((x) => !x.skipped).toArray(),
      db.moods.where('date').equals(t).toArray(),
      db.sleep.where('date').equals(t).first(),
      db.journal.where('date').equals(t).first(),
      db.journal.where('date').equals(addDays(t, -1)).first(),
      db.transactions.where('date').equals(t).toArray(),
      db.intentions.where('date').equals(t).first(),
      db.workouts.where('date').equals(t).toArray(),
    ]);
    const day = await computeDay(t, settings);
    const timeline = await dayItems(t, settings);
    return { habits, logs, tasks, moods, sleepToday, journal, journalY, txToday, intention, workouts, day, timeline };
  }, [t, settings.schedule, settings.frozenDays?.length]);
  const xp = useXP();

  // keep the per-day score history (streaks, Wrapped) current whatever layout is shown
  const scores = settings.scores || {};
  useEffect(() => {
    if (!data || scores[t] === data.day.score) return;
    const next = { ...scores, [t]: data.day.score };
    const keys = Object.keys(next).sort();
    if (keys.length > 800) keys.slice(0, keys.length - 800).forEach((k) => delete next[k]);
    setKV('scores', next);
  }, [data?.day.score]);

  return useMemo(() => {
    if (!data) return null;
    const { habits, logs, tasks, moods, sleepToday, journal, journalY, txToday, intention, day, timeline } = data;
    const byHabit = {};
    logs.filter((l) => l.date === t).forEach((l) => (byHabit[l.habitId] = (byHabit[l.habitId] || 0) + (l.amount || 1)));
    const due = habits.filter((h) => habitDueOn(h, t)).map((h) => {
      const amt = byHabit[h.id] || 0;
      const target = h.target || 1;
      return { h, amt, target, done: amt >= target, color: h.color || 'var(--habit)' };
    }).sort((a, b) => (a.done - b.done) || (a.h.reminderTime || '99').localeCompare(b.h.reminderTime || '99'));
    const todayTasks = tasks.filter((x) => (!x.done && x.due && x.due <= t) || (x.done && x.due === t)).sort((a, b) => (a.done - b.done) || ({ high: 0, medium: 1, low: 2 }[a.priority] ?? 3) - ({ high: 0, medium: 1, low: 2 }[b.priority] ?? 3) || (a.dueTime || '99').localeCompare(b.dueTime || '99'));
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const bed = hmToMin(settings.bedtimeTarget || '23:00');
    const prompts = {
      morning: !sleepToday?.wakeTs && mins >= 240 && mins < 780,
      night: !journal && (mins >= Math.max(1080, bed - 180) || beforeDayStart()),
      yesterday: !journalY && !journal && !sleepToday?.wakeTs && now.getHours() < 12 && !beforeDayStart() && t === calendarToday(),
    };
    const spent = txToday.filter((x) => x.direction === 'debit').reduce((a, b) => a + b.amount, 0);
    const lastMood = [...moods].sort((a, b) => b.ts - a.ts)[0];
    const doneCount = due.filter((x) => x.done).length + todayTasks.filter((x) => x.done).length;
    const totalCount = due.length + todayTasks.length;
    const frozen = settings.frozenDays || [];
    let streak = 0;
    for (let d = (day.score >= 60 ? t : addDays(t, -1)); ; d = addDays(d, -1)) { const v = d === t ? day.score : scores[d]; if ((v ?? 0) >= 60 || frozen.includes(d)) streak++; else break; if (streak > 999) break; }
    return { t, due, todayTasks, day, timeline, nn: nowNext(timeline.items), prompts, spent, lastMood, intention, doneCount, totalCount, streak, xp, sleepToday };
  }, [data, xp, settings.bedtimeTarget, scores]);
}

export function useTodayActions() {
  const { celebrate, toast } = useApp();
  const [moodSheet, setMoodSheet] = useState(null);
  const logHabit = async (x, t) => {
    const { h, amt, target, done } = x;
    if (done && target === 1) {
      tap();
      const ls = await db.habitLogs.where('[habitId+date]').equals([h.id, t]).toArray();
      await db.habitLogs.bulkDelete(ls.map((l) => l.id));
      return 'undo';
    }
    if (done) return 'done';
    const step = h.step || 1;
    await db.habitLogs.add({ habitId: h.id, date: t, ts: Date.now(), amount: step });
    if (amt + step >= target) {
      success(); sfxComplete();
      const all = await db.habits.where('type').equals('build').filter((y) => !y.archived && habitDueOn(y, t) && y.freq !== 'weekly').toArray();
      const logs = await db.habitLogs.where('date').equals(t).toArray();
      const s = {}; logs.forEach((l) => (s[l.habitId] = (s[l.habitId] || 0) + (l.amount || 1)));
      if (all.every((y) => (s[y.id] || 0) >= (y.target || 1))) { celebrate(); toast('Every habit done today'); }
      return 'complete';
    }
    tap('medium');
    return 'step';
  };
  const toggleTask = async (task) => {
    if (!task.done) { success(); sfxComplete(); } else tap();
    await completeTask(task, !task.done);
  };
  const quickMood = async (v, t) => {
    const id = await db.moods.add({ date: t, ts: Date.now(), mood: v, tags: [], kind: 'quick' });
    success();
    setMoodSheet({ id, mood: v, tags: [], energy: null });
  };
  return { logHabit, toggleTask, quickMood, moodSheet, setMoodSheet };
}

/* ============================================================ shared pieces */
function Avatar({ D }) {
  const { push } = useApp();
  const lvl = D.xp?.total.level;
  return (
    <button className="tl-avatar" onClick={() => push('You')} aria-label="You">
      <span style={{ marginTop: 6 }}><Companion stage={D.xp ? stageFor(lvl).index : 0} mood={companionMood(D.day.score)} size={42} /></span>
      {lvl && <b>{lvl}</b>}
    </button>
  );
}
function dateLabel(t) { const d = parse(t); return `${DAYS_SHORT[d.getDay()]} · ${d.getDate()} ${MONTHS[d.getMonth()]}`; }

function Prompts({ D }) {
  const { push } = useApp();
  const items = [
    D.prompts.yesterday && { k: 'y', icon: Moon, c: 'var(--sleep)', t: 'Close yesterday', s: 'You didn’t do last night’s review yet', go: () => push('NightReview') },
    D.prompts.morning && { k: 'm', icon: Sunrise, c: 'var(--goal)', t: 'Morning check-in', s: 'Wake time, sleep & today’s plan', go: () => push('Morning') },
    D.prompts.night && { k: 'n', icon: Moon, c: 'var(--sleep)', t: 'Night review', s: '2 minutes to close the day', go: () => push('NightReview') },
  ].filter(Boolean);
  if (!items.length) return null;
  return (
    <div className="col gap-8">
      {items.map((x) => (
        <button key={x.k} className="tl-prompt" style={{ '--pc': x.c }} onClick={x.go}>
          <span className="ic"><x.icon size={19} /></span>
          <span className="grow" style={{ minWidth: 0, textAlign: 'left' }}><b>{x.t}</b><small>{x.s}</small></span>
          <ChevronRight size={18} />
        </button>
      ))}
    </div>
  );
}

export function QuickAddFab({ t }) {
  const { push, goTab } = useApp();
  const [open, setOpen] = useState(false);
  const items = [
    { l: 'Check in', i: Smile, c: 'var(--mood)', a: () => push('MoodCheckin') },
    { l: 'Task', i: CheckSquare, c: 'var(--task)', a: () => push('TaskForm', { due: t }) },
    { l: 'Expense', i: Wallet, c: 'var(--money)', a: () => push('TxForm', {}) },
    { l: 'Focus', i: Timer, c: 'var(--bored)', a: () => push('Focus', {}) },
    { l: 'Breathe', i: Wind, c: 'var(--bored)', a: () => push('Breathe', {}) },
    { l: 'Urge', i: Flame, c: 'var(--break)', a: () => goTab('habits') },
    { l: 'Workout', i: Dumbbell, c: 'var(--fit)', a: () => push('Workout', { date: t }) },
    { l: 'Sleep', i: Moon, c: 'var(--sleep)', a: () => push('SleepLog', {}) },
    { l: 'Journal', i: Sparkles, c: 'var(--goal)', a: () => push('NightReview') },
    { l: 'Learned', i: Lightbulb, c: 'var(--goal)', a: () => push('LearningForm') },
    { l: 'Revise', i: Brain, c: 'var(--task)', a: () => push('ReviewDeck') },
    { l: 'Study', i: GraduationCap, c: 'var(--task)', a: () => goTab('study') },
  ];
  return (
    <>
      <button className="fab" onClick={() => setOpen(true)} aria-label="Quick add"><Plus size={28} strokeWidth={2.5} /></button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Quick add">
        <div className="grid-3">
          {items.map((x) => (
            <button key={x.l} className="card flat card-press col" style={{ alignItems: 'center', gap: 8, padding: '18px 8px' }} onClick={() => { setOpen(false); x.a(); }}>
              <x.i size={22} color={x.c} />
              <span className="small" style={{ fontWeight: 600 }}>{x.l}</span>
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}

function HabitDot({ x, onTap, size = 46 }) {
  return (
    <button className={`tl-hdot ${x.done ? 'done' : ''}`} onClick={onTap} aria-label={x.h.name} style={{ '--hc': x.color, width: size, height: size }}>
      <Ring size={size} stroke={4} value={Math.min(1, x.amt / x.target)} color={x.color} track="color-mix(in srgb, var(--text) 10%, transparent)">
        {x.done ? <Check size={size * 0.4} strokeWidth={3} color={x.color} /> : <HIcon icon={x.h.icon} size={size * 0.42} color={x.color} />}
      </Ring>
    </button>
  );
}

/* Used by the classic layout: "you stayed up — close yesterday" card */
export function YesterdayPrompt() {
  const { push } = useApp();
  const t = today();
  const show = useLiveQuery(async () => {
    if (new Date().getHours() >= 12 || beforeDayStart() || t !== calendarToday()) return false;
    const [jy, jt, sl] = await Promise.all([db.journal.where('date').equals(addDays(t, -1)).first(), db.journal.where('date').equals(t).first(), db.sleep.where('date').equals(t).first()]);
    return !jy && !jt && !(sl && sl.wakeTs);
  }, [t]);
  if (!show) return null;
  return (
    <button className="tl-prompt mt-12" style={{ '--pc': 'var(--sleep)' }} onClick={() => push('NightReview')}>
      <span className="ic"><Moon size={19} /></span>
      <span className="grow" style={{ minWidth: 0, textAlign: 'left' }}><b>Close yesterday</b><small>You didn’t do last night’s review yet</small></span>
      <ChevronRight size={18} />
    </button>
  );
}

/* ============================================================ 1 · Widgets (bento) */
export function TodayBento() {
  const { push, goTab, settings } = useApp();
  const D = useTodayData();
  const A = useTodayActions();
  const { ready, data: subs } = useStudy();
  const st = useStudyToday();
  if (!D) return <div className="screen" />;
  const { t, day } = D;
  const nextStudy = ready ? subs.find((d) => d.s.active !== false && d.next) : null;
  const nn = D.nn.cur || D.nn.next[0];
  const hDone = D.due.filter((x) => x.done).length;
  const lvl = D.xp?.total;
  return (
    <div className="screen fade-in tlx">
      <div className="tl-head">
        <div><div className="eyebrow">{dateLabel(t)}</div><h1 className="h1 mt-4">{greeting()}{settings.name ? `, ${settings.name}` : ''}</h1></div>
        <Avatar D={D} />
      </div>
      <div className="bento">
        <div className="bt bt-score" style={{ gridColumn: 'span 2', gridRow: 'span 2' }}>
          <MultiRing rings={day.rings.map((r) => ({ value: r.value ?? 0, color: r.value == null ? 'var(--faint)' : r.color }))} size={118} stroke={9} gap={3} />
          <div className="bt-score-n"><b className="num">{day.score}</b><small>day score</small></div>
        </div>
        <div className="bt" style={{ gridColumn: 'span 2', '--bc': 'var(--fit)' }}>
          <div className="bt-k"><Flame size={14} /> Streak</div>
          <div className="bt-v num">{D.streak}<small> day{D.streak === 1 ? '' : 's'}</small></div>
        </div>
        <button className="bt" style={{ gridColumn: 'span 2', '--bc': 'var(--accent)' }} onClick={() => push('CompanionScreen')}>
          <div className="bt-k"><Star size={14} /> Level {lvl?.level || 1}</div>
          <div className="bt-bar"><i style={{ width: `${(lvl?.progress || 0) * 100}%` }} /></div>
          <div className="bt-s">+{D.xp?.today || 0} XP today</div>
        </button>

        {(D.prompts.yesterday || D.prompts.morning || D.prompts.night) && <div style={{ gridColumn: 'span 4' }}><Prompts D={D} /></div>}

        <button className="bt bt-wide" style={{ gridColumn: 'span 4', '--bc': nn?.color || 'var(--task)' }} onClick={() => goTab('plan')}>
          <span className="bt-ico"><HIcon icon={nn?.icon || 'i:Clock'} size={18} color={nn?.color || 'var(--task)'} /></span>
          <span className="grow" style={{ minWidth: 0, textAlign: 'left' }}>
            <span className="bt-k">{D.nn.cur ? 'Now' : 'Next'}{nn ? ` · ${fmtHM(nn.start)}` : ''}</span>
            <span className="bt-t ellipsis">{nn ? nn.title : 'Nothing else planned — enjoy the space'}</span>
          </span>
          <ChevronRight size={18} className="muted" />
        </button>

        <div className="bt" style={{ gridColumn: 'span 4', '--bc': 'var(--mood)' }}>
          <div className="row between"><div className="bt-k"><Smile size={14} /> How are you feeling?</div>{D.lastMood && <span className="bt-s">logged</span>}</div>
          <div className="mt-8"><MoodScale value={null} onChange={(v) => A.quickMood(v, t)} size={30} /></div>
        </div>

        <div className="bt bt-top" style={{ gridColumn: 'span 2', gridRow: 'span 2', '--bc': 'var(--habit)' }}>
          <div className="row between"><div className="bt-k">Habits</div><span className="bt-s num">{hDone}/{D.due.length}</span></div>
          <div className="bt-habits">
            {D.due.slice(0, 6).map((x) => <HabitDot key={x.h.id} x={x} size={42} onTap={() => A.logHabit(x, t)} />)}
            {!D.due.length && <button className="bt-s" onClick={() => push('HabitForm', {})}>+ Add a habit</button>}
          </div>
        </div>
        <div className="bt bt-top" style={{ gridColumn: 'span 2', gridRow: 'span 2', '--bc': 'var(--task)' }}>
          <div className="row between"><div className="bt-k">Tasks</div><button className="bt-s" onClick={() => push('TaskForm', { due: t })}>+ add</button></div>
          <div className="col gap-6 mt-8">
            {D.todayTasks.slice(0, 4).map((x) => (
              <button key={x.id} className={`bt-task ${x.done ? 'done' : ''}`} onClick={() => A.toggleTask(x)}>
                <i>{x.done && <Check size={11} strokeWidth={3.5} />}</i><span className="ellipsis">{x.title}</span>
              </button>
            ))}
            {!D.todayTasks.length && <span className="bt-s">Nothing due today</span>}
          </div>
        </div>

        {nextStudy && (
          <button className="bt" style={{ gridColumn: 'span 2', '--bc': nextStudy.s.color }} onClick={() => push('Lesson', { sid: nextStudy.s.sid, id: nextStudy.next.id })}>
            <div className="bt-k"><GraduationCap size={14} /> {nextStudy.s.title}</div>
            <div className="bt-t2">{nextStudy.next.title}</div>
          </button>
        )}
        <button className="bt" style={{ gridColumn: nextStudy ? 'span 2' : 'span 4', '--bc': 'var(--task)' }} onClick={() => (st?.due ? push('ReviewDeck') : goTab('study'))}>
          <div className="bt-k"><Brain size={14} /> Revise</div>
          <div className="bt-v num">{st?.due || 0}<small> card{st?.due === 1 ? '' : 's'}</small></div>
        </button>
        <button className="bt" style={{ gridColumn: 'span 2', '--bc': 'var(--money)' }} onClick={() => push('MoneyScreen')}>
          <div className="bt-k"><Wallet size={14} /> Spent today</div>
          <div className="bt-v num">{money(D.spent, settings.currency)}</div>
        </button>
        <button className="bt" style={{ gridColumn: 'span 2', '--bc': 'var(--bored)' }} onClick={() => push('Boredom')}>
          <div className="bt-k"><Wind size={14} /> I’m bored</div>
          <div className="bt-t2">Pick something on purpose</div>
        </button>
        <button className="bt bt-wide" style={{ gridColumn: 'span 4', '--bc': 'var(--accent)' }} onClick={() => push('Insights')}>
          <span className="bt-ico"><Sparkles size={18} color="var(--accent)" /></span>
          <span className="grow" style={{ textAlign: 'left' }}><span className="bt-k">Insights</span><span className="bt-t">Patterns across your days</span></span>
          <ChevronRight size={18} className="muted" />
        </button>
      </div>
      <QuickAddFab t={t} />
      <MoodDetailSheet state={A.moodSheet} onClose={() => A.setMoodSheet(null)} emotions={settings.emotions} />
    </div>
  );
}

/* ============================================================ 2 · Focus (one card at a time) */
export function TodayFocus() {
  const { push, goTab, settings } = useApp();
  const D = useTodayData();
  const A = useTodayActions();
  const { ready, data: subs } = useStudy();
  const st = useStudyToday();
  const [later, setLater] = useState([]);
  const [drag, setDrag] = useState(0);
  const [leaving, setLeaving] = useState(0);
  const start = useRef(null);
  if (!D) return <div className="screen" />;
  const { t } = D;
  const q = [];
  if (D.prompts.yesterday) q.push({ key: 'y', kind: 'Close yesterday', title: 'Night review for yesterday', sub: 'You stayed up — two minutes to close it properly.', icon: 'i:Moon', color: 'var(--sleep)', cta: 'Review', run: () => push('NightReview') });
  if (D.prompts.morning) q.push({ key: 'm', kind: 'Good morning', title: 'Morning check-in', sub: 'Log your wake time and set today’s intention.', icon: 'i:Sunrise', color: 'var(--goal)', cta: 'Check in', run: () => push('Morning') });
  D.todayTasks.filter((x) => !x.done && (x.priority === 'high' || x.due < t)).forEach((x) => q.push({ key: 't' + x.id, kind: x.due < t ? 'Overdue task' : 'Priority', title: x.title, sub: x.dueTime ? `Planned for ${fmtHM(x.dueTime)}` : 'Your top priority today', icon: 'i:Target', color: 'var(--task)', cta: 'Mark done', run: () => A.toggleTask(x), open: () => push('TaskForm', { id: x.id }) }));
  D.due.filter((x) => !x.done).forEach((x) => q.push({ key: 'h' + x.h.id, kind: `Habit · ${x.amt}/${x.target}${x.h.unit ? ' ' + x.h.unit : ''}`, title: x.h.name, sub: x.h.reminderTime ? `Usually at ${fmtHM(x.h.reminderTime)}` : 'Any time today', icon: x.h.icon, color: x.color, prog: x.target > 1 ? x.amt / x.target : null, cta: x.target > 1 ? `Log +${x.h.step || 1}` : 'Done', run: () => A.logHabit(x, t), stay: x.amt + (x.h.step || 1) < x.target, open: () => push('HabitDetail', { id: x.h.id }) }));
  D.todayTasks.filter((x) => !x.done && !(x.priority === 'high' || x.due < t)).forEach((x) => q.push({ key: 't' + x.id, kind: 'Task', title: x.title, sub: x.dueTime ? `Planned for ${fmtHM(x.dueTime)}` : 'Due today', icon: 'i:CheckCircle2', color: 'var(--task)', cta: 'Mark done', run: () => A.toggleTask(x), open: () => push('TaskForm', { id: x.id }) }));
  const ns = ready ? subs.find((d) => d.s.active !== false && d.next) : null;
  if (ns) q.push({ key: 's' + ns.next.id, kind: `Study · ${ns.s.title}`, title: ns.next.title, sub: ns.nextPath.map((p) => p.title).join(' › '), icon: ns.s.icon || 'i:GraduationCap', color: ns.s.color, cta: 'Start lesson', run: () => push('Lesson', { sid: ns.s.sid, id: ns.next.id }) });
  if (st?.due) q.push({ key: 'rev', kind: 'Revise', title: `${st.due} card${st.due > 1 ? 's' : ''} to recall`, sub: 'A couple of minutes keeps it in memory.', icon: 'i:Brain', color: 'var(--task)', cta: 'Revise', run: () => push('ReviewDeck') });
  if (!D.lastMood) q.push({ key: 'mood', kind: 'Check in', title: 'How are you feeling?', sub: 'One tap is enough.', icon: 'i:Smile', color: 'var(--mood)', mood: true });
  if (D.prompts.night) q.push({ key: 'n', kind: 'Evening', title: 'Night review', sub: 'Close the day and plan tomorrow’s top 3.', icon: 'i:Moon', color: 'var(--sleep)', cta: 'Review', run: () => push('NightReview') });
  const ordered = [...q.filter((x) => !later.includes(x.key)), ...q.filter((x) => later.includes(x.key))];
  const top0 = ordered[0];
  const fresh = top0 && top0.key.startsWith('h') ? D.due.find((x) => 'h' + x.h.id === top0.key) : null;
  const top = fresh && top0 ? { ...top0, prog: fresh.amt / fresh.target, kind: `Habit · ${fresh.amt}/${fresh.target}${fresh.h.unit ? ' ' + fresh.h.unit : ''}` } : top0;
  const pct = D.totalCount ? D.doneCount / D.totalCount : 0;

  const finish = (dir) => {
    if (!top) return;
    setLeaving(dir);
    setTimeout(async () => {
      if (dir > 0 && top.run) { const r = await top.run(); if (top.stay && r === 'step') { setLeaving(0); setDrag(0); return; } }
      if (dir < 0) setLater((l) => [...l.filter((k) => k !== top.key), top.key]);
      setLeaving(0); setDrag(0);
    }, 260);
  };
  const down = (e) => { start.current = e.clientX; };
  const move = (e) => { if (start.current != null) setDrag(e.clientX - start.current); };
  const up = () => { if (start.current == null) return; start.current = null; if (drag > 90 && !top?.mood) finish(1); else if (drag < -90) finish(-1); else setDrag(0); };
  const style = leaving ? { transform: `translateX(${leaving * 420}px) rotate(${leaving * 14}deg)`, opacity: 0, transition: 'all .26s ease-in' } : { transform: `translateX(${drag}px) rotate(${drag / 22}deg)`, transition: start.current != null ? 'none' : 'transform .25s cubic-bezier(.2,.8,.2,1)' };

  return (
    <div className="screen fade-in tlx">
      <div className="tl-head">
        <div><div className="eyebrow">{dateLabel(t)}</div><h1 className="h1 mt-4">One thing at a time</h1></div>
        <Avatar D={D} />
      </div>
      <div className="fx-progress">
        <div className="row between small"><span><b className="num">{D.doneCount}</b> of {D.totalCount} done today</span><span className="muted num">score {D.day.score}</span></div>
        <div className="fx-bar"><i style={{ width: `${pct * 100}%` }} /></div>
      </div>
      {top ? (
        <div className="fx-stack">
          {ordered[2] && <div className="fx-card ghost g2" style={{ '--fc': ordered[2].color }} />}
          {ordered[1] && <div className="fx-card ghost g1" style={{ '--fc': ordered[1].color }}><div className="fx-kind">{ordered[1].kind}</div></div>}
          <div key={top.key} className="fx-card" style={{ '--fc': top.color, ...style }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
            <div className="fx-glow" />
            <div className="fx-kind">{top.kind}</div>
            <div className="fx-icon"><HIcon icon={top.icon} size={34} color={top.color} /></div>
            <h2 className="fx-title">{top.title}</h2>
            <p className="fx-sub">{top.sub}</p>
            {top.prog != null && <div className="fx-hprog"><i style={{ width: `${Math.min(1, top.prog) * 100}%` }} /></div>}
            {top.mood ? (
              <div className="mt-16" onPointerDown={(e) => e.stopPropagation()}><MoodScale value={null} onChange={(v) => { A.quickMood(v, t); setLater((l) => [...l, 'mood']); }} size={38} /></div>
            ) : (
              <div className="fx-actions" onPointerDown={(e) => e.stopPropagation()}>
                <button className="fx-later" onClick={() => finish(-1)}><Clock size={16} /> Later</button>
                <button className="fx-do" onClick={() => finish(1)}>{top.cta} <ArrowRight size={17} /></button>
              </div>
            )}
            {top.open && <button className="fx-open" onPointerDown={(e) => e.stopPropagation()} onClick={top.open}>Details</button>}
            {drag > 40 && !top.mood && <div className="fx-hint r">Done</div>}
            {drag < -40 && <div className="fx-hint l">Later</div>}
          </div>
        </div>
      ) : (
        <div className="fx-clear">
          <div className="float"><Companion stage={D.xp ? stageFor(D.xp.total.level).index : 0} mood="happy" size={130} /></div>
          <h2 className="h1" style={{ fontSize: 26 }}>All clear</h2>
          <p className="dim center" style={{ margin: 0 }}>Nothing is waiting on you right now. Rest, or pick something on purpose.</p>
          <div className="row mt-16" style={{ width: '100%' }}><button className="btn grow" onClick={() => push('Boredom')}>I’m bored</button><button className="btn grow" onClick={() => goTab('study')}>Study</button></div>
        </div>
      )}
      {ordered.length > 1 && (
        <div className="fx-queue">
          <div className="eyebrow mb-8">Coming up · {ordered.length - 1}</div>
          {ordered.slice(1, 6).map((x) => (
            <div key={x.key} className="fx-q"><span className="d" style={{ background: x.color }} /><span className="grow ellipsis">{x.title}</span><span className="tiny muted">{x.kind.split(' · ')[0]}</span></div>
          ))}
          {later.length > 0 && <button className="tiny muted mt-8 row gap-4" onClick={() => setLater([])}><RotateCcw size={12} /> Bring postponed back</button>}
        </div>
      )}
      <QuickAddFab t={t} />
      <MoodDetailSheet state={A.moodSheet} onClose={() => A.setMoodSheet(null)} emotions={settings.emotions} />
    </div>
  );
}

/* ============================================================ 3 · Timeline (the day on a sun arc) */
export function TodayTimeline() {
  const { push, settings } = useApp();
  const D = useTodayData();
  const A = useTodayActions();
  const nowRef = useRef();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => { if (D && !scrolled && nowRef.current) { setScrolled(true); setTimeout(() => nowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300); } }, [!!D]);
  if (!D) return <div className="screen" />;
  const { t, timeline } = D;
  const items = timeline.items;
  const wakeMin = items.find((x) => x.kind === 'wake')?.startMin ?? hmToMin(settings.wakeTarget || '07:00');
  const bedMin = items.find((x) => x.kind === 'bed')?.startMin ?? hmToMin(settings.bedtimeTarget || '23:00') + 1440 * (hmToMin(settings.bedtimeTarget || '23:00') < wakeMin ? 1 : 0);
  const n = new Date();
  let nowMin = n.getHours() * 60 + n.getMinutes();
  if (nowMin < wakeMin - 60) nowMin += 1440;
  const frac = Math.max(0, Math.min(1, (nowMin - wakeMin) / Math.max(60, bedMin - wakeMin)));
  const ang = Math.PI * (1 - frac);
  const sx = 150 + 130 * Math.cos(ang), sy = 140 - 120 * Math.sin(ang);
  const night = nowMin >= bedMin || frac >= 1;
  const anytime = D.due.filter((x) => !x.h.reminder || !x.h.reminderTime || x.h.intervalMins);
  const untimed = timeline.inbox;
  const habitByKey = Object.fromEntries(D.due.map((x) => ['h' + x.h.id, x]));
  const act = (it) => {
    if (it.kind === 'task') A.toggleTask(it.ref);
    else if (it.kind === 'habit' && habitByKey[it.key]) A.logHabit(habitByKey[it.key], t);
    else if (it.kind === 'workout') push('Workout', { date: t });
    else if (it.kind === 'review') push('NightReview');
    else if (it.kind === 'wake') push('Morning');
  };
  let nowPlaced = false;
  const rows = [];
  items.forEach((it, i) => {
    if (!nowPlaced && it.startMin > nowMin) { nowPlaced = true; rows.push({ now: true }); }
    const prev = items[i - 1];
    const gap = prev ? Math.max(6, Math.min(44, (it.startMin - prev.startMin) / 6)) : 0;
    const hx = habitByKey[it.key];
    rows.push({ it, gap, done: it.kind === 'habit' ? !!hx?.done : it.done, past: it.endMin < nowMin });
  });
  if (!nowPlaced) rows.push({ now: true });
  return (
    <div className="screen fade-in tlx">
      <div className="tl-head">
        <div><div className="eyebrow">{dateLabel(t)}</div><h1 className="h1 mt-4">Your day</h1></div>
        <Avatar D={D} />
      </div>
      <div className={`tm-arc ${night ? 'night' : ''}`}>
        <svg viewBox="0 0 300 160" width="100%" height="150">
          <defs><linearGradient id="arcg" x1="0" x2="1"><stop offset="0" stopColor="var(--goal)" /><stop offset="1" stopColor="var(--sleep)" /></linearGradient></defs>
          <path d="M20 140 A130 120 0 0 1 280 140" fill="none" stroke="color-mix(in srgb, var(--text) 12%, transparent)" strokeWidth="3" strokeDasharray="2 7" strokeLinecap="round" />
          <path d="M20 140 A130 120 0 0 1 280 140" fill="none" stroke="url(#arcg)" strokeWidth="4" strokeLinecap="round" pathLength="1" strokeDasharray={`${frac} 1`} />
          <line x1="8" y1="140" x2="292" y2="140" stroke="color-mix(in srgb, var(--text) 12%, transparent)" />
          <circle cx={sx} cy={sy} r="18" fill={night ? 'var(--sleep)' : 'var(--goal)'} opacity=".18" className="tm-sunglow" />
          <circle cx={sx} cy={sy} r="10" fill={night ? 'var(--sleep)' : 'var(--goal)'} />
        </svg>
        <div className="tm-arc-l"><span>{fmtHM(items.find((x) => x.kind === 'wake')?.start || settings.wakeTarget)}</span><span className="c"><b className="num">{Math.round(frac * 100)}%</b> of your day · score <b className="num">{D.day.score}</b></span><span>{fmtHM(settings.bedtimeTarget)}</span></div>
      </div>
      <Prompts D={D} />
      {(anytime.length > 0 || untimed.length > 0) && (
        <div className="mt-16">
          <div className="eyebrow mb-8">Any time today</div>
          <div className="tm-any">
            {anytime.map((x) => (
              <button key={x.h.id} className={`tm-chip ${x.done ? 'done' : ''}`} style={{ '--hc': x.color }} onClick={() => A.logHabit(x, t)}>
                <HIcon icon={x.h.icon} size={15} color={x.color} /><span>{x.h.name}</span>{x.target > 1 && <small className="num">{x.amt}/{x.target}</small>}{x.done && <Check size={13} strokeWidth={3} />}
              </button>
            ))}
            {untimed.map((x) => (
              <button key={x.id} className={`tm-chip ${x.done ? 'done' : ''}`} style={{ '--hc': 'var(--task)' }} onClick={() => A.toggleTask(x)}>
                <CheckSquare size={15} color="var(--task)" /><span>{x.title}</span>{x.done && <Check size={13} strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="tm-line mt-16">
        {rows.map((r, i) => r.now ? (
          <div key="now" ref={nowRef} className="tm-now"><span className="num">{fmtHM(`${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`)}</span><i /></div>
        ) : (
          <div key={r.it.key} className={`tm-row ${r.done ? 'done' : ''} ${r.past && !r.done ? 'past' : ''}`} style={{ marginTop: r.gap, '--ic': r.it.color }}>
            <div className="tm-time num">{fmtHM(r.it.start)}</div>
            <div className="tm-pin"><i /></div>
            <button className="tm-card" onClick={() => act(r.it)}>
              <span className="tm-ico"><HIcon icon={r.it.icon} size={17} color={r.it.color} /></span>
              <span className="grow" style={{ minWidth: 0, textAlign: 'left' }}>
                <span className="tm-t ellipsis">{r.it.title}</span>
                <span className="tm-s">{r.it.dur ? `${r.it.dur} min` : r.it.sub || (r.it.kind === 'habit' ? 'Habit' : '')}</span>
              </span>
              <span className={`tm-check ${r.done ? 'on' : ''}`}>{r.done && <Check size={13} strokeWidth={3.5} />}</span>
            </button>
          </div>
        ))}
      </div>
      <button className="btn block mt-16" onClick={() => push('TaskForm', { due: t, dueTime: `${String((n.getHours() + 1) % 24).padStart(2, '0')}:00`, duration: 30 })}><Plus size={17} /> Add a block</button>
      <QuickAddFab t={t} />
      <MoodDetailSheet state={A.moodSheet} onClose={() => A.setMoodSheet(null)} emotions={settings.emotions} />
    </div>
  );
}

/* ============================================================ 4 · Checklist (calm, minimal) */
export function TodayChecklist() {
  const { push, goTab, settings } = useApp();
  const D = useTodayData();
  const A = useTodayActions();
  const [draft, setDraft] = useState('');
  if (!D) return <div className="screen" />;
  const { t } = D;
  const d = parse(t);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const rows = [
    ...D.due.map((x) => ({ key: 'h' + x.h.id, done: x.done, title: x.h.name, meta: x.target > 1 ? `${x.amt} / ${x.target}${x.h.unit ? ' ' + x.h.unit : ''}` : 'habit', color: x.color, act: () => A.logHabit(x, t), open: () => push('HabitDetail', { id: x.h.id }), prog: x.target > 1 ? x.amt / x.target : null })),
    ...D.todayTasks.map((x) => ({ key: 't' + x.id, done: x.done, title: x.title, meta: [x.priority === 'high' ? 'priority' : null, x.due < t ? 'overdue' : null, x.dueTime ? fmtHM(x.dueTime) : null].filter(Boolean).join(' · ') || 'task', color: x.priority === 'high' ? 'var(--bad)' : 'var(--task)', act: () => A.toggleTask(x), open: () => push('TaskForm', { id: x.id }) })),
  ];
  const open = rows.filter((r) => !r.done);
  const done = rows.filter((r) => r.done);
  const add = async () => { if (!draft.trim()) return; await db.tasks.add({ title: draft.trim(), due: t, done: false, createdAt: Date.now(), subtasks: [], priority: 'none', recurrence: 'none' }); setDraft(''); tap(); };
  const Row = ({ r }) => (
    <div className={`ck-row ${r.done ? 'done' : ''}`} style={{ '--rc': r.color }}>
      <button className="ck-box" onClick={r.act} aria-label={r.done ? 'Undo' : 'Complete'}>
        {r.prog != null && !r.done ? <Ring size={30} stroke={3} value={r.prog} color={r.color} track="var(--surface-3)" /> : r.done ? <Check size={16} strokeWidth={3.2} /> : null}
      </button>
      <button className="ck-text" onClick={r.open}><span className="t">{r.title}</span><span className="m">{r.meta}</span></button>
    </div>
  );
  return (
    <div className="screen fade-in tlx ck">
      <div className="tl-head" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="ck-day">{days[d.getDay()]}</div>
          <div className="ck-date">{d.getDate()} {MONTHS[d.getMonth()]} · {open.length ? `${open.length} thing${open.length > 1 ? 's' : ''} left` : 'all done'}</div>
        </div>
        <Avatar D={D} />
      </div>
      {D.intention?.text && <p className="ck-intent">“{D.intention.text}”</p>}
      <div className="ck-meter"><i style={{ width: `${D.totalCount ? (D.doneCount / D.totalCount) * 100 : 0}%` }} /></div>
      <div className="mt-16"><Prompts D={D} /></div>
      <div className="ck-list">
        {open.map((r) => <Row key={r.key} r={r} />)}
        <div className="ck-row add">
          <span className="ck-box ghost"><Plus size={16} /></span>
          <input className="ck-input" placeholder="Add a task for today" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} onBlur={add} />
        </div>
      </div>
      {done.length > 0 && (
        <>
          <div className="ck-sep">Done · {done.length}</div>
          <div className="ck-list">{done.map((r) => <Row key={r.key} r={r} />)}</div>
        </>
      )}
      <div className="ck-mood">
        <span className="small muted">Mood</span>
        <MoodScale value={null} onChange={(v) => A.quickMood(v, t)} size={28} />
      </div>
      <div className="ck-links">
        <button onClick={() => goTab('study')}>Study</button><span>·</span>
        <button onClick={() => push('MoneyScreen')}>Money {D.spent ? money(D.spent, settings.currency) : ''}</button><span>·</span>
        <button onClick={() => push('Boredom')}>Bored</button><span>·</span>
        <button onClick={() => push('NightReview')}>Review</button>
      </div>
      <QuickAddFab t={t} />
      <MoodDetailSheet state={A.moodSheet} onClose={() => A.setMoodSheet(null)} emotions={settings.emotions} />
    </div>
  );
}

/* ============================================================ 5 · Sky (light up your sky) */
const ORB_SPOTS = [[18, 34], [50, 22], [80, 36], [30, 56], [66, 54], [12, 72], [88, 70], [45, 42], [58, 72], [24, 18], [76, 16], [40, 68]];
function skyFor(h) {
  if (h < 5 || h >= 21) return { k: 'night', g: 'linear-gradient(180deg,#05071a 0%,#121a3d 55%,#28224d 100%)', hill: '#0d1330', hill2: '#151c40', text: '#e8ebff' };
  if (h < 8) return { k: 'dawn', g: 'linear-gradient(180deg,#3b3a7a 0%,#c56a8f 50%,#f6b38a 100%)', hill: '#3a2d55', hill2: '#5b3f66', text: '#fff7f0' };
  if (h < 17) return { k: 'day', g: 'linear-gradient(180deg,#3d8fe0 0%,#7cc0f2 55%,#c9e8fb 100%)', hill: '#2f8a5b', hill2: '#49a873', text: '#ffffff' };
  return { k: 'dusk', g: 'linear-gradient(180deg,#2c2a6b 0%,#a8487a 50%,#f39a5b 100%)', hill: '#2c2347', hill2: '#4a2f55', text: '#fff4ec' };
}
export function TodaySky() {
  const { push, goTab, settings } = useApp();
  const D = useTodayData();
  const A = useTodayActions();
  const [burst, setBurst] = useState(null);
  const { ready, data: subs } = useStudy();
  if (!D) return <div className="screen" />;
  const { t } = D;
  const n = new Date();
  const S = skyFor(n.getHours());
  const orbs = [
    ...D.due.map((x) => ({ key: 'h' + x.h.id, done: x.done, prog: x.amt / x.target, icon: x.h.icon, color: x.color, label: x.h.name, act: () => A.logHabit(x, t) })),
    ...D.todayTasks.map((x) => ({ key: 't' + x.id, done: x.done, prog: x.done ? 1 : 0, icon: 'i:CheckCircle2', color: 'var(--task)', label: x.title, act: () => A.toggleTask(x), task: true })),
  ].slice(0, ORB_SPOTS.length);
  const lit = orbs.filter((o) => o.done).length;
  const allLit = orbs.length > 0 && lit === orbs.length;
  const dayFrac = Math.max(0, Math.min(1, ((n.getHours() * 60 + n.getMinutes()) - 360) / (18 * 60)));
  const sunX = 8 + dayFrac * 84, sunY = 30 - Math.sin(dayFrac * Math.PI) * 22;
  const tapOrb = async (o, i) => {
    const r = await o.act();
    if (!o.done && (r === 'complete' || o.task)) { setBurst(i); setTimeout(() => setBurst(null), 900); }
  };
  const nn = D.nn.cur || D.nn.next[0];
  const ns = ready ? subs.find((d) => d.s.active !== false && d.next) : null;
  return (
    <div className="screen fade-in tlx sky-screen">
      <div className={`sky ${S.k}`} style={{ background: S.g, color: S.text }}>
        {(S.k === 'night' || S.k === 'dusk' || S.k === 'dawn') && <div className="sky-stars" />}
        {allLit && <div className="sky-shoot" />}
        <div className={`sky-sun ${S.k}`} style={{ left: `${sunX}%`, top: `${sunY}%` }} />
        <div className="sky-head">
          <div><div className="sky-eyebrow">{dateLabel(t)}</div><div className="sky-title">{allLit ? 'Your sky is full' : greeting()}</div></div>
          <Avatar D={D} />
        </div>
        {orbs.map((o, i) => {
          const [x, y] = ORB_SPOTS[i];
          return (
            <button key={o.key} className={`orb ${o.done ? 'lit' : ''} ${burst === i ? 'burst' : ''}`} style={{ left: `${x}%`, top: `${y + 14}%`, '--oc': o.color, animationDelay: `${(i % 5) * 0.6}s` }} onClick={() => tapOrb(o, i)} aria-label={o.label}>
              <span className="core">{o.done ? <Star size={18} fill="currentColor" /> : <HIcon icon={o.icon} size={18} color="#fff" />}</span>
              {!o.done && o.prog > 0 && <svg className="orb-ring" viewBox="0 0 52 52"><circle cx="26" cy="26" r="23" pathLength="1" strokeDasharray={`${o.prog} 1`} /></svg>}
              <span className="lbl">{o.label}</span>
              {burst === i && <span className="orb-burst">{Array.from({ length: 8 }, (_, j) => <i key={j} style={{ '--a': `${j * 45}deg` }} />)}</span>}
            </button>
          );
        })}
        {!orbs.length && <div className="sky-empty">Add habits or tasks and they appear here as stars to light up.</div>}
        <svg className="sky-hills" viewBox="0 0 400 120" preserveAspectRatio="none"><path d="M0 70 C80 30 150 60 220 45 S350 20 400 50 V120 H0Z" fill={S.hill2} /><path d="M0 95 C90 60 170 90 260 72 S360 70 400 85 V120 H0Z" fill={S.hill} /></svg>
        <div className="sky-kai"><Companion stage={D.xp ? stageFor(D.xp.total.level).index : 0} mood={allLit ? 'happy' : companionMood(D.day.score)} size={78} /></div>
      </div>
      <div className="sky-meter">
        <div className="row between small"><span><b className="num">{lit}</b> of {orbs.length} stars lit</span><span className="muted">tap a star when it’s done</span></div>
        <div className="sky-dots">{orbs.map((o) => <i key={o.key} className={o.done ? 'on' : ''} style={{ '--oc': o.color }} />)}</div>
      </div>
      <div className="mt-12"><Prompts D={D} /></div>
      <div className="grid-2 mt-12">
        <button className="sky-card" onClick={() => goTab('plan')}>
          <span className="k"><Clock size={13} /> {D.nn.cur ? 'Now' : 'Next'}</span>
          <span className="t ellipsis">{nn ? nn.title : 'Free time'}</span>
          <span className="s">{nn ? fmtHM(nn.start) : 'nothing planned'}</span>
        </button>
        <button className="sky-card" onClick={() => (ns ? push('Lesson', { sid: ns.s.sid, id: ns.next.id }) : goTab('study'))} style={{ '--sc': ns?.s.color }}>
          <span className="k"><GraduationCap size={13} /> {ns ? ns.s.title : 'Study'}</span>
          <span className="t ellipsis">{ns ? ns.next.title : 'All roadmaps'}</span>
          <span className="s">up next</span>
        </button>
      </div>
      <div className="card mt-12">
        <div className="row between"><span className="h3">How are you feeling?</span><button className="tiny muted" onClick={() => push('MoodCheckin')}>More precise</button></div>
        <div className="mt-8"><MoodScale value={null} onChange={(v) => A.quickMood(v, t)} size={32} /></div>
      </div>
      <QuickAddFab t={t} />
      <MoodDetailSheet state={A.moodSheet} onClose={() => A.setMoodSheet(null)} emotions={settings.emotions} />
    </div>
  );
}
