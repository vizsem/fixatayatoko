'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Tag, Truck, Save, Layers, Trash2,
  Barcode, Image as ImageIcon, AlertCircle, ChevronLeft, Calendar, History as HistoryIcon,
  Store, Globe, ShoppingBag, Video, TrendingUp, TrendingDown, Camera, X, Package, Check, Info, Sparkles, Plus,
  ShieldAlert, EyeOff, Clock, Scale, ArrowUpRight, ExternalLink, RotateCcw, ChevronDown
} from 'lucide-react';
import Link from 'next/link';
import imageCompression from 'browser-image-compression';
import { toast } from 'react-hot-toast';
import CameraBarcodeScannerModal from '@/components/scanner/CameraBarcodeScannerModal';
import { playScanBeep } from '@/lib/sound';
import QuickVariantModal from '@/components/admin/QuickVariantModal';
import { MARGIN_RULES, recommendSellingPrice, type PricingStrategy } from '@/lib/normalize';
import { SATUAN_LIST, SATUAN_DEFAULT, normalizeSatuan } from '@/lib/constants/satuan';
import { supabase } from '@/lib/supabase';
import { getProductByIdForEdit, saveEditedProduct, deleteProduct, generateNextSkuAction } from '@/lib/actions/product.actions';
import { generateVariantSku } from '@/lib/sku-generator';
import { getPurchaseStatsByProductId } from '@/lib/actions/purchase.actions';
import { uploadImageAction } from '@/lib/actions/upload.actions';
import { isOperationalUser } from '@/lib/auth-helpers';
import { getUserAndRole, sbDeleteDoc, sbGetDoc, sbGetDocs, sbInsertDoc, sbUpsertDoc } from '@/lib/supabase-helpers';
import { calculateTaxBreakdown, DEFAULT_TAX_SETTINGS, isCategoryTaxExempt, type TaxSettings } from '@/lib/tax';
import { cleanCategoryName, EXCLUDED_CATEGORY_NAMES } from '@/lib/format';

function UnitModalCalculator({
  contains,
  baseModal,
  onBaseModalChange,
}: {
  contains: number;
  baseModal: number;
  onBaseModalChange: (newBase: number) => void;
}) {
  const [valStr, setValStr] = useState(() => (baseModal && contains ? String(Math.round(baseModal * contains)) : ''));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setValStr(baseModal && contains ? String(Math.round(baseModal * contains)) : '');
    }
  }, [baseModal, contains, isFocused]);

  return (
    <input
      type="number"
      placeholder="Nominal modal..."
      className="w-32 bg-amber-50/80 px-3 py-2 rounded-xl text-xs font-bold text-amber-900 text-right outline-none border border-amber-200 placeholder:text-amber-300 focus:bg-white focus:ring-2 focus:ring-amber-500"
      value={valStr}
      onFocus={() => setIsFocused(true)}
      onBlur={() => {
        setIsFocused(false);
        setValStr(baseModal && contains ? String(Math.round(baseModal * contains)) : '');
      }}
      onChange={(e) => {
        const str = e.target.value;
        setValStr(str);
        if (str === '') {
          onBaseModalChange(0);
        } else {
          const val = Number(str);
          if (!isNaN(val) && contains > 0) {
            onBaseModalChange(Number((val / contains).toFixed(4)));
          }
        }
      }}
    />
  );
}

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
  weight?: number; // Berat per satuan dalam gram
  prices?: ChannelPrices;
};

interface Warehouse {
  id: string;
  name: string;
}

