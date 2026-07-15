import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCors, handlePreflight } from '../src/cors.js';

function responseStub() {
  return {
    headers: {},
    statusCode: null,
    setHeader(name, value) { this.headers[name] = value; },
    writeHead(statusCode) { this.statusCode = statusCode; return this; },
    end() { this.ended = true; }
  };
}

test('allows a preflight request only from the configured dashboard origin', () => {
  const response = responseStub();
  const handled = handlePreflight(
    { method: 'OPTIONS', headers: { origin: 'https://augusliang23-web.github.io' } },
    response,
    'https://augusliang23-web.github.io'
  );

  assert.equal(handled, true);
  assert.equal(response.statusCode, 204);
  assert.equal(response.headers['Access-Control-Allow-Origin'], 'https://augusliang23-web.github.io');
  assert.equal(response.headers['Access-Control-Allow-Headers'], 'Authorization, Content-Type');
});

test('rejects CORS requests from an unconfigured origin', () => {
  const response = responseStub();
  const allowed = applyCors(
    { headers: { origin: 'https://untrusted.example' } },
    response,
    'https://augusliang23-web.github.io'
  );

  assert.equal(allowed, false);
  assert.deepEqual(response.headers, {});
});
