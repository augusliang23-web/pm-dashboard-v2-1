import test from 'node:test';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import { renderPdfBuffer } from '../src/pdf-renderer.js';
import { paginateMeasuredFlows } from '../src/measured-paginator.js';
import { renderOverviewReportHtml } from '../src/overview-report.js';
import { renderProjectReportHtml } from '../src/project-report.js';
import {
  compactExecutiveSummaryFixture,
  completeOverviewReportFixture,
  completeProjectReportFixture,
  stressExecutiveSummaryFixture,
  verboseExecutiveSummaryFixture
} from './report-fixtures.mjs';

function physicalPageCount(pdf) {
  return (Buffer.from(pdf).toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
}

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

test('compact Executive Summary renders exactly two landscape pages', { timeout: 60000 }, async () => {
  const fixture = completeOverviewReportFixture();
  fixture.sections = ['executive-summary'];
  fixture.week.executiveSummary = compactExecutiveSummaryFixture();

  const pdf = await renderPdfBuffer(renderOverviewReportHtml(fixture));
  const pageObjects = Buffer.from(pdf).toString('latin1').match(/\/Type\s*\/Page\b/g) || [];

  assert.equal(pageObjects.length, 2);
});

test('verbose Executive Summary creates measured continuation pages without pre-splitting HTML', { timeout: 60000 }, async () => {
  const fixture = completeOverviewReportFixture();
  fixture.sections = ['executive-summary'];
  fixture.week.executiveSummary = verboseExecutiveSummaryFixture();

  const html = renderOverviewReportHtml(fixture);
  assert.equal((html.match(/class="report-page"/g) || []).length, 1);
  assert.equal((html.match(/class="report-page-head"/g) || []).length, 1);
  assert.equal((html.match(/class="report-footer"/g) || []).length, 1);
  const pdf = await renderPdfBuffer(html);
  const pageObjects = Buffer.from(pdf).toString('latin1').match(/\/Type\s*\/Page\b/g) || [];

  assert.ok(pageObjects.length > 1);
  assert.ok(pageObjects.length < 5);
});

test('aligns every verbose Executive Summary wrapper to its own printable page', { timeout: 60000 }, async () => {
  const fixture = completeOverviewReportFixture();
  fixture.sections = ['executive-summary'];
  fixture.week.executiveSummary = verboseExecutiveSummaryFixture();
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  try {
    await page.setContent(renderOverviewReportHtml(fixture), { waitUntil: 'networkidle0' });
    await page.evaluate(paginateMeasuredFlows);
    const frames = await page.evaluate(() => [...document.querySelectorAll('.report-page')].map(node => {
      const pageRect = node.getBoundingClientRect();
      const headerRect = node.querySelector('.report-page-head').getBoundingClientRect();
      const footerRect = node.querySelector('.report-footer').getBoundingClientRect();
      return {
        top: pageRect.top,
        height: pageRect.height,
        headerTop: headerRect.top - pageRect.top,
        footerBottom: footerRect.bottom - pageRect.top
      };
    }));

    assert.ok(frames.length > 1);
    assert.ok(frames.length < 5);
    frames.forEach((frame, index) => {
      assert.ok(Math.abs(frame.top - index * frame.height) < 1, `page ${index + 1} must begin at a page boundary`);
      assert.ok(Math.abs(frame.height - 793.7) < 1, `page ${index + 1} must be A4 landscape height`);
      assert.ok(frame.headerTop > 20, `page ${index + 1} header must not be clipped`);
      assert.ok(frame.footerBottom < frame.height - 20, `page ${index + 1} footer must remain inside its page`);
    });
  } finally {
    await page.close();
    await browser.close();
  }
});

test('splits high-text Executive Summary cards before any wrapper exceeds A4 height', { timeout: 60000 }, async () => {
  const fixture = completeOverviewReportFixture();
  fixture.sections = ['executive-summary'];
  fixture.week.executiveSummary = stressExecutiveSummaryFixture();
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  try {
    await page.setContent(renderOverviewReportHtml(fixture), { waitUntil: 'networkidle0' });
    await page.evaluate(paginateMeasuredFlows);
    const heights = await page.evaluate(() => [...document.querySelectorAll('.report-page')]
      .map(node => node.getBoundingClientRect().height));

    assert.ok(heights.length > 5);
    heights.forEach((height, index) => {
      assert.ok(Math.abs(height - 793.7) < 1, `stress page ${index + 1} must remain A4 height`);
    });
    const pdf = await renderPdfBuffer(renderOverviewReportHtml(fixture));
    const pageObjects = Buffer.from(pdf).toString('latin1').match(/\/Type\s*\/Page\b/g) || [];
    assert.equal(pageObjects.length, heights.length);
  } finally {
    await page.close();
    await browser.close();
  }
});

test('dense project portfolio keeps project context and footer clearance on continuations', { timeout: 60000 }, async () => {
  const fixture = completeOverviewReportFixture();
  const project = fixture.week.projects[0];
  project.name = 'Dense Project';
  project.code = 'DENSE-1';
  project.highlight = Array.from({ length: 6 }, (_, index) => `Dense highlight ${index + 1}`).join('\n');
  project.riskActions = Array.from({ length: 6 }, (_, index) => ({
    risk: `Dense risk ${index + 1} ${'risk detail '.repeat(8)}`,
    action: `Dense action ${index + 1} ${'action detail '.repeat(8)}`,
    primary: index === 0
  }));
  project.ganttWorkstreams = Array.from({ length: 12 }, (_, index) => ({
    name: `Dense workstream ${index + 1}`,
    startDate: `2026-07-${String(index + 1).padStart(2, '0')}`,
    endDate: `2026-07-${String(index + 3).padStart(2, '0')}`,
    status: 'in-progress',
    progress: index * 5
  }));
  fixture.week.projects = [project];
  fixture.sections = ['project-portfolio'];
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  try {
    await page.setContent(renderOverviewReportHtml(fixture), { waitUntil: 'networkidle0' });
    await page.evaluate(paginateMeasuredFlows);
    const pages = await page.evaluate(() => [...document.querySelectorAll('[data-measured-page="project-portfolio-DENSE-1"]')].map(node => {
      const body = node.querySelector('[data-pdf-flow-items]').getBoundingClientRect();
      const footer = node.querySelector('.report-footer').getBoundingClientRect();
      return {
        context: node.querySelector('.report-page-context')?.textContent.trim(),
        title: node.querySelector('.report-title')?.textContent.trim(),
        footerGap: footer.top - body.bottom
      };
    }));

    assert.ok(pages.length > 1);
    assert.ok(pages.every(item => item.context === 'Dense Project'));
    assert.ok(pages.slice(1).every(item => /Continued$/.test(item.title)));
    assert.ok(pages.every(item => item.footerGap >= 8 * 96 / 25.4 - 1));
  } finally {
    await page.close();
    await browser.close();
  }
});

test('full Overview and Project PDFs preserve explicit page parity and period metadata', { timeout: 60000 }, async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const cases = [
    ['Overview', renderOverviewReportHtml(completeOverviewReportFixture())],
    ['Project', renderProjectReportHtml(completeProjectReportFixture())]
  ];

  try {
    for (const [label, html] of cases) {
      const page = await browser.newPage();
      try {
        await page.setContent(html, { waitUntil: 'networkidle0' });
        await page.evaluate(paginateMeasuredFlows);
        const layout = await page.evaluate(() => ({
          explicitPages: document.querySelectorAll('.report-page').length,
          emptyMeasuredPages: [...document.querySelectorAll('[data-measured-page]')]
            .filter(node => !node.querySelector('[data-pdf-flow-item]')).length,
          periods: [...document.querySelectorAll('.report-page')].map(node => ({
            header: node.querySelector('.report-meta')?.textContent || '',
            footer: node.querySelector('.report-footer span:last-child')?.textContent || ''
          }))
        }));
        const pdf = await renderPdfBuffer(html);

        assert.equal(physicalPageCount(pdf), layout.explicitPages, `${label} physical pages must match HTML pages`);
        assert.equal(layout.emptyMeasuredPages, 0, `${label} must not contain an empty measured page`);
        layout.periods.forEach((period, index) => {
          assert.match(period.header, /W28 2026/,
            `${label} page ${index + 1} header must show the reporting week`);
          assert.match(period.header, /Jul 6/, `${label} page ${index + 1} header must show the date range`);
          assert.equal(period.footer, period.header, `${label} page ${index + 1} footer must repeat the period`);
        });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
});
