import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dashboard = await readFile(new URL('../team-2/index.html', import.meta.url), 'utf8');
const runbook = await readFile(
  new URL('../docs/migration/team-2-excel-import-runbook.md', import.meta.url),
  'utf8',
);

test('Admin-only template settings UI is an accessible trapped dialog', () => {
  assert.match(dashboard, /id="ganttTemplateSettingsBtn"[^>]+admin-only/);
  assert.match(
    dashboard,
    /id="ganttTemplateOverlay"[^>]+role="dialog"[^>]+aria-modal="true"[^>]+aria-labelledby="ganttTemplateTitle"/,
  );
  assert.match(dashboard, /id="systemTemplateList"/);
  assert.match(dashboard, /id="hardwareModuleTemplateList"/);
  assert.match(dashboard, /aria-label="Move workstream up"/);
  assert.match(dashboard, /aria-label="Move workstream down"/);
  assert.ok(dashboard.includes('openAccessibleModal(document.getElementById(\'ganttTemplateOverlay\'))'));
  assert.ok(dashboard.includes('modalReturnFocus.focus()'));
});

test('template handlers recheck Admin role and auth-owned session', () => {
  const start = dashboard.indexOf('// GANTT TEMPLATE SETTINGS');
  const end = dashboard.indexOf('// END GANTT TEMPLATE SETTINGS', start);
  const source = dashboard.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.ok(source.includes("currentRole !== 'admin'"));
  assert.ok(source.includes('isGanttTemplateSessionCurrent(session)'));
  assert.ok(source.includes('session.authUid === (currentUser?.uid || \'\')'));
  assert.ok(source.includes("document.getElementById('ganttTemplateOverlay').classList.contains('open')"));
  assert.ok(dashboard.includes('invalidateGanttTemplateSession();'));
});

test('template config loads with fallback and saves through a revision-checked transaction', () => {
  assert.ok(dashboard.includes("doc(db, 'dashboardSettings', 'team-2-portfolio')"));
  assert.ok(dashboard.includes('await loadGanttTemplateConfig();'));
  assert.ok(dashboard.includes('resolveWorkstreamTemplateConfig('));
  assert.ok(dashboard.includes('catch (error)'));
  assert.ok(dashboard.includes('await runTransaction(db, async transaction =>'));
  assert.ok(dashboard.includes('await transaction.get(settingsRef)'));
  assert.ok(dashboard.includes('liveRevision !== session.revision'));
  assert.ok(dashboard.includes('transaction.set(settingsRef'));
  assert.ok(dashboard.includes('updatedBy: getEmailKey(currentUser)'));
  assert.ok(dashboard.includes('updatedAt: serverTimestamp()'));
  assert.ok(dashboard.includes('revision: liveRevision + 1'));
});

test('failed template saves keep the draft modal open and surface an error', () => {
  const start = dashboard.indexOf('window.saveGanttTemplateSettings');
  const end = dashboard.indexOf('// END GANTT TEMPLATE SETTINGS', start);
  const source = dashboard.slice(start, end);
  const catchStart = source.indexOf('catch (error)');
  const catchSource = source.slice(catchStart);
  assert.ok(catchStart >= 0);
  assert.ok(catchSource.includes("document.getElementById('ganttTemplateError').textContent"));
  assert.doesNotMatch(catchSource, /closeModal\('ganttTemplateOverlay'\)/);
});

test('manual creation, untouched level changes, and confirmed imports use loaded templates', () => {
  assert.ok(dashboard.includes('createDefaultWorkstreams(level, currentGanttTemplateConfig)'));
  assert.ok(dashboard.includes('if (newProjectScheduleUntouched'));
  assert.ok(dashboard.includes('templateConfig,'));
  assert.ok(dashboard.includes('const templateConfig = currentGanttTemplateConfig;'));
});

test('saving new defaults never rewrites existing project schedules', () => {
  const start = dashboard.indexOf('// GANTT TEMPLATE SETTINGS');
  const end = dashboard.indexOf('// END GANTT TEMPLATE SETTINGS', start);
  const source = dashboard.slice(start, end);
  assert.doesNotMatch(source, /\ballWeeks\b|ganttWorkstreams|collection\(db,\s*['"]weeks['"]/);
  assert.match(dashboard, /Existing project schedules are never changed\./);
});

test('runbook documents the Admin-only Firestore Rules boundary', () => {
  assert.match(runbook, /dashboardSettings\/team-2-portfolio/);
  assert.match(runbook, /Firestore Rules[\s\S]+Admin-only/i);
});
