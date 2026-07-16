import { mkdir, writeFile } from 'node:fs/promises';
import { renderPdfBuffer } from '../src/pdf-renderer.js';
import { renderProjectReportHtml } from '../src/project-report.js';
import { renderOverviewReportHtml } from '../src/overview-report.js';
import {
  completeOverviewReportFixture,
  completeProjectReportFixture,
  structuredExecutiveSummaryFixture
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
  const reports = [
    ['project.pdf', renderProjectReportHtml(completeProjectReportFixture())],
    ['overview.pdf', renderOverviewReportHtml(overviewFixture)],
    ['executive-summary.pdf', renderOverviewReportHtml(executiveSummaryFixture)]
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
