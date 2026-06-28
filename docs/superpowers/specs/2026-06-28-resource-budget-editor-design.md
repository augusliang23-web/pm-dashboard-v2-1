# Resource and Budget Editor Design

## Scope

Improve the v2.0T project editor for team allocation, budget planning, and
actual spend. The change must reduce visual clutter and prevent incomplete or
guessed inputs from affecting management Overview metrics.

This change applies to v2.0T only.

## Core Principle

Missing information must never block a PM from saving the project.

`Save Project` remains available regardless of resource or budget completeness.
Validation controls whether a section can be marked `Confirmed`; it does not
control whether the project can be saved.

## Editor Structure

Replace the current long resource and budget area with one progressive
`Resource & Budget` section containing three independently managed panels:

1. `Team allocation`
2. `Budget planning`
3. `Actual spend`

Each panel header shows its state, a concise summary, and the number of
validation issues. Opening one panel does not discard changes in another.

The top of the section contains a status banner explaining that draft and
unconfirmed data is saved but excluded from management KPIs.

## Section States

### Team Allocation

- `Not confirmed`
- `Confirmed`

New and migrated records default to `Not confirmed`. A PM can return a
confirmed section to `Not confirmed` before editing uncertain information.

### Budget Planning

- `Not confirmed`
- `Confirmed`

The state covers the budget ceiling, budget mode, and monthly planned spend as
one planning dataset.

### Actual Spend

- `Not available`
- `Draft`
- `Confirmed`

`Not available` is a valid state and does not create a warning. Adding an
actual-spend row changes the section to `Draft`. Only confirmed actual spend is
used in management spend KPIs.

## Validation Rules

Validation runs while editing and again when the user selects `Confirm`.

### Team Allocation

Every retained member row requires:

- Name
- Role
- Effort from 0 through 100 percent

Duplicate member names inside one project produce a blocking confirmation
error. A project may confirm an empty team only after the PM explicitly selects
`No allocation information required`; otherwise an empty team remains
unconfirmed.

Cross-project overload is informational in the editor because the PM may not
own other projects. It does not block confirmation.

### Budget Planning

Every retained monthly plan row requires:

- Month
- Category
- Currency
- Amount greater than zero

For `Auto from monthly plan`, total estimated budget is calculated and
read-only. At least one valid monthly plan row is required for confirmation.

For `Manual budget ceiling`, the total must be greater than zero. Monthly plans
may be incomplete, but their converted sum cannot exceed the manual ceiling
without an explicit `Over budget plan acknowledged` confirmation.

Mixed currencies are allowed. Existing FX behavior converts values for
comparison without changing the entered currency.

### Actual Spend

Every retained actual row requires:

- Month
- Category
- Currency
- Amount greater than zero

Notes remain optional. Actual spend can be confirmed without a matching plan,
but the editor shows a non-blocking `Unplanned actual` warning.

## Data Model

Add a `dataStatus` object to each project:

```js
dataStatus: {
  team: {
    state: "unconfirmed" | "confirmed",
    confirmedAt: number | null,
    confirmedBy: string | null
  },
  budgetPlan: {
    state: "unconfirmed" | "confirmed",
    confirmedAt: number | null,
    confirmedBy: string | null,
    overBudgetAcknowledged: boolean
  },
  budgetActual: {
    state: "not-available" | "draft" | "confirmed",
    confirmedAt: number | null,
    confirmedBy: string | null
  }
}
```

Existing project fields remain unchanged. This avoids breaking older weekly
records and keeps the change compatible with the current Firestore document
shape.

If a confirmed section is edited, it automatically returns to its editable
unconfirmed or draft state. Confirmation metadata is cleared.

## Overview Rules

Overview calculations consume confirmed sections only:

- Resource totals and overload counts include projects with confirmed team
  allocation.
- Planned budget, budget variance, and plan-category totals include projects
  with confirmed budget planning.
- Actual spend and burn metrics include confirmed actual spend.

The Overview also shows coverage indicators:

- Confirmed projects
- Pending confirmation
- Not available, where applicable

Pending data may be listed for follow-up but must not be silently treated as
zero and must not affect KPI denominators.

## Migration

Existing v2.0T team and budget data is preserved and initially marked
`Not confirmed` or `Draft`. No existing numeric value is automatically trusted.

Prototype dummy records may receive explicit confirmed states in seed data so
the Overview continues to demonstrate the completed experience. Real
Firestore-loaded records use the conservative migration defaults.

## Error Handling

- Confirmation errors appear within the relevant panel and move focus to the
  first invalid row.
- Non-blocking warnings remain visible but allow confirmation after any required
  acknowledgement.
- Saving an unconfirmed project shows a neutral confirmation message stating
  which sections remain excluded from Overview KPIs.
- Missing or malformed legacy status objects are normalized to conservative
  defaults.

## Testing

Add focused tests for:

- Status normalization for legacy projects
- Team, plan, and actual validation
- Automatic status downgrade after edits
- Auto-budget total calculation
- Manual-budget over-plan acknowledgement
- Overview exclusion of unconfirmed sections
- Overview coverage counts

Perform browser verification at desktop and mobile widths for panel layout,
long role/category names, validation messages, and sticky save controls.

## Out of Scope

- Approval workflow involving a second manager
- File attachments or receipt uploads
- Changes to production v2.0
- Backfilling confirmation metadata for historical records
