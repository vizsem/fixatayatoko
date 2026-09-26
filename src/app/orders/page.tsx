'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  Package, Clock, Truck, CheckCircle2, X, ChevronLeft, ChevronRight, ShoppingBag,
} from 'lucide-react';
import Link from 'next/link';
import { EmptyState, SkeletonList } from '@/components/UIState';
import { OrderTimeline } from '@/components/orders/OrderTimeline';
import { supabase } from '@/lib/supabase';

import { auth, collection, db, onAuthStateChanged, onSnapshot, orderBy, query, where } from '@/lib/firebase';
type FirebaseOrder = {
  status?: string;
  createdAt?: { toDate: () => Date } | string;
  items?: { name?: string; quantity?: number }[];
  pointsUsed?: number;
  voucherDiscount?: number;
  voucherUsed?: boolean;
  total?: number;
  orderId?: string;
  payment?: { method?: string };
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
  payment?: { method?: string };
};

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  PENDING:    { label: 'Menunggu',  color: 'text-amber-700',  bg: 'bg-amber-100',  icon: <Clock size={12} /> },
  MENUNGGU:   { label: 'Menunggu',  color: 'text-amber-700',  bg: 'bg-amber-100',  icon: <Clock size={12} /> },
  DIPROSES:   { label: 'Diproses',  color: 'text-blue-700',   bg: 'bg-blue-100',   icon: <Package size={12} /> },
  DIKIRIM:    { label: 'Dikirim',   color: 'text-purple-700', bg: 'bg-purple-100', icon: <Truck size={12} /> },
  SELESAI:    { label: 'Selesai',   color: 'text-emerald-700',bg: 'bg-emerald-100',icon: <CheckCircle2 size={12} /> },
  BATAL:      { label: 'Batal',     color: 'text-rose-700',   bg: 'bg-rose-100',   icon: <X size={12} /> },
  DIBATALKAN: { label: 'Dibatalkan',color: 'text-rose-700',   bg: 'bg-rose-100',   icon: <X size={12} /> },
};

export default function UserOrdersPage() {
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const ordersPerPage = 10;

  useEffect(() => {
    const setupOrdersListener = async () => {
      const userId = (await supabase.auth.getUser()).data.user?.uid || localStorage.getItem('temp_user_id');
      if (!userId) { setLoading(false); return; }

      const q = query(collection(db, 'orders'), where('userId', '==', userId), orderBy('createdAt', 'desc'));
      return onSnapshot(q,
        (snap) => {
          const list: UserOrder[] = snap.docs.map((d) => {
            const data = d.data() as FirebaseOrder;
            const rawCreatedAt = data.createdAt;
            const createdAt = rawCreatedAt && typeof rawCreatedAt === 'object' && 'toDate' in rawCreatedAt
              ? (rawCreatedAt as { toDate: () => Date }).toDate()
              : new Date(rawCreatedAt ?? new Date().toISOString());
            return {
              id: d.id,
              status: data.status ?? 'PENDING',
              createdAt,
              items: data.items?.map(i => ({ name: i.name ?? '', quantity: i.quantity ?? 0 })) ?? [],
              pointsUsed: data.pointsUsed ?? 0,
              voucherDiscount: data.voucherDiscount ?? 0,
              voucherUsed: data.voucherUsed ?? false,
              total: data.total ?? 0,
              orderId: data.orderId,
              payment: data.payment,
            };
          });
          setOrders(list);
          setCurrentPage(1);
          setLoading(false);
        },
        () => { setOrders([]); setLoading(false); }
      );
    };
    const unsub = onAuthStateChanged(auth, () => { setupOrdersListener(); });
    return () => unsub();
  }, []);

  const activeOrdersCount = useMemo(() =>
    orders.filter(o => ['PENDING', 'MENUNGGU', 'DIPROSES', 'DIKIRIM'].includes(o.status?.toUpperCase())).length,
  [orders]);

  const currentOrders = useMemo(() => {
    const start = (currentPage - 1) * ordersPerPage;
    return orders.slice(start, start + ordersPerPage);
  }, [orders, currentPage]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(orders.length / ordersPerPage)), [orders.length]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md sticky top-0 z-50 border-b border-slate-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-black text-slate-900">Riwayat Pesanan</h1>
            <p className="text-xs text-slate-500 font-medium">Total {orders.length} transaksi</p>
          </div>
          {activeOrdersCount > 0 && (
            <div className="bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs font-bold">{activeOrdersCount} Aktif</span>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5">
        {loading ? (
          <SkeletonList lines={4} />
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag className="mx-auto text-slate-200" size={56} />}
            title="Belum ada riwayat belanja"
            description="Saat Anda berbelanja, riwayat transaksi akan muncul di sini."
            action={
              <Link href="/" className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
                Mulai Belanja
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            {currentOrders.map((order) => {
              const statusKey = order.status?.toUpperCase();
              const status = STATUS_MAP[statusKey] || { label: order.status, color: 'text-slate-700', bg: 'bg-slate-100', icon: <Clock size={12} /> };
              const firstItem = order.items?.[0];
              const extraCount = (order.items?.length || 0) - 1;

              return (
                <div key={order.id} className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all group">
                  {/* Header: ID & Status */}
                  <div className="flex justify-between items-start mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-emerald-600 group-hover:bg-emerald-50 transition-colors shrink-0">
                        <Package size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900">{order.orderId || `ATY-${order.id.slice(0, 5).toUpperCase()}`}</h4>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                          {order.createdAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${status.color} ${status.bg}`}>
                      {status.icon} {status.label}
                    </span>
                  </div>

                  {/* Timeline */}
                  <div className="mb-5">
                    <OrderTimeline status={order.status} />
                  </div>

                  {/* Footer: Items & Total */}
                  <div className="flex items-end justify-between pt-4 border-t border-slate-100">
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-xs text-slate-400 font-medium mb-0.5">Produk</p>
                      <p className="text-sm font-bold text-slate-700 truncate">
                        {firstItem?.name}
                        {extraCount > 0 && <span className="text-slate-400 font-medium ml-1">+{extraCount} lainnya</span>}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-slate-400 font-medium mb-0.5">Total</p>
                      <p className="text-lg font-black text-slate-900">Rp{(order.total || 0).toLocaleString('id-ID')}</p>
                    </div>
                  </div>

                  {/* Detail Link */}
                  <Link
                    href={`/transaksi/${order.id}`}
                    className="mt-4 w-full inline-flex items-center justify-center py-2.5 rounded-2xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-600 hover:text-white transition-all"
                  >
                    Lihat Detail Pesanan
                  </Link>
                </div>
              );
            })}

            {/* Pagination */}
            {orders.length > ordersPerPage && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2.5 text-slate-400 hover:text-emerald-600 disabled:opacity-20 transition-all">
                  <ChevronLeft size={20} />
                </button>
                {[...Array(totalPages)].map((_, i) => (
                  <button key={i} onClick={() => setCurrentPage(i + 1)} className={`w-9 h-9 rounded-xl text-sm font-bold transition-all ${currentPage === i + 1 ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                    {i + 1}
                  </button>
                ))}
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2.5 text-slate-400 hover:text-emerald-600 disabled:opacity-20 transition-all">
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
