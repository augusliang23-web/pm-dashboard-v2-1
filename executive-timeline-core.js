import { serializeExecutiveOutcome } from './team-2/js/executive-outcomes.mjs';

export function getExecutiveTimelineCell(cells, index) {
  if (Array.isArray(cells)) {
    return cells[index] ?? [];
  }
  return cells?.[`q${index + 1}`] ?? [];
}

export function serializeExecutiveMilestoneTimeline(timeline = {}) {
  return {
    ...timeline,
    rows: (timeline.rows || []).map(row => ({
      ...row,
      cells: Object.fromEntries(
        Array.from({ length: 4 }, (_, index) => {
          const value = getExecutiveTimelineCell(row.cells, index);
          const items = Array.isArray(value)
            ? value.map(item => (
              item && typeof item === 'object'
                ? serializeExecutiveOutcome(item)
                : String(item)
            )).filter(Boolean)
            : String(value || '').split(/\r?\n/).map(item => item.trim()).filter(Boolean);
          return [`q${index + 1}`, items];
        })
      )
    }))
  };
}
