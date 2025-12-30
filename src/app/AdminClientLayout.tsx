'use client';

import Link from 'next/link';
import {
  Store,
  Home,
  Package,
  ShoppingCart,
  Users,
  Settings,
  LogOut,
} from 'lucide-react';

export default function AdminClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed w-64 bg-white shadow-md h-full">
        <div className="p-5 border-b">
          <div className="flex items-center space-x-2">
            <Store className="text-green-600" size={28} />
            <h1 className="text-xl font-bold text-green-600">
              ATAYATOKO2
            </h1>
          </div>
          <p className="text-xs text-gray-600">Admin Dashboard</p>
        </div>

        <nav className="p-4">
          <ul className="space-y-2">
            <li>
              <Link
                href="/admin"
                className="flex items-center space-x-3 p-2 rounded hover:bg-green-50"
              >
                <Home size={18} />
                <span>Dashboard</span>
              </Link>
            </li>

            <li>
              <Link
                href="/admin/products"
                className="flex items-center space-x-3 p-2 rounded hover:bg-green-50"
              >
                <Package size={18} />
                <span>Produk</span>
              </Link>
            </li>

            <li>
              <Link
                href="/admin/orders"
                className="flex items-center space-x-3 p-2 rounded hover:bg-green-50"
              >
                <ShoppingCart size={18} />
                <span>Pesanan</span>
              </Link>
            </li>

            <li>
              <Link
                href="/admin/customers"
                className="flex items-center space-x-3 p-2 rounded hover:bg-green-50"
              >
                <Users size={18} />
                <span>Pelanggan</span>
              </Link>
            </li>

            <li>
              <Link
                href="/admin/suppliers"
                className="flex items-center space-x-3 p-2 rounded hover:bg-green-50"
              >
                <Store size={18} />
                <span>Supplier</span>
              </Link>
            </li>

            <li>
              <Link
                href="/admin/purchases"
                className="flex items-center space-x-3 p-2 rounded hover:bg-green-50"
              >
                <Package size={18} />
                <span>Pembelian</span>
              </Link>
            </li>

            <li>
              <Link
                href="/admin/reports"
                className="flex items-center space-x-3 p-2 rounded hover:bg-green-50"
              >
                <Settings size={18} />
                <span>Laporan</span>
              </Link>
            </li>

            <li>
              <Link
                href="/admin/settings"
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
      </div>

      {/* Content */}
      <main className="ml-64 p-8">{children}</main>
    </div>
  );
}
