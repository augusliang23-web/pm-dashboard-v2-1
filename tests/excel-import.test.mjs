import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  formatImportPreviewRow,
  normalizeImportRow,
  planImport,
} from '../team-2/js/excel-import.mjs';

const dashboard = await readFile(new URL('../team-2/index.html', import.meta.url), 'utf8');

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

test('keeps valid PMO completed hours pending confirmation and never sets actual', () => {
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
    assert.ok(invalid.warnings.some(message => /PMO Hours Completed is invalid/.test(message)));
  }
});

test('formats a complete safe preview with blocking reason and every warning', () => {
  const preview = formatImportPreviewRow({
    rowNumber: 7,
    project: {
      code: 'SAFE-1',
      name: '<img src=x onerror=alert(1)>',
      projectLevel: 'hardware-module',
      pm: 'Morgan',
      owner: 'Morgan',
      classification: 'Internal',
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
    'Morgan',
    'Internal',
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

test('uses hardware-module with warnings for blank or unknown level and invalid estimates', () => {
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
  assert.equal(blank.warnings.length, 4);
  assert.ok(blank.warnings.some(message => /Project Level/.test(message)));
  assert.ok(blank.warnings.some(message => /Estimated Hard Hours/.test(message)));

  const unknown = normalizeImportRow({
    'Project ID/Code': 'HW-2',
    'Project Name': 'Board 2',
    'Project Level': 'subassembly',
  }, 9);
  assert.equal(unknown.project.projectLevel, 'hardware-module');
  assert.ok(unknown.warnings.some(message => /subassembly/.test(message)));
});

test('supports long-form lead aliases and warns while normalizing invalid volume', () => {
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
  assert.ok(result.warnings.some(message => /PII MYS Volume/.test(message)));
});

test('treats blank and N/A values as missing without numeric warnings', () => {
  const result = normalizeImportRow({
    'Project ID/Code': 'HW-3',
    'Project Name': 'Board',
    Type: ' N/A ',
    'Estimated PMO Hours': ' ',
  }, 3);

  assert.equal(result.project.projectType, '');
  assert.equal(result.project.resources.pmo.estimated, 0);
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

test('dashboard import is admin-only, preview-only, and has no write API in its handlers', () => {
  assert.match(dashboard, /id="importExcelBtn"[^>]+admin-only/);
  assert.ok(dashboard.includes("if (currentRole !== 'admin') return;"));
  assert.ok(dashboard.includes("XLSX.read("));
  assert.ok(dashboard.includes("planImport("));
  assert.ok(dashboard.includes("sheet_to_json(workbook.Sheets[firstSheetName], { defval: '', raw: true })"));
  assert.ok(dashboard.includes('resetExcelImportPreview();'));
  assert.ok(dashboard.includes('.textContent ='));
  assert.doesNotMatch(dashboard, /id="confirmImportBtn"/);

  const start = dashboard.indexOf('window.openExcelImport');
  const end = dashboard.indexOf('// END EXCEL IMPORT', start);
  const importSource = dashboard.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(importSource, /\b(?:setDoc|writeBatch|addDoc|updateDoc|deleteDoc)\s*\(/);
});

test('every file selection resets pending plan, rows, counts, and status before validation', () => {
  const start = dashboard.indexOf('window.handleExcelImportFile');
  const end = dashboard.indexOf('// END EXCEL IMPORT', start);
  const handler = dashboard.slice(start, end);
  const resetPosition = handler.indexOf('resetExcelImportPreview();');
  const filePosition = handler.indexOf('const file =');
  assert.ok(resetPosition >= 0 && resetPosition < filePosition);
  assert.ok(dashboard.includes("document.getElementById('excelImportError').textContent = '';"));
  assert.ok(dashboard.includes("document.getElementById('excelImportPreview').replaceChildren();"));
  assert.ok(dashboard.includes("document.getElementById(id).textContent = '0';"));
});

test('workbook integration locks first-sheet parsing and all bounded error paths', () => {
  const blockStart = dashboard.indexOf('// EXCEL IMPORT');
  const handlerStart = dashboard.indexOf('window.handleExcelImportFile', blockStart);
  const end = dashboard.indexOf('// END EXCEL IMPORT', handlerStart);
  const importBlock = dashboard.slice(blockStart, end);
  const handler = dashboard.slice(handlerStart, end);

  assert.ok(handler.indexOf('resetExcelImportPreview();') < handler.indexOf('const file ='));
  assert.ok(handler.includes('if (!file) return;'));
  assert.ok(importBlock.includes('MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024'));
  assert.ok(handler.includes('File is too large. Select a file no larger than 10 MB.'));
  assert.ok(handler.includes("if (!window.XLSX?.read || !window.XLSX?.utils?.sheet_to_json)"));
  assert.ok(handler.includes('Excel parser is unavailable. Reload the page and try again.'));
  assert.ok(handler.includes('const firstSheetName = workbook.SheetNames?.[0];'));
  assert.ok(handler.includes('workbook.Sheets[firstSheetName]'));
  assert.ok(handler.includes("throw new Error('Workbook has no sheets.')"));
  assert.ok(handler.includes("throw new Error('The first sheet has no data rows.')"));
  assert.ok(importBlock.includes('MAX_IMPORT_ROWS = 5000'));
  assert.ok(handler.includes('The first sheet exceeds the ${MAX_IMPORT_ROWS}-row limit.'));

  const catchStart = handler.indexOf('} catch (parseError) {');
  const catchSource = handler.slice(catchStart);
  assert.ok(catchStart >= 0);
  assert.ok(catchSource.includes('pendingExcelImportPlan = null;'));
  assert.ok(catchSource.includes("error.textContent = parseError instanceof Error ? parseError.message : 'Could not parse this workbook.';"));
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
  assert.ok(clearSource.includes('resetExcelImportPreview();'));
  assert.ok(closeSource.includes('clearExcelImport();'));
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
