'use client';

import { useEffect, useState, Suspense, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CheckCircle, ShoppingBag, MessageCircle, Printer,
  Copy, Check, Loader2, Download, Clock, RefreshCw,
  Wifi, WifiOff, AlertCircle, Sparkles, QrCode, ImageDown,
} from 'lucide-react';
import Link from 'next/link';
import { Order, OrderItem } from '@/lib/types';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import { sbGetDocs } from '@/lib/supabase-helpers';

// ── Constants ──────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 3000;  // poll setiap 3 detik
const QR_VALIDITY_MINUTES = 15;

// ── CountdownBar ────────────────────────────────────────────────────────────
function CountdownBar({ expiresAt }: { expiresAt: string }) {
  const total = QR_VALIDITY_MINUTES * 60;
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setRemaining(diff);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  const pct = Math.min(100, (remaining / total) * 100);
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const urgent = remaining > 0 && remaining < 60;
  const expired = remaining === 0;

  return (
    <div className="space-y-1.5">
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            expired ? 'bg-red-400' : urgent ? 'bg-orange-400 animate-pulse' : 'bg-emerald-400'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className={`text-xs font-bold text-center ${
        expired ? 'text-red-500' : urgent ? 'text-orange-500' : 'text-slate-400'
      }`}>
        {expired ? 'QR Kadaluarsa — Refresh halaman' : `QR berlaku ${mins}:${String(secs).padStart(2, '0')}`}
      </p>
    </div>
  );
}

