'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Download } from 'lucide-react';

export default function ReportsPage() {
  const supabase = createClient();
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [to, setTo] = useState(new Date().toISOString().split('T')[0]);
  const [sales, setSales] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [shipments, setShipments] = useState<any[]>([]);
  const [dailyChart, setDailyChart] = useState<any[]>([]);

  useEffect(() => { loadReports(); }, [from, to]);

  async function loadReports() {
    const { data: s } = await supabase.from('sales').select('*, payments(method, amount)').gte('created_at', from + 'T00:00:00').lte('created_at', to + 'T23:59:59').eq('status', 'completed');
    const { data: e } = await supabase.from('expenses').select('*').gte('expense_date', from).lte('expense_date', to);
    const { data: sh } = await supabase.from('shipments').select('status').gte('created_at', from + 'T00:00:00').lte('created_at', to + 'T23:59:59');
    setSales(s || []);
    setExpenses(e || []);
    setShipments(sh || []);

    // Build daily chart
    const map: Record<string, number> = {};
    (s || []).forEach((sale: any) => {
      const d = sale.created_at.split('T')[0];
      map[d] = (map[d] || 0) + sale.total;
    });
    const chart = Object.entries(map).sort().map(([date, rev]) => ({
      date: new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      revenue: Math.round(rev as number)
    }));
    setDailyChart(chart);
  }

  function exportCSV(data: any[], filename: string) {
    if (!data.length) return;
    const keys = Object.keys(data[0]);
    const csv = [keys.join(','), ...data.map(r => keys.map(k => `"${r[k] ?? ''}"`).join(','))].join('\n');
    const a = Object.assign(document.createElement('a'), { href: 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv), download: filename });
    a.click();
  }

  const totalRevenue = sales.reduce((a, s) => a + s.total, 0);
  const totalExpenses = expenses.reduce((a, e) => a + Number(e.amount), 0);
  const profit = totalRevenue - totalExpenses;
  const cashSales = sales.flatMap(s => s.payments || []).filter((p: any) => p.method === 'cash').reduce((a: number, p: any) => a + p.amount, 0);
  const bkashSales = sales.flatMap(s => s.payments || []).filter((p: any) => p.method === 'bkash').reduce((a: number, p: any) => a + p.amount, 0);
  const nagadSales = sales.flatMap(s => s.payments || []).filter((p: any) => p.method === 'nagad').reduce((a: number, p: any) => a + p.amount, 0);
  const fmt = (n: number) => `৳${n.toLocaleString()}`;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reports</h1>
        <div className="flex items-center gap-3">
          <input type="date" className="border rounded-xl px-3 py-2 text-sm" value={from} onChange={e => setFrom(e.target.value)} />
          <span className="text-gray-400">to</span>
          <input type="date" className="border rounded-xl px-3 py-2 text-sm" value={to} onChange={e => setTo(e.target.value)} />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Revenue', value: fmt(totalRevenue), color: 'text-green-700' },
          { label: 'Expenses', value: fmt(totalExpenses), color: 'text-red-600' },
          { label: 'Net profit', value: fmt(profit), color: profit >= 0 ? 'text-purple-700' : 'text-red-700' },
          { label: 'Total orders', value: sales.length, color: 'text-gray-700' },
          { label: 'Shipments', value: shipments.length, color: 'text-blue-700' },
        ].map(s => (
          <div key={s.label} className="bg-white border rounded-2xl p-4 shadow-sm text-center">
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold mb-4">Daily revenue</h3>
          {dailyChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `৳${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="revenue" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No sales in this period</div>}
        </div>

        <div className="bg-white border rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold mb-4">Payment breakdown</h3>
          <div className="space-y-4">
            {[['Cash', cashSales, '#10b981'],['bKash', bkashSales, '#ec4899'],['Nagad', nagadSales, '#f97316']].map(([label, val, color]) => (
              <div key={label as string}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{label}</span>
                  <span className="font-medium">{fmt(val as number)}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: totalRevenue > 0 ? `${((val as number) / totalRevenue * 100).toFixed(0)}%` : '0%', background: color as string }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Courier report */}
      <div className="bg-white border rounded-2xl p-5 shadow-sm">
        <h3 className="font-semibold mb-4">Courier summary</h3>
        <div className="grid grid-cols-4 gap-4">
          {[
            ['Total', shipments.length, 'text-gray-700'],
            ['Delivered', shipments.filter(s => s.status === 'delivered').length, 'text-green-700'],
            ['Pending', shipments.filter(s => ['in_review','pending'].includes(s.status)).length, 'text-yellow-700'],
            ['Cancelled', shipments.filter(s => s.status === 'cancelled').length, 'text-red-700'],
          ].map(([label, val, color]) => (
            <div key={label as string} className="text-center">
              <div className={`text-2xl font-bold ${color}`}>{val}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Export */}
      <div className="bg-white border rounded-2xl p-5 shadow-sm">
        <h3 className="font-semibold mb-4">Export data</h3>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => exportCSV(sales.map(s => ({ sale_number: s.sale_number, total: s.total, paid: s.paid, due: s.due, date: s.created_at?.split('T')[0] })), 'sales.csv')}
            className="flex items-center gap-2 px-4 py-2 border rounded-xl text-sm hover:bg-gray-50">
            <Download className="h-4 w-4" /> Sales CSV
          </button>
          <button onClick={() => exportCSV(expenses, 'expenses.csv')}
            className="flex items-center gap-2 px-4 py-2 border rounded-xl text-sm hover:bg-gray-50">
            <Download className="h-4 w-4" /> Expenses CSV
          </button>
        </div>
      </div>
    </div>
  );
}
