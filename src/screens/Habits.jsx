import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Pencil, Archive, Trash2, Minus, X, Wind, Clock } from 'lucide-react';
import { db, setKV } from '../db';
import { useApp } from '../ctx';
import { today, addDays, weekStart, periodRange, buckets, fmtTime, fmtDay, lastNDays, ymd, fmtClock, uid, fmtHM } from '../lib/date';
import { buildStats, streak, breakStats, habitDueOn, graceStatus, intervalAdherence, sumByDate, pct } from '../lib/logic';
import { TopBar, Sheet, Field, Seg, Stepper, Toggle, DayPicker, ColorPicker, EmojiPicker, CategorySelect, TagSelect, Chips, PeriodToggle, Stat, Empty, Confirm, Ring, useInterval, Scale5 } from '../ui/kit';
import { Heatmap, Bars, HBars, WeekHourGrid, HourHist, Line } from '../ui/charts';
import { HabitRow, BreakRow, SectionHead } from '../ui/rows';
import { success, tap } from '../lib/native';
import { HIcon, IconPicker } from '../ui/icons';
import { SubTabs, useSub } from '../ui/kit';
import { ScreenTimeView } from './ScreenTime';
import { AREAS } from '../lib/xp';

/* =========================================================
   HABITS TAB
   ========================================================= */
export function Habits() {
  const [view, setView] = useSub('habits', 'habits');
  return (
    <div className="screen fade-in">
      <HabitsHeader />
      <SubTabs value={view} onChange={setView} options={[['habits', 'Habits'], ['screen', 'Screen time']]} />
      {view === 'habits' ? <HabitsList /> : <ScreenTimeView />}
    </div>
  );
}
function HabitsHeader() {
  const { push } = useApp();
  return (
    <div className="titlebar">
      <h1 className="h1">Habits</h1>
      <button className="icon-btn" onClick={() => push('HabitForm', {})} aria-label="New habit"><Plus size={22} /></button>
    </div>
  );
}

function HabitsList() {
  const { push } = useApp();
  const [cat, setCat] = useState('all');
  const t = today();
  const data = useLiveQuery(async () => {
    const [habits, logs, urges, cats] = await Promise.all([
      db.habits.filter((h) => !h.archived).toArray(),
      db.habitLogs.where('date').between(addDays(weekStart(), -7), t, true, true).toArray(),
      db.urges.toArray(),
      db.categories.where('kind').equals('habit').toArray(),
    ]);
    return { habits, logs, urges, cats };
  }, [t]);
  if (!data) return null;
  const { habits, logs, urges, cats } = data;
  const shown = habits.filter((h) => cat === 'all' || h.categoryId === cat);
  const build = shown.filter((h) => h.type === 'build');
  const brk = shown.filter((h) => h.type === 'break');

  // This week: build completion + break control
  const ws = weekStart();
  let br = 0, bn = 0;
  habits.filter((h) => h.type === 'build').forEach((h) => {
    const s = buildStats(h, logs.filter((l) => l.habitId === h.id), ws, t);
    if (s.dueCount || h.freq === 'weekly') { br += h.freq === 'weekly' ? Math.min(1, s.doneCount / (h.perWeek || 3)) : s.rate; bn++; }
  });
  const weekUrges = urges.filter((u) => u.date >= ws);
  const bs = breakStats(weekUrges);
  const usedCats = cats.filter((c) => habits.some((h) => h.categoryId === c.id));

  return (
    <div>
      <div className="grid-2">
        <div className="card">
          <div className="eyebrow">Build · this week</div>
          <div className="row gap-10 mt-8">
            <Ring size={52} stroke={6} value={bn ? br / bn : 0} color="var(--habit)"><span className="tiny num" style={{ fontWeight: 700 }}>{bn ? Math.round((br / bn) * 100) : 0}</span></Ring>
            <div className="small muted">completion</div>
          </div>
        </div>
        <div className="card">
          <div className="eyebrow">Break · this week</div>
          <div className="row gap-10 mt-8">
            <Ring size={52} stroke={6} value={bs.control ?? 0} color="var(--break)"><span className="tiny num" style={{ fontWeight: 700 }}>{bs.control == null ? '—' : Math.round(bs.control * 100)}</span></Ring>
            <div className="small muted">control<br />{bs.relapses} relapse{bs.relapses === 1 ? '' : 's'}</div>
          </div>
        </div>
      </div>

      {usedCats.length > 0 && (
        <div className="mt-16">
          <Chips value={cat} onChange={setCat} options={[{ value: 'all', label: 'All' }, ...usedCats.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }))]} />
        </div>
      )}

      <div className="section">
        <SectionHead title="Building" />
        {build.length ? (
          <div className="col gap-6">
            {build.map((h) => {
              const due = habitDueOn(h, t);
              return (
                <div key={h.id} style={{ opacity: due ? 1 : 0.5 }}>
                  <HabitRow h={h} logs={logs.filter((l) => l.habitId === h.id)} />
                </div>
              );
            })}
          </div>
        ) : (
          <Empty icon="🌱" title="No habits to build yet" sub="Water, reading, meditation — start with one." action={<button className="btn primary sm" onClick={() => push('HabitForm', { type: 'build' })}>Add a habit</button>} />
        )}
      </div>

      <div className="section">
        <SectionHead title="Breaking" />
        {brk.length ? (
          <div className="col gap-6">{brk.map((h) => <BreakRow key={h.id} h={h} urges={urges.filter((u) => u.habitId === h.id)} />)}</div>
        ) : (
          <Empty icon="🔓" title="Nothing to break yet" sub="Track urges & triggers, not failures." action={<button className="btn sm" onClick={() => push('HabitForm', { type: 'break' })}>Add one</button>} />
        )}
      </div>
    </div>
  );
}

