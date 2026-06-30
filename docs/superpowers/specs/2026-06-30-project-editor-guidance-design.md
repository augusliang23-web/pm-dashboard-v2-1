# Project Editor Guidance and Gantt Layout Design

## Scope

Improve the v2.0T Project Editor and its project status views without changing stored project data or business rules. “All input fields” means every editable field inside the Project Editor, including its dynamic Risk, Milestone, Schedule, Team, Budget, Discipline Hours, and Admin sections.

## Chosen approach

Use persistent visible labels or compact column headers as the primary guidance. Placeholders remain examples only; browser tooltips and accessibility labels supplement the visible text. This is preferred over tooltip-only guidance because tooltips are hidden on touch devices and placeholders disappear after values are entered.

## Gantt and status layout

- Prevent Gantt content from determining the width of its parent grid by adding `min-width: 0` containment.
- Give the project detail modal more usable width on large screens.
- Collapse the project detail’s two-column layout to one column when the viewport cannot provide a readable Gantt width.
- Keep horizontal scrolling inside the Gantt chart only as a final fallback.
- Apply the same containment rules to the One-page Status Gantt section.
- Do not change dates, workstream order, status, progress, or milestone links.

## Schedule editor guidance

Add a persistent header row matching the controls:

1. Reorder
2. Workstream
3. Start date
4. End date
5. Status
6. Progress %
7. Linked milestone
8. Row actions

Progress is explicitly described as completion from 0% to 100%. Inputs retain specific accessible names and gain suitable examples or titles where useful.

## Team allocation guidance

Add a persistent header row for Name, Role, Allocation %, and Actions. Explain that Allocation % is the person’s planned capacity assigned to this project, from 0% to 100%. Align the input constraint with the existing validation rule of 0–100%.

## Remaining Project Editor audit

- Static fields use visible labels and concise examples where the expected format is not obvious.
- Dynamic Risk, Milestone, Quarterly Milestone, Budget Plan, and Actual Spend rows receive persistent headers and specific accessible names.
- Discipline Hours labels explicitly include “hours”; estimated values remain required and actual values remain optional.
- Delete, reorder, and similar icon buttons receive explicit accessible names and titles.
- Select controls use human-readable option text while preserving stored values.
- Guidance must remain visible after a value is entered; placeholders alone do not satisfy this requirement.

## Validation and compatibility

- Existing saved projects must render without migration.
- Existing Firestore field names and write behavior remain unchanged.
- Automated tests verify the visible guidance contracts, 0–100 constraints, and responsive Gantt containment.
- Browser verification covers the Project Editor, project detail view, and One-page Status at desktop and narrow widths.
- Deployment targets v2.0T only; production v2.0 is unchanged.
