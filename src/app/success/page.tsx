'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, ShoppingBag, MessageCircle, Printer, Copy, Check, Download, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import * as htmlToImage from 'html-to-image'; // Import library gambar

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('id');
  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) {
        setLoading(false);
        return;
      }
      try {
        const docRef = doc(db, 'orders', orderId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setOrderData(docSnap.data());
        }
      } catch (error) {
        console.error("Gagal mengambil data pesanan:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [orderId]);

  // FUNGSI SIMPAN GAMBAR KE GALERI
  const saveInvoiceAsImage = async () => {
    if (!invoiceRef.current) return;
    setIsDownloading(true);
    try {
      const dataUrl = await htmlToImage.toJpeg(invoiceRef.current, {
        quality: 0.95,
        backgroundColor: '#ffffff',
      });
      
      const link = document.createElement('a');
      link.download = `Nota-Ataya-${orderId}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Gagal simpan gambar:', err);
      alert('Gagal menyimpan nota sebagai gambar');
    } finally {
      setIsDownloading(false);
    }
  };

  const copyOrderId = () => {
    if (orderId) {
      navigator.clipboard.writeText(orderId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden text-center p-8 md:p-12 relative">
          <div className="flex justify-center mb-6">
            <div className="bg-green-100 p-4 rounded-full">
              <CheckCircle size={64} className="text-green-600" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">Pesanan Diterima!</h1>
          <p className="text-gray-600 mb-8">
            Terima kasih, <span className="font-semibold text-gray-900">{orderData?.name || 'Pelanggan'}</span>. 
            Pesanan Anda sedang diproses.
          </p>

          {/* ID Pesanan */}
          <div className="bg-gray-50 rounded-2xl p-4 mb-8 border border-gray-100 flex flex-col items-center">
            <span className="text-xs text-gray-500 uppercase tracking-widest mb-1">ID Pesanan</span>
            <div className="flex items-center space-x-2">
              <code className="text-lg font-mono font-bold text-green-700">{orderId || 'N/A'}</code>
              <button onClick={copyOrderId} className="p-1.5 hover:bg-gray-200 rounded-md transition-colors">
                {copied ? <Check size={18} className="text-green-600" /> : <Copy size={18} />}
              </button>
            </div>
          </div>

          {/* Ringkasan */}
          <div className="text-left space-y-4 mb-8 bg-gray-50 p-6 rounded-2xl">
            <h3 className="font-bold text-gray-900 border-b border-gray-200 pb-2 text-xs uppercase tracking-widest">Detail Transaksi</h3>
            <div className="grid grid-cols-2 gap-y-4 text-sm">
              <div>
                <p className="text-gray-500 text-[10px] uppercase font-bold">Metode</p>
                <p className="font-medium">{orderData?.delivery?.method === 'pickup' ? 'Ambil Sendiri' : 'Antar Kurir'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-[10px] uppercase font-bold">Bayar</p>
                <p className="font-medium uppercase">{orderData?.payment?.method}</p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-500 text-[10px] uppercase font-bold">Total Belanja</p>
                <p className="text-xl font-black text-green-600">Rp{orderData?.total?.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Tombol Aksi */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button 
              onClick={saveInvoiceAsImage}
              disabled={isDownloading}
              className="flex items-center justify-center space-x-2 bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg active:scale-95 disabled:bg-gray-400"
            >
              {isDownloading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><ImageIcon size={20} /> <span>Simpan ke Galeri</span></>
              )}
            </button>
            <Link 
              href="/"
              className="flex items-center justify-center space-x-2 bg-gray-900 text-white py-4 rounded-2xl font-bold hover:bg-black transition-all shadow-lg active:scale-95"
            >
              <ShoppingBag size={20} />
              <span>Belanja Lagi</span>
            </Link>
          </div>

          <div className="mt-8 pt-8 border-t border-gray-100">
            <a href="https://wa.me/6285853161174" target="_blank" className="inline-flex items-center space-x-2 text-green-600 font-bold">
              <MessageCircle size={18} />
              <span>Hubungi CS Atayatoko</span>
            </a>
          </div>
        </div>
      </div>

      {/* --- TEMPLATE NOTA (HIDDEN DARI LAYAR, TAPI ADA UNTUK KONVERSI GAMBAR) --- */}
      <div className="absolute left-[-9999px] top-0">
        <div 
          ref={invoiceRef} 
          className="bg-white p-10" 
          style={{ width: '500px', fontFamily: 'monospace' }}
        >
          <div className="text-center border-b-2 border-dashed border-black pb-6 mb-6">
            <h1 className="text-3xl font-black italic">ATAYA TOKO</h1>
            <p className="text-sm">Kediri, Jawa Timur</p>
            <p className="text-sm">WA: 085853161174</p>
          </div>

          <div className="space-y-1 mb-6 text-sm">
            <p className="flex justify-between"><span>ID PESANAN:</span> <strong>{orderId}</strong></p>
            <p className="flex justify-between"><span>NAMA:</span> <strong>{orderData?.name}</strong></p>
            <p className="flex justify-between"><span>TANGGAL:</span> <span>{new Date().toLocaleString('id-ID')}</span></p>
            <p className="flex justify-between"><span>STATUS:</span> <strong>SUKSES</strong></p>
          </div>

          <div className="border-b border-black mb-4"></div>
          
          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="text-left border-b border-gray-200">
                <th className="py-2">PRODUK</th>
                <th className="text-center">QTY</th>
                <th className="text-right">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {orderData?.items?.map((item: any, idx: number) => (
                <tr key={idx} className="border-b border-gray-50">
                  <td className="py-3 pr-2">{item.name}</td>
                  <td className="text-center">{item.quantity}</td>
                  <td className="text-right">{(item.price * item.quantity).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="space-y-2 text-sm border-t-2 border-dashed border-black pt-4">
            <div className="flex justify-between font-black text-xl">
              <span>TOTAL BAYAR</span>
              <span>Rp{orderData?.total?.toLocaleString()}</span>
            </div>
            <p className="text-[10px] text-gray-500 uppercase mt-4">Metode Bayar: {orderData?.payment?.method}</p>
          </div>

          <div className="text-center mt-10 border-t pt-6">
            <p className="text-xs font-bold">TERIMA KASIH TELAH BERBELANJA</p>
            <p className="text-[10px]">Barang yang sudah dibeli tidak dapat ditukar/dikembalikan</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <SuccessContent />
    </Suspense>
  );
}