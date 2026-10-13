import React, { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sunrise, Moon, ChevronRight, X, Play, Check, SkipForward, Shuffle, Plus, Sparkles, Calendar, Pin, CloudRain } from 'lucide-react';
import { db, getKV, setKV } from '../../db';
import { useApp } from '../../ctx';
import { today, hmToMin, beforeDayStart } from '../../lib/date';
import { success, tap } from '../../lib/native';
import { Sheet, Toggle } from '../../ui/kit';
import { blockSegments } from '../../scheduler';
import { dayData, plannerSettings, startSession, finishSession, extendSession, swapSession, editSession, setLowEnergy, typeColor, hm12, dur, eventToTask } from '../../planner/service';
import './planner.css';

const KIND_COLOR = { WORK: 'var(--accent)', EASY_WIN: 'var(--good)', PLAN_SUBTASKS: 'var(--goal)', BUFFER: 'var(--faint)', BREAK: 'var(--faint)' };

/** Merge everything that happens on a date into one ordered list. */
export function buildTimeline(data, date, ps) {
  const items = [];
  blockSegments(data.fixed, date).forEach(({ b, seg }, i) => {
    if (b.type === 'SLEEP' && seg[0] === 0) return;
    items.push({ key: `f${b.id}-${i}`, kind: 'fixed', start: seg[0], end: seg[1], title: b.title, sub: b.flexible ? 'Flexible' : b.notes || '', color: b.color || typeColor(b.type) });
  });
  const dayStart = new Date(date + 'T00:00').getTime();
  const banners = [];
  (data.events || []).forEach((e) => {
    if (e.treatAs === 'IGNORE' || (ps.calendars?.length && !ps.calendars.includes(e.calendarId))) return;
    if (e.allDay) { if (e.start <= dayStart && e.end > dayStart) banners.push(e); return; }
    if (e.end <= dayStart || e.start >= dayStart + 864e5) return;
    const s = Math.max(0, Math.round((e.start - dayStart) / 60000)), en = Math.min(1440, Math.round((e.end - dayStart) / 60000));
    items.push({ key: 'e' + e.id, kind: 'event', start: s, end: en, title: e.title, sub: e.treatAs === 'CONVERTED_TO_TASK' ? 'Now a task' : 'Calendar', color: '#60a5fa', event: e });
  });
  (data.tasks || []).filter((x) => !x.done && !x.skipped && x.due === date && x.dueTime && x.difficulty == null && !x.pcat).forEach((x) => {
    const s = hmToMin(x.dueTime);
    items.push({ key: 't' + x.id, kind: 'task', start: s, end: s + (x.duration || 30), title: x.title, sub: 'Task at a set time', color: 'var(--task)', task: x });
  });
  (data.sessions || []).forEach((s) => {
    if (s.state === 'SKIPPED' && (s.auto || s.swapped)) return;
    const task = (data.tasks || []).find((x) => x.id === s.taskId);
    items.push({ key: 's' + s.id, kind: s.kind === 'BREAK' ? 'break' : 'session', start: s.start, end: s.end, title: s.title, sub: s.reason, color: KIND_COLOR[s.kind] || 'var(--accent)', session: s, task });
  });
  return { items: items.sort((a, b) => a.start - b.start || a.end - b.end), banners };
}

export function CheckinCard() {
  const { push } = useApp();
  const t = today();
  const d = useLiveQuery(async () => ({ sleep: await db.sleep.where('date').equals(t).first(), journal: await db.journal.where('date').equals(t).first() }), [t]);
  const { settings } = useApp();
  if (!d) return null;
  const n = new Date();
  const mins = n.getHours() * 60 + n.getMinutes();
  const bed = hmToMin(settings.bedtimeTarget || '23:00');
  const morning = !d.sleep?.wakeTs && mins >= 240 && mins < 780;
  const night = !d.journal && (mins >= Math.max(1080, bed - 180) || beforeDayStart());
  const card = (k, Icon, color, title, sub, to) => (
    <button key={k} className="card card-press row gap-14 mt-12" style={{ width: '100%', textAlign: 'left' }} onClick={() => push(to)}>
      <div className="swatch" style={{ background: `color-mix(in srgb, ${color} 18%, transparent)` }}><Icon size={20} color={color} /></div>
      <div className="grow"><div className="h3">{title}</div><div className="small muted">{sub}</div></div>
      <ChevronRight size={18} className="muted" />
    </button>
  );
  return <>
    {morning && card('m', Sunrise, 'var(--goal)', 'Morning check-in', 'Wake time, sleep and mood shape today’s plan', 'Morning')}
    {night && card('n', Moon, 'var(--sleep)', 'Evening check-in', 'Close the day so tomorrow’s plan fits you', 'NightReview')}
  </>;
}

