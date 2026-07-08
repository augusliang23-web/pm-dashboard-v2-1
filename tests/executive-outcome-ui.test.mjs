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
  assert.doesNotMatch(dashboard, /result\.mode === 'auto' \? 'Auto' : 'Manual'/);
  assert.match(dashboard, /Last reporting week/);
});

test('evidence catalog links stable project and quarterly milestone identities', () => {
  assert.match(dashboard, /function buildExecutiveEvidenceCatalog\(/);
  assert.match(dashboard, /type: 'milestone'/);
  assert.match(dashboard, /type: 'quarterly'/);
  assert.match(dashboard, /ensureStableEditorRowId/);
  assert.match(dashboard, /executiveSourceKey/);
});

test('executive editor uses category summaries and quarterly disclosure', () => {
  assert.match(dashboard, /class="exec-category-summary-grid"/);
  assert.match(dashboard, /class="exec-category-editor"/);
  assert.match(dashboard, /class="exec-quarter-tabs"/);
  assert.match(dashboard, /class="exec-progress-segments"/);
  assert.match(dashboard, /class="exec-evidence-details"/);
  assert.match(dashboard, /function setExecutiveEditorQuarter\(/);
  assert.match(dashboard, /function collectExecutiveCategoryOverrides\(/);
});

test('executive progress bars keep a green fill and show Done at 100 percent', () => {
  assert.match(dashboard, /executiveOutcomeStatusLabel\(result\.progress, result\.health\)/);
  assert.match(
    dashboard,
    /class="exec-outcome-progress-fill" style="--pct:\$\{result\.progress \?\? 0\}%"/,
  );
  assert.match(dashboard, /\.exec-outcome-progress-fill \{[^}]*width:var\(--pct, 0%\)/s);
  assert.doesNotMatch(
    dashboard,
    /class="exec-outcome-progress-fill \$\{result\.health\}"/,
  );
});

test('executive timeline removes noisy manual labels and shows quarterly progress', () => {
  assert.doesNotMatch(dashboard, /Leadership-level DCDC milestone timeline, separated from PM project milestone input\./);
  assert.doesNotMatch(dashboard, /Manual<\/span>/);
  assert.match(dashboard, /function calculateExecutiveQuarterSummary\(/);
  assert.match(dashboard, /class="dcdc-quarter-progress"/);
});
