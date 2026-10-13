// Quick entry (Things' "Magic Plus"): type a to-do, pick when, done. Other quick logs sit underneath.
import React, { useEffect, useRef, useState } from 'react';
import { Star, Moon, Sunrise, Archive, Inbox, ArrowUp } from 'lucide-react';
import { db } from '../db';
import { today, addDays } from '../lib/date';
import { success } from '../lib/native';
import { Sheet } from '../ui/kit';
import { useQuickAdd } from '../screens/today/shared';
import { useApp } from '../ctx';

const WHEN = [
  { k: 'today', l: 'Today', i: Star, c: 'var(--goal)' },
  { k: 'evening', l: 'This Evening', i: Moon, c: 'var(--sleep)' },
  { k: 'tomorrow', l: 'Tomorrow', i: Sunrise, c: 'var(--fit)' },
  { k: 'inbox', l: 'Inbox', i: Inbox, c: 'var(--money)' },
  { k: 'someday', l: 'Someday', i: Archive, c: 'var(--muted)' },
];

export function QuickEntry({ open, onClose, when: initial = 'today', projectId = null }) {
  const { toast } = useApp();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [when, setWhen] = useState(initial);
  const ref = useRef();
  const more = useQuickAdd(today()).filter((x) => x.k !== 'task');
  useEffect(() => { if (open) { setTitle(''); setNotes(''); setWhen(initial); setTimeout(() => ref.current?.focus(), 280); } }, [open]);

  const save = async () => {
    if (!title.trim()) return;
    const t = today();
    await db.tasks.add({
      title: title.trim(), description: notes.trim(), done: false, createdAt: Date.now(), subtasks: [], priority: 'none', recurrence: 'none',
      due: when === 'today' || when === 'evening' ? t : when === 'tomorrow' ? addDays(t, 1) : undefined,
      ...(when === 'evening' ? { evening: true } : {}), ...(when === 'someday' ? { someday: true } : {}), ...(projectId ? { projectId } : {}),
    });
    success();
    toast(when === 'inbox' ? 'Saved to Inbox' : `Added to ${WHEN.find((w) => w.k === when).l}`);
    setTitle(''); setNotes('');
    ref.current?.focus();
  };

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="qe">
        <div className="qe-card">
          <div className="qe-row">
            <span className="qe-box" />
            <input ref={ref} className="qe-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New To-Do" onKeyDown={(e) => e.key === 'Enter' && save()} />
          </div>
          <textarea className="qe-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
          <div className="qe-when">
            {WHEN.map((w) => (
              <button key={w.k} className={when === w.k ? 'on' : ''} style={{ '--c': w.c }} onClick={() => setWhen(w.k)}>
                <w.i size={14} fill={w.k === 'today' && when === w.k ? 'currentColor' : 'none'} />{w.l}
              </button>
            ))}
          </div>
          <button className="qe-save" disabled={!title.trim()} onClick={save} aria-label="Save"><ArrowUp size={20} strokeWidth={2.6} /></button>
        </div>
        <div className="qe-more-h">Or log something</div>
        <div className="qe-more">
          {more.map((x) => (
            <button key={x.k} style={{ '--qc': x.c }} onClick={() => { onClose(); x.a(); }}>
              <span><x.i size={19} /></span>{x.l}
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
