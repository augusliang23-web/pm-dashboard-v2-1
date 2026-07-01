import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../team-2/index.html', import.meta.url), 'utf8');

test('project detail places Gantt and quarterly milestones below the upper grid', () => {
  const gridStart = html.indexOf('<div class="detail-grid">');
  const gridEnd = html.indexOf('<section class="detail-full-width detail-schedule-section">', gridStart);
  const schedule = html.indexOf('id="pd_schedule"', gridStart);
  const quarters = html.indexOf('id="pd_quarterly_milestones"', gridStart);

  assert.ok(gridStart >= 0 && gridEnd > gridStart);
  assert.ok(schedule > gridEnd);
  assert.ok(quarters > schedule);
  assert.match(html, /\.detail-full-width\s*\{[^}]*min-width:\s*0/);
});

test('project detail quarterly milestones render Q1 through Q4 columns', () => {
  assert.match(html, /function formatDetailQuarterlyMilestones\(project\)[\s\S]*getQuarterLabelsForYear\(year\)/);
  assert.match(html, /class="detail-quarter-column"/);
  assert.match(html, /class="detail-quarter-heading"/);
  assert.match(html, /No milestone in this quarter\./);
});
