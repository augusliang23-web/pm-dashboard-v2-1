# v2.0T Multi-Project Portfolio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the exact v2.0T Team 2 UAT dashboard with system/module portfolio scopes, editable workstream Gantt schedules, one-page status, optional actual resource tracking, one-time Excel migration, and scope-aware Overview reporting.

**Architecture:** Keep `team-2/index.html` as the deployed application and preserve its Firebase/role patterns. Extract new deterministic normalization, filtering, schedule, resource, and import rules into small browser-compatible ES modules so they can be tested with Node's built-in test runner. Deliver the feature in independently deployable increments, with Overview changed last to minimize regression risk.

**Tech Stack:** Static HTML/CSS/JavaScript, ES modules, Firebase Auth/Firestore 10.12.2, SheetJS browser build for admin-only import, Node.js built-in `node:test`, GitHub Pages UAT.

---

## File Structure

- `team-2/index.html` — existing v2.0T UI, Firebase subscriptions/writes, role-aware rendering, project editor, Overview, and modal orchestration.
- `team-2/js/portfolio-core.mjs` — pure project normalization, scope filtering, Gantt calculations, and resource calculations.
- `team-2/js/excel-import.mjs` — pure workbook row normalization, validation, duplicate policy, and import result construction.
- `team-2/vendor/xlsx.full.min.js` — pinned SheetJS browser distribution used only by the admin import modal; store locally so UAT does not depend on a mutable CDN.
- `tests/portfolio-core.test.mjs` — deterministic unit tests for scopes, templates, dates, milestones, and resource rules.
- `tests/excel-import.test.mjs` — deterministic unit tests for Excel normalization and validation.
- `tests/v2-baseline.test.mjs` — guardrails proving the implementation starts from the correct Team 2 Firebase application and retains required v2.0T UI/role hooks.
- `docs/migration/team-2-excel-import-runbook.md` — operator instructions, dry-run checks, backup/export requirement, reconciliation, and rollback.

Do not replace the monolithic application with a framework during this project. New modules contain pure rules only; existing DOM and Firebase orchestration remain in `team-2/index.html`.

### Task 1: Establish the Exact v2.0T Baseline and Regression Guardrails

**Files:**
- Modify: `team-2/index.html`
- Create: `tests/v2-baseline.test.mjs`

- [ ] **Step 1: Create an isolated implementation branch from the UAT commit**

Run:

```powershell
git fetch uat
git switch -c codex/v2.0t-multi-project ddc0e5f
git rev-parse HEAD
git diff --exit-code ddc0e5f -- team-2/index.html
```

Expected: `HEAD` is `ddc0e5f00e859edaf9355fcb77a694b95718fb26` and the diff command exits `0`.

- [ ] **Step 2: Write the baseline test**

Create `tests/v2-baseline.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../team-2/index.html', import.meta.url), 'utf8');

test('Team 2 page retains v2.0T Firebase and role hooks', () => {
  for (const required of [
    'initializeApp(FIREBASE_CONFIG)',
    'getFirestore(app)',
    'getAuth(app)',
    "currentRole === 'vip'",
    'isAdminVipPreview',
    'toggleOverview()',
    'openProjEdit(',
    'saveProjEdit()',
  ]) {
    assert.ok(html.includes(required), `missing baseline hook: ${required}`);
  }
});

test('Team 2 remains the deployed page title and does not use prototype assets', () => {
  assert.match(html, /<title>Project Dashboard · LITEON Edition<\/title>/);
  assert.doesNotMatch(html, /prototype\.html|prototype\.png/);
});
```

- [ ] **Step 3: Run the baseline test**

Run:

```powershell
node --test tests/v2-baseline.test.mjs
```

Expected: 2 tests pass.

- [ ] **Step 4: Add a visible source-version marker**

In the inline application module near existing constants in `team-2/index.html`, add:

```js
const DASHBOARD_RELEASE = 'v2.0T-portfolio';
const DASHBOARD_BASE_COMMIT = 'ddc0e5f';
```

Set the existing footer/version element, or add a muted footer element if none exists:

```html
<span id="dashboardVersion" class="muted-version"></span>
```

During `setupUI()` set:

```js
document.getElementById('dashboardVersion').textContent =
  `${DASHBOARD_RELEASE} · base ${DASHBOARD_BASE_COMMIT}`;
```

- [ ] **Step 5: Re-run guardrails**

Run:

```powershell
node --test tests/v2-baseline.test.mjs
git diff --check
```

Expected: tests pass and `git diff --check` prints nothing.

- [ ] **Step 6: Commit**

```powershell
git add team-2/index.html tests/v2-baseline.test.mjs
git commit -m "test: lock Team 2 v2.0T baseline"
```

### Task 2: Add the Unified Project Model and Pure Portfolio Rules

**Files:**
- Create: `team-2/js/portfolio-core.mjs`
- Create: `tests/portfolio-core.test.mjs`
- Modify: `team-2/index.html`

- [ ] **Step 1: Write failing project-model tests**

