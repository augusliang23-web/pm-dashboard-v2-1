import test from 'node:test';
import assert from 'node:assert/strict';
import { reportDocument } from '../src/report-html.js';
import {
  dataTable,
  emptyState,
  metricCard,
  progressBar,
  reportPage,
  statusBadge
} from '../src/report-components.js';

test('report shell uses dashboard print tokens without remote assets', () => {
  const html = reportDocument({
    title: 'Overview',
    period: 'W28 2026',
    reportKind: 'overview',
    body: '<main>Body</main>'
  });

  assert.match(html, /@page \{ size:\s*A4 landscape/);
  assert.match(html, /--ink:#26384a/);
  assert.match(html, /--green:#57967f/);
  assert.match(html, /class="report-document overview"/);
  assert.match(html, /\.report-page\s*\{[^}]*position:relative/);
  assert.match(html, /\.report-footer\s*\{[^}]*position:absolute[^}]*bottom:9mm/);
  assert.doesNotMatch(html, /https?:\/\/|@font-face/);
});

test('shared components escape labels and clamp visual percentages', () => {
  assert.match(statusBadge('red', '<Critical>'), /&lt;Critical&gt;/);
  assert.match(progressBar(135, 'red'), /width:100%/);
  assert.match(metricCard('<Label>', 12, 'detail', 'yellow'), /&lt;Label&gt;/);
  assert.match(emptyState('<No data>'), /&lt;No data&gt;/);
  assert.match(
    dataTable({ headings: ['<Name>'], rows: [['<b>value</b>']], className: 'sample-table' }),
    /&lt;Name&gt;[\s\S]*<b>value<\/b>/
  );
  assert.match(
    reportPage({ section: 'brief', title: '<PMS>', period: 'W28', body: '<b>safe markup</b>' }),
    /&lt;PMS&gt;/
  );
});

test('report pages render an escaped optional context beneath the title', () => {
  const html = reportPage({
    section: 'project-portfolio',
    title: 'Project Portfolio',
    context: '<Dense Project>',
    period: 'W28',
    body: '<p>Body</p>'
  });

  assert.match(html, /class="report-page-context"[^>]*>&lt;Dense Project&gt;<\/div>/);
});
