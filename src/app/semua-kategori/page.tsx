'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Store, Package, ArrowLeft, Loader2 } from 'lucide-react';

export default function AllCategoriesPage() {
  const [categories, setCategories] = useState<{ name: string, slug: string }[]>([]);
  const [loading, setLoading] = useState(true);

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
      'sabun': '🧼'
    };
    // Cari yang mendekati atau default ke Box
    const found = Object.keys(icons).find(key => slug.includes(key));
    return found ? icons[found] : '📦';
  };

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const q = query(
          collection(db, 'products'),
          where('isActive', '==', true),
          orderBy('name', 'asc')
        );
        const querySnapshot = await getDocs(q);
        const allKategori = querySnapshot.docs.map(doc => {
          const data = doc.data();
          // Ambil dari field 'Kategori' atau 'category'
          return data.Kategori || data.category || 'Lainnya';
        });

        // Hilangkan duplikat
        const uniqueCategories = Array.from(new Set(allKategori));

        // Format menjadi object
        const formatted = uniqueCategories.map(cat => ({
          name: cat,
          slug: cat.toLowerCase().replace(/\s+/g, '-') // Buat slug otomatis
        }));

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
              <span className="text-[10px] font-bold text-gray-400 tracking-widest mt-1">Kategori otomatis</span>
            </div>

          </div>
          <Store className="text-green-600" size={24} />
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-10">
          <h2 className="text-3xl font-black text-gray-900 tracking-tighter leading-tight">
            Cari <span className="text-green-600">Sembako</span><br />dari database
          </h2>

        </div>

        {loading ? (
          <div className="flex flex-col items-center py-20 text-gray-400">
            <Loader2 className="animate-spin mb-4" size={40} />
            <p className="font-bold text-[10px] tracking-widest">Sinkronisasi kategori...</p>

          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Promo Selalu Ada di Awal */}
            <Link href="/kategori/promo" className="bg-red-50 border border-red-100 rounded-[2rem] p-6 text-center shadow-sm active:scale-95 transition-all">
              <div className="w-20 h-20 bg-red-600 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4 text-4xl shadow-lg">🔥</div>
              <h2 className="font-black text-[11px] text-red-600">Promo produk</h2>
              <div className="mt-2 text-[8px] font-black text-red-400 animate-pulse">Diskon spesial</div>

            </Link>

            {/* Kategori dari Database */}
            {categories.map((cat, index) => (
              <Link
                key={index}
                href={`/kategori/${cat.name}`} // Menggunakan nama asli agar cocok dengan query where('Kategori', '==', cat.name)
                className="bg-white border border-gray-100 rounded-[2rem] p-6 text-center shadow-sm hover:shadow-xl hover:border-green-500/30 transition-all active:scale-95 group"
              >
                <div className="w-20 h-20 bg-gray-50 group-hover:bg-green-600 group-hover:rotate-6 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4 transition-all duration-500 shadow-inner">
                  <span className="text-4xl group-hover:scale-110 transition-transform">
                    {getIcon(cat.slug)}
                  </span>
                </div>
                <h2 className="font-black text-[11px] tracking-tighter text-gray-800 group-hover:text-green-600 capitalize">
                  {cat.name}
                </h2>

              </Link>
            ))}
          </div>
        )}

        <div className="mt-12 bg-green-600 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-xl font-black mb-2">Update stok otomatis</h2>
            <p className="text-green-100 text-[10px] mb-6 font-bold tracking-widest opacity-80">

              Kategori ini sinkron langsung dengan data barang di gudang.
            </p>
          </div>
          <Package className="absolute -right-6 -bottom-6 text-green-500 opacity-30 -rotate-12" size={150} />
        </div>
      </div>
    </div>
  );
}
