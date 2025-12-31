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

// Tipe data untuk Promosi dari Back Office
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch Produk
        const productsSnapshot = await getDocs(collection(db, 'products'));
        const productList = productsSnapshot.docs.map(doc => {
          const data = doc.data();
          const price = Number(data.price) || 0;
          const wholesale = Number(data.wholesalePrice) || price;
          return {
            id: doc.id,
            ...data,
            price,
            wholesalePrice: wholesale,
            minWholesale: data.minWholesale || 10,
            unit: data.unit || 'pcs',
            category: data.category || 'Umum',
            image: data.image || '/logo-atayatoko.png',
            variant: data.variant || ''
          };
        }) as Product[];

        // 2. Fetch Promosi (Back Office)
        const promoSnapshot = await getDocs(collection(db, 'promotions'));
        const now = new Date();
        const promoList = promoSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Promotion[];

        // Filter promo yang sedang aktif hari ini
        const currentlyActive = promoList.filter(p => {
          const start = new Date(p.startDate);
          const end = new Date(p.endDate);
          return p.isActive && now >= start && now <= end;
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
        
        const savedCart = JSON.parse(localStorage.getItem('atayatoko-cart') || '[]');
        setCartCount(savedCart.reduce((sum: number, item: any) => sum + item.quantity, 0));
        setWishlist(JSON.parse(localStorage.getItem('atayatoko-wishlist') || '[]'));
      } catch (error) {
        console.error('Gagal memuat data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Fungsi helper untuk menghitung harga setelah diskon promosi
  const getDiscountedPrice = (product: Product) => {
    // Cari promo untuk produk spesifik atau kategori
    const promo = activePromos.find(p => 
      (p.type === 'product' && p.targetId === product.id) || 
      (p.type === 'category' && p.targetName === product.category)
    );

    if (promo) {
      let finalPrice = product.wholesalePrice;
      if (promo.discountType === 'percentage') {
        finalPrice = product.wholesalePrice - (product.wholesalePrice * (promo.discountValue / 100));
      } else {
        finalPrice = product.wholesalePrice - promo.discountValue;
      }
      return { price: finalPrice, hasPromo: true, promoName: promo.name };
    }
    return { price: product.wholesalePrice, hasPromo: false, promoName: null };
  };

  const addToCart = (product: Product) => {
    const { price } = getDiscountedPrice(product);
    let cart = JSON.parse(localStorage.getItem('atayatoko-cart') || '[]');
    const existingIndex = cart.findIndex((item: any) => item.id === product.id);
    
    // Simpan ke keranjang dengan harga yang sudah dipotong promo
    const productToCart = { ...product, wholesalePrice: price };

    if (existingIndex >= 0) cart[existingIndex].quantity += 1;
    else cart.push({ ...productToCart, quantity: 1 });
    
    localStorage.setItem('atayatoko-cart', JSON.stringify(cart));
    setCartCount(cart.reduce((sum: number, item: any) => sum + item.quantity, 0));
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
            return (
              <div key={product.id} className="min-w-[155px] md:min-w-[190px] bg-white rounded-2xl border border-gray-100 overflow-hidden snap-start shadow-sm flex flex-col">
                <Link href={`/produk/${product.id}`} className="relative block aspect-square bg-gray-50">
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                  {promoInfo.hasPromo && (
                    <div className="absolute top-2 left-2 bg-orange-600 text-white text-[7px] font-black px-1.5 py-0.5 rounded uppercase flex items-center gap-1 shadow-lg">
                      <Sparkles size={8} /> Promo
                    </div>
                  )}
                </Link>
                <div className="p-3 flex flex-col flex-1">
                  <h3 className="text-[10px] md:text-xs font-bold text-gray-700 line-clamp-1 uppercase leading-tight">{product.name}</h3>
                  <p className="text-[8px] font-bold text-gray-400 mb-2 uppercase tracking-tighter">
                    {product.variant ? `Varian: ${product.variant}` : 'Kemasan Standar'}
                  </p>
                  
                  <div className="mb-3 space-y-0.5">
                    <div className="flex flex-col">
                      {promoInfo.hasPromo && (
                        <span className="text-[7px] font-black text-orange-500 uppercase leading-none mb-0.5">
                          {promoInfo.promoName}
                        </span>
                      )}
                      <div className="flex items-baseline gap-1">
                        <span className={`text-[13px] font-black leading-none ${promoInfo.hasPromo ? 'text-orange-600' : 'text-green-600'}`}>
                          Rp{promoInfo.price.toLocaleString('id-ID')}
                        </span>
                        <span className="text-[8px] font-bold text-gray-400">/{product.unit}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {promoInfo.hasPromo && (
                          <span className="text-[8px] text-gray-300 line-through mr-1">
                            Rp{product.wholesalePrice.toLocaleString()}
                          </span>
                        )}
                        <span className="text-[8px] font-bold text-blue-600 uppercase italic">Grosir</span>
                        <span className="text-[7px] font-bold bg-blue-100 text-blue-700 px-1 rounded">
                          Min. {product.minWholesale}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => addToCart(product)}
                    className="mt-auto w-full py-2 bg-gray-900 text-white text-[9px] font-black rounded-lg uppercase active:scale-95 transition-all"
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
      {/* Top Banner Marquee */}
      <div className="bg-green-700 text-white py-1.5 overflow-hidden whitespace-nowrap">
        <div className="animate-marquee inline-block text-[10px] font-bold uppercase tracking-widest px-4">
          🚚 GRATIS ONGKIR KEDIRI KOTA • HARGA GROSIR SUPER HEMAT • STOK TERBARU HARI INI • 
          🚚 GRATIS ONGKIR KEDIRI KOTA • HARGA GROSIR SUPER HEMAT • STOK TERBARU HARI INI • 
        </div>
      </div>

      {/* Header */}
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

      {/* Hero Banner (Carousel Promosi) */}
      <section className="px-4 py-4 max-w-7xl mx-auto overflow-hidden">
        <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 scrollbar-hide pb-2">
          {/* Banner Utama Statis */}
          <div className="min-w-full snap-center rounded-[2rem] bg-gradient-to-br from-green-600 to-emerald-800 text-white p-8 relative overflow-hidden shadow-lg shadow-green-100">
            <div className="relative z-10">
              <h2 className="text-2xl md:text-3xl font-black mb-1 leading-tight uppercase">Pusat Grosir Sembako</h2>
              <p className="text-green-100 text-[11px] mb-6 max-w-[200px] leading-relaxed">Belanja eceran rasa grosir, dikirim langsung ke pintu rumah Anda.</p>
              <Link href="/semua-kategori" className="inline-block bg-white text-green-700 px-5 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl">Mulai Belanja</Link>
            </div>
            <Package size={160} className="absolute -right-10 -bottom-10 opacity-10 rotate-12" />
          </div>

          {/* Banner dari Promo Back Office */}
          {activePromos.map((promo) => (
            <div key={promo.id} className="min-w-full snap-center rounded-[2rem] bg-gradient-to-br from-orange-500 to-red-600 text-white p-8 relative overflow-hidden shadow-lg">
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

      {/* Pencarian atau Katalog Utama */}
      {searchQuery ? (
        <section className="px-4 py-4 max-w-7xl mx-auto">
            <h2 className="text-sm font-black uppercase mb-4 text-gray-800">Hasil Pencarian</h2>
            {filteredProducts.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {filteredProducts.map(p => {
                        const promoInfo = getDiscountedPrice(p);
                        return (
                          <div key={p.id} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
                              <Link href={`/produk/${p.id}`} className="relative block aspect-square mb-2">
                                  <img src={p.image} alt={p.name} className="w-full h-full object-cover rounded-xl" />
                                  {promoInfo.hasPromo && (
                                    <div className="absolute top-2 left-2 bg-orange-600 text-white text-[7px] font-black px-1.5 py-0.5 rounded uppercase">Promo</div>
                                  )}
                              </Link>
                              <h3 className="text-[11px] font-bold text-gray-700 line-clamp-1 uppercase leading-tight">{p.name}</h3>
                              <p className="text-[8px] font-bold text-gray-400 mb-2 uppercase tracking-tighter">{p.variant || 'Standar'}</p>
                              <div className="mb-3">
                                  <div className="flex flex-col">
                                      <div className="flex items-baseline gap-1">
                                          <span className={`text-sm font-black leading-none ${promoInfo.hasPromo ? 'text-orange-600' : 'text-green-600'}`}>
                                            Rp{promoInfo.price.toLocaleString('id-ID')}
                                          </span>
                                      </div>
                                      <div className="flex items-center gap-1 mt-0.5">
                                          <span className="text-[7px] font-bold bg-blue-100 text-blue-700 px-1 rounded">Min. {p.minWholesale}</span>
                                      </div>
                                  </div>
                              </div>
                              <button onClick={() => addToCart(p)} className="mt-auto w-full py-2 bg-gray-900 text-white text-[9px] font-black rounded-lg uppercase shadow-md">+ Keranjang</button>
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
          {/* Baris Promo Khusus yang mengambil data dari Program Promo Back Office */}
          <CatalogRow 
            title="Sedang Diskon" 
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

      {/* Staff Access */}
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

      {/* Navigasi Mobile */}
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
            {cartCount > 0 && <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[8px] font-bold rounded-full h-4 w-4 flex items-center justify-center">{cartCount}</span>}
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