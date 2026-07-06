# Quarterly Milestone KPI Design

## Goal

Turn Quarterly Milestones from a descriptive roadmap into measurable project and portfolio KPIs without creating relationships to Gantt workstreams.

## Project Editor

Each quarterly milestone stores:

- Quarter and target month.
- Business target.
- Completion: 0%, 25%, 50%, 75%, or 100%.
- Weight: Low (1), Medium (2), or High (3); Medium is the default.
- Health: On Track, At Risk, or Delayed.
- Actual completion date. Selecting 100% fills the selected reporting week's date; the PM may correct it.

Legacy values are interpreted without rewriting historical Firestore documents:

- `planned` becomes 0% and On Track.
- `done` becomes 100% and On Track.
- `at-risk` or `risk` becomes 0% and At Risk.

## KPI Rules

Quarter progress is `sum(completion × weight) / sum(weight)`.

A milestone is overdue when the reporting date is later than the final day of its target month and completion is below 100%. Future milestones do not reduce on-time delivery.

On-time delivery is the count of milestones completed by their deadline divided by milestones due as of the reporting date. The KPI is unavailable when nothing is due.

Quarter health is:

- Red when any milestone is Delayed or overdue.
- Yellow when no red condition exists and at least one milestone is At Risk.
- Green otherwise.

## Overview

For each Q1–Q4 column, show weighted completion, completed/total, At Risk count, overdue count, and on-time delivery. Milestone hover text exposes completion, weight, health, and the calculation contribution.

## Compatibility

Existing project data and unknown nested fields remain intact. No migration or batch deletion is performed.