export function NowCard({ items, ctx, onOpen }) {
  const { push, toast } = useApp();
  const n = new Date();
  const mins = n.getHours() * 60 + n.getMinutes();
  const act = (it) => it.kind === 'session' && it.session.state === 'PLANNED' && it.session.kind !== 'BREAK';
  const cur = items.find((it) => act(it) && (it.session.startedAt || (it.start <= mins && it.end > mins)));
  const next = !cur && items.find((it) => act(it) && it.start > mins);
  const busy = !cur && items.find((it) => (it.kind === 'fixed' || it.kind === 'event') && it.start <= mins && it.end > mins);
  const it = cur || next;
  const s = it?.session;
  const go = async (fn, msg) => { await fn(); if (msg) { success(); toast(msg); } else tap(); };
  if (!it) {
    return (
      <div className="pl-now" style={{ '--pc': busy?.color }}>
        <div className="bar" />
        <div className="eyebrow">{busy ? 'Now' : 'Free'}</div>
        <div className="h2 mt-4">{busy ? busy.title : 'Nothing planned right now'}</div>
        <div className="why">{busy ? `Until ${hm12(busy.end)}. I’ll plan around it.` : 'Enjoy the space, or add something you want to get done.'}</div>
        {!busy && <div className="pl-acts"><button className="btn" onClick={() => push('TaskForm', { due: today() })}><Plus size={16} /> Add task</button></div>}
      </div>
    );
  }
  const started = !!s.startedAt;
  const left = Math.max(0, it.end - mins);
  return (
    <div className="pl-now" style={{ '--pc': it.color }}>
      <div className="bar" />
      <div className="row between">
        <div className="eyebrow">{cur ? (started ? 'In progress' : 'Now') : 'Next'} · {hm12(it.start)}–{hm12(it.end)}</div>
        <span className="tiny muted">{cur ? `${dur(left)} left` : `in ${dur(Math.max(0, it.start - mins))}`}</span>
      </div>
      <button className="h2 mt-4" style={{ textAlign: 'left', width: '100%' }} onClick={() => onOpen(it)}>{it.title}</button>
      {s.title !== s.taskTitle && <div className="small muted">{s.taskTitle}</div>}
      <div className="why">{s.reason}</div>
      {!started ? (
        <div className="pl-acts">
          <button className="btn primary" onClick={() => go(() => startSession(s.id))}><Play size={16} /> Start</button>
          <button className="btn" onClick={() => go(() => finishSession(s.id, 'DONE'), 'Done. Nice work')}><Check size={16} /> Done</button>
          <button className="btn ic" onClick={() => go(() => finishSession(s.id, 'SKIPPED'))} aria-label="Skip"><SkipForward size={16} /></button>
          <button className="btn ic" onClick={() => go(() => swapSession(s.id))} aria-label="Swap"><Shuffle size={16} /></button>
        </div>
      ) : (
        <div className="pl-acts">
          <button className="btn primary" onClick={() => go(() => finishSession(s.id, 'DONE'), 'Done. Nice work')}><Check size={16} /> Done</button>
          <button className="btn" onClick={() => go(() => extendSession(s.id, 15))}>+15 min</button>
          <button className="btn" onClick={() => go(() => finishSession(s.id, 'PARTIAL'), 'Partly done is progress')}>Partly</button>
        </div>
      )}
    </div>
  );
}

