# Executive Progress, Resource Analytics, and PDF Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add simplified executive progress editing, role-driven hours, management resource analytics, and selective Overview PDF export without breaking shared v2.0/v2.0T Firebase data.

**Architecture:** Keep calculations in focused ES modules and leave `team-2/index.html` responsible for DOM rendering and event wiring. New stored fields are optional keyed objects; all normalizers accept legacy data and preserve unknown fields.

**Tech Stack:** Static HTML/CSS, browser JavaScript ES modules, Firebase Firestore, Node.js built-in test runner.

---

### Task 1: Executive category progress and completed-state rules

**Files:**
- Modify: `team-2/js/executive-outcomes.mjs`
- Create: `tests/executive-category-progress.test.mjs`
- Modify: `tests/executive-outcome-ui.test.mjs`
- Modify: `team-2/index.html`

- [ ] **Step 1: Write failing category calculation tests**

```js
import {
  calculateExecutiveCategory,
  executiveOutcomeStatusLabel,
  normalizeExecutiveCategoryOverride,
} from '../team-2/js/executive-outcomes.mjs';

test('category averages valid outcomes and uses worst health', () => {
  const result = calculateExecutiveCategory([
    { progress: 100, health: 'green' },
    { progress: 50, health: 'yellow' },
  ]);
  assert.equal(result.progress, 75);
  assert.equal(result.health, 'yellow');
  assert.equal(result.status, 'at-risk');
});

test('100 percent is achieved regardless of manual on-track label', () => {
  assert.equal(executiveOutcomeStatusLabel(100, 'green'), 'Achieved / Done');
});

test('override requires a reason and can be removed', () => {
  assert.deepEqual(normalizeExecutiveCategoryOverride({
    enabled: true, progress: 75, health: 'at-risk', reason: 'Board commitment',
  }), {
    enabled: true, progress: 75, health: 'at-risk', reason: 'Board commitment',
  });
  assert.equal(normalizeExecutiveCategoryOverride({ enabled: false }).enabled, false);
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test tests/executive-category-progress.test.mjs`  
Expected: FAIL because the new exports do not exist.

- [ ] **Step 3: Implement category calculations**

Add exports with these contracts:

```js
export function executiveOutcomeStatusLabel(progress, health) {
  if (progress === 100) return 'Achieved / Done';
  if (health === 'red') return 'Delayed';
  if (health === 'yellow') return 'At Risk';
  return 'On Track';
}

export function normalizeExecutiveCategoryOverride(source = {}) {
  const progress = Number(source.progress);
  return {
    enabled: source.enabled === true && String(source.reason || '').trim().length > 0,
    progress: PROGRESS_LEVELS.has(progress) ? progress : 0,
    health: HEALTH_LEVELS.has(source.health) ? source.health : 'on-track',
    reason: String(source.reason || '').trim(),
  };
}

export function calculateExecutiveCategory(outcomes = [], override = {}) {
  const valid = outcomes.filter(item => Number.isFinite(item.progress));
  const automaticProgress = valid.length
    ? Math.round(valid.reduce((sum, item) => sum + item.progress, 0) / valid.length)
    : null;
  const automaticHealth = valid.some(item => item.health === 'red')
    ? 'red'
    : valid.some(item => item.health === 'yellow') ? 'yellow' : 'green';
  const manual = normalizeExecutiveCategoryOverride(override);
  const progress = manual.enabled ? manual.progress : automaticProgress;
  const health = manual.enabled
    ? displayHealth(manual.health)
    : automaticHealth;
  return {
    progress,
    health,
    status: progress === 100 ? 'done' : health === 'red' ? 'delayed' : health === 'yellow' ? 'at-risk' : 'on-track',
    overridden: manual.enabled,
    reason: manual.enabled ? manual.reason : '',
  };
}
```

- [ ] **Step 4: Replace the executive editor with category disclosure UI**

In `team-2/index.html`:

