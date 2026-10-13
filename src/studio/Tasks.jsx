// Studio · Tasks — Things 3 structure: Inbox, Today, Upcoming, Anytime, Someday, Logbook, then projects.
import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Inbox, Star, CalendarDays, Layers, Archive, BookCheck, ChevronRight, ChevronLeft, Plus, Flag, GraduationCap, Moon } from 'lucide-react';
import { db } from '../db';
import { useApp } from '../ctx';
import { today, addDays, parse, fmtHM, DAYS_SHORT, MONTHS } from '../lib/date';
import { completeTask } from '../lib/logic';
import { success, tap } from '../lib/native';
import { sfxComplete } from '../lib/sound';
import { QuickEntry } from './QuickEntry';
import './tasks.css';

const LISTS = [
  { k: 'inbox', l: 'Inbox', i: Inbox, c: '#3d8bfd' },
  { k: 'today', l: 'Today', i: Star, c: '#f5b800', fill: true },
  { k: 'upcoming', l: 'Upcoming', i: CalendarDays, c: '#f2545b' },
  { k: 'anytime', l: 'Anytime', i: Layers, c: '#2bb5a5' },
  { k: 'someday', l: 'Someday', i: Archive, c: '#b8a77a' },
  { k: 'logbook', l: 'Logbook', i: BookCheck, c: '#4caf6e' },
];
const open = (x) => !x.done && !x.skipped;
/** Which Things list a task belongs to. */
export function listOf(x, t) {
  if (x.done) return 'logbook';
  if (x.skipped) return null;
  if (x.due && x.due <= t) return 'today';
  if (x.due) return 'upcoming';
  if (x.someday) return 'someday';
  if (x.projectId || x.goalId || x.plan) return 'anytime';
  return 'inbox';
}

/** Plan → Tasks in Studio: the list of lists. */
export function ThingsHome() {
  const { push } = useApp();
  const [qe, setQe] = useState(false);
  const t = today();
  const d = useLiveQuery(async () => {
    const [tasks, projects] = await Promise.all([db.tasks.toArray(), db.projects.toArray()]);
    const count = {};
    tasks.forEach((x) => { const l = listOf(x, t); if (l && l !== 'logbook') count[l] = (count[l] || 0) + 1; });
    const overdue = tasks.filter((x) => open(x) && x.due && x.due < t).length;
    const proj = projects.map((p) => {
      const mine = tasks.filter((x) => x.projectId === p.id && !x.skipped);
      return { p, n: mine.filter(open).length, prog: mine.length ? mine.filter((x) => x.done).length / mine.length : 0 };
    });
    return { count, overdue, proj };
  }, [t]);
  if (!d) return null;
  return (
    <div className="tk">
      <div className="tk-lists">
        {LISTS.map((L) => (
          <button key={L.k} className="tk-li" onClick={() => push('TaskList', { list: L.k })}>
            <L.i size={21} color={L.c} fill={L.fill ? L.c : 'none'} strokeWidth={2} />
            <span className="grow">{L.l}</span>
            {L.k === 'today' && d.overdue > 0 && <span className="tk-badge">{d.overdue}</span>}
            {d.count[L.k] > 0 && <span className="tk-n num">{d.count[L.k]}</span>}
          </button>
        ))}
      </div>
      <div className="tk-sh">Projects<button onClick={() => push('Projects')}>Manage</button></div>
      <div className="tk-lists">
        {d.proj.map(({ p, n, prog }) => (
          <button key={p.id} className="tk-li" onClick={() => push('TaskList', { projectId: p.id })}>
            <Pie value={prog} color={p.color || 'var(--accent)'} />
            <span className="grow ellipsis">{p.name}</span>
            {n > 0 && <span className="tk-n num">{n}</span>}
          </button>
        ))}
        {!d.proj.length && <button className="tk-li dim" onClick={() => push('Projects')}><Plus size={20} /><span className="grow">New project</span></button>}
      </div>
      <button className="st-plus" onClick={() => setQe(true)} aria-label="New to-do"><Plus size={28} strokeWidth={2.4} /></button>
      <QuickEntry open={qe} when="inbox" onClose={() => setQe(false)} />
    </div>
  );
}

function Pie({ value, color, size = 20 }) {
  return (
    <span className="tk-pie" style={{ width: size, height: size, '--c': color, background: `conic-gradient(var(--c) ${value * 360}deg, transparent 0)` }} />
  );
}

