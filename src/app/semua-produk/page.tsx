'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  ArrowLeft, Search, Filter, ShoppingBag, Package, 
  Sparkles, SlidersHorizontal, ChevronRight, X 
} from 'lucide-react';
import useProducts from '@/lib/hooks/useProducts';
import { ProductCard } from '@/components/home/ProductCard';
import { SkeletonCard } from '@/components/home/SkeletonCard';
import CustomerGuarantees from '@/components/common/CustomerGuarantees';
import { Product } from '@/lib/types';
import { useCart } from '@/lib/context/CartContext';
import { getWishlist, addToWishlist } from '@/lib/wishlist';

function SemuaProdukContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get('kategori') || 'SEMUA';

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [sortBy, setSortBy] = useState<'termurah' | 'termahal' | 'nama' | 'stok'>('termurah');
  const [wishlist, setWishlist] = useState<string[]>([]);

  const { products: rawProducts, loading } = useProducts({ isActive: true });
  const { addToCart, cart } = useCart();

  const cartCount = useMemo(() => {
    return cart.reduce((total, item) => total + (item.quantity || 1), 0);
  }, [cart]);

  useEffect(() => {
    setWishlist(getWishlist());
  }, []);

  const handleWishlistToggle = (id: string) => {
    addToWishlist(id);
    setWishlist(getWishlist());
  };

  // Extract Unique Categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    rawProducts.forEach((p) => {
      const cat = p.category || (p as any).Kategori;
      if (cat && cat.toLowerCase() !== 'semua') set.add(cat);
    });
    return ['SEMUA', ...Array.from(set).sort()];
  }, [rawProducts]);

  // Filter and Sort Products
  const processedProducts = useMemo(() => {
    let list = rawProducts.map((p) => {
      const priceEcer = Number(p.priceEcer ?? (p as any).Ecer ?? p.price ?? 0);
      const priceGrosir = Number(p.priceGrosir ?? (p as any).Grosir ?? priceEcer);
      const category = p.category || (p as any).Kategori || 'Umum';

      return {
        ...p,
        name: p.name || (p as any).Nama || 'Produk Sembako',
        price: priceEcer,
        wholesalePrice: priceGrosir > 0 && priceGrosir < priceEcer ? priceGrosir : 0,
        minWholesale: Number(p.minWholesaleQty || (p as any).Min_Grosir || 12),
        stock: Number(p.stock ?? (p as any).Stok ?? 0),
        unit: (p.unit || (p as any).Satuan || 'PCS').toString().toUpperCase(),
        category,
        image: p.imageUrl || (p as any).Link_Foto || '/logo-atayatoko.png',
      } as Product;
    });

    // 1. Search Query Filter
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => 
        p.name.toLowerCase().includes(q) || 
        p.category.toLowerCase().includes(q)
      );
    }

    // 2. Category Filter
    if (selectedCategory !== 'SEMUA') {
      list = list.filter((p) => 
        p.category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // 3. Sorting
    switch (sortBy) {
      case 'termurah':
        list.sort((a, b) => a.price - b.price);
        break;
      case 'termahal':
        list.sort((a, b) => b.price - a.price);
        break;
      case 'nama':
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'stok':
        list.sort((a, b) => b.stock - a.stock);
        break;
      default:
        break;
    }

    return list;
  }, [rawProducts, search, selectedCategory, sortBy]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 md:pb-16">
      {/* Top Navigation Bar */}
      <header className="bg-white/95 backdrop-blur-md sticky top-0 z-40 border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              className="p-2 hover:bg-slate-100 rounded-2xl transition-colors text-slate-700"
              title="Kembali ke Beranda"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-base md:text-lg font-black text-slate-900 tracking-tight leading-none">
                Semua Produk Sembako
              </h1>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-0.5">
                Katalog Lengkap ATAYATOKO
              </p>
            </div>
          </div>

          <Link
            href="/cart"
            className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-2xl relative transition-all"
            title="Keranjang Belanja"
          >
            <ShoppingBag size={20} />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center animate-bounce">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* Hero & Search Header */}
      <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white py-8 px-4 sm:px-6 lg:px-8 border-b border-emerald-900/30">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-white/10 px-3 py-1 rounded-full border border-emerald-500/20">
                Pusat Grosir & Eceran Kediri
              </span>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mt-2">
                Temukan Kebutuhan Pokok Anda
              </h2>
            </div>
            
            {/* Search Input Box */}
            <div className="relative w-full md:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari beras, minyak, gula, mie..."
                className="w-full bg-white/10 border border-white/20 text-white placeholder:text-slate-400 rounded-2xl pl-11 pr-10 py-3 text-xs md:text-sm outline-none focus:border-emerald-400 focus:bg-white/15 transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Category Chips Scroll */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide pt-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-900/40'
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Catalog Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Filter & Sort Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="text-xs font-bold text-slate-600">
            Menampilkan <strong className="text-emerald-700">{processedProducts.length}</strong> produk
            {selectedCategory !== 'SEMUA' && <span> di kategori <em>{selectedCategory}</em></span>}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <SlidersHorizontal size={12} /> Urutkan:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-3 py-1.5 outline-none focus:border-emerald-500"
            >
              <option value="termurah">Harga: Termurah</option>
              <option value="termahal">Harga: Termahal</option>
              <option value="nama">Nama: A - Z</option>
              <option value="stok">Stok Terbanyak</option>
            </select>
          </div>
        </div>

        {/* Product Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : processedProducts.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm my-6 space-y-4">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center mx-auto">
              <Package size={32} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800">Produk Tidak Ditemukan</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Tidak ada produk yang cocok dengan pencarian &quot;{search}&quot;. Coba gunakan kata kunci lain atau pilih kategori lain.
              </p>
            </div>
            <button
              onClick={() => { setSearch(''); setSelectedCategory('SEMUA'); }}
              className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors"
            >
              Tampilkan Semua Produk
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
            {processedProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                isWish={wishlist.includes(p.id)}
                onWishlistToggle={handleWishlistToggle}
                onAddToCart={addToCart}
              />
            ))}
          </div>
        )}

        {/* Customer Guarantees */}
        <div className="mt-12 pt-8 border-t border-slate-200">
          <CustomerGuarantees variant="cards" />
        </div>
      </main>
    </div>
  );
}

export default function SemuaProdukPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <SemuaProdukContent />
    </Suspense>
  );
}
