# Resource and Budget Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a progressive Resource & Budget editor in v2.0T where incomplete information can always be saved but only independently confirmed sections affect management Overview KPIs.

**Architecture:** Keep the existing single-file dashboard and Firestore project shape, adding pure status-normalization and validation helpers inside `team-2/index.html`. Persist a backward-compatible `dataStatus` object beside the existing `teamMembers` and `budget` data. Filter Overview calculations through confirmation selectors instead of changing the existing currency and aggregation helpers.

**Tech Stack:** HTML, CSS, browser JavaScript, Firebase Firestore, Node.js built-in test runner utilities.

---

### Task 1: Status Normalization and Validation

**Files:**
- Modify: `team-2/index.html:2930`
- Create: `team-2/resource-budget-status.test.cjs`

- [ ] **Step 1: Write failing tests for legacy defaults and validation**

Create a Node test that extracts the code between
`/* resource-budget-status:start */` and
`/* resource-budget-status:end */`. Assert:

```js
normalizeResourceBudgetStatus({}).team.state === 'unconfirmed'
normalizeResourceBudgetStatus({}).budgetActual.state === 'not-available'
validateTeamAllocation([{ name: '', roleName: 'PM', effortPct: 40 }]).errors.length === 1
validateBudgetPlan({ mode: 'auto', totalEstimated: 0, monthlyPlans: [] }, false).errors.length === 1
validateActualSpend([]).errors.length === 0
```

- [ ] **Step 2: Run the test and verify the helper marker is missing**

Run:

```powershell
node team-2/resource-budget-status.test.cjs
```

Expected: FAIL with `resource budget status helper is missing`.

- [ ] **Step 3: Implement pure normalization and validation helpers**

Add:

```js
normalizeResourceBudgetStatus(project)
validateTeamAllocation(members, noAllocationRequired)
validateBudgetPlan(budget, overBudgetAcknowledged)
validateActualSpend(actuals)
isResourceSectionConfirmed(project, section)
```

Validation must follow the approved design, including duplicate team members,
0-100 effort, auto-plan requirements, manual ceiling checks, and unplanned
actual warnings.

- [ ] **Step 4: Run tests**

Expected: all status and validation assertions pass.

- [ ] **Step 5: Commit**

```powershell
git add team-2/index.html team-2/resource-budget-status.test.cjs
git commit -m "Add resource budget status validation"
```

### Task 2: Progressive Editor Layout

**Files:**
- Modify: `team-2/index.html:679-758`
- Modify: `team-2/index.html:1519-1577`

- [ ] **Step 1: Add a static structure test**

Extend `resource-budget-status.test.cjs` to assert the HTML includes:

```text
Resource & Budget
Draft data is saved but excluded from Overview KPIs
Team allocation
Budget planning
Actual spend
```

Expected before implementation: FAIL because the integrated section is absent.

- [ ] **Step 2: Replace the scattered layout**

Create one `Resource & Budget` shell with:

- A neutral status banner
- Three `<details>` panels
- Panel state badge, summary, issue count, and confirm action
- Existing team, plan, and actual row containers moved into their panel
- Existing budget mode and linkage controls retained in Budget planning
- Add buttons placed inside the panel they affect

- [ ] **Step 3: Add responsive CSS**

Use full-width unframed panel sections, 8px maximum radii, fixed status badge
dimensions, mobile single-column rows, and no card nesting.

- [ ] **Step 4: Run the structure and helper tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add team-2/index.html team-2/resource-budget-status.test.cjs
git commit -m "Reorganize resource budget editor"
```

### Task 3: Editor State and Save Behavior

**Files:**
- Modify: `team-2/index.html:4952-5175`
- Test: `team-2/resource-budget-status.test.cjs`

- [ ] **Step 1: Add failing serialization tests**

Test that:

- Editing a confirmed team section downgrades it to `unconfirmed`
- Adding actual spend changes `not-available` to `draft`
- Confirmation metadata contains `confirmedAt` and `confirmedBy`
- Project save accepts all unconfirmed states

- [ ] **Step 2: Implement editor state functions**

Add:

```js
setResourceSectionState(section, nextState)
markResourceSectionDirty(section)
confirmResourceSection(section)
renderResourceSectionState()
collectResourceBudgetStatus()
```

Confirmation validates only the selected section. Failed confirmation opens
the panel and focuses its first invalid field. Project save remains available.

- [ ] **Step 3: Wire change listeners and save**

All team fields mark `team` dirty. Budget mode, ceiling, and plan fields mark
`budgetPlan` dirty. Actual fields mark `budgetActual` draft. Save
`dataStatus` with the existing project data.

- [ ] **Step 4: Normalize existing records**

Real legacy records default conservatively. Prototype seed records receive
explicit confirmed states so the demonstration Overview remains populated.

- [ ] **Step 5: Run tests and commit**

```powershell
node team-2/resource-budget-status.test.cjs
git add team-2/index.html team-2/resource-budget-status.test.cjs
git commit -m "Persist independent resource budget confirmation"
```

### Task 4: Overview Trust Filtering and Coverage

**Files:**
- Modify: `team-2/index.html:3151-3247`
- Test: `team-2/resource-budget-status.test.cjs`

- [ ] **Step 1: Add failing Overview selector tests**

Assert:

```js
getConfirmedResourceProjects(projects).length
getConfirmedBudgetPlanProjects(projects).length
getConfirmedBudgetActualProjects(projects).length
getResourceBudgetCoverage(projects)
```

exclude unconfirmed sections and count pending/not-available states without
treating them as zero.

- [ ] **Step 2: Implement selectors**

Add pure selectors and use them as inputs to existing resource, plan, and
actual aggregation logic.

- [ ] **Step 3: Add coverage indicators**

Display confirmed and pending project counts in each Overview subsection.
Pending data must not affect overload, budget, variance, burn, or denominators.

- [ ] **Step 4: Run tests and commit**

```powershell
node team-2/resource-budget-status.test.cjs
git add team-2/index.html team-2/resource-budget-status.test.cjs
git commit -m "Exclude unconfirmed data from overview"
```

### Task 5: Browser Verification and Deployment

**Files:**
- Modify if needed: `team-2/index.html`

- [ ] **Step 1: Run automated checks**

```powershell
node team-2/resource-budget-status.test.cjs
node team-2/presence-estimate.test.cjs
git diff --check
```

Expected: all tests pass and no whitespace errors.

- [ ] **Step 2: Verify desktop layout**

At a desktop viewport, verify:

- Three sections are easy to scan
- Missing data does not disable Save Project
- Confirm validates only the active section
- Long role and category names fit
- Confirmed data downgrades after editing

- [ ] **Step 3: Verify mobile layout**

At a mobile viewport, verify row controls stack without overlap, panel headers
wrap cleanly, and actions remain reachable.

- [ ] **Step 4: Verify Overview**

Use mixed confirmed and pending prototype data. Confirm KPI values use only
confirmed sections and coverage labels show excluded projects.

- [ ] **Step 5: Commit any verification fixes and deploy**

Push the completed branch to the v2.0T GitHub Pages `main` branch, verify the
cache-busted URL, and report the commit hash. Do not modify production v2.0.
