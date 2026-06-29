(function exposeExcelWorkerCore(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ExcelWorkerCore = api;
}(typeof self !== 'undefined' ? self : globalThis, function createExcelWorkerCore() {
  'use strict';

  const MAX_TOTAL_ROWS = 5001;
  const MAX_COLUMNS = 256;
  const MAX_CELLS = 1000000;
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
    try {
      range = xlsx.utils.decode_range(sheet['!ref']);
    } catch {
      throw new Error('The first sheet has an invalid cell range.');
    }

    const totalRows = range.e.r - range.s.r + 1;
    const totalColumns = range.e.c - range.s.c + 1;
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
    validateWorkbookSignature(data);
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
    parseWorkbookData,
    parseWorksheet,
    validateWorkbookSignature,
  });
}));
