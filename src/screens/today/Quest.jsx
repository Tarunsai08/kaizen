import React, { useState } from 'react';
import { Check, Plus, Swords, Scroll, Shield, Flame, Snowflake, Sparkles, BookOpen, FlaskConical, Coins, Beer, Eye, Backpack, Users, Mountain, Hourglass, ChevronRight, Brain, Zap, Moon } from 'lucide-react';
import { HIcon } from '../../ui/icons';
import { sfxStamp, sfxFanfare, sfxComplete } from '../../lib/sound';
import { fmtHM } from '../../lib/date';
import { useToday } from './useToday';
import { QuickSheet, useFlash, Kai, countDone } from './shared';
import './quest.css';

const STAT = { habits: ['Discipline', Swords], move: ['Vigor', Flame], tasks: ['Valor', Shield], mind: ['Spirit', Sparkles] };
const RARITY = { high: ['Legendary', '#f59e0b'], medium: ['Epic', '#a855f7'], low: ['Rare', '#3b82f6'] };

function QHead({ icon: I, title, sub, link, onLink }) {
  return (
    <div className="q-head">
      <span className="q-head-ic"><I size={15} /></span>
      <span className="q-head-t">{title}</span>
      {sub && <span className="q-head-s">{sub}</span>}
      <span className="q-head-rule" />
      {link && <button className="q-head-l" onClick={onLink}>{link}</button>}
    </div>
  );
}

function Seal({ done, prog, color, icon, pips, amt, onClick, label }) {
  return (
    <button className={`q-seal ${done ? 'on' : ''}`} style={{ '--sc': color }} onClick={onClick} aria-label={label}>
      <svg viewBox="0 0 48 48" className="q-seal-svg"><path d="M24 2l5 4 6-1 3 5 6 2-1 6 4 5-4 5 1 6-6 2-3 5-6-1-5 4-5-4-6 1-3-5-6-2 1-6-4-5 4-5-1-6 6-2 3-5 6 1z" /></svg>
      <span className="q-seal-in">{done ? <Check size={18} strokeWidth={3.2} /> : <HIcon icon={icon} size={17} color="currentColor" />}</span>
      {!done && pips > 1 && pips <= 12 && (
        <span className="q-pips">{Array.from({ length: pips }, (_, i) => <i key={i} className={i < amt ? 'on' : ''} />)}</span>
      )}
      {!done && pips > 12 && prog > 0 && <span className="q-pips-bar"><i style={{ width: `${prog * 100}%` }} /></span>}
    </button>
  );
}

