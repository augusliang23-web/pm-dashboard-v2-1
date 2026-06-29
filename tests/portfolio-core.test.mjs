import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PROJECT_LEVEL,
  PROJECT_LIFECYCLE,
  createDefaultWorkstreams,
  filterProjects,
  normalizeProject,
  normalizeWorkstream,
  validateWorkstreams,
} from '../team-2/js/portfolio-core.mjs';

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
