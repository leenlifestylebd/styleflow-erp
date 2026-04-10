// src/lib/utils/steadfast.ts
const BASE = 'https://portal.packzy.com/api/v1';

function getHeaders(apiKey: string, secretKey: string): Record<string, string> {
  return {
    'Api-Key': apiKey,
    'Secret-Key': secretKey,
    'Content-Type': 'application/json',
  };
}

export interface SFOrderPayload {
  invoice: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  cod_amount: number;
  note?: string;
  total_lot?: number;
  delivery_type?: 0 | 1;
}

export async function sfCreateOrder(apiKey: string, secretKey: string, order: SFOrderPayload) {
  const res = await fetch(`${BASE}/create_order`, {
    method: 'POST',
    headers: getHeaders(apiKey, secretKey),
    body: JSON.stringify(order)
  });
  return res.json();
}

export async function sfBulkCreate(apiKey: string, secretKey: string, orders: SFOrderPayload[]) {
  const chunks: SFOrderPayload[][] = [];
  for (let i = 0; i < orders.length; i += 500) chunks.push(orders.slice(i, i + 500));
  const results: unknown[] = [];
  for (const chunk of chunks) {
    const res = await fetch(`${BASE}/create_order/bulk-order`, {
      method: 'POST',
      headers: getHeaders(apiKey, secretKey),
      body: JSON.stringify({ data: JSON.stringify(chunk) })
    });
    const data = await res.json();
    if (Array.isArray(data)) results.push(...data);
    else if (data?.data) results.push(...(Array.isArray(data.data) ? data.data : []));
  }
  return results;
}

export async function sfGetStatus(apiKey: string, secretKey: string, trackingCode: string) {
  const res = await fetch(`${BASE}/status_by_trackingcode/${trackingCode}`, {
    headers: getHeaders(apiKey, secretKey)
  });
  return res.json();
}

export async function sfGetBalance(apiKey: string, secretKey: string) {
  const res = await fetch(`${BASE}/get_balance`, {
    headers: getHeaders(apiKey, secretKey)
  });
  return res.json();
}

export async function sfCreateReturn(apiKey: string, secretKey: string, data: {
  consignment_id?: string; invoice?: string; tracking_code?: string; reason?: string;
}) {
  const res = await fetch(`${BASE}/create_return_request`, {
    method: 'POST',
    headers: getHeaders(apiKey, secretKey),
    body: JSON.stringify(data)
  });
  return res.json();
}

export const STEADFAST_STATUS_LABELS: Record<string, string> = {
  in_review: 'In Review',
  pending: 'Pending',
  delivered: 'Delivered',
  partial_delivered: 'Partial Delivered',
  cancelled: 'Cancelled',
  hold: 'On Hold',
  unknown: 'Unknown',
  draft: 'Draft',
};
