# Project PDF and Roadmap UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export only the selected project to PDF, restore standard project-editor text selection, and simplify the Overview roadmap and IoE executive outcome editor.

**Architecture:** Keep the existing single-file dashboard and persisted Firebase data model. Introduce temporary CSS/UI state for project-only printing and roadmap/editor disclosure, while reusing existing normalization, role checks, release locking, evidence catalog, and save transaction paths. Tests remain Node built-in source-contract tests because the repository has no browser DOM test dependency.

**Tech Stack:** HTML, CSS, browser JavaScript modules, Firebase 10.12.2, Node.js `node:test`.

## Global Constraints

- Target the existing v2.0T worktree and preserve all current uncommitted feature work.
- Do not deploy to v2.0T or production during this plan.
- Do not change Firebase collection shapes, Firestore rules, role assignment, or historical project data.
- Preserve existing `sectionId`, `audience`, RAG audit fields, evidence sources, and project milestone records.
- Released weeks remain read-only through the existing role and `assertCurrentWeekEditable()` guards.
- Use a dedicated drag handle for reordering; manually editable fields retain normal browser text selection.
- Use TDD for each behavior: write and run the failing test before changing `team-2/index.html`.

---

### Task 1: Isolate the selected project in one-page PDF output

**Files:**
- Create: `tests/project-one-page-pdf.test.mjs`
- Modify: `team-2/index.html:1097-1210`
- Modify: `team-2/index.html:1740-1750`
- Modify: `team-2/index.html:6036-6045`

**Interfaces:**
- Consumes: `renderOnePageStatus(project, reportingPeriod)`, `openAccessibleModal(modal)`, `closeModal(id)`, and `#onePageStatusModal`.
- Produces: `clearProjectOnePagePrintMode()` and `body.print-project-one-page`, used only during project PDF export.

- [ ] **Step 1: Write the failing PDF behavior test**

```js
// tests/project-one-page-pdf.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const dashboard = await readFile(new URL('../team-2/index.html', import.meta.url), 'utf8');

test('project PDF uses an icon-only export control', () => {
  const button = dashboard.match(/<button[^>]+id="pd_one_page_pdf"[^>]*>[\s\S]*?<\/button>/)?.[0] || '';
  assert.match(button, /class="btn-icon no-print"/);
  assert.match(button, /title="Export project PDF"/);
  assert.match(button, /aria-label="Export project PDF"/);
  assert.doesNotMatch(button, />\s*One-page PDF\s*</);
});

test('project PDF activates and cleans up a project-only print mode', () => {
  const start = dashboard.indexOf('window.exportProjectOnePagePdf =');
  const end = dashboard.indexOf('// ── RENDER ──', start);
  const source = dashboard.slice(start, end);
  assert.match(source, /document\.body\.classList\.add\('print-project-one-page'\)/);
  assert.match(source, /window\.addEventListener\('afterprint', clearProjectOnePagePrintMode, \{ once: true \}\)/);
  assert.match(source, /requestAnimationFrame\(\(\) => window\.print\(\)\)/);
  assert.match(dashboard, /body\.print-project-one-page #onePageStatusModal/);
  assert.match(dashboard, /body\.print-project-one-page #execView/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
node --test tests/project-one-page-pdf.test.mjs
```

Expected: FAIL because the button is text-based and no `print-project-one-page` mode exists.

- [ ] **Step 3: Replace the project PDF text button with the Overview icon language**

Use the same download icon geometry as the Overview PDF control:

```html
<button class="btn-icon no-print" id="pd_one_page_pdf" type="button"
  onclick="exportProjectOnePagePdf()" title="Export project PDF"
  aria-label="Export project PDF">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
</button>
```

- [ ] **Step 4: Add project-only print rules after the existing general print rules**

