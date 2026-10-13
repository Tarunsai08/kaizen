// Study as a BYJU'S-style learning journey.
// Study home → subject (chapters) → chapter (Learn / Active Learn / Exercise, concept cards) → concept path (pins on a
// dashed trail with a Continue card) → lesson → "lesson complete" → up next.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft, ArrowRight, Play, Check, Star, Trophy, Flame, Brain, Lightbulb, BarChart3, Plus, Clock, Code, ChevronRight,
  Rocket, Plane, Magnet, Atom, Telescope, Puzzle, Compass, Sigma, Binary, Database, Network, Cpu, Layers, Sparkles,
} from 'lucide-react';
import { db } from '../../db';
import { useApp } from '../../ctx';
import { HIcon } from '../../ui/icons';
import { tap, success } from '../../lib/native';
import { sfxFanfare, sfxTravel, sfxArrive, sfxBlip } from '../../lib/sound';
import { findNode, isLeaf, firstUndone, lastCompleted, subjectTally } from '../../lib/study';
import { useStudy, useStudyToday, AddSubjectSheet } from '../../screens/Study';
import { useSubject } from '../../screens/Roadmap';
import { useXP } from '../../screens/You';
import './journey.css';

const leavesOf = (n) => { const out = []; const go = (x) => (isLeaf(x) ? out.push(x) : (x.children || []).forEach(go)); go(n); return out; };
const tint = (subject) => ({ '--sc': subject?.color || '#f7931e' });
const pad2 = (n) => String(n).padStart(2, '0');
const hash = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
const ART = [Rocket, Plane, Magnet, Atom, Telescope, Puzzle, Compass, Sigma, Binary, Database, Network, Cpu, Layers, Lightbulb, Brain, Code];
const isPractice = (leaf) => (leaf.resources || []).some((r) => r.kind === 'practice' || r.medium === 'problem' || r.medium === 'exercise');
const hasVideo = (leaf) => (leaf.resources || []).some((r) => r.medium === 'video');

/** A soft round spot with an icon — stands in for BYJU'S card illustrations. */
function Spot({ seed, size = 92 }) {
  const I = ART[hash(seed) % ART.length];
  const tone = hash(seed) % 3;
  return (
    <span className={`bj-spot t${tone}`} style={{ width: size, height: size }}>
      <I size={size * 0.42} strokeWidth={1.7} className="a" />
    </span>
  );
}

/** Progress mark on a concept card: arrow (not started), ring (in progress), tick (done). */
function Mark({ d, n }) {
  if (n && d >= n) return <span className="bj-mark done"><Check size={13} strokeWidth={3.4} /></span>;
  if (d > 0) return <span className="bj-mark ring"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" className="bg" /><circle cx="12" cy="12" r="9" className="fg" pathLength="100" strokeDasharray={`${(d / n) * 100} 100`} /></svg></span>;
  return <span className="bj-mark go"><ArrowRight size={13} strokeWidth={3} /></span>;
}

