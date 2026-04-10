// src/lib/utils/xlsx-parser.ts
// Parses .xlsx files for Steadfast-compatible bulk courier import
// Required: Invoice, Name, Address, Phone, Amount, Note
// Optional: Contact Name, Contact Phone, Lot Number, Delivery Type

import * as XLSX from 'xlsx';
import type { ImportRow } from '@/types';

const REQUIRED_COLS = ['invoice', 'name', 'address', 'phone', 'amount', 'note'] as const;
const OPTIONAL_COLS = ['contact name', 'contact phone', 'lot number', 'delivery type'] as const;

export interface ParseResult {
  rows: ImportRow[];
  errors: { row: number; errors: string[] }[];
  total: number;
  valid: number;
  skipped: number;
}

// Normalize header names
function normalizeHeader(h: string): string {
  return String(h).toLowerCase().trim().replace(/\s+/g, ' ');
}

// Strip Bangladesh country code if present
function normalizePhone(phone: string): string {
  let p = String(phone).replace(/[^0-9]/g, '');
  if (p.startsWith('880') && p.length === 13) p = p.slice(2);
  if (p.startsWith('88') && p.length === 13)  p = p.slice(2);
  return p;
}

export function parseXLSX(buffer: ArrayBuffer): ParseResult {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

  // ── Only read "Sheet1" ─────────────────────────────────────────────────────
  const sheet = wb.Sheets['Sheet1'];
  if (!sheet) {
    return {
      rows: [], errors: [{ row: 0, errors: ['Sheet1 not found in the uploaded file.'] }],
      total: 0, valid: 0, skipped: 0
    };
  }

  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: ''
  }) as unknown[][];

  if (raw.length < 2) {
    return {
      rows: [], errors: [{ row: 1, errors: ['Sheet1 is empty or has no data rows.'] }],
      total: 0, valid: 0, skipped: 0
    };
  }

  // ── Build header map ───────────────────────────────────────────────────────
  const headerRow = raw[0].map((h) => normalizeHeader(String(h ?? '')));
  const colIndex: Record<string, number> = {};
  headerRow.forEach((h, i) => { if (h) colIndex[h] = i; });

  // Check required columns
  const missingCols = REQUIRED_COLS.filter((c) => !(c in colIndex));
  if (missingCols.length > 0) {
    return {
      rows: [],
      errors: [{ row: 1, errors: [`Missing required columns: ${missingCols.map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join(', ')}. File must contain: Invoice, Name, Address, Phone, Amount, Note`] }],
      total: 0, valid: 0, skipped: 0
    };
  }

  const get = (row: unknown[], col: string): string =>
    String(row[colIndex[col]] ?? '').trim();

  const rows: ImportRow[] = [];
  const errors: { row: number; errors: string[] }[] = [];
  let skipped = 0;

  for (let i = 1; i < raw.length; i++) {
    const row = raw[i];
    const rowNum = i + 1;

    const invoice  = get(row, 'invoice');
    const name     = get(row, 'name');
    const address  = get(row, 'address');
    const phoneRaw = get(row, 'phone');
    const amountRaw = get(row, 'amount');
    const note     = get(row, 'note');

    // Skip completely blank rows
    if (!invoice && !name && !phoneRaw) { skipped++; continue; }

    const rowErrors: string[] = [];

    if (!invoice) rowErrors.push('Invoice is required');
    if (!name)    rowErrors.push('Name is required');
    if (!address) rowErrors.push('Address is required');

    // Phone validation
    const phone = normalizePhone(phoneRaw);
    if (phone.length !== 11) rowErrors.push(`Phone "${phoneRaw}" must be 11 digits (got ${phone.length})`);

    // Amount validation
    const amount = parseFloat(amountRaw.replace(/,/g, ''));
    if (isNaN(amount) || amount < 0) rowErrors.push(`Amount "${amountRaw}" must be a positive number`);

    // Lot Number (optional, 1–1000)
    let lot: number | undefined;
    if ('lot number' in colIndex) {
      const lotRaw = get(row, 'lot number');
      if (lotRaw !== '') {
        const lotNum = parseInt(lotRaw, 10);
        if (isNaN(lotNum) || lotNum < 1 || lotNum > 1000) {
          rowErrors.push(`Lot Number "${lotRaw}" must be between 1 and 1000`);
        } else {
          lot = lotNum;
        }
      }
    }

    // Delivery Type (optional, Home=0, Point=1)
    let deliveryType: 0 | 1 | undefined;
    if ('delivery type' in colIndex) {
      const dtRaw = get(row, 'delivery type').toLowerCase();
      if (dtRaw === 'home')       deliveryType = 0;
      else if (dtRaw === 'point') deliveryType = 1;
      else if (dtRaw !== '')      rowErrors.push(`Delivery Type "${dtRaw}" must be "Home" or "Point"`);
    }

    const importRow: ImportRow = {
      _row: rowNum,
      invoice,
      recipient_name: name,
      recipient_phone: phone,
      recipient_address: address,
      cod_amount: isNaN(amount) ? 0 : amount,
      note,
      total_lot: lot,
      delivery_type: deliveryType,
      contact_name: 'contact name' in colIndex ? get(row, 'contact name') || undefined : undefined,
      contact_phone: 'contact phone' in colIndex ? get(row, 'contact phone') || undefined : undefined,
      _status: rowErrors.length > 0 ? 'error' : 'valid',
      _errors: rowErrors.length > 0 ? rowErrors : undefined,
    };

    rows.push(importRow);
    if (rowErrors.length > 0) errors.push({ row: rowNum, errors: rowErrors });
  }

  const valid = rows.filter((r) => r._status === 'valid').length;

  return { rows, errors, total: rows.length + skipped, valid, skipped };
}

