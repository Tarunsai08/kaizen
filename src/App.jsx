import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sun, Repeat2, Dumbbell, Wallet, ListChecks, Check } from 'lucide-react';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { db, seed, DEFAULT_SETTINGS } from './db';
import { AppCtx } from './ctx';
import { Confetti } from './ui/kit';
import ErrorBoundary from './ui/ErrorBoundary';
import { isNative, tap, SmsReader, platform } from './lib/native';
import { rollRecurring, completeTask } from './lib/logic';
import { rescheduleSoon, registerActions, ensurePermission } from './lib/notify';
import { today, nowHM } from './lib/date';

import Today from './screens/Today';
import { Habits, HabitForm, HabitDetail, Urge } from './screens/Habits';
import { Body, Workout, ActivityForm, PresetForm, ScheduleEdit, Library, SleepLog, SleepStats, FitnessStats } from './screens/Fitness';
import { Money, TxForm, MoneyInsights, Subscriptions, SmsImport, TagReview, AllTx } from './screens/Money';
import { Plan, TaskForm, GoalForm, GoalDetail, GoalReview, Projects } from './screens/Plan';
import { Boredom, Sites, Hobbies, BoredStats } from './screens/Boredom';
import { NightReview, Morning, JournalHistory, JournalDay, Insights, WeeklyReview, MoodStats } from './screens/Journal';
import { Me, Settings, CategoriesEdit } from './screens/Me';

const SCREENS = {
  HabitForm, HabitDetail, Urge,
  Workout, ActivityForm, PresetForm, ScheduleEdit, Library, SleepLog, SleepStats, FitnessStats,
  TxForm, MoneyInsights, Subscriptions, SmsImport, TagReview, AllTx,
  TaskForm, GoalForm, GoalDetail, GoalReview, Projects,
  Boredom, Sites, Hobbies, BoredStats,
  NightReview, Morning, JournalHistory, JournalDay, Insights, WeeklyReview, MoodStats,
  Me, Settings, CategoriesEdit,
};
const TABS = [
  { key: 'today', label: 'Today', icon: Sun, C: Today },
  { key: 'habits', label: 'Habits', icon: Repeat2, C: Habits },
  { key: 'body', label: 'Body', icon: Dumbbell, C: Body },
  { key: 'money', label: 'Money', icon: Wallet, C: Money },
  { key: 'plan', label: 'Plan', icon: ListChecks, C: Plan },
];

