export const PROJECT_LEVEL = Object.freeze({
  SYSTEM: 'system',
  HARDWARE_MODULE: 'hardware-module',
});

export const PROJECT_LIFECYCLE = Object.freeze({
  ACTIVE: 'active',
  ON_HOLD: 'on-hold',
  COMPLETED: 'completed',
});

export const RESOURCE_DISCIPLINES = Object.freeze([
  'hardware',
  'firmware',
  'systemElectrical',
  'mechanical',
  'pmo',
]);

const PROJECT_LEVELS = new Set(Object.values(PROJECT_LEVEL));
const PROJECT_LIFECYCLES = new Set(Object.values(PROJECT_LIFECYCLE));
const WORKSTREAM_STATUSES = new Set(['not-started', 'on-track', 'at-risk', 'delayed', 'completed']);
const WORKSTREAM_TEMPLATES = Object.freeze({
  [PROJECT_LEVEL.SYSTEM]: Object.freeze(['Design', 'Integration', 'Validation', 'Certification', 'Launch']),
  [PROJECT_LEVEL.HARDWARE_MODULE]: Object.freeze(['Documentation', 'BOM Verification', 'Procurement', 'Assembly/Test', 'Certification']),
});

export function normalizeProject(source = {}) {
  const project = source && typeof source === 'object' ? source : {};

  return {
    ...project,
    projectLevel: PROJECT_LEVELS.has(project.projectLevel)
      ? project.projectLevel
      : PROJECT_LEVEL.SYSTEM,
    lifecycle: PROJECT_LIFECYCLES.has(project.lifecycle)
      ? project.lifecycle
      : PROJECT_LIFECYCLE.ACTIVE,
    projectType: stringValue(project.projectType ?? project.type),
    classification: stringValue(project.classification),
    productFamily: stringValue(project.productFamily),
    ganttWorkstreams: Array.isArray(project.ganttWorkstreams)
      ? project.ganttWorkstreams.map(normalizeWorkstream)
      : [],
    resources: isPlainObject(project.resources)
      ? Object.fromEntries(Object.entries(project.resources).map(([key, value]) => [key, normalizeResourceEntry(value)]))
      : {},
  };
}

export function normalizeResourceEntry(source = {}) {
  const entry = source && typeof source === 'object' ? source : {};
  const estimatedNumber = Number(entry.estimated);
  const actualBlank = entry.actual === null
    || entry.actual === undefined
    || (typeof entry.actual === 'string' && !entry.actual.trim());
  const actualNumber = actualBlank ? NaN : Number(entry.actual);
  const estimated = Number.isFinite(estimatedNumber) ? Math.max(estimatedNumber, 0) : 0;
  const actual = !actualBlank && Number.isFinite(actualNumber) ? Math.max(actualNumber, 0) : null;

  return {
    estimated,
    actual,
    remaining: actual === null ? null : Math.max(estimated - actual, 0),
    updatedAt: stringValue(entry.updatedAt),
  };
}

export function createDefaultWorkstreams(projectLevel) {
  const level = PROJECT_LEVELS.has(projectLevel) ? projectLevel : PROJECT_LEVEL.SYSTEM;
  return WORKSTREAM_TEMPLATES[level].map((name, index) => normalizeWorkstream({ name }, index));
}

export function normalizeWorkstream(source = {}, index = 0) {
  const row = source && typeof source === 'object' ? source : {};
  const numericProgress = Number(row.progress);
  const numericSortOrder = Number(row.sortOrder);

  return {
    id: stringValue(row.id) || `workstream-${index + 1}`,
    name: stringValue(row.name),
    startDate: stringValue(row.startDate),
    endDate: stringValue(row.endDate),
    status: WORKSTREAM_STATUSES.has(row.status) ? row.status : 'not-started',
    progress: Number.isFinite(numericProgress) ? numericProgress : 0,
    milestoneId: stringValue(row.milestoneId),
    sortOrder: Number.isFinite(numericSortOrder) ? numericSortOrder : index,
  };
}

export function parseIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    ? date
    : null;
}

export function createTimelineTicks(start, end, scale = 'month', maxTicks = 60) {
  if (!(start instanceof Date) || !(end instanceof Date) || start > end) return [];
  const candidates = [new Date(start)];
  const cursor = new Date(start);
  while (cursor < end) {
    if (scale === 'week') cursor.setUTCDate(cursor.getUTCDate() + 7);
    else cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    if (cursor < end) candidates.push(new Date(cursor));
  }
  candidates.push(new Date(end));
  if (candidates.length <= maxTicks) return candidates;
  const stride = Math.ceil((candidates.length - 1) / (maxTicks - 1));
  const ticks = candidates.filter((_, index) => index === 0 || index % stride === 0);
  if (ticks.at(-1).getTime() !== end.getTime()) ticks.push(new Date(end));
  return ticks;
}

export function calculateDropIndex(pointerY, rowBounds = []) {
  const index = rowBounds.findIndex(bounds => pointerY < (bounds.top + bounds.bottom) / 2);
  return index < 0 ? rowBounds.length : index;
}

export function validateWorkstreams(rows = [], milestoneIds) {
  if (!Array.isArray(rows)) return [];
  const validMilestones = Array.isArray(milestoneIds) ? new Set(milestoneIds) : null;
  const errors = [];

  rows.forEach((source, index) => {
    const row = normalizeWorkstream(source, index);
    const fields = {};
    if (!row.name) fields.name = 'Name is required.';
    const start = row.startDate ? parseIsoDate(row.startDate) : null;
    const end = row.endDate ? parseIsoDate(row.endDate) : null;
    if (row.startDate && !start) fields.startDate = 'Enter a valid date.';
    if (row.endDate && !end) fields.endDate = 'Enter a valid date.';
    if (start && end && end < start) {
      fields.endDate = 'End date cannot be before start date.';
    }
    if (row.progress < 0 || row.progress > 100) {
      fields.progress = 'Progress must be between 0 and 100.';
    }
    if (validMilestones && row.milestoneId && !validMilestones.has(row.milestoneId)) {
      fields.milestoneId = 'Select an existing milestone.';
    }
    if (Object.keys(fields).length) errors.push({ index, fields });
  });

  return errors;
}

export function filterProjects(source = [], filters = {}) {
  const projects = Array.isArray(source) ? source.map(normalizeProject) : [];
  const scope = normalizedFilter(filters.scope);
  const pm = normalizedFilter(filters.pm);
  const rag = normalizedFilter(filters.rag);
  const lifecycle = normalizedFilter(filters.lifecycle);
  const productFamily = normalizedFilter(filters.productFamily);
  const search = normalizedFilter(filters.search);

  return projects.filter(project => {
    const projectManager = project.pm ?? project.projectManager ?? project.owner;

    return (
      (isAll(scope) || normalizedFilter(project.projectLevel) === scope)
      && (isAll(pm) || normalizedFilter(projectManager) === pm)
      && (isAll(rag) || normalizedFilter(project.status) === rag)
      && (isAll(lifecycle) || normalizedFilter(project.lifecycle) === lifecycle)
      && (isAll(productFamily) || normalizedFilter(project.productFamily) === productFamily)
      && (!search || normalizedFilter(`${project.code ?? ''} ${project.name ?? ''}`).includes(search))
    );
  });
}

function stringValue(value) {
  return (value ?? '').toString().trim();
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizedFilter(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isAll(value) {
  return !value || value === 'all';
}
