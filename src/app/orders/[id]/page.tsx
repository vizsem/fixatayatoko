'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AlertTriangle, Package, ChevronLeft, CheckCircle } from 'lucide-react'; // Tambah ChevronLeft
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast'; // Pastikan Toaster ada di layout atau tambahkan disini

type OrderItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
};

type Order = {
  id: string;
  orderId?: string; // Tambahkan field orderId
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  total: number;
  paymentMethod: string;
  status: 'MENUNGGU' | 'DIPROSES' | 'DIKIRIM' | 'SELESAI' | 'DIBATALKAN' | 'PENDING'; // Tambah PENDING
  createdAt: string;
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
        const docSnap = await getDoc(doc(db, 'orders', id));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setOrder({
            id: docSnap.id,
            orderId: data.orderId, // Ambil orderId cantik (ATY-XXXX) dari Firestore
            customerName: data.name || data.customerName || 'Pelanggan', // Sesuaikan dengan field 'name' di checkout
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
    if (!confirm('Apakah Anda yakin pesanan sudah diterima dan ingin menyelesaikannya?')) return;

    setUpdating(true);
    try {
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, {
        status: 'SELESAI',
        updatedAt: Timestamp.now()
      });
      
      setOrder(prev => prev ? { ...prev, status: 'SELESAI' } : null);
      toast.success('Pesanan berhasil diselesaikan!');
    } catch (err) {
      console.error('Error completing order:', err);
      toast.error('Gagal menyelesaikan pesanan.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Memuat rincian...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="bg-white p-8 rounded-[2rem] shadow-sm max-w-md w-full text-center border border-gray-100">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-black text-black mb-2 uppercase italic">Oops!</h2>
          <p className="text-xs font-bold text-gray-400 mb-6 uppercase tracking-wider">{error || 'ID pesanan tidak valid.'}</p>
          <Link
            href="/orders"
            className="inline-block bg-black text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-green-600 transition-all"
          >
            Kembali ke Pesanan
          </Link>
        </div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    MENUNGGU: 'text-rose-600 bg-rose-50',
    PENDING: 'text-rose-600 bg-rose-50',
    DIPROSES: 'text-amber-600 bg-amber-50',
    DIKIRIM: 'text-blue-600 bg-blue-50',
    SELESAI: 'text-green-600 bg-green-50',
    DIBATALKAN: 'text-gray-500 bg-gray-100',
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 pb-20 font-sans">
      <div className="max-w-2xl mx-auto">
        {/* Header Navigation */}
        <button onClick={() => router.back()} className="mb-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-green-600 transition-colors">
            <ChevronLeft size={16} /> Kembali
        </button>

        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-8">
            {/* Order Identity */}
            <div className="text-center mb-10">
                <p className="text-[10px] font-black text-green-600 uppercase tracking-[0.3em] mb-2">Struk Digital Ataya</p>
                <h1 className="text-4xl font-black text-gray-900 tracking-tighter italic">
                    {order.orderId || `#${order.id.substring(0, 8)}`}
                </h1>
                <div className="flex justify-center mt-4">
                    <span className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${statusColors[order.status]}`}>
                        {order.status}
                    </span>
                </div>
            </div>

            {/* Info Section */}
            <div className="grid grid-cols-2 gap-6 mb-10 border-y border-dashed border-slate-100 py-8">
                <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Dipesan Pada</p>
                    <p className="text-xs font-bold text-slate-800">{new Date(order.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
                <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Metode Bayar</p>
                    <p className="text-xs font-bold text-slate-800 uppercase italic">{order.paymentMethod}</p>
                </div>
                <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Penerima</p>
                    <p className="text-xs font-bold text-slate-800 uppercase">{order.customerName}</p>
                </div>
                <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Pengiriman</p>
                    <p className="text-xs font-bold text-slate-800 uppercase italic truncate">{order.customerAddress || 'Ambil di Toko'}</p>
                </div>
            </div>

            {/* Payment Instructions (If Transfer) */}
            {(order.paymentMethod === 'transfer' || order.paymentMethod === 'TRANSFER') && (order.status === 'MENUNGGU' || order.status === 'PENDING') && (
               <div className="mb-10 bg-blue-50 border border-blue-100 rounded-[2rem] p-6">
                  <div className="flex items-center gap-2 mb-4">
                     <AlertTriangle size={16} className="text-blue-600" />
                     <h3 className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Instruksi Pembayaran</h3>
                  </div>
                  <div className="space-y-4">
                     <div className="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm">
                        <div>
                           <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Bank BRI</p>
                           <p className="text-sm font-black text-slate-800 tracking-wider">0123-01-000-456-789</p>
                           <p className="text-[9px] font-bold text-slate-400 uppercase">a.n ATAYA MANDIRI</p>
                        </div>
                        <button 
                           onClick={() => {
                              navigator.clipboard.writeText('012301000456789');
                              toast.success('No. Rekening berhasil disalin');
                           }}
                           className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-blue-200 active:scale-95 transition-all"
                        >
                           Salin
                        </button>
                     </div>
                     <p className="text-[9px] font-bold text-blue-600/70 uppercase leading-relaxed text-center px-4">
                        Harap lakukan transfer tepat sesuai nominal total bayar. Pesanan akan diproses otomatis setelah verifikasi.
                     </p>
                  </div>
               </div>
            )}

            {/* Produk List */}
            <div className="mb-10">
                <h2 className="text-[10px] font-black text-slate-900 mb-4 flex items-center gap-2 uppercase tracking-widest">
                    <Package size={16} className="text-green-600" /> Item Detail
                </h2>
                <div className="space-y-4">
                    {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-50">
                            <div className="flex flex-col">
                                <span className="text-[11px] font-black text-slate-800 uppercase italic">{item.name}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">{item.quantity} x Rp{item.price.toLocaleString('id-ID')}</span>
                            </div>
                            <span className="text-xs font-black text-slate-900">Rp{(item.price * item.quantity).toLocaleString('id-ID')}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Total Section */}
            <div className="space-y-3 bg-slate-900 text-white p-8 rounded-[2rem] shadow-xl shadow-slate-200">
                <div className="flex justify-between text-[10px] font-black uppercase opacity-60 tracking-widest">
                    <span>Subtotal</span>
                    <span>Rp{order.subtotal.toLocaleString('id-ID')}</span>
                </div>
                {order.shippingCost > 0 && (
                    <div className="flex justify-between text-[10px] font-black uppercase opacity-60 tracking-widest">
                        <span>Biaya Ongkir</span>
                        <span>Rp{order.shippingCost.toLocaleString('id-ID')}</span>
                    </div>
                )}
                <div className="flex justify-between items-end pt-4 border-t border-white/10">
                    <span className="text-xs font-black uppercase tracking-[0.2em] italic text-green-400">Total Bayar</span>
                    <span className="text-3xl font-black italic tracking-tighter">Rp{order.total.toLocaleString('id-ID')}</span>
                </div>
            </div>

            {/* Complete Order Button (Only for DIKIRIM status) */}
            {order.status === 'DIKIRIM' && (
              <button
                onClick={handleCompleteOrder}
                disabled={updating}
                className="w-full mt-6 bg-green-600 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-green-200 hover:bg-green-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updating ? 'Memproses...' : (
                  <>
                    <CheckCircle size={18} />
                    Pesanan Diterima
                  </>
                )}
              </button>
            )}

            <div className="mt-10 text-center">
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em] mb-4">--- Terima Kasih Telah Berbelanja ---</p>
                <Link href="/" className="inline-block text-[10px] font-black text-green-600 uppercase border-b-2 border-green-600 pb-1 hover:text-green-700">Kembali Belanja</Link>
            </div>
        </div>
      </div>
    </div>
  );
}