```css
@media print {
  body.print-project-one-page { width:auto !important; min-height:0 !important; }
  body.print-project-one-page .hdr,
  body.print-project-one-page .main,
  body.print-project-one-page #projDetailOverlay,
  body.print-project-one-page #execView { display:none !important; }
  body.print-project-one-page #onePageStatusModal {
    display:block !important; position:static !important; inset:auto !important;
    background:#fff !important; padding:0 !important; overflow:visible !important;
  }
  body.print-project-one-page #onePageStatusModal .modal {
    display:block !important; position:static !important; width:100% !important;
    max-width:none !important; max-height:none !important; padding:0 !important;
    margin:0 !important; overflow:visible !important; box-shadow:none !important;
  }
  body.print-project-one-page #onePageStatusModal .one-page-status { display:grid !important; }
  body.print-project-one-page #onePageStatusModal button { display:none !important; }
}
```

- [ ] **Step 5: Add deterministic print setup and cleanup**

```js
function clearProjectOnePagePrintMode() {
  document.body.classList.remove('print-project-one-page');
  closeModal('onePageStatusModal');
}

window.exportProjectOnePagePdf = () => {
  const code = document.getElementById('projDetailOverlay')?.dataset.projectCode;
  const rawProject = allWeeks[currentIdx]?.projects?.find(project => project.code === code);
  if (!rawProject) return;
  const modal = document.getElementById('onePageStatusModal');
  modal.dataset.projectCode = code;
  renderOnePageStatus(rawProject, allWeeks[currentIdx] || {});
  document.body.classList.add('print-project-one-page');
  openAccessibleModal(modal);
  window.addEventListener('afterprint', clearProjectOnePagePrintMode, { once: true });
  requestAnimationFrame(() => window.print());
};
```

- [ ] **Step 6: Run focused and Overview print regression tests**

Run:

```powershell
node --test tests/project-one-page-pdf.test.mjs tests/overview-print-selection.test.mjs
```

Expected: all tests PASS; Overview section selection still calls its own `window.print()` path.

- [ ] **Step 7: Commit only Task 1 files**

```powershell
git add team-2/index.html tests/project-one-page-pdf.test.mjs
git commit -m "fix: isolate project one-page PDF export"
```

---

### Task 2: Restore normal text selection in the project editor

**Files:**
- Create: `tests/project-editor-drag.test.mjs`
- Modify: `team-2/index.html:8084-8135`
- Verify: `team-2/index.html:7500-7580`

**Interfaces:**
- Consumes: `msCont` dragover handler, `getDragAfterElement(container, y)`, `checkMsDates()`, and `scheduleWorkstreamPreview()`.
- Produces: `.milestone-drag-handle` as the only drag origin for milestone rows.

- [ ] **Step 1: Write the failing drag-contract test**

```js
// tests/project-editor-drag.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const dashboard = await readFile(new URL('../team-2/index.html', import.meta.url), 'utf8');

test('milestone reordering starts only from its dedicated handle', () => {
  const start = dashboard.indexOf('window.addMilestoneRow');
  const end = dashboard.indexOf('window.addQuarterlyMilestoneRow', start);
  const source = dashboard.slice(start, end);
  assert.doesNotMatch(source, /div\.draggable\s*=\s*true/);
  assert.match(source, /class="drag-handle milestone-drag-handle" draggable="true"/);
  assert.match(source, /handle\.ondragstart/);
  assert.match(source, /div\.classList\.add\('dragging'\)/);
  assert.match(source, /handle\.ondragend/);
});

test('other project editor rows do not make their input containers draggable', () => {
  for (const marker of ['window.addQuarterlyMilestoneRow', 'function renderTeamAllocationEditor', 'function refreshDisciplineHoursEditor']) {
    const start = dashboard.indexOf(marker);
    assert.ok(start >= 0, marker);
    const source = dashboard.slice(start, start + 9000);
    assert.doesNotMatch(source, /\.draggable\s*=\s*true/);
  }
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
node --test tests/project-editor-drag.test.mjs
```

Expected: FAIL because `addMilestoneRow()` currently sets `div.draggable = true`.

- [ ] **Step 3: Move milestone drag behavior to the handle**

Replace the current draggable row setup with:

