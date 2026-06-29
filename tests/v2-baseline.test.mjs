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
  assert.ok(dashboard.includes("container.addEventListener('dragover', event =>"));
  assert.ok(dashboard.includes("container.addEventListener('drop', event =>"));
  assert.ok(dashboard.includes('container.appendChild(dragging);'));
});
