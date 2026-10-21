'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Search, Save, Tag, Upload, Download, ChevronRight, Calculator, AlertTriangle, ShieldCheck, Sparkles } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import notify from '@/lib/notify';
import useProducts from '@/lib/hooks/useProducts';
import type { NormalizedProduct } from '@/lib/normalize';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';

import { sbUpdateDoc } from '@/lib/supabase-helpers';

import { applyBulkPriceAdjustment, type BulkPricingMode } from '@/lib/channel-pricing-bulk';
import TikTokImportModal from '@/components/admin/products/TikTokImportModal';
import ShopeeImportModal from '@/components/admin/products/ShopeeImportModal';
type ChannelKey = 'offline' | 'website' | 'shopee' | 'tiktok';

type ChannelPricingState = {
  offline?: number;
  website?: number;
  shopee?: number;
  tiktok?: number;
};

type UnitChannelPricing = Record<string, { price?: number }>;
type Product = NormalizedProduct & {
  channelPricing?: Record<ChannelKey, UnitChannelPricing> | {
    offline?: { price?: number };
    website?: { price?: number };
    shopee?: { price?: number };
    tiktok?: { price?: number };
  };
};

type ExportRow = {
  'Product ID': string;
  'Product Name': string;
  'Unit': string;
  'Offline Price': number | '';
  'Website Price': number | '';
  'Shopee Price': number | '';
  'TikTok Price': number | '';
};

type ImportRow = Partial<ExportRow> & Record<string, unknown>;