export function SessionSheet({ item, onClose }) {
  const { push, toast } = useApp();
  if (!item) return <Sheet open={false} onClose={onClose} />;
  const s = item.session;
  const len = s ? s.end - s.start : 0;
  const shift = async (d) => { await editSession(s.id, { start: s.start + d, end: s.end + d }); onClose(); toast('Moved'); };
  const size = async (l) => { await editSession(s.id, { end: s.start + l }); onClose(); };
  return (
    <Sheet open onClose={onClose} title={item.title}>
      {s ? <>
        <div className="small muted">{hm12(s.start)}–{hm12(s.end)} · {dur(len)}{s.pinned ? ' · pinned' : ''}</div>
        <div className="small mt-8">{s.reason}</div>
        {s.state === 'PLANNED' && <>
          <div className="eyebrow mt-16 mb-8">Move</div>
          <div className="row gap-8 wrap">
            {[-60, -15, 15, 60].map((d) => <button key={d} className="btn sm" onClick={() => shift(d)}>{d < 0 ? '−' : '+'}{Math.abs(d) >= 60 ? `${Math.abs(d) / 60}h` : `${Math.abs(d)}m`}</button>)}
          </div>
          <div className="eyebrow mt-16 mb-8">Length</div>
          <div className="row gap-8 wrap">{[25, 40, 50, 60, 90].map((l) => <button key={l} className={`btn sm ${l === len ? 'primary' : ''}`} onClick={() => size(l)}>{l}m</button>)}</div>
          <div className="row between mt-16"><div><div style={{ fontWeight: 600 }}>Pin this session</div><div className="tiny muted">Re-planning will leave it exactly here</div></div><Toggle on={!!s.pinned} onChange={async (v) => { await editSession(s.id, { pinned: v }); onClose(); }} /></div>
          <div className="pl-acts">
            <button className="btn primary" onClick={async () => { await finishSession(s.id, 'DONE'); success(); onClose(); }}><Check size={16} /> Done</button>
            <button className="btn" onClick={async () => { await finishSession(s.id, 'SKIPPED'); onClose(); }}>Skip</button>
          </div>
        </>}
        {item.task && <button className="btn block mt-12" onClick={() => { onClose(); push('TaskForm', { id: item.task.id }); }}>Open task</button>}
      </> : item.event ? <>
        <div className="small muted">{hm12(item.start)}–{hm12(item.end)} · calendar event</div>
        <div className="pl-acts">
          <button className="btn" onClick={async () => { await db.calEvents.update(item.event.id, { treatAs: 'IGNORE' }); onClose(); toast('Ignored in the plan'); }}>Ignore</button>
          <button className="btn primary" onClick={async () => { await eventToTask(item.event); onClose(); toast('Turned into a task'); }}>Turn into task</button>
        </div>
      </> : null}
    </Sheet>
  );
}

