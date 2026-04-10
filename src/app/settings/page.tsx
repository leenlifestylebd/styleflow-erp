'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Save, CheckCircle } from 'lucide-react';

export default function SettingsPage() {
  const supabase = createClient();
  const [settings, setSettings] = useState({ sf_api_key: '', sf_secret_key: '', sf_base_url: 'https://portal.packzy.com/api/v1', store_phone: '', label_size: '80mm' });
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [tenant, setTenant] = useState<any>(null);

  useEffect(() => {
    supabase.from('tenants').select('*').eq('id', '00000000-0000-0000-0000-000000000001').single()
      .then(({ data }) => { if (data) { setTenant(data); setSettings(s => ({ ...s, ...(data.settings || {}) })); } });
  }, []);

  async function saveSettings() {
    await supabase.from('tenants').update({ settings: { ...settings } }).eq('id', '00000000-0000-0000-0000-000000000001');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function testAPI() {
    setTesting(true); setTestResult(null);
    try {
      const params = new URLSearchParams({
        api_key: settings.sf_api_key,
        secret_key: settings.sf_secret_key,
      });
      const res = await fetch('/api/v1/courier/balance?' + params.toString());
      const data = await res.json();
      if (data.current_balance !== undefined) setTestResult({ ok: true, msg: `✅ Connected! Balance: ৳${data.current_balance}` });
      else setTestResult({ ok: false, msg: '❌ ' + (data.message || data.error || 'Connection failed') });
    } catch { setTestResult({ ok: false, msg: '❌ Connection failed' }); }
    setTesting(false);
  }

  const s = (k: string) => (settings as any)[k] ?? '';
  const setS = (k: string, v: string) => setSettings(p => ({ ...p, [k]: v }));

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {/* Steadfast API */}
      <div className="bg-white border rounded-2xl p-6 shadow-sm mb-4">
        <h2 className="font-semibold text-lg mb-1">Steadfast Courier API</h2>
        <p className="text-sm text-gray-500 mb-4">Get keys from <a href="https://portal.packzy.com" target="_blank" className="text-purple-600 hover:underline">portal.packzy.com</a> → Profile → API</p>
        <div className="space-y-3">
          {[['sf_api_key','API Key','password'],['sf_secret_key','Secret Key','password'],['sf_base_url','Base URL','text']].map(([k,l,t]) => (
            <div key={k}>
              <label className="text-xs text-gray-500 mb-1 block">{l}</label>
              <input type={t} className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                value={s(k)} onChange={e => setS(k, e.target.value)} autoComplete="new-password" />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button onClick={testAPI} disabled={testing} className="px-4 py-2 border rounded-xl text-sm hover:bg-gray-50 disabled:opacity-50">
            {testing ? 'Testing...' : 'Test connection'}
          </button>
          {testResult && <span className={`text-sm ${testResult.ok ? 'text-green-600' : 'text-red-600'}`}>{testResult.msg}</span>}
        </div>
      </div>

      {/* Store info */}
      <div className="bg-white border rounded-2xl p-6 shadow-sm mb-4">
        <h2 className="font-semibold text-lg mb-4">Store info</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Store phone</label>
            <input className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
              value={s('store_phone')} onChange={e => setS('store_phone', e.target.value)} placeholder="01XXXXXXXXX" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Label size</label>
            <select className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
              value={s('label_size')} onChange={e => setS('label_size', e.target.value)}>
              <option value="58mm">58mm thermal</option>
              <option value="72mm">72mm thermal</option>
              <option value="80mm">80mm thermal</option>
              <option value="a4">A4 sheet</option>
            </select>
          </div>
        </div>
      </div>

      {/* Account info */}
      <div className="bg-white border rounded-2xl p-6 shadow-sm mb-6">
        <h2 className="font-semibold text-lg mb-4">Account</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Store name</span><span className="font-medium">{tenant?.name}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Plan</span><span className="font-medium capitalize">{tenant?.plan}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Supabase project</span><span className="font-mono text-xs text-purple-600">bvjpashuqrcpqmicdkaf</span></div>
        </div>
      </div>

      <button onClick={saveSettings} className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors">
        {saved ? <><CheckCircle className="h-4 w-4" /> Saved!</> : <><Save className="h-4 w-4" /> Save settings</>}
      </button>
    </div>
  );
}
