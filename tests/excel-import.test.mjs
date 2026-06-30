import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildImportResults,
  importResultsToCsv,
  formatImportPreviewRow,
  mergeReadyImportRows,
  normalizeImportRow,
  planImport,
} from '../team-2/js/excel-import.mjs';

const dashboard = await readFile(new URL('../team-2/index.html', import.meta.url), 'utf8');
const runbook = await readFile(
  new URL('../docs/migration/team-2-excel-import-runbook.md', import.meta.url),
  'utf8',
);

test('normalizes case-insensitive, whitespace-tolerant headers into a safe project', () => {
  const result = normalizeImportRow({
    ' project id/code ': ' SYS-10 ',
    'PROJECT NAME': ' Power Shelf ',
    ' Project Level ': ' SYSTEM ',
    Type: ' Platform ',
    'Project Classification': ' Internal ',
    'Product Family': ' Power ',
    PMO: ' Morgan ',
    'PII MYS Volume': ' 200 ',
    'Lead Hardware Eng.': ' A ',
    'Lead Firmware Eng.': ' B ',
    'Lead Elec/Sys Engineer': ' C ',
    'Lead Mechanical Engineer': ' D ',
    'Hard. Hours': '12.5',
    'Firm. Hours': 9,
    'Sys. Hours': 7,
    'Mech. Hours': 4,
    'PMO Hours': 3,
  }, 2);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.rowNumber, 2);
  assert.deepEqual(result.project, {
    code: 'SYS-10',
    name: 'Power Shelf',
    projectLevel: 'system',
    lifecycle: 'active',
    projectType: 'Platform',
    classification: 'Internal',
    productFamily: 'Power',
    pm: 'Morgan',
    owner: 'Morgan',
    piiMysVolume: 200,
    leads: {
      hardware: 'A',
      firmware: 'B',
      systemElectrical: 'C',
      mechanical: 'D',
    },
    resources: {
      hardware: { estimated: 12.5, actual: null, remaining: null, updatedAt: '' },
      firmware: { estimated: 9, actual: null, remaining: null, updatedAt: '' },
      systemElectrical: { estimated: 7, actual: null, remaining: null, updatedAt: '' },
      mechanical: { estimated: 4, actual: null, remaining: null, updatedAt: '' },
      pmo: { estimated: 3, actual: null, remaining: null, updatedAt: '' },
    },
  });
});

test('uses the original SheetJS worksheet row number when available', () => {
  const plan = planImport([
    { __rowNum__: 12, 'Project ID/Code': 'ROW-13', 'Project Name': 'Original row' },
    { __rowNum__: Infinity, 'Project ID/Code': 'ROW-3', 'Project Name': 'Fallback row' },
  ]);

  assert.equal(plan.ready[0].rowNumber, 13);
  assert.equal(plan.ready[1].rowNumber, 3);
});

test('merges parser warnings and errors into row validation', () => {
  const plan = planImport([{
    __rowNum__: 4,
    __importWarnings__: ['Project Name contains Excel error #VALUE!.'],
    __importErrors__: ['A numeric Project ID/Code requires an explicit text format.'],
    'Project ID/Code': '',
    'Project Name': '#VALUE!',
  }]);

  assert.equal(plan.failed[0].rowNumber, 5);
  assert.ok(plan.failed[0].warnings.includes('Project Name contains Excel error #VALUE!.'));
  assert.match(plan.failed[0].reason, /explicit text format/i);
});

test('keeps valid PMO completed hours pending confirmation and blocks invalid values', () => {
  const result = normalizeImportRow({
    'Project ID/Code': 'PMO-1',
    'Project Name': 'PMO pending',
    PMO: ' Morgan ',
    'PMO Hours Completed': '6.5',
  }, 2);

  assert.equal(result.project.pm, 'Morgan');
  assert.equal(result.project.owner, 'Morgan');
  assert.equal(result.pmoCompletedHoursPending, 6.5);
  assert.equal(result.project.resources.pmo.actual, null);
  assert.ok(result.warnings.some(message => (
    /PMO Hours Completed/.test(message) && /explicit confirmation/i.test(message)
  )));

  for (const completed of ['#DIV/0!', -1]) {
    const invalid = normalizeImportRow({
      'Project ID/Code': 'PMO-2',
      'Project Name': 'Invalid PMO completed',
      'PMO Hours Completed': completed,
    }, 3);
    assert.equal(invalid.pmoCompletedHoursPending, null);
    assert.equal(invalid.project.resources.pmo.actual, null);
    assert.ok(invalid.errors.some(message => (
      /PMO Hours Completed is invalid/.test(message)
      && message.includes(String(completed))
    )));
  }
});

