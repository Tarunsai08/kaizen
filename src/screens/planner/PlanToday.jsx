import React, { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, X, Play, Check, Sparkles, Calendar, Pin, CloudRain, CalendarClock, CalendarRange } from 'lucide-react';
import { db, getKV, setKV } from '../../db';
import { useApp } from '../../ctx';
import { today, hmToMin } from '../../lib/date';
import { success, tap } from '../../lib/native';
import { Sheet, Toggle } from '../../ui/kit';
import { blockSegments } from '../../scheduler';
import { dayData, plannerSettings, startSession, finishSession, skipSession, startNow, doInstead, editSession, setLowEnergy, typeColor, hm12, dur, eventToTask } from '../../planner/service';
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
    if (s.state === 'SKIPPED') return;
    const task = (data.tasks || []).find((x) => x.id === s.taskId);
    items.push({ key: 's' + s.id, kind: s.kind === 'BREAK' ? 'break' : 'session', start: s.start, end: s.end, title: s.title, sub: s.reason, color: KIND_COLOR[s.kind] || 'var(--accent)', session: s, task });
  });
  return { items: items.sort((a, b) => a.start - b.start || a.end - b.end), banners };
}

export function NowCard({ items, onOpen, onPick }) {
  const { toast } = useApp();
  const n = new Date();
  const mins = n.getHours() * 60 + n.getMinutes();
  const act = (it) => it.kind === 'session' && it.session.state === 'PLANNED';
  const cur = items.find((it) => act(it) && (it.session.startedAt || (it.start <= mins && it.end > mins)));
  const next = !cur && items.find((it) => act(it) && it.start > mins);
  const busy = !cur && items.find((it) => (it.kind === 'fixed' || it.kind === 'event') && it.start <= mins && it.end > mins);
  const it = cur || next;
  const s = it?.session;
  if (!it) {
    return (
      <div className="pl-now" style={{ '--pc': busy?.color }}>
        <div className="bar" />
        <div className="eyebrow">{busy ? 'Now' : 'Free'}</div>
        <div className="h2 mt-4">{busy ? busy.title : 'Nothing planned right now'}</div>
        <div className="why">{busy ? `Until ${hm12(busy.end)}.` : 'Pick something if you feel like it.'}</div>
        {!busy && <div className="pl-acts"><button className="btn primary" onClick={() => onPick(null)}>Pick a task</button></div>}
      </div>
    );
  }
  const started = !!s.startedAt;
  return (
    <div className="pl-now" style={{ '--pc': it.color }}>
      <div className="bar" />
      <div className="row between">
        <div className="eyebrow">{started ? 'In progress' : cur ? 'Now' : 'Next'} · {hm12(it.start)}</div>
        <span className="tiny muted">{cur ? `${dur(Math.max(0, it.end - mins))} left` : `in ${dur(Math.max(0, it.start - mins))}`}</span>
      </div>
      <button className="h2 mt-4" style={{ textAlign: 'left', width: '100%' }} onClick={() => onOpen(it)}>{it.title}</button>
      {s.title !== s.taskTitle && <div className="small muted">{s.taskTitle}</div>}
      <div className="why">{s.reason}</div>
      <div className="pl-acts">
        {started
          ? <button className="btn primary" onClick={async () => { await finishSession(s.id, 'DONE'); success(); toast('Done. Nice work'); }}><Check size={16} /> Done</button>
          : <button className="btn primary" onClick={async () => { await startSession(s.id); tap(); }}><Play size={16} /> Start</button>}
        <button className="btn quiet" onClick={() => onOpen(it)}>Not now</button>
      </div>
    </div>
  );
}

