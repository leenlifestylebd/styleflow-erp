'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { usePOSStore } from '@/lib/stores/pos-store';
import type { Shift } from '@/types';
import { Clock, DollarSign, LogIn, LogOut, Plus, Minus } from 'lucide-react';
import { toast } from 'sonner';

export default function ShiftManager({ outletId, staffId }: { outletId: string; staffId: string }) {
  const supabase = createClient();
  const { current_shift, setShift } = usePOSStore();
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [cashInOut, setCashInOut] = useState('');
  const [cashNote, setCashNote]   = useState('');
  const [shiftSummary, setShiftSummary] = useState<{
    total_sales: number; cash_sales: number; bkash: number; nagad: number; transactions: number;
  } | null>(null);

  // Load active shift on mount
  useEffect(() => {
    supabase.from('shifts')
      .select('*')
      .eq('outlet_id', outletId)
      .eq('staff_id', staffId)
      .eq('status', 'open')
      .maybeSingle()
      .then(({ data }) => { if (data) setShift(data as Shift); });
  }, [outletId, staffId]);

  async function openShift() {
    const cash = parseFloat(openingCash) || 0;
    const { data, error } = await supabase.from('shifts').insert({
      outlet_id: outletId,
      staff_id: staffId,
      opening_cash: cash,
      status: 'open',
    }).select().single();
    if (error) { toast.error('Failed to open shift'); return; }
    setShift(data as Shift);
    toast.success(`Shift opened with ৳${cash.toLocaleString()} opening cash`);
  }

  async function closeShift() {
    if (!current_shift) return;
    const closing = parseFloat(closingCash) || 0;

    // Load shift summary
    const { data: sales } = await supabase
      .from('sales')
      .select('total, payments(*)')
      .eq('shift_id', current_shift.id)
      .eq('status', 'completed');

    const total_sales = (sales || []).reduce((s, sale) => s + sale.total, 0);
    const payments = (sales || []).flatMap((s) => s.payments || []);
    const cash_sales = payments.filter((p) => p.method === 'cash').reduce((s, p) => s + p.amount, 0);
    const bkash = payments.filter((p) => p.method === 'bkash').reduce((s, p) => s + p.amount, 0);
    const nagad = payments.filter((p) => p.method === 'nagad').reduce((s, p) => s + p.amount, 0);
    const expected = current_shift.opening_cash + cash_sales;
    const diff     = closing - expected;

    const { error } = await supabase.from('shifts').update({
      status: 'closed',
      closing_cash: closing,
      expected_cash: expected,
      cash_difference: diff,
      ended_at: new Date().toISOString(),
    }).eq('id', current_shift.id);

    if (error) { toast.error('Failed to close shift'); return; }

    setShiftSummary({ total_sales, cash_sales, bkash, nagad, transactions: sales?.length || 0 });
    setShift(null);
    toast.success('Shift closed successfully');
  }

  async function addCashMovement(type: 'in' | 'out') {
    if (!current_shift) return;
    const amount = parseFloat(cashInOut);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    await supabase.from('cash_transactions').insert({
      shift_id: current_shift.id,
      type, amount,
      reason: cashNote || `Cash ${type}`,
      staff_id: staffId,
    });
    toast.success(`Cash ${type} of ৳${amount.toLocaleString()} recorded`);
    setCashInOut(''); setCashNote('');
  }

  const fmt = (n: number) => `৳${n.toLocaleString()}`;

  // ── Closed shift summary ──────────────────────────────────────────────────
  if (shiftSummary) {
    return (
      <div className="max-w-md mx-auto p-6">
        <div className="bg-white border rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-bold mb-4 text-center">Shift Summary</h2>
          <div className="space-y-3">
            {[
              ['Total transactions', shiftSummary.transactions, ''],
              ['Total sales', shiftSummary.total_sales, 'text-green-700'],
              ['Cash sales', shiftSummary.cash_sales, ''],
              ['bKash', shiftSummary.bkash, 'text-pink-700'],
              ['Nagad', shiftSummary.nagad, 'text-orange-700'],
            ].map(([label, value, cls]) => (
              <div key={label as string} className="flex justify-between border-b pb-2">
                <span className="text-gray-600">{label}</span>
                <span className={`font-semibold ${cls}`}>{typeof value === 'number' && label !== 'Total transactions' ? fmt(value) : value}</span>
              </div>
            ))}
          </div>
          <button
            className="w-full mt-4 bg-purple-600 text-white py-3 rounded-xl font-medium"
            onClick={() => { setShiftSummary(null); setOpeningCash(''); setClosingCash(''); }}
          >
            Open new shift
          </button>
        </div>
      </div>
    );
  }

  // ── No active shift — open one ────────────────────────────────────────────
  if (!current_shift) {
    return (
      <div className="max-w-md mx-auto p-6">
        <div className="bg-white border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <LogIn className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Open Shift</h2>
              <p className="text-sm text-gray-500">Enter opening cash to begin</p>
            </div>
          </div>
          <div className="mb-4">
            <label className="text-sm text-gray-600 mb-1 block">Opening cash (৳)</label>
            <input
              type="number" min="0" className="w-full border rounded-xl px-4 py-3 text-lg font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
              placeholder="0" value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && openShift()}
            />
          </div>
          <button className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2" onClick={openShift}>
            <LogIn className="h-4 w-4" /> Open Shift
          </button>
        </div>
      </div>
    );
  }

  // ── Active shift ──────────────────────────────────────────────────────────
  const shiftAge = Math.round((Date.now() - new Date(current_shift.started_at).getTime()) / 60000);
  const hours = Math.floor(shiftAge / 60);
  const mins  = shiftAge % 60;

  return (
    <div className="max-w-lg mx-auto p-6 space-y-4">
      {/* Status card */}
      <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="font-semibold text-green-800">Shift Active</span>
          </div>
          <div className="flex items-center gap-1 text-sm text-green-700">
            <Clock className="h-4 w-4" />
            {hours > 0 ? `${hours}h ` : ''}{mins}m
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-white rounded-xl p-3 text-center">
            <div className="text-gray-500">Opening cash</div>
            <div className="font-bold text-lg">{fmt(current_shift.opening_cash)}</div>
          </div>
          <div className="bg-white rounded-xl p-3 text-center">
            <div className="text-gray-500">Started at</div>
            <div className="font-bold text-lg">{new Date(current_shift.started_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>
      </div>

      {/* Cash in/out */}
      <div className="bg-white border rounded-2xl p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><DollarSign className="h-4 w-4" /> Cash Movement</h3>
        <div className="flex gap-2 mb-2">
          <input
            type="number" min="0" className="flex-1 border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
            placeholder="Amount ৳" value={cashInOut}
            onChange={(e) => setCashInOut(e.target.value)}
          />
          <input
            className="flex-1 border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
            placeholder="Reason (optional)" value={cashNote}
            onChange={(e) => setCashNote(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <button
            className="flex-1 flex items-center justify-center gap-1 bg-green-100 text-green-700 hover:bg-green-200 py-2 rounded-xl text-sm font-medium"
            onClick={() => addCashMovement('in')}
          ><Plus className="h-4 w-4" /> Cash In</button>
          <button
            className="flex-1 flex items-center justify-center gap-1 bg-red-100 text-red-700 hover:bg-red-200 py-2 rounded-xl text-sm font-medium"
            onClick={() => addCashMovement('out')}
          ><Minus className="h-4 w-4" /> Cash Out</button>
        </div>
      </div>

      {/* Close shift */}
      <div className="bg-white border rounded-2xl p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><LogOut className="h-4 w-4" /> Close Shift</h3>
        <div className="mb-3">
          <label className="text-sm text-gray-500 mb-1 block">Closing cash count (৳)</label>
          <input
            type="number" min="0" className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
            placeholder="Count the cash drawer..." value={closingCash}
            onChange={(e) => setClosingCash(e.target.value)}
          />
        </div>
        <button
          className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
          onClick={closeShift}
          disabled={!closingCash}
        >
          <LogOut className="h-4 w-4" /> Close Shift & Print Summary
        </button>
      </div>
    </div>
  );
}
