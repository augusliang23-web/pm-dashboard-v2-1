import { escapeHtml, reportDocument } from './report-html.js';
import {
  dataTable,
  emptyState,
  metricCard,
  progressBar,
  reportPage,
  statusBadge
} from './report-components.js';
import { buildProjectReportModel } from './report-model.js';
import { buildGanttRange, renderGanttAxis, renderGanttRow } from './project-visuals.js';

function statusPresentation(status) {
  const normalized = String(status || '').toLowerCase();
  const values = {
    green: ['green', 'On Track'],
    yellow: ['yellow', 'At Risk'],
    red: ['red', 'Critical'],
    done: ['green', 'Done'],
    completed: ['green', 'Completed'],
    'in-progress': ['yellow', 'In Progress'],
    'at-risk': ['red', 'At Risk'],
    risk: ['red', 'At Risk'],
    delayed: ['red', 'Delayed'],
    'on-track': ['green', 'On Track'],
    planned: ['neutral', 'Planned'],
    'to-do': ['neutral', 'To Do'],
    'not-started': ['neutral', 'Not Started']
  };
  return values[normalized] || ['neutral', normalized.replace(/-/g, ' ') || 'Not set'];
}

function reportList(items, emptyMessage) {
  if (!items.length) return emptyState(emptyMessage);
  return `<ul class="report-list">${items.slice(0, 8).map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function renderProjectBrief(model) {
  const [tone, label] = statusPresentation(model.status);
  return `<section class="project-brief-grid" data-section-unit="project-brief"><article class="card project-identity-card"><div class="report-kicker">Project brief</div><h2>${escapeHtml(model.name)}</h2><div class="project-code">${escapeHtml(model.projectLevel)} · ${escapeHtml(model.code || 'No project code')}</div>${statusBadge(tone, label)}</article><article class="card project-progress-card"><div class="metric-card-label">Delivery progress</div><div class="project-progress-value">${escapeHtml(model.progress)}%</div>${progressBar(model.progress, tone)}</article><dl class="card project-context-card"><div><dt>Owner</dt><dd>${escapeHtml(model.owner || 'Unassigned')}</dd></div><div><dt>Deputy</dt><dd>${escapeHtml(model.deputy || 'Unassigned')}</dd></div><div><dt>Customer</dt><dd>${escapeHtml(model.customer || 'Not specified')}</dd></div><div><dt>Location</dt><dd>${escapeHtml(model.location || 'Not specified')}</dd></div></dl></section>`;
}

function renderProjectUpdate(model) {
  const cards = [
    ['Highlight', model.highlights, 'No highlight reported.', ''],
    ['Risk / Blocker', model.risks, 'No risk or blocker reported.', 'risk'],
    ['Weekly actions', model.actions, 'No weekly action reported.', '']
  ];
  return `<section class="project-update-grid" data-section-unit="project-update">${cards.map(([title, items, emptyMessage, tone]) => `<article class="card project-update-card ${tone}"><div class="report-kicker">Project update</div><h2>${escapeHtml(title)}</h2>${reportList(items, emptyMessage)}</article>`).join('')}</section>`;
}

function renderProjectSummary(model, selected) {
  const parts = [];
  if (selected.has('project-brief')) parts.push(renderProjectBrief(model));
  if (selected.has('project-update')) parts.push(renderProjectUpdate(model));
  return parts.join('');
}

function sortedMilestones(model) {
  return [...model.milestones].sort((a, b) => String(a?.date || '').localeCompare(String(b?.date || '')));
}

function renderMilestoneTimeline(model) {
  const milestones = sortedMilestones(model);
  if (!milestones.length) return '';
  const compact = milestones.length <= 3
    && milestones.every(item => String(item?.name || '').length <= 28);
  if (compact) {
    return `<section class="milestone-timeline" style="--count:${milestones.length}" data-section-unit="milestone">${milestones.map(item => {
      const [tone, label] = statusPresentation(item?.status || 'planned');
      return `<article class="milestone-step keep-together"><span class="milestone-dot ${tone}"></span><h3>${escapeHtml(item?.name || 'Milestone')}</h3><time>${escapeHtml(item?.date || 'No target date')}</time>${statusBadge(tone, label)}</article>`;
    }).join('')}</section>`;
  }
  return `<ol class="milestone-list" data-section-unit="milestone">${milestones.map(item => {
    const [tone, label] = statusPresentation(item?.status || 'planned');
    return `<li class="milestone-row keep-together"><time>${escapeHtml(item?.date || 'No target date')}</time><strong>${escapeHtml(item?.name || 'Milestone')}</strong>${statusBadge(tone, label)}</li>`;
  }).join('')}</ol>`;
}

function renderGantt(model) {
  if (!model.workstreams.length) return '';
  const range = buildGanttRange(model.workstreams);
  return `<section class="gantt-grid" data-section-unit="gantt">${renderGanttAxis(range)}${range.rows.map(item => renderGanttRow(item, range)).join('')}</section>`;
}

function renderTeamAllocation(model) {
  const rows = model.teamMembers.filter(member => String(member?.name || '').trim()).map(member => [
    escapeHtml(member.name || '-'),
    escapeHtml(member.roleName || member.role || '-'),
    `${escapeHtml(Number(member.effortPct ?? member.effort) || 0)}%`
  ]);
  if (!rows.length) return '';
  return `<article class="card resource-card"><div class="report-kicker">Resource plan</div><h2>Team allocation</h2>${dataTable({ headings: ['Name', 'Role', 'Allocation'], rows, className: 'team-allocation-table' })}</article>`;
}

function renderDisciplineHours(model) {
  const rows = model.disciplines.map(item => [
    escapeHtml(item.label),
    escapeHtml(item.estimated),
    escapeHtml(item.actual === null ? 'Not reported' : item.actual),
    escapeHtml(item.remaining === null ? 'Not available' : item.remaining)
  ]);
  if (!rows.length) return '';
  return `<article class="card resource-card"><div class="report-kicker">Effort tracking</div><h2>Discipline hours</h2>${dataTable({ headings: ['Discipline', 'Estimated', 'Actual', 'Remaining'], rows, className: 'discipline-hours-table' })}</article>`;
}

function renderResourcePage(model, selected) {
  const parts = [];
  if (selected.has('team-allocation')) parts.push(renderTeamAllocation(model));
  if (selected.has('resources')) parts.push(renderDisciplineHours(model));
  const visible = parts.filter(Boolean);
  if (!visible.length) return '';
  return `<section class="project-resource-grid ${visible.length === 1 ? 'single' : ''}" data-section-unit="resource">${visible.join('')}</section>`;
}

function formatMoney(value, currency) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency, maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function renderBudget(model) {
  if (!Object.keys(model.budgetSource || {}).length) return '';
  const budget = model.budget;
  const denominator = Math.max(budget.total, budget.planned, budget.actual, 1);
  const plannedWidth = Math.min(100, budget.planned / denominator * 100);
  const actualWidth = Math.min(100, budget.actual / denominator * 100);
  const varianceTone = budget.variance > 0 ? 'red' : budget.variance < 0 ? 'green' : 'neutral';
  return `<section data-section-unit="budget"><div class="metric-grid budget-metrics">${metricCard('Total budget', formatMoney(budget.total, budget.currency), budget.currency)}${metricCard('Planned', formatMoney(budget.planned, budget.currency), `${Math.round(budget.planned / denominator * 100)}% of scale`)}${metricCard('Actual', formatMoney(budget.actual, budget.currency), `${budget.usedPct}% used`, budget.usedPct > 100 ? 'red' : 'neutral')}${metricCard('Variance', formatMoney(budget.variance, budget.currency), 'Actual minus planned', varianceTone)}</div><article class="card budget-comparison"><div class="report-kicker">Budget comparison</div><h2>Planned versus actual</h2><div class="budget-bar-row"><span>Planned</span><div class="budget-track"><i class="planned" style="width:${plannedWidth.toFixed(2)}%"></i></div><strong>${escapeHtml(formatMoney(budget.planned, budget.currency))}</strong></div><div class="budget-bar-row"><span>Actual</span><div class="budget-track"><i class="actual ${budget.actual > budget.planned ? 'red' : ''}" style="width:${actualWidth.toFixed(2)}%"></i></div><strong>${escapeHtml(formatMoney(budget.actual, budget.currency))}</strong></div></article></section>`;
}

export function renderProjectReportHtml({ week, project, sections }) {
  const model = buildProjectReportModel({ week, project, sections });
  const selected = new Set(model.sections);
  const pages = [];
  const summary = renderProjectSummary(model, selected);
  if (summary) pages.push(reportPage({
    section: 'project-summary', title: model.name, kicker: 'Project report · Executive summary',
    period: model.period, body: summary
  }));
  const milestone = selected.has('milestone') ? renderMilestoneTimeline(model) : '';
  if (milestone) pages.push(reportPage({
    section: 'milestone', title: model.name, kicker: 'Project report · Milestone timeline',
    period: model.period, body: milestone
  }));
  const gantt = selected.has('gantt') ? renderGantt(model) : '';
  if (gantt) pages.push(reportPage({
    section: 'gantt', title: model.name, kicker: 'Project report · Workstream schedule',
    period: model.period, body: gantt
  }));
  const resource = renderResourcePage(model, selected);
  if (resource) pages.push(reportPage({
    section: 'resource', title: model.name, kicker: 'Project report · Resource allocation',
    period: model.period, body: resource
  }));
  const budget = selected.has('budget') ? renderBudget(model) : '';
  if (budget) pages.push(reportPage({
    section: 'budget', title: model.name, kicker: 'Project report · Budget snapshot',
    period: model.period, body: budget
  }));
  return reportDocument({
    title: model.name || model.code || 'Project report',
    period: model.period,
    reportKind: 'project',
    body: pages.join('')
  });
}