/** One Things list (or a project) as its own page. */
export function TaskList({ list, projectId }) {
  const { push, pop } = useApp();
  const [qe, setQe] = useState(false);
  const [just, setJust] = useState({});
  const t = today();
  const d = useLiveQuery(async () => {
    const [tasks, projects] = await Promise.all([db.tasks.toArray(), db.projects.toArray()]);
    const proj = projectId ? projects.find((p) => p.id === projectId) : null;
    const pname = (id) => projects.find((p) => p.id === id)?.name;
    let rows = projectId ? tasks.filter((x) => x.projectId === projectId && !x.skipped && (!x.done || just[x.id])) : tasks.filter((x) => listOf(x, t) === list || (just[x.id] && list !== 'logbook'));
    return { rows, proj, pname, all: projectId ? tasks.filter((x) => x.projectId === projectId && !x.skipped) : null };
  }, [list, projectId, t, just]);
  if (!d) return <div className="screen no-nav" />;
  const L = LISTS.find((x) => x.k === list);
  const toggle = async (x) => {
    if (!x.done) { success(); sfxComplete(); setJust((j) => ({ ...j, [x.id]: 1 })); setTimeout(() => setJust((j) => { const n = { ...j }; delete n[x.id]; return n; }), 1100); } else tap();
    await completeTask(x, !x.done);
  };
  const row = (x) => (
    <div key={x.id} className={`st-td ${x.done ? 'done' : ''} ${just[x.id] ? 'just' : ''}`} onClick={() => (x.study ? push('Lesson', { sid: x.study.sid, id: x.study.id }) : push('TaskForm', { id: x.id }))}>
      <button className={`st-cb ${x.priority === 'high' ? 'p-high' : x.priority === 'medium' ? 'p-medium' : ''}`} onClick={(e) => { e.stopPropagation(); toggle(x); }} aria-label="Done">
        <svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9" /></svg>
      </button>
      <span className="grow tx">
        <span className="t">{x.study && <GraduationCap size={14} className="st-ic" />}{x.evening && <Moon size={13} className="tk-moon" />}{x.title}</span>
        {meta(x, t, d.pname, list).length > 0 && <small>{meta(x, t, d.pname, list).map((m, i) => <span key={i} className={m.c || ''}>{m.t}</span>)}</small>}
      </span>
    </div>
  );

  let body;
  const rows = [...d.rows].sort((a, b) => (a.due || '9').localeCompare(b.due || '9') || (a.dueTime || '99').localeCompare(b.dueTime || '99') || a.id - b.id);
  if (list === 'upcoming') {
    // the next 7 days each get a heading, later dates are grouped by month
    const groups = new Map();
    rows.forEach((x) => {
      const days = Math.round((parse(x.due) - parse(t)) / 864e5);
      const p = parse(x.due);
      const k = days <= 7 ? x.due : `m${p.getFullYear()}-${p.getMonth()}`;
      if (!groups.has(k)) groups.set(k, { label: days <= 7 ? { n: p.getDate(), d: days === 1 ? 'Tomorrow' : DAYS_SHORT[p.getDay()] } : { m: `${MONTHS[p.getMonth()]} ${p.getFullYear() !== parse(t).getFullYear() ? p.getFullYear() : ''}` }, items: [] });
      groups.get(k).items.push(x);
    });
    body = [...groups.values()].map((g, i) => (
      <div key={i} className="tk-day">
        {g.label.n ? <div className="tk-dh"><b className="num">{g.label.n}</b><span>{g.label.d}</span></div> : <div className="tk-dh m"><span>{g.label.m}</span></div>}
        {g.items.map(row)}
      </div>
    ));
  } else if (list === 'logbook') {
    const byDay = new Map();
    [...d.rows].sort((a, b) => (b.doneAt || b.createdAt || 0) - (a.doneAt || a.createdAt || 0)).slice(0, 200).forEach((x) => {
      const k = x.doneAt ? new Date(x.doneAt).toDateString() : 'Earlier';
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k).push(x);
    });
    body = [...byDay.entries()].map(([k, items]) => <div key={k} className="tk-day"><div className="tk-dh m"><span>{k === new Date().toDateString() ? 'Today' : k.slice(0, 10)}</span></div>{items.map(row)}</div>);
  } else if (list === 'today') {
    const eve = rows.filter((x) => x.evening || (x.dueTime && x.dueTime >= '17:00'));
    const day = rows.filter((x) => !eve.includes(x));
    body = <>{day.map(row)}{eve.length > 0 && <><div className="st-h"><Moon size={16} className="moon" fill="currentColor" /> This Evening</div>{eve.map(row)}</>}</>;
  } else body = rows.map(row);

  const prog = d.all ? (d.all.length ? d.all.filter((x) => x.done).length / d.all.length : 0) : 0;
  return (
    <div className="screen no-nav page-enter tk-page">
      <button className="icon-btn ghost tk-back" onClick={pop} aria-label="Back"><ChevronLeft size={22} /></button>
      <h1 className="tk-title">
        {d.proj ? <Pie value={prog} color={d.proj.color || 'var(--accent)'} size={26} /> : <L.i size={28} color={L.c} fill={L.fill ? L.c : 'none'} />}
        {d.proj ? d.proj.name : L.l}
      </h1>
      {d.proj?.notes && <p className="tk-notes">{d.proj.notes}</p>}
      <div className="tk-body">{body}</div>
      {!d.rows.length && <div className="tk-empty">{list === 'logbook' ? 'Finished to-dos land here.' : list === 'inbox' ? 'Inbox zero. Nicely done.' : 'Nothing here.'}</div>}
      {list !== 'logbook' && <button className="st-plus" style={{ bottom: 'calc(var(--safe-bottom) + 24px)' }} onClick={() => setQe(true)} aria-label="New to-do"><Plus size={28} strokeWidth={2.4} /></button>}
      <QuickEntry open={qe} projectId={projectId} when={list === 'upcoming' ? 'tomorrow' : list === 'someday' ? 'someday' : list === 'today' ? 'today' : 'inbox'} onClose={() => setQe(false)} />
    </div>
  );
}

function meta(x, t, pname, list) {
  const m = [];
  if (x.due && x.due < t && !x.done) m.push({ t: 'Overdue', c: 'od' });
  else if (x.due && list !== 'today' && list !== 'upcoming') { const p = parse(x.due); m.push({ t: x.due === t ? 'Today' : `${DAYS_SHORT[p.getDay()]} ${p.getDate()} ${MONTHS[p.getMonth()]}` }); }
  if (x.dueTime) m.push({ t: fmtHM(x.dueTime) });
  if (x.projectId && pname(x.projectId)) m.push({ t: pname(x.projectId) });
  const subs = x.subtasks || [];
  if (subs.length) m.push({ t: `${subs.filter((s) => s.done).length}/${subs.length}` });
  if (x.description) m.push({ t: '≡' });
  return m;
}