```js
div.className = 'ms-row';
div.innerHTML = `
  <button type="button" class="drag-handle milestone-drag-handle" draggable="true"
    title="Drag to reorder milestone" aria-label="Drag milestone to reorder">☰</button>
  <input class="fi ms-name" style="flex:2" value="${escHtml(name)}"
    placeholder="Milestone name" aria-label="Milestone name">
  <input type="date" class="fi ms-date" value="${escHtml(dateStr)}"
    onchange="checkMsDates()" aria-label="Milestone date">
  <select class="fs ms-status" aria-label="Milestone status">
    <option ${status === 'to-do' ? 'selected' : ''}>to-do</option>
    <option ${status === 'in-progress' ? 'selected' : ''}>in-progress</option>
    <option ${status === 'at-risk' ? 'selected' : ''}>at-risk</option>
    <option ${status === 'done' ? 'selected' : ''}>done</option>
  </select>
  <button type="button" onclick="removeMilestoneRow(this)"
    style="border:none; background:none; cursor:pointer;"
    title="Delete milestone" aria-label="Delete milestone">🗑️</button>
`;
div.insertAdjacentHTML('beforeend', milestoneHistoryHtml(normalized));
const handle = div.querySelector('.milestone-drag-handle');
handle.ondragstart = event => {
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', div.dataset.milestoneId || '');
  div.classList.add('dragging');
};
handle.ondragend = () => {
  div.classList.remove('dragging');
  checkMsDates();
  scheduleWorkstreamPreview();
};
```

Do not attach `mousedown`, `pointerdown`, or `dragstart` handlers to the row or its manually editable controls.

- [ ] **Step 4: Run focused editor and baseline tests**

Run:

```powershell
node --test tests/project-editor-drag.test.mjs tests/v2-baseline.test.mjs
```

Expected: all tests PASS; Gantt workstreams retain their existing handle-only drag contract.

- [ ] **Step 5: Commit only Task 2 files**

```powershell
git add team-2/index.html tests/project-editor-drag.test.mjs
git commit -m "fix: keep project inputs selectable during reorder"
```

---

### Task 3: Consolidate the Portfolio Roadmap hierarchy

**Files:**
- Create: `tests/portfolio-roadmap-ui.test.mjs`
- Modify: `team-2/index.html:2250-2290`
- Modify: `team-2/index.html:5428-5612`
- Modify: `team-2/index.html:6380-6392`
- Modify: `team-2/index.html:6940-7005`

**Interfaces:**
- Consumes: `renderRoadmapYearSelector()`, `renderExecutiveQuarterMilestones()`, `renderProjectQuarterMatrix()`, `openExecutiveTimelineEditor()`, role checks, and `activeRoadmapYear`.
- Produces: `activePortfolioRoadmapView`, `setPortfolioRoadmapView(view)`, and one `Portfolio Roadmap` component.

- [ ] **Step 1: Write the failing roadmap hierarchy test**

```js
// tests/portfolio-roadmap-ui.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const dashboard = await readFile(new URL('../team-2/index.html', import.meta.url), 'utf8');

test('Overview exposes one Portfolio Roadmap with two view tabs', () => {
  assert.match(dashboard, /Portfolio Roadmap/);
  assert.match(dashboard, /Executive Outcomes/);
  assert.match(dashboard, /Project Milestones/);
  assert.match(dashboard, /window\.setPortfolioRoadmapView/);
  assert.doesNotMatch(dashboard, /Quarterly milestones across projects/);
  assert.doesNotMatch(dashboard, /Portfolio-wide executive timeline/);
});

test('executive roadmap has one edit action and project roadmap points to project cards', () => {
  const start = dashboard.indexOf('function renderQuarterlyBoard');
  const end = dashboard.indexOf('function renderAttentionMatrix', start);
  const source = dashboard.slice(start, end);
  assert.equal((source.match(/openExecutiveTimelineEditor\(\)/g) || []).length, 1);
  assert.match(source, /Edit Executive Roadmap/);
  assert.match(source, /Edit milestones from the project card/);
  assert.doesNotMatch(source, /Manage Strategy/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
node --test tests/portfolio-roadmap-ui.test.mjs
```

