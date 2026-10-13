// Study as a learning journey (BYJU'S-style): home → subject → chapter journey → lesson → celebration → up next.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight, Play, Check, Lock, Star, Trophy, Flame, Brain, Lightbulb, BarChart3, Plus, Code, BookOpen, FileText, Dumbbell, Sparkles, Clock } from 'lucide-react';
import { db } from '../../db';
import { useApp } from '../../ctx';
import { HIcon } from '../../ui/icons';
import { tap, success } from '../../lib/native';
import { sfxFanfare, sfxTravel, sfxArrive, sfxBlip } from '../../lib/sound';
import { findNode, isLeaf, firstUndone, lastCompleted, subjectTally } from '../../lib/study';
import { useStudy, useStudyToday, AddSubjectSheet } from '../../screens/Study';
import { useSubject } from '../../screens/Roadmap';
import Companion from '../../ui/Companion';
import { useXP } from '../../screens/You';
import { stageFor } from '../../lib/xp';
import './journey.css';

const leavesOf = (n) => { const out = []; const go = (x) => (isLeaf(x) ? out.push(x) : (x.children || []).forEach(go)); go(n); return out; };
const kindIcon = (leaf) => {
  const r = (leaf.resources || [])[0];
  if (!r) return BookOpen;
  if (r.medium === 'video') return Play;
  if (r.medium === 'problem' || r.medium === 'code' || r.kind === 'practice') return Code;
  if (r.medium === 'exercise') return Dumbbell;
  return FileText;
};
const kindLabel = (leaf) => {
  const r = (leaf.resources || [])[0];
  if (!r) return 'Lesson';
  return r.medium === 'video' ? 'Video' : r.medium === 'problem' || r.kind === 'practice' ? 'Practice' : r.medium === 'paper' ? 'Paper' : 'Read';
};

/* ---------------------------------------------------------------- Study home */
export function StudyHome() {
  const { push, settings } = useApp();
  const { ready, data } = useStudy();
  const st = useStudyToday();
  const xp = useXP();
  const [add, setAdd] = useState(false);
  const last = useLiveQuery(() => db.studySessions.toCollection().last(), []);
  if (!ready) return <div className="screen" />;
  const active = data.filter((d) => d.s.active !== false);
  const cont = (last && active.find((d) => d.s.sid === last.sid && d.next)) || active.find((d) => d.next);
  const goalMins = active.reduce((a, d) => a + (d.s.dailyMins || 0), 0) || 30;
  const todayMins = Object.values(st?.mins || {}).reduce((a, b) => a + b, 0);
  const chapterOf = (d) => (d.nextPath?.[0]?.title) || '';
  const lvl = xp?.total.level || 1;

  return (
    <div className="screen jh fade-in">
      <div className="jh-hero">
        <div className="row between">
          <div>
            <div className="jh-hi">Hi {settings.name || 'there'},</div>
            <div className="jh-q">What will you learn today?</div>
          </div>
          <div className="row gap-6">
            <button className="jh-ic" onClick={() => push('StudyStats')} aria-label="Stats"><BarChart3 size={18} /></button>
            <button className="jh-ic" onClick={() => setAdd(true)} aria-label="Add subject"><Plus size={19} /></button>
          </div>
        </div>
        <div className="jh-stats">
          <div><Flame size={16} /><b className="num">{st?.streak || 0}</b><span>day streak</span></div>
          <div><Clock size={16} /><b className="num">{todayMins}/{goalMins}</b><span>min today</span></div>
          <div><Star size={16} /><b className="num">{lvl}</b><span>level</span></div>
        </div>
      </div>

      {cont && (
        <button className="jh-cont" style={{ '--c': cont.s.color }} onClick={() => push('Lesson', { sid: cont.s.sid, id: cont.next.id })}>
          <span className="art"><HIcon icon={cont.s.icon} size={30} color="#fff" /></span>
          <span className="grow tx">
            <small>Continue learning · {cont.s.title}</small>
            <b className="clamp2">{cont.next.title}</b>
            <em className="ellipsis">{chapterOf(cont)}</em>
            <i className="bar"><i style={{ width: `${cont.t.total ? (cont.t.done / cont.t.total) * 100 : 0}%` }} /></i>
          </span>
          <span className="play"><Play size={20} fill="currentColor" /></span>
        </button>
      )}

      <div className="jh-h">Your subjects</div>
      <div className="jh-grid">
        {active.map((d) => {
          const p = d.t.total ? d.t.done / d.t.total : 0;
          return (
            <button key={d.s.sid} className="jh-sub" style={{ '--c': d.s.color }} onClick={() => push('SubjectJourney', { sid: d.s.sid })}>
              <span className="glow" />
              <span className="ic"><HIcon icon={d.s.icon} size={26} color="#fff" /></span>
              <b>{d.s.title}</b>
              <small>{d.s.children?.length || 0} chapters · {d.t.total} lessons</small>
              <span className="pb"><i style={{ width: `${p * 100}%` }} /></span>
              <span className="pct num">{Math.round(p * 100)}%</span>
            </button>
          );
        })}
      </div>

      <div className="jh-h">Keep it sharp</div>
      <button className="jh-row" style={{ '--c': 'var(--task)' }} onClick={() => push('ReviewDeck')}>
        <span className="ic"><Brain size={20} /></span>
        <span className="grow"><b>Revision</b><small>{st?.due ? `${st.due} card${st.due > 1 ? 's' : ''} ready for a quick recall` : 'All caught up. New cards appear as you finish lessons.'}</small></span>
        {st?.due > 0 && <span className="badge-n num">{Math.min(99, st.due)}</span>}
        <ChevronRight size={18} />
      </button>
      <button className="jh-row" style={{ '--c': 'var(--goal)' }} onClick={() => push('Space', { k: 'learnings' })}>
        <span className="ic"><Lightbulb size={20} /></span>
        <span className="grow"><b>Learnings</b><small>Ideas to remember and experiments to try</small></span>
        <ChevronRight size={18} />
      </button>
      <div className="jh-kai"><Companion stage={stageFor(lvl).index} mood="happy" size={56} /><span>Every lesson grows your companion.</span></div>
      <AddSubjectSheet open={add} onClose={() => setAdd(false)} />
    </div>
  );
}

