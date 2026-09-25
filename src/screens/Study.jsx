import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Flame, ChevronRight, Plus, FileSpreadsheet, Download, Upload, BarChart3, Brain, Check, RotateCcw, Timer, Info,
  MoreHorizontal, Bell, Trash2, Sparkles, ExternalLink, CalendarPlus,
} from 'lucide-react';
import { db, setKV } from '../db';
import { useApp } from '../ctx';
import { TopBar, Sheet, Confirm, SubTabs, useSub, Ring, Stat, Toggle, Stepper, Field, ColorPicker, Empty } from '../ui/kit';
import { Bars } from '../ui/charts';
import { HIcon } from '../ui/icons';
import { success, tap, openUrl } from '../lib/native';
import { today, lastNDays, DAYS_SHORT, dow, fmtDur, addDays, fmtHM } from '../lib/date';
import {
  ensureSubjects, subjectTally, firstUndone, findNode, dueCards, gradeCard, GRADES, nextInterval, fmtIv, studyDays, streakFrom,
  exportXlsx, saveBlob, readSpreadsheet, planImport, applyImport, GUIDE_LINES, COLUMNS, resetBuiltin, BUILTINS, isLeaf,
} from '../lib/study';
import { Learnings } from './Learnings';

/* ------------------------------------------------ shared hooks */
export function useStudy() {
  const [ready, setReady] = useState(false);
  useEffect(() => { ensureSubjects().then(() => setReady(true)); }, []);
  const subjects = useLiveQuery(() => db.subjects.orderBy('order').toArray(), []);
  const prog = useLiveQuery(() => db.progress.toArray(), []);
  const data = useMemo(() => {
    if (!subjects || !prog) return null;
    const done = new Set(prog.filter((p) => p.done).map((p) => p.id));
    return subjects.map((s) => {
      const t = subjectTally(s, done);
      const next = firstUndone(s.children, done);
      const hit = next ? findNode(s, next.id) : null;
      return { s, t, next, nextPath: hit?.path || [], done };
    });
  }, [subjects, prog]);
  return { ready: ready && !!data, data: data || [] };
}
export function useStudyToday() {
  return useLiveQuery(async () => {
    const t = today();
    const [sess, focus, due, doneToday] = await Promise.all([
      db.studySessions.where('date').equals(t).toArray(),
      db.focus.where('date').equals(t).toArray(),
      db.cards.where('due').belowOrEqual(t).count(),
      db.reviews.where('date').equals(t).count(),
    ]);
    const mins = {};
    const lessons = {};
    sess.forEach((s) => { mins[s.sid] = (mins[s.sid] || 0) + (s.mins || 0); if (s.kind === 'lesson') lessons[s.sid] = (lessons[s.sid] || 0) + 1; });
    focus.forEach((f) => f.study && (mins[f.study] = (mins[f.study] || 0) + (f.minutes || 0)));
    const days = await studyDays();
    return { mins, lessons, due, doneToday, streak: streakFrom(days), studiedToday: days.has(t) };
  }, []);
}

/* ------------------------------------------------ Study tab */
export function Study() {
  const [view, setView] = useSub('study', 'roadmaps');
  const { push } = useApp();
  const st = useStudyToday();
  const [add, setAdd] = useState(false);
  return (
    <div className="screen fade-in">
      <div className="titlebar">
        <h1 className="h1">Study</h1>
        <div className="row gap-6">
          <button className="icon-btn" onClick={() => push('StudyStats')} aria-label="Stats"><BarChart3 size={19} /></button>
          <button className="icon-btn" onClick={() => setAdd(true)} aria-label="Add or import"><Plus size={20} /></button>
        </div>
      </div>
      <SubTabs value={view} onChange={setView} options={[['roadmaps', 'Roadmaps'], ['review', st?.due ? `Revise · ${Math.min(st.due, 99)}` : 'Revise'], ['learnings', 'Learnings']]} />
      {view === 'roadmaps' && <Roadmaps st={st} onAdd={() => setAdd(true)} />}
      {view === 'review' && <ReviewHome />}
      {view === 'learnings' && <Learnings />}
      <AddSubjectSheet open={add} onClose={() => setAdd(false)} />
    </div>
  );
}

