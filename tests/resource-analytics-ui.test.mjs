import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dashboard = readFileSync(new URL('../team-2/index.html', import.meta.url), 'utf8');

test('Overview resource analytics shows executive KPIs and aggregated charts', () => {
  for (const label of [
    'Total Allocated FTE',
    'Allocation Coverage',
    'Overallocated People',
    'Available Capacity',
    'FTE by project level',
    'Function mix by project level',
  ]) {
    assert.ok(dashboard.includes(label));
  }
  assert.ok(dashboard.includes('buildResourceAnalytics(resourceProjects)'));
  assert.ok(dashboard.includes('class="resource-level-donut"'));
  assert.ok(dashboard.includes('class="resource-function-track"'));
});

test('Overview resource analytics no longer renders a member-name list', () => {
  const start = dashboard.indexOf('function renderResourceBudgetOverview(');
  const end = dashboard.indexOf('\n}', start) + 2;
  const source = dashboard.slice(start, end);
  assert.doesNotMatch(source, /resources\.slice/);
  assert.doesNotMatch(source, /r\.name/);
});

test('Resource analytics and budget render after the project portfolio', () => {
  const execStart = dashboard.indexOf('function renderExec(');
  const execEnd = dashboard.indexOf('async function saveCurrentWeekQuietly()', execStart);
  const source = dashboard.slice(execStart, execEnd);
  assert.ok(source.lastIndexOf('renderResourceBudgetOverview(projs)') > source.indexOf('project-portfolio-panel'));
});
