'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import notify from '@/lib/notify';
import { createMarketplaceOrder } from '@/lib/actions/sales.actions';
import { Toaster } from 'react-hot-toast';
import {
  ChevronLeft,
  ShoppingBag,
  Save,
  Store,
  CreditCard,
  Truck,
  Hash,
  User,
  Activity,
  Warehouse
} from 'lucide-react';

import { ProductSearchList } from '@/components/admin/marketplace/ProductSearchList';
import { CartTable } from '@/components/admin/marketplace/CartTable';
import { Product } from '@/lib/types';
import * as Sentry from '@sentry/nextjs';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { getUserAndRole, sbGetDoc } from '@/lib/supabase-helpers';
import { isAuthorizedAdmin } from '@/lib/auth-helpers';
import { millisId, timestampId } from '@/lib/ids';
import {
  TARIF_DEFAULT,
  hitungBiayaAdmin,
  keteranganMode,
  type ModeHargaMarketplace,
  type TarifMarketplace,
} from '@/lib/marketplace-fee';
type Channel = 'SHOPEE' | 'TIKTOK';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
  stock: number;
  units?: any[];
  isCustomPrice?: boolean;
  defaultPrice?: number;
  lastInputtedPrice?: number;
}

function getMktLastPriceKey(channel: string, productId: string, unit: string): string {
  return `mkt_last_price_${(channel || 'shopee').toLowerCase()}_${productId}_${(unit || 'pcs').toUpperCase()}`;
}

function getMktLastPrice(channel: string, productId: string, unit: string): number | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const val = localStorage.getItem(getMktLastPriceKey(channel, productId, unit));
    if (val !== null) {
      const num = Number(val);
      if (Number.isFinite(num) && num > 0) return num;
    }
  } catch {
    // ignore
  }
  return undefined;
}

function saveMktLastPrice(channel: string, productId: string, unit: string, price: number): void {
  if (typeof window === 'undefined') return;
  try {
    if (Number.isFinite(price) && price > 0) {
      localStorage.setItem(getMktLastPriceKey(channel, productId, unit), String(price));
    }
  } catch {
    // ignore
  }
}

function getProductPriceForUnit(p: Product, channel: 'SHOPEE' | 'TIKTOK', unitCode: string): number {
  const code = unitCode.toUpperCase();
  const baseUnit = (p.unit || 'Pcs').toUpperCase();
  
  // CTN is the canonical name for DUS/KARTON/BOX (highest unit)
  const CTN_ALIASES = ['CTN', 'DUS', 'KARTON', 'BOX'];
  const isCtnFamily = CTN_ALIASES.includes(code);

  // 1. Check channelPricing: channelPricing[shopee/tiktok][unitCode].price
  const channelKey = channel.toLowerCase() as 'shopee' | 'tiktok';
  const channelPrice = (p as any).channelPricing?.[channelKey]?.[code]?.price;
  if (typeof channelPrice === 'number' && channelPrice > 0) {
    return channelPrice;
  }

  // If CTN family, also try aliases in channelPricing (e.g. product stored as DUS, user selects CTN)
  if (isCtnFamily) {
    for (const alias of CTN_ALIASES) {
      if (alias === code) continue;
      const aliasPrice = (p as any).channelPricing?.[channelKey]?.[alias]?.price;
      if (typeof aliasPrice === 'number' && aliasPrice > 0) return aliasPrice;
    }
  }

  // Find unit option (try exact code first, then aliases for CTN family)
  let unitOpt = p.units?.find((u: any) => u.code.toUpperCase() === code);
  if (!unitOpt && isCtnFamily) {
    unitOpt = p.units?.find((u: any) => CTN_ALIASES.includes(u.code.toUpperCase()));
  }

  // 2. Check general unit price in units list if available
  if (unitOpt && typeof unitOpt.price === 'number' && unitOpt.price > 0) {
    // Only return unit price if it's not the base unit (unless CTN family override)
    const isBaseUnit = code === baseUnit || (isCtnFamily && CTN_ALIASES.includes(baseUnit));
    if (!isBaseUnit) return unitOpt.price;
  }

  // 3. Fallback to base price * contains
  const basePrice = channel === 'SHOPEE' 
    ? (p.priceShopee || p.price || p.priceEcer || 0) 
    : channel === 'TIKTOK' 
      ? (p.priceTiktok || p.price || p.priceEcer || 0) 
      : (p.priceEcer || p.price || 0);

  const isBaseUnit = code === baseUnit || (isCtnFamily && CTN_ALIASES.includes(baseUnit));
  if (isBaseUnit) return basePrice;

  const contains = unitOpt?.contains || 1;
  return basePrice * contains;
}

