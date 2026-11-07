'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Download, X, Share2, PlusSquare, Sparkles } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function PWAInstallPrompt() {
  const pathname = usePathname() || '/';
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Jangan tampilkan di halaman admin / kasir
    if (pathname.startsWith('/admin') || pathname.startsWith('/cashier')) {
      return;
    }

    // Cek apakah sudah dalam mode standalone (sudah ter-install)
    const inStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (inStandaloneMode) {
      setIsStandalone(true);
      return;
    }

    // Cek apakah user sudah menutup prompt dalam 5 hari terakhir
    const dismissedAt = localStorage.getItem('pwa_prompt_dismissed');
    if (dismissedAt) {
      const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
      if (Date.now() - Number(dismissedAt) < fiveDaysMs) {
        return;
      }
    }

    // Deteksi iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/crios|fxios|opr\//.test(userAgent);
    setIsIOS(isIOSDevice && isSafari);

    // Tangkap event instalasi browser modern (Android, Chrome, Edge, dll)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Tampilkan banner setelah jeda halus (3 detik setelah halaman stabil)
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Untuk iOS Safari, tampilkan prompt dengan delay sedikit lebih lama
    let iosTimer: NodeJS.Timeout;
    if (isIOSDevice && isSafari && !inStandaloneMode) {
      iosTimer = setTimeout(() => setShowPrompt(true), 5000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, [pathname]);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }

    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    } catch (err) {
      console.warn('PWA install prompt error:', err);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setShowIOSInstructions(false);
    localStorage.setItem('pwa_prompt_dismissed', Date.now().toString());
  };

  // Jangan render jika: sudah standalone, atau di halaman admin/kasir, atau belum saatnya tampil
  if (
    isStandalone ||
    !showPrompt ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/cashier')
  ) {
    return null;
  }

  return (
    <aside
      aria-label="Install Aplikasi ATAYATOKO"
      className="fixed bottom-20 md:bottom-6 left-3 right-3 md:left-auto md:right-6 md:w-96 z-40 bg-white/95 backdrop-blur-xl border border-blue-100 shadow-2xl rounded-2xl p-3.5 transition-all animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-200">
          <Sparkles size={20} className="animate-pulse" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <h4 className="text-xs font-black uppercase tracking-tight text-gray-900">
              Install ATAYATOKO App
            </h4>
            <button
              onClick={handleDismiss}
              aria-label="Tutup"
              className="text-gray-400 hover:text-gray-600 p-0.5 rounded-lg transition-colors"
            >
              <X size={15} />
            </button>
          </div>
          <p className="text-[11px] font-medium text-gray-600 leading-snug mt-0.5">
            Belanja sembako grosir lebih cepat, hemat kuota & akses langsung dari layar utama HP Anda.
          </p>

          <div className="mt-2.5 flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-black shadow-sm transition-all"
            >
              <Download size={13} />
              <span>Install Sekarang</span>
            </button>
            <button
              onClick={handleDismiss}
              className="px-2.5 py-1.5 text-[11px] font-bold text-gray-400 hover:text-gray-600 transition-colors"
            >
              Nanti Saja
            </button>
          </div>
        </div>
      </div>

      {/* Petunjuk Khusus iOS Safari */}
      {showIOSInstructions && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-700 space-y-1.5 animate-in fade-in duration-200">
          <p className="font-bold text-[11px] text-blue-900 flex items-center gap-1">
            <span>Cara pasang di iPhone / iPad:</span>
          </p>
          <div className="flex items-center gap-2 text-[11px] text-gray-600 bg-blue-50/70 p-2 rounded-xl border border-blue-100">
            <Share2 size={14} className="text-blue-600 shrink-0" />
            <span>1. Tekan tombol <strong>Bagikan (Share)</strong> di bilah bawah Safari.</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-gray-600 bg-blue-50/70 p-2 rounded-xl border border-blue-100">
            <PlusSquare size={14} className="text-blue-600 shrink-0" />
            <span>2. Gulir ke bawah lalu pilih <strong>&quot;Tambah ke Layar Utama&quot;</strong>.</span>
          </div>
        </div>
      )}
    </aside>
  );
}

