'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ArrowLeft, Printer, AlertTriangle } from 'lucide-react';
import Barcode from 'react-barcode';
import { QRCodeSVG } from 'qrcode.react';

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
        const docSnap = await getDoc(doc(db, 'products', id));
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
  
  // Gunakan barcode khusus jika ada, jika tidak pakai id produk
  const barcodeValue = product.Barcode || product.barcode || product.id.slice(0, 10);

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
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Desain Thermal Sticker</p>
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
      <div className="print-area flex justify-center no-print">
        <div 
          className="bg-white border border-gray-300 overflow-hidden relative print-exact-size"
          style={{ 
            width: '50mm', 
            height: '30mm',
            padding: '2mm',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxSizing: 'border-box'
          }}
        >
          {/* Header Toko / Kategori */}
          <div className="flex justify-between items-center border-b border-black pb-0.5">
            <span className="text-[6px] font-black uppercase">ATAYA TOKO</span>
            <span className="text-[5px] font-bold uppercase">{product.category || product.Kategori || 'UMUM'}</span>
          </div>

          {/* Nama Produk */}
          <div className="mt-0.5">
            <h2 className="text-[9px] font-black leading-tight uppercase line-clamp-2">
              {product.name || product.Nama}
            </h2>
          </div>

          {/* List Harga Satuan & Grosir */}
          <div className="flex-1 mt-1 flex flex-col justify-center border-t border-dashed border-gray-300 pt-0.5">
            {/* Harga Satuan Dasar (PCS) */}
            <div className="flex justify-between items-center leading-none mb-0.5">
              <span className="text-[6px] font-bold text-gray-600 uppercase">1 {product.unit || product.Satuan || 'PCS'}</span>
              <span className="text-[10px] font-black tracking-tighter">{formatRp(product.price || product.Ecer)}</span>
            </div>

            {/* Harga Satuan Turunan (BOX / CTN) */}
            {product.units && Array.isArray(product.units) && product.units.map((u: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center leading-none mb-0.5">
                <span className="text-[6px] font-bold text-gray-600 uppercase">1 {u.code} <span className="text-[4px] font-normal">({u.contains} {product.unit || 'PCS'})</span></span>
                <span className="text-[8px] font-black tracking-tighter">{formatRp(u.price)}</span>
              </div>
            ))}

            {/* Harga Grosir (Jika ada) */}
            {(product.wholesalePrice || product.Grosir) > 0 && (
              <div className="flex justify-between items-center leading-none bg-gray-100 px-0.5 rounded-sm mt-0.5">
                <span className="text-[5px] font-black text-gray-800 uppercase">GROSIR (Min {product.minWholesaleQty || product.Min_Grosir || 2})</span>
                <span className="text-[7px] font-black tracking-tighter">{formatRp(product.wholesalePrice || product.Grosir)}</span>
              </div>
            )}
          </div>

          {/* Barcode & Keterangan Bawah */}
          <div className="flex items-end justify-between mt-0.5 border-t border-black pt-0.5">
            <div className="flex flex-col">
              <span className="text-[4px] font-bold text-gray-500 uppercase tracking-widest">SKU: {product.sku || product.id.slice(0,6)}</span>
              <span className="text-[5px] font-bold text-gray-800 font-mono mt-0.5">{barcodeValue}</span>
            </div>
            
            {/* Area QR Code (Lebih mudah dibaca kamera HP / Scanner kecil) */}
            <div className="shrink-0 bg-white ml-1">
              <QRCodeSVG value={barcodeValue} size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* CSS KHUSUS UNTUK PRINT */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            body {
              background: white !important;
              margin: 0 !important;
              padding: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .no-print {
              display: none !important;
            }
            .print-area {
              display: block !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .print-exact-size {
              border: none !important;
              box-shadow: none !important;
              page-break-inside: avoid;
            }
            @page {
              size: 50mm 30mm; /* Sesuaikan dengan ukuran stiker barcode Anda */
              margin: 0;
            }
          }
        `
      }} />
    </div>
  );
}
