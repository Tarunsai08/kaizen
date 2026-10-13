import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getKV, setKV, DEFAULT_SETTINGS } from '../../db';
import { useApp } from '../../ctx';
import { TopBar, Field, Chips, Toggle } from '../../ui/kit';
import { Kaizen, isAndroid, isNative } from '../../lib/native';
import { ensurePermission, rescheduleSoon } from '../../lib/notify';
import { hmToMin } from '../../lib/date';
import { CATEGORIES, DEFAULT_FACTORS } from '../../scheduler';
import { TEMPLATES, plannerSettings, syncCalendar, replan } from '../../planner/service';
import { MODULES } from './More';
import './planner.css';

const PEAKS = [
  { value: 'early', label: 'Early morning', hours: [6, 7, 8, 9] }, { value: 'late', label: 'Late morning', hours: [10, 11, 12] },
  { value: 'aft', label: 'Afternoon', hours: [14, 15, 16] }, { value: 'eve', label: 'Evening', hours: [17, 18, 19, 20] }, { value: 'night', label: 'Night', hours: [21, 22, 23] },
];
const minHM = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export function CalendarPicker() {
  const { settings, toast } = useApp();
  const ps = plannerSettings(settings);
  const [cals, setCals] = useState(null);
  const [granted, setGranted] = useState(null);
  const load = async () => {
    if (!isAndroid) return setGranted(false);
    try { const s = await Kaizen.calendarStatus(); setGranted(s.granted); if (s.granted) setCals((await Kaizen.getCalendars()).calendars); } catch { setGranted(false); }
  };
  useEffect(() => { load(); }, []);
  const toggle = async (id) => {
    const cur = ps.calendars.length ? ps.calendars : (cals || []).map((c) => c.id);
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    await setKV('planner', { ...ps, calendars: next.length === (cals || []).length ? [] : next });
  };
  if (!isAndroid) return <div className="small muted">Calendar sync works in the Android app.</div>;
  if (!granted) return <button className="btn" onClick={async () => { try { const r = await Kaizen.requestCalendar(); setGranted(r.granted); if (r.granted) { await load(); await syncCalendar(settings, Kaizen, isAndroid); replan(settings, 'calendar'); } else toast('Calendar not allowed'); } catch { toast('Could not ask for calendar access'); } }}>Allow calendar (read only)</button>;
  return (
    <div className="list">
      {(cals || []).map((c) => (
        <div key={c.id} className="list-item">
          <span className="pill-dot" style={{ background: c.color ? `#${(c.color >>> 0).toString(16).padStart(8, '0').slice(2)}` : 'var(--faint)' }} />
          <div className="grow"><div style={{ fontWeight: 560 }}>{c.name}</div><div className="tiny muted ellipsis">{c.account}</div></div>
          <Toggle on={!ps.calendars.length || ps.calendars.includes(c.id)} onChange={() => toggle(c.id)} />
        </div>
      ))}
      {!cals?.length && <div className="list-item muted small">No calendars found on this phone.</div>}
    </div>
  );
}

export function PlannerSetup() {
  const { settings, pop, toast } = useApp();
  const ps = plannerSettings(settings);
  const [step, setStep] = useState(0);
  const [wake, setWake] = useState(settings.wakeTarget || '07:00');
  const [bed, setBed] = useState(settings.bedtimeTarget || '23:00');
  const [peaks, setPeaks] = useState(['early', 'eve']);
  const [blocks, setBlocks] = useState(['Lunch', 'Dinner', 'Sleep']);
  const finish = async () => {
    await setKV('wakeTarget', wake); await setKV('bedtimeTarget', bed);
    const stats = await getKV('plannerStats', DEFAULT_SETTINGS.plannerStats);
    const hours = { ...(stats.energy?.hours || {}) };
    const chosen = new Set(PEAKS.filter((p) => peaks.includes(p.value)).flatMap((p) => p.hours));
    for (let h = 6; h < 24; h++) if (!hours[h]) hours[h] = { s: chosen.has(h) ? 0.95 : 0.4, n: 6 };
    await setKV('plannerStats', { ...stats, energy: { ...(stats.energy || {}), hours } });
    const have = (await db.fixedBlocks.toArray()).map((b) => b.title);
    for (const x of TEMPLATES.filter((x) => blocks.includes(x.title) && !have.includes(x.title))) {
      await db.fixedBlocks.add({ ...x, ...(x.type === 'SLEEP' ? { start: hmToMin(bed), end: hmToMin(wake) } : {}), flexStart: x.flexStart ?? x.start, flexEnd: x.flexEnd ?? x.end, color: '', validFrom: '', validUntil: '', notes: '' });
    }
    await setKV('planner', { ...ps, setupDone: true });
    toast('Planner ready');
    rescheduleSoon();
    pop();
  };
  const steps = [
    <>
      <h2 className="h2">When does your day run?</h2>
      <div className="small dim mt-4">A typical wake and bed time. Your daily check-in updates it.</div>
      <div className="grid-2 mt-16">
        <Field label="Usually wake"><input type="time" className="input" value={wake} onChange={(e) => setWake(e.target.value)} /></Field>
        <Field label="Usually sleep"><input type="time" className="input" value={bed} onChange={(e) => setBed(e.target.value)} /></Field>
      </div>
    </>,
    <>
      <h2 className="h2">When do you focus best?</h2>
      <div className="small dim mt-4">Pick any. Hard work goes there first. It keeps learning from what you finish.</div>
      <div className="mt-16"><Chips wrap multi value={peaks} onChange={setPeaks} options={PEAKS} /></div>
    </>,
    <>
      <h2 className="h2">What is fixed?</h2>
      <div className="small dim mt-4">Add the usual ones now and edit times later under Fixed schedule.</div>
      <div className="mt-16"><Chips wrap multi value={blocks} onChange={setBlocks} options={TEMPLATES.map((x) => ({ value: x.title, label: x.title }))} /></div>
    </>,
    <>
      <h2 className="h2">Calendar and reminders</h2>
      <div className="small dim mt-4">Everything stays on this phone. Calendar access is read only and optional.</div>
      <div className="mt-16"><CalendarPicker /></div>
      {isNative && <button className="btn block mt-12" onClick={async () => { const ok = await ensurePermission(); toast(ok ? 'Reminders allowed' : 'Not allowed'); }}>Allow reminders</button>}
    </>,
  ];
  return (
    <div className="screen no-nav page-enter">
      <TopBar title={`Planner setup · ${step + 1}/${steps.length}`} right={<button className="btn sm" onClick={async () => { await setKV('planner', { ...ps, setupDone: true }); pop(); }}>Skip</button>} />
      {steps[step]}
      <div className="row gap-8 mt-24">
        {step > 0 && <button className="btn" onClick={() => setStep(step - 1)}>Back</button>}
        <button className="btn primary grow" onClick={() => (step < steps.length - 1 ? setStep(step + 1) : finish())}>{step < steps.length - 1 ? 'Next' : 'Finish'}</button>
      </div>
    </div>
  );
}

