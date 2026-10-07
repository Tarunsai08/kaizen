import React, { useEffect, useState } from 'react';
import { Plus, ChevronRight, AlertTriangle, Radar, Cpu, Database, Fuel, Navigation, Activity, FlaskConical, Power, Check } from 'lucide-react';
import { HIcon } from '../../ui/icons';
import { sfxSwitch, sfxBlip, sfxComplete } from '../../lib/sound';
import { fmtHM, hmToMin, DAYS_SHORT, MONTHS } from '../../lib/date';
import { useToday } from './useToday';
import { QuickSheet, useFlash, Kai, countDone } from './shared';
import './cockpit.css';

const pad = (n, w = 2) => String(Math.max(0, Math.round(n))).padStart(w, '0');
const up = (s) => String(s || '').toUpperCase();

/** 240° gauge with ticks + needle */
function Gauge({ value, size = 220 }) {
  const R = 92, cx = 110, cy = 110, a0 = -210, a1 = 30; // degrees
  const pt = (deg, r) => { const t = (deg * Math.PI) / 180; return [cx + r * Math.cos(t), cy + r * Math.sin(t)]; };
  const arc = (from, to, r) => { const [x0, y0] = pt(from, r), [x1, y1] = pt(to, r); return `M${x0},${y0} A${r},${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x1},${y1}`; };
  const v = Math.max(0, Math.min(100, value));
  const av = a0 + (v / 100) * (a1 - a0);
  const ticks = [];
  for (let i = 0; i <= 20; i++) {
    const d = a0 + (i / 20) * (a1 - a0);
    const [x0, y0] = pt(d, i % 5 ? 80 : 74), [x1, y1] = pt(d, 86);
    ticks.push(<line key={i} x1={x0} y1={y0} x2={x1} y2={y1} className={i % 5 ? 'tk' : 'tk major'} />);
    if (i % 5 === 0) { const [tx, ty] = pt(d, 62); ticks.push(<text key={'t' + i} x={tx} y={ty + 3.5} className="tkl">{i * 5}</text>); }
  }
  const [nx, ny] = pt(av, 70);
  return (
    <svg viewBox="0 0 220 170" width={size} height={size * 170 / 220} className="h-gauge">
      <path d={arc(a0, a1, 96)} className="g-trk" />
      <path d={arc(a0, a0 + (a1 - a0) * 0.4, 96)} className="g-zone red" />
      <path d={arc(a0 + (a1 - a0) * 0.4, a0 + (a1 - a0) * 0.6, 96)} className="g-zone amber" />
      <path d={arc(a0 + (a1 - a0) * 0.6, a1, 96)} className="g-zone green" />
      {v > 0 && <path d={arc(a0, av, 96)} className="g-val" />}
      {ticks}
      <line x1={cx} y1={cy} x2={nx} y2={ny} className="g-needle" style={{ transformOrigin: `${cx}px ${cy}px` }} />
      <circle cx={cx} cy={cy} r="7" className="g-hub" />
    </svg>
  );
}
function Mini({ r }) {
  const v = r.value == null ? null : Math.max(0, Math.min(1, r.value));
  const len = 0.75;
  return (
    <div className={`h-mini ${v == null ? 'off' : ''}`} style={{ '--mc': r.color }}>
      <svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="24" className="m-trk" pathLength="1" strokeDasharray={`${len} 1`} /><circle cx="30" cy="30" r="24" className={`m-val ${v ? '' : 'zero'}`} pathLength="1" strokeDasharray={`${(v || 0) * len} 1`} /></svg>
      <b className="num">{v == null ? '--' : pad(v * 100)}</b>
      <small>{up(r.label)}</small>
    </div>
  );
}
function Radar_({ agenda, mins }) {
  // blips placed by how far ahead they are (radius = time until, 0..6h), angle spread
  return (
    <div className="h-radar">
      <span className="h-sweep" />
      {[0.33, 0.66, 1].map((r) => <i key={r} className="h-rr" style={{ inset: `${(1 - r) * 50}%` }} />)}
      {agenda.map((a, i) => {
        const dt = a.when === 'Now' ? 0 : Math.max(0, hmToMin(a.start) - mins);
        const r = Math.min(1, dt / 360) * 0.42 + 0.06;
        const ang = (-60 + i * 70) * (Math.PI / 180);
        return <span key={a.key} className={`h-blip ${a.when === 'Now' ? 'now' : ''}`} style={{ left: `${50 + Math.cos(ang) * r * 100}%`, top: `${50 + Math.sin(ang) * r * 100}%`, '--bc': a.color }} />;
      })}
    </div>
  );
}

