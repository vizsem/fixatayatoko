'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, ShoppingBag, MessageCircle, Printer, Copy, Check, Image as ImageIcon, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import * as htmlToImage from 'html-to-image';
import { Order, OrderItem } from '@/lib/types';


function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('id');
  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState<Order | null>(null);

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
        // PERBAIKAN: Menggunakan Query where('orderId') 
        // karena doc ID firestore biasanya berbeda dengan ID Pesanan (ATY-XXXX)
        const q = query(
          collection(db, 'orders'),
          where('orderId', '==', orderId),
          limit(1)
        );

        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          setOrderData({ id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as Order);
        } else {
          console.warn("Pesanan tidak ditemukan di database.");
        }
      } catch (error) {
        console.error("Gagal mengambil data pesanan:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [orderId]);

  // Logic mapping data agar fleksibel
  const displayTotal = orderData?.total || 0;
  const displayItems = orderData?.items || [];
  const displayMethod = orderData?.delivery?.method || 'Ambil di Toko';
  const displayPayment = orderData?.payment?.method || 'CASH';
  const displayCustomer = orderData?.name || orderData?.customerName || 'Pelanggan';


  const printThermal = () => {
    if (!orderData) return;
    const w = window.open('', '_blank');
    if (!w) return;

    const itemsHtml = displayItems.map((item: OrderItem) => `
      <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
        <span style="text-transform: uppercase; flex: 1;">${item.name || 'Produk'}</span>
        <span style="width: 40px; text-align: center;">${item.quantity || 0}x</span>
        <span style="width: 70px; text-align: right;">${((item.price || 0) * (item.quantity || 0)).toLocaleString()}</span>
      </div>
    `).join('');

    w.document.write(`
      <html>
        <head>
          <title>Cetak Struk - ${orderId}</title>
          <style>
            @page { margin: 0; }
            body { font-family: 'Courier New', monospace; width: 58mm; padding: 4mm; font-size: 11px; line-height: 1.2; background: white; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .line { border-top: 1px dashed #000; margin: 5px 0; }
          </style>
        </head>
        <body onload="setTimeout(() => { window.print(); window.close(); }, 500);">
          <div class="center bold" style="font-size: 14px;">ATAYA TOKO</div>
          <div class="center">KEDIRI - JATIM</div>
          <div class="line"></div>
          <div>ID: ${orderId?.toUpperCase()}</div>
          <div>Tgl: ${new Date().toLocaleString('id-ID')}</div>
          <div class="line"></div>
          ${itemsHtml}
          <div class="line"></div>
          <div style="display: flex; justify-content: space-between;" class="bold">
            <span>TOTAL</span>
            <span>Rp${displayTotal.toLocaleString()}</span>
          </div>
          <div class="center" style="margin-top: 15px;">TERIMA KASIH</div>
        </body>
      </html>
    `);
    w.document.close();
  };

  const saveInvoiceAsImage = async () => {
    if (!invoiceRef.current) return;
    setIsDownloading(true);
    try {
      // Tunggu sebentar untuk memastikan font ter-render
      const dataUrl = await htmlToImage.toJpeg(invoiceRef.current, {
        quality: 0.95,
        backgroundColor: '#ffffff',
        pixelRatio: 2 // Menambah ketajaman gambar
      });
      const link = document.createElement('a');
      link.download = `Nota-Ataya-${orderId}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan nota');
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4">
        <Loader2 className="animate-spin text-green-600" size={48} />
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Memuat Data Pesanan...</p>
      </div>
    );
  }

  if (!orderData && !loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <h1 className="text-xl font-bold text-gray-800">Maaf, Data Tidak Ditemukan</h1>
        <p className="text-gray-500 mb-6 mt-2">Pesanan dengan ID <b>{orderId}</b> mungkin masih diproses atau tidak ada.</p>
        <Link href="/" className="bg-green-600 text-white px-8 py-3 rounded-xl font-bold">Kembali ke Toko</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden text-center p-6 md:p-10 relative">
          <div className="flex justify-center mb-6">
            <div className="bg-green-100 p-4 rounded-full text-green-600 animate-bounce">
              <CheckCircle size={64} />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">Pesanan Diterima!</h1>
          <p className="text-gray-600 mb-6 text-sm md:text-base">
            Terima kasih, <span className="font-semibold text-gray-900">{displayCustomer}</span>.
            Pesanan Anda sedang diproses.
          </p>

          <div className="bg-gray-50 rounded-2xl p-4 mb-6 border border-gray-100 flex flex-col items-center">
            <span className="text-[10px] text-gray-400 uppercase tracking-widest mb-1 font-black">ID Transaksi</span>
            <div className="flex items-center space-x-2">
              <code className="text-base font-mono font-bold text-green-700 uppercase">{orderId || 'N/A'}</code>
              <button onClick={copyOrderId} className="p-1.5 hover:bg-gray-200 rounded-md transition-colors">
                {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
              </button>
            </div>
          </div>

          <div className="text-left mb-6 bg-gray-50 p-5 rounded-2xl border border-gray-100">
            <h3 className="font-black text-gray-400 text-[10px] uppercase tracking-widest border-b pb-2 mb-3">Rincian Pesanan</h3>
            <div className="space-y-3">
              {displayItems.map((item: OrderItem, idx: number) => (
                <div key={idx} className="flex justify-between items-start text-sm border-b border-gray-50 pb-2">
                  <div className="pr-4">
                    <p className="font-bold text-gray-800 uppercase text-[11px] leading-tight">{item.name}</p>
                    <p className="text-[10px] text-gray-500">{item.quantity} x Rp{item.price?.toLocaleString()}</p>
                  </div>
                  <p className="font-bold text-gray-900 text-xs">Rp{((item.price || 0) * (item.quantity || 0)).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="text-left space-y-4 mb-8 bg-gray-50 p-5 rounded-2xl border border-dashed border-gray-300">
            <div className="grid grid-cols-2 gap-y-4 text-sm pt-1">
              <div>
                <p className="text-gray-400 text-[10px] uppercase font-black">Metode Kirim</p>
                <p className="font-bold text-gray-800 uppercase text-[11px]">{displayMethod}</p>
              </div>
              <div>
                <p className="text-gray-400 text-[10px] uppercase font-black">Pembayaran</p>
                <p className="font-bold text-gray-800 uppercase text-[11px]">{displayPayment}</p>
              </div>
              <div className="col-span-2 pt-2 border-t">
                <p className="text-gray-400 text-[10px] uppercase font-black">Total Transaksi</p>
                <p className="text-2xl font-black text-green-600">Rp{displayTotal.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={saveInvoiceAsImage}
              disabled={isDownloading}
              className="flex items-center justify-center space-x-2 bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 shadow-lg active:scale-95 disabled:bg-gray-400"
            >
              {isDownloading ? <Loader2 className="animate-spin" size={18} /> : <><ImageIcon size={18} /> <span>Simpan Gambar Nota</span></>}
            </button>
            <button onClick={printThermal} className="flex items-center justify-center space-x-2 bg-gray-800 text-white py-3.5 rounded-xl font-bold hover:bg-black shadow-lg active:scale-95">
              <Printer size={18} />
              <span>Cetak Struk Thermal</span>
            </button>
            <Link href="/" className="md:col-span-2 flex items-center justify-center space-x-2 bg-green-600 text-white py-3.5 rounded-xl font-bold hover:bg-green-700 shadow-lg active:scale-95">
              <ShoppingBag size={18} />
              <span>Belanja Lagi</span>
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <a href="https://wa.me/6285853161174" target="_blank" className="inline-flex items-center gap-2 text-green-600 font-bold hover:underline text-sm">
              <MessageCircle size={18} /> Hubungi Admin Ataya
            </a>
          </div>
        </div>
      </div>

      {/* --- TEMPLATE NOTA FOTO (HIDDEN) --- */}
      <div className="fixed left-[-9999px] top-0 shadow-none pointer-events-none">
        <div ref={invoiceRef} className="bg-white p-10" style={{ width: '500px', fontFamily: 'monospace' }}>
          <div className="text-center border-b-2 border-dashed border-black pb-6 mb-6">
            <h1 className="text-3xl font-black italic">ATAYA TOKO</h1>
            <p className="text-sm">KEDIRI, JAWA TIMUR</p>
            <p className="text-sm">WA: 085853161174</p>
          </div>
          <div className="space-y-1 mb-6 text-sm">
            <div className="flex justify-between"><span>ID TRANS:</span> <strong>{orderId?.toUpperCase()}</strong></div>
            <div className="flex justify-between"><span>NAMA:</span> <strong>{displayCustomer}</strong></div>
            <div className="flex justify-between"><span>TANGGAL:</span> <span>{new Date().toLocaleString('id-ID')}</span></div>
          </div>
          <table className="w-full text-sm mb-6 border-t border-black">
            <thead>
              <tr className="text-left border-b border-black font-bold">
                <th className="py-2">PRODUK</th>
                <th className="text-center">QTY</th>
                <th className="text-right">SUB</th>
              </tr>
            </thead>
            <tbody>
              {displayItems.map((item: OrderItem, idx: number) => (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="py-2 text-[12px] uppercase">{item.name}</td>
                  <td className="text-center">{item.quantity}</td>
                  <td className="text-right">{((item.price || 0) * (item.quantity || 0)).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-between font-black text-2xl border-t-2 border-black pt-4">
            <span>TOTAL</span>
            <span>Rp{displayTotal.toLocaleString()}</span>
          </div>
          <div className="text-center mt-10 text-[10px] uppercase font-bold">
            *** Terima Kasih Telah Berbelanja ***
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-green-600" size={32} /></div>}>
      <SuccessContent />
    </Suspense>
  );
}