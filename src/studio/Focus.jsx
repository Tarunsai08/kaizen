// Studio · Focus. Forest: plant a tree that grows while you focus. Tide: an optional calm, full-screen Zen mode.
import React, { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Minus, Plus, ChevronRight, ChevronLeft, Volume2, VolumeX, X, Trees, Wind, Check, Coffee, GraduationCap, CheckSquare } from 'lucide-react';
import { db, setKV } from '../db';
import { useApp } from '../ctx';
import { today, addDays, lastNDays, DAYS_SHORT, dow, fmtDur, parse } from '../lib/date';
import { completeTask } from '../lib/logic';
import { success, tap, isNative } from '../lib/native';
import { sfxFanfare, sfxBlip } from '../lib/sound';
import { Sheet, Toggle } from '../ui/kit';
import { useStudy } from '../screens/Study';
import Tree, { TREES } from './Tree';
import { playAmbient, stopAmbient, SOUNDS } from './ambient';
import './focus.css';

const NOTIF_ID = 777002;
const PRESETS = [15, 25, 45, 60, 90];
const LINES = [[0, 'Your tree is a seed. Stay with it.'], [0.2, 'It’s sprouting.'], [0.45, 'Growing nicely.'], [0.7, 'You’re almost there.'], [0.9, 'Final stretch.']];
const QUOTES = ['Slow is smooth. Smooth is fast.', 'One thing at a time.', 'Breathe. Then begin.', 'Small steps, every day.', 'Attention is the rarest gift.'];
/** A calm sky for the time of day (Tide-like). */
export function sceneFor(h) {
  if (h < 5 || h >= 21) return 'linear-gradient(180deg,#0b1026 0%,#18214a 55%,#2a2550 100%)';
  if (h < 8) return 'linear-gradient(180deg,#2d3a6b 0%,#8b6f9e 55%,#e7b49a 100%)';
  if (h < 17) return 'linear-gradient(180deg,#5d97c9 0%,#9cc7e3 55%,#d8ecf2 100%)';
  return 'linear-gradient(180deg,#2c2f63 0%,#8a5a86 55%,#e39b7b 100%)';
}

