import React, { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { FlaskConical, Lightbulb, Plus, Check, X, ChevronRight, Shuffle, Archive, Trash2, Repeat2, Sparkles, Play } from 'lucide-react';
import { db, setKV, getKV } from '../db';
import { useApp } from '../ctx';
import { TopBar, Sheet, Confirm, Field, Chips, Seg, Scale5, Empty, Stat } from '../ui/kit';
import { today, addDays, diffDays, fmtDate, range } from '../lib/date';
import { success, tap } from '../lib/native';

const DO_WORDS = /\b(do|try|start|stop|avoid|take|drink|eat|walk|sleep|wake|meditat|journal|write|read|practice|practise|exercise|run|limit|cut|add|use|spend|call|ask|say|breathe|stretch|fast|morning|night|daily|every day|minutes?|before bed|after)\b/i;
export const guessKind = (t) => (DO_WORDS.test(t) ? 'do' : 'learn');
const SOURCES = ['Podcast', 'Book', 'Video', 'Article', 'Course', 'Conversation', 'Own idea'];

/* ------------------------------------------------ list (inside the Study tab) */
export function Learnings() {
  const { push } = useApp();
  const data = useLiveQuery(async () => ({
    items: await db.learnings.orderBy('id').reverse().toArray(),
    exps: await db.experiments.toArray(),
    logs: await db.expLogs.where('date').equals(today()).toArray(),
  }), []);
  const [nug, setNug] = useState(null);
  if (!data) return null;
  const { items, exps, logs } = data;
  const running = exps.filter((e) => e.status === 'active');
  const toTry = items.filter((l) => l.kind === 'do' && l.status === 'new');
  const nuggets = items.filter((l) => l.kind === 'learn' && l.status !== 'archived');
  const finished = exps.filter((e) => e.status === 'done');
  return (
    <div className="col gap-16">
      <button className="capture" onClick={() => push('LearningForm')}>
        <Plus size={18} /><span className="grow" style={{ textAlign: 'left' }}>What did you just learn?</span>
      </button>

      {items.length === 0 && (
        <div className="card flat">
          <div className="row gap-10"><Sparkles size={18} color="var(--goal)" /><b>Turn what you consume into change</b></div>
          <ol className="guide mt-8">
            <li><b>Stack</b> every takeaway here — share text from any app to Kaizen, or tap above.</li>
            <li><b>Doable</b> ideas (“10 min sunlight after waking”) become small <b>experiments</b>: a few days of trying, a daily check, then keep, tweak or drop.</li>
            <li><b>Learnable</b> ideas become <b>nuggets</b> that pop up at random moments in the day, so they actually stick.</li>
          </ol>
        </div>
      )}

      {running.length > 0 && (
        <div>
          <div className="row between mb-8"><div className="h3">Experiments</div><span className="tiny muted">{running.length} running</span></div>
          <div className="col gap-8">{running.map((e) => <ExperimentCard key={e.id} e={e} log={logs.find((l) => l.expId === e.id)} />)}</div>
        </div>
      )}

      {toTry.length > 0 && (
        <div>
          <div className="row between mb-8"><div className="h3">To try</div><span className="tiny muted">start one at a time</span></div>
          <div className="list">
            {toTry.map((l) => (
              <button key={l.id} className="menu-row" onClick={() => push('LearningDetail', { id: l.id })}>
                <span className="tile sm" style={{ background: 'color-mix(in srgb, var(--habit) 16%, transparent)' }}><FlaskConical size={16} color="var(--habit)" /></span>
                <div className="grow" style={{ minWidth: 0 }}><div className="t ellipsis">{l.title}</div><div className="s ellipsis">{[l.source, l.body].filter(Boolean).join(' · ') || 'Tap to start an experiment'}</div></div>
                <ChevronRight size={16} className="muted" />
              </button>
            ))}
          </div>
        </div>
      )}

      {nuggets.length > 0 && (
        <div>
          <div className="row between mb-8"><div className="h3">Nuggets</div><button className="tiny row gap-4" style={{ color: 'var(--goal)' }} onClick={() => setNug(nuggets[Math.floor(Math.random() * nuggets.length)])}><Shuffle size={13} /> Random</button></div>
          <div className="list">
            {nuggets.slice(0, 30).map((l) => (
              <button key={l.id} className="menu-row" onClick={() => push('LearningDetail', { id: l.id })}>
                <span className="tile sm" style={{ background: 'color-mix(in srgb, var(--goal) 16%, transparent)' }}><Lightbulb size={16} color="var(--goal)" /></span>
                <div className="grow" style={{ minWidth: 0 }}><div className="t ellipsis">{l.title}</div><div className="s ellipsis">{[l.source, l.shown ? `seen ${l.shown}×` : 'new'].filter(Boolean).join(' · ')}</div></div>
              </button>
            ))}
          </div>
        </div>
      )}

      {finished.length > 0 && (
        <div>
          <div className="h3 mb-8">Finished experiments</div>
          <div className="list">
            {finished.map((e) => (
              <button key={e.id} className="menu-row" onClick={() => push('ExperimentDetail', { id: e.id })}>
                <span className={`verdict v-${e.verdict || 'none'}`}>{e.verdict === 'keep' ? 'Kept' : e.verdict === 'drop' ? 'Dropped' : e.verdict === 'tweak' ? 'Tweak' : '—'}</span>
                <div className="grow" style={{ minWidth: 0 }}><div className="t ellipsis">{e.title}</div><div className="s">{e.days} days · ended {fmtDate(e.end)}</div></div>
                <ChevronRight size={16} className="muted" />
              </button>
            ))}
          </div>
        </div>
      )}
      <NuggetSheet l={nug} onClose={() => setNug(null)} />
    </div>
  );
}

function ExperimentCard({ e, log }) {
  const { push } = useApp();
  const day = Math.min(e.days, diffDays(today(), e.start) + 1);
  const over = today() > e.end || e.endedEarly;
  return (
    <div className="card exp" onClick={() => push('ExperimentDetail', { id: e.id })}>
      <div className="row gap-12">
        <span className="tile" style={{ background: 'color-mix(in srgb, var(--habit) 16%, transparent)' }}><FlaskConical size={19} color="var(--habit)" /></span>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="ellipsis" style={{ fontWeight: 650 }}>{e.title}</div>
          <div className="tiny muted">{over ? 'Finished — review the result' : `Day ${day} of ${e.days}`}</div>
        </div>
        {!over && (log ? <span className={`pill-tag ${log.did ? 'ok' : ''}`}>{log.did ? <><Check size={12} /> done</> : 'skipped'}</span> : <CheckIn e={e} />)}
      </div>
      <ExpDots e={e} />
    </div>
  );
}
function ExpDots({ e }) {
  const logs = useLiveQuery(() => db.expLogs.where('expId').equals(e.id).toArray(), [e.id]) || [];
  const days = range(e.start, e.end);
  return (
    <div className="exp-dots mt-12">
      {days.map((d) => {
        const l = logs.find((x) => x.date === d);
        return <i key={d} className={l ? (l.did ? 'y' : 'n') : d < today() ? 'm' : d === today() ? 't' : ''} />;
      })}
    </div>
  );
}
function CheckIn({ e }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn sm primary" onClick={(ev) => { ev.stopPropagation(); setOpen(true); }}>Check in</button>
      <CheckInSheet e={e} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
export function CheckInSheet({ e, open, onClose, date = today() }) {
  const [did, setDid] = useState(null);
  const [feel, setFeel] = useState(0);
  const [note, setNote] = useState('');
  const save = async () => {
    const prev = await db.expLogs.where('[expId+date]').equals([e.id, date]).first();
    const row = { expId: e.id, date, did, feel: feel || null, note: note.trim(), ts: Date.now() };
    if (prev) await db.expLogs.update(prev.id, row); else await db.expLogs.add(row);
    if (did) success();
    onClose(); setDid(null); setFeel(0); setNote('');
  };
  return (
    <Sheet open={open} onClose={onClose} title={e.title}>
      <div className="col gap-16" onClick={(ev) => ev.stopPropagation()}>
        <div className="row">
          <button className={`btn grow ${did === true ? 'primary' : ''}`} onClick={() => setDid(true)}><Check size={18} /> I did it</button>
          <button className={`btn grow ${did === false ? 'danger' : ''}`} onClick={() => setDid(false)}><X size={18} /> Not today</button>
        </div>
        <Field label="How do you feel today?"><Scale5 value={feel} onChange={setFeel} labels={['Worse', '', 'Same', '', 'Better']} /></Field>
        <input className="input" placeholder="Anything you noticed? (optional)" value={note} onChange={(ev) => setNote(ev.target.value)} />
        <button className="btn primary block" disabled={did === null} onClick={save}>Save</button>
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------ capture */
export function LearningForm({ id, prefill }) {
  const { pop, toast } = useApp();
  const [x, setX] = useState(null);
  const [kindTouched, setKindTouched] = useState(!!id);
  useEffect(() => {
    (async () => {
      if (id) setX(await db.learnings.get(id));
      else {
        const lastSource = await getKV('lastLearnSource', 'Podcast');
        const text = prefill?.text || '';
        const [first, ...rest] = text.split(/\n+/);
        const title = first.length > 120 && !rest.length ? first.slice(0, 117) + '…' : first;
        const body = rest.length ? rest.join('\n') : first.length > 120 ? first : '';
        setX({ title, body, source: prefill?.source || lastSource, from: prefill?.subject || '', kind: guessKind(text), status: 'new', shown: 0 });
      }
    })();
  }, [id]);
  if (!x) return <div className="screen no-nav" />;
  const set = (p) => setX((o) => ({ ...o, ...p }));
  const save = async () => {
    const row = { ...x, title: x.title.trim(), body: (x.body || '').trim() };
    if (id) await db.learnings.put(row);
    else { await db.learnings.add({ ...row, date: today(), ts: Date.now() }); await setKV('lastLearnSource', x.source); }
    toast(x.kind === 'do' ? 'Saved to “To try”' : 'Saved as a nugget');
    pop();
  };
  return (
    <div className="screen no-nav page-enter">
      <TopBar title={id ? 'Edit learning' : 'New learning'} />
      <div className="col gap-16">
        <Field label="The takeaway"><textarea className="textarea" style={{ minHeight: 70 }} autoFocus={!id} placeholder="e.g. Get 10 minutes of morning sunlight within an hour of waking" value={x.title} onChange={(e) => { set({ title: e.target.value, ...(kindTouched ? {} : { kind: guessKind(e.target.value) }) }); }} /></Field>
        <Field label="Details (optional)"><textarea className="textarea" style={{ minHeight: 60 }} placeholder="Why it works, numbers, the exact protocol…" value={x.body} onChange={(e) => set({ body: e.target.value })} /></Field>
        <Field label="Is it something to…">
          <div className="kind-pick">
            <button className={x.kind === 'do' ? 'on do' : ''} onClick={() => { setKindTouched(true); set({ kind: 'do' }); }}><FlaskConical size={20} /><b>Do</b><span>Try it as an experiment</span></button>
            <button className={x.kind === 'learn' ? 'on learn' : ''} onClick={() => { setKindTouched(true); set({ kind: 'learn' }); }}><Lightbulb size={20} /><b>Remember</b><span>Pops up during the day</span></button>
          </div>
        </Field>
        <Field label="Source"><Chips wrap value={x.source} onChange={(v) => set({ source: v })} options={SOURCES} /></Field>
        <Field label="From (optional)"><input className="input" placeholder="e.g. Huberman Lab #120, The Ranveer Show" value={x.from || ''} onChange={(e) => set({ from: e.target.value })} /></Field>
        <button className="btn primary block lg" disabled={!x.title.trim()} onClick={save}>Save</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------ detail (start experiment / nugget) */
export function LearningDetail({ id }) {
  const { push, pop, toast } = useApp();
  const l = useLiveQuery(() => db.learnings.get(id), [id]);
  const exps = useLiveQuery(() => db.experiments.where('learningId').equals(id).toArray(), [id]) || [];
  const [start, setStart] = useState(false);
  const [del, setDel] = useState(false);
  if (!l) return <div className="screen no-nav" />;
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="" right={<button className="icon-btn" onClick={() => push('LearningForm', { id })}><Sparkles size={18} /></button>} />
      <div className="eyebrow" style={{ color: l.kind === 'do' ? 'var(--habit)' : 'var(--goal)' }}>{l.kind === 'do' ? 'To try' : 'Nugget'} · {[l.source, l.from].filter(Boolean).join(' · ')}</div>
      <h1 className="h1 mt-8" style={{ fontSize: 26, lineHeight: 1.2 }}>{l.title}</h1>
      {l.body && <p className="dim" style={{ whiteSpace: 'pre-wrap' }}>{l.body}</p>}
      <div className="tiny muted">Saved {fmtDate(l.date)}{l.shown ? ` · shown ${l.shown}×` : ''}</div>

      {l.kind === 'do' && (
        <div className="card mt-24">
          <div className="row gap-10"><FlaskConical size={18} color="var(--habit)" /><b>Run it as an experiment</b></div>
          <p className="small dim" style={{ margin: '6px 0 12px' }}>Do it for a few days with a 5-second daily check. Kaizen compares your mood, sleep and focus with the days before, then you decide: keep it as a habit, tweak it, or drop it.</p>
          {exps.some((e) => e.status === 'active') ? <button className="btn block" onClick={() => push('ExperimentDetail', { id: exps.find((e) => e.status === 'active').id })}>View running experiment</button> : <button className="btn primary block" onClick={() => setStart(true)}><Play size={16} /> Start experiment</button>}
        </div>
      )}
      <div className="list mt-16">
        <button className="menu-row" onClick={async () => { await db.learnings.update(id, { kind: l.kind === 'do' ? 'learn' : 'do' }); toast('Moved'); }}><Repeat2 size={18} /><div className="grow"><div className="t">Move to {l.kind === 'do' ? 'nuggets (remember)' : 'to try (do)'}</div></div></button>
        <button className="menu-row" onClick={async () => { await db.learnings.update(id, { status: l.status === 'archived' ? 'new' : 'archived' }); toast(l.status === 'archived' ? 'Restored' : 'Archived — no more pop-ups'); pop(); }}><Archive size={18} /><div className="grow"><div className="t">{l.status === 'archived' ? 'Restore' : 'Archive'}</div><div className="s">{l.kind === 'learn' ? 'Stop showing it in pop-ups' : 'Hide from To try'}</div></div></button>
        <button className="menu-row" onClick={() => setDel(true)}><Trash2 size={18} color="var(--bad)" /><div className="grow"><div className="t" style={{ color: 'var(--bad)' }}>Delete</div></div></button>
      </div>
      <StartExperiment open={start} onClose={() => setStart(false)} l={l} />
      <Confirm open={del} onClose={() => setDel(false)} title="Delete this learning?" onConfirm={async () => { await db.learnings.delete(id); pop(); }} />
    </div>
  );
}
function StartExperiment({ open, onClose, l }) {
  const { push, pop } = useApp();
  const [days, setDays] = useState(14);
  const [title, setTitle] = useState('');
  useEffect(() => { if (open) setTitle(l.title); }, [open]);
  return (
    <Sheet open={open} onClose={onClose} title="Start experiment">
      <div className="col gap-16">
        <Field label="What exactly will you do?"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="For how long?"><Chips value={days} onChange={setDays} options={[7, 14, 21, 30].map((d) => ({ value: d, label: `${d} days` }))} /></Field>
        <p className="tiny muted" style={{ margin: 0 }}>You’ll get a check-in on Today each day. Keep it small enough to do even on a bad day.</p>
        <button className="btn primary block" disabled={!title.trim()} onClick={async () => {
          const s = today();
          const eid = await db.experiments.add({ learningId: l.id, title: title.trim(), days, start: s, end: addDays(s, days - 1), status: 'active', created: Date.now() });
          await db.learnings.update(l.id, { status: 'active' });
          success(); onClose(); pop(); push('ExperimentDetail', { id: eid });
        }}>Start today</button>
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------ experiment detail + result */
export function ExperimentDetail({ id }) {
  const { push, pop, toast, celebrate } = useApp();
  const e = useLiveQuery(() => db.experiments.get(id), [id]);
  const data = useLiveQuery(async () => {
    if (!e) return null;
    const logs = await db.expLogs.where('expId').equals(id).toArray();
    const before0 = addDays(e.start, -e.days), before1 = addDays(e.start, -1);
    const [moods, sleep, focus, steps] = await Promise.all([db.moods.toArray(), db.sleep.toArray(), db.focus.toArray(), db.steps.toArray()]);
    const inR = (d, a, b) => d >= a && d <= b;
    const endD = e.end < today() ? e.end : today();
    const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
    const metric = (a, b) => ({
      mood: avg(moods.filter((m) => inR(m.date, a, b)).map((m) => m.mood)),
      sleep: avg(sleep.filter((s) => inR(s.date, a, b) && s.bed && s.wake).map((s) => { const [bh, bm] = s.bed.split(':').map(Number); const [wh, wm] = s.wake.split(':').map(Number); return ((wh * 60 + wm - (bh * 60 + bm) + 1440) % 1440) / 60; })),
      focus: focus.some((f) => inR(f.date, a, b)) ? avg(range(a, b).map((d) => focus.filter((f) => f.date === d).reduce((x, y) => x + y.minutes, 0))) : null,
      steps: avg(steps.filter((s) => inR(s.date, a, b)).map((s) => s.count)),
    });
    return { logs, before: metric(before0, before1), during: metric(e.start, endD) };
  }, [e]);
  const [check, setCheck] = useState(false);
  const [end, setEnd] = useState(false);
  if (!e || !data) return <div className="screen no-nav" />;
  const did = data.logs.filter((l) => l.did).length;
  const logged = data.logs.length;
  const feel = data.logs.filter((l) => l.feel).map((l) => l.feel);
  const feelAvg = feel.length ? feel.reduce((a, b) => a + b, 0) / feel.length : null;
  const over = today() > e.end || e.endedEarly;
  const todayLog = data.logs.find((l) => l.date === today());
  const verdict = async (v) => {
    await db.experiments.update(id, { status: 'done', verdict: v, end: e.end < today() ? e.end : today() });
    await db.learnings.update(e.learningId, { status: v === 'keep' ? 'kept' : 'done' });
    if (v === 'keep') { celebrate(); toast('Now make it a habit'); pop(); push('HabitForm', { prefill: { name: e.title.slice(0, 60), type: 'build' } }); }
    else if (v === 'tweak') { pop(); push('LearningDetail', { id: e.learningId }); }
    else { toast('Dropped — good to know'); pop(); }
  };
  const Row = ({ k, a, b, fmt, better = 1 }) => {
    const delta = a != null && b != null ? b - a : null;
    const good = delta != null && delta * better > 0;
    return (
      <div className="cmp-row"><span className="k">{k}</span><span className="v muted">{a == null ? '—' : fmt(a)}</span><span className="v">{b == null ? '—' : fmt(b)}</span>
        <span className="d" style={{ color: delta == null || Math.abs(delta) < 1e-9 ? 'var(--muted)' : good ? 'var(--good)' : 'var(--bad)' }}>{delta == null || Math.abs(delta) < 1e-9 ? '' : (delta > 0 ? '+' : '') + fmt(delta)}</span></div>
    );
  };
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="Experiment" />
      <div className="eyebrow" style={{ color: 'var(--habit)' }}>{over || e.status === 'done' ? 'Result' : `Day ${Math.min(e.days, diffDays(today(), e.start) + 1)} of ${e.days}`}</div>
      <h1 className="h1 mt-8" style={{ fontSize: 26, lineHeight: 1.2 }}>{e.title}</h1>
      <div className="card mt-16"><ExpDots e={e} /><div className="grid-3 mt-16"><Stat v={`${did}/${e.days}`} k="days done" color="var(--habit)" /><Stat v={logged ? Math.round((did / logged) * 100) + '%' : '—'} k="consistency" /><Stat v={feelAvg ? feelAvg.toFixed(1) : '—'} k="felt (1–5)" /></div></div>
      <div className="card mt-12">
        <div className="h3">Before vs during</div>
        <div className="tiny muted mb-8">{e.days} days before the experiment vs the experiment so far</div>
        <div className="cmp-row h"><span className="k" /><span className="v">Before</span><span className="v">During</span><span className="d" /></div>
        <Row k="Mood" a={data.before.mood} b={data.during.mood} fmt={(v) => v.toFixed(1)} />
        <Row k="Sleep" a={data.before.sleep} b={data.during.sleep} fmt={(v) => v.toFixed(1) + 'h'} />
        <Row k="Focus / day" a={data.before.focus} b={data.during.focus} fmt={(v) => Math.round(v) + 'm'} />
        <Row k="Steps" a={data.before.steps} b={data.during.steps} fmt={(v) => Math.round(v).toLocaleString('en-IN')} />
        <div className="tiny muted mt-8">Small samples are noisy — trust how you felt as much as the numbers.</div>
      </div>
      {e.status === 'active' && !over && (
        <div className="row mt-16">
          <button className="btn grow" onClick={() => setEnd(true)}>End early</button>
          <button className="btn primary grow" onClick={() => setCheck(true)}>{todayLog ? 'Update today' : 'Check in today'}</button>
        </div>
      )}
      {e.status === 'active' && over && (
        <div className="card mt-16">
          <div style={{ fontWeight: 650 }}>What’s the verdict?</div>
          <div className="col gap-8 mt-12">
            <button className="btn primary block" onClick={() => verdict('keep')}><Check size={17} /> Keep — make it a habit</button>
            <button className="btn block" onClick={() => verdict('tweak')}><Repeat2 size={17} /> Tweak and try again</button>
            <button className="btn block" onClick={() => verdict('drop')}><X size={17} /> Drop it</button>
          </div>
        </div>
      )}
      {data.logs.filter((l) => l.note).length > 0 && (
        <div className="card mt-12"><div className="h3 mb-8">Notes</div>{data.logs.filter((l) => l.note).sort((a, b) => (a.date < b.date ? 1 : -1)).map((l) => <div key={l.id} className="small mt-4"><span className="muted">{fmtDate(l.date)} · </span>{l.note}</div>)}</div>
      )}
      <CheckInSheet e={e} open={check} onClose={() => setCheck(false)} />
      <Confirm open={end} onClose={() => setEnd(false)} title="End the experiment now?" body="You’ll pick a verdict next." confirmLabel="End now" onConfirm={() => db.experiments.update(id, { end: today(), endedEarly: true })} />
    </div>
  );
}

/* ------------------------------------------------ nuggets: pop-up + sheet */
export function NuggetSheet({ l, onClose }) {
  const { push } = useApp();
  useEffect(() => { if (l) db.learnings.update(l.id, { shown: (l.shown || 0) + 1, lastShown: Date.now() }); }, [l?.id]);
  return (
    <Sheet open={!!l} onClose={onClose}>
      {l && (
        <div className="col gap-8">
          <div className="row gap-8"><Lightbulb size={18} color="var(--goal)" /><span className="eyebrow" style={{ color: 'var(--goal)' }}>Remember this?</span></div>
          <div className="h2" style={{ lineHeight: 1.25 }}>{l.title}</div>
          {l.body && <p className="dim" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{l.body}</p>}
          {(l.source || l.from) && <div className="tiny muted">{[l.source, l.from].filter(Boolean).join(' · ')}</div>}
          <div className="row mt-16">
            <button className="btn grow" onClick={async () => { await db.learnings.update(l.id, { status: 'archived' }); onClose(); }}><Archive size={16} /> I know it</button>
            <button className="btn primary grow" onClick={onClose}>Got it</button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
export function Nugget({ id }) {
  const { pop } = useApp();
  const l = useLiveQuery(() => db.learnings.get(id), [id]);
  if (!l) return <div className="screen no-nav" />;
  return <div className="screen no-nav"><NuggetSheet l={l} onClose={pop} /></div>;
}

/** In-app random nugget: at most one every 3 hours, 10:00–21:00, never on the same open as another prompt. */
export function NuggetPrompt({ blocked }) {
  const { settings } = useApp();
  const [l, setL] = useState(null);
  useEffect(() => {
    if (blocked || settings.nuggets === false) return;
    const t = setTimeout(async () => {
      const h = new Date().getHours();
      if (h < 10 || h >= 21) return;
      const last = await getKV('lastNugget', 0);
      if (Date.now() - last < 3 * 3600 * 1000) return;
      if (document.querySelector('.sheet')) return;
      const list = (await db.learnings.where('kind').equals('learn').toArray()).filter((x) => x.status !== 'archived');
      if (!list.length || Math.random() < 0.35) return;
      const w = list.map((x) => 1 / (1 + (x.shown || 0)));
      let r = Math.random() * w.reduce((a, b) => a + b, 0);
      let pick = list[0];
      for (let i = 0; i < list.length; i++) { r -= w[i]; if (r <= 0) { pick = list[i]; break; } }
      await setKV('lastNugget', Date.now());
      setL(pick);
    }, 6000);
    return () => clearTimeout(t);
  }, [blocked]);
  return <NuggetSheet l={l} onClose={() => setL(null)} />;
}

/* Today card: experiment check-ins */
export function ExperimentsToday() {
  const data = useLiveQuery(async () => {
    const exps = (await db.experiments.where('status').equals('active').toArray()).filter((e) => e.start <= today());
    const logs = await db.expLogs.where('date').equals(today()).toArray();
    return { exps, logs };
  }, []);
  if (!data || !data.exps.length) return null;
  return (
    <div className="col gap-8">
      {data.exps.map((e) => <ExperimentCard key={e.id} e={e} log={data.logs.find((l) => l.expId === e.id)} />)}
    </div>
  );
}
