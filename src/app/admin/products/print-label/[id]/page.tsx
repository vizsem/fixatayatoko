'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Printer, AlertTriangle } from 'lucide-react';
import Barcode from 'react-barcode';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';

import { sbGetDoc } from '@/lib/supabase-helpers';
export default function PrintLabelPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const [product, setProduct] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Ukuran label thermal standar untuk rak: 50mm x 30mm atau sejenisnya
  // Di sini kita mendesain area berukuran tersebut

  useEffect(() => {
    if (!id) return;
    const fetchProduct = async () => {
      try {
        const docSnap = await sbGetDoc('products', id);
        if (docSnap.exists()) {
          setProduct({ id: docSnap.id, ...docSnap.data() });
          // Auto print dialog after load
          setTimeout(() => { window.print(); }, 800);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  if (loading) return <div className="p-10 text-center font-black uppercase text-slate-400 animate-pulse tracking-widest">Generating Label...</div>;
  if (!product) return <div className="p-10 text-center font-black text-red-500 uppercase">Data Kosong</div>;

  const formatRp = (n: number) => `Rp${(n || 0).toLocaleString('id-ID')}`;

  // Format Nama Produk ke Title Case (Huruf besar di awal kata agar rapi, hemat ruang & profesional)
  const formatTitleCase = (str: string = '') => {
    if (!str) return '';
    return str.toLowerCase().replace(/(^|[\s\-\(\)\/\.,])([a-z])/g, (_, p1, p2) => p1 + p2.toUpperCase());
  };
  
  // SKU internal toko (untuk QR Code kasir HP) & Barcode Pabrik (untuk Barcode 1D scanner kasir)
  const skuValue = String(product.sku || product.SKU || product.raw_data?.sku || product.id.slice(0, 8)).trim();
  
  // Ambil barcode khusus satuan PCS dari units[] terlebih dahulu
  const rawUnits = Array.isArray(product.units) ? product.units : (Array.isArray(product.raw_data?.units) ? product.raw_data.units : []);
  const baseUnitStr = String(product.unit || product.Satuan || 'PCS').toUpperCase();
  const pcsUnit = rawUnits.find((u: any) => u.code?.toUpperCase() === 'PCS' && u.barcode && String(u.barcode).trim())
    || rawUnits.find((u: any) => (u.code?.toUpperCase() === baseUnitStr || Number(u.contains) === 1) && u.barcode && String(u.barcode).trim());
  
  const factoryBarcode = (pcsUnit?.barcode && String(pcsUnit.barcode).trim())
    || String(product.barcode || product.Barcode || product.raw_data?.barcode || product.raw_data?.Barcode || skuValue).trim();

  return (
    <div className="bg-gray-100 min-h-screen text-black font-sans pb-20">
      <div className="max-w-4xl mx-auto p-4 no-print pt-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 bg-white p-6 rounded-3xl shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-3 bg-gray-50 rounded-2xl hover:bg-black hover:text-white transition-all">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tighter">Cetak Label Rak</h1>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Desain Thermal Sticker</p>
            </div>
          </div>
          <button onClick={() => typeof window !== 'undefined' && window.print()} className="bg-black text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-gray-800">
            <Printer size={16} /> Cetak Sekarang
          </button>
        </div>

        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl text-xs font-bold flex items-start gap-3 mb-8">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <p>Pastikan ukuran kertas di pengaturan printer Anda sudah disesuaikan (contoh: Lebar 50mm x Tinggi 30mm) dan hilangkan Margin pada pengaturan browser sebelum mencetak.</p>
        </div>
        
        <h2 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-4 ml-2">Preview Stiker (Asli):</h2>
      </div>

      {/* --- AREA CETAK (HANYA INI YANG MUNCUL SAAT DI-PRINT) --- */}
      {/* Kita buat ukuran fixed 50mm x 30mm untuk disimulasikan di layar */}
      <div className="flex justify-center print-only-container">
        <div 
          className="bg-white border border-gray-300 overflow-hidden print-exact-size"
          style={{ 
            width: '50mm', 
            height: '30mm',
            padding: '1.2mm 2mm',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
            backgroundColor: '#ffffff',
            color: '#000000',
            fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'
          }}
        >
          {/* Header Toko / Kategori */}
          <div className="flex justify-between items-center border-b border-black pb-0.5 leading-none">
            <span className="text-[6.5px] font-bold uppercase tracking-tight text-black">ATAYATOKO</span>
            <span className="text-[5px] font-bold uppercase truncate max-w-[28mm] text-black">{product.category || product.Kategori || 'UMUM'}</span>
          </div>

          <div className="flex flex-row gap-1 mt-0.5 flex-1 min-h-0">
            {/* Kiri: Detail Produk & Harga */}
            <div className="flex flex-col justify-between flex-1 min-w-0">
              {/* Nama Produk (Title Case: Rapi, Modern & Hemat Ruang) & Varian */}
              <div className="min-w-0">
                <div className="flex items-center gap-1 min-w-0">
                  <h2 className="text-[7.5px] font-bold leading-tight truncate text-black" title={product.name || product.Nama}>
                    {formatTitleCase(product.name || product.Nama)}
                  </h2>
                  {(product.isVariant || product.parent_id || product.raw_data?.Parent_ID) && (
                    <span className="px-1 py-0.2 bg-black text-white rounded-[2px] text-[5.5px] font-bold shrink-0 leading-none">
                      {formatTitleCase(product.variantName || product.raw_data?.variantName || 'Var')}
                    </span>
                  )}
                </div>
              </div>

              {/* Harga Utama (Tebal & Bersih - Tracking Normal Anti-Bayangan) */}
              <div className="mt-0.5 flex items-baseline gap-1 leading-none">
                <span className="text-[13.5px] font-extrabold tracking-normal leading-none text-black">
                  {formatRp(product.price || product.Ecer)}
                </span>
                <span className="text-[5.5px] font-bold text-black uppercase">
                  /{baseUnitStr}
                </span>
              </div>

              {/* List Harga Satuan Lainnya (DUS, RENCENG, PACK) dalam 1 Label */}
              {rawUnits.filter((u: any) => u.code?.toUpperCase() !== baseUnitStr).length > 0 && (
                <div className="mt-0.5 pt-0.5 border-t border-dashed border-black flex flex-col justify-start gap-0.5 shrink-0">
                  {rawUnits
                    .filter((u: any) => u.code?.toUpperCase() !== baseUnitStr)
                    .map((u: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center leading-none text-[5px]">
                        <span className="font-bold text-black uppercase">
                          1 {u.code} <span className="font-normal text-black">({u.contains} {baseUnitStr})</span>
                        </span>
                        <span className="text-[6px] font-bold tracking-normal text-black">
                          {formatRp(u.price)}
                        </span>
                      </div>
                    ))}
                </div>
              )}

              {/* Harga Semi Grosir / Tier Grosir */}
              {(() => {
                const raw = product.raw_data || {};
                const tiers = Array.isArray(raw.priceTiers) ? raw.priceTiers : (Array.isArray(product.priceTiers) ? product.priceTiers : []);
                if (tiers.length > 1) {
                  const activeTiers = tiers.filter((t: any) => t.minQty > 1 && t.price > 0);
                  if (activeTiers.length > 0) {
                    return (
                      <div className="border border-black px-1 py-0.5 rounded-[2px] mt-0.5 leading-none shrink-0 text-black text-[5.5px]">
                        <div className="flex items-center justify-between font-bold">
                          <span className="uppercase text-black font-extrabold">Grosir:</span>
                          <span className="font-bold text-black truncate ml-1">
                            {activeTiers.map((t: any) => `≥${t.minQty} @${formatRp(t.price)}`).join(' · ')}
                          </span>
                        </div>
                      </div>
                    );
                  }
                }
                const rawUnits = Array.isArray(product.units) ? product.units : (Array.isArray(raw.units) ? raw.units : []);
                const higherUnits = rawUnits
                  .filter((u: any) => Number(u.contains || 0) > 1 && Number(u.price || 0) > 0)
                  .sort((a: any, b: any) => Number(a.contains) - Number(b.contains));
                const minHigherContains = higherUnits.length > 0 ? Number(higherUnits[0].contains) : 0;

                const semiPrice = Number(product.priceSemiGrosir || raw.priceSemiGrosir || product.wholesalePrice || raw.wholesalePrice || product.Grosir || raw.Grosir || 0);
                const minQty = Number(product.minSemiGrosir || raw.minSemiGrosir || product.minWholesale || product.Min_Grosir || raw.Min_Grosir || 2);

                if (semiPrice <= 0) return null;
                if (minHigherContains > 1 && minQty >= minHigherContains) return null;

                return (
                  <div className="flex items-center justify-between text-[5.5px] font-bold border border-black px-1 py-0.5 rounded-[2px] mt-0.5 leading-none shrink-0 text-black">
                    <span className="uppercase text-black font-bold">Semi Grosir:</span>
                    <span className="font-bold text-black">
                      &ge;{minQty} @{formatRp(semiPrice)}
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Kanan: QR Code di Tengah Samping (Menggunakan SKU Toko) */}
            <div className="flex flex-col justify-center items-center shrink-0 w-[15mm] pl-1 border-l border-dashed border-black">
               <div className="bg-white p-0.5 w-full flex justify-center">
                 <QRCodeSVG value={skuValue} size={44} level="L" marginSize={0} />
               </div>
               <span className="text-[4px] font-mono font-bold text-black uppercase tracking-normal mt-0.5 text-center leading-none">SKU: {skuValue}</span>
            </div>
          </div>

          {/* Barcode Garis 1D & Keterangan Bawah (Selalu Menggunakan Kode Barcode Satuan PCS) */}
          <div className="flex items-center justify-center mt-0.5 border-t border-black pt-0.5 w-full bg-white">
            <div className="w-full flex justify-center items-center">
              <Barcode 
                value={factoryBarcode} 
                width={1.2} 
                height={18} 
                fontSize={7} 
                font='system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'
                margin={2} 
                displayValue={true} 
                background="#ffffff"
                lineColor="#000000"
              />
            </div>
          </div>
        </div>
      </div>

      {/* CSS KHUSUS UNTUK PRINT */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            @page {
              size: 50mm 30mm landscape; /* Paksa orientasi landscape (lebar 50, tinggi 30) */
              margin: 0 !important; /* Menghilangkan margin bawaan browser */
            }
            body {
              background: white !important;
              margin: 0 !important;
              padding: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              height: 30mm !important;
              width: 50mm !important;
              overflow: hidden !important;
            }
            /* Menyembunyikan Header dan Footer default browser (URL, Tanggal, Page Number) */
            @page :first {
              margin: 0 !important;
            }
            @page :left {
              margin: 0 !important;
            }
            @page :right {
              margin: 0 !important;
            }
            .no-print {
              display: none !important;
            }
            /* Memaksa elemen Sidebar / Navbar utama (jika ada di layout) untuk sembunyi */
            header, nav, aside, footer {
              display: none !important;
            }
            .print-only-container {
              display: block !important;
              margin: 0 !important;
              padding: 0 !important;
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;
              width: 50mm !important;
              height: 30mm !important;
              background: white !important;
              z-index: 9999 !important;
              overflow: hidden !important;
            }
            .print-exact-size {
              width: 50mm !important;
              height: 30mm !important;
              max-height: 30mm !important;
              border: none !important;
              box-shadow: none !important;
              page-break-inside: avoid !important;
              page-break-after: avoid !important;
              page-break-before: avoid !important;
              overflow: hidden !important;
            }
            .print-exact-size, .print-exact-size * {
              color: #000000 !important;
              text-shadow: none !important;
              -webkit-font-smoothing: antialiased !important;
              text-rendering: geometricPrecision !important;
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
