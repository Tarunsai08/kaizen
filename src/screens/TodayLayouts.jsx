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
  { value: 'sky', label: 'Night sky' },
  { value: 'garden', label: 'Garden' },
  { value: 'ocean', label: 'Reef' },
  { value: 'city', label: 'Skyline' },
  { value: 'rocket', label: 'Launch' },
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
/* ============================================================ scene heroes
   Each creative layout = an interactive scene (replaces the classic header + score card)
   followed by everything from the classic Today screen. */
function useSceneItems(D, A, max = 12) {
  const [burst, setBurst] = useState(null);
  const items = [
    ...D.due.map((x) => ({ key: 'h' + x.h.id, done: x.done, prog: Math.min(1, x.amt / x.target), icon: x.h.icon, color: x.color, label: x.h.name, sub: x.target > 1 ? `${x.amt}/${x.target}` : '', act: () => A.logHabit(x, D.t) })),
    ...D.todayTasks.map((x) => ({ key: 't' + x.id, done: x.done, prog: x.done ? 1 : 0, icon: 'i:CheckCircle2', color: 'var(--task)', label: x.title, sub: 'task', task: true, act: () => A.toggleTask(x) })),
  ].slice(0, max);
  const tapItem = async (o) => {
    const r = await o.act();
    if (!o.done && (r === 'complete' || o.task)) { setBurst(o.key); setTimeout(() => setBurst(null), 1000); }
    else if (r === 'step') { setBurst(o.key + ':s'); setTimeout(() => setBurst(null), 600); }
  };
  const lit = items.filter((o) => o.done).length;
  return { items, tapItem, burst, lit, all: items.length > 0 && lit === items.length };
}
function SceneHeader({ D, title, light = true }) {
  return (
    <div className="sc-head" style={{ color: light ? '#fff' : '#14130f' }}>
      <div style={{ minWidth: 0 }}><div className="sc-eyebrow">{dateLabel(D.t)}</div><div className="sc-title">{title}</div></div>
      <Avatar D={D} />
    </div>
  );
}
function SceneStats({ D, S, label }) {
  return (
    <div className="sc-stats">
      <div className="sc-stat"><b className="num">{D.day.score}</b><span>day score</span></div>
      <div className="sc-stat"><b className="num">{S.lit}<small>/{S.items.length}</small></b><span>{label}</span></div>
      <div className="sc-stat"><b className="num">{D.streak}<small>d</small></b><span>streak</span></div>
      <div className="sc-stat"><b className="num">+{D.xp?.today || 0}</b><span>XP today</span></div>
    </div>
  );
}
function useScene() {
  const D = useTodayData();
  const A = useTodayActions();
  return { D, A };
}

