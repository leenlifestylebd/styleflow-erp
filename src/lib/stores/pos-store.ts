// src/lib/stores/pos-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, PaymentEntry, Shift } from '@/types';

interface Customer { id: string; name: string; phone?: string; email?: string; }

interface POSStore {
  // Cart
  items: CartItem[];
  customer: Customer | null;
  discount_type: 'fixed' | 'percent';
  discount_value: number;
  note: string;

  // Payments
  payments: PaymentEntry[];

  // Shift
  current_shift: Shift | null;
  outlet_id: string | null;
  staff_id: string | null;

  // Held carts
  held_carts: { id: string; label: string; items: CartItem[]; created_at: string }[];

  // Computed
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  total_paid: number;
  due: number;

  // Actions
  addItem: (item: CartItem) => void;
  removeItem: (variation_id: string) => void;
  updateQty: (variation_id: string, qty: number) => void;
  updateItemDiscount: (variation_id: string, discount: number) => void;
  setCustomer: (customer: Customer | null) => void;
  setDiscount: (type: 'fixed' | 'percent', value: number) => void;
  setNote: (note: string) => void;
  addPayment: (payment: PaymentEntry) => void;
  removePayment: (index: number) => void;
  clearPayments: () => void;
  clearCart: () => void;
  holdCart: (label: string) => void;
  resumeCart: (id: string) => void;
  deleteHeldCart: (id: string) => void;
  setShift: (shift: Shift | null) => void;
  setOutlet: (outlet_id: string) => void;
  setStaff: (staff_id: string) => void;
  _recalculate: () => void;
}

export const usePOSStore = create<POSStore>()(
  persist(
    (set, get) => ({
      items: [],
      customer: null,
      discount_type: 'fixed',
      discount_value: 0,
      note: '',
      payments: [],
      current_shift: null,
      outlet_id: null,
      staff_id: null,
      held_carts: [],
      subtotal: 0,
      discount_amount: 0,
      tax_amount: 0,
      total: 0,
      total_paid: 0,
      due: 0,

      _recalculate: () => {
        const s = get();
        const subtotal = s.items.reduce((sum, i) => sum + i.unit_price * i.qty - i.discount, 0);
        const discount_amount =
          s.discount_type === 'percent'
            ? (subtotal * s.discount_value) / 100
            : s.discount_value;
        const after_discount = subtotal - discount_amount;
        const tax_amount = 0; // add tax logic if needed
        const total = after_discount + tax_amount;
        const total_paid = s.payments.reduce((sum, p) => sum + p.amount, 0);
        const due = Math.max(0, total - total_paid);
        set({ subtotal, discount_amount, tax_amount, total, total_paid, due });
      },

      addItem: (item) => {
        set((s) => {
          const existing = s.items.find((i) => i.variation_id === item.variation_id);
          const items = existing
            ? s.items.map((i) =>
                i.variation_id === item.variation_id
                  ? { ...i, qty: i.qty + item.qty, total: (i.qty + item.qty) * i.unit_price - i.discount }
                  : i
              )
            : [...s.items, { ...item, total: item.qty * item.unit_price - item.discount }];
          return { items };
        });
        get()._recalculate();
      },

      removeItem: (variation_id) => {
        set((s) => ({ items: s.items.filter((i) => i.variation_id !== variation_id) }));
        get()._recalculate();
      },

      updateQty: (variation_id, qty) => {
        if (qty <= 0) { get().removeItem(variation_id); return; }
        set((s) => ({
          items: s.items.map((i) =>
            i.variation_id === variation_id
              ? { ...i, qty, total: qty * i.unit_price - i.discount }
              : i
          )
        }));
        get()._recalculate();
      },

      updateItemDiscount: (variation_id, discount) => {
        set((s) => ({
          items: s.items.map((i) =>
            i.variation_id === variation_id
              ? { ...i, discount, total: i.qty * i.unit_price - discount }
              : i
          )
        }));
        get()._recalculate();
      },

      setCustomer: (customer) => set({ customer }),
      setNote: (note) => set({ note }),

      setDiscount: (type, value) => {
        set({ discount_type: type, discount_value: value });
        get()._recalculate();
      },

      addPayment: (payment) => {
        set((s) => ({ payments: [...s.payments, payment] }));
        get()._recalculate();
      },

      removePayment: (index) => {
        set((s) => ({ payments: s.payments.filter((_, i) => i !== index) }));
        get()._recalculate();
      },

      clearPayments: () => { set({ payments: [] }); get()._recalculate(); },

      clearCart: () => {
        set({
          items: [], customer: null, discount_type: 'fixed',
          discount_value: 0, note: '', payments: [],
          subtotal: 0, discount_amount: 0, tax_amount: 0,
          total: 0, total_paid: 0, due: 0
        });
      },

      holdCart: (label) => {
        const s = get();
        if (!s.items.length) return;
        const held = {
          id: crypto.randomUUID(),
          label,
          items: s.items,
          created_at: new Date().toISOString()
        };
        set((st) => ({ held_carts: [...st.held_carts, held] }));
        get().clearCart();
      },

      resumeCart: (id) => {
        const s = get();
        const cart = s.held_carts.find((c) => c.id === id);
        if (!cart) return;
        set((st) => ({
          items: cart.items,
          held_carts: st.held_carts.filter((c) => c.id !== id)
        }));
        get()._recalculate();
      },

      deleteHeldCart: (id) =>
        set((s) => ({ held_carts: s.held_carts.filter((c) => c.id !== id) })),

      setShift: (shift) => set({ current_shift: shift }),
      setOutlet: (outlet_id) => set({ outlet_id }),
      setStaff: (staff_id) => set({ staff_id }),
    }),
    {
      name: 'styleflow-pos',
      partialize: (s) => ({
        held_carts: s.held_carts,
        current_shift: s.current_shift,
        outlet_id: s.outlet_id,
        staff_id: s.staff_id,
      })
    }
  )
);
