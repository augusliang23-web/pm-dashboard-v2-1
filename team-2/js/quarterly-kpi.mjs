const COMPLETION_LEVELS = new Set([0, 25, 50, 75, 100]);
const WEIGHT_VALUES = Object.freeze({ low: 1, medium: 2, high: 3 });
const HEALTH_VALUES = new Set(['on-track', 'at-risk', 'delayed']);
const MONTH_INDEX = Object.freeze({
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
});

function legacyDefaults(status) {
  const value = String(status || '').toLowerCase();
  if (value === 'done') return { progress: 100, health: 'on-track' };
  if (value === 'at-risk' || value === 'risk') return { progress: 0, health: 'at-risk' };
  return { progress: 0, health: 'on-track' };
}

function derivedLegacyStatus(progress, health) {
  if (progress === 100) return 'done';
  if (health === 'at-risk' || health === 'delayed') return 'at-risk';
  return 'planned';
}

export function quarterlyWeightValue(weight) {
  return WEIGHT_VALUES[weight] || WEIGHT_VALUES.medium;
}

export function normalizeQuarterlyMilestone(source = {}) {
  const legacy = legacyDefaults(source.status);
  const candidateProgress = Number(source.progress);
  const progress = COMPLETION_LEVELS.has(candidateProgress)
    ? candidateProgress
    : legacy.progress;
  const weight = Object.hasOwn(WEIGHT_VALUES, source.weight) ? source.weight : 'medium';
  const health = HEALTH_VALUES.has(source.health) ? source.health : legacy.health;

  return {
    quarter: String(source.quarter || ''),
    goal: String(source.goal || ''),
    window: String(source.window || ''),
    progress,
    weight,
    health,
    completedDate: String(source.completedDate || ''),
    status: derivedLegacyStatus(progress, health),
  };
}

function quarterYear(quarter) {
  const match = String(quarter || '').match(/^(\d{4}) Q[1-4]$/);
  return match ? Number(match[1]) : null;
}

function targetDeadline(item) {
  const year = quarterYear(item.quarter);
  const month = MONTH_INDEX[item.window];
  if (!Number.isInteger(year) || !Number.isInteger(month)) return null;
  return new Date(Date.UTC(year, month + 1, 0));
}

function parseIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function calculateQuarterlyKpi(items, quarter, reportingDate) {
  const milestones = (items || [])
    .map(normalizeQuarterlyMilestone)
    .filter(item => item.quarter === quarter);
  const asOf = parseIsoDate(reportingDate);
  const totalWeight = milestones.reduce((sum, item) => sum + quarterlyWeightValue(item.weight), 0);
  const weightedProgress = milestones.reduce(
    (sum, item) => sum + item.progress * quarterlyWeightValue(item.weight),
    0,
  );
  let due = 0;
  let onTime = 0;
  let overdue = 0;

  for (const item of milestones) {
    const deadline = targetDeadline(item);
    if (!deadline || !asOf || asOf <= deadline) continue;
    due += 1;
    const completedDate = parseIsoDate(item.completedDate);
    if (item.progress === 100 && completedDate && completedDate <= deadline) {
      onTime += 1;
    } else if (item.progress < 100) {
      overdue += 1;
    }
  }

  const hasDelayed = milestones.some(item => item.health === 'delayed');
  const atRisk = milestones.filter(item => item.health === 'at-risk').length;
  return {
    progress: totalWeight ? Math.round(weightedProgress / totalWeight) : 0,
    completed: milestones.filter(item => item.progress === 100).length,
    total: milestones.length,
    atRisk,
    overdue,
    due,
    onTimeRate: due ? Math.round((onTime / due) * 100) : null,
    health: hasDelayed || overdue ? 'red' : atRisk ? 'yellow' : 'green',
  };
}
