'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  Layers,
  Plus,
  Trash2,
  Edit2,
  Check,
  Sparkles,
  RefreshCw,
  Sliders,
  DollarSign,
  Package,
  Barcode as BarcodeIcon,
  ExternalLink,
  Tag,
  Copy,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import notify from '@/lib/notify';
import {
  getProductVariantsAction,
  batchAddVariantsAction,
  quickUpdateVariantAction,
  syncVariantUnitsFromParentAction,
  deleteProduct,
  type ProductVariantItem,
} from '@/lib/actions/product.actions';

export interface QuickVariantModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: string;
    name: string;
    sku?: string;
    barcode?: string;
    category?: string;
    unit?: string;
    units?: Array<{ code: string; contains?: number; price?: number; label?: string }>;
    price?: number;
    priceEcer?: number;
    costPrice?: number;
    purchasePrice?: number;
    stock?: number;
    imageUrl?: string;
    image_url?: string;
  } | null;
  onSuccess?: () => void;
}

interface VariantOption {
  id: string;
  name: string; // e.g. "Warna", "Ukuran", "Rasa"
  values: string[]; // e.g. ["Merah", "Biru"]
}

interface GeneratedVariantRow {
  key: string;
  name: string;
  sku: string;
  barcode: string;
  costPrice: number;
  sellPrice: number;
  wholesalePrice: number;
  stock: number;
}

