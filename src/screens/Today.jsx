import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Sparkles, Moon, Sunrise, Wind, ChevronRight, Dumbbell, User, Wallet, Smile, CheckSquare, Flame, Repeat2 } from 'lucide-react';
import { db, setKV } from '../db';
import { useApp } from '../ctx';
import { today, greeting, dow, fmtHM, hmToMin, addDays, lastNDays, weekStart, DAYS_SHORT, MONTHS, parse } from '../lib/date';
import { computeDay, habitDueOn, checkinDueToday, money, sumByDate } from '../lib/logic';
import { MultiRing, MoodScale, Sheet, TagSelect, Scale5, MOODS } from '../ui/kit';
import { HabitRow, BreakRow, TaskRow, GoalCard, SectionHead } from '../ui/rows';
import { success } from '../lib/native';

export default function Today() {
  const { push, settings, toast, goTab } = useApp();
  const t = today();
  const [fab, setFab] = useState(false);
  const [moodSheet, setMoodSheet] = useState(null);

  const data = useLiveQuery(async () => {
    const [habits, logs, urges, tasks, goals, checkins, moods, sleepToday, journal, txToday, untagged, workouts, projects] = await Promise.all([
      db.habits.filter((h) => !h.archived).toArray(),
      db.habitLogs.where('date').between(addDays(t, -7), t, true, true).toArray(),
      db.urges.toArray(),
      db.tasks.filter((x) => !x.skipped).toArray(),
      db.goals.where('status').equals('active').toArray(),
      db.goalCheckins.toArray(),
      db.moods.where('date').equals(t).toArray(),
      db.sleep.where('date').equals(t).first(),
      db.journal.where('date').equals(t).first(),
      db.transactions.where('date').equals(t).toArray(),
      db.transactions.where('tagged').equals(0).count(),
      db.workouts.where('date').equals(t).toArray(),
      db.projects.toArray(),
    ]);
    const day = await computeDay(t, settings);
    return { habits, logs, urges, tasks, goals, checkins, moods, sleepToday, journal, txToday, untagged, workouts, projects, day };
  }, [t, settings.schedule]);

  // momentum: consecutive days with score >= 60
  const scores = settings.scores || {};
  useEffect(() => {
    if (!data) return;
    if (scores[t] !== data.day.score) {
      const next = { ...scores, [t]: data.day.score };
      const keys = Object.keys(next).sort();
      if (keys.length > 800) keys.slice(0, keys.length - 800).forEach((k) => delete next[k]);
      setKV('scores', next);
    }
  }, [data?.day.score]);

  if (!data) return <div className="screen" />;
  const { habits, logs, urges, tasks, goals, checkins, moods, sleepToday, journal, txToday, untagged, workouts, projects, day } = data;

  let momentum = 0;
  for (let d = (scores[t] ?? day.score) >= 60 ? t : addDays(t, -1); (d === t ? day.score : scores[d]) >= 60; d = addDays(d, -1)) momentum++;

  const build = habits.filter((h) => h.type === 'build' && habitDueOn(h, t));
  const breaks = habits.filter((h) => h.type === 'break');
  const todayTasks = tasks.filter((x) => (!x.done && x.due && x.due <= t) || (x.done && x.doneAt && new Date(x.doneAt).toDateString() === new Date().toDateString() && x.due === t)).sort((a, b) => (a.done - b.done) || (a.due || '').localeCompare(b.due || ''));
  const lastCheck = {};
  checkins.forEach((c) => { if (!lastCheck[c.goalId] || c.date > lastCheck[c.goalId]) lastCheck[c.goalId] = c.date; });
  const needsReview = goals.filter((g) => g.periodEnd && g.periodEnd < t);
  const typeOrder = { weekly: 0, monthly: 1, yearly: 2, casual: 3 };
  const goalList = goals.filter((g) => !(g.periodEnd && g.periodEnd < t)).sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);

  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const bed = hmToMin(settings.bedtimeTarget || '23:00');
  const showMorning = !sleepToday?.wakeTs && mins >= 240 && mins < 780;
  const showNight = !journal && (mins >= Math.max(1080, bed - 180) || mins < 180);
  const sched = (settings.schedule || {})[dow(t)] || [];
  const workoutDone = workouts.some((w) => w.completed);
  const spent = txToday.filter((x) => x.direction === 'debit').reduce((a, b) => a + b.amount, 0);
  const lastMood = moods.sort((a, b) => b.ts - a.ts)[0];
  const d = parse(t);

  const quickMood = async (v) => {
    const id = await db.moods.add({ date: t, ts: Date.now(), mood: v, tags: [], kind: 'quick' });
    success();
    setMoodSheet({ id, mood: v, tags: [], energy: null });
  };

  return (
    <div className="screen fade-in">
      {/* Header */}
      <div className="row between" style={{ marginBottom: 18, marginTop: 4 }}>
        <div>
          <div className="eyebrow">{DAYS_SHORT[d.getDay()]} · {d.getDate()} {MONTHS[d.getMonth()]}</div>
          <h1 className="h1 mt-4">{greeting()}{settings.name ? `, ${settings.name}` : ''}</h1>
        </div>
        <button className="icon-btn" onClick={() => push('Me')} aria-label="You"><User size={20} /></button>
      </div>

      {/* Day score */}
      <div className="hero">
        <div className="glow" style={{ background: 'var(--accent)', right: -80, top: -90 }} />
        <div className="row gap-18">
          <div style={{ position: 'relative' }}>
            <MultiRing rings={day.rings.map((r) => ({ value: r.value ?? 0, color: r.value == null ? 'var(--faint)' : r.color }))} size={128} stroke={10} gap={3} />
          </div>
          <div className="grow">
            <div className="eyebrow">Day score</div>
            <div className="row gap-6" style={{ alignItems: 'baseline' }}>
              <span className="big-num num" style={{ fontSize: 44 }}>{day.score}</span>
              {momentum > 1 && <span className="badge" style={{ color: 'var(--fit)' }}><Flame size={12} />{momentum}d</span>}
            </div>
            <div className="col gap-4 mt-8">
              {day.rings.map((r) => (
                <div key={r.key} className="row gap-6 small">
                  <span className="pill-dot" style={{ background: r.value == null ? 'var(--faint)' : r.color }} />
                  <span className="dim grow">{r.label}</span>
                  <span className="num muted">{r.value == null ? '—' : r.key === 'habits' ? `${Math.round(day.habitsDone * 10) / 10}/${day.habitsDue}` : r.key === 'tasks' ? `${day.tasksDone}/${day.tasksTotal}` : `${Math.round(r.value * 100)}%`}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Contextual prompts */}
      {showMorning && (
        <button className="card card-press row gap-14 mt-12" style={{ width: '100%', textAlign: 'left' }} onClick={() => push('Morning')}>
          <div className="swatch" style={{ background: 'color-mix(in srgb, var(--goal) 18%, transparent)' }}><Sunrise size={20} color="var(--goal)" /></div>
          <div className="grow"><div className="h3">Morning check-in</div><div className="small muted">Wake time, sleep quality & today’s plan</div></div>
          <ChevronRight size={18} className="muted" />
        </button>
      )}
      {showNight && (
        <button className="card card-press row gap-14 mt-12" style={{ width: '100%', textAlign: 'left' }} onClick={() => push('NightReview')}>
          <div className="swatch" style={{ background: 'color-mix(in srgb, var(--sleep) 18%, transparent)' }}><Moon size={20} color="var(--sleep)" /></div>
          <div className="grow"><div className="h3">Night review</div><div className="small muted">2 minutes to close the day{untagged ? ` · ${untagged} to tag` : ''}</div></div>
          <ChevronRight size={18} className="muted" />
        </button>
      )}
      {needsReview.length > 0 && (
        <button className="card card-press row gap-14 mt-12" style={{ width: '100%', textAlign: 'left' }} onClick={() => push('GoalReview')}>
          <div className="swatch" style={{ background: 'color-mix(in srgb, var(--goal) 18%, transparent)' }}>🏁</div>
          <div className="grow"><div className="h3">Review {needsReview.length} finished goal{needsReview.length > 1 ? 's' : ''}</div><div className="small muted">Achieved? Carry over or archive</div></div>
          <ChevronRight size={18} className="muted" />
        </button>
      )}

      {/* Goals strip */}
      {goalList.length > 0 && (
        <div className="section">
          <SectionHead title="Goals" link="All" onLink={() => goTab('plan')} />
          <div className="scroll-x">
            {goalList.map((g) => <GoalCard key={g.id} g={g} tasks={tasks} checkinDue={checkinDueToday(g, lastCheck[g.id])} />)}
          </div>
        </div>
      )}

      {/* Mood */}
      <div className="section">
        <SectionHead title="How are you feeling?" link={lastMood ? `Last: ${MOODS[lastMood.mood - 1].e}` : 'History'} onLink={() => push('MoodStats')} />
        <div className="card"><MoodScale value={null} onChange={quickMood} /></div>
      </div>

      {/* Habits */}
      {(build.length > 0 || breaks.length > 0) ? (
        <div className="section">
          <SectionHead title="Habits" link="Manage" onLink={() => goTab('habits')} />
          <div className="col gap-6">
            {build.map((h) => <HabitRow key={h.id} h={h} logs={logs.filter((l) => l.habitId === h.id)} />)}
            {breaks.map((h) => <BreakRow key={h.id} h={h} urges={urges.filter((u) => u.habitId === h.id)} />)}
          </div>
        </div>
      ) : (
        <button className="card card-press row gap-14 mt-24" style={{ width: '100%', textAlign: 'left' }} onClick={() => push('HabitForm', {})}>
          <div className="swatch" style={{ background: 'color-mix(in srgb, var(--habit) 18%, transparent)' }}><Repeat2 size={20} color="var(--habit)" /></div>
          <div className="grow"><div className="h3">Add your first habit</div><div className="small muted">Something to build, or something to break</div></div>
          <Plus size={18} className="muted" />
        </button>
      )}

      {/* Workout */}
      {(sched.length > 0 || workouts.length > 0) && (
        <div className="section">
          <SectionHead title="Move" />
          <button className="card card-press row gap-14" style={{ width: '100%', textAlign: 'left' }} onClick={() => push('Workout', { date: t })}>
            <div className="swatch" style={{ background: 'color-mix(in srgb, var(--fit) 18%, transparent)' }}><Dumbbell size={20} color="var(--fit)" /></div>
            <div className="grow">
              <div className="h3">{workoutDone ? 'Workout done' : 'Today’s session'}</div>
              <WorkoutSummary sched={sched} workouts={workouts} />
            </div>
            {workoutDone ? <span className="badge" style={{ color: 'var(--good)' }}>✓</span> : <span className="btn sm primary">Start</span>}
          </button>
        </div>
      )}

      {/* Tasks */}
      <div className="section">
        <SectionHead title="Tasks" link="Plan" onLink={() => goTab('plan')} />
        <div className="list">
          {todayTasks.map((x) => <TaskRow key={x.id} t={x} showDate={x.due !== t} projects={projects} goals={goals} />)}
          <button className="list-item muted" onClick={() => push('TaskForm', { due: t })}>
            <Plus size={18} /> <span className="small" style={{ fontWeight: 550 }}>{todayTasks.length ? 'Add task' : 'Nothing due today — add a task'}</span>
          </button>
        </div>
      </div>

      {/* Money + bored */}
      <div className="grid-2 section">
        <button className="card card-press" style={{ textAlign: 'left' }} onClick={() => goTab('money')}>
          <Wallet size={18} color="var(--money)" />
          <div className="h2 mt-8 num">{money(spent, settings.currency)}</div>
          <div className="small muted">spent today{untagged ? ` · ${untagged} untagged` : ''}</div>
        </button>
        <button className="card card-press" style={{ textAlign: 'left', background: 'color-mix(in srgb, var(--bored) 14%, var(--surface))' }} onClick={() => push('Boredom')}>
          <Wind size={18} color="var(--bored)" />
          <div className="h2 mt-8">I’m bored</div>
          <div className="small muted">Pick something on purpose</div>
        </button>
      </div>

      <button className="card card-press row gap-14 mt-12" style={{ width: '100%', textAlign: 'left' }} onClick={() => push('Insights')}>
        <div className="swatch" style={{ background: 'color-mix(in srgb, var(--accent) 16%, transparent)' }}><Sparkles size={18} color="var(--accent)" /></div>
        <div className="grow"><div className="h3">Insights</div><div className="small muted">Patterns across sleep, mood, money & habits</div></div>
        <ChevronRight size={18} className="muted" />
      </button>

      <button className="fab" onClick={() => setFab(true)} aria-label="Quick add"><Plus size={28} strokeWidth={2.5} /></button>

      <Sheet open={fab} onClose={() => setFab(false)} title="Quick add">
        <div className="grid-3">
          {[
            { l: 'Mood', i: Smile, c: 'var(--mood)', a: () => push('MoodStats', { log: true }) },
            { l: 'Task', i: CheckSquare, c: 'var(--task)', a: () => push('TaskForm', { due: t }) },
            { l: 'Expense', i: Wallet, c: 'var(--money)', a: () => push('TxForm', {}) },
            { l: 'Urge', i: Flame, c: 'var(--break)', a: () => goTab('habits') },
            { l: 'Bored', i: Wind, c: 'var(--bored)', a: () => push('Boredom') },
            { l: 'Habit', i: Repeat2, c: 'var(--habit)', a: () => push('HabitForm', {}) },
            { l: 'Workout', i: Dumbbell, c: 'var(--fit)', a: () => push('Workout', { date: t }) },
            { l: 'Sleep', i: Moon, c: 'var(--sleep)', a: () => push('SleepLog', {}) },
            { l: 'Journal', i: Sparkles, c: 'var(--goal)', a: () => push('NightReview') },
          ].map((x) => (
            <button key={x.l} className="card flat card-press col" style={{ alignItems: 'center', gap: 8, padding: '18px 8px' }} onClick={() => { setFab(false); x.a(); }}>
              <x.i size={22} color={x.c} />
              <span className="small" style={{ fontWeight: 600 }}>{x.l}</span>
            </button>
          ))}
        </div>
      </Sheet>

      <MoodDetailSheet state={moodSheet} onClose={() => { setMoodSheet(null); toast('Mood logged'); }} emotions={settings.emotions} />
    </div>
  );
}

function WorkoutSummary({ sched, workouts }) {
  const presets = useLiveQuery(() => db.presets.toArray(), []) || [];
  const w = workouts[0];
  if (w) return <div className="small muted">{w.entries.map((e) => `${presets.find((p) => p.id === e.presetId)?.name || '?'} L${e.level}`).join(' + ')}</div>;
  return <div className="small muted ellipsis">{sched.map((s) => `${presets.find((p) => p.id === s.presetId)?.name || '?'} (L${s.level})`).join(' + ')}</div>;
}

export function MoodDetailSheet({ state, onClose, emotions }) {
  const [tags, setTags] = useState([]);
  const [energy, setEnergy] = useState(null);
  useEffect(() => { setTags([]); setEnergy(null); }, [state?.id]);
  if (!state) return null;
  const save = async () => {
    await db.moods.update(state.id, { tags, energy });
    onClose();
  };
  const addEmotion = async (e) => setKV('emotions', [...(emotions || []), e]);
  return (
    <Sheet open onClose={save} title={`Feeling ${MOODS[state.mood - 1].label.toLowerCase()} ${MOODS[state.mood - 1].e}`}>
      <div className="label mb-8">What’s behind it? <span className="muted">(optional)</span></div>
      <TagSelect options={emotions || []} value={tags} onChange={setTags} multi onAdd={addEmotion} />
      <div className="label mt-24 mb-8">Energy</div>
      <Scale5 value={energy} onChange={setEnergy} color="var(--goal)" labels={['Drained', 'Charged']} />
      <button className="btn primary block mt-24" onClick={save}>Save</button>
    </Sheet>
  );
}
