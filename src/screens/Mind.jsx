import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { X, ChevronRight, Plus, Wind, Brain, Smile, BookOpen, Radar, BarChart3, Sparkles, ChevronLeft, Trash2 } from 'lucide-react';
import { db } from '../db';
import { useApp } from '../ctx';
import { today, fmtDay, fmtTime, monthStart, addMonths, MONTHS, parse, fmtClock } from '../lib/date';
import { TopBar, Field, Empty, Chips, Stat, Sheet } from '../ui/kit';
import { Face } from '../ui/faces';
import { SectionHead } from '../ui/rows';
import { success, tap } from '../lib/native';

/* =========================================================
   MIND VIEW (inside Health tab)
   ========================================================= */
export function MindView() {
  const { push } = useApp();
  const t = today();
  const data = useLiveQuery(async () => ({
    moods: await db.moods.where('date').equals(t).toArray(),
    breaths: await db.breaths.where('date').equals(t).count(),
    wheel: await db.wheels.where('month').equals(t.slice(0, 7)).first(),
    reframes: await db.reframes.reverse().limit(3).toArray(),
  }), [t]);
  if (!data) return null;
  const last = [...data.moods].sort((a, b) => b.ts - a.ts)[0];
  const tools = [
    { t: 'Check in', s: last ? `Last: ${last.feeling || 'mood'} · ${fmtTime(last.ts)}` : 'Name what you feel', icon: Smile, c: 'var(--mood)', go: () => push('MoodCheckin') },
    { t: 'Breathe', s: data.breaths ? `${data.breaths} session${data.breaths > 1 ? 's' : ''} today` : 'Calm down in 1 minute', icon: Wind, c: 'var(--bored)', go: () => push('Breathe') },
    { t: 'Reframe', s: 'Untangle a heavy thought', icon: Brain, c: 'var(--task)', go: () => push('ReframeList') },
    { t: 'Journal', s: 'Entries & night reviews', icon: BookOpen, c: 'var(--goal)', go: () => push('JournalHistory') },
    { t: 'Life wheel', s: data.wheel ? 'Rated this month ✓' : 'Monthly balance check', icon: Radar, c: 'var(--money)', go: () => push('Wheel') },
    { t: 'Mood stats', s: 'Trends & feelings', icon: BarChart3, c: 'var(--fit)', go: () => push('MoodStats') },
  ];
  return (
    <div>
      <button className="hero card-press row gap-14" style={{ width: '100%', textAlign: 'left' }} onClick={() => push('MoodCheckin')}>
        <div className="glow" style={{ background: 'var(--mood)', right: -90, top: -110 }} />
        <Face v={last?.mood || 3} size={54} mono={!last} />
        <div className="grow">
          <div className="eyebrow">Right now</div>
          <div className="h3 mt-4">{last ? `You felt ${last.feeling || ['awful', 'low', 'okay', 'good', 'great'][last.mood - 1]}` : 'How are you, really?'}</div>
          <div className="small muted">{last ? 'Tap to check in again' : 'A 10-second check-in helps you notice patterns'}</div>
        </div>
        <ChevronRight size={18} className="muted" />
      </button>
      <div className="tools mt-12">
        {tools.map((x) => (
          <button key={x.t} className="tool card-press" onClick={x.go}>
            <div className="tile" style={{ background: `color-mix(in srgb, ${x.c} 16%, transparent)` }}><x.icon size={20} color={x.c} /></div>
            <div><div className="t">{x.t}</div><div className="s">{x.s}</div></div>
          </button>
        ))}
      </div>
      {!data.wheel && new Date().getDate() <= 7 && (
        <button className="banner mt-12" style={{ width: '100%', textAlign: 'left' }} onClick={() => push('Wheel')}>
          <Radar size={20} color="var(--accent)" />
          <div className="grow"><div style={{ fontWeight: 650 }}>New month, quick balance check</div><div className="small muted">Rate 8 areas of life — takes 30 seconds</div></div>
        </button>
      )}
    </div>
  );
}

/* =========================================================
   MOOD CHECK-IN — energy × pleasantness grid (How We Feel style)
   ========================================================= */
