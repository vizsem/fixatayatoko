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
  Lock, Unlock, Plus, Trash2, Tag, ShieldCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import notify from '@/lib/notify';
import { supabase } from '@/lib/supabase';
import { getUserAndRole } from '@/lib/supabase-helpers';
import { collection, db, getDocs, limit, orderBy, query, addDoc } from '@/lib/firebase';
import { TableSkeleton } from '@/components/admin/InventorySkeleton';
import {
  updateProductPrice,
  getAllProductsAvgHpp,
  resetAvgHppForProducts,
  bulkUpdateTargetMargin,
  bulkDivideHpp,
  toggleLockProductHpp,
  syncAvgPoToActiveHpp,
  resetAvgFromCurrentStock,
} from '@/lib/actions/product.actions';

export interface ProductUnitItem {
  code: string;
  contains: number;
  price?: number;
  minQty?: number;
  label?: string;
}

interface ProductItem {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  unit: string;
  units: ProductUnitItem[];
  isHppLocked: boolean;
  customHpp?: number;
  stock: number;
  costPrice: number;
  priceEcer: number;
  priceGrosir: number;
  minGrosir: number;
  isActive: boolean;
  satuanModal?: string;
  marginRp: number;
  marginPct: number;
  inventoryValue: number;
  potentialRevenue: number;
  potentialProfit: number;
}

