'use client';

import { useEffect, useState, Suspense, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Store, Package, ArrowLeft, ShoppingCart, Search, X, LayoutGrid, List, ChevronLeft, ChevronRight } from 'lucide-react';
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
  
  // Fitur Pencarian & Tampilan
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Fitur Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 20;

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
          const generatedSlug = p.category.toLowerCase().replace(/&/g, 'dan').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
          return generatedSlug === slug;
        });

        if (filtered.length > 0) {
          setCategoryName(filtered[0].category);
          setAllCategoryProducts(filtered);
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

  // Logic Filter Search & Pagination
  useEffect(() => {
    const searched = allCategoryProducts.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredProducts(searched);
    setCurrentPage(1); // Reset ke hal 1 jika mencari
  }, [searchQuery, allCategoryProducts]);

  // Hitung Data Per Halaman
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

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black text-green-600 animate-pulse">MEMUAT...</div>;

  return (
    <div className="min-h-screen bg-white pb-32">
      <Toaster position="top-center" />
      
      {/* HEADER FIXED */}
      <header className="bg-white/90 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100 px-4 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button onClick={() => router.back()} className="p-2 bg-gray-50 rounded-full"><ArrowLeft size={18}/></button>
              <div>
                <h1 className="text-[10px] font-black text-green-600 uppercase tracking-widest">{categoryName}</h1>
                <p className="text-[12px] font-bold text-gray-400">{filteredProducts.length} Produk</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')} className="p-2 bg-gray-50 rounded-lg text-gray-600">
                {viewMode === 'grid' ? <List size={20}/> : <LayoutGrid size={20}/>}
              </button>
              <Link href="/cart" className="p-2 bg-green-50 text-green-600 rounded-full relative">
                <ShoppingCart size={20}/>
              </Link>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
            <input 
              type="text" placeholder="Cari di kategori ini..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-2xl py-3 pl-12 pr-4 text-xs font-bold"
            />
          </div>
        </div>
      </header>

      {/* PRODUK LIST/GRID */}
      <div className="max-w-7xl mx-auto px-4 mt-6">
        {currentItems.length === 0 ? (
          <div className="text-center py-20 font-black text-gray-300 uppercase italic text-sm">Produk Tidak Ditemukan</div>
        ) : (
          <div className={viewMode === 'grid' ? "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4" : "flex flex-col gap-3"}>
            {currentItems.map((product) => (
              <div key={product.id} className={`bg-white border border-gray-100 shadow-sm transition-all ${viewMode === 'grid' ? 'rounded-[2.5rem] p-3' : 'rounded-3xl p-4 flex gap-4 items-center'}`}>
                
                {/* Image */}
                <Link href={`/produk/${product.id}`} className={`${viewMode === 'grid' ? 'aspect-square w-full mb-3' : 'w-24 h-24'} block overflow-hidden rounded-[1.8rem] bg-gray-50 relative flex-shrink-0`}>
                  <img src={product.image || '/logo-atayatoko.png'} alt="" className="w-full h-full object-cover"/>
                  {product.wholesalePrice > 0 && (
                    <div className="absolute top-2 left-2 bg-blue-600 text-[6px] text-white font-black px-2 py-1 rounded-full uppercase">Grosir</div>
                  )}
                </Link>

                {/* Info */}
                <div className="flex-1">
                  <h3 className="text-[10px] font-black text-gray-800 uppercase line-clamp-2 leading-tight mb-1">{product.name}</h3>
                  <div className="mb-3">
                    <p className="text-sm font-black text-green-600">Rp{product.price.toLocaleString()}</p>
                    {product.wholesalePrice > 0 && <p className="text-[9px] font-bold text-gray-400 italic">Grosir: Rp{product.wholesalePrice.toLocaleString()}</p>}
                  </div>
                  <button onClick={() => addToCart(product)} className="w-full py-2 bg-gray-900 text-white text-[9px] font-black rounded-xl uppercase tracking-widest active:bg-green-600">+ Keranjang</button>
                </div>

              </div>
            ))}
          </div>
        )}

        {/* PAGINATION NAVIGATION */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center mt-12 gap-4">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="p-3 bg-white border border-gray-100 rounded-2xl disabled:opacity-30 shadow-sm"
            >
              <ChevronLeft size={20}/>
            </button>
            
            <div className="flex items-center gap-2">
              {[...Array(totalPages)].map((_, i) => (
                <button 
                  key={i} 
                  onClick={() => setCurrentPage(i + 1)}
                  className={`w-10 h-10 rounded-xl font-black text-[10px] transition-all ${currentPage === i + 1 ? 'bg-green-600 text-white' : 'bg-gray-50 text-gray-400'}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            <button 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="p-3 bg-white border border-gray-100 rounded-2xl disabled:opacity-30 shadow-sm"
            >
              <ChevronRight size={20}/>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CategoryContent params={params} />
    </Suspense>
  );
}