'use client';

import { useEffect, useState, useMemo, useCallback, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DollarSign, TrendingUp, Package, Search,
  ArrowUpDown, Download, Edit3, AlertTriangle,
  History, ArrowLeft, RefreshCw, X, Save, Layers,
  ChevronRight, Percent, Sparkles, AlertCircle, RotateCcw,
  CheckSquare, Square, CheckCircle2, Info, Zap, Split,
  Lock, Unlock, Plus, Trash2, Tag, ShieldCheck, Calculator,
  Receipt, Building2, Archive
} from 'lucide-react';
import * as XLSX from 'xlsx';
import notify from '@/lib/notify';
import { supabase } from '@/lib/supabase';
import { getUserAndRole, sbGetDocs } from '@/lib/supabase-helpers';
import { isCategoryTaxExempt, DEFAULT_TAX_SETTINGS, type TaxSettings } from '@/lib/tax';
import { TableSkeleton } from '@/components/admin/InventorySkeleton';
import { findPricesBelowTarget } from '@/lib/pricing-review';
import { formatProductName } from '@/lib/format';
import { recommendSellingPrice, type PricingStrategy } from '@/lib/normalize';
import { calculateCustomerTierPrices } from '@/lib/customer-pricing';
import {
  updateProductPrice,
  getAllProductsAvgHpp,
  resetAvgHppForProducts,
  bulkUpdateTargetMargin,
  bulkDivideHpp,
  toggleLockProductHpp,
  syncAvgPoToActiveHpp,
  resetAvgFromCurrentStock,
  applyPriceRecommendations,
  bulkUpdateWholesalePrice,
  type BulkWholesaleOptions,
  bulkSetPriceTiers,
  type BulkPriceTiersOptions,
  type PriceTierRule,
  bulkUpdateProductStatus,
  bulkToggleKvi,
} from '@/lib/actions/product.actions';

export interface ProductUnitItem {
  code: string;
  contains: number;
  price?: number;
  minQty?: number;
  label?: string;
  barcode?: string;
}

interface ProductItem {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  unit: string;
  units: ProductUnitItem[];
  pricingStrategy?: PricingStrategy;
  isHppLocked: boolean;
  customHpp?: number;
  stock: number;
  costPrice: number;
  priceEcer: number;
  priceSemiGrosir: number;
  priceGrosir: number;
  minGrosir: number;
  isActive: boolean;
  satuanModal?: string;
  marginRp: number;
  marginPct: number;
  inventoryValue: number;
  potentialRevenue: number;
  potentialProfit: number;
  taxStatus: 'TAXABLE' | 'EXEMPT' | 'PPH22';
  taxLabel: string;
  isTaxExempt: boolean;
  parentId?: string;
  parentName?: string;
  isVariant: boolean;
  isParent: boolean;
  updatedAt?: string;
  priceTiers?: Array<{ minQty: number; price: number; label?: string }>;
  isKvi: boolean;
  shrinkagePct?: number;
  landedCost?: {
    inwardFreight?: number;
    handlingFee?: number;
    rebatePerUnit?: number;
    focRatio?: number;
    taxAdjustment?: number;
    notes?: string;
  };
}

interface AvgHppInfo {
  avgCost: number;
  lastPoCost?: number;
  lastPoDate?: string;
  lastPoSupplier?: string;
  lastPoNumber?: string;
  totalQty: number;
  poCount: number;
  isInheritedFromParent?: boolean;
  isInheritedFromVariant?: boolean;
}

interface CostPriceLog {
  id: string;
  productId: string;
  productName: string;
  type?: 'MODAL' | 'HARGA_JUAL';
  oldCost?: number;
  newCost?: number;
  oldPrice?: number;
  newPrice?: number;
  adminEmail: string;
  changeDate: any;
  notes?: string;
}

const roundToKelipatan = (val: number, step: number = 100) => {
  const s = step > 0 ? step : 1;
  return Math.ceil(val / s) * s;
};

// Deteksi otomatis KVI (Known Value Items / Sembako Cepat Putar Margin Tipis)
const isLikelyKvi = (name: string = '', category: string = ''): boolean => {
  const text = `${name} ${category}`.toUpperCase();
  return (
    text.includes('BERAS') ||
    text.includes('MINYAK') ||
    text.includes('GULA') ||
    text.includes('TERIGU') ||
    text.includes('TEPUNG') ||
    text.includes('INDOMIE') ||
    text.includes('MIE ') ||
    text.includes('SEDAAP') ||
    text.includes('TELUR') ||
    text.includes('ROKOK') ||
    text.includes('SUSU') ||
    text.includes('KOPI') ||
    text.includes('LE MINERALE') ||
    text.includes('AQUA') ||
    text.includes('SEMBAKO')
  );
};

