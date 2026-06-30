export class ProjectMutationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ProjectMutationError';
    this.code = code;
  }
}

function liveProjects(week) {
  if (!week || typeof week !== 'object' || !Array.isArray(week.projects)) {
    throw new ProjectMutationError(
      'invalid-week',
      'The selected week has invalid project data. Refresh the dashboard and try again.',
    );
  }
  return week.projects;
}

function trimmedIdentity(draft) {
  const name = String(draft?.name ?? '').trim();
  const code = String(draft?.code ?? '').trim();
  if (!name) {
    throw new ProjectMutationError('blank-name', 'Project name is required.');
  }
  if (!code) {
    throw new ProjectMutationError('blank-code', 'Project code is required.');
  }
  return { name, code };
}

function assertUniqueCode(projects, code, excludedIndex = -1) {
  const normalizedCode = code.toLocaleLowerCase();
  const duplicate = projects.some((project, index) => (
    index !== excludedIndex
    && String(project?.code ?? '').trim().toLocaleLowerCase() === normalizedCode
  ));
  if (duplicate) {
    throw new ProjectMutationError(
      'duplicate-code',
      `A project with code "${code}" already exists. Choose a unique code.`,
    );
  }
}

export function applyProjectSave(week, options = {}) {
  const projects = liveProjects(week);
  const {
    draft,
    originalCode,
    isNew,
    role,
    canEdit,
    lastModifiedBy,
  } = options;

  if (isNew) {
    if (role !== 'admin') {
      throw new ProjectMutationError(
        'create-forbidden',
        'Only administrators can create projects. Refresh to update your permissions.',
      );
    }
    const identity = trimmedIdentity(draft);
    assertUniqueCode(projects, identity.code);
    const project = { ...draft, ...identity };
    return {
      project,
      week: {
        ...week,
        projects: [...projects, project],
        lastModifiedBy,
      },
    };
  }

  const targetIndex = projects.findIndex(project => project?.code === originalCode);
  if (targetIndex < 0) {
    throw new ProjectMutationError(
      'missing-target',
      'This project no longer exists in the selected week. Close and reopen the editor.',
    );
  }
  const targetProject = projects[targetIndex];
  const authorized = role === 'admin'
    || (role === 'pm' && typeof canEdit === 'function' && canEdit(targetProject));
  if (!authorized) {
    throw new ProjectMutationError(
      'edit-forbidden',
      'Your permission to edit this project changed. Refresh the dashboard and try again.',
    );
  }
  const identity = trimmedIdentity(draft);
  assertUniqueCode(projects, identity.code, targetIndex);

  const project = { ...targetProject, ...draft, ...identity };
  const nextProjects = [...projects];
  nextProjects[targetIndex] = project;
  return {
    project,
    week: {
      ...week,
      projects: nextProjects,
      lastModifiedBy,
    },
  };
}

export function applyProjectDelete(week, options = {}) {
  const projects = liveProjects(week);
  const { originalCode, role, lastModifiedBy } = options;
  if (role !== 'admin') {
    throw new ProjectMutationError(
      'delete-forbidden',
      'Only administrators can delete projects. Refresh to update your permissions.',
    );
  }

  const targetIndex = projects.findIndex(project => project?.code === originalCode);
  if (targetIndex < 0) {
    throw new ProjectMutationError(
      'missing-target',
      'This project no longer exists in the selected week. Close and reopen the editor.',
    );
  }
  const deletedProject = projects[targetIndex];
  return {
    deletedProject,
    week: {
      ...week,
      projects: projects.filter((_, index) => index !== targetIndex),
      lastModifiedBy,
    },
  };
}
