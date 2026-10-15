'use client';

import { useState, useRef } from 'react';
import {
  X,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  DollarSign,
  Sparkles,
  Check,
  RefreshCw,
} from 'lucide-react';
import notify from '@/lib/notify';
import { supabase } from '@/lib/supabase';

export type ShopeeImportVersion = 'v1_pricing' | 'v2_images';

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

interface ParsedV1ShopeeRow {
  kodeProduk: string;
  namaProduk: string;
  kodeVariasi: string;
  namaVariasi: string;
  skuInduk: string;
  sku: string;
  harga: number;
  gtin: string;
  stok: number;
  minPembelian?: number;
  // Match results
  matchedProduct?: DbProduct;
  isNewProduct: boolean;
  unitCode: string;
}

interface ParsedV2ShopeeRow {
  kodeProduk: string;
  namaProduk: string;
  fotoSampul: string;
  fotoTambahan: string[];
  panduanUkuran?: string;
  videoProduk?: string;
  // Match results
  matchedProduct?: DbProduct;
  isNewProduct: boolean;
}

interface ShopeeImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialVersion?: ShopeeImportVersion;
}

export default function ShopeeImportModal({
  isOpen,
  onClose,
  onSuccess,
  initialVersion = 'v1_pricing',
}: ShopeeImportModalProps) {
  const [activeVersion, setActiveVersion] = useState<ShopeeImportVersion>(initialVersion);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressText, setProgressText] = useState<string>('');

  // Options
  const [autoCreateNew, setAutoCreateNew] = useState(true);
  const [saveAsDraft, setSaveAsDraft] = useState(true);
  const [autoActivate, setAutoActivate] = useState(false);
  const [updateDbName, setUpdateDbName] = useState(false);

  // Parsed Data
  const [v1Rows, setV1Rows] = useState<ParsedV1ShopeeRow[]>([]);
  const [v2Rows, setV2Rows] = useState<ParsedV2ShopeeRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [detectedVersion, setDetectedVersion] = useState<ShopeeImportVersion | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const cleanStr = (s?: string) =>
    (s || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const parseNumber = (val: unknown): number => {
    if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
    if (!val) return 0;
    const clean = String(val).replace(/[^0-9,-]/g, '').replace(',', '.');
    const num = parseFloat(clean);
    return Number.isFinite(num) ? num : 0;
  };

  const findMatchingProduct = (
    row: {
      kodeProduk?: string;
      sku?: string;
      skuInduk?: string;
      gtin?: string;
      namaProduk?: string;
    },
    dbProducts: DbProduct[]
  ): DbProduct | undefined => {
    // 1. Match by SKU / SKU Induk / GTIN
    const candidateSkus = [row.sku, row.skuInduk, row.gtin].filter(Boolean).map((s) => cleanStr(s));
    for (const skuTarget of candidateSkus) {
      if (!skuTarget) continue;
      const found = dbProducts.find((p) => {
        const pSku = cleanStr(p.sku);
        const pBarcode = cleanStr(p.barcode);
        const pRawId = cleanStr(p.raw_data?.ID);
        return pSku === skuTarget || pBarcode === skuTarget || pRawId === skuTarget;
      });
      if (found) return found;
    }

    // 2. Match by Shopee Product ID
    if (row.kodeProduk) {
      const found = dbProducts.find(
        (p) =>
          p.raw_data?.shopeeProductId === row.kodeProduk ||
          p.raw_data?.shopee_id === row.kodeProduk ||
          p.id === row.kodeProduk
      );
      if (found) return found;
    }

    // 3. Match by Name
    if (row.namaProduk) {
      const cleanRowName = cleanStr(row.namaProduk);
      if (!cleanRowName) return undefined;

      const exact = dbProducts.find((p) => cleanStr(p.name) === cleanRowName);
      if (exact) return exact;

      const candidates = dbProducts.filter((p) => {
        const cleanPName = cleanStr(p.name);
        if (cleanPName.length < 4) return false;

        // DB name is substring of Shopee long name
        if (cleanRowName.includes(cleanPName)) return true;

        // All significant words of DB name exist in Shopee name
        const pWords = cleanPName.split(' ').filter((w) => w.length > 2);
        if (pWords.length >= 2 && pWords.every((w) => cleanRowName.includes(w))) {
          return true;
        }

        // Reverse: all significant words of V2/row name exist in DB name
        // (handles case where V1 stored full Shopee title, V2 has shorter name)
        const rowWords = cleanRowName.split(' ').filter((w) => w.length > 2);
        if (rowWords.length >= 2 && rowWords.every((w) => cleanPName.includes(w))) {
          return true;
        }

        return false;
      });

      if (candidates.length === 1) return candidates[0];
      if (candidates.length > 1) {
        candidates.sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0));
        return candidates[0];
      }
    }

    return undefined;
  };

  /**
   * Helper to parse Shopee Excel sheets resilience-wise.
   * Finds the actual header row (which may be row 0, 1, or 2 in Shopee templates).
   */
  const extractShopeeRows = (sheet: any, XLSX: any): Record<string, any>[] => {
    const rawArrays = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    if (!rawArrays || !rawArrays.length) return [];

    let headerIndex = -1;
    for (let r = 0; r < Math.min(rawArrays.length, 10); r++) {
      const row = rawArrays[r];
      if (!Array.isArray(row)) continue;
      const joined = row.map((c) => String(c || '').toLowerCase()).join(' ');
      if (
        (joined.includes('kode produk') || joined.includes('nama produk')) &&
        (joined.includes('harga') || joined.includes('sku') || joined.includes('foto') || joined.includes('gambar'))
      ) {
        headerIndex = r;
        break;
      }
    }

    if (headerIndex === -1) {
      // Default to row 0
      return XLSX.utils.sheet_to_json(sheet) as Record<string, any>[];
    }

    const headers = rawArrays[headerIndex].map((h) => String(h || '').trim());
    const dataRows: Record<string, any>[] = [];

    for (let r = headerIndex + 1; r < rawArrays.length; r++) {
      const row = rawArrays[r];
      if (!Array.isArray(row) || !row.some((cell) => cell !== undefined && cell !== '')) continue;
      const obj: Record<string, any> = {};
      headers.forEach((h, colIdx) => {
        if (h) obj[h] = row[colIdx];
      });
      dataRows.push(obj);
    }

    return dataRows;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);
    const toastId = notify.admin.loading(`Membaca file ${file.name}...`);

    try {
      // Fetch all products from Supabase
      const { data: dbProductsRaw, error: dbError } = await supabase
        .from('products')
        .select('id, name, sku, barcode, category, unit, price, cost_price, stock, image_url, is_active, raw_data');

      if (dbError) throw dbError;
      const dbProducts = (dbProductsRaw || []) as DbProduct[];

      const buffer = await file.arrayBuffer();
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      const rawJson = extractShopeeRows(sheet, XLSX);
      if (!rawJson.length) {
        throw new Error('File Excel tidak memiliki baris data yang valid.');
      }

      const sampleRow = rawJson[0] || {};
      const keys = Object.keys(sampleRow).map((k) => k.trim().toLowerCase());

      const hasMediaCol = keys.some(
        (k) =>
          k.includes('foto sampul') ||
          k.includes('gambar sampul') ||
          k.includes('foto produk 1') ||
          k.includes('gambar produk 1') ||
          k.includes('foto variasi')
      );
      const hasPriceCol = keys.some(
        (k) =>
          k.includes('harga') ||
          k.includes('kode variasi') ||
          k.includes('nama variasi') ||
          k.includes('sku induk')
      );

      let targetVer: ShopeeImportVersion = activeVersion;
      if (hasMediaCol && !hasPriceCol) {
        targetVer = 'v2_images';
        setActiveVersion('v2_images');
        setDetectedVersion('v2_images');
      } else if (hasPriceCol && !hasMediaCol) {
        targetVer = 'v1_pricing';
        setActiveVersion('v1_pricing');
        setDetectedVersion('v1_pricing');
      } else {
        setDetectedVersion(null);
      }

      if (targetVer === 'v1_pricing') {
        const parsed: ParsedV1ShopeeRow[] = [];
        rawJson.forEach((row) => {
          const getVal = (possibleKeys: string[]) => {
            for (const pk of possibleKeys) {
              const matchedKey = Object.keys(row).find((k) => k.trim().toLowerCase() === pk.toLowerCase());
              if (matchedKey && row[matchedKey] !== undefined) return String(row[matchedKey]).trim();
            }
            return '';
          };

          const kodeProduk = getVal(['Kode Produk', 'ID Produk', 'Product ID']);
          const namaProduk = getVal(['Nama Produk', 'Product Name']);
          const kodeVariasi = getVal(['Kode Variasi', 'Variation ID']);
          const namaVariasi = getVal(['Nama Variasi', 'Variation Name', 'Model Name']);
          const skuInduk = getVal(['SKU Induk', 'Parent SKU']);
          const sku = getVal(['SKU', 'Nomor Referensi SKU', 'Variation SKU']);
          const hargaRaw = getVal(['Harga', 'Harga Jual', 'Price']);
          const harga = parseNumber(hargaRaw);
          const gtin = getVal(['GTIN', 'Barcode']);
          const stok = parseNumber(getVal(['Stok', 'Stock']));
          const minPembelian = parseNumber(getVal(['Min. Jumlah Pembelian', 'Min Purchase']) || 1);

          if (!namaProduk && !kodeProduk && !sku) return;

          const matched = findMatchingProduct({ kodeProduk, sku, skuInduk, gtin, namaProduk }, dbProducts);
          const unitCode = (namaVariasi || matched?.unit || 'PCS').toString().toUpperCase().trim();

          parsed.push({
            kodeProduk,
            namaProduk,
            kodeVariasi,
            namaVariasi,
            skuInduk,
            sku,
            harga,
            gtin,
            stok,
            minPembelian,
            matchedProduct: matched,
            isNewProduct: !matched,
            unitCode,
          });
        });

        setV1Rows(parsed);
        setV2Rows([]);
        notify.admin.success(
          `Terbaca ${parsed.length} baris data Shopee (${parsed.filter((p) => p.matchedProduct).length} produk cocok).`,
          { id: toastId }
        );
      } else {
        const parsed: ParsedV2ShopeeRow[] = [];
        rawJson.forEach((row) => {
          const getVal = (possibleKeys: string[]) => {
            for (const pk of possibleKeys) {
              const matchedKey = Object.keys(row).find((k) => k.trim().toLowerCase() === pk.toLowerCase());
              if (matchedKey && row[matchedKey] !== undefined) return String(row[matchedKey]).trim();
            }
            return '';
          };

          const kodeProduk = getVal(['Kode Produk', 'ID Produk', 'Product ID']);
          const namaProduk = getVal(['Nama Produk', 'Product Name']);
          const fotoSampul = getVal([
            'Foto Sampul',
            'Gambar Sampul',
            'Cover Image',
            'Foto Utama',
            'Gambar Utama',
            'Foto Produk 1',
          ]);
          const panduanUkuran = getVal(['Panduan Ukuran', 'Bagan Ukuran', 'Size Chart']);
          const videoProduk = getVal(['Video Produk', 'Video']);

          const fotoTambahan: string[] = [];
          for (let i = 1; i <= 8; i++) {
            const val = getVal([`Foto Produk ${i}`, `Gambar Produk ${i}`, `Foto ${i}`, `Gambar ${i}`]);
            if (val && val.startsWith('http') && val !== fotoSampul) {
              fotoTambahan.push(val);
            }
          }
          const fotoVar = getVal(['Foto Variasi', 'Gambar Variasi']);
          if (fotoVar && fotoVar.startsWith('http') && !fotoTambahan.includes(fotoVar) && fotoVar !== fotoSampul) {
            fotoTambahan.push(fotoVar);
          }

          if (!namaProduk && !kodeProduk && !fotoSampul) return;

          const matched = findMatchingProduct({ kodeProduk, namaProduk }, dbProducts);

          parsed.push({
            kodeProduk,
            namaProduk,
            fotoSampul,
            fotoTambahan,
            panduanUkuran,
            videoProduk,
            matchedProduct: matched,
            isNewProduct: !matched,
          });
        });

        setV2Rows(parsed);
        setV1Rows([]);
        notify.admin.success(
          `Terbaca ${parsed.length} baris foto Shopee (${parsed.filter((p) => p.matchedProduct).length} produk cocok).`,
          { id: toastId }
        );
      }
    } catch (err: any) {
      console.error(err);
      notify.admin.error(err?.message || 'Gagal memproses file Excel Shopee.', { id: toastId });
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

      // Re-fetch products dari DB saat apply (bukan saat parse)
      // Ini penting agar V2 bisa menemukan produk DRAFT yang baru dibuat oleh V1
      setProgressText('Memuat ulang data produk terbaru dari database...');
      const { data: freshDbRaw } = await supabase
        .from('products')
        .select('id, name, sku, barcode, category, unit, price, cost_price, stock, image_url, is_active, raw_data');
      const freshDb = (freshDbRaw || []) as DbProduct[];

      // Re-match baris yang belum cocok dengan data DB terbaru
      if (isV1) {
        for (let i = 0; i < v1Rows.length; i++) {
          if (!v1Rows[i].matchedProduct) {
            const fresh = findMatchingProduct(v1Rows[i], freshDb);
            if (fresh) v1Rows[i] = { ...v1Rows[i], matchedProduct: fresh, isNewProduct: false };
          }
        }
      } else {
        for (let i = 0; i < v2Rows.length; i++) {
          if (!v2Rows[i].matchedProduct) {
            const fresh = findMatchingProduct(v2Rows[i], freshDb);
            if (fresh) v2Rows[i] = { ...v2Rows[i], matchedProduct: fresh, isNewProduct: false };
          }
        }
      }

      if (isV1) {
        const CHUNK_SIZE = 50;
        for (let i = 0; i < v1Rows.length; i += CHUNK_SIZE) {
          const chunk = v1Rows.slice(i, i + CHUNK_SIZE);

          await Promise.all(
            chunk.map(async (row) => {
              if (row.matchedProduct) {
                const existing = row.matchedProduct;
                const existingRaw = existing.raw_data || {};
                const existingPricing = (existingRaw.channelPricing || {}) as Record<string, any>;
                if (!existingPricing.shopee) existingPricing.shopee = {};

                const unitKey = row.unitCode || (existing.unit || 'PCS').toString().toUpperCase();
                existingPricing.shopee[unitKey] = { price: row.harga };

                const updatedRaw: Record<string, any> = {
                  ...existingRaw,
                  channelPricing: existingPricing,
                  priceShopee: row.harga,
                  shopeeProductId: row.kodeProduk || existingRaw.shopeeProductId,
                  shopeeVariationId: row.kodeVariasi || existingRaw.shopeeVariationId,
                  updatedAt: now,
                };

                if (autoActivate) {
                  updatedRaw.isActive = true;
                }
                if (updateDbName && row.namaProduk) {
                  updatedRaw.name = row.namaProduk;
                }

                const updatePayload: Record<string, any> = {
                  raw_data: updatedRaw,
                  updated_at: now,
                };

                if (autoActivate) {
                  updatePayload.is_active = true;
                }
                if (updateDbName && row.namaProduk) {
                  updatePayload.name = row.namaProduk;
                }

                await supabase.from('products').update(updatePayload).eq('id', existing.id);
                updatedCount++;
              } else if (autoCreateNew) {
                const newId = `prod_sh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                const unitKey = row.unitCode || 'PCS';
                const productSku = row.sku || row.skuInduk || row.kodeProduk || `SKU-SH-${Date.now()}`;
                const isItemActive = !saveAsDraft;

                const rawData = {
                  name: row.namaProduk || 'Produk Shopee',
                  sku: productSku,
                  category: 'Shopee',
                  unit: unitKey,
                  price: row.harga,
                  costPrice: 0,
                  stock: row.stok || 0,
                  isActive: isItemActive,
                  Status: isItemActive ? 1 : 0,
                  status: isItemActive ? 'ACTIVE' : 'DRAFT',
                  isDraft: !isItemActive,
                  shopeeProductId: row.kodeProduk,
                  shopeeVariationId: row.kodeVariasi,
                  channelPricing: {
                    shopee: {
                      [unitKey]: { price: row.harga },
                    },
                  },
                  createdAt: now,
                  updatedAt: now,
                };

                await supabase.from('products').insert({
                  id: newId,
                  name: row.namaProduk || 'Produk Shopee',
                  sku: productSku,
                  category: 'Shopee',
                  unit: unitKey,
                  price: row.harga,
                  cost_price: 0,
                  stock: row.stok || 0,
                  is_active: isItemActive,
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
        const CHUNK_SIZE = 50;
        for (let i = 0; i < v2Rows.length; i += CHUNK_SIZE) {
          const chunk = v2Rows.slice(i, i + CHUNK_SIZE);

          await Promise.all(
            chunk.map(async (row) => {
              if (row.matchedProduct && row.fotoSampul) {
                const existing = row.matchedProduct;
                const existingRaw = existing.raw_data || {};
                const allImages = [row.fotoSampul, ...row.fotoTambahan].filter(Boolean);

                const updatedRaw: Record<string, any> = {
                  ...existingRaw,
                  image_url: row.fotoSampul,
                  image: row.fotoSampul,
                  imageUrl: row.fotoSampul,
                  Link_Foto: row.fotoSampul,
                  images: allImages,
                  shopeeProductId: row.kodeProduk || existingRaw.shopeeProductId,
                  updatedAt: now,
                };

                if (autoActivate) {
                  updatedRaw.isActive = true;
                }

                const updatePayload: Record<string, any> = {
                  image_url: row.fotoSampul,
                  raw_data: updatedRaw,
                  updated_at: now,
                };

                if (autoActivate) {
                  updatePayload.is_active = true;
                }

                await supabase.from('products').update(updatePayload).eq('id', existing.id);
                updatedCount++;
              } else if (autoCreateNew && !row.matchedProduct && row.fotoSampul) {
                const newId = `prod_sh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                const productSku = row.kodeProduk ? `SH-${row.kodeProduk}` : `SKU-SH-${Date.now()}`;
                const allImages = [row.fotoSampul, ...row.fotoTambahan].filter(Boolean);
                const isItemActive = !saveAsDraft;

                const rawData = {
                  name: row.namaProduk || 'Produk Shopee',
                  sku: productSku,
                  category: 'Shopee',
                  unit: 'PCS',
                  price: 0,
                  costPrice: 0,
                  stock: 0,
                  image_url: row.fotoSampul,
                  imageUrl: row.fotoSampul,
                  image: row.fotoSampul,
                  Link_Foto: row.fotoSampul,
                  images: allImages,
                  isActive: isItemActive,
                  Status: isItemActive ? 1 : 0,
                  status: isItemActive ? 'ACTIVE' : 'DRAFT',
                  isDraft: !isItemActive,
                  shopeeProductId: row.kodeProduk,
                  createdAt: now,
                  updatedAt: now,
                };

                await supabase.from('products').insert({
                  id: newId,
                  name: row.namaProduk || 'Produk Shopee',
                  sku: productSku,
                  category: 'Shopee',
                  unit: 'PCS',
                  price: 0,
                  cost_price: 0,
                  stock: 0,
                  image_url: row.fotoSampul,
                  is_active: isItemActive,
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
        saveAsDraft && createdCount > 0
          ? `Sukses! ${updatedCount} harga produk diperbarui, ${createdCount} produk baru tersimpan di DRAFT (Nonaktif) untuk dipilih.`
          : `Sukses! ${updatedCount} produk diperbarui, ${createdCount} produk baru didaftarkan.`,
        { id: toastId, duration: 5000 }
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

  const downloadSampleTemplate = async (version: ShopeeImportVersion) => {
    const XLSX = await import('xlsx');
    if (version === 'v1_pricing') {
      const sample = [
        {
          'Kode Produk': '23984102941',
          'Nama Produk': 'Beras Lahap Lele 5kg Premium Pulen Berkualitas Terjamin',
          'Kode Variasi': '84910248102',
          'Nama Variasi': '5kg',
          'SKU Induk': 'LL-PARENT',
          SKU: 'LL-5KG',
          Harga: 118000,
          GTIN: '8991234567890',
          Stok: 50,
          'Min. Jumlah Pembelian': 1,
          'Maks. Jumlah Pembelian': 10,
        },
        {
          'Kode Produk': '24102840192',
          'Nama Produk': 'Minyak Goreng Fortune Kemasan Bantal 1 Liter Karton Isi 12',
          'Kode Variasi': '',
          'Nama Variasi': '1 Karton',
          'SKU Induk': 'FTN-12L',
          SKU: 'FTN-12L',
          Harga: 378000,
          GTIN: '',
          Stok: 25,
          'Min. Jumlah Pembelian': 1,
          'Maks. Jumlah Pembelian': 5,
        },
      ];
      const ws = XLSX.utils.json_to_sheet(sample);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Template Shopee Harga');
      XLSX.writeFile(wb, 'TEMPLATE_SHOPEE_HARGA_NAMA.xlsx');
    } else {
      const sample = [
        {
          'Kode Produk': '23984102941',
          'Nama Produk': 'Beras Lahap Lele 5kg Premium Pulen Berkualitas Terjamin',
          'Foto Sampul': 'https://cf.shopee.co.id/file/sample_cover.jpeg',
          'Foto Produk 1': 'https://cf.shopee.co.id/file/sample_1.jpeg',
          'Foto Produk 2': 'https://cf.shopee.co.id/file/sample_2.jpeg',
          'Foto Produk 3': '',
          'Foto Produk 4': '',
          'Foto Produk 5': '',
          'Foto Produk 6': '',
          'Foto Produk 7': '',
          'Foto Produk 8': '',
          'Foto Variasi': '',
          'Panduan Ukuran': '',
        },
      ];
      const ws = XLSX.utils.json_to_sheet(sample);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Template Shopee Foto');
      XLSX.writeFile(wb, 'TEMPLATE_SHOPEE_FOTO_MEDIA.xlsx');
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
      <div className="w-full max-w-5xl rounded-[2.5rem] border border-orange-200 bg-white p-6 md:p-8 shadow-[0_30px_90px_-20px_rgba(238,77,45,0.35)] max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-orange-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-[#EE4D2D] text-white shadow-xs">
                <svg width="12" height="12" viewBox="0 0 100 100" fill="white">
                  <circle cx="50" cy="50" r="46" fill="white" />
                  <text x="50" y="68" textAnchor="middle" fontSize="52" fill="#EE4D2D" fontWeight="bold">
                    S
                  </text>
                </svg>
                Shopee Import
              </span>
              {detectedVersion && (
                <span className="text-[10px] font-black uppercase tracking-widest text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-0.5 rounded-full">
                  Auto-detected: {detectedVersion === 'v1_pricing' ? 'Versi 1 (Harga & SKU)' : 'Versi 2 (URL Media/Foto)'}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-black text-slate-900 mt-2 tracking-tight">
              Import Data Shopee (2 Versi)
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Sinkronkan harga ritel, nama, varian SKU, atau foto produk langsung dari file Excel export Shopee Seller Centre.
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
          <div className="flex items-center bg-orange-50 p-1.5 rounded-2xl gap-1">
            <button
              type="button"
              onClick={() => {
                setActiveVersion('v1_pricing');
                if (detectedVersion === 'v2_images') setV2Rows([]);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                activeVersion === 'v1_pricing'
                  ? 'bg-white text-[#EE4D2D] shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <DollarSign size={15} />
              Versi 1: Harga, Nama & Variasi
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveVersion('v2_images');
                if (detectedVersion === 'v1_pricing') setV1Rows([]);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                activeVersion === 'v2_images'
                  ? 'bg-white text-[#EE4D2D] shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ImageIcon size={15} />
              Versi 2: URL Media / Foto Produk
            </button>
          </div>

          <button
            type="button"
            onClick={() => downloadSampleTemplate(activeVersion)}
            className="flex items-center gap-2 text-xs font-bold text-orange-600 hover:text-orange-800 bg-orange-50 hover:bg-orange-100 px-3 py-2 rounded-xl transition-all"
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
              className="border-2 border-dashed border-orange-200 hover:border-[#EE4D2D] rounded-3xl p-5 text-center cursor-pointer bg-orange-50/30 hover:bg-white transition-all flex flex-col items-center justify-center gap-2"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                disabled={isProcessing || isApplying}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-[#EE4D2D] text-white flex items-center justify-center shadow-md shadow-orange-200">
                <Upload size={20} />
              </div>
              <p className="text-xs font-black text-slate-800">
                {fileName ? fileName : 'Klik atau seret file Excel Shopee Seller Centre di sini'}
              </p>
              <p className="text-[11px] text-slate-400">
                Mendukung template Update Massal Shopee: Info Penjualan / Media Info (.xlsx / .xls)
              </p>
            </div>
          </div>

          {/* Options Card */}
          <div className="bg-orange-50/50 border border-orange-100 rounded-3xl p-4 flex flex-col justify-between gap-3 text-xs">
            <div>
              <p className="font-black text-slate-800 uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
                <Sparkles size={13} className="text-orange-500" />
                Opsi Sinkronisasi
              </p>
              <div className="space-y-2.5">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoCreateNew}
                    onChange={(e) => setAutoCreateNew(e.target.checked)}
                    className="mt-0.5 rounded text-[#EE4D2D] focus:ring-[#EE4D2D]"
                  />
                  <span className="text-slate-600 font-semibold leading-tight">
                    Daftarkan produk baru otomatis jika belum ada di Atayatoko
                  </span>
                </label>

                {autoCreateNew && (
                  <label className="flex items-start gap-2.5 cursor-pointer bg-amber-50 p-2 rounded-xl border border-amber-200">
                    <input
                      type="checkbox"
                      checked={saveAsDraft}
                      onChange={(e) => setSaveAsDraft(e.target.checked)}
                      className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-amber-900 font-bold leading-tight">
                      Simpan sebagai DRAFT (Non-aktif)
                      <span className="block text-[10px] text-amber-700 font-normal mt-0.5">
                        Produk baru masuk ke tab Draft terlebih dahulu agar bisa ditinjau &amp; dipilih sebelum diaktifkan.
                      </span>
                    </span>
                  </label>
                )}

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoActivate}
                    onChange={(e) => setAutoActivate(e.target.checked)}
                    className="mt-0.5 rounded text-[#EE4D2D] focus:ring-[#EE4D2D]"
                  />
                  <span className="text-slate-600 font-semibold leading-tight">
                    Aktifkan produk jika sebelumnya nonaktif/diarsipkan (Default: Tidak)
                  </span>
                </label>

                {isV1 && (
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={updateDbName}
                      onChange={(e) => setUpdateDbName(e.target.checked)}
                      className="mt-0.5 rounded text-[#EE4D2D] focus:ring-[#EE4D2D]"
                    />
                    <span className="text-slate-600 font-semibold leading-tight">
                      Perbarui nama produk Atayatoko sesuai judul Shopee
                    </span>
                  </label>
                )}
              </div>
            </div>

            <div className="text-[11px] text-slate-500 bg-white/70 p-2.5 rounded-xl border border-orange-100">
              💡 <span className="font-bold">Tips:</span> Sistem mengenali baris header Shopee secara otomatis dan mencocokkan via SKU, GTIN, Kode Produk, atau kesamaan nama.
            </div>
          </div>
        </div>

        {/* Preview Summary Bar */}
        {hasRows && (
          <div className="bg-[#EE4D2D] text-white rounded-2xl px-5 py-3 flex flex-wrap items-center justify-between gap-4 text-xs font-bold mb-3 shadow-md shadow-orange-200">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-orange-200 block text-[10px] uppercase tracking-wider">Total Baris</span>
                <span className="text-base font-black">{isV1 ? v1Rows.length : v2Rows.length}</span>
              </div>
              <div className="border-l border-orange-400 pl-6">
                <span className="text-orange-100 block text-[10px] uppercase tracking-wider">Cocok di Database</span>
                <span className="text-base font-black text-white">{matchedCount}</span>
              </div>
              <div className="border-l border-orange-400 pl-6">
                <span className="text-amber-200 block text-[10px] uppercase tracking-wider">Produk Baru</span>
                <span className="text-base font-black text-amber-100">{newCount}</span>
              </div>
            </div>

            <div className="text-right text-[11px] text-orange-100">
              {newCount > 0 && saveAsDraft
                ? `⚠️ ${newCount} produk baru → masuk DRAFT (nonaktif)`
                : isV1 ? 'Siap memperbarui harga channel Shopee' : 'Siap memperbarui foto produk Shopee'}
            </div>
          </div>
        )}

        {/* Progress Bar (While applying) */}
        {isApplying && (
          <div className="mb-4 bg-orange-50 border border-orange-200 p-4 rounded-2xl">
            <div className="flex justify-between items-center mb-1 text-xs font-bold text-orange-900">
              <span>{progressText}</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="w-full bg-orange-200 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-[#EE4D2D] h-full rounded-full transition-all duration-300"
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
                  <th className="px-4 py-3">Nama Produk (Shopee)</th>
                  <th className="px-4 py-3">Variasi / SKU</th>
                  <th className="px-4 py-3 text-right">Harga Shopee</th>
                  <th className="px-4 py-3">Target Atayatoko</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {v1Rows.length ? (
                  v1Rows.slice(0, 100).map((row, idx) => (
                    <tr key={idx} className="hover:bg-orange-50/30 transition-colors">
                      <td className="px-4 py-3">
                        {row.matchedProduct ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={12} /> Cocok
                          </span>
                        ) : autoCreateNew ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200">
                            <Sparkles size={12} /> {saveAsDraft ? 'Draft Baru' : 'Buat Baru'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-500">
                            Dilewati
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-xs font-bold text-slate-800 truncate" title={row.namaProduk}>
                        {row.namaProduk}
                        {row.sku && (
                          <span className="block text-[10px] text-slate-400 font-normal">
                            SKU: {row.sku} {row.skuInduk && `(Induk: ${row.skuInduk})`}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-700">{row.namaVariasi || 'Standar'}</span>
                        <span className="block text-[10px] text-slate-400">Unit: {row.unitCode}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-black text-slate-900">
                        Rp{row.harga.toLocaleString('id-ID')}
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
                      Belum ada file yang diunggah. Silakan upload file Excel Shopee Seller Centre Anda.
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
                  <th className="px-4 py-3">Foto Sampul</th>
                  <th className="px-4 py-3">Nama Produk (Shopee)</th>
                  <th className="px-4 py-3">URL Foto Utama</th>
                  <th className="px-4 py-3">Target Atayatoko</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {v2Rows.length ? (
                  v2Rows.slice(0, 100).map((row, idx) => (
                    <tr key={idx} className="hover:bg-orange-50/30 transition-colors">
                      <td className="px-4 py-3">
                        {row.matchedProduct ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={12} /> Cocok
                          </span>
                        ) : autoCreateNew ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200">
                            <Sparkles size={12} /> {saveAsDraft ? 'Draft Baru' : 'Buat Baru'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-500">
                            Dilewati
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.fotoSampul ? (
                          <img
                            src={row.fotoSampul}
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
                      <td className="px-4 py-3 max-w-xs font-bold text-slate-800 truncate" title={row.namaProduk}>
                        {row.namaProduk}
                        {row.fotoTambahan.length > 0 && (
                          <span className="block text-[10px] text-orange-600 font-semibold">
                            +{row.fotoTambahan.length} foto galeri
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate text-[11px] text-slate-500" title={row.fotoSampul}>
                        {row.fotoSampul || '-'}
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
                      Belum ada file yang diunggah. Silakan upload file Excel URL Foto/Media Shopee Anda.
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
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl bg-[#EE4D2D] hover:bg-[#d83f21] text-white px-6 py-2.5 text-xs font-black uppercase tracking-wider shadow-lg shadow-orange-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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
