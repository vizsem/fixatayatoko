'use client';

import { useState, useEffect } from 'react';
import {
  ShoppingBag, Clock, ChevronRight, Package,
  Truck, CheckCircle2, AlertCircle,
  HomeIcon, LayoutGrid, ReceiptText, User,
  Coins, Ticket
} from 'lucide-react';
import { collection, getDocs, query, where, orderBy, limit, startAfter } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { EmptyState, SkeletonList } from '@/components/UIState';

type FirebaseOrder = {
  status?: string;
  createdAt?: { toDate: () => Date } | string;
  items?: { name?: string; quantity?: number }[];
  pointsUsed?: number;
  voucherDiscount?: number;
  voucherUsed?: boolean;
  total?: number;
  orderId?: string;
  payment?: {
    method?: string;
  };
};

type UserOrder = {
  id: string;
  status: string;
  createdAt: Date;
  items: { name: string; quantity: number }[];
  pointsUsed: number;
  voucherDiscount: number;
  voucherUsed: boolean;
  total: number;
  orderId?: string;
  payment?: {
    method?: string;
  };
};

export default function UserOrdersPage() {
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<import('firebase/firestore').QueryDocumentSnapshot | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const fetchUserOrders = async () => {
      // Ambil ID User dari localStorage
      const userId = localStorage.getItem('temp_user_id');
      
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        const q = query(
          collection(db, 'orders'),
          where('userId', '==', userId), 
          orderBy('createdAt', 'desc'),
          limit(20)
        );
        
        const querySnapshot = await getDocs(q);
        const ordersList: UserOrder[] = querySnapshot.docs.map(doc => {
          const data = doc.data() as FirebaseOrder;
          const rawCreatedAt = data.createdAt;
          const createdAt =
            rawCreatedAt &&
            typeof rawCreatedAt === 'object' &&
            'toDate' in rawCreatedAt
              ? (rawCreatedAt as { toDate: () => Date }).toDate()
              : new Date(rawCreatedAt ?? new Date().toISOString());

          const items =
            data.items?.map(item => ({
              name: item.name ?? '',
              quantity: item.quantity ?? 0,
            })) ?? [];

          return {
            id: doc.id,
            status: data.status ?? 'PENDING',
            createdAt,
            items,
            pointsUsed: data.pointsUsed ?? 0,
            voucherDiscount: data.voucherDiscount ?? 0,
            voucherUsed: data.voucherUsed ?? false,
            total: data.total ?? 0,
            orderId: data.orderId,
            payment: data.payment,
          };
        });
        
        setOrders(ordersList);
        setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1] ?? null);
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
      case 'PENDING': 
      case 'MENUNGGU': 
        return { label: 'Menunggu Konfirmasi', color: 'text-rose-500', bg: 'bg-rose-50', icon: Clock };
      case 'DIPROSES': 
        return { label: 'Sedang Disiapkan', color: 'text-amber-600', bg: 'bg-amber-50', icon: Package };
      case 'DIKIRIM': 
        return { label: 'Dalam Perjalanan', color: 'text-blue-600', bg: 'bg-blue-50', icon: Truck };
      case 'SELESAI': 
        return { label: 'Pesanan Selesai', color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle2 };
      default: 
        return { label: status, color: 'text-gray-500', bg: 'bg-gray-50', icon: AlertCircle };
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans page-fade">
      {/* HEADER */}
      <div className="bg-white px-8 py-10 border-b border-gray-100">
        <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter italic underline decoration-green-500 decoration-4 underline-offset-4">Pesanan Saya</h1>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-2">Ataya Loyalty & Transaction History</p>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {loading ? (
          <SkeletonList lines={4} />
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag className="mx-auto text-slate-200" size={56} />}
            title="Belum ada pesanan"
            description="Saat Anda berbelanja, riwayat pesanan akan muncul di sini."
            action={
              <Link
                href="/"
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-green-600 text-white tap-active"
              >
                Mulai Belanja
              </Link>
            }
          />
        ) : (
          <>
          {orders.map((order) => {
            const status = getStatusInfo(order.status);
            const totalDiskon = (order.pointsUsed || 0) + (order.voucherDiscount || 0);

            return (
              <div
                key={order.id} 
                className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-gray-100 tap-active cursor-pointer relative overflow-hidden group"
                onClick={() => router.push(`/transaksi/${order.id}`)}
              >
                {/* Status Badge */}
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${status.bg} ${status.color} shadow-sm`}>
                      <status.icon size={22} />
                    </div>
                    <div>
                      <span className={`text-[11px] font-black uppercase tracking-widest ${status.color}`}>
                        {status.label}
                      </span>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">
                        {order.createdAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-2 rounded-full text-gray-300 group-hover:text-green-500 transition-colors">
                    <ChevronRight size={18} />
                  </div>
                </div>

                {/* Ringkasan Item */}
                <div className="mb-6">
                  <p className="text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest flex items-center gap-2">
                    <Package size={12}/> Detail Produk
                  </p>
                  <div className="space-y-1">
                  {order.items.slice(0, 1).map((item, i: number) => (
                      <p key={i} className="text-xs font-black text-gray-800 uppercase line-clamp-1 italic">
                        {item.name} <span className="text-gray-400 font-bold ml-1">x{item.quantity}</span>
                      </p>
                    ))}
                    {order.items?.length > 1 && (
                      <p className="text-[9px] font-bold text-blue-500 uppercase">+ {order.items.length - 1} Produk Lainnya</p>
                    )}
                  </div>
                </div>

                {/* INFO DISKON (Jika ada) */}
                {totalDiskon > 0 && (
                  <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
                    {order.pointsUsed > 0 && (
                      <div className="flex-shrink-0 flex items-center gap-1.5 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-xl border border-blue-100">
                        <Coins size={10} />
                        <span className="text-[8px] font-black uppercase tracking-tighter">Poin -Rp{order.pointsUsed.toLocaleString()}</span>
                      </div>
                    )}
                    {order.voucherUsed && (
                      <div className="flex-shrink-0 flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-xl border border-emerald-100">
                        <Ticket size={10} />
                        <span className="text-[8px] font-black uppercase tracking-tighter">Voucher Digunakan</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Footer Transaksi */}
                <div className="border-t border-dashed border-gray-100 pt-5 flex justify-between items-end">
                  <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase mb-1 tracking-[0.2em]">Total Transaksi</p>
                    <p className="text-2xl font-black text-gray-900 tracking-tighter italic">
                      Rp{order.total?.toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-black text-gray-300 uppercase mb-1">Order ID: {order.orderId || order.id.substring(0,8)}</p>
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-[10px] font-black text-white bg-gray-900 px-3 py-1 rounded-full uppercase italic tracking-widest">
                        {order.payment?.method || 'CASH'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {!!lastDoc && (
            <div className="flex justify-center">
              <button
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-green-600 text-white tap-active disabled:opacity-50"
                disabled={loadingMore}
                onClick={async () => {
                  if (loadingMore) return;
                  const userId = localStorage.getItem('temp_user_id');
                  if (!userId || !lastDoc) return;
                  setLoadingMore(true);
                  try {
                    const q = query(
                      collection(db, 'orders'),
                      where('userId', '==', userId),
                      orderBy('createdAt', 'desc'),
                      startAfter(lastDoc!),
                      limit(20)
                    );
                    const snap = await getDocs(q);
                    const more: UserOrder[] = snap.docs.map(doc => {
                      const data = doc.data() as FirebaseOrder;
                      const rawCreatedAt = data.createdAt;
                      const createdAt =
                        rawCreatedAt &&
                        typeof rawCreatedAt === 'object' &&
                        'toDate' in rawCreatedAt
                          ? (rawCreatedAt as { toDate: () => Date }).toDate()
                          : new Date(rawCreatedAt ?? new Date().toISOString());
                      const items =
                        data.items?.map(item => ({
                          name: item.name ?? '',
                          quantity: item.quantity ?? 0,
                        })) ?? [];
                      return {
                        id: doc.id,
                        status: data.status ?? 'PENDING',
                        createdAt,
                        items,
                        pointsUsed: data.pointsUsed ?? 0,
                        voucherDiscount: data.voucherDiscount ?? 0,
                        voucherUsed: data.voucherUsed ?? false,
                        total: data.total ?? 0,
                        orderId: data.orderId,
                        payment: data.payment,
                      };
                    });
                    setOrders(prev => [...prev, ...more]);
                    setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
                  } finally {
                    setLoadingMore(false);
                  }
                }}
              >
                {loadingMore ? 'Memuat...' : 'Muat Lebih Banyak'}
              </button>
            </div>
          )}
          </>
        )}
      </div>

      {/* BOTTOM NAVIGATION */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[100] px-4 pb-6 pt-2 bg-gradient-to-t from-gray-50 via-gray-50/80 to-transparent">
        <div className="bg-gray-900 rounded-[2.5rem] shadow-2xl border border-white/10 p-2 flex items-center justify-between backdrop-blur-xl">
          {[
            { name: 'Home', icon: HomeIcon, path: '/' },
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
