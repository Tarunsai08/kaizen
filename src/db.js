import Dexie from 'dexie';

export const db = new Dexie('kaizen');

db.version(1).stores({
  kv: 'key',
  categories: '++id, kind',
  habits: '++id, type, archived',
  habitLogs: '++id, habitId, date, [habitId+date]',
  urges: '++id, habitId, date, kind',
  activities: '++id, category',
  presets: '++id',
  workouts: '++id, date',
  sleep: '++id, date',
  transactions: '++id, date, tagged, smsKey',
  subscriptions: '++id, active',
  tasks: '++id, due, done, goalId, projectId',
  projects: '++id',
  goals: '++id, type, status',
  goalCheckins: '++id, goalId, date',
  moods: '++id, date',
  journal: '++id, &date',
  boredom: '++id, date, option',
  sites: '++id',
  hobbies: '++id',
});

// v2: companion, focus, people, mind tools, screen time
db.version(2).stores({
  focus: '++id, date, taskId',
  people: '++id',
  interactions: '++id, personId, date',
  reframes: '++id, date',
  wheels: '++id, &month',
  intentions: '++id, &date',
  breaths: '++id, date',
  screenDays: '[date+pkg], date, pkg',
  shieldEvents: '++id, date, pkg, type',
  steps: '&date',
});

/* ---------- key/value settings ---------- */
export async function getKV(key, fallback) {
  const row = await db.kv.get(key);
  return row ? row.value : fallback;
}
export async function setKV(key, value) {
  await db.kv.put({ key, value });
}

export const DEFAULT_SETTINGS = {
  name: '',
  theme: 'dark',
  bedtimeTarget: '23:00',
  wakeTarget: '07:00',
  nightReviewLead: 30,
  morningReminder: '07:30',
  notifications: true,
  journalLock: '',
  currency: '₹',
  schedule: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] },
  triggers: ['Stress', 'Boredom', 'Loneliness', 'Tiredness', 'Habit/Routine', 'Social situation', 'Anxiety', 'Free time'],
  emotions: ['calm', 'happy', 'motivated', 'grateful', 'focused', 'anxious', 'stressed', 'tired', 'lonely', 'irritated', 'sad', 'bored'],
  siteTags: ['Fun', 'Learning', 'Creative'],
  lastRecurCheck: '',
  onboarded: false,
  companionName: 'Kai',
  sleepNeed: 8,
  freezes: 1,
  frozenDays: [],
  freezeProgress: '',
  lastLevel: 1,
  healthConnect: false,
  shield: { shorts: { youtube: true, instagram: true, facebook: false, snapchat: false }, pauseApps: [], pauseSeconds: 6, allowMinutes: 10, enabled: false },
  screenLimits: {},
};

