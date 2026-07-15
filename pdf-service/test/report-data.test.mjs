import test from 'node:test';
import assert from 'node:assert/strict';
import { ReportDataError, loadAuthorizedReport } from '../src/report-data.js';

const adapters = {
  verifyIdToken: async token => ({ email: token }),
  getUserByEmail: async email => ({ role: email.startsWith('vip') ? 'vip' : 'pm' }),
  getWeekById: async () => ({
    weekLabel: 'W28 2026',
    isReleased: true,
    projects: [{ code: 'PMS-001', name: 'PMS', teamMembers: [] }]
  })
};

test('loads report content from Firestore adapters rather than request input', async () => {
  const report = await loadAuthorizedReport({
    request: { mode: 'project', weekId: 'W28', projectCode: 'PMS-001', sections: ['project-brief', 'team-allocation'] },
    idToken: 'pm@example.com',
    adapters
  });

  assert.equal(report.project.name, 'PMS');
  assert.deepEqual(report.sections, ['project-brief']);
  assert.equal(report.access.email, 'pm@example.com');
});

test('rejects a missing project before rendering', async () => {
  await assert.rejects(
    () => loadAuthorizedReport({
      request: { mode: 'project', weekId: 'W28', projectCode: 'MISSING', sections: ['project-brief'] },
      idToken: 'pm@example.com',
      adapters
    }),
    ReportDataError
  );
});
