'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';

import { useRouter } from 'next/navigation';
import {
  Package, ShoppingCart, Search, Plus, Minus, Printer, Bell,
  MessageSquare, Truck, CheckCircle, Upload, Barcode,
  History, X, Trash2, LayoutGrid, List, AlignJustify, Edit, ShoppingBag, Camera, User,
  Settings, Zap, ScanLine, PauseCircle, PlayCircle, RotateCcw, Layers, CornerDownRight,
  MessageCircle, Monitor, Undo2, AlertTriangle, FileText
} from 'lucide-react';
import imageCompression from 'browser-image-compression'; // TAMBAHAN: Library Kompresi
import toast from 'react-hot-toast';
import CameraBarcodeScannerModal from '@/components/scanner/CameraBarcodeScannerModal';
import { playScanBeep } from '@/lib/sound';
import { simpanTransaksiKasir, processQuickOrderReturn } from '@/lib/actions/cashier.actions';
import { resolveCustomerUnitPrice } from '@/lib/customer-pricing';
import { enqueueOfflineTx, getOfflineQueue, syncOfflineQueue, removeOfflineTx } from '@/lib/offlineQueue';
import type { OfflineTx } from '@/lib/offlineQueue';
import { printToThermal, generateESCReceipt, formatWhatsAppReceipt } from '@/lib/printer';
import AdminChatInterface from '@/components/AdminChatInterface';
import QrisPaymentModal from '@/components/QrisPaymentModal';
import { supabase } from '@/lib/supabase';
import logger from '@/lib/logger';
import { getUserAndRole } from '@/lib/supabase-helpers';

import { uploadToSupabase } from '@/lib/supabase';
import { sbGetDoc, sbInsertDoc, sbUpdateDoc } from '@/lib/supabase-helpers';
import { timestampId, uniqueFileName } from '@/lib/ids';
import { formatProductName } from '@/lib/format';

// Types
type UnitOption = {
  code: string;
  contains?: number;
  price?: number;
  minQty?: number;
};

type ChannelKey = 'offline' | 'website' | 'shopee' | 'tiktok';
type ChannelPricing = Partial<Record<ChannelKey, Record<string, { price?: number }>>>;

type Product = {
  id: string;
  name: string;
  sku?: string;
  brand?: string;
  price: number; // base unit price (ecer)
  cost: number; // base unit cost (modal)
  unit: string; // base unit code
  stock: number;
  barcode?: string;
  image?: string;
  units?: UnitOption[];
  hideBaseUnit?: boolean;
  defaultSellUnit?: string;
  displayUnit?: string;
  displayPrice?: number;
  stockByWarehouse?: Record<string, number>;
  Kategori?: string;
  kategori?: string;
  parentId?: string;
  isParentOnly?: boolean;
  // Customer tier prices
  priceSemiGrosir?: number;
  priceGrosir?: number;
  minGrosir?: number;
  priceTiers?: Array<{ minQty: number; price: number; label?: string }>;
  updatedAt?: string;
  channelPricing?: ChannelPricing | {
    offline?: { price?: number };
    website?: { price?: number };
    shopee?: { price?: number };
    tiktok?: { price?: number };
  };
};

type CartItem = {
  id: string;
  name: string;
  price: number; // price per chosen unit (e.g., per CTN)
  originalPrice: number; // original price before discount/channel pricing
  cost: number; // cost per chosen unit
  quantity: number; // number of chosen units
  unit: string; // unit code (PCS/BOX/CTN)
  contains?: number; // how many pcs per chosen unit
  channel?: ChannelKey; // Add channel to CartItem
  appliedTier?: 'Retail' | 'Semi-Grosir' | 'Grosir' | string; // Customer tier applied
};

type Order = {
  id: string;
  receiptNo?: string;
  dailySeq?: number;
  dueDate?: string | null;
  customerName: string;
  customerPhone: string;
  items: CartItem[];
  total: number;
  paymentMethod: string;
  deliveryMethod: string;
  status: string;
  createdAt?: { seconds: number } | Date;
  subtotal: number;
  shippingCost: number;
  transactionType: string;
  payAmount?: number;
  changeAmount?: number;
  shiftId?: string; // Link to cashier shift
};

type HeldCart = {
  id: string;
  heldAt: number;
  customerName?: string;
  items: CartItem[];
  total: number;
  paymentMethod: string;
  transactionType: 'toko' | 'online' | 'shopee' | 'tiktok';
};

type CashierShift = {
  id: string;
  cashierId: string;
  cashierName: string;
  openedAt: any; // Timestamp
  closedAt: any | null; // Timestamp
  initialCash: number;
  expectedCash: number;
  actualCash: number | null;
  difference: number | null;
  status: 'OPEN' | 'CLOSED';
  totalCashSales: number;
  totalNonCashSales: number;
  notes?: string;
};