export default function TodayCockpit() {
  const { D, logHabit, toggleTask, openTask, openHabit, go } = useToday();
  const [fx, flash] = useFlash(900);
  const [qa, setQa] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => { const i = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(i); }, []);
  if (!D) return <div className="screen lx lx-hud" />;

  const now = new Date();
  const onHabit = async (x) => {
    sfxSwitch(!x.done);
    const r = await logHabit(x, { sfx: () => setTimeout(sfxComplete, 120) });
    if (r === 'complete' || r === 'step') flash(x.key, r);
  };
  const onTask = async (x) => { sfxBlip(x.done ? 520 : 1040); const r = await toggleTask(x, { sfx: () => setTimeout(sfxComplete, 80) }); if (r === 'complete') flash(x.key); };
  const P = { high: 'P1', medium: 'P2', low: 'P3' };
  const tminus = (a) => { if (a.when === 'Now') return 'NOW'; const d = hmToMin(a.start) - D.mins; return d > 0 ? `T-${pad(Math.floor(d / 60))}:${pad(d % 60)}` : fmtHM(a.start); };

  return (
    <div className="screen fade-in lx lx-hud">
      {/* ---------- top bar ---------- */}
      <header className="h-top">
        <div className="h-id">
          <span className="h-led on" />
          <span>KZN-01</span>
          <span className="h-sep">/</span>
          <span>{up(DAYS_SHORT[D.d.getDay()])} {pad(D.d.getDate())} {up(MONTHS[D.d.getMonth()])}</span>
          <span className="h-sep">/</span>
          <span className="num">{pad(now.getHours())}:{pad(now.getMinutes())}</span>
        </div>
        <button className="h-pilot" onClick={go.you} aria-label="You"><span className="h-port"><Kai D={D} size={32} /></span><span className="h-pl"><small>PILOT</small><b>LV {pad(D.xp.level)}</b></span></button>
      </header>
      <div className="h-greet">{up(D.allDone ? 'All systems nominal' : D.greeting)}{D.name ? `, ${up(D.name)}` : ''}</div>

      {/* ---------- main instrument ---------- */}
      <section className="h-panel h-main">
        <i className="h-br tl" /><i className="h-br tr" /><i className="h-br bl" /><i className="h-br br" />
        <div className="h-gwrap">
          <Gauge value={D.score} />
          <div className="h-gread"><b className="num">{pad(D.score, 3)}</b><small>DAY SCORE</small></div>
        </div>
        <div className="h-minis">{D.rings.map((r) => <Mini key={r.key} r={r} />)}</div>
        <div className="h-status">
          <span className="h-chip cyan">XP +{pad(D.xp.today)}</span>
          <span className={`h-chip ${D.streak > 1 ? 'green' : ''}`}>STREAK {pad(D.streak)}D</span>
          {D.restDay && <span className="h-chip cyan">REST DAY</span>}
          {D.energy && <span className="h-chip amber">PWR: {up(D.energy.label)}</span>}
          {D.energy && D.energy.debt >= 1 && <span className="h-chip red">SLEEP DEBT {D.energy.debt.toFixed(1)}H</span>}
        </div>
      </section>

      {/* ---------- cautions ---------- */}
      {D.prompts.map((p) => (
        <button key={p.k} className="h-caution" onClick={p.go}>
          <span className="h-stripe" />
          <AlertTriangle size={18} className="h-warn" />
          <span className="grow" style={{ minWidth: 0 }}><small>CAUTION</small><b>{up(p.title)}</b><em>{p.sub}</em></span>
          <span className="h-engage">ENGAGE</span>
        </button>
      ))}

      {/* ---------- mission objective ---------- */}
      {D.intention && (
        <section className="h-panel h-term">
          <div className="h-ph"><Cpu size={13} /> MISSION OBJECTIVE</div>
          <p><span className="h-prompt">&gt;</span> {D.intention}<span className="h-cursor" /></p>
        </section>
      )}

      {/* ---------- radar ---------- */}
      <section className="h-panel">
        <div className="h-ph"><Radar size={13} /> RADAR <button className="h-link" onClick={go.plan}>PLAN <ChevronRight size={12} /></button></div>
        <button className="h-radrow" onClick={go.plan}>
          <Radar_ agenda={D.agenda} mins={D.mins} />
          <span className="h-contacts">
            {D.agenda.length ? D.agenda.map((a) => (
              <span key={a.key} className={`h-contact ${a.when === 'Now' ? 'now' : ''}`} style={{ '--bc': a.color }}>
                <em className="num">{tminus(a)}</em><b className="ellipsis">{up(a.title)}</b>
              </span>
            )) : <span className="h-dim">NO CONTACTS · AIRSPACE CLEAR</span>}
            {D.energy?.tip && <span className="h-dim sm">{D.energy.tip}</span>}
          </span>
        </button>
      </section>

      {/* ---------- systems (habits) ---------- */}
      <section className="h-panel">
        <div className="h-ph"><Power size={13} /> SYSTEMS <span className="h-count num">{pad(countDone(D.habits))}/{pad(D.habits.length)} ONLINE</span><button className="h-link" onClick={go.habits}>CONFIG <ChevronRight size={12} /></button></div>
        {D.habits.length ? (
          <div className="h-sys">
            {D.habits.map((x) => (
              <div key={x.key} className={`h-sw ${x.done ? 'on' : ''} ${fx[x.key] ? 'blink' : ''}`} style={{ '--sc': x.color }}>
                <span className={`h-led ${x.done ? 'on' : x.amt ? 'part' : ''}`} />
                <button className="h-swn" onClick={() => openHabit(x)}>
                  <b className="ellipsis">{up(x.name)}</b>
                  {x.target > 1 ? (
                    <span className="h-seg">{x.target <= 12 ? Array.from({ length: x.target }, (_, i) => <i key={i} className={i < x.amt ? 'on' : ''} />) : <i className="bar"><u style={{ width: `${x.prog * 100}%` }} /></i>}<em className="num">{x.amt}/{x.target}</em></span>
                  ) : <small>{up(x.sub)}</small>}
                </button>
                {x.target > 1 && !x.done ? (
                  <button className="h-push" onClick={() => onHabit(x)} aria-label={`Log ${x.name}`}><Plus size={18} strokeWidth={3} /></button>
                ) : (
                  <button className={`h-toggle ${x.done ? 'on' : ''}`} onClick={() => onHabit(x)} aria-label={x.name}><i /></button>
                )}
              </div>
            ))}
          </div>
        ) : <button className="h-new" onClick={go.addHabit}>&gt; INSTALL FIRST SYSTEM (ADD HABIT)</button>}
      </section>

      {/* ---------- mission log (tasks) ---------- */}
      <section className="h-panel h-log">
        <div className="h-ph"><Activity size={13} /> MISSION LOG <span className="h-count num">{pad(countDone(D.tasks))}/{pad(D.tasks.length)}</span><button className="h-link" onClick={go.plan}>PLAN <ChevronRight size={12} /></button></div>
        {D.tasks.map((x) => (
          <div key={x.key} className={`h-line ${x.done ? 'done' : ''} ${fx[x.key] ? 'blink' : ''}`} onClick={() => openTask(x)}>
            <button className="h-brk" onClick={(e) => { e.stopPropagation(); onTask(x); }} aria-label="Complete">[{x.done ? 'x' : ' '}]</button>
            <span className="grow" style={{ minWidth: 0 }}>
              <span className="h-lt">{x.title}</span>
              <span className="h-lm">{x.prio && <em className={`p-${x.prio}`}>{P[x.prio]}</em>}{x.overdue && <em className="late">LATE</em>}{x.meta.map((m) => <span key={m}>{up(m)}</span>)}</span>
            </span>
          </div>
        ))}
        {D.people.map((p) => (
          <button key={p.key} className="h-line comms" onClick={p.go}>
            <span className="h-brk">[☏]</span>
            <span className="grow" style={{ minWidth: 0 }}><span className="h-lt">COMMS: {p.name}</span><span className="h-lm"><span>{up(p.sub)}</span></span></span>
          </button>
        ))}
        <button className="h-line add" onClick={go.addTask}><span className="h-brk">&gt;</span><span className="h-lt">new_task<span className="h-cursor" /></span></button>
      </section>

      {/* ---------- trajectory (goals) ---------- */}
      {D.goals.length > 0 && (
        <section className="h-panel">
          <div className="h-ph"><Navigation size={13} /> TRAJECTORY <button className="h-link" onClick={go.goals}>ALL <ChevronRight size={12} /></button></div>
          <div className="h-tanks">
            {D.goals.map((g) => (
              <button key={g.key} className="h-tank" onClick={g.go} style={{ '--gc': g.color }}>
                <span className="h-tank-h"><b className="ellipsis">{up(g.title)}</b><em className="num">{pad(g.value * 100, 3)}%</em></span>
                <span className="h-tank-bar"><i style={{ width: `${g.value * 100}%` }} />{Array.from({ length: 9 }, (_, i) => <u key={i} style={{ left: `${(i + 1) * 10}%` }} />)}</span>
                <span className="h-tank-f"><span>{up(g.kind)} · {up(g.label)}{g.checkinDue ? <em> · CHECK-IN DUE</em> : null}</span><span>ETA {up(g.left)}</span></span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ---------- engine (workout) ---------- */}
      {D.workout && (
        <section className="h-panel h-engine">
          <div className="h-ph"><Fuel size={13} /> ENGINE TEST</div>
          <button className={`h-ign-row ${D.workout.done ? 'done' : ''}`} onClick={D.workout.go}>
            <span className="grow" style={{ minWidth: 0 }}>{D.workout.parts.map((p, i) => <span key={i} className="h-drill">{up(p.name)} <em>L{p.level}</em></span>)}</span>
            <span className="h-ign">{D.workout.done ? <Check size={22} /> : <><Power size={18} /><small>IGNITE</small></>}</span>
          </button>
        </section>
      )}

      {/* ---------- nav computer (study) ---------- */}
      {D.study && (
        <section className="h-panel">
          <div className="h-ph"><Database size={13} /> NAV COMPUTER {D.study.streak > 0 && <span className="h-count num">{pad(D.study.streak)}D STREAK</span>}<button className="h-link" onClick={D.study.all}>MAPS <ChevronRight size={12} /></button></div>
          <div className="h-nav">
            {D.study.subjects.map((s) => (
              <button key={s.key} className="h-wp" onClick={s.go} style={{ '--wc': s.color }}>
                <span className="h-wp-ic"><HIcon icon={s.icon} size={15} color="currentColor" /></span>
                <span className="grow" style={{ minWidth: 0 }}>
                  <small>{up(s.title)} · {s.mins ? `${s.mins}/${s.goal}` : `0/${s.goal}`} MIN</small>
                  <b className="ellipsis">NEXT WAYPOINT: {s.next}</b>
                  <span className="h-wp-bar"><i style={{ width: `${s.prog * 100}%` }} /></span>
                </span>
              </button>
            ))}
            {D.study.due > 0 && (
              <button className="h-wp sync" onClick={D.study.review} style={{ '--wc': 'var(--task)' }}>
                <span className="h-wp-ic"><Database size={15} /></span>
                <span className="grow"><small>MEMORY BANKS</small><b>{pad(D.study.due)} CARD{D.study.due > 1 ? 'S' : ''} PENDING SYNC</b></span>
                <span className="h-engage">SYNC</span>
              </button>
            )}
          </div>
        </section>
      )}

      {/* ---------- lab modules ---------- */}
      {D.experiments.length > 0 && (
        <section className="h-panel">
          <div className="h-ph"><FlaskConical size={13} /> LAB MODULES</div>
          {D.experiments.map((e) => (
            <button key={e.key} className="h-lab" onClick={e.go}>
              <span className="grow" style={{ minWidth: 0 }}>
                <b className="ellipsis">{up(e.title)}</b>
                <span className="h-labseg">{Array.from({ length: Math.min(e.days, 21) }, (_, i) => <i key={i} className={i < e.day - 1 ? 'p' : i === e.day - 1 ? 'n' : ''} />)}</span>
              </span>
              <span className={`h-chip ${e.log?.did ? 'green' : e.log ? '' : 'amber'}`}>{e.over ? 'REVIEW' : e.log ? (e.log.did ? 'LOGGED' : 'SKIPPED') : `DAY ${pad(e.day)}/${pad(e.days)}`}</span>
            </button>
          ))}
        </section>
      )}

      {/* ---------- fuel / autopilot / telemetry ---------- */}
      <section className="h-trio">
        <button className="h-panel h-cell" onClick={go.money}><small>FUEL BURN</small><b className="num">{D.spentLabel}</b><em>{D.untagged ? `${D.untagged} UNTAGGED` : 'TODAY'}</em></button>
        <button className="h-panel h-cell" onClick={go.bored}><small>AUTOPILOT</small><b>BORED?</b><em>PICK A HEADING</em></button>
        <button className="h-panel h-cell wide" onClick={go.insights}><small>TELEMETRY</small><b>INSIGHTS</b><em>SLEEP · MOOD · MONEY · HABITS</em><ChevronRight size={16} className="h-tel" /></button>
      </section>

      <button className="h-fab" onClick={() => setQa(true)} aria-label="Quick add"><span>ACTION</span><Plus size={22} strokeWidth={3} /></button>
      <QuickSheet open={qa} onClose={() => setQa(false)} t={D.t} skin="h-qa" title="Action" tile={(x) => <><x.i size={20} color={x.c} /><span>{up(x.l)}</span></>} />
    </div>
  );
}