- render three fixed category summary cards;
- render category disclosure sections with Q1–Q4 tab buttons;
- render only the selected quarter’s outcome rows;
- replace progress `<select>` with segmented 0/25/50/75/100 buttons backed by a hidden numeric input;
- move evidence controls into a collapsible secondary panel;
- store category overrides under `executiveMilestoneTimeline.categoryOverrides.<categoryKey>`;
- validate an override reason before save;
- preserve stable outcome IDs and source maps.

Progress display must use:

```html
<span class="exec-outcome-progress-track">
  <span class="exec-outcome-progress-fill" style="width:${progress}%"></span>
</span>
```

The track remains gray and `.exec-outcome-progress-fill` remains green for every RAG state.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --test tests/executive-category-progress.test.mjs tests/executive-outcomes.test.mjs tests/executive-outcome-ui.test.mjs`  
Expected: all tests pass.

- [ ] **Step 6: Commit**

```powershell
git add team-2/js/executive-outcomes.mjs team-2/index.html tests/executive-category-progress.test.mjs tests/executive-outcome-ui.test.mjs
git commit -m "feat: simplify executive progress editing"
```

### Task 2: Software project level and role-driven Discipline Hours

**Files:**
- Modify: `team-2/js/portfolio-core.mjs`
- Create: `team-2/js/resource-analytics.mjs`
- Create: `tests/resource-analytics.test.mjs`
- Modify: `tests/portfolio-core.test.mjs`
- Modify: `team-2/index.html`

- [ ] **Step 1: Write failing project-level and discipline tests**

```js
import {
  buildDisciplineHourRows,
  normalizeDisciplineKey,
} from '../team-2/js/resource-analytics.mjs';
import { normalizeProject, PROJECT_LEVEL } from '../team-2/js/portfolio-core.mjs';

test('Software is a supported project level', () => {
  assert.equal(normalizeProject({ projectLevel: 'software' }).projectLevel, PROJECT_LEVEL.SOFTWARE);
});

test('discipline rows follow unique allocation roles and preserve hours', () => {
  const rows = buildDisciplineHourRows(
    [
      { name: 'A', role: 'Software Engineer', effort: 50 },
      { name: 'B', role: 'software engineer', effort: 80 },
      { name: 'C', role: 'TPO', effort: 100 },
    ],
    {
      [normalizeDisciplineKey('Software Engineer')]: { estimated: 320, actual: 120 },
    },
  );
  assert.deepEqual(rows.map(row => row.label), ['Software Engineer', 'TPO']);
  assert.equal(rows[0].estimated, 320);
});

