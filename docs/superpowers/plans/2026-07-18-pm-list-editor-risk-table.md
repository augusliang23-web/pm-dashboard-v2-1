# PM List Editor and Risk Pair Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Word/Outlook-style list controls to every Project Editor multiline field, restrict Risk/Action resizing to the vertical axis, and render paired risks and actions as a two-column Single Project table.

**Architecture:** Put all list parsing, normalization, selection transforms, and safe nested HTML rendering in a dependency-free ES module. Keep DOM construction and editor lifecycle wiring in `index.html`, preserve existing Firestore strings and Risk/Action identities, and clean stored list prefixes at the PDF model boundary.

**Tech Stack:** HTML/CSS, browser ES modules, Node.js built-in test runner, Firebase-backed existing dashboard, PDF service ES modules.

## Global Constraints

- Base all work on production v2.1 commit `6c7868d`.
- Do not change Firestore field names or require a data migration.
- Apply list editing only to Highlight, Weekly Key Actions, Risk / Blocker, and Required Action fields in the root dashboard.
- Keep Risk and Required Action independently resizable in the vertical direction only.
- Preserve Risk/Action pair identity, Primary selection, project authorization, released-week locking, and transaction behavior.
- Do not modify the `team-2` dashboard.
- Treat the pre-existing `team-2/trend-summary.test.cjs` failure as the accepted baseline exception; introduce no additional failures.

---

### Task 1: List document model and transforms

**Files:**
- Create: `js/list-editor.mjs`
- Create: `tests/list-editor.test.mjs`

**Interfaces:**
- Produces: `normalizeListText(value: unknown): string`
- Produces: `applyListCommand(value: string, selectionStart: number, selectionEnd: number, command: 'bullet' | 'number' | 'indent' | 'outdent'): { value: string, selectionStart: number, selectionEnd: number }`
- Produces: `handleListEnter(value: string, selectionStart: number, selectionEnd: number): { value: string, selectionStart: number, selectionEnd: number }`
- Produces: `handleListPaste(value: string, selectionStart: number, selectionEnd: number, pastedText: string): { value: string, selectionStart: number, selectionEnd: number }`
- Produces: `getSelectionListType(value: string, selectionStart: number, selectionEnd: number): 'bullet' | 'number' | ''`
- Produces: `renderListHtml(value: unknown, emptyHtml?: string): string`

- [ ] **Step 1: Write failing normalization and rendering tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyListCommand,
  getSelectionListType,
  handleListEnter,
  handleListPaste,
  normalizeListText,
  renderListHtml,
} from '../js/list-editor.mjs';

test('normalizes legacy lines and ordered blocks without inventing empty content', () => {
  assert.equal(normalizeListText(''), '');
  assert.equal(normalizeListText('First\nSecond'), '• First\n• Second');
  assert.equal(normalizeListText('4. First\n9. Second'), '1. First\n2. Second');
  assert.equal(normalizeListText('      • Too deep'), '• Too deep');
});

