// Study: subjects stored as trees in IndexedDB, progress keyed by stable node id,
// spaced-repetition cards, Excel import/export with progress-preserving merge.
import { db, getKV, setKV } from '../db';
import { today, addDays } from './date';

/* ---------------- built-in subjects ---------------- */
export const BUILTINS = [
  { sid: 'dsa', load: () => import('../study-data/dsa.json') },
  { sid: 'sd', load: () => import('../study-data/sd.json') },
  { sid: 'ml', load: () => import('../study-data/ml.json') },
];
export const KINDS = [
  ['learn', 'Learn', 'Understand the idea'],
  ['deep', 'Deep dive', 'The theory & math'],
  ['implement', 'Implement', 'Build it in code'],
  ['practice', 'Practice', 'Solve & exercise'],
  ['apply', 'Apply', 'Real-world use'],
];
export const KIND_LABEL = Object.fromEntries(KINDS.map(([k, l]) => [k, l]));
export const MEDIA = ['video', 'article', 'book', 'course', 'interactive', 'problem', 'paper', 'code', 'exercise'];

let ensuring = null;
export function ensureSubjects() {
  if (!ensuring) ensuring = doEnsure().catch((e) => { console.warn('study seed', e); ensuring = null; });
  return ensuring;
}
async function doEnsure() {
  let order = await db.subjects.count();
  for (const b of BUILTINS) {
    const cur = await db.subjects.where('sid').equals(b.sid).first();
    if (cur && cur.builtinVersion >= (await peekVersion(b))) continue;
    const data = (await b.load()).default;
    const { children, id, version, ...meta } = data;
    if (!cur) {
      await db.subjects.add({ ...meta, sid: b.sid, source: 'builtin', builtinVersion: version, children, order: order++, dailyMins: 30, reminder: true, reminderTime: b.sid === 'dsa' ? '19:00' : b.sid === 'ml' ? '20:30' : '21:30', active: true, created: Date.now() });
    } else {
      // content update from a newer app version: take new tree, keep the user's own additions
      const merged = keepUserAdditions(children, cur.children);
      await db.subjects.update(cur.id, { ...meta, builtinVersion: version, children: merged });
    }
  }
}
const VERSIONS = {};
async function peekVersion(b) {
  if (VERSIONS[b.sid] == null) VERSIONS[b.sid] = (await b.load()).default.version || 1;
  return VERSIONS[b.sid];
}
export async function resetBuiltin(sid) {
  const b = BUILTINS.find((x) => x.sid === sid);
  const cur = await db.subjects.where('sid').equals(sid).first();
  if (!b || !cur) return;
  const data = (await b.load()).default;
  await db.subjects.update(cur.id, { children: data.children, builtinVersion: data.version, title: data.title, modified: false });
}

/* ---------------- tree helpers ---------------- */
export const isLeaf = (n) => !n.children || n.children.length === 0;
export function walk(nodes, fn, path = []) {
  for (const n of nodes || []) {
    fn(n, path);
    if (n.children) walk(n.children, fn, [...path, n]);
  }
}
export function indexTree(subject) {
  const map = new Map();
  walk(subject.children, (n, path) => map.set(n.id, { node: n, path }));
  return map;
}
export function leafIds(node) {
  const out = [];
  if (isLeaf(node)) out.push(node.id);
  else walk(node.children, (n) => isLeaf(n) && out.push(n.id));
  return out;
}
/** {done,total} for a node, given a Set of done leaf ids. Memoised per render via cache Map. */
export function tally(node, done, cache) {
  if (cache && cache.has(node.id)) return cache.get(node.id);
  let r;
  if (isLeaf(node)) r = { done: done.has(node.id) ? 1 : 0, total: 1 };
  else {
    r = { done: 0, total: 0 };
    for (const c of node.children) { const t = tally(c, done, cache); r.done += t.done; r.total += t.total; }
  }
  cache && cache.set(node.id, r);
  return r;
}
export function subjectTally(subject, done) {
  return tally({ id: '__root__' + subject.sid, children: subject.children || [] }, done, new Map());
}
export function firstUndone(nodes, done) {
  for (const n of nodes || []) {
    if (isLeaf(n)) { if (!done.has(n.id)) return n; }
    else { const f = firstUndone(n.children, done); if (f) return f; }
  }
  return null;
}
export function findNode(subject, id) {
  let hit = null;
  walk(subject.children, (n, path) => { if (n.id === id) hit = { node: n, path }; });
  return hit;
}
export const slug = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'x';

