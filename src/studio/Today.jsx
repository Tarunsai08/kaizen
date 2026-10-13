// Studio · Today.
// One thing at a time on top (Sunsama-style focus card), the day score, then every to-do exactly once
// (Things-style list) with its planned time as a badge — the full timeline lives in Plan → Day.
import React, { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Star, Moon, Sunrise, Flag, ChevronRight, Plus, GraduationCap, Check, Dumbbell, Phone, Wallet, FlaskConical, Flame, Sparkles, Play, Repeat2, Footprints, CheckSquare, Smile, Coffee } from 'lucide-react';
import { HIcon } from '../ui/icons';
import { db } from '../db';
import { useApp } from '../ctx';
import { today, hmToMin } from '../lib/date';
import { success, tap } from '../lib/native';
import { sfxComplete } from '../lib/sound';
import { dayData, plannerSettings, hm12, startSession, finishSession } from '../planner/service';
import { buildTimeline } from '../screens/planner/PlanToday';
import { useToday } from '../screens/today/useToday';
import { useFlash, Kai } from '../screens/today/shared';
import { QuickEntry } from './QuickEntry';
import './today.css';

const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const PROMPT_ICON = { yesterday: Moon, morning: Sunrise, night: Moon, goals: Flag };
const RING_ICON = { habits: Repeat2, move: Footprints, tasks: CheckSquare, mind: Smile };
const isEvening = (task) => !!task.evening || (task.dueTime && hmToMin(task.dueTime) >= 17 * 60);
const t12 = (m) => hm12(m).replace(':00', '').replace(' ', '').toLowerCase();

