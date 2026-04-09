// src/app/api/v1/courier/bulk-submit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sfBulkCreate } from '@/lib/utils/steadfast';
import type { ImportRow } from '@/types';

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { rows, courier }: { rows: ImportRow[]; courier: string } = body;

  if (!rows?.length) return NextResponse.json({ error: 'No rows provided' }, { status: 400 });

  // Get tenant settings
  const { data: staff } = await supabase
    .from('staff').select('tenant_id').eq('auth_user_id', user.id).single();
  if (!staff) return NextResponse.json({ error: 'Staff not found' }, { status: 403 });

  const { data: tenant } = await supabase
    .from('tenants').select('settings').eq('id', staff.tenant_id).single();
  const settings = (tenant?.settings || {}) as Record<string, string>;

  const validRows = rows.filter((r) => r._status === 'valid' || r._status === 'failed');
  if (!validRows.length) return NextResponse.json({ error: 'No valid rows to submit' }, { status: 400 });

  let results: unknown[] = [];

  if (courier === 'steadfast') {
    const apiKey    = settings.sf_api_key    || process.env.STEADFAST_API_KEY || '';
    const secretKey = settings.sf_secret_key || process.env.STEADFAST_SECRET_KEY || '';
    if (!apiKey || !secretKey) {
      return NextResponse.json({ error: 'Steadfast API credentials not configured' }, { status: 400 });
    }

    const payload = validRows.map((r) => ({
      invoice:           r.invoice,
      recipient_name:    r.recipient_name,
      recipient_phone:   r.recipient_phone,
      recipient_address: r.recipient_address,
      cod_amount:        r.cod_amount,
      note:              r.note || '',
      total_lot:         r.total_lot,
      delivery_type:     r.delivery_type,
    }));

    const sfResults = await sfBulkCreate(apiKey, secretKey, payload) as Array<Record<string, unknown>>;

    // Save to DB and map results
    results = await Promise.all(
      sfResults.map(async (res, i) => {
        const row = validRows[i];
        const success = res.status === 'success';

        if (success) {
          await supabase.from('shipments').insert({
            tenant_id:        staff.tenant_id,
            invoice:          row.invoice,
            courier:          'steadfast',
            consignment_id:   String(res.consignment_id || ''),
            tracking_code:    String(res.tracking_code || ''),
            status:           'in_review',
            recipient_name:   row.recipient_name,
            recipient_phone:  row.recipient_phone,
            recipient_address: row.recipient_address,
            cod_amount:       row.cod_amount,
            delivery_type:    row.delivery_type ?? 0,
            total_lot:        row.total_lot ?? null,
            contact_name:     row.contact_name ?? null,
            contact_phone:    row.contact_phone ?? null,
            note:             row.note || null,
          });
        }

        return {
          _row:          row._row,
          invoice:       row.invoice,
          status:        success ? 'success' : 'error',
          tracking_code: res.tracking_code,
          consignment_id: res.consignment_id,
        };
      })
    );

  } else if (courier === 'pathao') {
    // Pathao integration stub
    results = validRows.map((r) => ({ _row: r._row, invoice: r.invoice, status: 'error', message: 'Pathao integration coming soon' }));

  } else if (courier === 'redx') {
    // RedX integration stub
    results = validRows.map((r) => ({ _row: r._row, invoice: r.invoice, status: 'error', message: 'RedX integration coming soon' }));
  }

  return NextResponse.json({ results });
}