/* ---------------- progress ---------------- */
export async function doneSet(sid) {
  const rows = await db.progress.where('sid').equals(sid).toArray();
  return new Set(rows.filter((r) => r.done).map((r) => r.id));
}
export async function allDone() {
  const rows = await db.progress.toArray();
  return new Set(rows.filter((r) => r.done).map((r) => r.id));
}

// The roadmap reads this to play the “just completed” animation once.
export const lastCompleted = { id: null, ts: 0 };

export async function completeLesson(sid, node, { mins = 0 } = {}) {
  const t = today();
  const prev = await db.progress.get(node.id);
  await db.progress.put({ ...(prev || {}), id: node.id, sid, done: true, doneAt: t, ts: Date.now() });
  if (!(await db.cards.get(node.id))) {
    await db.cards.put({ id: node.id, sid, due: addDays(t, 1), interval: 1, ease: 2.5, reps: 0, lapses: 0, created: t });
  }
  await db.studySessions.add({ date: t, ts: Date.now(), sid, nodeId: node.id, mins, kind: 'lesson' });
  lastCompleted.id = node.id; lastCompleted.ts = Date.now();
}
export async function uncompleteLesson(id) {
  const prev = await db.progress.get(id);
  if (prev) await db.progress.put({ ...prev, done: false, doneAt: null });
  await db.cards.delete(id);
}
/** “I already know this” — mark every lesson under a node done (no review cards: you know it). */
export async function markAll(sid, node, value) {
  const ids = leafIds(node);
  const t = today();
  await db.transaction('rw', db.progress, db.cards, async () => {
    for (const id of ids) {
      const prev = await db.progress.get(id);
      if (value) await db.progress.put({ ...(prev || {}), id, sid, done: true, doneAt: prev?.doneAt || t, ts: Date.now(), bulk: true });
      else if (prev) { await db.progress.put({ ...prev, done: false, doneAt: null }); await db.cards.delete(id); }
    }
  });
  return ids.length;
}
export async function setNote(sid, id, note) {
  const prev = await db.progress.get(id);
  await db.progress.put({ ...(prev || { id, sid, done: false }), note });
}

/* ---------------- editing the tree ---------------- */
function mapTree(nodes, id, fn) {
  return (nodes || []).map((n) => {
    if (n.id === id) return fn(n);
    if (n.children) return { ...n, children: mapTree(n.children, id, fn) };
    return n;
  });
}
function removeFromTree(nodes, id) {
  return (nodes || []).filter((n) => n.id !== id).map((n) => (n.children ? { ...n, children: removeFromTree(n.children, id) } : n));
}
export async function updateNode(subject, id, fn) {
  await db.subjects.update(subject.id, { children: mapTree(subject.children, id, fn), modified: true });
}
export async function addResource(subject, id, res) {
  await updateNode(subject, id, (n) => ({ ...n, resources: [...(n.resources || []), { ...res, user: true }] }));
}
export async function editResource(subject, id, idx, res) {
  await updateNode(subject, id, (n) => ({ ...n, resources: n.resources.map((r, i) => (i === idx ? { ...r, ...res } : r)) }));
}
export async function deleteResource(subject, id, idx) {
  await updateNode(subject, id, (n) => ({ ...n, resources: n.resources.filter((_, i) => i !== idx) }));
}
export async function addChild(subject, parentId, title) {
  const child = { id: `${parentId || subject.sid}.u${Date.now().toString(36)}`, title: title.trim(), resources: [], user: true };
  if (!parentId) await db.subjects.update(subject.id, { children: [...(subject.children || []), child], modified: true });
  else await updateNode(subject, parentId, (n) => ({ ...n, children: [...(n.children || []), child] }));
  return child;
}
export async function renameNode(subject, id, title) {
  await updateNode(subject, id, (n) => ({ ...n, title }));
}
export async function deleteNode(subject, id) {
  await db.subjects.update(subject.id, { children: removeFromTree(subject.children, id), modified: true });
}
/** After a content update keep resources/nodes the user added (flag user:true). */
function keepUserAdditions(fresh, old) {
  const oldIdx = new Map();
  walk(old, (n, path) => oldIdx.set(n.id, { n, parent: path[path.length - 1]?.id || null }));
  const freshIds = new Set();
  walk(fresh, (n) => freshIds.add(n.id));
  const addRes = new Map(); // id -> user resources
  const addNodes = new Map(); // parentId -> user nodes
  for (const [id, { n, parent }] of oldIdx) {
    const ur = (n.resources || []).filter((r) => r.user);
    if (ur.length && freshIds.has(id)) addRes.set(id, ur);
    if (n.user && !freshIds.has(id) && (parent === null || freshIds.has(parent))) {
      const k = parent || '__root';
      addNodes.set(k, [...(addNodes.get(k) || []), n]);
    }
  }
  const fix = (nodes) => (nodes || []).map((n) => {
    let m = n;
    if (addRes.has(n.id)) m = { ...m, resources: [...(m.resources || []), ...addRes.get(n.id)] };
    if (m.children) m = { ...m, children: fix(m.children) };
    if (addNodes.has(n.id)) m = { ...m, children: [...(m.children || []), ...addNodes.get(n.id)] };
    return m;
  });
  return [...fix(fresh), ...(addNodes.get('__root') || [])];
}

