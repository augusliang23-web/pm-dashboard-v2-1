import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dockerfile = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');

test('PDF renderer image installs the Chromium shared-library dependencies', () => {
  assert.match(dockerfile, /apt-get install -y[\s\S]*libglib2\.0-0/);
  assert.match(dockerfile, /apt-get install -y[\s\S]*libnss3/);
  assert.match(dockerfile, /apt-get install -y[\s\S]*libgbm1/);
  assert.match(dockerfile, /apt-get install -y[\s\S]*libxcursor1/);
  assert.match(dockerfile, /apt-get install -y[\s\S]*libxi6/);
  assert.match(dockerfile, /apt-get install -y[\s\S]*libxss1/);
  assert.match(dockerfile, /apt-get install -y[\s\S]*libxtst6/);
  assert.match(dockerfile, /RUN node --input-type=module -e[\s\S]*puppeteer\.launch/);
});
