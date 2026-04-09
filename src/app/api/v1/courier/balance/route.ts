// src/app/api/v1/courier/balance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sfGetBalance } from '@/lib/utils/steadfast';

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: staff } = await supabase.from('staff').select('tenant_id').eq('auth_user_id', user.id).single();
  const { data: tenant } = await supabase.from('tenants').select('settings').eq('id', staff?.tenant_id).single();
  const settings = (tenant?.settings || {}) as Record<string, string>;

  const result = await sfGetBalance(
    settings.sf_api_key || process.env.STEADFAST_API_KEY || '',
    settings.sf_secret_key || process.env.STEADFAST_SECRET_KEY || ''
  );
  return NextResponse.json(result);
}
