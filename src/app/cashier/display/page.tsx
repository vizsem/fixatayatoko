'use client';

import { useEffect, useState } from 'react';
import { ShoppingCart, CheckCircle, Sparkles, QrCode, Maximize2, Minimize2, Store } from 'lucide-react';
import { formatProductName } from '@/lib/format';

type DisplayItem = {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  quantity: number;
  unit: string;
  contains?: number;
  appliedTier?: string;
};

type DisplayData = {
  cart: DisplayItem[];
  subtotal: number;
  total: number;
  cartSavings: number;
  paymentMethod: string;
  status: 'idle' | 'scanning' | 'paying' | 'completed';
  changeAmount?: number;
  payAmount?: number;
  customerName?: string;
  qrisCode?: string;
  receiptNo?: string;
};

export default function CustomerFacingDisplay() {
  const [data, setData] = useState<DisplayData>({
    cart: [],
    subtotal: 0,
    total: 0,
    cartSavings: 0,
    paymentMethod: 'CASH',
    status: 'idle',
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }) + ' • ' + now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // 1. Baca initial data dari localStorage
    try {
      const saved = localStorage.getItem('pos_customer_display_data');
      if (saved) {
        setData(JSON.parse(saved));
      }
    } catch {}

    // 2. Listen BroadcastChannel dari tab kasir
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('pos_customer_display');
      channel.onmessage = (event) => {
        if (event.data) {
          setData(event.data);
        }
      };
    } catch (e) {
      console.warn('BroadcastChannel not supported, falling back to storage events');
    }

    // 3. Fallback listen window storage event
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'pos_customer_display_data' && e.newValue) {
        try {
          setData(JSON.parse(e.newValue));
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      if (channel) channel.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const isCompleted = data.status === 'completed';
  const isQrisActive = data.paymentMethod === 'QRIS' && data.status === 'paying';

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col font-sans select-none overflow-hidden">
      {/* Top Header */}
      <header className="bg-slate-800/90 backdrop-blur-md border-b border-slate-700/80 px-6 py-4 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-black text-xl">
            <Store size={22} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              ATAYATOKO
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                Pusat Grosir & Eceran
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">Kediri • Belanja Nyaman, Pasti Hemat</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs md:text-sm font-semibold text-slate-300 font-mono bg-slate-950/50 px-3 py-1.5 rounded-xl border border-slate-700/50">
            {currentTime}
          </span>
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Keluar Fullscreen' : 'Layar Penuh'}
            className="p-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden p-6 gap-6">
        {/* Left Side: Cart Items Table */}
        <div className="col-span-12 lg:col-span-7 xl:col-span-8 bg-slate-800/70 border border-slate-700/60 rounded-3xl flex flex-col overflow-hidden shadow-2xl backdrop-blur-sm">
          <div className="px-6 py-4 border-b border-slate-700/60 flex items-center justify-between shrink-0 bg-slate-800/90">
            <div className="flex items-center gap-2 text-emerald-400 font-black text-sm uppercase tracking-wider">
              <ShoppingCart size={18} />
              <span>Daftar Belanjaan ({data.cart?.reduce((acc, i) => acc + (Number(i.quantity) || 1), 0) || 0} Item)</span>
            </div>
            {data.customerName && (
              <span className="text-xs font-bold text-slate-300 bg-slate-700/80 px-2.5 py-1 rounded-full border border-slate-600">
                Pelanggan: <span className="text-white font-black">{data.customerName}</span>
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {data.cart && data.cart.length > 0 ? (
              data.cart.map((item, idx) => {
                const orig = Number(item.originalPrice || item.price || 0);
                const cur = Number(item.price || 0);
                const qty = Number(item.quantity || 1);
                const lineTotal = cur * qty;
                const isDiscounted = orig > cur;
                const qtyStr = Number.isInteger(qty) ? String(qty) : qty.toLocaleString('id-ID', { maximumFractionDigits: 3 });

                return (
                  <div
                    key={item.id || idx}
                    className="p-3.5 bg-slate-900/60 hover:bg-slate-900/90 border border-slate-700/50 rounded-2xl flex items-center justify-between gap-4 transition-all animate-fadeIn"
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-white truncate leading-snug">
                        {formatProductName(item.name)}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-xs">
                        <span className="bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded-md border border-slate-700">
                          {qtyStr} {item.unit || 'PCS'}
                        </span>
                        <span className="text-slate-400">@Rp{cur.toLocaleString('id-ID')}</span>
                        {isDiscounted && (
                          <span className="line-through text-slate-500 font-medium">
                            Rp{orig.toLocaleString('id-ID')}
                          </span>
                        )}
                        {item.appliedTier && item.appliedTier !== 'Retail' && (
                          <span className="bg-emerald-950 text-emerald-300 border border-emerald-600/40 font-black text-[10px] px-2 py-0.5 rounded-full">
                            {item.appliedTier}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-lg font-black text-emerald-400">
                        Rp{lineTotal.toLocaleString('id-ID')}
                      </div>
                      {isDiscounted && (
                        <div className="text-[11px] font-bold text-teal-400">
                          Hemat Rp{((orig - cur) * qty).toLocaleString('id-ID')}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 space-y-4">
                <div className="w-24 h-24 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-500/5">
                  <Sparkles size={44} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">Selamat Datang di ATAYATOKO!</h3>
                  <p className="text-sm text-slate-400 max-w-sm mt-1">
                    Kasir kami siap melayani belanjaan Anda. Barang yang di-scan akan muncul otomatis di layar ini.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Total Summary & Payment Info */}
        <div className="col-span-12 lg:col-span-5 xl:col-span-4 flex flex-col gap-6">
          {/* Main Total Card */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/80 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col justify-between">
            <div className="space-y-4">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400 block">
                Total Tagihan Belanja
              </span>

              <div className="space-y-1">
                <div className="text-4xl xl:text-5xl font-black text-emerald-400 tracking-tight font-mono">
                  Rp{(data.total || 0).toLocaleString('id-ID')}
                </div>
                {data.subtotal > 0 && data.cartSavings > 0 && (
                  <div className="text-xs text-slate-400">
                    Subtotal Normal: <span className="line-through">Rp{(data.subtotal + data.cartSavings).toLocaleString('id-ID')}</span>
                  </div>
                )}
              </div>

              {data.cartSavings > 0 && (
                <div className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 p-3.5 rounded-2xl flex items-center justify-between text-xs font-black shadow-lg shadow-emerald-950/50">
                  <span className="flex items-center gap-1.5">
                    <Sparkles size={16} className="text-emerald-400" />
                    PENGHEMATAN ANDA:
                  </span>
                  <span className="text-sm font-black text-white bg-emerald-700/80 px-2.5 py-0.5 rounded-lg">
                    -Rp{data.cartSavings.toLocaleString('id-ID')}
                  </span>
                </div>
              )}
            </div>

            {/* Status Transaksi Selesai */}
            {isCompleted ? (
              <div className="mt-6 p-5 bg-emerald-900/50 border border-emerald-500/50 rounded-2xl text-center space-y-2 animate-bounce">
                <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
                  <CheckCircle size={28} />
                </div>
                <h4 className="text-lg font-black text-white">Transaksi Berhasil!</h4>
                <p className="text-xs text-emerald-200">
                  Kembalian: <span className="text-sm font-black text-white">Rp{(data.changeAmount || 0).toLocaleString('id-ID')}</span>
                </p>
                <p className="text-[11px] text-slate-300 pt-1">Terima kasih atas kunjungan Anda!</p>
              </div>
            ) : isQrisActive ? (
              <div className="mt-6 p-5 bg-blue-950/80 border border-blue-500/40 rounded-2xl text-center space-y-3">
                <div className="flex items-center justify-center gap-2 text-blue-300 text-xs font-black uppercase">
                  <QrCode size={16} />
                  <span>Scan QRIS untuk Membayar</span>
                </div>
                {data.qrisCode ? (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(data.qrisCode)}`}
                    alt="QRIS"
                    className="w-48 h-48 mx-auto rounded-xl bg-white p-2 border-2 border-blue-400 shadow-md"
                  />
                ) : (
                  <div className="w-48 h-48 mx-auto rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-500 text-xs">
                    Memuat Kode QRIS...
                  </div>
                )}
                <p className="text-[11px] text-slate-300 font-medium">Bisa pakai GoPay, OVO, Dana, ShopeePay, BCA, dll.</p>
              </div>
            ) : (
              <div className="mt-6 pt-4 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
                <span>Metode Pembayaran:</span>
                <span className="font-black text-white bg-slate-700/80 px-2.5 py-1 rounded-lg uppercase">
                  {data.paymentMethod || 'CASH'}
                </span>
              </div>
            )}
          </div>

          {/* Bottom Card: Toko Info / Pesan Promosi */}
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 text-center text-xs text-slate-400 space-y-1">
            <p className="font-bold text-slate-300">💡 Belanja Lebih Banyak, Harga Lebih Murah!</p>
            <p className="text-[11px] text-slate-400">Tersedia harga khusus Semi-Grosir untuk warung kelontong & harga grosir partai.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

