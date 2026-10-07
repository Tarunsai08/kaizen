import React, { useMemo, useState } from 'react';
import { PenLine, Phone, ArrowRight, Paperclip } from 'lucide-react';
import { HIcon } from '../../ui/icons';
import { sfxScribble, sfxComplete } from '../../lib/sound';
import { fmtHM, DAYS_SHORT, parse, addDays } from '../../lib/date';
import { useToday } from './useToday';
import { QuickSheet, useFlash, Kai, countDone } from './shared';
import './notebook.css';

/* ---------- tiny "hand-drawn" helpers (seeded so shapes don't jitter between renders) ---------- */
const seeded = (seed) => { let s = 0; for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0; return () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296); };
function roughCircle(seed, cx = 50, cy = 50, r = 40) {
  const rnd = seeded(seed); const pts = [];
  const start = rnd() * Math.PI * 2; const turns = 1.12;
  for (let i = 0; i <= 28; i++) {
    const a = start + (i / 28) * Math.PI * 2 * turns;
    const rr = r * (0.94 + rnd() * 0.12) * (1 + (i / 28) * 0.05);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.92]);
  }
  return 'M' + pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' L');
}
function squiggle(seed, w = 200, y = 8) {
  const rnd = seeded(seed); let d = `M2,${y}`;
  for (let x = 14; x <= w; x += 14) d += ` Q${x - 7},${y + (rnd() * 8 - 4) - 3} ${x},${y + (rnd() * 4 - 2)}`;
  return d;
}
const Scribble = ({ seed }) => {
  const rnd = seeded(seed); let d = 'M4,6';
  for (let i = 0; i < 6; i++) d += ` L${20 + rnd() * 4},${8 + i * 3.4} L${4 + rnd() * 4},${10 + i * 3.4}`;
  return <svg viewBox="0 0 28 30" className="nb-scrib"><path d={d} /></svg>;
};
const Cross = () => <svg viewBox="0 0 28 28" className="nb-x"><path d="M5,6 C11,12 17,17 23,23" /><path d="M22,5 C16,12 11,17 6,23" /></svg>;
const Tally = ({ n }) => {
  const groups = [];
  for (let g = 0; g < Math.ceil(n / 5); g++) groups.push(Math.min(5, n - g * 5));
  return <span className="nb-tally">{groups.map((c, i) => <span key={i} className={c === 5 ? 'five' : ''}>{'|'.repeat(Math.min(c, 4))}</span>)}</span>;
};

