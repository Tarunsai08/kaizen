// Deterministic, explainable day/week planner. Pure JS: no DOM, no database, no network.
import { estimateHours, DEFAULT_FACTORS } from './estimate.js';
import { energyAt, moodShift } from './energy.js';

export const DEFAULTS = {
  sessionMin: 50, breakMin: 10, longBreakMin: 20, capacityH: 6, bufferMin: 10, minGap: 25,
  deadlineBufferDays: 1, wakeMin: 7 * 60, bedMin: 23 * 60, horizon: 7, factors: DEFAULT_FACTORS,
};

/* ---------- date helpers (local time) ---------- */
const p2 = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
const dowOf = (s) => parse(s).getDay();
const diffDays = (a, b) => Math.round((parse(a) - parse(b)) / 864e5);
const parts = (ts) => { const d = new Date(ts); return { date: ymd(d), min: d.getHours() * 60 + d.getMinutes() }; };
const up5 = (m) => Math.ceil(m / 5) * 5;

function merge(list) {
  const a = list.filter((x) => x[1] > x[0]).sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const s of a) { const l = out[out.length - 1]; if (l && s[0] <= l[1]) l[1] = Math.max(l[1], s[1]); else out.push([s[0], s[1]]); }
  return out;
}
function subtract(win, busy) {
  const out = []; let c = win[0];
  for (const b of busy) { if (b[1] <= c) continue; if (b[0] >= win[1]) break; if (b[0] > c) out.push([c, Math.min(b[0], win[1])]); c = Math.max(c, b[1]); }
  if (c < win[1]) out.push([c, win[1]]);
  return out;
}

/** Fixed blocks that apply on a date, as [start,end] minute segments (blocks past midnight spill into the next day). */
export function blockSegments(blocks, date) {
  const segs = [];
  const check = (b, d) => (!b.validFrom || d >= b.validFrom) && (!b.validUntil || d <= b.validUntil) && (b.days || []).includes(dowOf(d));
  for (const b of blocks || []) {
    const over = b.end <= b.start;
    if (check(b, date)) segs.push({ b, seg: [b.start, over ? 1440 : b.end] });
    if (over && check(b, addDays(date, -1))) segs.push({ b, seg: [0, b.end] });
  }
  return segs;
}

