import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { X, Play, Pause, Check, Coffee } from 'lucide-react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { db } from '../db';
import { useApp } from '../ctx';
import { today, fmtClock, lastNDays, DAYS_SHORT, dow, fmtDur } from '../lib/date';
import { completeTask } from '../lib/logic';
import { Chips, Ring, Stat, TopBar } from '../ui/kit';
import { Bars } from '../ui/charts';
import Companion from '../ui/Companion';
import { success, tap, isNative } from '../lib/native';

const NOTIF_ID = 777001;

/* Focus timer (Forest / Pomodoro): your plant grows while you stay focused. */
export function Focus({ taskId, study }) {
  const { pop, push, toast, celebrate } = useApp();
  const tasks = useLiveQuery(() => db.tasks.filter((t) => !t.done && !t.skipped).toArray(), []) || [];
  const [task, setTask] = useState(taskId || null);
  const [mins, setMins] = useState(25);
  const [stage, setStage] = useState('setup'); // setup | run | done | break
  const [start, setStart] = useState(0);
  const [pausedAt, setPausedAt] = useState(null);
  const [pausedTotal, setPausedTotal] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [leaves, setLeaves] = useState(0);
  const hiddenAt = useRef(null);
  const taskObj = tasks.find((t) => t.id === task);

  useEffect(() => {
    if (stage !== 'run' && stage !== 'break') return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [stage]);
  // count times you leave the app mid-session (Forest-style, but gentle)
  useEffect(() => {
    if (stage !== 'run') return;
    const h = () => {
      if (document.visibilityState === 'hidden') hiddenAt.current = Date.now();
      else if (hiddenAt.current) { if (Date.now() - hiddenAt.current > 8000) setLeaves((l) => l + 1); hiddenAt.current = null; }
    };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, [stage]);

  const total = (stage === 'break' ? 5 : mins) * 60;
  const elapsed = start ? ((pausedAt || now) - start - pausedTotal) / 1000 : 0;
  const left = Math.max(0, total - elapsed);
  useEffect(() => { if ((stage === 'run' || stage === 'break') && start && left <= 0) finish(true); }, [left]);

  const schedule = async (sec) => {
    if (!isNative) return;
    try {
      await LocalNotifications.cancel({ notifications: [{ id: NOTIF_ID }] });
      await LocalNotifications.schedule({ notifications: [{ id: NOTIF_ID, title: stage === 'break' ? 'Break over' : 'Focus session complete 🌱', body: stage === 'break' ? 'Ready for another round?' : 'Nice work. Take a short break.', schedule: { at: new Date(Date.now() + sec * 1000), allowWhileIdle: true } }] });
    } catch {}
  };
  const cancelNotif = () => isNative && LocalNotifications.cancel({ notifications: [{ id: NOTIF_ID }] }).catch(() => {});

  const begin = (kind = 'run') => {
    tap('medium');
    setStart(Date.now()); setNow(Date.now()); setPausedAt(null); setPausedTotal(0); setLeaves(0);
    setStage(kind);
    schedule((kind === 'break' ? 5 : mins) * 60);
  };
  const togglePause = () => {
    if (pausedAt) { setPausedTotal((p) => p + (Date.now() - pausedAt)); schedule(left); setPausedAt(null); }
    else { setPausedAt(Date.now()); cancelNotif(); }
  };
  const finish = async (complete) => {
    cancelNotif();
    if (stage === 'break') { setStage('setup'); setStart(0); return; }
    const m = Math.round(elapsed / 60);
    if (m >= 1) await db.focus.add({ date: today(), ts: start, minutes: m, planned: mins, taskId: task, label: study?.label || taskObj?.title || 'Focus session', completed: complete, interruptions: leaves, ...(study ? { study: study.sid, nodeId: study.id } : {}) });
    if (complete) { success(); celebrate(); }
    setStage('done');
  };

  const prog = Math.min(1, elapsed / total);
  const plantStage = stage === 'done' ? 4 : Math.min(4, Math.floor(prog * 5));

  if (stage === 'setup') {
    return (
      <div className="timer-screen" style={{ overflowY: 'auto' }}>
        <div className="row between"><span className="eyebrow">Focus</span><button className="icon-btn" onClick={pop}><X size={20} /></button></div>
        <div className="col" style={{ alignItems: 'center', marginTop: 20 }}><div className="float"><Companion stage={0} mood="ok" size={110} /></div></div>
        <h1 className="h1 center mt-8">Plant a focus session</h1>
        <p className="dim center" style={{ marginTop: 6 }}>It grows while you stay on task. Leaving the app is okay — it’s just counted.</p>
        <div className="label mt-24 mb-8">Duration</div>
        <Chips value={mins} onChange={setMins} options={[15, 25, 45, 60, 90].map((v) => ({ value: v, label: `${v} min` }))} />
        <div className="label mt-24 mb-8">Working on</div>
        {study ? <div className="card flat small" style={{ fontWeight: 600 }}>📚 {study.label}</div> : <select className="select" value={task || ''} onChange={(e) => setTask(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Nothing specific</option>
          {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>}
        <div className="grow" />
        <button className="btn lg block mt-24" style={{ background: 'var(--bored)', color: '#000' }} onClick={() => begin('run')}><Play size={18} /> Start {mins} min</button>
      </div>
    );
  }
  if (stage === 'done') {
    return (
      <div className="timer-screen">
        <div className="row between"><span className="eyebrow">Session complete</span><button className="icon-btn" onClick={pop}><X size={20} /></button></div>
        <div className="col grow" style={{ justifyContent: 'center', alignItems: 'center', gap: 14, textAlign: 'center' }}>
          <Companion stage={4} mood="happy" size={150} />
          <h1 className="h1">{Math.round(elapsed / 60)} minutes of focus</h1>
          <p className="dim">{leaves ? `You stepped away ${leaves} time${leaves > 1 ? 's' : ''}.` : 'No distractions. Beautiful.'}</p>
        </div>
        {study && <StudyDone study={study} />}
        {taskObj && <button className="btn block mb-8" onClick={async () => { await completeTask(taskObj, true); toast('Task done'); pop(); }}><Check size={18} /> Mark “{taskObj.title}” done</button>}
        <div className="row">
          <button className="btn lg grow" onClick={() => begin('break')}><Coffee size={18} /> 5 min break</button>
          <button className="btn primary lg grow" onClick={pop}>Done</button>
        </div>
      </div>
    );
  }
  return (
    <div className="timer-screen">
      <div className="row between"><span className="eyebrow">{stage === 'break' ? 'Break' : taskObj?.title || 'Focus'}</span><button className="icon-btn" onClick={() => finish(false)}><X size={20} /></button></div>
      <div className="col grow" style={{ justifyContent: 'center', alignItems: 'center', gap: 26 }}>
        <Ring size={250} stroke={6} value={prog} color={stage === 'break' ? 'var(--goal)' : 'var(--bored)'}>
          {stage === 'break' ? <Coffee size={56} color="var(--goal)" /> : <Companion stage={plantStage} mood={pausedAt ? 'sleepy' : 'ok'} size={120} />}
        </Ring>
        <div className="center">
          <div className="timer-big">{fmtClock(left)}</div>
          <div className="small muted">{pausedAt ? 'Paused' : stage === 'break' ? 'Rest your eyes' : 'Stay with it'}</div>
        </div>
      </div>
      <div className="row">
        <button className="btn lg grow" onClick={togglePause}>{pausedAt ? <><Play size={18} /> Resume</> : <><Pause size={18} /> Pause</>}</button>
        <button className="btn lg grow" onClick={() => finish(false)}>{stage === 'break' ? 'Skip' : 'Finish early'}</button>
      </div>
    </div>
  );
}

function StudyDone({ study }) {
  const { pop, toast } = useApp();
  const done = useLiveQuery(() => db.progress.get(study.id), [study.id]);
  if (done?.done) return null;
  return (
    <button className="btn block mb-8" onClick={async () => {
      const { completeLesson, findNode } = await import('../lib/study');
      const s = await db.subjects.where('sid').equals(study.sid).first();
      const hit = s && findNode(s, study.id);
      if (hit) { await completeLesson(study.sid, hit.node); success(); toast('Lesson complete'); }
      pop(); pop();
    }}><Check size={18} /> Mark “{study.label}” complete</button>
  );
}

export function FocusStats() {
  const rows = useLiveQuery(() => db.focus.toArray(), []);
  if (!rows) return <div className="screen no-nav" />;
  const days = lastNDays(7);
  const bars = days.map((d) => ({ label: DAYS_SHORT[dow(d)][0], value: rows.filter((r) => r.date === d).reduce((a, b) => a + b.minutes, 0) }));
  const week = bars.reduce((a, b) => a + b.value, 0);
  const t = rows.filter((r) => r.date === today()).reduce((a, b) => a + b.minutes, 0);
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="Focus" />
      <div className="grid-3">
        <Stat v={fmtDur(t)} k="Today" color="var(--bored)" />
        <Stat v={fmtDur(week)} k="Last 7 days" />
        <Stat v={rows.filter((r) => r.completed).length} k="Sessions" />
      </div>
      <div className="card mt-12"><div className="h3 mb-12">Minutes per day</div><Bars data={bars} color="var(--bored)" showValues /></div>
    </div>
  );
}
