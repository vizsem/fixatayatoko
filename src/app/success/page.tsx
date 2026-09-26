'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, ShoppingBag, MessageCircle, Printer, Copy, Check, Image as ImageIcon, Loader2, Download } from 'lucide-react';
import Link from 'next/link';
import { Order, OrderItem } from '@/lib/types';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';


import { auth, collection, db, doc, getDocs, limit, onAuthStateChanged, query, ref, where } from '@/lib/firebase';
function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('id');
  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState<Order | null>(null);
  const [qrisLoading, setQrisLoading] = useState(false);

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
        const q = query(collection(db, 'orders'), where('orderId', '==', orderId), limit(1));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          setOrderData({ id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as Order);
        }
      } catch (error) {
        console.error("Gagal mengambil data pesanan:", error);
      } finally {
        setLoading(false);
      }
    };
    const unsub = onAuthStateChanged(auth, () => {
      fetchOrder();
    });
    return () => unsub();
  }, [orderId]);

  useEffect(() => {
    const ensureQris = async () => {
      if (!orderId || !orderData) return;
      const method = String(orderData.payment?.method || '').toLowerCase();
      const paymentStatus = String((orderData as any).paymentStatus || '').toUpperCase();
      const qrContent = String((orderData as any).payment?.bri?.qrContent || '');
      if (paymentStatus === 'PAID') return;
      if (method !== 'qris_bri' && method !== 'qris-bri' && method !== 'qris_bri_auto' && method !== 'qris_bri_otomatis') return;
      if (qrContent) return;

      setQrisLoading(true);
      try {
        const resp = await fetch('/api/payments/bri/qris', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId }),
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok && data?.qrContent) {
          setOrderData((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              payment: {
                ...(prev.payment || { method: 'qris_bri' }),
                bri: {
                  ...(prev as any)?.payment?.bri,
                  qrContent: String(data.qrContent),
                  referenceNo: String(data.referenceNo || ''),
                },
              } as any,
            };
          });
        }
      } finally {
        setQrisLoading(false);
      }
    };
    ensureQris();
  }, [orderId, orderData]);

  // Logic mapping data agar fleksibel
  const displayTotal = orderData?.total || 0;
  const displayItems = orderData?.items || [];
  const displayMethod = orderData?.delivery?.method || 'Ambil di Toko';
  const paymentMethodRaw = orderData?.payment?.method || 'CASH';
  const displayPayment = String(paymentMethodRaw).toLowerCase() === 'qris_bri' ? 'QRIS (BRI)' : paymentMethodRaw;
  const displayCustomer = orderData?.name || orderData?.customerName || 'Pelanggan';
  const qrisContent = String((orderData as any)?.payment?.bri?.qrContent || '');
  const isQrisBri = String(paymentMethodRaw).toLowerCase() === 'qris_bri';
  const isPaid = String((orderData as any)?.paymentStatus || '').toUpperCase() === 'PAID';


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
      const htmlToImage = await import('html-to-image');
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
      toast.error('Gagal menyimpan nota');
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] gap-3">
        <Loader2 className="animate-spin text-emerald-600" size={36} />
        <p className="text-sm font-medium text-slate-500">Memuat data pesanan...</p>
      </div>
    );
  }

  if (!orderData && !loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] p-6 text-center">
        <h1 className="text-xl font-black text-slate-900 mb-2">Data Tidak Ditemukan</h1>
        <p className="text-sm text-slate-500 mb-6">Pesanan dengan ID <b className="text-slate-700">{orderId}</b> mungkin masih diproses atau tidak ditemukan.</p>
        <Link href="/" className="bg-emerald-600 text-white px-8 py-3 rounded-2xl text-sm font-bold hover:bg-emerald-700 transition-colors">Kembali ke Toko</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Success Hero */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm text-center p-8">
          <div className="flex justify-center mb-5">
            <div className="bg-emerald-100 p-5 rounded-full text-emerald-600">
              <CheckCircle size={48} />
            </div>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-2">Pesanan Berhasil!</h1>
          <p className="text-sm text-slate-600 mb-5">
            Terima kasih, <span className="font-bold text-slate-900">{displayCustomer}</span>. Pesanan Anda sedang diproses.
          </p>
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 inline-flex flex-col items-center mx-auto">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">ID Transaksi</span>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono font-black text-emerald-700">{orderId || 'N/A'}</code>
              <button onClick={copyOrderId} className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-500">
                {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
              </button>
            </div>
          </div>
        </div>

        {/* Rincian Produk */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Rincian Pesanan</h3>
          <div className="space-y-3">
            {displayItems.map((item: OrderItem, idx: number) => (
              <div key={idx} className="flex justify-between items-start py-2.5 border-b border-slate-50 last:border-0">
                <div className="flex-1 pr-4">
                  <p className="text-sm font-bold text-slate-800 leading-snug">{item.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{item.quantity} × Rp{item.price?.toLocaleString('id-ID')}</p>
                </div>
                <p className="text-sm font-black text-slate-900">Rp{((item.price || 0) * (item.quantity || 0)).toLocaleString('id-ID')}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Info & Total */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <p className="text-xs text-slate-400 font-bold mb-0.5">Metode Kirim</p>
              <p className="text-sm font-bold text-slate-800">{displayMethod}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold mb-0.5">Pembayaran</p>
              <p className="text-sm font-bold text-slate-800 uppercase">{displayPayment}</p>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
            <span className="text-sm font-bold text-slate-600">Total Transaksi</span>
            <span className="text-2xl font-black text-emerald-600">Rp{displayTotal.toLocaleString('id-ID')}</span>
          </div>
        </div>

        {isQrisBri && !isPaid && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 text-left">
            <h3 className="text-sm font-bold text-emerald-800 mb-3">Pembayaran QRIS</h3>
            {qrisLoading && !qrisContent ? (
              <div className="flex items-center gap-3 text-slate-500">
                <Loader2 className="animate-spin" size={18} />
                <span className="text-sm font-medium">Menyiapkan kode QR...</span>
              </div>
            ) : qrisContent ? (
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="bg-white p-3 rounded-2xl border border-slate-100">
                  <QRCodeSVG value={qrisContent} size={180} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-700 leading-relaxed">Scan QR untuk membayar. Status pesanan akan otomatis berubah setelah pembayaran berhasil.</p>
                  <div className="mt-4 flex gap-3">
                    <button onClick={() => window.location.reload()} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 active:scale-95 transition-all">
                      Refresh
                    </button>
                    <Link href="/orders" className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-black active:scale-95 transition-all inline-flex items-center justify-center">
                      Lihat Pesanan
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm font-medium text-rose-600">QR belum tersedia. Silakan refresh halaman.</p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <button
              onClick={saveInvoiceAsImage}
              disabled={isDownloading}
              className="flex items-center justify-center gap-2 bg-blue-600 text-white py-3.5 rounded-2xl text-sm font-bold hover:bg-blue-700 shadow-md active:scale-95 transition-all disabled:opacity-50"
            >
              {isDownloading ? <Loader2 className="animate-spin" size={17} /> : <><Download size={17} /> Simpan Nota</>}
            </button>
            <button onClick={printThermal} className="flex items-center justify-center gap-2 bg-slate-800 text-white py-3.5 rounded-2xl text-sm font-bold hover:bg-slate-900 shadow-md active:scale-95 transition-all">
              <Printer size={17} /> Cetak Struk
            </button>
          </div>
          <Link href="/" className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-3.5 rounded-2xl text-sm font-bold hover:bg-emerald-700 shadow-md shadow-emerald-600/20 active:scale-95 transition-all">
            <ShoppingBag size={17} /> Belanja Lagi
          </Link>
          <div className="mt-5 pt-4 border-t border-slate-100 text-center">
            <a href="https://wa.me/6285853161174" target="_blank" className="inline-flex items-center gap-2 text-emerald-600 font-bold hover:underline text-sm">
              <MessageCircle size={17} /> Hubungi Admin Ataya Toko
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
          <div className="text-center mt-10 text-xs uppercase font-bold">
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
