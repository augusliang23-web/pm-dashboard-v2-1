const ROLES = new Set(['admin', 'pm', 'vip', 'engineering', 'business', 'product']);

export class ReportAccessError extends Error {
  constructor(message, statusCode = 403) {
    super(message);
    this.name = 'ReportAccessError';
    this.statusCode = statusCode;
  }
}

export function normalizeDashboardRole(role) {
  const normalized = String(role || 'pm').trim().toLowerCase();
  return ROLES.has(normalized) ? normalized : 'pm';
}

export function authorizeReportAccess(identity, week) {
  const email = String(identity?.email || '').trim().toLowerCase();
  if (!email) throw new ReportAccessError('A verified email address is required.', 401);
  const role = normalizeDashboardRole(identity?.role);
  if (role === 'vip' && week?.isReleased !== true) {
    throw new ReportAccessError('VIP reports are available only for released weeks.');
  }
  return { email, role };
}
