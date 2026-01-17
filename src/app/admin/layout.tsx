'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, ShoppingCart, Package, Users, 
  Settings, Star, Truck, Receipt, Tag, Database, 
  UsersRound, Store, Wallet, History, BarChart3
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const menuItems = [
    { group: "Utama", items: [
      { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
      { name: 'Pesanan', href: '/admin/orders', icon: ShoppingCart },
    ]},
    { group: "Katalog & Stok", items: [
      { name: 'Produk', href: '/admin/products', icon: Package },
      { name: 'Kategori', href: '/admin/kategori', icon: Tag },
      { name: 'Gudang', href: '/admin/warehouses', icon: Database },
      { name: 'Inventory', href: '/admin/inventory', icon: History },
    ]},
    { group: "Pembelian & Suplai", items: [
      { name: 'Pembelian (Purchases)', href: '/admin/purchases', icon: Receipt },
      { name: 'Supplier', href: '/admin/suppliers', icon: Truck },
    ]},
    { group: "Pelanggan & SDM", items: [
      { name: 'Pelanggan', href: '/admin/customers', icon: Users },
      { name: 'Karyawan', href: '/admin/employees', icon: UsersRound },
      { name: 'Sistem Poin', href: '/admin/points', icon: Wallet },
    ]},
    { group: "Pemasaran", items: [
      { name: 'Promosi', href: '/admin/promotions', icon: Star },
    ]},
    { group: "Laporan", items: [
      { name: 'Laporan Penjualan', href: '/admin/reports', icon: BarChart3 },
    ]},
    { group: "Sistem", items: [
      { name: 'Pengaturan', href: '/admin/settings', icon: Settings },
    ]}
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 hidden md:block shrink-0">
        <div className="p-6 border-b border-gray-50 flex items-center gap-2">
          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center text-white font-black text-xs">AT</div>
          <span className="font-black text-gray-800 tracking-tighter uppercase">AtayaToko Admin</span>
        </div>
        
        <nav className="p-4 space-y-6 overflow-y-auto h-[calc(100vh-80px)]">
          {menuItems.map((group, idx) => (
            <div key={idx}>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 px-3">{group.group}</p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                        isActive 
                        ? 'bg-green-600 text-white shadow-lg shadow-green-100' 
                        : 'text-gray-500 hover:bg-gray-50 hover:text-green-600'
                      }`}
                    >
                      <item.icon size={16} strokeWidth={isActive ? 3 : 2} />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        {children}
      </main>
    </div>
  );
}