// Accent colour for the planner screens (dark / light variants).
export const PL_COLORS = {
  indigo: { label: 'Indigo', d: ['#8f9bff', '#10133a'], l: ['#4f5bd5', '#fff'] },
  teal: { label: 'Teal', d: ['#52b79a', '#06231b'], l: ['#1f8a6b', '#fff'] },
  sky: { label: 'Sky', d: ['#5cb8f5', '#06223a'], l: ['#1f7fc4', '#fff'] },
  violet: { label: 'Violet', d: ['#b794f6', '#22103f'], l: ['#7c4fd8', '#fff'] },
  rose: { label: 'Rose', d: ['#f58fb0', '#3a1022'], l: ['#d03f72', '#fff'] },
  amber: { label: 'Amber', d: ['#f5b84d', '#3a2606'], l: ['#c27a08', '#fff'] },
  lime: { label: 'Lime', d: ['#c8f35a', '#0d1400'], l: ['#5b8c00', '#fff'] },
};
export function applyPlColor(name, theme) {
  const c = PL_COLORS[name] || PL_COLORS.indigo;
  const [bg, ink] = theme === 'light' ? c.l : c.d;
  const r = document.documentElement.style;
  r.setProperty('--pl', bg); r.setProperty('--pl-ink', ink);
}
