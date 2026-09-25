import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Sparkles, Moon, Sunrise, Wind, ChevronRight, Dumbbell, User, Wallet, Smile, CheckSquare, Flame, Repeat2, Timer, Zap, Quote, Snowflake, Phone, Lightbulb, Brain, GraduationCap } from 'lucide-react';
import { StudyCard } from './Study';
import { ExperimentsToday } from './Learnings';
import { db, setKV } from '../db';
import { useApp } from '../ctx';
import { today, greeting, dow, fmtHM, hmToMin, addDays, lastNDays, weekStart, DAYS_SHORT, MONTHS, parse } from '../lib/date';
import { computeDay, habitDueOn, checkinDueToday, money, sumByDate } from '../lib/logic';
import { MultiRing, MoodScale, Sheet, TagSelect, Scale5, MOODS } from '../ui/kit';
import { HabitRow, BreakRow, TaskRow, GoalCard, SectionHead } from '../ui/rows';
import { success } from '../lib/native';
import { momentumUntil, stageFor } from '../lib/xp';
import { dayItems, nowNext } from '../lib/day';
import { HIcon } from '../ui/icons';
import Companion from '../ui/Companion';
import { useXP, companionMood } from './You';
import { useEnergy } from './Health';
import { personStatus, Avatar } from './People';

