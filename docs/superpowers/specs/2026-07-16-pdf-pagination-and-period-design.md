# PDF pagination and reporting-period design

## Goal

Prevent orphaned or blank PDF pages in both Overview and Project reports. Every printed page must have a report header and footer, and must show the reporting week together with its date range.

## Reporting period

The report model will expose one display value built from both stored week fields:

`W28 2026 · Jul 6–Jul 12, 2026`

If either field is unavailable, the remaining non-empty value is shown. If neither is available, the existing `Current reporting period` fallback remains. This value is used in the header and footer of every Overview and Project PDF page.

## Pagination model

The current Executive Summary creates two fixed `.report-page` containers while its variable-height card grids are allowed to overflow. Chromium then creates physical continuation pages that do not contain a new report-page container, causing orphaned cards, headers, and footers.

Executive Summary will instead emit explicit report pages for bounded groups of cards:

- Decision Brief is one formal page when its bounded content fits; management-decision cards that do not fit move into an explicitly titled `Decision Brief · Continued` page.
- Project Context begins on its own formal page and emits additional `Project Context · Continued` pages for later card groups.
- A card is kept whole on a page. The renderer uses conservative group sizes so that old, verbose weekly summaries remain readable without text truncation.
- Each explicit page uses the shared `reportPage` component, which guarantees its own header, reporting period, and footer.

This replaces the incorrect assumption that all summary content always fits two physical A4 landscape pages. Short summaries retain two pages; long summaries add clearly labelled continuation pages rather than generating blank or orphaned pages.

## Shared report behavior

- The period formatter lives in the report model layer, so Overview and Project reports use identical output.
- Existing non-summary pages retain their current one-section-per-page structure.
- Summary cards continue to use `break-inside: avoid`; this becomes safe because card groups are emitted in explicit pages rather than overflowing one wrapper.
- Existing PDF size limit and in-memory generation remain unchanged.

## Verification

Automated coverage will include:

1. Period formatting when both `weekLabel` and `weekDate` are present, plus fallbacks for missing fields.
2. Overview and Project HTML showing the formatted period in page headers and footers.
3. A verbose Executive Summary fixture that previously produced orphaned pages; generated PDF pages must all contain a report-page header/footer and no blank continuation page.
4. The existing concise Executive Summary fixture continuing to render as two landscape pages.
5. Full frontend and PDF-service regression suites, plus visual rendering of the verbose fixture.

## Scope limits

This change does not edit the dashboard's weekly-summary prompt, truncate historical summary text, or alter project data. It only makes PDF page construction and reporting-period presentation robust.
