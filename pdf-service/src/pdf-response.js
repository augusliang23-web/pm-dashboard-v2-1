function assertSafeFilename(filename) {
  if (typeof filename !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*\.pdf$/.test(filename)) {
    throw new TypeError('A safe PDF filename is required.');
  }
}

export function sendPdfDownload(response, pdfBuffer, filename) {
  if (!Buffer.isBuffer(pdfBuffer)) {
    throw new TypeError('PDF output must be a Buffer.');
  }
  assertSafeFilename(filename);
  response.statusCode = 200;
  response.setHeader('Content-Type', 'application/pdf');
  response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  response.setHeader('Cache-Control', 'no-store, private');
  response.setHeader('Content-Length', String(pdfBuffer.length));
  response.end(pdfBuffer);
}