export default function Today() {
  const { push, settings, toast, goTab } = useApp();
  const t = today();
  const [fab, setFab] = useState(false);
  const [moodSheet, setMoodSheet] = useState(null);

  const data = useLiveQuery(async () => {
    const [habits, logs, urges, tasks, goals, checkins, moods, sleepToday, journal, txToday, untagged, workouts, projects, intention, people, inter] = await Promise.all([
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
      db.intentions.where('date').equals(t).first(),
      db.people.toArray(),
      db.interactions.toArray(),
    ]);
    const day = await computeDay(t, settings);
    const timeline = await dayItems(t, settings);
    return { habits, logs, urges, tasks, goals, checkins, moods, sleepToday, journal, txToday, untagged, workouts, projects, day, intention, people, inter, timeline };
  }, [t, settings.schedule, settings.frozenDays?.length]);
  const xp = useXP();
  const energy = useEnergy();

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
  const { habits, logs, urges, tasks, goals, checkins, moods, sleepToday, journal, txToday, untagged, workouts, projects, day, intention, people, inter, timeline } = data;

  const frozen = settings.frozenDays || [];
  const sc = { ...scores, [t]: day.score };
  const momentum = momentumUntil(sc, frozen, t) || momentumUntil(sc, frozen, addDays(t, -1));
  const restDay = frozen.includes(t);
  const duePeople = people.map((p) => ({ p, s: personStatus(p, inter) })).filter((x) => x.s.due);
  const nn = nowNext(timeline.items);

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
        <button onClick={() => push('You')} aria-label="You" style={{ position: 'relative', width: 52, height: 52, borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
          <div style={{ marginTop: 6 }}><Companion stage={xp ? stageFor(xp.total.level).index : 0} mood={companionMood(day.score)} size={44} /></div>
          {xp && <span style={{ position: 'absolute', right: 3, top: 3, minWidth: 17, height: 17, borderRadius: 9, background: 'var(--accent)', color: 'var(--accent-ink)', fontSize: 10, fontWeight: 800, display: 'grid', placeItems: 'center', padding: '0 4px' }}>{xp.total.level}</span>}
        </button>
      </div>

      {/* Day score */}
      <div className="hero">
        <div className="glow" style={{ background: 'var(--accent)', right: -80, top: -90 }} />
        <div className="row gap-18">
          <div style={{ position: 'relative' }}>
            <MultiRing rings={day.rings.map((r) => ({ value: r.value ?? 0, color: r.value == null ? 'var(--faint)' : r.color }))} size={128} stroke={10} gap={3} />
          </div>
          <div className="grow">
            <div className="eyebrow">Day score{xp?.today ? <span style={{ color: 'var(--accent)' }}> · +{xp.today} XP</span> : null}</div>
            <div className="row gap-6" style={{ alignItems: 'baseline' }}>
              <span className="big-num num" style={{ fontSize: 44 }}>{day.score}</span>
              {momentum > 1 && <span className="badge" style={{ color: 'var(--fit)' }}><Flame size={12} />{momentum}d</span>}
              {restDay && <span className="badge" style={{ color: '#7dd3fc' }}><Snowflake size={12} />rest</span>}
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

      {/* Intention */}
      {intention?.text && (
        <div className="card mt-12 row gap-12">
          <Quote size={18} color="var(--accent)" style={{ flexShrink: 0 }} />
          <div className="grow"><div className="tiny muted">Today’s intention</div><div style={{ fontWeight: 620 }}>{intention.text}</div></div>
        </div>
      )}

      {/* Now / Next (timeline) + energy */}
      <button className="card card-press mt-12" style={{ width: '100%', textAlign: 'left', padding: 0 }} onClick={() => goTab('plan')}>
        {energy && (
          <div className="row gap-10" style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
            <Zap size={16} color="var(--accent)" />
            <span className="small grow"><b>{energy.zone.label}</b>{energy.zone.untilLabel ? <span className="muted"> · until {energy.zone.untilLabel}</span> : null}</span>
            <span className="tiny muted ellipsis" style={{ maxWidth: '45%' }}>{energy.zone.tip}</span>
          </div>
        )}
        {[...(nn.cur ? [{ ...nn.cur, label: 'Now' }] : []), ...nn.next.map((x, i) => ({ ...x, label: i === 0 && !nn.cur ? 'Next' : 'Then' }))].map((it) => (
          <div key={it.key} className="row gap-12" style={{ padding: '11px 16px' }}>
            <div className="tile sm" style={{ background: `color-mix(in srgb, ${it.color} 18%, transparent)` }}><HIcon icon={it.icon} size={16} color={it.color} /></div>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="tiny muted">{it.label} · {fmtHM(it.start)}</div>
              <div className="ellipsis" style={{ fontWeight: 600 }}>{it.title}</div>
            </div>
          </div>
        ))}
        {!nn.cur && !nn.next.length && <div className="small muted" style={{ padding: '12px 16px' }}>Nothing else planned today. Enjoy the space.</div>}
      </button>

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
        <SectionHead title="How are you feeling?" link="More precise" onLink={() => push('MoodCheckin')} />
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
          {duePeople.map(({ p, s }) => (
            <button key={'p' + p.id} className="list-item" onClick={() => push('PersonDetail', { id: p.id })}>
              <Avatar p={p} size={26} />
              <div className="grow"><div style={{ fontWeight: 540 }}>Reach out to {p.name}</div><div className="tiny muted">{s.since == null ? 'Say hi' : `${s.since} days since you talked`}</div></div>
              <Phone size={15} className="muted" />
            </button>
          ))}
          <button className="list-item muted" onClick={() => push('TaskForm', { due: t })}>
            <Plus size={18} /> <span className="small" style={{ fontWeight: 550 }}>{todayTasks.length ? 'Add task' : 'Nothing due today — add a task'}</span>
          </button>
        </div>
      </div>

      {/* Study + experiments */}
      <div className="section col gap-8">
        <StudyCard />
        <ExperimentsToday />
      </div>

      {/* Money + bored */}
      <div className="grid-2 section">
        <button className="card card-press" style={{ textAlign: 'left' }} onClick={() => push('MoneyScreen')}>
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
            { l: 'Check in', i: Smile, c: 'var(--mood)', a: () => push('MoodCheckin') },
            { l: 'Task', i: CheckSquare, c: 'var(--task)', a: () => push('TaskForm', { due: t }) },
            { l: 'Expense', i: Wallet, c: 'var(--money)', a: () => push('TxForm', {}) },
            { l: 'Focus', i: Timer, c: 'var(--bored)', a: () => push('Focus', {}) },
            { l: 'Breathe', i: Wind, c: 'var(--bored)', a: () => push('Breathe', {}) },
            { l: 'Urge', i: Flame, c: 'var(--break)', a: () => goTab('habits') },
            { l: 'Workout', i: Dumbbell, c: 'var(--fit)', a: () => push('Workout', { date: t }) },
            { l: 'Sleep', i: Moon, c: 'var(--sleep)', a: () => push('SleepLog', {}) },
            { l: 'Journal', i: Sparkles, c: 'var(--goal)', a: () => push('NightReview') },
            { l: 'Learned', i: Lightbulb, c: 'var(--goal)', a: () => push('LearningForm') },
            { l: 'Revise', i: Brain, c: 'var(--task)', a: () => push('ReviewDeck') },
            { l: 'Study', i: GraduationCap, c: 'var(--task)', a: () => goTab('study') },
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
