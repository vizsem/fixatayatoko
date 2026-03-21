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
      <div className="flex justify-center print-only-container">
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

          <div className="flex flex-row gap-2 mt-0.5 flex-1">
            {/* Kiri: Detail Produk & Harga */}
            <div className="flex flex-col flex-1">
              {/* Nama Produk */}
              <div>
                <h2 className="text-[9px] font-black leading-tight uppercase line-clamp-2">
                  {product.name || product.Nama}
                </h2>
              </div>

              {/* Harga Utama (Sangat Besar) */}
              <div className="mt-1 flex flex-col">
                <span className="text-[5px] font-bold text-gray-500 uppercase">Harga {product.unit || product.Satuan || 'PCS'}</span>
                <span className="text-[14px] font-black tracking-tighter leading-none">
                  {formatRp(product.price || product.Ecer)}
                </span>
              </div>

              {/* List Harga Turunan & Grosir - Filter satuan utama agar tidak dobel */}
              <div className="flex-1 mt-1 flex flex-col justify-start border-t border-dashed border-gray-300 pt-0.5">
                {product.units && Array.isArray(product.units) && product.units
                  .filter((u: any) => u.code?.toUpperCase() !== (product.unit || product.Satuan || 'PCS').toUpperCase())
                  .map((u: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center leading-none mb-0.5">
                    <span className="text-[5px] font-bold text-gray-600 uppercase">1 {u.code} <span className="text-[4px] font-normal">({u.contains} {product.unit || 'PCS'})</span></span>
                    <span className="text-[6px] font-black tracking-tighter">{formatRp(u.price)}</span>
                  </div>
                ))}

                {/* Harga Grosir (Jika ada) */}
                {(product.wholesalePrice || product.Grosir) > 0 && (
                  <div className="flex justify-between items-center leading-none bg-gray-100 px-0.5 rounded-sm mt-0.5">
                    <span className="text-[4px] font-black text-gray-800 uppercase">Grosir</span>
                    <span className="text-[6px] font-black tracking-tighter">{formatRp(product.wholesalePrice || product.Grosir)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Kanan: QR Code di Tengah Samping */}
            <div className="flex flex-col justify-center items-center shrink-0">
               <div className="bg-white p-0.5">
                 <QRCodeSVG value={barcodeValue} size={24} />
               </div>
               <span className="text-[4px] font-bold text-gray-500 uppercase tracking-widest mt-1 text-center">SKU: {product.sku || product.id.slice(0,6)}</span>
            </div>
          </div>

          {/* Barcode Garis 1D & Keterangan Bawah */}
          <div className="flex items-end justify-center mt-0.5 border-t border-black pt-0.5 w-full">
            <div className="flex flex-col w-full">
              {/* Barcode Garis (1D) */}
              <div className="flex justify-center bg-white -ml-2 overflow-hidden w-full">
                <Barcode 
                  value={barcodeValue} 
                  width={1} 
                  height={12} 
                  fontSize={6} 
                  margin={0} 
                  displayValue={true} 
                  background="transparent"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CSS KHUSUS UNTUK PRINT */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            @page {
              size: 50mm 30mm; /* Sesuaikan dengan ukuran stiker barcode Anda */
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
              display: flex !important;
              justify-content: center;
              align-items: center;
              margin: 0 !important;
              padding: 0 !important;
              position: fixed !important;
              top: 0 !important;
              left: 0 !important;
              width: 100% !important;
              height: 100% !important;
              background: white !important;
              z-index: 9999 !important;
            }
            .print-exact-size {
              border: none !important;
              box-shadow: none !important;
              page-break-inside: avoid;
            }
          }
        `
      }} />
    </div>
  );
}