Create `tests/portfolio-core.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROJECT_LEVEL,
  PROJECT_LIFECYCLE,
  normalizeProject,
  filterProjects,
} from '../team-2/js/portfolio-core.mjs';

const projects = [
  { code: 'SYS-1', name: '60kW Dual Gun', projectLevel: 'system', pm: 'Geoff', status: 'green', lifecycle: 'active', productFamily: 'EVSE' },
  { code: 'MOD-1', name: 'P60U Power Module', projectLevel: 'hardware-module', pm: 'Augus', status: 'yellow', lifecycle: 'active', productFamily: 'Power Module' },
];

test('legacy projects normalize to system without losing unknown fields', () => {
  const source = { code: 'OLD-1', name: 'Legacy', customLegacyField: 42 };
  const result = normalizeProject(source);
  assert.equal(result.projectLevel, PROJECT_LEVEL.SYSTEM);
  assert.equal(result.lifecycle, PROJECT_LIFECYCLE.ACTIVE);
  assert.equal(result.customLegacyField, 42);
});

test('portfolio filters combine scope, PM, RAG, lifecycle, family, and text', () => {
  const result = filterProjects(projects, {
    scope: PROJECT_LEVEL.HARDWARE_MODULE,
    pm: 'Augus',
    rag: 'yellow',
    lifecycle: 'active',
    productFamily: 'Power Module',
    search: 'p60u',
  });
  assert.deepEqual(result.map(project => project.code), ['MOD-1']);
});

test('all scope includes both project levels', () => {
  assert.equal(filterProjects(projects, { scope: 'all' }).length, 2);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
node --test tests/portfolio-core.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the minimal portfolio rules**

Create `team-2/js/portfolio-core.mjs`:

```js
export const PROJECT_LEVEL = Object.freeze({
  SYSTEM: 'system',
  HARDWARE_MODULE: 'hardware-module',
});

export const PROJECT_LIFECYCLE = Object.freeze({
  ACTIVE: 'active',
  ON_HOLD: 'on-hold',
  COMPLETED: 'completed',
});

const text = value => (value ?? '').toString().trim();
const lower = value => text(value).toLowerCase();

export function normalizeProject(source = {}) {
  return {
    ...source,
    projectLevel: Object.values(PROJECT_LEVEL).includes(source.projectLevel)
      ? source.projectLevel
      : PROJECT_LEVEL.SYSTEM,
    lifecycle: Object.values(PROJECT_LIFECYCLE).includes(source.lifecycle)
      ? source.lifecycle
      : PROJECT_LIFECYCLE.ACTIVE,
    projectType: text(source.projectType ?? source.type),
    classification: text(source.classification),
    productFamily: text(source.productFamily),
    ganttWorkstreams: Array.isArray(source.ganttWorkstreams) ? source.ganttWorkstreams : [],
    resources: source.resources && typeof source.resources === 'object' ? source.resources : {},
  };
}

