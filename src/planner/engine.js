// Keeps the plan fresh: re-plans whenever something that affects it changes.
import { useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { App as CapApp } from '@capacitor/app';
import { db, getKV, setKV } from '../db';
import { today } from '../lib/date';
import { Kaizen, isAndroid } from '../lib/native';
import { notifyNow, rescheduleSoon } from '../lib/notify';
import { replan, syncCalendar, plannerSettings, editSession, hm12 } from './service';

export function usePlannerEngine(ready, settings) {
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const prev = useRef(null);
  const timer = useRef();
  const lastDay = useRef(today());

  const run = async (reason) => {
    const s = settingsRef.current;
    const out = await replan(s, reason);
    rescheduleSoon();
    if (!out) return;
    const t = today();
    const ps = plannerSettings(s);
    if (reason === 'checkin' && out.sessions.some((x) => x.date === t && x.kind !== 'BREAK') && (await getKV('planReady', '')) !== t) {
      await setKV('planReady', t);
      const todays = out.sessions.filter((x) => x.date === t && x.kind !== 'BREAK');
      notifyNow('Your plan is ready', `${todays.length} focus session${todays.length > 1 ? 's' : ''}, first at ${hm12(todays[0].start)}.`);
    }
    if (ps.alertRisk && out.atRisk.length && (await getKV('riskAlert', '')) !== t) {
      await setKV('riskAlert', t);
      notifyNow('A deadline needs attention', `“${out.atRisk[0].title}” may not fit. Open the week to see options.`);
    }
  };

  // everything that should trigger a re-plan, as one signature per cause
  const parts = useLiveQuery(async () => {
    if (!ready) return null;
    const t = today();
    const [tasks, fixed, cal, moods, sleep, journal, fin, low, pull] = await Promise.all([
      db.tasks.toArray(), db.fixedBlocks.toArray(), db.calEvents.toArray(), db.moods.where('date').equals(t).toArray(),
      db.sleep.where('date').equals(t).first(), db.journal.where('date').equals(t).first(),
      db.plannedSessions.where('date').aboveOrEqual(t).filter((s) => s.state !== 'PLANNED' || s.pinned).toArray(), getKV('lowEnergy', ''), getKV('pull', null),
    ]);
    return {
      tasks: JSON.stringify([tasks.filter((x) => !x.done && !x.skipped).map((x) => [x.id, x.due, x.dueTime, x.difficulty, x.estHours, x.pcat, x.recurrence, x.plan, x.duration, (x.subtasks || []).map((s) => [s.id, s.done, s.difficulty, s.estHours])]), tasks.filter((x) => x.done).length]),
      fixed: JSON.stringify(fixed),
      cal: JSON.stringify(cal.map((e) => [e.id, e.start, e.end, e.treatAs])),
      checkin: JSON.stringify([moods.map((m) => [m.id, m.mood, m.energy]), sleep && [sleep.wakeTs, sleep.bedTs], journal && journal.id, low, pull]),
      sessions: JSON.stringify(fin.map((s) => [s.id, s.state, s.pinned, s.start, s.end, s.date])),
      prefs: JSON.stringify([settings.planner, settings.wakeTarget, settings.bedtimeTarget]),
    };
  }, [ready, settings.planner, settings.wakeTarget, settings.bedtimeTarget]);

  useEffect(() => {
    if (!parts) return;
    const p = prev.current;
    prev.current = parts;
    let reason = 'open';
    if (p) {
      if (p.checkin !== parts.checkin) reason = 'checkin';
      else if (p.sessions !== parts.sessions) reason = /SKIPPED/.test(parts.sessions) && parts.sessions.split('SKIPPED').length > p.sessions.split('SKIPPED').length ? 'skip' : /PARTIAL/.test(parts.sessions) && parts.sessions.split('PARTIAL').length > p.sessions.split('PARTIAL').length ? 'partial' : 'edit';
      else if (p.cal !== parts.cal) reason = 'calendar';
      else if (p.tasks !== parts.tasks || p.fixed !== parts.fixed || p.prefs !== parts.prefs) reason = 'edit';
      else return;
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => run(reason), p ? 500 : 50);
  }, [parts]);

  // one-time cleanup: remove the study to-dos an earlier version added automatically (only unfinished, app-made ones)
  useEffect(() => {
    if (!ready) return;
    (async () => {
      if (await getKV('studyTasksCleared', false)) return;
      const auto = await db.tasks.filter((x) => x.auto === true && !!x.study && !x.done).primaryKeys();
      if (auto.length) await db.tasks.bulkDelete(auto);
      await setKV('studyTasksCleared', true);
    })();
  }, [ready]);

  // calendar: on open, on resume, and live through the content observer
  useEffect(() => {
    if (!ready) return;
    const sync = () => syncCalendar(settingsRef.current, Kaizen, isAndroid);
    sync();
    const h = CapApp.addListener('resume', () => { sync(); run('open'); });
    let obs;
    if (isAndroid) { try { obs = Kaizen.addListener('calendarChanged', () => sync()); } catch {} }
    return () => { h.then((x) => x.remove()); obs && obs.then && obs.then((x) => x.remove()); };
  }, [ready]);

  // every minute: new day -> re-plan; a started session running >10 min over -> extend and re-plan
  useEffect(() => {
    if (!ready) return;
    const i = setInterval(async () => {
      const t = today();
      if (t !== lastDay.current) { lastDay.current = t; run('open'); return; }
      const n = new Date();
      const mins = n.getHours() * 60 + n.getMinutes();
      const over = await db.plannedSessions.where('date').equals(t).filter((s) => s.state === 'PLANNED' && s.startedAt && !s.overrunHandled && mins > s.end + 10).first();
      if (over) { await editSession(over.id, { end: Math.ceil(mins / 5) * 5, overrunHandled: true }); run('overrun'); }
    }, 60000);
    return () => clearInterval(i);
  }, [ready]);
}
