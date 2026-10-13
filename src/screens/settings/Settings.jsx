// Settings: a short home with groups, each opening one focused page. Works in every app style.
import React, { useEffect, useRef, useState } from 'react';
import {
  Palette, Moon, CalendarClock, CalendarDays, Bell, LayoutGrid, Shield, ChevronRight, ChevronLeft, Download, Upload, Trash2, Tags, Lock,
  Search, Check, Volume2, Sunrise, Footprints, HeartPulse, Info, ChevronDown, ArrowUp, ArrowDown, X, Plus, Pin,
} from 'lucide-react';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { LocalNotifications } from '@capacitor/local-notifications';
import { db, setKV, exportAll, importAll } from '../../db';
import { useApp } from '../../ctx';
import { today, fmtHM } from '../../lib/date';
import { PL_COLORS } from '../../lib/plcolor';
import { isNative, isAndroid, Kaizen, success, tap } from '../../lib/native';
import { rescheduleAll, ensurePermission, notifyNow } from '../../lib/notify';
import { Sheet, Seg, Toggle, Confirm } from '../../ui/kit';
import StylePicker from '../../studio/StylePicker';
import { isStudio, journeyOn, NAV_CHOICES, defaultNav, navKey } from '../../studio/mode';
import { TODAY_LAYOUTS } from '../today/index';
import { MODULES } from '../planner/More';
import { plannerSettings, syncCalendar, replan } from '../../planner/service';
import { CATEGORIES, DEFAULT_FACTORS } from '../../scheduler';
import Companion from '../../ui/Companion';
import './settings.css';

const minus = (hm, m) => { const [h, mm] = String(hm || '23:00').split(':').map(Number); const t = (h * 60 + mm - m + 1440) % 1440; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
const MODE_TEXT = { essential: 'Essential', smart: 'Smart', all: 'Everything' };

const GROUPS = [
  { k: 'look', l: 'Look & feel', i: Palette, c: '#8f9bff' },
  { k: 'day', l: 'Your day', i: Sunrise, c: '#f5b84d' },
  { k: 'planner', l: 'Planner', i: CalendarClock, c: '#52b79a' },
  { k: 'calendar', l: 'Calendar', i: CalendarDays, c: '#5cb8f5' },
  { k: 'notify', l: 'Notifications', i: Bell, c: '#f58fb0' },
  { k: 'modules', l: 'Sections of the app', i: LayoutGrid, c: '#b794f6' },
  { k: 'data', l: 'Privacy & data', i: Shield, c: '#8a877f' },
];

/* ------------------------------------------------------------------ settings home */
export function Settings() {
  const { settings, push, pop } = useApp();
  const ps = plannerSettings(settings);
  const mods = settings.modules || {};
  const sub = {
    look: `${isStudio(settings) ? 'Studio' : 'Classic'} · ${settings.theme === 'light' ? 'Light' : 'Dark'} · ${PL_COLORS[settings.plannerColor || 'indigo']?.label || 'Indigo'}`,
    day: `Sleep ${fmtHM(settings.bedtimeTarget || '23:00')} – wake ${fmtHM(settings.wakeTarget || '07:00')}`,
    planner: `${ps.sessionMin} min sessions · up to ${ps.capacityH}h a day`,
    calendar: isAndroid ? (ps.calendars.length ? `${ps.calendars.length} calendar${ps.calendars.length > 1 ? 's' : ''} shown` : 'All calendars shown') : 'Works in the Android app',
    notify: settings.notifications === false ? 'Off' : `${MODE_TEXT[settings.notifyMode || 'smart']} reminders`,
    modules: `${MODULES.filter((m) => mods[m.key] !== false).length} of ${MODULES.length} on`,
    data: settings.lastBackup ? `Last backup ${new Date(settings.lastBackup).toLocaleDateString()}` : 'No backup yet',
  };
  return (
    <div className="screen no-nav page-enter set">
      <div className="set-top"><button className="icon-btn ghost" onClick={pop} aria-label="Back"><ChevronLeft size={22} /></button></div>
      <h1 className="set-title">Settings</h1>
      <NameCard />
      <div className="set-group">
        {GROUPS.map((g) => (
          <button key={g.k} className="set-row" onClick={() => push('SettingsPage', { k: g.k })}>
            <span className="ic" style={{ background: g.c }}><g.i size={17} color="#fff" /></span>
            <span className="grow tx"><b>{g.l}</b><small className="ellipsis">{sub[g.k]}</small></span>
            <ChevronRight size={17} className="chev" />
          </button>
        ))}
      </div>
      <div className="set-foot">Kaizen · everything stays on this phone</div>
    </div>
  );
}

function NameCard() {
  const { settings } = useApp();
  const [name, setName] = useState(settings.name || '');
  useEffect(() => setName(settings.name || ''), [settings.name]);
  return (
    <label className="set-name">
      <span className="av"><Companion stage={1} mood="happy" size={40} /></span>
      <span className="grow"><small>Your name</small><input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setKV('name', name.trim())} placeholder="What should Kaizen call you?" /></span>
    </label>
  );
}

