'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Tag, Truck, Save, Layers, Trash2,
  Barcode, Image as ImageIcon, AlertCircle, ChevronLeft, Calendar, History as HistoryIcon,
  Store, Globe, ShoppingBag, Video, TrendingUp, TrendingDown, Camera, X, Package, Check, Info, Sparkles, Plus
} from 'lucide-react';
import Link from 'next/link';
import imageCompression from 'browser-image-compression';
import { toast } from 'react-hot-toast';
import CameraBarcodeScannerModal from '@/components/scanner/CameraBarcodeScannerModal';
import { playScanBeep } from '@/lib/sound';
import { MARGIN_RULES, recommendSellingPrice, type PricingStrategy } from '@/lib/normalize';
import { SATUAN_LIST, SATUAN_DEFAULT, normalizeSatuan } from '@/lib/constants/satuan';
import { supabase } from '@/lib/supabase';
import { getProductByIdForEdit, saveEditedProduct, deleteProduct } from '@/lib/actions/product.actions';
import { getPurchaseStatsByProductId } from '@/lib/actions/purchase.actions';
import { uploadImageAction } from '@/lib/actions/upload.actions';
import { isOperationalUser } from '@/lib/auth-helpers';
import { getUserAndRole, sbDeleteDoc, sbGetDoc, sbGetDocs, sbInsertDoc, sbUpsertDoc } from '@/lib/supabase-helpers';

import { calculateTaxBreakdown, DEFAULT_TAX_SETTINGS, type TaxSettings } from '@/lib/tax';

type ChannelPrices = {
  offline?: number;
  website?: number;
  shopee?: number;
  tiktok?: number;
};

type UnitOption = {
  code: string;
  contains?: number;
  price?: number;
  minQty?: number;
  label?: string;
  barcode?: string;
  prices?: ChannelPrices;
};

interface Warehouse {
  id: string;
  name: string;
}

/**
 * Badge profit untuk harga jual.
 *
 * Didefinisikan di module scope — bukan di dalam render — agar identitas
 * komponen stabil dan state-nya tidak ter-reset setiap kali parent re-render.
 */
