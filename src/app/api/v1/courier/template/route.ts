import { NextResponse } from 'next/server';
import { generateTemplate } from '@/lib/utils/xlsx-parser';

export async function GET() {
  const buffer = generateTemplate();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  return new NextResponse(blob, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="steadfast-import-template.xlsx"',
    },
  });
}
