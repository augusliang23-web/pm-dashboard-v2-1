const PROGRESS_LEVELS = new Set([0, 25, 50, 75, 100]);
const HEALTH_LEVELS = new Set(['on-track', 'at-risk', 'delayed']);
const SOURCE_TYPES = new Set(['milestone', 'quarterly']);

function sourceValues(sources) {
  if (Array.isArray(sources)) return sources;
  if (sources && typeof sources === 'object') {
    return Object.keys(sources).sort().map(key => sources[key]);
  }
  return [];
}

function normalizeSource(source = {}) {
  const type = SOURCE_TYPES.has(source.type) ? source.type : 'milestone';
  return {
    projectCode: String(source.projectCode || ''),
    type,
    milestoneId: String(source.milestoneId || ''),
  };
}

export function executiveSourceKey(source = {}) {
  const normalized = normalizeSource(source);
  return `${normalized.type}|${normalized.projectCode}|${normalized.milestoneId}`;
}

export function normalizeExecutiveOutcome(source = '') {
  if (typeof source === 'string') {
    return {
      id: '',
      text: source,
      progressMode: 'manual',
      manualProgress: 0,
      manualHealth: 'on-track',
      sources: [],
    };
  }
  const progress = Number(source.manualProgress);
  return {
    id: String(source.id || ''),
    text: String(source.text || source.label || ''),
    progressMode: source.progressMode === 'auto' ? 'auto' : 'manual',
    manualProgress: PROGRESS_LEVELS.has(progress) ? progress : 0,
    manualHealth: HEALTH_LEVELS.has(source.manualHealth) ? source.manualHealth : 'on-track',
    sources: sourceValues(source.sources)
      .map(normalizeSource)
      .filter(item => item.projectCode && item.milestoneId)
      .slice(0, 3),
  };
}

function displayHealth(value, overdue = false) {
  if (overdue || value === 'red' || value === 'delayed') return 'red';
  if (value === 'yellow' || value === 'at-risk') return 'yellow';
  return 'green';
}

export function calculateExecutiveOutcome(source, sourceLookup = {}) {
  const outcome = normalizeExecutiveOutcome(source);
  if (outcome.progressMode === 'manual') {
    return {
      progress: outcome.manualProgress,
      health: displayHealth(outcome.manualHealth),
      mode: 'manual',
      validSources: [],
      missingSources: [],
    };
  }

  const validSources = [];
  const missingSources = [];
  for (const reference of outcome.sources) {
    const evidence = sourceLookup[executiveSourceKey(reference)];
    if (evidence) validSources.push({ reference, ...evidence });
    else missingSources.push(reference);
  }
  if (!validSources.length) {
    return {
      progress: null,
      health: 'unknown',
      mode: 'auto',
      validSources,
      missingSources,
    };
  }

  const progress = Math.round(
    validSources.reduce((sum, item) => {
      const value = Number(item.progress);
      return sum + Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
    }, 0) / validSources.length,
  );
  const health = validSources.reduce((worst, item) => {
    const current = displayHealth(item.health, item.overdue);
    if (current === 'red' || worst === 'red') return 'red';
    if (current === 'yellow' || worst === 'yellow') return 'yellow';
    return 'green';
  }, 'green');
  return {
    progress,
    health,
    mode: 'auto',
    validSources,
    missingSources,
  };
}

export function serializeExecutiveOutcome(source) {
  const outcome = normalizeExecutiveOutcome(source);
  return {
    ...outcome,
    sources: Object.fromEntries(
      outcome.sources.map((item, index) => [`source${index + 1}`, item]),
    ),
  };
}
