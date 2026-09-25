import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sun, Repeat2, HeartPulse, Wallet, CalendarCheck, Check } from 'lucide-react';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { db, seed, DEFAULT_SETTINGS, setKV } from './db';
import { AppCtx } from './ctx';
import { Confetti, Sheet } from './ui/kit';
import ErrorBoundary from './ui/ErrorBoundary';
import { isNative, tap, Kaizen, platform, success } from './lib/native';
import { rollRecurring, completeTask, setFrozenDays } from './lib/logic';
import { maintainFreezes, computeXP, stageFor } from './lib/xp';
import { syncShieldEvents, pushShieldConfig } from './lib/screen';
import { hcSync } from './lib/health';
import { updateWidgets } from './lib/widgets';
import { rescheduleSoon, registerActions, ensurePermission } from './lib/notify';
import { today, nowHM } from './lib/date';

import Today from './screens/Today';
import { Habits, HabitForm, HabitDetail, Urge } from './screens/Habits';
import { Workout, ActivityForm, PresetForm, ScheduleEdit, Library, SleepLog, SleepStats, FitnessStats } from './screens/Fitness';
import { Money, TxForm, MoneyInsights, Subscriptions, SmsImport, TagReview, AllTx, importMessages } from './screens/Money';
import { parseSms } from './lib/sms';
import { Plan, TaskForm, GoalForm, GoalDetail, GoalReview, Projects } from './screens/Plan';
import { Boredom, Sites, Hobbies, BoredStats } from './screens/Boredom';
import { NightReview, Morning, JournalHistory, JournalDay, Insights, WeeklyReview, MoodStats } from './screens/Journal';
import { Settings, CategoriesEdit } from './screens/Me';
import { Health } from './screens/Health';
import { MoodCheckin, Breathe, ReframeList, Reframe, Wheel } from './screens/Mind';
import { Focus, FocusStats } from './screens/Focus';
import { PersonDetail } from './screens/People';
import { You, CompanionScreen, YearPixels, Wrapped } from './screens/You';
import { AppLimit, ShieldSettings, Pause } from './screens/ScreenTime';
import Onboarding from './screens/Onboarding';
import Companion from './ui/Companion';

