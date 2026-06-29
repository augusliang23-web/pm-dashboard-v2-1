# v2.0T Multi-Project Portfolio Design

## 1. Purpose

Extend the existing PM Dashboard to manage approximately 10–15 active hardware module projects alongside the existing system projects. Both project levels will be maintained in the dashboard after a one-time Excel migration.

This design preserves the existing v2.0T executive workflow while adding project classification, filtering, editable Gantt schedules, resource planning, and a one-page project status view inspired by the supplied PowerPoint example.

## 2. Baseline and Deployment

- Source baseline: commit `ddc0e5f00e859edaf9355fcb77a694b95718fb26` in the `pm-dashboard-uat` repository.
- Product source file: `team-2/index.html`.
- UAT deployment path: `/pm-dashboard-uat/team-2/`.
- The root-level `index.html` and standalone prototype files are not implementation baselines.
- Existing Firebase integration, authentication, roles, weekly reporting, VIP preview, and Overview behavior must be preserved unless this specification explicitly changes them.

The `?v=ddc0e5f` URL parameter is a cache-busting value, not a pinned deployment reference. Development must branch from the Git commit itself.

## 3. Scope

### In scope

- A unified project data model for system and hardware module projects.
- All Projects, System Projects, and Hardware Modules portfolio views.
- Project classification, search, and combined filtering.
- Editable Gantt schedules for both project levels.
- Separate default Gantt templates for system and hardware module projects.
- A dashboard-native one-page project status view.
- Resource estimates and optional actual-hours tracking.
- A one-time, admin-only Excel import with preview and validation.
- Overview scope switching among System Projects, Hardware Modules, and All Projects.

### Out of scope

- Relationships between system projects and hardware modules.
- Specification maintenance and minor product modifications that do not require formal project tracking.
- Ongoing Excel synchronization or Excel export parity.
- Task-level scheduling, dependencies, critical-path calculation, or replacement of a dedicated project scheduling tool.
- Automatic enforcement that PMs periodically update actual hours.

## 4. Project Model

All formally tracked projects use one core model. A required `projectLevel` field differentiates:

- `system`
- `hardware-module`

Shared project information includes:

- Project ID and project name
- Project level, project type, classification, and product family
- PM and discipline leads
- Lifecycle status: Active, On Hold, or Completed
- RAG status
- Accomplishments and future activities
- Risks and mitigations/actions
- Weekly updates
- Milestones
- Gantt workstreams
- Resource hours and resource update date

Hardware specification maintenance and minor changes are not represented as projects. A hardware effort is added only when it requires formal ownership and project controls such as an independent PM, RAG status, milestones, risks, or resource tracking.

No project-to-project relationship data is stored in this phase.

## 5. Information Architecture

The primary portfolio area provides three scopes:

- **All Projects**
- **System Projects**
- **Hardware Modules**

Each scope uses the same project cards/table patterns and supports:

- Search by project name or Project ID
- PM
- RAG status
- Lifecycle status
- Project type/classification
- Product family

Each project result displays a visible System or Hardware Module badge. Filter selections are remembered independently per user and scope where practical.

The project detail experience contains:

1. **Summary** — ownership, RAG, accomplishments, future activities, risks, and mitigations.
2. **Schedule** — Gantt schedule and key milestones.
3. **Resources** — discipline-level estimated, actual, and remaining hours.

Editing continues through the existing project edit entry point, extended into clearly separated sections so the form does not become one long page.

## 6. Overview

The existing v2.0T Overview layout and executive reading flow remain intact. A scope control is added:

`System Projects | Hardware Modules | All Projects`

Changing the scope recalculates all existing Overview information from the selected project population, including:

- Portfolio KPIs
- RAG counts
- Risk/action information
- Milestone timeline

Project items in All Projects mode display their level badge. The user's most recent Overview scope is remembered.

Detailed Gantt charts and resource tables are not placed on the Overview. They remain in project detail and one-page status views. A compact System/Module project count may be added if it fits the existing KPI area without restructuring the page.

## 7. Gantt Schedule

System and hardware module projects share one Gantt data structure and editor. Each workstream contains:

- Name
- Planned start date
- Planned end date
- Status: Not Started, On Track, At Risk, Delayed, or Completed
- Completion percentage
- Optional linked key milestone
- Sort order

The schedule supports Week and Month scales and displays a Today line. It is a workstream-level roadmap, not a task-level project planner.

### Default system template

- Design
- Integration
- Validation
- Certification
- Launch

### Default hardware module template

