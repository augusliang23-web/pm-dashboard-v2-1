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
  assert.ok(dashboard.includes('getOverviewScopeStorageKey(currentUser?.uid || getEmailKey(currentUser))'));
  assert.ok(dashboard.includes('normalizeOverviewScope(localStorage.getItem(storageKey))'));
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
  assert.ok(renderSource.includes('renderExec(overviewProjects, week.summary, allCurrentProjects);'));
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
  assert.ok(dashboard.includes('getRoleVisibleProjectsForOverview(week.projects || [])'));
  assert.ok(dashboard.includes('filterOverviewSummaryLines(raw, allProjects, scopedProjects)'));
  assert.ok(dashboard.includes('sanitizeSummaryInput(scopedSummary)'));
  assert.ok(dashboard.includes('No summary items apply to the selected Overview scope.'));
});

test('escapes Overview card fields and binds project opening without inline project code', () => {
  const execStart = dashboard.indexOf('function renderExec(');
  const execEnd = dashboard.indexOf('async function saveCurrentWeekQuietly()', execStart);
  const execSource = dashboard.slice(execStart, execEnd);

  assert.ok(dashboard.includes("lines.map(l => `<li style=\"margin-bottom: 4px;\">${escHtml(l)}</li>`)"));
  assert.ok(execSource.includes('const status = normalizeOverviewRagStatus(p.status);'));
  assert.ok(execSource.includes('const progress = normalizeOverviewPercent(p.progress);'));
  assert.ok(execSource.includes('data-project-code="${escHtml(p.code)}"'));
  assert.ok(execSource.includes('${escHtml(p.name)}${overviewProjectBadge(p)}'));
  assert.ok(execSource.includes('${escHtml(p.owner || \'-\')}'));
  assert.ok(execSource.includes('${escHtml(p.code)}'));
  assert.ok(!execSource.includes("ondblclick=\"openProjDetail('${p.code}')\""));
  assert.ok(dashboard.includes("card.addEventListener('dblclick', () => openProjDetail(card.dataset.projectCode));"));
  assert.ok(dashboard.includes("document.getElementById('pd_title').innerHTML = `${escHtml(p.name)}"));
  assert.ok(dashboard.includes('const milestoneStatus = normalizeOverviewMilestoneStatus(m.status);'));
  assert.ok(dashboard.includes('${escHtml(m.name)}'));
  assert.ok(dashboard.includes("${escHtml(m.date || 'No Date')}"));
});

test('escapes standard project cards and binds stored project codes without inline handlers', () => {
  const normalStart = dashboard.indexOf('function renderNormal(');
  const normalEnd = dashboard.indexOf('function renderExec(', normalStart);
  const normalSource = dashboard.slice(normalStart, normalEnd);

  assert.ok(normalSource.includes('const status = normalizeOverviewRagStatus(p.status);'));
  assert.ok(normalSource.includes('const progress = normalizeOverviewPercent(p.progress);'));
  assert.ok(normalSource.includes('data-project-code="${escHtml(p.code)}"'));
  assert.ok(normalSource.includes('data-project-action="edit"'));
  assert.ok(normalSource.includes('${escHtml(p.name)}'));
  assert.ok(normalSource.includes('${escHtml(p.code)}'));
  assert.ok(normalSource.includes('${escHtml(p.owner || \'-\')}'));
  assert.ok(normalSource.includes('${escHtml(highlightText)}'));
  assert.ok(!normalSource.includes("ondblclick=\"openProjDetail('${p.code}')\""));
  assert.ok(!normalSource.includes("openProjEdit('${p.code}')"));
  assert.ok(normalSource.includes("card.addEventListener('dblclick', () => openProjDetail(card.dataset.projectCode));"));
  assert.ok(normalSource.includes("button.addEventListener('click', event =>"));
});