/* ---------- Sky: light up a star for everything you finish ---------- */
const ORB_SPOTS = [[18, 34], [50, 22], [80, 36], [30, 56], [66, 54], [12, 72], [88, 70], [45, 42], [58, 72], [24, 18], [76, 16], [40, 68]];
function skyFor(h) {
  if (h < 5 || h >= 21) return { k: 'night', g: 'linear-gradient(180deg,#05071a 0%,#121a3d 55%,#28224d 100%)', hill: '#0d1330', hill2: '#151c40' };
  if (h < 8) return { k: 'dawn', g: 'linear-gradient(180deg,#3b3a7a 0%,#c56a8f 50%,#f6b38a 100%)', hill: '#3a2d55', hill2: '#5b3f66' };
  if (h < 17) return { k: 'day', g: 'linear-gradient(180deg,#3d8fe0 0%,#7cc0f2 55%,#c9e8fb 100%)', hill: '#2f8a5b', hill2: '#49a873' };
  return { k: 'dusk', g: 'linear-gradient(180deg,#2c2a6b 0%,#a8487a 50%,#f39a5b 100%)', hill: '#2c2347', hill2: '#4a2f55' };
}
export function SkyHero() {
  const { D, A } = useScene();
  if (!D) return <div className="scene" style={{ height: 470 }} />;
  return <SkyScene D={D} A={A} />;
}
function SkyScene({ D, A }) {
  const S = useSceneItems(D, A, ORB_SPOTS.length);
  const n = new Date();
  const K = skyFor(n.getHours());
  const dayFrac = Math.max(0, Math.min(1, ((n.getHours() * 60 + n.getMinutes()) - 360) / (18 * 60)));
  return (
    <>
      <div className={`scene sky ${K.k}`} style={{ background: K.g }}>
        {K.k !== 'day' && <div className="sky-stars" />}
        {S.all && <div className="sky-shoot" />}
        <div className={`sky-sun ${K.k}`} style={{ left: `${8 + dayFrac * 84}%`, top: `${30 - Math.sin(dayFrac * Math.PI) * 22}%` }} />
        <SceneHeader D={D} title={S.all ? 'Your sky is full' : greeting()} />
        {S.items.map((o, i) => {
          const [x, y] = ORB_SPOTS[i];
          const b = S.burst === o.key;
          return (
            <button key={o.key} className={`orb ${o.done ? 'lit' : ''} ${b ? 'burst' : ''}`} style={{ left: `${x}%`, top: `${y + 14}%`, '--oc': o.color, animationDelay: `${(i % 5) * 0.6}s` }} onClick={() => S.tapItem(o)} aria-label={o.label}>
              <span className="core">{o.done ? <Star size={18} fill="currentColor" /> : <HIcon icon={o.icon} size={18} color="#fff" />}</span>
              {!o.done && o.prog > 0 && <svg className="orb-ring" viewBox="0 0 52 52"><circle cx="26" cy="26" r="23" pathLength="1" strokeDasharray={`${o.prog} 1`} /></svg>}
              <span className="lbl">{o.label}</span>
              {b && <span className="orb-burst">{Array.from({ length: 8 }, (_, j) => <i key={j} style={{ '--a': `${j * 45}deg` }} />)}</span>}
            </button>
          );
        })}
        {!S.items.length && <div className="sky-empty">Add habits or tasks and they appear here as stars to light up.</div>}
        <svg className="sky-hills" viewBox="0 0 400 120" preserveAspectRatio="none"><path d="M0 70 C80 30 150 60 220 45 S350 20 400 50 V120 H0Z" fill={K.hill2} /><path d="M0 95 C90 60 170 90 260 72 S360 70 400 85 V120 H0Z" fill={K.hill} /></svg>
        <div className="sky-kai"><Companion stage={D.xp ? stageFor(D.xp.total.level).index : 0} mood={S.all ? 'happy' : companionMood(D.day.score)} size={78} /></div>
      </div>
      <SceneStats D={D} S={S} label="stars lit" />
    </>
  );
}

