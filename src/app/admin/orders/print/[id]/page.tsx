'use client';

import { useEffect, useState, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Printer, FileText, Receipt } from 'lucide-react';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { getUserAndRole } from '@/lib/supabase-helpers';
import { Suspense } from 'react';

type OrderItem = {
  productId?: string;
  name: string;
  quantity: number;
  price: number;
  unit?: string;
};

type Order = {
  id: string;
  customerName: string;
  customerPhone?: string;
  items: OrderItem[];
  total: number;
  subtotal?: number;
  shippingCost?: number;
  discount?: number;
  voucher?: number;
  pointsUsed?: number;
  walletUsed?: number;
  status: string;
  paymentMethod: string;
  deliveryMethod?: string;
  deliveryAddress?: string;
  createdAt: string | null;
  dueDate?: string;
  notes?: string;
  channel?: string;
};

type StoreSettings = {
  name: string;
  address: string;
  phone: string;
  email?: string;
  footerMsg?: string;
  logoUrl?: string;
};

type PrintMode = 'a4' | 'thermal';
type PaperWidth = '58mm' | '80mm';

function PrintOrderPageInner({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [order, setOrder] = useState<Order | null>(null);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>({
    name: 'ATAYATOKO',
    address: 'Jl. Pandan 98, Semen, Kediri',
    phone: '0858-5316-1174',
    email: 'atayatoko2@gmail.com',
    footerMsg: 'Barang yang sudah dibeli tidak dapat ditukar/dikembalikan',
  });
  const [printMode, setPrintMode] = useState<PrintMode>(
    (searchParams.get('mode') as PrintMode) || 'a4'
  );
  const [paperWidth, setPaperWidth] = useState<PaperWidth>('80mm');
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/admin/login'); return; }
      const { isStaff } = await getUserAndRole();
      if (!isStaff) { router.push('/profil'); return; }
      setAuthChecked(true);
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (!authChecked || !id) return;
    const fetchData = async () => {
      try {
        const { data: orderRow } = await supabaseAdmin
          .from('orders')
          .select('*')
          .or(`id.eq.${id},order_id.eq.${id}`)
          .maybeSingle();

        if (orderRow) {
          const raw = orderRow.raw_data || {};
          setOrder({
            id: orderRow.id,
            customerName: orderRow.customer_name || raw.customerName || 'Pelanggan',
            customerPhone: raw.customerPhone || raw.phone,
            items: orderRow.items || raw.items || [],
            total: orderRow.total || raw.total || 0,
            subtotal: raw.subtotal,
            shippingCost: raw.shippingCost,
            discount: raw.discount,
            voucher: raw.voucher,
            pointsUsed: raw.pointsUsed,
            walletUsed: raw.walletUsed,
            status: orderRow.status || raw.status,
            paymentMethod: raw.paymentMethod || 'TUNAI',
            deliveryMethod: raw.deliveryMethod,
            deliveryAddress: raw.deliveryAddress,
            createdAt: orderRow.created_at || null,
            dueDate: raw.dueDate,
            notes: raw.notes || orderRow.notes,
            channel: raw.source || raw.channel,
          });
        }

        const { data: settingsRow } = await supabaseAdmin
          .from('settings')
          .select('*')
          .eq('key', 'system')
          .maybeSingle();
        if (settingsRow?.value) {
          const s = settingsRow.value;
          setStoreSettings(prev => ({
            name: (s.name || prev.name).toUpperCase(),
            address: s.address || prev.address,
            phone: s.phone || prev.phone,
            email: s.email || prev.email,
            footerMsg: s.footerMsg || prev.footerMsg,
            logoUrl: s.logoUrl || prev.logoUrl,
          }));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, authChecked]);

  if (loading || !authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Memuat dokumen...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-2xl font-black text-red-500 mb-2">404</p>
          <p className="text-sm font-bold text-gray-500">Data pesanan tidak ditemukan</p>
          <button onClick={() => router.back()} className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold">
            Kembali
          </button>
        </div>
      </div>
    );
  }

  const subtotal = order.subtotal ?? order.items?.reduce((s, i) => s + i.price * i.quantity, 0) ?? 0;
  const shippingCost = order.shippingCost ?? 0;
  const discountTotal = (order.discount || 0) + (order.voucher || 0) + (order.pointsUsed || 0) + (order.walletUsed || 0);
  const orderNum = `#ORD-${order.id.slice(-8).toUpperCase()}`;

  const dateStr = order.createdAt
    ? new Date(order.createdAt).toLocaleString('id-ID', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
    : '-';

  const shortDate = order.createdAt
    ? new Date(order.createdAt).toLocaleString('id-ID', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
    : '-';

  const isDebt = order.status === 'BELUM_LUNAS';

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* ===== TOOLBAR (hidden on print) ===== */}
      <div className="no-print sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <button
            onClick={() => router.back()}
            className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition text-gray-600"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-gray-900 uppercase tracking-tight">
              {printMode === 'a4' ? 'Invoice A4' : 'Struk Thermal'} — {orderNum}
            </p>
            <p className="text-xs text-gray-400">{order.customerName}</p>
          </div>

          {/* Mode Switcher */}
          <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
            <button
              onClick={() => setPrintMode('a4')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                printMode === 'a4'
                  ? 'bg-white text-blue-700 shadow-sm border border-blue-100'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileText size={13} /> A4 Invoice
            </button>
            <button
              onClick={() => setPrintMode('thermal')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                printMode === 'thermal'
                  ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Receipt size={13} /> Thermal
            </button>
          </div>

          {/* Thermal size selector */}
          {printMode === 'thermal' && (
            <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-bold gap-1">
              {(['58mm', '80mm'] as PaperWidth[]).map((w) => (
                <button
                  key={w}
                  onClick={() => setPaperWidth(w)}
                  className={`px-3 py-2 rounded-lg transition-all ${
                    paperWidth === w ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition shadow-lg shadow-blue-200"
          >
            <Printer size={15} /> Cetak
          </button>
        </div>
      </div>

      {/* ===== A4 INVOICE ===== */}
      {printMode === 'a4' && (
        <div className="max-w-3xl mx-auto my-8 print:my-0 print:max-w-none">
          <div
            id="invoice-a4"
            className="bg-white shadow-xl print:shadow-none"
            style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}
          >
            {/* Invoice Header Band */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-700 print:bg-slate-900 px-10 py-8 print:px-8 print:py-7 text-white">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-black tracking-tight">{storeSettings.name}</h1>
                  <p className="text-slate-300 text-sm mt-1 max-w-xs leading-relaxed">
                    {storeSettings.address}
                  </p>
                  <p className="text-slate-300 text-sm mt-0.5">
                    {storeSettings.phone}
                    {storeSettings.email && ` · ${storeSettings.email}`}
                  </p>
                </div>
                <div className="text-right">
                  <div className="inline-block bg-white/15 rounded-2xl px-5 py-3">
                    <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-0.5">INVOICE</p>
                    <p className="text-xl font-black tracking-tight">{orderNum}</p>
                  </div>
                  <p className="text-slate-400 text-xs mt-2">{dateStr}</p>
                </div>
              </div>
            </div>

            <div className="px-10 py-8 print:px-8 print:py-6">
              {/* Bill To + Order Info */}
              <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Kepada</p>
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                    <p className="text-base font-black text-slate-900 uppercase">{order.customerName}</p>
                    {order.customerPhone && (
                      <p className="text-sm text-slate-500 mt-1">{order.customerPhone}</p>
                    )}
                    {order.deliveryAddress && (
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed">{order.deliveryAddress}</p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Detail Transaksi</p>
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 font-medium">Tanggal</span>
                      <span className="font-bold text-slate-800 text-right">{dateStr}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 font-medium">Metode Bayar</span>
                      <span className="font-black text-slate-800 uppercase">{order.paymentMethod}</span>
                    </div>
                    {order.deliveryMethod && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500 font-medium">Pengiriman</span>
                        <span className="font-bold text-slate-800 uppercase">{order.deliveryMethod.replace('_', ' ')}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 font-medium">Status</span>
                      <span className={`font-black text-xs px-2.5 py-1 rounded-lg uppercase ${
                        isDebt
                          ? 'bg-orange-100 text-orange-700'
                          : order.status === 'SELESAI' || order.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {isDebt ? 'BELUM LUNAS' : order.status}
                      </span>
                    </div>
                    {isDebt && order.dueDate && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500 font-medium">Jatuh Tempo</span>
                        <span className="font-black text-red-600 text-xs">
                          {new Date(order.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="mb-8">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-900 text-white text-left print:bg-slate-900">
                      <th className="py-3.5 px-4 rounded-l-xl text-xs font-black uppercase tracking-widest">No</th>
                      <th className="py-3.5 px-4 text-xs font-black uppercase tracking-widest">Produk</th>
                      <th className="py-3.5 px-4 text-xs font-black uppercase tracking-widest text-center">Qty</th>
                      <th className="py-3.5 px-4 text-xs font-black uppercase tracking-widest text-right">Harga</th>
                      <th className="py-3.5 px-4 rounded-r-xl text-xs font-black uppercase tracking-widest text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {order.items?.map((item, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                        <td className="py-3.5 px-4 text-sm text-slate-400 font-bold">{idx + 1}</td>
                        <td className="py-3.5 px-4">
                          <p className="text-sm font-bold text-slate-900">{item.name}</p>
                          {item.unit && <p className="text-xs text-slate-400 mt-0.5">per {item.unit}</p>}
                        </td>
                        <td className="py-3.5 px-4 text-sm font-black text-slate-700 text-center">
                          {item.quantity} <span className="text-slate-400 font-normal text-xs">{item.unit || 'pcs'}</span>
                        </td>
                        <td className="py-3.5 px-4 text-sm font-semibold text-slate-600 text-right">
                          Rp{item.price.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3.5 px-4 text-sm font-black text-slate-900 text-right">
                          Rp{(item.quantity * item.price).toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="flex justify-end mb-8">
                <div className="w-72">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 font-medium">Subtotal</span>
                      <span className="font-bold text-slate-800">Rp{subtotal.toLocaleString('id-ID')}</span>
                    </div>
                    {shippingCost > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500 font-medium">Ongkos Kirim</span>
                        <span className="font-bold text-slate-800">Rp{shippingCost.toLocaleString('id-ID')}</span>
                      </div>
                    )}
                    {discountTotal > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500 font-medium">Diskon/Voucher</span>
                        <span className="font-bold text-emerald-600">−Rp{discountTotal.toLocaleString('id-ID')}</span>
                      </div>
                    )}
                    <div className="border-t-2 border-slate-200 mt-3 pt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-base font-black text-slate-900 uppercase tracking-wide">Total</span>
                        <span className="text-xl font-black text-slate-900">
                          Rp{order.total.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                    {isDebt && (
                      <div className="mt-2 bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
                        <p className="text-xs font-black text-orange-700 uppercase tracking-wider">⚠ BELUM LUNAS — TEMPO</p>
                        {order.dueDate && (
                          <p className="text-xs text-orange-600 mt-0.5">
                            Harap bayar sebelum {new Date(order.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              {order.notes && (
                <div className="mb-8 bg-amber-50 border border-amber-100 rounded-2xl p-5">
                  <p className="text-xs font-black text-amber-600 uppercase tracking-widest mb-1">Catatan</p>
                  <p className="text-sm text-slate-700">{order.notes}</p>
                </div>
              )}

              {/* Footer */}
              <div className="border-t border-slate-100 pt-6 flex justify-between items-end">
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Tanda Tangan Penerima</p>
                  <div className="w-36 border-b-2 border-slate-300 mt-10 mb-1" />
                  <p className="text-xs text-slate-400">(________________________)</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400 mb-1 max-w-xs leading-relaxed">
                    {storeSettings.footerMsg || 'Barang yang sudah dibeli tidak dapat ditukar/dikembalikan'}
                  </p>
                  <p className="text-xs font-black text-slate-600 uppercase tracking-wider mt-3">
                    {storeSettings.name}
                  </p>
                  <p className="text-xs text-slate-400">{storeSettings.phone}</p>
                </div>
              </div>
            </div>

            {/* Bottom accent bar */}
            <div className="h-2 bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 print:block" />
          </div>
        </div>
      )}

      {/* ===== THERMAL RECEIPT ===== */}
      {printMode === 'thermal' && (
        <div className="flex justify-center py-8 print:py-0">
          <div
            className={`thermal-receipt bg-white border border-dashed border-slate-300 print:border-none shadow-md print:shadow-none mx-auto ${
              paperWidth === '58mm' ? 'w-[58mm] max-w-[58mm]' : 'w-[80mm] max-w-[80mm]'
            }`}
            style={{
              fontFamily: "'Courier New', Courier, monospace",
              padding: paperWidth === '58mm' ? '4px 3px' : '6px 6px',
              fontSize: paperWidth === '58mm' ? '11px' : '12px',
              lineHeight: '1.25'
            }}
          >
            <div className="text-center pb-1">
              <div className="font-black text-sm uppercase tracking-tight">{storeSettings.name}</div>
              <div className="text-[10px] text-neutral-700">{storeSettings.address}</div>
              <div className="text-[10px] text-neutral-700">Telp: {storeSettings.phone}</div>
              <div className="border-b border-black border-dashed my-1.5" />
            </div>

            <div className="space-y-0.5 text-[10.5px]">
              <div className="flex justify-between"><span>Tgl:</span><span>{shortDate}</span></div>
              <div className="flex justify-between"><span>No:</span><span className="font-bold">{orderNum}</span></div>
              <div className="flex justify-between">
                <span>Plg:</span>
                <span className="font-bold uppercase truncate max-w-[140px] text-right">{order.customerName || 'Umum'}</span>
              </div>
              {order.customerPhone && (
                <div className="flex justify-between"><span>Hp:</span><span>{order.customerPhone}</span></div>
              )}
            </div>

            <div className="border-b border-black border-dashed my-1.5" />

            <div className="space-y-1.5">
              {order.items?.map((item, idx) => (
                <div key={idx} className="leading-tight">
                  <div className="font-bold uppercase text-[11px] break-words">{item.name}</div>
                  <div className="flex justify-between text-[10.5px]">
                    <span>{item.quantity} {item.unit || 'pcs'} x {item.price.toLocaleString('id-ID')}</span>
                    <span className="font-semibold">{(item.quantity * item.price).toLocaleString('id-ID')}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-b border-black border-dashed my-1.5" />

            <div className="space-y-0.5 text-[10.5px]">
              <div className="flex justify-between"><span>Subtotal</span><span>Rp{subtotal.toLocaleString('id-ID')}</span></div>
              {shippingCost > 0 && (
                <div className="flex justify-between"><span>Ongkir</span><span>Rp{shippingCost.toLocaleString('id-ID')}</span></div>
              )}
              {discountTotal > 0 && (
                <div className="flex justify-between text-neutral-700">
                  <span>Diskon/Voucher</span><span>-Rp{discountTotal.toLocaleString('id-ID')}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-xs pt-1 border-t border-black border-dotted mt-1">
                <span>TOTAL</span><span>Rp{order.total.toLocaleString('id-ID')}</span>
              </div>
            </div>

            <div className="border-b border-black border-dashed my-1.5" />

            <div className="space-y-0.5 text-[10px]">
              <div className="flex justify-between">
                <span>Metode Bayar:</span>
                <span className="font-bold uppercase">{order.paymentMethod || '-'}</span>
              </div>
              {order.deliveryMethod && (
                <div className="flex justify-between">
                  <span>Kurir:</span>
                  <span className="font-bold uppercase">{order.deliveryMethod.replace('_', ' ')}</span>
                </div>
              )}
              {isDebt && (
                <div className="mt-1 border border-black p-1 text-center font-black uppercase text-[10px]">
                  BELUM LUNAS (TEMPO)
                  {order.dueDate && (
                    <div className="text-[9px] font-normal">
                      Jatuh Tempo: {new Date(order.dueDate).toLocaleDateString('id-ID')}
                    </div>
                  )}
                </div>
              )}
            </div>

            {order.deliveryAddress && (
              <div className="mt-1.5 pt-1 border-t border-black border-dotted text-[9.5px]">
                <span className="font-bold">Alamat Kirim:</span>
                <p className="leading-tight uppercase break-words">{order.deliveryAddress}</p>
              </div>
            )}

            <div className="text-center mt-3 pt-1 border-t border-black border-dashed space-y-0.5">
              <div className="font-black uppercase text-[11px] tracking-tight">Terima Kasih</div>
              <div className="text-[9px] text-neutral-600 leading-tight">
                {storeSettings.footerMsg || 'Barang yang sudah dibeli tidak dapat ditukar/dikembalikan'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== PRINT STYLES ===== */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        @media print {
          .no-print { display: none !important; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
        }

        /* A4 Print Styles */
        ${printMode === 'a4' ? `
          @media print {
            @page { size: A4 portrait; margin: 12mm 15mm; }
            #invoice-a4 { box-shadow: none !important; }
          }
        ` : `
          @media print {
            @page { size: ${paperWidth} auto; margin: 0mm !important; }
            html, body { width: ${paperWidth} !important; }
            .thermal-receipt {
              border: none !important; box-shadow: none !important;
              width: ${paperWidth} !important; max-width: ${paperWidth} !important;
              margin: 0 !important;
              padding: ${paperWidth === '58mm' ? '2mm 1mm' : '3mm 2mm'} !important;
            }
          }
        `}
      `}</style>
    </div>
  );
}

export default function PrintOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <PrintOrderPageInner id={resolvedParams.id} />
    </Suspense>
  );
}