test('formats a complete safe preview with blocking reason and every warning', () => {
  const preview = formatImportPreviewRow({
    rowNumber: 7,
    project: {
      code: 'SAFE-1',
      name: '<img src=x onerror=alert(1)>',
      projectLevel: 'hardware-module',
      projectType: 'Platform',
      pm: 'Morgan',
      owner: 'Morgan',
      classification: 'Internal',
      productFamily: 'Power',
      piiMysVolume: 200,
      leads: {
        hardware: 'Alex',
        firmware: 'Blair',
        systemElectrical: 'Casey',
        mechanical: 'Devon',
      },
      resources: {
        hardware: { estimated: 1 },
        firmware: { estimated: 2 },
        systemElectrical: { estimated: 3 },
        mechanical: { estimated: 4 },
        pmo: { estimated: 5, actual: null },
      },
    },
    pmoCompletedHoursPending: 2.5,
    reason: 'Project ID already exists.',
    warnings: ['First warning.', 'Second warning.'],
  }, 'Skipped');

  for (const expected of [
    'Row 7',
    'Skipped',
    'SAFE-1',
    '<img src=x onerror=alert(1)>',
    'hardware-module',
    'Type Platform',
    'Morgan',
    'Internal',
    'Product family Power',
    'PII MYS volume 200',
    'Hardware lead Alex',
    'Firmware lead Blair',
    'System/Electrical lead Casey',
    'Mechanical lead Devon',
    'Hardware 1',
    'Firmware 2',
    'System/Electrical 3',
    'Mechanical 4',
    'PMO 5',
    'Pending PMO completed 2.5',
    'Blocking reason: Project ID already exists.',
    'First warning.',
    'Second warning.',
  ]) {
    assert.ok(preview.includes(expected), `expected preview to include ${expected}`);
  }
  assert.equal(preview.match(/First warning\./g)?.length, 1);
  assert.equal(preview.match(/Second warning\./g)?.length, 1);

  const renderStart = dashboard.indexOf('function renderExcelImportPlan(plan)');
  const renderEnd = dashboard.indexOf('window.handleExcelImportFile', renderStart);
  const renderSource = dashboard.slice(renderStart, renderEnd);
  assert.ok(renderSource.includes('item.textContent = formatImportPreviewRow(row, status);'));
  assert.doesNotMatch(renderSource, /\.innerHTML\s*=/);
});

test('uses hardware-module for blank or unknown level and blocks invalid estimates', () => {
  const blank = normalizeImportRow({
    'Project ID/Code': 'HW-1',
    'Project Name': 'Board',
    'Project Level': 'N/A',
    'Estimated Hard Hours': '#DIV/0!',
    'Estimated Firm Hours': -2,
    'Estimated Sys Hours': 'nonsense',
  }, 8);

  assert.equal(blank.project.projectLevel, 'hardware-module');
  assert.deepEqual(blank.project.resources.hardware, { estimated: 0, actual: null, remaining: null, updatedAt: '' });
  assert.ok(blank.warnings.some(message => /Project Level/.test(message)));
  assert.equal(blank.errors.length, 3);
  assert.ok(blank.errors.some(message => (
    /Estimated Hard Hours/.test(message) && /#DIV\/0!/.test(message)
  )));
  assert.ok(blank.errors.some(message => (
    /Estimated Firm Hours/.test(message) && /-2/.test(message)
  )));
  assert.ok(blank.errors.some(message => (
    /Estimated Sys Hours/.test(message) && /nonsense/.test(message)
  )));
  assert.equal(planImport([{
    'Project ID/Code': 'HW-1',
    'Project Name': 'Board',
    'Estimated Hard Hours': '#DIV/0!',
  }]).counts.failed, 1);

  const unknown = normalizeImportRow({
    'Project ID/Code': 'HW-2',
    'Project Name': 'Board 2',
    'Project Level': 'subassembly',
  }, 9);
  assert.equal(unknown.project.projectLevel, 'hardware-module');
  assert.ok(unknown.warnings.some(message => /subassembly/.test(message)));
});

test('supports long-form lead aliases and blocks invalid PII volume', () => {
  const result = normalizeImportRow({
    'Project ID/Code': 'ALIAS-1',
    'Project Name': 'Aliases',
    'Lead Mechanical Eng.': 'Mech',
    'Lead Electrical/System Engineer': 'Sys',
    'Lead Hardware Engineer': 'Hard',
    'Lead Firmware Engineer': 'Firm',
    'PII MYS Volume': '#DIV/0!',
  }, 6);

  assert.equal(result.project.leads.mechanical, 'Mech');
  assert.equal(result.project.leads.systemElectrical, 'Sys');
  assert.equal(result.project.leads.hardware, 'Hard');
  assert.equal(result.project.leads.firmware, 'Firm');
  assert.equal(result.project.piiMysVolume, 0);
  assert.ok(result.errors.some(message => (
    /PII MYS Volume/.test(message) && /#DIV\/0!/.test(message)
  )));
  assert.equal(planImport([{
    'Project ID/Code': 'ALIAS-1',
    'Project Name': 'Aliases',
    'PII MYS Volume': -1,
  }]).counts.failed, 1);
});

