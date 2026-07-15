import test from 'node:test';
import assert from 'node:assert/strict';
import { ReportRequestError, parseReportRequest } from '../src/report-request.js';

test('accepts an allow-listed project report request without report content', () => {
  const request = parseReportRequest({
    mode: 'project',
    weekId: 'W28-2026',
    projectCode: 'PMS-001',
    sections: ['project-brief', 'milestone']
  });

  assert.deepEqual(request, {
    mode: 'project',
    weekId: 'W28-2026',
    projectCode: 'PMS-001',
    sections: ['project-brief', 'milestone']
  });
});

test('rejects unknown report modes and sections', () => {
  assert.throws(
    () => parseReportRequest({ mode: 'portfolio', weekId: 'W28', sections: ['health-focus'] }),
    ReportRequestError
  );
  assert.throws(
    () => parseReportRequest({ mode: 'overview', weekId: 'W28', sections: ['secret-section'] }),
    /Unknown report section/
  );
});

test('rejects report content supplied by the browser', () => {
  assert.throws(
    () => parseReportRequest({
      mode: 'overview',
      weekId: 'W28',
      sections: ['health-focus'],
      reportHtml: '<h1>untrusted</h1>'
    }),
    /Unexpected report request field: reportHtml/
  );
});

test('requires a project code for project reports and a nonempty section list', () => {
  assert.throws(
    () => parseReportRequest({ mode: 'project', weekId: 'W28', sections: ['milestone'] }),
    /projectCode is required/
  );
  assert.throws(
    () => parseReportRequest({ mode: 'overview', weekId: 'W28', sections: [] }),
    /At least one report section is required/
  );
});
