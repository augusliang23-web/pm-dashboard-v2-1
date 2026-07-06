import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const dashboardPath = new URL('../team-2/index.html', import.meta.url);
const removedFeaturePaths = [
  '../team-2/js/excel-import.mjs',
  '../team-2/js/excel-worker.js',
  '../team-2/js/excel-worker-core.js',
  '../team-2/vendor/xlsx.full.min.js',
];

test('Excel import UI and implementation are removed', async () => {
  const dashboard = await readFile(dashboardPath, 'utf8');

  for (const marker of [
    'id="importExcelBtn"',
    'id="excelImportOverlay"',
    './js/excel-import.mjs',
    'openExcelImport',
    'handleExcelImportFile',
    'executeConfirmedExcelImport',
    'clearExcelImportForAuthTransition',
  ]) {
    assert.doesNotMatch(dashboard, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  for (const relativePath of removedFeaturePaths) {
    await assert.rejects(access(new URL(relativePath, import.meta.url)));
  }
});

test('retired portfolio metadata fields are not shown in Project Editor', async () => {
  const dashboard = await readFile(dashboardPath, 'utf8');

  for (const fieldId of [
    'pe_project_type',
    'pe_classification',
    'pe_product_family',
  ]) {
    assert.doesNotMatch(dashboard, new RegExp(fieldId));
  }
});
