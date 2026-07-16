import { REPORT_CSS } from './report-theme.js';

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

export function reportDocument({ title, period, body, reportKind = 'report' }) {
  const safeKind = String(reportKind || 'report').replace(/[^A-Za-z0-9_-]/g, '') || 'report';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${REPORT_CSS}</style></head><body><div class="report-document ${safeKind}" data-period="${escapeHtml(period || '')}">${body}</div></body></html>`;
}