function Roadmaps({ st, onAdd }) {
  const { push } = useApp();
  const { ready, data } = useStudy();
  if (!ready) return <div className="card"><div className="row gap-10"><span className="spin" /> <span className="small muted">Preparing your roadmaps…</span></div></div>;
  const active = data.filter((d) => d.s.active !== false);
  const goal = active.reduce((a, d) => a + (d.s.dailyMins || 0), 0);
  const minsToday = Object.values(st?.mins || {}).reduce((a, b) => a + b, 0);
  return (
    <div className="col gap-12">
      <div className="card study-today">
        <div className="row gap-14">
          <Ring size={70} stroke={7} value={goal ? minsToday / goal : 0} color="var(--task)">
            <div className="center"><div className="num" style={{ fontWeight: 750, fontSize: 17 }}>{minsToday}</div><div className="tiny muted" style={{ marginTop: -2 }}>min</div></div>
          </Ring>
          <div className="grow">
            <div className="eyebrow">Today</div>
            <div className="small dim mt-4">{minsToday >= goal && goal ? 'Daily goal reached — great work.' : `${fmtDur(Math.max(0, goal - minsToday))} left of your ${fmtDur(goal)} goal`}</div>
            <div className="row gap-12 mt-8 small">
              <span className="row gap-4"><Flame size={15} color={st?.studiedToday ? 'var(--fit)' : 'var(--muted)'} /><b className="num">{st?.streak || 0}</b><span className="muted">day streak</span></span>
              {st?.due > 0 && <button className="row gap-4" style={{ color: 'var(--task)' }} onClick={() => push('ReviewDeck')}><Brain size={15} /><b className="num">{st.due}</b> to revise</button>}
            </div>
          </div>
        </div>
      </div>

      {active.map(({ s, t, next, nextPath }) => {
        const pct = t.total ? t.done / t.total : 0;
        return (
          <div key={s.id} className="subj card-press" style={{ '--c': s.color }} onClick={() => push('Roadmap', { sid: s.sid })}>
            <div className="row gap-12">
              <div className="subj-ico"><HIcon icon={s.icon || 'i:BookOpen'} size={22} color={s.color} /></div>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="row between"><div className="t">{s.title}</div><div className="num small" style={{ color: s.color, fontWeight: 700 }}>{Math.round(pct * 100)}%</div></div>
                <div className="tiny muted ellipsis">{s.long && s.long !== s.title ? s.long : `${s.children.length} topics`}</div>
              </div>
            </div>
            <div className="rm-bar mt-12"><i style={{ width: `${pct * 100}%`, background: s.color }} /></div>
            <div className="row between mt-6 tiny muted"><span>{t.done} / {t.total} lessons</span>{st?.mins?.[s.sid] ? <span>{st.mins[s.sid]} min today</span> : <span>goal {s.dailyMins || 30} min/day</span>}</div>
            {next ? (
              <button className="subj-next" onClick={(e) => { e.stopPropagation(); push('Lesson', { sid: s.sid, id: next.id }); }}>
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="tiny muted ellipsis" style={{ display: 'block' }}>Up next · {nextPath.map((p) => p.title).join(' › ')}</span>
                  <span className="ellipsis" style={{ display: 'block', fontWeight: 620 }}>{next.title}</span>
                </span>
                <span className="go"><ChevronRight size={18} /></span>
              </button>
            ) : <div className="subj-next done"><Check size={16} /> Roadmap complete</div>}
          </div>
        );
      })}
      <button className="add-subj" onClick={onAdd}><Plus size={18} /> Add a subject from Excel</button>
      {data.some((d) => d.s.active === false) && (
        <div className="list">
          {data.filter((d) => d.s.active === false).map(({ s, t }) => (
            <button key={s.id} className="menu-row" onClick={() => push('Roadmap', { sid: s.sid })}><HIcon icon={s.icon} size={18} color={s.color} /><div className="grow"><div className="t">{s.title}</div><div className="s">Paused · {t.done}/{t.total}</div></div><ChevronRight size={16} /></button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------ add / import / export */
function AddSubjectSheet({ open, onClose }) {
  const { push, toast } = useApp();
  const exportAll = async () => {
    const subs = await db.subjects.orderBy('order').toArray();
    const blob = await exportXlsx(subs);
    await saveBlob(blob, `Kaizen study roadmaps ${today()}.xlsx`);
    toast('Exported');
  };
  return (
    <Sheet open={open} onClose={onClose} title="Roadmaps & Excel">
      <div className="list">
        <button className="menu-row" onClick={() => { onClose(); push('StudyImport'); }}><Upload size={18} /><div className="grow"><div className="t">Import from Excel / CSV</div><div className="s">A new subject, or update an existing roadmap</div></div><ChevronRight size={16} /></button>
        <button className="menu-row" onClick={() => { onClose(); exportAll(); }}><Download size={18} /><div className="grow"><div className="t">Export all subjects</div><div className="s">Edit in Excel / Google Sheets, then re-import</div></div></button>
        <button className="menu-row" onClick={() => { onClose(); push('StudyImport', { help: true }); }}><Info size={18} /><div className="grow"><div className="t">Excel format guide</div><div className="s">Columns and rules, plus a template</div></div><ChevronRight size={16} /></button>
      </div>
    </Sheet>
  );
}

export function StudyImport({ help }) {
  const { toast, pop } = useApp();
  const fileRef = useRef();
  const [plan, setPlan] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setErr(''); setBusy(true);
    try {
      const rows = await readSpreadsheet(f);
      if (!rows.length) throw new Error('No rows found. The first row must be the column headers (Subject, Topic, Subtopic, Lesson, …).');
      const p = await planImport(rows);
      if (!p.length) throw new Error('Couldn’t find any Subject/Topic rows. Check the column names in the first row.');
      setPlan(p);
    } catch (x) { setErr(x.message || String(x)); }
    setBusy(false);
  };
  const template = async () => {
    const sample = { sid: 'u-example', title: 'Example subject', children: [
      { id: 'u-example.t1', title: 'First topic', summary: 'What this topic is about', children: [
        { id: 'u-example.t1.a', title: 'A subtopic that has lessons', children: [
          { id: 'u-example.t1.a.l1', title: 'Lesson one', difficulty: 'Easy', recall: 'What is the key idea of lesson one?', resources: [{ title: 'Intro video', url: 'https://www.youtube.com/', kind: 'learn', medium: 'video' }, { title: 'Practice set', url: 'https://example.com/practice', kind: 'practice', medium: 'problem' }] },
          { id: 'u-example.t1.a.l2', title: 'Lesson two', resources: [{ title: 'Article', url: 'https://example.com/article', kind: 'deep', medium: 'article' }] },
        ] },
        { id: 'u-example.t1.b', title: 'A subtopic that is itself a lesson', resources: [{ title: 'Guide', url: 'https://example.com/guide', kind: 'learn', medium: 'article' }] },
      ] },
    ] };
    await saveBlob(await exportXlsx([sample]), 'Kaizen roadmap template.xlsx');
  };
  return (
    <div className="screen no-nav page-enter">
      <TopBar title={help ? 'Excel format' : 'Import roadmap'} />
      {!plan && (
        <>
          {!help && (
            <div className="card">
              <div className="row gap-12"><div className="tile" style={{ background: 'color-mix(in srgb, var(--habit) 16%, transparent)' }}><FileSpreadsheet size={20} color="var(--habit)" /></div><div className="grow"><div style={{ fontWeight: 650 }}>Choose a spreadsheet</div><div className="tiny muted">.xlsx or .csv — a new subject is created, or an existing one with the same name is updated.</div></div></div>
              <input ref={fileRef} type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" style={{ display: 'none' }} onChange={pick} />
              <button className="btn primary block mt-12" disabled={busy} onClick={() => fileRef.current.click()}>{busy ? 'Reading…' : 'Choose file'}</button>
              {err && <div className="small mt-12" style={{ color: 'var(--bad)' }}>{err}</div>}
            </div>
          )}
          <div className="h3 mt-24 mb-8">The format</div>
          <div className="card flat">
            <div className="tiny muted mb-8">Columns (first row, any order):</div>
            <div className="cols">{COLUMNS.map((c) => <span key={c} className={`colpill ${['Subject', 'Topic'].includes(c) ? 'req' : ''}`}>{c}</span>)}</div>
            <ol className="guide">{GUIDE_LINES.slice(2).map((l, i) => <li key={i}>{l}</li>)}<li>{GUIDE_LINES[0]}</li></ol>
          </div>
          <div className="card flat mt-12">
            <div className="tiny muted mb-8">Example</div>
            <div className="xl-table">
              <div className="h">Subject</div><div className="h">Topic</div><div className="h">Subtopic</div><div className="h">Lesson</div><div className="h">Resource URL</div><div className="h">Type</div>
              <div>Physics</div><div>Mechanics</div><div>Kinematics</div><div>1-D motion</div><div>youtu.be/…</div><div>Learn</div>
              <div>Physics</div><div>Mechanics</div><div>Kinematics</div><div>1-D motion</div><div>hcverma…</div><div>Practice</div>
              <div>Physics</div><div>Mechanics</div><div>Newton’s laws</div><div></div><div>ocw.mit…</div><div>Deep dive</div>
            </div>
            <div className="tiny muted mt-8">Row 1–2: two resources for the lesson “1-D motion”. Row 3: “Newton’s laws” has no Lesson, so it is the lesson.</div>
          </div>
          <div className="row mt-12">
            <button className="btn grow" onClick={template}><Download size={16} /> Template</button>
            <button className="btn grow" onClick={async () => { await saveBlob(await exportXlsx(await db.subjects.orderBy('order').toArray()), `Kaizen study roadmaps ${today()}.xlsx`); toast('Exported'); }}><Download size={16} /> Export all</button>
          </div>
          <p className="tiny muted mt-12">Tip: export a subject, edit it in Excel or Google Sheets (keep the ID column), and import it again — your completed lessons stay completed.</p>
        </>
      )}
      {plan && (
        <>
          <p className="dim" style={{ marginTop: 0 }}>Here’s what will change:</p>
          <div className="col gap-12">
            {plan.map((p) => (
              <div key={p.sid} className="card">
                <div className="row gap-10"><span className="dot" style={{ background: p.color }} /><div className="grow" style={{ fontWeight: 680 }}>{p.title}</div><span className="pill-tag">{p.existing ? 'Update' : 'New subject'}</span></div>
                <div className="grid-3 mt-12">
                  <Stat v={p.diff.lessons} k="lessons" />
                  <Stat v={p.diff.topics} k="topics" />
                  <Stat v={p.diff.resources} k="resources" />
                </div>
                {p.existing && (
                  <div className="small mt-12 col gap-4">
                    <span><b style={{ color: 'var(--good)' }}>+{p.diff.added}</b> new · <b style={{ color: 'var(--warn)' }}>{p.diff.changed}</b> edited · <b style={{ color: 'var(--bad)' }}>−{p.diff.removed}</b> removed lessons</span>
                    <span className="muted">Progress kept on {p.diff.keptProgress} completed lessons{p.diff.lostProgress ? '' : '.'}</span>
                    {p.diff.lostProgress > 0 && <span style={{ color: 'var(--bad)' }}>{p.diff.lostProgress} completed lesson{p.diff.lostProgress > 1 ? 's are' : ' is'} not in the file and will be removed.</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="row mt-16">
            <button className="btn grow" onClick={() => setPlan(null)}>Cancel</button>
            <button className="btn primary grow" onClick={async () => { await applyImport(plan); success(); toast(plan.length > 1 ? `${plan.length} subjects imported` : 'Roadmap updated'); pop(); }}>Apply</button>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------ subject settings */
export function SubjectSettings({ sid }) {
  const { pop, toast } = useApp();
  const s = useLiveQuery(() => db.subjects.where('sid').equals(sid).first(), [sid]);
  const [del, setDel] = useState(false);
  const [reset, setReset] = useState(false);
  const [restore, setRestore] = useState(false);
  if (!s) return <div className="screen no-nav" />;
  const up = (patch) => db.subjects.update(s.id, patch);
  const builtin = s.source === 'builtin';
  return (
    <div className="screen no-nav page-enter">
      <TopBar title={s.title} />
      <div className="list">
        <div className="menu-row"><div className="grow"><div className="t">Name</div></div><input className="input" style={{ maxWidth: 180, height: 38 }} value={s.title} onChange={(e) => up({ title: e.target.value })} /></div>
        <div className="menu-row"><div className="grow"><div className="t">Daily goal</div><div className="s">Minutes you want to study this each day</div></div><Stepper value={s.dailyMins || 30} step={10} min={0} max={300} suffix="m" onChange={(v) => up({ dailyMins: v })} /></div>
        <div className="menu-row"><div className="grow"><div className="t">Daily reminder</div><div className="s">“Time for {s.title} — next up: …”</div></div><Toggle on={s.reminder !== false} onChange={(v) => up({ reminder: v })} /></div>
        {s.reminder !== false && <div className="menu-row"><div className="grow"><div className="t">Reminder time</div></div><input type="time" className="input" style={{ maxWidth: 130, height: 38 }} value={s.reminderTime || '20:00'} onChange={(e) => up({ reminderTime: e.target.value })} /></div>}
        <div className="menu-row"><div className="grow"><div className="t">Active</div><div className="s">Paused subjects hide from Today & reminders</div></div><Toggle on={s.active !== false} onChange={(v) => up({ active: v })} /></div>
      </div>
      <div className="label mt-24 mb-8">Colour</div>
      <ColorPicker value={s.color} onChange={(c) => up({ color: c })} />
      <div className="list mt-24">
        <button className="menu-row" onClick={async () => { await saveBlob(await exportXlsx([s]), `${s.title} roadmap.xlsx`); toast('Exported'); }}><Download size={18} /><div className="grow"><div className="t">Export as Excel</div><div className="s">Edit it and import it back to update this roadmap</div></div></button>
        <button className="menu-row" onClick={() => setReset(true)}><RotateCcw size={18} /><div className="grow"><div className="t">Reset all progress</div></div></button>
        {builtin && <button className="menu-row" onClick={() => setRestore(true)}><Sparkles size={18} /><div className="grow"><div className="t">Restore original roadmap</div><div className="s">Undo your edits to the content (progress is kept)</div></div></button>}
        {!builtin && <button className="menu-row" onClick={() => setDel(true)}><Trash2 size={18} color="var(--bad)" /><div className="grow"><div className="t" style={{ color: 'var(--bad)' }}>Delete subject</div></div></button>}
      </div>
      {s.credits && <p className="tiny muted mt-16">{s.credits}</p>}
      <Confirm open={reset} onClose={() => setReset(false)} title="Reset all progress?" body="Every lesson goes back to not done and its flashcards are removed." confirmLabel="Reset" onConfirm={async () => { const ids = (await db.progress.where('sid').equals(sid).toArray()).map((p) => p.id); await db.progress.bulkDelete(ids); await db.cards.where('sid').equals(sid).delete(); toast('Progress reset'); }} />
      <Confirm open={restore} onClose={() => setRestore(false)} title="Restore the original roadmap?" body="Your added resources and renamed/removed items are undone." confirmLabel="Restore" onConfirm={async () => { await resetBuiltin(sid); toast('Restored'); }} />
      <Confirm open={del} onClose={() => setDel(false)} title={`Delete ${s.title}?`} body="The roadmap, progress and flashcards are deleted. Export it first if you may want it back." onConfirm={async () => { await db.subjects.delete(s.id); await db.progress.where('sid').equals(sid).delete(); await db.cards.where('sid').equals(sid).delete(); pop(); pop(); }} />
    </div>
  );
}

/* ------------------------------------------------ spaced repetition */
function ReviewHome() {
  const { push, settings } = useApp();
  const info = useLiveQuery(async () => {
    const all = await db.cards.toArray();
    const t = today();
    const week = lastNDays(7, addDays(t, 6)).map((d) => ({ label: d === t ? 'Now' : DAYS_SHORT[dow(d)][0], value: all.filter((c) => (d === t ? c.due <= t : c.due === d)).length }));
    const doneToday = await db.reviews.where('date').equals(t).count();
    const mature = all.filter((c) => c.interval >= 21).length;
    return { all: all.length, due: all.filter((c) => c.due <= t).length, week, doneToday, mature };
  }, []);
  if (!info) return null;
  const cap = settings.reviewCap || 12;
  const left = Math.max(0, Math.min(info.due, cap - info.doneToday));
  return (
    <div className="col gap-12">
      <div className="card review-hero">
        <div className="eyebrow">Today’s revision</div>
        {info.all === 0 ? (
          <p className="dim" style={{ margin: '8px 0 0' }}>Finish a lesson and it becomes a flashcard here. Cards come back after 1 → 3 → 7 → 16 → 35 days, adjusting to how well you remember — a few minutes a day keeps everything fresh.</p>
        ) : left > 0 ? (
          <>
            <div className="h1 mt-8 num">{left} <span className="h2 muted" style={{ fontWeight: 600 }}>card{left > 1 ? 's' : ''}</span></div>
            <div className="small muted">about {Math.max(1, Math.round(left * 0.6))} min{info.due > left ? ` · ${info.due - left} more tomorrow (daily cap ${cap})` : ''}</div>
            <button className="btn primary block mt-16" onClick={() => push('ReviewDeck')}><Brain size={18} /> Start revising</button>
          </>
        ) : (
          <div className="row gap-10 mt-8"><Check size={20} color="var(--good)" /><span className="dim">{info.doneToday ? `All done for today — ${info.doneToday} reviewed.` : 'Nothing due today.'}</span></div>
        )}
      </div>
      {info.all > 0 && (
        <>
          <div className="card"><div className="h3 mb-12">Coming up</div><Bars data={info.week} color="var(--task)" showValues height={90} /></div>
          <div className="grid-3"><Stat v={info.all} k="cards" /><Stat v={info.mature} k="long-term" sub="21+ days" /><Stat v={info.doneToday} k="today" /></div>
        </>
      )}
    </div>
  );
}

export function ReviewDeck() {
  const { pop, settings, celebrate } = useApp();
  const [deck, setDeck] = useState(null);
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const [info, setInfo] = useState({});
  const [results, setResults] = useState([]);
  useEffect(() => {
    (async () => {
      const { cards } = await dueCards(settings.reviewCap || 12);
      const subs = await db.subjects.toArray();
      const progress = await db.progress.bulkGet(cards.map((c) => c.id));
      const items = cards.map((c, k) => {
        const s = subs.find((x) => x.sid === c.sid);
        const hit = s ? findNode(s, c.id) : null;
        return hit ? { card: c, s, node: hit.node, path: hit.path, note: progress[k]?.note } : null;
      }).filter(Boolean);
      // cards whose lesson was removed from a roadmap
      const orphans = cards.filter((c) => !items.some((x) => x.card.id === c.id));
      if (orphans.length) await db.cards.bulkDelete(orphans.map((o) => o.id));
      setDeck(items);
    })();
  }, []);
  if (!deck) return <div className="screen no-nav" />;
  const cur = deck[i];
  const grade = async (g) => {
    tap();
    await gradeCard(cur.card, g);
    setResults((r) => [...r, g]);
    if (g === 0) setDeck((d) => [...d, { ...cur, card: { ...cur.card, reps: cur.card.reps + 1, interval: 1 }, again: true }]);
    setFlip(false);
    setI(i + 1);
    if (i + 1 >= deck.length + (g === 0 ? 1 : 0)) { success(); celebrate(); }
  };
  if (!cur) {
    const good = results.filter((g) => g >= 2).length;
    return (
      <div className="screen no-nav page-enter">
        <TopBar title="" />
        <div className="col" style={{ alignItems: 'center', textAlign: 'center', gap: 10, marginTop: 50 }}>
          <div className="rm-mastered" style={{ '--c': 'var(--task)' }}><Brain size={42} /></div>
          <h1 className="h1">{deck.length ? 'Revision done' : 'Nothing to revise'}</h1>
          <p className="dim">{deck.length ? `${results.length} cards · ${good} remembered well. See you tomorrow.` : 'Complete lessons to build your deck.'}</p>
          <button className="btn primary mt-16" onClick={pop}>Done</button>
        </div>
      </div>
    );
  }
  const total = deck.length;
  const res = cur.node.resources?.[0];
  return (
    <div className="screen no-nav page-enter review">
      <TopBar title="" right={<span className="tiny muted num">{i + 1} / {total}</span>} />
      <div className="rm-bar"><i style={{ width: `${(i / total) * 100}%`, background: 'var(--task)' }} /></div>
      <div className={`fcard ${flip ? 'flipped' : ''}`} style={{ '--c': cur.s.color }} onClick={() => !flip && setFlip(true)}>
        <div className="face front">
          <div className="eyebrow ellipsis" style={{ color: cur.s.color }}>{cur.s.title} › {cur.path.map((p) => p.title).join(' › ')}</div>
          <div className="lt">{cur.node.title}</div>
          <div className="q">{cur.node.recall || `Explain “${cur.node.title}” in your own words.`}</div>
          <div className="tiny muted" style={{ marginTop: 'auto' }}>Answer in your head, then tap to check</div>
        </div>
        <div className="face back">
          <div className="eyebrow" style={{ color: cur.s.color }}>{cur.node.title}</div>
          {cur.note ? <div className="note">{cur.note}</div> : <div className="small muted mt-8">No notes yet — add your answer on the lesson page so this side shows it next time.</div>}
          {cur.node.summary && <div className="small dim mt-12">{cur.node.summary}</div>}
          {res?.url && <button className="btn sm mt-16" onClick={(e) => { e.stopPropagation(); openUrl(res.url); }}><ExternalLink size={14} /> {res.title}</button>}
        </div>
      </div>
      {flip ? (
        <div className="grades">
          {GRADES.map((g) => (
            <button key={g.g} onClick={() => grade(g.g)} style={{ '--g': g.color }}>
              <b>{g.label}</b><span>{fmtIv(Math.min(365, nextInterval(cur.card, g.g)))}</span>
            </button>
          ))}
        </div>
      ) : (
        <button className="btn lg block mt-16" onClick={() => setFlip(true)}>Show answer</button>
      )}
    </div>
  );
}

/* Once a day on opening the app: a single gentle prompt, never a pile of pop-ups */
export function ReviewPrompt() {
  const { push, settings } = useApp();
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(0);
  useEffect(() => {
    const tmr = setTimeout(async () => {
      if (new Date().getHours() < 8) return;
      const kv = await db.kv.get('reviewPopup');
      if (kv?.value === today()) return;
      const { cards } = await dueCards(settings.reviewCap || 12);
      if (cards.length >= 1) { setN(cards.length); setOpen(true); await setKV('reviewPopup', today()); }
    }, 2500);
    return () => clearTimeout(tmr);
  }, []);
  return (
    <Sheet open={open} onClose={() => setOpen(false)}>
      <div className="col" style={{ alignItems: 'center', textAlign: 'center', gap: 8 }}>
        <div className="rm-mastered sm" style={{ '--c': 'var(--task)' }}><Brain size={30} /></div>
        <h2 className="h2">{n} card{n > 1 ? 's' : ''} to revise</h2>
        <p className="dim" style={{ margin: 0 }}>Lessons you finished are due for a quick recall — about {Math.max(1, Math.round(n * 0.6))} min.</p>
        <div className="row mt-16" style={{ width: '100%' }}>
          <button className="btn grow" onClick={() => setOpen(false)}>Later</button>
          <button className="btn primary grow" onClick={() => { setOpen(false); push('ReviewDeck'); }}>Revise now</button>
        </div>
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------ stats */
export function StudyStats() {
  const { ready, data } = useStudy();
  const d = useLiveQuery(async () => {
    const [sess, focus, prog, rev] = await Promise.all([db.studySessions.toArray(), db.focus.toArray(), db.progress.toArray(), db.reviews.toArray()]);
    const days = lastNDays(14);
    const minsBy = {};
    sess.forEach((s) => (minsBy[s.date] = (minsBy[s.date] || 0) + (s.mins || 0)));
    focus.forEach((f) => f.study && (minsBy[f.date] = (minsBy[f.date] || 0) + (f.minutes || 0)));
    const doneBy = {};
    prog.filter((p) => p.done && !p.bulk && p.doneAt).forEach((p) => (doneBy[p.doneAt] = (doneBy[p.doneAt] || 0) + 1));
    const all = await studyDays();
    return {
      mins: days.map((x) => ({ label: DAYS_SHORT[dow(x)][0], value: minsBy[x] || 0 })),
      lessons: days.map((x) => ({ label: DAYS_SHORT[dow(x)][0], value: doneBy[x] || 0 })),
      week: lastNDays(7).reduce((a, x) => a + (doneBy[x] || 0), 0),
      weekMins: lastNDays(7).reduce((a, x) => a + (minsBy[x] || 0), 0),
      streak: streakFrom(all), best: bestStreak(all), reviews: rev.length,
      retention: rev.length ? Math.round((rev.filter((r) => r.grade >= 2).length / rev.length) * 100) : null,
    };
  }, []);
  if (!d || !ready) return <div className="screen no-nav" />;
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="Study stats" />
      <div className="grid-3">
        <Stat v={d.streak} k="day streak" color="var(--fit)" sub={`best ${d.best}`} />
        <Stat v={d.week} k="lessons · 7d" color="var(--task)" />
        <Stat v={fmtDur(d.weekMins)} k="time · 7d" />
      </div>
      <div className="card mt-12"><div className="h3 mb-12">Lessons completed</div><Bars data={d.lessons} color="var(--task)" showValues height={90} /></div>
      <div className="card mt-12"><div className="h3 mb-12">Study minutes</div><Bars data={d.mins} color="var(--bored)" showValues height={90} /></div>
      <div className="card mt-12">
        <div className="h3 mb-12">Subjects</div>
        <div className="col gap-12">
          {data.map(({ s, t }) => (
            <div key={s.id}>
              <div className="row between small"><span style={{ fontWeight: 620 }}>{s.title}</span><span className="muted num">{t.done}/{t.total}</span></div>
              <div className="rm-bar mt-6"><i style={{ width: `${t.total ? (t.done / t.total) * 100 : 0}%`, background: s.color }} /></div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid-2 mt-12"><Stat v={d.reviews} k="flashcard reviews" /><Stat v={d.retention == null ? '—' : d.retention + '%'} k="remembered" /></div>
    </div>
  );
}
function bestStreak(days) {
  const arr = [...days].sort();
  let best = 0, run = 0, prev = null;
  for (const x of arr) { run = prev && addDays(prev, 1) === x ? run + 1 : 1; best = Math.max(best, run); prev = x; }
  return best;
}

/* Today card: study at a glance */
export function StudyCard() {
  const { push, goTab } = useApp();
  const { ready, data } = useStudy();
  const st = useStudyToday();
  if (!ready || !st) return null;
  const active = data.filter((d) => d.s.active !== false && d.next);
  if (!active.length && !st.due) return null;
  return (
    <div className="card">
      <div className="row between mb-12">
        <div className="row gap-8"><span className="h3">Study</span>{st.streak > 0 && <span className="row gap-2 tiny" style={{ color: 'var(--fit)' }}><Flame size={13} />{st.streak}</span>}</div>
        <button className="tiny muted" onClick={() => goTab('study')}>All roadmaps</button>
      </div>
      <div className="col gap-8">
        {active.slice(0, 3).map(({ s, next }) => {
          const m = st.mins[s.sid] || 0;
          const g = s.dailyMins || 30;
          return (
            <button key={s.id} className="study-row" onClick={() => push('Lesson', { sid: s.sid, id: next.id })}>
              <Ring size={34} stroke={4} value={m / g} color={s.color}><HIcon icon={s.icon} size={14} color={s.color} /></Ring>
              <span className="grow" style={{ minWidth: 0, textAlign: 'left' }}>
                <span className="tiny muted" style={{ display: 'block' }}>{s.title} · {m ? `${m}/${g} min` : `${g} min goal`}{st.lessons[s.sid] ? ` · ${st.lessons[s.sid]} done` : ''}</span>
                <span className="ellipsis" style={{ display: 'block', fontWeight: 600 }}>{next.title}</span>
              </span>
              <ChevronRight size={16} color="var(--muted)" />
            </button>
          );
        })}
        {st.due > 0 && (
          <button className="study-row" onClick={() => push('ReviewDeck')}>
            <span className="tile sm" style={{ background: 'color-mix(in srgb, var(--task) 18%, transparent)' }}><Brain size={16} color="var(--task)" /></span>
            <span className="grow" style={{ textAlign: 'left', fontWeight: 600 }}>Revise {st.due} card{st.due > 1 ? 's' : ''}</span>
            <ChevronRight size={16} color="var(--muted)" />
          </button>
        )}
      </div>
    </div>
  );
}

/* Plan → add study blocks to today's tasks */
export function StudySuggestions({ date = today() }) {
  const { toast } = useApp();
  const { ready, data } = useStudy();
  const tasks = useLiveQuery(() => db.tasks.where('due').equals(date).toArray(), [date]) || [];
  const [pick, setPick] = useState(null);
  const [time, setTime] = useState('19:00');
  if (!ready) return null;
  const cand = data.filter((d) => d.s.active !== false && d.next && !tasks.some((t) => t.study?.sid === d.s.sid));
  if (!cand.length) return null;
  return (
    <div className="card flat">
      <div className="row between"><div className="eyebrow">Study today</div><span className="tiny muted">tap to schedule</span></div>
      <div className="chips wrap mt-8">
        {cand.map((d) => (
          <button key={d.s.id} className="chip" onClick={() => { setPick(d); setTime(d.s.reminderTime || '19:00'); }}>
            <CalendarPlus size={14} style={{ marginRight: 4 }} color={d.s.color} />{d.s.title} · {d.s.dailyMins || 30}m
          </button>
        ))}
      </div>
      <Sheet open={!!pick} onClose={() => setPick(null)} title={pick ? `Study ${pick.s.title}` : ''}>
        {pick && (
          <div className="col gap-12">
            <div className="small dim">Next lesson: <b>{pick.next.title}</b></div>
            <Field label="At"><input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
            <button className="btn primary block" onClick={async () => {
              await db.tasks.add({ title: `${pick.s.title}: ${pick.next.title}`, description: '', due: date, dueTime: time, reminder: 0, duration: pick.s.dailyMins || 30, done: false, createdAt: Date.now(), priority: 'none', recurrence: 'none', subtasks: [], study: { sid: pick.s.sid, id: pick.next.id } });
              toast('Added to your day'); setPick(null);
            }}>Add to {date === today() ? 'today' : 'plan'} with reminder</button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
