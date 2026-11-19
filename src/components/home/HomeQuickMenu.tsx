'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShoppingBag,
  Tags,
  Flame,
  X,
  Search,
  ChevronRight,
  Sparkles,
  Wheat,
  Droplets,
  Coffee,
  Milk,
  Cookie,
  LeafyGreen,
  Beef,
  Fish,
  UtensilsCrossed,
  Candy,
  Shirt,
  Wind,
  Sparkle,
  FlaskConical,
  Layers,
  Star,
  Citrus,
  Package,
} from 'lucide-react';
import { Category } from '@/lib/types';

interface HomeQuickMenuProps {
  activeCategories: Category[];
  brands: string[];
}

/** Strip kode angka dari nama kategori, misal: "Kopi (700612)" → "Kopi" */
function cleanCategoryName(name: string): string {
  return name
    .replace(/\s*\(\d+\)\s*$/, '') // hapus (angka) di akhir
    .replace(/\s*\(\d{5,}\s*[-\w]*\)\s*$/, '') // hapus kode panjang
    .trim();
}

/** Ambil slug bersih dari slug kategori (hapus kode angka di akhir) */
function cleanSlug(slug: string): string {
  return slug.replace(/-\d{5,}(-[a-z]+)?-?$/, '').replace(/-+$/, '') || slug;
}

/** Daftar kategori yang dikecualikan dari quick menu (terlalu generik / admin) */
const EXCLUDED_NAMES = new Set(['semua', 'umum', 'pokok', 'lainnya', 'other', 'others', 'produk', 'all']);

/** Map nama kategori (lowercase keyword) → emoji icon modern */
function getCategoryEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('beras') || n.includes('nasi')) return '🌾';
  if (n.includes('tepung') || n.includes('baking') || n.includes('kue')) return '🥐';
  if (n.includes('gula') || n.includes('pemanis')) return '🍬';
  if (n.includes('minyak') || n.includes('goreng')) return '🫙';
  if (n.includes('garam') || n.includes('kecap') || n.includes('saos') || n.includes('saus') || n.includes('bumbu')) return '🧂';
  if (n.includes('bahan')) return '🛒';
  if (n.includes('mie') || n.includes('mi ') || n.includes('pasta')) return '🍜';
  if (n.includes('kopi')) return '☕';
  if (n.includes('teh')) return '🍵';
  if (n.includes('susu') || n.includes('dairy') || n.includes('yogurt')) return '🥛';
  if (n.includes('minuman') || n.includes('miuman') || n.includes('drink') || n.includes('jus') || n.includes('sirup')) return '🥤';
  if (n.includes('snack') || n.includes('keripik') || n.includes('camilan') || n.includes('biskuit') || n.includes('coklat') || n.includes('permen')) return '🍿';
  if (n.includes('makanan kalengan') || n.includes('kalengan') || n.includes('stoples')) return '🥫';
  if (n.includes('makanan')) return '🍱';
  if (n.includes('ikan') || n.includes('seafood')) return '🐟';
  if (n.includes('daging') || n.includes('ayam')) return '🥩';
  if (n.includes('sayur') || n.includes('buah')) return '🥦';
  if (n.includes('biji') || n.includes('kacang') || n.includes('bijian')) return '🌰';
  if (n.includes('deterjen') || n.includes('cuci') || n.includes('sabun')) return '🧴';
  if (n.includes('pewangi') || n.includes('parfum') || n.includes('wewangian')) return '✨';
  if (n.includes('kebersihan') || n.includes('pembersih') || n.includes('toilet') || n.includes('tisu')) return '🧹';
  if (n.includes('perawatan') || n.includes('kecantikan') || n.includes('kosmetik') || n.includes('skincare')) return '💄';
  if (n.includes('salon') || n.includes('spa') || n.includes('rambut')) return '💆';
  if (n.includes('pasta gigi') || n.includes('gigi') || n.includes('mulut')) return '🪥';
  if (n.includes('set ') || n.includes('paket') || n.includes('bundle')) return '🎁';
  if (n.includes('vitamin') || n.includes('suplemen') || n.includes('obat')) return '💊';
  return '🏪';
}

