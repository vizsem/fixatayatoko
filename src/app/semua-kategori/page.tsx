'use client';

import Link from 'next/link';
import { Store, Package, ArrowLeft, Sparkles, ChevronRight } from 'lucide-react';

// ✅ Daftar kategori dengan penambahan "Promo Produk" di posisi awal
const categories = [
  { id: 'promo', name: 'Promo Produk', icon: '🔥', slug: 'promo', isPromo: true },
  { id: 1, name: 'Beras & Tepung', icon: '🍚', slug: 'beras-dan-tepung' },
  { id: 2, name: 'Minyak & Gula', icon: '🍯', slug: 'minyak-dan-gula' },
  { id: 3, name: 'Bumbu Dapur', icon: '🌶️', slug: 'bumbu-dapur' },
  { id: 4, name: 'Mie & Sereal', icon: '🍜', slug: 'mie-dan-sereal' },
  { id: 5, name: 'Minuman', icon: '🥤', slug: 'minuman' },
  { id: 6, name: 'Snack & Kue', icon: '🍪', slug: 'snack-dan-kue' },
  { id: 7, name: 'Susu & Susu Formula', icon: '🥛', slug: 'susu-dan-susu-formula' },
  { id: 8, name: 'Kebutuhan Pokok', icon: '🧼', slug: 'kebutuhan-pokok' }
];

export default function AllCategoriesPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header Luxury Style */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <Link href="/" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <ArrowLeft size={20} className="text-gray-600" />
             </Link>
             <div className="flex flex-col">
                <h1 className="text-sm font-black uppercase tracking-tight text-green-600 leading-none">ATAYATOKO</h1>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Semua Kategori</span>
             </div>
          </div>
          <Store className="text-green-600" size={24} />
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-10">
          <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tighter leading-tight">
            Cari <span className="text-green-600">Sembako</span><br />Lebih Mudah
          </h2>
          <p className="text-gray-500 text-sm mt-2 font-medium">
            Pilih kategori untuk melihat produk lengkap kami.
          </p>
        </div>

        {/* Grid Kategori */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map((category) => (
            <Link 
              key={category.id} 
              href={`/kategori/${category.slug}`}
              className={`rounded-[2rem] border p-6 text-center group transition-all active:scale-95 shadow-sm hover:shadow-xl
                ${category.isPromo 
                  ? 'bg-red-50 border-red-100 hover:border-red-500/30' 
                  : 'bg-white border-gray-100 hover:border-green-500/30'}`}
            >
              <div className={`w-20 h-20 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4 transition-all duration-500 shadow-inner
                ${category.isPromo 
                  ? 'bg-red-600 text-white group-hover:rotate-6' 
                  : 'bg-gray-50 group-hover:bg-green-600 group-hover:rotate-6'}`}>
                <span className="text-4xl group-hover:scale-110 transition-transform">
                  {category.icon}
                </span>
              </div>
              <h2 className={`font-black text-[11px] uppercase tracking-tighter transition-colors
                ${category.isPromo ? 'text-red-600' : 'text-gray-800 group-hover:text-green-600'}`}>
                {category.name}
              </h2>
              {category.isPromo && (
                <div className="mt-2 flex items-center justify-center gap-1 text-[8px] font-black text-red-400 uppercase animate-pulse">
                  <Sparkles size={10} /> Diskon Spesial
                </div>
              )}
            </Link>
          ))}
        </div>

        {/* Info Card / Melihat Kategori Lain */}
        <div className="mt-12 bg-green-600 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-xl font-black uppercase mb-2 leading-none">Cek Kategori Lainnya?</h2>
            <p className="text-green-100 text-[10px] mb-6 max-w-xs leading-relaxed font-bold uppercase tracking-widest opacity-80">
              Kami selalu memperbarui stok setiap hari untuk Anda.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-white text-green-600 font-black py-3 px-8 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-gray-100 transition-colors shadow-lg"
            >
              Lihat Semua Produk <ChevronRight size={14} />
            </Link>
          </div>
          <Package className="absolute -right-6 -bottom-6 text-green-500 opacity-30 -rotate-12" size={150} />
        </div>
      </div>
    </div>
  );
}