/* ---------------- spaced repetition (SM-2, simplified) ---------------- */
export const GRADES = [
  { g: 0, label: 'Again', color: 'var(--bad)' },
  { g: 1, label: 'Hard', color: 'var(--warn)' },
  { g: 2, label: 'Good', color: 'var(--good)' },
  { g: 3, label: 'Easy', color: 'var(--money)' },
];
export function nextInterval(card, g) {
  const ease = card.ease || 2.5;
  const iv = card.interval || 1;
  if (g === 0) return 1;
  if (g === 1) return Math.max(1, Math.round(iv * 1.2));
  if (g === 2) return card.reps === 0 ? 3 : Math.round(iv * ease);
  return card.reps === 0 ? 5 : Math.round(iv * ease * 1.35);
}
export async function gradeCard(card, g) {
  const interval = Math.min(365, nextInterval(card, g));
  const ease = Math.max(1.3, Math.min(3.0, (card.ease || 2.5) + [-0.2, -0.15, 0, 0.15][g]));
  await db.cards.put({ ...card, interval, ease, reps: (card.reps || 0) + 1, lapses: (card.lapses || 0) + (g === 0 ? 1 : 0), due: addDays(today(), interval), last: today(), lastGrade: g });
  await db.reviews.add({ date: today(), ts: Date.now(), cardId: card.id, sid: card.sid, grade: g });
}
export async function dueCards(cap = 12) {
  const t = today();
  const due = await db.cards.where('due').belowOrEqual(t).toArray();
  due.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : (a.ease || 2.5) - (b.ease || 2.5)));
  const doneToday = await db.reviews.where('date').equals(t).count();
  return { cards: due.slice(0, Math.max(0, cap - doneToday)), total: due.length, doneToday };
}
export const fmtIv = (d) => (d < 30 ? `${d}d` : d < 365 ? `${Math.round(d / 30)}mo` : `${(d / 365).toFixed(1)}y`);

/* ---------------- study time & streak ---------------- */
export async function studyMinutesByDate() {
  const [sess, focus] = await Promise.all([db.studySessions.toArray(), db.focus.toArray()]);
  const m = {};
  for (const s of sess) m[s.date] = (m[s.date] || 0) + (s.mins || 0);
  for (const f of focus) if (f.study) m[f.date] = (m[f.date] || 0) + (f.minutes || 0);
  return m;
}
export async function studyDays() {
  const [sess, focus, rev] = await Promise.all([db.studySessions.toArray(), db.focus.toArray(), db.reviews.toArray()]);
  const s = new Set();
  sess.forEach((x) => s.add(x.date));
  focus.forEach((x) => x.study && s.add(x.date));
  rev.forEach((x) => s.add(x.date));
  return s;
}
export function streakFrom(days, end = today()) {
  let n = 0;
  let d = days.has(end) ? end : addDays(end, -1);
  while (days.has(d)) { n++; d = addDays(d, -1); }
  return n;
}

/* ---------------- Excel ---------------- */
export const COLUMNS = ['ID', 'Subject', 'Topic', 'Subtopic', 'Lesson', 'Difficulty', 'Summary', 'Recall question', 'Resource title', 'Resource URL', 'Resource type', 'Medium', 'Resource note'];
const TYPE_TO_KIND = { learn: 'learn', 'deep dive': 'deep', deep: 'deep', theory: 'deep', math: 'deep', implement: 'implement', code: 'implement', practice: 'practice', problem: 'practice', apply: 'apply', application: 'apply', project: 'apply' };

