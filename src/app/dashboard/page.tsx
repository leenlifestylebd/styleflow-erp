'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import { TrendingUp, Package, Truck, AlertCircle, RefreshCw } from 'lucide-react';

const COLORS = ['#7c3aed', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

export default function DashboardPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    today_revenue: 0, today_orders: 0,
    pending_courier: 0, low_stock: 0,
    balance: 0
  });
  const [salesChart, setSalesChart] = useState<{ date: string; revenue: number; orders: number }[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState<{ name: string; value: number }[]>([]);
  const [courierStats, setCourierStats] = useState<{ status: string; count: number }[]>([]);

  useEffect(() => { loadDashboard(); }, []);

  async function loadDashboard() {
    setLoading(true);
    try {
      // Today's sales
      const today = new Date().toISOString().split('T')[0];
      const { data: todaySales } = await supabase
        .from('sales')
        .select('total, created_at')
        .gte('created_at', today + 'T00:00:00')
        .eq('status', 'completed');

      // Last 7 days chart
      const { data: weeklySales } = await supabase
        .from('sales')
        .select('total, created_at')
        .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
        .eq('status', 'completed');

      // Shipments pending
      const { count: pendingCount } = await supabase
        .from('shipments')
        .select('*', { count: 'exact', head: true })
        .in('status', ['draft', 'in_review', 'pending']);

      // Low stock
      const { count: lowStockCount } = await supabase
        .from('inventory')
        .select('*', { count: 'exact', head: true })
        .lt('qty', 5);

      // Payment breakdown (this month)
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('method, amount')
        .gte('created_at', monthStart);

      // Courier status breakdown
      const { data: shipmentData } = await supabase
        .from('shipments')
        .select('status')
        .gte('created_at', monthStart);

      // Process data
      const todayRevenue = (todaySales || []).reduce((s, r) => s + r.total, 0);

      // Group weekly by day
      const dayMap: Record<string, { revenue: number; orders: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
        dayMap[d] = { revenue: 0, orders: 0 };
      }
      (weeklySales || []).forEach((s) => {
        const d = s.created_at.split('T')[0];
        if (dayMap[d]) { dayMap[d].revenue += s.total; dayMap[d].orders++; }
      });
      const chartData = Object.entries(dayMap).map(([date, v]) => ({
        date: new Date(date).toLocaleDateString('en', { weekday: 'short' }),
        revenue: Math.round(v.revenue),
        orders: v.orders,
      }));

      // Payment breakdown
      const pmMap: Record<string, number> = {};
      (paymentsData || []).forEach((p) => { pmMap[p.method] = (pmMap[p.method] || 0) + p.amount; });
      const breakdown = Object.entries(pmMap).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value: Math.round(value) }));

      // Courier stats
      const statusMap: Record<string, number> = {};
      (shipmentData || []).forEach((s) => { statusMap[s.status] = (statusMap[s.status] || 0) + 1; });
      const cStats = Object.entries(statusMap).map(([status, count]) => ({ status, count }));

      setStats({
        today_revenue: todayRevenue,
        today_orders: todaySales?.length || 0,
        pending_courier: pendingCount || 0,
        low_stock: lowStockCount || 0,
        balance: 0
      });
      setSalesChart(chartData);
      setPaymentBreakdown(breakdown);
      setCourierStats(cStats);
    } finally {
      setLoading(false);
    }
  }

  const fmt = (n: number) => `৳${n.toLocaleString()}`;

  const statCards = [
    { label: "Today's revenue", value: fmt(stats.today_revenue), icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: "Today's orders", value: stats.today_orders, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Pending courier', value: stats.pending_courier, icon: Truck, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Low stock SKUs', value: stats.low_stock, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm">{new Date().toLocaleDateString('en-BD', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <button onClick={loadDashboard} className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm border">
            <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center mb-3`}>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-sm text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border">
          <h2 className="font-semibold text-gray-800 mb-4">Revenue — last 7 days</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={salesChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [`৳${v.toLocaleString()}`, 'Revenue']} />
              <Area type="monotone" dataKey="revenue" stroke="#7c3aed" fill="#ede9fe" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Payment breakdown */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border">
          <h2 className="font-semibold text-gray-800 mb-4">Payment methods (this month)</h2>
          {paymentBreakdown.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={paymentBreakdown} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value">
                    {paymentBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `৳${v.toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {paymentBreakdown.map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-gray-600">{item.name}</span>
                    </div>
                    <span className="font-medium">{fmt(item.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-gray-400 text-sm">No payment data yet</div>
          )}
        </div>
      </div>

      {/* Courier status + Orders chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border">
          <h2 className="font-semibold text-gray-800 mb-4">Daily orders (last 7 days)</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={salesChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="orders" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border">
          <h2 className="font-semibold text-gray-800 mb-4">Courier status (this month)</h2>
          {courierStats.length > 0 ? (
            <div className="space-y-3">
              {courierStats.map((s, i) => {
                const total = courierStats.reduce((a, x) => a + x.count, 0);
                const pct = Math.round((s.count / total) * 100);
                const colors: Record<string, string> = {
                  delivered: 'bg-green-500', cancelled: 'bg-red-400',
                  in_review: 'bg-purple-400', pending: 'bg-amber-400', draft: 'bg-gray-300'
                };
                return (
                  <div key={s.status}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 capitalize">{s.status.replace(/_/g, ' ')}</span>
                      <span className="font-medium">{s.count} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${colors[s.status] || 'bg-blue-400'} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-gray-400 text-sm">No shipment data yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
