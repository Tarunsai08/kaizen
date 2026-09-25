import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, MessageSquareText, ChevronRight, Repeat, Trash2, TrendingUp, TrendingDown, Tag, Smartphone, ClipboardPaste, Check } from 'lucide-react';
import { db, setKV, getKV } from '../db';
import { useApp } from '../ctx';
import { today, periodRange, prevPeriodRange, buckets, fmtDay, fmtTime, ymd, periodLabel, addDays } from '../lib/date';
import { money, moneyShort, detectSubscriptions, monthlyCost, nextRenewal, normMerchant } from '../lib/logic';
import { parseSms, smsKey, guessCategory } from '../lib/sms';
import { readBankSms, platform, success, tap } from '../lib/native';
import { TopBar, Seg, Field, Sheet, Chips, PeriodToggle, Stat, Empty, Confirm, CategorySelect, Toggle } from '../ui/kit';
import { Bars, HBars, Donut } from '../ui/charts';
import { SectionHead } from '../ui/rows';

const useCats = () => useLiveQuery(() => db.categories.where('kind').anyOf(['finance', 'income']).toArray(), []) || [];

/* Auto-import new bank SMS (Android only, silent when permission already granted) */
export async function syncSms({ quiet = true } = {}) {
  if (platform !== 'android') return 0;
  try {
    const { SmsReader } = await import('../lib/native');
    if (quiet) {
      const p = await SmsReader.checkPermissions();
      if (p.sms !== 'granted') return 0;
    }
    const since = (await getKV('lastSmsTs', 0)) || Date.now() - 30 * 86400000;
    const msgs = await readBankSms(since);
    return await importMessages(msgs);
  } catch (e) {
    if (!quiet) throw e;
    return 0;
  }
}

export async function importMessages(msgs) {
  const cats = await db.categories.where('kind').anyOf(['finance', 'income']).toArray();
  let added = 0;
  let maxTs = (await getKV('lastSmsTs', 0)) || 0;
  for (const m of msgs) {
    maxTs = Math.max(maxTs, m.date || 0);
    const p = parseSms(m.body, m.date);
    if (!p) continue;
    const key = smsKey(m.body, m.date);
    if (await db.transactions.where('smsKey').equals(key).count()) continue;
    const guess = p.direction === 'debit' ? guessCategory(p.merchant, cats) : null;
    await db.transactions.add({
      ts: p.ts, date: ymd(new Date(p.ts)), amount: p.amount, direction: p.direction, merchant: p.merchant || m.address || '',
      categoryId: guess?.id || null, needWant: guess?.needWant || 'need', note: '', source: 'sms', smsKey: key, tagged: 0, raw: p.raw,
    });
    added++;
  }
  if (maxTs) await setKV('lastSmsTs', maxTs);
  return added;
}

/* =========================================================
   MONEY TAB
   ========================================================= */
