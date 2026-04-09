'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { usePOSStore } from '@/lib/stores/pos-store';
import { createClient } from '@/lib/supabase/client';
import type { ProductVariation, CartItem, PaymentEntry, PaymentMethod } from '@/types';
import { ShoppingCart, Search, Plus, Minus, Trash2, CreditCard, Banknote, Smartphone, X, Pause, Play, ChevronDown, User, ReceiptText } from 'lucide-react';
import { toast } from 'sonner';

// ── Payment methods ─────────────────────────────────────────────────────────
const PAYMENT_METHODS: { method: PaymentMethod; label: string; icon: string; color: string }[] = [
  { method: 'cash',  label: 'Cash',  icon: '💵', color: 'bg-green-50 border-green-300 text-green-800' },
  { method: 'bkash', label: 'bKash', icon: '📱', color: 'bg-pink-50 border-pink-300 text-pink-800' },
  { method: 'nagad', label: 'Nagad', icon: '📲', color: 'bg-orange-50 border-orange-300 text-orange-800' },
  { method: 'card',  label: 'Card',  icon: '💳', color: 'bg-blue-50 border-blue-300 text-blue-800' },
  { method: 'due',   label: 'Due',   icon: '📋', color: 'bg-yellow-50 border-yellow-300 text-yellow-800' },
];

// ── Barcode scanner hook ─────────────────────────────────────────────────────
function useBarcodeScanner(onScan: (code: string) => void) {
  const buffer = useRef('');
  const timer  = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && buffer.current.length > 3) {
        onScan(buffer.current);
        buffer.current = '';
        return;
      }
      if (e.key.length === 1) {
        buffer.current += e.key;
        clearTimeout(timer.current);
        timer.current = setTimeout(() => { buffer.current = ''; }, 150);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onScan]);
}

