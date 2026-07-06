# Executive Outcome Progress Design

## Goal

Keep portfolio timeline wording suitable for top management while deriving trustworthy progress from project execution data.

## Model

Each timeline bullet becomes an Executive Outcome with:

- Management-facing outcome text.
- Progress mode: Auto or Manual.
- Manual progress: 0%, 25%, 50%, 75%, or 100%.
- Manual health: On Track, At Risk, or Delayed.
- Up to three optional evidence links.

An evidence link points to one project Milestone or Quarterly Milestone by project code, source type, and stable item ID.

## Calculation

Auto progress is the equal-weight average of valid evidence sources, rounded to the nearest whole percent. Quarterly sources use their stored progress. Standard project milestones map To Do to 0%, In Progress to 50%, and Done to 100%.

Auto health uses the worst valid source state: Delayed or overdue is red, At Risk is yellow, otherwise green. Missing links are excluded from the calculation and visibly marked `Needs relink`; when no valid source remains, progress is `N/A` instead of zero.

Manual mode uses the selected five-stage progress and health.

## User Experience

The editor retains management wording and provides Auto/Manual controls plus up to three evidence selectors per outcome. Available sources are labelled `Project › Milestone type › Milestone`.

The portfolio timeline shows a compact progress bar, percentage, health, and Auto/Manual badge under each outcome. Hover details list evidence sources and the selected reporting week.

## Compatibility and Storage

Legacy text bullets load as Manual outcomes with 0% progress and On Track health. They are converted only when an administrator saves the timeline.

Firestore serialization keeps quarter cells and linked-source collections as keyed objects, avoiding nested arrays. Existing historical week documents remain unchanged.