// ── Confetti burst ───────────────────────────────────────────────────────────
function ConfettiBurst() {
  const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444'];
  const particles = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    color: colors[i % colors.length],
    left: Math.random() * 100,
    delay: Math.random() * 0.8,
    duration: 1.5 + Math.random() * 1,
    size: 6 + Math.random() * 8,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[300]">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute top-0 rounded-sm animate-bounce"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `translateY(-20px) rotate(${Math.random() * 360}deg)`,
            animation: `confetti-fall ${p.duration}s ${p.delay}s ease-in forwards`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── QrisPaidScreen ──────────────────────────────────────────────────────────
function QrisPaidScreen({ customerName, orderId, total, onContinue }: {
  customerName: string; orderId: string; total: number; onContinue: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col items-center justify-center p-6 text-center">
      <ConfettiBurst />
      <div className="relative mb-6">
        <div className="w-28 h-28 bg-emerald-100 rounded-full flex items-center justify-center mx-auto animate-in zoom-in-50 duration-500">
          <CheckCircle className="text-emerald-500" size={64} strokeWidth={1.5} />
        </div>
        <div className="absolute -top-1 -right-1 bg-yellow-400 rounded-full p-1.5 animate-in spin-in-180 duration-700">
          <Sparkles className="text-white" size={16} />
        </div>
      </div>
      <h1 className="text-3xl font-black text-slate-900 mb-2 animate-in slide-in-from-bottom-4 duration-500">
        Pembayaran Berhasil!
      </h1>
      <p className="text-slate-500 text-sm mb-1 animate-in slide-in-from-bottom-4 duration-500 delay-100">
        QRIS BRI telah dikonfirmasi
      </p>
      <p className="text-slate-400 text-xs mb-6 animate-in slide-in-from-bottom-4 duration-500 delay-150">
        Terima kasih, <span className="font-bold text-slate-700">{customerName}</span>!
      </p>
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-8 py-4 mb-8 animate-in slide-in-from-bottom-4 duration-500 delay-200">
        <p className="text-3xl font-black text-emerald-600">Rp{total.toLocaleString('id-ID')}</p>
        <p className="text-xs text-emerald-500 font-bold mt-1 uppercase tracking-wider">Lunas ✓</p>
      </div>
      <div className="bg-slate-50 rounded-2xl px-5 py-3 mb-8 animate-in slide-in-from-bottom-4 duration-500 delay-300">
        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">ID Pesanan</p>
        <code className="text-sm font-mono font-black text-slate-700">{orderId}</code>
      </div>
      <button
        onClick={onContinue}
        className="bg-emerald-600 text-white px-10 py-4 rounded-2xl font-black text-sm hover:bg-emerald-700 active:scale-95 transition-all shadow-lg shadow-emerald-200 animate-in slide-in-from-bottom-4 duration-500 delay-500"
      >
        Lihat Detail Pesanan
      </button>
    </div>
  );
}

// ── QrisSection ─────────────────────────────────────────────────────────────
function QrisSection({
  orderId, total, qrisContent, qrisLoading, onPaid, onRefresh
}: {
  orderId: string;
  total: number;
  qrisContent: string;
  qrisLoading: boolean;
  onPaid: () => void;
  onRefresh: () => void;
}) {
  const [autoMode, setAutoMode] = useState(true);
  const [pollCount, setPollCount] = useState(0);
  const [isPolling, setIsPolling] = useState(false);
  const [isSavingQr, setIsSavingQr] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const paidRef = useRef(false);
  const qrCardRef = useRef<HTMLDivElement>(null);
  // Parse expiry dari QR validity (15 menit dari sekarang, di-set saat QR generate)
  const [expiresAt] = useState(() => new Date(Date.now() + QR_VALIDITY_MINUTES * 60 * 1000).toISOString());

  // ── Save QR to gallery ──────────────────────────────────────────────────
  const saveQrToGallery = useCallback(async () => {
    if (!qrCardRef.current || isSavingQr) return;
    setIsSavingQr(true);
    try {
      const htmlToImage = await import('html-to-image');
      // Render as high-res PNG (3× untuk galeri mobile)
      const dataUrl = await htmlToImage.toPng(qrCardRef.current, {
        quality: 1,
        pixelRatio: 3,
        backgroundColor: '#ffffff',
        style: { borderRadius: '16px' },
      });

      // Coba Web Share API dulu (native share sheet di iOS/Android)
      if (
        typeof navigator !== 'undefined' &&
        navigator.share &&
        navigator.canShare
      ) {
        try {
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], `QRIS-${orderId}.png`, { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: 'QRIS Ataya Toko',
              text: `Kode QRIS untuk pesanan #${orderId}`,
              files: [file],
            });
            toast.success('QR berhasil dibagikan / disimpan!');
            return;
          }
        } catch (shareErr: unknown) {
          // User cancel share — tidak perlu error toast
          if ((shareErr as DOMException)?.name === 'AbortError') return;
        }
      }

      // Fallback: trigger download biasa (tersimpan di folder Downloads/Galeri)
      const link = document.createElement('a');
      link.download = `QRIS-Ataya-${orderId}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('✅ QR disimpan ke galeri / folder Unduhan');
    } catch {
      toast.error('Gagal menyimpan QR — coba screenshot manual');
    } finally {
      setIsSavingQr(false);
    }
  }, [orderId, isSavingQr]);

  const checkStatus = useCallback(async () => {
    if (paidRef.current) return;
    setIsPolling(true);
    try {
      // Poll via status API menggunakan orderId sebagai referenceNo
      const res = await fetch(`/api/payments/bri/qris/status?referenceNo=${encodeURIComponent(orderId)}`);
      const data = await res.json();
      if (data.paid) {
        paidRef.current = true;
        if (pollRef.current) clearInterval(pollRef.current);
        toast.success('✅ Pembayaran QRIS dikonfirmasi!', { duration: 3000 });
        setTimeout(onPaid, 800);
      }
      setPollCount(c => c + 1);
    } catch {
      // silent
    } finally {
      setIsPolling(false);
    }
  }, [orderId, onPaid]);

  useEffect(() => {
    if (!qrisContent || !autoMode || paidRef.current) return;
    pollRef.current = setInterval(checkStatus, POLL_INTERVAL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [qrisContent, autoMode, checkStatus]);

  const copyQr = () => {
    if (qrisContent) {
      navigator.clipboard.writeText(qrisContent).then(() => toast.success('String QR disalin'));
    }
  };

  if (qrisLoading && !qrisContent) {
    return (
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 text-center">
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <QrCode className="text-blue-400" size={32} />
        </div>
        <div className="flex items-center justify-center gap-2 text-slate-500 mb-2">
          <Loader2 className="animate-spin" size={16} />
          <span className="text-sm font-semibold">Menyiapkan kode QRIS BRI...</span>
        </div>
        <p className="text-xs text-slate-400">Sedang menghubungi BRI SNAP</p>
      </div>
    );
  }

  if (!qrisContent) {
    return (
      <div className="bg-white rounded-3xl border border-red-100 shadow-sm p-8 text-center">
        <AlertCircle className="text-red-400 mx-auto mb-3" size={36} />
        <p className="text-sm font-bold text-red-600 mb-4">QR belum tersedia</p>
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-2 bg-red-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-red-600 transition-colors"
        >
          <RefreshCw size={14} /> Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
            <span className="text-base">🏦</span>
          </div>
          <div>
            <p className="text-white font-black text-sm uppercase tracking-tight">Bayar dengan QRIS</p>
            <p className="text-blue-200 text-[10px] font-medium">BRI SNAP · MPM Dinamis</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-white font-black text-lg leading-tight">Rp{total.toLocaleString('id-ID')}</p>
          <p className="text-blue-200 text-[10px]">Total Tagihan</p>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* QR Code */}
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative flex-shrink-0">
            {/* qrCardRef menangkap area ini untuk disimpan sebagai gambar */}
            <div
              ref={qrCardRef}
              className="bg-white p-4 rounded-2xl border-4 border-slate-100 shadow-inner flex flex-col items-center gap-2"
            >
              <QRCodeSVG
                value={qrisContent}
                size={180}
                level="M"
                includeMargin={false}
              />
              <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">ATAYA TOKO · QRIS BRI</p>
            </div>
            {/* Pulse indicator */}
            {autoMode && (
              <div className="absolute -top-1 -right-1 bg-blue-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                LIVE
              </div>
            )}
          </div>

          <div className="flex-1 space-y-4 w-full">
            {/* Instruksi */}
            <div className="space-y-2">
              {[
                { n: '1', text: 'Buka aplikasi m-Banking / e-wallet Anda' },
                { n: '2', text: 'Pilih menu Bayar/Scan QR atau QRIS' },
                { n: '3', text: 'Scan QR code di samping ini' },
                { n: '4', text: 'Konfirmasi jumlah & selesaikan pembayaran' },
              ].map(s => (
                <div key={s.n} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">{s.n}</span>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">{s.text}</p>
                </div>
              ))}
            </div>

            {/* Status polling */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold ${
              autoMode
                ? 'bg-blue-50 border-blue-100 text-blue-700'
                : 'bg-slate-50 border-slate-100 text-slate-500'
            }`}>
              {autoMode
                ? <><Wifi size={12} /><span>Mendeteksi otomatis ({pollCount}×)<span className="font-normal text-blue-400"> · cek tiap 3 detik</span></span></>
                : <><WifiOff size={12} /><span>Mode manual — konfirmasi sendiri setelah bayar</span></>
              }
              {isPolling && <Loader2 size={10} className="ml-auto animate-spin text-blue-400" />}
            </div>
          </div>
        </div>

        {/* Countdown */}
        <CountdownBar expiresAt={expiresAt} />

        {/* Controls */}
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={saveQrToGallery}
            disabled={isSavingQr}
            className="flex flex-col items-center gap-1 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors disabled:opacity-50"
          >
            {isSavingQr
              ? <Loader2 size={14} className="text-emerald-500 animate-spin" />
              : <ImageDown size={14} className="text-emerald-600" />}
            <span className="text-[10px] font-bold text-emerald-600">Simpan QR</span>
          </button>
          <button
            onClick={copyQr}
            className="flex flex-col items-center gap-1 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
          >
            <Copy size={14} className="text-slate-500" />
            <span className="text-[10px] font-bold text-slate-500">Salin QR</span>
          </button>
          <button
            onClick={() => setAutoMode(v => !v)}
            className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-colors ${
              autoMode
                ? 'bg-blue-50 border-blue-200 text-blue-600'
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}
          >
            {autoMode ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span className="text-[10px] font-bold">{autoMode ? 'Auto ON' : 'Auto OFF'}</span>
          </button>
          <button
            onClick={onRefresh}
            className="flex flex-col items-center gap-1 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
          >
            <RefreshCw size={14} className="text-slate-500" />
            <span className="text-[10px] font-bold text-slate-500">Refresh</span>
          </button>
        </div>

        {/* Manual confirm */}
        {!autoMode && (
          <button
            onClick={() => {
              paidRef.current = true;
              if (pollRef.current) clearInterval(pollRef.current);
              onPaid();
            }}
            className="w-full py-3.5 bg-emerald-600 text-white rounded-2xl font-black text-sm hover:bg-emerald-700 active:scale-95 transition-all shadow-lg shadow-emerald-200 uppercase tracking-wide"
          >
            ✓ Saya Sudah Bayar
          </button>
        )}
      </div>
    </div>
  );
}

