import React, { useState } from 'react';
import { ChevronLeft, Check } from 'lucide-react';
import { db, setKV } from '../db';
import { useApp } from '../ctx';
import { Field } from '../ui/kit';
import { HIcon } from '../ui/icons';
import Companion from '../ui/Companion';
import { success, tap } from '../lib/native';

const STARTERS = [
  { key: 'water', type: 'build', name: 'Drink water', icon: 'i:Droplet', color: '#38bdf8', target: 8, unit: 'glass', area: 'body' },
  { key: 'read', type: 'build', name: 'Read', icon: 'i:BookOpen', color: '#a78bfa', target: 20, unit: 'min', step: 5, area: 'mind' },
  { key: 'meditate', type: 'build', name: 'Meditate', icon: 'i:Brain', color: '#f472b6', target: 1, area: 'mind' },
  { key: 'walk', type: 'build', name: 'Walk 8k steps', icon: 'i:Footprints', color: '#fb923c', target: 1, autoSteps: true, stepGoal: 8000, area: 'body' },
  { key: 'workout', type: 'build', name: 'Exercise', icon: 'i:Dumbbell', color: '#fb923c', freq: 'weekly', perWeek: 4, target: 1, area: 'body' },
  { key: 'journal', type: 'build', name: 'Journal', icon: 'i:PenLine', color: '#facc15', target: 1, area: 'mind' },
  { key: 'study', type: 'build', name: 'Deep work', icon: 'i:Laptop', color: '#a78bfa', target: 60, unit: 'min', step: 15, area: 'work' },
  { key: 'scroll', type: 'break', name: 'Doomscrolling', icon: 'i:Smartphone', color: '#f87171' },
  { key: 'junk', type: 'break', name: 'Junk food', icon: 'i:Candy', color: '#f87171' },
];

export default function Onboarding({ onDone }) {
  const { settings } = useApp();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(settings.name || '');
  const [wake, setWake] = useState(settings.wakeTarget || '07:00');
  const [bed, setBed] = useState(settings.bedtimeTarget || '23:00');
  const [picked, setPicked] = useState(['water', 'read', 'scroll']);
  const [comp, setComp] = useState('Kai');
  const finish = async () => {
    await setKV('name', name.trim());
    await setKV('wakeTarget', wake);
    await setKV('bedtimeTarget', bed);
    await setKV('companionName', comp.trim() || 'Kai');
    const existing = await db.habits.count();
    if (!existing) {
      for (const k of picked) {
        const s = STARTERS.find((x) => x.key === k);
        const { key, ...h } = s;
        await db.habits.add({ freq: 'daily', days: [0, 1, 2, 3, 4, 5, 6], perWeek: 3, step: 1, grace: 0, reminder: false, reminderTime: '09:00', unit: '', ...h, createdAt: Date.now(), archived: false });
      }
    }
    await setKV('onboarded', true);
    success();
    onDone();
  };
  const next = () => { tap(); setStep(step + 1); };
  return (
    <div className="onb">
      <div className="row gap-10">
        {step > 0 ? <button className="icon-btn" onClick={() => setStep(step - 1)}><ChevronLeft size={20} /></button> : <span style={{ width: 40 }} />}
        <div className="step-dots grow">{[0, 1, 2, 3].map((i) => <i key={i} className={i <= step ? 'on' : ''} style={i <= step ? { background: 'var(--accent)' } : null} />)}</div>
        <span style={{ width: 40 }} />
      </div>
      <div className="col grow fade-in" key={step} style={{ justifyContent: 'center', gap: 18 }}>
        {step === 0 && (
          <>
            <div className="float" style={{ alignSelf: 'center' }}><Companion stage={1} mood="happy" size={140} /></div>
            <h1 className="h1" style={{ fontSize: 36 }}>Get 1% better,<br />every day.</h1>
            <p className="dim" style={{ margin: 0, fontSize: 16, lineHeight: 1.5 }}>Habits, body, mind, money and time — in one calm place. Everything stays on your phone.</p>
            <Field label="What should I call you?"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" /></Field>
          </>
        )}
        {step === 1 && (
          <>
            <h1 className="h1">Your daily rhythm</h1>
            <p className="dim" style={{ margin: 0 }}>Used for your morning check-in, night review, energy curve and sleep consistency.</p>
            <div className="grid-2">
              <Field label="Usually wake up"><input type="time" className="input" value={wake} onChange={(e) => setWake(e.target.value)} /></Field>
              <Field label="Want to sleep by"><input type="time" className="input" value={bed} onChange={(e) => setBed(e.target.value)} /></Field>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h1 className="h1">Pick a few to start</h1>
            <p className="dim" style={{ margin: 0 }}>Start small. You can add, edit or remove anything later.</p>
            <div className="list">
              {STARTERS.map((s) => {
                const on = picked.includes(s.key);
                return (
                  <button key={s.key} className="list-item" onClick={() => { tap(); setPicked(on ? picked.filter((x) => x !== s.key) : [...picked, s.key]); }}>
                    <div className="tile sm" style={{ background: `color-mix(in srgb, ${s.color} 18%, transparent)` }}><HIcon icon={s.icon} size={16} color={s.color} /></div>
                    <div className="grow"><div style={{ fontWeight: 600 }}>{s.name}</div><div className="tiny muted">{s.type === 'break' ? 'Break' : s.freq === 'weekly' ? `${s.perWeek}× a week` : s.target > 1 ? `${s.target} ${s.unit} a day` : 'Daily'}</div></div>
                    <div className={`task-check ${on ? 'on' : ''}`} style={on ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--accent-ink)' } : null}>{on && <Check size={14} strokeWidth={3} />}</div>
                  </button>
                );
              })}
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <div className="float" style={{ alignSelf: 'center' }}><Companion stage={0} mood="happy" size={140} /></div>
            <h1 className="h1">Meet your companion</h1>
            <p className="dim" style={{ margin: 0 }}>It grows as you do — every habit, workout, reflection and focus session helps. Miss a day and it just waits for you.</p>
            <Field label="Give it a name"><input className="input" value={comp} onChange={(e) => setComp(e.target.value)} maxLength={16} /></Field>
          </>
        )}
      </div>
      <button className="btn primary lg block" onClick={step < 3 ? next : finish}>{step < 3 ? 'Continue' : 'Let’s begin'}</button>
    </div>
  );
}
