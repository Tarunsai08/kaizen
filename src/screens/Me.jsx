import React, { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BookOpen, Sparkles, CalendarDays, Smile, Wind, Globe, Palette, Settings as Cog, ChevronRight, Download, Upload, Lock, Bell, Moon, Sun, Tags, Trash2, Repeat } from 'lucide-react';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { LocalNotifications } from '@capacitor/local-notifications';
import { db, setKV, exportAll, importAll } from '../db';
import { useApp } from '../ctx';
import { today, fmtHM } from '../lib/date';
import { TopBar, Field, Sheet, Seg, Toggle, Stat, Confirm, EmojiPicker, ColorPicker } from '../ui/kit';
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

export function Settings() {
  const { settings, toast, push } = useApp();
  const [pinSheet, setPinSheet] = useState(false);
  const [pin, setPin] = useState('');
  const [wipe, setWipe] = useState(false);
  const fileRef = useRef();
  const set = (k, v) => setKV(k, v);

  const doExport = async () => {
    const data = JSON.stringify(await exportAll());
    const name = `kaizen-backup-${today()}.json`;
    if (isNative) {
      try {
        const r = await Filesystem.writeFile({ path: name, data, directory: Directory.Cache, encoding: Encoding.UTF8 });
        await Share.share({ title: 'Kaizen backup', url: r.uri });
      } catch (e) { toast('Export failed'); }
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
      a.download = name;
      a.click();
    }
    await setKV('lastBackup', Date.now());
  };
  const doImport = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      await importAll(JSON.parse(await f.text()));
      toast('Backup restored');
      setTimeout(() => location.reload(), 600);
    } catch (err) { toast(err.message || 'Invalid file'); }
  };

  return (
    <div className="screen no-nav page-enter">
      <TopBar title="Settings" />
      <div className="form">
        <Field label="Your name"><input className="input" value={settings.name} onChange={(e) => set('name', e.target.value)} placeholder="Tarun" /></Field>
        <Field label="Theme"><Seg value={settings.theme} onChange={(v) => set('theme', v)} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]} /></Field>

        <div className="eyebrow mt-8">Sleep & daily rhythm</div>
        <div className="grid-2">
          <Field label="Target bedtime"><input type="time" className="input" value={settings.bedtimeTarget} onChange={(e) => set('bedtimeTarget', e.target.value)} /></Field>
          <Field label="Target wake"><input type="time" className="input" value={settings.wakeTarget} onChange={(e) => set('wakeTarget', e.target.value)} /></Field>
        </div>
        <Field label="Night review reminder" hint={`Fires at ${fmtHM(minus(settings.bedtimeTarget, settings.nightReviewLead))}`}>
          <Seg value={settings.nightReviewLead} onChange={(v) => set('nightReviewLead', v)} options={[{ value: 15, label: '15m before' }, { value: 30, label: '30m' }, { value: 60, label: '1h' }]} />
        </Field>
        <Field label="Morning check-in reminder"><input type="time" className="input" value={settings.morningReminder} onChange={(e) => set('morningReminder', e.target.value)} /></Field>

        <div className="eyebrow mt-8">Notifications</div>
        <div className="card flat row between">
          <div className="row gap-10"><Bell size={18} /><div><div style={{ fontWeight: 600 }}>Reminders</div><div className="small muted">{isNative ? 'Habits, tasks, goals, night review' : 'Available in the Android app'}</div></div></div>
          <Toggle on={settings.notifications} onChange={async (v) => { await set('notifications', v); if (v) await ensurePermission(); rescheduleAll(); }} />
        </div>
        {isNative && <button className="btn" onClick={async () => { await ensurePermission(); await notifyNow('Kaizen', 'Notifications are working ✓'); }}>Send a test notification</button>}
        {isNative && <button className="btn" onClick={async () => { try { await LocalNotifications.changeExactNotificationSetting(); } catch { toast('Not needed on this Android version'); } }}>Allow on-time reminders (alarms)</button>}
        {isNative && <div className="small muted">On Poco / HyperOS: App info → Autostart ON and Battery saver → No restrictions, or reminders can be delayed.</div>}

        <div className="eyebrow mt-8">Privacy</div>
        <div className="card flat row between">
          <div className="row gap-10"><Lock size={18} /><div><div style={{ fontWeight: 600 }}>Journal lock</div><div className="small muted">{settings.journalLock ? 'PIN required for journal' : 'Off'}</div></div></div>
          <Toggle on={!!settings.journalLock} onChange={(v) => { if (v) { setPin(''); setPinSheet(true); } else set('journalLock', ''); }} />
        </div>

        <div className="eyebrow mt-8">Data</div>
        <Field label="Currency symbol"><input className="input" value={settings.currency} maxLength={3} onChange={(e) => set('currency', e.target.value)} /></Field>
        <button className="btn" onClick={() => push('CategoriesEdit')}><Tags size={16} /> Edit categories</button>
        <div className="grid-2">
          <button className="btn" onClick={doExport}><Download size={16} /> Backup</button>
          <button className="btn" onClick={() => fileRef.current.click()}><Upload size={16} /> Restore</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={doImport} />
        <div className="small muted">All data lives only on this phone. Back up regularly{settings.lastBackup ? ` · last ${new Date(settings.lastBackup).toLocaleDateString()}` : ''}.</div>
        <button className="btn danger mt-16" onClick={() => setWipe(true)}><Trash2 size={16} /> Erase everything</button>
        <div className="tiny muted center mt-16">Kaizen v1.0 · local-first · made for Tarun</div>
      </div>

      <Sheet open={pinSheet} onClose={() => setPinSheet(false)} title="Set a 4-digit PIN">
        <input className="input center" style={{ fontSize: 28, letterSpacing: 16, height: 64 }} inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} autoFocus />
        <button className="btn primary block mt-16" disabled={pin.length !== 4} onClick={() => { set('journalLock', pin); setPinSheet(false); success(); toast('Journal locked'); }}>Save PIN</button>
      </Sheet>
      <Confirm open={wipe} onClose={() => setWipe(false)} title="Erase all data?" body="This can’t be undone. Make a backup first." confirmLabel="Erase" onConfirm={async () => { await db.delete(); location.reload(); }} />
    </div>
  );
}
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
