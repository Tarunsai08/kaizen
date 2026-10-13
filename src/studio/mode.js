// "Studio" is the redesigned app; "Classic" is the original. Older builds called Studio "zen".
export const isStudio = (s) => s?.uiStyle === 'studio' || s?.uiStyle === 'zen';
// Study as a BYJU'S-style learning journey: on by default in Studio, off in Classic, and either can be chosen in Settings.
export const journeyOn = (s) => (s?.studyStyle === 'journey' ? true : s?.studyStyle === 'roadmap' ? false : isStudio(s));
// Bottom bar: Today is fixed; up to four more pages, chosen per app style in Settings.
export const NAV_CHOICES = [
  { key: 'plan', label: 'Plan' }, { key: 'focus', label: 'Focus' }, { key: 'study', label: 'Study' },
  { key: 'habits', label: 'Habits' }, { key: 'health', label: 'Health' }, { key: 'spaces', label: 'Spaces' },
];
export const defaultNav = (studio) => (studio ? ['plan', 'focus', 'study', 'spaces'] : ['plan', 'study', 'habits', 'health']);
export const navKey = (studio) => (studio ? 'navStudio' : 'navClassic');
// Dark mode: saturated colours "vibrate" on dark surfaces, so data colours (subjects, habits, people) are softened —
// lower saturation, mid lightness — the way Notion / Things / Craft treat colour in dark mode.
export function softColor(c, dark) {
  if (!dark || typeof c !== 'string' || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c)) return c;
  let h = c.slice(1); if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let hue = 0, s = 0;
  if (d) { s = d / (1 - Math.abs(2 * l - 1)); hue = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hue *= 60; if (hue < 0) hue += 360; }
  const S = Math.min(s, 1) * 0.62, L = Math.min(0.7, Math.max(0.6, l));
  const C = (1 - Math.abs(2 * L - 1)) * S, X = C * (1 - Math.abs(((hue / 60) % 2) - 1)), m = L - C / 2;
  const [R, G, B] = hue < 60 ? [C, X, 0] : hue < 120 ? [X, C, 0] : hue < 180 ? [0, C, X] : hue < 240 ? [0, X, C] : hue < 300 ? [X, 0, C] : [C, 0, X];
  return '#' + [R, G, B].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}
