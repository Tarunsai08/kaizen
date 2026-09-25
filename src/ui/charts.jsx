import React, { useState } from 'react';
import { addDays, weekStart, today, parse, MONTHS, DAYS_LETTER } from '../lib/date';

/* GitHub-style calendar heatmap. values: { 'YYYY-MM-DD': 0..1 } */
export function Heatmap({ values = {}, weeks = 17, color = 'var(--habit)', end = today(), onPick, cell = 13, colorFor }) {
  const start = addDays(weekStart(end), -(weeks - 1) * 7);
  const cols = [];
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) col.push(addDays(start, w * 7 + d));
    cols.push(col);
  }
  const gap = 3;
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', gap, minWidth: 'max-content' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap, marginRight: 2 }}>
          {['M', '', 'W', '', 'F', '', 'S'].map((l, i) => (
            <div key={i} style={{ height: cell, fontSize: 9, color: 'var(--muted)', lineHeight: cell + 'px' }}>{l}</div>
          ))}
        </div>
        {cols.map((col, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap }}>
            {col.map((d) => {
              const v = values[d];
              const future = d > end;
              const bg = future ? 'transparent' : colorFor ? colorFor(v, d) : v == null || v === 0 ? 'var(--surface-3)' : `color-mix(in srgb, ${color} ${Math.round(25 + v * 75)}%, var(--surface-3))`;
              return (
                <div key={d} title={d} onClick={() => onPick && !future && onPick(d)}
                  style={{ width: cell, height: cell, borderRadius: 3.5, background: bg, outline: d === end ? '1.5px solid var(--text-2)' : 'none', outlineOffset: 1, cursor: onPick ? 'pointer' : 'default' }} />
              );
            })}
          </div>
        ))}
      </div>
      <div className="row between tiny muted mt-8">
        <span>{MONTHS[parse(start).getMonth()]}</span>
        <span>{MONTHS[parse(end).getMonth()]}</span>
      </div>
    </div>
  );
}

/* Month calendar grid (used for mood calendar) */
export function MonthGrid({ month, render, onPick }) {
  // month: 'YYYY-MM-01'
  const first = parse(month);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(`${month.slice(0, 8)}${String(d).padStart(2, '0')}`);
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6, marginBottom: 6 }}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => <div key={i} className="tiny muted center">{l}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
        {cells.map((d, i) => d ? (
          <button key={d} onClick={() => onPick && onPick(d)} style={{ aspectRatio: '1', borderRadius: 12, display: 'grid', placeItems: 'center', position: 'relative' }}>
            {render(d)}
          </button>
        ) : <div key={'x' + i} />)}
      </div>
    </div>
  );
}

