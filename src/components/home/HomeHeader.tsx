'use client';

import Link from 'next/link';
import Image from 'next/image';
import { 
  Search, Filter, User, ChevronDown, 
  ClipboardList, Bell, ShoppingCart, 
  Ticket, Heart, Settings, LogOut, Store
} from 'lucide-react';
import { UserProfile, NotificationItem } from '@/lib/types';
import { useRouter } from 'next/navigation';

interface HomeHeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  showFilter: boolean;
  setShowFilter: (show: boolean) => void;
  cartCount: number;
  currentUserName: string | null;
  currentUserPhotoUrl: string | null;
  notifications: NotificationItem[];
  notifOpen: boolean;
  setNotifOpen: (open: boolean) => void;
  notifTab: 'transaksi' | 'informasi';
  setNotifTab: (tab: 'transaksi' | 'informasi') => void;
  notifCategory: string;
  setNotifCategory: (cat: string) => void;
  filteredNotifications: NotificationItem[];
  notifTransaksi: NotificationItem[];
  notifInformasi: NotificationItem[];
  notifRef: React.RefObject<HTMLDivElement | null>;
  warehouses: { id: string; name: string }[];
  selectedWarehouseId: string;
  setSelectedWarehouseId: (id: string) => void;
  onSignOut: () => void;
}

