import test from 'node:test';
import assert from 'node:assert/strict';
import { renderOverviewReportHtml } from '../src/overview-report.js';

test('omits Overview sections with no reportable data', () => {
  const html = renderOverviewReportHtml({
    week: { weekLabel: 'W28 2026', projects: [] },
    sections: ['health-focus', 'project-portfolio', 'risk-actions']
  });
  assert.match(html, /Portfolio Health &amp; Focus|Portfolio Health & Focus/);
  assert.doesNotMatch(html, /Project Portfolio/);
  assert.doesNotMatch(html, /Risk Actions/);
});
