'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Printer, FileText, Receipt } from 'lucide-react';
import { getSalesOrders } from '@/lib/actions/sales.actions';

type OrderDetail = {
  id: string;
  soNumber: string;
  status: string;
  totalAmount: number;
  createdAt: Date | string;
  customer: { name: string; phone?: string | null } | null;
  items: { quantity: number; unitPrice: number; product: { name: string } | null }[];
};

type StoreSettings = { name: string; address: string; phone: string; footerMsg?: string; };
type PrintMode = 'a4' | 'thermal';
type PaperWidth = '58mm' | '80mm';

function BulkPrintOrdersInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idsParam = searchParams.get('ids') || '';
  const initialMode = (searchParams.get('mode') as PrintMode) || 'a4';

  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [store, setStore] = useState<StoreSettings>({ name: 'ATAYATOKO', address: 'Jl. Pandan 98, Semen, Kediri', phone: '0858-5316-1174', footerMsg: 'Terima kasih telah berbelanja!' });
  const [printMode, setPrintMode] = useState<PrintMode>(initialMode);
  const [paperWidth, setPaperWidth] = useState<PaperWidth>('80mm');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { supabaseAdmin } = await import('@/lib/supabase');
        const { data } = await supabaseAdmin.from('settings').select('*').eq('key', 'system').maybeSingle();
        if (data?.value) { const s = data.value; setStore(p => ({ name: (s.name || p.name).toUpperCase(), address: s.address || p.address, phone: s.phone || p.phone, footerMsg: s.footerMsg || p.footerMsg })); }
      } catch { /* defaults */ }
    })();
  }, []);

  useEffect(() => {
    const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean);
    if (!ids.length) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      try {
        const all = await getSalesOrders({ limit: 500 });
        const filtered = (all as OrderDetail[]).filter(o => ids.includes(o.id));
        setOrders(filtered);
        if (filtered.length > 0) setTimeout(() => window.print(), 700);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [idsParam]);

  const fmtDate = (d: Date | string) => (d instanceof Date ? d : new Date(d)).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  const fmtTime = (d: Date | string) => (d instanceof Date ? d : new Date(d)).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="text-center"><div className="w-9 h-9 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" /><p className="font-bold text-gray-600 text-sm">Menyiapkan Dokumen...</p></div></div>;

  if (!orders.length) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white p-8 rounded-3xl border shadow-sm max-w-md w-full text-center">
        <p className="font-black text-rose-500 text-sm mb-2">Tidak Ada Data Order</p>
        <button onClick={() => router.push('/admin/orders')} className="mt-4 w-full py-3 bg-gray-900 text-white rounded-xl text-xs font-bold">Kembali</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-100 print:bg-white py-4 print:py-0 flex flex-col items-center">
      <div className="w-full max-w-4xl mx-auto px-4 mb-4 no-print">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/admin/orders')} className="p-2.5 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all"><ArrowLeft size={18} /></button>
            <div><h1 className="text-sm font-black uppercase text-slate-900">Cetak Masal ({orders.length} Order)</h1><p className="text-[11px] text-slate-500">{printMode === 'a4' ? 'Invoice A4' : `Thermal ${paperWidth}`}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
              <button onClick={() => setPrintMode('a4')} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold ${printMode === 'a4' ? 'bg-white shadow' : 'text-slate-500'}`}><FileText size={13} /> A4</button>
              <button onClick={() => setPrintMode('thermal')} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold ${printMode === 'thermal' ? 'bg-white shadow' : 'text-slate-500'}`}><Receipt size={13} /> Thermal</button>
            </div>
            {printMode === 'thermal' && (
              <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
                {(['58mm', '80mm'] as PaperWidth[]).map(w => <button key={w} onClick={() => setPaperWidth(w)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${paperWidth === w ? 'bg-white shadow' : 'text-slate-500'}`}>{w}</button>)}
              </div>
            )}
            <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black">
              <Printer size={14} /> Cetak Semua
            </button>
          </div>
        </div>
      </div>

      <div className="w-full flex flex-col items-center gap-6 print:gap-0 px-4 max-w-4xl">
        {orders.map((order, idx) => printMode === 'a4'
          ? <A4Doc key={order.id} order={order} store={store} fmtDate={fmtDate} fmtTime={fmtTime} isLast={idx === orders.length - 1} />
          : <ThermalDoc key={order.id} order={order} store={store} pw={paperWidth} fmtDate={fmtDate} fmtTime={fmtTime} isLast={idx === orders.length - 1} />
        )}
      </div>

      <style jsx global>{`@media print { .no-print { display: none !important; } body { margin: 0; } }`}</style>
    </div>
  );
}

function A4Doc({ order, store, fmtDate, fmtTime, isLast }: { order: OrderDetail; store: StoreSettings; fmtDate: Function; fmtTime: Function; isLast: boolean }) {
  return (
    <div className={`w-full bg-white px-8 py-8 shadow border border-slate-200 rounded-2xl print:rounded-none print:shadow-none print:border-none ${!isLast ? 'print:break-after-page' : ''}`}>
      <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-slate-900">
        <div><h1 className="text-2xl font-black">{store.name}</h1><p className="text-xs text-slate-500">{store.address}</p><p className="text-xs text-slate-500">Tel: {store.phone}</p></div>
        <div className="text-right"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">INVOICE</p><p className="text-xl font-black">{order.soNumber}</p><p className="text-xs text-slate-500">{String(fmtDate(order.createdAt))} · {String(fmtTime(order.createdAt))}</p></div>
      </div>
      <div className="mb-4 p-3 bg-slate-50 rounded-xl"><p className="text-[10px] font-black uppercase text-slate-400 mb-1">Pelanggan</p><p className="font-black text-sm">{order.customer?.name || 'Walk-in'}</p>{order.customer?.phone && <p className="text-xs text-slate-500">{order.customer.phone}</p>}</div>
      <table className="w-full text-xs mb-4">
        <thead><tr className="border-b border-slate-200"><th className="py-2 text-left font-black text-slate-400 uppercase">Produk</th><th className="py-2 text-center font-black text-slate-400 uppercase w-12">Qty</th><th className="py-2 text-right font-black text-slate-400 uppercase w-28">Harga</th><th className="py-2 text-right font-black text-slate-400 uppercase w-28">Subtotal</th></tr></thead>
        <tbody className="divide-y divide-slate-50">
          {order.items.map((it, i) => <tr key={i}><td className="py-2">{it.product?.name}</td><td className="py-2 text-center">{it.quantity}</td><td className="py-2 text-right">Rp {it.unitPrice.toLocaleString('id-ID')}</td><td className="py-2 text-right font-bold">Rp {(it.quantity * it.unitPrice).toLocaleString('id-ID')}</td></tr>)}
        </tbody>
      </table>
      <div className="border-t-2 border-slate-900 pt-3 flex justify-end mb-4"><div className="flex items-center gap-8"><span className="text-xs font-black uppercase text-slate-500">TOTAL</span><span className="text-xl font-black">Rp {order.totalAmount.toLocaleString('id-ID')}</span></div></div>
      <div className="flex justify-between items-center pt-3 border-t border-slate-100">
        <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase ${order.status === 'COMPLETED' || order.status === 'SELESAI' ? 'bg-emerald-50 text-emerald-600' : order.status === 'DELIVERING' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>{order.status}</span>
        <p className="text-[10px] text-slate-400">{store.footerMsg}</p>
      </div>
    </div>
  );
}

function ThermalDoc({ order, store, pw, fmtDate, fmtTime, isLast }: { order: OrderDetail; store: StoreSettings; pw: PaperWidth; fmtDate: Function; fmtTime: Function; isLast: boolean }) {
  const width = pw === '58mm' ? '220px' : '302px';
  return (
    <div className={`bg-white px-3 py-4 text-[10px] leading-tight border border-dashed border-slate-300 print:border-none ${!isLast ? 'print:break-after-page' : ''}`} style={{ fontFamily: 'monospace', width }}>
      <div className="text-center mb-2"><p className="font-black text-sm">{store.name}</p><p className="text-[9px]">{store.address}</p><p className="text-[9px]">{store.phone}</p></div>
      <div className="border-t border-dashed my-1.5" />
      <div className="mb-1.5">
        <div className="flex justify-between"><span>No:</span><span className="font-bold">{order.soNumber}</span></div>
        <div className="flex justify-between"><span>Tgl:</span><span>{String(fmtDate(order.createdAt))}</span></div>
        <div className="flex justify-between"><span>Jam:</span><span>{String(fmtTime(order.createdAt))}</span></div>
        <div className="flex justify-between"><span>Cust:</span><span className="font-bold">{order.customer?.name || 'Walk-in'}</span></div>
      </div>
      <div className="border-t border-dashed my-1.5" />
      {order.items.map((it, i) => <div key={i} className="mb-1"><p className="font-bold truncate">{it.product?.name}</p><div className="flex justify-between"><span>{it.quantity}x Rp{it.unitPrice.toLocaleString('id-ID')}</span><span className="font-bold">Rp{(it.quantity * it.unitPrice).toLocaleString('id-ID')}</span></div></div>)}
      <div className="border-t border-dashed my-1.5" />
      <div className="flex justify-between font-black text-sm mb-1.5"><span>TOTAL</span><span>Rp{order.totalAmount.toLocaleString('id-ID')}</span></div>
      <div className="border-t border-dashed my-1.5" />
      <div className="text-center text-[9px] mt-2"><p>{store.footerMsg}</p></div>
    </div>
  );
}

export default function BulkPrintOrdersPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-9 h-9 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <BulkPrintOrdersInner />
    </Suspense>
  );
}
