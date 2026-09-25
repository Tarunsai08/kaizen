// Health Connect (Android): steps + sleep. Uses @capgo/capacitor-health.
import { Health } from '@capgo/capacitor-health';
import { db, setKV } from '../db';
import { ymd, today, addDays } from './date';
import { isAndroid } from './native';

export async function hcAvailable() {
  if (!isAndroid) return { available: false, reason: 'Android app only' };
  try {
    const r = await Health.isAvailable();
    return { available: !!r.available, reason: r.reason || (r.available ? '' : 'Install “Health Connect” from the Play Store') };
  } catch (e) { return { available: false, reason: String(e.message || e) }; }
}

export async function hcConnect() {
  await Health.requestAuthorization({ read: ['steps', 'sleep'], write: [] });
  const st = await Health.checkAuthorization({ read: ['steps', 'sleep'], write: [] });
  const ok = (st.readAuthorized || []).includes('steps') || (st.readAuthorized || []).includes('sleep');
  await setKV('healthConnect', ok);
  if (ok) await hcSync(14);
  return ok;
}

export async function hcSync(days = 3) {
  if (!isAndroid) return;
  const start = new Date(addDays(today(), -(days - 1)) + 'T00:00:00');
  const end = new Date();
  // Steps per day
  try {
    const r = await Health.queryAggregated({ dataType: 'steps', startDate: start.toISOString(), endDate: end.toISOString(), bucket: 'day', aggregation: 'sum' });
    for (const s of r.samples || []) {
      const d = ymd(new Date(s.startDate));
      await db.steps.put({ date: d, count: Math.round(s.value || 0) });
    }
  } catch (e) { console.warn('steps', e); }
  // Sleep sessions → sleep table (only fills nights you didn't log by hand)
  try {
    const r = await Health.readSamples({ dataType: 'sleep', startDate: new Date(start.getTime() - 86400000).toISOString(), endDate: end.toISOString(), limit: 200 });
    const sessions = {};
    for (const s of r.samples || []) {
      if (s.sleepState === 'awake') continue;
      const wake = new Date(s.endDate);
      const d = ymd(wake);
      const cur = sessions[d] || { bed: Infinity, wake: 0 };
      cur.bed = Math.min(cur.bed, new Date(s.startDate).getTime());
      cur.wake = Math.max(cur.wake, wake.getTime());
      sessions[d] = cur;
    }
    for (const [d, v] of Object.entries(sessions)) {
      if (v.wake - v.bed < 2 * 3600000) continue; // ignore naps
      const ex = await db.sleep.where('date').equals(d).first();
      if (!ex) await db.sleep.add({ date: d, bedTs: v.bed, wakeTs: v.wake, quality: null, source: 'hc' });
      else if (ex.source === 'hc' || !ex.bedTs || !ex.wakeTs) await db.sleep.update(ex.id, { bedTs: ex.bedTs || v.bed, wakeTs: ex.wakeTs || v.wake, source: ex.source || 'hc' });
    }
  } catch (e) { console.warn('sleep', e); }
  await setKV('hcSyncedAt', Date.now());
  // Habits linked to steps auto-complete
  const habits = await db.habits.filter((h) => h.autoSteps && !h.archived).toArray();
  const stepRows = await db.steps.where('date').aboveOrEqual(addDays(today(), -(days - 1))).toArray();
  for (const h of habits) {
    for (const s of stepRows) {
      const logs = await db.habitLogs.where('[habitId+date]').equals([h.id, s.date]).toArray();
      const auto = logs.find((l) => l.auto);
      const amount = h.unit && /step/i.test(h.unit) ? s.count : s.count >= (h.stepGoal || 8000) ? h.target || 1 : 0;
      if (auto) await db.habitLogs.update(auto.id, { amount });
      else if (amount) await db.habitLogs.add({ habitId: h.id, date: s.date, ts: Date.now(), amount, auto: true });
    }
  }
}

export async function hcOpenSettings() {
  try { await Health.openHealthConnectSettings(); } catch {}
}
