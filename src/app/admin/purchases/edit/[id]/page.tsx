'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeft, Search, Plus, Trash2, Save,
  Package, Store, Truck, Calculator,
  Info, Camera
} from 'lucide-react';
import Link from 'next/link';
import notify from '@/lib/notify';
import CameraBarcodeScannerModal from '@/components/scanner/CameraBarcodeScannerModal';
import { playScanBeep } from '@/lib/sound';
import useProducts from '@/lib/hooks/useProducts';
import { type NormalizedProduct, type UnitOption, normalizeProduct } from '@/lib/normalize';
import { updatePurchaseOrder } from '@/lib/actions/purchase.actions';
import { getSuppliers } from '@/lib/actions/supplier.actions';
import { getWarehouses } from '@/lib/actions/inventory.actions';
import { collection, db, doc, getDoc, getDocs, onSnapshot, orderBy, query, where, writeBatch } from '@/lib/firebase';
import { useParams } from 'next/navigation';
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

function EditPurchaseFormContent() {
  const router = useRouter();
  const { id } = useParams() as { id: string };

  const [loading, setLoading] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [duplicateLoaded, setDuplicateLoaded] = useState(false);
  const [oldPurchaseData, setOldPurchaseData] = useState<any>(null);
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


  useEffect(() => {
    setProducts(liveProducts);
  }, [liveProducts]);

  useEffect(() => {
    if (!id || productsLoading || duplicateLoaded) return;

    const fetchDuplicateData = async () => {
      setIsDuplicating(true);
      try {
        const docRef = doc(db, 'purchases', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setOldPurchaseData(data);
          setSelectedSupplier(data.supplierId || '');
          setSelectedWarehouse(data.warehouseId || '');
          setPaymentStatus(data.paymentStatus || 'LUNAS');
          setPaymentMethod(data.paymentMethod || 'CASH');
          setShippingCost(data.shippingCost || 0);
          setNotes(data.notes || '');

          // Map items to cart
          if (data.items && Array.isArray(data.items)) {
            const mappedCart = data.items.map((item: any) => {
              const matchedProduct = liveProducts.find(p => p.id === item.id || p.id === item.productId);
              return {
                id: item.id || item.productId,
                name: item.name,
                purchasePrice: item.purchasePrice || item.unitPrice || 0,
                quantity: item.quantity || 1,
                unit: item.unit || 'PCS',
                conversion: item.conversion || 1,
                availableUnits: matchedProduct?.units || item.availableUnits || [{ code: item.unit || 'PCS', contains: item.conversion || 1 }]
              };
            });
            setCart(mappedCart);
          }
          setDuplicateLoaded(true);
        } else {
          notify.admin.error('Data order tidak ditemukan.');
        }
      } catch (err) {
        console.error('Gagal memuat data order:', err);
        notify.admin.error('Gagal memuat data order.');
      } finally {
        setIsDuplicating(false);
      }
    };

    fetchDuplicateData();
  }, [id, productsLoading, liveProducts, duplicateLoaded]);

  useEffect(() => {
    getSuppliers().then(s => {
      if (s && s.length > 0) setSuppliers(s as any[]);
    }).catch(() => {});
    getWarehouses().then(w => {
      if (w && w.length > 0) setWarehouses(w as any[]);
    }).catch(() => {});

    const unsubSup = onSnapshot(collection(db, 'suppliers'), (s) => {
      if (!s.empty) {
        setSuppliers(s.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, unknown>) } as Supplier)));
      }
    }, () => {});
    const unsubWar = onSnapshot(collection(db, 'warehouses'), (s) => {
      if (!s.empty) {
        const base = s.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, unknown>) } as Warehouse));
        setWarehouses(base.sort((a, b) => a.name.localeCompare(b.name)));
      }
    }, () => {});
    return () => {
      unsubSup();
      unsubWar();
    };
  }, [liveProducts]);

  const addToCart = (product: NormalizedProduct) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item =>
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      // Tentukan unit default (prioritas: satuan beli/terbesar atau base unit)
      const defaultUnit = product.units && product.units.length > 0 
        ? product.units[0] 
        : { code: product.unit || 'PCS', contains: 1 };
      
      setCart([...cart, {
        id: product.id,
        name: product.name,
        purchasePrice: product.purchasePrice || 0,
        quantity: 1,
        unit: defaultUnit.code,
        conversion: defaultUnit.contains || 1,
        availableUnits: product.units || []
      }]);
    }
    setSearchProduct('');
  };

  const handleScan = async (code: string) => {
    try {
      const q1 = query(collection(db, 'products'), where('Barcode', '==', code));
      const s1 = await getDocs(q1);
      let p: any | null = null;
      if (!s1.empty) {
        const d = s1.docs[0];
        p = { id: d.id, ...d.data() };
      } else {
        const q2 = query(collection(db, 'products'), where('barcode', '==', code));
        const s2 = await getDocs(q2);
        if (!s2.empty) {
          const d2 = s2.docs[0];
          p = { id: d2.id, ...d2.data() };
        }
      }
      if (!p) {
        notify.admin.error('Barcode tidak ditemukan');
        return;
      }
      const normalized: NormalizedProduct = normalizeProduct(p.id, p);
      playScanBeep();
      addToCart(normalized);
      notify.admin.success(`Produk ditambahkan: ${normalized.name}`);
      setShowScanner(false);
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
    if (cart.length === 0 || !selectedSupplier || !selectedWarehouse) {
      notify.admin.error("Mohon lengkapi data supplier, gudang, dan produk.");
      return;
    }

    setLoading(true);
    try {
      // VALIDASI: Cek Saldo Modal jika Pembayaran Tunai (LUNAS & CASH)
      if (paymentStatus === 'LUNAS' && paymentMethod === 'CASH') {
        const capitalQ = query(collection(db, 'capital_transactions'), orderBy('date', 'desc'));
        const capitalSnap = await getDocs(capitalQ);
        
        let currentCapital = 0;
        capitalSnap.docs.forEach(doc => {
          const data = doc.data();
          if (data.type === 'INJECTION') currentCapital += (data.amount || 0);
          else if (data.type === 'WITHDRAWAL') currentCapital -= (data.amount || 0);
        });

        // Pada Edit, jika sebelumnya CASH, kita refund dulu saldonya dalam perhitungan di bawah ini, 
        // namun validasi saldo murni saat ini tetap penting untuk jaga-jaga.
        const oldIsCashLunas = oldPurchaseData?.paymentStatus === 'LUNAS' && oldPurchaseData?.paymentMethod === 'CASH';
        const oldTotal = oldPurchaseData?.total || 0;
        const requiredExtraCapital = oldIsCashLunas ? total - oldTotal : total;
        
        if (requiredExtraCapital > currentCapital) {
          throw new Error(`Saldo Modal Tidak Cukup! Saldo: Rp${currentCapital.toLocaleString()}, Butuh tambahan: Rp${requiredExtraCapital.toLocaleString()}`);
        }
      }

      const supplierName = suppliers.find(s => s.id === selectedSupplier)?.name;
      const warehouseName = warehouses.find(w => w.id === selectedWarehouse)?.name;

      // 1. Simpan ke Supabase (Primary Database) & update stok
      const purchaseRes = await updatePurchaseOrder(id, {
        supplierId: selectedSupplier,
        warehouseId: selectedWarehouse,
        notes: notes || undefined,
        items: cart.map(item => ({
          productId: item.id,
          quantity: item.quantity * (item.conversion || 1),
          unitPrice: (item.purchasePrice || 0) / (item.conversion || 1),
        })),
      });

      if (!purchaseRes.success) {
        throw new Error(purchaseRes.error || 'Gagal mengubah Purchase Order ke database');
      }

      // 2. Safe sync ke Firestore untuk kompatibilitas riwayat/modal
      try {
        const batch = writeBatch(db);
        const purchaseRef = doc(db, 'purchases', id);

        batch.update(purchaseRef, {
          supplierId: selectedSupplier,
          supplierName,
          warehouseId: selectedWarehouse,
          warehouseName,
          items: cart,
          subtotal,
          shippingCost,
          total,
          paymentStatus,
          paymentMethod,
          notes,
          updatedAt: new Date().toISOString(),
        });

        const oldIsPaid = oldPurchaseData?.paymentStatus === 'LUNAS' && (oldPurchaseData?.paymentMethod === 'CASH' || oldPurchaseData?.paymentMethod === 'TRANSFER');
        const oldTotal = oldPurchaseData?.total || 0;
        
        const newIsPaid = paymentStatus === 'LUNAS' && (paymentMethod === 'CASH' || paymentMethod === 'TRANSFER');
        const newTotal = total;

        // Refund the old transaction if it existed
        if (oldIsPaid) {
          const refundRef = doc(collection(db, 'capital_transactions'));
          batch.set(refundRef, {
            date: new Date().toISOString(),
            type: 'INJECTION',
            amount: oldTotal,
            description: `Refund Edit PO Lama: ${id}`,
            recordedBy: 'system',
            referenceId: purchaseRef.id
          });
        }
        
        // Apply the new transaction if it exists
        if (newIsPaid) {
           const capitalRef = doc(collection(db, 'capital_transactions'));
           batch.set(capitalRef, {
             date: new Date().toISOString(),
             type: 'WITHDRAWAL',
             amount: newTotal,
             description: `Edit PO (${paymentMethod}): ${supplierName || 'Supplier'} (${cart.length} items)`,
             recordedBy: 'system',
             referenceId: purchaseRef.id
           });
        }

        await batch.commit();
      } catch (fsErr) {
        console.warn('Firestore sync skipped or failed:', fsErr);
      }

      notify.admin.success("Purchase Order berhasil diubah!");
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

  return (
    <div className="p-3 md:p-4 bg-[#FBFBFE] min-h-screen pb-32 font-sans">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/purchases" className="p-2.5 bg-white rounded-xl shadow-sm hover:bg-black hover:text-white transition-all">
            <ChevronLeft size={18} />
          </Link>
          <div>
            <h1 className="text-base sm:text-2xl font-black text-gray-800 uppercase tracking-tighter">Edit PO</h1>
            <p className="text-gray-400 text-[9px] font-black uppercase tracking-widest mt-0.5">{id}</p>
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
          <div className="bg-white rounded-2xl sm:rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-8 border-b border-gray-50">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-black hover:bg-neutral-800 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Camera size={13} />
                  <span>Scan</span>
                </button>
                <CameraBarcodeScannerModal
                  isOpen={showScanner}
                  onClose={() => setShowScanner(false)}
                  title="Scan Barcode Pembelian (PO)"
                  description="Arahkan kamera ke barcode produk untuk masuk keranjang PO"
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
                          <p className="text-[9px] font-bold text-gray-400">STOK SAAT INI: {p.stock} {p.unit}</p>
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
                        className="mt-1 text-[10px] font-black text-red-600 uppercase tracking-widest flex items-center gap-1"
                      >
                        <Trash2 size={12} /> Hapus
                      </button>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Subtotal</p>
                      <p className="text-sm font-black text-gray-900">
                        Rp {(item.quantity * item.purchasePrice).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 p-3 rounded-2xl">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Qty</p>
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
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Satuan</p>
                      <select
                        id={`unit-${item.id}`}
                        name={`unit-${item.id}`}
                        className="w-full bg-white p-3 rounded-xl text-sm font-black text-center outline-none ring-1 ring-gray-100 focus:ring-black uppercase"
                        value={item.unit}
                        onChange={(e) => {
                          const newUnit = e.target.value;
                          const found = item.availableUnits?.find(u => u.code === newUnit);
                          setCart(cart.map(c => c.id === item.id ? { 
                            ...c, 
                            unit: newUnit, 
                            conversion: found?.contains || 1 
                          } : c));
                        }}
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
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Isi (Pcs)</p>
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
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Harga Beli</p>
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
                    <th className="px-3 md:px-8 py-3 md:py-4 text-[9px] font-black text-gray-400 uppercase">Produk</th>
                    <th className="px-3 md:px-4 py-3 md:py-4 text-[9px] font-black text-gray-400 uppercase text-center">Qty</th>
                    <th className="px-3 md:px-4 py-3 md:py-4 text-[9px] font-black text-gray-400 uppercase text-center">Satuan</th>
                    <th className="px-3 md:px-4 py-3 md:py-4 text-[9px] font-black text-gray-400 uppercase text-center">Isi (Pcs)</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 text-[9px] font-black text-gray-400 uppercase text-center">Harga Beli</th>
                    <th className="px-3 md:px-8 py-3 md:py-4 text-[9px] font-black text-gray-400 uppercase text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {cart.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 md:px-8 py-3 md:py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-gray-800 uppercase">{item.name}</span>
                          <button type="button" onClick={() => removeFromCart(item.id)} className="text-[9px] text-red-500 font-black uppercase mt-1 flex items-center gap-1 hover:underline">
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
                          onChange={(e) => {
                            const newUnit = e.target.value;
                            const found = item.availableUnits?.find(u => u.code === newUnit);
                            // Update unit & conversion otomatis
                            setCart(cart.map(c => c.id === item.id ? { 
                              ...c, 
                              unit: newUnit, 
                              conversion: found?.contains || 1 
                            } : c));
                          }}
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
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Keranjang Kosong</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: SUMMARY & ACTIONS */}
        <div className="space-y-6">
          <div className="bg-black text-white p-8 rounded-[2.5rem] shadow-xl space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
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
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Grand Total</span>
              <span className="text-2xl font-black text-green-400 italic">Rp {total.toLocaleString()}</span>
            </div>

            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentStatus('LUNAS')}
                  className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${paymentStatus === 'LUNAS' ? 'bg-green-500 text-white' : 'bg-white/5 text-gray-400'}`}
                >
                  Paid
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentStatus('HUTANG')}
                  className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${paymentStatus === 'HUTANG' ? 'bg-red-500 text-white' : 'bg-white/5 text-gray-400'}`}
                >
                  Debt
                </button>
              </div>

              <select
                id="payment-method"
                name="payment-method"
                className="w-full bg-white/5 p-4 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none"
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
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              <Save size={18} /> {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
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

      </form>
    </div>
  );
}

export default function EditPurchase() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center font-black uppercase tracking-widest text-xs bg-[#FBFBFE] text-black">
        Loading form edit...
      </div>
    }>
      <EditPurchaseFormContent />
    </Suspense>
  );
}
