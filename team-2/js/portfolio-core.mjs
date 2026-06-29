export const PROJECT_LEVEL = Object.freeze({
  SYSTEM: 'system',
  HARDWARE_MODULE: 'hardware-module',
});

export const PROJECT_LIFECYCLE = Object.freeze({
  ACTIVE: 'active',
  ON_HOLD: 'on-hold',
  COMPLETED: 'completed',
});

export const OVERVIEW_SCOPE = Object.freeze({
  SYSTEM: PROJECT_LEVEL.SYSTEM,
  HARDWARE_MODULE: PROJECT_LEVEL.HARDWARE_MODULE,
  ALL: 'all',
});

export const RESOURCE_DISCIPLINES = Object.freeze([
  'hardware',
  'firmware',
  'systemElectrical',
  'mechanical',
  'pmo',
]);

const PROJECT_LEVELS = new Set(Object.values(PROJECT_LEVEL));
const OVERVIEW_SCOPES = new Set(Object.values(OVERVIEW_SCOPE));
const PROJECT_LIFECYCLES = new Set(Object.values(PROJECT_LIFECYCLE));
const RESOURCE_DISCIPLINE_SET = new Set(RESOURCE_DISCIPLINES);
const WORKSTREAM_STATUSES = new Set(['not-started', 'on-track', 'at-risk', 'delayed', 'completed']);
const WORKSTREAM_TEMPLATES = Object.freeze({
  [PROJECT_LEVEL.SYSTEM]: Object.freeze(['Design', 'Integration', 'Validation', 'Certification', 'Launch']),
  [PROJECT_LEVEL.HARDWARE_MODULE]: Object.freeze(['Documentation', 'BOM Verification', 'Procurement', 'Assembly/Test', 'Certification']),
});

export function formatStatusDate(value) {
  let candidate = value;
  try {
    if (candidate && typeof candidate.toDate === 'function') candidate = candidate.toDate();
    else if (candidate && Number.isFinite(candidate.seconds)) {
      candidate = new Date(candidate.seconds * 1000 + Number(candidate.nanoseconds || 0) / 1000000);
    }
  } catch {
    return 'Not available';
  }
  const date = candidate instanceof Date ? new Date(candidate.getTime()) : new Date(candidate);
  if (!candidate || Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function resolveProjectStatusDate(project = {}, reportingPeriod = {}) {
  const projectCandidates = [project.statusDate, project.updatedAt, project.lastUpdatedAt];
  const reportingCandidates = [
    reportingPeriod.statusDate,
    reportingPeriod.reportingDate,
    reportingPeriod.weekEnding,
    reportingPeriod.weekEndDate,
    reportingPeriod.weekDate,
  ];
  for (const candidate of [...projectCandidates, ...reportingCandidates]) {
    const formatted = formatStatusDate(candidate);
    if (formatted !== 'Not available') return formatted;
  }

  const rangeEnd = String(reportingPeriod.weekDate || '').split(/\s+-\s+/).at(-1);
  const year = String(reportingPeriod.weekLabel || '').match(/\b(20\d{2})\b/)?.[1];
  return rangeEnd && year ? formatStatusDate(`${rangeEnd}, ${year}`) : 'Not available';
}

function contentLines(value) {
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
  return String(value || '').split('\n').map(item => item.trim()).filter(Boolean);
}

export function normalizeRiskActionRows(project = {}) {
  const stored = project.riskActions || project.riskPairs;
  if (Array.isArray(stored) && stored.length) {
    return stored.map(item => ({
      risk: String(item?.risk || item?.description || '').trim(),
      action: contentLines(item?.action || item?.actions || item?.mitigation || item?.requiredAction).join('\n'),
    })).filter(item => item.risk || item.action);
  }
  const risks = contentLines(project.risk);
  const actions = contentLines(project.next);
  return Array.from({ length: Math.max(risks.length, actions.length) }, (_, index) => ({
    risk: risks[index] || '',
    action: actions[index] || '',
  }));
}

export function getFocusTrapIndex(currentIndex, count, shiftKey) {
  if (count <= 0) return -1;
  if (currentIndex < 0) return shiftKey ? count - 1 : 0;
  if (shiftKey && currentIndex === 0) return count - 1;
  if (!shiftKey && currentIndex === count - 1) return 0;
  return currentIndex;
}

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
      ? Object.fromEntries(Object.entries(project.resources).map(([key, value]) => [
        key,
        RESOURCE_DISCIPLINE_SET.has(key)
          ? { ...(isPlainObject(value) ? value : {}), ...normalizeResourceEntry(value) }
          : value,
      ]))
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
    updatedAt: normalizeTimestamp(entry.updatedAt),
  };
}

export function validateResourceInput(value, blank = false) {
  if (blank) return { valid: true, value: null };
  return Number.isFinite(value) && value >= 0
    ? { valid: true, value }
    : { valid: false, value: null };
}

export function mergeResourceEntry(previousSource, estimated, actual, changedAt) {
  const source = previousSource && typeof previousSource === 'object' ? previousSource : {};
  const previous = normalizeResourceEntry(source);
  const unchanged = estimated === previous.estimated && actual === previous.actual;
  return {
    ...source,
    ...normalizeResourceEntry({
      estimated,
      actual,
      updatedAt: unchanged ? previous.updatedAt : changedAt,
    }),
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

export function normalizeOverviewScope(value) {
  return OVERVIEW_SCOPES.has(value) ? value : OVERVIEW_SCOPE.SYSTEM;
}

export function getOverviewProjects(source = [], scope = OVERVIEW_SCOPE.SYSTEM) {
  const projects = Array.isArray(source) ? source.map(normalizeProject) : [];
  const normalizedScope = normalizeOverviewScope(scope);
  return normalizedScope === OVERVIEW_SCOPE.ALL
    ? projects
    : projects.filter(project => project.projectLevel === normalizedScope);
}

export function getOverviewProjectBadgeLabel(project = {}, scope = OVERVIEW_SCOPE.SYSTEM) {
  if (normalizeOverviewScope(scope) !== OVERVIEW_SCOPE.ALL) return '';
  return normalizeProject(project).projectLevel === PROJECT_LEVEL.HARDWARE_MODULE ? 'Module' : 'System';
}

function stringValue(value) {
  return (value ?? '').toString().trim();
}

function normalizeTimestamp(value) {
  let date;
  try {
    if (value instanceof Date) {
      date = value;
    } else if (value && typeof value.toDate === 'function') {
      date = value.toDate();
    } else if (value && typeof value === 'object' && Number.isFinite(value.seconds)) {
      const nanoseconds = value.nanoseconds ?? 0;
      if (!Number.isFinite(nanoseconds)) return '';
      date = new Date(value.seconds * 1000 + nanoseconds / 1e6);
    } else if (typeof value === 'string' && value.trim()) {
      date = new Date(value.trim());
    } else {
      return '';
    }
    return date instanceof Date && Number.isFinite(date.getTime()) ? date.toISOString() : '';
  } catch {
    return '';
  }
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
