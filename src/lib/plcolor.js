// Accent colour for the planner screens (dark / light variants).
export const PL_COLORS = {
  // sd = the softer dark-mode tone used by Studio (less saturated so it doesn't glare on dark surfaces)
  indigo: { label: 'Indigo', d: ['#8f9bff', '#10133a'], l: ['#4f5bd5', '#fff'], sd: ['#9aa2e4', '#14172f'] },
  teal: { label: 'Teal', d: ['#52b79a', '#06231b'], l: ['#1f8a6b', '#fff'], sd: ['#7bbaa6', '#0d241c'] },
  sky: { label: 'Sky', d: ['#5cb8f5', '#06223a'], l: ['#1f7fc4', '#fff'], sd: ['#86b6d8', '#0e2233'] },
  violet: { label: 'Violet', d: ['#b794f6', '#22103f'], l: ['#7c4fd8', '#fff'], sd: ['#b3a3dc', '#1f1733'] },
  rose: { label: 'Rose', d: ['#f58fb0', '#3a1022'], l: ['#d03f72', '#fff'], sd: ['#d9a2b6', '#331822'] },
  amber: { label: 'Amber', d: ['#f5b84d', '#3a2606'], l: ['#c27a08', '#fff'], sd: ['#d9bb7e', '#2e220d'] },
  lime: { label: 'Lime', d: ['#c8f35a', '#0d1400'], l: ['#5b8c00', '#fff'], sd: ['#bcd38c', '#171f08'] },
};
export function applyPlColor(name, theme) {
  const c = PL_COLORS[name] || PL_COLORS.indigo;
  const [bg, ink] = theme === 'light' ? c.l : c.d;
  const r = document.documentElement.style;
  r.setProperty('--pl', bg); r.setProperty('--pl-ink', ink);
}