export function filterProjects(source, filters = {}) {
  const scope = filters.scope || 'all';
  const query = lower(filters.search);
  return source.map(normalizeProject).filter(project => {
    if (scope !== 'all' && project.projectLevel !== scope) return false;
    if (filters.pm && filters.pm !== 'all' && project.pm !== filters.pm) return false;
    if (filters.rag && filters.rag !== 'all' && project.status !== filters.rag) return false;
    if (filters.lifecycle && filters.lifecycle !== 'all' && project.lifecycle !== filters.lifecycle) return false;
    if (filters.productFamily && filters.productFamily !== 'all' && project.productFamily !== filters.productFamily) return false;
    return !query || lower(`${project.code} ${project.name}`).includes(query);
  });
}
```

- [ ] **Step 4: Run model tests**

Run:

```powershell
node --test tests/portfolio-core.test.mjs
```

Expected: 3 tests pass.

- [ ] **Step 5: Import and apply normalization at the Firestore boundary**

At the top of the existing `<script type="module">` in `team-2/index.html`, add:

```js
import {
  PROJECT_LEVEL,
  PROJECT_LIFECYCLE,
  normalizeProject,
  filterProjects,
} from './js/portfolio-core.mjs';
```

Where the projects snapshot is converted to application records, normalize each record without changing its Firestore ID:

```js
projects = snapshot.docs.map(item =>
  normalizeProject({ id: item.id, ...item.data() })
);
```

Before the existing project save writes to Firestore, include normalized new fields while retaining existing properties:

```js
const portfolioFields = {
  projectLevel: document.getElementById('pe_project_level').value,
  lifecycle: document.getElementById('pe_lifecycle').value,
  projectType: document.getElementById('pe_project_type').value.trim(),
  classification: document.getElementById('pe_classification').value.trim(),
  productFamily: document.getElementById('pe_product_family').value.trim(),
};
Object.assign(projectData, portfolioFields);
```

- [ ] **Step 6: Run all tests and commit**

```powershell
node --test tests/*.test.mjs
git diff --check
git add team-2/index.html team-2/js/portfolio-core.mjs tests/portfolio-core.test.mjs
git commit -m "feat: add unified portfolio project model"
```

Expected: all tests pass; commit succeeds.

### Task 3: Add Portfolio Scopes, Classification Fields, Search, and Filters

**Files:**
- Modify: `team-2/index.html`
- Modify: `tests/v2-baseline.test.mjs`

- [ ] **Step 1: Add failing structural assertions**

Append to `tests/v2-baseline.test.mjs`:

```js
test('portfolio scope and filter controls exist', () => {
  for (const id of [
    'portfolioScope',
    'projectSearch',
    'filterPm',
    'filterRag',
    'filterLifecycle',
    'filterProductFamily',
    'pe_project_level',
    'pe_lifecycle',
    'pe_project_type',
    'pe_classification',
    'pe_product_family',
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `missing #${id}`);
  }
});
```

- [ ] **Step 2: Run the structural test to verify failure**

Run:

```powershell
node --test tests/v2-baseline.test.mjs
```

Expected: FAIL with `missing #portfolioScope`.

- [ ] **Step 3: Add the scope and filter toolbar**

Add above the existing project list:

```html
<section class="portfolio-toolbar" aria-label="Project portfolio controls">
  <div class="scope-tabs" id="portfolioScope">
    <button type="button" data-scope="all">All Projects</button>
    <button type="button" data-scope="system">System Projects</button>
    <button type="button" data-scope="hardware-module">Hardware Modules</button>
  </div>
  <input id="projectSearch" class="fi" type="search" placeholder="Search name or Project ID">
  <select id="filterPm" class="fs"><option value="all">All PMs</option></select>
  <select id="filterRag" class="fs">
    <option value="all">All RAG</option>
    <option value="green">On Track</option>
    <option value="yellow">At Risk</option>
    <option value="red">Critical</option>
  </select>
  <select id="filterLifecycle" class="fs">
    <option value="all">All lifecycle</option>
    <option value="active">Active</option>
    <option value="on-hold">On Hold</option>
    <option value="completed">Completed</option>
  </select>
  <select id="filterProductFamily" class="fs"><option value="all">All product families</option></select>
</section>
```

Add the project fields to the existing project settings section:

```html
<div class="fg"><label class="fl">Project Level</label><select class="fs" id="pe_project_level"><option value="system">System</option><option value="hardware-module">Hardware Module</option></select></div>
<div class="fg"><label class="fl">Lifecycle</label><select class="fs" id="pe_lifecycle"><option value="active">Active</option><option value="on-hold">On Hold</option><option value="completed">Completed</option></select></div>
<div class="fg"><label class="fl">Project Type</label><input class="fi" id="pe_project_type"></div>
<div class="fg"><label class="fl">Classification</label><input class="fi" id="pe_classification"></div>
<div class="fg"><label class="fl">Product Family</label><input class="fi" id="pe_product_family"></div>
```

- [ ] **Step 4: Wire scope persistence and combined filtering**

Add application state:

```js
const PORTFOLIO_SCOPE_KEY = 'team2.portfolioScope';
let portfolioScope = localStorage.getItem(PORTFOLIO_SCOPE_KEY) || 'all';

function getPortfolioFilters() {
  return {
    scope: portfolioScope,
    search: document.getElementById('projectSearch').value,
    pm: document.getElementById('filterPm').value,
    rag: document.getElementById('filterRag').value,
    lifecycle: document.getElementById('filterLifecycle').value,
    productFamily: document.getElementById('filterProductFamily').value,
  };
}

function getVisibleProjects() {
  return filterProjects(projects, getPortfolioFilters());
}
```

Bind scope buttons and all filter inputs to the existing project render function. Replace only its input collection with `getVisibleProjects()`. Do not change card rendering logic except to add:

```html
<span class="project-level-badge">${project.projectLevel === 'hardware-module' ? 'Module' : 'System'}</span>
```

- [ ] **Step 5: Populate and restore editor fields**

In `openProjEdit`, set:

```js
const normalized = normalizeProject(project || {});
document.getElementById('pe_project_level').value = normalized.projectLevel;
document.getElementById('pe_lifecycle').value = normalized.lifecycle;
document.getElementById('pe_project_type').value = normalized.projectType;
document.getElementById('pe_classification').value = normalized.classification;
document.getElementById('pe_product_family').value = normalized.productFamily;
```

- [ ] **Step 6: Verify in browser**

Run a local server:

```powershell
python -m http.server 4173
```

Open `http://127.0.0.1:4173/team-2/` and verify:

- Existing login works.
- All/System/Module scope changes the visible list.
- Search and all filters combine rather than replace one another.
- Creating a project persists the five new classification fields.
- A legacy project without `projectLevel` appears as System.

- [ ] **Step 7: Run tests and commit**

```powershell
node --test tests/*.test.mjs
git diff --check
git add team-2/index.html tests/v2-baseline.test.mjs
git commit -m "feat: add portfolio scopes and filters"
```

### Task 4: Add Gantt Templates, Validation, Editing, and Rendering

**Files:**
- Modify: `team-2/js/portfolio-core.mjs`
- Modify: `tests/portfolio-core.test.mjs`
- Modify: `team-2/index.html`

- [ ] **Step 1: Write failing Gantt tests**

Append to `tests/portfolio-core.test.mjs`:

```js
import {
  createDefaultWorkstreams,
  normalizeWorkstream,
  validateWorkstreams,
} from '../team-2/js/portfolio-core.mjs';

test('project levels receive different independent Gantt templates', () => {
  const system = createDefaultWorkstreams('system');
  const module = createDefaultWorkstreams('hardware-module');
  assert.deepEqual(system.map(row => row.name), ['Design', 'Integration', 'Validation', 'Certification', 'Launch']);
  assert.deepEqual(module.map(row => row.name), ['Documentation', 'BOM Verification', 'Procurement', 'Assembly/Test', 'Certification']);
  system[0].name = 'Changed';
  assert.equal(createDefaultWorkstreams('system')[0].name, 'Design');
});

test('Gantt rejects missing names, reversed dates, and invalid progress', () => {
  const rows = [
    normalizeWorkstream({ name: '', startDate: '2026-02-10', endDate: '2026-02-01', progress: 120 }),
  ];
  assert.deepEqual(validateWorkstreams(rows), [
    { index: 0, fields: ['name', 'dateRange', 'progress'] },
  ]);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
node --test tests/portfolio-core.test.mjs
```

Expected: FAIL because the Gantt exports do not exist.

- [ ] **Step 3: Implement Gantt rules**

Append to `team-2/js/portfolio-core.mjs`:

```js
const TEMPLATE_NAMES = Object.freeze({
  system: ['Design', 'Integration', 'Validation', 'Certification', 'Launch'],
  'hardware-module': ['Documentation', 'BOM Verification', 'Procurement', 'Assembly/Test', 'Certification'],
});

export function normalizeWorkstream(source = {}, index = 0) {
  return {
    id: text(source.id) || `ws-${Date.now()}-${index}`,
    name: text(source.name),
    startDate: text(source.startDate),
    endDate: text(source.endDate),
    status: ['not-started', 'on-track', 'at-risk', 'delayed', 'completed'].includes(source.status)
      ? source.status
      : 'not-started',
    progress: Number.isFinite(Number(source.progress)) ? Number(source.progress) : 0,
    milestoneId: text(source.milestoneId),
    sortOrder: Number.isFinite(Number(source.sortOrder)) ? Number(source.sortOrder) : index,
  };
}

export function createDefaultWorkstreams(projectLevel) {
  const names = TEMPLATE_NAMES[projectLevel] || TEMPLATE_NAMES.system;
  return names.map((name, index) => normalizeWorkstream({ name, sortOrder: index }, index));
}

export function validateWorkstreams(rows) {
  return rows.map((row, index) => {
    const fields = [];
    if (!text(row.name)) fields.push('name');
    if (row.startDate && row.endDate && row.startDate > row.endDate) fields.push('dateRange');
    if (row.progress < 0 || row.progress > 100) fields.push('progress');
    return { index, fields };
  }).filter(result => result.fields.length);
}
```

- [ ] **Step 4: Run Gantt tests**

Run:

```powershell
node --test tests/portfolio-core.test.mjs
```

Expected: all portfolio tests pass.

- [ ] **Step 5: Add Schedule editor markup and rendering**

Add a Schedule section in the existing project editor containing:

```html
<section id="ganttEditorSection">
  <div class="section-heading">
    <label class="fl">Schedule Workstreams</label>
    <button class="btn btn-ghost" type="button" onclick="addGanttRow()">+ Add Workstream</button>
  </div>
  <div id="ganttEditorRows"></div>
</section>
```

Add a Schedule section in project detail:

```html
<section class="project-schedule">
  <div class="schedule-toolbar">
    <button type="button" data-scale="week">Week</button>
    <button type="button" data-scale="month">Month</button>
  </div>
  <div id="pd_gantt" class="gantt-chart"></div>
</section>
```

Implement `renderGanttEditor`, `addGanttRow`, `removeGanttRow`, `moveGanttRow`, and `collectGanttRows` in the existing inline module. Each editor row must render actual inputs for the fields defined by `normalizeWorkstream`. Escape user-entered labels with the application's existing HTML escape helper before inserting them.

- [ ] **Step 6: Initialize, validate, and save schedules**

When creating a project:

```js
const initialRows = createDefaultWorkstreams(
  document.getElementById('pe_project_level').value
);
renderGanttEditor(initialRows);
```

Before save:

```js
const ganttWorkstreams = collectGanttRows().map(normalizeWorkstream);
const ganttErrors = validateWorkstreams(ganttWorkstreams);
if (ganttErrors.length) {
  showSaveToast('Fix highlighted schedule fields before saving');
  renderGanttErrors(ganttErrors);
  return;
}
projectData.ganttWorkstreams = ganttWorkstreams;
```

Render the detail Gantt using date arithmetic against the earliest start and latest end. Render workstream bars, status color, percentage, linked milestone markers, and Today line. Week/Month controls change tick density only; they do not mutate stored dates.

- [ ] **Step 7: Verify Gantt behavior**

On the local Team 2 page verify:

- System and Module projects receive their respective templates.
- Renaming, adding, deleting, and reordering rows survives reload.
- Reversed dates and progress outside 0–100 block save.
- Week/Month changes scale without changing data.
- Existing milestone dates remain authoritative when a marker is linked.

- [ ] **Step 8: Run tests and commit**

```powershell
node --test tests/*.test.mjs
git diff --check
git add team-2/index.html team-2/js/portfolio-core.mjs tests/portfolio-core.test.mjs
git commit -m "feat: add editable project Gantt schedules"
```

### Task 5: Add Resource Estimate, Optional Actual, and Remaining Rules

**Files:**
- Modify: `team-2/js/portfolio-core.mjs`
- Modify: `tests/portfolio-core.test.mjs`
- Modify: `team-2/index.html`

- [ ] **Step 1: Write failing resource tests**

Append to `tests/portfolio-core.test.mjs`:

```js
import { normalizeResourceEntry } from '../team-2/js/portfolio-core.mjs';

test('resource remaining is unavailable without actual hours', () => {
  assert.deepEqual(normalizeResourceEntry({ estimated: 800, actual: '' }), {
    estimated: 800,
    actual: null,
    remaining: null,
    updatedAt: '',
  });
});

test('resource remaining never becomes negative', () => {
  assert.equal(normalizeResourceEntry({ estimated: 100, actual: 120 }).remaining, 0);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
node --test tests/portfolio-core.test.mjs
```

Expected: FAIL because `normalizeResourceEntry` is not exported.

- [ ] **Step 3: Implement resource normalization**

Append to `team-2/js/portfolio-core.mjs`:

```js
const optionalNumber = value =>
  value === '' || value === null || value === undefined || Number.isNaN(Number(value))
    ? null
    : Number(value);

export function normalizeResourceEntry(source = {}) {
  const estimated = Math.max(0, optionalNumber(source.estimated) ?? 0);
  const actual = optionalNumber(source.actual);
  return {
    estimated,
    actual: actual === null ? null : Math.max(0, actual),
    remaining: actual === null ? null : Math.max(estimated - Math.max(0, actual), 0),
    updatedAt: text(source.updatedAt),
  };
}
```

- [ ] **Step 4: Run resource tests**

Run:

```powershell
node --test tests/portfolio-core.test.mjs
```

Expected: all tests pass.

- [ ] **Step 5: Add resource editor and detail table**

Use the fixed discipline keys `hardware`, `firmware`, `systemElectrical`, `mechanical`, and `pmo`. For each discipline render Estimated and optional Actual number inputs. On save normalize entries and stamp `updatedAt` only for disciplines changed in this edit:

```js
projectData.resources = Object.fromEntries(
  RESOURCE_DISCIPLINES.map(({ key }) => [
    key,
    normalizeResourceEntry({
      estimated: document.getElementById(`resource_${key}_estimated`).value,
      actual: document.getElementById(`resource_${key}_actual`).value,
      updatedAt: resourceChanged(key)
        ? new Date().toISOString()
        : currentProject.resources?.[key]?.updatedAt || '',
    }),
  ])
);
```

The detail view displays `— Not updated` for null Actual and Remaining. It must not substitute zero or change RAG.

- [ ] **Step 6: Verify role and stale-data behavior**

Verify:

- PM can edit resources only on owned projects.
- Admin can edit all resources.
- VIP sees values but no inputs.
- Blank Actual remains blank after reload.
- Entering Actual calculates Remaining.
- Resource freshness does not alter project RAG.

- [ ] **Step 7: Run tests and commit**

```powershell
node --test tests/*.test.mjs
git diff --check
git add team-2/index.html team-2/js/portfolio-core.mjs tests/portfolio-core.test.mjs
git commit -m "feat: add optional actual resource tracking"
```

### Task 6: Add the Generated One-Page Project Status View

**Files:**
- Modify: `team-2/index.html`
- Modify: `tests/v2-baseline.test.mjs`

- [ ] **Step 1: Add a failing structural test**

Append to `tests/v2-baseline.test.mjs`:

```js
test('one-page project status view is present', () => {
  assert.match(html, /id=["']onePageStatusModal["']/);
  assert.match(html, /function renderOnePageStatus\(/);
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```powershell
node --test tests/v2-baseline.test.mjs
```

Expected: FAIL because the modal is absent.

- [ ] **Step 3: Add the one-page modal**

Add:

```html
<div class="modal-overlay" id="onePageStatusModal" role="dialog" aria-modal="true" aria-labelledby="onePageTitle">
  <article class="one-page-status">
    <header><h2 id="onePageTitle"></h2><div id="onePagePm"></div></header>
    <section id="onePageAccomplishments"></section>
    <section id="onePageFutureActivities"></section>
    <section id="onePageGantt"></section>
    <section id="onePageRisks"></section>
    <section id="onePageMitigations"></section>
    <footer id="onePageStatusDate"></footer>
  </article>
</div>
```

Add a `One-page Status` button to project detail for all roles.

- [ ] **Step 4: Render from the existing project record**

Implement:

```js
function renderOnePageStatus(project) {
  const normalized = normalizeProject(project);
  document.getElementById('onePageTitle').textContent = normalized.name || normalized.code;
  document.getElementById('onePagePm').textContent = `Project Manager: ${normalized.pm || 'Unassigned'}`;
  renderBulletContent('onePageAccomplishments', 'Accomplishments', normalized.accomplishments);
  renderBulletContent('onePageFutureActivities', 'Future Activities', normalized.futureActivities);
  renderGanttChart(document.getElementById('onePageGantt'), normalized.ganttWorkstreams, 'week');
  renderRiskActionColumns(normalized, 'onePageRisks', 'onePageMitigations');
  document.getElementById('onePageStatusDate').textContent =
    `Status date: ${normalized.updatedAt?.toDate?.()?.toLocaleDateString() || new Date().toLocaleDateString()}`;
}
```

Reuse the same escaped content, Gantt, and risk/action rendering helpers as project detail. Do not create separate editable one-page fields.

- [ ] **Step 5: Verify one-page layout**

At desktop width verify both project levels show title, PM, accomplishments, future activities, Gantt, risks, mitigations, and date without horizontal overflow. Verify VIP can open but cannot edit.

- [ ] **Step 6: Run tests and commit**

```powershell
node --test tests/*.test.mjs
git diff --check
git add team-2/index.html tests/v2-baseline.test.mjs
git commit -m "feat: add one-page project status view"
```

### Task 7: Build the Admin-Only Excel Dry-Run and Validation Pipeline

**Files:**
- Create: `team-2/js/excel-import.mjs`
- Create: `tests/excel-import.test.mjs`
- Add: `team-2/vendor/xlsx.full.min.js`
- Modify: `team-2/index.html`

- [ ] **Step 1: Write failing import tests**

Create `tests/excel-import.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeExcelRow, planImport } from '../team-2/js/excel-import.mjs';

test('Excel N/A, blanks, and formula errors normalize safely', () => {
  const result = normalizeExcelRow({
    'Project Name': ' P60U ',
    PMO: 'N/A',
    'Hard. Hours': 800,
    'Firm. Hours': '#DIV/0!',
  }, 2);
  assert.equal(result.project.name, 'P60U');
  assert.equal(result.project.pm, '');
  assert.equal(result.project.resources.hardware.estimated, 800);
  assert.equal(result.project.resources.firmware.estimated, 0);
  assert.ok(result.warnings.some(item => item.field === 'Firm. Hours'));
});

test('missing names and duplicate IDs do not enter the write set', () => {
  const rows = [
    { 'Project ID': 'MOD-1', 'Project Name': 'Existing' },
    { 'Project ID': 'MOD-1', 'Project Name': 'Duplicate' },
    { 'Project ID': 'MOD-2', 'Project Name': '' },
  ];
  const plan = planImport(rows, new Set(['MOD-1']));
  assert.equal(plan.ready.length, 0);
  assert.equal(plan.skipped.length, 2);
  assert.equal(plan.failed.length, 1);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
node --test tests/excel-import.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement import normalization**

Create `team-2/js/excel-import.mjs`:

```js
const clean = value => {
  const result = (value ?? '').toString().trim();
  return !result || /^n\/a$/i.test(result) ? '' : result;
};

const hours = (value, field, warnings) => {
  if (value === '' || value === null || value === undefined) return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    warnings.push({ field, message: 'Invalid hours replaced with 0' });
    return 0;
  }
  return parsed;
};

export function normalizeExcelRow(row, rowNumber) {
  const warnings = [];
  const projectId = clean(row['Project ID'] ?? row['Project Code']);
  const name = clean(row['Project Name']);
  const entry = field => ({ estimated: hours(row[field], field, warnings), actual: null, remaining: null, updatedAt: '' });
  return {
    rowNumber,
    warnings,
    project: {
      code: projectId,
      name,
      projectLevel: clean(row['Project Level']) === 'System' ? 'system' : 'hardware-module',
      lifecycle: 'active',
      projectType: clean(row.Type),
      classification: clean(row['Project Classification']),
      productFamily: clean(row['Product Family']),
      pm: clean(row.PMO),
      piiMysVolume: hours(row['PII MYS Volume'], 'PII MYS Volume', warnings),
      leads: {
        mechanical: clean(row['Lead Mechanical Eng.']),
        systemElectrical: clean(row['Lead Elec/Sys Engineer']),
        firmware: clean(row['Lead Firmware Eng.']),
        hardware: clean(row['Lead Hardware Eng.']),
      },
      resources: {
        hardware: entry('Hard. Hours'),
        firmware: entry('Firm. Hours'),
        systemElectrical: entry('Sys. Hours'),
        mechanical: entry('Mech. Hours'),
        pmo: entry('PMO Hours'),
      },
    },
  };
}

export function planImport(rows, existingIds = new Set()) {
  const ready = [];
  const skipped = [];
  const failed = [];
  const seen = new Set();
  rows.forEach((row, index) => {
    const result = normalizeExcelRow(row, index + 2);
    const id = result.project.code;
    if (!result.project.name) {
      failed.push({ ...result, reason: 'Project Name is required' });
    } else if (!id) {
      failed.push({ ...result, reason: 'Project ID is required' });
    } else if (existingIds.has(id) || seen.has(id)) {
      skipped.push({ ...result, reason: 'Project ID already exists' });
    } else {
      seen.add(id);
      ready.push(result);
    }
  });
  return { ready, skipped, failed };
}
```

- [ ] **Step 4: Run import tests**

Run:

```powershell
node --test tests/excel-import.test.mjs
```

Expected: 2 tests pass.

- [ ] **Step 5: Pin and record SheetJS 0.20.3**

Download the fixed SheetJS Community Edition 0.20.3 browser build and record its SHA-256:

```powershell
New-Item -ItemType Directory -Force team-2/vendor
Invoke-WebRequest 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js' -OutFile 'team-2/vendor/xlsx.full.min.js'
Get-FileHash team-2/vendor/xlsx.full.min.js -Algorithm SHA256
```

Add the local script before the application module:

```html
<script src="./vendor/xlsx.full.min.js"></script>
```

The runbook must record version `0.20.3`, the source URL above, and the hash printed by `Get-FileHash`.

- [ ] **Step 6: Add admin-only import UI and dry run**

Add an Admin-only `Import Excel` button and modal with file input, preview table, counts, warning/error details, `Confirm Import`, and `Cancel`. For non-admin roles, do not merely disable the button; keep it hidden and reject calls in the handler:

```js
if (currentRole !== 'admin') throw new Error('Admin role required');
```

Parse the first selected worksheet:

```js
const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {
  defval: '',
  raw: true,
});
pendingImportPlan = planImport(rows, new Set(projects.map(project => project.code)));
renderImportPreview(pendingImportPlan);
```

No Firestore call is permitted in file selection or preview handlers.

- [ ] **Step 7: Verify dry-run behavior**

Verify as Admin that a workbook produces ready/skipped/failed counts and row reasons. Verify Firebase receives no writes before confirmation. Verify PM and VIP cannot see or invoke import.

- [ ] **Step 8: Run tests and commit**

```powershell
node --test tests/*.test.mjs
git diff --check
git add team-2/index.html team-2/js/excel-import.mjs team-2/vendor/xlsx.full.min.js tests/excel-import.test.mjs
git commit -m "feat: add admin Excel import dry run"
```

### Task 8: Add Confirmed Firebase Import, Results, and Migration Runbook

**Files:**
- Modify: `team-2/index.html`
- Modify: `tests/excel-import.test.mjs`
- Create: `docs/migration/team-2-excel-import-runbook.md`

- [ ] **Step 1: Add a failing import-batch test**

Append to `tests/excel-import.test.mjs`:

```js
import { chunkForWrites } from '../team-2/js/excel-import.mjs';

test('confirmed imports are chunked below the Firestore batch limit', () => {
  const rows = Array.from({ length: 901 }, (_, index) => ({ project: { code: `P-${index}` } }));
  assert.deepEqual(chunkForWrites(rows, 400).map(chunk => chunk.length), [400, 400, 101]);
});
```

- [ ] **Step 2: Implement safe chunking**

Append to `team-2/js/excel-import.mjs`:

```js
export function chunkForWrites(rows, size = 400) {
  if (!Number.isInteger(size) || size < 1 || size > 500) throw new RangeError('Invalid Firestore chunk size');
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}
```

- [ ] **Step 3: Run import tests**

Run:

```powershell
node --test tests/excel-import.test.mjs
```

Expected: all import tests pass.

- [ ] **Step 4: Implement explicit confirmation and per-row results**

Import Firestore `writeBatch` if not already available. In the Confirm handler:

1. Require Admin.
2. Require a non-empty `pendingImportPlan.ready`.
3. Show the exact ready/skipped/failed counts.
4. Require a second confirmation.
5. Process `chunkForWrites(pendingImportPlan.ready, 400)`.
6. Use the Project ID as the Firestore document ID.
7. Add `createdAt`, `updatedAt`, and `importSource: 'excel-one-time'`.
8. Record successful IDs only after each batch commit resolves.
9. Stop on a failed batch and leave uncommitted chunks listed as failed.

The write payload is:

```js
const payload = cleanFirestoreData({
  ...normalizeProject(item.project),
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  importSource: 'excel-one-time',
});
```

Display a downloadable CSV result assembled in memory with columns `rowNumber,projectId,status,reason`. Do not automatically retry failed rows.

- [ ] **Step 5: Write the migration runbook**

Create `docs/migration/team-2-excel-import-runbook.md` containing these mandatory gates:

```markdown
# Team 2 One-Time Excel Migration Runbook

1. Confirm UAT URL ends in `/team-2/` and displays `v2.0T-portfolio`.
2. Export or back up the current Firestore `projects` collection.
3. Record workbook filename, worksheet, row count, operator, and SHA-256.
4. Run Preview; do not continue with failed rows.
5. Reconcile ready + skipped + failed against worksheet data rows.
6. Confirm import and save the result CSV.
7. Compare imported IDs, PMs, project levels, classifications, leads, and resource estimates against the workbook.
8. Spot-check one System and one Hardware Module project in detail and Overview.
9. Roll back only imported documents whose `importSource` equals `excel-one-time` and whose IDs appear in the saved result CSV.
10. After sign-off, treat Dashboard as the system of record and archive the migration workbook read-only.
```

- [ ] **Step 6: Verify a controlled UAT import**

Use a copy of the workbook containing two uniquely prefixed test rows. Confirm preview, import, result CSV, detail display, and cleanup by exact IDs. Do not use production Project IDs for this test.

- [ ] **Step 7: Run tests and commit**

```powershell
node --test tests/*.test.mjs
git diff --check
git add team-2/index.html team-2/js/excel-import.mjs tests/excel-import.test.mjs docs/migration/team-2-excel-import-runbook.md
git commit -m "feat: complete confirmed Excel migration flow"
```

### Task 9: Make Overview Scope-Aware Without Redesigning It

**Files:**
- Modify: `team-2/index.html`
- Modify: `tests/v2-baseline.test.mjs`

- [ ] **Step 1: Add failing Overview scope assertions**

Append to `tests/v2-baseline.test.mjs`:

```js
test('Overview has a persisted three-way scope switch', () => {
  assert.match(html, /id=["']overviewScope["']/);
  assert.match(html, /team2\.overviewScope/);
  assert.match(html, /System Projects/);
  assert.match(html, /Hardware Modules/);
  assert.match(html, /All Projects/);
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```powershell
node --test tests/v2-baseline.test.mjs
```

Expected: FAIL with missing `overviewScope`.

- [ ] **Step 3: Add the Overview scope control**

Place this control in the existing Overview header without moving existing KPI, risk/action, or milestone sections:

```html
<div class="scope-tabs overview-scope" id="overviewScope">
  <button type="button" data-overview-scope="system">System Projects</button>
  <button type="button" data-overview-scope="hardware-module">Hardware Modules</button>
  <button type="button" data-overview-scope="all">All Projects</button>
</div>
```

- [ ] **Step 4: Route all Overview calculations through one scoped collection**

Add:

```js
const OVERVIEW_SCOPE_KEY = 'team2.overviewScope';
let overviewScope = localStorage.getItem(OVERVIEW_SCOPE_KEY) || 'system';

function getOverviewProjects() {
  return filterProjects(projects, { scope: overviewScope });
}
```

At the start of the existing Overview render function:

```js
const overviewProjects = getOverviewProjects();
```

Pass `overviewProjects`—not the global `projects` array—to every existing KPI, RAG, risk/action, and milestone calculation. Do not copy calculation logic into scope handlers.

- [ ] **Step 5: Add level badges only in mixed scope**

When `overviewScope === 'all'`, add the same System/Module badge beside project names in Overview risk and milestone items. Do not add badges in single-level scopes.

- [ ] **Step 6: Verify unchanged executive layout**

Capture screenshots at the same desktop viewport for:

- v2.0T baseline Overview
- New System scope
- New Module scope
- New All scope

Confirm the System scope preserves the baseline component order and widths. Confirm each scope changes KPI, RAG, risk/action, and milestone data together.

- [ ] **Step 7: Run tests and commit**

```powershell
node --test tests/*.test.mjs
git diff --check
git add team-2/index.html tests/v2-baseline.test.mjs
git commit -m "feat: add Overview project scope switch"
```

### Task 10: Final Role, Regression, Visual, and UAT Verification

**Files:**
- Modify if defects are found: `team-2/index.html`
- Modify if defects are found: `team-2/js/portfolio-core.mjs`
- Modify if defects are found: `team-2/js/excel-import.mjs`
- Modify if defects are found: `tests/*.test.mjs`

- [ ] **Step 1: Run the complete automated suite**

Run:

```powershell
node --test tests/*.test.mjs
git diff --check
git status --short
```

Expected: all tests pass; no whitespace errors; only intentional files are modified.

- [ ] **Step 2: Run Admin acceptance**

Verify Admin can:

- Switch All/System/Module portfolio scopes.
- Combine search, PM, RAG, lifecycle, and family filters.
- Create both project levels with correct Gantt templates.
- Edit any Summary, Schedule, Resources, and project settings.
- Preview Excel with no writes, confirm import, and obtain result CSV.
- Switch Overview among all three scopes.

- [ ] **Step 3: Run PM acceptance**

Verify PM can:

- Edit owned projects and cannot edit projects owned by another PM.
- Edit Gantt and optional Actual values for owned projects.
- Leave Actual blank without validation failure.
- Open One-page Status.
- Neither see nor invoke Excel import.

- [ ] **Step 4: Run VIP acceptance**

Verify VIP can:

- View permitted portfolio and Overview scopes.
- Open project detail and One-page Status.
- Not create, edit, delete, import, or mutate schedule/resources.

- [ ] **Step 5: Run v2.0T regression**

Verify unchanged behavior for:

- Login, logout, password reset, and idle timeout.
- Realtime project loading and week navigation.
- Weekly update editing and Copilot prompt/summary flow.
- Existing milestones and quarterly milestones.
- Risk/action pairs.
- VIP Preview.
- Presence/usage functions present in the baseline.

- [ ] **Step 6: Verify failure handling**

Using browser network controls, force a Firestore write failure. Confirm the form remains populated, the UI displays failure, and no success toast appears. Verify reversed Gantt dates block save and malformed Excel rows appear in failed/skipped results.

- [ ] **Step 7: Commit any verification fixes**

If verification required fixes:

```powershell
git add team-2/index.html team-2/js tests
git commit -m "fix: address portfolio UAT findings"
```

If no fixes were required, do not create an empty commit.

- [ ] **Step 8: Produce the UAT handoff**

Record:

- Branch and final commit.
- Exact UAT URL.
- Automated test output.
- Roles tested.
- Excel dry-run/import evidence.
- Known limitations: no system-module relationships, no ongoing Excel sync, no task dependencies/critical path, and optional Actual hours.

Do not deploy to production or import the full workbook until the user explicitly approves the UAT result.
