import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(
  new URL('../team-2/index.html', import.meta.url),
  'utf8',
);

test('project detail and editor close only from a left-click on their backdrop', () => {
  assert.match(
    html,
    /id="projDetailOverlay"[^>]*onclick="closeProjectOverlayFromBackdrop\(event\)"/,
  );
  assert.match(
    html,
    /id="projEditOverlay"[^>]*onclick="closeProjectOverlayFromBackdrop\(event\)"/,
  );
  assert.match(
    html,
    /window\.closeProjectOverlayFromBackdrop\s*=\s*event\s*=>\s*\{[\s\S]*?event\.button !== 0[\s\S]*?event\.target !== event\.currentTarget[\s\S]*?closeModal\(event\.currentTarget\.id\)/,
  );
});

test('clicks inside project modals are ignored by the backdrop handler', () => {
  assert.match(
    html,
    /if \(event\.button !== 0 \|\| event\.target !== event\.currentTarget\) return;/,
  );
  assert.doesNotMatch(
    html,
    /id="changePwdOverlay"[^>]*onclick="closeProjectOverlayFromBackdrop\(event\)"/,
  );
});