Expected: FAIL because the current Overview renders nested roadmap headings and duplicate edit actions.

- [ ] **Step 3: Add transient roadmap view state**

```js
let activePortfolioRoadmapView = 'executive';

window.setPortfolioRoadmapView = view => {
  activePortfolioRoadmapView = view === 'projects' ? 'projects' : 'executive';
  render();
};
```

- [ ] **Step 4: Make child renderers content-only**

Remove the `Portfolio-wide executive timeline` header and nested edit button from `renderExecutiveQuarterMilestones()`. Keep the timeline title, category summaries, quarterly RAG, grid, and phase row. Change the project child title from `PM project milestones` to `Project Milestone Roadmap` and retain its KPI cards, matrix, legend, and empty state.

- [ ] **Step 5: Render one roadmap shell and contextual action**

```js
function renderQuarterlyBoard(projs, layer = getStrategyLayer(), activeTrack = 'all', year = getDefaultRoadmapYear(projs, layer)) {
  const executive = activePortfolioRoadmapView === 'executive';
  return `<div class="portfolio-roadmap">
    <div class="portfolio-roadmap-head">
      <div><div class="exec-eyebrow">Portfolio Roadmap</div>
        <div class="exec-decision-title">${executive ? `${year} IoE Executive Roadmap` : `${year} Project Milestone Roadmap`}</div></div>
      <div class="portfolio-roadmap-actions">
        ${renderRoadmapYearSelector(projs, layer)}
        ${executive && canManageStrategy() ? `<button class="btn btn-primary no-print" onclick="openExecutiveTimelineEditor()">Edit Executive Roadmap</button>` : ''}
      </div>
    </div>
    <div class="portfolio-roadmap-tabs" role="tablist" aria-label="Roadmap view">
      <button type="button" class="${executive ? 'active' : ''}" onclick="setPortfolioRoadmapView('executive')">Executive Outcomes</button>
      <button type="button" class="${executive ? '' : 'active'}" onclick="setPortfolioRoadmapView('projects')">Project Milestones</button>
    </div>
    ${executive
      ? renderExecutiveQuarterMilestones(projs, layer, activeTrack, year)
      : `<div class="project-roadmap-guidance">Edit milestones from the project card.</div>${renderProjectQuarterMatrix(projs, layer, activeTrack, year)}`}
  </div>`;
}
```

- [ ] **Step 6: Replace the outer duplicated roadmap header**

In `renderExec()`, keep the printable section identity but render only the consolidated board:

```js
<div class="exec-decision-panel quarterly-roadmap-panel" data-print-section="quarterly-roadmap">
  ${renderQuarterlyBoard(projs, strategyLayer, activeTrack, roadmapYear)}
</div>
```

- [ ] **Step 7: Run focused and baseline tests**

Run:

```powershell
node --test tests/portfolio-roadmap-ui.test.mjs tests/executive-outcome-ui.test.mjs tests/v2-baseline.test.mjs
```

Expected: all tests PASS after updating obsolete baseline assertions that explicitly required the removed heading.

- [ ] **Step 8: Commit only Task 3 files**

```powershell
git add team-2/index.html tests/portfolio-roadmap-ui.test.mjs tests/v2-baseline.test.mjs
git commit -m "feat: consolidate portfolio roadmap views"
```

---

### Task 4: Implement the approved hybrid IoE outcome editor

**Files:**
- Modify: `tests/executive-outcome-ui.test.mjs`
- Modify: `team-2/index.html:500-760`
- Modify: `team-2/index.html:6514-6665`
- Verify: `team-2/js/executive-outcomes.mjs`
- Verify: `tests/executive-outcomes.test.mjs`

**Interfaces:**
- Consumes: `normalizeExecutiveOutcome()`, `renderExecutiveSourceSelect()`, `collectExecutiveOutcomeRows()`, current evidence catalog, section audience, category override, and existing save path.
- Produces: `toggleExecutiveOutcomeEditor(button)`, `syncExecutiveOutcomeReason(select)`, and `deleteExecutiveOutcome(button)`.

