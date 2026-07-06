import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dashboard = readFileSync(new URL('../team-2/index.html', import.meta.url), 'utf8');

test('Overview PDF opens a section selection dialog with approved presets', () => {
  assert.match(dashboard, /onclick="openOverviewPrintDialog\(\)"/);
  assert.match(dashboard, /id="overviewPrintOverlay"/);
  for (const preset of ['all', 'executive', 'roadmap', 'resource', 'custom']) {
    assert.ok(dashboard.includes(`applyOverviewPrintPreset('${preset}')`));
  }
});

test('every Overview report section has a selectable print identity', () => {
  for (const section of [
    'health-focus',
    'weekly-trend',
    'executive-summary',
    'attention-matrix',
    'risk-actions',
    'quarterly-roadmap',
    'project-portfolio',
    'resource-budget',
  ]) {
    assert.ok(dashboard.includes(`data-print-section="${section}"`), section);
  }
});

test('print selection requires one section and does not persist to storage or Firebase', () => {
  const start = dashboard.indexOf('window.confirmOverviewPrint =');
  const end = dashboard.indexOf('window.setOverviewScope', start);
  const source = dashboard.slice(start, end);
  assert.ok(source.includes('Select at least one section to export.'));
  assert.ok(source.includes("classList.toggle('print-excluded'"));
  assert.ok(source.includes('window.print()'));
  assert.doesNotMatch(source, /localStorage|setDoc|updateDoc|runTransaction/);
  assert.match(dashboard, /\[data-print-section\]\.print-excluded \{ display:none !important; \}/);
});
