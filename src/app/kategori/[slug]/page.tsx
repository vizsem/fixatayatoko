'use client';

import { useEffect, useState, Suspense, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Store, Package, ArrowLeft, ShoppingCart, Sparkles } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import toast, { Toaster } from 'react-hot-toast';

type Product = {
  id: string;
  name: string;
  price: number;
  wholesalePrice?: number;
  category: string;
  unit: string;
  image: string;
  variant?: string;
};

type Category = {
  id: string;
  name: string;
  slug: string;
};

type Promotion = {
  id: string;
  name: string;
  type: 'product' | 'category';
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  targetId?: string;
  targetName?: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

function CategoryContent({ params }: { params: Promise<{ slug: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;
  
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [activePromos, setActivePromos] = useState<Promotion[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // 1. Ambil Semua Produk (Logic Utama)
        const productsSnap = await getDocs(collection(db, 'products'));
        const allProducts = productsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Product[];

        // 2. Ambil Promo Aktif
        const promoSnap = await getDocs(collection(db, 'promotions'));
        const now = new Date();
        const promoList = promoSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Promotion))
          .filter(p => p.isActive && now >= new Date(p.startDate) && now <= new Date(p.endDate));
        setActivePromos(promoList);

        // 3. Filter Produk Berdasarkan Slug (Logic Anti-Gagal)
        const filtered = allProducts.filter(p => {
          if (!p.category) return false;
          
          // Konversi nama kategori produk menjadi slug untuk dicocokkan dengan URL
          const generatedSlug = p.category
            .toLowerCase()
            .replace(/&/g, 'dan')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
            
          return generatedSlug === slug;
        });

        // 4. Ambil Info Kategori dari koleksi categories (sebagai data pendukung)
        const categoriesSnap = await getDocs(collection(db, 'categories'));
        const foundCategory = categoriesSnap.docs
          .map(doc => doc.data() as Category)
          .find(c => c.slug === slug);

        if (filtered.length > 0) {
          setCategory({
            id: foundCategory?.id || `cat-${slug}`,
            name: foundCategory?.name || filtered[0].category,
            slug: slug
          });
          setProducts(filtered);
        } else if (foundCategory) {
          // Jika kategori ada di database tapi produk belum ada
          setCategory(foundCategory);
          setProducts([]);
        } else {
          // Jika benar-benar tidak ada, kembali ke beranda
          router.push('/');
        }

      } catch (error) {
        console.error('Error Detail:', error);
        toast.error("Gagal memuat data");
      } finally {
        setLoading(false);
      }
    };

    if (slug) fetchData();
  }, [slug, router]);

  const getDiscountedPrice = (product: Product) => {
    const promo = activePromos.find(p => 
      (p.type === 'product' && p.targetId === product.id) || 
      (p.type === 'category' && p.targetName?.toLowerCase() === product.category?.toLowerCase())
    );

    if (promo) {
      const price = promo.discountType === 'percentage' 
        ? product.price - (product.price * (promo.discountValue / 100))
        : product.price - promo.discountValue;
      return { price, hasPromo: true };
    }
    return { price: product.price, hasPromo: false };
  };

  const addToCart = (product: Product) => {
    const { price } = getDiscountedPrice(product);
    let cart = JSON.parse(localStorage.getItem('atayatoko-cart') || '[]');
    const existing = cart.findIndex((item: any) => item.id === product.id);
    
    if (existing >= 0) cart[existing].quantity += 1;
    else cart.push({ ...product, price, quantity: 1 });
    
    localStorage.setItem('atayatoko-cart', JSON.stringify(cart));
    toast.success(`${product.name} ditambah!`, {
      icon: '🛒',
      style: { borderRadius: '15px', background: '#333', color: '#fff', fontSize: '10px', fontWeight: 'bold' }
    });
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-green-600"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Toaster position="top-center" />
      
      <header className="bg-white border-b sticky top-0 z-50 px-4 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <button onClick={() => router.push('/')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <h1 className="text-[12px] font-black uppercase tracking-widest text-gray-800">
            {category?.name || 'Kategori'}
          </h1>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {products.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-gray-200 shadow-inner">
            <Package className="mx-auto text-gray-200 mb-4" size={64} />
            <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest leading-relaxed px-10">
              Maaf, produk untuk kategori ini <br/> sedang tidak tersedia
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {products.map((product) => {
              const promo = getDiscountedPrice(product);
              return (
                <div key={product.id} className="bg-white rounded-[2rem] border border-gray-100 p-3 shadow-sm relative group active:scale-95 transition-all">
                  {promo.hasPromo && (
                    <div className="absolute top-4 left-4 z-10 bg-red-600 text-white text-[7px] font-black px-2 py-0.5 rounded shadow-lg animate-pulse flex items-center gap-1 uppercase">
                      <Sparkles size={8} /> Promo
                    </div>
                  )}
                  
                  <Link href={`/produk/${product.id}`} className="block aspect-square mb-3 overflow-hidden rounded-2xl bg-gray-50">
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  </Link>

                  <h3 className="text-[10px] font-black text-gray-800 uppercase line-clamp-2 mb-1 leading-tight h-7">{product.name}</h3>
                  <div className="mb-3 h-10">
                    {promo.hasPromo && (
                      <p className="text-[9px] text-gray-400 line-through">Rp{product.price.toLocaleString()}</p>
                    )}
                    <p className={`text-sm font-black ${promo.hasPromo ? 'text-red-600' : 'text-green-600'}`}>
                      Rp{promo.price.toLocaleString()}
                    </p>
                  </div>

                  <button 
                    onClick={() => addToCart(product)}
                    className="w-full py-2 bg-gray-900 text-white text-[9px] font-black rounded-xl uppercase shadow-md active:bg-green-600 transition-colors"
                  >
                    + Keranjang
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Memuat...</div>}>
      <CategoryContent params={params} />
    </Suspense>
  );
}