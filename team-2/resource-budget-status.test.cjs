const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync(`${__dirname}/index.html`, 'utf8');
const match = html.match(/\/\* resource-budget-status:start \*\/([\s\S]*?)\/\* resource-budget-status:end \*\//);
assert.ok(match, 'resource budget status helper is missing');

const context = {};
vm.runInNewContext(`${match[1]}; this.api = {
  normalizeResourceBudgetStatus,
  validateTeamAllocation,
  validateBudgetPlan,
  validateActualSpend,
  getConfirmedResourceProjects,
  getConfirmedBudgetPlanProjects,
  getConfirmedBudgetActualProjects,
  getResourceBudgetCoverage
};`, context);
const api = context.api;

assert.equal(api.normalizeResourceBudgetStatus({}).team.state, 'unconfirmed');
assert.equal(api.normalizeResourceBudgetStatus({}).budgetActual.state, 'not-available');
assert.equal(api.validateTeamAllocation([{ name: '', roleName: 'PM', effortPct: 40 }]).errors.length, 1);
assert.equal(api.validateTeamAllocation([
  { name: 'Augus', roleName: 'PM', effortPct: 40 },
  { name: 'augus', roleName: 'QA', effortPct: 20 }
]).errors.length, 1);
assert.equal(api.validateBudgetPlan({ mode: 'auto', totalEstimated: 0, monthlyPlans: [] }, false).errors.length, 1);
assert.equal(api.validateBudgetPlan({
  mode: 'manual',
  currency: 'USD',
  totalEstimated: 100,
  monthlyPlans: [{ month: '2026-06', categoryName: 'NRE', currency: 'USD', amount: 120 }]
}, false).errors.length, 1);
assert.equal(api.validateActualSpend([]).errors.length, 0);

const projects = [
  { dataStatus: { team: { state: 'confirmed' }, budgetPlan: { state: 'unconfirmed' }, budgetActual: { state: 'draft' } } },
  { dataStatus: { team: { state: 'unconfirmed' }, budgetPlan: { state: 'confirmed' }, budgetActual: { state: 'confirmed' } } },
  {}
];
assert.equal(api.getConfirmedResourceProjects(projects).length, 1);
assert.equal(api.getConfirmedBudgetPlanProjects(projects).length, 1);
assert.equal(api.getConfirmedBudgetActualProjects(projects).length, 1);
assert.deepEqual(JSON.parse(JSON.stringify(api.getResourceBudgetCoverage(projects))), {
  total: 3,
  teamConfirmed: 1,
  teamPending: 2,
  planConfirmed: 1,
  planPending: 2,
  actualConfirmed: 1,
  actualPending: 1,
  actualUnavailable: 1
});

['Resource & Budget', 'Draft data is saved but excluded from Overview KPIs', 'Team allocation', 'Budget planning', 'Actual spend']
  .forEach(text => assert.ok(html.includes(text), `missing editor text: ${text}`));

console.log('resource budget status tests passed');
