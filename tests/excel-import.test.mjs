import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { normalizeImportRow, planImport } from '../team-2/js/excel-import.mjs';

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
    'PII MYS Volume': '#DIV/0!',
  }, 6);

  assert.equal(result.project.leads.mechanical, 'Mech');
  assert.equal(result.project.leads.systemElectrical, 'Sys');
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
