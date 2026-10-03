'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Package, RefreshCw, Sparkles, Flame, ArrowRight } from 'lucide-react';

import { Product, Promotion, Banner, SystemSettings, NotificationItem, Category } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { getUserAndRole } from '@/lib/supabase-helpers';

// Components
import { HomeHeader } from '@/components/home/HomeHeader';
import { HomeBanners } from '@/components/home/HomeBanners';
import { HomeFooter } from '@/components/home/HomeFooter';
import { ProductCard } from '@/components/home/ProductCard';
import { SkeletonCard } from '@/components/home/SkeletonCard';
import CustomerGuarantees from '@/components/common/CustomerGuarantees';

// Dynamically load category product sections to reduce initial JS bundle
const CategoryProductSection = dynamic(() => import('@/components/home/CategoryProductSection'), {
  ssr: true,
  loading: () => (
    <div className="mb-8 px-4 animate-pulse">
      <div className="h-6 w-36 bg-gray-200 rounded-lg mb-3" />
      <div className="flex gap-4 overflow-hidden">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  ),
});

export interface HomeClientProps {
  initialProducts: Product[];
  initialBanners: Banner[];
  initialPromos: Promotion[];
  initialSettings: SystemSettings | null;
  initialWarehouses: { id: string; name: string }[];
  initialCategories: Category[];
  initialWarehouseId: string;
}