/* ---------- Garden: every habit is a plant that grows as you log it ---------- */
export function GardenHero() {
  const { D, A } = useScene();
  if (!D) return <div className="scene" style={{ height: 470 }} />;
  return <GardenScene D={D} A={A} />;
}
function Plant({ o, burst, onTap, scale = 1 }) {
  const p = o.done ? 1 : o.prog;
  const h = 26 + p * 64;
  return (
    <button className={`plant ${o.done ? 'bloom' : ''} ${burst ? 'water' : ''}`} onClick={onTap} aria-label={o.label} style={{ '--pc': o.color, transform: `scale(${scale})` }}>
      <svg viewBox="0 0 60 130" width="60" height="130" className="plant-svg">
        <g className="plant-sway">
          <path d={`M30 112 C 30 ${112 - h * 0.5}, ${o.done ? 30 : 33} ${112 - h * 0.8}, 30 ${112 - h}`} stroke="#3f8f4f" strokeWidth="3.4" fill="none" strokeLinecap="round" />
          {p > 0.15 && <path d={`M30 ${112 - h * 0.35} q -16 -6 -20 -18 q 14 0 20 12z`} fill="#4fae5f" />}
          {p > 0.45 && <path d={`M30 ${112 - h * 0.6} q 16 -6 20 -18 q -14 0 -20 12z`} fill="#5cc06c" />}
          {p > 0.75 && <path d={`M30 ${112 - h * 0.82} q -12 -4 -15 -14 q 11 0 15 9z`} fill="#4fae5f" />}
          {o.done ? (
            <g transform={`translate(30 ${112 - h})`} className="flower">
              {[0, 60, 120, 180, 240, 300].map((a) => <ellipse key={a} cx="0" cy="-9" rx="6" ry="9.5" fill={o.color} transform={`rotate(${a})`} />)}
              <circle r="6" fill="#fde68a" />
            </g>
          ) : (
            <circle cx="30" cy={112 - h} r={4 + p * 3} fill={o.color} opacity=".85" />
          )}
        </g>
        <path d="M14 108 h32 l-4 20 h-24z" fill="#b5653a" /><rect x="11" y="104" width="38" height="7" rx="3" fill="#cf7a47" />
      </svg>
      {burst && <span className="drops">{[0, 1, 2, 3, 4].map((j) => <i key={j} style={{ left: `${30 + j * 9}%`, animationDelay: `${j * 0.07}s` }} />)}</span>}
      <span className="plant-lbl">{o.label}</span>
      {o.sub && !o.done && <span className="plant-sub">{o.sub}</span>}
    </button>
  );
}
function GardenScene({ D, A }) {
  const S = useSceneItems(D, A, 10);
  const h = new Date().getHours();
  const night = h < 6 || h >= 20;
  const front = S.items.slice(0, 5), back = S.items.slice(5, 10);
  const butterflies = S.lit >= Math.max(1, Math.ceil(S.items.length / 2));
  return (
    <>
      <div className={`scene garden ${night ? 'night' : ''}`}>
        <div className="g-sun" style={{ width: 52 + D.day.score * 0.4, height: 52 + D.day.score * 0.4 }} />
        <div className="g-cloud c1" /><div className="g-cloud c2" />
        <SceneHeader D={D} title={S.all ? 'Your garden is in full bloom' : 'Tend your garden'} />
        <svg className="g-hill" viewBox="0 0 400 140" preserveAspectRatio="none"><path d="M0 60 C 90 20 180 50 260 34 S 370 30 400 44 V140 H0Z" fill={night ? '#1d3a2a' : '#8fd18a'} /><path d="M0 92 C 100 66 210 92 300 76 S 380 78 400 84 V140 H0Z" fill={night ? '#163022' : '#6fbf6c'} /></svg>
        <div className="g-row back">{back.map((o) => <Plant key={o.key} o={o} scale={0.82} burst={S.burst?.startsWith(o.key)} onTap={() => S.tapItem(o)} />)}</div>
        <div className="g-row front">{front.map((o) => <Plant key={o.key} o={o} burst={S.burst?.startsWith(o.key)} onTap={() => S.tapItem(o)} />)}</div>
        {!S.items.length && <div className="sky-empty" style={{ color: '#1c3b1c' }}>Add habits or tasks to plant your first seeds.</div>}
        {butterflies && <><span className="butterfly b1" /><span className="butterfly b2" /></>}
      </div>
      <SceneStats D={D} S={S} label="in bloom" />
    </>
  );
}

