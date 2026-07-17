# PDF Content and Project Pagination Design

## Goal

Improve the professional PDF reports so that Overview includes permission-aware Executive milestones, each Overview project contains complete project detail, and all variable-length Project report sections paginate with readable spacing and repeated continuation context.

## Scope

This change covers three connected PDF behaviors:

1. Add a separately selectable Executive milestones section before Quarterly Roadmap in the Overview PDF.
2. Expand each Overview Project Portfolio entry to include all highlights, all risk/action pairs, and the complete project Gantt chart.
3. Replace browser-driven hard page breaks in the single-project PDF with measured continuation pages.

The implementation preserves A4 landscape output, selectable text, in-memory PDF generation, the 8 MiB response limit, and the existing Cloud Run authorization boundary.

## Executive Milestones

### Selection and ordering

The Overview PDF picker adds `Executive milestones` as an independent option immediately before `Quarterly roadmap`. It is selected by default. A permission-view selector appears only while Executive milestones is selected.

The Overview report order is:

1. Portfolio Health & Focus
2. Weekly trends
3. Executive summary
4. Attention matrix
5. Risk actions
6. Executive milestones
7. Quarterly roadmap
8. Project portfolio
9. Resource analytics
10. Budget overview

### Data source

The PDF service reads `week.strategyLayer.executiveMilestoneTimeline` from the authorized Firestore week document. The browser does not send report content. The service normalizes the four quarters, row labels, audience values, milestone outcome text, and phase labels before rendering.

If the selected week has no saved Executive milestone timeline, the section is omitted instead of inventing or exposing unsaved content.

### Permission views

The request accepts one of these views:

- `leadership`: all Executive milestone rows.
- `all-working-team`: rows tagged `all-working-team` or `everyone`.
- `pm-engineering`: rows tagged `pm-engineering`, `all-working-team`, or `everyone`.
- `business-product`: rows tagged `business-product`, `all-working-team`, or `everyone`.
- `everyone`: only rows tagged `everyone`.

The backend validates the requested view against the authenticated dashboard role:

- `admin` and `vip` may select any view.
- `pm` and `engineering` may select `pm-engineering`, `all-working-team`, or `everyone`.
- `business` and `product` may select `business-product`, `all-working-team`, or `everyone`.
- Unknown roles receive only the `everyone` view.

An unauthorized elevation request is rejected with HTTP 403. The default view is the broadest view permitted for the authenticated role: Leadership for admin/vip, PM/Engineering for pm/engineering, Business/Product for business/product, and Everyone otherwise.

### Layout

Executive milestones render as a formal A4 landscape matrix with quarters as columns and permitted audience categories as rows. Outcomes remain text-first. Long matrices use measured continuation pages, repeat the section title and quarter headings, and never truncate outcome text.

## Overview Project Portfolio

Each project begins on a dedicated Project Portfolio page. The first page contains:

- Project identity, owner, status, and progress.
- All highlight entries.
- All structured risk/action pairs, preserving their stored order and Primary marker.
- Complete Gantt workstream rows, including scheduled and unscheduled workstreams.
- Next milestone, resource load, and budget summary.

The renderer does not use `highlights[0]`, `risks[0]`, or `actions[0]` as the full project representation.

When all content cannot fit on one A4 page, measured pagination creates one or more continuation pages for the same project. Continuation pages use `Project Portfolio · Continued` in the report header and repeat the project name before the remaining content. Ordinary risk pairs and Gantt rows remain whole. A single item that exceeds an otherwise empty page is split only at safe text boundaries.

Projects remain isolated from each other: unused space at the end of one project's final page is not filled with the next project.

## Single-Project PDF Pagination

Variable-length single-project content becomes semantic measured flows rather than relying on native print fragmentation.

### Project summary and update

The project identity block and Project Update cards retain the established visual language. Highlight, Risk / Blocker, and Weekly actions expose complete list items as safe split units. The first page may retain the three-column arrangement when it fits. Continuation pages repeat:

- Project name in the report title.
- `· Continued` suffix.
- Section context such as `Project report · Executive summary`.
- Reporting week and date range in header and footer.
- The continued card title when a card is split.

Every continuation page preserves normal report-body top padding, so no card touches the page boundary.

### Other variable-length sections

- Milestone timeline splits only between complete milestone rows.
- Gantt pages repeat the Gantt axis and split only between workstream rows.
- Resource tables split between table rows and repeat table headings when continuation is required.
- Budget remains a fixed section unless its source data creates a measured overflow, in which case it receives a normal continuation header rather than a browser hard break.

### Oversized items

The existing Chromium measured paginator is generalized to accept safe split units in addition to Executive Summary fields. It greedily fills the current page while maintaining an 8 mm footer safety gap. If one split unit is taller than an empty page, the paginator divides its text at the largest fitting word boundary; unbroken tokens fall back to character boundaries. No source text is discarded.

## Request and Data Flow

1. The Overview picker sends section identifiers plus `executiveAudienceView` only when Executive milestones is selected.
2. The PDF service validates fields, section names, and audience-view authorization.
3. Firestore adapters load the authorized week and project data.
4. Report models normalize Executive milestones, complete risk/action pairs, workstreams, milestones, resources, and budget data.
5. HTML renderers emit semantic measured-flow blocks and safe split units.
6. Chromium lays out the HTML, the paginator creates explicit A4 page shells, and Puppeteer generates the PDF in memory.

## Error Handling and Security

- Unknown section identifiers or audience views return HTTP 400.
- Audience elevation beyond the authenticated role returns HTTP 403.
- Empty Executive milestone data omits that section without producing a blank page.
- Missing Gantt, risk, resource, or budget data renders a concise empty state only where the section was explicitly selected and context is useful.
- All user-controlled text remains HTML-escaped.
- PDF requests continue to reject browser-supplied report content.

## Testing and Acceptance Criteria

Automated tests cover:

- Executive milestones appear before Quarterly Roadmap.
- Every permission view returns only permitted timeline rows.
- Unauthorized audience elevation is rejected.
- Overview Project Portfolio includes every risk/action pair and every Gantt workstream in order.
- A short project remains on one page; dense projects receive correctly titled continuation pages.
- Project Update continuations preserve top spacing, project title, section context, period metadata, and complete list content.
- Milestone, Gantt, and resource continuations retain whole rows and repeat necessary headings.
- Exact-boundary, just-over-boundary, oversized-field, long-token, empty-section, and mixed-section cases do not clip or create blank pages.
- Explicit HTML page count equals physical PDF page count.
- Generated samples remain below the existing 1.5 MiB visual-QA target and the 8 MiB API limit.

Visual QA renders every page of dense Overview and single-project samples to PNG. Acceptance requires readable type, consistent top and footer spacing, repeated continuation context, complete data, no overlap, no clipping, and no ineffective blank pages.
