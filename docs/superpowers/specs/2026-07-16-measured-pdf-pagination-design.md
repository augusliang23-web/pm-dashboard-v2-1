# Measured PDF pagination design

## Goal

Replace character-count pagination with measurement-based layout so Executive Summary PDF pages use available A4 space efficiently without clipping cards, generating unframed overflow pages, or creating excessive continuation pages.

## Root cause

The current renderer decides page groups before Chromium lays out the text. It treats a card above a fixed character threshold as a full-page item even when the rendered card occupies only a small fraction of the page. This prevents overflow but creates pages with one short card and large unused areas. Character count cannot predict line wrapping, label-column width, font metrics, or the space remaining after other blocks.

## Page layout model

Executive Summary content becomes one ordered flow of measurable blocks:

1. Portfolio metrics and summary.
2. Priority-project heading and cards.
3. Management-decision heading and cards.
4. Project-context heading, introduction, and cards.

The browser lays out this flow inside explicit A4 landscape page shells. Blocks from different sections may share a page when they fit. A new page is created only when the next complete block cannot fit above the footer safety boundary.

Every page shell contains:

- report kicker and title;
- reporting week and date range;
- body content;
- fixed footer;
- an 8 mm minimum safety gap between the final content and footer.

Page titles are selected from the first content block on that page. Later pages of the same section add `Continued`. When a page contains the end of one section and the start of another, the new section retains its visible in-body heading.

## Measurement and packing

The PDF renderer performs pagination after `page.setContent()` and before `page.pdf()`:

1. Create an empty page shell and append the next flow block.
2. Measure the appended block's bottom edge and the page footer's top edge.
3. Keep the block when at least 8 mm remains before the footer.
4. Otherwise remove it, create a new formal page shell, and retry there.
5. Continue until every block is placed.

This is a greedy first-fit layout in document order. It maximizes use of the current page without changing the meaning or order of the report.

Section headings are attached to their first card so a heading cannot be orphaned at the bottom of a page. Empty sections do not create a page or heading.

## Oversized cards

A single card can contain more text than one page. In that case the renderer splits it explicitly instead of relying on Chromium's physical overflow pagination:

1. Keep the project/card title on every continuation fragment.
2. Prefer splitting between labelled fields such as Movement, Blocker, Next step, Decision / Support needed, and Business impact.
3. If one labelled field alone exceeds the available page height, split its text at the largest word boundary that fits, determined by binary search against the rendered height.
4. Add `Continued` to the repeated field label and card title where appropriate.
5. Apply `overflow-wrap:anywhere` so an unusually long unbroken token cannot widen or overflow the page.

No report content is truncated. Arbitrarily long text increases the number of formal pages but cannot create an unframed page.

## Scope

The measured flow replaces only Executive Summary pagination in Overview PDF output. Other Overview sections and Project PDF sections retain their established page structures. The shared week-plus-date period display remains on every Overview and Project page.

The measured paginator will be implemented as a reusable renderer helper so other report sections can adopt it later without duplicating pagination logic.

## Failure handling

- If the measurement script cannot find required page elements, PDF generation fails with a clear internal pagination error instead of returning a malformed PDF.
- A hard iteration limit prevents an infinite loop when processing malformed content.
- A block that cannot be reduced further receives a dedicated page with word wrapping enabled; its measured boundary must still pass before PDF generation continues.
- Original source nodes remain available until pagination succeeds, so a failed attempt does not silently omit content.

## Verification matrix

Automated and visual tests cover:

1. Compact summary: two projects and two decisions, with no unnecessary continuation page.
2. Week 28 legacy summary: long unbulleted project text and management asks.
3. Mixed lengths: short and long cards sharing a page when measured space allows.
4. Section transition: Priority projects and Management decisions on the same page.
5. Empty sections: no projects, no decisions, or no context.
6. Exact boundary: content ending at the safety limit.
7. Just-over-boundary: only the final non-fitting block moves to the next page.
8. Oversized card: splitting between labelled fields.
9. Oversized field: word-boundary continuation across formal pages.
10. Long unbroken token: wrapping without horizontal overflow.
11. Missing week label or date range: existing period fallbacks remain valid.
12. Full Overview and full Project PDFs: physical page count equals explicit page-shell count and every page retains its header, period, and footer.

For each generated page, tests assert:

- A4 landscape height and page-boundary alignment;
- header and footer remain inside the page;
- final content ends at least 8 mm above the footer;
- no empty formal page exists;
- no page is left underfilled when the next complete block could have fit;
- physical PDF page count equals explicit page-shell count.

The Week 28 fixture also receives a maximum-page regression threshold based on measured content, replacing the current 23-page output with a substantially smaller result while preserving all text.
