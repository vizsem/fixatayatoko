'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  LayoutDashboard, ShoppingCart, Package, Users,
  Settings, Star, Truck, Receipt, Tag, Database,
  UsersRound, Wallet, History, BarChart3, TrendingUp, CreditCard,
  ArrowUpCircle, ArrowDownCircle, Warehouse, Package as BoxIcon,
  Banknote, Bell, Landmark, MessageCircle, Mail, RefreshCcw,
  DollarSign, AlertTriangle, ClipboardCheck
} from 'lucide-react';

import AdminMobileHeader from '@/components/AdminMobileHeader';
import AdminMobileNav from '@/components/AdminMobileNav';
import { supabase } from '@/lib/supabase';





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
    createdAt?: string;
  }>>([]);
  const initialLoaded = useRef(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const [mobileStats, setMobileStats] = useState({
    todaySales: 0,
    newOrders: 0,
    lowStock: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [ordersRes, stockRes, salesRes] = await Promise.all([
          supabase.from('orders').select('id', { count: 'exact', head: true }).in('status', ['MENUNGGU', 'PENDING']),
          supabase.from('products').select('id', { count: 'exact', head: true }).lte('stock', 10).eq('is_active', true),
          supabase.from('orders').select('total,raw_data').gte('created_at', today.toISOString()),
        ]);

        let todaySales = 0;
        (salesRes.data || []).forEach(d => {
          todaySales += Number(d.total || d.raw_data?.total || 0);
        });

        setMobileStats({
          newOrders: ordersRes.count ?? 0,
          lowStock: stockRes.count ?? 0,
          todaySales,
        });
      } catch (err) {
        console.error('Error fetching admin layout stats', err);
      }
    };
    fetchStats();
  }, []);

  // Fetch unread messages count once
  useEffect(() => {
    const fetchUnread = async () => {
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'unread');
      setUnreadMessages(count ?? 0);
    };
    fetchUnread();
  }, []);

  // Stock log realtime toast via Supabase Realtime
  useEffect(() => {
    const channel = supabase
      .channel('admin-stock-logs-toast')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stock_logs' }, (payload) => {
        if (!initialLoaded.current) { initialLoaded.current = true; return; }
        const data = payload.new as any;
        const toast = {
          id: data.id || String(Date.now()),
          productName: String(data.product_name || data.productName || ''),
          warehouseName: String(data.warehouse_name || data.warehouseName || ''),
          change: Number(data.change || data.quantity || 0),
          type: String(data.type || ''),
          adminEmail: String(data.admin_email || data.adminEmail || ''),
          createdAt: data.created_at || data.createdAt,
        };
        setToasts((prev) => [toast, ...prev].slice(0, 5));
        setTimeout(() => {
          setToasts((prev) => prev.filter(t => t.id !== toast.id));
        }, 6000);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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
        { name: 'HPP & Margin Harga', href: '/admin/products/pricing-hpp', icon: DollarSign },
        { name: 'Harga per Channel', href: '/admin/products/channel-pricing', icon: Tag },
        { name: 'Sampling Harian (5 Menit)', href: '/admin/inventory/daily-check', icon: ClipboardCheck },
        { name: 'Kategori', href: '/admin/kategori', icon: Tag },
        { name: 'Gudang', href: '/admin/warehouses', icon: Database },
        { name: 'Inventory', href: '/admin/inventory', icon: History },
        { name: 'Rekonsiliasi Produk', href: '/admin/inventory/reconciliation', icon: RefreshCcw },
        { name: 'Layer Persediaan', href: '/admin/inventory/layers', icon: Database },
      ]
    },
    {
      group: "Pembelian & Suplai", items: [
        { name: 'Pembelian (Purchases)', href: '/admin/purchases', icon: Receipt },
        { name: 'Supplier', href: '/admin/suppliers', icon: Truck },
      ]
    },
    {
      group: "Keuangan & Operasional", items: [
        { name: 'Pengeluaran Toko', href: '/admin/operational-expenses', icon: Banknote },
        { name: 'Modal & Aset', href: '/admin/capital', icon: Landmark },
        { name: 'Rekonsiliasi Bank', href: '/admin/finance/bank-reconciliation', icon: CreditCard },
      ]
    },
    {
      group: "Layanan & Purna Jual", items: [
        { name: 'Retur Barang', href: '/admin/returns', icon: RefreshCcw },
      ]
    },
    {
      group: "Pelanggan & SDM", items: [
        { name: 'Live Chat', href: '/admin/chat', icon: MessageCircle },
        { name: 'Kotak Masuk', href: '/admin/messages', icon: Mail, badge: unreadMessages },
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
        { name: 'Notifikasi', href: '/admin/notifications', icon: Bell },
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
        { name: 'Laporan Pajak', href: '/admin/reports/tax', icon: Receipt },
      ]
    },
    {
      group: "Audit & Keamanan", items: [
        { name: 'Audit Terpusat', href: '/admin/audit', icon: History },
        { name: 'Audit Pajak', href: '/admin/audit?tab=tax', icon: Receipt },
      ]
    },
    {
      group: "Sistem", items: [
        { name: 'Pengaturan', href: '/admin/settings', icon: Settings },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex print:bg-white print:block">
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 md:hidden print:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-100 transition-transform md:translate-x-0 md:static md:block shrink-0 print:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center text-white font-black text-xs">AT</div>
            <span className="font-black text-gray-800 tracking-tighter text-sm">AtayaToko Admin</span>
          </div>
          <button className="md:hidden p-2 text-gray-400" onClick={() => setIsOpen(false)}>
            <LayoutDashboard size={16} />
          </button>
        </div>
        <nav className="p-3 space-y-5 overflow-y-auto h-[calc(100vh-80px)]">
          {menuItems.map((group, idx) => (
            <div key={idx}>
              <p className="text-xs font-bold text-gray-400 tracking-widest mb-3 px-3">{group.group}</p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  const badge = (item as any).badge;
                  
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all relative ${isActive ? 'bg-green-600 text-white shadow-lg shadow-green-100' : 'text-gray-500 hover:bg-gray-50 hover:text-green-600'}`}
                    >
                      <Icon size={16} strokeWidth={isActive ? 3 : 2} />
                      <span className="flex-1">{item.name}</span>
                      {(badge ?? 0) > 0 && (
                        <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                          {badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>
      <main className="flex-1 min-w-0 overflow-x-hidden px-3 sm:px-4 md:px-6 pt-20 md:pt-6 pb-32 md:pb-6 print:p-0 print:m-0 print:overflow-visible">
        {children}
        {!!toasts.length && (
          <div className="fixed bottom-4 right-4 z-[60] space-y-2 print:hidden">
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
                      <span className={`text-xs font-black ${isIn ? 'text-green-600' : 'text-red-600'}`}>
                        {isIn ? `+${t.change}` : t.change}
                      </span>
                      <span className="text-xs font-bold text-gray-400">unit</span>
                      <span className="text-xs font-bold text-gray-400">•</span>
                      <div className="flex items-center gap-1 text-xs font-bold text-gray-500">
                        <Warehouse size={12} className="text-gray-300" />
                        {t.warehouseName}
                      </div>
                    </div>
                    <div className="text-xs font-bold text-gray-400">
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
      <div className="print:hidden">
        <AdminMobileHeader />
        <AdminMobileNav />
      </div>
    </div>
  );
}

