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
  // Tampilkan semua harga satuan (DUS, RENCENG, PACK) langsung di dalam 1 label stiker yang sama
  const [showSubUnits, setShowSubUnits] = useState<boolean>(true);

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
              units: Array.isArray(data.units) ? data.units : (Array.isArray(data.raw_data?.units) ? data.raw_data.units : undefined),
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
    items.filter(it => it.isSelected).forEach(item => {
      for (let i = 0; i < item.copies; i++) {
        result.push(item);
      }
    });
    return result;
  }, [items]);

  const totalSelectedUnique = items.filter(it => it.isSelected).length;
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

          {/* Toggle Elemen Barcode & Satuan */}
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
            <label className="flex items-center gap-1.5 cursor-pointer" title="Gabungkan daftar harga satuan lain (DUS, RENCENG, PACK) langsung di dalam 1 label stiker rak yang sama">
              <input
                type="checkbox"
                checked={showSubUnits}
                onChange={(e) => setShowSubUnits(e.target.checked)}
                className="rounded text-blue-600"
              />
              <Layers size={14} className="text-emerald-600" /> Satuan Lain Jadi 1 Label (DUS/Renceng)
            </label>
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
                {totalSelectedUnique === items.length ? (
                  <CheckSquare size={16} className="text-blue-600" />
                ) : (
                  <Square size={16} />
                )}
                <span>Pilih Semua ({items.length})</span>
              </button>
            </div>
            <span className="text-[11px] text-slate-400 font-bold">
              Klik kotak untuk membatalkan stiker tertentu
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
            {items.map((item) => (
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
                    <div className="flex items-center gap-1.5 text-[10px] mt-0.5 flex-wrap">
                      {item.isVariant && (
                        <span className="px-1 py-0.2 bg-purple-100 text-purple-700 rounded-sm font-bold">Varian</span>
                      )}
                      {item.isUnitLabel && (
                        <span className="px-1 py-0.2 bg-emerald-100 text-emerald-700 rounded-sm font-bold">Satuan</span>
                      )}
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-black uppercase text-[9px]">{item.unit}</span>
                      <span className="font-bold text-blue-600">{formatRp(item.price)}</span>
                      {item.units && item.units.filter((u: any) => u.code?.toUpperCase() !== item.unit.toUpperCase()).length > 0 && (
                        <span className="text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-0.2 rounded font-bold" title="Satuan lain yang ikut dicantumkan dalam label ini">
                          +{item.units.filter((u: any) => u.code?.toUpperCase() !== item.unit.toUpperCase()).map((u: any) => u.code).join(', ')}
                        </span>
                      )}
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
          
          // Cari barcode khusus satuan PCS di units[] terlebih dahulu
          const pcsUnit = item.units?.find((u: any) => u.code?.toUpperCase() === 'PCS' && u.barcode && String(u.barcode).trim())
            || item.units?.find((u: any) => (u.code?.toUpperCase() === item.unit.toUpperCase() || Number(u.contains) === 1) && u.barcode && String(u.barcode).trim());
          
          const pcsBarcode = (pcsUnit?.barcode && String(pcsUnit.barcode).trim()) 
            || (item.barcode && String(item.barcode).trim()) 
            || skuValue;
          
          const isLarge = labelSize === '60x40';
          const isSmall = labelSize === '40x30';
          
          return (
            <div 
              key={`${item.id}-${index}`}
              className="bg-white border border-slate-300 print-exact-size page-break-here shadow-sm"
              style={{ 
                width: currentSize.width, 
                height: currentSize.height,
                padding: isLarge ? '1.5mm 2.2mm' : '1.2mm 2mm',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxSizing: 'border-box',
                backgroundColor: '#ffffff',
                fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'
              }}
            >
              {/* Header Toko & Kategori */}
              <div className="flex justify-between items-center border-b border-black pb-0.5 leading-none">
                <span className={`font-bold uppercase tracking-tight ${isLarge ? 'text-[7.5px]' : 'text-[6.5px]'}`}>ATAYA TOKO</span>
                <div className="flex items-center gap-1">
                  {!showQr && (
                    <span className={`font-mono font-bold text-slate-700 uppercase ${isLarge ? 'text-[6px]' : 'text-[5px]'}`}>
                      SKU: {skuValue} ·
                    </span>
                  )}
                  <span className={`font-bold uppercase truncate ${isLarge ? 'text-[6px] max-w-[34mm]' : 'text-[5px] max-w-[28mm]'}`}>
                    {item.category || 'UMUM'}
                  </span>
                </div>
              </div>

              {/* Area Tengah: Nama, Varian, Harga & QR */}
              <div className="flex flex-row gap-1 mt-0.5 flex-1 min-h-0">
                {/* Kiri: Nama Produk, Varian, & Harga */}
                <div className="flex flex-col justify-between flex-1 min-w-0">
                  {/* Nama Produk & Varian (Satu Baris Kompak agar tidak makan tempat) */}
                  <div className="min-w-0">
                    {item.isVariant ? (
                      <div className="flex items-center gap-1 min-w-0">
                        <h2 className={`font-bold leading-tight uppercase truncate ${isLarge ? 'text-[9.5px]' : 'text-[7.5px]'}`}>
                          {item.parentName || item.name}
                        </h2>
                        <span className={`bg-black text-white rounded-[2px] font-bold uppercase shrink-0 leading-none ${isLarge ? 'px-1.5 py-0.5 text-[6.5px]' : 'px-1 py-0.2 text-[5.5px]'}`}>
                          {item.variantName || 'VAR'}
                        </span>
                      </div>
                    ) : item.isUnitLabel ? (
                      <div className="flex items-center gap-1 min-w-0">
                        <h2 className={`font-bold leading-tight uppercase truncate ${isLarge ? 'text-[9.5px]' : 'text-[7.5px]'}`}>
                          {item.parentName || item.name}
                        </h2>
                        <span className={`bg-slate-800 text-white rounded-[2px] font-bold uppercase shrink-0 leading-none ${isLarge ? 'px-1.5 py-0.5 text-[6.5px]' : 'px-1 py-0.2 text-[5.5px]'}`}>
                          {item.variantName || `SATUAN ${item.unit}`}
                        </span>
                      </div>
                    ) : (
                      <h2 className={`font-bold leading-tight uppercase line-clamp-2 ${isLarge ? 'text-[9.5px]' : 'text-[7.5px]'}`}>
                        {item.name}
                      </h2>
                    )}
                  </div>

                  {/* Harga Utama (Tebal & Bersih - Font Extrabold anti-gumpal) */}
                  <div className="mt-0.5 flex items-baseline gap-1 leading-none">
                    <span className={`font-extrabold tracking-tight leading-none text-black ${isLarge ? 'text-[17px]' : isSmall ? 'text-[12px]' : 'text-[13.5px]'}`}>
                      {formatRp(item.price)}
                    </span>
                    <span className={`font-bold text-gray-600 uppercase ${isLarge ? 'text-[6.5px]' : 'text-[5.5px]'}`}>
                      /{item.unit}
                    </span>
                  </div>

                  {/* List Harga Satuan Lainnya (DUS, RENCENG, PACK) dalam 1 Label */}
                  {showSubUnits && item.units && Array.isArray(item.units) && (
                    <div className="mt-0.5 pt-0.5 border-t border-dashed border-gray-300 flex flex-col justify-start gap-0.5 shrink-0">
                      {item.units
                        .filter((u: any) => u.code?.toUpperCase() !== item.unit.toUpperCase())
                        .map((u: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center leading-none">
                            <span className={`font-bold text-gray-700 uppercase ${isLarge ? 'text-[6px]' : 'text-[5px]'}`}>
                              1 {u.code} <span className="font-normal text-gray-500">({u.contains} {item.unit})</span>
                            </span>
                            <span className={`font-bold tracking-tight text-black ${isLarge ? 'text-[7px]' : 'text-[6px]'}`}>
                              {formatRp(u.price || (item.price * (u.contains || 1)))}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Info Grosir (Jika Ada & Diaktifkan - Selalu Terlihat Tanpa Terpotong) */}
                  {showWholesale && (item.wholesalePrice || 0) > 0 && (
                    <div className={`flex items-center justify-between font-bold bg-gray-100 rounded-[2px] mt-0.5 leading-none shrink-0 ${isLarge ? 'text-[6.5px] px-1.5 py-0.5' : 'text-[5.5px] px-1 py-0.5'}`}>
                      <span className="uppercase text-gray-700 font-bold">Grosir:</span>
                      <span className="font-bold text-black">
                        &ge;{item.minWholesale || 2} @{formatRp(item.wholesalePrice || 0)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Kanan: QR Code untuk Scan Cepat via Kamera HP / Kasir (Menggunakan SKU Toko) */}
                {showQr && (
                  <div className={`flex flex-col justify-center items-center shrink-0 pl-1 border-l border-dashed border-gray-200 ${isLarge ? 'w-[19mm]' : 'w-[15mm]'}`}>
                    <div className="bg-white p-0.5 flex justify-center">
                      <QRCodeSVG value={skuValue} size={isLarge ? 52 : isSmall ? 38 : 44} level="L" marginSize={0} />
                    </div>
                    <span className={`font-mono font-bold text-slate-800 uppercase tracking-tight mt-0.5 text-center leading-none ${isLarge ? 'text-[5px]' : 'text-[4px]'}`}>
                      SKU: {skuValue}
                    </span>
                  </div>
                )}
              </div>

              {/* Barcode Garis 1D di Bawah (Selalu Menggunakan Kode Barcode Satuan PCS) */}
              {showBarcode1D && (
                <div className="flex items-center justify-center mt-0.5 border-t border-black pt-0.5 w-full bg-white">
                  <div className="w-full flex justify-center items-center">
                    <Barcode 
                      value={pcsBarcode} 
                      width={isLarge ? 1.25 : 1.15} 
                      height={isLarge ? 24 : isSmall ? 16 : 19} 
                      fontSize={isLarge ? 8 : 7} 
                      font='system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'
                      margin={isLarge ? 3 : 2} 
                      displayValue={true} 
                      background="#ffffff"
                      lineColor="#000000"
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
            svg {
              shape-rendering: crispEdges !important;
              image-rendering: pixelated !important;
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
