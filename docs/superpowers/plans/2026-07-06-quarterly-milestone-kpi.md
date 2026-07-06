# Quarterly Milestone KPI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add weighted five-stage Quarterly Milestone KPIs to Project Editor, project detail, and Overview.

**Architecture:** Put normalization and KPI calculations in a small pure module, then use the normalized model in the existing editor and renderers. Preserve legacy fields at read time and rely on the existing recursive project mutation merge for Firestore compatibility.

**Tech Stack:** Browser ES modules, vanilla HTML/CSS/JavaScript, Node test runner.

---

### Task 1: Quarterly KPI domain rules

**Files:**
- Create: `team-2/js/quarterly-kpi.mjs`
- Create: `tests/quarterly-kpi.test.mjs`

- [ ] Write failing tests for legacy normalization, weight values, weighted progress, overdue detection, on-time delivery, and quarter health.
- [ ] Run `node --test tests/quarterly-kpi.test.mjs` and confirm missing-module failure.
- [ ] Implement pure normalization and calculation functions.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Project Editor persistence

**Files:**
- Modify: `team-2/index.html`
- Modify: `tests/project-editor-guidance.test.mjs`

- [ ] Write failing markup and wiring assertions for Completion, Weight, Health, and Actual completion date.
- [ ] Run the focused test and confirm failure.
- [ ] Extend editor rows and collection logic; auto-fill completion date from the selected week when completion changes to 100%.
- [ ] Re-run the focused test and confirm it passes.

### Task 3: Detail and Overview KPI rendering

**Files:**
- Modify: `team-2/index.html`
- Create: `tests/quarterly-overview-kpi.test.mjs`

- [ ] Write failing tests for Q1–Q4 KPI summaries and milestone calculation details.
- [ ] Run the focused test and confirm failure.
- [ ] Render quarterly weighted completion, counts, health, overdue, and on-time delivery using the selected reporting date.
- [ ] Re-run the focused test and confirm it passes.

### Task 4: Regression verification

**Files:**
- Modify tests only if an existing assertion describes the retired Quarterly Milestone UI.

- [ ] Run `git diff --check`.
- [ ] Run `$env:TZ='UTC'; node --test`.
- [ ] Confirm every test passes and retain all changes without committing or deploying.