type WarehouseOption = { id: string; name: string };

export default function MarketplaceOrdersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [channel, setChannel] = useState<Channel>('SHOPEE');
  const [externalOrderId, setExternalOrderId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('TRANSFER');
  const [shippingCost, setShippingCost] = useState(0);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [warehouseId, setWarehouseId] = useState('gudang-utama');
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  /**
   * Cara mengisi harga:
   *   AUTO   - harga jual di marketplace; sistem memotong biaya admin.
   *   MANUAL - harga bersih hasil potongan marketplace (input manual).
   */
  const [hargaMode, setHargaMode] = useState<ModeHargaMarketplace>('AUTO');
  const [tarifMarketplace, setTarifMarketplace] = useState<TarifMarketplace>(TARIF_DEFAULT);

  // Tarif biaya admin dibaca dari Settings (baris `system`). Server tetap
  // menghitung ulang saat menyimpan, jadi angka di sini hanya untuk tampilan.
  useEffect(() => {
    (async () => {
      try {
        const snap = await sbGetDoc('settings', 'system', false);
        const fees = snap.exists() ? (snap.data() as any)?.marketplaceFees : null;
        if (fees) {
          setTarifMarketplace({
            shopee: Number(fees.shopee ?? TARIF_DEFAULT.shopee),
            tiktok: Number(fees.tiktok ?? TARIF_DEFAULT.tiktok),
            tokopedia: Number(fees.tokopedia ?? TARIF_DEFAULT.tokopedia),
            lazada: Number(fees.lazada ?? TARIF_DEFAULT.lazada),
          });
        }
      } catch {
        // Pakai tarif default; server akan memakai angka sebenarnya saat simpan.
      }
    })();
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const { user, userDocData, isAdmin } = await getUserAndRole();
      if (!user) { router.push('/profil/login'); return; }
      if (!isAuthorizedAdmin(user as any, userDocData)) { router.push('/'); return; }
      fetchProducts();
      fetchWarehouses();
    };
    checkAuth();

    let unsubscribe: (() => void) | undefined;
    (async () => {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        // Hanya arahkan jika sesi benar-benar hilang / logout
        if (event === 'SIGNED_OUT' || !session) {
          router.push('/profil/login');
        }
      });
      unsubscribe = () => subscription.unsubscribe();
    })();

    return () => { if (unsubscribe) unsubscribe(); };
  }, [router]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, price, stock, unit, raw_data, image_url, is_active')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      setProducts((data || []).map((d: any) => {
        const raw = d.raw_data || {};
        const thumb = d.image_url || raw.imageUrl || raw.image || raw.Link_Foto || '';
        return {
          id: d.id,
          sku: d.sku || raw.sku || '',
          name: d.name || raw.name || raw.Nama || '',
          price: Number(d.price ?? raw.price ?? raw.Ecer ?? 0),
          stock: Number(d.stock ?? raw.stock ?? raw.Stok ?? 0),
          unit: d.unit || raw.unit || raw.Satuan || 'PCS',
          image: thumb,
          imageUrl: thumb,
          units: raw.units || [],
          channelPricing: raw.channelPricing || {},
          priceShopee: raw.priceShopee || 0,
          priceTiktok: raw.priceTiktok || 0,
          priceEcer: raw.priceEcer || raw.Ecer || d.price || 0,
        } as unknown as Product;
      }));
    } catch (err) {
      Sentry.captureException(err);
      notify.error('Gagal memuat produk');
    }
  };

  const fetchWarehouses = async () => {
    const { data } = await supabase.from('warehouses').select('id, name').order('name');
    if (data) setWarehouses(data as WarehouseOption[]);
  };

  // Lacak perubahan channel agar auto-sync hanya berjalan saat channel marketplace berganti
  const prevChannelRef = useRef<Channel>(channel);

  useEffect(() => {
    if (prevChannelRef.current === channel) return;
    prevChannelRef.current = channel;

    if (cart.length === 0) return;
    setCart(prev => prev.map(item => {
      const p = products.find(prod => prod.id === item.id);
      if (!p) return item;
      const defaultPrice = getProductPriceForUnit(p, channel, item.unit);
      const lastPrice = getMktLastPrice(channel, item.id, item.unit);

      // Jika user sudah pernah custom harga dan ada harga terakhir untuk channel ini, utamakan harga terakhir
      const priceToUse = lastPrice ?? (item.isCustomPrice ? item.price : defaultPrice);

      return {
        ...item,
        price: priceToUse,
        defaultPrice,
        lastInputtedPrice: lastPrice,
        isCustomPrice: Boolean(lastPrice ? lastPrice !== defaultPrice : item.isCustomPrice),
        stock: p.stock || 0
      };
    }));
  }, [channel, products, cart.length]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return [];
    return products.filter(p => 
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (p as any).sku?.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 10);
  }, [products, searchTerm]);

  const handleAddToCart = (p: Product) => {
    const initialUnit = p.unit || 'Pcs';
    const defaultPrice = getProductPriceForUnit(p, channel, initialUnit);
    const lastPrice = getMktLastPrice(channel, p.id, initialUnit);
    // Utamakan harga rekomendasi yang terakhir kali diinput jika tersedia
    const initialPrice = (typeof lastPrice === 'number' && lastPrice > 0) ? lastPrice : (defaultPrice || 0);

    setCart(prev => {
      const existing = prev.find(item => item.id === p.id);
      if (existing) {
        // Increment by 1 of whatever unit the existing item is in
        return prev.map(item => item.id === p.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, {
        id: p.id,
        name: p.name || '',
        price: initialPrice,
        defaultPrice: defaultPrice || 0,
        lastInputtedPrice: lastPrice,
        isCustomPrice: Boolean(lastPrice && lastPrice !== defaultPrice),
        quantity: 1,          // 1 unit of initialUnit
        unit: initialUnit,    // unit the quantity is expressed in
        stock: p.stock || 0,  // total base-unit stock for display
        units: p.units || []
      }];
    });
    setSearchTerm('');
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const setQty = (id: string, qty: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, quantity: Math.max(1, qty) };
      }
      return item;
    }));
  };

  const updatePrice = (id: string, price: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const validPrice = Math.max(0, price);
        saveMktLastPrice(channel, item.id, item.unit, validPrice);
        return {
          ...item,
          price: validPrice,
          isCustomPrice: true,
          lastInputtedPrice: validPrice
        };
      }
      return item;
    }));
  };

  const updateUnit = (id: string, unit: string) => {
    setCart(prev => prev.map(item => {
      if (item.id !== id) return item;
      const p = products.find(prod => prod.id === id);
      if (!p) return { ...item, unit, quantity: 1 };
      const defaultPrice = getProductPriceForUnit(p, channel, unit);
      const lastPrice = getMktLastPrice(channel, id, unit);
      const initialPrice = (typeof lastPrice === 'number' && lastPrice > 0) ? lastPrice : defaultPrice;

      // Reset quantity to 1 when unit changes to avoid confusion
      return {
        ...item,
        unit,
        price: initialPrice,
        defaultPrice,
        lastInputtedPrice: lastPrice,
        isCustomPrice: Boolean(lastPrice && lastPrice !== defaultPrice),
        quantity: 1
      };
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  // quantity is in the selected unit; price is per selected unit → subtotal = price × quantity
  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const total = subtotal + shippingCost;

  // Biaya admin mengikuti mode yang dipilih. Angka final dihitung ulang di
  // server saat menyimpan; ini untuk ditampilkan di ringkasan.
  const biayaAdmin = hitungBiayaAdmin({
    mode: hargaMode,
    jumlahDiisi: subtotal,
    channel,
    tarif: tarifMarketplace,
  });

  const handleSaveOrder = async () => {
    if (cart.length === 0) return notify.error('Keranjang kosong');
    if (!externalOrderId) return notify.error('Order ID Marketplace wajib diisi');
    if (!warehouseId) return notify.error('Pilih gudang pengambilan stok');

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const adminId = user?.id || 'system';
      const now = new Date().toISOString();
      const orderId = millisId('MKT');
      const dbOrderId = timestampId('mkt', 4);

      const CTN_ALIASES = ['CTN', 'KARTON', 'DUS', 'BOX'];

      // ── 1. Hitung baseAmount (dalam satuan dasar / PCS) untuk setiap item ──
      // item.quantity = jumlah dalam unit yang dipilih (PCS atau CTN)
      // item.unit     = satuan yang dipilih user (PCS / CTN / KARTON / BOX)
      // Untuk CTN family: baseAmount = quantity × contains
      // Untuk satuan dasar (PCS / sesuai unit produk): baseAmount = quantity
      const deductPlan: { item: CartItem; baseAmount: number; containsPerUnit: number }[] = [];
      for (const item of cart) {
        const unitCode = item.unit?.toUpperCase() || '';
        const isCtnUnit = CTN_ALIASES.includes(unitCode);

        // Cari definisi unit yang dipilih di daftar units produk
        const unitDef = item.units?.find((u: any) =>
          u.code?.toUpperCase() === unitCode ||
          (isCtnUnit && CTN_ALIASES.includes(u.code?.toUpperCase()))
        );
        const containsPerUnit = isCtnUnit && unitDef ? Number(unitDef.contains || 1) : 1;
        // baseAmount = kuantitas dalam PCS
        const baseAmount = item.quantity * containsPerUnit;
        deductPlan.push({ item, baseAmount, containsPerUnit });
      }

      // Validasi stok semua produk sebelum eksekusi (cek stok real-time di Supabase)
      for (const { item, baseAmount, containsPerUnit } of deductPlan) {
        const { data: prod } = await supabaseAdmin.from('products').select('stock, name').eq('id', item.id).single();
        const available = Number(prod?.stock ?? 0);
        if (available < baseAmount) {
          const unitLabel = containsPerUnit > 1 ? `${item.unit} (= ${containsPerUnit} pcs)` : item.unit;
          notify.error(
            `Stok ${item.name} tidak cukup!\n` +
            `Diminta: ${item.quantity} ${unitLabel} = ${baseAmount} pcs\n` +
            `Tersedia: ${available} pcs`
          );
          setLoading(false);
          return;
        }
      }

      const orderItems = deductPlan.map(({ item, baseAmount, containsPerUnit }) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,         // jumlah dalam unit yang dipilih
        unit: item.unit,
        containsPerUnit,                  // berapa PCS per unit
        baseQuantity: baseAmount,         // total PCS yang dikurangi dari stok
        price: item.price,                // harga per unit yang dipilih
        total: item.price * item.quantity, // total harga
      }));

      const res = await createMarketplaceOrder({
        orderId,
        externalOrderId,
        customerName: customerName || `Customer ${channel}`,
        items: orderItems,
        subtotal,
        shippingCost,
        total,
        channel,
        paymentMethod,
        warehouseId,
        warehouseName: warehouses.find(w => w.id === warehouseId)?.name || warehouseId,
        adminId,
        // Server menghitung ulang biaya admin memakai tarif dari Settings.
        hargaMode,
      });

      if (!res.success) {
        notify.error(`Gagal menyimpan order: ${res.error}`);
        setLoading(false);
        return;
      }

      notify.success(`✅ Order ${channel} berhasil disimpan! Stok terpotong dengan benar.`);
      setCart([]);
      setExternalOrderId('');
      setCustomerName('');
      setShippingCost(0);
      setHargaMode('AUTO');
      fetchProducts(); // Refresh stok di tampilan
    } catch (err) {
      Sentry.captureException(err);
      notify.error('Gagal menyimpan pesanan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 pb-16">
      <Toaster position="top-right" />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => router.back()}
                className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-all"
                title="Kembali"
              >
                <ChevronLeft size={18} />
              </button>
              <div>
                <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <ShoppingBag className="text-orange-500 shrink-0" size={22} />
                  <span>Input Pesanan Marketplace</span>
                </h1>
                <p className="text-xs md:text-sm font-medium text-slate-500 mt-0.5">
                  Catat pesanan manual Shopee atau TikTok dan potong stok gudang otomatis.
                </p>
              </div>
            </div>
          </div>

          <div className="w-full sm:w-auto grid grid-cols-2 sm:flex bg-white p-1 rounded-2xl border border-slate-200/80 shadow-xs">
            <button
              type="button"
              onClick={() => setChannel('SHOPEE')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all ${
                channel === 'SHOPEE'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              Shopee
            </button>
            <button
              type="button"
              onClick={() => setChannel('TIKTOK')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all ${
                channel === 'TIKTOK'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              TikTok Shop
            </button>
          </div>
        </div>

        {/* Grid Utama: Mobile (Form -> Cari -> Keranjang -> Ringkasan), Desktop (Kiri: Form+Keranjang, Kanan: Cari+Ringkasan) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
          {/* 1. Form Info Order */}
          <div className="lg:col-span-8 lg:col-start-1 lg:row-start-1 bg-white p-4 md:p-5 rounded-3xl border border-slate-200/80 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <Hash size={13} className="text-slate-400" />
                <span>Order ID Marketplace *</span>
              </label>
              <input
                type="text"
                value={externalOrderId}
                onChange={e => setExternalOrderId(e.target.value)}
                placeholder="Contoh: 240427SHPXXX"
                className="w-full bg-slate-50 px-3.5 py-2.5 rounded-xl text-xs md:text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none border border-slate-200/80 focus:bg-white focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <User size={13} className="text-slate-400" />
                <span>Nama Pembeli (Opsional)</span>
              </label>
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Nama pelanggan..."
                className="w-full bg-slate-50 px-3.5 py-2.5 rounded-xl text-xs md:text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none border border-slate-200/80 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <Truck size={13} className="text-slate-400" />
                <span>Ongkos Kirim</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                <input
                  type="number"
                  min={0}
                  value={shippingCost}
                  onChange={e => setShippingCost(Number(e.target.value))}
                  className="w-full bg-slate-50 py-2.5 pl-9 pr-3.5 rounded-xl text-xs md:text-sm font-bold tabular-nums text-slate-900 outline-none border border-slate-200/80 focus:bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
                />
              </div>
            </div>
          </div>

          {/* 2. Pencarian Produk */}
          <div className="lg:col-span-4 lg:col-start-9 lg:row-start-1">
            <ProductSearchList
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              products={filteredProducts}
              onAddToCart={handleAddToCart}
              channel={channel}
            />
          </div>

          {/* 3. Daftar Keranjang */}
          <div className="lg:col-span-8 lg:col-start-1 lg:row-start-2">
            <CartTable
              cart={cart}
              onUpdateQty={updateQty}
              onSetQty={setQty}
              onUpdatePrice={updatePrice}
              onUpdateUnit={updateUnit}
              onRemove={removeFromCart}
            />
          </div>

          {/* 4. Ringkasan Biaya & Simpan */}
          <div className="lg:col-span-4 lg:col-start-9 lg:row-start-2 bg-white p-5 md:p-6 rounded-3xl border border-slate-200/80 shadow-sm relative overflow-hidden">
            <div className="absolute -top-2 -right-2 p-6 opacity-[0.03] rotate-12 pointer-events-none">
              <Store size={110} />
            </div>
            <div className="relative z-10 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-slate-500">
                  <span className="text-xs font-semibold">Subtotal Barang</span>
                  <span className="text-xs font-bold tabular-nums text-slate-800">
                    Rp {subtotal.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span className="text-xs font-semibold">Ongkos Kirim</span>
                  <span className="text-xs font-bold tabular-nums text-slate-800">
                    Rp {shippingCost.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {/* Mode harga + biaya admin marketplace */}
              <div className="pt-3.5 border-t border-slate-100 space-y-2.5">
                <p className="text-xs font-bold text-slate-700">
                  Cara Mengisi Harga Jual
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setHargaMode('AUTO')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                      hargaMode === 'AUTO'
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Otomatis
                  </button>
                  <button
                    type="button"
                    onClick={() => setHargaMode('MANUAL')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                      hargaMode === 'MANUAL'
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Manual
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {keteranganMode(hargaMode, biayaAdmin.tarif)}
                </p>

                {hargaMode === 'AUTO' ? (
                  <div className="space-y-1.5 rounded-2xl bg-orange-50/80 border border-orange-100 p-3.5">
                    <div className="flex justify-between text-xs font-semibold text-orange-800">
                      <span>Harga jual (bruto)</span>
                      <span className="tabular-nums">Rp {subtotal.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold text-rose-600">
                      <span>Biaya admin {channel} ({biayaAdmin.tarif}%)</span>
                      <span className="tabular-nums">− Rp {biayaAdmin.biaya.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between text-xs font-extrabold text-emerald-700 pt-1.5 border-t border-orange-200/60">
                      <span>Uang bersih diterima</span>
                      <span className="tabular-nums">Rp {biayaAdmin.bersih.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-3.5 text-xs font-semibold text-emerald-800 leading-relaxed">
                    Uang bersih diterima:{' '}
                    <span className="font-extrabold tabular-nums">Rp {subtotal.toLocaleString('id-ID')}</span> — biaya admin tidak dikurangkan lagi.
                  </div>
                )}
              </div>

              <div className="pt-3.5 border-t border-slate-100 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-700">Total Tagihan</span>
                <span className="text-xl md:text-2xl font-extrabold tabular-nums text-orange-600">
                  Rp {total.toLocaleString('id-ID')}
                </span>
              </div>

              <div className="pt-2 space-y-2.5">
                {/* Pilih Gudang Pengambilan Stok */}
                <div className="flex items-center gap-3 p-3.5 bg-blue-50/70 rounded-2xl border border-blue-200/80">
                  <Warehouse className="text-blue-600 shrink-0" size={18} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-blue-600 mb-0.5">Gudang Pengambilan Stok *</p>
                    <select
                      value={warehouseId}
                      onChange={e => setWarehouseId(e.target.value)}
                      className="bg-transparent text-xs font-bold text-blue-950 outline-none w-full cursor-pointer"
                    >
                      {warehouses.length === 0 && <option value="gudang-utama">Gudang Utama</option>}
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Metode Pembayaran */}
                <div className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <CreditCard className="text-slate-500 shrink-0" size={18} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-slate-500 mb-0.5">Metode Pembayaran</p>
                    <select
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value)}
                      className="bg-transparent text-xs font-bold text-slate-800 outline-none w-full cursor-pointer"
                    >
                      <option value="TRANSFER">Transfer Bank</option>
                      <option value="CASH">Saldo Marketplace</option>
                      <option value="QRIS">QRIS / E-Wallet</option>
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveOrder}
                  disabled={loading || cart.length === 0 || !warehouseId}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-2xl font-bold text-xs md:text-sm shadow-lg shadow-slate-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
                >
                  {loading ? <Activity className="animate-spin" size={16} /> : <Save size={16} />}
                  <span>Simpan Pesanan</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
