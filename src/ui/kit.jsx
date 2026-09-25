import React, { useEffect, useState, useRef } from 'react';
import { ChevronLeft, Minus, Plus, Check, X } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useApp } from '../ctx';
import { tap } from '../lib/native';

export const MOODS = [
  { v: 1, e: '😣', label: 'Awful', color: '#f87171' },
  { v: 2, e: '😔', label: 'Low', color: '#fb923c' },
  { v: 3, e: '😐', label: 'Okay', color: '#facc15' },
  { v: 4, e: '🙂', label: 'Good', color: '#a3e635' },
  { v: 5, e: '😊', label: 'Great', color: '#4ade80' },
];
export const moodColor = (v) => (v ? MOODS[Math.min(4, Math.max(0, Math.round(v) - 1))].color : 'var(--surface-3)');
export const moodEmoji = (v) => (v ? MOODS[Math.min(4, Math.max(0, Math.round(v) - 1))].e : '·');

export const PALETTE = ['#4ade80', '#2dd4bf', '#38bdf8', '#818cf8', '#a78bfa', '#f472b6', '#f87171', '#fb923c', '#facc15', '#a3e635', '#94a3b8'];
export const EMOJIS = ['💧', '🧘', '📖', '🏃', '💪', '🥗', '😴', '🎸', '🎤', '✍️', '🧠', '💻', '🌅', '🚶', '🍎', '💊', '📵', '🚭', '🍺', '🍫', '🎮', '📱', '☕', '🛏️', '🙏', '🌱', '🎯', '🧹', '💰', '📚', '🎨', '❤️'];

/* ---------- Top bar ---------- */
export function TopBar({ title, right, back = true, onBack }) {
  const { pop } = useApp();
  return (
    <div className="topbar">
      {back && (
        <button className="icon-btn" onClick={onBack || pop} aria-label="Back">
          <ChevronLeft size={22} />
        </button>
      )}
      <div className="title ellipsis">{title}</div>
      {right}
    </div>
  );
}

/* ---------- Bottom sheet ---------- */
export function Sheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog">
        <div className="sheet-grip" />
        {title && <h2 className="sheet-title">{title}</h2>}
        {children}
      </div>
    </>
  );
}

/* ---------- Ring (activity-ring style) ---------- */
export function Ring({ value = 0, size = 64, stroke = 7, color = 'var(--accent)', track = 'var(--surface-3)', children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.2,0.8,0.2,1)' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>{children}</div>
    </div>
  );
}

/* Concentric rings for the day score */
export function MultiRing({ rings, size = 132, stroke = 11, gap = 3 }) {
  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      {rings.map((r, i) => {
        const s = size - i * 2 * (stroke + gap);
        return (
          <div key={i} style={{ position: 'absolute', left: i * (stroke + gap), top: i * (stroke + gap) }}>
            <Ring size={s} stroke={stroke} value={r.value} color={r.color} track={`color-mix(in srgb, ${r.color} 16%, transparent)`} />
          </div>
        );
      })}
    </div>
  );
}

export function Bar({ value, color = 'var(--accent)', h = 6 }) {
  return (
    <div className="bar" style={{ height: h }}>
      <i style={{ width: `${Math.max(0, Math.min(1, value || 0)) * 100}%`, background: color }} />
    </div>
  );
}

