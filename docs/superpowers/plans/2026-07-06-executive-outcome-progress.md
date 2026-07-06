# Executive Outcome Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Link management-facing portfolio outcomes to project milestones and automatically show evidence-based progress.

**Architecture:** Add a pure outcome normalization and calculation module, evolve timeline serialization without nested arrays, then replace textarea-only editing with structured outcome rows. Existing string bullets remain readable through compatibility normalization.

**Tech Stack:** Vanilla browser ES modules, Firestore-compatible JavaScript objects, Node test runner.

---

### Task 1: Outcome calculation domain

**Files:**
- Create: `team-2/js/executive-outcomes.mjs`
- Create: `tests/executive-outcomes.test.mjs`

- [ ] Write failing tests for legacy normalization, manual progress, auto averaging, missing links, and worst-source health.
- [ ] Run the focused test and confirm the missing module failure.
- [ ] Implement normalization and calculation.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Firestore-safe serialization

**Files:**
- Modify: `executive-timeline-core.js`
- Modify: `tests/executive-timeline-firestore.test.mjs`

- [ ] Write failing tests proving outcome objects remain objects and source links serialize as keyed maps.
- [ ] Implement serialization without nested arrays.
- [ ] Run the focused test and confirm it passes.

### Task 3: Structured editor and evidence selection

**Files:**
- Modify: `team-2/index.html`
- Create: `tests/executive-outcome-ui.test.mjs`

- [ ] Write failing UI wiring tests.
- [ ] Render structured outcome rows with text, mode, progress, health, and maximum three source selectors.
- [ ] Collect normalized outcomes and preserve legacy timeline data.
- [ ] Run focused UI tests.

### Task 4: Executive display

**Files:**
- Modify: `team-2/index.html`
- Modify: `tests/executive-outcome-ui.test.mjs`

- [ ] Write failing tests for progress bar, health, mode, evidence tooltip, and Needs relink.
- [ ] Render outcome progress from current reporting-week project data.
- [ ] Run focused tests.

### Task 5: Verification

- [ ] Run `git diff --check`.
- [ ] Run `$env:TZ='UTC'; node --test`.
- [ ] Keep the implementation local until deployment is explicitly requested.