test('gates Overview project mutations per project at render and write boundaries', () => {
  const attentionStart = dashboard.indexOf('function renderAttentionMatrix(');
  const attentionEnd = dashboard.indexOf('function renderRiskActionTable(', attentionStart);
  const riskEnd = dashboard.indexOf('function projectByCode(', attentionEnd);
  const controlsStart = dashboard.indexOf('function bindDecisionControls(');
  const controlsEnd = dashboard.indexOf('// ── UTILS & ACTIONS ──', controlsStart);
  const attentionSource = dashboard.slice(attentionStart, attentionEnd);
  const riskSource = dashboard.slice(attentionEnd, riskEnd);
  const controlsSource = dashboard.slice(controlsStart, controlsEnd);

  assert.ok(attentionSource.includes('const canEdit = editable && canEditProject(p);'));
  assert.ok(attentionSource.includes('${canEdit ? `draggable="true"'));
  assert.ok(attentionSource.includes('${canEdit ? `<div class="attention-select-row">'));
  assert.ok(riskSource.includes('projs.filter(p => canEditProject(p)).map(p =>'));
  assert.ok((controlsSource.match(/if \(!p \|\| !canEditProject\(p\)\) return;/g) || []).length >= 3);
  assert.ok(controlsSource.includes("const p = findCurrentProject(e.dataTransfer.getData('text/plain'));"));
});

test('restricts global strategy and executive timeline controls and handlers to administrators', () => {
  assert.ok(dashboard.includes("const canManageStrategy = () => currentRole === 'admin' && !isAdminVipPreview;"));
  assert.ok(dashboard.includes('${canManageStrategy() ? `<button class="btn btn-ghost no-print"'));
  assert.ok(dashboard.includes('${canManageStrategy() && editableDecisionView ? `<button class="btn btn-primary no-print"'));
  for (const handler of [
    'window.addExecutiveTimelineRow = () =>',
    'window.openStrategyLayerModal = () =>',
    'window.openExecutiveTimelineEditor = () =>',
    'window.addQuarterExecutiveGoalRow = (quarter, goal = {}, layer = getStrategyLayer()) =>',
    'window.saveStrategyLayer = async () =>',
  ]) {
    const start = dashboard.indexOf(handler);
    const end = dashboard.indexOf('\n};', start);
    assert.ok(start >= 0, `expected ${handler}`);
    assert.ok(dashboard.slice(start, end).includes('if (!canManageStrategy()) return;'), `expected admin guard in ${handler}`);
  }
});

test('uses one role-visibility helper for current and historical Overview populations', () => {
  const renderStart = dashboard.indexOf('window.render = () =>');
  const renderEnd = dashboard.indexOf('function renderNormal(', renderStart);
  const renderSource = dashboard.slice(renderStart, renderEnd);
  const trendStart = dashboard.indexOf('function weeklyTrendPoints(');
  const trendEnd = dashboard.indexOf('function renderTrendSvg(', trendStart);
  const trendSource = dashboard.slice(trendStart, trendEnd);

  assert.ok(renderSource.includes('const allCurrentProjects = enrichProjectsPrototype(week.projects || []);'));
  assert.ok(renderSource.includes('const roleVisibleProjects = getRoleVisibleProjectsForOverview(allCurrentProjects);'));
  assert.ok(renderSource.includes('renderExec(overviewProjects, week.summary, allCurrentProjects);'));
  assert.ok(trendSource.includes('getRoleVisibleProjectsForOverview(week.projects || [])'));
  assert.ok(trendSource.includes('getOverviewProjects('));
});

test('loads and stores Overview scope under the authenticated user key', () => {
  assert.ok(dashboard.includes("let overviewScope = 'system';"));
  assert.ok(dashboard.includes('function loadOverviewScopeForCurrentUser()'));
  assert.ok(dashboard.includes('getOverviewScopeStorageKey(currentUser?.uid || getEmailKey(currentUser))'));
  assert.ok(dashboard.includes('overviewScope = normalizeOverviewScope(localStorage.getItem(storageKey));'));
  assert.ok(dashboard.includes('loadOverviewScopeForCurrentUser();'));
  assert.ok(dashboard.includes("overviewScope = 'system';"));
  assert.ok(dashboard.includes('localStorage.setItem(storageKey, overviewScope)'));
  assert.ok(!dashboard.includes('localStorage.getItem(OVERVIEW_SCOPE_KEY)'));
  assert.ok(!dashboard.includes('localStorage.setItem(OVERVIEW_SCOPE_KEY, overviewScope)'));
});

