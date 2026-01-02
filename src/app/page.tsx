'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Search, ShoppingCart, User, Heart, Package, 
  ShieldCheck, Printer, ChevronRight, ArrowRight,
  Home as HomeIcon, Grid, Barcode, Inbox, Sparkles, Gift
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type Product = {
  minWholesale: number;
  id: string;
  name: string;
  price: number;
  wholesalePrice: number;
  stock: number;
  category: string;
  unit: string;
  barcode?: string;
  image: string;
  isPromo?: boolean;
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
  type: 'product' | 'category' | 'coupon';
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  targetId?: string;
  targetName?: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [cartCount, setCartCount] = useState(0);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activePromos, setActivePromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);

  // --- LOGIKA SINKRONISASI KERANJANG ---
  const updateCartCount = () => {
    if (typeof window !== 'undefined') {
      const savedCart = JSON.parse(localStorage.getItem('cart') || '[]');
      const count = savedCart.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0);
      setCartCount(count);
    }
  };

  useEffect(() => {
    // Jalankan saat pertama kali muat
    updateCartCount();

    // Dengar perubahan dari halaman lain (seperti /cart)
    window.addEventListener('cart-updated', updateCartCount);
    window.addEventListener('storage', updateCartCount);

    return () => {
      window.removeEventListener('cart-updated', updateCartCount);
      window.removeEventListener('storage', updateCartCount);
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const productsSnapshot = await getDocs(collection(db, 'products'));
        const productList = productsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            price: Number(data.price) || 0,
            wholesalePrice: Number(data.wholesalePrice) || Number(data.price) || 0,
            minWholesale: Number(data.minWholesale) || 1,
            unit: data.unit || 'pcs',
            category: data.category || 'Umum',
            image: data.image || '/logo-atayatoko.png',
            variant: data.variant || ''
          };
        }) as Product[];

        const promoSnapshot = await getDocs(collection(db, 'promotions'));
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const promoList = promoSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Promotion[];

        const currentlyActive = promoList.filter(p => {
          if (!p.isActive || !p.startDate || !p.endDate) return false;
          const start = new Date(p.startDate);
          const end = new Date(p.endDate);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          return now >= start && now <= end;
        });
        
        setActivePromos(currentlyActive);
        
        const categorySet = new Set(productList.map(p => p.category));
        const categoryList = Array.from(categorySet).map((name, index) => ({
          id: `cat-${index}`,
          name,
          slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        }));
        
        setProducts(productList);
        setCategories(categoryList);
        setWishlist(JSON.parse(localStorage.getItem('atayatoko-wishlist') || '[]'));
      } catch (error) {
        console.error('Gagal memuat data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const toggleWishlist = (id: string) => {
    let newWishlist = [...wishlist];
    if (newWishlist.includes(id)) {
      newWishlist = newWishlist.filter(item => item !== id);
    } else {
      newWishlist.push(id);
    }
    setWishlist(newWishlist);
    localStorage.setItem('atayatoko-wishlist', JSON.stringify(newWishlist));
  };

  const getDiscountedPrice = (product: Product) => {
    const promo = activePromos.find(p => 
      (p.type === 'product' && p.targetId === product.id) || 
      (p.type === 'category' && p.targetName === product.category)
    );

    if (promo) {
      let finalPrice = product.price;
      if (promo.discountType === 'percentage') {
        finalPrice = product.price - (product.price * (promo.discountValue / 100));
      } else {
        finalPrice = product.price - promo.discountValue;
      }
      return { price: finalPrice, hasPromo: true, promoName: promo.name };
    }
    return { price: product.price, hasPromo: false, promoName: null };
  };

  const addToCart = (product: Product) => {
    const { price } = getDiscountedPrice(product);
    // GANTI KEY MENJADI 'cart'
    let cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const existingIndex = cart.findIndex((item: any) => (item.id === product.id || item.productId === product.id));
    const productToCart = { ...product, productId: product.id, price: price };

    if (existingIndex >= 0) cart[existingIndex].quantity += 1;
    else cart.push({ ...productToCart, quantity: 1 });
    
    localStorage.setItem('cart', JSON.stringify(cart));
    
    // Trigger sinkronisasi global
    updateCartCount();
    window.dispatchEvent(new Event('cart-updated'));
  };

  const filteredProducts = products.filter(product =>
    product.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const CatalogRow = ({ title, items, icon: Icon, colorClass }: { title: string, items: Product[], icon: any, colorClass: string }) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-8">
        <div className="flex items-center justify-between px-4 mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${colorClass} bg-opacity-10 ${colorClass.replace('bg-', 'text-')}`}>
              <Icon size={18} />
            </div>
            <h2 className="text-sm font-black uppercase tracking-tight text-gray-800">{title}</h2>
          </div>
          <Link href={`/semua-kategori`} className="text-[10px] font-bold text-gray-400 flex items-center gap-1 uppercase">
            Semua <ArrowRight size={12} />
          </Link>
        </div>
        
        <div className="flex overflow-x-auto gap-3 px-4 pb-2 scrollbar-hide snap-x">
          {items.slice(0, 10).map((product) => {
            const promoInfo = getDiscountedPrice(product);
            const isWishlisted = wishlist.includes(product.id);
            return (
              <div key={product.id} className="min-w-[155px] md:min-w-[190px] bg-white rounded-2xl border border-gray-100 overflow-hidden snap-start shadow-sm flex flex-col relative group transition-transform active:scale-95">
                <button 
                  onClick={() => toggleWishlist(product.id)}
                  className="absolute top-2 right-2 z-20 p-2 bg-white/90 backdrop-blur-md rounded-full shadow-md active:scale-75 transition-all"
                >
                  <Heart size={14} className={isWishlisted ? "fill-red-500 text-red-500" : "text-gray-400"} />
                </button>

                <Link href={`/produk/${product.id}`} className="relative block aspect-square bg-gray-50 overflow-hidden">
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  
                  {promoInfo.hasPromo && (
                    <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
                      <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white text-[8px] font-black px-2 py-1 rounded-md uppercase flex items-center gap-1 shadow-lg animate-pulse">
                        <Sparkles size={10} className="fill-white" /> Special Deal
                      </div>
                      <div className="bg-black/60 backdrop-blur-sm text-white text-[7px] font-bold px-1.5 py-0.5 rounded shadow-sm inline-block w-fit uppercase">
                        {promoInfo.promoName}
                      </div>
                    </div>
                  )}
                </Link>

                <div className="p-3 flex flex-col flex-1">
                  <h3 className="text-[10px] md:text-xs font-bold text-gray-700 line-clamp-1 uppercase leading-tight">{product.name}</h3>
                  <p className="text-[8px] font-bold text-gray-400 mb-2 uppercase tracking-tighter">
                    {product.variant || 'Kemasan Standar'}
                  </p>
                  
                  <div className="mb-3 space-y-2">
                    <div className="flex flex-col">
                      {promoInfo.hasPromo && (
                        <span className="text-[9px] text-gray-400 line-through decoration-red-500/50">
                          Rp{product.price.toLocaleString()}
                        </span>
                      )}
                      <div className="flex items-baseline gap-1">
                        <span className={`text-[15px] font-black leading-none ${promoInfo.hasPromo ? 'text-orange-600' : 'text-green-600'}`}>
                          Rp{promoInfo.price.toLocaleString('id-ID')}
                        </span>
                        <span className="text-[9px] font-bold text-gray-400">/{product.unit}</span>
                      </div>
                      
                      <div className="mt-2 pt-2 border-t border-dashed border-gray-100 flex flex-col gap-0.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[8px] font-black text-blue-500 uppercase tracking-tighter italic">Harga Grosir</span>
                          <span className="text-[11px] font-black text-slate-900 tracking-tighter">
                            Rp{product.wholesalePrice?.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                           <span className="bg-blue-50 text-blue-600 text-[7px] font-black px-1.5 py-0.5 rounded border border-blue-100">
                             MIN. {product.minWholesale} {product.unit}
                           </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => addToCart(product)}
                    className="mt-auto w-full py-2.5 bg-gray-900 text-white text-[9px] font-black rounded-xl uppercase active:bg-green-600 transition-colors shadow-lg shadow-gray-200"
                  >
                    + Keranjang
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-green-600"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 text-black pb-24 md:pb-12">
      <div className="bg-green-700 text-white py-1.5 overflow-hidden whitespace-nowrap">
        <div className="animate-marquee inline-block text-[10px] font-bold uppercase tracking-widest px-4">
          🚚 GRATIS ONGKIR KEDIRI KOTA • HARGA GROSIR SUPER HEMAT • STOK TERBARU HARI INI • 
          🚚 GRATIS ONGKIR KEDIRI KOTA • HARGA GROSIR SUPER HEMAT • STOK TERBARU HARI INI • 
        </div>
      </div>

      <header className="bg-white shadow-sm sticky top-0 z-50 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo-atayatoko.png" alt="Logo" className="h-8 w-auto" />
            <h1 className="hidden sm:block text-lg font-black text-green-600 leading-none">ATAYATOKO</h1>
          </Link>
          <div className="flex-1 relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Cari beras, minyak, sabun..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-100 border-none rounded-xl py-2 pl-10 pr-4 text-sm outline-none focus:ring-1 focus:ring-green-500/30"
            />
          </div>
          <div className="hidden md:flex items-center gap-5 text-gray-400">
            <Link href="/wishlist" className="relative"><Heart size={22} className={wishlist.length > 0 ? 'fill-red-500 text-red-500' : ''} /></Link>
            <Link href="/cart" className="relative">
                <ShoppingCart size={22} />
                {cartCount > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] rounded-full h-5 w-5 flex items-center justify-center border-2 border-white">{cartCount}</span>}
            </Link>
          </div>
        </div>
      </header>

      <section className="px-4 py-4 max-w-7xl mx-auto overflow-hidden">
        <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 scrollbar-hide pb-2">
          <div className="min-w-[90%] md:min-w-full snap-center rounded-[2rem] bg-gradient-to-br from-green-600 to-emerald-800 text-white p-8 relative overflow-hidden shadow-lg shadow-green-100">
            <div className="relative z-10">
              <h2 className="text-2xl md:text-3xl font-black mb-1 leading-tight uppercase">Pusat Grosir Sembako</h2>
              <p className="text-green-100 text-[11px] mb-6 max-w-[200px] leading-relaxed italic">Belanja eceran rasa grosir, dikirim langsung ke depan pintu.</p>
              <Link href="/semua-kategori" className="inline-block bg-white text-green-700 px-5 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-transform">Mulai Belanja</Link>
            </div>
            <Package size={160} className="absolute -right-10 -bottom-10 opacity-10 rotate-12" />
          </div>

          {activePromos.map((promo) => (
            <div key={promo.id} className="min-w-[90%] md:min-w-full snap-center rounded-[2rem] bg-gradient-to-br from-orange-500 to-red-600 text-white p-8 relative overflow-hidden shadow-lg">
              <div className="relative z-10">
                <span className="text-[8px] font-black bg-white/20 px-2 py-0.5 rounded-full mb-2 inline-block uppercase">Promo Aktif</span>
                <h2 className="text-2xl md:text-3xl font-black mb-1 leading-tight uppercase">{promo.name}</h2>
                <p className="text-orange-50/80 text-[11px] mb-6 max-w-[220px] leading-relaxed">
                  Potongan {promo.discountType === 'percentage' ? `${promo.discountValue}%` : `Rp${promo.discountValue.toLocaleString()}`} 
                  {promo.type === 'category' ? ` untuk kategori ${promo.targetName}` : ' untuk produk pilihan'}.
                </p>
                <Link href="/semua-kategori" className="inline-block bg-white text-orange-600 px-5 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl">Lihat Produk</Link>
              </div>
              <Gift size={160} className="absolute -right-10 -bottom-10 opacity-10 rotate-12" />
            </div>
          ))}
        </div>
      </section>

      {searchQuery ? (
        <section className="px-4 py-4 max-w-7xl mx-auto">
            <h2 className="text-sm font-black uppercase mb-4 text-gray-800">Hasil Pencarian</h2>
            {filteredProducts.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {filteredProducts.map(p => {
                        const promoInfo = getDiscountedPrice(p);
                        return (
                          <div key={p.id} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex flex-col relative">
                              <button onClick={() => toggleWishlist(p.id)} className="absolute top-2 right-2 z-10 p-1.5 bg-white/80 rounded-full shadow-sm">
                                <Heart size={14} className={wishlist.includes(p.id) ? "fill-red-500 text-red-500" : "text-gray-400"} />
                              </button>
                              <Link href={`/produk/${p.id}`} className="relative block aspect-square mb-2">
                                  <img src={p.image} alt={p.name} className="w-full h-full object-cover rounded-xl" />
                                  {promoInfo.hasPromo && (
                                    <div className="absolute top-2 left-2 bg-orange-600 text-white text-[7px] font-black px-1.5 py-0.5 rounded uppercase flex items-center gap-1 shadow-lg">
                                       <Sparkles size={8} /> Promo
                                    </div>
                                  )}
                              </Link>
                              <h3 className="text-[11px] font-bold text-gray-700 line-clamp-1 uppercase leading-tight">{p.name}</h3>
                              <div className="mt-2 mb-3">
                                  <div className="flex flex-col">
                                      <span className={`text-[15px] font-black ${promoInfo.hasPromo ? 'text-orange-600' : 'text-green-600'}`}>
                                        Rp{promoInfo.price.toLocaleString('id-ID')}
                                      </span>
                                      <span className="text-[9px] font-bold text-blue-600 tracking-tighter">Grosir: Rp{p.wholesalePrice?.toLocaleString()}</span>
                                  </div>
                              </div>
                              <button onClick={() => addToCart(p)} className="mt-auto w-full py-2 bg-gray-900 text-white text-[9px] font-black rounded-lg uppercase shadow-md active:scale-95 transition-transform">+ Keranjang</button>
                          </div>
                        )
                    })}
                </div>
            ) : (
                <div className="py-20 text-center flex flex-col items-center">
                    <Inbox size={40} className="text-gray-200 mb-2" />
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Produk tidak ditemukan</p>
                </div>
            )}
        </section>
      ) : (
        <>
          <CatalogRow 
            title="🔥 Sedang Diskon" 
            items={products.filter(p => getDiscountedPrice(p).hasPromo)} 
            icon={Sparkles} 
            colorClass="bg-orange-500" 
          />
          {categories.map(cat => (
            <CatalogRow 
                key={cat.id}
                title={cat.name}
                items={products.filter(p => p.category === cat.name)}
                icon={Package}
                colorClass="bg-green-600"
            />
          ))}
        </>
      )}

      <div className="mt-16 mb-12 px-4 flex flex-col items-center opacity-40 hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-4 py-2 px-4 bg-white rounded-xl border border-gray-100 shadow-sm">
          <Link href="/profil/login" className="flex items-center gap-1.5 text-gray-500">
            <ShieldCheck size={14} />
            <span className="text-[9px] font-bold uppercase tracking-tighter">Admin</span>
          </Link>
          <div className="w-[1px] h-3 bg-gray-200"></div>
          <Link href="/cashier" className="flex items-center gap-1.5 text-gray-500">
            <Printer size={14} />
            <span className="text-[9px] font-bold uppercase tracking-tighter">Kasir</span>
          </Link>
        </div>
        <p className="mt-3 text-[8px] font-bold text-gray-300 uppercase tracking-[0.2em]">Atayatoko Store © 2026</p>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-100 px-6 py-3 flex justify-between items-center z-50">
        <Link href="/" className="flex flex-col items-center gap-1 text-green-600">
          <HomeIcon size={20} /><span className="text-[8px] font-black uppercase tracking-widest">Beranda</span>
        </Link>
        <Link href="/semua-kategori" className="flex flex-col items-center gap-1 text-gray-400">
          <Grid size={20} /><span className="text-[8px] font-black uppercase tracking-widest">Katalog</span>
        </Link>
        <Link href="/cart" className="flex flex-col items-center gap-1 text-gray-400 relative">
          <div className="relative">
            <ShoppingCart size={20} />
            {cartCount > 0 && <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[8px] font-bold rounded-full h-4 w-4 flex items-center justify-center animate-bounce">{cartCount}</span>}
          </div>
          <span className="text-[8px] font-black uppercase tracking-widest">Keranjang</span>
        </Link>
        <Link href="/profil" className="flex flex-col items-center gap-1 text-gray-400">
          <User size={20} /><span className="text-[8px] font-black uppercase tracking-widest">Akun</span>
        </Link>
      </nav>

      <style jsx global>{`
        @keyframes marquee { 0% { transform: translateX(5%); } 100% { transform: translateX(-100%); } }
        .animate-marquee { animation: marquee 35s linear infinite; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}