export default function TodayQuest() {
  const { D, logHabit, toggleTask, openTask, openHabit, go } = useToday();
  const [fx, flash] = useFlash(1100);
  const [bag, setBag] = useState(false);
  if (!D) return <div className="screen lx lx-quest" />;

  const onHabit = async (x) => {
    const r = await logHabit(x, { sfx: () => { sfxStamp(); setTimeout(sfxComplete, 120); } });
    if (r === 'complete') flash(x.key, 'xp'); else if (r === 'step') flash(x.key, 'step');
  };
  const onTask = async (x) => {
    const r = await toggleTask(x, { sfx: sfxFanfare });
    if (r === 'complete') flash(x.key, 'xp');
  };
  const qDone = countDone(D.habits);
  const tDone = countDone(D.tasks);

  return (
    <div className="screen fade-in lx lx-quest">
      {/* ---------- character sheet ---------- */}
      <header className="q-sheet">
        <div className="q-corner tl" /><div className="q-corner tr" /><div className="q-corner bl" /><div className="q-corner br" />
        <div className="q-date"><span>{D.weekday}</span><span className="q-dot">✦</span><span>{D.dateLabel.split(' · ')[1]}</span></div>
        <div className="q-char">
          <button className="q-portrait" onClick={go.you} aria-label="You">
            <span className="q-portrait-kai"><Kai D={D} size={64} /></span>
            <span className="q-lv">Lv {D.xp.level}</span>
          </button>
          <div className="q-id">
            <div className="q-name">{D.name || 'Adventurer'}</div>
            <div className="q-class">{D.stage.name}</div>
            <div className="q-xpbar"><i style={{ width: `${Math.round(D.xp.progress * 100)}%` }} /></div>
            <div className="q-xptext"><b>+{D.xp.today} XP</b> today · {Math.round(D.xp.progress * 100)}% to Lv {D.xp.level + 1}</div>
          </div>
          <div className="q-shield" title="Day score">
            <svg viewBox="0 0 64 74"><path d="M32 2 L60 12 V36 C60 54 46 66 32 72 C18 66 4 54 4 36 V12 Z" /></svg>
            <b className="num">{D.score}</b><small>power</small>
          </div>
        </div>
        <div className="q-stats">
          {D.rings.map((r) => {
            const [nm, I] = STAT[r.key] || [r.label, Sparkles];
            const v = r.value == null ? null : Math.max(0, Math.min(1, r.value));
            return (
              <div key={r.key} className={`q-stat ${v == null ? 'off' : ''}`} style={{ '--stc': r.color }}>
                <I size={13} className="q-stat-ic" />
                <span className="q-stat-n">{nm}</span>
                <span className="q-stat-bar">{Array.from({ length: 10 }, (_, i) => <i key={i} className={v != null && i < Math.round(v * 10) ? 'on' : ''} />)}</span>
                <span className="q-stat-v num">{v == null ? '—' : r.key === 'habits' ? `${Math.round(D.day.habitsDone * 10) / 10}/${D.day.habitsDue}` : r.key === 'tasks' ? `${D.day.tasksDone}/${D.day.tasksTotal}` : `${Math.round(v * 100)}%`}</span>
              </div>
            );
          })}
        </div>
        <div className="q-buffs">
          {D.streak > 1 && <span className="q-buff good"><Flame size={12} /> Momentum ×{D.streak}</span>}
          {D.restDay && <span className="q-buff cool"><Snowflake size={12} /> Rest day</span>}
          {D.energy && <span className="q-buff"><Zap size={12} /> {D.energy.label}{D.energy.until ? ` · till ${D.energy.until}` : ''}</span>}
          {D.energy && D.energy.debt >= 2 && <span className="q-buff bad"><Moon size={12} /> Sleep debt {Math.round(D.energy.debt)}h</span>}
          {D.streak <= 1 && !D.restDay && !D.energy && <span className="q-buff">Fresh start</span>}
        </div>
      </header>

      {/* ---------- oath ---------- */}
      {D.intention && (
        <div className="q-oath">
          <span className="q-oath-roll l" /><span className="q-oath-roll r" />
          <div className="q-oath-k">Oath of the day</div>
          <div className="q-oath-t">“{D.intention}”</div>
        </div>
      )}

      {/* ---------- summons (prompts) ---------- */}
      {D.prompts.length > 0 && (
        <section className="q-sec">
          <QHead icon={Scroll} title="Summons" sub={`${D.prompts.length} waiting`} />
          <div className="q-list">
            {D.prompts.map((p) => (
              <button key={p.k} className="q-summon" onClick={p.go}>
                <span className="q-bang">!</span>
                <span className="grow"><b>{p.title}</b><small>{p.sub}</small></span>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ---------- campaign (now / next) ---------- */}
      <section className="q-sec">
        <QHead icon={Hourglass} title="Campaign" sub="your day so far" link="Plan" onLink={go.plan} />
        <button className="q-camp" onClick={go.plan}>
          {D.agenda.length ? D.agenda.map((a) => (
            <div key={a.key} className={`q-camp-row ${a.when === 'Now' ? 'now' : ''}`}>
              <span className="q-camp-t num">{a.when === 'Now' ? 'NOW' : fmtHM(a.start)}</span>
              <span className="q-camp-node" style={{ '--cc': a.color }}><HIcon icon={a.icon} size={13} color="currentColor" /></span>
              <span className="q-camp-x ellipsis">{a.title}</span>
            </div>
          )) : <div className="q-empty">No more campaign events today. Rest at the inn.</div>}
          {D.energy?.tip && <div className="q-camp-tip"><Zap size={12} /> {D.energy.tip}</div>}
        </button>
      </section>

      {/* ---------- daily quests (habits) ---------- */}
      <section className="q-sec">
        <QHead icon={Swords} title="Daily quests" sub={D.habits.length ? `${qDone}/${D.habits.length} done` : ''} link="Manage" onLink={go.habits} />
        {D.habits.length ? (
          <div className="q-list">
            {D.habits.map((x) => (
              <div key={x.key} className={`q-quest ${x.done ? 'done' : ''} ${fx[x.key] === 'xp' ? 'just' : ''}`} onClick={() => openHabit(x)}>
                <Seal done={x.done} prog={x.prog} color={x.color} icon={x.icon} pips={x.target} amt={x.amt} label={x.name} onClick={(e) => { e.stopPropagation(); onHabit(x); }} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="q-quest-t ellipsis">{x.name}</div>
                  <div className="q-quest-s">
                    <span>{x.sub}</span>
                    <span className="q-gems">{x.week.map((v, i) => <i key={i} style={{ opacity: 0.25 + v * 0.75, background: v >= 1 ? x.color : undefined }} />)}</span>
                  </div>
                </div>
                <span className="q-reward">{x.done ? 'Cleared' : '+XP'}</span>
                {fx[x.key] === 'xp' && <span className="q-float">+XP</span>}
              </div>
            ))}
          </div>
        ) : (
          <button className="q-new" onClick={go.addHabit}><Plus size={16} /> Take on your first daily quest</button>
        )}
      </section>

      {/* ---------- quest log (tasks + allies) ---------- */}
      <section className="q-sec">
        <QHead icon={Scroll} title="Quest log" sub={D.tasks.length ? `${tDone}/${D.tasks.length} complete` : ''} link="Plan" onLink={go.plan} />
        <div className="q-list">
          {D.tasks.map((x) => {
            const [rn, rc] = RARITY[x.prio] || ['Common', 'var(--q-muted)'];
            return (
              <div key={x.key} className={`q-task ${x.done ? 'done' : ''}`} style={{ '--rc': rc }} onClick={() => openTask(x)}>
                <button className={`q-box ${x.done ? 'on' : ''}`} onClick={(e) => { e.stopPropagation(); onTask(x); }} aria-label="Complete">{x.done && <Check size={14} strokeWidth={3.2} />}</button>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="q-task-t ellipsis">{x.title}</div>
                  <div className="q-task-m"><span className="q-rar">{rn}</span>{x.overdue && <span className="q-over">Overdue</span>}{x.meta.map((m) => <span key={m}>{m}</span>)}</div>
                </div>
                {fx[x.key] === 'xp' && <span className="q-stampx">Complete</span>}
              </div>
            );
          })}
          {D.people.map((p) => (
            <button key={p.key} className="q-task ally" onClick={p.go}>
              <span className="q-ally" style={{ '--ac': p.color }}>{p.name.trim()[0]?.toUpperCase()}</span>
              <div className="grow" style={{ minWidth: 0, textAlign: 'left' }}>
                <div className="q-task-t ellipsis">Visit your ally {p.name}</div>
                <div className="q-task-m"><span className="q-rar" style={{ color: '#22c55e' }}>Fellowship</span><span>{p.sub}</span></div>
              </div>
              <Users size={15} className="q-mut" />
            </button>
          ))}
          <button className="q-new" onClick={go.addTask}><Plus size={16} /> {D.tasks.length ? 'Accept a new quest' : 'No quests today — accept one'}</button>
        </div>
      </section>

      {/* ---------- main quests (goals) ---------- */}
      {D.goals.length > 0 && (
        <section className="q-sec">
          <QHead icon={Mountain} title="Main quests" link="All" onLink={go.goals} />
          <div className="q-goals">
            {D.goals.map((g) => (
              <button key={g.key} className="q-goal" onClick={g.go} style={{ '--gc': g.color }}>
                <div className="q-goal-k">{g.kind}{g.checkinDue && <span className="q-bang sm">!</span>}</div>
                <div className="q-goal-t">{g.title}</div>
                <div className="q-goal-bar"><i style={{ width: `${Math.round(g.value * 100)}%` }} />{[25, 50, 75].map((m) => <b key={m} style={{ left: `${m}%` }} />)}</div>
                <div className="q-goal-f"><span className="num">{g.label}</span><span>{g.left}</span></div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ---------- training grounds (workout) ---------- */}
      {D.workout && (
        <section className="q-sec">
          <QHead icon={Flame} title="Training grounds" />
          <button className={`q-train ${D.workout.done ? 'done' : ''}`} onClick={D.workout.go}>
            <div className="q-train-drills">
              {D.workout.parts.map((p, i) => <span key={i} className="q-drill"><b>{p.name}</b><small>Lv {p.level}</small></span>)}
            </div>
            <span className="q-train-cta">{D.workout.done ? <><Check size={15} /> Trained</> : <>Begin training <ChevronRight size={15} /></>}</span>
          </button>
        </section>
      )}

      {/* ---------- library (study) ---------- */}
      {D.study && (
        <section className="q-sec">
          <QHead icon={BookOpen} title="Library" sub={D.study.streak > 0 ? `${D.study.streak}-day study streak` : ''} link="Roadmaps" onLink={D.study.all} />
          <div className="q-list">
            {D.study.subjects.map((s) => (
              <button key={s.key} className="q-tome" style={{ '--tc': s.color }} onClick={s.go}>
                <span className="q-tome-spine"><HIcon icon={s.icon} size={15} color="#fff" /></span>
                <span className="grow" style={{ minWidth: 0, textAlign: 'left' }}>
                  <small>{s.title} · {s.mins ? `${s.mins}/${s.goal} min` : `${s.goal} min goal`}</small>
                  <b className="ellipsis">{s.next}</b>
                  <span className="q-tome-bar"><i style={{ width: `${s.prog * 100}%` }} /></span>
                </span>
                <ChevronRight size={16} className="q-mut" />
              </button>
            ))}
            {D.study.due > 0 && (
              <button className="q-tome trial" onClick={D.study.review}>
                <span className="q-tome-spine"><Brain size={15} color="#fff" /></span>
                <span className="grow" style={{ textAlign: 'left' }}><small>Recall trial</small><b>{D.study.due} card{D.study.due > 1 ? 's' : ''} to revise</b></span>
                <ChevronRight size={16} className="q-mut" />
              </button>
            )}
          </div>
        </section>
      )}

      {/* ---------- alchemy (experiments) ---------- */}
      {D.experiments.length > 0 && (
        <section className="q-sec">
          <QHead icon={FlaskConical} title="Alchemy" sub="experiments" />
          <div className="q-list">
            {D.experiments.map((e) => (
              <button key={e.key} className="q-potion" onClick={e.go}>
                <span className="q-flask"><i style={{ height: `${(e.day / e.days) * 100}%` }} /></span>
                <span className="grow" style={{ minWidth: 0, textAlign: 'left' }}>
                  <b className="ellipsis">{e.title}</b>
                  <small>{e.over ? 'Brew finished — read the result' : `Day ${e.day} of ${e.days}`}</small>
                </span>
                <span className={`q-chip ${e.log?.did ? 'ok' : ''}`}>{e.over ? 'Review' : e.log ? (e.log.did ? 'Done' : 'Skipped') : 'Check in'}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ---------- treasury + tavern ---------- */}
      <section className="q-sec q-duo">
        <button className="q-chest" onClick={go.money}>
          <Coins size={20} className="q-gold" />
          <span className="q-chest-k">Treasury</span>
          <b className="num">{D.spentLabel}</b>
          <small>spent today{D.untagged ? ` · ${D.untagged} untagged` : ''}</small>
        </button>
        <button className="q-chest tavern" onClick={go.bored}>
          <Beer size={20} className="q-gold" />
          <span className="q-chest-k">Tavern</span>
          <b>I’m bored</b>
          <small>pick a side quest on purpose</small>
        </button>
      </section>

      <button className="q-oracle" onClick={go.insights}>
        <span className="q-orb"><Eye size={18} /></span>
        <span className="grow" style={{ textAlign: 'left' }}><b>Consult the oracle</b><small>Patterns across sleep, mood, money & habits</small></span>
        <ChevronRight size={17} />
      </button>

      <button className="q-satchel" onClick={() => setBag(true)} aria-label="Quick add"><Backpack size={26} /></button>
      <QuickSheet open={bag} onClose={() => setBag(false)} t={D.t} skin="q-inv" title="Satchel" />
    </div>
  );
}
