import React, { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Plus, Moon, Sunrise, Flag, ChevronRight, Flame, Play, Target, GraduationCap, Utensils, Dumbbell, Calendar, Clock,
  Wallet, Wind, Phone, FlaskConical, Sparkles, Brain, Check, Zap,
} from 'lucide-react';
import { HIcon } from '../../ui/icons';
import { useApp } from '../../ctx';
import { tap } from '../../lib/native';
import { today } from '../../lib/date';
import { dayData, plannerSettings, startSession, hm12 } from '../../planner/service';
import { buildTimeline } from '../planner/PlanToday';
import { useToday } from './useToday';
import { QuickSheet, useFlash, Kai } from './shared';
import '../../zen/today.css';

const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const PROMPT_ICON = { yesterday: Moon, morning: Sunrise, night: Moon, goals: Flag };
const FIXED_ICON = { CLASS: GraduationCap, MEAL: Utensils, GYM: Dumbbell, SLEEP: Moon };

/** Score ring with the number in the middle. */
function Ring({ value, size = 92, stroke = 9, children }) {
  const r = (size - stroke) / 2;
  return (
    <div className="z-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} className="bg" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} className="fg" strokeWidth={stroke} pathLength="100" strokeDasharray={`${Math.max(0.5, value)} 100`} />
      </svg>
      <div className="in">{children}</div>
    </div>
  );
}

/** A tiny dotted path, like a learning trail: done dots, the current step, what comes next. */
function Trail({ done, total }) {
  const cur = Math.min(total - 1, done);
  const start = Math.max(0, Math.min(cur - 2, total - 6));
  const dots = Array.from({ length: Math.min(6, total) }, (_, i) => start + i);
  return (
    <div className="z-trail">
      {dots.map((n, i) => (
        <React.Fragment key={n}>
          {i > 0 && <i className={n <= cur ? 'on' : ''} />}
          <b className={n < cur ? 'done' : n === cur ? 'cur' : ''}>{n < cur ? <Check size={10} strokeWidth={3.5} /> : null}</b>
        </React.Fragment>
      ))}
    </div>
  );
}

