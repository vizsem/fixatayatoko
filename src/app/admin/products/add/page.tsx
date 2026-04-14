'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, serverTimestamp, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import Link from 'next/link';
import {
  ChevronLeft, Save, Tag, Truck,
  Barcode, Image as ImageIcon, AlertCircle, Layers, Camera, X
} from 'lucide-react';
import notify from '@/lib/notify';
import { MARGIN_RULES, recommendSellingPrice, type PricingStrategy, type UnitOption } from '@/lib/normalize';
import Image from 'next/image';
import imageCompression from 'browser-image-compression';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';


export default function AddProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([
    { code: 'PCS', contains: 1, price: 0, label: '' },
    { code: 'BOX', contains: 0, price: 0, label: '' },
    { code: 'CTN', contains: 0, price: 0, label: '' },
  ]);
  const [newUnitCode, setNewUnitCode] = useState('');

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    ID: '',
    Barcode: '',
    Parent_ID: '',
    Nama: '',
    Kategori: '',
    Brand: '',
    Expired_Default: '',
    expired_date: '',
    tgl_masuk: '',
    Satuan: 'Pcs',
    Stok: 0,
    Min_Stok: 5,
    Modal: 0,
    Ecer: 0,
    Harga_Coret: 0,
    Grosir: 0,
    Min_Grosir: 1,
    Link_Foto: '',
    Deskripsi: '',
    Status: 1,
    Supplier: '',
    No_WA_Supplier: '',
    Lokasi: '',
    warehouseId: ''
  });

  const [pricingMode, setPricingMode] = useState<'MANUAL' | 'RECOMMENDED'>('MANUAL');
  const [pricingRuleKey, setPricingRuleKey] = useState<string>('AUTO');
  const [pricingMarginPercent, setPricingMarginPercent] = useState<number>(0);
  const [pricingRoundingStep, setPricingRoundingStep] = useState<number>(100);

  const [scannerReady, setScannerReady] = useState(false);

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
          setFormData(prev => ({ ...prev, Barcode: barcodeBuffer }));
          setBarcodeBuffer('');
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      clearTimeout(timeout);
    };
  }, [barcodeBuffer]);
  // ========================================

  const pricingRec = useMemo(() => {
    if (pricingMode !== 'RECOMMENDED') return null;
    return recommendSellingPrice({
      cost: Number(formData.Modal || 0),
      name: formData.Nama,
      category: formData.Kategori,
      ruleKey: pricingRuleKey,
      marginPercent: pricingMarginPercent,
      roundingStep: pricingRoundingStep,
    });
  }, [formData.Modal, formData.Nama, formData.Kategori, pricingMode, pricingRuleKey, pricingMarginPercent, pricingRoundingStep]);

  const applyRecommendedEcer = (price: number) => {
    const baseUnit = String(formData.Satuan || 'PCS').trim().toUpperCase();
    setFormData((prev) => ({ ...prev, Ecer: price }));
    setUnits((prev) => {
      const next = [...prev];
      const idx = next.findIndex((u) => String(u.code || '').toUpperCase() === baseUnit);
      if (idx >= 0) {
        next[idx] = { ...next[idx], code: baseUnit, contains: next[idx].contains ?? 1, price };
        return next;
      }
      next.unshift({ code: baseUnit, contains: 1, price, label: '' });
      return next;
    });
  };

  useEffect(() => {
    if (pricingMode !== 'RECOMMENDED') return;
    if (!pricingRec) return;
    if (Number(formData.Ecer || 0) === pricingRec.recommendedPrice) return;
    applyRecommendedEcer(pricingRec.recommendedPrice);
  }, [pricingMode, pricingRec, formData.Ecer, formData.Satuan]);

  const handleAddUnit = () => {
    if (!newUnitCode) return;
    const code = newUnitCode.toUpperCase();
    if (units.some(u => u.code === code)) {
      notify.admin.error('Satuan sudah ada');
      return;
    }
    setUnits([...units, { code, contains: 0, price: 0, label: '' }]);
    setNewUnitCode('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const baseId = formData.ID.trim();
      if (!baseId) throw new Error('ID Produk wajib diisi.');

      const baseUnit = String(formData.Satuan || 'PCS').trim().toUpperCase();
      const cleanedUnits = (units || [])
        .map((u) => {
          const code = String(u.code || '').trim().toUpperCase();
          if (!code) return null;

          const contains = typeof u.contains === 'number' ? u.contains : Number(u.contains || 0);
          const price = typeof u.price === 'number' ? u.price : Number(u.price || 0);

          const unitEntry: UnitOption = { code, contains, price };
          if (u.minQty !== undefined && u.minQty !== null) {
            unitEntry.minQty = typeof u.minQty === 'number' ? u.minQty : Number(u.minQty);
          }
          if (u.label) unitEntry.label = String(u.label);

          return unitEntry;
        })
        .filter(Boolean) as UnitOption[];

      const basePriceFromUnits = cleanedUnits.find((u) => u.code === baseUnit)?.price;
      const nextEcer = (typeof basePriceFromUnits === 'number' && !Number.isNaN(basePriceFromUnits))
        ? basePriceFromUnits
        : Number(formData.Ecer || 0);

      const ensuredBase = [
        { code: baseUnit, contains: 1, price: nextEcer, label: '' },
        ...cleanedUnits.filter((u) => u.code !== baseUnit),
      ];

      // 1. Validasi ID Duplikat (Wajib Unik untuk Sinkronisasi Excel)
      const q = query(collection(db, 'products'), where('ID', '==', baseId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        throw new Error(`ID Produk "${baseId}" sudah terdaftar di database!`);
      }

      // 2. Simpan ke Firestore (lengkap dengan field ter-normalisasi)
      const totalStock = Number(formData.Stok || 0);
      const byWarehouse = formData.warehouseId ? { [formData.warehouseId]: totalStock } : {};
      const displayName = String(formData.Nama || '').toUpperCase();
      let imageUrl = formData.Link_Foto || '';
      if (imageFile) {
        const compressed = await imageCompression(imageFile, { maxSizeMB: 0.25, maxWidthOrHeight: 800, useWebWorker: true, initialQuality: 0.7 });
        const imageRef = ref(storage, `products/${baseId}/${Date.now()}`);
        await uploadBytes(imageRef, compressed);
        imageUrl = await getDownloadURL(imageRef);
      }

      const pricingStrategy: PricingStrategy =
        pricingMode === 'RECOMMENDED' && pricingRec
          ? {
              mode: 'margin',
              ruleKey: pricingRec.rule.key,
              marginPercent: pricingRec.marginPercent,
              roundingStep: pricingRec.roundingStep,
            }
          : { mode: 'manual' };

      await addDoc(collection(db, 'products'), {
        ...formData,
        ID: baseId,
        Nama: displayName,
        Satuan: baseUnit,
        sku: baseId,
        name: displayName,
        category: formData.Kategori,
        unit: baseUnit,
        description: formData.Deskripsi || '',
        stock: totalStock,
        Stok: totalStock,
        stockByWarehouse: byWarehouse,
        minStock: Number(formData.Min_Stok || 0),
        Min_Stok: Number(formData.Min_Stok || 0),
        purchasePrice: Number(formData.Modal || 0),
        Modal: Number(formData.Modal || 0),
        priceEcer: nextEcer,
        Ecer: nextEcer,
        price: nextEcer,
        priceGrosir: Number(formData.Grosir || 0),
        wholesalePrice: Number(formData.Grosir || 0),
        Min_Grosir: Number(formData.Min_Grosir || 0),
        minWholesale: Number(formData.Min_Grosir || 0),
        barcode: formData.Barcode || '',
        Barcode: formData.Barcode || '',
        imageUrl,
        image: imageUrl,
        URL_Produk: imageUrl,
        isActive: Number(formData.Status) === 1,
        Status: Number(formData.Status) === 1 ? 1 : 0,
        warehouseId: formData.warehouseId || '',
        tgl_masuk: formData.tgl_masuk || '',
        expired_date: formData.expired_date || formData.Expired_Default || '',
        expiredDate: formData.expired_date || formData.Expired_Default || '',
        Lokasi: formData.Lokasi || '',
        units: ensuredBase,
        pricingStrategy,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      notify.admin.success('Produk berhasil ditambahkan ke database!');
      router.push('/admin/products');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('An unknown error occurred');
      }
    } finally {

      setLoading(false);
    }
  };

  useEffect(() => {
    let scanner: any = null;
    const init = async () => {
      if (!scannerReady) return;
      const mod: any = await import('html5-qrcode');
      const Html5QrcodeScanner = mod.Html5QrcodeScanner;
      scanner = new Html5QrcodeScanner('barcode-scanner-camera', { fps: 10, qrbox: 250 }, false);
      scanner.render(
        (decodedText: string) => {
          setFormData(prev => ({ ...prev, Barcode: decodedText }));
          setScannerReady(false);
          notify.admin.success(`Barcode berhasil dipindai: ${decodedText}`);
        },
        (err: any) => { /* ignore errors */ }
      );
    };
    init();
    return () => {
      if (scanner) {
        scanner.clear().catch(console.error);
      }
    };
  }, [scannerReady]);

  // Load warehouses
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'warehouses'), (s) => {
      setWarehouses(s.docs.map(d => {
        const data = d.data() as Record<string, unknown>;
        const name = (typeof data.name === 'string' && data.name) ? data.name : d.id;
        return { id: d.id, name };
      }));
    });
    return () => unsub();
  }, []);
  return (
    <div className="p-3 md:p-4 bg-gray-50 min-h-screen pb-24 text-black font-sans">
      <div className="max-w-4xl mx-auto">

        {/* Header Navigation */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/admin/products" className="p-3 bg-white rounded-2xl shadow-sm hover:bg-black hover:text-white transition-all">
              <ChevronLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tighter">Tambah Produk</h1>
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Database Inventaris Ataya</p>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl flex items-center gap-3 text-xs font-black uppercase animate-bounce">
            <AlertCircle size={18} /> {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
            <h3 className="text-xs font-black uppercase mb-6 flex items-center gap-2 border-b pb-4 text-blue-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-tag" aria-hidden="true">
                <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"></path>
                <circle cx="7.5" cy="7.5" r=".5" fill="currentColor"></circle>
              </svg>
              Identitas Barang
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 ml-1">ID Produk *</label>
                <input
                  required
                  className="w-full p-4 bg-gray-50 rounded-2xl font-black outline-none"
                  type="text"
                  value={formData.ID}
                  onChange={(e) => setFormData({ ...formData, ID: e.target.value })}
                  placeholder="Contoh: BRG-001"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Parent ID</label>
                <input
                  className="w-full p-4 bg-gray-50 rounded-2xl font-black outline-none"
                  type="text"
                  value={formData.Parent_ID}
                  onChange={(e) => setFormData({ ...formData, Parent_ID: e.target.value })}
                  placeholder="Opsional"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Nama Produk</label>
                <input required className="w-full p-4 bg-gray-100 rounded-2xl font-black outline-none" type="text" value={formData.Nama} onChange={e => setFormData({ ...formData, Nama: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Lokasi Rak</label>
                <input className="w-full p-4 bg-gray-50 rounded-2xl font-black outline-none" type="text" value={formData.Lokasi} onChange={e => setFormData({ ...formData, Lokasi: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Kategori</label>
                <input className="w-full p-4 bg-gray-50 rounded-2xl font-black outline-none" type="text" value={formData.Kategori} onChange={e => setFormData({ ...formData, Kategori: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Brand / Merk</label>
                <input className="w-full p-4 bg-gray-50 rounded-2xl font-black outline-none" type="text" value={formData.Brand} onChange={e => setFormData({ ...formData, Brand: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 ml-1 flex justify-between">
                  <span>Barcode / SKU</span>
                  <button type="button" onClick={() => setScannerReady(true)} className="text-blue-500 hover:text-blue-700 flex items-center gap-1">
                    <Camera size={12} /> Scan Kamera
                  </button>
                </label>
                <div className="relative">
                  <Barcode size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl font-black outline-none" type="text" value={formData.Barcode} onChange={e => setFormData({ ...formData, Barcode: e.target.value })} />
                </div>
                {scannerReady && (
                  <div className="mt-2 p-2 bg-black rounded-2xl relative">
                    <button type="button" onClick={() => setScannerReady(false)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 z-10">
                      <X size={14} />
                    </button>
                    <div id="barcode-scanner-camera" className="rounded-xl overflow-hidden"></div>
                  </div>
                )}
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Tanggal Kadaluarsa</label>
                <div className="relative">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-calendar absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" aria-hidden="true">
                    <path d="M8 2v4"></path>
                    <path d="M16 2v4"></path>
                    <rect width="18" height="18" x="3" y="4" rx="2"></rect>
                    <path d="M3 10h18"></path>
                  </svg>
                  <input className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl font-black outline-none" type="date" value={formData.Expired_Default} onChange={e => setFormData({ ...formData, Expired_Default: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Tanggal Masuk</label>
                <div className="relative">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-calendar absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" aria-hidden="true">
                    <path d="M8 2v4"></path>
                    <path d="M16 2v4"></path>
                    <rect width="18" height="18" x="3" y="4" rx="2"></rect>
                    <path d="M3 10h18"></path>
                  </svg>
                  <input className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl font-black outline-none" type="date" value={formData.tgl_masuk} onChange={e => setFormData({ ...formData, tgl_masuk: e.target.value })} />
                </div>
              </div>
            </div>
          </div>

          {/* BAGIAN 2: STOK & KATEGORI */}
          <div className="bg-white p-5 md:p-6 rounded-[2rem] shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6 text-emerald-600">
              <Layers size={18} />
              <h3 className="text-xs font-black uppercase tracking-widest">Kategori & Stok</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Satuan</label>
                <input required type="text" placeholder="Pcs/Dus" className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold" value={formData.Satuan} onChange={e => setFormData({ ...formData, Satuan: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2 text-emerald-600">Stok Awal</label>
                <input required type="number" className="w-full p-4 bg-emerald-50 rounded-2xl border-none font-black text-emerald-700" value={formData.Stok} onChange={e => setFormData({ ...formData, Stok: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2 text-red-500">Min. Stok</label>
                <input required type="number" className="w-full p-4 bg-red-50 rounded-2xl border-none font-black text-red-600" value={formData.Min_Stok} onChange={e => setFormData({ ...formData, Min_Stok: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Gudang</label>
                <select className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold" value={formData.warehouseId} onChange={e => setFormData({ ...formData, warehouseId: e.target.value })}>
                  <option value="">Pilih Gudang</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* BAGIAN 3: HARGA & GROSIR */}
          <div className="bg-white p-5 md:p-6 rounded-[2rem] shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6 text-orange-600">
              <Tag size={18} />
              <h3 className="text-xs font-black uppercase tracking-widest">Struktur Harga</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Harga Modal</label>
                <input required type="number" className="w-full p-4 bg-gray-100 rounded-2xl border-none font-black" value={formData.Modal} onChange={e => setFormData({ ...formData, Modal: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Harga Ecer (Jual)</label>
                <input required type="number" disabled={pricingMode === 'RECOMMENDED'} className="w-full p-4 bg-blue-50 rounded-2xl border-none font-black text-blue-700 focus:ring-2 focus:ring-blue-600 disabled:opacity-70" value={formData.Ecer} onChange={e => setFormData({ ...formData, Ecer: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Harga Coret</label>
                <input type="number" className="w-full p-4 bg-gray-50 rounded-2xl border-none font-black text-gray-300 line-through" value={formData.Harga_Coret} onChange={e => setFormData({ ...formData, Harga_Coret: Number(e.target.value) })} />
              </div>
            </div>
            <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 mb-5">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Mode Harga</label>
                  <select
                    className="w-full p-4 bg-white rounded-2xl border-none font-black text-xs shadow-sm"
                    value={pricingMode}
                    onChange={(e) => setPricingMode(e.target.value === 'RECOMMENDED' ? 'RECOMMENDED' : 'MANUAL')}
                  >
                    <option value="MANUAL">Manual</option>
                    <option value="RECOMMENDED">Ikuti rekomendasi</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Profil Margin</label>
                  <select
                    disabled={pricingMode !== 'RECOMMENDED'}
                    className="w-full p-4 bg-white rounded-2xl border-none font-black text-xs shadow-sm disabled:opacity-60"
                    value={pricingRuleKey}
                    onChange={(e) => setPricingRuleKey(e.target.value)}
                  >
                    {MARGIN_RULES.map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.label} ({r.min}-{r.max}%)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Margin (%)</label>
                  <input
                    type="number"
                    disabled={pricingMode !== 'RECOMMENDED'}
                    className="w-full p-4 bg-white rounded-2xl border-none font-black text-xs shadow-sm disabled:opacity-60"
                    value={pricingMarginPercent || ''}
                    onChange={(e) => setPricingMarginPercent(Number(e.target.value || 0))}
                    placeholder={pricingRec ? String(pricingRec.marginPercent.toFixed(1)) : ''}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Pembulatan</label>
                  <select
                    disabled={pricingMode !== 'RECOMMENDED'}
                    className="w-full p-4 bg-white rounded-2xl border-none font-black text-xs shadow-sm disabled:opacity-60"
                    value={pricingRoundingStep}
                    onChange={(e) => setPricingRoundingStep(Number(e.target.value || 100))}
                  >
                    <option value={1}>Tanpa pembulatan</option>
                    <option value={50}>Kelipatan 50</option>
                    <option value={100}>Kelipatan 100</option>
                    <option value={500}>Kelipatan 500</option>
                    <option value={1000}>Kelipatan 1000</option>
                  </select>
                </div>
              </div>

              {pricingMode === 'RECOMMENDED' && pricingRec && (
                <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="text-xs font-black text-slate-700">
                    Rekomendasi: Rp{pricingRec.recommendedPrice.toLocaleString('id-ID')} ({pricingRec.rule.label}, {pricingRec.rule.min}-{pricingRec.rule.max}%)
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Efektif: {pricingRec.effectiveMarginPercent.toFixed(2)}%
                  </div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-6 bg-orange-50 rounded-3xl border border-orange-100">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-orange-600 ml-2">Harga Grosir</label>
                <input type="number" className="w-full p-4 bg-white rounded-2xl border-none font-black text-orange-700 shadow-sm" value={formData.Grosir} onChange={e => setFormData({ ...formData, Grosir: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-orange-600 ml-2">Min. Beli Grosir</label>
                <input type="number" className="w-full p-4 bg-white rounded-2xl border-none font-black text-orange-700 shadow-sm" value={formData.Min_Grosir} onChange={e => setFormData({ ...formData, Min_Grosir: Number(e.target.value) })} />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <span className="text-[10px] font-black uppercase text-gray-400">Status</span>
              <select className="p-3 bg-gray-50 rounded-xl text-xs font-bold" value={formData.Status} onChange={e => setFormData({ ...formData, Status: Number(e.target.value) })}>
                <option value={1}>Aktif</option>
                <option value={0}>Arsip</option>
              </select>
            </div>
          </div>

          <div className="bg-white p-5 md:p-6 rounded-[2rem] shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 text-gray-800">
                <Tag size={18} />
                <h3 className="text-xs font-black uppercase tracking-widest">Satuan Jual</h3>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Kode Satuan (Ex: LUSIN)"
                  className="bg-gray-50 px-3 py-2 rounded-xl text-xs font-bold uppercase outline-none border focus:border-blue-500 w-40"
                  value={newUnitCode}
                  onChange={(e) => setNewUnitCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddUnit())}
                />
                <button
                  type="button"
                  onClick={handleAddUnit}
                  className="bg-black text-white px-3 py-2 rounded-xl text-xs font-black uppercase hover:bg-gray-800 transition-all"
                >
                  + Tambah
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {units.map((u, index) => {
                const code = u.code || '';
                const idx = index;
                const current = u;
                const basePrice = Number(formData.Ecer || 0);
                const contains = Number(current.contains || (code === 'PCS' ? 1 : 0));
                const unitPrice = Number(current.price || 0);
                const perPcs = contains > 0 ? Math.round(unitPrice / contains) : 0;

                return (
                  <div key={code} className="p-4 rounded-2xl border bg-gray-50 relative group">
                    {code !== 'PCS' && (
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...units];
                          next.splice(idx, 1);
                          setUnits(next);
                        }}
                        className="absolute top-2 right-2 p-1 bg-red-100 text-red-600 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-200"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                      </button>
                    )}
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="text-[10px] font-black uppercase text-gray-400">{code}</div>
                      <input
                        type="text"
                        className="w-32 bg-white p-2 rounded-xl text-[10px] font-black text-gray-700 outline-none border"
                        placeholder="Nama satuan"
                        value={current.label || ''}
                        onChange={(e) => {
                          const next = [...units];
                          next[idx] = { ...current, label: e.target.value };
                          setUnits(next);
                        }}
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black text-gray-500 uppercase">Harga</span>
                        <input
                          type="number"
                          className="w-32 bg-white p-3 rounded-xl text-sm font-black text-right outline-none border"
                          value={current.price || ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? undefined : Number(e.target.value);
                            const next = [...units];
                            next[idx] = { ...current, price: val };
                            setUnits(next);
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black text-gray-500 uppercase">Isi</span>
                        <input
                          type="number"
                          disabled={code === 'PCS'}
                          className="w-32 bg-white p-3 rounded-xl text-sm font-black text-right outline-none border disabled:opacity-60"
                          value={code === 'PCS' ? 1 : (current.contains || '')}
                          onChange={(e) => {
                            const val = e.target.value === '' ? undefined : Number(e.target.value);
                            const next = [...units];
                            next[idx] = { ...current, contains: code === 'PCS' ? 1 : val };
                            setUnits(next);
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black text-gray-500 uppercase">Min Qty</span>
                        <input
                          type="number"
                          min="0"
                          className="w-32 bg-white p-3 rounded-xl text-sm font-black text-right outline-none border"
                          value={current.minQty || ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? undefined : Number(e.target.value);
                            const next = [...units];
                            next[idx] = { ...current, minQty: val };
                            setUnits(next);
                          }}
                        />
                      </div>
                      <div className="text-[10px] font-black text-gray-500 pt-2 border-t border-gray-200">
                        {code} - Rp{basePrice.toLocaleString('id-ID')}{' '}
                        <span className="mx-1 font-bold text-gray-800">Rp{Number(unitPrice || 0).toLocaleString('id-ID')}</span>
                        / Isi {contains || 0} ( Rp {perPcs.toLocaleString('id-ID')} /pcs )
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* BAGIAN 4: MEDIA & SUPPLIER */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
              <h3 className="text-xs font-black uppercase text-gray-400 mb-4 flex items-center gap-2"><ImageIcon size={14} /> Media</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-28 h-28 border-2 border-dashed border-gray-200 rounded-xl overflow-hidden relative flex items-center justify-center bg-gray-50">
                    {imagePreview ? (
                      <Image src={imagePreview} alt="Preview" fill className="object-cover" />
                    ) : (
                      <ImageIcon size={20} className="text-gray-300" />
                    )}
                  </div>
                  <label className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer text-xs font-bold text-gray-700">
                    Pilih Foto
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (!file.type.startsWith('image/')) return;
                        const compressed = await imageCompression(file, { maxSizeMB: 0.25, maxWidthOrHeight: 800, useWebWorker: true, initialQuality: 0.7 });
                        setImageFile(new File([compressed], file.name, { type: compressed.type }));
                        setImagePreview(URL.createObjectURL(compressed));
                      }}
                    />
                  </label>
                </div>
                <input type="text" placeholder="URL Foto Produk" className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold text-xs" value={formData.Link_Foto} onChange={e => setFormData({ ...formData, Link_Foto: e.target.value })} />
                <textarea rows={3} placeholder="Deskripsi Singkat..." className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold text-xs" value={formData.Deskripsi} onChange={e => setFormData({ ...formData, Deskripsi: e.target.value })}></textarea>
              </div>
            </div>
            <div className="bg-blue-600 p-6 rounded-[2.5rem] shadow-xl text-white">
              <h3 className="text-xs font-black uppercase text-blue-200 mb-4 flex items-center gap-2"><Truck size={14} /> Supplier</h3>
              <div className="space-y-4">
                <input type="text" placeholder="Nama Supplier" className="w-full p-4 bg-blue-500/30 rounded-2xl border-none font-bold placeholder:text-blue-200 text-white" value={formData.Supplier} onChange={e => setFormData({ ...formData, Supplier: e.target.value })} />
                <input type="text" placeholder="WA: 628..." className="w-full p-4 bg-blue-500/30 rounded-2xl border-none font-bold placeholder:text-blue-200 text-white" value={formData.No_WA_Supplier} onChange={e => setFormData({ ...formData, No_WA_Supplier: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-6">
            <button type="button" onClick={() => router.back()} className="flex-1 p-5 bg-white text-gray-400 font-black uppercase text-xs rounded-[2rem] shadow-sm border hover:bg-gray-100 transition-all">
              Batal
            </button>
            <button type="submit" disabled={loading} className="flex-[2] p-5 bg-black text-white font-black uppercase text-xs rounded-[2rem] shadow-2xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 tracking-widest">
              {loading ? 'SISTEM MENYIMPAN...' : <><Save size={18} /> Simpan Produk</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
