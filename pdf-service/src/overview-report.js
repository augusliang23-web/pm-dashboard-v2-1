import { escapeHtml, reportDocument } from './report-html.js';

const TITLES = { 'health-focus': 'Portfolio Health & Focus', 'project-portfolio': 'Project Portfolio', 'risk-actions': 'Risk Actions' };

export function renderOverviewReportHtml({ week, sections }) {
  const projects = Array.isArray(week.projects) ? week.projects : [];
  const parts = [];
  if (sections.includes('health-focus')) parts.push(`<section class="section"><div class="kicker">Overview report</div><h2>${TITLES['health-focus']}</h2><div class="cards"><article class="card"><b>${projects.length}</b><div>Active projects</div></article></div></section>`);
  if (sections.includes('project-portfolio') && projects.length) parts.push(`<section class="section"><h2>${TITLES['project-portfolio']}</h2><table><thead><tr><th>Project</th><th>Owner</th><th>Progress</th></tr></thead><tbody>${projects.map(project => `<tr><td>${escapeHtml(project.name || project.code)}</td><td>${escapeHtml(project.owner || 'Unassigned')}</td><td>${escapeHtml(project.progress ?? 0)}%</td></tr>`).join('')}</tbody></table></section>`);
  const riskProjects = projects.filter(project => String(project.risk || '').trim());
  if (sections.includes('risk-actions') && riskProjects.length) parts.push(`<section class="section"><h2>${TITLES['risk-actions']}</h2><table><thead><tr><th>Project</th><th>Risk</th></tr></thead><tbody>${riskProjects.map(project => `<tr><td>${escapeHtml(project.name || project.code)}</td><td>${escapeHtml(project.risk)}</td></tr>`).join('')}</tbody></table></section>`);
  return reportDocument({ title: 'Overview report', period: week.weekLabel || week.weekDate, body: parts.join('') });
}
