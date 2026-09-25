// All dates are handled as local 'YYYY-MM-DD' strings.
const pad = (n) => String(n).padStart(2, '0');

export const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => ymd(new Date());
export const parse = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (s, n) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
export const addMonths = (s, n) => {
  const d = parse(s);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return ymd(d);
};
export const diffDays = (a, b) => Math.round((parse(a) - parse(b)) / 86400000);
export const dow = (s) => parse(s).getDay(); // 0 = Sun

// Week starts Monday
export const weekStart = (s = today()) => addDays(s, -((dow(s) + 6) % 7));
export const monthStart = (s = today()) => s.slice(0, 8) + '01';
export const yearStart = (s = today()) => s.slice(0, 5) + '01-01';
export const monthEnd = (s = today()) => {
  const d = parse(s);
  return ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0));
};
export const range = (from, to) => {
  const out = [];
  for (let s = from; s <= to; s = addDays(s, 1)) out.push(s);
  return out;
};
export const lastNDays = (n, end = today()) => range(addDays(end, -(n - 1)), end);

export const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAYS_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const fmtDay = (s) => {
  const d = parse(s);
  const t = today();
  if (s === t) return 'Today';
  if (s === addDays(t, -1)) return 'Yesterday';
  if (s === addDays(t, 1)) return 'Tomorrow';
  return `${DAYS_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};
export const fmtDate = (s) => {
  const d = parse(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''}`;
};
export const fmtTime = (ts) => {
  const d = new Date(ts);
  let h = d.getHours();
  const m = pad(d.getMinutes());
  const ap = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
};
export const fmtHM = (hhmm) => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? 'pm' : 'am'}`;
};
export const hmToMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
export const nowHM = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fmtDur = (mins) => {
  mins = Math.round(mins);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
};
export const fmtClock = (sec) => {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${pad(m)}:${pad(s)}`;
};

export function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

/* Period helpers used by the Weekly / Monthly / Yearly / Overall toggle */
export function periodRange(period, ref = today()) {
  if (period === 'week') return [weekStart(ref), addDays(weekStart(ref), 6)];
  if (period === 'month') return [monthStart(ref), monthEnd(ref)];
  if (period === 'year') return [yearStart(ref), ref.slice(0, 5) + '12-31'];
  return ['2000-01-01', '2999-12-31'];
}
export function prevPeriodRange(period, ref = today()) {
  if (period === 'week') return periodRange('week', addDays(weekStart(ref), -7));
  if (period === 'month') return periodRange('month', addMonths(monthStart(ref), -1));
  if (period === 'year') return periodRange('year', `${Number(ref.slice(0, 4)) - 1}-06-01`);
  return null;
}
export const periodLabel = { week: 'This week', month: 'This month', year: 'This year', all: 'Overall' };

/* Buckets for trend charts */
export function buckets(period, ref = today()) {
  if (period === 'week') return lastNDays(7, addDays(weekStart(ref), 6)).map((d) => ({ from: d, to: d, label: DAYS_LETTER[dow(d)] }));
  if (period === 'month') {
    const out = [];
    let s = weekStart(monthStart(ref));
    for (let i = 0; i < 6 && s <= monthEnd(ref); i++) {
      out.push({ from: s, to: addDays(s, 6), label: `W${i + 1}` });
      s = addDays(s, 7);
    }
    return out;
  }
  if (period === 'year') {
    const y = ref.slice(0, 4);
    return MONTHS.map((m, i) => {
      const f = `${y}-${pad(i + 1)}-01`;
      return { from: f, to: monthEnd(f), label: m[0] };
    });
  }
  // overall: last 12 months
  const out = [];
  let s = addMonths(monthStart(ref), -11);
  for (let i = 0; i < 12; i++) {
    const d = parse(s);
    out.push({ from: s, to: monthEnd(s), label: MONTHS[d.getMonth()][0] });
    s = addMonths(s, 1);
  }
  return out;
}

export const uid = () => Math.random().toString(36).slice(2, 10);