/* ---------------------------------------------------------------- subject: chapters */
export function SubjectJourney({ sid }) {
  const { push, pop } = useApp();
  const { subject, done, loading } = useSubject(sid);
  if (loading || !subject) return <div className="screen no-nav" />;
  const tal = subjectTally(subject, done);
  const next = firstUndone(subject.children, done);
  const chapters = (subject.children || []).map((ch, i) => {
    const ls = leavesOf(ch);
    const d = ls.filter((l) => done.has(l.id)).length;
    return { ch, i, n: ls.length, d, state: d === ls.length && ls.length ? 'done' : d > 0 || ls.some((l) => l.id === next?.id) ? 'now' : 'todo' };
  });
  const p = tal.total ? tal.done / tal.total : 0;
  return (
    <div className="screen no-nav page-enter js" style={{ '--c': subject.color }}>
      <div className="js-hero">
        <button className="jh-ic back" onClick={pop} aria-label="Back"><ChevronLeft size={22} /></button>
        <span className="js-art"><HIcon icon={subject.icon} size={44} color="#fff" /></span>
        <h1>{subject.title}</h1>
        {subject.description && <p className="clamp2">{subject.description}</p>}
        <div className="js-prog">
          <span className="pb"><i style={{ width: `${p * 100}%` }} /></span>
          <span className="num">{tal.done}/{tal.total} lessons · {Math.round(p * 100)}%</span>
        </div>
        {next && <button className="js-go" onClick={() => push('Lesson', { sid, id: next.id })}><Play size={16} fill="currentColor" /> {tal.done ? 'Continue' : 'Start'}: <span className="ellipsis">{next.title}</span></button>}
      </div>
      <div className="js-list">
        {chapters.map(({ ch, i, n, d, state }) => (
          <button key={ch.id} className={`js-ch ${state}`} onClick={() => push('ChapterJourney', { sid, id: ch.id })}>
            <span className="num-badge">{state === 'done' ? <Check size={18} strokeWidth={3} /> : i + 1}</span>
            <span className="grow tx">
              <b className="clamp2">{ch.title.replace(/^Step \d+:\s*/, '')}</b>
              <small>{n} lesson{n === 1 ? '' : 's'}{d ? ` · ${d} done` : ''}</small>
              <span className="pb"><i style={{ width: `${n ? (d / n) * 100 : 0}%` }} /></span>
            </span>
            <span className={`tag ${state}`}>{state === 'done' ? 'Completed' : state === 'now' ? 'Continue' : 'Start'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- chapter: the winding journey */
const ROW = 112, SEC = 74, X = [0.5, 0.74, 0.5, 0.26];
export function ChapterJourney({ sid, id }) {
  const { push, pop } = useApp();
  const { subject, done, loading } = useSubject(sid);
  const xp = useXP();
  const wrap = useRef();
  const [w, setW] = useState(360);
  const [arrive, setArrive] = useState(null);
  useEffect(() => { if (wrap.current) setW(wrap.current.clientWidth); }, [loading]);
  const hit = !loading && subject ? findNode(subject, id) : null;
  const ch = hit?.node;
  const layout = useMemo(() => {
    if (!ch) return null;
    const items = [];
    let y = 40, k = 0;
    const sections = ch.children?.some((c) => !isLeaf(c));
    (sections ? ch.children : [ch]).forEach((sec) => {
      if (sections) { items.push({ t: 'sec', title: sec.title, y }); y += SEC; }
      leavesOf(sec).forEach((leaf) => { items.push({ t: 'node', leaf, y: y + 34, x: X[k % 4], k }); y += ROW; k++; });
    });
    return { items, h: y + 40 };
  }, [ch]);
  // the "just completed" lesson travels to the next node once
  useEffect(() => {
    if (!layout || !lastCompleted.id || Date.now() - lastCompleted.ts > 20000) return;
    const i = layout.items.findIndex((x) => x.t === 'node' && x.leaf.id === lastCompleted.id);
    if (i < 0) return;
    lastCompleted.id = null;
    setArrive(layout.items[i].leaf.id);
    sfxTravel(800); setTimeout(() => sfxArrive(), 850);
    setTimeout(() => setArrive(null), 1800);
  }, [layout]);
  useEffect(() => {
    const cur = wrap.current?.querySelector('.jn-node.cur');
    if (cur) setTimeout(() => cur.scrollIntoView({ block: 'center', behavior: 'smooth' }), 250);
  }, [layout, loading]);
  if (loading || !subject || !ch) return <div className="screen no-nav" />;

  const nodes = layout.items.filter((x) => x.t === 'node');
  const curIdx = nodes.findIndex((x) => !done.has(x.leaf.id));
  const cur = curIdx >= 0 ? nodes[curIdx] : null;
  const pt = (n) => [n.x * w, n.y];
  const seg = (a, b) => { const [x1, y1] = pt(a), [x2, y2] = pt(b); const my = (y1 + y2) / 2; return `C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`; };
  const full = nodes.length ? `M ${pt(nodes[0]).join(' ')} ` + nodes.slice(1).map((n, i) => seg(nodes[i], n)).join(' ') : '';
  const reach = curIdx < 0 ? nodes.length - 1 : curIdx;
  const donePath = reach > 0 ? `M ${pt(nodes[0]).join(' ')} ` + nodes.slice(1, reach + 1).map((n, i) => seg(nodes[i], n)).join(' ') : '';
  const lastSeg = reach > 0 && arrive ? `M ${pt(nodes[reach - 1]).join(' ')} ${seg(nodes[reach - 1], nodes[reach])}` : '';
  const dCount = nodes.filter((n) => done.has(n.leaf.id)).length;
  const lvl = xp?.total.level || 1;

  return (
    <div className="screen no-nav page-enter jc" style={{ '--c': subject.color }}>
      <div className="jc-top">
        <button className="icon-btn ghost" onClick={pop} aria-label="Back"><ChevronLeft size={22} /></button>
        <div className="grow tx"><small>{subject.title}</small><b className="ellipsis">{ch.title}</b></div>
        <span className="jc-count num">{dCount}/{nodes.length}</span>
      </div>
      <div className="jc-bar"><i style={{ width: `${nodes.length ? (dCount / nodes.length) * 100 : 0}%` }} /></div>
      <div className="jc-map" ref={wrap} style={{ height: layout.h }}>
        <svg className="jc-road" width={w} height={layout.h}>
          <path d={full} className="track" />
          <path d={full} className="dash" />
          {donePath && <path d={donePath} className="done" />}
          {lastSeg && <path d={lastSeg} className="done fresh" pathLength="1" />}
        </svg>
        {layout.items.map((it, i) => it.t === 'sec' ? (
          <div key={'s' + i} className="jn-sec" style={{ top: it.y }}><span>{it.title}</span></div>
        ) : (() => {
          const isDone = done.has(it.leaf.id);
          const isCur = cur && cur.leaf.id === it.leaf.id;
          const I = kindIcon(it.leaf);
          const left = it.x <= 0.5;
          return (
            <div key={it.leaf.id} className={`jn-node ${isDone ? 'done' : isCur ? 'cur' : 'todo'} ${arrive === it.leaf.id ? 'pop' : ''} ${it.x === 0.5 ? 'mid' : left ? 'l' : 'r'}`} style={{ top: it.y, left: it.x * w }}>
              {isCur && <span className="jn-bubble">{dCount ? 'NEXT' : 'START'}</span>}
              <button className="jn-c" onClick={() => { tap(); push('Lesson', { sid, id: it.leaf.id }); }} aria-label={it.leaf.title}>
                {isDone ? <Check size={26} strokeWidth={3.2} /> : isCur ? <I size={24} fill={I === Play ? 'currentColor' : 'none'} /> : <I size={20} />}
                {isDone && <span className="jn-stars"><Star size={10} fill="currentColor" /><Star size={13} fill="currentColor" /><Star size={10} fill="currentColor" /></span>}
              </button>
              <span className="jn-l"><b className="clamp2">{it.leaf.title}</b><small>{kindLabel(it.leaf)}{it.leaf.difficulty ? ` · ${it.leaf.difficulty}` : ''}</small></span>
              {isCur && <span className="jn-kai"><Companion stage={stageFor(lvl).index} mood="happy" size={44} /></span>}
            </div>
          );
        })())}
        {curIdx < 0 && <div className="jn-trophy" style={{ top: layout.h - 30 }}><Trophy size={30} /> Chapter complete</div>}
      </div>
      {cur && (
        <div className="jc-dock">
          <span className="ic">{React.createElement(kindIcon(cur.leaf), { size: 20 })}</span>
          <span className="grow tx"><small>Up next · {kindLabel(cur.leaf)}</small><b className="ellipsis">{cur.leaf.title}</b></span>
          <button onClick={() => push('Lesson', { sid, id: cur.leaf.id })}>{dCount ? 'Continue' : 'Start'}</button>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- after a lesson: celebrate, then move on */
export function LessonDone({ sid, id, mins = 0 }) {
  const { push, pop } = useApp();
  const { subject, done, loading } = useSubject(sid);
  const [count, setCount] = useState(6);
  const [hold, setHold] = useState(false);
  useEffect(() => { success(); sfxFanfare(); }, []);
  const hit = !loading && subject ? findNode(subject, id) : null;
  const chapter = hit?.path?.[0];
  const nextInChapter = chapter ? firstUndone([chapter], new Set([...done, id])) : null;
  const next = nextInChapter || (subject ? firstUndone(subject.children, new Set([...done, id])) : null);
  const chapterDone = chapter && !nextInChapter;
  useEffect(() => {
    if (!next || hold) return;
    if (count <= 0) { go(); return; }
    const tm = setTimeout(() => { setCount((c) => c - 1); if (count <= 3) sfxBlip(520 + (3 - count) * 120); }, 1000);
    return () => clearTimeout(tm);
  }, [count, hold, !!next]);
  const go = () => { pop(); setTimeout(() => push('Lesson', { sid, id: next.id }), 0); };
  const back = () => { setHold(true); pop(); if (chapter) setTimeout(() => push('ChapterJourney', { sid, id: chapter.id }), 0); };
  if (loading || !hit) return <div className="screen no-nav" />;
  const nextChapter = next && subject ? findNode(subject, next.id)?.path?.[0] : null;
  return (
    <div className="ld" style={{ '--c': subject.color }}>
      <div className="ld-burst">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ '--a': `${i * 25.7}deg`, '--d': `${(i % 3) * 60}ms` }} />)}</div>
      <div className="ld-medal">{chapterDone ? <Trophy size={54} /> : <Check size={58} strokeWidth={3.2} />}</div>
      <div className="ld-stars"><Star size={26} fill="currentColor" /><Star size={36} fill="currentColor" /><Star size={26} fill="currentColor" /></div>
      <h1>{chapterDone ? 'Chapter complete!' : 'Lesson complete!'}</h1>
      <p className="clamp2">{hit.node.title}</p>
      <div className="ld-chips">
        <span><Sparkles size={14} /> +XP</span>
        {mins > 0 && <span><Clock size={14} /> {mins} min</span>}
        <span><Brain size={14} /> Added to revision</span>
      </div>
      {next ? (
        <div className="ld-next" onClick={() => setHold(true)}>
          <div className="k">Up next{nextChapter && chapter && nextChapter.id !== chapter.id ? ` · ${nextChapter.title}` : ''}</div>
          <div className="row gap-12">
            <span className="ic">{React.createElement(kindIcon(next), { size: 22, fill: kindIcon(next) === Play ? 'currentColor' : 'none' })}</span>
            <b className="grow clamp2">{next.title}</b>
            {!hold && <span className="ld-count" style={{ '--p': `${((6 - count) / 6) * 100}` }}><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" className="bg" /><circle cx="20" cy="20" r="17" className="fg" pathLength="100" strokeDasharray={`${((6 - count) / 6) * 100} 100`} /></svg><b className="num">{Math.max(0, count)}</b></span>}
          </div>
          <button className="ld-go" onClick={(e) => { e.stopPropagation(); go(); }}><Play size={17} fill="currentColor" /> Start now</button>
        </div>
      ) : <div className="ld-next"><b>You finished the whole roadmap. Incredible.</b></div>}
      <button className="ld-back" onClick={back}>Back to the journey</button>
    </div>
  );
}
export { Lock };