export default function CashierPOS() {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // States
  const [loading, setLoading] = useState(true);
  const [isFetchingProducts, setIsFetchingProducts] = useState(false);
  const [activeTab, setActiveTab] = useState<'pos' | 'orders'>('pos');
  // View mode: grid, list, dense (tanpa gambar, muat banyak)
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'dense'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pos-view-mode') as 'grid' | 'list' | 'dense' | null;
      if (saved && ['grid', 'list', 'dense'].includes(saved)) return saved;
      return window.innerWidth < 768 ? 'list' : 'grid';
    }
    return 'grid';
  });
  const handleSetViewMode = (mode: 'grid' | 'list' | 'dense') => {
    setViewMode(mode);
    try {
      localStorage.setItem('pos-view-mode', mode);
    } catch {}
  };
  const [productSort, setProductSort] = useState<'recent_sold' | 'recent_update' | 'name'>('recent_sold');
  const [recentlySoldMap, setRecentlySoldMap] = useState<Map<string, number>>(new Map());
  const [customerPriceTier, setCustomerPriceTier] = useState<'Retail' | 'Semi-Grosir' | 'Grosir'>('Retail');

  // Pengaturan Ukuran Kertas & Struk Kasir
  const [printSettings, setPrintSettings] = useState<{
    paperWidth: '58mm' | '80mm';
    ecoMode: boolean;
    footerPromo: string;
  }>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pos_print_settings');
      if (saved) {
        try { return JSON.parse(saved); } catch {}
      }
    }
    return {
      paperWidth: '58mm',
      ecoMode: false,
      footerPromo: 'Terima kasih telah berbelanja di ATAYATOKO!',
    };
  });

  const updatePrintSettings = (newSettings: Partial<typeof printSettings>) => {
    setPrintSettings(prev => {
      const updated = { ...prev, ...newSettings };
      try { localStorage.setItem('pos_print_settings', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  // State Retur Penjualan Cepat
  const [showReturModal, setShowReturModal] = useState(false);
  const [returSearch, setReturSearch] = useState('');
  const [returLoading, setReturLoading] = useState(false);
  const [returOrder, setReturOrder] = useState<any | null>(null);
  const [returQuantities, setReturQuantities] = useState<Record<string, number>>({});
  const [returReason, setReturReason] = useState('Barang Cacat/Tukar');
  const [returRefundMethod, setReturRefundMethod] = useState<'CASH' | 'DOMPET'>('CASH');
  const [isSubmittingRetur, setIsSubmittingRetur] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [displayLimit, setDisplayLimit] = useState(80);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [variantPickerParent, setVariantPickerParent] = useState<Product | null>(null);
  const [newOrderCount, setNewOrderCount] = useState(0);
  // const [showNotification, setShowNotification] = useState(false);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);

  const [editPriceValue, setEditPriceValue] = useState('');

  // Transaksi States
  const [transactionType, setTransactionType] = useState<'toko' | 'online' | 'shopee' | 'tiktok'>('toko');
  const [deliveryMethod] = useState('Ambil di Toko');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [cashGiven, setCashGiven] = useState('');
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  
  // State Khusus Tempo
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [tempoDueDate, setTempoDueDate] = useState('');
  const [useBluetoothPrinter, setUseBluetoothPrinter] = useState(false);

  // Warehouse Selector State (Supabase)
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('auto');
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);

  // State untuk Wallet & Customer Tier
  const [selectedCustomer, setSelectedCustomer] = useState<{id: string, name: string, walletBalance: number, customerType?: string} | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Array<{id: string, name: string, phone: string, walletBalance?: number, customerType?: string}>>([]);

  // Shift States
  const [currentShift, setCurrentShift] = useState<CashierShift | null>(null);
  const [showShiftModal, setShowShiftModal] = useState<'open' | 'close' | null>(null);
  const [shiftInput, setShiftInput] = useState({ cashierName: '', initialCash: '', actualCash: '', notes: '' });
  const [shiftSummary, setShiftSummary] = useState<{
    totalCash: number;
    totalNonCash: number;
    expected: number;
    totalTransactions: number;
    qrisSales: number;
    transferSales: number;
    tempoSales: number;
    walletSales: number;
    cashTransactions: number;
    nonCashTransactions: number;
  } | null>(null);

  // Filter States
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('SEMUA');
  const [stockFilter, setStockFilter] = useState<'all' | 'instock' | 'outstock'>('all');

  // Counter jumlah produk aktif per kategori untuk tombol kasir
  const productCountPerCategory = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach(p => {
      const c = String(p.Kategori || p.kategori || '').trim().toUpperCase();
      if (c) {
        map.set(c, (map.get(c) || 0) + 1);
      }
    });
    return map;
  }, [products]);

  // Offline queue
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Transaksi Ditahan (Hold & Recall Cart)
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('pos-held-carts');
        return saved ? JSON.parse(saved) : [];
      } catch { return []; }
    }
    return [];
  });
  const [showHeldModal, setShowHeldModal] = useState(false);

  // Cetak Ulang Struk Terakhir (Reprint)
  const [lastPrintedOrder, setLastPrintedOrder] = useState<Partial<Order> | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('pos-last-order');
        return saved ? JSON.parse(saved) : null;
      } catch { return null; }
    }
    return null;
  });

  // QRIS Modal state
  const [showQrisModal, setShowQrisModal] = useState(false);
  const [qrisReferenceNo, setQrisReferenceNo] = useState('');
  const [qrisConfirmed, setQrisConfirmed] = useState(false); // true = BRI SNAP sudah konfirmasi, skip upload bukti
  const qrisConfirmedRef = useRef(false); // ref untuk akses sinkron di handleTransaction
  const handleTransactionRef = useRef<() => void>(() => {});

  // Order history filter
  const [orderDateFilter, setOrderDateFilter] = useState<string>('');

  // Chat State
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);

  // No redundant state for calculated values

  // Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);

  // Settings state
  const [showSettings, setShowSettings] = useState(false);
  // scanMode: 'direct' = langsung masuk keranjang, 'confirm' = tampil toast lalu masuk keranjang
  const [scanMode, setScanMode] = useState<'direct' | 'confirm'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('pos-scan-mode') as 'direct' | 'confirm') || 'direct';
    }
    return 'direct';
  });

  // Lookup varian dan produk
  const { variantsByParentId, productsById } = useMemo(() => {
    const vMap = new Map<string, Product[]>();
    const pMap = new Map<string, Product>();
    products.forEach((p) => {
      pMap.set(p.id, p);
      const pid = p.parentId?.trim();
      if (pid) {
        const arr = vMap.get(pid) || [];
        arr.push(p);
        vMap.set(pid, arr);
      }
    });
    return { variantsByParentId: vMap, productsById: pMap };
  }, [products]);

  const getChannelKey = useCallback((txType: string): ChannelKey => {
    if (txType === 'toko') return 'offline';
    if (txType === 'online') return 'website';
    if (txType === 'shopee') return 'shopee';
    if (txType === 'tiktok') return 'tiktok';
    return 'offline';
  }, []);

  const addToCartWithUnit = useCallback((product: Product, unit: UnitOption) => {
    if (product.isParentOnly) {
      const variants = variantsByParentId.get(product.id) || [];
      if (variants.length > 0) {
        setVariantPickerParent(product);
        return;
      }
      return toast.error('Produk ini adalah Induk Pengelompokan dan tidak bisa di-order.');
    }
    if (product.stock <= 0) return toast.error("Stok habis!");

    const code = (unit.code || product.unit || 'PCS').toUpperCase();
    const contains = Number(unit.contains || (code === 'PCS' ? 1 : 0));
    
    if (contains > product.stock) return toast.error(`Stok tidak cukup untuk satuan ini! Butuh: ${contains}, Sisa: ${product.stock}`);

    const channel = getChannelKey(transactionType);
    
    let unitPrice = Number(unit.price || (contains > 0 ? product.price * contains : product.price));
    const chPrice = (product.channelPricing as ChannelPricing)?.[channel]?.[code]?.price;

    if (typeof chPrice === 'number' && !Number.isNaN(chPrice)) {
      unitPrice = chPrice;
    } else if ((channel === 'shopee' || channel === 'tiktok') && (product.channelPricing as ChannelPricing)?.['website']?.[code]?.price) {
      unitPrice = (product.channelPricing as ChannelPricing)['website']![code].price!;
    }

    // Apply customer tier pricing (Semi-Grosir / Warung / Grosir / Retail)
    const customerType = selectedCustomer?.customerType || customerPriceTier;
    const tierResult = resolveCustomerUnitPrice({
      baseEcer: product.price,
      priceSemiGrosir: product.priceSemiGrosir,
      priceGrosir: product.priceGrosir,
      customerType,
      contains,
      unitPriceOverride: unitPrice,
    });
    const effectiveUnitPrice = tierResult.effectivePrice;

    const unitCost = product.cost * contains;
    const unitOriginalPrice = product.price * contains;

    setCart(prev => {
      const exist = prev.find(i => i.id === product.id && i.unit === code);
      
      const currentTotalQtyBase = prev
        .filter(i => i.id === product.id)
        .reduce((sum, i) => sum + (i.quantity * (i.contains || 1)), 0);
      
      const requestedQtyBase = contains;

      if (currentTotalQtyBase + requestedQtyBase > product.stock) {
        toast.error(`Stok tidak cukup! Total di keranjang: ${currentTotalQtyBase}, Sisa Stok: ${product.stock}`);
        return prev;
      }

      if (exist) return prev.map(i => (i.id === product.id && i.unit === code) ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { 
        id: product.id, 
        name: product.name, 
        price: effectiveUnitPrice, 
        originalPrice: unitOriginalPrice,
        cost: unitCost,
        quantity: 1, 
        unit: code, 
        contains, 
        channel,
        appliedTier: tierResult.appliedTier,
      }];
    });
  }, [transactionType, getChannelKey, selectedCustomer, variantsByParentId]);

  const addToCart = useCallback((product: Product) => {
    // Jika produk ini adalah Induk Pengelompokan atau memiliki varian
    const variants = variantsByParentId.get(product.id) || [];
    if (product.isParentOnly || variants.length > 0) {
      if (variants.length > 0) {
        setVariantPickerParent(product);
        return;
      }
      if (product.isParentOnly) {
        toast.error('Produk ini adalah Induk Pengelompokan dan tidak bisa di-order.');
        return;
      }
    }

    if (product.stock <= 0) return toast.error("Stok habis!");
    
    // Skema 2: Jika produk diset tidak boleh dijual per satuan dasar (PCS di-hide)
    if (product.hideBaseUnit) {
      const targetUnit = (product.units || []).find(u => u.code === product.defaultSellUnit) 
        || (product.units || []).find(u => u.code !== product.unit && Number(u.contains || 0) > 1);
      if (targetUnit) {
        addToCartWithUnit(product, targetUnit);
        return;
      }
    }

    const channel = getChannelKey(transactionType);
    const baseCode = (product.unit || 'PCS').toUpperCase();
    const containsBase = 1;
    
    let priceToUse = product.price;
    const chPrice = (product.channelPricing as ChannelPricing)?.[channel]?.[baseCode]?.price;
    
    if (typeof chPrice === 'number' && !Number.isNaN(chPrice)) {
      priceToUse = chPrice;
    } else if ((channel === 'shopee' || channel === 'tiktok') && (product.channelPricing as ChannelPricing)?.['website']?.[baseCode]?.price) {
       // Fallback logic: Shopee/TikTok -> Website -> Base
       priceToUse = (product.channelPricing as ChannelPricing)['website']![baseCode].price!;
    }

    // Apply customer tier pricing (Semi-Grosir / Warung / Grosir / Retail)
    const customerType = selectedCustomer?.customerType || customerPriceTier;
    const tierResult = resolveCustomerUnitPrice({
      baseEcer: product.price,
      priceSemiGrosir: product.priceSemiGrosir,
      priceGrosir: product.priceGrosir,
      customerType,
      contains: containsBase,
      unitPriceOverride: priceToUse,
    });

    setCart(prev => {
      const exist = prev.find(i => i.id === product.id && i.unit === baseCode);
      
      // Check stock limit
      if (exist) {
        if (exist.quantity + 1 > product.stock) {
          toast.error(`Stok tidak cukup! Sisa: ${product.stock}`);
          return prev;
        }
        const nextQty = exist.quantity + 1;
        let newPrice = exist.price;
        if (product.priceTiers && product.priceTiers.length > 0) {
          const sortedTiers = [...product.priceTiers]
            .filter(t => t.minQty > 1 && t.price > 0)
            .sort((a, b) => b.minQty - a.minQty);
          const reachedTier = sortedTiers.find(t => nextQty >= t.minQty);
          if (reachedTier) {
            newPrice = reachedTier.price;
          } else {
            newPrice = product.price;
          }
        } else if (product.units && product.units.length > 0) {
          const higherUnits = product.units
            .filter(u => u.code !== (product.unit || 'PCS') && Number(u.contains || 0) > 1 && Number(u.price || 0) > 0)
            .sort((a, b) => Number(b.contains) - Number(a.contains));
          const reachedHigher = higherUnits.find(u => nextQty >= Number(u.contains));
          if (reachedHigher) {
            newPrice = Number(reachedHigher.price) / Number(reachedHigher.contains);
          }
        }
        return prev.map(i => i.id === product.id && i.unit === baseCode ? { ...i, quantity: nextQty, price: newPrice } : i);
      }

      return [...prev, { 
        id: product.id, 
        name: product.name, 
        price: tierResult.effectivePrice, 
        originalPrice: product.price,
        cost: product.cost,
        quantity: 1, 
        unit: baseCode, 
        contains: containsBase, 
        channel,
        appliedTier: tierResult.appliedTier,
      }];
    });
  }, [transactionType, getChannelKey, addToCartWithUnit, selectedCustomer, variantsByParentId]);

  const handleScan = useCallback(async (code: string) => {
    try {
      if (!code) return;
      const cleanCode = code.trim();

      // 1. Cari dulu dari state lokal produk yang sudah dimuat
      let matchedProd = products.find(p =>
        p.barcode === cleanCode ||
        (p.units && p.units.some((u: any) => u.barcode === cleanCode))
      );

      // 2. Jika tidak ditemukan di memori, query langsung ke Supabase
      if (!matchedProd) {
        let supaProds: any[] | null = null;
        const { data: directProds, error } = await supabase
          .from('products')
          .select('id, name, price, stock, raw_data, unit, cost_price, barcode, image_url, is_active')
          .or(`barcode.eq.${cleanCode},raw_data->>Barcode.eq.${cleanCode}`)
          .limit(1);

        if (!error && directProds && directProds.length > 0) {
          supaProds = directProds;
        } else {
          // Cari barcode kemasan/satuan bertingkat (RTG/CTN) di raw_data->units
          const { data: unitProds } = await supabase
            .from('products')
            .select('id, name, price, stock, raw_data, unit, cost_price, barcode, image_url, is_active')
            .filter('raw_data->units', 'cs', JSON.stringify([{ barcode: cleanCode }]))
            .limit(1);
          if (unitProds && unitProds.length > 0) {
            supaProds = unitProds;
          }
        }

        if (!error && supaProds && supaProds.length > 0) {
          const d = supaProds[0];
          const raw = d.raw_data || {};
          const isArchived =
            d.is_active === false ||
            raw.isActive === false ||
            raw.isActive === 'false' ||
            raw.status === 'ARCHIVED';

          if (isArchived) {
            toast.error('Produk ini telah diarsipkan dan tidak aktif');
            return;
          }

          const baseUnit = String(d.unit || raw.unit || raw.Satuan || 'PCS').toUpperCase();
          const basePrice = Number(d.price ?? raw.price ?? raw.priceEcer ?? raw.Ecer ?? 0);
          const baseCost = Number(d.cost_price ?? raw.cost ?? raw.Modal ?? raw.purchasePrice ?? 0);

          matchedProd = {
            id: d.id,
            name: d.name || raw.name || raw.Nama || 'Produk',
            price: basePrice,
            cost: baseCost,
            unit: baseUnit,
            stock: Number(d.stock ?? raw.stock ?? 0),
            barcode: d.barcode || raw.barcode || raw.Barcode || '',
            image: (() => {
              const url = d.image_url || raw.image || raw.imageUrl || raw.URL_Produk || raw.Link_Foto || raw.photo || '';
              return url.trim().startsWith('http') ? url.trim() : '';
            })(),
            units: raw.units || [],
            channelPricing: raw.channelPricing || {},
            Kategori: raw.Kategori || raw.kategori || 'UMUM',
            kategori: raw.Kategori || raw.kategori || 'UMUM',
            stockByWarehouse: raw.stockByWarehouse || {},
            parentId: (raw.Parent_ID || raw.parentId || raw.parent_id || '').toString().trim() || undefined,
            isParentOnly: Boolean(raw.isParentOnly || raw.is_parent_only),
          };
        }
      }

      if (!matchedProd) {
        toast.error('Barcode tidak ditemukan');
        return;
      }

      playScanBeep();
      setShowScanner(false);

      if (scanMode === 'direct') {
        // Mode langsung: tambah ke keranjang tanpa jeda
        const unitMatch = matchedProd.units?.find((u: any) => u.barcode === cleanCode);
        if (unitMatch) {
          addToCartWithUnit(matchedProd, unitMatch);
        } else {
          addToCart(matchedProd);
        }
        toast.success(`✅ ${matchedProd.name} ditambahkan`);
      } else {
        // Mode konfirmasi: lewat state intermediate (toast dulu baru masuk keranjang)
        setScannedProduct(matchedProd);
        toast.success(`Produk ditemukan: ${matchedProd.name}`);
      }
    } catch (err) {
      console.error('Scan error:', err);
      toast.error('Gagal membaca barcode');
    }
  }, [products, scanMode, addToCart, addToCartWithUnit]);

  // NOTE: Auth & shift loading is handled by the main useEffect below.
  // Removed duplicate auth listener that caused race conditions.


  // --- TAMBAHAN: LOGIKA KOMPRESI PHOTO ---
  const compressImage = useCallback(async (file: File) => {
    const options = {
      maxSizeMB: 0.2, // Maks 200KB agar database tidak bengkak
      maxWidthOrHeight: 1024,
      useWebWorker: true,
      fileType: 'image/jpeg'
    };
    try {
      return await imageCompression(file, options);
    } catch (error) {
      console.error("Compression error:", error);
      return file;
    }
  }, []);



  // Tambahkan item hasil scan ke keranjang setelah addToCart tersedia
  useEffect(() => {
    if (scannedProduct) {
      addToCart(scannedProduct);
      setScannedProduct(null);
    }
  }, [scannedProduct, addToCart]);

  const updateQuantity = useCallback((id: string, q: number) => {
    if (q <= 0) {
      setCart(prev => prev.filter(i => i.id !== id));
      return;
    }

    setCart(prev => {
      const item = prev.find(i => i.id === id);
      if (!item) return prev;
      
      // Find the product to check stock
      const product = products.find(p => p.id === item.id);
      if (!product) return prev; // Should not happen

      // Calculate total quantity for this product in cart EXCLUDING the current item we are updating
      const otherItemsQtyBase = prev
        .filter(i => i.id === item.id && i !== item) // Filter other units of same product
        .reduce((sum, i) => sum + (i.quantity * (i.contains || 1)), 0);
      
      const newQtyBase = q * (item.contains || 1);

      if (otherItemsQtyBase + newQtyBase > product.stock) {
        toast.error(`Stok tidak cukup! Maksimum tersedia: ${Math.floor((product.stock - otherItemsQtyBase) / (item.contains || 1))}`);
        return prev; // Do not update
      }

      // Cek apakah item ini adalah satuan dasar (PCS) dan kuantiti menembus tier grosir atau satuan di atasnya
      const isBaseUnit = (item.contains || 1) === 1;
      let effectivePrice = item.price;

      let appliedTier: string = item.appliedTier || 'Retail';
      if (isBaseUnit) {
        const effectiveCustomerType = selectedCustomer?.customerType || customerPriceTier;
        if (effectiveCustomerType === 'Semi-Grosir' && product.priceSemiGrosir && product.priceSemiGrosir > 0) {
          effectivePrice = product.priceSemiGrosir;
          appliedTier = 'Semi-Grosir';
        } else if (effectiveCustomerType === 'Grosir' && product.priceGrosir && product.priceGrosir > 0) {
          effectivePrice = product.priceGrosir;
          appliedTier = 'Grosir';
        } else if (product.priceTiers && product.priceTiers.length > 0) {
          const sortedTiers = [...product.priceTiers]
            .filter(t => t.minQty > 1 && t.price > 0)
            .sort((a, b) => b.minQty - a.minQty);
          const reachedTier = sortedTiers.find(t => q >= t.minQty);
          if (reachedTier) {
            effectivePrice = reachedTier.price;
            appliedTier = reachedTier.label || 'Grosir';
          } else {
            // Cek threshold Semi-Grosir (Warung)
            const minG = product.minGrosir || 3;
            if (q >= minG && product.priceSemiGrosir && product.priceSemiGrosir > 0) {
              effectivePrice = product.priceSemiGrosir;
              appliedTier = 'Semi-Grosir';
            } else {
              effectivePrice = product.price;
              appliedTier = 'Retail';
            }
          }
        } else if (product.priceSemiGrosir && product.priceSemiGrosir > 0 && q >= (product.minGrosir || 3)) {
          // Otomatis terapkan harga Semi-Grosir (Warung) jika qty >= minGrosir (default 3)
          effectivePrice = product.priceSemiGrosir;
          appliedTier = 'Semi-Grosir';
        } else if (product.units && product.units.length > 0) {
          const higherUnits = product.units
            .filter(u => u.code !== (product.unit || 'PCS') && Number(u.contains || 0) > 1 && Number(u.price || 0) > 0)
            .sort((a, b) => Number(b.contains) - Number(a.contains));
          
          const reachedHigher = higherUnits.find(u => q >= Number(u.contains));
          if (reachedHigher) {
            effectivePrice = Number(reachedHigher.price) / Number(reachedHigher.contains);
            appliedTier = 'Grosir';
          } else {
            const tierResult = resolveCustomerUnitPrice({
              baseEcer: product.price,
              priceSemiGrosir: product.priceSemiGrosir,
              priceGrosir: product.priceGrosir,
              customerType: effectiveCustomerType,
              contains: 1,
            });
            effectivePrice = tierResult.effectivePrice;
            appliedTier = tierResult.appliedTier;
          }
        } else {
          const tierResult = resolveCustomerUnitPrice({
            baseEcer: product.price,
            priceSemiGrosir: product.priceSemiGrosir,
            priceGrosir: product.priceGrosir,
            customerType: effectiveCustomerType,
            contains: 1,
          });
          effectivePrice = tierResult.effectivePrice;
          appliedTier = tierResult.appliedTier;
        }
      }

      return prev.map(i => i.id === id ? { ...i, quantity: q, price: effectivePrice, appliedTier } : i);
    });
  }, [products, selectedCustomer, customerPriceTier]);

  const updatePrice = useCallback((id: string, newTotal: number, quantity: number) => {
    const item = cart.find(i => i.id === id);
    if (item && item.cost > 0) {
      const unitPrice = quantity > 0 ? newTotal / quantity : 0;
      if (unitPrice < item.cost) {
        const rugi = (item.cost - unitPrice) * quantity;
        const confirmBoncos = window.confirm(
          `⚠️ PERINGATAN ANTI-BONCOS!

Harga jual yang dimasukkan (Rp${unitPrice.toLocaleString('id-ID')}) berada DI BAWAH MODAL HPP (Rp${item.cost.toLocaleString('id-ID')}).
Estimasi kerugian: Rp${rugi.toLocaleString('id-ID')}.

Tetap lanjutkan menyimpan harga ini?`
        );
        if (!confirmBoncos) {
          setEditingPriceId(null);
          return;
        }
      }
    }
    setCart(prev => prev.map(i => i.id === id ? { ...i, price: newTotal / quantity } : i));
    setEditingPriceId(null);
  }, [cart]);


  // Handler Pencarian Order untuk Retur
  const handleSearchReturOrder = async () => {
    if (!returSearch.trim()) return toast.error('Ketik no struk atau ID transaksi');
    setReturLoading(true);
    setReturOrder(null);
    setReturQuantities({});
    try {
      const term = returSearch.trim();
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .or(`id.eq.${term},order_id.eq.${term},raw_data->>receiptNo.eq.${term}`)
        .limit(1);

      if (error || !data || data.length === 0) {
        toast.error(`Pesanan "${term}" tidak ditemukan.`);
        return;
      }
      const ord = data[0];
      setReturOrder(ord);
      const initialQty: Record<string, number> = {};
      const items = Array.isArray(ord.items) ? ord.items : (ord.raw_data?.items || []);
      items.forEach((it: any) => {
        initialQty[it.id] = 0;
      });
      setReturQuantities(initialQty);
      toast.success(`Ditemukan transaksi #${ord.raw_data?.receiptNo || ord.id.slice(-6)}`);
    } catch (err: any) {
      toast.error('Gagal mencari transaksi: ' + err.message);
    } finally {
      setReturLoading(false);
    }
  };

  const handleExecuteRetur = async () => {
    if (!returOrder) return;
    const items = Array.isArray(returOrder.items) ? returOrder.items : (returOrder.raw_data?.items || []);
    const itemsToReturn = items
      .filter((it: any) => Number(returQuantities[it.id] || 0) > 0)
      .map((it: any) => ({
        productId: it.id,
        quantity: Number(returQuantities[it.id]),
        unit: it.unit || 'PCS',
        contains: Number(it.contains || 1),
        price: Number(it.price || 0),
        reason: returReason,
      }));

    if (itemsToReturn.length === 0) {
      return toast.error('Pilih minimal 1 item dengan jumlah > 0 untuk diretur');
    }

    const totalRefund = itemsToReturn.reduce((sum: number, it: any) => sum + (it.price * it.quantity), 0);

    if (!window.confirm(`Proses retur senilai Rp${totalRefund.toLocaleString('id-ID')} via ${returRefundMethod}? Stok akan otomatis dikembalikan ke inventori.`)) {
      return;
    }

    setIsSubmittingRetur(true);
    try {
      const res = await processQuickOrderReturn({
        receiptNoOrId: returOrder.raw_data?.receiptNo || returOrder.id,
        items: itemsToReturn,
        refundAmount: totalRefund,
        refundMethod: returRefundMethod,
        reason: returReason,
      });

      if (!res.success) {
        toast.error(res.error || 'Gagal memproses retur');
        return;
      }

      toast.success(`Retur berhasil! Nomor Nota: ${res.data?.receiptNo}`);
      setShowReturModal(false);
      setReturOrder(null);
      setReturSearch('');
    } catch (e: any) {
      toast.error('Error proses retur: ' + e.message);
    } finally {
      setIsSubmittingRetur(false);
    }
  };

  // Handler Kirim Struk via WhatsApp
  const handleSendWhatsApp = useCallback((orderToSend: any) => {
    let phone = orderToSend.customerPhone || '';
    if (!phone) {
      const input = window.prompt('Masukkan nomor WhatsApp pelanggan (contoh: 08123456789):');
      if (!input) return;
      phone = input.trim();
    }
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) clean = '62' + clean.slice(1);
    if (!clean.startsWith('62')) clean = '62' + clean;
    
    const text = formatWhatsAppReceipt(orderToSend, {
      paperWidth: printSettings.paperWidth,
      footerPromo: printSettings.footerPromo,
    });
    window.open(`https://wa.me/${clean}?text=${encodeURIComponent(text)}`, '_blank');
  }, [printSettings]);

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + (item.price * item.quantity), 0), [cart]);

  // Broadcast realtime ke Customer Facing Display (/cashier/display)
  useEffect(() => {
    try {
      const payload = {
        cart: cart.map(i => ({
          id: i.id,
          name: i.name,
          price: i.price,
          originalPrice: i.originalPrice,
          quantity: i.quantity,
          unit: i.unit,
          contains: i.contains,
          appliedTier: i.appliedTier,
        })),
        subtotal,
        total: subtotal + (paymentMethod === 'Kurir Toko' ? 15000 : 0),
        cartSavings: cart.reduce((sum, item) => {
          const orig = Number(item.originalPrice || item.price || 0);
          const cur = Number(item.price || 0);
          return sum + (orig > cur ? (orig - cur) * item.quantity : 0);
        }, 0),
        paymentMethod,
        status: cart.length > 0 ? (isProcessing ? 'paying' : 'scanning') : 'idle',
        customerName: selectedCustomer?.name || (paymentMethod === 'TEMPO' ? customerName : undefined),
        qrisCode: qrisReferenceNo,
      };
      localStorage.setItem('pos_customer_display_data', JSON.stringify(payload));
      const ch = new BroadcastChannel('pos_customer_display');
      ch.postMessage(payload);
      ch.close();
    } catch {}
  }, [cart, subtotal, paymentMethod, isProcessing, selectedCustomer, customerName, qrisReferenceNo]);

  const cartSavings = useMemo(() => {
    return cart.reduce((sum, item) => {
      const origPrice = Number(item.originalPrice || item.price || 0);
      const currPrice = Number(item.price || 0);
      return sum + (origPrice > currPrice ? (origPrice - currPrice) * item.quantity : 0);
    }, 0);
  }, [cart]);

  const shippingCost = useMemo(() => {
    const rates: Record<string, number> = { 'Ambil di Toko': 0, 'Kurir Toko': 15000, 'OJOL': 0 };
    return rates[deliveryMethod] || 0;
  }, [deliveryMethod]);

  const total = useMemo(() => subtotal + shippingCost, [subtotal, shippingCost]);

  const change = useMemo(() => {
    if (paymentMethod === 'CASH') {
      return (parseFloat(cashGiven) || 0) - total;
    }
    return 0;
  }, [cashGiven, total, paymentMethod]);

  // Search Customer for Wallet - query customers table (raw_data JSONB)
  useEffect(() => {
    if (customerSearch.length < 3) {
      setCustomerResults([]);
      return;
    }
    const performSearch = async () => {
      try {
        const term = customerSearch.toLowerCase();
        // customers table stores name/phone inside raw_data JSONB
        const { data: rows } = await supabase
          .from('customers')
          .select('id, raw_data')
          .or(`raw_data->>name.ilike.%${term}%,raw_data->>phone.ilike.%${term}%`)
          .limit(10);

        const results = (rows || []).map((c: any) => {
          const raw = c.raw_data || {};
          return {
            id: c.id,
            name: raw.name || 'Tanpa Nama',
            phone: raw.phone || '',
            walletBalance: Number(raw.walletBalance || raw.wallet_balance || 0),
            customerType: raw.customerType || raw.type || raw.tipe || 'Retail',
          };
        });
        setCustomerResults(results);
      } catch (err) {
        console.error('Customer search error:', err);
        setCustomerResults([]);
      }
    };
    const debounce = setTimeout(performSearch, 300);
    return () => clearTimeout(debounce);
  }, [customerSearch]);

  useEffect(() => {
    // Detect Offline Status
    const handleOnline = async () => {
      setIsOffline(false);
      // Auto-sync offline queue when back online
      try {
        const q = await getOfflineQueue();
        if (q.length > 0) {
          setIsSyncing(true);
          toast('🔄 Koneksi pulih — menyinkronkan ' + q.length + ' transaksi offline...', { duration: 4000 });
          const { synced, failed } = await syncOfflineQueue(simpanTransaksiKasir);
          setOfflineQueueCount(failed);
          if (synced > 0) toast.success(`✅ ${synced} transaksi offline berhasil disinkronkan!`);
          if (failed > 0) toast.error(`❌ ${failed} transaksi gagal disinkronkan. Cek riwayat.`);
          setIsSyncing(false);
        }
      } catch { setIsSyncing(false); }
    };
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Initial check
    setIsOffline(!navigator.onLine);
    // Load offline queue count
    getOfflineQueue().then(q => setOfflineQueueCount(q.length)).catch(() => {});

    const savedCart = localStorage.getItem('pos-cart');
    if (savedCart) setCart(JSON.parse(savedCart));

    const checkAuthAndShift = async () => {
      // Cek Supabase session (sumber utama auth)
      const { data: { user: supaUser } } = await supabase.auth.getUser();
      if (supaUser) {
        const rememberedName = typeof window !== 'undefined' ? localStorage.getItem('pos_cashier_name') : null;
        const autoName = rememberedName || supaUser.user_metadata?.full_name || supaUser.user_metadata?.name || supaUser.email?.split('@')[0] || '';
        if (autoName) {
          setShiftInput(prev => ({ ...prev, cashierName: prev.cashierName || autoName }));
        }
      }
      if (!supaUser) {
        router.push('/profil/login');
        return;
      }

      if (navigator.onLine) {
        try {
          // Peran dibaca dari `public.users.role` lewat getUserAndRole().
          // Metadata pengguna dan awalan email TIDAK lagi dipakai: metadata bisa
          // ditulis sendiri oleh pengguna, dan versi lama blok ini menolak admin
          // asli karena perannya hanya tersimpan di `users.role` — akibatnya
          // superadmin pun tidak bisa masuk ke halaman kasir.
          const { isStaff: bolehMasukKasir } = await getUserAndRole();
          if (!bolehMasukKasir) {
            router.push('/profil');
            return;
          }

          // --- SHIFT CACHE: Cek sessionStorage dulu untuk menghindari modal berulang ---
          const cachedShiftRaw = sessionStorage.getItem('pos-current-shift');
          if (cachedShiftRaw) {
            try {
              const cachedShift = JSON.parse(cachedShiftRaw) as CashierShift;
              // Pastikan cache milik user yang sama
              if (cachedShift.cashierId === supaUser.id) {
                setCurrentShift(cachedShift);
                setLoading(false);
                // Background verification: pastikan shift masih OPEN di DB
                supabase
                  .from('cashier_shifts')
                  .select('id, status')
                  .eq('id', cachedShift.id)
                  .maybeSingle()
                  .then(({ data }) => {
                    if (!data || data.status !== 'OPEN') {
                      // Shift sudah ditutup dari tempat lain, hapus cache
                      sessionStorage.removeItem('pos-current-shift');
                      setCurrentShift(null);
                      setShowShiftModal('open');
                    }
                  });
                return;
              }
            } catch {
              sessionStorage.removeItem('pos-current-shift');
            }
          }

          // Tidak ada cache valid – query Supabase
          const { data: openShift } = await supabase
            .from('cashier_shifts')
            .select('*')
            .eq('cashier_id', supaUser.id)
            .eq('status', 'OPEN')
            .limit(1)
            .maybeSingle();

          if (openShift) {
            const shift = { id: openShift.id, ...openShift } as CashierShift;
            setCurrentShift(shift);
            // Simpan ke cache untuk navigasi berikutnya
            sessionStorage.setItem('pos-current-shift', JSON.stringify(shift));
          } else {
            setShowShiftModal('open');
          }
        } catch (e) {
          logger.warn("Error fetching user role", e);
        }
      }

      setLoading(false);
    };

    checkAuthAndShift();

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push('/profil/login');
      }
    });

    return () => {
      authSub.unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [router]);

  useEffect(() => {
    localStorage.setItem('pos-cart', JSON.stringify(cart));
  }, [cart]);

  const printReceiptRef = useRef<((order: Partial<Order>) => Promise<void>) | null>(null);

  // Fitur Tahan Transaksi (Hold Cart) [F4]
  const handleHoldCart = useCallback(() => {
    if (cart.length === 0) {
      toast.error('Keranjang masih kosong, tidak ada transaksi untuk ditahan.');
      return;
    }
    const newHold: HeldCart = {
      id: `hold_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      heldAt: Date.now(),
      customerName: customerName.trim() || undefined,
      items: [...cart],
      total,
      paymentMethod,
      transactionType,
    };
    const updated = [newHold, ...heldCarts];
    setHeldCarts(updated);
    try {
      localStorage.setItem('pos-held-carts', JSON.stringify(updated));
    } catch {}
    setCart([]);
    try {
      localStorage.removeItem('pos-cart');
    } catch {}
    setCustomerName('');
    setCustomerPhone('');
    setCashGiven('');
    toast.success(`Transaksi #${updated.length} ditahan. Siap melayani pembeli berikutnya.`, { icon: '⏸️' });
  }, [cart, customerName, total, paymentMethod, transactionType, heldCarts]);

  // Recall Transaksi Ditahan
  const handleRecallCart = useCallback((hold: HeldCart) => {
    if (cart.length > 0) {
      const confirmReplace = window.confirm('Keranjang saat ini berisi item. Ganti dengan transaksi yang ditahan ini?');
      if (!confirmReplace) return;
    }
    setCart(hold.items);
    setPaymentMethod(hold.paymentMethod);
    setTransactionType(hold.transactionType);
    if (hold.customerName) setCustomerName(hold.customerName);
    const updated = heldCarts.filter(h => h.id !== hold.id);
    setHeldCarts(updated);
    try {
      localStorage.setItem('pos-held-carts', JSON.stringify(updated));
    } catch {}
    setShowHeldModal(false);
    toast.success('Transaksi yang ditahan berhasil dipanggil kembali ke keranjang.', { icon: '▶️' });
  }, [cart, heldCarts]);

  // Hapus Transaksi Ditahan
  const handleDeleteHeldCart = useCallback((id: string) => {
    const updated = heldCarts.filter(h => h.id !== id);
    setHeldCarts(updated);
    try {
      localStorage.setItem('pos-held-carts', JSON.stringify(updated));
    } catch {}
    toast.success('Transaksi tertahan dihapus.');
  }, [heldCarts]);

  // Cetak Ulang Struk Terakhir [F12]
  const handleReprintLastReceipt = useCallback(() => {
    if (!lastPrintedOrder) {
      toast.error('Belum ada transaksi sebelumnya untuk dicetak ulang.');
      return;
    }
    printReceiptRef.current?.(lastPrintedOrder);
    toast.success(`Mencetak ulang struk #${lastPrintedOrder.id || 'terakhir'}...`);
  }, [lastPrintedOrder]);

  // Keyboard Shortcuts Lengkap (F1, F2, F3, F4, F8, F12, ESC)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName);

      if (e.key === 'F1') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F2') {
        e.preventDefault();
        handleTransactionRef.current?.();
      } else if (e.key === 'F3') {
        e.preventDefault();
        if (total > 0) {
          setCashGiven(String(total));
          toast.success(`Uang Pas: Rp${total.toLocaleString('id-ID')}`, { id: 'quick-cash' });
        }
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleHoldCart();
      } else if (e.key === 'F8') {
        e.preventDefault();
        const methods = ['CASH', 'QRIS', 'TRANSFER', 'TEMPO', 'DOMPET'];
        setPaymentMethod(prev => {
          const nextIdx = (methods.indexOf(prev) + 1) % methods.length;
          const nextMethod = methods[nextIdx];
          toast(`Metode Bayar: ${nextMethod}`, { icon: '💳', id: 'pay-method' });
          return nextMethod;
        });
      } else if (e.key === 'F12') {
        e.preventDefault();
        handleReprintLastReceipt();
      } else if (e.key === 'Escape' && !isInput) {
        if (cart.length > 0) {
          if (window.confirm('Kosongkan keranjang belanja kasir?')) {
            setCart([]);
            try { localStorage.removeItem('pos-cart'); } catch {}
            toast('Keranjang dikosongkan', { icon: '🗑️' });
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [total, handleHoldCart, handleReprintLastReceipt, cart]);

  // === GLOBAL BARCODE SCANNER LISTENER ===
  const [barcodeBuffer, setBarcodeBuffer] = useState('');

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.key !== 'Enter') {
        if (e.key.length === 1) {
          setBarcodeBuffer((prev) => prev + e.key);
        }
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          setBarcodeBuffer('');
        }, 50); 
      } else {
        if (barcodeBuffer) {
          e.preventDefault();
          
          const scannedProduct = products.find(p => 
            p.barcode === barcodeBuffer || 
            (p.units && p.units.some((u: any) => u.barcode === barcodeBuffer))
          );

          if (scannedProduct) {
            playScanBeep();
            const unitMatch = scannedProduct.units?.find((u: any) => u.barcode === barcodeBuffer);
            if (unitMatch) {
              addToCartWithUnit(scannedProduct, unitMatch);
              toast.success(`Scan berhasil: ${scannedProduct.name} (${unitMatch.code})`);
            } else {
              addToCart(scannedProduct);
              toast.success(`Scan berhasil: ${scannedProduct.name}`);
            }
          } else {
            toast.error(`Barcode ${barcodeBuffer} tidak ditemukan!`);
          }

          setBarcodeBuffer('');
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      clearTimeout(timeout);
    };
  }, [barcodeBuffer, products, addToCart, addToCartWithUnit]);
  // ========================================

  useEffect(() => {
    if (loading) return;

    const fetchProducts = async () => {
      setIsFetchingProducts(true);
      try {
        const { count, error: countErr } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true });

        if (countErr) {
          console.error('Error counting products:', countErr);
        }

        const pageSize = 1000;
        const totalPages = Math.max(1, Math.ceil((count || 0) / pageSize));

        const promises = [];
        for (let i = 0; i < totalPages; i++) {
          const from = i * pageSize;
          const to = from + pageSize - 1;
          promises.push(
            supabase
              .from('products')
              .select('id, name, price, stock, raw_data, unit, cost_price, barcode, image_url, is_active, sku, updated_at')
              .order('updated_at', { ascending: false })
              .range(from, to)
              .then(res => res.data || [])
          );
        }

        const pagesData = await Promise.all(promises);
        const rows = pagesData.flat();

        const p: Product[] = [];
        for (const d of rows) {
          const raw = d.raw_data || {};
          // Only exclude products explicitly marked inactive via is_active column (source of truth).
          // raw.Status === 1 was a legacy "archived" flag but is NOT reliable — omit it.
          const isArchived =
            d.is_active === false ||
            raw.isActive === false ||
            raw.isActive === 'false' ||
            raw.status === 'ARCHIVED';

          if (isArchived) continue;

          const baseUnit = String(d.unit || raw.unit || raw.Satuan || 'PCS').toUpperCase();
          const basePrice = Number(d.price ?? raw.price ?? raw.priceEcer ?? raw.Ecer ?? 0);
          const baseCost = Number(d.cost_price ?? raw.cost ?? raw.Modal ?? raw.purchasePrice ?? 0);
          const rawUnits = Array.isArray(raw.units) ? (raw.units as Array<Record<string, unknown>>) : [];
          const units: UnitOption[] = rawUnits
            .map(u => {
              const ru = u as Record<string, unknown>;
              const code = String(ru.code || '').toUpperCase();
              if (!code) return null;
              const contains = typeof ru.contains === 'number' ? ru.contains : Number(ru.contains || 0);
              const price = typeof ru.price === 'number' ? ru.price : Number(ru.price || 0);
              const rawMin = ru.minQty;
              const minQty = typeof rawMin === 'number' ? rawMin : (rawMin !== undefined ? Number(rawMin) : undefined);
              return { code, contains, price, minQty, barcode: ru.barcode ? String(ru.barcode) : undefined } as UnitOption;
            })
            .filter((u): u is UnitOption => !!u && typeof u.code === 'string' && u.code.length > 0);
          if (!units.find(u => u.code === baseUnit)) units.unshift({ code: baseUnit, contains: 1, price: basePrice });

          const hideBaseUnit = Boolean((d as any).hideBaseUnit ?? raw.hideBaseUnit ?? raw.hide_base_unit);
          const defaultSellUnit = String((d as any).defaultSellUnit ?? raw.defaultSellUnit ?? raw.default_sell_unit ?? '').toUpperCase();
          const targetUnit = (hideBaseUnit && (units.find(u => u.code === defaultSellUnit) || units.find(u => u.code !== baseUnit && Number(u.contains || 0) > 1))) || null;
          const displayUnit = targetUnit ? targetUnit.code : baseUnit;
          const displayPrice = targetUnit ? Number(targetUnit.price || (basePrice * Number(targetUnit.contains || 1))) : basePrice;

          p.push({
            id: d.id,
            name: d.name || raw.name || raw.Nama || 'TANPA NAMA',
            sku: d.sku || raw.sku || raw.ID || d.id,
            brand: raw.brand || raw.Brand || '',
            price: basePrice,
            cost: baseCost,
            unit: baseUnit,
            displayUnit,
            displayPrice,
            hideBaseUnit,
            defaultSellUnit,
            stock: Number(d.stock ?? raw.stock ?? raw.Stok ?? 0),
            barcode: d.barcode || raw.barcode || raw.Barcode || '',
            image: (() => {
              const url = d.image_url || raw.image || raw.imageUrl || raw.URL_Produk || raw.Link_Foto || raw.photo || '';
              return url.trim().startsWith('http') ? url.trim() : '';
            })(),
            units,
            stockByWarehouse: raw.stockByWarehouse || {},
            channelPricing: raw.channelPricing,
            priceSemiGrosir: Number(raw.priceSemiGrosir ?? raw.wholesaleSemiPrice ?? raw.Harga_Semi_Grosir ?? 0) || undefined,
            priceGrosir: Number(raw.priceGrosir ?? raw.grosirPrice ?? raw.Harga_Grosir ?? 0) || undefined,
            minGrosir: Number(raw.minGrosir ?? raw.Min_Grosir ?? 3) || 3,
            priceTiers: Array.isArray(raw.priceTiers) ? raw.priceTiers : undefined,
            parentId: (raw.Parent_ID || raw.parentId || raw.parent_id || '').toString().trim() || undefined,
            isParentOnly: Boolean(raw.isParentOnly || raw.is_parent_only),
            updatedAt: d.updated_at || raw.updated_at || raw.updatedAt || '',
            Kategori: String(raw.Kategori || raw.kategori || raw.category || 'UMUM').toUpperCase(),
            kategori: String(raw.Kategori || raw.kategori || raw.category || 'UMUM').toUpperCase(),
          });
        }

        // Fetch recent sold data for "baru laku" sort
        const soldMap = new Map<string, number>();
        try {
          const { data: recentOrdersData } = await supabase
            .from('orders')
            .select('items, created_at')
            .order('created_at', { ascending: false })
            .limit(100);

          let rank = 0;
          (recentOrdersData || []).forEach((o: any) => {
            const items = Array.isArray(o.items) ? o.items : [];
            items.forEach((item: any) => {
              if (item.id && !soldMap.has(item.id)) {
                soldMap.set(item.id, rank++);
              }
            });
          });
          setRecentlySoldMap(soldMap);
        } catch (soldErr) {
          console.warn('Could not fetch recent orders for sold ranking:', soldErr);
        }

        // Sort default: Baru Laku -> Baru Update
        p.sort((a, b) => {
          const aRec = soldMap.get(a.id) ?? 999999;
          const bRec = soldMap.get(b.id) ?? 999999;
          if (aRec !== bRec) return aRec - bRec;
          return (b.updatedAt || '').localeCompare(a.updatedAt || '');
        });

        setProducts(p);
        setFilteredProducts(p);

        // Cache katalog produk ke localStorage agar saat offline / refresh kasir tetap punya data
        try {
          localStorage.setItem('pos-cached-products', JSON.stringify(p));
        } catch (storageErr) {
          console.warn('Quota exceeded caching pos-products:', storageErr);
        }

        // Hanya ekstrak kategori dari produk berstatus AKTIF yang tersedia di kasir
        const activeProductCats = Array.from(
          new Set(
            p
              .map(prod => String(prod.Kategori || prod.kategori || '').trim().toUpperCase())
              .filter(cat => cat && cat !== 'SEMUA' && cat !== 'SEMUA KATEGORI' && cat !== 'NULL' && cat !== 'UNDEFINED')
          )
        );

        // Ambil sort_order dari master categories agar posisi tombol kategori di POS selaras dengan admin
        try {
          const { data: catOrderRows } = await supabase
            .from('categories')
            .select('name, raw_data');
          const catOrderMap = new Map<string, number>();
          (catOrderRows || []).forEach((c: any) => {
            const raw = c.raw_data || {};
            const name = String(c.name || raw.name || '').trim().toUpperCase();
            if (name && raw.sort_order !== undefined) {
              catOrderMap.set(name, Number(raw.sort_order));
            }
          });

          activeProductCats.sort((a, b) => {
            const oA = catOrderMap.get(a) ?? 999;
            const oB = catOrderMap.get(b) ?? 999;
            if (oA !== oB) return oA - oB;
            return a.localeCompare(b, 'id-ID');
          });
        } catch {
          activeProductCats.sort((a, b) => a.localeCompare(b, 'id-ID'));
        }

        setCategories(activeProductCats);
        setSelectedCategory(prev => (prev === 'SEMUA' || activeProductCats.includes(prev) ? prev : 'SEMUA'));
        try {
          localStorage.setItem('pos-cached-categories', JSON.stringify(activeProductCats));
        } catch {}
      } catch (error) {
        console.error('Error fetching products:', error);
        // Fallback muat dari cache lokal jika jaringan offline / gagal
        try {
          const cached = localStorage.getItem('pos-cached-products');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setProducts(parsed);
              setFilteredProducts(parsed);
              const cachedCats = localStorage.getItem('pos-cached-categories');
              if (cachedCats) setCategories(JSON.parse(cachedCats));
              toast('📴 Mode Offline: Memuat ' + parsed.length + ' produk dari cache lokal kasir.', { icon: '📦', duration: 4000 });
              return;
            }
          }
        } catch (parseErr) {
          console.error('Error reading cached products:', parseErr);
        }
        toast.error('Gagal memuat produk. Silakan periksa koneksi.');
      } finally {
        setIsFetchingProducts(false);
      }
    };
    
    fetchProducts();
    
    // Refresh data setiap 2 menit + realtime subscription
    const interval = setInterval(fetchProducts, 120000);
    const prodChannel = supabase
      .channel('cashier_products_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => {
          fetchProducts();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(prodChannel);
    };
  }, [loading]);

  // Helper untuk normalisasi baris order dari Supabase
  const mapOrderRow = useCallback((d: any): Order => {
    const raw = d.raw_data || {};
    return {
      id: d.id,
      receiptNo: raw.receiptNo || d.receipt_no || (raw.dailySeq ? `#${String(raw.dailySeq).padStart(4, '0')}` : undefined),
      dailySeq: raw.dailySeq,
      customerName: d.customer_name || raw.customerName || 'Pelanggan',
      customerPhone: d.customer_phone || raw.customerPhone || '',
      items: (Array.isArray(d.items) && d.items.length > 0 ? d.items : raw.items) || [],
      total: Number(d.total ?? raw.total ?? 0),
      paymentMethod: raw.paymentMethod || d.payment?.method || d.payment_method || 'CASH',
      deliveryMethod: raw.deliveryMethod || d.delivery?.method || 'PICKUP',
      status: d.status || raw.status || 'SELESAI',
      createdAt: d.created_at ? new Date(d.created_at) : (raw.createdAt ? new Date(raw.createdAt) : new Date()),
      subtotal: Number(raw.subtotal ?? d.total ?? 0),
      shippingCost: Number(raw.shippingCost ?? 0),
      transactionType: raw.transactionType || 'STORE',
      payAmount: Number(raw.payAmount ?? 0),
      changeAmount: Number(raw.changeAmount ?? 0),
      shiftId: raw.shiftId || '',
      dueDate: raw.dueDate || d.due_date || null,
    };
  }, []);

  // Fetch Unread Chats count (Admin)
  useEffect(() => {
    const fetchUnreadCount = async () => {
      const { count } = await supabase
        .from('chats')
        .select('id', { count: 'exact', head: true })
        .eq('is_read_by_admin', false);
      setChatUnreadCount(count ?? 0);
    };
    fetchUnreadCount();
  }, []);

  // Load Warehouses from Supabase
  useEffect(() => {
    async function loadWarehouses() {
      try {
        const { data, error } = await supabase.from('warehouses').select('id, name').order('name');
        if (!error && data && data.length > 0) {
          setWarehouses(data);
        } else {
          setWarehouses([
            { id: 'gudang-utama', name: 'Gudang Utama' },
            { id: 'toko-depan', name: 'Toko Depan' },
            { id: 'Rumah', name: 'Rumah' },
            { id: 'ATAYATOKO', name: 'ATAYATOKO' },
          ]);
        }
      } catch (err) {
        setWarehouses([
          { id: 'gudang-utama', name: 'Gudang Utama' },
          { id: 'toko-depan', name: 'Toko Depan' },
        ]);
      }
    }
    loadWarehouses();
  }, []);

  useEffect(() => {
    if (activeTab !== 'orders') return;
    
    const fetchCompleted = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);
        if (!error && data) {
          setCompletedOrders(data.map(mapOrderRow));
        }
      } catch (err) {
        console.error('Error fetching completed orders:', err);
      }
    };
    fetchCompleted();

    const channel = supabase
      .channel('cashier_completed_orders_rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchCompleted();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab, mapOrderRow]);

  useEffect(() => {
    const term = searchQuery.toLowerCase().trim();
    const tokens = term ? term.split(/\s+/).filter(Boolean) : [];

    let filtered = products.filter(p => {
      const prodCat = String(p.Kategori || p.kategori || 'UMUM').toUpperCase();
      const matchCategory = selectedCategory === 'SEMUA' || prodCat === selectedCategory.toUpperCase();
      const matchStock = stockFilter === 'all' ? true : (stockFilter === 'instock' ? (p.stock || 0) > 0 : (p.stock || 0) <= 0);
      if (!matchCategory || !matchStock) return false;

      if (!tokens.length) return true;

      const name = (p.name || '').toLowerCase();
      const barcode = (p.barcode || '').toLowerCase();
      const sku = (p.sku || p.id || '').toLowerCase();
      const brand = (p.brand || '').toLowerCase();
      const category = (p.Kategori || p.kategori || '').toLowerCase();
      const unitBarcodes = Array.isArray(p.units)
        ? p.units.map((u: any) => (u.barcode || '').toLowerCase()).filter(Boolean)
        : [];
      const parentName = p.parentId ? (productsById.get(p.parentId)?.name || '').toLowerCase() : '';

      return tokens.every(t =>
        name.includes(t) ||
        barcode.includes(t) ||
        sku.includes(t) ||
        brand.includes(t) ||
        category.includes(t) ||
        parentName.includes(t) ||
        unitBarcodes.some(ub => ub.includes(t))
      );
    });

    if (term) {
      filtered.sort((a, b) => {
        const aName = (a.name || '').toLowerCase();
        const bName = (b.name || '').toLowerCase();
        const aExact = a.barcode === term || a.sku === term;
        const bExact = b.barcode === term || b.sku === term;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        const aStarts = aName.startsWith(term);
        const bStarts = bName.startsWith(term);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        return 0;
      });
    } else {
      filtered.sort((a, b) => {
        if (productSort === 'recent_sold') {
          const aRec = recentlySoldMap.get(a.id) ?? 999999;
          const bRec = recentlySoldMap.get(b.id) ?? 999999;
          if (aRec !== bRec) return aRec - bRec;
          return (b.updatedAt || '').localeCompare(a.updatedAt || '');
        } else if (productSort === 'recent_update') {
          return (b.updatedAt || '').localeCompare(a.updatedAt || '');
        } else {
          return (a.name || '').localeCompare(b.name || '');
        }
      });
    }

    setFilteredProducts(filtered);
    setDisplayLimit(80);

    const trimmedQuery = searchQuery.trim();
    const exactMatch = products.find(p => 
      (p.barcode && p.barcode === trimmedQuery) ||
      (p.units && Array.isArray(p.units) && p.units.some((u: any) => u.barcode && u.barcode === trimmedQuery))
    );
    if (exactMatch && searchQuery.length >= 3) {
      if (exactMatch.isParentOnly) {
        setVariantPickerParent(exactMatch);
        setSearchQuery('');
        return;
      }
      const unitMatch = exactMatch.units?.find((u: any) => u.barcode && u.barcode === trimmedQuery);
      if (unitMatch) {
        addToCartWithUnit(exactMatch, unitMatch);
      } else {
        addToCart(exactMatch);
      }
      setSearchQuery('');
    }
  }, [searchQuery, products, addToCart, addToCartWithUnit, selectedCategory, stockFilter, productsById, productSort, recentlySoldMap]);

  useEffect(() => {
    if (loading) return;

    const fetchPending = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('status', 'MENUNGGU')
          .order('created_at', { ascending: false });

        if (!error && data) {
          const mapped = data.map(mapOrderRow);
          setRecentOrders(mapped);
          setNewOrderCount(mapped.length);
        }
      } catch (err) {
        console.error('Error fetching pending orders:', err);
      }
    };
    fetchPending();

    const channel = supabase
      .channel('cashier_pending_orders_rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchPending();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loading, mapOrderRow]);


  // --- SHIFT MANAGEMENT ---
  const handleOpenShift = async () => {
    const enteredName = (shiftInput.cashierName || '').trim();
    if (!enteredName) return toast.error('Masukkan nama petugas kasir yang membuka!');
    if (!shiftInput.initialCash) return toast.error('Masukkan modal awal!');
    
    setLoading(true);
    try {
      const initial = parseInt(shiftInput.initialCash.replace(/\D/g, '')) || 0;
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const cashierId = authUser?.id || '';
      const cashierName = enteredName;
      if (typeof window !== 'undefined') {
        localStorage.setItem('pos_cashier_name', enteredName);
      }
      const newShift: Partial<CashierShift> = {
        cashierId,
        cashierName,
        openedAt: new Date().toISOString(),
        initialCash: initial,
        status: 'OPEN',
        totalCashSales: 0,
        totalNonCashSales: 0,
        expectedCash: initial,
      };
      
      const ref = await sbInsertDoc('cashier_shifts', newShift);
      const openedShift = { id: ref.id, ...newShift } as CashierShift;
      setCurrentShift(openedShift);
      // Simpan ke sessionStorage agar tidak muncul modal saat pindah tab
      sessionStorage.setItem('pos-current-shift', JSON.stringify(openedShift));
      setShowShiftModal(null);
      setShiftInput({ cashierName: enteredName, initialCash: '', actualCash: '', notes: '' });
      toast.success('Kasir Dibuka!');
    } catch (e) {
      console.error(e);
      toast.error('Gagal membuka kasir');
    } finally { setLoading(false); }
  };

  const prepareCloseShift = async () => {
    if (!currentShift) return;
    setLoading(true);
    try {
      const { data: shiftOrders, error: ordersErr } = await supabase
        .from('orders')
        .select('*');

      let cashSales = 0, qrisSales = 0, transferSales = 0, tempoSales = 0, walletSales = 0;
      let cashTx = 0, nonCashTx = 0;

      if (!ordersErr && shiftOrders) {
        shiftOrders.forEach((d: any) => {
          const raw = d.raw_data || {};
          const status = d.status || raw.status;
          const shiftId = raw.shiftId || d.shift_id;
          if (shiftId === currentShift.id && (status === 'SELESAI' || status === 'DIPROSES')) {
            const payMethod = (raw.paymentMethod || d.payment?.method || d.payment_method || 'CASH').toUpperCase();
            const total = Number(d.total ?? raw.total ?? 0);
            const payAmount = Number(raw.payAmount ?? total);
            if (payMethod === 'CASH') {
              cashSales += (payAmount || total);
              cashTx++;
            } else if (payMethod === 'QRIS') {
              qrisSales += total;
              nonCashTx++;
            } else if (payMethod === 'TRANSFER') {
              transferSales += total;
              nonCashTx++;
            } else if (payMethod === 'TEMPO') {
              tempoSales += total;
              nonCashTx++;
            } else if (payMethod === 'WALLET') {
              walletSales += total;
              nonCashTx++;
            } else {
              // fallback non-cash
              qrisSales += total;
              nonCashTx++;
            }
          }
        });
      }

      const nonCashTotal = qrisSales + transferSales + tempoSales + walletSales;
      setShiftSummary({
        totalCash: cashSales,
        totalNonCash: nonCashTotal,
        expected: (currentShift.initialCash || 0) + cashSales,
        totalTransactions: cashTx + nonCashTx,
        qrisSales,
        transferSales,
        tempoSales,
        walletSales,
        cashTransactions: cashTx,
        nonCashTransactions: nonCashTx,
      });
      setShowShiftModal('close');
    } catch (e) {
      console.error(e);
      toast.error('Gagal menghitung rekap');
    } finally { setLoading(false); }
  };

  const handleCloseShift = async () => {
    if (!currentShift || !shiftSummary) return;
    
    setLoading(true);
    try {
      const actual = parseInt(shiftInput.actualCash.replace(/\D/g, '')) || 0;
      const diff = actual - shiftSummary.expected;
      
      const updateData = {
        closedAt: new Date().toISOString(),
        status: 'CLOSED' as const,
        actualCash: actual,
        difference: diff,
        totalCashSales: shiftSummary.totalCash,
        totalNonCashSales: shiftSummary.totalNonCash,
        notes: shiftInput.notes
      };

      await sbUpdateDoc('cashier_shifts', currentShift.id, updateData);
      
      printShiftReport({
        ...currentShift,
        ...updateData,
        expectedCash: shiftSummary.expected,
        closedAt: new Date()
      }, shiftSummary);
      
      setCurrentShift(null);
      setShowShiftModal(null);
      setShiftInput({ cashierName: '', initialCash: '', actualCash: '', notes: '' });
      setShiftSummary(null);
      // Hapus cache shift agar modal muncul kembali saat kasir dibuka berikutnya
      sessionStorage.removeItem('pos-current-shift');
      toast.success('Kasir Ditutup!');
      router.push('/profil');
    } catch (e) {
      console.error(e);
      toast.error('Gagal menutup kasir');
    } finally { setLoading(false); }
  };

  const printShiftReport = useCallback((shift: Partial<CashierShift>, summary?: typeof shiftSummary) => {
    const w = window.open('', '_blank');
    if (!w) return;

    const fmt = (n: number = 0) => 'Rp' + n.toLocaleString('id-ID');
    const fmtDate = (d: any) => d ? new Date(d).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
    const durasi = () => {
      if (!shift.openedAt || !shift.closedAt) return '-';
      const ms = new Date(shift.closedAt).getTime() - new Date(shift.openedAt).getTime();
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      return `${h}j ${m}m`;
    };
    const diff = (shift.actualCash || 0) - (shift.expectedCash || 0);
    const diffColor = diff === 0 ? '#16a34a' : diff > 0 ? '#2563eb' : '#dc2626';
    const diffLabel = diff === 0 ? 'BALANCE ✓' : diff > 0 ? `LEBIH +${fmt(diff)}` : `KURANG ${fmt(diff)}`;

    w.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <title>Laporan Shift #${(shift.id || '').slice(-6).toUpperCase()}</title>
      <style>
        @page { size: 80mm auto; margin: 4mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Courier New', monospace; width: 72mm; font-size: 9.5px; color: #111; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .row { display: flex; justify-content: space-between; padding: 1.5px 0; }
        .row.total { font-weight: bold; font-size: 10.5px; border-top: 1px solid #000; padding-top: 3px; margin-top: 2px; }
        .section { margin: 5px 0; }
        .divider { border: none; border-top: 1px dashed #555; margin: 5px 0; }
        .divider-solid { border: none; border-top: 1px solid #000; margin: 5px 0; }
        .header { text-align:center; margin-bottom:4px; }
        .badge { display:inline-block; padding:1px 5px; border-radius:3px; font-weight:bold; font-size:9px; }
        .badge-ok { background:#d1fae5; color:#065f46; }
        .badge-more { background:#dbeafe; color:#1e40af; }
        .badge-less { background:#fee2e2; color:#991b1b; }
        .method-row { display:flex; justify-content:space-between; font-size:8.5px; padding:1px 0; }
        .method-label { color: #555; }
        .signature-box { border-top: 1px solid #000; margin-top: 30px; text-align:center; font-size:8.5px; }
        @media print { body { -webkit-print-color-adjust: exact; } }
      </style>
    </head><body>

      <div class="header">
        <div class="bold" style="font-size:13px; letter-spacing:1px;">LAPORAN SHIFT KASIR</div>
        <div style="font-size:8px; color:#555;">ATAYA TOKO — SISTEM KASIR TERINTEGRASI</div>
        <hr class="divider-solid" style="margin:4px 0;">
        <div style="font-size:8.5px;">Dicetak: ${new Date().toLocaleString('id-ID')}</div>
      </div>

      <div class="section">
        <div class="row"><span>Kasir</span><span class="bold">${shift.cashierName || '-'}</span></div>
        <div class="row"><span>Shift ID</span><span>#${(shift.id || '').slice(-6).toUpperCase()}</span></div>
        <div class="row"><span>Buka Kasir</span><span>${fmtDate(shift.openedAt)}</span></div>
        <div class="row"><span>Tutup Kasir</span><span>${fmtDate(shift.closedAt)}</span></div>
        <div class="row"><span>Durasi Shift</span><span>${durasi()}</span></div>
      </div>

      <hr class="divider">

      <div class="bold" style="font-size:9px; margin-bottom:3px;">── RINGKASAN TRANSAKSI ──</div>
      <div class="section">
        <div class="row"><span>Total Transaksi</span><span class="bold">${(summary?.totalTransactions || 0)} transaksi</span></div>
        <div class="row"><span style="color:#555;">└ Tunai (${summary?.cashTransactions || 0}x)</span><span>${fmt(summary?.totalCash)}</span></div>
        ${ summary?.qrisSales ? `<div class="row"><span style="color:#555;">└ QRIS</span><span>${fmt(summary?.qrisSales)}</span></div>` : '' }
        ${ summary?.transferSales ? `<div class="row"><span style="color:#555;">└ Transfer</span><span>${fmt(summary?.transferSales)}</span></div>` : '' }
        ${ summary?.tempoSales ? `<div class="row"><span style="color:#555;">└ Tempo</span><span>${fmt(summary?.tempoSales)}</span></div>` : '' }
        ${ summary?.walletSales ? `<div class="row"><span style="color:#555;">└ Wallet</span><span>${fmt(summary?.walletSales)}</span></div>` : '' }
        <div class="row total"><span>TOTAL OMZET</span><span>${fmt((summary?.totalCash || 0) + (summary?.totalNonCash || 0))}</span></div>
      </div>

      <hr class="divider">

      <div class="bold" style="font-size:9px; margin-bottom:3px;">── REKONSILIASI LACI ──</div>
      <div class="section">
        <div class="row"><span>Modal Awal (Laci)</span><span>${fmt(shift.initialCash)}</span></div>
        <div class="row"><span>+ Penjualan Tunai</span><span>${fmt(summary?.totalCash)}</span></div>
        <div class="row total"><span>HARUSNYA DI LACI</span><span>${fmt(summary?.expected)}</span></div>
        <div class="row"><span>Hitung Fisik</span><span class="bold">${fmt(shift.actualCash || 0)}</span></div>
        <div style="text-align:right; margin-top:3px;">
          <span class="badge ${diff === 0 ? 'badge-ok' : diff > 0 ? 'badge-more' : 'badge-less'}">${diffLabel}</span>
        </div>
      </div>

      ${ shift.notes ? `<hr class="divider"><div style="font-size:8.5px;"><span class="bold">Catatan: </span>${shift.notes}</div>` : '' }

      <hr class="divider-solid" style="margin-top:8px;">

      <div class="signature-box">
        <div>Tanda Tangan Kasir</div>
        <div style="margin-top:20px;">(${shift.cashierName || ''})</div>
        <div style="margin-top:4px; font-size:8px;">Shift #${(shift.id || '').slice(-6).toUpperCase()}</div>
      </div>

    </body><script>window.print(); window.close();</script></html>`);
    w.document.close();
  }, [useBluetoothPrinter]);


  // --- HANDLE TRANSACTION (DIUBAH UNTUK KOMPRESI) ---
  const handleTransaction = async () => {
    if (!currentShift) return toast.error('Kasir belum dibuka!');
    if (cart.length === 0) return;
    // QRIS Dinamis (sudah dikonfirmasi via BRI SNAP) tidak perlu upload bukti manual
    if (paymentMethod === 'QRIS' && !qrisConfirmedRef.current && !paymentProof && !isOffline) return toast.error('Bayar via QRIS terlebih dahulu atau upload bukti!');
    if (paymentMethod === 'TRANSFER' && !paymentProof && !isOffline) return toast.error('Wajib upload bukti transfer!');
    if (paymentMethod === 'CASH' && change < 0) return toast.error('Uang kurang!');
    if (paymentMethod === 'TEMPO') {
      if (!customerName || !customerPhone || !tempoDueDate) return toast.error('Data pelanggan & jatuh tempo wajib diisi untuk transaksi TEMPO!');
    }
    if (paymentMethod === 'DOMPET') {
      if (!selectedCustomer) return toast.error('Pilih pelanggan terlebih dahulu!');
      if (selectedCustomer.walletBalance < total) return toast.error('Saldo dompet tidak mencukupi!');
    }
    
    // Jika offline, blokir metode yang butuh upload kecuali dipaksa (tapi di sini kita warning saja)
    if (isOffline && (paymentMethod === 'QRIS' || paymentMethod === 'TRANSFER')) {
       if (!confirm("Anda sedang OFFLINE. Bukti transfer tidak akan terupload. Lanjutkan?")) return;
    }

    setIsProcessing(true);

    try {
      let proofUrl: string | null = null;
      if (paymentProof && !isOffline) {
        // PROSES KOMPRESI SEBELUM UPLOAD KE SUPABASE
        const compressedFile = await compressImage(paymentProof);
        const fileName = uniqueFileName('payment-proofs', 'jpg');
        const { success: upSuccess, url: upUrl, error: upErr } = await uploadToSupabase(
          'products',
          fileName,
          compressedFile,
          compressedFile.type || 'image/jpeg'
        );
        if (upSuccess && upUrl) {
          proofUrl = upUrl;
        } else {
          console.warn('Gagal upload bukti ke Supabase storage:', upErr);
        }
      } else if (paymentProof && isOffline) {
         console.warn("Offline: Skipping image upload");
      }

      // Hitung dulu sebelum membuat orderData
      const finalPayAmount = paymentMethod === 'CASH' ? (parseFloat(cashGiven) || total) : total;
      const finalChange = paymentMethod === 'CASH' ? change : 0;
      const orderId = timestampId('ord');
      const now = new Date().toISOString();
      const selectedWhObj = warehouses.find(w => w.id === selectedWarehouse);
      const warehouseName = selectedWhObj ? selectedWhObj.name : (selectedWarehouse === 'auto' ? 'Otomatis' : selectedWarehouse);

      const todayDate = new Date();
      const yy = String(todayDate.getFullYear()).slice(-2);
      const mm = String(todayDate.getMonth() + 1).padStart(2, '0');
      const dd = String(todayDate.getDate()).padStart(2, '0');
      const clientReceiptNo = `${yy}${mm}${dd}-${(completedOrders.length + 1).toString().padStart(4, '0')}`;

      const orderData = {
        customerName: paymentMethod === 'TEMPO' ? customerName : (paymentMethod === 'DOMPET' ? selectedCustomer?.name : (transactionType === 'online' ? 'Pelanggan Online' : 'Pelanggan Toko')),
        customerPhone: paymentMethod === 'TEMPO' ? customerPhone : '',
        items: cart,
        subtotal, shippingCost, total,
        paymentMethod, paymentProofUrl: proofUrl,
        deliveryMethod, transactionType,
        status: paymentMethod === 'TEMPO' ? 'BELUM_LUNAS' : 'SELESAI',
        dueDate: paymentMethod === 'TEMPO' ? new Date(tempoDueDate).toISOString() : null,
        createdAt: now,
        userId: paymentMethod === 'DOMPET' ? selectedCustomer?.id : null,
        payAmount: finalPayAmount,
        changeAmount: finalChange,
        shiftId: currentShift.id,
        receiptNo: clientReceiptNo,
      };

      // 1. Validasi kecukupan stok sebelum proses eksekusi
      for (const item of cart) {
        const contains = Number(item.contains || 1);
        const pcsToDeduct = item.quantity * contains;
        const localProduct = products.find(p => p.id === item.id);
        if (localProduct && localProduct.stock < pcsToDeduct) {
          setIsProcessing(false);
          return toast.error(`Stok ${formatProductName(item.name)} tidak cukup! Tersedia: ${localProduct.stock}, Dibutuhkan: ${pcsToDeduct}`);
        }
      }

      // 2. Simpan SEMUA di server (stok, order, dompet, jurnal).
      //
      // Sebelumnya halaman ini menulis sendiri memakai `supabaseAdmin` DARI
      // PERAMBAN. Klien itu di browser berjalan sebagai `anon` (tanpa sesi),
      // sehingga RLS menolak: pemotongan stok gagal dan baris `orders` tidak
      // pernah masuk (terbukti 0 order ber-source CASHIER di database, dan
      // order offline terakhir masih dari era Firestore).
      //
      // Server Action ini memakai service role + pemeriksaan peran, menghitung
      // ulang MODAL per pcs dari master produk (snapshot HPP), dan mengembalikan
      // stok yang sudah terpotong bila ada langkah yang gagal.
      const simpan = await simpanTransaksiKasir({
        orderId,
        receiptNo: clientReceiptNo,
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          originalPrice: item.originalPrice ?? item.price,
          quantity: item.quantity,
          unit: item.unit,
          contains: item.contains || 1,
        })),
        subtotal,
        shippingCost,
        total,
        paymentMethod,
        paymentProofUrl: proofUrl,
        transactionType,
        deliveryMethod,
        status: orderData.status,
        dueDate: orderData.dueDate,
        customerName: orderData.customerName,
        customerPhone: orderData.customerPhone,
        userId: orderData.userId,
        payAmount: finalPayAmount,
        changeAmount: finalChange,
        shiftId: currentShift.id,
        warehouseId: selectedWarehouse,
        warehouseName,
      });

      if (!simpan.success || !simpan.data) {
        // Jika offline atau koneksi gagal, simpan ke antrian IndexedDB
        const isNetworkError = !navigator.onLine || 
          (simpan.error || '').toLowerCase().includes('fetch') ||
          (simpan.error || '').toLowerCase().includes('network') ||
          isOffline;
        
        if (isNetworkError) {
          try {
            await enqueueOfflineTx({
              orderId,
              items: cart.map(item => ({
                id: item.id, name: item.name, price: item.price,
                quantity: item.quantity, unit: item.unit, contains: item.contains || 1,
              })),
              subtotal, shippingCost, total, paymentMethod,
              transactionType, deliveryMethod,
              status: orderData.status, dueDate: orderData.dueDate,
              customerName: orderData.customerName, customerPhone: orderData.customerPhone,
              userId: orderData.userId, payAmount: finalPayAmount, changeAmount: finalChange,
              shiftId: currentShift.id, warehouseId: selectedWarehouse, warehouseName,
            });
            const q = await getOfflineQueue();
            setOfflineQueueCount(q.length);
            toast(
              `📂 Mode Offline: transaksi disimpan lokal (${q.length} antrian). Akan otomatis sinkron saat online.`,
              { duration: 6000, icon: '📴' }
            );
            // Cetak struk lokal & bersihkan keranjang
            printReceipt({ ...orderData, id: orderId, createdAt: new Date() });
            setCart([]); localStorage.removeItem('pos-cart');
            setCashGiven(''); setPaymentProof(null); setProofPreview(null);
            setCustomerName(''); setCustomerPhone(''); setTempoDueDate('');
            setSelectedCustomer(null); setCustomerSearch('');
            qrisConfirmedRef.current = false; setQrisConfirmed(false);
          } catch (qErr) {
            toast.error('Gagal menyimpan transaksi offline. Catat manual!');
            console.error('Offline queue error:', qErr);
          }
          return;
        }
        
        return toast.error(simpan.error || 'Gagal menyimpan transaksi');
      }

      const deductionResults = simpan.data.items;

      if (simpan.data.itemTanpaModal > 0) {
        toast(
          `${simpan.data.itemTanpaModal} item belum punya Modal — HPP transaksi ini masih estimasi.`
        );
      }

      toast.success('Transaksi tersimpan & stok diperbarui.');

      // 3. Pencatatan dompet, jurnal double-entry, dan baris `orders` sudah
      //    dilakukan di dalam `simpanTransaksiKasir()` — jangan ditulis lagi
      //    di sini supaya tidak terhitung dua kali.


      // 4. Update stok di state produk kasir secara realtime
      if (deductionResults.length > 0) {
        setProducts(prev => prev.map(p => {
          const res = deductionResults.find(d => d.productId === p.id);
          if (res) {
            return {
              ...p,
              stock: res.newStock,
              stockByWarehouse: res.newStockByWarehouse || p.stockByWarehouse,
            };
          }
          return p;
        }));
        setFilteredProducts(prev => prev.map(p => {
          const res = deductionResults.find(d => d.productId === p.id);
          if (res) {
            return {
              ...p,
              stock: res.newStock,
              stockByWarehouse: res.newStockByWarehouse || p.stockByWarehouse,
            };
          }
          return p;
        }));
      }
      
      printReceipt({ 
        ...orderData, 
        id: orderId, 
        receiptNo: simpan.data?.receiptNo || clientReceiptNo,
        dailySeq: simpan.data?.dailySeq,
        createdAt: new Date()
      });

      setCart([]);
      localStorage.removeItem('pos-cart');
      setCashGiven('');
      setPaymentProof(null);
      setProofPreview(null);
      setCustomerName('');
      setCustomerPhone('');
      setTempoDueDate('');
      setSelectedCustomer(null);
      setCustomerSearch('');
      qrisConfirmedRef.current = false; setQrisConfirmed(false);
    } catch (e) {
      console.error(e);
      toast.error('Gagal Transaksi');
    } finally { setIsProcessing(false); }
  };

  useEffect(() => {
    handleTransactionRef.current = handleTransaction;
  }, [handleTransaction]);

  const printReceipt = useCallback(async (order: Partial<Order>) => {
    // Simpan order terakhir untuk fitur Cetak Ulang Struk [F12]
    try {
      setLastPrintedOrder(order);
      localStorage.setItem('pos-last-order', JSON.stringify(order));
    } catch {}

    // FIX: Fetch cashier name BEFORE template string (await inside template literal tidak valid)
    let cashierDisplayName = 'Admin';
    try {
      const { data: { user: prUser } } = await supabase.auth.getUser();
      cashierDisplayName = prUser?.user_metadata?.full_name || prUser?.email?.split('@')[0] || 'Admin';
    } catch { /* fallback */ }

    // Ambil settingan dari state atau local storage jika memungkinkan
    // Untuk keamanan, default buka (true) jika tidak ada setting
    let isDrawerEnabled = true;
    try {
      // Jika offline, baca dari localStorage saja agar cepat dan tidak error
      if (!navigator.onLine) {
         const cachedSettings = localStorage.getItem('pos-settings');
         if (cachedSettings) {
           const parsed = JSON.parse(cachedSettings);
           if (parsed.store?.isCashDrawerEnabled !== undefined) {
             isDrawerEnabled = parsed.store.isCashDrawerEnabled;
           }
         }
      } else {
        const snap = await sbGetDoc('settings', 'system');
        if (snap.exists()) {
          const data = snap.data();
          if (data.store?.isCashDrawerEnabled !== undefined) {
            isDrawerEnabled = data.store.isCashDrawerEnabled;
          }
          // Simpan ke localstorage untuk cadangan saat offline
          localStorage.setItem('pos-settings', JSON.stringify(data));
        }
      }
    } catch (e) {
      console.warn("Gagal cek setting laci", e);
    }

    // FUNGSI UNTUK MEMBUKA LACI KASIR (CASH DRAWER) via ESC/POS
    // Kode standar untuk membuka laci kasir (Drawer Kick-out):
    // ESC p m t1 t2 -> Hex: 1B 70 00 19 FA
    const openCashDrawer = async () => {
      try {
        if (!isDrawerEnabled) return; // Cegah buka laci jika setting dimatikan
        const nav = navigator as any;
        if (!nav.bluetooth) return;
        const escOpenDrawer = new Uint8Array([0x1B, 0x70, 0x00, 0x19, 0xFA]);
        await printToThermal(escOpenDrawer);
      } catch (err) {
        logger.warn('Gagal membuka laci kasir otomatis:', err);
      }
    };

    // Pastikan order.items memiliki fallback originalPrice dari master produk bila belum tersimpan
    const enrichedItems = (order.items || []).map((item: any) => {
      let orig = Number(item.originalPrice || 0);
      const cur = Number(item.price || 0);
      if (orig <= cur) {
        const prod = productsById.get(item.id);
        if (prod) {
          const mult = item.contains && Number(item.contains) > 0 ? Number(item.contains) : 1;
          const masterEcer = Number(prod.price || 0) * mult;
          if (masterEcer > cur) orig = masterEcer;
        }
      }
      return {
        ...item,
        originalPrice: orig > 0 ? orig : cur,
      };
    });

    if (useBluetoothPrinter) {
      try {
        const escReceipt = generateESCReceipt({ ...order, items: enrichedItems }, printSettings);
        
        // Buka laci kasir jika pembayarannya TUNAI (CASH)
        if (order.paymentMethod === 'CASH') {
          await openCashDrawer();
        }
        
        await printToThermal(escReceipt);
        toast.success('Struk berhasil dicetak via Bluetooth');
        return;
      } catch (err: any) {
        toast.error('Gagal cetak Bluetooth: ' + err.message);
        // Fallback to normal print if user wants? Just continue to normal print.
      }
    }

    const w = window.open('', '_blank');
    if (!w) return;

    const date = order.createdAt 
      ? (order.createdAt instanceof Date ? order.createdAt : new Date((order.createdAt as { seconds: number }).seconds * 1000)) 
      : new Date();
    
    const dateStr = date.toLocaleString('id-ID', { 
      day: '2-digit', month: '2-digit', year: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    });

    const formatRp = (num: number = 0) => 'Rp' + num.toLocaleString('id-ID');

    // Pastikan nilai pembayaran dan kembalian ada
    const payAmount = order.payAmount || order.total || 0;
    const changeAmount = order.changeAmount || 0;

    w.document.write(`
      <html>
        <head>
          <title>Struk Belanja - ATAYATOKO</title>
          <style>
            @page { size: ${printSettings.paperWidth} auto; margin: 0; }
            body { 
              font-family: 'Courier New', monospace; 
              width: ${printSettings.paperWidth}; 
              margin: 0; 
              padding: ${printSettings.ecoMode ? '2px' : '4px'}; 
              font-size: ${printSettings.paperWidth === '80mm' ? '12px' : '10px'}; 
              color: black; 
              line-height: ${printSettings.ecoMode ? '1.1' : '1.2'};
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .bold { font-weight: bold; }
            .flex { display: flex; justify-content: space-between; }
            .line { border-bottom: 1px dashed black; margin: 4px 0; }
            .item-row { margin-bottom: 2px; }
            .item-name { font-weight: bold; }
            .item-detail { display: flex; justify-content: space-between; padding-left: 0px; }
            .footer { margin-top: 8px; font-size: 9px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="text-center bold" style="font-size: 14px;">ATAYATOKO</div>
          <div class="text-center">Pusat Grosir & Eceran</div>
          <div class="text-center">Kediri - 085853161174</div>
          <div class="line"></div>
          
          <div class="flex"><span>Tgl: ${dateStr}</span></div>
          <div class="flex"><span>No : ${order.receiptNo || (order.dailySeq ? `#${String(order.dailySeq).padStart(4, '0')}` : `#${(order.id || '').slice(-6).toUpperCase()}`)}</span></div>
          <div class="flex"><span>Ksr: ${cashierDisplayName}</span></div>
          <div class="flex"><span>Plg: ${order.customerName || 'Umum'}</span></div>
          
          <div class="line"></div>
          
          ${(() => {
            const itemsHtml = enrichedItems.map((i: any) => {
              const orig = Number(i.originalPrice || i.price || 0);
              const cur = Number(i.price || 0);
              const qty = Number(i.quantity || 1);
              const lineTotal = cur * qty;
              const itemSave = orig > cur ? (orig - cur) * qty : 0;
              return `
              <div class="item-row" style="margin-bottom: 4px;">
                <div class="item-name">${formatProductName(i.name)}</div>
                <div class="item-detail">
                  <span>
                    ${orig > cur ? `<span style="text-decoration: line-through; color: #777; font-size: 8.5px; margin-right: 2px;">${orig.toLocaleString('id-ID')}</span>` : ''}
                    <span>${qty} x ${cur.toLocaleString('id-ID')}</span>
                    ${itemSave > 0 ? `<br><span style="color: #15803d; font-size: 8px; font-weight: bold;">(Hemat Rp${itemSave.toLocaleString('id-ID')})</span>` : ''}
                  </span>
                  <span class="bold">${lineTotal.toLocaleString('id-ID')}</span>
                </div>
              </div>`;
            }).join('');

            return itemsHtml;
          })()}
          
          <div class="line"></div>
          
          ${(() => {
            const savings = enrichedItems.reduce((acc: number, i: any) => {
              const orig = Number(i.originalPrice || i.price || 0);
              const cur = Number(i.price || 0);
              return acc + (orig > cur ? (orig - cur) * Number(i.quantity || 1) : 0);
            }, 0);
            if (savings > 0) {
              return `
              <div class="flex"><span>Subtotal Normal</span><span>${formatRp((order.subtotal || 0) + savings)}</span></div>
              <div class="flex" style="color:#15803d;font-weight:bold;"><span>Hemat Grosir</span><span>-${formatRp(savings)}</span></div>
              `;
            }
            return '';
          })()}
          <div class="flex"><span>Subtotal</span><span>${formatRp(order.subtotal)}</span></div>
          ${(order.shippingCost || 0) > 0 ? `<div class="flex"><span>Ongkir</span><span>${formatRp(order.shippingCost)}</span></div>` : ''}
          
          <div class="flex bold" style="font-size: 12px; margin-top: 2px;">
            <span>TOTAL</span><span>${formatRp(order.total)}</span>
          </div>
          ${(() => {
            const savings = enrichedItems.reduce((acc: number, i: any) => {
              const orig = Number(i.originalPrice || i.price || 0);
              const cur = Number(i.price || 0);
              return acc + (orig > cur ? (orig - cur) * Number(i.quantity || 1) : 0);
            }, 0);
            if (savings > 0) {
              return `
              <div class="line"></div>
              <div class="text-center bold" style="font-size: 11px; padding: 2px 0;">🎉 ANDA HEMAT: ${formatRp(savings)}!</div>
              `;
            }
            return '';
          })()}
          
          <div class="line"></div>
          
          <div class="flex">
            <span>Bayar (${order.paymentMethod})</span>
            <span>${formatRp(payAmount)}</span>
          </div>
          <div class="flex">
            <span>Kembali</span>
            <span>${formatRp(changeAmount)}</span>
          </div>
          
          ${String(order.paymentMethod || '').toUpperCase() === 'TEMPO' ? `
          <div class="line"></div>
          <div class="text-center bold" style="font-size: 11px;">NOTA BON GANTUNG (TEMPO)</div>
          <div class="flex"><span>Jatuh Tempo:</span><span>${order.dueDate ? new Date(order.dueDate).toLocaleDateString('id-ID') : '-'}</span></div>
          <div class="flex"><span>Status:</span><span class="bold">BELUM LUNAS</span></div>
          <div style="margin-top: 24px; border-top: 1px dashed black; padding-top: 4px; text-align: center;">
            <span style="font-size: 9px;">Tanda Tangan Pelanggan:</span><br><br><br>
            <span>(___________________________)</span>
          </div>` : ''}

          ${printSettings.footerPromo ? `
          <div class="line"></div>
          <div class="text-center" style="font-size: 8.5px; font-weight: bold; padding: 2px 0;">
            ${printSettings.footerPromo}
          </div>` : ''}

          <div class="line"></div>
          <div class="footer">
            Terima Kasih atas Kunjungan Anda<br>
            Barang yang sudah dibeli tidak dapat<br>
            ditukar/dikembalikan
          </div>
          <br>
        </body>
        <script>
          window.onload = function() {
            window.print();
            window.close();
          }
        </script>
      </html>
    `);
    w.document.close();
  }, []);

  useEffect(() => {
    printReceiptRef.current = printReceipt;
  }, [printReceipt]);


  if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat Kasir...</div>;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col relative">
      {!currentShift && (
        <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full text-center border border-gray-100">
            <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShoppingBag size={40} />
            </div>
            <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter mb-2">Shift Belum Dibuka</h2>
            <p className="text-gray-500 text-sm mb-8">Anda harus membuka shift kasir dan memasukkan modal awal sebelum dapat melakukan transaksi.</p>
            <button 
              onClick={() => setShowShiftModal('open')} 
              className="w-full py-4 bg-green-600 text-white font-black rounded-2xl hover:bg-green-700 uppercase tracking-widest shadow-lg shadow-green-200 transition-all hover:scale-105"
            >
              Buka Shift Sekarang
            </button>
            <button 
              onClick={() => router.push('/profil')}
              className="w-full py-4 mt-3 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 uppercase text-xs"
            >
              Kembali ke Dashboard
            </button>
          </div>
        </div>
      )}
      <nav className="bg-white border-b px-4 md:px-6 py-3 flex flex-col md:flex-row md:items-center justify-between shadow-sm sticky top-0 z-30 gap-3 md:gap-0">
        <div className="flex items-center justify-between w-full md:w-auto">
          <h1 className="text-xl font-black italic text-green-600">ATAYATOKO <span className="text-gray-400 not-italic font-medium text-sm">POS</span></h1>
          
          {/* Mobile Notifications */}
          <div className="flex md:hidden items-center gap-3">
            <button onClick={() => setShowSettings(true)} className="p-1.5 bg-gray-100 rounded-full hover:bg-purple-50 group transition-colors" title="Pengaturan Kasir">
              <Settings size={18} className="group-hover:text-purple-600" />
            </button>
            <button onClick={() => setShowChatModal(true)} className="relative p-1.5 bg-gray-100 rounded-full hover:bg-green-50 group transition-colors">
              <MessageSquare size={18} className="group-hover:text-green-600" />
              {chatUnreadCount > 0 && <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs w-4 h-4 flex items-center justify-center rounded-full border-2 border-white animate-bounce">{chatUnreadCount}</span>}
            </button>
            <button onClick={() => setIsDrawerOpen(true)} className="relative p-1.5 bg-gray-100 rounded-full hover:bg-blue-50 group transition-colors">
              <Bell size={18} className="group-hover:text-blue-600" />
              {newOrderCount > 0 && <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs w-4 h-4 flex items-center justify-center rounded-full border-2 border-white animate-bounce">{newOrderCount}</span>}
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-3 overflow-x-auto hide-scrollbar pb-1 md:pb-0 w-full md:w-auto">
          {/* Offline + Queue Badge */}
          {(isOffline || offlineQueueCount > 0) && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all ${
              isOffline ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-amber-100 text-amber-700'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isOffline ? 'bg-red-500' : 'bg-amber-500'}`} />
              {isOffline ? 'OFFLINE' : ''}
              {offlineQueueCount > 0 && (
                <span className="bg-amber-500 text-white px-1.5 py-0.5 rounded-full text-[10px] font-black">
                  {offlineQueueCount} antrian
                </span>
              )}
              {isSyncing && <span className="animate-spin text-[10px]">🔄</span>}
            </div>
          )}
          <div className="flex bg-gray-100 rounded-lg p-1 shrink-0">
            <button onClick={() => setActiveTab('pos')} className={`px-3 md:px-4 py-1.5 rounded-md text-xs md:text-xs font-bold uppercase transition-all ${activeTab === 'pos' ? 'bg-white shadow text-green-600' : 'text-gray-400'}`}>Kasir</button>
            <button onClick={() => setActiveTab('orders')} className={`px-3 md:px-4 py-1.5 rounded-md text-xs md:text-xs font-bold uppercase transition-all ${activeTab === 'orders' ? 'bg-white shadow text-green-600' : 'text-gray-400'}`}>Riwayat Order</button>
          </div>

          {/* Tombol Retur Penjualan Cepat */}
          <button
            type="button"
            onClick={() => setShowReturModal(true)}
            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-black border border-rose-200 uppercase flex items-center gap-1.5 transition-all shrink-0 shadow-2xs"
            title="Retur Penjualan Cepat via No Struk"
          >
            <Undo2 size={13} />
            <span className="hidden sm:inline">Retur Struk</span>
          </button>

          {/* Tombol Layar Pembeli (Customer Display) */}
          <button
            type="button"
            onClick={() => window.open('/cashier/display', '_blank', 'width=1024,height=768')}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-black uppercase flex items-center gap-1.5 transition-all shrink-0 shadow-2xs"
            title="Buka Layar Pembeli (Customer Facing Display)"
          >
            <Monitor size={13} />
            <span className="hidden sm:inline">Layar Pembeli</span>
          </button>

          {/* Tombol Cetak Ulang Struk Terakhir [F12] */}
          {lastPrintedOrder && (
            <button
              type="button"
              onClick={handleReprintLastReceipt}
              className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-black border border-blue-200 uppercase flex items-center gap-1.5 transition-all shrink-0"
              title="Cetak Ulang Struk Terakhir [F12]"
            >
              <RotateCcw size={13} />
              <span className="hidden sm:inline">Cetak Ulang</span> [F12]
            </button>
          )}

          {/* Tombol Antrean Transaksi Ditahan (Hold) */}
          {heldCarts.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHeldModal(true)}
              className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-black border border-amber-300 uppercase flex items-center gap-1.5 transition-all shrink-0 animate-pulse"
              title="Buka Transaksi yang Ditahan"
            >
              <PauseCircle size={13} />
              <span>{heldCarts.length} Ditahan</span>
            </button>
          )}
          {currentShift && (
            <div className="flex items-center gap-2 shrink-0 md:ml-4 md:border-l md:pl-4">
              <div className="hidden md:flex flex-col text-right">
                <span className="text-xs font-bold text-gray-400 uppercase">Shift Aktif</span>
                <span className="text-xs font-black text-gray-700">{currentShift.cashierName}</span>
              </div>
              <button onClick={prepareCloseShift} className="px-3 py-1.5 md:py-2 bg-red-50 text-red-600 rounded-lg text-xs font-black hover:bg-red-100 border border-red-100 uppercase shrink-0">
                Tutup Shift
              </button>
            </div>
          )}
        </div>
        
        {/* Desktop Notifications */}
        <div className="hidden md:flex items-center gap-4">
          <button onClick={() => setShowSettings(true)} className="p-2 bg-gray-100 rounded-full hover:bg-purple-50 group transition-colors" title="Pengaturan Kasir">
            <Settings size={20} className="group-hover:text-purple-600" />
          </button>
          <button onClick={() => setShowChatModal(true)} className="relative p-2 bg-gray-100 rounded-full hover:bg-green-50 group transition-colors">
            <MessageSquare size={20} className="group-hover:text-green-600" />
            {chatUnreadCount > 0 && <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full border-2 border-white animate-bounce">{chatUnreadCount}</span>}
          </button>
          <button onClick={() => setIsDrawerOpen(true)} className="relative p-2 bg-gray-100 rounded-full hover:bg-blue-50 group transition-colors">
            <Bell size={20} className="group-hover:text-blue-600" />
            {newOrderCount > 0 && <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full border-2 border-white animate-bounce">{newOrderCount}</span>}
          </button>
        </div>
      </nav>

      {activeTab === 'pos' ? (
        <main className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
          <div className="col-span-12 xl:col-span-8 flex flex-col gap-4">

            <div className="flex flex-col gap-3">
              <div className="bg-white p-3 md:p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center gap-3 md:gap-4">
                <div className="flex items-center gap-3 w-full flex-1">
                  <div className="bg-green-50 p-2 rounded-xl text-green-600 shrink-0"><Search size={18} className="md:w-5 md:h-5" /></div>
                  <input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Cari Produk atau Scan Barcode [F1]..."
                    className="flex-1 outline-none text-sm md:text-base font-medium text-gray-700 min-w-0"
                  />
                </div>
                
                <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0 border-gray-50 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowScanner(!showScanner)}
                    className="px-4 py-2 flex-1 md:flex-none justify-center bg-black text-white rounded-xl text-xs md:text-xs font-black uppercase flex items-center gap-2"
                  >
                    <Camera size={14} /> Scan
                  </button>
                  <div className="flex bg-gray-100 p-1 rounded-lg shrink-0 gap-0.5">
                    <button onClick={() => handleSetViewMode('grid')} title="Tampilan Grid (Foto)" className={`p-1.5 rounded transition-all ${viewMode === 'grid' ? 'bg-white shadow text-green-600 font-bold' : 'text-gray-400 hover:text-gray-600'}`}><LayoutGrid size={16} className="md:w-[18px] md:h-[18px]" /></button>
                    <button onClick={() => handleSetViewMode('list')} title="Tampilan List (Foto)" className={`p-1.5 rounded transition-all ${viewMode === 'list' ? 'bg-white shadow text-green-600 font-bold' : 'text-gray-400 hover:text-gray-600'}`}><List size={16} className="md:w-[18px] md:h-[18px]" /></button>
                    <button onClick={() => handleSetViewMode('dense')} title="Tampilan Ringkas / Tanpa Foto (Muat Banyak)" className={`p-1.5 rounded transition-all ${viewMode === 'dense' ? 'bg-white shadow text-green-600 font-bold' : 'text-gray-400 hover:text-gray-600'}`}><AlignJustify size={16} className="md:w-[18px] md:h-[18px]" /></button>
                  </div>
                </div>
              </div>

              {/* Category Pill Chips + Stock Filter */}
              <div className="space-y-2">
                {/* Category pills */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {['SEMUA', ...categories].map(cat => {
                    const count = cat === 'SEMUA' ? products.length : (productCountPerCategory.get(cat) || 0);
                    return (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wide transition-all border whitespace-nowrap flex items-center gap-1.5 ${
                          selectedCategory === cat
                            ? 'bg-green-600 text-white border-green-600 shadow-md shadow-green-200'
                            : 'bg-white text-gray-500 border-gray-200 hover:border-green-400 hover:text-green-600'
                        }`}
                      >
                        <span>{cat === 'SEMUA' ? 'SEMUA KATEGORI' : cat.toUpperCase()}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          selectedCategory === cat ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Stock filter + Sort selector + count */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex bg-gray-100 p-1 rounded-xl">
                    {(['all', 'instock', 'outstock'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setStockFilter(f)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${
                          stockFilter === f
                            ? f === 'all' ? 'bg-white text-gray-900 shadow-sm'
                              : f === 'instock' ? 'bg-white text-green-600 shadow-sm'
                              : 'bg-white text-red-600 shadow-sm'
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        {f === 'all' ? 'Semua' : f === 'instock' ? '✓ Ready' : '✗ Habis'}
                      </button>
                    ))}
                  </div>

                  {/* Urutan Produk: Baru Laku / Baru Update / A-Z */}
                  <div className="flex items-center">
                    <select
                      value={productSort}
                      onChange={e => setProductSort(e.target.value as any)}
                      className="bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-xl px-2.5 py-1.5 shadow-2xs outline-none hover:border-green-400 focus:border-green-600 cursor-pointer"
                      title="Urutkan Tampilan Produk"
                    >
                      <option value="recent_sold">🔥 Baru Laku</option>
                      <option value="recent_update">⏱ Baru Update</option>
                      <option value="name">🔤 Nama (A-Z)</option>
                    </select>
                  </div>

                  {(selectedCategory !== 'SEMUA' || stockFilter !== 'all' || searchQuery) && (
                    <button
                      onClick={() => { setSelectedCategory('SEMUA'); setStockFilter('all'); setSearchQuery(''); }}
                      className="p-2 text-red-400 hover:text-red-600 transition-colors"
                      title="Reset Filter"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}

                  <span className="text-xs font-bold text-gray-400 shrink-0 ml-auto">
                    {isFetchingProducts ? 'Memuat...' : `${filteredProducts.length} produk`}
                  </span>
                </div>
              </div>
            </div>
            <CameraBarcodeScannerModal
              isOpen={showScanner}
              onClose={() => setShowScanner(false)}
              title="Scan Barcode Kasir"
              description="Arahkan kamera ke barcode produk untuk masuk transaksi kasir"
              onScan={handleScan}
            />

            {/* Product Skeleton or Grid */}
            {isFetchingProducts && products.length === 0 ? (
              <div className={
                viewMode === 'dense'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5'
                  : viewMode === 'grid'
                  ? 'grid grid-cols-2 md:grid-cols-4 gap-3'
                  : 'flex flex-col gap-2'
              }>
                {Array.from({ length: viewMode === 'dense' ? 18 : viewMode === 'grid' ? 12 : 6 }).map((_, i) => (
                  viewMode === 'dense' ? (
                    <div key={i} className="bg-white rounded-xl border border-gray-100 p-2.5 animate-pulse flex items-center justify-between">
                      <div className="space-y-1.5 flex-1">
                        <div className="h-3 bg-gray-100 rounded w-2/3" />
                        <div className="h-2 bg-gray-50 rounded w-1/3" />
                      </div>
                      <div className="h-4 bg-green-50 rounded w-16" />
                    </div>
                  ) : (
                    <div key={i} className={`bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse ${
                      viewMode === 'grid' ? 'flex flex-col p-3' : 'flex flex-row items-center p-3 gap-4'
                    }`}>
                      <div className={`bg-gray-100 rounded-xl ${
                        viewMode === 'grid' ? 'w-full aspect-square mb-3' : 'w-14 h-14 shrink-0'
                      }`} />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-gray-100 rounded-full w-3/4" />
                        <div className="h-4 bg-green-50 rounded-full w-1/2" />
                        <div className="h-2 bg-gray-100 rounded-full w-1/3" />
                      </div>
                    </div>
                  )
                ))}
              </div>
            ) : (
              <div
                className={
                  viewMode === 'dense'
                    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 overflow-y-auto pr-1"
                    : viewMode === 'grid'
                    ? "grid grid-cols-2 md:grid-cols-4 gap-3 overflow-y-auto pr-1"
                    : "flex flex-col gap-2 overflow-y-auto pr-1"
                }
                style={{ maxHeight: 'calc(100vh - 240px)' }}
                data-testid="product-grid-view"
              >
              {filteredProducts.slice(0, displayLimit).map(p => {
                const childVariants = variantsByParentId.get(p.id) || [];
                const isParentGroup = Boolean(p.isParentOnly || childVariants.length > 0);
                const isVariant = Boolean(p.parentId);

                if (viewMode === 'dense') {
                  return (
                    <div
                      key={p.id}
                      onClick={() => addToCart(p)}
                      className={`bg-white border rounded-xl px-3 py-2 flex items-center justify-between gap-3 shadow-2xs hover:border-green-500 hover:shadow-sm cursor-pointer transition-all active:scale-[0.99] ${
                        p.isParentOnly
                          ? 'border-violet-200 bg-violet-50/20 hover:border-violet-500'
                          : (p.stock || 0) <= 0
                          ? 'border-red-200 bg-red-50/30'
                          : 'border-gray-100 hover:bg-green-50/20'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isVariant && (
                            <span className="text-[9px] font-bold text-violet-700 bg-violet-50 border border-violet-100 px-1 rounded shrink-0">
                              ↳
                            </span>
                          )}
                          {isParentGroup && (
                            <span className="text-[9px] font-black text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded flex items-center gap-0.5 shrink-0">
                              <Layers size={9} /> {childVariants.length} Varian
                            </span>
                          )}
                          <span className="text-xs font-bold text-gray-800 truncate block">
                            {formatProductName(p.name)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400 font-medium">
                          <span>{p.displayUnit || p.unit}</span>
                          <span>•</span>
                          <span className={(p.stock || 0) <= 0 ? 'text-red-500 font-bold' : (p.stock || 0) < 10 ? 'text-amber-600 font-bold' : 'text-gray-500'}>
                            {(p.stock || 0) <= 0 ? 'Habis' : `Stok: ${p.stock}`}
                          </span>
                          {p.barcode && <span className="hidden sm:inline font-mono text-[9px] text-gray-300">[{p.barcode}]</span>}
                          {p.priceTiers && p.priceTiers.length > 0 && (
                            <span className="text-[9px] font-black text-purple-600 bg-purple-50 px-1 rounded">
                              Grosir
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        {p.isParentOnly ? (
                          <span className="text-[11px] font-bold text-violet-600 flex items-center gap-1">
                            <Layers size={11} /> Pilih Varian
                          </span>
                        ) : (
                          <div>
                            <div className="text-xs sm:text-sm font-black text-green-700">
                              Rp{(p.displayPrice || p.price).toLocaleString()}
                            </div>
                            {(p.units || []).filter(u => u.contains && Number(u.contains) > 1).length > 0 && (
                              <div className="flex items-center justify-end gap-1 mt-0.5" onClick={e => e.stopPropagation()}>
                                {(p.units || []).filter(u => u.contains && Number(u.contains) > 1).slice(0, 2).map(u => (
                                  <button
                                    key={u.code}
                                    onClick={() => addToCartWithUnit(p, u)}
                                    className="text-[9px] font-black text-blue-600 bg-blue-50 hover:bg-blue-100 px-1 py-0.5 rounded border border-blue-100 transition-colors"
                                    title={`Tambah ${u.code}`}
                                  >
                                    +{u.code}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                <div 
                  key={p.id} 
                  onClick={() => addToCart(p)}
                  className={`bg-white border shadow-sm hover:border-green-500 hover:shadow-md transition-all text-left flex relative cursor-pointer active:scale-95 ${
                    viewMode === 'grid' ? 'flex-col p-3 rounded-2xl' : 'flex-row items-center p-2 rounded-xl gap-4'
                  } ${
                    p.isParentOnly
                      ? 'border-violet-200 bg-violet-50/20 hover:border-violet-500'
                      : (p.stock || 0) <= 0
                      ? 'border-red-200 bg-red-50/30'
                      : 'border-gray-100'
                  }`}
                >
                  {isParentGroup ? (
                    <div className="absolute top-2 left-2 bg-violet-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full z-10 shadow-xs flex items-center gap-1">
                      <Layers size={10} />
                      <span>{childVariants.length > 0 ? `${childVariants.length} Varian` : 'Pilih Varian'}</span>
                    </div>
                  ) : (p.stock || 0) <= 0 && (
                    <div className="absolute top-2 right-2 bg-red-600 text-white text-xs font-black px-2 py-1 rounded-full z-10">STOK HABIS</div>
                  )}
                  <div className={`${viewMode === 'grid' ? 'w-full aspect-square mb-3' : 'w-14 h-14'} bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center text-gray-300 relative`}>
                   {p.image ? (
                    <img 
                      src={p.image} 
                      alt={p.name}
                      className={`w-full h-full object-cover ${(p.stock || 0) <= 0 && !p.isParentOnly ? 'grayscale' : ''}`}
                      loading="lazy"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : isParentGroup ? <Layers size={24} className="text-violet-400" /> : p.barcode ? <Barcode size={24} /> : <Package size={24} />}
                </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      {isVariant && (
                        <span className="text-[9px] font-bold text-violet-700 bg-violet-50 border border-violet-100 px-1.5 py-0.2 rounded">
                          ↳ Varian
                        </span>
                      )}
                      {p.isParentOnly && (
                        <span className="text-[9px] font-black text-violet-800 bg-violet-100 border border-violet-200 px-1.5 py-0.2 rounded">
                          Induk (Non-Order)
                        </span>
                      )}
                    </div>
                    <h3 className="text-xs font-bold text-gray-800 line-clamp-2 leading-snug">{formatProductName(p.name)}</h3>
                    {p.isParentOnly ? (
                      <p className="text-violet-700 font-bold text-xs flex items-center gap-1 mt-1">
                        <Layers size={11} />
                        <span>Klik untuk pilih varian</span>
                      </p>
                    ) : (
                      <p className="text-green-600 font-black text-sm flex items-center gap-1">
                        <span>Rp{(p.displayPrice || p.price).toLocaleString()}</span>
                        {p.hideBaseUnit && p.displayUnit && (
                          <span className="text-[10px] font-black px-1 py-0.5 rounded bg-blue-100 text-blue-700 uppercase">
                            /{p.displayUnit}
                          </span>
                        )}
                      </p>
                    )}
                    <div className="mt-1 flex items-center justify-between flex-wrap gap-y-1">
                      {p.isParentOnly ? (
                        <span className="text-[11px] font-semibold text-gray-500">
                          Total {childVariants.length} varian produk
                        </span>
                      ) : p.hideBaseUnit ? (
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                          📦 Minimal {p.displayUnit || 'Kemasan'} (Ecer Nonaktif)
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-gray-400">{p.unit}</span>
                      )}
                      {!p.isParentOnly && (
                        <span className={`text-xs font-bold ${(p.stock || 0) < 10 ? 'text-red-500' : 'text-gray-400'}`}>
                          {p.hideBaseUnit && p.displayUnit ? (
                            (() => {
                              const uObj = (p.units || []).find(u => u.code === p.displayUnit);
                              const c = Number(uObj?.contains || 1);
                              const st = Math.floor((p.stock || 0) / (c > 0 ? c : 1));
                              return `${st} ${p.displayUnit} (${p.stock} ${p.unit})`;
                            })()
                          ) : (
                            `Stok: ${p.stock}`
                          )}
                        </span>
                      )}
                    </div>
                    {!p.isParentOnly && (p.units || []).filter(u => {
                      if (p.hideBaseUnit && u.code === p.unit) return false;
                      return u.contains && Number(u.contains) > 1;
                    }).map(u => {
                      const contains = Number(u.contains);
                      const unitStock = Math.floor((p.stock || 0) / contains);
                      const channel = getChannelKey(transactionType);
                      let unitPrice = Number(u.price || (p.price * contains));
                      const chPrice = (p.channelPricing as ChannelPricing)?.[channel]?.[u.code]?.price;
                      if (typeof chPrice === 'number' && !Number.isNaN(chPrice)) {
                        unitPrice = chPrice;
                      } else if ((channel === 'shopee' || channel === 'tiktok') && (p.channelPricing as ChannelPricing)?.['website']?.[u.code]?.price) {
                        unitPrice = (p.channelPricing as ChannelPricing)['website']![u.code].price!;
                      }
                      return (
                        <div 
                          key={u.code} 
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCartWithUnit(p, u);
                          }}
                          className={`flex items-center justify-between mt-1 gap-1 p-1 rounded-lg cursor-pointer transition-colors ${
                            p.hideBaseUnit && p.displayUnit === u.code
                              ? 'bg-blue-50/80 border border-blue-200 hover:bg-blue-100/70'
                              : 'hover:bg-blue-50/50'
                          }`}
                        >
                          <span className="text-xs font-bold text-blue-600 shrink-0">
                            {u.code} <span className="text-gray-400 font-medium text-[10px]">Isi {contains} {p.unit}</span>
                          </span>
                          <span className="text-xs font-black text-gray-700">Rp{unitPrice.toLocaleString()}</span>
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded shrink-0 ${unitStock <= 0 ? 'bg-red-50 text-red-500' : 'bg-blue-100 text-blue-700'}`}>
                            {unitStock} {u.code}
                          </span>
                        </div>
                      );
                    })}

                  </div>
                </div>
              );
            })}

              {filteredProducts.length === 0 && !isFetchingProducts && (
                <div className={viewMode === 'dense' ? "col-span-1 sm:col-span-2 lg:col-span-3 py-20 text-center" : viewMode === 'grid' ? "col-span-2 md:col-span-4 py-20 text-center" : "py-20 text-center"}>
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Package size={32} className="text-gray-300" />
                  </div>
                  <p className="text-sm font-bold text-gray-400">Tidak ada produk yang cocok</p>
                  <p className="text-xs text-gray-300 mt-1">
                    {selectedCategory !== 'SEMUA' ? `Kategori: ${selectedCategory}` : ''}
                    {stockFilter !== 'all' ? ` · Stok: ${stockFilter}` : ''}
                    {searchQuery ? ` · "${searchQuery}"` : ''}
                  </p>
                  {(selectedCategory !== 'SEMUA' || stockFilter !== 'all' || searchQuery) && (
                    <button
                      onClick={() => { setSelectedCategory('SEMUA'); setStockFilter('all'); setSearchQuery(''); }}
                      className="mt-4 px-4 py-2 bg-green-600 text-white text-xs font-black rounded-xl hover:bg-green-700 transition-all"
                    >
                      Reset Filter
                    </button>
                  )}
                </div>
              )}

              {filteredProducts.length > displayLimit && (
                <div className={viewMode === 'dense' ? "col-span-1 sm:col-span-2 lg:col-span-3 py-4 text-center" : viewMode === 'grid' ? "col-span-2 md:col-span-4 py-4 text-center" : "py-4 text-center"}>
                  <button
                    onClick={() => setDisplayLimit(prev => prev + 80)}
                    className="px-6 py-2.5 bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 text-xs font-black uppercase tracking-wider rounded-2xl shadow-sm transition-all hover:scale-105 active:scale-95 flex items-center gap-2 mx-auto"
                  >
                    <span>Muat {Math.min(80, filteredProducts.length - displayLimit)} Produk Berikutnya</span>
                    <span className="bg-green-600 text-white px-2 py-0.5 rounded-full text-[10px]">
                      {displayLimit}/{filteredProducts.length}
                    </span>
                  </button>
                </div>
              )}
            </div>
            )}
          </div>

          {/* Desktop Sidebar / Mobile Floating Drawer */}
          <div className={`col-span-12 xl:col-span-4 flex flex-col gap-3 transition-all duration-300 xl:sticky xl:top-16 xl:max-h-[calc(100vh-4.75rem)] ${
            isMobileCartOpen 
              ? 'fixed inset-0 z-[60] bg-gray-50 p-4 md:p-8 overflow-y-auto animate-in slide-in-from-bottom flex' 
              : 'hidden xl:flex'
          }`}>
            {isMobileCartOpen && (
              <div className="xl:hidden flex items-center justify-between mb-2">
                <button onClick={() => setIsMobileCartOpen(false)} className="flex items-center gap-2 text-gray-500 font-bold text-xs uppercase">
                  <X size={18} /> Kembali ke List Produk
                </button>
                <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase">Cart Mode</div>
              </div>
            )}
            
            <div className={`p-3 rounded-2xl text-white font-black text-center text-xs tracking-widest flex items-center justify-center gap-2 shadow-sm shrink-0 ${transactionType === 'toko' ? 'bg-green-600' : (transactionType === 'online' ? 'bg-blue-600' : (transactionType === 'shopee' ? 'bg-orange-500' : 'bg-black'))} ${transactionType !== 'toko' ? 'animate-pulse' : ''}`}>
              {transactionType === 'toko' && <><CheckCircle size={14} /> MODE TRANSAKSI TOKO</>}

              {transactionType === 'online' && <><Truck size={14} /> MODE PESANAN ONLINE</>}
              {transactionType === 'shopee' && <><Package size={14} /> MODE SHOPEE</>}
              {transactionType === 'tiktok' && <><ShoppingBag size={14} /> MODE TIKTOK</>}
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col overflow-hidden flex-1 min-h-0">
              <div className="p-3.5 md:p-4 border-b flex items-center justify-between bg-gray-50/50 shrink-0">
                <div className="flex items-center gap-2">
                  <ShoppingCart size={18} className={transactionType === 'online' ? 'text-blue-600' : 'text-green-600'} />
                  <h2 className="font-black text-xs uppercase tracking-widest text-gray-700">Keranjang</h2>
                  {heldCarts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowHeldModal(true)}
                      className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-full text-[10px] font-black animate-pulse transition-all cursor-pointer"
                      title="Lihat transaksi yang ditahan"
                    >
                      {heldCarts.length} Ditahan
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {cart.length > 0 && (
                    <button
                      type="button"
                      onClick={handleHoldCart}
                      className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 transition-all"
                      title="Tahan transaksi saat ini [F4]"
                    >
                      <PauseCircle size={12} />
                      <span className="hidden sm:inline">Tahan</span> [F4]
                    </button>
                  )}
                  <select
                    value={transactionType}
                    onChange={(e) => setTransactionType(e.target.value as 'toko' | 'online' | 'shopee' | 'tiktok')}
                    className="text-xs font-bold bg-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-300 outline-none cursor-pointer"
                  >
                    <option value="toko">OFFLINE</option>
                    <option value="online">WEBSITE</option>
                    <option value="shopee">SHOPEE</option>
                    <option value="tiktok">TIKTOK</option>
                  </select>
                  <button
                    onClick={() => {
                      if (cart.length > 0 && window.confirm('Kosongkan keranjang belanja kasir?')) {
                        setCart([]);
                        try { localStorage.removeItem('pos-cart'); } catch {}
                      }
                    }}
                    title="Kosongkan Keranjang [ESC]"
                    className="p-1 text-red-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Selector Tarif Pelanggan: Eceran / Semi-Grosir (Warung) / Grosir (Partai) */}
              <div className="px-4 pt-2.5 pb-1">
                <div className="grid grid-cols-3 gap-1 p-1 bg-gray-100 rounded-xl text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerPriceTier('Retail');
                      setCart(prev => prev.map(item => {
                        const prod = products.find(p => p.id === item.id);
                        if (!prod) return item;
                        const mult = Number(item.contains || 1);
                        return {
                          ...item,
                          price: prod.price * mult,
                          originalPrice: prod.price * mult,
                          appliedTier: 'Retail',
                        };
                      }));
                      toast.success('Tarif: Eceran (Umum)');
                    }}
                    className={`py-1.5 px-1 rounded-lg text-center transition-all ${
                      customerPriceTier === 'Retail'
                        ? 'bg-white text-gray-900 shadow-xs font-black'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    👤 Eceran
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerPriceTier('Semi-Grosir');
                      setCart(prev => prev.map(item => {
                        const prod = products.find(p => p.id === item.id);
                        if (!prod) return item;
                        const mult = Number(item.contains || 1);
                        const tierResult = resolveCustomerUnitPrice({
                          baseEcer: prod.price,
                          priceSemiGrosir: prod.priceSemiGrosir,
                          priceGrosir: prod.priceGrosir,
                          customerType: 'Semi-Grosir',
                          contains: mult,
                        });
                        return {
                          ...item,
                          price: tierResult.effectivePrice,
                          originalPrice: prod.price * mult,
                          appliedTier: 'Semi-Grosir',
                        };
                      }));
                      toast.success('Tarif: Semi-Grosir (Warung)');
                    }}
                    className={`py-1.5 px-1 rounded-lg text-center transition-all ${
                      customerPriceTier === 'Semi-Grosir'
                        ? 'bg-emerald-600 text-white shadow-xs font-black'
                        : 'text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    🏪 Warung
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerPriceTier('Grosir');
                      setCart(prev => prev.map(item => {
                        const prod = products.find(p => p.id === item.id);
                        if (!prod) return item;
                        const mult = Number(item.contains || 1);
                        const tierResult = resolveCustomerUnitPrice({
                          baseEcer: prod.price,
                          priceSemiGrosir: prod.priceSemiGrosir,
                          priceGrosir: prod.priceGrosir,
                          customerType: 'Grosir',
                          contains: mult,
                        });
                        return {
                          ...item,
                          price: tierResult.effectivePrice,
                          originalPrice: prod.price * mult,
                          appliedTier: 'Grosir',
                        };
                      }));
                      toast.success('Tarif: Grosir (Partai)');
                    }}
                    className={`py-1.5 px-1 rounded-lg text-center transition-all ${
                      customerPriceTier === 'Grosir'
                        ? 'bg-purple-600 text-white shadow-xs font-black'
                        : 'text-purple-700 hover:bg-purple-50'
                    }`}
                  >
                    📦 Partai
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3" data-testid="cart-items-container">
                {cart.map(item => (
                  <div key={item.id} className="flex flex-col gap-2 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                        <p className="text-xs font-bold text-gray-800 leading-snug">{formatProductName(item.name)}</p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-gray-400">
                            {item.unit}{item.contains && item.contains > 1 ? ` · Isi ${item.contains}` : ''}
                          </span>
                          {item.appliedTier && item.appliedTier !== 'Retail' && (
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                              item.appliedTier === 'Grosir' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
                            }`}>{item.appliedTier}</span>
                          )}
                          {item.originalPrice > item.price && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                              Hemat Rp{((item.originalPrice - item.price) * item.quantity).toLocaleString('id-ID')}
                            </span>
                          )}
                        </div>
                      </div>
                      {editingPriceId === item.id ? (
                        <div className="flex flex-col items-end">
                          <input
                            autoFocus
                            type="number"
                            className={`w-28 p-1 text-xs font-black text-right border rounded outline-none focus:ring-2 ${
                              item.cost > 0 && (parseFloat(editPriceValue) || 0) / (item.quantity || 1) < item.cost
                                ? 'border-red-400 bg-red-50 text-red-700 focus:ring-red-400'
                                : 'focus:ring-green-500'
                            }`}
                            value={editPriceValue}
                            onChange={(e) => setEditPriceValue(e.target.value)}
                            onBlur={() => updatePrice(item.id, parseFloat(editPriceValue) || 0, item.quantity)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') updatePrice(item.id, parseFloat(editPriceValue) || 0, item.quantity);
                            }}
                          />
                          {item.cost > 0 && (parseFloat(editPriceValue) || 0) / (item.quantity || 1) < item.cost && (
                            <span className="text-[9px] font-black text-red-600 bg-red-100/90 px-1 py-0.5 rounded mt-0.5 shadow-2xs">
                              ⚠️ Di bawah Modal! (HPP Rp{item.cost.toLocaleString('id-ID')})
                            </span>
                          )}
                        </div>
                      ) : (
                        <div 
                          onClick={() => {
                            setEditingPriceId(item.id);
                            setEditPriceValue((item.price * item.quantity).toString());
                          }}
                          className="flex items-center gap-1 cursor-pointer group text-right"
                        >
                          <Edit size={10} className="text-gray-300 group-hover:text-green-600" />
                          <div>
                            {item.originalPrice > item.price && (
                              <p className="text-[10px] line-through text-gray-400">
                                Rp{(item.originalPrice * item.quantity).toLocaleString()}
                              </p>
                            )}
                            <p className="text-xs font-black text-green-600">
                              Rp{(item.price * item.quantity).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const prod = products.find(p => p.id === item.id);
                            const u = prod?.units?.find(u => u.code === item.unit);
                            const minQty = Number(u?.minQty || 0);
                            const next = item.quantity - 1;
                            if (minQty && next > 0 && next < minQty) {
                              toast.error(`Min. qty untuk ${item.unit} adalah ${minQty}`);
                              updateQuantity(item.id, minQty);
                            } else {
                              updateQuantity(item.id, next);
                            }
                          }}
                          className="p-1 bg-white border rounded-lg"
                        ><Minus size={12} /></button>
                        <input 
                          type="number" 
                          step="any"
                          min="0.001"
                          className="w-12 text-center text-xs font-black bg-white rounded border border-gray-200 outline-none p-0.5 appearance-none focus:border-green-500"
                          value={item.quantity} 
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val) && val > 0) {
                              const prod = products.find(p => p.id === item.id);
                              const u = prod?.units?.find(u => u.code === item.unit);
                              const minQty = Number(u?.minQty || 0);
                              if (minQty && val < minQty) {
                                toast.error(`Min. qty untuk ${item.unit} adalah ${minQty}`);
                                updateQuantity(item.id, minQty);
                              } else {
                                updateQuantity(item.id, val);
                              }
                            }
                          }}
                        />
                        <button
                          onClick={() => {
                            const next = item.quantity + 1;
                            updateQuantity(item.id, next);
                          }}
                          className="p-1 bg-white border rounded-lg"
                        ><Plus size={12} /></button>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={item.unit}
                          onChange={(e) => {
                            const prod = products.find(p => p.id === item.id);
                            const code = e.target.value;
                            const u = prod?.units?.find(u => u.code === code) || { code, contains: code === 'PCS' ? 1 : 0, price: 0 };
                            const contains = Number(u.contains || (code === 'PCS' ? 1 : 0));
                            const channel = getChannelKey(transactionType);
                            let unitPrice = Number(u.price || (contains > 0 ? (prod?.price || 0) * contains : (prod?.price || 0)));
                            const chPrice = (prod?.channelPricing as ChannelPricing)?.[channel]?.[code]?.price;

                            if (typeof chPrice === 'number' && !Number.isNaN(chPrice)) {
                              unitPrice = chPrice;
                            } else if ((channel === 'shopee' || channel === 'tiktok') && (prod?.channelPricing as ChannelPricing)?.['website']?.[code]?.price) {
                              unitPrice = (prod?.channelPricing as ChannelPricing)['website']![code].price!;
                            }
                            const minQty = Number(u.minQty || 0);
                            const unitCost = (prod?.cost || 0) * contains;
                            const unitOriginalPrice = (prod?.price || 0) * contains;
                            setCart(prev => prev.map(ci => {
                              if (ci.id !== item.id) return ci;
                              const nextQty = minQty && ci.quantity < minQty ? minQty : ci.quantity;
                              if (minQty && ci.quantity < minQty) toast.success(`Min. qty ${code}: ${minQty}. Qty disesuaikan.`);
                              return { ...ci, unit: code, contains, price: unitPrice, originalPrice: unitOriginalPrice, cost: unitCost, quantity: nextQty, channel };
                            }));
                          }}
                          className="text-xs font-bold text-gray-600 bg-white border rounded-lg px-2 py-1"
                        >
                          {(products.find(p => p.id === item.id)?.units || [{ code: 'PCS', contains: 1 }]).map(u => (
                            <option key={u.code} value={u.code}>
                              {u.code}{u.contains && u.contains > 1 ? ` (Isi ${u.contains})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 md:p-5 bg-white border-t space-y-3 shrink-0">

                <div className="grid grid-cols-3 md:grid-cols-5 gap-1.5">
                  {['CASH', 'QRIS', 'TRANSFER', 'TEMPO', 'DOMPET'].map(m => (
                    <button
                      key={m}
                      onClick={() => {
                        if (m === 'QRIS') {
                          // Buka modal QRIS — generate referenceNo unik
                          const ref = `POS-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
                          setQrisReferenceNo(ref);
                          setPaymentMethod('QRIS');
                          setShowQrisModal(true);
                        } else {
                          setPaymentMethod(m);
                        }
                      }}
                      className={`p-3 rounded-xl text-xs font-black uppercase transition-all border-2 ${
                        paymentMethod === m
                          ? m === 'QRIS'
                            ? 'bg-blue-50 text-blue-600 border-blue-300'
                            : 'bg-green-50 text-green-600 border-green-200'
                          : 'bg-gray-50 border-transparent hover:border-gray-200'
                      }`}
                    >
                      {m === 'QRIS' ? '⚡ QRIS' : m}
                    </button>
                  ))}
                </div>

                {paymentMethod === 'DOMPET' ? (
                  <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100 space-y-3 relative">
                     <p className="text-xs font-black text-blue-600 uppercase flex items-center gap-2">
                       Pembayaran Dompet
                     </p>
                     <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setSelectedCustomer(null); // Reset on new search
                      }}
                      placeholder="Cari Nama/No.HP Pelanggan..."
                      className="w-full p-2 text-xs border rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    {customerResults.length > 0 && !selectedCustomer && (
                      <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-lg z-10 mt-1 max-h-48 overflow-y-auto">
                        {customerResults.map(c => (
                          <div
                            key={c.id}
                            onClick={() => {
                              setSelectedCustomer({id: c.id, name: c.name, walletBalance: c.walletBalance || 0, customerType: c.customerType});
                              setCustomerSearch(c.name);
                              setCustomerResults([]);
                            }}
                            className="p-3 hover:bg-gray-100 cursor-pointer text-xs"
                          >
                            <p className="font-bold">{c.name}</p>
                            <p className="text-gray-500">{c.phone} - Saldo: Rp{(c.walletBalance || 0).toLocaleString()} · {c.customerType || 'Retail'}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedCustomer && (
                      <div className="mt-2 p-3 bg-blue-100 border border-blue-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-blue-800">{selectedCustomer.name}</p>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            selectedCustomer.customerType === 'Grosir' ? 'bg-purple-200 text-purple-800' :
                            selectedCustomer.customerType === 'Semi-Grosir' ? 'bg-amber-200 text-amber-800' :
                            'bg-emerald-200 text-emerald-800'
                          }`}>{selectedCustomer.customerType || 'Retail'}</span>
                        </div>
                        <p className="text-lg font-black text-blue-800 mt-1">Rp{selectedCustomer.walletBalance.toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                ) : paymentMethod === 'CASH' ? (
                  <div className="bg-gray-50 p-3 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-gray-400 uppercase">Bayar Tunai</label>
                      <button
                        type="button"
                        onClick={() => setCashGiven(String(total))}
                        className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-2xs"
                      >
                        ⚡ Uang Pas [F3] (Rp{total.toLocaleString('id-ID')})
                      </button>
                    </div>
                    <input 
                      type="number" 
                      value={cashGiven} 
                      onChange={e => setCashGiven(e.target.value)} 
                      className="w-full bg-white p-2.5 rounded-xl border border-gray-200 font-black text-lg outline-none focus:border-emerald-500" 
                      placeholder="0" 
                    />
                    
                    {/* Quick Cash Presets */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {[10000, 20000, 50000, 100000, 200000].map(nominal => (
                        <button
                          key={nominal}
                          type="button"
                          onClick={() => setCashGiven(String(nominal))}
                          className={`px-2.5 py-1 border text-[10px] font-black rounded-lg transition-colors ${
                            cashGiven === String(nominal)
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                              : 'bg-white border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 text-gray-700'
                          }`}
                        >
                          Rp{nominal >= 1000 ? `${nominal / 1000}k` : nominal}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          const roundedUp50k = Math.ceil(total / 50000) * 50000;
                          setCashGiven(String(roundedUp50k));
                        }}
                        className="px-2.5 py-1 bg-white border border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 text-[10px] font-black rounded-lg transition-colors text-emerald-700"
                      >
                        Bulatkan 50k
                      </button>
                    </div>

                    {change >= 0 && (
                      <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-500">Kembalian:</span>
                        <span className="text-sm font-black text-emerald-700">Rp{change.toLocaleString('id-ID')}</span>
                      </div>
                    )}
                  </div>
                ) : paymentMethod === 'TEMPO' ? (
                   <div className="bg-orange-50 p-3 rounded-2xl border border-orange-100 space-y-3">
                     <p className="text-xs font-black text-orange-600 uppercase flex items-center gap-2">
                       <History size={14}/> Pembayaran Tempo
                     </p>
                     <p className="text-xs text-gray-500">Transaksi ini akan dicatat sebagai piutang pelanggan.</p>
                     
                     <div className="space-y-2">
                       <div>
                         <label className="text-xs font-bold text-gray-500 uppercase">Nama Pelanggan</label>
                         <input 
                           type="text" 
                           value={customerName} 
                           onChange={e => setCustomerName(e.target.value)} 
                           className="w-full p-2 text-xs border rounded-lg outline-none focus:ring-1 focus:ring-orange-500"
                           placeholder="Masukkan nama..."
                         />
                       </div>
                       <div>
                         <label className="text-xs font-bold text-gray-500 uppercase">No. HP / WA</label>
                         <input 
                           type="tel" 
                           value={customerPhone} 
                           onChange={e => setCustomerPhone(e.target.value)} 
                           className="w-full p-2 text-xs border rounded-lg outline-none focus:ring-1 focus:ring-orange-500"
                           placeholder="08..."
                         />
                       </div>
                       <div>
                         <label className="text-xs font-bold text-gray-500 uppercase">Jatuh Tempo</label>
                         <input 
                           type="date" 
                           value={tempoDueDate} 
                           onChange={e => setTempoDueDate(e.target.value)} 
                           className="w-full p-2 text-xs border rounded-lg outline-none focus:ring-1 focus:ring-orange-500"
                         />
                       </div>
                     </div>
                   </div>
                ) : (
                  <div className="space-y-1">
                    <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-2xl h-24 bg-gray-50 cursor-pointer overflow-hidden relative">
                      {proofPreview ? (
                        <img 
                          src={proofPreview} 
                          alt="Bukti Transfer"
                          className="w-full h-full object-cover"
                        />
                      ) : <><Upload size={20} className="text-gray-300" /><span className="text-xs font-black text-gray-400 mt-1 uppercase">Upload Bukti</span></>}
                      <input type="file" className="hidden" accept="image/*" onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) { setPaymentProof(file); setProofPreview(URL.createObjectURL(file)); }
                      }} />
                    </label>
                    <p className="text-xs text-center text-gray-400 font-bold uppercase">Auto-Compress to 200KB</p>
                  </div>
                )}

                {cartSavings > 0 && (
                  <div className="flex justify-between items-center py-1.5 px-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                    <span className="font-bold flex items-center gap-1">🎉 Hemat Belanja Grosir:</span>
                    <span className="font-black">-Rp{cartSavings.toLocaleString('id-ID')}</span>
                  </div>
                )}

                <div className="flex justify-between items-center py-2 border-t border-gray-100">
                  <div>
                    <span className="text-xs font-black text-gray-400 uppercase">Total Belanja</span>
                    {cart.length > 0 && <p className="text-xs text-gray-400">{cart.reduce((s, i) => s + i.quantity, 0)} item · {cart.length} produk</p>}
                  </div>
                  <span className={`text-2xl font-black ${transactionType === 'online' ? 'text-blue-600' : 'text-green-600'}`}>Rp{total.toLocaleString()}</span>
                </div>

                <button
                  disabled={isProcessing || cart.length === 0}
                  onClick={handleTransaction}
                  className={`w-full py-4 rounded-2xl font-black uppercase text-sm text-white shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ${transactionType === 'online' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' : 'bg-green-600 hover:bg-green-700 shadow-green-200'
                    }`}
                >
                  {isProcessing ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Memproses Transaksi...</span>
                    </div>
                  ) : <><Printer size={16} /> {transactionType === 'online' ? 'Simpan Pesanan Online' : 'Selesaikan Transaksi [F2]'}</>}
                </button>
              </div>
            </div>
          </div>
        </main>
      ) : (
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Header + Filters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <h2 className="font-black text-xl text-gray-800 flex items-center gap-2">
                <History size={22} /> Riwayat Transaksi
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="date"
                  value={orderDateFilter}
                  onChange={e => setOrderDateFilter(e.target.value)}
                  className="px-3 py-2 text-xs font-bold border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 bg-white"
                />
                {orderDateFilter && (
                  <button
                    onClick={() => setOrderDateFilter('')}
                    className="p-2 text-red-400 hover:text-red-600 transition-colors"
                    title="Reset tanggal"
                  >
                    <X size={14} />
                  </button>
                )}
                <span className="text-xs font-bold text-gray-400 bg-white px-3 py-2 rounded-xl border border-gray-100">
                  {completedOrders.filter(o => {
                    if (!orderDateFilter) return true;
                    const d = o.createdAt ? new Date(o.createdAt as any) : null;
                    return d && d.toISOString().startsWith(orderDateFilter);
                  }).length} order
                </span>
              </div>
            </div>

            {/* Summary bar */}
            {completedOrders.length > 0 && (() => {
              const filtered = completedOrders.filter(o => {
                if (!orderDateFilter) return true;
                const d = o.createdAt ? new Date(o.createdAt as any) : null;
                return d && d.toISOString().startsWith(orderDateFilter);
              });
              const totalRevenue = filtered.reduce((s, o) => s + (o.total || 0), 0);
              const cashCount = filtered.filter(o => o.paymentMethod === 'CASH').length;
              const nonCashCount = filtered.length - cashCount;
              return (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Total Omzet', value: `Rp${totalRevenue.toLocaleString('id-ID')}`, color: 'text-green-600', bg: 'bg-green-50' },
                    { label: 'Tunai', value: `${cashCount} transaksi`, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Non-Tunai', value: `${nonCashCount} transaksi`, color: 'text-purple-600', bg: 'bg-purple-50' },
                  ].map(s => (
                    <div key={s.label} className={`${s.bg} rounded-2xl p-3 text-center`}>
                      <p className={`text-sm font-black ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-gray-500 font-bold mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              );
            })()}

            {completedOrders.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border border-gray-100 shadow-sm text-center">
                <div className="w-16 h-16 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <History size={32} />
                </div>
                <h3 className="text-base font-bold text-gray-800">Belum Ada Riwayat Transaksi</h3>
                <p className="text-xs text-gray-400 mt-1">Transaksi yang sudah diselesaikan akan muncul di sini.</p>
              </div>
            ) : (
              completedOrders.filter(o => {
                if (!orderDateFilter) return true;
                const d = o.createdAt ? new Date(o.createdAt as any) : null;
                return d && d.toISOString().startsWith(orderDateFilter);
              }).map(order => (
                <div key={order.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex gap-3 items-center min-w-0">
                      <div className={`p-2.5 rounded-xl shrink-0 ${
                        order.status === 'BELUM_LUNAS' ? 'bg-orange-50 text-orange-600'
                        : order.transactionType === 'online' ? 'bg-blue-50 text-blue-600' 
                        : 'bg-green-50 text-green-600'
                      }`}>
                        <CheckCircle size={20} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-black text-gray-800 uppercase">{order.receiptNo || (order.dailySeq ? `#${String(order.dailySeq).padStart(4, '0')}` : `#${order.id.slice(-8)}`)}</p>
                          {order.status === 'BELUM_LUNAS' && (
                            <span className="text-[10px] bg-orange-100 text-orange-700 font-black px-1.5 py-0.5 rounded-full uppercase">Tempo</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 truncate">
                          {order.customerName !== 'Pelanggan Toko' ? order.customerName + ' · ' : ''}
                          {order.createdAt
                            ? new Date(order.createdAt as any).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                            : '-'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-black text-green-600">Rp{(order.total || 0).toLocaleString('id-ID')}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">{order.paymentMethod}</p>
                      </div>
                      <button onClick={() => handleSendWhatsApp(order)} title="Kirim Struk via WhatsApp" className="p-2 hover:bg-emerald-50 rounded-xl text-gray-400 hover:text-emerald-600 transition-colors">
                        <MessageCircle size={16} />
                      </button>
                      <button onClick={() => printReceipt(order)} title="Cetak Struk" className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 transition-colors">
                        <Printer size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>

      )}

      {isDrawerOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsDrawerOpen(false)} />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b flex justify-between items-center bg-blue-600 text-white">
              <h2 className="font-black uppercase tracking-widest flex items-center gap-2"><ShoppingCart /> Pesanan Masuk</h2>
              <button onClick={() => setIsDrawerOpen(false)}><X /></button>
            </div>
            <div className="p-4 overflow-y-auto h-full pb-20 space-y-4">
              {recentOrders.map(o => (
                <div key={o.id} className="bg-gray-50 border rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-black text-xs uppercase">{o.customerName}</p>
                      <p className="text-xs font-bold text-gray-400">{o.customerPhone}</p>
                    </div>
                    <span className="bg-red-100 text-red-600 text-xs font-black px-2 py-1 rounded uppercase">Masuk</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t">
                    <p className="font-black text-blue-600 text-sm">Rp{o.total?.toLocaleString()}</p>
                    <div className="flex gap-2">
                      {o.customerPhone && (
                        <button
                          type="button"
                          onClick={() => {
                            const cleanPhone = (o.customerPhone || '').replace(/\D/g, '').replace(/^0/, '62');
                            const itemLines = (o.items || []).map((it: any) => `• ${it.quantity}x ${it.name} = Rp${(Number(it.price || 0) * Number(it.quantity || 1)).toLocaleString('id-ID')}`).join('\n');
                            const waMsg = `Halo Kak *${o.customerName || 'Pelanggan'}*,\nBerikut rincian pesanan dari *ATAYATOKO*:\n\n${itemLines}\n\n*Total: Rp${Number(o.total || 0).toLocaleString('id-ID')}*\nStatus: ${o.status || 'Masuk'}\n\nTerima kasih telah berbelanja di ATAYATOKO!\natayatoko.aty0.com`;
                            window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMsg)}`, '_blank');
                          }}
                          className="p-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                          title="Kirim Nota via WhatsApp"
                        >
                          <MessageSquare size={16} />
                        </button>
                      )}
                      <button onClick={async () => {
                        try {
                          await sbUpdateDoc('orders', o.id, { status: 'DIPROSES' });
                          toast.success('Order Diproses');
                        } catch (error) {
                          console.error('Error updating order:', error);
                          toast.error('Gagal memproses order');
                        }
                      }} className="bg-blue-600 text-white text-xs font-black px-4 py-2 rounded-lg uppercase">Proses</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SHIFT MODALS */}
      {showShiftModal === 'open' && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 px-6 py-5 text-white">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                  <ShoppingBag size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-black">Buka Kasir</h2>
                  <p className="text-green-100 text-xs">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>
              <p className="text-green-100 text-xs mt-2 bg-white/10 rounded-lg px-3 py-2">
                ⏰ {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} — Masukkan uang yang ada di laci sebagai modal awal shift.
              </p>
            </div>
            {/* Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                  <User size={13} className="text-green-600" /> Nama Kasir (Yang Buka)
                </label>
                <input 
                  type="text"
                  value={shiftInput.cashierName}
                  onChange={e => setShiftInput({ ...shiftInput, cashierName: e.target.value })}
                  className="w-full p-3 text-sm font-bold border-2 border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-gray-50/50"
                  placeholder="Contoh: Siti / Budi / Kasir 1"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">💰 Modal Awal (Uang di Laci)</label>
                <input 
                  type="number" 
                  value={shiftInput.initialCash}
                  onChange={e => setShiftInput({ ...shiftInput, initialCash: e.target.value })}
                  onKeyDown={e => e.key === 'Enter' && handleOpenShift()}
                  className="w-full p-3 text-2xl font-black border-2 rounded-xl outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-center tabular-nums"
                  placeholder="0"
                />
                {shiftInput.initialCash && (
                  <p className="text-center text-green-600 font-bold text-sm mt-1">
                    Rp{parseInt(shiftInput.initialCash || '0').toLocaleString('id-ID')}
                  </p>
                )}
              </div>
              <button 
                onClick={handleOpenShift} 
                disabled={loading || !shiftInput.cashierName?.trim()}
                className="w-full py-3.5 bg-green-600 text-white font-black rounded-xl hover:bg-green-700 active:scale-95 transition-all uppercase text-sm shadow-lg shadow-green-200 disabled:opacity-60"
              >
                {loading ? 'Membuka...' : '🟢 MULAI SHIFT'}
              </button>
              <p className="text-center text-xs text-gray-400">Data shift tersimpan otomatis di sistem</p>
            </div>
          </div>
        </div>
      )}

      {showShiftModal === 'close' && shiftSummary && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-br from-red-500 to-rose-600 px-6 py-4 text-white">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                  <CheckCircle size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-black">Tutup Kasir</h2>
                  <p className="text-red-100 text-xs">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })} · {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-green-50 border border-green-100 rounded-xl p-2.5 text-center">
                  <p className="text-xs text-green-600 font-bold uppercase">Tunai</p>
                  <p className="text-sm font-black text-green-700">Rp{shiftSummary.totalCash.toLocaleString()}</p>
                  <p className="text-[10px] text-green-500">{shiftSummary.cashTransactions}x transaksi</p>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-2.5 text-center">
                  <p className="text-xs text-blue-600 font-bold uppercase">Non-Tunai</p>
                  <p className="text-sm font-black text-blue-700">Rp{shiftSummary.totalNonCash.toLocaleString()}</p>
                  <p className="text-[10px] text-blue-500">{shiftSummary.nonCashTransactions}x transaksi</p>
                </div>
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-2.5 text-center">
                  <p className="text-xs text-purple-600 font-bold uppercase">Total</p>
                  <p className="text-sm font-black text-purple-700">Rp{(shiftSummary.totalCash + shiftSummary.totalNonCash).toLocaleString()}</p>
                  <p className="text-[10px] text-purple-500">{shiftSummary.totalTransactions}x transaksi</p>
                </div>
              </div>

              {/* Breakdown Non-Cash */}
              {shiftSummary.totalNonCash > 0 && (
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-xs space-y-1">
                  <p className="font-bold text-gray-500 uppercase text-[10px] mb-1.5">Detail Non-Tunai</p>
                  {shiftSummary.qrisSales > 0 && <div className="flex justify-between"><span className="text-gray-500">📱 QRIS</span><span className="font-bold">Rp{shiftSummary.qrisSales.toLocaleString()}</span></div>}
                  {shiftSummary.transferSales > 0 && <div className="flex justify-between"><span className="text-gray-500">🏦 Transfer</span><span className="font-bold">Rp{shiftSummary.transferSales.toLocaleString()}</span></div>}
                  {shiftSummary.tempoSales > 0 && <div className="flex justify-between"><span className="text-gray-500">📋 Tempo/Piutang</span><span className="font-bold text-orange-600">Rp{shiftSummary.tempoSales.toLocaleString()}</span></div>}
                  {shiftSummary.walletSales > 0 && <div className="flex justify-between"><span className="text-gray-500">👛 Wallet</span><span className="font-bold">Rp{shiftSummary.walletSales.toLocaleString()}</span></div>}
                </div>
              )}

              {/* Rekonsiliasi Laci */}
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-1.5">
                <p className="font-bold text-gray-500 uppercase text-[10px] mb-1.5">🗄️ Rekonsiliasi Laci</p>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Modal Awal</span>
                  <span className="font-bold">Rp{(currentShift?.initialCash || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">+ Penjualan Tunai</span>
                  <span className="font-bold text-green-600">Rp{shiftSummary.totalCash.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs font-black border-t border-dashed border-gray-200 pt-1.5 mt-1">
                  <span>Harusnya di Laci</span>
                  <span>Rp{shiftSummary.expected.toLocaleString()}</span>
                </div>
              </div>

              {/* Input Hitung Fisik */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">💵 Hitung Fisik Uang di Laci</label>
                <input 
                  autoFocus
                  type="number" 
                  value={shiftInput.actualCash}
                  onChange={e => setShiftInput({ ...shiftInput, actualCash: e.target.value })}
                  onKeyDown={e => e.key === 'Enter' && handleCloseShift()}
                  className="w-full p-3 text-2xl font-black border-2 rounded-xl outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 text-center tabular-nums"
                  placeholder="0"
                />
              </div>
              
              {shiftInput.actualCash && (() => {
                const actual = parseInt(shiftInput.actualCash.replace(/\D/g, '')) || 0;
                const diff = actual - shiftSummary.expected;
                const isBalance = diff === 0;
                const isMore = diff > 0;
                return (
                  <div className={`rounded-xl p-3 text-center border-2 ${
                    isBalance ? 'bg-green-50 border-green-200' : isMore ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'
                  }`}>
                    <p className={`text-xs uppercase font-bold mb-0.5 ${
                      isBalance ? 'text-green-600' : isMore ? 'text-blue-600' : 'text-red-600'
                    }`}>{isBalance ? '✅ Balance' : isMore ? '🔵 Kelebihan' : '🔴 Kekurangan'}</p>
                    <p className={`text-lg font-black ${
                      isBalance ? 'text-green-700' : isMore ? 'text-blue-700' : 'text-red-700'
                    }`}>{isBalance ? 'Rp0' : `${diff > 0 ? '+' : ''}Rp${Math.abs(diff).toLocaleString()}`}</p>
                  </div>
                );
              })()}

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">📝 Catatan (Opsional)</label>
                <textarea 
                  value={shiftInput.notes}
                  onChange={e => setShiftInput({ ...shiftInput, notes: e.target.value })}
                  className="w-full p-2.5 text-sm border-2 rounded-xl outline-none focus:ring-2 focus:ring-gray-300 resize-none"
                  placeholder="Catatan tambahan untuk admin..."
                  rows={2}
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button 
                  onClick={() => setShowShiftModal(null)} 
                  className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 text-xs uppercase"
                >
                  Batal
                </button>
                <button 
                  onClick={handleCloseShift} 
                  disabled={loading || !shiftInput.actualCash}
                  className="flex-2 flex-grow-[2] py-3 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 active:scale-95 transition-all text-xs uppercase shadow-lg shadow-red-200 disabled:opacity-60"
                >
                  {loading ? 'Memproses...' : '🖨️ TUTUP & CETAK LAPORAN'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Floating Cart Button */}
      {!isMobileCartOpen && cart.length > 0 && activeTab === 'pos' && (
        <button 
          onClick={() => setIsMobileCartOpen(true)}
          className="xl:hidden fixed bottom-28 right-6 z-50 bg-green-600 text-white px-6 py-4 rounded-[2rem] shadow-2xl flex items-center gap-3 active:scale-95 transition-all animate-in slide-in-from-right duration-500"
        >
          <div className="relative">
            <ShoppingCart size={24} />
            <span className="absolute -top-3 -right-3 bg-red-600 text-white text-xs w-6 h-6 flex items-center justify-center rounded-full border-2 border-white font-black">{cart.reduce((s, i) => s + i.quantity, 0)}</span>
          </div>
          <div className="text-left">
            <p className="text-xs font-bold text-green-100 uppercase leading-none mb-1">Total Bayar</p>
            <p className="text-sm font-black leading-none">Rp{total.toLocaleString()}</p>
          </div>
        </button>
      )}

      {/* ADMIN CHAT MODAL */}

      {showChatModal && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowChatModal(false)}>
          <div className="bg-white w-full max-w-6xl h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
             <AdminChatInterface onClose={() => setShowChatModal(false)} isModal={true} />
          </div>
        </div>
      )}

      {/* ===== SETTINGS MODAL ===== */}
      {showSettings && (
        <div
          className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center">
                  <Settings size={20} />
                </div>
                <div>
                  <h2 className="text-base font-black text-gray-800 uppercase tracking-tight">Pengaturan Kasir</h2>
                  <p className="text-xs text-gray-400">Preferensi tersimpan otomatis</p>
                </div>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-5">

              {/* ── Scan Mode ── */}
              <div>
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Mode Scanner Kamera</p>
                <div className="grid grid-cols-2 gap-3">
                  {/* Langsung */}
                  <button
                    onClick={() => {
                      setScanMode('direct');
                      localStorage.setItem('pos-scan-mode', 'direct');
                    }}
                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                      scanMode === 'direct'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${scanMode === 'direct' ? 'bg-green-500 text-white' : 'bg-gray-200'}`}>
                      <Zap size={20} />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-black uppercase">Langsung</p>
                      <p className="text-[10px] mt-0.5 leading-tight opacity-70">Scan → otomatis masuk keranjang</p>
                    </div>
                    {scanMode === 'direct' && (
                      <span className="text-[10px] bg-green-500 text-white px-2 py-0.5 rounded-full font-bold">AKTIF</span>
                    )}
                  </button>

                  {/* Konfirmasi */}
                  <button
                    onClick={() => {
                      setScanMode('confirm');
                      localStorage.setItem('pos-scan-mode', 'confirm');
                    }}
                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                      scanMode === 'confirm'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${scanMode === 'confirm' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
                      <ScanLine size={20} />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-black uppercase">Konfirmasi</p>
                      <p className="text-[10px] mt-0.5 leading-tight opacity-70">Tampilkan info produk dulu</p>
                    </div>
                    {scanMode === 'confirm' && (
                      <span className="text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full font-bold">AKTIF</span>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-2 text-center">
                  {scanMode === 'direct'
                    ? '⚡ Scan kamera langsung tambah ke keranjang tanpa jeda'
                    : '🔍 Scan kamera akan tampilkan nama produk dahulu sebelum masuk keranjang'}
                </p>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-100" />

              {/* ── Gudang Pengambilan Stok ── */}
              <div>
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Package size={13} className="text-emerald-600" />
                  Gudang Pengambilan Stok
                </p>
                <select
                  value={selectedWarehouse}
                  onChange={(e) => setSelectedWarehouse(e.target.value)}
                  className="w-full text-sm font-bold text-slate-800 bg-gray-50 border border-slate-200 rounded-2xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                >
                  <option value="auto">⚡ Otomatis (Prioritas Toko / Gudang Utama)</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      🏢 {w.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400 mt-2 text-center">
                  {selectedWarehouse === 'auto' ? '⚡ Stok diambil otomatis sesuai prioritas waterfall' : `🏢 Stok selalu diambil dari gudang terpilih`}
                </p>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-100" />

              {/* ── Bluetooth Printer ── */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500">
                    <Printer size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">Printer Bluetooth</p>
                    <p className="text-xs text-gray-400">{useBluetoothPrinter ? 'Printer thermal BT aktif' : 'Mode cetak browser (default)'}</p>
                  </div>
                </div>
                <button
                  onClick={() => setUseBluetoothPrinter(v => !v)}
                  className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${useBluetoothPrinter ? 'bg-green-500' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${useBluetoothPrinter ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-100" />

              {/* ── Ukuran Kertas Struk (58mm vs 80mm) ── */}
              <div>
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Ukuran Kertas Struk</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => updatePrintSettings({ paperWidth: '58mm' })}
                    className={`py-2 px-3 rounded-xl border text-xs font-black transition-all ${
                      printSettings.paperWidth === '58mm'
                        ? 'border-green-500 bg-green-50 text-green-700 shadow-xs'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    📄 58 mm (Standar)
                  </button>
                  <button
                    type="button"
                    onClick={() => updatePrintSettings({ paperWidth: '80mm' })}
                    className={`py-2 px-3 rounded-xl border text-xs font-black transition-all ${
                      printSettings.paperWidth === '80mm'
                        ? 'border-green-500 bg-green-50 text-green-700 shadow-xs'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    📑 80 mm (Lebar)
                  </button>
                </div>
              </div>

              {/* ── Eco Thermal Print (Hemat Kertas) ── */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-800">Eco Thermal Print</p>
                  <p className="text-xs text-gray-400">Kurangi spasi kosong agar hemat roll kertas</p>
                </div>
                <button
                  type="button"
                  onClick={() => updatePrintSettings({ ecoMode: !printSettings.ecoMode })}
                  className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${printSettings.ecoMode ? 'bg-green-500' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${printSettings.ecoMode ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {/* ── Pesan Promosi di Footer Struk ── */}
              <div>
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5">Pesan Promosi Footer Struk</p>
                <input
                  type="text"
                  value={printSettings.footerPromo}
                  onChange={(e) => updatePrintSettings({ footerPromo: e.target.value })}
                  placeholder="Contoh: Beli 3 DUS Diskon Ekstra! WA: 085853161174"
                  className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>

              {/* ── Customer Facing Display Shortcut ── */}
              <div>
                <button
                  type="button"
                  onClick={() => window.open('/cashier/display', '_blank', 'width=1024,height=768')}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  <Monitor size={15} />
                  <span>Buka Layar Pembeli (/cashier/display)</span>
                </button>
              </div>

            </div>

            <div className="px-6 pb-6">
              <button
                onClick={() => setShowSettings(false)}
                className="w-full py-3 bg-gray-900 text-white font-black rounded-2xl hover:bg-gray-700 transition-all text-sm uppercase tracking-widest"
              >
                Simpan & Tutup
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ── MODAL RETUR PENJUALAN CEPAT ── */}
      {showReturModal && (
        <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-5 border-b flex items-center justify-between bg-rose-50/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-100 text-rose-600 rounded-2xl">
                  <Undo2 size={22} />
                </div>
                <div>
                  <h3 className="font-black text-base text-gray-900 uppercase tracking-tight">Retur Penjualan Cepat</h3>
                  <p className="text-xs text-gray-500">Cari nomor struk atau ID transaksi untuk memproses retur</p>
                </div>
              </div>
              <button onClick={() => setShowReturModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {/* Search Box */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={returSearch}
                    onChange={(e) => setReturSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchReturOrder()}
                    placeholder="Masukkan No. Struk (misal: 261121-0001) / ID..."
                    className="w-full text-xs font-bold pl-9 pr-3 py-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <Search size={16} className="absolute left-3 top-3 text-gray-400" />
                </div>
                <button
                  type="button"
                  onClick={handleSearchReturOrder}
                  disabled={returLoading}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase transition-all disabled:opacity-60"
                >
                  {returLoading ? 'Mencari...' : 'Cari Struk'}
                </button>
              </div>

              {/* Order Info & Items to Return */}
              {returOrder && (
                <div className="space-y-4 pt-2 border-t border-gray-100">
                  <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-black text-gray-800">
                        No: {returOrder.raw_data?.receiptNo || `#${returOrder.id.slice(-8)}`}
                      </p>
                      <p className="text-gray-500 text-[11px]">
                        Pelanggan: {returOrder.raw_data?.customerName || returOrder.customer_name || 'Umum'} • {returOrder.raw_data?.paymentMethod || 'CASH'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-400 text-[10px] uppercase font-bold">Total Transaksi</p>
                      <p className="text-sm font-black text-gray-900">Rp{Number(returOrder.total || 0).toLocaleString('id-ID')}</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-black text-gray-700 uppercase tracking-wider block mb-2">
                      Pilih Item & Jumlah yang Diretur:
                    </label>
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {(Array.isArray(returOrder.items) ? returOrder.items : (returOrder.raw_data?.items || [])).map((it: any) => {
                        const curQty = Number(returQuantities[it.id] || 0);
                        const maxQty = Number(it.quantity || 1);
                        return (
                          <div key={it.id} className="p-3 bg-white border border-gray-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-gray-800 truncate">{formatProductName(it.name)}</p>
                              <p className="text-[11px] text-gray-400">
                                Beli: {maxQty} {it.unit || 'PCS'} @Rp{Number(it.price || 0).toLocaleString('id-ID')}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => setReturQuantities(prev => ({ ...prev, [it.id]: Math.max(0, curQty - 1) }))}
                                className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="0"
                                max={maxQty}
                                step="any"
                                value={curQty}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setReturQuantities(prev => ({ ...prev, [it.id]: Math.min(maxQty, Math.max(0, val)) }));
                                }}
                                className="w-12 text-center text-xs font-black border rounded-lg py-1"
                              />
                              <button
                                type="button"
                                onClick={() => setReturQuantities(prev => ({ ...prev, [it.id]: Math.min(maxQty, curQty + 1) }))}
                                className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Return Options */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">Metode Pengembalian Uang</label>
                      <select
                        value={returRefundMethod}
                        onChange={(e) => setReturRefundMethod(e.target.value as any)}
                        className="w-full text-xs font-bold p-2 bg-gray-50 border rounded-xl outline-none"
                      >
                        <option value="CASH">💵 Uang Tunai (Cash)</option>
                        <option value="DOMPET">💳 Saldo Dompet Pelanggan</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">Alasan Retur</label>
                      <input
                        type="text"
                        value={returReason}
                        onChange={(e) => setReturReason(e.target.value)}
                        placeholder="Alasan retur..."
                        className="w-full text-xs font-medium p-2 bg-gray-50 border rounded-xl outline-none"
                      />
                    </div>
                  </div>

                  {/* Total Refund Summary */}
                  {(() => {
                    const items = Array.isArray(returOrder.items) ? returOrder.items : (returOrder.raw_data?.items || []);
                    const totalRefund = items.reduce((sum: number, it: any) => sum + (Number(it.price || 0) * Number(returQuantities[it.id] || 0)), 0);
                    return (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between">
                        <span className="text-xs font-bold text-rose-800">Total Nilai Retur / Refund:</span>
                        <span className="text-base font-black text-rose-600">Rp{totalRefund.toLocaleString('id-ID')}</span>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-gray-50 flex gap-2">
              <button
                type="button"
                onClick={() => setShowReturModal(false)}
                className="flex-1 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-xs font-bold uppercase"
              >
                Tutup
              </button>
              {returOrder && (
                <button
                  type="button"
                  onClick={handleExecuteRetur}
                  disabled={isSubmittingRetur}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase shadow-md shadow-rose-200 transition-all disabled:opacity-60"
                >
                  {isSubmittingRetur ? 'Memproses...' : 'Konfirmasi Retur & Kembalikan Stok'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── QRIS MPM Dinamis Modal ── */}
      {showQrisModal && qrisReferenceNo && (
        <QrisPaymentModal
          total={total}
          referenceNo={qrisReferenceNo}
          description={`Kasir - ${cart.length} item`}
          autoDetect={true}
          onClose={() => {
            setShowQrisModal(false);
            qrisConfirmedRef.current = false;
            setQrisConfirmed(false);
          }}
          onPaid={() => {
            qrisConfirmedRef.current = true;
            setQrisConfirmed(true);
            setShowQrisModal(false);
            handleTransaction();
          }}
        />
      )}

      {/* ── Modal Transaksi Ditahan (Hold & Recall) ── */}
      {showHeldModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b flex items-center justify-between bg-amber-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                  <PauseCircle size={20} />
                </div>
                <div>
                  <h3 className="font-black text-sm uppercase text-gray-800 tracking-tight">
                    Transaksi Ditahan (Pending)
                  </h3>
                  <p className="text-xs text-gray-400 font-medium">
                    {heldCarts.length} transaksi sedang menunggu
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHeldModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3">
              {heldCarts.length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                  <PauseCircle size={36} className="mx-auto mb-2 text-gray-300" />
                  <p className="text-xs font-bold">Tidak ada transaksi yang ditahan saat ini.</p>
                </div>
              ) : (
                heldCarts.map((hold, idx) => (
                  <div
                    key={hold.id}
                    className="p-3.5 bg-gray-50 hover:bg-amber-50/40 rounded-2xl border border-gray-200/70 transition-all flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          #{idx + 1} · {hold.transactionType.toUpperCase()}
                        </span>
                        <span className="text-[11px] font-medium text-gray-400">
                          {new Date(hold.heldAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-gray-800 truncate">
                        {hold.customerName ? `Pelanggan: ${hold.customerName}` : 'Pelanggan Umum'}
                      </p>
                      <p className="text-[11px] font-medium text-gray-500 mt-0.5">
                        {hold.items.reduce((s, i) => s + i.quantity, 0)} item · <strong className="text-emerald-600 font-black">Rp{hold.total.toLocaleString('id-ID')}</strong> ({hold.paymentMethod})
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRecallCart(hold)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-sm transition-all active:scale-95"
                      >
                        <PlayCircle size={13} />
                        <span>Lanjutkan</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteHeldCart(hold.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                        title="Hapus Transaksi Ini"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t flex justify-end">
              <button
                type="button"
                onClick={() => setShowHeldModal(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-xs font-bold transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Pilih Varian Produk (Induk Pengelompokan) ── */}
      {variantPickerParent && (
        <div
          className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setVariantPickerParent(null)}
        >
          <div
            className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="p-4 sm:p-5 border-b border-gray-100 bg-gradient-to-r from-violet-50 to-indigo-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-violet-600 text-white flex items-center justify-center shadow-sm shrink-0">
                  <Layers size={20} />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-black uppercase text-violet-600 tracking-wider flex items-center gap-1">
                    <span>PILIH VARIAN PRODUK</span>
                    {variantPickerParent.isParentOnly && (
                      <span className="bg-violet-100 text-violet-800 px-1.5 py-0.2 rounded text-[9px]">
                        Induk Pengelompok
                      </span>
                    )}
                  </span>
                  <h3 className="text-sm font-black text-gray-900 truncate">
                    {variantPickerParent.name}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setVariantPickerParent(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-white rounded-xl transition-colors shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* List Varian */}
            <div className="p-3 sm:p-4 overflow-y-auto space-y-2">
              {(variantsByParentId.get(variantPickerParent.id) || []).length === 0 ? (
                <div className="py-10 text-center text-xs text-gray-400">
                  <Layers size={32} className="text-gray-300 mx-auto mb-2" />
                  <p className="font-bold">Belum ada anak varian yang terhubung</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Hubungkan varian ke produk ini melalui menu Admin Produk.</p>
                </div>
              ) : (
                (variantsByParentId.get(variantPickerParent.id) || []).map((v) => {
                  const isOutOfStock = (v.stock || 0) <= 0;
                  return (
                    <div
                      key={v.id}
                      onClick={() => {
                        if (isOutOfStock) {
                          toast.error(`Stok "${v.name}" habis!`);
                          return;
                        }
                        addToCart(v);
                        setVariantPickerParent(null);
                        toast.success(`✅ Ditambahkan: ${v.name}`);
                      }}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                        isOutOfStock
                          ? 'bg-gray-50 border-gray-200 opacity-60'
                          : 'bg-white hover:bg-emerald-50/60 hover:border-emerald-300 border-gray-200/80 shadow-2xs active:scale-[0.99]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <CornerDownRight size={13} className="text-violet-500 shrink-0" />
                          <span className="text-xs font-black text-gray-900">
                            {v.name}
                          </span>
                          {v.sku && (
                            <span className="text-[10px] font-mono text-gray-400">
                              #{v.sku}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2.5 mt-1 text-xs pl-4 flex-wrap">
                          <span className="font-black text-emerald-600">
                            Rp{(v.displayPrice || v.price).toLocaleString('id-ID')}
                            {v.hideBaseUnit && v.displayUnit && (
                              <span className="text-[10px] font-normal text-gray-500">/{v.displayUnit}</span>
                            )}
                          </span>
                          <span className={`text-[11px] font-semibold ${isOutOfStock ? 'text-red-500 font-bold' : 'text-gray-500'}`}>
                            Stok: <strong className={isOutOfStock ? 'text-red-600' : 'text-gray-800'}>{v.stock}</strong> {v.unit}
                          </span>
                          {v.barcode && (
                            <span className="font-mono bg-gray-100 text-[10px] px-1 py-0.2 rounded text-gray-500">
                              {v.barcode}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isOutOfStock}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-gray-200 disabled:text-gray-400 shadow-xs shrink-0 flex items-center gap-1"
                      >
                        <Plus size={13} />
                        <span>Pilih</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Modal */}
            <div className="p-3 sm:p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>Klik salah satu varian untuk menambah ke transaksi kasir</span>
              <button
                type="button"
                onClick={() => setVariantPickerParent(null)}
                className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-bold transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

