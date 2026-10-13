// Studio · Today — a Things-style "Today" list with Structured's schedule on top.
import React, { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Star, Moon, Sunrise, Flag, ChevronRight, Plus, GraduationCap, Check, Dumbbell, Phone, Wallet, FlaskConical, Calendar, Clock, Target, Utensils, ChevronDown } from 'lucide-react';
import { HIcon } from '../ui/icons';
import { useApp } from '../ctx';
import { today, hmToMin } from '../lib/date';
import { dayData, plannerSettings, hm12 } from '../planner/service';
import { buildTimeline } from '../screens/planner/PlanToday';
import { useToday } from '../screens/today/useToday';
import { useFlash, Kai } from '../screens/today/shared';
import { QuickEntry } from './QuickEntry';
import './today.css';

const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const PROMPT_ICON = { yesterday: Moon, morning: Sunrise, night: Moon, goals: Flag };
const FIXED_ICON = { CLASS: GraduationCap, MEAL: Utensils, GYM: Dumbbell, SLEEP: Moon };
const isEvening = (task) => !!task.evening || (task.dueTime && hmToMin(task.dueTime) >= 17 * 60);

export default function StudioToday() {
  const { D, logHabit, toggleTask, openTask, openHabit, go } = useToday();
  const { settings } = useApp();
  const [qe, setQe] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const [flash, doFlash] = useFlash(1100);
  const [, tick] = useState(0);
  const order = useRef([]);
  useEffect(() => { const i = setInterval(() => tick((x) => x + 1), 60000); return () => clearInterval(i); }, []);
  const t = today();
  const plan = useLiveQuery(() => dayData(t, settings), [t, settings.wakeTarget]);
  if (!D) return <div className="screen" />;

  const n = new Date();
  const mins = n.getHours() * 60 + n.getMinutes();
  const sched = plan
    ? buildTimeline(plan, t, plannerSettings(settings)).items
      .filter((it) => it.kind !== 'break' && it.end > mins && !(it.session && it.session.state !== 'PLANNED') && !(it.kind === 'fixed' && /sleep/i.test(it.title)))
      .slice(0, 4)
    : [];

  // a ticked to-do stays in place while its check animates, then moves to "completed"
  let tasks = D.tasks;
  if (D.tasks.some((x) => flash[x.key])) { const pos = new Map(order.current.map((k, i) => [k, i])); tasks = [...D.tasks].sort((a, b) => (pos.get(a.key) ?? 999) - (pos.get(b.key) ?? 999)); }
  else order.current = D.tasks.map((x) => x.key);
  const live = (x) => !x.done || flash[x.key];
  const day = tasks.filter((x) => live(x) && !isEvening(x.task));
  const eve = tasks.filter((x) => live(x) && isEvening(x.task));
  const done = tasks.filter((x) => !live(x));
  const doTask = async (x) => { if (!x.done) doFlash(x.key); await toggleTask(x); };
  const doHabit = async (h) => { const r = await logHabit(h); if (r === 'complete' || r === 'step') doFlash(h.key, r); };
  const prompt = D.prompts[0];
  const extras = [
    D.workout && !D.workout.done && { k: 'w', i: Dumbbell, c: 'var(--fit)', l: 'Workout', s: D.workout.summary, go: D.workout.go },
    ...D.goals.filter((g) => g.checkinDue).map((g) => ({ k: g.key, i: Flag, c: g.color, l: g.title, s: 'Goal check-in', go: g.go })),
    ...D.people.map((p) => ({ k: p.key, i: Phone, c: p.color, l: `Reach out to ${p.name}`, s: p.sub, go: p.go })),
    ...D.experiments.filter((e) => !e.log).map((e) => ({ k: e.key, i: FlaskConical, c: 'var(--habit)', l: e.title, s: `Experiment · day ${e.day} of ${e.days}`, go: e.go })),
    D.untagged > 0 && settings.modules?.money !== false && { k: 'm', i: Wallet, c: 'var(--money)', l: `${D.untagged} expense${D.untagged > 1 ? 's' : ''} to tag`, s: `${D.spentLabel} spent today`, go: go.money },
  ].filter(Boolean);

  const todo = (x) => (
    <div key={x.key} className={`st-td ${x.done ? 'done' : ''} ${flash[x.key] ? 'just' : ''}`} onClick={() => openTask(x)}>
      <button className={`st-cb ${x.prio ? 'p-' + x.prio : ''}`} onClick={(e) => { e.stopPropagation(); doTask(x); }} aria-label={x.done ? 'Mark not done' : 'Mark done'}>
        <svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9" /></svg>
      </button>
      <span className="grow tx">
        <span className="t">{x.study && <GraduationCap size={14} className="st-ic" />}{x.title}</span>
        {(x.meta.length > 0 || x.overdue) && <small>{x.overdue && <em><Flag size={11} fill="currentColor" /> Overdue</em>}{x.meta.join(' · ')}</small>}
      </span>
    </div>
  );

  return (
    <div className="screen st fade-in">
      <header className="st-top">
        <span className="st-date">{D.weekday}, {D.d.getDate()} {MONTH_LONG[D.d.getMonth()]}</span>
        <button className="st-kai" onClick={go.you} aria-label="You"><Kai D={D} size={34} /><b>{D.xp.level}</b></button>
      </header>
      <h1 className="st-title"><Star size={30} className="star" fill="currentColor" strokeWidth={1.5} /> Today</h1>
      <p className="st-sub">{D.intention ? <i>“{D.intention}”</i> : D.items ? `${D.doneItems} of ${D.items} done · day score ${D.score}` : 'A fresh page. Add one small thing.'}</p>

      {prompt && (
        <button className="st-prompt" style={{ '--c': `var(--${prompt.tone})` }} onClick={prompt.go}>
          {React.createElement(PROMPT_ICON[prompt.k] || Moon, { size: 18 })}
          <span className="grow"><b>{prompt.title}</b><small>{prompt.sub}</small></span>
          <ChevronRight size={17} />
        </button>
      )}

      {/* schedule, Structured-style: colour bar, time, title */}
      {sched.length > 0 && (
        <div className="st-sched" onClick={go.plan}>
          {sched.map((it) => {
            const I = it.kind === 'session' ? Target : it.kind === 'event' ? Calendar : FIXED_ICON[plan.fixed.find((b) => b.title === it.title)?.type] || Clock;
            const nowOn = it.start <= mins;
            return (
              <div key={it.key} className={`st-ev ${nowOn ? 'now' : ''}`} style={{ '--c': it.color }}>
                <i className="bar" />
                <span className="tm num">{nowOn ? 'Now' : hm12(it.start).replace(':00', '').replace(' ', '').toLowerCase()}</span>
                <I size={14} className="ic" />
                <span className="grow ellipsis">{it.title}</span>
                <span className="len num">{Math.round((it.end - it.start) / 5) * 5}m</span>
              </div>
            );
          })}
          <div className="st-ev more">Open the day plan <ChevronRight size={14} /></div>
        </div>
      )}

      {/* to-dos */}
      <div className="st-list">
        {day.map((x) => todo(x))}
        {!day.length && !eve.length && <div className="st-empty"><Star size={40} strokeWidth={1.2} /><span>{done.length ? 'All done for today.' : 'Nothing on your list.'}</span><button onClick={() => setQe('today')}>Add a to-do</button></div>}
      </div>

      {eve.length > 0 && (
        <>
          <div className="st-h"><Moon size={16} className="moon" fill="currentColor" /> This Evening</div>
          <div className="st-list">{eve.map((x) => todo(x))}</div>
        </>
      )}

      {done.length > 0 && (
        <button className="st-donebtn" onClick={() => setShowDone(!showDone)}>
          <ChevronDown size={15} style={{ transform: showDone ? 'rotate(180deg)' : 'none', transition: 'transform .3s' }} /> {done.length} completed
        </button>
      )}
      {showDone && <div className="st-list faded">{done.map((x) => todo(x))}</div>}

      {/* habits: small rings, tap to fill */}
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

      <div className="st-foot">
        <span className="ring" style={{ '--p': `${D.score}%` }}><b className="num">{D.score}</b></span>
        <span>{D.allDone ? 'Everything done. Rest well.' : `Day score · ${D.streak || 0}-day streak${D.xp.today ? ` · +${D.xp.today} XP` : ''}`}</span>
      </div>

      <button className="st-plus" onClick={() => setQe(n.getHours() >= 17 ? 'evening' : 'today')} aria-label="New to-do"><Plus size={28} strokeWidth={2.4} /></button>
      <QuickEntry open={!!qe} when={qe || 'today'} onClose={() => setQe(null)} />
    </div>
  );
}
