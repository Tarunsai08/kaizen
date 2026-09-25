import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { X, Shuffle, Globe, Palette, Hourglass, Plus, ThumbsUp, ThumbsDown, Settings2, Trash2, ExternalLink, BarChart3, AppWindow, Search } from 'lucide-react';
import { db, setKV } from '../db';
import { useApp } from '../ctx';
import { today, fmtClock, periodRange, buckets, fmtDur } from '../lib/date';
import { TopBar, Seg, Field, Sheet, Chips, TagSelect, Stat, Empty, PeriodToggle, Ring, useInterval, EmojiPicker, MOODS, MoodScale } from '../ui/kit';
import { Bars, HBars, WeekHourGrid } from '../ui/charts';
import { SectionHead } from '../ui/rows';
import { success, tap, openUrl, Kaizen, isAndroid, safe } from '../lib/native';

const OPTS = {
  stay: { label: 'Stay in boredom', sub: 'Do nothing, on purpose', icon: Hourglass, color: 'var(--sleep)' },
  site: { label: 'Explore a website', sub: 'From your go-to list', icon: Globe, color: 'var(--money)' },
  hobby: { label: 'Explore a hobby', sub: 'Something with your hands or voice', icon: Palette, color: 'var(--fit)' },
  app: { label: 'Open a good app', sub: 'Substack, Medito, Kindle… your picks', icon: AppWindow, color: 'var(--task)' },
};

