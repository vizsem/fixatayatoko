'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';

import { useRouter } from 'next/navigation';
import {
  Package, ShoppingCart, Search, Plus, Minus, Printer, Bell,
  MessageSquare, Truck, CheckCircle, Upload, Barcode,
  History, X, Trash2, LayoutGrid, List, Edit, ShoppingBag, Camera
} from 'lucide-react';
import imageCompression from 'browser-image-compression'; // TAMBAHAN: Library Kompresi
import toast from 'react-hot-toast';
import CameraBarcodeScannerModal from '@/components/scanner/CameraBarcodeScannerModal';
import { playScanBeep } from '@/lib/sound';
import { simpanTransaksiKasir } from '@/lib/actions/cashier.actions';
import { printToThermal, generateESCReceipt } from '@/lib/printer';
import AdminChatInterface from '@/components/AdminChatInterface';
import { supabase } from '@/lib/supabase';
import logger from '@/lib/logger';
import { getUserAndRole } from '@/lib/supabase-helpers';

import { uploadToSupabase } from '@/lib/supabase';
import { sbGetDoc, sbInsertDoc, sbUpdateDoc } from '@/lib/supabase-helpers';
import { timestampId, uniqueFileName } from '@/lib/ids';
import { collection, db, onSnapshot, query, where } from '@/lib/firebase';
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
  price: number; // base unit price (ecer)
  cost: number; // base unit cost (modal)
  unit: string; // base unit code
  stock: number;
  barcode?: string;
  image?: string;
  units?: UnitOption[];
  stockByWarehouse?: Record<string, number>;
  Kategori?: string;
  kategori?: string;
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
};

