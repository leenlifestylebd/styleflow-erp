'use client';
import { useEffect, useRef, useState } from 'react';
import type { BarcodeLabel, BarcodeType } from '@/types';
import { generateSKU, generateBarcode, autoBarcodeType } from '@/lib/utils/barcode';
import { Printer, Plus, Minus, Download } from 'lucide-react';

// ── BarcodeCanvas: renders single barcode via JsBarcode ──────────────────────
export function BarcodeCanvas({ value, type, width = 2, height = 60 }: {
  value: string; type: BarcodeType; width?: number; height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    // Dynamically import JsBarcode
    import('jsbarcode').then(({ default: JsBarcode }) => {
      try {
        JsBarcode(canvasRef.current, value, {
          format: type === 'EAN13' ? 'EAN13' : type === 'CODE39' ? 'CODE39' : 'CODE128',
          width,
          height,
          fontSize: 12,
          textMargin: 4,
          margin: 8,
          displayValue: true,
          background: '#ffffff',
          lineColor: '#000000',
        });
      } catch {
        // Invalid barcode value — clear canvas
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx && canvasRef.current) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          ctx.fillStyle = '#fee2e2';
          ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          ctx.fillStyle = '#991b1b';
          ctx.font = '12px monospace';
          ctx.fillText('Invalid barcode', 8, 30);
        }
      }
    });
  }, [value, type, width, height]);

  return <canvas ref={canvasRef} />;
}

// ── Single barcode label (product label) ─────────────────────────────────────
export function ProductLabel({ label, size = '58mm' }: { label: BarcodeLabel; size?: string }) {
  const widths: Record<string, string> = { '58mm': '54mm', '72mm': '68mm', '80mm': '76mm' };
  const w = widths[size] || '76mm';

  return (
    <div className="product-label" style={{
      width: w, fontFamily: 'monospace', fontSize: '10px',
      border: '1px solid #000', padding: '6px', margin: '2px',
      pageBreakAfter: 'always', background: '#fff', color: '#000',
    }}>
      <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '2px', textAlign: 'center' }}>
        {label.product_name}
      </div>
      {(label.size || label.color) && (
        <div style={{ textAlign: 'center', fontSize: '10px', color: '#555', marginBottom: '2px' }}>
          {[label.size, label.color].filter(Boolean).join(' / ')}
        </div>
      )}
      <div style={{ textAlign: 'center', marginBottom: '2px' }}>
        <BarcodeCanvas value={label.barcode} type={label.barcode_type} height={40} />
      </div>
      <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: 'bold' }}>
        ৳{label.price.toLocaleString()}
      </div>
      <div style={{ textAlign: 'center', fontSize: '9px', color: '#666' }}>
        {label.sku}
      </div>
    </div>
  );
}

