'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Search, ShoppingCart, User, Heart, Package, 
  ShieldCheck, Printer, ArrowRight, Info, Phone,
  Home as HomeIcon, Grid, Inbox, Sparkles, Gift, RefreshCw, Flame
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// --- TYPES ---
type Product = {
  minWholesale: number; id: string; name: string; price: number;
  wholesalePrice: number; stock: number; category: string;
  unit: string; barcode?: string; image: string; variant?: string;
};

type Category = { id: string; name: string; slug: string; };

type Promotion = {
  id: string; name: string; type: 'product' | 'category' | 'coupon';
  discountType: 'percentage' | 'fixed'; discountValue: number;
  targetId?: string; targetName?: string; startDate: string;
  endDate: string; isActive: boolean;
};

const SkeletonCard = () => (
  <div className="min-w-[155px] md:min-w-[190px] bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
    <div className="aspect-square bg-gray-200" />
    <div className="p-3 space-y-2">
      <div className="h-3 bg-gray-200 rounded w-3/4" />
      <div className="h-2 bg-gray-100 rounded w-1/2" />
      <div className="h-6 bg-gray-200 rounded w-full mt-4" />
    </div>
  </div>
);

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cartCount, setCartCount] = useState(0);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [randomProducts, setRandomProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activePromos, setActivePromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);

  const getDiscountedPrice = (product: Product) => {
    const promo = activePromos.find(p => 
      (p.type === 'product' && p.targetId === product.id) || 
      (p.type === 'category' && p.targetName === product.category)
    );
    if (promo) {
      const finalPrice = promo.discountType === 'percentage' 
        ? product.price - (product.price * (promo.discountValue / 100))
        : product.price - promo.discountValue;
      return { price: finalPrice, hasPromo: true, promoName: promo.name };
    }
    return { price: product.price, hasPromo: false, promoName: null };
  };

  const promoProducts = useMemo(() => {
    return products
      .filter(p => getDiscountedPrice(p).hasPromo)
      .sort(() => 0.5 - Math.random());
  }, [products, activePromos]);

  useEffect(() => {
    setIsMounted(true);
    const updateCartCount = () => {
      const savedCart = JSON.parse(localStorage.getItem('cart') || '[]');
      const count = savedCart.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0);
      setCartCount(count);
    };
    updateCartCount();
    window.addEventListener('cart-updated', updateCartCount);
    return () => window.removeEventListener('cart-updated', updateCartCount);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prodSnap, promoSnap] = await Promise.all([
          getDocs(collection(db, 'products')),
          getDocs(collection(db, 'promotions'))
        ]);

        const productList = prodSnap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            name: data.Nama || data.name || "Produk",
            price: Number(data.Ecer || data.price) || 0,
            wholesalePrice: Number(data.Grosir || data.wholesalePrice) || Number(data.Ecer) || 0,
            minWholesale: Number(data.Min_Grosir || data.Min_Stok_Grosir || 1),
            stock: Number(data.Stok || data.stock || 0),
            unit: data.Satuan || data.unit || 'pcs',
            category: data.Kategori || data.category || 'Umum',
            image: data.Link_Foto || data.image || '/logo-atayatoko.png',
            variant: data.variant || ''
          };
        }) as Product[];

        const now = new Date();
        const active = promoSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Promotion))
          .filter(p => p.isActive && now >= new Date(p.startDate) && now <= new Date(p.endDate));

        setActivePromos(active);
        setProducts(productList);
        setRandomProducts([...productList].sort(() => 0.5 - Math.random()).slice(0, 6));

        const catList = Array.from(new Set(productList.map(p => p.category)))
          .map((name, i) => ({
            id: `cat-${i}`, name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
          }))
          .sort(() => 0.5 - Math.random());
          
        setCategories(catList);

        const savedWish = localStorage.getItem('atayatoko-wishlist');
        if (savedWish) setWishlist(JSON.parse(savedWish));
      } catch (error) { console.error(error); } finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;
    const { price } = getDiscountedPrice(product);
    let cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const idx = cart.findIndex((item: any) => item.id === product.id);
    if (idx >= 0) cart[idx].quantity += 1;
    else cart.push({ ...product, price, quantity: 1 });
    localStorage.setItem('cart', JSON.stringify(cart));
    window.dispatchEvent(new Event('cart-updated'));
  };

  const ProductCard = ({ product }: { product: Product }) => {
    const promoInfo = getDiscountedPrice(product);
    const isOut = product.stock <= 0;
    const isWish = wishlist.includes(product.id);

    return (
      <div className="min-w-[155px] md:min-w-[190px] bg-white rounded-2xl border border-gray-100 overflow-hidden snap-start shadow-sm flex flex-col relative group">
        <button onClick={() => {
            const newWish = wishlist.includes(product.id) ? wishlist.filter(i => i !== product.id) : [...wishlist, product.id];
            setWishlist(newWish);
            localStorage.setItem('atayatoko-wishlist', JSON.stringify(newWish));
          }} 
          className="absolute top-2 right-2 z-20 p-2 bg-white/90 backdrop-blur-md rounded-full shadow-md active:scale-75 transition-all">
          <Heart size={14} className={isWish ? "fill-red-500 text-red-500" : "text-gray-400"} />
        </button>

        <Link href={`/produk/${product.id}`} className="relative aspect-square bg-gray-50 overflow-hidden block">
          <Image src={product.image} alt={product.name} fill className={`object-cover transition-transform duration-500 group-hover:scale-110 ${isOut ? 'grayscale opacity-50' : ''}`} sizes="190px" />
          {isOut && <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10"><span className="bg-white text-black text-[9px] font-black px-3 py-1 rounded-full uppercase">Habis</span></div>}
          {promoInfo.hasPromo && !isOut && (
            <div className="absolute top-2 left-2 z-10 bg-gradient-to-r from-orange-600 to-red-600 text-white text-[8px] font-black px-2 py-1 rounded uppercase animate-pulse shadow-lg flex items-center gap-1">
              <Sparkles size={10} /> Promo
            </div>
          )}
        </Link>

        <div className="p-3 flex flex-col flex-1">
          <h3 className="text-[10px] md:text-xs font-bold text-gray-700 line-clamp-1 uppercase leading-tight">{product.name}</h3>
          <p className="text-[8px] font-bold text-gray-400 mb-2 uppercase">{product.variant || 'Standar'}</p>
          
          <div className="flex flex-col mb-3">
            {promoInfo.hasPromo && <span className="text-[9px] text-gray-400 line-through">Rp{product.price.toLocaleString()}</span>}
            <div className="flex items-baseline gap-1">
              <span className={`text-[15px] font-black ${promoInfo.hasPromo ? 'text-orange-600' : 'text-green-600'}`}>Rp{promoInfo.price.toLocaleString('id-ID')}</span>
              <span className="text-[9px] font-bold text-gray-400">/{product.unit}</span>
            </div>
            
            <div className="mt-2 pt-2 border-t border-dashed border-gray-100">
              <div className="flex justify-between items-center text-[8px] font-black uppercase italic text-blue-500">
                <span>Grosir</span>
                <span className="text-slate-900 not-italic">Rp{product.wholesalePrice.toLocaleString()}</span>
              </div>
              <span className="text-[7px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md font-black uppercase tracking-tighter">
                Min. {product.minWholesale} {product.unit}
              </span>
            </div>
          </div>

          <button onClick={() => addToCart(product)} disabled={isOut} className={`mt-auto w-full py-2.5 text-[9px] font-black rounded-xl uppercase shadow-sm transition-all ${isOut ? 'bg-gray-100 text-gray-400' : 'bg-gray-900 text-white active:bg-green-600 active:scale-95'}`}>
            {isOut ? 'Stok Habis' : '+ Keranjang'}
          </button>
        </div>
      </div>
    );
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isMounted) return null;

  return (
    <div className="min-h-screen bg-gray-50 text-black pb-24">
      <div className="bg-green-700 text-white py-1.5 overflow-hidden whitespace-nowrap">
        <div className="animate-marquee inline-block text-[10px] font-bold uppercase tracking-widest px-4">
          🚚 GRATIS ONGKIR KEDIRI KOTA • HARGA GROSIR SUPER HEMAT • ATAYAMARKET 🚚
        </div>
      </div>

      <header className="bg-white shadow-sm sticky top-0 z-50 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
             <Image src="/logo-atayatoko.png" alt="Logo" width={32} height={32} className="h-8 w-auto" />
             <h1 className="hidden sm:block text-lg font-black text-green-600 uppercase">ATAYAMARKET</h1>
          </Link>
          <div className="flex-1 relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input type="text" placeholder="Cari produk..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-gray-100 border-none rounded-xl py-2 pl-10 pr-4 text-sm outline-none focus:ring-1 focus:ring-green-500/20" />
          </div>
          <Link href="/cart" className="relative text-gray-400">
              <ShoppingCart size={22} />
              {cartCount > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] rounded-full h-5 w-5 flex items-center justify-center border-2 border-white font-bold">{cartCount}</span>}
          </Link>
        </div>
      </header>

      {!searchQuery && (
        <section className="px-4 py-4 max-w-7xl mx-auto">
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 scrollbar-hide pb-2">
            <div className="min-w-[92%] md:min-w-full snap-center rounded-[2.5rem] bg-gradient-to-br from-green-600 to-emerald-800 text-white p-8 relative overflow-hidden shadow-lg">
              <div className="relative z-10">
                <h2 className="text-2xl md:text-3xl font-black mb-1 uppercase tracking-tighter">Pusat Grosir Satu Toko Semua Kebutuhan</h2>
                <p className="text-green-100 text-[11px] mb-6 max-w-[200px] leading-relaxed italic">Belanja eceran rasa grosir, dikirim langsung ke pintu.</p>
                <Link href="/semua-kategori" className="inline-block bg-white text-green-700 px-5 py-2 rounded-xl font-black text-[10px] uppercase shadow-xl active:scale-95">Mulai Belanja</Link>
              </div>
              <Package size={160} className="absolute -right-10 -bottom-10 opacity-10 rotate-12" />
            </div>

            {activePromos.map(p => (
              <div key={p.id} className="min-w-[92%] md:min-w-full snap-center rounded-[2.5rem] bg-gradient-to-br from-orange-500 to-red-600 text-white p-8 relative overflow-hidden shadow-lg">
                <div className="relative z-10">
                  <span className="bg-white/20 text-[8px] font-black px-2 py-0.5 rounded-full uppercase mb-2 inline-block">Flash Sale Aktif</span>
                  <h2 className="text-2xl md:text-3xl font-black mb-1 uppercase tracking-tighter">{p.name}</h2>
                  <p className="text-orange-50 text-[11px] mb-6">Diskon hingga {p.discountValue.toLocaleString()} {p.discountType === 'percentage' ? '%' : 'Rp'}</p>
                  <Link href="/semua-kategori" className="inline-block bg-white text-orange-600 px-5 py-2 rounded-xl font-black text-[10px] uppercase shadow-xl">Lihat Promo</Link>
                </div>
                <Gift size={160} className="absolute -right-10 -bottom-10 opacity-10 rotate-12" />
              </div>
            ))}
          </div>
        </section>
      )}

      <main className="max-w-7xl mx-auto py-4">
        {loading ? (
          <div className="px-4 space-y-8"><div className="flex gap-4 overflow-hidden"><SkeletonCard /><SkeletonCard /></div></div>
        ) : searchQuery ? (
          <section className="px-4">
            <h2 className="text-sm font-black uppercase mb-4">Hasil Pencarian</h2>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              {filteredProducts.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          </section>
        ) : (
          <>
            {promoProducts.length > 0 && (
              <div className="mb-8 px-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="bg-red-600 p-1.5 rounded-lg text-white animate-bounce"><Flame size={16} fill="currentColor"/></div>
                    <h2 className="text-sm font-black uppercase text-red-600 tracking-tighter">Penawaran Terbatas</h2>
                  </div>
                </div>
                <div className="flex overflow-x-auto gap-4 scrollbar-hide pb-2 snap-x">
                  {promoProducts.map(p => <ProductCard key={`promo-${p.id}`} product={p} />)}
                </div>
              </div>
            )}

            <div className="mb-8 px-4">
              <div className="flex items-center gap-2 mb-4">
                <RefreshCw size={18} className="text-blue-500" />
                <h2 className="text-sm font-black uppercase text-gray-800 tracking-tighter">Khusus Untukmu</h2>
              </div>
              <div className="flex overflow-x-auto gap-4 scrollbar-hide pb-2 snap-x">
                {randomProducts.map(p => <ProductCard key={`rand-${p.id}`} product={p} />)}
              </div>
            </div>

            {categories.map(cat => {
              const items = products.filter(p => p.category === cat.name).sort(() => 0.5 - Math.random());
              if (items.length === 0) return null;
              return (
                <div key={cat.id} className="mb-8 px-4">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-green-100 text-green-600"><Package size={18} /></div>
                      <h2 className="text-sm font-black uppercase text-gray-800 tracking-tighter">{cat.name}</h2>
                    </div>
                    <Link href={`/kategori/${cat.slug}`} className="text-[10px] font-bold text-gray-400">SEMUA <ArrowRight size={12} className="inline"/></Link>
                  </div>
                  <div className="flex overflow-x-auto gap-4 scrollbar-hide pb-2 snap-x">
                    {items.slice(0, 10).map(p => <ProductCard key={p.id} product={p} />)}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </main>

      {/* ✅ MENU TAMBAHAN: TENTANG & KONTAK + ADMIN & KASIR */}
      <footer className="mt-12 mb-16 px-4 max-w-7xl mx-auto border-t border-gray-100 pt-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Informasi</h3>
            <Link href="/tentang" className="flex items-center gap-2 text-[11px] font-bold text-gray-600 hover:text-green-600 transition-colors">
              <Info size={14} /> Tentang Kami
            </Link>
            <Link href="https://wa.me/85790565666" className="flex items-center gap-2 text-[11px] font-bold text-gray-600 hover:text-green-600 transition-colors">
              <Phone size={14} /> Hubungi Kami
            </Link>
          </div>
          <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Internal</h3>
            <Link href="/profil/login" className="flex items-center gap-2 text-[11px] font-bold text-gray-600 hover:text-orange-600 transition-colors">
              <ShieldCheck size={14} /> Panel Admin
            </Link>
            <Link href="/cashier" className="flex items-center gap-2 text-[11px] font-bold text-gray-600 hover:text-blue-600 transition-colors">
              <Printer size={14} /> Sistem Kasir
            </Link>
          </div>
        </div>
        
        <div className="flex flex-col items-center opacity-50 border-t border-gray-50 pt-8">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">ATAYAMARKET Store Kediri • © 2026</p>
        </div>
      </footer>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-100 px-6 py-3 flex justify-between items-center z-50">
        <Link href="/" className="flex flex-col items-center gap-1 text-green-600">
          <HomeIcon size={20} /><span className="text-[8px] font-black uppercase">Beranda</span>
        </Link>
        <Link href="/semua-kategori" className="flex flex-col items-center gap-1 text-gray-400">
          <Grid size={20} /><span className="text-[8px] font-black uppercase">Katalog</span>
        </Link>
        <Link href="/cart" className="flex flex-col items-center gap-1 text-gray-400 relative">
          <div className="relative">
            <ShoppingCart size={20} />
            {cartCount > 0 && <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[8px] font-bold rounded-full h-4 w-4 flex items-center justify-center animate-bounce">{cartCount}</span>}
          </div>
          <span className="text-[8px] font-black uppercase">Keranjang</span>
        </Link>
        <Link href="/profil" className="flex flex-col items-center gap-1 text-gray-400">
          <User size={20} /><span className="text-[8px] font-black uppercase">Akun</span>
        </Link>
      </nav>

      <style jsx global>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-marquee { display: inline-block; animation: marquee 30s linear infinite; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}