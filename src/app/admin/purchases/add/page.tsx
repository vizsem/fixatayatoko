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
  const [shippingCost, setShippingCost] = useState(0);
  const [notes, setNotes] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
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

  const addToCart = (product: NormalizedProduct) => {
    const defaultUnit = getLargestPurchaseUnit(product.units, product.unit || 'PCS');
    const basePrice = Number(product.purchasePrice || product.Modal || 0);
    const existing = cart.find(item => item.id === product.id);
    const targetUnitCode = existing?.unit || defaultUnit.code;
    const targetUnit = product.units?.find(unit => unit.code.toUpperCase() === targetUnitCode.toUpperCase()) || defaultUnit;

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
      // Dibaca langsung dari Supabase, bukan lewat API bergaya Firestore.
      // `resolveQueryField` memetakan `Barcode`/`barcode` ke kolom `barcode`
      // yang SAMA, jadi satu kueri sudah cukup — kode lama menembak dua kueri
      // ke kolom yang sama.
      const snap = await sbGetDocs({
        table: 'products',
        where: [{ field: 'barcode', op: '==', val: code }],
        limit: 1,
      });
      const found = snap.docs[0];
      if (!found) {
        notify.admin.error('Barcode tidak ditemukan');
        return;
      }
      const p = { id: found.id, ...found.data() } as any;
      const normalized: NormalizedProduct = normalizeProduct(p.id, p);
      addToCart(normalized);
      notify.admin.success(`Produk ditambahkan: ${normalized.name}`);
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
      if (paymentStatus === 'LUNAS' && paymentMethod === 'CASH') {
        const saldoRes = await getCapitalBalance();
        if (!saldoRes.success) {
          throw new Error(`Gagal memeriksa saldo modal: ${saldoRes.error}`);
        }

        const currentCapital = saldoRes.data.balance;
        setCapitalBalance(currentCapital);

        if (total > currentCapital) {
          const kurang = total - currentCapital;
          throw new Error(
            `Saldo modal tidak cukup. Tersedia Rp${currentCapital.toLocaleString('id-ID')}, ` +
              `butuh Rp${total.toLocaleString('id-ID')} (kurang Rp${kurang.toLocaleString('id-ID')}). ` +
              `Pilih pembayaran HUTANG/TEMPO, atau tambah modal di halaman Modal.`
          );
        }
      }

      // 1. Simpan ke Supabase (Primary Database) & langsung tambahkan stok ke Gudang & Inventory Log
      //
      // Seluruh penulisan data (baris PO, stok, log inventory, DAN mutasi modal)
      // terjadi di dalam Server Action ini. Dulu ada blok `writeBatch` di sini
      // yang mencoba menyalin PO + menarik modal dari peramban; blok itu menulis
      // baris `purchases` KEDUA (duplikat) dan SELALU gagal dengan senyap
      // (try/catch hanya `console.warn`), sehingga pembelian tunai tidak pernah
      // mengurangi saldo modal. Sudah dihapus — jangan dikembalikan.
      const purchaseRes = await createPurchaseOrder({
        supplierId: selectedSupplier,
        createdById: 'admin',
        warehouseId: selectedWarehouse,
        notes: notes || undefined,
        autoReceive: false, // Stok masuk hanya setelah barang benar-benar diterima.
        // WAJIB dikirim: tanpa dua field ini `createPurchaseOrder` memakai
        // default LUNAS + CASH, sehingga PO yang dibayar transfer atau tempo
        // tetap tercatat lunas tunai — kas berkurang dan hutang supplier tidak
        // pernah muncul. Nilainya juga dipakai untuk cek saldo modal di atas.
        paymentStatus,
        paymentMethod,
        items: cart.map(item => ({
          productId: item.id,
          quantity: item.quantity,          // qty asli (misal 1 Dus) — backend yang konversi
          unitPrice: item.purchasePrice,    // harga beli per satuan (misal 83000/Dus) — backend yang konversi
          unit: item.unit,                  // satuan beli (Dus, Karton, dll)
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
    p.sku?.toLowerCase().includes(searchProduct.toLowerCase())
  ).slice(0, 5);

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
    <div className="p-3 md:p-4 bg-[#FBFBFE] font-sans">

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
                  className="w-full bg-gray-50 pl-12 pr-6 py-5 rounded-2xl text-xs font-bold outline-none"
                  placeholder="Ketik Nama Produk atau Scan Barcode..."
                  value={searchProduct}
                  onChange={(e) => setSearchProduct(e.target.value)}
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
            </div>
            <div className="md:hidden space-y-3 px-4 pb-4">
              {cart.map((item) => (
                <div key={item.id} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
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
                    <tr key={item.id}>
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
              paymentStatus === 'LUNAS' &&
              paymentMethod === 'CASH' &&
              total > capitalBalance && (
                <p className="text-[10px] font-bold text-amber-400 leading-relaxed -mt-2">
                  Saldo modal kurang Rp {(total - capitalBalance).toLocaleString('id-ID')}. Ubah pembayaran ke
                  HUTANG/TEMPO, atau tambah modal di halaman Modal.
                </p>
              )}

            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentStatus('LUNAS')}
                  className={`py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${paymentStatus === 'LUNAS' ? 'bg-green-500 text-white' : 'bg-white/5 text-gray-400'}`}
                >
                  Paid
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentStatus('HUTANG')}
                  className={`py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${paymentStatus === 'HUTANG' ? 'bg-red-500 text-white' : 'bg-white/5 text-gray-400'}`}
                >
                  Debt
                </button>
              </div>

              <select
                id="payment-method"
                name="payment-method"
                className="w-full bg-white/5 p-4 rounded-xl text-xs font-black uppercase tracking-widest outline-none"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="CASH">CASH / TUNAI</option>
                <option value="TRANSFER">TRANSFER BANK</option>
                <option value="TEMPO">TEMPO / NET TERMS</option>
                <option value="DP">DP + PELUNASAN</option>
                <option value="GIRO">GIRO / CEK</option>
                <option value="QRIS">QRIS / TRANSFER INSTAN</option>
                <option value="KREDIT">KREDIT SUPPLIER</option>
                <option value="KONSINYASI">KONSINYASI</option>
              </select>
            </div>

            <button
              disabled={loading || pendingHistoryLookups > 0}
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

        {/* Aksi utama menempel di dasar layar, khusus mobile: tanpa ini tombol
            berada di ujung bawah halaman dan harus dicari dengan menggulir.
            Di desktop tombol di dalam kartu ringkasan yang dipakai. */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Total</p>
              <p className="text-sm font-black text-gray-900 truncate">Rp {total.toLocaleString()}</p>
            </div>
            <button
              type="submit"
              disabled={loading || pendingHistoryLookups > 0}
              className="flex-1 bg-blue-600 hover:bg-blue-700 py-3.5 rounded-2xl text-xs font-black uppercase tracking-[0.15em] text-white shadow-lg shadow-blue-900/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : pendingHistoryLookups > 0 ? 'Memuat Harga...' : 'Post Purchase Order'}
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
