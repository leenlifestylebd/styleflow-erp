'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Users, Plus, X, Clock, ShieldCheck } from 'lucide-react';
import ShiftManager from '@/components/staff/ShiftManager';

export default function StaffPage() {
  const supabase = createClient();
  const [staff, setStaff] = useState<any[]>([]);
  const [tab, setTab] = useState<'list' | 'shift'>('list');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'cashier', salary: '' });

  useEffect(() => { loadStaff(); }, []);

  async function loadStaff() {
    const { data } = await supabase.from('staff').select('*').order('name');
    setStaff(data || []);
  }

  async function addStaff() {
    if (!form.name) return;
    await supabase.from('staff').insert({
      tenant_id: '00000000-0000-0000-0000-000000000001',
      name: form.name, email: form.email, phone: form.phone,
      role: form.role, salary: Number(form.salary) || 0, status: 'active'
    });
    setShowAdd(false);
    setForm({ name: '', email: '', phone: '', role: 'cashier', salary: '' });
    loadStaff();
  }

  const ROLE_COLORS: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-700',
    manager: 'bg-blue-100 text-blue-700',
    cashier: 'bg-green-100 text-green-700',
    production: 'bg-orange-100 text-orange-700',
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Staff Management</h1>
        <div className="flex gap-3">
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700">
            <Plus className="h-4 w-4" /> Add staff
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6">
        {[['list', '👥 Staff list', Users], ['shift', '⏰ Shift manager', Clock]].map(([id, label]) => (
          <button key={id as string} onClick={() => setTab(id as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === id ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label as string}
          </button>
        ))}
      </div>

      {tab === 'list' && (
        <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Name', 'Email', 'Phone', 'Role', 'Salary', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-gray-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {staff.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{s.email || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{s.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${ROLE_COLORS[s.role] || 'bg-gray-100 text-gray-600'}`}>
                      {s.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">৳{Number(s.salary || 0).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
              {staff.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No staff members yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'shift' && (
        <ShiftManager
          outletId="00000000-0000-0000-0000-000000000001"
          staffId={staff[0]?.id || ''}
        />
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Add staff member</h2>
              <button onClick={() => setShowAdd(false)}><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              {[['name','Full name *','text'],['email','Email','email'],['phone','Phone','text'],['salary','Monthly salary ৳','number']].map(([k, l, t]) => (
                <div key={k}>
                  <label className="text-xs text-gray-500 mb-1 block">{l}</label>
                  <input type={t} className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    value={(form as any)[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Role</label>
                <select className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="cashier">Cashier</option>
                  <option value="production">Production</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button className="flex-1 bg-purple-600 text-white py-2.5 rounded-xl font-medium hover:bg-purple-700" onClick={addStaff}>Save</button>
              <button className="flex-1 border py-2.5 rounded-xl text-gray-600 hover:bg-gray-50" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
