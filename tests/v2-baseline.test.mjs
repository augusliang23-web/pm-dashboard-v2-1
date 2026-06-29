import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const dashboardPath = new URL('../team-2/index.html', import.meta.url);
const dashboard = await readFile(dashboardPath, 'utf8');

test('locks the Team 2 production dashboard baseline', () => {
  const requiredStrings = [
    'initializeApp(FIREBASE_CONFIG)',
    'getFirestore(app)',
    'getAuth(app)',
    "currentRole === 'vip'",
    'isAdminVipPreview',
    'toggleOverview()',
    'openProjEdit(',
    'saveProjEdit()',
  ];

  for (const requiredString of requiredStrings) {
    assert.ok(
      dashboard.includes(requiredString),
      `expected dashboard to include ${requiredString}`,
    );
  }

  assert.match(
    dashboard,
    /<title>Project Dashboard · LITEON Edition<\/title>/,
  );
  assert.doesNotMatch(dashboard, /prototype\.(?:html|png)/i);
});

test('exposes the v2.0T release and base commit in the UI', () => {
  assert.ok(dashboard.includes("const DASHBOARD_RELEASE = 'v2.0T-portfolio';"));
  assert.ok(dashboard.includes("const DASHBOARD_BASE_COMMIT = 'ddc0e5f';"));
  assert.match(dashboard, /id="dashboardVersion"/);
  assert.ok(
    dashboard.includes(
      "document.getElementById('dashboardVersion').textContent = `${DASHBOARD_RELEASE} · base ${DASHBOARD_BASE_COMMIT}`;",
    ),
  );
});

test('trims portfolio editor values while guarding controls not yet rendered', () => {
  assert.ok(
    dashboard.includes(
      "const control = document.getElementById(id);",
    ),
  );
  assert.ok(
    dashboard.includes(
      "return control ? control.value.trim() : fallback;",
    ),
  );
  assert.ok(
    dashboard.includes(
      "projectType: getEditorPortfolioValue('pe_project_type', previousProject?.projectType ?? previousProject?.type ?? '')",
    ),
  );
});

test('exposes portfolio scope, filter, and project editor controls', () => {
  const requiredIds = [
    'portfolioScope',
    'projectSearch',
    'filterPm',
    'filterRag',
    'filterLifecycle',
    'filterProductFamily',
    'pe_project_level',
    'pe_lifecycle',
    'pe_project_type',
    'pe_classification',
    'pe_product_family',
  ];

  for (const id of requiredIds) {
    assert.match(dashboard, new RegExp(`id=["']${id}["']`));
  }

  const toolbarPosition = dashboard.indexOf('id="portfolioScope"');
  assert.ok(toolbarPosition < dashboard.indexOf('id="normalView"'));
  assert.ok(toolbarPosition < dashboard.indexOf('id="execView"'));
});

test('builds portfolio facets from role-visible projects and uses neutral executive totals', () => {
  const renderStart = dashboard.indexOf('window.render = () =>');
  const renderEnd = dashboard.indexOf('function renderNormal(', renderStart);
  const renderSource = dashboard.slice(renderStart, renderEnd);
  const visibilityPosition = renderSource.indexOf(
    "projs = projs.filter(p => !p.visibility || p.visibility === 'active');",
  );
  const facetPosition = renderSource.indexOf('refreshPortfolioToolbar(projs);');

  assert.ok(visibilityPosition >= 0);
  assert.ok(facetPosition > visibilityPosition);
  assert.ok(dashboard.includes('<div class="exec-panel-note">${total} projects</div>'));
  assert.ok(!dashboard.includes('<div class="exec-panel-note">${total} active projects</div>'));
});

test('schedule editor supports dropping a workstream at the end of the list', () => {
  assert.ok(dashboard.includes('calculateDropIndex(event.clientY'));
  assert.ok(dashboard.includes('container.insertBefore(dragging, destination)'));
});

