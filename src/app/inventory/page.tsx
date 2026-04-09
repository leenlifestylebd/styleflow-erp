'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Package, Search, Plus, AlertTriangle, Tag } from 'lucide-react';
import Link from 'next/link';

export default function InventoryPage() {
  const supabase = createClient();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', sku: '', base_price: '', purchase_price: '', unit: 'pcs' });

  useEffect(() => { loadProducts(); }, []);

  async function loadProducts() {
    setLoading(true);
    const { data } = await supabase
      .from('products')
      .select(`*, variations:product_variations(id, sku, size, color, price, barcode,
        stock:inventory(qty, outlet:outlets(name)))`)
      .eq('status', 'active')
      .order('name');
    setProducts(data || []);
    setLoading(false);
  }

  async function addProduct() {
    if (!form.name) return;
    const sku = form.sku || form.name.toUpperCase().replace(/\s+/g, '-').slice(0, 8) + '-' + Date.now().toString().slice(-4);
    const { data: p } = await supabase.from('products').insert({
      tenant_id: '00000000-0000-0000-0000-000000000001',
      name: form.name, sku, base_price: Number(form.base_price) || 0,
      purchase_price: Number(form.purchase_price) || 0, unit: form.unit, status: 'active'
    }).select().single();
    if (p) {
      await supabase.from('product_variations').insert({
        product_id: p.id, sku: sku + '-M-WHT', size: 'M', color: 'White',
        price: Number(form.base_price) || 0, barcode: 'SF' + Date.now(), barcode_type: 'CODE128'
      });
    }
    setShowAdd(false); setForm({ name: '', sku: '', base_price: '', purchase_price: '', unit: 'pcs' });
    loadProducts();
  }

  const filtered = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const totalStock = (p: any) => (p.variations || []).reduce((a: number, v: any) =>
    a + (v.stock || []).reduce((s: number, st: any) => s + (st.qty || 0), 0), 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-gray-500 text-sm mt-1">{products.length} products</p>
        </div>
        <div className="flex gap-3">
          <Link href="/inventory/barcode" className="flex items-center gap-2 px-4 py-2 border rounded-xl text-sm hover:bg-gray-50">
            <Tag className="h-4 w-4" /> Barcodes
          </Link>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700">
            <Plus className="h-4 w-4" /> Add product
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <input className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="Search product or SKU..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Product cards */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => {
            const stock = totalStock(p);
            const isLow = stock < 10;
            return (
              <div key={p.id} className="bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{p.name}</h3>
                    <p className="text-xs text-gray-400 font-mono">{p.sku}</p>
                  </div>
                  {isLow && <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <div className="text-lg font-bold text-gray-900">{stock}</div>
                    <div className="text-xs text-gray-500">Total stock</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <div className="text-lg font-bold text-purple-600">৳{Number(p.base_price).toLocaleString()}</div>
                    <div className="text-xs text-gray-500">Sale price</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <div className="text-lg font-bold text-gray-600">{(p.variations || []).length}</div>
                    <div className="text-xs text-gray-500">Variants</div>
                  </div>
                </div>
                {/* Variants */}
                <div className="space-y-1">
                  {(p.variations || []).slice(0, 3).map((v: any) => {
                    const vStock = (v.stock || []).reduce((s: number, st: any) => s + (st.qty || 0), 0);
                    return (
                      <div key={v.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">{v.size}/{v.color}</span>
                        <span className={`font-medium ${vStock === 0 ? 'text-red-500' : vStock < 5 ? 'text-orange-500' : 'text-green-600'}`}>
                          {vStock} pcs
                        </span>
                      </div>
                    );
                  })}
                  {(p.variations || []).length > 3 && (
                    <p className="text-xs text-gray-400">+{p.variations.length - 3} more variants</p>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-3 text-center py-16 text-gray-400">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No products found</p>
            </div>
          )}
        </div>
      )}

      {/* Add product modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <h2 className="font-bold text-lg mb-4">Add new product</h2>
            <div className="space-y-3">
              {[
                ['name', 'Product name *', 'text'],
                ['sku', 'SKU (auto if blank)', 'text'],
                ['base_price', 'Sale price ৳', 'number'],
                ['purchase_price', 'Purchase price ৳', 'number'],
              ].map(([key, label, type]) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                  <input type={type} className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-4">
              <button className="flex-1 bg-purple-600 text-white py-2.5 rounded-xl font-medium hover:bg-purple-700" onClick={addProduct}>Save</button>
              <button className="flex-1 border py-2.5 rounded-xl text-gray-600 hover:bg-gray-50" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
