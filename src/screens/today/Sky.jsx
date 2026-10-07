import React, { useState } from 'react';
import { Plus, Moon, Sunrise, Star, Clock, GraduationCap, ChevronRight, Flag, Dumbbell, FlaskConical, Phone, Wallet, Wind, Sparkles, Brain, Quote, Flame } from 'lucide-react';
import { HIcon } from '../../ui/icons';
import { fmtHM } from '../../lib/date';
import Companion from '../../ui/Companion';
import { useToday } from './useToday';
import { QuickSheet } from './shared';

/* The original "Sky" layout (light up a star for everything you finish), now carrying the whole day. */
const ORB_SPOTS = [[18, 34], [50, 22], [80, 36], [30, 56], [66, 54], [12, 72], [88, 70], [45, 42], [58, 72], [24, 18], [76, 16], [40, 68]];
function skyFor(h) {
  if (h < 5 || h >= 21) return { k: 'night', g: 'linear-gradient(180deg,#05071a 0%,#121a3d 55%,#28224d 100%)', hill: '#0d1330', hill2: '#151c40', text: '#e8ebff' };
  if (h < 8) return { k: 'dawn', g: 'linear-gradient(180deg,#3b3a7a 0%,#c56a8f 50%,#f6b38a 100%)', hill: '#3a2d55', hill2: '#5b3f66', text: '#fff7f0' };
  if (h < 17) return { k: 'day', g: 'linear-gradient(180deg,#3d8fe0 0%,#7cc0f2 55%,#c9e8fb 100%)', hill: '#2f8a5b', hill2: '#49a873', text: '#ffffff' };
  return { k: 'dusk', g: 'linear-gradient(180deg,#2c2a6b 0%,#a8487a 50%,#f39a5b 100%)', hill: '#2c2347', hill2: '#4a2f55', text: '#fff4ec' };
}
const PROMPT_ICON = { yesterday: Moon, morning: Sunrise, night: Moon, goals: Flag };

