'use client';

import { useState, useRef } from 'react';
import {
  X,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Image as ImageIcon,
  DollarSign,
  Layers,
  Sparkles,
  ArrowRight,
  Info,
  Check,
  RefreshCw,
} from 'lucide-react';
import notify from '@/lib/notify';
import { supabase } from '@/lib/supabase';

export type TikTokImportVersion = 'v1_pricing' | 'v2_images';

interface DbProduct {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  category?: string;
  unit?: string;
  price?: number;
  cost_price?: number;
  stock?: number;
  image_url?: string;
  is_active?: boolean;
  raw_data?: Record<string, any>;
}

interface ParsedV1Row {
  tiktokId: string;
  category: string;
  name: string;
  skuId: string;
  variation: string;
  price: number;
  sellerSku: string;
  minPurchase?: number;
  // Match results
  matchedProduct?: DbProduct;
  isNewProduct: boolean;
  unitCode: string;
}

interface ParsedV2Row {
  tiktokId: string;
  category: string;
  name: string;
  mainImage: string;
  extraImages: string[];
  sizeChart?: string;
  // Match results
  matchedProduct?: DbProduct;
  isNewProduct: boolean;
}

interface TikTokImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialVersion?: TikTokImportVersion;
}

export default function TikTokImportModal({
  isOpen,
  onClose,
  onSuccess,
  initialVersion = 'v1_pricing',
}: TikTokImportModalProps) {
  const [activeVersion, setActiveVersion] = useState<TikTokImportVersion>(initialVersion);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressText, setProgressText] = useState<string>('');

  // Options
  const [autoCreateNew, setAutoCreateNew] = useState(true);
  const [autoActivate, setAutoActivate] = useState(true);
  const [updateDbName, setUpdateDbName] = useState(false);

  // Parsed Data
  const [v1Rows, setV1Rows] = useState<ParsedV1Row[]>([]);
  const [v2Rows, setV2Rows] = useState<ParsedV2Row[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [detectedVersion, setDetectedVersion] = useState<TikTokImportVersion | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Clean and normalize strings for matching
  const cleanStr = (s?: string) =>
    (s || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  // Find matching product in DB list
  const findMatchingProduct = (
    row: { tiktokId?: string; sellerSku?: string; skuId?: string; name?: string },
    dbProducts: DbProduct[]
  ): DbProduct | undefined => {
    // 1. Match by SKU Penjual
    if (row.sellerSku) {
      const skuClean = cleanStr(row.sellerSku);
      const found = dbProducts.find((p) => {
        const pSku = cleanStr(p.sku);
        const pBarcode = cleanStr(p.barcode);
        const pRawId = cleanStr(p.raw_data?.ID);
        return pSku === skuClean || pBarcode === skuClean || pRawId === skuClean;
      });
      if (found) return found;
    }

    // 2. Match by previously mapped tiktokProductId
    if (row.tiktokId) {
      const found = dbProducts.find(
        (p) =>
          p.raw_data?.tiktokProductId === row.tiktokId ||
          p.raw_data?.tiktok_id === row.tiktokId ||
          p.id === row.tiktokId
      );
      if (found) return found;
    }

    // 3. Match by Name
    if (row.name) {
      const cleanRowName = cleanStr(row.name);
      if (!cleanRowName) return undefined;

      // 3a. Exact name
      const exact = dbProducts.find((p) => cleanStr(p.name) === cleanRowName);
      if (exact) return exact;

      // 3b. Containment: db product name inside TikTok long name
      const candidates = dbProducts.filter((p) => {
        const cleanPName = cleanStr(p.name);
        if (cleanPName.length < 4) return false;

        if (cleanRowName.includes(cleanPName)) return true;

        // Keyword overlap: all significant words of DB product name exist in TikTok name
        const pWords = cleanPName.split(' ').filter((w) => w.length > 2);
        if (pWords.length >= 2 && pWords.every((w) => cleanRowName.includes(w))) {
          return true;
        }
        return false;
      });

      if (candidates.length === 1) return candidates[0];
      if (candidates.length > 1) {
        // Pick the longest matching name (most specific)
        candidates.sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0));
        return candidates[0];
      }
    }

    return undefined;
  };

  const parseNumber = (val: unknown): number => {
    if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
    if (!val) return 0;
    const clean = String(val).replace(/[^0-9,-]/g, '').replace(',', '.');
    const num = parseFloat(clean);
    return Number.isFinite(num) ? num : 0;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);
    const toastId = notify.admin.loading(`Membaca file ${file.name}...`);

    try {
      // 1. Fetch ALL products from Supabase (including inactive ones)
      const { data: dbProductsRaw, error: dbError } = await supabase
        .from('products')
        .select('id, name, sku, barcode, category, unit, price, cost_price, stock, image_url, is_active, raw_data');

      if (dbError) throw dbError;
      const dbProducts = (dbProductsRaw || []) as DbProduct[];

      // 2. Read Excel
      const buffer = await file.arrayBuffer();
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

      if (!rawJson.length) {
        throw new Error('File Excel tidak memiliki baris data.');
      }

      // Check header keys from the first row to determine version
      const sampleRow = rawJson[0] || {};
      const keys = Object.keys(sampleRow).map((k) => k.trim());

      const hasImageCol = keys.some((k) =>
        k.toLowerCase().includes('gambar utama') || k.toLowerCase().includes('gambar 2')
      );
      const hasPriceCol = keys.some((k) =>
        k.toLowerCase().includes('harga ritel') || k.toLowerCase().includes('nilai variasi') || k.toLowerCase().includes('id sku')
      );

      let targetVer: TikTokImportVersion = activeVersion;
      if (hasImageCol && !hasPriceCol) {
        targetVer = 'v2_images';
        setActiveVersion('v2_images');
        setDetectedVersion('v2_images');
      } else if (hasPriceCol && !hasImageCol) {
        targetVer = 'v1_pricing';
        setActiveVersion('v1_pricing');
        setDetectedVersion('v1_pricing');
      } else {
        setDetectedVersion(null);
      }

      if (targetVer === 'v1_pricing') {
        const parsed: ParsedV1Row[] = [];
        rawJson.forEach((row) => {
          const tiktokId = String(row['ID Produk'] || row['Product ID'] || '').trim();
          const category = String(row['Kategori'] || row['Category'] || '').trim();
          const name = String(row['Nama produk'] || row['Product Name'] || '').trim();
          const skuId = String(row['ID SKU'] || row['SKU ID'] || '').trim();
          const variation = String(row['Nilai Variasi'] || row['Variation'] || '').trim();
          const sellerSku = String(row['SKU Penjual'] || row['Seller SKU'] || '').trim();
          const priceRaw = row['Harga Ritel (Mata Uang Lokal)'] ?? row['Retail Price'] ?? row['Harga Ritel'] ?? 0;
          const price = parseNumber(priceRaw);
          const minPurchase = parseNumber(row['Pembelian minimum per pesanan'] || 1);

          if (!name && !tiktokId && !skuId) return;

          const matched = findMatchingProduct(
            { tiktokId, sellerSku, skuId, name },
            dbProducts
          );

          const unitCode = (variation || matched?.unit || 'PCS').toString().toUpperCase().trim();

          parsed.push({
            tiktokId,
            category,
            name,
            skuId,
            variation,
            price,
            sellerSku,
            minPurchase,
            matchedProduct: matched,
            isNewProduct: !matched,
            unitCode,
          });
        });

        setV1Rows(parsed);
        setV2Rows([]);
        notify.admin.success(
          `Terbaca ${parsed.length} baris data harga & SKU (${parsed.filter((p) => p.matchedProduct).length} produk cocok).`,
          { id: toastId }
        );
      } else {
        const parsed: ParsedV2Row[] = [];
        rawJson.forEach((row) => {
          const tiktokId = String(row['ID Produk'] || row['Product ID'] || '').trim();
          const category = String(row['Kategori'] || row['Category'] || '').trim();
          const name = String(row['Nama produk'] || row['Product Name'] || '').trim();
          const mainImage = String(row['Gambar utama'] || row['Main Image'] || '').trim();
          const sizeChart = String(row['Bagan Ukuran'] || '').trim();

          const extraImages: string[] = [];
          for (let i = 2; i <= 9; i++) {
            const key = `Gambar ${i}`;
            const altKey = `Gambar Produk ${i}`;
            const img = String(row[key] || row[altKey] || '').trim();
            if (img && img.startsWith('http')) {
              extraImages.push(img);
            }
          }

          if (!name && !tiktokId && !mainImage) return;

          const matched = findMatchingProduct({ tiktokId, name }, dbProducts);

          parsed.push({
            tiktokId,
            category,
            name,
            mainImage,
            extraImages,
            sizeChart,
            matchedProduct: matched,
            isNewProduct: !matched,
          });
        });

        setV2Rows(parsed);
        setV1Rows([]);
        notify.admin.success(
          `Terbaca ${parsed.length} baris data foto produk (${parsed.filter((p) => p.matchedProduct).length} produk cocok).`,
          { id: toastId }
        );
      }
    } catch (err: any) {
      console.error(err);
      notify.admin.error(err?.message || 'Gagal memproses file Excel TikTok.', { id: toastId });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleApplyChanges = async () => {
    const isV1 = activeVersion === 'v1_pricing';
    const totalCount = isV1 ? v1Rows.length : v2Rows.length;

    if (!totalCount) {
      notify.admin.error('Belum ada data yang siap diterapkan. Silakan upload file terlebih dahulu.');
      return;
    }

    setIsApplying(true);
    setProgressPercent(0);
    setProgressText('Menyiapkan update...');
    const toastId = notify.admin.loading('Menerapkan perubahan ke database...');

    try {
      const now = new Date().toISOString();
      let updatedCount = 0;
      let createdCount = 0;

      if (isV1) {
        // Group by matched product id or create new
        const CHUNK_SIZE = 50;
        for (let i = 0; i < v1Rows.length; i += CHUNK_SIZE) {
          const chunk = v1Rows.slice(i, i + CHUNK_SIZE);

          await Promise.all(
            chunk.map(async (row) => {
              if (row.matchedProduct) {
                // UPDATE EXISTING PRODUCT
                const existing = row.matchedProduct;
                const existingRaw = existing.raw_data || {};
                const existingPricing = (existingRaw.channelPricing || {}) as Record<string, any>;
                if (!existingPricing.tiktok) existingPricing.tiktok = {};

                const unitKey = row.unitCode || (existing.unit || 'PCS').toString().toUpperCase();
                existingPricing.tiktok[unitKey] = { price: row.price };

                const updatedRaw: Record<string, any> = {
                  ...existingRaw,
                  channelPricing: existingPricing,
                  priceTiktok: row.price,
                  tiktokProductId: row.tiktokId || existingRaw.tiktokProductId,
                  tiktokSkuId: row.skuId || existingRaw.tiktokSkuId,
                  updatedAt: now,
                };

                if (autoActivate) {
                  updatedRaw.isActive = true;
                }
                if (updateDbName && row.name) {
                  updatedRaw.name = row.name;
                }

                const updatePayload: Record<string, any> = {
                  raw_data: updatedRaw,
                  updated_at: now,
                };

                if (autoActivate) {
                  updatePayload.is_active = true;
                }
                if (updateDbName && row.name) {
                  updatePayload.name = row.name;
                }

                await supabase.from('products').update(updatePayload).eq('id', existing.id);
                updatedCount++;
              } else if (autoCreateNew) {
                // CREATE NEW PRODUCT
                const newId = `prod_tt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                const unitKey = row.unitCode || 'PCS';
                const productSku = row.sellerSku || row.skuId || row.tiktokId || `SKU-TT-${Date.now()}`;

                const rawData = {
                  name: row.name || 'Produk TikTok',
                  sku: productSku,
                  category: row.category || 'TikTok Shop',
                  unit: unitKey,
                  price: row.price,
                  costPrice: 0,
                  stock: 0,
                  isActive: true,
                  tiktokProductId: row.tiktokId,
                  tiktokSkuId: row.skuId,
                  channelPricing: {
                    tiktok: {
                      [unitKey]: { price: row.price },
                    },
                  },
                  createdAt: now,
                  updatedAt: now,
                };

                await supabase.from('products').insert({
                  id: newId,
                  name: row.name || 'Produk TikTok',
                  sku: productSku,
                  category: row.category || 'TikTok Shop',
                  unit: unitKey,
                  price: row.price,
                  cost_price: 0,
                  stock: 0,
                  is_active: true,
                  raw_data: rawData,
                  created_at: now,
                  updated_at: now,
                });
                createdCount++;
              }
            })
          );

          const currentProcessed = Math.min(i + CHUNK_SIZE, v1Rows.length);
          const pct = Math.round((currentProcessed / v1Rows.length) * 100);
          setProgressPercent(pct);
          setProgressText(`Memproses ${currentProcessed} dari ${v1Rows.length} produk...`);
        }
      } else {
        // V2 IMAGES
        const CHUNK_SIZE = 50;
        for (let i = 0; i < v2Rows.length; i += CHUNK_SIZE) {
          const chunk = v2Rows.slice(i, i + CHUNK_SIZE);

          await Promise.all(
            chunk.map(async (row) => {
              if (row.matchedProduct && row.mainImage) {
                const existing = row.matchedProduct;
                const existingRaw = existing.raw_data || {};
                const allImages = [row.mainImage, ...row.extraImages].filter(Boolean);

                const updatedRaw: Record<string, any> = {
                  ...existingRaw,
                  image_url: row.mainImage,
                  image: row.mainImage,
                  imageUrl: row.mainImage,
                  Link_Foto: row.mainImage,
                  images: allImages,
                  tiktokProductId: row.tiktokId || existingRaw.tiktokProductId,
                  updatedAt: now,
                };

                if (autoActivate) {
                  updatedRaw.isActive = true;
                }

                const updatePayload: Record<string, any> = {
                  image_url: row.mainImage,
                  raw_data: updatedRaw,
                  updated_at: now,
                };

                if (autoActivate) {
                  updatePayload.is_active = true;
                }

                await supabase.from('products').update(updatePayload).eq('id', existing.id);
                updatedCount++;
              } else if (autoCreateNew && !row.matchedProduct && row.mainImage) {
                // Create draft product with image
                const newId = `prod_tt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                const productSku = row.tiktokId ? `TT-${row.tiktokId}` : `SKU-TT-${Date.now()}`;
                const allImages = [row.mainImage, ...row.extraImages].filter(Boolean);

                const rawData = {
                  name: row.name || 'Produk TikTok',
                  sku: productSku,
                  category: row.category || 'TikTok Shop',
                  unit: 'PCS',
                  price: 0,
                  costPrice: 0,
                  stock: 0,
                  image_url: row.mainImage,
                  imageUrl: row.mainImage,
                  image: row.mainImage,
                  Link_Foto: row.mainImage,
                  images: allImages,
                  isActive: true,
                  tiktokProductId: row.tiktokId,
                  createdAt: now,
                  updatedAt: now,
                };

                await supabase.from('products').insert({
                  id: newId,
                  name: row.name || 'Produk TikTok',
                  sku: productSku,
                  category: row.category || 'TikTok Shop',
                  unit: 'PCS',
                  price: 0,
                  cost_price: 0,
                  stock: 0,
                  image_url: row.mainImage,
                  is_active: true,
                  raw_data: rawData,
                  created_at: now,
                  updated_at: now,
                });
                createdCount++;
              }
            })
          );

          const currentProcessed = Math.min(i + CHUNK_SIZE, v2Rows.length);
          const pct = Math.round((currentProcessed / v2Rows.length) * 100);
          setProgressPercent(pct);
          setProgressText(`Memproses foto ${currentProcessed} dari ${v2Rows.length} produk...`);
        }
      }

      notify.admin.success(
        `Sukses! ${updatedCount} produk diperbarui, ${createdCount} produk baru didaftarkan.`,
        { id: toastId }
      );

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      notify.admin.error(err?.message || 'Gagal menerapkan perubahan ke database.', { id: toastId });
    } finally {
      setIsApplying(false);
    }
  };

  const downloadSampleTemplate = async (version: TikTokImportVersion) => {
    const XLSX = await import('xlsx');
    if (version === 'v1_pricing') {
      const sample = [
        {
          'ID Produk': '1734398511748580676',
          Kategori: 'Makanan & Minuman > Sembako > Beras',
          'Nama produk': 'Lahap Lele Beras Pulen & Putih Alami 5kg Premium Quality',
          'ID SKU': '1734398511748580677',
          'Nilai Variasi': '5kg',
          'Harga Ritel (Mata Uang Lokal)': 117897,
          'SKU Penjual': 'LL-5KG',
          'Pembelian minimum per pesanan': 1,
        },
        {
          'ID Produk': '1736900846142653764',
          Kategori: 'Makanan & Minuman > Sembako > Minyak Goreng',
          'Nama produk': 'Minyak Fortune Bantal Kemasan 1 Liter Karton Isi 12',
          'ID SKU': '1736900846142653765',
          'Nilai Variasi': '1 Karton',
          'Harga Ritel (Mata Uang Lokal)': 378000,
          'SKU Penjual': 'FTN-12L',
          'Pembelian minimum per pesanan': 1,
        },
      ];
      const ws = XLSX.utils.json_to_sheet(sample);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Template TikTok Harga');
      XLSX.writeFile(wb, 'TEMPLATE_TIKTOK_HARGA_NAMA.xlsx');
    } else {
      const sample = [
        {
          'ID Produk': '1734398511748580676',
          Kategori: 'Makanan & Minuman > Sembako > Beras',
          'Nama produk': 'Lahap Lele Beras Pulen & Putih Alami 5kg Premium Quality',
          'Gambar utama': 'https://p16-oec-va.ibyteimg.com/tos-maliva-i-o3syd0/sample_main.jpeg',
          'Gambar 2': 'https://p16-oec-va.ibyteimg.com/tos-maliva-i-o3syd0/sample_2.jpeg',
          'Gambar 3': '',
          'Gambar 4': '',
          'Gambar 5': '',
          'Gambar 6': '',
          'Gambar 7': '',
          'Gambar Produk 8': '',
          'Gambar Produk 9': '',
          'Bagan Ukuran': '',
        },
      ];
      const ws = XLSX.utils.json_to_sheet(sample);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Template TikTok Foto');
      XLSX.writeFile(wb, 'TEMPLATE_TIKTOK_FOTO_PRODUK.xlsx');
    }
  };

  const isV1 = activeVersion === 'v1_pricing';
  const hasRows = isV1 ? v1Rows.length > 0 : v2Rows.length > 0;
  const matchedCount = isV1
    ? v1Rows.filter((r) => r.matchedProduct).length
    : v2Rows.filter((r) => r.matchedProduct).length;
  const newCount = isV1
    ? v1Rows.filter((r) => r.isNewProduct).length
    : v2Rows.filter((r) => r.isNewProduct).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 md:p-6 backdrop-blur-sm animate-fade-in font-sans">
      <div className="w-full max-w-5xl rounded-[2.5rem] border border-slate-200 bg-white p-6 md:p-8 shadow-[0_30px_90px_-20px_rgba(15,23,42,0.45)] max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-black text-white">
                <svg width="12" height="12" viewBox="0 0 32 32" fill="white">
                  <path d="M16 2a14 14 0 1 0 14 14A14 14 0 0 0 16 2zm4.8 11.2a4.4 4.4 0 0 1-2.8-1v5.6a4.8 4.8 0 1 1-4.8-4.8c.3 0 .7 0 1 .1v2.7a2.1 2.1 0 1 0 1.1 1.9v-9.5h2.7a4.4 4.4 0 0 0 2.8 1.5z" />
                </svg>
                TikTok Shop Import
              </span>
              {detectedVersion && (
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  Auto-detected: {detectedVersion === 'v1_pricing' ? 'Versi 1 (Harga & SKU)' : 'Versi 2 (URL Foto)'}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-black text-slate-900 mt-2 tracking-tight">
              Import Data TikTok Shop (2 Versi)
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Sinkronkan harga ritel, nama, varian SKU, atau foto produk langsung dari file Excel export TikTok Shop.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isApplying}
            className="p-2.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 pb-3">
          <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl gap-1">
            <button
              type="button"
              onClick={() => {
                setActiveVersion('v1_pricing');
                if (detectedVersion === 'v2_images') setV2Rows([]);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                activeVersion === 'v1_pricing'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <DollarSign size={15} />
              Versi 1: Harga, Nama & SKU
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveVersion('v2_images');
                if (detectedVersion === 'v1_pricing') setV1Rows([]);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                activeVersion === 'v2_images'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ImageIcon size={15} />
              Versi 2: URL Photo Produk
            </button>
          </div>

          <button
            type="button"
            onClick={() => downloadSampleTemplate(activeVersion)}
            className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-xl transition-all"
          >
            <Download size={14} />
            Unduh Template {activeVersion === 'v1_pricing' ? 'Harga' : 'Foto'} (.xlsx)
          </button>
        </div>

        {/* File Dropzone & Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4">
          {/* Dropzone */}
          <div className="md:col-span-2">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-black rounded-3xl p-5 text-center cursor-pointer bg-slate-50 hover:bg-white transition-all flex flex-col items-center justify-center gap-2"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                disabled={isProcessing || isApplying}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-black text-white flex items-center justify-center shadow-md">
                <Upload size={20} />
              </div>
              <p className="text-xs font-black text-slate-800">
                {fileName ? fileName : 'Klik atau seret file Excel TikTok Shop di sini'}
              </p>
              <p className="text-[11px] text-slate-400">
                Mendukung format export TikTok Seller Center (.xlsx / .xls)
              </p>
            </div>
          </div>

          {/* Options Card */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-4 flex flex-col justify-between gap-3 text-xs">
            <div>
              <p className="font-black text-slate-800 uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
                <Sparkles size={13} className="text-amber-500" />
                Opsi Sinkronisasi
              </p>
              <div className="space-y-2.5">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoCreateNew}
                    onChange={(e) => setAutoCreateNew(e.target.checked)}
                    className="mt-0.5 rounded text-black focus:ring-black"
                  />
                  <span className="text-slate-600 font-semibold leading-tight">
                    Daftarkan produk baru otomatis jika belum ada di Atayatoko
                  </span>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoActivate}
                    onChange={(e) => setAutoActivate(e.target.checked)}
                    className="mt-0.5 rounded text-black focus:ring-black"
                  />
                  <span className="text-slate-600 font-semibold leading-tight">
                    Aktifkan produk jika sebelumnya nonaktif/diarsipkan
                  </span>
                </label>

                {isV1 && (
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={updateDbName}
                      onChange={(e) => setUpdateDbName(e.target.checked)}
                      className="mt-0.5 rounded text-black focus:ring-black"
                    />
                    <span className="text-slate-600 font-semibold leading-tight">
                      Perbarui nama produk Atayatoko sesuai judul TikTok
                    </span>
                  </label>
                )}
              </div>
            </div>

            <div className="text-[11px] text-slate-500 bg-white/70 p-2.5 rounded-xl border border-slate-200/60">
              💡 <span className="font-bold">Tips:</span> Sistem mencocokkan otomatis via SKU Penjual, ID TikTok, atau kesamaan nama produk.
            </div>
          </div>
        </div>

        {/* Preview Summary Bar */}
        {hasRows && (
          <div className="bg-slate-900 text-white rounded-2xl px-5 py-3 flex flex-wrap items-center justify-between gap-4 text-xs font-bold mb-3">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase tracking-wider">Total Baris</span>
                <span className="text-base font-black">{isV1 ? v1Rows.length : v2Rows.length}</span>
              </div>
              <div className="border-l border-slate-700 pl-6">
                <span className="text-emerald-400 block text-[10px] uppercase tracking-wider">Cocok di Database</span>
                <span className="text-base font-black text-emerald-300">{matchedCount}</span>
              </div>
              <div className="border-l border-slate-700 pl-6">
                <span className="text-amber-400 block text-[10px] uppercase tracking-wider">Produk Baru</span>
                <span className="text-base font-black text-amber-300">{newCount}</span>
              </div>
            </div>

            <div className="text-right text-[11px] text-slate-300">
              {isV1 ? 'Siap memperbarui harga channel TikTok' : 'Siap memperbarui foto produk'}
            </div>
          </div>
        )}

        {/* Progress Bar (While applying) */}
        {isApplying && (
          <div className="mb-4 bg-blue-50 border border-blue-200 p-4 rounded-2xl">
            <div className="flex justify-between items-center mb-1 text-xs font-bold text-blue-900">
              <span>{progressText}</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="w-full bg-blue-200 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Table Preview */}
        <div className="flex-1 overflow-auto rounded-2xl border border-slate-200 min-h-[220px]">
          {isV1 ? (
            <table className="min-w-full text-left text-xs divide-y divide-slate-100">
              <thead className="bg-slate-50 text-slate-600 sticky top-0 z-10 font-black uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Status Matching</th>
                  <th className="px-4 py-3">Nama Produk (TikTok)</th>
                  <th className="px-4 py-3">ID SKU / Variasi</th>
                  <th className="px-4 py-3 text-right">Harga TikTok</th>
                  <th className="px-4 py-3">Target Atayatoko</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {v1Rows.length ? (
                  v1Rows.slice(0, 100).map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3">
                        {row.matchedProduct ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={12} /> Cocok
                          </span>
                        ) : autoCreateNew ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200">
                            <Sparkles size={12} /> Buat Baru
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-500">
                            Dilewati
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-xs font-bold text-slate-800 truncate" title={row.name}>
                        {row.name}
                        {row.sellerSku && (
                          <span className="block text-[10px] text-slate-400 font-normal">
                            SKU Penjual: {row.sellerSku}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-700">{row.variation || 'Standar'}</span>
                        <span className="block text-[10px] text-slate-400">Unit: {row.unitCode}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-black text-slate-900">
                        Rp{row.price.toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-medium">
                        {row.matchedProduct ? (
                          <div>
                            <span className="font-bold text-slate-800">{row.matchedProduct.name}</span>
                            <span className="block text-[10px] text-slate-400">
                              ID: {row.matchedProduct.id} {row.matchedProduct.is_active === false && '(Nonaktif ➔ Akan diaktifkan)'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Akan dibuat sebagai produk baru</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center text-slate-400 font-bold">
                      Belum ada file yang diunggah. Silakan upload file Excel TikTok Shop Anda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="min-w-full text-left text-xs divide-y divide-slate-100">
              <thead className="bg-slate-50 text-slate-600 sticky top-0 z-10 font-black uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Foto</th>
                  <th className="px-4 py-3">Nama Produk (TikTok)</th>
                  <th className="px-4 py-3">URL Foto Utama</th>
                  <th className="px-4 py-3">Target Atayatoko</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {v2Rows.length ? (
                  v2Rows.slice(0, 100).map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3">
                        {row.matchedProduct ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={12} /> Cocok
                          </span>
                        ) : autoCreateNew ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200">
                            <Sparkles size={12} /> Buat Baru
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-500">
                            Dilewati
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.mainImage ? (
                          <img
                            src={row.mainImage}
                            alt="preview"
                            className="w-10 h-10 object-cover rounded-lg border border-slate-200 shadow-xs"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                            <ImageIcon size={16} />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-xs font-bold text-slate-800 truncate" title={row.name}>
                        {row.name}
                        {row.extraImages.length > 0 && (
                          <span className="block text-[10px] text-indigo-600 font-semibold">
                            +{row.extraImages.length} foto galeri
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate text-[11px] text-slate-500" title={row.mainImage}>
                        {row.mainImage || '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-medium">
                        {row.matchedProduct ? (
                          <div>
                            <span className="font-bold text-slate-800">{row.matchedProduct.name}</span>
                            <span className="block text-[10px] text-slate-400">
                              ID: {row.matchedProduct.id} {row.matchedProduct.is_active === false && '(Nonaktif ➔ Akan diaktifkan)'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Akan dibuat sebagai produk baru</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center text-slate-400 font-bold">
                      Belum ada file yang diunggah. Silakan upload file Excel URL Foto Produk TikTok Anda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 mt-4">
          <div className="text-xs text-slate-500">
            {hasRows && (
              <span>
                Menampilkan maksimal 100 baris preview (Total: {isV1 ? v1Rows.length : v2Rows.length} baris).
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isApplying}
              className="w-full sm:w-auto rounded-2xl border border-slate-200 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 transition-all"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleApplyChanges}
              disabled={!hasRows || isApplying}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl bg-black hover:bg-slate-800 text-white px-6 py-2.5 text-xs font-black uppercase tracking-wider shadow-lg shadow-black/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isApplying ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Menerapkan Perubahan...
                </>
              ) : (
                <>
                  <Check size={14} />
                  Terapkan ke Database ({isV1 ? v1Rows.length : v2Rows.length})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
