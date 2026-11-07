'use client';

import Link from 'next/link';
import { WifiOff, RefreshCw, Home, ShoppingBag } from 'lucide-react';

export default function OfflinePage() {
  return (
    <main className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-xl">
        <div className="w-16 h-16 mx-auto mb-4 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 shadow-inner">
          <WifiOff size={32} />
        </div>

        <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">
          Koneksi Terputus
        </h1>

        <p className="text-xs text-gray-500 font-medium mt-2 leading-relaxed">
          Sepertinya perangkat Anda sedang offline atau koneksi internet tidak stabil. Tenang, data katalog yang sudah tersimpan sebelumnya tetap bisa Anda akses.
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            onClick={() => window.location.reload()}
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-black rounded-xl shadow-md shadow-blue-200 transition-all"
          >
            <RefreshCw size={15} />
            <span>Coba Muat Ulang</span>
          </button>

          <Link
            href="/"
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-xl transition-colors"
          >
            <Home size={15} />
            <span>Kembali ke Beranda</span>
          </Link>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-center gap-1 text-[11px] font-bold text-gray-400">
          <ShoppingBag size={13} className="text-blue-500" />
          <span>ATAYATOKO Grosir Sembako Kediri</span>
        </div>
      </div>
    </main>
  );
}

