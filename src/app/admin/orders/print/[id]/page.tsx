'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { isAdminRole, isStaffOrAdmin } from '@/lib/auth-helpers';

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
};

type StoreSettings = {
  name: string;
  address: string;
  phone: string;
  footerMsg?: string;
};

export default function PrintOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const [order, setOrder] = useState<Order | null>(null);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>({
    name: 'ATAYATOKO',
    address: 'Jl. Pandan 98, Semen, Kediri',
    phone: '0858-5316-1174',
    footerMsg: 'Barang yang sudah dibeli tidak dapat ditukar/dikembalikan'
  });
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('58mm');
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/admin/login'); return; }
      
      const userRole = user.app_metadata?.role
        || user.user_metadata?.role
        || (user.email?.startsWith('admin') ? 'admin' : undefined)
        || (user.email?.includes('hadzikoh') ? 'superadmin' : undefined)
        || (user.email?.startsWith('kasir') ? 'cashier' : undefined);

      if (!isAdminRole(userRole) && !isStaffOrAdmin(userRole)) {
        router.push('/profil'); return;
      }
      setAuthChecked(true);
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (!authChecked || !id) return;
    const fetchData = async () => {
      try {
        // Ambil order dari Supabase
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
          });
          setTimeout(() => { window.print(); }, 600);
        }

        // Ambil settings dari Supabase
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
            footerMsg: s.footerMsg || prev.footerMsg,
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
      <div className="p-10 text-center font-black uppercase text-slate-400 animate-pulse tracking-widest">
        Memuat Struk Thermal...
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-10 text-center font-black text-rose-500 uppercase">
        Data Pesanan Tidak Ditemukan
      </div>
    );
  }

  const subtotal = order.subtotal ?? order.items?.reduce((sum, item) => sum + item.price * item.quantity, 0) ?? 0;
  const shippingCost = order.shippingCost ?? 0;
  const discountTotal = (order.discount || 0) + (order.voucher || 0) + (order.pointsUsed || 0) + (order.walletUsed || 0);

  const dateStr = order.createdAt
    ? new Date(order.createdAt).toLocaleString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '-';

  return (
    <div className="min-h-screen bg-neutral-100 print:bg-white text-black py-4 print:py-0 print:p-0 flex flex-col items-center">
      {/* Kontrol Navigasi & Pengaturan Thermal di Layar */}
      <div className="w-full max-w-xl mx-auto px-4 mb-4 no-print">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2.5 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all text-slate-700"
              title="Kembali"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-sm font-black uppercase tracking-tight text-slate-900">
                Cetak Struk Thermal
              </h1>
              <p className="text-[11px] text-slate-500">
                Pilih ukuran kertas thermal printer Anda
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setPaperWidth('58mm')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  paperWidth === '58mm' ? 'bg-black text-white shadow-sm' : 'text-slate-600 hover:text-black'
                }`}
              >
                58mm
              </button>
              <button
                type="button"
                onClick={() => setPaperWidth('80mm')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  paperWidth === '80mm' ? 'bg-black text-white shadow-sm' : 'text-slate-600 hover:text-black'
                }`}
              >
                80mm
              </button>
            </div>

            <button
              onClick={() => typeof window !== 'undefined' && window.print()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Printer size={15} /> Cetak
            </button>
          </div>
        </div>
      </div>

      {/* STRUK THERMAL AREA */}
      <div
        className={`thermal-receipt bg-white text-black mx-auto border border-dashed border-slate-300 print:border-none shadow-md print:shadow-none ${
          paperWidth === '58mm' ? 'w-[58mm] max-w-[58mm]' : 'w-[80mm] max-w-[80mm]'
        }`}
        style={{
          fontFamily: "'Courier New', Courier, monospace",
          padding: paperWidth === '58mm' ? '4px 3px' : '6px 6px',
          fontSize: paperWidth === '58mm' ? '11px' : '12px',
          lineHeight: '1.25'
        }}
      >
        {/* Header Toko */}
        <div className="text-center pb-1">
          <div className="font-black text-sm uppercase tracking-tight">{storeSettings.name}</div>
          <div className="text-[10px] text-neutral-700">{storeSettings.address}</div>
          <div className="text-[10px] text-neutral-700">Telp: {storeSettings.phone}</div>
          <div className="border-b border-black border-dashed my-1.5" />
        </div>

        {/* Info Order */}
        <div className="space-y-0.5 text-[10.5px]">
          <div className="flex justify-between">
            <span>Tgl:</span>
            <span>{dateStr}</span>
          </div>
          <div className="flex justify-between">
            <span>No:</span>
            <span className="font-bold">#ORD-{order.id.slice(-8).toUpperCase()}</span>
          </div>
          <div className="flex justify-between">
            <span>Plg:</span>
            <span className="font-bold uppercase truncate max-w-[140px] text-right">
              {order.customerName || 'Umum'}
            </span>
          </div>
          {order.customerPhone && (
            <div className="flex justify-between">
              <span>Hp:</span>
              <span>{order.customerPhone}</span>
            </div>
          )}
        </div>

        <div className="border-b border-black border-dashed my-1.5" />

        {/* Daftar Barang */}
        <div className="space-y-1.5">
          {order.items?.map((item, idx) => (
            <div key={idx} className="leading-tight">
              <div className="font-bold uppercase text-[11px] break-words">{item.name}</div>
              <div className="flex justify-between text-[10.5px]">
                <span>
                  {item.quantity} {item.unit || 'pcs'} x {item.price.toLocaleString('id-ID')}
                </span>
                <span className="font-semibold">
                  {(item.quantity * item.price).toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="border-b border-black border-dashed my-1.5" />

        {/* Totalan */}
        <div className="space-y-0.5 text-[10.5px]">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>Rp{subtotal.toLocaleString('id-ID')}</span>
          </div>
          {shippingCost > 0 && (
            <div className="flex justify-between">
              <span>Ongkir</span>
              <span>Rp{shippingCost.toLocaleString('id-ID')}</span>
            </div>
          )}
          {discountTotal > 0 && (
            <div className="flex justify-between text-neutral-700">
              <span>Diskon/Voucher</span>
              <span>-Rp{discountTotal.toLocaleString('id-ID')}</span>
            </div>
          )}
          <div className="flex justify-between font-black text-xs pt-1 border-t border-black border-dotted mt-1">
            <span>TOTAL</span>
            <span>Rp{order.total.toLocaleString('id-ID')}</span>
          </div>
        </div>

        <div className="border-b border-black border-dashed my-1.5" />

        {/* Info Pembayaran & Pengiriman */}
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
          {order.status === 'BELUM_LUNAS' && (
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

        {/* Footer Struk */}
        <div className="text-center mt-3 pt-1 border-t border-black border-dashed space-y-0.5">
          <div className="font-black uppercase text-[11px] tracking-tight">Terima Kasih</div>
          <div className="text-[9px] text-neutral-600 leading-tight">
            {storeSettings.footerMsg || 'Barang yang sudah dibeli tidak dapat ditukar/dikembalikan'}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: ${paperWidth} auto;
            margin: 0mm !important;
          }
          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            width: ${paperWidth} !important;
          }
          .no-print {
            display: none !important;
          }
          .thermal-receipt {
            border: none !important;
            box-shadow: none !important;
            width: ${paperWidth} !important;
            max-width: ${paperWidth} !important;
            margin: 0 !important;
            padding: ${paperWidth === '58mm' ? '2mm 1mm' : '3mm 2mm'} !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}
