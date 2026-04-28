'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Search, Filter, SlidersHorizontal, Package, ArrowUp, ArrowDown } from 'lucide-react';
import useProducts from '@/lib/hooks/useProducts';
import { ProductCard } from '@/components/home/ProductCard';
import { SkeletonCard } from '@/components/home/SkeletonCard';
import { Product } from '@/lib/types';
import { useCart } from '@/lib/context/CartContext';
import { getWishlist, addToWishlist } from '@/lib/wishlist';

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const initialCategory = searchParams.get('category') || '';

  const [query, setQuery] = useState(initialQuery);
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [categoryFilter, setCategoryFilter] = useState(initialCategory);
  const [priceMin, setPriceMin] = useState<string>('');
  const [priceMax, setPriceMax] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'price_asc' | 'price_desc'>('name');
  
  const [showFilters, setShowFilters] = useState(false);
  const [wishlist, setWishlist] = useState<string[]>([]);

  const { products: rawProducts, loading } = useProducts({ isActive: true });
  const { addToCart } = useCart();

  useEffect(() => {
    setWishlist(getWishlist());
  }, []);

  const handleWishlistToggle = (id: string) => {
    addToWishlist(id);
    setWishlist(getWishlist());
  };

  const categories = useMemo(() => {
    const cats = new Set(rawProducts.map(p => p.category || 'Umum'));
    return Array.from(cats).sort();
  }, [rawProducts]);

  const filteredProducts = useMemo(() => {
    let result = rawProducts.map(p => ({
      ...p,
      name: p.name || 'Produk',
      price: Number(p.priceEcer || 0),
      wholesalePrice: Number(p.priceGrosir || p.priceEcer || 0),
      minWholesale: Number(p.minWholesaleQty || 1),
      stock: Number(p.stock || 0),
      unit: (p.unit || 'PCS').toString().toUpperCase(),
      category: p.category || 'Umum',
      image: p.imageUrl || '/logo-atayatoko.png',
    } as Product));

    if (query) {
      const q = query.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
    }

    if (categoryFilter) {
      result = result.filter(p => p.category === categoryFilter);
    }

    if (priceMin) {
      result = result.filter(p => p.price >= Number(priceMin));
    }

    if (priceMax) {
      result = result.filter(p => p.price <= Number(priceMax));
    }

    switch (sortBy) {
      case 'price_asc':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price_desc':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'name':
      default:
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return result;
  }, [rawProducts, query, categoryFilter, priceMin, priceMax, sortBy]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(searchInput);
    
    // Update URL implicitly without reload
    const params = new URLSearchParams(searchParams.toString());
    if (searchInput) params.set('q', searchInput);
    else params.delete('q');
    
    if (categoryFilter) params.set('category', categoryFilter);
    else params.delete('category');
    
    router.replace(`/search?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      {/* Header & Search Bar */}
      <header className="bg-white sticky top-0 z-50 border-b border-slate-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4">
           <div className="flex items-center gap-3 mb-4">
              <button onClick={() => router.back()} className="p-2.5 bg-slate-50 text-slate-900 rounded-2xl hover:bg-slate-100 transition-all">
                <ChevronLeft size={20} />
              </button>
              <form onSubmit={handleSearchSubmit} className="flex-1 relative">
                 <input 
                   type="text" 
                   value={searchInput}
                   onChange={e => setSearchInput(e.target.value)}
                   placeholder="Cari kebutuhan grosir Anda..."
                   className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold outline-none focus:bg-white focus:border-green-500 transition-all shadow-inner"
                 />
                 <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              </form>
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`p-3 rounded-2xl border transition-all ${showFilters ? 'bg-green-600 text-white border-green-600 shadow-lg shadow-green-100' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >
                <SlidersHorizontal size={20} />
              </button>
           </div>

           {/* Expandable Filters */}
           <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showFilters ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="pt-2 pb-4 space-y-6">
                 {/* Categories */}
                 <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                       <Package size={14} /> Kategori
                    </label>
                    <div className="flex flex-wrap gap-2">
                       <button
                         onClick={() => setCategoryFilter('')}
                         className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!categoryFilter ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
                       >
                         Semua
                       </button>
                       {categories.map(cat => (
                         <button
                           key={cat}
                           onClick={() => setCategoryFilter(cat)}
                           className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${categoryFilter === cat ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
                         >
                           {cat}
                         </button>
                       ))}
                    </div>
                 </div>

                 {/* Price & Sort */}
                 <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 block">
                          Rentang Harga
                       </label>
                       <div className="flex items-center gap-3">
                          <input 
                            type="number" 
                            placeholder="Min Rp" 
                            value={priceMin}
                            onChange={e => setPriceMin(e.target.value)}
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-green-500" 
                          />
                          <span className="text-slate-300">-</span>
                          <input 
                            type="number" 
                            placeholder="Max Rp" 
                            value={priceMax}
                            onChange={e => setPriceMax(e.target.value)}
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-green-500" 
                          />
                       </div>
                    </div>
                    
                    <div className="md:w-64">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 block">
                          Urutkan Berdasarkan
                       </label>
                       <select 
                         value={sortBy} 
                         onChange={(e) => setSortBy(e.target.value as any)}
                         className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-tight outline-none focus:border-green-500 appearance-none"
                       >
                         <option value="name">Nama (A-Z)</option>
                         <option value="price_asc">Harga Terendah</option>
                         <option value="price_desc">Harga Tertinggi</option>
                       </select>
                    </div>
                 </div>
                 
                 <div className="flex justify-end pt-2 border-t border-slate-100">
                    <button 
                      onClick={() => {
                        setCategoryFilter(''); setPriceMin(''); setPriceMax(''); setSortBy('name');
                      }}
                      className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 transition-colors px-4 py-2"
                    >
                      Reset Filter
                    </button>
                 </div>
              </div>
           </div>
        </div>
      </header>

      {/* Results */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex justify-between items-end mb-6">
           <h1 className="text-xl font-black uppercase tracking-tighter text-slate-800">
             {query ? `Hasil untuk "${query}"` : categoryFilter ? `Kategori: ${categoryFilter}` : 'Semua Produk'}
           </h1>
           <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-widest">
             {loading ? '...' : filteredProducts.length} Produk
           </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
             {[...Array(10)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredProducts.map(p => (
              <ProductCard 
                key={p.id} 
                product={p} 
                promoInfo={{ price: p.price, hasPromo: false, promoName: null }} 
                isWish={wishlist.includes(p.id)} 
                onWishlistToggle={handleWishlistToggle} 
                onAddToCart={addToCart} 
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-[3rem] border border-slate-100 py-20 px-4 text-center shadow-sm">
             <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Search size={40} className="text-slate-300" />
             </div>
             <h3 className="text-lg font-black uppercase tracking-tighter text-slate-800 mb-2">Produk Tidak Ditemukan</h3>
             <p className="text-xs font-bold text-slate-400 max-w-sm mx-auto mb-8">
               Maaf, kami tidak menemukan produk yang cocok dengan pencarian atau filter Anda.
             </p>
             <button 
               onClick={() => { setQuery(''); setSearchInput(''); setCategoryFilter(''); setPriceMin(''); setPriceMax(''); router.replace('/search'); }}
               className="bg-green-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-green-200 hover:scale-105 active:scale-95 transition-all"
             >
               Lihat Semua Produk
             </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center"><div className="w-10 h-10 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" /></div>}>
      <SearchPageContent />
    </Suspense>
  );
}
