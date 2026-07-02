# Gantt Progress Colors and Editor Preview Design

## Scope

Enhance the latest v2.0T `team-2` dashboard at hotfix commit `d24961d`.

This change covers:

1. Rendering every Gantt workstream as a gray duration bar with a green completed portion.
2. Showing a live, read-only Gantt preview inside Project Editor directly below the Schedule inputs.

The project data model and Firebase persistence format remain unchanged.

## Gantt Progress Rendering

Each workstream bar uses two visual layers:

- The full planned duration is gray.
- A green overlay covers the completed percentage of that duration.

Expected states:

- `0%`: entirely gray.
- `1–99%`: green completed portion followed by gray remaining portion.
- `100%`: entirely green.

Progress is constrained to the inclusive range of 0–100 before calculating the overlay width. Workstream status remains editable and persisted but no longer controls the bar color. The same rendering applies anywhere the shared Gantt renderer is used.

## Project Editor Preview

Add a `Schedule Preview` region directly below the Schedule input table and its validation summary.

The preview:

- Uses the same Gantt renderer, calendar axis, milestone markers, and Weekly/Monthly controls as the saved project view.
- Reads only the current editor draft.
- Updates when a workstream is added, removed, reordered, or edited.
- Updates when milestone changes affect linked milestone markers.
- Does not write to Firebase or mutate the saved project.
- Shows all valid dated workstreams even when another draft row is incomplete.
- Omits incomplete or invalid dated rows and displays a concise explanatory note.
- Shows the existing empty Gantt state when no draft rows have valid dates.

Rapid input events are coalesced into one scheduled preview redraw so typing does not cause unnecessary repeated rendering.

## Renderer Reuse

Extend the existing `renderProjectGantt()` interface so it can render:

- Single Project saved details.
- The existing one-page renderer.
- Project Editor draft preview.

The renderer remains responsible for calendar-axis layout and visual output. A separate editor-preview function collects draft workstreams and milestones, creates a temporary in-memory project object, and passes it to the shared renderer.

Changing Weekly/Monthly scale redraws every currently visible Gantt target, including the editor preview when Project Editor is open.

## Validation and Error Handling

- Invalid dates never throw during preview rendering.
- Rows without valid start and end dates are omitted from the chart.
- Reversed date ranges are omitted and identified by the preview note.
- Invalid progress values are safely constrained for display; existing save validation still determines whether the project can be saved.
- Preview failures must not close Project Editor or alter the saved project.

## Accessibility

- The editor preview has a visible heading and a named Gantt region.
- Weekly/Monthly controls retain `aria-pressed`.
- The preview status note is readable without relying on color.
- Green and gray segments are supplemented by the visible progress percentage and accessible workstream title.

## Verification

Automated tests cover:

- Gray and green segment rendering at 0%, partial progress, and 100%.
- Shared rendering behavior across saved and editor targets.
- Editor changes scheduling preview refreshes.
- Add, delete, and reorder operations refreshing the preview.
- Incomplete and invalid dates remaining safe.
- Weekly/Monthly controls refreshing the editor preview.

Manual browser verification covers:

- Live changes without saving or closing Project Editor.
- Correct two-color proportions.
- Calendar alignment in Weekly and Monthly views.
- Narrow-screen horizontal scrolling.
- No browser console errors.
