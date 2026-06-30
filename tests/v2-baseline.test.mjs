import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const dashboardPath = new URL('../team-2/index.html', import.meta.url);
const dashboard = await readFile(dashboardPath, 'utf8');
const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');

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
  assert.ok(dashboard.includes("const DASHBOARD_BASE_COMMIT = '6d9f7bd';"));
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

test('exposes an Overview-only scope control with an independent persisted System default', () => {
  assert.match(dashboard, /id="overviewScope"/);
  assert.match(dashboard, /data-overview-scope="system"[^>]*>System Projects<\/button>/);
  assert.match(dashboard, /data-overview-scope="hardware-module"[^>]*>Hardware Modules<\/button>/);
  assert.match(dashboard, /data-overview-scope="all"[^>]*>All Projects<\/button>/);
  assert.ok(dashboard.includes("const OVERVIEW_SCOPE_KEY = 'team2.overviewScope';"));
  assert.ok(dashboard.includes('normalizeOverviewScope(localStorage.getItem(OVERVIEW_SCOPE_KEY))'));
  assert.ok(dashboard.includes("let overviewScope = 'system';"));
});

test('keeps the portfolio toolbar and filters out of Overview scope calculations', () => {
  const renderStart = dashboard.indexOf('window.render = () =>');
  const renderEnd = dashboard.indexOf('function renderNormal(', renderStart);
  const renderSource = dashboard.slice(renderStart, renderEnd);

  assert.ok(renderSource.includes("portfolioToolbar.style.display = isOverview ? 'none' : 'flex';"));
  assert.ok(renderSource.includes('const overviewProjects = getOverviewProjects(roleVisibleProjects, overviewScope);'));
  assert.ok(renderSource.includes('let portfolioProjects = roleVisibleProjects;'));
  assert.ok(renderSource.includes('portfolioProjects = filterProjects(portfolioProjects, getPortfolioFilters());'));
  assert.ok(renderSource.includes('const metricProjects = isOverview ? overviewProjects : portfolioProjects;'));
  assert.ok(renderSource.includes('const total = metricProjects.length;'));
  assert.ok(renderSource.includes("const critical = metricProjects.filter(p => p.status === 'red').length;"));
  assert.ok(renderSource.includes("const atRisk = metricProjects.filter(p => p.status === 'yellow').length;"));
  assert.ok(renderSource.includes('renderNormal(portfolioProjects);'));
  assert.ok(renderSource.includes('renderExec(overviewProjects, week.summary, roleVisibleProjects);'));
  assert.ok(!renderSource.includes('getOverviewProjects(portfolioProjects'));
});

test('routes every project-based Overview render input through its scoped project list', () => {
  const execStart = dashboard.indexOf('function renderExec(projs, summary, allProjects = projs)');
  const execEnd = dashboard.indexOf('async function saveCurrentWeekQuietly()', execStart);
  const execSource = dashboard.slice(execStart, execEnd);
  const requiredCalls = [
    'renderResourceBudgetOverview(projs)',
    'renderWeeklyTrendPanel(projs)',
    'renderSummaryContent(summary, allProjects, projs)',
    'renderAttentionMatrix(projs, editableDecisionView)',
    'renderRiskActionTable(projs, editableDecisionView)',
    'renderQuarterlyBoard(projs, strategyLayer, activeTrack, roadmapYear)',
  ];

  for (const call of requiredCalls) assert.ok(execSource.includes(call), `expected ${call}`);
  assert.ok(dashboard.includes('getOverviewProjects(week.projects || [], overviewScope)'));
  assert.ok(dashboard.includes('filterOverviewSummaryLines(sanitized, allProjects, scopedProjects)'));
  assert.ok(dashboard.includes('No summary items apply to the selected Overview scope.'));
});

test('Overview scope changes persist locally and redraw once without Firestore writes', () => {
  const handlerStart = dashboard.indexOf('window.setOverviewScope = scope =>');
  const handlerEnd = dashboard.indexOf('\n};', handlerStart);
  const handlerSource = dashboard.slice(handlerStart, handlerEnd);

  assert.ok(handlerStart >= 0);
  assert.ok(handlerSource.includes('overviewScope = normalizeOverviewScope(scope);'));
  assert.ok(handlerSource.includes('localStorage.setItem(OVERVIEW_SCOPE_KEY, overviewScope)'));
  assert.equal((handlerSource.match(/\brender\(\);/g) || []).length, 1);
  assert.doesNotMatch(handlerSource, /setDoc|updateDoc|runTransaction|saveCurrentWeek/);
});

test('mixed Overview lists use conditional project-level badges and empty scope messaging', () => {
  const badgeUses = dashboard.match(/overviewProjectBadge\(p\)/g) || [];
  assert.ok(badgeUses.length >= 7, `expected badges in every mixed list, found ${badgeUses.length}`);
  assert.ok(dashboard.includes('No projects in the selected Overview scope.'));
  assert.ok(dashboard.includes("overviewScope === 'all'"));
});

