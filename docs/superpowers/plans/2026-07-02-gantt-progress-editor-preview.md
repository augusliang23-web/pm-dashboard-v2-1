# Gantt Progress and Editor Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render gray/green progress bars and show the shared Gantt chart as a live preview inside Project Editor.

**Architecture:** Add a pure progress-clamping helper to the existing portfolio core, then make the shared Gantt renderer output a gray bar with a green overlay. Build an editor-only temporary project from current form controls and schedule redraws into a dedicated preview target without writing data.

**Tech Stack:** Vanilla JavaScript, HTML/CSS, Node.js built-in test runner, Firebase-backed static dashboard.

---

### Task 1: Two-color Gantt progress

**Files:**
- Modify: `team-2/js/portfolio-core.mjs`
- Modify: `team-2/index.html`
- Create: `tests/gantt-editor-preview.test.mjs`

- [ ] **Step 1: Write failing progress tests**

Test the pure helper at `0`, `45`, `100`, and invalid/out-of-range values:

```js
assert.deepEqual(getGanttProgressSegments(45), {
  progress: 45,
  completedPercent: 45,
  remainingPercent: 55
});
assert.equal(getGanttProgressSegments(-5).completedPercent, 0);
assert.equal(getGanttProgressSegments(125).completedPercent, 100);
```

Also assert that the dashboard imports the helper and renders nested `.gantt-bar-completed` markup.

- [ ] **Step 2: Run test and verify RED**

Run:

```powershell
node --test tests/gantt-editor-preview.test.mjs
```

Expected: failure because `getGanttProgressSegments` and `.gantt-bar-completed` do not exist.

- [ ] **Step 3: Implement the pure helper**

Export:

```js
export function getGanttProgressSegments(value) {
  const numeric = Number(value);
  const progress = Number.isFinite(numeric) ? Math.min(100, Math.max(0, numeric)) : 0;
  return {
    progress,
    completedPercent: progress,
    remainingPercent: 100 - progress
  };
}
```

- [ ] **Step 4: Render gray base and green overlay**

Import the helper in `team-2/index.html`. Keep `.gantt-bar` gray, add an absolutely positioned green `.gantt-bar-completed`, and keep the percentage text above both layers:

```html
<span class="gantt-bar" ...>
  <span class="gantt-bar-completed" style="width:${segments.completedPercent}%"></span>
  <span class="gantt-bar-label">${segments.progress}%</span>
</span>
```

Remove status-based Gantt bar background colors so workstream status no longer changes the bar color.

- [ ] **Step 5: Run focused tests and commit**

Run:

```powershell
node --test tests/gantt-editor-preview.test.mjs tests/portfolio-core.test.mjs
```

Expected: all focused tests pass.

Commit:

```powershell
git add team-2/js/portfolio-core.mjs team-2/index.html tests/gantt-editor-preview.test.mjs
git commit -m "feat: show completed Gantt progress in green"
```

### Task 2: Live Project Editor Gantt preview

**Files:**
- Modify: `team-2/index.html`
- Modify: `tests/gantt-editor-preview.test.mjs`

- [ ] **Step 1: Write failing editor-preview tests**

Assert that Project Editor contains:

```html
<div id="workstreamPreviewStatus" ...></div>
<div id="workstreamGanttPreview"></div>
```

Assert that the dashboard defines `scheduleWorkstreamPreview`, `renderWorkstreamEditorPreview`, and draft collection using `collectWorkstreams()`, and that Schedule row input, add, delete, move, drag/drop, template replacement, milestone changes, editor opening, and Gantt scale changes schedule a preview refresh.

- [ ] **Step 2: Run test and verify RED**

Run:

```powershell
node --test tests/gantt-editor-preview.test.mjs
```

Expected: failure because the editor preview region and refresh functions are absent.

- [ ] **Step 3: Add the preview region**

Place this below the Schedule validation summary:

```html
<div class="schedule-preview-head">
  <div>
    <div class="proto-section-title">Schedule Preview</div>
    <div class="proto-section-note">Updates from the unsaved schedule above.</div>
  </div>
</div>
<div id="workstreamPreviewStatus" class="schedule-preview-status" role="status"></div>
<div id="workstreamGanttPreview"></div>
```

- [ ] **Step 4: Implement scheduled draft rendering**

Use one animation-frame token:

```js
let workstreamPreviewFrame = 0;

function scheduleWorkstreamPreview() {
  cancelAnimationFrame(workstreamPreviewFrame);
  workstreamPreviewFrame = requestAnimationFrame(() => {
    workstreamPreviewFrame = 0;
    renderWorkstreamEditorPreview();
  });
}
```

`renderWorkstreamEditorPreview()` collects current workstreams and milestone rows, counts invalid dated rows, updates `workstreamPreviewStatus`, and calls:

```js
renderProjectGantt({
  ganttWorkstreams: collectWorkstreams(),
  milestones: collectEditorMilestonesForPreview()
}, 'workstreamGanttPreview');
```

Return safely when Project Editor or the preview target is not open.

- [ ] **Step 5: Wire all draft-changing interactions**

Call `scheduleWorkstreamPreview()` after editor initialization and from Schedule/milestone input handlers, add/delete/move/drag/drop operations, template replacement, and `setGanttScale()`. Ensure preview refresh does not call project-save or Firebase functions.

- [ ] **Step 6: Run focused tests and commit**

Run:

```powershell
node --test tests/gantt-editor-preview.test.mjs tests/project-detail-calendar-gantt.test.mjs tests/v2-baseline.test.mjs
```

Expected: all focused tests pass.

Commit:

```powershell
git add team-2/index.html tests/gantt-editor-preview.test.mjs
git commit -m "feat: preview Gantt changes in Project Editor"
```

### Task 3: Regression and browser verification

**Files:**
- Modify only if a verified defect is found.

- [ ] **Step 1: Run the complete suite**

Run:

```powershell
node --test
git diff --check
```

Expected: zero failures and no whitespace errors.

- [ ] **Step 2: Verify in the local browser**

Open `http://127.0.0.1:4173/team-2/`, edit a dated project, and confirm:

- 0%, partial, and 100% bars use the correct gray/green proportions.
- Name, date, progress, add, delete, and reorder operations update the preview before saving.
- Weekly/Monthly controls redraw the editor preview.
- Invalid/incomplete dates show a note while valid rows remain visible.
- Narrow screens preserve horizontal Gantt scrolling.
- Browser error log is empty.

- [ ] **Step 3: Commit any test-only correction**

If browser verification required no production fix, do not create an empty commit. If a verified defect was corrected, rerun the complete suite and commit the focused correction.