export function FocusHub() {
  const { push, settings } = useApp();
  const [mins, setMins] = useState(settings.focusMins || 25);
  const [kind, setKind] = useState(settings.treeKind || 'oak');
  const [what, setWhat] = useState(null); // { taskId } | { study } | null
  const [pick, setPick] = useState(false);
  const t = today();
  const rows = useLiveQuery(() => db.focus.where('date').between(addDays(t, -6), t, true, true).toArray(), [t]) || [];
  const tasks = useLiveQuery(() => db.tasks.filter((x) => !x.done && !x.skipped && (!x.due || x.due <= addDays(t, 1))).toArray(), [t]) || [];
  const study = useStudy();
  const todayRows = rows.filter((r) => r.date === t);
  const todayMin = todayRows.reduce((a, b) => a + b.minutes, 0);
  const weekMin = rows.reduce((a, b) => a + b.minutes, 0);
  const h = new Date().getHours();
  const label = what?.study ? what.study.label : what?.taskId ? tasks.find((x) => x.id === what.taskId)?.title : null;
  const setM = (v) => { tap(); setMins(Math.max(5, Math.min(180, v))); };
  const plant = () => {
    tap('medium');
    setKV('focusMins', mins); setKV('treeKind', kind);
    push('FocusRun', { mins, kind, taskId: what?.taskId || null, study: what?.study || null, label: label || 'Focus' });
  };

  return (
    <div className="screen fh fade-in">
      <div className="fh-sky" style={{ background: sceneFor(h) }}>{(h < 7 || h >= 19) && <i className="fh-stars" />}</div>
      <div className="fh-top">
        <h1>Focus</h1>
        <button className="fh-ic" onClick={() => push('Forest')} aria-label="Your forest"><Trees size={19} /></button>
      </div>

      <div className="fh-stage">
        <div className="fh-ring" style={{ '--p': `${Math.min(1, mins / 120) * 100}` }}>
          <svg viewBox="0 0 260 260"><circle cx="130" cy="130" r="118" className="bg" /><circle cx="130" cy="130" r="118" className="fg" pathLength="100" strokeDasharray={`${Math.min(1, mins / 120) * 100} 100`} /></svg>
          <div className="fh-tree"><Tree kind={kind} g={0.08 + Math.min(1, mins / 90) * 0.92} size={170} /></div>
        </div>
        <div className="fh-time">
          <button onClick={() => setM(mins - 5)} aria-label="Less"><Minus size={20} /></button>
          <b className="num">{String(mins).padStart(2, '0')}:00</b>
          <button onClick={() => setM(mins + 5)} aria-label="More"><Plus size={20} /></button>
        </div>
        <div className="fh-presets">{PRESETS.map((p) => <button key={p} className={p === mins ? 'on' : ''} onClick={() => setM(p)}>{p}</button>)}</div>
      </div>

      <button className="fh-what" onClick={() => setPick(true)}>
        <span className="ic">{what?.study ? <GraduationCap size={16} /> : <CheckSquare size={16} />}</span>
        <span className="grow ellipsis">{label || 'Just focus'}</span>
        <ChevronRight size={16} />
      </button>
      <div className="fh-kinds">
        {TREES.map((k) => <button key={k.k} className={k.k === kind ? 'on' : ''} onClick={() => { tap(); setKind(k.k); }} aria-label={k.l}><Tree kind={k.k} g={1} size={44} /></button>)}
      </div>
      <button className="fh-plant" onClick={plant}>Plant</button>

      <ZenRow />

      <button className="fh-grove" onClick={() => push('Forest')}>
        <div className="row between"><b>Today’s grove</b><span>{fmtDur(todayMin) || '0m'} today · {fmtDur(weekMin) || '0m'} this week</span></div>
        <div className="fh-trees">
          {todayRows.length ? todayRows.map((r) => <Tree key={r.id} kind={r.tree || 'oak'} g={1} dead={!r.completed} size={42} />) : <span className="muted small">Nothing planted yet today.</span>}
        </div>
      </button>
      <button className="fh-breathe" onClick={() => push('ZenMode', {})}><Wind size={18} /><span className="grow"><b>Just breathe</b><small>Zen mode without a timer</small></span><ChevronRight size={16} /></button>

      <Sheet open={pick} onClose={() => setPick(false)} title="What are you focusing on?">
        <div className="list">
          <button className="list-item" onClick={() => { setWhat(null); setPick(false); }}><span className="grow">Just focus</span>{!what && <Check size={16} />}</button>
          {study.ready && study.data.filter((d) => d.s.active !== false && d.next).map((d) => (
            <button key={d.s.sid} className="list-item" onClick={() => { setWhat({ study: { sid: d.s.sid, id: d.next.id, label: `${d.s.title}: ${d.next.title}` } }); setPick(false); }}>
              <GraduationCap size={16} color={d.s.color} /><span className="grow ellipsis">{d.s.title} · {d.next.title}</span>
            </button>
          ))}
          {tasks.slice(0, 30).map((x) => (
            <button key={x.id} className="list-item" onClick={() => { setWhat({ taskId: x.id }); setPick(false); }}>
              <CheckSquare size={16} className="muted" /><span className="grow ellipsis">{x.title}</span>{what?.taskId === x.id && <Check size={16} />}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

function ZenRow() {
  const { settings } = useApp();
  const on = !!settings.zenMode;
  return (
    <div className="fh-zen">
      <div className="row between">
        <div><b>Zen mode</b><small>Full-screen calm scene and ambient sound while you focus</small></div>
        <Toggle on={on} onChange={(v) => setKV('zenMode', v)} />
      </div>
      {on && (
        <div className="fh-sounds">
          {[{ k: 'off', l: 'Silent' }, ...SOUNDS].map((s) => (
            <button key={s.k} className={(settings.zenSound || 'rain') === s.k ? 'on' : ''} onClick={() => { tap(); setKV('zenSound', s.k); }}>{s.l}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The running session. Forest: the tree grows, giving up leaves a withered one. Zen mode: a Tide-like calm screen. */
export function FocusRun({ mins, kind = 'oak', taskId, study, label }) {
  const { pop, settings, celebrate, toast } = useApp();
  const zen = !!settings.zenMode;
  const [start] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [stage, setStage] = useState('run'); // run | done | dead | break
  const [leaves, setLeaves] = useState(0);
  const [sound, setSound] = useState(zen && (settings.zenSound || 'rain') !== 'off');
  const [ui, setUi] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [breakStart, setBreakStart] = useState(0);
  const hiddenAt = useRef(null);
  const uiTimer = useRef();
  const total = mins * 60;
  const elapsed = (now - start) / 1000;
  const left = Math.max(0, total - elapsed);
  const prog = Math.min(1, elapsed / total);
  const task = useLiveQuery(() => (taskId ? db.tasks.get(taskId) : null), [taskId]);

  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(i); }, []);
  useEffect(() => {
    if (isNative) LocalNotifications.schedule({ notifications: [{ id: NOTIF_ID, title: 'Your tree has grown', body: `${mins} minutes of focus. Take a short break.`, schedule: { at: new Date(start + total * 1000), allowWhileIdle: true } }] }).catch(() => {});
    return () => { stopAmbient(); if (isNative) LocalNotifications.cancel({ notifications: [{ id: NOTIF_ID }] }).catch(() => {}); };
  }, []);
  useEffect(() => { if (sound && stage === 'run') playAmbient(settings.zenSound || 'rain', 0.45); else stopAmbient(); }, [sound, stage]);
  useEffect(() => {
    const h = () => {
      if (document.visibilityState === 'hidden') hiddenAt.current = Date.now();
      else if (hiddenAt.current) { if (Date.now() - hiddenAt.current > 8000) setLeaves((l) => l + 1); hiddenAt.current = null; }
    };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, []);
  useEffect(() => { if (stage === 'run' && left <= 0) finish(true); }, [left]);
  // Zen: controls fade away after a few seconds; a tap brings them back
  const wake = () => { setUi(true); clearTimeout(uiTimer.current); if (zen) uiTimer.current = setTimeout(() => setUi(false), 4000); };
  useEffect(() => { wake(); return () => clearTimeout(uiTimer.current); }, []);

  const save = async (completed) => {
    const m = Math.round(elapsed / 60);
    if (m >= 1) await db.focus.add({ date: today(), ts: start, minutes: m, planned: mins, taskId: taskId || null, label, completed, interruptions: leaves, tree: kind, ...(study ? { study: study.sid, nodeId: study.id } : {}) });
  };
  const finish = async (completed) => {
    stopAmbient();
    if (isNative) LocalNotifications.cancel({ notifications: [{ id: NOTIF_ID }] }).catch(() => {});
    await save(completed);
    if (completed) { success(); sfxFanfare(); celebrate(); setStage('done'); } else setStage('dead');
  };

  const mm = Math.floor(left / 60), ss = Math.floor(left % 60);
  const line = [...LINES].reverse().find(([p]) => prog >= p)[1];
  const h = new Date().getHours();

  if (stage === 'done' || stage === 'dead') {
    const ok = stage === 'done';
    return (
      <div className="fr fr-end" style={{ background: sceneFor(h) }}>
        <div className="fr-endbox">
          <div className={`fr-endtree ${ok ? 'grow' : ''}`}><Tree kind={kind} g={ok ? 1 : Math.max(0.2, prog)} dead={!ok} size={200} /></div>
          <h1>{ok ? 'Your tree has grown' : 'Your tree withered'}</h1>
          <p>{ok ? `${mins} minutes of focus${leaves ? ` · stepped away ${leaves}×` : ' · no distractions'}. It’s now in your forest.` : 'It happens. Plant another when you’re ready.'}</p>
        </div>
        <div className="fr-actions">
          {ok && task && !task.done && <button className="fr-btn" onClick={async () => { await completeTask(task, true); toast('Task done'); pop(); }}><Check size={18} /> Mark “{task.title}” done</button>}
          {ok && <button className="fr-btn" onClick={() => { setBreakStart(Date.now()); setStage('break'); }}><Coffee size={18} /> 5-minute break</button>}
          <button className="fr-btn main" onClick={pop}>Done</button>
        </div>
      </div>
    );
  }
  if (stage === 'break') {
    const bl = Math.max(0, 300 - (now - breakStart) / 1000);
    if (bl <= 0) { sfxBlip(660); setTimeout(pop, 50); }
    return (
      <div className="fr zen" style={{ background: sceneFor(h) }}>
        <div className="fr-mid"><div className="zm-orb" /><div className="fr-clock num">{Math.floor(bl / 60)}:{String(Math.floor(bl % 60)).padStart(2, '0')}</div><div className="fr-line">Rest your eyes. Look far away.</div></div>
        <div className="fr-actions"><button className="fr-btn main" onClick={pop}>End break</button></div>
      </div>
    );
  }
  return (
    <div className={`fr ${zen ? 'zen' : 'forest'} ${ui ? '' : 'hide-ui'}`} style={{ background: sceneFor(h) }} onClick={wake}>
      {zen && <i className="fr-fog" />}
      <div className="fr-head">
        <span className="ellipsis">{label}</span>
        {zen && <button className="fr-ic" onClick={(e) => { e.stopPropagation(); setSound(!sound); }} aria-label="Sound">{sound ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>}
      </div>
      <div className="fr-mid">
        {zen ? <div className="zm-orb" /> : (
          <div className="fr-ring">
            <svg viewBox="0 0 280 280"><circle cx="140" cy="140" r="128" className="bg" /><circle cx="140" cy="140" r="128" className="fg" pathLength="100" strokeDasharray={`${prog * 100} 100`} /></svg>
            <div className="fr-tree"><Tree kind={kind} g={0.06 + prog * 0.94} size={190} /></div>
          </div>
        )}
        <div className="fr-clock num">{String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}</div>
        <div className="fr-line">{zen ? QUOTES[Math.floor(start / 1000) % QUOTES.length] : line}</div>
      </div>
      <div className="fr-actions">
        <button className="fr-btn ghost" onClick={(e) => { e.stopPropagation(); setConfirm(true); }}>Give up</button>
      </div>
      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Give up this session?">
        <p className="dim" style={{ marginTop: -6 }}>Your tree will wither. The minutes you did still count.</p>
        <div className="row mt-16"><button className="btn grow" onClick={() => setConfirm(false)}>Keep going</button><button className="btn danger grow" onClick={() => { setConfirm(false); finish(false); }}>Give up</button></div>
      </Sheet>
    </div>
  );
}

/** Zen mode on its own: a calm scene to breathe, no timer. */
export function ZenMode() {
  const { pop, settings } = useApp();
  const [sound, setSound] = useState((settings.zenSound || 'rain') !== 'off');
  const [phase, setPhase] = useState('in');
  const [n, setN] = useState(0);
  useEffect(() => { if (sound) playAmbient(settings.zenSound === 'off' ? 'rain' : settings.zenSound || 'rain', 0.45); else stopAmbient(); }, [sound]);
  useEffect(() => () => stopAmbient(), []);
  useEffect(() => { const seq = { in: ['hold', 4000], hold: ['out', 2000], out: ['in', 6000] }; const tm = setTimeout(() => { setPhase(seq[phase][0]); if (phase === 'out') setN((x) => x + 1); }, seq[phase][1]); return () => clearTimeout(tm); }, [phase]);
  const time = new Date();
  return (
    <div className="fr zen" style={{ background: sceneFor(time.getHours()) }}>
      <i className="fr-fog" />
      <div className="fr-head"><button className="fr-ic" onClick={pop} aria-label="Close"><X size={18} /></button><span /><button className="fr-ic" onClick={() => setSound(!sound)} aria-label="Sound">{sound ? <Volume2 size={18} /> : <VolumeX size={18} />}</button></div>
      <div className="fr-mid">
        <div className={`zm-orb breathe ${phase}`} />
        <div className="fr-line big">{phase === 'in' ? 'Breathe in' : phase === 'hold' ? 'Hold' : 'Breathe out'}</div>
        <div className="fr-line">{n ? `${n} breath${n > 1 ? 's' : ''}` : QUOTES[time.getDate() % QUOTES.length]}</div>
      </div>
      <div className="fr-actions"><div className="fr-clock small num">{time.getHours() % 12 || 12}:{String(time.getMinutes()).padStart(2, '0')}</div></div>
    </div>
  );
}

/** Your forest: every focus session is a tree, by day. */
export function Forest() {
  const { pop } = useApp();
  const [week, setWeek] = useState(0);
  const t = today();
  const end = addDays(t, -7 * week), start = addDays(end, -6);
  const rows = useLiveQuery(() => db.focus.where('date').between(start, end, true, true).toArray(), [start, end]) || [];
  const all = useLiveQuery(() => db.focus.toArray(), []) || [];
  const days = lastNDays(7, end);
  const mins = rows.reduce((a, b) => a + b.minutes, 0);
  const grown = rows.filter((r) => r.completed).length;
  return (
    <div className="screen no-nav page-enter fo">
      <div className="fo-top"><button className="icon-btn ghost" onClick={pop} aria-label="Back"><ChevronLeft size={22} /></button><b>Your forest</b><span style={{ width: 40 }} /></div>
      <div className="fo-week">
        <button className="icon-btn ghost" onClick={() => setWeek(week + 1)} aria-label="Earlier"><ChevronLeft size={18} /></button>
        <span>{week === 0 ? 'This week' : `${parse(start).getDate()}–${parse(end).getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][parse(end).getMonth()]}`}</span>
        <button className="icon-btn ghost" disabled={week === 0} onClick={() => setWeek(Math.max(0, week - 1))} aria-label="Later"><ChevronRight size={18} /></button>
      </div>
      <div className="fo-land">
        {rows.length ? rows.slice(0, 36).map((r, i) => <span key={r.id} style={{ '--i': i }}><Tree kind={r.tree || TREES[i % 4].k} g={1} dead={!r.completed} size={56} /></span>) : <div className="fo-empty">No trees this week yet.</div>}
      </div>
      <div className="fo-stats">
        <div><b className="num">{fmtDur(mins) || '0m'}</b><small>focused</small></div>
        <div><b className="num">{grown}</b><small>trees grown</small></div>
        <div><b className="num">{all.filter((r) => r.completed).length}</b><small>all time</small></div>
      </div>
      <div className="fo-bars">
        {days.map((d) => { const m = rows.filter((r) => r.date === d).reduce((a, b) => a + b.minutes, 0); return <div key={d}><i style={{ height: `${Math.min(100, m / 1.2)}%` }} /><span>{DAYS_SHORT[dow(d)][0]}</span></div>; })}
      </div>
    </div>
  );
}