// ── SuccessContent (main) ───────────────────────────────────────────────────
function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('id');
  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState<Order | null>(null);
  const [qrisLoading, setQrisLoading] = useState(false);
  const [showPaidScreen, setShowPaidScreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

  // Fetch order
  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) { setLoading(false); return; }
      try {
        const snap = await sbGetDocs({
          table: 'orders',
          where: [{ field: 'orderId', op: '==', val: orderId }],
          limit: 1,
          useAdmin: false,
        });
        if (!snap.empty) {
          setOrderData({ id: snap.docs[0].id, ...snap.docs[0].data() } as Order);
        }
      } catch (err) {
        console.error('Gagal fetch order:', err);
      } finally {
        setLoading(false);
      }
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => fetchOrder());
    fetchOrder();
    return () => subscription.unsubscribe();
  }, [orderId]);

  // Auto-generate QRIS jika metode qris_bri dan QR belum ada
  useEffect(() => {
    const ensureQris = async () => {
      if (!orderId || !orderData) return;
      const method = String(orderData.payment?.method || '').toLowerCase();
      const paymentStatus = String((orderData as any).paymentStatus || '').toUpperCase();
      const qrContent = String((orderData as any).payment?.bri?.qrContent || '');
      if (paymentStatus === 'PAID') return;
      if (!['qris_bri', 'qris-bri', 'qris_bri_auto', 'qris_bri_otomatis'].includes(method)) return;
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
          setOrderData(prev => {
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

  // Derived values
  const displayTotal = orderData?.total || 0;
  const displayItems = orderData?.items || [];
  const displayMethod = orderData?.delivery?.method || 'Ambil di Toko';
  const paymentMethodRaw = orderData?.payment?.method || 'CASH';
  const displayPayment = String(paymentMethodRaw).toLowerCase() === 'qris_bri' ? 'QRIS BRI' : String(paymentMethodRaw).toUpperCase();
  const displayCustomer = orderData?.name || orderData?.customerName || 'Pelanggan';
  const qrisContent = String((orderData as any)?.payment?.bri?.qrContent || '');
  const isQrisBri = ['qris_bri', 'qris-bri', 'qris_bri_auto', 'qris_bri_otomatis'].includes(String(paymentMethodRaw).toLowerCase());
  const isPaid = String((orderData as any)?.paymentStatus || '').toUpperCase() === 'PAID';

  const handleQrisPaid = useCallback(() => {
    setShowPaidScreen(true);
    // Update order status di DB via webhook, atau tandai paid di state
    setOrderData(prev => prev ? { ...prev, paymentStatus: 'PAID' } as any : prev);
  }, []);

  const handleRefreshQr = useCallback(() => {
    // Force re-generate: hapus qrContent dari state supaya useEffect re-trigger
    setOrderData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        payment: {
          ...(prev.payment || {}),
          bri: { ...(prev as any)?.payment?.bri, qrContent: '' },
        } as any,
      };
    });
  }, []);

  const copyOrderId = () => {
    if (orderId) {
      navigator.clipboard.writeText(orderId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const printThermal = () => {
    if (!orderData) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const itemsHtml = displayItems.map((item: OrderItem) => `
      <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
        <span style="flex:1;text-transform:uppercase;">${item.name || 'Produk'}</span>
        <span style="width:40px;text-align:center;">${item.quantity || 0}x</span>
        <span style="width:70px;text-align:right;">${((item.price || 0) * (item.quantity || 0)).toLocaleString()}</span>
      </div>
    `).join('');
    w.document.write(`<html><head><title>Struk ${orderId}</title>
      <style>@page{margin:0;}body{font-family:'Courier New',monospace;width:58mm;padding:4mm;font-size:11px;line-height:1.2;}
      .c{text-align:center;}.b{font-weight:bold;}.l{border-top:1px dashed #000;margin:5px 0;}</style>
      </head><body onload="setTimeout(()=>{window.print();window.close();},500);">
      <div class="c b" style="font-size:14px;">ATAYA TOKO</div>
      <div class="c">KEDIRI - JATIM</div><div class="l"></div>
      <div>ID: ${orderId?.toUpperCase()}</div>
      <div>Tgl: ${new Date().toLocaleString('id-ID')}</div>
      <div class="l"></div>${itemsHtml}<div class="l"></div>
      <div style="display:flex;justify-content:space-between;" class="b"><span>TOTAL</span><span>Rp${displayTotal.toLocaleString()}</span></div>
      <div class="c" style="margin-top:15px;">TERIMA KASIH</div>
      </body></html>`);
    w.document.close();
  };

  const saveInvoiceAsImage = async () => {
    if (!invoiceRef.current) return;
    setIsDownloading(true);
    try {
      const htmlToImage = await import('html-to-image');
      const dataUrl = await htmlToImage.toJpeg(invoiceRef.current, { quality: 0.95, backgroundColor: '#ffffff', pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `Nota-Ataya-${orderId}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch {
      toast.error('Gagal menyimpan nota');
    } finally {
      setIsDownloading(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] gap-3">
        <Loader2 className="animate-spin text-emerald-600" size={36} />
        <p className="text-sm font-medium text-slate-500">Memuat data pesanan...</p>
      </div>
    );
  }

  if (!orderData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] p-6 text-center">
        <h1 className="text-xl font-black text-slate-900 mb-2">Data Tidak Ditemukan</h1>
        <p className="text-sm text-slate-500 mb-6">
          Pesanan <b className="text-slate-700">{orderId}</b> mungkin masih diproses atau tidak ditemukan.
        </p>
        <Link href="/" className="bg-emerald-600 text-white px-8 py-3 rounded-2xl text-sm font-bold hover:bg-emerald-700 transition-colors">
          Kembali ke Toko
        </Link>
      </div>
    );
  }

  // ── QRIS Paid Screen overlay ─────────────────────────────────────────────
  if (showPaidScreen) {
    return (
      <QrisPaidScreen
        customerName={displayCustomer}
        orderId={orderId || ''}
        total={displayTotal}
        onContinue={() => setShowPaidScreen(false)}
      />
    );
  }

  // ── Main Page ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F8FAFC] py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* ── Hero ── */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm text-center p-8">
          <div className="flex justify-center mb-5">
            <div className={`p-5 rounded-full ${isPaid ? 'bg-emerald-100' : isQrisBri ? 'bg-blue-50' : 'bg-emerald-100'}`}>
              {isPaid
                ? <CheckCircle className="text-emerald-600" size={48} />
                : isQrisBri
                  ? <QrCode className="text-blue-500" size={48} />
                  : <CheckCircle className="text-emerald-600" size={48} />
              }
            </div>
          </div>

          {isPaid ? (
            <>
              <div className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-xs font-black px-3 py-1 rounded-full mb-3 uppercase tracking-wide">
                <CheckCircle size={12} /> Pembayaran Lunas
              </div>
              <h1 className="text-2xl font-black text-slate-900 mb-2">Transaksi Selesai! 🎉</h1>
            </>
          ) : isQrisBri ? (
            <>
              <div className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-700 text-xs font-black px-3 py-1 rounded-full mb-3 uppercase tracking-wide">
                <Clock size={12} /> Menunggu Pembayaran QRIS
              </div>
              <h1 className="text-2xl font-black text-slate-900 mb-2">Pesanan Dibuat!</h1>
            </>
          ) : (
            <>
              <div className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-xs font-black px-3 py-1 rounded-full mb-3 uppercase tracking-wide">
                <CheckCircle size={12} /> Pesanan Berhasil
              </div>
              <h1 className="text-2xl font-black text-slate-900 mb-2">Terima Kasih!</h1>
            </>
          )}

          <p className="text-sm text-slate-500 mb-5">
            Halo, <span className="font-bold text-slate-800">{displayCustomer}</span>.
            {isQrisBri && !isPaid
              ? ' Selesaikan pembayaran QRIS di bawah ini.'
              : ' Pesanan Anda sedang diproses.'}
          </p>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 inline-flex flex-col items-center">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">ID Transaksi</span>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono font-black text-emerald-700">{orderId || 'N/A'}</code>
              <button onClick={copyOrderId} className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-500">
                {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
              </button>
            </div>
          </div>
        </div>

        {/* ── QRIS Payment Section ── */}
        {isQrisBri && !isPaid && (
          <QrisSection
            orderId={orderId || ''}
            total={displayTotal}
            qrisContent={qrisContent}
            qrisLoading={qrisLoading}
            onPaid={handleQrisPaid}
            onRefresh={handleRefreshQr}
          />
        )}

        {/* ── Paid badge (sudah bayar) ── */}
        {isPaid && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center flex-shrink-0">
              <CheckCircle className="text-emerald-600" size={28} />
            </div>
            <div>
              <p className="text-sm font-black text-emerald-800">Pembayaran Diterima</p>
              <p className="text-xs text-emerald-600 font-medium mt-0.5">
                {displayPayment} · {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        )}

        {/* ── Rincian Produk ── */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <ShoppingBag size={14} /> Rincian Pesanan
          </h3>
          <div className="space-y-3">
            {displayItems.map((item: OrderItem, idx: number) => (
              <div key={idx} className="flex justify-between items-start py-2.5 border-b border-slate-50 last:border-0">
                <div className="flex-1 pr-4">
                  <p className="text-sm font-bold text-slate-800">{item.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{item.quantity} × Rp{item.price?.toLocaleString('id-ID')}</p>
                </div>
                <p className="text-sm font-black text-slate-900">Rp{((item.price || 0) * (item.quantity || 0)).toLocaleString('id-ID')}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Info & Total ── */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <p className="text-xs text-slate-400 font-bold mb-0.5">Metode Kirim</p>
              <p className="text-sm font-bold text-slate-800">{displayMethod}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold mb-0.5">Pembayaran</p>
              <p className="text-sm font-bold text-slate-800">{displayPayment}</p>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
            <span className="text-sm font-bold text-slate-500">Total Transaksi</span>
            <span className="text-2xl font-black text-emerald-600">Rp{displayTotal.toLocaleString('id-ID')}</span>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <button
              onClick={saveInvoiceAsImage}
              disabled={isDownloading}
              className="flex items-center justify-center gap-2 bg-blue-600 text-white py-3.5 rounded-2xl text-sm font-bold hover:bg-blue-700 shadow-md active:scale-95 transition-all disabled:opacity-50"
            >
              {isDownloading ? <Loader2 className="animate-spin" size={17} /> : <><Download size={17} /> Simpan Nota</>}
            </button>
            <button
              onClick={printThermal}
              className="flex items-center justify-center gap-2 bg-slate-800 text-white py-3.5 rounded-2xl text-sm font-bold hover:bg-slate-900 shadow-md active:scale-95 transition-all"
            >
              <Printer size={17} /> Cetak Struk
            </button>
          </div>
          <Link
            href="/"
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-3.5 rounded-2xl text-sm font-bold hover:bg-emerald-700 shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
          >
            <ShoppingBag size={17} /> Belanja Lagi
          </Link>
          <div className="mt-5 pt-4 border-t border-slate-100 text-center">
            <a
              href="https://wa.me/6285853161174"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-emerald-600 font-bold hover:underline text-sm"
            >
              <MessageCircle size={17} /> Hubungi Admin Ataya Toko
            </a>
          </div>
        </div>
      </div>

      {/* ── Hidden Invoice Template ── */}
      <div className="fixed left-[-9999px] top-0 pointer-events-none">
        <div ref={invoiceRef} className="bg-white p-10" style={{ width: '500px', fontFamily: 'monospace' }}>
          <div className="text-center border-b-2 border-dashed border-black pb-6 mb-6">
            <h1 className="text-3xl font-black italic">ATAYA TOKO</h1>
            <p className="text-sm">KEDIRI, JAWA TIMUR</p>
            <p className="text-sm">WA: 085853161174</p>
          </div>
          <div className="space-y-1 mb-6 text-sm">
            <div className="flex justify-between"><span>ID TRANS:</span><strong>{orderId?.toUpperCase()}</strong></div>
            <div className="flex justify-between"><span>NAMA:</span><strong>{displayCustomer}</strong></div>
            <div className="flex justify-between"><span>TANGGAL:</span><span>{new Date().toLocaleString('id-ID')}</span></div>
            <div className="flex justify-between"><span>BAYAR:</span><span>{displayPayment}</span></div>
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
          {isPaid && <div className="text-center mt-4 text-emerald-700 font-bold text-sm">✓ LUNAS</div>}
          <div className="text-center mt-10 text-xs uppercase font-bold">*** Terima Kasih Telah Berbelanja ***</div>
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
