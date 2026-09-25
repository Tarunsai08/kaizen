// Screen time (UsageStats) + Shield events → local DB, and links to break habits.
import { db } from '../db';
import { today, addDays, ymd } from './date';
import { Kaizen, isAndroid } from './native';

const iconCache = {};
export async function appIcon(pkg) {
  if (!isAndroid) return null;
  if (iconCache[pkg] !== undefined) return iconCache[pkg];
  try {
    const r = await Kaizen.getAppIcon({ pkg });
    iconCache[pkg] = r?.data ? `data:image/png;base64,${r.data}` : null;
  } catch { iconCache[pkg] = null; }
  return iconCache[pkg];
}

export async function hasUsageAccess() {
  if (!isAndroid) return false;
  try { return (await Kaizen.hasUsageAccess()).granted; } catch { return false; }
}

export async function syncScreenTime(days = 7) {
  if (!(await hasUsageAccess())) return false;
  for (let i = 0; i < days; i++) {
    const d = addDays(today(), -i);
    const from = new Date(d + 'T00:00:00').getTime();
    const to = Math.min(Date.now(), from + 86400000);
    if (i > 0 && (await db.screenDays.where('date').equals(d).count()) && i > 1) continue; // older days are final
    try {
      const r = await Kaizen.getUsage({ from, to });
      await db.screenDays.where('date').equals(d).delete();
      const rows = (r.apps || []).filter((a) => a.ms > 30000).map((a) => ({ date: d, pkg: a.pkg, label: a.label, ms: a.ms, launches: a.launches || 0 }));
      rows.push({ date: d, pkg: '__unlocks', label: 'Unlocks', ms: r.unlocks || 0, launches: 0 });
      await db.screenDays.bulkPut(rows);
    } catch (e) { console.warn('usage', e); }
  }
  await applyScreenLimits();
  return true;
}

// Break habits can be linked to apps with a daily limit; going over logs a relapse automatically (once per day).
async function applyScreenLimits() {
  const habits = await db.habits.filter((h) => h.type === 'break' && !h.archived && (h.linkApps || []).length && h.dailyLimit).toArray();
  for (const h of habits) {
    for (let i = 0; i < 7; i++) {
      const d = addDays(today(), -i);
      const rows = await db.screenDays.where('date').equals(d).toArray();
      const ms = rows.filter((r) => h.linkApps.includes(r.pkg)).reduce((a, b) => a + b.ms, 0);
      const mins = Math.round(ms / 60000);
      const existing = await db.urges.where('habitId').equals(h.id).filter((u) => u.auto === 'limit' && u.date === d).first();
      if (mins > h.dailyLimit && !existing) {
        await db.urges.add({ habitId: h.id, kind: 'relapse', date: d, ts: new Date(d + 'T21:00:00').getTime(), trigger: 'Over screen limit', auto: 'limit', notes: `${mins} min (limit ${h.dailyLimit})` });
      }
    }
  }
}

export async function syncShieldEvents() {
  if (!isAndroid) return;
  try {
    const r = await Kaizen.getShieldEvents();
    const evs = r.events || [];
    if (!evs.length) return;
    await db.shieldEvents.bulkAdd(evs.map((e) => ({ type: e.type, pkg: e.pkg, ts: e.ts, date: ymd(new Date(e.ts)) })));
  } catch (e) { console.warn('shield events', e); }
}

export async function pushShieldConfig(cfg) {
  if (!isAndroid) return;
  try { await Kaizen.setShieldConfig({ config: JSON.stringify(cfg) }); } catch (e) { console.warn(e); }
}

export const fmtMs = (ms) => {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

export async function recordGaveUp(pkg) {
  const ts = Date.now();
  const date = today();
  await db.shieldEvents.add({ type: 'gaveup', pkg, ts, date });
  const habits = await db.habits.filter((h) => h.type === 'break' && !h.archived && (h.linkApps || []).includes(pkg)).toArray();
  for (const h of habits) await db.urges.add({ habitId: h.id, kind: 'urge', outcome: 'resisted', date, ts, trigger: 'Shield pause', auto: 'shield' });
}
