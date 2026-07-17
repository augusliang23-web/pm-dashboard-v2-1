import { mkdir, writeFile } from 'node:fs/promises';
import { renderPdfBuffer } from '../src/pdf-renderer.js';
import { renderProjectReportHtml } from '../src/project-report.js';
import { renderOverviewReportHtml } from '../src/overview-report.js';
import {
  completeOverviewReportFixture,
  completeProjectReportFixture,
  structuredExecutiveSummaryFixture,
  week28DenseExecutiveSummaryFixture
} from '../test/report-fixtures.mjs';

const SAMPLE_TARGET_BYTES = 1.5 * 1024 * 1024;
const outputDirectory = new URL('../../tmp/pdf-samples/', import.meta.url);

await mkdir(outputDirectory, { recursive: true });

try {
  const overviewFixture = completeOverviewReportFixture();
  overviewFixture.week.executiveSummary = structuredExecutiveSummaryFixture();
  const executiveSummaryFixture = completeOverviewReportFixture();
  executiveSummaryFixture.sections = ['executive-summary'];
  executiveSummaryFixture.week.executiveSummary = structuredExecutiveSummaryFixture();
  const denseExecutiveSummaryFixture = completeOverviewReportFixture();
  denseExecutiveSummaryFixture.sections = ['executive-summary'];
  denseExecutiveSummaryFixture.week.executiveSummary = week28DenseExecutiveSummaryFixture();
  const executiveMilestonesFixture = completeOverviewReportFixture();
  executiveMilestonesFixture.sections = ['executive-milestones'];
  executiveMilestonesFixture.executiveAudienceView = 'leadership';
  const denseProjectFixture = completeOverviewReportFixture();
  denseProjectFixture.sections = ['project-portfolio'];
  denseProjectFixture.week.projects = [denseProjectFixture.week.projects[0]];
  denseProjectFixture.week.projects[0].highlight = Array.from({ length: 8 }, (_, index) => `Dense highlight ${index + 1}`).join('\n');
  denseProjectFixture.week.projects[0].riskActions = Array.from({ length: 8 }, (_, index) => ({
    risk: `Dense risk ${index + 1} ${'risk detail '.repeat(10)}`,
    action: `Dense action ${index + 1} ${'action detail '.repeat(10)}`,
    primary: index === 0
  }));
  denseProjectFixture.week.projects[0].ganttWorkstreams = Array.from({ length: 24 }, (_, index) => ({
    name: `Dense workstream ${index + 1}`,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    status: index % 4 === 0 ? 'at-risk' : 'in-progress',
    progress: index * 4
  }));
  const denseProjectUpdateFixture = completeProjectReportFixture();
  denseProjectUpdateFixture.sections = ['project-brief', 'project-update'];
  denseProjectUpdateFixture.project.highlight = Array.from({ length: 18 }, (_, index) => `Dense highlight ${index + 1} ${'delivery detail '.repeat(6)}`).join('\n');
  denseProjectUpdateFixture.project.risk = Array.from({ length: 14 }, (_, index) => `Dense risk ${index + 1} ${'blocker detail '.repeat(6)}`).join('\n');
  denseProjectUpdateFixture.project.weeklyActions = Array.from({ length: 16 }, (_, index) => `Dense action ${index + 1} ${'follow-up detail '.repeat(6)}`).join('\n');
  const reports = [
    ['project.pdf', renderProjectReportHtml(completeProjectReportFixture())],
    ['overview.pdf', renderOverviewReportHtml(overviewFixture)],
    ['executive-summary.pdf', renderOverviewReportHtml(executiveSummaryFixture)],
    ['executive-summary-dense.pdf', renderOverviewReportHtml(denseExecutiveSummaryFixture)],
    ['overview-executive-milestones.pdf', renderOverviewReportHtml(executiveMilestonesFixture)],
    ['overview-dense-project.pdf', renderOverviewReportHtml(denseProjectFixture)],
    ['project-update-dense.pdf', renderProjectReportHtml(denseProjectUpdateFixture)]
  ];

  for (const [name, html] of reports) {
    const pdf = await renderPdfBuffer(html);
    if (pdf.byteLength > SAMPLE_TARGET_BYTES) {
      throw new Error(`${name} exceeds the 1.5 MiB sample target`);
    }
    await writeFile(new URL(name, outputDirectory), pdf);
    process.stdout.write(`${name}: ${pdf.byteLength} bytes\n`);
  }
} finally {
  await renderPdfBuffer.close();
}
