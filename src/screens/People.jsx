import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Phone, MessageCircle, Coffee, Trash2, Pencil } from 'lucide-react';
import { db } from '../db';
import { useApp } from '../ctx';
import { today, diffDays, fmtDay, addDays } from '../lib/date';
import { TopBar, Sheet, Field, Chips, Empty, Confirm, ColorPicker, MoodScale } from '../ui/kit';
import { Face } from '../ui/faces';
import { SectionHead } from '../ui/rows';
import { success } from '../lib/native';

export const KINDS = [
  { value: 'call', label: 'Call', icon: Phone },
  { value: 'text', label: 'Text', icon: MessageCircle },
  { value: 'meet', label: 'Met', icon: Coffee },
];

export function personStatus(p, interactions) {
  const mine = interactions.filter((i) => i.personId === p.id).sort((a, b) => b.date.localeCompare(a.date));
  const last = mine[0]?.date || p.since || null;
  const since = last ? diffDays(today(), last) : null;
  const dueIn = since == null ? 0 : p.every - since;
  return { last, since, dueIn, due: dueIn <= 0, count: mine.length };
}

export function Avatar({ p, size = 40 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: `color-mix(in srgb, ${p.color || '#a78bfa'} 25%, transparent)`, color: p.color || '#a78bfa', display: 'grid', placeItems: 'center', fontWeight: 750, fontSize: size * 0.4, flexShrink: 0 }}>
      {(p.name || '?').trim()[0]?.toUpperCase()}
    </div>
  );
}

/* List view inside Plan → People */
export function PeopleView() {
  const [edit, setEdit] = useState(null);
  const [logFor, setLogFor] = useState(null);
  const { push } = useApp();
  const people = useLiveQuery(() => db.people.toArray(), []) || [];
  const inter = useLiveQuery(() => db.interactions.toArray(), []) || [];
  const list = people.map((p) => ({ p, s: personStatus(p, inter) })).sort((a, b) => a.s.dueIn - b.s.dueIn);
  const due = list.filter((x) => x.s.due);
  return (
    <div>
      <div className="card">
        <div className="h3">Keep in touch</div>
        <p className="small muted" style={{ margin: '4px 0 0' }}>Relationships fade quietly. Set how often you want to reach out and Kaizen will nudge you.</p>
        <button className="btn primary block mt-16" onClick={() => setEdit({ name: '', every: 7, color: '#a78bfa', relation: 'Friend', notes: '' })}><Plus size={18} /> Add a person</button>
      </div>
      {due.length > 0 && <div className="eyebrow mt-24 mb-8">Reach out today · {due.length}</div>}
      <div className="col gap-6 mt-12">
        {list.map(({ p, s }) => (
          <div key={p.id} className="card tight row gap-12 card-press" onClick={() => push('PersonDetail', { id: p.id })}>
            <Avatar p={p} />
            <div className="grow">
              <div style={{ fontWeight: 620 }}>{p.name}</div>
              <div className="tiny" style={{ color: s.due ? 'var(--warn)' : 'var(--muted)' }}>
                {s.since == null ? 'Never logged' : s.since === 0 ? 'Talked today' : `${s.since} day${s.since > 1 ? 's' : ''} ago`} · every {p.every}d
              </div>
            </div>
            <button className="btn sm" onClick={(e) => { e.stopPropagation(); setLogFor(p); }}>Log</button>
          </div>
        ))}
      </div>
      {!people.length && <Empty icon="👋" title="No one here yet" sub="Your best friend, parents, mentor…" />}
      <PersonSheet edit={edit} onClose={() => setEdit(null)} />
      <LogSheet person={logFor} onClose={() => setLogFor(null)} />
    </div>
  );
}

export function PersonSheet({ edit, onClose }) {
  const [p, setP] = useState(edit);
  useEffect(() => setP(edit), [edit]);
  if (!p) return null;
  return (
    <Sheet open onClose={onClose} title={p.id ? 'Edit person' : 'Add a person'}>
      <div className="form">
        <Field label="Name"><input className="input" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} autoFocus /></Field>
        <Field label="Who are they?"><Chips value={p.relation} onChange={(v) => setP({ ...p, relation: v })} options={['Friend', 'Family', 'Partner', 'Mentor', 'Colleague']} /></Field>
        <Field label="Reach out every"><Chips value={p.every} onChange={(v) => setP({ ...p, every: v })} options={[{ value: 2, label: '2 days' }, { value: 5, label: '5 days' }, { value: 7, label: 'Week' }, { value: 14, label: '2 weeks' }, { value: 30, label: 'Month' }]} /></Field>
        <ColorPicker value={p.color} onChange={(v) => setP({ ...p, color: v })} />
        <Field label="Notes (topics, birthdays, things they told you)"><textarea className="textarea" value={p.notes} onChange={(e) => setP({ ...p, notes: e.target.value })} /></Field>
        <button className="btn primary block" onClick={async () => { if (!p.name.trim()) return; if (p.id) await db.people.put(p); else await db.people.add({ ...p, since: today() }); onClose(); }}>Save</button>
      </div>
    </Sheet>
  );
}