/* ================================================================ Study home */
export function StudyHome() {
  const { push, settings } = useApp();
  const { ready, data } = useStudy();
  const st = useStudyToday();
  const xp = useXP();
  const [add, setAdd] = useState(false);
  const last = useLiveQuery(() => db.studySessions.toCollection().last(), []);
  if (!ready) return <div className="screen bj" />;
  const active = data.filter((d) => d.s.active !== false);
  const cont = (last && active.find((d) => d.s.sid === last.sid && d.next)) || active.find((d) => d.next);
  const goalMins = active.reduce((a, d) => a + (d.s.dailyMins || 0), 0) || 30;
  const todayMins = Object.values(st?.mins || {}).reduce((a, b) => a + b, 0);

  return (
    <div className="screen bj bj-home fade-in">
      <div className="bj-hhead">
        <div>
          <div className="bj-hi">Hi {settings.name || 'there'},</div>
          <div className="bj-hq">Let’s keep learning</div>
        </div>
        <div className="row gap-6">
          <button className="bj-round" onClick={() => push('StudyStats')} aria-label="Stats"><BarChart3 size={18} /></button>
          <button className="bj-round" onClick={() => setAdd(true)} aria-label="Add subject"><Plus size={19} /></button>
        </div>
      </div>
      <div className="bj-strip">
        <div><Flame size={16} /><b>{st?.streak || 0}</b><span>day streak</span></div>
        <div><Clock size={16} /><b>{todayMins}<small>/{goalMins}</small></b><span>min today</span></div>
        <div><Star size={16} /><b>{xp?.total.level || 1}</b><span>level</span></div>
      </div>

      {cont && (
        <div className="bj-cont">
          <div className="bj-deco"><Spot seed={cont.next.title} size={120} /></div>
          <small>Continue learning · {cont.s.title}</small>
          <b className="clamp2">{cont.next.title}</b>
          <span className="sub ellipsis">{cont.nextPath?.[0]?.title || ''}</span>
          <div className="bj-prog"><i style={{ width: `${cont.t.total ? (cont.t.done / cont.t.total) * 100 : 0}%` }} /></div>
          <span className="sub">{pad2(cont.t.done)}/{pad2(cont.t.total)} Concepts</span>
          <button className="bj-btn" onClick={() => push('Lesson', { sid: cont.s.sid, id: cont.next.id })}>Continue</button>
        </div>
      )}

      <div className="bj-h">Subjects</div>
      <div className="bj-subs">
        {active.map((d) => {
          const p = d.t.total ? d.t.done / d.t.total : 0;
          return (
            <button key={d.s.sid} className="bj-sub" style={{ '--c': d.s.color }} onClick={() => push('SubjectJourney', { sid: d.s.sid })}>
              <span className="ic"><HIcon icon={d.s.icon} size={24} color="#fff" /></span>
              <b>{d.s.title}</b>
              <small>{d.s.children?.length || 0} Chapters</small>
              <span className="bj-prog thin"><i style={{ width: `${p * 100}%` }} /></span>
            </button>
          );
        })}
      </div>

      <div className="bj-h">Practice & revise</div>
      <button className="bj-row" onClick={() => push('ReviewDeck')}>
        <span className="ic"><Brain size={20} /></span>
        <span className="grow"><b>Revision</b><small>{st?.due ? `${st.due} card${st.due > 1 ? 's' : ''} ready` : 'All caught up'}</small></span>
        {st?.due > 0 && <span className="bj-badge">{Math.min(99, st.due)}</span>}
        <ChevronRight size={18} />
      </button>
      <button className="bj-row" onClick={() => push('Space', { k: 'learnings' })}>
        <span className="ic"><Lightbulb size={20} /></span>
        <span className="grow"><b>Learnings</b><small>Ideas to remember, experiments to try</small></span>
        <ChevronRight size={18} />
      </button>
      <AddSubjectSheet open={add} onClose={() => setAdd(false)} />
    </div>
  );
}