const SCREENS = {
  HabitForm, HabitDetail, Urge,
  Workout, ActivityForm, PresetForm, ScheduleEdit, Library, SleepLog, SleepStats, FitnessStats,
  TxForm, MoneyInsights, Subscriptions, SmsImport, TagReview, AllTx,
  TaskForm, GoalForm, GoalDetail, GoalReview, Projects,
  Boredom, Sites, Hobbies, BoredStats,
  NightReview, Morning, JournalHistory, JournalDay, Insights, WeeklyReview, MoodStats,
  Me: You, You, Settings, CategoriesEdit,
  MoodCheckin, Breathe, ReframeList, Reframe, Wheel, Focus, FocusStats, PersonDetail,
  CompanionScreen, YearPixels, Wrapped, AppLimit, ShieldSettings, Pause,
};
const TABS = [
  { key: 'today', label: 'Today', icon: Sun, C: Today },
  { key: 'plan', label: 'Plan', icon: CalendarCheck, C: Plan },
  { key: 'habits', label: 'Habits', icon: Repeat2, C: Habits },
  { key: 'health', label: 'Health', icon: HeartPulse, C: Health },
  { key: 'money', label: 'Money', icon: Wallet, C: Money },
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

  // streak freezes: keep logic module in sync, run the daily check
  useEffect(() => { setFrozenDays(settings.frozenDays); }, [settings.frozenDays]);
  useEffect(() => { if (ready && kv) maintainFreezes(settings); }, [ready, !!kv]);

  // level-up celebration
  const xp = useLiveQuery(() => (ready ? computeXP() : null), [ready]);
  const [levelUp, setLevelUp] = useState(null);
  useEffect(() => {
    if (!xp || !kv) return;
    const last = settings.lastLevel || 1;
    if (xp.total.level > last) { setLevelUp(xp.total.level); setConfetti((c) => c + 1); success(); }
    if (xp.total.level !== last) setKV('lastLevel', xp.total.level);
  }, [xp?.total.level]);

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
        else if (extra.route === 'person') push('PersonDetail', { id: extra.id });
      }
    });
  }, [ready]);
  // Links shared into the app (Chrome → Share → Kaizen) become boredom websites
  useEffect(() => {
    if (!ready || platform !== 'android') return;
    const check = async () => {
      try {
        const r = await Kaizen.getSharedText();
        if (!r?.text) return;
        // Bank SMS shared from Messages → transactions (several messages may come separated by blank lines)
        const parts = r.text.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
        const txMsgs = parts.filter((x) => parseSms(x));
        if (txMsgs.length) {
          const n = await importMessages(txMsgs.map((body, i) => ({ body, date: Date.now() - i * 1000 })));
          toast(n ? `Added ${n} transaction${n > 1 ? 's' : ''}` : 'Already added');
          if (n) push('TagReview');
          return;
        }
        const m = r.text.match(/https?:\/\/\S+/);
        if (m) {
          let name = r.subject || '';
          if (!name) { try { name = new URL(m[0]).hostname.replace(/^www\./, ''); } catch {} }
          push('Sites', { prefill: { name, url: m[0], tag: 'Fun', note: '' } });
        }
      } catch {}
    };
    // Widget / app-shortcut / Shield launches, e.g. kaizen://mood/4, kaizen://bored, kaizen://pause?pkg=…
    const action = async () => {
      try {
        const r = await Kaizen.getLaunchAction();
        if (r?.action) handleAction(r.action);
      } catch {}
    };
    const onResume = () => { check(); action(); syncShieldEvents(); if (settingsRef.current.healthConnect) hcSync(2); };
    check(); action(); syncShieldEvents();
    const h = CapApp.addListener('resume', onResume);
    return () => { h.then((x) => x.remove()); };
  }, [ready]);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const handleAction = useCallback(async (url) => {
    const u = url.replace(/^kaizen:\/\//, '');
    const [path, query] = u.split('?');
    const q = Object.fromEntries(new URLSearchParams(query || ''));
    const [a, b] = path.split('/');
    if (a === 'mood' && b) { await db.moods.add({ date: today(), ts: Date.now(), mood: Number(b), tags: [], kind: 'widget' }); success(); toast('Mood logged'); setStack([]); setTab('today'); }
    else if (a === 'checkin') push('MoodCheckin');
    else if (a === 'bored') push('Boredom');
    else if (a === 'breathe') push('Breathe', {});
    else if (a === 'focus') push('Focus', {});
    else if (a === 'urge') { setStack([]); setTab('habits'); }
    else if (a === 'expense') push('TxForm', {});
    else if (a === 'task') push('TaskForm', { due: today() });
    else if (a === 'pause' && q.pkg) push('Pause', { pkg: q.pkg, label: q.label });
    else if (a === 'today') { setStack([]); setTab('today'); }
  }, []);

  // keep native Shield config + widgets current
  useEffect(() => { if (ready) pushShieldConfig({ ...(settings.shield || {}), limits: settings.screenLimits || {} }); }, [ready, settings.shield, settings.screenLimits]);
  const widgetSig = useLiveQuery(async () => {
    if (!ready) return null;
    const t = today();
    const [logs, moods, tasks] = await Promise.all([db.habitLogs.where('date').equals(t).count(), db.moods.where('date').equals(t).count(), db.tasks.filter((x) => x.done).count()]);
    return `${logs}|${moods}|${tasks}|${JSON.stringify(settings.scores?.[t])}|${xp?.total.level}`;
  }, [ready, settings.scores, xp?.total.level]);
  useEffect(() => { if (ready && widgetSig) updateWidgets(settings, xp); }, [widgetSig]);

  const sig = useLiveQuery(async () => {
    const [h, t, g] = await Promise.all([db.habits.toArray(), db.tasks.filter((x) => !x.done).toArray(), db.goals.toArray()]);
    const [pp, ii] = await Promise.all([db.people.toArray(), db.interactions.count()]);
    return JSON.stringify([h.map((x) => [x.id, x.reminder, x.reminderTime, x.intervalMins, x.windowStart, x.windowEnd, x.days, x.archived, x.name]), t.map((x) => [x.id, x.due, x.dueTime, x.reminder]), g.map((x) => [x.id, x.status, x.checkinFreq, x.checkinTime]), pp.map((x) => [x.id, x.every]), ii]);
  }, []);
  useEffect(() => { if (ready && sig) rescheduleSoon(); }, [sig, ready, settings.bedtimeTarget, settings.morningReminder, settings.notifications]);

  const ctx = useMemo(() => ({ push, pop, reset, toast, celebrate, settings, goTab, tab }), [push, pop, reset, toast, celebrate, settings, goTab, tab]);

  if (!ready || !kv) {
    return <div className="app" style={{ display: 'grid', placeItems: 'center' }}><div className="h2" style={{ opacity: 0.4 }}>kaizen</div></div>;
  }

  if (!settings.onboarded) {
    return (
      <AppCtx.Provider value={ctx}>
        <div className="app"><OnboardGate /></div>
      </AppCtx.Provider>
    );
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
                <span className="pill"><t.icon size={21} strokeWidth={tab === t.key ? 2.3 : 1.9} /></span>
                {t.label}
              </button>
            ))}
          </nav>
        )}
        {toastMsg && <div className="toast" key={toastMsg + Math.random()}><Check size={16} />{toastMsg}</div>}
        <Confetti show={confetti} />
        <Sheet open={!!levelUp} onClose={() => setLevelUp(null)}>
          <div className="col" style={{ alignItems: 'center', textAlign: 'center', gap: 8, padding: '10px 0 6px' }}>
            <div className="float"><Companion stage={stageFor(levelUp || 1).index} mood="happy" size={130} /></div>
            <div className="eyebrow" style={{ color: 'var(--accent)' }}>Level up</div>
            <h2 className="h1">Level {levelUp}</h2>
            <p className="dim" style={{ margin: 0 }}>{settings.companionName || 'Kai'} is now a {stageFor(levelUp || 1).name.toLowerCase()}. Every small action adds up.</p>
            <button className="btn primary block mt-16" onClick={() => setLevelUp(null)}>Keep going</button>
          </div>
        </Sheet>
      </div>
    </AppCtx.Provider>
  );
}

function OnboardGate() {
  const [done, setDone] = useState(false);
  // Existing users (data from v1) skip onboarding automatically
  useEffect(() => { (async () => { if ((await db.habits.count()) > 0) await setKV('onboarded', true); })(); }, []);
  if (done) return null;
  return <Onboarding onDone={() => setDone(true)} />;
}
