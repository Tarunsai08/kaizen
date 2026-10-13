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
const H0 = 5, H1 = 24, PX = 26;

export function FixedSchedule() {
  const { settings } = useApp();
  const blocks = useLiveQuery(() => db.fixedBlocks.toArray(), []);
  const [edit, setEdit] = useState(null);
  if (!blocks) return <div className="screen no-nav" />;
  const t = today();
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="Fixed schedule" right={<button className="btn sm primary" onClick={() => setEdit({ title: '', type: 'CLASS', days: [1, 2, 3, 4, 5], start: 600, end: 660, flexible: false, validFrom: '', validUntil: '', notes: '' })}><Plus size={15} /> Add</button>} />
      <div className="small dim">Classes, meals, gym and sleep. The planner works around these every day.</div>
      <div className="eyebrow mt-16 mb-8">Quick add</div>
      <div className="row gap-6 wrap">
        {TEMPLATES.map((x) => <button key={x.title} className="pl-chip" onClick={() => setEdit({ ...x, flexible: !!x.flexible, flexStart: x.flexStart ?? x.start, flexEnd: x.flexEnd ?? x.end, validFrom: '', validUntil: '', notes: '' })}>{x.title}</button>)}
      </div>
      <div className="pl-grid" style={{ height: (H1 - H0) * PX + 26 }}>
        <div className="hours" style={{ paddingTop: 26 }}>
          {Array.from({ length: (H1 - H0) / 2 + 1 }, (_, i) => H0 + i * 2).map((h) => <span key={h} style={{ top: 26 + (h - H0) * PX }}>{h % 24}</span>)}
        </div>
        {ORDER.map((d) => (
          <div className="col" key={d}>
            <div className="hd" style={d === new Date().getDay() ? { color: 'var(--accent)' } : null}>{DAY_LETTERS[d]}</div>
            {blocks.filter((b) => b.days.includes(d) && !(b.validUntil && b.validUntil < t)).flatMap((b) => {
              const over = b.end <= b.start;
              const segs = over ? [[b.start, 1440]] : [[b.start, b.end]];
              return segs.map(([s, e], i) => {
                const top = Math.max(0, (s / 60 - H0) * PX), bottom = Math.min((H1 - H0) * PX, (e / 60 - H0) * PX);
                if (bottom <= 0 || top >= bottom) return null;
                return <button key={b.id + '-' + i} className="blk" aria-label={`${b.title} ${hm12(b.start)}`} style={{ top: 26 + top, height: Math.max(14, bottom - top), background: b.color || typeColor(b.type) }} onClick={() => setEdit(b)}>{b.title}</button>;
              });
            })}
          </div>
        ))}
      </div>
      <div className="list mt-16">
        {blocks.sort((a, b) => a.start - b.start).map((b) => (
          <button key={b.id} className="list-item" onClick={() => setEdit(b)}>
            <span className="pill-dot" style={{ background: b.color || typeColor(b.type) }} />
            <div className="grow"><div style={{ fontWeight: 560 }}>{b.title}</div><div className="tiny muted">{hm12(b.start)}–{hm12(b.end)} · {ORDER.filter((d) => b.days.includes(d)).map((d) => DAY_LETTERS[d]).join(' ')}{b.flexible ? ' · flexible' : ''}{b.validUntil ? ` · until ${b.validUntil}` : ''}</div></div>
          </button>
        ))}
        {!blocks.length && <div className="list-item muted small">Nothing yet. Tap a quick add above.</div>}
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