/* ---------- seed on first run ---------- */
export async function seed() {
  const done = await getKV('seeded', false);
  if (done) return;
  await db.transaction('rw', db.tables, async () => {
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
      if ((await db.kv.get(k)) === undefined) await db.kv.put({ key: k, value: v });
    }
    await db.categories.bulkAdd([
      { kind: 'habit', name: 'Health', icon: '💚', color: '#4ade80' },
      { kind: 'habit', name: 'Productivity', icon: '⚡', color: '#facc15' },
      { kind: 'habit', name: 'Mindfulness', icon: '🧘', color: '#a78bfa' },
      { kind: 'habit', name: 'Relationships', icon: '🤝', color: '#f472b6' },
      { kind: 'finance', name: 'Food', icon: '🍔', color: '#fb923c', needWant: 'need' },
      { kind: 'finance', name: 'Groceries', icon: '🛒', color: '#4ade80', needWant: 'need' },
      { kind: 'finance', name: 'Travel', icon: '🚕', color: '#38bdf8', needWant: 'need' },
      { kind: 'finance', name: 'Education', icon: '📚', color: '#a78bfa', needWant: 'need' },
      { kind: 'finance', name: 'Fitness', icon: '🏋️', color: '#f87171', needWant: 'need' },
      { kind: 'finance', name: 'Bills', icon: '🧾', color: '#94a3b8', needWant: 'need' },
      { kind: 'finance', name: 'Shopping', icon: '🛍️', color: '#f472b6', needWant: 'want' },
      { kind: 'finance', name: 'Entertainment', icon: '🎮', color: '#facc15', needWant: 'want' },
      { kind: 'finance', name: 'Other', icon: '📦', color: '#7d7d86', needWant: 'need' },
      { kind: 'income', name: 'Stipend', icon: '💼', color: '#4ade80' },
      { kind: 'income', name: 'Transfer', icon: '🔁', color: '#38bdf8' },
      { kind: 'income', name: 'Other income', icon: '💰', color: '#facc15' },
      { kind: 'task', name: 'Personal', icon: '🙂', color: '#a78bfa' },
      { kind: 'task', name: 'Research', icon: '🔬', color: '#38bdf8' },
      { kind: 'task', name: 'Errands', icon: '🧺', color: '#fb923c' },
      { kind: 'goal', name: 'Health', icon: '💪', color: '#4ade80' },
      { kind: 'goal', name: 'Career', icon: '🚀', color: '#38bdf8' },
      { kind: 'goal', name: 'Money', icon: '💰', color: '#facc15' },
      { kind: 'goal', name: 'Growth', icon: '🌱', color: '#a78bfa' },
    ]);
    // A few starter activities so the fitness module isn't empty
    const ids = await db.activities.bulkAdd(
      [
        { category: 'exercise', name: 'Push-up', muscles: ['Chest', 'Triceps'], equipment: 'None' },
        { category: 'exercise', name: 'Squat', muscles: ['Quads', 'Glutes'], equipment: 'None' },
        { category: 'exercise', name: 'Plank', muscles: ['Core'], equipment: 'Mat', unit: 'sec' },
        { category: 'exercise', name: 'Lunge', muscles: ['Quads', 'Glutes', 'Hamstrings'], equipment: 'None' },
        { category: 'yoga', name: 'Surya Namaskar', muscles: ['Full body'], equipment: 'Mat' },
        { category: 'yoga', name: 'Cat–Cow', muscles: ['Spine'], equipment: 'Mat' },
        { category: 'yoga', name: "Child's pose", muscles: ['Hips', 'Spine'], equipment: 'Mat' },
      ],
      { allKeys: true }
    );
    const [push, squat, plank, lunge, surya, catcow, child] = ids;
    await db.presets.add({
      name: 'Full Body',
      color: '#fb923c',
      levels: [
        { level: 0, items: [{ activityId: push, sets: 1, reps: 5 }, { activityId: squat, sets: 1, reps: 10 }] },
        { level: 1, items: [{ activityId: push, sets: 2, reps: 10 }, { activityId: squat, sets: 2, reps: 15 }, { activityId: plank, sets: 2, reps: 30 }] },
        { level: 2, items: [{ activityId: push, sets: 3, reps: 15 }, { activityId: squat, sets: 3, reps: 20 }, { activityId: lunge, sets: 3, reps: 12 }, { activityId: plank, sets: 3, reps: 45 }] },
      ],
    });
    await db.presets.add({
      name: 'Morning Yoga',
      color: '#2dd4bf',
      levels: [
        { level: 0, items: [{ activityId: surya, sets: 1, reps: 2 }] },
        { level: 1, items: [{ activityId: catcow, sets: 1, reps: 10 }, { activityId: surya, sets: 1, reps: 6 }, { activityId: child, sets: 1, reps: 1 }] },
      ],
    });
    await db.sites.bulkAdd([
      { name: 'Radio Garden', url: 'https://radio.garden', tag: 'Fun', note: 'Random radio stations worldwide' },
      { name: 'Wikipedia – Random', url: 'https://en.wikipedia.org/wiki/Special:Random', tag: 'Learning', note: 'Fall down a rabbit hole' },
    ]);
    await db.kv.put({ key: 'seeded', value: true });
  });
}

/* ---------- backup ---------- */
export async function exportAll() {
  const out = { app: 'kaizen', version: 1, exportedAt: new Date().toISOString(), tables: {} };
  for (const t of db.tables) out.tables[t.name] = await t.toArray();
  return out;
}
export async function importAll(data) {
  if (!data || data.app !== 'kaizen') throw new Error('Not a Kaizen backup file');
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) {
      await t.clear();
      const rows = data.tables[t.name];
      if (rows && rows.length) await t.bulkAdd(rows);
    }
  });
}