export default function TodayZen() {
  const { D, logHabit, toggleTask, openTask, openHabit, go } = useToday();
  const { settings } = useApp();
  const [qa, setQa] = useState(false);
  const [flash, doFlash] = useFlash(1100);
  const [, tick] = useState(0);
  const order = useRef([]);
  useEffect(() => { const i = setInterval(() => tick((x) => x + 1), 60000); return () => clearInterval(i); }, []);
  const t = today();
  const plan = useLiveQuery(() => dayData(t, settings), [t, settings.wakeTarget]);
  const mod = (k) => settings.modules?.[k] !== false;
  if (!D) return <div className="screen" />;

  const n = new Date();
  const mins = n.getHours() * 60 + n.getMinutes();
  const upcoming = plan
    ? buildTimeline(plan, t, plannerSettings(settings)).items
      .filter((it) => it.kind !== 'break' && it.end > mins && !(it.session && it.session.state !== 'PLANNED') && !(it.kind === 'fixed' && /sleep/i.test(it.title)))
      .slice(0, 3)
    : [];
  // a to-do you just ticked stays where it was while its check animates, then settles at the bottom
  let tasks = D.tasks;
  if (D.tasks.some((x) => flash[x.key])) { const pos = new Map(order.current.map((k, i) => [k, i])); tasks = [...D.tasks].sort((a, b) => (pos.get(a.key) ?? 999) - (pos.get(b.key) ?? 999)); }
  else order.current = D.tasks.map((x) => x.key);
  const left = D.items - D.doneItems;
  const segs = [...D.habits.map((h) => ({ k: h.key, c: h.color, on: h.done })), ...D.tasks.map((x) => ({ k: x.key, c: 'var(--accent)', on: x.done }))];
  const hello = D.hour < 5 ? 'Still up' : D.greeting;

  const doHabit = async (h) => { const r = await logHabit(h); if (r === 'complete' || r === 'step') doFlash(h.key, r); };
  const doTask = async (x) => { if (!x.done) doFlash(x.key); await toggleTask(x); };

  return (
    <div className="screen z fade-in">
      {/* greeting */}
      <header className="z-head">
        <div className="grow">
          <div className="z-date">{D.weekday}, {D.d.getDate()} {MONTH_LONG[D.d.getMonth()]}</div>
          <h1 className="z-hello">{hello}{D.name ? ',' : ''}<br /><em>{D.name || 'friend'}</em></h1>
        </div>
        <button className="z-kai" onClick={go.you} aria-label="You">
          <Kai D={D} size={50} />
          <b>{D.xp.level}</b>
        </button>
      </header>
      {D.intention && <p className="z-intent">“{D.intention}”</p>}

      {/* the day at a glance */}
      <section className="z-day">
        <Ring value={D.score}><b className="num">{D.score}</b><small>score</small></Ring>
        <div className="grow">
          <div className="z-count"><b className="num">{D.doneItems}</b><span>/{D.items}</span></div>
          <div className="z-left">{D.items === 0 ? 'A blank page. Add one small thing.' : D.allDone ? 'All done. Rest well.' : `${left} thing${left > 1 ? 's' : ''} left today`}</div>
          <div className="z-segs">{segs.slice(0, 24).map((s) => <i key={s.k} className={s.on ? 'on' : ''} style={{ '--c': s.c }} />)}</div>
          <div className="z-meta">
            <span><Flame size={13} /> {D.streak || 0} day{D.streak === 1 ? '' : 's'}</span>
            {D.xp.today > 0 && <span className="xp">+{D.xp.today} XP</span>}
            {D.energy && <span><Zap size={13} /> {D.energy.label}</span>}
          </div>
        </div>
      </section>
      <div className="z-rings">
        {D.rings.map((r) => (
          <div key={r.key} className="z-mini" style={{ '--c': r.color }}>
            <span className="bar"><i style={{ width: `${Math.round((r.value ?? 0) * 100)}%` }} /></span>
            <span className="l">{r.label}</span>
          </div>
        ))}
      </div>

      {/* morning check-in / night review / close yesterday */}
      {D.prompts.length > 0 && (
        <div className="z-prompts">
          {D.prompts.map((p) => {
            const I = PROMPT_ICON[p.k] || Moon;
            return (
              <button key={p.k} className="z-prompt" style={{ '--c': `var(--${p.tone})` }} onClick={p.go}>
                <span className="ic"><I size={20} /></span>
                <span className="grow"><b>{p.title}</b><small>{p.sub}</small></span>
                <ChevronRight size={18} className="chev" />
              </button>
            );
          })}
        </div>
      )}

      {/* up next, from the day plan */}
      <section className="z-sec">
        <div className="z-sh"><h2>Up next</h2><button onClick={go.plan}>Day plan <ChevronRight size={15} /></button></div>
        {upcoming.length ? (
          <div className="z-agenda">
            {upcoming.map((it, i) => {
              const I = it.kind === 'session' ? Target : it.kind === 'event' ? Calendar : FIXED_ICON[plan.fixed.find((b) => b.title === it.title)?.type] || Clock;
              const live = it.start <= mins;
              const canStart = it.kind === 'session' && i === 0 && !it.session.startedAt;
              return (
                <div key={it.key} className={`z-ag ${live ? 'live' : ''}`} style={{ '--c': it.color }} onClick={go.plan}>
                  <span className="time num">{live ? 'Now' : hm12(it.start).replace(' ', '').toLowerCase()}</span>
                  <span className="cap" style={{ height: Math.min(70, Math.max(42, (it.end - it.start) * 0.7)) }}><I size={17} /></span>
                  <span className="grow body"><b className="ellipsis">{it.title}</b><small className="ellipsis">{hm12(it.start)}–{hm12(it.end)}{it.kind === 'session' && it.sub ? ` · ${it.sub.split(' · ')[0]}` : ''}</small></span>
                  {canStart && <button className="z-play" aria-label="Start" onClick={async (e) => { e.stopPropagation(); tap(); await startSession(it.session.id); }}><Play size={16} fill="currentColor" /></button>}
                  {it.session?.startedAt && <span className="z-live">On it</span>}
                </div>
              );
            })}
          </div>
        ) : <div className="z-calm">Nothing planned right now. The time is yours.</div>}
      </section>

      {/* habits: tap the circle to log, it fills like a growing ring */}
      {D.habits.length > 0 && (
        <section className="z-sec">
          <div className="z-sh"><h2>Habits</h2><button onClick={go.habits}>All <ChevronRight size={15} /></button></div>
          <div className="z-habits">
            {D.habits.map((h) => (
              <div key={h.key} className={`z-hb ${h.done ? 'done' : ''} ${flash[h.key] ? 'flash-' + flash[h.key] : ''}`} style={{ '--c': h.color }}>
                <button className="c" onClick={() => doHabit(h)} aria-label={h.name}>
                  <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="29" className="bg" /><circle cx="32" cy="32" r="29" className="fg" pathLength="100" strokeDasharray={`${h.prog * 100} 100`} /></svg>
                  <span className="ic">{h.done ? <Check size={24} strokeWidth={3} /> : <HIcon icon={h.icon} size={22} color="currentColor" />}</span>
                  {flash[h.key] === 'complete' && <span className="z-burst">{Array.from({ length: 10 }, (_, j) => <i key={j} style={{ '--a': `${j * 36}deg` }} />)}</span>}
                </button>
                <button className="n" onClick={() => openHabit(h)}><span className="ellipsis">{h.name}</span><small>{h.target > 1 ? `${h.amt}/${h.target}` : h.done ? 'done' : 'today'}</small></button>
              </div>
            ))}
            <div className="z-hb add"><button className="c" onClick={go.addHabit} aria-label="New habit"><span className="ic"><Plus size={22} /></span></button><span className="n"><span>New</span></span></div>
          </div>
        </section>
      )}

      {/* to-dos, Things-style */}
      <section className="z-sec">
        <div className="z-sh"><h2>To-dos</h2><button onClick={go.plan}>Tasks <ChevronRight size={15} /></button></div>
        <div className="z-todo">
          {tasks.map((x) => (
            <div key={x.key} className={`z-td ${x.done ? 'done' : ''} ${flash[x.key] ? 'just' : ''}`} onClick={() => openTask(x)}>
              <button className={`z-cb ${x.prio ? 'p-' + x.prio : ''}`} onClick={(e) => { e.stopPropagation(); doTask(x); }} aria-label={x.done ? 'Mark not done' : 'Mark done'}>
                <svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9" /></svg>
              </button>
              <span className="grow tx">
                <span className="t">{x.study && <GraduationCap size={14} className="st" />}{x.title}</span>
                {(x.meta.length > 0 || x.overdue) && <small>{x.overdue && <em>Overdue</em>}{x.meta.join(' · ')}</small>}
              </span>
            </div>
          ))}
          <button className="z-td add" onClick={go.addTask}><span className="z-cb plus"><Plus size={15} /></span><span className="tx">New to-do</span></button>
        </div>
      </section>

      {/* learning paths */}
      {mod('study') && D.study && D.study.subjects.length > 0 && (
        <section className="z-sec">
          <div className="z-sh"><h2>Keep learning</h2><button onClick={D.study.all}>Roadmaps <ChevronRight size={15} /></button></div>
          <div className="z-learn">
            {D.study.subjects.map((s) => (
              <button key={s.key} className="z-ln" style={{ '--c': s.color }} onClick={s.go}>
                <div className="top"><span className="ic"><HIcon icon={s.icon} size={18} color="currentColor" /></span><span className="k grow ellipsis">{s.title}</span><span className="pct num">{Math.round(s.overall * 100)}%</span></div>
                <Trail done={s.doneN} total={Math.max(1, s.totalN)} />
                <div className="nx">Up next</div>
                <div className="t clamp2">{s.next}</div>
                <div className="ft"><span className="num">{s.mins}/{s.goal} min</span><span className="go">Continue</span></div>
                <span className="fill" style={{ width: `${s.prog * 100}%` }} />
              </button>
            ))}
            {D.study.due > 0 && (
              <button className="z-ln rev" style={{ '--c': 'var(--task)' }} onClick={D.study.review}>
                <div className="top"><span className="ic"><Brain size={18} /></span><span className="k grow">Revise</span></div>
                <div className="z-bign num">{D.study.due}</div>
                <div className="t">card{D.study.due > 1 ? 's' : ''} due for review</div>
                <div className="ft"><span>spaced repetition</span><span className="go">Start</span></div>
              </button>
            )}
          </div>
        </section>
      )}

      {/* everything else, at a glance */}
      <section className="z-sec">
        <div className="z-sh"><h2>Around your day</h2></div>
        <div className="z-tiles">
          {D.workout && <Tile c="var(--fit)" I={Dumbbell} k="Move" t={D.workout.done ? 'Workout done' : 'Today’s session'} s={D.workout.summary} on={D.workout.go} done={D.workout.done} />}
          {mod('money') && <Tile c="var(--money)" I={Wallet} k="Spent today" t={D.spentLabel} s={D.untagged ? `${D.untagged} to tag` : 'All tagged'} on={go.money} />}
          {D.goals.map((g) => <Tile key={g.key} c={g.color} I={Flag} k={g.kind} t={g.title} s={`${g.label} · ${g.left}`} bar={g.value} on={g.go} />)}
          {D.people.map((p) => <Tile key={p.key} c={p.color} I={Phone} k="Reach out" t={p.name} s={p.sub} on={p.go} />)}
          {D.experiments.map((e) => <Tile key={e.key} c="var(--habit)" I={FlaskConical} k="Experiment" t={e.title} s={e.over ? 'Review the result' : `Day ${e.day} of ${e.days}`} on={e.go} />)}
          {mod('boredom') && <Tile c="var(--bored)" I={Wind} k="Bored?" t="Pick something" s="on purpose" on={go.bored} />}
          <Tile c="var(--accent)" I={Sparkles} k="Insights" t="Your patterns" s="Sleep, mood, money" on={go.insights} />
        </div>
      </section>

      <div className="z-foot">{D.allDone ? 'A good day. See you tomorrow.' : 'Small steps, every day.'}</div>

      <button className="fab" onClick={() => setQa(true)} aria-label="Quick add"><Plus size={28} strokeWidth={2.4} /></button>
      <QuickSheet open={qa} onClose={() => setQa(false)} t={D.t} skin="zen" />
    </div>
  );
}

function Tile({ c, I, k, t, s, on, bar, done }) {
  return (
    <button className={`z-tile ${done ? 'done' : ''}`} style={{ '--c': c }} onClick={on}>
      <span className="ic"><I size={17} /></span>
      <span className="k">{k}</span>
      <span className="t clamp2">{t}</span>
      {bar != null && <span className="b"><i style={{ width: `${Math.round(bar * 100)}%` }} /></span>}
      {s && <span className="s ellipsis">{s}</span>}
    </button>
  );
}
