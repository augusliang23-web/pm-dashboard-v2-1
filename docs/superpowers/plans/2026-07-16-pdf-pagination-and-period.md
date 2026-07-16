# PDF Pagination and Reporting Period Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate orphaned PDF pages by emitting explicit continuation pages, and display week plus date range on every Overview and Project PDF page.

**Architecture:** Add one report-model formatter that joins `weekLabel` and `weekDate`, and pass its output to every existing `reportPage`. Replace the Executive Summary's unbounded fixed two-page grids with deterministic card groups, each wrapped in its own `reportPage` so Chromium never creates an unframed physical overflow page.

**Tech Stack:** Node.js ESM, HTML/CSS, Puppeteer, Node test runner.

## Global Constraints

- Preserve A4 landscape output, in-memory PDF generation, and the existing 8 MiB response limit.
- Use `W28 2026 · Jul 6–Jul 12, 2026` when both source fields are present.
- Do not truncate or rewrite stored weekly-summary content.
- Keep every summary card intact with `break-inside: avoid`.
- Short structured summaries must remain two landscape pages; verbose summaries may create labelled continuation pages.

---

### Task 1: Shared reporting-period formatter

**Files:**
- Modify: `pdf-service/src/report-model.js:1-155,301-319`
- Modify: `pdf-service/test/report-model.test.mjs`
- Modify: `pdf-service/test/report-fixtures.mjs:52-57`

**Interfaces:**
- Produces: `formatReportingPeriod(week = {}) => string` exported from `report-model.js`.
- Consumes: `week.weekLabel` and `week.weekDate` strings.
- Used by: `buildProjectReportModel` and `buildOverviewReportModel` through their existing `period` property.

- [ ] **Step 1: Write the failing formatter tests**

```js
import { buildOverviewReportModel, buildProjectReportModel, formatReportingPeriod } from '../src/report-model.js';

test('formats a reporting week and date range together', () => {
  assert.equal(
    formatReportingPeriod({ weekLabel: 'W28 2026', weekDate: 'Jul 6 - Jul 12' }),
    'W28 2026 · Jul 6–Jul 12, 2026'
  );
  assert.equal(formatReportingPeriod({ weekLabel: 'W28 2026' }), 'W28 2026');
  assert.equal(formatReportingPeriod({ weekDate: 'Jul 6 - Jul 12, 2026' }), 'Jul 6–Jul 12, 2026');
});

test('uses the formatted period in both report models', () => {
  const week = { weekLabel: 'W28 2026', weekDate: 'Jul 6 - Jul 12', projects: [] };
  assert.equal(buildProjectReportModel({ week, project: {}, sections: [] }).period, 'W28 2026 · Jul 6–Jul 12, 2026');
  assert.equal(buildOverviewReportModel({ week, sections: [] }).period, 'W28 2026 · Jul 6–Jul 12, 2026');
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test test/report-model.test.mjs`

Expected: FAIL because `formatReportingPeriod` is not exported and existing models prefer `weekLabel`.

- [ ] **Step 3: Implement the formatter and consume it in both models**

```js
function cleanPeriodPart(value) {
  return String(value || '').trim().replace(/\s*(?:-|–|—)\s*/g, '–');
}

export function formatReportingPeriod(week = {}) {
  const label = cleanPeriodPart(week.weekLabel);
  const date = cleanPeriodPart(week.weekDate);
  if (!label) return date || 'Current reporting period';
  if (!date) return label;
  const year = label.match(/\b(20\d{2})\b/)?.[1];
  const dated = /\b20\d{2}\b/.test(date) ? date : `${date}${year ? `, ${year}` : ''}`;
  return `${label} · ${dated}`;
}
```

Replace both occurrences of `week.weekLabel || week.weekDate || 'Current reporting period'` with `formatReportingPeriod(week)`.

- [ ] **Step 4: Add date data to the Overview fixture and run the focused test**

Set `weekDate: 'Jul 6 - Jul 12'` in `completeOverviewReportFixture().week` and run:

`node --test test/report-model.test.mjs test/report-html.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the completed formatter task**

```bash
git add pdf-service/src/report-model.js pdf-service/test/report-model.test.mjs pdf-service/test/report-fixtures.mjs
git commit -m "feat: show reporting date ranges in PDFs"
```

### Task 2: Explicit Executive Summary continuation pages

**Files:**
- Modify: `pdf-service/src/overview-report.js:54-95,360-379`
- Modify: `pdf-service/src/report-theme.js:188-218`
- Modify: `pdf-service/test/overview-report.test.mjs`

**Interfaces:**
- Consumes: parser output from `parseExecutiveSummaryBrief(summary)`, especially `priorityProjects`, `managementAsks`, and `projects`.
- Produces: one or more `reportPage` strings through `renderExecutiveSummaryPages(model, brief)`.
- Uses: existing `reportPage({ section, title, kicker, period, body, continuation })`.

- [ ] **Step 1: Write failing HTML structure tests**

```js
test('creates formal continuation pages for verbose Executive Summary cards', () => {
  const fixture = completeOverviewReportFixture();
  fixture.sections = ['executive-summary'];
  fixture.week.executiveSummary = verboseExecutiveSummaryFixture();
  const html = renderOverviewReportHtml(fixture);

  assert.match(html, /data-report-section="executive-summary-brief"/);
  assert.match(html, /data-report-section="executive-summary-brief-continuation"/);
  assert.match(html, /data-report-section="executive-summary-context"/);
  assert.match(html, /data-report-section="executive-summary-context-continuation"/);
  assert.equal((html.match(/class="report-page"/g) || []).length, 4);
  assert.doesNotMatch(html, /executive-brief-columns[\s\S]*executive-ask-card[\s\S]*executive-ask-card[\s\S]*executive-ask-card/);
});
```

Add `verboseExecutiveSummaryFixture()` to `report-fixtures.mjs`: retain six structured movement entries and four management asks, with each field repeated enough to force the former fixed-page layout to overflow.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test test/overview-report.test.mjs`

Expected: FAIL because the renderer creates exactly two Executive Summary `reportPage` wrappers.

- [ ] **Step 3: Implement deterministic card grouping and page creation**

Add these helpers above `renderOverviewReportHtml`:

```js
function chunk(items, size) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, index * size + size));
}

function renderDecisionContinuation(asks) {
  return `<section class="executive-brief-copy executive-decision-continuation"><h2 class="executive-brief-section-title">Management decisions</h2><div class="executive-ask-grid">${asks.map(renderAskCard).join('')}</div></section>`;
}

function renderExecutiveSummaryPages(model, brief) {
  const pages = [reportPage({
    section: 'executive-summary-brief', title: 'Decision Brief',
    kicker: 'Executive Summary - Management-ready update', period: model.period,
    body: renderDecisionBrief(model, brief, brief.managementAsks.slice(0, 2))
  })];
  chunk(brief.managementAsks.slice(2), 2).forEach(asks => pages.push(reportPage({
    section: 'executive-summary-brief-continuation', title: 'Decision Brief',
    kicker: 'Executive Summary - Management-ready update', period: model.period,
    continuation: true, body: renderDecisionContinuation(asks)
  })));
  chunk(brief.projects, 2).forEach((projects, index) => pages.push(reportPage({
    section: index ? 'executive-summary-context-continuation' : 'executive-summary-context',
    title: 'Project Context', kicker: 'Executive Summary - Supporting detail', period: model.period,
    continuation: index > 0, body: renderProjectContext({ ...brief, projects })
  })));
  return pages;
}
```

Refactor `renderDecisionBrief` to accept an `asks` argument and use a shared `renderAskCard(ask)` helper. Replace the existing two `pages.push(reportPage(...))` calls in `renderOverviewReportHtml` with `pages.push(...renderExecutiveSummaryPages(model, brief))`.

- [ ] **Step 4: Restrict summary page CSS to explicit wrappers**