/** Subject → rows (one per resource; nodes without resources still get one row). Depth > 3 is flattened into “Lesson” with “ › ”. */
export function subjectToRows(subject) {
  const rows = [];
  const emit = (n, path) => {
    const names = [...path.map((p) => p.title), n.title];
    const [topic, sub, ...rest] = names;
    const lesson = rest.join(' › ');
    const base = { ID: n.id, Subject: subject.title, Topic: topic || '', Subtopic: sub || '', Lesson: lesson, Difficulty: n.difficulty || '', Summary: n.summary || '', 'Recall question': n.recall || '' };
    const res = n.resources || [];
    const needRow = isLeaf(n) || res.length || n.summary || n.recall || n.difficulty;
    if (!needRow) return;
    if (!res.length) rows.push({ ...base, 'Resource title': '', 'Resource URL': '', 'Resource type': '', Medium: '', 'Resource note': '' });
    res.forEach((r, i) => rows.push({ ...(i === 0 ? base : { ...base, Difficulty: '', Summary: '', 'Recall question': '' }), 'Resource title': r.title || '', 'Resource URL': r.url || '', 'Resource type': KIND_LABEL[r.kind] || r.kind || '', Medium: r.medium || '', 'Resource note': r.note || '' }));
  };
  walk(subject.children, (n, path) => emit(n, path));
  return rows;
}

export async function exportXlsx(subjects) {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  const WIDTH = { ID: 24, Subject: 14, Topic: 28, Subtopic: 28, Lesson: 36, Difficulty: 10, Summary: 40, 'Recall question': 40, 'Resource title': 42, 'Resource URL': 52, 'Resource type': 12, Medium: 11, 'Resource note': 24 };
  const header = COLUMNS.map((c) => ({ value: c, fontWeight: 'bold', backgroundColor: '#E8F5C8' }));
  const used = new Set();
  const sheets = subjects.map((s) => {
    let name = s.title.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Subject';
    while (used.has(name)) name = name.slice(0, 28) + ' ' + used.size;
    used.add(name);
    return { data: [header, ...subjectToRows(s).map((r) => COLUMNS.map((c) => (r[c] ? String(r[c]) : null)))], sheet: name, columns: COLUMNS.map((c) => ({ width: WIDTH[c] })), stickyRowsCount: 1 };
  });
  sheets.push({ data: [[{ value: 'Kaizen study roadmap — how to edit', fontWeight: 'bold' }], ...GUIDE_LINES.map((l) => [l])], sheet: 'How to edit', columns: [{ width: 120 }] });
  return await writeExcelFile(sheets).toBlob();
}
export const GUIDE_LINES = [
  'One row = one resource. A lesson with 3 resources has 3 rows (repeat Subject/Topic/Subtopic/Lesson on each).',
  'Columns: ID | Subject | Topic | Subtopic | Lesson | Difficulty | Summary | Recall question | Resource title | Resource URL | Resource type | Medium | Resource note',
  'Hierarchy: Topic → Subtopic → Lesson. Leave Subtopic empty for a 2-level roadmap (Topic → Lesson). Leave Lesson empty to make the Subtopic itself the lesson.',
  'Resource type: Learn, Deep dive, Implement, Practice or Apply.  Medium: video, article, book, course, interactive, problem, paper, code or exercise.',
  'Summary, Difficulty and Recall question are read from the first row of each lesson. The Recall question becomes the flashcard used for spaced revision.',
  'ID: keep the ID column when you re-upload — it is how your progress is kept. For new rows just leave it empty.',
  'Re-uploading a sheet for an existing subject UPDATES that roadmap: rows you deleted are removed, new rows are added, edited text is replaced. Your completed lessons are kept.',
  'Each sheet can hold one or more subjects (Subject column). Order of rows = order on the roadmap.',
];

