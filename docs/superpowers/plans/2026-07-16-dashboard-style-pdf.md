# Dashboard-Style PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate secure Overview and project PDFs that reproduce the dashboard's visual hierarchy, include every selectable section, and stay within the approved output-size limits.

**Architecture:** Keep the existing authenticated Cloud Run endpoints and Firestore data boundary. Add a shared server-side report theme and component library, normalize Firestore documents into stable presentation models, compose Overview and project page sets, and render them with a warm-browser Chromium renderer whose request pages remain isolated.

**Tech Stack:** Node.js 20+, ECMAScript modules, `node:test`, Firebase Admin SDK, Puppeteer 24, HTML/CSS, inline SVG, Cloud Run.

## Global Constraints

- The browser sends identifiers and selected section IDs only; it never sends report content or rendered HTML.
- PDF, HTML, report data, and personal data stay in memory and are not written to production storage, caches, or logs.
- Output is A4 landscape with dashboard color semantics, compact page headers, restrained footers, and no interactive controls.
- Use system fonts, HTML, CSS, and compact inline SVG only; remote assets, embedded web fonts, high-resolution backgrounds, and full-page raster captures are prohibited.
- Representative all-section Overview and project PDFs each target 1.5 MiB or less.
- Any generated PDF above 8 MiB is discarded and returned as a safe error.
- Cloud Run remains request-based with no minimum instance (`--min-instances 0`), `--max-instances 1`, `--concurrency 1`, `--cpu 1`, `--memory 1Gi`, and `--timeout 120`.
- Every task follows red-green-refactor TDD and commits only its own scoped files.

---

## File map

- Create `pdf-service/src/report-theme.js`: print tokens and complete dashboard-style CSS string.
- Create `pdf-service/src/report-components.js`: escaped, reusable report markup primitives.
- Modify `pdf-service/src/report-html.js`: document shell and page composition only.
- Create `pdf-service/src/report-model.js`: project, budget, resource, trend, and Overview presentation normalization.
- Modify `pdf-service/src/report-data.js`: populate only authorized report data and optional trend history.
- Modify `pdf-service/src/server.js`: provide the bounded trend-history Firestore adapter.
- Modify `pdf-service/src/project-report.js`: compose all seven project sections.
- Modify `pdf-service/src/overview-report.js`: compose all nine Overview sections.
- Modify `pdf-service/src/pdf-renderer.js`: reuse a warm Chromium browser while isolating and closing request pages.
- Modify `pdf-service/src/pdf-response.js`: enforce the 8 MiB output limit before response headers.
- Modify `pdf-service/src/app.js`: preserve safe actionable size errors.
- Create `pdf-service/test/report-html.test.mjs`: theme and markup primitive tests.
- Create `pdf-service/test/report-model.test.mjs`: normalization and metrics tests.
- Expand `pdf-service/test/project-report.test.mjs`, `overview-report.test.mjs`, `report-data.test.mjs`, `pdf-response.test.mjs`, and `app.test.mjs`.
- Create `pdf-service/test/pdf-renderer.test.mjs`: warm-browser lifecycle tests using injected fakes.
- Create `pdf-service/test/report-fixtures.mjs`: deterministic complete and long-content fixtures.
- Create `pdf-service/scripts/render-samples.mjs`: development-only visual and size fixture renderer.
- Modify `pdf-service/package.json` and `pdf-service/README.md`: sample-render command and operational limits.
- Modify `tests/professional-pdf-client.test.mjs` only if the current frontend recovery assertions do not cover the final error path.

---

### Task 1: Shared dashboard print theme and components

**Files:**
- Create: `pdf-service/src/report-theme.js`
- Create: `pdf-service/src/report-components.js`
- Modify: `pdf-service/src/report-html.js`
- Create: `pdf-service/test/report-html.test.mjs`

**Interfaces:**
- Produces: `REPORT_CSS: string`.
- Produces: `reportPage({ section, title, kicker, period, body, continuation }): string`.
- Produces: `statusBadge(status, label)`, `progressBar(percent, tone)`, `metricCard(label, value, detail, tone)`, `emptyState(message)`, and `dataTable({ headings, rows, className }): string`.
- Preserves: `escapeHtml(value): string` and `reportDocument({ title, period, body, reportKind }): string`.

