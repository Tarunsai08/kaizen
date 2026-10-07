import React, { useRef, useState } from 'react';
import { Smile, CheckSquare, Wallet, Timer, Wind, Flame, Dumbbell, Moon, Sparkles, Lightbulb, Brain, GraduationCap } from 'lucide-react';
import { useApp } from '../../ctx';
import { Sheet } from '../../ui/kit';
import Companion from '../../ui/Companion';
import './shared.css';

/** The 12 quick-add actions, shared by every layout (each layout styles them its own way). */
export function useQuickAdd(t) {
  const { push, goTab } = useApp();
  return [
    { k: 'mood', l: 'Check in', i: Smile, c: 'var(--mood)', a: () => push('MoodCheckin') },
    { k: 'task', l: 'Task', i: CheckSquare, c: 'var(--task)', a: () => push('TaskForm', { due: t }) },
    { k: 'tx', l: 'Expense', i: Wallet, c: 'var(--money)', a: () => push('TxForm', {}) },
    { k: 'focus', l: 'Focus', i: Timer, c: 'var(--bored)', a: () => push('Focus', {}) },
    { k: 'breathe', l: 'Breathe', i: Wind, c: 'var(--bored)', a: () => push('Breathe', {}) },
    { k: 'urge', l: 'Urge', i: Flame, c: 'var(--break)', a: () => goTab('habits') },
    { k: 'workout', l: 'Workout', i: Dumbbell, c: 'var(--fit)', a: () => push('Workout', { date: t }) },
    { k: 'sleep', l: 'Sleep', i: Moon, c: 'var(--sleep)', a: () => push('SleepLog', {}) },
    { k: 'journal', l: 'Journal', i: Sparkles, c: 'var(--goal)', a: () => push('NightReview') },
    { k: 'learned', l: 'Learned', i: Lightbulb, c: 'var(--goal)', a: () => push('LearningForm') },
    { k: 'revise', l: 'Revise', i: Brain, c: 'var(--task)', a: () => push('ReviewDeck') },
    { k: 'study', l: 'Study', i: GraduationCap, c: 'var(--task)', a: () => goTab('study') },
  ];
}

/** Quick-add sheet; `skin` lets a layout restyle the tiles (and `label` renames the title). */
export function QuickSheet({ open, onClose, t, skin = '', title = 'Quick add', tile }) {
  const items = useQuickAdd(t);
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className={`qa-grid ${skin}`}>
        {items.map((x, i) => (
          <button key={x.k} className="qa-tile" style={{ '--qc': x.c, animationDelay: `${i * 18}ms` }} onClick={() => { onClose(); x.a(); }}>
            {tile ? tile(x) : <><x.i size={22} color={x.c} /><span>{x.l}</span></>}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/** Short-lived "just happened" flags keyed by item, for burst / stamp animations. */
export function useFlash(ms = 900) {
  const [f, setF] = useState({});
  const timers = useRef({});
  const flash = (key, kind = 'done') => {
    setF((s) => ({ ...s, [key]: kind }));
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => setF((s) => { const n = { ...s }; delete n[key]; return n; }), ms);
  };
  return [f, flash];
}

export const Kai = ({ D, size = 48, mood }) => <Companion stage={D.stage.index} mood={mood || (D.allDone ? 'happy' : D.kaiMood)} size={size} />;

/** tiny helper for "3 of 7" style counts */
export const countDone = (arr) => arr.filter((x) => x.done).length;
