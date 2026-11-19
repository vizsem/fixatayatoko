'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  ArrowLeft, 
  Printer, 
  AlertTriangle, 
  Layers, 
  CheckSquare, 
  Square, 
  SlidersHorizontal,
  Plus,
  Minus,
  RefreshCw,
  QrCode,
  Barcode as BarcodeIcon,
  Tag
} from 'lucide-react';
import Barcode from 'react-barcode';
import { QRCodeSVG } from 'qrcode.react';
import { getProductsForBulkPrintAction, BulkPrintProductItem } from '@/lib/actions/product.actions';
import { sbGetDoc } from '@/lib/supabase-helpers';

type LabelSize = '50x30' | '40x30' | '60x40';

interface PrintableItem extends BulkPrintProductItem {
  copies: number;
  isSelected: boolean;
}

function BulkPrintContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idsParam = searchParams.get('ids') || '';
  
  // URL Params default
  const defaultIncludeVariants = searchParams.get('includeVariants') !== '0';
  const defaultIncludeUnits = searchParams.get('includeUnits') === '1';
  const defaultCopies = Math.max(1, parseInt(searchParams.get('copies') || '1', 10));
  const defaultSize = (['50x30', '40x30', '60x40'].includes(searchParams.get('size') || '') 
    ? searchParams.get('size') 
    : '50x30') as LabelSize;

  // Local State
  const [items, setItems] = useState<PrintableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter & Toggle State
  const [labelSize, setLabelSize] = useState<LabelSize>(defaultSize);
  const [includeVariants, setIncludeVariants] = useState<boolean>(defaultIncludeVariants);
  const [includeUnits, setIncludeUnits] = useState<boolean>(defaultIncludeUnits);
  const [showQr, setShowQr] = useState<boolean>(true);
  const [showBarcode1D, setShowBarcode1D] = useState<boolean>(true);
  const [showWholesale, setShowWholesale] = useState<boolean>(true);
  // Set satuan yang diaktifkan untuk dicetak (kosong = semua ditampilkan)
  const [activeUnitCodes, setActiveUnitCodes] = useState<Set<string>>(new Set());

  // Fetch Data Produk & Varian
  const loadData = async (incVar = includeVariants, incUnit = includeUnits) => {
    if (!idsParam.trim()) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean);
      
      // Panggil Server Action yang me-resolve Parent & Variants secara otomatis
      const res = await getProductsForBulkPrintAction(ids, {
        includeVariants: incVar,
        includeUnits: incUnit,
      });

      if (res.success && res.items && res.items.length > 0) {
        setItems(res.items.map(p => ({
          ...p,
          copies: defaultCopies,
          isSelected: true,
        })));
      } else {
        // Fallback: Jika server action mengembalikan kosong, coba sbGetDoc biasa
        const fallbackItems: PrintableItem[] = [];
        for (const id of ids) {
          const docSnap = await sbGetDoc('products', id);
          if (docSnap.exists()) {
            const data = docSnap.data();
            const sku = data.sku || data.raw_data?.sku || id.slice(0, 8);
            fallbackItems.push({
              id,
              name: data.name || data.raw_data?.Nama || 'Produk',
              displayName: data.name || data.raw_data?.Nama || 'Produk',
              isVariant: false,
              isParent: false,
              category: data.category || data.raw_data?.Kategori || 'UMUM',
              price: Number(data.price || data.raw_data?.Ecer || 0),
              wholesalePrice: Number(data.raw_data?.Grosir || 0),
              minWholesale: Number(data.raw_data?.Min_Grosir || 0),
              unit: String(data.unit || data.raw_data?.Satuan || 'PCS').toUpperCase(),
              sku,
              barcode: data.barcode || data.raw_data?.Barcode || sku,
              copies: defaultCopies,
              isSelected: true,
            });
          }
        }
        setItems(fallbackItems);
      }
    } catch (err: any) {
      console.error('Error loading bulk print products:', err);
      setErrorMsg(err?.message || 'Gagal memuat produk');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (idsParam.trim()) {
      loadData(defaultIncludeVariants, defaultIncludeUnits);
    }
  }, [idsParam]);

  // Handler update seleksi
  const toggleSelect = (id: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, isSelected: !item.isSelected } : item));
  };

  const selectAll = (val: boolean) => {
    setItems(prev => prev.map(item => ({ ...item, isSelected: val })));
  };

  const updateCopies = (id: string, delta: number) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const nextCopies = Math.max(1, item.copies + delta);
        return { ...item, copies: nextCopies };
      }
      return item;
    }));
  };

  const setAllCopies = (qty: number) => {
    const val = Math.max(1, qty);
    setItems(prev => prev.map(item => ({ ...item, copies: val })));
  };

  // Flatten items berdasarkan copies & status seleksi
  const printableList = useMemo(() => {
    const result: PrintableItem[] = [];
    items.filter(it => it.isSelected && (activeUnitCodes.size === 0 || activeUnitCodes.has(it.unit.toUpperCase()))).forEach(item => {
      for (let i = 0; i < item.copies; i++) {
        result.push(item);
      }
    });
    return result;
  }, [items, activeUnitCodes]);

  // Semua unit codes unik yang ada di items (PCS, RENCENG, DUS, dll)
  const allUnitCodes = useMemo(() => {
    const codes = new Set<string>();
    items.forEach(item => codes.add(item.unit.toUpperCase()));
    return Array.from(codes).sort();
  }, [items]);

  // Inisialisasi activeUnitCodes setiap kali items pertama kali di-load
  useEffect(() => {
    if (items.length > 0) {
      const codes = new Set<string>();
      items.forEach(item => codes.add(item.unit.toUpperCase()));
      setActiveUnitCodes(codes);
    }
  }, [items]);

  // Toggle satu unit code
  const toggleUnitCode = (code: string) => {
    setActiveUnitCodes(prev => {
      const next = new Set(prev);
      if (next.has(code)) {
        if (next.size === 1) return prev; // minimal 1 harus aktif
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const totalSelectedUnique = items.filter(it => it.isSelected && (activeUnitCodes.size === 0 || activeUnitCodes.has(it.unit.toUpperCase()))).length;
  const totalStickersToPrint = printableList.length;

  const formatRp = (n: number) => `Rp${(n || 0).toLocaleString('id-ID')}`;

  // Dimensi CSS sesuai pilihan ukuran
  const sizeStyles: Record<LabelSize, { width: string; height: string; widthMm: number; heightMm: number }> = {
    '50x30': { width: '50mm', height: '30mm', widthMm: 50, heightMm: 30 },
    '40x30': { width: '40mm', height: '30mm', widthMm: 40, heightMm: 30 },
    '60x40': { width: '60mm', height: '40mm', widthMm: 60, heightMm: 40 },
  };

  const currentSize = sizeStyles[labelSize];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <RefreshCw size={36} className="text-blue-600 animate-spin mb-3" />
        <h2 className="text-base font-black text-slate-900 uppercase tracking-wider">Menyiapkan Label Rak...</h2>
        <p className="text-xs text-slate-500 mt-1">Mengambil data produk, barcode, dan varian turunan...</p>
      </div>
    );
  }

  if (errorMsg || items.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mb-3">
          <AlertTriangle size={24} />
        </div>
        <h2 className="text-sm font-black text-slate-900 uppercase">Tidak Ada Produk Dipilih</h2>
        <p className="text-xs text-slate-500 mt-1 mb-4">{errorMsg || 'Silakan pilih produk terlebih dahulu di daftar produk.'}</p>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase"
        >
          Kembali
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-100 min-h-screen text-black font-sans pb-24">
      {/* --- TOOLBAR KONTROL DI LAYAR (NO PRINT) --- */}
      <div className="max-w-5xl mx-auto p-4 no-print pt-6">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4 bg-white p-5 rounded-3xl shadow-sm border border-slate-200/80">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.back()} 
              className="p-2.5 bg-slate-50 hover:bg-slate-900 hover:text-white rounded-2xl transition-all"
              title="Kembali"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black uppercase tracking-tight text-slate-900">
                  Cetak Label Rak Masal
                </h1>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  Thermal {labelSize}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-400">
                {totalSelectedUnique} Produk / Varian dipilih • <strong className="text-blue-600">{totalStickersToPrint} Stiker</strong> akan dicetak
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => window.print()}
              disabled={totalStickersToPrint === 0}
              className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 active:scale-95 transition-all disabled:opacity-50"
            >
              <Printer size={16} /> Cetak Sekarang ({totalStickersToPrint})
            </button>
          </div>
        </div>

        {/* Panel Pengaturan & Filter */}
        <div className="bg-white p-4 rounded-3xl shadow-xs border border-slate-200/80 mb-5 flex flex-col gap-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <SlidersHorizontal size={14} className="text-slate-500" />
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Pengaturan Label & Varian</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {/* 1. Ukuran Kertas */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Ukuran Kertas Label</label>
              <select
                value={labelSize}
                onChange={(e) => setLabelSize(e.target.value as LabelSize)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-bold text-slate-800 outline-none focus:border-blue-500"
              >
                <option value="50x30">50mm x 30mm (Standar Rak Mini)</option>
                <option value="40x30">40mm x 30mm (Kompak / Sempit)</option>
                <option value="60x40">60mm x 40mm (Supermarket)</option>
              </select>
            </div>

            {/* 2. Toggle Varian Anak */}
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={includeVariants}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIncludeVariants(checked);
                    loadData(checked, includeUnits);
                  }}
                  className="rounded text-blue-600 focus:ring-0"
                />
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <Layers size={13} className="text-purple-600" /> Sertakan Varian Anak
                </span>
              </label>
            </div>

            {/* 3. Toggle Satuan Kardus / Renceng */}
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={includeUnits}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIncludeUnits(checked);
                    loadData(includeVariants, checked);
                  }}
                  className="rounded text-blue-600 focus:ring-0"
                />
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <Tag size={13} className="text-emerald-600" /> Label Satuan Dus/Renceng
                </span>
              </label>
            </div>

            {/* 4. Set Rangkap Massal */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Set Rangkap per Produk</label>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 5].map((qty) => (
                  <button
                    key={qty}
                    type="button"
                    onClick={() => setAllCopies(qty)}
                    className="flex-1 py-1.5 bg-slate-50 hover:bg-slate-200 border border-slate-200 rounded-lg font-black text-xs text-slate-700 active:scale-95 transition-all"
                  >
                    {qty}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Toggle Elemen Barcode */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs font-bold text-slate-600">
            <label className="flex items-center gap-1.5 cursor-pointer" title="Barcode garis vertikal untuk scanner kasir tembak (menggunakan Barcode Pabrik/EAN)">
              <input
                type="checkbox"
                checked={showBarcode1D}
                onChange={(e) => setShowBarcode1D(e.target.checked)}
                className="rounded text-blue-600"
              />
              <BarcodeIcon size={14} /> Barcode 1D (Barcode Pabrik)
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer" title="QR Code matriks 2D untuk scan HP kasir / aplikasi (menggunakan SKU Toko)">
              <input
                type="checkbox"
                checked={showQr}
                onChange={(e) => setShowQr(e.target.checked)}
                className="rounded text-blue-600"
              />
              <QrCode size={14} /> QR Code (SKU Toko)
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showWholesale}
                onChange={(e) => setShowWholesale(e.target.checked)}
                className="rounded text-blue-600"
              />
              Info Grosir
            </label>

            {/* Pemilihan Satuan yang Dicetak (muncul jika ada > 1 unit code) */}
            {allUnitCodes.length > 1 && (
              <div className="flex items-center gap-2 ml-2 pl-3 border-l border-slate-200">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Satuan:</span>
                {allUnitCodes.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => toggleUnitCode(code)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-black border transition-all ${
                      activeUnitCodes.has(code)
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-slate-100 text-slate-400 border-slate-200 hover:border-slate-300'
                    }`}
                    title={activeUnitCodes.has(code) ? `Sembunyikan label ${code}` : `Tampilkan label ${code}`}
                  >
                    {code}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Petunjuk Cetak */}
        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3.5 rounded-2xl text-xs font-bold flex items-start gap-3 mb-5">
          <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-600" />
          <p className="leading-relaxed">
            <strong>Petunjuk Printer Thermal Label:</strong> Atur ukuran kertas di browser ke <strong>{labelSize === '50x30' ? '50mm × 30mm' : labelSize === '40x30' ? '40mm × 30mm' : '60mm × 40mm'}</strong>, ubah <strong>Margins</strong> menjadi <strong>None</strong>, dan pastikan skala <strong>100%</strong>.
          </p>
        </div>

        {/* Daftar Item Sebelum Dicetak */}
        <div className="bg-white rounded-3xl p-4 shadow-xs border border-slate-200/80 mb-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => selectAll(totalSelectedUnique !== items.length)}
                className="text-slate-600 hover:text-slate-900 flex items-center gap-1.5 text-xs font-bold"
              >
                {totalSelectedUnique === items.filter(it => activeUnitCodes.size === 0 || activeUnitCodes.has(it.unit.toUpperCase())).length ? (
                  <CheckSquare size={16} className="text-blue-600" />
                ) : (
                  <Square size={16} />
                )}
                <span>Pilih Semua ({items.filter(it => activeUnitCodes.size === 0 || activeUnitCodes.has(it.unit.toUpperCase())).length})</span>
              </button>
            </div>
            <span className="text-[11px] text-slate-400 font-bold">
              Klik kotak untuk membatalkan stiker tertentu
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
            {items.filter(item => activeUnitCodes.size === 0 || activeUnitCodes.has(item.unit.toUpperCase())).map((item) => (
              <div
                key={item.id}
                className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                  item.isSelected 
                    ? 'border-blue-200 bg-blue-50/40 text-slate-900' 
                    : 'border-slate-200 bg-slate-50 text-slate-400 opacity-60'
                }`}
              >
                <div 
                  className="flex items-center gap-2 min-w-0 cursor-pointer flex-1"
                  onClick={() => toggleSelect(item.id)}
                >
                  {item.isSelected ? (
                    <CheckSquare size={15} className="text-blue-600 shrink-0" />
                  ) : (
                    <Square size={15} className="shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-black truncate leading-tight">
                      {item.displayName}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] mt-0.5">
                      {item.isVariant && (
                        <span className="px-1 py-0.2 bg-purple-100 text-purple-700 rounded-sm font-bold">Varian</span>
                      )}
                      {item.isUnitLabel && (
                        <span className="px-1 py-0.2 bg-emerald-100 text-emerald-700 rounded-sm font-bold">Satuan</span>
                      )}
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-black uppercase text-[9px]">{item.unit}</span>
                      <span className="font-bold text-blue-600">{formatRp(item.price)}</span>
                    </div>
                  </div>
                </div>

                {/* Counter Copies */}
                {item.isSelected && (
                  <div className="flex items-center gap-1 shrink-0 bg-white border border-slate-200 rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => updateCopies(item.id, -1)}
                      className="p-1 hover:bg-slate-100 rounded text-slate-600"
                      title="Kurangi"
                    >
                      <Minus size={11} />
                    </button>
                    <span className="w-5 text-center text-xs font-black">{item.copies}</span>
                    <button
                      type="button"
                      onClick={() => updateCopies(item.id, 1)}
                      className="p-1 hover:bg-slate-100 rounded text-slate-600"
                      title="Tambah"
                    >
                      <Plus size={11} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-3 ml-1">
          Preview Label ({printableList.length} Stiker Fisik):
        </h2>
      </div>

      {/* --- AREA CETAK (PRINT ENGINE) --- */}
      <div className="print-only-container flex flex-wrap justify-center gap-4 max-w-4xl mx-auto px-4">
        {printableList.map((item, index) => {
          const skuValue = String(item.sku || item.id.slice(0, 8)).trim();
          const factoryBarcode = String(item.barcode || skuValue).trim();
          
          return (
            <div 
              key={`${item.id}-${index}`}
              className="bg-white border border-slate-300 print-exact-size page-break-here shadow-sm"
              style={{ 
                width: currentSize.width, 
                height: currentSize.height,
                padding: '2mm',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxSizing: 'border-box',
                backgroundColor: '#ffffff'
              }}
            >
              {/* Header Toko & Kategori */}
              <div className="flex justify-between items-center border-b border-black pb-0.5 leading-none">
                <span className="text-[6px] font-black uppercase tracking-tight">ATAYA TOKO</span>
                <div className="flex items-center gap-1">
                  {!showQr && (
                    <span className="text-[5px] font-mono font-bold text-slate-600 uppercase">
                      SKU: {skuValue} ·
                    </span>
                  )}
                  <span className="text-[5px] font-bold uppercase truncate max-w-[28mm]">
                    {item.category || 'UMUM'}
                  </span>
                </div>
              </div>

              {/* Area Tengah: Nama, Varian, Harga & QR */}
              <div className="flex flex-row gap-1 mt-0.5 flex-1 min-h-0">
                {/* Kiri: Nama Produk, Varian, & Harga */}
                <div className="flex flex-col justify-between flex-1 min-w-0">
                  {/* Nama Produk & Varian */}
                  <div className="min-w-0">
                    {item.isVariant ? (
                      <>
                        <h2 className="text-[7.5px] font-black leading-tight uppercase truncate">
                          {item.parentName || item.name}
                        </h2>
                        <div className="inline-block mt-0.5 px-1 py-0.2 bg-black text-white rounded-[2px] text-[6px] font-black uppercase leading-tight truncate max-w-full">
                          VAR: {item.variantName || item.name}
                        </div>
                      </>
                    ) : item.isUnitLabel ? (
                      <>
                        <h2 className="text-[7.5px] font-black leading-tight uppercase truncate">
                          {item.parentName || item.name}
                        </h2>
                        <div className="inline-block mt-0.5 px-1 py-0.2 bg-slate-800 text-white rounded-[2px] text-[6px] font-black uppercase leading-tight truncate max-w-full">
                          {item.variantName || `SATUAN ${item.unit}`}
                        </div>
                      </>
                    ) : (
                      <h2 className="text-[8px] font-black leading-tight uppercase line-clamp-2">
                        {item.name}
                      </h2>
                    )}
                  </div>

                  {/* Harga Utama (Tebal & Kontras) */}
                  <div className="mt-0.5 flex flex-col leading-none">
                    <span className="text-[5px] font-bold text-gray-500 uppercase">
                      Harga / {item.unit}
                    </span>
                    <span className="text-[13px] font-black tracking-tighter leading-none mt-0.5">
                      {formatRp(item.price)}
                    </span>
                  </div>

                  {/* Info Grosir (Jika Ada & Diaktifkan) */}
                  {showWholesale && (item.wholesalePrice || 0) > 0 && (
                    <div className="flex items-center justify-between text-[5px] font-bold bg-gray-100 px-1 py-0.2 rounded-xs mt-0.5">
                      <span className="uppercase text-gray-600">Grosir:</span>
                      <span className="font-black text-black">
                        Min {item.minWholesale || 2} @{formatRp(item.wholesalePrice || 0)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Kanan: QR Code untuk Scan Cepat via Kamera HP / Kasir (Menggunakan SKU Toko) */}
                {showQr && (
                  <div className="flex flex-col justify-center items-center shrink-0 w-[24mm] pl-1 border-l border-dashed border-gray-200">
                    <div className="bg-white p-0.5 flex justify-center">
                      <QRCodeSVG value={skuValue} size={24} level="M" />
                    </div>
                    <span className="text-[4.5px] font-mono font-bold text-slate-700 uppercase tracking-tight mt-0.5 text-center leading-none">
                      SKU: {skuValue}
                    </span>
                  </div>
                )}
              </div>

              {/* Barcode Garis 1D di Bawah (Menggunakan Barcode Pabrik) */}
              {showBarcode1D && (
                <div className="flex items-center justify-center mt-0.5 border-t border-black pt-0.5 w-full">
                  <div className="bg-white overflow-hidden flex justify-center w-full max-h-[14px]">
                    <Barcode 
                      value={factoryBarcode} 
                      width={1} 
                      height={9} 
                      fontSize={7} 
                      margin={0} 
                      displayValue={true} 
                      background="transparent"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* CSS KHUSUS PRINT MASAL */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            @page {
              size: ${currentSize.width} ${currentSize.height} landscape;
              margin: 0 !important;
            }
            body {
              background: white !important;
              margin: 0 !important;
              padding: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            @page :first { margin: 0 !important; }
            @page :left { margin: 0 !important; }
            @page :right { margin: 0 !important; }
            .no-print, header, nav, aside, footer {
              display: none !important;
            }
            .print-only-container {
              display: block !important;
              margin: 0 !important;
              padding: 0 !important;
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;
              width: ${currentSize.width} !important;
              background: white !important;
              z-index: 9999 !important;
            }
            .print-exact-size {
              width: ${currentSize.width} !important;
              height: ${currentSize.height} !important;
              max-height: ${currentSize.height} !important;
              border: none !important;
              box-shadow: none !important;
              overflow: hidden !important;
            }
            .page-break-here {
              page-break-after: always !important;
            }
            .page-break-here:last-child {
              page-break-after: auto !important;
            }
          }
        `
      }} />
    </div>
  );
}

export default function BulkPrintPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-black uppercase">Loading Print Engine...</div>}>
      <BulkPrintContent />
    </Suspense>
  );
}
