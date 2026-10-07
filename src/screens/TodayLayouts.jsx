// Small shared pieces for the Today screen. The selectable layouts live in ./today/.
import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Moon, ChevronRight } from 'lucide-react';
import { db } from '../db';
import { useApp } from '../ctx';
import { today, calendarToday, beforeDayStart, addDays } from '../lib/date';

export function YesterdayPrompt() {
  const { push } = useApp();
  const t = today();
  const show = useLiveQuery(async () => {
    if (new Date().getHours() >= 12 || beforeDayStart() || t !== calendarToday()) return false;
    const [jy, jt, sl] = await Promise.all([db.journal.where('date').equals(addDays(t, -1)).first(), db.journal.where('date').equals(t).first(), db.sleep.where('date').equals(t).first()]);
    return !jy && !jt && !(sl && sl.wakeTs);
  }, [t]);
  if (!show) return null;
  return (
    <button className="tl-prompt mt-12" style={{ '--pc': 'var(--sleep)' }} onClick={() => push('NightReview')}>
      <span className="ic"><Moon size={19} /></span>
      <span className="grow" style={{ minWidth: 0, textAlign: 'left' }}><b>Close yesterday</b><small>You didn’t do last night’s review yet</small></span>
      <ChevronRight size={18} />
    </button>
  );
}

