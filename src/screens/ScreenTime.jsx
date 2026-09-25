import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Smartphone, ShieldCheck, Shield as ShieldIcon, ChevronRight, Lock, Unlock, Hourglass, X, Clapperboard, TimerReset, Settings2, RefreshCw } from 'lucide-react';
import { db, setKV } from '../db';
import { useApp } from '../ctx';
import { today, lastNDays, DAYS_SHORT, dow, fmtClock } from '../lib/date';
import { Kaizen, isAndroid, success, tap } from '../lib/native';
import { syncScreenTime, syncShieldEvents, appIcon, hasUsageAccess, pushShieldConfig, fmtMs, recordGaveUp } from '../lib/screen';
import { TopBar, Toggle, Chips, Stat, Empty, Sheet, Field } from '../ui/kit';
import { Bars } from '../ui/charts';
import { SectionHead } from '../ui/rows';
import { Breathe } from './Mind';

export function AppIcon({ pkg, label, size = 36 }) {
  const [src, setSrc] = useState(null);
  useEffect(() => { let on = true; appIcon(pkg).then((s) => on && setSrc(s)); return () => { on = false; }; }, [pkg]);
  return <div className="app-ico" style={{ width: size, height: size }}>{src ? <img src={src} alt="" /> : (label || pkg || '?')[0].toUpperCase()}</div>;
}

/* =========================================================
   SCREEN TIME (Habits → Screen time)
   ========================================================= */