export default function POSPage() {
  const supabase = createClient();
  const store    = usePOSStore();

  const [products, setProducts] = useState<ProductVariation[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [searchQ, setSearchQ] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [showHeld, setShowHeld] = useState(false);
  const [holdLabel, setHoldLabel] = useState('');
  const [loading, setLoading] = useState(false);

  // Load products
  useEffect(() => {
    const loadProducts = async () => {
      const { data } = await supabase
        .from('product_variations')
        .select(`*, product:products(id, name, category_id, category:categories(id,name))`)
        .eq('products.status', 'active')
        .order('sku');
      setProducts(data || []);

      const { data: cats } = await supabase.from('categories').select('id, name');
      setCategories(cats || []);
    };
    loadProducts();
  }, []);

  // Filter products
  const filtered = products.filter((v) => {
    const q = searchQ.toLowerCase();
    const matchSearch = !q || v.sku.toLowerCase().includes(q) ||
      (v.product as { name: string })?.name?.toLowerCase().includes(q) ||
      v.barcode?.includes(q);
    const matchCat = !catFilter ||
      (v.product as { category_id: string })?.category_id === catFilter;
    return matchSearch && matchCat;
  });

  // Barcode scanner
  const handleScan = useCallback((code: string) => {
    const v = products.find((p) => p.barcode === code || p.sku === code);
    if (v) {
      addToCart(v);
      toast.success(`Scanned: ${(v.product as { name: string })?.name}`);
    } else {
      toast.error(`Product not found: ${code}`);
    }
  }, [products]);
  useBarcodeScanner(handleScan);

  function addToCart(v: ProductVariation) {
    const item: CartItem = {
      variation_id: v.id,
      product_id: (v.product as { id: string })?.id,
      product_name: (v.product as { name: string })?.name || v.sku,
      sku: v.sku,
      size: v.size,
      color: v.color,
      unit_price: v.price,
      qty: 1,
      discount: 0,
      total: v.price,
    };
    store.addItem(item);
  }

  // Complete sale
  async function completeSale() {
    if (!store.items.length) { toast.error('Cart is empty'); return; }
    if (store.total_paid < store.total && store.due > 0) {
      // Check if there's a "due" payment entry — allowed for partial
      const hasDue = store.payments.some((p) => p.method === 'due');
      if (!hasDue && store.total_paid < store.total) {
        toast.error('Payment amount does not match total');
        return;
      }
    }
    setLoading(true);
    try {
      const { data: saleData, error } = await supabase.rpc('create_sale', {
        p_tenant_id:    store.outlet_id, // simplified
        p_outlet_id:    store.outlet_id,
        p_shift_id:     store.current_shift?.id,
        p_customer_id:  store.customer?.id,
        p_staff_id:     store.staff_id,
        p_items:        JSON.stringify(store.items),
        p_payments:     JSON.stringify(store.payments),
        p_discount_type: store.discount_type,
        p_discount_value: store.discount_value,
        p_note:         store.note,
      });
      if (error) throw error;
      toast.success(`Sale ${saleData?.sale_number} completed!`);
      printReceipt(saleData);
      store.clearCart();
      setShowPayment(false);
    } catch (err: unknown) {
      toast.error('Sale failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }

  function printReceipt(sale: unknown) {
    // Opens print window with thermal receipt layout
    const w = window.open('', '_blank', 'width=320,height=600');
    if (!w) return;
    const s = store;
    w.document.write(`<!DOCTYPE html><html><head>
      <style>
        body{font-family:monospace;font-size:12px;width:280px;margin:0 auto;padding:8px}
        .center{text-align:center} .bold{font-weight:bold} .sep{border-top:1px dashed #000;margin:6px 0}
        .row{display:flex;justify-content:space-between} .big{font-size:16px}
        @media print{body{width:280px}}
      </style></head><body>
      <div class="center bold big">StyleFlow</div>
      <div class="center">${new Date().toLocaleString('bn-BD')}</div>
      <div class="sep"></div>
      ${s.items.map((i) => `<div class="row"><span>${i.product_name}${i.size ? ` (${i.size}/${i.color})` : ''}<br>x${i.qty} @ ৳${i.unit_price}</span><span>৳${i.total}</span></div>`).join('')}
      <div class="sep"></div>
      <div class="row"><span>Subtotal</span><span>৳${s.subtotal}</span></div>
      ${s.discount_amount > 0 ? `<div class="row"><span>Discount</span><span>-৳${s.discount_amount}</span></div>` : ''}
      <div class="row bold big"><span>TOTAL</span><span>৳${s.total}</span></div>
      <div class="sep"></div>
      ${s.payments.map((p) => `<div class="row"><span>${p.method.toUpperCase()}</span><span>৳${p.amount}</span></div>`).join('')}
      ${s.due > 0 ? `<div class="row bold"><span>DUE</span><span>৳${s.due}</span></div>` : ''}
      <div class="sep"></div>
      <div class="center">ধন্যবাদ!</div>
      </body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); w.close(); }, 400);
  }

  const fmt = (n: number) => `৳${n.toLocaleString('en', { minimumFractionDigits: 0 })}`;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* ── Left: Product Grid ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Search + filters */}
        <div className="bg-white border-b px-4 py-3 flex gap-3 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Search product / SKU / barcode (or use USB scanner)..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              autoFocus
            />
          </div>
          <select
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button
            className="flex items-center gap-1 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50"
            onClick={() => setShowHeld(!showHeld)}
          >
            <Pause className="h-4 w-4" />
            Held ({store.held_carts.length})
          </button>
        </div>

        {/* Product cards */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 content-start">
          {filtered.map((v) => {
            const product = v.product as { name: string };
            return (
              <button
                key={v.id}
                onClick={() => addToCart(v)}
                className="bg-white border rounded-xl p-3 text-left hover:border-purple-400 hover:shadow-sm active:scale-95 transition-all"
              >
                <div className="text-xs text-gray-400 mb-1">{v.sku}</div>
                <div className="font-medium text-sm leading-snug mb-1">{product?.name}</div>
                {(v.size || v.color) && (
                  <div className="text-xs text-gray-500 mb-2">{[v.size, v.color].filter(Boolean).join(' / ')}</div>
                )}
                <div className="font-bold text-purple-700">{fmt(v.price)}</div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-16 text-gray-400">
              {searchQ ? `No products found for "${searchQ}"` : 'No products available'}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Cart ───────────────────────────────────────────────── */}
      <div className="w-96 bg-white border-l flex flex-col shadow-lg">
        {/* Cart header */}
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <ShoppingCart className="h-4 w-4" />
            Cart ({store.items.length})
          </div>
          <button
            className="text-xs text-gray-500 hover:text-red-500"
            onClick={() => store.clearCart()}
          >
            Clear all
          </button>
        </div>

        {/* Customer */}
        <div className="px-4 py-2 border-b">
          <button className="flex items-center gap-2 text-sm text-gray-600 hover:text-purple-600 w-full">
            <User className="h-4 w-4" />
            {store.customer ? store.customer.name : 'Add customer (optional)'}
          </button>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto">
          {store.items.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">Scan or click product to add</div>
          ) : (
            store.items.map((item) => (
              <div key={item.variation_id} className="px-4 py-3 border-b hover:bg-gray-50">
                <div className="flex justify-between items-start mb-1">
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="font-medium text-sm truncate">{item.product_name}</div>
                    {(item.size || item.color) && (
                      <div className="text-xs text-gray-400">{[item.size, item.color].filter(Boolean).join(' / ')}</div>
                    )}
                  </div>
                  <button onClick={() => store.removeItem(item.variation_id)}>
                    <Trash2 className="h-3.5 w-3.5 text-gray-300 hover:text-red-500" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button
                      className="w-6 h-6 flex items-center justify-center border rounded hover:bg-gray-100"
                      onClick={() => store.updateQty(item.variation_id, item.qty - 1)}
                    ><Minus className="h-3 w-3" /></button>
                    <span className="w-8 text-center text-sm font-medium">{item.qty}</span>
                    <button
                      className="w-6 h-6 flex items-center justify-center border rounded hover:bg-gray-100"
                      onClick={() => store.updateQty(item.variation_id, item.qty + 1)}
                    ><Plus className="h-3 w-3" /></button>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400">{fmt(item.unit_price)} ea</div>
                    <div className="font-semibold text-sm">{fmt(item.total)}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Discount */}
        <div className="px-4 py-2 border-t flex items-center gap-2">
          <span className="text-sm text-gray-600 whitespace-nowrap">Discount</span>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={store.discount_type}
            onChange={(e) => store.setDiscount(e.target.value as 'fixed' | 'percent', store.discount_value)}
          >
            <option value="fixed">৳ Fixed</option>
            <option value="percent">% Percent</option>
          </select>
          <input
            type="number"
            min="0"
            className="border rounded px-2 py-1 text-sm w-24"
            value={store.discount_value || ''}
            onChange={(e) => store.setDiscount(store.discount_type, parseFloat(e.target.value) || 0)}
            placeholder="0"
          />
        </div>

        {/* Totals */}
        <div className="px-4 py-3 border-t bg-gray-50 space-y-1 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span><span>{fmt(store.subtotal)}</span>
          </div>
          {store.discount_amount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount</span><span>-{fmt(store.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base border-t pt-1">
            <span>Total</span><span className="text-purple-700">{fmt(store.total)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 py-3 border-t space-y-2">
          <button
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
            onClick={() => setShowPayment(true)}
            disabled={!store.items.length}
          >
            <CreditCard className="h-4 w-4" />
            Pay {fmt(store.total)}
          </button>
          <button
            className="w-full border border-gray-300 text-gray-600 py-2 rounded-xl text-sm hover:bg-gray-50 flex items-center justify-center gap-2"
            onClick={() => {
              const label = `Cart ${store.held_carts.length + 1}`;
              store.holdCart(label);
              toast.success('Cart held');
            }}
            disabled={!store.items.length}
          >
            <Pause className="h-3.5 w-3.5" /> Hold cart
          </button>
        </div>
      </div>

      {/* ── Payment Modal ─────────────────────────────────────────────── */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-bold text-lg">Payment — {fmt(store.total)}</h2>
              <button onClick={() => setShowPayment(false)}><X className="h-5 w-5" /></button>
            </div>

            <div className="p-6 space-y-4">
              {/* Payment method buttons */}
              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">Add payment</p>
                <div className="grid grid-cols-5 gap-2">
                  {PAYMENT_METHODS.map(({ method, label, icon, color }) => (
                    <PaymentButton
                      key={method}
                      method={method}
                      label={label}
                      icon={icon}
                      color={color}
                      remaining={Math.max(0, store.total - store.total_paid)}
                      onAdd={(amount, ref) => store.addPayment({ method, amount, reference: ref })}
                    />
                  ))}
                </div>
              </div>

              {/* Payment entries */}
              {store.payments.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-2">Payments</p>
                  <div className="space-y-2">
                    {store.payments.map((p, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-sm font-medium capitalize">{p.method}</span>
                        {p.reference && <span className="text-xs text-gray-400">{p.reference}</span>}
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{fmt(p.amount)}</span>
                          <button onClick={() => store.removePayment(i)}>
                            <X className="h-3.5 w-3.5 text-gray-400 hover:text-red-500" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-1 text-sm">
                <div className="flex justify-between"><span>Total</span><span className="font-bold">{fmt(store.total)}</span></div>
                <div className="flex justify-between text-green-600"><span>Paid</span><span className="font-bold">{fmt(store.total_paid)}</span></div>
                {store.due > 0 ? (
                  <div className="flex justify-between text-red-600 font-bold text-base border-t pt-1">
                    <span>Due</span><span>{fmt(store.due)}</span>
                  </div>
                ) : store.total_paid > store.total ? (
                  <div className="flex justify-between text-blue-600 font-bold border-t pt-1">
                    <span>Change</span><span>{fmt(store.total_paid - store.total)}</span>
                  </div>
                ) : null}
              </div>

              <button
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                onClick={completeSale}
                disabled={loading || !store.items.length || (store.total_paid < store.total && !store.payments.some((p) => p.method === 'due'))}
              >
                <ReceiptText className="h-4 w-4" />
                {loading ? 'Processing...' : 'Complete Sale & Print Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Held Carts Modal ─────────────────────────────────────────── */}
      {showHeld && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-bold text-lg">Held Carts</h2>
              <button onClick={() => setShowHeld(false)}><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
              {store.held_carts.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No held carts</p>
              ) : store.held_carts.map((c) => (
                <div key={c.id} className="flex items-center justify-between border rounded-xl px-4 py-3">
                  <div>
                    <div className="font-medium text-sm">{c.label}</div>
                    <div className="text-xs text-gray-400">{c.items.length} items · {new Date(c.created_at).toLocaleTimeString()}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="text-purple-600 hover:text-purple-800"
                      onClick={() => { store.resumeCart(c.id); setShowHeld(false); }}
                    ><Play className="h-4 w-4" /></button>
                    <button
                      className="text-red-400 hover:text-red-600"
                      onClick={() => store.deleteHeldCart(c.id)}
                    ><X className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Payment Button Component ─────────────────────────────────────────────────
function PaymentButton({
  method, label, icon, color, remaining, onAdd
}: {
  method: PaymentMethod; label: string; icon: string; color: string;
  remaining: number; onAdd: (amount: number, ref?: string) => void;
}) {
  const [show, setShow] = useState(false);
  const [amount, setAmount] = useState('');
  const [ref, setRef] = useState('');
  const fmt = (n: number) => `৳${n.toLocaleString('en')}`;

  function add() {
    const a = parseFloat(amount) || remaining;
    if (a <= 0) return;
    onAdd(a, ref || undefined);
    setAmount(''); setRef(''); setShow(false);
  }

  if (!show) {
    return (
      <button
        className={`flex flex-col items-center gap-1 border rounded-xl py-3 text-xs font-medium transition-all hover:shadow-sm ${color}`}
        onClick={() => { setAmount(String(remaining)); setShow(true); }}
      >
        <span className="text-lg">{icon}</span>
        {label}
      </button>
    );
  }

  return (
    <div className={`col-span-5 border rounded-xl p-3 ${color}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="font-medium text-sm">{icon} {label}</span>
        <button className="ml-auto text-xs" onClick={() => setShow(false)}>Cancel</button>
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 border rounded-lg px-3 py-1.5 text-sm bg-white"
          type="number" placeholder={`Amount (${fmt(remaining)})`}
          value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        {(method === 'bkash' || method === 'nagad') && (
          <input
            className="flex-1 border rounded-lg px-3 py-1.5 text-sm bg-white"
            placeholder="Transaction ID" value={ref}
            onChange={(e) => setRef(e.target.value)}
          />
        )}
        <button className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium" onClick={add}>
          Add
        </button>
      </div>
    </div>
  );
}
