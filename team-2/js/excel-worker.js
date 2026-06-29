'use strict';

importScripts('../vendor/xlsx.full.min.js', './excel-worker-core.js');

self.onmessage = event => {
  try {
    const rows = ExcelWorkerCore.parseWorkbookData(event.data, XLSX);
    self.postMessage({ ok: true, rows });
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : 'Could not parse this workbook.',
    });
  }
};