- Documentation
- BOM Verification
- Procurement
- Assembly/Test
- Certification

When a project is created, its project level determines the default template. PMs and admins can rename, reorder, add, or remove workstreams. Later changes to a default template do not overwrite schedules in existing projects.

Where a Gantt workstream references an existing milestone, the UI must avoid presenting two independently editable milestone dates as though they were synchronized. The milestone remains the authoritative key-date record; the workstream may display the linked milestone marker.

## 8. One-Page Project Status

Both project levels provide a one-page status view modeled on the supplied PowerPoint layout. It is generated from the same project record and is not separately maintained.

The view includes:

- Project title and PM
- Accomplishments
- Future activities
- Workstream Gantt schedule
- Risks
- Mitigations/actions
- Status date

The initial feature is a dashboard view. PowerPoint file generation is not required in this phase.

## 9. Resources

Resources are tracked by discipline, including Hardware, Firmware, System/Electrical, Mechanical, and PMO where applicable.

Each discipline supports:

- Estimated hours
- Actual hours, optional
- Remaining hours
- Last updated date

Estimated hours are the only required value. When Actual is present, Remaining is calculated as `max(Estimated - Actual, 0)`. When Actual is absent, Remaining displays as unavailable rather than implying that no work has been consumed.

Missing or stale Actual values do not automatically change project RAG status. The interface shows data freshness without penalizing a PM who cannot update actual effort regularly.

## 10. One-Time Excel Import

The Excel workbook is an initial migration source only. After migration and reconciliation, the dashboard is the system of record.

The import is available to admins and follows this sequence:

1. Select the workbook.
2. Parse data without writing to Firebase.
3. Preview normalized records and field mappings.
4. Flag blocking errors and non-blocking warnings.
5. Confirm the exact import set.
6. Write confirmed records.
7. Produce success, skipped, and failed result lists.

Initial mappings include:

- Project Name
- Type
- PMO
- PII MYS Volume
- Project Classification
- Lead Mechanical Engineer
- Lead Electrical/System Engineer
- Lead Firmware Engineer
- Lead Hardware Engineer
- Discipline estimated hours
- PMO Hours Completed as Actual only when the source value is valid and its meaning has been confirmed during import preview

Blank values and `N/A` are normalized to missing values. Numeric fields reject formula errors such as `#DIV/0!`. Duplicate Project IDs and missing project names block the affected row. Import confirmation must identify whether a matching project will be skipped or updated; the default safe behavior is to skip existing Project IDs.

The import is first verified in UAT under `team-2` before production data migration.

## 11. Roles and Permissions

- **Admin:** Create, edit, and delete all projects; run Excel import; maintain default Gantt templates.
- **PM:** Edit projects they own, including summary, schedule, weekly updates, risks, milestones, and optional actual hours.
- **VIP:** Read-only access to permitted Overview scopes, project details, and one-page status views.

Existing v2.0T role behavior remains unchanged outside these additions.

## 12. Reliability and Error Handling

- Import, deletion, and bulk operations require explicit confirmation.
- Firebase write failures retain unsaved form values and show a clear error.
- The UI must not display a success state until the Firebase write succeeds.
- Partial Excel import results must identify each failed row and reason.
- Invalid Gantt date ranges are blocked before save.
- Missing optional resource actuals are handled as unavailable values, not zero.
- Existing unknown legacy project fields must be preserved when records are updated.

## 13. Acceptance Criteria

The feature is acceptable when:

- v2.0T loads and its existing authentication, role, weekly update, project edit, VIP preview, and Overview flows still work.
- Users can switch among All, System, and Hardware Module project scopes and combine supported filters.
- Admins can create both project levels and each receives the correct Gantt template.
- Authorized users can edit Gantt workstreams and view them at Week and Month scales.
- Both project levels can display the generated one-page status view.
- Resource Estimated values work without Actual values; Remaining is calculated only when Actual is available.
- Admins can preview and validate the workbook before any Firebase write.
- The import reports successful, skipped, and failed rows.
- Overview scope switching updates its KPIs, RAG, risks/actions, and milestone timeline without restructuring the existing executive layout.
- VIP users cannot modify project, Gantt, resource, or import data.
- No system-to-module relationship maintenance is present in this phase.

## 14. Delivery Boundaries

Implementation must proceed from the exact v2.0T UAT baseline and continue to deploy under `team-2`. Work should be divided into independently testable increments so portfolio classification, Gantt scheduling, one-page status, resource tracking, Excel migration, and Overview scope switching can be verified without an all-at-once release.