test('no allocation produces no discipline rows', () => {
  assert.deepEqual(buildDisciplineHourRows([], {}), []);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/resource-analytics.test.mjs tests/portfolio-core.test.mjs`  
Expected: FAIL because Software and the resource module do not exist.

- [ ] **Step 3: Add Software to portfolio core**

```js
export const PROJECT_LEVEL = Object.freeze({
  SYSTEM: 'system',
  HARDWARE_MODULE: 'hardware-module',
  SOFTWARE: 'software',
});

const PROJECT_LEVELS = new Set(Object.values(PROJECT_LEVEL));
```

Update badge and scope helpers to return `Software` for the new value without changing legacy defaults.

- [ ] **Step 4: Implement role-driven hour rows**

Create `team-2/js/resource-analytics.mjs`:

```js
export function normalizeDisciplineKey(value) {
  return String(value || '').trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function buildDisciplineHourRows(members = [], existing = {}) {
  const seen = new Set();
  return members.reduce((rows, member) => {
    const label = String(member.role || '').trim();
    const key = normalizeDisciplineKey(label);
    if (!key || seen.has(key)) return rows;
    seen.add(key);
    const saved = existing[key] || {};
    rows.push({
      key,
      label,
      estimated: Number(saved.estimated || 0),
      actual: saved.actual === '' || saved.actual == null ? '' : Number(saved.actual),
    });
    return rows;
  }, []);
}
```

- [ ] **Step 5: Wire dynamic Discipline Hours**

In `team-2/index.html`:

- add Software to the Project Level selector and Overview scope;
- replace the five fixed hour rows with an empty `#disciplineHoursSection` container;
- rebuild rows whenever Team Effort members change;
- hide the section when members are empty or “No allocation required” is checked;
- collect values into a keyed `disciplineHours` object;
- validate estimated hours only for rendered rows.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `node --test tests/resource-analytics.test.mjs tests/portfolio-core.test.mjs tests/project-editor-guidance.test.mjs`  
Expected: all tests pass.

- [ ] **Step 7: Commit**

```powershell
git add team-2/js/portfolio-core.mjs team-2/js/resource-analytics.mjs team-2/index.html tests/resource-analytics.test.mjs tests/portfolio-core.test.mjs
git commit -m "feat: drive project hours from team roles"
```

### Task 3: Management resource analytics

**Files:**
- Modify: `team-2/js/resource-analytics.mjs`
- Modify: `tests/resource-analytics.test.mjs`
- Modify: `team-2/index.html`
- Modify: `tests/v2-baseline.test.mjs`

- [ ] **Step 1: Add failing aggregation tests**

```js
import { buildResourceAnalytics } from '../team-2/js/resource-analytics.mjs';

test('resource analytics aggregate FTE, coverage, overload and project levels', () => {
  const result = buildResourceAnalytics([
    {
      code: 'SYS-1',
      projectLevel: 'system',
      teamMembers: [
        { name: 'Alex', role: 'System Engineer', effort: 80 },
        { name: 'Sam', role: 'PM', effort: 50 },
      ],
      dataStatus: { team: { state: 'confirmed' } },
    },
    {
      code: 'SW-1',
      projectLevel: 'software',
      teamMembers: [{ name: 'Alex', role: 'Software Engineer', effort: 40 }],
      dataStatus: { team: { state: 'confirmed' } },
    },
  ]);
  assert.equal(result.totalAllocatedFte, 1.7);
  assert.equal(result.overallocatedPeople, 1);
  assert.equal(result.projectLevels.system, 1.3);
  assert.equal(result.projectLevels.software, 0.4);
});
```

- [ ] **Step 2: Run test and verify RED**

Run: `node --test tests/resource-analytics.test.mjs`  
Expected: FAIL because `buildResourceAnalytics` is not exported.

- [ ] **Step 3: Implement resource aggregation**

`buildResourceAnalytics(projects)` must:

- include confirmed allocation only;
- normalize names and roles case-insensitively;
- calculate assignment FTE as `effort / 100`;
- calculate available capacity as `max(0, 1 - personTotalFte)`;
- count people over 1 FTE;
- aggregate FTE by Project Level;
- aggregate each Role across Project Levels;
- return a coverage object with confirmed, not-required, pending, total, and percentage.

- [ ] **Step 4: Replace Overview member list**

In `renderResourceBudgetOverview`:

- render Resource Analytics and Budget as two separate sections;
- remove all member names;
- render Total Allocated FTE, Allocation Coverage, Overallocated People, and Available Capacity;
- render a CSS conic-gradient donut for Project Level;
- render stacked bars for Function Mix;
- show explanatory empty states when no confirmed allocation exists.

Move `${renderResourceBudgetOverview(projs)}` to the end of Overview after the project portfolio.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `node --test tests/resource-analytics.test.mjs tests/v2-baseline.test.mjs tests/team-effort-card.test.mjs`  
Expected: all tests pass.

- [ ] **Step 6: Commit**

```powershell
git add team-2/js/resource-analytics.mjs team-2/index.html tests/resource-analytics.test.mjs tests/v2-baseline.test.mjs
git commit -m "feat: add management resource analytics"
```

### Task 4: Selective Overview PDF export

**Files:**
- Create: `team-2/js/print-selection.mjs`
- Create: `tests/print-selection.test.mjs`
- Modify: `team-2/index.html`
- Create: `tests/overview-print-selection-ui.test.mjs`

- [ ] **Step 1: Write failing preset and validation tests**

```js
import {
  PRINT_SECTION_IDS,
  applyPrintPreset,
  validatePrintSelection,
} from '../team-2/js/print-selection.mjs';

test('All selects every Overview section', () => {
  assert.deepEqual(applyPrintPreset('all'), PRINT_SECTION_IDS);
});

test('Resource and Budget selects only the last two sections', () => {
  assert.deepEqual(applyPrintPreset('resource-budget'), ['resource-analytics', 'budget']);
});

test('at least one section is required', () => {
  assert.equal(validatePrintSelection([]).valid, false);
  assert.equal(validatePrintSelection(['attention-matrix']).valid, true);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/print-selection.test.mjs`  
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement selection helpers**

```js
export const PRINT_SECTION_IDS = Object.freeze([
  'executive-summary',
  'attention-matrix',
  'executive-timeline',
  'quarterly-kpi',
  'project-roadmap',
  'project-portfolio',
  'resource-analytics',
  'budget',
]);

const PRESETS = Object.freeze({
  all: PRINT_SECTION_IDS,
  executive: ['executive-summary', 'attention-matrix', 'project-portfolio'],
  roadmap: ['executive-timeline', 'quarterly-kpi', 'project-roadmap'],
  'resource-budget': ['resource-analytics', 'budget'],
});

export function applyPrintPreset(name) {
  return [...(PRESETS[name] || [])];
}

export function validatePrintSelection(selected = []) {
  const sections = selected.filter(id => PRINT_SECTION_IDS.includes(id));
  return { valid: sections.length > 0, sections };
}
```

- [ ] **Step 4: Add the Overview print dialog**

In `team-2/index.html`:

- replace direct `window.print()` with `openOverviewPrintDialog()`;
- render preset buttons and individual checkboxes;
- default to All;
- attach `data-print-section` to every Overview report block;
- before printing, add `.print-excluded` only to unselected sections;
- call `window.print()`;
- clear `.print-excluded` on `afterprint`, modal close, and print cancellation;
- keep non-Overview pages on the existing direct print behavior.

Add print CSS:

```css
@media print {
  [data-print-section].print-excluded { display:none !important; }
}
```

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --test tests/print-selection.test.mjs tests/overview-print-selection-ui.test.mjs`  
Expected: all tests pass.

- [ ] **Step 6: Commit**

```powershell
git add team-2/js/print-selection.mjs team-2/index.html tests/print-selection.test.mjs tests/overview-print-selection-ui.test.mjs
git commit -m "feat: select Overview sections for PDF"
```

### Task 5: Compatibility and local acceptance

**Files:**
- Modify: `team-2/write-sync.test.mjs`
- Modify: `tests/v2-baseline.test.mjs`

- [ ] **Step 1: Add compatibility assertions**

Assert that:

- category overrides serialize as keyed objects;
- no Firestore nested arrays are introduced;
- unknown executive timeline and project fields survive save merges;
- legacy project levels default to System;
- text-only executive outcomes still render.

- [ ] **Step 2: Run the complete test suite**

Run: `node --test tests/*.test.mjs team-2/*.test.mjs`  
Expected: every test passes.

- [ ] **Step 3: Run local browser acceptance**

At `http://127.0.0.1:4173/team-2/`, verify:

1. Executive Timeline uses category summary cards and quarter disclosure.
2. 100% bars are fully green and show Achieved / Done.
3. Dynamic Discipline Hours follow Team Effort roles and disappear without allocation.
4. Software projects appear in selectors, badges, scope, donut, and stacked bars.
5. Overview Resource Analytics and Budget are last.
6. PDF dialog presets and custom selection hide only unselected print sections.

- [ ] **Step 4: Commit final integration fixes**

```powershell
git add team-2 tests
git commit -m "test: verify executive resource and PDF integration"
```