/* ---------- Inputs ---------- */
export function Toggle({ on, onChange }) {
  return <button className={`toggle ${on ? 'on' : ''}`} onClick={() => { tap(); onChange(!on); }} aria-pressed={on} />;
}
export function Stepper({ value, onChange, min = 0, max = 9999, step = 1, suffix = '' }) {
  return (
    <div className="stepper">
      <button onClick={() => { tap(); onChange(Math.max(min, +(value - step).toFixed(2))); }}><Minus size={18} /></button>
      <div className="val num">{value}{suffix}</div>
      <button onClick={() => { tap(); onChange(Math.min(max, +(value + step).toFixed(2))); }}><Plus size={18} /></button>
    </div>
  );
}
export function Seg({ value, onChange, options }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? 'on' : ''} onClick={() => { tap(); onChange(o.value); }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
export function PeriodToggle({ value, onChange }) {
  return (
    <Seg value={value} onChange={onChange} options={[
      { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }, { value: 'year', label: 'Year' }, { value: 'all', label: 'All' },
    ]} />
  );
}
export function Chips({ options, value, onChange, multi = false, wrap = false }) {
  const isOn = (v) => (multi ? (value || []).includes(v) : value === v);
  return (
    <div className={`chips ${wrap ? 'wrap' : ''}`}>
      {options.map((o) => {
        const v = typeof o === 'object' ? o.value : o;
        const l = typeof o === 'object' ? o.label : o;
        return (
          <button key={v} className={`chip ${isOn(v) ? 'on' : ''}`} onClick={() => {
            tap();
            if (multi) onChange(isOn(v) ? value.filter((x) => x !== v) : [...(value || []), v]);
            else onChange(v);
          }}>{l}</button>
        );
      })}
    </div>
  );
}
export function Field({ label, children, hint }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
      {hint && <div className="kbd-note" style={{ paddingLeft: 2 }}>{hint}</div>}
    </div>
  );
}
export function DayPicker({ value = [], onChange }) {
  const L = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <div className="day-pick">
      {order.map((d) => (
        <button key={d} className={value.includes(d) ? 'on' : ''} onClick={() => { tap(); onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d]); }}>
          {L[d]}
        </button>
      ))}
    </div>
  );
}
export function ColorPicker({ value, onChange }) {
  return (
    <div className="row wrap gap-6">
      {PALETTE.map((c) => (
        <button key={c} className={`color-dot ${value === c ? 'on' : ''}`} style={{ background: c }} onClick={() => onChange(c)} />
      ))}
    </div>
  );
}
export function EmojiPicker({ value, onChange, list = EMOJIS }) {
  const [custom, setCustom] = useState('');
  return (
    <div className="col gap-6">
      <div className="emoji-pick">
        {list.map((e) => (
          <button key={e} className={value === e ? 'on' : ''} onClick={() => onChange(e)}>{e}</button>
        ))}
      </div>
      <input className="input" placeholder="Or type any emoji" value={custom} maxLength={4} onChange={(e) => { setCustom(e.target.value); if (e.target.value.trim()) onChange(e.target.value.trim()); }} />
    </div>
  );
}

/* Category dropdown with “+ Add new” (shared pattern across modules) */
export function CategorySelect({ kind, value, onChange, allowNone = true, extraKinds }) {
  const cats = useLiveQuery(() => db.categories.where('kind').anyOf(extraKinds || [kind]).toArray(), [kind, extraKinds?.join()]) || [];
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const add = async () => {
    if (!name.trim()) return;
    const id = await db.categories.add({ kind, name: name.trim(), icon: icon || '•', color: PALETTE[Math.floor(Math.random() * PALETTE.length)], needWant: 'need' });
    onChange(id);
    setAdding(false); setName(''); setIcon('');
  };
  if (adding) {
    return (
      <div className="row">
        <input className="input" style={{ width: 64, textAlign: 'center' }} placeholder="🙂" value={icon} maxLength={4} onChange={(e) => setIcon(e.target.value)} />
        <input className="input grow" autoFocus placeholder="New category" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="icon-btn" onClick={add}><Check size={18} /></button>
        <button className="icon-btn ghost" onClick={() => setAdding(false)}><X size={18} /></button>
      </div>
    );
  }
  return (
    <div className="chips wrap">
      {allowNone && <button className={`chip ${!value ? 'on' : ''}`} onClick={() => onChange(null)}>None</button>}
      {cats.map((c) => (
        <button key={c.id} className={`chip ${value === c.id ? 'on' : ''}`} onClick={() => { tap(); onChange(c.id); }}>
          <span>{c.icon}</span>{c.name}
        </button>
      ))}
      <button className="chip" style={{ borderStyle: 'dashed', borderColor: 'var(--line-2)' }} onClick={() => setAdding(true)}><Plus size={14} /> New</button>
    </div>
  );
}