interface AvgHppInfo {
  avgCost: number;
  totalQty: number;
  poCount: number;
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

export default function PricingHPPPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [avgLoading, setAvgLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'catalog' | 'history'>('catalog');
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [avgHppMap, setAvgHppMap] = useState<Record<string, AvgHppInfo>>({});
  const [costLogs, setCostLogs] = useState<CostPriceLog[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  // Filter States
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [marginFilter, setMarginFilter] = useState<'ALL' | 'HEALTHY' | 'SLIM' | 'CRITICAL' | 'NEGATIVE'>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'marginPct_desc' | 'marginPct_asc' | 'cost_desc' | 'price_desc' | 'stock_desc' | 'avg_diff'>('name');

  // Multi-select States
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showResetModal, setShowResetModal] = useState(false);
  const [skipLockedHpp, setSkipLockedHpp] = useState(true); // Default true: Lindungi produk yang sudah diset manual!
  const [showMarginModal, setShowMarginModal] = useState(false);
  const [marginType, setMarginType] = useState<'PERCENT' | 'NOMINAL'>('PERCENT');
  const [targetMarginValue, setTargetMarginValue] = useState<number>(20);
  const [marginUnitTarget, setMarginUnitTarget] = useState<string>('BASE_ONLY');
  const [showDivideModal, setShowDivideModal] = useState(false);
  const [showSyncAvgModal, setShowSyncAvgModal] = useState(false);
  const [showResetStockModal, setShowResetStockModal] = useState(false);
  const [divideValue, setDivideValue] = useState<number>(1);
  const [isResetting, startResetTransition] = useTransition();

  // Quick Edit Modal
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [editModalCost, setEditModalCost] = useState<number>(0);
  const [editPriceEcer, setEditPriceEcer] = useState<number>(0);
  const [editPriceGrosir, setEditPriceGrosir] = useState<number>(0);
  const [editMinGrosir, setEditMinGrosir] = useState<number>(1);
  const [editUnits, setEditUnits] = useState<ProductUnitItem[]>([]);
  const [editIsHppLocked, setEditIsHppLocked] = useState<boolean>(false);
  const [savingEdit, setSavingEdit] = useState(false);

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
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .or('is_active.eq.true,is_active.is.null')
        .order('name', { ascending: true })
        .limit(1000);

      if (error) throw error;

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

        // Parse list semua satuan produk
        let unitsList: ProductUnitItem[] = [];
        if (Array.isArray(raw.units) && raw.units.length > 0) {
          unitsList = raw.units.map((u: any) => ({
            code: String(u.code || u.unit || '').trim().toUpperCase(),
            contains: Number(u.contains || (String(u.code || u.unit || '').toUpperCase() === baseUnit ? 1 : 1)),
            price: typeof u.price === 'number' ? u.price : Number(u.price || 0),
            minQty: typeof u.minQty === 'number' ? u.minQty : undefined,
            label: u.label || '',
          })).filter((u: any) => Boolean(u.code));
        }

        // Pastikan base unit selalu ada di list
        const baseUnitIdx = unitsList.findIndex(u => u.code === baseUnit);
        if (baseUnitIdx === -1) {
          unitsList.unshift({
            code: baseUnit,
            contains: 1,
            price: ecer,
          });
        } else {
          // Sinkronkan harga ecer untuk base unit jika di units belum ada harga
          if (!unitsList[baseUnitIdx].price) {
            unitsList[baseUnitIdx].price = ecer;
          }
        }

        const isHppLocked = Boolean(raw.isHppLocked);

        return {
          id: p.id,
          name: p.name || raw.Nama || 'Tanpa Nama',
          sku: p.sku || raw.ID || p.id,
          barcode: p.barcode || raw.Barcode || '',
          category: p.category || raw.Kategori || 'UMUM',
          unit: baseUnit,
          units: unitsList,
          isHppLocked,
          customHpp: typeof raw.customHpp === 'number' ? raw.customHpp : cost,
          stock: stk,
          costPrice: cost,
          priceEcer: ecer,
          priceGrosir: grosir,
          minGrosir: minG,
          isActive: p.is_active !== false,
          satuanModal: raw.Satuan_Modal || raw.Satuan || p.unit || 'PCS',
          marginRp,
          marginPct,
          inventoryValue: invVal,
          potentialRevenue: potRev,
          potentialProfit: potProf,
        };
      });

      setProducts(rawItems);
      setSelectedIds(new Set()); // reset selection on reload

      // Collect categories
      const cats = Array.from(new Set(rawItems.map(p => p.category))).filter(Boolean) as string[];
      setCategories(cats.sort());

      // Fetch cost / price change history
      try {
        const qLogs = query(collection(db, 'product_cost_logs'), orderBy('changeDate', 'desc'), limit(150));
        const logSnap = await getDocs(qLogs);
        const logs = logSnap.docs.map(d => ({ id: d.id, ...d.data() } as CostPriceLog));
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
  }, []);

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

    products.forEach(p => {
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
    });

    const avgMarginPct = validMarginCount > 0 ? totalMarginPctSum / validMarginCount : 0;

    return {
      totalCount,
      totalStockValue,
      totalPotentialRevenue,
      totalPotentialProfit,
      avgMarginPct,
      avgDriftCount,
    };
  }, [products, avgHppMap]);

  // Filtered & Sorted Products
  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim();
    return products
      .filter(p => {
        const matchSearch = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q);
        const matchCat = selectedCategory === 'ALL' || p.category === selectedCategory;

        let matchMargin = true;
        if (marginFilter === 'HEALTHY') matchMargin = p.marginPct >= 20;
        else if (marginFilter === 'SLIM') matchMargin = p.marginPct >= 8 && p.marginPct < 20;
        else if (marginFilter === 'CRITICAL') matchMargin = p.marginPct > 0 && p.marginPct < 8;
        else if (marginFilter === 'NEGATIVE') matchMargin = p.marginPct <= 0;

        return matchSearch && matchCat && matchMargin;
      })
      .sort((a, b) => {
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
  }, [products, search, selectedCategory, marginFilter, sortBy, avgHppMap]);

  // Multi-select helpers
  const allFilteredIds = useMemo(() => filteredProducts.map(p => p.id), [filteredProducts]);
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
    setShowMarginModal(true);
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
            marginType,
            targetUnitMode: marginUnitTarget,
          }
        );

        setShowMarginModal(false);

        if (!result.success) throw new Error(result.error);

        notify.success(
          `✅ Berhasil menyesuaikan harga untuk ${result.updated} produk (${
            marginType === 'NOMINAL' ? `+Rp ${targetMarginValue.toLocaleString('id-ID')}` : `${targetMarginValue}%`
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

  // Open Quick Edit
  const handleOpenEdit = (p: ProductItem) => {
    setEditingProduct(p);
    setEditModalCost(p.costPrice);
    setEditPriceEcer(p.priceEcer);
    setEditPriceGrosir(p.priceGrosir);
    setEditMinGrosir(p.minGrosir);
    setEditIsHppLocked(Boolean(p.isHppLocked));

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
      const newGrosir = Number(editPriceGrosir || 0);
      const newMinGrosir = Number(editMinGrosir || 1);

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
        newGrosir,
        newMinGrosir,
        units: syncedUnits,
        isHppLocked: editIsHppLocked,
      });

      if (!result.success) throw new Error(result.error || 'Gagal menyimpan');

      const hasCostChanged = oldCost !== newCost;
      const hasPriceChanged = oldPrice !== newPrice;
      if (hasCostChanged || hasPriceChanged) {
        try {
          await addDoc(collection(db, 'product_cost_logs'), {
            productId: editingProduct.id,
            productName: editingProduct.name,
            oldCost,
            newCost,
            oldPrice,
            newPrice,
            adminEmail,
            changeDate: new Date(),
            notes: editIsHppLocked
              ? 'Update harga & kunci HPP'
              : (hasCostChanged && hasPriceChanged
                  ? 'Update cepat modal & harga jual'
                  : (hasCostChanged ? 'Update cepat harga modal' : 'Update cepat harga jual ecer')),
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
        'Satuan': p.unit,
        'Stok': p.stock,
        'HPP Aktif (Rp)': p.costPrice,
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

  return (
    <div className="p-4 md:p-8 bg-[#F8FAFC] min-h-screen pb-32">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/admin/products" className="text-slate-400 hover:text-slate-800 transition-colors p-1.5 hover:bg-slate-100 rounded-xl">
                <ArrowLeft size={18} />
              </Link>
              <span className="text-xs font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                Katalog & Keuangan
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <DollarSign className="text-emerald-600" />
              Struktur HPP, Harga & Margin Produk
            </h1>
            <p className="text-xs md:text-sm text-slate-400 font-bold mt-1">
              Pantau HPP aktif vs AVG dari riwayat PO, harga jual, persentase keuntungan, dan riwayat fluktuasi harga.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => { fetchData(); fetchAvgHpp(); }}
              disabled={loading}
              className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl border border-slate-200 text-xs font-black transition-all flex items-center gap-2"
              title="Refresh Data"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={handleExportExcel}
              disabled={filteredProducts.length === 0}
              className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm shadow-emerald-200"
            >
              <Download size={16} />
              Export Excel
            </button>
          </div>
        </div>

        {/* METRICS CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-blue-600">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">Produk Aktif</span>
              <div className="p-2 bg-blue-50 rounded-xl"><Package size={18} /></div>
            </div>
            <p className="text-2xl md:text-3xl font-black text-slate-900">{kpis.totalCount}</p>
            <p className="text-xs font-bold text-slate-400">Siap dijual</p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-indigo-600">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">Rata-rata Margin</span>
              <div className="p-2 bg-indigo-50 rounded-xl"><Percent size={18} /></div>
            </div>
            <p className={`text-2xl md:text-3xl font-black ${kpis.avgMarginPct >= 15 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {kpis.avgMarginPct.toFixed(1)}%
            </p>
            <p className="text-xs font-bold text-slate-400">Rata-rata laba kotor</p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-rose-600">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">Total Modal Stok</span>
              <div className="p-2 bg-rose-50 rounded-xl"><Layers size={18} /></div>
            </div>
            <p className="text-lg md:text-xl font-black text-slate-900">
              Rp {kpis.totalStockValue.toLocaleString('id-ID')}
            </p>
            <p className="text-xs font-bold text-slate-400">Nilai aset stok aktif</p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-emerald-600">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">Potensi Laba Kotor</span>
              <div className="p-2 bg-emerald-50 rounded-xl"><TrendingUp size={18} /></div>
            </div>
            <p className="text-lg md:text-xl font-black text-emerald-600">
              +Rp {kpis.totalPotentialProfit.toLocaleString('id-ID')}
            </p>
            <p className="text-xs font-bold text-slate-400">Estimasi profit jika laku</p>
          </div>

          <div className={`p-5 rounded-3xl border shadow-sm space-y-2 ${kpis.avgDriftCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100'}`}>
            <div className={`flex items-center justify-between ${kpis.avgDriftCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">Drift AVG HPP</span>
              <div className={`p-2 rounded-xl ${kpis.avgDriftCount > 0 ? 'bg-amber-100' : 'bg-emerald-50'}`}>
                <AlertTriangle size={18} />
              </div>
            </div>
            <p className={`text-2xl md:text-3xl font-black ${kpis.avgDriftCount > 0 ? 'text-amber-700' : 'text-emerald-600'}`}>
              {avgLoading ? '...' : kpis.avgDriftCount}
            </p>
            <p className="text-xs font-bold text-slate-400">Produk HPP ≠ AVG PO</p>
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
            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama barang, SKU, atau barcode..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">Semua Kategori</option>
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <select
                  value={marginFilter}
                  onChange={e => setMarginFilter(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">Semua Margin</option>
                  <option value="HEALTHY">🟢 Margin Sehat (≥ 20%)</option>
                  <option value="SLIM">🟡 Margin Sedang (8 - 19%)</option>
                  <option value="CRITICAL">🟠 Margin Tipis (1 - 7%)</option>
                  <option value="NEGATIVE">🔴 Margin Nol / Rugi (≤ 0%)</option>
                </select>

                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="name">Urut: Nama (A-Z)</option>
                  <option value="marginPct_desc">Urut: Margin Tertinggi (%)</option>
                  <option value="marginPct_asc">Urut: Margin Terendah (%)</option>
                  <option value="cost_desc">Urut: Modal Terbesar (HPP)</option>
                  <option value="price_desc">Urut: Harga Jual Termahal</option>
                  <option value="stock_desc">Urut: Stok Terbanyak</option>
                  <option value="avg_diff">Urut: Selisih AVG Terbesar</option>
                </select>
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
                    title="Restart AVG dengan perlindungan data manual"
                  >
                    <RotateCcw size={13} />
                    Restart AVG ({selectedWithAvg.length})
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
                    Set Margin
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
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-400 uppercase tracking-widest font-black">
                        {/* Checkbox Column */}
                        <th className="py-4 pl-6 pr-2">
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
                        <th className="py-4 px-4">Produk & SKU</th>
                        <th className="py-4 px-4 text-center">Stok & Satuan Terdaftar</th>
                        <th className="py-4 px-4 text-right">HPP Aktif (Modal)</th>
                        <th className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Sparkles size={12} className="text-amber-500" />
                            AVG HPP (PO)
                          </div>
                        </th>
                        <th className="py-4 px-4 text-right">Harga Jual (Ecer)</th>
                        <th className="py-4 px-4 text-right">Margin (Rp / %)</th>
                        <th className="py-4 px-4 text-right">Grosir / Min Qty</th>
                        <th className="py-4 px-6 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredProducts.map(p => {
                        const isHealthy = p.marginPct >= 20;
                        const isSlim = p.marginPct >= 8 && p.marginPct < 20;
                        const isLoss = p.marginPct <= 0;
                        const avg = avgHppMap[p.id];
                        const avgDiff = avg ? avg.avgCost - p.costPrice : null;
                        const hasDrift = avg && avg.avgCost > 0 && Math.abs(avgDiff!) > 100;
                        const isSelected = selectedIds.has(p.id);

                        return (
                          <tr
                            key={p.id}
                            className={`hover:bg-slate-50/60 transition-colors group ${isSelected ? 'bg-blue-50/40' : ''}`}
                          >
                            {/* Checkbox */}
                            <td className="py-4 pl-6 pr-2">
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
                            <td className="py-4 px-4">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <Link
                                    href={`/admin/products/edit/${p.id}`}
                                    className="font-black text-slate-900 hover:text-blue-600 transition-colors uppercase line-clamp-1"
                                  >
                                    {p.name}
                                  </Link>
                                  {p.isHppLocked && (
                                    <span
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-blue-100 text-blue-700 shrink-0"
                                      title="HPP produk ini dikunci/diset manual (aman dari Restart AVG)"
                                    >
                                      <Lock size={10} />
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-slate-400 font-mono text-[10px]">
                                  <span>SKU: {p.sku}</span>
                                  {p.barcode && <span>• {p.barcode}</span>}
                                  <span className="bg-slate-100 px-1.5 py-0.5 rounded font-sans text-slate-500 font-bold">{p.category}</span>
                                </div>
                              </div>
                            </td>

                            {/* Stok & Semua Satuan Produk yang Diset */}
                            <td className="py-4 px-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <span className="font-black text-slate-800 text-sm">{p.stock}</span>
                                <span className="text-[10px] text-slate-400 font-bold uppercase">{p.unit}</span>
                              </div>

                              {/* Daftar semua satuan yang telah diset */}
                              <div className="flex flex-wrap gap-1 mt-1 justify-center max-w-[210px] mx-auto">
                                {p.units.map(u => {
                                  const isBase = u.code === p.unit;
                                  return (
                                    <span
                                      key={u.code}
                                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[9px] font-black ${
                                        isBase
                                          ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                          : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                      }`}
                                      title={`${u.code} (isi ${u.contains} ${p.unit}) · Harga Jual: Rp ${(u.price || 0).toLocaleString('id-ID')}`}
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
                            </td>

                            {/* Modal HPP Aktif & Lock Status */}
                            <td className="py-4 px-4 text-right">
                              <p className="font-black text-slate-900 text-sm">Rp {p.costPrice.toLocaleString('id-ID')}</p>
                              <div className="flex items-center justify-end gap-1 mt-0.5">
                                {p.isHppLocked ? (
                                  <span
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-blue-50 text-blue-700 border border-blue-200"
                                    title="HPP diset manual & terkunci. Tidak akan hilang saat Restart AVG"
                                  >
                                    <Lock size={9} />
                                    Terkunci
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-bold">/{p.unit}</span>
                                )}
                              </div>
                            </td>

                            {/* AVG HPP dari PO */}
                            <td className="py-4 px-4 text-right">
                              {avgLoading ? (
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

                            {/* Harga Jual Ecer */}
                            <td className="py-4 px-4 text-right font-black text-blue-700">
                              <p className="text-sm">Rp {p.priceEcer.toLocaleString('id-ID')}</p>
                              <p className="text-[10px] text-slate-400 font-bold">/{p.unit}</p>
                            </td>

                            {/* Margin Keuntungan */}
                            <td className="py-4 px-4 text-right">
                              <div className="flex flex-col items-end">
                                <span className={`font-black ${isLoss ? 'text-rose-600' : isSlim ? 'text-amber-600' : 'text-emerald-600'}`}>
                                  {p.marginRp >= 0 ? '+' : ''}Rp {p.marginRp.toLocaleString('id-ID')}
                                </span>
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                  isLoss ? 'bg-rose-50 text-rose-600' : isSlim ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                                }`}>
                                  {p.marginPct.toFixed(1)}%
                                </span>
                              </div>
                            </td>

                            {/* Harga Grosir */}
                            <td className="py-4 px-4 text-right">
                              {p.priceGrosir > 0 ? (
                                <div>
                                  <p className="font-black text-purple-700">Rp {p.priceGrosir.toLocaleString('id-ID')}</p>
                                  <p className="text-[10px] text-slate-400 font-bold">Min: {p.minGrosir} {p.unit}</p>
                                </div>
                              ) : (
                                <span className="text-slate-300 font-bold">-</span>
                              )}
                            </td>

                            {/* Aksi */}
                            <td className="py-4 px-6 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleOpenEdit(p)}
                                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-black text-xs transition-colors flex items-center gap-1"
                                  title="Ubah HPP, harga ecer, dan semua satuan produk"
                                >
                                  <Edit3 size={13} />
                                  Ubah
                                </button>
                                <Link
                                  href={`/admin/products/edit/${p.id}`}
                                  className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-xl transition-colors"
                                  title="Edit Lengkap"
                                >
                                  <ChevronRight size={15} />
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
                  <p className="text-xs font-bold text-slate-400">
                    Menampilkan <span className="text-slate-700">{filteredProducts.length}</span> dari <span className="text-slate-700">{products.length}</span> produk aktif
                  </p>
                  {selectedCount > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleResetAvgHpp}
                        disabled={selectedWithAvg.length === 0}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all disabled:opacity-50"
                      >
                        <RotateCcw size={13} />
                        Restart AVG HPP
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
                        Set Margin
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
                          <td className="py-3.5 px-4 font-black text-slate-800 uppercase">{l.productName || l.productId}</td>
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
                <h3 className="text-lg font-black text-slate-900 mt-1 uppercase line-clamp-1">
                  {editingProduct.name}
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
            </div>

            {/* SECTION DAFTAR SATUAN & HARGA MULTI-SATUAN */}
            <div className="space-y-3 pt-1 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers size={16} className="text-indigo-600" />
                  <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                    Satuan Produk & Harga Jual ({editUnits.length} Satuan)
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddUnitRow(!showAddUnitRow)}
                  className="text-xs font-black text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 px-2.5 py-1 rounded-xl transition-colors"
                >
                  <Plus size={13} />
                  {showAddUnitRow ? 'Batal Tambah' : 'Tambah Satuan'}
                </button>
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
                            price: newUnitPrice > 0 ? newUnitPrice : Math.ceil((editModalCost * newUnitContains * 1.2) / 100) * 100,
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

                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-2xl border transition-all space-y-2 ${
                        isBase
                          ? 'bg-blue-50/40 border-blue-200'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-black uppercase ${
                            isBase ? 'bg-blue-600 text-white' : 'bg-slate-800 text-white'
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
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <button
                              type="button"
                              onClick={() => {
                                const targetPrice = Math.ceil((unitCost / 0.8) / 100) * 100;
                                if (isBase) setEditPriceEcer(targetPrice);
                                setEditUnits(prev => {
                                  const next = [...prev];
                                  next[idx] = { ...next[idx], price: targetPrice };
                                  return next;
                                });
                              }}
                              className="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-[9px] font-black transition-colors"
                              title="Terapkan margin 20%"
                            >
                              20%
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const targetPrice = Math.ceil((unitCost / 0.85) / 100) * 100;
                                if (isBase) setEditPriceEcer(targetPrice);
                                setEditUnits(prev => {
                                  const next = [...prev];
                                  next[idx] = { ...next[idx], price: targetPrice };
                                  return next;
                                });
                              }}
                              className="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-[9px] font-black transition-colors"
                              title="Terapkan margin 15%"
                            >
                              15%
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* HARGA GROSIR (OPSIONAL) */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-slate-400">Harga Grosir (Opsional)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">Rp</span>
                  <input
                    type="number"
                    min="0"
                    value={editPriceGrosir}
                    onChange={e => setEditPriceGrosir(Number(e.target.value))}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-slate-400">Min. Qty Grosir ({editingProduct.unit})</label>
                <input
                  type="number"
                  min="1"
                  value={editMinGrosir}
                  onChange={e => setEditMinGrosir(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
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
                <h3 className="text-lg font-black text-slate-900">Restart AVG HPP dari PO</h3>
                <p className="text-xs text-slate-500 font-bold mt-1">
                  Sinkronisasi HPP aktif dengan rata-rata harga beli faktur riwayat PO.
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

      {/* ===================== SET MARGIN OTOMATIS MODAL ===================== */}
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

              {/* Pilihan Jenis Margin: Persentase vs Nominal */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-slate-500">Pilihan Jenis Margin</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-200/70 p-1 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => {
                      setMarginType('PERCENT');
                      if (targetMarginValue > 100) setTargetMarginValue(20);
                    }}
                    className={`py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                      marginType === 'PERCENT'
                        ? 'bg-white text-emerald-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Percent size={13} />
                    Persentase (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMarginType('NOMINAL');
                      if (targetMarginValue < 100) setTargetMarginValue(5000);
                    }}
                    className={`py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                      marginType === 'NOMINAL'
                        ? 'bg-white text-emerald-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <DollarSign size={13} />
                    Nominal (Rp)
                  </button>
                </div>
              </div>
              
              {/* Input Nilai Margin */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-slate-500">
                  {marginType === 'PERCENT' ? 'Target Persentase Laba' : 'Tambahan Margin Nominal'}
                </label>
                <div className="relative">
                  {marginType === 'NOMINAL' && (
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">Rp</span>
                  )}
                  <input
                    type="number"
                    min="1"
                    value={targetMarginValue}
                    onChange={e => setTargetMarginValue(Number(e.target.value))}
                    className={`w-full py-3 bg-white border border-slate-300 rounded-2xl font-black text-lg text-emerald-700 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none ${
                      marginType === 'NOMINAL' ? 'pl-11 pr-4' : 'pl-4 pr-10'
                    }`}
                  />
                  {marginType === 'PERCENT' && (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-lg">%</span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 font-bold mt-1 text-right">
                  {marginType === 'PERCENT'
                    ? 'Rumus: Harga Baru = HPP / (1 - Margin%)'
                    : 'Rumus: Harga Baru = HPP + Nominal Margin'}
                </p>
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