test('treats blank and N/A values as missing without numeric warnings', () => {
  const result = normalizeImportRow({
    'Project ID/Code': 'HW-3',
    'Project Name': 'Board',
    Type: ' N/A ',
    'Estimated PMO Hours': ' ',
    'Estimated Hard Hours': 'N/A',
    'PII MYS Volume': 'na',
    'PMO Hours Completed': 'N/A',
  }, 3);

  assert.equal(result.project.projectType, '');
  assert.equal(result.project.resources.pmo.estimated, 0);
  assert.equal(result.project.resources.hardware.estimated, 0);
  assert.equal(result.project.piiMysVolume, 0);
  assert.equal(result.pmoCompletedHoursPending, null);
  assert.deepEqual(result.errors, []);
  assert.equal(result.warnings.filter(message => /Estimated PMO Hours/.test(message)).length, 0);
});

test('fails missing or unsafe IDs and names without prototype pollution', () => {
  for (const [id, name] of [
    ['', 'Missing ID'],
    ['OK-1', ''],
    ['../escape', 'Unsafe'],
    ['a/b', 'Unsafe'],
    ['__proto__', 'Unsafe'],
    ['constructor', 'Unsafe'],
    ['prototype', 'Unsafe'],
  ]) {
    const result = normalizeImportRow({ 'Project ID/Code': id, 'Project Name': name }, 4);
    assert.ok(result.errors.length, `${id || '(blank)'} should fail`);
  }
  assert.equal({}.polluted, undefined);
});

test('planImport skips existing and in-file duplicate IDs case-insensitively', () => {
  const plan = planImport([
    { 'Project ID/Code': ' NEW-1 ', 'Project Name': 'First' },
    { 'Project ID/Code': 'new-1', 'Project Name': 'Duplicate' },
    { 'Project ID/Code': 'EXISTING', 'Project Name': 'Exists' },
    { 'Project ID/Code': '', 'Project Name': 'Failed' },
  ], [' existing ']);

  assert.deepEqual(plan.counts, { ready: 1, skipped: 2, failed: 1 });
  assert.deepEqual(plan.ready.map(row => row.rowNumber), [2]);
  assert.deepEqual(plan.skipped.map(row => row.rowNumber), [3, 4]);
  assert.deepEqual(plan.failed.map(row => row.rowNumber), [5]);
  assert.match(plan.skipped[0].reason, /duplicate/i);
  assert.match(plan.skipped[1].reason, /already exists/i);
});

test('confirmed merge skips live conflicts while preserving existing live objects exactly', () => {
  const plan = planImport([
    { 'Project ID/Code': 'NEW-1', 'Project Name': 'New project' },
    { 'Project ID/Code': 'LIVE-1', 'Project Name': 'Now conflicting' },
  ]);
  const timestamp = '2026-06-29T12:00:00.000Z';
  const existing = {
    code: 'live-1',
    name: 'Existing',
    customField: { keep: true },
    createdAt: { seconds: 123, nanoseconds: 456 },
    resources: {
      pmo: {
        estimated: 'legacy-value',
        actual: undefined,
        remaining: 99,
        updatedAt: { seconds: 789, nanoseconds: 0 },
      },
      customDiscipline: { note: 'keep' },
    },
  };
  const before = structuredClone(existing);
  const merged = mergeReadyImportRows(
    [existing],
    plan.ready,
    { timestamp, confirmPmoCompleted: false },
  );

  assert.equal(merged.projects.length, 2);
  assert.equal(merged.projects[0], existing);
  assert.deepEqual(existing, before);
  assert.deepEqual(merged.projects[0], before);
  assert.deepEqual(merged.results.map(result => result.status), ['pending', 'skipped']);
  assert.match(merged.results[1].reason, /live target week/i);
  assert.match(merged.results[0].warnings, /Project Level is blank/);
  assert.match(merged.results[1].warnings, /Project Level is blank/);
  assert.equal(merged.projects[1].importSource, 'excel-one-time');
  assert.equal(merged.projects[1].importedAt, timestamp);
  assert.equal(merged.projects[1].createdAt, timestamp);
  assert.equal(merged.projects[1].updatedAt, timestamp);
});