export const HomeHeader = ({
  searchQuery,
  setSearchQuery,
  showFilter,
  setShowFilter,
  cartCount,
  currentUserName,
  currentUserPhotoUrl,
  notifications,
  notifOpen,
  setNotifOpen,
  notifTab,
  setNotifTab,
  notifCategory,
  setNotifCategory,
  filteredNotifications,
  notifTransaksi,
  notifInformasi,
  notifRef,
  warehouses,
  selectedWarehouseId,
  setSelectedWarehouseId,
  onSignOut
}: HomeHeaderProps) => {
  const router = useRouter();

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      {/* Top Notification Bar */}
      <div className="bg-gray-50 border-b border-gray-100 hidden md:block">
        <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-gray-200">
              <Store size={14} className="text-gray-400" />
              <select 
                value={selectedWarehouseId} 
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                className="bg-transparent text-[10px] font-bold text-gray-600 outline-none cursor-pointer uppercase"
              >
                <option value="">Semua Gudang</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-6 text-gray-500 font-medium">
            <Link href="/tentang" className="hover:text-green-600 transition-colors">Tentang Atayamarket</Link>
            <Link href="/promo" className="hover:text-green-600 transition-colors">Produk Terlaris</Link>
            <Link href="/promo" className="hover:text-green-600 transition-colors">Promo Atayamarket</Link>
            <Link href="https://wa.me/85790565666" className="hover:text-green-600 transition-colors">Bantuan</Link>
          </div>
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo-atayatoko.png" alt="Logo" width={32} height={32} className="h-8 w-auto" />
            <h1 className="hidden sm:block text-lg font-black text-green-600 uppercase">ATAYAMARKET</h1>
          </Link>
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              if (searchQuery.trim()) {
                router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
              } else {
                router.push('/search');
              }
            }}
            className="flex-1 relative max-w-xl"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Cari produk..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="w-full bg-gray-100 border-none rounded-xl py-2 pl-10 pr-10 text-sm outline-none focus:ring-1 focus:ring-green-500/20" 
            />
            <button 
              type="button"
              onClick={() => router.push('/search')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors bg-gray-200 text-gray-500 hover:bg-green-100 hover:text-green-600"
            >
              <Filter size={14} />
            </button>
          </form>
          
          <div className="flex items-center gap-1 md:gap-2">
            {currentUserName ? (
              <div className="relative group">
                <Link
                  href="/profil"
                  className="flex items-center gap-2 h-10 px-2 rounded-full hover:bg-gray-100 transition-colors text-gray-600"
                >
                  <div className="h-8 w-8 flex items-center justify-center rounded-full border border-gray-200 p-1 bg-white">
                    {currentUserPhotoUrl ? (
                      <Image src={currentUserPhotoUrl} alt="User" width={24} height={24} className="h-6 w-6 rounded-full object-cover" />
                    ) : (
                      <User size={20} className="text-gray-500" />
                    )}
                  </div>
                  <div className="max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-semibold capitalize text-gray-600 hidden md:block">
                    Hi, {currentUserName}
                  </div>
                  <ChevronDown size={18} className="text-gray-500 hidden md:block" />
                </Link>

                <div className="absolute right-0 top-full pt-2 hidden group-hover:block z-50">
                  <div className="w-[320px] bg-white rounded-2xl shadow-xl border border-gray-100 p-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center gap-3 pb-4 border-b border-gray-100 mb-2">
                      <div className="h-12 w-12 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center shrink-0">
                         {currentUserPhotoUrl ? (
                           <Image src={currentUserPhotoUrl} alt="User" width={48} height={48} className="h-full w-full object-cover" />
                         ) : (
                           <User size={24} className="text-gray-400" />
                         )}
                      </div>
                      <div className="overflow-hidden">
                        <p className="font-bold text-gray-900 truncate">{currentUserName}</p>
                        <Link href="/profil" className="text-[10px] text-green-600 font-bold hover:underline">Lihat Profil Saya</Link>
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
                        onClick={onSignOut}
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
              >
                <User size={18} className="text-gray-500" />
                <span className="hidden lg:inline">Masuk</span>
              </Link>
            )}

            <Link href="/orders" className="hidden sm:flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500 relative">
              <ClipboardList size={22} strokeWidth={1.8} />
            </Link>

            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500 relative"
              >
                <Bell size={22} strokeWidth={1.8} />
                <span className="absolute top-1 right-1 h-4 min-w-[16px] px-1 bg-red-600 text-white text-[9px] flex items-center justify-center rounded-full font-bold border-2 border-white">
                  {notifications.length}
                </span>
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-10 w-[360px] overflow-hidden rounded-lg bg-white shadow-xl z-50">
                  <div className="px-4 py-4 text-sm font-bold border-b border-gray-100">Notifikasi</div>
                  <div className="border-b border-gray-100 grid grid-cols-2 text-center text-sm font-medium">
                    <button onClick={() => setNotifTab('transaksi')} className={`p-3 ${notifTab === 'transaksi' ? 'text-gray-700 border-b-2 border-gray-300' : 'text-gray-400'}`}>Transaksi ({notifTransaksi.length})</button>
                    <button onClick={() => setNotifTab('informasi')} className={`p-3 ${notifTab === 'informasi' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-400'}`}>Informasi ({notifInformasi.length})</button>
                  </div>
                  <div className="p-2 overflow-x-auto whitespace-nowrap scrollbar-hide">
                    {['Semua', 'Akun', 'Info', 'Promo', 'Kupon', 'Poin', 'Bantuan'].map((label) => (
                      <button key={label} onClick={() => setNotifCategory(label)} className={`${notifCategory === label ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700'} px-3 py-1.5 text-[10px] font-medium mr-2 rounded-full`}>{label}</button>
                    ))}
                  </div>
                  <div className="max-h-[400px] overflow-y-auto">
                    {filteredNotifications.length === 0 ? (
                      <div className="p-6 text-center text-gray-500 text-sm">Tidak ada notifikasi.</div>
                    ) : (
                      filteredNotifications.map((n) => (
                        <div key={n.id} className="p-4 border-b border-gray-50">
                          <div className="flex justify-between mb-1">
                            <span className="text-[10px] text-blue-600 font-bold uppercase bg-blue-50 px-2 py-0.5 rounded">{n.category || n.type}</span>
                            <span className="text-[10px] text-gray-400">{n.createdAt}</span>
                          </div>
                          <h4 className="text-sm font-bold">{n.title}</h4>
                          <p className="text-xs text-gray-500">{n.body}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <Link href="/cart" className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500 relative">
              <ShoppingCart size={22} strokeWidth={1.8} />
              {cartCount > 0 && <span className="absolute top-1 right-1 h-4 min-w-[16px] px-1 bg-red-600 text-white text-[9px] flex items-center justify-center rounded-full font-bold border-2 border-white">{cartCount}</span>}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};