- [ ] **Step 1: Write failing shared-theme tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { reportDocument } from '../src/report-html.js';
import { progressBar, reportPage, statusBadge } from '../src/report-components.js';

test('report shell uses dashboard print tokens without remote assets', () => {
  const html = reportDocument({ title: 'Overview', period: 'W28 2026', reportKind: 'overview', body: '<main>Body</main>' });
  assert.match(html, /@page \{ size: A4 landscape/);
  assert.match(html, /--ink:#26384a/);
  assert.match(html, /--green:#57967f/);
  assert.match(html, /class="report-document overview"/);
  assert.doesNotMatch(html, /https?:\/\/|@font-face/);
});

test('shared components escape labels and clamp visual percentages', () => {
  assert.match(statusBadge('red', '<Critical>'), /&lt;Critical&gt;/);
  assert.match(progressBar(135, 'red'), /width:100%/);
  assert.match(reportPage({ section: 'brief', title: '<PMS>', period: 'W28', body: '<b>safe markup</b>' }), /&lt;PMS&gt;/);
});
```

- [ ] **Step 2: Run the focused test and verify the missing modules fail**

Run: `cd pdf-service && node --test test/report-html.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `report-components.js` or `report-theme.js`.

- [ ] **Step 3: Implement the theme, shell, and component interfaces**

Use these exact print tokens in `REPORT_CSS` and define concrete rules for every named class:

```js
export const REPORT_CSS = `
  @page { size:A4 landscape; margin:0; }
  :root { --ink:#26384a; --muted:#718196; --line:#d7dee7; --surface:#f5f8fb;
    --green:#57967f; --green-soft:#e8f3ee; --yellow:#c99732; --yellow-soft:#fff5dc;
    --red:#b85c5c; --red-soft:#fdecec; --blue:#5b7fa3; --white:#fff; }
  * { box-sizing:border-box; }
  body { margin:0; color:var(--ink); background:var(--white); font:9.5pt Arial,"Noto Sans CJK TC",sans-serif; }
  .report-page { width:297mm; min-height:210mm; padding:11mm 12mm 9mm; break-after:page; display:flex; flex-direction:column; }
  .report-page:last-child { break-after:auto; }
  .report-page-head { display:flex; justify-content:space-between; gap:8mm; padding-bottom:4mm; border-bottom:1px solid var(--line); }
  .report-body { flex:1; min-height:0; padding-top:5mm; }
  .report-footer { display:flex; justify-content:space-between; padding-top:3mm; color:var(--muted); font-size:7.5pt; }
  .card { border:1px solid var(--line); border-radius:4mm; background:var(--white); padding:4mm; break-inside:avoid; }
  .card-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:4mm; }
  .metric-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:3mm; }
  .status-badge { display:inline-flex; border-radius:99px; padding:1.2mm 2.4mm; font-weight:700; }
  .status-badge.green { color:var(--green); background:var(--green-soft); }
  .status-badge.yellow { color:#8a641c; background:var(--yellow-soft); }
  .status-badge.red { color:var(--red); background:var(--red-soft); }
  .progress-track { height:3mm; border-radius:99px; overflow:hidden; background:#e6ecf2; }
  .progress-fill { height:100%; background:var(--green); }
  .progress-fill.yellow { background:var(--yellow); } .progress-fill.red { background:var(--red); }
  table { width:100%; border-collapse:collapse; } thead { display:table-header-group; }
  tr,.keep-together { break-inside:avoid; } th,td { padding:2.4mm; border-bottom:1px solid var(--line); vertical-align:top; }
  th { color:var(--muted); font-size:7.5pt; text-transform:uppercase; letter-spacing:.04em; }
  .empty-state { border:1px dashed var(--line); border-radius:3mm; padding:6mm; color:var(--muted); text-align:center; }
`;
```

Implement components as pure string functions. Every text argument passes through `escapeHtml`; only already-rendered `body` and table cell markup are inserted as markup. `reportDocument` inserts `REPORT_CSS`, wraps the pages in `<div class="report-document ${reportKind}">`, and does not emit `<img>`, `<link>`, or remote URLs.

- [ ] **Step 4: Run the shared tests**

Run: `cd pdf-service && node --test test/report-html.test.mjs`

Expected: PASS with 2 tests and no warnings.

- [ ] **Step 5: Commit the shared theme**

```powershell
git add pdf-service/src/report-theme.js pdf-service/src/report-components.js pdf-service/src/report-html.js pdf-service/test/report-html.test.mjs
git commit -m "feat: add dashboard PDF design system"
```

---

### Task 2: Stable report presentation models and bounded trend data

**Files:**
- Create: `pdf-service/src/report-model.js`
- Create: `pdf-service/test/report-model.test.mjs`
- Modify: `pdf-service/src/report-data.js`
- Modify: `pdf-service/src/server.js`
- Modify: `pdf-service/test/report-data.test.mjs`

**Interfaces:**
- Produces: `normalizeProjectForReport(source): ProjectReportModel`.
- Produces: `buildProjectReportModel({ week, project, sections }): ProjectReportModel`.
- Produces: `buildOverviewReportModel({ week, trendWeeks, sections, overviewScope }): OverviewReportModel`.
- Produces: `budgetTotals(project, currency): { total, planned, actual, variance, planGap, usedPct }`.
- Produces: `disciplineRows(project): Array<{ label, estimated, actual, remaining }>`.
- Extends authorized report output with `trendWeeks`, containing at most six authorized week documents and only when `weekly-trend` is selected.

- [ ] **Step 1: Write failing model and data-loading tests**

```js
test('normalizes project values used by every selected project section', () => {
  const model = buildProjectReportModel({
    week: { weekLabel: 'W28 2026' },
    sections: ['gantt', 'resources', 'budget'],
    project: {
      code: 'PMS-001', status: 'RED', progress: 135,
      ganttWorkstreams: [{ name: 'Build', startDate: '2026-07-01', endDate: '2026-07-31', progress: 45 }],
      teamMembers: [{ name: 'A', roleName: 'Firmware', effortPct: 60 }],
      resources: { role_firmware: { role: 'Firmware', estimated: 100, actual: 40 } },
      budget: { currency: 'USD', totalEstimated: 1000, monthlyPlans: [{ amount: 600 }], actuals: [{ amount: 450 }] }
    }
  });
  assert.equal(model.status, 'red');
  assert.equal(model.progress, 100);
  assert.equal(model.workstreams[0].name, 'Build');
  assert.deepEqual(model.disciplines[0], { label: 'Firmware', estimated: 100, actual: 40, remaining: 60 });
  assert.equal(model.budget.usedPct, 45);
});

test('loads no more than six trend weeks only for selected Overview trends', async () => {
  let calls = 0;
  const report = await loadAuthorizedReport({
    request: { mode: 'overview', weekId: 'W28', sections: ['weekly-trend'] },
    idToken: 'pm@example.com',
    adapters: { ...adapters, getTrendWeeks: async () => { calls += 1; return Array.from({ length: 9 }, (_, i) => ({ weekLabel: `W${i + 20}` })); } }
  });
  assert.equal(calls, 1);
  assert.equal(report.trendWeeks.length, 6);
});
```

Also add a second loader assertion that `getTrendWeeks` is not called when `weekly-trend` is not selected.

- [ ] **Step 2: Run focused tests and verify missing exports fail**

Run: `cd pdf-service && node --test test/report-model.test.mjs test/report-data.test.mjs`

Expected: FAIL because `report-model.js` and `trendWeeks` do not exist.

- [ ] **Step 3: Implement normalization and calculations**

Use explicit clamping and stable array defaults:

```js
const clampPercent = value => Math.min(100, Math.max(0, Number(value) || 0));
const lines = value => (Array.isArray(value) ? value : String(value || '').split('\n')).map(item => String(item).trim()).filter(Boolean);

export function normalizeProjectForReport(source = {}) {
  const status = ['green', 'yellow', 'red'].includes(String(source.status).toLowerCase())
    ? String(source.status).toLowerCase() : 'green';
  return {
    ...source,
    code: String(source.code || ''), name: String(source.name || source.code || 'Untitled project'),
    status, progress: clampPercent(source.progress),
    highlights: lines(source.highlight || source.accomplishments),
    risks: lines(source.risk), actions: lines(source.weeklyActions || source.weeklyAction || source.next),
    milestones: Array.isArray(source.milestones) ? source.milestones : [],
    quarterlyMilestones: Array.isArray(source.quarterlyMilestones) ? source.quarterlyMilestones : [],
    workstreams: (Array.isArray(source.ganttWorkstreams) ? source.ganttWorkstreams : []).map((row, index) => ({
      id: String(row.id || `workstream-${index + 1}`), name: String(row.name || 'Workstream'),
      startDate: String(row.startDate || ''), endDate: String(row.endDate || ''),
      status: String(row.status || 'not-started'), progress: clampPercent(row.progress),
      sortOrder: Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : index
    })).sort((a, b) => a.sortOrder - b.sortOrder),
    teamMembers: Array.isArray(source.teamMembers) ? source.teamMembers : [],
    resources: source.resources && typeof source.resources === 'object' ? source.resources : {},
    budgetSource: source.budget && typeof source.budget === 'object' ? source.budget : {}
  };
}
```

`disciplineRows` matches resource entries to unique team roles by normalized role label, preserves an explicit stored `role` or `label`, converts blanks to `null`, and computes `remaining` only when actual is present. `budgetTotals` sums `monthlyPlans` and `actuals` in the stored currency without inventing exchange rates in the service; the output labels that currency.

`buildOverviewReportModel` filters projects by `overviewScope`, calculates green/yellow/red counts, average progress, attention buckets, risk/action rows, resource allocation summaries, budget totals, quarterly items, and a maximum six-point trend series. Trend points contain `{ label, riskPressure, avgProgress }`, where red risk entries count `1.5`, other non-empty risks count `1`, and progress is averaged across active projects.

- [ ] **Step 4: Load bounded history through the authorized data layer**

In `loadAuthorizedReport`, call `adapters.getTrendWeeks(week)` only for Overview requests containing `weekly-trend`; filter VIP history to `isReleased === true`, remove values that are not objects, and keep the last six returned entries. In `server.js`, implement the adapter with one bounded Firestore query:

```js
getTrendWeeks: async week => {
  const snapshot = await db.collection('weeks')
    .where('weekLabel', '<=', String(week.weekLabel || ''))
    .orderBy('weekLabel', 'desc')
    .limit(6)
    .get();
  return snapshot.docs.map(doc => doc.data()).reverse();
}
```

Fix project section filtering to check `ganttWorkstreams` for `gantt`, `resources` for `resources`, and preserve zero-valued but structurally present budget data for `budget`.

- [ ] **Step 5: Run model, data, and access tests**

Run: `cd pdf-service && node --test test/report-model.test.mjs test/report-data.test.mjs test/report-access.test.mjs`

Expected: PASS for every selected test file.

- [ ] **Step 6: Commit report models and bounded data loading**

```powershell
git add pdf-service/src/report-model.js pdf-service/src/report-data.js pdf-service/src/server.js pdf-service/test/report-model.test.mjs pdf-service/test/report-data.test.mjs
git commit -m "feat: add PDF presentation models"
```

---

### Task 3: Complete dashboard-style project report

**Files:**
- Modify: `pdf-service/src/project-report.js`
- Modify: `pdf-service/test/project-report.test.mjs`
- Create: `pdf-service/test/report-fixtures.mjs`

**Interfaces:**
- Consumes: `buildProjectReportModel`, `reportPage`, shared cards, badges, progress bars, and tables.
- Preserves: `renderProjectReportHtml({ week, project, sections }): string`.
- Produces page groups: summary, milestone, Gantt, resources, and budget in approved order.

- [ ] **Step 1: Add a failing all-section project test**

```js
import { completeProjectReportFixture } from './report-fixtures.mjs';

test('renders every selected project section with dashboard visual structures', () => {
  const html = renderProjectReportHtml(completeProjectReportFixture());
  for (const section of ['project-summary', 'milestone', 'gantt', 'resource', 'budget']) {
    assert.match(html, new RegExp(`data-report-section="${section}"`));
  }
  assert.match(html, /project-brief-grid/);
  assert.match(html, /status-badge red/);
  assert.match(html, /gantt-row/);
  assert.match(html, /team-allocation-table/);
  assert.match(html, /discipline-hours-table/);
  assert.match(html, /budget-comparison/);
  assert.doesNotMatch(html, /<script|onclick=|<button|<select|<input/);
});
```

Add tests that user text is escaped, an unselected section leaves no page, and long milestone names use vertical timeline rows without splitting items.

Create the deterministic fixture with all seven selections and every required data shape:

```js
export function completeProjectReportFixture() {
  return {
    week: { weekLabel:'W28 2026', weekDate:'Jul 6 - Jul 12' },
    sections:['project-brief','project-update','milestone','gantt','team-allocation','resources','budget'],
    project:{
      name:'Platform Modernization', code:'PMS-001', projectLevel:'system', status:'red', progress:62,
      owner:'Augus', deputy:'Bonnie', customer:'Operations', location:'Singapore',
      highlight:'Prototype approved\nPilot environment ready', risk:'Vendor lead time',
      weeklyActions:'Confirm alternate supplier\nComplete integration test',
      milestones:[
        { name:'Design approval', date:'2026-07-04', status:'done' },
        { name:'Pilot build', date:'2026-07-18', status:'in-progress' },
        { name:'Launch readiness', date:'2026-08-14', status:'at-risk' }
      ],
      ganttWorkstreams:[
        { name:'Design', startDate:'2026-06-20', endDate:'2026-07-08', status:'completed', progress:100 },
        { name:'Integration', startDate:'2026-07-01', endDate:'2026-08-05', status:'at-risk', progress:48 }
      ],
      teamMembers:[
        { name:'Bonnie', roleName:'Firmware', effortPct:70 },
        { name:'Josiah', roleName:'System Electrical', effortPct:50 }
      ],
      resources:{
        role_firmware:{ role:'Firmware', estimated:120, actual:72 },
        role_system_electrical:{ role:'System Electrical', estimated:90, actual:40 }
      },
      budget:{ currency:'USD', totalEstimated:120000,
        monthlyPlans:[{ month:'2026-07', categoryName:'NRE', currency:'USD', amount:60000 }],
        actuals:[{ month:'2026-07', categoryName:'NRE', currency:'USD', amount:42000 }]
      },
      quarterlyMilestones:[{ quarter:'Q3', name:'Pilot complete', progress:55, status:'in-progress' }]
    }
  };
}

export function completeOverviewReportFixture() {
  const project = completeProjectReportFixture().project;
  return {
    week:{ weekLabel:'W28 2026', executiveSummary:'Pilot work is progressing with one supplier escalation.', projects:[project] },
    trendWeeks:[
      { weekLabel:'W27', projects:[{ ...project, status:'yellow', progress:55 }] },
      { weekLabel:'W28', projects:[project] }
    ],
    sections:['health-focus','weekly-trend','executive-summary','attention-matrix','risk-actions','quarterly-roadmap','project-portfolio','resource-analytics','budget-overview'],
    overviewScope:'all'
  };
}
```

- [ ] **Step 2: Run the project tests and verify missing sections fail**

Run: `cd pdf-service && node --test test/project-report.test.mjs`

Expected: FAIL because Gantt, discipline hours, and budget markup are absent.

- [ ] **Step 3: Compose the approved project pages**

Implement one pure renderer per content unit:

```js
function renderProjectSummary(model) {}
function renderMilestoneTimeline(model) {}
function renderGantt(model) {}
function renderResourcePage(model, selected) {}
function renderBudget(model) {}
```

Each function returns a complete markup string and receives only the normalized model. `renderProjectSummary` uses a three-column brief/context grid, RAG badge, delivery progress bar, and update cards. `renderMilestoneTimeline` uses a horizontal path for at most three short items and vertical rows otherwise. `renderGantt` derives the minimum valid start date and maximum valid end date, computes each bar's left and width percentages, and renders status-colored completed and remaining segments. Invalid-date rows remain visible as text rows with an `Unscheduled` badge.

The resource page renders Team allocation and Discipline hours in two cards on one page when both are selected, or expands the selected card to full width. Budget renders four KPI cards plus planned-versus-actual comparison bars and the stored currency label. Empty selected summary units show a compact intentional empty state; empty optional resource, Gantt, milestone, and budget sections remain omitted by the authorized data layer.

- [ ] **Step 4: Run project and shared-theme tests**

Run: `cd pdf-service && node --test test/project-report.test.mjs test/report-html.test.mjs test/report-model.test.mjs`

Expected: PASS with all seven project section identities covered.

- [ ] **Step 5: Commit the complete project report**

```powershell
git add pdf-service/src/project-report.js pdf-service/test/project-report.test.mjs pdf-service/test/report-fixtures.mjs
git commit -m "feat: render dashboard-style project PDFs"
```

---

### Task 4: Complete dashboard-style Overview report

**Files:**
- Modify: `pdf-service/src/overview-report.js`
- Modify: `pdf-service/test/overview-report.test.mjs`
- Modify: `pdf-service/test/report-fixtures.mjs`

**Interfaces:**
- Consumes: `buildOverviewReportModel`, shared report pages, cards, badges, progress bars, tables, and inline SVG.
- Preserves: `renderOverviewReportHtml({ week, trendWeeks, sections, overviewScope }): string`.
- Produces all nine approved Overview section identities in dashboard reading order.

- [ ] **Step 1: Add failing full Overview coverage tests**

```js
test('renders all nine selected Overview sections in dashboard reading order', () => {
  const html = renderOverviewReportHtml(completeOverviewReportFixture());
  const ids = ['health-focus','weekly-trend','executive-summary','attention-matrix','risk-actions','quarterly-roadmap','project-portfolio','resource-analytics','budget-overview'];
  ids.forEach(id => assert.match(html, new RegExp(`data-section-unit="${id}"`)));
  const positions = ids.map(id => html.indexOf(`data-section-unit="${id}"`));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  assert.match(html, /weekly-trend-svg/);
  assert.match(html, /attention-quadrant action/);
  assert.match(html, /quarter-grid/);
  assert.match(html, /resource-function-bar/);
  assert.match(html, /budget-variance/);
});
```

Add tests for combined opening and management pages, project-card continuation pages, empty optional sections, escaped project text, and table heading repetition through CSS.

- [ ] **Step 2: Run the Overview test and verify missing section failures**

Run: `cd pdf-service && node --test test/overview-report.test.mjs`

Expected: FAIL because six selected Overview sections are not rendered.

- [ ] **Step 3: Implement one renderer for each Overview section**

Use a declarative section map to guarantee ordering:

```js
const SECTION_RENDERERS = new Map([
  ['health-focus', renderHealthFocus], ['weekly-trend', renderWeeklyTrend],
  ['executive-summary', renderExecutiveSummary], ['attention-matrix', renderAttentionMatrix],
  ['risk-actions', renderRiskActions], ['quarterly-roadmap', renderQuarterlyRoadmap],
  ['project-portfolio', renderProjectPortfolio], ['resource-analytics', renderResourceAnalytics],
  ['budget-overview', renderBudgetOverview]
]);
```

The opening page combines health, trend, and executive summary units that were selected. The management page combines attention and risk units that were selected. Roadmap, resource analytics, and budget each use their own page. Project portfolio uses one complete dashboard-style project card per page so cards never split; every continuation page repeats the report header and section title.

`renderWeeklyTrend` emits a fixed `viewBox="0 0 320 140"` SVG with axes, escaped labels, one path, and circles; it does not embed raster images. Attention uses four quadrants and static cards without drag or selectors. Roadmap groups normalized quarterly milestones into Q1-Q4 columns. Resource analytics shows total FTE, allocation coverage, overallocated people, capacity, and CSS allocation bars. Budget shows total, planned, actual, variance, project rows, and category totals in the stored report currency.

- [ ] **Step 4: Run Overview, model, and shared-theme tests**

Run: `cd pdf-service && node --test test/overview-report.test.mjs test/report-model.test.mjs test/report-html.test.mjs`

Expected: PASS with all nine Overview section IDs covered and no interactive markup.

- [ ] **Step 5: Commit the complete Overview report**

```powershell
git add pdf-service/src/overview-report.js pdf-service/test/overview-report.test.mjs pdf-service/test/report-fixtures.mjs
git commit -m "feat: render dashboard-style Overview PDFs"
```

---

### Task 5: Warm Chromium lifecycle and PDF size guard

**Files:**
- Modify: `pdf-service/src/pdf-renderer.js`
- Modify: `pdf-service/src/pdf-response.js`
- Modify: `pdf-service/src/app.js`
- Create: `pdf-service/test/pdf-renderer.test.mjs`
- Modify: `pdf-service/test/pdf-response.test.mjs`
- Modify: `pdf-service/test/app.test.mjs`

**Interfaces:**
- Produces: `createPdfRenderer({ launch }): (html: string) => Promise<Uint8Array>`.
- Preserves: `renderPdfBuffer(html): Promise<Uint8Array>`.
- Produces: `MAX_PDF_BYTES = 8 * 1024 * 1024` and `PdfOutputError` with status `413`.
- Preserves: `sendPdfDownload(response, pdfBuffer, filename)` while rejecting oversized output before headers.

- [ ] **Step 1: Write failing browser-reuse and output-limit tests**

```js
test('reuses a connected browser and closes each request page', async () => {
  let launches = 0;
  let closes = 0;
  const browser = { isConnected: () => true, newPage: async () => ({
    setContent: async () => {}, pdf: async () => new Uint8Array([1, 2, 3]), close: async () => { closes += 1; }
  }) };
  const render = createPdfRenderer({ launch: async () => { launches += 1; return browser; } });
  await render('<html>A</html>'); await render('<html>B</html>');
  assert.equal(launches, 1); assert.equal(closes, 2);
});

test('rejects PDF output above 8 MiB before setting download headers', () => {
  const res = createResponse();
  assert.throws(() => sendPdfDownload(res, new Uint8Array(MAX_PDF_BYTES + 1), 'large.pdf'), PdfOutputError);
  assert.equal(res.statusCode, 0);
  assert.equal(res.headers.size, 0);
});
```

Add an app test asserting status `413` and error text `Generated PDF exceeds the 8 MiB download limit. Select fewer sections and try again.`.

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `cd pdf-service && node --test test/pdf-renderer.test.mjs test/pdf-response.test.mjs test/app.test.mjs`

Expected: FAIL because browser injection, reuse, and size guarding do not exist.

- [ ] **Step 3: Implement isolated warm-browser rendering**

```js
export function createPdfRenderer({ launch = options => puppeteer.launch(options) } = {}) {
  let browserPromise;
  const getBrowser = async () => {
    const current = await browserPromise?.catch(() => null);
    if (current?.isConnected?.()) return current;
    browserPromise = launch({ headless:true, args:['--no-sandbox','--disable-setuid-sandbox'] });
    return browserPromise;
  };
  return async html => {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil:'networkidle0' });
      return await page.pdf({ format:'A4', landscape:true, printBackground:true, preferCSSPageSize:true });
    } finally { await page.close(); }
  };
}
export const renderPdfBuffer = createPdfRenderer();
```

If page creation reports a disconnected browser, clear `browserPromise` and retry once. Never retry a report after `page.pdf` starts, preventing accidental duplicate work.

- [ ] **Step 4: Enforce the hard response limit and safe error**

Define `MAX_PDF_BYTES` and `PdfOutputError` in `pdf-response.js`. Convert `Uint8Array` to `Buffer`, compare `output.byteLength` before setting status or headers, and throw the `413` error above. `app.js` already exposes non-500 error messages; add the test to lock that behavior.

- [ ] **Step 5: Run lifecycle, response, and application tests**

Run: `cd pdf-service && node --test test/pdf-renderer.test.mjs test/pdf-response.test.mjs test/app.test.mjs`

Expected: PASS; the fake browser launches once and both fake pages close.

- [ ] **Step 6: Commit renderer and size controls**

```powershell
git add pdf-service/src/pdf-renderer.js pdf-service/src/pdf-response.js pdf-service/src/app.js pdf-service/test/pdf-renderer.test.mjs pdf-service/test/pdf-response.test.mjs pdf-service/test/app.test.mjs
git commit -m "feat: bound PDF rendering resources"
```

---

### Task 6: Sample rendering, full regression, visual QA, and deployment

**Files:**
- Create: `pdf-service/scripts/render-samples.mjs`
- Modify: `pdf-service/package.json`
- Modify: `pdf-service/README.md`
- Verify: `tests/professional-pdf-client.test.mjs`

**Interfaces:**
- Produces development artifacts `tmp/pdf-samples/project.pdf` and `tmp/pdf-samples/overview.pdf`; the Dockerfile does not copy scripts or `tmp` into production.
- Produces npm script `render:samples`.

- [ ] **Step 1: Add the sample-render command and script**

```js
import { mkdir, writeFile } from 'node:fs/promises';
import { renderPdfBuffer } from '../src/pdf-renderer.js';
import { renderProjectReportHtml } from '../src/project-report.js';
import { renderOverviewReportHtml } from '../src/overview-report.js';
import { completeOverviewReportFixture, completeProjectReportFixture } from '../test/report-fixtures.mjs';

const output = new URL('../../tmp/pdf-samples/', import.meta.url);
await mkdir(output, { recursive:true });
for (const [name, html] of [
  ['project.pdf', renderProjectReportHtml(completeProjectReportFixture())],
  ['overview.pdf', renderOverviewReportHtml(completeOverviewReportFixture())]
]) {
  const pdf = await renderPdfBuffer(html);
  if (pdf.byteLength > 1.5 * 1024 * 1024) throw new Error(`${name} exceeds the 1.5 MiB sample target`);
  await writeFile(new URL(name, output), pdf);
  process.stdout.write(`${name}: ${pdf.byteLength} bytes\n`);
}
```

Add `"render:samples": "node scripts/render-samples.mjs"` to `pdf-service/package.json`. Document the 1.5 MiB target, 8 MiB hard limit, scale-to-zero settings, bounded six-week trend read, and the fact that sample files are local development artifacts only.

- [ ] **Step 2: Run the complete automated suites**

Run: `node --test tests/*.test.mjs`

Expected: all root dashboard tests PASS.

Run: `cd pdf-service && npm test`

Expected: all PDF-service tests PASS.

- [ ] **Step 3: Render and inspect both sample PDFs**

Run: `cd pdf-service && npm run render:samples`

Expected: two byte counts below `1572864` and files at `tmp/pdf-samples/project.pdf` and `tmp/pdf-samples/overview.pdf`.

Render every page to PNG with Poppler and inspect at original detail:

```powershell
pdftoppm -png -r 144 tmp/pdf-samples/project.pdf tmp/pdf-samples/project
pdftoppm -png -r 144 tmp/pdf-samples/overview.pdf tmp/pdf-samples/overview
```

Reject the build if any selected section is missing or any page has clipping, overlap, an unexpected blank page, a browser URL/date header, or interactive controls. Fix the renderer and repeat automated and visual checks before continuing.

- [ ] **Step 4: Confirm the frontend recovery contract**

Run: `node --test tests/professional-pdf-client.test.mjs`

Expected: PASS, including awaited downloads, disabled-button progress state, restored buttons, modal closure only on success, and server error display.

- [ ] **Step 5: Commit sample tooling and operations documentation**

```powershell
git add pdf-service/scripts/render-samples.mjs pdf-service/package.json pdf-service/README.md tests/professional-pdf-client.test.mjs
git commit -m "test: verify dashboard PDF presentation"
```

Do not stage `tmp/` or `output/`.

- [ ] **Step 6: Deploy the verified service**

From `pdf-service`, run:

```powershell
.\deploy.ps1
```

Expected: a new `pm-dashboard-pdf` Cloud Run revision in `asia-southeast1` receives 100% traffic with min instances 0, max instances 1, concurrency 1, one CPU, 1 GiB memory, and 120-second timeout.

- [ ] **Step 7: Perform live acceptance on both dashboard entry points**

Use the signed-in dashboard at `https://augusliang23-web.github.io/pm-dashboard-v2-1/`. Download an all-section Overview PDF and an all-section project PDF. Verify successful direct downloads, every selected section, original dashboard visual semantics, no stuck export button, no blank or clipped pages, and each file below 1.5 MiB for the representative live data.

- [ ] **Step 8: Record final evidence**

Record the root and service test totals, sample and live PDF byte counts, Cloud Run revision name, and inspected page counts in the implementation handoff. Do not commit generated PDFs or rendered PNGs.