// ── Courier label (thermal) ───────────────────────────────────────────────────
export function CourierLabel({ shipment, storeName }: {
  shipment: {
    tracking_code: string; invoice: string; recipient_name: string;
    recipient_phone: string; recipient_address: string; cod_amount: number; note?: string;
  };
  storeName?: string;
}) {
  return (
    <div style={{
      width: '76mm', fontFamily: 'monospace', fontSize: '11px',
      border: '1px solid #000', padding: '6px',
      pageBreakAfter: 'always', background: '#fff', color: '#000',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', borderBottom: '1px solid #000', paddingBottom: '4px', marginBottom: '4px' }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{storeName || 'StyleFlow'}</div>
      </div>
      {/* Tracking */}
      <div style={{ textAlign: 'center', margin: '4px 0' }}>
        <div style={{
          background: '#000', color: '#fff', fontSize: '18px', fontWeight: 'bold',
          letterSpacing: '3px', padding: '4px 8px', display: 'inline-block', borderRadius: '2px'
        }}>{shipment.tracking_code}</div>
      </div>
      {/* COD */}
      <div style={{ textAlign: 'center', marginBottom: '6px' }}>
        <span style={{
          background: '#000', color: '#fff', fontWeight: 'bold',
          padding: '2px 10px', fontSize: '12px'
        }}>COD: ৳{shipment.cod_amount.toLocaleString()}</span>
      </div>
      {/* Recipient */}
      <div style={{ border: '1px solid #000', padding: '4px', marginBottom: '4px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{shipment.recipient_name}</div>
        <div>{shipment.recipient_phone}</div>
        <div style={{ fontSize: '10px', marginTop: '2px' }}>{shipment.recipient_address}</div>
      </div>
      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#666' }}>
        <span>Invoice: {shipment.invoice}</span>
        <span>{new Date().toLocaleDateString('en-GB')}</span>
      </div>
      {shipment.note && (
        <div style={{ fontSize: '9px', borderTop: '1px dashed #000', marginTop: '3px', paddingTop: '3px' }}>
          Note: {shipment.note}
        </div>
      )}
    </div>
  );
}

// ── Bulk Barcode Generator Page ───────────────────────────────────────────────
export default function BarcodeGeneratorPage() {
  const [labels, setLabels] = useState<BarcodeLabel[]>([]);
  const [size, setSize] = useState('80mm');
  const [showPreview, setShowPreview] = useState(false);

  function addLabel() {
    const sku = generateSKU('Product', 'M', 'BLK');
    const barcode = generateBarcode(sku, 'CODE128');
    setLabels((prev) => [...prev, {
      variation_id: crypto.randomUUID(),
      sku,
      product_name: 'New Product',
      size: 'M',
      color: 'Black',
      price: 0,
      barcode,
      barcode_type: 'CODE128',
      copies: 1,
    }]);
  }

  function updateLabel(idx: number, updates: Partial<BarcodeLabel>) {
    setLabels((prev) => prev.map((l, i) => {
      if (i !== idx) return l;
      const updated = { ...l, ...updates };
      // Auto-regenerate barcode if type changes
      if (updates.barcode_type) {
        updated.barcode = generateBarcode(updated.sku, updated.barcode_type);
      }
      return updated;
    }));
  }

  function printLabels() {
    const w = window.open('', '_blank', 'width=600,height=800');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head>
      <style>
        body{margin:0;padding:8px}
        .wrap{display:flex;flex-wrap:wrap;gap:4px}
        @media print{body{margin:0;padding:0}.no-print{display:none}}
      </style></head><body>
      <div class="no-print" style="padding:8px;text-align:center">
        <button onclick="window.print()" style="padding:8px 20px;font-size:14px">🖨️ Print</button>
      </div>
      <div class="wrap" id="labels"></div>
      </body></html>`);

    // Render labels into the new window
    labels.forEach((label) => {
      for (let i = 0; i < label.copies; i++) {
        const div = w.document.createElement('div');
        div.style.cssText = `width:76mm;font-family:monospace;font-size:10px;border:1px solid #000;padding:6px;margin:2px;page-break-inside:avoid`;
        div.innerHTML = `
          <div style="font-weight:bold;font-size:12px;text-align:center;margin-bottom:2px">${label.product_name}</div>
          <div style="text-align:center;font-size:10px;color:#555;margin-bottom:4px">${[label.size,label.color].filter(Boolean).join(' / ')}</div>
          <svg id="bc-${label.sku}-${i}" style="display:block;margin:0 auto"></svg>
          <div style="text-align:center;font-weight:bold;font-size:12px">৳${label.price.toLocaleString()}</div>
          <div style="text-align:center;font-size:9px;color:#666">${label.sku}</div>
        `;
        w.document.getElementById('labels')?.appendChild(div);
      }
    });

    // Load JsBarcode in print window and render
    const script = w.document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js';
    script.onload = () => {
      labels.forEach((label) => {
        for (let i = 0; i < label.copies; i++) {
          try {
            (w as unknown as { JsBarcode: (sel: string, val: string, opts: Record<string,unknown>) => void }).JsBarcode(
              `#bc-${label.sku}-${i}`, label.barcode,
              { format: label.barcode_type, height: 40, width: 1.5, fontSize: 10, displayValue: true }
            );
          } catch {}
        }
      });
    };
    w.document.head.appendChild(script);
    w.document.close();
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Barcode Generator</h1>
          <p className="text-gray-500 text-sm">Generate EAN-13, CODE128, CODE39 barcodes for products</p>
        </div>
        <div className="flex gap-2">
          <select className="border rounded-lg px-3 py-2 text-sm" value={size} onChange={(e) => setSize(e.target.value)}>
            <option value="58mm">58mm thermal</option>
            <option value="72mm">72mm thermal</option>
            <option value="80mm">80mm thermal</option>
            <option value="a4">A4 sheet</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm" onClick={addLabel}>
            <Plus className="h-4 w-4" /> Add label
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg text-sm disabled:opacity-50"
            disabled={!labels.length}
            onClick={printLabels}
          >
            <Printer className="h-4 w-4" /> Print all
          </button>
        </div>
      </div>

      {labels.length === 0 ? (
        <div className="text-center py-16 text-gray-400 border-2 border-dashed rounded-2xl">
          <p className="text-lg mb-2">No labels yet</p>
          <button className="text-purple-600 hover:underline" onClick={addLabel}>Add your first label</button>
        </div>
      ) : (
        <div className="space-y-3">
          {labels.map((label, idx) => (
            <div key={idx} className="border rounded-xl p-4 bg-white">
              <div className="grid grid-cols-6 gap-3 items-end mb-3">
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Product name</label>
                  <input className="w-full border rounded-lg px-3 py-1.5 text-sm" value={label.product_name}
                    onChange={(e) => updateLabel(idx, { product_name: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">SKU</label>
                  <input className="w-full border rounded-lg px-3 py-1.5 text-sm font-mono" value={label.sku}
                    onChange={(e) => updateLabel(idx, { sku: e.target.value, barcode: generateBarcode(e.target.value, label.barcode_type) })} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Barcode type</label>
                  <select className="w-full border rounded-lg px-3 py-1.5 text-sm" value={label.barcode_type}
                    onChange={(e) => updateLabel(idx, { barcode_type: e.target.value as BarcodeType })}>
                    <option value="CODE128">CODE128</option>
                    <option value="EAN13">EAN-13</option>
                    <option value="CODE39">CODE39</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Price ৳</label>
                  <input type="number" className="w-full border rounded-lg px-3 py-1.5 text-sm" value={label.price}
                    onChange={(e) => updateLabel(idx, { price: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Copies</label>
                  <div className="flex items-center gap-1">
                    <button className="w-7 h-7 border rounded flex items-center justify-center hover:bg-gray-100"
                      onClick={() => updateLabel(idx, { copies: Math.max(1, label.copies - 1) })}>
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-8 text-center text-sm font-medium">{label.copies}</span>
                    <button className="w-7 h-7 border rounded flex items-center justify-center hover:bg-gray-100"
                      onClick={() => updateLabel(idx, { copies: label.copies + 1 })}>
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Size</label>
                    <input className="w-16 border rounded-lg px-2 py-1.5 text-sm text-center" value={label.size || ''}
                      onChange={(e) => updateLabel(idx, { size: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Color</label>
                    <input className="w-20 border rounded-lg px-2 py-1.5 text-sm text-center" value={label.color || ''}
                      onChange={(e) => updateLabel(idx, { color: e.target.value })} />
                  </div>
                </div>
                {/* Live barcode preview */}
                <div className="flex-1 flex justify-center">
                  <BarcodeCanvas value={label.barcode} type={label.barcode_type} height={50} />
                </div>
                <button className="text-red-400 hover:text-red-600 text-sm" onClick={() => setLabels((p) => p.filter((_, i) => i !== idx))}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