/* =========================================================
   CREATE / EDIT HABIT
   ========================================================= */
const BLANK = {
  type: 'build', name: '', icon: '💧', color: '#4ade80', categoryId: null, unit: '', target: 1, step: 1,
  freq: 'daily', perWeek: 3, days: [0, 1, 2, 3, 4, 5, 6], intervalMins: null, windowStart: '', windowEnd: '',
  reminder: false, reminderTime: '09:00', grace: 0, startDate: '', endDate: '', goalId: null, notes: '',
};
export function HabitForm({ id, type, prefill }) {
  const { pop, toast } = useApp();
  const [h, setH] = useState(null);
  const [adv, setAdv] = useState(false);
  const goals = useLiveQuery(() => db.goals.where('status').equals('active').toArray(), []) || [];
  useEffect(() => {
    (async () => {
      if (id) setH(await db.habits.get(id));
      else setH({ ...BLANK, type: type || 'build', color: type === 'break' ? '#f87171' : '#4ade80', icon: type === 'break' ? 'i:Ban' : 'i:Sparkles', ...(prefill || {}) });
    })();
  }, [id]);
  if (!h) return <div className="screen no-nav" />;
  const set = (patch) => setH((x) => ({ ...x, ...patch }));
  const save = async () => {
    if (!h.name.trim()) return toast('Give it a name');
    const row = { ...h, name: h.name.trim(), target: Number(h.target) || 1, step: Number(h.step) || 1 };
    if (!row.intervalMins) { row.windowStart = row.windowStart || ''; }
    if (id) await db.habits.put(row);
    else await db.habits.add({ ...row, createdAt: Date.now(), archived: false });
    success();
    toast(id ? 'Saved' : 'Habit created');
    pop();
  };
  const isBuild = h.type === 'build';
  return (
    <div className="screen no-nav page-enter">
      <TopBar title={id ? 'Edit habit' : 'New habit'} right={<button className="btn sm primary" onClick={save}>Save</button>} />
      <div className="form">
        {!id && <Seg value={h.type} onChange={(v) => set({ type: v, color: v === 'break' ? '#f87171' : '#4ade80', icon: v === 'break' ? 'i:Ban' : 'i:Sparkles' })} options={[{ value: 'build', label: 'Build' }, { value: 'break', label: 'Break' }]} />}
        <div className="row gap-14">
          <div className="swatch" style={{ width: 60, height: 60, fontSize: 28, borderRadius: 18, background: `color-mix(in srgb, ${h.color} 20%, transparent)` }}><HIcon icon={h.icon} size={28} color={h.color} /></div>
          <input className="input big grow" placeholder={isBuild ? 'Drink water' : 'Doomscrolling'} value={h.name} onChange={(e) => set({ name: e.target.value })} autoFocus={!id} />
        </div>
        <Field label="Icon"><IconPicker value={h.icon} onChange={(v) => set({ icon: v })} color={h.color} /></Field>
        <Field label="Color"><ColorPicker value={h.color} onChange={(v) => set({ color: v })} /></Field>
        <Field label="Category"><CategorySelect kind="habit" value={h.categoryId} onChange={(v) => set({ categoryId: v })} /></Field>
        {isBuild && (
          <Field label="Levels up" hint="Completing it earns XP in this life area">
            <Chips value={h.area || null} onChange={(v) => set({ area: v })} options={[{ value: null, label: 'Auto' }, ...Object.entries(AREAS).map(([k, a]) => ({ value: k, label: a.label }))]} />
          </Field>
        )}

        {isBuild && (
          <>
            <Field label="How often">
              <Seg value={h.freq} onChange={(v) => set({ freq: v })} options={[{ value: 'daily', label: 'Daily' }, { value: 'days', label: 'Specific days' }, { value: 'weekly', label: 'X / week' }]} />
            </Field>
            {h.freq === 'days' && <DayPicker value={h.days} onChange={(v) => set({ days: v })} />}
            {h.freq === 'weekly' && <Field label="Times per week"><Stepper value={h.perWeek} min={1} max={7} onChange={(v) => set({ perWeek: v })} /></Field>}
            <div className="grid-2">
              <Field label={h.freq === 'weekly' ? 'Target per session' : 'Daily target'}><Stepper value={h.target} min={1} onChange={(v) => set({ target: v })} /></Field>
              <Field label="Unit"><input className="input" placeholder="glass, min, page" value={h.unit} onChange={(e) => set({ unit: e.target.value })} /></Field>
            </div>
            {h.target > 1 && <Field label="Each tap adds" hint="E.g. tap = 1 glass, or tap = 5 minutes"><Stepper value={h.step || 1} min={1} max={h.target} onChange={(v) => set({ step: v })} /></Field>}
          </>
        )}

        {isBuild && (
          <div className="card flat">
            <div className="row between">
              <div><div className="h3">Auto from steps</div><div className="small muted">Health Connect marks it done</div></div>
              <Toggle on={!!h.autoSteps} onChange={(v) => set({ autoSteps: v, stepGoal: h.stepGoal || 8000 })} />
            </div>
            {h.autoSteps && <div className="mt-12"><Chips value={h.stepGoal || 8000} onChange={(v) => set({ stepGoal: v })} options={[5000, 6000, 8000, 10000, 12000].map((v) => ({ value: v, label: `${v / 1000}k steps` }))} /></div>}
          </div>
        )}
        <div className="card flat">
          <div className="row between">
            <div><div className="h3">Reminders</div><div className="small muted">Notifications in the Android app</div></div>
            <Toggle on={h.reminder} onChange={(v) => set({ reminder: v })} />
          </div>
          {h.reminder && (
            <div className="col mt-16">
              <Seg value={h.intervalMins ? 'interval' : 'once'} onChange={(v) => set(v === 'interval' ? { intervalMins: 60, windowStart: h.windowStart || '08:00', windowEnd: h.windowEnd || '22:00' } : { intervalMins: null })} options={[{ value: 'once', label: 'Once a day' }, { value: 'interval', label: 'Repeat through day' }]} />
              {h.intervalMins ? (
                <>
                  <Field label="Every">
                    <Chips value={h.intervalMins} onChange={(v) => set({ intervalMins: v })} options={[{ value: 30, label: '30 min' }, { value: 60, label: '1 hr' }, { value: 90, label: '1.5 hr' }, { value: 120, label: '2 hr' }, { value: 180, label: '3 hr' }]} />
                  </Field>
                  <div className="grid-2">
                    <Field label="From"><input type="time" className="input" value={h.windowStart} onChange={(e) => set({ windowStart: e.target.value })} /></Field>
                    <Field label="Until"><input type="time" className="input" value={h.windowEnd} onChange={(e) => set({ windowEnd: e.target.value })} /></Field>
                  </div>
                </>
              ) : (
                <Field label="At"><input type="time" className="input" value={h.reminderTime} onChange={(e) => set({ reminderTime: e.target.value })} /></Field>
              )}
            </div>
          )}
        </div>

        <button className="btn ghost" onClick={() => setAdv(!adv)}>{adv ? 'Hide' : 'More'} options</button>
        {adv && (
          <>
            {isBuild && h.freq === 'daily' && <Field label="Active days" hint="Leave all on for every day"><DayPicker value={h.days} onChange={(v) => set({ days: v })} /></Field>}
            {isBuild && !h.reminder && (
              <div className="grid-2">
                <Field label="Active from"><input type="time" className="input" value={h.windowStart} onChange={(e) => set({ windowStart: e.target.value })} /></Field>
                <Field label="Until"><input type="time" className="input" value={h.windowEnd} onChange={(e) => set({ windowEnd: e.target.value })} /></Field>
              </div>
            )}
            {isBuild && h.freq !== 'weekly' && <Field label="Grace misses per week" hint="Missed days allowed before you're 'off track'"><Stepper value={h.grace || 0} min={0} max={6} onChange={(v) => set({ grace: v })} /></Field>}
            <div className="grid-2">
              <Field label="Start date"><input type="date" className="input" value={h.startDate} onChange={(e) => set({ startDate: e.target.value })} /></Field>
              <Field label="End date"><input type="date" className="input" value={h.endDate} onChange={(e) => set({ endDate: e.target.value })} /></Field>
            </div>
            <Field label="Linked goal">
              <select className="select" value={h.goalId || ''} onChange={(e) => set({ goalId: e.target.value ? Number(e.target.value) : null })}>
                <option value="">None</option>
                {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
            </Field>
            <Field label="Notes"><textarea className="textarea" value={h.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Why this matters, tips…" /></Field>
          </>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   HABIT DETAIL + STATS
   ========================================================= */
export function HabitDetail({ id }) {
  const { push, pop, toast } = useApp();
  const [period, setPeriod] = useState('month');
  const [del, setDel] = useState(false);
  const [relapse, setRelapse] = useState(false);
  const data = useLiveQuery(async () => {
    const h = await db.habits.get(id);
    if (!h) return { h: null };
    const logs = h.type === 'build' ? await db.habitLogs.where('habitId').equals(id).toArray() : [];
    const urges = h.type === 'break' ? await db.urges.where('habitId').equals(id).toArray() : [];
    return { h, logs, urges };
  }, [id]);
  if (!data) return <div className="screen no-nav" />;
  const { h, logs, urges } = data;
  if (!h) return <div className="screen no-nav"><TopBar title="" /><Empty title="Habit not found" /></div>;
  const [from, to] = periodRange(period);
  const menu = (
    <div className="row gap-6">
      <button className="icon-btn" onClick={() => push('HabitForm', { id })} aria-label="Edit"><Pencil size={18} /></button>
      <button className="icon-btn" onClick={() => setDel(true)} aria-label="Delete"><Trash2 size={18} /></button>
    </div>
  );
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="" right={menu} />
      <div className="row gap-14 mb-16">
        <div className="swatch" style={{ width: 56, height: 56, fontSize: 26, borderRadius: 18, background: `color-mix(in srgb, ${h.color} 20%, transparent)` }}><HIcon icon={h.icon} size={26} color={h.color} /></div>
        <div className="grow">
          <h1 className="h2">{h.name}</h1>
          <div className="small muted">{h.type === 'build' ? describe(h) : 'Breaking this habit'}</div>
        </div>
      </div>
      {h.type === 'build' ? <BuildStats h={h} logs={logs} period={period} setPeriod={setPeriod} from={from} to={to} /> : <BreakStats h={h} urges={urges} period={period} setPeriod={setPeriod} from={from} to={to} onRelapse={() => setRelapse(true)} />}
      {h.notes && <div className="card mt-16 small dim">{h.notes}</div>}
      <button className="btn block mt-24" onClick={async () => { await db.habits.update(id, { archived: true }); toast('Archived'); pop(); }}><Archive size={16} /> Archive habit</button>
      <Confirm open={del} onClose={() => setDel(false)} title="Delete this habit?" body="All its history will be removed. Archive instead to keep stats." onConfirm={async () => {
        await db.habits.delete(id); await db.habitLogs.where('habitId').equals(id).delete(); await db.urges.where('habitId').equals(id).delete(); pop();
      }} />
      <RelapseSheet open={relapse} onClose={() => setRelapse(false)} habit={h} />
    </div>
  );
}

function describe(h) {
  const f = h.freq === 'weekly' ? `${h.perWeek}× a week` : h.freq === 'days' ? daysLabel(h.days) : 'Every day';
  const tg = h.target > 1 ? ` · ${h.target} ${h.unit || ''}` : h.unit ? ` · ${h.target} ${h.unit}` : '';
  const w = h.intervalMins ? ` · every ${h.intervalMins >= 60 ? h.intervalMins / 60 + 'h' : h.intervalMins + 'm'}, ${fmtHM(h.windowStart)}–${fmtHM(h.windowEnd)}` : '';
  return f + tg + w;
}
const daysLabel = (d = []) => [1, 2, 3, 4, 5, 6, 0].filter((x) => d.includes(x)).map((x) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][x]).join(', ');

function BuildStats({ h, logs, period, setPeriod, from, to }) {
  const [editDay, setEditDay] = useState(null);
  const s = buildStats(h, logs, from, to);
  const st = streak(h, logs);
  const g = graceStatus(h, logs);
  const adh = intervalAdherence(h, logs, from, to > today() ? today() : to);
  const byDate = sumByDate(logs);
  const heat = {};
  Object.entries(byDate).forEach(([d, v]) => (heat[d] = Math.min(1, v / (h.target || 1))));
  const trend = buckets(period).map((b) => {
    if (b.from > today()) return { label: b.label, value: null };
    const x = buildStats(h, logs, b.from, b.to);
    return { label: b.label, value: x.dueCount ? Math.round(x.rate * 100) : null };
  });
  const hours = logs.filter((l) => l.date >= from && l.date <= to).map((l) => new Date(l.ts).getHours());
  const t = today();
  const amt = byDate[t] || 0;
  return (
    <>
      <div className="card row gap-14">
        <Ring size={64} stroke={7} value={amt / (h.target || 1)} color={h.color}><span className="small num" style={{ fontWeight: 700 }}>{amt}</span></Ring>
        <div className="grow">
          <div className="h3">Today</div>
          <div className="small muted">{amt}/{h.target} {h.unit || (h.target === 1 ? 'done' : '')}</div>
        </div>
        <button className="icon-btn" onClick={async () => { const ls = await db.habitLogs.where('[habitId+date]').equals([h.id, t]).toArray(); const last = ls.sort((a, b) => b.ts - a.ts)[0]; if (last) { tap(); await db.habitLogs.delete(last.id); } }} aria-label="Undo"><Minus size={18} /></button>
        <button className="icon-btn" style={{ background: h.color, color: '#000' }} onClick={async () => { await db.habitLogs.add({ habitId: h.id, date: t, ts: Date.now(), amount: h.step || 1 }); success(); }} aria-label="Log"><Plus size={18} /></button>
      </div>

      <div className="mt-16"><PeriodToggle value={period} onChange={setPeriod} /></div>
      <div className="grid-3 mt-12">
        <Stat v={pct(s.rate)} k="Completion" color={h.color} />
        <Stat v={`${st.current}${st.unit}`} k="Streak" sub={`best ${st.best}${st.unit}`} />
        {adh != null ? <Stat v={pct(adh)} k="On schedule" /> : g ? <Stat v={g.onTrack ? 'On track' : 'Off track'} k={`${g.misses}/${g.grace} misses`} color={g.onTrack ? 'var(--good)' : 'var(--warn)'} /> : <Stat v={s.doneCount} k="Sessions" />}
      </div>

      <div className="card mt-12">
        <div className="h3 mb-12">Consistency</div>
        <Heatmap values={heat} color={h.color} weeks={18} onPick={setEditDay} />
        <div className="tiny muted mt-8">Tap a day to fix a missed log.</div>
      </div>
      <div className="card mt-12">
        <div className="h3 mb-12">Completion trend</div>
        <Bars data={trend} color={h.color} format={(v) => v + '%'} max={100} />
      </div>
      {hours.length > 2 && (
        <div className="card mt-12">
          <div className="h3">When you actually do it</div>
          <div className="small muted mb-12">{h.windowStart ? `Scheduled ${fmtHM(h.windowStart)}–${fmtHM(h.windowEnd)}` : 'Time of day'}</div>
          <HourHist hours={hours} color={h.color} />
        </div>
      )}
      <Sheet open={!!editDay} onClose={() => setEditDay(null)} title={editDay ? fmtDay(editDay) : ''}>
        {editDay && <DayEditor h={h} date={editDay} amount={byDate[editDay] || 0} />}
      </Sheet>
    </>
  );
}

function DayEditor({ h, date, amount }) {
  const setAmt = async (v) => {
    const ls = await db.habitLogs.where('[habitId+date]').equals([h.id, date]).toArray();
    await db.habitLogs.bulkDelete(ls.map((l) => l.id));
    if (v > 0) {
      const d = new Date(date + 'T12:00:00');
      await db.habitLogs.add({ habitId: h.id, date, ts: d.getTime(), amount: v });
    }
  };
  return (
    <div className="col">
      <Stepper value={amount} min={0} max={999} onChange={setAmt} suffix={h.unit ? ' ' + h.unit : ''} />
      <div className="small muted center">Target {h.target} {h.unit}</div>
    </div>
  );
}

/* ---------- Break stats ---------- */
function BreakStats({ h, urges, period, setPeriod, from, to, onRelapse }) {
  const { push } = useApp();
  const s = breakStats(urges, from, to);
  const all = breakStats(urges);
  const days = all.sinceDays;
  const trend = buckets(period).map((b) => ({ label: b.label, value: b.from > today() ? null : breakStats(urges, b.from, b.to).relapses }));
  const triggerItems = Object.entries(s.triggers).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, value: v, color: h.color }));
  const relapseTs = urges.filter((u) => (u.kind === 'relapse' || u.outcome === 'relapsed') && u.date >= from && u.date <= to).map((u) => u.ts);
  const recent = [...urges].sort((a, b) => b.ts - a.ts).slice(0, 8);
  return (
    <>
      <div className="hero center">
        <div className="glow" style={{ background: h.color, left: '50%', marginLeft: -110, top: -120 }} />
        <div className="eyebrow">Since last relapse</div>
        <div className="big-num num mt-8" style={{ fontSize: 52 }}>{days == null ? '—' : days < 1 ? `${Math.floor(days * 24)}h` : `${Math.floor(days)}d`}</div>
        {all.avgGap != null && <div className="small muted mt-4">avg gap {all.avgGap.toFixed(1)} days</div>}
        <div className="row mt-16">
          <button className="btn grow primary" onClick={() => push('Urge', { habitId: h.id })}>Having an urge</button>
          <button className="btn grow" onClick={onRelapse}>Log relapse</button>
        </div>
      </div>
      <div className="mt-16"><PeriodToggle value={period} onChange={setPeriod} /></div>
      <div className="grid-3 mt-12">
        <Stat v={pct(s.control)} k="Control rate" color={h.color} sub={`${s.resisted}/${s.urges} urges`} />
        <Stat v={s.relapses} k="Relapses" />
        <Stat v={all.delayStreak} k="Delay streak" sub="resisted in a row" />
      </div>
      <div className="card mt-12">
        <div className="h3">Relapses over time</div>
        <div className="small muted mb-12">Goal: trending down</div>
        <Bars data={trend} color={h.color} showValues />
      </div>
      <div className="card mt-12">
        <div className="h3 mb-12">Triggers before relapse</div>
        <HBars items={triggerItems} />
      </div>
      {relapseTs.length > 0 && (
        <div className="card mt-12">
          <div className="h3 mb-12">When it’s hardest</div>
          <WeekHourGrid events={relapseTs} color={h.color} />
        </div>
      )}
      {recent.length > 0 && (
        <div className="section">
          <SectionHead title="Recent" />
          <div className="list">
            {recent.map((u) => (
              <div key={u.id} className="list-item">
                <span className="pill-dot" style={{ background: u.kind === 'urge' && u.outcome === 'resisted' ? 'var(--good)' : 'var(--bad)' }} />
                <div className="grow">
                  <div className="small" style={{ fontWeight: 560 }}>{u.kind === 'urge' ? (u.outcome === 'resisted' ? 'Urge resisted' : 'Urge → relapsed') : 'Relapse'}{u.trigger ? ` · ${u.trigger}` : ''}</div>
                  <div className="tiny muted">{fmtDay(u.date)} {fmtTime(u.ts)}{u.severity ? ` · intensity ${u.severity}/3` : ''}{u.notes ? ` · ${u.notes}` : ''}</div>
                </div>
                <button className="icon-btn sm ghost" onClick={() => db.urges.delete(u.id)} aria-label="Remove"><X size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function RelapseSheet({ open, onClose, habit }) {
  const { settings, toast } = useApp();
  const [trigger, setTrigger] = useState(null);
  const [severity, setSeverity] = useState(null);
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [when, setWhen] = useState('');
  useEffect(() => { if (open) { setTrigger(null); setSeverity(null); setDuration(''); setNotes(''); const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); setWhen(d.toISOString().slice(0, 16)); } }, [open]);
  const save = async () => {
    const ts = when ? new Date(when).getTime() : Date.now();
    await db.urges.add({ habitId: habit.id, kind: 'relapse', ts, date: ymd(new Date(ts)), trigger, severity, duration: duration ? Number(duration) : null, notes });
    toast('Logged. Tomorrow is a new day');
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Log a relapse">
      <p className="small muted" style={{ marginTop: -8 }}>This is data, not a confession. It helps you spot patterns.</p>
      <div className="form">
        <Field label="What triggered it?"><TagSelect options={settings.triggers} value={trigger} onChange={setTrigger} onAdd={(t) => setKV('triggers', [...settings.triggers, t])} /></Field>
        <Field label="When"><input type="datetime-local" className="input" value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
        <div className="grid-2">
          <Field label="Duration (min)"><input className="input" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value.replace(/\D/g, ''))} placeholder="optional" /></Field>
          <Field label="Intensity"><Chips value={severity} onChange={setSeverity} options={[{ value: 1, label: 'Mild' }, { value: 2, label: 'Med' }, { value: 3, label: 'Strong' }]} /></Field>
        </div>
        <Field label="Notes"><textarea className="textarea" style={{ minHeight: 70 }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" /></Field>
        <button className="btn primary block" onClick={save}>Save</button>
      </div>
    </Sheet>
  );
}

/* =========================================================
   URGE INTERVENTION SCREEN (10-minute delay)
   ========================================================= */
const QUOTES = [
  'Urges are like waves. They rise, peak, and pass. Ride this one out.',
  'You don’t have to act on a feeling. Just watch it for 10 minutes.',
  'The urge is loudest right before it fades.',
  'You’ve waited before. You can wait now.',
  'This moment is a vote for the person you want to be.',
  'Discomfort is temporary. Regret lasts longer.',
];
export function Urge({ habitId }) {
  const { pop, settings, push, celebrate, toast } = useApp();
  const habit = useLiveQuery(() => db.habits.get(habitId), [habitId]);
  const hobbies = useLiveQuery(() => db.hobbies.toArray(), []) || [];
  const [stage, setStage] = useState('trigger'); // trigger → wait → outcome
  const [trigger, setTrigger] = useState(null);
  const [start, setStart] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  const DURATION = 10 * 60;
  useInterval(() => setNow(Date.now()), stage === 'wait' ? 500 : null);
  const elapsed = start ? (now - start) / 1000 : 0;
  const left = Math.max(0, DURATION - elapsed);
  useEffect(() => { if (stage === 'wait' && left <= 0) { success(); setStage('outcome'); } }, [left, stage]);
  const suggestion = useMemo(() => {
    const ideas = ['Go for a 5-minute walk', 'Drink a glass of water', 'Call or text a friend', 'Do 10 slow breaths', 'Step outside for fresh air', 'Do 15 push-ups', ...hobbies.map((h) => `${h.icon || ''} ${h.name}`)];
    return ideas[Math.floor(Math.random() * ideas.length)];
  }, [hobbies.length]);

  const finish = async (outcome) => {
    await db.urges.add({ habitId, kind: 'urge', outcome, ts: Date.now(), date: today(), trigger, waitedSec: Math.round(elapsed) });
    if (outcome === 'resisted') { success(); celebrate(); toast('You rode it out. That counts.'); }
    else toast('Logged. Every urge teaches you something');
    pop();
  };
  if (!habit) return <div className="timer-screen" />;
  return (
    <div className="timer-screen">
      <div className="row between">
        <span className="eyebrow row gap-6"><HIcon icon={habit.icon} size={14} color={habit.color} /> {habit.name}</span>
        <button className="icon-btn" onClick={pop} aria-label="Close"><X size={20} /></button>
      </div>
      {stage === 'trigger' && (
        <div className="col grow" style={{ justifyContent: 'center', gap: 22 }}>
          <h1 className="h1">What’s happening right now?</h1>
          <TagSelect options={settings.triggers} value={trigger} onChange={setTrigger} onAdd={(t) => setKV('triggers', [...settings.triggers, t])} />
          <button className="btn primary lg block mt-16" onClick={() => { setStart(Date.now()); setNow(Date.now()); setStage('wait'); }}>Start 10-minute wait</button>
          <button className="btn ghost" onClick={() => setStage('outcome')}>Skip the timer</button>
        </div>
      )}
      {stage === 'wait' && (
        <div className="col grow" style={{ justifyContent: 'center', alignItems: 'center', gap: 20, textAlign: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Ring size={250} stroke={6} value={elapsed / DURATION} color={habit.color || 'var(--break)'}>
              <div>
                <div className="timer-big">{fmtClock(left)}</div>
                <div className="small muted">the urge will pass</div>
              </div>
            </Ring>
          </div>
          <p className="dim" style={{ fontSize: 17, maxWidth: 320, lineHeight: 1.5 }}>{quote}</p>
          <div className="card flat row gap-10" style={{ width: '100%' }}>
            <Wind size={18} color="var(--bored)" />
            <div className="grow small" style={{ textAlign: 'left' }}><span className="muted">Meanwhile, try:</span> <b>{suggestion}</b></div>
          </div>
          <div className="row" style={{ width: '100%' }}>
            <button className="btn grow" onClick={() => push('Breathe', { pattern: 'sigh', minutes: 1 })}>Breathe</button>
            <button className="btn grow" onClick={() => push('Boredom', { fromUrge: true })}>Boredom kit</button>
            <button className="btn grow" onClick={() => setStage('outcome')}>I’m done</button>
          </div>
        </div>
      )}
      {stage === 'outcome' && (
        <div className="col grow" style={{ justifyContent: 'center', gap: 14 }}>
          <h1 className="h1">{left <= 0 ? '10 minutes. You made it.' : 'How did it go?'}</h1>
          <p className="dim">Be honest — both answers help you learn your patterns.</p>
          <button className="btn primary lg block mt-16" onClick={() => finish('resisted')}>I resisted 💪</button>
          <button className="btn lg block" onClick={() => finish('relapsed')}>I gave in</button>
        </div>
      )}
    </div>
  );
}
