import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getExecutiveTimelineCell,
  getExecutiveTimelineItemText,
  serializeExecutiveMilestoneTimeline
} from '../executive-timeline-core.js';

function containsDirectNestedArray(value) {
  if (Array.isArray(value)) {
    return value.some(Array.isArray) || value.some(containsDirectNestedArray);
  }
  if (value && typeof value === 'object') {
    return Object.values(value).some(containsDirectNestedArray);
  }
  return false;
}

test('serializes executive timeline without Firestore nested arrays', () => {
  const timeline = {
    title: '2026 timeline',
    quarters: ['Q1', 'Q2', 'Q3', 'Q4'],
    rows: [{
      label: 'Solution',
      cells: [['Alpha'], ['Beta', 'Gamma'], [], ['Delta']]
    }],
    phases: ['One', 'Two', 'Three', 'Four']
  };

  const stored = serializeExecutiveMilestoneTimeline(timeline);

  assert.deepEqual(stored.rows[0].cells, {
    q1: ['Alpha'],
    q2: ['Beta', 'Gamma'],
    q3: [],
    q4: ['Delta']
  });
  assert.equal(containsDirectNestedArray(stored), false);
});

test('reads both legacy array cells and Firestore-safe mapped cells', () => {
  assert.deepEqual(getExecutiveTimelineCell([['Alpha'], ['Beta']], 1), ['Beta']);
  assert.deepEqual(
    getExecutiveTimelineCell({ q1: ['Alpha'], q2: ['Beta'] }, 1),
    ['Beta']
  );
});

test('serialization does not mutate the editor timeline', () => {
  const timeline = {
    rows: [{ label: 'Solution', cells: [['Alpha'], [], [], []] }]
  };

  serializeExecutiveMilestoneTimeline(timeline);

  assert.deepEqual(timeline.rows[0].cells, [['Alpha'], [], [], []]);
});

test('reads structured UAT outcomes as their management-facing text', () => {
  assert.equal(
    getExecutiveTimelineItemText({
      text: 'Container integration complete',
      manualProgress: 100,
      manualHealth: 'on-track'
    }),
    'Container integration complete'
  );
  assert.equal(getExecutiveTimelineItemText('Legacy milestone'), 'Legacy milestone');
});

test('production text edits preserve structured UAT outcome metadata', () => {
  const existing = {
    rows: [{
      label: 'Solution',
      cells: {
        q1: [{
          id: 'outcome-1',
          text: 'Container integration',
          manualProgress: 100,
          manualHealth: 'on-track',
          sources: { source1: { projectCode: 'SYS-1', milestoneId: 'ms-1' } }
        }],
        q2: [],
        q3: [],
        q4: []
      }
    }]
  };
  const edited = {
    rows: [{
      label: 'Solution',
      cells: [['Container integration complete'], [], [], []]
    }]
  };

  const stored = serializeExecutiveMilestoneTimeline(edited, existing);

  assert.deepEqual(stored.rows[0].cells.q1[0], {
    id: 'outcome-1',
    text: 'Container integration complete',
    manualProgress: 100,
    manualHealth: 'on-track',
    sources: { source1: { projectCode: 'SYS-1', milestoneId: 'ms-1' } }
  });
});