/** Settings block for the planner and module toggles. */
export function PlannerSettings() {
  const { settings, push, toast } = useApp();
  const ps = plannerSettings(settings);
  const set = (p) => setKV('planner', { ...ps, ...p });
  const mods = settings.modules || {};
  return (
    <>
      <div className="eyebrow mt-8">Planner</div>
      <Field label="Focus session"><Chips value={ps.sessionMin} onChange={(v) => set({ sessionMin: v })} options={[40, 50, 60].map((v) => ({ value: v, label: `${v}m` }))} /></Field>
      <Field label="Break"><Chips value={ps.breakMin} onChange={(v) => set({ breakMin: v })} options={[5, 10, 15].map((v) => ({ value: v, label: `${v}m` }))} /></Field>
      <Field label="Daily focus hours" hint="The most the planner will schedule in a day. Lighter on low days."><Chips wrap value={ps.capacityH} onChange={(v) => set({ capacityH: v })} options={[3, 4, 5, 6, 7, 8, 10].map((v) => ({ value: v, label: `${v}h` }))} /></Field>
      <Field label="Buffer around fixed things"><Chips value={ps.bufferMin} onChange={(v) => set({ bufferMin: v })} options={[0, 5, 10, 15].map((v) => ({ value: v, label: `${v}m` }))} /></Field>
      <Field label="Finish before deadline" hint="Aim to be done this many days early"><Chips value={ps.deadlineBufferDays} onChange={(v) => set({ deadlineBufferDays: v })} options={[0, 1, 2, 3].map((v) => ({ value: v, label: v ? `${v} day${v > 1 ? 's' : ''}` : 'On the day' }))} /></Field>
      <Field label="Time multipliers" hint="Used when you don’t give hours. Learned from how long things really take.">
        <div className="grid-2">
          {CATEGORIES.map((c) => (
            <div key={c.value} className="row gap-8"><span className="small grow">{c.label}</span>
              <input type="number" step="0.1" min="0.3" max="3" className="input" style={{ width: 70, minHeight: 40 }} value={ps.factors[c.value] ?? DEFAULT_FACTORS[c.value]} onChange={(e) => set({ factors: { ...ps.factors, [c.value]: Number(e.target.value) || 1 } })} /></div>
          ))}
        </div>
      </Field>
      <div className="row gap-8"><button className="btn grow" onClick={() => push('FixedSchedule')}>Fixed schedule</button><button className="btn grow" onClick={() => push('PlannerSetup')}>Run setup again</button></div>

      <div className="eyebrow mt-8">Calendar</div>
      <CalendarPicker />
      <Field label="Calendar events starting with this become task suggestions"><input className="input" value={ps.taskPrefix} onChange={(e) => set({ taskPrefix: e.target.value })} /></Field>
      <div className="small muted">Reads events already synced to this phone. Google Tasks can’t be read this way, only calendar events.</div>

      <div className="eyebrow mt-8">Planner reminders</div>
      <div className="card flat row between"><div><div style={{ fontWeight: 600 }}>Session start and end</div><div className="small muted">Quiet during sleep and class</div></div><Toggle on={ps.alertSession} onChange={(v) => set({ alertSession: v })} /></div>
      <div className="card flat row between"><div><div style={{ fontWeight: 600 }}>Evening wrap-up</div><div className="small muted">A one-tap checklist, then your check-in</div></div><Toggle on={ps.alertWrap} onChange={(v) => set({ alertWrap: v })} /></div>
      {ps.alertWrap && <Field label="Wrap-up time"><input type="time" className="input" value={ps.wrapTime} onChange={(e) => set({ wrapTime: e.target.value })} /></Field>}
      <div className="card flat row between"><div><div style={{ fontWeight: 600 }}>At-risk alert</div><div className="small muted">At most once a day</div></div><Toggle on={ps.alertRisk} onChange={(v) => set({ alertRisk: v })} /></div>

      <div className="eyebrow mt-8">Modules</div>
      <div className="small muted">Hidden modules disappear from More, Today and quick add.</div>
      {MODULES.map((m) => (
        <div key={m.key} className="card flat row between"><div><div style={{ fontWeight: 600 }}>{m.label}</div><div className="small muted">{m.sub}</div></div><Toggle on={mods[m.key] !== false} onChange={(v) => setKV('modules', { ...mods, [m.key]: v })} /></div>
      ))}
    </>
  );
}
