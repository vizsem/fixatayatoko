'use client';

import { useEffect, useState, Suspense, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { 
  ArrowLeft, ShoppingCart, Search, LayoutGrid, List, 
  ChevronLeft, ChevronRight, Sparkles, Package 
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import toast, { Toaster } from 'react-hot-toast';

type Product = {
  id: string;
  name: string;
  price: number;
  wholesalePrice: number;
  minWholesale: number;
  category: string;
  unit: string;
  image: string;
  stock: number;
};

function CategoryContent({ params }: { params: Promise<{ slug: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;
  
  const [loading, setLoading] = useState(true);
  const [allCategoryProducts, setAllCategoryProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [categoryName, setCategoryName] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 20;

  // ✅ Fungsi Proxy Gambar agar gambar eksternal (Panen Square, dll) muncul
  const getProxiedImage = (url: string) => {
    if (!url || url.includes('firebasestorage.googleapis.com') || url.startsWith('data:')) {
      return url || '/logo-atayatoko.png';
    }
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=400&output=webp`;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const productsSnap = await getDocs(collection(db, 'products'));
        
        const mapped = productsSnap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.Nama || data.name || "Produk",
            price: Number(data.Ecer || data.price) || 0,
            wholesalePrice: Number(data.Grosir || data.wholesalePrice) || 0,
            minWholesale: Number(data.Min_Grosir || data.minWholesaleQty || 12),
            category: data.Kategori || data.category || 'Umum',
            image: data.Link_Foto || data.image || '',
            unit: data.Satuan || data.unit || 'pcs',
            stock: Number(data.Stok || data.stock) || 0
          };
        }) as Product[];

        const filtered = mapped.filter(p => {
          const generatedSlug = p.category.toLowerCase()
            .replace(/&/g, 'dan')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
          return generatedSlug === slug;
        });

        if (filtered.length > 0) {
          setCategoryName(filtered[0].category);
          setAllCategoryProducts(filtered);
        } else {
          setCategoryName(slug.replace(/-/g, ' '));
        }
      } catch (error) {
        console.error(error);
        toast.error("Gagal memuat produk");
      } finally {
        setLoading(false);
      }
    };
    if (slug) fetchData();
  }, [slug]);

  useEffect(() => {
    const searched = allCategoryProducts.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredProducts(searched);
    setCurrentPage(1);
  }, [searchQuery, allCategoryProducts]);

  const indexOfLastProduct = currentPage * productsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
  const currentItems = filteredProducts.slice(indexOfFirstProduct, indexOfLastProduct);
  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);

  const addToCart = (p: Product) => {
    let cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const existingIdx = cart.findIndex((item: any) => item.id === p.id);
    if (existingIdx >= 0) cart[existingIdx].quantity += 1;
    else cart.push({ ...p, quantity: 1 });
    
    localStorage.setItem('cart', JSON.stringify(cart));
    window.dispatchEvent(new Event('cart-updated'));
    toast.success("Berhasil ditambah!");
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <div className="w-12 h-12 border-4 border-green-100 border-t-green-600 rounded-full animate-spin mb-4"></div>
      <p className="text-[10px] font-black uppercase tracking-widest text-green-600">Menyiapkan Produk...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <Toaster position="top-center" reverseOrder={false} />
      
      {/* HEADER MOBILE OPTIMIZED */}
      <header className="bg-white/80 backdrop-blur-xl sticky top-0 z-50 border-b border-gray-100 px-4 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button onClick={() => router.back()} className="p-2.5 bg-gray-50 rounded-2xl active:scale-90 transition-transform">
                <ArrowLeft size={18}/>
              </button>
              <div>
                <h1 className="text-[11px] font-black text-green-600 uppercase tracking-tighter leading-none mb-1">{categoryName}</h1>
                <p className="text-[10px] font-bold text-gray-400 uppercase">{filteredProducts.length} Produk Tersedia</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')} 
                className="p-2.5 bg-gray-50 rounded-2xl text-gray-600 active:scale-90 transition-all"
              >
                {viewMode === 'grid' ? <List size={20}/> : <LayoutGrid size={20}/>}
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
            <input 
              type="text" 
              placeholder="Cari di kategori ini..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-100 border-none rounded-2xl py-3.5 pl-12 pr-4 text-xs font-bold focus:ring-2 focus:ring-green-500/20 transition-all"
            />
          </div>
        </div>
      </header>

      {/* PRODUCT CONTENT */}
      <div className="max-w-7xl mx-auto px-4 mt-6">
        {currentItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Package size={48} className="text-gray-200 mb-4" />
            <p className="font-black text-gray-300 uppercase italic text-xs tracking-widest">Produk Tidak Ditemukan</p>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3" : "flex flex-col gap-3"}>
            {currentItems.map((product) => (
              <div 
                key={product.id} 
                className={`bg-white border border-gray-100 shadow-sm transition-all active:scale-[0.98] ${
                  viewMode === 'grid' 
                  ? 'rounded-[2rem] p-3 flex flex-col' 
                  : 'rounded-[1.5rem] p-3 flex gap-4 items-center'
                }`}
              >
                {/* Image Container */}
                <Link 
                  href={`/produk/${product.id}`} 
                  className={`${viewMode === 'grid' ? 'aspect-square w-full mb-3' : 'w-24 h-24'} block overflow-hidden rounded-[1.5rem] bg-gray-50 relative flex-shrink-0`}
                >
                  <Image 
                    src={getProxiedImage(product.image)} 
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes={viewMode === 'grid' ? "50vw" : "100px"}
                  />
                  {product.wholesalePrice > 0 && (
                    <div className="absolute top-2 left-2 bg-blue-600 text-[7px] text-white font-black px-2 py-1 rounded-lg uppercase shadow-lg flex items-center gap-1">
                      <Sparkles size={8} /> Grosir
                    </div>
                  )}
                </Link>

                {/* Info Container */}
                <div className="flex-1 flex flex-col">
                  <h3 className="text-[10px] font-black text-gray-800 uppercase line-clamp-2 leading-tight mb-1">{product.name}</h3>
                  <div className="mb-3 mt-auto">
                    <p className="text-[14px] font-black text-green-600">Rp{product.price.toLocaleString('id-ID')}</p>
                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">Per {product.unit}</p>
                  </div>
                  <button 
                    onClick={() => addToCart(product)} 
                    className="w-full py-3 bg-gray-900 text-white text-[9px] font-black rounded-xl uppercase tracking-widest active:bg-green-600 shadow-md"
                  >
                    + Keranjang
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MODERN PAGINATION */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-12 bg-white p-2 rounded-[2rem] border border-gray-100 shadow-sm">
            <button 
              disabled={currentPage === 1}
              onClick={() => {
                setCurrentPage(prev => prev - 1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="p-4 bg-gray-50 rounded-full disabled:opacity-20 transition-all active:bg-green-100"
            >
              <ChevronLeft size={20}/>
            </button>
            
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-black uppercase text-gray-400">Halaman</span>
              <span className="text-[12px] font-black text-green-600 mx-1">{currentPage}</span>
              <span className="text-[10px] font-black uppercase text-gray-400">dari {totalPages}</span>
            </div>

            <button 
              disabled={currentPage === totalPages}
              onClick={() => {
                setCurrentPage(prev => prev + 1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="p-4 bg-gray-50 rounded-full disabled:opacity-20 transition-all active:bg-green-100"
            >
              <ChevronRight size={20}/>
            </button>
          </div>
        )}
      </div>

      {/* MOBILE FLOATING CART (Optional) */}
      <Link href="/cart" className="fixed bottom-6 right-6 z-[60] bg-green-600 text-white p-5 rounded-full shadow-2xl active:scale-90 transition-all md:hidden">
        <ShoppingCart size={24} />
      </Link>
    </div>
  );
}

export default function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-black uppercase text-xs">Menghubungkan...</div>}>
      <CategoryContent params={params} />
    </Suspense>
  );
}