export default function App() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('today');
  const [stack, setStack] = useState([]);
  const [toastMsg, setToastMsg] = useState(null);
  const [confetti, setConfetti] = useState(0);
  const toastTimer = useRef();

  useEffect(() => {
    (async () => {
      await seed();
      await rollRecurring();
      setReady(true);
    })();
  }, []);

  const kv = useLiveQuery(() => db.kv.toArray(), []);
  const settings = useMemo(() => {
    const s = { ...DEFAULT_SETTINGS };
    (kv || []).forEach((r) => (s[r.key] = r.value));
    return s;
  }, [kv]);

  // theme
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.content = settings.theme === 'light' ? '#f4f4f1' : '#000000';
    if (isNative) {
      StatusBar.setStyle({ style: settings.theme === 'light' ? Style.Light : Style.Dark }).catch(() => {});
      StatusBar.setBackgroundColor({ color: settings.theme === 'light' ? '#f4f4f1' : '#000000' }).catch(() => {});
    }
  }, [settings.theme]);

  const push = useCallback((name, props = {}) => { tap(); setStack((s) => [...s, { name, props, key: Math.random() }]); }, []);
  const pop = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const reset = useCallback(() => setStack([]), []);
  const toast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2200);
  }, []);
  const celebrate = useCallback(() => setConfetti((c) => c + 1), []);
  const goTab = useCallback((k) => { tap(); setTab(k); setStack([]); }, []);

  // Android back button
  const stateRef = useRef();
  stateRef.current = { stack, tab };
  useEffect(() => {
    if (!isNative) return;
    const h = CapApp.addListener('backButton', () => {
      const { stack, tab } = stateRef.current;
      if (document.querySelector('.sheet-backdrop')) {
        document.querySelector('.sheet-backdrop').click();
      } else if (stack.length) setStack((s) => s.slice(0, -1));
      else if (tab !== 'today') setTab('today');
      else CapApp.exitApp();
    });
    return () => { h.then((x) => x.remove()); };
  }, []);

  // Notifications: permission, action handlers, reschedule when data changes
  useEffect(() => {
    if (!ready) return;
    ensurePermission();
    registerActions(async (action, extra) => {
      if (extra.kind === 'task' && action === 'done') {
        const t = await db.tasks.get(extra.taskId);
        if (t) await completeTask(t, true);
      } else if (extra.kind === 'goal') {
        if (action === 'yes' || action === 'tap') push('GoalDetail', { id: extra.goalId, checkin: true });
        else if (action === 'no') await db.goalCheckins.add({ goalId: extra.goalId, date: today(), ts: Date.now(), response: 'no' });
      } else if (extra.kind === 'habit') {
        const h = await db.habits.get(extra.habitId);
        if (h && action === 'log' && h.type === 'build') await db.habitLogs.add({ habitId: h.id, date: today(), ts: Date.now(), amount: 1 });
        else if (h) push('HabitDetail', { id: h.id });
      } else if (extra.kind === 'route') {
        if (extra.route === 'night') push('NightReview');
        else if (extra.route === 'morning') push('Morning');
        else if (extra.route === 'goals') { setTab('plan'); }
      }
    });
  }, [ready]);
  // Links shared into the app (Chrome → Share → Kaizen) become boredom websites
  useEffect(() => {
    if (!ready || platform !== 'android') return;
    const check = async () => {
      try {
        const r = await SmsReader.getSharedText();
        const m = r?.text && r.text.match(/https?:\/\/\S+/);
        if (m) {
          let name = r.subject || '';
          if (!name) { try { name = new URL(m[0]).hostname.replace(/^www\./, ''); } catch {} }
          push('Sites', { prefill: { name, url: m[0], tag: 'Fun', note: '' } });
        }
      } catch {}
    };
    check();
    const h = CapApp.addListener('resume', check);
    return () => { h.then((x) => x.remove()); };
  }, [ready]);

  const sig = useLiveQuery(async () => {
    const [h, t, g] = await Promise.all([db.habits.toArray(), db.tasks.filter((x) => !x.done).toArray(), db.goals.toArray()]);
    return JSON.stringify([h.map((x) => [x.id, x.reminder, x.reminderTime, x.intervalMins, x.windowStart, x.windowEnd, x.days, x.archived, x.name]), t.map((x) => [x.id, x.due, x.dueTime, x.reminder]), g.map((x) => [x.id, x.status, x.checkinFreq, x.checkinTime])]);
  }, []);
  useEffect(() => { if (ready && sig) rescheduleSoon(); }, [sig, ready, settings.bedtimeTarget, settings.morningReminder, settings.notifications]);

  const ctx = useMemo(() => ({ push, pop, reset, toast, celebrate, settings, goTab, tab }), [push, pop, reset, toast, celebrate, settings, goTab, tab]);

  if (!ready || !kv) {
    return <div className="app" style={{ display: 'grid', placeItems: 'center' }}><div className="h2" style={{ opacity: 0.4 }}>kaizen</div></div>;
  }

  const top = stack[stack.length - 1];
  const TabC = TABS.find((t) => t.key === tab).C;
  const Pushed = top ? SCREENS[top.name] : null;

  return (
    <AppCtx.Provider value={ctx}>
      <div className="app">
        {/* keep tab mounted underneath so scroll position survives */}
        <div style={{ display: Pushed ? 'none' : 'contents' }}>
          <ErrorBoundary key={tab} onBack={() => setTab('today')}><TabC /></ErrorBoundary>
        </div>
        {stack.map((e, i) => {
          const C = SCREENS[e.name];
          return (
            <div key={e.key} style={{ display: i === stack.length - 1 ? 'contents' : 'none' }}>
              <ErrorBoundary onBack={pop}><C {...e.props} /></ErrorBoundary>
            </div>
          );
        })}
        {!Pushed && (
          <nav className="nav">
            {TABS.map((t) => (
              <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => goTab(t.key)}>
                <t.icon size={22} strokeWidth={tab === t.key ? 2.4 : 2} />
                {t.label}
              </button>
            ))}
          </nav>
        )}
        {toastMsg && <div className="toast" key={toastMsg + Math.random()}><Check size={16} />{toastMsg}</div>}
        <Confetti show={confetti} />
      </div>
    </AppCtx.Provider>
  );
}
