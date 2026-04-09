'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Truck, Search, RefreshCw, Package, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import Link from 'next/link';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  in_review: 'bg-purple-100 text-purple-700',
  pending: 'bg-yellow-100 text-yellow-700',
  delivered: 'bg-green-100 text-green-700',
  partial_delivered: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
  hold: 'bg-orange-100 text-orange-700',
};

export default function CourierPage() {
  const supabase = createClient();
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => { loadShipments(); loadBalance(); }, [statusFilter]);

  async function loadShipments() {
    setLoading(true);
    let q = supabase.from('shipments').select('*').order('created_at', { ascending: false }).limit(100);
    if (statusFilter) q = q.eq('status', statusFilter);
    if (search) q = q.or(`tracking_code.ilike.%${search}%,invoice.ilike.%${search}%,recipient_name.ilike.%${search}%`);
    const { data } = await q;
    setShipments(data || []);
    setLoading(false);
  }

  async function loadBalance() {
    try {
      const res = await fetch('/api/v1/courier/balance');
      const data = await res.json();
      if (data.current_balance !== undefined) setBalance(data.current_balance);
    } catch {}
  }

  const stats = {
    total: shipments.length,
    delivered: shipments.filter(s => s.status === 'delivered').length,
    pending: shipments.filter(s => ['in_review','pending'].includes(s.status)).length,
    cancelled: shipments.filter(s => s.status === 'cancelled').length,
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Courier Management</h1>
          <p className="text-gray-500 text-sm mt-1">Track and manage all shipments</p>
        </div>
        <div className="flex gap-3">
          {balance !== null && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-2 text-sm">
              <span className="text-purple-600 font-medium">Steadfast Balance: </span>
              <span className="font-bold text-purple-800">৳{balance.toLocaleString()}</span>
            </div>
          )}
          <Link href="/courier/import" className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700">
            <Package className="h-4 w-4" /> Bulk Import
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: stats.total, icon: Truck, color: 'text-gray-700', bg: 'bg-gray-50' },
          { label: 'Delivered', value: stats.delivered, icon: CheckCircle, color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-yellow-700', bg: 'bg-yellow-50' },
          { label: 'Cancelled', value: stats.cancelled, icon: XCircle, color: 'text-red-700', bg: 'bg-red-50' },
        ].map(s => (
          <div key={s.label} className="bg-white border rounded-2xl p-4 shadow-sm">
            <div className={`w-8 h-8 ${s.bg} rounded-lg flex items-center justify-center mb-2`}>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="Search tracking, invoice, name..."
            value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadShipments()} />
        </div>
        <select className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All status</option>
          <option value="draft">Draft</option>
          <option value="in_review">In Review</option>
          <option value="pending">Pending</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
          <option value="hold">On Hold</option>
        </select>
        <button onClick={loadShipments} className="flex items-center gap-2 px-4 py-2 border rounded-xl text-sm hover:bg-gray-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Invoice', 'Recipient', 'Phone', 'COD', 'Courier', 'Tracking', 'Status', 'Date'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-gray-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : shipments.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                  <Truck className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No shipments yet. Use Bulk Import to add orders.
                </td></tr>
              ) : shipments.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{s.invoice}</td>
                  <td className="px-4 py-3 font-medium">{s.recipient_name}</td>
                  <td className="px-4 py-3 text-gray-500">{s.recipient_phone}</td>
                  <td className="px-4 py-3 font-medium">৳{Number(s.cod_amount).toLocaleString()}</td>
                  <td className="px-4 py-3 capitalize">{s.courier}</td>
                  <td className="px-4 py-3 font-mono text-xs text-purple-600">{s.tracking_code || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[s.status] || 'bg-gray-100 text-gray-600'}`}>
                      {s.status?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{new Date(s.created_at).toLocaleDateString('en-GB')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
