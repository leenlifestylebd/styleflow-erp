'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ShoppingBag, Plus, X } from 'lucide-react';

export default function PurchasesPage() {
  const supabase = createClient();
  const [orders, setOrders] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showSupplier, setShowSupplier] = useState(false);
  const [form, setForm] = useState({ supplier_id: '', item_name: '', qty: '1', unit: 'pcs', unit_price: '', order_date: new Date().toISOString().split('T')[0], note: '' });
  const [supForm, setSupForm] = useState({ name: '', phone: '', address: '' });

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: pos } = await supabase.from('purchase_orders').select('*, supplier:suppliers(name)').order('created_at', { ascending: false });
    const { data: sups } = await supabase.from('suppliers').select('*').order('name');
    setOrders(pos || []);
    setSuppliers(sups || []);
  }

  async function addPO() {
    const qty = Number(form.qty) || 1;
    const price = Number(form.unit_price) || 0;
    const total = qty * price;
    const { data: po } = await supabase.from('purchase_orders').insert({
      tenant_id: '00000000-0000-0000-0000-000000000001',
      po_number: 'PO-' + Date.now(),
      supplier_id: form.supplier_id || null,
      total_amount: total, paid_amount: 0, due_amount: total,
      order_date: form.order_date, note: form.note, status: 'ordered'
    }).select().single();
    if (po) {
      await supabase.from('purchase_items').insert({
        po_id: po.id, product_name: form.item_name, qty, unit_price: price, total, received_qty: 0
      });
    }
    setShowAdd(false);
    setForm({ supplier_id: '', item_name: '', qty: '1', unit: 'pcs', unit_price: '', order_date: new Date().toISOString().split('T')[0], note: '' });
    load();
  }

  async function addSupplier() {
    await supabase.from('suppliers').insert({
      tenant_id: '00000000-0000-0000-0000-000000000001',
      name: supForm.name, phone: supForm.phone, address: supForm.address
    });
    setShowSupplier(false);
    setSupForm({ name: '', phone: '', address: '' });
    load();
  }

  const totalPurchase = orders.reduce((a, o) => a + Number(o.total_amount || 0), 0);
  const totalDue = orders.reduce((a, o) => a + Number(o.due_amount || 0), 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Purchases</h1>
        <div className="flex gap-3">
          <button onClick={() => setShowSupplier(true)} className="px-4 py-2 border rounded-xl text-sm hover:bg-gray-50">+ Supplier</button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700">
            <Plus className="h-4 w-4" /> New purchase
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border rounded-2xl p-4 shadow-sm text-center">
          <div className="text-2xl font-bold text-amber-600">৳{totalPurchase.toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-1">Total purchases</div>
        </div>
        <div className="bg-white border rounded-2xl p-4 shadow-sm text-center">
          <div className="text-2xl font-bold text-red-600">৳{totalDue.toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-1">Total due</div>
        </div>
        <div className="bg-white border rounded-2xl p-4 shadow-sm text-center">
          <div className="text-2xl font-bold text-gray-700">{suppliers.length}</div>
          <div className="text-xs text-gray-500 mt-1">Suppliers</div>
        </div>
      </div>

      <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['PO Number','Supplier','Total','Paid','Due','Date','Status'].map(h =>
              <th key={h} className="px-4 py-3 text-left text-xs text-gray-500 font-medium">{h}</th>
            )}</tr>
          </thead>
          <tbody className="divide-y">
            {orders.map(o => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">{o.po_number}</td>
                <td className="px-4 py-3">{(o.supplier as any)?.name || '—'}</td>
                <td className="px-4 py-3 font-medium">৳{Number(o.total_amount).toLocaleString()}</td>
                <td className="px-4 py-3 text-green-600">৳{Number(o.paid_amount).toLocaleString()}</td>
                <td className="px-4 py-3 text-red-600 font-medium">৳{Number(o.due_amount).toLocaleString()}</td>
                <td className="px-4 py-3 text-xs text-gray-400">{o.order_date}</td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">{o.status}</span>
                </td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">
              <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-30" />No purchases yet
            </td></tr>}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">New purchase</h2>
              <button onClick={() => setShowAdd(false)}><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Supplier</label>
                <select className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  value={form.supplier_id} onChange={e => setForm(p => ({...p, supplier_id: e.target.value}))}>
                  <option value="">No supplier</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              {[['item_name','Item name *','text'],['qty','Qty','number'],['unit','Unit','text'],['unit_price','Unit price ৳ *','number'],['order_date','Date','date'],['note','Note','text']].map(([k,l,t]) => (
                <div key={k}>
                  <label className="text-xs text-gray-500 mb-1 block">{l}</label>
                  <input type={t} className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    value={(form as any)[k]} onChange={e => setForm(p => ({...p, [k]: e.target.value}))} />
                </div>
              ))}
              {form.qty && form.unit_price && (
                <div className="bg-purple-50 rounded-xl p-3 text-sm font-semibold text-purple-700">
                  Total: ৳{(Number(form.qty) * Number(form.unit_price)).toLocaleString()}
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-4">
              <button className="flex-1 bg-purple-600 text-white py-2.5 rounded-xl font-medium" onClick={addPO}>Save</button>
              <button className="flex-1 border py-2.5 rounded-xl text-gray-600" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showSupplier && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Add supplier</h2>
              <button onClick={() => setShowSupplier(false)}><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              {[['name','Name *'],['phone','Phone'],['address','Address']].map(([k,l]) => (
                <div key={k}>
                  <label className="text-xs text-gray-500 mb-1 block">{l}</label>
                  <input className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    value={(supForm as any)[k]} onChange={e => setSupForm(p => ({...p, [k]: e.target.value}))} />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-4">
              <button className="flex-1 bg-purple-600 text-white py-2.5 rounded-xl font-medium" onClick={addSupplier}>Save</button>
              <button className="flex-1 border py-2.5 rounded-xl" onClick={() => setShowSupplier(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
