import test from 'node:test';
import assert from 'node:assert/strict';
import { renderOverviewReportHtml } from '../src/overview-report.js';
import {
  compactExecutiveSummaryFixture,
  completeOverviewReportFixture,
  legacyExecutiveSummaryFixture,
  verboseExecutiveSummaryFixture
} from './report-fixtures.mjs';

test('emits Executive Summary as one ordered measurable flow', () => {
  const fixture = completeOverviewReportFixture();
  fixture.sections = ['executive-summary'];
  fixture.week.executiveSummary = legacyExecutiveSummaryFixture();

  const html = renderOverviewReportHtml(fixture);

  assert.equal((html.match(/data-measured-flow="executive-summary"/g) || []).length, 1);
  assert.equal((html.match(/data-pdf-flow-item(?:\s|>)/g) || []).length, 13);
  assert.match(html, /data-flow-kind="portfolio-summary"/);
  assert.match(html, /data-flow-kind="priority-project"/);
  assert.match(html, /data-flow-kind="management-decision"/);
  assert.match(html, /data-flow-kind="project-context"/);
  const kinds = [...html.matchAll(/data-flow-kind="([^"]+)"/g)].map(match => match[1]);
  assert.ok(kinds.indexOf('priority-project') < kinds.indexOf('management-decision'));
  assert.ok(kinds.indexOf('management-decision') < kinds.indexOf('project-context'));
});

test('renders compact Executive Summary as one measurable source page', () => {
  const fixture = completeOverviewReportFixture();
  fixture.sections = ['executive-summary'];
  fixture.week.executiveSummary = compactExecutiveSummaryFixture();

  const html = renderOverviewReportHtml(fixture);

  assert.equal((html.match(/<section class="report-page" data-report-section="executive-summary-/g) || []).length, 1);
  assert.match(html, /data-report-section="executive-summary-brief"/);
  assert.match(html, /data-page-section="executive-summary-context"/);
  assert.match(html, /Decision Brief/);
  assert.match(html, /Project Context/);
  assert.match(html, /Management decisions/);
  assert.match(html, /Priority projects/);
});

test('keeps verbose projects and management decisions in the measurable flow', () => {
  const fixture = completeOverviewReportFixture();
  fixture.sections = ['executive-summary'];
  fixture.week.executiveSummary = verboseExecutiveSummaryFixture();

  const html = renderOverviewReportHtml(fixture);

  assert.equal((html.match(/<section class="report-page" data-report-section="executive-summary-/g) || []).length, 1);
  assert.equal((html.match(/data-flow-kind="priority-project"/g) || []).length, 2);
  assert.equal((html.match(/data-flow-kind="management-decision"/g) || []).length, 4);
  assert.equal((html.match(/data-flow-kind="project-context"/g) || []).length, 6);
  assert.equal((html.match(/class="report-page-head"/g) || []).length, 1);
  assert.equal((html.match(/class="report-footer"/g) || []).length, 1);
});

test('puts a legacy unbulleted weekly summary into one measurable flow', () => {
  const fixture = completeOverviewReportFixture();
  fixture.sections = ['executive-summary'];
  fixture.week.executiveSummary = legacyExecutiveSummaryFixture();

  const html = renderOverviewReportHtml(fixture);

  assert.equal((html.match(/<section class="report-page" data-report-section="executive-summary-/g) || []).length, 1);
  assert.equal((html.match(/class="report-page-head"/g) || []).length, 1);
  assert.doesNotMatch(html, /class="empty-state"/);
});

test('renders all nine selected Overview sections in dashboard reading order', () => {
  const html = renderOverviewReportHtml(completeOverviewReportFixture());
  const ids = [
    'health-focus', 'weekly-trend', 'executive-summary', 'attention-matrix',
    'risk-actions', 'quarterly-roadmap', 'project-portfolio',
    'resource-analytics', 'budget-overview'
  ];

  ids.forEach(id => assert.match(html, new RegExp(`data-section-unit="${id}"`)));
  const positions = ids.map(id => html.indexOf(`data-section-unit="${id}"`));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  assert.match(html, /weekly-trend-svg/);
  assert.match(html, /attention-quadrant action/);
  assert.match(html, /quarter-grid/);
  assert.match(html, /resource-function-bar/);
  assert.match(html, /budget-variance/);
});

test('keeps overview signals together while giving Executive Summary dedicated pages', () => {
  const html = renderOverviewReportHtml(completeOverviewReportFixture());

  assert.equal((html.match(/data-report-section="overview-opening"/g) || []).length, 1);
  assert.equal((html.match(/data-report-section="overview-management"/g) || []).length, 1);
  assert.match(html, /data-report-section="overview-opening"[\s\S]*data-section-unit="health-focus"[\s\S]*data-section-unit="weekly-trend"/);
  assert.doesNotMatch(
    html.match(/data-report-section="overview-opening"[\s\S]*?<\/section>/)?.[0] || '',
    /data-section-unit="executive-summary"/
  );
  assert.equal((html.match(/<section class="report-page" data-report-section="executive-summary-/g) || []).length, 1);
  assert.match(html, /data-report-section="overview-management"[\s\S]*data-section-unit="attention-matrix"[\s\S]*data-section-unit="risk-actions"/);
});

test('uses one complete project portfolio card per report page', () => {
  const html = renderOverviewReportHtml(completeOverviewReportFixture());
  const pageCount = (html.match(/data-report-section="project-portfolio"/g) || []).length;

  assert.equal(pageCount, 2);
  assert.match(html, /Project Portfolio · Continued/);
  assert.match(html, /portfolio-project-card keep-together/);
});

test('omits Overview sections with no reportable data', () => {
  const html = renderOverviewReportHtml({
    week: { weekLabel: 'W28 2026', projects: [] },
    sections: ['health-focus', 'project-portfolio', 'risk-actions']
  });
  assert.match(html, /Portfolio Health &amp; Focus|Portfolio Health & Focus/);
  assert.doesNotMatch(html, /Project Portfolio/);
  assert.doesNotMatch(html, /Risk Actions/);
});

test('escapes Overview project content and contains no interactive controls', () => {
  const fixture = completeOverviewReportFixture();
  fixture.week.projects[0].name = '<img src=x onerror=alert(1)>';
  fixture.week.projects[0].risk = '<script>alert(1)</script>';

  const html = renderOverviewReportHtml(fixture);

  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /thead \{ display:table-header-group/);
  assert.doesNotMatch(html, /<script|onclick=|<button|<select|<input/);
});