function ProfitBadge({ profit, percentage }: { profit: number; percentage: number }) {
  const isProfitable = profit >= 0;
  return (
    <div className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg ${isProfitable ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
      {isProfitable ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      <span>
        {isProfitable ? '+' : ''}Rp{profit.toLocaleString('id-ID')} ({percentage.toFixed(1)}%)
      </span>
    </div>
  );
}

function formatWeightDisplay(grams: number) {
  if (!grams || grams <= 0) return '0 g';
  if (grams >= 1000) {
    const kg = grams / 1000;
    return `${grams.toLocaleString('id-ID')} g (${kg.toLocaleString('id-ID', { maximumFractionDigits: 2 })} kg)`;
  }
  return `${grams.toLocaleString('id-ID')} gram`;
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
  const [hideBaseUnit, setHideBaseUnit] = useState(false);
  const [defaultSellUnit, setDefaultSellUnit] = useState('');
  const [newKategoriInput, setNewKategoriInput] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile2, setImageFile2] = useState<File | null>(null);
  const [imagePreview2, setImagePreview2] = useState<string | null>(null);
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
  const [showVariantModal, setShowVariantModal] = useState(false);

  const [formData, setFormData] = useState({
    ID: '',
    Barcode: '',
    Parent_ID: '',
    isParentOnly: false,
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
    weight: 0, // Berat satuan dasar dalam gram
    Link_Foto: '',
    Link_Foto2: '',
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

  // Pre-Order State
  const [isPreOrder, setIsPreOrder] = useState(false);
  const [poLeadTimeDays, setPoLeadTimeDays] = useState(3);
  const [poNotes, setPoNotes] = useState('');
  const [isTaxable, setIsTaxable] = useState<boolean>(true);

  // Cost History State
  const [costHistory, setCostHistory] = useState<any[]>([]);
  const [stockReason, setStockReason] = useState<'MANUAL' | 'OPNAME' | 'TRANSFER'>('MANUAL');
  const [scannerReady, setScannerReady] = useState(false);
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
      next.unshift({ code: baseUnit, contains: 1, price, label: '', weight: formData.weight });
      return next;
    });
  };

  useEffect(() => {
    if (pricingMode !== 'RECOMMENDED') return;
    if (!pricingRec) return;
    if (Number(formData.Ecer || 0) === pricingRec.recommendedPrice) return;
    applyRecommendedEcer(pricingRec.recommendedPrice);
  }, [pricingMode, pricingRec, formData.Ecer, formData.Satuan]);

  // Satuan yang tersedia untuk input Harga Modal (Satuan Utama + Satuan Jual terdaftar)
  const baseUnitCode = String(formData.Satuan || 'PCS').trim().toUpperCase();
  const availableModalUnits = useMemo(() => {
    const list: { code: string; contains: number; label: string }[] = [
      { code: baseUnitCode, contains: 1, label: `${baseUnitCode} (Utama)` }
    ];
    for (const u of units) {
      const code = String(u.code || '').trim().toUpperCase();
      if (code && code !== baseUnitCode && !list.some(x => x.code === code)) {
        const contains = Number(u.contains || 0);
        list.push({
          code,
          contains: contains > 0 ? contains : 1,
          label: `${code} ${contains > 1 ? `(Isi ${contains} ${baseUnitCode})` : ''}`.trim()
        });
      }
    }
    return list;
  }, [baseUnitCode, units]);

  const activeModalUnitCode = useMemo(() => {
    const cur = String(formData.Satuan_Modal || '').trim().toUpperCase();
    if (availableModalUnits.some(u => u.code === cur)) return cur;
    return baseUnitCode;
  }, [formData.Satuan_Modal, availableModalUnits, baseUnitCode]);

  const activeModalUnitObj = useMemo(() => {
    return availableModalUnits.find(u => u.code === activeModalUnitCode) || availableModalUnits[0];
  }, [availableModalUnits, activeModalUnitCode]);

  const [modalInputStr, setModalInputStr] = useState<string>('');
  const [isModalInputFocused, setIsModalInputFocused] = useState<boolean>(false);

  // Sync modalInputStr saat tidak sedang fokus mengetik
  useEffect(() => {
    if (!isModalInputFocused) {
      const ratio = activeModalUnitObj?.contains || 1;
      const currentModal = Number(formData.Modal || 0);
      if (currentModal > 0) {
        setModalInputStr(String(Math.round(currentModal * ratio)));
      } else {
        setModalInputStr('');
      }
    }
  }, [formData.Modal, activeModalUnitObj, isModalInputFocused]);

  const handleModalInputChange = (valStr: string) => {
    setModalInputStr(valStr);
    const ratio = activeModalUnitObj?.contains || 1;
    if (valStr.trim() === '') {
      setFormData(prev => ({
        ...prev,
        Modal: 0,
        Satuan_Modal: activeModalUnitCode
      }));
      return;
    }
    const val = Number(valStr);
    if (!isNaN(val)) {
      const baseModal = ratio > 1 ? Number((val / ratio).toFixed(4)) : val;
      setFormData(prev => ({
        ...prev,
        Modal: baseModal,
        Satuan_Modal: activeModalUnitCode
      }));
    }
  };

  const handleModalUnitChange = (newCode: string) => {
    const targetObj = availableModalUnits.find(u => u.code === newCode) || availableModalUnits[0];
    const ratio = targetObj.contains || 1;
    const currentModal = Number(formData.Modal || 0);
    setFormData(prev => ({
      ...prev,
      Satuan_Modal: newCode
    }));
    if (currentModal > 0) {
      setModalInputStr(String(Math.round(currentModal * ratio)));
    } else {
      setModalInputStr('');
    }
  };

  // --- BERAT PRODUK: HITUNG OTOMATIS BERAT DARI TERKECIL KE TERBESAR ---
  const handleBaseWeightChange = (newWeight: number) => {
    const safeW = Math.max(0, newWeight);
    setFormData(prev => ({ ...prev, weight: safeW }));

    // Otomatis update berat di semua satuan bertingkat jika contains > 0
    setUnits(prev => prev.map((u, i) => {
      if (i === 0) {
        return { ...u, weight: safeW };
      }
      const contains = Number(u.contains || 1);
      const computedWeight = safeW > 0 ? Number((safeW * contains).toFixed(2)) : 0;
      return {
        ...u,
        weight: computedWeight,
      };
    }));
  };

  const handleUnitContainsChange = (idx: number, newContains: number) => {
    const safeContains = Math.max(1, newContains);
    setUnits(prev => {
      const next = [...prev];
      const baseW = Number(formData.weight || 0);
      const autoW = baseW > 0 ? Number((baseW * safeContains).toFixed(2)) : (next[idx].weight || 0);
      next[idx] = {
        ...next[idx],
        contains: safeContains,
        weight: autoW,
      };
      return next;
    });
  };

  const handleUnitWeightChange = (idx: number, newWeight: number) => {
    const safeW = Math.max(0, newWeight);
    setUnits(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], weight: safeW };
      return next;
    });
  };

  const handleResetUnitWeight = (idx: number) => {
    const baseW = Number(formData.weight || 0);
    const contains = Number(units[idx]?.contains || 1);
    const autoW = baseW > 0 ? Number((baseW * contains).toFixed(2)) : 0;
    setUnits(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], weight: autoW };
      return next;
    });
    toast.success(`Berat ${units[idx]?.code} dihitung otomatis: ${formatWeightDisplay(autoW)}`);
  };

  const fetchCostHistory = useCallback(async () => {
    try {
      const snap = await sbGetDocs({
        table: 'product_cost_logs',
        where: [{ field: 'productId', op: '==', val: id }],
        limit: 10
      });
      if (snap.docs.length > 0) {
        const sorted = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .sort((a, b) => new Date(b.created_at || b.changeDate || 0).getTime() - new Date(a.created_at || a.changeDate || 0).getTime());
        setCostHistory(sorted);
      }
    } catch { /* ignore */ }
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
        const realSku = (spRow.sku || raw.ID || raw.sku || '').toString().trim();
        data = {
          ...raw,
          ID: realSku || spRow.id,
          sku: realSku || spRow.id,
          Nama: spRow.name || raw.Nama || raw.name || '',
          Kategori: spRow.category || raw.Kategori || raw.category || 'UMUM',
          Satuan: spRow.unit || raw.Satuan || raw.unit || 'PCS',
          Stok: Number(spRow.stock ?? raw.Stok ?? raw.stock ?? 0),
          Modal: Number(spRow.cost_price ?? raw.Modal ?? raw.purchasePrice ?? 0),
          Ecer: Number(spRow.price ?? raw.Ecer ?? raw.price ?? 0),
          Barcode: spRow.barcode || raw.Barcode || raw.barcode || '',
          Link_Foto: spRow.image_url || raw.Link_Foto || raw.imageUrl || raw.image || raw.URL_Produk || '',
          Link_Foto2: (raw.Link_Foto2 || raw.image_url2 || raw.imageUrl2 || ''),
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
      const rawWeight = Number(data.weight ?? data.berat ?? data.raw_data?.weight ?? data.raw_data?.berat ?? 0);

      setFormData(prev => ({
        ...prev,
        ID: (data.ID || data.sku || spRow?.sku || id).toString().trim(),
        Barcode: data.Barcode || '',
        Parent_ID: data.Parent_ID || '',
        isParentOnly: Boolean(data.isParentOnly || (data as any).is_parent_only || (data.raw_data as any)?.isParentOnly || (data.raw_data as any)?.is_parent_only),
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
        weight: rawWeight,
        Link_Foto: data.Link_Foto || data.URL_Produk || data.image_url || data.imageUrl || data.image || '',
        Link_Foto2: data.Link_Foto2 || data.image_url2 || data.imageUrl2 || '',
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
      const initialImg2 = data.Link_Foto2 || data.image_url2 || data.imageUrl2 || '';
      if (initialImg2) {
        setImagePreview2(initialImg2);
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

      setIsPreOrder(Boolean(data.isPreOrder ?? (data as any).raw_data?.isPreOrder));
      setPoLeadTimeDays(Number(data.poLeadTimeDays ?? (data as any).raw_data?.poLeadTimeDays ?? 3));
      setPoNotes(String(data.poNotes ?? (data as any).raw_data?.poNotes ?? ''));

      const rawTaxable = data.isTaxable ?? (data as any).raw_data?.isTaxable;
      setIsTaxable(rawTaxable !== undefined ? Boolean(rawTaxable) : !isCategoryTaxExempt(data.Kategori || data.category));

      // Handle Units
      const existingUnits = Array.isArray(data.units) ? (data.units as UnitOption[]) : [];
      let mergedUnits = [...existingUnits];

      // Ensure base unit is at index 0
      const baseIdx = mergedUnits.findIndex(u => u.code?.toUpperCase() === baseUnit);
      if (baseIdx >= 0) {
        const [baseObj] = mergedUnits.splice(baseIdx, 1);
        mergedUnits.unshift({ ...baseObj, code: baseUnit, contains: 1, price: basePrice, weight: rawWeight });
      } else {
        mergedUnits.unshift({ code: baseUnit, contains: 1, price: basePrice, weight: rawWeight });
      }

      // Clean up units & propagate auto weight if exists
      mergedUnits = mergedUnits.map(u => {
        const code = String(u.code || '').toUpperCase();
        const contains = Number(u.contains || (code === baseUnit ? 1 : 0));
        const autoWeight = rawWeight > 0 && contains > 0 ? Number((rawWeight * contains).toFixed(2)) : 0;
        const uWeight = u.weight !== undefined && !isNaN(Number(u.weight)) ? Number(u.weight) : (code === baseUnit ? rawWeight : autoWeight);

        const prices: ChannelPrices = {
          offline: cp.offline?.[code]?.price ?? u.prices?.offline,
          website: cp.website?.[code]?.price ?? u.prices?.website,
          shopee: cp.shopee?.[code]?.price ?? u.prices?.shopee,
          tiktok: cp.tiktok?.[code]?.price ?? u.prices?.tiktok,
        };

        return {
          ...u,
          code,
          contains,
          price: Number(u.price || 0),
          minQty: Number(u.minQty || 0),
          label: u.label || '',
          barcode: u.barcode ? String(u.barcode).trim() : undefined,
          weight: uWeight,
          prices
        };
      });

      setUnits(mergedUnits);
      const isHidden = Boolean((data as any).hideBaseUnit ?? (data as any).hide_base_unit);
      setHideBaseUnit(isHidden);
      setDefaultSellUnit(String((data as any).defaultSellUnit ?? (data as any).default_sell_unit ?? ''));
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
    const seen = new Set<string>();
    const cleanList: { id: string; name: string }[] = [];
    snapshot.docs.forEach((d: any) => {
      const rawName = d.data()?.name || '';
      const clean = cleanCategoryName(rawName);
      const norm = clean.toLowerCase();
      if (norm && !EXCLUDED_CATEGORY_NAMES.has(norm) && !seen.has(norm)) {
        seen.add(norm);
        cleanList.push({ id: d.id, name: clean });
      }
    });
    cleanList.sort((a, b) => a.name.localeCompare(b.name, 'id-ID'));
    setCategories(cleanList);
  }, []);

  const [childVariants, setChildVariants] = useState<{ id: string; name: string; barcode?: string; stock: number }[]>([]);
  const [parentProduct, setParentProduct] = useState<{ id: string; name: string; stock: number } | null>(null);
  const [siblingVariants, setSiblingVariants] = useState<{ id: string; name: string; barcode?: string; stock: number }[]>([]);

  const fetchVariants = useCallback(async () => {
    const snap = await sbGetDocs({
      table: 'products',
      where: [{ field: 'raw_data->>Parent_ID', op: '==', val: id }],
      limit: 50,
    });
    if (snap.docs.length > 0) {
      setChildVariants(snap.docs.map(d => {
        const raw = d.data() as Record<string, unknown>;
        const rawData = (raw.raw_data || {}) as Record<string, unknown>;
        return {
          id: d.id,
          name: (raw.name || rawData.Nama || d.id) as string,
          barcode: (raw.barcode || rawData.Barcode || '') as string,
          stock: Number(raw.stock || 0),
        };
      }));
    } else {
      setChildVariants([]);
    }

    if (formData.Parent_ID) {
      try {
        const pSnap = await sbGetDoc('products', formData.Parent_ID);
        if (pSnap.exists()) {
          const pRaw = pSnap.data() as Record<string, unknown>;
          const pRawData = (pRaw.raw_data || {}) as Record<string, unknown>;
          setParentProduct({
            id: pSnap.id,
            name: (pRaw.name || pRawData.Nama || pSnap.id) as string,
            stock: Number(pRaw.stock || 0),
          });
        }
        const sibSnap = await sbGetDocs({
          table: 'products',
          where: [{ field: 'raw_data->>Parent_ID', op: '==', val: formData.Parent_ID }],
          limit: 50,
        });
        setSiblingVariants(sibSnap.docs
          .filter(d => d.id !== id)
          .map(d => {
            const raw = d.data() as Record<string, unknown>;
            const rawData = (raw.raw_data || {}) as Record<string, unknown>;
            return {
              id: d.id,
              name: (raw.name || rawData.Nama || d.id) as string,
              barcode: (raw.barcode || rawData.Barcode || '') as string,
              stock: Number(raw.stock || 0),
            };
          }));
      } catch { /* ignore */ }
    }
  }, [id, formData.Parent_ID]);

  useEffect(() => {
    const checkAuth = async () => {
      const { user } = await getUserAndRole();
      if (!user) return router.push('/profil/login');
      if (!isOperationalUser(user)) return router.push('/profil');
      
      if (!isInitialLoadedRef.current) {
        isInitialLoadedRef.current = true;
        await Promise.all([fetchProductData(), fetchWarehouses(), fetchCategories(), fetchCostHistory(), fetchPurchaseStats(), fetchVariants()]);
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
  }, [id, router, fetchProductData, fetchWarehouses, fetchCategories, fetchCostHistory, fetchPurchaseStats, fetchVariants]);

  useEffect(() => {
    if (formData.Parent_ID) {
      fetchVariants();
    }
  }, [formData.Parent_ID, fetchVariants]);

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
    const baseW = Number(formData.weight || 0);
    setUnits([...units, { code, contains: 0, price: 0, label: '', weight: baseW }]);
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

  const handleImageChange2 = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressedFile = await imageCompression(file, { maxSizeMB: 0.25, maxWidthOrHeight: 800, useWebWorker: true, initialQuality: 0.7 });
      setImageFile2(compressedFile);
      setImagePreview2(URL.createObjectURL(compressedFile));
    } catch { toast.error("Gagal proses gambar ke-2"); }
  };

  const calculateProfit = (sellingPrice: number, costPrice: number) => {
    const profit = sellingPrice - costPrice;
    const percentage = costPrice > 0 ? (profit / costPrice) * 100 : 0;
    return { profit, percentage };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    if (!form.checkValidity()) {
      form.querySelector<HTMLElement>(':invalid')?.focus();
      toast.error('Mohon lengkapi semua kolom wajib sebelum menyimpan.');
      return;
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading("Menyimpan perubahan...");

    try {
      let categoryName = String(formData.Kategori || 'UMUM').trim();
      if (categoryName === '__NEW__' || !categoryName) {
        categoryName = newKategoriInput.trim() || 'UMUM';
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

      let finalImageUrl = formData.Link_Foto;
      if (imageFile) {
        const uploadData = new FormData();
        uploadData.append('file', imageFile);
        uploadData.append('folder', 'products');
        const uploadRes = await uploadImageAction(uploadData);
        if (!uploadRes.success || !uploadRes.url) {
          throw new Error(uploadRes.error || "Gagal mengupload gambar.");
        }
        finalImageUrl = uploadRes.url;
      }

      let finalImageUrl2 = formData.Link_Foto2;
      if (imageFile2) {
        const uploadData2 = new FormData();
        uploadData2.append('file', imageFile2);
        uploadData2.append('folder', 'products');
        const uploadRes2 = await uploadImageAction(uploadData2);
        if (!uploadRes2.success || !uploadRes2.url) {
          throw new Error(uploadRes2.error || "Gagal mengupload gambar ke-2.");
        }
        finalImageUrl2 = uploadRes2.url;
      }

      const oldDoc = await sbGetDoc('products', id);
      const oldData = oldDoc.exists() ? oldDoc.data() : null;
      const oldStocks = oldData?.stockByWarehouse || {};

      const baseUnit = String(formData.Satuan || 'PCS').trim().toUpperCase();

      const cleanedUnits: UnitOption[] = units
        .map(u => {
          const code = String(u.code || '').trim().toUpperCase();
          if (!code) return null;
          const contains = Number(u.contains || 0);
          const price = Number(u.price || 0);
          const unitEntry: UnitOption = { code, contains, price };
          if (u.weight !== undefined && !isNaN(Number(u.weight))) unitEntry.weight = Number(u.weight);
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
        label: '',
        weight: Number(formData.weight || 0),
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

      const channelPricing: any = { offline: {}, website: {}, shopee: {}, tiktok: {} };
      ensuredBase.forEach(u => {
        if (u.prices) {
          if (u.prices.offline !== undefined) channelPricing.offline[u.code] = { price: Number(u.prices.offline) };
          if (u.prices.website !== undefined) channelPricing.website[u.code] = { price: Number(u.prices.website) };
          if (u.prices.shopee !== undefined) channelPricing.shopee[u.code] = { price: Number(u.prices.shopee) };
          if (u.prices.tiktok !== undefined) channelPricing.tiktok[u.code] = { price: Number(u.prices.tiktok) };
        }
      });

      const newStocks: Record<string, number> = { ...(formData.stockByWarehouse || {}) };
      const rawTotalStock = Object.values(newStocks).reduce((sum: number, v: any) => sum + Number(v || 0), 0);
      const totalVariantStock = childVariants.reduce((s, v) => s + Number(v.stock || 0), 0);
      const totalStock = childVariants.length > 0 ? totalVariantStock : rawTotalStock;
      
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
        weight: Number(formData.weight || 0),
        weightUnit: 'g',
        barcode: formData.Barcode || '',
        Barcode: formData.Barcode || '',
        imageUrl: finalImageUrl,
        image: finalImageUrl,
        URL_Produk: finalImageUrl,
        Link_Foto2: finalImageUrl2,
        imageUrl2: finalImageUrl2,
        image_url2: finalImageUrl2,
        isActive: Number(formData.Status) === 1,
        Status: Number(formData.Status) === 1 ? 1 : 0,
        warehouseId: formData.warehouseId || oldData?.warehouseId || '',
        tgl_masuk: formData.tgl_masuk || '',
        expired_date: formData.expired_date || formData.Expired_Default || '',
        expiredDate: formData.expired_date || formData.Expired_Default || '',
        Lokasi: formData.Lokasi || '',
        Supplier: formData.Supplier || '',
        No_WA_Supplier: formData.No_WA_Supplier || '',
        isParentOnly: Boolean(formData.isParentOnly),
        units: ensuredBase,
        hideBaseUnit,
        hide_base_unit: hideBaseUnit,
        defaultSellUnit: hideBaseUnit ? (defaultSellUnit || ensuredBase.find(u => u.code !== baseUnit)?.code || '') : '',
        default_sell_unit: hideBaseUnit ? (defaultSellUnit || ensuredBase.find(u => u.code !== baseUnit)?.code || '') : '',
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
        isPreOrder,
        poLeadTimeDays,
        poNotes,
        isTaxable,
        updatedAt: new Date().toISOString(),
      };

      const cleanSku = (formData.ID || '').toString().trim();
      const saveRes = await saveEditedProduct(id, {
        sku: cleanSku,
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Memuat data produk...</p>
        </div>
      </div>
    );
  }

  const baseWeightGrams = Number(formData.weight || 0);

  return (
    <>
      <form noValidate onSubmit={handleSubmit} className="min-h-screen bg-slate-50/70 text-slate-800 font-sans pb-24">
        {/* STICKY TOP ACTION BAR */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3 shadow-2xs">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/admin/products"
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shrink-0"
                title="Kembali ke Daftar Produk"
              >
                <ChevronLeft size={18} />
              </Link>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-sm sm:text-base font-black text-slate-900 truncate uppercase">
                    {formData.Nama || 'Edit Produk'}
                  </h1>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    formData.Status === 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {formData.Status === 1 ? 'Aktif' : 'Arsip'}
                  </span>
                  {formData.Parent_ID ? (
                    <span className="px-2 py-0.5 bg-violet-100 text-violet-800 rounded-full text-[10px] font-bold uppercase tracking-wider">
                      ↳ Varian
                    </span>
                  ) : childVariants.length > 0 ? (
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full text-[10px] font-bold uppercase tracking-wider">
                      Induk ({childVariants.length} Varian)
                    </span>
                  ) : null}
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  SKU: {formData.ID || id} {formData.Barcode ? `• Barcode: ${formData.Barcode}` : ''}
                </p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowVariantModal(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 bg-violet-50 text-violet-700 hover:bg-violet-100 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
                title="Kelola & Tambah Varian"
              >
                <Layers size={14} /> Kelola Varian
              </button>
              <button
                type="button"
                onClick={() => router.push('/admin/products')}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isDeleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-all disabled:opacity-50"
              >
                <Save size={14} />
                <span>{isSubmitting ? 'Menyimpan...' : 'Simpan'}</span>
              </button>
            </div>
          </div>
        </header>

        {/* MAIN RESPONSIVE CONTAINER (2-COLUMNS DESKTOP, 1-COLUMN MOBILE) */}
        <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* ======================================================== */}
            {/* KOLOM KIRI (KONTEN UTAMA: 8 KOLOM DESKTOP)                */}
            {/* ======================================================== */}
            <div className="lg:col-span-8 space-y-6">

              {/* 1. IDENTITAS BARANG */}
              <section id="identitas" className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <h2 className="text-xs font-black uppercase tracking-wider text-blue-700 flex items-center gap-2">
                    <Tag size={16} /> Identitas Produk
                  </h2>
                  <span className="text-[11px] text-slate-400 font-medium">Informasi dasar & kode produk</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                        ID Produk (SKU) *
                      </label>
                      <div className="flex items-center gap-1">
                        {formData.ID.length > 20 && (
                          <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md">
                            {formData.ID.length} char
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await generateNextSkuAction(formData.Kategori || '', formData.Nama || '', id);
                            if (res.success && res.sku) {
                              setFormData(prev => ({ ...prev, ID: res.sku! }));
                              toast.success(`SKU unik dihasilkan: ${res.sku}`);
                            } else {
                              toast.error(res.error || 'Gagal generate SKU otomatis');
                            }
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold rounded-lg border border-blue-100 transition-colors"
                          title="Generate SKU baru otomatis berbasis kategori (dijamin unik & tidak ada yang sama)"
                        >
                          <Sparkles size={10} /> Generate SKU
                        </button>
                      </div>
                    </div>
                    <input
                      required
                      className="w-full px-3.5 py-2 bg-slate-50/80 rounded-xl font-mono font-bold text-sm text-slate-800 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                      type="text"
                      value={formData.ID}
                      onChange={(e) => setFormData({ ...formData, ID: e.target.value })}
                      placeholder="Contoh: BRG-001 atau SBK-0001"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                        Parent ID (Induk)
                      </label>
                      {formData.Parent_ID && (
                        <span className="text-[10px] font-bold text-violet-700 bg-violet-50 px-1.5 py-0.2 rounded">Varian</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        className="flex-1 px-3.5 py-2 bg-slate-50/80 rounded-xl font-mono text-sm text-slate-800 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                        type="text"
                        value={formData.Parent_ID}
                        onChange={(e) => setFormData({ ...formData, Parent_ID: e.target.value })}
                        placeholder="ID Produk Induk (opsional)"
                      />
                      {formData.Parent_ID && (
                        <a
                          href={`/admin/products/edit/${formData.Parent_ID}`}
                          className="p-2 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-xl text-xs font-bold transition-colors shrink-0"
                          title="Buka produk induk"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Lokasi Rak
                    </label>
                    <input
                      className="w-full px-3.5 py-2 bg-slate-50/80 rounded-xl text-sm text-slate-800 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                      type="text"
                      value={formData.Lokasi}
                      onChange={(e) => setFormData({ ...formData, Lokasi: e.target.value })}
                      placeholder="Rak A-01"
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="flex items-start gap-2.5 p-2.5 bg-violet-50/60 hover:bg-violet-50 border border-violet-100 rounded-xl cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={Boolean(formData.isParentOnly)}
                        onChange={(e) => setFormData({ ...formData, isParentOnly: e.target.checked })}
                        className="mt-0.5 rounded text-violet-600 focus:ring-violet-400 w-4 h-4 cursor-pointer"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-violet-900 block">
                          Jadikan Produk Induk Pengelompokan Saja (Non-Order)
                        </span>
                        <span className="text-violet-700 font-medium">
                          Produk ini berfungsi murni sebagai payung grup (tidak bisa langsung di-order di transaksi kasir/pembelian), melainkan pesanan diarahkan untuk memilih variannya.
                        </span>
                      </div>
                    </label>
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Nama Produk *
                    </label>
                    <input
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50/80 rounded-xl font-semibold text-sm text-slate-900 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                      type="text"
                      value={formData.Nama}
                      onChange={(e) => setFormData({ ...formData, Nama: e.target.value })}
                      placeholder="Contoh: Kopi Good Day Freeze Mocafrio"
                    />
                  </div>

                  {/* Kategori */}
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Kategori Produk
                    </label>
                    {formData.Kategori === '__NEW__' ? (
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          className="flex-1 px-3.5 py-2 bg-amber-50/80 border border-amber-300 rounded-xl text-sm font-semibold text-amber-900 outline-none focus:ring-2 focus:ring-amber-500"
                          type="text"
                          placeholder="Ketik kategori baru..."
                          value={newKategoriInput}
                          onChange={(e) => setNewKategoriInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveNewCategory();
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleSaveNewCategory}
                          className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1"
                        >
                          <Plus size={14} /> Simpan
                        </button>
                        <button
                          type="button"
                          onClick={() => { setFormData({ ...formData, Kategori: 'UMUM' }); setNewKategoriInput(''); }}
                          className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl text-xs font-bold"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <select
                        className="w-full px-3.5 py-2 bg-slate-50/80 rounded-xl text-xs font-semibold text-slate-800 border border-slate-200 focus:bg-white focus:border-blue-500 outline-none transition-all"
                        value={formData.Kategori}
                        onChange={(e) => {
                          if (e.target.value === '__NEW__') {
                            setFormData({ ...formData, Kategori: '__NEW__' });
                          } else {
                            setFormData({ ...formData, Kategori: e.target.value });
                          }
                        }}
                      >
                        <option value="">— Pilih Kategori —</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                        <option value="__NEW__">＋ Tambah Kategori Baru...</option>
                      </select>
                    )}
                  </div>

                  {/* Brand */}
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Brand / Merk
                    </label>
                    <input
                      className="w-full px-3.5 py-2 bg-slate-50/80 rounded-xl text-sm text-slate-800 border border-slate-200 focus:bg-white focus:border-blue-500 outline-none transition-all"
                      type="text"
                      value={formData.Brand}
                      onChange={(e) => setFormData({ ...formData, Brand: e.target.value })}
                      placeholder="Contoh: Good Day, Indomie"
                    />
                  </div>

                  {/* Barcode Utama */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                        Barcode Utama
                      </label>
                      <button
                        type="button"
                        onClick={() => { setScanUnitBarcodeIdx(-1); setScannerReady(true); }}
                        className="text-[11px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1"
                      >
                        <Camera size={12} /> Scan
                      </button>
                    </div>
                    <div className="relative">
                      <Barcode size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        className="w-full pl-9 pr-3 py-2 bg-slate-50/80 rounded-xl font-mono text-sm text-slate-800 border border-slate-200 focus:bg-white focus:border-blue-500 outline-none transition-all"
                        type="text"
                        value={formData.Barcode}
                        onChange={(e) => setFormData({ ...formData, Barcode: e.target.value })}
                        placeholder="Scan atau ketik barcode..."
                      />
                    </div>
                  </div>

                  {/* Tgl Masuk & Kadaluarsa */}
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Tgl Masuk Stok
                    </label>
                    <div className="relative">
                      <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        className="w-full pl-9 pr-3 py-2 bg-slate-50/80 rounded-xl text-xs text-slate-800 border border-slate-200 focus:bg-white focus:border-blue-500 outline-none transition-all"
                        type="date"
                        value={formData.tgl_masuk}
                        onChange={(e) => setFormData({ ...formData, tgl_masuk: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Tgl Kadaluarsa (Expired)
                    </label>
                    <div className="relative">
                      <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        className="w-full pl-9 pr-3 py-2 bg-slate-50/80 rounded-xl text-xs text-slate-800 border border-slate-200 focus:bg-white focus:border-blue-500 outline-none transition-all"
                        type="date"
                        value={formData.Expired_Default}
                        onChange={(e) => setFormData({ ...formData, Expired_Default: e.target.value, expired_date: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* 2. STRUKTUR HARGA & MODAL HPP */}
              <section id="harga-satuan" className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <h2 className="text-xs font-black uppercase tracking-wider text-amber-700 flex items-center gap-2">
                    <TrendingUp size={16} /> Struktur Harga & Modal
                  </h2>
                  <span className="text-[11px] text-slate-400 font-medium">HPP, Eceran, Grosir & Margin</span>
                </div>

                {/* PO AVG HPP BANNER */}
                {poStats.count > 0 ? (
                  <div className="mb-5 p-4 bg-emerald-50/70 rounded-xl border border-emerald-200/90">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-emerald-900 uppercase">Avg Modal PO Terakhir</span>
                          <span className="px-2 py-0.2 bg-emerald-200/80 text-emerald-900 rounded-full text-[10px] font-bold">
                            {poStats.count} PO ({poStats.totalQty} {formData.Satuan})
                          </span>
                        </div>
                        <p className="text-base font-black text-emerald-800">
                          Rp {Math.round(poStats.avgCost || 0).toLocaleString('id-ID')}
                          <span className="text-xs font-medium text-emerald-700 ml-1">/ {formData.Satuan || 'Pcs'}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const roundedAvg = Math.round(poStats.avgCost || 0);
                          setFormData((prev) => ({ ...prev, Modal: roundedAvg }));
                          toast.success(`Avg Modal (Rp ${roundedAvg.toLocaleString('id-ID')}) diterapkan`);
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors shadow-2xs flex items-center gap-1 shrink-0"
                      >
                        <Check size={13} /> Terapkan Avg Modal
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Grid Harga Modal, Ecer, dan Coret */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-4">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Harga Modal (HPP) / Satuan
                    </label>
                    <div className="flex bg-slate-50/90 rounded-xl overflow-hidden border border-slate-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:bg-white">
                      <input
                        type="number"
                        min="0"
                        className="w-full px-3 py-2 bg-transparent font-bold text-sm text-slate-800 outline-none"
                        value={modalInputStr}
                        placeholder="0"
                        onFocus={() => setIsModalInputFocused(true)}
                        onBlur={() => {
                          setIsModalInputFocused(false);
                          const ratio = activeModalUnitObj?.contains || 1;
                          const currentModal = Number(formData.Modal || 0);
                          setModalInputStr(currentModal > 0 ? String(Math.round(currentModal * ratio)) : '');
                        }}
                        onChange={(e) => handleModalInputChange(e.target.value)}
                      />
                      <select
                        className="bg-slate-100 border-none font-bold text-slate-700 px-2.5 text-xs outline-none cursor-pointer"
                        value={activeModalUnitCode}
                        onChange={(e) => handleModalUnitChange(e.target.value)}
                      >
                        {availableModalUnits.map((s) => (
                          <option key={s.code} value={s.code}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                    {activeModalUnitObj.contains > 1 ? (
                      <p className="text-[10px] font-bold text-amber-700 mt-1">
                        ≈ Rp {Math.round(Number(formData.Modal || 0)).toLocaleString('id-ID')} / {baseUnitCode}
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-400 mt-1">Modal dasar per {baseUnitCode}</p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                        Harga Ecer (Jual Utama)
                      </label>
                      {formData.Ecer > 0 && formData.Modal > 0 && (
                        <ProfitBadge {...calculateProfit(formData.Ecer, formData.Modal)} />
                      )}
                    </div>
                    <input
                      required
                      type="number"
                      disabled={pricingMode === 'RECOMMENDED'}
                      className="w-full px-3.5 py-2 bg-blue-50/70 rounded-xl border border-blue-200 font-bold text-sm text-blue-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-75 transition-all"
                      value={formData.Ecer}
                      onChange={(e) => setFormData({ ...formData, Ecer: Number(e.target.value) })}
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Harga Coret (Promo)
                    </label>
                    <input
                      type="number"
                      className="w-full px-3.5 py-2 bg-slate-50/80 rounded-xl border border-slate-200 font-medium text-sm text-slate-400 line-through focus:bg-white focus:text-slate-800 focus:line-through-none outline-none transition-all"
                      value={formData.Harga_Coret || ''}
                      placeholder="0"
                      onChange={(e) => setFormData({ ...formData, Harga_Coret: Number(e.target.value) })}
                    />
                  </div>
                </div>

                {/* Grosir & Min Grosir */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 bg-amber-50/50 rounded-xl border border-amber-200/80 mb-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-amber-900 block">
                        Harga Grosir
                      </label>
                      {formData.Grosir > 0 && formData.Modal > 0 && (
                        <ProfitBadge {...calculateProfit(formData.Grosir, formData.Modal)} />
                      )}
                    </div>
                    <input
                      type="number"
                      className="w-full px-3.5 py-2 bg-white rounded-xl border border-amber-200 font-bold text-sm text-amber-900 outline-none focus:ring-2 focus:ring-amber-500"
                      value={formData.Grosir || ''}
                      placeholder="0"
                      onChange={(e) => setFormData({ ...formData, Grosir: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-amber-900 block mb-1">
                      Min. Beli Grosir ({formData.Satuan || 'PCS'})
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="w-full px-3.5 py-2 bg-white rounded-xl border border-amber-200 font-bold text-sm text-amber-900 outline-none focus:ring-2 focus:ring-amber-500"
                      value={formData.Min_Grosir || 1}
                      onChange={(e) => setFormData({ ...formData, Min_Grosir: Number(e.target.value) })}
                    />
                  </div>
                </div>

                {/* TAX PANEL & RECOMMENDATION MODE */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {/* Status Pajak */}
                  {(() => {
                    const ecer = Number(formData.Ecer || 0);
                    const breakdown = calculateTaxBreakdown({
                      amount: ecer,
                      category: formData.Kategori || '',
                      taxSettings,
                      isTaxable,
                    });
                    return (
                      <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Pajak Produk (PPN)</p>
                          <p className="text-xs font-bold text-slate-800">{breakdown.taxLabel}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={isTaxable}
                            onChange={(e) => setIsTaxable(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    );
                  })()}

                  {/* Mode Rekomendasi Margin */}
                  <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Penentuan Harga</p>
                      <p className="text-xs font-bold text-slate-800">
                        {pricingMode === 'RECOMMENDED' ? 'Otomatis Margin' : 'Harga Manual'}
                      </p>
                    </div>
                    <select
                      className="px-2.5 py-1.5 bg-white rounded-lg border border-slate-200 text-xs font-bold outline-none"
                      value={pricingMode}
                      onChange={(e) => setPricingMode(e.target.value as any)}
                    >
                      <option value="MANUAL">Manual</option>
                      <option value="RECOMMENDED">Margin AI</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* 3. SATUAN & MULTILEVEL HARGA DENGAN HITUNG BERAT OTOMATIS */}
              <section id="satuan-multilevel" className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-wider text-indigo-700 flex items-center gap-2">
                      <Scale size={16} /> Satuan Jual & Berat Produk (Hitung Otomatis)
                    </h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Kelola kemasan berjenjang (PCS, RTG, CTN), barcode khusus, harga per satuan, dan berat otomatis.
                    </p>
                  </div>

                  {/* Tambah Satuan Baru */}
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      className="bg-slate-50 px-3 py-1.5 rounded-xl text-xs font-bold uppercase outline-none border border-slate-200 focus:border-indigo-500"
                      value={newUnitCode}
                      onChange={(e) => setNewUnitCode(e.target.value)}
                    >
                      <option value="">+ Satuan Baru</option>
                      {SATUAN_LIST.filter((s) => !units.some((u) => u.code === s.value)).map((s) => (
                        <option key={s.value} value={s.value}>{s.label} ({s.desc})</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddUnit}
                      disabled={!newUnitCode}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-40"
                    >
                      Tambah
                    </button>
                  </div>
                </div>

                {/* BERAT SATUAN DASAR UTAMA (ACUAN HITUNG OTOMATIS) */}
                <div className="p-4 bg-gradient-to-r from-indigo-50/80 via-blue-50/60 to-transparent rounded-xl border border-indigo-100/90 mb-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 bg-indigo-600 text-white rounded-lg">
                          <Scale size={14} />
                        </span>
                        <label className="text-xs font-black uppercase text-indigo-950">
                          Berat Satuan Dasar ({formData.Satuan || 'PCS'})
                        </label>
                      </div>
                      <p className="text-[11px] text-indigo-800 leading-snug">
                        Masukkan berat produk terkecil. Berat satuan bertingkat (RTG, PAK, DUS/CTN) akan <strong>otomatis dihitung</strong> dari berat dasar dikalikan jumlah isinya.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0"
                          className="w-36 px-3 py-2 bg-white rounded-xl border border-indigo-200 font-bold text-sm text-indigo-950 text-right outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                          value={formData.weight || ''}
                          onChange={(e) => handleBaseWeightChange(Number(e.target.value || 0))}
                        />
                        <span className="absolute right-8 top-1/2 -translate-y-1/2 text-xs font-bold text-indigo-400 pointer-events-none">
                          g
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-indigo-500 uppercase block">Konversi</span>
                        <span className="text-xs font-black text-indigo-900">
                          {formatWeightDisplay(baseWeightGrams)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Toggle Sembunyikan Eceran / Hide PCS */}
                <div className="mb-5 p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert size={16} className="text-amber-700 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-amber-950 uppercase">
                        Nonaktifkan Penjualan Satuan Dasar ({formData.Satuan || 'PCS'})
                      </p>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        Aktifkan jika produk hanya boleh dijual dalam kemasan lebih besar (contoh: hanya per Renceng atau Karton).
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 self-end sm:self-center">
                    <input
                      type="checkbox"
                      checked={hideBaseUnit}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setHideBaseUnit(checked);
                        if (checked && !defaultSellUnit) {
                          const firstHigher = units.find((u) => u.code !== (formData.Satuan || 'PCS') && Number(u.contains || 0) > 1);
                          if (firstHigher) setDefaultSellUnit(firstHigher.code);
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                  </label>
                </div>

                {/* GRID KARTU SATUAN BERTINGKAT */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {units.map((u, index) => {
                    const code = u.code || '';
                    const idx = index;
                    const baseUnit = String(formData.Satuan || 'PCS').toUpperCase();
                    const isCurrentBase = code === baseUnit || idx === 0;
                    const contains = Number(u.contains || (idx === 0 ? 1 : 0));
                    const unitPrice = Number(u.price || 0);
                    const autoComputedWeight = baseWeightGrams > 0 && contains > 0 ? Number((baseWeightGrams * contains).toFixed(2)) : 0;
                    const isAutoWeightSynced = Math.abs(Number(u.weight || 0) - autoComputedWeight) < 0.01;

                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border relative transition-all space-y-3 ${
                          defaultSellUnit === code
                            ? 'bg-blue-50/30 border-blue-400 ring-2 ring-blue-100'
                            : 'bg-slate-50/70 border-slate-200'
                        }`}
                      >
                        {/* Header Satuan Card */}
                        <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              className="w-20 px-2 py-0.5 bg-slate-900 text-white rounded-lg text-xs font-black uppercase outline-none focus:ring-2 focus:ring-blue-400 font-mono tracking-wide"
                              value={u.code || ''}
                              onChange={(e) => {
                                const newCode = e.target.value.toUpperCase();
                                const next = [...units];
                                next[idx] = { ...u, code: newCode };
                                setUnits(next);
                                if (defaultSellUnit === code) {
                                  setDefaultSellUnit(newCode);
                                }
                                if (isCurrentBase) {
                                  setFormData(prev => ({ ...prev, Satuan: newCode }));
                                }
                              }}
                              placeholder="KODE"
                            />
                            {isCurrentBase && (
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-200/80 px-1.5 py-0.2 rounded">
                                Satuan Dasar
                              </span>
                            )}
                            {!isCurrentBase && (
                              <span className="text-[11px] font-bold text-slate-600">
                                Isi: {contains} {baseUnit}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {idx > 0 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveUnit(idx)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Hapus Satuan"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Label & Isi Satuan */}
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">
                              Nama Label
                            </label>
                            <input
                              type="text"
                              placeholder="Contoh: Renceng / Dus"
                              className="w-full px-2.5 py-1.5 bg-white rounded-lg text-xs font-semibold text-slate-800 border border-slate-200 outline-none focus:border-blue-500"
                              value={u.label || ''}
                              onChange={(e) => {
                                const next = [...units];
                                next[idx] = { ...u, label: e.target.value };
                                setUnits(next);
                              }}
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">
                              Jumlah Isi ({baseUnit})
                            </label>
                            <input
                              type="number"
                              min="1"
                              disabled={idx === 0}
                              className="w-full px-2.5 py-1.5 bg-white rounded-lg text-xs font-bold text-slate-800 border border-slate-200 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400 text-right"
                              value={idx === 0 ? 1 : (u.contains || '')}
                              onChange={(e) => handleUnitContainsChange(idx, Number(e.target.value || 1))}
                            />
                          </div>
                        </div>

                        {/* BERAT SATUAN (HITUNG OTOMATIS) */}
                        <div className="p-2.5 bg-white rounded-lg border border-slate-200/90 space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold uppercase text-slate-600 flex items-center gap-1">
                              <Scale size={11} className="text-indigo-600" /> Berat Kemasan {code}
                            </label>
                            <span className="text-[11px] font-black text-indigo-900">
                              {formatWeightDisplay(Number(u.weight || 0))}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="w-full px-2.5 py-1.5 bg-slate-50/80 rounded-lg text-xs font-bold text-slate-800 border border-slate-200 outline-none focus:bg-white focus:border-indigo-500 text-right pr-7"
                                value={u.weight || ''}
                                placeholder="0"
                                onChange={(e) => handleUnitWeightChange(idx, Number(e.target.value || 0))}
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                                g
                              </span>
                            </div>

                            {!isCurrentBase && (
                              <button
                                type="button"
                                onClick={() => handleResetUnitWeight(idx)}
                                className={`px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors shrink-0 flex items-center gap-1 border ${
                                  isAutoWeightSynced
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                                }`}
                                title="Hitung ulang otomatis berdasarkan perkalian isi"
                              >
                                {isAutoWeightSynced ? (
                                  <>
                                    <Sparkles size={10} /> Auto
                                  </>
                                ) : (
                                  <>
                                    <RotateCcw size={10} /> Auto Hitung
                                  </>
                                )}
                              </button>
                            )}
                          </div>

                          {!isCurrentBase && baseWeightGrams > 0 && (
                            <p className="text-[9px] text-slate-400">
                              Rumus: {baseWeightGrams}g × {contains} = {autoComputedWeight}g
                            </p>
                          )}
                        </div>

                        {/* Barcode Satuan */}
                        <div>
                          <div className="flex items-center justify-between mb-0.5">
                            <label className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1">
                              <Barcode size={11} /> Barcode {code}
                            </label>
                            <button
                              type="button"
                              onClick={() => { setScanUnitBarcodeIdx(idx); setScannerReady(true); }}
                              className="text-[10px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-0.5"
                            >
                              <Camera size={10} /> Scan
                            </button>
                          </div>
                          <input
                            type="text"
                            placeholder={`Barcode khusus ${code}...`}
                            className="w-full px-2.5 py-1.5 bg-white rounded-lg text-xs font-mono text-slate-800 border border-slate-200 outline-none focus:border-blue-500"
                            value={u.barcode || ''}
                            onChange={(e) => {
                              const next = [...units];
                              next[idx] = { ...u, barcode: e.target.value || undefined };
                              setUnits(next);
                            }}
                          />
                        </div>

                        {/* Harga Jual Satuan */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase text-slate-700">Harga Jual {code}</span>
                            {Number(u.price) > 0 && formData.Modal > 0 && (
                              <span className={`text-[10px] font-bold ${
                                calculateProfit(Number(u.price), formData.Modal * (contains || 1)).profit >= 0
                                  ? 'text-emerald-600'
                                  : 'text-rose-600'
                              }`}>
                                Profit: Rp{calculateProfit(Number(u.price), formData.Modal * (contains || 1)).profit.toLocaleString('id-ID')}
                              </span>
                            )}
                          </div>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                              Rp
                            </span>
                            <input
                              type="number"
                              className="w-full pl-8 pr-2.5 py-1.5 bg-white rounded-lg text-xs font-bold text-slate-900 border border-slate-200 outline-none focus:border-blue-500 text-right"
                              value={u.price || ''}
                              placeholder="0"
                              onChange={(e) => {
                                const val = e.target.value === '' ? undefined : Number(e.target.value);
                                const next = [...units];
                                next[idx] = { ...u, price: val };
                                setUnits(next);
                              }}
                            />
                          </div>
                        </div>

                        {/* Preset Cepat Harga Satuan */}
                        {idx > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-200/60">
                            <button
                              type="button"
                              onClick={() => {
                                const target = Number(formData.Ecer || 0) * (contains || 1);
                                const next = [...units];
                                next[idx] = { ...u, price: target };
                                setUnits(next);
                              }}
                              className="px-2 py-0.5 bg-white hover:bg-slate-100 border border-slate-200 rounded text-[10px] font-medium text-slate-600 transition-colors"
                            >
                              Sama Ecer
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const target = Math.round((Number(formData.Ecer || 0) * (contains || 1) * 0.95) / 100) * 100;
                                const next = [...units];
                                next[idx] = { ...u, price: target };
                                setUnits(next);
                              }}
                              className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded text-[10px] font-bold text-emerald-800 transition-colors"
                            >
                              Diskon 5%
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const costSatuan = Number(formData.Modal || 0) * (contains || 1);
                                const target = Math.round((costSatuan * 1.10) / 100) * 100;
                                const next = [...units];
                                next[idx] = { ...u, price: target };
                                setUnits(next);
                              }}
                              className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded text-[10px] font-bold text-amber-800 transition-colors"
                            >
                              +10% Modal
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* 4. INVENTARIS STOK & GUDANG */}
              <section id="stok-gudang" className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <h2 className="text-xs font-black uppercase tracking-wider text-emerald-700 flex items-center gap-2">
                    <Layers size={16} /> Stok & Pergudangan
                  </h2>
                  <span className="text-[11px] text-slate-400 font-medium">Pengelolaan stok & multi-gudang</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-4">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Satuan Dasar
                    </label>
                    <input
                      required
                      type="text"
                      className="w-full px-3 py-2 bg-slate-50/80 rounded-xl border border-slate-200 font-bold text-xs uppercase focus:bg-white focus:border-emerald-500 outline-none"
                      value={formData.Satuan}
                      onChange={(e) => {
                        const newBase = e.target.value;
                        setFormData({ ...formData, Satuan: newBase });
                        setUnits((prev) => {
                          if (prev.length === 0) return [{ code: newBase.toUpperCase() || 'PCS', contains: 1, price: formData.Ecer, weight: formData.weight }];
                          const next = [...prev];
                          next[0] = { ...next[0], code: newBase.toUpperCase() || 'PCS' };
                          return next;
                        });
                      }}
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
                      Total Stok
                    </label>
                    {childVariants.length > 0 ? (
                      <div className="w-full px-3 py-2 bg-slate-100 rounded-xl border border-slate-200 font-black text-slate-600 text-xs flex items-center justify-between">
                        <span>{childVariants.reduce((s, v) => s + Number(v.stock || 0), 0)}</span>
                        <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded font-bold uppercase">Auto Varian</span>
                      </div>
                    ) : (
                      <input
                        required
                        type="number"
                        className="w-full px-3 py-2 bg-emerald-50/70 rounded-xl border border-emerald-200 font-black text-xs text-emerald-900 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500"
                        value={formData.Stok}
                        onChange={(e) => setFormData({ ...formData, Stok: Number(e.target.value) })}
                      />
                    )}
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-rose-600 block mb-1">
                      Min. Stok Warning
                    </label>
                    <input
                      required
                      type="number"
                      className="w-full px-3 py-2 bg-rose-50/70 rounded-xl border border-rose-200 font-bold text-xs text-rose-800 outline-none focus:bg-white focus:ring-2 focus:ring-rose-400"
                      value={formData.Min_Stok}
                      onChange={(e) => setFormData({ ...formData, Min_Stok: Number(e.target.value) })}
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Gudang Utama
                    </label>
                    <select
                      className="w-full px-3 py-2 bg-slate-50/80 rounded-xl border border-slate-200 font-semibold text-xs outline-none"
                      value={formData.warehouseId}
                      onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                    >
                      <option value="">(Semua Gudang)</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Rincian Stok Per Gudang */}
                <div className="pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Rincian Stok Per Gudang
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 font-medium">Alasan Audit:</span>
                      <select
                        className="px-2 py-1 bg-slate-100 rounded-lg text-[10px] font-bold outline-none"
                        value={stockReason}
                        onChange={(e) => setStockReason(e.target.value as any)}
                      >
                        <option value="MANUAL">Manual</option>
                        <option value="OPNAME">Stock Opname</option>
                        <option value="TRANSFER">Transfer</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {warehouses.map((w) => {
                      const qty = Number(formData.stockByWarehouse?.[w.id] || 0);
                      return (
                        <div key={w.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                          <label className="text-[10px] font-bold text-slate-600 block mb-0.5 truncate">{w.name}</label>
                          <input
                            type="number"
                            min={0}
                            className="w-full px-2 py-1 bg-white rounded-lg text-xs font-bold text-slate-800 border border-slate-200 outline-none focus:border-emerald-500 text-right"
                            value={qty}
                            onChange={(e) => {
                              const nextVal = Number(e.target.value || 0);
                              const nextMap = { ...(formData.stockByWarehouse || {}), [w.id]: nextVal };
                              const nextTotal = Object.values(nextMap).reduce((sum: number, v: any) => sum + Number(v || 0), 0);
                              setFormData({
                                ...formData,
                                stockByWarehouse: nextMap,
                                Stok: nextTotal,
                              });
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* 5. DAFTAR VARIAN PRODUK */}
              {childVariants.length > 0 ? (
                <section id="varian" className="bg-white p-5 sm:p-6 rounded-2xl border border-violet-100 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-violet-100 pb-3 mb-4">
                    <h2 className="text-xs font-black uppercase tracking-wider text-violet-800 flex items-center gap-2">
                      <Layers size={16} /> Daftar Varian Terhubung ({childVariants.length})
                    </h2>
                    <button
                      type="button"
                      onClick={() => setShowVariantModal(true)}
                      className="px-3 py-1 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold uppercase transition-colors"
                    >
                      + Tambah Varian
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {childVariants.map((v) => (
                      <div key={v.id} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{v.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            ID: {v.id} {v.barcode ? `• Barcode: ${v.barcode}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs font-black text-slate-700">{v.stock} unit</span>
                          <Link
                            href={`/admin/products/edit/${v.id}`}
                            className="p-1.5 bg-slate-100 hover:bg-violet-100 text-slate-600 hover:text-violet-700 rounded-lg text-xs font-bold transition-colors"
                            title="Edit Varian Ini"
                          >
                            <ExternalLink size={13} />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>

            {/* ======================================================== */}
            {/* KOLOM KANAN (SIDEBAR: 4 KOLOM DESKTOP, STICKY)            */}
            {/* ======================================================== */}
            <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-20">

              {/* SIDEBAR CARD 1: MEDIA & FOTO PRODUK */}
              <section className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-2.5 mb-3.5">
                  <ImageIcon size={15} /> Foto Produk
                </h3>

                <div className="space-y-3">
                  {/* --- FOTO 1 --- */}
                  <p className="text-[10px] font-black uppercase text-slate-400">Foto Utama</p>
                  <div className="w-full aspect-square border-2 border-dashed border-slate-200 rounded-xl overflow-hidden relative flex items-center justify-center bg-slate-50">
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Preview Produk"
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo-atayatoko.png'; }}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-slate-300">
                        <ImageIcon size={32} />
                        <span className="text-[11px] font-medium text-slate-400">Belum ada foto</span>
                      </div>
                    )}
                  </div>

                  {/* Input URL Foto 1 */}
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">URL Foto 1</label>
                    <input
                      type="text"
                      placeholder="Paste link URL gambar (https://...)"
                      className="w-full px-3 py-2 bg-slate-50/80 rounded-xl border border-slate-200 font-medium text-xs text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-all"
                      value={formData.Link_Foto}
                      onChange={(e) => {
                        const url = e.target.value;
                        setFormData((prev) => ({ ...prev, Link_Foto: url }));
                        if (url && (url.startsWith('http') || url.startsWith('/'))) {
                          setImagePreview(url);
                          setImageFile(null);
                        } else if (!url) {
                          setImagePreview(null);
                        }
                      }}
                    />
                  </div>

                  <div className="flex gap-2">
                    <label className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer text-xs font-bold text-center transition-colors">
                      Pilih Foto Baru
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageChange}
                      />
                    </label>
                    {imagePreview && (
                      <button
                        type="button"
                        onClick={() => {
                          setImageFile(null);
                          setImagePreview(null);
                          setFormData((prev) => ({ ...prev, Link_Foto: '' }));
                        }}
                        className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl text-xs font-bold transition-colors"
                        title="Hapus Foto"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="border-t border-slate-100 pt-3">
                    <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Foto Tambahan (Opsional)</p>
                    <div className="w-full aspect-square border-2 border-dashed border-slate-200 rounded-xl overflow-hidden relative flex items-center justify-center bg-slate-50 mb-2">
                      {imagePreview2 ? (
                        <img
                          src={imagePreview2}
                          alt="Preview Produk 2"
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo-atayatoko.png'; }}
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-slate-300">
                          <ImageIcon size={28} />
                          <span className="text-[11px] font-medium text-slate-400">Foto ke-2</span>
                        </div>
                      )}
                    </div>

                    {/* Input URL Foto 2 */}
                    <div className="mb-2">
                      <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">URL Foto 2</label>
                      <input
                        type="text"
                        placeholder="Paste link URL gambar ke-2 (https://...)"
                        className="w-full px-3 py-2 bg-slate-50/80 rounded-xl border border-slate-200 font-medium text-xs text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-all"
                        value={formData.Link_Foto2}
                        onChange={(e) => {
                          const url = e.target.value;
                          setFormData((prev) => ({ ...prev, Link_Foto2: url }));
                          if (url && (url.startsWith('http') || url.startsWith('/'))) {
                            setImagePreview2(url);
                            setImageFile2(null);
                          } else if (!url) {
                            setImagePreview2(null);
                          }
                        }}
                      />
                    </div>

                    <div className="flex gap-2">
                      <label className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer text-xs font-bold text-center transition-colors">
                        Pilih Foto Ke-2
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageChange2}
                        />
                      </label>
                      {imagePreview2 && (
                        <button
                          type="button"
                          onClick={() => {
                            setImageFile2(null);
                            setImagePreview2(null);
                            setFormData((prev) => ({ ...prev, Link_Foto2: '' }));
                          }}
                          className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl text-xs font-bold transition-colors"
                          title="Hapus Foto Ke-2"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                      Deskripsi Singkat
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Keterangan singkat produk..."
                      className="w-full px-3 py-2 bg-slate-50/80 rounded-xl border border-slate-200 font-medium text-xs text-slate-800 outline-none focus:bg-white focus:border-blue-500 resize-none transition-all"
                      value={formData.Deskripsi}
                      onChange={(e) => setFormData({ ...formData, Deskripsi: e.target.value })}
                    />
                  </div>
                </div>
              </section>

              {/* SIDEBAR CARD 2: STATUS & VISIBILITAS PUBLIK */}
              <section className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2.5">
                  Status & Visibilitas
                </h3>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-800">Status Produk</p>
                    <p className="text-[11px] text-slate-400">Produk aktif dapat ditransaksikan di kasir</p>
                  </div>
                  <select
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold outline-none border transition-colors ${
                      formData.Status === 1
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                    value={formData.Status}
                    onChange={(e) => setFormData({ ...formData, Status: Number(e.target.value) })}
                  >
                    <option value={1}>Aktif</option>
                    <option value={0}>Non-Aktif (Arsip)</option>
                  </select>
                </div>

                {/* Pre-Order Toggle */}
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-800 flex items-center gap-1">
                        <Clock size={12} className="text-orange-500" /> Mode Pre-Order (PO)
                      </p>
                      <p className="text-[10px] text-slate-400">Dapat dipesan walau stok 0</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={isPreOrder}
                        onChange={(e) => setIsPreOrder(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                    </label>
                  </div>

                  {isPreOrder && (
                    <div className="p-3 bg-orange-50/80 rounded-xl border border-orange-200 space-y-2">
                      <div>
                        <label className="text-[10px] font-bold uppercase text-orange-900 block mb-1">
                          Estimasi Waktu Proses
                        </label>
                        <select
                          value={poLeadTimeDays}
                          onChange={(e) => setPoLeadTimeDays(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-orange-200 text-xs font-bold text-orange-950 outline-none"
                        >
                          <option value={1}>1 Hari Kerja</option>
                          <option value={2}>2 Hari Kerja</option>
                          <option value={3}>3 Hari Kerja</option>
                          <option value={5}>5 Hari Kerja</option>
                          <option value={7}>7 Hari Kerja (1 Minggu)</option>
                          <option value={14}>14 Hari Kerja (2 Minggu)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase text-orange-900 block mb-1">
                          Catatan Pre-Order
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Contoh: Estimasi pengiriman hari Jumat..."
                          className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-orange-200 text-xs text-orange-950 outline-none resize-none"
                          value={poNotes}
                          onChange={(e) => setPoNotes(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* SIDEBAR CARD 3: DIMENSI & VOLUME GUDANG */}
              <section className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-2.5">
                  <Package size={15} /> Dimensi & Volume Rak
                </h3>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">P (cm)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full px-2.5 py-1.5 bg-slate-50 rounded-lg border border-slate-200 text-xs font-bold text-slate-800 text-right outline-none"
                      value={formData.dimLength || ''}
                      placeholder="0"
                      onChange={(e) => {
                        const l = Number(e.target.value);
                        const vol = (l * formData.dimWidth * formData.dimHeight) / (34 * 20 * 24);
                        setFormData({ ...formData, dimLength: l, volumeInCtn: Number(vol.toFixed(4)) });
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">L (cm)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full px-2.5 py-1.5 bg-slate-50 rounded-lg border border-slate-200 text-xs font-bold text-slate-800 text-right outline-none"
                      value={formData.dimWidth || ''}
                      placeholder="0"
                      onChange={(e) => {
                        const w = Number(e.target.value);
                        const vol = (formData.dimLength * w * formData.dimHeight) / (34 * 20 * 24);
                        setFormData({ ...formData, dimWidth: w, volumeInCtn: Number(vol.toFixed(4)) });
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">T (cm)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full px-2.5 py-1.5 bg-slate-50 rounded-lg border border-slate-200 text-xs font-bold text-slate-800 text-right outline-none"
                      value={formData.dimHeight || ''}
                      placeholder="0"
                      onChange={(e) => {
                        const h = Number(e.target.value);
                        const vol = (formData.dimLength * formData.dimWidth * h) / (34 * 20 * 24);
                        setFormData({ ...formData, dimHeight: h, volumeInCtn: Number(vol.toFixed(4)) });
                      }}
                    />
                  </div>
                </div>

                <div className="p-2.5 bg-blue-50/70 rounded-xl border border-blue-100 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-blue-900">Volume Setara Karton</span>
                  <span className="text-xs font-black text-blue-800">{formData.volumeInCtn || 0} CTN</span>
                </div>
              </section>

              {/* SIDEBAR CARD 4: SUPPLIER / VENDOR */}
              <section className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Truck size={15} /> Supplier
                  </h3>
                  {poStats.suppliers && poStats.suppliers.length > 0 && (
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.2 rounded-full">
                      {poStats.suppliers.length} PO Supplier
                    </span>
                  )}
                </div>

                <div className="space-y-2.5">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">Nama Supplier</label>
                    <input
                      type="text"
                      className="w-full px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-blue-500"
                      value={formData.Supplier}
                      onChange={(e) => setFormData({ ...formData, Supplier: e.target.value })}
                      placeholder="Contoh: PT Sumber Pangan"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">No. WA Supplier</label>
                    <input
                      type="text"
                      className="w-full px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono text-slate-800 outline-none focus:bg-white focus:border-blue-500"
                      value={formData.No_WA_Supplier}
                      onChange={(e) => setFormData({ ...formData, No_WA_Supplier: e.target.value })}
                      placeholder="628123456789"
                    />
                  </div>
                </div>
              </section>

              {/* SIDEBAR CARD 5: TINDAKAN SIMPAN & HAPUS */}
              <div className="space-y-2.5 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || isDeleting}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 tracking-wider disabled:opacity-50"
                >
                  <Save size={16} />
                  <span>{isSubmitting ? 'MENYIMPAN...' : 'SIMPAN PERUBAHAN'}</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => router.push('/admin/products')}
                    className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold uppercase text-xs rounded-xl transition-colors text-center"
                  >
                    Batal
                  </button>

                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isSubmitting || isDeleting}
                    className="py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold uppercase text-xs rounded-xl border border-rose-100 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Trash2 size={13} />
                    <span>Hapus</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        </main>
      </form>

      {/* CAMERA SCANNER MODAL */}
      <CameraBarcodeScannerModal
        isOpen={scannerReady}
        onClose={() => { setScannerReady(false); setScanUnitBarcodeIdx(-1); }}
        title={scanUnitBarcodeIdx >= 0 ? `Scan Barcode ${units[scanUnitBarcodeIdx]?.code || 'Satuan'}` : 'Scan Barcode Produk'}
        description={scanUnitBarcodeIdx >= 0 ? `Arahkan kamera ke barcode kemasan ${units[scanUnitBarcodeIdx]?.code || ''}` : 'Arahkan kamera ke barcode / QR code produk'}
        onScan={(code) => {
          if (scanUnitBarcodeIdx >= 0) {
            setUnits((prev) => {
              const next = [...prev];
              next[scanUnitBarcodeIdx] = { ...next[scanUnitBarcodeIdx], barcode: code };
              return next;
            });
            toast.success(`Barcode ${units[scanUnitBarcodeIdx]?.code} dipindai: ${code}`);
          } else {
            setFormData((prev) => ({ ...prev, Barcode: code }));
            toast.success(`Barcode dipindai: ${code}`);
          }
          setScanUnitBarcodeIdx(-1);
        }}
      />

      {/* QUICK VARIANT MODAL */}
      {showVariantModal && (
        <QuickVariantModal
          isOpen={showVariantModal}
          product={{
            id,
            name: formData.Nama || '',
            sku: formData.ID || id,
            barcode: formData.Barcode,
            category: formData.Kategori,
            unit: formData.Satuan,
            costPrice: formData.Modal,
            priceEcer: formData.Ecer,
            stock: formData.Stok,
          }}
          onClose={() => setShowVariantModal(false)}
          onSuccess={() => fetchVariants()}
        />
      )}
    </>
  );
}
