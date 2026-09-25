import React from 'react';

// Hand-drawn style mood faces (replaces emoji so the app looks consistent on every phone)
const COLORS = ['#f87171', '#fb923c', '#facc15', '#a3e635', '#4ade80'];
export const faceColor = (v) => COLORS[Math.min(4, Math.max(0, Math.round(v || 3) - 1))];

export function Face({ v = 3, size = 40, mono = false }) {
  const c = mono ? 'var(--surface-3)' : faceColor(v);
  const ink = '#16161a';
  const mouths = {
    1: 'M13 27 Q20 20 27 27',
    2: 'M13.5 26 Q20 22.5 26.5 26',
    3: 'M14 25 L26 25',
    4: 'M13.5 23.5 Q20 28.5 26.5 23.5',
    5: 'M12.5 22.5 Q20 31 27.5 22.5',
  };
  const r = Math.round(v || 3);
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="19" fill={c} />
      {r === 1 ? (
        <>
          <path d="M11.5 15 L16 17 M28.5 15 L24 17" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
        </>
      ) : r === 5 ? (
        <>
          <path d="M12 16.5 Q14.5 13.5 17 16.5 M23 16.5 Q25.5 13.5 28 16.5" stroke={ink} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="14.5" cy="16" r="2.2" fill={ink} />
          <circle cx="25.5" cy="16" r="2.2" fill={ink} />
        </>
      )}
      <path d={mouths[r]} stroke={ink} strokeWidth="2.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}