test('dragover marks a reordered new-project schedule as touched before drop', () => {
  const dragoverStart = dashboard.indexOf("container.addEventListener('dragover', event =>");
  const dragoverEnd = dashboard.indexOf("container.addEventListener('drop', event =>", dragoverStart);
  const dragoverSource = dashboard.slice(dragoverStart, dragoverEnd);
  const insertionPosition = dragoverSource.indexOf('container.insertBefore(dragging, destination)');
  const touchedPosition = dragoverSource.indexOf('newProjectScheduleUntouched = false', insertionPosition);

  assert.ok(insertionPosition >= 0);
  assert.ok(touchedPosition > insertionPosition);
});

test('schedule editor exposes keyboard reorder controls and announcements', () => {
  const scheduleStart = dashboard.indexOf('window.addWorkstreamRow');
  const scheduleEnd = dashboard.indexOf('function replaceWorkstreamTemplate', scheduleStart);
  const scheduleSource = dashboard.slice(scheduleStart, scheduleEnd);
  assert.match(dashboard, /id="workstreamAnnouncements"[^>]+aria-live="polite"/);
  assert.ok(scheduleSource.includes('class="drag-handle"'));
  assert.ok(scheduleSource.includes('onclick="moveWorkstreamRow(this, -1)"'));
  assert.ok(scheduleSource.includes('onclick="moveWorkstreamRow(this, 1)"'));
  assert.ok(!scheduleSource.includes("div.draggable = true"));
});

test('milestone deletion confirms linked schedule updates', () => {
  assert.ok(dashboard.includes('removeMilestoneRow(this)'));
  assert.ok(dashboard.includes("confirm('This milestone is linked"));
  assert.ok(dashboard.includes('validateWorkstreams(ganttWorkstreams, milestoneIds)'));
});

test('resource editor exposes fixed disciplines with estimated and optional actual inputs', () => {
  for (const discipline of ['hardware', 'firmware', 'systemElectrical', 'mechanical', 'pmo']) {
    assert.match(dashboard, new RegExp(`data-resource-discipline=["']${discipline}["']`));
  }
  assert.ok(dashboard.includes('class="fi resource-estimated"'));
  assert.ok(dashboard.includes('class="fi resource-actual"'));
  assert.ok(dashboard.includes('min="0"'));
  assert.ok(dashboard.includes('Actual (optional)'));
});

test('resource save validates user input and only timestamps changed values', () => {
  assert.ok(dashboard.includes('function collectEditorResources(previousResources = {})'));
  assert.ok(dashboard.includes('input.reportValidity()'));
  assert.ok(dashboard.includes('normalizeResourceEntry(previousResources[discipline])'));
  assert.ok(dashboard.includes('estimated === previous.estimated && actual === previous.actual'));
  assert.ok(dashboard.includes('updatedAt: unchanged ? previous.updatedAt : new Date().toISOString()'));
  assert.ok(dashboard.includes('resources: editorResources'));
});

test('resource editor retains existing project authorization for admin, PM, and VIP roles', () => {
  assert.ok(dashboard.includes("if (isNew ? currentRole !== 'admin' : !canEditProject(existingProject)) return;"));
  assert.ok(dashboard.includes("if (currentRole === 'admin') return true;"));
  assert.ok(dashboard.includes("if (currentRole === 'vip') return false;"));
});

test('project detail renders resource values without modifying RAG status', () => {
  assert.match(dashboard, /id="pd_resources"/);
  assert.ok(dashboard.includes("formatResourceValue(entry.actual)"));
  assert.ok(dashboard.includes("formatResourceUpdatedAt(entry.updatedAt)"));
  assert.ok(dashboard.includes('— Not updated'));
  const resourceRenderStart = dashboard.indexOf('function renderProjectResources(');
  const resourceRenderEnd = dashboard.indexOf('\n}', resourceRenderStart);
  assert.ok(resourceRenderStart >= 0);
  assert.ok(!dashboard.slice(resourceRenderStart, resourceRenderEnd).includes('.status'));
});
