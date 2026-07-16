# Executive Summary Decision Brief Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fixed two-page Executive Summary Decision Brief, backed by a structured Weekly Summary prompt and a backward-compatible deterministic parser.

**Architecture:** Keep `executiveSummary` as plain text and update both dashboard entry points to request a labelled output contract. Add a focused PDF-service parser that converts new and legacy text into a presentation model, then have the overview renderer emit two dedicated report pages with readable typography and deterministic caps.

**Tech Stack:** Browser-hosted JavaScript in `index.html`, Node.js ES modules, Node test runner, HTML/CSS print rendering, Puppeteer/Chromium.

## Global Constraints

- Keep the existing Dashboard -> Copilot/Gemini -> paste -> save workflow.
- Do not add an AI API, external network call, Firestore migration, or new runtime dependency.
- Keep `executiveSummary` as the stored plain-text source of truth.
- Render the Executive Summary as exactly two A4 landscape pages when selected.
- Main title 24-26 pt; section title 14-15 pt; project title 12-14 pt; body text at least 10.5 pt with approximately 1.45 line height.
- Page 1 shows at most two priority projects and four management asks.
- Page 2 shows at most six project context entries and an additional-details note when content is omitted.
- Preserve legacy Weekly Summary support and never modify saved source text while formatting a PDF.

---

### Task 1: Structured Weekly Summary Prompt

**Files:**
- Create: `tests/weekly-summary-prompt.test.mjs`
- Modify: `index.html:6069-6110`
- Modify: `team-2/index.html:6069-6110`

**Interfaces:**
- Consumes: the existing `buildCopilotPrompt()` dashboard state and `addPortfolioSummaryInstruction(prompt)` call site.
- Produces: identical prompt contracts in both dashboard entry points with exact labels `Project`, `Movement`, `Blocker`, `Next step`, `Decision / Support needed`, and `Business impact`.

- [ ] **Step 1: Write the failing prompt-contract test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sources = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../team-2/index.html', import.meta.url), 'utf8')
]);

test('both dashboards request the structured Weekly Summary contract', () => {
  for (const source of sources) {
    assert.match(source, /Portfolio Summary:/);
    assert.match(source, /- Project: <exact project name>/);
    assert.match(source, /Movement: <one or two concise sentences>/);
    assert.match(source, /Blocker: <one concise sentence, or None>/);
    assert.match(source, /Next step: <one concise sentence>/);
    assert.match(source, /Decision \/ Support needed: <one concise sentence>/);
    assert.match(source, /Business impact: <one concise sentence>/);
    assert.match(source, /Four to six project movement entries/);
    assert.match(source, /Up to four management asks/);
  }
});