export default function ChannelPricingPage() {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showTikTokModal, setShowTikTokModal] = useState(false);
  const [showShopeeModal, setShowShopeeModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'draft'>('all');
  const [channelFilter, setChannelFilter] = useState<'all' | 'tiktok-sold' | 'tiktok-priced' | 'tiktok-unpriced'>('all');

  const queryOptions = useMemo(() => {
    const opts: {
      orderByField?: 'name' | 'updatedAt' | 'sku' | 'createdAt';
      orderDirection?: 'asc' | 'desc';
      isActive?: boolean;
      limit?: number;
    } = {
      orderByField: 'name',
      orderDirection: 'asc',
      limit: 5000,
    };
    if (statusFilter === 'active') opts.isActive = true;
    if (statusFilter === 'draft') opts.isActive = false;
    return opts;
  }, [statusFilter]);

  const { products: liveProducts, loading } = useProducts(queryOptions);
  
  // Skema Biaya Marketplace & Anti-Boncos (Shopee & TikTok 2026 — dikalibrasi dari settlement nyata)
  const [pricingScheme, setPricingScheme] = useState<'standard' | 'event' | 'custom'>('standard');
  const [eventDiscount, setEventDiscount] = useState<number>(10); // Simulasi diskon event 10%
  const [packingOps, setPackingOps] = useState<number>(2000); // Estimasi operasional & packing Rp2.000/pesanan
  const [channelFees, setChannelFees] = useState({
    // Shopee: Admin 9% + Proses 8.4% + Ongkir Xtra 6% + PPh22 0.5% = ~15% + Rp1.250 flat
    // (Verified: Bakpia Rp14.890 → potongan Rp4.227 = 28.4% inkl. ops packing)
    shopee: { pct: 17.0, flat: 1250 }, // ~17% pct platform + Rp1.250 proses
    // TikTok: Komisi 9.5% + Dinamis 6.5% + Growth Xtra 3.5% + PPh22 0.5% = 20% + Rp1.250 flat
    // (Verified: Bakpia Rp14.892 → platform fee Rp4.142 = 27.8%)
    tiktok: { pct: 20.0, flat: 1250 }, // 20% pct platform + Rp1.250 proses (tanpa logistik)
  });

  const handleSetScheme = (scheme: 'standard' | 'event') => {
    setPricingScheme(scheme);
    if (scheme === 'standard') {
      setChannelFees({
        shopee: { pct: 17.0, flat: 1250 }, // Skema dasar terverifikasi
        tiktok: { pct: 20.0, flat: 1250 }, // Skema dasar terverifikasi (tanpa logistik)
      });
    } else if (scheme === 'event') {
      setChannelFees({
        shopee: { pct: 21.5, flat: 1250 }, // + Promo XTRA 4.5% saat event
        tiktok: { pct: 25.5, flat: 1250 }, // + Voucher XTRA 3.5% + Afiliasi 2% saat event
      });
    }
  };

  const calcChannelProfit = (channel: ChannelKey, price: number | undefined, modal: number) => {
    if (!price || price <= 0) {
      return { profit: 0, marginPct: 0, feeTotal: 0, effectivePrice: 0, isLoss: false, isThin: false, safePrice: 0 };
    }

    const isMkt = channel === 'shopee' || channel === 'tiktok';
    const disc = (isMkt && pricingScheme === 'event') ? (eventDiscount || 0) : 0;
    const effectivePrice = Math.max(0, price * (1 - disc / 100));

    const feeConfig = channelFees[channel as 'shopee' | 'tiktok'] || { pct: 0, flat: 0 };
    const feePercent = isMkt ? Math.round((feeConfig.pct / 100) * effectivePrice) : 0;
    const feeFlat = isMkt ? (feeConfig.flat || 0) : 0;
    const ops = isMkt ? packingOps : 0;
    const feeTotal = feePercent + feeFlat;

    const profit = effectivePrice - modal - feeTotal - ops;
    const marginPct = effectivePrice > 0 ? (profit / effectivePrice) * 100 : 0;

    // Hitung harga katalog aman anti-boncos (target laba bersih 15% saat event)
    const targetMargin = 15;
    const baseCost = modal + ops + feeFlat;
    const denom = 1 - (feeConfig.pct / 100) - (targetMargin / 100);
    const cleanNeeded = denom > 0 ? baseCost / denom : modal * 1.5;
    const catalogSafe = disc > 0 ? cleanNeeded / (1 - disc / 100) : cleanNeeded;
    const safePrice = Math.ceil(catalogSafe / 500) * 500;

    return {
      profit,
      marginPct,
      feeTotal,
      effectivePrice,
      isLoss: profit < 0,
      isThin: profit >= 0 && marginPct < 15,
      safePrice,
    };
  };
  const [prices, setPrices] = useState<Record<string, Record<string, ChannelPricingState>>>({});
  const [selectedUnit, setSelectedUnit] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(200);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState<BulkPricingMode>('set-nominal');
  const [bulkValue, setBulkValue] = useState<number>(0);
  const [bulkMinPrice, setBulkMinPrice] = useState<number>(0);
  const [bulkChannels, setBulkChannels] = useState<ChannelKey[]>(['offline', 'website', 'shopee', 'tiktok']);
  const [bulkApplying, setBulkApplying] = useState(false);
  const [showBulkConfirmModal, setShowBulkConfirmModal] = useState(false);

  const tiktokSoldCount = useMemo(() => {
    return (liveProducts as Product[]).filter(p => Number((p as any).raw_data?.tiktokSold || 0) > 0).length;
  }, [liveProducts]);

  const filteredProducts = useMemo(() => {
    let products = [...(liveProducts as Product[])];

    // Filter by channel/tiktok
    if (channelFilter === 'tiktok-sold') {
      products = products
        .filter(p => Number((p as any).raw_data?.tiktokSold || 0) > 0)
        .sort((a, b) => Number((b as any).raw_data?.tiktokSold || 0) - Number((a as any).raw_data?.tiktokSold || 0));
    } else if (channelFilter === 'tiktok-priced') {
      products = products.filter(p => {
        const u = selectedUnit[p.id] || (p.unit || 'PCS').toString().toUpperCase();
        return Number(prices[p.id]?.[u]?.tiktok || 0) > 0;
      });
    } else if (channelFilter === 'tiktok-unpriced') {
      products = products.filter(p => {
        const u = selectedUnit[p.id] || (p.unit || 'PCS').toString().toUpperCase();
        return !prices[p.id]?.[u]?.tiktok || Number(prices[p.id]?.[u]?.tiktok || 0) === 0;
      });
    }

    if (!search) return products;
    const lower = search.toLowerCase().trim();
    return products.filter(p => {
      const nameMatch = (p.name || '').toLowerCase().includes(lower);
      const skuMatch = (p.sku || '').toLowerCase().includes(lower);
      const ttIdMatch = String((p as any).raw_data?.tiktokProductId || '').includes(lower);
      return nameMatch || skuMatch || ttIdMatch;
    });
  }, [liveProducts, channelFilter, prices, selectedUnit, search]);

  const bulkTargetProducts = useMemo(() => {
    if (!selectedProductIds.length) return filteredProducts;
    const selectedSet = new Set(selectedProductIds);
    return filteredProducts.filter((product) => selectedSet.has(product.id));
  }, [filteredProducts, selectedProductIds]);

  const bulkPreview = useMemo(() => {
    return bulkTargetProducts.slice(0, 5).flatMap((product) => {
      const unitCode = selectedUnit[product.id] || (product.unit || 'PCS').toString().toUpperCase();
      const unitState = prices[product.id]?.[unitCode] || {};

      return bulkChannels.map((channel) => {
        const before = Number(unitState[channel] ?? 0);
        const after = applyBulkPriceAdjustment(before, bulkMode, bulkValue, bulkMinPrice);

        return {
          productId: product.id,
          productName: product.name || 'Produk',
          channel,
          unit: unitCode,
          before,
          after,
        };
      });
    });
  }, [bulkChannels, bulkMinPrice, bulkMode, bulkTargetProducts, bulkValue, prices, selectedUnit]);

  const bulkSummary = useMemo(() => {
    const modifiedProducts = bulkTargetProducts.length;
    const totalChanges = bulkPreview.filter(item => item.before !== item.after).length;
    const firstChange = bulkPreview[0];
    const totalDelta = bulkPreview.reduce((sum, item) => sum + (item.after - item.before), 0);
    const avgDelta = totalChanges > 0 ? totalDelta / totalChanges : 0;

    return {
      modifiedProducts,
      totalChanges,
      firstChange,
      totalDelta,
      avgDelta,
    };
  }, [bulkPreview, bulkTargetProducts]);

  const handleExportBulkPreview = () => {
    if (!bulkPreview.length) {
      notify.admin.error('Belum ada preview perubahan untuk di-export.');
      return;
    }

    const data = bulkPreview.map((row) => ({
      'Product ID': row.productId,
      'Product Name': row.productName,
      'Unit': row.unit,
      'Channel': row.channel,
      'Harga Saat Ini': row.before,
      'Harga Setelah Update': row.after,
      'Selisih': row.after - row.before,
      'Mode': bulkMode,
      'Nilai': bulkValue,
      'Minimum Aman': bulkMinPrice,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bulk Pricing Preview');
    XLSX.writeFile(wb, 'bulk-pricing-preview.xlsx');
    notify.admin.success('Preview update massal berhasil di-export.', { id: 'bulk-preview-export' });
  };

  const toggleProductSelect = (productId: string) => {
    setSelectedProductIds((prev) => {
      if (prev.includes(productId)) {
        return prev.filter((id) => id !== productId);
      }
      return [...prev, productId];
    });
  };

  const selectAllVisible = () => {
    setSelectedProductIds(filteredProducts.map((product) => product.id));
  };

  const clearSelectedProducts = () => {
    setSelectedProductIds([]);
  };

  const toggleChannel = (channel: ChannelKey) => {
    setBulkChannels((prev) =>
      prev.includes(channel)
        ? prev.filter((value) => value !== channel)
        : [...prev, channel],
    );
  };

  const openBulkConfirmModal = () => {
    const targetProducts = bulkTargetProducts;

    if (!targetProducts.length) {
      notify.admin.error('Pilih minimal satu produk untuk update massal.');
      return;
    }

    if (!bulkChannels.length) {
      notify.admin.error('Pilih minimal satu channel untuk update massal.');
      return;
    }

    if (!Number.isFinite(bulkValue)) {
      notify.admin.error('Nilai update tidak valid.');
      return;
    }

    setShowBulkConfirmModal(true);
  };

  const handleBulkApply = async () => {
    const targetProducts = bulkTargetProducts;

    if (!targetProducts.length) {
      notify.admin.error('Pilih minimal satu produk untuk update massal.');
      return;
    }

    if (!bulkChannels.length) {
      notify.admin.error('Pilih minimal satu channel untuk update massal.');
      return;
    }

    if (!Number.isFinite(bulkValue)) {
      notify.admin.error('Nilai update tidak valid.');
      return;
    }

    setBulkApplying(true);
    setShowBulkConfirmModal(false);
    const toastId = notify.admin.loading('Menerapkan update harga massal...');

    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentUser = authData?.user;
      const nowIso = new Date().toISOString();
      await Promise.all(targetProducts.map((product) => {
        const unitCode = selectedUnit[product.id] || (product.unit || 'PCS').toString().toUpperCase();
        const existingPricing = (product.channelPricing || {}) as Record<string, Record<string, { price?: number }>>;
        const nextPricing = { ...existingPricing } as Record<string, Record<string, { price?: number }>>;

        bulkChannels.forEach((channel) => {
          const currentPrice = Number((prices[product.id]?.[unitCode] || {})[channel] ?? existingPricing[channel]?.[unitCode]?.price ?? 0);
          const computedPrice = applyBulkPriceAdjustment(currentPrice, bulkMode, bulkValue, bulkMinPrice);

          if (!nextPricing[channel]) nextPricing[channel] = {};
          nextPricing[channel][unitCode] = { price: computedPrice };

          setPrices((prev) => ({
            ...prev,
            [product.id]: {
              ...(prev[product.id] || {}),
              [unitCode]: {
                ...((prev[product.id]?.[unitCode] || {}) as ChannelPricingState),
                [channel]: computedPrice,
              },
            },
          }));
        });

        return sbUpdateDoc('products', product.id, {
          channelPricing: nextPricing,
          updatedAt: nowIso,
        });
      }));

      try {
        await supabase.from('audit_logs').insert({
          action: 'bulk_channel_price_update',
          targetType: 'products',
          targetId: targetProducts.map((product) => product.id).join(','),
          payload: {
            productCount: targetProducts.length,
            channels: bulkChannels,
            mode: bulkMode,
            value: bulkValue,
            minimumPrice: bulkMinPrice,
            summary: bulkPreview.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              channel: item.channel,
              before: item.before,
              after: item.after,
            })),
          },
          actorId: currentUser?.id || 'system',
          actorName: currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || 'Admin',
          actorRole: currentUser?.user_metadata?.role || 'admin',
          createdAt: nowIso,
        });
      } catch (auditError) {
        console.warn('Bulk pricing audit log failed:', auditError);
      }

      notify.admin.success(`Update harga massal berhasil untuk ${targetProducts.length} produk.`, { id: toastId });
      setSelectedProductIds([]);
    } catch (error) {
      console.error(error);
      notify.admin.error('Update harga massal gagal. Silakan coba lagi.', { id: toastId });
    } finally {
      setBulkApplying(false);
    }
  };

  useEffect(() => {
    if (!liveProducts.length) return;

    setSelectedUnit((prev) => {
      const next = { ...prev };
      (liveProducts as Product[]).forEach((p) => {
        const baseUnit = (p.unit || 'PCS').toString().toUpperCase();
        if (!next[p.id]) next[p.id] = baseUnit;
      });
      return next;
    });

    setPrices((prev) => {
      const next = { ...prev } as Record<string, Record<string, ChannelPricingState>>;

      (liveProducts as Product[]).forEach((p) => {
        const unitList = (p.units || []).map((u) => (u?.code || '').toString().toUpperCase());
        const baseUnit = (p.unit || 'PCS').toString().toUpperCase();
        const units = unitList.length ? unitList : [baseUnit];

        if (!next[p.id]) next[p.id] = {};

        units.forEach((uc) => {
          if (next[p.id][uc]) return;

          const rawData = (p as any).raw_data || {};
          const cp = p.channelPricing || rawData.channelPricing || {};
          const legacy = cp as {
            offline?: { price?: number };
            website?: { price?: number };
            shopee?: { price?: number };
            tiktok?: { price?: number };
          };
          const legacyState: ChannelPricingState = {
            offline: legacy?.offline?.price,
            website: legacy?.website?.price,
            shopee: legacy?.shopee?.price || rawData.priceShopee || (p as any).priceShopee,
            tiktok: legacy?.tiktok?.price || rawData.priceTiktok || (p as any).priceTiktok,
          };
          const nested = cp as Record<string, UnitChannelPricing>;
          const fromNested: ChannelPricingState = {
            offline: nested?.offline?.[uc]?.price,
            website: nested?.website?.[uc]?.price,
            shopee: nested?.shopee?.[uc]?.price,
            tiktok: nested?.tiktok?.[uc]?.price,
          };

          const combined = uc === baseUnit ? { ...legacyState, ...fromNested } : fromNested;
          if (uc === baseUnit) {
            if (combined.tiktok === undefined && (rawData.priceTiktok || (p as any).priceTiktok)) {
              combined.tiktok = Number(rawData.priceTiktok || (p as any).priceTiktok);
            }
            if (combined.shopee === undefined && (rawData.priceShopee || (p as any).priceShopee)) {
              combined.shopee = Number(rawData.priceShopee || (p as any).priceShopee);
            }
          }

          next[p.id][uc] = combined;
        });
      });

      return next;
    });
  }, [liveProducts]);

  const handleToggleActive = async (product: Product) => {
    const nextActive = !product.isActive;
    setTogglingId(product.id);
    const toastId = notify.admin.loading(nextActive ? 'Mengaktifkan produk...' : 'Mengubah ke status draf...');
    try {
      await supabase.from('products').update({
        is_active: nextActive,
        updated_at: new Date().toISOString()
      }).eq('id', product.id);

      await sbUpdateDoc('products', product.id, {
        isActive: nextActive,
        is_active: nextActive,
        Status: nextActive ? 0 : 1,
        status: nextActive ? 'ACTIVE' : 'DRAFT',
      });

      product.isActive = nextActive;
      notify.admin.success(nextActive ? 'Produk berhasil diaktifkan!' : 'Produk diubah menjadi draf.', { id: toastId });
    } catch (err) {
      console.error(err);
      notify.admin.error('Gagal memperbarui status produk.', { id: toastId });
    } finally {
      setTogglingId(null);
    }
  };

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredProducts.slice(start, end);
  }, [filteredProducts, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, itemsPerPage]);

  const handleChangePrice = (productId: string, unitCode: string, channel: ChannelKey, value: string) => {
    setPrices(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [unitCode]: {
          ...(prev[productId]?.[unitCode] || {}),
          [channel]: value === '' ? undefined : Number(value),
        },
      },
    }));
  };

  const handleSave = async (product: Product) => {
    const state = prices[product.id] || {};
    setSavingId(product.id);
    const toastId = notify.admin.loading('Menyimpan harga channel...');
    try {
      const payload: Record<string, Record<string, { price: number }>> = {};
      (['offline', 'website', 'shopee', 'tiktok'] as ChannelKey[]).forEach((ch) => {
        Object.entries(state).forEach(([unitCode, chState]) => {
          const v = (chState as ChannelPricingState)[ch];
          if (typeof v === 'number' && !Number.isNaN(v)) {
            if (!payload[ch]) payload[ch] = {};
            payload[ch][unitCode] = { price: v };
          }
        });
      });
      await sbUpdateDoc('products', product.id, {
        channelPricing: Object.keys(payload).length ? payload : null,
      });
      notify.admin.success('Harga channel tersimpan.', { id: toastId });
    } catch (err) {
      console.error(err);
      notify.admin.error('Gagal menyimpan harga channel.', { id: toastId });
    } finally {
      setSavingId(null);
    }
  };

  const handleExport = () => {
    const data: ExportRow[] = [];
    filteredProducts.forEach(p => {
      const unitList = (p.units || []).map(u => (u?.code || '').toString().toUpperCase());
      const baseUnit = (p.unit || 'PCS').toString().toUpperCase();
      const units = unitList.length ? unitList : [baseUnit];

      units.forEach(uc => {
        const pState = prices[p.id]?.[uc] || {};
        data.push({
          'Product ID': p.id,
          'Product Name': p.name,
          'Unit': uc,
          'Offline Price': pState.offline || '',
          'Website Price': pState.website || '',
          'Shopee Price': pState.shopee || '',
          'TikTok Price': pState.tiktok || '',
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Channel Prices");
    XLSX.writeFile(wb, "channel_pricing_export.xlsx");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    const toastId = notify.admin.loading('Memproses file...');

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<ImportRow>(worksheet);

      if (!jsonData.length) {
        notify.admin.error('File Excel kosong atau tidak memiliki baris data.', { id: toastId });
        return;
      }

      // Check if this is a TikTok Shop template
      const firstRow = jsonData[0] as Record<string, unknown>;
      const keys = Object.keys(firstRow).map((k) => k.toLowerCase().trim());
      const isTikTokTemplate = keys.some(
        (k) =>
          k.includes('harga ritel') ||
          k.includes('id sku') ||
          k.includes('nilai variasi') ||
          k.includes('gambar utama') ||
          k.includes('gambar 2')
      );

      if (isTikTokTemplate) {
        setShowTikTokModal(true);
        notify.admin.success('Terdeteksi template TikTok Shop! Membuka wizard import TikTok...', { id: toastId });
        e.target.value = '';
        return;
      }

      // Check if this is a Shopee template
      const isShopeeTemplate = keys.some(
        (k) =>
          k.includes('kode produk') ||
          k.includes('kode variasi') ||
          k.includes('nama variasi') ||
          k.includes('sku induk') ||
          k.includes('foto sampul') ||
          k.includes('gambar sampul')
      );

      if (isShopeeTemplate) {
        setShowShopeeModal(true);
        notify.admin.success('Terdeteksi template Shopee! Membuka wizard import Shopee...', { id: toastId });
        e.target.value = '';
        return;
      }

      // Group updates by product ID
      const updates: Record<string, Record<string, Record<string, { price: number }>>> = {};

      jsonData.forEach((row) => {
        const pid = String(row['Product ID'] || '').trim();
        const unit = String(row['Unit'] || '').trim();
        if (!pid || !unit) return;

        if (!updates[pid]) updates[pid] = {};

        (['offline', 'website', 'shopee', 'tiktok'] as const).forEach(ch => {
           // Map column names to channel keys
           const colName = ch.charAt(0).toUpperCase() + ch.slice(1) + ' Price';
            const val = row[colName] as unknown;
            const num = typeof val === 'number' ? val : Number(val);
            if (!Number.isNaN(num)) {
             if (!updates[pid][ch]) updates[pid][ch] = {};
              updates[pid][ch][unit] = { price: num };
           }
        });
      });

      // Batch update logic
      // Since Firestore batch limit is 500, we process in chunks
      const productIds = Object.keys(updates);
      const chunkSize = 400; 
      
      for (let i = 0; i < productIds.length; i += chunkSize) {
        const chunk = productIds.slice(i, i + chunkSize);
        await Promise.all(chunk.map((pid) => sbUpdateDoc('products', pid, { channelPricing: updates[pid] })));
      }

      notify.admin.success(`Berhasil memperbarui harga untuk ${productIds.length} produk`, { id: toastId });
      // Reset file input
      e.target.value = '';
    } catch (err) {
      console.error(err);
      notify.admin.error('Gagal memproses file import', { id: toastId });
    } finally {
      setIsProcessingFile(false);
    }
  };

  return (
    <div className="p-3 md:p-4 bg-[#FBFBFE] font-sans">
      <Toaster />

      {showBulkConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_30px_80px_-24px_rgba(15,23,42,0.45)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-indigo-600">Konfirmasi perubahan massal</p>
                <h3 className="mt-2 text-2xl font-black text-slate-900">Review update harga</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkConfirmModal(false)}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-500 hover:border-slate-300 hover:text-slate-700"
              >
                Tutup
              </button>
            </div>

            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
                <div>
                  <p className="text-slate-500 uppercase tracking-[0.18em]">Produk</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{bulkTargetProducts.length}</p>
                </div>
                <div>
                  <p className="text-slate-500 uppercase tracking-[0.18em]">Channel</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{bulkChannels.length}</p>
                </div>
                <div>
                  <p className="text-slate-500 uppercase tracking-[0.18em]">Mode</p>
                  <p className="mt-1 text-sm font-black uppercase text-slate-900">{bulkMode}</p>
                </div>
                <div>
                  <p className="text-slate-500 uppercase tracking-[0.18em]">Nilai</p>
                  <p className="mt-1 text-lg font-black text-slate-900">
                    {bulkMode.includes('percent') ? `${bulkValue}%` : `Rp${Math.round(bulkValue).toLocaleString()}`}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 max-h-72 overflow-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-3 py-3 font-black uppercase tracking-[0.15em]">Produk</th>
                    <th className="px-3 py-3 font-black uppercase tracking-[0.15em]">Channel</th>
                    <th className="px-3 py-3 font-black uppercase tracking-[0.15em] text-right">Sebelum</th>
                    <th className="px-3 py-3 font-black uppercase tracking-[0.15em] text-right">Sesudah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {bulkPreview.length ? bulkPreview.slice(0, 8).map((row) => (
                    <tr key={`${row.productId}-${row.channel}-${row.unit}`}>
                      <td className="px-3 py-3 font-bold text-slate-700">{row.productName}</td>
                      <td className="px-3 py-3 font-bold uppercase text-slate-700">{row.channel}</td>
                      <td className="px-3 py-3 text-right font-bold text-slate-600">Rp{Math.round(row.before).toLocaleString()}</td>
                      <td className="px-3 py-3 text-right font-black text-slate-900">Rp{Math.round(row.after).toLocaleString()}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center font-bold text-slate-400">
                        Tidak ada preview yang tersedia.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowBulkConfirmModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black uppercase tracking-[0.18em] text-slate-600"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleBulkApply}
                className="rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2.5 text-xs font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-indigo-200"
              >
                Ya, lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/products"
            className="p-4 bg-white rounded-2xl shadow-sm hover:bg-black hover:text-white transition-all"
          >
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">
              Harga per Channel
            </h1>
            <p className="text-gray-400 text-xs font-black uppercase tracking-widest mt-1">
              Atur harga offline, website, Shopee & TikTok
            </p>
          </div>
        </div>

        {/* Calculator Links */}
        <div className="flex items-center gap-3">
          <Link 
            href="/admin/products/shopee-calculator"
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl shadow-sm hover:shadow-md transition-all text-xs font-bold"
          >
            <svg width="16" height="16" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="white"/><text x="50" y="68" textAnchor="middle" fontSize="52" fill="#EE4D2D" fontWeight="bold">S</text></svg>
            Kalkulator Shopee
          </Link>
          <Link 
            href="/admin/products/tiktok-calculator"
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-gray-900 to-black text-white rounded-xl shadow-sm hover:shadow-md transition-all text-xs font-bold"
          >
            <svg width="16" height="16" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="white"/><text x="16" y="22" textAnchor="middle" fontSize="18" fill="black">♪</text></svg>
            Kalkulator TikTok
          </Link>
          <button
            type="button"
            onClick={() => setShowShopeeModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#EE4D2D] hover:bg-[#d83f21] text-white rounded-xl shadow-sm transition-all text-xs font-black uppercase tracking-wider"
          >
            <Upload size={14} />
            Import Shopee (2 Versi)
          </button>
          <button
            type="button"
            onClick={() => setShowTikTokModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-black text-white rounded-xl shadow-sm hover:bg-slate-800 transition-all text-xs font-black uppercase tracking-wider"
          >
            <Upload size={14} />
            Import TikTok (2 Versi)
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.35)] overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              className="w-full bg-gray-50 pl-10 pr-4 py-3 rounded-2xl text-xs font-bold outline-none"
              placeholder="Cari nama produk, SKU, atau ID TikTok..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="text-xs font-black uppercase text-gray-400 tracking-[0.15em] flex items-center gap-2">
            <Tag size={14} />
            {filteredProducts.length} Produk Ditampilkan
          </div>
        </div>

        {/* Panel Kalkulator Skema Biaya Marketplace & Simulasi Event Anti-Boncos */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-orange-50 border-b border-blue-100 flex flex-col gap-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                <Calculator size={15} className="text-indigo-600" />
                Skema Biaya & Simulasi Anti-Boncos (2026):
              </span>
              <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-indigo-200 shadow-xs">
                <button
                  type="button"
                  onClick={() => handleSetScheme('standard')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    pricingScheme === 'standard' ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-600 hover:text-indigo-600'
                  }`}
                >
                  🟢 Hari Biasa (Standar)
                </button>
                <button
                  type="button"
                  onClick={() => handleSetScheme('event')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    pricingScheme === 'event' ? 'bg-pink-600 text-white shadow-xs' : 'text-gray-600 hover:text-pink-600'
                  }`}
                >
                  🎪 Simulasi Ikut Event
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs">
              <Link
                href="/admin/products/shopee-calculator"
                target="_blank"
                className="px-2.5 py-1 rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-800 font-bold border border-orange-200 transition-all flex items-center gap-1"
              >
                🛒 Kalkulator Shopee
              </Link>
              <Link
                href="/admin/products/tiktok-calculator"
                target="_blank"
                className="px-2.5 py-1 rounded-lg bg-pink-100 hover:bg-pink-200 text-pink-800 font-bold border border-pink-200 transition-all flex items-center gap-1"
              >
                ♪ Kalkulator TikTok
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-indigo-100/60 text-xs">
            {/* Shopee Fee Setting */}
            <div className="bg-white/90 p-2.5 rounded-xl border border-orange-200 flex flex-col gap-1">
              <span className="font-bold text-orange-800 flex items-center justify-between">
                <span>Shopee Potongan</span>
                <span className="text-[10px] text-gray-500 font-normal">+Rp1.250 proses</span>
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <input
                  type="number"
                  value={channelFees.shopee.pct}
                  onChange={(e) => {
                    setPricingScheme('custom');
                    setChannelFees((prev) => ({ ...prev, shopee: { ...prev.shopee, pct: Number(e.target.value) } }));
                  }}
                  className="w-16 px-2 py-1 rounded-lg text-xs font-bold border border-orange-200 outline-none text-right"
                />
                <span className="font-bold text-gray-500">%</span>
                <span className="text-[10px] text-gray-400 truncate">
                  {pricingScheme === 'event' ? '(Admin + Ongkir + Promo XTRA)' : '(Admin 9%+Ongkir6%+PPh0.5% ✓)'}
                </span>
              </div>
            </div>

            {/* TikTok Fee Setting */}
            <div className="bg-white/90 p-2.5 rounded-xl border border-pink-200 flex flex-col gap-1">
              <span className="font-bold text-pink-800 flex items-center justify-between">
                <span>TikTok Potongan</span>
                <span className="text-[10px] text-gray-500 font-normal">+Rp1.250 proses</span>
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <input
                  type="number"
                  value={channelFees.tiktok.pct}
                  onChange={(e) => {
                    setPricingScheme('custom');
                    setChannelFees((prev) => ({ ...prev, tiktok: { ...prev.tiktok, pct: Number(e.target.value) } }));
                  }}
                  className="w-16 px-2 py-1 rounded-lg text-xs font-bold border border-pink-200 outline-none text-right"
                />
                <span className="font-bold text-gray-500">%</span>
                <span className="text-[10px] text-gray-400 truncate">
                  {pricingScheme === 'event' ? '(+Xtra+Afiliasi saat event)' : '(9.5%+6.5%+3.5%+0.5% PPh22 ✓)'}
                </span>
              </div>
            </div>

            {/* Biaya Packing Ops */}
            <div className="bg-white/90 p-2.5 rounded-xl border border-blue-200 flex flex-col gap-1">
              <span className="font-bold text-blue-800">Biaya Packing & Ops</span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-gray-400 text-xs">Rp</span>
                <input
                  type="number"
                  value={packingOps}
                  onChange={(e) => setPackingOps(Number(e.target.value))}
                  className="w-20 px-2 py-1 rounded-lg text-xs font-bold border border-blue-200 outline-none text-right"
                />
                <span className="text-[10px] text-gray-500">/ pesanan</span>
              </div>
            </div>

            {/* Simulasi Diskon Event */}
            <div className={`p-2.5 rounded-xl border flex flex-col gap-1 transition-all ${
              pricingScheme === 'event' ? 'bg-pink-50 border-pink-300 ring-2 ring-pink-400/30' : 'bg-white/90 border-gray-200'
            }`}>
              <span className="font-bold text-pink-900 flex items-center justify-between">
                <span>Diskon Event Toko</span>
                {pricingScheme === 'event' && <span className="text-[10px] bg-pink-600 text-white px-1.5 py-0.2 rounded font-bold">AKTIF</span>}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <input
                  type="number"
                  disabled={pricingScheme !== 'event'}
                  value={eventDiscount}
                  onChange={(e) => setEventDiscount(Number(e.target.value))}
                  className="w-16 px-2 py-1 rounded-lg text-xs font-bold border border-pink-300 outline-none text-right disabled:opacity-50"
                />
                <span className="font-bold text-gray-500">%</span>
                <span className="text-[10px] text-gray-500">
                  {pricingScheme === 'event' ? 'Simulasi harga coret event' : '(Pilih mode Event)'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-slate-50 via-white to-indigo-50">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-gray-500">Update Massal</p>
              <p className="text-xs text-gray-500 mt-1">
                {bulkTargetProducts.length} produk siap diubah • {bulkChannels.length} channel aktif
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={selectAllVisible}
                className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:border-gray-300"
              >
                Pilih semua tampilan
              </button>
              <button
                type="button"
                onClick={clearSelectedProducts}
                className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:border-gray-300"
              >
                Bersihkan
              </button>
            </div>
          </div>

          {/* Quick Presets 1-Klik */}
          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPrices((prev) => {
                  const next = { ...prev };
                  bulkTargetProducts.forEach((product) => {
                    const unitCode = selectedUnit[product.id] || (product.unit || 'PCS').toString().toUpperCase();
                    const unitConfig = (product.units || []).find((u) => u.code.toUpperCase() === unitCode);
                    const conversion = unitConfig?.contains || 1;
                    const currentModal = (product.purchasePrice || 0) * conversion;

                    if (!next[product.id]) next[product.id] = {};
                    if (!next[product.id][unitCode]) next[product.id][unitCode] = {};

                    bulkChannels.forEach((ch) => {
                      const metrics = calcChannelProfit(ch, next[product.id][unitCode][ch] || currentModal * 1.3, currentModal);
                      next[product.id][unitCode][ch] = metrics.safePrice;
                    });
                  });
                  return next;
                });
                notify.admin.success(`Harga aman anti-boncos (target laba bersih 15%) diterapkan pada ${bulkTargetProducts.length} produk.`);
              }}
              className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-[10px] font-black transition-colors border border-emerald-200 flex items-center gap-1 shadow-xs"
            >
              <ShieldCheck size={12} className="text-emerald-600" />
              🛡️ Set Harga Aman Anti-Boncos (Target Laba 15% saat Event)
            </button>
            <button
              type="button"
              onClick={() => { setBulkMode('add-percent'); setBulkValue(10); }}
              className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-[10px] font-black transition-colors"
            >
              +10%
            </button>
            <button
              type="button"
              onClick={() => { setBulkMode('add-percent'); setBulkValue(15); }}
              className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-[10px] font-black transition-colors"
            >
              ⚡ +15% (Rekomendasi Marketplace)
            </button>
            <button
              type="button"
              onClick={() => { setBulkMode('add-percent'); setBulkValue(20); }}
              className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-[10px] font-black transition-colors"
            >
              +20%
            </button>
            <button
              type="button"
              onClick={() => { setBulkMode('add-nominal'); setBulkValue(2000); }}
              className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-[10px] font-black transition-colors"
            >
              +Rp 2.000
            </button>
            <button
              type="button"
              onClick={() => { setBulkMode('add-nominal'); setBulkValue(5000); }}
              className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-[10px] font-black transition-colors"
            >
              +Rp 5.000
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Mode</span>
              <select
                value={bulkMode}
                onChange={(event) => setBulkMode(event.target.value as BulkPricingMode)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-bold text-gray-700 outline-none"
              >
                <option value="set-nominal">Set nominal</option>
                <option value="add-nominal">Tambah nominal</option>
                <option value="subtract-nominal">Kurangi nominal</option>
                <option value="set-percent">Set persen</option>
                <option value="add-percent">Tambah persen</option>
                <option value="subtract-percent">Kurangi persen</option>
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                {bulkMode.includes('percent') ? 'Nilai %' : 'Nilai Rp'}
              </span>
              <input
                type="number"
                value={bulkValue}
                onChange={(event) => setBulkValue(Number(event.target.value))}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-bold text-gray-700 outline-none"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Minimum aman</span>
              <input
                type="number"
                value={bulkMinPrice}
                min={0}
                onChange={(event) => setBulkMinPrice(Number(event.target.value))}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-bold text-gray-700 outline-none"
              />
            </label>

            <div className="md:col-span-2 xl:col-span-2 flex flex-col gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Channel</span>
              <div className="flex flex-wrap gap-2">
                {(['offline', 'website', 'shopee', 'tiktok'] as ChannelKey[]).map((channel) => (
                  <button
                    key={channel}
                    type="button"
                    onClick={() => toggleChannel(channel)}
                    className={`rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] ${
                      bulkChannels.includes(channel)
                        ? 'border-blue-500 bg-blue-600 text-white'
                        : 'border-gray-200 bg-white text-gray-600'
                    }`}
                  >
                    {channel}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="text-xs text-gray-600">
              Preview: {bulkSummary.totalChanges} perubahan dari {bulkSummary.modifiedProducts} produk
              {bulkSummary.firstChange ? ` • contoh: ${bulkSummary.firstChange.productName} → ${bulkSummary.firstChange.channel}` : ''}
            </div>
            <button
              type="button"
              onClick={openBulkConfirmModal}
              disabled={bulkApplying || !bulkTargetProducts.length}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-black text-white text-xs font-black uppercase tracking-[0.18em] shadow-lg shadow-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bulkApplying ? 'Memproses...' : 'Terapkan update massal'}
            </button>
          </div>
        </div>

        <div className="px-6 py-5 bg-gradient-to-r from-indigo-50 via-white to-sky-50 border-b border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">Produk target</p>
              <p className="mt-2 text-2xl font-black text-gray-900">{bulkSummary.modifiedProducts}</p>
            </div>
            <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">Perubahan</p>
              <p className="mt-2 text-2xl font-black text-gray-900">{bulkSummary.totalChanges}</p>
            </div>
            <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">Delta rata-rata</p>
              <p className={`mt-2 text-xl font-black ${bulkSummary.avgDelta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {bulkSummary.avgDelta >= 0 ? '+' : '-'}Rp{Math.abs(Math.round(bulkSummary.avgDelta)).toLocaleString()}
              </p>
            </div>
            <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">Total delta</p>
              <p className={`mt-2 text-xl font-black ${bulkSummary.totalDelta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {bulkSummary.totalDelta >= 0 ? '+' : '-'}Rp{Math.abs(Math.round(bulkSummary.totalDelta)).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-xs text-gray-600">
              Snapshot siap di-export sebelum proses penyimpanan.
            </div>
            <button
              type="button"
              onClick={handleExportBulkPreview}
              disabled={!bulkPreview.length}
              className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-xs font-black uppercase tracking-[0.18em] text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={16} />
              Export Preview
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="max-h-72 overflow-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-3 py-3 font-black uppercase tracking-[0.15em]">Produk</th>
                    <th className="px-3 py-3 font-black uppercase tracking-[0.15em]">Channel</th>
                    <th className="px-3 py-3 font-black uppercase tracking-[0.15em]">Unit</th>
                    <th className="px-3 py-3 font-black uppercase tracking-[0.15em] text-right">Sebelum</th>
                    <th className="px-3 py-3 font-black uppercase tracking-[0.15em] text-right">Sesudah</th>
                    <th className="px-3 py-3 font-black uppercase tracking-[0.15em] text-right">Selisih</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bulkPreview.length ? bulkPreview.map((row) => (
                    <tr key={`${row.productId}-${row.channel}-${row.unit}`}>
                      <td className="px-3 py-3 font-bold text-gray-700">{row.productName}</td>
                      <td className="px-3 py-3 font-bold text-gray-700 uppercase">{row.channel}</td>
                      <td className="px-3 py-3 font-bold text-gray-700">{row.unit}</td>
                      <td className="px-3 py-3 text-right font-bold text-gray-600">Rp{Math.round(row.before).toLocaleString()}</td>
                      <td className="px-3 py-3 text-right font-black text-gray-900">Rp{Math.round(row.after).toLocaleString()}</td>
                      <td className={`px-3 py-3 text-right font-black ${row.after - row.before >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {row.after - row.before >= 0 ? '+' : '-'}Rp{Math.abs(Math.round(row.after - row.before)).toLocaleString()}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-gray-400 font-bold">
                        Belum ada data preview. Pilih produk untuk melihat impact update.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 pt-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
           <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-colors"
              >
                <Download size={16} />
                Export Excel
              </button>
              <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer">
                <Upload size={16} />
                {isProcessingFile ? 'Processing...' : 'Import Excel'}
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleImport}
                  disabled={isProcessingFile}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={() => setShowShopeeModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#EE4D2D] hover:bg-[#d83f21] text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
              >
                <svg width="14" height="14" viewBox="0 0 100 100" fill="white">
                  <circle cx="50" cy="50" r="46" fill="white" />
                  <text x="50" y="68" textAnchor="middle" fontSize="52" fill="#EE4D2D" fontWeight="bold">S</text>
                </svg>
                Import Shopee (2 Versi)
              </button>
              <button
                type="button"
                onClick={() => setShowTikTokModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm"
              >
                <svg width="14" height="14" viewBox="0 0 32 32" fill="white">
                  <path d="M16 2a14 14 0 1 0 14 14A14 14 0 0 0 16 2zm4.8 11.2a4.4 4.4 0 0 1-2.8-1v5.6a4.8 4.8 0 1 1-4.8-4.8c.3 0 .7 0 1 .1v2.7a2.1 2.1 0 1 0 1.1 1.9v-9.5h2.7a4.4 4.4 0 0 0 2.8 1.5z" />
                </svg>
                Import TikTok Shop (2 Versi)
              </button>
           </div>
           
           <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    statusFilter === 'all'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Semua Status ({liveProducts.length})
                </button>
                <button
                  type="button"
                  onClick={() => { setStatusFilter('active'); setCurrentPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    statusFilter === 'active'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Aktif
                </button>
                <button
                  type="button"
                  onClick={() => { setStatusFilter('draft'); setCurrentPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    statusFilter === 'draft'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Draf / Nonaktif
                </button>
              </div>

              {/* Channel / TikTok Sales Filter */}
              <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => { setChannelFilter('all'); setCurrentPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    channelFilter === 'all'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Semua Channel
                </button>
                <button
                  type="button"
                  onClick={() => { setChannelFilter('tiktok-sold'); setCurrentPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                    channelFilter === 'tiktok-sold'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-rose-600 hover:bg-rose-50'
                  }`}
                >
                  <span>🔥 Terjual di TikTok</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                    channelFilter === 'tiktok-sold' ? 'bg-rose-700 text-white' : 'bg-rose-100 text-rose-700'
                  }`}>
                    {tiktokSoldCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => { setChannelFilter('tiktok-priced'); setCurrentPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    channelFilter === 'tiktok-priced'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Ada Harga TikTok
                </button>
                <button
                  type="button"
                  onClick={() => { setChannelFilter('tiktok-unpriced'); setCurrentPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    channelFilter === 'tiktok-unpriced'
                      ? 'bg-gray-800 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Belum Ada Harga
                </button>
              </div>

             <div className="flex items-center gap-2">
               <span className="text-xs font-bold text-gray-500">Tampilkan:</span>
               <select
                 value={itemsPerPage}
                 onChange={(e) => setItemsPerPage(Number(e.target.value))}
                 className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold outline-none"
               >
                 <option value={200}>200</option>
                 <option value={500}>500</option>
               </select>
             </div>
           </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-xs font-bold text-gray-400">
            Memuat data produk...
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden space-y-4 px-4">
              {paginatedProducts.map((p) => {
                  const displayName = p.name || 'Produk';
                  const unitList = ((p.units || []).map(u => (u?.code || '').toString().toUpperCase()));
                  const baseUnit = (p.unit || 'PCS').toString().toUpperCase();
                  const units = unitList.length ? unitList : [baseUnit];
                  const currentUnit = selectedUnit[p.id] || baseUnit;
                  const stateByUnit = prices[p.id]?.[currentUnit] || {};
                  
                  // Get unit conversion
                  const unitConfig = (p.units || []).find(u => u.code.toUpperCase() === currentUnit);
                  const conversion = unitConfig?.contains || 1;
                  const currentModal = (p.purchasePrice || 0) * conversion;
                  const currentDasar = (p.priceEcer || 0) * conversion;
                  const rawData = (p as any).raw_data || {};
                  const tiktokSold = Number(rawData.tiktokSold || 0);
                  const tiktokRevenue = Number(rawData.tiktokRevenue || 0);
                  const tiktokId = rawData.tiktokProductId || (p as any).tiktokProductId;

                  return (
                      <div key={p.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-lg flex flex-col gap-4">
                          <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                  <input
                                      type="checkbox"
                                      checked={selectedProductIds.includes(p.id)}
                                      onChange={() => toggleProductSelect(p.id)}
                                      className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight leading-tight">{displayName}</h3>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold ${p.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                          {p.isActive ? 'Aktif' : 'Draf'}
                                        </span>
                                        {tiktokSold > 0 && (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-600 border border-rose-200 shadow-xs">
                                            🔥 {tiktokSold.toLocaleString('id-ID')} Terjual di TikTok
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex flex-col gap-0.5 mt-1">
                                        <p className="text-xs font-bold text-gray-400">Dasar: Rp {Number(currentDasar).toLocaleString()}</p>
                                        <p className="text-xs font-bold text-blue-500">Modal: Rp {Number(currentModal).toLocaleString()}</p>
                                        {tiktokId && (
                                          <p className="text-[10px] font-mono text-gray-500">
                                            TikTok ID: {tiktokId} {tiktokRevenue > 0 ? `• Omzet Rp ${tiktokRevenue.toLocaleString('id-ID')}` : ''}
                                          </p>
                                        )}
                                      </div>
                                  </div>
                              </div>
                              <select
                                  value={currentUnit}
                                  onChange={(e) => setSelectedUnit(su => ({ ...su, [p.id]: e.target.value }))}
                                  className="text-xs font-black bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 outline-none"
                              >
                                  {units.map(uc => (
                                      <option key={uc} value={uc}>{uc}</option>
                                  ))}
                              </select>
                          </div>

                          <div className="space-y-3 pt-2 border-t border-gray-50">
                              {(['offline', 'website', 'shopee', 'tiktok'] as ChannelKey[]).map((key) => {
                                  const price = stateByUnit[key];
                                  const modal = currentModal;
                                  const metrics = calcChannelProfit(key, price, modal);
                                  const isMkt = key === 'shopee' || key === 'tiktok';

                                  return (
                                    <div key={key} className="flex flex-col gap-1">
                                      <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-1.5 w-24">
                                            <span className="text-xs font-bold text-gray-600 uppercase">{key}</span>
                                            {isMkt && metrics.safePrice > 0 && (
                                              <button
                                                type="button"
                                                onClick={() => handleChangePrice(p.id, currentUnit, key, String(metrics.safePrice))}
                                                title={`Pasang harga aman anti-boncos: Rp ${metrics.safePrice.toLocaleString('id-ID')}`}
                                                className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded hover:bg-emerald-100 border border-emerald-200"
                                              >
                                                Aman
                                              </button>
                                            )}
                                          </div>
                                          <div className="flex items-center justify-end gap-1 flex-1">
                                              <span className="text-xs font-bold text-gray-400">Rp</span>
                                              <input
                                                  type="number"
                                                  className={`w-full p-2 rounded-lg text-xs font-black text-right outline-none border transition-all ${
                                                    isMkt && metrics.isLoss ? 'bg-rose-50 border-rose-300 text-rose-900 focus:bg-white' :
                                                    isMkt && metrics.isThin ? 'bg-amber-50 border-amber-300 text-amber-900 focus:bg-white' :
                                                    'bg-gray-50 border-transparent focus:border-blue-500 focus:bg-white'
                                                  }`}
                                                  value={stateByUnit[key] ?? ''}
                                                  onChange={(e) =>
                                                      handleChangePrice(p.id, currentUnit, key, e.target.value)
                                                  }
                                                  min={0}
                                                  placeholder="0"
                                              />
                                          </div>
                                      </div>
                                      {isMkt && price ? (
                                        <div className="flex flex-col items-end gap-0.5 text-xs">
                                          <div className="flex items-center gap-2">
                                            <span className="text-[11px] text-gray-400">
                                              Potongan: -Rp{Math.round(metrics.feeTotal + packingOps).toLocaleString('id-ID')}
                                            </span>
                                            {metrics.isLoss ? (
                                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-100 border border-rose-300 text-rose-800 text-[10px] font-black animate-pulse">
                                                🚨 BONCOS: -Rp{Math.abs(Math.round(metrics.profit)).toLocaleString('id-ID')}
                                              </span>
                                            ) : metrics.isThin ? (
                                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-800 text-[10px] font-bold">
                                                ⚠️ Tipis ({metrics.marginPct.toFixed(1)}%): +Rp{Math.round(metrics.profit).toLocaleString('id-ID')}
                                              </span>
                                            ) : (
                                              <span className="font-bold text-emerald-600">
                                                Laba ({metrics.marginPct.toFixed(1)}%): +Rp{Math.round(metrics.profit).toLocaleString('id-ID')}
                                              </span>
                                            )}
                                          </div>
                                          {metrics.isLoss || metrics.isThin ? (
                                            <p className="text-[10px] text-emerald-700 font-semibold">
                                              Saran Harga Aman: Rp {metrics.safePrice.toLocaleString('id-ID')}
                                            </p>
                                          ) : null}
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                              })}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleActive(p)}
                              disabled={togglingId === p.id}
                              className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-[0.1em] flex items-center justify-center gap-1 transition-colors ${
                                p.isActive 
                                  ? 'bg-gray-100 hover:bg-amber-100 text-gray-700 hover:text-amber-800' 
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                              }`}
                            >
                              {togglingId === p.id ? 'Memproses...' : p.isActive ? 'Ubah ke Draf' : 'Aktifkan Produk'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSave(p)}
                              disabled={savingId === p.id}
                              className="flex-1 py-3 bg-black text-white rounded-xl text-xs font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
                            >
                              <Save size={14} />
                              {savingId === p.id ? 'Menyimpan...' : 'Simpan Perubahan'}
                            </button>
                          </div>
                      </div>
                  );
              })}
               {!paginatedProducts.length && !loading && (
                  <div className="p-10 text-center text-xs font-bold text-gray-400 bg-white rounded-3xl border border-gray-100">
                      Tidak ada produk yang cocok dengan pencarian.
                  </div>
               )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto -mx-4 md:mx-0">
              <table className="w-full text-left min-w-[720px] md:min-w-0">
              <thead className="bg-gray-50/60">
                <tr>
                  <th className="px-4 py-4 text-xs font-black text-gray-400 uppercase">
                    <input
                      type="checkbox"
                      checked={filteredProducts.length > 0 && filteredProducts.every((product) => selectedProductIds.includes(product.id))}
                      onChange={() => {
                        if (filteredProducts.every((product) => selectedProductIds.includes(product.id))) {
                          setSelectedProductIds((prev) => prev.filter((id) => !filteredProducts.some((product) => product.id === id)));
                          return;
                        }
                        selectAllVisible();
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase">Produk</th>
                  <th className="px-4 py-4 text-xs font-black text-gray-400 uppercase text-right">
                    Offline
                  </th>
                  <th className="px-4 py-4 text-xs font-black text-gray-400 uppercase text-right">
                    Website
                  </th>
                  <th className="px-4 py-4 text-xs font-black text-gray-400 uppercase text-right">
                    Shopee
                  </th>
                  <th className="px-4 py-4 text-xs font-black text-gray-400 uppercase text-right">
                    TikTok
                  </th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase text-right">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedProducts.map((p) => {
                  const displayName = p.name || 'Produk';
                  const unitList = ((p.units || []).map(u => (u?.code || '').toString().toUpperCase()));
                  const baseUnit = (p.unit || 'PCS').toString().toUpperCase();
                  const units = unitList.length ? unitList : [baseUnit];
                  const currentUnit = selectedUnit[p.id] || baseUnit;
                  const stateByUnit = prices[p.id]?.[currentUnit] || {};
                  
                  // Get unit conversion
                  const unitConfig = (p.units || []).find(u => u.code.toUpperCase() === currentUnit);
                  const conversion = unitConfig?.contains || 1;
                  const currentModal = (p.purchasePrice || 0) * conversion;
                  const currentDasar = (p.priceEcer || 0) * conversion;
                  const rawData = (p as any).raw_data || {};
                  const tiktokSold = Number(rawData.tiktokSold || 0);
                  const tiktokRevenue = Number(rawData.tiktokRevenue || 0);
                  const tiktokId = rawData.tiktokProductId || (p as any).tiktokProductId;
                  
                  return (
                    <tr key={p.id}>
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedProductIds.includes(p.id)}
                          onChange={() => toggleProductSelect(p.id)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-gray-800 uppercase">
                              {displayName}
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold ${p.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                              {p.isActive ? 'Aktif' : 'Draf'}
                            </span>
                            {tiktokSold > 0 && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-600 border border-rose-200 shadow-xs">
                                🔥 {tiktokSold.toLocaleString('id-ID')} Terjual di TikTok
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-gray-400">
                              Harga dasar: Rp {Number(currentDasar).toLocaleString()}
                            </span>
                            <span className="text-xs font-bold text-blue-500">
                              Modal: Rp {Number(currentModal).toLocaleString()}
                            </span>
                            {tiktokId && (
                              <span className="text-[10px] font-mono text-gray-500 mt-0.5">
                                TikTok ID: {tiktokId} {tiktokRevenue > 0 ? `• Omzet Rp ${tiktokRevenue.toLocaleString('id-ID')}` : ''}
                              </span>
                            )}
                          </div>
                          <div className="mt-1">
                            <select
                              value={currentUnit}
                              onChange={(e) => setSelectedUnit(su => ({ ...su, [p.id]: e.target.value }))}
                              className="text-xs font-black bg-gray-50 border rounded-lg px-2 py-1"
                            >
                              {units.map(uc => (
                                <option key={uc} value={uc}>{uc}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </td>
                      {(['offline', 'website', 'shopee', 'tiktok'] as ChannelKey[]).map((key) => {
                        const price = stateByUnit[key];
                        const modal = currentModal;
                        const metrics = calcChannelProfit(key, price, modal);
                        const isMkt = key === 'shopee' || key === 'tiktok';

                        return (
                          <td key={key} className="px-4 py-4">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-xs font-bold text-gray-400">Rp</span>
                                <input
                                  type="number"
                                  className={`w-24 p-2 rounded-lg text-xs font-black text-right outline-none border transition-all ${
                                    isMkt && metrics.isLoss ? 'bg-rose-50 border-rose-300 text-rose-900 focus:bg-white' :
                                    isMkt && metrics.isThin ? 'bg-amber-50 border-amber-300 text-amber-900 focus:bg-white' :
                                    'bg-gray-50 border-transparent focus:border-blue-500 focus:bg-white'
                                  }`}
                                  value={stateByUnit[key] ?? ''}
                                  onChange={(e) =>
                                    handleChangePrice(p.id, currentUnit, key, e.target.value)
                                  }
                                  min={0}
                                />
                              </div>
                              {isMkt && price ? (
                                <div className="text-right space-y-0.5">
                                  <p className="text-[10px] text-gray-400">
                                    Potongan: -Rp{Math.round(metrics.feeTotal + packingOps).toLocaleString('id-ID')}
                                  </p>
                                  {metrics.isLoss ? (
                                    <div>
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-100 border border-rose-300 text-rose-800 text-[10px] font-black">
                                        🚨 BONCOS: -Rp{Math.abs(Math.round(metrics.profit)).toLocaleString('id-ID')}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleChangePrice(p.id, currentUnit, key, String(metrics.safePrice))}
                                        className="block ml-auto mt-0.5 text-[10px] font-bold text-emerald-700 hover:underline"
                                      >
                                        Set Aman: Rp{metrics.safePrice.toLocaleString('id-ID')}
                                      </button>
                                    </div>
                                  ) : metrics.isThin ? (
                                    <div>
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-800 text-[10px] font-bold">
                                        ⚠️ Tipis ({metrics.marginPct.toFixed(1)}%): +Rp{Math.round(metrics.profit).toLocaleString('id-ID')}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleChangePrice(p.id, currentUnit, key, String(metrics.safePrice))}
                                        className="block ml-auto mt-0.5 text-[10px] font-bold text-emerald-700 hover:underline"
                                      >
                                        Set Aman: Rp{metrics.safePrice.toLocaleString('id-ID')}
                                      </button>
                                    </div>
                                  ) : (
                                    <p className="text-xs font-bold text-emerald-600">
                                      Laba ({metrics.marginPct.toFixed(1)}%): +Rp{Math.round(metrics.profit).toLocaleString('id-ID')}
                                    </p>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(p)}
                            disabled={togglingId === p.id}
                            className={`px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-colors ${
                              p.isActive 
                                ? 'bg-gray-100 hover:bg-amber-50 text-gray-600 hover:text-amber-700' 
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                            }`}
                            title={p.isActive ? 'Ubah ke Draf' : 'Aktifkan Produk'}
                          >
                            {togglingId === p.id ? '...' : p.isActive ? 'Draf' : 'Aktifkan'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSave(p)}
                            disabled={savingId === p.id}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-black text-white text-xs font-black uppercase tracking-[0.2em] disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                          >
                            <Save size={14} />
                            {savingId === p.id ? 'Menyimpan...' : 'Simpan'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!filteredProducts.length && !loading && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-10 text-center text-xs font-bold text-gray-400"
                    >
                      Tidak ada produk yang cocok dengan pencarian.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          </>
        )}
        
        <div className="p-4 border-t border-gray-50 flex items-center justify-between">
          <span className="text-xs font-bold text-gray-400">
            Halaman {currentPage} dari {totalPages || 1}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-2 rounded-lg bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <TikTokImportModal
        isOpen={showTikTokModal}
        onClose={() => setShowTikTokModal(false)}
        onSuccess={() => {
          // Handled by realtime hook
        }}
      />

      <ShopeeImportModal
        isOpen={showShopeeModal}
        onClose={() => setShowShopeeModal(false)}
        onSuccess={() => {
          // Handled by realtime hook
        }}
      />
    </div>
  );
}
