import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Footprints, HeartPulse, RefreshCw, BatteryCharging, Zap } from 'lucide-react';
import { db } from '../db';
import { useApp } from '../ctx';
import { today, lastNDays, DAYS_SHORT, dow, hmToMin, fmtHM, fmtDur } from '../lib/date';
import { sleepMinutes } from '../lib/logic';
import { sleepDebt, energyDay, currentZone, minToHM } from '../lib/energy';
import { hcAvailable, hcConnect, hcSync, hcOpenSettings } from '../lib/health';
import { isAndroid } from '../lib/native';
import { SubTabs, useSub, Ring, Stat } from '../ui/kit';
import { Bars } from '../ui/charts';
import { MoveView, SleepView } from './Fitness';
import { MindView } from './Mind';

export function Health() {
  const [view, setView] = useSub('health', 'move');
  const { settings } = useApp();
  useEffect(() => { if (settings.healthConnect) hcSync(3); }, []);
  return (
    <div className="screen fade-in">
      <div className="titlebar"><h1 className="h1">Health</h1></div>
      <SubTabs value={view} onChange={setView} options={[['move', 'Move'], ['sleep', 'Sleep'], ['mind', 'Mind']]} />
      {view === 'move' && <><StepsCard /><div className="mt-12"><MoveView /></div></>}
      {view === 'sleep' && <><EnergyCard /><div className="mt-12"><SleepView /></div></>}
      {view === 'mind' && <MindView />}
    </div>
  );
}

/* ---------- Health Connect connect card ---------- */
function ConnectCard({ what }) {
  const { toast } = useApp();
  const [st, setSt] = useState(null);
  useEffect(() => { hcAvailable().then(setSt); }, []);
  return (
    <div className="banner">
      <HeartPulse size={22} color="var(--accent)" />
      <div className="grow">
        <div style={{ fontWeight: 650 }}>Auto-track {what}</div>
        <div className="small muted">{!isAndroid ? 'Works in the Android app via Health Connect' : st && !st.available ? st.reason : 'Connect Health Connect (Mi Fitness, Google Fit, Samsung Health…)'}</div>
      </div>
      {isAndroid && st?.available && (
        <button className="btn sm primary" onClick={async () => { try { const ok = await hcConnect(); toast(ok ? 'Connected' : 'Permission not granted'); } catch (e) { toast('Could not connect'); } }}>Connect</button>
      )}
    </div>
  );
}

export function StepsCard() {
  const { settings, toast } = useApp();
  const rows = useLiveQuery(() => db.steps.toArray(), []) || [];
  const goal = settings.stepGoal || 8000;
  if (!settings.healthConnect) return <ConnectCard what="steps & sleep" />;
  const t = rows.find((r) => r.date === today())?.count || 0;
  const bars = lastNDays(7).map((d) => ({ label: DAYS_SHORT[dow(d)][0], value: rows.find((r) => r.date === d)?.count || 0, color: (rows.find((r) => r.date === d)?.count || 0) >= goal ? 'var(--fit)' : undefined }));
  const avg7 = Math.round(bars.reduce((a, b) => a + b.value, 0) / 7);
  return (
    <div className="card">
      <div className="row gap-14">
        <Ring size={78} stroke={8} value={t / goal} color="var(--fit)"><Footprints size={22} color="var(--fit)" /></Ring>
        <div className="grow">
          <div className="eyebrow">Steps today</div>
          <div className="h2 num mt-4">{t.toLocaleString('en-IN')}</div>
          <div className="small muted">goal {goal.toLocaleString('en-IN')} · 7-day avg {avg7.toLocaleString('en-IN')}</div>
        </div>
        <button className="icon-btn sm" onClick={async () => { await hcSync(7); toast('Synced'); }} aria-label="Sync"><RefreshCw size={15} /></button>
      </div>
      <div className="mt-16"><Bars data={bars} color="var(--surface-3)" height={80} format={(v) => (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v)} /></div>
    </div>
  );
}

