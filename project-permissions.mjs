export function normalizeProjectMemberIdentity(value, displayNameForEmail) {
  const identity = (value || '').toString().trim();
  if (!identity) return '';
  return (identity.includes('@') ? displayNameForEmail(identity) : identity).toLowerCase();
}

export function canUserEditProject({ role, userEmail, project, displayNameForEmail }) {
  if (role === 'admin') return true;
  if (role === 'vip' || !userEmail) return false;

  const userIdentity = normalizeProjectMemberIdentity(userEmail, displayNameForEmail);
  const ownerIdentity = normalizeProjectMemberIdentity(project?.owner, displayNameForEmail);
  const deputyIdentity = normalizeProjectMemberIdentity(project?.deputy, displayNameForEmail);

  return ownerIdentity === userIdentity || deputyIdentity === userIdentity;
}
