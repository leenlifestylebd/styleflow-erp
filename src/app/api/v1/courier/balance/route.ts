import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  // Get keys from query params (sent from client settings) or env vars
  const { searchParams } = new URL(req.url);
  const apiKey = searchParams.get('api_key') || process.env.STEADFAST_API_KEY || '';
  const secretKey = searchParams.get('secret_key') || process.env.STEADFAST_SECRET_KEY || '';

  if (!apiKey || !secretKey) {
    return NextResponse.json({ error: 'API credentials not configured' }, { status: 400 });
  }

  try {
    const res = await fetch('https://portal.packzy.com/api/v1/get_balance', {
      headers: {
        'Api-Key': apiKey,
        'Secret-Key': secretKey,
        'Content-Type': 'application/json',
      }
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Connection failed' }, { status: 500 });
  }
}