function ProfitBadge({ profit, percentage }: { profit: number; percentage: number }) {
  const isProfitable = profit >= 0;
  return (
    <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${isProfitable ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
      {isProfitable ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      <span>
        {isProfitable ? '+' : ''}Rp{profit.toLocaleString('id-ID')} ({percentage.toFixed(1)}%)
      </span>
    </div>
  );
}

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  
  // State for Units and Categories
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [newUnitCode, setNewUnitCode] = useState('');
  const [newKategoriInput, setNewKategoriInput] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const originalImageUrlRef = useRef('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Purchase Stats State (PO Avg HPP & Supplier)
  const [poStats, setPoStats] = useState<{
    count: number;
    avgCost: number;
    latestSupplier: string | null;
    latestSupplierWa: string | null;
    latestPrice: number;
    totalQty: number;
    suppliers?: Array<{
      name: string;
      phone: string | null;
      count: number;
      totalQty: number;
      lastPrice: number;
      lastDate: string | null;
    }>;
  }>({
    count: 0,
    avgCost: 0,
    latestSupplier: null,
    latestSupplierWa: null,
    latestPrice: 0,
    totalQty: 0,
    suppliers: [],
  });

  const isInitialLoadedRef = useRef(false);

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
    Satuan_Modal: 'Pcs',
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
    warehouseId: '',
    stockByWarehouse: {} as Record<string, number>,
    minPurchase: 1,
    maxPurchase: 0,
    dimLength: 0,
    dimWidth: 0,
    dimHeight: 0,
    volumeInCtn: 0
  });

  const [pricingMode, setPricingMode] = useState<'MANUAL' | 'RECOMMENDED'>('MANUAL');
  const [pricingRuleKey, setPricingRuleKey] = useState<string>('AUTO');
  const [pricingMarginPercent, setPricingMarginPercent] = useState<number>(0);
  const [pricingRoundingStep, setPricingRoundingStep] = useState<number>(100);
  const [taxSettings, setTaxSettings] = useState<TaxSettings>(DEFAULT_TAX_SETTINGS);

  // Cost History State
  const [costHistory, setCostHistory] = useState<any[]>([]);
  const [stockReason, setStockReason] = useState<'MANUAL' | 'OPNAME' | 'TRANSFER'>('MANUAL');
  const [scannerReady, setScannerReady] = useState(false);
  // -1 = scanner untuk barcode produk utama, >= 0 = scanner untuk barcode satuan ke-idx
  const [scanUnitBarcodeIdx, setScanUnitBarcodeIdx] = useState<number>(-1);

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
          playScanBeep();
          setFormData(prev => ({ ...prev, Barcode: barcodeBuffer }));
          setBarcodeBuffer('');
          toast.success(`Barcode dipindai: ${barcodeBuffer}`);
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
  }, [pricingMode, formData.Modal, formData.Nama, formData.Kategori, pricingRuleKey, pricingMarginPercent, pricingRoundingStep]);

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

  // Fetch Tax Settings from Firebase
  useEffect(() => {
    sbGetDoc('settings', 'system').then(snap => {
      if (snap.exists() && snap.data()?.tax) {
        setTaxSettings({ ...DEFAULT_TAX_SETTINGS, ...snap.data().tax });
      }
    }).catch(() => {});
  }, []);
  
  const fetchCostHistory = useCallback(async () => {
    try {
      const snap = await sbGetDocs({
        table: 'product_cost_logs',
        where: [{ field: 'productId', op: '==', val: id }],
        orderBy: [{ field: 'changeDate', direction: 'desc' }],
      });
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCostHistory(logs);
    } catch (e) {
      console.error("Gagal load history modal:", e);
    }
  }, [id]);

  const fetchPurchaseStats = useCallback(async () => {
    try {
      const stats = await getPurchaseStatsByProductId(id);
      setPoStats(stats);
      if (stats.latestSupplier) {
        setFormData(prev => ({
          ...prev,
          Supplier: prev.Supplier || stats.latestSupplier || '',
          No_WA_Supplier: prev.No_WA_Supplier || stats.latestSupplierWa || ''
        }));
      }
    } catch (e) {
      console.error("Gagal load purchase stats:", e);
    }
  }, [id]);

  const fetchProductData = useCallback(async () => {
    try {
      let data: any = null;
      const spRow = await getProductByIdForEdit(id);

      if (spRow) {
        const raw = spRow.raw_data || {};
        data = {
          ...raw,
          ID: spRow.id,
          Nama: spRow.name || raw.Nama || raw.name || '',
          Kategori: spRow.category || raw.Kategori || raw.category || 'UMUM',
          Satuan: spRow.unit || raw.Satuan || raw.unit || 'PCS',
          Stok: Number(spRow.stock ?? raw.Stok ?? raw.stock ?? 0),
          Modal: Number(spRow.cost_price ?? raw.Modal ?? raw.purchasePrice ?? 0),
          Ecer: Number(spRow.price ?? raw.Ecer ?? raw.price ?? 0),
          Barcode: spRow.barcode || raw.Barcode || raw.barcode || '',
          Link_Foto: spRow.image_url || raw.Link_Foto || raw.imageUrl || raw.image || raw.URL_Produk || '',
          Deskripsi: spRow.description || raw.Deskripsi || raw.description || '',
          warehouseId: raw.warehouseId || '',
          stockByWarehouse: raw.stockByWarehouse || {},
          Status: spRow.is_active ? 1 : 0,
        };
      } else {
        const docSnap = await sbGetDoc('products', id);
        if (!docSnap.exists()) {
          toast.error('Produk tidak ditemukan');
          return router.push('/admin/products');
        }
        data = docSnap.data();
      }

      const baseUnit = String(data.Satuan || 'PCS').toUpperCase();
      const basePrice = Number(data.Ecer || 0);
      const cp = data.channelPricing || {};

      setFormData(prev => ({
        ...prev,
        ID: data.ID || id,
        Barcode: data.Barcode || '',
        Parent_ID: data.Parent_ID || '',
        Nama: data.Nama || data.name || '',
        Kategori: data.Kategori || 'UMUM',
        Brand: data.Brand || '',
        Expired_Default: data.expired_date || '',
        expired_date: data.expired_date || '',
        tgl_masuk: data.tgl_masuk || '',
        Satuan: baseUnit,
        Satuan_Modal: data.Satuan_Modal || data.satuanModal || baseUnit || 'Pcs',
        Stok: Number(data.Stok ?? 0),
        Min_Stok: Number(data.Min_Stok || 5),
        Modal: Number(data.Modal || 0),
        Ecer: Number(data.Ecer || 0),
        Harga_Coret: Number(data.Harga_Coret || 0),
        Grosir: Number(data.Grosir || 0),
        Min_Grosir: Number(data.Min_Grosir || 1),
        Link_Foto: data.Link_Foto || data.URL_Produk || data.image_url || data.imageUrl || data.image || '',
        Deskripsi: data.Deskripsi || data.description || '',
        Status: data.Status ?? 1,
        Supplier: data.Supplier || '',
        No_WA_Supplier: data.No_WA_Supplier || '',
        Lokasi: data.Lokasi || '',
        warehouseId: data.warehouseId || '',
        stockByWarehouse: data.stockByWarehouse || {},
        minPurchase: Number(data.minPurchase || 1),
        maxPurchase: Number(data.maxPurchase || 0),
        dimLength: Number(data.dimensions?.length || 0),
        dimWidth: Number(data.dimensions?.width || 0),
        dimHeight: Number(data.dimensions?.height || 0),
        volumeInCtn: Number(data.volumeInCtn || 0)
      }));

      const initialImg = data.Link_Foto || data.URL_Produk || data.image_url || data.imageUrl || data.image || '';
      originalImageUrlRef.current = String(initialImg).trim();
      if (initialImg) {
        setImagePreview(initialImg);
      }

      const ps = (data as any).pricingStrategy as PricingStrategy | undefined;
      if (ps?.mode === 'margin') {
        setPricingMode('RECOMMENDED');
        setPricingRuleKey(String(ps.ruleKey || 'AUTO'));
        setPricingMarginPercent(Number(ps.marginPercent || 0));
        setPricingRoundingStep(Number(ps.roundingStep || 100));
      } else {
        setPricingMode('MANUAL');
        setPricingRuleKey('AUTO');
        setPricingMarginPercent(0);
        setPricingRoundingStep(100);
      }

      // Handle Units
      const existingUnits = Array.isArray(data.units) ? (data.units as UnitOption[]) : [];
      let mergedUnits = [...existingUnits];

      // Ensure base unit is at index 0
      const baseIdx = mergedUnits.findIndex(u => u.code?.toUpperCase() === baseUnit);
      if (baseIdx >= 0) {
        const [baseObj] = mergedUnits.splice(baseIdx, 1);
        mergedUnits.unshift({ ...baseObj, code: baseUnit, contains: 1, price: basePrice });
      } else {
        mergedUnits.unshift({ code: baseUnit, contains: 1, price: basePrice });
      }

      // Clean up units
      mergedUnits = mergedUnits.map(u => {
        const code = String(u.code || '').toUpperCase();
        const prices: ChannelPrices = {
          offline: cp.offline?.[code]?.price ?? u.prices?.offline,
          website: cp.website?.[code]?.price ?? u.prices?.website,
          shopee: cp.shopee?.[code]?.price ?? u.prices?.shopee,
          tiktok: cp.tiktok?.[code]?.price ?? u.prices?.tiktok,
        };

        return {
          ...u,
          code,
          contains: Number(u.contains || (code === baseUnit ? 1 : 0)),
          price: Number(u.price || 0),
          minQty: Number(u.minQty || 0),
          label: u.label || '',
          prices
        };
      });

      setUnits(mergedUnits);
    } catch (e) {
      console.error(e);
      toast.error("Gagal sinkron data produk");
    }
  }, [id, router]);

  const fetchWarehouses = useCallback(async () => {
    const snapshot = await sbGetDocs({ table: 'warehouses' });
    setWarehouses(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Warehouse)));
  }, []);

  const fetchCategories = useCallback(async () => {
    const snapshot = await sbGetDocs({ table: 'categories' });
    setCategories(snapshot.docs.map(d => ({ id: d.id, name: d.data().name })));
  }, []);

  // Prevent re-fetching on tab focus / auth state change
  useEffect(() => {
    const checkAuth = async () => {
      const { user } = await getUserAndRole();
      if (!user) return router.push('/profil/login');
      if (!isOperationalUser(user)) return router.push('/profil');
      
      if (!isInitialLoadedRef.current) {
        isInitialLoadedRef.current = true;
        await Promise.all([fetchProductData(), fetchWarehouses(), fetchCategories(), fetchCostHistory(), fetchPurchaseStats()]);
        setLoading(false);
      }
    };
    checkAuth();

    let __unsubscribe: (() => void) | undefined;
    (async () => {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
        checkAuth();
      });
      __unsubscribe = () => subscription.unsubscribe();
    })();

    return () => { if (__unsubscribe) __unsubscribe(); };
  }, [id, router, fetchProductData, fetchWarehouses, fetchCategories, fetchCostHistory, fetchPurchaseStats]);

  const handleSaveNewCategory = () => {
    const name = newKategoriInput.trim();
    if (!name) {
      toast.error('Nama kategori tidak boleh kosong');
      return;
    }
    const exists = categories.some(c => c.name.toLowerCase() === name.toLowerCase());
    if (!exists) {
      setCategories(prev => [...prev, { id: 'cat_' + Date.now(), name }]);
    }
    setFormData(prev => ({ ...prev, Kategori: name }));
    setNewKategoriInput('');
    toast.success(`Kategori "${name}" berhasil dipilih`);
  };

  const handleAddUnit = () => {
    if (!newUnitCode) return;
    const code = normalizeSatuan(newUnitCode).toUpperCase();
    if (units.some(u => u.code === code)) {
      toast.error('Satuan sudah ada');
      return;
    }
    setUnits([...units, { code, contains: 0, price: 0, label: '' }]);
    setNewUnitCode('');
  };

  const handleRemoveUnit = (index: number) => {
    setUnits(prev => prev.filter((_, i) => i !== index));
    toast.success('Satuan berhasil dihapus');
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressedFile = await imageCompression(file, { maxSizeMB: 0.25, maxWidthOrHeight: 800, useWebWorker: true, initialQuality: 0.7 });
      setImageFile(compressedFile);
      setImagePreview(URL.createObjectURL(compressedFile));
    } catch { toast.error("Gagal proses gambar"); }
  };

  const calculateProfit = (sellingPrice: number, costPrice: number) => {
    const profit = sellingPrice - costPrice;
    const percentage = costPrice > 0 ? (profit / costPrice) * 100 : 0;
    return { profit, percentage };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const loadingToast = toast.loading("Menyimpan perubahan...");

    try {
      // 0. Ensure Category exists — normalize and resolve '__NEW__' or input
      let categoryName = String(formData.Kategori || 'UMUM').trim();
      if (categoryName === '__NEW__' || !categoryName) {
        if (newKategoriInput.trim()) {
          categoryName = newKategoriInput.trim();
        } else {
          categoryName = 'UMUM';
        }
      }

      const existingCat = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
      if (!existingCat && categoryName && categoryName !== 'UMUM') {
        try {
          await sbInsertDoc('categories', {
            name: categoryName,
            slug: categoryName.toLowerCase().replace(/\s+/g, '-'),
            description: 'Auto-generated from product edit',
            createdAt: new Date().toISOString()
          });
        } catch (err) {
          console.error("Failed to auto-create category:", err);
        }
      }

      // 1. Ambil data stok lama untuk dibandingkan (Logika Audit)
      const oldDoc = await sbGetDoc('products', id);
      const oldData = oldDoc.data();
      const oldStocks = oldData?.stockByWarehouse || {};

      // 2. Proses Gambar
      let finalImageUrl = formData.Link_Foto || '';
      if (imageFile) {
        const compressed = await imageCompression(imageFile, { maxSizeMB: 0.25, maxWidthOrHeight: 800, useWebWorker: true, initialQuality: 0.7 });
        const fd = new FormData();
        fd.append('file', new File([compressed], imageFile.name, { type: compressed.type }));
        fd.append('folder', 'products');
        const uploadResult = await uploadImageAction(fd);
        if (uploadResult.success && uploadResult.url) {
          finalImageUrl = uploadResult.url;
        } else {
          toast.error(uploadResult.error || 'Gagal mengunggah foto produk');
          setIsSubmitting(false);
          return;
        }
      } else if (finalImageUrl.trim() && finalImageUrl.trim() !== originalImageUrlRef.current) {
        const fd = new FormData();
        fd.append('url', finalImageUrl.trim());
        fd.append('folder', 'products');
        const uploadResult = await uploadImageAction(fd);
        if (!uploadResult.success || !uploadResult.url) {
          toast.error(uploadResult.error || 'Gagal mengunduh foto dari URL');
          setIsSubmitting(false);
          return;
        }
        finalImageUrl = uploadResult.url;
      }

      // 3. Update Logic
      const baseUnit = String(formData.Satuan || 'PCS').trim().toUpperCase();
      const cleanedUnits = (units || [])
        .map((u) => {
          const code = String(u.code || '').trim().toUpperCase();
          if (!code) return null;
          const contains = Number(u.contains || 0);
          const price = Number(u.price || 0);
          const unitEntry: UnitOption = { code, contains, price };
          if (u.prices) {
             const cleanedPrices: any = {};
             if (u.prices.offline !== undefined && u.prices.offline !== null) cleanedPrices.offline = Number(u.prices.offline);
             if (u.prices.website !== undefined && u.prices.website !== null) cleanedPrices.website = Number(u.prices.website);
             if (u.prices.shopee !== undefined && u.prices.shopee !== null) cleanedPrices.shopee = Number(u.prices.shopee);
             if (u.prices.tiktok !== undefined && u.prices.tiktok !== null) cleanedPrices.tiktok = Number(u.prices.tiktok);
             if (Object.keys(cleanedPrices).length > 0) {
                 unitEntry.prices = cleanedPrices;
             }
          }
          if (u.minQty !== undefined) unitEntry.minQty = Number(u.minQty);
          if (u.label) unitEntry.label = String(u.label);
          if (u.barcode) unitEntry.barcode = String(u.barcode).trim();
          return unitEntry;
        })
        .filter(Boolean) as UnitOption[];

      const basePriceFromUnits = cleanedUnits.find((u) => u.code === baseUnit)?.price;
      const nextEcer = (typeof basePriceFromUnits === 'number' && !Number.isNaN(basePriceFromUnits))
        ? basePriceFromUnits
        : Number(formData.Ecer || 0);

      const baseUnitEntry: UnitOption = { 
        code: baseUnit, 
        contains: 1, 
        price: nextEcer, 
        label: '' 
      };
      
      const foundBaseUnit = cleanedUnits.find(u => u.code === baseUnit);
      if (foundBaseUnit?.prices) {
        baseUnitEntry.prices = foundBaseUnit.prices;
      }
      if (foundBaseUnit?.barcode) {
        baseUnitEntry.barcode = foundBaseUnit.barcode;
      }

      const ensuredBase = [
        baseUnitEntry,
        ...cleanedUnits.filter((u) => u.code !== baseUnit),
      ];

      // Construct Channel Pricing
      const channelPricing: any = { offline: {}, website: {}, shopee: {}, tiktok: {} };
      ensuredBase.forEach(u => {
        if (u.prices) {
          if (u.prices.offline !== undefined) channelPricing.offline[u.code] = { price: Number(u.prices.offline) };
          if (u.prices.website !== undefined) channelPricing.website[u.code] = { price: Number(u.prices.website) };
          if (u.prices.shopee !== undefined) channelPricing.shopee[u.code] = { price: Number(u.prices.shopee) };
          if (u.prices.tiktok !== undefined) channelPricing.tiktok[u.code] = { price: Number(u.prices.tiktok) };
        }
      });

      // Prepare Stock Data (edit per-gudang)
      const newStocks: Record<string, number> = { ...(formData.stockByWarehouse || {}) };
      const totalStock = Object.values(newStocks).reduce((sum: number, v: any) => sum + Number(v || 0), 0);
      
      // LOG STOCK CHANGES untuk setiap gudang yang berubah
      const logEntries: any[] = [];
      for (const [whId, nv] of Object.entries(newStocks)) {
        const newVal = Number(nv || 0);
        const oldVal = Number((oldStocks as any)[whId] || 0);
        if (oldVal !== newVal) {
          const whName = warehouses.find((w) => w.id === whId)?.name || whId;
          logEntries.push({
            productId: id,
            productName: (formData.Nama || '').toString().toUpperCase(),
            warehouseId: whId,
            warehouseName: whName,
            previousStock: oldVal,
            newStock: newVal,
            change: newVal - oldVal,
            type: stockReason,
            adminEmail: (await supabase.auth.getUser()).data.user?.email || 'system',
            createdAt: new Date().toISOString(),
          });
        }
      }

      const updatePayload = {
        ...formData,
        ID: formData.ID,
        Nama: String(formData.Nama || '').toUpperCase(),
        Kategori: categoryName,
        Satuan: baseUnit,
        sku: formData.ID,
        name: String(formData.Nama || '').toUpperCase(),
        category: categoryName,
        unit: baseUnit,
        description: formData.Deskripsi || '',
        stock: totalStock,
        Stok: totalStock,
        stockByWarehouse: newStocks,
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
        imageUrl: finalImageUrl,
        image: finalImageUrl,
        URL_Produk: finalImageUrl,
        isActive: Number(formData.Status) === 1,
        Status: Number(formData.Status) === 1 ? 1 : 0,
        warehouseId: formData.warehouseId || oldData?.warehouseId || '',
        tgl_masuk: formData.tgl_masuk || '',
        expired_date: formData.expired_date || formData.Expired_Default || '',
        expiredDate: formData.expired_date || formData.Expired_Default || '',
        Lokasi: formData.Lokasi || '',
        Supplier: formData.Supplier || '',
        No_WA_Supplier: formData.No_WA_Supplier || '',
        units: ensuredBase,
        channelPricing,
        minPurchase: Number(formData.minPurchase || 1),
        maxPurchase: Number(formData.maxPurchase || 0),
        dimensions: {
          length: Number(formData.dimLength || 0),
          width: Number(formData.dimWidth || 0),
          height: Number(formData.dimHeight || 0)
        },
        volumeInCtn: Number(formData.volumeInCtn || 0),
        pricingStrategy:
          pricingMode === 'RECOMMENDED' && pricingRec
            ? {
                mode: 'margin',
                ruleKey: pricingRec.rule.key,
                marginPercent: pricingRec.marginPercent,
                roundingStep: pricingRec.roundingStep,
              }
            : { mode: 'manual' },
        updatedAt: new Date().toISOString(),
      };

      // 1. Save to Supabase
      const saveRes = await saveEditedProduct(id, {
        name: String(formData.Nama || '').toUpperCase(),
        category: categoryName,
        unit: baseUnit,
        price: nextEcer,
        cost_price: Number(formData.Modal || 0),
        stock: totalStock,
        barcode: formData.Barcode || '',
        image_url: finalImageUrl,
        description: formData.Deskripsi || '',
        is_active: Number(formData.Status) === 1,
        raw_data: updatePayload,
        stockLogs: logEntries,
      });

      if (!saveRes.success) {
        throw new Error(saveRes.error || 'Gagal menyimpan produk ke database');
      }

      // 2. Safe sync to Firestore
      try {
        await sbUpsertDoc('products', id, updatePayload, { merge: true });
      } catch (fsErr) {
        console.warn('Firestore sync skipped or failed:', fsErr);
      }

      toast.dismiss(loadingToast);
      toast.success('Produk berhasil diperbarui!');
      if (saveRes.warning) toast(saveRes.warning, { duration: 6000 });
      router.push('/admin/products');
    } catch (err: any) {
      console.error(err);
      toast.dismiss(loadingToast);
      toast.error(err.message || 'Terjadi kesalahan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Apakah Anda yakin ingin menghapus produk ini? Data yang dihapus tidak dapat dikembalikan.')) return;
    setIsDeleting(true);
    const toastId = toast.loading('Menghapus produk...');
    try {
      const res = await deleteProduct(id);
      if (!res.success) {
        throw new Error(res.error || 'Gagal menghapus produk');
      }

      try {
        await sbDeleteDoc('products', id);
      } catch (fsErr) {
        console.warn('Firestore delete skipped or failed:', fsErr);
      }
      
      await sbInsertDoc('stock_logs', {
          productId: id,
          productName: formData.Nama.toUpperCase(),
          warehouseId: 'SYSTEM',
          warehouseName: 'SYSTEM',
          previousStock: formData.Stok,
          newStock: 0,
          change: -formData.Stok,
          type: 'DELETE_PRODUCT',
          adminEmail: (await supabase.auth.getUser()).data.user?.email,
          createdAt: new Date().toISOString(),
      });

      toast.success('Produk berhasil dihapus');
      router.push('/admin/products');
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Gagal menghapus produk');
      setIsDeleting(false);
    } finally {
      toast.dismiss(toastId);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div></div>;

  return (
    <div className="p-3 sm:p-4 md:p-6 bg-slate-50/70 text-slate-800 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header Navigation */}
        <div className="flex items-center justify-between bg-white p-4 sm:p-5 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <Link href="/admin/products" className="p-2.5 bg-slate-100 rounded-2xl hover:bg-slate-900 hover:text-white transition-all">
              <ChevronLeft size={20} />
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl font-black uppercase tracking-tight text-slate-900">Edit Produk</h1>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Inventaris & Informasi Produk</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push('/admin/products')}
              className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase hover:bg-slate-200 transition-all hidden sm:block"
            >
              Kembali
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* BAGIAN 1: IDENTITAS BARANG */}
          <div className="bg-white p-5 sm:p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100">
            <h3 className="text-xs font-black uppercase tracking-widest mb-6 flex items-center gap-2 border-b pb-4 text-blue-600">
              <Tag size={18} />
              Identitas Barang
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-black uppercase text-slate-400 ml-1 block mb-1">ID Produk *</label>
                <input
                  required
                  className="w-full p-3.5 bg-slate-50 rounded-2xl font-black outline-none border border-slate-200/80 focus:border-blue-500 focus:bg-white transition-all text-sm"
                  type="text"
                  value={formData.ID}
                  onChange={(e) => setFormData({ ...formData, ID: e.target.value })}
                  placeholder="Contoh: BRG-001"
                />
              </div>
              <div>
                <label className="text-xs font-black uppercase text-slate-400 ml-1 block mb-1">Parent ID</label>
                <input
                  className="w-full p-3.5 bg-slate-50 rounded-2xl font-black outline-none border border-slate-200/80 focus:border-blue-500 focus:bg-white transition-all text-sm"
                  type="text"
                  value={formData.Parent_ID}
                  onChange={(e) => setFormData({ ...formData, Parent_ID: e.target.value })}
                  placeholder="Opsional"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="text-xs font-black uppercase text-slate-400 ml-1 block mb-1">Lokasi Rak</label>
                <input 
                  className="w-full p-3.5 bg-slate-50 rounded-2xl font-black outline-none border border-slate-200/80 focus:border-blue-500 focus:bg-white transition-all text-sm" 
                  type="text" 
                  value={formData.Lokasi} 
                  onChange={e => setFormData({ ...formData, Lokasi: e.target.value })} 
                  placeholder="Contoh: Rak A-01"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="text-xs font-black uppercase text-slate-400 ml-1 block mb-1">Nama Produk *</label>
                <input 
                  required 
                  className="w-full p-3.5 bg-slate-50 rounded-2xl font-black outline-none border border-slate-200/80 focus:border-blue-500 focus:bg-white transition-all text-sm" 
                  type="text" 
                  value={formData.Nama} 
                  onChange={e => setFormData({ ...formData, Nama: e.target.value })} 
                />
              </div>

              {/* KATEGORI SELECTION WITH INSTANT ADD */}
              <div className="sm:col-span-2 lg:col-span-2">
                <label className="text-xs font-black uppercase text-slate-400 ml-1 block mb-1">Kategori Produk</label>
                {formData.Kategori === '__NEW__' ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      className="flex-1 p-3.5 bg-amber-50/80 border border-amber-300 rounded-2xl font-black text-xs outline-none focus:ring-2 focus:ring-amber-500"
                      type="text"
                      placeholder="Ketik nama kategori baru..."
                      value={newKategoriInput}
                      onChange={e => setNewKategoriInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveNewCategory();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleSaveNewCategory}
                      className="px-4 py-3.5 bg-amber-600 text-white rounded-2xl text-xs font-black uppercase hover:bg-amber-700 transition-all shrink-0 flex items-center gap-1"
                    >
                      <Plus size={14} /> Simpan
                    </button>
                    <button
                      type="button"
                      onClick={() => { setFormData({ ...formData, Kategori: 'UMUM' }); setNewKategoriInput(''); }}
                      className="px-3 py-3.5 bg-slate-100 text-slate-500 rounded-2xl text-xs font-black hover:bg-slate-200"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <select
                      className="flex-1 p-3.5 bg-slate-50 rounded-2xl font-black outline-none border border-slate-200/80 focus:border-blue-500 focus:bg-white transition-all text-xs"
                      value={formData.Kategori}
                      onChange={e => {
                        if (e.target.value === '__NEW__') {
                          setFormData({ ...formData, Kategori: '__NEW__' });
                        } else {
                          setFormData({ ...formData, Kategori: e.target.value });
                        }
                      }}
                    >
                      <option value="">— Pilih Kategori —</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                      <option value="__NEW__">＋ Tambah Kategori Baru...</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-black uppercase text-slate-400 ml-1 block mb-1">Brand / Merk</label>
                <input 
                  className="w-full p-3.5 bg-slate-50 rounded-2xl font-black outline-none border border-slate-200/80 focus:border-blue-500 focus:bg-white transition-all text-sm" 
                  type="text" 
                  value={formData.Brand} 
                  onChange={e => setFormData({ ...formData, Brand: e.target.value })} 
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-1">
                <label className="text-xs font-black uppercase text-slate-400 ml-1 flex justify-between items-center mb-1">
                  <span>Barcode / SKU</span>
                  <button type="button" onClick={() => setScannerReady(true)} className="text-blue-600 hover:text-blue-800 flex items-center gap-1 font-bold">
                    <Camera size={12} /> Scan
                  </button>
                </label>
                <div className="relative">
                  <Barcode size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    className="w-full pl-10 pr-3.5 py-3.5 bg-slate-50 rounded-2xl font-black outline-none border border-slate-200/80 focus:border-blue-500 focus:bg-white transition-all text-sm" 
                    type="text" 
                    value={formData.Barcode} 
                    onChange={e => setFormData({ ...formData, Barcode: e.target.value })} 
                  />
                </div>
                <CameraBarcodeScannerModal
                  isOpen={scannerReady}
                  onClose={() => { setScannerReady(false); setScanUnitBarcodeIdx(-1); }}
                  title={scanUnitBarcodeIdx >= 0 ? `Scan Barcode ${units[scanUnitBarcodeIdx]?.code || 'Satuan'}` : 'Scan Barcode Produk'}
                  description={scanUnitBarcodeIdx >= 0 ? `Arahkan kamera ke barcode kemasan ${units[scanUnitBarcodeIdx]?.code || ''}` : 'Arahkan kamera ke barcode / QR code produk'}
                  onScan={(code) => {
                    if (scanUnitBarcodeIdx >= 0) {
                      setUnits(prev => {
                        const next = [...prev];
                        next[scanUnitBarcodeIdx] = { ...next[scanUnitBarcodeIdx], barcode: code };
                        return next;
                      });
                      toast.success(`Barcode ${units[scanUnitBarcodeIdx]?.code} dipindai: ${code}`);
                    } else {
                      setFormData(prev => ({ ...prev, Barcode: code }));
                      toast.success(`Barcode dipindai: ${code}`);
                    }
                    setScanUnitBarcodeIdx(-1);
                  }}
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase text-slate-400 ml-1 block mb-1">Tgl Kadaluarsa</label>
                <div className="relative">
                  <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    className="w-full pl-10 pr-3.5 py-3.5 bg-slate-50 rounded-2xl font-black outline-none border border-slate-200/80 focus:border-blue-500 focus:bg-white transition-all text-xs" 
                    type="date" 
                    value={formData.Expired_Default} 
                    onChange={e => setFormData({ ...formData, Expired_Default: e.target.value, expired_date: e.target.value })} 
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-black uppercase text-slate-400 ml-1 block mb-1">Tgl Masuk Stok</label>
                <div className="relative">
                  <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    className="w-full pl-10 pr-3.5 py-3.5 bg-slate-50 rounded-2xl font-black outline-none border border-slate-200/80 focus:border-blue-500 focus:bg-white transition-all text-xs" 
                    type="date" 
                    value={formData.tgl_masuk} 
                    onChange={e => setFormData({ ...formData, tgl_masuk: e.target.value })} 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* BAGIAN 2: STOK & GUDANG */}
          <div className="bg-white p-5 sm:p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 mb-6 text-emerald-600 border-b pb-4">
              <Layers size={18} />
              <h3 className="text-xs font-black uppercase tracking-widest">Stok & Gudang</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-slate-400 ml-1 block">Satuan Utama</label>
                <input 
                  required 
                  type="text" 
                  placeholder="Pcs/Dus/Kg" 
                  className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 font-black text-sm uppercase focus:bg-white focus:border-emerald-500 outline-none" 
                  value={formData.Satuan} 
                  onChange={e => {
                    const newBase = e.target.value;
                    setFormData({ ...formData, Satuan: newBase });
                    setUnits(prev => {
                      if (prev.length === 0) return [{ code: newBase.toUpperCase() || 'PCS', contains: 1, price: formData.Ecer }];
                      const next = [...prev];
                      next[0] = { ...next[0], code: newBase.toUpperCase() || 'PCS' };
                      return next;
                    });
                  }} 
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-emerald-600 ml-1 block">Stok Saat Ini</label>
                <input 
                  required 
                  type="number" 
                  className="w-full p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-200 font-black text-emerald-800 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500" 
                  value={formData.Stok} 
                  onChange={e => setFormData({ ...formData, Stok: Number(e.target.value) })} 
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-rose-500 ml-1 block">Min. Stok Warning</label>
                <input 
                  required 
                  type="number" 
                  className="w-full p-3.5 bg-rose-50/70 rounded-2xl border border-rose-200 font-black text-rose-700 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-rose-400" 
                  value={formData.Min_Stok} 
                  onChange={e => setFormData({ ...formData, Min_Stok: Number(e.target.value) })} 
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-slate-400 ml-1 block">Gudang Utama</label>
                <select 
                  className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 font-bold text-xs outline-none" 
                  value={formData.warehouseId} 
                  onChange={e => setFormData({ ...formData, warehouseId: e.target.value })}
                >
                  <option value="">Pilih Gudang (Opsional)</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-blue-600 ml-1 block">Min. Pembelian Trx</label>
                <input 
                  type="number" 
                  min="1" 
                  className="w-full p-3.5 bg-blue-50/60 rounded-2xl border border-blue-200 font-black text-blue-800 text-sm outline-none" 
                  value={formData.minPurchase} 
                  onChange={e => setFormData({ ...formData, minPurchase: Number(e.target.value) })} 
                />
                <p className="text-[10px] text-slate-400 font-bold px-1 uppercase">Jumlah minimal dalam 1 transaksi</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-rose-600 ml-1 block">Max. Pembelian Trx</label>
                <input 
                  type="number" 
                  min="0" 
                  className="w-full p-3.5 bg-rose-50/60 rounded-2xl border border-rose-200 font-black text-rose-800 text-sm outline-none" 
                  value={formData.maxPurchase} 
                  onChange={e => setFormData({ ...formData, maxPurchase: Number(e.target.value) })} 
                />
                <p className="text-[10px] text-slate-400 font-bold px-1 uppercase">Jumlah maksimal (0 = Tanpa batas)</p>
              </div>
            </div>

            {/* DETAIL STOK PER GUDANG */}
            <div className="mt-6 pt-5 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <h4 className="text-xs font-black uppercase text-slate-400 ml-1">Rincian Stok Per Gudang</h4>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-400">Alasan Log Audit:</label>
                  <select
                    className="p-2 bg-slate-100 rounded-xl text-xs font-bold outline-none"
                    value={stockReason}
                    onChange={(e) => setStockReason(e.target.value as any)}
                  >
                    <option value="MANUAL">Adjust (Manual)</option>
                    <option value="OPNAME">Stock Opname</option>
                    <option value="TRANSFER">Transfer Gudang</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {warehouses.map((w) => {
                  const qty = Number(formData.stockByWarehouse?.[w.id] || 0);
                  return (
                    <div key={w.id} className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/70">
                      <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1 truncate">{w.name}</label>
                      <input
                        type="number"
                        min={0}
                        className="w-full bg-white p-2.5 rounded-xl text-xs font-black text-slate-800 outline-none border border-slate-200 focus:border-emerald-500"
                        value={qty}
                        onChange={(e) => {
                          const nextVal = Number(e.target.value || 0);
                          const nextMap = { ...(formData.stockByWarehouse || {}) , [w.id]: nextVal };
                          const nextTotal = Object.values(nextMap).reduce((sum: number, v: any) => sum + Number(v || 0), 0);
                          setFormData({
                            ...formData,
                            stockByWarehouse: nextMap,
                            Stok: nextTotal
                          });
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
          {/* BAGIAN 2.5: DIMENSI & VOLUME */}
          <div className="bg-white p-5 sm:p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 mb-6 text-blue-600 border-b pb-4">
              <Package size={18} />
              <h3 className="text-xs font-black uppercase tracking-widest">Dimensi & Volume (Kapasitas Gudang)</h3>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-slate-400 ml-1 block">Panjang (cm)</label>
                <input type="number" step="0.1" className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 font-bold text-sm outline-none" value={formData.dimLength || ''} onChange={e => {
                  const l = Number(e.target.value);
                  const vol = (l * formData.dimWidth * formData.dimHeight) / (34 * 20 * 24);
                  setFormData({ ...formData, dimLength: l, volumeInCtn: Number(vol.toFixed(4)) });
                }} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-slate-400 ml-1 block">Lebar (cm)</label>
                <input type="number" step="0.1" className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 font-bold text-sm outline-none" value={formData.dimWidth || ''} onChange={e => {
                  const w = Number(e.target.value);
                  const vol = (formData.dimLength * w * formData.dimHeight) / (34 * 20 * 24);
                  setFormData({ ...formData, dimWidth: w, volumeInCtn: Number(vol.toFixed(4)) });
                }} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-slate-400 ml-1 block">Tinggi (cm)</label>
                <input type="number" step="0.1" className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 font-bold text-sm outline-none" value={formData.dimHeight || ''} onChange={e => {
                  const h = Number(e.target.value);
                  const vol = (formData.dimLength * formData.dimWidth * h) / (34 * 20 * 24);
                  setFormData({ ...formData, dimHeight: h, volumeInCtn: Number(vol.toFixed(4)) });
                }} />
              </div>
              <div className="col-span-3 sm:col-span-1 p-3.5 bg-blue-50/70 rounded-2xl border border-blue-100 flex flex-col justify-center">
                <p className="text-[10px] font-black text-blue-500 uppercase mb-0.5">Volume Setara</p>
                <p className="text-lg font-black text-blue-700 leading-none">{formData.volumeInCtn} <span className="text-xs uppercase">CTN</span></p>
                <p className="text-[10px] font-bold text-blue-400 mt-1 uppercase">* Std: 34x20x24 cm</p>
              </div>
            </div>
          </div>

          {/* BAGIAN 3: HARGA & STRUKTUR HARGA */}
          <div className="bg-white p-5 sm:p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 mb-6 text-amber-600 border-b pb-4">
              <Tag size={18} />
              <h3 className="text-xs font-black uppercase tracking-widest">Struktur Harga</h3>
            </div>

            {/* NOMINAL AVG HPP CARD FROM PO */}
            {poStats.count > 0 ? (
              <div className="mb-6 p-4 sm:p-5 bg-emerald-50/80 rounded-2xl border border-emerald-200/90 shadow-sm transition-all">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2.5 bg-emerald-600 text-white rounded-2xl shrink-0 mt-0.5 shadow-sm">
                      <TrendingUp size={20} />
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-black uppercase tracking-wider text-emerald-900">Nominal Avg HPP (PO)</p>
                        <span className="px-2.5 py-0.5 bg-emerald-200/90 text-emerald-900 rounded-full text-[10px] font-black border border-emerald-300/60">
                          {poStats.count} PO ({poStats.totalQty} {formData.Satuan || 'unit'})
                        </span>
                      </div>
                      {(() => {
                        const roundedAvg = Math.round(poStats.avgCost || 0);
                        const roundedLatest = Math.round(poStats.latestPrice || 0);
                        return (
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <p className="text-base sm:text-lg font-black text-emerald-800 mt-0.5">
                              Rp {roundedAvg.toLocaleString('id-ID')}
                              <span className="text-xs font-bold text-emerald-700 ml-1">/ {formData.Satuan || 'Pcs'}</span>
                              {roundedLatest > 0 && roundedLatest !== roundedAvg && (
                                <span className="ml-2 text-xs font-bold text-slate-500">
                                  (PO Terakhir: Rp {roundedLatest.toLocaleString('id-ID')} / {formData.Satuan || 'Pcs'})
                                </span>
                              )}
                            </p>
                          </div>
                        );
                      })()}

                      {/* RINCIAN AVG HPP PER SATUAN YANG DITAMBAHKAN */}
                      {(() => {
                        const baseUnitName = String(formData.Satuan || 'PCS').trim().toUpperCase();
                        const breakdownList: Array<{ code: string; contains: number; avgCost: number; latestPrice: number }> = [];

                        const roundedAvg = Math.round(poStats.avgCost || 0);
                        const roundedLatest = Math.round(poStats.latestPrice || 0);

                        (units || []).forEach((u) => {
                          const code = String(u.code || '').trim().toUpperCase();
                          if (!code) return;
                          const contains = Number(u.contains || (code === baseUnitName ? 1 : 0));
                          if (contains <= 1 || code === baseUnitName) return;

                          breakdownList.push({
                            code,
                            contains,
                            avgCost: Math.round(roundedAvg * contains),
                            latestPrice: roundedLatest > 0 ? Math.round(roundedLatest * contains) : 0,
                          });
                        });

                        if (breakdownList.length === 0) return null;

                        return (
                          <div className="pt-2 border-t border-emerald-200/60 mt-2">
                            <p className="text-[10px] font-black uppercase text-emerald-800/80 tracking-wider mb-1.5">
                              Rincian Avg Modal Per Satuan:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {breakdownList.map((ub) => (
                                <div
                                  key={ub.code}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/90 border border-emerald-300/80 rounded-xl text-xs font-black text-emerald-950 shadow-2xs"
                                >
                                  <span className="text-emerald-700 font-extrabold">
                                    1 {ub.code} ({ub.contains} {formData.Satuan || 'Pcs'}):
                                  </span>
                                  <span className="text-emerald-900 font-black">
                                    Rp {ub.avgCost.toLocaleString('id-ID')}
                                  </span>
                                  {ub.latestPrice > 0 && ub.latestPrice !== ub.avgCost && (
                                    <span className="text-[10px] text-slate-500 font-medium">
                                      (PO Terakhir: Rp {ub.latestPrice.toLocaleString('id-ID')})
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const roundedAvg = Math.round(poStats.avgCost || 0);
                      setFormData(prev => ({ ...prev, Modal: roundedAvg }));
                      toast.success(`Avg Modal HPP (Rp ${roundedAvg.toLocaleString('id-ID')} / ${formData.Satuan || 'Pcs'}) berhasil diterapkan ke seluruh satuan!`);
                    }}
                    className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase rounded-xl transition-all shadow-sm shrink-0 flex items-center justify-center gap-1.5 self-stretch sm:self-auto"
                  >
                    <Check size={14} /> Terapkan Avg Modal
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-6 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/60 flex items-center gap-2 text-xs text-slate-400 font-bold">
                <Info size={16} className="shrink-0 text-slate-400" />
                <span>Nominal Avg HPP belum tersedia (belum ada riwayat Purchase Order tercatat untuk produk ini).</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-slate-400 ml-1 block">Harga Modal / Satuan Utama</label>
                <div className="flex bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 focus-within:ring-2 focus-within:ring-blue-500">
                  <input 
                    required 
                    type="number" 
                    className="w-full p-3.5 bg-transparent border-none font-black text-sm outline-none" 
                    value={formData.Modal} 
                    onChange={e => setFormData({ ...formData, Modal: Number(e.target.value) })} 
                  />
                  <select 
                    className="bg-slate-200 border-none font-bold text-slate-700 px-3 text-xs outline-none"
                    value={formData.Satuan_Modal || SATUAN_DEFAULT}
                    onChange={e => setFormData({ ...formData, Satuan_Modal: e.target.value })}
                  >
                    {SATUAN_LIST.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black uppercase text-slate-400 ml-1">Harga Ecer (Jual Utama)</label>
                  {formData.Ecer > 0 && formData.Modal > 0 && (
                    <ProfitBadge {...calculateProfit(formData.Ecer, formData.Modal)} />
                  )}
                </div>
                <input 
                  required 
                  type="number" 
                  disabled={pricingMode === 'RECOMMENDED'} 
                  className="w-full p-3.5 bg-blue-50/70 rounded-2xl border border-blue-200 font-black text-blue-700 text-sm focus:ring-2 focus:ring-blue-600 disabled:opacity-70 outline-none" 
                  value={formData.Ecer} 
                  onChange={e => setFormData({ ...formData, Ecer: Number(e.target.value) })} 
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-slate-400 ml-1 block">Harga Coret (Diskon)</label>
                <input 
                  type="number" 
                  className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 font-black text-slate-400 text-sm line-through outline-none" 
                  value={formData.Harga_Coret} 
                  onChange={e => setFormData({ ...formData, Harga_Coret: Number(e.target.value) })} 
                />
              </div>
            </div>

            {/* TAX BREAKDOWN PANEL */}
            {(() => {
              const ecer = Number(formData.Ecer || 0);
              if (ecer <= 0) return null;
              const category = formData.Kategori || '';
              const breakdown = calculateTaxBreakdown({ amount: ecer, category, taxSettings });
              const modal = Number(formData.Modal || 0);
              const marginAfterTax = modal > 0 && !breakdown.isExempt
                ? (((breakdown.dpp - modal) / modal) * 100).toFixed(1)
                : null;
              return (
                <div className={`mb-5 p-4 rounded-2xl border flex flex-col md:flex-row md:items-center gap-4 ${
                  !taxSettings.enabled
                    ? 'bg-slate-50 border-slate-200/60'
                    : breakdown.isExempt
                    ? 'bg-amber-50/70 border-amber-200'
                    : 'bg-indigo-50/70 border-indigo-200'
                }`}>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-lg">{!taxSettings.enabled ? '💤' : breakdown.isExempt ? '🟡' : '📋'}</span>
                    <div>
                      <p className={`text-xs font-black uppercase tracking-widest ${
                        !taxSettings.enabled ? 'text-slate-400' : breakdown.isExempt ? 'text-amber-800' : 'text-indigo-800'
                      }`}>Status Pajak</p>
                      <p className={`text-xs font-black ${
                        !taxSettings.enabled ? 'text-slate-500' : breakdown.isExempt ? 'text-amber-900' : 'text-indigo-900'
                      }`}>{breakdown.taxLabel}</p>
                    </div>
                  </div>
                  {taxSettings.enabled && !breakdown.isExempt && (
                    <>
                      <div className="w-px h-8 bg-indigo-200 hidden md:block" />
                      <div className="grid grid-cols-3 gap-4 flex-1">
                        <div>
                          <p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">DPP (Sebelum Pajak)</p>
                          <p className="text-sm font-black text-indigo-950">Rp {breakdown.dpp.toLocaleString('id-ID')}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">Pajak {breakdown.effectiveRate}%</p>
                          <p className="text-sm font-black text-rose-600">+Rp {breakdown.taxAmount.toLocaleString('id-ID')}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">Margin Riel (vs DPP)</p>
                          <p className={`text-sm font-black ${marginAfterTax !== null && Number(marginAfterTax) >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                            {marginAfterTax !== null ? `${marginAfterTax}%` : '-'}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {/* RECOMMENDATION MODE */}
            <div className="p-4 sm:p-5 bg-slate-50/80 rounded-2xl border border-slate-200/70 mb-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-slate-400 ml-1 block">Mode Penentuan Harga</label>
                  <select
                    className="w-full p-3.5 bg-white rounded-xl border border-slate-200 font-black text-xs shadow-sm outline-none"
                    value={pricingMode}
                    onChange={(e) => setPricingMode(e.target.value === 'RECOMMENDED' ? 'RECOMMENDED' : 'MANUAL')}
                  >
                    <option value="MANUAL">Manual</option>
                    <option value="RECOMMENDED">Ikuti rekomendasi margin</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-slate-400 ml-1 block">Profil Margin Target</label>
                  <select
                    disabled={pricingMode !== 'RECOMMENDED'}
                    className="w-full p-3.5 bg-white rounded-xl border border-slate-200 font-black text-xs shadow-sm disabled:opacity-60 outline-none"
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
                  <label className="text-xs font-black uppercase text-slate-400 ml-1 block">Margin (%)</label>
                  <input
                    type="number"
                    disabled={pricingMode !== 'RECOMMENDED'}
                    className="w-full p-3.5 bg-white rounded-xl border border-slate-200 font-black text-xs shadow-sm disabled:opacity-60 outline-none"
                    value={pricingMarginPercent || ''}
                    onChange={(e) => setPricingMarginPercent(Number(e.target.value || 0))}
                    placeholder={pricingRec ? String(pricingRec.marginPercent.toFixed(1)) : ''}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-slate-400 ml-1 block">Pembulatan</label>
                  <select
                    disabled={pricingMode !== 'RECOMMENDED'}
                    className="w-full p-3.5 bg-white rounded-xl border border-slate-200 font-black text-xs shadow-sm disabled:opacity-60 outline-none"
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
                <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t pt-3">
                  <div className="text-xs font-black text-slate-700">
                    Rekomendasi: Rp{pricingRec.recommendedPrice.toLocaleString('id-ID')} ({pricingRec.rule.label}, {pricingRec.rule.min}-{pricingRec.rule.max}%)
                  </div>
                  <div className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Efektif: {pricingRec.effectiveMarginPercent.toFixed(2)}%
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 sm:p-5 bg-amber-50/60 rounded-2xl border border-amber-200/80">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black uppercase text-amber-800 ml-1">Harga Grosir</label>
                  {formData.Grosir > 0 && formData.Modal > 0 && (
                    <ProfitBadge {...calculateProfit(formData.Grosir, formData.Modal)} />
                  )}
                </div>
                <input type="number" className="w-full p-3.5 bg-white rounded-xl border border-amber-200 font-black text-amber-900 text-sm shadow-sm outline-none" value={formData.Grosir} onChange={e => setFormData({ ...formData, Grosir: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-amber-800 ml-1 block">Min. Beli Grosir</label>
                <input type="number" className="w-full p-3.5 bg-white rounded-xl border border-amber-200 font-black text-amber-900 text-sm shadow-sm outline-none" value={formData.Min_Grosir} onChange={e => setFormData({ ...formData, Min_Grosir: Number(e.target.value) })} />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <span className="text-xs font-black uppercase text-slate-400">Status Produk</span>
              <select className="p-2.5 bg-slate-100 rounded-xl text-xs font-bold border outline-none" value={formData.Status} onChange={e => setFormData({ ...formData, Status: Number(e.target.value) })}>
                <option value={1}>Aktif (Bisa Transaksi)</option>
                <option value={0}>Non-Aktif (Arsip)</option>
              </select>
            </div>
          </div>

          {/* RIWAYAT PERUBAHAN MODAL */}
          {costHistory.length > 0 && (
            <div className="bg-white p-5 sm:p-6 rounded-[2rem] shadow-sm border border-slate-100">
              <h4 className="text-xs font-black uppercase text-slate-400 mb-4 flex items-center gap-2 border-b pb-3">
                <HistoryIcon size={16} /> Riwayat Perubahan Modal (HPP Audit Log)
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-xs text-slate-400 uppercase border-b">
                      <th className="py-2.5">Tanggal</th>
                      <th className="py-2.5">Admin</th>
                      <th className="py-2.5 text-right">Modal Lama</th>
                      <th className="py-2.5 text-right">Modal Baru</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs font-bold text-slate-700">
                    {costHistory.map((log: any) => (
                      <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="py-2.5">
                          {log.changeDate?.seconds ? new Date(log.changeDate.seconds * 1000).toLocaleDateString('id-ID') : '-'}
                        </td>
                        <td className="py-2.5">{log.adminEmail || 'System'}</td>
                        <td className="py-2.5 text-right text-slate-400">Rp{Number(log.oldCost || 0).toLocaleString('id-ID')}</td>
                        <td className="py-2.5 text-right text-slate-800 font-black">Rp{Number(log.newCost || 0).toLocaleString('id-ID')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* BAGIAN 3.5: SATUAN JUAL MULTI-LEVEL */}
          <div className="bg-white p-5 sm:p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 border-b pb-4">
              <div className="flex items-center gap-2 text-slate-800">
                <Tag size={18} />
                <h3 className="text-xs font-black uppercase tracking-widest">Satuan & Multilevel Harga</h3>
              </div>
              <div className="flex gap-2">
                <select
                  className="bg-slate-50 px-3 py-2 rounded-xl text-xs font-bold uppercase outline-none border focus:border-blue-500"
                  value={newUnitCode}
                  onChange={(e) => setNewUnitCode(e.target.value)}
                >
                  <option value="">-- Pilih Satuan Tambahan --</option>
                  {SATUAN_LIST.filter(s => !units.some(u => u.code === s.value)).map(s => (
                    <option key={s.value} value={s.value}>{s.label} – {s.desc}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddUnit}
                  disabled={!newUnitCode}
                  className="bg-slate-900 text-white px-3.5 py-2 rounded-xl text-xs font-black uppercase hover:bg-slate-800 transition-all disabled:opacity-40"
                >
                  + Tambah
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {units.map((u, index) => {
                const code = u.code || '';
                const idx = index;
                const current = u;
                const baseUnit = String(formData.Satuan || 'PCS').toUpperCase();
                const basePrice = Number(formData.Ecer || 0);
                const contains = Number(current.contains || (idx === 0 ? 1 : 0));
                const unitPrice = Number(current.price || 0);
                const perPcs = contains > 0 ? Math.round(unitPrice / contains) : 0;

                return (
                  <div key={idx} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 relative group space-y-3">
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveUnit(idx)}
                        className="absolute top-3 right-3 p-1.5 bg-rose-100 text-rose-600 rounded-lg opacity-80 sm:opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-200"
                        title="Hapus Satuan"
                      >
                        <X size={14} />
                      </button>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Kode Satuan</label>
                        <input 
                           type="text" 
                           className="w-full bg-white p-2.5 rounded-xl text-xs font-black text-slate-800 outline-none border focus:ring-2 focus:ring-blue-500 uppercase disabled:bg-slate-100 disabled:text-slate-500"
                           value={code}
                           disabled={idx === 0}
                           onChange={(e) => {
                             const val = e.target.value.toUpperCase();
                             const next = [...units];
                             next[idx] = { ...current, code: val };
                             setUnits(next);
                           }}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Label / Description</label>
                        <input
                          type="text"
                          className="w-full bg-white p-2.5 rounded-xl text-xs font-bold text-slate-700 outline-none border"
                          placeholder="Nama Satuan"
                          value={current.label || ''}
                          onChange={(e) => {
                            const next = [...units];
                            next[idx] = { ...current, label: e.target.value };
                            setUnits(next);
                          }}
                        />
                      </div>
                    </div>

                     {/* BARCODE PER SATUAN */}
                     <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase mb-1 flex items-center justify-between">
                         <span className="flex items-center gap-1"><Barcode size={10} /> Barcode {code}</span>
                         <button
                           type="button"
                           onClick={() => { setScanUnitBarcodeIdx(idx); setScannerReady(true); }}
                           className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                         >
                           <Camera size={10} /> Scan
                         </button>
                       </label>
                       <input
                         type="text"
                         className="w-full bg-white p-2.5 rounded-xl text-xs font-mono text-slate-700 outline-none border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
                         placeholder={`Barcode kemasan ${code}...`}
                         value={current.barcode || ''}
                         onChange={(e) => {
                           const next = [...units];
                           next[idx] = { ...current, barcode: e.target.value || undefined };
                           setUnits(next);
                         }}
                       />
                     </div>

                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-slate-600 uppercase">Harga Jual</span>
                        {Number(current.price) > 0 && formData.Modal > 0 && (
                           <span className={`text-[11px] font-bold ${calculateProfit(Number(current.price), formData.Modal * (current.contains || 1)).profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                             {calculateProfit(Number(current.price), formData.Modal * (current.contains || 1)).profit >= 0 ? '+' : ''}
                             {((calculateProfit(Number(current.price), formData.Modal * (current.contains || 1)).profit / (formData.Modal * (current.contains || 1))) * 100).toFixed(0)}%
                           </span>
                        )}
                        <input
                          type="number"
                          className="w-32 bg-white p-2.5 rounded-xl text-xs font-black text-right outline-none border border-slate-200 focus:border-blue-500"
                          value={current.price || ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? undefined : Number(e.target.value);
                            const next = [...units];
                            next[idx] = { ...current, price: val };
                            setUnits(next);
                          }}
                        />
                      </div>

                      {/* MODAL INPUT UNTUK SATUAN DUS / NON-BASE UNIT (FIXED MANUAL INPUT BUG) */}
                      {idx > 0 && (
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-dashed border-slate-200">
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-amber-700 uppercase">Modal / {code || 'Satuan'}</span>
                            <span className="text-[10px] font-bold text-slate-400">Total modal 1 {code || 'satuan'}</span>
                          </div>
                          <input
                            type="number"
                            placeholder="Nominal modal..."
                            className="w-32 bg-amber-50/80 p-2.5 rounded-xl text-xs font-black text-amber-900 text-right outline-none border border-amber-200 placeholder:text-amber-300 focus:bg-white focus:ring-2 focus:ring-amber-500"
                            value={formData.Modal && contains ? Math.round(formData.Modal * contains) : ''}
                            onChange={(e) => {
                              const inputValStr = e.target.value;
                              if (inputValStr === '') {
                                setFormData(prev => ({ ...prev, Modal: 0 }));
                                return;
                              }
                              const val = Number(inputValStr);
                              const c = contains && contains > 0 ? contains : 1;
                              const perPcsModal = Math.round(val / c);
                              setFormData(prev => ({ ...prev, Modal: perPcsModal }));
                            }}
                          />
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-slate-600 uppercase">Isi / Konversi ({baseUnit})</span>
                        <input
                          type="number"
                          disabled={idx === 0}
                          className="w-32 bg-white p-2.5 rounded-xl text-xs font-black text-right outline-none border border-slate-200 disabled:opacity-60"
                          value={idx === 0 ? 1 : (current.contains || '')}
                          onChange={(e) => {
                            const val = e.target.value === '' ? undefined : Number(e.target.value);
                            const next = [...units];
                            next[idx] = { ...current, contains: idx === 0 ? 1 : val };
                            setUnits(next);
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-slate-600 uppercase">Min Qty Jual</span>
                        <input
                          type="number"
                          min="0"
                          className="w-32 bg-white p-2.5 rounded-xl text-xs font-black text-right outline-none border border-slate-200"
                          value={current.minQty || ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? undefined : Number(e.target.value);
                            const next = [...units];
                            next[idx] = { ...current, minQty: val };
                            setUnits(next);
                          }}
                        />
                      </div>

                      {/* CHANNEL PRICING */}
                      <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 space-y-2">
                        <p className="text-[10px] font-black text-blue-600 uppercase">Harga Khusus Channel</p>
                        <div className="grid grid-cols-2 gap-2">
                           <div>
                              <div className="flex justify-between">
                                <label className="text-[10px] text-slate-400 uppercase flex items-center gap-1"><Store size={10}/> Offline</label>
                              </div>
                              <input type="number" placeholder="Default" className="w-full bg-white p-1.5 rounded-lg text-xs font-bold border outline-none" 
                                value={current.prices?.offline || ''}
                                onChange={e => {
                                  const val = e.target.value ? Number(e.target.value) : undefined;
                                  const next = [...units];
                                  next[idx] = { ...current, prices: { ...current.prices, offline: val } };
                                  setUnits(next);
                                }}
                              />
                           </div>
                           <div>
                              <div className="flex justify-between">
                                <label className="text-[10px] text-slate-400 uppercase flex items-center gap-1"><Globe size={10}/> Website</label>
                              </div>
                              <input type="number" placeholder="Default" className="w-full bg-white p-1.5 rounded-lg text-xs font-bold border outline-none" 
                                value={current.prices?.website || ''}
                                onChange={e => {
                                  const val = e.target.value ? Number(e.target.value) : undefined;
                                  const next = [...units];
                                  next[idx] = { ...current, prices: { ...current.prices, website: val } };
                                  setUnits(next);
                                }}
                              />
                           </div>
                           <div>
                              <div className="flex justify-between">
                                <label className="text-[10px] text-slate-400 uppercase flex items-center gap-1"><ShoppingBag size={10}/> Shopee</label>
                              </div>
                              <input type="number" placeholder="Default" className="w-full bg-white p-1.5 rounded-lg text-xs font-bold border outline-none" 
                                value={current.prices?.shopee || ''}
                                onChange={e => {
                                  const val = e.target.value ? Number(e.target.value) : undefined;
                                  const next = [...units];
                                  next[idx] = { ...current, prices: { ...current.prices, shopee: val } };
                                  setUnits(next);
                                }}
                              />
                           </div>
                           <div>
                              <div className="flex justify-between">
                                <label className="text-[10px] text-slate-400 uppercase flex items-center gap-1"><Video size={10}/> TikTok</label>
                              </div>
                              <input type="number" placeholder="Default" className="w-full bg-white p-1.5 rounded-lg text-xs font-bold border outline-none" 
                                value={current.prices?.tiktok || ''}
                                onChange={e => {
                                  const val = e.target.value ? Number(e.target.value) : undefined;
                                  const next = [...units];
                                  next[idx] = { ...current, prices: { ...current.prices, tiktok: val } };
                                  setUnits(next);
                                }}
                              />
                           </div>
                        </div>
                      </div>

                      <div className="text-[11px] font-black text-slate-500 pt-2 border-t border-slate-200">
                        {code} - Rp{Number(unitPrice || 0).toLocaleString('id-ID')}{' '}
                        <span className="text-[10px] font-bold text-slate-400 block">Isi {contains || 1} {baseUnit} ( Rp {perPcs.toLocaleString('id-ID')} /{baseUnit} )</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* BAGIAN 4: MEDIA & SUPPLIER */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
              <h3 className="text-xs font-black uppercase text-slate-400 mb-4 flex items-center gap-2 border-b pb-3">
                <ImageIcon size={16} /> Foto & Deskripsi Produk
              </h3>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-28 h-28 border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden relative flex items-center justify-center bg-slate-50 shrink-0">
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" width={112} height={112} onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo-atayatoko.png'; }} />
                    ) : (
                      <ImageIcon size={24} className="text-slate-300" />
                    )}
                  </div>
                  <label className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-2xl cursor-pointer text-xs font-black text-slate-700 transition-all">
                    Ganti Foto
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageChange}
                    />
                  </label>
                </div>
                <input 
                  type="text" 
                  placeholder="URL Foto Produk (Opsional)" 
                  className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 font-bold text-xs outline-none focus:bg-white focus:border-blue-500" 
                  value={formData.Link_Foto} 
                  onChange={e => { setFormData({ ...formData, Link_Foto: e.target.value }); setImagePreview(e.target.value || null); }} 
                />
                <textarea 
                  rows={3} 
                  placeholder="Deskripsi Singkat Produk..." 
                  className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 font-bold text-xs outline-none focus:bg-white focus:border-blue-500" 
                  value={formData.Deskripsi} 
                  onChange={e => setFormData({ ...formData, Deskripsi: e.target.value })}
                ></textarea>
              </div>
            </div>

            {/* SUPPLIER CARD WITH AUTO PO INTEGRATION & HISTORICAL VENDORS */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-[2.5rem] shadow-xl text-white">
              <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                <h3 className="text-xs font-black uppercase text-blue-100 flex items-center gap-2">
                  <Truck size={16} /> Supplier / Vendor
                </h3>
                {poStats.suppliers && poStats.suppliers.length > 0 && (
                  <span className="text-[10px] font-black px-2.5 py-1 bg-white/20 text-white rounded-full uppercase tracking-wider backdrop-blur-sm">
                    {poStats.suppliers.length} Supplier PO Recorded
                  </span>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-blue-200 ml-1 block mb-1">Nama Supplier Utaman / Pilihan</label>
                  <input 
                    type="text" 
                    placeholder="Nama Supplier" 
                    className="w-full p-3.5 bg-white/10 rounded-2xl border border-white/20 font-bold placeholder:text-blue-200 text-white text-sm outline-none focus:bg-white/20 focus:border-white transition-all" 
                    value={formData.Supplier} 
                    onChange={e => setFormData({ ...formData, Supplier: e.target.value })} 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-blue-200 ml-1 block mb-1">No. WA Supplier</label>
                  <input 
                    type="text" 
                    placeholder="628123456789" 
                    className="w-full p-3.5 bg-white/10 rounded-2xl border border-white/20 font-bold placeholder:text-blue-200 text-white text-sm outline-none focus:bg-white/20 focus:border-white transition-all" 
                    value={formData.No_WA_Supplier} 
                    onChange={e => setFormData({ ...formData, No_WA_Supplier: e.target.value })} 
                  />
                </div>

                {/* DAFTAR RIWAYAT SUPPLIER / VENDOR DARI PO */}
                {poStats.suppliers && poStats.suppliers.length > 0 && (
                  <div className="pt-3 border-t border-white/10 space-y-2">
                    <p className="text-[10px] font-black uppercase text-blue-200 tracking-wider">
                      Riwayat Supplier / Vendor (Pernah Beli):
                    </p>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {poStats.suppliers.map((sup, idx) => {
                        const isSelected = formData.Supplier && formData.Supplier.trim().toLowerCase() === sup.name.trim().toLowerCase();
                        return (
                          <div
                            key={idx}
                            className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                              isSelected
                                ? 'bg-white/25 border-white text-white shadow-sm'
                                : 'bg-white/10 border-white/15 hover:bg-white/20 text-blue-50'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-black text-xs text-white truncate">{sup.name}</span>
                                {isSelected && (
                                  <span className="px-2 py-0.5 bg-emerald-500 text-white rounded-full text-[9px] font-black uppercase shadow-xs">
                                    ✓ Aktif
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-blue-100 font-bold mt-0.5">
                                {sup.count}x PO ({sup.totalQty} {formData.Satuan || 'unit'})
                                {sup.lastPrice > 0 && ` • Terakhir: Rp ${Math.round(sup.lastPrice).toLocaleString('id-ID')}`}
                              </p>
                              {sup.phone && (
                                <p className="text-[10px] text-blue-300 font-mono mt-0.5">WA: {sup.phone}</p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setFormData(prev => ({
                                  ...prev,
                                  Supplier: sup.name,
                                  No_WA_Supplier: sup.phone || prev.No_WA_Supplier,
                                }));
                                toast.success(`Supplier "${sup.name}" dipilih`);
                              }}
                              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all shrink-0 shadow-sm ${
                                isSelected
                                  ? 'bg-emerald-500 text-white cursor-default'
                                  : 'bg-white text-blue-900 hover:bg-blue-50 active:scale-95'
                              }`}
                            >
                              {isSelected ? 'Terpilih' : 'Gunakan'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row gap-4 pt-4">
            <button 
                type="button" 
                onClick={handleDelete}
                disabled={isSubmitting || isDeleting}
                className="p-4 sm:p-5 bg-rose-50 text-rose-600 font-black uppercase text-xs rounded-2xl shadow-sm border border-rose-100 hover:bg-rose-100 transition-all flex items-center justify-center gap-2"
            >
               <Trash2 size={18} /> Hapus Produk
            </button>
            <div className="flex-1 flex gap-3">
                <button type="button" onClick={() => router.back()} className="flex-1 p-4 sm:p-5 bg-white text-slate-500 font-black uppercase text-xs rounded-2xl shadow-sm border border-slate-200 hover:bg-slate-100 transition-all">
                Batal
                </button>
                <button type="submit" disabled={isSubmitting || isDeleting} className="flex-[2] p-4 sm:p-5 bg-slate-900 text-white font-black uppercase text-xs rounded-2xl shadow-xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 tracking-wider">
                {isSubmitting ? 'MENYIMPAN...' : <><Save size={18} /> Simpan Perubahan</>}
                </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