export default function TodayNotebook() {
  const { D, logHabit, toggleTask, openTask, openHabit, go } = useToday();
  const [fx, flash] = useFlash(1200);
  const [qa, setQa] = useState(false);
  const week = useMemo(() => (D ? Array.from({ length: 7 }, (_, i) => DAYS_SHORT[parse(addDays(D.t, i - 6)).getDay()][0]) : []), [D?.t]);
  if (!D) return <div className="screen lx lx-nb" />;

  const onHabit = async (x) => {
    sfxScribble();
    const r = await logHabit(x, { sfx: () => setTimeout(sfxComplete, 160) });
    if (r === 'complete' || r === 'step') flash(x.key, r);
  };
  const onTask = async (x) => { sfxScribble(); const r = await toggleTask(x, { sfx: () => setTimeout(sfxComplete, 200) }); if (r === 'complete') flash(x.key); };
  const marks = { high: '!!!', medium: '!!', low: '!' };

  return (
    <div className="screen fade-in lx lx-nb">

      {/* ---------- header ---------- */}
      <header className="nb-head">
        <div className="nb-date">
          <div className="nb-day">{D.weekday}</div>
          <svg className="nb-under" viewBox="0 0 220 16" preserveAspectRatio="none"><path d={squiggle(D.t, 216)} /></svg>
          <div className="nb-sub">{D.d.getDate()} {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][D.d.getMonth()]} · {D.greeting.toLowerCase()}{D.name ? `, ${D.name}` : ''}</div>
        </div>
        <button className="nb-sticker" onClick={go.you} aria-label="You">
          <span className="nb-tape t1" />
          <Kai D={D} size={52} />
          <span className="nb-lv">lv {D.xp.level}</span>
        </button>
      </header>

      {/* ---------- score + rings ---------- */}
      <section className="nb-score">
        <div className="nb-circle">
          <svg viewBox="0 0 100 100"><path d={roughCircle(D.t + 's')} /></svg>
          <b>{D.score}</b>
          <span className="nb-circle-l">day score</span>
        </div>
        <div className="nb-bars">
          {D.rings.map((r) => (
            <div key={r.key} className={`nb-bar ${r.value == null ? 'off' : ''}`} style={{ '--bc': r.color }}>
              <span className="nb-bar-n">{r.label.toLowerCase()}</span>
              <span className="nb-bar-box"><i style={{ width: `${Math.round((r.value || 0) * 100)}%` }} /></span>
              <span className="nb-bar-v">{r.value == null ? '–' : `${Math.round(r.value * 100)}%`}</span>
            </div>
          ))}
          <div className="nb-notes">
            {D.xp.today > 0 && <span>+{D.xp.today} xp</span>}
            {D.streak > 1 && <span>🔥 {D.streak} days in a row!</span>}
            {D.restDay && <span>❄ rest day</span>}
          </div>
        </div>
      </section>

      {/* ---------- intention ---------- */}
      {D.intention && (
        <p className="nb-intent"><span className="nb-k">today I will —</span> <mark>{D.intention}</mark></p>
      )}

      {/* ---------- prompts as red-pen notes ---------- */}
      {D.prompts.map((p) => (
        <button key={p.k} className="nb-redpen" onClick={p.go}>
          <span className="nb-bang">!</span>
          <span className="grow"><b>{p.title}</b> <small>— {p.sub}</small></span>
          <ArrowRight size={16} />
        </button>
      ))}

      {/* ---------- schedule ---------- */}
      <section className="nb-sec">
        <h2 className="nb-h">schedule <button onClick={go.plan}>plan →</button></h2>
        <button className="nb-sched" onClick={go.plan}>
          {D.agenda.length ? D.agenda.map((a) => (
            <div key={a.key} className={`nb-ev ${a.when === 'Now' ? 'now' : ''}`}>
              <span className="nb-ev-t">{a.when === 'Now' ? 'now' : fmtHM(a.start)}</span>
              <span className="nb-ev-o" style={{ borderColor: a.color }} />
              <span className="nb-ev-x">{a.title}</span>
            </div>
          )) : <div className="nb-faint">nothing else planned — enjoy the space</div>}
          {D.energy && <div className="nb-margin">⚡ {D.energy.label.toLowerCase()}{D.energy.until ? ` until ${D.energy.until}` : ''}{D.energy.tip ? ` · ${D.energy.tip}` : ''}</div>}
        </button>
      </section>

      {/* ---------- habit tracker ---------- */}
      <section className="nb-sec">
        <h2 className="nb-h">habit tracker <small>{D.habits.length ? `${countDone(D.habits)}/${D.habits.length}` : ''}</small><button onClick={go.habits}>manage →</button></h2>
        {D.habits.length ? (
          <div className="nb-grid" style={{ '--cols': 7 }}>
            <span />
            {week.map((w, i) => <span key={i} className={`nb-wd ${i === 6 ? 'today' : ''}`}>{i === 6 ? 'today' : w}</span>)}
            {D.habits.map((x) => (
              <React.Fragment key={x.key}>
                <button className="nb-hname" onClick={() => openHabit(x)}>
                  <HIcon icon={x.icon} size={13} color={x.color} />
                  <span className="ellipsis">{x.name}</span>
                </button>
                {x.week.slice(0, 6).map((v, i) => (
                  <span key={i} className="nb-cell past">{v >= 1 ? <Scribble seed={x.key + i} /> : v > 0 ? <i className="nb-half" /> : null}</span>
                ))}
                <button className={`nb-cell today ${x.done ? 'done' : ''} ${fx[x.key] ? 'just' : ''}`} style={{ '--hc': x.color }} onClick={() => onHabit(x)} aria-label={x.name}>
                  {x.done ? <Cross /> : x.target > 1 ? (x.target <= 10 && x.amt ? <Tally n={x.amt} /> : <small>{x.amt}/{x.target}</small>) : null}
                </button>
              </React.Fragment>
            ))}
          </div>
        ) : <button className="nb-add" onClick={go.addHabit}>+ start a habit</button>}
        {D.habits.some((x) => x.target > 1) && <div className="nb-faint sm">tap today’s box to add one · counts show as tally marks</div>}
      </section>

      {/* ---------- to do ---------- */}
      <section className="nb-sec">
        <h2 className="nb-h">to do <small>{D.tasks.length ? `${countDone(D.tasks)}/${D.tasks.length}` : ''}</small><button onClick={go.plan}>plan →</button></h2>
        <div className="nb-todo">
          {D.tasks.map((x) => (
            <div key={x.key} className={`nb-item ${x.done ? 'done' : ''} ${fx[x.key] ? 'just' : ''}`} onClick={() => openTask(x)}>
              <button className="nb-bullet" onClick={(e) => { e.stopPropagation(); onTask(x); }} aria-label="Complete">{x.done ? '×' : x.overdue ? '>' : '•'}</button>
              <span className="nb-item-t">
                <span className="nb-strike-wrap">{x.title}{x.done && <svg className="nb-strike" viewBox="0 0 100 10" preserveAspectRatio="none"><path d="M0,6 C30,3 60,8 100,4" /></svg>}</span>
                {x.prio && <span className="nb-prio">{marks[x.prio]}</span>}
                {(x.overdue || x.meta.length > 0) && <small>{x.overdue ? 'from earlier · ' : ''}{x.meta.join(' · ')}</small>}
              </span>
            </div>
          ))}
          {D.people.map((p) => (
            <button key={p.key} className="nb-item" onClick={p.go}>
              <span className="nb-bullet"><Phone size={13} /></span>
              <span className="nb-item-t">call {p.name}<small>{p.sub}</small></span>
            </button>
          ))}
          <button className="nb-add" onClick={go.addTask}>+ {D.tasks.length ? 'add a task' : 'nothing due — add a task'}</button>
        </div>
      </section>

      {/* ---------- goals as sticky notes ---------- */}
      {D.goals.length > 0 && (
        <section className="nb-sec">
          <h2 className="nb-h">goals <button onClick={go.goals}>all →</button></h2>
          <div className="nb-stickies">
            {D.goals.map((g, i) => (
              <button key={g.key} className={`nb-sticky c${i % 4}`} style={{ '--rot': `${[-2.2, 1.6, -1.1, 2.4][i % 4]}deg` }} onClick={g.go}>
                <span className="nb-pin" />
                <small>{g.kind.toLowerCase()}{g.checkinDue ? ' · check in!' : ''}</small>
                <b>{g.title}</b>
                <span className="nb-sbar"><i style={{ width: `${Math.round(g.value * 100)}%` }} /></span>
                <small>{g.label} · {g.left.toLowerCase()}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ---------- move ---------- */}
      {D.workout && (
        <section className="nb-sec">
          <h2 className="nb-h">move</h2>
          <button className={`nb-move ${D.workout.done ? 'done' : ''}`} onClick={D.workout.go}>
            <svg viewBox="0 0 64 28" className="nb-dumb"><path d="M4 9v10M10 5v18M10 14h44M54 5v18M60 9v10" /></svg>
            <span className="grow">{D.workout.parts.map((p) => `${p.name} L${p.level}`).join(' + ')}</span>
            <span className="nb-check">{D.workout.done ? '✓ done' : 'start →'}</span>
          </button>
        </section>
      )}

      {/* ---------- study log ---------- */}
      {D.study && (
        <section className="nb-sec">
          <h2 className="nb-h">study log {D.study.streak > 0 && <small>{D.study.streak}-day streak</small>}<button onClick={D.study.all}>roadmaps →</button></h2>
          <div className="nb-todo">
            {D.study.subjects.map((s) => (
              <button key={s.key} className="nb-study" onClick={s.go} style={{ '--sc': s.color }}>
                <span className="nb-pie"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="14" className="t" /><circle cx="18" cy="18" r="14" className={`v ${s.prog ? '' : 'zero'}`} pathLength="1" strokeDasharray={`${s.prog} 1`} /></svg></span>
                <span className="grow" style={{ minWidth: 0 }}><small>{s.title.toLowerCase()} · {s.mins ? `${s.mins}/${s.goal} min` : `${s.goal} min goal`}</small><span className="nb-study-n ellipsis">{s.next}</span></span>
              </button>
            ))}
            {D.study.due > 0 && (
              <button className="nb-study cards" onClick={D.study.review}>
                <span className="nb-cards"><i /><i /><i /></span>
                <span className="grow"><small>flashcards</small><span className="nb-study-n">{D.study.due} due for review</span></span>
              </button>
            )}
          </div>
        </section>
      )}

      {/* ---------- experiments ---------- */}
      {D.experiments.length > 0 && (
        <section className="nb-sec">
          <h2 className="nb-h">experiments</h2>
          {D.experiments.map((e) => (
            <button key={e.key} className="nb-exp" onClick={e.go}>
              <span className="nb-exp-t">{e.title}</span>
              <span className="nb-exp-d">{Array.from({ length: Math.min(e.days, 21) }, (_, i) => <i key={i} className={i < e.day - 1 ? 'f' : i === e.day - 1 ? 'n' : ''} />)}</span>
              <small>{e.over ? 'finished — write up the result' : `day ${e.day} of ${e.days}`}{e.log ? (e.log.did ? ' · done today ✓' : ' · skipped today') : ' · check in →'}</small>
            </button>
          ))}
        </section>
      )}

      {/* ---------- money / bored / insights ---------- */}
      <section className="nb-sec nb-scraps">
        <button className="nb-receipt" onClick={go.money}>
          <Paperclip size={22} className="nb-clip" />
          <small>spent today</small>
          <b>{D.spentLabel}</b>
          {D.untagged > 0 && <small>{D.untagged} to tag</small>}
        </button>
        <div className="nb-side">
          <button className="nb-bored" onClick={go.bored}><b>bored?</b><small>pick something on purpose →</small></button>
          <button className="nb-insight" onClick={go.insights}><b>patterns</b><small>sleep · mood · money · habits →</small></button>
        </div>
      </section>

      <button className="nb-fab" onClick={() => setQa(true)} aria-label="Quick add"><PenLine size={24} /></button>
      <QuickSheet open={qa} onClose={() => setQa(false)} t={D.t} skin="nb-qa" title="Jot down" />
    </div>
  );
}
