import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trash2 } from 'lucide-react';
import { db } from '../../db';
import { useApp } from '../../ctx';
import { TopBar, Sheet, Field, Chips, Toggle, Confirm } from '../../ui/kit';
import { today } from '../../lib/date';
import { BLOCK_TYPES, TEMPLATES, typeColor, hm12 } from '../../planner/service';
import './planner.css';

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const toHM = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const toMin = (s) => { const [h, m] = (s || '0:0').split(':').map(Number); return h * 60 + m; };

export function FixedSchedule() {
  const blocks = useLiveQuery(() => db.fixedBlocks.toArray(), []);
  const [edit, setEdit] = useState(null);
  const [day, setDay] = useState(new Date().getDay());
  if (!blocks) return <div className="screen no-nav" />;
  const t = today();
  const live = blocks.filter((b) => !(b.validUntil && b.validUntil < t));
  const mine = live.filter((b) => b.days.includes(day)).sort((a, b) => a.start - b.start);
  const blank = { title: '', type: 'CLASS', days: [day], start: 600, end: 660, flexible: false, validFrom: '', validUntil: '', notes: '' };
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="Fixed schedule" right={<button className="btn sm primary" onClick={() => setEdit(blank)}><Plus size={15} /> Add</button>} />
      <div className="small dim">Classes, meals, gym, sleep. Planning works around these.</div>
      <div className="sc-days mt-16">
        {ORDER.map((d) => <button key={d} className={day === d ? 'on' : ''} onClick={() => setDay(d)} aria-label={`Day ${d}`}>{DAY_LETTERS[d]}{live.some((b) => b.days.includes(d)) && day !== d && <i />}</button>)}
      </div>
      <div className="sc-bar">
        {mine.map((b) => { const e = b.end <= b.start ? 1440 : b.end; return <b key={b.id} style={{ left: `${(b.start / 1440) * 100}%`, width: `${((e - b.start) / 1440) * 100}%`, background: b.color || typeColor(b.type) }} />; })}
      </div>
      <div className="sc-ticks"><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>12 AM</span></div>
      <div className="mt-16">
        {mine.map((b) => (
          <button key={b.id} className="sc-card" style={{ '--bc': b.color || typeColor(b.type) }} onClick={() => setEdit(b)}>
            <div className="grow"><div style={{ fontWeight: 620 }}>{b.title}</div><div className="tiny muted">{hm12(b.start)} – {hm12(b.end)}{b.flexible ? ' · flexible' : ''}{b.validUntil ? ` · until ${b.validUntil}` : ''}</div></div>
            <span className="tiny muted">{BLOCK_TYPES.find((x) => x.value === b.type)?.label}</span>
          </button>
        ))}
        {!mine.length && <div className="small muted" style={{ padding: '14px 0' }}>Nothing fixed on this day. Add something or tap a quick add below.</div>}
      </div>
      <div className="eyebrow mt-16 mb-8">Quick add</div>
      <div className="row gap-6" style={{ overflowX: 'auto', margin: '0 -16px', padding: '0 16px 4px' }}>
        {TEMPLATES.map((x) => <button key={x.title} className="pl-chip" style={{ flexShrink: 0 }} onClick={() => setEdit({ ...x, days: [...new Set([...x.days.length === 7 ? x.days : [day, ...x.days]])], flexible: !!x.flexible, flexStart: x.flexStart ?? x.start, flexEnd: x.flexEnd ?? x.end, validFrom: '', validUntil: '', notes: '' })}>+ {x.title}</button>)}
      </div>
      <BlockSheet block={edit} onClose={() => setEdit(null)} />
    </div>
  );
}

function BlockSheet({ block, onClose }) {
  const { toast } = useApp();
  const [x, setX] = useState(null);
  const [del, setDel] = useState(false);
  React.useEffect(() => { setX(block); }, [block]);
  if (!x) return <Sheet open={false} onClose={onClose} />;
  const set = (p) => setX((v) => ({ ...v, ...p }));
  const save = async () => {
    if (!x.title.trim()) return toast('Add a title');
    if (!x.days.length) return toast('Pick at least one day');
    const row = { ...x, title: x.title.trim(), color: x.color || typeColor(x.type) };
    if (x.id) await db.fixedBlocks.put(row); else await db.fixedBlocks.add(row);
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={x.id ? 'Edit block' : 'New block'}>
      <div className="form">
        <input className="input big" placeholder="Title" value={x.title} onChange={(e) => set({ title: e.target.value })} />
        <Chips wrap value={x.type} onChange={(v) => set({ type: v, color: typeColor(v) })} options={BLOCK_TYPES.map((b) => ({ value: b.value, label: b.label }))} />
        <Field label="Days">
          <div className="pl-dots">{ORDER.map((d) => <button key={d} className={x.days.includes(d) ? 'on' : ''} onClick={() => set({ days: x.days.includes(d) ? x.days.filter((z) => z !== d) : [...x.days, d] })}>{DAY_LETTERS[d]}</button>)}</div>
        </Field>
        <div className="grid-2">
          <Field label="Starts"><input type="time" className="input" value={toHM(x.start)} onChange={(e) => set({ start: toMin(e.target.value) })} /></Field>
          <Field label="Ends"><input type="time" className="input" value={toHM(x.end)} onChange={(e) => set({ end: toMin(e.target.value) })} /></Field>
        </div>
        <div className="row between"><div><div style={{ fontWeight: 600 }}>Flexible</div><div className="tiny muted">Can shift within a window when time is tight</div></div><Toggle on={!!x.flexible} onChange={(v) => set({ flexible: v, flexStart: x.flexStart ?? x.start, flexEnd: x.flexEnd ?? x.end })} /></div>
        {x.flexible && <div className="grid-2">
          <Field label="Earliest"><input type="time" className="input" value={toHM(x.flexStart ?? x.start)} onChange={(e) => set({ flexStart: toMin(e.target.value) })} /></Field>
          <Field label="Latest end"><input type="time" className="input" value={toHM(x.flexEnd ?? x.end)} onChange={(e) => set({ flexEnd: toMin(e.target.value) })} /></Field>
        </div>}
        <div className="grid-2">
          <Field label="From (optional)"><input type="date" className="input" value={x.validFrom || ''} onChange={(e) => set({ validFrom: e.target.value })} /></Field>
          <Field label="Until (semester end)"><input type="date" className="input" value={x.validUntil || ''} onChange={(e) => set({ validUntil: e.target.value })} /></Field>
        </div>
        <textarea className="textarea" style={{ minHeight: 50 }} placeholder="Notes (optional)" value={x.notes || ''} onChange={(e) => set({ notes: e.target.value })} />
        <div className="row gap-8">
          {x.id && <button className="btn danger" onClick={() => setDel(true)}><Trash2 size={16} /></button>}
          <button className="btn primary grow" onClick={save}>Save</button>
        </div>
      </div>
      <Confirm open={del} onClose={() => setDel(false)} title="Delete block?" onConfirm={async () => { await db.fixedBlocks.delete(x.id); setDel(false); onClose(); }} />
    </Sheet>
  );
}