/* ------------------------------------------------------------------ building blocks */
const Section = ({ title, note, children }) => (
  <section className="set-sec">
    {title && <div className="set-h">{title}</div>}
    <div className="set-box">{children}</div>
    {note && <div className="set-note">{note}</div>}
  </section>
);
/** One setting: label + plain-language explanation on the left, the control on the right (or below when wide). */
const Item = ({ label, help, children, wide, icon: I }) => (
  <div className={`set-item ${wide ? 'wide' : ''}`}>
    <div className="lbl">{I && <I size={16} className="li" />}<span><b>{label}</b>{help && <small>{help}</small>}</span></div>
    <div className="ctl">{children}</div>
  </div>
);
const Time = ({ value, onChange }) => <input type="time" className="set-time" value={value || ''} onChange={(e) => onChange(e.target.value)} />;
const Num = ({ value, onChange, min, max, suffix }) => (
  <div className="set-num">
    <button onClick={() => onChange(Math.max(min, value - (value > 1000 ? 500 : 1)))} aria-label="Less">−</button>
    <span className="num">{value}{suffix}</span>
    <button onClick={() => onChange(Math.min(max, value + (value >= 1000 ? 500 : 1)))} aria-label="More">+</button>
  </div>
);
const Pills = ({ value, options, onChange }) => (
  <div className="set-pills">{options.map((o) => <button key={String(o.value)} className={o.value === value ? 'on' : ''} onClick={() => { tap(); onChange(o.value); }}>{o.label}</button>)}</div>
);

/* ------------------------------------------------------------------ one page per group */
export function SettingsPage({ k }) {
  const { pop } = useApp();
  const g = GROUPS.find((x) => x.k === k);
  const P = { look: Look, day: Day, planner: Planner, calendar: Calendar, notify: Notify, modules: Modules, data: Data }[k];
  return (
    <div className="screen no-nav page-enter set">
      <div className="set-top"><button className="icon-btn ghost" onClick={pop} aria-label="Back"><ChevronLeft size={22} /></button><span>Settings</span></div>
      <h1 className="set-title sm"><span className="ic" style={{ background: g.c }}><g.i size={18} color="#fff" /></span>{g.l}</h1>
      <P />
    </div>
  );
}

function Look() {
  const { settings } = useApp();
  const set = (k, v) => setKV(k, v);
  const studio = isStudio(settings);
  return (
    <>
      <Section title="App style" note="Studio is the redesigned app (Today · Plan · Focus · Study · Spaces). Classic is the original. Your data is the same in both.">
        <div className="set-pad"><StylePicker value={settings.uiStyle || 'classic'} onChange={(v) => set('uiStyle', v)} /></div>
      </Section>
      <Section title="Appearance">
        <Item label="Theme"><Pills value={settings.theme} onChange={(v) => set('theme', v)} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]} /></Item>
        <Item label={studio ? 'Accent colour' : 'Planner colour'} help={studio ? 'Buttons, highlights and progress' : 'Start buttons and the day timeline'} wide>
          <div className="set-colors">{Object.entries(PL_COLORS).map(([key, c]) => <button key={key} aria-label={c.label} className={(settings.plannerColor || 'indigo') === key ? 'on' : ''} style={{ '--c': settings.theme === 'light' ? c.l[0] : c.d[0] }} onClick={() => set('plannerColor', key)}>{(settings.plannerColor || 'indigo') === key && <Check size={15} strokeWidth={3} />}</button>)}</div>
        </Item>
        {!studio && <Item label="Today layout" help="How the Today tab looks in Classic"><Pills value={settings.todayLayout || 'classic'} onChange={(v) => set('todayLayout', v)} options={TODAY_LAYOUTS} /></Item>}
      </Section>
      <NavEditor />
      <Section title="Study">
        <Item label="Study style" help="Learning journey: a step-by-step path with a celebration after each lesson" wide><Pills value={journeyOn(settings) ? 'journey' : 'roadmap'} onChange={(v) => set('studyStyle', v)} options={[{ value: 'journey', label: 'Learning journey' }, { value: 'roadmap', label: 'Roadmaps' }]} /></Item>
        {!journeyOn(settings) && <Item label="Roadmap look"><Pills value={settings.roadmapStyle || 'route'} onChange={(v) => set('roadmapStyle', v)} options={[{ value: 'route', label: 'List' }, { value: 'path', label: 'Winding path' }]} /></Item>}
      </Section>
      <Section title="Sound">
        <Item label="Sound effects" help="Little chimes when you finish things" icon={Volume2}><Toggle on={settings.sound !== false} onChange={(v) => set('sound', v)} /></Item>
      </Section>
    </>
  );
}

