import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ReportAccessError,
  authorizeExecutiveAudienceView,
  authorizeReportAccess
} from '../src/report-access.js';

test('rejects VIP access to an unreleased reporting week', () => {
  assert.throws(
    () => authorizeReportAccess({ email: 'vip@example.com', role: 'vip' }, { isReleased: false }, { mode: 'overview' }),
    ReportAccessError
  );
});

test('accepts a released week and normalizes known dashboard roles', () => {
  const access = authorizeReportAccess(
    { email: 'pm@example.com', role: 'Engineering' },
    { isReleased: false },
    { mode: 'overview' }
  );
  assert.deepEqual(access, { email: 'pm@example.com', role: 'engineering' });
});

test('limits Executive milestone views to the authenticated role', () => {
  assert.equal(authorizeExecutiveAudienceView('vip', 'leadership'), 'leadership');
  assert.equal(authorizeExecutiveAudienceView('pm'), 'pm-engineering');
  assert.equal(authorizeExecutiveAudienceView('business', 'everyone'), 'everyone');
  assert.throws(
    () => authorizeExecutiveAudienceView('engineering', 'business-product'),
    error => error instanceof ReportAccessError && error.statusCode === 403
  );
  assert.equal(authorizeExecutiveAudienceView('unknown-role'), 'everyone');
});
