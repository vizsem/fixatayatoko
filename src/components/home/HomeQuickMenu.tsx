'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ShoppingBag, 
  Tags, 
  Flame, 
  Package, 
  X, 
  Search, 
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { Category } from '@/lib/types';
import { formatProductName } from '@/lib/format';

interface HomeQuickMenuProps {
  activeCategories: Category[];
  brands: string[];
}

export default function HomeQuickMenu({ activeCategories, brands }: HomeQuickMenuProps) {
  const router = useRouter();
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [brandSearch, setBrandSearch] = useState('');

  const filteredBrands = brands.filter((b) =>
    b.toLowerCase().includes(brandSearch.toLowerCase().trim())
  );

  const handleSelectBrand = (brand: string) => {
    setIsBrandModalOpen(false);
    router.push(`/semua-produk?search=${encodeURIComponent(brand)}`);
  };

  return (
    <section className="mb-6 px-4" aria-label="Menu Akses Cepat">
      {/* Scrollable Quick Menu Grid */}
      <div className="bg-white rounded-3xl p-3.5 sm:p-4 border border-slate-100 shadow-2xs">
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs font-black text-gray-800 tracking-tight uppercase flex items-center gap-1.5">
            <Sparkles size={13} className="text-emerald-600 fill-emerald-600" />
            Jelajahi Toko
          </span>
          <Link
            href="/semua-kategori"
            className="text-[11px] font-bold text-gray-400 hover:text-emerald-600 transition-colors flex items-center gap-0.5"
          >
            Semua Kategori <ChevronRight size={12} />
          </Link>
        </div>

        {/* Baris Icon Navigasi Horizontal */}
        <div className="flex overflow-x-auto gap-3 sm:gap-4 scrollbar-hide pb-1 pt-0.5 -mx-1 px-1 snap-x scroll-smooth">
          {/* 1. Icon Semua Produk */}
          <Link
            href="/semua-produk"
            className="flex flex-col items-center gap-1.5 shrink-0 group text-center w-[68px] sm:w-[76px] snap-start"
          >
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-100/90 text-emerald-700 flex items-center justify-center shadow-2xs group-hover:scale-105 group-active:scale-95 transition-all">
              <ShoppingBag size={22} className="text-emerald-600" />
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-gray-800 group-hover:text-emerald-700 transition-colors leading-tight line-clamp-2">
              Semua Produk
            </span>
          </Link>

          {/* 2. Icon Lihat Produk dari Brand */}
          <button
            type="button"
            onClick={() => setIsBrandModalOpen(true)}
            className="flex flex-col items-center gap-1.5 shrink-0 group text-center w-[68px] sm:w-[76px] snap-start"
          >
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-violet-50 hover:bg-violet-100/80 border border-violet-100/90 text-violet-700 flex items-center justify-center shadow-2xs group-hover:scale-105 group-active:scale-95 transition-all">
              <Tags size={22} className="text-violet-600" />
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-gray-800 group-hover:text-violet-700 transition-colors leading-tight line-clamp-2">
              Lihat Brand
            </span>
          </button>

          {/* 3. Icon Promo & Diskon */}
          <Link
            href="/kategori/promo"
            className="flex flex-col items-center gap-1.5 shrink-0 group text-center w-[68px] sm:w-[76px] snap-start"
          >
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-rose-50 hover:bg-rose-100/80 border border-rose-100/90 text-rose-700 flex items-center justify-center shadow-2xs group-hover:scale-105 group-active:scale-95 transition-all">
              <Flame size={22} className="text-rose-600 fill-rose-500" />
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-gray-800 group-hover:text-rose-700 transition-colors leading-tight line-clamp-2">
              Promo Spesial
            </span>
          </Link>

          {/* Divider vertikal tipis pemisah fitur & kategori */}
          <div className="w-px h-10 bg-gray-200/80 self-center shrink-0 my-auto mx-0.5" />

          {/* 4. Ikon-ikon Kategori Produk yang AKTIF saja */}
          {activeCategories.map((cat) => (
            <Link
              key={cat.id}
              href={`/kategori/${cat.slug}`}
              className="flex flex-col items-center gap-1.5 shrink-0 group text-center w-[68px] sm:w-[76px] snap-start"
            >
              <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gray-50 hover:bg-emerald-50/80 border border-gray-100 hover:border-emerald-200/80 flex items-center justify-center text-lg sm:text-xl shadow-2xs group-hover:scale-105 group-active:scale-95 transition-all">
                {cat.icon && cat.icon.length <= 4 ? (
                  <span>{cat.icon}</span>
                ) : (
                  <Package size={20} className="text-gray-600 group-hover:text-emerald-600 transition-colors" />
                )}
              </div>
              <span className="text-[11px] sm:text-xs font-bold text-gray-700 group-hover:text-emerald-700 transition-colors leading-tight line-clamp-2">
                {formatProductName(cat.name)}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* MODAL PILIH BRAND */}
      {isBrandModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                  <Tags size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Pilih Brand Produk</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Tersedia {brands.length} brand di Atayatoko</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBrandModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search Brand Input */}
            <div className="relative mb-3">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
                placeholder="Cari nama brand (cth: Indomie, Sania)..."
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 placeholder-slate-400 outline-none focus:border-violet-500 focus:bg-white transition-all"
                autoFocus
              />
            </div>

            {/* List Brand Chips */}
            <div className="overflow-y-auto flex-1 pr-1 space-y-1.5 scrollbar-thin">
              {filteredBrands.length === 0 ? (
                <div className="py-10 text-center text-slate-400">
                  <p className="text-xs font-bold">Brand &quot;{brandSearch}&quot; tidak ditemukan</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {filteredBrands.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => handleSelectBrand(b)}
                      className="p-3 rounded-2xl border border-slate-100 hover:border-violet-200 hover:bg-violet-50/50 text-left transition-all group flex items-center justify-between"
                    >
                      <span className="text-xs font-black text-slate-800 group-hover:text-violet-700 truncate">
                        {b}
                      </span>
                      <ChevronRight size={13} className="text-slate-300 group-hover:text-violet-500 shrink-0 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsBrandModalOpen(false);
                  router.push('/semua-produk');
                }}
                className="text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
              >
                Lihat Semua Produk &rarr;
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

