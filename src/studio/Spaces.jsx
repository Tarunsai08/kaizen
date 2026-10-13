// Spaces: one Notion-style home for everything that isn't Today, Plan, Focus or Study.
import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Repeat2, HeartPulse, Wallet, BookOpen, Flag, Users, FolderKanban, Lightbulb, Brain, Wind, Sparkles,
  CalendarRange, Smile, Grid3x3, Gift, Cog, ChevronRight, Search, X, ChevronLeft, Clock, BarChart3,
} from 'lucide-react';
import { db, getKV, setKV } from '../db';
import { useApp } from '../ctx';
import { today, addDays, MONTHS } from '../lib/date';
import { habitDueOn, money } from '../lib/logic';
import { tap } from '../lib/native';
import { Habits } from '../screens/Habits';
import { Health } from '../screens/Health';
import { GoalsView } from '../screens/Plan';
import { PeopleView } from '../screens/People';
import { Learnings } from '../screens/Learnings';
import Companion from '../ui/Companion';
import { stageFor } from '../lib/xp';
import { useXP } from '../screens/You';
import './spaces.css';

/* Pages shown inside a Space screen (back arrow + the page itself). Others open their own screens. */
const PAGES = {
  habits: { title: 'Habits', C: () => <Habits embedded /> },
  health: { title: 'Health', C: () => <Health embedded /> },
  goals: { title: 'Goals', C: () => <><div className="titlebar"><h1 className="h1">Goals</h1></div><GoalsView /></> },
  people: { title: 'People', C: () => <><div className="titlebar"><h1 className="h1">People</h1></div><PeopleView /></> },
  learnings: { title: 'Learnings', C: () => <><div className="titlebar"><h1 className="h1">Learnings</h1></div><Learnings /></> },
};

export function SpaceScreen({ k }) {
  const { pop } = useApp();
  const P = PAGES[k];
  if (!P) return null;
  return (
    <div className="screen no-nav page-enter sp-page">
      <div className="sp-crumb">
        <button className="icon-btn ghost" onClick={pop} aria-label="Back"><ChevronLeft size={22} /></button>
        <span>Spaces</span><ChevronRight size={13} /><b>{P.title}</b>
      </div>
      <P.C />
    </div>
  );
}

/* Remember the last few spaces you opened, for "Jump back in". */
async function remember(key) {
  const r = (await getKV('recentSpaces', [])).filter((x) => x !== key);
  await setKV('recentSpaces', [key, ...r].slice(0, 6));
}

