'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import {
  Bell,
  ChevronDown,
  ClipboardList,
  Heart,
  LogOut,
  Settings,
  ShoppingCart,
  Ticket,
  User,
} from 'lucide-react';
import { auth, db } from '@/lib/firebase';

type OrderRow = {
  id: string;
  orderId?: string;
  status?: string;
  total?: number;
  createdAt?: { toDate: () => Date };
};

export default function BuyerHeaderActions() {
  const pathname = usePathname() || '/';
  const notifRef = useRef<HTMLDivElement | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);

  const [uid, setUid] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [displayName, setDisplayName] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState<string>('');

  const [cartCount, setCartCount] = useState(0);
  const [activeOrders, setActiveOrders] = useState<OrderRow[]>([]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!notifOpen) return;
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [notifOpen]);

  useEffect(() => {
    const updateCartCount = () => {
      try {
        const savedCart = JSON.parse(localStorage.getItem('cart') || '[]');
        const count = savedCart.reduce(
          (sum: number, item: { quantity: number | string }) => sum + (Number(item.quantity) || 0),
          0,
        );
        setCartCount(count);
      } catch {
        setCartCount(0);
      }
    };

    updateCartCount();
    window.addEventListener('cart-updated', updateCartCount);
    window.addEventListener('storage', updateCartCount);
    return () => {
      window.removeEventListener('cart-updated', updateCartCount);
      window.removeEventListener('storage', updateCartCount);
    };
  }, []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (!u) {
        setUid(null);
        setIsAnonymous(false);
        setDisplayName('');
        setPhotoUrl('');
        return;
      }
      setUid(u.uid);
      setIsAnonymous(!!u.isAnonymous);
      setPhotoUrl(u.photoURL || '');
      setDisplayName(u.displayName || '');
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!uid) return;
    if (isAnonymous) return;

    const unsubProfile = onSnapshot(doc(db, 'users', uid), (snap) => {
      const data = snap.data() as Partial<{ name: string }> | undefined;
      if (data?.name) setDisplayName(data.name);
    });

    return () => unsubProfile();
  }, [uid, isAnonymous]);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'orders'), where('userId', '==', uid), orderBy('createdAt', 'desc'));
    const unsubOrders = onSnapshot(
      q,
      (snap) => {
        const rows: OrderRow[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        const active = rows.filter((o) => ['PENDING', 'MENUNGGU', 'DIPROSES', 'DIKIRIM'].includes(String(o.status || '').toUpperCase()));
        setActiveOrders(active.slice(0, 12));
      },
      () => {
        setActiveOrders([]);
      },
    );
    return () => unsubOrders();
  }, [uid]);

  const activeCount = activeOrders.length;

  const greetingName = useMemo(() => {
    const base = displayName || '';
    if (!base) return '';
    return base;
  }, [displayName]);

  const canShowProfile = !!uid && !isAnonymous && !!greetingName;

  if (
    pathname === '/' ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/cashier') ||
    pathname.startsWith('/reports') ||
    pathname === '/profil/login' ||
    pathname === '/profil/register'
  ) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 md:gap-2">
      {canShowProfile ? (
        <div className="relative group">
          <Link
            href="/profil"
            className="flex items-center gap-2 h-10 px-2 rounded-full hover:bg-gray-100 transition-colors text-gray-600"
            title="Profil"
          >
            <div className="h-8 w-8 flex items-center justify-center rounded-full border border-gray-200 p-1 bg-white">
              {photoUrl ? (
                <Image src={photoUrl} alt="User" width={24} height={24} className="h-6 w-6 rounded-full object-cover" />
              ) : (
                <User size={20} className="text-gray-500" />
              )}
            </div>
            <div className="max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-semibold capitalize text-gray-600 hidden md:block">
              Hi, {greetingName}
            </div>
            <ChevronDown size={18} className="text-gray-500 hidden md:block" />
          </Link>

          <div className="absolute right-0 top-full pt-2 hidden group-hover:block z-50">
            <div className="w-[320px] bg-white rounded-2xl shadow-xl border border-gray-100 p-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100 mb-2">
                <div className="h-12 w-12 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center shrink-0">
                  {photoUrl ? (
                    <Image src={photoUrl} alt="User" width={48} height={48} className="h-full w-full object-cover" />
                  ) : (
                    <User size={24} className="text-gray-400" />
                  )}
                </div>
                <div className="overflow-hidden">
                  <p className="font-bold text-gray-900 truncate">{greetingName}</p>
                  <Link href="/profil" className="text-[10px] text-green-600 font-bold hover:underline">
                    Lihat Profil Saya
                  </Link>
                </div>
              </div>

              <div className="space-y-1">
                <Link href="/orders" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 text-gray-600 text-sm font-medium transition-colors">
                  <ClipboardList size={16} /> Pesanan Saya
                </Link>
                <Link href="/vouchers" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 text-gray-600 text-sm font-medium transition-colors">
                  <Ticket size={16} /> Voucher Saya
                </Link>
                <Link href="/wishlist" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 text-gray-600 text-sm font-medium transition-colors">
                  <Heart size={16} /> Wishlist
                </Link>
                <Link href="/profil/edit" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 text-gray-600 text-sm font-medium transition-colors">
                  <Settings size={16} /> Pengaturan
                </Link>
                <button
                  onClick={() => auth.signOut()}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-red-50 text-red-600 text-sm font-medium transition-colors mt-2"
                >
                  <LogOut size={16} /> Keluar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <Link
          href="/profil/login"
          className="flex items-center gap-2 h-10 px-3 rounded-full hover:bg-gray-100 transition-colors text-gray-600 font-semibold text-[12px]"
          title="Masuk"
        >
          <User size={18} className="text-gray-500" />
          <span className="hidden lg:inline">Masuk</span>
        </Link>
      )}

      <Link href="/orders" className="hidden sm:flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500 relative" title="Transaksi">
        <ClipboardList size={22} strokeWidth={1.8} />
      </Link>

      <div className="relative" ref={notifRef}>
        <button
          onClick={() => setNotifOpen((v) => !v)}
          className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500 relative"
          title="Notifikasi"
        >
          <Bell size={22} strokeWidth={1.8} />
          {activeCount > 0 && (
            <span className="absolute top-1 right-1 h-4 min-w-[16px] px-1 bg-red-600 text-white text-[9px] flex items-center justify-center rounded-full font-bold border-2 border-white">
              {activeCount > 9 ? '9+' : activeCount}
            </span>
          )}
        </button>
        {notifOpen && (
          <div className="absolute right-0 top-10 w-[360px] overflow-hidden rounded-2xl bg-white shadow-xl border border-gray-100 z-50">
            <div className="px-4 py-4 text-sm font-bold border-b border-gray-100">Notifikasi</div>
            <div className="p-3 space-y-2 max-h-[360px] overflow-auto">
              {activeOrders.length === 0 ? (
                <div className="p-4 text-[11px] font-semibold text-gray-500">Tidak ada notifikasi.</div>
              ) : (
                activeOrders.map((o) => (
                  <Link
                    key={o.id}
                    href={`/transaksi/${o.id}`}
                    className="block p-3 rounded-xl hover:bg-gray-50 transition-colors"
                    onClick={() => setNotifOpen(false)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-gray-900 truncate">{o.orderId || o.id}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase truncate">{String(o.status || '').toUpperCase()}</div>
                      </div>
                      <div className="text-[11px] font-bold text-gray-900">
                        {typeof o.total === 'number' ? `Rp${o.total.toLocaleString('id-ID')}` : ''}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
            <div className="p-3 border-t border-gray-100">
              <Link href="/orders" className="block w-full text-center bg-gray-900 text-white py-2.5 rounded-xl text-[11px] font-bold hover:bg-gray-800 transition-colors" onClick={() => setNotifOpen(false)}>
                Lihat Semua
              </Link>
            </div>
          </div>
        )}
      </div>

      <Link className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500 relative" title="Keranjang" href="/cart">
        <ShoppingCart size={22} strokeWidth={1.8} />
        {cartCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 bg-red-600 text-white text-[9px] flex items-center justify-center rounded-full font-bold border-2 border-white">
            {cartCount > 9 ? '9+' : cartCount}
          </span>
        )}
      </Link>
    </div>
  );
}
