// Time estimation. Pure functions, no DOM / DB access.
export const CATEGORIES = [
  { value: 'ASSIGNMENT', label: 'Assignment' },
  { value: 'EXAM_PREP', label: 'Exam prep' },
  { value: 'RESEARCH', label: 'Research' },
  { value: 'CODING', label: 'Coding' },
  { value: 'SYSTEM_DESIGN', label: 'System design' },
  { value: 'ALGORITHM', label: 'Algorithm' },
  { value: 'PERSONAL', label: 'Personal' },
  { value: 'OTHER', label: 'Other' },
];
export const DEFAULT_FACTORS = { EXAM_PREP: 1.3, RESEARCH: 1.4, CODING: 1.3, ASSIGNMENT: 1.0, SYSTEM_DESIGN: 1.0, ALGORITHM: 1.0, PERSONAL: 0.8, OTHER: 1.0 };
export const SUB_BASE = [0, 0.5, 1, 2, 3.5, 5]; // by difficulty 1..5
export const TASK_BASE = [0, 1, 3, 6, 10, 16];

const clampD = (d) => Math.min(5, Math.max(1, Math.round(d || 3)));

/** Estimated hours for a subtask or a whole task. `given` hours win; category factor and learned correction only apply to guesses. */
export function estimateHours({ difficulty, hours, whole, category }, factors = {}, correction = {}) {
  const corr = correction[category] ?? 1;
  if (hours != null && hours > 0) return { hours, guessed: false };
  const f = { ...DEFAULT_FACTORS, ...factors }[category || 'OTHER'] ?? 1;
  const base = (whole ? TASK_BASE : SUB_BASE)[clampD(difficulty)];
  return { hours: base * f * corr, guessed: true };
}

export const fmtHours = (h) => (h < 1 ? `${Math.round(h * 60)}m` : `${Math.round(h * 10) / 10}h`);
export const estLabel = (h, guessed) => `~${fmtHours(h)}${guessed ? ' (estimated)' : ''}`;
