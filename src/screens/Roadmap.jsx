import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Check, Play, Trophy, MoreHorizontal, Link2, PlayCircle, FileText, BookOpen, GraduationCap, MousePointerClick,
  Code2, ScrollText, PenLine, Swords, Plus, Pencil, Trash2, Timer, ChevronRight, ChevronLeft, Undo2, Sparkles, Brain, Star,
} from 'lucide-react';
import { db } from '../db';
import { useApp } from '../ctx';
import { TopBar, Sheet, Confirm, Field, Chips, Ring } from '../ui/kit';
import { HIcon } from '../ui/icons';
import { success, tap, openUrl } from '../lib/native';
import { fmtDate, diffDays, today } from '../lib/date';
import {
  findNode, isLeaf, tally, firstUndone, completeLesson, uncompleteLesson, markAll, lastCompleted, KINDS, MEDIA,
  addResource, editResource, deleteResource, addChild, renameNode, deleteNode, setNote, fmtIv,
} from '../lib/study';

export const MEDIUM_ICON = { video: PlayCircle, article: FileText, book: BookOpen, course: GraduationCap, interactive: MousePointerClick, problem: Code2, paper: ScrollText, code: Code2, exercise: PenLine };
const OFFS = [0, 0.55, 0.9, 0.55, 0, -0.55, -0.9, -0.55];
const GAP = 116;
const TOP = 64;

/* live data for a subject: subject row + done set */
export function useSubject(sid) {
  const subject = useLiveQuery(() => db.subjects.where('sid').equals(sid).first(), [sid]);
  const prog = useLiveQuery(() => db.progress.where('sid').equals(sid).toArray(), [sid]);
  const done = useMemo(() => new Set((prog || []).filter((p) => p.done).map((p) => p.id)), [prog]);
  return { subject, prog, done, loading: subject === undefined || prog === undefined };
}