/* A string list with add-new (triggers, tags, emotions) stored in kv */
export function TagSelect({ options = [], value, onChange, multi = false, onAdd }) {
  const [adding, setAdding] = useState(false);
  const [txt, setTxt] = useState('');
  const isOn = (v) => (multi ? (value || []).includes(v) : value === v);
  const add = () => {
    const t = txt.trim();
    if (!t) return;
    onAdd && onAdd(t);
    onChange(multi ? [...(value || []), t] : t);
    setTxt(''); setAdding(false);
  };
  return (
    <div className="chips wrap">
      {options.map((o) => (
        <button key={o} className={`chip ${isOn(o) ? 'on' : ''}`} onClick={() => { tap(); onChange(multi ? (isOn(o) ? value.filter((x) => x !== o) : [...(value || []), o]) : (isOn(o) ? null : o)); }}>{o}</button>
      ))}
      {adding ? (
        <span className="row gap-4">
          <input className="input" style={{ height: 34, width: 130, borderRadius: 999 }} autoFocus value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} onBlur={add} />
        </span>
      ) : (
        onAdd && <button className="chip" style={{ borderStyle: 'dashed', borderColor: 'var(--line-2)' }} onClick={() => setAdding(true)}><Plus size={14} /> Add</button>
      )}
    </div>
  );
}

export function MoodScale({ value, onChange, size }) {
  return (
    <div className="mood-row">
      {MOODS.map((m) => (
        <button key={m.v} className={`mood-btn ${value === m.v ? 'on' : ''}`} style={size ? { fontSize: size } : null} onClick={() => { tap('medium'); onChange(m.v); }} aria-label={m.label}>
          {m.e}
        </button>
      ))}
    </div>
  );
}
export function Scale5({ value, onChange, color = 'var(--text)', labels }) {
  return (
    <div className="col gap-6">
      <div className="row gap-6">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => { tap(); onChange(n); }} style={{
            flex: 1, height: 42, borderRadius: 12, fontWeight: 700,
            background: value >= n ? color : 'var(--surface-2)', color: value >= n ? 'var(--bg)' : 'var(--muted)', transition: 'all .2s',
          }}>{n}</button>
        ))}
      </div>
      {labels && <div className="row between tiny muted"><span>{labels[0]}</span><span>{labels[1]}</span></div>}
    </div>
  );
}

export function Empty({ icon = '🌱', title, sub, action }) {
  return (
    <div className="empty">
      <div className="e-ico">{icon}</div>
      <div className="h3" style={{ color: 'var(--text-2)' }}>{title}</div>
      {sub && <div className="small mt-4">{sub}</div>}
      {action && <div className="mt-16">{action}</div>}
    </div>
  );
}

export function Stat({ v, k, color, sub }) {
  return (
    <div className="stat">
      <div className="v num" style={color ? { color } : null}>{v}</div>
      <div className="k">{k}</div>
      {sub && <div className="tiny muted mt-4">{sub}</div>}
    </div>
  );
}

export function Confetti({ show }) {
  const [pieces, setPieces] = useState([]);
  useEffect(() => {
    if (!show) return;
    setPieces(Array.from({ length: 60 }, (_, i) => ({
      i, left: Math.random() * 100, delay: Math.random() * 0.4, color: PALETTE[i % PALETTE.length], dur: 1.2 + Math.random() * 0.9,
    })));
    const t = setTimeout(() => setPieces([]), 2500);
    return () => clearTimeout(t);
  }, [show]);
  if (!pieces.length) return null;
  return (
    <div className="confetti">
      {pieces.map((p) => <i key={p.i} style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }} />)}
    </div>
  );
}

export function useInterval(fn, ms) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (ms == null) return;
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}

export function Confirm({ open, onClose, title, body, confirmLabel = 'Delete', onConfirm }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {body && <p className="dim" style={{ marginTop: -6 }}>{body}</p>}
      <div className="row mt-16">
        <button className="btn grow" onClick={onClose}>Cancel</button>
        <button className="btn danger grow" onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
      </div>
    </Sheet>
  );
}
