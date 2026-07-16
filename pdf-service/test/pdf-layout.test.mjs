import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPdfBuffer } from '../src/pdf-renderer.js';
import { renderOverviewReportHtml } from '../src/overview-report.js';
import { completeOverviewReportFixture } from './report-fixtures.mjs';

test.after(async () => {
  await renderPdfBuffer.close();
});

test('a nine-project budget overview fits one landscape page without a trailing page', { timeout: 60000 }, async () => {
  const fixture = completeOverviewReportFixture();
  const baseProject = fixture.week.projects[0];
  fixture.week.projects = Array.from({ length: 9 }, (_, index) => ({
    ...baseProject,
    name: `Project ${index + 1}`,
    code: `P-${index + 1}`
  }));
  fixture.sections = ['budget-overview'];

  const pdf = await renderPdfBuffer(renderOverviewReportHtml(fixture));
  const pageObjects = Buffer.from(pdf).toString('latin1').match(/\/Type\s*\/Page\b/g) || [];

  assert.equal(pageObjects.length, 1);
});
