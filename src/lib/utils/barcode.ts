// src/lib/utils/barcode.ts
// Barcode generation using JsBarcode
// Supports EAN13, CODE128, CODE39

import type { BarcodeType } from '@/types';

// Generate a unique SKU
export function generateSKU(productName: string, size?: string, color?: string): string {
  const prefix = productName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)
    .padEnd(4, 'X');
  const sizePart = (size || 'XX').toUpperCase().slice(0, 2).padEnd(2, 'X');
  const colorPart = (color || 'XX').toUpperCase().slice(0, 2).padEnd(2, 'X');
  const seq = Math.floor(Math.random() * 9000) + 1000;
  return `${prefix}-${sizePart}${colorPart}-${seq}`;
}

// Generate EAN-13 barcode number with check digit
export function generateEAN13(prefix = '471'): string {
  // prefix = country/company prefix (3-7 digits)
  const p = prefix.slice(0, 7).padEnd(7, '0');
  const product = String(Math.floor(Math.random() * 99999)).padStart(5, '0');
  const raw = p + product; // 12 digits
  const check = calcEAN13Check(raw);
  return raw + check;
}

function calcEAN13Check(s: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(s[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return String((10 - (sum % 10)) % 10);
}

// Generate CODE128 barcode value from SKU
export function generateCODE128(sku: string): string {
  return sku; // CODE128 supports full ASCII
}

// Generate CODE39 barcode value
export function generateCODE39(sku: string): string {
  // CODE39 supports: 0-9, A-Z, space, - . $ / + %
  return sku.toUpperCase().replace(/[^0-9A-Z\- .$/+%]/g, '').slice(0, 20);
}

// Render barcode to SVG string (server-side safe)
export function renderBarcodeSVG(
  value: string,
  type: BarcodeType,
  options: { width?: number; height?: number; fontSize?: number } = {}
): string {
  // Returns JsBarcode options — actual rendering done client-side via <canvas> or <svg>
  const { width = 2, height = 60, fontSize = 14 } = options;
  return JSON.stringify({
    value,
    format: type === 'EAN13' ? 'EAN13' : type === 'CODE39' ? 'CODE39' : 'CODE128',
    width,
    height,
    fontSize,
    textMargin: 4,
    margin: 8,
    displayValue: true,
  });
}

// Auto-select barcode type based on value
export function autoBarcodeType(value: string): BarcodeType {
  if (/^\d{12,13}$/.test(value)) return 'EAN13';
  if (/^[0-9A-Z\- .$/+%*]+$/.test(value) && value.length <= 20) return 'CODE39';
  return 'CODE128';
}

// Validate EAN-13
export function validateEAN13(value: string): boolean {
  if (!/^\d{13}$/.test(value)) return false;
  return calcEAN13Check(value.slice(0, 12)) === value[12];
}

// Generate barcode for a variation
export function generateBarcode(sku: string, type: BarcodeType): string {
  switch (type) {
    case 'EAN13':  return generateEAN13();
    case 'CODE39': return generateCODE39(sku);
    default:       return generateCODE128(sku);
  }
}

// Bulk barcode generate for multiple variations
export function bulkGenerateBarcodes(
  variations: { id: string; sku: string; barcode_type: BarcodeType }[]
): { id: string; barcode: string; barcode_type: BarcodeType }[] {
  return variations.map((v) => ({
    id: v.id,
    barcode: generateBarcode(v.sku, v.barcode_type),
    barcode_type: v.barcode_type,
  }));
}
