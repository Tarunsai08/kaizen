import React from 'react';

/* Growing companion (original design): a small potted plant with a face.
   stage 0..6 (seed → blooming tree), mood: 'happy' | 'ok' | 'sleepy' | 'droopy' */
export default function Companion({ stage = 0, mood = 'ok', size = 120, accent = '#c8f35a' }) {
  const leaf = '#5fd38a';
  const leafDark = '#3fae6c';
  const droop = mood === 'droopy' ? 14 : 0;
  const stemH = [0, 18, 30, 42, 52, 60, 64][stage];
  const topY = 92 - stemH;
  const leaves = [];
  const L = (x, y, r, flip, k, s = 1) => (
    <path key={k} d="M0 0 C 6 -10, 18 -10, 22 0 C 18 8, 6 8, 0 0 Z" fill={k % 2 ? leafDark : leaf}
      transform={`translate(${x} ${y}) rotate(${(flip ? 180 + r : -r) + (flip ? -droop : droop)}) scale(${s})`} />
  );
  if (stage >= 1) { leaves.push(L(60, topY + 6, 30, false, 1, 0.8)); leaves.push(L(60, topY + 6, 30, true, 2, 0.8)); }
  if (stage >= 2) { leaves.push(L(60, topY + 18, 20, false, 3, 0.95)); leaves.push(L(60, topY + 18, 20, true, 4, 0.95)); }
  if (stage >= 3) { leaves.push(L(60, topY + 30, 12, false, 5, 1.05)); leaves.push(L(60, topY + 30, 12, true, 6, 1.05)); }
  const crown = stage >= 4;
  const blooms = stage >= 6;
  const eyes =
    mood === 'sleepy' ? (
      <g stroke="#1a1a1e" strokeWidth="2.2" strokeLinecap="round" fill="none"><path d="M49 112 q3 2 6 0" /><path d="M65 112 q3 2 6 0" /></g>
    ) : (
      <g fill="#1a1a1e"><ellipse cx="52" cy="111" rx="2.6" ry={mood === 'happy' ? 2.2 : 3} /><ellipse cx="68" cy="111" rx="2.6" ry={mood === 'happy' ? 2.2 : 3} /></g>
    );
  const mouth = mood === 'happy' ? 'M54 118 Q60 124 66 118' : mood === 'droopy' ? 'M55 121 Q60 117 65 121' : 'M56 119 Q60 121.5 64 119';
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 120 132" aria-label="Companion">
      <ellipse cx="60" cy="128" rx="30" ry="3.5" fill="#000" opacity=".25" />
      <g className="sway">
        {stage === 0 ? (
          <g><ellipse cx="60" cy="87" rx="7" ry="5" fill="#a47148" /><path d="M60 82 q2 -6 7 -7" stroke="#5fd38a" strokeWidth="2.4" fill="none" strokeLinecap="round" /></g>
        ) : (
          <rect x="58" y={topY} width="4" height={stemH + 4} rx="2" fill={leafDark} />
        )}
        {leaves}
        {crown && (
          <g>
            <circle cx="60" cy={topY - 6} r={stage >= 5 ? 22 : 16} fill={leaf} />
            <circle cx={stage >= 5 ? 44 : 49} cy={topY + 4} r={stage >= 5 ? 14 : 10} fill={leafDark} />
            <circle cx={stage >= 5 ? 76 : 71} cy={topY + 4} r={stage >= 5 ? 14 : 10} fill={leafDark} />
            <circle cx="60" cy={topY - 14} r={stage >= 5 ? 12 : 8} fill="#7be3a2" />
          </g>
        )}
        {blooms && [[46, topY - 14], [74, topY - 10], [60, topY - 26], [52, topY + 2], [70, topY + 6]].map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="0" cy="-3.2" rx="2.2" ry="3.2" fill="#f9a8d4" transform={`rotate(${a})`} />)}
            <circle r="1.8" fill="#facc15" />
          </g>
        ))}
        {mood === 'happy' && stage > 0 && (
          <g fill={accent} opacity=".9">
            <path d="M24 60 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" />
            <path d="M96 48 l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5 -3.5 -3.5 -1.5 3.5 -1.5z" />
          </g>
        )}
      </g>
      {/* pot with face */}
      <path d="M34 96 H86 L80 126 Q79 129 76 129 H44 Q41 129 40 126 Z" fill="#ece6db" />
      <rect x="31" y="92" width="58" height="9" rx="4.5" fill={accent} />
      {eyes}
      <path d={mouth} stroke="#1a1a1e" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      {mood === 'happy' && <g fill="#f472b6" opacity=".55"><ellipse cx="46" cy="117" rx="3.5" ry="2" /><ellipse cx="74" cy="117" rx="3.5" ry="2" /></g>}
    </svg>
  );
}
