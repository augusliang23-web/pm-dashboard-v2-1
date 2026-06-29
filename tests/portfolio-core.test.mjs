import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PROJECT_LEVEL,
  PROJECT_LIFECYCLE,
  calculateDropIndex,
  createTimelineTicks,
  createDefaultWorkstreams,
  filterProjects,
  normalizeProject,
  normalizeResourceEntry,
  normalizeWorkstream,
  parseIsoDate,
  validateWorkstreams,
} from '../team-2/js/portfolio-core.mjs';

test('normalizeResourceEntry keeps a blank actual unknown and does not calculate remaining', () => {
  assert.deepEqual(normalizeResourceEntry({ estimated: 12, actual: '  ', updatedAt: ' 2026-06-28T12:00:00Z ' }), {
    estimated: 12,
    actual: null,
    remaining: null,
    updatedAt: '2026-06-28T12:00:00Z',
  });
});

test('normalizeResourceEntry accepts numeric strings and floors overrun remaining at zero', () => {
  assert.deepEqual(normalizeResourceEntry({ estimated: '10.5', actual: '12' }), {
    estimated: 10.5,
    actual: 12,
    remaining: 0,
    updatedAt: '',
  });
});

test('normalizeResourceEntry safely normalizes invalid and negative legacy data', () => {
  assert.deepEqual(normalizeResourceEntry({ estimated: 'invalid', actual: -4 }), {
    estimated: 0,
    actual: 0,
    remaining: 0,
    updatedAt: '',
  });
  assert.equal(normalizeResourceEntry({ actual: 'invalid' }).actual, null);
});

test('normalizeProject preserves legacy fields and supplies portfolio defaults', () => {
  const source = {
    code: 'LEG-1',
    type: 'Platform',
    legacyFlag: true,
    projectLevel: 'invalid',
    lifecycle: null,
    ganttWorkstreams: 'legacy-value',
    resources: ['legacy-value'],
  };

  assert.deepEqual(normalizeProject(source), {
    ...source,
    projectLevel: PROJECT_LEVEL.SYSTEM,
    lifecycle: PROJECT_LIFECYCLE.ACTIVE,
    projectType: 'Platform',
    classification: '',
    productFamily: '',
    ganttWorkstreams: [],
    resources: {},
  });
});

test('normalizeProject trims and coerces portfolio text fields', () => {
  const project = normalizeProject({
    type: ' Platform ',
    classification: 42,
    productFamily: '  Power  ',
  });

  assert.equal(project.projectType, 'Platform');
  assert.equal(project.classification, '42');
  assert.equal(project.productFamily, 'Power');
});

test('filterProjects combines portfolio filters and case-insensitive search', () => {
  const projects = [
    {
      code: 'SYS-ALPHA',
      name: 'Orion Controller',
      projectLevel: PROJECT_LEVEL.SYSTEM,
      owner: 'Morgan',
      status: 'yellow',
      lifecycle: PROJECT_LIFECYCLE.ACTIVE,
      productFamily: 'Power',
    },
    {
      code: 'HW-BETA',
      name: 'Orion Board',
      projectLevel: PROJECT_LEVEL.HARDWARE_MODULE,
      owner: 'Morgan',
      status: 'yellow',
      lifecycle: PROJECT_LIFECYCLE.ACTIVE,
      productFamily: 'Power',
    },
    {
      code: 'SYS-GAMMA',
      name: 'Other',
      projectLevel: PROJECT_LEVEL.SYSTEM,
      owner: 'Casey',
      status: 'green',
      lifecycle: PROJECT_LIFECYCLE.COMPLETED,
      productFamily: 'Compute',
    },
  ];

  assert.deepEqual(
    filterProjects(projects, {
      scope: PROJECT_LEVEL.SYSTEM,
      pm: 'morgan',
      rag: 'YELLOW',
      lifecycle: PROJECT_LIFECYCLE.ACTIVE,
      productFamily: 'power',
      search: 'ORION',
    }).map(project => project.code),
    ['SYS-ALPHA'],
  );
});

test('filterProjects all scope does not restrict project level', () => {
  const projects = [
    { code: 'SYS' },
    { code: 'HW', projectLevel: PROJECT_LEVEL.HARDWARE_MODULE },
  ];

  const result = filterProjects(projects, { scope: 'all' });

  assert.deepEqual(result.map(project => project.code), ['SYS', 'HW']);
  assert.equal(result[0].projectLevel, PROJECT_LEVEL.SYSTEM);
  assert.equal(result[0].lifecycle, PROJECT_LIFECYCLE.ACTIVE);
  assert.deepEqual(result[0].ganttWorkstreams, []);
  assert.deepEqual(result[0].resources, {});
});

