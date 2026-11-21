'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Store, Package, ArrowLeft, Loader2 } from 'lucide-react';
import { ChipFilter, ChipKey } from '@/components/ChipFilter';
import { supabase } from '@/lib/supabase';
import { cleanCategoryName, toCategorySlug, EXCLUDED_CATEGORY_NAMES } from '@/lib/format';

export default function AllCategoriesPage() {
  const [categories, setCategories] = useState<{ name: string; slug: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChip, setActiveChip] = useState<ChipKey>('SEMUA');

  // Kategori untuk ChipFilter
  const CATEGORY_CHIPS: { key: ChipKey; label: string }[] = [
    { key: 'SEMUA', label: 'Semua' },
    { key: 'PROMO', label: 'Promo' },
    { key: 'MAKANAN', label: 'Makanan' },
    { key: 'MINUMAN', label: 'Minuman' },
    { key: 'SEMBAKO', label: 'Sembako' },
  ];

  // Daftar Emoji untuk ikon otomatis berdasarkan kata kunci
  const getIcon = (slug: string) => {
    const icons: { [key: string]: string } = {
      'makanan': '🍪',
      'minuman': '🥤',
      'sembako': '🍚',
      'promo': '🔥',
      'bumbu': '🌶️',
      'mie': '🍜',
      'susu': '🥛',
      'sabun': '🧼',
      'kopi': '☕',
      'teh': '🍵',
      'snack': '🍿',
      'kebersihan': '🧹',
      'beras': '🌾',
      'minyak': '🫙',
      'gula': '🍬',
    };
    // Cari yang mendekati atau default ke Box
    const found = Object.keys(icons).find(key => slug.includes(key));
    return found ? icons[found] : '📦';
  };

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data: rows, error } = await supabase
          .from('products')
          .select('category, raw_data, is_active')
          .eq('is_active', true);

        if (error || !rows) {
          console.error("Gagal mengambil kategori:", error);
          return;
        }

        const seen = new Map<string, { name: string; slug: string }>();

        for (const doc of rows) {
          const raw = (doc.raw_data as any) || {};
          const isArchived =
            raw.isActive === false ||
            raw.isActive === 'false' ||
            raw.status === 'ARCHIVED';
          if (isArchived) continue;

          const rawCat = (doc.category || raw.Kategori || raw.kategori || raw.category || '').trim();
          if (!rawCat) continue;

          const clean = cleanCategoryName(rawCat);
          const normKey = clean.toLowerCase();
          if (EXCLUDED_CATEGORY_NAMES.has(normKey)) continue;

          if (!seen.has(normKey)) {
            seen.set(normKey, {
              name: clean,
              slug: toCategorySlug(clean),
            });
          }
        }

        const formatted = Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name, 'id-ID'));
        setCategories(formatted);
      } catch (error) {
        console.error("Gagal mengambil kategori:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 hover:bg-gray-100 rounded-full">
              <ArrowLeft size={20} className="text-gray-600" />
            </Link>
            <div className="flex flex-col">
              <h1 className="text-sm font-black tracking-tight text-green-600 leading-none">Atayatoko</h1>
              <span className="text-xs text-slate-400 mt-0.5">Kategori otomatis</span>
            </div>

          </div>
          <Store className="text-green-600" size={24} />
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-3xl font-black text-gray-900 tracking-tighter leading-tight">
            Cari <span className="text-green-600">Sembako</span><br />dari database
          </h2>
        </div>

        {/* ChipFilter untuk kategori */}
        <ChipFilter items={CATEGORY_CHIPS} value={activeChip} onChange={setActiveChip} />

        {loading ? (
          <div className="flex flex-col items-center py-20 text-gray-400">
            <Loader2 className="animate-spin mb-4" size={40} />
            <p className="font-medium text-xs text-slate-400">Sinkronisasi kategori...</p>

          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Promo Selalu Ada di Awal */}
            {(activeChip === 'SEMUA' || activeChip === 'PROMO') && (
              <Link href="/kategori/promo" className="bg-red-50 border border-red-100 rounded-[2rem] p-6 text-center shadow-sm active:scale-95 transition-all">
                <div className="w-20 h-20 bg-red-600 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4 text-4xl shadow-lg">🔥</div>
                <h2 className="font-black text-sm font-bold text-red-600">Promo produk</h2>
                <div className="mt-2 text-xs font-semibold text-red-500 animate-pulse">Diskon spesial</div>
              </Link>
            )}

            {/* Kategori dari Database - difilter berdasarkan chip aktif */}
            {categories
              .filter(cat => {
                if (activeChip === 'SEMUA') return true;
                if (activeChip === 'MAKANAN') return cat.name.toLowerCase().includes('makanan') || cat.name.toLowerCase().includes('mie') || cat.name.toLowerCase().includes('biskuit');
                if (activeChip === 'MINUMAN') return cat.name.toLowerCase().includes('minuman') || cat.name.toLowerCase().includes('susu') || cat.name.toLowerCase().includes('teh');
                if (activeChip === 'SEMBAKO') return cat.name.toLowerCase().includes('sembako') || cat.name.toLowerCase().includes('beras') || cat.name.toLowerCase().includes('gula') || cat.name.toLowerCase().includes('minyak');
                return true;
              })
              .map((cat, index) => (
              <Link
                key={index}
                href={`/kategori/${cat.slug}`}
                className="bg-white border border-gray-100 rounded-[2rem] p-6 text-center shadow-sm hover:shadow-xl hover:border-green-500/30 transition-all active:scale-95 group"
              >
                <div className="w-20 h-20 bg-gray-50 group-hover:bg-green-600 group-hover:rotate-6 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4 transition-all duration-500 shadow-inner">
                  <span className="text-4xl group-hover:scale-110 transition-transform">
                    {getIcon(cat.slug)}
                  </span>
                </div>
                <h2 className="font-black text-sm font-semibold tracking-tight text-slate-800 group-hover:text-green-600 capitalize">
                  {cat.name}
                </h2>

              </Link>
            ))}
          </div>
        )}

        <div className="mt-12 bg-green-600 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-xl font-black mb-2">Update stok otomatis</h2>
            <p className="text-green-100 text-xs mb-4 leading-relaxed opacity-90">

              Kategori ini sinkron langsung dengan data barang di gudang.
            </p>
          </div>
          <Package className="absolute -right-6 -bottom-6 text-green-500 opacity-30 -rotate-12" size={150} />
        </div>
      </div>
    </div>
  );
}
