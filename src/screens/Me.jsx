import { PL_COLORS } from '../lib/plcolor';
import StylePicker from '../studio/StylePicker';
import { isStudio, journeyOn } from '../studio/mode';
import React, { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BookOpen, Sparkles, CalendarDays, Smile, Wind, Globe, Palette, Settings as Cog, ChevronRight, Download, Upload, Lock, Bell, Moon, Sun, Tags, Trash2, Repeat } from 'lucide-react';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { LocalNotifications } from '@capacitor/local-notifications';
import { db, setKV, exportAll, importAll } from '../db';
import { useApp } from '../ctx';
import { today, fmtHM } from '../lib/date';
import { TODAY_LAYOUTS } from './today/index';
import { PlannerSettings } from './planner/Setup';
import { TopBar, Field, Sheet, Seg, Toggle, Stat, Confirm, EmojiPicker, ColorPicker, Chips } from '../ui/kit';
import { isNative, success } from '../lib/native';
import { rescheduleAll, ensurePermission, notifyNow } from '../lib/notify';

export function Me() {
  const { push, settings } = useApp();
  const counts = useLiveQuery(async () => ({
    journal: await db.journal.count(), habits: await db.habits.count(), workouts: await db.workouts.filter((w) => w.completed).count(), tasks: await db.tasks.filter((t) => t.done).count(),
  }), []);
  const scores = settings.scores || {};
  const good = Object.values(scores).filter((s) => s >= 60).length;
  const items = [
    { l: 'Journal', s: 'JournalHistory', i: BookOpen, c: 'var(--mood)' },
    { l: 'Insights', s: 'Insights', i: Sparkles, c: 'var(--accent)' },
    { l: 'Weekly review', s: 'WeeklyReview', i: CalendarDays, c: 'var(--goal)' },
    { l: 'Mood', s: 'MoodStats', i: Smile, c: 'var(--mood)' },
    { l: 'Boredom kit', s: 'Boredom', i: Wind, c: 'var(--bored)' },
    { l: 'Boredom stats', s: 'BoredStats', i: Wind, c: 'var(--bored)' },
    { l: 'Websites', s: 'Sites', i: Globe, c: 'var(--money)' },
    { l: 'Hobbies', s: 'Hobbies', i: Palette, c: 'var(--fit)' },
    { l: 'Subscriptions', s: 'Subscriptions', i: Repeat, c: 'var(--task)' },
    { l: 'Settings', s: 'Settings', i: Cog, c: 'var(--text-2)' },
  ];
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="" />
      <div className="row gap-14">
        <div className="swatch" style={{ width: 60, height: 60, borderRadius: 20, fontSize: 26, background: 'var(--accent)', color: 'var(--accent-ink)', fontWeight: 800 }}>{(settings.name || 'K')[0].toUpperCase()}</div>
        <div><h1 className="h2">{settings.name || 'You'}</h1><div className="small muted">1% better, every day</div></div>
      </div>
      <div className="grid-4 mt-16">
        <Stat v={good} k="Good days" color="var(--accent)" />
        <Stat v={counts?.journal ?? '·'} k="Entries" />
        <Stat v={counts?.workouts ?? '·'} k="Workouts" />
        <Stat v={counts?.tasks ?? '·'} k="Tasks" />
      </div>
      <div className="list mt-16">
        {items.map((x) => (
          <button key={x.l} className="list-item" onClick={() => push(x.s)}>
            <x.i size={19} color={x.c} />
            <span className="grow" style={{ fontWeight: 560 }}>{x.l}</span>
            <ChevronRight size={16} className="muted" />
          </button>
        ))}
      </div>
    </div>
  );
}

export { Settings } from './settings/Settings';
const minus = (hm, m) => { const [h, mm] = hm.split(':').map(Number); const t = (h * 60 + mm - m + 1440) % 1440; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };

export function CategoriesEdit() {
  const [kind, setKind] = useState('habit');
  const cats = useLiveQuery(() => db.categories.where('kind').equals(kind).toArray(), [kind]) || [];
  const [edit, setEdit] = useState(null);
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="Categories" right={<button className="btn sm" onClick={() => setEdit({ kind, name: '', icon: '•', color: '#a78bfa', needWant: 'need' })}>Add</button>} />
      <div className="chips mb-16">
        {[['habit', 'Habits'], ['finance', 'Spending'], ['income', 'Income'], ['task', 'Tasks'], ['goal', 'Goals']].map(([k, l]) => <button key={k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>{l}</button>)}
      </div>
      <div className="list">
        {cats.map((c) => (
          <button key={c.id} className="list-item" onClick={() => setEdit(c)}>
            <span style={{ fontSize: 20 }}>{c.icon}</span><span className="grow" style={{ fontWeight: 560 }}>{c.name}</span>
            {kind === 'finance' && <span className="badge">{c.needWant}</span>}
          </button>
        ))}
      </div>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit category' : 'New category'}>
        {edit && (
          <div className="form">
            <Field label="Name"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Icon"><input className="input" value={edit.icon} maxLength={4} onChange={(e) => setEdit({ ...edit, icon: e.target.value })} /></Field>
            <ColorPicker value={edit.color} onChange={(v) => setEdit({ ...edit, color: v })} />
            {edit.kind === 'finance' && <Field label="Default"><Seg value={edit.needWant} onChange={(v) => setEdit({ ...edit, needWant: v })} options={[{ value: 'need', label: 'Need' }, { value: 'want', label: 'Want' }]} /></Field>}
            <div className="row">
              {edit.id && <button className="btn danger" onClick={async () => { await db.categories.delete(edit.id); setEdit(null); }}><Trash2 size={16} /></button>}
              <button className="btn primary grow" onClick={async () => { if (!edit.name) return; if (edit.id) await db.categories.put(edit); else await db.categories.add(edit); setEdit(null); }}>Save</button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