/** Any open task can be started right now, whatever the plan says. */
export function TaskPicker({ open, onClose, currentId }) {
  const { settings, toast } = useApp();
  const tasks = useLiveQuery(() => db.tasks.filter((x) => !x.done && !x.skipped && !x.dueTime).toArray(), []) || [];
  const list = tasks.sort((a, b) => (a.due || '9').localeCompare(b.due || '9')).slice(0, 40);
  return (
    <Sheet open={open} onClose={onClose} title="Do something else">
      <div className="small dim mb-8">It starts now. The rest of your day rearranges around it.</div>
      <div className="list">
        {list.map((x) => (
          <button key={x.id} className="list-item" onClick={async () => { await doInstead(currentId, x.id, settings); onClose(true); success(); toast('Started'); }}>
            <div className="grow"><div style={{ fontWeight: 560 }}>{x.title}</div><div className="tiny muted">{x.due ? `Due ${x.due}` : 'No date'}</div></div>
          </button>
        ))}
        {!list.length && <div className="list-item muted small">No open tasks.</div>}
      </div>
    </Sheet>
  );
}

export function SessionSheet({ item, onClose }) {
  const { push, toast } = useApp();
  const [adjust, setAdjust] = useState(false);
  const [pick, setPick] = useState(false);
  useEffect(() => { setAdjust(false); setPick(false); }, [item]);
  if (!item) return <Sheet open={false} onClose={onClose} />;
  const s = item.session;
  if (pick) return <TaskPicker open onClose={(done) => { setPick(false); if (done) onClose(); }} currentId={s?.id} />;
  const len = s ? s.end - s.start : 0;
  const planned = s?.state === 'PLANNED';
  const shift = async (d) => { await editSession(s.id, { start: s.start + d, end: s.end + d }); onClose(); toast('Moved'); };
  const size = async (l) => { await editSession(s.id, { end: s.start + l }); onClose(); };
  return (
    <Sheet open onClose={onClose} title={item.title}>
      {s ? <>
        <div className="small muted">{hm12(s.start)}–{hm12(s.end)} · {dur(len)}{s.pinned ? ' · pinned' : ''}</div>
        <div className="small mt-8">{s.reason}</div>
        {planned && <>
          <div className="pl-acts">
            <button className="btn primary" onClick={async () => { await startNow(s.id); onClose(); success(); }}><Play size={16} /> Start now</button>
            <button className="btn" onClick={async () => { await finishSession(s.id, 'DONE'); success(); onClose(); }}><Check size={16} /> Done</button>
          </div>
          <div className="list mt-12">
            <button className="list-item" onClick={() => setPick(true)}><span className="grow">Do something else now</span><ChevronRight size={16} className="muted" /></button>
            <button className="list-item" onClick={async () => { await skipSession(s.id); onClose(); toast('Moved to another time'); }}><span className="grow">Skip for today</span></button>
            <button className="list-item" onClick={() => setAdjust(!adjust)}><span className="grow">Adjust time</span><ChevronRight size={16} className="muted" style={{ transform: adjust ? 'rotate(90deg)' : 'none' }} /></button>
          </div>
          {adjust && <div className="mt-12">
            <div className="row gap-8 wrap">{[-60, -15, 15, 60].map((d) => <button key={d} className="btn sm" onClick={() => shift(d)}>{d < 0 ? '−' : '+'}{Math.abs(d) >= 60 ? `${Math.abs(d) / 60}h` : `${Math.abs(d)}m`}</button>)}</div>
            <div className="row gap-8 wrap mt-8">{[25, 40, 50, 60, 90].map((l) => <button key={l} className={`btn sm ${l === len ? 'primary' : ''}`} onClick={() => size(l)}>{l}m</button>)}</div>
            <div className="row between mt-12"><div className="small">Keep exactly here</div><Toggle on={!!s.pinned} onChange={async (v) => { await editSession(s.id, { pinned: v }); onClose(); }} /></div>
          </div>}
        </>}
        {item.task && <button className="btn block mt-12" onClick={() => { onClose(); push('TaskForm', { id: item.task.id }); }}>Open task</button>}
      </> : item.event ? <>
        <div className="small muted">{hm12(item.start)}–{hm12(item.end)} · calendar event</div>
        <div className="pl-acts">
          <button className="btn" onClick={async () => { await db.calEvents.update(item.event.id, { treatAs: 'IGNORE' }); onClose(); toast('Ignored in the plan'); }}>Ignore</button>
          <button className="btn primary" onClick={async () => { await eventToTask(item.event); onClose(); toast('Turned into a task'); }}>Make a task</button>
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

/** The planner's day view (Plan tab): Now card, timeline, at-risk. */
export default function PlanBlock() {
  const { push, settings, toast } = useApp();
  const t = today();
  const [, setTick] = useState(0);
  const [sel, setSel] = useState(null);
  const [pick, setPick] = useState(false);
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
        <button className="card card-press row gap-14" style={{ width: '100%', textAlign: 'left' }} onClick={() => push('PlannerSetup')}>
          <div className="swatch" style={{ background: 'color-mix(in srgb, var(--accent) 16%, transparent)' }}><Sparkles size={20} color="var(--accent)" /></div>
          <div className="grow"><div className="h3">Set up your planner</div><div className="small muted">Wake time, peak hours, fixed commitments</div></div>
          <ChevronRight size={18} className="muted" />
        </button>
      )}
      <div className="row between" style={{ gap: 8, flexWrap: 'wrap' }}>
        <div className="row gap-6 wrap">
          {chip && <span className="pl-chip">{chip}</span>}
          {planned.length > 0 && <span className="pl-chip">{doneN}/{planned.length} done</span>}
        </div>
        <button className="pl-chip" style={ctx.lowEnergy ? { background: 'color-mix(in srgb, var(--goal) 22%, var(--surface-2))', color: 'var(--text)' } : null} onClick={async () => { await setLowEnergy(!ctx.lowEnergy); tap(); toast(ctx.lowEnergy ? 'Back to the normal plan' : 'Lighter plan today'); }}><CloudRain size={14} />Low energy</button>
      </div>
      {meta?.lowDay && <div className="small dim mt-8">Lighter plan today. Small steps count.</div>}
      {meta?.note && meta.noteId !== data.seen && (
        <div className="pl-note"><span>{meta.note}</span><button aria-label="Dismiss" onClick={() => setKV('planNoteSeen', meta.noteId)}><X size={16} /></button></div>
      )}
      {tl.banners.length > 0 && <div className="small dim mt-8"><Calendar size={13} style={{ verticalAlign: -2 }} /> {tl.banners.map((b) => b.title).join(' · ')}</div>}
      <NowCard items={tl.items} onOpen={setSel} onPick={() => setPick(true)} />
      {pull && <button className="btn block mt-8" onClick={async () => { await setKV('pull', { date: t, taskId: pull.taskId }); toast('Pulled forward'); }}><Sparkles size={15} /> {pull.text}</button>}
      {risk.length > 0 && (
        <button className="pl-risk" style={{ width: '100%', textAlign: 'left' }} onClick={() => push('PlanWeek')}>
          <div style={{ fontWeight: 650 }}>{risk.length === 1 ? `“${risk[0].title}” is at risk` : `${risk.length} tasks are at risk`}</div>
          <div className="small dim mt-4">It needs more time than fits before the deadline. See options.</div>
        </button>
      )}
      <div className="eyebrow mt-24">Today</div>
      {tl.items.length ? <Timeline items={tl.items} date={t} onOpen={setSel} /> : <div className="small muted mt-8">Your day is open. Add a task and the plan fills in.</div>}
      <div className="list mt-24">
        <button className="list-item" onClick={() => push('PlanWeek')}><CalendarRange size={18} className="muted" /><span className="grow">This week</span><ChevronRight size={16} className="muted" /></button>
        <button className="list-item" onClick={() => push('FixedSchedule')}><CalendarClock size={18} className="muted" /><span className="grow">Fixed schedule</span><ChevronRight size={16} className="muted" /></button>
        <button className="list-item" onClick={() => push('PlannerInsights')}><Sparkles size={18} className="muted" /><span className="grow">Planner insights</span><ChevronRight size={16} className="muted" /></button>
      </div>
      <SessionSheet item={sel} onClose={() => setSel(null)} />
      <TaskPicker open={pick} onClose={() => setPick(false)} currentId={null} />
    </div>
  );
}
