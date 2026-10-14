// Studio · Today.
// One thing at a time on top (Sunsama-style focus card), the day score, then every to-do exactly once
// (Things-style list) with its planned time as a badge — the full timeline lives in Plan → Day.
import React, { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Star, Moon, Sunrise, Flag, ChevronRight, Plus, GraduationCap, Check, Dumbbell, Phone, Wallet, FlaskConical, Flame, Sparkles, Play, Repeat2, Brain, Wind, Zap, Footprints, CheckSquare, Smile, Coffee } from 'lucide-react';
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
import { personStatus } from '../screens/People';
import './today.css';

const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const PROMPT_ICON = { yesterday: Moon, morning: Sunrise, night: Moon, goals: Flag };
const RING_ICON = { habits: Repeat2, move: Footprints, tasks: CheckSquare, mind: Smile };
const isEvening = (task) => !!task.evening || (task.dueTime && hmToMin(task.dueTime) >= 17 * 60);
const t12 = (m) => hm12(m).replace(':00', '').replace(' ', '').toLowerCase();

export default function StudioToday() {
  const { D, logHabit, toggleTask, openTask, openHabit, go } = useToday();
  const { settings, push } = useApp();
  const setQe = () => push('TaskForm', {});
  const [showDone, setShowDone] = useState(false);
  const [flash, doFlash] = useFlash(1100);
  const [, tick] = useState(0);
  const order = useRef([]);
  useEffect(() => { const i = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(i); }, []);
  const t = today();
  const plan = useLiveQuery(() => dayData(t, settings), [t, settings.wakeTarget]);
  const people = useLiveQuery(async () => {
    const [ps, inter] = await Promise.all([db.people.toArray(), db.interactions.toArray()]);
    const list = ps.map((p) => ({ p, s: personStatus(p, inter) })).sort((a, b) => (b.s.due - a.s.due) || ((b.s.since ?? 999) - (a.s.since ?? 999)));
    return { list: list.slice(0, 6), due: list.filter((x) => x.s.due).length };
  }, []);
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
    rows.push({ key: 's' + ss[0].id, id: taskId, task, title: task.title, done: false, meta: [task.title !== ss[0].title ? ss[0].title : '', ss.length > 1 ? `${ss.length} sessions today` : ''].filter(Boolean), sess: ss, time: ss[0].start, sessionRow: true });
  });
  const PR = { high: 0, medium: 1, low: 2 };
  const deadline = (x) => `${x.task.due || '9999-99-99'} ${x.task.dueTime || '99:99'}`;
  let list = rows.sort((a, b) => (a.done - b.done) || (PR[a.task.priority] ?? 3) - (PR[b.task.priority] ?? 3) || deadline(a).localeCompare(deadline(b)) || (a.time ?? 9999) - (b.time ?? 9999));
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
  const pending = [...listDay, ...eve].filter((x) => !x.done);
  const overdueN = pending.filter((x) => x.overdue).length, highN = pending.filter((x) => x.task.priority === 'high').length;
  const todoSummary = pending.length ? [`${pending.length} left`, overdueN && `${overdueN} overdue`, highN && `${highN} high priority`, done.length && `${done.length} done`].filter(Boolean).join(' · ') : done.length ? `All ${done.length} done` : 'Nothing on your list';
  const after = focusS ? open.filter((s) => s.start > focusS.start)[0] : null;
  const startFocus = async (s) => { tap('medium'); await startSession(s.id); push('FocusRun', { mins: Math.max(5, s.end - s.start), kind: settings.treeKind || 'oak', taskId: s.taskId, label: s.title }); };

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
        <ScoreRing score={D.score} best={D.best} />
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

      {D.prompts.length > 0 && (
        <div className="st-prompts">
          {D.prompts.map((p) => (
            <button key={p.k} className="st-prompt" style={{ '--c': `var(--${p.tone})` }} onClick={p.go}>
              {React.createElement(PROMPT_ICON[p.k] || Moon, { size: 18 })}
              <span className="grow"><b>{p.title}</b><small>{p.sub}</small></span>
              <ChevronRight size={17} />
            </button>
          ))}
        </div>
      )}

      {/* one thing at a time */}
      {(focusS || fallback || busy) && (
        <section className={`st-now ${nowS ? 'live' : ''}`}>
          <div className="k">{busy && !nowS ? `In ${busy.title} until ${t12(busy.end)}` : nowS ? (running ? 'Focusing now' : 'Now') : nextS ? `Next · ${t12(nextS.start)}` : 'Up next'}</div>
          {focusS ? (
            <>
              <b className="clamp2">{focusS.taskTitle || focusS.title}</b>
              {focusS.taskTitle && focusS.taskTitle !== focusS.title && <span className="step">{focusS.title}</span>}
              <small>{t12(focusS.start)}–{t12(focusS.end)}{focusS.part ? ` · part ${focusS.part}` : ''}</small>
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

      {/* habits: one card, rings spread evenly */}
      {D.habits.length > 0 ? (
        <>
        <Lab t="Habits" s={`${D.habits.filter((h) => h.done).length}/${D.habits.length} done`} on={go.habits} />
        <section className="st-card st-habcard">
          <div className={`st-habits ${D.habits.length > 4 ? 'scroll' : ''}`} style={{ '--n': Math.min(4, Math.max(3, D.habits.length)) }}>
            {D.habits.map((h) => (
              <div key={h.key} className={`st-hb ${h.done ? 'done' : ''} ${flash[h.key] ? 'flash-' + flash[h.key] : ''}`} style={{ '--c': h.color }}>
                <button className="c" onClick={() => doHabit(h)} aria-label={h.name}>
                  <svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="21" className="bg" /><circle cx="24" cy="24" r="21" className="fg" pathLength="100" strokeDasharray={`${h.prog * 100} 100`} /></svg>
                  <span className="ic"><HIcon icon={h.icon} size={20} color="currentColor" /></span>
                  <span className="tick"><Check size={12} strokeWidth={3.5} /></span>
                </button>
                <button className="n" onClick={() => openHabit(h)}><span className="ellipsis">{h.name}</span><small>{h.target > 1 ? `${h.amt} of ${h.target}${h.h.unit ? ' ' + h.h.unit : ''}` : h.done ? 'done' : 'today'}</small></button>
              </div>
            ))}
            {D.habits.length < 3 && <div className="st-hb add"><button className="c" onClick={go.addHabit} aria-label="New habit"><span className="ic"><Plus size={20} /></span></button><span className="n"><span>New habit</span></span></div>}
          </div>
        </section>
        </>
      ) : (
        <button className="st-card st-empty-card" onClick={go.addHabit}><span className="ic"><Plus size={18} /></span><span className="grow"><b>Add your first habit</b><small>Something small to repeat every day</small></span></button>
      )}

      {/* every to-do, once */}
      <Lab t="To-dos" s={todoSummary} on={go.plan} a="Plan" />
      {<>
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
      </>}

      {/* goals */}
      {D.goals.length > 0 && (
        <section className="st-quiet">
          <Lab t="Goals" s={`${D.goals.length} active`} on={go.goals} />
          {D.goals.slice(0, 3).map((g) => (
            <button key={g.key} className="st-goal" style={{ '--c': g.color }} onClick={g.go}>
              <span className="grow tx"><b className="ellipsis">{g.title}</b><small>{g.kind} · {g.label}{g.checkinDue ? ' · check in' : ''}</small></span>
              <span className="pb"><i style={{ width: `${Math.round(g.value * 100)}%` }} /></span>
            </button>
          ))}
        </section>
      )}

      {/* study */}
      {settings.modules?.study !== false && D.study && D.study.subjects.length > 0 && (
        <section className="st-quiet">
          <Lab t="Keep learning" s={`${D.study.subjects.reduce((a, x) => a + x.mins, 0)} of ${D.study.subjects.reduce((a, x) => a + x.goal, 0)} min${D.study.streak ? ` · ${D.study.streak}-day streak` : ''}`} on={D.study.all} a="Study" />
          {D.study.subjects.map((sj) => (
            <button key={sj.key} className="st-sj rail" style={{ '--c': sj.color }} onClick={sj.go}>
              <span className="rl" />
              <span className="grow tx"><small>{sj.title}</small><b className="ellipsis">{sj.next}</b></span>
              <span className="mins num">{sj.mins}<small>/{sj.goal}m</small></span>
            </button>
          ))}
          {D.study.due > 0 && <button className="st-rev" onClick={D.study.review}><Brain size={16} /> {D.study.due} card{D.study.due > 1 ? 's' : ''} to revise <ChevronRight size={15} /></button>}
        </section>
      )}

      {/* people */}
      {settings.modules?.people !== false && people && (
        <section className="st-quiet">
          <Lab t="People" s={people.due ? `${people.due} to reach out to` : 'all in touch'} on={() => push('Space', { k: 'people' })} />
          {people.list.length ? (
            <div className="st-people">
              {people.list.map(({ p, s: ps }) => (
                <button key={p.id} className={`st-pp calm ${ps.due ? 'due' : ''}`} onClick={() => push('PersonDetail', { id: p.id })}>
                  <span className="av">{(p.name || '?').slice(0, 1).toUpperCase()}{ps.due && <i />}</span>
                  <b className="ellipsis">{p.name}</b>
                  <small>{ps.since == null ? 'say hi' : ps.since === 0 ? 'today' : `${ps.since}d ago`}</small>
                </button>
              ))}
            </div>
          ) : <button className="st-hint" onClick={() => push('Space', { k: 'people' })}><Phone size={15} /> Add the people you want to stay close to</button>}
        </section>
      )}

      {/* at a glance */}
      <div className="st-glance">
        {D.workout && <Tile c="var(--fit)" I={Dumbbell} k="Move" t={D.workout.done ? 'Workout done' : 'Today’s session'} s={D.workout.summary} on={D.workout.go} />}
        {D.energy && <Tile c="var(--goal)" I={Zap} k="Energy now" t={D.energy.label} s={D.energy.until ? `until ${D.energy.until}` : D.energy.tip} on={() => push('Space', { k: 'health' })} />}
        {settings.modules?.money !== false && <Tile c="var(--money)" I={Wallet} k="Spent today" t={D.spentLabel} s={D.untagged ? `${D.untagged} to tag` : 'all tagged'} on={go.money} />}
        {settings.modules?.boredom !== false && <Tile c="var(--bored)" I={Wind} k="Bored?" t="Pick something" s="on purpose" on={go.bored} />}
        {D.experiments.map((e) => <Tile key={e.key} c="var(--habit)" I={FlaskConical} k="Experiment" t={e.title} s={e.over ? 'review the result' : `day ${e.day} of ${e.days}${e.log ? '' : ' · check in'}`} on={e.go} />)}
        <Tile c="var(--accent)" I={Sparkles} k="Insights" t="Your patterns" s="sleep, mood, money" on={go.insights} />
      </div>
      <div style={{ height: 30 }} />
      <button className="st-plus" onClick={() => setQe(n.getHours() >= 17 ? 'evening' : 'today')} aria-label="New to-do"><Plus size={28} strokeWidth={2.4} /></button>
    </div>
  );
}
/** The day score: gradient arc with a glowing end, tick marks, your best day marked, and a count-up number. */
function ScoreRing({ score, best }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const a = from.current, b = score, t0 = performance.now(), dur = 900;
    let raf;
    const step = (now) => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); setShown(Math.round(a + (b - a) * e)); if (k < 1) raf = requestAnimationFrame(step); else from.current = b; };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [score]);
  const R = 42, ang = (v) => (v / 100) * 2 * Math.PI - Math.PI / 2;
  const end = [50 + R * Math.cos(ang(shown)), 50 + R * Math.sin(ang(shown))];
  const bm = best > score ? [50 + R * Math.cos(ang(best)), 50 + R * Math.sin(ang(best))] : null;
  return (
    <div className="sr">
      <svg viewBox="0 0 100 100">
        <defs>
          <linearGradient id="srg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" className="g1" /><stop offset="1" className="g2" /></linearGradient>
        </defs>
        <circle cx="50" cy="50" r={R} className="bg" />
        <circle cx="50" cy="50" r={R} className="fg" stroke="url(#srg)" pathLength="100" strokeDasharray={`${Math.max(0.6, shown)} 100`} transform="rotate(-90 50 50)" />
        {bm && <circle cx={bm[0]} cy={bm[1]} r="2.2" className="best" />}
        {shown > 0 && <circle cx={end[0]} cy={end[1]} r="4.6" className="knob" />}
      </svg>
      <div className="in"><b className="num">{shown}</b><small>day score</small>{best > score && <em>best {best}</em>}</div>
    </div>
  );
}
function Tile({ c, I, k, t, s, on }) {
  return (
    <button className="st-tile" style={{ '--c': c }} onClick={on}>
      <span className="ic"><I size={16} /></span>
      <small>{k}</small>
      <b className="clamp2">{t}</b>
      {s && <em className="ellipsis">{s}</em>}
    </button>
  );
}
export { db };

/** Quiet section label: TITLE · detail, with a link on the right. */
function Lab({ t, s, on, a = 'All' }) {
  return (
    <div className="st-lab">
      <span>{t}{s ? <em> · {s}</em> : null}</span>
      {on && <button onClick={on}>{a}</button>}
    </div>
  );
}
