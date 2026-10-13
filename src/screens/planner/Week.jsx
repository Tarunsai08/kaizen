import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarClock, ChevronRight, Settings2 } from 'lucide-react';
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
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="This week" right={<button className="icon-btn" onClick={() => push('FixedSchedule')} aria-label="Fixed schedule"><CalendarClock size={19} /></button>} />
      {risk.map((r) => (
        <button key={r.taskId} className="pl-risk" style={{ width: '100%', textAlign: 'left' }} onClick={() => setRiskSheet(r)}>
          <div style={{ fontWeight: 650 }}>“{r.title}” is at risk</div>
          <div className="small dim mt-4">About {r.shortH}h more than fits before the deadline. Tap for options.</div>
        </button>
      ))}
      <div className="mt-12">
        {d.days.map((date) => {
          const ss = d.sessions.filter((s) => s.date === date && s.kind !== 'BREAK' && s.state !== 'SKIPPED');
          const done = ss.filter((s) => s.state === 'DONE' || s.state === 'PARTIAL').reduce((a, s) => a + (s.actualMin || s.end - s.start), 0);
          const total = ss.reduce((a, s) => a + s.end - s.start, 0);
          const due = d.tasks.filter((x) => !x.done && !x.skipped && x.due === date);
          const dt = parse(date);
          const risky = due.some((x) => risk.find((r) => r.taskId === x.id));
          const isOpen = open === date;
          const tl = isOpen ? buildTimeline({ ...d, sessions: d.sessions.filter((s) => s.date === date), tasks: d.tasks }, date, ps) : null;
          return (
            <div key={date}>
              <button className="pl-day" onClick={() => setOpen(isOpen ? null : date)}>
                <div className="d"><b>{date === t ? 'Today' : DAYS_SHORT[dt.getDay()]}</b><span>{dt.getDate()} {MONTHS[dt.getMonth()]}</span></div>
                <div className="grow">
                  <div className="pl-bar"><i style={{ width: `${Math.min(100, (total / cap) * 100)}%`, opacity: total > cap ? 1 : 0.55, background: total > cap * 1.05 ? 'var(--goal)' : undefined }} /><u style={{ width: `${Math.min(100, (done / cap) * 100)}%` }} /></div>
                  <div className="tiny muted mt-4 ellipsis">{total ? dur(total) : 'Open'}{due.length ? ` · due: ${due.map((x) => x.title).slice(0, 2).join(', ')}${due.length > 2 ? '…' : ''}` : ''}{risky ? ' · at risk' : ''}</div>
                </div>
                <ChevronRight size={16} className="muted" style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
              </button>
              {isOpen && <div style={{ paddingBottom: 12 }}>{tl.items.length ? <Timeline items={tl.items} date={date} onOpen={setSel} showNow={date === t} /> : <div className="small muted" style={{ padding: '8px 0' }}>Nothing planned.</div>}{date !== t && <div className="tiny muted">Tentative. It firms up each morning.</div>}</div>}
            </div>
          );
        })}
      </div>
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