- [ ] **Step 1: Add failing hybrid editor assertions**

Append to `tests/executive-outcome-ui.test.mjs`:

```js
test('executive outcomes use compact rows with one inline detail disclosure', () => {
  assert.match(dashboard, /class="exec-outcome-summary"/);
  assert.match(dashboard, /class="exec-outcome-detail"/);
  assert.match(dashboard, /function toggleExecutiveOutcomeEditor\(/);
  assert.match(dashboard, /querySelectorAll\('\.exec-outcome-row\.open'\)/);
  assert.match(dashboard, /class="exec-category-settings"/);
  assert.match(dashboard, /Section settings/);
});

test('status reason is exposed and required only when RAG changes', () => {
  assert.match(dashboard, /function syncExecutiveOutcomeReason\(/);
  assert.match(dashboard, /reasonWrap\.hidden = !changed/);
  assert.match(dashboard, /reason\.required = changed/);
  assert.match(dashboard, /Executive milestone status changes require a reason/);
});

test('executive outcome deletion requires confirmation', () => {
  assert.match(dashboard, /function deleteExecutiveOutcome\(/);
  assert.match(dashboard, /confirm\('Delete this executive outcome\?'\)/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
node --test tests/executive-outcome-ui.test.mjs
```

Expected: FAIL because outcome fields and advanced section settings are currently always expanded.

- [ ] **Step 3: Render a compact outcome summary and hidden detail panel**

Refactor `renderExecutiveOutcomeEditor()` around this structure while retaining existing field classes used by collection:

```js
const healthClass = outcome.manualHealth === 'delayed'
  ? 'red'
  : outcome.manualHealth === 'at-risk' ? 'yellow' : 'green';
const healthOptions = [
  ['on-track', 'Green'],
  ['at-risk', 'Yellow'],
  ['delayed', 'Red'],
];
return `<div class="exec-outcome-row" data-outcome-id="${escHtml(outcome.id || newExecutiveOutcomeId())}"
  data-original-health="${escHtml(outcome.manualHealth)}">
  <button type="button" class="exec-outcome-summary" aria-expanded="false" onclick="toggleExecutiveOutcomeEditor(this)">
    <span class="exec-outcome-summary-text">${escHtml(outcome.text || 'New outcome')}</span>
    <span class="exec-outcome-badge ${healthClass}">${escHtml(executiveOutcomeStatusLabel(outcome.manualProgress, outcome.manualHealth))}</span>
    <span class="exec-outcome-summary-meta">${outcome.sources.length ? `Evidence ${outcome.sources.length}` : 'No evidence'}</span>
    <span class="exec-outcome-chevron">›</span>
  </button>
  <div class="exec-outcome-detail" hidden>
    <input class="fi etm-outcome-text" value="${escHtml(outcome.text)}" placeholder="Management-facing outcome" aria-label="Executive outcome">
    <input class="etm-manual-health" type="hidden" value="${escHtml(outcome.manualHealth)}">
    <div class="exec-outcome-rag-controls" role="group" aria-label="Executive outcome RAG status">
      ${healthOptions.map(([value, label]) => `<button type="button" data-health="${value}"
        class="exec-rag-button ${outcome.manualHealth === value ? 'active' : ''}"
        onclick="setExecutiveOutcomeHealth(this, '${value}')">● ${label}</button>`).join('')}
    </div>
    <label class="exec-outcome-reason-wrap" hidden>
      <span class="fl">Reason for status change</span>
      <textarea class="ft etm-status-reason" aria-label="Executive milestone status change reason">${escHtml(outcome.statusReason || '')}</textarea>
    </label>
    <details class="exec-evidence-details">
      <summary>Evidence (${outcome.sources.length})</summary>
      <div class="exec-outcome-sources">${references.map(renderExecutiveSourceSelect).join('')}</div>
      <button type="button" class="exec-source-add" onclick="addExecutiveOutcomeSource(this)">+ Evidence</button>
    </details>
    <button type="button" class="btn btn-ghost" onclick="deleteExecutiveOutcome(this)">Delete outcome</button>
  </div>
