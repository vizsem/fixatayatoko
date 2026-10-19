'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeft, Search, Plus, Trash2, Save,
  Package, Store, Truck, Calculator,
  Info, Camera
} from 'lucide-react';
import Link from 'next/link';
import notify from '@/lib/notify';
import CameraBarcodeScannerModal from '@/components/scanner/CameraBarcodeScannerModal';
import useProducts from '@/lib/hooks/useProducts';
import { getLargestPurchaseUnit, getPurchaseUnitPrice, type NormalizedProduct, type UnitOption, normalizeProduct } from '@/lib/normalize';
import { createPurchaseOrder, getPurchaseOrderById, getPurchasePriceHistory } from '@/lib/actions/purchase.actions';
import { getCapitalBalance } from '@/lib/actions/capital.actions';
import { getSuppliers } from '@/lib/actions/supplier.actions';
import { getWarehouses } from '@/lib/actions/inventory.actions';
import { buildDuplicateCart } from '@/lib/purchase-duplicate';
import { supabase } from '@/lib/supabase';
import { sbGetDocs } from '@/lib/supabase-helpers';
import { playScanBeep } from '@/lib/sound';
interface Supplier { id: string; name: string; }
interface Warehouse { id: string; name: string; }
interface CartItem { 
  id: string; 
  name: string; 
  purchasePrice: number; 
  quantity: number; 
  unit: string; 
  conversion: number;
  availableUnits?: UnitOption[]; 
}

function AddPurchaseFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const duplicateFrom = searchParams.get('duplicateFrom');

  const [loading, setLoading] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [duplicateLoaded, setDuplicateLoaded] = useState(false);
  const { products: liveProducts, loading: productsLoading } = useProducts({ isActive: true, orderByField: 'name', orderDirection: 'asc' });

  // Data References
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<NormalizedProduct[]>([]);
  const [searchProduct, setSearchProduct] = useState('');

  // Form States
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('LUNAS');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [dpAmount, setDpAmount] = useState<number>(0);
  const [dueDate, setDueDate] = useState<string>('');
  const [shippingCost, setShippingCost] = useState(0);
  const [notes, setNotes] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [purchasePriceMode, setPurchasePriceMode] = useState<'LATEST' | 'CHEAPEST'>('LATEST');
  const [pendingHistoryLookups, setPendingHistoryLookups] = useState(0);
  const pendingHistoryLookupsRef = useRef(0);
  const historyPriceCacheRef = useRef(new Map<string, { latestPrice: number; cheapestPrice: number }>());
  const historyPriceRequestRef = useRef(new Map<string, number>());

  /**
   * Saldo modal dari server, ditampilkan di kartu ringkasan supaya pengguna
   * melihat angka yang PERSIS sama dengan yang dipakai validasi pembayaran tunai
   * dan dengan halaman `/admin/capital` (`null` = belum termuat).
   */
  const [capitalBalance, setCapitalBalance] = useState<number | null>(null);

  useEffect(() => {
    let aktif = true;
    getCapitalBalance().then((res) => {
      if (aktif && res.success) setCapitalBalance(res.data.balance);
    });
    return () => {
      aktif = false;
    };
  }, []);


  useEffect(() => {
    setProducts(liveProducts);
  }, [liveProducts]);

  useEffect(() => {
    if (!duplicateFrom || productsLoading || duplicateLoaded) return;

    const fetchDuplicateData = async () => {
      setIsDuplicating(true);
      try {
        // Dibaca lewat Server Action (`getPurchaseOrderById`), BUKAN lewat
        // `sbGetDoc()` langsung dari browser.
        //
        // `sbGetDoc()` memakai `supabaseAdmin`, dan di browser klien itu dibuat
        // dengan publishable key + `persistSession: false`, sehingga TIDAK
        // membawa sesi login pengguna -> permintaan berjalan sebagai `anon`.
        // RLS menolak `anon` membaca `purchases`, jadi hasilnya baris kosong
        // (bukan error) dan halaman selalu bilang "Data order tidak ditemukan".
        // Server Action berjalan dengan service role di server, jadi lolos.
        const po = await getPurchaseOrderById(duplicateFrom);

        if (!po) {
          notify.admin.error('Data order yang disalin tidak ditemukan.');
          return;
        }

        const raw = (po as { raw_data?: Record<string, any> }).raw_data || {};

        // `supplierId` tidak dikembalikan di level atas oleh `getPurchaseOrderById`,
        // jadi dibaca dari `raw_data` (tempat aslinya disimpan).
        setSelectedSupplier(raw.supplierId || '');
        setSelectedWarehouse(po.warehouseId || '');
        setPaymentStatus(raw.paymentStatus || 'LUNAS');
        setPaymentMethod(raw.paymentMethod || 'CASH');
        setShippingCost(Number(raw.shippingCost || 0));
        setNotes(po.notes || '');

        // `raw.items` menyimpan satuan & konversi asli pembelian, jadi pakai itu
        // bila ada. Kalau tidak, jatuh ke bentuk hasil pemetaan aksi.
        type ItemHasilPemetaan = {
          productId?: string;
          id?: string;
          unitPrice?: number;
          quantity?: number;
          product?: { name?: string; unit?: string };
        };

        const sumberItem =
          Array.isArray(raw.items) && raw.items.length > 0
            ? raw.items
            : ((po.items || []) as ItemHasilPemetaan[]).map((i) => ({
                productId: i.productId,
                id: i.id,
                name: i.product?.name,
                purchasePrice: i.unitPrice,
                quantity: i.quantity,
                unit: i.product?.unit,
              }));

        const { cart: mappedCart, dilewati } = buildDuplicateCart(sumberItem, liveProducts);

        if (mappedCart.length === 0) {
          notify.admin.error('PO ini tidak punya item yang bisa dipesan ulang.');
          return;
        }

        setCart(mappedCart);
        setDuplicateLoaded(true);

        if (dilewati > 0) {
          notify.admin.warning(
            `Detail PO disalin, tetapi ${dilewati} item dilewati karena produknya sudah tidak ada.`
          );
        } else {
          notify.admin.success('Detail order berhasil disalin!');
        }
      } catch (err) {
        console.error('Gagal memuat data order duplikat:', err);
        notify.admin.error('Gagal memuat data order yang disalin.');
      } finally {
        setIsDuplicating(false);
      }
    };

    fetchDuplicateData();
  }, [duplicateFrom, productsLoading, liveProducts, duplicateLoaded]);

  useEffect(() => {
    const loadMeta = () => {
      getSuppliers().then(s => {
        if (s && s.length > 0) setSuppliers(s as any[]);
      }).catch(() => {});
      getWarehouses().then(w => {
        if (w && w.length > 0) setWarehouses(w as any[]);
      }).catch(() => {});
    };

    loadMeta();

    const channel = supabase
      .channel('purchases_add_meta_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, loadMeta)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warehouses' }, loadMeta)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [liveProducts]);

  const addToCart = (product: NormalizedProduct, preferredUnitCode?: string, fromScan?: boolean) => {
    const defaultUnit = preferredUnitCode
      ? (product.units?.find(u => u.code.toUpperCase() === preferredUnitCode.toUpperCase()) ?? getLargestPurchaseUnit(product.units, product.unit || 'PCS'))
      : getLargestPurchaseUnit(product.units, product.unit || 'PCS');
    const basePrice = Number(product.purchasePrice || product.Modal || 0);
    const existing = cart.find(item => item.id === product.id);
    const targetUnitCode = existing?.unit || defaultUnit.code;
    const targetUnit = product.units?.find(unit => unit.code.toUpperCase() === targetUnitCode.toUpperCase()) || defaultUnit;

    const newQty = existing ? existing.quantity + 1 : 1;

    setCart((currentCart) => {
      if (currentCart.some(item => item.id === product.id)) {
        return currentCart.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }

      return [...currentCart, {
        id: product.id,
        name: product.name,
        purchasePrice: getPurchaseUnitPrice(basePrice, defaultUnit),
        quantity: 1,
        unit: defaultUnit.code,
        conversion: defaultUnit.contains || 1,
        availableUnits: product.units || []
      }];
    });

    // Audio & haptic feedback
    playScanBeep();

    // Visual highlight pada keranjang belanja
    setHighlightedId(product.id);
    setTimeout(() => {
      setHighlightedId(prev => prev === product.id ? null : prev);
    }, 1500);

    // Feedback notifikasi yang jelas
    if (existing) {
      notify.admin.success(`Quantity bertambah: ${product.name} (${newQty} ${targetUnitCode})`);
    } else {
      notify.admin.success(`Masuk keranjang: ${product.name} (1 ${targetUnitCode})`);
    }

    void applyPurchaseHistoryPrice(
      product,
      targetUnitCode,
      Number(targetUnit.contains || 1),
      purchasePriceMode,
    );

    setSearchProduct('');
  };


  const applyPurchaseHistoryPrice = async (
    product: NormalizedProduct,
    unitCode: string,
    unitContains: number,
    mode: 'LATEST' | 'CHEAPEST',
  ) => {
    const cacheKey = `${product.id}:${unitCode.toUpperCase()}:${unitContains}`;
    const applyPrice = (history: { latestPrice: number; cheapestPrice: number }) => {
      const historyPrice = mode === 'CHEAPEST' ? history.cheapestPrice : history.latestPrice;
      if (historyPrice <= 0) {
        notify.admin.warning('Belum ada riwayat harga untuk satuan ini; harga Modal produk tetap digunakan.');
        return;
      }

      setCart((currentCart) => currentCart.map(item =>
        item.id === product.id && item.unit.toUpperCase() === unitCode.toUpperCase()
          ? { ...item, purchasePrice: historyPrice }
          : item
      ));
    };

    const cachedHistory = historyPriceCacheRef.current.get(cacheKey);
    if (cachedHistory) {
      applyPrice(cachedHistory);
      return;
    }

    const requestId = (historyPriceRequestRef.current.get(product.id) || 0) + 1;
    historyPriceRequestRef.current.set(product.id, requestId);
    pendingHistoryLookupsRef.current += 1;
    setPendingHistoryLookups(pendingHistoryLookupsRef.current);

    try {
      const history = await getPurchasePriceHistory(
        product.id,
        unitCode,
        product.unit || 'PCS',
        unitContains,
      );
      historyPriceCacheRef.current.set(cacheKey, history);
      if (historyPriceRequestRef.current.get(product.id) === requestId) applyPrice(history);
    } catch (error) {
      console.warn('Gagal memuat harga pembelian dari riwayat:', error);
      notify.admin.warning('Riwayat harga belum bisa dimuat; harga Modal produk tetap digunakan.');
    } finally {
      pendingHistoryLookupsRef.current = Math.max(0, pendingHistoryLookupsRef.current - 1);
      setPendingHistoryLookups(pendingHistoryLookupsRef.current);
    }
  };

  const changePurchasePriceMode = (mode: 'LATEST' | 'CHEAPEST') => {
    setPurchasePriceMode(mode);
    cart.forEach((item) => {
      const product = products.find((candidate) => candidate.id === item.id);
      if (!product) return;
      const unit = product.units?.find((candidate) => candidate.code.toUpperCase() === item.unit.toUpperCase());
      void applyPurchaseHistoryPrice(product, item.unit, Number(unit?.contains || item.conversion || 1), mode);
    });
  };

  const changeCartUnit = (itemId: string, newUnitCode: string) => {
    const currentItem = cart.find((item) => item.id === itemId);
    if (!currentItem) return;
    const unit = currentItem.availableUnits?.find((candidate) => candidate.code === newUnitCode);
    if (!unit) return;

    setCart((currentCart) => currentCart.map((item) => item.id !== itemId ? item : ({
      ...item,
      unit: newUnitCode,
      conversion: Number(unit.contains || 1),
      purchasePrice: getPurchaseUnitPrice(
        item.purchasePrice / Number(item.conversion || 1),
        unit,
      ),
    })));

    const product = products.find((candidate) => candidate.id === itemId);
    if (product) {
      void applyPurchaseHistoryPrice(product, newUnitCode, Number(unit.contains || 1), purchasePriceMode);
    }
  };

  const handleScan = async (code: string) => {
    try {
      const cleanCode = code.trim();
      if (!cleanCode) return;

      // 1. CARI CEPAT DI MEMORI LOKAL (`products`) - Instant 0ms!
      let matchedProduct: NormalizedProduct | undefined;
      let matchedUnitCode: string | undefined;

      for (const p of products) {
        if (
          (p.barcode && p.barcode.toLowerCase() === cleanCode.toLowerCase()) ||
          (p.sku && p.sku.toLowerCase() === cleanCode.toLowerCase()) ||
          ((p as any).Barcode && String((p as any).Barcode).toLowerCase() === cleanCode.toLowerCase())
        ) {
          matchedProduct = p;
          break;
        }

        const unitMatch = p.units?.find(u => u.barcode && u.barcode.toLowerCase() === cleanCode.toLowerCase());
        if (unitMatch) {
          matchedProduct = p;
          matchedUnitCode = unitMatch.code;
          break;
        }
      }

      // 2. Fallback query database jika belum ada di memori lokal
      if (!matchedProduct) {
        // Kueri 1: barcode utama
        const snapMain = await sbGetDocs({
          table: 'products',
          where: [{ field: 'barcode', op: '==', val: cleanCode }],
          limit: 1,
        });
        let foundDoc = snapMain.docs[0];

        // Kueri 2: kolom sku
        if (!foundDoc) {
          const snapSku = await sbGetDocs({
            table: 'products',
            where: [{ field: 'sku', op: '==', val: cleanCode }],
            limit: 1,
          });
          foundDoc = snapSku.docs[0];
        }

        // Kueri 3: barcode dalam units
        if (!foundDoc) {
          const { data: unitRows } = await supabase
            .from('products')
            .select('id, raw_data')
            .filter('raw_data->units', 'not.is', null)
            .limit(500);
          if (unitRows) {
            for (const row of unitRows) {
              const rawUnits = (row.raw_data as Record<string, unknown>)?.units;
              if (Array.isArray(rawUnits)) {
                const hasMatch = rawUnits.some((u: Record<string, unknown>) => u?.barcode === cleanCode);
                if (hasMatch) {
                  const snapById = await sbGetDocs({ table: 'products', where: [{ field: 'id', op: '==', val: row.id }], limit: 1 });
                  foundDoc = snapById.docs[0];
                  break;
                }
              }
            }
          }
        }

        if (foundDoc) {
          const pData = { id: foundDoc.id, ...foundDoc.data() } as Record<string, unknown>;
          matchedProduct = normalizeProduct(pData.id as string, pData);
          const unitMatch = matchedProduct.units?.find(u => u.barcode === cleanCode);
          if (unitMatch) matchedUnitCode = unitMatch.code;
        }
      }

      if (!matchedProduct) {
        notify.admin.error(`Barcode "${cleanCode}" tidak ditemukan`);
        return;
      }

      // Masuk ke keranjang belanja & tambah quantity jika sudah ada
      addToCart(matchedProduct, matchedUnitCode, true);
    } catch {
      notify.admin.error('Gagal membaca barcode');
    }
  };



  const removeFromCart = (id: string) => setCart(cart.filter(item => item.id !== id));

  const updateCartItem = (id: string, field: keyof CartItem, value: string | number) => {
    setCart(cart.map(item => item.id === id ? { ...item, [field]: value } : item));
  };


  const subtotal = cart.reduce((acc, item) => acc + (item.purchasePrice * item.quantity), 0);
  const total = subtotal + shippingCost;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pendingHistoryLookupsRef.current > 0) {
      notify.admin.error('Tunggu sampai harga riwayat selesai dimuat sebelum menyimpan PO.');
      return;
    }
    if (cart.length === 0 || !selectedSupplier || !selectedWarehouse) {
      notify.admin.error("Mohon lengkapi data supplier, gudang, dan produk.");
      return;
    }

    setLoading(true);
    try {
      // VALIDASI: Cek Saldo Modal jika Pembayaran Tunai (LUNAS & CASH)
      //
      // Saldo diambil dari Server Action `getCapitalBalance()` — sumber yang sama
      // dengan halaman `/admin/capital`. Dulu halaman ini membaca tabelnya sendiri
      // dari browser dan perhitungannya memakai kolom `type`/`amount` yang masih
      // berisi nilai DEFAULT importer (NULL dan 0). Saldo jadi Rp0, sehingga
      // pembelian tunai SELALU ditolak "Saldo Modal Tidak Cukup" walaupun halaman
      // Modal menunjukkan saldo besar. Pembacaan di browser juga bergantung pada
      // sesi, jadi bisa gagal tanpa pesan error apa pun.
      if (paymentStatus === 'SEBAGIAN') {
        if (!dpAmount || dpAmount <= 0) {
          throw new Error('Masukkan nominal DP yang valid untuk pembayaran sebagian.');
        }
        if (dpAmount >= total) {
          throw new Error('Nominal DP tidak boleh sama dengan atau melebihi total pesanan. Pilih status Lunas jika dibayar penuh.');
        }
      }

      const uangKeluarSaatBuat = paymentStatus === 'LUNAS' ? total : (paymentStatus === 'SEBAGIAN' ? dpAmount : 0);
      if (uangKeluarSaatBuat > 0 && paymentMethod === 'CASH') {
        const saldoRes = await getCapitalBalance();
        if (!saldoRes.success) {
          throw new Error(`Gagal memeriksa saldo modal: ${saldoRes.error}`);
        }

        const currentCapital = saldoRes.data.balance;
        setCapitalBalance(currentCapital);

        if (uangKeluarSaatBuat > currentCapital) {
          const kurang = uangKeluarSaatBuat - currentCapital;
          throw new Error(
            `Saldo modal tidak cukup. Tersedia Rp${currentCapital.toLocaleString('id-ID')}, ` +
              `butuh Rp${uangKeluarSaatBuat.toLocaleString('id-ID')} (kurang Rp${kurang.toLocaleString('id-ID')}). ` +
              `Kurangi nominal DP, pilih pembayaran HUTANG/TEMPO, atau tambah modal di halaman Modal.`
          );
        }
      }

      // 1. Simpan ke Supabase (Primary Database) & langsung tambahkan stok ke Gudang & Inventory Log
      const purchaseRes = await createPurchaseOrder({
        supplierId: selectedSupplier,
        createdById: 'admin',
        warehouseId: selectedWarehouse,
        notes: notes || undefined,
        autoReceive: false,
        paymentStatus,
        paymentMethod,
        paidAmount: uangKeluarSaatBuat,
        dueDate: dueDate || undefined,
        items: cart.map(item => ({
          productId: item.id,
          quantity: item.quantity,
          unitPrice: item.purchasePrice,
          unit: item.unit,
        })),
      });

      if (!purchaseRes.success) {
        throw new Error(purchaseRes.error || 'Gagal menyimpan Purchase Order ke database');
      }

      // PO bisa tersimpan sementara stoknya belum seluruhnya masuk (mis. satu produk
      // dihapus admin lain). Itu dilaporkan lewat `warning`, bukan `success: false`,
      // supaya pengguna tahu harus klik "Terima" di daftar PO.
      const warningStok = (purchaseRes as { warning?: string }).warning;

      if (warningStok) {
        notify.admin.warning(warningStok);
      } else {
        notify.admin.success('Purchase Order tersimpan. Stok diperbarui saat barang diterima.');
      }
      router.push('/admin/purchases');
    } catch (err: any) {
      console.error(err);
      notify.admin.error(err.message || "Gagal menyimpan transaksi.");
    } finally {
      setLoading(false);
    }
  };

  const filteredSearch = products.filter(p =>
    p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchProduct.toLowerCase()) ||
    p.barcode?.toLowerCase().includes(searchProduct.toLowerCase()) ||
    p.units?.some(u => u.barcode && u.barcode.toLowerCase().includes(searchProduct.toLowerCase()))
  ).slice(0, 8);

  if (isDuplicating) {
    return (
      <div className="min-h-screen flex items-center justify-center font-black uppercase tracking-widest text-xs bg-[#FBFBFE] text-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p>Menyalin detail orderan...</p>
        </div>
      </div>
    );
  }

  // Tanpa `min-h-screen` dan `pb-32`: `<main>` di layout admin sudah punya
  // keduanya (pb-32 khusus mobile untuk bottom nav), sehingga sebelumnya
  // terhitung dua kali dan menyisakan ruang kosong besar di bawah.
  return (
    <div className="p-3 md:p-4 bg-[#FBFBFE] font-sans pb-32 lg:pb-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/purchases" className="p-2.5 bg-white rounded-xl shadow-sm hover:bg-black hover:text-white transition-all">
            <ChevronLeft size={18} />
          </Link>
          <div>
            <h1 className="text-base sm:text-2xl font-black text-gray-800 uppercase tracking-tighter">Pembelian Baru</h1>
            <p className="text-gray-500 text-xs font-black uppercase tracking-widest mt-0.5 hidden sm:block">Input stok masuk dari supplier</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* LEFT: FORM INPUT */}
        <div className="lg:col-span-2 space-y-6">

          {/* 1. Supplier & Warehouse */}
          <div className="bg-white p-4 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <select
                id="supplier-select"
                name="supplier-select"
                required
                className="w-full bg-gray-50 p-4 rounded-2xl text-xs font-bold outline-none border-none ring-1 ring-gray-100 focus:ring-black transition-all"
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
              >
                <option value="">Cari Supplier...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <select
                id="warehouse-select"
                name="warehouse-select"
                required
                className="w-full bg-gray-50 p-4 rounded-2xl text-xs font-bold outline-none border-none ring-1 ring-gray-100 focus:ring-black transition-all"
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
              >
                <option value="">Pilih Gudang...</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          </div>

          {/* 2. Product Search & Table */}
          {/* Sengaja TANPA `overflow-hidden`: dropdown hasil pencarian di bawah ini
              memakai `position: absolute`, dan `overflow-hidden` akan memotongnya
              begitu kartu lebih pendek dari daftar hasil (mis. saat keranjang kosong). */}
          <div className="bg-white rounded-2xl sm:rounded-[2.5rem] border border-gray-100 shadow-sm">
            <div className="p-4 sm:p-8 border-b border-gray-50">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-gray-600">Harga acuan pembelian</span>
                <div className="inline-flex rounded-xl bg-gray-100 p-1" role="group" aria-label="Pilih harga riwayat pembelian">
                  <button
                    type="button"
                    onClick={() => changePurchasePriceMode('LATEST')}
                    aria-pressed={purchasePriceMode === 'LATEST'}
                    className={`rounded-lg px-3 py-2 text-xs font-bold ${purchasePriceMode === 'LATEST' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}
                  >
                    Terakhir
                  </button>
                  <button
                    type="button"
                    onClick={() => changePurchasePriceMode('CHEAPEST')}
                    aria-pressed={purchasePriceMode === 'CHEAPEST'}
                    className={`rounded-lg px-3 py-2 text-xs font-bold ${purchasePriceMode === 'CHEAPEST' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}
                  >
                    Termurah
                  </button>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input
                  id="product-search"
                  name="product-search"
                  type="text"
                  className="w-full bg-gray-50 pl-12 pr-28 py-5 rounded-2xl text-xs font-bold outline-none border border-transparent focus:border-black focus:bg-white transition-all"
                  placeholder="Scan Barcode atau Ketik Nama Produk (Tekan Enter)..."
                  value={searchProduct}
                  onChange={(e) => setSearchProduct(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const term = searchProduct.trim();
                      if (!term) return;
                      if (filteredSearch.length > 0) {
                        addToCart(filteredSearch[0]);
                      } else {
                        handleScan(term);
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowScanner(true)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-black hover:bg-neutral-800 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Camera size={13} />
                  <span>Scan</span>
                </button>
                <CameraBarcodeScannerModal
                  isOpen={showScanner}
                  onClose={() => setShowScanner(false)}
                  continuous
                  title="Scan Barcode Pembelian (PO)"
                  description="Scan satu per satu; kamera tetap terbuka untuk produk berikutnya"
                  onScan={handleScan}
                />
                {/* Search Results Dropdown */}
                {searchProduct && (
                  <div className="absolute top-full left-0 w-full bg-white mt-2 rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                    {filteredSearch.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addToCart(p)}
                        className="w-full p-4 text-left hover:bg-gray-50 flex justify-between items-center group"
                      >
                        <div>
                          <p className="text-xs font-black uppercase text-gray-800">{p.name}</p>
                          <p className="text-xs font-bold text-gray-500">STOK SAAT INI: {p.stock} {p.unit}</p>
                        </div>
                        <Plus size={16} className="text-gray-300 group-hover:text-black" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Rekomendasi Cepat saat Keranjang Masih Kosong */}
              {cart.length === 0 && !searchProduct && products.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">⚡ Tambah Cepat:</span>
                  {products.slice(0, 5).map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addToCart(p)}
                      className="px-2.5 py-1 bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 active:scale-95 rounded-xl text-[10px] font-bold text-gray-700 transition-all flex items-center gap-1 truncate max-w-[160px]"
                    >
                      <Plus size={10} className="shrink-0" />
                      <span className="truncate">{p.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="md:hidden space-y-3 px-4 pb-4">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className={`bg-white p-4 rounded-3xl border shadow-sm transition-all duration-300 ${
                    highlightedId === item.id
                      ? 'border-emerald-500 ring-2 ring-emerald-400 bg-emerald-50/40 scale-[1.01]'
                      : 'border-gray-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-gray-900 uppercase tracking-tight line-clamp-2">{item.name}</p>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="mt-1 text-xs font-black text-red-600 uppercase tracking-widest flex items-center gap-1"
                      >
                        <Trash2 size={12} /> Hapus
                      </button>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Subtotal</p>
                      <p className="text-sm font-black text-gray-900">
                        Rp {(item.quantity * item.purchasePrice).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 p-3 rounded-2xl">
                      <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Qty</p>
                      <input
                        id={`qty-${item.id}`}
                        name={`qty-${item.id}`}
                        type="number"
                        className="w-full bg-white p-3 rounded-xl text-sm font-black text-center outline-none ring-1 ring-gray-100 focus:ring-black"
                        value={item.quantity}
                        onChange={(e) => updateCartItem(item.id, 'quantity', Number(e.target.value))}
                      />
                    </div>
                    <div className="bg-gray-50 p-3 rounded-2xl">
                      <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Satuan</p>
                      <select
                        id={`unit-${item.id}`}
                        name={`unit-${item.id}`}
                        className="w-full bg-white p-3 rounded-xl text-sm font-black text-center outline-none ring-1 ring-gray-100 focus:ring-black uppercase"
                        value={item.unit}
                        onChange={(e) => changeCartUnit(item.id, e.target.value)}
                      >
                        {item.availableUnits && item.availableUnits.length > 0 ? (
                          item.availableUnits.map(u => (
                            <option key={u.code} value={u.code}>{u.code}</option>
                          ))
                        ) : (
                          <option value={item.unit}>{item.unit}</option>
                        )}
                      </select>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-2xl">
                      <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Isi (Pcs)</p>
                      <input
                        id={`conv-${item.id}`}
                        name={`conv-${item.id}`}
                        type="number"
                        className="w-full bg-white p-3 rounded-xl text-sm font-black text-center outline-none ring-1 ring-gray-100 focus:ring-black"
                        value={item.conversion}
                        onChange={(e) => updateCartItem(item.id, 'conversion', Number(e.target.value))}
                      />
                    </div>
                    <div className="bg-gray-50 p-3 rounded-2xl">
                      <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Harga Beli</p>
                      <input
                        id={`price-${item.id}`}
                        name={`price-${item.id}`}
                        type="number"
                        className="w-full bg-white p-3 rounded-xl text-sm font-black text-center outline-none ring-1 ring-gray-100 focus:ring-black"
                        value={item.purchasePrice}
                        onChange={(e) => updateCartItem(item.id, 'purchasePrice', Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto -mx-4 md:mx-0">
              <table className="w-full text-left min-w-[680px] md:min-w-0">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-3 md:px-8 py-3 md:py-4 text-xs font-black text-gray-500 uppercase">Produk</th>
                    <th className="px-3 md:px-4 py-3 md:py-4 text-xs font-black text-gray-500 uppercase text-center">Qty</th>
                    <th className="px-3 md:px-4 py-3 md:py-4 text-xs font-black text-gray-500 uppercase text-center">Satuan</th>
                    <th className="px-3 md:px-4 py-3 md:py-4 text-xs font-black text-gray-500 uppercase text-center">Isi (Pcs)</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-black text-gray-500 uppercase text-center">Harga Beli</th>
                    <th className="px-3 md:px-8 py-3 md:py-4 text-xs font-black text-gray-500 uppercase text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {cart.map((item) => (
                    <tr
                      key={item.id}
                      className={`transition-colors duration-300 ${
                        highlightedId === item.id ? 'bg-emerald-50/70 font-semibold' : ''
                      }`}
                    >
                      <td className="px-3 md:px-8 py-3 md:py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-gray-800 uppercase">{item.name}</span>
                          <button type="button" onClick={() => removeFromCart(item.id)} className="text-xs text-red-500 font-black uppercase mt-1 flex items-center gap-1 hover:underline">
                            <Trash2 size={10} /> Hapus
                          </button>
                        </div>
                      </td>
                      <td className="px-3 md:px-4 py-3 md:py-4 text-center">
                        <div className="flex items-center justify-center">
                          <input
                            id={`qty-desktop-${item.id}`}
                            name={`qty-desktop-${item.id}`}
                            type="number"
                            className="w-16 bg-gray-50 p-2 rounded-lg text-xs font-black text-center outline-none"
                            value={item.quantity}
                            onChange={(e) => updateCartItem(item.id, 'quantity', Number(e.target.value))}
                          />
                        </div>
                      </td>
                      <td className="px-3 md:px-4 py-3 md:py-4 text-center">
                        <select
                          id={`unit-desktop-${item.id}`}
                          name={`unit-desktop-${item.id}`}
                          className="bg-gray-50 p-2 rounded-lg text-xs font-black text-center outline-none uppercase"
                          value={item.unit}
                          onChange={(e) => changeCartUnit(item.id, e.target.value)}
                        >
                          {item.availableUnits && item.availableUnits.length > 0 ? (
                            item.availableUnits.map(u => (
                              <option key={u.code} value={u.code}>{u.code}</option>
                            ))
                          ) : (
                            <option value={item.unit}>{item.unit}</option>
                          )}
                        </select>
                      </td>
                      <td className="px-3 md:px-4 py-3 md:py-4 text-center">
                        <input
                          id={`conv-desktop-${item.id}`}
                          name={`conv-desktop-${item.id}`}
                          type="number"
                          className="w-16 bg-gray-50 p-2 rounded-lg text-xs font-black text-center outline-none"
                          value={item.conversion}
                          onChange={(e) => updateCartItem(item.id, 'conversion', Number(e.target.value))}
                        />
                      </td>
                      <td className="px-3 md:px-6 py-3 md:py-4 text-center">
                        <input
                          id={`price-desktop-${item.id}`}
                          name={`price-desktop-${item.id}`}
                          type="number"
                          className="w-28 bg-gray-50 p-2 rounded-lg text-xs font-black text-center outline-none"
                          value={item.purchasePrice}
                          onChange={(e) => updateCartItem(item.id, 'purchasePrice', Number(e.target.value))}
                        />
                      </td>
                      <td className="px-3 md:px-8 py-3 md:py-4 text-right text-xs font-black text-gray-800">
                        Rp {(item.quantity * item.purchasePrice).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {cart.length === 0 && (
              <div className="p-20 text-center flex flex-col items-center gap-2">
                <Package size={40} className="text-gray-100" />
                <p className="text-xs font-black text-gray-300 uppercase tracking-widest">Keranjang Kosong</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: SUMMARY & ACTIONS */}
        <div className="space-y-6">
          <div className="bg-black text-white p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] shadow-xl space-y-6">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
              <Calculator size={14} /> Order Summary
            </h3>

            <div className="space-y-4 border-b border-white/10 pb-6">
              <div className="flex justify-between text-xs font-bold">
                <span className="opacity-60">SUBTOTAL</span>
                <span>Rp {subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="opacity-60">SHIPPING</span>
                <input
                  id="shipping-cost"
                  name="shipping-cost"
                  type="number"
                  className="bg-white/10 w-24 p-2 rounded-lg text-right outline-none focus:bg-white/20 transition-all"
                  value={shippingCost}
                  onChange={(e) => setShippingCost(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="flex justify-between items-end">
              <span className="text-xs font-black uppercase tracking-widest opacity-60">Grand Total</span>
              <span className="text-2xl font-black text-green-400 italic">Rp {total.toLocaleString()}</span>
            </div>

            {/* Saldo modal ditampilkan langsung di sini agar pengguna tidak perlu
                membuka halaman Modal untuk tahu apakah pembelian tunai akan
                lolos validasi. Warnanya berubah saat saldo tidak mencukupi. */}
            {capitalBalance !== null && (
              <div className="flex justify-between items-center text-[11px] font-bold border-t border-white/10 pt-4">
                <span className="uppercase tracking-widest opacity-60">Saldo Modal</span>
                <span
                  className={
                    paymentStatus === 'LUNAS' && paymentMethod === 'CASH' && total > capitalBalance
                      ? 'text-amber-400'
                      : 'text-gray-300'
                  }
                >
                  Rp {capitalBalance.toLocaleString('id-ID')}
                </span>
              </div>
            )}

            {capitalBalance !== null &&
              ((paymentStatus === 'LUNAS' && total > capitalBalance) ||
               (paymentStatus === 'SEBAGIAN' && dpAmount > capitalBalance)) &&
              paymentMethod === 'CASH' && (
                <p className="text-[10px] font-bold text-amber-400 leading-relaxed -mt-2">
                  Saldo modal kurang Rp {(((paymentStatus === 'LUNAS' ? total : dpAmount)) - capitalBalance).toLocaleString('id-ID')}. Ubah pembayaran ke
                  HUTANG/TEMPO, atau tambah modal di halaman Modal.
                </p>
              )}

            <div className="space-y-4 pt-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1.5">
                  Status Pembayaran
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentStatus('LUNAS')}
                    className={`py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${paymentStatus === 'LUNAS' ? 'bg-green-500 text-white shadow-lg shadow-green-900/30' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                  >
                    Lunas
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentStatus('SEBAGIAN');
                      if (!dpAmount) setDpAmount(Math.round(total * 0.3));
                    }}
                    className={`py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${paymentStatus === 'SEBAGIAN' ? 'bg-amber-500 text-white shadow-lg shadow-amber-900/30' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                  >
                    DP / Cicil
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentStatus('HUTANG')}
                    className={`py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${paymentStatus === 'HUTANG' ? 'bg-red-500 text-white shadow-lg shadow-red-900/30' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                  >
                    Hutang
                  </button>
                </div>
              </div>

              {/* Input DP jika status SEBAGIAN */}
              {paymentStatus === 'SEBAGIAN' && (
                <div className="bg-white/5 p-3.5 rounded-2xl border border-white/10 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Uang Muka (DP)</span>
                    <span className="text-[10px] font-bold text-amber-400">Sisa: Rp{Math.max(0, total - (dpAmount || 0)).toLocaleString('id-ID')}</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">Rp</span>
                    <input
                      type="number"
                      min={0}
                      max={total}
                      value={dpAmount || ''}
                      onChange={(e) => setDpAmount(Number(e.target.value) || 0)}
                      placeholder="Masukkan nominal DP"
                      className="w-full bg-black/30 border border-white/10 pl-9 pr-3 py-2.5 rounded-xl text-xs font-bold text-white outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="flex gap-1.5 pt-1">
                    {[0.2, 0.3, 0.5].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setDpAmount(Math.round(total * pct))}
                        className="flex-1 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold text-gray-300 transition"
                      >
                        {pct * 100}%
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input Jatuh Tempo jika HUTANG atau SEBAGIAN */}
              {(paymentStatus === 'HUTANG' || paymentStatus === 'SEBAGIAN') && (
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1.5">
                    Tanggal Jatuh Tempo {paymentStatus === 'SEBAGIAN' ? 'Sisa Hutang' : 'Pelunasan'}
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-xs font-bold text-white outline-none focus:border-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1.5">
                  Metode Pembayaran {paymentStatus === 'SEBAGIAN' ? 'DP' : ''}
                </label>
                <select
                  id="payment-method"
                  name="payment-method"
                  className="w-full bg-white/5 p-4 rounded-xl text-xs font-black uppercase tracking-widest outline-none text-white"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="CASH" className="bg-gray-900">CASH / TUNAI</option>
                  <option value="TRANSFER" className="bg-gray-900">TRANSFER BANK</option>
                  <option value="TEMPO" className="bg-gray-900">TEMPO / NET TERMS</option>
                  <option value="DP" className="bg-gray-900">DP + PELUNASAN</option>
                  <option value="GIRO" className="bg-gray-900">GIRO / CEK</option>
                  <option value="QRIS" className="bg-gray-900">QRIS / TRANSFER INSTAN</option>
                  <option value="KREDIT" className="bg-gray-900">KREDIT SUPPLIER</option>
                  <option value="KONSINYASI" className="bg-gray-900">KONSINYASI</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || pendingHistoryLookups > 0 || cart.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 py-5 rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-blue-900/20 transition-all hidden lg:flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              <Save size={18} /> {loading ? 'Saving Order...' : pendingHistoryLookups > 0 ? 'Memuat Harga...' : 'Post Purchase Order'}
            </button>
          </div>

          <div className="bg-white p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
              <Info size={14} /> Additional Notes
            </h3>
            <textarea
              id="purchase-notes"
              name="purchase-notes"
              className="w-full bg-gray-50 p-4 rounded-2xl text-xs font-medium outline-none h-32 resize-none"
              placeholder="Tambahkan instruksi pengiriman atau catatan nota..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Aksi utama menempel di dasar layar, khusus mobile: profesional & proporsional */}
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-[80] bg-white/95 backdrop-blur-xl border-t border-slate-200/90 shadow-[0_-8px_30px_rgba(0,0,0,0.1)] px-4 pt-3 pb-[max(1rem,calc(env(safe-area-inset-bottom)+0.5rem))] transition-all">
          <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Total PO</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black bg-slate-100 text-slate-600">
                  {cart.length} item
                </span>
              </div>
              <p className="text-base sm:text-lg font-black text-slate-900 truncate tracking-tight mt-0.5">
                Rp {total.toLocaleString('id-ID')}
              </p>
            </div>
            <button
              type="submit"
              disabled={loading || pendingHistoryLookups > 0 || cart.length === 0}
              className="shrink-0 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white py-3.5 px-5 rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                  <span>Menyimpan...</span>
                </>
              ) : pendingHistoryLookups > 0 ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                  <span>Memuat Harga...</span>
                </>
              ) : (
                <>
                  <Save size={16} className="shrink-0" />
                  <span>Post Purchase Order</span>
                </>
              )}
            </button>
          </div>
        </div>

      </form>
    </div>
  );
}

export default function AddPurchase() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center font-black uppercase tracking-widest text-xs bg-[#FBFBFE] text-black">
        Loading form pembelian...
      </div>
    }>
      <AddPurchaseFormContent />
    </Suspense>
  );
}
