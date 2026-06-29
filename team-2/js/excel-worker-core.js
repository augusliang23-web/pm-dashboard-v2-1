(function exposeExcelWorkerCore(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ExcelWorkerCore = api;
}(typeof self !== 'undefined' ? self : globalThis, function createExcelWorkerCore() {
  'use strict';

  const MAX_TOTAL_ROWS = 5001;
  const MAX_COLUMNS = 256;
  const MAX_CELLS = 1000000;
  const MAX_ZIP_ENTRIES = 2000;
  const MAX_ZIP_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
  const ZIP_CENTRAL_FILE_HEADER = 0x02014b50;
  const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50;
  const ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR = 0x07064b50;
  const ZIP64_SENTINEL_16 = 0xffff;
  const ZIP64_SENTINEL_32 = 0xffffffff;
  const PROJECT_ID_HEADERS = new Set(['project id/code', 'project id', 'project code']);
  const EXCEL_ERRORS = Object.freeze({
    0: '#NULL!',
    7: '#DIV/0!',
    15: '#VALUE!',
    23: '#REF!',
    29: '#NAME?',
    36: '#NUM!',
    42: '#N/A',
    43: '#GETTING_DATA',
  });

  function bytesOf(data) {
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    return Uint8Array.from(data || []);
  }

  function startsWith(bytes, signature) {
    return signature.every((value, index) => bytes[index] === value);
  }

  function validateWorkbookSignature(data) {
    const bytes = bytesOf(data);
    if (
      startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])
      || startsWith(bytes, [0x50, 0x4b, 0x05, 0x06])
      || startsWith(bytes, [0x50, 0x4b, 0x07, 0x08])
    ) return 'xlsx';
    if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return 'xls';
    throw new Error('The selected file is not a valid XLS or XLSX workbook.');
  }

  function malformedZip() {
    throw new Error('The XLSX file has a malformed ZIP central directory.');
  }

  function preflightXlsxZip(data) {
    const bytes = bytesOf(data);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const minimumEocdSize = 22;
    const maximumCommentSize = 0xffff;
    const earliestEocd = Math.max(0, bytes.length - minimumEocdSize - maximumCommentSize);
    let eocdOffset = -1;

    for (let offset = bytes.length - minimumEocdSize; offset >= earliestEocd; offset -= 1) {
      if (view.getUint32(offset, true) !== ZIP_END_OF_CENTRAL_DIRECTORY) continue;
      const commentLength = view.getUint16(offset + 20, true);
      if (offset + minimumEocdSize + commentLength === bytes.length) {
        eocdOffset = offset;
        break;
      }
    }
    if (eocdOffset < 0) malformedZip();
    if (
      eocdOffset >= 20
      && view.getUint32(eocdOffset - 20, true) === ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR
    ) {
      throw new Error('ZIP64 XLSX workbooks are not supported.');
    }

    const diskNumber = view.getUint16(eocdOffset + 4, true);
    const centralDirectoryDisk = view.getUint16(eocdOffset + 6, true);
    const entriesOnDisk = view.getUint16(eocdOffset + 8, true);
    const entryCount = view.getUint16(eocdOffset + 10, true);
    const centralDirectorySize = view.getUint32(eocdOffset + 12, true);
    const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);

    if (
      entriesOnDisk === ZIP64_SENTINEL_16
      || entryCount === ZIP64_SENTINEL_16
      || centralDirectorySize === ZIP64_SENTINEL_32
      || centralDirectoryOffset === ZIP64_SENTINEL_32
    ) {
      throw new Error('ZIP64 XLSX workbooks are not supported.');
    }
    if (diskNumber !== 0 || centralDirectoryDisk !== 0 || entriesOnDisk !== entryCount) {
      malformedZip();
    }
    if (entryCount > MAX_ZIP_ENTRIES) {
      throw new Error('The XLSX file contains more than 2,000 ZIP entries.');
    }

    const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
    if (
      !Number.isSafeInteger(centralDirectoryEnd)
      || centralDirectoryOffset > eocdOffset
      || centralDirectoryEnd !== eocdOffset
    ) {
      malformedZip();
    }

    let cursor = centralDirectoryOffset;
    let aggregateUncompressedSize = 0;
    for (let index = 0; index < entryCount; index += 1) {
      if (cursor + 46 > centralDirectoryEnd) malformedZip();
      if (view.getUint32(cursor, true) !== ZIP_CENTRAL_FILE_HEADER) malformedZip();

      const compressedSize = view.getUint32(cursor + 20, true);
      const uncompressedSize = view.getUint32(cursor + 24, true);
      const fileNameLength = view.getUint16(cursor + 28, true);
      const extraFieldLength = view.getUint16(cursor + 30, true);
      const commentLength = view.getUint16(cursor + 32, true);
      const diskStart = view.getUint16(cursor + 34, true);
      const localHeaderOffset = view.getUint32(cursor + 42, true);
      if (
        compressedSize === ZIP64_SENTINEL_32
        || uncompressedSize === ZIP64_SENTINEL_32
        || localHeaderOffset === ZIP64_SENTINEL_32
        || diskStart === ZIP64_SENTINEL_16
      ) {
        throw new Error('ZIP64 XLSX workbooks are not supported.');
      }
      if (diskStart !== 0) malformedZip();

      aggregateUncompressedSize += uncompressedSize;
      if (aggregateUncompressedSize > MAX_ZIP_UNCOMPRESSED_BYTES) {
        throw new Error('The XLSX file uncompressed data exceeds 100 MB.');
      }

      cursor += 46 + fileNameLength + extraFieldLength + commentLength;
      if (!Number.isSafeInteger(cursor) || cursor > centralDirectoryEnd) malformedZip();
    }
    if (cursor !== centralDirectoryEnd) malformedZip();
  }

  function normalizedHeader(value) {
    return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function errorText(cell) {
    return String(cell.w || EXCEL_ERRORS[cell.v] || '#ERROR!');
  }

  function displayValue(cell) {
    if (!cell || cell.t === 'z') return '';
    if (cell.t === 'e') return errorText(cell);
    return cell.v ?? '';
  }

  function cellAt(sheet, xlsx, row, column) {
    return sheet[xlsx.utils.encode_cell({ r: row, c: column })];
  }

  function hasVisibleValue(cell) {
    if (!cell || cell.t === 'z') return false;
    if (cell.t === 'e') return true;
    return cell.v !== undefined && cell.v !== null && String(cell.v).trim() !== '';
  }

  function buildHeaders(sheet, xlsx, range) {
    const headers = [];
    const occurrences = Object.create(null);
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const cell = cellAt(sheet, xlsx, range.s.r, column);
      const base = String(displayValue(cell)).trim() || '__EMPTY';
      const seen = occurrences[base] || 0;
      occurrences[base] = seen + 1;
      headers.push(seen ? `${base}_${seen}` : base);
    }
    return headers;
  }

  function projectIdValue(cell, errors) {
    if (!cell || cell.t === 'z') return '';
    if (cell.t === 'e') return errorText(cell);
    if (cell.t !== 'n') return cell.v ?? '';

    const formatted = typeof cell.w === 'string' ? cell.w.trim() : '';
    if (formatted && formatted !== String(cell.v)) return formatted;
    errors.push('A numeric Project ID/Code has no formatted identity; format it as text or with explicit leading zeros.');
    return '';
  }

  function parseWorksheet(sheet, xlsx) {
    if (!xlsx?.utils?.decode_range || !xlsx?.utils?.encode_cell) {
      throw new Error('Excel parser is unavailable. Reload the page and try again.');
    }
    if (!sheet?.['!ref']) throw new Error('The first sheet has no data rows.');

    let range;
    let fullRange;
    try {
      range = xlsx.utils.decode_range(sheet['!ref']);
      fullRange = xlsx.utils.decode_range(sheet['!fullref'] || sheet['!ref']);
    } catch {
      throw new Error('The first sheet has an invalid cell range.');
    }

    if (fullRange.s.r !== 0) {
      throw new Error('The first sheet header row must be worksheet row 1; remove leading blank rows and try again.');
    }

    const totalRows = fullRange.e.r - fullRange.s.r + 1;
    const totalColumns = fullRange.e.c - fullRange.s.c + 1;
    if (!Number.isSafeInteger(totalRows) || totalRows < 1 || totalRows > MAX_TOTAL_ROWS) {
      throw new Error('The first sheet exceeds the 5,001-row limit (one header plus 5,000 data rows).');
    }
    if (!Number.isSafeInteger(totalColumns) || totalColumns < 1 || totalColumns > MAX_COLUMNS) {
      throw new Error('The first sheet exceeds the 256-column limit.');
    }
    if (totalRows * totalColumns > MAX_CELLS) {
      throw new Error('The first sheet cell range is too large.');
    }
    if (totalRows === 1) throw new Error('The first sheet has no data rows.');
    if (
      range.s.r !== fullRange.s.r
      || range.s.c !== fullRange.s.c
      || range.e.r < fullRange.e.r
      || range.e.c < fullRange.e.c
    ) {
      throw new Error('The first sheet could not be read completely within the import limits.');
    }

    const headers = buildHeaders(sheet, xlsx, range);
    const rows = [];
    for (let rowIndex = range.s.r + 1; rowIndex <= range.e.r; rowIndex += 1) {
      let hasData = false;
      const row = {};
      const warnings = [];
      const errors = [];

      for (let offset = 0; offset < headers.length; offset += 1) {
        const column = range.s.c + offset;
        const header = headers[offset];
        const cell = cellAt(sheet, xlsx, rowIndex, column);
        if (hasVisibleValue(cell)) hasData = true;

        if (PROJECT_ID_HEADERS.has(normalizedHeader(header))) {
          row[header] = projectIdValue(cell, errors);
        } else {
          row[header] = displayValue(cell);
        }
        if (cell?.t === 'e') {
          warnings.push(`${header} contains Excel error ${errorText(cell)}.`);
        }
      }

      if (!hasData) continue;
      row.__rowNum__ = rowIndex;
      row.__importWarnings__ = warnings;
      row.__importErrors__ = errors;
      rows.push(row);
    }

    if (!rows.length) throw new Error('The first sheet has no data rows.');
    return rows;
  }

  function parseWorkbookData(data, xlsx) {
    const workbookType = validateWorkbookSignature(data);
    if (workbookType === 'xlsx') preflightXlsxZip(data);
    if (!xlsx?.read) throw new Error('Excel parser is unavailable. Reload the page and try again.');
    const workbook = xlsx.read(data, { type: 'array', sheetRows: 5002, sheets: 0 });
    const firstSheetName = workbook.SheetNames?.[0];
    const firstSheet = firstSheetName && workbook.Sheets?.[firstSheetName];
    if (!firstSheet) throw new Error('Workbook has no sheets.');
    return parseWorksheet(firstSheet, xlsx);
  }

  return Object.freeze({
    MAX_CELLS,
    MAX_COLUMNS,
    MAX_TOTAL_ROWS,
    MAX_ZIP_ENTRIES,
    MAX_ZIP_UNCOMPRESSED_BYTES,
    parseWorkbookData,
    parseWorksheet,
    preflightXlsxZip,
    validateWorkbookSignature,
  });
}));
