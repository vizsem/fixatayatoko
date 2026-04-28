'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, query, where, orderBy, limit, getDoc, doc } from 'firebase/firestore';
import toast from 'react-hot-toast';

import useProducts from '@/lib/hooks/useProducts';
import { Product, Promotion, Banner, SystemSettings, NotificationItem, Category } from '@/lib/types';

import { 
  Package, RefreshCw, Sparkles, Flame, ArrowRight 
} from 'lucide-react';
import Link from 'next/link';

// Components
import { HomeHeader } from '@/components/home/HomeHeader';
import { HomeBanners } from '@/components/home/HomeBanners';
import { HomeFooter } from '@/components/home/HomeFooter';
import { ProductCard } from '@/components/home/ProductCard';
import { SkeletonCard } from '@/components/home/SkeletonCard';
import { HomeSkeleton } from '@/components/home/HomeSkeleton';

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
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
  const [products, setProducts] = useState<Product[]>([]);
  const [randomProducts, setRandomProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activePromos, setActivePromos] = useState<Promotion[]>([]);
  const [repurchaseProducts, setRepurchaseProducts] = useState<Product[]>([]);
  const [othersLoading, setOthersLoading] = useState(true);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
  
  const { products: normalizedProducts, loading: productsLoading } = useProducts({ 
    isActive: true, 
    orderByField: 'name',
    warehouseId: selectedWarehouseId || undefined 
  });
  
  const [showFilter, setShowFilter] = useState(false);
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');

  const getDiscountedPrice = useCallback((product: Product) => {
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
  }, [activePromos]);

  const addToCart = useCallback((product: Product) => {
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
        units: product.units || [] 
      });
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    window.dispatchEvent(new Event('cart-updated'));
    toast.success(`${product.name} ditambahkan ke keranjang!`);
  }, [getDiscountedPrice]);

  const promoProducts = useMemo(() => {
    return products.filter(p => getDiscountedPrice(p).hasPromo);
  }, [products, getDiscountedPrice]);

  const notifTransaksi = useMemo(() => notifications.filter(n => n.type === 'transaction'), [notifications]);
  const notifInformasi = useMemo(() => notifications.filter(n => n.type !== 'transaction'), [notifications]);
  
  const filteredNotifications = useMemo(() => {
    const base = notifTab === 'transaksi' ? notifTransaksi : notifInformasi;
    if (notifCategory === 'Semua') return base;
    return base.filter(n => (n.category || '').toLowerCase() === notifCategory.toLowerCase());
  }, [notifTab, notifTransaksi, notifInformasi, notifCategory]);

  useEffect(() => {
    setIsMounted(true);
    const updateCartCount = () => {
      const savedCart = JSON.parse(localStorage.getItem('cart') || '[]');
      const count = savedCart.reduce((sum: number, item: { quantity: number | string }) => sum + (Number(item.quantity) || 0), 0);
      setCartCount(count);
    };
    updateCartCount();
    window.addEventListener('cart-updated', updateCartCount);
    
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCurrentUserName(null);
        setCurrentUserPhotoUrl(null);
        setNotifications([]);
        return;
      }
      setCurrentUserPhotoUrl(user.photoURL || null);
      try {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        setCurrentUserName(userSnap.exists() ? userSnap.data()?.name : user.displayName || 'Pengguna');
        
        const q = query(collection(db, 'orders'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(5));
        const snap = await getDocs(q);
        const allItems = snap.docs.flatMap(d => d.data().items || []);
        const uniqueItemIds = Array.from(new Set(allItems.map((i: any) => i.id))).slice(0, 10);
        
        if (uniqueItemIds.length > 0) {
          const productsQ = query(collection(db, 'products'), where('__name__', 'in', uniqueItemIds));
          const pSnap = await getDocs(productsQ);
          const reProducts = pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)).map(data => ({
            id: data.id,
            name: String(data.name || data.Nama || "Produk"),
            price: Number(data.price || data.Ecer) || 0,
            wholesalePrice: Number(data.wholesalePrice || data.Grosir) || 0,
            minWholesale: Number(data.minWholesale || data.Min_Grosir || 1),
            stock: Number(data.stock || data.Stok || 0),
            unit: String(data.unit || data.Satuan || 'pcs'),
            category: String(data.category || data.Kategori || 'Umum'),
            image: String(data.image || data.Link_Foto || '/logo-atayatoko.png')
          } as Product));
          setRepurchaseProducts(reProducts);
        }

        const nq = query(collection(db, 'notifications'), where('userId', 'in', [user.uid, 'all']), orderBy('createdAt', 'desc'), limit(30));
        const nsnap = await getDocs(nq);
        setNotifications(nsnap.docs.map(d => ({ id: d.id, ...d.data() } as NotificationItem)));
      } catch (e) {
        console.error(e);
      }
    });

    return () => {
      window.removeEventListener('cart-updated', updateCartCount);
      unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [promoSnap, bannerSnap, sysSnap, whSnap] = await Promise.all([
          getDocs(collection(db, 'promotions')),
          getDocs(collection(db, 'banners')),
          getDoc(doc(db, 'settings', 'system')),
          getDocs(collection(db, 'warehouses'))
        ]);
        const now = new Date();
        setActivePromos(promoSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Promotion)).filter(p => p.isActive && new Date(p.startDate) <= now && new Date(p.endDate) >= now));
        setBanners(bannerSnap.docs.map(d => ({ id: d.id, ...d.data() } as Banner)).filter(b => b.isActive));
        setWarehouses(whSnap.docs.map(d => ({ id: d.id, name: String(d.data().name || '') })));
        if (sysSnap.exists()) {
          const sysData = sysSnap.data() as SystemSettings;
          setSystemSettings(sysData);
          if (sysData.displayWarehouseId) setSelectedWarehouseId(sysData.displayWarehouseId);
        }
        const savedWish = localStorage.getItem('atayatoko-wishlist');
        if (savedWish) setWishlist(JSON.parse(savedWish));
      } catch (error) { console.error(error); } finally { setOthersLoading(false); }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const mapped = normalizedProducts.map((p) => ({
      id: p.id,
      name: p.name || 'Produk',
      price: Number(p.priceEcer || 0),
      wholesalePrice: Number(p.priceGrosir || p.priceEcer || 0),
      minWholesale: Number(p.minWholesaleQty || 1),
      stock: systemSettings?.displayWarehouseId ? Number(p.stockByWarehouse?.[systemSettings.displayWarehouseId] || 0) : Number(p.stock || 0),
      unit: (p.unit || 'PCS').toString().toUpperCase(),
      category: p.category || 'Umum',
      image: p.imageUrl || '/logo-atayatoko.png',
      units: p.units || []
    } as Product));
    setProducts(mapped);
    setRandomProducts([...mapped].filter(p => p.stock > 0).sort(() => 0.5 - Math.random()).slice(0, 6));
    setCategories(Array.from(new Set(mapped.map(p => p.category))).map((name, i) => ({ id: `cat-${i}`, name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-') })));
  }, [normalizedProducts, systemSettings]);

  const isLoading = productsLoading || othersLoading;

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.category.toLowerCase().includes(searchQuery.toLowerCase());
    const price = getDiscountedPrice(p).price;
    const matchesMin = minPrice ? price >= Number(minPrice) : true;
    const matchesMax = maxPrice ? price <= Number(maxPrice) : true;
    return matchesSearch && matchesMin && matchesMax;
  });

  const onWishlistToggle = (id: string) => {
    const newWish = wishlist.includes(id) ? wishlist.filter(i => i !== id) : [...wishlist, id];
    setWishlist(newWish);
    localStorage.setItem('atayatoko-wishlist', JSON.stringify(newWish));
  };

  if (!isMounted || isLoading) return <HomeSkeleton />;

  return (
    <div className="min-h-screen bg-gray-50 text-black pb-24 page-fade">
      <div className="bg-green-700 text-white py-1.5 overflow-hidden whitespace-nowrap">
        <div className="animate-marquee inline-block text-[10px] font-bold uppercase tracking-widest px-4">
          {systemSettings?.store?.footerMsg || '🚚 GRATIS ONGKIR KEDIRI KOTA • HARGA GROSIR SUPER HEMAT • ATAYAMARKET 🚚'}
        </div>
      </div>

      <HomeHeader 
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        showFilter={showFilter} setShowFilter={setShowFilter}
        cartCount={cartCount}
        currentUserName={currentUserName} currentUserPhotoUrl={currentUserPhotoUrl}
        notifications={notifications}
        notifOpen={notifOpen} setNotifOpen={setNotifOpen}
        notifTab={notifTab} setNotifTab={setNotifTab}
        notifCategory={notifCategory} setNotifCategory={setNotifCategory}
        filteredNotifications={filteredNotifications}
        notifTransaksi={notifTransaksi} notifInformasi={notifInformasi}
        notifRef={notifRef}
        warehouses={warehouses}
        selectedWarehouseId={selectedWarehouseId} setSelectedWarehouseId={setSelectedWarehouseId}
        onSignOut={() => auth.signOut()}
      />

      {showFilter && (
        <div className="max-w-7xl mx-auto px-4 mt-3 pt-3 border-t border-gray-100 animate-in slide-in-from-top-2">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Min Harga</label>
              <input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="0" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-green-500" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Max Harga</label>
              <input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Tak Terbatas" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-green-500" />
            </div>
            <button onClick={() => { setMinPrice(''); setMaxPrice(''); }} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-black uppercase hover:bg-gray-200 transition-colors h-[34px]">Reset</button>
          </div>
        </div>
      )}

      {!searchQuery && <HomeBanners banners={banners} activePromos={activePromos} />}

      <main className="max-w-7xl mx-auto py-4">
        {isLoading ? (
          <div className="px-4 space-y-8"><div className="flex gap-4 overflow-hidden"><SkeletonCard /><SkeletonCard /></div></div>
        ) : searchQuery ? (
          <section className="px-4">
            <h2 className="text-sm font-black uppercase mb-4">Hasil Pencarian</h2>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              {filteredProducts.map(p => <ProductCard key={p.id} product={p} promoInfo={getDiscountedPrice(p)} isWish={wishlist.includes(p.id)} onWishlistToggle={onWishlistToggle} onAddToCart={addToCart} />)}
            </div>
          </section>
        ) : (
          <>
            {promoProducts.length > 0 && (
              <div className="mb-8 px-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="bg-red-600 p-1.5 rounded-lg text-white animate-bounce"><Flame size={16} fill="currentColor" /></div>
                  <h2 className="text-sm font-black uppercase text-red-600 tracking-tighter">Penawaran Terbatas</h2>
                </div>
                <div className="flex overflow-x-auto gap-4 scrollbar-hide pb-2 snap-x">
                  {promoProducts.map(p => <ProductCard key={`promo-${p.id}`} product={p} promoInfo={getDiscountedPrice(p)} isWish={wishlist.includes(p.id)} onWishlistToggle={onWishlistToggle} onAddToCart={addToCart} />)}
                </div>
              </div>
            )}
            
            {repurchaseProducts.length > 0 && (
              <div className="mb-8 px-4">
                <div className="flex items-center gap-2 mb-4">
                  <RefreshCw size={18} className="text-blue-500 animate-spin-slow" />
                  <h2 className="text-sm font-black uppercase text-gray-800 tracking-tighter">Beli Lagi</h2>
                </div>
                <div className="flex overflow-x-auto gap-4 scrollbar-hide pb-2 snap-x">
                  {repurchaseProducts.map(p => <ProductCard key={`rep-${p.id}`} product={p} promoInfo={getDiscountedPrice(p)} isWish={wishlist.includes(p.id)} onWishlistToggle={onWishlistToggle} onAddToCart={addToCart} />)}
                </div>
              </div>
            )}

            <div className="mb-8 px-4">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={18} className="text-yellow-500" />
                <h2 className="text-sm font-black uppercase text-gray-800 tracking-tighter">Khusus Untukmu</h2>
              </div>
              <div className="flex overflow-x-auto gap-4 scrollbar-hide pb-2 snap-x">
                {randomProducts.map(p => <ProductCard key={`rand-${p.id}`} product={p} promoInfo={getDiscountedPrice(p)} isWish={wishlist.includes(p.id)} onWishlistToggle={onWishlistToggle} onAddToCart={addToCart} />)}
              </div>
            </div>

            {categories.map(cat => {
              const items = products.filter(p => p.category === cat.name);
              if (items.length === 0) return null;
              return (
                <div key={cat.id} className="mb-8 px-4">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-green-100 text-green-600"><Package size={18} /></div>
                      <h2 className="text-sm font-black uppercase text-gray-800 tracking-tighter">{cat.name}</h2>
                    </div>
                    <Link href={`/kategori/${cat.slug}`} className="text-[10px] font-bold text-gray-400">SEMUA <ArrowRight size={12} className="inline" /></Link>
                  </div>
                  <div className="flex overflow-x-auto gap-4 scrollbar-hide pb-2 snap-x">
                    {items.slice(0, 10).map(p => <ProductCard key={p.id} product={p} promoInfo={getDiscountedPrice(p)} isWish={wishlist.includes(p.id)} onWishlistToggle={onWishlistToggle} onAddToCart={addToCart} />)}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </main>

      <HomeFooter cartCount={cartCount} />

      <style jsx global>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-marquee { display: inline-block; animation: marquee 30s linear infinite; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .animate-spin-slow { animation: spin 3s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
