'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { TrendingUp, TrendingDown, Users, ShoppingBag, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

const EXPENSE_CATS = [
  'Office & Admin', 'Transport & Delivery', 'Utilities',
  'Marketing & Ads', 'Fabric & Raw Material', 'Packaging',
  'Equipment & Tools', 'Rent', 'Other',
];

type Tab = 'pl' | 'employees' | 'salary' | 'production' | 'expenses' | 'purchases';

export default function AccountingPage() {
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>('pl');
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [to,   setTo]   = useState(new Date().toISOString().split('T')[0]);
  const [pl, setPl]     = useState<{ revenue: number; salary: number; expenses: number; purchases: number; profit: number; breakdown: { category: string; total: number }[] } | null>(null);
  const [employees, setEmployees] = useState<{ id: string; name: string; role: string; salary: number; salary_type: string; status: string }[]>([]);
  const [salaries,  setSalaries]  = useState<{ id: number; employee_id: string; month: string; amount: number; type: string; note: string; paid_at: string; employees: { name: string } }[]>([]);
  const [production, setProduction] = useState<{ id: number; employee_id: string; log_date: string; product_name: string; qty: number; unit: string; earned: number; employees: { name: string } }[]>([]);
  const [expenses,  setExpenses]  = useState<{ id: number; category: string; description: string; amount: number; expense_date: string; reference: string }[]>([]);
  const [purchases, setPurchases] = useState<{ id: number; supplier: string; item_name: string; qty: number; unit: string; unit_price: number; total_amount: number; purchase_date: string }[]>([]);
  const [showForm,  setShowForm]  = useState(false);
  const [form,      setForm]      = useState<Record<string, string | number>>({});

  const fmt = (n: number) => `৳${(n || 0).toLocaleString()}`;
  const month = new Date().toISOString().slice(0, 7);

  useEffect(() => { loadAll(); }, [from, to]);

  async function loadAll() {
    // P&L
    const { data: sales } = await supabase.from('sales').select('total').eq('status', 'completed').gte('created_at', from + 'T00:00:00').lte('created_at', to + 'T23:59:59');
    const { data: salData } = await supabase.from('salary_payments').select('amount').gte('paid_at', from + 'T00:00:00').lte('paid_at', to + 'T23:59:59');
    const { data: expData } = await supabase.from('expenses').select('amount, category').gte('expense_date', from).lte('expense_date', to);
    const { data: purData } = await supabase.from('purchase_orders').select('total_amount').gte('order_date', from).lte('order_date', to);

    const revenue   = (sales || []).reduce((a, s) => a + s.total, 0);
    const salary    = (salData || []).reduce((a, s) => a + s.amount, 0);
    const expenses  = (expData || []).reduce((a, e) => a + e.amount, 0);
    const purchases = (purData || []).reduce((a, p) => a + p.total_amount, 0);
    const profit    = revenue - salary - expenses - purchases;

    const catMap: Record<string, number> = {};
    (expData || []).forEach((e) => { catMap[e.category] = (catMap[e.category] || 0) + e.amount; });
    const breakdown = Object.entries(catMap).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);

    setPl({ revenue, salary, expenses, purchases, profit, breakdown });

    // Other data
    const { data: emps } = await supabase.from('employees').select('*').order('name');
    setEmployees(emps || []);

    const { data: sals } = await supabase.from('salary_payments').select('*, employees(name)').order('paid_at', { ascending: false }).limit(50);
    setSalaries((sals || []) as typeof salaries);

    const { data: prod } = await supabase.from('production_log').select('*, employees(name)').gte('log_date', from).lte('log_date', to).order('log_date', { ascending: false }).limit(100);
    setProduction((prod || []) as typeof production);

    const { data: exp } = await supabase.from('expenses').select('*').gte('expense_date', from).lte('expense_date', to).order('expense_date', { ascending: false });
    setExpenses(exp || []);

    const { data: pur } = await supabase.from('purchase_orders').select('*').gte('order_date', from).lte('order_date', to).order('order_date', { ascending: false });
    setPurchases(pur || []);
  }

  async function saveForm() {
    const f = form;
    if (tab === 'employees') {
      const { error } = await supabase.from('employees').insert({ name: f.name, phone: f.phone, role: f.role, salary: Number(f.salary), salary_type: f.salary_type || 'monthly', status: 'active' });
      if (error) { toast.error('Failed'); return; }
    } else if (tab === 'salary') {
      const { error } = await supabase.from('salary_payments').insert({ employee_id: f.employee_id, month: f.month || month, amount: Number(f.amount), type: f.type || 'full', note: f.note });
      if (error) { toast.error('Failed'); return; }
    } else if (tab === 'production') {
      const { error } = await supabase.from('production_log').insert({ employee_id: f.employee_id, log_date: f.log_date || new Date().toISOString().split('T')[0], product_name: f.product_name, qty: Number(f.qty), unit: f.unit || 'pcs', piece_rate: Number(f.piece_rate) || 0, earned: (Number(f.qty) || 0) * (Number(f.piece_rate) || 0) });
      if (error) { toast.error('Failed'); return; }
    } else if (tab === 'expenses') {
      const { error } = await supabase.from('expenses').insert({ category: f.category, description: f.description, amount: Number(f.amount), expense_date: f.expense_date || new Date().toISOString().split('T')[0], reference: f.reference });
      if (error) { toast.error('Failed'); return; }
    } else if (tab === 'purchases') {
      const qty = Number(f.qty) || 1, price = Number(f.unit_price) || 0;
      const { data: po } = await supabase.from('purchase_orders').insert({ supplier_id: null, total_amount: qty * price, paid_amount: 0, due_amount: qty * price, order_date: f.order_date || new Date().toISOString().split('T')[0], po_number: `PO-${Date.now()}`, status: 'ordered' }).select().single();
      if (po) {
        await supabase.from('purchase_items').insert({ po_id: po.id, product_name: String(f.item_name), qty, unit_price: price, total: qty * price });
      }
    }
    toast.success('Saved!'); setShowForm(false); setForm({}); loadAll();
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'pl', label: '📊 P&L' },
    { id: 'employees', label: '👨‍💼 Employees' },
    { id: 'salary', label: '💰 Salary' },
    { id: 'production', label: '🏭 Production' },
    { id: 'expenses', label: '📋 Expenses' },
    { id: 'purchases', label: '🛒 Purchases' },
  ];

  const f = (k: string) => String(form[k] ?? '');
  const setF = (k: string, v: string | number) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Accounting</h1>
        <div className="flex gap-2 items-center">
          <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-gray-400">to</span>
          <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.id ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── P&L ──────────────────────────────────────────────────────── */}
      {tab === 'pl' && pl && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: 'Revenue', value: pl.revenue, icon: TrendingUp, color: 'text-green-700', bg: 'bg-green-50' },
              { label: 'Salary', value: pl.salary, icon: Users, color: 'text-red-600', bg: 'bg-red-50' },
              { label: 'Expenses', value: pl.expenses, icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' },
              { label: 'Purchases', value: pl.purchases, icon: ShoppingBag, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Net Profit', value: pl.profit, icon: TrendingUp, color: pl.profit >= 0 ? 'text-purple-700' : 'text-red-700', bg: pl.profit >= 0 ? 'bg-purple-50' : 'bg-red-50' },
            ].map((s) => (
              <div key={s.label} className="bg-white border rounded-2xl p-4 shadow-sm">
                <div className={`w-8 h-8 ${s.bg} rounded-lg flex items-center justify-center mb-2`}>
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <div className={`text-xl font-bold ${s.color}`}>{fmt(s.value)}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {pl.breakdown.length > 0 && (
            <div className="bg-white border rounded-2xl p-5 shadow-sm">
              <h3 className="font-semibold mb-4">Expense breakdown</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  {pl.breakdown.map((b) => (
                    <div key={b.category} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{b.category}</span>
                      <span className="font-medium text-sm">{fmt(b.total)}</span>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={pl.breakdown} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="category" tick={{ fontSize: 10 }} width={100} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="total" fill="#7c3aed" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Employees ──────────────────────────────────────────────── */}
      {tab === 'employees' && (
        <div>
          <div className="flex justify-end mb-4">
            <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm" onClick={() => { setForm({ salary_type: 'monthly' }); setShowForm(true); }}>
              <Plus className="h-4 w-4" /> Add employee
            </button>
          </div>
          <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr>
                {['Name', 'Role', 'Salary type', 'Salary', 'Status'].map((h) => <th key={h} className="px-4 py-3 text-left text-xs text-gray-500 font-medium">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y">
                {employees.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{e.name}</td>
                    <td className="px-4 py-3 text-gray-500">{e.role}</td>
                    <td className="px-4 py-3 capitalize">{e.salary_type}</td>
                    <td className="px-4 py-3 font-medium">{fmt(e.salary)}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full font-medium ${e.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{e.status}</span></td>
                  </tr>
                ))}
                {employees.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No employees yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Salary ─────────────────────────────────────────────────── */}
      {tab === 'salary' && (
        <div>
          <div className="flex justify-end mb-4">
            <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm" onClick={() => { setForm({ type: 'full', month }); setShowForm(true); }}>
              <Plus className="h-4 w-4" /> Pay salary
            </button>
          </div>
          {/* Monthly summary */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {['full', 'partial', 'advance'].map((type) => {
              const total = salaries.filter((s) => s.type === type && s.month === month).reduce((a, s) => a + s.amount, 0);
              return (
                <div key={type} className="bg-white border rounded-xl p-4 shadow-sm text-center">
                  <div className="text-lg font-bold">{fmt(total)}</div>
                  <div className="text-xs text-gray-500 mt-1 capitalize">{type} payments (this month)</div>
                </div>
              );
            })}
          </div>
          <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr>
                {['Employee', 'Month', 'Type', 'Amount', 'Note', 'Date'].map((h) => <th key={h} className="px-4 py-3 text-left text-xs text-gray-500 font-medium">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y">
                {salaries.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{s.employees?.name}</td>
                    <td className="px-4 py-3">{s.month}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full font-medium ${s.type === 'full' ? 'bg-green-100 text-green-700' : s.type === 'advance' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{s.type}</span></td>
                    <td className="px-4 py-3 font-semibold">{fmt(s.amount)}</td>
                    <td className="px-4 py-3 text-gray-500">{s.note || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{new Date(s.paid_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {salaries.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No payments yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Production ────────────────────────────────────────────── */}
      {tab === 'production' && (
        <div>
          <div className="flex justify-end mb-4">
            <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm" onClick={() => { setForm({ unit: 'pcs', log_date: new Date().toISOString().split('T')[0] }); setShowForm(true); }}>
              <Plus className="h-4 w-4" /> Log production
            </button>
          </div>
          <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr>
                {['Date', 'Employee', 'Product', 'Qty', 'Unit', 'Earned'].map((h) => <th key={h} className="px-4 py-3 text-left text-xs text-gray-500 font-medium">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y">
                {production.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs">{p.log_date}</td>
                    <td className="px-4 py-3 font-medium">{p.employees?.name}</td>
                    <td className="px-4 py-3">{p.product_name || '—'}</td>
                    <td className="px-4 py-3 font-semibold">{p.qty}</td>
                    <td className="px-4 py-3 text-gray-500">{p.unit}</td>
                    <td className="px-4 py-3 font-medium text-green-700">{fmt(p.earned)}</td>
                  </tr>
                ))}
                {production.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No production logs</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Expenses ──────────────────────────────────────────────── */}
      {tab === 'expenses' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div className="text-sm font-semibold text-red-700">Total: {fmt(expenses.reduce((a, e) => a + e.amount, 0))}</div>
            <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm" onClick={() => { setForm({ expense_date: new Date().toISOString().split('T')[0] }); setShowForm(true); }}>
              <Plus className="h-4 w-4" /> Add expense
            </button>
          </div>
          <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr>
                {['Date', 'Category', 'Description', 'Amount', 'Ref', 'Del'].map((h) => <th key={h} className="px-4 py-3 text-left text-xs text-gray-500 font-medium">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y">
                {expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs">{e.expense_date}</td>
                    <td className="px-4 py-3"><span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{e.category}</span></td>
                    <td className="px-4 py-3 text-gray-600">{e.description || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-red-700">{fmt(e.amount)}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{e.reference || '—'}</td>
                    <td className="px-4 py-3">
                      <button onClick={async () => { await supabase.from('expenses').delete().eq('id', e.id); loadAll(); }}>
                        <Trash2 className="h-3.5 w-3.5 text-gray-300 hover:text-red-500" />
                      </button>
                    </td>
                  </tr>
                ))}
                {expenses.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No expenses</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Purchases ─────────────────────────────────────────────── */}
      {tab === 'purchases' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div className="text-sm font-semibold text-amber-700">Total: {fmt(purchases.reduce((a, p) => a + p.total_amount, 0))}</div>
            <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm" onClick={() => { setForm({ qty: '1', unit: 'pcs', order_date: new Date().toISOString().split('T')[0] }); setShowForm(true); }}>
              <Plus className="h-4 w-4" /> Add purchase
            </button>
          </div>
          <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr>
                {['Date', 'Supplier', 'Item', 'Qty', 'Unit price', 'Total'].map((h) => <th key={h} className="px-4 py-3 text-left text-xs text-gray-500 font-medium">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y">
                {purchases.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs">{p.order_date}</td>
                    <td className="px-4 py-3">{p.supplier || '—'}</td>
                    <td className="px-4 py-3 font-medium">—</td>
                    <td className="px-4 py-3">—</td>
                    <td className="px-4 py-3">—</td>
                    <td className="px-4 py-3 font-semibold text-amber-700">{fmt(p.total_amount)}</td>
                  </tr>
                ))}
                {purchases.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No purchases</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Add Form Modal ─────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-bold capitalize">Add {tab === 'pl' ? 'entry' : tab.replace(/s$/, '')}</h2>
              <button onClick={() => { setShowForm(false); setForm({}); }}><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-3">
              {tab === 'employees' && <>
                <Field label="Name *" value={f('name')} onChange={(v) => setF('name', v)} />
                <Field label="Phone" value={f('phone')} onChange={(v) => setF('phone', v)} />
                <Field label="Role" value={f('role')} onChange={(v) => setF('role', v)} placeholder="e.g. Tailor, Cutter" />
                <div><label className="text-xs text-gray-500 mb-1 block">Salary type</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm" value={f('salary_type')} onChange={(e) => setF('salary_type', e.target.value)}>
                    <option value="monthly">Monthly</option><option value="piece_rate">Piece rate</option>
                  </select>
                </div>
                <Field label="Monthly salary ৳" type="number" value={f('salary')} onChange={(v) => setF('salary', v)} />
              </>}

              {tab === 'salary' && <>
                <div><label className="text-xs text-gray-500 mb-1 block">Employee *</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm" value={f('employee_id')} onChange={(e) => setF('employee_id', e.target.value)}>
                    <option value="">Select…</option>
                    {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <Field label="Month (YYYY-MM)" value={f('month')} onChange={(v) => setF('month', v)} />
                <Field label="Amount ৳ *" type="number" value={f('amount')} onChange={(v) => setF('amount', v)} />
                <div><label className="text-xs text-gray-500 mb-1 block">Payment type</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm" value={f('type')} onChange={(e) => setF('type', e.target.value)}>
                    <option value="full">Full salary</option><option value="partial">Partial</option><option value="advance">Advance</option>
                  </select>
                </div>
                <Field label="Note" value={f('note')} onChange={(v) => setF('note', v)} />
              </>}

              {tab === 'production' && <>
                <div><label className="text-xs text-gray-500 mb-1 block">Employee *</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm" value={f('employee_id')} onChange={(e) => setF('employee_id', e.target.value)}>
                    <option value="">Select…</option>
                    {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <Field label="Date" type="date" value={f('log_date')} onChange={(v) => setF('log_date', v)} />
                <Field label="Product name" value={f('product_name')} onChange={(v) => setF('product_name', v)} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Qty *" type="number" value={f('qty')} onChange={(v) => setF('qty', v)} />
                  <Field label="Unit" value={f('unit')} onChange={(v) => setF('unit', v)} />
                </div>
                <Field label="Piece rate ৳" type="number" value={f('piece_rate')} onChange={(v) => setF('piece_rate', v)} />
              </>}

              {tab === 'expenses' && <>
                <div><label className="text-xs text-gray-500 mb-1 block">Category *</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm" value={f('category')} onChange={(e) => setF('category', e.target.value)}>
                    <option value="">Select…</option>
                    {EXPENSE_CATS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <Field label="Description" value={f('description')} onChange={(v) => setF('description', v)} />
                <Field label="Amount ৳ *" type="number" value={f('amount')} onChange={(v) => setF('amount', v)} />
                <Field label="Date" type="date" value={f('expense_date')} onChange={(v) => setF('expense_date', v)} />
                <Field label="Reference / Bill no." value={f('reference')} onChange={(v) => setF('reference', v)} />
              </>}

              {tab === 'purchases' && <>
                <Field label="Supplier" value={f('supplier')} onChange={(v) => setF('supplier', v)} />
                <Field label="Item name *" value={f('item_name')} onChange={(v) => setF('item_name', v)} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Qty" type="number" value={f('qty')} onChange={(v) => setF('qty', v)} />
                  <Field label="Unit" value={f('unit')} onChange={(v) => setF('unit', v)} />
                </div>
                <Field label="Unit price ৳ *" type="number" value={f('unit_price')} onChange={(v) => setF('unit_price', v)} />
                {f('qty') && f('unit_price') && (
                  <div className="bg-purple-50 rounded-lg px-3 py-2 text-sm font-semibold text-purple-700">
                    Total: {fmt((Number(f('qty')) || 0) * (Number(f('unit_price')) || 0))}
                  </div>
                )}
                <Field label="Date" type="date" value={f('order_date')} onChange={(v) => setF('order_date', v)} />
              </>}

              <div className="flex gap-3 pt-2">
                <button className="flex-1 bg-purple-600 text-white py-2.5 rounded-xl font-medium hover:bg-purple-700" onClick={saveForm}>Save</button>
                <button className="flex-1 border py-2.5 rounded-xl text-gray-600 hover:bg-gray-50" onClick={() => { setShowForm(false); setForm({}); }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <input type={type} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
