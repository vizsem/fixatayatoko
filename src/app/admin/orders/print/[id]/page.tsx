'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Timestamp, doc, getDoc } from 'firebase/firestore';

import { ArrowLeft, Printer } from 'lucide-react';

type Order = {
  id: string;
  customerName: string;
  customerPhone: string;
  items: Array<{ productId: string; name: string; quantity: number; price: number; }>;
  total: number;
  status: string;
  paymentMethod: string;
  deliveryMethod: string;
  deliveryAddress?: string;
  createdAt: Timestamp | null;
};


export default function PrintOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push('/profil/login'); return; }
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.data()?.role !== 'admin' && userDoc.data()?.role !== 'cashier') {
        router.push('/profil'); return;
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
        if (docSnap.exists()) {
          setOrder({ id: docSnap.id, ...docSnap.data() } as Order);
          setTimeout(() => { window.print(); }, 800);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id, authChecked]);

  if (loading || !authChecked) return <div className="p-10 text-center font-black uppercase text-slate-400 animate-pulse tracking-widest">Generating Invoice...</div>;
  if (!order) return <div className="p-10 text-center font-black text-red-500 uppercase">Data Kosong</div>;

  return (
    <div className="bg-white min-h-screen text-black font-mono p-2 sm:p-0">
      <div className="max-w-4xl mx-auto p-4 no-print">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-3 bg-white rounded-2xl shadow-sm hover:bg-black hover:text-white transition-all">
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="p-3 bg-black text-white rounded-2xl inline-flex">
                <Printer size={22} />
              </div>
              <h1 className="text-2xl font-black uppercase tracking-tighter">Print Invoice</h1>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Struk thermal siap cetak</p>
            </div>
          </div>
          <button onClick={() => typeof window !== 'undefined' && window.print()} className="bg-black text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
            <Printer size={16} /> Cetak
          </button>
        </div>
      </div>
      {/* Container Khusus Printer Thermal (Lebar Maksimal 80mm biasanya) */}
      <div className="max-w-[400px] mx-auto p-4 border border-dashed border-gray-200">

        {/* Header Struk */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black tracking-tighter uppercase italic">Ataya Toko</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest">Official Store Invoice</p>
          <div className="border-b border-black border-double my-2"></div>
        </div>

        {/* Info Order */}
        <div className="text-[11px] space-y-1 mb-4">
          <div className="flex justify-between">
            <span>NO:</span>
            <span className="font-black">#ORD-{order.id.substring(0, 8).toUpperCase()}</span>
          </div>
          <div className="flex justify-between">
            <span>TGL:</span>
            <span>{order.createdAt?.toDate ? new Date(order.createdAt.toDate()).toLocaleString('id-ID') : '-'}</span>
          </div>
          <div className="flex justify-between uppercase">
            <span>PLG:</span>
            <span className="font-black">{order.customerName}</span>
          </div>
        </div>

        <div className="border-b border-black border-dashed my-4"></div>

        {/* Tabel Barang */}
        <div className="space-y-3 mb-4">
          {order.items?.map((item, idx) => (
            <div key={idx} className="text-[11px]">
              <div className="uppercase font-black">{item.name}</div>
              <div className="flex justify-between">
                <span>{item.quantity} x {item.price.toLocaleString()}</span>
                <span className="font-bold">{(item.quantity * item.price).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="border-b border-black border-dashed my-4"></div>

        {/* Total & Metode */}
        <div className="space-y-1 text-[11px]">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>Rp{(order.total - (order.deliveryAddress ? 0 : 0)).toLocaleString()}</span> 
          </div>
          {/* Note: Logic ongkir perlu disesuaikan jika field shippingCost tersedia */}
          <div className="flex justify-between">
            <span>Total:</span>
            <span className="font-black">Rp{order.total.toLocaleString()}</span>
          </div>
          {order.status === 'BELUM_LUNAS' && (
             <div className="mt-2 text-center border border-black p-1">
               <span className="font-black uppercase">BELUM LUNAS (TEMPO)</span>
             </div>
          )}
          <div className="flex justify-between uppercase text-[10px]">
            <span>BAYAR:</span>
            <span>{order.paymentMethod || '-'}</span>
          </div>
          <div className="flex justify-between uppercase text-[10px]">
            <span>KURIR:</span>
            {/* Perbaikan Error: Optional Chaining digunakan di sini */}
            <span>{order.deliveryMethod?.replace('_', ' ') || '-'}</span>
          </div>
        </div>

        {/* Alamat Jika Ada */}
        {order.deliveryAddress && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-[9px] font-bold uppercase text-gray-400 mb-1">Alamat:</p>
            <p className="text-[10px] leading-tight uppercase italic">{order.deliveryAddress}</p>
          </div>
        )}

        {/* Footer Struk */}
        <div className="text-center mt-10 space-y-1">
          <div className="border-b border-black border-double mb-2"></div>
          <p className="text-[10px] font-black uppercase italic tracking-tighter">Terima Kasih</p>
          <p className="text-[8px] font-bold text-gray-400">Barang yang sudah dibeli tidak dapat ditukar</p>
        </div>
      </div>

      {/* Kontrol Navigasi (Hanya muncul di Layar) */}
      <div className="fixed bottom-6 right-6 no-print">
        <button
          onClick={() => router.back()}
          className="bg-black text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-2xl hover:bg-emerald-600 transition-all"
        >
          Kembali
        </button>
      </div>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; padding: 0 !important; margin: 0 !important; }
          .max-w-[400px] { border: none !important; width: 100% !important; max-width: 100% !important; }
          @page { margin: 0; }
        }
      `}</style>
    </div>
  );
}
