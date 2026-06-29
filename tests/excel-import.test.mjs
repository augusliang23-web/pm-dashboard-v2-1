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
    Classification: ' Internal ',
    'Product Family': ' Power ',
    PMO: ' Morgan ',
    'PII MYS Volume': ' 200K ',
    'Hardware Lead': ' A ',
    'Firmware Lead': ' B ',
    'System Electrical Lead': ' C ',
    'Mechanical Lead': ' D ',
    'Estimated Hard Hours': '12.5',
    'Estimated Firm Hours': 9,
    'Estimated Sys Hours': 7,
    'Estimated Mech Hours': 4,
    'Estimated PMO Hours': 3,
  }, 2);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.rowNumber, 2);
  assert.deepEqual(result.project, {
    code: 'SYS-10',
    name: 'Power Shelf',
    projectLevel: 'system',
    projectType: 'Platform',
    classification: 'Internal',
    productFamily: 'Power',
    owner: 'Morgan',
    piiMysVolume: '200K',
    resources: {
      hardware: { lead: 'A', estimated: 12.5, actual: null, remaining: null, updatedAt: '' },
      firmware: { lead: 'B', estimated: 9, actual: null, remaining: null, updatedAt: '' },
      systemElectrical: { lead: 'C', estimated: 7, actual: null, remaining: null, updatedAt: '' },
      mechanical: { lead: 'D', estimated: 4, actual: null, remaining: null, updatedAt: '' },
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
  assert.deepEqual(blank.project.resources.hardware, { lead: '', estimated: 0, actual: null, remaining: null, updatedAt: '' });
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
  assert.ok(dashboard.includes('.textContent ='));
  assert.doesNotMatch(dashboard, /id="confirmImportBtn"/);

  const start = dashboard.indexOf('window.openExcelImport');
  const end = dashboard.indexOf('// END EXCEL IMPORT', start);
  const importSource = dashboard.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(importSource, /\b(?:setDoc|writeBatch|addDoc|updateDoc|deleteDoc)\s*\(/);
});
