import test from 'node:test';
import assert from 'node:assert/strict';
import {
  budgetTotals,
  buildOverviewReportModel,
  buildProjectReportModel,
  disciplineRows,
  normalizeProjectForReport
} from '../src/report-model.js';

test('normalizes project values used by every selected project section', () => {
  const model = buildProjectReportModel({
    week: { weekLabel: 'W28 2026' },
    sections: ['gantt', 'resources', 'budget'],
    project: {
      code: 'PMS-001', status: 'RED', progress: 135,
      ganttWorkstreams: [{ name: 'Build', startDate: '2026-07-01', endDate: '2026-07-31', progress: 45 }],
      teamMembers: [{ name: 'A', roleName: 'Firmware', effortPct: 60 }],
      resources: { role_firmware: { role: 'Firmware', estimated: 100, actual: 40 } },
      budget: { currency: 'USD', totalEstimated: 1000, monthlyPlans: [{ amount: 600 }], actuals: [{ amount: 450 }] }
    }
  });

  assert.equal(model.status, 'red');
  assert.equal(model.progress, 100);
  assert.equal(model.period, 'W28 2026');
  assert.equal(model.workstreams[0].name, 'Build');
  assert.deepEqual(model.disciplines[0], { label: 'Firmware', estimated: 100, actual: 40, remaining: 60 });
  assert.equal(model.budget.usedPct, 45);
});

test('resource and budget helpers preserve unknown actuals and zero-valued budgets', () => {
  const project = normalizeProjectForReport({
    teamMembers: [{ name: 'A', roleName: 'PMO', effortPct: 25 }],
    resources: { role_pmo: { role: 'PMO', estimated: 20, actual: '' } },
    budget: { currency: 'SGD', totalEstimated: 0, monthlyPlans: [], actuals: [] }
  });

  assert.deepEqual(disciplineRows(project), [{ label: 'PMO', estimated: 20, actual: null, remaining: null }]);
  assert.deepEqual(budgetTotals(project), {
    currency: 'SGD', total: 0, planned: 0, actual: 0, variance: 0, planGap: 0, usedPct: 0
  });
});

test('builds scoped Overview metrics, risk rows, resources, budget and trend points', () => {
  const systemProject = {
    code: 'SYS-1', name: 'System One', projectLevel: 'system', status: 'red', progress: 40,
    owner: 'Owner', attention: 'action', risk: 'Supplier delay', next: 'Escalate supplier',
    teamMembers: [{ name: 'A', roleName: 'Firmware', effortPct: 120 }],
    quarterlyMilestones: [{ quarter: 'Q3', name: 'Pilot', progress: 50 }],
    budget: { currency: 'USD', totalEstimated: 1000, monthlyPlans: [{ amount: 600 }], actuals: [{ amount: 700, categoryName: 'NRE' }] }
  };
  const moduleProject = { code: 'MOD-1', projectLevel: 'hardware-module', status: 'green', progress: 90 };
  const model = buildOverviewReportModel({
    week: { weekLabel: 'W28 2026', executiveSummary: 'Management summary', projects: [systemProject, moduleProject] },
    trendWeeks: [
      { weekLabel: 'W27', projects: [{ ...systemProject, status: 'yellow', progress: 30 }] },
      { weekLabel: 'W28', projects: [systemProject] }
    ],
    sections: ['health-focus', 'weekly-trend'],
    overviewScope: 'system'
  });

  assert.equal(model.projects.length, 1);
  assert.deepEqual(model.health, { total: 1, green: 0, yellow: 0, red: 1, averageProgress: 40 });
  assert.equal(model.riskRows[0].action, 'Escalate supplier');
  assert.equal(model.resource.totalAllocatedFte, 1.2);
  assert.equal(model.resource.overallocatedPeople, 1);
  assert.equal(model.budget.actual, 700);
  assert.equal(model.quarterlyItems[0].quarter, 'Q3');
  assert.deepEqual(model.trend.map(point => point.label), ['W27', 'W28']);
});