export function Spaces() {
  const { push, settings, goTab } = useApp();
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const xp = useXP();
  const t = today();
  const mod = (k) => settings.modules?.[k] !== false;
  const d = useLiveQuery(async () => {
    const [habits, logs, tx, journal, goals, people, inter, cards, recent, projects, tasks] = await Promise.all([
      db.habits.filter((h) => !h.archived && h.type === 'build').toArray(),
      db.habitLogs.where('date').equals(t).toArray(),
      db.transactions.where('date').equals(t).toArray(),
      db.journal.where('date').equals(t).first(),
      db.goals.where('status').equals('active').count(),
      db.people.toArray(),
      db.interactions.toArray(),
      db.cards.where('due').belowOrEqual(t).count(),
      getKV('recentSpaces', []),
      db.projects.toArray(),
      db.tasks.filter((x) => !x.done && !!x.projectId).toArray(),
    ]);
    const due = habits.filter((h) => habitDueOn(h, t));
    const by = {}; logs.forEach((l) => (by[l.habitId] = (by[l.habitId] || 0) + (l.amount || 1)));
    const hDone = due.filter((h) => (by[h.id] || 0) >= (h.target || 1)).length;
    const peopleDue = people.filter((p) => {
      const last = inter.filter((i) => i.personId === p.id).map((i) => i.date).sort().pop();
      return !last || last <= addDays(t, -Math.max(1, p.every || 7));
    }).length;
    const spent = tx.filter((x) => x.direction === 'debit').reduce((a, b) => a + b.amount, 0);
    return { hDone, hN: due.length, spent, journal: !!journal, goals, peopleDue, people: people.length, cards, recent, projects: projects.length, openProjTasks: tasks.length };
  }, [t]);

  const open = (it) => { tap(); remember(it.k); it.go(); };
  const S = (k) => () => push('Space', { k });
  const groups = [
    { h: 'Daily life', items: [
      { k: 'habits', l: 'Habits', i: Repeat2, c: 'var(--habit)', s: d ? (d.hN ? `${d.hDone} of ${d.hN} done today` : 'Nothing due today') : '', go: S('habits') },
      { k: 'health', l: 'Health', i: HeartPulse, c: 'var(--fit)', s: 'Move · Sleep · Mind', go: S('health') },
      mod('money') && { k: 'money', l: 'Money', i: Wallet, c: 'var(--money)', s: d ? `${money(d.spent, settings.currency)} spent today` : '', go: () => push('MoneyScreen') },
      mod('journal') && { k: 'journal', l: 'Journal', i: BookOpen, c: 'var(--goal)', s: d?.journal ? 'Today is written' : 'Today’s page is empty', go: () => push('JournalHistory') },
    ] },
    { h: 'Plans & people', items: [
      { k: 'goals', l: 'Goals', i: Flag, c: 'var(--goal)', s: d ? `${d.goals} active` : '', go: S('goals') },
      { k: 'projects', l: 'Projects', i: FolderKanban, c: 'var(--task)', s: d ? `${d.projects} project${d.projects === 1 ? '' : 's'} · ${d.openProjTasks} open to-dos` : '', go: () => push('Projects') },
      mod('people') && { k: 'people', l: 'People', i: Users, c: 'var(--mood)', s: d ? (d.peopleDue ? `${d.peopleDue} to reach out to` : `${d.people} in touch`) : '', go: S('people') },
    ] },
    { h: 'Learn & grow', items: [
      mod('study') && { k: 'learnings', l: 'Learnings', i: Lightbulb, c: 'var(--goal)', s: 'Ideas, nuggets, experiments', go: S('learnings') },
      mod('study') && { k: 'revise', l: 'Revise', i: Brain, c: 'var(--task)', s: d ? (d.cards ? `${d.cards} card${d.cards > 1 ? 's' : ''} due` : 'All caught up') : '', go: () => push('ReviewDeck') },
      mod('boredom') && { k: 'bored', l: 'Boredom kit', i: Wind, c: 'var(--bored)', s: 'Do something on purpose', go: () => push('Boredom') },
    ] },
    { h: 'Reflect', items: [
      { k: 'insights', l: 'Insights', i: Sparkles, c: 'var(--accent)', s: 'Patterns across your life', go: () => push('Insights') },
      { k: 'weekly', l: 'Weekly review', i: CalendarRange, c: 'var(--sleep)', s: 'Look back, plan ahead', go: () => push('WeeklyReview') },
      { k: 'mood', l: 'Mood', i: Smile, c: 'var(--mood)', s: 'Trends & feelings', go: () => push('MoodStats') },
      { k: 'planstats', l: 'Planner insights', i: BarChart3, c: 'var(--accent)', s: 'Planned vs done, best hours', go: () => push('PlannerInsights') },
      { k: 'pixels', l: 'Year in pixels', i: Grid3x3, c: 'var(--habit)', s: 'Every day, one square', go: () => push('YearPixels') },
      { k: 'wrapped', l: `${MONTHS[new Date().getMonth()]} Wrapped`, i: Gift, c: 'var(--fit)', s: 'Your month as a story', go: () => push('Wrapped') },
    ] },
  ].map((g) => ({ ...g, items: g.items.filter(Boolean) }));
  const all = groups.flatMap((g) => g.items);
  const recent = (d?.recent || []).map((k) => all.find((x) => x.k === k)).filter(Boolean).slice(0, 4);
  const hits = q.trim() ? all.filter((x) => (x.l + ' ' + x.s).toLowerCase().includes(q.trim().toLowerCase())) : null;
  const lvl = xp?.total.level || 1;

  return (
    <div className="screen fade-in spc">
      <div className="sp-ws">
        <button className="sp-me" onClick={() => push('You')}>
          <span className="av"><Companion stage={stageFor(lvl).index} mood="ok" size={30} /></span>
          <span className="grow"><b>{settings.name ? `${settings.name}’s space` : 'Your space'}</b><small>Level {lvl} · everything in one place</small></span>
        </button>
        <button className="icon-btn ghost" onClick={() => push('Settings')} aria-label="Settings"><Cog size={20} /></button>
      </div>

      <h1 className="sp-title">Spaces</h1>
      <label className={`sp-search ${searching ? 'on' : ''}`}>
        <Search size={17} />
        <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setSearching(true)} onBlur={() => setSearching(false)} placeholder="Search pages" />
        {q && <button onClick={() => setQ('')} aria-label="Clear"><X size={16} /></button>}
      </label>

      {hits ? (
        <div className="sp-group">
          {hits.length ? hits.map((it) => <Row key={it.k} it={it} onClick={() => open(it)} />) : <div className="sp-none">No page called “{q}”.</div>}
        </div>
      ) : (
        <>
          {recent.length > 0 && (
            <>
              <div className="sp-h"><Clock size={13} /> Jump back in</div>
              <div className="sp-recent">
                {recent.map((it) => (
                  <button key={it.k} className="sp-card" style={{ '--c': it.c }} onClick={() => open(it)}>
                    <span className="cover" />
                    <span className="ic"><it.i size={18} /></span>
                    <b>{it.l}</b>
                    <small className="ellipsis">{it.s}</small>
                  </button>
                ))}
              </div>
            </>
          )}
          {groups.map((g) => g.items.length > 0 && (
            <section key={g.h}>
              <div className="sp-h">{g.h}</div>
              <div className="sp-group">{g.items.map((it) => <Row key={it.k} it={it} onClick={() => open(it)} />)}</div>
            </section>
          ))}
          <div className="sp-h">You</div>
          <div className="sp-group">
            <Row it={{ l: 'Profile & levels', i: Sparkles, c: 'var(--accent)', s: 'Companion, XP, streak freezes' }} onClick={() => push('You')} />
            <Row it={{ l: 'Settings', i: Cog, c: 'var(--text-2)', s: 'Look, reminders, backup' }} onClick={() => push('Settings')} />
            <Row it={{ l: 'Plan my day', i: CalendarRange, c: 'var(--accent)', s: 'Open the day timeline' }} onClick={() => goTab('plan')} />
          </div>
        </>
      )}
    </div>
  );
}

function Row({ it, onClick }) {
  return (
    <button className="sp-row" style={{ '--c': it.c }} onClick={onClick}>
      <span className="ic"><it.i size={17} /></span>
      <span className="grow tx"><b>{it.l}</b>{it.s && <small className="ellipsis">{it.s}</small>}</span>
      <ChevronRight size={16} className="chev" />
    </button>
  );
}
