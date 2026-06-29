import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const XLSX = require('../team-2/vendor/xlsx.full.min.js');
const workerCore = (() => {
  try {
    return require('../team-2/js/excel-worker-core.js');
  } catch {
    return {};
  }
})();

const {
  parseWorkbookData,
  parseWorksheet,
  validateWorkbookSignature,
} = workerCore;
const workerSource = await readFile(
  new URL('../team-2/js/excel-worker.js', import.meta.url),
  'utf8',
).catch(() => '');

function workbookBytes(rows, mutateSheet = () => {}) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  mutateSheet(sheet);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'First');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

test('exposes a pure workbook parser for worker and Node integration tests', () => {
  assert.equal(typeof parseWorkbookData, 'function');
  assert.equal(typeof parseWorksheet, 'function');
  assert.equal(typeof validateWorkbookSignature, 'function');
});

test('worker loads vendored SheetJS and returns only serializable rows or errors', () => {
  assert.ok(workerSource.includes("importScripts('../vendor/xlsx.full.min.js', './excel-worker-core.js');"));
  assert.ok(workerSource.includes('ExcelWorkerCore.parseWorkbookData'));
  assert.ok(workerSource.includes("self.postMessage({ ok: true, rows })"));
  assert.match(workerSource, /self\.postMessage\(\{\s*ok: false,/);
});

test('accepts plausible XLSX and XLS signatures and rejects other input before parsing', () => {
  const xlsx = workbookBytes([['Project ID/Code'], ['P-1']]);
  const xlsWorkbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    xlsWorkbook,
    XLSX.utils.aoa_to_sheet([['Project ID/Code'], ['P-1']]),
    'First',
  );
  const xls = XLSX.write(xlsWorkbook, { type: 'buffer', bookType: 'xls' });

  assert.equal(validateWorkbookSignature(xlsx), 'xlsx');
  assert.equal(validateWorkbookSignature(xls), 'xls');

  let readCalled = false;
  assert.throws(
    () => parseWorkbookData(Uint8Array.from([0x7b, 0x22, 0x78, 0x22]), {
      read() {
        readCalled = true;
      },
    }),
    /not a valid XLS or XLSX workbook/i,
  );
  assert.equal(readCalled, false);
});

test('uses bounded SheetJS options and parses only the first worksheet', () => {
  const first = XLSX.utils.aoa_to_sheet([
    ['Project ID/Code', 'Project Name'],
    ['FIRST', 'First project'],
  ]);
  const second = XLSX.utils.aoa_to_sheet([
    ['Project ID/Code', 'Project Name'],
    ['SECOND', 'Second project'],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, first, 'First');
  XLSX.utils.book_append_sheet(workbook, second, 'Second');
  const bytes = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  let readOptions;

  const rows = parseWorkbookData(bytes, {
    ...XLSX,
    read(data, options) {
      readOptions = { ...options };
      return XLSX.read(data, options);
    },
  });

  assert.deepEqual(readOptions, { type: 'array', sheetRows: 5002, sheets: 0 });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]['Project ID/Code'], 'FIRST');
});

test('preserves formatted numeric project identities and visible Excel errors', () => {
  const bytes = workbookBytes([
    ['Project ID/Code', 'Project Name', 'Estimated Hard Hours'],
    [123, 'Formatted identity', 1],
  ], sheet => {
    sheet.A2.z = '00000';
    delete sheet.A2.w;
    sheet.C2 = { t: 'e', v: 7 };
  });

  const rows = parseWorkbookData(bytes, XLSX);

  assert.equal(rows[0]['Project ID/Code'], '00123');
  assert.equal(rows[0]['Estimated Hard Hours'], '#DIV/0!');
  assert.ok(rows[0].__importWarnings__.some(warning => (
    /Estimated Hard Hours/.test(warning) && /#DIV\/0!/.test(warning)
  )));
});

test('marks numeric project IDs without a formatted identity as ambiguous', () => {
  const bytes = workbookBytes([
    ['Project ID/Code', 'Project Name'],
    [123, 'Ambiguous identity'],
  ]);

  const rows = parseWorkbookData(bytes, XLSX);

  assert.equal(rows[0]['Project ID/Code'], '');
  assert.ok(rows[0].__importErrors__.some(error => /numeric Project ID\/Code/i.test(error)));
});

test('keeps actual worksheet row numbers when blank rows are skipped', () => {
  const bytes = workbookBytes([
    ['Project ID/Code', 'Project Name'],
    ['ROW-2', 'Second row'],
    [],
    ['ROW-4', 'Fourth row'],
  ]);

  const rows = parseWorkbookData(bytes, XLSX);

  assert.deepEqual(rows.map(row => row.__rowNum__), [1, 3]);
});

test('does not let worksheet headers overwrite trusted source row metadata', () => {
  const bytes = workbookBytes([
    ['Project ID/Code', 'Project Name', '__rowNum__'],
    ['ROW-2', 'Second row', 999],
  ]);

  const rows = parseWorkbookData(bytes, XLSX);

  assert.equal(rows[0].__rowNum__, 1);
});

test('rejects sparse or unreasonable worksheet dimensions before conversion', () => {
  const sparse = {
    A1: { t: 's', v: 'Project ID/Code' },
    A2: { t: 's', v: 'P-1' },
    '!ref': 'A1:XFD5001',
  };
  assert.throws(() => parseWorksheet(sparse, XLSX), /column limit/i);

  assert.throws(
    () => parseWorksheet({ A1: { t: 's', v: 'Header' }, '!ref': 'A1:A5002' }, XLSX),
    /5,001-row limit/i,
  );
  assert.throws(
    () => parseWorksheet({ A1: { t: 's', v: 'Header' }, '!ref': 'A1:IV5001' }, XLSX),
    /cell range is too large/i,
  );
});

test('rejects empty worksheets and header-only worksheets', () => {
  assert.throws(() => parseWorksheet({}, XLSX), /no data rows/i);
  assert.throws(
    () => parseWorksheet({ A1: { t: 's', v: 'Project ID/Code' }, '!ref': 'A1:A1' }, XLSX),
    /no data rows/i,
  );
});
