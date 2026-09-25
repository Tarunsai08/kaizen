import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Check, CalendarRange, Library as LibIcon, BarChart3, Moon, Trash2, Pencil, X, ChevronRight, Sun } from 'lucide-react';
import { db, setKV } from '../db';
import { useApp } from '../ctx';
import { today, addDays, dow, weekStart, DAYS_SHORT, fmtDay, periodRange, buckets, range, fmtDur, fmtTime, ymd, lastNDays, fmtHM } from '../lib/date';
import { sleepMinutes, sleepConsistency, clockMinFromNoon, clockMin, avg } from '../lib/logic';
import { TopBar, Seg, Field, Sheet, Stepper, Chips, PeriodToggle, Stat, Empty, Confirm, ColorPicker, Scale5, Ring } from '../ui/kit';
import { Heatmap, Bars, HBars, Line } from '../ui/charts';
import { SectionHead } from '../ui/rows';
import { success, tap } from '../lib/native';

const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Core', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Full body', 'Cardio'];
const AREAS = ['Spine', 'Hips', 'Hamstrings', 'Shoulders', 'Neck', 'Core', 'Balance', 'Breath', 'Full body'];
const WEEK = [1, 2, 3, 4, 5, 6, 0];

/* =========================================================
   BODY TAB
   ========================================================= */
export function Body() {
  const [view, setView] = useState('move');
  return (
    <div className="screen fade-in">
      <div className="row between" style={{ marginBottom: 16, marginTop: 4 }}>
        <h1 className="h1">Body</h1>
      </div>
      <Seg value={view} onChange={setView} options={[{ value: 'move', label: 'Movement' }, { value: 'sleep', label: 'Sleep' }]} />
      {view === 'move' ? <MoveView /> : <SleepView />}
    </div>
  );
}

