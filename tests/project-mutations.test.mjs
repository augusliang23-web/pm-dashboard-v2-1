import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  applyProjectDelete,
  applyProjectSave,
} from '../team-2/js/project-mutations.mjs';

const dashboard = await readFile(
  new URL('../team-2/index.html', import.meta.url),
  'utf8',
);

test('editing merges only the live target and preserves concurrent projects and unknown fields', () => {
  const concurrentProject = { code: 'LIVE-2', name: 'Added concurrently', custom: 42 };
  const liveWeek = {
    weekLabel: '2026 Week 27',
    unknownWeekField: { keep: true },
    projects: [
      { code: 'LIVE-1', name: 'Original', owner: 'PM One', unknownProjectField: 'keep' },
      concurrentProject,
    ],
  };

  const result = applyProjectSave(liveWeek, {
    originalCode: 'LIVE-1',
    draft: { code: ' renamed-1 ', name: ' Renamed ', status: 'yellow' },
    isNew: false,
    role: 'pm',
    canEdit: project => project.owner === 'PM One',
    lastModifiedBy: 'pm.one@example.com',
  });

  assert.deepEqual(result.week.unknownWeekField, { keep: true });
  assert.equal(result.week.projects[1], concurrentProject);
  assert.deepEqual(result.project, {
    code: 'renamed-1',
    name: 'Renamed',
    owner: 'PM One',
    unknownProjectField: 'keep',
    status: 'yellow',
  });
  assert.equal(result.week.lastModifiedBy, 'pm.one@example.com');
  assert.deepEqual(liveWeek.projects[0], {
    code: 'LIVE-1',
    name: 'Original',
    owner: 'PM One',
    unknownProjectField: 'keep',
  });
});

test('save rejects blank trimmed names and codes', () => {
  const liveWeek = { projects: [] };
  const options = {
    isNew: true,
    role: 'admin',
    canEdit: () => true,
    lastModifiedBy: 'admin@example.com',
  };

  assert.throws(
    () => applyProjectSave(liveWeek, { ...options, draft: { name: '   ', code: 'P-1' } }),
    /project name is required/i,
  );
  assert.throws(
    () => applyProjectSave(liveWeek, { ...options, draft: { name: 'Project', code: '\t' } }),
    /project code is required/i,
  );
});

test('save enforces case-insensitive live code uniqueness but excludes the edited target', () => {
  const liveWeek = {
    projects: [
      { code: 'ALPHA', name: 'Alpha', owner: 'PM One' },
      { code: 'BETA', name: 'Beta', owner: 'PM One' },
    ],
  };
  const options = {
    originalCode: 'ALPHA',
    isNew: false,
    role: 'pm',
    canEdit: () => true,
    lastModifiedBy: 'pm.one@example.com',
  };

  const unchanged = applyProjectSave(liveWeek, {
    ...options,
    draft: { code: ' alpha ', name: 'Alpha renamed' },
  });
  assert.equal(unchanged.project.code, 'alpha');

  assert.throws(
    () => applyProjectSave(liveWeek, {
      ...options,
      draft: { code: ' beta ', name: 'Duplicate' },
    }),
    /already exists/i,
  );
});

test('edit and delete require the exact original live code', () => {
  const liveWeek = { projects: [{ code: 'CASE-1', name: 'Case', owner: 'PM One' }] };

  assert.throws(
    () => applyProjectSave(liveWeek, {
      originalCode: 'case-1',
      draft: { code: 'CASE-1', name: 'Case' },
      isNew: false,
      role: 'pm',
      canEdit: () => true,
      lastModifiedBy: 'pm.one@example.com',
    }),
    /no longer exists/i,
  );
  assert.throws(
    () => applyProjectDelete(liveWeek, {
      originalCode: 'case-1',
      role: 'admin',
      lastModifiedBy: 'admin@example.com',
    }),
    /no longer exists/i,
  );
});

