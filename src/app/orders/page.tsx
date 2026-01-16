'use client';

import { useState, useEffect } from 'react';
import { 
  ShoppingBag, Clock, ChevronRight, Package, 
  Truck, CheckCircle2, AlertCircle, Loader2, 
  HomeIcon,
  LayoutGrid,
  ReceiptText,
  User
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';

export default function UserOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const fetchUserOrders = async () => {
      // Ambil ID User dari localStorage (sama dengan yang dipakai di Cart)
      const userId = localStorage.getItem('temp_user_id');
      
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        const q = query(
          collection(db, 'orders'),
          where('userId', '==', userId), // Filter hanya milik user ini
          orderBy('createdAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        const ordersList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt)
        }));
        
        setOrders(ordersList);
      } catch (error) {
        console.error('Error fetching user orders:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserOrders();
  }, []);

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'MENUNGGU': 
        return { label: 'Menunggu Konfirmasi', color: 'text-red-500', bg: 'bg-red-50', icon: Clock };
      case 'DIPROSES': 
        return { label: 'Sedang Disiapkan', color: 'text-yellow-600', bg: 'bg-yellow-50', icon: Package };
      case 'DIKIRIM': 
        return { label: 'Dalam Perjalanan', color: 'text-blue-600', bg: 'bg-blue-50', icon: Truck };
      case 'SELESAI': 
        return { label: 'Pesanan Selesai', color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle2 };
      default: 
        return { label: status, color: 'text-gray-500', bg: 'bg-gray-50', icon: AlertCircle };
    }
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <Loader2 className="animate-spin text-green-600 mb-4" size={32} />
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Memuat Pesanan Anda...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* HEADER */}
      <div className="bg-white px-6 py-8 border-b border-gray-100">
        <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">Pesanan Saya</h1>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Riwayat transaksi Atayatoko</p>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {orders.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-gray-200">
            <ShoppingBag className="mx-auto text-gray-200 mb-4" size={60} />
            <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Belum ada pesanan</p>
            <Link href="/" className="text-green-600 text-[10px] font-black uppercase mt-4 block underline">Mulai Belanja</Link>
          </div>
        ) : (
          orders.map((order) => {
            const status = getStatusInfo(order.status);
            return (
              <div 
                key={order.id} 
                className="bg-white rounded-[2rem] p-5 shadow-sm border border-gray-100 active:scale-[0.98] transition-all"
                onClick={() => router.push(`/transaksi/${order.id}`)}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${status.bg} ${status.color}`}>
                      <status.icon size={20} />
                    </div>
                    <div>
                      <span className={`text-[10px] font-black uppercase tracking-wider ${status.color}`}>
                        {status.label}
                      </span>
                      <p className="text-[10px] text-gray-400 font-bold">
                        {order.createdAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-gray-300" />
                </div>

                <div className="border-t border-dashed border-gray-100 pt-4 flex justify-between items-end">
                  <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Total Pembayaran</p>
                    <p className="text-lg font-black text-gray-900 tracking-tighter">
                      Rp{order.total?.toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-gray-400 uppercase mb-1 tracking-tighter">ID: #{order.id.substring(0,8)}</p>
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md uppercase">
                      {order.items?.length || 0} Produk
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Tetap sertakan MobileNav Anda di sini jika tidak diletakkan di layout.tsx */}
      {/* 2. BOTTOM NAVIGATION BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[100] px-4 pb-6 pt-2 bg-gradient-to-t from-white via-white/80 to-transparent">
        <div className="bg-gray-900 rounded-[2.5rem] shadow-2xl border border-white/10 p-2 flex items-center justify-between backdrop-blur-xl">
          {[
            { name: 'Home', icon: HomeIcon, path: '/' }, // Gunakan HomeIcon disini
            { name: 'Kategori', icon: LayoutGrid, path: '/semua-kategori' },
            { name: 'Pesanan', icon: ReceiptText, path: '/orders' },
            { name: 'Profil', icon: User, path: '/profil' },
          ].map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link key={item.name} href={item.path} className={`flex flex-col items-center justify-center py-2 px-5 rounded-full transition-all duration-300 ${isActive ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                <item.icon size={20} strokeWidth={isActive ? 3 : 2} />
                <span className={`text-[8px] font-black uppercase mt-1 tracking-widest ${isActive ? 'block' : 'hidden'}`}>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}