test('renders escaped mixed nested lists', () => {
  assert.equal(
    renderListHtml('• Parent\n  1. Child <unsafe>\n  2. Next\n• Sibling'),
    '<ul class="structured-list"><li>Parent<ol><li>Child &lt;unsafe&gt;</li><li>Next</li></ol></li><li>Sibling</li></ul>',
  );
  assert.equal(renderListHtml('', '<span>Empty</span>'), '<span>Empty</span>');
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run: `node --test tests/list-editor.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `js/list-editor.mjs`.

- [ ] **Step 3: Implement parsing, normalization, numbering, and safe nested rendering**

```js
const BULLET = '•';
const INDENT = '  ';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function parseLine(source) {
  const line = String(source ?? '').replace(/\s+$/, '');
  if (!line.trim()) return { blank: true, level: 0, type: '', text: '' };
  const match = line.match(/^( *)(?:(?:([•*-])|(\d+)\.)\s+)(.*)$/);
  if (!match) return { blank: false, level: 0, type: 'bullet', text: line.trim() };
  return {
    blank: false,
    level: Math.floor(match[1].length / INDENT.length),
    type: match[3] ? 'number' : 'bullet',
    text: match[4].trim(),
  };
}

function normalizeItems(value) {
  const parsed = String(value ?? '').replace(/\r\n?/g, '\n').split('\n').map(parseLine);
  while (parsed.at(-1)?.blank) parsed.pop();
  let previousLevel = 0;
  return parsed.map(item => {
    if (item.blank) return item;
    const level = Math.max(0, Math.min(item.level, previousLevel + 1));
    previousLevel = level;
    return { ...item, level };
  });
}

function serializeItems(items) {
  const counters = [];
  const types = [];
  return items.map(item => {
    if (item.blank) return '';
    types.length = item.level + 1;
    counters.length = item.level + 1;
    if (item.type === 'number') {
      counters[item.level] = types[item.level] === 'number' ? (counters[item.level] || 0) + 1 : 1;
    } else counters[item.level] = 0;
    types[item.level] = item.type;
    const marker = item.type === 'number' ? `${counters[item.level]}.` : BULLET;
    return `${INDENT.repeat(item.level)}${marker} ${item.text}`;
  }).join('\n');
}

export function normalizeListText(value) {
  return serializeItems(normalizeItems(value));
}

function buildTree(value) {
  const root = { children: [] };
  const parents = [root];
  normalizeItems(normalizeListText(value)).filter(item => !item.blank && item.text).forEach(item => {
    const level = Math.min(item.level, parents.length - 1);
    const node = { ...item, level, children: [] };
    parents[level].children.push(node);
    parents[level + 1] = node;
    parents.length = level + 2;
  });
  return root;
}

function renderChildren(children, rootClass = '') {
  let html = '';
  for (let index = 0; index < children.length;) {
    const type = children[index].type;
    const tag = type === 'number' ? 'ol' : 'ul';
    const group = [];
    while (index < children.length && children[index].type === type) group.push(children[index++]);
    html += `<${tag}${rootClass && !html ? ` class="${rootClass}"` : ''}>${group.map(node => `<li>${escapeHtml(node.text)}${renderChildren(node.children)}</li>`).join('')}</${tag}>`;
  }
  return html;
}

export function renderListHtml(value, emptyHtml = '-') {
  const tree = buildTree(value);
  return tree.children.length ? renderChildren(tree.children, 'structured-list') : emptyHtml;
}
```

- [ ] **Step 4: Run normalization/rendering tests and verify GREEN**

Run: `node --test tests/list-editor.test.mjs`

Expected: PASS for the two initial tests.

- [ ] **Step 5: Add failing keyboard, selection, and paste tests**

```js
test('Enter continues an item and exits an empty item', () => {
  assert.deepEqual(handleListEnter('• Alpha', 7, 7), {
    value: '• Alpha\n• ', selectionStart: 10, selectionEnd: 10,
  });
  assert.deepEqual(handleListEnter('• Alpha\n  • ', 12, 12), {
    value: '• Alpha\n• ', selectionStart: 10, selectionEnd: 10,
  });
});

test('commands transform selected lines and ordered blocks', () => {
  const numbered = applyListCommand('• One\n• Two', 0, 11, 'number');
  assert.equal(numbered.value, '1. One\n2. Two');
  assert.equal(getSelectionListType(numbered.value, 0, numbered.value.length), 'number');
  assert.equal(applyListCommand(numbered.value, 7, 13, 'indent').value, '1. One\n  1. Two');
  assert.equal(applyListCommand('• One\n  • Two', 8, 13, 'outdent').value, '• One\n• Two');
});

test('multiline paste inherits the current list type and level', () => {
  const result = handleListPaste('  1. Existing', 13, 13, 'First\nSecond');
  assert.equal(result.value, '1. ExistingFirst\n  1. Second');
  assert.equal(result.selectionStart, result.selectionEnd);
});
```

- [ ] **Step 6: Run the test and verify the new cases fail for missing exports**

Run: `node --test tests/list-editor.test.mjs`

Expected: FAIL because selection transform functions are not implemented.

- [ ] **Step 7: Implement line-range transforms, Enter, paste, and list-type detection**

```js
function selectionLines(value, selectionStart, selectionEnd) {
  const start = value.lastIndexOf('\n', Math.max(0, selectionStart - 1)) + 1;
  const nextBreak = value.indexOf('\n', selectionEnd);
  const end = nextBreak < 0 ? value.length : nextBreak;
  const before = value.slice(0, start);
  return { start, end, before, selected: value.slice(start, end), after: value.slice(end) };
}

function editResult(before, replacement, after, selectStart = 0, selectEnd = replacement.length) {
  const value = `${before}${replacement}${after}`;
  return {
    value,
    selectionStart: Math.min(value.length, before.length + selectStart),
    selectionEnd: Math.min(value.length, before.length + selectEnd),
  };
}

export function applyListCommand(value, selectionStart, selectionEnd, command) {
  const range = selectionLines(String(value || ''), selectionStart, selectionEnd);
  const items = normalizeItems(range.selected);
  const activeType = items.filter(item => !item.blank)[0]?.type || '';
  const transformed = items.map((item, index) => {
    if (item.blank) return item;
    if (command === 'bullet' || command === 'number') {
      return { ...item, type: activeType === command ? 'plain' : command };
    }
    if (command === 'outdent') return { ...item, level: Math.max(0, item.level - 1) };
    const previous = items[index - 1];
    const maximum = previous && !previous.blank ? previous.level + 1 : item.level;
    return { ...item, level: Math.min(item.level + 1, maximum) };
  });
  const replacement = serializeItems(transformed);
  return editResult(range.before, replacement, range.after);
}

export function getSelectionListType(value, selectionStart, selectionEnd) {
  const items = normalizeItems(selectionLines(String(value || ''), selectionStart, selectionEnd).selected)
    .filter(item => !item.blank);
  return items.length && items.every(item => item.type === items[0].type) ? items[0].type : '';
}

export function handleListEnter(value, selectionStart, selectionEnd) {
  const source = String(value || '');
  const lineStart = source.lastIndexOf('\n', Math.max(0, selectionStart - 1)) + 1;
  const lineEndMatch = source.indexOf('\n', selectionEnd);
  const lineEnd = lineEndMatch < 0 ? source.length : lineEndMatch;
  const current = parseLine(source.slice(lineStart, lineEnd));
  if (!current.text) {
    const level = Math.max(0, current.level - 1);
    const marker = level || current.level ? `${INDENT.repeat(level)}${current.type === 'number' ? '1.' : BULLET} ` : '';
    return editResult(source.slice(0, lineStart), marker, source.slice(lineEnd), marker.length, marker.length);
  }
  const marker = `${INDENT.repeat(current.level)}${current.type === 'number' ? '1.' : BULLET} `;
  const replacement = `${source.slice(lineStart, selectionStart)}\n${marker}${source.slice(selectionEnd, lineEnd)}`;
  const result = editResult(source.slice(0, lineStart), replacement, source.slice(lineEnd), replacement.indexOf('\n') + marker.length + 1, replacement.indexOf('\n') + marker.length + 1);
  return { ...result, value: normalizeListText(result.value) };
}

export function handleListPaste(value, selectionStart, selectionEnd, pastedText) {
  const source = String(value || '');
  const currentStart = source.lastIndexOf('\n', Math.max(0, selectionStart - 1)) + 1;
  const current = parseLine(source.slice(currentStart, source.indexOf('\n', selectionStart) < 0 ? source.length : source.indexOf('\n', selectionStart)));
  const pasted = String(pastedText || '').replace(/\r\n?/g, '\n').split('\n');
  const marker = `${INDENT.repeat(current.level)}${current.type === 'number' ? '1.' : BULLET} `;
  const replacement = pasted.map((line, index) => index ? `${marker}${line}` : line).join('\n');
  const normalized = normalizeListText(`${source.slice(0, selectionStart)}${replacement}${source.slice(selectionEnd)}`);
  const cursor = Math.min(normalized.length, selectionStart + replacement.length);
  return { value: normalized, selectionStart: cursor, selectionEnd: cursor };
}
```

- [ ] **Step 8: Run all list-editor tests and verify GREEN**

Run: `node --test tests/list-editor.test.mjs`

Expected: PASS with 5 tests and 0 failures.

- [ ] **Step 9: Commit Task 1**

```powershell
git add -- js/list-editor.mjs tests/list-editor.test.mjs
git commit -m "feat: add structured list editing core"
```

### Task 2: Project Editor toolbar and vertical-only Risk/Action resizing

**Files:**
- Create: `tests/project-list-editor-ui.test.mjs`
- Modify: `index.html`

**Interfaces:**
- Consumes: all exports from `js/list-editor.mjs` created in Task 1.
- Produces: `enhanceListTextarea(textarea: HTMLTextAreaElement): void`
- Produces: `setListEditorValue(textarea: HTMLTextAreaElement, value: unknown): void`

- [ ] **Step 1: Write failing source-wiring and CSS tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('Project Editor wires list controls to every visible multiline field', () => {
  assert.match(html, /from "\.\/js\/list-editor\.mjs"/);
  assert.match(html, /function enhanceListTextarea\(textarea\)/);
  assert.match(html, /data-list-command="bullet"/);
  assert.match(html, /data-list-command="number"/);
  assert.match(html, /data-list-command="outdent"/);
  assert.match(html, /data-list-command="indent"/);
  assert.match(html, /Enter: new item · Tab: sub-item · Shift\+Tab: move up/);
  assert.match(html, /enhanceListTextarea\(document\.getElementById\('pe_highlight'\)\)/);
  assert.match(html, /enhanceListTextarea\(document\.getElementById\('pe_weekly_actions'\)\)/);
  assert.match(html, /row\.querySelectorAll\('\.rap-risk, \.rap-action'\)/);
});

test('Risk and Required Action inputs resize vertically without escaping their grid cells', () => {
  assert.match(html, /\.risk-list-cell\s*\{[^}]*min-width:\s*0/s);
  assert.match(html, /\.risk-list-cell \.ft\s*\{[^}]*width:\s*100%[^}]*resize:\s*vertical/s);
  assert.doesNotMatch(html, /\.risk-list-cell \.ft\s*\{[^}]*resize:\s*(?:both|horizontal)/s);
  assert.match(html, /\.risk-pair-row\s*\{[^}]*align-items:\s*start/s);
});

test('save normalizes list-backed values', () => {
  assert.match(html, /highlight:\s*normalizeListText\(document\.getElementById\('pe_highlight'\)\.value\)/);
  assert.match(html, /weeklyActions:\s*normalizeListText\(document\.getElementById\('pe_weekly_actions'\)\.value\)/);
  assert.match(html, /risk:\s*normalizeListText\(row\.querySelector\('\.rap-risk'\)/);
  assert.match(html, /action:\s*normalizeListText\(row\.querySelector\('\.rap-action'\)/);
});
```

- [ ] **Step 2: Run the UI contract test and verify RED**

Run: `node --test tests/project-list-editor-ui.test.mjs`

Expected: FAIL because the import, toolbar, and resize rules are absent.

- [ ] **Step 3: Add list-editor styles and update field guidance**

```css
.list-editor { min-width:0; border:1px solid var(--border2); border-radius:8px; background:#fff; overflow:hidden; }
.list-editor-toolbar { display:flex; gap:4px; padding:5px 7px; border-bottom:1px solid var(--border); background:var(--s2); }
.list-editor-button { min-width:30px; height:28px; border:1px solid transparent; border-radius:5px; background:transparent; color:var(--text-light); cursor:pointer; }
.list-editor-button:hover, .list-editor-button.active { border-color:var(--border2); background:#fff; color:var(--text); }
.list-editor .ft { display:block; width:100%; min-width:0; resize:vertical; box-sizing:border-box; border:0; border-radius:0; }
.list-editor-hint { padding:4px 8px 6px; color:var(--muted); font-size:9px; }
.risk-list-cell { min-width:0; }
.risk-list-cell .ft { width:100%; min-width:0; resize:vertical; box-sizing:border-box; }
.structured-list { margin:0; padding-left:18px; }
.structured-list ul, .structured-list ol { margin:4px 0; padding-left:20px; }
```

```html
<div class="fg"><label class="fl">Highlight</label><textarea class="ft" id="pe_highlight" rows="3" placeholder="Add accomplishments, decisions, or changes."></textarea></div>
<div class="fg"><label class="fl">Weekly Key Actions (execution focus for next week)</label><textarea class="ft" id="pe_weekly_actions" rows="3" placeholder="Add actions the team needs to execute next week."></textarea></div>
```

- [ ] **Step 4: Import and bind list behavior**

```js
import { applyListCommand, getSelectionListType, handleListEnter, handleListPaste, normalizeListText, renderListHtml } from './js/list-editor.mjs';

const LIST_COMMANDS = [
  ['bullet', '•', 'Bulleted list'],
  ['number', '1.', 'Numbered list'],
  ['outdent', '←', 'Decrease indent'],
  ['indent', '→', 'Increase indent'],
];

function applyListEdit(textarea, result) {
  textarea.value = result.value;
  textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function enhanceListTextarea(textarea) {
  if (!textarea || textarea.dataset.listEditor === 'true') return;
  textarea.dataset.listEditor = 'true';
  const editor = document.createElement('div');
  editor.className = 'list-editor';
  const toolbar = document.createElement('div');
  toolbar.className = 'list-editor-toolbar';
  toolbar.setAttribute('role', 'toolbar');
  LIST_COMMANDS.forEach(([command, label, accessibleName]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'list-editor-button';
    button.dataset.listCommand = command;
    button.textContent = label;
    button.title = accessibleName;
    button.setAttribute('aria-label', accessibleName);
    button.addEventListener('click', () => {
      applyListEdit(textarea, applyListCommand(textarea.value, textarea.selectionStart, textarea.selectionEnd, command));
      textarea.focus();
    });
    toolbar.append(button);
  });
  const hint = document.createElement('div');
  hint.className = 'list-editor-hint';
  hint.textContent = 'Enter: new item · Tab: sub-item · Shift+Tab: move up';
  textarea.before(editor);
  editor.append(toolbar, textarea, hint);
  textarea.addEventListener('keydown', event => {
    let result;
    if (event.key === 'Enter') result = handleListEnter(textarea.value, textarea.selectionStart, textarea.selectionEnd);
    if (event.key === 'Tab') result = applyListCommand(textarea.value, textarea.selectionStart, textarea.selectionEnd, event.shiftKey ? 'outdent' : 'indent');
    if (!result) return;
    event.preventDefault();
    event.stopPropagation();
    applyListEdit(textarea, result);
  });
  textarea.addEventListener('paste', event => {
    const pasted = event.clipboardData?.getData('text/plain') || '';
    if (!pasted.includes('\n')) return;
    event.preventDefault();
    applyListEdit(textarea, handleListPaste(textarea.value, textarea.selectionStart, textarea.selectionEnd, pasted));
  });
}

function setListEditorValue(textarea, value) {
  textarea.value = normalizeListText(value);
}

enhanceListTextarea(document.getElementById('pe_highlight'));
enhanceListTextarea(document.getElementById('pe_weekly_actions'));
```

- [ ] **Step 5: Wrap dynamic Risk/Action fields and normalize load/save**

```html
<div class="risk-list-cell"><textarea class="ft rap-risk" rows="2" placeholder="Risk / Blocker shown in Overview" aria-label="Risk or blocker"></textarea></div>
<div class="risk-list-cell"><textarea class="ft rap-action" rows="2" placeholder="Required Action shown in Overview" aria-label="Required action"></textarea></div>
```

```js
row.querySelector('.rap-risk').value = risk;
row.querySelector('.rap-action').value = action;
row.querySelectorAll('.rap-risk, .rap-action').forEach(enhanceListTextarea);

const pairs = rows.map(row => ({
  id: row.dataset.riskActionId,
  primary: row.querySelector('.rap-primary')?.checked === true,
  risk: normalizeListText(row.querySelector('.rap-risk')?.value || ''),
  action: normalizeListText(row.querySelector('.rap-action')?.value || ''),
})).filter(item => item.risk || item.action);

setListEditorValue(document.getElementById('pe_highlight'), p.highlight || '');
setListEditorValue(document.getElementById('pe_weekly_actions'), p.weeklyActions || p.weeklyAction || '');

highlight: normalizeListText(document.getElementById('pe_highlight').value),
weeklyActions: normalizeListText(document.getElementById('pe_weekly_actions').value),
```

- [ ] **Step 6: Run focused UI and list tests and verify GREEN**

Run: `node --test tests/list-editor.test.mjs tests/project-list-editor-ui.test.mjs tests/project-mutations.test.mjs`

Expected: PASS with no failures.

- [ ] **Step 7: Commit Task 2**

```powershell
git add -- index.html tests/project-list-editor-ui.test.mjs
git commit -m "feat: add Project Editor list controls"
```

### Task 3: Paired Risk/Action table in Single Project preview

**Files:**
- Modify: `js/portfolio-core.mjs`
- Modify: `tests/portfolio-core.test.mjs`
- Modify: `tests/project-list-editor-ui.test.mjs`
- Modify: `index.html`

**Interfaces:**
- Changes: `normalizeRiskActionRows(project)` returns `{ risk: string, action: string, primary: boolean }[]`, preserves asymmetric pairs, and orders Primary first without mutating input.
- Consumes: `renderListHtml` from Task 1.

- [ ] **Step 1: Write failing normalized-pair and preview contracts**

```js
test('normalizeRiskActionRows preserves and orders Primary metadata', () => {
  const source = {
    riskActions: [
      { risk: 'Secondary', action: 'Later', primary: false },
      { risk: 'Main', action: 'Now', primary: true },
    ],
  };
  assert.deepEqual(normalizeRiskActionRows(source), [
    { risk: 'Main', action: 'Now', primary: true },
    { risk: 'Secondary', action: 'Later', primary: false },
  ]);
  assert.equal(source.riskActions[0].risk, 'Secondary');
});
```

Append to `tests/project-list-editor-ui.test.mjs`:

```js
test('Single Project preview renders paired Risk and Required Action rows', () => {
  assert.match(html, /class="project-risk-table-wrap"/);
  assert.match(html, /<th[^>]*>Risk \/ Blocker<\/th>/);
  assert.match(html, /<th[^>]*>Required Action<\/th>/);
  assert.match(html, /id="pd_risk_action_rows"/);
  assert.match(html, /function renderProjectRiskActionTable\(project\)/);
  assert.match(html, /class="project-risk-primary"[^>]*>Primary</);
  assert.match(html, /No active risk\/action reported\./);
  assert.match(html, /renderListHtml\(row\.risk/);
  assert.match(html, /renderListHtml\(row\.action/);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test tests/portfolio-core.test.mjs tests/project-list-editor-ui.test.mjs`

Expected: FAIL because Primary metadata and the paired table are absent.

- [ ] **Step 3: Preserve Primary metadata in normalized pairs**

```js
export function normalizeRiskActionRows(project = {}) {
  const stored = project.riskActions || project.riskPairs;
  if (Array.isArray(stored) && stored.length) {
    const rows = stored.map((item, index) => ({
      risk: String(item?.risk || item?.description || '').trim(),
      action: contentLines(item?.action || item?.actions || item?.mitigation || item?.requiredAction).join('\n'),
      primary: item?.primary === true || item?.isPrimary === true,
      sourceIndex: index,
    })).filter(item => item.risk || item.action);
    if (rows.length && !rows.some(item => item.primary)) rows[0].primary = true;
    return rows.sort((a, b) => Number(b.primary) - Number(a.primary) || a.sourceIndex - b.sourceIndex)
      .map(({ sourceIndex, ...item }) => item);
  }
  const risks = contentLines(project.risk);
  const actions = contentLines(project.next);
  return Array.from({ length: Math.max(risks.length, actions.length) }, (_, index) => ({
    risk: risks[index] || '', action: actions[index] || '', primary: index === 0,
  }));
}
```

- [ ] **Step 4: Replace independent preview blocks with a semantic table**

```css
.project-risk-table-wrap { margin-top:20px; overflow-x:auto; border:1px solid var(--border); border-radius:8px; }
.project-risk-table { width:100%; min-width:620px; border-collapse:collapse; table-layout:fixed; }
.project-risk-table th, .project-risk-table td { padding:10px 12px; border-bottom:1px solid var(--border); text-align:left; vertical-align:top; overflow-wrap:anywhere; }
.project-risk-table th { color:var(--muted); background:var(--s2); font-size:10px; text-transform:uppercase; }
.project-risk-table tr:last-child td { border-bottom:0; }
.project-risk-primary { display:inline-flex; margin:0 6px 6px 0; padding:2px 6px; border-radius:999px; background:#FDECEC; color:var(--red); font-size:9px; font-weight:800; text-transform:uppercase; }
.project-risk-empty { color:var(--muted); font-style:italic; text-align:center; }
```

```html
<div class="info-lbl" style="color:var(--red); margin-top:20px;">Risk &amp; Required Action</div>
<div class="project-risk-table-wrap">
  <table class="project-risk-table">
    <thead><tr><th>Risk / Blocker</th><th>Required Action</th></tr></thead>
    <tbody id="pd_risk_action_rows"></tbody>
  </table>
</div>
```

```js
function renderProjectRiskActionTable(project) {
  const target = document.getElementById('pd_risk_action_rows');
  const rows = normalizeRiskActionRows(project);
  if (!rows.length) {
    target.innerHTML = '<tr><td class="project-risk-empty" colspan="2">No active risk/action reported.</td></tr>';
    return;
  }
  target.innerHTML = rows.map(row => `
    <tr>
      <td>${row.primary ? '<span class="project-risk-primary">Primary</span>' : ''}${row.risk ? renderListHtml(row.risk) : '—'}</td>
      <td>${row.action ? renderListHtml(row.action) : '—'}</td>
    </tr>
  `).join('');
}

renderProjectRiskActionTable(p);
```

- [ ] **Step 5: Run preview and regression tests and verify GREEN**

Run: `node --test tests/list-editor.test.mjs tests/portfolio-core.test.mjs tests/project-list-editor-ui.test.mjs tests/project-detail-calendar-gantt.test.mjs tests/v2-baseline.test.mjs`

Expected: PASS with no failures.

- [ ] **Step 6: Commit Task 3**

```powershell
git add -- index.html js/portfolio-core.mjs tests/portfolio-core.test.mjs tests/project-list-editor-ui.test.mjs
git commit -m "feat: pair risks and actions in project preview"
```

### Task 4: PDF marker compatibility

**Files:**
- Modify: `pdf-service/src/report-model.js`
- Modify: `pdf-service/test/report-model.test.mjs`

**Interfaces:**
- Changes private `lines(value)` behavior to remove one recognized list marker and leading indentation from each logical line before PDF models consume it.

- [ ] **Step 1: Write a failing PDF normalization test**

```js
test('removes stored list markers before building PDF list items', () => {
  const project = normalizeProjectForReport({
    highlight: '• Parent\n  1. Child',
    weeklyActions: '1. First\n2. Second',
    riskActions: [{ risk: '• Risk', action: '  • Action', primary: true }],
  });
  assert.deepEqual(project.highlights, ['Parent', 'Child']);
  assert.deepEqual(project.actions, ['First', 'Second']);
  assert.deepEqual(project.riskActions, [{ risk: 'Risk', action: 'Action', primary: true }]);
});
```

- [ ] **Step 2: Run the PDF model test and verify RED**

Run: `npm test -- --test-name-pattern="removes stored list markers"`

Working directory: `pdf-service`

Expected: FAIL because markers remain in normalized strings.

- [ ] **Step 3: Implement marker-aware PDF line cleanup**

```js
function listItemText(value) {
  return String(value || '').replace(/^\s*(?:[•*-]|\d+\.)\s+/, '').trim();
}

function lines(value) {
  const source = Array.isArray(value) ? value : String(value || '').split('\n');
  return source.map(listItemText).filter(Boolean);
}
```

Use `listItemText` for each structured Risk string as well as `lines(...).join('\n')` for its action, retaining the existing Primary rules.

- [ ] **Step 4: Run the full PDF service suite and verify GREEN**

Run: `npm test`

Working directory: `pdf-service`

Expected: all PDF service tests pass.

- [ ] **Step 5: Commit Task 4**

```powershell
git add -- pdf-service/src/report-model.js pdf-service/test/report-model.test.mjs
git commit -m "fix: clean list markers in PDF models"
```

### Task 5: Integrated verification and release

**Files:**
- Modify only if verification exposes a regression in files already listed above.

**Interfaces:**
- Produces: tested root dashboard commit pushed to `v21/main`.

- [ ] **Step 1: Run the root and directly related dashboard test suite**

Run:

```powershell
node --test *.test.mjs *.test.cjs tests/*.test.mjs
```

Expected: all root dashboard tests pass.

- [ ] **Step 2: Run the PDF service suite**

Run: `npm test`

Working directory: `pdf-service`

Expected: all PDF service tests pass.

- [ ] **Step 3: Confirm the recorded Team 2 baseline exception is unchanged**

Run:

```powershell
node --test team-2/*.test.mjs team-2/*.test.cjs
```

Expected: only the pre-existing `team-2/trend-summary.test.cjs` assertion fails; every other Team 2 test passes.

- [ ] **Step 4: Serve and verify the dashboard in a browser**

Run a local static server from the worktree. Verify desktop and narrow viewport behavior: toolbar visibility, Enter, Tab, Shift+Tab, list-type buttons, multiline paste, save/reopen, Risk/Action vertical resizing with downstream row movement, Primary badge, paired preview rows, hostile text escaping, and table horizontal containment.

- [ ] **Step 5: Review the final diff and repository state**

Run:

```powershell
git diff 6c7868d...HEAD --check
git diff 6c7868d...HEAD --stat
git status --short
```

Expected: only the spec, plan, list module/tests, root `index.html`, portfolio core/tests, and PDF model/tests are tracked changes; existing ignored/untracked worktree artifacts remain untouched.

- [ ] **Step 6: Push the tested release to the v2.1 production remote**

```powershell
git push v21 HEAD:main
```

Expected: `v21/main` advances from `6c7868d` to the tested release commit.

- [ ] **Step 7: Verify the deployed GitHub Pages revision**

Poll the provided production URL with a cache-busting query until its HTML contains the new `project-risk-table-wrap` and list-editor module import. Report the deployed commit and URL.
