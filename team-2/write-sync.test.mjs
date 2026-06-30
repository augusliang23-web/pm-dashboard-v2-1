import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  confirmWeekMutation,
  getWriteErrorMessage
} from '../sync-core.js';
import {
  getExecutiveTimelineCell,
  serializeExecutiveMilestoneTimeline
} from '../executive-timeline-core.js';

const source = await readFile(new URL('./index.html', import.meta.url), 'utf8');

test('rejected UAT write leaves the released week unchanged', async () => {
  const week = { weekLabel: 'W26 2026', isReleased: true };

  await assert.rejects(
    confirmWeekMutation(week, { isReleased: false }, async () => {
      throw Object.assign(new Error('denied'), { code: 'permission-denied' });
    }),
    /denied/
  );

  assert.equal(week.isReleased, true);
  assert.match(getWriteErrorMessage({ code: 'permission-denied' }), /permission/i);
});

test('serializes v2.0T executive timeline without nested arrays', () => {
  const stored = serializeExecutiveMilestoneTimeline({
    rows: [{ label: 'Solution', cells: [['Alpha'], ['Beta'], [], []] }]
  });

  assert.deepEqual(stored.rows[0].cells, {
    q1: ['Alpha'],
    q2: ['Beta'],
    q3: [],
    q4: []
  });
  assert.deepEqual(getExecutiveTimelineCell(stored.rows[0].cells, 1), ['Beta']);
});

test('v2.0T wires guarded release and Firestore-safe timeline saves', () => {
  assert.match(
    source,
    /import \{ confirmWeekMutation, getWriteErrorMessage \} from "\.\.\/sync-core\.js"/
  );
  assert.match(
    source,
    /import \{ getExecutiveTimelineCell, serializeExecutiveMilestoneTimeline \} from "\.\.\/executive-timeline-core\.js"/
  );
  assert.match(source, /const savedWeek = await confirmWeekMutation\(/);
  assert.match(source, /await updateDoc\(doc\(db, "weeks", id\), \{/);
  assert.match(
    source,
    /serializeExecutiveMilestoneTimeline\(collectExecutiveMilestoneTimeline\(\)\)/
  );
  assert.match(
    source,
    /finally\s*\{\s*releaseWriteInProgress = false;\s*hideLoader\(\)/s
  );
});
