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
  preflightXlsxZip,
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

function craftedCentralDirectoryZip(uncompressedSizes, {
  entryCount = uncompressedSizes.length,
  centralDirectoryOffset = 4,
  zip64Locator = false,
} = {}) {
  const centralDirectory = Buffer.alloc(uncompressedSizes.length * 46);
  uncompressedSizes.forEach((size, index) => {
    const offset = index * 46;
    centralDirectory.writeUInt32LE(0x02014b50, offset);
    centralDirectory.writeUInt32LE(size, offset + 24);
  });
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entryCount, 8);
  eocd.writeUInt16LE(entryCount, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(centralDirectoryOffset, 16);
  const locator = zip64Locator ? Buffer.alloc(20) : Buffer.alloc(0);
  if (zip64Locator) locator.writeUInt32LE(0x07064b50, 0);
  return Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    centralDirectory,
    locator,
    eocd,
  ]);
}

test('exposes a pure workbook parser for worker and Node integration tests', () => {
  assert.equal(typeof parseWorkbookData, 'function');
  assert.equal(typeof parseWorksheet, 'function');
  assert.equal(typeof preflightXlsxZip, 'function');
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

test('preflights XLSX central-directory entry and expansion budgets before SheetJS reads', () => {
  const valid = workbookBytes([['Project ID/Code'], ['P-1']]);
  assert.doesNotThrow(() => preflightXlsxZip(valid));
  assert.throws(
    () => preflightXlsxZip(craftedCentralDirectoryZip([1], { entryCount: 2001 })),
    /more than 2,000 ZIP entries/i,
  );
  assert.throws(
    () => preflightXlsxZip(craftedCentralDirectoryZip([60 * 1024 * 1024, 50 * 1024 * 1024])),
    /uncompressed data exceeds 100 MB/i,
  );

  let readCalled = false;
  assert.throws(
    () => parseWorkbookData(
      craftedCentralDirectoryZip([1], { entryCount: 2001 }),
      { read() { readCalled = true; } },
    ),
    /more than 2,000 ZIP entries/i,
  );
  assert.equal(readCalled, false);
});

test('rejects malformed and unsupported ZIP64 XLSX metadata before parsing', () => {
  assert.throws(
    () => preflightXlsxZip(Uint8Array.from([0x50, 0x4b, 0x03, 0x04])),
    /malformed ZIP central directory/i,
  );
  assert.throws(
    () => preflightXlsxZip(craftedCentralDirectoryZip([1], {
      centralDirectoryOffset: 0xfffffff0,
    })),
    /malformed ZIP central directory/i,
  );
  assert.throws(
    () => preflightXlsxZip(craftedCentralDirectoryZip([1], { entryCount: 0xffff })),
    /ZIP64/i,
  );
  assert.throws(
    () => preflightXlsxZip(craftedCentralDirectoryZip([1], { zip64Locator: true })),
    /ZIP64/i,
  );
});

test('rejects a capped A10:B5010 used range instead of silently returning 4,992 rows', () => {
  const rows = Array.from({ length: 5000 }, (_, index) => [
    `P-${index + 1}`,
    `Project ${index + 1}`,
  ]);
  const bytes = workbookBytes([
    ...Array.from({ length: 9 }, () => []),
    ['Project ID/Code', 'Project Name'],
    ...rows,
  ], sheet => {
    sheet['!ref'] = 'A10:B5010';
  });

  assert.throws(
    () => parseWorkbookData(bytes, XLSX),
    /header row must be worksheet row 1/i,
  );
});

test('validates the original SheetJS full range when sheetRows truncates !ref', () => {
  assert.throws(
    () => parseWorksheet({
      A1: { t: 's', v: 'Project ID/Code' },
      A2: { t: 's', v: 'P-1' },
      '!ref': 'A1:A5001',
      '!fullref': 'A1:A6000',
    }, XLSX),
    /5,001-row limit/i,
  );
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