/* Vertical bars. data: [{label, value, color?}] */
export function Bars({ data, height = 120, color = 'var(--accent)', format = (v) => v, showValues = false, max: forcedMax }) {
  const [sel, setSel] = useState(null);
  const max = forcedMax || Math.max(1e-9, ...data.map((d) => d.value || 0));
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height }}>
        {data.map((d, i) => {
          const h = ((d.value || 0) / max) * (height - 18);
          return (
            <div key={i} onClick={() => setSel(sel === i ? null : i)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', cursor: 'pointer' }}>
              {(showValues || sel === i) && <div className="tiny num" style={{ marginBottom: 3, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{format(d.value || 0)}</div>}
              <div style={{
                width: '100%', maxWidth: 28, height: Math.max(d.value ? 4 : 2, h), borderRadius: 6,
                background: d.value ? d.color || color : 'var(--surface-3)', opacity: sel == null || sel === i ? 1 : 0.4,
                transition: 'height .6s cubic-bezier(.2,.8,.2,1)',
              }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        {data.map((d, i) => <div key={i} className="tiny muted center" style={{ flex: 1 }}>{d.label}</div>)}
      </div>
    </div>
  );
}

/* Line chart. data: [{label, value|null}] */
export function Line({ data, height = 110, color = 'var(--accent)', min: fMin, max: fMax, format = (v) => v, band }) {
  const W = 320;
  const H = height;
  const pad = 10;
  const vals = data.map((d) => d.value).filter((v) => v != null);
  if (!vals.length) return <div className="small muted center" style={{ padding: '30px 0' }}>Not enough data yet</div>;
  const min = fMin ?? Math.min(...vals);
  const max = fMax ?? Math.max(...vals);
  const span = max - min || 1;
  const x = (i) => pad + (i * (W - pad * 2)) / Math.max(1, data.length - 1);
  const y = (v) => H - pad - ((v - min) / span) * (H - pad * 2);
  const pts = data.map((d, i) => (d.value == null ? null : [x(i), y(d.value)]));
  let path = '';
  let started = false;
  pts.forEach((p) => {
    if (!p) return;
    path += `${started ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)} `;
    started = true;
  });
  const firstIdx = pts.findIndex(Boolean);
  const lastIdx = pts.length - 1 - [...pts].reverse().findIndex(Boolean);
  const area = `${path} L${x(lastIdx)},${H - pad} L${x(firstIdx)},${H - pad} Z`;
  const gid = 'g' + Math.random().toString(36).slice(2, 7);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.28" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {band && <rect x={0} width={W} y={y(band[1])} height={Math.abs(y(band[0]) - y(band[1]))} fill={color} opacity={0.07} />}
        <path d={area} fill={`url(#${gid})`} />
        <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {pts.map((p, i) => p && <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={color} vectorEffect="non-scaling-stroke" />)}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        {data.map((d, i) => <div key={i} className="tiny muted" style={{ width: 0, display: 'flex', justifyContent: 'center', flex: 1 }}>{d.label}</div>)}
      </div>
      <div className="row between tiny muted mt-4"><span>min {format(Math.min(...vals))}</span><span>max {format(Math.max(...vals))}</span></div>
    </div>
  );
}

/* Horizontal breakdown bars. items: [{label, value, color, icon}] */
export function HBars({ items, format = (v) => v, total }) {
  const sum = total ?? items.reduce((a, b) => a + (b.value || 0), 0);
  const max = Math.max(1e-9, ...items.map((i) => i.value));
  if (!items.length) return <div className="small muted center" style={{ padding: '20px 0' }}>Nothing to show yet</div>;
  return (
    <div className="col gap-14">
      {items.map((it, i) => (
        <div key={i}>
          <div className="row between small" style={{ marginBottom: 6 }}>
            <span className="row gap-6">{it.icon && <span>{it.icon}</span>}<span style={{ fontWeight: 560 }}>{it.label}</span></span>
            <span className="num dim">{format(it.value)} <span className="muted tiny">{sum ? Math.round((it.value / sum) * 100) : 0}%</span></span>
          </div>
          <div className="bar" style={{ height: 8 }}><i style={{ width: `${(it.value / max) * 100}%`, background: it.color || 'var(--accent)' }} /></div>
        </div>
      ))}
    </div>
  );
}

/* Donut split (e.g. Need vs Want) */
export function Donut({ parts, size = 120, stroke = 16, center }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const sum = parts.reduce((a, b) => a + b.value, 0) || 1;
  let acc = 0;
  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        {parts.map((p, i) => {
          const len = (p.value / sum) * c;
          const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={stroke} strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-acc} />;
          acc += len;
          return el;
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>{center}</div>
    </div>
  );
}

/* Day-of-week × time-of-day heatmap. events: array of timestamps */
export function WeekHourGrid({ events, color = 'var(--break)' }) {
  const slots = ['Night', 'Morning', 'Noon', 'Evening'];
  const slotOf = (h) => (h < 6 ? 0 : h < 12 ? 1 : h < 17 ? 2 : 3);
  const grid = Array.from({ length: 7 }, () => [0, 0, 0, 0]);
  events.forEach((ts) => {
    const d = new Date(ts);
    grid[(d.getDay() + 6) % 7][slotOf(d.getHours())]++;
  });
  const max = Math.max(1, ...grid.flat());
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '58px repeat(7,1fr)', gap: 4 }}>
        <div />
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => <div key={i} className="tiny muted center">{l}</div>)}
        {slots.map((s, si) => (
          <React.Fragment key={s}>
            <div className="tiny muted" style={{ alignSelf: 'center' }}>{s}</div>
            {grid.map((row, di) => (
              <div key={di} style={{ aspectRatio: '1', borderRadius: 6, background: row[si] ? `color-mix(in srgb, ${color} ${Math.round(20 + (row[si] / max) * 80)}%, var(--surface-3))` : 'var(--surface-3)', display: 'grid', placeItems: 'center', fontSize: 10, color: 'var(--text-2)' }}>
                {row[si] || ''}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/* Hour-of-day histogram */
export function HourHist({ hours, color = 'var(--accent)' }) {
  const counts = Array(24).fill(0);
  hours.forEach((h) => counts[h]++);
  return <Bars height={80} color={color} data={counts.map((v, i) => ({ value: v, label: i % 6 === 0 ? `${i % 12 || 12}${i < 12 ? 'a' : 'p'}` : '' }))} />;
}

export const LETTERS = DAYS_LETTER;
