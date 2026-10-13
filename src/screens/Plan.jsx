import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, X, Trash2, Pencil, Flag, FolderKanban, Minus, Check } from 'lucide-react';
import { db } from '../db';
import { useApp } from '../ctx';
import { today, addDays, fmtDay, fmtDate, periodRange, buckets, ymd, diffDays, uid, fmtTime, dayOf } from '../lib/date';
import { goalProgress, goalPeriod, DEFAULT_CHECKIN, CHECKIN_LABEL, timeLeft, checkinDueToday, pct, avg } from '../lib/logic';
import { TopBar, Seg, Field, Sheet, Chips, Stepper, Toggle, CategorySelect, PeriodToggle, Stat, Empty, Confirm, Bar, Ring, ColorPicker } from '../ui/kit';
import { Bars, HBars, Line } from '../ui/charts';
import { TaskRow, GoalCard, SectionHead, GOAL_TYPE_COLOR } from '../ui/rows';
import { success, tap } from '../lib/native';
import { SubTabs, useSub } from '../ui/kit';
import { CATEGORIES, estLabel } from '../scheduler';
import './planner/planner.css';
import PlanBlock from './planner/PlanToday';
import { taskEstimate, plannerSettings } from '../planner/service';
import { CalendarRange, GripVertical } from 'lucide-react';
import { getKV } from '../db';
import { PeopleView } from './People';
import { isStudio } from '../studio/mode';
import { ThingsHome } from '../studio/Tasks';

/* =========================================================
   PLAN TAB (Tasks + Goals)
   ========================================================= */
export function Plan() {
  const [view, setView] = useSub('plan', 'day');
  const { push, settings } = useApp();
  const studio = isStudio(settings);
  return (
    <div className="screen fade-in">
      <div className="plan-sticky">
        <div className="titlebar"><h1 className="h1">Plan</h1><button className="icon-btn" onClick={() => push('PlanWeek')} aria-label="This week"><CalendarRange size={19} /></button></div>
        <SubTabs value={view} onChange={setView} options={studio ? [['day', 'Day'], ['tasks', 'Tasks'], ['goals', 'Goals']] : [['day', 'Day'], ['tasks', 'Tasks'], ['goals', 'Goals'], ['people', 'People']]} />
      </div>
      {view === 'day' ? <PlanBlock /> : view === 'tasks' ? (studio ? <ThingsHome /> : <TasksView />) : view === 'goals' || studio ? <GoalsView /> : <PeopleView />}
    </div>
  );
}