export function Timeline({ items, date, onOpen, showNow = true }) {
  const n = new Date();
  const mins = date === today() ? n.getHours() * 60 + n.getMinutes() : -1;
  return (
    <div className="pl-tl">
      {items.map((it, i) => {
        const isNow = showNow && mins >= 0 && it.start <= mins && it.end > mins;
        const done = it.session?.state === 'DONE' || it.session?.state === 'PARTIAL';
        const skipped = it.session?.state === 'SKIPPED';
        const past = mins >= 0 && it.end <= mins;
        return (
          <div className="pl-row" key={it.key} style={{ '--pc': it.color }}>
            <div className="pl-time">{it.kind === 'break' ? '' : hm12(it.start).replace(' ', '').toLowerCase()}</div>
            <div className="pl-line"><i style={{ opacity: it.kind === 'break' ? 0.4 : 1, width: it.kind === 'break' ? 6 : 10, height: it.kind === 'break' ? 6 : 10, marginTop: it.kind === 'break' ? 17 : 15 }} />{i < items.length - 1 && <b />}</div>
            <button className={`pl-card ${it.kind === 'break' ? 'brk' : ''} ${isNow ? 'now' : ''} ${past || skipped ? 'past' : ''} ${done ? 'done' : ''}`} onClick={() => it.kind !== 'break' && onOpen(it)}>
              <div className="t"><span className="tt">{it.title}</span>{done && <Check size={14} color="var(--good)" />}{it.session?.pinned && <Pin size={12} className="muted" />}{skipped && <span className="tiny muted">skipped</span>}</div>
              {it.kind !== 'break' && <div className="s">{it.kind === 'session' ? it.sub : `${hm12(it.start)}–${hm12(it.end)}${it.sub ? ' · ' + it.sub : ''}`}</div>}
              {it.kind === 'break' && <div className="s" style={{ marginTop: 0 }}>{it.sub}</div>}
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** The whole planner part of Today: check-in, plan note, Now card, at-risk, timeline. */
export default function PlanBlock() {
  const { push, settings, toast } = useApp();
  const t = today();
  const [, setTick] = useState(0);
  const [sel, setSel] = useState(null);
  useEffect(() => { const i = setInterval(() => setTick((x) => x + 1), 30000); return () => clearInterval(i); }, []);
  const ps = plannerSettings(settings);
  const data = useLiveQuery(async () => ({ ...(await dayData(t, settings)), meta: await getKV('planMeta', null), seen: await getKV('planNoteSeen', 0) }), [t, settings.wakeTarget]);
  const tl = useMemo(() => (data ? buildTimeline(data, t, ps) : { items: [], banners: [] }), [data, settings.planner]);
  if (!data) return null;
  const { ctx, meta } = data;
  const chip = [ctx.mood ? `Mood ${ctx.mood}` : null, ctx.sleepH ? `Slept ${Math.round(ctx.sleepH * 10) / 10}h` : null].filter(Boolean).join(' · ');
  const planned = data.sessions.filter((s) => s.kind !== 'BREAK' && s.state !== 'SKIPPED');
  const doneN = planned.filter((s) => s.state === 'DONE' || s.state === 'PARTIAL').length;
  const risk = meta?.atRisk || [];
  const pull = meta?.offers?.[0];
  return (
    <div>
      {!ps.setupDone && (
        <button className="card card-press row gap-14 mt-12" style={{ width: '100%', textAlign: 'left' }} onClick={() => push('PlannerSetup')}>
          <div className="swatch" style={{ background: 'color-mix(in srgb, var(--accent) 16%, transparent)' }}><Sparkles size={20} color="var(--accent)" /></div>
          <div className="grow"><div className="h3">Set up your planner</div><div className="small muted">Wake time, peak hours and fixed commitments · 1 minute</div></div>
          <ChevronRight size={18} className="muted" />
        </button>
      )}
      <CheckinCard />
      <div className="row between mt-12" style={{ gap: 8, flexWrap: 'wrap' }}>
        <div className="row gap-6 wrap">
          {chip && <span className="pl-chip">{chip}</span>}
          {planned.length > 0 && <span className="pl-chip">{doneN}/{planned.length} sessions</span>}
        </div>
        <button className="pl-chip" style={ctx.lowEnergy ? { background: 'color-mix(in srgb, var(--goal) 22%, var(--surface-2))', color: 'var(--text)' } : null} onClick={async () => { await setLowEnergy(!ctx.lowEnergy); tap(); toast(ctx.lowEnergy ? 'Back to the normal plan' : 'Lighter plan today'); }}><CloudRain size={14} />Low energy today</button>
      </div>
      {meta?.lowDay && <div className="small dim mt-8">Lighter plan today. Small steps count.</div>}
      {meta?.note && meta.noteId !== data.seen && (
        <div className="pl-note"><span>{meta.note}</span><button aria-label="Dismiss" onClick={() => setKV('planNoteSeen', meta.noteId)}><X size={16} /></button></div>
      )}
      {tl.banners.length > 0 && <div className="small dim mt-8"><Calendar size={13} style={{ verticalAlign: -2 }} /> {tl.banners.map((b) => b.title).join(' · ')}</div>}
      <NowCard items={tl.items} ctx={ctx} onOpen={setSel} />
      {pull && <button className="btn block mt-8" onClick={async () => { await setKV('pull', { date: t, taskId: pull.taskId }); toast('Pulled forward'); }}><Sparkles size={15} /> {pull.text} <span className="muted">· {pull.title}</span></button>}
      {risk.length > 0 && (
        <button className="pl-risk" style={{ width: '100%', textAlign: 'left' }} onClick={() => push('PlanWeek')}>
          <div style={{ fontWeight: 650 }}>{risk.length === 1 ? `“${risk[0].title}” is at risk` : `${risk.length} tasks are at risk`}</div>
          <div className="small dim mt-4">Needs about {risk[0].shortH}h more than fits before the deadline. See options.</div>
        </button>
      )}
      <div className="row between mt-24"><div className="eyebrow">Today</div><button className="tiny muted" onClick={() => push('PlanWeek')}>Week</button></div>
      {tl.items.length ? <Timeline items={tl.items} date={t} onOpen={setSel} /> : <div className="small muted mt-8">Your day is open. Add a task and the plan fills in.</div>}
      <SessionSheet item={sel} onClose={() => setSel(null)} />
    </div>
  );
}
