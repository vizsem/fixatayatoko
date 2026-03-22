'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { auth, db } from '@/lib/firebase';

import useProducts from '@/lib/hooks/useProducts';

import Link from 'next/link';
import Image from 'next/image';
import {
  Search, ShoppingCart, User, Heart, Package,
  ShieldCheck, Printer, ArrowRight, Info, Phone,
  Home as HomeIcon, Grid, Sparkles, Gift, RefreshCw, Flame,
  FileText, Filter, Smartphone, Bell, ClipboardList, ChevronDown, Store,
  Ticket, Settings, LogOut, MapPin, Truck, Clock
} from 'lucide-react';
import { collection, getDocs, query, where, orderBy, limit, getDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { UnitOption } from '@/lib/types';

// --- TYPES ---
type Product = {
  minWholesale: number; id: string; name: string; price: number;
  wholesalePrice: number; stock: number; category: string;
  unit: string; barcode?: string; image: string; variant?: string;
  units?: Array<UnitOption & { minQty?: number }>;
};

type Category = { id: string; name: string; slug: string; };

type Promotion = {
  id: string; name: string; type: 'product' | 'category' | 'coupon';
  discountType: 'percentage' | 'fixed'; discountValue: number;
  targetId?: string; targetName?: string; startDate: string;
  endDate: string; isActive: boolean;
};

type Banner = {
  id?: string;
  title: string;
  subtitle: string;
  buttonText: string;
  gradient: string;
  imageUrl?: string;
  linkUrl?: string;
  isActive: boolean;
};

type SystemSettings = {
  store: {
    name: string;
    phone: string;
    address: string;
    footerMsg?: string;
  };
  displayWarehouseId?: string;
};

type NotificationItem = {
  id: string;
  type: 'transaction' | 'info';
  category?: string;
  title: string;
  body?: string;
  createdAt?: string;
};

const SkeletonCard = () => (
  <div className="min-w-[165px] md:min-w-[210px] bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
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
    warehouseId: selectedWarehouseId || undefined // Pass selected warehouse ID if available
  });
  
  // Filter States
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
      cart.push({ ...product, price, quantity: 1, baseUnit, unit: baseUnit, unitContains: 1, basePrice: price, unitPrice: price, units: product.units || [] });
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    window.dispatchEvent(new Event('cart-updated'));
  }, [getDiscountedPrice]);

  const promoProducts = useMemo(() => {
    return products
      .filter(p => getDiscountedPrice(p).hasPromo);
  }, [products, getDiscountedPrice]);

  const notifTransaksi = useMemo(
    () => notifications.filter(n => n.type === 'transaction'),
    [notifications]
  );
  const notifInformasi = useMemo(
    () => notifications.filter(n => n.type !== 'transaction'),
    [notifications]
  );
  const filteredNotifications = useMemo(() => {
    const base = notifTab === 'transaksi' ? notifTransaksi : notifInformasi;
    if (notifCategory === 'Semua') return base;
    return base.filter(n => (n.category || '').toLowerCase() === notifCategory.toLowerCase());
  }, [notifTab, notifTransaksi, notifInformasi, notifCategory]);

  useEffect(() => {
    if (!notifOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNotifOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [notifOpen]);

  useEffect(() => {
    setIsMounted(true);
    const updateCartCount = () => {
      const savedCart = JSON.parse(localStorage.getItem('cart') || '[]');
      const count = savedCart.reduce((sum: number, item: { quantity: number | string }) => sum + (Number(item.quantity) || 0), 0);
      setCartCount(count);
    };
    updateCartCount();
    window.addEventListener('cart-updated', updateCartCount);
    
    // Fetch Repurchase Data (Jika User Login)
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCurrentUserName(null);
        setCurrentUserPhotoUrl(null);
        setNotifications([]);
        return;
      }

      setCurrentUserPhotoUrl(user.photoURL || null);
      const fallbackName =
        user.displayName ||
        (user.email ? user.email.split('@')[0] : '') ||
        'Pengguna';

      try {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        const docName = userSnap.exists() ? userSnap.data()?.name : null;
        const resolvedName = typeof docName === 'string' && docName.trim() ? docName.trim() : fallbackName;
        setCurrentUserName(resolvedName);
      } catch {
        setCurrentUserName(fallbackName);
      }

      if (user) {
        try {
          // Ambil 5 order terakhir user
          const q = query(collection(db, 'orders'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(5));
          const snap = await getDocs(q);
          const allItems = snap.docs.flatMap(d => d.data().items || []);
          
          // Ambil item unik berdasarkan ID
          const uniqueItemIds = Array.from(new Set(allItems.map((i: { id: string }) => i.id))).slice(0, 10);
          
          // Karena Firestore "in" query limit 10, kita bisa langsung fetch
          if (uniqueItemIds.length > 0) {
            const productsQ = query(collection(db, 'products'), where('__name__', 'in', uniqueItemIds));
            const pSnap = await getDocs(productsQ);
            
            const reProducts = pSnap.docs
              .map(doc => ({ id: doc.id, ...doc.data() } as Record<string, unknown>))
              .filter(data => {
                const isActive = typeof data.isActive === 'boolean' 
                  ? data.isActive 
                  : (Number(data.Status ?? 1) !== 0);
                return isActive;
              })
              .map(data => {
                return {
                  id: data.id as string,
                  name: String(data.name || data.Nama || "Produk"),
                  price: Number(data.price || data.Ecer) || 0,
                  wholesalePrice: Number(data.wholesalePrice || data.Grosir) || Number(data.Ecer) || 0,
                  minWholesale: Number(data.minWholesale || data.Min_Grosir || data.Min_Stok_Grosir || 1),
                  stock: Number(data.stock || data.Stok || 0),
                  unit: String(data.unit || data.Satuan || 'pcs'),
                  category: String(data.category || data.Kategori || 'Umum'),
                  image: String(data.image || data.Link_Foto || '/logo-atayatoko.png'),
                  variant: String(data.variant || '')
                } as Product;
              });
            setRepurchaseProducts(reProducts);
          }

          // Ambil notifikasi
          try {
            const nq = query(
              collection(db, 'notifications'),
              where('userId', 'in', [user.uid, 'all']),
              orderBy('createdAt', 'desc'),
              limit(30)
            );
            const nsnap = await getDocs(nq);
            const items: NotificationItem[] = nsnap.docs.map(d => {
              const data = d.data() as Record<string, unknown>;
              const t = String(data.type || 'info').toLowerCase();
              return {
                id: d.id,
                type: t === 'transaction' ? 'transaction' : 'info',
                category: typeof data.category === 'string' ? data.category : undefined,
                title: String(data.title || 'Notifikasi'),
                body: typeof data.body === 'string' ? data.body : undefined,
                createdAt: typeof data.createdAt === 'string' ? data.createdAt : undefined
              };
            });
            setNotifications(items);
          } catch {
            setNotifications([]);
          }
        } catch (e) {
          console.error("Error fetching repurchase items:", e);
        }
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
        const active = promoSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Promotion))
          .filter(p => {
            if (!p.isActive) return false;
            try {
              // Safe date parsing for Safari/iOS
              const start = p.startDate ? new Date(p.startDate.replace(/-/g, '/')) : new Date(0); 
              const end = p.endDate ? new Date(p.endDate.replace(/-/g, '/')) : new Date(0);
              // Fallback to standard ISO if replacement fails or just try standard new Date if string is ISO
              const safeStart = isNaN(start.getTime()) ? new Date(p.startDate) : start;
              const safeEnd = isNaN(end.getTime()) ? new Date(p.endDate) : end;
              
              return !isNaN(safeStart.getTime()) && !isNaN(safeEnd.getTime()) && now >= safeStart && now <= safeEnd;
            } catch {
              return false;
            }
          });

        setActivePromos(active);

        const bannerList = bannerSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Banner[];
        setBanners(bannerList.filter(b => b.isActive));

        const whList = whSnap.docs.map(d => ({ id: d.id, name: String(d.data().name || '') }));
        setWarehouses(whList);

        if (sysSnap.exists()) {
          const sysData = sysSnap.data() as SystemSettings;
          setSystemSettings(sysData);
          if (sysData.displayWarehouseId) {
            setSelectedWarehouseId(sysData.displayWarehouseId);
          }
        }

        const savedWish = localStorage.getItem('atayatoko-wishlist');
        if (savedWish) setWishlist(JSON.parse(savedWish));
      } catch (error) { console.error(error); } finally { setOthersLoading(false); }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const mapped = normalizedProducts.map((p) => {
      const minQtyUnit = (p.units || []).find((u) => typeof u.minQty === 'number' && u.minQty > 0);

      // Gunakan stok gudang jika ada setting displayWarehouseId
      let finalStock = Number(p.stock || 0);
      if (systemSettings?.displayWarehouseId && p.stockByWarehouse) {
        finalStock = Number(p.stockByWarehouse[systemSettings.displayWarehouseId] || 0);
      } else if (systemSettings?.displayWarehouseId && !p.stockByWarehouse) {
        // Jika produk tidak punya data stockByWarehouse tapi gudang dipilih -> anggap 0 atau tetap total?
        // Asumsi: jika stockByWarehouse kosong, mungkin data lama, gunakan total stock atau 0.
        // Lebih aman 0 jika kita ketat, tapi mungkin total stock lebih baik untuk fallback.
        // Mari kita gunakan 0 agar konsisten "hanya stok gudang itu".
        finalStock = 0; 
      }

      return {
        id: p.id,
        name: p.name || 'Produk',
        price: Number(p.priceEcer || 0),
        wholesalePrice: Number(p.priceGrosir || p.priceEcer || 0),
        minWholesale: Number(minQtyUnit?.minQty || 1),
        stock: finalStock,
        unit: (p.unit || 'PCS').toString().toUpperCase(),
        category: p.category || 'Umum',
        image: p.imageUrl || '/logo-atayatoko.png',
        variant: '',
        units: (p.units || []).map((u) => ({
          code: (u.code || '').toString().toUpperCase(),
          contains: Number(u.contains || 0),
          price: typeof u.price === 'number' ? Number(u.price) : undefined,
          label: u.label ? String(u.label) : undefined,
          minQty: typeof u.minQty === 'number' ? Number(u.minQty) : undefined,
        })).filter((u) => u.code && Number(u.contains || 0) > 0)
      } as Product;
    });
    setProducts(mapped);
    const inStock = mapped.filter((pp) => pp.stock > 0);
    setRandomProducts([...inStock].sort(() => 0.5 - Math.random()).slice(0, 6));
    const catList = Array.from(new Set(mapped.map(p => p.category)))
      .map((name, i) => ({
        id: `cat-${i}`, name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      }))
      .sort(() => 0.5 - Math.random());
    setCategories(catList);
  }, [normalizedProducts, systemSettings]);

  const isLoading = productsLoading || othersLoading;

  const ProductCard = ({ product }: { product: Product }) => {
    const promoInfo = getDiscountedPrice(product);
    const isOut = product.stock <= 0;
    const isWish = wishlist.includes(product.id);
    const baseUnit = (product.unit || 'PCS').toString().toUpperCase();
    const baseDiscount = Math.max(0, Number(product.price || 0) - Number(promoInfo.price || 0));

    const unitList = (() => {
      const src = (product.units || []).map((u) => ({
        code: (u.code || '').toString().toUpperCase(),
        contains: Math.max(1, Math.floor(Number(u.contains || 1))),
        price: typeof u.price === 'number' ? Number(u.price) : undefined,
      })).filter((u) => u.code);
      const list = src.some((u) => u.code === baseUnit) ? src : [{ code: baseUnit, contains: 1 }, ...src];
      const uniq = new Map<string, { code: string; contains: number; price?: number }>();
      list.forEach((u) => {
        if (!uniq.has(u.code)) uniq.set(u.code, u);
      });
      const deduped = Array.from(uniq.values());
      deduped.sort((a, b) => {
        if (a.code === baseUnit && b.code !== baseUnit) return -1;
        if (b.code === baseUnit && a.code !== baseUnit) return 1;
        return a.contains - b.contains;
      });
      return deduped;
    })();

    const unitPrice = (u: { code: string; contains: number; price?: number }) => {
      const baseUnitPrice = Number(u.price ?? (Number(product.price || 0) * Number(u.contains || 1)));
      const discounted = promoInfo.hasPromo ? Math.max(0, baseUnitPrice - (baseDiscount * Number(u.contains || 1))) : baseUnitPrice;
      return Math.round(discounted);
    };

    return (
      <div className="min-w-[165px] md:min-w-[210px] bg-white rounded-2xl border border-gray-100 overflow-hidden snap-start shadow-sm hover:shadow-md transition-shadow flex flex-col relative group">
        <button onClick={() => {
          const newWish = wishlist.includes(product.id) ? wishlist.filter(i => i !== product.id) : [...wishlist, product.id];
          setWishlist(newWish);
          localStorage.setItem('atayatoko-wishlist', JSON.stringify(newWish));
        }}
          className="absolute top-2 right-2 z-20 p-2 bg-white/90 backdrop-blur-md rounded-full shadow-md active:scale-75 transition-all">
          <Heart size={14} className={isWish ? "fill-red-500 text-red-500" : "text-gray-400"} />
        </button>

        <Link href={`/produk/${product.id}`} className="relative aspect-square bg-gray-50 overflow-hidden block">
          <Image 
            src={product.image} 
            alt={product.name} 
            fill 
            className={`object-cover transition-transform duration-500 group-hover:scale-110 ${isOut ? 'grayscale opacity-50' : ''}`} 
            sizes="190px"
            placeholder="blur"
            blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkqAcAAIUAgUW0RjgAAAAASUVORK5CYII="
          />
          {isOut && <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10"><span className="bg-white text-black text-[9px] font-black px-3 py-1 rounded-full uppercase">Habis</span></div>}
          {promoInfo.hasPromo && !isOut && (
            <div className="absolute top-2 left-2 z-10 bg-gradient-to-r from-orange-600 to-red-600 text-white text-[8px] font-black px-2 py-1 rounded uppercase animate-pulse shadow-lg flex items-center gap-1">
              <Sparkles size={10} /> Promo
            </div>
          )}
        </Link>

        <div className="p-3 flex flex-col flex-1">
          <h3 className="text-[10px] md:text-xs font-black text-gray-800 line-clamp-2 uppercase leading-tight">{product.name}</h3>
          <div className="mt-1 flex items-center justify-between">
            <p className="text-[8px] font-bold text-gray-400 uppercase">{product.category}</p>
            <p className={`text-[8px] font-black uppercase ${isOut ? 'text-rose-600' : 'text-emerald-600'}`}>
              {isOut ? 'Habis' : `Stok ${product.stock}`}
            </p>
          </div>

          <div className="flex flex-col mb-3">
              <div className="flex items-baseline gap-1">
                <span className="text-[15px] font-black text-green-600">Rp{Number(promoInfo.price || 0).toLocaleString('id-ID')}</span>
                <span className="text-[9px] font-black text-gray-400">/{baseUnit}</span>
              </div>
              
              <div className="mt-2 flex flex-wrap gap-1.5">
                {unitList.filter(u => u.code !== baseUnit).slice(0, 4).map((u) => (
                  <span
                    key={u.code}
                    className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-100 px-2 py-1 rounded-full text-[8px] font-black uppercase text-gray-700"
                    title={`${u.code}${u.contains > 1 ? ` (isi ${u.contains})` : ''} • Rp${unitPrice(u).toLocaleString('id-ID')}`}
                  >
                    <span className="text-gray-900">{u.code}</span>
                    {u.contains > 1 && <span className="text-gray-400">×{u.contains}</span>}
                    <span className="text-gray-900 not-italic">Rp{unitPrice(u).toLocaleString('id-ID')}</span>
                  </span>
                ))}
                {unitList.filter(u => u.code !== baseUnit).length > 4 && (
                  <span
                    className="inline-flex items-center bg-white border border-gray-200 px-2 py-1 rounded-full text-[8px] font-black uppercase text-gray-500"
                    title={unitList.filter(u => u.code !== baseUnit).slice(4).map((u) => `${u.code}${u.contains > 1 ? ` (isi ${u.contains})` : ''}: Rp${unitPrice(u).toLocaleString('id-ID')}`).join(' | ')}
                  >
                    +{unitList.filter(u => u.code !== baseUnit).length - 4}
                  </span>
                )}
              </div>

            {(() => {
                // Harga Grosir ditarik dari field Grosir, wholesalePrice, atau Harga_Grosir
                const rawPrice = product.wholesalePrice || (product as any).Grosir || (product as any).Harga_Grosir || 0;
                const wPrice = Number(rawPrice);
                
                // Pastikan kita menarik dari field yang tepat (terutama Min_Grosir yang digunakan di form admin)
                const minW = product.minWholesale;
                const minG = (product as any).Min_Grosir;
                const minWq = (product as any).minWholesaleQty;
                
                // Cek mana yang ada nilainya secara berurutan, pastikan di-parsing ke Number
                let wQty = 0;
                if (minG !== undefined && minG !== null && String(minG).trim() !== '' && !isNaN(Number(minG)) && Number(minG) > 0) wQty = Number(minG);
                else if (minW !== undefined && minW !== null && String(minW).trim() !== '' && !isNaN(Number(minW)) && Number(minW) > 0) wQty = Number(minW);
                else if (minWq !== undefined && minWq !== null && String(minWq).trim() !== '' && !isNaN(Number(minWq)) && Number(minWq) > 0) wQty = Number(minWq);
                
                // Jika Harga Grosir Rp0, berarti "Tanya Admin"
                if (wQty > 1) {
                  return (
                    <div className="mt-2 pt-2 border-t border-dashed border-gray-100 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-blue-500 uppercase block leading-none mb-1 tracking-widest">Target Grosir</span>
                        <span className="text-[10px] font-black text-blue-600 uppercase leading-none flex items-center gap-1">
                          Min. {wQty} {baseUnit}
                        </span>
                      </div>
                      <span className="text-blue-700 text-[11px] font-black not-italic bg-blue-50 px-2 py-1 rounded-lg">
                        {wPrice > 0 ? `Rp${wPrice.toLocaleString('id-ID')}` : 'Tanya Admin'}
                      </span>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

          <button onClick={() => addToCart(product)} disabled={isOut} className={`mt-auto w-full py-2.5 text-[9px] font-black rounded-xl uppercase shadow-sm transition-all ${isOut ? 'bg-gray-100 text-gray-400' : 'bg-gray-900 text-white active:bg-green-600 active:scale-95'}`}>
            {isOut ? 'Stok Habis' : '+ Keranjang'}
          </button>
        </div>
      </div>
    );
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase());
    
    const price = getDiscountedPrice(p).price;
    const matchesMin = minPrice ? price >= Number(minPrice) : true;
    const matchesMax = maxPrice ? price <= Number(maxPrice) : true;

    return matchesSearch && matchesMin && matchesMax;
  });

  if (!isMounted) return null;

  return (
    <div className="min-h-screen bg-gray-50 text-black pb-24 page-fade">
      <div className="bg-green-700 text-white py-1.5 overflow-hidden whitespace-nowrap">
        <div className="animate-marquee inline-block text-[10px] font-bold uppercase tracking-widest px-4">
          {systemSettings?.store?.footerMsg || '🚚 GRATIS ONGKIR KEDIRI KOTA • HARGA GROSIR SUPER HEMAT • ATAYAMARKET 🚚'}
        </div>
      </div>

      <header className="bg-white shadow-sm sticky top-0 z-50">
        {/* Top Notification Bar */}
        <div className="bg-gray-50 border-b border-gray-100 hidden md:block">
          <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-4">
              <div className="group relative cursor-pointer">
                <div className="flex items-center gap-1.5 bg-gradient-to-r from-green-500 via-emerald-500 to-green-600 text-white px-3 py-1 rounded-full shadow-sm hover:shadow-md transition-all">
                  <Smartphone size={14} className="animate-pulse" />
                  <span className="font-bold tracking-tight">Download Atayamarket App</span>
                </div>
              </div>
              
              {/* Warehouse Selector */}
              {warehouses.length > 0 && (
                <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-gray-200">
                  <Store size={14} className="text-gray-400" />
                  <select 
                    value={selectedWarehouseId} 
                    onChange={(e) => setSelectedWarehouseId(e.target.value)}
                    className="bg-transparent text-[10px] font-bold text-gray-600 outline-none cursor-pointer uppercase"
                  >
                    <option value="">Semua Gudang</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex items-center gap-6 text-gray-500 font-medium">
              <Link href="/tentang" className="hover:text-green-600 transition-colors">Tentang Atayamarket</Link>
              <Link href="/promo" className="hover:text-green-600 transition-colors">Produk Terlaris</Link>
              <Link href="/promo" className="hover:text-green-600 transition-colors">Promo Atayamarket</Link>
              <Link href="https://wa.me/85790565666" className="hover:text-green-600 transition-colors">Bantuan</Link>
            </div>
          </div>
        </div>

        {/* Mobile Header Warehouse Selector */}
        <div className="md:hidden px-4 pt-3 pb-0 bg-white">
          {warehouses.length > 0 && (
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl border border-gray-100 w-full mb-2">
              <Store size={14} className="text-gray-400" />
              <select 
                value={selectedWarehouseId} 
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                className="bg-transparent text-[10px] font-bold text-gray-600 outline-none cursor-pointer uppercase w-full"
              >
                <option value="">Semua Gudang (Total Stock)</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/logo-atayatoko.png" alt="Logo" width={32} height={32} className="h-8 w-auto" />
              <h1 className="hidden sm:block text-lg font-black text-green-600 uppercase">ATAYAMARKET</h1>
            </Link>
            <div className="flex-1 relative max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input type="text" placeholder="Cari produk..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-gray-100 border-none rounded-xl py-2 pl-10 pr-10 text-sm outline-none focus:ring-1 focus:ring-green-500/20" />
              <button 
                onClick={() => setShowFilter(!showFilter)}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors ${showFilter ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'}`}
              >
                <Filter size={14} />
              </button>
            </div>
            
            <div className="flex items-center gap-1 md:gap-2">
              {currentUserName ? (
                <div className="relative group">
                  <Link
                    href="/profil"
                    className="flex items-center gap-2 h-10 px-2 rounded-full hover:bg-gray-100 transition-colors text-gray-600"
                    title="Profil"
                  >
                    <div className="h-8 w-8 flex items-center justify-center rounded-full border border-gray-200 p-1 bg-white">
                      {currentUserPhotoUrl ? (
                        <Image src={currentUserPhotoUrl} alt="User" width={24} height={24} className="h-6 w-6 rounded-full object-cover" />
                      ) : (
                        <User size={20} className="text-gray-500" />
                      )}
                    </div>
                    <div className="max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-semibold capitalize text-gray-600 hidden md:block">
                      Hi, {currentUserName}
                    </div>
                    <ChevronDown size={18} className="text-gray-500 hidden md:block" />
                  </Link>

                  {/* HOVER DROPDOWN MENU */}
                  <div className="absolute right-0 top-full pt-2 hidden group-hover:block z-50">
                    <div className="w-[320px] bg-white rounded-2xl shadow-xl border border-gray-100 p-4 animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex items-center gap-3 pb-4 border-b border-gray-100 mb-2">
                        <div className="h-12 w-12 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center shrink-0">
                           {currentUserPhotoUrl ? (
                             <Image src={currentUserPhotoUrl} alt="User" width={48} height={48} className="h-full w-full object-cover" />
                           ) : (
                             <User size={24} className="text-gray-400" />
                           )}
                        </div>
                        <div className="overflow-hidden">
                          <p className="font-bold text-gray-900 truncate">{currentUserName}</p>
                          <Link href="/profil" className="text-[10px] text-green-600 font-bold hover:underline">Lihat Profil Saya</Link>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <Link href="/orders" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 text-gray-600 text-sm font-medium transition-colors">
                          <ClipboardList size={16} /> Pesanan Saya
                        </Link>
                        <Link href="/vouchers" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 text-gray-600 text-sm font-medium transition-colors">
                          <Ticket size={16} /> Voucher Saya
                        </Link>
                        <Link href="/wishlist" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 text-gray-600 text-sm font-medium transition-colors">
                          <Heart size={16} /> Wishlist
                        </Link>
                        <Link href="/profil/edit" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 text-gray-600 text-sm font-medium transition-colors">
                          <Settings size={16} /> Pengaturan
                        </Link>
                        <button 
                          onClick={() => auth.signOut()}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-red-50 text-red-600 text-sm font-medium transition-colors mt-2"
                        >
                          <LogOut size={16} /> Keluar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <Link
                  href="/profil/login"
                  className="flex items-center gap-2 h-10 px-3 rounded-full hover:bg-gray-100 transition-colors text-gray-600 font-semibold text-[12px]"
                  title="Masuk"
                >
                  <User size={18} className="text-gray-500" />
                  <span className="hidden lg:inline">Masuk</span>
                </Link>
              )}

              <Link href="/orders" className="hidden sm:flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500 relative" title="Transaksi">
                <ClipboardList size={22} strokeWidth={1.8} />
              </Link>

              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setNotifOpen(v => !v)}
                  className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500 relative"
                  title="Notifikasi"
                >
                  <Bell size={22} strokeWidth={1.8} />
                  <span className="absolute top-1 right-1 h-4 min-w-[16px] px-1 bg-red-600 text-white text-[9px] flex items-center justify-center rounded-full font-bold border-2 border-white">
                    {(notifications?.length || 0) + 0}
                  </span>
                </button>
                {notifOpen && (
                  <div className="absolute right-0 top-10 w-[360px] overflow-hidden rounded-lg bg-white shadow-[0_2px_8px_rgba(112,114,125,0.40)] z-50">
                    <div className="bg-white">
                      <div className="px-4 py-4 text-sm font-bold border-b border-gray-100">
                        Notifikasi
                      </div>
                      <div className="border-b border-[#EFF3F6]">
                        <ul className="-mb-px grid grid-cols-2 text-center text-sm font-medium text-[#9C9DA6]">
                          <li>
                            <button
                              onClick={() => setNotifTab('transaksi')}
                              className={`inline-flex items-center justify-center gap-2 rounded-t-lg p-3 hover:text-gray-600 ${notifTab === 'transaksi' ? 'text-gray-700 border-b-2 border-gray-300' : ''}`}
                            >
                              <span className="font-semibold">Transaksi</span>
                              <span className="bg-[#DCDEE3] text-white text-[10px] rounded-full px-2 py-[1px]">
                                {notifTransaksi.length}
                              </span>
                            </button>
                          </li>
                          <li>
                            <button
                              onClick={() => setNotifTab('informasi')}
                              className={`inline-flex items-center justify-center gap-2 rounded-t-lg p-3 ${notifTab === 'informasi' ? 'text-green-600 border-b-2 border-green-600' : 'hover:text-gray-600'}`}
                            >
                              <span className="font-semibold">Informasi</span>
                              <span className={`text-white text-[10px] rounded-full px-2 py-[1px] ${notifTab === 'informasi' ? 'bg-green-600' : 'bg-[#DCDEE3]'}`}>
                                {notifInformasi.length}
                              </span>
                            </button>
                          </li>
                        </ul>
                      </div>
                      <div className="px-4 py-2 overflow-x-auto whitespace-nowrap scrollbar-hide">
                        {['Semua', 'Akun', 'Info', 'Promo', 'Kupon', 'Poin', 'Bantuan'].map((label) => (
                          <button
                            key={label}
                            onClick={() => setNotifCategory(label)}
                            className={`${notifCategory === label ? 'bg-green-600 text-white' : 'bg-[#EFF3F6] text-gray-700'} inline-flex items-center rounded-full border border-neutral-200 px-3 py-1.5 text-[10px] font-medium mr-2`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className="relative max-h-[440px] overflow-y-auto" style={{ maxHeight: 'calc(-300px + 100vh)' }}>
                        {filteredNotifications.length === 0 ? (
                          <div className="px-4 py-6 text-sm text-gray-500">Tidak ada notifikasi.</div>
                        ) : (
                          filteredNotifications.map((n) => (
                            <div key={n.id} className="px-4 cursor-pointer">
                              <div className="flex flex-col gap-2 py-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex h-6 items-center rounded bg-[#97b5d536] px-2 py-1">
                                    <span className="text-xs text-[#1178D4]">
                                      {n.category || (n.type === 'transaction' ? 'Transaksi' : 'Info')}
                                    </span>
                                  </div>
                                  <span className="text-xs font-medium text-[#9C9DA6]">
                                    {n.createdAt || ''}
                                  </span>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <h4 className="text-sm font-semibold">{n.title}</h4>
                                  {n.body ? <p className="text-sm leading-5 text-[#70727D]">{n.body}</p> : null}
                                </div>
                              </div>
                              <div className="w-full border-t border-[#DCDEE3]" />
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Link href="/cart" className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500 relative" title="Keranjang">
                <ShoppingCart size={22} strokeWidth={1.8} />
                {cartCount > 0 && (
                  <span className="absolute top-1 right-1 h-4 min-w-[16px] px-1 bg-red-600 text-white text-[9px] flex items-center justify-center rounded-full font-bold border-2 border-white">
                    {cartCount}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>

        {showFilter && (
          <div className="max-w-7xl mx-auto px-4 mt-3 pt-3 border-t border-gray-100 animate-in slide-in-from-top-2">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Min Harga</label>
                <input 
                  type="number" 
                  value={minPrice} 
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="0"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-green-500 transition-colors"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Max Harga</label>
                <input 
                  type="number" 
                  value={maxPrice} 
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="Tak Terbatas"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-green-500 transition-colors"
                />
              </div>
              <div>
                 <button 
                   onClick={() => { setMinPrice(''); setMaxPrice(''); }}
                   className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-black uppercase hover:bg-gray-200 transition-colors h-[34px]"
                 >
                   Reset
                 </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {!searchQuery && (
        <section className="px-4 py-4 max-w-7xl mx-auto">
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 scrollbar-hide pb-2">
            <div className="min-w-[92%] md:min-w-full snap-center rounded-[2.5rem] bg-gradient-to-br from-green-600 to-emerald-800 text-white p-8 relative overflow-hidden shadow-lg">
              <div className="relative z-10">
                <h2 className="text-2xl md:text-3xl font-black mb-1 uppercase tracking-tighter">Pusat Grosir Satu Toko Semua Kebutuhan</h2>
                <p className="text-green-100 text-[11px] mb-6 max-w-[200px] leading-relaxed italic">Belanja eceran rasa grosir, dikirim langsung ke pintu.</p>
                <Link href="/semua-kategori" className="inline-block bg-white text-green-700 px-5 py-2 rounded-xl font-black text-[10px] uppercase shadow-xl tap-active">Mulai Belanja</Link>
              </div>
              <Package size={160} className="absolute -right-10 -bottom-10 opacity-10 rotate-12" />
            </div>

            {banners.map((bn) => (
              <div key={bn.id} className={`min-w-[92%] md:min-w-full snap-center rounded-[2.5rem] bg-gradient-to-r ${bn.gradient} text-white p-8 relative overflow-hidden shadow-lg`}>
                <div className="relative z-10">
                  <span className="bg-white/20 text-[8px] font-black px-2 py-0.5 rounded-full uppercase mb-2 inline-block">Pengumuman</span>
                  <h2 className="text-2xl md:text-3xl font-black mb-1 uppercase tracking-tighter">{bn.title}</h2>
                  <p className="text-white/90 text-[11px] mb-6">{bn.subtitle}</p>
                  <Link href={bn.linkUrl || '/semua-kategori'} className="inline-block bg-white text-black px-5 py-2 rounded-xl font-black text-[10px] uppercase shadow-xl tap-active">
                    {bn.buttonText || 'Lihat'}
                  </Link>
                </div>
                {bn.imageUrl ? (
                  <Image src={bn.imageUrl} alt="Banner" width={160} height={160} className="absolute -right-6 -bottom-6 opacity-20 rounded-2xl" />
                ) : null}
              </div>
            ))}

            {activePromos.map(p => (
              <div key={p.id} className="min-w-[92%] md:min-w-full snap-center rounded-[2.5rem] bg-gradient-to-br from-orange-500 to-red-600 text-white p-8 relative overflow-hidden shadow-lg">
                <div className="relative z-10">
                  <span className="bg-white/20 text-[8px] font-black px-2 py-0.5 rounded-full uppercase mb-2 inline-block">Flash Sale Aktif</span>
                  <h2 className="text-2xl md:text-3xl font-black mb-1 uppercase tracking-tighter">{p.name}</h2>
                  <p className="text-orange-50 text-[11px] mb-6">Diskon hingga {p.discountValue.toLocaleString()} {p.discountType === 'percentage' ? '%' : 'Rp'}</p>
                  <Link href="/semua-kategori" className="inline-block bg-white text-orange-600 px-5 py-2 rounded-xl font-black text-[10px] uppercase shadow-xl tap-active">Lihat Promo</Link>
                </div>
                <Gift size={160} className="absolute -right-10 -bottom-10 opacity-10 rotate-12" />
              </div>
            ))}
          </div>
        </section>
      )}

      <main className="max-w-7xl mx-auto py-4">
        {isLoading ? (
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
                    <div className="bg-red-600 p-1.5 rounded-lg text-white animate-bounce"><Flame size={16} fill="currentColor" /></div>
                    <h2 className="text-sm font-black uppercase text-red-600 tracking-tighter">Penawaran Terbatas</h2>
                  </div>
                </div>
                <div className="flex overflow-x-auto gap-4 scrollbar-hide pb-2 snap-x">
                  {promoProducts.map(p => <ProductCard key={`promo-${p.id}`} product={p} />)}
                </div>
              </div>
            )}
            
            {/* Bagian Beli Lagi (Repurchase) */}
            {repurchaseProducts.length > 0 && (
              <div className="mb-8 px-4">
                <div className="flex items-center gap-2 mb-4">
                  <RefreshCw size={18} className="text-blue-500 animate-spin-slow" />
                  <h2 className="text-sm font-black uppercase text-gray-800 tracking-tighter">Beli Lagi</h2>
                </div>
                <div className="flex overflow-x-auto gap-4 scrollbar-hide pb-2 snap-x">
                  {repurchaseProducts.map(p => {
                    const { price, hasPromo } = getDiscountedPrice(p);
                    const baseUnit = (p.unit || 'PCS').toString().toUpperCase();
                    return (
                      <div key={`rep-${p.id}`} className="min-w-[155px] md:min-w-[190px] snap-center bg-white rounded-2xl border border-gray-100 overflow-hidden relative group">
                        <Link href={`/produk/${p.id}`} className="block aspect-square bg-gray-50 relative">
                            <Image 
                             src={p.image} 
                             alt={p.name}
                             fill
                             className="object-cover group-hover:scale-105 transition-transform duration-500"
                             sizes="(max-width: 768px) 155px, 190px"
                             placeholder="blur"
                             blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkqAcAAIUAgUW0RjgAAAAASUVORK5CYII="
                           />
                         </Link>
                        <div className="p-3">
                          <h3 className="text-[10px] font-bold text-gray-800 line-clamp-2 min-h-[30px] uppercase tracking-tight mb-2 leading-tight">{p.name}</h3>
                          <div className="flex flex-col gap-0.5 mb-3">
                             {hasPromo && <span className="text-[9px] text-gray-400 line-through">Rp{Number(p.price || 0).toLocaleString('id-ID')}</span>}
                             <span className="text-xs font-black text-green-600">Rp{Number(price || 0).toLocaleString('id-ID')} <span className="text-[9px] font-black text-gray-400">/{baseUnit}</span></span>
                          </div>
                          <button 
                            onClick={() => addToCart(p)}
                            className="w-full bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1"
                          >
                            <RefreshCw size={10} /> Beli Lagi
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mb-8 px-4">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={18} className="text-yellow-500" />
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
                    <Link href={`/kategori/${cat.slug}`} className="text-[10px] font-bold text-gray-400">SEMUA <ArrowRight size={12} className="inline" /></Link>
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
      <footer className="mt-16 bg-gray-900 text-white pt-16 pb-24 md:pb-16 rounded-t-[3rem] px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Brand & Deskripsi */}
          <div className="space-y-4">
            <h2 className="text-2xl font-black tracking-tighter text-green-400">ATAYATOKO</h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              Pusat belanja sembako grosir dan eceran termurah di Kediri. Melayani pengiriman cepat langsung ke depan pintu Anda.
            </p>
          </div>

          {/* Kontak & Lokasi */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-4">Hubungi Kami</h3>
            <div className="space-y-3">
              <a href="https://wa.me/6285853161174" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-gray-300 hover:text-green-400 transition-colors">
                <div className="p-2 bg-gray-800 rounded-lg"><Phone size={16} /></div>
                <span>0858-5316-1174</span>
              </a>
              <div className="flex items-start gap-3 text-sm text-gray-300">
                <div className="p-2 bg-gray-800 rounded-lg shrink-0"><MapPin size={16} /></div>
                <span>Kediri, Jawa Timur<br/>Indonesia</span>
              </div>
            </div>
          </div>

          {/* Jam Operasional & Kebijakan */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-4">Layanan Pelanggan</h3>
            <ul className="space-y-3 text-sm text-gray-300">
              <li className="flex items-center gap-2"><Clock size={14} className="text-gray-500" /> Buka Setiap Hari (08:00 - 21:00)</li>
              <li className="flex items-center gap-2"><Truck size={14} className="text-gray-500" /> Gratis Ongkir (S&K Berlaku)</li>
              <li className="flex items-center gap-2"><ShieldCheck size={14} className="text-gray-500" /> Garansi Retur Barang Rusak</li>
            </ul>
          </div>

          {/* Tautan Internal */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-4">Internal</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/profil/login" className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2">
                  <ShieldCheck size={14} /> Panel Admin
                </Link>
              </li>
              <li>
                <Link href="/cashier" className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2">
                  <Printer size={14} /> Sistem Kasir
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="max-w-7xl mx-auto border-t border-gray-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <p className="text-xs font-bold text-gray-500">© {new Date().getFullYear()} ATAYATOKO. All rights reserved.</p>
          <div className="flex gap-4">
            <span className="text-xs font-bold text-gray-600">Aman & Terpercaya</span>
          </div>
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
        <Link href="/orders" className="flex flex-col items-center gap-1 text-gray-400">
          <FileText size={20} /><span className="text-[8px] font-black uppercase">Pesanan</span>
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
