const MISSING_VALUES = new Set(['', 'n/a', 'na']);
const UNSAFE_IDS = new Set(['__proto__', 'constructor', 'prototype']);

const FIELDS = Object.freeze({
  id: ['project id/code', 'project id', 'project code'],
  name: ['project name'],
  level: ['project level'],
  type: ['type', 'project type'],
  classification: ['classification'],
  productFamily: ['product family'],
  pm: ['pmo'],
  volume: ['pii mys volume'],
  hardwareLead: ['hardware lead', 'hard lead'],
  firmwareLead: ['firmware lead', 'firm lead'],
  systemLead: ['system electrical lead', 'system lead', 'sys lead'],
  mechanicalLead: ['mechanical lead', 'mech lead'],
  hardwareHours: ['estimated hard hours', 'estimated hardware hours'],
  firmwareHours: ['estimated firm hours', 'estimated firmware hours'],
  systemHours: ['estimated sys hours', 'estimated system hours', 'estimated system electrical hours'],
  mechanicalHours: ['estimated mech hours', 'estimated mechanical hours'],
  pmoHours: ['estimated pmo hours'],
});

function key(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizedCells(source) {
  const cells = Object.create(null);
  if (!source || typeof source !== 'object' || Array.isArray(source)) return cells;
  for (const [header, value] of Object.entries(source)) {
    const normalizedHeader = key(header);
    if (normalizedHeader && !Object.hasOwn(cells, normalizedHeader)) cells[normalizedHeader] = value;
  }
  return cells;
}

function valueFor(cells, aliases) {
  for (const alias of aliases) {
    if (Object.hasOwn(cells, alias)) return cells[alias];
  }
  return undefined;
}

function textValue(value) {
  const text = String(value ?? '').trim();
  return MISSING_VALUES.has(text.toLowerCase()) ? '' : text;
}

function estimate(value, label, warnings) {
  const text = textValue(value);
  if (!text) return 0;
  const numeric = typeof value === 'number' ? value : Number(text);
  if (!Number.isFinite(numeric) || numeric < 0) {
    warnings.push(`${label} is invalid; using 0.`);
    return 0;
  }
  return numeric;
}

function resource(estimated, lead) {
  return {
    ...(lead === undefined ? {} : { lead }),
    estimated,
    actual: null,
    remaining: null,
    updatedAt: '',
  };
}

function safeProjectId(value) {
  const normalized = key(value);
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value)
    && !UNSAFE_IDS.has(normalized);
}

export function normalizeImportRow(source, rowNumber = 2) {
  const cells = normalizedCells(source);
  const read = field => valueFor(cells, FIELDS[field]);
  const code = textValue(read('id'));
  const name = textValue(read('name'));
  const warnings = [];
  const errors = [];

  if (!code) errors.push('Project ID/Code is required.');
  else if (!safeProjectId(code)) errors.push('Project ID/Code contains unsafe characters or a reserved value.');
  if (!name) errors.push('Project Name is required.');

  const levelSource = textValue(read('level'));
  const projectLevel = key(levelSource) === 'system' ? 'system' : 'hardware-module';
  if (!levelSource) warnings.push('Project Level is blank; using hardware-module.');
  else if (!['system', 'hardware-module', 'hardware module'].includes(key(levelSource))) {
    warnings.push(`Project Level "${levelSource}" is unknown; using hardware-module.`);
  }

  const project = {
    code,
    name,
    projectLevel,
    projectType: textValue(read('type')),
    classification: textValue(read('classification')),
    productFamily: textValue(read('productFamily')),
    owner: textValue(read('pm')),
    piiMysVolume: textValue(read('volume')),
    resources: {
      hardware: resource(estimate(read('hardwareHours'), 'Estimated Hard Hours', warnings), textValue(read('hardwareLead'))),
      firmware: resource(estimate(read('firmwareHours'), 'Estimated Firm Hours', warnings), textValue(read('firmwareLead'))),
      systemElectrical: resource(estimate(read('systemHours'), 'Estimated Sys Hours', warnings), textValue(read('systemLead'))),
      mechanical: resource(estimate(read('mechanicalHours'), 'Estimated Mech Hours', warnings), textValue(read('mechanicalLead'))),
      pmo: resource(estimate(read('pmoHours'), 'Estimated PMO Hours', warnings)),
    },
  };

  return { rowNumber, project, warnings, errors };
}

export function planImport(rows = [], existingIds = []) {
  const existing = new Set(
    Array.from(existingIds ?? [], value => key(
      value && typeof value === 'object' ? value.code ?? value.id : value,
    )).filter(Boolean),
  );
  const seen = new Set();
  const ready = [];
  const skipped = [];
  const failed = [];

  (Array.isArray(rows) ? rows : []).forEach((source, index) => {
    const row = normalizeImportRow(source, index + 2);
    const normalizedId = key(row.project.code);
    if (row.errors.length) {
      failed.push({ ...row, reason: row.errors.join(' ') });
    } else if (existing.has(normalizedId)) {
      skipped.push({ ...row, reason: 'Project ID already exists.' });
    } else if (seen.has(normalizedId)) {
      skipped.push({ ...row, reason: 'Duplicate Project ID in this file.' });
    } else {
      seen.add(normalizedId);
      ready.push(row);
    }
  });

  return {
    ready,
    skipped,
    failed,
    counts: { ready: ready.length, skipped: skipped.length, failed: failed.length },
  };
}
