'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AlertTriangle, Package, ChevronLeft, CheckCircle, Copy } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

import { sbGetDoc, sbUpdateDoc } from '@/lib/supabase-helpers';
type OrderItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
};

type Order = {
  id: string;
  orderId?: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  total: number;
  paymentMethod: string;
  status: 'MENUNGGU' | 'DIPROSES' | 'DIKIRIM' | 'SELESAI' | 'DIBATALKAN' | 'PENDING';
  createdAt: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  MENUNGGU: { label: 'Menunggu Konfirmasi', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  PENDING:  { label: 'Menunggu Konfirmasi', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  DIPROSES: { label: 'Sedang Diproses',     color: 'text-blue-700',  bg: 'bg-blue-50',  border: 'border-blue-200'  },
  DIKIRIM:  { label: 'Sedang Dikirim',      color: 'text-purple-700',bg: 'bg-purple-50',border: 'border-purple-200'},
  SELESAI:  { label: 'Selesai',             color: 'text-emerald-700',bg: 'bg-emerald-50',border: 'border-emerald-200'},
  DIBATALKAN:{ label: 'Dibatalkan',         color: 'text-rose-700',  bg: 'bg-rose-50',  border: 'border-rose-200'  },
};

export default function PublicOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchOrder = async () => {
      try {
        const docSnap = await sbGetDoc('orders', id);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setOrder({
            id: docSnap.id,
            orderId: data.orderId,
            customerName: data.name || data.customerName || 'Pelanggan',
            customerPhone: data.phone || data.customerPhone,
            customerAddress: data.delivery?.address || data.customerAddress,
            items: data.items || [],
            subtotal: data.subtotal || 0,
            shippingCost: data.shippingCost || 0,
            total: data.total || 0,
            paymentMethod: data.payment?.method || data.paymentMethod || 'CASH',
            status: data.status || 'MENUNGGU',
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
          });
        } else {
          setError('Pesanan tidak ditemukan.');
        }
      } catch (err) {
        console.error('Error fetching order:', err);
        setError('Gagal memuat pesanan.');
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id]);

  const handleCompleteOrder = async () => {
    if (!order) return;
    if (!confirm('Apakah Anda yakin pesanan sudah diterima?')) return;
    setUpdating(true);
    try {
      await sbUpdateDoc('orders', order.id, { status: 'SELESAI', updatedAt: new Date().toISOString() });
      setOrder(prev => prev ? { ...prev, status: 'SELESAI' } : null);
      toast.success('Pesanan berhasil diselesaikan!');
    } catch (err) {
      console.error(err);
      toast.error('Gagal menyelesaikan pesanan.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-emerald-600 border-t-transparent mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-500">Memuat rincian pesanan...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
        <div className="bg-white p-8 rounded-3xl shadow-sm max-w-md w-full text-center border border-slate-100">
          <AlertTriangle className="h-12 w-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-black text-slate-900 mb-2">Pesanan Tidak Ditemukan</h2>
          <p className="text-sm text-slate-500 mb-6">{error || 'ID pesanan tidak valid.'}</p>
          <Link href="/orders" className="inline-block bg-slate-900 text-white px-8 py-3.5 rounded-2xl font-bold text-sm hover:bg-emerald-600 transition-all">
            Kembali ke Pesanan
          </Link>
        </div>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG['MENUNGGU'];
  const isTransfer = ['transfer', 'TRANSFER'].includes(order.paymentMethod);
  const isPending = ['MENUNGGU', 'PENDING'].includes(order.status);

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md sticky top-0 z-50 border-b border-slate-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all text-slate-700" aria-label="Kembali">
            <ChevronLeft size={20} />
          </button>
          <div>
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Struk Digital</p>
            <h1 className="text-base font-black text-slate-900 leading-tight">Detail Pesanan</h1>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Order Identity Card */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 text-center">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">ID Pesanan</p>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-3">
            {order.orderId || `#${order.id.substring(0, 8).toUpperCase()}`}
          </h2>
          <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold border ${statusCfg.color} ${statusCfg.bg} ${statusCfg.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isPending ? 'animate-pulse bg-amber-500' : 'bg-current opacity-60'}`} />
            {statusCfg.label}
          </span>
        </div>

        {/* Info Grid */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Package size={14} className="text-emerald-600" /> Informasi Pesanan
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Tanggal Pesan', val: new Date(order.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) },
              { label: 'Metode Bayar', val: order.paymentMethod.toUpperCase() },
              { label: 'Penerima', val: order.customerName },
              { label: 'Alamat Kirim', val: order.customerAddress || 'Ambil di Toko' },
            ].map((info, i) => (
              <div key={i} className={i === 2 || i === 3 ? '' : ''}>
                <p className="text-xs font-bold text-slate-400 mb-0.5">{info.label}</p>
                <p className="text-sm font-bold text-slate-800 leading-snug">{info.val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Transfer Instructions */}
        {isTransfer && isPending && (
          <div className="bg-blue-50 border border-blue-200 rounded-3xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={16} className="text-blue-600 shrink-0" />
              <h3 className="text-sm font-bold text-blue-800">Instruksi Pembayaran Transfer</h3>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-blue-100 flex justify-between items-center mb-3">
              <div>
                <p className="text-xs font-bold text-slate-500 mb-0.5">Bank BRI</p>
                <p className="text-base font-black text-slate-900 tracking-wider">0123-01-000-456-789</p>
                <p className="text-xs text-slate-500 mt-0.5">a.n. ATAYA MANDIRI</p>
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText('012301000456789'); toast.success('No. rekening disalin!'); }}
                className="flex items-center gap-1.5 bg-blue-600 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold hover:bg-blue-700 active:scale-95 transition-all"
              >
                <Copy size={13} /> Salin
              </button>
            </div>
            <p className="text-xs text-blue-700 font-medium leading-relaxed text-center">
              Transfer tepat sesuai jumlah total bayar. Pesanan diproses otomatis setelah verifikasi.
            </p>
          </div>
        )}

        {/* Items List */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Daftar Produk</h3>
          <div className="space-y-3">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-start py-3 border-b border-slate-50 last:border-0">
                <div className="flex-1 pr-4">
                  <p className="text-sm font-bold text-slate-800 leading-snug">{item.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{item.quantity} × Rp{item.price.toLocaleString('id-ID')}</p>
                </div>
                <p className="text-sm font-black text-slate-900">Rp{(item.price * item.quantity).toLocaleString('id-ID')}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Total Card */}
        <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl">
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm font-medium text-slate-400">
              <span>Subtotal</span>
              <span>Rp{order.subtotal.toLocaleString('id-ID')}</span>
            </div>
            {order.shippingCost > 0 && (
              <div className="flex justify-between text-sm font-medium text-slate-400">
                <span>Ongkos Kirim</span>
                <span>Rp{order.shippingCost.toLocaleString('id-ID')}</span>
              </div>
            )}
          </div>
          <div className="flex justify-between items-center pt-4 border-t border-white/10">
            <span className="text-sm font-bold text-emerald-400 uppercase tracking-wider">Total Bayar</span>
            <span className="text-3xl font-black tracking-tight">Rp{order.total.toLocaleString('id-ID')}</span>
          </div>
        </div>

        {/* Complete Order Button */}
        {order.status === 'DIKIRIM' && (
          <button
            onClick={handleCompleteOrder}
            disabled={updating}
            className="w-full bg-emerald-600 text-white py-4 rounded-2xl text-sm font-black uppercase tracking-wider shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {updating ? 'Memproses...' : <><CheckCircle size={18} /> Konfirmasi Pesanan Diterima</>}
          </button>
        )}

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-xs text-slate-400 mb-3">— Terima kasih telah berbelanja di Ataya Toko —</p>
          <Link href="/" className="text-sm font-bold text-emerald-600 hover:text-emerald-700 underline underline-offset-2">
            Belanja Lagi
          </Link>
        </div>
      </div>
    </div>
  );
}