const cell = (v) => (v == null ? '' : String(v).trim());
/** Parse rows (array of objects keyed by header) → subjects [{title, children}] */
export function rowsToSubjects(rows) {
  const subjects = new Map();
  let lastSubject = '';
  for (const raw of rows) {
    const r = {};
    for (const [k, v] of Object.entries(raw)) r[normHeader(k)] = cell(v);
    const subjectTitle = r.subject || lastSubject;
    if (!subjectTitle) continue;
    lastSubject = subjectTitle;
    const path = [r.topic, r.subtopic, ...(r.lesson ? r.lesson.split(' › ') : [])].map(cell).filter(Boolean);
    if (!path.length) continue;
    if (!subjects.has(subjectTitle)) subjects.set(subjectTitle, { title: subjectTitle, root: { children: [], kids: new Map() } });
    let cur = subjects.get(subjectTitle).root;
    for (let i = 0; i < path.length; i++) {
      const key = path[i].toLowerCase();
      if (!cur.kids.has(key)) { const n = { title: path[i], resources: [], children: [], kids: new Map(), ids: [] }; cur.kids.set(key, n); cur.children.push(n); }
      cur = cur.kids.get(key);
    }
    if (r.id) cur.ids.push(r.id);
    if (r.difficulty && !cur.difficulty) cur.difficulty = r.difficulty;
    if (r.summary && !cur.summary) cur.summary = r.summary;
    if (r.recall && !cur.recall) cur.recall = r.recall;
    if (r.url || r.rtitle) {
      const kind = TYPE_TO_KIND[(r.rtype || '').toLowerCase()] || 'learn';
      const res = { title: r.rtitle || r.url, url: r.url, kind, medium: (r.medium || guessMedium(r.url)).toLowerCase() };
      if (r.rnote) res.note = r.rnote;
      if (!cur.resources.some((x) => x.url === res.url && x.title === res.title)) cur.resources.push(res);
    }
  }
  const strip = (n) => {
    const o = { title: n.title, resources: n.resources, _ids: n.ids };
    if (n.summary) o.summary = n.summary;
    if (n.difficulty) o.difficulty = n.difficulty;
    if (n.recall) o.recall = n.recall;
    if (n.children.length) o.children = n.children.map(strip);
    return o;
  };
  return [...subjects.values()].map((s) => ({ title: s.title, children: s.root.children.map(strip) }));
}
function normHeader(h) {
  const k = String(h).toLowerCase().replace(/[^a-z]/g, '');
  return { id: 'id', subject: 'subject', topic: 'topic', subtopic: 'subtopic', lesson: 'lesson', subsubtopic: 'lesson', difficulty: 'difficulty', summary: 'summary', description: 'summary', recallquestion: 'recall', recall: 'recall', flashcard: 'recall', resourcetitle: 'rtitle', resource: 'rtitle', title: 'rtitle', resourceurl: 'url', url: 'url', link: 'url', resourcetype: 'rtype', type: 'rtype', medium: 'medium', resourcenote: 'rnote', note: 'rnote', notes: 'rnote' }[k] || k;
}
function guessMedium(url = '') {
  if (/youtu\.?be/.test(url)) return 'video';
  if (/leetcode|geeksforgeeks|hackerrank|codeforces|deep-ml/.test(url)) return 'problem';
  if (/arxiv|\.pdf$/.test(url)) return 'paper';
  if (/github\.com/.test(url)) return 'code';
  return 'article';
}

/** Assign ids: keep ids from the ID column when they exist in the old tree (or are unused),
 *  otherwise reuse old ids by matching title path, otherwise derive from the path. */
export function assignIds(sid, children, oldSubject) {
  const oldByPath = new Map();
  const oldIds = new Set();
  const byTitle = new Map(); // leaf title → id, only when unique (survives renamed/moved parents)
  if (oldSubject) walk(oldSubject.children, (n, path) => {
    oldIds.add(n.id);
    oldByPath.set([...path.map((p) => p.title), n.title].map((t) => t.toLowerCase()).join('\u0001'), n.id);
    if (isLeaf(n)) { const k = n.title.toLowerCase(); byTitle.set(k, byTitle.has(k) ? null : n.id); }
  });
  const used = new Set();
  const go = (nodes, path, parentId) => nodes.map((n) => {
    const titles = [...path, n.title];
    const key = titles.map((t) => t.toLowerCase()).join('\u0001');
    let id = (n._ids || []).find((x) => !used.has(x) && (oldIds.has(x) || x.startsWith(sid + '.') || !oldSubject));
    if (!id) id = oldByPath.get(key);
    if (!id && !n.children) id = byTitle.get(n.title.toLowerCase()) || undefined;
    if (!id || used.has(id)) {
      let base = `${parentId}.${slug(n.title)}`;
      id = base; let k = 2;
      while (used.has(id)) id = `${base}-${k++}`;
    }
    used.add(id);
    const { _ids, ...rest } = n;
    const out = { ...rest, id };
    if (n.children) out.children = go(n.children, titles, id);
    return out;
  });
  return go(children, [], sid);
}

