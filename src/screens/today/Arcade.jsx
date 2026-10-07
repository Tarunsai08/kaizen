import React, { useState } from 'react';
import { Plus, Check, ChevronRight, Phone, Brain, Coins, Shuffle, BarChart3, Swords, Gamepad2 } from 'lucide-react';
import { HIcon } from '../../ui/icons';
import { sfxCoin, sfxPower, sfxBlip } from '../../lib/sound';
import { fmtHM } from '../../lib/date';
import { useToday } from './useToday';
import { QuickSheet, useFlash, Kai, countDone } from './shared';
import './arcade.css';

const pad = (n, w = 2) => String(Math.max(0, Math.round(n))).padStart(w, '0');
const up = (s) => String(s || '').toUpperCase();
const STARS = { high: 3, medium: 2, low: 1 };
const SHORT = { habits: 'HAB', move: 'MOV', tasks: 'TSK', mind: 'MND' };

function Head({ children, right }) {
  return <h2 className="ar-h"><span className="ar-tri">▶</span><span>{children}</span>{right}</h2>;
}

export default function TodayArcade() {
  const { D, logHabit, toggleTask, openTask, openHabit, go } = useToday();
  const [fx, flash] = useFlash(800);
  const [qa, setQa] = useState(false);
  if (!D) return <div className="screen lx lx-ar" />;

  const onHabit = async (x) => {
    const r = await logHabit(x, { sfx: sfxPower });
    if (r === 'step') sfxCoin();
    if (r === 'complete' || r === 'step') flash(x.key, r);
  };
  const onTask = async (x) => { const r = await toggleTask(x, { sfx: sfxPower }); if (r === 'complete') flash(x.key); else sfxBlip(440); };
  const ticker = D.agenda.length ? D.agenda.map((a) => `${a.when === 'Now' ? 'NOW' : fmtHM(a.start)} ${up(a.title)}`).join('  ★  ') : 'FREE PLAY — NOTHING ELSE SCHEDULED';

  return (
    <div className="screen fade-in lx lx-ar">
      {/* ---------- cabinet screen ---------- */}
      <header className="ar-cab">
        <div className="ar-marquee"><span>★ KAIZEN ARCADE ★</span></div>
        <div className="ar-screen">
          <div className="ar-sun"><i /><i /><i /><i /></div>
          <div className="ar-grid" />
          <div className="ar-scan" />
          <div className="ar-hud">
            <span><small>1UP</small><b className="ar-pix">{up(D.name || 'PLAYER')}</b></span>
            <span className="c"><small>HI-SCORE</small><b className="ar-pix">{pad(D.best, 5)}</b></span>
            <button className="r" onClick={go.you} aria-label="You"><small>LEVEL</small><b className="ar-pix">{pad(D.xp.level)}</b></button>
          </div>
          <div className="ar-score">
            <small className="ar-pix">SCORE</small>
            <b className="ar-pix">{pad(D.score, 5)}</b>
            {D.allDone && <em className="ar-pix ar-blink">PERFECT!</em>}
          </div>
          <button className="ar-kai" onClick={go.you} aria-label="You"><Kai D={D} size={64} /></button>
          <div className="ar-sides">
            <span className="ar-pill pink"><b className="ar-pix">x{D.streak || 1}</b><small>COMBO</small></span>
            <span className="ar-pill yellow"><Coins size={13} /><b className="ar-pix">{pad(D.xp.today, 3)}</b><small>COINS</small></span>
          </div>
        </div>
        <div className="ar-bars">
          {D.rings.map((r) => (
            <div key={r.key} className={`ar-bar ${r.value == null ? 'off' : ''}`} style={{ '--bc': r.color }}>
              <span className="ar-pix">{SHORT[r.key] || up(r.label).slice(0, 3)}</span>
              <span className="ar-blocks">{Array.from({ length: 10 }, (_, i) => <i key={i} className={r.value != null && i < Math.round(r.value * 10) ? 'on' : ''} />)}</span>
            </div>
          ))}
        </div>
        <div className="ar-sub">{up(D.dateLabel)} · {up(D.greeting)}{D.restDay ? ' · REST DAY' : ''}</div>
      </header>

      {/* ---------- insert coin (prompts) ---------- */}
      {D.prompts.map((p) => (
        <button key={p.k} className="ar-coin" onClick={() => { sfxCoin(); p.go(); }}>
          <span className="ar-pix ar-blink">INSERT COIN</span>
          <span className="grow" style={{ minWidth: 0 }}><b>{p.title}</b><small>{p.sub}</small></span>
          <ChevronRight size={18} />
        </button>
      ))}

      {/* ---------- mission + ticker ---------- */}
      {D.intention && (
        <div className="ar-mission"><span className="ar-pix">MISSION</span><p>{D.intention}</p></div>
      )}
      <button className="ar-ticker" onClick={go.plan}>
        <span className="ar-pix ar-tick-l">NEXT</span>
        <span className="ar-tick"><span className="ar-tick-in">{ticker}  ★  {ticker}  ★  </span></span>
      </button>
      {D.energy && <div className="ar-energy"><span className="ar-pix">PWR</span> {D.energy.label}{D.energy.until ? ` until ${D.energy.until}` : ''}{D.energy.tip ? ` · ${D.energy.tip}` : ''}</div>}

      {/* ---------- power-ups (habits) ---------- */}
      <section className="ar-sec">
        <Head right={<span className="ar-r ar-pix">{countDone(D.habits)}/{D.habits.length}<button onClick={go.habits}>EDIT</button></span>}>POWER-UPS</Head>
        {D.habits.length ? (
          <div className="ar-blocks-grid">
            {D.habits.map((x) => (
              <div key={x.key} className="ar-pu">
                <button className={`ar-qb ${x.done ? 'used' : ''} ${fx[x.key] ? 'bump' : ''}`} style={{ '--pc': x.color }} onClick={() => onHabit(x)} aria-label={x.name}>
                  <span className="ar-qb-face">{x.done ? <Check size={30} strokeWidth={4} /> : x.amt ? <span className="ar-pix sm">{x.amt}/{x.target}</span> : <HIcon icon={x.icon} size={22} color="currentColor" />}</span>
                  <i className="ar-rivet a" /><i className="ar-rivet b" /><i className="ar-rivet c" /><i className="ar-rivet d" />
                  {fx[x.key] && <span className="ar-popcoin"><Coins size={16} /></span>}
                </button>
                <button className="ar-pu-n" onClick={() => openHabit(x)}><b className="ellipsis">{x.name}</b><small className="ellipsis">{x.done ? 'POWERED UP' : up(x.sub)}</small></button>
              </div>
            ))}
          </div>
        ) : <button className="ar-new" onClick={go.addHabit}><Plus size={15} /> ADD YOUR FIRST POWER-UP</button>}
      </section>

      {/* ---------- levels (tasks) ---------- */}
      <section className="ar-sec">
        <Head right={<span className="ar-r ar-pix">{countDone(D.tasks)}/{D.tasks.length}<button onClick={go.plan}>MAP</button></span>}>LEVELS</Head>
        <div className="ar-levels">
          {D.tasks.map((x, i) => (
            <div key={x.key} className={`ar-lv ${x.done ? 'clear' : ''} ${fx[x.key] ? 'just' : ''}`} onClick={() => openTask(x)}>
              <span className="ar-lv-n ar-pix">{Math.floor(i / 4) + 1}-{(i % 4) + 1}</span>
              <span className="grow" style={{ minWidth: 0 }}>
                <b className="ellipsis">{x.title}</b>
                <small>{x.prio && <em className="ar-stars">{'★'.repeat(STARS[x.prio])}<u>{'★'.repeat(3 - STARS[x.prio])}</u></em>}{x.overdue && <em className="ar-cont">CONTINUE?</em>}{x.meta.join(' · ')}</small>
              </span>
              <button className="ar-play" onClick={(e) => { e.stopPropagation(); onTask(x); }} aria-label="Complete">{x.done ? <Check size={18} strokeWidth={3.5} /> : <span className="ar-pix">GO</span>}</button>
              {x.done && <span className="ar-clear ar-pix">CLEAR!</span>}
            </div>
          ))}
          {D.people.map((p) => (
            <button key={p.key} className="ar-lv coop" onClick={p.go}>
              <span className="ar-lv-n ar-pix">2P</span>
              <span className="grow" style={{ minWidth: 0 }}><b className="ellipsis">Co-op: call {p.name}</b><small>{p.sub}</small></span>
              <span className="ar-play"><Phone size={15} /></span>
            </button>
          ))}
          <button className="ar-new" onClick={go.addTask}><Plus size={15} /> {D.tasks.length ? 'NEW LEVEL' : 'NO LEVELS TODAY — ADD ONE'}</button>
        </div>
      </section>

      {/* ---------- boss fights (goals) ---------- */}
      {D.goals.length > 0 && (
        <section className="ar-sec">
          <Head right={<span className="ar-r ar-pix"><button onClick={go.goals}>ALL</button></span>}>BOSS FIGHTS</Head>
          <div className="ar-bosses">
            {D.goals.map((g) => {
              const hp = Math.max(0, 1 - g.value);
              return (
                <button key={g.key} className="ar-boss" onClick={g.go} style={{ '--gc': g.color }}>
                  <span className="ar-boss-ic"><Swords size={18} /></span>
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="ar-boss-top"><b className="ellipsis">{g.title}</b>{g.checkinDue && <em className="ar-pix ar-blink">!</em>}</span>
                    <span className="ar-hp"><i style={{ width: `${hp * 100}%` }} /></span>
                    <span className="ar-boss-f"><span className="ar-pix">HP {pad(hp * 100)}%</span><span>{g.label} · {g.left}</span></span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ---------- training stage (workout) ---------- */}
      {D.workout && (
        <section className="ar-sec">
          <Head>TRAINING STAGE</Head>
          <button className={`ar-train ${D.workout.done ? 'done' : ''}`} onClick={D.workout.go}>
            <span className="grow" style={{ minWidth: 0 }}>{D.workout.parts.map((p, i) => <span key={i} className="ar-chip">{p.name} <em className="ar-pix">L{p.level}</em></span>)}</span>
            <span className="ar-start ar-pix">{D.workout.done ? 'CLEAR' : 'FIGHT!'}</span>
          </button>
        </section>
      )}

      {/* ---------- high scores (study) ---------- */}
      {D.study && (
        <section className="ar-sec">
          <Head right={<span className="ar-r ar-pix">{D.study.streak ? `${D.study.streak}D` : ''}<button onClick={D.study.all}>ALL</button></span>}>HIGH SCORES</Head>
          <div className="ar-table">
            <div className="ar-tr th ar-pix"><span>RNK</span><span>SUBJECT · NEXT</span><span>MIN</span></div>
            {D.study.subjects.map((s, i) => (
              <button key={s.key} className="ar-tr" onClick={s.go} style={{ '--sc': s.color }}>
                <span className="ar-pix rk">{['1ST', '2ND', '3RD'][i]}</span>
                <span className="nm"><small>{up(s.title)}</small><b className="ellipsis">{s.next}</b></span>
                <span className="ar-pix mn">{pad(s.mins)}<u>/{s.goal}</u></span>
              </button>
            ))}
            {D.study.due > 0 && (
              <button className="ar-bonus" onClick={D.study.review}><Brain size={16} /><span className="grow"><span className="ar-pix">BONUS ROUND</span><b>{D.study.due} card{D.study.due > 1 ? 's' : ''} to revise</b></span><ChevronRight size={16} /></button>
            )}
          </div>
        </section>
      )}

      {/* ---------- challenge mode (experiments) ---------- */}
      {D.experiments.length > 0 && (
        <section className="ar-sec">
          <Head>CHALLENGE MODE</Head>
          {D.experiments.map((e) => (
            <button key={e.key} className="ar-chal" onClick={e.go}>
              <span className="grow" style={{ minWidth: 0 }}>
                <b className="ellipsis">{e.title}</b>
                <span className="ar-chal-d">{Array.from({ length: Math.min(e.days, 21) }, (_, i) => <i key={i} className={i < e.day - 1 ? 'p' : i === e.day - 1 ? 'n' : ''} />)}</span>
              </span>
              <span className={`ar-tag ar-pix ${e.log?.did ? 'ok' : ''}`}>{e.over ? 'END' : e.log ? (e.log.did ? 'WIN' : 'SKIP') : `DAY ${e.day}`}</span>
            </button>
          ))}
        </section>
      )}

      {/* ---------- coins / random / stats ---------- */}
      <section className="ar-sec ar-btns">
        <button className="ar-btn" style={{ '--bc': '#ffe14d' }} onClick={() => { sfxCoin(); go.money(); }}><Coins size={20} /><small className="ar-pix">SPENT</small><b>{D.spentLabel}</b>{D.untagged > 0 && <em>{D.untagged} untagged</em>}</button>
        <button className="ar-btn" style={{ '--bc': '#22e6ff' }} onClick={() => { sfxBlip(); go.bored(); }}><Shuffle size={20} /><small className="ar-pix">RANDOM</small><b>I’m bored</b><em>pick a stage</em></button>
        <button className="ar-btn" style={{ '--bc': '#39ff88' }} onClick={() => { sfxBlip(); go.insights(); }}><BarChart3 size={20} /><small className="ar-pix">STATS</small><b>Insights</b><em>your patterns</em></button>
      </section>

      <button className="ar-fab" onClick={() => { sfxBlip(1200); setQa(true); }} aria-label="Quick add"><Gamepad2 size={22} /><span className="ar-pix">START</span></button>
      <QuickSheet open={qa} onClose={() => setQa(false)} t={D.t} skin="ar-qa" title="Select" tile={(x) => <><x.i size={20} color={x.c} /><span className="ar-pix">{up(x.l)}</span></>} />
    </div>
  );
}
