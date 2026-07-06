import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dashboard = await readFile(new URL('../team-2/index.html', import.meta.url), 'utf8');

test('executive timeline normalizes legacy text into structured outcome rows', () => {
  assert.match(dashboard, /normalizeExecutiveOutcome/);
  assert.match(dashboard, /class="exec-outcome-row"/);
  assert.match(dashboard, /class="fi etm-outcome-text"/);
  assert.match(dashboard, /class="fs etm-outcome-mode"/);
  assert.match(dashboard, /class="fs etm-manual-progress"/);
  assert.match(dashboard, /class="fs etm-manual-health"/);
  assert.match(dashboard, /class="fs etm-source-select"/);
  assert.match(dashboard, /if \(sourceRows\.length >= 3\) return/);
});

test('executive outcome editor collects at most three evidence links', () => {
  assert.match(dashboard, /function collectExecutiveOutcomeRows\(/);
  assert.match(dashboard, /querySelectorAll\('\.etm-source-select'\)/);
  assert.match(dashboard, /\.slice\(0, 3\)/);
  assert.match(dashboard, /progressMode:/);
  assert.match(dashboard, /manualProgress:/);
  assert.match(dashboard, /manualHealth:/);
});

test('portfolio timeline displays evidence-based progress and relink warnings', () => {
  assert.match(dashboard, /function renderExecutiveOutcomeDisplay\(/);
  assert.match(dashboard, /calculateExecutiveOutcome\(outcome, catalog\.lookup\)/);
  assert.match(dashboard, /class="exec-outcome-progress"/);
  assert.match(dashboard, /class="exec-outcome-progress-fill/);
  assert.match(dashboard, /Needs relink/);
  assert.match(dashboard, /result\.mode === 'auto' \? 'Auto' : 'Manual'/);
  assert.match(dashboard, /Last reporting week/);
});

test('evidence catalog links stable project and quarterly milestone identities', () => {
  assert.match(dashboard, /function buildExecutiveEvidenceCatalog\(/);
  assert.match(dashboard, /type: 'milestone'/);
  assert.match(dashboard, /type: 'quarterly'/);
  assert.match(dashboard, /ensureStableEditorRowId/);
  assert.match(dashboard, /executiveSourceKey/);
});