export async function readSpreadsheet(file) {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.csv')) return parseCsv(await file.text());
  const { default: readExcelFile } = await import('read-excel-file/browser');
  const all = await readExcelFile(file);
  const out = [];
  for (const { sheet, data: rows } of all) {
    if (/how to edit/i.test(sheet)) continue;
    if (!rows.length) continue;
    const header = rows[0].map((h) => cell(h));
    if (!header.some((h) => /topic/i.test(h))) continue;
    const hasSubject = header.some((h) => /subject/i.test(h));
    for (const r of rows.slice(1)) {
      const o = {};
      header.forEach((h, i) => (o[h] = r[i]));
      if (!hasSubject) o.Subject = sheet;
      out.push(o);
    }
  }
  return out;
}
export function parseCsv(text) {
  const rows = [];
  let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { f += '"'; i++; }
      else if (c === '"') q = false;
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const header = (rows.shift() || []).map((h) => h.trim());
  return rows.filter((r) => r.some((x) => x.trim())).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

const sig = (n) => JSON.stringify([n.title || '', n.summary || '', n.recall || '', n.difficulty || '', (n.resources || []).map((r) => [r.title || '', r.url || '', r.kind || '', r.medium || '', r.note || ''])]);
/** Compare old vs new subject for the import preview. */
export function diffSubjects(oldS, newChildren, done) {
  const oldLeaves = new Map(); const newLeaves = new Map();
  let oldRes = 0, newRes = 0;
  if (oldS) walk(oldS.children, (n) => { oldRes += (n.resources || []).length; if (isLeaf(n)) oldLeaves.set(n.id, n); });
  walk(newChildren, (n) => { newRes += (n.resources || []).length; if (isLeaf(n)) newLeaves.set(n.id, n); });
  let added = 0, removed = 0, changed = 0, lostProgress = 0, keptProgress = 0;
  for (const [id, n] of newLeaves) {
    if (!oldLeaves.has(id)) added++;
    else if (sig(n) !== sig(oldLeaves.get(id))) changed++;
    if (done && done.has(id)) keptProgress++;
  }
  for (const id of oldLeaves.keys()) if (!newLeaves.has(id)) { removed++; if (done && done.has(id)) lostProgress++; }
  return { added, removed, changed, lostProgress, keptProgress, lessons: newLeaves.size, topics: newChildren.length, resources: newRes, oldResources: oldRes };
}

export async function applyImport(plan) {
  for (const p of plan) {
    if (p.existing) {
      await db.subjects.update(p.existing.id, { children: p.children, modified: true, importedAt: Date.now() });
    } else {
      const order = await db.subjects.count();
      await db.subjects.add({ sid: p.sid, title: p.title, long: p.title, color: p.color, icon: 'i:BookOpen', description: 'Imported from a spreadsheet', levels: ['Topic', 'Subtopic', 'Lesson'], source: 'custom', children: p.children, order, dailyMins: 30, reminder: true, reminderTime: '20:00', active: true, created: Date.now() });
    }
  }
}
export const SUBJECT_COLORS = ['#fb923c', '#38bdf8', '#a78bfa', '#4ade80', '#f472b6', '#facc15', '#2dd4bf', '#f87171'];

export async function planImport(rows) {
  const parsed = rowsToSubjects(rows);
  const existing = await db.subjects.toArray();
  const plan = [];
  for (const s of parsed) {
    const ex = existing.find((e) => e.title.toLowerCase() === s.title.toLowerCase() || (e.long || '').toLowerCase() === s.title.toLowerCase());
    const sid = ex ? ex.sid : uniqueSid(s.title, existing);
    const children = assignIds(sid, s.children, ex);
    const done = ex ? await doneSet(ex.sid) : null;
    plan.push({ title: ex ? ex.title : s.title, sid, existing: ex || null, children, color: ex?.color || SUBJECT_COLORS[(existing.length + plan.length) % SUBJECT_COLORS.length], diff: diffSubjects(ex, children, done) });
  }
  return plan;
}
function uniqueSid(title, existing) {
  const base = 'u-' + slug(title);
  let s = base, k = 2;
  while (existing.some((e) => e.sid === s)) s = `${base}-${k++}`;
  return s;
}

export async function saveBlob(blob, filename) {
  const { isNative } = await import('./native');
  if (isNative) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const b64 = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(blob); });
    const w = await Filesystem.writeFile({ path: filename, data: b64, directory: Directory.Cache });
    await Share.share({ title: filename, url: w.uri });
    return 'shared';
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'downloaded';
}

/* reminders/popups bookkeeping */
export async function reviewPopupDue() {
  const t = today();
  if ((await getKV('reviewPopup', '')) === t) return false;
  return true;
}
export async function markReviewPopup() { await setKV('reviewPopup', today()); }
