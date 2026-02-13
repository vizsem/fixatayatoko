'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Store,
  Home,
  Package,
  ShoppingCart,
  Users,
  Settings,
  LogOut,
  Menu,
  X
} from 'lucide-react';

export default function AdminClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const handleLogout = async () => {
    try {
      // Panggil API logout (hapus cookie admin-token)
      await fetch('/api/admin/logout', {
        method: 'POST',
      });

      // Redirect ke login
      window.location.href = '/profil/login';
    } catch (error) {
      console.error('Error logout:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-md border-r border-gray-100 transition-transform md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5 border-b flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Store className="text-green-600" size={28} />
            <h1 className="text-xl font-bold text-green-600">ATAYATOKO2</h1>
          </div>
          <button
            aria-label="Close menu"
            className="md:hidden p-2 text-gray-400"
            onClick={() => setIsOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="p-4 overflow-y-auto h-[calc(100%-120px)]">
          <ul className="space-y-2">
            <li>
              <Link
                href="/admin"
                onClick={() => setIsOpen(false)}
                className="flex items-center space-x-3 p-2 rounded hover:bg-green-50"
              >
                <Home size={18} />
                <span>Dashboard</span>
              </Link>
            </li>

            <li>
              <Link
                href="/admin/products"
                onClick={() => setIsOpen(false)}
                className="flex items-center space-x-3 p-2 rounded hover:bg-green-50"
              >
                <Package size={18} />
                <span>Produk</span>
              </Link>
            </li>

            <li>
              <Link
                href="/admin/orders"
                onClick={() => setIsOpen(false)}
                className="flex items-center space-x-3 p-2 rounded hover:bg-green-50"
              >
                <ShoppingCart size={18} />
                <span>Pesanan</span>
              </Link>
            </li>

            <li>
              <Link
                href="/admin/customers"
                onClick={() => setIsOpen(false)}
                className="flex items-center space-x-3 p-2 rounded hover:bg-green-50"
              >
                <Users size={18} />
                <span>Pelanggan</span>
              </Link>
            </li>

            <li>
              <Link
                href="/admin/suppliers"
                onClick={() => setIsOpen(false)}
                className="flex items-center space-x-3 p-2 rounded hover:bg-green-50"
              >
                <Store size={18} />
                <span>Supplier</span>
              </Link>
            </li>

            <li>
              <Link
                href="/admin/purchases"
                onClick={() => setIsOpen(false)}
                className="flex items-center space-x-3 p-2 rounded hover:bg-green-50"
              >
                <Package size={18} />
                <span>Pembelian</span>
              </Link>
            </li>

            <li>
              <Link
                href="/admin/reports"
                onClick={() => setIsOpen(false)}
                className="flex items-center space-x-3 p-2 rounded hover:bg-green-50"
              >
                <Settings size={18} />
                <span>Laporan</span>
              </Link>
            </li>

            <li>
              <Link
                href="/admin/settings"
                onClick={() => setIsOpen(false)}
                className="flex items-center space-x-3 p-2 rounded hover:bg-green-50"
              >
                <Settings size={18} />
                <span>Pengaturan</span>
              </Link>
            </li>
          </ul>
        </nav>

        <div className="absolute bottom-4 left-4 right-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 p-2 border border-red-200 text-red-600 rounded hover:bg-red-50"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 md:ml-64 p-4 md:p-8">
        <div className="md:hidden mb-4 flex items-center justify-between">
          <button
            aria-label="Open menu"
            className="p-2.5 bg-white rounded-xl shadow-sm border border-gray-100"
            onClick={() => setIsOpen(true)}
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2">
            <Store className="text-green-600" size={20} />
            <span className="text-xs font-black text-green-600">ATAYATOKO2 Admin</span>
          </div>
          <div />
        </div>
        {children}
      </main>
    </div>
  );
}
