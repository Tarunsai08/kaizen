import React, { useState } from 'react';
import { Check, Plus, ChevronRight, Flag, Repeat, CalendarDays } from 'lucide-react';
import { db } from '../db';
import { useApp } from '../ctx';
import { tap, success } from '../lib/native';
import { today, fmtDay, lastNDays, fmtHM, weekStart } from '../lib/date';
import { completeTask, sumByDate, breakStats, goalProgress, timeLeft, habitDueOn } from '../lib/logic';
import { Ring, Bar } from './kit';

/* ---------- Build habit row with one-tap logging ---------- */
export function HabitRow({ h, logs, date = today(), weekDots = true }) {
  const { push, celebrate } = useApp();
  const [popKey, setPopKey] = useState(0);
  const byDate = sumByDate(logs);
  const amt = byDate[date] || 0;
  const target = h.target || 1;
  const done = amt >= target;
  const color = h.color || 'var(--habit)';
  const step = h.step || 1;

  const log = async (e) => {
    e.stopPropagation();
    if (done && target === 1) {
      // undo
      tap();
      const ls = await db.habitLogs.where('[habitId+date]').equals([h.id, date]).toArray();
      await db.habitLogs.bulkDelete(ls.map((l) => l.id));
      return;
    }
    if (done) { push('HabitDetail', { id: h.id }); return; }
    await db.habitLogs.add({ habitId: h.id, date, ts: Date.now(), amount: step });
    setPopKey((k) => k + 1);
    if (amt + step >= target) {
      success();
      // all done today?
      const due = await db.habits.where('type').equals('build').filter((x) => !x.archived).toArray();
      const todayLogs = await db.habitLogs.where('date').equals(date).toArray();
      const sums = {};
      todayLogs.forEach((l) => (sums[l.habitId] = (sums[l.habitId] || 0) + (l.amount || 1)));
      const remaining = due.filter((x) => habitDueOn(x, date) && x.freq !== 'weekly' && (sums[x.id] || 0) < (x.target || 1));
      if (!remaining.length) celebrate();
    } else tap('medium');
  };

  const days = lastNDays(7, date);
  return (
    <div className={`habit card-press ${done ? 'done' : ''}`} onClick={() => push('HabitDetail', { id: h.id })}>
      <div className="habit-fill" style={{ background: color, transform: `scaleX(${Math.min(1, amt / target)})` }} />
      <div className="ico" style={{ background: `color-mix(in srgb, ${color} 18%, transparent)` }}>{h.icon || '•'}</div>
      <div className="grow">
        <div className="name ellipsis">{h.name}</div>
        <div className="row gap-6 mt-4">
          {target > 1 ? (
            <span className="small muted num">{amt}/{target} {h.unit || ''}</span>
          ) : h.freq === 'weekly' ? (
            <span className="small muted">{Object.keys(byDate).filter((d) => d >= weekStart(date) && d <= date && byDate[d] >= target).length}/{h.perWeek} this week</span>
          ) : (
            <span className="small muted">{h.windowStart ? `${fmtHM(h.windowStart)}–${fmtHM(h.windowEnd)}` : h.unit ? `${target} ${h.unit}` : 'Once today'}</span>
          )}
          {weekDots && (
            <span className="week-dots" style={{ marginLeft: 4 }}>
              {days.map((d) => <i key={d} style={{ background: (byDate[d] || 0) >= target ? color : (byDate[d] ? `color-mix(in srgb, ${color} 40%, var(--surface-3))` : undefined) }} />)}
            </span>
          )}
        </div>
      </div>
      {target > 1 && !done ? (
        <button onClick={log} style={{ flexShrink: 0 }} aria-label="Log one">
          <Ring size={46} stroke={4.5} value={amt / target} color={color}>
            <Plus key={popKey} className={popKey ? 'pop' : ''} size={20} color={color} />
          </Ring>
        </button>
      ) : (
        <button className={`check ${done ? 'on pop' : ''}`} style={done ? { background: color } : null} onClick={log} aria-label="Done">
          {done && <Check size={22} color="#000" strokeWidth={3} />}
        </button>
      )}
    </div>
  );
}