export default function StudioToday() {
  const { D, logHabit, toggleTask, openTask, openHabit, go } = useToday();
  const { settings, push } = useApp();
  const [qe, setQe] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const [flash, doFlash] = useFlash(1100);
  const [, tick] = useState(0);
  const order = useRef([]);
  useEffect(() => { const i = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(i); }, []);
  const t = today();
  const plan = useLiveQuery(() => dayData(t, settings), [t, settings.wakeTarget]);
  if (!D) return <div className="screen" />;

  const n = new Date();
  const mins = n.getHours() * 60 + n.getMinutes();
  const sessions = (plan?.sessions || []).filter((s) => s.kind !== 'BREAK' && s.state !== 'SKIPPED').sort((a, b) => a.start - b.start);
  const open = sessions.filter((s) => s.state === 'PLANNED');

  /* ---- one list, each to-do once: its planned time becomes a badge ---- */
  const byTask = new Map();
  open.forEach((s) => { if (s.taskId != null) (byTask.get(s.taskId) || byTask.set(s.taskId, []).get(s.taskId)).push(s); });
  const rows = D.tasks.map((x) => ({ ...x, sess: byTask.get(x.id) || [], time: byTask.get(x.id)?.[0]?.start ?? (x.task.dueTime ? hmToMin(x.task.dueTime) : null) }));
  // planned today but due another day: one row per task (next session), ticking finishes that session
  const shown = new Set(D.tasks.map((x) => x.id));
  [...byTask.entries()].forEach(([taskId, ss]) => {
    if (shown.has(taskId)) return;
    const task = plan.tasks.find((x) => x.id === taskId);
    if (!task || task.done) return;
    rows.push({ key: 's' + ss[0].id, id: taskId, task, title: ss[0].title, done: false, meta: [task.title !== ss[0].title ? task.title : '', ss.length > 1 ? `${ss.length} sessions today` : ''].filter(Boolean), sess: ss, time: ss[0].start, sessionRow: true });
  });
  let list = rows.sort((a, b) => (a.done - b.done) || (a.time ?? 9999) - (b.time ?? 9999));
  // a ticked to-do stays where it was while its check animates, then moves to "completed"
  if (list.some((x) => flash[x.key])) { const pos = new Map(order.current.map((k, i) => [k, i])); list = [...list].sort((a, b) => (pos.get(a.key) ?? 999) - (pos.get(b.key) ?? 999)); }
  else order.current = list.map((x) => x.key);
  // what's in the focus card isn't repeated in the list
  const focusTask = (() => { const r = open.find((s) => s.startedAt) || open.find((s) => s.start <= mins && s.end > mins) || open.find((s) => s.start > mins); return r ? r.taskId : null; })();
  const live = (x) => !x.done || flash[x.key];
  const inList = (x) => !(focusTask != null && x.id === focusTask && !x.done);
  const day = list.filter((x) => live(x) && inList(x) && !isEvening(x.task));
  const eve = list.filter((x) => live(x) && inList(x) && isEvening(x.task));
  const done = list.filter((x) => !live(x));

  const tick1 = async (x) => {
    if (x.sessionRow) { doFlash(x.key); success(); sfxComplete(); await finishSession(x.sess[0].id, 'DONE'); return; }
    if (!x.done) doFlash(x.key);
    await toggleTask(x);
  };
  const doHabit = async (h) => { const r = await logHabit(h); if (r === 'complete' || r === 'step') doFlash(h.key, r); };

  /* ---- the one thing to do now ---- */
  const tl = plan ? buildTimeline(plan, t, plannerSettings(settings)).items : [];
  const busy = tl.find((it) => (it.kind === 'fixed' || it.kind === 'event') && !/sleep/i.test(it.title) && it.start <= mins && it.end > mins);
  const running = open.find((s) => s.startedAt);
  const nowS = running || open.find((s) => s.start <= mins && s.end > mins);
  const nextS = !nowS && open.find((s) => s.start > mins);
  const focusS = nowS || nextS;
  const fallback = !focusS && day.find((x) => !x.done);
  const listDay = fallback ? day.filter((x) => x !== fallback) : day;
  const after = focusS ? open.filter((s) => s.start > focusS.start)[0] : null;
  const startFocus = async (s) => { tap('medium'); await startSession(s.id); push('FocusRun', { mins: Math.max(5, s.end - s.start), kind: settings.treeKind || 'oak', taskId: s.taskId, label: s.title }); };

  const prompt = D.prompts[0];
  const extras = [
    D.workout && !D.workout.done && { k: 'w', i: Dumbbell, c: 'var(--fit)', l: 'Workout', s: D.workout.summary, go: D.workout.go },
    ...D.goals.filter((g) => g.checkinDue).map((g) => ({ k: g.key, i: Flag, c: g.color, l: g.title, s: 'Goal check-in', go: g.go })),
    ...D.people.map((p) => ({ k: p.key, i: Phone, c: p.color, l: `Reach out to ${p.name}`, s: p.sub, go: p.go })),
    ...D.experiments.filter((e) => !e.log).map((e) => ({ k: e.key, i: FlaskConical, c: 'var(--habit)', l: e.title, s: `Experiment · day ${e.day} of ${e.days}`, go: e.go })),
    D.untagged > 0 && settings.modules?.money !== false && { k: 'm', i: Wallet, c: 'var(--money)', l: `${D.untagged} expense${D.untagged > 1 ? 's' : ''} to tag`, s: `${D.spentLabel} spent today`, go: go.money },
  ].filter(Boolean);
  const ringVal = (r) => (r.key === 'habits' ? `${D.day.habitsDone}/${D.day.habitsDue}` : r.key === 'tasks' ? `${D.day.tasksDone}/${D.day.tasksTotal}` : r.value == null ? '—' : `${Math.round(r.value * 100)}%`);

  const todo = (x) => (
    <div key={x.key} className={`st-td ${x.done ? 'done' : ''} ${flash[x.key] ? 'just' : ''}`} onClick={() => (x.sessionRow ? go.plan() : openTask(x))}>
      <button className={`st-cb ${x.prio ? 'p-' + x.prio : ''}`} onClick={(e) => { e.stopPropagation(); tick1(x); }} aria-label={x.done ? 'Mark not done' : 'Mark done'}>
        <svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9" /></svg>
      </button>
      <span className="grow tx">
        <span className="t">{x.study && <GraduationCap size={14} className="st-ic" />}{x.title}</span>
        {(x.meta.length > 0 || x.overdue) && <small>{x.overdue && <em><Flag size={11} fill="currentColor" /> Overdue</em>}{x.meta.join(' · ')}</small>}
      </span>
      {x.time != null && !x.done && <span className={`st-time ${x.time <= mins ? 'now' : ''}`}>{x.time <= mins && x.sess?.length ? 'now' : t12(x.time)}</span>}
    </div>
  );

  return (
    <div className="screen st fade-in">
      <header className="st-top">
        <span className="st-date">{D.weekday}, {D.d.getDate()} {MONTH_LONG[D.d.getMonth()]}</span>
        <button className="st-kai" onClick={go.you} aria-label="You"><Kai D={D} size={34} /><b>{D.xp.level}</b></button>
      </header>
      <h1 className="st-title"><Star size={30} className="star" fill="currentColor" strokeWidth={1.5} /> Today</h1>
      {D.intention && <p className="st-sub"><i>“{D.intention}”</i></p>}

      {/* the day score, a little richer than before */}
      <section className="st-score" onClick={go.you}>
        <div className="ring" style={{ '--p': D.score }}>
          <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" className="bg" /><circle cx="50" cy="50" r="42" className="fg" pathLength="100" strokeDasharray={`${Math.max(0.5, D.score)} 100`} /></svg>
          <b className="num">{D.score}</b><small>score</small>
        </div>
        <div className="grow">
          <div className="st-score-h">{D.allDone ? 'Everything done' : D.score >= 70 ? 'Great day so far' : D.score >= 35 ? 'Good momentum' : 'Let’s get going'}</div>
          <div className="st-chips">
            <span><Flame size={13} /> {D.streak || 0}-day streak</span>
            {D.xp.today > 0 && <span className="xp"><Sparkles size={13} /> +{D.xp.today} XP</span>}
          </div>
          <div className="st-mini">
            {D.rings.map((r) => {
              const I = RING_ICON[r.key] || Check;
              return (
                <div key={r.key} style={{ '--c': r.color }} title={r.label}>
                  <span className="mr"><svg className="r" viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" className="bg" /><circle cx="18" cy="18" r="15" className="fg" pathLength="100" strokeDasharray={`${Math.round((r.value ?? 0) * 100)} 100`} /></svg><I size={13} /></span>
                  <small>{ringVal(r)}</small>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {prompt && (
        <button className="st-prompt" style={{ '--c': `var(--${prompt.tone})` }} onClick={prompt.go}>
          {React.createElement(PROMPT_ICON[prompt.k] || Moon, { size: 18 })}
          <span className="grow"><b>{prompt.title}</b><small>{prompt.sub}</small></span>
          <ChevronRight size={17} />
        </button>
      )}

      {/* one thing at a time */}
      {(focusS || fallback || busy) && (
        <section className={`st-now ${nowS ? 'live' : ''}`}>
          <div className="k">{busy && !nowS ? `In ${busy.title} until ${t12(busy.end)}` : nowS ? (running ? 'Focusing now' : 'Now') : nextS ? `Next · ${t12(nextS.start)}` : 'Up next'}</div>
          {focusS ? (
            <>
              <b className="clamp2">{focusS.title}</b>
              <small>{t12(focusS.start)}–{t12(focusS.end)}{focusS.taskTitle && focusS.taskTitle !== focusS.title ? ` · ${focusS.taskTitle}` : ''}</small>
              <div className="acts">
                <button className="go" onClick={() => startFocus(focusS)}><Play size={16} fill="currentColor" /> {running ? 'Resume focus' : 'Start focus'}</button>
                <button className="ok" onClick={async () => { success(); sfxComplete(); await finishSession(focusS.id, 'DONE'); }} aria-label="Done"><Check size={18} strokeWidth={2.6} /></button>
              </div>
              {after && <div className="after">Then {after.title} at {t12(after.start)}</div>}
            </>
          ) : fallback ? (
            <>
              <b className="clamp2">{fallback.title}</b>
              <small>Nothing scheduled — pick this up when you’re ready</small>
              <div className="acts">
                <button className="go" onClick={() => push('FocusRun', { mins: 25, kind: settings.treeKind || 'oak', taskId: fallback.id, label: fallback.title })}><Play size={16} fill="currentColor" /> Focus 25 min</button>
                <button className="ok" onClick={() => tick1(fallback)} aria-label="Done"><Check size={18} strokeWidth={2.6} /></button>
              </div>
            </>
          ) : <b><Coffee size={18} /> Free until {t12(busy.end)}</b>}
        </section>
      )}

      {/* every to-do, once */}
      <div className="st-h">To-dos<button onClick={go.plan}>Day plan</button></div>
      <div className="st-list">
        {listDay.map(todo)}
        {!listDay.length && !eve.length && !fallback && <div className="st-empty"><Star size={40} strokeWidth={1.2} /><span>{done.length ? 'All done for today.' : 'Nothing on your list.'}</span><button onClick={() => setQe('today')}>Add a to-do</button></div>}
      </div>
      {eve.length > 0 && (
        <>
          <div className="st-h"><Moon size={16} className="moon" fill="currentColor" /> This Evening</div>
          <div className="st-list">{eve.map(todo)}</div>
        </>
      )}
      {done.length > 0 && <button className="st-donebtn" onClick={() => setShowDone(!showDone)}><ChevronRight size={15} style={{ transform: showDone ? 'rotate(90deg)' : 'none', transition: 'transform .3s' }} /> {done.length} completed</button>}
      {showDone && <div className="st-list faded">{done.map(todo)}</div>}

      {D.habits.length > 0 && (
        <>
          <div className="st-h">Habits<button onClick={go.habits}>All</button></div>
          <div className="st-habits">
            {D.habits.map((h) => (
              <div key={h.key} className={`st-hb ${h.done ? 'done' : ''} ${flash[h.key] ? 'flash-' + flash[h.key] : ''}`} style={{ '--c': h.color }}>
                <button className="c" onClick={() => doHabit(h)} aria-label={h.name}>
                  <svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="21" className="bg" /><circle cx="24" cy="24" r="21" className="fg" pathLength="100" strokeDasharray={`${h.prog * 100} 100`} /></svg>
                  <span className="ic">{h.done ? <Check size={18} strokeWidth={3} /> : <HIcon icon={h.icon} size={17} color="currentColor" />}</span>
                </button>
                <button className="n" onClick={() => openHabit(h)}>{h.name}<small>{h.target > 1 ? `${h.amt}/${h.target}` : h.done ? 'done' : 'today'}</small></button>
              </div>
            ))}
          </div>
        </>
      )}

      {extras.length > 0 && (
        <>
          <div className="st-h">Also today</div>
          <div className="st-also">
            {extras.map((e) => (
              <button key={e.k} className="st-al" style={{ '--c': e.c }} onClick={e.go}>
                <span className="ic"><e.i size={15} /></span>
                <span className="grow tx"><b className="ellipsis">{e.l}</b><small className="ellipsis">{e.s}</small></span>
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
        </>
      )}
      <div style={{ height: 30 }} />
      <button className="st-plus" onClick={() => setQe(n.getHours() >= 17 ? 'evening' : 'today')} aria-label="New to-do"><Plus size={28} strokeWidth={2.4} /></button>
      <QuickEntry open={!!qe} when={qe || 'today'} onClose={() => setQe(null)} />
    </div>
  );
}
export { db };
