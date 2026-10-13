import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getKV } from '../../db';
import { useApp } from '../../ctx';
import { TopBar, Sheet } from '../../ui/kit';
import { today, addDays, parse, DAYS_SHORT, MONTHS, fmtDay } from '../../lib/date';
import { dayData, plannerSettings, dur, hm12, setLowEnergy } from '../../planner/service';
import { buildTimeline, Timeline, SessionSheet } from './PlanToday';
import './planner.css';

export function PlanWeek() {
  const { push, settings, pop, toast } = useApp();
  const t = today();
  const ps = plannerSettings(settings);
  const [open, setOpen] = useState(t);
  const [sel, setSel] = useState(null);
  const [riskSheet, setRiskSheet] = useState(null);
  const d = useLiveQuery(async () => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(t, i));
    const [sessions, tasks, fixed, events, meta] = await Promise.all([db.plannedSessions.where('date').between(t, addDays(t, 7), true, false).toArray(), db.tasks.toArray(), db.fixedBlocks.toArray(), db.calEvents.toArray(), getKV('planMeta', null)]);
    return { days, sessions, tasks, fixed, events, meta };
  }, [t]);
  if (!d) return <div className="screen no-nav" />;
  const cap = ps.capacityH * 60;
  const risk = d.meta?.atRisk || [];
  const stat = (date) => {
    const ss = d.sessions.filter((s) => s.date === date && s.kind !== 'BREAK' && s.state !== 'SKIPPED');
    return { total: ss.reduce((a, s) => a + s.end - s.start, 0), done: ss.filter((s) => s.state === 'DONE' || s.state === 'PARTIAL').reduce((a, s) => a + (s.actualMin || s.end - s.start), 0), due: d.tasks.filter((x) => !x.done && !x.skipped && x.due === date) };
  };
  const cur = stat(open);
  const tl = buildTimeline({ ...d, sessions: d.sessions.filter((s) => s.date === open) }, open, ps);
  const upcoming = d.tasks.filter((x) => !x.done && !x.skipped && x.due && x.due >= t && x.due <= addDays(t, 6)).sort((a, b) => a.due.localeCompare(b.due));
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="This week" />
      {risk.map((r) => (
        <button key={r.taskId} className="pl-risk" style={{ width: '100%', textAlign: 'left', marginTop: 0, marginBottom: 8 }} onClick={() => setRiskSheet(r)}>
          <div style={{ fontWeight: 650 }}>“{r.title}” is at risk</div>
          <div className="small dim mt-4">Needs about {r.shortH}h more than fits. Tap for options.</div>
        </button>
      ))}
      <div className="wk-strip">
        {d.days.map((date) => {
          const st = stat(date), dt = parse(date);
          return (
            <button key={date} className={`wk-day ${open === date ? 'on' : ''}`} onClick={() => setOpen(date)} aria-label={date}>
              <span className="l">{DAYS_SHORT[dt.getDay()][0]}</span>
              <span className="n">{dt.getDate()}</span>
              <span className="bar"><i style={{ height: `${Math.min(100, (st.total / cap) * 100)}%`, background: st.total > cap * 1.05 ? 'var(--goal)' : 'var(--pl)' }} /></span>
              <span className="dot" style={{ opacity: st.due.length ? 1 : 0 }} />
            </button>
          );
        })}
      </div>
      <div className="wk-sum">
        <div><div className="h2 num">{cur.total ? dur(cur.total) : 'Open'}</div><div className="tiny muted">{open === t ? 'Today' : fmtDay(open)}{cur.done ? ` · ${dur(cur.done)} done` : ''}</div></div>
        <div className="wk-ring" style={{ '--p': `${Math.min(100, (cur.total / cap) * 100)}%` }}><span>{Math.round((cur.total / cap) * 100)}%</span></div>
      </div>
      {cur.due.length > 0 && <div className="row gap-6 wrap mt-12">{cur.due.map((x) => <button key={x.id} className="pl-chip" onClick={() => push('TaskForm', { id: x.id })}>Due · {x.title}</button>)}</div>}
      <div className="mt-12">{tl.items.length ? <Timeline items={tl.items} date={open} onOpen={setSel} showNow={open === t} /> : <div className="small muted">Nothing planned. A free day.</div>}</div>
      {open !== t && <div className="tiny muted mt-8">Tentative. It firms up each morning.</div>}
      {upcoming.length > 0 && <>
        <div className="eyebrow mt-24 mb-8">Deadlines this week</div>
        <div className="list">{upcoming.map((x) => {
          const n = Math.round((parse(x.due) - parse(t)) / 864e5);
          return <button key={x.id} className="list-item" onClick={() => push('TaskForm', { id: x.id })}><div className="grow"><div style={{ fontWeight: 560 }}>{x.title}</div><div className="tiny muted">{n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : fmtDay(x.due)}</div></div>{risk.find((r) => r.taskId === x.id) && <span className="tiny" style={{ color: 'var(--goal)', fontWeight: 650 }}>At risk</span>}</button>;
        })}</div>
      </>}
      <SessionSheet item={sel} onClose={() => setSel(null)} />
      <Sheet open={!!riskSheet} onClose={() => setRiskSheet(null)} title="Not enough time">
        {riskSheet && <>
          <div className="small dim">“{riskSheet.title}” needs about {riskSheet.shortH}h more than the week can hold. Nothing is dropped. Pick what feels right:</div>
          <div className="list mt-12">
            <button className="list-item" onClick={() => { setRiskSheet(null); push('Settings'); toast('Raise “Daily focus hours” under Planner'); }}><div className="grow"><div style={{ fontWeight: 600 }}>Raise today’s capacity</div><div className="tiny muted">Currently {ps.capacityH}h of focus a day</div></div></button>
            <button className="list-item" onClick={() => { setRiskSheet(null); push('FixedSchedule'); }}><div className="grow"><div style={{ fontWeight: 600 }}>Use flexible blocks</div><div className="tiny muted">Shift gym or calls to free more time</div></div></button>
            <button className="list-item" onClick={() => { const x = d.tasks.find((q) => q.id === riskSheet.taskId); setRiskSheet(null); push('TaskForm', { id: x?.id }); }}><div className="grow"><div style={{ fontWeight: 600 }}>Reduce scope</div><div className="tiny muted">Trim steps or lower the estimate</div></div></button>
            <button className="list-item" onClick={() => { setRiskSheet(null); toast('Okay. Partial progress still counts'); }}><div className="grow"><div style={{ fontWeight: 600 }}>Accept partial completion</div><div className="tiny muted">Keep the plan and do what fits</div></div></button>
          </div>
        </>}
      </Sheet>
    </div>
  );
}
