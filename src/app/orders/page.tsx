'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  Package,
  Clock,
  Truck,
  CheckCircle2,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { EmptyState, SkeletonList } from '@/components/UIState';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { OrderTimeline } from '@/components/orders/OrderTimeline';

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
  const [currentPage, setCurrentPage] = useState(1);
  const ordersPerPage = 10;

  useEffect(() => {
    const setupOrdersListener = async () => {
      const userId = auth.currentUser?.uid || localStorage.getItem('temp_user_id');
      
      if (!userId) {
        setLoading(false);
        return;
      }

      const q = query(collection(db, 'orders'), where('userId', '==', userId), orderBy('createdAt', 'desc'));
      return onSnapshot(
        q,
        (snap) => {
          const ordersList: UserOrder[] = snap.docs.map((d) => {
            const data = d.data() as FirebaseOrder;
            const rawCreatedAt = data.createdAt;
            const createdAt =
              rawCreatedAt && typeof rawCreatedAt === 'object' && 'toDate' in rawCreatedAt
                ? (rawCreatedAt as { toDate: () => Date }).toDate()
                : new Date(rawCreatedAt ?? new Date().toISOString());

            const items =
              data.items?.map((item) => ({
                name: item.name ?? '',
                quantity: item.quantity ?? 0,
              })) ?? [];

            return {
              id: d.id,
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
          setCurrentPage(1);
          setLoading(false);
        },
        () => {
          setOrders([]);
          setLoading(false);
        },
      );
    };
    const unsub = onAuthStateChanged(auth, () => {
      setupOrdersListener();
    });
    return () => unsub();
  }, []);

  const getStatusInfo = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PENDING':
      case 'MENUNGGU':
        return { label: 'Menunggu', color: 'text-amber-700', bg: 'bg-amber-100', icon: <Clock size={12} /> };
      case 'DIPROSES':
        return { label: 'Diproses', color: 'text-blue-700', bg: 'bg-blue-100', icon: <Package size={12} /> };
      case 'DIKIRIM':
        return { label: 'Dikirim', color: 'text-purple-700', bg: 'bg-purple-100', icon: <Truck size={12} /> };
      case 'SELESAI':
        return { label: 'Selesai', color: 'text-emerald-700', bg: 'bg-emerald-100', icon: <CheckCircle2 size={12} /> };
      case 'BATAL':
      case 'DIBATALKAN':
        return { label: 'Batal', color: 'text-rose-700', bg: 'bg-rose-100', icon: <X size={12} /> };
      default:
        return { label: status, color: 'text-gray-700', bg: 'bg-gray-100', icon: <Clock size={12} /> };
    }
  };

  const activeOrdersCount = useMemo(() => {
    return orders.filter((o) => ['PENDING', 'MENUNGGU', 'DIPROSES', 'DIKIRIM'].includes(o.status?.toUpperCase())).length;
  }, [orders]);

  const currentOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * ordersPerPage;
    return orders.slice(startIndex, startIndex + ordersPerPage);
  }, [orders, currentPage]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(orders.length / ordersPerPage)), [orders.length]);

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans page-fade">
      <div className="max-w-2xl mx-auto p-4">
        {loading ? (
          <SkeletonList lines={4} />
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<Package className="mx-auto text-slate-200" size={56} />}
            title="Belum ada riwayat belanja"
            description="Saat Anda berbelanja, riwayat transaksi akan muncul di sini."
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
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 min-h-[600px] hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-widest">Riwayat Transaksi</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Total {orders.length} Pesanan</p>
              </div>
              {activeOrdersCount > 0 && (
                <div className="bg-emerald-100 text-emerald-600 px-4 py-2 rounded-full flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-ping"></div>
                  <span className="text-[9px] font-bold uppercase tracking-widest">{activeOrdersCount} Aktif</span>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {currentOrders.map((order) => {
                const status = getStatusInfo(order.status);
                const isActive = ['PENDING', 'MENUNGGU', 'DIPROSES', 'DIKIRIM'].includes(order.status?.toUpperCase());
                const firstItem = order.items?.[0];
                const additionalItems = (order.items?.length || 0) - 1;

                return (
                  <div
                    key={order.id}
                    className="bg-white border border-slate-100 rounded-[2.5rem] p-6 transition-all hover:shadow-xl hover:scale-[1.01] group relative overflow-hidden"
                  >
                    {/* Header: ID & Status Bubble */}
                    <div className="flex justify-between items-start mb-8">
                       <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-green-600 group-hover:bg-green-50 transition-colors">
                             <Package size={22} />
                          </div>
                          <div>
                             <h4 className="text-xs font-black text-slate-800 tracking-tighter uppercase">{order.orderId || `ATY-${order.id.slice(0, 5).toUpperCase()}`}</h4>
                             <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-0.5">
                               {order.createdAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                             </p>
                          </div>
                       </div>
                       <Link href={`/transaksi/${order.id}`} className="text-[10px] font-black uppercase tracking-widest text-green-600 bg-green-50 px-4 py-2 rounded-xl hover:bg-green-600 hover:text-white transition-all">
                          Details
                       </Link>
                    </div>

                    {/* Visual Timeline */}
                    <div className="mb-10">
                       <OrderTimeline status={order.status} />
                    </div>

                    {/* Footer: Price & Quick Info */}
                    <div className="flex items-end justify-between pt-6 border-t border-dashed border-slate-100">
                       <div className="flex-1 min-w-0 pr-4">
                          <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Items Purchased</p>
                          <p className="text-[11px] font-bold text-slate-600 truncate uppercase">
                             {firstItem?.name} {additionalItems > 0 && <span className="text-slate-300 ml-1">+ {additionalItems} more</span>}
                          </p>
                       </div>
                       <div className="text-right">
                          <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Total Payment</p>
                          <p className="text-2xl font-black text-slate-900 tracking-tighter">Rp {(order.total || 0).toLocaleString('id-ID')}</p>
                       </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {orders.length > ordersPerPage && (
              <div className="flex items-center justify-center gap-2 mt-10">
                <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 text-slate-300 hover:text-green-600 disabled:opacity-20 transition-all">
                  <ChevronLeft />
                </button>
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-8 h-8 rounded-xl text-[10px] font-black transition-all ${currentPage === i + 1 ? 'bg-green-600 text-white shadow-lg shadow-green-100' : 'bg-slate-100 text-slate-400'}`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 text-slate-300 hover:text-green-600 disabled:opacity-20 transition-all"
                >
                  <ChevronRight />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