/* ---------- main entry ---------- */
export function buildPlan(input) {
  const S = { ...DEFAULTS, ...(input.settings || {}) };
  S.factors = { ...DEFAULT_FACTORS, ...(input.settings?.factors || {}) };
  const stats = input.stats || {};
  const corr = stats.correction || {};
  const ctx = input.ctx || {};
  const nowTs = input.now ?? Date.now();
  const np = parts(nowTs);
  const today = input.today || np.date;
  const nowMin = np.date === today ? np.min : np.date === addDays(today, 1) ? np.min + 1440 : 0; // after midnight but still 'yesterday' for the user
  const locked = (input.locked || []).filter((s) => s.date >= today);
  const lowDay = !!(ctx.lowEnergy || (ctx.mood != null && ctx.mood <= 2) || (ctx.sleepH != null && ctx.sleepH < 6));
  const goodDay = !lowDay && ctx.mood != null && ctx.mood >= 4 && (ctx.sleepH == null || ctx.sleepH >= 7);
  const shift = moodShift(ctx);
  const dates = Array.from({ length: S.horizon }, (_, i) => addDays(today, i));
  const fullCap = S.capacityH * 60;
  const notes = [];
  if (lowDay) notes.push('Lighter plan today.');

  /* ----- free slots per day ----- */
  const cap = {}, slotsBy = {}, doneMin = {};
  dates.forEach((date, i) => {
    const wake = i === 0 && ctx.wakeMin != null ? ctx.wakeMin : S.wakeMin;
    let start = wake, end = S.bedMin > wake ? S.bedMin : 1440;
    const segs = blockSegments(input.fixed, date);
    const sleep = segs.find((x) => x.b.type === 'SLEEP' && x.seg[0] > start);
    if (sleep) end = Math.min(end, sleep.seg[0]);
    if (i === 0) start = Math.max(start, up5(nowMin));
    const busy = segs.filter((x) => x.b.type !== 'SLEEP').map((x) => x.seg);
    for (const e of input.events || []) {
      if (e.allDay || (e.treatAs && e.treatAs !== 'BUSY')) continue;
      const a = parts(e.start), b = parts(e.end);
      if (a.date <= date && b.date >= date) busy.push([a.date < date ? 0 : a.min, b.date > date ? 1440 : b.min]);
    }
    for (const b of input.busy || []) if (b.date === date) busy.push([b.start, b.end]);
    let used = 0;
    for (const s of locked) {
      if (s.date !== date || s.state === 'SKIPPED') continue;
      busy.push([s.start, s.end]);
      if (s.kind !== 'BREAK') used += s.end - s.start;
    }
    doneMin[date] = used;
    const padded = merge(busy.map(([a, b]) => [a - S.bufferMin, b + S.bufferMin]));
    const free = subtract([start, end], padded).filter((g) => g[1] - g[0] >= S.minGap);
    const dayFactor = i === 0 ? (lowDay ? 0.6 : goodDay ? 1.1 : input.todayFactor ?? 1) : i === 1 ? (input.nextFactor ?? 1) : 1;
    cap[date] = Math.max(0, fullCap * dayFactor - used + (i === 0 && (input.tasks || []).some((x) => x.boost) ? 45 : 0));
    const dow = dowOf(date);
    const slots = [];
    free.forEach((g, gi) => {
      let c = g[0], k = 0;
      const brk = i === 0 && lowDay ? 15 : S.breakMin;
      while (g[1] - c >= S.minGap) {
        const rem = g[1] - c;
        let len = Math.min(S.sessionMin, rem);
        if (rem - len < S.minGap && rem - len > 0) len = rem <= 60 ? rem : rem - S.minGap;
        slots.push({ date, start: c, end: c + len, gap: gi, e: energyAt((c + len / 2) / 60, dow, stats, i === 0 ? shift : 0) });
        k++;
        c += len + (k % 3 === 0 ? (i === 0 && lowDay ? 25 : S.longBreakMin) : brk);
      }
    });
    slotsBy[date] = slots;
  });
  const slotMin = (date, before) => slotsBy[date].reduce((a, s) => a + Math.max(0, Math.min(s.end, before ?? 1440) - s.start), 0);
  /** free focus minutes from the first day up to a deadline timestamp, at a given capacity (null = planned capacity) */
  const available = (untilTs, full, skipToday) => {
    const u = parts(untilTs);
    let tot = 0;
    for (const date of dates) {
      if (date > u.date) break;
      if (skipToday && date === today) continue;
      const m = slotMin(date, date === u.date ? u.min : undefined);
      tot += Math.min(m, full ? Math.max(0, fullCap - doneMin[date]) : cap[date]);
    }
    return tot;
  };

  /* ----- work units per task ----- */
  const endOfToday = parse(today).getTime() + 864e5 - 60000;
  const tasks = [];
  for (const t of input.tasks || []) {
    if (t.done) continue;
    const cat = t.category || 'OTHER';
    const est = (o) => estimateHours({ ...o, category: cat }, S.factors, corr);
    const spent = t.spentMin || 0;
    const covered = locked.filter((s) => s.taskId === t.id && s.state === 'PLANNED' && s.kind !== 'BREAK').reduce((a, s) => a + s.end - s.start, 0);
    const subs = (t.subtasks || []).filter((s) => !s.done);
    let units = [];
    if (t.recurring) {
      units = [];
    } else if (subs.length) {
      const noHrs = t.estHours > 0 && subs.every((s) => !(s.estHours > 0));
      const w = subs.map((s) => estimateHours({ difficulty: s.difficulty ?? t.difficulty, whole: false, category: 'OTHER' }, {}, {}).hours);
      const ws = w.reduce((a, b) => a + b, 0);
      units = subs.map((s, i) => ({ subId: s.id, title: s.title, difficulty: s.difficulty ?? t.difficulty ?? 3, minutes: (noHrs ? (t.estHours * 60 * w[i]) / ws : est({ difficulty: s.difficulty ?? t.difficulty, hours: s.estHours, whole: false }).hours * 60) }));
    } else if (!(t.subtasks || []).length) {
      units = [{ subId: null, title: t.title, difficulty: t.difficulty ?? 3, minutes: est({ difficulty: t.difficulty, hours: t.estHours, whole: true }).hours * 60 }];
    }
    let skip = spent + covered;
    units = units.map((u) => { const cut = Math.min(u.minutes, skip); skip -= cut; return { ...u, minutes: u.minutes - cut }; }).filter((u) => u.minutes >= 10);
    const chunks = [];
    for (const u of units) {
      const n = Math.max(1, Math.ceil(u.minutes / S.sessionMin - 0.15));
      for (let i = 0; i < n; i++) chunks.push({ ...u, minutes: Math.max(15, up5(u.minutes / n)) });
    }
    const total = chunks.reduce((a, c) => a + c.minutes, 0);
    if (!t.recurring && !(t.subtasks || []).length && !t.planNudged && total >= 45) chunks.unshift({ subId: null, title: t.title, difficulty: 1, minutes: 15, kind: 'PLAN_SUBTASKS' });
    let deadline = t.deadline != null ? (t.deadline < nowTs ? endOfToday : t.deadline) : null;
    let target = null;
    if (deadline != null) {
      const win = deadline - nowTs;
      target = deadline - Math.max(S.deadlineBufferDays * 864e5, 0.15 * win);
      if (target < nowTs + 3600e3) target = deadline;
    }
    tasks.push({ ...t, cat, chunks, remaining: total, deadline, target, perDay: {}, lastEnd: {}, n: {} });
  }

  /* ----- risk (can it fit even at full capacity?) ----- */
  const atRisk = [];
  for (const t of tasks) {
    if (t.deadline == null || t.recurring) continue;
    const need = t.remaining;
    const have = available(t.deadline, true);
    t.atRisk = need > have + 1;
    if (t.atRisk) atRisk.push({ taskId: t.id, title: t.title, shortH: Math.round(((need - have) / 60) * 10) / 10, options: ['Raise today’s capacity', 'Use flexible blocks', 'Reduce scope', 'Accept partial completion'] });
  }
  const score = (t, date) => {
    if (t.boost) return 10;
    const remH = t.chunks.reduce((a, c) => a + c.minutes, 0) / 60;
    if (t.deadline == null) return 0.05 * (remH / 40) + 0.2 * ((t.difficulty ?? 2) / 5);
    const avail = Math.max(available(t.target ?? t.deadline) / 60, 0.1);
    const days = Math.max(0, diffDays(ymd(new Date(t.deadline)), date));
    return 0.5 * (remH / avail) + 0.3 * (1 / (days + 1)) + 0.2 * ((t.difficulty ?? 3) / 5);
  };

  /* ----- placement ----- */
  const sessions = [];
  const reasonFor = (t, ch, slot, extra) => {
    const tier = slot.e >= 0.8 ? 'Peak focus slot' : slot.e <= 0.45 ? 'Low-energy slot, easy pace' : 'Steady slot';
    const what = ch.kind === 'PLAN_SUBTASKS' ? 'Break this into steps?' : ch.difficulty >= 4 ? (ch.subId ? `hardest step of ${t.title}` : `demanding work on ${t.title}`) : ch.subId ? `next step of ${t.title}` : `progress on ${t.title}`;
    let r = ch.kind === 'PLAN_SUBTASKS' ? `A quick 15 min to plan · ${what}` : `${tier} · ${what}`;
    if (t.deadline != null) {
      const dd = diffDays(ymd(new Date(t.deadline)), slot.date);
      if (dd <= 0) r += ' · due today'; else if (dd === 1) r += ' · due tomorrow'; else if (dd <= 3) r += ` · due in ${dd} days`;
    }
    if (t.atRisk) r += ' · at risk, so it gets priority';
    if (slot.date === today && ctx.sleepH != null && ctx.sleepH < 6 && ch.minutes <= 40) r += ` · kept short because you slept ${Math.round(ctx.sleepH * 10) / 10}h`;
    return extra ? `${extra} · ${r}` : r;
  };
  const place = (date, slot, t, ch, len, kind, reason) => {
    sessions.push({ date, start: slot.start, end: slot.start + len, taskId: t.id, subId: ch.subId ?? null, kind, reason, title: ch.title || t.title, taskTitle: t.title, difficulty: ch.difficulty, _e: slot.e, _ch: ch });
    const brk = S.breakMin;
    const rest = slot.start + len + brk;
    const idx = slotsBy[date].indexOf(slot);
    slotsBy[date].splice(idx, 1);
    if (slot.end - rest >= S.minGap) slotsBy[date].push({ ...slot, start: rest });
    t.lastEnd[date] = slot.start + len;
    t.n[date] = (t.n[date] || 0) + 1;
    t.perDay[date] = (t.perDay[date] || 0) + len;
  };
  const fits = (date, t, minLen) => slotsBy[date].filter((s) => s.end - s.start >= minLen
    && (t.deadline == null || date < ymd(new Date(t.deadline)) || (date === ymd(new Date(t.deadline)) && s.end <= parts(t.deadline).min)));
  const pick = (list, difficulty) => {
    const s = [...list].sort((a, b) => b.e - a.e);
    return difficulty >= 4 ? s[0] : difficulty <= 2 ? s[s.length - 1] : s[Math.floor((s.length - 1) / 2)];
  };

  dates.forEach((date, di) => {
    let room = cap[date];
    const dow = dowOf(date);
    // recurring tasks: one fixed session per matching day, closest to the usual time
    for (const t of tasks.filter((x) => x.recurring)) {
      const r = t.recurring;
      if (r.from && date < r.from) continue;
      if (r.days && !r.days.includes(dow)) continue;
      if (di === 0 && t.deferToday) continue;
      if (t.deadline != null && date > ymd(new Date(t.deadline)) && !r.ghost) continue;
      const len = Math.min(r.minutes || 60, 90);
      const opts = slotsBy[date].filter((s) => s.end - s.start >= Math.min(len, 25));
      if (!opts.length || room < Math.min(len, 25)) continue;
      const pref = r.prefStart ?? t.prefStart ?? null;
      const slot = pref != null ? opts.sort((a, b) => Math.abs(a.start - pref) - Math.abs(b.start - pref))[0] : pick(opts, t.difficulty ?? 3);
      const l = Math.min(len, slot.end - slot.start);
      t.prefStart = slot.start;
      place(date, slot, t, { title: t.title, difficulty: t.difficulty ?? 3, subId: null }, l, 'WORK', 'Your daily slot · repeating task stays near the same time');
      room -= l;
    }
    // low-mood day: start with one or two easy wins
    if (di === 0 && lowDay) {
      for (let k = 0; k < 2; k++) {
        const cands = [];
        tasks.forEach((t) => t.chunks.forEach((c, i) => { if (c.kind !== 'PLAN_SUBTASKS' && c.difficulty <= 2 && c.minutes <= 30 && !t.recurring) cands.push({ t, c, i }); }));
        let w = cands.sort((a, b) => a.c.minutes - b.c.minutes)[0];
        if (!w && k === 0) {
          const alt = [];
          tasks.forEach((t) => t.chunks.forEach((c, i) => { if (c.kind !== 'PLAN_SUBTASKS' && !t.recurring) alt.push({ t, c, i }); }));
          const a = alt.sort((x, y) => x.c.difficulty - y.c.difficulty || x.c.minutes - y.c.minutes)[0];
          if (!a) break;
          if (a.c.minutes > 30) { a.c.minutes -= 25; w = { t: a.t, c: { ...a.c, minutes: 25 }, i: -1 }; } else w = a;
        }
        if (!w) break;
        const opts = fits(date, w.t, Math.min(w.c.minutes, 25));
        if (!opts.length) break;
        const slot = [...opts].sort((a, b) => a.start - b.start)[0];
        const len = Math.min(w.c.minutes, 30, slot.end - slot.start);
        place(date, slot, w.t, w.c, len, 'EASY_WIN', reasonFor(w.t, w.c, slot, 'Easy win to get started'));
        if (w.i >= 0) w.t.chunks.splice(w.i, 1);
        room -= len;
      }
    }
    const done = new Set();
    for (let guard = 0; guard < 80 && room >= 15; guard++) {
      const live = tasks.filter((t) => !t.recurring && t.chunks.length && !done.has(t.id) && !(di === 0 && t.deferToday));
      if (!live.length) break;
      const ranked = live.map((t) => ({ t, s: score(t, date) })).sort((a, b) => b.s - a.s);
      let chosen = null;
      for (const { t } of ranked) {
        const ch = t.chunks[0];
        // hard work waits on a low-mood day when the deadline stays safe
        if (di === 0 && lowDay && ch.difficulty >= 4 && ch.kind !== 'PLAN_SUBTASKS') {
          const safe = t.deadline == null || (t.remaining / 60 <= 0.85 * (available(t.deadline, true, true) / 60));
          if (safe) continue;
        }
        const minLen = Math.min(ch.minutes, 25);
        const sessionsLeft = live.length > 1 && (t.n[date] || 0) >= 3;
        if (sessionsLeft) continue;
        if (!t.atRisk && !t.boost && t.deadline != null && ch.kind !== 'PLAN_SUBTASKS') {
          const dLeft = Math.max(1, diffDays(ymd(new Date(t.target ?? t.deadline)), date) + 1);
          const quota = Math.max(S.sessionMin, (t.remaining / dLeft) * 1.5);
          if ((t.perDay[date] || 0) + ch.minutes > quota && live.length > 1) continue;
        }
        const opts = fits(date, t, minLen);
        if (!opts.length) continue;
        chosen = { t, ch, slot: pick(opts, ch.difficulty) };
        break;
      }
      if (!chosen) break;
      const { t, ch, slot } = chosen;
      let len = Math.min(ch.minutes, slot.end - slot.start, room);
      if (di === 0 && lowDay && ch.difficulty >= 4) len = Math.min(len, 40);
      if (len < 15) { done.add(t.id); continue; }
      place(date, slot, t, ch, len, ch.kind || 'WORK', reasonFor(t, ch, slot));
      room -= len;
      t.remaining = Math.max(0, t.remaining - len);
      if (ch.minutes - len >= 15 && ch.kind !== 'PLAN_SUBTASKS') ch.minutes -= len; else t.chunks.shift();
    }
    // keep each task's steps in order through the day, whatever slot they landed in
    const byTask = {};
    sessions.filter((x) => x.date === date && x.kind === 'WORK' && !x.recurring).forEach((x) => (byTask[x.taskId] ||= []).push(x));
    Object.values(byTask).forEach((list) => {
      if (list.length < 2) return;
      const labels = list.map((x) => x._ch);
      list.sort((a, b) => a.start - b.start).forEach((x, i) => {
        const t = tasks.find((q) => q.id === x.taskId);
        x._ch = labels[i]; x.title = labels[i].title || t.title; x.subId = labels[i].subId ?? null; x.difficulty = labels[i].difficulty;
        x.reason = reasonFor(t, labels[i], { e: x._e, date });
      });
    });
  });

  /* ----- breaks between back-to-back sessions ----- */
  const work = sessions.filter((s) => s.kind !== 'BREAK').sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  const breaks = [];
  for (let i = 1; i < work.length; i++) {
    const a = work[i - 1], b = work[i];
    if (a.date === b.date && b.start - a.end >= 5 && b.start - a.end <= S.longBreakMin + 5) breaks.push({ date: a.date, start: a.end, end: b.start, taskId: null, subId: null, kind: 'BREAK', reason: b.start - a.end >= S.longBreakMin ? 'Longer break after a few sessions' : 'Short break to reset', title: 'Break' });
  }

  /* ----- unplaced work, offers ----- */
  const unplaced = tasks.filter((t) => !t.recurring && t.chunks.some((c) => c.kind !== 'PLAN_SUBTASKS')).map((t) => ({ taskId: t.id, title: t.title, minutes: t.chunks.reduce((a, c) => a + c.minutes, 0), deadline: t.deadline }));
  for (const u of unplaced) if (u.deadline != null && !atRisk.find((r) => r.taskId === u.taskId)) {
    const t = tasks.find((x) => x.id === u.taskId);
    if (parse(ymd(new Date(u.deadline))) < parse(addDays(today, S.horizon))) { t.atRisk = true; atRisk.push({ taskId: t.id, title: t.title, shortH: Math.round((u.minutes / 60) * 10) / 10, options: ['Raise today’s capacity', 'Use flexible blocks', 'Reduce scope', 'Accept partial completion'] }); }
  }
  const offers = [];
  if (goodDay) {
    const next = sessions.filter((s) => s.date > today && s.kind === 'WORK').sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)[0];
    if (next) offers.push({ type: 'pull', taskId: next.taskId, title: next.taskTitle, text: 'Pull one task forward?' });
  }
  sessions.forEach((x) => { delete x._e; delete x._ch; });
  return { sessions: [...sessions, ...breaks].sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start), atRisk, unplaced, notes, offers, lowDay, goodDay, capacity: cap };
}