test('imported projects receive stable level-specific default Gantt schedules', () => {
  const timestamp = '2026-06-29T12:00:00.000Z';
  const rows = [
    normalizeImportRow({
      'Project ID/Code': 'SYS-SCHEDULE',
      'Project Name': 'System schedule',
      'Project Level': 'system',
    }),
    normalizeImportRow({
      'Project ID/Code': 'MOD-SCHEDULE',
      'Project Name': 'Module schedule',
      'Project Level': 'hardware-module',
    }),
  ];

  const first = mergeReadyImportRows([], rows, { timestamp }).projects;
  const second = mergeReadyImportRows([], rows, { timestamp }).projects;

  assert.deepEqual(
    first[0].ganttWorkstreams.map(workstream => workstream.name),
    ['Design', 'Integration', 'Validation', 'Certification', 'Launch'],
  );
  assert.deepEqual(
    first[1].ganttWorkstreams.map(workstream => workstream.name),
    ['Documentation', 'BOM Verification', 'Procurement', 'Assembly/Test', 'Certification'],
  );
  for (const project of first) {
    const ids = project.ganttWorkstreams.map(workstream => workstream.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(ids, ['workstream-1', 'workstream-2', 'workstream-3', 'workstream-4', 'workstream-5']);
  }
  assert.deepEqual(
    second.map(project => project.ganttWorkstreams.map(workstream => workstream.id)),
    first.map(project => project.ganttWorkstreams.map(workstream => workstream.id)),
  );
});

test('confirmed imports use the current injected Gantt templates without changing existing projects', () => {
  const timestamp = '2026-06-29T12:00:00.000Z';
  const existing = {
    code: 'EXISTING',
    name: 'Existing project',
    projectLevel: 'system',
    ganttWorkstreams: [{ id: 'existing-phase', name: 'Do not replace' }],
  };
  const before = structuredClone(existing);
  const rows = [
    normalizeImportRow({
      'Project ID/Code': 'NEW-SYSTEM',
      'Project Name': 'New system',
      'Project Level': 'system',
    }),
    normalizeImportRow({
      'Project ID/Code': 'NEW-MODULE',
      'Project Name': 'New module',
      'Project Level': 'hardware-module',
    }),
  ];
  const templateConfig = {
    system: ['Architecture', 'Release'],
    'hardware-module': ['Layout', 'EVT', 'DVT'],
  };

  const merged = mergeReadyImportRows([existing], rows, { timestamp, templateConfig });

  assert.equal(merged.projects[0], existing);
  assert.deepEqual(existing, before);
  assert.deepEqual(
    merged.projects[1].ganttWorkstreams.map(workstream => workstream.name),
    ['Architecture', 'Release'],
  );
  assert.deepEqual(
    merged.projects[2].ganttWorkstreams.map(workstream => workstream.name),
    ['Layout', 'EVT', 'DVT'],
  );
});

test('imported projects preserve explicit Gantt schedule data', () => {
  const row = normalizeImportRow({
    'Project ID/Code': 'EXPLICIT-SCHEDULE',
    'Project Name': 'Explicit schedule',
    'Project Level': 'system',
  });
  row.project.ganttWorkstreams = [{
    id: 'imported-workstream',
    name: 'Imported phase',
    status: 'on-track',
    progress: 25,
    sortOrder: 3,
  }];

  const project = mergeReadyImportRows([], [row], {
    timestamp: '2026-06-29T12:00:00.000Z',
  }).projects[0];

  assert.deepEqual(project.ganttWorkstreams.map(workstream => ({
    id: workstream.id,
    name: workstream.name,
    status: workstream.status,
    progress: workstream.progress,
    sortOrder: workstream.sortOrder,
  })), [{
    id: 'imported-workstream',
    name: 'Imported phase',
    status: 'on-track',
    progress: 25,
    sortOrder: 3,
  }]);
});

test('PMO completed hours persist only after explicit semantics confirmation', () => {
  const row = normalizeImportRow({
    'Project ID/Code': 'PMO-3',
    'Project Name': 'PMO semantics',
    'Estimated PMO Hours': 10,
    'PMO Hours Completed': 4,
  });
  const timestamp = '2026-06-29T12:00:00.000Z';

  const unconfirmed = mergeReadyImportRows([], [row], {
    timestamp,
    confirmPmoCompleted: false,
  }).projects[0];
  assert.equal(unconfirmed.resources.pmo.actual, null);
  assert.equal(unconfirmed.resources.pmo.remaining, null);
  assert.equal('pmoCompletedHoursPending' in unconfirmed, false);

  const confirmed = mergeReadyImportRows([], [row], {
    timestamp,
    confirmPmoCompleted: true,
  }).projects[0];
  assert.equal(confirmed.resources.pmo.actual, 4);
  assert.equal(confirmed.resources.pmo.remaining, 6);
  assert.equal(confirmed.resources.pmo.updatedAt, timestamp);
});

test('merge rejects unreasonable project counts and estimated week document size', () => {
  const row = normalizeImportRow({
    'Project ID/Code': 'LIMIT-1',
    'Project Name': 'Limit',
  });
  assert.throws(
    () => mergeReadyImportRows([], [row], { timestamp: '2026-06-29T12:00:00.000Z', maxProjects: 0 }),
    /project count safety limit/i,
  );
  assert.throws(
    () => mergeReadyImportRows([], [row], { timestamp: '2026-06-29T12:00:00.000Z', maxBytes: 1 }),
    /document size safety limit/i,
  );
});

test('result construction marks attempted rows failed after a write failure', () => {
  const plan = planImport([
    { 'Project ID/Code': 'OK-1', 'Project Name': 'Ready' },
    { 'Project ID/Code': 'EXISTING', 'Project Name': 'Skipped' },
    { 'Project ID/Code': '', 'Project Name': 'Failed validation' },
  ], ['existing']);
  const results = buildImportResults(plan, [], 'Firestore write failed.');

  assert.deepEqual(results.map(result => result.status).sort(), ['failed', 'failed', 'skipped']);
  assert.match(results.find(result => result.projectId === 'OK-1').reason, /Firestore write failed/);
});

test('failed import results preserve blocking reasons and parser warnings', () => {
  const plan = planImport([{
    __importWarnings__: ['Estimated Hard Hours contains Excel error #DIV/0!.'],
    'Project ID/Code': 'BAD-1',
    'Project Name': 'Bad estimate',
    'Estimated Hard Hours': '#DIV/0!',
  }]);

  const [result] = buildImportResults(plan);

  assert.equal(result.status, 'failed');
  assert.match(result.reason, /Estimated Hard Hours.*#DIV\/0!/);
  assert.match(result.warnings, /Estimated Hard Hours contains Excel error #DIV\/0!\./);
  assert.match(result.warnings, /Project Level is blank/);
});

test('result construction promotes pending rows to success only after transaction resolution', () => {
  const plan = planImport([
    { 'Project ID/Code': 'OK-2', 'Project Name': 'Ready' },
  ]);
  const attempted = mergeReadyImportRows([], plan.ready, {
    timestamp: '2026-06-29T12:00:00.000Z',
  });
  assert.equal(attempted.results[0].status, 'pending');

  const resolved = buildImportResults(plan, attempted.results);
  assert.equal(resolved[0].status, 'success');
});

test('results CSV escapes fields and prevents spreadsheet formula injection', () => {
  const csv = importResultsToCsv([
    {
      rowNumber: 2,
      projectId: '=HYPERLINK("bad")',
      status: 'failed',
      reason: 'Comma, quote " and\nline',
      warnings: 'Raw #DIV/0! warning',
    },
    { rowNumber: 3, projectId: 'SAFE-1', status: 'success', reason: '' },
  ]);

  assert.ok(csv.startsWith('rowNumber,projectId,status,reason,warnings\r\n'));
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(csv.includes('"Comma, quote "" and\nline"'));
  assert.ok(csv.includes('Raw #DIV/0! warning'));
  assert.ok(csv.endsWith('3,SAFE-1,success,,\r\n'));
});

test('dashboard import is admin-only and uses a target-week transaction only after two confirmations', () => {
  assert.match(dashboard, /id="importExcelBtn"[^>]+admin-only/);
  assert.ok(dashboard.includes("if (currentRole !== 'admin') return;"));
  assert.ok(dashboard.includes("new Worker('./js/excel-worker.js')"));
  assert.ok(dashboard.includes("planImport("));
  assert.ok(dashboard.includes('worker.postMessage(fileData, [fileData])'));
  assert.ok(dashboard.includes('resetExcelImportPreview();'));
  assert.ok(dashboard.includes('.textContent ='));
  assert.match(dashboard, /id="confirmImportBtn"/);
  assert.match(dashboard, /id="executeImportBtn"/);
  assert.match(dashboard, /id="importConfirmationAcknowledged"[^>]+type="checkbox"/);
  assert.match(dashboard, /id="confirmPmoActual"[^>]+type="checkbox"/);
  assert.ok(dashboard.includes('runTransaction(db, async transaction =>'));
  assert.ok(dashboard.includes("doc(db, 'weeks', targetWeekId)"));
  assert.ok(dashboard.includes('transaction.update(targetWeekRef'));
  assert.doesNotMatch(dashboard, /collection\(db,\s*['"]projects['"]\)/);

  const start = dashboard.indexOf('window.openExcelImport');
  const end = dashboard.indexOf('// END EXCEL IMPORT', start);
  const importSource = dashboard.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.ok(importSource.includes("currentRole !== 'admin'"));
  assert.ok(importSource.includes('isPendingExcelImportCurrent(plan)'));
  assert.ok(dashboard.includes("document.getElementById('excelImportOverlay').classList.contains('open')"));
  assert.ok(importSource.includes('pendingExcelImportPlan !== plan'));
  assert.ok(importSource.includes('getSelectedImportWeek()?.weekLabel'));
  assert.ok(importSource.includes('excelImportInFlight'));
  assert.ok(importSource.includes('await runTransaction'));
  assert.ok(importSource.includes('}, { maxAttempts: 1 });'));
  const transactionStart = importSource.indexOf('await runTransaction');
  const transactionEnd = importSource.indexOf('}, { maxAttempts: 1 });', transactionStart);
  const transactionSource = importSource.slice(transactionStart, transactionEnd);
  assert.ok(transactionSource.indexOf('await transaction.get(targetWeekRef)') >= 0);
  const boundaryGuard = transactionSource.indexOf(
    'isPendingExcelImportCurrent(plan)',
    transactionSource.indexOf('await transaction.get(targetWeekRef)'),
  );
  assert.ok(boundaryGuard >= 0 && boundaryGuard < transactionSource.indexOf('transaction.update(targetWeekRef'));
  assert.doesNotMatch(transactionSource, /serverTimestamp\s*\(/);
  assert.ok(importSource.indexOf("showSaveToast('Excel import completed')") > transactionEnd);
  assert.doesNotMatch(importSource.slice(0, transactionEnd), /status:\s*['"]success['"]/);
});

test('confirmation UI reports exact counts and target while results are available only after an attempt', () => {
  assert.match(dashboard, /id="excelImportConfirmation"/);
  assert.match(dashboard, /id="excelImportConfirmationText"/);
  assert.match(dashboard, /PMO Hours Completed[\s\S]+actual\/remaining/i);
  assert.match(dashboard, /id="downloadImportResultsBtn"[^>]+hidden/);
  assert.ok(dashboard.includes('plan.counts.ready'));
  assert.ok(dashboard.includes('plan.counts.skipped'));
  assert.ok(dashboard.includes('plan.counts.failed'));
  assert.ok(dashboard.includes('plan.targetWeekLabel'));
  assert.ok(dashboard.includes('lastExcelImportResults = results;'));
  assert.ok(dashboard.includes('pendingExcelImportPlan = null;'));
  assert.ok(dashboard.includes("document.getElementById('downloadImportResultsBtn').hidden = false;"));
  assert.match(dashboard, /id="excelImportTargetWeek"/);
  assert.ok(dashboard.includes("document.getElementById('excelImportTargetWeek').textContent ="));
  assert.ok(dashboard.includes('`Target week: ${plan.targetWeekLabel}`'));
  assert.ok(dashboard.includes('invalidateExcelImportForWeekChange();'));
});

test('in-flight import owns modal state and disables every mutation or cancellation control', () => {
  const start = dashboard.indexOf('// EXCEL IMPORT');
  const end = dashboard.indexOf('// END EXCEL IMPORT', start);
  const source = dashboard.slice(start, end);
  for (const id of [
    'excelImportFile',
    'closeExcelImportBtn',
    'confirmPmoActual',
    'importConfirmationAcknowledged',
    'confirmImportBtn',
    'executeImportBtn',
  ]) {
    assert.ok(source.includes(`'${id}'`), `expected in-flight control wiring for ${id}`);
  }
  assert.ok(source.includes('function setExcelImportControlsDisabled(disabled)'));
  assert.ok(source.includes('if (excelImportInFlight) return false;'));
  assert.ok(source.includes('if (excelImportInFlight) return;'));
  assert.ok(source.includes('let excelImportAttemptToken = 0;'));
  assert.ok(source.includes('const attemptToken = ++excelImportAttemptToken;'));
  assert.ok(source.includes('isExcelImportAttemptCurrent(attemptToken, plan)'));
  assert.ok(dashboard.includes("if (id === 'excelImportOverlay' && excelImportInFlight) return;"));
});

test('import plans, attempts, and results are owned by the current authenticated user', () => {
  const start = dashboard.indexOf('// EXCEL IMPORT');
  const end = dashboard.indexOf('// END EXCEL IMPORT', start);
  const source = dashboard.slice(start, end);
  assert.ok(source.includes('function getCurrentImportUserKey()'));
  assert.ok(source.includes('currentUser?.uid || getEmailKey(currentUser)'));
  assert.ok(source.includes('importPlan.createdByUserKey = getCurrentImportUserKey();'));
  assert.ok(source.includes('plan.createdByUserKey === getCurrentImportUserKey()'));
  assert.ok(source.includes('ownerUserKey: plan.createdByUserKey'));
  assert.ok(source.includes('activeExcelImportAttempt.ownerUserKey === getCurrentImportUserKey()'));
  assert.ok(source.includes('lastExcelImportResultsUserKey = getCurrentImportUserKey();'));
  assert.ok(source.includes('lastExcelImportResultsUserKey !== getCurrentImportUserKey()'));

  const updatePosition = source.indexOf('transaction.update(targetWeekRef');
  const boundarySource = source.slice(source.lastIndexOf('if (', updatePosition), updatePosition);
  assert.ok(boundarySource.includes("currentRole !== 'admin'"));
  assert.ok(boundarySource.includes('plan.createdByUserKey !== getCurrentImportUserKey()'));
});

test('all auth transitions and user setup force-clear import state', () => {
  assert.ok(dashboard.includes('function clearExcelImportForAuthTransition()'));
  const logoutStart = dashboard.indexOf('window.handleLogout = async () =>');
  const authStart = dashboard.indexOf('onAuthStateChanged(auth, async user =>');
  const setupStart = dashboard.indexOf('function setupUI()');
  assert.ok(dashboard.slice(logoutStart, authStart).includes('clearExcelImportForAuthTransition();'));
  assert.ok(dashboard.slice(authStart, setupStart).includes('clearExcelImportForAuthTransition();'));
  assert.ok(dashboard.slice(setupStart, dashboard.indexOf('// ── DATA ──', setupStart))
    .includes('clearExcelImportForAuthTransition();'));

  const cleanupStart = dashboard.indexOf('function clearExcelImportForAuthTransition()');
  const cleanupEnd = dashboard.indexOf('function clearExcelImportWorkerTimer()', cleanupStart);
  const cleanup = dashboard.slice(cleanupStart, cleanupEnd);
  for (const expected of [
    'excelImportAttemptToken += 1;',
    'excelImportRequestToken += 1;',
    'terminateExcelImportWorker();',
    'pendingExcelImportPlan = null;',
    'lastExcelImportResults = null;',
    "document.getElementById('excelImportFile').value = '';",
    "document.getElementById('excelImportOverlay').classList.remove('open');",
  ]) {
    assert.ok(cleanup.includes(expected), `expected auth cleanup to include ${expected}`);
  }
});

test('Excel import has a visible file label and shares the reusable dialog focus trap', () => {
  assert.match(dashboard, /<label[^>]+for="excelImportFile"[^>]*>[^<]+<\/label>/);
  const keydownStart = dashboard.indexOf("document.addEventListener('keydown'");
  const keydownEnd = dashboard.indexOf('// ── PROJECT COMBINED EDIT', keydownStart);
  const keydown = dashboard.slice(keydownStart, keydownEnd);
  assert.ok(keydown.includes("event.key === 'Tab'"));
  assert.ok(keydown.includes('getFocusTrapIndex('));
  assert.doesNotMatch(keydown, /modal\.id === 'onePageStatusModal'/);
  assert.ok(dashboard.includes('modalReturnFocus.focus()'));
});

test('both direct and arrow week navigation invalidate Excel previews after effective changes', () => {
  const jumpStart = dashboard.indexOf('window.jumpToWeek = (idx) =>');
  const jumpEnd = dashboard.indexOf('window.toggleReleaseWeek', jumpStart);
  const jumpSource = dashboard.slice(jumpStart, jumpEnd);
  assert.ok(jumpSource.includes('invalidateExcelImportForWeekChange();'));

  const navStart = dashboard.indexOf('window.navWeek = (dir) =>');
  const navEnd = dashboard.indexOf('let modalReturnFocus', navStart);
  const navSource = dashboard.slice(navStart, navEnd);
  assert.ok(navSource.includes('const nextIndex ='));
  assert.ok(navSource.includes('if (nextIndex !== currentIdx)'));
  assert.ok(navSource.includes('invalidateExcelImportForWeekChange();'));
});

test('CSV download uses an attached anchor and defers object URL revocation', () => {
  const start = dashboard.indexOf('window.downloadExcelImportResults = () =>');
  const end = dashboard.indexOf('// END EXCEL IMPORT', start);
  const source = dashboard.slice(start, end);
  assert.ok(source.includes('document.body.append(link);'));
  assert.ok(source.includes('link.click();'));
  assert.ok(source.includes('link.remove();'));
  assert.match(source, /setTimeout\(\(\) => URL\.revokeObjectURL\(url\), 0\)/);
  assert.ok(source.indexOf('document.body.append(link);') < source.indexOf('link.click();'));
  assert.ok(source.indexOf('link.click();') < source.indexOf('link.remove();'));
});

test('runbook records row count, stops on failures, and includes an Overview spot-check', () => {
  assert.match(runbook, /worksheet row count/i);
  assert.match(runbook, /stop[^.\n]*failed rows/i);
  assert.match(runbook, /Overview/i);
});

test('every file selection resets pending plan, rows, counts, and status before validation', () => {
  const start = dashboard.indexOf('window.handleExcelImportFile');
  const end = dashboard.indexOf('// END EXCEL IMPORT', start);
  const handler = dashboard.slice(start, end);
  const resetPosition = handler.indexOf('resetExcelImportPreview(');
  const filePosition = handler.indexOf('const file =');
  assert.ok(resetPosition >= 0 && resetPosition < filePosition);
  assert.ok(dashboard.includes("document.getElementById('excelImportError').textContent = '';"));
  assert.ok(dashboard.includes("document.getElementById('excelImportPreview').replaceChildren();"));
  assert.ok(dashboard.includes("document.getElementById(id).textContent = '0';"));
});

test('workbook integration delegates parsing to one cancellable worker per request', () => {
  const blockStart = dashboard.indexOf('// EXCEL IMPORT');
  const handlerStart = dashboard.indexOf('window.handleExcelImportFile', blockStart);
  const end = dashboard.indexOf('// END EXCEL IMPORT', handlerStart);
  const importBlock = dashboard.slice(blockStart, end);
  const handler = dashboard.slice(handlerStart, end);

  assert.ok(handler.indexOf('resetExcelImportPreview(') < handler.indexOf('const file ='));
  assert.ok(handler.includes('if (!file) return;'));
  assert.ok(importBlock.includes('MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024'));
  assert.ok(handler.includes('File is too large. Select a file no larger than 10 MB.'));
  assert.ok(importBlock.includes('let excelImportWorker = null;'));
  assert.ok(importBlock.includes('worker?.terminate();'));
  assert.ok(importBlock.includes("const worker = new Worker('./js/excel-worker.js');"));
  assert.ok(importBlock.includes('excelImportWorker = worker;'));
  assert.ok(importBlock.includes('worker.postMessage(fileData, [fileData])'));
  assert.ok(importBlock.includes('worker.terminate();'));
  assert.ok(importBlock.includes('const MAX_EXCEL_PARSE_MS = 15 * 1000;'));
  assert.ok(importBlock.includes('let excelImportWorkerTimer = null;'));
  assert.ok(importBlock.includes('clearTimeout(excelImportWorkerTimer);'));
  assert.ok(importBlock.includes('excelImportWorkerTimer = setTimeout('));
  assert.match(importBlock, /Excel parsing timed out after 15 seconds/i);

  const catchStart = handler.indexOf('} catch (parseError) {');
  const catchSource = handler.slice(catchStart);
  assert.ok(catchStart >= 0);
  assert.ok(catchSource.includes('pendingExcelImportPlan = null;'));
  assert.ok(catchSource.includes("error.textContent = parseError instanceof Error ? parseError.message : 'Could not parse this workbook.';"));
});

test('worker timeout is cleared on completion and cancellation paths', () => {
  const blockStart = dashboard.indexOf('// EXCEL IMPORT');
  const end = dashboard.indexOf('// END EXCEL IMPORT', blockStart);
  const importBlock = dashboard.slice(blockStart, end);
  const terminateStart = importBlock.indexOf('function terminateExcelImportWorker()');
  const resetStart = importBlock.indexOf('function resetExcelImportPreview()', terminateStart);
  const terminateSource = importBlock.slice(terminateStart, resetStart);
  const parseStart = importBlock.indexOf('function parseExcelWorkbook(');
  const openStart = importBlock.indexOf('window.openExcelImport', parseStart);
  const parseSource = importBlock.slice(parseStart, openStart);

  assert.ok(terminateSource.includes('clearExcelImportWorkerTimer();'));
  assert.ok(parseSource.includes('clearExcelImportWorkerTimer();'));
  assert.ok(parseSource.includes('worker.terminate();'));
  assert.ok(parseSource.includes('excelImportWorker = null;'));
  assert.ok(parseSource.includes('excelImportWorkerReject = null;'));
  assert.ok(parseSource.includes('settle(reject, new Error('));
  assert.ok(parseSource.includes('let settled = false;'));
  assert.match(parseSource, /try\s*\{\s*worker\.postMessage\(fileData, \[fileData\]\);\s*\}\s*catch/);
});

test('async preview requests are invalidated and rechecked before rendering or reporting errors', () => {
  const blockStart = dashboard.indexOf('// EXCEL IMPORT');
  const end = dashboard.indexOf('// END EXCEL IMPORT', blockStart);
  const importBlock = dashboard.slice(blockStart, end);
  const resetStart = importBlock.indexOf('function resetExcelImportPreview()');
  const clearStart = importBlock.indexOf('function clearExcelImport()', resetStart);
  const resetSource = importBlock.slice(resetStart, clearStart);
  const openStart = importBlock.indexOf('window.openExcelImport', clearStart);
  const clearSource = importBlock.slice(clearStart, openStart);
  const closeStart = importBlock.indexOf('window.closeExcelImport', openStart);
  const closeSource = importBlock.slice(closeStart, importBlock.indexOf('function renderExcelImportPlan', closeStart));
  const handlerStart = importBlock.indexOf('window.handleExcelImportFile');
  const handler = importBlock.slice(handlerStart);
  const renderPosition = handler.indexOf('renderExcelImportPlan(pendingExcelImportPlan);');
  const finalGuardPosition = handler.lastIndexOf('if (!isExcelImportRequestCurrent(requestToken, file, fileInput)) return;', renderPosition);
  const catchPosition = handler.indexOf('} catch (parseError) {');

  assert.ok(importBlock.includes('let excelImportRequestToken = 0;'));
  assert.ok(resetSource.includes('excelImportRequestToken += 1;'));
  assert.ok(resetSource.includes('terminateExcelImportWorker();'));
  assert.ok(clearSource.includes('resetExcelImportPreview();'));
  assert.ok(closeSource.includes('clearExcelImport('));
  assert.ok(importBlock.includes("currentRole === 'admin'"));
  assert.ok(importBlock.includes("document.getElementById('excelImportOverlay').classList.contains('open')"));
  assert.ok(importBlock.includes('fileInput.files?.[0] === file'));
  assert.ok(handler.indexOf('resetExcelImportPreview();') < handler.indexOf('const requestToken = excelImportRequestToken;'));
  assert.ok(finalGuardPosition >= 0 && finalGuardPosition < renderPosition);
  assert.ok(catchPosition >= 0);
  assert.ok(handler.slice(catchPosition).includes(
    'if (!isExcelImportRequestCurrent(requestToken, file, fileInput)) return;',
  ));
});