test('labels the global timeline and renders scoped empty panel states', () => {
  assert.ok(dashboard.includes('Portfolio-wide executive timeline'));
  for (const emptyText of [
    'No projects in the selected Overview scope for resource or budget reporting.',
    'No projects in the selected Overview scope for risk reporting.',
    'No projects in the selected Overview scope for the quarterly roadmap.',
  ]) {
    assert.ok(dashboard.includes(emptyText), `expected ${emptyText}`);
  }
});

test('Overview scope changes persist locally and redraw once without Firestore writes', () => {
  const handlerStart = dashboard.indexOf('window.setOverviewScope = scope =>');
  const handlerEnd = dashboard.indexOf('\n};', handlerStart);
  const handlerSource = dashboard.slice(handlerStart, handlerEnd);

  assert.ok(handlerStart >= 0);
  assert.ok(handlerSource.includes('overviewScope = normalizeOverviewScope(scope);'));
  assert.ok(handlerSource.includes('localStorage.setItem(storageKey, overviewScope)'));
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
  const visibilityPosition = renderSource.indexOf('const roleVisibleProjects = getRoleVisibleProjectsForOverview(allCurrentProjects);');
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
  const guardStart = dashboard.indexOf('function canEditProject(');
  const guardEnd = dashboard.indexOf('\n}', guardStart);
  const guardSource = dashboard.slice(guardStart, guardEnd);
  assert.ok(guardSource.includes('projectOwnershipMatchesIdentity(proj'));
  assert.doesNotMatch(guardSource, /\.includes\(/);
});

test('project editor inserts hostile owner labels as option text instead of innerHTML', () => {
  const helperStart = dashboard.indexOf('function replaceProjectEditorOptions(');
  const helperEnd = dashboard.indexOf('\n}', helperStart) + 2;
  assert.ok(helperStart >= 0);
  const helperSource = dashboard.slice(helperStart, helperEnd);
  assert.doesNotMatch(helperSource, /innerHTML/);

  const select = {
    children: [],
    innerHTML: '',
    replaceChildren() {
      this.children = [];
      this.innerHTML = '';
    },
    appendChild(option) {
      this.children.push(option);
    },
  };
  const document = {
    getElementById: () => select,
    createElement: () => ({ value: '', textContent: '', selected: false }),
  };
  const replaceProjectEditorOptions = Function(
    'document',
    `${helperSource}; return replaceProjectEditorOptions;`,
  )(document);
  const hostile = '<img onerror=alert(1)>';

  replaceProjectEditorOptions('pe_owner', [hostile], hostile);

  assert.equal(select.innerHTML, '');
  assert.equal(select.children[0].textContent, hostile);
  assert.equal(select.children[0].selected, true);
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
  assert.ok(dashboard.includes('applyProjectSave(liveSnapshot.data(), {'));
  assert.ok(dashboard.includes('applyProjectDelete(liveSnapshot.data(), {'));
  assert.ok(dashboard.includes('role: currentRole'));
  assert.ok(dashboard.includes('canEdit: project => canEditProject(project)'));
  assert.ok(dashboard.includes('await transaction.get(targetWeekRef)'));
  assert.ok(dashboard.includes("if (currentRole !== 'admin') return;"));
  assert.ok(dashboard.includes('transaction.update(targetWeekRef'));
});

test('UAT handoff identifies Firestore rules as the production authorization boundary', () => {
  assert.match(readme, /client authorization checks are defense-in-depth/i);
  assert.match(readme, /verify and deploy Firestore Security Rules/i);
});