export function Money() {
  const { push, settings, toast } = useApp();
  const [period, setPeriod] = useState('month');
  const cats = useCats();
  const txs = useLiveQuery(() => db.transactions.toArray(), []);
  const subs = useLiveQuery(() => db.subscriptions.toArray(), []) || [];
  if (!txs) return <div className="screen" />;
  const cur = settings.currency;
  const [from, to] = periodRange(period);
  const inR = txs.filter((x) => x.date >= from && x.date <= to);
  const spent = inR.filter((x) => x.direction === 'debit').reduce((a, b) => a + b.amount, 0);
  const recv = inR.filter((x) => x.direction === 'credit').reduce((a, b) => a + b.amount, 0);
  const saved = recv - spent;
  const rate = recv ? saved / recv : null;
  const untagged = txs.filter((x) => !x.tagged);
  const byCat = {};
  inR.filter((x) => x.direction === 'debit').forEach((x) => (byCat[x.categoryId || 0] = (byCat[x.categoryId || 0] || 0) + x.amount));
  const catItems = Object.entries(byCat).map(([id, v]) => { const c = cats.find((z) => z.id === Number(id)); return { label: c?.name || 'Untagged', icon: c?.icon || '❔', value: v, color: c?.color || 'var(--faint)' }; }).sort((a, b) => b.value - a.value);
  const need = inR.filter((x) => x.direction === 'debit' && x.tagged && x.needWant === 'need').reduce((a, b) => a + b.amount, 0);
  const want = inR.filter((x) => x.direction === 'debit' && x.tagged && x.needWant === 'want').reduce((a, b) => a + b.amount, 0);
  const subTotal = subs.filter((s) => s.active).reduce((a, s) => a + monthlyCost(s), 0);
  const recent = [...txs].sort((a, b) => b.ts - a.ts).slice(0, 8);

  return (
    <div className="screen fade-in">
      <div className="row between" style={{ marginBottom: 16, marginTop: 4 }}>
        <h1 className="h1">Money</h1>
        <button className="icon-btn" onClick={() => push('TxForm', {})} aria-label="Add"><Plus size={22} /></button>
      </div>
      <PeriodToggle value={period} onChange={setPeriod} />

      <div className="hero mt-12">
        <div className="glow" style={{ background: 'var(--money)', right: -90, top: -100 }} />
        <div className="eyebrow">{periodLabel[period]} · spent</div>
        <div className="big-num mt-8 num" style={{ fontSize: 40 }}>{money(spent, cur)}</div>
        <div className="grid-2 mt-16">
          <div><div className="tiny muted">Received</div><div className="h3 num" style={{ color: 'var(--good)' }}>{money(recv, cur)}</div></div>
          <div><div className="tiny muted">Saved{rate != null ? ` · ${Math.round(rate * 100)}%` : ''}</div><div className="h3 num" style={{ color: saved >= 0 ? 'var(--text)' : 'var(--bad)' }}>{money(saved, cur)}</div></div>
        </div>
      </div>

      {untagged.length > 0 && (
        <button className="card card-press row gap-14 mt-12" style={{ width: '100%', textAlign: 'left', background: 'color-mix(in srgb, var(--money) 12%, var(--surface))' }} onClick={() => push('TagReview')}>
          <Tag size={20} color="var(--money)" />
          <div className="grow"><div className="h3">{untagged.length} to tag</div><div className="small muted">Quick review — takes a few seconds</div></div>
          <ChevronRight size={18} className="muted" />
        </button>
      )}

      <div className="grid-2 mt-12">
        <button className="card card-press" style={{ textAlign: 'left' }} onClick={() => push('SmsImport')}>
          <MessageSquareText size={18} color="var(--money)" />
          <div className="h3 mt-8">Bank SMS</div>
          <div className="small muted">{platform === 'android' ? 'Scan inbox' : 'Paste to import'}</div>
        </button>
        <button className="card card-press" style={{ textAlign: 'left' }} onClick={() => push('Subscriptions')}>
          <Repeat size={18} color="var(--task)" />
          <div className="h3 mt-8 num">{moneyShort(subTotal, cur)}<span className="small muted">/mo</span></div>
          <div className="small muted">{subs.filter((s) => s.active).length} subscriptions</div>
        </button>
      </div>

      <div className="section">
        <SectionHead title="Where it went" link="Insights" onLink={() => push('MoneyInsights')} />
        <div className="card"><HBars items={catItems.slice(0, 6)} format={(v) => money(v, cur)} /></div>
      </div>

      {need + want > 0 && (
        <div className="card mt-12 row gap-18">
          <Donut size={96} stroke={13} parts={[{ value: need, color: 'var(--money)' }, { value: want, color: 'var(--mood)' }]} center={<div><div className="h3 num">{Math.round((need / (need + want)) * 100)}%</div><div className="tiny muted">needs</div></div>} />
          <div className="col gap-6 grow">
            <div className="row between small"><span className="row gap-6"><i className="pill-dot" style={{ background: 'var(--money)' }} />Needs</span><b className="num">{money(need, cur)}</b></div>
            <div className="row between small"><span className="row gap-6"><i className="pill-dot" style={{ background: 'var(--mood)' }} />Wants</span><b className="num">{money(want, cur)}</b></div>
          </div>
        </div>
      )}

      <div className="section">
        <SectionHead title="Recent" link="All" onLink={() => push('AllTx')} />
        {recent.length ? <TxList txs={recent} cats={cats} /> : <Empty icon="💸" title="No transactions yet" sub="Add one manually or import your bank SMS." />}
      </div>
    </div>
  );
}

