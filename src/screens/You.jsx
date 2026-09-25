import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, Sparkles, CalendarDays, BookOpen, Wind, Globe, Palette, Repeat, Settings as Cog, Snowflake, Grid3x3, Gift, X, ChevronLeft, Trophy, Pencil } from 'lucide-react';
import { db, setKV } from '../db';
import { useApp } from '../ctx';
import { today, addDays, parse, MONTHS, monthStart, monthEnd, addMonths, range, fmtDur, DAYS_SHORT, dow } from '../lib/date';
import { computeXP, AREAS, stageFor, STAGES, takeRestDay, momentumUntil, isGood } from '../lib/xp';
import { sumByDate, sleepMinutes, avg, money, breakStats } from '../lib/logic';
import { TopBar, Ring, Bar, Sheet, Seg } from '../ui/kit';
import { faceColor } from '../ui/faces';
import { HIcon } from '../ui/icons';
import Companion from '../ui/Companion';
import { success, tap } from '../lib/native';

export const useXP = () => useLiveQuery(() => computeXP(), []);

export function companionMood(score, hour = new Date().getHours()) {
  if (score >= 70) return 'happy';
  if (hour < 10 && score < 20) return 'sleepy';
  if (hour >= 18 && score < 30) return 'droopy';
  return 'ok';
}

/* =========================================================
   YOU hub
   ========================================================= */
