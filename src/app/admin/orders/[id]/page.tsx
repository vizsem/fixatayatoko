'use client';

import { useEffect, useState, use } from 'react';

import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Timestamp, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import {
  MapPin, CreditCard,
  Printer, ArrowLeft, Truck, MessageSquare, Receipt
} from 'lucide-react';

import toast, { Toaster } from 'react-hot-toast';
import dynamic from 'next/dynamic';

const OrderMap = dynamic(() => import('@/components/OrderMap'), { ssr: false });

type DeliveryLocation = { lat: number; lng: number; };
type OrderStatus = 'MENUNGGU' | 'DIPROSES' | 'DIKIRIM' | 'SELESAI' | 'DIBATALKAN' | 'BELUM_LUNAS';

type Order = {
  id: string;
  orderId?: string; // Menambahkan support untuk ID cantik (ATY-XXXX)
  customerName: string;
  customerPhone: string;
  items: Array<{ productId: string; name: string; quantity: number; price: number; }>;
  total: number;
  subtotal: number;
  shippingCost: number;
  status: OrderStatus;
  paymentMethod: string;
  deliveryMethod: string;
  deliveryAddress?: string;
  deliveryLocation?: DeliveryLocation;
  createdAt: Timestamp | null;
  notes?: string;
  dueDate?: string; // Support Tempo
};

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/profil/login');
        return;
      }
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.data()?.role !== 'admin' && userDoc.data()?.role !== 'cashier') {
        router.push('/profil');
        return;
      }
      setAuthChecked(true);
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!authChecked || !id) return;
    const fetchOrder = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'orders', id));
        if (!docSnap.exists()) {
          setError('Pesanan tidak ditemukan.');
          return;
        }
        setOrder({ id: docSnap.id, ...docSnap.data() } as Order);

      } catch {
        console.error("Gagal bayar hutang");
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id, authChecked]);

  // Fungsi Print yang aman untuk Next.js Client Component
  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const updateStatus = async (newStatus: OrderStatus) => {
    if (!order || isUpdating) return;
    setIsUpdating(true);
    try {
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      setOrder(prev => prev ? { ...prev, status: newStatus } : null);
      toast.success(`Status: ${newStatus}`, { icon: '🚀' });
    } catch {
      toast.error('Gagal memperbarui status');

    } finally {
      setIsUpdating(false);
    }
  };

  const sendWhatsApp = () => {
    if (!order) return;
    const phone = order.customerPhone.startsWith('0') ? '62' + order.customerPhone.slice(1) : order.customerPhone;
    const message = `Halo ${order.customerName}, pesanan Anda *#${order.id.substring(0, 8)}* sedang dalam status: *${order.status}*.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'MENUNGGU': return 'bg-rose-500 text-white';
      case 'DIPROSES': return 'bg-amber-500 text-white';
      case 'DIKIRIM': return 'bg-indigo-500 text-white';
      case 'SELESAI': return 'bg-emerald-500 text-white';
      default: return 'bg-slate-400 text-white';
    }
  };

  if (loading || !authChecked) return <div className="p-20 text-center font-black uppercase text-slate-400 animate-pulse">Syncing...</div>;
  if (error || !order) return <div className="p-20 text-center font-black uppercase text-red-500 tracking-tighter italic">{error || 'Data Kosong'}</div>;

  return (
    <div className="min-h-screen bg-gray-50 md:p-8 pb-24 text-black font-sans">
      <Toaster position="top-right" />
      <div className="max-w-4xl mx-auto bg-white shadow-2xl md:rounded-[3rem] overflow-hidden border border-white">

        <div className="p-6 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-3 bg-white rounded-2xl shadow-sm hover:bg-black hover:text-white transition-all">
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="p-3 bg-black text-white rounded-2xl inline-flex">
                <Receipt size={22} />
              </div>
              <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter">Detail Pesanan</h1>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Kelola status dan cetak invoice</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={sendWhatsApp} className="flex items-center gap-2 text-[10px] font-black uppercase bg-green-600 text-white px-5 py-3 rounded-2xl shadow-lg hover:bg-green-700 transition-all">
              <MessageSquare size={14} /> WhatsApp
            </button>
            <button onClick={handlePrint} className="flex items-center gap-2 text-[10px] font-black uppercase bg-black text-white px-5 py-3 rounded-2xl shadow-lg hover:bg-slate-800 transition-all">
              <Printer size={14} /> Cetak
            </button>
          </div>
        </div>

        <div className="p-8 md:p-12">
          <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-12 border-b-2 border-slate-100 pb-12">
            <div>
              <h1 className="text-6xl font-black tracking-tighter italic mb-2">INVOICE.</h1>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-green-600">Ataya Toko Official</p>
            </div>
            <div className="text-left md:text-right">
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase mb-4 shadow-sm ${getStatusColor(order?.status || 'MENUNGGU')}`}>
                <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                {order?.status}
              </div>
              <p className="text-xl font-black tracking-tight text-slate-800">#ORD-{order?.id?.substring(0, 12).toUpperCase()}</p>
              <p className="text-xs font-bold text-slate-400 uppercase">
                {order?.createdAt?.toDate ? new Date(order.createdAt.toDate()).toLocaleDateString('id-ID') : '-'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Pelanggan</h4>
              <div className="p-6 bg-slate-50 rounded-[2rem]">
                <p className="text-2xl font-black uppercase">{order?.customerName}</p>
                <p className="text-sm font-bold text-slate-500 mt-1">{order?.customerPhone}</p>
                {order?.deliveryAddress && (
                  <p className="mt-4 text-xs font-bold text-slate-400 uppercase italic leading-relaxed">
                    <MapPin size={12} className="inline mr-1" /> {order.deliveryAddress}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Metode</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 bg-indigo-50 rounded-3xl text-indigo-700">
                  <Truck size={20} className="mb-2" />
                  <p className="text-[9px] font-black uppercase opacity-60">Kurir</p>
                  <p className="text-xs font-black uppercase">{order?.deliveryMethod?.replace('_', ' ')}</p>
                </div>
                <div>
                  <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Status Pembayaran</h3>
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${order.status === 'SELESAI' ? 'bg-green-100 text-green-700' : order.status === 'BELUM_LUNAS' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-700'}`}>
                    <CreditCard size={12}/> {order.paymentMethod} • {order.status === 'BELUM_LUNAS' ? 'BELUM LUNAS' : order.status === 'SELESAI' ? 'LUNAS' : order.status}
                  </div>
                  {order.dueDate && order.status === 'BELUM_LUNAS' && (
                    <p className="mt-2 text-[10px] font-bold text-red-500 uppercase">Jatuh Tempo: {new Date(order.dueDate).toLocaleDateString('id-ID')}</p>
                  )}
                </div>

                {order.status === 'BELUM_LUNAS' && (
                  <button 
                    onClick={() => updateStatus('SELESAI')}
                    disabled={isUpdating}
                    className="mt-2 w-full bg-green-600 text-white py-2 rounded-xl text-[10px] font-black uppercase hover:bg-green-700 transition-all shadow-lg shadow-green-200"
                  >
                    {isUpdating ? 'Memproses...' : 'Tandai Lunas'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {order?.deliveryLocation && (
            <div className="mb-12 rounded-[2.5rem] overflow-hidden border-4 border-slate-50 h-[250px] no-print">
              <OrderMap lat={order.deliveryLocation.lat} lng={order.deliveryLocation.lng} address={order.deliveryAddress || ''} />
            </div>
          )}

          <div className="mb-12">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-black uppercase text-slate-400 border-b">
                  <th className="pb-4 text-left">Item</th>
                  <th className="pb-4 text-center">Qty</th>
                  <th className="pb-4 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {order?.items?.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-6 font-black text-sm uppercase">{item.name}</td>
                    <td className="py-6 text-center font-bold text-slate-400">x{item.quantity}</td>
                    <td className="py-6 text-right font-black">Rp {(item.quantity * item.price).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="pt-4">
                    <div className="ml-auto max-w-xs border-t border-slate-100 pt-4 space-y-2">
                      <div className="flex justify-between text-[11px] font-bold text-slate-500">
                        <span>Subtotal Produk</span>
                        <span>Rp{order?.subtotal?.toLocaleString() || (order.total - (order.shippingCost || 0)).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-[11px] font-bold text-slate-500">
                        <span>Ongkos Kirim</span>
                        <span>Rp{order?.shippingCost?.toLocaleString() || 0}</span>
                      </div>
                      <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-100 border-dashed">
                        <span>Total Pembayaran</span>
                        <span>Rp{order?.total?.toLocaleString()}</span>
                      </div>
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-2xl bg-black/90 backdrop-blur-xl p-4 rounded-[2.5rem] shadow-2xl z-[100] no-print">
        <div className="flex gap-2 overflow-x-auto no-scrollbar justify-center">
          <button onClick={() => updateStatus('DIPROSES')} className="px-6 py-3 rounded-2xl bg-amber-500 text-[10px] font-black uppercase text-white hover:scale-105 transition-all">Proses</button>
          <button onClick={() => updateStatus('DIKIRIM')} className="px-6 py-3 rounded-2xl bg-blue-500 text-[10px] font-black uppercase text-white hover:scale-105 transition-all">Kirim</button>
          <button onClick={() => updateStatus('SELESAI')} className="px-6 py-3 rounded-2xl bg-emerald-500 text-[10px] font-black uppercase text-white hover:scale-105 transition-all">Selesai</button>
          <button onClick={() => updateStatus('DIBATALKAN')} className="px-6 py-3 rounded-2xl bg-rose-600 text-[10px] font-black uppercase text-white hover:scale-105 transition-all">Batal</button>
        </div>
      </div>

      <style jsx global>{`
        @media print { 
          .no-print { display: none !important; } 
          body { background: white !important; }
          /* Menghilangkan bayangan dan border saat print agar bersih */
          .shadow-2xl { shadow: none !important; box-shadow: none !important; }
          .border { border: none !important; }
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