export function TxList({ txs, cats }) {
  const { push, settings } = useApp();
  return (
    <div className="list">
      {txs.map((x) => {
        const c = cats.find((z) => z.id === x.categoryId);
        return (
          <button key={x.id} className="list-item" onClick={() => push('TxForm', { id: x.id })}>
            <div className="swatch" style={{ background: 'var(--surface-2)' }}>{c?.icon || (x.direction === 'credit' ? '💰' : '❔')}</div>
            <div className="grow">
              <div className="ellipsis" style={{ fontWeight: 560 }}>{x.merchant || c?.name || (x.direction === 'credit' ? 'Money in' : 'Payment')}</div>
              <div className="tiny muted">{fmtDay(x.date)} · {c?.name || 'Untagged'}{x.tagged && x.direction === 'debit' ? ` · ${x.needWant}` : ''}{x.source === 'sms' ? ' · SMS' : ''}</div>
            </div>
            <div className="num" style={{ fontWeight: 650, color: x.direction === 'credit' ? 'var(--good)' : 'var(--text)' }}>{x.direction === 'credit' ? '+' : '−'}{money(x.amount, settings.currency).replace('−', '')}</div>
          </button>
        );
      })}
    </div>
  );
}

export function AllTx() {
  const cats = useCats();
  const [q, setQ] = useState('');
  const [dir, setDir] = useState('all');
  const txs = useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray(), []) || [];
  const f = txs.filter((x) => (dir === 'all' || x.direction === dir) && (!q || `${x.merchant} ${x.note}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="Transactions" />
      <input className="input mb-12" placeholder="Search merchant or note" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mb-12"><Seg value={dir} onChange={setDir} options={[{ value: 'all', label: 'All' }, { value: 'debit', label: 'Spent' }, { value: 'credit', label: 'Received' }]} /></div>
      {f.length ? <TxList txs={f.slice(0, 300)} cats={cats} /> : <Empty title="Nothing here" />}
    </div>
  );
}

/* =========================================================
   ADD / EDIT TRANSACTION
   ========================================================= */
export function TxForm({ id }) {
  const { pop, toast, settings } = useApp();
  const cats = useCats();
  const [x, setX] = useState(null);
  const [del, setDel] = useState(false);
  useEffect(() => { (async () => setX(id ? await db.transactions.get(id) : { direction: 'debit', amount: '', merchant: '', categoryId: null, needWant: 'need', note: '', date: today(), ts: Date.now(), source: 'manual' }))(); }, [id]);
  if (!x) return <div className="screen no-nav" />;
  const set = (p) => setX((v) => ({ ...v, ...p }));
  const pickCat = (cid) => { const c = cats.find((z) => z.id === cid); set({ categoryId: cid, needWant: c?.needWant || x.needWant }); };
  const save = async () => {
    const amount = parseFloat(String(x.amount).replace(/,/g, ''));
    if (!amount) return toast('Enter an amount');
    const row = { ...x, amount, tagged: x.categoryId ? 1 : 0, ts: x.date === ymd(new Date(x.ts)) ? x.ts : new Date(x.date + 'T12:00').getTime() };
    if (id) await db.transactions.put(row); else await db.transactions.add(row);
    success(); toast('Saved'); pop();
  };
  return (
    <div className="screen no-nav page-enter">
      <TopBar title={id ? 'Transaction' : 'Add transaction'} right={<button className="btn sm primary" onClick={save}>Save</button>} />
      <div className="form">
        <Seg value={x.direction} onChange={(v) => set({ direction: v, categoryId: null })} options={[{ value: 'debit', label: 'Spent' }, { value: 'credit', label: 'Received' }]} />
        <div className="row" style={{ alignItems: 'baseline' }}>
          <span className="h1 muted">{settings.currency}</span>
          <input className="input big grow" inputMode="decimal" placeholder="0" value={x.amount} onChange={(e) => set({ amount: e.target.value.replace(/[^0-9.]/g, '') })} autoFocus={!id} style={{ fontSize: 40 }} />
        </div>
        <Field label={x.direction === 'debit' ? 'Paid to' : 'From'}><input className="input" value={x.merchant} onChange={(e) => set({ merchant: e.target.value })} placeholder="Swiggy, mess, friend…" /></Field>
        <Field label="Category"><CategorySelect kind={x.direction === 'debit' ? 'finance' : 'income'} value={x.categoryId} onChange={pickCat} allowNone={false} /></Field>
        {x.direction === 'debit' && <Field label="Need or want?"><Seg value={x.needWant} onChange={(v) => set({ needWant: v })} options={[{ value: 'need', label: 'Need' }, { value: 'want', label: 'Want' }]} /></Field>}
        <Field label="Date"><input type="date" className="input" value={x.date} onChange={(e) => set({ date: e.target.value })} /></Field>
        <Field label="Note"><input className="input" value={x.note || ''} onChange={(e) => set({ note: e.target.value })} placeholder="optional" /></Field>
        {x.raw && <div className="card flat tiny muted">{x.raw}</div>}
        {id && <button className="btn danger" onClick={() => setDel(true)}>Delete</button>}
      </div>
      <Confirm open={del} onClose={() => setDel(false)} title="Delete transaction?" onConfirm={async () => { await db.transactions.delete(id); pop(); }} />
    </div>
  );
}

/* =========================================================
   TAG REVIEW (end-of-day batch)
   ========================================================= */
export function TagList({ onEmpty }) {
  const { settings } = useApp();
  const cats = useCats();
  const list = useLiveQuery(() => db.transactions.where('tagged').equals(0).toArray(), []) || [];
  const tag = async (x, cid, nw) => {
    const c = cats.find((z) => z.id === cid);
    await db.transactions.update(x.id, { categoryId: cid, needWant: nw || c?.needWant || 'need', tagged: 1 });
    tap();
  };
  if (!list.length) return onEmpty || <Empty icon="✨" title="All tagged" sub="Nothing waiting for review." />;
  return (
    <div className="col gap-10">
      {list.sort((a, b) => b.ts - a.ts).map((x) => <TagCard key={x.id} x={x} cats={cats} cur={settings.currency} onTag={tag} />)}
    </div>
  );
}
function TagCard({ x, cats, cur, onTag }) {
  const [cid, setCid] = useState(x.categoryId);
  const [nw, setNw] = useState(x.needWant || 'need');
  const kind = x.direction === 'debit' ? 'finance' : 'income';
  const mine = cats.filter((c) => c.kind === kind);
  return (
    <div className="card fade-in">
      <div className="row between">
        <div className="grow">
          <div className="h3 ellipsis">{x.merchant || (x.direction === 'credit' ? 'Money in' : 'Payment')}</div>
          <div className="tiny muted">{fmtDay(x.date)} · {fmtTime(x.ts)}</div>
        </div>
        <div className="h2 num" style={{ color: x.direction === 'credit' ? 'var(--good)' : 'var(--text)' }}>{money(x.amount, cur)}</div>
      </div>
      <div className="chips wrap mt-12">
        {mine.map((c) => <button key={c.id} className={`chip ${cid === c.id ? 'on' : ''}`} onClick={() => { setCid(c.id); setNw(c.needWant || 'need'); }}>{c.icon} {c.name}</button>)}
      </div>
      <div className="row mt-12">
        {x.direction === 'debit' && <div className="grow"><Seg value={nw} onChange={setNw} options={[{ value: 'need', label: 'Need' }, { value: 'want', label: 'Want' }]} /></div>}
        <button className="btn primary" disabled={!cid} onClick={() => onTag(x, cid, nw)}><Check size={16} /> Tag</button>
      </div>
    </div>
  );
}
export function TagReview() {
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="Tag transactions" />
      <TagList />
    </div>
  );
}

/* =========================================================
   SMS IMPORT
   ========================================================= */
export function SmsImport() {
  const { toast, pop } = useApp();
  const [txt, setTxt] = useState('');
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => txt.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean).map((b) => ({ body: b, p: parseSms(b, Date.now()) })), [txt]);
  const scan = async () => {
    setBusy(true);
    try {
      const n = await syncSms({ quiet: false });
      toast(n ? `Imported ${n} transaction${n > 1 ? 's' : ''}` : 'No new bank transactions');
    } catch (e) { toast(e.message || 'Could not read SMS'); }
    setBusy(false);
  };
  const importPasted = async () => {
    const msgs = parsed.filter((x) => x.p).map((x, i) => ({ body: x.body, date: Date.now() - i * 1000 }));
    const n = await importMessages(msgs);
    toast(`Imported ${n}`); setTxt('');
    if (n) pop();
  };
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="Import from bank SMS" />
      <div className="card small dim" style={{ lineHeight: 1.55 }}>
        Every UPI payment — GPay, PhonePe, Paytm — triggers an SMS from your bank, so one source covers all apps. Nothing leaves your phone.
      </div>
      {platform === 'android' ? (
        <div className="card flat mt-16 small dim" style={{ lineHeight: 1.6 }}>
          <b style={{ color: 'var(--text)' }}>Fastest way:</b> in your Messages app, long-press a bank SMS → <b>Share</b> → <b>Kaizen</b>. It’s added instantly and waits for you to tag it. You can also select several messages and share them together.
        </div>
      ) : (
        <div className="small muted mt-12">In the Android app you can share bank SMS straight to Kaizen. Here, paste messages below.</div>
      )}
      <div className="section">
        <SectionHead title="Paste messages" />
        <textarea className="textarea" style={{ minHeight: 140 }} placeholder={'Paste one or more bank SMS.\nSeparate messages with a blank line.\n\ne.g. Rs.250.00 debited from A/c XX1234 on 25-09-26 to VPA swiggy@icici UPI Ref 1234'} value={txt} onChange={(e) => setTxt(e.target.value)} />
        {parsed.length > 0 && (
          <div className="list mt-12">
            {parsed.map((x, i) => (
              <div key={i} className="list-item">
                <span className="pill-dot" style={{ background: x.p ? 'var(--good)' : 'var(--faint)' }} />
                <div className="grow small">{x.p ? <><b>{x.p.direction === 'debit' ? 'Spent' : 'Received'} ₹{x.p.amount}</b>{x.p.merchant ? ` · ${x.p.merchant}` : ''}</> : <span className="muted">Not a transaction</span>}</div>
              </div>
            ))}
          </div>
        )}
        <button className="btn block mt-12" disabled={!parsed.some((x) => x.p)} onClick={importPasted}><ClipboardPaste size={16} /> Import {parsed.filter((x) => x.p).length || ''}</button>
      </div>
    </div>
  );
}

/* =========================================================
   SUBSCRIPTIONS
   ========================================================= */
export function Subscriptions() {
  const { settings, toast } = useApp();
  const cur = settings.currency;
  const subs = useLiveQuery(() => db.subscriptions.toArray(), []) || [];
  const txs = useLiveQuery(() => db.transactions.where('date').aboveOrEqual(addDays(today(), -400)).toArray(), []) || [];
  const [dismissed, setDismissed] = useState([]);
  const [edit, setEdit] = useState(null);
  const cands = detectSubscriptions(txs, subs).filter((c) => !dismissed.includes(c.key) && !(settings.dismissedSubs || []).includes(c.key));
  const active = subs.filter((s) => s.active);
  const total = active.reduce((a, s) => a + monthlyCost(s), 0);
  const upcoming = active.map((s) => ({ ...s, next: nextRenewal(s) })).sort((a, b) => a.next.localeCompare(b.next));
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="Subscriptions" right={<button className="icon-btn" onClick={() => setEdit({ name: '', amount: '', cycle: 'monthly', nextDate: today(), active: true })}><Plus size={20} /></button>} />
      <div className="hero">
        <div className="eyebrow">Recurring cost</div>
        <div className="big-num mt-8 num">{money(total, cur)}<span className="h3 muted"> / month</span></div>
        <div className="small muted mt-4">{money(total * 12, cur)} a year</div>
      </div>
      {cands.length > 0 && (
        <div className="section">
          <SectionHead title="Looks recurring" />
          <div className="col gap-6">
            {cands.map((c) => (
              <div key={c.key} className="card row gap-10">
                <div className="grow"><div className="h3 ellipsis">{c.merchant}</div><div className="tiny muted">{money(c.amount, cur)} · {c.cycle} · seen {c.count}×</div></div>
                <button className="btn sm" onClick={() => { setDismissed([...dismissed, c.key]); setKV('dismissedSubs', [...(settings.dismissedSubs || []), c.key]); }}>No</button>
                <button className="btn sm primary" onClick={async () => { await db.subscriptions.add({ name: c.merchant, merchant: c.merchant, amount: c.amount, cycle: c.cycle, nextDate: c.lastDate, categoryId: c.categoryId, active: true }); toast('Subscription added'); }}>Yes</button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="section">
        <SectionHead title="Upcoming renewals" />
        {upcoming.length ? (
          <div className="list">
            {upcoming.map((s) => (
              <button key={s.id} className="list-item" onClick={() => setEdit(s)}>
                <div className="grow"><div style={{ fontWeight: 560 }}>{s.name}</div><div className="tiny muted">{s.cycle} · next {fmtDay(s.next)}</div></div>
                <div className="num" style={{ fontWeight: 650 }}>{money(s.amount, cur)}</div>
              </button>
            ))}
          </div>
        ) : <Empty icon="🔁" title="No subscriptions" sub="Detected automatically from repeating payments, or add one." />}
      </div>
      {subs.filter((s) => !s.active).length > 0 && (
        <div className="section">
          <SectionHead title="Cancelled" />
          <div className="list">{subs.filter((s) => !s.active).map((s) => <button key={s.id} className="list-item muted" onClick={() => setEdit(s)}><span className="grow strike">{s.name}</span><span className="num">{money(s.amount, cur)}</span></button>)}</div>
        </div>
      )}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit subscription' : 'New subscription'}>
        {edit && (
          <div className="form">
            <Field label="Name"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <div className="grid-2">
              <Field label="Amount"><input className="input" inputMode="decimal" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value.replace(/[^0-9.]/g, '') })} /></Field>
              <Field label="Next date"><input type="date" className="input" value={edit.nextDate} onChange={(e) => setEdit({ ...edit, nextDate: e.target.value })} /></Field>
            </div>
            <Seg value={edit.cycle} onChange={(v) => setEdit({ ...edit, cycle: v })} options={[{ value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' }]} />
            <div className="row between"><span>Active</span><Toggle on={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} /></div>
            <div className="row">
              {edit.id && <button className="btn danger" onClick={async () => { await db.subscriptions.delete(edit.id); setEdit(null); }}><Trash2 size={16} /></button>}
              <button className="btn primary grow" onClick={async () => { const r = { ...edit, amount: Number(edit.amount) || 0 }; if (!r.name) return; if (r.id) await db.subscriptions.put(r); else await db.subscriptions.add(r); setEdit(null); }}>Save</button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

/* =========================================================
   INSIGHTS
   ========================================================= */
export function MoneyInsights() {
  const { settings } = useApp();
  const cur = settings.currency;
  const [period, setPeriod] = useState('month');
  const cats = useCats();
  const txs = useLiveQuery(() => db.transactions.toArray(), []);
  const subs = useLiveQuery(() => db.subscriptions.toArray(), []) || [];
  if (!txs) return <div className="screen no-nav" />;
  const [from, to] = periodRange(period);
  const prev = prevPeriodRange(period);
  const deb = (a, b) => txs.filter((x) => x.direction === 'debit' && x.date >= a && x.date <= b);
  const cre = (a, b) => txs.filter((x) => x.direction === 'credit' && x.date >= a && x.date <= b);
  const cur_ = deb(from, to);
  const sum = (l) => l.reduce((a, b) => a + b.amount, 0);
  const spent = sum(cur_);
  const recv = sum(cre(from, to));
  const t = today();
  const bk = buckets(period);
  const spendTrend = bk.map((b) => ({ label: b.label, value: b.from > t ? null : sum(deb(b.from, b.to)) }));
  const saveTrend = bk.map((b) => ({ label: b.label, value: b.from > t ? null : Math.max(0, sum(cre(b.from, b.to)) - sum(deb(b.from, b.to))) }));
  const byCat = (list) => { const m = {}; list.forEach((x) => (m[x.categoryId || 0] = (m[x.categoryId || 0] || 0) + x.amount)); return m; };
  const cNow = byCat(cur_);
  const cPrev = prev ? byCat(deb(prev[0], prev[1])) : {};
  const changes = Object.keys({ ...cNow, ...cPrev }).map((k) => {
    const c = cats.find((z) => z.id === Number(k));
    const a = cNow[k] || 0, b = cPrev[k] || 0;
    return { name: c?.name || 'Untagged', icon: c?.icon || '❔', a, b, pct: b ? (a - b) / b : null };
  }).filter((x) => x.a || x.b).sort((x, y) => Math.abs(y.a - y.b) - Math.abs(x.a - x.b)).slice(0, 5);
  const merch = {};
  cur_.forEach((x) => { const k = x.merchant || '—'; merch[k] = (merch[k] || 0) + x.amount; });
  const nwTrend = bk.map((b) => { const l = deb(b.from, b.to).filter((x) => x.tagged); const s = sum(l); return { label: b.label, value: b.from > t || !s ? null : Math.round((sum(l.filter((x) => x.needWant === 'want')) / s) * 100) }; });
  const subMonthly = subs.filter((s) => s.active).reduce((a, s) => a + monthlyCost(s), 0);
  const monthsInPeriod = period === 'week' ? 12 / 52 : period === 'month' ? 1 : period === 'year' ? 12 : 12;
  return (
    <div className="screen no-nav page-enter">
      <TopBar title="Spending insights" />
      <PeriodToggle value={period} onChange={setPeriod} />
      <div className="grid-3 mt-12">
        <Stat v={moneyShort(spent, cur)} k="Spent" color="var(--money)" />
        <Stat v={moneyShort(recv, cur)} k="Received" />
        <Stat v={recv ? `${Math.round(((recv - spent) / recv) * 100)}%` : '—'} k="Savings rate" />
      </div>
      <div className="card mt-12"><div className="h3 mb-12">Spending</div><Bars data={spendTrend} color="var(--money)" format={(v) => moneyShort(v, cur)} /></div>
      <div className="card mt-12"><div className="h3 mb-12">Saved</div><Bars data={saveTrend} color="var(--good)" format={(v) => moneyShort(v, cur)} /></div>
      {prev && changes.length > 0 && (
        <div className="card mt-12">
          <div className="h3 mb-12">vs previous {period}</div>
          <div className="col gap-10">
            {changes.map((c) => (
              <div key={c.name} className="row gap-10 small">
                <span>{c.icon}</span><span className="grow">{c.name}</span>
                <span className="num muted">{moneyShort(c.a, cur)}</span>
                <span className="badge num" style={{ color: c.a > c.b ? 'var(--bad)' : 'var(--good)', minWidth: 62, justifyContent: 'center' }}>
                  {c.a > c.b ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{c.pct == null ? 'new' : `${Math.abs(Math.round(c.pct * 100))}%`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="card mt-12"><div className="h3 mb-12">By category</div><HBars items={Object.entries(cNow).map(([k, v]) => { const c = cats.find((z) => z.id === Number(k)); return { label: c?.name || 'Untagged', icon: c?.icon, value: v, color: c?.color || 'var(--faint)' }; }).sort((a, b) => b.value - a.value)} format={(v) => money(v, cur)} /></div>
      <div className="card mt-12"><div className="h3">Wants share of spending</div><div className="small muted mb-12">% of tagged spend that was a want</div><Bars data={nwTrend} color="var(--mood)" format={(v) => v + '%'} max={100} /></div>
      <div className="card mt-12"><div className="h3 mb-12">Top merchants</div><HBars items={Object.entries(merch).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => ({ label: k, value: v, color: 'var(--money)' }))} format={(v) => money(v, cur)} /></div>
      <div className="card mt-12 row between">
        <div><div className="h3">Subscriptions</div><div className="small muted">share of spend this {period === 'all' ? 'year' : period}</div></div>
        <div className="h2 num">{spent ? `${Math.round(((subMonthly * monthsInPeriod) / spent) * 100)}%` : '—'}</div>
      </div>
    </div>
  );
}
