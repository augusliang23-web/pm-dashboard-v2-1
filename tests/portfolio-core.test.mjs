import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PROJECT_LEVEL,
  PROJECT_LIFECYCLE,
  filterProjects,
  normalizeProject,
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
