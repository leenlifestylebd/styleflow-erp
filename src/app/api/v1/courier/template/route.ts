import { NextResponse } from 'next/server';
import { generateTemplate } from '@/lib/utils/xlsx-parser';

export async function GET() {
  const buf = generateTemplate();
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="steadfast-import-template.xlsx"',
    },
  });
}
