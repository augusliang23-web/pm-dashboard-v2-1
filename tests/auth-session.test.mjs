import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { isAuthInitializationCurrent } from '../team-2/js/auth-session.mjs';

const dashboard = await readFile(new URL('../team-2/index.html', import.meta.url), 'utf8');

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

test('a delayed user A initialization cannot commit after user B becomes current', async () => {
  let generation = 0;
  let currentUser = null;
  const committed = [];
  const roleA = deferred();
  const roleB = deferred();
  const userA = { uid: 'uid-a', email: 'A@example.com' };
  const userB = { uid: 'uid-b', email: 'b@example.com' };

  const initialize = async (user, rolePromise) => {
    const expectedGeneration = ++generation;
    const expectedUid = user.uid;
    const expectedEmail = user.email.trim().toLowerCase();
    currentUser = user;
    const role = await rolePromise;
    if (!isAuthInitializationCurrent(
      generation,
      expectedGeneration,
      currentUser,
      expectedUid,
      expectedEmail,
    )) return;
    committed.push({ uid: user.uid, role });
  };

  const pendingA = initialize(userA, roleA.promise);
  const pendingB = initialize(userB, roleB.promise);
  roleB.resolve('admin');
  await pendingB;
  roleA.resolve('pm');
  await pendingA;

  assert.deepEqual(committed, [{ uid: 'uid-b', role: 'admin' }]);
});

test('dashboard gates every awaited auth initialization stage with generation and identity', () => {
  assert.match(dashboard, /import\s+\{\s*isAuthInitializationCurrent\s*\}\s+from "\.\/js\/auth-session\.mjs"/);
  assert.ok(dashboard.includes('let authSessionGeneration = 0;'));
  assert.ok(dashboard.includes('const authGeneration = ++authSessionGeneration;'));
  assert.ok(dashboard.includes('const authUid = user?.uid || \'\';'));
  assert.ok(dashboard.includes('const authEmail = getEmailKey(user);'));
  assert.ok(dashboard.includes('const logoutGeneration = ++authSessionGeneration;'));

  const authStart = dashboard.indexOf('onAuthStateChanged(auth, async user =>');
  const authEnd = dashboard.indexOf('function getUserDisplayName(', authStart);
  const source = dashboard.slice(authStart, authEnd);
  const roleAwait = source.indexOf('await getDoc(doc(db, "users", authEmail))');
  const roleGuard = source.indexOf('isCurrentAuthInitialization()', roleAwait);
  const roleCommit = source.indexOf('currentRole = getDashboardRole(userDoc)', roleAwait);
  const templateAwait = source.indexOf('await loadGanttTemplateConfig(', roleCommit);
  const templateGuard = source.indexOf('isCurrentAuthInitialization()', templateAwait);
  const pmAwait = source.indexOf('await fetchDynamicPMList()', templateGuard);
  const pmGuard = source.indexOf('isCurrentAuthInitialization()', pmAwait);
  const setupCommit = source.indexOf('PM_LIST = nextPMList', pmGuard);
  const setupUI = source.indexOf('setupUI()', setupCommit);

  assert.ok(roleAwait >= 0 && roleGuard > roleAwait && roleGuard < roleCommit);
  assert.ok(templateAwait > roleCommit && templateGuard > templateAwait);
  assert.ok(pmAwait > templateGuard && pmGuard > pmAwait);
  assert.ok(setupCommit > pmGuard && setupUI > setupCommit);
});

test('template listener setup and callbacks share the current auth generation guard', () => {
  const start = dashboard.indexOf('// GANTT TEMPLATE SETTINGS');
  const end = dashboard.indexOf('// END GANTT TEMPLATE SETTINGS', start);
  const source = dashboard.slice(start, end);
  const loadStart = source.indexOf('async function loadGanttTemplateConfig(');
  const stopCall = source.indexOf('stopGanttTemplateConfigSubscription();', loadStart);
  const initialGuard = source.indexOf('isAuthInitializationCurrent(', loadStart);
  assert.ok(initialGuard >= 0 && initialGuard < stopCall);
  assert.ok(source.includes('authGeneration === authSessionGeneration'));
  assert.ok(source.includes('isAuthInitializationCurrent('));
});