/** Lucide icon component berdasarkan nama kategori (untuk kategori penting yg perlu ikon vektor) */
function getCategoryLucideIcon(name: string): React.ReactNode | null {
  const n = name.toLowerCase();
  const cls = 'text-emerald-600 group-hover:text-emerald-700 transition-colors';
  if (n.includes('beras') || n.includes('tepung') || n.includes('biji')) return <Wheat size={20} className={cls} />;
  if (n.includes('minyak')) return <Droplets size={20} className={cls} />;
  if (n.includes('kopi')) return <Coffee size={20} className={cls} />;
  if (n.includes('susu')) return <Milk size={20} className={cls} />;
  if (n.includes('snack') || n.includes('keripik') || n.includes('camilan') || n.includes('biskuit')) return <Cookie size={20} className={cls} />;
  if (n.includes('sayur') || n.includes('buah')) return <LeafyGreen size={20} className={cls} />;
  if (n.includes('daging') || n.includes('ayam')) return <Beef size={20} className={cls} />;
  if (n.includes('ikan') || n.includes('seafood')) return <Fish size={20} className={cls} />;
  if (n.includes('mie') || n.includes('makanan')) return <UtensilsCrossed size={20} className={cls} />;
  if (n.includes('gula') || n.includes('permen') || n.includes('coklat')) return <Candy size={20} className={cls} />;
  if (n.includes('deterjen') || n.includes('cuci') || n.includes('sabun')) return <Wind size={20} className={cls} />;
  if (n.includes('pewangi') || n.includes('parfum')) return <Sparkle size={20} className={cls} />;
  if (n.includes('perawatan') || n.includes('kosmetik') || n.includes('kecantikan')) return <Star size={20} className={cls} />;
  if (n.includes('vitamin') || n.includes('suplemen') || n.includes('obat')) return <FlaskConical size={20} className={cls} />;
  if (n.includes('set ') || n.includes('paket') || n.includes('bundle')) return <Layers size={20} className={cls} />;
  if (n.includes('teh') || n.includes('minuman') || n.includes('miuman')) return <Citrus size={20} className={cls} />;
  if (n.includes('bumbu') || n.includes('bahan') || n.includes('saus')) return <Shirt size={20} className="text-orange-500 group-hover:text-orange-600 transition-colors" />;
  return null;
}