// Generate a blank import template as XLSX buffer
export function generateTemplate(): Uint8Array {
  const wb = XLSX.utils.book_new();

  const headers = [
    'Invoice', 'Name', 'Address', 'Phone', 'Amount', 'Note',
    'Lot Number', 'Delivery Type', 'Contact Name', 'Contact Phone'
  ];

  const samples = [
    ['INV-001', 'রাহেলা বেগম', 'মিরপুর-১০, ঢাকা-১২১৬', '01712345678', 1060, 'Handle carefully', 1, 'Home', '', ''],
    ['INV-002', 'Karim Uddin', 'Dhanmondi, Dhaka-1209', '01812345678', 850, '', 2, 'Point', 'Reseller 1', '01900000000'],
    ['INV-003', 'Nasrin Akter', 'Uttara, Dhaka', '01912345678', 1500, 'Call before delivery', '', '', '', ''],
  ];

  const wsData = [headers, ...samples];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws['!cols'] = [
    { wch: 12 }, { wch: 18 }, { wch: 35 }, { wch: 16 },
    { wch: 10 }, { wch: 20 }, { wch: 12 }, { wch: 14 },
    { wch: 16 }, { wch: 16 }
  ];

  // Notes sheet
  const notesData = [
    ['Field', 'Required', 'Rules'],
    ['Invoice', 'YES', 'Unique alphanumeric, hyphens & underscores allowed'],
    ['Name', 'YES', 'Recipient full name'],
    ['Address', 'YES', 'Full delivery address'],
    ['Phone', 'YES', '11 digit BD phone (01XXXXXXXXX). Country code auto-stripped'],
    ['Amount', 'YES', 'Numeric. Must include delivery charge. e.g. product 1000 + delivery 60 = 1060'],
    ['Note', 'YES', 'Leave blank if none (column must exist)'],
    ['Lot Number', 'Optional', '1 to 1000'],
    ['Delivery Type', 'Optional', '"Home" or "Point" (Steadfast Hub)'],
    ['Contact Name', 'Optional', 'Custom sender name per parcel'],
    ['Contact Phone', 'Optional', 'Custom sender phone per parcel'],
    ['', '', ''],
    ['IMPORTANT', '', 'Only Sheet1 data is imported. Other sheets are ignored.'],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(notesData);
  ws2['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 60 }];

  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.utils.book_append_sheet(wb, ws2, 'Instructions');

  const result = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as unknown as number[];
  return new Uint8Array(result);
}