export default function QuickVariantModal({
  isOpen,
  onClose,
  product,
  onSuccess,
}: QuickVariantModalProps) {
  const [activeTab, setActiveTab] = useState<'list' | 'single' | 'matrix'>('list');
  const [loading, setLoading] = useState(false);
  const [variants, setVariants] = useState<ProductVariantItem[]>([]);
  const [refreshingList, setRefreshingList] = useState(false);

  // Single Add Form State
  const [singleName, setSingleName] = useState('');
  const [singleSku, setSingleSku] = useState('');
  const [singleBarcode, setSingleBarcode] = useState('');
  const [singleCostPrice, setSingleCostPrice] = useState<number>(0);
  const [singleSellPrice, setSingleSellPrice] = useState<number>(0);
  const [singleWholesalePrice, setSingleWholesalePrice] = useState<number>(0);
  const [singleStock, setSingleStock] = useState<number>(0);
  const [submittingSingle, setSubmittingSingle] = useState(false);

  // Matrix Generator State
  const [options, setOptions] = useState<VariantOption[]>([
    { id: 'opt_1', name: 'Warna', values: [] },
  ]);
  const [tagInputs, setTagInputs] = useState<Record<string, string>>({});
  const [generatedRows, setGeneratedRows] = useState<GeneratedVariantRow[]>([]);
  const [bulkCost, setBulkCost] = useState<string>('');
  const [bulkSell, setBulkSell] = useState<string>('');
  const [bulkWholesale, setBulkWholesale] = useState<string>('');
  const [bulkStock, setBulkStock] = useState<string>('');
  const [submittingBatch, setSubmittingBatch] = useState(false);

  // Inline Editing State (in List Tab)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    price: number;
    costPrice: number;
    stock: number;
    barcode: string;
  }>({ price: 0, costPrice: 0, stock: 0, barcode: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [syncingUnits, setSyncingUnits] = useState(false);

  const parentUnits = useMemo(() => {
    return Array.isArray(product?.units) && product.units.length > 0 ? product.units : [];
  }, [product?.units]);

  const handleSyncUnitsToAllVariants = async () => {
    if (!product?.id) return;
    if (!confirm(`Salin satuan bertingkat (${parentUnits.map(u => u.code).join(', ')}) dari produk induk ke seluruh varian?`)) {
      return;
    }
    setSyncingUnits(true);
    try {
      const res = await syncVariantUnitsFromParentAction(product.id);
      if (res.success) {
        notify.admin.success(`Sukses! Satuan bertingkat berhasil disalin ke ${res.updatedCount || variants.length} varian.`);
        await loadVariants();
        onSuccess?.();
      } else {
        notify.admin.error(res.error || 'Gagal menyinkronkan satuan varian');
      }
    } catch (err: any) {
      notify.admin.error('Gagal: ' + (err.message || 'Error'));
    } finally {
      setSyncingUnits(false);
    }
  };

  const parentName = product?.name || '';
  const parentSku = product?.sku || product?.id || 'PROD';
  const parentCost = Number(product?.costPrice ?? product?.purchasePrice ?? 0);
  const parentSell = Number(product?.priceEcer ?? product?.price ?? 0);

  // Fetch Variants
  const loadVariants = useCallback(async () => {
    if (!product?.id) return;
    setRefreshingList(true);
    try {
      const res = await getProductVariantsAction(product.id);
      if (res.success && res.variants) {
        setVariants(res.variants);
      } else if (res.error) {
        notify.admin.error(res.error);
      }
    } catch (err: any) {
      notify.admin.error('Gagal memuat varian: ' + (err.message || 'Error'));
    } finally {
      setRefreshingList(false);
    }
  }, [product?.id]);

  useEffect(() => {
    if (isOpen && product?.id) {
      loadVariants();
      // Initialize single add defaults from parent
      setSingleCostPrice(parentCost);
      setSingleSellPrice(parentSell);
      setSingleWholesalePrice(parentSell);
      setSingleStock(0);
      setSingleName('');
      setSingleSku('');
      setSingleBarcode('');

      // Initialize bulk defaults from parent
      setBulkCost(parentCost > 0 ? String(parentCost) : '');
      setBulkSell(parentSell > 0 ? String(parentSell) : '');
      setBulkWholesale(parentSell > 0 ? String(parentSell) : '');
      setBulkStock('10');
    }
  }, [isOpen, product?.id, loadVariants, parentCost, parentSell]);

  // Handle single SKU generation preview
  const handleSingleNameChange = (val: string) => {
    setSingleName(val);
    if (!singleSku || singleSku.startsWith(`${parentSku}-`)) {
      const clean = val.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
      setSingleSku(clean ? `${parentSku}-${clean}` : '');
    }
  };

  // Submit Single Add
  const handleSaveSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product?.id) return;
    if (!singleName.trim()) {
      notify.admin.error('Nama varian wajib diisi!');
      return;
    }

    setSubmittingSingle(true);
    try {
      const res = await batchAddVariantsAction({
        parentId: product.id,
        variants: [
          {
            name: singleName.trim(),
            sku: singleSku.trim() || undefined,
            barcode: singleBarcode.trim() || undefined,
            costPrice: Number(singleCostPrice) || 0,
            sellPrice: Number(singleSellPrice) || 0,
            wholesalePrice: Number(singleWholesalePrice) || Number(singleSellPrice) || 0,
            stock: Number(singleStock) || 0,
          },
        ],
      });

      if (res.success) {
        notify.admin.success(`Varian "${singleName}" berhasil ditambahkan!`);
        setSingleName('');
        setSingleSku('');
        setSingleBarcode('');
        await loadVariants();
        setActiveTab('list');
        onSuccess?.();
      } else {
        notify.admin.error(res.error || 'Gagal menyimpan varian');
      }
    } catch (err: any) {
      notify.admin.error('Terjadi kesalahan: ' + (err.message || 'Error'));
    } finally {
      setSubmittingSingle(false);
    }
  };

  // Matrix Option Handlers
  const addOptionDimension = () => {
    if (options.length >= 3) {
      notify.admin.warning('Maksimal 3 jenis opsi variasi');
      return;
    }
    const nextName = options.length === 1 ? 'Ukuran' : 'Tipe';
    setOptions((prev) => [
      ...prev,
      { id: `opt_${Date.now()}`, name: nextName, values: [] },
    ]);
  };

  const removeOptionDimension = (id: string) => {
    setOptions((prev) => prev.filter((o) => o.id !== id));
  };

  const addTagValue = (optId: string) => {
    const raw = (tagInputs[optId] || '').trim();
    if (!raw) return;

    // Support split by comma
    const newItems = raw
      .split(/[,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    setOptions((prev) =>
      prev.map((opt) => {
        if (opt.id !== optId) return opt;
        const set = new Set(opt.values);
        for (const item of newItems) {
          set.add(item);
        }
        return { ...opt, values: Array.from(set) };
      })
    );

    setTagInputs((prev) => ({ ...prev, [optId]: '' }));
  };

  const removeTagValue = (optId: string, valueToRemove: string) => {
    setOptions((prev) =>
      prev.map((opt) =>
        opt.id === optId
          ? { ...opt, values: opt.values.filter((v) => v !== valueToRemove) }
          : opt
      )
    );
  };

  // Generate Matrix Cartesian Product
  const generateMatrixCombinations = () => {
    const validOptions = options.filter((o) => o.values.length > 0);
    if (validOptions.length === 0) {
      notify.admin.warning('Isi setidaknya 1 opsi variasi dengan nilai!');
      return;
    }

    // Cartesian product
    const cartesian = (arrays: string[][]): string[][] => {
      return arrays.reduce<string[][]>(
        (acc, curr) => acc.flatMap((c) => curr.map((n) => [...c, n])),
        [[]]
      );
    };

    const valueArrays = validOptions.map((o) => o.values);
    const combinations = cartesian(valueArrays);

    const defaultCost = Number(bulkCost) || parentCost;
    const defaultSell = Number(bulkSell) || parentSell;
    const defaultWholesale = Number(bulkWholesale) || defaultSell;
    const defaultStock = Number(bulkStock) || 0;

    const newRows: GeneratedVariantRow[] = combinations.map((combo, idx) => {
      const variantName = combo.join(' - ');
      const cleanCode = combo
        .map((c) => c.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())
        .join('-');
      const sku = `${parentSku}-${cleanCode || `VAR${idx + 1}`}`;

      return {
        key: `matrix_${idx}_${Date.now()}`,
        name: variantName,
        sku,
        barcode: '',
        costPrice: defaultCost,
        sellPrice: defaultSell,
        wholesalePrice: defaultWholesale,
        stock: defaultStock,
      };
    });

    setGeneratedRows(newRows);
    notify.admin.success(`${newRows.length} kombinasi varian berhasil dibuat!`);
  };

  // Apply Bulk to All Generated Rows
  const applyBulkValues = () => {
    if (generatedRows.length === 0) return;
    const cost = bulkCost !== '' ? Number(bulkCost) : null;
    const sell = bulkSell !== '' ? Number(bulkSell) : null;
    const wholesale = bulkWholesale !== '' ? Number(bulkWholesale) : null;
    const stock = bulkStock !== '' ? Number(bulkStock) : null;

    setGeneratedRows((prev) =>
      prev.map((row) => ({
        ...row,
        costPrice: cost !== null ? cost : row.costPrice,
        sellPrice: sell !== null ? sell : row.sellPrice,
        wholesalePrice: wholesale !== null ? wholesale : row.wholesalePrice,
        stock: stock !== null ? stock : row.stock,
      }))
    );

    notify.admin.success('Nilai berhasil diterapkan ke semua baris kombinasi!');
  };

  // Submit Batch Matrix
  const handleSaveBatch = async () => {
    if (!product?.id) return;
    if (generatedRows.length === 0) {
      notify.admin.warning('Belum ada kombinasi varian yang digenerate');
      return;
    }

    setSubmittingBatch(true);
    try {
      const payload = {
        parentId: product.id,
        variants: generatedRows.map((r) => ({
          name: r.name,
          sku: r.sku,
          barcode: r.barcode || undefined,
          costPrice: r.costPrice,
          sellPrice: r.sellPrice,
          wholesalePrice: r.wholesalePrice,
          stock: r.stock,
        })),
      };

      const res = await batchAddVariantsAction(payload);
      if (res.success) {
        notify.admin.success(
          `Sukses! ${res.insertedCount || generatedRows.length} varian berhasil ditambahkan.`
        );
        setGeneratedRows([]);
        await loadVariants();
        setActiveTab('list');
        onSuccess?.();
      } else {
        notify.admin.error(res.error || 'Gagal menyimpan batch varian');
      }
    } catch (err: any) {
      notify.admin.error('Terjadi kesalahan: ' + (err.message || 'Error'));
    } finally {
      setSubmittingBatch(false);
    }
  };

  // Inline Edit Variant
  const startEditVariant = (v: ProductVariantItem) => {
    setEditingId(v.id);
    setEditForm({
      price: v.price,
      costPrice: v.costPrice,
      stock: v.stock,
      barcode: v.barcode || '',
    });
  };

  const cancelEditVariant = () => {
    setEditingId(null);
  };

  const saveInlineEdit = async (id: string) => {
    setSavingEdit(true);
    try {
      const res = await quickUpdateVariantAction(id, {
        price: editForm.price,
        costPrice: editForm.costPrice,
        stock: editForm.stock,
        barcode: editForm.barcode,
      });

      if (res.success) {
        notify.admin.success('Varian berhasil diperbarui!');
        setEditingId(null);
        await loadVariants();
        onSuccess?.();
      } else {
        notify.admin.error(res.error || 'Gagal memperbarui varian');
      }
    } catch (err: any) {
      notify.admin.error('Terjadi kesalahan: ' + (err.message || 'Error'));
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete Variant
  const handleDeleteVariant = async (v: ProductVariantItem) => {
    if (!confirm(`Yakin ingin menghapus varian "${v.name}"? Data akan dihapus permanen.`)) {
      return;
    }

    setDeletingId(v.id);
    try {
      const res = await deleteProduct(v.id);
      if (res.success) {
        notify.admin.success(`Varian "${v.name}" berhasil dihapus.`);
        await loadVariants();
        onSuccess?.();
      } else {
        notify.admin.error(res.error || 'Gagal menghapus varian');
      }
    } catch (err: any) {
      notify.admin.error('Gagal menghapus: ' + (err.message || 'Error'));
    } finally {
      setDeletingId(null);
    }
  };

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        
        {/* HEADER */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-violet-600/30 border border-violet-500/40 text-violet-300 flex items-center justify-center flex-shrink-0">
              <Layers size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight text-white uppercase truncate">
                  Kelola Varian Produk
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  {variants.length} Varian
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium truncate mt-0.5">
                Produk Induk:{' '}
                <span className="text-slate-200 font-bold">{parentName}</span>{' '}
                <span className="text-slate-400 text-[11px]">({parentSku})</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all ml-2 flex-shrink-0"
            title="Tutup"
          >
            <X size={18} />
          </button>
        </div>

        {/* BANNER SATUAN INDUK & SINKRONISASI */}
        {parentUnits.length > 0 && (
          <div className="px-6 py-2.5 bg-violet-50/80 border-b border-violet-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-violet-950 font-bold flex-wrap">
              <span className="text-violet-600 font-extrabold flex items-center gap-1">
                <Layers size={13} /> Satuan Induk:
              </span>
              <div className="flex items-center gap-1 flex-wrap">
                {parentUnits.map((u: any) => (
                  <span key={u.code} className="px-2 py-0.5 bg-white border border-violet-200 text-violet-800 font-black rounded-lg text-[11px] shadow-xs">
                    1 {u.code} {Number(u.contains || 1) > 1 ? `(${u.contains} ${product?.unit || 'PCS'})` : '(Ecer/Terkecil)'}
                  </span>
                ))}
              </div>
            </div>
            {variants.length > 0 && (
              <button
                type="button"
                onClick={handleSyncUnitsToAllVariants}
                disabled={syncingUnits}
                className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-black text-[11px] shadow-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 flex-shrink-0"
                title="Salin satuan bertingkat (PCS, RTG, CTN, dll) dari produk induk ke seluruh varian"
              >
                <RefreshCw size={12} className={syncingUnits ? "animate-spin" : ""} />
                <span>{syncingUnits ? 'Menyinkronkan...' : 'Salin Satuan Induk ke Semua Varian'}</span>
              </button>
            )}
          </div>
        )}

        {/* TABS NAVIGATION */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 rounded-2xl">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                activeTab === 'list'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers size={14} className={activeTab === 'list' ? 'text-violet-600' : ''} />
              Daftar Varian
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                  activeTab === 'list'
                    ? 'bg-violet-100 text-violet-700 font-bold'
                    : 'bg-slate-300/60 text-slate-600'
                }`}
              >
                {variants.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('single')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                activeTab === 'single'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Plus size={14} className={activeTab === 'single' ? 'text-violet-600' : ''} />
              Tambah Satuan
            </button>

            <button
              onClick={() => setActiveTab('matrix')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                activeTab === 'matrix'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles size={14} className={activeTab === 'matrix' ? 'text-violet-600' : ''} />
              Generator Matriks
              <span className="text-[9px] bg-violet-600 text-white font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                Cepat
              </span>
            </button>
          </div>

          {activeTab === 'list' && (
            <button
              onClick={loadVariants}
              disabled={refreshingList}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-slate-200/50 transition-all"
              title="Segarkan daftar"
            >
              <RefreshCw size={13} className={refreshingList ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">

          {/* TAB 1: DAFTAR VARIAN */}
          {activeTab === 'list' && (
            <div className="space-y-4">
              {refreshingList ? (
                <div className="py-16 text-center text-slate-400">
                  <RefreshCw size={28} className="animate-spin mx-auto mb-3 text-violet-600" />
                  <p className="text-xs font-bold uppercase tracking-wider">Memuat varian...</p>
                </div>
              ) : variants.length === 0 ? (
                <div className="py-16 text-center bg-white rounded-3xl border border-dashed border-slate-200 p-8">
                  <div className="w-16 h-16 rounded-3xl bg-violet-50 text-violet-600 mx-auto flex items-center justify-center mb-4">
                    <Layers size={32} />
                  </div>
                  <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">
                    Belum Ada Varian Produk
                  </h3>
                  <p className="text-xs text-slate-400 font-medium max-w-md mx-auto mt-1 mb-6">
                    Produk ini saat ini berdiri sendiri tanpa varian turunan. Anda bisa menambahkan
                    varian satuan atau membuat kombinasi massal otomatis dengan generator.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      onClick={() => setActiveTab('single')}
                      className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black hover:bg-slate-800 transition-all flex items-center gap-2 shadow-sm"
                    >
                      <Plus size={14} />
                      Tambah Varian Satuan
                    </button>
                    <button
                      onClick={() => setActiveTab('matrix')}
                      className="px-4 py-2.5 bg-violet-600 text-white rounded-xl text-xs font-black hover:bg-violet-700 transition-all flex items-center gap-2 shadow-sm shadow-violet-200"
                    >
                      <Sparkles size={14} />
                      Gunakan Generator Matriks (Shopee / Toko style)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100/80 text-slate-600 border-b border-slate-200 font-black uppercase text-[11px] tracking-wider">
                          <th className="py-3 px-4">Nama Varian</th>
                          <th className="py-3 px-4">SKU / Barcode</th>
                          <th className="py-3 px-4">Modal (HPP)</th>
                          <th className="py-3 px-4">Harga Jual</th>
                          <th className="py-3 px-4 text-center">Stok</th>
                          <th className="py-3 px-4 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {variants.map((v) => {
                          const isEditing = editingId === v.id;

                          return (
                            <tr
                              key={v.id}
                              className={`hover:bg-slate-50/70 transition-colors ${
                                isEditing ? 'bg-violet-50/40' : ''
                              }`}
                            >
                              {/* Nama & Satuan */}
                              <td className="py-3 px-4">
                                <div className="font-black text-slate-800 text-xs">
                                  {v.name}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    ID: {v.id}
                                  </span>
                                  {v.units && v.units.length > 1 ? (
                                    <div className="flex items-center gap-1 flex-wrap">
                                      {v.units.map((u: any) => (
                                        <span key={u.code} className="text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200 px-1.5 py-0.2 rounded">
                                          {u.code} {Number(u.contains || 1) > 1 ? `(${u.contains})` : ''}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded font-medium">
                                      1 Satuan ({v.unit || 'PCS'})
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* SKU & Barcode */}
                              <td className="py-3 px-4">
                                <div className="font-mono text-slate-700 font-bold text-[11px]">
                                  {v.sku}
                                </div>
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editForm.barcode}
                                    onChange={(e) =>
                                      setEditForm({ ...editForm, barcode: e.target.value })
                                    }
                                    placeholder="Barcode"
                                    className="mt-1 w-28 px-2 py-0.5 text-[11px] bg-white border border-slate-300 rounded font-mono focus:border-violet-500 outline-none"
                                  />
                                ) : (
                                  v.barcode && (
                                    <div className="text-[10px] text-slate-400 font-mono">
                                      BC: {v.barcode}
                                    </div>
                                  )
                                )}
                              </td>

                              {/* Modal (HPP) */}
                              <td className="py-3 px-4">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    value={editForm.costPrice}
                                    onChange={(e) =>
                                      setEditForm({
                                        ...editForm,
                                        costPrice: Number(e.target.value) || 0,
                                      })
                                    }
                                    className="w-24 px-2 py-1 text-xs bg-white border border-slate-300 rounded font-bold text-slate-800 focus:border-violet-500 outline-none"
                                  />
                                ) : (
                                  <span className="text-slate-600 font-bold">
                                    Rp {v.costPrice.toLocaleString('id-ID')}
                                  </span>
                                )}
                              </td>

                              {/* Harga Jual */}
                              <td className="py-3 px-4">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    value={editForm.price}
                                    onChange={(e) =>
                                      setEditForm({
                                        ...editForm,
                                        price: Number(e.target.value) || 0,
                                      })
                                    }
                                    className="w-24 px-2 py-1 text-xs bg-white border border-violet-400 rounded font-bold text-violet-700 focus:border-violet-600 outline-none"
                                  />
                                ) : (
                                  <span className="text-slate-900 font-black">
                                    Rp {v.price.toLocaleString('id-ID')}
                                  </span>
                                )}
                              </td>

                              {/* Stok */}
                              <td className="py-3 px-4 text-center">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    value={editForm.stock}
                                    onChange={(e) =>
                                      setEditForm({
                                        ...editForm,
                                        stock: Number(e.target.value) || 0,
                                      })
                                    }
                                    className="w-16 px-2 py-1 text-xs text-center bg-white border border-slate-300 rounded font-bold focus:border-violet-500 outline-none"
                                  />
                                ) : (
                                  <span
                                    className={`px-2.5 py-1 rounded-lg font-black text-xs ${
                                      v.stock > 5
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : v.stock > 0
                                        ? 'bg-amber-50 text-amber-700'
                                        : 'bg-rose-50 text-rose-600'
                                    }`}
                                  >
                                    {v.stock}
                                  </span>
                                )}
                              </td>

                              {/* Aksi */}
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {isEditing ? (
                                    <>
                                      <button
                                        onClick={() => saveInlineEdit(v.id)}
                                        disabled={savingEdit}
                                        className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all"
                                        title="Simpan Perubahan"
                                      >
                                        <Check size={14} />
                                      </button>
                                      <button
                                        onClick={cancelEditVariant}
                                        className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-all"
                                        title="Batal"
                                      >
                                        <X size={14} />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => startEditVariant(v)}
                                        className="p-1.5 hover:bg-violet-50 text-slate-500 hover:text-violet-600 rounded-lg transition-all"
                                        title="Quick Edit Harga & Stok"
                                      >
                                        <Edit2 size={14} />
                                      </button>
                                      <a
                                        href={`/admin/products/edit/${v.id}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-all"
                                        title="Edit Lengkap di Tab Baru"
                                      >
                                        <ExternalLink size={14} />
                                      </a>
                                      <button
                                        onClick={() => handleDeleteVariant(v)}
                                        disabled={deletingId === v.id}
                                        className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-all"
                                        title="Hapus Varian"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TAMBAH SATUAN (SINGLE) */}
          {activeTab === 'single' && (
            <div className="max-w-2xl mx-auto bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
              <div className="mb-6 border-b pb-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <Plus size={16} className="text-violet-600" />
                  Tambah 1 Varian Baru
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Kategori, Brand, Deskripsi, dan Satuan otomatis diwarisi dari produk induk.
                </p>
              </div>

              <form onSubmit={handleSaveSingle} className="space-y-4">
                {/* Nama Varian */}
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 tracking-wider mb-1.5">
                    Nama Varian / Rasa / Ukuran <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Merah, Ukuran XL, Rasa Vanilla"
                    value={singleName}
                    onChange={(e) => handleSingleNameChange(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:border-violet-500 outline-none transition-all"
                  />
                  {singleName && (
                    <p className="text-[11px] text-slate-500 mt-1 font-medium">
                      Nama lengkap produk di sistem:{' '}
                      <span className="font-bold text-violet-700">
                        {parentName} - {singleName}
                      </span>
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* SKU */}
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-700 tracking-wider mb-1.5">
                      SKU Varian (Auto / Kustom)
                    </label>
                    <input
                      type="text"
                      placeholder={`Contoh: ${parentSku}-XL`}
                      value={singleSku}
                      onChange={(e) => setSingleSku(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-violet-500 outline-none uppercase"
                    />
                  </div>

                  {/* Barcode */}
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-700 tracking-wider mb-1.5">
                      Barcode (Opsional)
                    </label>
                    <input
                      type="text"
                      placeholder="Scan atau ketik barcode..."
                      value={singleBarcode}
                      onChange={(e) => setSingleBarcode(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-violet-500 outline-none"
                    />
                  </div>
                </div>

                {/* Harga Modal & Ecer */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-700 tracking-wider mb-1.5">
                      Harga Modal (HPP)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Rp</span>
                      <input
                        type="number"
                        min="0"
                        value={singleCostPrice || ''}
                        onChange={(e) => setSingleCostPrice(Number(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-violet-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-slate-700 tracking-wider mb-1.5">
                      Harga Jual (Ecer) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-violet-600">Rp</span>
                      <input
                        type="number"
                        min="0"
                        required
                        value={singleSellPrice || ''}
                        onChange={(e) => setSingleSellPrice(Number(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-violet-200 rounded-xl text-xs font-black text-violet-900 focus:bg-white focus:border-violet-600 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-slate-700 tracking-wider mb-1.5">
                      Stok Awal
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={singleStock}
                      onChange={(e) => setSingleStock(Number(e.target.value) || 0)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-violet-500 outline-none"
                    />
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-2 border-t mt-6">
                  <button
                    type="button"
                    onClick={() => setActiveTab('list')}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submittingSingle}
                    className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-black tracking-wider uppercase transition-all shadow-md shadow-violet-200 flex items-center gap-2 disabled:opacity-50"
                  >
                    {submittingSingle ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <Check size={14} />
                        Simpan Varian
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: GENERATOR MATRIKS (BATCH) */}
          {activeTab === 'matrix' && (
            <div className="space-y-6">
              
              {/* OPSI VARIASI INPUT */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b pb-4">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                      <Sparkles size={16} className="text-violet-600" />
                      1. Tentukan Opsi & Nilai Variasi
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Contoh: Opsi 1: Warna (Merah, Biru) & Opsi 2: Ukuran (S, M, L).
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={addOptionDimension}
                    className="px-3 py-1.5 bg-violet-50 text-violet-700 hover:bg-violet-100 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all"
                  >
                    <Plus size={13} />
                    + Tambah Opsi Lain
                  </button>
                </div>

                <div className="space-y-4">
                  {options.map((opt, optIdx) => (
                    <div
                      key={opt.id}
                      className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-1 max-w-xs">
                          <span className="text-xs font-black text-slate-400">
                            #{optIdx + 1}
                          </span>
                          <input
                            type="text"
                            value={opt.name}
                            onChange={(e) => {
                              const val = e.target.value;
                              setOptions((prev) =>
                                prev.map((o) => (o.id === opt.id ? { ...o, name: val } : o))
                              );
                            }}
                            placeholder="Nama Opsi (Warna, Ukuran, dll)"
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-800 outline-none focus:border-violet-500"
                          />
                        </div>

                        {options.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeOptionDimension(opt.id)}
                            className="text-slate-400 hover:text-rose-500 p-1"
                            title="Hapus opsi ini"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      {/* Chips Tags */}
                      <div className="flex flex-wrap items-center gap-2">
                        {opt.values.map((val) => (
                          <span
                            key={val}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-violet-100 text-violet-800 font-bold text-xs rounded-xl border border-violet-200"
                          >
                            {val}
                            <button
                              type="button"
                              onClick={() => removeTagValue(opt.id, val)}
                              className="text-violet-500 hover:text-violet-800"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}

                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            placeholder="Ketik & Enter / koma..."
                            value={tagInputs[opt.id] || ''}
                            onChange={(e) =>
                              setTagInputs({ ...tagInputs, [opt.id]: e.target.value })
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ',') {
                                e.preventDefault();
                                addTagValue(opt.id);
                              }
                            }}
                            className="px-3 py-1 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-violet-500 w-36"
                          />
                          <button
                            type="button"
                            onClick={() => addTagValue(opt.id)}
                            className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-black rounded-xl"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Generate Button */}
                <div className="pt-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">
                    Total kombinasi potensial:{' '}
                    <strong className="text-slate-700">
                      {options.reduce(
                        (acc, curr) => acc * (curr.values.length > 0 ? curr.values.length : 1),
                        1
                      )}{' '}
                      varian
                    </strong>
                  </span>

                  <button
                    type="button"
                    onClick={generateMatrixCombinations}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shadow-sm"
                  >
                    <Sparkles size={14} className="text-violet-400" />
                    Generate Tabel Kombinasi
                  </button>
                </div>
              </div>

              {/* TABEL HASIL GENERATE & BULK TOOLBAR */}
              {generatedRows.length > 0 && (
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-600" />
                        2. Review Kombinasi & Terapkan Nilai Massal
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Terapkan harga & stok sekaligus atau ubah nilai spesifik per baris.
                      </p>
                    </div>

                    <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-black text-xs rounded-xl border border-emerald-200 self-start sm:self-auto">
                      {generatedRows.length} Varian Siap Disimpan
                    </span>
                  </div>

                  {/* BULK APPLY BAR */}
                  <div className="p-4 bg-violet-50/70 border border-violet-100 rounded-2xl flex flex-wrap items-center gap-3">
                    <span className="text-xs font-black text-violet-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Sliders size={14} />
                      Isi Massal:
                    </span>

                    <div className="flex items-center gap-2 flex-wrap flex-1">
                      <input
                        type="number"
                        placeholder="Modal (Rp)"
                        value={bulkCost}
                        onChange={(e) => setBulkCost(e.target.value)}
                        className="w-28 px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none focus:border-violet-500"
                      />
                      <input
                        type="number"
                        placeholder="Harga Jual (Rp)"
                        value={bulkSell}
                        onChange={(e) => setBulkSell(e.target.value)}
                        className="w-32 px-3 py-1.5 bg-white border border-violet-300 rounded-xl text-xs font-black text-violet-900 outline-none focus:border-violet-600"
                      />
                      <input
                        type="number"
                        placeholder="Stok"
                        value={bulkStock}
                        onChange={(e) => setBulkStock(e.target.value)}
                        className="w-20 px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none focus:border-violet-500 text-center"
                      />

                      <button
                        type="button"
                        onClick={applyBulkValues}
                        className="px-4 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-black rounded-xl transition-all shadow-sm"
                      >
                        Terapkan ke Semua
                      </button>
                    </div>
                  </div>

                  {/* TABEL PREVIEW MATRIX */}
                  <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-black text-[11px] uppercase tracking-wider">
                          <th className="py-2.5 px-3">Nama Varian</th>
                          <th className="py-2.5 px-3">SKU</th>
                          <th className="py-2.5 px-3">Modal (Rp)</th>
                          <th className="py-2.5 px-3">Harga Jual (Rp)</th>
                          <th className="py-2.5 px-3 text-center">Stok</th>
                          <th className="py-2.5 px-3 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {generatedRows.map((row, idx) => (
                          <tr key={row.key} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3">
                              <input
                                type="text"
                                value={row.name}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setGeneratedRows((prev) =>
                                    prev.map((r, i) => (i === idx ? { ...r, name: val } : r))
                                  );
                                }}
                                className="w-full px-2 py-1 bg-transparent border-b border-dashed border-slate-300 focus:border-violet-500 font-bold text-slate-800 outline-none"
                              />
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                              <input
                                type="text"
                                value={row.sku}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setGeneratedRows((prev) =>
                                    prev.map((r, i) => (i === idx ? { ...r, sku: val } : r))
                                  );
                                }}
                                className="w-28 px-2 py-1 bg-transparent border-b border-dashed border-slate-300 focus:border-violet-500 font-mono text-slate-700 outline-none"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <input
                                type="number"
                                value={row.costPrice}
                                onChange={(e) => {
                                  const val = Number(e.target.value) || 0;
                                  setGeneratedRows((prev) =>
                                    prev.map((r, i) => (i === idx ? { ...r, costPrice: val } : r))
                                  );
                                }}
                                className="w-24 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-800 outline-none"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <input
                                type="number"
                                value={row.sellPrice}
                                onChange={(e) => {
                                  const val = Number(e.target.value) || 0;
                                  setGeneratedRows((prev) =>
                                    prev.map((r, i) => (i === idx ? { ...r, sellPrice: val } : r))
                                  );
                                }}
                                className="w-24 px-2 py-1 bg-violet-50 border border-violet-300 rounded text-xs font-black text-violet-900 outline-none"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="number"
                                value={row.stock}
                                onChange={(e) => {
                                  const val = Number(e.target.value) || 0;
                                  setGeneratedRows((prev) =>
                                    prev.map((r, i) => (i === idx ? { ...r, stock: val } : r))
                                  );
                                }}
                                className="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-center outline-none"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  setGeneratedRows((prev) => prev.filter((_, i) => i !== idx))
                                }
                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                title="Hapus baris ini"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* SUBMIT BUTTON */}
                  <div className="pt-3 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setGeneratedRows([])}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-all"
                    >
                      Reset Kombinasi
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveBatch}
                      disabled={submittingBatch}
                      className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-black tracking-wider uppercase transition-all shadow-md shadow-violet-200 flex items-center gap-2 disabled:opacity-50"
                    >
                      {submittingBatch ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          Menyimpan {generatedRows.length} Varian...
                        </>
                      ) : (
                        <>
                          <Check size={14} />
                          Simpan Semua {generatedRows.length} Varian
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
