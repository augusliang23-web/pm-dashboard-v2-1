import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import * as portfolioCore from '../team-2/js/portfolio-core.mjs';

const dashboard = await readFile(
  new URL('../team-2/index.html', import.meta.url),
  'utf8'
);

test('Gantt progress segments clamp values and split completed from remaining work', () => {
  assert.equal(typeof portfolioCore.getGanttProgressSegments, 'function');
  assert.deepEqual(portfolioCore.getGanttProgressSegments(0), {
    progress: 0,
    completedPercent: 0,
    remainingPercent: 100
  });
  assert.deepEqual(portfolioCore.getGanttProgressSegments(45), {
    progress: 45,
    completedPercent: 45,
    remainingPercent: 55
  });
  assert.deepEqual(portfolioCore.getGanttProgressSegments(100), {
    progress: 100,
    completedPercent: 100,
    remainingPercent: 0
  });
  assert.equal(portfolioCore.getGanttProgressSegments(-5).completedPercent, 0);
  assert.equal(portfolioCore.getGanttProgressSegments(125).completedPercent, 100);
  assert.equal(portfolioCore.getGanttProgressSegments('invalid').completedPercent, 0);
});

test('shared Gantt renderer uses a gray base with a green completed overlay', () => {
  assert.match(dashboard, /getGanttProgressSegments/);
  assert.match(dashboard, /class="gantt-bar-completed"/);
  assert.match(dashboard, /\.gantt-bar-completed\s*\{[^}]*background:var\(--green\)/s);
  assert.doesNotMatch(dashboard, /\.gantt-bar\.at-risk\s*\{/);
  assert.doesNotMatch(dashboard, /\.gantt-bar\.delayed\s*\{/);
  assert.doesNotMatch(dashboard, /\.gantt-bar\.completed\s*\{/);
});
