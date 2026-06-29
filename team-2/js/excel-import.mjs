const MISSING_VALUES = new Set(['', 'n/a', 'na']);
const UNSAFE_IDS = new Set(['__proto__', 'constructor', 'prototype']);

const FIELDS = Object.freeze({
  id: ['project id/code', 'project id', 'project code'],
  name: ['project name'],
  level: ['project level'],
  type: ['type', 'project type'],
  classification: ['classification', 'project classification'],
  productFamily: ['product family'],
  pm: ['pmo'],
  volume: ['pii mys volume'],
  hardwareLead: ['hardware lead', 'hard lead', 'lead hardware eng.', 'lead hardware engineer'],
  firmwareLead: ['firmware lead', 'firm lead', 'lead firmware eng.', 'lead firmware engineer'],
  systemLead: ['system electrical lead', 'system lead', 'sys lead', 'lead elec/sys engineer', 'lead electrical/system engineer'],
  mechanicalLead: ['mechanical lead', 'mech lead', 'lead mechanical eng.', 'lead mechanical engineer'],
  hardwareHours: ['estimated hard hours', 'estimated hardware hours', 'hard. hours'],
  firmwareHours: ['estimated firm hours', 'estimated firmware hours', 'firm. hours'],
  systemHours: ['estimated sys hours', 'estimated system hours', 'estimated system electrical hours', 'sys. hours'],
  mechanicalHours: ['estimated mech hours', 'estimated mechanical hours', 'mech. hours'],
  pmoHours: ['estimated pmo hours', 'pmo hours'],
  pmoCompletedHours: ['pmo hours completed'],
});

function key(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizedCells(source) {
  const cells = Object.create(null);
  if (!source || typeof source !== 'object' || Array.isArray(source)) return cells;
  for (const [header, value] of Object.entries(source)) {
    if (header.startsWith('__')) continue;
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

function resource(estimated) {
  return { estimated, actual: null, remaining: null, updatedAt: '' };
}

function pendingCompletedHours(value, warnings) {
  const text = textValue(value);
  if (!text) return null;
  const numeric = typeof value === 'number' ? value : Number(text);
  if (!Number.isFinite(numeric) || numeric < 0) {
    warnings.push('PMO Hours Completed is invalid; it will not be imported.');
    return null;
  }
  warnings.push('PMO Hours Completed is pending; explicit confirmation is required before setting actual hours.');
  return numeric;
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
  const warnings = Array.isArray(source?.__importWarnings__) ? [...source.__importWarnings__] : [];
  const errors = Array.isArray(source?.__importErrors__) ? [...source.__importErrors__] : [];

  if (!code) errors.push('Project ID/Code is required.');
  else if (!safeProjectId(code)) errors.push('Project ID/Code contains unsafe characters or a reserved value.');
  if (!name) errors.push('Project Name is required.');

  const levelSource = textValue(read('level'));
  const projectLevel = key(levelSource) === 'system' ? 'system' : 'hardware-module';
  if (!levelSource) warnings.push('Project Level is blank; using hardware-module.');
  else if (!['system', 'hardware-module', 'hardware module'].includes(key(levelSource))) {
    warnings.push(`Project Level "${levelSource}" is unknown; using hardware-module.`);
  }

  const pm = textValue(read('pm'));
  const pmoCompletedHoursPending = pendingCompletedHours(read('pmoCompletedHours'), warnings);
  const project = {
    code,
    name,
    projectLevel,
    lifecycle: 'active',
    projectType: textValue(read('type')),
    classification: textValue(read('classification')),
    productFamily: textValue(read('productFamily')),
    pm,
    owner: pm,
    piiMysVolume: estimate(read('volume'), 'PII MYS Volume', warnings),
    leads: {
      hardware: textValue(read('hardwareLead')),
      firmware: textValue(read('firmwareLead')),
      systemElectrical: textValue(read('systemLead')),
      mechanical: textValue(read('mechanicalLead')),
    },
    resources: {
      hardware: resource(estimate(read('hardwareHours'), 'Estimated Hard Hours', warnings)),
      firmware: resource(estimate(read('firmwareHours'), 'Estimated Firm Hours', warnings)),
      systemElectrical: resource(estimate(read('systemHours'), 'Estimated Sys Hours', warnings)),
      mechanical: resource(estimate(read('mechanicalHours'), 'Estimated Mech Hours', warnings)),
      pmo: resource(estimate(read('pmoHours'), 'Estimated PMO Hours', warnings)),
    },
  };

  const worksheetRowNumber = Number.isFinite(source?.__rowNum__) ? source.__rowNum__ + 1 : rowNumber;
  return { rowNumber: worksheetRowNumber, project, pmoCompletedHoursPending, warnings, errors };
}

export function formatImportPreviewRow(row, status) {
  const project = row?.project ?? {};
  const resources = project.resources ?? {};
  const estimateFor = discipline => resources[discipline]?.estimated ?? 0;
  const pmOwner = project.pm || project.owner || 'Not provided';
  const warnings = Array.isArray(row?.warnings) ? row.warnings : [];
  const pendingCompleted = Number.isFinite(row?.pmoCompletedHoursPending)
    ? row.pmoCompletedHoursPending
    : 'Not provided';

  return [
    `Row ${row?.rowNumber ?? 'Unknown'}`,
    status,
    `ID ${project.code || 'No ID'}`,
    `Name ${project.name || 'No name'}`,
    `Level ${project.projectLevel || 'Not provided'}`,
    `PM/Owner ${pmOwner}`,
    `Classification ${project.classification || 'Not provided'}`,
    `Resource estimates: Hardware ${estimateFor('hardware')}, Firmware ${estimateFor('firmware')}, System/Electrical ${estimateFor('systemElectrical')}, Mechanical ${estimateFor('mechanical')}, PMO ${estimateFor('pmo')}`,
    `Pending PMO completed ${pendingCompleted}`,
    `Blocking reason: ${row?.reason || 'None.'}`,
    `Warnings: ${warnings.length ? warnings.join(' | ') : 'None.'}`,
  ].join(' · ');
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
