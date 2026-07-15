import { escapeHtml, reportDocument } from './report-html.js';

function milestones(project) {
  return [...(project.milestones || [])].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
}

function renderMilestones(project) {
  const rows = milestones(project);
  if (!rows.length) return '';
  const compact = rows.length <= 3 && rows.every(row => String(row.name || '').length <= 28);
  if (compact) return `<section class="section"><h2>Milestone timeline</h2><div class="milestone-timeline" style="--count:${rows.length}">${rows.map(row => `<article><b>${escapeHtml(row.name || 'Milestone')}</b><div>${escapeHtml(row.date || 'No target date')}</div><div>${escapeHtml(row.status || 'Planned')}</div></article>`).join('')}</div></section>`;
  return `<section class="section"><h2>Milestone timeline</h2><ol class="milestone-list">${rows.map(row => `<li><b>${escapeHtml(row.date || 'No target date')}</b><span>${escapeHtml(row.name || 'Milestone')}</span><span>${escapeHtml(row.status || 'Planned')}</span></li>`).join('')}</ol></section>`;
}

export function renderProjectReportHtml({ week, project, sections }) {
  const parts = [];
  if (sections.includes('project-brief')) parts.push(`<section class="section cards"><article class="card"><div class="kicker">Project brief</div><h2>${escapeHtml(project.name || project.code)}</h2><div>${escapeHtml(project.code || '')}</div></article><article class="card"><div class="kicker">Delivery progress</div><h2>${escapeHtml(project.progress ?? 0)}%</h2><div>${escapeHtml(project.owner || 'Unassigned')}</div></article></section>`);
  if (sections.includes('project-update')) parts.push(`<section class="section cards">${[['Highlight', project.highlight], ['Risk / Blocker', project.risk], ['Weekly actions', project.weeklyActions]].filter(([, value]) => String(value || '').trim()).map(([title, value]) => `<article class="card"><div class="kicker">Project update</div><h2>${title}</h2><div>${escapeHtml(value)}</div></article>`).join('')}</section>`);
  if (sections.includes('milestone')) parts.push(renderMilestones(project));
  if (sections.includes('team-allocation') && project.teamMembers?.length) parts.push(`<section class="section"><h2>Team allocation</h2><table><thead><tr><th>Name</th><th>Role</th><th>Allocation</th></tr></thead><tbody>${project.teamMembers.map(member => `<tr><td>${escapeHtml(member.name)}</td><td>${escapeHtml(member.roleName || member.role || '')}</td><td>${escapeHtml(member.effortPct ?? member.effort ?? 0)}%</td></tr>`).join('')}</tbody></table></section>`);
  return reportDocument({ title: project.name || project.code || 'Project report', period: week.weekLabel || week.weekDate, body: parts.join('') });
}
