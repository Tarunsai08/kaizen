import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { X, ChevronLeft, ChevronRight, Search, Lock, Moon, Sparkles, CalendarDays, Plus } from 'lucide-react';
import { db, setKV } from '../db';
import { useApp } from '../ctx';
import { today, addDays, fmtDay, fmtDate, fmtTime, periodRange, buckets, weekStart, range, monthStart, addMonths, MONTHS, parse, ymd, dow, DAYS_SHORT, nowHM, fmtDur } from '../lib/date';
import { habitDueOn, sumByDate, breakStats, computeInsights, avg, money, sleepMinutes, goalProgress } from '../lib/logic';
import { TopBar, Sheet, Field, MoodScale, Scale5, TagSelect, Chips, PeriodToggle, Stat, Empty, MOODS, moodColor, moodEmoji, Toggle, Seg } from '../ui/kit';
import { Line, Bars, HBars, MonthGrid, Heatmap } from '../ui/charts';
import { SectionHead, GoalCard } from '../ui/rows';
import { TagList, syncSms } from './Money';
import { success, tap } from '../lib/native';

/* ---------- Journal lock ---------- */
let unlocked = false;
export function LockGate({ children }) {
  const { settings, pop } = useApp();
  const [pin, setPin] = useState('');
  const [ok, setOk] = useState(unlocked || !settings.journalLock);
  const [shake, setShake] = useState(false);
  if (ok) return children;
  const press = (d) => {
    tap();
    const p = (pin + d).slice(0, 4);
    setPin(p);
    if (p.length === 4) {
      if (p === settings.journalLock) { unlocked = true; setOk(true); }
      else { setShake(true); setTimeout(() => { setShake(false); setPin(''); }, 400); }
    }
  };
  return (
    <div className="screen no-nav">
      <TopBar title="" />
      <div className="lock-screen">
        <Lock size={28} className="muted" />
        <div className="h2">Journal is locked</div>
        <div className="pin-dots" style={shake ? { animation: 'pop .4s' } : null}>{[0, 1, 2, 3].map((i) => <i key={i} className={pin.length > i ? 'on' : ''} />)}</div>
        <div className="keypad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <button key={n} onClick={() => press(String(n))}>{n}</button>)}
          <button onClick={pop} style={{ fontSize: 14 }}>Cancel</button>
          <button onClick={() => press('0')}>0</button>
          <button onClick={() => setPin(pin.slice(0, -1))} style={{ fontSize: 14 }}>⌫</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Day summary (shared) ---------- */
async function daySummary(date) {
  const [habits, logs, urges, workouts, tasks, checkins, goals, txs, bored, presets] = await Promise.all([
    db.habits.filter((h) => !h.archived).toArray(),
    db.habitLogs.where('date').equals(date).toArray(),
    db.urges.where('date').equals(date).toArray(),
    db.workouts.where('date').equals(date).toArray(),
    db.tasks.toArray(),
    db.goalCheckins.where('date').equals(date).toArray(),
    db.goals.toArray(),
    db.transactions.where('date').equals(date).toArray(),
    db.boredom.where('date').equals(date).toArray(),
    db.presets.toArray(),
  ]);
  const sums = sumByDate(logs.map((l) => ({ ...l, date: l.habitId })));
  const build = habits.filter((h) => h.type === 'build' && h.freq !== 'weekly' && habitDueOn(h, date));
  const done = build.filter((h) => (sums[h.id] || 0) >= (h.target || 1));
  const missed = build.filter((h) => (sums[h.id] || 0) < (h.target || 1));
  const w = workouts[0];
  return {
    done, missed,
    resisted: urges.filter((u) => u.kind === 'urge' && u.outcome === 'resisted').length,
    relapses: urges.filter((u) => u.kind === 'relapse' || u.outcome === 'relapsed').length,
    workout: w ? { completed: w.completed, desc: w.entries.map((e) => `${presets.find((p) => p.id === e.presetId)?.name || '?'} L${e.level}`).join(' + '), level0: w.willing === false } : null,
    tasksDone: tasks.filter((t) => t.done && t.doneAt && ymd(new Date(t.doneAt)) === date).length,
    tasksPending: tasks.filter((t) => !t.done && !t.skipped && t.due === date).length,
    tasksOverdue: tasks.filter((t) => !t.done && !t.skipped && t.due && t.due < date).length,
    checkins: checkins.map((c) => ({ ...c, title: goals.find((g) => g.id === c.goalId)?.title })),
    spent: txs.filter((x) => x.direction === 'debit').reduce((a, b) => a + b.amount, 0),
    received: txs.filter((x) => x.direction === 'credit').reduce((a, b) => a + b.amount, 0),
    bored: bored.map((b) => b.option),
  };
}

function SummaryView({ s }) {
  const { settings } = useApp();
  const cur = settings.currency;
  const Row = ({ icon, label, value, color }) => (
    <div className="row gap-10" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
      <span style={{ width: 24, textAlign: 'center' }}>{icon}</span>
      <span className="grow dim">{label}</span>
      <span style={{ fontWeight: 620, color }} className="num">{value}</span>
    </div>
  );
  return (
    <div className="card" style={{ paddingTop: 6, paddingBottom: 6 }}>
      <Row icon="✅" label="Habits done" value={`${s.done.length}/${s.done.length + s.missed.length}`} color="var(--habit)" />
      {s.missed.length > 0 && <div className="tiny muted" style={{ padding: '6px 0 0 34px' }}>Missed: {s.missed.map((h) => h.name).join(', ')}</div>}
      {(s.resisted > 0 || s.relapses > 0) && <Row icon="🛡️" label="Urges resisted · relapses" value={`${s.resisted} · ${s.relapses}`} />}
      <Row icon="🏋️" label="Workout" value={s.workout ? (s.workout.completed ? (s.workout.level0 ? 'Level 0 ✓' : 'Done ✓') : 'Started') : '—'} color={s.workout?.completed ? 'var(--fit)' : undefined} />
      <Row icon="☑️" label="Tasks done · pending · overdue" value={`${s.tasksDone} · ${s.tasksPending} · ${s.tasksOverdue}`} />
      {s.checkins.length > 0 && <Row icon="🎯" label="Goal check-ins" value={`${s.checkins.filter((c) => c.response === 'yes').length} yes / ${s.checkins.length}`} />}
      <Row icon="💸" label="Spent · received" value={`${money(s.spent, cur)} · ${money(s.received, cur)}`} />
      {s.bored.length > 0 && <Row icon="🎈" label="Boredom sessions" value={s.bored.length} />}
    </div>
  );
}

/* =========================================================
   NIGHT REVIEW
   ========================================================= */
const ROTATING = ['What made you laugh today?', 'What drained your energy?', 'What gave you energy?', 'Who did you enjoy talking to?', 'What did you learn today?', 'What are you proud of today?', 'What would make tomorrow great?', 'What did you avoid today, and why?', 'When did you feel most like yourself?', 'What small win did you have?'];

export function NightReview() {
  return <LockGate><NightReviewInner /></LockGate>;
}
function NightReviewInner() {
  const { pop, push, settings, toast, celebrate } = useApp();
  const t = today();
  const [step, setStep] = useState(0);
  const [quick, setQuick] = useState(false);
  const [sum, setSum] = useState(null);
  const [j, setJ] = useState(null);
  const [prios, setPrios] = useState(['', '', '']);
  const untagged = useLiveQuery(() => db.transactions.where('tagged').equals(0).count(), []) ?? 0;
  const intention = useLiveQuery(() => db.intentions.where('date').equals(t).first(), [t]);
  useEffect(() => {
    (async () => {
      syncSms();
      setSum(await daySummary(t));
      const ex = await db.journal.where('date').equals(t).first();
      setJ(ex || { date: t, mood: null, energy: null, stress: null, tags: [], wentWell: '', notWell: '', grateful: '', differently: '', promptQ: ROTATING[(parse(t).getDate() + parse(t).getMonth()) % ROTATING.length], promptA: '', free: '', quick: false });
    })();
  }, []);
  if (!sum || !j) return <div className="timer-screen" />;
  const set = (p) => setJ((x) => ({ ...x, ...p }));
  const steps = quick ? ['quick', 'sleep'] : ['glance', ...(untagged ? ['tag'] : []), 'rate', 'journal', 'plan', 'sleep'];
  const cur = steps[Math.min(step, steps.length - 1)];
  const saveJournal = async () => {
    const row = { ...j, quick, ts: Date.now() };
    if (j.id) await db.journal.put(row); else { const id = await db.journal.add(row); setJ({ ...row, id }); }
  };
  const next = async () => {
    tap();
    if (cur === 'rate' || cur === 'journal' || cur === 'quick') await saveJournal();
    if (cur === 'plan') {
      const tom = addDays(t, 1);
      for (const p of prios.filter((x) => x.trim())) await db.tasks.add({ title: p.trim(), due: tom, priority: 'high', done: false, createdAt: Date.now(), subtasks: [], recurrence: 'none' });
    }
    setStep(step + 1);
  };
  const goSleep = async () => {
    const now = new Date();
    const wakeDate = now.getHours() >= 12 ? addDays(t, 1) : t;
    const ex = await db.sleep.where('date').equals(wakeDate).first();
    if (ex) await db.sleep.update(ex.id, { bedTs: now.getTime() }); else await db.sleep.add({ date: wakeDate, bedTs: now.getTime(), wakeTs: null, quality: null });
    success(); celebrate();
    toast('Good night');
    pop();
  };

  return (
    <div className="timer-screen" style={{ overflowY: 'auto' }}>
      <div className="row gap-10">
        <div className="step-dots grow">{steps.map((s, i) => <i key={s} className={i <= step ? 'on' : ''} />)}</div>
        <button className="icon-btn" onClick={pop}><X size={20} /></button>
      </div>
      <div className="grow col" style={{ paddingTop: 24, gap: 16 }}>
        {cur === 'glance' && (
          <>
            <div className="eyebrow">Night review · {fmtDay(t)}</div>
            <h1 className="h1">Your day at a glance</h1>
            <SummaryView s={sum} />
            <div className="row between card flat"><div><div className="h3">Tired tonight?</div><div className="small muted">Quick mode: mood + one line</div></div><Toggle on={quick} onChange={(v) => { setQuick(v); setStep(0); }} /></div>
          </>
        )}
        {cur === 'tag' && (
          <>
            <h1 className="h1">Tag today’s spending</h1>
            <p className="dim" style={{ margin: 0 }}>Quick category for each — it powers your money insights.</p>
            <TagList onEmpty={<Empty icon="✨" title="All tagged" />} />
          </>
        )}
        {cur === 'rate' && (
          <>
            <h1 className="h1">Rate the day</h1>
            <div className="label">Overall mood</div>
            <MoodScale value={j.mood} onChange={(v) => set({ mood: v })} />
            <div className="label mt-8">Energy</div>
            <Scale5 value={j.energy} onChange={(v) => set({ energy: v })} color="var(--goal)" labels={['Drained', 'Charged']} />
            <div className="label mt-8">Stress</div>
            <Scale5 value={j.stress} onChange={(v) => set({ stress: v })} color="var(--break)" labels={['Calm', 'Overwhelmed']} />
            {intention?.text && (
              <>
                <div className="label mt-8">Did you live your intention? <span className="muted">“{intention.text}”</span></div>
                <div className="grid-3">
                  {[['yes', 'Yes'], ['partly', 'Partly'], ['no', 'Not really']].map(([k, l]) => (
                    <button key={k} className="btn" style={intention.result === k ? { background: 'var(--text)', color: 'var(--bg)' } : null} onClick={() => { tap(); db.intentions.update(intention.id, { result: k }); }}>{l}</button>
                  ))}
                </div>
              </>
            )}
            <div className="label mt-8">Feelings</div>
            <TagSelect options={settings.emotions} value={j.tags || []} onChange={(v) => set({ tags: v })} multi onAdd={(e) => setKV('emotions', [...settings.emotions, e])} />
          </>
        )}
        {cur === 'journal' && (
          <>
            <h1 className="h1">Reflect</h1>
            <p className="small muted" style={{ margin: 0 }}>All optional. A few words is enough.</p>
            {[['wentWell', 'What went well today?'], ['notWell', 'What didn’t go well?'], ['grateful', 'One thing I’m grateful for'], ['differently', 'One thing I’ll do differently tomorrow']].map(([k, q]) => (
              <Field key={k} label={q}>
                <textarea className="textarea" style={{ minHeight: 64 }} value={j[k]} onChange={(e) => set({ [k]: e.target.value })} />
                {k === 'notWell' && j.notWell.trim().length > 12 && <button className="btn sm ghost" style={{ alignSelf: 'flex-start', color: 'var(--task)' }} onClick={() => push('Reframe', { thought: j.notWell })}>Feeling heavy? Reframe this thought →</button>}
              </Field>
            ))}
            <Field label={j.promptQ}><textarea className="textarea" style={{ minHeight: 64 }} value={j.promptA} onChange={(e) => set({ promptA: e.target.value })} /></Field>
            <Field label="Anything else"><textarea className="textarea" value={j.free} onChange={(e) => set({ free: e.target.value })} /></Field>
          </>
        )}
        {cur === 'plan' && (
          <>
            <h1 className="h1">Plan tomorrow</h1>
            <p className="dim" style={{ margin: 0 }}>Pick 1–3 top priorities. They’ll be waiting in tomorrow’s tasks.</p>
            {prios.map((p, i) => <input key={i} className="input" placeholder={`Priority ${i + 1}`} value={p} onChange={(e) => setPrios(prios.map((x, k) => (k === i ? e.target.value : x)))} />)}
          </>
        )}
        {cur === 'quick' && (
          <>
            <h1 className="h1">Quick check-out</h1>
            <MoodScale value={j.mood} onChange={(v) => set({ mood: v })} />
            <Field label="One line about today"><textarea className="textarea" value={j.free} onChange={(e) => set({ free: e.target.value })} autoFocus /></Field>
          </>
        )}
        {cur === 'sleep' && (
          <div className="col grow" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 18 }}>
            <Moon size={48} color="var(--sleep)" />
            <h1 className="h1">Day closed.</h1>
            <p className="dim" style={{ maxWidth: 280 }}>Phone away, see you tomorrow.</p>
            <button className="btn lg block" style={{ background: 'var(--sleep)', color: '#000' }} onClick={goSleep}>Going to sleep</button>
            <button className="btn ghost" onClick={() => { toast('Review saved'); pop(); }}>Not yet — just close</button>
          </div>
        )}
      </div>
      {cur !== 'sleep' && (
        <div className="row mt-16">
          {step > 0 && <button className="btn" onClick={() => setStep(step - 1)}><ChevronLeft size={18} /></button>}
          <button className="btn primary lg grow" onClick={next} disabled={(cur === 'quick' || cur === 'rate') && !j.mood}>{cur === 'tag' && untagged ? 'Skip for now' : 'Continue'}</button>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   MORNING CHECK-IN
   ========================================================= */
export function Morning() {
  const { pop, push, settings, toast } = useApp();
  const t = today();
  const [wake, setWake] = useState(nowHM());
  const [quality, setQuality] = useState(null);
  const [mood, setMood] = useState(null);
  const [intent, setIntent] = useState('');
  const [saved, setSaved] = useState(false);
  const data = useLiveQuery(async () => ({
    sleep: await db.sleep.where('date').equals(t).first(),
    goals: await db.goals.where('status').equals('active').toArray(),
    tasks: await db.tasks.filter((x) => !x.done && !x.skipped && x.due && x.due <= t).toArray(),
    allTasks: await db.tasks.toArray(),
    presets: await db.presets.toArray(),
  }), []);
  if (!data) return <div className="screen no-nav" />;
  const sched = (settings.schedule || {})[dow(t)] || [];
  const save = async () => {
    const [h, m] = wake.split(':').map(Number);
    const w = new Date(); w.setHours(h, m, 0, 0);
    if (data.sleep) await db.sleep.update(data.sleep.id, { wakeTs: w.getTime(), quality });
    else await db.sleep.add({ date: t, bedTs: null, wakeTs: w.getTime(), quality });
    if (mood) await db.moods.add({ date: t, ts: Date.now(), mood, tags: [], kind: 'morning' });
    if (intent.trim()) await db.intentions.put({ ...(await db.intentions.where('date').equals(t).first()), date: t, text: intent.trim() });
    success(); setSaved(true);
  };
  const dur = data.sleep?.bedTs ? (() => { const [h, m] = wake.split(':').map(Number); const w = new Date(); w.setHours(h, m, 0, 0); return (w.getTime() - data.sleep.bedTs) / 60000; })() : null;
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="" />
      <div className="eyebrow">Good morning{settings.name ? `, ${settings.name}` : ''}</div>
      {!saved ? (
        <>
          <h1 className="h1 mt-8">How did you sleep?</h1>
          <div className="form mt-24">
            <Field label="Woke up at"><input type="time" className="input" value={wake} onChange={(e) => setWake(e.target.value)} /></Field>
            {dur != null && dur > 0 && dur < 1200 && <div className="small muted">≈ {fmtDur(dur)} of sleep since {fmtTime(data.sleep.bedTs)}</div>}
            <Field label="Sleep quality"><Scale5 value={quality} onChange={setQuality} color="var(--sleep)" labels={['Terrible', 'Great']} /></Field>
            <Field label="Mood on waking"><MoodScale value={mood} onChange={setMood} /></Field>
            <Field label="Today I want to…" hint="One intention. The night review will ask how it went.">
              <input className="input" value={intent} onChange={(e) => setIntent(e.target.value)} placeholder="be present, finish the report, move my body…" />
              <div className="chips mt-8">{['Be patient', 'Focus deeply', 'Move my body', 'Be kind to myself', 'Say no to distractions', 'Listen more'].map((x) => <button key={x} className="chip" onClick={() => setIntent(x)}>{x}</button>)}</div>
            </Field>
            <button className="btn primary lg block" onClick={save} disabled={!quality}>Save</button>
          </div>
        </>
      ) : (
        <div className="fade-in">
          <h1 className="h1 mt-8">Here’s your day</h1>
          {sched.length > 0 && (
            <div className="card mt-16 row gap-14" onClick={() => push('Workout', { date: t })}>
              <span style={{ fontSize: 22 }}>🏋️</span>
              <div className="grow"><div className="h3">Workout</div><div className="small muted">{sched.map((s) => `${data.presets.find((p) => p.id === s.presetId)?.name} L${s.level}`).join(' + ')}</div></div>
            </div>
          )}
          {data.goals.length > 0 && <><div className="eyebrow mt-24 mb-8">Goals</div><div className="col gap-6">{data.goals.slice(0, 4).map((g) => <GoalCard key={g.id} g={g} tasks={data.allTasks} compact />)}</div></>}
          <div className="eyebrow mt-24 mb-8">Tasks today</div>
          {data.tasks.length ? <div className="list">{data.tasks.map((x) => <div key={x.id} className="list-item"><span className="pill-dot" style={{ background: x.priority === 'high' ? 'var(--bad)' : 'var(--task)' }} /><span className="grow">{x.title}</span></div>)}</div> : <div className="small muted">Nothing due. Nice.</div>}
          <button className="btn primary lg block mt-24" onClick={pop}>Let’s go</button>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   JOURNAL HISTORY
   ========================================================= */
export function JournalHistory() {
  return <LockGate><JournalHistoryInner /></LockGate>;
}
function JournalHistoryInner() {
  const { push } = useApp();
  const [month, setMonth] = useState(monthStart());
  const [q, setQ] = useState('');
  const data = useLiveQuery(async () => ({ journal: await db.journal.toArray(), moods: await db.moods.toArray() }), []);
  if (!data) return <div className="screen no-nav" />;
  const { journal, moods } = data;
  const dayMood = {};
  moods.forEach((m) => (dayMood[m.date] = dayMood[m.date] || []).push(m.mood));
  journal.forEach((j) => { if (j.mood) (dayMood[j.date] = dayMood[j.date] || []).push(j.mood); });
  const md = (d) => (dayMood[d] ? avg(dayMood[d]) : null);
  const t = today();
  const monthAgo = addMonths(t, -1);
  const yearAgo = addMonths(t, -12);
  const otd = journal.filter((j) => j.date === monthAgo || j.date === yearAgo);
  const text = (j) => [j.wentWell, j.notWell, j.grateful, j.differently, j.promptA, j.free, (j.tags || []).join(' ')].join(' ').toLowerCase();
  const results = q ? journal.filter((j) => text(j).includes(q.toLowerCase())) : [];
  const recent = [...journal].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="Journal" right={<button className="icon-btn" onClick={() => push('NightReview')}><Plus size={20} /></button>} />
      <div className="card">
        <div className="row between mb-12">
          <button className="icon-btn sm ghost" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft size={18} /></button>
          <div className="h3">{MONTHS[parse(month).getMonth()]} {parse(month).getFullYear()}</div>
          <button className="icon-btn sm ghost" onClick={() => setMonth(addMonths(month, 1))} disabled={month >= monthStart()}><ChevronRight size={18} /></button>
        </div>
        <MonthGrid month={month} onPick={(d) => d <= t && push('JournalDay', { date: d })} render={(d) => {
          const m = md(d);
          const hasJ = journal.some((j) => j.date === d);
          return (
            <div style={{ width: '100%', height: '100%', borderRadius: 12, background: m ? `color-mix(in srgb, ${moodColor(m)} 70%, transparent)` : d > t ? 'transparent' : 'var(--surface-2)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 600, color: m ? '#000' : 'var(--muted)', outline: d === t ? '1.5px solid var(--text-2)' : 'none', position: 'relative' }}>
              {parse(d).getDate()}
              {hasJ && <span style={{ position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: 2, background: m ? '#000' : 'var(--text-2)' }} />}
            </div>
          );
        }} />
      </div>
      <div className="row mt-12" style={{ position: 'relative' }}>
        <Search size={16} className="muted" style={{ position: 'absolute', left: 14 }} />
        <input className="input" style={{ paddingLeft: 38 }} placeholder="Search entries or feelings" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {q && (
        <div className="section">
          <SectionHead title={`${results.length} result${results.length === 1 ? '' : 's'}`} />
          <EntryList list={results} push={push} />
        </div>
      )}
      {!q && otd.length > 0 && (
        <div className="section">
          <SectionHead title="On this day" />
          {otd.map((j) => (
            <button key={j.id} className="card card-press" style={{ width: '100%', textAlign: 'left', marginBottom: 8 }} onClick={() => push('JournalDay', { date: j.date })}>
              <div className="eyebrow">{j.date === yearAgo ? 'A year ago' : 'A month ago'} · {moodEmoji(j.mood)}</div>
              <div className="dim mt-8" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{j.wentWell || j.free || j.grateful || '—'}</div>
            </button>
          ))}
        </div>
      )}
      {!q && (
        <>
          <div className="grid-2 mt-16">
            <button className="card card-press" style={{ textAlign: 'left' }} onClick={() => push('WeeklyReview')}><CalendarDays size={18} color="var(--goal)" /><div className="h3 mt-8">Weekly review</div></button>
            <button className="card card-press" style={{ textAlign: 'left' }} onClick={() => push('MoodStats')}><Sparkles size={18} color="var(--mood)" /><div className="h3 mt-8">Mood stats</div></button>
          </div>
          <div className="section"><SectionHead title="Recent entries" />{recent.length ? <EntryList list={recent} push={push} /> : <Empty icon="📓" title="No entries yet" sub="The night review writes your journal." />}</div>
        </>
      )}
    </div>
  );
}
function EntryList({ list, push }) {
  return (
    <div className="list">
      {list.map((j) => (
        <button key={j.id} className="list-item" onClick={() => push('JournalDay', { date: j.date })}>
          <span style={{ fontSize: 22 }}>{moodEmoji(j.mood)}</span>
          <div className="grow"><div style={{ fontWeight: 560 }}>{fmtDay(j.date)}{j.quick ? ' · quick' : ''}</div><div className="tiny muted ellipsis">{j.wentWell || j.free || j.grateful || (j.tags || []).join(', ') || '—'}</div></div>
        </button>
      ))}
    </div>
  );
}

export function JournalDay({ date }) {
  return <LockGate><JournalDayInner date={date} /></LockGate>;
}
function JournalDayInner({ date }) {
  const [sum, setSum] = useState(null);
  const j = useLiveQuery(() => db.journal.where('date').equals(date).first(), [date]);
  const moods = useLiveQuery(() => db.moods.where('date').equals(date).toArray(), [date]) || [];
  const sleep = useLiveQuery(() => db.sleep.where('date').equals(date).first(), [date]);
  useEffect(() => { daySummary(date).then(setSum); }, [date]);
  const Q = ({ q, a }) => (a ? <div className="mb-16"><div className="label mb-8">{q}</div><div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{a}</div></div> : null);
  return (
    <div className="screen no-nav page-enter">
      <TopBar title={fmtDay(date)} />
      {j ? (
        <div className="hero">
          <div className="row gap-14">
            <span style={{ fontSize: 44 }}>{moodEmoji(j.mood)}</span>
            <div className="grow small dim">
              {j.energy && <div>Energy {j.energy}/5</div>}
              {j.stress && <div>Stress {j.stress}/5</div>}
              {(j.tags || []).length > 0 && <div className="row wrap gap-4 mt-4">{j.tags.map((t) => <span key={t} className="badge">{t}</span>)}</div>}
            </div>
          </div>
        </div>
      ) : <div className="card muted small">No night review this day.</div>}
      {moods.length > 0 && <div className="row gap-6 mt-12 wrap">{moods.sort((a, b) => a.ts - b.ts).map((m) => <span key={m.id} className="badge" style={{ height: 30 }}>{moodEmoji(m.mood)} {fmtTime(m.ts)}{m.tags?.length ? ` · ${m.tags.join(', ')}` : ''}</span>)}</div>}
      {sleep && <div className="small muted mt-12">😴 {sleepMinutes(sleep) > 0 ? `${fmtDur(sleepMinutes(sleep))} sleep · ` : ''}{sleep.quality ? `quality ${sleep.quality}/5` : ''}</div>}
      {j && (
        <div className="mt-24">
          <Q q="What went well" a={j.wentWell} />
          <Q q="What didn’t go well" a={j.notWell} />
          <Q q="Grateful for" a={j.grateful} />
          <Q q="Will do differently" a={j.differently} />
          <Q q={j.promptQ} a={j.promptA} />
          <Q q={j.quick ? 'One line' : 'Anything else'} a={j.free} />
        </div>
      )}
      {sum && <div className="section"><SectionHead title="That day" /><SummaryView s={sum} /></div>}
    </div>
  );
}

/* =========================================================
   WEEKLY REVIEW
   ========================================================= */
export function WeeklyReview() {
  const { settings } = useApp();
  const [off, setOff] = useState(0);
  const ws = addDays(weekStart(), off * 7);
  const we = addDays(ws, 6);
  const data = useLiveQuery(async () => {
    const [moods, journal, habits, logs, workouts, checkins, txs, tasks] = await Promise.all([
      db.moods.where('date').between(ws, we, true, true).toArray(),
      db.journal.where('date').between(ws, we, true, true).toArray(),
      db.habits.where('type').equals('build').toArray(),
      db.habitLogs.where('date').between(ws, we, true, true).toArray(),
      db.workouts.where('date').between(ws, we, true, true).toArray(),
      db.goalCheckins.where('date').between(ws, we, true, true).toArray(),
      db.transactions.where('date').between(ws, we, true, true).toArray(),
      db.tasks.toArray(),
    ]);
    return { moods, journal, habits, logs, workouts, checkins, txs, tasks };
  }, [ws]);
  if (!data) return <div className="screen no-nav" />;
  const { moods, journal, habits, logs, workouts, checkins, txs, tasks } = data;
  const dm = {};
  moods.forEach((m) => (dm[m.date] = dm[m.date] || []).push(m.mood));
  journal.forEach((j) => j.mood && (dm[j.date] = dm[j.date] || []).push(j.mood));
  const days = range(ws, we).map((d) => ({ d, m: dm[d] ? avg(dm[d]) : null }));
  const rated = days.filter((x) => x.m != null);
  const best = rated.length ? rated.reduce((a, b) => (b.m > a.m ? b : a)) : null;
  const worst = rated.length ? rated.reduce((a, b) => (b.m < a.m ? b : a)) : null;
  let hd = 0, hn = 0;
  const byHD = {};
  logs.forEach((l) => (byHD[l.habitId + '|' + l.date] = (byHD[l.habitId + '|' + l.date] || 0) + (l.amount || 1)));
  habits.filter((h) => !h.archived && h.freq !== 'weekly').forEach((h) => range(ws, we > today() ? today() : we).forEach((d) => { if (habitDueOn(h, d)) { hn++; if ((byHD[h.id + '|' + d] || 0) >= (h.target || 1)) hd++; } }));
  const goalsProg = new Set(checkins.filter((c) => c.response === 'yes').map((c) => c.goalId)).size;
  const spent = txs.filter((x) => x.direction === 'debit').reduce((a, b) => a + b.amount, 0);
  const tDone = tasks.filter((x) => x.done && x.doneAt && ymd(new Date(x.doneAt)) >= ws && ymd(new Date(x.doneAt)) <= we).length;
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="Weekly review" />
      <div className="row between mb-12">
        <button className="icon-btn sm" onClick={() => setOff(off - 1)}><ChevronLeft size={18} /></button>
        <div className="h3">{fmtDate(ws)} – {fmtDate(we)}</div>
        <button className="icon-btn sm" onClick={() => setOff(Math.min(0, off + 1))}><ChevronRight size={18} /></button>
      </div>
      <div className="hero center">
        <div className="glow" style={{ background: 'var(--mood)', left: '50%', marginLeft: -110, top: -120 }} />
        <div className="eyebrow">Average mood</div>
        <div style={{ fontSize: 56 }} className="mt-8">{rated.length ? moodEmoji(avg(rated.map((x) => x.m))) : '·'}</div>
        <div className="h3 num">{rated.length ? avg(rated.map((x) => x.m)).toFixed(1) : '—'} / 5</div>
        <div className="row mt-16" style={{ gap: 6 }}>
          {days.map((x) => <div key={x.d} className="col" style={{ flex: 1, alignItems: 'center', gap: 4 }}><div style={{ width: '100%', height: 36, borderRadius: 10, background: x.m ? moodColor(x.m) : 'var(--surface-3)' }} /><span className="tiny muted">{DAYS_SHORT[dow(x.d)][0]}</span></div>)}
        </div>
      </div>
      <div className="grid-2 mt-12">
        <Stat v={best ? `${DAYS_SHORT[dow(best.d)]} ${moodEmoji(best.m)}` : '—'} k="Best day" color="var(--good)" />
        <Stat v={worst && worst !== best ? `${DAYS_SHORT[dow(worst.d)]} ${moodEmoji(worst.m)}` : '—'} k="Hardest day" />
        <Stat v={hn ? `${Math.round((hd / hn) * 100)}%` : '—'} k="Habits completed" sub={`${hd}/${hn}`} color="var(--habit)" />
        <Stat v={workouts.filter((w) => w.completed).length} k="Workouts" color="var(--fit)" />
        <Stat v={goalsProg} k="Goals progressed" color="var(--goal)" />
        <Stat v={tDone} k="Tasks done" color="var(--task)" />
      </div>
      <div className="card mt-12 row between"><span className="dim">Spent this week</span><span className="h2 num">{money(spent, settings.currency)}</span></div>
      <div className="small muted center mt-16">{journal.length}/7 nights reviewed</div>
    </div>
  );
}

/* =========================================================
   MOOD STATS
   ========================================================= */
export function MoodStats({ log }) {
  const { toast } = useApp();
  const [period, setPeriod] = useState('month');
  const [logged, setLogged] = useState(null);
  const data = useLiveQuery(async () => ({ moods: await db.moods.toArray(), journal: await db.journal.toArray() }), []);
  if (!data) return <div className="screen no-nav" />;
  const { moods, journal } = data;
  const [from, to] = periodRange(period);
  const t = today();
  const all = [...moods.map((m) => ({ date: m.date, mood: m.mood, energy: m.energy, tags: m.tags || [] })), ...journal.filter((j) => j.mood).map((j) => ({ date: j.date, mood: j.mood, energy: j.energy, stress: j.stress, tags: j.tags || [] }))];
  const inR = all.filter((x) => x.date >= from && x.date <= to);
  const bk = buckets(period);
  const trend = bk.map((b) => { const l = all.filter((x) => x.date >= b.from && x.date <= b.to); return { label: b.label, value: b.from > t || !l.length ? null : +avg(l.map((x) => x.mood)).toFixed(2) }; });
  const energy = bk.map((b) => { const l = all.filter((x) => x.date >= b.from && x.date <= b.to && x.energy); return { label: b.label, value: b.from > t || !l.length ? null : +avg(l.map((x) => x.energy)).toFixed(1) }; });
  const stress = bk.map((b) => { const l = journal.filter((x) => x.date >= b.from && x.date <= b.to && x.stress); return { label: b.label, value: b.from > t || !l.length ? null : +avg(l.map((x) => x.stress)).toFixed(1) }; });
  const tags = {};
  inR.forEach((x) => x.tags.forEach((g) => (tags[g] = (tags[g] || 0) + 1)));
  const dm = {};
  all.forEach((x) => (dm[x.date] = dm[x.date] || []).push(x.mood));
  const heat = {};
  Object.entries(dm).forEach(([d, l]) => (heat[d] = avg(l)));
  const jr = journal.filter((j) => j.date >= from && j.date <= to);
  const quickMood = async (v) => { await db.moods.add({ date: t, ts: Date.now(), mood: v, tags: [], kind: 'quick' }); setLogged(v); success(); toast('Mood logged'); };
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="Mood" />
      {log && !logged && <div className="card mb-16"><div className="h3 mb-12">How are you feeling?</div><MoodScale value={logged} onChange={quickMood} /></div>}
      <PeriodToggle value={period} onChange={setPeriod} />
      <div className="grid-3 mt-12">
        <Stat v={inR.length ? `${moodEmoji(avg(inR.map((x) => x.mood)))} ${avg(inR.map((x) => x.mood)).toFixed(1)}` : '—'} k="Avg mood" color="var(--mood)" />
        <Stat v={jr.length} k="Nights reviewed" sub={`${jr.filter((j) => j.quick).length} quick`} />
        <Stat v={inR.length} k="Check-ins" />
      </div>
      <div className="card mt-12"><div className="h3 mb-12">Mood trend</div><Line data={trend} color="var(--mood)" min={1} max={5} /></div>
      <div className="card mt-12"><div className="h3 mb-12">Mood calendar</div><Heatmap values={heat} colorFor={(v) => (v == null ? 'var(--surface-3)' : moodColor(v))} /></div>
      <div className="card mt-12"><div className="h3 mb-12">Feelings that come up most</div><HBars items={Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => ({ label: k, value: v, color: 'var(--mood)' }))} format={(v) => `${v}×`} /></div>
      <div className="grid-2 mt-12">
        <div className="card"><div className="h3 mb-12">Energy</div><Bars data={energy} color="var(--goal)" max={5} height={90} /></div>
        <div className="card"><div className="h3 mb-12">Stress</div><Bars data={stress} color="var(--break)" max={5} height={90} /></div>
      </div>
    </div>
  );
}

/* =========================================================
   INSIGHTS
   ========================================================= */
export function Insights() {
  const { push } = useApp();
  const [list, setList] = useState(null);
  const counts = useLiveQuery(async () => ({ moods: (await db.moods.count()) + (await db.journal.count()), days: new Set((await db.moods.toArray()).map((m) => m.date).concat((await db.journal.toArray()).map((j) => j.date))).size }), []);
  useEffect(() => { computeInsights().then(setList); }, []);
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="Insights" />
      <h1 className="h1">What your data says</h1>
      <p className="dim mt-8">Simple links between mood, sleep, movement, habits and money. They sharpen as you log more days.</p>
      <div className="col gap-10 mt-16">
        {list && list.map((i, k) => (
          <div key={k} className="insight fade-in">
            <span style={{ fontSize: 24 }}>{i.icon}</span>
            <div><div style={{ fontWeight: 600, lineHeight: 1.4 }}>{i.text}</div>{i.detail && <div className="tiny muted mt-4">{i.detail}</div>}</div>
          </div>
        ))}
        {list && !list.length && (
          <div className="card">
            <div className="h3">Not enough data yet</div>
            <p className="small muted" style={{ marginBottom: 0 }}>Insights appear once you have ~a week of mood check-ins alongside sleep, workouts and spending. You have mood on {counts?.days || 0} day{counts?.days === 1 ? '' : 's'} so far.</p>
            <div className="mt-12"><div className="bar"><i style={{ width: `${Math.min(100, ((counts?.days || 0) / 10) * 100)}%`, background: 'var(--accent)' }} /></div></div>
          </div>
        )}
      </div>
      <div className="grid-2 mt-16">
        <button className="card card-press" style={{ textAlign: 'left' }} onClick={() => push('WeeklyReview')}><CalendarDays size={18} color="var(--goal)" /><div className="h3 mt-8">Weekly review</div></button>
        <button className="card card-press" style={{ textAlign: 'left' }} onClick={() => push('JournalHistory')}><Sparkles size={18} color="var(--mood)" /><div className="h3 mt-8">Journal</div></button>
      </div>
    </div>
  );
}