function TasksView() {
  const { push, settings } = useApp();
  const [v, setV] = useState('plan');
  const [quick, setQuick] = useState('');
  const [more, setMore] = useState({});
  const t = today();
  const data = useLiveQuery(async () => ({
    tasks: await db.tasks.filter((x) => !x.skipped).toArray(),
    all: await db.tasks.toArray(),
    projects: await db.projects.toArray(),
    goals: await db.goals.toArray(),
    cats: await db.categories.where('kind').equals('task').toArray(),
    meta: await getKV('planMeta', null),
  }), []);
  if (!data) return null;
  const { tasks, all, projects, goals, cats, meta } = data;
  const risk = new Set((meta?.atRisk || []).map((r) => r.taskId));
  const open = tasks.filter((x) => !x.done);
  const prio = { high: 0, medium: 1, low: 2 };
  const sortT = (l) => l.sort((a, b) => (a.due || '9').localeCompare(b.due || '9') || (prio[a.priority] ?? 3) - (prio[b.priority] ?? 3));
  const addQuick = async () => {
    if (!quick.trim()) return;
    await db.tasks.add({ title: quick.trim(), due: t, done: false, createdAt: Date.now(), subtasks: [], priority: 'none', recurrence: 'none' });
    setQuick(''); tap();
  };
  let body = null;
  if (v === 'plan') {
    const doneToday = tasks.filter((x) => x.done && x.doneAt && dayOf(x.doneAt) === t);
    const groups = [
      ['Today', sortT(open.filter((x) => x.due && x.due <= t))],
      ['This week', sortT(open.filter((x) => x.due && x.due > t && x.due <= addDays(t, 6)))],
      ['Later', sortT(open.filter((x) => x.due && x.due > addDays(t, 6)))],
      ['Someday', open.filter((x) => !x.due)],
    ].filter(([, l]) => l.length);
    body = <>
      {groups.length ? groups.map(([name, l]) => {
        const collapsed = (name === 'Later' || name === 'Someday') && !more[name];
        return (
          <div key={name} className="mb-16">
            <button className="row between mb-8" style={{ width: '100%' }} onClick={() => (name === 'Later' || name === 'Someday') && setMore({ ...more, [name]: !more[name] })}>
              <span className="eyebrow">{name} · {l.length}</span>
              {(name === 'Later' || name === 'Someday') && <span className="tiny muted">{collapsed ? 'Show' : 'Hide'}</span>}
            </button>
            {!collapsed && <div className="list">{l.map((x) => <TaskRow key={x.id} t={x} showDate={name !== 'Today' || x.due !== t} projects={projects} goals={goals} plan={{ risk: risk.has(x.id), est: taskEstimate(x, settings) }} />)}</div>}
          </div>
        );
      }) : <Empty icon="☀️" title="All clear" sub="Add a task and the planner finds time for it." />}
      {doneToday.length > 0 && <><div className="eyebrow mt-24 mb-8">Done today · {doneToday.length}</div><div className="list">{doneToday.map((x) => <TaskRow key={x.id} t={x} projects={projects} goals={goals} />)}</div></>}
    </>;
  } else if (v === 'projects') {
    body = <>
      {projects.map((p) => {
        const pl = tasks.filter((x) => x.projectId === p.id);
        const d = pl.filter((x) => x.done).length;
        return (
          <div key={p.id} className="mb-16">
            <div className="row between mb-8"><div className="row gap-6"><span className="pill-dot" style={{ background: p.color || 'var(--task)' }} /><span className="h3">{p.name}</span></div><span className="small muted num">{d}/{pl.length}</span></div>
            <div className="mb-8"><Bar value={pl.length ? d / pl.length : 0} color={p.color || 'var(--task)'} h={4} /></div>
            <div className="list">{sortT(pl.filter((x) => !x.done)).map((x) => <TaskRow key={x.id} t={x} projects={projects} goals={goals} />)}
              <button className="list-item muted" onClick={() => push('TaskForm', { projectId: p.id })}><Plus size={16} /><span className="small">Add to {p.name}</span></button>
            </div>
          </div>
        );
      })}
      <button className="btn block" onClick={() => push('Projects')}><FolderKanban size={16} /> Manage projects</button>
    </>;
  } else if (v === 'done') {
    const l = tasks.filter((x) => x.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).slice(0, 100);
    body = l.length ? <div className="list">{l.map((x) => <TaskRow key={x.id} t={x} projects={projects} goals={goals} />)}</div> : <Empty title="Nothing completed yet" />;
  } else if (v === 'stats') body = <TaskStats all={all} cats={cats} projects={projects} />;

  return (
    <div className="mt-16">
      <Chips value={v} onChange={setV} options={[{ value: 'plan', label: 'Plan' }, { value: 'projects', label: 'Projects' }, { value: 'done', label: 'Done' }, { value: 'stats', label: 'Stats' }]} />
      {v === 'plan' && (
        <div className="row mt-16">
          <input className="input grow" placeholder="Add a task…" value={quick} onChange={(e) => setQuick(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addQuick()} />
          <button className="icon-btn" style={{ width: 48, height: 48, background: 'var(--task)', color: '#fff' }} onClick={() => (quick.trim() ? addQuick() : push('TaskForm', { due: t }))}><Plus size={22} /></button>
        </div>
      )}
      <div className="mt-16">{body}</div>
    </div>
  );
}

function TaskStats({ all, cats, projects }) {
  const [period, setPeriod] = useState('month');
  const [from, to] = periodRange(period);
  const t = today();
  const created = all.filter((x) => x.createdAt && ymd(new Date(x.createdAt)) >= from && ymd(new Date(x.createdAt)) <= to);
  const done = all.filter((x) => x.done && x.doneAt && dayOf(x.doneAt) >= from && dayOf(x.doneAt) <= to);
  const ttc = done.filter((x) => x.createdAt).map((x) => (x.doneAt - x.createdAt) / 86400000);
  const bk = buckets(period);
  const overdue = bk.map((b) => ({ label: b.label, value: b.from > t ? null : all.filter((x) => x.due && x.due >= b.from && x.due <= b.to && x.due < t && (!x.done || (x.doneAt && dayOf(x.doneAt) > x.due))).length }));
  const doneTrend = bk.map((b) => ({ label: b.label, value: b.from > t ? null : all.filter((x) => x.done && x.doneAt && dayOf(x.doneAt) >= b.from && dayOf(x.doneAt) <= b.to).length }));
  const byCat = {};
  created.forEach((x) => { const c = cats.find((z) => z.id === x.categoryId); const k = c ? `${c.icon} ${c.name}` : 'No category'; byCat[k] = (byCat[k] || 0) + 1; });
  return (
    <div>
      <PeriodToggle value={period} onChange={setPeriod} />
      <div className="grid-3 mt-12">
        <Stat v={created.length ? pct(done.length / Math.max(created.length, done.length)) : '—'} k="Completion" color="var(--task)" sub={`${done.length} done / ${created.length} new`} />
        <Stat v={ttc.length ? `${avg(ttc).toFixed(1)}d` : '—'} k="Avg time to do" />
        <Stat v={all.filter((x) => !x.done && !x.skipped && x.due && x.due < t).length} k="Overdue now" />
      </div>
      <div className="card mt-12"><div className="h3 mb-12">Completed</div><Bars data={doneTrend} color="var(--task)" showValues /></div>
      <div className="card mt-12"><div className="h3 mb-12">Slipped past due date</div><Bars data={overdue} color="var(--bad)" showValues /></div>
      <div className="card mt-12"><div className="h3 mb-12">Load by category</div><HBars items={Object.entries(byCat).map(([k, v]) => ({ label: k, value: v, color: 'var(--task)' })).sort((a, b) => b.value - a.value)} /></div>
    </div>
  );
}

/* =========================================================
   TASK FORM
   ========================================================= */
const REMINDERS = [{ value: null, label: 'None' }, { value: 0, label: 'At time' }, { value: 30, label: '30 min before' }, { value: 60, label: '1 hr before' }, { value: 1440, label: '1 day before' }];
export function TaskForm({ id, due, projectId, goalId, dueTime, duration }) {
  const { pop, toast, settings } = useApp();
  const [x, setX] = useState(null);
  const [sub, setSub] = useState('');
  const [del, setDel] = useState(false);
  const projects = useLiveQuery(() => db.projects.toArray(), []) || [];
  const goals = useLiveQuery(() => db.goals.where('status').equals('active').toArray(), []) || [];
  useEffect(() => { (async () => setX(id ? await db.tasks.get(id) : { title: '', description: '', categoryId: null, projectId: projectId || null, goalId: goalId || null, due: due === undefined ? today() : due, dueTime: dueTime || '', duration: duration || 30, priority: 'none', recurrence: 'none', subtasks: [], reminder: null, done: false }))(); }, [id]);
  if (!x) return <div className="screen no-nav" />;
  const set = (p) => setX((v) => ({ ...v, ...p }));
  const save = async () => {
    if (!x.title.trim()) return toast('Add a title');
    const row = { ...x, title: x.title.trim() };
    if (id) await db.tasks.put(row); else await db.tasks.add({ ...row, createdAt: Date.now() });
    success(); toast('Saved'); pop();
  };
  const t = today();
  return (
    <div className="screen no-nav page-enter">
      <TopBar title={id ? 'Task' : 'New task'} right={<button className="btn sm primary" onClick={save}>Save</button>} />
      <div className="form">
        <input className="input big" placeholder="What needs doing?" value={x.title} onChange={(e) => set({ title: e.target.value })} autoFocus={!id} />
        <textarea className="textarea" style={{ minHeight: 60 }} placeholder="Details (optional)" value={x.description || ''} onChange={(e) => set({ description: e.target.value })} />
        <Field label="Due">
          <Chips value={x.due === t ? 'today' : x.due === addDays(t, 1) ? 'tomorrow' : !x.due ? 'none' : 'custom'} onChange={(v) => set({ due: v === 'today' ? t : v === 'tomorrow' ? addDays(t, 1) : v === 'none' ? null : x.due || addDays(t, 2) })} options={[{ value: 'today', label: 'Today' }, { value: 'tomorrow', label: 'Tomorrow' }, { value: 'custom', label: 'Pick date' }, { value: 'none', label: 'Someday' }]} />
        </Field>
        {x.due && (
          <div className="grid-2">
            <input type="date" className="input" value={x.due} onChange={(e) => set({ due: e.target.value })} />
            <input type="time" className="input" value={x.dueTime || ''} onChange={(e) => set({ dueTime: e.target.value })} />
          </div>
        )}
        {x.due && x.dueTime && (
          <Field label="Duration (for your timeline)"><Chips value={x.duration || 30} onChange={(v) => set({ duration: v })} options={[15, 30, 45, 60, 90, 120].map((v) => ({ value: v, label: v < 60 ? `${v}m` : `${v / 60}h` }))} /></Field>
        )}
        <Field label="Planner (optional)">
          <div className="small dim mb-8">How hard is it? The planner turns this into sessions.</div>
          <div className="pl-dots">{[1, 2, 3, 4, 5].map((n) => <button key={n} className={x.difficulty === n ? 'on' : ''} aria-label={`Difficulty ${n}`} onClick={() => set({ difficulty: x.difficulty === n ? undefined : n })}>{n}</button>)}</div>
          <div className="mt-12"><Chips wrap value={x.pcat || null} onChange={(v) => set({ pcat: v })} options={CATEGORIES} /></div>
          <div className="row gap-8 mt-12">
            <input type="number" inputMode="decimal" min="0" step="0.5" className="input grow" placeholder="Hours needed (optional)" value={x.estHours ?? ''} onChange={(e) => set({ estHours: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) })} />
          </div>
          {(x.difficulty != null || x.pcat) && <div className="tiny muted mt-8">{estimateLine(x, settings)}</div>}
          {!x.due && <div className="row between mt-12"><div className="small">Add to my plan anyway</div><Toggle on={x.plan === true} onChange={(v) => set({ plan: v })} /></div>}
        </Field>
        {x.due && <Field label="Reminder"><Chips value={x.reminder} onChange={(v) => set({ reminder: v })} options={REMINDERS} /></Field>}
        <Field label="Repeat"><Chips value={x.recurrence} onChange={(v) => set({ recurrence: v })} options={[{ value: 'none', label: 'Never' }, { value: 'daily', label: 'Daily' }, { value: 'weekdays', label: 'Weekdays' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }]} /></Field>
        <Field label="Priority"><Chips value={x.priority} onChange={(v) => set({ priority: v })} options={[{ value: 'none', label: 'None' }, { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]} /></Field>
        <Field label="Subtasks">
          <div className="list">
            <SubList subs={x.subtasks || []} set={set} />
            <div className="list-item"><Plus size={16} className="muted" /><input className="grow" style={{ background: 'none', border: 0 }} placeholder="Add a step" value={sub} onChange={(e) => setSub(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && sub.trim()) { set({ subtasks: [...(x.subtasks || []), { id: uid(), title: sub.trim(), done: false }] }); setSub(''); } }} /></div>
          </div>
        </Field>
        <div className="grid-2">
          <Field label="Project">
            <select className="select" value={x.projectId || ''} onChange={(e) => set({ projectId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">None</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Goal">
            <select className="select" value={x.goalId || ''} onChange={(e) => set({ goalId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">None</option>{goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
          </Field>
        </div>
        {id && <button className="btn danger" onClick={() => setDel(true)}>Delete task</button>}
      </div>
      <Confirm open={del} onClose={() => setDel(false)} title="Delete task?" onConfirm={async () => { await db.tasks.delete(id); pop(); }} />
    </div>
  );
}


function estimateLine(x, settings) {
  const e = taskEstimate({ ...x, subtasks: (x.subtasks || []).filter((s) => !s.done) }, settings, true);
  return e ? `${estLabel(e.hours, e.guessed)}${x.subtasks?.length ? ` across ${x.subtasks.filter((s) => !s.done).length} steps` : ''}. Override with your own hours.` : '';
}

/* Subtasks: tap the grip and drag to reorder; tap "Lv" to set a step's difficulty */
function SubList({ subs, set }) {
  const [drag, setDrag] = useState(null);
  const H = 52;
  const move = (e) => { if (!drag) return; const dy = e.clientY - drag.y0; setDrag({ ...drag, dy, to: Math.max(0, Math.min(subs.length - 1, drag.i + Math.round(dy / H))) }); };
  const up = () => {
    if (drag && drag.to !== drag.i) { const a = [...subs]; const [m] = a.splice(drag.i, 1); a.splice(drag.to, 0, m); set({ subtasks: a }); }
    setDrag(null);
  };
  const upd = (id, p) => set({ subtasks: subs.map((z) => (z.id === id ? { ...z, ...p } : z)) });
  return subs.map((s, i) => (
    <div key={s.id} className="list-item" style={drag?.i === i ? { transform: `translateY(${drag.dy}px)`, zIndex: 5, background: 'var(--surface-2)', position: 'relative' } : null}>
      <button className="icon-btn sm ghost" style={{ touchAction: 'none' }} aria-label="Drag to reorder" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setDrag({ i, y0: e.clientY, dy: 0, to: i }); }} onPointerMove={move} onPointerUp={up} onPointerCancel={() => setDrag(null)}><GripVertical size={16} /></button>
      <button className={`task-check ${s.done ? 'on' : ''}`} onClick={() => upd(s.id, { done: !s.done })}>{s.done && <Check size={13} strokeWidth={3} />}</button>
      <span className={`grow ${s.done ? 'strike' : ''}`}>{s.title}</span>
      <button className="tiny muted" style={{ minWidth: 40, height: 32 }} aria-label="Step difficulty" onClick={() => upd(s.id, { difficulty: ((s.difficulty || 0) % 5) + 1 })}>{s.difficulty ? `Lv ${s.difficulty}` : 'Lv –'}</button>
      <button className="icon-btn sm ghost" onClick={() => set({ subtasks: subs.filter((z) => z.id !== s.id) })}><X size={14} /></button>
    </div>
  ));
}

export function Projects() {
  const [edit, setEdit] = useState(null);
  const projects = useLiveQuery(() => db.projects.toArray(), []) || [];
  const goals = useLiveQuery(() => db.goals.toArray(), []) || [];
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) || [];
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="Projects" right={<button className="icon-btn" onClick={() => setEdit({ name: '', color: '#a78bfa', goalId: null })}><Plus size={20} /></button>} />
      <p className="small muted" style={{ marginTop: -4 }}>A project groups tasks toward a bigger effort — and can feed a goal.</p>
      {projects.length ? (
        <div className="list mt-12">
          {projects.map((p) => {
            const pl = tasks.filter((x) => x.projectId === p.id);
            return (
              <button key={p.id} className="list-item" onClick={() => setEdit(p)}>
                <span className="pill-dot" style={{ background: p.color }} />
                <div className="grow"><div style={{ fontWeight: 560 }}>{p.name}</div><div className="tiny muted">{pl.filter((x) => x.done).length}/{pl.length} done{p.goalId ? ` · ${goals.find((g) => g.id === p.goalId)?.title || ''}` : ''}</div></div>
              </button>
            );
          })}
        </div>
      ) : <Empty icon="📁" title="No projects" sub="e.g. “App MVP”, “Thesis chapter 2”" />}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit project' : 'New project'}>
        {edit && (
          <div className="form">
            <input className="input" placeholder="Project name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} autoFocus />
            <ColorPicker value={edit.color} onChange={(c) => setEdit({ ...edit, color: c })} />
            <Field label="Linked goal"><select className="select" value={edit.goalId || ''} onChange={(e) => setEdit({ ...edit, goalId: e.target.value ? Number(e.target.value) : null })}><option value="">None</option>{goals.filter((g) => g.status === 'active').map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</select></Field>
            <div className="row">
              {edit.id && <button className="btn danger" onClick={async () => { await db.projects.delete(edit.id); await db.tasks.where('projectId').equals(edit.id).modify({ projectId: null }); setEdit(null); }}><Trash2 size={16} /></button>}
              <button className="btn primary grow" onClick={async () => { if (!edit.name.trim()) return; if (edit.id) await db.projects.put(edit); else await db.projects.add(edit); setEdit(null); }}>Save</button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

/* =========================================================
   GOALS
   ========================================================= */
const TYPES = [{ value: 'weekly', label: 'Week' }, { value: 'monthly', label: 'Month' }, { value: 'yearly', label: 'Year' }, { value: 'casual', label: 'Someday' }];
const TYPE_TITLE = { weekly: 'This week', monthly: 'This month', yearly: 'This year', casual: 'Someday' };

export function GoalsView() {
  const { push } = useApp();
  const data = useLiveQuery(async () => ({ goals: await db.goals.toArray(), tasks: await db.tasks.toArray(), checkins: await db.goalCheckins.toArray() }), []);
  const [stats, setStats] = useState(false);
  if (!data) return null;
  const { goals, tasks, checkins } = data;
  const t = today();
  const active = goals.filter((g) => g.status === 'active');
  const review = active.filter((g) => g.periodEnd && g.periodEnd < t);
  const last = {};
  checkins.forEach((c) => { if (!last[c.goalId] || c.date > last[c.goalId]) last[c.goalId] = c.date; });
  return (
    <div className="mt-16">
      {review.length > 0 && (
        <button className="card card-press row gap-14 mb-12" style={{ width: '100%', textAlign: 'left', background: 'color-mix(in srgb, var(--goal) 12%, var(--surface))' }} onClick={() => push('GoalReview')}>
          <span style={{ fontSize: 22 }}>🏁</span>
          <div className="grow"><div className="h3">{review.length} goal{review.length > 1 ? 's' : ''} to review</div><div className="small muted">Their period ended</div></div>
        </button>
      )}
      <div className="row">
        <button className="btn primary grow" onClick={() => push('GoalForm', {})}><Plus size={18} /> New goal</button>
        <button className={`btn ${stats ? '' : ''}`} onClick={() => setStats(!stats)}>{stats ? 'Goals' : 'Stats'}</button>
      </div>
      {stats ? <GoalStats goals={goals} checkins={checkins} /> : (
        <>
          {['weekly', 'monthly', 'yearly', 'casual'].map((type) => {
            const l = active.filter((g) => g.type === type && !(g.periodEnd && g.periodEnd < t));
            if (!l.length) return null;
            return (
              <div key={type} className="section">
                <div className="eyebrow mb-8" style={{ color: GOAL_TYPE_COLOR[type] }}>{TYPE_TITLE[type]}</div>
                <div className="col gap-6">{l.map((g) => <GoalCard key={g.id} g={g} tasks={tasks} compact checkinDue={checkinDueToday(g, last[g.id])} />)}</div>
              </div>
            );
          })}
          {!active.length && <Empty icon="🎯" title="No goals yet" sub="Weekly, monthly, yearly — or someday." />}
          {goals.filter((g) => g.status !== 'active').length > 0 && (
            <div className="section">
              <SectionHead title="Past goals" />
              <div className="list">
                {goals.filter((g) => g.status !== 'active').sort((a, b) => (b.reviewedAt || 0) - (a.reviewedAt || 0)).slice(0, 30).map((g) => (
                  <button key={g.id} className="list-item" onClick={() => push('GoalDetail', { id: g.id })}>
                    <span>{g.status === 'achieved' ? '🏆' : g.status === 'partial' ? '🌓' : g.status === 'missed' ? '·' : '📦'}</span>
                    <div className="grow"><div className="ellipsis" style={{ fontWeight: 560 }}>{g.title}</div><div className="tiny muted">{g.type} · {g.periodStart ? fmtDate(g.periodStart) : ''} · {g.status}</div></div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function GoalStats({ goals, checkins }) {
  const reviewed = goals.filter((g) => ['achieved', 'partial', 'missed'].includes(g.status));
  const rate = (type) => { const l = reviewed.filter((g) => g.type === type); return l.length ? l.filter((g) => g.status === 'achieved').length / l.length : null; };
  const yes = checkins.filter((c) => c.response === 'yes').length;
  const cats = {};
  goals.forEach((g) => { cats[g.categoryId || 0] = (cats[g.categoryId || 0] || 0) + 1; });
  const catRows = useLiveQuery(() => db.categories.where('kind').equals('goal').toArray(), []) || [];
  const y = today().slice(0, 4);
  const perMonth = Array.from({ length: 12 }, (_, i) => ({ label: 'JFMAMJJASOND'[i], value: reviewed.filter((g) => g.status === 'achieved' && g.periodEnd && g.periodEnd.startsWith(`${y}-${String(i + 1).padStart(2, '0')}`)).length }));
  return (
    <div className="mt-16">
      <div className="grid-4">
        {['weekly', 'monthly', 'yearly', 'casual'].map((t) => <Stat key={t} v={pct(rate(t))} k={t === 'casual' ? 'someday' : t} />)}
      </div>
      <div className="grid-2 mt-12">
        <Stat v={reviewed.filter((g) => g.status === 'achieved').length} k="Goals achieved" color="var(--goal)" />
        <Stat v={checkins.length ? pct(yes / checkins.length) : '—'} k="Check-ins: “Yes”" sub={`${checkins.length} answers`} />
      </div>
      <div className="card mt-12"><div className="h3 mb-12">Achieved in {y}</div><Bars data={perMonth} color="var(--goal)" showValues /></div>
      <div className="card mt-12"><div className="h3 mb-12">Life areas</div><HBars items={Object.entries(cats).map(([k, v]) => { const c = catRows.find((z) => z.id === Number(k)); return { label: c ? `${c.icon} ${c.name}` : 'Uncategorised', value: v, color: c?.color || 'var(--goal)' }; })} /></div>
    </div>
  );
}

export function GoalForm({ id }) {
  const { pop, toast } = useApp();
  const [g, setG] = useState(null);
  useEffect(() => { (async () => setG(id ? await db.goals.get(id) : { title: '', type: 'weekly', categoryId: null, why: '', target: '', unit: '', checkinFreq: 'daily', checkinTime: '20:00', repeat: false, progress: 0 }))(); }, [id]);
  if (!g) return <div className="screen no-nav" />;
  const set = (p) => setG((v) => ({ ...v, ...p }));
  const save = async () => {
    if (!g.title.trim()) return toast('Name your goal');
    const [ps, pe] = goalPeriod(g.type);
    const row = { ...g, title: g.title.trim(), target: g.target ? Number(g.target) : null };
    if (!id || !g.periodStart || g.typeChanged) { row.periodStart = ps; row.periodEnd = pe; }
    delete row.typeChanged;
    if (id) await db.goals.put(row); else await db.goals.add({ ...row, status: 'active', createdAt: Date.now() });
    success(); toast('Goal saved'); pop();
  };
  return (
    <div className="screen no-nav page-enter">
      <TopBar title={id ? 'Edit goal' : 'New goal'} right={<button className="btn sm primary" onClick={save}>Save</button>} />
      <div className="form">
        <Seg value={g.type} onChange={(v) => set({ type: v, checkinFreq: DEFAULT_CHECKIN[v], typeChanged: true, repeat: ['weekly', 'monthly'].includes(v) ? g.repeat : false })} options={TYPES} />
        <input className="input big" placeholder={{ weekly: 'Workout 4 times', monthly: 'Save ₹10,000', yearly: 'Learn 10 new songs', casual: 'Visit Hampi' }[g.type]} value={g.title} onChange={(e) => set({ title: e.target.value })} autoFocus={!id} />
        <Field label="Why does this matter?" hint="Shown in check-in reminders"><textarea className="textarea" style={{ minHeight: 64 }} value={g.why} onChange={(e) => set({ why: e.target.value })} placeholder="optional" /></Field>
        <div className="grid-2">
          <Field label="Target (optional)"><input className="input" inputMode="numeric" value={g.target || ''} onChange={(e) => set({ target: e.target.value.replace(/[^0-9.]/g, '') })} placeholder="4" /></Field>
          <Field label="Unit"><input className="input" value={g.unit || ''} onChange={(e) => set({ unit: e.target.value })} placeholder="workouts" /></Field>
        </div>
        <Field label="Category"><CategorySelect kind="goal" value={g.categoryId} onChange={(v) => set({ categoryId: v })} /></Field>
        <Field label="Check-in"><Chips value={g.checkinFreq} onChange={(v) => set({ checkinFreq: v })} options={Object.entries(CHECKIN_LABEL).map(([value, label]) => ({ value, label }))} /></Field>
        {g.checkinFreq !== 'never' && <Field label="Check-in time"><input type="time" className="input" value={g.checkinTime} onChange={(e) => set({ checkinTime: e.target.value })} /></Field>}
        {['weekly', 'monthly'].includes(g.type) && <div className="row between card flat"><div><div className="h3">Repeat every {g.type === 'weekly' ? 'week' : 'month'}</div><div className="small muted">Recreated when the period ends</div></div><Toggle on={g.repeat} onChange={(v) => set({ repeat: v })} /></div>}
        <div className="small muted">Tip: add tasks inside the goal and progress updates itself.</div>
      </div>
    </div>
  );
}

export function GoalDetail({ id, checkin }) {
  const { push, pop, toast, celebrate } = useApp();
  const [del, setDel] = useState(false);
  const [newTask, setNewTask] = useState('');
  const data = useLiveQuery(async () => ({ g: await db.goals.get(id), tasks: await db.tasks.where('goalId').equals(id).toArray(), cks: await db.goalCheckins.where('goalId').equals(id).toArray(), projects: await db.projects.filter((p) => p.goalId === id).toArray() }), [id]);
  if (!data) return <div className="screen no-nav" />;
  const { g, tasks, cks, projects } = data;
  if (!g) return <div className="screen no-nav"><TopBar title="" /><Empty title="Goal not found" /></div>;
  const p = goalProgress(g, tasks.filter((x) => !x.skipped));
  const color = GOAL_TYPE_COLOR[g.type];
  const t = today();
  const doneToday = cks.some((c) => c.date === t);
  const record = async (response, value) => {
    await db.goalCheckins.add({ goalId: id, date: t, ts: Date.now(), response, value });
    if (response === 'yes') success();
    toast(response === 'yes' ? 'Progress noted' : 'Noted. Tomorrow then');
  };
  const setProgress = async (v) => {
    const max = g.target || 100;
    const nv = Math.max(0, Math.min(max * 10, v));
    await db.goals.update(id, { progress: nv });
    if (nv >= max && (g.progress || 0) < max) { celebrate(); toast('Goal reached!'); }
    if (!doneToday) await db.goalCheckins.add({ goalId: id, date: t, ts: Date.now(), response: 'yes', value: nv });
    else { const c = cks.find((z) => z.date === t); await db.goalCheckins.update(c.id, { value: nv, response: 'yes' }); }
  };
  const hist = [...cks].sort((a, b) => a.ts - b.ts).filter((c) => c.value != null).map((c) => ({ label: '', value: g.target ? c.value : c.value }));
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="" right={<div className="row gap-6"><button className="icon-btn" onClick={() => push('GoalForm', { id })}><Pencil size={18} /></button><button className="icon-btn" onClick={() => setDel(true)}><Trash2 size={18} /></button></div>} />
      <div className="eyebrow" style={{ color }}>{TYPE_TITLE[g.type]} · {timeLeft(g)}</div>
      <h1 className="h1 mt-8" style={{ fontSize: 28 }}>{g.title}</h1>
      {g.why && <p className="dim mt-8" style={{ fontStyle: 'italic' }}>“{g.why}”</p>}
      <div className="hero mt-16 row gap-18">
        <Ring size={100} stroke={10} value={p.value} color={color}><span className="h2 num">{Math.round(p.value * 100)}%</span></Ring>
        <div className="grow">
          <div className="h3 num">{p.label}</div>
          <div className="small muted mt-4">{p.mode === 'tasks' ? 'Auto from tasks' : p.mode === 'count' ? 'Update the counter' : 'Slide to update'}</div>
          {g.status !== 'active' && <span className="badge mt-8">{g.status}</span>}
        </div>
      </div>

      {g.status === 'active' && p.mode === 'count' && (
        <div className="row mt-12">
          <button className="btn grow" onClick={() => setProgress((g.progress || 0) - 1)}><Minus size={18} /></button>
          <button className="btn primary grow" style={{ background: color, color: '#000' }} onClick={() => setProgress((g.progress || 0) + 1)}><Plus size={18} /> 1 {g.unit || ''}</button>
        </div>
      )}
      {g.status === 'active' && p.mode === 'pct' && (
        <div className="card mt-12">
          <input type="range" min={0} max={100} step={5} value={g.progress || 0} onChange={(e) => setProgress(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--goal)' }} />
        </div>
      )}
      {g.status === 'active' && (checkin || !doneToday) && !doneToday && (
        <div className="card mt-12">
          <div className="h3">Are you working towards this?</div>
          <div className="row mt-12">
            <button className="btn grow" onClick={() => record('no')}>Not today</button>
            <button className="btn primary grow" onClick={() => record('yes')}>Yes, made progress</button>
          </div>
        </div>
      )}

      <div className="section">
        <SectionHead title="Tasks" />
        <div className="list">
          {tasks.filter((x) => !x.skipped).map((x) => <TaskRow key={x.id} t={x} />)}
          <div className="list-item"><Plus size={16} className="muted" /><input className="grow" style={{ background: 'none', border: 0 }} placeholder="Add a task to this goal" value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={async (e) => { if (e.key === 'Enter' && newTask.trim()) { await db.tasks.add({ title: newTask.trim(), goalId: id, due: null, done: false, createdAt: Date.now(), subtasks: [], priority: 'none', recurrence: 'none' }); setNewTask(''); } }} /></div>
        </div>
        {projects.length > 0 && <div className="small muted mt-8">Projects: {projects.map((x) => x.name).join(', ')}</div>}
      </div>

      {hist.length > 1 && <div className="card mt-16"><div className="h3 mb-12">Progress over time</div><Line data={hist} color={color} /></div>}
      {cks.length > 0 && (
        <div className="section">
          <SectionHead title="Check-ins" />
          <div className="row wrap gap-4">
            {[...cks].sort((a, b) => a.ts - b.ts).slice(-40).map((c) => <span key={c.id} title={c.date} style={{ width: 14, height: 14, borderRadius: 4, background: c.response === 'yes' ? color : 'var(--surface-3)' }} />)}
          </div>
          <div className="tiny muted mt-8">{cks.filter((c) => c.response === 'yes').length} yes · {cks.filter((c) => c.response === 'no').length} not today</div>
        </div>
      )}
      <Confirm open={del} onClose={() => setDel(false)} title="Delete goal?" body="Tasks stay, but lose the link." onConfirm={async () => { await db.goals.delete(id); await db.tasks.where('goalId').equals(id).modify({ goalId: null }); pop(); }} />
    </div>
  );
}

export function GoalReview() {
  const { pop, toast, celebrate } = useApp();
  const data = useLiveQuery(async () => ({ goals: await db.goals.where('status').equals('active').toArray(), tasks: await db.tasks.toArray() }), []);
  const [notes, setNotes] = useState({});
  const [res, setRes] = useState({});
  if (!data) return <div className="screen no-nav" />;
  const t = today();
  const list = data.goals.filter((g) => g.periodEnd && g.periodEnd < t);
  const finish = async (g, carry) => {
    const status = res[g.id];
    if (!status) return toast('Pick how it went');
    await db.goals.update(g.id, { status, reviewNote: notes[g.id] || '', reviewedAt: Date.now() });
    if (carry || g.repeat) {
      const [ps, pe] = goalPeriod(g.type);
      const { id: _, ...rest } = g;
      const nid = await db.goals.add({ ...rest, periodStart: ps, periodEnd: pe, progress: carry && status !== 'achieved' ? g.progress : 0, status: 'active', createdAt: Date.now(), reviewNote: '' });
      if (carry) await db.tasks.where('goalId').equals(g.id).filter((x) => !x.done).modify({ goalId: nid });
    }
    if (status === 'achieved') celebrate();
    toast(carry ? 'Carried into this period' : 'Archived');
    if (list.length === 1) pop();
  };
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="Goal review" />
      {!list.length && <Empty icon="✅" title="All reviewed" />}
      <div className="col gap-10">
        {list.map((g) => {
          const p = goalProgress(g, data.tasks);
          return (
            <div key={g.id} className="card">
              <div className="eyebrow" style={{ color: GOAL_TYPE_COLOR[g.type] }}>{TYPE_TITLE[g.type].replace('This', 'Last')} · ended {fmtDay(g.periodEnd)}</div>
              <div className="h3 mt-4">{g.title}</div>
              <div className="mt-8"><Bar value={p.value} color={GOAL_TYPE_COLOR[g.type]} /></div>
              <div className="tiny muted mt-4">{p.label}</div>
              <div className="mt-12"><Chips wrap value={res[g.id]} onChange={(v) => setRes({ ...res, [g.id]: v })} options={[{ value: 'achieved', label: '🏆 Achieved' }, { value: 'partial', label: '🌓 Partly' }, { value: 'missed', label: 'Not achieved' }]} /></div>
              <input className="input mt-12" placeholder="What helped, or what got in the way?" value={notes[g.id] || ''} onChange={(e) => setNotes({ ...notes, [g.id]: e.target.value })} />
              <div className="row mt-12">
                <button className="btn grow" onClick={() => finish(g, false)}>{g.repeat ? 'Done (repeats)' : 'Archive'}</button>
                <button className="btn primary grow" onClick={() => finish(g, true)}>Carry over</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