/* ---------- Break habit card ---------- */
export function BreakRow({ h, urges }) {
  const { push } = useApp();
  const s = breakStats(urges);
  const days = s.sinceDays == null ? null : Math.floor(s.sinceDays);
  const color = h.color || 'var(--break)';
  return (
    <div className="habit card-press" onClick={() => push('HabitDetail', { id: h.id })}>
      <div className="ico" style={{ background: `color-mix(in srgb, ${color} 18%, transparent)` }}>{h.icon || '•'}</div>
      <div className="grow">
        <div className="name ellipsis">{h.name}</div>
        <div className="small muted mt-4">
          {days == null ? 'No relapses logged' : days === 0 ? 'Relapsed today · fresh start' : `${days} day${days === 1 ? '' : 's'} clean`}
          {s.control != null && <> · {Math.round(s.control * 100)}% control</>}
        </div>
      </div>
      <button className="btn sm" style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }} onClick={(e) => { e.stopPropagation(); push('Urge', { habitId: h.id }); }}>
        Urge
      </button>
    </div>
  );
}

/* ---------- Task row ---------- */
export function TaskRow({ t, showDate = true, projects = [], goals = [] }) {
  const { push, toast } = useApp();
  const [anim, setAnim] = useState(false);
  const overdue = !t.done && t.due && t.due < today();
  const proj = projects.find((p) => p.id === t.projectId);
  const goal = goals.find((g) => g.id === t.goalId);
  const subs = t.subtasks || [];
  const toggle = async (e) => {
    e.stopPropagation();
    if (!t.done) { success(); setAnim(true); setTimeout(() => completeTask(t, true), 280); toast('Nice. Task done'); }
    else { tap(); await completeTask(t, false); }
  };
  return (
    <div className="list-item" onClick={() => push('TaskForm', { id: t.id })} style={{ opacity: anim ? 0.4 : 1, transition: 'opacity .3s' }}>
      <button className={`task-check ${t.done || anim ? 'on' : ''}`} onClick={toggle} aria-label="Complete">
        {(t.done || anim) && <Check size={14} strokeWidth={3} />}
      </button>
      <div className="grow">
        <div className={`ellipsis ${t.done || anim ? 'strike' : ''}`} style={{ fontWeight: 540 }}>{t.title}</div>
        {(showDate && t.due) || proj || goal || subs.length || (t.recurrence && t.recurrence !== 'none') ? (
          <div className="row gap-6 tiny muted mt-4 wrap">
            {showDate && t.due && <span style={overdue ? { color: 'var(--bad)' } : null} className="row gap-4"><CalendarDays size={11} />{fmtDay(t.due)}{t.dueTime ? ` ${fmtHM(t.dueTime)}` : ''}</span>}
            {t.recurrence && t.recurrence !== 'none' && <span className="row gap-4"><Repeat size={11} />{t.recurrence}</span>}
            {subs.length > 0 && <span>{subs.filter((s) => s.done).length}/{subs.length}</span>}
            {proj && <span>▸ {proj.name}</span>}
            {goal && <span className="row gap-4"><Flag size={11} />{goal.title}</span>}
          </div>
        ) : null}
      </div>
      {t.priority && t.priority !== 'none' && <Flag size={14} className={`prio-${t.priority}`} fill="currentColor" />}
    </div>
  );
}

/* ---------- Goal card (strip) ---------- */
export const GOAL_TYPE_COLOR = { weekly: 'var(--goal)', monthly: 'var(--money)', yearly: 'var(--task)', casual: 'var(--bored)' };
export function GoalCard({ g, tasks, checkinDue, compact }) {
  const { push } = useApp();
  const p = goalProgress(g, tasks);
  const color = GOAL_TYPE_COLOR[g.type];
  return (
    <button className="card card-press" onClick={() => push('GoalDetail', { id: g.id, checkin: checkinDue })} style={{ width: compact ? '100%' : 210, textAlign: 'left', padding: 14 }}>
      <div className="row between">
        <span className="tiny" style={{ color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{g.type === 'casual' ? 'Someday' : `This ${g.type.replace('ly', '').replace('dai', 'day')}`}</span>
        {checkinDue && <span className="pill-dot" style={{ background: 'var(--accent)' }} />}
      </div>
      <div className="h3 mt-8" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: compact ? 0 : 40 }}>{g.title}</div>
      <div className="mt-12"><Bar value={p.value} color={color} /></div>
      <div className="row between tiny muted mt-8"><span className="num">{p.label}</span><span>{timeLeft(g)}</span></div>
    </button>
  );
}

export function SectionHead({ title, link, onLink }) {
  return (
    <div className="section-head">
      <div className="h3">{title}</div>
      {link && <button className="link row gap-4" onClick={onLink}>{link}<ChevronRight size={14} /></button>}
    </div>
  );
}
