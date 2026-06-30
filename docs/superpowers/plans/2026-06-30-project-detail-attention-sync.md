# Project Detail Layout and Attention Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Single Project Gantt and quarterly milestones readable as full-width blocks, restore Draft-week Attention Matrix editing, and keep Project Portfolio ordered by attention priority.

**Architecture:** Keep page composition in `team-2/index.html`, add stable portfolio ordering to the existing pure portfolio module, and add a narrowly scoped transactional attention mutation to the existing project mutation module. Both Attention Matrix controls call one persistence function, which rejects released-week races and commits local UI state only after Firestore succeeds.

**Tech Stack:** Static HTML/CSS/JavaScript, ES modules, Firebase Firestore transactions, Node.js built-in test runner.

---

### Task 1: Add stable Attention-priority ordering

**Files:**
- Modify: `team-2/js/portfolio-core.mjs`
- Modify: `tests/portfolio-core.test.mjs`

- [ ] **Step 1: Write the failing ordering tests**

Add `orderProjectsByAttention` to the import list and append:

```js
test('portfolio order follows attention priority and is stable within each group', () => {
  const projects = [
    { code: 'W-1', attention: 'watch' },
    { code: 'A-1', attention: 'action' },
    { code: 'S-1', attention: 'strategy' },
    { code: 'A-2', attention: 'action' },
    { code: 'M-1', attention: 'monitor' },
    { code: 'X-1', attention: 'other' },
    { code: 'X-2' },
  ];

  assert.deepEqual(
    orderProjectsByAttention(projects, project => project.attention).map(project => project.code),
    ['A-1', 'A-2', 'S-1', 'M-1', 'W-1', 'X-1', 'X-2'],
  );
  assert.deepEqual(projects.map(project => project.code), [
    'W-1', 'A-1', 'S-1', 'A-2', 'M-1', 'X-1', 'X-2',
  ]);
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```powershell
$node = (Get-Command node).Source
& $node --test tests/portfolio-core.test.mjs
```

Expected: FAIL because `orderProjectsByAttention` is not exported.

- [ ] **Step 3: Implement the pure stable helper**

Add to `team-2/js/portfolio-core.mjs`:

```js
const ATTENTION_PRIORITY = Object.freeze({
  action: 0,
  strategy: 1,
  monitor: 2,
  watch: 3,
});