```css
.report-page[data-report-section^="executive-summary-"] { padding:8mm 10mm 7mm; }
.report-page[data-report-section^="executive-summary-"] .report-page-head { padding-bottom:2.5mm; }
.report-page[data-report-section^="executive-summary-"] .report-body { padding-top:3mm; }
.report-page[data-report-section^="executive-summary-"] .report-footer { left:10mm; right:10mm; bottom:7mm; }
.executive-decision-continuation .executive-ask-grid { max-width:132mm; margin:0 auto; }
```

Keep `.executive-ask-card` and `.executive-context-card` as `break-inside: avoid`; remove no content and add no fixed body height.

- [ ] **Step 5: Run focused HTML tests and commit**

Run: `node --test test/overview-report.test.mjs`

Expected: PASS, including the concise two-page structure and verbose explicit continuation-page structure.

```bash
git add pdf-service/src/overview-report.js pdf-service/src/report-theme.js pdf-service/test/overview-report.test.mjs pdf-service/test/report-fixtures.mjs
git commit -m "fix: paginate executive summary cards"
```

### Task 3: Render-level regression proof

**Files:**
- Modify: `pdf-service/test/pdf-layout.test.mjs`
- Modify: `pdf-service/test/project-report.test.mjs`

**Interfaces:**
- Consumes: HTML returned by `renderOverviewReportHtml` and `renderProjectReportHtml`.
- Produces: PDF page-count and reporting-period regression coverage.

- [ ] **Step 1: Write failing render and HTML assertions**

```js
test('renders verbose Executive Summary continuation pages without unframed overflow', { timeout: 60000 }, async () => {
  const fixture = completeOverviewReportFixture();
  fixture.sections = ['executive-summary'];
  fixture.week.executiveSummary = verboseExecutiveSummaryFixture();
  const html = renderOverviewReportHtml(fixture);
  assert.equal((html.match(/class="report-page"/g) || []).length, 4);
  assert.equal((html.match(/class="report-footer"/g) || []).length, 4);
  const pdf = await renderPdfBuffer(html);
  const pages = Buffer.from(pdf).toString('latin1').match(/\/Type\s*\/Page\b/g) || [];
  assert.equal(pages.length, 4);
});

test('includes the reporting date range in Project PDF markup', () => {
  const html = renderProjectReportHtml(completeProjectReportFixture());
  assert.match(html, /W28 2026 · Jul 6–Jul 12, 2026/);
});
```

- [ ] **Step 2: Run the focused layout tests to verify they fail before Tasks 1 and 2 are implemented**

Run: `node --test test/pdf-layout.test.mjs test/project-report.test.mjs`

Expected: FAIL because the old renderer has two Executive Summary wrappers and period output lacks `weekDate`.

- [ ] **Step 3: Run all PDF tests after Tasks 1 and 2**

Run: `npm.cmd test`

Expected: all tests PASS.

- [ ] **Step 4: Render and inspect PDFs**

Run: `node scripts/render-samples.mjs`

Inspect: `tmp/pdf-samples/executive-summary.pdf` and the verbose fixture output added by the test helper. Confirm every physical page starts with a report header and ends with a footer containing the full period.

- [ ] **Step 5: Run the frontend regression suite, commit, and deploy only after verification**

Run: `node --test *.test.mjs *.test.cjs`

Expected: PASS.

```bash
git add pdf-service/test/pdf-layout.test.mjs pdf-service/test/project-report.test.mjs
git commit -m "test: cover PDF period and continuation pages"
gcloud.cmd run deploy pm-dashboard-pdf --source pdf-service --project project-manager-dashboar-a067f --region asia-southeast1 --allow-unauthenticated --ingress all --min-instances 0 --max-instances 1 --concurrency 1 --cpu 1 --memory 1Gi --timeout 120 --service-account pm-dashboard-pdf@project-manager-dashboar-a067f.iam.gserviceaccount.com --set-env-vars "ALLOWED_ORIGIN=https://augusliang23-web.github.io" --async --quiet
git push v21 HEAD:main
```