export function MoveView() {
  const { push, settings } = useApp();
  const t = today();
  const ws = weekStart();
  const data = useLiveQuery(async () => ({
    presets: await db.presets.toArray(),
    workouts: await db.workouts.where('date').aboveOrEqual(addDays(t, -120)).toArray(),
  }), [t]);
  if (!data) return null;
  const { presets, workouts } = data;
  const sched = settings.schedule || {};
  const todaySched = sched[dow(t)] || [];
  const todayW = workouts.find((w) => w.date === t);
  const heat = {};
  workouts.forEach((w) => { if (w.completed) heat[w.date] = 1; });
  const weekDays = range(ws, addDays(ws, 6));
  const pname = (id) => presets.find((p) => p.id === id)?.name || 'Deleted preset';
  const doneThisWeek = weekDays.filter((d) => workouts.some((w) => w.date === d && w.completed)).length;
  const plannedThisWeek = weekDays.filter((d) => (sched[dow(d)] || []).length).length;

  return (
    <div>
      <button className="hero card-press" style={{ width: '100%', textAlign: 'left' }} onClick={() => push('Workout', { date: t })}>
        <div className="glow" style={{ background: 'var(--fit)', right: -90, top: -100 }} />
        <div className="eyebrow">Today · {DAYS_SHORT[dow(t)]}</div>
        <div className="h2 mt-8">{todayW?.completed ? 'Session complete ✓' : todaySched.length ? todaySched.map((s) => pname(s.presetId)).join(' + ') : 'Rest day'}</div>
        <div className="small muted mt-4">{todayW?.completed ? todayW.entries.map((e) => `${pname(e.presetId)} · L${e.level}`).join('  ') : todaySched.length ? todaySched.map((s) => `L${s.level}`).join(' · ') : 'Nothing scheduled — tap to do something anyway'}</div>
        {!todayW?.completed && <div className="btn primary mt-16" style={{ background: 'var(--fit)', color: '#000' }}>{todayW ? 'Continue' : 'Start session'}</div>}
      </button>

      <div className="card mt-12">
        <div className="row between mb-12">
          <div className="h3">This week</div>
          <span className="small muted num">{doneThisWeek}/{plannedThisWeek} planned</span>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {weekDays.map((d) => {
            const done = workouts.some((w) => w.date === d && w.completed);
            const planned = (sched[dow(d)] || []).length > 0;
            return (
              <button key={d} className="col" style={{ flex: 1, alignItems: 'center', gap: 6 }} onClick={() => push('Workout', { date: d })}>
                <span className="tiny muted">{DAYS_SHORT[dow(d)][0]}</span>
                <span style={{ width: 34, height: 34, borderRadius: 12, display: 'grid', placeItems: 'center', background: done ? 'var(--fit)' : planned ? 'var(--surface-3)' : 'transparent', border: d === t ? '1.5px solid var(--text-2)' : '1.5px solid transparent', color: done ? '#000' : 'var(--muted)' }}>
                  {done ? <Check size={16} strokeWidth={3} /> : planned ? '•' : ''}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid-3 mt-12">
        {[{ l: 'Schedule', i: CalendarRange, s: 'ScheduleEdit' }, { l: 'Library', i: LibIcon, s: 'Library' }, { l: 'Stats', i: BarChart3, s: 'FitnessStats' }].map((x) => (
          <button key={x.l} className="card card-press col" style={{ alignItems: 'center', gap: 8 }} onClick={() => push(x.s)}>
            <x.i size={20} color="var(--fit)" /><span className="small" style={{ fontWeight: 600 }}>{x.l}</span>
          </button>
        ))}
      </div>

      <div className="card mt-12">
        <div className="h3 mb-12">Consistency</div>
        <Heatmap values={heat} color="var(--fit)" weeks={17} />
      </div>
    </div>
  );
}

/* =========================================================
   WORKOUT SESSION
   ========================================================= */
export function Workout({ date = today() }) {
  const { pop, settings, toast, celebrate } = useApp();
  const data = useLiveQuery(async () => ({
    w: await db.workouts.where('date').equals(date).first(),
    presets: await db.presets.toArray(),
    acts: await db.activities.toArray(),
  }), [date]);
  const [picking, setPicking] = useState(false);
  const [del, setDel] = useState(false);
  if (!data) return <div className="screen no-nav" />;
  const { w, presets, acts } = data;
  const sched = (settings.schedule || {})[dow(date)] || [];
  const aname = (id) => acts.find((a) => a.id === id);
  const preset = (id) => presets.find((p) => p.id === id);

  const itemsFor = (presetId, level) => {
    const p = preset(presetId);
    const lv = p?.levels.find((l) => l.level === level) || p?.levels[0];
    return (lv?.items || []).map((it) => ({ ...it, doneSets: 0, doneReps: it.reps, done: false }));
  };
  const start = async (willing, custom) => {
    const plan = custom || sched;
    const entries = plan.map((s) => {
      const level = willing ? s.level : 0;
      return { presetId: s.presetId, level, target: s.level, items: itemsFor(s.presetId, level) };
    });
    await db.workouts.add({ date, ts: Date.now(), willing, entries, completed: false });
    tap('medium');
  };
  const save = (entries) => db.workouts.update(w.id, { entries });
  const setLevel = (ei, level) => {
    const entries = w.entries.map((e, i) => (i === ei ? { ...e, level, items: itemsFor(e.presetId, level) } : e));
    save(entries);
  };
  const toggleItem = (ei, ii) => {
    const entries = w.entries.map((e, i) => i !== ei ? e : { ...e, items: e.items.map((it, j) => j !== ii ? it : { ...it, done: !it.done, doneSets: !it.done ? it.sets : 0 }) });
    if (!entries[ei].items[ii].done) tap(); else success();
    save(entries);
  };
  const editItem = (ei, ii, patch) => {
    const entries = w.entries.map((e, i) => i !== ei ? e : { ...e, items: e.items.map((it, j) => j !== ii ? it : { ...it, ...patch, done: (patch.doneSets ?? it.doneSets) > 0 }) });
    save(entries);
  };
  const addPreset = async (presetId) => {
    const p = preset(presetId);
    const level = p.levels[p.levels.length - 1]?.level ?? 0;
    const entry = { presetId, level, target: level, items: itemsFor(presetId, level) };
    if (w) await save([...w.entries, entry]);
    else await start(true, [{ presetId, level }]);
    setPicking(false);
  };
  const finish = async () => {
    await db.workouts.update(w.id, { completed: true, finishedAt: Date.now() });
    success(); celebrate(); toast('Session logged');
    pop();
  };

  const allItems = w ? w.entries.flatMap((e) => e.items) : [];
  const doneCount = allItems.filter((i) => i.done).length;

  return (
    <div className="screen no-nav page-enter">
      <TopBar title={fmtDay(date)} right={w && <button className="icon-btn" onClick={() => setDel(true)} aria-label="Discard"><Trash2 size={18} /></button>} />
      {!w && (
        <div className="col gap-14">
          {sched.length ? (
            <>
              <div className="hero">
                <div className="glow" style={{ background: 'var(--fit)', right: -80, top: -90 }} />
                <div className="eyebrow">Planned</div>
                <div className="col gap-6 mt-8">
                  {sched.map((s, i) => <div key={i} className="row between"><span className="h3">{preset(s.presetId)?.name || '—'}</span><span className="badge">Level {s.level}</span></div>)}
                </div>
              </div>
              <h2 className="h1 mt-16" style={{ fontSize: 26 }}>Up for today’s full routine?</h2>
              <button className="btn primary lg block" style={{ background: 'var(--fit)', color: '#000' }} onClick={() => start(true)}>Yes, let’s go</button>
              <button className="btn lg block" onClick={() => start(false)}>Not really — do Level 0</button>
              <div className="small muted center">Level 0 still counts. Showing up is the habit.</div>
            </>
          ) : (
            <Empty icon="🧘" title="Nothing scheduled" sub="Pick a preset to do anyway, or set up your weekly schedule." action={<button className="btn primary sm" onClick={() => setPicking(true)}>Choose a preset</button>} />
          )}
        </div>
      )}

      {w && (
        <>
          <div className="card row gap-14">
            <Ring size={58} stroke={6} value={allItems.length ? doneCount / allItems.length : 0} color="var(--fit)"><span className="small num" style={{ fontWeight: 700 }}>{doneCount}/{allItems.length}</span></Ring>
            <div className="grow">
              <div className="h3">{w.completed ? 'Completed' : 'In progress'}</div>
              <div className="small muted">{w.willing === false ? 'Level 0 day — still counts' : 'Full routine'}</div>
            </div>
          </div>
          {w.entries.map((e, ei) => {
            const p = preset(e.presetId);
            return (
              <div key={ei} className="section" style={{ marginTop: 20 }}>
                <div className="row between mb-8">
                  <div className="h3">{p?.name || 'Deleted preset'}</div>
                  <button className="icon-btn sm ghost" onClick={() => save(w.entries.filter((_, i) => i !== ei))} aria-label="Remove"><X size={16} /></button>
                </div>
                {p && (
                  <div className="chips mb-12">
                    {p.levels.map((l) => (
                      <button key={l.level} className={`chip ${e.level === l.level ? 'on' : ''}`} onClick={() => setLevel(ei, l.level)}>
                        L{l.level}{l.level === e.target ? ' · plan' : ''}
                      </button>
                    ))}
                  </div>
                )}
                <div className="list">
                  {e.items.map((it, ii) => {
                    const a = aname(it.activityId);
                    const unit = a?.unit || (a?.category === 'yoga' ? 'rounds' : 'reps');
                    return (
                      <div key={ii} className="list-item">
                        <button className={`task-check ${it.done ? 'on' : ''}`} style={it.done ? { background: 'var(--fit)', borderColor: 'var(--fit)' } : null} onClick={() => toggleItem(ei, ii)}>
                          {it.done && <Check size={14} strokeWidth={3} color="#000" />}
                        </button>
                        <div className="grow">
                          <div style={{ fontWeight: 560 }} className={it.done ? '' : ''}>{a?.name || 'Deleted activity'}</div>
                          <div className="tiny muted">{(a?.muscles || []).join(' · ')}</div>
                        </div>
                        <SetRepEdit it={it} unit={unit} onChange={(patch) => editItem(ei, ii, patch)} />
                      </div>
                    );
                  })}
                  {!e.items.length && <div className="list-item muted small">No activities in this level</div>}
                </div>
              </div>
            );
          })}
          <button className="btn block mt-16" onClick={() => setPicking(true)}><Plus size={16} /> Add a preset</button>
          {!w.completed ? (
            <button className="btn primary lg block mt-12" style={{ background: 'var(--fit)', color: '#000' }} onClick={finish}>Finish session</button>
          ) : (
            <button className="btn block mt-12" onClick={() => db.workouts.update(w.id, { completed: false })}>Reopen session</button>
          )}
        </>
      )}

      <Sheet open={picking} onClose={() => setPicking(false)} title="Add a preset">
        <div className="list">
          {presets.map((p) => (
            <button key={p.id} className="list-item" onClick={() => addPreset(p.id)}>
              <span className="pill-dot" style={{ background: p.color || 'var(--fit)' }} />
              <span className="grow" style={{ fontWeight: 560 }}>{p.name}</span>
              <span className="tiny muted">{p.levels.length} levels</span>
            </button>
          ))}
          {!presets.length && <div className="list-item muted">Create a preset in the Library first</div>}
        </div>
      </Sheet>
      <Confirm open={del} onClose={() => setDel(false)} title="Discard this session?" confirmLabel="Discard" onConfirm={async () => { await db.workouts.delete(w.id); }} />
    </div>
  );
}

function SetRepEdit({ it, unit, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="badge num" style={{ height: 30, padding: '0 10px', fontSize: 13 }} onClick={() => setOpen(true)}>
        {it.done ? `${it.doneSets}×${it.doneReps}` : `${it.sets}×${it.reps}`} <span className="muted" style={{ fontWeight: 500 }}>{unit}</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="What you actually did">
        <div className="small muted mb-12">Target {it.sets} × {it.reps} {unit}</div>
        <div className="grid-2">
          <Field label="Sets"><Stepper value={it.doneSets || 0} min={0} max={20} onChange={(v) => onChange({ doneSets: v })} /></Field>
          <Field label={unit}><Stepper value={it.doneReps ?? it.reps} min={0} max={999} onChange={(v) => onChange({ doneReps: v })} /></Field>
        </div>
        <Field label="Weight (kg, optional)"><input className="input mt-8" inputMode="decimal" value={it.weight || ''} onChange={(e) => onChange({ weight: e.target.value })} /></Field>
        <button className="btn primary block mt-16" onClick={() => setOpen(false)}>Done</button>
      </Sheet>
    </>
  );
}

/* =========================================================
   LIBRARY: activities + presets
   ========================================================= */
export function Library() {
  const { push } = useApp();
  const [tab, setTab] = useState('presets');
  const acts = useLiveQuery(() => db.activities.toArray(), []) || [];
  const presets = useLiveQuery(() => db.presets.toArray(), []) || [];
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="Library" right={<button className="icon-btn" onClick={() => push(tab === 'presets' ? 'PresetForm' : 'ActivityForm', {})} aria-label="Add"><Plus size={20} /></button>} />
      <div className="tabs-inline">
        <button className={tab === 'presets' ? 'on' : ''} onClick={() => setTab('presets')}>Presets</button>
        <button className={tab === 'acts' ? 'on' : ''} onClick={() => setTab('acts')}>Activities</button>
      </div>
      {tab === 'presets' ? (
        <div className="col gap-6">
          {presets.map((p) => (
            <button key={p.id} className="card card-press row gap-14" style={{ textAlign: 'left' }} onClick={() => push('PresetForm', { id: p.id })}>
              <div className="swatch" style={{ background: `color-mix(in srgb, ${p.color || '#fb923c'} 20%, transparent)`, color: p.color }}>{p.name[0]}</div>
              <div className="grow">
                <div className="h3">{p.name}</div>
                <div className="small muted">{p.levels.map((l) => `L${l.level}: ${l.items.length}`).join(' · ')}</div>
              </div>
              <ChevronRight size={18} className="muted" />
            </button>
          ))}
          {!presets.length && <Empty icon="📋" title="No presets" sub="A preset is a named workout or yoga sequence with levels." />}
        </div>
      ) : (
        <>
          {['exercise', 'yoga'].map((c) => (
            <div key={c} className="mb-16">
              <div className="eyebrow mb-8">{c === 'exercise' ? 'Exercise' : 'Yoga'}</div>
              <div className="list">
                {acts.filter((a) => a.category === c).map((a) => (
                  <button key={a.id} className="list-item" onClick={() => push('ActivityForm', { id: a.id })}>
                    <div className="grow"><div style={{ fontWeight: 560 }}>{a.name}</div><div className="tiny muted">{(a.muscles || []).join(' · ')}{a.equipment && a.equipment !== 'None' ? ` · ${a.equipment}` : ''}</div></div>
                    <ChevronRight size={16} className="muted" />
                  </button>
                ))}
                {!acts.filter((a) => a.category === c).length && <div className="list-item muted small">None yet</div>}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export function ActivityForm({ id }) {
  const { pop, toast } = useApp();
  const [a, setA] = useState(null);
  const [del, setDel] = useState(false);
  useEffect(() => { (async () => setA(id ? await db.activities.get(id) : { category: 'exercise', name: '', muscles: [], equipment: 'None', notes: '', unit: '' }))(); }, [id]);
  if (!a) return <div className="screen no-nav" />;
  const set = (p) => setA((x) => ({ ...x, ...p }));
  const save = async () => {
    if (!a.name.trim()) return toast('Name it first');
    if (id) await db.activities.put(a); else await db.activities.add(a);
    toast('Saved'); pop();
  };
  return (
    <div className="screen no-nav page-enter">
      <TopBar title={id ? 'Edit activity' : 'New activity'} right={<button className="btn sm primary" onClick={save}>Save</button>} />
      <div className="form">
        <Seg value={a.category} onChange={(v) => set({ category: v, muscles: [] })} options={[{ value: 'exercise', label: 'Exercise' }, { value: 'yoga', label: 'Yoga' }]} />
        <input className="input big" placeholder={a.category === 'yoga' ? 'Tadasana' : 'Push-up'} value={a.name} onChange={(e) => set({ name: e.target.value })} autoFocus={!id} />
        <Field label={a.category === 'yoga' ? 'Target areas' : 'Muscle groups'}>
          <Chips wrap multi value={a.muscles} onChange={(v) => set({ muscles: v })} options={a.category === 'yoga' ? AREAS : MUSCLES} />
        </Field>
        <Field label="Counted in" hint="reps, sec, rounds, breaths…"><input className="input" placeholder={a.category === 'yoga' ? 'rounds' : 'reps'} value={a.unit || ''} onChange={(e) => set({ unit: e.target.value })} /></Field>
        <Field label="Equipment"><Chips wrap value={a.equipment} onChange={(v) => set({ equipment: v })} options={['None', 'Mat', 'Dumbbells', 'Band', 'Bar', 'Machine', 'Block']} /></Field>
        <Field label="Form cues / notes"><textarea className="textarea" value={a.notes || ''} onChange={(e) => set({ notes: e.target.value })} /></Field>
        {id && <button className="btn danger" onClick={() => setDel(true)}>Delete activity</button>}
      </div>
      <Confirm open={del} onClose={() => setDel(false)} title="Delete activity?" body="It will disappear from presets too." onConfirm={async () => { await db.activities.delete(id); pop(); }} />
    </div>
  );
}

export function PresetForm({ id }) {
  const { pop, toast } = useApp();
  const acts = useLiveQuery(() => db.activities.toArray(), []) || [];
  const [p, setP] = useState(null);
  const [lvl, setLvl] = useState(0);
  const [adding, setAdding] = useState(false);
  const [del, setDel] = useState(false);
  useEffect(() => { (async () => setP(id ? await db.presets.get(id) : { name: '', color: '#fb923c', levels: [{ level: 0, items: [] }, { level: 1, items: [] }] }))(); }, [id]);
  if (!p) return <div className="screen no-nav" />;
  const cur = p.levels.find((l) => l.level === lvl) || p.levels[0];
  const setLevelItems = (items) => setP({ ...p, levels: p.levels.map((l) => (l.level === cur.level ? { ...l, items } : l)) });
  const save = async () => {
    if (!p.name.trim()) return toast('Name it first');
    if (id) await db.presets.put(p); else await db.presets.add(p);
    toast('Preset saved'); pop();
  };
  const addLevel = () => {
    const n = Math.max(...p.levels.map((l) => l.level)) + 1;
    const prev = p.levels.find((l) => l.level === n - 1);
    setP({ ...p, levels: [...p.levels, { level: n, items: (prev?.items || []).map((i) => ({ ...i, sets: i.sets + 1 })) }] });
    setLvl(n);
  };
  return (
    <div className="screen no-nav page-enter">
      <TopBar title={id ? 'Edit preset' : 'New preset'} right={<button className="btn sm primary" onClick={save}>Save</button>} />
      <div className="form">
        <input className="input big" placeholder="Leg Day" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} autoFocus={!id} />
        <ColorPicker value={p.color} onChange={(v) => setP({ ...p, color: v })} />
        <Field label="Levels" hint="Level 0 is your fallback — the version you can do on any day.">
          <div className="chips wrap">
            {p.levels.map((l) => <button key={l.level} className={`chip ${cur.level === l.level ? 'on' : ''}`} onClick={() => setLvl(l.level)}>Level {l.level}</button>)}
            <button className="chip" style={{ borderStyle: 'dashed', borderColor: 'var(--line-2)' }} onClick={addLevel}><Plus size={14} /> Level</button>
          </div>
        </Field>
        <div className="list">
          {cur.items.map((it, i) => {
            const a = acts.find((x) => x.id === it.activityId);
            return (
              <div key={i} className="list-item" style={{ flexWrap: 'wrap' }}>
                <div className="grow" style={{ fontWeight: 560 }}>{a?.name || '—'}</div>
                <div className="row gap-4">
                  <input className="input" style={{ width: 52, height: 36, textAlign: 'center', padding: 0 }} inputMode="numeric" value={it.sets} onChange={(e) => setLevelItems(cur.items.map((x, j) => (j === i ? { ...x, sets: Number(e.target.value.replace(/\D/g, '')) || 0 } : x)))} />
                  <span className="muted">×</span>
                  <input className="input" style={{ width: 60, height: 36, textAlign: 'center', padding: 0 }} inputMode="numeric" value={it.reps} onChange={(e) => setLevelItems(cur.items.map((x, j) => (j === i ? { ...x, reps: Number(e.target.value.replace(/\D/g, '')) || 0 } : x)))} />
                  <button className="icon-btn sm ghost" onClick={() => setLevelItems(cur.items.filter((_, j) => j !== i))}><X size={16} /></button>
                </div>
              </div>
            );
          })}
          <button className="list-item muted" onClick={() => setAdding(true)}><Plus size={18} /><span className="small" style={{ fontWeight: 550 }}>Add activity to Level {cur.level}</span></button>
        </div>
        <div className="tiny muted">Sets × reps (or count / seconds for yoga & holds).</div>
        {p.levels.length > 1 && cur.level !== 0 && <button className="btn ghost" onClick={() => { setP({ ...p, levels: p.levels.filter((l) => l.level !== cur.level) }); setLvl(0); }}>Remove Level {cur.level}</button>}
        {id && <button className="btn danger" onClick={() => setDel(true)}>Delete preset</button>}
      </div>
      <Sheet open={adding} onClose={() => setAdding(false)} title="Pick an activity">
        <div className="list">
          {acts.map((a) => (
            <button key={a.id} className="list-item" onClick={() => { setLevelItems([...cur.items, { activityId: a.id, sets: a.category === 'yoga' ? 1 : 3, reps: a.category === 'yoga' ? 5 : 10 }]); setAdding(false); }}>
              <span className="grow" style={{ fontWeight: 560 }}>{a.name}</span><span className="tiny muted">{a.category}</span>
            </button>
          ))}
        </div>
      </Sheet>
      <Confirm open={del} onClose={() => setDel(false)} title="Delete preset?" onConfirm={async () => { await db.presets.delete(id); pop(); }} />
    </div>
  );
}

/* =========================================================
   WEEKLY SCHEDULE
   ========================================================= */
export function ScheduleEdit() {
  const { settings, toast } = useApp();
  const presets = useLiveQuery(() => db.presets.toArray(), []) || [];
  const [adding, setAdding] = useState(null);
  const sched = settings.schedule || {};
  const update = (d, list) => setKV('schedule', { ...sched, [d]: list });
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="Weekly schedule" />
      <p className="small muted" style={{ marginTop: -4 }}>Assign presets to days with a default level. This is what “today’s session” loads.</p>
      <div className="col gap-6 mt-12">
        {WEEK.map((d) => (
          <div key={d} className="card tight">
            <div className="row between">
              <div className="h3" style={{ width: 44 }}>{DAYS_SHORT[d]}</div>
              <div className="grow col gap-6">
                {(sched[d] || []).map((s, i) => {
                  const p = presets.find((x) => x.id === s.presetId);
                  return (
                    <div key={i} className="row gap-6">
                      <span className="grow small ellipsis" style={{ fontWeight: 560 }}>{p?.name || '—'}</span>
                      <select className="select" style={{ height: 32, width: 76, fontSize: 13, padding: '0 26px 0 10px', backgroundPosition: 'calc(100% - 14px) 14px, calc(100% - 9px) 14px' }} value={s.level} onChange={(e) => update(d, sched[d].map((x, j) => (j === i ? { ...x, level: Number(e.target.value) } : x)))}>
                        {(p?.levels || []).map((l) => <option key={l.level} value={l.level}>L{l.level}</option>)}
                      </select>
                      <button className="icon-btn sm ghost" onClick={() => update(d, sched[d].filter((_, j) => j !== i))}><X size={14} /></button>
                    </div>
                  );
                })}
                {!(sched[d] || []).length && <span className="small muted">Rest</span>}
              </div>
              <button className="icon-btn sm" onClick={() => setAdding(d)} aria-label="Add"><Plus size={16} /></button>
            </div>
          </div>
        ))}
      </div>
      <Sheet open={adding != null} onClose={() => setAdding(null)} title={adding != null ? `Add to ${DAYS_SHORT[adding]}` : ''}>
        <div className="list">
          {presets.map((p) => (
            <button key={p.id} className="list-item" onClick={() => { const top = p.levels[p.levels.length - 1]?.level ?? 0; update(adding, [...(sched[adding] || []), { presetId: p.id, level: top }]); setAdding(null); toast('Added'); }}>
              <span className="pill-dot" style={{ background: p.color }} /><span className="grow" style={{ fontWeight: 560 }}>{p.name}</span>
            </button>
          ))}
          {!presets.length && <div className="list-item muted">No presets yet</div>}
        </div>
      </Sheet>
    </div>
  );
}

/* =========================================================
   FITNESS STATS
   ========================================================= */
export function FitnessStats() {
  const { settings } = useApp();
  const [period, setPeriod] = useState('month');
  const [actSel, setActSel] = useState(null);
  const data = useLiveQuery(async () => ({ workouts: await db.workouts.toArray(), presets: await db.presets.toArray(), acts: await db.activities.toArray() }), []);
  if (!data) return <div className="screen no-nav" />;
  const { workouts, presets, acts } = data;
  const [from, to0] = periodRange(period);
  const t = today();
  const to = to0 > t ? t : to0;
  const ws = workouts.filter((w) => w.completed && w.date >= from && w.date <= to);
  const sched = settings.schedule || {};
  // level adherence
  let full = 0, down = 0, skip = 0;
  const firstDay = workouts.length ? workouts.map((w) => w.date).sort()[0] : t;
  for (const d of range(from < firstDay ? firstDay : from, to)) {
    const plan = sched[dow(d)] || [];
    if (!plan.length) continue;
    const w = workouts.find((x) => x.date === d && x.completed);
    if (!w) { if (d !== t) skip++; continue; }
    const downgraded = w.entries.some((e) => e.level < (e.target ?? e.level));
    downgraded ? down++ : full++;
  }
  const totalSched = full + down + skip;
  const trend = buckets(period).map((b) => ({ label: b.label, value: b.from > t ? null : workouts.filter((w) => w.completed && w.date >= b.from && w.date <= b.to).length }));
  const volume = buckets(period).map((b) => ({ label: b.label, value: b.from > t ? null : workouts.filter((w) => w.completed && w.date >= b.from && w.date <= b.to).flatMap((w) => w.entries.flatMap((e) => e.items)).reduce((a, i) => a + (i.done ? (i.doneSets || 0) * (i.doneReps || 0) : 0), 0) }));
  const muscle = {};
  ws.forEach((w) => w.entries.forEach((e) => e.items.forEach((i) => { if (!i.done) return; const a = acts.find((x) => x.id === i.activityId); (a?.muscles || []).forEach((m) => (muscle[m] = (muscle[m] || 0) + (i.doneSets || 1))); })));
  const presetUse = {};
  ws.forEach((w) => w.entries.forEach((e) => (presetUse[e.presetId] = (presetUse[e.presetId] || 0) + 1)));
  const heat = {};
  workouts.forEach((w) => { if (w.completed) heat[w.date] = 1; });
  const act = actSel ?? acts[0]?.id;
  const prog = workouts.filter((w) => w.completed).sort((a, b) => a.date.localeCompare(b.date)).map((w) => {
    const its = w.entries.flatMap((e) => e.items).filter((i) => i.activityId === act && i.done);
    return its.length ? { label: '', value: Math.max(...its.map((i) => (i.doneReps || 0) * (i.doneSets || 1))) } : null;
  }).filter(Boolean).slice(-14);

  return (
    <div className="screen no-nav page-enter">
      <TopBar title="Movement stats" />
      <PeriodToggle value={period} onChange={setPeriod} />
      <div className="grid-3 mt-12">
        <Stat v={ws.length} k="Sessions" color="var(--fit)" />
        <Stat v={totalSched ? `${Math.round((full / totalSched) * 100)}%` : '—'} k="Full level" />
        <Stat v={totalSched ? `${Math.round((skip / totalSched) * 100)}%` : '—'} k="Skipped" />
      </div>
      <div className="card mt-12">
        <div className="h3 mb-12">Level adherence</div>
        <div className="row" style={{ height: 12, borderRadius: 6, overflow: 'hidden', gap: 2 }}>
          {totalSched ? <>
            <div style={{ flex: full, background: 'var(--fit)' }} />
            <div style={{ flex: down, background: 'var(--goal)' }} />
            <div style={{ flex: skip, background: 'var(--surface-3)' }} />
          </> : <div style={{ flex: 1, background: 'var(--surface-3)' }} />}
        </div>
        <div className="row gap-14 mt-8 tiny muted">
          <span className="row gap-4"><i className="pill-dot" style={{ background: 'var(--fit)' }} />Full {full}</span>
          <span className="row gap-4"><i className="pill-dot" style={{ background: 'var(--goal)' }} />Downgraded {down}</span>
          <span className="row gap-4"><i className="pill-dot" style={{ background: 'var(--surface-3)' }} />Skipped {skip}</span>
        </div>
      </div>
      <div className="card mt-12"><div className="h3 mb-12">Sessions</div><Bars data={trend} color="var(--fit)" showValues /></div>
      <div className="card mt-12"><div className="h3 mb-12">Volume (sets × reps)</div><Bars data={volume} color="var(--fit)" /></div>
      <div className="card mt-12"><div className="h3 mb-12">Consistency</div><Heatmap values={heat} color="var(--fit)" /></div>
      <div className="card mt-12"><div className="h3 mb-12">Muscle / area balance</div><HBars items={Object.entries(muscle).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, value: v, color: 'var(--fit)' }))} format={(v) => `${v} sets`} /></div>
      <div className="card mt-12">
        <div className="h3 mb-8">Progression</div>
        <select className="select mb-12" value={act || ''} onChange={(e) => setActSel(Number(e.target.value))}>
          {acts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <Line data={prog} color="var(--fit)" />
      </div>
      <div className="card mt-12"><div className="h3 mb-12">Most used presets</div><HBars items={Object.entries(presetUse).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: presets.find((p) => p.id === Number(k))?.name || '—', value: v, color: 'var(--fit)' }))} format={(v) => `${v}×`} /></div>
    </div>
  );
}

/* =========================================================
   SLEEP
   ========================================================= */
export function SleepView() {
  const { push, settings } = useApp();
  const rows = useLiveQuery(() => db.sleep.where('date').aboveOrEqual(addDays(today(), -30)).toArray(), []) || [];
  const last = [...rows].sort((a, b) => b.date.localeCompare(a.date))[0];
  const week = rows.filter((r) => r.date >= addDays(today(), -6));
  const cons = sleepConsistency(week);
  const avgDur = avg(week.map(sleepMinutes).filter((x) => x != null));
  const bars = lastNDays(7).map((d) => { const r = rows.find((x) => x.date === d); return { label: DAYS_SHORT[dow(d)][0], value: r ? Math.round((sleepMinutes(r) || 0) / 6) / 10 : 0 }; });
  return (
    <div>
      <div className="hero">
        <div className="glow" style={{ background: 'var(--sleep)', right: -80, top: -90 }} />
        <div className="eyebrow">Last night</div>
        {last ? (
          <>
            <div className="big-num mt-8 num">{last.bedTs && last.wakeTs ? fmtDur(sleepMinutes(last)) : '—'}</div>
            <div className="small muted mt-4">{last.bedTs ? fmtTime(last.bedTs) : '?'} → {last.wakeTs ? fmtTime(last.wakeTs) : '?'} · quality {last.quality || '—'}/5 · {fmtDay(last.date)}</div>
          </>
        ) : <div className="h3 mt-8 muted">No sleep logged yet</div>}
        <div className="row mt-16">
          <button className="btn grow" style={{ background: 'var(--sleep)', color: '#000' }} onClick={() => push('SleepLog', {})}>Log sleep</button>
          <button className="btn grow" onClick={() => push('SleepStats')}>Stats</button>
        </div>
      </div>
      <div className="grid-2 mt-12">
        <Stat v={cons.score == null ? '—' : cons.score} k="Consistency score (7d)" color="var(--sleep)" />
        <Stat v={avgDur ? fmtDur(avgDur) : '—'} k="Avg duration (7d)" />
      </div>
      <div className="card mt-12">
        <div className="row between mb-12"><div className="h3">Last 7 nights</div><span className="tiny muted">hours</span></div>
        <Bars data={bars} color="var(--sleep)" showValues />
      </div>
      <div className="card mt-12 row gap-14">
        <Moon size={18} color="var(--sleep)" />
        <div className="grow small"><b>Targets</b> · bed {fmtHM(settings.bedtimeTarget)} · wake {fmtHM(settings.wakeTarget)}</div>
        <button className="btn sm" onClick={() => push('Settings')}>Edit</button>
      </div>
      <div className="small muted mt-12 center">Tip: the night review’s “Going to sleep” button and the morning check-in log this for you.</div>
    </div>
  );
}

const toLocalInput = (ts) => { const d = new Date(ts); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
export function SleepLog({ date }) {
  const { pop, toast, settings } = useApp();
  const [row, setRow] = useState(null);
  useEffect(() => {
    (async () => {
      const d = date || today();
      const ex = await db.sleep.where('date').equals(d).first();
      if (ex) return setRow({ ...ex, bed: ex.bedTs ? toLocalInput(ex.bedTs) : '', wake: ex.wakeTs ? toLocalInput(ex.wakeTs) : '' });
      const [bh, bm] = settings.bedtimeTarget.split(':').map(Number);
      const [wh, wm] = settings.wakeTarget.split(':').map(Number);
      const wake = new Date(d + 'T00:00'); wake.setHours(wh, wm);
      const bed = new Date(d + 'T00:00'); bed.setHours(bh, bm); if (bh >= 12) bed.setDate(bed.getDate() - 1);
      setRow({ date: d, bed: toLocalInput(bed.getTime()), wake: toLocalInput(wake.getTime()), quality: 3 });
    })();
  }, [date]);
  if (!row) return <div className="screen no-nav" />;
  const bedTs = row.bed ? new Date(row.bed).getTime() : null;
  const wakeTs = row.wake ? new Date(row.wake).getTime() : null;
  const dur = bedTs && wakeTs ? (wakeTs - bedTs) / 60000 : null;
  const save = async () => {
    if (dur != null && (dur <= 0 || dur > 20 * 60)) return toast('Check the times');
    const wakeDate = wakeTs ? ymd(new Date(wakeTs)) : row.date;
    const rec = { date: wakeDate, bedTs, wakeTs, quality: row.quality };
    const ex = await db.sleep.where('date').equals(wakeDate).first();
    if (row.id && row.date !== wakeDate) await db.sleep.delete(row.id);
    if (ex) await db.sleep.update(ex.id, rec); else await db.sleep.add(rec);
    success(); toast('Sleep logged'); pop();
  };
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="Log sleep" right={row.id && <button className="icon-btn" onClick={async () => { await db.sleep.delete(row.id); pop(); }}><Trash2 size={18} /></button>} />
      <div className="card center">
        <div className="eyebrow">Duration</div>
        <div className="big-num mt-8 num" style={{ color: 'var(--sleep)' }}>{dur != null && dur > 0 ? fmtDur(dur) : '—'}</div>
      </div>
      <div className="form mt-16">
        <Field label="Went to bed"><input type="datetime-local" className="input" value={row.bed} onChange={(e) => setRow({ ...row, bed: e.target.value })} /></Field>
        <Field label="Woke up"><input type="datetime-local" className="input" value={row.wake} onChange={(e) => setRow({ ...row, wake: e.target.value })} /></Field>
        <Field label="Sleep quality"><Scale5 value={row.quality} onChange={(v) => setRow({ ...row, quality: v })} color="var(--sleep)" labels={['Terrible', 'Great']} /></Field>
        <button className="btn primary lg block" onClick={save}>Save</button>
      </div>
    </div>
  );
}

export function SleepStats() {
  const { settings } = useApp();
  const [period, setPeriod] = useState('month');
  const rows = useLiveQuery(() => db.sleep.toArray(), []);
  if (!rows) return <div className="screen no-nav" />;
  const [from, to] = periodRange(period);
  const inR = rows.filter((r) => r.date >= from && r.date <= to);
  const cons = sleepConsistency(inR);
  const durs = inR.map(sleepMinutes).filter((x) => x != null);
  const bk = buckets(period);
  const t = today();
  const durTrend = bk.map((b) => { const r = rows.filter((x) => x.date >= b.from && x.date <= b.to).map(sleepMinutes).filter((x) => x != null); return { label: b.label, value: b.from > t || !r.length ? null : +(avg(r) / 60).toFixed(1) }; });
  const qTrend = bk.map((b) => { const r = rows.filter((x) => x.date >= b.from && x.date <= b.to && x.quality).map((x) => x.quality); return { label: b.label, value: b.from > t || !r.length ? null : +avg(r).toFixed(1) }; });
  const consTrend = bk.map((b) => { const r = rows.filter((x) => x.date >= b.from && x.date <= b.to); const c = sleepConsistency(r); return { label: b.label, value: b.from > t ? null : c.score }; });
  const recent = [...rows].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14).reverse();
  const bedLine = recent.map((r) => ({ label: '', value: r.bedTs ? clockMinFromNoon(r.bedTs) / 60 + 12 : null }));
  const fmtClockH = (h) => { const m = Math.round((h % 24) * 60); return fmtHM(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`); };
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="Sleep stats" />
      <PeriodToggle value={period} onChange={setPeriod} />
      <div className="hero mt-12 row gap-18">
        <Ring size={96} stroke={9} value={(cons.score || 0) / 100} color="var(--sleep)"><span className="h2 num">{cons.score ?? '—'}</span></Ring>
        <div className="grow">
          <div className="h3">Consistency score</div>
          <div className="small muted mt-4">How tightly your bed & wake times cluster. 100 = same time every day.</div>
        </div>
      </div>
      <div className="grid-3 mt-12">
        <Stat v={durs.length ? fmtDur(avg(durs)) : '—'} k="Avg sleep" color="var(--sleep)" />
        <Stat v={cons.sb != null ? `±${Math.round(cons.sb)}m` : '—'} k="Bedtime spread" />
        <Stat v={cons.sw != null ? `±${Math.round(cons.sw)}m` : '—'} k="Wake spread" />
      </div>
      <div className="card mt-12"><div className="h3 mb-12">Duration (hours)</div><Line data={durTrend} color="var(--sleep)" format={(v) => v + 'h'} /></div>
      <div className="card mt-12"><div className="h3 mb-12">Consistency trend</div><Bars data={consTrend} color="var(--sleep)" max={100} showValues /></div>
      <div className="card mt-12"><div className="h3 mb-12">Sleep quality</div><Line data={qTrend} color="var(--goal)" min={1} max={5} /></div>
      <div className="card mt-12">
        <div className="h3">Bedtimes · last 14 nights</div>
        <div className="small muted mb-12">Target {fmtHM(settings.bedtimeTarget)} — flatter is better</div>
        <Line data={bedLine} color="var(--sleep)" format={fmtClockH} />
      </div>
    </div>
  );
}