export function LogSheet({ person, onClose }) {
  const { toast } = useApp();
  const [kind, setKind] = useState('call');
  const [feel, setFeel] = useState(null);
  const [note, setNote] = useState('');
  useEffect(() => { setKind('call'); setFeel(null); setNote(''); }, [person?.id]);
  if (!person) return null;
  return (
    <Sheet open onClose={onClose} title={`Caught up with ${person.name}`}>
      <div className="form">
        <div className="grid-3">
          {KINDS.map((k) => (
            <button key={k.value} className={`card flat col ${kind === k.value ? '' : ''}`} style={{ alignItems: 'center', gap: 6, padding: 14, outline: kind === k.value ? '2px solid var(--text)' : 'none' }} onClick={() => setKind(k.value)}>
              <k.icon size={20} /><span className="small" style={{ fontWeight: 600 }}>{k.label}</span>
            </button>
          ))}
        </div>
        <Field label="How did it feel?"><MoodScale value={feel} onChange={setFeel} /></Field>
        <Field label="What did you talk about?"><textarea className="textarea" style={{ minHeight: 70 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional — helps you remember next time" /></Field>
        <button className="btn primary block" onClick={async () => { await db.interactions.add({ personId: person.id, date: today(), ts: Date.now(), kind, feel, note }); success(); toast('Logged'); onClose(); }}>Save</button>
      </div>
    </Sheet>
  );
}

export function PersonDetail({ id }) {
  const { pop } = useApp();
  const [edit, setEdit] = useState(null);
  const [log, setLog] = useState(false);
  const [del, setDel] = useState(false);
  const p = useLiveQuery(() => db.people.get(id), [id]);
  const inter = useLiveQuery(() => db.interactions.where('personId').equals(id).toArray(), [id]) || [];
  if (!p) return <div className="screen no-nav" />;
  const s = personStatus(p, inter);
  const sorted = [...inter].sort((a, b) => b.ts - a.ts);
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="" right={<div className="row gap-6"><button className="icon-btn" onClick={() => setEdit(p)}><Pencil size={18} /></button><button className="icon-btn" onClick={() => setDel(true)}><Trash2 size={18} /></button></div>} />
      <div className="col" style={{ alignItems: 'center', gap: 8 }}>
        <Avatar p={p} size={76} />
        <h1 className="h2">{p.name}</h1>
        <div className="small muted">{p.relation} · every {p.every} days · {s.count} catch-up{s.count === 1 ? '' : 's'}</div>
      </div>
      <div className="hero mt-16 center">
        <div className="eyebrow">{s.due ? 'Time to reach out' : 'Next nudge'}</div>
        <div className="h2 mt-8">{s.due ? (s.since == null ? 'Say hi' : `It’s been ${s.since} days`) : `in ${s.dueIn} day${s.dueIn > 1 ? 's' : ''}`}</div>
        <button className="btn primary block mt-16" onClick={() => setLog(true)}>Log a catch-up</button>
      </div>
      {p.notes && <div className="card mt-12 small dim" style={{ whiteSpace: 'pre-wrap' }}>{p.notes}</div>}
      <div className="section">
        <SectionHead title="History" />
        {sorted.length ? (
          <div className="list">
            {sorted.map((i) => {
              const K = KINDS.find((k) => k.value === i.kind) || KINDS[0];
              return (
                <div key={i.id} className="list-item">
                  <K.icon size={18} className="muted" />
                  <div className="grow"><div style={{ fontWeight: 560 }}>{K.label} · {fmtDay(i.date)}</div>{i.note && <div className="tiny muted">{i.note}</div>}</div>
                  {i.feel && <Face v={i.feel} size={24} />}
                </div>
              );
            })}
          </div>
        ) : <Empty title="No catch-ups yet" />}
      </div>
      <PersonSheet edit={edit} onClose={() => setEdit(null)} />
      <LogSheet person={log ? p : null} onClose={() => setLog(false)} />
      <Confirm open={del} onClose={() => setDel(false)} title={`Remove ${p.name}?`} onConfirm={async () => { await db.people.delete(id); await db.interactions.where('personId').equals(id).delete(); pop(); }} />
    </div>
  );
}
export { addDays };
