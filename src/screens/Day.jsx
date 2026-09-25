import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Timer, Check } from 'lucide-react';
import { db } from '../db';
import { useApp } from '../ctx';
import { today, addDays, parse, DAYS_SHORT, fmtHM, fmtDur, hmToMin } from '../lib/date';
import { completeTask } from '../lib/logic';
import { dayItems } from '../lib/day';
import { HIcon } from '../ui/icons';
import { TaskRow } from '../ui/rows';
import { success, tap } from '../lib/native';

const minToHM = (m) => { m = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

/* Structured-style day timeline */
export function DayView() {
  const { push, settings } = useApp();
  const [date, setDate] = useState(today());
  const t = today();
  const data = useLiveQuery(() => dayItems(date, settings), [date, settings.schedule, settings.bedtimeTarget, settings.wakeTarget, settings.workoutTime]);
  const focusMin = useLiveQuery(async () => (await db.focus.where('date').equals(date).toArray()).reduce((a, b) => a + b.minutes, 0), [date]) || 0;
  const days = Array.from({ length: 10 }, (_, i) => addDays(t, i - 2));
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const nextHalf = () => { const m = Math.ceil((nowMin + 5) / 30) * 30; return minToHM(m); };
  const add = () => push('TaskForm', { due: date, dueTime: date === t ? nextHalf() : '09:00', duration: 30 });

  const toggle = async (it) => {
    if (it.kind === 'task') { if (!it.ref.done) success(); else tap(); await completeTask(it.ref, !it.ref.done); }
    else if (it.kind === 'workout') push('Workout', { date });
    else if (it.kind === 'review') push('NightReview');
    else if (it.kind === 'wake') push('Morning');
    else if (it.kind === 'habit') push('HabitDetail', { id: it.ref.id });
  };
  const open = (it) => {
    if (it.kind === 'task') push('TaskForm', { id: it.ref.id });
    else toggle(it);
  };

  return (
    <div>
      <div className="datestrip">
        {days.map((d) => {
          const p = parse(d);
          return (
            <button key={d} className={`${d === date ? 'on' : ''} ${d === t ? 'today' : ''}`} onClick={() => { tap(); setDate(d); }}>
              <span className="tiny">{DAYS_SHORT[p.getDay()].slice(0, 2)}</span>
              <span className="d">{p.getDate()}</span>
            </button>
          );
        })}
      </div>

      <div className="row gap-10 mb-16">
        <button className="btn grow" onClick={add}><Plus size={18} /> Block</button>
        <button className="btn grow" style={{ background: 'color-mix(in srgb, var(--bored) 16%, var(--surface-2))' }} onClick={() => push('Focus', {})}><Timer size={18} color="var(--bored)" /> Focus{focusMin ? ` · ${fmtDur(focusMin)}` : ''}</button>
      </div>

      {data && data.inbox.length > 0 && (
        <div className="mb-16">
          <div className="eyebrow mb-8">Anytime · {data.inbox.length}</div>
          <div className="list">{data.inbox.map((x) => <TaskRow key={x.id} t={x} showDate={false} />)}</div>
        </div>
      )}

      {data && (
        <div className="tl">
          <div className="tl-line" />
          {data.items.map((it, i) => {
            const prev = data.items[i - 1];
            const gap = prev ? it.startMin - Math.max(prev.endMin, prev.startMin) : 0;
            const h = it.dur ? Math.min(150, Math.max(44, it.dur * 0.9)) : 40;
            const showNow = date === t && prev && nowMin >= prev.startMin && nowMin < it.startMin;
            return (
              <React.Fragment key={it.key}>
                {gap >= 60 && <div className="tl-row" style={{ minHeight: 30 }}><div /><div /><div className="tl-gap">{fmtDur(gap)} free</div></div>}
                {showNow && <div style={{ position: 'relative', height: 10 }}><div className="tl-now" style={{ top: 4 }} /></div>}
                <div className="tl-row" onClick={() => open(it)} style={{ cursor: 'pointer' }}>
                  <div className="tl-time">{fmtHM(minToHM(it.startMin)).replace(/ (am|pm)/, '')}</div>
                  <div className="tl-cap" style={{ height: h, background: it.done ? it.color : `color-mix(in srgb, ${it.color} 30%, var(--surface))`, border: `1.5px solid ${it.color}` }}>
                    <HIcon icon={it.icon} size={18} color={it.done ? '#000' : it.color} />
                  </div>
                  <div className="tl-body row gap-10">
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="tiny muted">{fmtHM(minToHM(it.startMin))}{it.dur ? ` – ${fmtHM(minToHM(it.endMin))} · ${fmtDur(it.dur)}` : ''}</div>
                      <div className={`ellipsis ${it.done && it.kind === 'task' ? 'strike' : ''}`} style={{ fontWeight: 600 }}>{it.title}</div>
                      {it.sub && <div className="tiny muted">{it.sub}</div>}
                    </div>
                    {['task', 'workout', 'review'].includes(it.kind) && (
                      <button className="check" onClick={(e) => { e.stopPropagation(); toggle(it); }} style={{ width: 30, height: 30, borderWidth: 2, borderColor: it.done ? it.color : 'var(--line-2)', background: it.done ? it.color : 'transparent' }} aria-label="Done">
                        {it.done && <Check size={16} color="#000" strokeWidth={3} />}
                      </button>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}
      <div className="tiny muted center mt-16">Give a task a time to place it on your timeline.</div>
    </div>
  );
}
export { hmToMin };