/* ================================================================ subject: chapters */
export function SubjectJourney({ sid }) {
  const { push, pop, settings } = useApp();
  const { subject, done, loading } = useSubject(sid);
  if (loading || !subject) return <div className="screen no-nav bj" />;
  const tal = subjectTally(subject, done);
  const next = firstUndone(subject.children, done);
  return (
    <div className="screen no-nav page-enter bj bj-chs" style={tint(subject, settings)}>
      <div className="bj-decoTR"><Spot seed={subject.title} size={150} /></div>
      <button className="bj-back" onClick={pop} aria-label="Back"><ArrowLeft size={22} /></button>
      <h1 className="bj-title">{subject.title}</h1>
      <div className="bj-prog"><i style={{ width: `${tal.total ? (tal.done / tal.total) * 100 : 0}%` }} /></div>
      <div className="bj-count">{pad2(tal.done)}/{pad2(tal.total)} Concepts</div>
      {next && <button className="bj-btn wide" onClick={() => push('Lesson', { sid, id: next.id })}>{tal.done ? 'Continue' : 'Start'} · <span className="ellipsis">{next.title}</span></button>}
      <div className="bj-list">
        {(subject.children || []).map((ch, i) => {
          const ls = leavesOf(ch), d = ls.filter((l) => done.has(l.id)).length;
          return (
            <button key={ch.id} className="bj-chrow" onClick={() => push('ChapterJourney', { sid, id: ch.id })}>
              <Spot seed={ch.title} size={58} />
              <span className="grow tx">
                <small>Chapter {i + 1}</small>
                <b className="clamp2">{ch.title.replace(/^Step \d+:\s*/, '')}</b>
                <span className="bj-prog thin"><i style={{ width: `${ls.length ? (d / ls.length) * 100 : 0}%` }} /></span>
              </span>
              <Mark d={d} n={ls.length} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================ chapter: Learn / Active Learn / Exercise */
export function ChapterJourney({ sid, id }) {
  const { push, pop, settings } = useApp();
  const { subject, done, loading } = useSubject(sid);
  const [tab, setTab] = useState('learn');
  if (loading || !subject) return <div className="screen no-nav bj" />;
  const hit = findNode(subject, id);
  if (!hit) return <div className="screen no-nav bj" />;
  const ch = hit.node;
  const nested = (ch.children || []).some((c) => !isLeaf(c));
  const concepts = nested ? ch.children : (ch.children || []);
  const stat = (c) => { const ls = leavesOf(c); return { n: ls.length, d: ls.filter((l) => done.has(l.id)).length }; };
  const doneConcepts = concepts.filter((c) => { const s = stat(c); return s.n && s.d >= s.n; }).length;
  const practice = leavesOf(ch).filter(isPractice);
  const open = (c) => (isLeaf(c) ? push('Lesson', { sid, id: c.id }) : push('ConceptPath', { sid, id: c.id }));

  return (
    <div className="screen no-nav page-enter bj bj-ch" style={tint(subject, settings)}>
      <div className="bj-decoTR"><Spot seed={ch.title} size={160} /><Rocket className="f1" size={22} /><Lightbulb className="f2" size={20} /></div>
      <button className="bj-back" onClick={pop} aria-label="Back"><ArrowLeft size={22} /></button>
      <h1 className="bj-title">{ch.title.replace(/^Step \d+:\s*/, '')}</h1>
      <div className="bj-prog"><i style={{ width: `${concepts.length ? (doneConcepts / concepts.length) * 100 : 0}%` }} /></div>
      <div className="bj-count">{pad2(doneConcepts)}/{pad2(concepts.length)} Concepts</div>
      <div className="bj-tabs">
        {[['learn', 'Learn'], ['active', 'Active Learn'], ['exercise', 'Exercise']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => { tap(); setTab(k); }}>{l}</button>
        ))}
      </div>

      {tab === 'learn' && (
        <div className="bj-grid">
          {concepts.map((c) => {
            const s = stat(c);
            return (
              <button key={c.id} className="bj-card" onClick={() => open(c)}>
                <span className="top"><small>{s.n} Concept{s.n === 1 ? '' : 's'}</small><Mark d={s.d} n={s.n} /></span>
                <b className="clamp3">{c.title}</b>
                <Spot seed={c.title} size={86} />
              </button>
            );
          })}
        </div>
      )}
      {tab === 'active' && <PathMap sid={sid} leaves={leavesOf(ch)} done={done} embedded />}
      {tab === 'exercise' && (
        <div className="bj-ex">
          {(practice.length ? practice : leavesOf(ch)).map((l) => (
            <button key={l.id} className={`bj-exrow ${done.has(l.id) ? 'done' : ''}`} onClick={() => push('Lesson', { sid, id: l.id })}>
              <span className="q">{done.has(l.id) ? <Check size={16} strokeWidth={3} /> : 'Q'}</span>
              <span className="grow tx"><b className="clamp2">{l.title}</b><small>{l.difficulty || (isPractice(l) ? 'Practice' : 'Recall')}</small></span>
              <span className="go">{done.has(l.id) ? 'Revise' : 'Solve'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================ concept path (pins on a dashed trail) */
export function ConceptPath({ sid, id }) {
  const { pop, settings } = useApp();
  const { subject, done, loading } = useSubject(sid);
  if (loading || !subject) return <div className="screen no-nav bj" />;
  const hit = findNode(subject, id);
  if (!hit) return <div className="screen no-nav bj" />;
  return (
    <div className="screen no-nav page-enter bj bj-pathpage" style={tint(subject, settings)}>
      <button className="bj-back2" onClick={pop} aria-label="Back"><ArrowLeft size={22} /><i /></button>
      <PathMap sid={sid} leaves={leavesOf(hit.node)} done={done} />
    </div>
  );
}

const GAP = 200, CARD = 290, XS = [0.34, 0.6, 0.38, 0.64];
function PathMap({ sid, leaves, done, embedded }) {
  const { push } = useApp();
  const wrap = useRef();
  const [w, setW] = useState(360);
  const cur = leaves.findIndex((l) => !done.has(l.id));
  const [sel, setSel] = useState(cur < 0 ? leaves.length - 1 : cur);
  const [arrive, setArrive] = useState(null);
  useEffect(() => { if (wrap.current) setW(wrap.current.clientWidth); }, []);
  useEffect(() => { setSel(cur < 0 ? leaves.length - 1 : cur); }, [cur]);
  // positions: the selected pin gets room above it for its card
  const pos = useMemo(() => {
    let y = embedded ? 30 : 110;
    return leaves.map((l, i) => { if (i === sel) y += CARD; const p = { x: XS[i % 4], y }; y += GAP; return p; });
  }, [leaves, sel, embedded]);
  const h = (pos.length ? pos[pos.length - 1].y : 0) + 150;
  useEffect(() => {
    const i = leaves.findIndex((l) => l.id === lastCompleted.id);
    if (i < 0 || Date.now() - lastCompleted.ts > 20000) return;
    lastCompleted.id = null;
    setArrive(i + 1); sfxTravel(700); setTimeout(() => sfxArrive(), 750); setTimeout(() => setArrive(null), 1600);
  }, []);
  useEffect(() => {
    const el = wrap.current?.querySelector('.bj-node.sel');
    if (el) setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 200);
  }, [sel]);
  const pt = (i) => [pos[i].x * w, pos[i].y];
  const seg = (i) => { const [x1, y1] = pt(i - 1), [x2, y2] = pt(i); const my = (y1 + y2) / 2; return `C ${x1 + (x2 > x1 ? -30 : 30)} ${my}, ${x2 + (x2 > x1 ? 40 : -40)} ${my}, ${x2} ${y2}`; };
  const d = pos.length ? `M ${pt(0).join(' ')} ` + pos.slice(1).map((_, k) => seg(k + 1)).join(' ') : '';
  const s = leaves[sel];
  const sp = pos[sel];

  return (
    <div className={`bj-map ${embedded ? 'emb' : ''}`} ref={wrap} style={{ height: h }}>
      <Decor h={h} />
      <svg className="bj-trail" width={w} height={h}><path d={d} /></svg>
      {leaves.map((l, i) => {
        const st = done.has(l.id) ? 'done' : i === cur ? 'cur' : 'todo';
        return (
          <div key={l.id} className={`bj-node ${st} ${i === sel ? 'sel' : ''} ${arrive === i ? 'arrive' : ''}`} style={{ left: pos[i].x * w, top: pos[i].y }}>
            <span className="lbl">{l.title}</span>
            <span className="glow" />
            <button className="pin" onClick={() => { tap(); setSel(i); }} aria-label={l.title}>
              <svg viewBox="0 0 40 48"><defs><linearGradient id={`pg${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="s1" /><stop offset="1" className="s2" /></linearGradient></defs>
                <path d="M20 2C30.5 2 38 9.8 38 19.6 38 31.6 20 46 20 46S2 31.6 2 19.6C2 9.8 9.5 2 20 2Z" fill={`url(#pg${i})`} />
                <circle cx="20" cy="19" r="8.5" fill="#fff" />
                {st === 'done' && <path d="M16 19.2l2.8 2.8 5.4-5.6" fill="none" className="tick" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />}
              </svg>
            </button>
          </div>
        );
      })}
      {s && sp && (
        <div className="bj-pop" style={{ top: sp.y - CARD + 8 }} key={s.id}>
          <b className="clamp2">{s.title}</b>
          <div className="icons">
            <button onClick={() => push('Lesson', { sid, id: s.id })} aria-label="Watch or read"><Play size={17} /></button>
            <button onClick={() => push('Lesson', { sid, id: s.id })} aria-label="Quiz yourself"><span className="qq">Q</span></button>
          </div>
          <button className="bj-btn" onClick={() => push('Lesson', { sid, id: s.id })}>{done.has(s.id) ? 'Revise' : sel === cur && done.size ? 'Continue' : 'Start'}</button>
        </div>
      )}
      {cur < 0 && leaves.length > 0 && <div className="bj-finish" style={{ top: h - 70 }}><Trophy size={26} /> All concepts done</div>}
    </div>
  );
}

/* the yellow blobs, cream circles and dots behind the path (one SVG per 900px tile) */
const DOTS = [[46, 160], [250, 110], [80, 330], [320, 440], [30, 520], [230, 610], [330, 760], [150, 850]];
// One 900px tile repeats down the path. Every shape closes inside its tile, so nothing is sliced where tiles meet.
function Decor({ h }) {
  const tiles = Math.ceil(h / 900);
  return (
    <div className="bj-decor" aria-hidden="true">
      {Array.from({ length: tiles }, (_, t) => (
        <svg key={t} className="tile" style={{ top: t * 900 }} viewBox="0 0 360 900" preserveAspectRatio="none">
          <ellipse className="cream" cx="380" cy="270" rx="120" ry="190" />
          <path className="blob" d="M360 150 C305 185 270 240 282 292 C294 340 330 365 360 400Z" />
          <ellipse className="cream" cx="-10" cy="730" rx="110" ry="130" />
          <path className="blob" d="M0 610 C34 618 62 652 60 700 C58 742 82 772 74 812 C68 842 44 868 0 876Z" />
          {DOTS.map(([x, y], i) => (i % 3 === 0
            ? <path key={i} className="dot" d={`M${x} ${y} q6 -10 12 0 q-6 8 -12 0Z`} transform={`rotate(-30 ${x} ${y})`} />
            : <circle key={i} className="dot" cx={x} cy={y} r="4.5" />))}
        </svg>
      ))}
    </div>
  );
}

/* ================================================================ after a lesson */
export function LessonDone({ sid, id, mins = 0 }) {
  const { push, pop, settings } = useApp();
  const { subject, done, loading } = useSubject(sid);
  const [count, setCount] = useState(6);
  const [hold, setHold] = useState(false);
  useEffect(() => { success(); sfxFanfare(); }, []);
  const hit = !loading && subject ? findNode(subject, id) : null;
  const concept = hit?.path?.[hit.path.length - 1];
  const chapter = hit?.path?.[0];
  const nextInConcept = concept ? firstUndone([concept], new Set([...done, id])) : null;
  const next = nextInConcept || (subject ? firstUndone(subject.children, new Set([...done, id])) : null);
  const conceptDone = concept && !nextInConcept;
  useEffect(() => {
    if (!next || hold) return;
    if (count <= 0) { go(); return; }
    const tm = setTimeout(() => { setCount((c) => c - 1); if (count <= 3) sfxBlip(520 + (3 - count) * 120); }, 1000);
    return () => clearTimeout(tm);
  }, [count, hold, !!next]);
  const go = () => { pop(); setTimeout(() => push('Lesson', { sid, id: next.id }), 0); };
  const back = () => { setHold(true); pop(); if (concept) setTimeout(() => push(concept.id === chapter?.id ? 'ChapterJourney' : 'ConceptPath', { sid, id: concept.id }), 0); };
  if (loading || !hit) return <div className="screen no-nav bj" />;
  return (
    <div className="bj bj-done" style={tint(subject, settings)}>
      <Decor h={900} />
      <div className="bj-confetti">{Array.from({ length: 16 }, (_, i) => <i key={i} style={{ '--a': `${i * 22.5}deg`, '--d': `${(i % 4) * 50}ms` }} />)}</div>
      <div className="medal">{conceptDone ? <Trophy size={50} /> : <Check size={56} strokeWidth={3.2} />}</div>
      <div className="stars"><Star size={24} fill="currentColor" /><Star size={34} fill="currentColor" /><Star size={24} fill="currentColor" /></div>
      <h1>{conceptDone ? 'Concept complete!' : 'Well done!'}</h1>
      <p className="clamp2">You finished <b>{hit.node.title}</b></p>
      <div className="chips">
        <span><Sparkles size={14} /> +XP</span>
        {mins > 0 && <span><Clock size={14} /> {mins} min</span>}
        <span><Brain size={14} /> Added to revision</span>
      </div>
      {next ? (
        <div className="bj-pop static" onClick={() => setHold(true)}>
          <small>Up next</small>
          <b className="clamp2">{next.title}</b>
          <div className="icons">
            <span>{hasVideo(next) ? <Play size={17} /> : <Code size={16} />}</span>
            <span><span className="qq">Q</span></span>
            {!hold && <span className="cd"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" className="bg" /><circle cx="20" cy="20" r="17" className="fg" pathLength="100" strokeDasharray={`${((6 - count) / 6) * 100} 100`} /></svg><b>{Math.max(0, count)}</b></span>}
          </div>
          <button className="bj-btn" onClick={(e) => { e.stopPropagation(); go(); }}>Continue</button>
        </div>
      ) : <div className="bj-pop static"><b>You finished the whole roadmap!</b></div>}
      <button className="bj-link" onClick={back}>Back to the path</button>
    </div>
  );
}
