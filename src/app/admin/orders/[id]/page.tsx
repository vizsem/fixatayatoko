'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { 
  AlertTriangle, Package, MapPin, Calendar, CreditCard, 
  User, Printer, ArrowLeft, CheckCircle, Truck, Phone 
} from 'lucide-react';
import Link from 'next/link';

// Dynamically import OrderMap to avoid SSR issues
import dynamic from 'next/dynamic';
const OrderMap = dynamic(() => import('@/components/OrderMap'), { ssr: false });

type DeliveryLocation = {
  lat: number;
  lng: number;
};

type Order = {
  id: string;
  customerName: string;
  customerPhone: string;
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  status: 'MENUNGGU' | 'DIPROSES' | 'DIKIRIM' | 'SELESAI' | 'DIBATALKAN';
  paymentMethod: string;
  deliveryMethod: 'AMBIL_DI_TOKO' | 'KURIR_TOKO' | 'OJOL';
  deliveryAddress?: string;
  deliveryLocation?: DeliveryLocation;
  createdAt: any;
  notes?: string;
};

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // 1. Cek Auth & Role (Admin/Cashier)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.push('/profil/login');

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const role = userDoc.data()?.role;

      if (role !== 'admin' && role !== 'cashier') {
        alert('Akses ditolak!');
        router.push('/profil');
        return;
      }
      setAuthChecked(true);
    });
    return () => unsubscribe();
  }, [router]);

  // 2. Ambil Data Pesanan
  useEffect(() => {
    if (!authChecked || !id) return;

    const fetchOrder = async () => {
      try {
        const docRef = doc(db, 'orders', id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          setError('Pesanan tidak ditemukan.');
          return;
        }

        const data = docSnap.data();
        setOrder({ id: docSnap.id, ...data } as Order);
      } catch (err) {
        setError('Terjadi kesalahan saat memuat data.');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [id, authChecked]);

  // 3. Fungsi Ubah Status Langsung
  const updateStatus = async (newStatus: string) => {
    if (!order) return;
    try {
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, { status: newStatus });
      setOrder({ ...order, status: newStatus as any });
      alert(`Status diperbarui ke ${newStatus}`);
    } catch (err) {
      alert('Gagal memperbarui status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'MENUNGGU': return 'bg-red-500 text-white';
      case 'DIPROSES': return 'bg-amber-500 text-white';
      case 'DIKIRIM': return 'bg-blue-500 text-white';
      case 'SELESAI': return 'bg-emerald-500 text-white';
      default: return 'bg-gray-400 text-white';
    }
  };

  if (loading || !authChecked) return (
    <div className="min-h-screen flex items-center justify-center font-black uppercase tracking-widest text-gray-400 animate-pulse">
      Memuat Invoice...
    </div>
  );

  if (error || !order) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <AlertTriangle size={48} className="text-red-500 mb-4" />
      <p className="font-black uppercase">{error || 'Data Kosong'}</p>
      <button onClick={() => router.back()} className="mt-4 text-xs font-black underline">KEMBALI</button>
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto bg-white min-h-screen shadow-2xl">
      
      {/* Tombol Navigasi & Cetak (Sembunyi saat diprint) */}
      <div className="flex justify-between items-center mb-10 no-print">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-[10px] font-black uppercase bg-gray-100 px-4 py-2 rounded-xl hover:bg-black hover:text-white transition-all">
          <ArrowLeft size={14} /> Kembali
        </button>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="flex items-center gap-2 text-[10px] font-black uppercase bg-black text-white px-5 py-2 rounded-xl shadow-lg hover:bg-emerald-600 transition-all">
            <Printer size={14} /> Cetak Nota
          </button>
        </div>
      </div>

      {/* HEADER INVOICE */}
      <div className="border-b-4 border-black pb-8 mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-5xl font-black tracking-tighter italic">ATAYA TOKO</h1>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-1">Nota Penjualan Digital</p>
        </div>
        <div className="text-right">
          <div className={`inline-block px-3 py-1 rounded-lg text-[10px] font-black uppercase mb-3 ${getStatusColor(order.status)}`}>
            {order.status}
          </div>
          <p className="text-sm font-black uppercase">ORD-#{order.id.substring(0, 8)}</p>
          <p className="text-[10px] font-bold text-gray-400 uppercase">
            {order.createdAt?.toDate ? new Date(order.createdAt.toDate()).toLocaleString('id-ID') : '-'}
          </p>
        </div>
      </div>

      {/* INFO PELANGGAN & PENGIRIMAN */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
        <div className="space-y-4">
          <div>
            <h3 className="text-[10px] font-black text-gray-400 uppercase mb-2 flex items-center gap-2">
              <User size={12}/> Pelanggan
            </h3>
            <p className="text-lg font-black uppercase leading-none">{order.customerName}</p>
            <p className="text-sm font-bold text-gray-600 mt-1 flex items-center gap-2">
              <Phone size={12}/> {order.customerPhone}
            </p>
          </div>
          {order.notes && (
            <div className="bg-gray-50 p-3 rounded-xl border-l-4 border-black">
              <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Catatan:</p>
              <p className="text-xs font-bold italic">"{order.notes}"</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-[10px] font-black text-gray-400 uppercase mb-2 flex items-center gap-2">
              <Truck size={12}/> Pengiriman & Pembayaran
            </h3>
            <div className="flex gap-2 mb-2">
               <span className="bg-black text-white text-[9px] font-black px-3 py-1 rounded-md uppercase">{order.deliveryMethod.replace('_', ' ')}</span>
               <span className="bg-emerald-100 text-emerald-700 text-[9px] font-black px-3 py-1 rounded-md uppercase">{order.paymentMethod}</span>
            </div>
            {order.deliveryAddress && (
              <p className="text-xs font-bold text-gray-600 leading-relaxed uppercase">
                <MapPin size={10} className="inline mr-1"/> {order.deliveryAddress}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* PETA LOKASI */}
      {order.deliveryLocation && (
        <div className="mb-10 rounded-3xl overflow-hidden border-2 border-gray-100 shadow-inner no-print">
          <OrderMap
            lat={order.deliveryLocation.lat}
            lng={order.deliveryLocation.lng}
            address={order.deliveryAddress || ''}
          />
        </div>
      )}

      {/* DAFTAR ITEM */}
      <div className="mb-10">
        <h3 className="text-[10px] font-black text-gray-400 uppercase mb-4 flex items-center gap-2">
          <Package size={14}/> Rincian Pesanan
        </h3>
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-black text-[10px] font-black uppercase text-gray-400">
              <th className="py-3 text-left">Nama Produk</th>
              <th className="py-3 text-center">Jumlah</th>
              <th className="py-3 text-right">Harga Satuan</th>
              <th className="py-3 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {order.items.map((item, idx) => (
              <tr key={idx} className="text-xs font-black uppercase">
                <td className="py-5">{item.name}</td>
                <td className="py-5 text-center">{item.quantity}</td>
                <td className="py-5 text-right text-gray-400">Rp {item.price.toLocaleString()}</td>
                <td className="py-5 text-right">Rp {(item.quantity * item.price).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-4 border-black">
              <td colSpan={3} className="py-6 text-xl font-black uppercase">Total Tagihan</td>
              <td className="py-6 text-2xl font-black text-right text-emerald-600 italic">Rp {order.total.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* FOOTER NOTA */}
      <div className="text-center border-2 border-dashed border-gray-200 p-8 rounded-[2rem] mt-10">
        <CheckCircle size={32} className="mx-auto mb-3 text-emerald-500" />
        <p className="font-black uppercase text-sm">Pesanan Valid & Terverifikasi</p>
        <p className="text-[9px] text-gray-400 font-bold uppercase mt-1 tracking-widest">Ataya Toko - Terima Kasih Atas Kepercayaan Anda</p>
      </div>

      {/* PANEL KONTROL STATUS (Hanya Muncul di Layar, Sembunyi saat Print) */}
      <div className="mt-12 p-6 bg-gray-900 rounded-[2rem] text-white no-print">
         <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 text-center opacity-50">Panel Kontrol Staff</p>
         <div className="flex flex-wrap justify-center gap-2">
            <button onClick={() => updateStatus('DIPROSES')} className="px-5 py-3 rounded-xl bg-amber-500 text-[10px] font-black uppercase hover:scale-105 transition-all">Proses Pesanan</button>
            <button onClick={() => updateStatus('DIKIRIM')} className="px-5 py-3 rounded-xl bg-blue-500 text-[10px] font-black uppercase hover:scale-105 transition-all">Kirim Barang</button>
            <button onClick={() => updateStatus('SELESAI')} className="px-5 py-3 rounded-xl bg-emerald-500 text-[10px] font-black uppercase hover:scale-105 transition-all">Selesaikan</button>
            <button onClick={() => updateStatus('DIBATALKAN')} className="px-5 py-3 rounded-xl bg-red-600 text-[10px] font-black uppercase hover:scale-105 transition-all">Batalkan</button>
         </div>
      </div>
      
      {/* CSS KHUSUS PRINT */}
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0; padding: 0; }
          .max-w-4xl { max-width: 100% !important; border: none !important; box-shadow: none !important; padding: 0 !important; }
        }
      `}</style>

    </div>
  );
}