export default function TodaySky() {
  const { D, logHabit, toggleTask, openTask, openHabit, go } = useToday();
  const [burst, setBurst] = useState(null);
  const [qa, setQa] = useState(false);
  if (!D) return <div className="screen" />;

  const n = new Date();
  const S = skyFor(n.getHours());
  const all = [
    ...D.habits.map((x) => ({ key: x.key, done: x.done, prog: x.prog, icon: x.icon, color: x.color, label: x.name, sub: x.sub, act: () => logHabit(x), open: () => openHabit(x) })),
    ...D.tasks.map((x) => ({ key: x.key, done: x.done, prog: x.done ? 1 : 0, icon: 'i:CheckCircle2', color: 'var(--task)', label: x.title, sub: x.meta.join(' · ') || (x.overdue ? 'overdue' : 'task'), task: true, act: () => toggleTask(x), open: () => openTask(x) })),
  ];
  const orbs = all.slice(0, ORB_SPOTS.length);
  const extra = all.slice(ORB_SPOTS.length);
  const lit = orbs.filter((o) => o.done).length;
  const allLit = orbs.length > 0 && lit === orbs.length;
  const dayFrac = Math.max(0, Math.min(1, ((n.getHours() * 60 + n.getMinutes()) - 360) / (18 * 60)));
  const sunX = 8 + dayFrac * 84, sunY = 30 - Math.sin(dayFrac * Math.PI) * 22;
  const tapOrb = async (o, i) => {
    const r = await o.act();
    if (!o.done && (r === 'complete' || o.task)) { setBurst(i); setTimeout(() => setBurst(null), 900); }
  };
  const nn = D.agenda[0];
  const ns = D.study?.subjects[0];

  return (
    <div className="screen fade-in tlx sky-screen lx">
      <div className={`sky ${S.k}`} style={{ background: S.g, color: S.text }}>
        {(S.k === 'night' || S.k === 'dusk' || S.k === 'dawn') && <div className="sky-stars" />}
        {allLit && <div className="sky-shoot" />}
        <div className={`sky-sun ${S.k}`} style={{ left: `${sunX}%`, top: `${sunY}%` }} />
        <div className="sky-head">
          <div><div className="sky-eyebrow">{D.dateLabel}</div><div className="sky-title">{allLit ? 'Your sky is full' : D.greeting}</div></div>
          <button className="tl-avatar" onClick={go.you} aria-label="You">
            <span style={{ marginTop: 6 }}><Companion stage={D.stage.index} mood={D.kaiMood} size={42} /></span>
            <b>{D.xp.level}</b>
          </button>
        </div>
        {orbs.map((o, i) => {
          const [x, y] = ORB_SPOTS[i];
          return (
            <button key={o.key} className={`orb ${o.done ? 'lit' : ''} ${burst === i ? 'burst' : ''}`} style={{ left: `${x}%`, top: `${y + 14}%`, '--oc': o.color, animationDelay: `${(i % 5) * 0.6}s` }} onClick={() => tapOrb(o, i)} aria-label={o.label}>
              <span className="core">{o.done ? <Star size={18} fill="currentColor" /> : <HIcon icon={o.icon} size={18} color="#fff" />}</span>
              {!o.done && o.prog > 0 && <svg className="orb-ring" viewBox="0 0 52 52"><circle cx="26" cy="26" r="23" pathLength="1" strokeDasharray={`${o.prog} 1`} /></svg>}
              <span className="lbl">{o.label}</span>
              {burst === i && <span className="orb-burst">{Array.from({ length: 8 }, (_, j) => <i key={j} style={{ '--a': `${j * 45}deg` }} />)}</span>}
            </button>
          );
        })}
        {!orbs.length && <div className="sky-empty">Add habits or tasks and they appear here as stars to light up.</div>}
        <svg className="sky-hills" viewBox="0 0 400 120" preserveAspectRatio="none"><path d="M0 70 C80 30 150 60 220 45 S350 20 400 50 V120 H0Z" fill={S.hill2} /><path d="M0 95 C90 60 170 90 260 72 S360 70 400 85 V120 H0Z" fill={S.hill} /></svg>
        <div className="sky-kai"><Companion stage={D.stage.index} mood={allLit ? 'happy' : D.kaiMood} size={78} /></div>
      </div>

      <div className="sky-meter">
        <div className="row between small"><span><b className="num">{lit}</b> of {orbs.length} stars lit</span><span className="muted">day score <b className="num" style={{ color: 'var(--text)' }}>{D.score}</b>{D.xp.today ? <> · +{D.xp.today} XP</> : null}{D.streak > 1 ? <> · <Flame size={12} style={{ verticalAlign: -2, color: 'var(--fit)' }} />{D.streak}d</> : null}</span></div>
        <div className="sky-dots">{orbs.map((o) => <i key={o.key} className={o.done ? 'on' : ''} style={{ '--oc': o.color }} />)}</div>
      </div>

      {/* stars that didn't fit in the sky + quick adds */}
      {extra.length > 0 && (
        <div className="sky-more mt-12">
          {extra.map((o) => (
            <div key={o.key} className={`sky-more-row ${o.done ? 'done' : ''}`} onClick={o.open}>
              <button className="sky-more-chk" style={{ '--oc': o.color }} onClick={(e) => { e.stopPropagation(); o.act(); }} aria-label="Done">{o.done ? <Star size={13} fill="currentColor" /> : null}</button>
              <span className="grow ellipsis">{o.label}</span>
              <small className="muted">{o.sub}</small>
            </div>
          ))}
        </div>
      )}
      <div className="row gap-8 mt-12">
        <button className="sky-add" onClick={go.addTask}><Plus size={15} /> Task</button>
        <button className="sky-add" onClick={go.addHabit}><Plus size={15} /> Habit</button>
        <button className="sky-add" onClick={go.plan}>Plan <ChevronRight size={14} /></button>
      </div>

      {D.prompts.length > 0 && (
        <div className="col gap-8 mt-12">
          {D.prompts.map((p) => {
            const I = PROMPT_ICON[p.k] || Moon;
            return (
              <button key={p.k} className="tl-prompt" style={{ '--pc': `var(--${p.tone})` }} onClick={p.go}>
                <span className="ic"><I size={19} /></span>
                <span className="grow" style={{ minWidth: 0, textAlign: 'left' }}><b>{p.title}</b><small>{p.sub}</small></span>
                <ChevronRight size={18} />
              </button>
            );
          })}
        </div>
      )}

      {D.intention && (
        <div className="sky-card mt-12" style={{ '--sc': 'var(--accent)' }}>
          <span className="k"><Quote size={13} /> Today’s intention</span>
          <span className="t">{D.intention}</span>
        </div>
      )}

      <div className="grid-2 mt-12">
        <button className="sky-card" onClick={go.plan}>
          <span className="k"><Clock size={13} /> {nn ? nn.when : 'Next'}</span>
          <span className="t ellipsis">{nn ? nn.title : 'Free time'}</span>
          <span className="s">{nn ? (nn.when === 'Now' ? 'happening now' : fmtHM(nn.start)) : 'nothing planned'}{D.energy ? ` · ${D.energy.label}` : ''}</span>
        </button>
        <button className="sky-card" onClick={() => (ns ? ns.go() : go.study())} style={{ '--sc': ns?.color }}>
          <span className="k"><GraduationCap size={13} /> {ns ? ns.title : 'Study'}</span>
          <span className="t ellipsis">{ns ? ns.next : 'All roadmaps'}</span>
          <span className="s">{ns ? `${ns.mins}/${ns.goal} min today` : 'up next'}</span>
        </button>
        {D.study?.due > 0 && (
          <button className="sky-card" onClick={D.study.review} style={{ '--sc': 'var(--task)' }}>
            <span className="k"><Brain size={13} /> Revise</span>
            <span className="t">{D.study.due} card{D.study.due > 1 ? 's' : ''}</span>
            <span className="s">spaced review</span>
          </button>
        )}
        {D.workout && (
          <button className="sky-card" onClick={D.workout.go} style={{ '--sc': 'var(--fit)' }}>
            <span className="k"><Dumbbell size={13} /> Move</span>
            <span className="t">{D.workout.done ? 'Workout done' : 'Today’s session'}</span>
            <span className="s ellipsis">{D.workout.summary}</span>
          </button>
        )}
        {D.goals.map((g) => (
          <button key={g.key} className="sky-card" onClick={g.go} style={{ '--sc': g.color }}>
            <span className="k"><Flag size={13} /> {g.kind}{g.checkinDue ? ' · check in' : ''}</span>
            <span className="t clamp2">{g.title}</span>
            <span className="sky-bar"><i style={{ width: `${g.value * 100}%` }} /></span>
            <span className="s">{g.label} · {g.left}</span>
          </button>
        ))}
        {D.experiments.map((e) => (
          <button key={e.key} className="sky-card" onClick={e.go} style={{ '--sc': 'var(--habit)' }}>
            <span className="k"><FlaskConical size={13} /> Experiment</span>
            <span className="t clamp2">{e.title}</span>
            <span className="s">{e.over ? 'Review the result' : `Day ${e.day} of ${e.days}`}{e.log ? (e.log.did ? ' · done' : ' · skipped') : ' · check in'}</span>
          </button>
        ))}
        {D.people.map((p) => (
          <button key={p.key} className="sky-card" onClick={p.go} style={{ '--sc': p.color }}>
            <span className="k"><Phone size={13} /> Reach out</span>
            <span className="t ellipsis">{p.name}</span>
            <span className="s">{p.sub}</span>
          </button>
        ))}
        <button className="sky-card" onClick={go.money} style={{ '--sc': 'var(--money)' }}>
          <span className="k"><Wallet size={13} /> Spent today</span>
          <span className="t num">{D.spentLabel}</span>
          <span className="s">{D.untagged ? `${D.untagged} untagged` : 'all tagged'}</span>
        </button>
        <button className="sky-card" onClick={go.bored} style={{ '--sc': 'var(--bored)' }}>
          <span className="k"><Wind size={13} /> I’m bored</span>
          <span className="t">Pick something</span>
          <span className="s">on purpose</span>
        </button>
      </div>
      <button className="tl-prompt mt-12" style={{ '--pc': 'var(--accent)' }} onClick={go.insights}>
        <span className="ic"><Sparkles size={18} /></span>
        <span className="grow" style={{ minWidth: 0, textAlign: 'left' }}><b>Insights</b><small>Patterns across sleep, mood, money & habits</small></span>
        <ChevronRight size={18} />
      </button>

      <button className="fab" onClick={() => setQa(true)} aria-label="Quick add"><Plus size={28} strokeWidth={2.5} /></button>
      <QuickSheet open={qa} onClose={() => setQa(false)} t={D.t} />
    </div>
  );
}