type Order = {
  id: string;
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
  const [activeTab, setActiveTab] = useState<'pos' | 'orders'>('pos');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [displayLimit, setDisplayLimit] = useState(80);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
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

  // State untuk Wallet
  const [selectedCustomer, setSelectedCustomer] = useState<{id: string, name: string, walletBalance: number} | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Array<{id: string, name: string, phone: string, walletBalance?: number}>>([]);

  // Shift States
  const [currentShift, setCurrentShift] = useState<CashierShift | null>(null);
  const [showShiftModal, setShowShiftModal] = useState<'open' | 'close' | null>(null);
  const [shiftInput, setShiftInput] = useState({ initialCash: '', actualCash: '', notes: '' });
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

  // Chat State
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);

  // No redundant state for calculated values

  // Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);

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
        const { data: supaProds, error } = await supabase
          .from('products')
          .select('id, name, price, stock, raw_data, unit, cost_price, barcode, image_url, is_active')
          .or(`barcode.eq.${cleanCode},raw_data->>Barcode.eq.${cleanCode}`)
          .limit(1);

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
          };
        }
      }

      if (!matchedProd) {
        toast.error('Barcode tidak ditemukan');
        return;
      }

      playScanBeep();
      setScannedProduct(matchedProd);
      toast.success(`Produk ditemukan: ${matchedProd.name}`);
      setShowScanner(false);
    } catch (err) {
      console.error('Scan error:', err);
      toast.error('Gagal membaca barcode');
    }
  }, [products]);

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

  const getChannelKey = useCallback((txType: string): ChannelKey => {
    if (txType === 'toko') return 'offline';
    if (txType === 'online') return 'website';
    if (txType === 'shopee') return 'shopee';
    if (txType === 'tiktok') return 'tiktok';
    return 'offline';
  }, []);

  const addToCart = useCallback((product: Product) => {
    if (product.stock <= 0) return toast.error("Stok habis!");
    
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

    setCart(prev => {
      const exist = prev.find(i => i.id === product.id && i.unit === baseCode);
      
      // Check stock limit
      if (exist) {
        if (exist.quantity + 1 > product.stock) {
          toast.error(`Stok tidak cukup! Sisa: ${product.stock}`);
          return prev;
        }
        return prev.map(i => i.id === product.id && i.unit === baseCode ? { ...i, quantity: i.quantity + 1 } : i);
      }

      return [...prev, { 
        id: product.id, 
        name: product.name, 
        price: priceToUse, 
        originalPrice: product.price, // Store base price
        cost: product.cost, // Include base cost
        quantity: 1, 
        unit: baseCode, 
        contains: containsBase, 
        channel 
      }];
    });
  }, [transactionType, getChannelKey]);

  const addToCartWithUnit = useCallback((product: Product, unit: UnitOption) => {
    // Check basic stock availability
    if (product.stock <= 0) return toast.error("Stok habis!");

    const code = (unit.code || product.unit || 'PCS').toUpperCase();
    const contains = Number(unit.contains || (code === 'PCS' ? 1 : 0));
    
    // Check if adding this unit exceeds stock
    // Since we don't know the exact current quantity of this unit in cart yet (inside set state), 
    // we do a preliminary check. Real check happens inside setCart.
    if (contains > product.stock) return toast.error(`Stok tidak cukup untuk satuan ini! Butuh: ${contains}, Sisa: ${product.stock}`);

    const channel = getChannelKey(transactionType);
    
    let unitPrice = Number(unit.price || (contains > 0 ? product.price * contains : product.price));
    const chPrice = (product.channelPricing as ChannelPricing)?.[channel]?.[code]?.price;

    if (typeof chPrice === 'number' && !Number.isNaN(chPrice)) {
      unitPrice = chPrice;
    } else if ((channel === 'shopee' || channel === 'tiktok') && (product.channelPricing as ChannelPricing)?.['website']?.[code]?.price) {
      // Fallback logic
      unitPrice = (product.channelPricing as ChannelPricing)['website']![code].price!;
    }

    // Calculate unit cost based on contains
    const unitCost = product.cost * contains;
    // Calculate unit original price based on contains (assuming price scales linearly)
    const unitOriginalPrice = product.price * contains;

    setCart(prev => {
      const exist = prev.find(i => i.id === product.id && i.unit === code);
      
      // Calculate total requested quantity in base units
      // Current quantity in cart (all units converted to base)
      const currentTotalQtyBase = prev
        .filter(i => i.id === product.id)
        .reduce((sum, i) => sum + (i.quantity * (i.contains || 1)), 0);
      
      const requestedQtyBase = contains; // Adding 1 of this unit = 'contains' base units

      if (currentTotalQtyBase + requestedQtyBase > product.stock) {
        toast.error(`Stok tidak cukup! Total di keranjang: ${currentTotalQtyBase}, Sisa Stok: ${product.stock}`);
        return prev;
      }

      if (exist) return prev.map(i => (i.id === product.id && i.unit === code) ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { 
        id: product.id, 
        name: product.name, 
        price: unitPrice, 
        originalPrice: unitOriginalPrice,
        cost: unitCost,
        quantity: 1, 
        unit: code, 
        contains, 
        channel 
      }];
    });
  }, [transactionType, getChannelKey]);

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

      return prev.map(i => i.id === id ? { ...i, quantity: q } : i);
    });
  }, [products]);

  const updatePrice = useCallback((id: string, newTotal: number, quantity: number) => {
    setCart(prev => prev.map(i => i.id === id ? { ...i, price: newTotal / quantity } : i));
    setEditingPriceId(null);
  }, []);

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + (item.price * item.quantity), 0), [cart]);

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
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Initial check
    setIsOffline(!navigator.onLine);

    const savedCart = localStorage.getItem('pos-cart');
    if (savedCart) setCart(JSON.parse(savedCart));

    const checkAuthAndShift = async () => {
      // Cek Supabase session (sumber utama auth)
      const { data: { user: supaUser } } = await supabase.auth.getUser();
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') { e.preventDefault(); searchInputRef.current?.focus(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
              .select('id, name, price, stock, raw_data, unit, cost_price, barcode, image_url, is_active')
              .order('name', { ascending: true })
              .range(from, to)
              .then(res => res.data || [])
          );
        }

        const pagesData = await Promise.all(promises);
        const rows = pagesData.flat();

        const p: Product[] = [];
        for (const d of rows) {
          const raw = d.raw_data || {};
          // Only show active products (exclude archived)
          const isArchived =
            d.is_active === false ||
            raw.isActive === false ||
            raw.isActive === 'false' ||
            raw.status === 'ARCHIVED' ||
            raw.Status === 1 ||
            raw.Status === '1';

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

          p.push({
            id: d.id,
            name: d.name || raw.name || raw.Nama || 'TANPA NAMA',
            price: basePrice,
            cost: baseCost,
            unit: baseUnit,
            stock: Number(d.stock ?? raw.stock ?? raw.Stok ?? 0),
            barcode: d.barcode || raw.barcode || raw.Barcode || '',
            image: (() => {
              const url = d.image_url || raw.image || raw.imageUrl || raw.URL_Produk || raw.Link_Foto || raw.photo || '';
              return url.trim().startsWith('http') ? url.trim() : '';
            })(),
            units,
            Kategori: raw.Kategori || raw.kategori || raw.category || 'UMUM',
            kategori: raw.Kategori || raw.kategori || raw.category || 'UMUM',
            stockByWarehouse: raw.stockByWarehouse || {},
            channelPricing: raw.channelPricing
          });
        }

        setProducts(p);
        setFilteredProducts(p);

        // Extract Categories
        const cats = Array.from(new Set(p.map(prod => prod.Kategori || prod.kategori || 'UMUM'))).filter(Boolean) as string[];
        setCategories(cats.sort());
      } catch (error) {
        console.error('Error fetching products:', error);
        toast.error('Gagal memuat produk. Silakan coba lagi.');
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
    };
  }, []);

  // Listen for Unread Chats (Admin)
  useEffect(() => {
    const q = query(collection(db, 'chats'), where('isReadByAdmin', '==', false));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setChatUnreadCount(snapshot.size);
    }, (error) => {
      logger.warn("Chat listener error (probably index missing):", error);
    });
    return () => unsubscribe();
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
    const filtered = products.filter(p => {
      const matchSearch = !term || 
        (p.name?.toLowerCase() || '').includes(term) || 
        (p.barcode?.toLowerCase() || '').includes(term);
      const matchCategory = selectedCategory === 'SEMUA' || (p.Kategori || p.kategori || 'UMUM') === selectedCategory;
      const matchStock = stockFilter === 'all' ? true : (stockFilter === 'instock' ? (p.stock || 0) > 0 : (p.stock || 0) <= 0);
      
      return matchSearch && matchCategory && matchStock;
    });
    setFilteredProducts(filtered);
    setDisplayLimit(80);

    const exactMatch = products.find(p => p.barcode && p.barcode === searchQuery.trim());
    if (exactMatch && searchQuery.length >= 3) {
      addToCart(exactMatch);
      setSearchQuery('');
    }
  }, [searchQuery, products, addToCart, selectedCategory, stockFilter]);

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
    if (!shiftInput.initialCash) return toast.error('Masukkan modal awal!');
    
    setLoading(true);
    try {
      const initial = parseInt(shiftInput.initialCash.replace(/\D/g, '')) || 0;
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const cashierId = authUser?.id || '';
      const cashierName = authUser?.user_metadata?.full_name || authUser?.email?.split('@')[0] || 'Cashier';
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
      setShiftInput({ initialCash: '', actualCash: '', notes: '' });
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
      setShiftInput({ initialCash: '', actualCash: '', notes: '' });
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
    if ((paymentMethod === 'QRIS' || paymentMethod === 'TRANSFER') && !paymentProof && !isOffline) return toast.error('Wajib upload bukti!');
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
      };

      // 1. Validasi kecukupan stok sebelum proses eksekusi
      for (const item of cart) {
        const contains = Number(item.contains || 1);
        const pcsToDeduct = item.quantity * contains;
        const localProduct = products.find(p => p.id === item.id);
        if (localProduct && localProduct.stock < pcsToDeduct) {
          setIsProcessing(false);
          return toast.error(`Stok ${item.name} tidak cukup! Tersedia: ${localProduct.stock}, Dibutuhkan: ${pcsToDeduct}`);
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
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
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
        return toast.error(
          isOffline
            ? 'Mode offline: transaksi TIDAK tersimpan (butuh koneksi). Sambungkan internet lalu ulangi.'
            : (simpan.error || 'Gagal menyimpan transaksi')
        );
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
    } catch (e) {
      console.error(e);
      toast.error('Gagal Transaksi');
    } finally { setIsProcessing(false); }
  };

  const printReceipt = useCallback(async (order: Partial<Order>) => {
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

    if (useBluetoothPrinter) {
      try {
        const escReceipt = generateESCReceipt(order);
        
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
            @page { size: 58mm auto; margin: 0; }
            body { 
              font-family: 'Courier New', monospace; 
              width: 58mm; 
              margin: 0; 
              padding: 4px; 
              font-size: 10px; 
              color: black; 
              line-height: 1.2;
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
          <div class="flex"><span>No : #${(order.id || '').slice(-6).toUpperCase()}</span></div>
          <div class="flex"><span>Ksr: ${cashierDisplayName}</span></div>
          <div class="flex"><span>Plg: ${order.customerName || 'Umum'}</span></div>
          
          <div class="line"></div>
          
          ${order.items?.map((i: CartItem) => `
            <div class="item-row">
              <div class="item-name">${i.name}</div>
              <div class="item-detail">
                <span>${i.quantity} x ${i.price.toLocaleString('id-ID')}</span>
                <span>${(i.price * i.quantity).toLocaleString('id-ID')}</span>
              </div>
            </div>
          `).join('')}
          
          <div class="line"></div>
          
          <div class="flex"><span>Subtotal</span><span>${formatRp(order.subtotal)}</span></div>
          ${(order.shippingCost || 0) > 0 ? `<div class="flex"><span>Ongkir</span><span>${formatRp(order.shippingCost)}</span></div>` : ''}
          
          <div class="flex bold" style="font-size: 12px; margin-top: 2px;">
            <span>TOTAL</span><span>${formatRp(order.total)}</span>
          </div>
          
          <div class="line"></div>
          
          <div class="flex">
            <span>Bayar (${order.paymentMethod})</span>
            <span>${formatRp(payAmount)}</span>
          </div>
          <div class="flex">
            <span>Kembali</span>
            <span>${formatRp(changeAmount)}</span>
          </div>
          
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
          {isOffline && (
            <div className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-xs font-bold animate-pulse flex items-center gap-2 shrink-0">
              <span className="w-2 h-2 bg-red-600 rounded-full"></span> OFFLINE MODE
            </div>
          )}
          <div className="flex bg-gray-100 rounded-lg p-1 shrink-0">
            <button onClick={() => setActiveTab('pos')} className={`px-3 md:px-4 py-1.5 rounded-md text-xs md:text-xs font-bold uppercase transition-all ${activeTab === 'pos' ? 'bg-white shadow text-green-600' : 'text-gray-400'}`}>Kasir</button>
            <button onClick={() => setActiveTab('orders')} className={`px-3 md:px-4 py-1.5 rounded-md text-xs md:text-xs font-bold uppercase transition-all ${activeTab === 'orders' ? 'bg-white shadow text-green-600' : 'text-gray-400'}`}>Riwayat Order</button>
          </div>
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
                  <div className="flex bg-gray-100 p-1 rounded-lg shrink-0">
                    <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white shadow text-green-600' : 'text-gray-400'}`}><LayoutGrid size={16} className="md:w-[18px] md:h-[18px]" /></button>
                    <button onClick={() => setViewMode('list')} className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white shadow text-green-600' : 'text-gray-400'}`}><List size={16} className="md:w-[18px] md:h-[18px]" /></button>
                  </div>
                </div>
              </div>

              {/* Advanced Filters */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                <select 
                  value={selectedCategory} 
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-white border border-gray-100 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-gray-500 outline-none focus:ring-2 focus:ring-green-500 shadow-sm min-w-[120px]"
                >
                  <option value="SEMUA">SEMUA KATEGORI</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                  ))}
                </select>

                <div className="flex bg-gray-100 p-1 rounded-xl">
                  <button 
                    onClick={() => setStockFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${stockFilter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    SEMUA STOK
                  </button>
                  <button 
                    onClick={() => setStockFilter('instock')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${stockFilter === 'instock' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    READY
                  </button>
                  <button 
                    onClick={() => setStockFilter('outstock')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${stockFilter === 'outstock' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    HABIS
                  </button>
                </div>

                {(selectedCategory !== 'SEMUA' || stockFilter !== 'all' || searchQuery) && (
                  <button 
                    onClick={() => {
                      setSelectedCategory('SEMUA');
                      setStockFilter('all');
                      setSearchQuery('');
                    }}
                    className="p-2 text-red-400 hover:text-red-600 transition-colors"
                    title="Reset Filter"
                  >
                    <Trash2 size={16} />
                  </button>
                )}

                <span className="text-xs font-bold text-gray-400 shrink-0 ml-auto">
                  {filteredProducts.length} Produk
                </span>
              </div>
            </div>
            <CameraBarcodeScannerModal
              isOpen={showScanner}
              onClose={() => setShowScanner(false)}
              title="Scan Barcode Kasir"
              description="Arahkan kamera ke barcode produk untuk masuk transaksi kasir"
              onScan={handleScan}
            />

            <div 
              className={viewMode === 'grid' ? "grid grid-cols-2 md:grid-cols-4 gap-3 overflow-y-auto pr-2" : "flex flex-col gap-2 overflow-y-auto pr-2"} 
              style={{ maxHeight: 'calc(100vh - 200px)' }}
              data-testid="product-grid-view"
            >
              {filteredProducts.slice(0, displayLimit).map(p => (
                <div 
                  key={p.id} 
                  onClick={() => addToCart(p)}
                  className={`bg-white border shadow-sm hover:border-green-500 hover:shadow-md transition-all text-left flex relative cursor-pointer active:scale-95 ${viewMode === 'grid' ? 'flex-col p-3 rounded-2xl' : 'flex-row items-center p-2 rounded-xl gap-4'} ${(p.stock || 0) <= 0 ? 'border-red-200 bg-red-50/30' : 'border-gray-100'}`}
                >
                  {(p.stock || 0) <= 0 && (
                    <div className="absolute top-2 right-2 bg-red-600 text-white text-xs font-black px-2 py-1 rounded-full z-10">STOK HABIS</div>
                  )}
                  <div className={`${viewMode === 'grid' ? 'w-full aspect-square mb-3' : 'w-14 h-14'} bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center text-gray-300 relative`}>
                   {p.image ? (
                    <img 
                      src={p.image} 
                      alt={p.name}
                      className={`w-full h-full object-cover ${(p.stock || 0) <= 0 ? 'grayscale' : ''}`}
                      loading="lazy"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : p.barcode ? <Barcode size={24} /> : <Package size={24} />}
                </div>
                  <div className="flex-1">
                    <h3 className="text-xs font-bold text-gray-800 line-clamp-2 uppercase">{p.name}</h3>
                    <p className="text-green-600 font-black text-sm">Rp{p.price.toLocaleString()}</p>
                    <div className="mt-1 flex items-center justify-between flex-wrap gap-y-1">
                      <span className="text-xs font-bold text-gray-400">{p.unit}</span>
                      <span className={`text-xs font-bold ${(p.stock || 0) < 10 ? 'text-red-500' : 'text-gray-400'}`}>Stok: {p.stock}</span>
                    </div>
                    {(p.units || []).filter(u => u.contains && Number(u.contains) > 1).map(u => {
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
                          className="flex items-center justify-between mt-0.5 gap-1 hover:bg-blue-50/50 p-0.5 rounded cursor-pointer transition-colors"
                        >
                          <span className="text-xs font-bold text-blue-400 shrink-0">{u.code} <span className="text-gray-300 font-medium">Isi {contains}</span></span>
                          <span className="text-xs font-black text-gray-600">Rp{unitPrice.toLocaleString()}</span>
                          <span className={`text-xs font-black px-1.5 py-0.5 rounded shrink-0 ${unitStock <= 0 ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-600'}`}>
                            {unitStock} {u.code}
                          </span>
                        </div>
                      );
                    })}

                  </div>
                </div>
              ))}

              {filteredProducts.length === 0 && (
                <div className={viewMode === 'grid' ? "col-span-2 md:col-span-4 py-16 text-center text-gray-400 font-bold" : "py-16 text-center text-gray-400 font-bold"}>
                  <Package size={40} className="mx-auto mb-2 text-gray-300" />
                  <p>Tidak ada produk aktif yang cocok</p>
                </div>
              )}

              {filteredProducts.length > displayLimit && (
                <div className={viewMode === 'grid' ? "col-span-2 md:col-span-4 py-4 text-center" : "py-4 text-center"}>
                  <button
                    onClick={() => setDisplayLimit(prev => prev + 80)}
                    className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-black uppercase tracking-wider rounded-2xl shadow-sm transition-all hover:scale-105 active:scale-95"
                  >
                    Muat Lebih Banyak ({displayLimit} dari {filteredProducts.length} Produk)
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Desktop Sidebar / Mobile Floating Drawer */}
          <div className={`col-span-12 xl:col-span-4 flex flex-col gap-4 transition-all duration-300 ${
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
            
            <div className={`p-4 rounded-2xl text-white font-black text-center text-xs tracking-widest flex items-center justify-center gap-2 shadow-lg ${transactionType === 'toko' ? 'bg-green-600' : (transactionType === 'online' ? 'bg-blue-600' : (transactionType === 'shopee' ? 'bg-orange-500' : 'bg-black'))} ${transactionType !== 'toko' ? 'animate-pulse' : ''}`}>
              {transactionType === 'toko' && <><CheckCircle size={14} /> MODE TRANSAKSI TOKO</>}

              {transactionType === 'online' && <><Truck size={14} /> MODE PESANAN ONLINE</>}
              {transactionType === 'shopee' && <><Package size={14} /> MODE SHOPEE</>}
              {transactionType === 'tiktok' && <><ShoppingBag size={14} /> MODE TIKTOK</>}
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col overflow-hidden h-full">
              <div className="p-5 border-b flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <ShoppingCart size={18} className={transactionType === 'online' ? 'text-blue-600' : 'text-green-600'} />
                  <h2 className="font-black text-xs uppercase tracking-widest text-gray-700">Keranjang</h2>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={transactionType}
                    onChange={(e) => setTransactionType(e.target.value as 'toko' | 'online' | 'shopee' | 'tiktok')}
                    className="text-xs font-bold bg-gray-200 px-3 py-1 rounded-full hover:bg-gray-300 outline-none cursor-pointer"
                  >
                    <option value="toko">OFFLINE</option>
                    <option value="online">WEBSITE</option>
                    <option value="shopee">SHOPEE</option>
                    <option value="tiktok">TIKTOK</option>
                  </select>
                  <button onClick={() => setCart([])} className="text-red-400 hover:text-red-600"><Trash2 size={18} /></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4" data-testid="cart-items-container">
                {cart.map(item => (
                  <div key={item.id} className="flex flex-col gap-2 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col">
                        <p className="text-xs font-bold text-gray-700 uppercase">{item.name}</p>
                        <span className="text-xs font-black text-gray-400 uppercase">
                          Harga channel: {item.channel || 'OFFLINE'}
                        </span>
                      </div>
                      {editingPriceId === item.id ? (
                        <input
                          autoFocus
                          type="number"
                          className="w-24 p-1 text-xs font-black text-right border rounded outline-none focus:ring-2 focus:ring-green-500"
                          value={editPriceValue}
                          onChange={(e) => setEditPriceValue(e.target.value)}
                          onBlur={() => updatePrice(item.id, parseFloat(editPriceValue) || 0, item.quantity)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') updatePrice(item.id, parseFloat(editPriceValue) || 0, item.quantity);
                          }}
                        />
                      ) : (
                        <div 
                          onClick={() => {
                            setEditingPriceId(item.id);
                            setEditPriceValue((item.price * item.quantity).toString());
                          }}
                          className="flex items-center gap-1 cursor-pointer group"
                        >
                          <Edit size={10} className="text-gray-300 group-hover:text-green-600" />
                          <p className="text-xs font-black text-green-600">
                            Rp{(item.price * item.quantity).toLocaleString()}
                          </p>
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
                          min="1"
                          className="w-10 text-center text-xs font-black bg-transparent outline-none p-0 appearance-none"
                          value={item.quantity} 
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
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

              <div className="p-5 bg-white border-t space-y-4">
                {/* Pilihan Gudang Pengambilan Barang */}
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-black text-slate-700 uppercase flex items-center gap-1.5">
                      <Package size={13} className="text-emerald-600" />
                      Gudang Pengambilan Stok
                    </label>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      {selectedWarehouse === 'auto' ? 'Otomatis Waterfall' : 'Gudang Terpilih'}
                    </span>
                  </div>
                  <select
                    value={selectedWarehouse}
                    onChange={(e) => setSelectedWarehouse(e.target.value)}
                    className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                  >
                    <option value="auto">⚡ Otomatis (Prioritas Toko / Gudang Utama)</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        🏢 {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                  {['CASH', 'QRIS', 'TRANSFER', 'TEMPO', 'DOMPET'].map(m => (
                    <button
                      key={m}
                      onClick={() => setPaymentMethod(m)}
                      className={`p-3 rounded-xl text-xs font-black uppercase transition-all border-2 ${paymentMethod === m ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-50 border-transparent hover:border-gray-200'}`}
                    >
                      {m}
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
                              setSelectedCustomer({id: c.id, name: c.name, walletBalance: c.walletBalance || 0});
                              setCustomerSearch(c.name);
                              setCustomerResults([]);
                            }}
                            className="p-3 hover:bg-gray-100 cursor-pointer text-xs"
                          >
                            <p className="font-bold">{c.name}</p>
                            <p className="text-gray-500">{c.phone} - Saldo: Rp{(c.walletBalance || 0).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedCustomer && (
                      <div className="mt-2 p-3 bg-blue-100 border border-blue-200 rounded-lg text-center">
                        <p className="text-xs font-bold text-blue-800">{selectedCustomer.name}</p>
                        <p className="text-lg font-black text-blue-800">Rp{selectedCustomer.walletBalance.toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                ) : paymentMethod === 'CASH' ? (
                  <div className="bg-gray-50 p-3 rounded-2xl">
                    <label className="text-xs font-black text-gray-400 uppercase">Bayar Tunai</label>
                    <input type="number" value={cashGiven} onChange={e => setCashGiven(e.target.value)} className="w-full bg-transparent font-black text-lg outline-none" placeholder="0" />
                    {change >= 0 && <p className="text-xs font-bold text-green-600 mt-1">Kembali: Rp{change.toLocaleString()}</p>}
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

                <div className="flex justify-between items-center py-2">
                  <span className="text-xs font-black text-gray-400 uppercase">Total</span>
                  <span className={`text-xl font-black ${transactionType === 'online' ? 'text-blue-600' : 'text-green-600'}`}>Rp{total.toLocaleString()}</span>
                </div>

                <div className="flex items-center gap-2 mb-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <input 
                    type="checkbox" 
                    id="useBluetooth"
                    checked={useBluetoothPrinter}
                    onChange={(e) => setUseBluetoothPrinter(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <label htmlFor="useBluetooth" className="text-xs font-bold text-gray-700 cursor-pointer flex-1">
                    Cetak dengan Printer Bluetooth
                  </label>
                </div>

                <button
                  disabled={isProcessing || cart.length === 0}
                  onClick={handleTransaction}
                  className={`w-full py-4 rounded-2xl font-black uppercase text-xs text-white shadow-lg transition-all flex items-center justify-center gap-2 disabled:bg-gray-200 ${transactionType === 'online' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-100' : 'bg-green-600 hover:bg-green-700 shadow-green-100'
                    }`}
                >
                  {isProcessing ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>PROSES KOMPRESI...</span>
                    </div>
                  ) : <><Printer size={16} /> {transactionType === 'online' ? 'Simpan Pesanan Online' : 'Selesaikan Transaksi'}</>}
                </button>
              </div>
            </div>
          </div>
        </main>
      ) : (
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-4">
            <h2 className="font-black text-xl text-gray-800 flex items-center gap-2"><History /> 20 Transaksi Terakhir</h2>
            {completedOrders.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border border-gray-100 shadow-sm text-center">
                <div className="w-16 h-16 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <History size={32} />
                </div>
                <h3 className="text-base font-bold text-gray-800">Belum Ada Riwayat Transaksi</h3>
                <p className="text-xs text-gray-400 mt-1">Transaksi yang sudah diselesaikan akan muncul di sini.</p>
              </div>
            ) : (
              completedOrders.map(order => (
                <div key={order.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                  <div className="flex gap-4 items-center">
                    <div className={`p-3 rounded-xl ${order.transactionType === 'online' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}><CheckCircle size={24} /></div>
                    <div>
                      <p className="text-xs font-black text-gray-800 uppercase">Order #{order.id.slice(-6)}</p>
                      <p className="text-xs font-bold text-gray-400 uppercase">
                        {order.createdAt
                          ? (typeof order.createdAt === 'object' && order.createdAt !== null && 'seconds' in order.createdAt
                            ? new Date((order.createdAt as any).seconds * 1000).toLocaleString('id-ID')
                            : new Date(order.createdAt as any).toLocaleString('id-ID'))
                          : '-'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-green-600">Rp{order.total?.toLocaleString()}</p>
                    <p className="text-xs font-bold text-gray-400 uppercase">{order.paymentMethod}</p>
                  </div>
                  <button onClick={() => printReceipt(order)} className="ml-4 p-2 hover:bg-gray-100 rounded-lg text-gray-400"><Printer size={18} /></button>
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
                      <a href={`https://wa.me/${o.customerPhone}`} target="_blank" className="p-2 bg-green-50 text-green-600 rounded-lg"><MessageSquare size={16} /></a>
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
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">💰 Modal Awal (Uang di Laci)</label>
                <input 
                  autoFocus
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
                disabled={loading}
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
    </div>
  );
}