export default function HomeClient({
  initialProducts,
  initialBanners,
  initialPromos,
  initialSettings,
  initialWarehouses,
  initialCategories,
  initialWarehouseId,
}: HomeClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [cartCount, setCartCount] = useState(0);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [currentUserPhotoUrl, setCurrentUserPhotoUrl] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifTab, setNotifTab] = useState<'transaksi' | 'informasi'>('informasi');
  const [notifCategory, setNotifCategory] = useState<string>('Semua');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const notifRef = useRef<HTMLDivElement | null>(null);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [products] = useState<Product[]>(initialProducts);
  const [categories] = useState<Category[]>(initialCategories);
  const [activePromos] = useState<Promotion[]>(initialPromos);
  const [repurchaseProducts, setRepurchaseProducts] = useState<Product[]>([]);
  const [banners] = useState<Banner[]>(initialBanners);
  const [systemSettings] = useState<SystemSettings | null>(initialSettings);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(initialWarehouseId);
  const [warehouses] = useState<{ id: string; name: string }[]>(initialWarehouses);

  const [showFilter, setShowFilter] = useState(false);
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');

  const randomProducts = useMemo(() => {
    return [...products].filter((p) => p.stock > 0).slice(0, 6);
  }, [products]);

  const getDiscountedPrice = useCallback(
    (product: Product) => {
      const promo = activePromos.find(
        (p) =>
          (p.type === 'product' && p.targetId === product.id) ||
          (p.type === 'category' && p.targetName === product.category)
      );
      if (promo) {
        const finalPrice =
          promo.discountType === 'percentage'
            ? product.price - product.price * (promo.discountValue / 100)
            : product.price - promo.discountValue;
        return { price: finalPrice, hasPromo: true, promoName: promo.name };
      }
      return { price: product.price, hasPromo: false, promoName: null };
    },
    [activePromos]
  );

  const addToCart = useCallback(
    (product: Product) => {
      if (product.stock <= 0) return;
      const { price } = getDiscountedPrice(product);
      const cartString = localStorage.getItem('cart');
      const cart = cartString ? JSON.parse(cartString) : [];
      const idx = cart.findIndex((item: { id: string }) => item.id === product.id);
      if (idx >= 0) cart[idx].quantity += 1;
      else {
        const baseUnit = (product.unit || 'PCS').toString().toUpperCase();
        cart.push({
          ...product,
          price,
          quantity: 1,
          baseUnit,
          unit: baseUnit,
          unitContains: 1,
          basePrice: price,
          unitPrice: price,
          units: product.units || [],
        });
      }
      localStorage.setItem('cart', JSON.stringify(cart));
      window.dispatchEvent(new Event('cart-updated'));
      toast.success(`${product.name} ditambahkan ke keranjang!`);
    },
    [getDiscountedPrice]
  );

  const promoProducts = useMemo(() => {
    return products.filter((p) => getDiscountedPrice(p).hasPromo);
  }, [products, getDiscountedPrice]);

  const notifTransaksi = useMemo(
    () => notifications.filter((n) => n.type === 'transaction'),
    [notifications]
  );
  const notifInformasi = useMemo(
    () => notifications.filter((n) => n.type !== 'transaction'),
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    const base = notifTab === 'transaksi' ? notifTransaksi : notifInformasi;
    if (notifCategory === 'Semua') return base;
    return base.filter((n) => (n.category || '').toLowerCase() === notifCategory.toLowerCase());
  }, [notifTab, notifTransaksi, notifInformasi, notifCategory]);

  useEffect(() => {
    // 1. Cart update listener
    const updateCartCount = () => {
      try {
        const savedCart = JSON.parse(localStorage.getItem('cart') || '[]');
        const count = savedCart.reduce(
          (sum: number, item: { quantity: number | string }) => sum + (Number(item.quantity) || 0),
          0
        );
        setCartCount(count);
      } catch {}
    };
    updateCartCount();
    window.addEventListener('cart-updated', updateCartCount);

    // 2. Wishlist from localStorage
    try {
      const savedWish = localStorage.getItem('atayatoko-wishlist');
      if (savedWish) setWishlist(JSON.parse(savedWish));
    } catch {}

    // 3. User Auth & dynamic user data loading (deferred, only when logged in)
    const checkUser = async () => {
      try {
        const { user } = await getUserAndRole();
        if (!user) {
          setCurrentUserName(null);
          setCurrentUserPhotoUrl(null);
          setNotifications([]);
          setRepurchaseProducts([]);
          return;
        }

        setCurrentUserPhotoUrl(user.photoURL || null);

        // Dynamically load user-home-data module only when user is logged in
        const { fetchUserHomeData } = await import('@/lib/user-home-data');
        const userData = await fetchUserHomeData(user.uid);
        if (userData.userName) setCurrentUserName(userData.userName);
        else if (user.displayName) setCurrentUserName(user.displayName);
        else setCurrentUserName('Pengguna');

        setRepurchaseProducts(userData.repurchaseProducts);
        setNotifications(userData.notifications);
      } catch (e) {
        console.error('Error loading user session:', e);
      }
    };

    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      checkUser();
    });

    return () => {
      window.removeEventListener('cart-updated', updateCartCount);
      subscription.unsubscribe();
    };
  }, []);

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase());
    const price = getDiscountedPrice(p).price;
    const matchesMin = minPrice ? price >= Number(minPrice) : true;
    const matchesMax = maxPrice ? price <= Number(maxPrice) : true;
    return matchesSearch && matchesMin && matchesMax;
  });

  const onWishlistToggle = (id: string) => {
    const newWish = wishlist.includes(id) ? wishlist.filter((i) => i !== id) : [...wishlist, id];
    setWishlist(newWish);
    localStorage.setItem('atayatoko-wishlist', JSON.stringify(newWish));
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setCurrentUserName(null);
    setCurrentUserPhotoUrl(null);
    setNotifications([]);
    setRepurchaseProducts([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-black pb-24 page-fade">
      {/* Running Marquee Header */}
      <div className="bg-green-700 text-white py-1.5 overflow-hidden whitespace-nowrap">
        <div className="animate-marquee inline-block text-xs font-bold uppercase tracking-widest px-4">
          {systemSettings?.store?.footerMsg ||
            '🚚 GRATIS ONGKIR KEDIRI KOTA • HARGA GROSIR SUPER HEMAT • ATAYAMARKET 🚚'}
        </div>
      </div>

      {/* Main Home Header */}
      <HomeHeader
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        showFilter={showFilter}
        setShowFilter={setShowFilter}
        cartCount={cartCount}
        currentUserName={currentUserName}
        currentUserPhotoUrl={currentUserPhotoUrl}
        notifications={notifications}
        notifOpen={notifOpen}
        setNotifOpen={setNotifOpen}
        notifTab={notifTab}
        setNotifTab={setNotifTab}
        notifCategory={notifCategory}
        setNotifCategory={setNotifCategory}
        filteredNotifications={filteredNotifications}
        notifTransaksi={notifTransaksi}
        notifInformasi={notifInformasi}
        notifRef={notifRef}
        warehouses={warehouses}
        selectedWarehouseId={selectedWarehouseId}
        setSelectedWarehouseId={setSelectedWarehouseId}
        onSignOut={handleSignOut}
      />

      {/* Filter Sheet / Options */}
      {showFilter && (
        <div className="max-w-7xl mx-auto px-4 mt-3 pt-3 border-t border-gray-100 animate-in slide-in-from-top-2">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-500 mb-1 block">Min Harga</label>
              <input
                type="number"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="0"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-green-500"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-500 mb-1 block">Max Harga</label>
              <input
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Tak Terbatas"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-green-500"
              />
            </div>
            <button
              onClick={() => {
                setMinPrice('');
                setMaxPrice('');
              }}
              className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-black hover:bg-gray-200 transition-colors h-[34px]"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Hero Banners */}
      {!searchQuery && <HomeBanners banners={banners} activePromos={activePromos} />}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-4">
        {searchQuery ? (
          <section className="px-4">
            <h2 className="text-sm font-black mb-4">Hasil Pencarian</h2>
            {filteredProducts.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <p className="text-sm">Tidak ada produk ditemukan untuk &quot;{searchQuery}&quot;</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                {filteredProducts.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    promoInfo={getDiscountedPrice(p)}
                    isWish={wishlist.includes(p.id)}
                    onWishlistToggle={onWishlistToggle}
                    onAddToCart={addToCart}
                  />
                ))}
              </div>
            )}
          </section>
        ) : (
          <>
            {/* Promo Flash Sale Products */}
            {promoProducts.length > 0 && (
              <div className="mb-8 px-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="bg-red-600 p-1.5 rounded-lg text-white animate-bounce">
                    <Flame size={16} fill="currentColor" />
                  </div>
                  <h2 className="text-sm font-black text-red-600 tracking-tighter">Penawaran Terbatas</h2>
                </div>
                <div className="flex overflow-x-auto gap-4 scrollbar-hide pb-2 snap-x">
                  {promoProducts.map((p) => (
                    <ProductCard
                      key={`promo-${p.id}`}
                      product={p}
                      promoInfo={getDiscountedPrice(p)}
                      isWish={wishlist.includes(p.id)}
                      onWishlistToggle={onWishlistToggle}
                      onAddToCart={addToCart}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Repurchase Products (Only if logged in user has history) */}
            {repurchaseProducts.length > 0 && (
              <div className="mb-8 px-4">
                <div className="flex items-center gap-2 mb-4">
                  <RefreshCw size={18} className="text-blue-500 animate-spin-slow" />
                  <h2 className="text-sm font-black text-gray-800 tracking-tighter">Beli Lagi</h2>
                </div>
                <div className="flex overflow-x-auto gap-4 scrollbar-hide pb-2 snap-x">
                  {repurchaseProducts.map((p) => (
                    <ProductCard
                      key={`rep-${p.id}`}
                      product={p}
                      promoInfo={getDiscountedPrice(p)}
                      isWish={wishlist.includes(p.id)}
                      onWishlistToggle={onWishlistToggle}
                      onAddToCart={addToCart}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Featured Products */}
            <div className="mb-8 px-4">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={18} className="text-yellow-500" />
                <h2 className="text-sm font-black text-gray-800 tracking-tighter">Khusus Untukmu</h2>
              </div>
              <div className="flex overflow-x-auto gap-4 scrollbar-hide pb-2 snap-x">
                {randomProducts.map((p) => (
                  <ProductCard
                    key={`rand-${p.id}`}
                    product={p}
                    promoInfo={getDiscountedPrice(p)}
                    isWish={wishlist.includes(p.id)}
                    onWishlistToggle={onWishlistToggle}
                    onAddToCart={addToCart}
                  />
                ))}
              </div>
            </div>

            {/* Category Carousels (Dynamically loaded chunk per category) */}
            {categories.slice(0, 6).map((cat) => {
              const items = products.filter((p) => p.category === cat.name);
              if (items.length === 0) return null;
              return (
                <CategoryProductSection
                  key={cat.id}
                  category={cat}
                  products={items}
                  getDiscountedPrice={getDiscountedPrice}
                  wishlist={wishlist}
                  onWishlistToggle={onWishlistToggle}
                  onAddToCart={addToCart}
                />
              );
            })}

            {/* Navigation CTA Buttons */}
            <div className="mb-8 px-4 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/semua-produk"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white text-xs font-black rounded-xl hover:bg-green-700 shadow-sm transition-all"
              >
                Lihat Semua Produk <ArrowRight size={14} />
              </Link>
              <Link
                href="/semua-kategori"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 transition-all"
              >
                Lihat Semua Kategori <ArrowRight size={14} />
              </Link>
            </div>
          </>
        )}
      </main>

      {/* Jaminan Layanan & Hal Penting Diketahui Pelanggan */}
      <CustomerGuarantees variant="cards" />

      {/* Global Footer */}
      <HomeFooter cartCount={cartCount} />

      <style jsx global>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-marquee {
          display: inline-block;
          animation: marquee 30s linear infinite;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .animate-spin-slow {
          animation: spin 3s linear infinite;
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
