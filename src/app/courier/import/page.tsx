'use client';
import { useState, useRef, useCallback } from 'react';
import { parseXLSX, generateTemplate, type ParseResult } from '@/lib/utils/xlsx-parser';
import type { ImportRow, CourierName } from '@/types';
import { Upload, Download, CheckCircle, XCircle, AlertCircle, Send, Edit2, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const COURIERS: { id: CourierName; label: string }[] = [
  { id: 'steadfast', label: 'Steadfast' },
  { id: 'pathao',    label: 'Pathao' },
  { id: 'redx',      label: 'RedX' },
];

export default function ImportPage() {
  const fileRef  = useRef<HTMLInputElement>(null);
  const [result,  setResult]  = useState<ParseResult | null>(null);
  const [rows,    setRows]    = useState<ImportRow[]>([]);
  const [courier, setCourier] = useState<CourierName>('steadfast');
  const [editRow, setEditRow] = useState<ImportRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState<Record<number, 'ok' | 'fail'>>({});

  // ── File drop / pick ───────────────────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.xlsx')) {
      toast.error('Only .xlsx files are supported');
      return;
    }
    const buf = await file.arrayBuffer();
    const res = parseXLSX(buf);
    setResult(res);
    setRows(res.rows);
    setSubmitted({});

    if (res.errors.length > 0 && res.valid === 0) {
      toast.error('File has critical errors. Fix and re-upload.');
    } else if (res.errors.length > 0) {
      toast.warning(`${res.valid} valid rows, ${res.errors.length} rows with errors`);
    } else {
      toast.success(`${res.valid} rows ready to submit`);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // ── Download template ──────────────────────────────────────────────────────
  function downloadTemplate() {
    const buf  = generateTemplate();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: 'steadfast-import-template.xlsx' });
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Submit to courier ──────────────────────────────────────────────────────
  async function submitRows(onlyValid = true) {
    const toSubmit = onlyValid ? rows.filter((r) => r._status === 'valid') : rows.filter((r) => r._status !== 'submitted');
    if (!toSubmit.length) { toast.error('No valid rows to submit'); return; }

    if (!confirm(`Submit ${toSubmit.length} orders to ${courier.toUpperCase()}?`)) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/v1/courier/bulk-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: toSubmit, courier })
      });
      const data = await res.json();

      // Map results back to rows
      const newSubmitted: Record<number, 'ok' | 'fail'> = { ...submitted };
      const updatedRows = [...rows];

      (data.results || []).forEach((r: { _row: number; status: string }) => {
        const idx = updatedRows.findIndex((row) => row._row === r._row);
        if (idx !== -1) {
          updatedRows[idx]._status = r.status === 'success' ? 'submitted' : 'failed';
          newSubmitted[r._row] = r.status === 'success' ? 'ok' : 'fail';
        }
      });

      setRows(updatedRows);
      setSubmitted(newSubmitted);

      const ok   = Object.values(newSubmitted).filter((v) => v === 'ok').length;
      const fail = Object.values(newSubmitted).filter((v) => v === 'fail').length;
      toast.success(`✅ Submitted: ${ok} | ❌ Failed: ${fail}`);
    } catch (err) {
      toast.error('Submit failed: ' + String(err));
    } finally {
      setSubmitting(false);
    }
  }

  // ── Edit row ───────────────────────────────────────────────────────────────
  function saveEdit(updated: ImportRow) {
    setRows((prev) => prev.map((r) => r._row === updated._row ? { ...updated, _status: 'valid', _errors: undefined, _edited: true } : r));
    setEditRow(null);
  }

  const validCount    = rows.filter((r) => r._status === 'valid').length;
  const errorCount    = rows.filter((r) => r._status === 'error').length;
  const submittedCount = rows.filter((r) => r._status === 'submitted').length;
  const failedCount   = rows.filter((r) => r._status === 'failed').length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Bulk Order Import</h1>
          <p className="text-gray-500 text-sm mt-1">Import .xlsx file → Preview & Edit → Submit to courier</p>
        </div>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
        >
          <Download className="h-4 w-4" />
          Download template
        </button>
      </div>

      {/* Requirements panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm">
        <p className="font-semibold text-blue-800 mb-2">File requirements:</p>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-blue-700">
          <span>✅ Format: <strong>.xlsx only</strong></span>
          <span>✅ Sheet: <strong>Sheet1 only</strong> (other sheets ignored)</span>
          <span>✅ Required: <strong>Invoice, Name, Address, Phone, Amount, Note</strong></span>
          <span>✅ Amount: numeric, <strong>includes delivery charge</strong></span>
          <span>✅ Phone: <strong>11 digits</strong> (BD). Country code auto-stripped</span>
          <span>✅ Optional: <strong>Lot (1-1000), Delivery Type (Home/Point)</strong></span>
          <span>✅ Optional: <strong>Contact Name, Contact Phone</strong></span>
          <span>✅ Max <strong>500 orders</strong> per batch</span>
        </div>
      </div>

      {/* Upload area */}
      {!result && (
        <div
          className="border-2 border-dashed border-gray-300 rounded-2xl p-16 text-center hover:border-purple-400 hover:bg-purple-50 transition-colors cursor-pointer"
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-700">Drop your .xlsx file here</p>
          <p className="text-gray-400 text-sm mt-1">or click to browse</p>
          <input ref={fileRef} type="file" accept=".xlsx" className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Summary bar */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            {[
              { label: 'Total rows',  value: result.total,  color: 'bg-gray-50 text-gray-700' },
              { label: 'Valid',       value: validCount,    color: 'bg-green-50 text-green-700' },
              { label: 'Errors',      value: errorCount,    color: 'bg-red-50 text-red-700' },
              { label: 'Submitted',   value: submittedCount + failedCount, color: 'bg-blue-50 text-blue-700' },
            ].map((s) => (
              <div key={s.label} className={`${s.color} rounded-xl p-4 text-center`}>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-sm">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <select
              className="border rounded-lg px-3 py-2 text-sm"
              value={courier}
              onChange={(e) => setCourier(e.target.value as CourierName)}
            >
              {COURIERS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <button
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
              onClick={() => submitRows(true)}
              disabled={submitting || validCount === 0}
            >
              {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submit {validCount} valid rows to {courier}
            </button>
            {failedCount > 0 && (
              <button
                className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50"
                onClick={() => submitRows(false)}
                disabled={submitting}
              >
                Retry {failedCount} failed
              </button>
            )}
            <button
              className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 ml-auto"
              onClick={() => { setResult(null); setRows([]); setSubmitted({}); if (fileRef.current) fileRef.current.value = ''; }}
            >
              <Upload className="h-4 w-4" /> Upload new file
            </button>
          </div>

          {/* Table */}
          <div className="border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">Row</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">Invoice</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">Name</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">Phone</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">Address</th>
                    <th className="px-3 py-2 text-right text-xs text-gray-500 font-medium">Amount</th>
                    <th className="px-3 py-2 text-center text-xs text-gray-500 font-medium">Lot</th>
                    <th className="px-3 py-2 text-center text-xs text-gray-500 font-medium">Delivery</th>
                    <th className="px-3 py-2 text-center text-xs text-gray-500 font-medium">Status</th>
                    <th className="px-3 py-2 text-center text-xs text-gray-500 font-medium">Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row) => {
                    const isError = row._status === 'error';
                    const isDone  = row._status === 'submitted';
                    const isFail  = row._status === 'failed';
                    return (
                      <tr
                        key={row._row}
                        className={`${isError ? 'bg-red-50' : isDone ? 'bg-green-50' : isFail ? 'bg-orange-50' : 'hover:bg-gray-50'}`}
                      >
                        <td className="px-3 py-2 text-gray-400">{row._row}</td>
                        <td className="px-3 py-2 font-mono text-xs">{row.invoice}</td>
                        <td className="px-3 py-2 max-w-[140px] truncate">{row.recipient_name}</td>
                        <td className="px-3 py-2 font-mono text-xs">{row.recipient_phone}</td>
                        <td className="px-3 py-2 max-w-[180px] truncate text-gray-600">{row.recipient_address}</td>
                        <td className="px-3 py-2 text-right font-medium">৳{row.cod_amount.toLocaleString()}</td>
                        <td className="px-3 py-2 text-center text-gray-400">{row.total_lot || '—'}</td>
                        <td className="px-3 py-2 text-center text-xs">
                          {row.delivery_type === 0 ? 'Home' : row.delivery_type === 1 ? 'Point' : '—'}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {isDone ? (
                            <span className="flex items-center justify-center gap-1 text-green-600 text-xs">
                              <CheckCircle className="h-3.5 w-3.5" /> Submitted
                            </span>
                          ) : isFail ? (
                            <span className="flex items-center justify-center gap-1 text-red-600 text-xs">
                              <XCircle className="h-3.5 w-3.5" /> Failed
                            </span>
                          ) : isError ? (
                            <span className="flex items-center gap-1 text-red-600 text-xs" title={row._errors?.join('\n')}>
                              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="truncate max-w-[100px]">{row._errors?.[0]}</span>
                            </span>
                          ) : row._edited ? (
                            <span className="text-blue-600 text-xs">Edited ✓</span>
                          ) : (
                            <span className="text-green-600 text-xs">Valid</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {!isDone && (
                            <button
                              className="text-gray-400 hover:text-purple-600"
                              onClick={() => setEditRow({ ...row })}
                            ><Edit2 className="h-3.5 w-3.5" /></button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Edit Row Modal ───────────────────────────────────────────── */}
      {editRow && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-bold">Edit Row {editRow._row}</h2>
              <button onClick={() => setEditRow(null)}><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-3">
              {([
                ['invoice', 'Invoice *'],
                ['recipient_name', 'Name *'],
                ['recipient_phone', 'Phone * (11 digits)'],
                ['recipient_address', 'Address *'],
                ['cod_amount', 'Amount ৳ * (includes delivery charge)'],
                ['note', 'Note'],
                ['contact_name', 'Contact Name'],
                ['contact_phone', 'Contact Phone'],
              ] as [keyof ImportRow, string][]).map(([field, label]) => (
                <div key={field}>
                  <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    value={String(editRow[field] ?? '')}
                    onChange={(e) => setEditRow((prev) => prev ? { ...prev, [field]: field === 'cod_amount' ? parseFloat(e.target.value) || 0 : e.target.value } : prev)}
                  />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Lot Number (1–1000)</label>
                  <input type="number" min="1" max="1000" className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={editRow.total_lot ?? ''}
                    onChange={(e) => setEditRow((p) => p ? { ...p, total_lot: parseInt(e.target.value) || undefined } : p)} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Delivery Type</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={editRow.delivery_type ?? ''}
                    onChange={(e) => setEditRow((p) => p ? { ...p, delivery_type: e.target.value === '' ? undefined : parseInt(e.target.value) as 0 | 1 } : p)}>
                    <option value="">Not set</option>
                    <option value="0">Home</option>
                    <option value="1">Point</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button className="flex-1 bg-purple-600 text-white py-2 rounded-xl font-medium hover:bg-purple-700" onClick={() => saveEdit(editRow)}>
                  Save changes
                </button>
                <button className="flex-1 border py-2 rounded-xl text-gray-600 hover:bg-gray-50" onClick={() => setEditRow(null)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
