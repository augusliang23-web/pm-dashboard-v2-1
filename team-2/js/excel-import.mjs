import { normalizeProject } from './portfolio-core.mjs';

const MISSING_VALUES = new Set(['', 'n/a', 'na']);
const UNSAFE_IDS = new Set(['__proto__', 'constructor', 'prototype']);
export const MAX_IMPORT_WEEK_PROJECTS = 500;
export const MAX_IMPORT_WEEK_BYTES = 900 * 1024;

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
    `Type ${project.projectType || 'Not provided'}`,
    `PM/Owner ${pmOwner}`,
    `Classification ${project.classification || 'Not provided'}`,
    `Product family ${project.productFamily || 'Not provided'}`,
    `PII MYS volume ${project.piiMysVolume ?? 'Not provided'}`,
    `Hardware lead ${project.leads?.hardware || 'Not provided'}`,
    `Firmware lead ${project.leads?.firmware || 'Not provided'}`,
    `System/Electrical lead ${project.leads?.systemElectrical || 'Not provided'}`,
    `Mechanical lead ${project.leads?.mechanical || 'Not provided'}`,
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

function projectId(value) {
  return textValue(value?.project?.code ?? value?.projectId ?? value?.code);
}

function prepareImportedProject(row, timestamp, confirmPmoCompleted) {
  const project = normalizeProject(row.project);
  const pmoCompleted = row.pmoCompletedHoursPending;
  if (confirmPmoCompleted && Number.isFinite(pmoCompleted)) {
    const estimated = project.resources.pmo?.estimated ?? 0;
    project.resources.pmo = {
      ...project.resources.pmo,
      actual: pmoCompleted,
      remaining: Math.max(estimated - pmoCompleted, 0),
      updatedAt: timestamp,
    };
  }
  return {
    ...project,
    importSource: 'excel-one-time',
    importedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function jsonByteLength(value) {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

export function assertReasonableWeekDocument(week, options = {}) {
  const {
    maxBytes = MAX_IMPORT_WEEK_BYTES,
    maxProjects = MAX_IMPORT_WEEK_PROJECTS,
  } = options;
  const projects = Array.isArray(week?.projects) ? week.projects : [];
  if (projects.length > maxProjects) {
    throw new Error(`Import aborted: project count safety limit of ${maxProjects} would be exceeded.`);
  }
  if (jsonByteLength(week) > maxBytes) {
    throw new Error(`Import aborted: document size safety limit of ${maxBytes} bytes would be exceeded.`);
  }
}

export function mergeReadyImportRows(currentProjects = [], readyRows = [], options = {}) {
  const {
    confirmPmoCompleted = false,
    maxBytes = MAX_IMPORT_WEEK_BYTES,
    maxProjects = MAX_IMPORT_WEEK_PROJECTS,
    timestamp,
  } = options;
  if (!timestamp || Number.isNaN(Date.parse(timestamp))) {
    throw new Error('A valid ISO import timestamp is required.');
  }

  const projects = (Array.isArray(currentProjects) ? currentProjects : []).map(normalizeProject);
  const liveCodes = new Set(projects.map(project => key(project.code)).filter(Boolean));
  const results = [];

  for (const row of Array.isArray(readyRows) ? readyRows : []) {
    const id = projectId(row);
    const normalizedId = key(id);
    if (!normalizedId || liveCodes.has(normalizedId)) {
      results.push({
        rowNumber: row?.rowNumber ?? '',
        projectId: id,
        status: 'skipped',
        reason: 'Project ID conflicts with the live target week; the existing project was preserved.',
      });
      continue;
    }
    projects.push(prepareImportedProject(row, timestamp, confirmPmoCompleted));
    liveCodes.add(normalizedId);
    results.push({
      rowNumber: row?.rowNumber ?? '',
      projectId: id,
      status: 'success',
      reason: 'Imported.',
    });
  }

  assertReasonableWeekDocument({ projects }, { maxBytes, maxProjects });
  return { projects, results };
}

function plannedResult(row, status) {
  return {
    rowNumber: row?.rowNumber ?? '',
    projectId: projectId(row),
    status,
    reason: row?.reason || (status === 'failed' ? 'Validation failed.' : 'Skipped.'),
  };
}

export function buildImportResults(plan, attemptedResults = [], writeFailure = '') {
  const results = [
    ...(plan?.skipped ?? []).map(row => plannedResult(row, 'skipped')),
    ...(plan?.failed ?? []).map(row => plannedResult(row, 'failed')),
    ...(Array.isArray(attemptedResults) ? attemptedResults : []).map(result => (
      writeFailure && result.status === 'success'
        ? { ...result, status: 'failed', reason: writeFailure }
        : { ...result }
    )),
  ];
  return results.sort((a, b) => Number(a.rowNumber || 0) - Number(b.rowNumber || 0));
}

function safeCsvValue(value) {
  let text = String(value ?? '');
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function importResultsToCsv(results = []) {
  const header = ['rowNumber', 'projectId', 'status', 'reason'];
  const rows = (Array.isArray(results) ? results : []).map(result => [
    result.rowNumber,
    result.projectId,
    result.status,
    result.reason,
  ]);
  return [header, ...rows]
    .map(row => row.map(safeCsvValue).join(','))
    .join('\r\n') + '\r\n';
}