export const QUADS = {
  red: { label: 'High energy', sub: 'Unpleasant', color: '#ff6b6b', energy: 5, words: [['Stressed', 2], ['Anxious', 2], ['Angry', 1], ['Frustrated', 2], ['Overwhelmed', 1], ['Nervous', 2], ['Irritated', 2], ['Restless', 2], ['Panicked', 1]] },
  yellow: { label: 'High energy', sub: 'Pleasant', color: '#ffd43b', energy: 5, words: [['Excited', 5], ['Happy', 5], ['Motivated', 5], ['Proud', 5], ['Energized', 5], ['Hopeful', 4], ['Focused', 4], ['Playful', 5], ['Inspired', 5]] },
  blue: { label: 'Low energy', sub: 'Unpleasant', color: '#74a7ff', energy: 2, words: [['Sad', 1], ['Tired', 2], ['Lonely', 1], ['Bored', 2], ['Down', 1], ['Drained', 2], ['Disappointed', 2], ['Numb', 2], ['Hopeless', 1]] },
  green: { label: 'Low energy', sub: 'Pleasant', color: '#63e6be', energy: 2, words: [['Calm', 4], ['Relaxed', 4], ['Content', 4], ['Grateful', 5], ['Peaceful', 5], ['Safe', 4], ['Rested', 4], ['Chill', 4], ['Thoughtful', 4]] },
};
const INFLUENCES = ['Work', 'Study', 'Family', 'Friends', 'Partner', 'Health', 'Sleep', 'Exercise', 'Food', 'Money', 'Weather', 'Social media', 'Myself'];

