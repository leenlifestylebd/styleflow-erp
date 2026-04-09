import { NextResponse } from 'next/server';
import { generateTemplate } from '@/lib/utils/xlsx-parser';

export async function GET() {
  const uint8 = generateTemplate();
  // Convert to ArrayBuffer explicitly to satisfy TypeScript strict types
  const arrayBuffer = uint8.buffer.slice(
    uint8.byteOffset,
    uint8.byteOffset + uint8.byteLength
  ) as ArrayBuffer;
  return new NextResponse(arrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="steadfast-import-template.xlsx"',
    },
  });
}