/* =================================================================== Roadmap */
export function Roadmap({ sid, id }) {
  const { push, toast, celebrate } = useApp();
  const { subject, done, loading } = useSubject(sid);
  const wrap = useRef();
  const [W, setW] = useState(360);
  const [menu, setMenu] = useState(false);
  const [resOpen, setResOpen] = useState(false);
  const [quick, setQuick] = useState(null);
  const [adding, setAdding] = useState(false);
  const [anim, setAnim] = useState(null); // { idx, phase }
  const [mastered, setMastered] = useState(false);
  const [confirmAll, setConfirmAll] = useState(null);
  const prevTallies = useRef(null);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const m = () => el.clientWidth && setW(el.clientWidth);
    m();
    const ro = new ResizeObserver(m);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading]);

  const hit = subject && id ? findNode(subject, id) : null;
  const node = subject ? (id ? hit?.node : { id: '__root', title: subject.title, children: subject.children, resources: [] }) : null;
  const path = hit?.path || [];
  const depth = id ? path.length + 1 : 0;
  const kids = node?.children || [];
  const cache = useMemo(() => new Map(), [done, subject]);
  const tallies = kids.map((k) => tally(k, done, cache));
  const own = tallies.reduce((a, t) => ({ done: a.done + t.done, total: a.total + t.total }), { done: 0, total: 0 });
  const current = tallies.findIndex((t) => t.done < t.total);
  const color = subject?.color || 'var(--accent)';
  const levelName = (kids.length && kids.every(isLeaf) ? subject?.levels?.[subject.levels.length - 1] : subject?.levels?.[depth]) || (kids.some((k) => !isLeaf(k)) ? 'Topic' : 'Lesson');

  // detect newly completed children → queue the celebration animation for when this screen is visible
  const sigNow = tallies.map((t) => `${t.done}/${t.total}`).join(',');
  const pending = useRef(null);
  useEffect(() => {
    if (!node) return;
    const prev = prevTallies.current;
    prevTallies.current = tallies;
    if (!prev || prev.length !== tallies.length) return;
    const idx = tallies.findIndex((t, i) => t.done === t.total && prev[i].done < prev[i].total);
    if (idx >= 0) pending.current = { idx, whole: own.done === own.total && own.total > 0, fresh: Date.now() - lastCompleted.ts < 60000 };
  }, [sigNow]);
  useEffect(() => {
    const iv = setInterval(() => {
      const p = pending.current;
      if (!p || !wrap.current || wrap.current.offsetParent === null) return;
      pending.current = null;
      runCelebration(p);
    }, 160);
    return () => clearInterval(iv);
  }, []);
  const runCelebration = (p) => {
    const y = TOP + p.idx * GAP;
    const sc = wrap.current.closest('.screen') || document.scrollingElement;
    const rect = wrap.current.getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + rect.top + y - window.innerHeight * 0.38, behavior: 'smooth' });
    setAnim({ idx: p.idx, phase: 0 });
    setTimeout(() => { setAnim({ idx: p.idx, phase: 1 }); success(); }, 380);
    setTimeout(() => setAnim({ idx: p.idx, phase: 2 }), 1000);
    setTimeout(() => {
      setAnim({ idx: p.idx, phase: 3 });
      if (p.whole) { setMastered(true); celebrate(); }
    }, 1850);
    setTimeout(() => setAnim(null), 3400);
    void sc;
  };

  // first open: bring the current node into view
  const scrolled = useRef(false);
  useEffect(() => {
    if (loading || scrolled.current || !wrap.current || current < 3) return;
    scrolled.current = true;
    const rect = wrap.current.getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + rect.top + TOP + current * GAP - window.innerHeight * 0.4 });
  }, [loading, current]);

  if (loading) return <div className="screen no-nav" />;
  if (!node) return <div className="screen no-nav"><TopBar title="Not found" /><p className="dim">This part of the roadmap no longer exists.</p></div>;

  const pos = (i) => ({ x: W / 2 + OFFS[i % OFFS.length] * Math.max(0, W / 2 - 64), y: TOP + i * GAP });
  const n = kids.length;
  const height = TOP + n * GAP + 90;
  const segD = (i) => {
    const a = pos(i), b = i + 1 < n ? pos(i + 1) : { x: W / 2, y: TOP + n * GAP + 6 };
    return `M ${a.x} ${a.y} C ${a.x} ${a.y + GAP * 0.5} ${b.x} ${b.y - GAP * 0.5} ${b.x} ${b.y}`;
  };
  const open = (k) => (isLeaf(k) ? push('Lesson', { sid, id: k.id }) : push('Roadmap', { sid, id: k.id }));
  const pct = own.total ? own.done / own.total : 0;
  const crumbs = [subject.title, ...path.map((p) => p.title)];

  let press;
  const startPress = (k) => { press = setTimeout(() => { tap('medium'); setQuick(k); press = 'fired'; }, 480); };
  const endPress = (k, e) => { if (press === 'fired') { e.preventDefault(); press = null; return; } clearTimeout(press); press = null; open(k); };

  return (
    <div className="screen no-nav page-enter">
      <TopBar title={id ? node.title : subject.title} right={<button className="icon-btn" onClick={() => setMenu(true)} aria-label="More"><MoreHorizontal size={20} /></button>} />
      <div className="rm-hero" style={{ '--c': color }}>
        <div className="eyebrow ellipsis" style={{ color }}>{id ? crumbs.join('  ›  ') : `${n} ${(subject.levels?.[0] || 'topic').toLowerCase()}s · roadmap`}</div>
        <div className="h2 mt-4" style={{ lineHeight: 1.2 }}>{id ? node.title : subject.long || subject.title}</div>
        {!id && subject.description && <p className="small dim clamp3" style={{ margin: '6px 0 0' }}>{subject.description}</p>}
        {node.summary && <p className="small dim" style={{ margin: '6px 0 0' }}>{node.summary}</p>}
        <div className="row mt-12 gap-10">
          <div className="grow">
            <div className="rm-bar"><i style={{ width: `${pct * 100}%`, background: color }} /></div>
            <div className="row between mt-6 tiny muted"><span>{own.done} of {own.total} {own.total === 1 ? 'lesson' : 'lessons'}</span><span className="num">{Math.round(pct * 100)}%</span></div>
          </div>
          {(node.resources || []).length > 0 && <button className="btn sm" onClick={() => setResOpen(true)}><Link2 size={15} /> {node.resources.length}</button>}
        </div>
      </div>

      {n === 0 ? (
        <div className="empty mt-24">
          <div className="small muted">Nothing here yet.</div>
          <button className="btn sm mt-12" onClick={() => setAdding(true)}><Plus size={15} /> Add a {levelName.toLowerCase()}</button>
        </div>
      ) : (
        <div className="rm" ref={wrap} style={{ height, '--c': color }}>
          <svg width={W} height={height} className="rm-svg">
            <defs><linearGradient id="rmg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} /><stop offset="1" stopColor={color} stopOpacity=".65" /></linearGradient></defs>
            {kids.map((k, i) => <path key={'t' + k.id} d={segD(i)} className="rm-track" />)}
            {kids.map((k, i) => <path key={'c' + k.id} d={segD(i)} className="rm-center" />)}
            {kids.map((k, i) => {
              const on = tallies[i].done === tallies[i].total;
              const drawing = anim && anim.idx === i && anim.phase < 2;
              const animNow = anim && anim.idx === i && anim.phase >= 2;
              if (!on || drawing) return null;
              return <path key={'s' + k.id + (animNow ? 'a' : '')} d={segD(i)} pathLength="1" className={`rm-trail ${animNow ? 'draw' : ''}`} stroke="url(#rmg)" />;
            })}
          </svg>
          {kids.map((k, i) => {
            const p = pos(i);
            const t = tallies[i];
            const full = t.done === t.total;
            const partial = t.done > 0 && !full;
            const isCur = i === current && !(anim && anim.phase < 3);
            const pop = anim && anim.idx === i && anim.phase >= 1 && anim.phase < 3;
            const arriving = anim && anim.phase === 3 && i === current;
            const leaf = isLeaf(k);
            const left = p.x > W / 2 + 4 || (Math.abs(p.x - W / 2) < 5 && OFFS[(i + 1) % OFFS.length] > 0);
            const labelW = left ? p.x - 46 - 6 : W - p.x - 46 - 6;
            const shownFull = full && !(anim && anim.idx === i && anim.phase === 0);
            return (
              <React.Fragment key={k.id}>
                <button
                  className={`rm-node ${shownFull ? 'done' : ''} ${isCur ? 'cur' : ''} ${pop ? 'pop' : ''} ${arriving ? 'arrive' : ''}`}
                  style={{ left: p.x - 36, top: p.y - 36 }}
                  onPointerDown={() => startPress(k)} onPointerLeave={() => { if (press !== 'fired') clearTimeout(press); }}
                  onClick={(e) => endPress(k, e)} onContextMenu={(e) => { e.preventDefault(); clearTimeout(press); setQuick(k); }}
                  aria-label={k.title}
                >
                  <svg className="rm-ring" viewBox="0 0 80 80" width="80" height="80">
                    <circle cx="40" cy="40" r="37" className="bg" />
                    {!leaf && t.total > 0 && (t.done > 0 || shownFull) && <circle cx="40" cy="40" r="37" className="fg" stroke={color} strokeDasharray={`${(shownFull ? 1 : t.done / t.total) * 232.5} 232.5`} />}
                  </svg>
                  <span className="rm-face">
                    {shownFull ? <Check size={30} strokeWidth={3.2} /> : isCur && t.done === 0 && leaf ? <Play size={24} fill="currentColor" /> : partial ? <span className="rm-frac">{t.done}<i>/{t.total}</i></span> : leaf ? React.createElement(MEDIUM_ICON[k.resources?.find((r) => r.kind === 'practice')?.medium || k.resources?.[0]?.medium] || BookOpen, { size: 24, strokeWidth: 2.2 }) : <span className="rm-num">{i + 1}</span>}
                    <i className="rm-shine" />
                  </span>
                  {pop && <span className="rm-burst">{Array.from({ length: 10 }, (_, j) => <i key={j} style={{ '--a': `${j * 36}deg`, '--d': `${(j % 3) * 40}ms` }}><Star size={j % 2 ? 12 : 16} fill="currentColor" /></i>)}</span>}
                  {isCur && !(anim && anim.phase < 3) && <span className="rm-bubble">{t.done === 0 ? (i === 0 && own.done === 0 ? 'START' : 'NEXT') : 'CONTINUE'}</span>}
                </button>
                <div className={`rm-label ${left ? 'l' : 'r'} ${full ? 'done' : ''} ${isCur ? 'cur' : ''}`} style={{ top: p.y - 34, maxWidth: Math.max(110, labelW), ...(left ? { right: W - p.x + 48 } : { left: p.x + 48 }) }} onClick={() => open(k)}>
                  <div className="t">{k.title}</div>
                  {!leaf && <div className="rm-mini"><i style={{ width: `${(t.done / Math.max(1, t.total)) * 100}%` }} /></div>}
                  <div className="s">
                    {leaf ? (k.difficulty || (k.resources?.length ? `${k.resources.length} resource${k.resources.length > 1 ? 's' : ''}` : 'Lesson')) : `${t.done}/${t.total} lessons${k.children.some((c) => !isLeaf(c)) ? ` · ${k.children.length} ${(subject.levels?.[depth + 1] || 'topic').toLowerCase()}${k.children.length > 1 ? 's' : ''}` : ''}`}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
          <div className={`rm-trophy ${own.done === own.total ? 'won' : ''}`} style={{ left: W / 2 - 30, top: TOP + n * GAP - 24 }}>
            <Trophy size={26} />
          </div>
        </div>
      )}

      <Sheet open={menu} onClose={() => setMenu(false)} title={id ? node.title : subject.title}>
        <div className="list">
          {own.done < own.total && <button className="menu-row" onClick={() => { setMenu(false); setConfirmAll(true); }}><Check size={18} /><div className="grow"><div className="t">I already know all of this</div><div className="s">Mark every lesson here as done</div></div></button>}
          {own.done > 0 && <button className="menu-row" onClick={() => { setMenu(false); setConfirmAll(false); }}><Undo2 size={18} /><div className="grow"><div className="t">Reset progress here</div><div className="s">Mark these {own.done} lessons as not done</div></div></button>}
          <button className="menu-row" onClick={() => { setMenu(false); setAdding(true); }}><Plus size={18} /><div className="grow"><div className="t">Add a {levelName.toLowerCase()}</div><div className="s">Your own item at the end of this roadmap</div></div></button>
          {id && <button className="menu-row" onClick={() => { setMenu(false); setResOpen(true); }}><Link2 size={18} /><div className="grow"><div className="t">Resources for this {subject.levels?.[depth - 1]?.toLowerCase() || 'topic'}</div><div className="s">{(node.resources || []).length} links · add your own</div></div></button>}
          {!id && <button className="menu-row" onClick={() => { setMenu(false); push('SubjectSettings', { sid }); }}><Pencil size={18} /><div className="grow"><div className="t">Subject settings</div><div className="s">Daily goal, reminder, colour, export</div></div></button>}
        </div>
      </Sheet>
      <Confirm open={confirmAll !== null} onClose={() => setConfirmAll(null)} title={confirmAll ? 'Mark everything here done?' : 'Reset progress here?'}
        body={confirmAll ? `All ${own.total - own.done} remaining lessons in “${node.title}” will be marked complete. They won’t be added to your revision deck.` : `The ${own.done} completed lessons in “${node.title}” will go back to not done.`}
        confirmLabel={confirmAll ? 'Mark done' : 'Reset'}
        onConfirm={async () => { const c = await markAll(sid, node, !!confirmAll); toast(confirmAll ? `${c} lessons marked done` : 'Progress reset'); }} />
      <ResourcesSheet open={resOpen} onClose={() => setResOpen(false)} subject={subject} node={node} />
      <QuickSheet k={quick} onClose={() => setQuick(null)} sid={sid} subject={subject} done={done} open={open} />
      <AddChildSheet open={adding} onClose={() => setAdding(false)} subject={subject} parentId={id} what={levelName} />
      <Sheet open={mastered} onClose={() => setMastered(false)}>
        <div className="col" style={{ alignItems: 'center', textAlign: 'center', gap: 8, padding: '6px 0' }}>
          <div className="rm-mastered" style={{ '--c': color }}><Trophy size={46} /></div>
          <div className="eyebrow" style={{ color }}>{levelName === 'Lesson' ? 'Topic' : subject.levels?.[depth - 1] || 'Topic'} complete</div>
          <h2 className="h1" style={{ fontSize: 26 }}>{node.title}</h2>
          <p className="dim" style={{ margin: 0 }}>All {own.total} lessons done. They’ll come back as quick flashcards so they stick.</p>
          <button className="btn primary block mt-16" onClick={() => setMastered(false)}>Onwards</button>
        </div>
      </Sheet>
    </div>
  );
}

function QuickSheet({ k, onClose, sid, subject, done, open }) {
  const { toast } = useApp();
  const [del, setDel] = useState(false);
  const [ren, setRen] = useState(false);
  const [title, setTitle] = useState('');
  if (!k) return null;
  const t = tally(k, done);
  const full = t.done === t.total;
  return (
    <>
      <Sheet open={!!k && !del && !ren} onClose={onClose} title={k.title}>
        <div className="list">
          <button className="menu-row" onClick={() => { onClose(); open(k); }}><ChevronRight size={18} /><div className="grow"><div className="t">Open</div></div></button>
          <button className="menu-row" onClick={async () => { onClose(); if (isLeaf(k)) { if (full) await uncompleteLesson(k.id); else await completeLesson(sid, k); } else await markAll(sid, k, !full); toast(full ? 'Marked not done' : 'Marked done'); }}>
            {full ? <Undo2 size={18} /> : <Check size={18} />}<div className="grow"><div className="t">{full ? 'Mark not done' : isLeaf(k) ? 'Mark done' : 'Mark all done'}</div></div>
          </button>
          <button className="menu-row" onClick={() => { setTitle(k.title); setRen(true); }}><Pencil size={18} /><div className="grow"><div className="t">Rename</div></div></button>
          <button className="menu-row" onClick={() => setDel(true)}><Trash2 size={18} color="var(--bad)" /><div className="grow"><div className="t" style={{ color: 'var(--bad)' }}>Remove from roadmap</div></div></button>
        </div>
      </Sheet>
      <Sheet open={ren} onClose={() => { setRen(false); onClose(); }} title="Rename">
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        <button className="btn primary block mt-16" disabled={!title.trim()} onClick={async () => { await renameNode(subject, k.id, title.trim()); setRen(false); onClose(); }}>Save</button>
      </Sheet>
      <Confirm open={del} onClose={() => { setDel(false); onClose(); }} title={`Remove “${k.title}”?`} body="It disappears from this roadmap (and everything inside it). Re-import the subject's spreadsheet to bring it back." confirmLabel="Remove" onConfirm={() => deleteNode(subject, k.id)} />
    </>
  );
}

function AddChildSheet({ open, onClose, subject, parentId, what }) {
  const [title, setTitle] = useState('');
  return (
    <Sheet open={open} onClose={onClose} title={`Add a ${what.toLowerCase()}`}>
      <input className="input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      <p className="tiny muted">It’s added at the end. Open it to add resources, or add items inside it to make it a roadmap of its own.</p>
      <button className="btn primary block mt-12" disabled={!title.trim()} onClick={async () => { await addChild(subject, parentId || null, title); setTitle(''); onClose(); }}>Add</button>
    </Sheet>
  );
}

/* =================================================================== resources */
export function ResourceList({ subject, node, editable = true }) {
  const [form, setForm] = useState(null); // {idx?, res}
  const groups = KINDS.map(([k, label, sub]) => ({ k, label, sub, items: (node.resources || []).map((r, idx) => ({ r, idx })).filter((x) => (x.r.kind || 'learn') === k) })).filter((g) => g.items.length);
  const other = (node.resources || []).map((r, idx) => ({ r, idx })).filter((x) => !KINDS.some(([k]) => k === (x.r.kind || 'learn')));
  if (other.length) groups.push({ k: 'other', label: 'More', sub: '', items: other });
  return (
    <div className="col gap-16">
      {groups.map((g) => (
        <div key={g.k}>
          <div className="row between mb-8"><div className="res-kind">{g.label}</div><div className="tiny muted">{g.sub}</div></div>
          <div className="list">
            {g.items.map(({ r, idx }) => <ResourceRow key={idx} r={r} onEdit={editable ? () => setForm({ idx, res: r }) : null} />)}
          </div>
        </div>
      ))}
      {!groups.length && <div className="small muted">No resources yet.</div>}
      {editable && <button className="btn sm ghost" style={{ alignSelf: 'flex-start', paddingLeft: 0 }} onClick={() => setForm({ res: { kind: 'learn', medium: 'article' } })}><Plus size={16} /> Add a resource</button>}
      <ResourceForm open={!!form} value={form} onClose={() => setForm(null)} subject={subject} node={node} />
    </div>
  );
}
function ResourceRow({ r, onEdit }) {
  const Ico = MEDIUM_ICON[r.medium] || Link2;
  const host = (() => { try { return new URL(r.url).hostname.replace(/^www\./, ''); } catch { return ''; } })();
  return (
    <div className="res-row">
      <button className="grow row gap-12" style={{ textAlign: 'left', minWidth: 0 }} onClick={() => (r.url ? openUrl(r.url) : onEdit?.())}>
        <span className={`res-ico m-${r.medium}`}><Ico size={17} /></span>
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="t">{r.title}</span>
          <span className="s">{[r.url ? host : 'Exercise', r.note, r.user ? 'added by you' : ''].filter(Boolean).join(' · ')}</span>
        </span>
      </button>
      {onEdit && <button className="icon-btn sm ghost" onClick={onEdit} aria-label="Edit"><Pencil size={14} /></button>}
    </div>
  );
}
function ResourceForm({ open, value, onClose, subject, node }) {
  const [r, setR] = useState({});
  const [del, setDel] = useState(false);
  useEffect(() => { if (open) setR({ title: '', url: '', note: '', ...(value?.res || {}) }); }, [open]);
  const editing = value && value.idx != null;
  const save = async () => {
    let url = (r.url || '').trim();
    if (url && !/^https?:\/\//.test(url)) url = 'https://' + url;
    const res = { title: (r.title || '').trim() || url, url, kind: r.kind || 'learn', medium: r.medium || 'article', ...(r.note?.trim() ? { note: r.note.trim() } : {}) };
    if (editing) await editResource(subject, node.id, value.idx, { ...res, note: r.note?.trim() || undefined });
    else await addResource(subject, node.id, res);
    onClose();
  };
  return (
    <>
      <Sheet open={open && !del} onClose={onClose} title={editing ? 'Edit resource' : 'Add a resource'}>
        <div className="col gap-12">
          <Field label="Link"><input className="input" inputMode="url" placeholder="https://…" value={r.url || ''} onChange={(e) => setR({ ...r, url: e.target.value })} /></Field>
          <Field label="Title"><input className="input" placeholder="e.g. NeetCode video" value={r.title || ''} onChange={(e) => setR({ ...r, title: e.target.value })} /></Field>
          <Field label="What is it for"><Chips wrap value={r.kind} onChange={(v) => setR({ ...r, kind: v })} options={KINDS.map(([k, l]) => ({ value: k, label: l }))} /></Field>
          <Field label="Type"><Chips wrap value={r.medium} onChange={(v) => setR({ ...r, medium: v })} options={MEDIA.map((m) => ({ value: m, label: m[0].toUpperCase() + m.slice(1) }))} /></Field>
          <Field label="Note (optional)"><input className="input" placeholder="e.g. watch 12:00–30:00" value={r.note || ''} onChange={(e) => setR({ ...r, note: e.target.value })} /></Field>
          <div className="row">
            {editing && <button className="btn danger" onClick={() => setDel(true)}><Trash2 size={16} /></button>}
            <button className="btn primary grow" disabled={!(r.url || '').trim() && !(r.title || '').trim()} onClick={save}>{editing ? 'Save' : 'Add'}</button>
          </div>
        </div>
      </Sheet>
      <Confirm open={del} onClose={() => { setDel(false); onClose(); }} title="Delete this resource?" onConfirm={() => deleteResource(subject, node.id, value.idx)} />
    </>
  );
}
function ResourcesSheet({ open, onClose, subject, node }) {
  return (
    <Sheet open={open} onClose={onClose} title="Resources">
      <div style={{ maxHeight: '64vh', overflowY: 'auto', margin: '0 -4px', padding: '0 4px' }}>
        <ResourceList subject={subject} node={node} />
      </div>
    </Sheet>
  );
}

/* =================================================================== Lesson */
export function Lesson({ sid, id }) {
  const { push, pop, toast } = useApp();
  const { subject, prog, done, loading } = useSubject(sid);
  const card = useLiveQuery(() => db.cards.get(id), [id]);
  const [note, setNoteS] = useState(null);
  const [flip, setFlip] = useState(false);
  const [busy, setBusy] = useState(false);
  const [askTime, setAskTime] = useState(false);
  if (loading) return <div className="screen no-nav" />;
  const hit = findNode(subject, id);
  if (!hit) return <div className="screen no-nav"><TopBar title="Lesson" /><p className="dim">This lesson was removed from the roadmap.</p></div>;
  const { node, path } = hit;
  const parent = path[path.length - 1];
  const siblings = parent ? parent.children : subject.children;
  const pos = siblings.findIndex((s) => s.id === id);
  const p = (prog || []).find((x) => x.id === id);
  const isDone = done.has(id);
  const color = subject.color;
  const noteVal = note ?? p?.note ?? '';
  const nextUp = firstUndone(siblings.slice(pos + 1), done) || firstUndone(subject.children, new Set([...done, id]));
  const go = (k) => { pop(); setTimeout(() => push('Lesson', { sid, id: k.id }), 0); };

  const complete = async (mins = 0) => {
    if (busy) return;
    setBusy(true);
    setAskTime(false);
    await completeLesson(sid, node, { mins });
    success();
    toast('Lesson complete');
    pop();
  };
  return (
    <div className="screen no-nav page-enter" style={{ paddingBottom: 110 }}>
      <TopBar title="" right={<span className="tiny muted num">{pos + 1} / {siblings.length}</span>} />
      <div className="eyebrow ellipsis" style={{ color }}>{[subject.title, ...path.map((x) => x.title)].join('  ›  ')}</div>
      <h1 className="h1 mt-8" style={{ fontSize: 27, lineHeight: 1.15 }}>{node.title}</h1>
      <div className="row gap-6 mt-12 wrap">
        {node.difficulty && <span className={`pill-tag d-${String(node.difficulty).toLowerCase()}`}>{node.difficulty}</span>}
        {isDone && <span className="pill-tag ok"><Check size={12} /> Done {p?.doneAt ? fmtDate(p.doneAt) : ''}</span>}
        {card && <span className="pill-tag"><Brain size={12} /> review {card.due <= today() ? 'due' : `in ${fmtIv(diffDays(card.due, today()))}`}</span>}
      </div>
      {node.summary && <p className="dim mt-12" style={{ marginBottom: 0 }}>{node.summary}</p>}

      <div className="mt-24"><ResourceList subject={subject} node={node} /></div>

      {!isLeaf(node) && <button className="btn block mt-16" onClick={() => push('Roadmap', { sid, id })}>Open roadmap</button>}

      <div className="flash mt-24" style={{ '--c': color }} onClick={() => setFlip(!flip)}>
        <div className="row between"><span className="eyebrow" style={{ color }}><Sparkles size={12} /> Recall</span><span className="tiny muted">{flip ? 'your notes' : 'tap to flip'}</span></div>
        {!flip ? (
          <div className="q">{node.recall || `Explain “${node.title}” in your own words.`}</div>
        ) : (
          <textarea className="input" style={{ minHeight: 110, marginTop: 10 }} placeholder="Write your answer / key idea. It shows on the back of the flashcard when you revise." value={noteVal}
            onClick={(e) => e.stopPropagation()} onChange={(e) => setNoteS(e.target.value)} onBlur={() => note != null && setNote(sid, id, note)} />
        )}
      </div>

      <div className="row mt-16 gap-8">
        <button className="btn sm grow" disabled={pos <= 0} onClick={() => go(siblings[pos - 1])}><ChevronLeft size={16} /> Previous</button>
        <button className="btn sm grow" disabled={pos >= siblings.length - 1} onClick={() => go(siblings[pos + 1])}>Next <ChevronRight size={16} /></button>
      </div>
      {nextUp && isDone && <div className="tiny muted center mt-12">Up next: {nextUp.title}</div>}

      <div className="lesson-bar">
        <button className="btn lg" onClick={() => push('Focus', { study: { sid, id, label: node.title } })} aria-label="Focus timer"><Timer size={19} /></button>
        {isDone ? (
          <button className="btn lg grow" onClick={async () => { await uncompleteLesson(id); toast('Marked not done'); }}><Undo2 size={18} /> Mark not done</button>
        ) : (
          <button className="btn lg grow primary" style={{ background: color, color: '#0a0a0a' }} onClick={() => setAskTime(true)}><Check size={20} strokeWidth={2.6} /> Complete lesson</button>
        )}
      </div>
      <Sheet open={askTime} onClose={() => setAskTime(false)} title="Nice! How long did it take?">
        <div className="time-pick">
          {[10, 20, 30, 45, 60, 90, 120].map((m) => <button key={m} onClick={() => complete(m)}><b>{m < 60 ? m : m / 60}</b><span>{m < 60 ? 'min' : m === 60 ? 'hour' : 'hours'}</span></button>)}
        </div>
        <button className="btn block ghost mt-8" onClick={() => complete(0)}>Skip</button>
      </Sheet>
    </div>
  );
}