/* ---------- Sleep debt + energy curve (Rise-style) ---------- */
export function useEnergy() {
  const { settings } = useApp();
  const rows = useLiveQuery(() => db.sleep.toArray(), []);
  if (!rows) return null;
  const debt = sleepDebt(rows, settings.sleepNeed || 8);
  const todayRow = rows.find((r) => r.date === today());
  const w = todayRow?.wakeTs ? new Date(todayRow.wakeTs) : null;
  const wakeMin = w ? w.getHours() * 60 + w.getMinutes() : hmToMin(settings.wakeTarget);
  const bedMin = hmToMin(settings.bedtimeTarget);
  const n = new Date();
  const zone = currentZone(wakeMin, bedMin, debt.hours, n.getHours() * 60 + n.getMinutes());
  return { debt, wakeMin, bedMin, zone, logged: !!w };
}

export function EnergyCard() {
  const { settings } = useApp();
  const E = useEnergy();
  if (!E) return null;
  const { debt, wakeMin, bedMin, zone } = E;
  const { pts, zones } = energyDay(wakeMin, bedMin, debt.hours);
  const W = 320, H = 120, pad = 8;
  const x = (i) => pad + (i / (pts.length - 1)) * (W - 2 * pad);
  const y = (e) => H - 18 - e * (H - 34);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.e).toFixed(1)}`).join(' ');
  const n = new Date();
  let nm = n.getHours() * 60 + n.getMinutes();
  if (nm < wakeMin) nm += 1440;
  const ni = Math.round((nm - wakeMin) / 15);
  const zoneColor = { groggy: 'var(--muted)', peak1: 'var(--accent)', dip: 'var(--sleep)', peak2: 'var(--fit)', wind: 'var(--mood)' };
  const debtColor = debt.level === 'Low' ? 'var(--good)' : debt.level === 'Moderate' ? 'var(--warn)' : 'var(--bad)';
  return (
    <div className="card">
      <div className="row between">
        <div>
          <div className="eyebrow">Energy now</div>
          <div className="h3 mt-4" style={{ color: zoneColor[zone.key] || 'var(--text)' }}>{zone.label}{zone.untilLabel ? <span className="muted small" style={{ fontWeight: 500 }}> · until {zone.untilLabel}</span> : null}</div>
          <div className="small muted">{zone.tip}</div>
        </div>
        <Zap size={20} color="var(--accent)" />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="mt-12" style={{ overflow: 'visible' }}>
        {zones.map((z) => {
          const i0 = Math.max(0, (z.from - wakeMin) / 15), i1 = Math.min(pts.length - 1, (z.to - wakeMin) / 15);
          if (i1 <= i0) return null;
          return <rect key={z.key} x={x(i0)} width={x(i1) - x(i0)} y={0} height={H - 18} fill={zoneColor[z.key]} opacity=".08" rx="6" />;
        })}
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
        {ni >= 0 && ni < pts.length && <>
          <line x1={x(ni)} x2={x(ni)} y1={0} y2={H - 18} stroke="var(--text-2)" strokeDasharray="3 3" />
          <circle cx={x(ni)} cy={y(pts[ni].e)} r="5" fill="var(--accent)" stroke="var(--bg)" strokeWidth="2" />
        </>}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const i = Math.round(f * (pts.length - 1));
          return <text key={f} x={x(i)} y={H - 2} fontSize="10" textAnchor="middle" fill="var(--muted)">{fmtHM(minToHM(pts[i].min)).replace(':00', '')}</text>;
        })}
      </svg>
      <div className="row between mt-12 card flat tight">
        <div className="row gap-10"><BatteryCharging size={18} color={debtColor} /><div><div style={{ fontWeight: 620 }}>Sleep debt: <span style={{ color: debtColor }}>{debt.hours.toFixed(1)}h</span></div><div className="tiny muted">{debt.nights ? `last 14 nights vs your ${settings.sleepNeed || 8}h need` : 'log a few nights to calculate'}</div></div></div>
        <span className="badge" style={{ color: debtColor }}>{debt.level}</span>
      </div>
      <div className="tiny muted mt-8">Estimate based on your wake time and recent sleep — not a medical measurement.</div>
    </div>
  );
}
export { sleepMinutes, fmtDur, Stat };
