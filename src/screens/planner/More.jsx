import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, GraduationCap, Wallet, Wind, BookOpen, Users, Smile, Cog, CalendarClock, Timer, Globe, Palette, Repeat, ChevronRight, Check, X, LayoutGrid, Sparkles } from 'lucide-react';
import { db } from '../../db';
import { useApp } from '../../ctx';
import { TopBar, SubTabs, useSub } from '../../ui/kit';
import { today } from '../../lib/date';
import { finishSession, hm12 } from '../../planner/service';
import { success } from '../../lib/native';
import { Study } from '../Study';
import { Habits } from '../Habits';
import { Health } from '../Health';
import Companion from '../../ui/Companion';
import './planner.css';

export const MODULES = [
  { key: 'study', label: 'Study', sub: 'Roadmaps, revision, learnings', icon: GraduationCap, color: 'var(--task)' },
  { key: 'money', label: 'Money', sub: 'Spending, subscriptions, SMS import', icon: Wallet, color: 'var(--money)' },
  { key: 'boredom', label: 'Boredom handler', sub: 'Things to do on purpose', icon: Wind, color: 'var(--bored)' },
  { key: 'journal', label: 'Journal', sub: 'Daily reflections and history', icon: BookOpen, color: 'var(--mood)' },
  { key: 'mind', label: 'Mind tools', sub: 'Breathing, reframing, wheel of life', icon: Smile, color: 'var(--mood)' },
  { key: 'screen', label: 'Screen time and Shield', sub: 'Limits and pauses', icon: Timer, color: 'var(--break)' },
  { key: 'people', label: 'People', sub: 'Keep in touch', icon: Users, color: 'var(--habit)' },
];
export function MoreButton() {
  const { push } = useApp();
  return <button className="icon-btn" onClick={() => push('MoreMenu')} aria-label="More" style={{ width: 44, height: 44, borderRadius: 15, background: 'var(--surface)', border: '1px solid var(--line)' }}><LayoutGrid size={19} /></button>;
}
export const useModules = () => { const { settings } = useApp(); return { on: (k) => (settings.modules || {})[k] !== false }; };

export function MoreMenu() {
  const { push, goTab, settings } = useApp();
  const m = useModules();
  const go = (name, props) => () => push(name, props);
  const rows = [
    { l: 'Insights', s: 'Planned vs done, best hours, sleep and mood', i: Sparkles, c: 'var(--pl)', a: go('PlannerInsights') },
    { l: 'Week plan', s: 'Load per day, deadlines, at-risk work', i: CalendarClock, c: 'var(--goal)', a: go('PlanWeek') },
    m.on('money') && { l: 'Money', s: 'Spending and subscriptions', i: Wallet, c: 'var(--money)', a: go('MoneyScreen') },
    m.on('boredom') && { l: 'I’m bored', s: 'Pick something on purpose', i: Wind, c: 'var(--bored)', a: go('Boredom') },
    m.on('journal') && { l: 'Journal', s: 'Reflections and history', i: BookOpen, c: 'var(--mood)', a: go('JournalHistory') },
    m.on('mind') && { l: 'Mind tools', s: 'Breathe, reframe, wheel of life', i: Smile, c: 'var(--mood)', a: go('MoodCheckin') },
    m.on('people') && { l: 'People', s: 'Keep in touch', i: Users, c: 'var(--habit)', a: () => goTab('plan') },
    m.on('boredom') && { l: 'Hobbies and websites', s: 'Your boredom kit', i: Palette, c: 'var(--fit)', a: go('Hobbies') },
    m.on('money') && { l: 'Subscriptions', s: 'What renews and when', i: Repeat, c: 'var(--task)', a: go('Subscriptions') },
    { l: 'Fixed schedule', s: 'Classes, meals, gym, sleep', i: CalendarClock, c: 'var(--pl)', a: go('FixedSchedule') },
    { l: 'Focus timer', s: 'A distraction-free session', i: Timer, c: 'var(--bored)', a: go('Focus', {}) },
    { l: 'You', s: 'Level, companion, year in pixels', i: Globe, c: 'var(--goal)', a: go('You') },
    { l: 'Settings', s: 'Planner, modules, reminders, backup', i: Cog, c: 'var(--text-2)', a: go('Settings') },
  ].filter(Boolean);
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="More" />
      <div className="list">
        {rows.map((r) => (
          <button key={r.l} className="list-item" style={{ minHeight: 60 }} onClick={r.a}>
            <div className="tile sm" style={{ background: `color-mix(in srgb, ${r.c} 16%, transparent)` }}><r.i size={17} color={r.c} /></div>
            <div className="grow"><div style={{ fontWeight: 580 }}>{r.l}</div><div className="tiny muted">{r.s}</div></div>
            <ChevronRight size={16} className="muted" />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Evening wrap-up: a one-tap checklist of today's sessions, then the night check-in. */
export function WrapUp() {
  const { push, pop, toast } = useApp();
  const t = today();
  const list = useLiveQuery(() => db.plannedSessions.where('date').equals(t).filter((s) => s.kind !== 'BREAK').sortBy('start'), [t]);
  if (!list) return <div className="screen no-nav" />;
  const open = list.filter((s) => s.state === 'PLANNED');
  const done = list.filter((s) => s.state === 'DONE' || s.state === 'PARTIAL');
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="Wrap up" />
      <div className="small dim">{done.length ? `${done.length} session${done.length > 1 ? 's' : ''} finished today. ` : ''}Tick what you did. The rest moves forward without fuss.</div>
      <div className="list mt-16">
        {open.map((s) => (
          <div key={s.id} className="list-item">
            <div className="grow"><div style={{ fontWeight: 560 }}>{s.title}</div><div className="tiny muted">{hm12(s.start)} · {s.taskTitle}</div></div>
            <button className="btn sm primary" onClick={async () => { await finishSession(s.id, 'DONE'); success(); }}><Check size={14} /> Did it</button>
            <button className="btn sm" onClick={() => finishSession(s.id, 'SKIPPED')} aria-label="Not today"><X size={14} /></button>
          </div>
        ))}
        {!open.length && <div className="list-item muted small">Nothing left to tick.</div>}
      </div>
      <button className="btn primary block mt-16" onClick={() => { pop(); setTimeout(() => push('NightReview'), 0); }}>Continue to evening check-in</button>
    </div>
  );
}