test('the prompt remains plain text and prohibits invented facts and tables', () => {
  for (const source of sources) {
    assert.match(source, /Return plain text only/);
    assert.match(source, /Do not invent facts/);
    assert.match(source, /Do not use Markdown heading symbols, bold text, tables, or code fences/);
  }
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/weekly-summary-prompt.test.mjs`

Expected: FAIL because the current prompt still requests `- Exact Project Name: concise update.` instead of the new labelled fields.

- [ ] **Step 3: Replace the prompt-format instructions in both dashboard files**

Use the same literal contract in `index.html` and `team-2/index.html`:

```text
Required plain-text format:
- Return plain text only. Do not use Markdown heading symbols, bold text, tables, or code fences.
- Return exactly these two section headings, each on its own line: WEEKLY MOVEMENT and MANAGEMENT ASK.
- Immediately below WEEKLY MOVEMENT write: Portfolio Summary: <one concise portfolio-level summary>
- Then write four to six project movement entries in this exact labelled format:
  - Project: <exact project name>
    Movement: <one or two concise sentences>
    Blocker: <one concise sentence, or None>
    Next step: <one concise sentence>
- Under MANAGEMENT ASK write up to four entries in this exact labelled format:
  - Project: <exact project name>
    Decision / Support needed: <one concise sentence>
    Business impact: <one concise sentence>
```

Remove the redundant prompt-rewriting behavior from `addPortfolioSummaryInstruction()` by returning the supplied prompt unchanged, preserving the existing call site for compatibility.

- [ ] **Step 4: Run the prompt test and the existing dashboard suite**

Run: `node --test tests/weekly-summary-prompt.test.mjs tests/*.test.mjs`

Expected: all tests PASS with zero failures.

- [ ] **Step 5: Commit the prompt contract**

```powershell
git add -- tests/weekly-summary-prompt.test.mjs index.html team-2/index.html
git commit -m "feat: structure weekly summary prompt"
```

### Task 2: Backward-Compatible Executive Summary Parser

**Files:**
- Create: `pdf-service/src/executive-summary-brief.js`
- Create: `pdf-service/test/executive-summary-brief.test.mjs`

**Interfaces:**
- Consumes: `parseExecutiveSummaryBrief(summary: string): ExecutiveSummaryBrief`.
- Produces: `{ portfolioSummary, projects, priorityProjects, managementAsks, fallbackText, hasAdditionalContent }`, where projects are capped at six, priority projects at two, and management asks at four.

- [ ] **Step 1: Write failing tests for structured parsing and deterministic priority**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseExecutiveSummaryBrief } from '../src/executive-summary-brief.js';

test('parses structured movement and management ask fields', () => {
  const brief = parseExecutiveSummaryBrief(`WEEKLY MOVEMENT
Portfolio Summary: Delivery remains stable.
- Project: Alpha
  Movement: Validation completed.
  Blocker: Supplier date remains open.
  Next step: Confirm the recovery plan.
- Project: Beta
  Movement: Build started.
  Blocker: None
  Next step: Complete bring-up.
MANAGEMENT ASK
- Project: Beta
  Decision / Support needed: Approve lab priority.
  Business impact: Protects the launch date.`);

  assert.equal(brief.portfolioSummary, 'Delivery remains stable.');
  assert.deepEqual(brief.projects[0], {
    projectName: 'Alpha', movement: 'Validation completed.',
    blocker: 'Supplier date remains open.', nextStep: 'Confirm the recovery plan.'
  });
  assert.equal(brief.managementAsks[0].projectName, 'Beta');
  assert.deepEqual(brief.priorityProjects.map(item => item.projectName), ['Beta', 'Alpha']);
});
```

- [ ] **Step 2: Run the parser test and verify RED**

Run: `cd pdf-service; node --test test/executive-summary-brief.test.mjs`

Expected: FAIL with module-not-found for `executive-summary-brief.js`.

- [ ] **Step 3: Implement minimal structured parser**

Create `parseExecutiveSummaryBrief(summary)` with line normalization, section tracking, label recognition, HTML-independent plain objects, and deterministic ranking that places projects named in management asks first while preserving source order inside each group. Use these exact caps and normalization rules:

```js
const PROJECT_LIMIT = 6;
const PRIORITY_LIMIT = 2;
const ASK_LIMIT = 4;

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function optional(value) {
  const result = clean(value);
  return /^(none|n\/a|not applicable)$/i.test(result) ? '' : result;
}

function rankProjects(projects, asks) {
  const asked = new Set(asks.map(item => item.projectName.toLowerCase()));
  return projects
    .map((project, index) => ({ project, index, asked: asked.has(project.projectName.toLowerCase()) }))
    .sort((left, right) => Number(right.asked) - Number(left.asked) || left.index - right.index)
    .map(item => item.project);
}

function finishBrief({ portfolioSummary, projects, asks, fallback }) {
  const hasAdditionalContent = projects.length > PROJECT_LIMIT || asks.length > ASK_LIMIT;
  const visibleProjects = projects.slice(0, PROJECT_LIMIT);
  const visibleAsks = asks.slice(0, ASK_LIMIT);
  return {
    portfolioSummary: clean(portfolioSummary) || clean(fallback[0]),
    projects: visibleProjects,
    priorityProjects: rankProjects(visibleProjects, visibleAsks).slice(0, PRIORITY_LIMIT),
    managementAsks: visibleAsks,
    fallbackText: fallback.map(clean).filter(Boolean).join(' '),
    hasAdditionalContent
  };
}
```

The exported parser must recognize headings after removing leading `#`, treat `- Project:` as a structured item start, map the exact field labels, map legacy `- Project Name: body` lines according to the current section, omit `None` blocker text, and send other non-heading lines to `fallback`.

- [ ] **Step 4: Add failing legacy, malformed, and overflow tests**

```js
test('maps legacy project bullets without requiring historical rewrites', () => {
  const brief = parseExecutiveSummaryBrief(`WEEKLY MOVEMENT
Portfolio Summary: Stable portfolio.
- Alpha: Progress increased and validation remains blocked.
MANAGEMENT ASK
- Alpha: Confirm laboratory priority.`);
  assert.equal(brief.projects[0].projectName, 'Alpha');
  assert.equal(brief.projects[0].movement, 'Progress increased and validation remains blocked.');
  assert.equal(brief.managementAsks[0].supportNeeded, 'Confirm laboratory priority.');
});

test('caps display content and reports additional details', () => {
  const movement = Array.from({ length: 7 }, (_, index) =>
    `- Project: P${index + 1}\n  Movement: M${index + 1}\n  Blocker: None\n  Next step: N${index + 1}`
  ).join('\n');
  const asks = Array.from({ length: 5 }, (_, index) =>
    `- Project: P${index + 1}\n  Decision / Support needed: D${index + 1}\n  Business impact: I${index + 1}`
  ).join('\n');
  const brief = parseExecutiveSummaryBrief(`WEEKLY MOVEMENT\n${movement}\nMANAGEMENT ASK\n${asks}`);
  assert.equal(brief.projects.length, 6);
  assert.equal(brief.priorityProjects.length, 2);
  assert.equal(brief.managementAsks.length, 4);
  assert.equal(brief.hasAdditionalContent, true);
});
```

- [ ] **Step 5: Run tests, implement legacy fallback and caps, then verify GREEN**

Run: `cd pdf-service; node --test test/executive-summary-brief.test.mjs`

Expected: all parser tests PASS.

- [ ] **Step 6: Commit the parser**

```powershell
git add -- pdf-service/src/executive-summary-brief.js pdf-service/test/executive-summary-brief.test.mjs
git commit -m "feat: parse executive summary briefs"
```

### Task 3: Two-Page Decision Brief Renderer

**Files:**
- Modify: `pdf-service/src/overview-report.js:1-201`
- Modify: `pdf-service/src/report-theme.js:166-191`
- Modify: `pdf-service/test/overview-report.test.mjs`
- Modify: `pdf-service/test/pdf-layout.test.mjs`
- Modify: `pdf-service/test/report-fixtures.mjs`

**Interfaces:**
- Consumes: `parseExecutiveSummaryBrief(model.executiveSummary)` from Task 2 and the existing `reportPage()` helper.
- Produces: two `report-page` elements with `data-report-section="executive-summary-brief"` and `data-report-section="executive-summary-context"`.

- [ ] **Step 1: Add the shared six-project fixture and write failing renderer/page-count tests**

Add tests that provide a structured summary and select only `executive-summary`:

```js
test('renders Executive Summary as a fixed two-page Decision Brief', () => {
  const fixture = completeOverviewReportFixture();
  fixture.sections = ['executive-summary'];
  fixture.week.executiveSummary = structuredExecutiveSummaryFixture();
  const html = renderOverviewReportHtml(fixture);

  assert.equal((html.match(/data-report-section="executive-summary-/g) || []).length, 2);
  assert.match(html, /data-report-section="executive-summary-brief"/);
  assert.match(html, /data-report-section="executive-summary-context"/);
  assert.match(html, /Decision Brief/);
  assert.match(html, /Project Context/);
  assert.match(html, /Management decisions/);
});
```

Also update the existing all-sections ordering test to expect the Executive Summary pages after the combined health/trend opening page and before Management Attention.

Export `structuredExecutiveSummaryFixture()` from `report-fixtures.mjs` with six labelled movement entries and four labelled management asks. Add this real-PDF regression to `pdf-layout.test.mjs` before changing the renderer:

```js
test('Executive Summary renders exactly two landscape pages', { timeout: 60000 }, async () => {
  const fixture = completeOverviewReportFixture();
  fixture.sections = ['executive-summary'];
  fixture.week.executiveSummary = structuredExecutiveSummaryFixture();
  const pdf = await renderPdfBuffer(renderOverviewReportHtml(fixture));
  const pages = Buffer.from(pdf).toString('latin1').match(/\/Type\s*\/Page\b/g) || [];
  assert.equal(pages.length, 2);
});
```

- [ ] **Step 2: Run the renderer test and verify RED**

Run: `cd pdf-service; node --test test/overview-report.test.mjs test/pdf-layout.test.mjs`

Expected: FAIL because the current implementation nests a paragraph grid inside `overview-opening` and renders the selected Executive Summary as one report page.

- [ ] **Step 3: Implement two dedicated pages**

Replace `renderExecutiveSummary()` with focused helpers:

```js
function renderBriefField(label, value) {
  return value ? `<p><strong>${escapeHtml(label)}</strong>${escapeHtml(value)}</p>` : '';
}

function renderDecisionBrief(model, brief) {
  const projects = brief.priorityProjects.map(project => `<article class="executive-priority-card card">
    <h3 class="executive-project-title">${escapeHtml(project.projectName)}</h3>
    ${renderBriefField('Movement', project.movement)}
    ${renderBriefField('Blocker', project.blocker)}
    ${renderBriefField('Next step', project.nextStep)}
  </article>`).join('');
  const asks = brief.managementAsks.map(ask => `<article class="executive-ask-card">
    <h3 class="executive-project-title">${escapeHtml(ask.projectName)}</h3>
    ${renderBriefField('Decision / Support needed', ask.supportNeeded)}
    ${renderBriefField('Business impact', ask.businessImpact)}
  </article>`).join('');
  return `<section class="executive-brief-copy" data-section-unit="executive-summary">
    <div class="executive-brief-metrics">${metricCard('Active projects', model.health.total, 'Selected Overview scope')}${metricCard('On Track', model.health.green, 'Green status', 'green')}${metricCard('At Risk', model.health.yellow, 'Yellow status', 'yellow')}${metricCard('Critical', model.health.red, 'Red status', model.health.red ? 'red' : 'neutral')}</div>
    <div class="executive-portfolio-lead"><h2 class="executive-brief-section-title">Portfolio summary</h2><p>${escapeHtml(brief.portfolioSummary || 'No executive summary is available for this reporting period.')}</p></div>
    <h2 class="executive-brief-section-title">Priority projects</h2>
    <div class="executive-priority-grid">${projects || emptyState('No project movement is available.')}</div>
    <h2 class="executive-brief-section-title">Management decisions</h2>
    <div class="executive-ask-grid">${asks || emptyState('No immediate management decision is required this week.')}</div>
  </section>`;
}

function renderProjectContext(brief) {
  const projects = brief.projects.map(project => `<article class="executive-context-card card">
    <h2 class="executive-project-title">${escapeHtml(project.projectName)}</h2>
    ${renderBriefField('Movement', project.movement)}
    ${renderBriefField('Blocker', project.blocker)}
    ${renderBriefField('Next step', project.nextStep)}
  </article>`).join('');
  const note = brief.hasAdditionalContent
    ? '<p class="executive-additional-note">Additional project details are available in the dashboard.</p>'
    : '';
  return `<section class="executive-brief-copy"><p class="executive-context-intro">Supporting movement, blocker, and next-step detail for the current reporting period.</p><div class="executive-context-grid">${projects || emptyState(brief.fallbackText || 'No project context is available.')}</div>${note}</section>`;
}
```

In `renderOverviewReportHtml()`:

```js
if (opening.length) pages.push(reportPage({
  section: 'overview-opening', title: 'Portfolio Overview',
  kicker: 'Overview report - Executive view', period: model.period,
  body: opening.join('')
}));
if (selected.has('executive-summary')) {
  const brief = parseExecutiveSummaryBrief(model.executiveSummary);
  pages.push(reportPage({
    section: 'executive-summary-brief', title: 'Decision Brief',
    kicker: 'Executive Summary - Management-ready update', period: model.period,
    body: renderDecisionBrief(model, brief)
  }));
  pages.push(reportPage({
    section: 'executive-summary-context', title: 'Project Context',
    kicker: 'Executive Summary - Supporting detail', period: model.period,
    body: renderProjectContext(brief)
  }));
}
```

Do not push Executive Summary into the opening page.

- [ ] **Step 4: Add the approved typography and card CSS**

Create scoped rules under `.executive-brief-*` and `.executive-context-*`:

```css
.report-page[data-report-section="executive-summary-brief"] .report-title,
.report-page[data-report-section="executive-summary-context"] .report-title { font-size:25pt; }
.executive-brief-section-title { font-size:14.5pt; }
.executive-project-title { font-size:13pt; }
.executive-brief-copy { font-size:10.5pt; line-height:1.45; }
```

Use a one-column portfolio lead, two-column priority cards, a two-column management ask grid, and a two-column Project Context grid. Keep all styling scoped so other PDF pages retain their established density.

- [ ] **Step 5: Run the overview and complete PDF-service test suites**

Run: `cd pdf-service; node --test test/overview-report.test.mjs`

Expected: PASS.

Run: `cd pdf-service; npm test`

Expected: all PDF-service tests PASS with zero failures.

- [ ] **Step 6: Commit the renderer**

```powershell
git add -- pdf-service/src/overview-report.js pdf-service/src/report-theme.js pdf-service/test/overview-report.test.mjs
git commit -m "feat: render two-page executive decision brief"
```

### Task 4: Chromium and Visual PDF Verification

**Files:**
- Verify: `pdf-service/test/pdf-layout.test.mjs`
- Verify: `pdf-service/test/report-fixtures.mjs`
- Use: `pdf-service/scripts/render-samples.mjs`
- Generate: `tmp/pdf-samples/overview.pdf`
- Generate: `tmp/pdfs/executive-summary-page-*.png`

**Interfaces:**
- Consumes: final HTML from Task 3 and the existing `renderPdfBuffer()` Chromium renderer.
- Produces: fresh automated and rendered PNG evidence for layout review.

- [ ] **Step 1: Run complete automated verification**

Run: `node --test tests/*.test.mjs`

Expected: all dashboard tests PASS.

Run: `cd pdf-service; npm test`

Expected: all PDF-service tests PASS.

Run: `cd pdf-service; npm run render:samples`

Expected: `overview.pdf` and `project.pdf` render successfully and each remains below 1.5 MiB.

- [ ] **Step 2: Render the sample PDF pages to PNG**

```powershell
New-Item -ItemType Directory -Force tmp\pdfs | Out-Null
pdftoppm -png -f 1 -l 3 tmp\pdf-samples\overview.pdf tmp\pdfs\executive-summary-page
```

Inspect every generated Executive Summary page image for title hierarchy, minimum readable body size, card alignment, footer clearance, clipping, overlaps, and unexpected blank pages. If a defect is found, add or tighten a regression test before changing production CSS.

- [ ] **Step 3: Final requirement audit**

Re-read `docs/superpowers/specs/2026-07-16-executive-summary-decision-brief-design.md`, inspect `git diff HEAD~4..HEAD`, and confirm every global constraint has automated or visual evidence. Do not deploy or push without a separate explicit user request.
