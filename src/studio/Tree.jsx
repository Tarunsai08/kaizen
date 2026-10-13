// Trees for the Focus forest. `g` is growth from 0 (seed) to 1 (full tree); `dead` draws a withered one.
import React from 'react';

export const TREES = [
  { k: 'oak', l: 'Oak', c: '#4caf6e', c2: '#2f8a52' },
  { k: 'pine', l: 'Pine', c: '#2e9d78', c2: '#1d7258' },
  { k: 'sakura', l: 'Sakura', c: '#f49ac1', c2: '#d9709f' },
  { k: 'maple', l: 'Maple', c: '#f08a3c', c2: '#d1652a' },
];

export default function Tree({ kind = 'oak', g = 1, dead = false, size = 120 }) {
  const T = TREES.find((x) => x.k === kind) || TREES[0];
  const c = dead ? '#a89c86' : T.c, c2 = dead ? '#8c806b' : T.c2;
  const s = Math.max(0, Math.min(1, g));
  const trunk = 10 + s * 30; // trunk height
  const top = 96 - trunk;
  const k = 0.25 + s * 0.75; // canopy scale
  const canopy = s < 0.12 ? (
    // sprout: two little leaves
    <g transform="translate(60 92)"><path d="M0 0 C -2 -8 -10 -10 -14 -8 C -10 -2 -4 0 0 0Z" fill={c} /><path d="M0 0 C 2 -9 10 -12 15 -9 C 10 -3 4 0 0 0Z" fill={c2} /></g>
  ) : kind === 'pine' ? (
    <g transform={`translate(60 ${top + 6}) scale(${k})`}>
      <path d="M0 -58 L26 -14 L-26 -14Z" fill={c} /><path d="M0 -40 L32 6 L-32 6Z" fill={c2} /><path d="M0 -22 L38 26 L-38 26Z" fill={c} />
    </g>
  ) : (
    <g transform={`translate(60 ${top}) scale(${k})`}>
      <circle cx="-16" cy="-6" r="22" fill={c2} /><circle cx="18" cy="-8" r="22" fill={c2} /><circle cx="0" cy="-26" r="26" fill={c} />
      <circle cx="-8" cy="-2" r="20" fill={c} /><circle cx="12" cy="0" r="18" fill={c} />
      {kind === 'sakura' && !dead && [[-14, -24], [10, -34], [20, -10], [-22, -4], [2, -8]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.2" fill="#fff" opacity="0.8" />)}
      {kind === 'maple' && !dead && [[-12, -30], [14, -22], [-20, -8], [6, -4]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="5" fill="#f6c046" opacity="0.85" />)}
    </g>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={`tree ${dead ? 'dead' : ''}`}>
      <ellipse cx="60" cy="100" rx="34" ry="8" fill="rgba(110, 90, 60, 0.28)" />
      <path d="M30 100 Q60 86 90 100 Q60 108 30 100Z" fill={dead ? '#9b8a6e' : '#8a6a46'} />
      {s >= 0.12 && <rect x="57" y={100 - trunk} width="6" height={trunk} rx="3" fill={dead ? '#7d6f5b' : '#7a5636'} />}
      {canopy}
    </svg>
  );
}
