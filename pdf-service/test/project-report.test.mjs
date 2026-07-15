import test from 'node:test';
import assert from 'node:assert/strict';
import { renderProjectReportHtml } from '../src/project-report.js';

test('uses vertical milestones for long milestone collections and omits empty sections', () => {
  const html = renderProjectReportHtml({
    week: { weekLabel: 'W28 2026' },
    project: {
      name: 'PMS', code: 'PMS-001', progress: 60,
      milestones: [
        { name: 'Discovery', date: '2026-04-30' },
        { name: 'Design', date: '2026-07-15' },
        { name: 'Demo', date: '2026-07-15' },
        { name: 'Integration', date: '2026-08-17' }
      ]
    },
    sections: ['project-brief', 'milestone']
  });
  assert.match(html, /milestone-list/);
  assert.doesNotMatch(html, /Team allocation/);
  assert.match(html, /@page \{ size: A4 landscape/);
});

test('uses a compact timeline only for three or fewer short milestones', () => {
  const html = renderProjectReportHtml({
    week: { weekLabel: 'W28 2026' },
    project: { name: 'PMS', milestones: [{ name: 'Plan' }, { name: 'Build' }, { name: 'Release' }] },
    sections: ['milestone']
  });
  assert.match(html, /milestone-timeline/);
});