/** Choose the bottom bar: Today is fixed first, then up to four pages in any order. */
function NavEditor() {
  const { settings } = useApp();
  const studio = isStudio(settings);
  const k = navKey(studio);
  const cur = Array.isArray(settings[k]) && settings[k].length ? settings[k] : defaultNav(studio);
  const save = (arr) => { tap(); setKV(k, arr); };
  const move = (i, d) => { const a = [...cur]; const [x] = a.splice(i, 1); a.splice(i + d, 0, x); save(a); };
  const label = (key) => NAV_CHOICES.find((c) => c.key === key)?.label || key;
  const rest = NAV_CHOICES.filter((c) => !cur.includes(c.key));
  return (
    <Section title="Bottom bar" note={cur.length >= 4 ? 'The bar holds Today plus four pages. Remove one to add another.' : 'Pages you leave out stay one tap away — from Spaces or the links on Today.'}>
      <div className="set-nav">
        <div className="nv fixed"><Pin size={14} /><span className="grow">Today</span><small>always first</small></div>
        {cur.map((key, i) => (
          <div key={key} className="nv">
            <span className="n num">{i + 2}</span>
            <span className="grow">{label(key)}</span>
            <button disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp size={16} /></button>
            <button disabled={i === cur.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown size={16} /></button>
            <button disabled={cur.length <= 1} onClick={() => save(cur.filter((x) => x !== key))} aria-label="Remove"><X size={16} /></button>
          </div>
        ))}
      </div>
      {rest.length > 0 && (
        <div className="set-navadd">
          {rest.map((c) => <button key={c.key} disabled={cur.length >= 4} onClick={() => save([...cur, c.key])}><Plus size={14} /> {c.label}</button>)}
        </div>
      )}
      <button className="set-reset" onClick={() => save(defaultNav(studio))}>Reset to default</button>
    </Section>
  );
}

function Day() {
  const { settings, toast } = useApp();
  const set = (k, v) => setKV(k, v);
  return (
    <>
      <Section title="Sleep" note="Used for your energy curve, sleep debt and when the night review appears.">
        <Item label="Bedtime" icon={Moon}><Time value={settings.bedtimeTarget} onChange={(v) => set('bedtimeTarget', v)} /></Item>
        <Item label="Wake up" icon={Sunrise}><Time value={settings.wakeTarget} onChange={(v) => set('wakeTarget', v)} /></Item>
        <Item label="Sleep you need" wide><Pills value={settings.sleepNeed || 8} onChange={(v) => set('sleepNeed', v)} options={[6.5, 7, 7.5, 8, 8.5, 9].map((v) => ({ value: v, label: `${v}h` }))} /></Item>
      </Section>
      <Section title="When a new day starts" note="Up to this time, it still counts as yesterday — so a 2 AM night review goes to the right day. Doing the morning check-in starts the new day early.">
        <Item label="Day starts at"><Time value={settings.dayStart || '06:00'} onChange={(v) => set('dayStart', v || '06:00')} /></Item>
      </Section>
      <Section title="Check-ins">
        <Item label="Morning check-in reminder" help="Log wake time and see the plan"><Time value={settings.morningReminder} onChange={(v) => set('morningReminder', v)} /></Item>
        <Item label="Night review reminder" help={`Before bedtime · at ${fmtHM(minus(settings.bedtimeTarget, settings.nightReviewLead ?? 30))}`} wide><Pills value={settings.nightReviewLead ?? 30} onChange={(v) => set('nightReviewLead', v)} options={[{ value: 15, label: '15 min' }, { value: 30, label: '30 min' }, { value: 60, label: '1 hour' }]} /></Item>
      </Section>
      <Section title="Body">
        <Item label="Usual workout time" icon={HeartPulse}><Time value={settings.workoutTime || '18:00'} onChange={(v) => set('workoutTime', v)} /></Item>
        <Item label="Daily step goal" icon={Footprints}><Num value={settings.stepGoal || 8000} min={1000} max={30000} onChange={(v) => set('stepGoal', v)} /></Item>
        {isNative && <Item label="Health Connect" help={settings.healthConnect ? 'Steps & sleep sync automatically' : 'Sync steps and sleep from your phone'}>
          <button className="set-btn" onClick={async () => { const { hcConnect, hcOpenSettings } = await import('../../lib/health'); if (settings.healthConnect) hcOpenSettings(); else { try { const ok = await hcConnect(); toast(ok ? 'Connected' : 'Not allowed'); } catch { toast('Health Connect is not available'); } } }}>{settings.healthConnect ? 'Manage' : 'Connect'}</button>
        </Item>}
      </Section>
    </>
  );
}

function Planner() {
  const { settings, push } = useApp();
  const ps = plannerSettings(settings);
  const set = (p) => setKV('planner', { ...ps, ...p });
  const [adv, setAdv] = useState(false);
  return (
    <>
      <Section title="Focus sessions" note="The planner splits your tasks into sessions of this length, with a short break between them.">
        <Item label="Session length" wide><Pills value={ps.sessionMin} onChange={(v) => set({ sessionMin: v })} options={[25, 40, 50, 60, 90].map((v) => ({ value: v, label: `${v} min` }))} /></Item>
        <Item label="Break between sessions" wide><Pills value={ps.breakMin} onChange={(v) => set({ breakMin: v })} options={[5, 10, 15].map((v) => ({ value: v, label: `${v} min` }))} /></Item>
        <Item label="Most focus time per day" help="It plans less on low-energy days" wide><Pills value={ps.capacityH} onChange={(v) => set({ capacityH: v })} options={[3, 4, 5, 6, 7, 8, 10].map((v) => ({ value: v, label: `${v}h` }))} /></Item>
      </Section>
      <Section title="Deadlines">
        <Item label="Aim to finish early" help="Days before the deadline the planner tries to be done" wide><Pills value={ps.deadlineBufferDays} onChange={(v) => set({ deadlineBufferDays: v })} options={[0, 1, 2, 3].map((v) => ({ value: v, label: v ? `${v} day${v > 1 ? 's' : ''}` : 'On the day' }))} /></Item>
        <Item label="Gap around classes & meals" help="Free minutes kept before and after fixed things" wide><Pills value={ps.bufferMin} onChange={(v) => set({ bufferMin: v })} options={[0, 5, 10, 15].map((v) => ({ value: v, label: v ? `${v} min` : 'None' }))} /></Item>
      </Section>
      <Section>
        <button className="set-link" onClick={() => push('FixedSchedule')}><span className="grow"><b>Fixed schedule</b><small>Classes, meals, gym, sleep — the planner works around these</small></span><ChevronRight size={16} /></button>
        <button className="set-link" onClick={() => push('PlannerSetup')}><span className="grow"><b>Run planner setup again</b><small>Wake time, best hours, fixed commitments</small></span><ChevronRight size={16} /></button>
      </Section>
      <button className="set-adv" onClick={() => setAdv(!adv)}><Info size={15} /> How long things take (advanced) <ChevronDown size={15} style={{ transform: adv ? 'rotate(180deg)' : 'none' }} /></button>
      {adv && (
        <Section note="When a task has no hours, the planner guesses from its difficulty and multiplies by this. 1.0 = as guessed, 1.5 = takes 50% longer. It also learns this automatically from your finished sessions.">
          {CATEGORIES.map((c) => {
            const v = Math.round((ps.factors[c.value] ?? DEFAULT_FACTORS[c.value] ?? 1) * 10) / 10;
            return <Item key={c.value} label={c.label}><div className="set-num"><button onClick={() => set({ factors: { ...ps.factors, [c.value]: Math.max(0.5, Math.round((v - 0.1) * 10) / 10) } })}>−</button><span className="num">×{v.toFixed(1)}</span><button onClick={() => set({ factors: { ...ps.factors, [c.value]: Math.min(3, Math.round((v + 0.1) * 10) / 10) } })}>+</button></div></Item>;
          })}
        </Section>
      )}
    </>
  );
}

function Calendar() {
  const { settings, toast } = useApp();
  const ps = plannerSettings(settings);
  const [cals, setCals] = useState(null);
  const [granted, setGranted] = useState(null);
  const [pick, setPick] = useState(false);
  const load = async () => {
    if (!isAndroid) return setGranted(false);
    try { const s = await Kaizen.calendarStatus(); setGranted(s.granted); if (s.granted) setCals((await Kaizen.getCalendars()).calendars); } catch { setGranted(false); }
  };
  useEffect(() => { load(); }, []);
  const shown = !cals ? 0 : ps.calendars.length ? cals.filter((c) => ps.calendars.includes(c.id)).length : cals.length;
  return (
    <>
      <Section title="Phone calendars" note="Events from these calendars appear in your day plan, and the planner keeps that time free.">
        {!isAndroid ? <div className="set-pad muted">Calendar sync works in the Android app.</div>
          : !granted ? <Item label="Allow calendar access" help="Read-only. Nothing is changed in your calendar."><button className="set-btn" onClick={async () => { try { const r = await Kaizen.requestCalendar(); setGranted(r.granted); if (r.granted) { await load(); await syncCalendar(settings, Kaizen, isAndroid); replan(settings, 'calendar'); } else toast('Not allowed'); } catch { toast('Not available'); } }}>Allow</button></Item>
            : <button className="set-link" onClick={() => setPick(true)}><span className="grow"><b>Calendars to show</b><small>{shown} of {cals?.length || 0} selected</small></span><ChevronRight size={16} /></button>}
      </Section>
      <Section title="Turn events into tasks" note={`An event whose title starts with “${ps.taskPrefix || '[T]'}” shows up as a task suggestion. Example: “${ps.taskPrefix || '[T]'} Submit lab report”.`}>
        <Item label="Prefix"><input className="set-text" value={ps.taskPrefix} onChange={(e) => setKV('planner', { ...ps, taskPrefix: e.target.value })} /></Item>
      </Section>
      <CalendarSheet open={pick} onClose={() => setPick(false)} cals={cals || []} />
    </>
  );
}

/** Pick calendars: grouped by account, searchable, with select all / none per account. */
function CalendarSheet({ open, onClose, cals }) {
  const { settings } = useApp();
  const ps = plannerSettings(settings);
  const [q, setQ] = useState('');
  const [openAcc, setOpenAcc] = useState({});
  const sel = new Set(ps.calendars.length ? ps.calendars : cals.map((c) => c.id));
  const save = async (next) => { await setKV('planner', { ...ps, calendars: next.size === cals.length ? [] : [...next] }); replan(settings, 'calendar'); };
  const toggle = (id) => { const n = new Set(sel); n.has(id) ? n.delete(id) : n.add(id); if (n.size) save(n); };
  const hex = (c) => (c.color ? `#${(c.color >>> 0).toString(16).padStart(8, '0').slice(2)}` : 'var(--faint)');
  const groups = {};
  cals.filter((c) => !q || (c.name + ' ' + c.account).toLowerCase().includes(q.toLowerCase())).forEach((c) => (groups[c.account || 'On this phone'] ||= []).push(c));
  return (
    <Sheet open={open} onClose={onClose} title="Calendars to show">
      <label className="set-search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search calendars" /></label>
      <div className="set-cal">
        {Object.entries(groups).map(([acc, list]) => {
          const on = list.filter((c) => sel.has(c.id)).length;
          const expanded = q || openAcc[acc] || Object.keys(groups).length === 1;
          return (
            <div key={acc} className="set-acc">
              <button className="hd" onClick={() => setOpenAcc({ ...openAcc, [acc]: !openAcc[acc] })}>
                <span className="grow tx"><b className="ellipsis">{acc}</b><small>{on} of {list.length} shown</small></span>
                <span className="all" onClick={(e) => { e.stopPropagation(); const n = new Set(sel); const allOn = on === list.length; list.forEach((c) => (allOn ? n.delete(c.id) : n.add(c.id))); if (n.size) save(n); }}>{on === list.length ? 'None' : 'All'}</span>
                <ChevronDown size={16} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
              </button>
              {expanded && list.map((c) => (
                <button key={c.id} className="row-c" onClick={() => toggle(c.id)}>
                  <span className="dot" style={{ background: hex(c) }} />
                  <span className="grow ellipsis">{c.name}</span>
                  <span className={`ck ${sel.has(c.id) ? 'on' : ''}`}>{sel.has(c.id) && <Check size={14} strokeWidth={3} />}</span>
                </button>
              ))}
            </div>
          );
        })}
        {!cals.length && <div className="muted small">No calendars found on this phone.</div>}
      </div>
      <button className="btn primary block mt-16" onClick={onClose}>Done</button>
    </Sheet>
  );
}

function Notify() {
  const { settings, toast } = useApp();
  const ps = plannerSettings(settings);
  const setP = (p) => { setKV('planner', { ...ps, ...p }); rescheduleAll(); };
  const set = async (k, v) => { await setKV(k, v); rescheduleAll(); };
  const on = settings.notifications !== false;
  const mode = settings.notifyMode || 'smart';
  return (
    <>
      <Section>
        <Item label="Reminders" help={isNative ? 'Turn every Kaizen notification on or off' : 'Notifications work in the Android app'} icon={Bell}><Toggle on={on} onChange={async (v) => { await set('notifications', v); if (v) await ensurePermission(); }} /></Item>
      </Section>
      {on && (
        <>
          <Section title="How often" note={mode === 'essential' ? 'Only reminders you set yourself, planned sessions and your morning/night check-ins.' : mode === 'all' ? 'Every reminder, exactly when it’s scheduled.' : 'Quiet during sleep and class. Nothing for things already done. Small reminders are grouped into one, at most 4 a day.'}>
            <div className="set-pad"><Seg value={mode} onChange={(v) => set('notifyMode', v)} options={[{ value: 'essential', label: 'Essential' }, { value: 'smart', label: 'Smart' }, { value: 'all', label: 'Everything' }]} /></div>
          </Section>
          <Section title="Tasks & planner">
            <Item label="Deadline reminders" help="Due today, due tomorrow for bigger tasks, and once if overdue"><Toggle on={settings.deadlineNudges !== false} onChange={(v) => set('deadlineNudges', v)} /></Item>
            <Item label="Focus session starts" help="When a planned session is about to begin"><Toggle on={ps.alertSession} onChange={(v) => setP({ alertSession: v })} /></Item>
            <Item label="Evening wrap-up" help="A quick tick-off of the day, then your night review"><Toggle on={ps.alertWrap} onChange={(v) => setP({ alertWrap: v })} /></Item>
            {ps.alertWrap && <Item label="Wrap-up time"><Time value={ps.wrapTime} onChange={(v) => setP({ wrapTime: v })} /></Item>}
            <Item label="Deadline at risk" help="When a task won’t fit before its deadline (once a day)"><Toggle on={ps.alertRisk} onChange={(v) => setP({ alertRisk: v })} /></Item>
          </Section>
          <Section title="Study">
            <Item label="Daily study reminder" help="One per subject; set the time inside each subject"><Toggle on={settings.studyReminders !== false} onChange={(v) => set('studyReminders', v)} /></Item>
            <Item label="Revision reminder" help="Flashcards of lessons you finished"><Time value={settings.reviewTime || '18:30'} onChange={(v) => set('reviewTime', v)} /></Item>
            <Item label="Flashcards per day"><Num value={settings.reviewCap || 12} min={3} max={50} onChange={(v) => set('reviewCap', v)} /></Item>
            <Item label="Learning nuggets" help="Things you saved pop up during the day"><Toggle on={settings.nuggets !== false} onChange={(v) => set('nuggets', v)} /></Item>
            {settings.nuggets !== false && <Item label="Nuggets per day"><Pills value={settings.nuggetsPerDay || 3} onChange={(v) => set('nuggetsPerDay', v)} options={[1, 2, 3, 5].map((v) => ({ value: v, label: String(v) }))} /></Item>}
          </Section>
          <Section title="People">
            <Item label="Reach-out reminder time"><Time value={settings.peopleTime || '09:30'} onChange={(v) => set('peopleTime', v)} /></Item>
            <Item label="Only on weekends"><Toggle on={!!settings.peopleWeekends} onChange={(v) => set('peopleWeekends', v)} /></Item>
          </Section>
          {isNative && (
            <Section title="If reminders arrive late" note="On Poco / HyperOS: App info → Autostart on, and Battery saver → No restrictions.">
              <button className="set-link" onClick={async () => { try { await LocalNotifications.changeExactNotificationSetting(); } catch { toast('Not needed on this Android version'); } }}><span className="grow"><b>Allow on-time reminders</b><small>Lets Android ring reminders at the exact minute</small></span><ChevronRight size={16} /></button>
              <button className="set-link" onClick={async () => { await ensurePermission(); await notifyNow('Kaizen', 'Notifications are working ✓'); }}><span className="grow"><b>Send a test notification</b></span><ChevronRight size={16} /></button>
            </Section>
          )}
        </>
      )}
    </>
  );
}

function Modules() {
  const { settings } = useApp();
  const mods = settings.modules || {};
  return (
    <Section note="Turned-off sections disappear from Today, the menus and quick add. Nothing is deleted.">
      {MODULES.map((m) => <Item key={m.key} label={m.label} help={m.sub} icon={m.icon}><Toggle on={mods[m.key] !== false} onChange={(v) => setKV('modules', { ...mods, [m.key]: v })} /></Item>)}
    </Section>
  );
}

function Data() {
  const { settings, toast, push } = useApp();
  const [pinSheet, setPinSheet] = useState(false);
  const [pin, setPin] = useState('');
  const [wipe, setWipe] = useState(false);
  const fileRef = useRef();
  const doExport = async () => {
    const data = JSON.stringify(await exportAll());
    const name = `kaizen-backup-${today()}.json`;
    if (isNative) {
      try { const r = await Filesystem.writeFile({ path: name, data, directory: Directory.Cache, encoding: Encoding.UTF8 }); await Share.share({ title: 'Kaizen backup', url: r.uri }); } catch { toast('Export failed'); return; }
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); a.download = name; a.click();
    }
    await setKV('lastBackup', Date.now());
  };
  const doImport = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try { await importAll(JSON.parse(await f.text())); toast('Backup restored'); setTimeout(() => location.reload(), 600); } catch (err) { toast(err.message || 'Invalid file'); }
  };
  return (
    <>
      <Section title="Privacy">
        <Item label="PIN lock" help={settings.journalLock ? 'Journal and break-habits need your PIN' : 'Protect your journal and break-habits'} icon={Lock}><Toggle on={!!settings.journalLock} onChange={(v) => { if (v) { setPin(''); setPinSheet(true); } else setKV('journalLock', ''); }} /></Item>
      </Section>
      <Section title="Money">
        <Item label="Currency symbol"><input className="set-text short" value={settings.currency} maxLength={3} onChange={(e) => setKV('currency', e.target.value)} /></Item>
        <button className="set-link" onClick={() => push('CategoriesEdit')}><Tags size={16} className="li" /><span className="grow"><b>Spending categories</b></span><ChevronRight size={16} /></button>
      </Section>
      <Section title="Backup" note={`All your data lives only on this phone. Save a backup now and then${settings.lastBackup ? ` · last saved ${new Date(settings.lastBackup).toLocaleDateString()}` : ''}.`}>
        <button className="set-link" onClick={doExport}><Download size={16} className="li" /><span className="grow"><b>Save a backup</b><small>A file you can keep anywhere</small></span><ChevronRight size={16} /></button>
        <button className="set-link" onClick={() => fileRef.current.click()}><Upload size={16} className="li" /><span className="grow"><b>Restore from a backup</b><small>Replaces what’s on this phone</small></span><ChevronRight size={16} /></button>
        <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={doImport} />
      </Section>
      <Section>
        <button className="set-link danger" onClick={() => setWipe(true)}><Trash2 size={16} className="li" /><span className="grow"><b>Erase everything</b></span></button>
      </Section>
      <Sheet open={pinSheet} onClose={() => setPinSheet(false)} title="Set a 4-digit PIN">
        <input className="input center" style={{ fontSize: 28, letterSpacing: 16, height: 64 }} inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} autoFocus />
        <button className="btn primary block mt-16" disabled={pin.length !== 4} onClick={() => { setKV('journalLock', pin); setPinSheet(false); success(); toast('PIN set'); }}>Save PIN</button>
      </Sheet>
      <Confirm open={wipe} onClose={() => setWipe(false)} title="Erase all data?" body="This can’t be undone. Save a backup first." confirmLabel="Erase" onConfirm={async () => { await db.delete(); location.reload(); }} />
    </>
  );
}