</div>`;
```

Keep `.etm-manual-health`, `.etm-outcome-text`, `.etm-status-reason`, and `.etm-source-select` available so `collectExecutiveOutcomeRows()` remains data-compatible.

- [ ] **Step 4: Add one-at-a-time inline expansion**

```js
function toggleExecutiveOutcomeEditor(button) {
  const row = button.closest('.exec-outcome-row');
  const category = button.closest('.exec-category-editor');
  const open = !row.classList.contains('open');
  category?.querySelectorAll('.exec-outcome-row.open').forEach(item => {
    item.classList.remove('open');
    item.querySelector('.exec-outcome-summary')?.setAttribute('aria-expanded', 'false');
    const detail = item.querySelector('.exec-outcome-detail');
    if (detail) detail.hidden = true;
  });
  row.classList.toggle('open', open);
  button.setAttribute('aria-expanded', String(open));
  const detail = row.querySelector('.exec-outcome-detail');
  if (detail) detail.hidden = !open;
}
window.toggleExecutiveOutcomeEditor = toggleExecutiveOutcomeEditor;
```

- [ ] **Step 5: Make status-change reason conditional and focus invalid rows**

```js
function syncExecutiveOutcomeReason(select) {
  const row = select.closest('.exec-outcome-row');
  const changed = select.value !== row.dataset.originalHealth;
  const reasonWrap = row.querySelector('.exec-outcome-reason-wrap');
  const reason = row.querySelector('.etm-status-reason');
  reasonWrap.hidden = !changed;
  reason.required = changed;
}
window.syncExecutiveOutcomeReason = syncExecutiveOutcomeReason;

function setExecutiveOutcomeHealth(button, health) {
  const row = button.closest('.exec-outcome-row');
  const input = row.querySelector('.etm-manual-health');
  input.value = health;
  row.querySelectorAll('.exec-rag-button').forEach(control => {
    control.classList.toggle('active', control === button);
  });
  syncExecutiveOutcomeReason(input);
}
window.setExecutiveOutcomeHealth = setExecutiveOutcomeHealth;
```

Before throwing the existing missing-reason error in `collectExecutiveOutcomeRows()`, open the row, reveal the detail panel, set `aria-expanded="true"`, and focus the reason field.

- [ ] **Step 6: Confirm deletion and move administrative controls to section settings**

```js
function deleteExecutiveOutcome(button) {
  if (!canManageStrategy()) return;
  if (!confirm('Delete this executive outcome?')) return;
  button.closest('.exec-outcome-row')?.remove();
}
window.deleteExecutiveOutcome = deleteExecutiveOutcome;
```

Wrap section visibility and category override controls in:

```html
<details class="exec-category-settings">
  <summary>Section settings ···</summary>
  <label class="fl">Section visibility</label>
  <select class="fs etm-row-audience" aria-label="Executive section visibility">
    ${EXECUTIVE_AUDIENCE_OPTIONS.map(([value, label]) => `<option value="${escHtml(value)}"
      ${value === audience ? 'selected' : ''}>${escHtml(label)}</option>`).join('')}
  </select>
  <div class="exec-category-override">
    <label class="exec-category-override-toggle">
      <input class="etm-override-enabled" type="checkbox" ${override.enabled ? 'checked' : ''}
        onchange="syncExecutiveCategoryOverride(this)">
      Manual category override
    </label>
    <select class="fs etm-override-progress" ${override.enabled ? '' : 'disabled'}
      aria-label="Category progress override">
      ${[0,25,50,75,100].map(value => `<option value="${value}"
        ${override.progress === value ? 'selected' : ''}>${value}%</option>`).join('')}
    </select>
    <select class="fs etm-override-health" ${override.enabled ? '' : 'disabled'}
      aria-label="Category health override">
      <option value="on-track" ${override.health === 'on-track' ? 'selected' : ''}>On Track</option>
      <option value="at-risk" ${override.health === 'at-risk' ? 'selected' : ''}>At Risk</option>
      <option value="delayed" ${override.health === 'delayed' ? 'selected' : ''}>Delayed</option>
    </select>
    <input class="fi etm-override-reason" value="${escHtml(override.reason || '')}"
      placeholder="Required reason for manual override" ${override.enabled ? '' : 'disabled'}>
  </div>
</details>
```