export default function HomeQuickMenu({ activeCategories, brands }: HomeQuickMenuProps) {
  const router = useRouter();
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [brandSearch, setBrandSearch] = useState('');

  /** Deduplikasi dan bersihkan kategori:
   *  - Hapus kode angka dari nama
   *  - Buang kategori duplikat (sama setelah dibersihkan → ambil yang tanpa kode)
   *  - Buang kategori generik/admin
   *  - Maks 16 kategori di quick menu agar tidak terlalu panjang
   */
  const cleanedCategories = useMemo(() => {
    const seen = new Map<string, Category & { cleanName: string; cleanSlug: string }>();
    for (const cat of activeCategories) {
      const cleanName = cleanCategoryName(cat.name);
      const key = cleanName.toLowerCase().trim();
      // Skip kategori generik/admin
      if (EXCLUDED_NAMES.has(key)) continue;
      // Jika sudah ada versi bersih (tanpa kode), skip yang berkode
      if (!seen.has(key)) {
        seen.set(key, { ...cat, cleanName, cleanSlug: cleanSlug(cat.slug) });
      } else {
        // Prefer yang namanya sudah bersih (tidak ada kode angka)
        const existing = seen.get(key)!;
        if (cleanName === cat.name && existing.cleanName !== cat.name) {
          // versi baru lebih bersih, ganti
          seen.set(key, { ...cat, cleanName, cleanSlug: cleanSlug(cat.slug) });
        }
      }
    }
    return Array.from(seen.values()).slice(0, 16);
  }, [activeCategories]);

  const filteredBrands = brands.filter((b) =>
    b.toLowerCase().includes(brandSearch.toLowerCase().trim())
  );

  const handleSelectBrand = (brand: string) => {
    setIsBrandModalOpen(false);
    router.push(`/semua-produk?search=${encodeURIComponent(brand)}`);
  };

  return (
    <section className="mb-5 px-4" aria-label="Menu Akses Cepat">
      <div className="bg-white rounded-2xl sm:rounded-3xl px-3.5 py-3 sm:px-4 sm:py-3.5 border border-slate-100 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 px-0.5">
          <span className="text-[11px] font-black text-gray-600 tracking-widest uppercase flex items-center gap-1.5">
            <Sparkles size={12} className="text-emerald-500 fill-emerald-500" />
            Jelajahi Toko
          </span>
          <Link
            href="/semua-kategori"
            className="text-[11px] font-bold text-gray-400 hover:text-emerald-600 transition-colors flex items-center gap-0.5"
          >
            Semua <ChevronRight size={11} />
          </Link>
        </div>

        {/* Scroll Row */}
        <div className="flex overflow-x-auto gap-2.5 sm:gap-3 scrollbar-hide pb-1 -mx-1 px-1 snap-x scroll-smooth">

          {/* 1. Semua Produk */}
          <Link
            href="/semua-produk"
            className="flex flex-col items-center gap-1 shrink-0 group text-center w-[60px] sm:w-[66px] snap-start"
          >
            <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 flex items-center justify-center shadow-xs group-hover:scale-105 group-active:scale-95 transition-all duration-200">
              <ShoppingBag size={20} className="text-emerald-600" />
            </div>
            <span className="text-[10px] sm:text-[11px] font-bold text-gray-700 group-hover:text-emerald-700 transition-colors leading-tight line-clamp-2 w-full text-center">
              Semua Produk
            </span>
          </Link>

          {/* 2. Lihat Brand */}
          <button
            type="button"
            onClick={() => setIsBrandModalOpen(true)}
            className="flex flex-col items-center gap-1 shrink-0 group text-center w-[60px] sm:w-[66px] snap-start"
          >
            <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-violet-50 hover:bg-violet-100 border border-violet-100 flex items-center justify-center shadow-xs group-hover:scale-105 group-active:scale-95 transition-all duration-200">
              <Tags size={20} className="text-violet-600" />
            </div>
            <span className="text-[10px] sm:text-[11px] font-bold text-gray-700 group-hover:text-violet-700 transition-colors leading-tight line-clamp-2 w-full text-center">
              Lihat Brand
            </span>
          </button>

          {/* 3. Promo Spesial */}
          <Link
            href="/kategori/promo"
            className="flex flex-col items-center gap-1 shrink-0 group text-center w-[60px] sm:w-[66px] snap-start"
          >
            <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-100 flex items-center justify-center shadow-xs group-hover:scale-105 group-active:scale-95 transition-all duration-200">
              <Flame size={20} className="text-rose-500 fill-rose-400" />
            </div>
            <span className="text-[10px] sm:text-[11px] font-bold text-gray-700 group-hover:text-rose-600 transition-colors leading-tight line-clamp-2 w-full text-center">
              Promo
            </span>
          </Link>

          {/* Divider */}
          <div className="w-px h-9 bg-gray-200 self-center shrink-0 mx-0.5" />

          {/* 4. Kategori Aktif */}
          {cleanedCategories.map((cat) => {
            const lucideIcon = getCategoryLucideIcon(cat.cleanName);
            const emoji = getCategoryEmoji(cat.cleanName);
            return (
              <Link
                key={cat.id}
                href={`/kategori/${cat.cleanSlug}`}
                className="flex flex-col items-center gap-1 shrink-0 group text-center w-[60px] sm:w-[66px] snap-start"
              >
                <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-gray-50 hover:bg-emerald-50 border border-gray-100 hover:border-emerald-200 flex items-center justify-center shadow-xs group-hover:scale-105 group-active:scale-95 transition-all duration-200">
                  {/* Prioritas: icon dari db → Lucide → emoji */}
                  {cat.icon && cat.icon.length <= 4 ? (
                    <span className="text-lg">{cat.icon}</span>
                  ) : lucideIcon ? (
                    lucideIcon
                  ) : (
                    <span className="text-lg">{emoji}</span>
                  )}
                </div>
                <span className="text-[10px] sm:text-[11px] font-bold text-gray-700 group-hover:text-emerald-700 transition-colors leading-tight line-clamp-2 w-full text-center">
                  {cat.cleanName}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* MODAL PILIH BRAND */}
      {isBrandModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-xs"
          onClick={() => setIsBrandModalOpen(false)}
        >
          <div
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-slate-100 flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                  <Tags size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Pilih Brand</h3>
                  <p className="text-[11px] text-slate-400 font-medium">{brands.length} brand tersedia</p>
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

            {/* Search */}
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
                placeholder="Cari brand (cth: Indomie, Sania)..."
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 placeholder-slate-400 outline-none focus:border-violet-400 focus:bg-white transition-all"
                autoFocus
              />
            </div>

            {/* Brand List */}
            <div className="overflow-y-auto flex-1 pr-0.5">
              {filteredBrands.length === 0 ? (
                <div className="py-10 text-center text-slate-400">
                  <Package size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-bold">Brand &quot;{brandSearch}&quot; tidak ditemukan</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  {filteredBrands.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => handleSelectBrand(b)}
                      className="px-3 py-2.5 rounded-xl border border-slate-100 hover:border-violet-200 hover:bg-violet-50/60 text-left transition-all group flex items-center justify-between gap-1"
                    >
                      <span className="text-xs font-black text-slate-800 group-hover:text-violet-700 truncate">
                        {b}
                      </span>
                      <ChevronRight size={12} className="text-slate-300 group-hover:text-violet-500 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-100 mt-3 flex justify-between items-center">
              <span className="text-[11px] text-slate-400 font-medium">
                {filteredBrands.length} dari {brands.length} brand
              </span>
              <button
                type="button"
                onClick={() => { setIsBrandModalOpen(false); router.push('/semua-produk'); }}
                className="text-xs font-bold text-slate-500 hover:text-violet-700 transition-colors flex items-center gap-1"
              >
                Semua Produk <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