export function MoodCheckin() {
  const { pop, toast } = useApp();
  const [q, setQ] = useState(null);
  const [word, setWord] = useState(null);
  const [inf, setInf] = useState([]);
  const [note, setNote] = useState('');
  const step = !q ? 0 : !word ? 1 : 2;
  const save = async () => {
    const [w, v] = QUADS[q].words.find((x) => x[0] === word);
    await db.moods.add({ date: today(), ts: Date.now(), mood: v, energy: QUADS[q].energy, feeling: w.toLowerCase(), quadrant: q, tags: [w.toLowerCase()], influences: inf, note, kind: 'grid' });
    success(); toast('Checked in'); pop();
  };
  return (
    <div className="timer-screen" style={{ overflowY: 'auto' }}>
      <div className="row between">
        {step > 0 ? <button className="icon-btn" onClick={() => (step === 2 ? setWord(null) : setQ(null))}><ChevronLeft size={20} /></button> : <span />}
        <div className="step-dots" style={{ width: 90 }}>{[0, 1, 2].map((i) => <i key={i} className={i <= step ? 'on' : ''} />)}</div>
        <button className="icon-btn" onClick={pop}><X size={20} /></button>
      </div>
      {step === 0 && (
        <div className="col grow fade-in" style={{ justifyContent: 'center', gap: 18 }}>
          <h1 className="h1">How are you feeling?</h1>
          <p className="dim" style={{ margin: 0 }}>Pick the zone that fits. Energy up or down, pleasant or not.</p>
          <div className="mgrid">
            {['red', 'yellow', 'blue', 'green'].map((k) => (
              <button key={k} className="mquad" style={{ background: QUADS[k].color, color: '#111' }} onClick={() => { tap('medium'); setQ(k); }}>
                <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '.06em' }}>{QUADS[k].label}</span>
                <span style={{ fontSize: 20, fontWeight: 750 }}>{QUADS[k].sub}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {step === 1 && (
        <div className="col grow fade-in" style={{ justifyContent: 'center', gap: 22 }}>
          <div>
            <div className="eyebrow" style={{ color: QUADS[q].color }}>{QUADS[q].label} · {QUADS[q].sub}</div>
            <h1 className="h1 mt-8">Which word fits best?</h1>
          </div>
          <div className="mwords">
            {QUADS[q].words.map(([w]) => (
              <button key={w} style={{ background: QUADS[q].color }} onClick={() => { tap(); setWord(w); }}>{w}</button>
            ))}
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="col grow fade-in" style={{ gap: 18, paddingTop: 24 }}>
          <div className="row gap-14">
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: QUADS[q].color, display: 'grid', placeItems: 'center', color: '#111', fontWeight: 750, fontSize: 12.5 }}>{word}</div>
            <div><div className="eyebrow">You’re feeling</div><h1 className="h2 mt-4">{word}</h1></div>
          </div>
          <Field label="What’s it about?">
            <Chips wrap multi value={inf} onChange={setInf} options={INFLUENCES} />
          </Field>
          <Field label="Anything to add?">
            <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" />
          </Field>
          <div className="grow" />
          <button className="btn primary lg block" onClick={save}>Save check-in</button>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   BREATHE
   ========================================================= */
export const PATTERNS = [
  { key: 'box', name: 'Box breathing', sub: 'Focus & calm · 4-4-4-4', phases: [['Breathe in', 4, 1], ['Hold', 4, 1], ['Breathe out', 4, 0], ['Hold', 4, 0]] },
  { key: '478', name: '4-7-8', sub: 'Fall asleep, ease anxiety', phases: [['Breathe in', 4, 1], ['Hold', 7, 1], ['Breathe out', 8, 0]] },
  { key: 'coherent', name: 'Coherent', sub: 'Balance · 5.5 breaths/min', phases: [['Breathe in', 5.5, 1], ['Breathe out', 5.5, 0]] },
  { key: 'sigh', name: 'Physiological sigh', sub: 'Fastest stress relief', phases: [['Inhale', 2, 0.8], ['Top up', 1, 1], ['Long exhale', 6, 0]] },
];
export function Breathe({ pattern: initial, minutes: initMin, onDone }) {
  const { pop, toast } = useApp();
  const [pat, setPat] = useState(initial || null);
  const [mins, setMins] = useState(initMin || 1);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);
  const p = PATTERNS.find((x) => x.key === pat);
  useEffect(() => { if (initial) { startRef.current = Date.now(); setRunning(true); } }, []);
  useEffect(() => {
    if (!running || !p) return;
    let i = 0;
    let timer;
    const run = () => {
      setPhase(i);
      tap();
      timer = setTimeout(() => { i = (i + 1) % p.phases.length; run(); }, p.phases[i][1] * 1000);
    };
    run();
    const tick = setInterval(() => setElapsed((Date.now() - startRef.current) / 1000), 250);
    return () => { clearTimeout(timer); clearInterval(tick); };
  }, [running, pat]);
  useEffect(() => {
    if (running && elapsed >= mins * 60) finish(true);
  }, [elapsed]);
  const finish = async (full) => {
    setRunning(false);
    if (elapsed > 20) {
      await db.breaths.add({ date: today(), ts: Date.now(), pattern: pat, seconds: Math.round(elapsed) });
      success();
      toast(full ? 'Nice. Notice how you feel.' : 'Logged');
    }
    if (onDone) onDone(); else pop();
  };
  if (!p || !running) {
    return (
      <div className="timer-screen" style={{ overflowY: 'auto' }}>
        <div className="row between"><span className="eyebrow">Breathe</span><button className="icon-btn" onClick={onDone || pop}><X size={20} /></button></div>
        <h1 className="h1 mt-16">Slow down your breath,<br />slow down your mind.</h1>
        <div className="list mt-24">
          {PATTERNS.map((x) => (
            <button key={x.key} className="list-item" onClick={() => setPat(x.key)}>
              <div className="tile sm" style={{ background: pat === x.key ? 'var(--bored)' : 'var(--surface-2)' }}><Wind size={16} color={pat === x.key ? '#000' : 'var(--text-2)'} /></div>
              <div className="grow"><div style={{ fontWeight: 600 }}>{x.name}</div><div className="tiny muted">{x.sub}</div></div>
              {pat === x.key && <span className="pill-dot" style={{ background: 'var(--bored)' }} />}
            </button>
          ))}
        </div>
        <div className="label mt-24 mb-8">Duration</div>
        <Chips value={mins} onChange={setMins} options={[{ value: 1, label: '1 min' }, { value: 3, label: '3 min' }, { value: 5, label: '5 min' }, { value: 10, label: '10 min' }]} />
        <div className="grow" />
        <button className="btn lg block mt-24" style={{ background: 'var(--bored)', color: '#000' }} disabled={!pat} onClick={() => { startRef.current = Date.now(); setElapsed(0); setRunning(true); }}>Begin</button>
      </div>
    );
  }
  const [label, secs, scale] = p.phases[phase];
  return (
    <div className="timer-screen">
      <div className="row between"><span className="eyebrow">{p.name}</span><button className="icon-btn" onClick={() => finish(false)}><X size={20} /></button></div>
      <div className="col grow" style={{ justifyContent: 'center', alignItems: 'center', gap: 36 }}>
        <div className="breathe-orb">
          <div className="ring" />
          <div className="core" style={{ '--dur': `${secs}s`, transform: `scale(${0.45 + scale * 0.55})` }} />
          <div style={{ position: 'relative', fontSize: 22, fontWeight: 650, color: '#fff', textShadow: '0 1px 12px rgba(0,0,0,.35)' }}>{label}</div>
        </div>
        <div className="muted num">{fmtClock(Math.max(0, mins * 60 - elapsed))}</div>
      </div>
      <button className="btn lg block" onClick={() => finish(false)}>End</button>
    </div>
  );
}

/* =========================================================
   REFRAME (CBT-style thought record)
   ========================================================= */
const TRAPS = [
  ['All-or-nothing', 'Seeing things as total success or total failure.'],
  ['Catastrophizing', 'Expecting the worst possible outcome.'],
  ['Mind reading', 'Assuming you know what others think.'],
  ['Fortune telling', 'Predicting the future as if it’s certain.'],
  ['Overgeneralizing', '“Always”, “never”, “everyone”.'],
  ['Should statements', 'Rigid rules about how things must be.'],
  ['Labeling', '“I’m an idiot” instead of “I made a mistake”.'],
  ['Discounting positives', 'Good things “don’t count”.'],
  ['Emotional reasoning', '“I feel it, so it must be true.”'],
  ['Personalizing', 'Blaming yourself for things outside your control.'],
];
export function ReframeList() {
  const { push } = useApp();
  const list = useLiveQuery(() => db.reframes.reverse().toArray(), []) || [];
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="Reframe" right={<button className="icon-btn" onClick={() => push('Reframe', {})}><Plus size={20} /></button>} />
      <div className="card">
        <div className="h3">Thoughts aren’t facts</div>
        <p className="small muted" style={{ marginBottom: 0 }}>Write down what your mind is saying, spot the thinking trap, and find a kinder, more balanced version. It takes about 2 minutes.</p>
        <button className="btn primary block mt-16" onClick={() => push('Reframe', {})}>Reframe a thought</button>
      </div>
      {list.length > 0 && (
        <div className="section">
          <SectionHead title="Past reframes" />
          <div className="list">
            {list.map((r) => (
              <button key={r.id} className="list-item" onClick={() => push('Reframe', { id: r.id })}>
                <div className="grow">
                  <div className="ellipsis" style={{ fontWeight: 560 }}>{r.balanced || r.thought}</div>
                  <div className="tiny muted">{fmtDay(r.date)} · {r.before}% → {r.after ?? '—'}%</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
export function Reframe({ id, thought: initThought }) {
  const { pop, toast } = useApp();
  const [r, setR] = useState(null);
  const [step, setStep] = useState(0);
  useEffect(() => { (async () => setR(id ? await db.reframes.get(id) : { thought: initThought || '', emotion: '', before: 70, traps: [], evidenceFor: '', evidenceAgainst: '', balanced: '', after: 40 }))(); }, [id]);
  if (!r) return <div className="timer-screen" />;
  const set = (p) => setR((x) => ({ ...x, ...p }));
  const steps = ['thought', 'traps', 'evidence', 'balanced'];
  const save = async () => {
    const row = { ...r, date: r.date || today(), ts: r.ts || Date.now() };
    if (id) await db.reframes.put(row); else await db.reframes.add(row);
    success(); toast(r.after < r.before ? `Down ${r.before - r.after}% — that’s real progress` : 'Saved'); pop();
  };
  const cur = steps[step];
  return (
    <div className="timer-screen" style={{ overflowY: 'auto' }}>
      <div className="row gap-10">
        <div className="step-dots grow">{steps.map((s, i) => <i key={s} className={i <= step ? 'on' : ''} />)}</div>
        {id && <button className="icon-btn" onClick={async () => { await db.reframes.delete(id); pop(); }}><Trash2 size={18} /></button>}
        <button className="icon-btn" onClick={pop}><X size={20} /></button>
      </div>
      <div className="col grow" style={{ gap: 16, paddingTop: 24 }}>
        {cur === 'thought' && (
          <>
            <h1 className="h1">What’s the thought?</h1>
            <textarea className="textarea" style={{ minHeight: 110 }} autoFocus placeholder="e.g. I’m going to fail this exam and everyone will think I’m useless." value={r.thought} onChange={(e) => set({ thought: e.target.value })} />
            <Field label="What does it make you feel?"><input className="input" placeholder="anxious, ashamed…" value={r.emotion} onChange={(e) => set({ emotion: e.target.value })} /></Field>
            <Field label={`How strong? ${r.before}%`}><input type="range" min={0} max={100} step={5} value={r.before} onChange={(e) => set({ before: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--task)' }} /></Field>
          </>
        )}
        {cur === 'traps' && (
          <>
            <h1 className="h1">Spot the thinking traps</h1>
            <p className="dim" style={{ margin: 0 }}>Pick any that fit. There’s no wrong answer.</p>
            <div className="list">
              {TRAPS.map(([n, d]) => {
                const on = r.traps.includes(n);
                return (
                  <button key={n} className="list-item" onClick={() => { tap(); set({ traps: on ? r.traps.filter((x) => x !== n) : [...r.traps, n] }); }}>
                    <div className={`task-check ${on ? 'on' : ''}`}>{on && '✓'}</div>
                    <div className="grow"><div style={{ fontWeight: 600 }}>{n}</div><div className="tiny muted">{d}</div></div>
                  </button>
                );
              })}
            </div>
          </>
        )}
        {cur === 'evidence' && (
          <>
            <h1 className="h1">Look at the evidence</h1>
            <Field label="What supports the thought?"><textarea className="textarea" value={r.evidenceFor} onChange={(e) => set({ evidenceFor: e.target.value })} /></Field>
            <Field label="What doesn’t fit it?"><textarea className="textarea" value={r.evidenceAgainst} onChange={(e) => set({ evidenceAgainst: e.target.value })} placeholder="Times it wasn’t true, what a friend would say…" /></Field>
          </>
        )}
        {cur === 'balanced' && (
          <>
            <h1 className="h1">A more balanced thought</h1>
            <div className="card flat small dim" style={{ fontStyle: 'italic' }}>“{r.thought}”</div>
            <textarea className="textarea" style={{ minHeight: 110 }} autoFocus placeholder="e.g. I’m worried about the exam, but I’ve prepared and one result doesn’t define me." value={r.balanced} onChange={(e) => set({ balanced: e.target.value })} />
            <Field label={`How strong is the feeling now? ${r.after}%`}><input type="range" min={0} max={100} step={5} value={r.after} onChange={(e) => set({ after: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--task)' }} /></Field>
          </>
        )}
      </div>
      <div className="row mt-16">
        {step > 0 && <button className="btn" onClick={() => setStep(step - 1)}><ChevronLeft size={18} /></button>}
        {step < steps.length - 1 ? (
          <button className="btn primary lg grow" disabled={step === 0 && !r.thought.trim()} onClick={() => setStep(step + 1)}>Continue</button>
        ) : (
          <button className="btn primary lg grow" onClick={save}>Save</button>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   LIFE WHEEL (monthly)
   ========================================================= */
export const WHEEL_AREAS = ['Health', 'Mind', 'Work', 'Money', 'Family', 'Friends', 'Fun', 'Growth'];
export function Radar8({ values, prev, size = 260, color = 'var(--accent)' }) {
  const c = size / 2;
  const R = c - 34;
  const pt = (i, v) => {
    const a = (Math.PI * 2 * i) / 8 - Math.PI / 2;
    return [c + Math.cos(a) * R * (v / 10), c + Math.sin(a) * R * (v / 10)];
  };
  const poly = (vals) => vals.map((v, i) => pt(i, v || 0).join(',')).join(' ');
  return (
    <svg width="100%" viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: size, display: 'block', margin: '0 auto' }}>
      {[2, 4, 6, 8, 10].map((l) => <polygon key={l} points={poly(Array(8).fill(l))} fill="none" stroke="var(--line-2)" strokeWidth="1" />)}
      {WHEEL_AREAS.map((_, i) => { const [x, y] = pt(i, 10); return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="var(--line)" />; })}
      {prev && <polygon points={poly(prev)} fill="none" stroke="var(--muted)" strokeDasharray="4 4" strokeWidth="1.5" />}
      <polygon points={poly(values)} fill={`color-mix(in srgb, ${color} 25%, transparent)`} stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
      {WHEEL_AREAS.map((a, i) => {
        const [x, y] = pt(i, 12.6);
        return <text key={a} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="10.5" fontWeight="600" fill="var(--text-2)">{a}</text>;
      })}
    </svg>
  );
}
export function Wheel() {
  const { toast } = useApp();
  const [month, setMonth] = useState(today().slice(0, 7));
  const rows = useLiveQuery(() => db.wheels.orderBy('month').toArray(), []) || [];
  const cur = rows.find((r) => r.month === month);
  const prevRow = rows.filter((r) => r.month < month).pop();
  const [vals, setVals] = useState(null);
  useEffect(() => { setVals(cur ? cur.values : prevRow ? [...prevRow.values] : Array(8).fill(5)); }, [month, rows.length]);
  if (!vals) return <div className="screen no-nav" />;
  const save = async () => {
    if (cur) await db.wheels.update(cur.id, { values: vals, date: today() }); else await db.wheels.add({ month, values: vals, date: today() });
    success(); toast('Saved');
  };
  const avgV = (vals.reduce((a, b) => a + b, 0) / 8).toFixed(1);
  const low = WHEEL_AREAS[vals.indexOf(Math.min(...vals))];
  const d = parse(month + '-01');
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="Life wheel" />
      <div className="row between mb-12">
        <button className="icon-btn sm" onClick={() => setMonth(addMonths(month + '-01', -1).slice(0, 7))}><ChevronLeft size={18} /></button>
        <div className="h3">{MONTHS[d.getMonth()]} {d.getFullYear()}</div>
        <button className="icon-btn sm" disabled={month >= today().slice(0, 7)} onClick={() => setMonth(addMonths(month + '-01', 1).slice(0, 7))}><ChevronRight size={18} /></button>
      </div>
      <div className="card">
        <Radar8 values={vals} prev={prevRow?.values} />
        <div className="row between small mt-8"><span className="muted">Balance {avgV}/10</span>{prevRow && <span className="muted">– – last month</span>}</div>
      </div>
      <div className="card mt-12">
        {WHEEL_AREAS.map((a, i) => (
          <div key={a} className="mb-12">
            <div className="row between small"><span style={{ fontWeight: 600 }}>{a}</span><span className="num muted">{vals[i]}/10</span></div>
            <input type="range" min={1} max={10} value={vals[i]} onChange={(e) => setVals(vals.map((v, k) => (k === i ? Number(e.target.value) : v)))} style={{ width: '100%', accentColor: 'var(--accent)' }} />
          </div>
        ))}
        <button className="btn primary block" onClick={save}>{cur ? 'Update' : 'Save'} {MONTHS[d.getMonth()]}</button>
      </div>
      <div className="card flat mt-12 small dim">Lowest area: <b>{low}</b>. Consider one small goal for it this month.</div>
    </div>
  );
}
