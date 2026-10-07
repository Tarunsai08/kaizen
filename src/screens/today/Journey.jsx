import React, { useState } from 'react';
import { Sunrise, Landmark, Tent, Home, Dumbbell, Library, FlaskConical, Store, Mountain, Moon, Compass, ChevronRight, Phone, Plus, Check, CloudSun, Flame, Sparkles, Wind, Telescope, Snowflake, Brain } from 'lucide-react';
import { HIcon } from '../../ui/icons';
import { sfxComplete, sfxArrive, sfxCoin } from '../../lib/sound';
import { fmtHM, hmToMin } from '../../lib/date';
import { useApp } from '../../ctx';
import { useToday } from './useToday';
import { QuickSheet, useFlash, Kai, countDone } from './shared';
import './journey.css';

/* --------- little map illustrations --------- */
function House({ x, flash }) {
  const lit = x.done;
  return (
    <svg viewBox="0 0 64 60" className={`jm-house ${lit ? 'lit' : ''} ${flash ? 'jflash' : ''}`} style={{ '--hc': x.color }}>
      {lit && <g className="jm-smoke"><circle cx="45" cy="6" r="3" /><circle cx="48" cy="1" r="2.4" /></g>}
      <rect x="40" y="10" width="7" height="12" className="jm-chim" />
      <path d="M6 30 L32 8 L58 30 Z" className="jm-roof" />
      <rect x="11" y="28" width="42" height="28" rx="2" className="jm-wall" />
      <rect x="18" y="35" width="11" height="10" rx="1.5" className="jm-win" />
      <rect x="36" y="38" width="10" height="18" rx="1.5" className="jm-door" />
      {x.target > 1 && !lit && <rect x="11" y="57" width={42 * x.prog} height="3" rx="1.5" className="jm-build" />}
    </svg>
  );
}
function TentIcon({ done }) {
  return (
    <svg viewBox="0 0 48 44" className={`jm-tent ${done ? 'up' : ''}`}>
      <line x1="24" y1="4" x2="24" y2="16" className="jm-pole" />
      <path d="M24 4 L36 8 L24 12 Z" className="jm-flag" />
      <path d="M4 40 L24 14 L44 40 Z" className="jm-canvas" />
      <path d="M24 14 L18 40 L30 40 Z" className="jm-flap" />
    </svg>
  );
}

function Place({ side = 'left', icon: I, color, name, hint, here, D, children, last }) {
  return (
    <section className={`jm-place ${side} ${last ? 'last' : ''}`}>
      <div className="jm-rail">
        {here ? (
          <span className="jm-you"><span className="jm-you-kai"><Kai D={D} size={46} /></span><small>you are here</small></span>
        ) : (
          <span className="jm-pin" style={{ '--pc': color }}><I size={22} /></span>
        )}
      </div>
      <div className="jm-body">
        <div className="jm-name"><span>{name}</span>{hint && <small>{hint}</small>}</div>
        {children}
      </div>
    </section>
  );
}
const Link = ({ from }) => <div className={`jm-link from-${from}`} aria-hidden><i /><i /></div>;

