import test from 'node:test';
import assert from 'node:assert/strict';
import { sendPdfDownload } from '../src/pdf-response.js';

function createResponse() {
  return {
    headers: new Map(),
    statusCode: 0,
    body: undefined,
    setHeader(name, value) { this.headers.set(name, value); },
    end(body) { this.body = body; }
  };
}

test('sends an in-memory PDF as an attachment download', () => {
  const response = createResponse();
  const pdf = Buffer.from('%PDF-test');

  sendPdfDownload(response, pdf, 'PMS-W28.pdf');

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers.get('Content-Type'), 'application/pdf');
  assert.equal(response.headers.get('Content-Disposition'), 'attachment; filename="PMS-W28.pdf"');
  assert.equal(response.headers.get('Cache-Control'), 'no-store, private');
  assert.equal(response.headers.get('Content-Length'), String(pdf.length));
  assert.equal(response.body, pdf);
});

test('rejects non-buffer output and unsafe filenames', () => {
  const response = createResponse();
  assert.throws(() => sendPdfDownload(response, 'pdf', 'report.pdf'), /Buffer/);
  assert.throws(() => sendPdfDownload(response, Buffer.from('pdf'), '../report.pdf'), /safe PDF filename/);
});
