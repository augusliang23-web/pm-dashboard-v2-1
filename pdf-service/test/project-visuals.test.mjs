import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGanttRange, renderGanttAxis, renderGanttRow } from '../src/project-visuals.js';

test('builds a shared Gantt range for scheduled and unscheduled rows', () => {
  const range = buildGanttRange([
    { name: 'Valid', startDate: '2026-07-01', endDate: '2026-07-10', status: 'completed', progress: 100 },
    { name: 'Invalid', startDate: 'not-a-date', endDate: '2026-07-12', status: 'planned', progress: 0 },
    { name: 'Reversed', startDate: '2026-07-20', endDate: '2026-07-18', status: 'at-risk', progress: 20 }
  ]);

  assert.equal(range.min.toISOString().slice(0, 10), '2026-07-01');
  assert.equal(range.max.toISOString().slice(0, 10), '2026-07-10');
  assert.equal(range.span, 10);
  assert.match(renderGanttAxis(range), /2026-07-01[\s\S]*2026-07-10/);
  assert.match(renderGanttRow(range.rows[1], range), /Dates not scheduled/);
  assert.match(renderGanttRow(range.rows[2], range), /Unscheduled/);
});

test('escapes long Gantt names and marks complete rows as split units', () => {
  const range = buildGanttRange([{
    name: '<Long & unsafe workstream name>',
    startDate: '2026-07-01',
    endDate: '2026-08-31',
    status: 'in-progress',
    progress: 45
  }]);

  const html = renderGanttRow(range.rows[0], range);
  assert.match(html, /&lt;Long &amp; unsafe workstream name&gt;/);
  assert.match(html, /data-pdf-split-unit/);
  assert.match(html, /width:45%/);
});
