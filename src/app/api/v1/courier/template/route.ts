// src/app/api/v1/courier/template/route.ts
import { NextResponse } from 'next/server';
import { generateTemplate } from '@/lib/utils/xlsx-parser';

export async function GET() {
  const buffer = generateTemplate();
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="steadfast-import-template.xlsx"',
    },
  });
}