/* ---------- Ocean: an aquarium; finished items swim up into the light ---------- */
export function OceanHero() {
  const { D, A } = useScene();
  if (!D) return <div className="scene" style={{ height: 470 }} />;
  return <OceanScene D={D} A={A} />;
}
function Fish({ o, i, burst, onTap }) {
  const top = o.done ? 14 + (i % 3) * 8 : 40 + ((i * 5) % 8) * 5 - o.prog * 12;
  const dur = o.done ? 9 + (i % 4) : 16 + (i % 5) * 2;
  return (
    <button className={`fish ${o.done ? 'happy' : ''} ${burst ? 'pop' : ''}`} onClick={onTap} aria-label={o.label} style={{ top: `${top}%`, '--fc': o.color, animationDuration: `${dur}s`, animationDelay: `-${(i * 2.3) % dur}s` }}>
      <span className="fish-body">
        <svg viewBox="0 0 64 36" width="58" height="33"><path d="M8 18 C 18 2, 44 2, 52 18 C 44 34, 18 34, 8 18 Z" fill={o.color} /><path d="M50 18 L64 6 L60 18 L64 30 Z" fill={o.color} opacity=".85" /><circle cx="18" cy="15" r="3.2" fill="#fff" /><circle cx="17.4" cy="15" r="1.6" fill="#111" /><path d="M28 9 q4 9 0 18" stroke="rgba(255,255,255,.45)" strokeWidth="2" fill="none" /></svg>
        <span className="fish-ico"><HIcon icon={o.icon} size={11} color="#fff" /></span>
      </span>
      <span className="fish-lbl">{o.label}{o.sub && !o.done ? ` · ${o.sub}` : ''}</span>
      {burst && <span className="bub-burst">{[0, 1, 2, 3, 4, 5].map((j) => <i key={j} style={{ left: `${10 + j * 14}%`, animationDelay: `${j * 0.05}s` }} />)}</span>}
    </button>
  );
}
function OceanScene({ D, A }) {
  const S = useSceneItems(D, A, 9);
  const tide = Math.max(0.12, D.day.score / 100);
  return (
    <>
      <div className="scene ocean">
        <div className="o-water" style={{ height: `${55 + tide * 45}%` }}><div className="o-wave" /></div>
        <div className="o-rays" />
        {Array.from({ length: 10 }, (_, j) => <i key={j} className="o-bubble" style={{ left: `${(j * 37) % 100}%`, animationDelay: `${j * 0.9}s`, animationDuration: `${6 + (j % 4)}s` }} />)}
        <SceneHeader D={D} title={S.all ? 'Everyone is swimming high' : 'Your reef'} />
        {S.items.map((o, i) => <Fish key={o.key} o={o} i={i} burst={S.burst?.startsWith(o.key)} onTap={() => S.tapItem(o)} />)}
        {!S.items.length && <div className="sky-empty">Add habits or tasks and they’ll swim in here.</div>}
        <svg className="o-sand" viewBox="0 0 400 90" preserveAspectRatio="none"><path d="M0 40 C 90 20 180 46 260 30 S 360 26 400 36 V90 H0Z" fill="#e9cf98" /><path d="M0 62 C 100 48 220 70 300 56 S 380 58 400 60 V90 H0Z" fill="#d9b87a" /></svg>
        <div className="o-weed w1" /><div className="o-weed w2" /><div className="o-weed w3" />
        <div className="o-kai"><Companion stage={D.xp ? stageFor(D.xp.total.level).index : 0} mood={S.all ? 'happy' : companionMood(D.day.score)} size={58} /></div>
        <div className="o-tide">tide {Math.round(tide * 100)}%</div>
      </div>
      <SceneStats D={D} S={S} label="swimming high" />
    </>
  );
}

/* ---------- Skyline: each item is a building; windows light up as you progress ---------- */
export function CityHero() {
  const { D, A } = useScene();
  if (!D) return <div className="scene" style={{ height: 470 }} />;
  return <CityScene D={D} A={A} />;
}
function CityScene({ D, A }) {
  const S = useSceneItems(D, A, 8);
  const h = new Date().getHours();
  const day = h >= 7 && h < 17;
  const n = S.items.length || 1;
  return (
    <>
      <div className={`scene city ${day ? 'day' : ''}`}>
        {!day && <div className="sky-stars" />}
        <div className="c-moon" />
        <div className="c-board"><span>TODAY</span><b className="num">{D.day.score}</b></div>
        <SceneHeader D={D} title={S.all ? 'The whole city is lit' : 'Light up the city'} />
        <div className="c-far" />
        <div className="c-row">
          {S.items.map((o, i) => {
            const floors = 5 + ((i * 7) % 5);
            const cols = 3;
            const total = floors * cols;
            const on = Math.round((o.done ? 1 : o.prog) * total);
            const b = S.burst?.startsWith(o.key);
            return (
              <button key={o.key} className={`bld ${o.done ? 'done' : ''} ${b ? 'flash' : ''}`} onClick={() => S.tapItem(o)} aria-label={o.label} style={{ '--bc': o.color, maxWidth: n > 5 ? 'none' : 54 }}>
                {o.done && <span className="bld-top"><Star size={11} fill="currentColor" /></span>}
                <span className="bld-body" style={{ gridTemplateRows: `repeat(${floors}, 1fr)`, height: floors * (n > 6 ? 15 : 17) + 12 }}>
                  {Array.from({ length: total }, (_, k) => <i key={k} className={total - 1 - k < on ? 'on' : ''} style={{ transitionDelay: `${(total - k) * 25}ms` }} />)}
                </span>
                <span className="bld-lbl">{o.label}</span>
              </button>
            );
          })}
          {!S.items.length && <div className="sky-empty">Add habits or tasks to build your skyline.</div>}
        </div>
        {S.all && <div className="fireworks">{[0, 1, 2].map((k) => <span key={k} className={`fw f${k}`}>{Array.from({ length: 12 }, (_, j) => <i key={j} style={{ '--a': `${j * 30}deg` }} />)}</span>)}</div>}
        <div className="c-street" />
      </div>
      <SceneStats D={D} S={S} label="buildings lit" />
    </>
  );
}

