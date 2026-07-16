import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dockerfile = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
const deploymentScript = readFileSync(new URL('../deploy.ps1', import.meta.url), 'utf8');

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

test('Cloud Run source deploy excludes local dependencies and development artifacts', () => {
  const ignore = readFileSync(new URL('../.gcloudignore', import.meta.url), 'utf8');

  assert.match(ignore, /^node_modules\/$/m);
  assert.match(ignore, /^test\/$/m);
  assert.match(ignore, /^scripts\/$/m);
  assert.match(ignore, /^npm-debug\.log$/m);
});

test('Cloud Run deployment is non-interactive', () => {
  assert.match(deploymentScript, /--quiet/);
});