export default function PricingHPPPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [avgLoading, setAvgLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'catalog' | 'history'>('catalog');
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [avgHppMap, setAvgHppMap] = useState<Record<string, AvgHppInfo>>({});
  const [costLogs, setCostLogs] = useState<CostPriceLog[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  // Mode Tampilan Tabel: Satuan Ecer Dasar vs Satuan Grosir (Dus/Karton/Karung)
  const [tableViewMode, setTableViewMode] = useState<'BASE' | 'GROSIR'>('BASE');

  // Filter States
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'ARCHIVED' | 'ALL'>('ACTIVE');
  const [marginFilter, setMarginFilter] = useState<'ALL' | 'HEALTHY' | 'SLIM' | 'CRITICAL' | 'NEGATIVE' | 'NEEDS_REVIEW'>('ALL');
  const [kviFilter, setKviFilter] = useState<'ALL' | 'KVI' | 'REGULAR'>('ALL');
  const [variantFilter, setVariantFilter] = useState<'ALL' | 'VARIANTS' | 'PARENTS' | 'REGULAR'>('ALL');
  const [taxFilter, setTaxFilter] = useState<'ALL' | 'TAXABLE' | 'EXEMPT' | 'PPH22'>('ALL');
  const [wholesaleFilter, setWholesaleFilter] = useState<'ALL' | 'ONLY_TIER' | 'NO_TIER'>('ALL');
  const [taxSettings, setTaxSettings] = useState<TaxSettings>(DEFAULT_TAX_SETTINGS);
  const [sortBy, setSortBy] = useState<'urgent_first' | 'po_latest' | 'name' | 'marginPct_desc' | 'marginPct_asc' | 'cost_desc' | 'price_desc' | 'stock_desc' | 'avg_diff'>('urgent_first');

  // Multi-select States
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showResetModal, setShowResetModal] = useState(false);
  const [skipLockedHpp, setSkipLockedHpp] = useState(true); // Default true: Lindungi produk yang sudah diset manual!
  const [showMarginModal, setShowMarginModal] = useState(false);
  const [showPriceReviewModal, setShowPriceReviewModal] = useState(false);
  const [marginType, setMarginType] = useState<'PERCENT' | 'NOMINAL'>('PERCENT');
  const [marginCalcMode, setMarginCalcMode] = useState<'MARGIN' | 'MARKUP' | 'NOMINAL'>('MARGIN');
  const [targetMarginValue, setTargetMarginValue] = useState<number>(20);
  const [marginUnitTarget, setMarginUnitTarget] = useState<string>('BASE_ONLY');
  const [showDivideModal, setShowDivideModal] = useState(false);
  const [showSyncAvgModal, setShowSyncAvgModal] = useState(false);
  const [showResetStockModal, setShowResetStockModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [newProductFilter, setNewProductFilter] = useState<'ALL' | 'NEW' | 'HAS_PO' | 'NO_PO'>('ALL');
  const [showWholesaleModal, setShowWholesaleModal] = useState(false);
  const [wholesaleMode, setWholesaleMode] = useState<'DISCOUNT_PERCENT' | 'DISCOUNT_NOMINAL' | 'MARGIN_COST' | 'FIXED_PRICE'>('DISCOUNT_PERCENT');
  const [wholesaleValue, setWholesaleValue] = useState<number>(5);
  const [wholesaleMinQty, setWholesaleMinQty] = useState<number>(3);
  const [wholesaleAllUnits, setWholesaleAllUnits] = useState(false);
  const [showTierModal, setShowTierModal] = useState(false);
  const [tierMode, setTierMode] = useState<'DISCOUNT_FROM_RETAIL' | 'MARGIN_FROM_COST'>('DISCOUNT_FROM_RETAIL');
  const [tierRules, setTierRules] = useState<Array<{ minQty: number; value: number; label: string }>>([
    { minQty: 1, value: 0, label: 'Ecer' },
    { minQty: 3, value: 5, label: 'Grosir 1' },
    { minQty: 12, value: 10, label: 'Grosir 2' },
  ]);
  const [tierRoundingStep, setTierRoundingStep] = useState<number>(100);
  const [divideValue, setDivideValue] = useState<number>(1);
  const [isResetting, startResetTransition] = useTransition();

  // Quick Edit Modal & FMCG Landed Cost Calculator
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [editModalCost, setEditModalCost] = useState<number>(0);
  const [editPriceEcer, setEditPriceEcer] = useState<number>(0);
  const [editPriceSemiGrosir, setEditPriceSemiGrosir] = useState<number>(0);
  const [editPriceGrosir, setEditPriceGrosir] = useState<number>(0);
  const [editMinGrosir, setEditMinGrosir] = useState<number>(1);
  const [editUnits, setEditUnits] = useState<ProductUnitItem[]>([]);
  const [editIsHppLocked, setEditIsHppLocked] = useState<boolean>(false);
  const [editRoundingStep, setEditRoundingStep] = useState<number>(100);
  const [savingEdit, setSavingEdit] = useState(false);

  // FMCG Commercial Accounting States in Quick Edit
  const [editIsKvi, setEditIsKvi] = useState(false);
  const [editShrinkagePct, setEditShrinkagePct] = useState(0);
  const [showLandedCalc, setShowLandedCalc] = useState(false);
  const [calcInvoicePrice, setCalcInvoicePrice] = useState(0);
  const [calcTaxMode, setCalcTaxMode] = useState<'EXEMPT' | 'EXCLUDE_PPN' | 'INCLUDE_PPN'>('EXEMPT');
  const [calcFreight, setCalcFreight] = useState(0);
  const [calcHandling, setCalcHandling] = useState(0);
  const [calcRebate, setCalcRebate] = useState(0);
  const [calcFocBuy, setCalcFocBuy] = useState(0);
  const [calcFocFree, setCalcFocFree] = useState(0);
  const [unitMarginMode, setUnitMarginMode] = useState<Record<number, 'MARGIN' | 'MARKUP'>>({});

  // Form tambah satuan di Quick Edit
  const [showAddUnitRow, setShowAddUnitRow] = useState(false);
  const [newUnitCode, setNewUnitCode] = useState('DUS');
  const [newUnitContains, setNewUnitContains] = useState<number>(24);
  const [newUnitPrice, setNewUnitPrice] = useState<number>(0);

  // Check auth
  useEffect(() => {
    (async () => {
      const { user, isAdmin } = await getUserAndRole();
      if (!user) return router.push('/admin/login');
      if (!isAdmin) {
        notify.aksesDitolakAdmin();
        return router.push('/profil');
      }
    })();
  }, [router]);

  // Fetch Avg HPP from PO history (server action, runs once)
  const fetchAvgHpp = useCallback(async () => {
    setAvgLoading(true);
    try {
      const map = await getAllProductsAvgHpp();
      setAvgHppMap(map);
    } catch (err) {
      console.warn('Gagal memuat AVG HPP dari PO:', err);
    } finally {
      setAvgLoading(false);
    }
  }, []);

  // Fetch Products & Categories
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch system tax settings
      let currentTaxSettings = DEFAULT_TAX_SETTINGS;
      try {
        const settingsSnap = await sbGetDocs({ table: 'settings' });
        settingsSnap.docs.forEach(d => {
          if (d.id === 'system' && d.data()?.tax) {
            currentTaxSettings = { ...DEFAULT_TAX_SETTINGS, ...d.data().tax };
          }
        });
        setTaxSettings(currentTaxSettings);
      } catch (err) {
        console.warn('Gagal membaca pengaturan pajak:', err);
      }

      let query = supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true })
        .limit(1000);

      if (statusFilter === 'ACTIVE') {
        query = query.or('is_active.eq.true,is_active.is.null');
      } else if (statusFilter === 'ARCHIVED') {
        query = query.eq('is_active', false);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Map untuk relasi varian anak <-> induk
      const nameMap = new Map<string, string>();
      const parentIdsSet = new Set<string>();
      (data || []).forEach((p: any) => {
        nameMap.set(p.id, p.name || p.raw_data?.Nama || 'Produk');
        const pId = (p.parent_id || p.raw_data?.Parent_ID || p.raw_data?.parentId || '').toString().trim();
        if (pId) parentIdsSet.add(pId);
      });

      const rawItems = (data || []).map((p: Record<string, any>) => {
        const raw = p.raw_data || {};
        const cost = Number(p.cost_price ?? raw.Modal ?? raw.purchasePrice ?? 0);
        const ecer = Number(p.price ?? raw.Ecer ?? raw.price ?? 0);
        const grosir = Number(raw.Grosir ?? raw.wholesalePrice ?? raw.priceGrosir ?? 0);
        const minG = Number(raw.Min_Grosir ?? raw.minWholesale ?? 1);
        const stk = Number(p.stock ?? raw.Stok ?? raw.stock ?? 0);
        const baseUnit = (p.unit || raw.Satuan || 'PCS').toUpperCase();
        const marginRp = ecer - cost;
        const marginPct = ecer > 0 ? (marginRp / ecer) * 100 : 0;
        const invVal = stk * cost;
        const potRev = stk * ecer;
        const potProf = stk * marginRp;

        // Evaluasi Status Wajib Pajak vs Bebas Pajak
        const categoryStr = (p.category || raw.Kategori || 'UMUM').trim();
        const nameUpper = (p.name || raw.Nama || '').toUpperCase();
        const catUpper = categoryStr.toUpperCase();

        const manualExempt = raw.isTaxExempt === true || p.is_tax_exempt === true;
        const isPph22Industry = catUpper.includes('SEMEN') || nameUpper.includes('SEMEN') || catUpper.includes('BAJA') || nameUpper.includes('BAJA') || catUpper.includes('KERTAS') || nameUpper.includes('KERTAS') || catUpper.includes('BESI');

        let taxStatus: 'TAXABLE' | 'EXEMPT' | 'PPH22' = 'TAXABLE';
        let taxLabel = 'Wajib PPN 11%';

        if (isPph22Industry) {
          taxStatus = 'PPH22';
          taxLabel = 'PPh 22 Industri';
        } else if (manualExempt || isCategoryTaxExempt(categoryStr, currentTaxSettings.nonTaxableCategories)) {
          taxStatus = 'EXEMPT';
          taxLabel = 'Bebas PPN (0% Sembako)';
        } else {
          taxStatus = 'TAXABLE';
          taxLabel = 'Wajib PPN 11%';
        }

        // Parse list semua satuan produk
        let unitsList: ProductUnitItem[] = [];
        if (Array.isArray(raw.units) && raw.units.length > 0) {
          unitsList = raw.units.map((u: any) => ({
            code: String(u.code || u.unit || '').trim().toUpperCase(),
            contains: Number(u.contains || (String(u.code || u.unit || '').toUpperCase() === baseUnit ? 1 : 1)),
            price: typeof u.price === 'number' ? u.price : Number(u.price || 0),
            minQty: typeof u.minQty === 'number' ? u.minQty : undefined,
            label: u.label || '',
            barcode: u.barcode ? String(u.barcode).trim() : undefined,
          })).filter((u: any) => Boolean(u.code));
        }

        // Pastikan base unit selalu ada di list
        const baseUnitIdx = unitsList.findIndex(u => u.code === baseUnit);
        if (baseUnitIdx === -1) {
          unitsList.unshift({
            code: baseUnit,
            contains: 1,
            price: ecer,
            barcode: p.barcode || raw.Barcode || '',
          });
        } else {
          // Sinkronkan harga ecer untuk base unit jika di units belum ada harga
          if (!unitsList[baseUnitIdx].price) {
            unitsList[baseUnitIdx].price = ecer;
          }
          if (!unitsList[baseUnitIdx].barcode && (p.barcode || raw.Barcode)) {
            unitsList[baseUnitIdx].barcode = p.barcode || raw.Barcode;
          }
        }

        const isHppLocked = Boolean(raw.isHppLocked);

        const isArchivedLegacy = 
          raw.isActive === false || 
          raw.isActive === 'false' || 
          raw.status === 'ARCHIVED' || 
          raw.status === 'DRAFT' || 
          raw.isDraft === true ||
          raw.isArchived === true;

        const isItemActive = p.is_active === false || isArchivedLegacy ? false : true;

        const isKvi = raw.isKvi !== undefined ? Boolean(raw.isKvi) : isLikelyKvi(p.name || raw.Nama || '', categoryStr);
        const shrinkagePct = Number(raw.shrinkagePct || 0);
        const landedCost = raw.landedCost;

        return {
          id: p.id,
          name: p.name || raw.Nama || 'Tanpa Nama',
          sku: p.sku || raw.ID || p.id,
          barcode: p.barcode || raw.Barcode || '',
          category: p.category || raw.Kategori || 'UMUM',
          unit: baseUnit,
          units: unitsList,
          pricingStrategy: raw.pricingStrategy as PricingStrategy | undefined,
          isHppLocked,
          customHpp: typeof raw.customHpp === 'number' ? raw.customHpp : cost,
          stock: stk,
          costPrice: cost,
          priceEcer: ecer,
          priceSemiGrosir: Number(raw.priceSemiGrosir ?? raw.wholesaleSemiPrice ?? raw.Harga_Semi_Grosir ?? 0),
          priceGrosir: grosir,
          minGrosir: minG,
          isActive: isItemActive,
          satuanModal: raw.Satuan_Modal || raw.Satuan || p.unit || 'PCS',
          marginRp,
          marginPct,
          inventoryValue: invVal,
          potentialRevenue: potRev,
          potentialProfit: potProf,
          taxStatus,
          taxLabel,
          isTaxExempt: taxStatus === 'EXEMPT',
          parentId: (p.parent_id || raw.Parent_ID || raw.parentId || '').toString().trim() || undefined,
          parentName: (p.parent_id || raw.Parent_ID || raw.parentId || '').toString().trim() ? nameMap.get((p.parent_id || raw.Parent_ID || raw.parentId || '').toString().trim()) : undefined,
          isVariant: Boolean((p.parent_id || raw.Parent_ID || raw.parentId || '').toString().trim()),
          isParent: parentIdsSet.has(p.id),
          updatedAt: p.updated_at || raw.updatedAt || raw.customHppUpdatedAt || '',
          priceTiers: Array.isArray(raw.priceTiers) ? raw.priceTiers : undefined,
          isKvi,
          shrinkagePct,
          landedCost,
        };
      });

      setProducts(rawItems);
      setSelectedIds(new Set()); // reset selection on reload

      // Collect categories
      const cats = Array.from(new Set(rawItems.map(p => p.category))).filter(Boolean) as string[];
      setCategories(cats.sort());

      // Fetch cost / price change history
      try {
        const { data: logsData } = await supabase
          .from('product_cost_logs')
          .select('*')
          .order('changeDate', { ascending: false })
          .limit(150);
        const logs = (logsData || []).map(d => ({ id: d.id, ...d } as CostPriceLog));
        setCostLogs(logs);
      } catch (err) {
        console.warn('Gagal load log cost_logs:', err);
      }

    } catch (err: any) {
      console.error(err);
      notify.error(err.message || 'Gagal memuat data produk');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
    fetchAvgHpp();
  }, [fetchData, fetchAvgHpp]);

  // KPIs
  const kpis = useMemo(() => {
    const totalCount = products.length;
    let totalStockValue = 0;
    let totalPotentialRevenue = 0;
    let totalPotentialProfit = 0;
    let totalMarginPctSum = 0;
    let validMarginCount = 0;
    let avgDriftCount = 0; // products where costPrice != avgCost significantly
    let taxableCount = 0;
    let exemptCount = 0;
    let pph22Count = 0;
    let wholesaleCount = 0;
    let activeCount = 0;
    let archivedCount = 0;
    let kviCount = 0;

    products.forEach(p => {
      if (p.isActive) activeCount++;
      else archivedCount++;
      if (p.isKvi) kviCount++;

      if ((p.priceTiers && p.priceTiers.length > 1) || p.priceGrosir > 0) {
        wholesaleCount++;
      }

      totalStockValue += Math.max(0, p.inventoryValue);
      totalPotentialRevenue += Math.max(0, p.potentialRevenue);
      totalPotentialProfit += p.potentialProfit;
      if (p.priceEcer > 0) {
        totalMarginPctSum += p.marginPct;
        validMarginCount++;
      }
      const avg = avgHppMap[p.id];
      if (avg && avg.avgCost > 0 && Math.abs(avg.avgCost - p.costPrice) > 100) {
        avgDriftCount++;
      }

      if (p.taxStatus === 'TAXABLE') taxableCount++;
      else if (p.taxStatus === 'EXEMPT') exemptCount++;
      else if (p.taxStatus === 'PPH22') pph22Count++;
    });

    const avgMarginPct = validMarginCount > 0 ? totalMarginPctSum / validMarginCount : 0;

    return {
      totalCount,
      totalStockValue,
      totalPotentialRevenue,
      totalPotentialProfit,
      avgMarginPct,
      avgDriftCount,
      taxableCount,
      exemptCount,
      pph22Count,
      wholesaleCount,
      activeCount,
      archivedCount,
      kviCount,
    };
  }, [products, avgHppMap]);

  const priceReviewByProduct = useMemo(() => new Map(
    products.map((product) => [product.id, findPricesBelowTarget(product)])
  ), [products]);

  const productsNeedingPriceReview = useMemo(
    () => products.filter((product) => (priceReviewByProduct.get(product.id)?.length || 0) > 0).length,
    [products, priceReviewByProduct]
  );

  // Filtered & Sorted Products
  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim();
    return products
      .filter(p => {
        const matchSearch = !q ||
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.toLowerCase().includes(q) ||
          (p.units && p.units.some((u: any) => (u.barcode || '').toLowerCase().includes(q)));
        const matchCat = selectedCategory === 'ALL' || p.category === selectedCategory;

        let matchKvi = true;
        if (kviFilter === 'KVI') matchKvi = p.isKvi;
        else if (kviFilter === 'REGULAR') matchKvi = !p.isKvi;

        let matchMargin = true;
        if (marginFilter === 'HEALTHY') {
          // Bagi KVI (Sembako), margin >= 2% adalah sehat grosir/ecer volume
          matchMargin = p.isKvi ? p.marginPct >= 2 : p.marginPct >= 20;
        } else if (marginFilter === 'SLIM') {
          matchMargin = p.isKvi ? (p.marginPct >= 1 && p.marginPct < 2) : (p.marginPct >= 8 && p.marginPct < 20);
        } else if (marginFilter === 'CRITICAL') {
          matchMargin = p.isKvi ? (p.marginPct > 0 && p.marginPct < 1) : (p.marginPct > 0 && p.marginPct < 8);
        } else if (marginFilter === 'NEGATIVE') {
          matchMargin = p.marginPct <= 0;
        } else if (marginFilter === 'NEEDS_REVIEW') {
          matchMargin = (priceReviewByProduct.get(p.id)?.length || 0) > 0;
        }

        let matchTax = true;
        if (taxFilter === 'TAXABLE') matchTax = p.taxStatus === 'TAXABLE';
        else if (taxFilter === 'EXEMPT') matchTax = p.taxStatus === 'EXEMPT';
        else if (taxFilter === 'PPH22') matchTax = p.taxStatus === 'PPH22';

        let matchVariant = true;
        if (variantFilter === 'VARIANTS') matchVariant = p.isVariant;
        else if (variantFilter === 'PARENTS') matchVariant = p.isParent;
        else if (variantFilter === 'REGULAR') matchVariant = !p.isVariant && !p.isParent;

        const matchStatus =
          statusFilter === 'ALL' ||
          (statusFilter === 'ACTIVE' && p.isActive) ||
          (statusFilter === 'ARCHIVED' && !p.isActive);

        let matchNewPo = true;
        const thirtyDaysAgo = Date.now() - 30 * 86400 * 1000;
        if (newProductFilter === 'NEW') {
          const isNew = p.updatedAt ? new Date(p.updatedAt).getTime() > thirtyDaysAgo : false;
          const hasNoPo = !avgHppMap[p.id] || (avgHppMap[p.id]?.poCount || 0) === 0;
          matchNewPo = isNew && hasNoPo;
        } else if (newProductFilter === 'HAS_PO') {
          matchNewPo = (avgHppMap[p.id]?.poCount || 0) > 0;
        } else if (newProductFilter === 'NO_PO') {
          matchNewPo = !avgHppMap[p.id] || (avgHppMap[p.id]?.poCount || 0) === 0;
        }

        return matchStatus && matchSearch && matchCat && matchMargin && matchTax && matchVariant && matchNewPo && matchKvi;
      })
      .sort((a, b) => {
        if (sortBy === 'urgent_first') {
          // 1. Indikator harga jual perlu naik (di bawah modal / rugi) di paling atas
          const needsReviewA = (priceReviewByProduct.get(a.id)?.length || 0) > 0 ? 1 : 0;
          const needsReviewB = (priceReviewByProduct.get(b.id)?.length || 0) > 0 ? 1 : 0;
          if (needsReviewA !== needsReviewB) return needsReviewB - needsReviewA;

          // 2. Tanggal update PO terakhir (lastPoDate)
          const poDateA = avgHppMap[a.id]?.lastPoDate ? new Date(avgHppMap[a.id]!.lastPoDate!).getTime() : 0;
          const poDateB = avgHppMap[b.id]?.lastPoDate ? new Date(avgHppMap[b.id]!.lastPoDate!).getTime() : 0;
          if (poDateA !== poDateB) return poDateB - poDateA;

          // 3. Tanggal update HPP / data produk terakhir
          const updatedA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const updatedB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          if (updatedA !== updatedB) return updatedB - updatedA;

          return a.name.localeCompare(b.name);
        }
        if (sortBy === 'po_latest') {
          const poDateA = avgHppMap[a.id]?.lastPoDate ? new Date(avgHppMap[a.id]!.lastPoDate!).getTime() : 0;
          const poDateB = avgHppMap[b.id]?.lastPoDate ? new Date(avgHppMap[b.id]!.lastPoDate!).getTime() : 0;
          if (poDateA !== poDateB) return poDateB - poDateA;

          const updatedA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const updatedB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          if (updatedA !== updatedB) return updatedB - updatedA;

          return a.name.localeCompare(b.name);
        }
        if (sortBy === 'marginPct_desc') return b.marginPct - a.marginPct;
        if (sortBy === 'marginPct_asc') return a.marginPct - b.marginPct;
        if (sortBy === 'cost_desc') return b.costPrice - a.costPrice;
        if (sortBy === 'price_desc') return b.priceEcer - a.priceEcer;
        if (sortBy === 'stock_desc') return b.stock - a.stock;
        if (sortBy === 'avg_diff') {
          const diffA = Math.abs((avgHppMap[a.id]?.avgCost ?? a.costPrice) - a.costPrice);
          const diffB = Math.abs((avgHppMap[b.id]?.avgCost ?? b.costPrice) - b.costPrice);
          return diffB - diffA;
        }
        return a.name.localeCompare(b.name);
      });
  }, [products, search, selectedCategory, statusFilter, marginFilter, taxFilter, variantFilter, sortBy, avgHppMap, priceReviewByProduct, newProductFilter, kviFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const paginatedProducts = useMemo(
    () => filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredProducts, currentPage, pageSize]
  );

  // Multi-select helpers
  const allFilteredIds = useMemo(() => filteredProducts.map(p => p.id), [filteredProducts]);

  // Reset to page 1 on filter/search change
  useEffect(() => { setCurrentPage(1); }, [search, selectedCategory, statusFilter, marginFilter, taxFilter, variantFilter, newProductFilter, sortBy, kviFilter]);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.has(id));
  const someSelected = allFilteredIds.some(id => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        allFilteredIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        allFilteredIds.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Products that have AVG data and are selected
  const selectedWithAvg = useMemo(() => {
    return Array.from(selectedIds).filter(id => {
      const avg = avgHppMap[id];
      return avg && avg.avgCost > 0;
    });
  }, [selectedIds, avgHppMap]);

  const selectedWithoutAvg = useMemo(() => {
    return Array.from(selectedIds).filter(id => {
      const avg = avgHppMap[id];
      return !avg || avg.avgCost <= 0;
    });
  }, [selectedIds, avgHppMap]);

  // Produk yang memiliki selisih (drift) antara HPP aktif dan AVG PO
  const selectedWithDrift = useMemo(() => {
    return Array.from(selectedIds).filter(id => {
      const p = products.find(prod => prod.id === id);
      const avg = avgHppMap[id];
      if (!p || !avg || avg.avgCost <= 0) return false;
      return Math.abs(avg.avgCost - p.costPrice) > 100;
    });
  }, [selectedIds, products, avgHppMap]);

  // Daftar seluruh satuan unik yang tersedia pada produk-produk yang saat ini dicentang
  const availableUnitsInSelected = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (selectedIds.has(p.id)) {
        if (p.units && Array.isArray(p.units)) {
          p.units.forEach(u => {
            if (u.code) set.add(u.code.toUpperCase());
          });
        }
        if (p.unit) set.add(p.unit.toUpperCase());
      }
    });
    return Array.from(set).sort();
  }, [products, selectedIds]);

  // Reset AVG HPP Handler
  const handleResetAvgHpp = () => {
    if (selectedIds.size === 0) {
      notify.error('Pilih minimal 1 produk terlebih dahulu');
      return;
    }
    setShowResetModal(true);
  };

  const handleConfirmReset = () => {
    startResetTransition(async () => {
      try {
        const userRes = await supabase.auth.getUser();
        const adminEmail = userRes.data.user?.email || 'admin';

        const result = await resetAvgHppForProducts(
          Array.from(selectedIds),
          avgHppMap,
          adminEmail,
          { skipLockedHpp }
        );

        setShowResetModal(false);

        if (!result.success) throw new Error(result.error);

        let msg = `✅ Berhasil update ${result.updated} produk`;
        if (result.lockedSkipped > 0) {
          msg += ` · ${result.lockedSkipped} produk aman dilewati (HPP sudah diset manual)`;
        }
        if (result.skipped > 0) {
          msg += ` · ${result.skipped} dilewati (tidak ada data PO)`;
        }
        notify.success(msg);

        setSelectedIds(new Set());
        await fetchData();
        await fetchAvgHpp();
      } catch (err: any) {
        setShowResetModal(false);
        notify.error(err.message || 'Gagal mereset AVG HPP');
      }
    });
  };

  // Bulk Target Margin Handlers
  const handleSetTargetMargin = () => {
    if (selectedIds.size === 0) {
      notify.error('Pilih minimal 1 produk terlebih dahulu');
      return;
    }
    if (marginFilter === 'NEEDS_REVIEW') {
      setShowPriceReviewModal(true);
      return;
    }
    setShowMarginModal(true);
  };

  const handleApplyPriceRecommendations = () => {
    const productIds = selectedPriceReviewProducts.map((product) => product.id);
    if (productIds.length === 0) {
      notify.error('Pilih minimal 1 produk yang perlu penyesuaian harga.');
      return;
    }

    setShowPriceReviewModal(false);
    startResetTransition(async () => {
      try {
        const result = await applyPriceRecommendations(productIds);
        if (!result.success && result.updated === 0) throw new Error(result.error || 'Gagal menerapkan rekomendasi');

        if (result.updated > 0) {
          notify.success(`Harga diperbarui untuk ${result.updated} produk dan ${result.adjustedUnits} satuan.`);
        } else {
          notify.success('Harga produk sudah sesuai target; tidak ada perubahan.');
        }
        if (result.failed > 0) notify.error(`${result.failed} produk gagal diperbarui. Periksa log untuk detail.`);

        setSelectedIds(new Set());
        await fetchData();
      } catch (error: any) {
        notify.error(error.message || 'Gagal menerapkan rekomendasi harga');
      }
    });
  };

  const handleConfirmTargetMargin = () => {
    startResetTransition(async () => {
      try {
        const userRes = await supabase.auth.getUser();
        const adminEmail = userRes.data.user?.email || 'admin';

        const result = await bulkUpdateTargetMargin(
          Array.from(selectedIds),
          targetMarginValue,
          adminEmail,
          {
            marginType: marginCalcMode === 'NOMINAL' ? 'NOMINAL' : marginCalcMode === 'MARKUP' ? 'PERCENT_MARKUP' : 'PERCENT_MARGIN',
            isMarkup: marginCalcMode === 'MARKUP',
            targetUnitMode: marginUnitTarget,
          }
        );

        setShowMarginModal(false);

        if (!result.success) throw new Error(result.error);

        notify.success(
          `✅ Berhasil menyesuaikan harga untuk ${result.updated} produk (${
            marginCalcMode === 'NOMINAL'
              ? `+Rp ${targetMarginValue.toLocaleString('id-ID')}`
              : marginCalcMode === 'MARKUP'
              ? `Markup +${targetMarginValue}%`
              : `Margin ${targetMarginValue}%`
          })`
        );

        setSelectedIds(new Set());
        await fetchData();
      } catch (err: any) {
        setShowMarginModal(false);
        notify.error(err.message || 'Gagal mengatur target margin');
      }
    });
  };

  // Bulk Divide HPP Handlers
  const handleSetDivideHpp = () => {
    if (selectedIds.size === 0) {
      notify.error('Pilih minimal 1 produk terlebih dahulu');
      return;
    }
    setShowDivideModal(true);
  };

  const handleConfirmDivideHpp = () => {
    startResetTransition(async () => {
      try {
        const userRes = await supabase.auth.getUser();
        const adminEmail = userRes.data.user?.email || 'admin';

        const result = await bulkDivideHpp(
          Array.from(selectedIds),
          divideValue,
          adminEmail,
        );

        setShowDivideModal(false);

        if (!result.success) throw new Error(result.error);

        notify.success(`✅ Berhasil membagi HPP untuk ${result.updated} produk & HPP dikunci otomatis`);

        setSelectedIds(new Set());
        await fetchData();
      } catch (err: any) {
        setShowDivideModal(false);
        notify.error(err.message || 'Gagal mengkonversi HPP');
      }
    });
  };

  // Bulk Lock / Unlock HPP Handlers
  const handleBulkLock = (isLocked: boolean) => {
    if (selectedIds.size === 0) {
      notify.error('Pilih minimal 1 produk terlebih dahulu');
      return;
    }
    startResetTransition(async () => {
      try {
        const userRes = await supabase.auth.getUser();
        const adminEmail = userRes.data.user?.email || 'admin';

        const res = await toggleLockProductHpp(Array.from(selectedIds), isLocked, adminEmail);
        if (!res.success) throw new Error(res.error);

        notify.success(
          `✅ Berhasil ${isLocked ? 'mengunci' : 'membuka kunci'} HPP ${res.updated} produk`
        );
        setSelectedIds(new Set());
        await fetchData();
      } catch (err: any) {
        notify.error(err.message || 'Gagal mengubah status kunci HPP');
      }
    });
  };

  const handleBulkWholesale = () => {
    if (selectedIds.size === 0) { notify.error('Pilih minimal 1 produk'); return; }
    startResetTransition(async () => {
      try {
        const userRes = await supabase.auth.getUser();
        const adminEmail = userRes.data.user?.email || 'admin';
        const result = await bulkUpdateWholesalePrice(
          Array.from(selectedIds),
          {
            mode: wholesaleMode,
            value: wholesaleValue,
            minQty: wholesaleMinQty,
            roundingStep: 100,
            targetUnitMode: wholesaleAllUnits ? 'ALL_UNITS' : 'BASE_ONLY',
          },
          adminEmail,
        );
        setShowWholesaleModal(false);
        if (!result.success) throw new Error(result.error);
        notify.success(`✅ Berhasil update harga grosir untuk ${result.updated} produk`);
        setSelectedIds(new Set());
        await fetchData();
      } catch (err: any) {
        setShowWholesaleModal(false);
        notify.error(err.message || 'Gagal update grosir');
      }
    });
  };

  const handleBulkSetPriceTiers = () => {
    if (selectedIds.size === 0) { notify.error('Pilih minimal 1 produk'); return; }
    if (tierRules.length < 2) { notify.error('Minimal harus ada 2 tingkatan harga (Ecer + Grosir)'); return; }
    startResetTransition(async () => {
      try {
        const userRes = await supabase.auth.getUser();
        const adminEmail = userRes.data.user?.email || 'admin';
        const result = await bulkSetPriceTiers(
          Array.from(selectedIds),
          {
            mode: tierMode,
            tiers: tierRules,
            roundingStep: tierRoundingStep,
          },
          adminEmail,
        );
        setShowTierModal(false);
        if (!result.success) throw new Error(result.error);
        notify.success(`✅ Berhasil menghitung & menerapkan tier harga untuk ${result.updated} produk`);
        setSelectedIds(new Set());
        await fetchData();
      } catch (err: any) {
        setShowTierModal(false);
        notify.error(err.message || 'Gagal update tier grosir');
      }
    });
  };

  const handleBulkUpdateStatus = (isActive: boolean) => {
    if (selectedIds.size === 0) {
      notify.error('Pilih minimal 1 produk terlebih dahulu');
      return;
    }
    const actionLabel = isActive ? 'mengaktifkan' : 'mengarsipkan';
    if (!window.confirm(`Yakin ingin ${actionLabel} ${selectedIds.size} produk terpilih?`)) return;

    startResetTransition(async () => {
      try {
        const userRes = await supabase.auth.getUser();
        const adminEmail = userRes.data.user?.email || 'admin';
        const result = await bulkUpdateProductStatus(Array.from(selectedIds), isActive, adminEmail);
        if (!result.success) throw new Error(result.error);
        notify.success(`✅ Berhasil ${actionLabel} ${result.updated} produk`);
        setSelectedIds(new Set());
        await fetchData();
      } catch (err: any) {
        notify.error(err.message || `Gagal ${actionLabel} produk`);
      }
    });
  };

  // Reset AVG dari Stok Terkini (skenario produk pernah kosong)
  const handleConfirmResetFromStock = () => {
    startResetTransition(async () => {
      try {
        const userRes = await supabase.auth.getUser();
        const adminEmail = userRes.data.user?.email || 'admin';

        const result = await resetAvgFromCurrentStock(Array.from(selectedIds), adminEmail);
        setShowResetStockModal(false);

        if (!result.success) throw new Error(result.error);

        let msg = `✅ Berhasil reset AVG dari stok terkini untuk ${result.updated} produk!`;
        if (result.skipped > 0) msg += ` · ${result.skipped} dilewati (HPP 0 atau tidak ditemukan)`;
        notify.success(msg);

        setSelectedIds(new Set());
        await fetchData();
        await fetchAvgHpp();
      } catch (err: any) {
        setShowResetStockModal(false);
        notify.error(err.message || 'Gagal reset AVG dari stok terkini');
      }
    });
  };

  // Inisialisasi Saldo Awal Baseline AVG PO = HPP Aktif
  const handleConfirmSyncAvgPo = (specificIds?: string[]) => {
    const idsToSync = specificIds || Array.from(selectedIds);
    if (idsToSync.length === 0) {
      notify.error('Pilih minimal 1 produk terlebih dahulu');
      return;
    }

    startResetTransition(async () => {
      try {
        const userRes = await supabase.auth.getUser();
        const adminEmail = userRes.data.user?.email || 'admin';

        const result = await syncAvgPoToActiveHpp(idsToSync, adminEmail);
        setShowSyncAvgModal(false);

        if (!result.success) throw new Error(result.error);

        notify.success(`✅ Berhasil menginisialisasi AVG PO = HPP Aktif untuk ${result.updated} produk!`);

        if (!specificIds) {
          setSelectedIds(new Set());
        }
        await fetchData();
        await fetchAvgHpp();
      } catch (err: any) {
        setShowSyncAvgModal(false);
        notify.error(err.message || 'Gagal menyinkronkan AVG PO');
      }
    });
  };

  // Kalkulasi HPP Netto & Landed Cost Interaktif (Akuntansi FMCG)
  const calculatedLandedCost = useMemo(() => {
    const base = Number(calcInvoicePrice || 0);
    let afterTax = base;
    let taxAmount = 0;
    if (calcTaxMode === 'EXCLUDE_PPN') {
      taxAmount = base * 0.11;
      afterTax = base + taxAmount;
    } else if (calcTaxMode === 'INCLUDE_PPN') {
      taxAmount = -(base - (base / 1.11));
      afterTax = base / 1.11;
    }

    const freight = Number(calcFreight || 0);
    const handling = Number(calcHandling || 0);
    const totalAdditional = freight + handling;

    const rebate = Number(calcRebate || 0);
    
    // FOC discount ratio: jika beli 10 gratis 1, biaya per unit = afterTax * 10 / 11
    let focMultiplier = 1;
    if (calcFocBuy > 0 && calcFocFree > 0) {
      focMultiplier = calcFocBuy / (calcFocBuy + calcFocFree);
    }
    const afterFocAndRebate = (afterTax * focMultiplier) + totalAdditional - rebate;

    // Shrinkage adjustment: jika susut 2%, HPP per kg = modal / (1 - 0.02)
    const shrink = Number(editShrinkagePct || 0);
    let finalNetHpp = afterFocAndRebate;
    if (shrink > 0 && shrink < 50) {
      finalNetHpp = afterFocAndRebate / (1 - (shrink / 100));
    }
    const roundedNetHpp = roundToKelipatan(Math.max(0, finalNetHpp), editRoundingStep);

    return {
      base,
      afterTax,
      taxAmount,
      totalAdditional,
      rebate,
      focMultiplier,
      shrinkageAmount: finalNetHpp - afterFocAndRebate,
      finalNetHpp: roundedNetHpp,
    };
  }, [calcInvoicePrice, calcTaxMode, calcFreight, calcHandling, calcRebate, calcFocBuy, calcFocFree, editShrinkagePct, editRoundingStep]);

  // Bulk Tag KVI Sembako
  const handleBulkToggleKvi = async (setKvi: boolean) => {
    if (selectedIds.size === 0) return;
    startResetTransition(async () => {
      try {
        const ids = Array.from(selectedIds);
        const res = await bulkToggleKvi(ids, setKvi);
        if (res.success) {
          notify.success(`${res.count} produk berhasil ${setKvi ? 'ditandai sebagai KVI Sembako' : 'dijadikan produk reguler'}`);
          setProducts(prev => prev.map(p => ids.includes(p.id) ? { ...p, isKvi: setKvi } : p));
          setSelectedIds(new Set());
        } else {
          notify.error(res.error || 'Gagal mengubah status KVI');
        }
      } catch (err: any) {
        notify.error(err.message || 'Gagal mengubah status KVI');
      }
    });
  };

  // Open Quick Edit
  const handleOpenEdit = (p: ProductItem) => {
    setEditingProduct(p);
    setEditModalCost(p.costPrice);
    setEditPriceEcer(p.priceEcer);
    setEditPriceSemiGrosir(p.priceSemiGrosir || 0);
    setEditPriceGrosir(p.priceGrosir);
    setEditMinGrosir(p.minGrosir);
    setEditIsHppLocked(Boolean(p.isHppLocked));
    const initialRounding = Number(p.pricingStrategy?.roundingStep || 100);
    setEditRoundingStep(initialRounding > 0 ? initialRounding : 100);

    // FMCG states
    setEditIsKvi(Boolean(p.isKvi));
    setEditShrinkagePct(Number(p.shrinkagePct || 0));
    setShowLandedCalc(false);
    setCalcInvoicePrice(p.costPrice);
    setCalcTaxMode(p.taxStatus === 'TAXABLE' ? 'EXCLUDE_PPN' : 'EXEMPT');
    setCalcFreight(p.landedCost?.inwardFreight || 0);
    setCalcHandling(p.landedCost?.handlingFee || 0);
    setCalcRebate(p.landedCost?.rebatePerUnit || 0);
    setCalcFocBuy(0);
    setCalcFocFree(0);
    setUnitMarginMode({});

    // Clone units list atau fallback ke base unit jika kosong
    const initialUnits: ProductUnitItem[] = p.units && p.units.length > 0
      ? JSON.parse(JSON.stringify(p.units))
      : [{ code: p.unit, contains: 1, price: p.priceEcer }];

    setEditUnits(initialUnits);
    setShowAddUnitRow(false);
    setNewUnitPrice(0);
  };

  // Save Quick Edit
  const handleSaveEdit = async () => {
    if (!editingProduct) return;
    setSavingEdit(true);
    try {
      const userRes = await supabase.auth.getUser();
      const adminEmail = userRes.data.user?.email || 'admin';

      const oldCost = editingProduct.costPrice;
      const newCost = Number(editModalCost || 0);
      const oldPrice = editingProduct.priceEcer;
      const newPrice = Number(editPriceEcer || 0);
      const newSemiGrosir = Number(editPriceSemiGrosir || 0);
      const newGrosir = Number(editPriceGrosir || 0);
      const newMinGrosir = Number(editMinGrosir || 1);

      // Validasi Anti-Rugi: Harga Grosir & Semi-Grosir TIDAK BOLEH sama dengan atau di bawah modal
      if (newCost > 0 && newGrosir > 0 && newGrosir <= newCost) {
        notify.error(`Harga Grosir (Rp${newGrosir.toLocaleString('id-ID')}) tidak boleh sama dengan atau lebih rendah dari Modal (Rp${newCost.toLocaleString('id-ID')})!`);
        setSavingEdit(false);
        return;
      }
      if (newCost > 0 && newSemiGrosir > 0 && newSemiGrosir <= newCost) {
        notify.error(`Harga Semi-Grosir (Rp${newSemiGrosir.toLocaleString('id-ID')}) tidak boleh sama dengan atau lebih rendah dari Modal (Rp${newCost.toLocaleString('id-ID')})!`);
        setSavingEdit(false);
        return;
      }

      // Sinkronisasi base unit di editUnits dengan newPrice
      const syncedUnits = editUnits.map(u => {
        if (u.code === editingProduct.unit) {
          return { ...u, price: newPrice, contains: 1 };
        }
        return u;
      });

      const result = await updateProductPrice({
        productId: editingProduct.id,
        newCost,
        newPrice,
        newSemiGrosir,
        newGrosir,
        newMinGrosir,
        units: syncedUnits,
        isHppLocked: editIsHppLocked,
        roundingStep: editRoundingStep,
        isKvi: editIsKvi,
        shrinkagePct: editShrinkagePct,
        landedCost: {
          inwardFreight: calcFreight,
          handlingFee: calcHandling,
          rebatePerUnit: calcRebate,
          notes: showLandedCalc ? 'Kalkulator Landed Cost FMCG' : undefined,
        },
      });

      if (!result.success) throw new Error(result.error || 'Gagal menyimpan');

      const hasCostChanged = oldCost !== newCost;
      const hasPriceChanged = oldPrice !== newPrice;
      if (hasCostChanged || hasPriceChanged) {
        try {
          const now = new Date().toISOString();
          await supabase.from('product_cost_logs').insert({
            id: `prcl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            productId: editingProduct.id,
            productName: editingProduct.name,
            oldCost,
            newCost,
            oldPrice,
            newPrice,
            adminEmail,
            changeDate: now,
            notes: editIsHppLocked
              ? 'Update harga & kunci HPP'
              : (hasCostChanged && hasPriceChanged
                  ? 'Update cepat modal & harga jual'
                  : (hasCostChanged ? 'Update cepat harga modal' : 'Update cepat harga jual ecer')),
            created_at: now,
          });
        } catch (logErr) {
          console.warn('Gagal tulis log audit:', logErr);
        }
      }

      notify.success(`Harga & satuan ${editingProduct.name} berhasil diperbarui!`);
      setEditingProduct(null);
      fetchData();
    } catch (err: any) {
      console.error(err);
      notify.error(err.message || 'Gagal menyimpan harga');
    } finally {
      setSavingEdit(false);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const rows = filteredProducts.map(p => {
      const avg = avgHppMap[p.id];
      return {
        'SKU / ID': p.sku,
        'Barcode': p.barcode,
        'Nama Produk': p.name,
        'Kategori': p.category,
        'Klasifikasi Sembako': p.isKvi ? 'KVI Sembako' : 'Reguler',
        'Susut Curah (%)': p.shrinkagePct || 0,
        'Satuan': p.unit,
        'Stok': p.stock,
        'HPP Aktif (Rp)': p.costPrice,
        'Ongkir Masuk (Rp)': p.landedCost?.inwardFreight || 0,
        'Kuli Bongkar (Rp)': p.landedCost?.handlingFee || 0,
        'Rebate Off-Invoice (Rp)': p.landedCost?.rebatePerUnit || 0,
        'AVG HPP dari PO (Rp)': avg?.avgCost ?? '-',
        'Selisih AVG vs HPP (Rp)': avg ? avg.avgCost - p.costPrice : '-',
        'Total Unit PO': avg?.totalQty ?? '-',
        'Jumlah PO': avg?.poCount ?? '-',
        'Harga Ecer (Jual)': p.priceEcer,
        'Margin (Rp)': p.marginRp,
        'Margin (%)': `${p.marginPct.toFixed(1)}%`,
        'Harga Grosir': p.priceGrosir,
        'Min Grosir': p.minGrosir,
        'Nilai Persediaan Modal': p.inventoryValue,
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'HPP_dan_Harga_Produk');
    XLSX.writeFile(wb, `Struktur_HPP_Harga_${new Date().toISOString().split('T')[0]}.xlsx`);
    notify.success('Data HPP & Harga berhasil diekspor ke Excel!');
  };

  const selectedCount = selectedIds.size;
  const selectedPriceReviewProducts = products.filter((product) =>
    selectedIds.has(product.id) && (priceReviewByProduct.get(product.id)?.length || 0) > 0
  );
  const selectedPriceReviewUnitCount = selectedPriceReviewProducts.reduce(
    (total, product) => total + (priceReviewByProduct.get(product.id)?.length || 0),
    0,
  );

  return (
    <div className="p-4 md:p-8 bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 bg-white p-5 md:p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Link href="/admin/products" className="text-slate-400 hover:text-slate-800 transition-colors p-1.5 hover:bg-slate-100 rounded-xl shrink-0">
                <ArrowLeft size={18} />
              </Link>
              <span className="text-xs font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full whitespace-nowrap">
                Katalog & Keuangan
              </span>
            </div>
            <h1 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2 md:gap-3 leading-tight">
              <DollarSign className="text-emerald-600 shrink-0" size={22} />
              <span>Struktur HPP, Harga & Margin</span>
            </h1>
            <p className="text-xs md:text-sm text-slate-400 font-bold mt-1 leading-relaxed">
              Pantau HPP aktif vs AVG dari riwayat PO, harga jual, persentase keuntungan, dan riwayat fluktuasi harga.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={() => { fetchData(); fetchAvgHpp(); }}
              disabled={loading}
              className="p-2.5 md:p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl border border-slate-200 text-xs font-black transition-all flex items-center gap-2"
              title="Refresh Data"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <Link
              href="/admin/tax-calculator"
              className="px-3 md:px-4 py-2.5 md:py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[11px] md:text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 md:gap-2 shadow-sm shadow-indigo-200"
            >
              <Calculator size={15} />
              <span className="hidden sm:inline">Kalkulator Pajak</span>
              <span className="sm:hidden">Pajak</span>
            </Link>
            <button
              onClick={handleExportExcel}
              disabled={filteredProducts.length === 0}
              className="px-3 md:px-4 py-2.5 md:py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-[11px] md:text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 md:gap-2 shadow-sm shadow-emerald-200 disabled:opacity-50"
            >
              <Download size={15} />
              <span className="hidden sm:inline">Export Excel</span>
              <span className="sm:hidden">Excel</span>
            </button>
          </div>
        </div>

        {/* METRICS CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white p-4 md:p-5 rounded-3xl border border-slate-100 shadow-sm space-y-1.5 md:space-y-2">
            <div className="flex items-center justify-between text-blue-600">
              <span className="text-[10px] md:text-xs font-black uppercase tracking-wider text-slate-400 leading-tight">Produk Aktif</span>
              <div className="p-1.5 md:p-2 bg-blue-50 rounded-xl shrink-0"><Package size={16} /></div>
            </div>
            <p className="text-2xl md:text-3xl font-black text-slate-900">{kpis.activeCount}</p>
            <p className="text-[10px] md:text-xs font-bold text-slate-400">
              <span className="text-amber-600 font-extrabold">{kpis.kviCount} KVI Sembako</span> · <span className="text-purple-600 font-extrabold">{kpis.wholesaleCount} Grosir</span>
            </p>
          </div>

          <div className="bg-white p-4 md:p-5 rounded-3xl border border-slate-100 shadow-sm space-y-1.5 md:space-y-2">
            <div className="flex items-center justify-between text-indigo-600">
              <span className="text-[10px] md:text-xs font-black uppercase tracking-wider text-slate-400 leading-tight">Status Pajak</span>
              <div className="p-1.5 md:p-2 bg-indigo-50 rounded-xl shrink-0"><Receipt size={16} /></div>
            </div>
            <p className="text-2xl md:text-3xl font-black text-indigo-700">{kpis.taxableCount}</p>
            <p className="text-[10px] md:text-xs font-bold text-slate-400">
              <span className="text-indigo-600 font-extrabold">{kpis.taxableCount} PPN</span> · <span className="text-emerald-600 font-extrabold">{kpis.exemptCount} Bebas</span>
            </p>
          </div>

          <div className="bg-white p-4 md:p-5 rounded-3xl border border-slate-100 shadow-sm space-y-1.5 md:space-y-2">
            <div className="flex items-center justify-between text-indigo-600">
              <span className="text-[10px] md:text-xs font-black uppercase tracking-wider text-slate-400 leading-tight">Rata-rata Margin</span>
              <div className="p-1.5 md:p-2 bg-indigo-50 rounded-xl shrink-0"><Percent size={16} /></div>
            </div>
            <p className={`text-2xl md:text-3xl font-black ${kpis.avgMarginPct >= 15 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {kpis.avgMarginPct.toFixed(1)}%
            </p>
            <p className="text-[10px] md:text-xs font-bold text-slate-400">Rata-rata laba kotor</p>
          </div>

          <div className="bg-white p-4 md:p-5 rounded-3xl border border-slate-100 shadow-sm space-y-1.5 md:space-y-2">
            <div className="flex items-center justify-between text-rose-600">
              <span className="text-[10px] md:text-xs font-black uppercase tracking-wider text-slate-400 leading-tight">Total Modal</span>
              <div className="p-1.5 md:p-2 bg-rose-50 rounded-xl shrink-0"><Layers size={16} /></div>
            </div>
            <p className="text-sm md:text-base lg:text-lg font-black text-slate-900 leading-tight">
              Rp {kpis.totalStockValue.toLocaleString('id-ID')}
            </p>
            <p className="text-[10px] md:text-xs font-bold text-slate-400">Nilai aset stok aktif</p>
          </div>

          <div className="bg-white p-4 md:p-5 rounded-3xl border border-slate-100 shadow-sm space-y-1.5 md:space-y-2">
            <div className="flex items-center justify-between text-emerald-600">
              <span className="text-[10px] md:text-xs font-black uppercase tracking-wider text-slate-400 leading-tight">Potensi Laba</span>
              <div className="p-1.5 md:p-2 bg-emerald-50 rounded-xl shrink-0"><TrendingUp size={16} /></div>
            </div>
            <p className="text-sm md:text-base lg:text-lg font-black text-emerald-600 leading-tight">
              +Rp {kpis.totalPotentialProfit.toLocaleString('id-ID')}
            </p>
            <p className="text-[10px] md:text-xs font-bold text-slate-400">Estimasi profit jika laku</p>
          </div>

          <div className={`p-4 md:p-5 rounded-3xl border shadow-sm space-y-1.5 md:space-y-2 ${kpis.avgDriftCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100'}`}>
            <div className={`flex items-center justify-between ${kpis.avgDriftCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              <span className="text-[10px] md:text-xs font-black uppercase tracking-wider text-slate-400 leading-tight">Selisih PO</span>
              <div className={`p-1.5 md:p-2 rounded-xl shrink-0 ${kpis.avgDriftCount > 0 ? 'bg-amber-100' : 'bg-emerald-50'}`}>
                <AlertTriangle size={16} />
              </div>
            </div>
            <p className={`text-2xl md:text-3xl font-black ${kpis.avgDriftCount > 0 ? 'text-amber-700' : 'text-emerald-600'}`}>
              {avgLoading ? '...' : kpis.avgDriftCount}
            </p>
            <p className="text-[10px] md:text-xs font-bold text-slate-400">HPP ≠ PO Terakhir</p>
          </div>
        </div>

        {/* TABS SELECTOR */}
        <div className="flex items-center gap-3 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`pb-3 px-2 text-xs md:text-sm font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'catalog'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <DollarSign size={16} />
            Katalog HPP & Margin ({filteredProducts.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 px-2 text-xs md:text-sm font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <History size={16} />
            Riwayat Perubahan Harga ({costLogs.length})
          </button>
        </div>

        {/* TAB 1: KATALOG HARGA & MARGIN */}
        {activeTab === 'catalog' && (
          <div className="space-y-4">

            {/* FILTERS TOOLBAR */}
            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-3">
              {/* Search bar - full width */}
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama barang, SKU, atau barcode..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                />
              </div>

              {/* Filter selects - grid 2 cols on mobile, flex wrap on md+ */}
              <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 md:gap-2.5">
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-auto truncate"
                >
                  <option value="ALL">Semua Kategori</option>
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={e => {
                    setStatusFilter(e.target.value as any);
                    setSelectedIds(new Set());
                  }}
                  className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full md:w-auto"
                >
                  <option value="ACTIVE">✅ Produk Aktif ({products.filter(p => p.isActive).length})</option>
                  <option value="ARCHIVED">📁 Arsip / Nonaktif ({products.filter(p => !p.isActive).length})</option>
                  <option value="ALL">Semua Status ({products.length})</option>
                </select>

                <select
                  value={variantFilter}
                  onChange={e => {
                    setVariantFilter(e.target.value as any);
                    setSelectedIds(new Set());
                  }}
                  className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 w-full md:w-auto"
                >
                  <option value="ALL">Semua Varian</option>
                  <option value="VARIANTS">🔀 Varian ({products.filter(p => p.isVariant).length})</option>
                  <option value="PARENTS">📦 Induk ({products.filter(p => p.isParent).length})</option>
                  <option value="REGULAR">🏷️ Mandiri ({products.filter(p => !p.isVariant && !p.isParent).length})</option>
                </select>

                <select
                  value={marginFilter}
                  onChange={e => {
                    setMarginFilter(e.target.value as typeof marginFilter);
                    setSelectedIds(new Set());
                  }}
                  className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-auto"
                >
                  <option value="ALL">Semua Margin</option>
                  <option value="HEALTHY">🟢 Sehat (≥ 20%)</option>
                  <option value="SLIM">🟡 Sedang (8-19%)</option>
                  <option value="CRITICAL">🟠 Tipis (1-7%)</option>
                  <option value="NEGATIVE">🔴 Rugi (≤ 0%)</option>
                  <option value="NEEDS_REVIEW">🔴 Di bawah modal ({productsNeedingPriceReview})</option>
                </select>

                <select
                  value={taxFilter}
                  onChange={e => {
                    setTaxFilter(e.target.value as any);
                    setSelectedIds(new Set());
                  }}
                  className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full md:w-auto"
                >
                  <option value="ALL">Semua Pajak</option>
                  <option value="TAXABLE">📋 PPN 11% ({kpis.taxableCount})</option>
                  <option value="EXEMPT">🟢 Bebas PPN ({kpis.exemptCount})</option>
                  <option value="PPH22">🏗️ PPh 22 ({kpis.pph22Count})</option>
                </select>

                <select
                  value={kviFilter}
                  onChange={e => {
                    setKviFilter(e.target.value as any);
                    setSelectedIds(new Set());
                  }}
                  className="bg-amber-50/80 border border-amber-200 rounded-2xl px-3 py-2 text-xs font-bold text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500 w-full md:w-auto"
                >
                  <option value="ALL">Semua Produk ({products.length})</option>
                  <option value="KVI">🌾 KVI · Sembako Pokok ({kpis.kviCount})</option>
                  <option value="REGULAR">🏷️ Produk Reguler ({products.length - kpis.kviCount})</option>
                </select>

                 <select
                  value={newProductFilter}
                  onChange={e => { setNewProductFilter(e.target.value as any); setSelectedIds(new Set()); }}
                  className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 w-full md:w-auto"
                >
                  <option value="ALL">Semua (PO Status)</option>
                  <option value="HAS_PO">📦 Sudah PO</option>
                  <option value="NO_PO">🆕 Belum PO</option>
                  <option value="NEW">⭐ Produk Baru (30hr)</option>
                </select>

                 <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 col-span-2 w-full md:w-auto"
                >
                  <option value="urgent_first">🔥 Prioritas: Di Bawah Modal & PO Terbaru</option>
                  <option value="po_latest">📦 Tanggal PO Terakhir (HPP Terbaru)</option>
                  <option value="name">Urut: Nama (A-Z)</option>
                  <option value="marginPct_desc">Urut: Margin Tertinggi (%)</option>
                  <option value="marginPct_asc">Urut: Margin Terendah (%)</option>
                  <option value="cost_desc">Urut: Modal Terbesar (HPP)</option>
                  <option value="price_desc">Urut: Harga Jual Termahal</option>
                  <option value="stock_desc">Urut: Stok Terbanyak</option>
                  <option value="avg_diff">Urut: Selisih AVG Terbesar</option>
                </select>
              </div>

              {/* Mode Tampilan Analisis: Satuan Dasar (Ecer) vs Satuan Grosir (Dus/Karton) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl w-fit">
                  <button
                    type="button"
                    onClick={() => setTableViewMode('BASE')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                      tableViewMode === 'BASE'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Package size={13} />
                    <span>Satuan Dasar / Ecer (Pcs/Kg)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTableViewMode('GROSIR')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                      tableViewMode === 'GROSIR'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Layers size={13} />
                    <span>Satuan Grosir / Partai (Dus/Karung/Bal)</span>
                  </button>
                </div>
                <div className="text-[11px] font-bold text-slate-400">
                  {tableViewMode === 'GROSIR' ? (
                    <span className="text-purple-700 font-extrabold flex items-center gap-1">
                      <ShieldCheck size={13} className="text-purple-600" />
                      Mode Analisis Partai: Pantau HPP Dus & Proteksi Safety Floor Margin
                    </span>
                  ) : (
                    <span>Menampilkan HPP per satuan terkecil dasar (Pcs/Kg)</span>
                  )}
                </div>
              </div>
            </div>

            {/* BULK ACTION BAR */}
            {selectedCount > 0 && (
              <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-4 rounded-3xl shadow-lg shadow-blue-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-in slide-in-from-top-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-2xl">
                    <CheckSquare size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white">
                      {selectedCount} produk dipilih
                    </p>
                    <p className="text-xs text-blue-100 font-bold">
                      {selectedWithAvg.length} memiliki data AVG PO
                      {selectedWithoutAvg.length > 0 && ` · ${selectedWithoutAvg.length} tanpa PO`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5"
                  >
                    <X size={13} />
                    Batal
                  </button>
                  <button
                    onClick={handleResetAvgHpp}
                    disabled={selectedWithAvg.length === 0}
                    className="px-3.5 py-2 bg-white text-blue-700 hover:bg-blue-50 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Terapkan harga beli PO terakhir menjadi HPP aktif produk"
                  >
                    <RotateCcw size={13} />
                    Terapkan PO Terakhir ({selectedWithAvg.length})
                  </button>
                  <button
                    onClick={() => setShowSyncAvgModal(true)}
                    className="px-3.5 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm border border-indigo-400"
                    title="Jadikan HPP Aktif saat ini sebagai baseline saldo awal AVG PO untuk memulai perhitungan Moving Average yang bersih"
                  >
                    <Sparkles size={13} />
                    Set AVG PO = HPP ({selectedCount})
                  </button>
                  <button
                    onClick={() => setShowResetStockModal(true)}
                    className="px-3.5 py-2 bg-violet-500 hover:bg-violet-400 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm border border-violet-400"
                    title="Hapus riwayat PO lama & mulai AVG baru dari stok terkini — cocok untuk produk yang pernah habis"
                  >
                    <RefreshCw size={13} />
                    Reset AVG dari Stok Kini ({selectedCount})
                  </button>
                  <button
                    onClick={handleSetTargetMargin}
                    className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm border border-emerald-400"
                  >
                    <TrendingUp size={13} />
                    {marginFilter === 'NEEDS_REVIEW' ? 'Terapkan Rekomendasi' : 'Set Margin'}
                  </button>
                  <button
                    onClick={handleSetDivideHpp}
                    className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm border border-amber-400"
                  >
                    <Split size={13} />
                    Bagi HPP
                  </button>
                  <button
                    onClick={() => handleBulkLock(true)}
                    className="px-3 py-2 bg-slate-900/40 hover:bg-slate-900/60 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border border-white/20"
                    title="Kunci HPP agar aman dan tidak tertimpa saat Restart AVG"
                  >
                    <Lock size={12} />
                    Kunci HPP
                  </button>
                  <button
                    onClick={() => handleBulkLock(false)}
                    className="px-3 py-2 bg-slate-900/20 hover:bg-slate-900/40 text-white/90 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border border-white/10"
                    title="Buka kunci HPP agar dapat mengikuti AVG PO kembali"
                  >
                    <Unlock size={12} />
                    Buka Kunci
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowWholesaleModal(true)}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border border-emerald-500/50"
                    title="Atur harga grosir massal untuk produk yang dipilih"
                  >
                    <Tag size={12} />
                    Set Grosir
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkToggleKvi(true)}
                    className="px-3 py-2 bg-amber-500/40 hover:bg-amber-500/60 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border border-amber-300/40"
                    title="Tandai produk terpilih sebagai KVI Sembako Pokok (Margin tipis volume tinggi wajar)"
                  >
                    <Sparkles size={12} className="text-amber-200" />
                    Tandai KVI ({selectedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkToggleKvi(false)}
                    className="px-2.5 py-2 bg-white/10 hover:bg-white/20 text-white/80 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border border-white/10"
                    title="Hapus tanda KVI menjadi produk reguler"
                  >
                    Bukan KVI
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTierModal(true)}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border border-purple-500/50 shadow-sm"
                    title="Hitung & atur tingkatan (tier) harga grosir bertingkat otomatis untuk produk yang dipilih"
                  >
                    <Layers size={12} />
                    Tier Grosir
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkUpdateStatus(true)}
                    className="px-3 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border border-teal-500/50 shadow-sm"
                    title="Aktifkan produk terpilih agar muncul di kasir dan toko"
                  >
                    <CheckCircle2 size={12} />
                    Aktifkan
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkUpdateStatus(false)}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border border-slate-600 shadow-sm"
                    title="Arsipkan / Sembunyikan produk terpilih dari kasir"
                  >
                    <Archive size={12} />
                    Arsipkan
                  </button>
                </div>
              </div>
            )}

            {/* TABEL PRODUK */}
            {loading ? (
              <TableSkeleton />
            ) : filteredProducts.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-3xl border border-slate-100 shadow-sm space-y-3">
                <AlertCircle size={36} className="mx-auto text-slate-300" />
                <p className="text-sm font-black text-slate-700">Tidak ada produk yang cocok dengan filter</p>
                <p className="text-xs text-slate-400">Silakan ubah kata kunci pencarian atau reset filter di atas.</p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs" style={{ minWidth: '900px' }}>
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase tracking-widest font-black">
                        {/* Checkbox Column */}
                        <th className="py-4 pl-6 pr-2 w-10">
                          <button
                            onClick={toggleSelectAll}
                            className="p-1 hover:text-blue-600 transition-colors"
                            title={allSelected ? 'Batalkan semua' : 'Pilih semua'}
                          >
                            {allSelected ? (
                              <CheckSquare size={17} className="text-blue-600" />
                            ) : someSelected ? (
                              <div className="w-[17px] h-[17px] border-2 border-blue-400 rounded-sm flex items-center justify-center">
                                <div className="w-2 h-2 bg-blue-400 rounded-sm" />
                              </div>
                            ) : (
                              <Square size={17} />
                            )}
                          </button>
                        </th>
                        <th className="py-4 px-4 min-w-[200px] max-w-[280px]">Produk &amp; SKU</th>
                        <th className="py-4 px-4 text-center min-w-[160px]">
                          {tableViewMode === 'GROSIR' ? 'Stok (Ekuivalen Dus)' : 'Stok & Satuan'}
                        </th>
                        <th className="py-4 px-4 text-right min-w-[120px]">
                          {tableViewMode === 'GROSIR' ? 'HPP Dus / Partai' : 'HPP Aktif'}
                        </th>
                        <th className="py-4 px-4 text-right min-w-[110px]">
                          <div className="flex items-center justify-end gap-1">
                            <Sparkles size={12} className="text-amber-500" />
                            {tableViewMode === 'GROSIR' ? 'AVG PO Dus' : 'AVG HPP (PO)'}
                          </div>
                        </th>
                        <th className="py-4 px-4 text-right min-w-[110px]">
                          {tableViewMode === 'GROSIR' ? 'Harga Jual Dus' : 'Harga Jual'}
                        </th>
                        <th className="py-4 px-4 text-right min-w-[140px]">
                          {tableViewMode === 'GROSIR' ? 'Margin Dus (Rp / %)' : 'Margin (Rp / %)'}
                        </th>
                        <th className="py-4 px-4 text-center min-w-[110px]">
                          {tableViewMode === 'GROSIR' ? 'Safety Floor' : 'Grosir'}
                        </th>
                        <th className="py-4 px-5 text-center min-w-[90px]">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {paginatedProducts.map(p => {
                        const isHealthy = p.isKvi ? p.marginPct >= 2 : p.marginPct >= 20;
                        const isSlim = p.isKvi ? (p.marginPct >= 1 && p.marginPct < 2) : (p.marginPct >= 8 && p.marginPct < 20);
                        const isLoss = p.marginPct <= 0;
                        const isKviComfort = p.isKvi && p.marginPct >= 1.5 && p.marginPct < 8;

                        const avg = avgHppMap[p.id];
                        const avgDiff = avg ? avg.avgCost - p.costPrice : null;
                        const hasDrift = avg && avg.avgCost > 0 && Math.abs(avgDiff!) > 100;
                        const isSelected = selectedIds.has(p.id);
                        const priceReview = priceReviewByProduct.get(p.id) || [];
                        const reviewByUnit = new Map(priceReview.map((finding) => [finding.unitCode, finding]));
                        const otherUnitCosts = p.units
                          .filter((unit) =>
                            unit.code !== p.unit &&
                            Number.isFinite(unit.contains) &&
                            unit.contains > 1
                          )
                          .sort((a, b) => a.contains - b.contains);

                        // Perhitungan Analisis Mode Satuan Grosir / Kartonan
                        const bulkUnit = p.units
                          .filter((unit) => unit.code !== p.unit && Number.isFinite(unit.contains) && unit.contains > 1)
                          .sort((a, b) => b.contains - a.contains)[0];

                        const bulkContains = bulkUnit ? bulkUnit.contains : 1;
                        const bulkCode = bulkUnit ? bulkUnit.code : p.unit;
                        const bulkCost = p.costPrice * bulkContains;
                        const bulkPrice = bulkUnit && bulkUnit.price ? bulkUnit.price : (p.priceEcer * bulkContains);
                        const bulkMarginRp = bulkPrice - bulkCost;
                        const bulkMarginPct = bulkPrice > 0 ? (bulkMarginRp / bulkPrice) * 100 : 0;
                        const bulkStock = bulkUnit ? Math.floor(p.stock / bulkContains) : p.stock;
                        const bulkStockSisa = bulkUnit ? (p.stock % bulkContains) : 0;
                        const bulkAvgCost = avg && avg.avgCost > 0 ? avg.avgCost * bulkContains : 0;
                        const isBulkLoss = bulkMarginRp <= 0;
                        const isBulkSlim = bulkMarginPct > 0 && bulkMarginPct < (p.isKvi ? 1.5 : 5);

                        return (
                          <tr
                            key={p.id}
                            className={`hover:bg-slate-50/60 transition-colors group ${isSelected ? 'bg-blue-50/40' : ''}`}
                          >
                            {/* Checkbox */}
                            <td className="py-2 pl-6 pr-2">
                              <button
                                onClick={() => toggleSelectOne(p.id)}
                                className="p-1 hover:text-blue-600 transition-colors"
                              >
                                {isSelected
                                  ? <CheckSquare size={17} className="text-blue-600" />
                                  : <Square size={17} className="text-slate-300 group-hover:text-slate-400" />
                                }
                              </button>
                            </td>

                            {/* Produk Info */}
                            <td className="py-2 px-4 max-w-[280px]">
                              <div className="space-y-1">
                                <div className="flex items-start gap-1.5 flex-wrap">
                                  <Link
                                    href={`/admin/products/edit/${p.id}`}
                                    className="font-black text-slate-900 hover:text-blue-600 transition-colors line-clamp-2 leading-snug break-words min-w-0"
                                  >
                                    {formatProductName(p.name)}
                                  </Link>
                                  {p.isKvi && (
                                    <span 
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-black bg-amber-100 text-amber-900 border border-amber-300 shrink-0"
                                      title="Known Value Item (Sembako Pokok): Produk tolak ukur pasar ber-margin tipis wajar"
                                    >
                                      🌾 KVI
                                    </span>
                                  )}
                                  {p.shrinkagePct && p.shrinkagePct > 0 ? (
                                    <span 
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-black bg-orange-50 text-orange-700 border border-orange-200 shrink-0"
                                      title={`Cadangan Susut Timbang / Ceceran: ${p.shrinkagePct}%`}
                                    >
                                      ⚖️ {p.shrinkagePct}%
                                    </span>
                                  ) : null}
                                  {p.isVariant && (
                                    <span 
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-black bg-purple-100 text-purple-700 shrink-0"
                                      title={p.parentName ? `Varian turunan dari induk: ${p.parentName}` : 'Produk varian'}
                                    >
                                      <Layers size={9} /> Varian
                                    </span>
                                  )}
                                  {p.isParent && (
                                    <span 
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-black bg-indigo-100 text-indigo-700 shrink-0"
                                      title="Produk Induk yang memiliki varian"
                                    >
                                      <Package size={9} /> Induk
                                    </span>
                                  )}
                                  {p.isHppLocked && (
                                    <span
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-blue-100 text-blue-700 shrink-0"
                                      title="HPP produk ini dikunci/diset manual (aman dari Restart AVG)"
                                    >
                                      <Lock size={10} />
                                    </span>
                                  )}
                                  {!p.isActive && (
                                    <span
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-black bg-rose-100 text-rose-700 shrink-0"
                                      title="Produk nonaktif / diarsipkan"
                                    >
                                      Nonaktif
                                    </span>
                                  )}
                                </div>

                                {priceReview.length > 0 && (
                                  <div className="pt-0.5">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEdit(p)}
                                      className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50 hover:bg-rose-100 px-2.5 py-0.5 text-[9px] font-black text-rose-700 shadow-2xs transition-all cursor-pointer group"
                                      title={`Klik untuk sesuaikan satuan: ${priceReview.map((finding) => `${finding.unitCode}: Rp${finding.currentPrice.toLocaleString('id-ID')} → target Rp${finding.recommendedPrice.toLocaleString('id-ID')}`).join(' · ')}`}
                                    >
                                      <AlertTriangle size={10} className="text-rose-600 animate-pulse shrink-0" />
                                      <span>Di bawah modal: <strong className="underline underline-offset-2">{priceReview.map(f => f.unitCode).join(', ')}</strong></span>
                                    </button>
                                  </div>
                                )}
                                <div className="flex flex-wrap items-center gap-1.5 text-slate-400 font-mono text-[10px] mt-0.5">
                                  <span>SKU: {p.sku}</span>
                                  {p.barcode && <span>• {p.barcode}</span>}
                                  <span className="bg-slate-100 px-1.5 py-0.5 rounded font-sans text-slate-600 font-bold">{p.category}</span>
                                  
                                  {/* TAX STATUS BADGES */}
                                  {p.taxStatus === 'TAXABLE' && (
                                    <span
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200"
                                      title="Produk Tercentang Wajib Pajak: Barang Kena Pajak (BKP) tarif PPN 11%"
                                    >
                                      <CheckCircle2 size={9} className="text-indigo-600" />
                                      Wajib PPN 11%
                                    </span>
                                  )}
                                  {p.taxStatus === 'EXEMPT' && (
                                    <span
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      title="Bebas Pajak: Kebutuhan Pokok / Strategis Fasilitas 0% UU HPP"
                                    >
                                      <ShieldCheck size={9} className="text-emerald-600" />
                                      Bebas PPN (0%)
                                    </span>
                                  )}
                                  {p.taxStatus === 'PPH22' && (
                                    <span
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-black bg-amber-50 text-amber-800 border border-amber-200"
                                      title="Kategori Industri: Kena PPh Pasal 22 Pabrik"
                                    >
                                      <Building2 size={9} className="text-amber-600" />
                                      PPh 22
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Stok & Semua Satuan Produk yang Diset */}
                            <td className="py-2 px-4 text-center">
                              {tableViewMode === 'GROSIR' ? (
                                <div className="space-y-0.5">
                                  <div className="flex items-center justify-center gap-1">
                                    <span className="font-black text-slate-800 text-sm">{bulkStock.toLocaleString('id-ID')}</span>
                                    <span className="text-[10px] text-slate-600 font-bold uppercase">{bulkCode}</span>
                                  </div>
                                  {bulkUnit && bulkStockSisa > 0 && (
                                    <span className="text-[9px] text-slate-400 font-medium block">
                                      + {bulkStockSisa} {p.unit}
                                    </span>
                                  )}
                                  {bulkUnit && (
                                    <span className="text-[9px] font-bold text-indigo-600 block">
                                      (1 {bulkCode} = {bulkContains} {p.unit})
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center justify-center gap-1">
                                    <span className="font-black text-slate-800 text-sm">{p.stock}</span>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase">{p.unit}</span>
                                  </div>

                                  {/* Daftar semua satuan yang telah diset */}
                                  <div className="flex flex-wrap gap-1 mt-0.5 justify-center">
                                    {p.units.map(u => {
                                      const isBase = u.code === p.unit;
                                      const review = reviewByUnit.get(u.code);
                                      return (
                                        <span
                                          key={u.code}
                                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[9px] font-black ${
                                            review
                                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                              : isBase
                                              ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                          }`}
                                          title={review
                                            ? `${u.code}: harga Rp${review.currentPrice.toLocaleString('id-ID')} di bawah target Rp${review.recommendedPrice.toLocaleString('id-ID')}`
                                            : `${u.code} (isi ${u.contains} ${p.unit}) · Harga Jual: Rp ${(u.price || 0).toLocaleString('id-ID')}`}
                                        >
                                          <span>{u.code}{u.contains > 1 ? `×${u.contains}` : ''}</span>
                                          <span className="text-slate-300">|</span>
                                          <span className="text-blue-700 font-black">
                                            Rp{(u.price || 0).toLocaleString('id-ID')}
                                          </span>
                                        </span>
                                      );
                                    })}
                                  </div>
                                </>
                              )}
                            </td>

                            {/* Modal HPP Aktif & Lock Status */}
                            <td className="py-2 px-4 text-right">
                              {tableViewMode === 'GROSIR' ? (
                                <div className="space-y-0.5">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {p.isHppLocked && (
                                      <span
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-blue-50 text-blue-700 border border-blue-200 shrink-0"
                                        title="HPP diset manual & terkunci"
                                      >
                                        <Lock size={9} />
                                      </span>
                                    )}
                                    <div className="flex items-baseline gap-1">
                                      <span className="font-black text-slate-900 text-sm">
                                        Rp {bulkCost.toLocaleString('id-ID')}
                                      </span>
                                      <span className="text-[10px] text-slate-400 font-bold">/{bulkCode}</span>
                                    </div>
                                  </div>
                                  {bulkUnit && (
                                    <p className="text-[9px] text-slate-400 font-medium">
                                      @Rp {p.costPrice.toLocaleString('id-ID')}/{p.unit}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center justify-end gap-1.5">
                                    {p.isHppLocked && (
                                      <span
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-blue-50 text-blue-700 border border-blue-200 shrink-0"
                                        title="HPP diset manual & terkunci. Tidak akan hilang saat Restart AVG"
                                      >
                                        <Lock size={9} />
                                        Terkunci
                                      </span>
                                    )}
                                    <div className="flex items-baseline gap-1">
                                      <span className="font-black text-slate-900 text-sm">
                                        Rp {p.costPrice.toLocaleString('id-ID')}
                                      </span>
                                      <span className="text-[10px] text-slate-400 font-bold">/{p.unit}</span>
                                    </div>
                                  </div>

                                  {otherUnitCosts.length > 0 && (
                                    <div className="flex flex-wrap gap-0.5 mt-0.5 justify-end" title={otherUnitCosts.map(u => `${u.code}: Rp${(p.costPrice * u.contains).toLocaleString('id-ID')}`).join(' | ')}>
                                      {otherUnitCosts.map((unit) => (
                                        <span key={unit.code} className="text-[9px] font-black text-slate-400 bg-slate-50 border border-slate-200 px-1 py-0.5 rounded">
                                          {unit.code}·{Math.round(p.costPrice * unit.contains / 1000)}k
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </>
                              )}
                            </td>

                            {/* AVG HPP dari PO */}
                            <td className="py-2 px-4 text-right">
                              {tableViewMode === 'GROSIR' ? (
                                avg && bulkAvgCost > 0 ? (
                                  <div>
                                    <p className={`font-black ${hasDrift ? 'text-amber-700' : 'text-emerald-700'}`}>
                                      Rp {bulkAvgCost.toLocaleString('id-ID')}
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-bold">
                                      /{bulkCode} · {avg.poCount} PO
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-slate-300 font-bold text-[11px] block">Belum ada PO</span>
                                )
                              ) : avgLoading ? (
                                <div className="h-4 w-20 bg-slate-100 rounded animate-pulse ml-auto" />
                              ) : avg && avg.avgCost > 0 ? (
                                <div>
                                  <p className={`font-black ${hasDrift ? 'text-amber-700' : 'text-emerald-700'}`}>
                                    Rp {avg.avgCost.toLocaleString('id-ID')}
                                  </p>
                                  <p className="text-[10px] text-slate-400 font-bold">
                                    {avg.poCount} PO · {avg.totalQty.toLocaleString()} {p.unit}
                                  </p>
                                  {hasDrift && (
                                    <div className="flex items-center justify-end gap-1 mt-0.5">
                                      <span className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                                        avgDiff! > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                                      }`}>
                                        {avgDiff! > 0 ? '+' : ''}{avgDiff!.toLocaleString('id-ID')}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleConfirmSyncAvgPo([p.id])}
                                        className="p-0.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                        title="Samakan AVG PO dengan HPP Aktif saat ini"
                                      >
                                        <Sparkles size={11} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <span className="text-slate-300 font-bold text-[11px] block">Belum ada PO</span>
                                  {p.costPrice > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => handleConfirmSyncAvgPo([p.id])}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[9px] font-black bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                                      title="Set AVG PO = Nilai HPP aktif ini sebagai saldo awal baseline moving average"
                                    >
                                      <Sparkles size={9} />
                                      Set Awal AVG
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Harga Jual */}
                            <td className="py-2 px-4 text-right font-black text-blue-700">
                              {tableViewMode === 'GROSIR' ? (
                                <div>
                                  <p className="text-sm">Rp {bulkPrice.toLocaleString('id-ID')}</p>
                                  <p className="text-[10px] text-slate-400 font-bold">/{bulkCode}</p>
                                  {bulkUnit && (
                                    <p className="text-[9px] text-slate-400 font-medium">
                                      @Rp {Math.round(bulkPrice / bulkContains).toLocaleString('id-ID')}/{p.unit}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <>
                                  <p className="text-sm">Rp {p.priceEcer.toLocaleString('id-ID')}</p>
                                  <p className="text-[10px] text-slate-400 font-bold">/{p.unit}</p>
                                </>
                              )}
                            </td>

                            {/* Margin Keuntungan */}
                            <td className="py-2 px-4 text-right">
                              {tableViewMode === 'GROSIR' ? (
                                <div className="flex flex-col items-end">
                                  <div className="flex items-baseline gap-1">
                                    <span className={`font-black ${isBulkLoss ? 'text-rose-600' : isBulkSlim ? 'text-amber-600' : 'text-emerald-600'}`}>
                                      {bulkMarginRp >= 0 ? '+' : ''}Rp {bulkMarginRp.toLocaleString('id-ID')}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-bold">/{bulkCode}</span>
                                  </div>
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                    isBulkLoss ? 'bg-rose-50 text-rose-600' : isBulkSlim ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                                  }`}>
                                    {bulkMarginPct.toFixed(1)}%
                                  </span>
                                  {p.isKvi && bulkMarginPct >= 1 && (
                                    <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-amber-800 bg-amber-50 px-1 py-0.5 rounded border border-amber-200 mt-0.5">
                                      🌾 Margin Sembako
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="flex flex-col items-end">
                                  <div className="flex items-baseline gap-1">
                                    <span className={`font-black ${isLoss ? 'text-rose-600' : isSlim ? 'text-amber-600' : 'text-emerald-600'}`}>
                                      {p.marginRp >= 0 ? '+' : ''}Rp {p.marginRp.toLocaleString('id-ID')}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-bold">/{p.unit}</span>
                                  </div>
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                    isLoss ? 'bg-rose-50 text-rose-600' : isSlim ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                                  }`}>
                                    {p.marginPct.toFixed(1)}%
                                  </span>
                                  {isKviComfort && (
                                    <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-amber-800 bg-amber-50 px-1 py-0.5 rounded border border-amber-200 mt-0.5">
                                      🌾 Sehat (Vol)
                                    </span>
                                  )}
                                  {p.taxStatus === 'TAXABLE' && p.marginPct < 11 && p.marginPct > 0 && (
                                    <span
                                      className="inline-flex items-center gap-0.5 text-[8px] font-bold text-rose-700 bg-rose-50 px-1 py-0.5 rounded border border-rose-200 mt-1"
                                      title="Peringatan Boncos: Produk Wajib Pajak ini memiliki margin kotor di bawah 11% (terancam tergerus PPN)!"
                                    >
                                      <AlertTriangle size={8} /> Margin &lt; PPN 11%
                                    </span>
                                  )}

                                  {/* Margin Satuan Lainnya - compact chips */}
                                  {otherUnitCosts.length > 0 && (
                                    <div className="flex flex-wrap gap-0.5 mt-0.5 justify-end">
                                      {otherUnitCosts.map((unit) => {
                                        const unitCost = p.costPrice * (unit.contains || 1);
                                        const unitPrice = Number(unit.price || 0);
                                        const unitMarginPct = unitPrice > 0 ? ((unitPrice - unitCost) / unitPrice) * 100 : 0;
                                        const isUnitLoss = unitMarginPct <= 0;
                                        const isUnitSlim = unitMarginPct > 0 && unitMarginPct < 8;
                                        return (
                                          <span
                                            key={unit.code}
                                            className={`text-[9px] font-black px-1 py-0.5 rounded ${isUnitLoss ? 'bg-rose-50 text-rose-600' : isUnitSlim ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}
                                            title={`${unit.code}: margin ${unitMarginPct.toFixed(1)}% | Harga Rp${unitPrice.toLocaleString('id-ID')} - Modal Rp${unitCost.toLocaleString('id-ID')}`}
                                          >
                                            {unit.code} {unitMarginPct.toFixed(0)}%
                                          </span>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Harga Grosir / Safety Floor */}
                            <td className="py-2 px-4 text-right">
                              {tableViewMode === 'GROSIR' ? (
                                <div className="flex justify-end">
                                  {isBulkLoss ? (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                      <AlertTriangle size={9} /> Di Bawah Modal
                                    </span>
                                  ) : bulkMarginPct < 1 ? (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                      ⚠️ Tipis (&lt;1%)
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                      🛡️ Floor Aman
                                    </span>
                                  )}
                                </div>
                              ) : p.priceTiers && p.priceTiers.length > 1 ? (
                                <div className="flex flex-col items-end gap-0.5" title={p.priceTiers.map(t => `${t.label || `Min ${t.minQty}`}: Rp${t.price.toLocaleString('id-ID')}`).join('\n')}>
                                  {p.priceTiers.filter(t => t.minQty > 1).map((t, idx) => (
                                    <span key={idx} className="inline-flex items-center gap-1 text-[9px] font-black text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                                      <span className="text-purple-400">≥{t.minQty}</span>
                                      <span>Rp{t.price.toLocaleString('id-ID')}</span>
                                    </span>
                                  ))}
                                </div>
                              ) : p.priceGrosir > 0 ? (
                                <div>
                                  <p className="font-black text-purple-700">Rp {p.priceGrosir.toLocaleString('id-ID')}</p>
                                  <p className="text-[10px] text-slate-400 font-bold">Min: {p.minGrosir} {p.unit}</p>
                                </div>
                              ) : (
                                <span className="text-slate-300 font-bold">-</span>
                              )}
                            </td>

                            {/* Aksi */}
                            <td className="py-2 px-5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleOpenEdit(p)}
                                  className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-black text-xs transition-colors flex items-center gap-1 whitespace-nowrap"
                                  title="Ubah HPP, harga ecer, dan semua satuan produk"
                                >
                                  <Edit3 size={12} />
                                  Ubah
                                </button>
                                <Link
                                  href={`/admin/products/edit/${p.id}`}
                                  className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-xl transition-colors"
                                  title="Edit Lengkap"
                                >
                                  <ChevronRight size={14} />
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* TABLE FOOTER */}
                <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-xs font-bold text-slate-400">
                      Menampilkan <span className="text-slate-700">{paginatedProducts.length}</span> dari <span className="text-slate-700">{filteredProducts.length}</span> produk {statusFilter === 'ACTIVE' ? 'aktif' : statusFilter === 'ARCHIVED' ? 'nonaktif / arsip' : ''} · hal. {currentPage}/{totalPages}
                    </p>
                    <select
                      value={pageSize}
                      onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                      className="text-[11px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none"
                    >
                      <option value={10}>10/hal</option>
                      <option value={25}>25/hal</option>
                      <option value={50}>50/hal</option>
                      <option value={100}>100/hal</option>
                    </select>
                  </div>
                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="px-2 py-1 rounded-lg text-[11px] font-black bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Halaman pertama"
                      >«</button>
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-2 py-1 rounded-lg text-[11px] font-black bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >‹ Prev</button>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let page: number;
                        if (totalPages <= 5) page = i + 1;
                        else if (currentPage <= 3) page = i + 1;
                        else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
                        else page = currentPage - 2 + i;
                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`w-7 h-7 rounded-lg text-[11px] font-black border transition-colors ${currentPage === page ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                          >{page}</button>
                        );
                      })}
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-2 py-1 rounded-lg text-[11px] font-black bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >Next ›</button>
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="px-2 py-1 rounded-lg text-[11px] font-black bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Halaman terakhir"
                      >»</button>
                    </div>
                  )}
                  {selectedCount > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleResetAvgHpp}
                        disabled={selectedWithAvg.length === 0}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all disabled:opacity-50"
                      >
                        <RotateCcw size={13} />
                        Terapkan PO Terakhir
                      </button>
                      <button
                        onClick={() => setShowSyncAvgModal(true)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm"
                        title="Inisialisasi Saldo Awal Baseline AVG PO = HPP Aktif"
                      >
                        <Sparkles size={13} />
                        Set AVG PO = HPP
                      </button>
                      <button
                        onClick={handleSetTargetMargin}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all"
                      >
                        <TrendingUp size={13} />
                        {marginFilter === 'NEEDS_REVIEW' ? 'Terapkan Rekomendasi' : 'Set Margin'}
                      </button>
                      <button
                        onClick={handleSetDivideHpp}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all"
                      >
                        <Split size={13} />
                        Bagi HPP
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: RIWAYAT PERUBAHAN HARGA */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6 space-y-4">
            <div>
              <h3 className="text-base font-black text-slate-900">Log Audit Perubahan Modal & Harga</h3>
              <p className="text-xs text-slate-400 font-bold">Merekam setiap kali harga modal kulakan supplier atau harga jual ecer produk disesuaikan.</p>
            </div>

            {costLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-bold text-xs bg-slate-50 rounded-2xl">
                Belum ada riwayat perubahan harga yang tercatat.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase tracking-widest font-black">
                      <th className="py-3 px-4">Waktu</th>
                      <th className="py-3 px-4">Produk</th>
                      <th className="py-3 px-4 text-right">Modal Lama &rarr; Baru</th>
                      <th className="py-3 px-4 text-right">Harga Jual Lama &rarr; Baru</th>
                      <th className="py-3 px-4">Catatan / Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {costLogs.map(l => {
                      let dateStr = '-';
                      if (l.changeDate?.seconds) {
                        dateStr = new Date(l.changeDate.seconds * 1000).toLocaleString('id-ID');
                      } else if (typeof l.changeDate === 'string') {
                        dateStr = new Date(l.changeDate).toLocaleString('id-ID');
                      }

                      const costDiff = (l.newCost !== undefined && l.oldCost !== undefined) ? l.newCost - l.oldCost : 0;
                      const priceDiff = (l.newPrice !== undefined && l.oldPrice !== undefined) ? l.newPrice - l.oldPrice : 0;

                      return (
                        <tr key={l.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">{dateStr}</td>
                          <td className="py-3.5 px-4 font-black text-slate-800">{formatProductName(l.productName || l.productId)}</td>
                          <td className="py-3.5 px-4 text-right">
                            {l.oldCost !== undefined && l.newCost !== undefined ? (
                              <div>
                                <span className="text-slate-400 line-through mr-1">Rp {l.oldCost.toLocaleString()}</span>
                                <span className="font-black text-slate-800">&rarr; Rp {l.newCost.toLocaleString()}</span>
                                <span className={`ml-2 text-[10px] font-black ${costDiff >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                  ({costDiff >= 0 ? '+' : ''}{costDiff.toLocaleString()})
                                </span>
                              </div>
                            ) : '-'}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {l.oldPrice !== undefined && l.newPrice !== undefined ? (
                              <div>
                                <span className="text-slate-400 line-through mr-1">Rp {l.oldPrice.toLocaleString()}</span>
                                <span className="font-black text-blue-700">&rarr; Rp {l.newPrice.toLocaleString()}</span>
                                <span className={`ml-2 text-[10px] font-black ${priceDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  ({priceDiff >= 0 ? '+' : ''}{priceDiff.toLocaleString()})
                                </span>
                              </div>
                            ) : '-'}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 font-bold">
                            <p>{l.notes || 'Penyesuaian manual'}</p>
                            <span className="text-[10px] text-slate-400 font-mono">By: {l.adminEmail || 'admin'}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ===================== QUICK EDIT MODAL ===================== */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  Quick Update Harga & Satuan
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1 line-clamp-1">
                  {formatProductName(editingProduct.name)}
                </h3>
                <p className="text-[11px] text-slate-400 font-mono">
                  SKU: {editingProduct.sku} · Kategori: {editingProduct.category}
                </p>
              </div>
              <button
                onClick={() => setEditingProduct(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Show AVG in modal */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Sparkles size={16} className="text-indigo-600 shrink-0" />
                <div>
                  <p className="text-xs font-black text-slate-800">
                    AVG HPP (PO):{' '}
                    <span className={avgHppMap[editingProduct.id]?.avgCost > 0 ? "text-indigo-700" : "text-slate-400"}>
                      {avgHppMap[editingProduct.id]?.avgCost > 0
                        ? `Rp ${avgHppMap[editingProduct.id].avgCost.toLocaleString('id-ID')}`
                        : 'Belum ada PO'}
                    </span>
                  </p>
                  <p className="text-[10px] text-slate-500 font-bold">
                    {avgHppMap[editingProduct.id]?.avgCost > 0
                      ? `Berdasarkan ${avgHppMap[editingProduct.id].poCount} PO · ${avgHppMap[editingProduct.id].totalQty.toLocaleString()} ${editingProduct.unit}`
                      : 'Mulai hitung Moving Average dari HPP aktif saat ini'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                {avgHppMap[editingProduct.id] && avgHppMap[editingProduct.id].avgCost > 0 && (
                  <button
                    type="button"
                    onClick={() => setEditModalCost(avgHppMap[editingProduct.id].avgCost)}
                    className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl text-[10px] font-black transition-colors"
                    title="Gunakan nilai AVG PO sebagai HPP saat ini"
                  >
                    Pakai AVG
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    handleConfirmSyncAvgPo([editingProduct.id]);
                  }}
                  className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-[10px] font-black transition-colors flex items-center gap-1"
                  title="Jadikan HPP saat ini sebagai saldo awal baseline AVG PO"
                >
                  <Sparkles size={11} />
                  Set AVG PO = HPP
                </button>
              </div>
            </div>

            {/* HPP & Proteksi Lock HPP */}
            <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase text-slate-600">
                    Harga Modal Dasar (HPP per {editingProduct.unit})
                  </label>
                  <span className="text-[10px] font-bold text-slate-400">Satuan Utama: {editingProduct.unit}</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">Rp</span>
                  <input
                    type="number"
                    min="0"
                    value={editModalCost}
                    onChange={e => setEditModalCost(Number(e.target.value))}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-2xl font-black text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Checkbox Kunci HPP */}
              <label className="flex items-center gap-2.5 p-2.5 bg-white border border-blue-200 rounded-xl cursor-pointer hover:bg-blue-50/50 transition-colors">
                <input
                  type="checkbox"
                  checked={editIsHppLocked}
                  onChange={e => setEditIsHppLocked(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <div className="text-left">
                  <span className="text-xs font-black text-blue-900 flex items-center gap-1.5">
                    <Lock size={12} className="text-blue-600" />
                    Kunci Nilai HPP Ini (Proteksi Restart AVG)
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold block">
                    Jika dicentang, HPP yang sudah Anda set TIDAK AKAN HILANG saat admin merestart AVG PO.
                  </span>
                </div>
              </label>

              {/* Parameter Akuntansi Grosir FMCG: KVI & Susut */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <label className="flex items-center gap-2 p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl cursor-pointer hover:bg-amber-100/60 transition-colors">
                  <input
                    type="checkbox"
                    checked={editIsKvi}
                    onChange={e => setEditIsKvi(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500"
                  />
                  <div>
                    <span className="text-xs font-black text-amber-900 flex items-center gap-1">
                      <Sparkles size={11} className="text-amber-600" />
                      KVI / Sembako Pokok
                    </span>
                    <span className="text-[10px] text-amber-700 font-bold block">
                      Target margin tipis (1.5-7%) dianggap wajar karena volume tinggi.
                    </span>
                  </div>
                </label>

                <div className="p-2.5 bg-slate-100/70 border border-slate-200 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-700">Susut / Ceceran (%)</span>
                    <span className="text-[10px] font-bold text-slate-400">Curah/Timbang</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="30"
                      step="0.5"
                      placeholder="0"
                      value={editShrinkagePct || ''}
                      onChange={e => setEditShrinkagePct(Number(e.target.value))}
                      className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">%</span>
                  </div>
                  <span className="text-[9px] text-slate-500 font-medium block">
                    Beras/Telur susut timbangan (HPP disesuaikan naik otomatis).
                  </span>
                </div>
              </div>

              {/* Toggle Kalkulator Landed Cost */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowLandedCalc(!showLandedCalc)}
                  className="w-full py-2 px-3 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200 text-blue-900 rounded-xl text-xs font-black flex items-center justify-between transition-all"
                >
                  <span className="flex items-center gap-1.5">
                    <Calculator size={14} className="text-blue-600" />
                    Kalkulator Landed Cost, Pajak PPN, Rebate &amp; FOC
                  </span>
                  <span className="text-[10px] font-bold text-blue-600">
                    {showLandedCalc ? 'Tutup ▲' : 'Buka Kalkulator ▼'}
                  </span>
                </button>

                {showLandedCalc && (
                  <div className="mt-2.5 p-3.5 bg-blue-50/50 border border-blue-200 rounded-2xl space-y-3 animate-in fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-600 block mb-0.5">
                          Harga Faktur Beli (Rp)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={calcInvoicePrice}
                          onChange={e => setCalcInvoicePrice(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-600 block mb-0.5">
                          Perlakuan Pajak PPN
                        </label>
                        <select
                          value={calcTaxMode}
                          onChange={e => setCalcTaxMode(e.target.value as any)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                        >
                          <option value="EXEMPT">Bebas PPN (0% Non-BKP Sembako)</option>
                          <option value="EXCLUDE_PPN">Faktur Exclude PPN (+11% Masuk HPP)</option>
                          <option value="INCLUDE_PPN">Faktur Include PPN (Ekstrak DPP /1.11)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-600 block mb-0.5">
                          Ongkir Truk / Ekspedisi (+Rp/Unit)
                        </label>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={calcFreight || ''}
                          onChange={e => setCalcFreight(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-600 block mb-0.5">
                          Bongkar Muat Kuli (+Rp/Unit)
                        </label>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={calcHandling || ''}
                          onChange={e => setCalcHandling(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-600 block mb-0.5">
                          Rebate / Cashback Off-Invoice (-Rp/Unit)
                        </label>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={calcRebate || ''}
                          onChange={e => setCalcRebate(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-emerald-700"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-600 block mb-0.5">
                          Skema Bonus FOC (Beli X Gratis Y)
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            placeholder="Beli (10)"
                            value={calcFocBuy || ''}
                            onChange={e => setCalcFocBuy(Number(e.target.value))}
                            className="w-1/2 px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                          />
                          <span className="text-[10px] font-bold text-slate-400">+</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="Gratis (1)"
                            value={calcFocFree || ''}
                            onChange={e => setCalcFocFree(Number(e.target.value))}
                            className="w-1/2 px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-indigo-700"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Ringkasan Kalkulasi Landed Cost */}
                    <div className="p-3 bg-white rounded-xl border border-blue-200 shadow-2xs space-y-1 text-xs">
                      <div className="flex justify-between text-slate-500">
                        <span>Faktur Dasar:</span>
                        <span>Rp {calculatedLandedCost.base.toLocaleString('id-ID')}</span>
                      </div>
                      {calculatedLandedCost.taxAmount !== 0 && (
                        <div className="flex justify-between text-indigo-600">
                          <span>Penyesuaian Pajak ({calcTaxMode === 'EXCLUDE_PPN' ? '+PPN 11%' : '-PPN Include'}):</span>
                          <span>{calculatedLandedCost.taxAmount > 0 ? '+' : ''}Rp {Math.round(calculatedLandedCost.taxAmount).toLocaleString('id-ID')}</span>
                        </div>
                      )}
                      {calculatedLandedCost.totalAdditional > 0 && (
                        <div className="flex justify-between text-slate-600">
                          <span>Ongkir &amp; Kuli:</span>
                          <span>+Rp {calculatedLandedCost.totalAdditional.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                      {calculatedLandedCost.rebate > 0 && (
                        <div className="flex justify-between text-emerald-600 font-bold">
                          <span>Rebate Off-Invoice:</span>
                          <span>-Rp {calculatedLandedCost.rebate.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                      {calculatedLandedCost.focMultiplier < 1 && (
                        <div className="flex justify-between text-indigo-600 font-bold">
                          <span>Efek Bonus FOC:</span>
                          <span>Faktor {(calculatedLandedCost.focMultiplier * 100).toFixed(1)}%</span>
                        </div>
                      )}
                      {calculatedLandedCost.shrinkageAmount > 0 && (
                        <div className="flex justify-between text-amber-700 font-bold">
                          <span>Dampak Susut ({editShrinkagePct}%):</span>
                          <span>+Rp {Math.round(calculatedLandedCost.shrinkageAmount).toLocaleString('id-ID')}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-1 border-t border-slate-100 font-black text-slate-900 text-sm">
                        <span>HPP Netto Riil:</span>
                        <span className="text-blue-700">Rp {calculatedLandedCost.finalNetHpp.toLocaleString('id-ID')}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setEditModalCost(calculatedLandedCost.finalNetHpp);
                          notify.success(`HPP diset ke Rp ${calculatedLandedCost.finalNetHpp.toLocaleString('id-ID')}`);
                        }}
                        className="w-full mt-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <CheckCircle2 size={13} />
                        Gunakan Rp {calculatedLandedCost.finalNetHpp.toLocaleString('id-ID')} Sebagai Modal Dasar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* SECTION DAFTAR SATUAN & HARGA MULTI-SATUAN */}
            <div className="space-y-3 pt-1 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Layers size={16} className="text-indigo-600" />
                  <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                    Satuan Produk & Harga Jual ({editUnits.length} Satuan)
                  </h4>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Selector Kelipatan Pembulatan */}
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200" title="Kelipatan pembulatan harga jual di bilangan akhiran">
                    <span className="text-[9px] font-black uppercase text-slate-500 pl-1.5 pr-0.5">Bulatkan:</span>
                    {[50, 100, 500, 1000].map(step => (
                      <button
                        key={step}
                        type="button"
                        onClick={() => setEditRoundingStep(step)}
                        className={`px-1.5 py-0.5 rounded-lg text-[10px] font-black transition-all ${
                          editRoundingStep === step
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                        }`}
                      >
                        {step === 1000 ? '1rb' : step}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setEditUnits(prev => prev.map(u => {
                        const isBase = u.code === editingProduct.unit;
                        const unitCost = editModalCost * (u.contains || 1);
                        const rec = recommendSellingPrice({
                          cost: unitCost,
                          name: editingProduct.name,
                          category: editingProduct.category,
                          roundingStep: editRoundingStep,
                        });
                        const newPrice = rec ? rec.recommendedPrice : roundToKelipatan(unitCost * 1.15, editRoundingStep);
                        if (isBase) setEditPriceEcer(newPrice);
                        return { ...u, price: newPrice };
                      }));
                      notify.success(`Semua satuan diset ke harga rekomendasi (Bulat Rp ${editRoundingStep})!`);
                    }}
                    className="text-[11px] font-black text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-xl transition-colors flex items-center gap-1"
                    title="Set semua satuan ke harga rekomendasi margin target agar peringatan 'Perlu naik' hilang"
                  >
                    <Sparkles size={12} className="text-amber-600" />
                    Set Semua Rekomendasi
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddUnitRow(!showAddUnitRow)}
                    className="text-xs font-black text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 px-2.5 py-1 rounded-xl transition-colors"
                  >
                    <Plus size={13} />
                    {showAddUnitRow ? 'Batal Tambah' : 'Tambah Satuan'}
                  </button>
                </div>
              </div>

              {/* Form Tambah Satuan Baru */}
              {showAddUnitRow && (
                <div className="p-3.5 bg-indigo-50/60 border border-indigo-200 rounded-2xl space-y-3 animate-in fade-in">
                  <p className="text-xs font-black text-indigo-900">Tambah Satuan Kemasan Baru</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[10px] font-black uppercase text-indigo-700">Kode Satuan</label>
                      <input
                        type="text"
                        placeholder="Contoh: DUS / PACK"
                        value={newUnitCode}
                        onChange={e => setNewUnitCode(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-black text-slate-900 uppercase focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-indigo-700">
                        Isi (per {editingProduct.unit})
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder="24"
                        value={newUnitContains}
                        onChange={e => setNewUnitContains(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-black text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-indigo-700">Harga Jual (Rp)</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="Harga Jual"
                        value={newUnitPrice || ''}
                        onChange={e => setNewUnitPrice(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-black text-indigo-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-indigo-600 font-bold">
                      Modal satuan baru: Rp {(editModalCost * newUnitContains).toLocaleString('id-ID')}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const cleanCode = newUnitCode.trim().toUpperCase();
                        if (!cleanCode) return notify.error('Kode satuan wajib diisi');
                        if (editUnits.some(u => u.code === cleanCode)) {
                          return notify.error(`Satuan ${cleanCode} sudah terdaftar`);
                        }
                        if (newUnitContains <= 0) return notify.error('Isi satuan minimal 1');
                        setEditUnits(prev => [
                          ...prev,
                          {
                            code: cleanCode,
                            contains: newUnitContains,
                            price: newUnitPrice > 0 ? newUnitPrice : roundToKelipatan(editModalCost * newUnitContains * 1.2, editRoundingStep),
                          }
                        ]);
                        setShowAddUnitRow(false);
                        setNewUnitPrice(0);
                        notify.success(`Satuan ${cleanCode} berhasil ditambahkan`);
                      }}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-colors flex items-center gap-1"
                    >
                      <Plus size={12} />
                      Tambahkan
                    </button>
                  </div>
                </div>
              )}

              {/* List Semua Satuan */}
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {editUnits.map((u, idx) => {
                  const isBase = u.code === editingProduct.unit;
                  const unitCost = editModalCost * (u.contains || 1);
                  const currentPrice = isBase ? editPriceEcer : (u.price || 0);
                  const unitMarginRp = currentPrice - unitCost;
                  const unitMarginPct = currentPrice > 0 ? (unitMarginRp / currentPrice) * 100 : 0;
                  const rec = recommendSellingPrice({
                    cost: unitCost,
                    name: editingProduct.name,
                    category: editingProduct.category,
                    roundingStep: editRoundingStep,
                  });
                  const isBelowTarget = Boolean(rec && currentPrice < rec.recommendedPrice);

                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-2xl border transition-all space-y-2 ${
                        isBelowTarget
                          ? 'bg-rose-50/70 border-rose-300 ring-1 ring-rose-200'
                          : isBase
                          ? 'bg-blue-50/40 border-blue-200'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-black uppercase ${
                            isBelowTarget
                              ? 'bg-rose-600 text-white'
                              : isBase
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-800 text-white'
                          }`}>
                            {u.code}
                          </span>
                          {isBase ? (
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-100/60 px-2 py-0.5 rounded-md">
                              Satuan Utama (Isi 1)
                            </span>
                          ) : (
                            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                              <span>Isi:</span>
                              <input
                                type="number"
                                min="1"
                                value={u.contains}
                                onChange={e => {
                                  const val = Math.max(1, Number(e.target.value));
                                  setEditUnits(prev => {
                                    const next = [...prev];
                                    next[idx] = { ...next[idx], contains: val };
                                    return next;
                                  });
                                }}
                                className="w-16 px-2 py-0.5 bg-white border border-slate-300 rounded-lg text-xs font-black text-slate-800 text-center"
                              />
                              <span>{editingProduct.unit}</span>
                            </div>
                          )}
                          {isBelowTarget && rec && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md animate-pulse">
                              <AlertTriangle size={10} />
                              Target: Rp {rec.recommendedPrice.toLocaleString('id-ID')}
                            </span>
                          )}
                        </div>

                        {/* Tombol Hapus Satuan Tambahan */}
                        {!isBase && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditUnits(prev => prev.filter((_, i) => i !== idx));
                            }}
                            className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 rounded-lg transition-colors self-end sm:self-auto"
                            title="Hapus satuan ini"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="text-[10px] font-black uppercase text-slate-400">Harga Jual Satuan</label>
                          <div className="relative mt-0.5">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                            <input
                              type="number"
                              min="0"
                              value={currentPrice}
                              onChange={e => {
                                const val = Number(e.target.value);
                                if (isBase) {
                                  setEditPriceEcer(val);
                                }
                                setEditUnits(prev => {
                                  const next = [...prev];
                                  next[idx] = { ...next[idx], price: val };
                                  return next;
                                });
                              }}
                              className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-300 rounded-xl font-black text-xs text-blue-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Info Margin & Quick Set Margin per Satuan */}
                        <div className="flex flex-col justify-end text-right">
                          <span className="text-[10px] text-slate-400 font-bold">
                            Modal: Rp {unitCost.toLocaleString('id-ID')}
                          </span>
                          <span className={`text-xs font-black ${unitMarginRp >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {unitMarginRp >= 0 ? '+' : ''}Rp {unitMarginRp.toLocaleString('id-ID')} ({unitMarginPct.toFixed(1)}%)
                          </span>
                          <div className="flex flex-wrap items-center justify-end gap-1 mt-1.5">
                            {!isBase && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const rec = recommendSellingPrice({
                                      cost: unitCost,
                                      name: editingProduct.name,
                                      category: editingProduct.category,
                                      roundingStep: editRoundingStep,
                                    });
                                    if (rec) {
                                      const targetPrice = rec.recommendedPrice;
                                      setEditUnits(prev => {
                                        const next = [...prev];
                                        next[idx] = { ...next[idx], price: targetPrice };
                                        return next;
                                      });
                                    }
                                  }}
                                  className="px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[9px] font-black transition-colors"
                                  title="Hitung otomatis mengikuti AI margin rekomendasi produk"
                                >
                                  ✨ Rekomendasi
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const targetPrice = editPriceEcer * (u.contains || 1);
                                    setEditUnits(prev => {
                                      const next = [...prev];
                                      next[idx] = { ...next[idx], price: targetPrice };
                                      return next;
                                    });
                                  }}
                                  className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[9px] font-black transition-colors"
                                  title="Sama dengan Ecer x Isi"
                                >
                                  Sama Ecer
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const targetPrice = roundToKelipatan(editPriceEcer * (u.contains || 1) * 0.95, editRoundingStep);
                                    setEditUnits(prev => {
                                      const next = [...prev];
                                      next[idx] = { ...next[idx], price: targetPrice };
                                      return next;
                                    });
                                  }}
                                  className="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded text-[9px] font-black transition-colors"
                                  title="Potongan diskon 5% dari harga ecer"
                                >
                                  -5% Ecer
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                const targetPrice = roundToKelipatan(unitCost * 1.05, editRoundingStep);
                                if (isBase) setEditPriceEcer(targetPrice);
                                setEditUnits(prev => {
                                  const next = [...prev];
                                  next[idx] = { ...next[idx], price: targetPrice };
                                  return next;
                                });
                              }}
                              className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded text-[9px] font-black transition-colors"
                              title={`Terapkan margin 5% (Bulat Rp ${editRoundingStep})`}
                            >
                              5%
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const targetPrice = roundToKelipatan(unitCost * 1.10, editRoundingStep);
                                if (isBase) setEditPriceEcer(targetPrice);
                                setEditUnits(prev => {
                                  const next = [...prev];
                                  next[idx] = { ...next[idx], price: targetPrice };
                                  return next;
                                });
                              }}
                              className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded text-[9px] font-black transition-colors"
                              title={`Terapkan margin 10% (Bulat Rp ${editRoundingStep})`}
                            >
                              10%
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const targetPrice = roundToKelipatan(unitCost / 0.85, editRoundingStep);
                                if (isBase) setEditPriceEcer(targetPrice);
                                setEditUnits(prev => {
                                  const next = [...prev];
                                  next[idx] = { ...next[idx], price: targetPrice };
                                  return next;
                                });
                              }}
                              className="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-[9px] font-black transition-colors"
                              title={`Terapkan margin 15% (Bulat Rp ${editRoundingStep})`}
                            >
                              15%
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const targetPrice = roundToKelipatan(unitCost / 0.8, editRoundingStep);
                                if (isBase) setEditPriceEcer(targetPrice);
                                setEditUnits(prev => {
                                  const next = [...prev];
                                  next[idx] = { ...next[idx], price: targetPrice };
                                  return next;
                                });
                              }}
                              className="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-[9px] font-black transition-colors"
                              title={`Terapkan margin 20% (Bulat Rp ${editRoundingStep})`}
                            >
                              20%
                            </button>

                            {/* Toggle & Input Margin vs Markup per Satuan */}
                            {(() => {
                              const currentMode = unitMarginMode[idx] || 'MARGIN';
                              const applyValue = (val: number) => {
                                if (isNaN(val)) return;
                                if (currentMode === 'MARGIN') {
                                  if (val >= 100) {
                                    notify.error('Margin dari harga jual tidak boleh ≥ 100%');
                                    return;
                                  }
                                  const targetPrice = roundToKelipatan(unitCost / (1 - (val / 100)), editRoundingStep);
                                  if (isBase) setEditPriceEcer(targetPrice);
                                  setEditUnits(prev => {
                                    const next = [...prev];
                                    next[idx] = { ...next[idx], price: targetPrice };
                                    return next;
                                  });
                                  notify.success(`Margin ${val}% diterapkan: Rp ${targetPrice.toLocaleString('id-ID')} (Bulat Rp ${editRoundingStep})`);
                                } else {
                                  // MARKUP
                                  const targetPrice = roundToKelipatan(unitCost * (1 + (val / 100)), editRoundingStep);
                                  if (isBase) setEditPriceEcer(targetPrice);
                                  setEditUnits(prev => {
                                    const next = [...prev];
                                    next[idx] = { ...next[idx], price: targetPrice };
                                    return next;
                                  });
                                  notify.success(`Markup +${val}% dari modal diterapkan: Rp ${targetPrice.toLocaleString('id-ID')} (Bulat Rp ${editRoundingStep})`);
                                }
                              };

                              return (
                                <div className="flex items-center gap-1 bg-slate-100 border border-slate-300 rounded-lg px-1.5 py-0.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextMode = currentMode === 'MARGIN' ? 'MARKUP' : 'MARGIN';
                                      setUnitMarginMode(prev => ({ ...prev, [idx]: nextMode }));
                                      notify.info(`Beralih ke mode ${nextMode === 'MARGIN' ? 'Margin (% dari Jual)' : 'Markup (% dari Modal)'}`);
                                    }}
                                    className={`text-[8.5px] font-black px-1 py-0.2 rounded transition-colors ${
                                      currentMode === 'MARGIN' ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'
                                    }`}
                                    title="Klik untuk beralih antara Margin (% dari Jual) dan Markup (% dari Modal)"
                                  >
                                    {currentMode === 'MARGIN' ? 'Mgn' : 'Mrk'}
                                  </button>
                                  <input
                                    type="number"
                                    min="-90"
                                    max="500"
                                    step="0.5"
                                    placeholder="±%"
                                    defaultValue=""
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        applyValue(Number((e.target as HTMLInputElement).value));
                                      }
                                    }}
                                    onBlur={e => {
                                      if (e.target.value !== '') {
                                        applyValue(Number(e.target.value));
                                      }
                                    }}
                                    className="w-10 bg-transparent text-[10px] font-black text-slate-800 text-center focus:outline-none"
                                  />
                                </div>
                              );
                            })()}

                            {/* Input Nominal Profit Manual (+Rp) per Satuan */}
                            <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-300 rounded-lg px-1.5 py-0.5" title={`Ketik nominal keuntungan bersih (Rp) yang diinginkan (Bulat Rp ${editRoundingStep}), lalu tekan Enter`}>
                              <span className="text-[9px] font-black text-emerald-700">+Rp</span>
                              <input
                                type="number"
                                min="0"
                                step={editRoundingStep}
                                placeholder="Untung"
                                defaultValue=""
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const profit = Number((e.target as HTMLInputElement).value);
                                    if (!isNaN(profit) && profit >= 0) {
                                      const raw = unitCost + profit;
                                      const targetPrice = roundToKelipatan(raw, editRoundingStep);
                                      if (isBase) setEditPriceEcer(targetPrice);
                                      setEditUnits(prev => {
                                        const next = [...prev];
                                        next[idx] = { ...next[idx], price: targetPrice };
                                        return next;
                                      });
                                      notify.success(`Untung +Rp ${profit.toLocaleString('id-ID')} diterapkan: Rp ${targetPrice.toLocaleString('id-ID')} (Bulat Rp ${editRoundingStep})`);
                                    }
                                  }
                                }}
                                onBlur={e => {
                                  const profit = Number(e.target.value);
                                  if (e.target.value !== '' && !isNaN(profit) && profit >= 0) {
                                    const raw = unitCost + profit;
                                    const targetPrice = roundToKelipatan(raw, editRoundingStep);
                                    if (isBase) setEditPriceEcer(targetPrice);
                                    setEditUnits(prev => {
                                      const next = [...prev];
                                      next[idx] = { ...next[idx], price: targetPrice };
                                      return next;
                                    });
                                    notify.success(`Untung +Rp ${profit.toLocaleString('id-ID')} diterapkan: Rp ${targetPrice.toLocaleString('id-ID')}`);
                                  }
                                }}
                                className="w-14 bg-transparent text-[10px] font-black text-emerald-900 text-center focus:outline-none placeholder:text-emerald-400"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* TIER HARGA PELANGGAN (SEMI-GROSIR & GROSIR) */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                    <Tag size={13} className="text-purple-600" />
                    Tier Harga Pelanggan (Anti-Boncos)
                  </h4>
                  <p className="text-[10px] text-slate-400">Harga khusus untuk pelanggan Semi-Grosir (Warung) dan Grosir (Partai)</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const tiers = calculateCustomerTierPrices({
                      costPrice: editModalCost,
                      priceEcer: editPriceEcer,
                      roundingStep: editRoundingStep,
                    });
                    setEditPriceSemiGrosir(tiers.priceSemiGrosir);
                    setEditPriceGrosir(tiers.priceGrosir);
                    notify.success('Tier harga dihitung otomatis dari HPP & Ecer!');
                  }}
                  className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-[11px] font-black border border-purple-200 transition-all flex items-center gap-1"
                >
                  <Sparkles size={12} /> Hitung Tier Otomatis
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Semi-Grosir */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black uppercase text-emerald-700">Semi-Grosir (Warung)</label>
                    {editModalCost > 0 && editPriceSemiGrosir > 0 && (
                      <span className="text-[10px] font-black text-emerald-600">
                        +{(((editPriceSemiGrosir - editModalCost) / editModalCost) * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-emerald-600 text-xs">Rp</span>
                    <input
                      type="number"
                      min="0"
                      value={editPriceSemiGrosir}
                      onChange={e => setEditPriceSemiGrosir(Number(e.target.value))}
                      placeholder="Diskon warung"
                      className="w-full pl-9 pr-3 py-2 bg-emerald-50/60 border border-emerald-200 rounded-2xl font-black text-xs text-emerald-950 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Grosir */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black uppercase text-purple-700">Grosir (Agen/Partai)</label>
                    {editModalCost > 0 && editPriceGrosir > 0 && (
                      <span className="text-[10px] font-black text-purple-600">
                        +{(((editPriceGrosir - editModalCost) / editModalCost) * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-purple-600 text-xs">Rp</span>
                    <input
                      type="number"
                      min="0"
                      value={editPriceGrosir}
                      onChange={e => setEditPriceGrosir(Number(e.target.value))}
                      placeholder="Harga partai"
                      className="w-full pl-9 pr-3 py-2 bg-purple-50/60 border border-purple-200 rounded-2xl font-black text-xs text-purple-950 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Min Qty Grosir */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase text-slate-500">Min Qty Grosir ({editingProduct.unit})</label>
                  <input
                    type="number"
                    min="1"
                    value={editMinGrosir}
                    onChange={e => setEditMinGrosir(Number(e.target.value))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* MODAL FOOTER */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition-all flex items-center gap-2 shadow-sm shadow-blue-200 disabled:opacity-50"
              >
                {savingEdit ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== RESET AVG CONFIRMATION MODAL ===================== */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-100 rounded-2xl shrink-0">
                <RotateCcw size={22} className="text-amber-700" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Terapkan Harga PO Terakhir Menjadi HPP</h3>
                <p className="text-xs text-slate-500 font-bold mt-1">
                  Sinkronisasi HPP aktif dengan harga beli pada faktur/nota PO terbaru (Replacement Cost).
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-600">Produk dipilih</span>
                <span className="font-black text-slate-900">{selectedCount} produk</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-600">Memiliki data riwayat PO</span>
                <span className="font-black text-emerald-700">{selectedWithAvg.length} produk ✓</span>
              </div>
              {(() => {
                const lockedSelected = Array.from(selectedIds).filter(id => {
                  const p = products.find(prod => prod.id === id);
                  return p?.isHppLocked;
                }).length;

                return (
                  lockedSelected > 0 && (
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                      <span className="font-bold text-blue-700 flex items-center gap-1">
                        <Lock size={12} />
                        HPP Diset Manual / Terkunci
                      </span>
                      <span className="font-black text-blue-700">{lockedSelected} produk</span>
                    </div>
                  )
                );
              })()}
            </div>

            {/* Checkbox Perlindungan Data Manual */}
            <label className="flex items-start gap-2.5 p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl cursor-pointer hover:bg-blue-100/60 transition-colors">
              <input
                type="checkbox"
                checked={skipLockedHpp}
                onChange={e => setSkipLockedHpp(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 mt-0.5"
              />
              <div>
                <span className="text-xs font-black text-blue-900 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-blue-700" />
                  Lewati produk yang HPP-nya sudah diset manual / dikunci (Rekomendasi)
                </span>
                <span className="text-[11px] text-blue-700 font-bold block mt-0.5">
                  Data yang sudah Anda set manual TIDAK AKAN HILANG atau tertimpa oleh data PO mentah.
                </span>
              </div>
            </label>

            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-2">
              <Info size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700 font-bold">
                AVG HPP dihitung dari rata-rata harga beli per unit di seluruh PO yang sudah diterima. Harga jual ecer tidak berubah.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={isResetting}
                className="px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={isResetting || selectedWithAvg.length === 0}
                className="px-6 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs transition-all flex items-center gap-2 shadow-sm shadow-amber-200 disabled:opacity-60"
              >
                {isResetting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <Zap size={14} />
                    Ya, Restart AVG HPP ({selectedWithAvg.length})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPriceReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-rose-50 text-rose-700 rounded-xl shrink-0">
                <TrendingUp size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Terapkan Rekomendasi Harga</h3>
                <p className="mt-1 text-xs text-slate-600">
                  {selectedPriceReviewProducts.length} produk · {selectedPriceReviewUnitCount} satuan perlu penyesuaian
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {selectedPriceReviewProducts.map((product) => (
                <div key={product.id} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-xs font-black text-slate-900">{product.name}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-rose-700">
                    {(priceReviewByProduct.get(product.id) || []).map((finding) => (
                      <span key={finding.unitCode}>
                        {finding.unitCode}: Rp{finding.currentPrice.toLocaleString('id-ID')} → Rp{finding.recommendedPrice.toLocaleString('id-ID')}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <p className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-900">
              Hanya harga satuan yang masih di bawah target yang dinaikkan. Harga yang sudah sesuai dan harga grosir bertingkat tidak diubah.
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPriceReviewModal(false)}
                disabled={isResetting}
                className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-black disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleApplyPriceRecommendations}
                disabled={isResetting || selectedPriceReviewProducts.length === 0}
                className="px-4 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-black disabled:opacity-50"
              >
                {isResetting ? 'Memproses...' : 'Naikkan Harga'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== SET MARGIN OTOMATIS MODAL ===================== */}
      {showWholesaleModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowWholesaleModal(false)}>
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-black text-slate-800 mb-1 flex items-center gap-2">
              <Tag size={16} className="text-emerald-600" /> Set Harga Grosir Massal
            </h3>
            <p className="text-xs text-slate-400 mb-4">{selectedIds.size} produk dipilih</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Mode Penetapan Harga</label>
                <select value={wholesaleMode} onChange={e => setWholesaleMode(e.target.value as any)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="DISCOUNT_PERCENT">Diskon % dari Harga Ecer</option>
                  <option value="DISCOUNT_NOMINAL">Potongan Nominal Rp dari Ecer</option>
                  <option value="MARGIN_COST">Margin % di atas Modal (HPP)</option>
                  <option value="FIXED_PRICE">Harga Tetap Rp</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  {wholesaleMode === 'DISCOUNT_PERCENT' ? 'Diskon (%)' : wholesaleMode === 'DISCOUNT_NOMINAL' ? 'Potongan (Rp)' : wholesaleMode === 'MARGIN_COST' ? 'Margin dari Modal (%)' : 'Harga Grosir Tetap (Rp)'}
                </label>
                <input type="number" min="0" value={wholesaleValue} onChange={e => setWholesaleValue(Number(e.target.value))} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Min. Beli Grosir (pcs/unit)</label>
                <input type="number" min="1" value={wholesaleMinQty} onChange={e => setWholesaleMinQty(Number(e.target.value))} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={wholesaleAllUnits} onChange={e => setWholesaleAllUnits(e.target.checked)} className="rounded accent-emerald-600" />
                <span className="text-xs font-bold text-slate-700">Terapkan ke semua satuan (RTG, DUS, dll.)</span>
              </label>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowWholesaleModal(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors">
                Batal
              </button>
              <button onClick={handleBulkWholesale} disabled={isResetting} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {isResetting ? '⏳ Menyimpan...' : 'Terapkan Grosir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTierModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setShowTierModal(false)}>
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <Layers size={18} className="text-purple-600" />
                  Hitung Tier Harga Grosir Otomatis
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Terapkan harga bertingkat otomatis untuk <strong className="text-purple-600">{selectedIds.size} produk</strong> terpilih
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTierModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Mode Pemilihan */}
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1.5">Metode Perhitungan Tier</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setTierMode('DISCOUNT_FROM_RETAIL')}
                    className={`py-2 px-3 rounded-xl text-xs font-black transition-all ${
                      tierMode === 'DISCOUNT_FROM_RETAIL'
                        ? 'bg-white text-purple-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    📉 Diskon % dari Ecer
                  </button>
                  <button
                    type="button"
                    onClick={() => setTierMode('MARGIN_FROM_COST')}
                    className={`py-2 px-3 rounded-xl text-xs font-black transition-all ${
                      tierMode === 'MARGIN_FROM_COST'
                        ? 'bg-white text-purple-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    📈 Margin % di atas Modal
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {tierMode === 'DISCOUNT_FROM_RETAIL'
                    ? 'Harga grosir dihitung dari potongan % terhadap harga jual eceran produk.'
                    : 'Harga grosir dihitung langsung dari HPP produk ditambah margin % yang Anda tentukan.'}
                </p>
              </div>

              {/* Tabel Tingkatan Tier */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700">Tingkatan Harga (Tier)</label>
                  {tierRules.length < 5 && (
                    <button
                      type="button"
                      onClick={() => {
                        const last = tierRules[tierRules.length - 1];
                        const nextQty = last ? last.minQty * 3 : 12;
                        const nextVal = tierMode === 'DISCOUNT_FROM_RETAIL' ? (last ? last.value + 5 : 10) : (last ? Math.max(5, last.value - 5) : 15);
                        setTierRules([
                          ...tierRules,
                          { minQty: nextQty, value: nextVal, label: `Grosir min.${nextQty}` },
                        ]);
                      }}
                      className="text-xs text-purple-600 hover:text-purple-700 font-black flex items-center gap-1 hover:underline"
                    >
                      <Plus size={13} /> Tambah Tier
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {tierRules.map((tier, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-2xl">
                      <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-black flex items-center justify-center shrink-0">
                        {idx + 1}
                      </div>

                      <div className="flex-1">
                        <label className="text-[10px] text-slate-400 font-bold block mb-0.5">Label Tier</label>
                        <input
                          type="text"
                          value={tier.label}
                          onChange={(e) => {
                            const updated = [...tierRules];
                            updated[idx] = { ...updated[idx], label: e.target.value };
                            setTierRules(updated);
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 outline-none focus:border-purple-500"
                          placeholder={`Tier ${idx + 1}`}
                        />
                      </div>

                      <div className="w-24">
                        <label className="text-[10px] text-slate-400 font-bold block mb-0.5">Min. Beli</label>
                        <input
                          type="number"
                          min={idx === 0 ? 1 : 2}
                          value={tier.minQty}
                          disabled={idx === 0}
                          onChange={(e) => {
                            const updated = [...tierRules];
                            updated[idx] = { ...updated[idx], minQty: Math.max(1, Number(e.target.value)) };
                            setTierRules(updated);
                          }}
                          className={`w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 outline-none focus:border-purple-500 ${
                            idx === 0 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''
                          }`}
                        />
                      </div>

                      <div className="w-28">
                        <label className="text-[10px] text-slate-400 font-bold block mb-0.5">
                          {tierMode === 'DISCOUNT_FROM_RETAIL' ? 'Diskon (%)' : 'Margin (%)'}
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={tierMode === 'DISCOUNT_FROM_RETAIL' ? 90 : 500}
                          value={tier.value}
                          disabled={idx === 0 && tierMode === 'DISCOUNT_FROM_RETAIL'}
                          onChange={(e) => {
                            const updated = [...tierRules];
                            updated[idx] = { ...updated[idx], value: Number(e.target.value) };
                            setTierRules(updated);
                          }}
                          className={`w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 outline-none focus:border-purple-500 ${
                            idx === 0 && tierMode === 'DISCOUNT_FROM_RETAIL' ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''
                          }`}
                        />
                      </div>

                      {tierRules.length > 2 && idx > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setTierRules(tierRules.filter((_, i) => i !== idx));
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors mt-3"
                          title="Hapus tier ini"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Pembulatan */}
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Pembulatan Harga Akhir</label>
                <select
                  value={tierRoundingStep}
                  onChange={(e) => setTierRoundingStep(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 bg-slate-50 outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value={100}>Bulatkan ke Rp 100 terdekat (Contoh: Rp 9.450 → Rp 9.500)</option>
                  <option value={500}>Bulatkan ke Rp 500 terdekat (Contoh: Rp 9.300 → Rp 9.500)</option>
                  <option value={1000}>Bulatkan ke Rp 1.000 terdekat (Contoh: Rp 9.200 → Rp 9.000)</option>
                  <option value={1}>Tanpa Pembulatan (Persis hasil hitung)</option>
                </select>
              </div>

              {/* Live Preview Box */}
              <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-1.5 text-purple-900 font-black text-xs">
                  <Calculator size={14} className="text-purple-600" />
                  <span>Simulasi Perhitungan (Contoh: Modal Rp 10.000, Ecer Rp 12.000)</span>
                </div>
                {(() => {
                  const sampleCost = 10000;
                  const sampleRetail = 12000;
                  const hasLoss = tierRules.some((tier) => {
                    const p = tierMode === 'DISCOUNT_FROM_RETAIL'
                      ? sampleRetail * (1 - tier.value / 100)
                      : sampleCost * (1 + tier.value / 100);
                    return p <= sampleCost;
                  });
                  return (
                    <div className={`p-2 rounded-xl border flex items-center gap-2 text-[11px] font-bold ${
                      hasLoss
                        ? 'bg-rose-50 border-rose-200 text-rose-700'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }`}>
                      <ShieldCheck size={15} className={hasLoss ? 'text-rose-600 shrink-0' : 'text-emerald-600 shrink-0'} />
                      <span>
                        {hasLoss
                          ? '⚠️ Perhatian: Tier tertinggi melebihi margin keuntungan dan berisiko di bawah modal!'
                          : '🛡️ Proteksi Anti-Boncos Aman: Semua tingkatan tier berada di atas modal HPP.'}
                      </span>
                    </div>
                  );
                })()}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
                  {tierRules.map((tier, idx) => {
                    const sampleCost = 10000;
                    const sampleRetail = 12000;
                    let calculated = 0;
                    if (tierMode === 'DISCOUNT_FROM_RETAIL') {
                      calculated = sampleRetail * (1 - tier.value / 100);
                    } else {
                      calculated = sampleCost * (1 + tier.value / 100);
                    }
                    if (tierRoundingStep > 1) {
                      calculated = Math.round(calculated / tierRoundingStep) * tierRoundingStep;
                    }
                    const sampleMarginRp = calculated - sampleCost;
                    const sampleMarginPct = calculated > 0 ? (sampleMarginRp / calculated) * 100 : 0;
                    return (
                      <div key={idx} className="p-2 bg-white rounded-xl border border-purple-100 shadow-2xs">
                        <span className="text-[10px] font-bold text-slate-400 block">{tier.label || `Tier ${idx + 1}`} (≥{tier.minQty})</span>
                        <span className="font-black text-purple-700 text-xs block">Rp {calculated.toLocaleString('id-ID')}</span>
                        <span className="text-[9px] font-bold text-slate-500">
                          {tierMode === 'DISCOUNT_FROM_RETAIL' ? `Diskon ${tier.value}%` : `Margin ${tier.value}%`} · Untung Rp{sampleMarginRp.toLocaleString('id-ID')} ({sampleMarginPct.toFixed(0)}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                type="button"
                onClick={() => setShowTierModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleBulkSetPriceTiers}
                disabled={isResetting}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
              >
                {isResetting ? '⏳ Menghitung & Menyimpan...' : `Terapkan ke ${selectedIds.size} Produk`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showMarginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-emerald-100 rounded-2xl shrink-0">
                <TrendingUp size={22} className="text-emerald-700" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Set Margin & Harga Jual</h3>
                <p className="text-xs text-slate-500 font-bold mt-1">
                  Atur harga jual dengan pilihan persentase (%) atau nominal rupiah tetap (Rp) di atas modal.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-600">Produk dipilih</span>
                <span className="font-black text-slate-900">{selectedCount} produk</span>
              </div>

              {/* Pilihan Metode Penetapan Margin / Markup / Nominal */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-slate-500">Metode Penetapan Keuntungan</label>
                <div className="grid grid-cols-3 gap-1.5 bg-slate-200/70 p-1 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => {
                      setMarginCalcMode('MARGIN');
                      setMarginType('PERCENT');
                      if (targetMarginValue > 100) setTargetMarginValue(15);
                    }}
                    className={`py-2 text-[11px] font-black rounded-xl transition-all flex flex-col items-center justify-center gap-0.5 ${
                      marginCalcMode === 'MARGIN'
                        ? 'bg-white text-emerald-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span className="flex items-center gap-1"><Percent size={12} /> Margin %</span>
                    <span className="text-[9px] font-semibold text-slate-400">(dari Jual)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMarginCalcMode('MARKUP');
                      setMarginType('PERCENT');
                      if (targetMarginValue > 100) setTargetMarginValue(15);
                    }}
                    className={`py-2 text-[11px] font-black rounded-xl transition-all flex flex-col items-center justify-center gap-0.5 ${
                      marginCalcMode === 'MARKUP'
                        ? 'bg-white text-purple-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span className="flex items-center gap-1"><TrendingUp size={12} /> Markup %</span>
                    <span className="text-[9px] font-semibold text-slate-400">(dari Modal)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMarginCalcMode('NOMINAL');
                      setMarginType('NOMINAL');
                      if (targetMarginValue < 100) setTargetMarginValue(5000);
                    }}
                    className={`py-2 text-[11px] font-black rounded-xl transition-all flex flex-col items-center justify-center gap-0.5 ${
                      marginCalcMode === 'NOMINAL'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span className="flex items-center gap-1"><DollarSign size={12} /> Nominal</span>
                    <span className="text-[9px] font-semibold text-slate-400">(+Rp Tetap)</span>
                  </button>
                </div>
              </div>
              
              {/* Input Nilai Margin / Markup / Nominal */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-slate-500">
                  {marginCalcMode === 'MARGIN' ? 'Target Margin (% dari Harga Jual)' : marginCalcMode === 'MARKUP' ? 'Tambahan Markup (% dari Modal Kulakan)' : 'Tambahan Margin Nominal (+Rp)'}
                </label>
                <div className="relative">
                  {marginCalcMode === 'NOMINAL' && (
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">Rp</span>
                  )}
                  <input
                    type="number"
                    min="1"
                    max={marginCalcMode === 'MARGIN' ? 95 : 10000000}
                    value={targetMarginValue}
                    onChange={e => setTargetMarginValue(Number(e.target.value))}
                    className={`w-full py-3 bg-white border border-slate-300 rounded-2xl font-black text-lg focus:bg-white focus:ring-2 focus:outline-none ${
                      marginCalcMode === 'NOMINAL'
                        ? 'pl-11 pr-4 text-blue-700 focus:ring-blue-500'
                        : marginCalcMode === 'MARKUP'
                        ? 'pl-4 pr-10 text-purple-700 focus:ring-purple-500'
                        : 'pl-4 pr-10 text-emerald-700 focus:ring-emerald-500'
                    }`}
                  />
                  {marginCalcMode !== 'NOMINAL' && (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-lg">%</span>
                  )}
                </div>

                {/* Simulasi Rumus Akuntansi */}
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-1 text-[11px] font-bold">
                  {marginCalcMode === 'MARGIN' && (
                    <>
                      <div className="text-emerald-800 flex justify-between">
                        <span>Rumus: Harga = Modal / (1 - {targetMarginValue}%)</span>
                        <span className="text-[10px] text-slate-400 font-mono">Standar Retail Modern</span>
                      </div>
                      <div className="text-slate-500 text-[10px]">
                        Contoh Modal Rp 10.000 → Jual <strong className="text-emerald-700">Rp {Math.ceil((10000 / (1 - (targetMarginValue / 100))) / 100) * 100}</strong> (Untung Rp {Math.ceil((10000 / (1 - (targetMarginValue / 100))) / 100) * 100 - 10000})
                      </div>
                    </>
                  )}
                  {marginCalcMode === 'MARKUP' && (
                    <>
                      <div className="text-purple-800 flex justify-between">
                        <span>Rumus: Harga = Modal * (1 + {targetMarginValue}%)</span>
                        <span className="text-[10px] text-slate-400 font-mono">Standar Grosir Partai</span>
                      </div>
                      <div className="text-slate-500 text-[10px]">
                        Contoh Modal Rp 10.000 → Jual <strong className="text-purple-700">Rp {Math.ceil((10000 * (1 + (targetMarginValue / 100))) / 100) * 100}</strong> (Untung Rp {Math.ceil((10000 * (1 + (targetMarginValue / 100))) / 100) * 100 - 10000})
                      </div>
                    </>
                  )}
                  {marginCalcMode === 'NOMINAL' && (
                    <>
                      <div className="text-blue-800">
                        <span>Rumus: Harga = Modal + Rp {targetMarginValue.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="text-slate-500 text-[10px]">
                        Contoh Modal Rp 10.000 → Jual <strong className="text-blue-700">Rp {(10000 + targetMarginValue).toLocaleString('id-ID')}</strong> (Untung Rp {targetMarginValue.toLocaleString('id-ID')})
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Pilihan Target Satuan yang Diatur */}
              <div className="space-y-1.5 pt-2 border-t border-slate-200">
                <label className="text-xs font-black uppercase text-slate-500">Terapkan Ke Satuan</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMarginUnitTarget('BASE_ONLY')}
                    className={`p-2.5 rounded-2xl text-xs font-black border transition-all text-left ${
                      marginUnitTarget === 'BASE_ONLY'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-sm ring-1 ring-emerald-400'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div>Satuan Utama Saja</div>
                    <div className="text-[10px] text-slate-400 font-bold mt-0.5">Hanya harga ecer dasar</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMarginUnitTarget('ALL_UNITS')}
                    className={`p-2.5 rounded-2xl text-xs font-black border transition-all text-left ${
                      marginUnitTarget === 'ALL_UNITS'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-sm ring-1 ring-emerald-400'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div>Semua Satuan</div>
                    <div className="text-[10px] text-slate-400 font-bold mt-0.5">Proporsional per kemasan</div>
                  </button>
                </div>

                {/* Opsi Pemilihan Satuan Spesifik yang Tersedia */}
                {availableUnitsInSelected.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-dashed border-slate-200">
                    <div className="text-[11px] font-black uppercase text-slate-500 mb-1.5 flex items-center justify-between">
                      <span>Atau Terapkan Khusus Satuan Ini:</span>
                      <span className="text-[10px] lowercase font-semibold text-slate-400">{availableUnitsInSelected.length} satuan terdaftar</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                      {availableUnitsInSelected.map((uCode) => {
                        const isSelected = marginUnitTarget === uCode;
                        return (
                          <button
                            key={uCode}
                            type="button"
                            onClick={() => setMarginUnitTarget(uCode)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all flex items-center gap-1.5 ${
                              isSelected
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm shadow-emerald-200 scale-105'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                            }`}
                          >
                            <span>{uCode}</span>
                            {isSelected && <span className="text-[9px] bg-emerald-700/60 px-1 py-0.5 rounded font-bold">Dipilih</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Simulasi Preview Ringkas */}
            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-start gap-2">
              <Info size={14} className="text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-[11px] text-emerald-800 font-bold space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-600">Target Satuan:</span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-200/70 text-emerald-950 font-black text-[11px]">
                    {marginUnitTarget === 'BASE_ONLY'
                      ? 'Satuan Utama / Ecer Dasar'
                      : marginUnitTarget === 'ALL_UNITS'
                      ? 'Semua Satuan (Proporsional per Kemasan)'
                      : `Khusus Satuan: ${marginUnitTarget}`}
                  </span>
                </div>
                <p>Harga baru otomatis dibulatkan ke atas ke kelipatan Rp100 terdekat.</p>
                <p className="text-[10px] text-emerald-600">
                  Contoh modal Rp10.000 &rarr; Estimasi Ecer Baru:{' '}
                  <span className="font-black text-emerald-900">
                    Rp{' '}
                    {(marginType === 'PERCENT'
                      ? Math.ceil((10000 / (1 - (targetMarginValue / 100))) / 100) * 100
                      : Math.ceil((10000 + targetMarginValue) / 100) * 100
                    ).toLocaleString('id-ID')}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowMarginModal(false)}
                disabled={isResetting}
                className="px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmTargetMargin}
                disabled={isResetting || targetMarginValue <= 0}
                className="px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all flex items-center gap-2 shadow-sm shadow-emerald-200 disabled:opacity-60"
              >
                {isResetting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <Zap size={14} />
                    Terapkan Margin ({selectedCount})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== BAGI HPP (KONVERSI) MODAL ===================== */}
      {showDivideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-100 rounded-2xl shrink-0">
                <Split size={22} className="text-amber-700" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Bagi HPP (Konversi Satuan)</h3>
                <p className="text-xs text-slate-500 font-bold mt-1">
                  Membagi harga modal (HPP) aktif produk untuk memperbaiki data PO yang masuk dalam kemasan besar (misal: CTN dibagi isi per PCS).
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-slate-600">Produk dipilih</span>
                <span className="font-black text-slate-900">{selectedCount} produk</span>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-slate-500">Angka Pembagi</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-lg">÷</div>
                  <input
                    type="number"
                    min="2"
                    step="1"
                    value={divideValue}
                    onChange={e => setDivideValue(Number(e.target.value))}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-2xl font-black text-lg text-amber-700 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-bold mt-1 text-right">
                  Contoh: Jika modal Rp120.000/CTN, dibagi 24 = Rp5.000/PCS
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-2">
              <Info size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700 font-bold">
                Tindakan ini akan membagi HPP aktif (Modal) saat ini, mengunci HPP produk agar tidak tertimpa saat Restart AVG, dan mengoreksi riwayat PO.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowDivideModal(false)}
                disabled={isResetting}
                className="px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDivideHpp}
                disabled={isResetting || divideValue <= 1}
                className="px-6 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs transition-all flex items-center gap-2 shadow-sm shadow-amber-200 disabled:opacity-60"
              >
                {isResetting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <Zap size={14} />
                    Bagi HPP ({selectedCount})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ===================== SYNC AVG PO = HPP CONFIRMATION MODAL ===================== */}
      {showSyncAvgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-indigo-100 rounded-2xl shrink-0">
                <Sparkles size={22} className="text-indigo-700" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Inisialisasi Saldo Awal Baseline AVG PO</h3>
                <p className="text-xs text-slate-500 font-bold mt-1">
                  Menyamakan nilai AVG PO dengan nilai HPP aktif produk saat ini sebagai titik awal perhitungan Moving Average.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-600">Total Produk Dipilih</span>
                <span className="font-black text-slate-900">{selectedCount} produk</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-600">Status Belum Ada PO</span>
                <span className="font-black text-indigo-700">{selectedWithoutAvg.length} produk</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-600">Produk Berselisih (Drift)</span>
                <span className="font-black text-amber-700">{selectedWithDrift.length} produk</span>
              </div>
            </div>

            <div className="p-3.5 bg-indigo-50/70 rounded-2xl border border-indigo-200/80 space-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-indigo-600 shrink-0" />
                <span className="text-xs font-black text-indigo-950">Logika Profesional Saldo Awal:</span>
              </div>
              <ul className="text-[11px] text-indigo-900 space-y-1 font-medium list-disc list-inside pl-0.5">
                <li>
                  <span className="font-bold">Mulai Bersih:</span> Produk tanpa riwayat PO akan dibuatkan dokumen faktur resmi Saldo Awal (<span className="font-mono text-[10px] font-bold">SALDO AWAL (BASELINE HPP)</span>).
                </li>
                <li>
                  <span className="font-bold">Menghilangkan Selisih:</span> Nilai AVG PO riwayat disinkronkan dengan HPP aktif agar tidak terjadi selisih minus/plus merah.
                </li>
                <li>
                  <span className="font-bold">Akurat Ke Depan:</span> Setiap PO baru yang diterima setelah ini akan langsung memperhitungkan Moving Average secara proporsional.
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowSyncAvgModal(false)}
                disabled={isResetting}
                className="px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleConfirmSyncAvgPo()}
                disabled={isResetting || selectedCount === 0}
                className="px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition-all flex items-center gap-2 shadow-sm shadow-indigo-200 disabled:opacity-60"
              >
                {isResetting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Memproses Inisialisasi...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    Mulai Inisialisasi AVG ({selectedCount})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== RESET AVG DARI STOK TERKINI MODAL ===================== */}
      {showResetStockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-violet-100 rounded-2xl shrink-0">
                <RefreshCw size={22} className="text-violet-700" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Reset AVG dari Stok Terkini</h3>
                <p className="text-xs text-slate-500 font-bold mt-1">
                  Khusus untuk produk yang pernah habis (stok = 0). Riwayat PO lama dihapus & AVG dihitung ulang dari stok aktual × HPP saat ini.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-600">Total Produk Dipilih</span>
                <span className="font-black text-slate-900">{selectedCount} produk</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-600">Telah Memiliki Data AVG PO</span>
                <span className="font-black text-amber-700">{selectedWithAvg.length} produk (riwayat lama akan dihapus)</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-600">Belum Memiliki AVG PO</span>
                <span className="font-black text-slate-500">{selectedWithoutAvg.length} produk (akan dibuat baru)</span>
              </div>
            </div>

            {/* Penjelasan 3 langkah proses */}
            <div className="p-3.5 bg-violet-50/80 rounded-2xl border border-violet-200/80 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck size={16} className="text-violet-600 shrink-0" />
                <span className="text-xs font-black text-violet-950">Proses yang Akan Dijalankan:</span>
              </div>
              <ol className="text-[11px] text-violet-900 space-y-1.5 font-medium list-decimal list-inside pl-0.5">
                <li>
                  <span className="font-bold">Hapus riwayat PO lama</span> — semua item produk ini di PO lama akan dihapus.
                  PO yang hanya berisi produk ini akan dihapus seluruhnya.
                </li>
                <li>
                  <span className="font-bold">Buat PO Titik Awal baru</span> — dokumen faktur baru
                  <span className="font-mono text-[10px] font-bold mx-1">TITIK AWAL STOK (Setelah Stok Kosong)</span>
                  dibuat dengan <em>qty = stok aktual</em> × <em>HPP aktif</em>.
                </li>
                <li>
                  <span className="font-bold">AVG PO = HPP aktif</span> — selisih merah/drift hilang.
                  PO baru berikutnya akan otomatis dihitung Moving Average secara proporsional.
                </li>
              </ol>
            </div>

            {/* Warning khusus jika produk sudah ada AVG */}
            {selectedWithAvg.length > 0 && (
              <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200 flex items-start gap-2">
                <AlertTriangle size={14} className="text-rose-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-rose-700 font-bold">
                  ⚠️ <span className="font-black">{selectedWithAvg.length} produk</span> sudah memiliki riwayat PO.
                  Riwayat PO lama tersebut akan <span className="underline">dihapus permanen</span> dan digantikan titik awal baru.
                  Pastikan ini memang yang Anda inginkan.
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowResetStockModal(false)}
                disabled={isResetting}
                className="px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmResetFromStock}
                disabled={isResetting || selectedCount === 0}
                className="px-6 py-2.5 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-black text-xs transition-all flex items-center gap-2 shadow-sm shadow-violet-200 disabled:opacity-60"
              >
                {isResetting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Memproses Reset...
                  </>
                ) : (
                  <>
                    <RefreshCw size={14} />
                    Reset AVG dari Stok Terkini ({selectedCount})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