Move bottom phase labels into a separate advanced settings disclosure without changing `.etm-phase` inputs.

- [ ] **Step 7: Add CSS for compact rows, inline details, direct RAG controls, and responsive layout**

Implement classes referenced above. At widths below 760px, stack summary metadata and detail fields into one column. Preserve visible keyboard focus, use real buttons for disclosures, and do not rely on color alone for RAG labels.

- [ ] **Step 8: Run executive editor, data normalization, access, and release-lock tests**

Run:

```powershell
node --test tests/executive-outcome-ui.test.mjs tests/executive-outcomes.test.mjs tests/executive-access-lock-ui.test.mjs
```

Expected: all tests PASS and existing evidence, role, status-reason, and released-week contracts remain intact.

- [ ] **Step 9: Commit only Task 4 files**

```powershell
git add team-2/index.html tests/executive-outcome-ui.test.mjs
git commit -m "feat: simplify executive outcome editing"
```

---

### Task 5: Complete regression and browser verification

**Files:**
- Verify: `team-2/index.html`
- Verify: `team-2/js/executive-outcomes.mjs`
- Verify: `tests/project-one-page-pdf.test.mjs`
- Verify: `tests/project-editor-drag.test.mjs`
- Verify: `tests/portfolio-roadmap-ui.test.mjs`
- Verify: `tests/executive-outcome-ui.test.mjs`
- Verify: `tests/executive-outcomes.test.mjs`
- Verify: `tests/executive-access-lock-ui.test.mjs`
- Verify: `tests/overview-print-selection.test.mjs`
- Verify: `tests/v2-baseline.test.mjs`

**Interfaces:**
- Consumes: all deliverables from Tasks 1–4.
- Produces: a locally verified, un-deployed v2.0T worktree ready for user review.

- [ ] **Step 1: Run whitespace and complete automated verification**

Run:

```powershell
git diff --check
node --test tests/*.test.mjs
```

Expected: no whitespace errors and every test passes.

- [ ] **Step 2: Restart the local preview from the v2.0T worktree**

Start the existing local HTTP preview at `http://127.0.0.1:4173/team-2/`, then hard-refresh the in-app browser.

- [ ] **Step 3: Verify selected-project PDF output manually**

Open a project card, click the icon with tooltip `Export project PDF`, and confirm the browser print preview contains only the selected project one-page report. Cancel the print dialog and verify the project detail remains open and usable.

- [ ] **Step 4: Verify input selection and drag behavior manually**

In Project Editor, drag across text in milestone names, dates, allocation fields, resource hours, budget values, quarterly goals, risk/actions, and executive outcome fields. Confirm text selection or native control behavior occurs. Then drag a milestone and a workstream from their handles and confirm ordering still works.

- [ ] **Step 5: Verify Portfolio Roadmap hierarchy and role behavior**

Confirm one `Portfolio Roadmap` header, one year selector, two view tabs, and only one executive edit action. Switch tabs, verify project guidance, then preview PM/Engineering, Business/Product, and VIP/Admin visibility using existing role controls.

- [ ] **Step 6: Verify hybrid IoE editing and persistence**

Open the executive editor, switch quarters, expand outcomes, change a RAG state, confirm reason enforcement, add/remove evidence, cancel deletion once, confirm deletion once on a temporary draft outcome, save, close, and reopen. Confirm outcome text, RAG, reason, evidence, section audience, override, and phases persist.

- [ ] **Step 7: Review the final working tree without deploying**

Run:

```powershell
git status --short
git log --oneline -6
```

Expected: only intentional local changes remain; no push or deployment has occurred.