test('builds portfolio facets from role-visible projects and uses neutral executive totals', () => {
  const renderStart = dashboard.indexOf('window.render = () =>');
  const renderEnd = dashboard.indexOf('function renderNormal(', renderStart);
  const renderSource = dashboard.slice(renderStart, renderEnd);
  const visibilityPosition = renderSource.indexOf(
    "roleVisibleProjects = roleVisibleProjects.filter(p => !p.visibility || p.visibility === 'active');",
  );
  const facetPosition = renderSource.indexOf('refreshPortfolioToolbar(roleVisibleProjects);');

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
  assert.ok(dashboard.includes('mergeResourceEntry('));
  assert.ok(dashboard.includes('resources: editorResources'));
  assert.ok(dashboard.includes('estimatedInput.valueAsNumber'));
  assert.ok(dashboard.includes('actualInput.valueAsNumber'));
  assert.ok(dashboard.includes('validateResourceInput('));
});

test('resource save preserves unknown disciplines and known-entry metadata', () => {
  assert.ok(dashboard.includes('const resources = { ...previousResources };'));
  assert.ok(dashboard.includes('const previousSource = previousResources[discipline]'));
  assert.ok(dashboard.includes('mergeResourceEntry('));
});

test('resource editor retains existing project authorization for admin, PM, and VIP roles', () => {
  assert.ok(dashboard.includes("if (isNew ? currentRole !== 'admin' : !canEditProject(existingProject)) return;"));
  assert.ok(dashboard.includes("if (currentRole === 'admin') return true;"));
  assert.ok(dashboard.includes("if (currentRole === 'vip') return false;"));
});

test('admin role setup reveals the admin-only new project control', () => {
  assert.match(dashboard, /id="addProjectBtn"[^>]+class="btn-icon admin-only"/);
  const adminSetupStart = dashboard.indexOf("if(currentRole === 'admin') {");
  const adminSetupEnd = dashboard.indexOf("else if (currentRole === 'pm')", adminSetupStart);
  assert.ok(
    dashboard.slice(adminSetupStart, adminSetupEnd).includes(
      "document.getElementById('addProjectBtn').style.display = 'inline-flex';",
    ),
  );
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

test('one-page project status view is present and accessible to every project role', () => {
  assert.match(dashboard, /id="onePageStatusModal"/);
  assert.match(dashboard, /id="onePageStatusModal"[^>]+role="dialog"[^>]+aria-modal="true"[^>]+aria-labelledby="onePageTitle"/);
  assert.match(dashboard, /function renderOnePageStatus\(/);
  assert.ok(dashboard.includes('One-page Status'));
  assert.ok(dashboard.includes("openOnePageStatus(document.getElementById('projDetailOverlay').dataset.projectCode)"));
  assert.ok(dashboard.includes("renderProjectGantt(normalized, 'onePageGantt')"));
  assert.ok(dashboard.includes('normalized.highlight'));
  assert.ok(dashboard.includes('normalized.weeklyActions || normalized.weeklyAction'));
  assert.ok(dashboard.includes('normalizeRiskActionRows(normalized)'));
  assert.ok(dashboard.includes('resolveProjectStatusDate(normalized, reportingPeriod)'));
});

test('one-page status preserves paired risk rows and has unique ordered modal wiring', () => {
  const ids = [...dashboard.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.filter(id => id === 'onePageStatusModal').length, 1);
  assert.equal(ids.filter(id => id === 'onePageGantt').length, 1);
  assert.match(dashboard, /id="onePageRiskRows"/);
  assert.ok(dashboard.includes('normalizeRiskActionRows(normalized)'));
  assert.ok(dashboard.includes("row.risk || 'No risk provided.'"));
  assert.ok(dashboard.includes("row.action || 'No action provided.'"));

  const openStart = dashboard.indexOf('window.openOnePageStatus = code =>');
  const openSource = dashboard.slice(openStart, dashboard.indexOf('window.render = () =>', openStart));
  assert.ok(openSource.indexOf('renderOnePageStatus(rawProject, reportingPeriod)') < openSource.indexOf('openAccessibleModal(modal)'));
});

test('one-page status traps focus and isolates the underlying project detail', () => {
  assert.ok(dashboard.includes("event.key === 'Tab'"));
  assert.ok(dashboard.includes('getFocusTrapIndex(currentIndex, focusable.length, event.shiftKey)'));
  assert.ok(dashboard.includes("projectDetail.inert = true"));
  assert.ok(dashboard.includes("projectDetail.setAttribute('aria-hidden', 'true')"));
  assert.ok(dashboard.includes('restoreProjectDetailModalState()'));
  assert.ok(dashboard.includes('modalReturnFocus.focus()'));
});

test('project writes re-authorize at the mutation boundary', () => {
  assert.ok(dashboard.includes("if (isCreatingNew && currentRole !== 'admin') {"));
  assert.ok(dashboard.includes('const targetProject = week.projects.find(project => project.code === editingProjCode);'));
  assert.ok(dashboard.includes('if (!targetProject || !canEditProject(targetProject)) {'));
  assert.ok(dashboard.includes('if (targetIndex < 0) {'));
  assert.ok(dashboard.includes("if (currentRole !== 'admin') return;"));
  assert.ok(dashboard.includes('const deleteIndex = week.projects.findIndex(project => project.code === editingProjCode);'));
  assert.ok(dashboard.includes('if (deleteIndex < 0) {'));
});

test('UAT handoff identifies Firestore rules as the production authorization boundary', () => {
  assert.match(readme, /client authorization checks are defense-in-depth/i);
  assert.match(readme, /verify and deploy Firestore Security Rules/i);
});