export default function TodayJourney() {
  const { settings } = useApp();
  const { D, logHabit, toggleTask, openTask, openHabit, go } = useToday();
  const [fx, flash] = useFlash(1100);
  const [qa, setQa] = useState(false);
  if (!D) return <div className="screen lx lx-jm" />;

  const night = D.hour >= 19 || D.hour < 6;
  const morningPrompts = D.prompts.filter((p) => p.k === 'morning' || p.k === 'yesterday');
  const nightPrompt = D.prompts.find((p) => p.k === 'night');
  const goalPrompt = D.prompts.find((p) => p.k === 'goals');
  const onHabit = async (x) => { const r = await logHabit(x, { sfx: () => { sfxArrive(); setTimeout(sfxComplete, 110); } }); if (r === 'complete' || r === 'step') flash(x.key, r); };
  const onTask = async (x) => { const r = await toggleTask(x, { sfx: sfxComplete }); if (r === 'complete') flash(x.key); };

  // build the trail: every place in order of the day, alternating sides
  const places = [];
  if (morningPrompts.length) places.push({ k: 'dawn', icon: Sunrise, color: 'var(--goal)', name: 'Dawn camp', hint: 'start here', body: (
    <div className="jm-stack">{morningPrompts.map((p) => <button key={p.k} className="jm-sign" onClick={p.go}><b>{p.title}</b><small>{p.sub}</small><ChevronRight size={16} /></button>)}</div>
  ) });
  if (D.intention) places.push({ k: 'oath', icon: Landmark, color: '#a8a29e', name: 'Standing stone', hint: 'today’s intention', body: <div className="jm-stone">{D.intention}</div> });
  places.push({ k: 'here', here: true, name: D.agenda[0]?.when === 'Now' ? 'Right now' : 'Up the road', hint: D.energy ? D.energy.label : '', body: (
    <button className="jm-road" onClick={go.plan}>
      {D.agenda.length ? D.agenda.map((a) => (
        <span key={a.key} className={`jm-post ${a.when === 'Now' ? 'now' : ''}`} style={{ '--ac': a.color }}>
          <span className="jm-post-t num">{a.when === 'Now' ? 'now' : fmtHM(a.start)}</span>
          <span className="jm-post-arrow"><HIcon icon={a.icon} size={13} color="currentColor" /><span className="ellipsis">{a.title}</span></span>
        </span>
      )) : <span className="jm-quiet">The road is clear for the rest of the day.</span>}
      {D.energy?.tip && <span className="jm-weather"><CloudSun size={14} /> {D.energy.tip}</span>}
    </button>
  ) });
  places.push({ k: 'village', icon: Home, color: 'var(--habit)', name: 'Habit village', hint: D.habits.length ? `${countDone(D.habits)} of ${D.habits.length} homes lit` : '', link: ['Manage', go.habits], body: D.habits.length ? (
    <div className="jm-village">
      {D.habits.map((x) => (
        <div key={x.key} className="jm-home">
          <button className="jm-home-b" onClick={() => onHabit(x)} aria-label={x.name}><House x={x} flash={!!fx[x.key]} /></button>
          <button className="jm-home-n" onClick={() => openHabit(x)}><b className="ellipsis">{x.name}</b><small className="ellipsis">{x.done ? 'lit ✓' : x.sub}</small></button>
        </div>
      ))}
    </div>
  ) : <button className="jm-build-new" onClick={go.addHabit}><Plus size={15} /> Build your first home (add a habit)</button> });
  places.push({ k: 'camp', icon: Tent, color: 'var(--task)', name: 'Task camp', hint: D.tasks.length ? `${countDone(D.tasks)}/${D.tasks.length} flags raised` : '', link: ['Plan', go.plan], body: (
    <div className="jm-stack">
      {D.tasks.map((x) => (
        <div key={x.key} className={`jm-task ${x.done ? 'done' : ''} ${fx[x.key] ? 'jflash' : ''}`} onClick={() => openTask(x)}>
          <button className="jm-tent-b" onClick={(e) => { e.stopPropagation(); onTask(x); }} aria-label="Complete"><TentIcon done={x.done} /></button>
          <span className="grow" style={{ minWidth: 0 }}>
            <b className="ellipsis">{x.title}</b>
            {(x.prio || x.overdue || x.meta.length > 0) && <small>{x.prio && <em className={`p-${x.prio}`}>{x.prio}</em>}{x.overdue && <em className="late">overdue</em>}{x.meta.join(' · ')}</small>}
          </span>
        </div>
      ))}
      {D.people.map((p) => (
        <button key={p.key} className="jm-task friend" onClick={p.go}>
          <span className="jm-friend" style={{ '--fc': p.color }}><Phone size={15} /></span>
          <span className="grow" style={{ minWidth: 0 }}><b className="ellipsis">Drop by {p.name}’s</b><small>{p.sub}</small></span>
        </button>
      ))}
      <button className="jm-build-new" onClick={go.addTask}><Plus size={15} /> {D.tasks.length ? 'Pitch a new tent (add task)' : 'No tasks today — add one'}</button>
    </div>
  ) });
  if (D.workout) places.push({ k: 'arena', icon: Dumbbell, color: 'var(--fit)', name: 'Training ground', hint: D.workout.done ? 'done for today' : 'today’s session', body: (
    <button className={`jm-arena ${D.workout.done ? 'done' : ''}`} onClick={D.workout.go}>
      <span className="grow" style={{ minWidth: 0 }}>{D.workout.parts.map((p, i) => <span key={i} className="jm-drill">{p.name} <em>L{p.level}</em></span>)}</span>
      <span className="jm-go">{D.workout.done ? <Check size={16} /> : 'Start'}</span>
    </button>
  ) });
  if (D.study) places.push({ k: 'library', icon: Library, color: '#60a5fa', name: 'Library tower', hint: D.study.streak ? `${D.study.streak}-day study streak` : 'study', link: ['Roadmaps', D.study.all], body: (
    <div className="jm-stack">
      {D.study.subjects.map((s) => (
        <button key={s.key} className="jm-book" onClick={s.go} style={{ '--bc': s.color }}>
          <span className="jm-book-ic"><HIcon icon={s.icon} size={15} color="currentColor" /></span>
          <span className="grow" style={{ minWidth: 0 }}><small>{s.title} · {s.mins ? `${s.mins}/${s.goal} min` : `${s.goal} min goal`}</small><b className="ellipsis">{s.next}</b><span className="jm-mini"><i style={{ width: `${s.prog * 100}%` }} /></span></span>
        </button>
      ))}
      {D.study.due > 0 && <button className="jm-book" onClick={D.study.review} style={{ '--bc': 'var(--task)' }}><span className="jm-book-ic"><Brain size={15} /></span><span className="grow"><small>Spaced review</small><b>{D.study.due} card{D.study.due > 1 ? 's' : ''} to revise</b></span></button>}
    </div>
  ) });
  if (D.experiments.length) places.push({ k: 'lab', icon: FlaskConical, color: 'var(--mood)', name: 'Alchemist’s hut', hint: 'experiments', body: (
    <div className="jm-stack">
      {D.experiments.map((e) => (
        <button key={e.key} className="jm-exp" onClick={e.go}>
          <span className="grow" style={{ minWidth: 0 }}><b className="ellipsis">{e.title}</b><small>{e.over ? 'Finished — review the result' : `Day ${e.day} of ${e.days}`}</small><span className="jm-mini"><i style={{ width: `${(e.day / e.days) * 100}%`, background: 'var(--mood)' }} /></span></span>
          <span className={`jm-tag ${e.log?.did ? 'ok' : ''}`}>{e.over ? 'Review' : e.log ? (e.log.did ? 'Done' : 'Skipped') : 'Check in'}</span>
        </button>
      ))}
    </div>
  ) });
  places.push({ k: 'market', icon: Store, color: 'var(--money)', name: 'Market square', hint: '', body: (
    <div className="jm-market">
      <button className="jm-stall" onClick={() => { sfxCoin(); go.money(); }} style={{ '--sc': 'var(--money)' }}><small>spent today</small><b className="num">{D.spentLabel}</b>{D.untagged > 0 && <small>{D.untagged} untagged</small>}</button>
      <button className="jm-stall" onClick={go.bored} style={{ '--sc': 'var(--bored)' }}><Wind size={16} /><b>I’m bored</b><small>wander somewhere on purpose</small></button>
      <button className="jm-stall wide" onClick={go.insights} style={{ '--sc': 'var(--accent)' }}><Telescope size={16} /><span className="grow"><b>Lookout</b><small>patterns across sleep, mood, money & habits</small></span><ChevronRight size={15} /></button>
    </div>
  ) });
  if (D.goals.length || goalPrompt) places.push({ k: 'summit', icon: Mountain, color: 'var(--goal)', name: 'The summit', hint: 'your goals', link: ['All', go.goals], body: (
    <div className="jm-summit">
      {D.goals.length > 0 && (
        <div className="jm-mtn">
          <svg viewBox="0 0 200 90" preserveAspectRatio="none"><path d="M0 90 L60 34 L82 50 L120 6 L160 46 L178 36 L200 90 Z" className="jm-rock" /><path d="M108 20 L120 6 L132 21 L124 18 L118 24 L113 19 Z" className="jm-snow" /></svg>
          {D.goals.slice(0, 5).map((g, i) => {
            const v = Math.max(0.04, g.value); // climb along the left ridge to the peak (x 4%→60%, y 96%→8%)
            return <button key={g.key} className="jm-flagpin" onClick={g.go} style={{ left: `${4 + v * 56 + i * 2.5}%`, top: `${92 - v * 84 + (i % 2) * 7}%`, '--gc': g.color }} aria-label={g.title}><i>{i + 1}</i></button>;
          })}
        </div>
      )}
      <div className="jm-stack">
        {D.goals.map((g, i) => (
          <button key={g.key} className="jm-goal" onClick={g.go} style={{ '--gc': g.color }}>
            <span className="jm-gnum">{i + 1}</span>
            <span className="grow" style={{ minWidth: 0 }}><b className="ellipsis">{g.title}</b><small>{g.kind} · {g.label} · {g.left}{g.checkinDue ? ' · check in' : ''}</small></span>
            <span className="num jm-gpct">{Math.round(g.value * 100)}%</span>
          </button>
        ))}
        {goalPrompt && <button className="jm-sign" onClick={goalPrompt.go}><b>{goalPrompt.title}</b><small>{goalPrompt.sub}</small><ChevronRight size={16} /></button>}
      </div>
    </div>
  ) });
  places.push({ k: 'inn', icon: Moon, color: 'var(--sleep)', name: 'The inn', hint: `rest by ${fmtHM(settings.bedtimeTarget || '23:00')}`, body: nightPrompt ? (
    <button className="jm-sign glw" onClick={nightPrompt.go}><b>{nightPrompt.title}</b><small>{nightPrompt.sub}</small><ChevronRight size={16} /></button>
  ) : (
    <div className="jm-quiet">{D.mins > hmToMin(settings.bedtimeTarget || '23:00') - 180 || D.hour < 6 ? 'Today’s review is written. Sleep well.' : 'Your night review opens here this evening.'}</div>
  ) });

  return (
    <div className={`screen fade-in lx lx-jm ${night ? 'night' : ''}`}>
      {/* ---------- cartouche ---------- */}
      <header className="jm-cart">
        <div className="jm-sky">
          <span className={`jm-sun ${night ? 'moon' : ''}`} style={{ left: `${10 + Math.max(0, Math.min(1, (D.mins - 360) / 1080)) * 80}%` }} />
          <svg className="jm-hills" viewBox="0 0 400 70" preserveAspectRatio="none"><path d="M0 50 C70 20 130 46 200 30 S330 12 400 36 V70 H0Z" className="hl2" /><path d="M0 62 C90 40 170 64 260 50 S360 48 400 56 V70 H0Z" className="hl1" /></svg>
        </div>
        <div className="jm-cart-row">
          <div style={{ minWidth: 0 }}>
            <div className="jm-eyebrow">{D.dateLabel}</div>
            <h1 className="jm-title">{D.allDone ? 'Journey complete' : D.greeting}{D.name && !D.allDone ? `, ${D.name}` : ''}</h1>
          </div>
          <button className="jm-avatar" onClick={go.you} aria-label="You"><Kai D={D} size={40} /><b>{D.xp.level}</b></button>
        </div>
        <div className="jm-trail">
          <span className="jm-trail-bar"><i style={{ width: `${D.score}%` }} /><b style={{ left: `${D.score}%` }} /></span>
          <span className="jm-trail-l"><b className="num">{D.score}</b> / 100 of today’s trail</span>
        </div>
        <div className="jm-badges">
          <span><Sparkles size={12} /> +{D.xp.today} XP</span>
          {D.streak > 1 && <span><Flame size={12} /> {D.streak}-day streak</span>}
          {D.restDay && <span><Snowflake size={12} /> rest day</span>}
          {D.rings.filter((r) => r.value != null).map((r) => <span key={r.key} style={{ color: r.color }}>{r.label} {Math.round(r.value * 100)}%</span>)}
        </div>
      </header>

      <div className="jm-map">
        <div className="jm-start" />
        {places.map((p, i) => {
          const side = i % 2 ? 'right' : 'left';
          return (
            <React.Fragment key={p.k}>
              {i > 0 && <Link from={i % 2 ? 'left' : 'right'} />}
              <Place side={side} icon={p.icon} color={p.color} name={<>{p.name}{p.link && <button className="jm-more" onClick={p.link[1]}>{p.link[0]} <ChevronRight size={12} /></button>}</>} hint={p.hint} here={p.here} D={D} last={i === places.length - 1}>
                {p.body}
              </Place>
            </React.Fragment>
          );
        })}
      </div>

      <button className="jm-fab" onClick={() => setQa(true)} aria-label="Quick add"><Compass size={28} className="jm-fab-ic" /></button>
      <QuickSheet open={qa} onClose={() => setQa(false)} t={D.t} skin="jm-qa" title="Where to?" />
    </div>
  );
}
