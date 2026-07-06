import test from 'node:test';
import assert from 'node:assert/strict';

import { buildResourceAnalytics } from '../team-2/js/portfolio-core.mjs';

test('resource analytics summarizes FTE by project level and function without exposing member names', () => {
  const result = buildResourceAnalytics([
    {
      projectLevel: 'system',
      teamMembers: [
        { name: 'Alex', role: 'System', effortPct: 60 },
        { name: 'Blair', role: 'PM', effortPct: 50 },
      ],
    },
    {
      projectLevel: 'hardware-module',
      teamMembers: [
        { name: 'Alex', role: 'Hardware', effortPct: 50 },
      ],
    },
    {
      projectLevel: 'software',
      teamMembers: [
        { name: 'Casey', roleName: 'Software', effortPct: 80 },
      ],
    },
  ]);

  assert.equal(result.totalAllocatedFte, 2.4);
  assert.equal(result.overallocatedPeople, 1);
  assert.equal(result.availableCapacityFte, 0.7);
  assert.deepEqual(result.byLevel, {
    system: 1.1,
    'hardware-module': 0.5,
    software: 0.8,
  });
  assert.deepEqual(result.byFunction.find(item => item.role === 'System')?.levels, {
    system: 0.6,
    'hardware-module': 0,
    software: 0,
  });
  assert.equal(JSON.stringify(result).includes('Alex'), false);
});

test('resource analytics treats role names case-insensitively and ignores blank assignments', () => {
  const result = buildResourceAnalytics([
    {
      projectLevel: 'software',
      teamMembers: [
        { name: 'A', role: 'QA', effortPct: 25 },
        { name: 'B', roleName: 'qa', effortPct: 75 },
        { name: '', role: '', effortPct: 0 },
      ],
    },
  ]);

  assert.equal(result.byFunction.length, 1);
  assert.equal(result.byFunction[0].role, 'QA');
  assert.equal(result.byFunction[0].totalFte, 1);
});