export function ScreenTimeView() {
  const { push, settings } = useApp();
  const [access, setAccess] = useState(null);
  const [shield, setShield] = useState(null);
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    setBusy(true);
    const ok = await hasUsageAccess();
    setAccess(ok);
    if (ok) await syncScreenTime(7);
    await syncShieldEvents();
    if (isAndroid) { try { setShield(await Kaizen.shieldStatus()); } catch {} }
    setBusy(false);
  };
  useEffect(() => { refresh(); }, []);
  const rows = useLiveQuery(() => db.screenDays.where('date').aboveOrEqual(lastNDays(7)[0]).toArray(), []) || [];
  const events = useLiveQuery(() => db.shieldEvents.where('date').equals(today()).toArray(), []) || [];

  if (!isAndroid) {
    return (
      <div className="card">
        <Smartphone size={22} color="var(--accent)" />
        <div className="h3 mt-8">Screen time & Shield</div>
        <p className="small muted" style={{ marginBottom: 0 }}>See how long you spend in each app, set daily limits, block Shorts/Reels and add a mindful pause before opening distracting apps. Available in the Android app.</p>
      </div>
    );
  }
  if (access === false) {
    return (
      <div className="card">
        <div className="tile lg" style={{ background: 'color-mix(in srgb, var(--accent) 16%, transparent)' }}><Smartphone size={24} color="var(--accent)" /></div>
        <div className="h2 mt-12">See where your time goes</div>
        <p className="small muted">Kaizen needs <b>Usage access</b> to read how long you use each app. The data never leaves your phone.</p>
        <ol className="small dim" style={{ paddingLeft: 18, lineHeight: 1.7 }}>
          <li>Tap the button below</li>
          <li>Find <b>Kaizen</b> in the list</li>
          <li>Turn on <b>Permit usage access</b>, then come back</li>
        </ol>
        <button className="btn primary block" onClick={() => Kaizen.openUsageAccess()}>Open settings</button>
        <button className="btn ghost block mt-8" onClick={refresh}>I’ve turned it on</button>
      </div>
    );
  }
  const t = today();
  const todayRows = rows.filter((r) => r.date === t && r.pkg !== '__unlocks').sort((a, b) => b.ms - a.ms);
  const total = todayRows.reduce((a, b) => a + b.ms, 0);
  const unlocks = rows.find((r) => r.date === t && r.pkg === '__unlocks')?.ms || 0;
  const days = lastNDays(7);
  const bars = days.map((d) => ({ label: DAYS_SHORT[dow(d)][0], value: Math.round(rows.filter((r) => r.date === d && r.pkg !== '__unlocks').reduce((a, b) => a + b.ms, 0) / 60000) }));
  const weekAvg = Math.round(bars.reduce((a, b) => a + b.value, 0) / 7);
  const limits = settings.screenLimits || {};
  const blocked = events.filter((e) => e.type === 'blocked').length;
  const gaveup = events.filter((e) => e.type === 'gaveup').length;
  const max = todayRows[0]?.ms || 1;
  return (
    <div>
      <div className="hero">
        <div className="glow" style={{ background: 'var(--accent)', right: -90, top: -100 }} />
        <div className="row between">
          <div className="eyebrow">Screen time today</div>
          <button className="icon-btn sm ghost" onClick={refresh} aria-label="Refresh"><RefreshCw size={15} className={busy ? 'spin' : ''} /></button>
        </div>
        <div className="big-num num mt-8">{fmtMs(total)}</div>
        <div className="small muted mt-4">{unlocks} unlocks · 7-day avg {Math.floor(weekAvg / 60)}h {weekAvg % 60}m</div>
        <div className="mt-16"><Bars data={bars} color="var(--accent)" height={80} format={(v) => `${Math.floor(v / 60)}h${v % 60}m`} /></div>
      </div>

      <button className="card card-press row gap-14 mt-12" style={{ width: '100%', textAlign: 'left' }} onClick={() => push('ShieldSettings')}>
        <div className="tile" style={{ background: 'color-mix(in srgb, var(--bored) 16%, transparent)' }}>{shield?.enabled ? <ShieldCheck size={20} color="var(--bored)" /> : <ShieldIcon size={20} color="var(--bored)" />}</div>
        <div className="grow">
          <div className="h3">Shield</div>
          <div className="small muted">{!shield?.available ? 'Shorts blocking needs the Kaizen Shield edition' : shield?.enabled ? `On · ${blocked} blocked · ${gaveup} times you chose not to open` : 'Block Shorts & Reels, pause before apps'}</div>
        </div>
        <ChevronRight size={18} className="muted" />
      </button>

      <div className="section">
        <SectionHead title="Apps today" />
        {todayRows.length ? (
          <div className="list">
            {todayRows.slice(0, 15).map((r) => {
              const lim = limits[r.pkg];
              const over = lim && r.ms / 60000 > lim;
              return (
                <button key={r.pkg} className="list-item" onClick={() => push('AppLimit', { pkg: r.pkg, label: r.label })}>
                  <AppIcon pkg={r.pkg} label={r.label} />
                  <div className="grow">
                    <div className="row between"><span className="ellipsis" style={{ fontWeight: 580 }}>{r.label}</span><span className="small num" style={{ color: over ? 'var(--bad)' : 'var(--text-2)' }}>{fmtMs(r.ms)}{lim ? ` / ${lim}m` : ''}</span></div>
                    <div className="bar mt-8" style={{ height: 4 }}><i style={{ width: `${(r.ms / max) * 100}%`, background: over ? 'var(--bad)' : 'var(--accent)' }} /></div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : <Empty icon="📱" title="No usage yet today" />}
      </div>
    </div>
  );
}

/* Per-app daily limit + link to a break habit */
export function AppLimit({ pkg, label }) {
  const { settings, toast, pop } = useApp();
  const limits = settings.screenLimits || {};
  const [lim, setLim] = useState(limits[pkg] || 0);
  const habits = useLiveQuery(() => db.habits.where('type').equals('break').filter((h) => !h.archived).toArray(), []) || [];
  const rows = useLiveQuery(() => db.screenDays.where('pkg').equals(pkg).toArray(), [pkg]) || [];
  const days = lastNDays(7);
  const bars = days.map((d) => ({ label: DAYS_SHORT[dow(d)][0], value: Math.round((rows.find((r) => r.date === d)?.ms || 0) / 60000) }));
  const save = async () => {
    await setKV('screenLimits', { ...limits, [pkg]: lim || undefined });
    const cfg = { ...(settings.shield || {}), limits: { ...limits, [pkg]: lim || undefined } };
    await pushShieldConfig(cfg);
    toast('Saved'); pop();
  };
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="" />
      <div className="row gap-14 mb-16"><AppIcon pkg={pkg} label={label} size={52} /><div><h1 className="h2">{label}</h1><div className="small muted">{pkg}</div></div></div>
      <div className="card"><div className="h3 mb-12">Last 7 days (min)</div><Bars data={bars} color="var(--accent)" showValues /></div>
      <div className="card mt-12">
        <div className="h3">Daily limit</div>
        <div className="small muted mb-12">Kaizen shows a gentle warning when you go over.</div>
        <Chips value={lim} onChange={setLim} options={[{ value: 0, label: 'None' }, { value: 15, label: '15m' }, { value: 30, label: '30m' }, { value: 45, label: '45m' }, { value: 60, label: '1h' }, { value: 90, label: '1.5h' }, { value: 120, label: '2h' }]} />
      </div>
      <div className="card mt-12">
        <div className="h3">Count towards a break habit</div>
        <div className="small muted mb-12">Going over a linked habit’s limit logs a relapse automatically. Choosing not to open it after a Shield pause counts as a resisted urge.</div>
        {habits.length ? habits.map((h) => {
          const on = (h.linkApps || []).includes(pkg);
          return (
            <div key={h.id} className="row between" style={{ padding: '8px 0' }}>
              <span style={{ fontWeight: 580 }}>{h.name}</span>
              <Toggle on={on} onChange={async (v) => { const apps = new Set(h.linkApps || []); v ? apps.add(pkg) : apps.delete(pkg); await db.habits.update(h.id, { linkApps: [...apps], dailyLimit: h.dailyLimit || lim || 60 }); }} />
            </div>
          );
        }) : <div className="small muted">Create a break habit (e.g. “Doomscrolling”) to link apps.</div>}
      </div>
      <button className="btn primary lg block mt-16" onClick={save}>Save</button>
    </div>
  );
}

/* =========================================================
   SHIELD SETTINGS
   ========================================================= */
const SHORTS = [
  { key: 'youtube', label: 'YouTube Shorts', pkg: 'com.google.android.youtube' },
  { key: 'instagram', label: 'Instagram Reels', pkg: 'com.instagram.android' },
];
export function ShieldSettings() {
  const { settings, toast } = useApp();
  const [status, setStatus] = useState(null);
  const [apps, setApps] = useState([]);
  const [picking, setPicking] = useState(false);
  const cfg = settings.shield || {};
  const load = async () => {
    if (!isAndroid) return;
    try { setStatus(await Kaizen.shieldStatus()); } catch { setStatus({ available: false, enabled: false }); }
  };
  useEffect(() => { load(); const h = () => document.visibilityState === 'visible' && load(); document.addEventListener('visibilitychange', h); return () => document.removeEventListener('visibilitychange', h); }, []);
  const events = useLiveQuery(() => db.shieldEvents.where('date').equals(today()).toArray(), []) || [];
  const update = async (patch) => {
    const next = { ...cfg, ...patch };
    await setKV('shield', next);
    await pushShieldConfig({ ...next, limits: settings.screenLimits || {} });
  };
  const openPicker = async () => {
    setPicking(true);
    try { const r = await Kaizen.listApps(); setApps((r.apps || []).sort((a, b) => a.label.localeCompare(b.label))); } catch { setApps([]); }
  };
  const count = (type) => events.filter((e) => e.type === type).length;
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="Shield" />
      <div className="hero">
        <div className="glow" style={{ background: 'var(--bored)', right: -90, top: -100 }} />
        <div className="row gap-14">
          <div className="tile lg" style={{ background: 'color-mix(in srgb, var(--bored) 18%, transparent)' }}><ShieldCheck size={26} color="var(--bored)" /></div>
          <div className="grow">
            <div className="h2">{status?.enabled ? 'Shield is on' : 'Shield is off'}</div>
            <div className="small muted">Inspired by Regain & one sec</div>
          </div>
        </div>
        <div className="grid-3 mt-16">
          <Stat v={count('blocked')} k="Shorts blocked" />
          <Stat v={count('paused')} k="Pauses" />
          <Stat v={count('gaveup')} k="Didn’t open" color="var(--good)" />
        </div>
      </div>

      {isAndroid && status && !status.available && (
        <div className="card mt-12">
          <div className="h3">Needs the Shield edition</div>
          <p className="small muted" style={{ marginBottom: 0 }}>Blocking Shorts needs Android’s Accessibility access, which Google Play Protect blocks for apps installed outside the Play Store. Install <b>Kaizen-Shield.apk</b> from your GitHub Releases (turn off Play Protect scanning for a minute while installing). It updates this app — your data stays.</p>
        </div>
      )}
      {isAndroid && status?.available && !status.enabled && (
        <div className="card mt-12">
          <div className="h3">Turn on Shield (one-time)</div>
          <ol className="small dim" style={{ paddingLeft: 18, lineHeight: 1.75, marginBottom: 12 }}>
            <li>Open <b>App info</b> → ⋮ (top right) → <b>Allow restricted settings</b></li>
            <li>Open <b>Accessibility</b> → <b>Downloaded apps</b> → <b>Kaizen Shield</b> → turn on</li>
          </ol>
          <div className="row">
            <button className="btn grow" onClick={() => Kaizen.openAppInfo()}>1 · App info</button>
            <button className="btn primary grow" onClick={() => Kaizen.openAccessibility()}>2 · Accessibility</button>
          </div>
          <div className="tiny muted mt-8">Kaizen only looks at which app and screen is open to spot Shorts/Reels. Nothing is recorded or sent anywhere.</div>
        </div>
      )}

      <div className="section">
        <SectionHead title="Block short videos" />
        <div className="list">
          {SHORTS.map((s) => (
            <div key={s.key} className="list-item">
              <Clapperboard size={19} className="muted" />
              <span className="grow" style={{ fontWeight: 580 }}>{s.label}</span>
              <Toggle on={!!(cfg.shorts || {})[s.key]} onChange={(v) => update({ shorts: { ...(cfg.shorts || {}), [s.key]: v } })} />
            </div>
          ))}
        </div>
        <div className="tiny muted mt-8">When a Shorts/Reels feed opens, Kaizen takes you back and shows a quick note. The rest of the app still works.</div>
      </div>

      <div className="section">
        <SectionHead title="Pause before opening" link="Add apps" onLink={openPicker} />
        <div className="list">
          {(cfg.pauseApps || []).map((a) => (
            <div key={a.pkg} className="list-item">
              <AppIcon pkg={a.pkg} label={a.label} size={32} />
              <span className="grow" style={{ fontWeight: 580 }}>{a.label}</span>
              <button className="icon-btn sm ghost" onClick={() => update({ pauseApps: cfg.pauseApps.filter((x) => x.pkg !== a.pkg) })}><X size={16} /></button>
            </div>
          ))}
          {!(cfg.pauseApps || []).length && <button className="list-item muted" onClick={openPicker}><Hourglass size={18} /><span className="small">Add Instagram, YouTube… for a mindful breath first</span></button>}
        </div>
        <div className="card mt-12">
          <Field label="Pause length"><Chips value={cfg.pauseSeconds || 6} onChange={(v) => update({ pauseSeconds: v })} options={[{ value: 4, label: '4s' }, { value: 6, label: '6s' }, { value: 10, label: '10s' }, { value: 15, label: '15s' }]} /></Field>
          <div className="mt-12"><Field label="If you open anyway, allow for"><Chips value={cfg.allowMinutes || 10} onChange={(v) => update({ allowMinutes: v })} options={[{ value: 5, label: '5 min' }, { value: 10, label: '10 min' }, { value: 20, label: '20 min' }, { value: 30, label: '30 min' }]} /></Field></div>
        </div>
      </div>

      <Sheet open={picking} onClose={() => setPicking(false)} title="Pause before…">
        <div className="list" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {apps.map((a) => {
            const on = (cfg.pauseApps || []).some((x) => x.pkg === a.pkg);
            return (
              <button key={a.pkg} className="list-item" onClick={() => { tap(); update({ pauseApps: on ? cfg.pauseApps.filter((x) => x.pkg !== a.pkg) : [...(cfg.pauseApps || []), { pkg: a.pkg, label: a.label }] }); }}>
                <AppIcon pkg={a.pkg} label={a.label} size={32} />
                <span className="grow">{a.label}</span>
                <div className={`task-check ${on ? 'on' : ''}`}>{on && '✓'}</div>
              </button>
            );
          })}
          {!apps.length && <div className="list-item muted">{isAndroid ? 'Loading apps…' : 'Android app only'}</div>}
        </div>
      </Sheet>
    </div>
  );
}

/* =========================================================
   PAUSE SCREEN — shown by Shield before a chosen app opens (one sec style)
   ========================================================= */
export function Pause({ pkg, label }) {
  const { pop, settings } = useApp();
  const cfg = settings.shield || {};
  const secs = cfg.pauseSeconds || 6;
  const [left, setLeft] = useState(secs);
  const [phase, setPhase] = useState(0);
  const opens = useLiveQuery(() => db.shieldEvents.where('date').equals(today()).filter((e) => e.pkg === pkg && e.type === 'opened').count(), [pkg]) || 0;
  const minsToday = useLiveQuery(async () => Math.round(((await db.screenDays.get([today(), pkg]))?.ms || 0) / 60000), [pkg]) || 0;
  useEffect(() => {
    const id = setInterval(() => setLeft((l) => Math.max(0, +(l - 0.1).toFixed(1))), 100);
    const ph = setInterval(() => setPhase((p) => 1 - p), 3000);
    setTimeout(() => setPhase(1), 50);
    return () => { clearInterval(id); clearInterval(ph); };
  }, []);
  const gaveUp = async () => {
    success();
    await recordGaveUp(pkg);
    try { await Kaizen.goHome(); } catch {}
    pop();
  };
  const openAnyway = async () => {
    await db.shieldEvents.add({ type: 'opened', pkg, ts: Date.now(), date: today() });
    try { await Kaizen.allowApp({ pkg, minutes: cfg.allowMinutes || 10 }); } catch {}
    pop();
  };
  const name = label || (cfg.pauseApps || []).find((a) => a.pkg === pkg)?.label || 'this app';
  return (
    <div className="timer-screen" style={{ background: '#050507', color: '#fff' }}>
      <div className="row between"><span className="eyebrow" style={{ color: '#888' }}>Shield</span><span /></div>
      <div className="col grow" style={{ justifyContent: 'center', alignItems: 'center', gap: 30, textAlign: 'center' }}>
        <div className="breathe-orb" style={{ width: 200, height: 200 }}>
          <div className="core" style={{ '--dur': '3s', transform: `scale(${phase ? 1 : 0.5})` }} />
          <div style={{ position: 'relative', fontSize: 20, fontWeight: 650 }}>{phase ? 'Breathe in' : 'Breathe out'}</div>
        </div>
        <div>
          <h1 className="h1" style={{ color: '#fff' }}>Do you really want to open {name}?</h1>
          <p style={{ color: '#9a9aa3', marginTop: 10 }}>{opens ? `You’ve opened it ${opens} time${opens > 1 ? 's' : ''} today` : 'First time today'}{minsToday ? ` · ${minsToday} min so far` : ''}</p>
        </div>
      </div>
      <button className="btn lg block" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }} onClick={gaveUp}>No, I don’t want to</button>
      <button className="btn lg block mt-8" style={{ background: 'transparent', color: left > 0 ? '#555' : '#aaa' }} disabled={left > 0} onClick={openAnyway}>
        {left > 0 ? `Continue in ${Math.ceil(left)}s` : `Open for ${cfg.allowMinutes || 10} min`}
      </button>
    </div>
  );
}
export { fmtClock, Breathe, Settings2, TimerReset, Lock, Unlock };
