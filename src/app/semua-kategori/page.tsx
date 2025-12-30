// src/app/semua-kategori/page.tsx
'use client';

import Link from 'next/link';
import { Store, Package } from 'lucide-react';

const categories = [
  { id: 1, name: 'Beras & Tepung', icon: '🍚', slug: 'beras-tepung' },
  { id: 2, name: 'Minyak & Gula', icon: '🍯', slug: 'minyak-gula' },
  { id: 3, name: 'Bumbu Dapur', icon: '🌶️', slug: 'bumbu-dapur' },
  { id: 4, name: 'Mie & Sereal', icon: '🍜', slug: 'mie-sereal' },
  { id: 5, name: 'Minuman', icon: '🥤', slug: 'minuman' },
  { id: 6, name: 'Snack & Kue', icon: '🍪', slug: 'snack-kue' },
  { id: 7, name: 'Susu & Susu Formula', icon: '🥛', slug: 'susu-formula' },
  { id: 8, name: 'Kebutuhan Pokok', icon: '🧼', slug: 'kebutuhan-pokok' }
];

export default function AllCategoriesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Mini */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-2">
            <Store className="text-green-600" size={28} />
            <div>
              <h1 className="text-xl font-bold text-green-600">ATAYATOKO</h1>
              <p className="text-xs text-gray-600">Ecer & Grosir</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <Link href="/" className="text-green-600 hover:text-green-700">&larr; Kembali ke Beranda</Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">Semua Kategori</h1>
          <p className="text-gray-600">
            Jelajahi semua kategori produk sembako kami — lengkap, murah, dan siap antar!
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((category) => (
            <Link 
              key={category.id} 
              href={`/kategori/${category.slug}`}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 text-center group"
            >
              <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-green-100 transition-colors">
                <span className="text-2xl">{category.icon}</span>
              </div>
              <h2 className="font-semibold text-gray-900 text-lg group-hover:text-green-600 transition-colors">
                {category.name}
              </h2>
            </Link>
          ))}
        </div>

        {/* CTA Footer */}
        <div className="mt-16 text-center bg-green-50 rounded-xl p-8">
          <Package className="mx-auto text-green-600 mb-4" size={48} />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Belum Menemukan yang Anda Cari?</h2>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            Kami terus menambah stok barang setiap hari. Pesan dari rumah — kami antar sampai ke pintu!
          </p>
          <Link
            href="/"
            className="inline-block bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    </div>
  );
}