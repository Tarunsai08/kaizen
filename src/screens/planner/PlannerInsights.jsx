import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight } from 'lucide-react';
import { TopBar } from '../../ui/kit';
import { db, getKV, DEFAULT_SETTINGS } from '../../db';
import { useApp } from '../../ctx';
import { today, addDays, lastNDays, DAYS_SHORT, parse } from '../../lib/date';
import { sleepMinutes } from '../../lib/logic';
import { Bars, HBars } from '../../ui/charts';
import { CATEGORIES } from '../../scheduler';
import { dur, hm12 } from '../../planner/service';
import './planner.css';

const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

/** The Insights tab: four or five calm planner cards, then links to everything else. */
export function InsightsTab() {
  const { push, settings } = useApp();
  const mod = settings.modules || {};
  const t = today();
  const d = useLiveQuery(async () => {
    const from = addDays(t, -13);
    const [sessions, logs, sleep, moods, tasks, stats] = await Promise.all([
      db.plannedSessions.where('date').between(from, t, true, true).toArray(), db.workLogs.where('date').between(from, t, true, true).toArray(),
      db.sleep.where('date').between(from, t, true, true).toArray(), db.moods.where('date').between(from, t, true, true).toArray(),
      db.tasks.toArray(), getKV('plannerStats', DEFAULT_SETTINGS.plannerStats),
    ]);
    return { sessions, logs, sleep, moods, tasks, stats };
  }, [t]);
  if (!d) return <div className="screen" />;
  const days7 = lastNDays(7, t);
  const work = (s) => s.kind !== 'BREAK';
  const plannedMin = (date) => d.sessions.filter((s) => s.date === date && work(s) && s.state !== 'SKIPPED').reduce((a, s) => a + s.end - s.start, 0);
  const doneMin = (date) => d.logs.filter((l) => l.date === date).reduce((a, l) => a + l.actualMin, 0);
  const totP = days7.reduce((a, x) => a + plannedMin(x), 0), totD = days7.reduce((a, x) => a + doneMin(x), 0);

  // best focus hours: finished sessions by start hour
  const byHour = {};
  d.sessions.filter((s) => work(s) && (s.state === 'DONE' || s.state === 'PARTIAL')).forEach((s) => { const h = Math.floor(s.start / 60); byHour[h] = (byHour[h] || 0) + 1; });
  const learned = Object.entries(d.stats.energy?.hours || {}).filter(([, v]) => v.n >= 2).map(([h, v]) => ({ label: hm12(Number(h) * 60).replace(':00', ''), value: Math.round(v.s * 100), n: v.n })).sort((a, b) => b.value - a.value).slice(0, 4);
  const hourItems = (learned.length >= 2 ? learned : Object.entries(byHour).map(([h, n]) => ({ label: hm12(h * 60).replace(':00', ''), value: n })).sort((a, b) => b.value - a.value).slice(0, 4)).map((x) => ({ ...x, color: 'var(--accent)' }));

  const corr = Object.entries(d.stats.correction || {}).map(([k, v]) => ({ label: `${CATEGORIES.find((c) => c.value === k)?.label || k} ×${v.toFixed(2)}`, value: v, color: v > 1.1 ? 'var(--goal)' : v < 0.9 ? 'var(--good)' : 'var(--accent)' }));

  const skipped = d.sessions.filter((s) => work(s) && s.state === 'SKIPPED' && !s.swapped);
  const slipCount = {};
  skipped.forEach((s) => { if (s.taskId) slipCount[s.taskId] = (slipCount[s.taskId] || 0) + 1; });
  const slipped = Object.entries(slipCount).map(([id, n]) => ({ t: d.tasks.find((x) => x.id === Number(id)), n })).filter((x) => x.t).sort((a, b) => b.n - a.n).slice(0, 3);
  const overdue = d.tasks.filter((x) => !x.done && !x.skipped && x.due && x.due < t).length;

  const sleepBy = Object.fromEntries(d.sleep.map((s) => [s.date, sleepMinutes(s) / 60]));
  const moodBy = {};
  d.moods.forEach((m) => (moodBy[m.date] = moodBy[m.date] || []).push(m.mood));
  const dates = lastNDays(14, t);
  const cmp = (pred) => { const a = dates.filter(pred), b = dates.filter((x) => !pred(x) && (sleepBy[x] || moodBy[x])); return [avg(a.map(doneMin).filter((x) => x > 0)), avg(b.map(doneMin).filter((x) => x > 0)), a.length, b.length]; };
  const [sGood, sLow] = cmp((x) => sleepBy[x] >= 7);
  const [mGood, mLow] = cmp((x) => avg(moodBy[x] || []) >= 4);

  return (
    <div className="screen no-nav page-enter">
      <TopBar title="Insights" />
      <div className="card">
        <div className="row between"><div className="h3">Planned vs done</div><div className="small muted num">{dur(Math.round(totD))} of {dur(Math.round(totP))}</div></div>
        <div className="mt-12"><Bars data={days7.map((x) => ({ label: DAYS_SHORT[parse(x).getDay()][0], value: Math.round((doneMin(x) / 60) * 10) / 10 }))} color="var(--good)" height={90} format={(v) => `${v}h`} showValues /></div>
        <div className="tiny muted mt-8">Hours finished each day, last 7 days.</div>
      </div>
      <div className="card mt-12">
        <div className="h3 mb-8">Best focus hours</div>
        {hourItems.length ? <HBars items={hourItems} format={(v) => (learned.length >= 2 ? `${v}%` : `${v}×`)} /> : <div className="small muted">Finish a few sessions and your best hours show up here.</div>}
      </div>
      <div className="card mt-12">
        <div className="h3 mb-4">Estimate accuracy</div>
        <div className="tiny muted mb-8">Above ×1 means tasks take longer than guessed. The planner adjusts automatically.</div>
        {corr.length ? <HBars items={corr} format={(v) => ''} total={2.5} /> : <div className="small muted">Time a few sessions with Start and Done and this fills in.</div>}
      </div>
      <div className="card mt-12">
        <div className="h3 mb-8">What slipped</div>
        {slipped.length || overdue ? <>
          {slipped.map((x) => <div key={x.t.id} className="row between small" style={{ padding: '4px 0' }}><span className="ellipsis">{x.t.title}</span><span className="muted">skipped {x.n}×</span></div>)}
          {overdue > 0 && <div className="small dim mt-4">{overdue} task{overdue > 1 ? 's' : ''} past due.</div>}
        </> : <div className="small muted">Nothing slipped lately. Steady.</div>}
      </div>
      <div className="card mt-12">
        <div className="h3 mb-8">Sleep and mood vs focus</div>
        {sGood != null && sLow != null ? <div className="small">On days after 7h+ sleep you finished <b>{dur(Math.round(sGood))}</b> vs <b>{dur(Math.round(sLow))}</b> otherwise.</div> : <div className="small muted">Needs a week of sleep logs to compare.</div>}
        {mGood != null && mLow != null && <div className="small mt-8">On good-mood days: <b>{dur(Math.round(mGood))}</b> vs <b>{dur(Math.round(mLow))}</b>.</div>}
      </div>
      <div className="eyebrow mt-24 mb-8">More</div>
      <div className="list">
        {[['Patterns across your life', 'Insights'], ['Weekly review', 'WeeklyReview'], ['Mood trends', 'MoodStats'], mod.money !== false && ['Money', 'MoneyInsights'], ['Year in pixels', 'YearPixels'], ['Focus stats', 'FocusStats'], mod.study !== false && ['Study stats', 'StudyStats']].filter(Boolean).map(([l, s]) => (
          <button key={s} className="list-item" onClick={() => push(s)}><span className="grow" style={{ fontWeight: 540 }}>{l}</span><ChevronRight size={16} className="muted" /></button>
        ))}
      </div>
    </div>
  );
}