export function Boredom() {
  const { pop, push, toast, settings } = useApp();
  const [stage, setStage] = useState('choose');
  const [time, setTime] = useState(null);
  const [before, setBefore] = useState(null);
  const [session, setSession] = useState(null); // {option, refId, name, start, duration}
  const sites = useLiveQuery(() => db.sites.toArray(), []) || [];
  const hobbies = useLiveQuery(() => db.hobbies.toArray(), []) || [];
  const visits = useLiveQuery(() => db.boredom.where('option').anyOf('site', 'app').toArray(), []) || [];
  const apps = useLiveQuery(() => db.apps.toArray(), []) || [];
  const [pendingVisit, setPendingVisit] = useState(null);

  // Ask "was it worth it?" when coming back from a site
  useEffect(() => {
    const h = () => { if (document.visibilityState === 'visible' && pendingVisit) setStage('worth'); };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, [pendingVisit]);

  const appScore = (a) => visits.filter((x) => x.option === 'app' && x.refId === a.id && x.worth).reduce((s, b) => s + (b.worth === 'up' ? 1 : -1), 0);
  const openApp = async (a) => {
    const id = await db.boredom.add({ option: 'app', refId: a.id, ts: Date.now(), date: today(), durationSec: 0, moodBefore: before });
    setPendingVisit({ id, start: Date.now(), site: { name: a.label, url: a.url }, app: a });
    if (isAndroid && a.pkg) {
      try { await Kaizen.launchApp({ pkg: a.pkg, url: a.url || '', minutes: 30 }); } catch (e) { if (a.url) openUrl(a.url); else toast('Couldn’t open ' + a.label); }
    } else if (a.url) openUrl(a.url);
    setTimeout(() => setStage('worth'), 1500);
  };
  const score = (s) => { const v = visits.filter((x) => x.option === 'site' && x.refId === s.id && x.worth); return v.reduce((a, b) => a + (b.worth === 'up' ? 1 : -1), 0); };
  const sortedSites = [...sites].sort((a, b) => score(b) - score(a));
  const fitHobbies = hobbies.filter((h) => !time || !h.duration || (time === 10 ? h.duration <= 15 : time === 30 ? h.duration <= 40 : true));

  const openSite = async (s) => {
    const id = await db.boredom.add({ option: 'site', refId: s.id, ts: Date.now(), date: today(), durationSec: 0, moodBefore: before });
    setPendingVisit({ id, start: Date.now(), site: s });
    openUrl(s.url);
    setTimeout(() => setStage('worth'), 1500); // fallback for in-app browsers that don't blur
  };
  const startHobby = (h) => { setSession({ option: 'hobby', refId: h.id, name: `${h.icon || ''} ${h.name}`, start: Date.now(), duration: (h.duration || time || 20) * 60, hobby: h }); setStage('timer'); tap('medium'); };
  const startStay = (min) => { setSession({ option: 'stay', name: 'Just be', start: Date.now(), duration: min ? min * 60 : null }); setStage('timer'); tap('medium'); };

  const finishSession = async (feeling) => {
    const secs = Math.round((Date.now() - session.start) / 1000);
    await db.boredom.add({ option: session.option, refId: session.refId || null, ts: session.start, date: today(), durationSec: secs, feeling, moodBefore: before });
    if (session.option === 'hobby' && session.hobby?.habitId) {
      const hab = await db.habits.get(session.hobby.habitId);
      if (hab) {
        const mins = Math.max(1, Math.round(secs / 60));
        const amt = /min/i.test(hab.unit || '') ? mins : hab.target || 1;
        await db.habitLogs.add({ habitId: hab.id, date: today(), ts: Date.now(), amount: amt });
        toast(`Counted toward “${hab.name}”`);
      }
    } else toast('Session logged');
    success();
    pop();
  };

  if (stage === 'timer') return <SessionTimer session={session} onEnd={() => setStage('feel')} onClose={() => setStage('choose')} />;
  if (stage === 'feel') {
    return (
      <div className="timer-screen">
        <div className="col grow" style={{ justifyContent: 'center', gap: 14 }}>
          <div className="eyebrow">{session.name} · {fmtDur((Date.now() - session.start) / 60000)}</div>
          <h1 className="h1">How do you feel now?</h1>
          <div className="grid-3 mt-16">
            {[['better', '🙂', 'Better'], ['same', '😐', 'Same'], ['worse', '🙁', 'Worse']].map(([k, e, l]) => (
              <button key={k} className="card card-press col" style={{ alignItems: 'center', gap: 8, padding: '22px 8px' }} onClick={() => finishSession(k)}>
                <span style={{ fontSize: 34 }}>{e}</span><span className="small" style={{ fontWeight: 600 }}>{l}</span>
              </button>
            ))}
          </div>
          <button className="btn ghost mt-8" onClick={() => finishSession(null)}>Skip</button>
        </div>
      </div>
    );
  }
  if (stage === 'worth') {
    const ans = async (worth) => {
      if (pendingVisit) await db.boredom.update(pendingVisit.id, { worth, durationSec: Math.round((Date.now() - pendingVisit.start) / 1000), feeling: worth === 'up' ? 'better' : worth === 'down' ? 'worse' : null });
      setPendingVisit(null);
      toast('Thanks — your list learns from this');
      pop();
    };
    return (
      <div className="timer-screen">
        <div className="col grow" style={{ justifyContent: 'center', gap: 14 }}>
          <div className="eyebrow">{pendingVisit?.site.name}</div>
          <h1 className="h1">Was it worth it?</h1>
          <div className="row mt-16">
            <button className="btn lg grow" onClick={() => ans('down')}><ThumbsDown size={20} /> Meh</button>
            <button className="btn primary lg grow" onClick={() => ans('up')}><ThumbsUp size={20} /> Yes</button>
          </div>
          <button className="btn ghost" onClick={() => ans(null)}>Skip</button>
          <button className="btn ghost small" onClick={() => pendingVisit && (pendingVisit.app ? openApp(pendingVisit.app) : openUrl(pendingVisit.site.url))}>Open it again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen no-nav page-enter">
      <TopBar title="" right={<button className="icon-btn" onClick={() => push('BoredStats')}><BarChart3 size={18} /></button>} />
      {stage === 'choose' && (
        <>
          <h1 className="h1">What do you want to do?</h1>
          <p className="dim mt-8">Boredom is a signal, not a problem. Choose on purpose instead of drifting.</p>
          <div className="mt-16"><div className="label mb-8">Right now I feel <span className="muted">(optional)</span></div><MoodScale value={before} onChange={setBefore} /></div>
          <div className="mt-16"><div className="label mb-8">How much time do I have?</div><Chips value={time} onChange={(v) => setTime(v === time ? null : v)} options={[{ value: 10, label: '10 min' }, { value: 30, label: '30 min' }, { value: 60, label: '1 hr+' }]} /></div>
          <div className="col gap-10 mt-24">
            {Object.entries(OPTS).map(([k, o]) => (
              <button key={k} className="card card-press row gap-14" style={{ textAlign: 'left', padding: 18 }} onClick={() => setStage(k)}>
                <div className="swatch" style={{ width: 48, height: 48, borderRadius: 16, background: `color-mix(in srgb, ${o.color} 18%, transparent)` }}><o.icon size={22} color={o.color} /></div>
                <div className="grow"><div className="h3">{o.label}</div><div className="small muted">{o.sub}</div></div>
              </button>
            ))}
          </div>
        </>
      )}
      {stage === 'stay' && (
        <>
          <h1 className="h1">Stay with it.</h1>
          <p className="dim mt-8">No input, no scrolling. Let your mind wander. Ideas often show up here.</p>
          <div className="grid-2 mt-24">
            {[null, 10, 20, 30].map((m) => <button key={m ?? 'open'} className="card card-press center" style={{ padding: 22 }} onClick={() => startStay(m)}><div className="h2">{m ? `${m} min` : '∞'}</div><div className="small muted">{m ? 'timer' : 'open-ended'}</div></button>)}
          </div>
          <button className="btn block mt-12" onClick={() => push('Breathe', {})}>Or do a guided breathing exercise</button>
          <button className="btn ghost block mt-16" onClick={() => setStage('choose')}>Back</button>
        </>
      )}
      {stage === 'site' && (
        <>
          <div className="row between"><h1 className="h1">Websites</h1><button className="icon-btn" onClick={() => push('Sites')}><Settings2 size={18} /></button></div>
          {sites.length ? (
            <>
              <button className="btn primary block lg mt-16" onClick={() => openSite(sites[Math.floor(Math.random() * sites.length)])}><Shuffle size={18} /> Surprise me</button>
              <div className="list mt-16">
                {sortedSites.map((s) => (
                  <button key={s.id} className="list-item" onClick={() => openSite(s)}>
                    <div className="grow"><div style={{ fontWeight: 560 }}>{s.name}</div><div className="tiny muted ellipsis">{s.tag}{s.note ? ` · ${s.note}` : ''}</div></div>
                    {score(s) !== 0 && <span className="badge">{score(s) > 0 ? '👍' : '👎'} {Math.abs(score(s))}</span>}
                    <ExternalLink size={16} className="muted" />
                  </button>
                ))}
              </div>
            </>
          ) : <Empty icon="🌐" title="No sites yet" action={<button className="btn primary sm" onClick={() => push('Sites')}>Add sites</button>} />}
          <button className="btn ghost block mt-16" onClick={() => setStage('choose')}>Back</button>
        </>
      )}
      {stage === 'app' && (
        <>
          <div className="row between"><h1 className="h1">Apps</h1><button className="icon-btn" onClick={() => push('BoredApps')}><Settings2 size={18} /></button></div>
          <p className="small muted mt-8">Opening them from here skips Shield’s pause for 30 minutes.</p>
          {apps.length ? (
            <>
              <button className="btn primary block lg mt-16" onClick={() => openApp(apps[Math.floor(Math.random() * apps.length)])}><Shuffle size={18} /> Surprise me</button>
              <div className="list mt-16">
                {[...apps].sort((a, b) => appScore(b) - appScore(a)).map((a) => (
                  <button key={a.id} className="list-item" onClick={() => openApp(a)}>
                    <AppIcon pkg={a.pkg} label={a.label} />
                    <div className="grow"><div style={{ fontWeight: 560 }}>{a.label}</div><div className="tiny muted ellipsis">{[a.tag, a.note, a.url ? 'opens a link' : ''].filter(Boolean).join(' · ')}</div></div>
                    {appScore(a) !== 0 && <span className="badge">{appScore(a) > 0 ? '👍' : '👎'} {Math.abs(appScore(a))}</span>}
                  </button>
                ))}
              </div>
            </>
          ) : <Empty icon="📱" title="No apps yet" sub="Add the apps that leave you better off — Substack, Medito, Kindle, Duolingo…" action={<button className="btn primary sm" onClick={() => push('BoredApps')}>Add apps</button>} />}
          <button className="btn ghost block mt-16" onClick={() => setStage('choose')}>Back</button>
        </>
      )}
      {stage === 'hobby' && (
        <>
          <div className="row between"><h1 className="h1">Hobbies</h1><button className="icon-btn" onClick={() => push('Hobbies')}><Settings2 size={18} /></button></div>
          {fitHobbies.length ? (
            <>
              <button className="btn primary block lg mt-16" onClick={() => startHobby(fitHobbies[Math.floor(Math.random() * fitHobbies.length)])}><Shuffle size={18} /> Surprise me</button>
              <div className="col gap-6 mt-16">
                {fitHobbies.map((h) => (
                  <button key={h.id} className="card card-press row gap-14" style={{ textAlign: 'left' }} onClick={() => startHobby(h)}>
                    <div className="swatch" style={{ background: 'var(--surface-2)', fontSize: 22 }}>{h.icon || '🎨'}</div>
                    <div className="grow"><div className="h3">{h.name}</div><div className="small muted ellipsis">{h.duration ? `~${h.duration} min` : ''}{h.notes ? ` · ${h.notes}` : ''}</div></div>
                    <span className="btn sm">Start</span>
                  </button>
                ))}
              </div>
            </>
          ) : <Empty icon="🎨" title={hobbies.length ? 'Nothing fits that time' : 'No hobbies yet'} action={<button className="btn primary sm" onClick={() => push('Hobbies')}>Add hobbies</button>} />}
          <button className="btn ghost block mt-16" onClick={() => setStage('choose')}>Back</button>
        </>
      )}
    </div>
  );
}

function SessionTimer({ session, onEnd, onClose }) {
  const [now, setNow] = useState(Date.now());
  useInterval(() => setNow(Date.now()), 500);
  const el = (now - session.start) / 1000;
  const left = session.duration ? session.duration - el : null;
  const ended = useRef(false);
  useEffect(() => { if (left != null && left <= 0 && !ended.current) { ended.current = true; success(); onEnd(); } }, [left]);
  return (
    <div className="timer-screen">
      <div className="row between"><span className="eyebrow">{session.name}</span><button className="icon-btn" onClick={onClose}><X size={20} /></button></div>
      <div className="col grow" style={{ justifyContent: 'center', alignItems: 'center', gap: 28 }}>
        {session.option === 'stay' ? <div className="breath" /> : <Ring size={220} stroke={5} value={session.duration ? el / session.duration : 0} color="var(--fit)" />}
        <div className="center">
          <div className="timer-big" style={{ opacity: 0.9 }}>{fmtClock(left != null ? left : el)}</div>
          <div className="small muted">{session.option === 'stay' ? 'breathe in… and out' : left != null ? 'remaining' : 'elapsed'}</div>
        </div>
      </div>
      <button className="btn lg block" onClick={onEnd}>End session</button>
    </div>
  );
}

/* ---------- manage sites ---------- */
export function Sites({ prefill }) {
  const { settings } = useApp();
  const sites = useLiveQuery(() => db.sites.toArray(), []) || [];
  const [edit, setEdit] = useState(prefill || null);
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="Go-to websites" right={<button className="icon-btn" onClick={() => setEdit({ name: '', url: 'https://', tag: settings.siteTags[0], note: '' })}><Plus size={20} /></button>} />
      <p className="small muted" style={{ marginTop: -4 }}>Tip: in the Android app, share a link from Chrome → Kaizen to add it here.</p>
      <div className="list mt-12">
        {sites.map((s) => <button key={s.id} className="list-item" onClick={() => setEdit(s)}><div className="grow"><div style={{ fontWeight: 560 }}>{s.name}</div><div className="tiny muted ellipsis">{s.tag} · {s.url}</div></div></button>)}
        {!sites.length && <div className="list-item muted">No sites yet</div>}
      </div>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit site' : 'Add site'}>
        {edit && (
          <div className="form">
            <Field label="Name"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="URL"><input className="input" inputMode="url" value={edit.url} onChange={(e) => setEdit({ ...edit, url: e.target.value })} /></Field>
            <Field label="Tag"><TagSelect options={settings.siteTags} value={edit.tag} onChange={(v) => setEdit({ ...edit, tag: v })} onAdd={(t) => setKV('siteTags', [...settings.siteTags, t])} /></Field>
            <Field label="Why it’s worth opening"><input className="input" value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></Field>
            <div className="row">
              {edit.id && <button className="btn danger" onClick={async () => { await db.sites.delete(edit.id); setEdit(null); }}><Trash2 size={16} /></button>}
              <button className="btn primary grow" onClick={async () => { if (!edit.name || !edit.url) return; const r = { ...edit, url: /^https?:\/\//.test(edit.url) ? edit.url : 'https://' + edit.url }; if (r.id) await db.sites.put(r); else await db.sites.add(r); setEdit(null); }}>Save</button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

/* ---------- app icon (Android) ---------- */
const ICON_CACHE = {};
export function AppIcon({ pkg, label, size = 32 }) {
  const [src, setSrc] = useState(ICON_CACHE[pkg] || null);
  useEffect(() => {
    if (!pkg || ICON_CACHE[pkg] || !isAndroid) return;
    safe(() => Kaizen.getAppIcon({ pkg })).then((r) => { if (r?.data) { ICON_CACHE[pkg] = 'data:image/png;base64,' + r.data; setSrc(ICON_CACHE[pkg]); } });
  }, [pkg]);
  if (src) return <img src={src} alt="" width={size} height={size} style={{ borderRadius: size * 0.25, flexShrink: 0 }} />;
  return <div className="app-ico" style={{ width: size, height: size, borderRadius: size * 0.3, display: 'grid', placeItems: 'center', background: 'var(--surface-3)', fontWeight: 700, flexShrink: 0 }}>{(label || '?')[0]}</div>;
}

/* ---------- manage apps for boredom ---------- */
export function BoredApps() {
  const apps = useLiveQuery(() => db.apps.toArray(), []) || [];
  const [edit, setEdit] = useState(null);
  const [pick, setPick] = useState(false);
  const [installed, setInstalled] = useState(null);
  const [q, setQ] = useState('');
  const openPicker = async () => {
    setPick(true);
    if (!installed) {
      const r = await safe(() => Kaizen.listApps(), { apps: [] });
      setInstalled((r?.apps || []).sort((a, b) => a.label.localeCompare(b.label)));
    }
  };
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="Good apps" right={<button className="icon-btn" onClick={() => (isAndroid ? openPicker() : setEdit({ label: '', pkg: '', url: '', tag: 'Learning', note: '' }))}><Plus size={20} /></button>} />
      <p className="small muted" style={{ marginTop: -4 }}>Apps you’d rather reach for when bored. Add a link to open a specific page inside one (e.g. your Substack reading list).</p>
      <div className="list mt-12">
        {apps.map((a) => <button key={a.id} className="list-item" onClick={() => setEdit(a)}><AppIcon pkg={a.pkg} label={a.label} /><div className="grow"><div style={{ fontWeight: 560 }}>{a.label}</div><div className="tiny muted ellipsis">{[a.tag, a.url].filter(Boolean).join(' · ') || a.pkg}</div></div></button>)}
        {!apps.length && <button className="list-item muted" onClick={() => (isAndroid ? openPicker() : setEdit({ label: '', pkg: '', url: '', tag: 'Learning', note: '' }))}><Plus size={16} /> Add an app</button>}
      </div>
      <Sheet open={pick} onClose={() => setPick(false)} title="Pick an app">
        <div className="row gap-8 mb-12"><Search size={16} className="muted" /><input className="input" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="list" style={{ maxHeight: '55vh', overflowY: 'auto' }}>
          {!installed && <div className="list-item muted"><span className="spin" /> Loading apps…</div>}
          {(installed || []).filter((a) => a.label.toLowerCase().includes(q.toLowerCase())).map((a) => (
            <button key={a.pkg} className="list-item" onClick={() => { setPick(false); setEdit({ label: a.label, pkg: a.pkg, url: '', tag: 'Learning', note: '' }); }}><AppIcon pkg={a.pkg} label={a.label} size={28} /><div className="grow">{a.label}</div></button>
          ))}
        </div>
      </Sheet>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit app' : 'Add app'}>
        {edit && (
          <div className="form">
            <Field label="Name"><input className="input" value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} /></Field>
            {!isAndroid && <Field label="Android package (optional)"><input className="input" placeholder="com.substack.app" value={edit.pkg} onChange={(e) => setEdit({ ...edit, pkg: e.target.value })} /></Field>}
            <Field label="Open a link inside it (optional)" hint="e.g. https://substack.com/inbox — leave empty to just open the app"><input className="input" inputMode="url" value={edit.url} onChange={(e) => setEdit({ ...edit, url: e.target.value })} /></Field>
            <Field label="Tag"><Chips value={edit.tag} onChange={(v) => setEdit({ ...edit, tag: v })} options={['Learning', 'Calm', 'Creative', 'Fun']} /></Field>
            <Field label="Why it’s worth opening"><input className="input" value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></Field>
            <div className="row">
              {edit.id && <button className="btn danger" onClick={async () => { await db.apps.delete(edit.id); setEdit(null); }}><Trash2 size={16} /></button>}
              <button className="btn primary grow" disabled={!edit.label.trim()} onClick={async () => { const r = { ...edit, url: edit.url && !/^[a-z]+:\/\//i.test(edit.url) ? 'https://' + edit.url : edit.url }; if (r.id) await db.apps.put(r); else await db.apps.add(r); setEdit(null); }}>Save</button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

/* ---------- manage hobbies ---------- */
export function Hobbies() {
  const hobbies = useLiveQuery(() => db.hobbies.toArray(), []) || [];
  const habits = useLiveQuery(() => db.habits.where('type').equals('build').toArray(), []) || [];
  const [edit, setEdit] = useState(null);
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="Hobbies" right={<button className="icon-btn" onClick={() => setEdit({ name: '', icon: '🎤', duration: 20, habitId: null, notes: '' })}><Plus size={20} /></button>} />
      <div className="list">
        {hobbies.map((h) => <button key={h.id} className="list-item" onClick={() => setEdit(h)}><span style={{ fontSize: 20 }}>{h.icon}</span><div className="grow"><div style={{ fontWeight: 560 }}>{h.name}</div><div className="tiny muted">{h.duration ? `~${h.duration} min` : ''}{h.habitId ? ` · counts for ${habits.find((x) => x.id === h.habitId)?.name || 'habit'}` : ''}</div></div></button>)}
        {!hobbies.length && <div className="list-item muted">Singing practice, sketching, guitar…</div>}
      </div>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit hobby' : 'Add hobby'}>
        {edit && (
          <div className="form">
            <Field label="Name"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Singing practice" /></Field>
            <Field label="Icon"><EmojiPicker value={edit.icon} onChange={(v) => setEdit({ ...edit, icon: v })} list={['🎤', '🎸', '🎹', '🎨', '✏️', '📷', '🧶', '🍳', '📖', '♟️', '🧩', '🌿', '💃', '✍️', '🎬', '🛹']} /></Field>
            <Field label="Typical duration"><Chips value={edit.duration} onChange={(v) => setEdit({ ...edit, duration: v })} options={[{ value: 10, label: '10m' }, { value: 20, label: '20m' }, { value: 30, label: '30m' }, { value: 45, label: '45m' }, { value: 60, label: '1h' }]} /></Field>
            <Field label="Counts toward habit"><select className="select" value={edit.habitId || ''} onChange={(e) => setEdit({ ...edit, habitId: e.target.value ? Number(e.target.value) : null })}><option value="">None</option>{habits.map((h) => <option key={h.id} value={h.id}>{h.icon} {h.name}</option>)}</select></Field>
            <Field label="Ideas for next time"><textarea className="textarea" style={{ minHeight: 60 }} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} placeholder="Learn the new song's bridge" /></Field>
            <div className="row">
              {edit.id && <button className="btn danger" onClick={async () => { await db.hobbies.delete(edit.id); setEdit(null); }}><Trash2 size={16} /></button>}
              <button className="btn primary grow" onClick={async () => { if (!edit.name) return; if (edit.id) await db.hobbies.put(edit); else await db.hobbies.add(edit); setEdit(null); }}>Save</button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

/* ---------- boredom stats ---------- */
export function BoredStats() {
  const [period, setPeriod] = useState('month');
  const all = useLiveQuery(() => db.boredom.toArray(), []);
  const sites = useLiveQuery(() => db.sites.toArray(), []) || [];
  const hobbies = useLiveQuery(() => db.hobbies.toArray(), []) || [];
  if (!all) return <div className="screen no-nav" />;
  const [from, to] = periodRange(period);
  const r = all.filter((b) => b.date >= from && b.date <= to);
  const t = today();
  const trend = buckets(period).map((b) => ({ label: b.label, value: b.from > t ? null : all.filter((x) => x.date >= b.from && x.date <= b.to).length }));
  const split = ['stay', 'site', 'hobby'].map((k) => ({ label: OPTS[k].label, value: r.filter((x) => x.option === k).length, color: OPTS[k].color }));
  const time = ['stay', 'site', 'hobby'].map((k) => { const l = r.filter((x) => x.option === k); const s = l.reduce((a, b) => a + (b.durationSec || 0), 0); return { label: OPTS[k].label, value: Math.round(s / 60), color: OPTS[k].color, avg: l.length ? s / 60 / l.length : 0 }; });
  const feel = ['stay', 'site', 'hobby'].map((k) => { const l = r.filter((x) => x.option === k && x.feeling); const b = l.filter((x) => x.feeling === 'better').length; return { label: OPTS[k].label, value: l.length ? Math.round((b / l.length) * 100) : 0, color: OPTS[k].color, n: l.length }; });
  const used = {};
  r.filter((x) => x.refId).forEach((x) => { const n = x.option === 'site' ? sites.find((s) => s.id === x.refId)?.name : hobbies.find((h) => h.id === x.refId)?.name; if (n) used[n] = (used[n] || 0) + 1; });
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="Boredom stats" />
      <PeriodToggle value={period} onChange={setPeriod} />
      <div className="grid-2 mt-12">
        <Stat v={r.length} k="Times bored" color="var(--bored)" />
        <Stat v={fmtDur(r.reduce((a, b) => a + (b.durationSec || 0), 0) / 60)} k="Time spent" />
      </div>
      <div className="card mt-12"><div className="h3 mb-12">Frequency</div><Bars data={trend} color="var(--bored)" showValues /></div>
      <div className="card mt-12"><div className="h3 mb-12">When boredom hits</div><WeekHourGrid events={r.map((x) => x.ts)} color="var(--bored)" /></div>
      <div className="card mt-12"><div className="h3 mb-12">What you chose</div><HBars items={split} /></div>
      <div className="card mt-12"><div className="h3 mb-12">Time per option (min)</div><HBars items={time} format={(v) => `${v}m`} /></div>
      <div className="card mt-12"><div className="h3">Left you feeling better</div><div className="small muted mb-12">% of sessions answered “Better”</div><HBars items={feel.filter((f) => f.n)} format={(v) => `${v}%`} total={100} /></div>
      <div className="card mt-12"><div className="h3 mb-12">Most used</div><HBars items={Object.entries(used).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => ({ label: k, value: v, color: 'var(--bored)' }))} format={(v) => `${v}×`} /></div>
    </div>
  );
}