test('createDefaultWorkstreams returns independent templates for each project level', () => {
  const systems = createDefaultWorkstreams(PROJECT_LEVEL.SYSTEM);
  const modules = createDefaultWorkstreams(PROJECT_LEVEL.HARDWARE_MODULE);
  const secondSystems = createDefaultWorkstreams(PROJECT_LEVEL.SYSTEM);

  assert.deepEqual(systems.map(row => row.name), ['Design', 'Integration', 'Validation', 'Certification', 'Launch']);
  assert.deepEqual(modules.map(row => row.name), ['Documentation', 'BOM Verification', 'Procurement', 'Assembly/Test', 'Certification']);
  systems[0].name = 'Changed';
  assert.equal(secondSystems[0].name, 'Design');
  assert.notStrictEqual(systems, secondSystems);
});

test('normalizeWorkstream supplies safe defaults and preserves a stable identity', () => {
  const source = {
    id: 'ws-custom',
    name: '  Design  ',
    startDate: '2026-07-01',
    endDate: '2026-07-31',
    status: 'at-risk',
    progress: '42',
    milestoneId: ' ms-1 ',
    sortOrder: 8,
  };

  assert.deepEqual(normalizeWorkstream(source, 2), {
    id: 'ws-custom',
    name: 'Design',
    startDate: '2026-07-01',
    endDate: '2026-07-31',
    status: 'at-risk',
    progress: 42,
    milestoneId: 'ms-1',
    sortOrder: 8,
  });
  assert.equal(normalizeWorkstream({}, 2).id, 'workstream-3');
  assert.equal(normalizeWorkstream({}, 2).id, normalizeWorkstream({}, 2).id);
  assert.equal(normalizeWorkstream({ status: 'unknown', progress: 'bad' }, 0).status, 'not-started');
  assert.equal(normalizeWorkstream({ status: 'unknown', progress: 'bad' }, 0).progress, 0);
});

test('validateWorkstreams reports invalid fields per row', () => {
  const errors = validateWorkstreams([
    { name: ' ', startDate: '2026-08-10', endDate: '2026-08-01', progress: -1 },
    { name: 'Valid', startDate: '', endDate: '', progress: 101 },
  ]);

  assert.deepEqual(errors, [
    {
      index: 0,
      fields: {
        name: 'Name is required.',
        endDate: 'End date cannot be before start date.',
        progress: 'Progress must be between 0 and 100.',
      },
    },
    {
      index: 1,
      fields: {
        progress: 'Progress must be between 0 and 100.',
      },
    },
  ]);
  assert.deepEqual(validateWorkstreams([{ name: 'Design', progress: 0 }]), []);
});

test('parseIsoDate rejects malformed and impossible calendar dates', () => {
  assert.equal(parseIsoDate('2026-02-31'), null);
  assert.equal(parseIsoDate('2026-2-01'), null);
  assert.equal(parseIsoDate('not-a-date'), null);
  assert.equal(parseIsoDate('2026-02-28').toISOString(), '2026-02-28T00:00:00.000Z');
});

test('validateWorkstreams rejects invalid dates and missing milestone links', () => {
  assert.deepEqual(validateWorkstreams([{
    name: 'Design',
    startDate: '2026-02-31',
    endDate: 'bad',
    milestoneId: 'deleted',
  }], ['kept']), [{
    index: 0,
    fields: {
      startDate: 'Enter a valid date.',
      endDate: 'Enter a valid date.',
      milestoneId: 'Select an existing milestone.',
    },
  }]);
});

test('createTimelineTicks coarsens long ranges while preserving both endpoints', () => {
  const start = parseIsoDate('2020-01-01');
  const end = parseIsoDate('2035-12-31');
  const ticks = createTimelineTicks(start, end, 'week', 60);

  assert.ok(ticks.length <= 60);
  assert.equal(ticks[0].getTime(), start.getTime());
  assert.equal(ticks.at(-1).getTime(), end.getTime());
  assert.ok(ticks.every((tick, index) => index === 0 || tick > ticks[index - 1]));
});

test('calculateDropIndex supports before, between, and after all rows', () => {
  const bounds = [{ top: 0, bottom: 40 }, { top: 50, bottom: 90 }, { top: 100, bottom: 140 }];

  assert.equal(calculateDropIndex(-1, bounds), 0);
  assert.equal(calculateDropIndex(75, bounds), 2);
  assert.equal(calculateDropIndex(200, bounds), 3);
});
