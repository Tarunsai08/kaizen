import React, { useEffect, useRef, useState } from 'react';
import { Check, Plus, ChevronRight, Radio, Telescope, Rocket, Wallet, Wind, Sparkles, Brain, Zap, Flame, Snowflake, FlaskConical } from 'lucide-react';
import { HIcon } from '../../ui/icons';
import { sfxWhoosh, sfxArrive, sfxComplete } from '../../lib/sound';
import { fmtHM } from '../../lib/date';
import { useToday } from './useToday';
import { QuickSheet, useFlash, Kai, countDone } from './shared';
import './orbit.css';

const RINGS = [0.56, 0.8, 1];
const ORBIT_OF = [1, 2, 0, 1, 2, 0, 2, 1];
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

/** Animated solar system: planets move on ellipses (direct DOM writes, no re-renders). */
function System({ D, planets, onPlanet }) {
  const box = useRef(null);
  const refs = useRef([]);
  useEffect(() => {
    let raf, t0 = performance.now();
    const step = (now) => {
      const el = box.current;
      if (el && !document.hidden) {
        const W = el.clientWidth, H = el.clientHeight, cx = W / 2, cy = H * 0.52;
        planets.forEach((p, i) => {
          const n = refs.current[i]; if (!n) return;
          const a = p.phase + ((now - t0) / 1000) * p.speed;
          const rx = (W / 2 - 30) * p.r, ry = rx * 0.52;
          const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
          const depth = (Math.sin(a) + 1) / 2; // 0 back .. 1 front
          const s = 0.72 + depth * 0.42;
          n.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${s})`;
          n.style.zIndex = depth > 0.5 ? 5 : 1;
          n.style.opacity = 0.62 + depth * 0.38;
        });
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [planets.length]);
  const glow = 0.25 + (D.score / 100) * 0.75;
  return (
    <div className="o-sys" ref={box}>
      {RINGS.map((r) => <span key={r} className="o-ring" style={{ width: `calc((100% - 60px) * ${r})`, height: `calc((100% - 60px) * ${r} * .52)` }} />)}
      <button className="o-sun" onClick={() => onPlanet(null)} style={{ '--g': glow }} aria-label="Day score">
        <span className="o-corona" />
        <b className="num">{D.score}</b><small>day score</small>
      </button>
      {planets.map((p, i) => (
        <button key={p.k} ref={(n) => (refs.current[i] = n)} className={`o-planet ${p.full ? 'full' : ''}`} style={{ '--pc': p.color, '--ps': `${p.size}px` }} onClick={() => onPlanet(p.k)} aria-label={p.label}>
          <span className="o-ball"><svg viewBox="0 0 40 40" className="rg"><circle cx="20" cy="20" r="18.5" pathLength="1" className={p.value ? '' : 'zero'} strokeDasharray={`${p.value} 1`} /></svg>{p.ring && <span className="o-saturn" />}</span>
          <span className="o-plabel">{p.label}{p.count ? <em>{p.count}</em> : null}</span>
        </button>
      ))}
      {D.prompts[0] && (
        <button className="o-comet" onClick={D.prompts[0].go}><i /><span>{D.prompts[0].title}</span></button>
      )}
    </div>
  );
}

function PHead({ id, color, title, stat, link, onLink, ring }) {
  return (
    <div className="o-phead" id={id}>
      <span className="o-mini" style={{ '--pc': color }}>{ring && <i />}</span>
      <span className="o-ph-t">{title}</span>
      {stat && <span className="o-ph-s">{stat}</span>}
      <span className="grow" />
      {link && <button className="o-ph-l" onClick={onLink}>{link}<ChevronRight size={13} /></button>}
    </div>
  );
}

export default function TodayOrbit() {
  const { D, logHabit, toggleTask, openTask, openHabit, go } = useToday();
  const [fx, flash] = useFlash(1000);
  const [qa, setQa] = useState(false);
  const [hl, setHl] = useState(null);
  const scr = useRef(null);
  if (!D) return <div className="screen lx lx-orbit" />;

  const planets = [
    { k: 'habits', label: 'Habits', color: 'var(--habit)', value: D.habits.length ? avg(D.habits.map((x) => x.prog)) : 0, count: D.habits.length ? `${countDone(D.habits)}/${D.habits.length}` : '', size: 34 },
    { k: 'tasks', label: 'Tasks', color: 'var(--task)', value: D.tasks.length ? countDone(D.tasks) / D.tasks.length : 0, count: D.tasks.length ? `${countDone(D.tasks)}/${D.tasks.length}` : '', size: 30 },
    D.goals.length && { k: 'goals', label: 'Goals', color: 'var(--goal)', value: avg(D.goals.map((g) => g.value)), count: `${D.goals.length}`, size: 38, ring: true },
    D.study && { k: 'study', label: 'Study', color: '#60a5fa', value: D.study.subjects.length ? avg(D.study.subjects.map((s) => s.prog)) : 0, count: D.study.due ? `${D.study.due}↺` : '', size: 28 },
    D.workout && { k: 'move', label: 'Move', color: 'var(--fit)', value: D.workout.done ? 1 : 0, size: 24 },
    D.experiments.length && { k: 'lab', label: 'Lab', color: 'var(--mood)', value: avg(D.experiments.map((e) => (e.log ? 1 : 0))), size: 20 },
    D.people.length && { k: 'comms', label: 'People', color: '#fb7185', value: 0, count: `${D.people.length}`, size: 20 },
    { k: 'money', label: 'Money', color: 'var(--money)', value: 0, size: 22 },
  ].filter(Boolean).map((p, i, arr) => ({ ...p, full: p.value >= 1, r: RINGS[ORBIT_OF[i % 8]], phase: (i / arr.length) * Math.PI * 2 + ORBIT_OF[i % 8], speed: [0.2, 0.13, 0.085][ORBIT_OF[i % 8]] * (i % 2 ? 1 : 1.15) }));

  const onPlanet = (k) => {
    sfxWhoosh();
    if (!k) { scr.current?.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const el = document.getElementById(`o-${k}`);
    if (el && scr.current) scr.current.scrollTo({ top: el.offsetTop - 12, behavior: 'smooth' });
    setHl(k); setTimeout(() => setHl(null), 1600);
  };
  const onHabit = async (x) => {
    const r = await logHabit(x, { sfx: () => { sfxArrive(); setTimeout(sfxComplete, 90); } });
    if (r === 'complete' || r === 'step') flash(x.key, r);
  };
  const onTask = async (x) => { const r = await toggleTask(x, { sfx: sfxArrive }); if (r === 'complete') flash(x.key); };
  const sec = (k) => `o-sec ${hl === k ? 'hl' : ''}`;

  return (
    <div className="screen fade-in lx lx-orbit" ref={scr}>
      <header className="o-top">
        <div style={{ minWidth: 0 }}>
          <div className="o-eyebrow">{D.dateLabel}</div>
          <h1 className="o-title">{D.allDone ? 'All systems aligned' : D.greeting}{D.name && !D.allDone ? `, ${D.name}` : ''}</h1>
        </div>
        <button className="o-helmet" onClick={go.you} aria-label="You"><span><Kai D={D} size={40} /></span><b>{D.xp.level}</b></button>
      </header>

      <System D={D} planets={planets} onPlanet={onPlanet} />

      <div className="o-hud">
        <span><Sparkles size={13} /> +{D.xp.today} XP</span>
        {D.streak > 1 && <span><Flame size={13} /> {D.streak}d orbit</span>}
        {D.restDay && <span><Snowflake size={13} /> rest</span>}
        {D.energy && <span className="grow-ellipsis"><Zap size={13} /> {D.energy.label}{D.energy.until ? ` · ${D.energy.until}` : ''}</span>}
      </div>

      {D.intention && (
        <div className="o-trans">
          <Radio size={16} className="o-blink" />
          <div><small>Incoming transmission</small><p>{D.intention}</p></div>
        </div>
      )}

      {D.prompts.length > 0 && (
        <div className="o-signals">
          {D.prompts.map((p) => (
            <button key={p.k} className="o-signal" onClick={p.go} style={{ '--sc': `var(--${p.tone})` }}>
              <span className="o-pulse" />
              <span className="grow" style={{ minWidth: 0 }}><b>{p.title}</b><small>{p.sub}</small></span>
              <ChevronRight size={16} />
            </button>
          ))}
        </div>
      )}

      {/* trajectory (now / next) */}
      <section className="o-sec">
        <PHead color="#e2e8f0" title="Trajectory" link="Plan" onLink={go.plan} />
        <button className="o-traj" onClick={go.plan}>
          {D.agenda.length ? (
            <div className="o-traj-row">
              {D.agenda.map((a) => (
                <div key={a.key} className={`o-node ${a.when === 'Now' ? 'now' : ''}`} style={{ '--nc': a.color }}>
                  <span className="o-node-dot"><HIcon icon={a.icon} size={14} color="currentColor" /></span>
                  <small>{a.when === 'Now' ? 'Now' : fmtHM(a.start)}</small>
                  <b>{a.title}</b>
                </div>
              ))}
            </div>
          ) : <div className="o-none">Clear skies — nothing else planned today.</div>}
          {D.energy?.tip && <div className="o-tip"><Zap size={12} /> {D.energy.tip}</div>}
        </button>
      </section>

      {/* habits = moons */}
      <section className={sec('habits')}>
        <PHead id="o-habits" color="var(--habit)" title="Habits" stat={D.habits.length ? `${countDone(D.habits)} of ${D.habits.length} moons lit` : ''} link="Manage" onLink={go.habits} />
        {D.habits.length ? (
          <div className="o-moons">
            {D.habits.map((x) => (
              <div key={x.key} className={`o-moon ${x.done ? 'lit' : ''} ${fx[x.key] ? 'opop' : ''}`} style={{ '--mc': x.color }}>
                <button className="o-moon-ball" onClick={() => onHabit(x)} aria-label={x.name}>
                  <svg viewBox="0 0 60 60" className="rg"><circle className="trk" cx="30" cy="30" r="27" /><circle className={`arc ${x.prog ? '' : 'zero'}`} cx="30" cy="30" r="27" pathLength="1" strokeDasharray={`${x.prog} 1`} /></svg>
                  <span className="o-moon-core">{x.done ? <Check size={20} strokeWidth={3} /> : <HIcon icon={x.icon} size={20} color="currentColor" />}</span>
                  {fx[x.key] && <span className="o-flare" />}
                </button>
                <button className="o-moon-n" onClick={() => openHabit(x)}><b className="ellipsis">{x.name}</b><small className="ellipsis">{x.sub}</small></button>
              </div>
            ))}
          </div>
        ) : <button className="o-add" onClick={go.addHabit}><Plus size={16} /> Add your first habit</button>}
      </section>

      {/* tasks = satellites */}
      <section className={sec('tasks')}>
        <PHead id="o-tasks" color="var(--task)" title="Tasks" stat={D.tasks.length ? `${countDone(D.tasks)}/${D.tasks.length} done` : ''} link="Plan" onLink={go.plan} />
        <div className="o-glass">
          {D.tasks.map((x) => (
            <div key={x.key} className={`o-sat ${x.done ? 'done' : ''} ${fx[x.key] ? 'opop' : ''}`} onClick={() => openTask(x)}>
              <button className="o-sat-chk" onClick={(e) => { e.stopPropagation(); onTask(x); }} aria-label="Complete">
                {x.done ? <Check size={14} strokeWidth={3} /> : <i />}
              </button>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="o-sat-t ellipsis">{x.title}</div>
                {(x.overdue || x.meta.length || x.prio) ? <div className="o-sat-m">{x.prio && <span className={`o-prio ${x.prio}`}>{x.prio}</span>}{x.overdue && <span className="o-late">overdue</span>}{x.meta.map((m) => <span key={m}>{m}</span>)}</div> : null}
              </div>
            </div>
          ))}
          <button className="o-sat add" onClick={go.addTask}><span className="o-sat-chk ghost"><Plus size={14} /></span><span className="o-sat-t">{D.tasks.length ? 'Add task' : 'Nothing due today — add a task'}</span></button>
        </div>
      </section>

      {/* people */}
      {D.people.length > 0 && (
        <section className={sec('comms')}>
          <PHead id="o-comms" color="#fb7185" title="People" stat="time to reach out" />
          <div className="o-comms">
            {D.people.map((p) => (
              <button key={p.key} className="o-comm" onClick={p.go} style={{ '--ac': p.color }}>
                <span className="o-comm-av">{p.name.trim()[0]?.toUpperCase()}<i /></span>
                <b className="ellipsis">{p.name}</b><small>{p.sub}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* goals */}
      {D.goals.length > 0 && (
        <section className={sec('goals')}>
          <PHead id="o-goals" color="var(--goal)" ring title="Goals" link="All" onLink={go.goals} />
          <div className="o-goals">
            {D.goals.map((g) => (
              <button key={g.key} className="o-goal" onClick={g.go} style={{ '--gc': g.color }}>
                <svg viewBox="0 0 100 56" className="o-arc"><path d="M8 52 A42 42 0 0 1 92 52" className="trk" /><path d="M8 52 A42 42 0 0 1 92 52" className={`val ${g.value ? '' : 'zero'}`} pathLength="1" strokeDasharray={`${g.value} 1`} /></svg>
                <b className="o-goal-p num">{Math.round(g.value * 100)}%</b>
                <span className="o-goal-t">{g.title}</span>
                <small>{g.kind} · {g.left}{g.checkinDue ? ' · check in' : ''}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* study */}
      {D.study && (
        <section className={sec('study')}>
          <PHead id="o-study" color="#60a5fa" title="Study" stat={D.study.streak ? `${D.study.streak}-day streak` : ''} link="Roadmaps" onLink={D.study.all} />
          <div className="o-glass">
            {D.study.subjects.map((s) => (
              <button key={s.key} className="o-station" onClick={s.go} style={{ '--tc': s.color }}>
                <span className="o-st-ring"><svg viewBox="0 0 44 44" className="rg"><circle cx="22" cy="22" r="19" className="trk" /><circle cx="22" cy="22" r="19" className={`val ${s.prog ? '' : 'zero'}`} pathLength="1" strokeDasharray={`${s.prog} 1`} /></svg><HIcon icon={s.icon} size={16} color="currentColor" /></span>
                <span className="grow" style={{ minWidth: 0 }}><small>{s.title} · {s.mins ? `${s.mins}/${s.goal} min` : `${s.goal} min goal`}</small><b className="ellipsis">{s.next}</b></span>
                <ChevronRight size={16} className="o-dim" />
              </button>
            ))}
            {D.study.due > 0 && (
              <button className="o-station" onClick={D.study.review} style={{ '--tc': 'var(--task)' }}>
                <span className="o-st-ring"><Brain size={17} /></span>
                <span className="grow"><small>Spaced review</small><b>{D.study.due} card{D.study.due > 1 ? 's' : ''} to revise</b></span>
                <ChevronRight size={16} className="o-dim" />
              </button>
            )}
          </div>
        </section>
      )}

      {/* workout */}
      {D.workout && (
        <section className={sec('move')}>
          <PHead id="o-move" color="var(--fit)" title="Move" />
          <button className={`o-launch ${D.workout.done ? 'done' : ''}`} onClick={D.workout.go}>
            <Rocket size={22} className="o-launch-ic" />
            <span className="grow" style={{ minWidth: 0 }}><b>{D.workout.done ? 'Workout done' : 'Today’s session'}</b><small className="ellipsis">{D.workout.summary}</small></span>
            <span className="o-launch-b">{D.workout.done ? <Check size={16} /> : 'Start'}</span>
          </button>
        </section>
      )}

      {/* experiments */}
      {D.experiments.length > 0 && (
        <section className={sec('lab')}>
          <PHead id="o-lab" color="var(--mood)" title="Experiments" />
          <div className="o-glass">
            {D.experiments.map((e) => (
              <button key={e.key} className="o-probe" onClick={e.go}>
                <FlaskConical size={17} className="o-probe-ic" />
                <span className="grow" style={{ minWidth: 0 }}>
                  <b className="ellipsis">{e.title}</b>
                  <span className="o-probe-dots">{Array.from({ length: Math.min(e.days, 21) }, (_, i) => <i key={i} className={i < e.day - 1 ? 'past' : i === e.day - 1 ? 'now' : ''} />)}</span>
                </span>
                <span className={`o-tag ${e.log?.did ? 'ok' : ''}`}>{e.over ? 'Review' : e.log ? (e.log.did ? 'Done' : 'Skipped') : `Day ${e.day}`}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* observatory: money / bored / insights */}
      <section className={sec('money')}>
        <PHead id="o-money" color="var(--money)" title="Observatory" />
        <div className="o-obs">
          <button className="o-ob" onClick={go.money} style={{ '--oc': 'var(--money)' }}><Wallet size={18} /><b className="num">{D.spentLabel}</b><small>spent today{D.untagged ? ` · ${D.untagged} untagged` : ''}</small></button>
          <button className="o-ob" onClick={go.bored} style={{ '--oc': 'var(--bored)' }}><Wind size={18} /><b>I’m bored</b><small>pick something on purpose</small></button>
          <button className="o-ob wide" onClick={go.insights} style={{ '--oc': 'var(--accent)' }}><Telescope size={18} /><span className="grow" style={{ textAlign: 'left' }}><b>Insights</b><small>Patterns across sleep, mood, money & habits</small></span><ChevronRight size={16} /></button>
        </div>
      </section>

      <button className="o-fab" onClick={() => setQa(true)} aria-label="Quick add"><span className="o-fab-orbit"><i /></span><Plus size={26} strokeWidth={2.6} /></button>
      <QuickSheet open={qa} onClose={() => setQa(false)} t={D.t} skin="o-qa" title="Launch" />
    </div>
  );
}