test('authorization is checked against the live target and creation/deletion are admin-only', () => {
  const liveTarget = { code: 'OWNED', name: 'Owned', owner: 'New Owner' };
  const liveWeek = { projects: [liveTarget] };
  let authorizedProject = null;

  assert.throws(
    () => applyProjectSave(liveWeek, {
      originalCode: 'OWNED',
      draft: { code: 'OWNED', name: 'Changed' },
      isNew: false,
      role: 'pm',
      canEdit: project => {
        authorizedProject = project;
        return false;
      },
      lastModifiedBy: 'old.owner@example.com',
    }),
    /permission/i,
  );
  assert.equal(authorizedProject, liveTarget);

  assert.throws(
    () => applyProjectSave({ projects: [] }, {
      draft: { code: 'NEW', name: 'New' },
      isNew: true,
      role: 'pm',
      canEdit: () => true,
      lastModifiedBy: 'pm@example.com',
    }),
    /administrators/i,
  );
  assert.throws(
    () => applyProjectDelete(liveWeek, {
      originalCode: 'OWNED',
      role: 'pm',
      lastModifiedBy: 'pm@example.com',
    }),
    /administrators/i,
  );
});

test('delete removes only the exact live target and preserves concurrent week data', () => {
  const retained = { code: 'KEEP', name: 'Concurrent', custom: true };
  const liveWeek = {
    customWeekField: 'keep',
    projects: [{ code: 'DELETE', name: 'Delete me' }, retained],
  };

  const result = applyProjectDelete(liveWeek, {
    originalCode: 'DELETE',
    role: 'admin',
    lastModifiedBy: 'admin@example.com',
  });

  assert.equal(result.week.customWeekField, 'keep');
  assert.deepEqual(result.week.projects, [retained]);
  assert.equal(result.deletedProject.code, 'DELETE');
  assert.equal(liveWeek.projects.length, 2);
});

test('project save and delete use retryable transactions and commit UI state only after await', () => {
  const saveStart = dashboard.indexOf('window.saveProjEdit = async () =>');
  const deleteStart = dashboard.indexOf('window.deleteProject = async () =>');
  const deleteEnd = dashboard.indexOf('window.addMilestoneRow', deleteStart);
  const saveSource = dashboard.slice(saveStart, deleteStart);
  const deleteSource = dashboard.slice(deleteStart, deleteEnd);

  assert.ok(saveStart >= 0 && deleteStart > saveStart && deleteEnd > deleteStart);
  for (const source of [saveSource, deleteSource]) {
    const awaitPosition = source.indexOf('await runTransaction(db, async transaction =>');
    const closePosition = source.indexOf("closeModal('projEditOverlay')");
    assert.ok(awaitPosition >= 0);
    assert.ok(source.indexOf('await transaction.get(targetWeekRef)', awaitPosition) > awaitPosition);
    assert.ok(source.indexOf('transaction.update(targetWeekRef', awaitPosition) > awaitPosition);
    assert.ok(closePosition > awaitPosition);
    assert.doesNotMatch(source, /setDoc\s*\(/);
    assert.doesNotMatch(source, /maxAttempts/);
    assert.match(source, /finally\s*\{[\s\S]*hideLoader\(\)/);
    assert.ok(source.includes('showProjectMutationError('));
  }

  assert.match(dashboard, /id="pe_btn_save"[^>]+onclick="saveProjEdit\(\)"/);
  assert.match(dashboard, /id="pe_btn_delete"[^>]+onclick="deleteProject\(\)"/);
  assert.ok(dashboard.includes('let projectMutationInFlight = false;'));
  assert.ok(dashboard.includes('function setProjectMutationControlsDisabled(disabled)'));
  assert.ok(saveSource.includes('if (projectMutationInFlight) return;'));
  assert.ok(deleteSource.includes('if (projectMutationInFlight) return;'));
  assert.doesNotMatch(
    saveSource.slice(0, saveSource.indexOf('await runTransaction')),
    /week\.projects\.(?:push|splice)|week\.projects\[[^\]]+\]\s*=/,
  );
  assert.doesNotMatch(
    deleteSource.slice(0, deleteSource.indexOf('await runTransaction')),
    /week\.projects\.(?:push|splice)|week\.projects\[[^\]]+\]\s*=/,
  );
});
