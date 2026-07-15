import { authorizeReportAccess, ReportAccessError } from './report-access.js';

export class ReportDataError extends Error {
  constructor(message, statusCode = 404) {
    super(message);
    this.name = 'ReportDataError';
    this.statusCode = statusCode;
  }
}

function hasTeamMembers(project) {
  return Array.isArray(project?.teamMembers) && project.teamMembers.some(member => String(member?.name || '').trim());
}

function hasResources(project) {
  return project?.resources && typeof project.resources === 'object' && Object.keys(project.resources).length > 0;
}

function hasBudget(project) {
  return project?.budget && typeof project.budget === 'object' && Object.keys(project.budget).length > 0;
}

function includedProjectSections(project, sections) {
  return sections.filter(section => {
    if (section === 'team-allocation') return hasTeamMembers(project);
    if (section === 'resources') return hasResources(project);
    if (section === 'budget') return hasBudget(project);
    if (section === 'milestone') return Array.isArray(project?.milestones) && project.milestones.length > 0;
    if (section === 'gantt') return Array.isArray(project?.workstreams) && project.workstreams.length > 0;
    return true;
  });
}

export async function loadAuthorizedReport({ request, idToken, adapters }) {
  const decodedToken = await adapters.verifyIdToken(idToken);
  const email = String(decodedToken?.email || '').trim().toLowerCase();
  if (!email) throw new ReportAccessError('The authentication token does not include an email address.', 401);
  const user = await adapters.getUserByEmail(email);
  const week = await adapters.getWeekById(request.weekId);
  if (!week) throw new ReportDataError('The selected reporting week no longer exists.');
  const access = authorizeReportAccess({ email, role: user?.role }, week, request);

  if (request.mode !== 'project') {
    return { access, week, sections: request.sections, overviewScope: request.overviewScope || 'system' };
  }

  const project = (week.projects || []).find(item => item?.code === request.projectCode);
  if (!project) throw new ReportDataError('The selected project no longer exists in this reporting week.');
  return { access, week, project, sections: includedProjectSections(project, request.sections) };
}