export function You() {
  const { push, settings } = useApp();
  const xp = useXP();
  const scores = settings.scores || {};
  const t = today();
  if (!xp) return <div className="screen no-nav" />;
  const st = stageFor(xp.total.level);
  const mood = companionMood(scores[t] || 0);
  const lm = addMonths(monthStart(), -1);
  const lastMonth = Object.keys(scores).some((d) => d.startsWith(lm.slice(0, 7))) ? lm : monthStart();
  const rows = [
    { l: 'Insights', s: 'Patterns across your data', i: Sparkles, c: 'var(--accent)', go: 'Insights' },
    { l: 'Weekly review', s: 'Your week in one card', i: CalendarDays, c: 'var(--goal)', go: 'WeeklyReview' },
    { l: 'Journal', s: 'Night reviews & entries', i: BookOpen, c: 'var(--mood)', go: 'JournalHistory' },
    { l: 'Boredom kit', s: 'Websites, hobbies & stats', i: Wind, c: 'var(--bored)', go: 'Boredom' },
    { l: 'Subscriptions', s: 'Recurring payments', i: Repeat, c: 'var(--task)', go: 'Subscriptions' },
    { l: 'Settings', s: 'Theme, reminders, backup', i: Cog, c: 'var(--text-2)', go: 'Settings' },
  ];
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="" />
      {/* Profile + companion */}
      <button className="hero card-press" style={{ width: '100%', textAlign: 'left' }} onClick={() => push('CompanionScreen')}>
        <div className="glow" style={{ background: 'var(--accent)', right: -80, top: -90 }} />
        <div className="row gap-14">
          <div className="float"><Companion stage={st.index} mood={mood} size={92} /></div>
          <div className="grow">
            <div className="eyebrow">{settings.name || 'You'} & {settings.companionName || 'Kai'}</div>
            <div className="h2 mt-4">Level {xp.total.level}</div>
            <div className="small muted">{st.name} · {xp.total.xp.toLocaleString()} XP</div>
            <div className="mt-8"><Bar value={xp.total.progress} color="var(--accent)" /></div>
            <div className="tiny muted mt-4">{Math.round(xp.total.next - xp.total.xp)} XP to level {xp.total.level + 1}</div>
          </div>
        </div>
      </button>

      {/* Areas */}
      <div className="card mt-12">
        <div className="h3 mb-12">Life areas</div>
        <div className="col gap-14">
          {Object.entries(AREAS).map(([k, a]) => {
            const v = xp.areas[k];
            return (
              <div key={k} className="row gap-12">
                <div className="tile sm" style={{ background: `color-mix(in srgb, ${a.color} 16%, transparent)` }}><HIcon icon={a.icon} size={16} color={a.color} /></div>
                <div className="grow">
                  <div className="row between small"><span style={{ fontWeight: 620 }}>{a.label}</span><span className="muted num">Lv {v.level}</span></div>
                  <div className="mt-4"><Bar value={v.progress} color={a.color} h={5} /></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Freezes */}
      <FreezeCard />

      {/* Wrapped + pixels */}
      <div className="grid-2 mt-12">
        <button className="tool card-press" style={{ background: 'linear-gradient(145deg, #3b1d6e, #121215 70%)' }} onClick={() => push('Wrapped', { month: lastMonth })}>
          <div className="tile" style={{ background: 'rgba(255,255,255,.1)' }}><Gift size={20} color="#e9d5ff" /></div>
          <div><div className="t">{MONTHS[parse(lastMonth).getMonth()]} Wrapped</div><div className="s">Your month as a story</div></div>
        </button>
        <button className="tool card-press" onClick={() => push('YearPixels')}>
          <div className="tile" style={{ background: 'color-mix(in srgb, var(--mood) 16%, transparent)' }}><Grid3x3 size={20} color="var(--mood)" /></div>
          <div><div className="t">Year in pixels</div><div className="s">Every day, one square</div></div>
        </button>
      </div>

      <div className="list mt-12">
        {rows.map((x) => (
          <button key={x.l} className="menu-row" onClick={() => push(x.go)}>
            <div className="tile sm" style={{ background: `color-mix(in srgb, ${x.c} 14%, transparent)` }}><x.i size={17} color={x.c} /></div>
            <div className="grow"><div className="t">{x.l}</div><div className="s">{x.s}</div></div>
            <ChevronRight size={16} className="muted" />
          </button>
        ))}
      </div>
    </div>
  );
}

function FreezeCard() {
  const { settings, toast } = useApp();
  const [open, setOpen] = useState(false);
  const n = settings.freezes ?? 0;
  const t = today();
  const frozenToday = (settings.frozenDays || []).includes(t);
  const m = momentumUntil(settings.scores || {}, settings.frozenDays || [], addDays(t, -1));
  const toNext = 7 - (m % 7);
  return (
    <>
      <button className="card card-press row gap-14 mt-12" style={{ width: '100%', textAlign: 'left' }} onClick={() => setOpen(true)}>
        <div className="tile" style={{ background: 'color-mix(in srgb, #7dd3fc 16%, transparent)' }}><Snowflake size={20} color="#7dd3fc" /></div>
        <div className="grow">
          <div className="h3">{n} streak freeze{n === 1 ? '' : 's'}</div>
          <div className="small muted">{frozenToday ? 'Today is a rest day ❄︎' : n >= 3 ? 'Fully stocked' : `Next one in ${toNext} good day${toNext > 1 ? 's' : ''}`}</div>
        </div>
        <div className="row gap-4">{[0, 1, 2].map((i) => <Snowflake key={i} size={16} color={i < n ? '#7dd3fc' : 'var(--faint)'} />)}</div>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Streak freezes">
        <p className="dim" style={{ marginTop: -6 }}>Life happens. A freeze protects your streaks on a day you can’t show up — sick, travelling, or just exhausted.</p>
        <ul className="small dim" style={{ paddingLeft: 18, lineHeight: 1.7 }}>
          <li>Earn one for every <b>7 good days</b> in a row (day score 60+). Hold up to 3.</li>
          <li>If you miss a day, one is used <b>automatically</b>.</li>
          <li>Or plan ahead: take a <b>rest day</b> today. Habits won’t be due and your momentum is kept.</li>
        </ul>
        <button className="btn primary block mt-16" disabled={n <= 0 || frozenToday} onClick={async () => { if (await takeRestDay(settings)) { success(); toast('Rest day. Be kind to yourself.'); } setOpen(false); }}>
          {frozenToday ? 'Today is already a rest day' : `Take a rest day today (${n} left)`}
        </button>
      </Sheet>
    </>
  );
}

/* =========================================================
   COMPANION
   ========================================================= */
export function CompanionScreen() {
  const { settings, toast } = useApp();
  const xp = useXP();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState(settings.companionName || 'Kai');
  if (!xp) return <div className="screen no-nav" />;
  const st = stageFor(xp.total.level);
  const t = today();
  const score = (settings.scores || {})[t] || 0;
  const mood = companionMood(score);
  const msg = { happy: `${settings.companionName || 'Kai'} is glowing. Great day!`, ok: `${settings.companionName || 'Kai'} is growing with you.`, sleepy: `${settings.companionName || 'Kai'} is still waking up. Start with one small thing.`, droopy: `${settings.companionName || 'Kai'} could use a little care. One habit is enough.` }[mood];
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="" right={<button className="icon-btn" onClick={() => setNaming(true)}><Pencil size={17} /></button>} />
      <div className="col" style={{ alignItems: 'center', textAlign: 'center' }}>
        <div className="float"><Companion stage={st.index} mood={mood} size={200} /></div>
        <h1 className="h1 mt-8">{settings.companionName || 'Kai'}</h1>
        <div className="muted">{st.name} · Level {xp.total.level}</div>
        <p className="dim" style={{ maxWidth: 300 }}>{msg}</p>
      </div>
      <div className="card mt-16">
        <div className="row between small"><span style={{ fontWeight: 620 }}>{st.next ? `Next: ${st.next.name}` : 'Fully grown'}</span>{st.next && <span className="muted">at level {st.next.min}</span>}</div>
        <div className="mt-8"><Bar value={st.next ? (xp.total.level - st.min + xp.total.progress) / (st.next.min - st.min) : 1} color="var(--accent)" /></div>
      </div>
      <div className="card mt-12">
        <div className="h3 mb-12">Growth path</div>
        <div className="row" style={{ justifyContent: 'space-between', overflowX: 'auto', gap: 4 }}>
          {STAGES.map((s, i) => (
            <div key={s.name} className="col" style={{ alignItems: 'center', gap: 2, opacity: i <= st.index ? 1 : 0.35, minWidth: 44 }}>
              <Companion stage={i} mood="ok" size={42} />
              <span className="tiny muted" style={{ textAlign: 'center' }}>{s.min}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="card mt-12">
        <div className="h3 mb-8">What helps {settings.companionName || 'Kai'} grow</div>
        {[['Complete a habit', 10], ['Resist an urge', 15], ['Finish a workout', 30], ['Night review', 15], ['Focus 25 min', 10], ['Catch up with someone', 12], ['Breathe / reframe', '5–10'], ['Achieve a goal', 100]].map(([a, b]) => (
          <div key={a} className="row between small" style={{ padding: '6px 0' }}><span className="dim">{a}</span><span className="num" style={{ fontWeight: 650 }}>+{b} XP</span></div>
        ))}
        <div className="tiny muted mt-8">Today: +{xp.today} XP</div>
      </div>
      <Sheet open={naming} onClose={() => setNaming(false)} title="Name your companion">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={16} autoFocus />
        <button className="btn primary block mt-16" onClick={async () => { await setKV('companionName', name.trim() || 'Kai'); setNaming(false); toast('Nice name'); }}>Save</button>
      </Sheet>
    </div>
  );
}

/* =========================================================
   YEAR IN PIXELS
   ========================================================= */
export function YearPixels() {
  const { settings, push } = useApp();
  const [year, setYear] = useState(Number(today().slice(0, 4)));
  const [mode, setMode] = useState('mood');
  const data = useLiveQuery(async () => ({ moods: await db.moods.toArray(), journal: await db.journal.toArray() }), []);
  if (!data) return <div className="screen no-nav" />;
  const dm = {};
  data.moods.forEach((m) => (dm[m.date] = dm[m.date] || []).push(m.mood));
  data.journal.forEach((j) => j.mood && (dm[j.date] = dm[j.date] || []).push(j.mood));
  const scores = settings.scores || {};
  const t = today();
  const color = (d) => {
    if (d > t) return 'transparent';
    if (mode === 'mood') return dm[d] ? faceColor(avg(dm[d])) : 'var(--surface-3)';
    const s = scores[d];
    if ((settings.frozenDays || []).includes(d)) return '#7dd3fc';
    return s == null ? 'var(--surface-3)' : `color-mix(in srgb, var(--accent) ${Math.round(15 + (s / 100) * 85)}%, var(--surface-3))`;
  };
  const filled = Object.keys(mode === 'mood' ? dm : scores).filter((d) => d.startsWith(String(year))).length;
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="Year in pixels" />
      <div className="row between mb-12">
        <button className="icon-btn sm" onClick={() => setYear(year - 1)}><ChevronLeft size={18} /></button>
        <div className="h2 num">{year}</div>
        <button className="icon-btn sm" disabled={year >= Number(t.slice(0, 4))} onClick={() => setYear(year + 1)}><ChevronRight size={18} /></button>
      </div>
      <Seg value={mode} onChange={setMode} options={[{ value: 'mood', label: 'Mood' }, { value: 'score', label: 'Day score' }]} />
      <div className="card mt-12">
        <div className="pixels">
          <span />
          {MONTHS.map((m) => <span key={m} className="tiny muted center">{m[0]}</span>)}
          {Array.from({ length: 31 }, (_, di) => (
            <React.Fragment key={di}>
              <span className="tiny muted" style={{ fontSize: 9, lineHeight: '14px' }}>{(di + 1) % 5 === 0 || di === 0 ? di + 1 : ''}</span>
              {MONTHS.map((_, mi) => {
                const last = new Date(year, mi + 1, 0).getDate();
                if (di + 1 > last) return <i key={mi} className="x" />;
                const d = `${year}-${String(mi + 1).padStart(2, '0')}-${String(di + 1).padStart(2, '0')}`;
                return <i key={mi} style={{ background: color(d), outline: d === t ? '1.5px solid var(--text)' : 'none' }} onClick={() => d <= t && push('JournalDay', { date: d })} />;
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="row wrap gap-10 mt-12 small muted">
        {mode === 'mood' ? [1, 2, 3, 4, 5].map((v) => <span key={v} className="row gap-4"><i className="pill-dot" style={{ background: faceColor(v) }} />{['Awful', 'Low', 'Okay', 'Good', 'Great'][v - 1]}</span>)
          : <><span className="row gap-4"><i className="pill-dot" style={{ background: 'var(--accent)' }} />Higher score</span><span className="row gap-4"><i className="pill-dot" style={{ background: '#7dd3fc' }} />Rest day</span></>}
      </div>
      <div className="small muted mt-8">{filled} days recorded in {year}</div>
    </div>
  );
}

/* =========================================================
   MONTHLY WRAPPED (story)
   ========================================================= */
async function buildWrapped(month, settings) {
  const from = month, to = monthEnd(month);
  const inR = (d) => d >= from && d <= to;
  const [habits, logs, moods, journal, sleep, workouts, txs, urges, focus, tasks, inter, cats] = await Promise.all([
    db.habits.where('type').equals('build').toArray(), db.habitLogs.where('date').between(from, to, true, true).toArray(),
    db.moods.where('date').between(from, to, true, true).toArray(), db.journal.where('date').between(from, to, true, true).toArray(),
    db.sleep.where('date').between(from, to, true, true).toArray(), db.workouts.where('date').between(from, to, true, true).toArray(),
    db.transactions.where('date').between(from, to, true, true).toArray(), db.urges.where('date').between(from, to, true, true).toArray(),
    db.focus.where('date').between(from, to, true, true).toArray(), db.tasks.toArray(), db.interactions.where('date').between(from, to, true, true).toArray(),
    db.categories.toArray(),
  ]);
  const scores = settings.scores || {};
  const goodDays = Object.entries(scores).filter(([d, s]) => inR(d) && s >= 60).length;
  const firstDay = Object.keys(scores).sort()[0] || today();
  const startD = firstDay > from ? firstDay : from;
  const bestDay = Object.entries(scores).filter(([d]) => inR(d)).sort((a, b) => b[1] - a[1])[0];
  let topHabit = null;
  for (const h of habits) {
    const byDate = sumByDate(logs.filter((l) => l.habitId === h.id));
    const n = Object.values(byDate).filter((v) => v >= (h.target || 1)).length;
    if (!topHabit || n > topHabit.n) topHabit = { h, n };
  }
  const allMoods = [...moods.map((m) => m.mood), ...journal.filter((j) => j.mood).map((j) => j.mood)];
  const feelings = {};
  moods.forEach((m) => (m.feeling || (m.tags || [])[0]) && (feelings[m.feeling || m.tags[0]] = (feelings[m.feeling || m.tags[0]] || 0) + 1));
  journal.forEach((j) => (j.tags || []).forEach((t) => (feelings[t] = (feelings[t] || 0) + 1)));
  const topFeeling = Object.entries(feelings).sort((a, b) => b[1] - a[1])[0]?.[0];
  const durs = sleep.map(sleepMinutes).filter((x) => x > 0);
  const spent = txs.filter((x) => x.direction === 'debit').reduce((a, b) => a + b.amount, 0);
  const recv = txs.filter((x) => x.direction === 'credit').reduce((a, b) => a + b.amount, 0);
  const byCat = {};
  txs.filter((x) => x.direction === 'debit').forEach((x) => (byCat[x.categoryId] = (byCat[x.categoryId] || 0) + x.amount));
  const topCatId = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topCat = cats.find((c) => c.id === Number(topCatId));
  const bs = breakStats(urges);
  return {
    month, name: MONTHS[parse(month).getMonth()], goodDays, days: range(startD, to > today() ? today() : to).length, bestDay,
    topHabit, avgMood: allMoods.length ? avg(allMoods) : null, topFeeling, nights: journal.length,
    avgSleep: durs.length ? avg(durs) : null, workouts: workouts.filter((w) => w.completed).length,
    spent, saved: recv - spent, topCat, resisted: bs.resisted, relapses: bs.relapses,
    focusMin: focus.reduce((a, b) => a + b.minutes, 0), tasksDone: tasks.filter((x) => x.done && x.doneAt && inR(new Date(x.doneAt).toISOString().slice(0, 10))).length,
    catchups: inter.length,
  };
}

export function Wrapped({ month }) {
  const { pop, settings } = useApp();
  const [m, setM] = useState(month || addMonths(monthStart(), -1));
  const [w, setW] = useState(null);
  const [i, setI] = useState(0);
  const [prog, setProg] = useState(0);
  useEffect(() => { setW(null); setI(0); buildWrapped(m, settings).then(setW); }, [m]);
  const cur = settings.currency;
  const slides = useMemo(() => {
    if (!w) return [];
    const s = [];
    s.push({ bg: 'linear-gradient(160deg,#6d28d9,#1e1b4b)', body: <><div className="eyebrow" style={{ color: '#c4b5fd' }}>Kaizen Wrapped</div><div className="big mt-16">{w.name}</div><div className="lead mt-16" style={{ opacity: 0.85 }}>Let’s look at your month, {settings.name || 'friend'}.</div></> });
    s.push({ bg: 'linear-gradient(160deg,#65a30d,#14280a)', body: <><div className="lead">You showed up</div><div className="big mt-16">{w.goodDays}</div><div className="lead mt-8">good days out of {w.days}</div>{w.bestDay && <div className="mt-24" style={{ opacity: 0.8 }}>Best day: {parse(w.bestDay[0]).getDate()} {w.name} · score {w.bestDay[1]}</div>}</> });
    if (w.topHabit && w.topHabit.n) s.push({ bg: 'linear-gradient(160deg,#059669,#052e22)', body: <><div className="lead">Your strongest habit</div><div className="big mt-16" style={{ fontSize: 48 }}>{w.topHabit.h.name}</div><div className="lead mt-16">done on {w.topHabit.n} days</div></> });
    if (w.avgMood) s.push({ bg: `linear-gradient(160deg,${faceColor(w.avgMood)},#18181b)`, body: <><div className="lead">Your average mood</div><div className="big mt-16">{w.avgMood.toFixed(1)}<span style={{ fontSize: 28, opacity: 0.6 }}> / 5</span></div>{w.topFeeling && <div className="lead mt-16">Most often you felt <b style={{ textTransform: 'lowercase' }}>{w.topFeeling}</b></div>}<div className="mt-24" style={{ opacity: 0.8 }}>{w.nights} night reviews</div></> });
    s.push({ bg: 'linear-gradient(160deg,#4f46e5,#0f0d2e)', body: <><div className="lead">Body</div><div className="big mt-16">{w.workouts}</div><div className="lead mt-8">workouts</div>{w.avgSleep && <div className="lead mt-24">{fmtDur(w.avgSleep)} average sleep</div>}</> });
    if (w.resisted || w.relapses) s.push({ bg: 'linear-gradient(160deg,#dc2626,#2a0a0a)', body: <><div className="lead">Urges you rode out</div><div className="big mt-16">{w.resisted}</div><div className="lead mt-16" style={{ opacity: 0.85 }}>{w.relapses ? `${w.relapses} slips — and you kept going.` : 'Zero slips. Wow.'}</div></> });
    if (w.focusMin || w.tasksDone) s.push({ bg: 'linear-gradient(160deg,#0d9488,#042f2e)', body: <><div className="lead">Deep work</div><div className="big mt-16">{fmtDur(w.focusMin || 0)}</div><div className="lead mt-8">of focus</div><div className="lead mt-24">{w.tasksDone} tasks done</div></> });
    if (w.spent) s.push({ bg: 'linear-gradient(160deg,#0284c7,#082f49)', body: <><div className="lead">Money</div><div className="big mt-16" style={{ fontSize: 52 }}>{money(w.spent, cur)}</div><div className="lead mt-8">spent{w.topCat ? `, mostly on ${w.topCat.name.toLowerCase()}` : ''}</div>{w.saved > 0 && <div className="lead mt-24">You saved {money(w.saved, cur)} 🎉</div>}</> });
    if (w.catchups) s.push({ bg: 'linear-gradient(160deg,#ca8a04,#2a1d02)', body: <><div className="lead">People</div><div className="big mt-16">{w.catchups}</div><div className="lead mt-8">catch-ups with people you care about</div></> });
    s.push({ bg: 'linear-gradient(160deg,#c8f35a,#3f5212)', dark: true, body: <><div className="lead">That’s your {w.name}.</div><div className="big mt-16" style={{ fontSize: 44 }}>1% better, every day.</div><div className="mt-24" style={{ opacity: 0.8 }}>See you next month.</div></> });
    return s;
  }, [w]);
  useEffect(() => {
    if (!slides.length) return;
    setProg(0);
    const start = Date.now();
    const id = setInterval(() => {
      const p = (Date.now() - start) / 6000;
      if (p >= 1) { clearInterval(id); if (i < slides.length - 1) setI(i + 1); else setProg(1); } else setProg(p);
    }, 50);
    return () => clearInterval(id);
  }, [i, slides.length]);
  if (!w) return <div className="story" style={{ background: '#111' }} />;
  const sl = slides[i];
  return (
    <div className="story" style={{ background: sl.bg, color: sl.dark ? '#0d1400' : '#fff' }}
      onClick={(e) => { tap(); const x = e.clientX / window.innerWidth; if (x < 0.3) setI(Math.max(0, i - 1)); else if (i < slides.length - 1) setI(i + 1); }}>
      <div className="story-bars">{slides.map((_, k) => <i key={k}><b style={{ width: `${k < i ? 100 : k === i ? prog * 100 : 0}%`, background: sl.dark ? '#0d1400' : '#fff' }} /></i>)}</div>
      <div className="row between mt-12">
        <select value={m} onClick={(e) => e.stopPropagation()} onChange={(e) => setM(e.target.value)} style={{ background: 'transparent', border: 0, color: 'inherit', fontWeight: 650 }}>
          {Array.from({ length: 12 }, (_, k) => addMonths(monthStart(), -k)).map((x) => <option key={x} value={x} style={{ color: '#000' }}>{MONTHS[parse(x).getMonth()]} {parse(x).getFullYear()}</option>)}
        </select>
        <button className="icon-btn" style={{ background: 'rgba(0,0,0,.2)', color: 'inherit' }} onClick={(e) => { e.stopPropagation(); pop(); }}><X size={20} /></button>
      </div>
      <div className="col grow fade-in" key={i} style={{ justifyContent: 'center' }}>{sl.body}</div>
      <div className="tiny" style={{ opacity: 0.6, textAlign: 'center' }}>Tap to continue</div>
    </div>
  );
}
export { Trophy, Palette, Globe, isGood, DAYS_SHORT, dow };