export function orderProjectsByAttention(source = [], getAttention = project => project?.attention) {
  const projects = Array.isArray(source) ? source : [];
  return projects
    .map((project, index) => ({
      project,
      index,
      rank: ATTENTION_PRIORITY[getAttention(project)] ?? Number.MAX_SAFE_INTEGER,
    }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map(entry => entry.project);
}
```

- [ ] **Step 4: Run the focused test and verify pass**

Run:

```powershell
& $node --test tests/portfolio-core.test.mjs
```

Expected: all tests in `portfolio-core.test.mjs` PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- team-2/js/portfolio-core.mjs tests/portfolio-core.test.mjs
git commit -m "feat: order portfolio by attention priority"
```

### Task 2: Reflow Single Project Gantt and Quarterly Milestones

**Files:**
- Modify: `team-2/index.html`
- Create: `tests/project-detail-attention-sync.test.mjs`

- [ ] **Step 1: Write failing structure and quarter-column tests**

Create `tests/project-detail-attention-sync.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../team-2/index.html', import.meta.url), 'utf8');

test('project detail places Gantt and quarterly milestones below the upper grid', () => {
  const gridStart = html.indexOf('<div class="detail-grid">');
  const gridEnd = html.indexOf('<section class="detail-full-width detail-schedule-section">', gridStart);
  const schedule = html.indexOf('id="pd_schedule"', gridStart);
  const quarters = html.indexOf('id="pd_quarterly_milestones"', gridStart);

  assert.ok(gridStart >= 0 && gridEnd > gridStart);
  assert.ok(schedule > gridEnd);
  assert.ok(quarters > schedule);
  assert.match(html, /\.detail-full-width\s*\{[^}]*min-width:\s*0/);
});

test('project detail quarterly milestones render Q1 through Q4 columns', () => {
  assert.match(html, /function formatDetailQuarterlyMilestones\(project\)[\s\S]*getQuarterLabelsForYear\(year\)/);
  assert.match(html, /class="detail-quarter-column"/);
  assert.match(html, /class="detail-quarter-heading"/);
  assert.match(html, /No milestone in this quarter\./);
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```powershell
& $node --test tests/project-detail-attention-sync.test.mjs
```

Expected: both tests FAIL because the Gantt is still inside `.detail-right` and quarter columns do not exist.

- [ ] **Step 3: Move Gantt and quarterly markup below the upper grid**

In `team-2/index.html`, keep Resources and the existing resource/budget cards in `.detail-right`. Close `.detail-grid` after that content, then add:

```html
  <section class="detail-full-width detail-schedule-section">
    <div class="info-lbl" style="margin-bottom:12px;">Schedule</div>
    <div id="pd_schedule"></div>
  </section>
  <section class="detail-full-width detail-quarterly-section">
    <div class="info-lbl" style="margin-bottom:12px;">Quarterly Milestones</div>
    <div class="detail-quarter-grid" id="pd_quarterly_milestones"></div>
  </section>
```

Remove the old `pd_schedule` and `pd_quarterly_milestones` blocks from `.detail-right` so every ID remains unique.

- [ ] **Step 4: Add full-width and responsive quarter CSS**

Replace the single-list quarterly styles with:

```css
.detail-full-width {
  min-width: 0;
  margin-top: 24px;
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--s2);
}
.detail-schedule-section { overflow: hidden; }
.detail-quarterly-section { overflow-x: auto; }
.detail-quarter-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(220px, 1fr));
  gap: 12px;
  min-width: 916px;
}
.detail-quarter-column {
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
}
.detail-quarter-heading {
  margin-bottom: 10px;
  font-weight: 800;
  color: var(--text);
}
.detail-quarter-items { display: grid; gap: 10px; }
.detail-quarter-empty { color: var(--muted); font-style: italic; }
.detail-qms-item {
  border: 1px solid var(--border);
  border-left: 4px solid var(--blue);
  border-radius: 8px;
  background: #fff;
  padding: 10px 12px;
}
.detail-qms-item.done { border-left-color: var(--green); background: #F3FBF6; }
.detail-qms-item.at-risk { border-left-color: var(--yellow); background: #FFFAF0; }
```

- [ ] **Step 5: Render four quarter columns for the report year**

Replace `formatDetailQuarterlyMilestones` with:

```js
function formatDetailQuarterlyMilestones(project) {
  const list = getQuarterlyMilestones(project);
  const year = getDefaultRoadmapYear([project], getStrategyLayer(allWeeks[currentIdx]));
  const quarters = getQuarterLabelsForYear(year);
  return quarters.map(quarter => {
    const items = list.filter(item => item.quarter === quarter);
    return `<section class="detail-quarter-column">
      <div class="detail-quarter-heading">${escHtml(quarter)}</div>
      <div class="detail-quarter-items">
        ${items.length ? items.map(m => `
          <div class="detail-qms-item ${escHtml(m.status || 'planned')}">
            <div class="detail-qms-top">
              <span class="exec-ms-badge ${escHtml(m.status || 'to-do')}">${escHtml(getStatusLabel(m.status || 'planned'))}</span>
            </div>
            <div class="detail-qms-goal">${escHtml(m.goal || '-')}</div>
            <div class="detail-qms-meta">${escHtml(m.window || '-')}</div>
          </div>
        `).join('') : '<div class="detail-quarter-empty">No milestone in this quarter.</div>'}
      </div>
    </section>`;
  }).join('');
}
```

- [ ] **Step 6: Run layout and existing guidance tests**

Run:

```powershell
& $node --test tests/project-detail-attention-sync.test.mjs tests/project-editor-guidance.test.mjs
```

Expected: all selected tests PASS.

- [ ] **Step 7: Commit**

```powershell
git add -- team-2/index.html tests/project-detail-attention-sync.test.mjs
git commit -m "feat: reflow project schedule and quarterly milestones"
```

### Task 3: Add a release-safe transactional Attention mutation

**Files:**
- Modify: `team-2/js/project-mutations.mjs`
- Modify: `tests/project-mutations.test.mjs`

- [ ] **Step 1: Write failing mutation tests**

Add `applyProjectAttentionUpdate` to the import list and append:

```js
test('attention update preserves nested project data and changes only the target', () => {
  const week = {
    isReleased: false,
    projects: [
      { code: 'SYS-1', owner: 'Bonnie', attention: 'watch', nested: { keep: true } },
      { code: 'SYS-2', attention: 'monitor' },
    ],
  };
  const result = applyProjectAttentionUpdate(week, {
    projectCode: 'SYS-1',
    attention: 'action',
    role: 'pm',
    canEdit: project => project.owner === 'Bonnie',
    lastModifiedBy: 'bonnie@example.com',
  });

  assert.equal(result.project.attention, 'action');
  assert.equal(result.project.attentionManual, true);
  assert.deepEqual(result.project.nested, { keep: true });
  assert.equal(result.week.projects[1], week.projects[1]);
  assert.equal(week.projects[0].attention, 'watch');
});

test('attention update rejects released weeks, invalid values, and unauthorized users', () => {
  const base = { projects: [{ code: 'SYS-1', owner: 'Bonnie', attention: 'watch' }] };
  assert.throws(
    () => applyProjectAttentionUpdate({ ...base, isReleased: true }, {
      projectCode: 'SYS-1', attention: 'action', role: 'admin',
    }),
    error => error.code === 'released-week',
  );
  assert.throws(
    () => applyProjectAttentionUpdate(base, {
      projectCode: 'SYS-1', attention: 'invalid', role: 'admin',
    }),
    error => error.code === 'invalid-attention',
  );
  assert.throws(
    () => applyProjectAttentionUpdate(base, {
      projectCode: 'SYS-1', attention: 'action', role: 'vip',
    }),
    error => error.code === 'edit-forbidden',
  );
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```powershell
& $node --test tests/project-mutations.test.mjs
```

Expected: FAIL because `applyProjectAttentionUpdate` is not exported.

- [ ] **Step 3: Implement the pure mutation**

Add to `team-2/js/project-mutations.mjs`:

```js
const ATTENTION_VALUES = new Set(['action', 'strategy', 'monitor', 'watch']);

export function applyProjectAttentionUpdate(week, options = {}) {
  const projects = liveProjects(week);
  const { projectCode, attention, role, canEdit, lastModifiedBy } = options;
  if (week.isReleased === true) {
    throw new ProjectMutationError(
      'released-week',
      'This reporting week has been released and can no longer be changed.',
    );
  }
  if (!ATTENTION_VALUES.has(attention)) {
    throw new ProjectMutationError('invalid-attention', 'Select a valid attention category.');
  }
  const targetIndex = projects.findIndex(project => project?.code === projectCode);
  if (targetIndex < 0) {
    throw new ProjectMutationError('missing-target', 'This project no longer exists.');
  }
  const targetProject = projects[targetIndex];
  const authorized = role === 'admin'
    || (role === 'pm' && typeof canEdit === 'function' && canEdit(targetProject));
  if (!authorized) {
    throw new ProjectMutationError('edit-forbidden', 'You no longer have permission to edit this project.');
  }
  const project = { ...targetProject, attention, attentionManual: true };
  const nextProjects = [...projects];
  nextProjects[targetIndex] = project;
  return {
    project,
    week: { ...week, projects: nextProjects, lastModifiedBy },
  };
}
```

- [ ] **Step 4: Run the focused test and verify pass**

Run:

```powershell
& $node --test tests/project-mutations.test.mjs
```

Expected: all tests in `project-mutations.test.mjs` PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- team-2/js/project-mutations.mjs tests/project-mutations.test.mjs
git commit -m "feat: protect attention updates with release checks"
```

### Task 4: Wire Matrix editing and Portfolio synchronization

**Files:**
- Modify: `team-2/index.html`
- Modify: `tests/project-detail-attention-sync.test.mjs`

- [ ] **Step 1: Add failing integration-source tests**

Append:

```js
test('overview orders portfolio and routes both attention controls through one transaction', () => {
  assert.match(html, /orderProjectsByAttention/);
  assert.match(html, /const portfolioProjects = orderProjectsByAttention\(projs, project => project\.attention\)/);
  assert.match(html, /portfolioProjects\.map\(p =>/);
  assert.match(html, /async function updateProjectAttention\(code, attention\)/);

  const bindStart = html.indexOf('function bindDecisionControls(editable)');
  const bindEnd = html.indexOf('// ── UTILS & ACTIONS ──', bindStart);
  const bindSource = html.slice(bindStart, bindEnd);
  assert.equal((bindSource.match(/await updateProjectAttention\(/g) || []).length, 2);
  assert.doesNotMatch(bindSource, /saveCurrentWeekQuietly\(\)/);
});

test('attention transaction reads live week and commits UI only after success', () => {
  const start = html.indexOf('async function updateProjectAttention(code, attention)');
  const end = html.indexOf('function bindDecisionControls(editable)', start);
  const source = html.slice(start, end);
  assert.match(source, /await runTransaction\(db, async transaction =>/);
  assert.match(source, /await transaction\.get\(weekRef\)/);
  assert.match(source, /applyProjectAttentionUpdate\(snapshot\.data\(\)/);
  assert.match(source, /transaction\.update\(weekRef/);
  assert.ok(source.indexOf('allWeeks[currentIdx] = result.week') > source.indexOf('await runTransaction'));
  assert.match(source, /render\(\)/);
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```powershell
& $node --test tests/project-detail-attention-sync.test.mjs
```

Expected: the two new tests FAIL because the shared transaction and ordered portfolio are not wired.

- [ ] **Step 3: Import the two new helpers**

Extend the existing imports in `team-2/index.html`:

```js
import {
  applyProjectAttentionUpdate,
  applyProjectDelete,
  applyProjectSave,
  ensureStableEditorRowId,
  projectRevisionFingerprint,
  withProjectEditorRowIds
} from "./js/project-mutations.mjs";
```

Add `orderProjectsByAttention` to the import from `./js/portfolio-core.mjs`.

- [ ] **Step 4: Render Project Portfolio from an ordered copy**

At the start of `renderExec`, after `roadmapYear`, add:

```js
const portfolioProjects = orderProjectsByAttention(projs, project => project.attention);
```

Change only the Project Portfolio mapping:

```js
${portfolioProjects.length ? portfolioProjects.map(p => {
```

Keep all other Overview sections on their existing `projs` ordering.

- [ ] **Step 5: Add the shared Firestore transaction**

Replace `saveCurrentWeekQuietly` for Attention changes with:

```js
async function updateProjectAttention(code, attention) {
  const selectedWeek = allWeeks[currentIdx];
  const selectedIndex = currentIdx;
  const weekId = selectedWeek?.__documentId || selectedWeek?.weekLabel?.replace(/\s+/g, '-');
  const authUid = currentUser?.uid || '';
  const authEmail = getEmailKey(currentUser);
  const role = currentRole;
  if (!selectedWeek || !weekId || !authEmail || isWeekReleased(selectedWeek) || isVipPerspective()) {
    render();
    return false;
  }
  const weekRef = doc(db, 'weeks', weekId);
  try {
    const result = await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(weekRef);
      if (!snapshot.exists()) throw new Error('The selected week no longer exists.');
      const mutation = applyProjectAttentionUpdate(snapshot.data(), {
        projectCode: code,
        attention,
        role,
        canEdit: project => projectOwnershipMatchesIdentity(project, {
          displayName: getUserDisplayName(authEmail),
          email: authEmail,
        }),
        lastModifiedBy: authEmail,
      });
      transaction.update(weekRef, {
        projects: mutation.week.projects,
        lastModifiedBy: authEmail,
      });
      return mutation;
    });
    const selectionStillCurrent = currentIdx === selectedIndex
      && (currentUser?.uid || '') === authUid
      && getEmailKey(currentUser) === authEmail
      && currentRole === role;
    if (!selectionStillCurrent) return false;
    Object.defineProperty(result.week, '__documentId', {
      value: weekId,
      enumerable: false,
      configurable: true,
    });
    allWeeks[currentIdx] = result.week;
    render();
    showSaveToast('Attention updated');
    return true;
  } catch (error) {
    console.error('Attention update failed:', error);
    render();
    showSaveToast(getWriteErrorMessage(error));
    return false;
  }
}
```

Keep `saveCurrentWeekQuietly` for the existing risk-list behavior; do not use it for Attention changes.

- [ ] **Step 6: Route dropdown and drag/drop through the shared updater**

Use:

```js
sel.onchange = async () => {
  const p = findCurrentProject(sel.dataset.code);
  if (!p || !canEditProject(p)) return;
  await updateProjectAttention(p.code, sel.value);
};
```

And in the quadrant drop handler:

```js
const p = findCurrentProject(e.dataTransfer.getData('text/plain'));
if (!p || !canEditProject(p)) return;
await updateProjectAttention(p.code, quad.dataset.attention);
```

Do not mutate `p.attention` before the transaction succeeds.

- [ ] **Step 7: Run focused tests**

Run:

```powershell
& $node --test tests/project-detail-attention-sync.test.mjs tests/project-mutations.test.mjs tests/portfolio-core.test.mjs
```

Expected: all selected tests PASS.

- [ ] **Step 8: Commit**

```powershell
git add -- team-2/index.html tests/project-detail-attention-sync.test.mjs
git commit -m "feat: sync attention matrix and portfolio"
```

### Task 5: Full regression and browser verification

**Files:**
- Modify only if a regression is found: files already listed above

- [ ] **Step 1: Run the complete test suite**

Run:

```powershell
& $node --test tests/*.test.mjs team-2/*.test.mjs team-2/*.test.cjs
```

Expected: every test PASS with zero failures.

- [ ] **Step 2: Start the local static server**

Run in the repository root:

```powershell
python -m http.server 4173
```

Expected: server listens on port 4173. Open `http://127.0.0.1:4173/team-2/`.

- [ ] **Step 3: Verify Single Project layout**

In the in-app browser:

1. Open a project with schedule and quarterly milestone data.
2. Confirm the upper region contains project information, Highlight, Milestone Roadmap, and Resources.
3. Confirm Schedule is a separate full-width block below the upper region.
4. Confirm Quarterly Milestones is below Schedule with Q1, Q2, Q3, Q4 from left to right.
5. Resize to a narrow viewport and confirm no content overlaps; horizontal scrolling remains usable.

- [ ] **Step 4: Verify Draft and Released Overview behavior**

In a Draft week:

1. Move a project using the Attention dropdown.
2. Confirm the Matrix and Portfolio change immediately.
3. Drag a project to another quadrant.
4. Confirm the same immediate synchronization.
5. Confirm Portfolio group order is Executive Action, Strategic Watch, Monitor Closely, Keep Watching.

In a Released week:

1. Confirm the matrix displays the read-only note.
2. Confirm there are no Attention dropdowns, draggable cards, or active drop targets.

- [ ] **Step 5: Inspect browser console**

Expected: no JavaScript errors, unhandled promise rejections, duplicate-ID warnings, or failed module imports.

- [ ] **Step 6: Commit any verification-only correction**

If verification required a correction, rerun the focused test first, then:

```powershell
git add -- team-2/index.html team-2/js/portfolio-core.mjs team-2/js/project-mutations.mjs tests
git commit -m "fix: resolve project attention verification findings"
```

If no files changed, do not create an empty commit.

### Task 6: Deploy and verify v2.0T `team-2`

**Files:**
- No source changes expected

- [ ] **Step 1: Confirm clean branch and target**

Run:

```powershell
git status --short
git branch --show-current
git log -1 --oneline
```

Expected: clean status on `codex/v2.0t-multi-project`.

- [ ] **Step 2: Push the verified commit to UAT main**

Run:

```powershell
git push uat HEAD:main
```

Expected: `uat/main` advances to the verified commit.

- [ ] **Step 3: Verify GitHub Pages deployment**

Run:

```powershell
gh run list --repo augusliang23-web/pm-dashboard-uat --limit 5
```

Expected: the Pages deployment for the pushed commit completes successfully.

- [ ] **Step 4: Verify the deployed page**

Open:

```text
https://augusliang23-web.github.io/pm-dashboard-uat/team-2/index.html?v=<deployed-commit>
```

Repeat the Single Project layout, Draft Matrix edit, Released lock, and Portfolio ordering checks. Production `pm-dashboard` is not changed in this plan.
