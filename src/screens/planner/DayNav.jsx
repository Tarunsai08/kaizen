// Day navigation for the day plan: previous / next day, tap the date for a month calendar, and a quick way back to today.
import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { db } from '../../db';
import { addDays, parse, ymd, DAYS_SHORT, MONTHS } from '../../lib/date';
import { tap } from '../../lib/native';
import { Sheet } from '../../ui/kit';

const LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const rel = (date, t) => (date === t ? 'Today' : date === addDays(t, -1) ? 'Yesterday' : date === addDays(t, 1) ? 'Tomorrow' : LONG[parse(date).getDay()]);

export function DayNav({ date, today: t, onChange }) {
  const [cal, setCal] = useState(false);
  const p = parse(date);
  const go = (d) => { tap(); onChange(d); };
  return (
    <>
      <div className="dn">
        <button className="dn-arrow" onClick={() => go(addDays(date, -1))} aria-label="Previous day"><ChevronLeft size={20} /></button>
        <button className="dn-mid" onClick={() => { tap(); setCal(true); }} aria-label="Pick a date">
          <b>{rel(date, t)}</b>
          <small>{p.getDate()} {MONTHS[p.getMonth()]} {p.getFullYear() !== parse(t).getFullYear() ? p.getFullYear() : ''}<ChevronDown size={13} /></small>
        </button>
        <button className="dn-arrow" onClick={() => go(addDays(date, 1))} aria-label="Next day"><ChevronRight size={20} /></button>
      </div>
      {date !== t && <button className="dn-today" onClick={() => go(t)}>{date < t ? 'Today →' : '← Today'}</button>}
      <MonthSheet open={cal} date={date} today={t} onClose={() => setCal(false)} onPick={(d) => { setCal(false); go(d); }} />
    </>
  );
}

function MonthSheet({ open, date, today: t, onClose, onPick }) {
  const [m, setM] = useState(null);
  const base = m || date.slice(0, 7);
  const [y, mo] = base.split('-').map(Number);
  const first = new Date(y, mo - 1, 1);
  const lead = (first.getDay() + 6) % 7; // weeks start on Monday
  const len = new Date(y, mo, 0).getDate();
  const from = ymd(first), to = ymd(new Date(y, mo - 1, len));
  const busy = useLiveQuery(async () => {
    if (!open) return {};
    const [tasks, sess] = await Promise.all([
      db.tasks.where('due').between(from, to, true, true).filter((x) => !x.skipped).toArray(),
      db.plannedSessions.where('date').between(from, to, true, true).filter((s) => s.kind !== 'BREAK' && s.state !== 'SKIPPED').toArray(),
    ]);
    const b = {};
    tasks.forEach((x) => (b[x.due] = (b[x.due] || 0) + 1));
    sess.forEach((s) => (b[s.date] = (b[s.date] || 0) + 1));
    return b;
  }, [open, from, to]) || {};
  const shift = (k) => { tap(); const d = new Date(y, mo - 1 + k, 1); setM(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); };
  const cells = [...Array(lead).fill(null), ...Array.from({ length: len }, (_, i) => ymd(new Date(y, mo - 1, i + 1)))];
  return (
    <Sheet open={open} onClose={() => { setM(null); onClose(); }}>
      <div className="mc-head">
        <button className="icon-btn ghost" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft size={20} /></button>
        <b>{['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][mo - 1]} {y}</b>
        <button className="icon-btn ghost" onClick={() => shift(1)} aria-label="Next month"><ChevronRight size={20} /></button>
      </div>
      <div className="mc-grid">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="mc-wd">{d}</span>)}
        {cells.map((d, i) => d ? (
          <button key={d} className={`mc-d ${d === date ? 'on' : ''} ${d === t ? 'today' : ''} ${d < t ? 'past' : ''}`} onClick={() => onPick(d)}>
            {Number(d.slice(8))}
            {busy[d] ? <i /> : null}
          </button>
        ) : <span key={'x' + i} />)}
      </div>
      <button className="btn block mt-16" onClick={() => onPick(t)}>Go to today</button>
    </Sheet>
  );
}
export { DAYS_SHORT };
