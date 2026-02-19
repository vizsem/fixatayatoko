'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { db } from '@/lib/firebase';

import {
  LayoutDashboard, ShoppingCart, Package, Users,
  Settings, Star, Truck, Receipt, Tag, Database,
  UsersRound, Wallet, History, BarChart3, TrendingUp, CreditCard,
  ArrowUpCircle, ArrowDownCircle, Warehouse, Package as BoxIcon
} from 'lucide-react';

import { collection, onSnapshot, orderBy, limit, query, Timestamp } from 'firebase/firestore';


export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [toasts, setToasts] = useState<Array<{
    id: string;
    productName: string;
    warehouseName: string;
    change: number;
    type?: string;
    adminEmail?: string;
    createdAt?: Timestamp;
  }>>([]);
  const initialLoaded = useRef(false);

  useEffect(() => {
    const q = query(
      collection(db, 'stock_logs'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!initialLoaded.current) {
        initialLoaded.current = true;
        return;
      }
      snap.docChanges().forEach((chg) => {
        if (chg.type === 'added') {
          const data = chg.doc.data() as {
            productName?: string;
            warehouseName?: string;
            change?: number;
            type?: string;
            adminEmail?: string;
            createdAt?: Timestamp;
          };
          const toast = {
            id: chg.doc.id,
            productName: String(data.productName || ''),
            warehouseName: String(data.warehouseName || ''),
            change: Number(data.change || 0),
            type: String(data.type || ''),
            adminEmail: String(data.adminEmail || ''),
            createdAt: data.createdAt,
          };
          setToasts((prev) => [toast, ...prev].slice(0, 5));
          setTimeout(() => {
            setToasts((prev) => prev.filter(t => t.id !== toast.id));
          }, 6000);
        }
      });
    });
    return () => unsub();
  }, []);

  const menuItems = [
    {
      group: "Utama", items: [
        { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
        { name: 'Pesanan', href: '/admin/orders', icon: ShoppingCart },
        { name: 'Order Marketplace', href: '/admin/marketplace-orders', icon: Receipt },
      ]
    },
    {
      group: "Katalog & Stok", items: [
        { name: 'Produk', href: '/admin/products', icon: Package },
        { name: 'Harga per Channel', href: '/admin/products/channel-pricing', icon: Tag },
        { name: 'Kategori', href: '/admin/kategori', icon: Tag },
        { name: 'Gudang', href: '/admin/warehouses', icon: Database },
        { name: 'Inventory', href: '/admin/inventory', icon: History },
      ]
    },
    {
      group: "Pembelian & Suplai", items: [
        { name: 'Pembelian (Purchases)', href: '/admin/purchases', icon: Receipt },
        { name: 'Supplier', href: '/admin/suppliers', icon: Truck },
      ]
    },
    {
      group: "Pelanggan & SDM", items: [
        { name: 'Pelanggan', href: '/admin/customers', icon: Users },
        { name: 'Karyawan', href: '/admin/employees', icon: UsersRound },
        { name: 'Sistem Poin', href: '/admin/points', icon: Star },
        { name: 'Dompet Digital', href: '/admin/wallet', icon: Wallet },
        { name: 'Users', href: '/admin/users', icon: Users },
      ]
    },
    {
      group: "Pemasaran", items: [
        { name: 'Promosi', href: '/admin/promotions', icon: Star },
      ]
    },
    {
      group: "Laporan", items: [
        { name: 'Laporan', href: '/admin/reports', icon: BarChart3 },
        { name: 'Penjualan', href: '/admin/reports/sales', icon: TrendingUp },
        { name: 'Inventaris', href: '/admin/reports/inventory', icon: Database },
        { name: 'Keuangan', href: '/admin/reports/finance', icon: CreditCard },
        { name: 'Operasional', href: '/admin/reports/operations', icon: Settings },
        { name: 'Promosi', href: '/admin/reports/promotions', icon: Star },
        { name: 'Pelanggan', href: '/admin/reports/customers', icon: Users },
      ]
    },
    {
      group: "Sistem", items: [
        { name: 'Pengaturan', href: '/admin/settings', icon: Settings },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-100 transition-transform md:translate-x-0 md:static md:block shrink-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 border-b border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center text-white font-black text-xs">AT</div>
            <span className="font-black text-gray-800 tracking-tighter">AtayaToko Admin</span>
          </div>
          <button className="md:hidden p-2 text-gray-400" onClick={() => setIsOpen(false)}>
            <LayoutDashboard size={16} />
          </button>
        </div>
        <nav className="p-4 space-y-6 overflow-y-auto h-[calc(100vh-80px)]">
          {menuItems.map((group, idx) => (
            <div key={idx}>
              <p className="text-[10px] font-bold text-gray-400 tracking-widest mb-3 px-3">{group.group}</p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${isActive ? 'bg-green-600 text-white shadow-lg shadow-green-100' : 'text-gray-500 hover:bg-gray-50 hover:text-green-600'}`}
                    >
                      <Icon size={16} strokeWidth={isActive ? 3 : 2} />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-4 md:p-8">
        <div className="md:hidden mb-4 flex items-center justify-between">
          <button
            className="p-2.5 bg-white rounded-xl shadow-sm border border-gray-100"
            onClick={() => setIsOpen(true)}
          >
            <LayoutDashboard size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-green-600 rounded-lg flex items-center justify-center text-white font-black text-[10px]">AT</div>
            <span className="text-[10px] font-black text-green-600">Admin</span>
          </div>
          <div />
        </div>
        {children}
        {!!toasts.length && (
          <div className="fixed bottom-4 right-4 z-[60] space-y-2">
            {toasts.map((t) => {
              const isIn = t.change > 0;
              return (
                <div key={t.id} className="flex items-center gap-3 bg-white border border-gray-100 shadow-xl rounded-2xl p-3 min-w-[280px]">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isIn ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                    {isIn ? <ArrowUpCircle size={18} /> : <ArrowDownCircle size={18} />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-xs font-black">
                      <BoxIcon size={14} className="text-gray-300" />
                      <span className="text-gray-800">{t.productName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black ${isIn ? 'text-green-600' : 'text-red-600'}`}>
                        {isIn ? `+${t.change}` : t.change}
                      </span>
                      <span className="text-[9px] font-bold text-gray-400">unit</span>
                      <span className="text-[9px] font-bold text-gray-400">•</span>
                      <div className="flex items-center gap-1 text-[9px] font-bold text-gray-500">
                        <Warehouse size={12} className="text-gray-300" />
                        {t.warehouseName}
                      </div>
                    </div>
                    <div className="text-[8px] font-bold text-gray-400">
                      {t.type || 'STOCK'}
                      {t.adminEmail ? ` • ${t.adminEmail.split('@')[0]}` : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