/* ---------- Launch: fuel the rocket; at 100% it lifts off ---------- */
export function RocketHero() {
  const { D, A } = useScene();
  if (!D) return <div className="scene" style={{ height: 470 }} />;
  return <RocketScene D={D} A={A} />;
}
function RocketScene({ D, A }) {
  const S = useSceneItems(D, A, 10);
  const fuel = S.items.length ? (S.lit + S.items.filter((o) => !o.done).reduce((a, o) => a + o.prog, 0)) / S.items.length : 0;
  const [launched, setLaunched] = useState(false);
  useEffect(() => { if (S.all && !launched) { const t = setTimeout(() => { setLaunched(true); sfxArrive(); }, 600); return () => clearTimeout(t); } if (!S.all) setLaunched(false); }, [S.all]);
  const left = S.items.filter((o) => !o.done);
  return (
    <>
      <div className={`scene rocket ${launched ? 'launched' : ''}`}>
        <div className="sky-stars" />
        <div className="r-planet" />
        <SceneHeader D={D} title={launched ? 'Liftoff! Day complete' : left.length ? `T-minus ${left.length}` : 'Ready for launch'} />
        <div className="r-pad">
          <div className="r-rocket">
            <svg viewBox="0 0 80 170" width="80" height="170">
              <defs><clipPath id="rfuel"><path d="M40 6 C 60 26 62 60 62 96 V 128 H 18 V 96 C 18 60 20 26 40 6 Z" /></clipPath></defs>
              <path d="M40 6 C 60 26 62 60 62 96 V 128 H 18 V 96 C 18 60 20 26 40 6 Z" fill="#eef1f7" stroke="#c9cfdc" strokeWidth="2" />
              <rect x="16" y={128 - fuel * 108} width="48" height={fuel * 108} fill="url(#fuelg)" clipPath="url(#rfuel)" opacity=".55" className="r-fuel" />
              <linearGradient id="fuelg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#f97316" /><stop offset="1" stopColor="#facc15" /></linearGradient>
              <circle cx="40" cy="58" r="11" fill="#3b82f6" stroke="#c9cfdc" strokeWidth="3" /><circle cx="37" cy="55" r="3" fill="#bfdbfe" />
              <path d="M18 104 L4 136 L18 128 Z" fill="#ef4444" /><path d="M62 104 L76 136 L62 128 Z" fill="#ef4444" /><rect x="30" y="128" width="20" height="8" rx="2" fill="#94a3b8" />
            </svg>
            <span className={`r-flame ${fuel > 0 ? 'on' : ''} ${launched ? 'big' : ''}`} />
          </div>
          <div className="r-gauge"><i style={{ height: `${fuel * 100}%` }} /><span className="num">{Math.round(fuel * 100)}%</span></div>
          {launched && <div className="r-smoke"><i /><i /><i /></div>}
        </div>
        <div className="r-cells">
          {S.items.map((o) => {
            const b = S.burst?.startsWith(o.key);
            return (
              <button key={o.key} className={`cell ${o.done ? 'full' : ''} ${b ? 'zap' : ''}`} onClick={() => S.tapItem(o)} aria-label={o.label} style={{ '--cc': o.color }}>
                <span className="cell-fill" style={{ height: `${(o.done ? 1 : o.prog) * 100}%` }} />
                <span className="cell-ico">{o.done ? <Check size={14} strokeWidth={3} /> : <HIcon icon={o.icon} size={14} color="#fff" />}</span>
                <span className="cell-lbl">{o.label}</span>
              </button>
            );
          })}
          {!S.items.length && <div className="sky-empty" style={{ position: 'static' }}>Add habits or tasks to fuel today’s launch.</div>}
        </div>
      </div>
      <SceneStats D={D} S={S} label="fuel cells" />
    </>
  );
}

