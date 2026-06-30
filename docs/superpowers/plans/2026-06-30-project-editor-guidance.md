# Project Editor Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make v2.0T Gantt views readable and ensure every Project Editor input communicates its purpose, format, and unit.

**Architecture:** Keep the current single-page dashboard and data model unchanged. Add CSS containment and responsive layout rules, then add persistent row headers, visible help text, and accessible names directly to the existing static and dynamic Project Editor controls.

**Tech Stack:** HTML, CSS, browser JavaScript, Node.js built-in test runner.

---

### Task 1: Lock the usability requirements with failing tests

**Files:**
- Create: `tests/project-editor-guidance.test.mjs`
- Read: `team-2/index.html`

- [ ] **Step 1: Write the failing layout test**

```js
test('project detail and one-page Gantt stay contained at narrow widths', () => {
  assert.match(html, /\.detail-left,\s*\.detail-right\s*\{\s*min-width:\s*0/);
  assert.match(html, /\.one-page-status-gantt\s*\{[^}]*min-width:\s*0/);
  assert.match(html, /@media\s*\(max-width:\s*1100px\)[\s\S]*?\.detail-grid\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});
```

- [ ] **Step 2: Write failing guidance tests**

```js
test('schedule and team rows expose persistent visible column guidance', () => {
  assert.match(html, /Workstream[\s\S]*Start date[\s\S]*End date[\s\S]*Status[\s\S]*Progress %[\s\S]*Linked milestone/);
  assert.match(html, /Allocation %[\s\S]*planned capacity assigned to this project/i);
  assert.match(html, /class="fi team-effort"[^>]*max="100"[^>]*aria-label="Allocation percent"/);
});

test('dynamic Project Editor inputs have explicit accessible names and units', () => {
  for (const label of [
    'Milestone name', 'Milestone date', 'Milestone status',
    'Quarter', 'Quarterly target', 'Target month', 'Quarterly status',
    'Planned month', 'Planned category', 'Planned currency', 'Planned amount',
    'Actual month', 'Actual category', 'Actual currency', 'Actual amount', 'Actual spend note'
  ]) assert.match(html, new RegExp(`aria-label="${label}"`));
  assert.match(html, />Estimated hours<\/label>/);
  assert.match(html, />Actual hours \\(optional\\)<\/label>/);
});
```

- [ ] **Step 3: Run the targeted test and verify RED**

Run:

```powershell
& $node --test tests/project-editor-guidance.test.mjs
```

Expected: FAIL because containment, visible headers, and explicit accessible names are missing.

- [ ] **Step 4: Commit the failing test**

```powershell
git add tests/project-editor-guidance.test.mjs
git commit -m "test: define project editor guidance"
```

### Task 2: Implement responsive Gantt containment

**Files:**
- Modify: `team-2/index.html`
- Test: `tests/project-editor-guidance.test.mjs`

- [ ] **Step 1: Add minimum-width containment and a responsive detail breakpoint**

```css
#projDetailOverlay .modal { width:min(1180px,94vw); }
.detail-grid { grid-template-columns:minmax(260px,.75fr) minmax(0,1.4fr); }
.detail-left, .detail-right { min-width:0; }
.one-page-status-gantt { min-width:0; overflow:hidden; }
@media(max-width:1100px) {
  .detail-grid { grid-template-columns:minmax(0,1fr); }
}
```

- [ ] **Step 2: Run the targeted test**

Run:

```powershell
& $node --test tests/project-editor-guidance.test.mjs
```

Expected: the layout test passes; guidance tests remain failing.

- [ ] **Step 3: Commit the layout fix**

```powershell
git add team-2/index.html
git commit -m "fix: contain project Gantt layouts"
```

### Task 3: Add persistent field guidance throughout Project Editor

**Files:**
- Modify: `team-2/index.html`
- Test: `tests/project-editor-guidance.test.mjs`

- [ ] **Step 1: Add reusable row-header styling**

```css
.editor-row-head { display:grid; gap:7px; margin:8px 8px 4px; color:var(--muted); font-size:9px; font-weight:800; text-transform:uppercase; }
.schedule-row-head { grid-template-columns:30px minmax(130px,1.4fr) 125px 125px 120px 80px minmax(130px,1fr) 136px; min-width:920px; }
.team-row-head { grid-template-columns:1.2fr 1fr .55fr 32px; }
```

- [ ] **Step 2: Add visible Schedule and Team guidance**

Add a Schedule header with Workstream, Start date, End date, Status, Progress %, Linked milestone, and Actions. Add help text stating that progress is completion from 0% to 100%. Add a Team header with Name, Role, Allocation %, and Actions, plus help text defining allocation as planned capacity from 0% to 100%.

- [ ] **Step 3: Make dynamic controls self-describing**

Add explicit `aria-label` and `title` values to Risk, Milestone, Quarterly Milestone, Schedule, Team, Budget Plan, and Actual Spend controls. Change Team allocation `max` from `200` to `100` to match validation. Change Discipline Hours visible labels to `Estimated hours` and `Actual hours (optional)`.

- [ ] **Step 4: Add concise examples to ambiguous static fields**

Add non-binding examples for Project Type, Classification, Product Family, Customer, Location, Highlight, and Progress. Do not change values, storage keys, or validation.

- [ ] **Step 5: Run the targeted test and verify GREEN**

Run:

```powershell
& $node --test tests/project-editor-guidance.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Run the full suite**

Run:

```powershell
& $node --test tests/*.test.mjs team-2/*.test.mjs team-2/*.test.cjs
```

Expected: all tests pass.

- [ ] **Step 7: Commit the guidance implementation**

```powershell
git add team-2/index.html
git commit -m "fix: clarify project editor inputs"
```

### Task 4: Browser verification and v2.0T deployment

**Files:**
- Verify: `team-2/index.html`

- [ ] **Step 1: Verify locally in the browser**

At desktop and narrow widths, open an existing project and New Project. Confirm the detail Gantt remains inside its panel; Schedule and Team columns remain identifiable; every dynamic row has an accessible name; and no console errors occur.

- [ ] **Step 2: Run final verification**

```powershell
git diff --check uat/main..HEAD
& $node --test tests/*.test.mjs team-2/*.test.mjs team-2/*.test.cjs
```

Expected: clean diff and all tests pass.

- [ ] **Step 3: Deploy only to v2.0T**

```powershell
git push uat HEAD:main
```

- [ ] **Step 4: Verify GitHub Pages**

Wait for the Pages workflow for the pushed commit to succeed. Open the cache-busted v2.0T URL, repeat the Project Detail and New Project checks, and confirm zero console errors. Confirm the production remote remains unchanged.
