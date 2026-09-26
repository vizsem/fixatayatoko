'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, X, RefreshCw, AlertTriangle, SwitchCamera, Check, Keyboard, Volume2 } from 'lucide-react';
import { playScanBeep } from '@/lib/sound';

interface CameraBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
  description?: string;
  allowManualInput?: boolean;
}

export default function CameraBarcodeScannerModal({
  isOpen,
  onClose,
  onScan,
  title = 'Scan Barcode Kamera',
  description = 'Arahkan kamera ke barcode / QR code produk',
  allowManualInput = true,
}: CameraBarcodeScannerModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [scannedSuccess, setScannedSuccess] = useState<string | null>(null);

  const scannerRef = useRef<any>(null);
  const scannerContainerId = 'interactive-camera-barcode-reader';
  const isStoppingRef = useRef(false);

  // Stop scanner safely
  const stopScanner = useCallback(async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    try {
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      }
    } catch (err) {
      console.warn('Error clearing camera scanner:', err);
    } finally {
      scannerRef.current = null;
      isStoppingRef.current = false;
    }
  }, []);

  // Handle successful scan
  const handleSuccess = useCallback((decodedText: string) => {
    if (!decodedText || scannedSuccess) return;
    const cleanCode = decodedText.trim();
    if (!cleanCode) return;

    setScannedSuccess(cleanCode);

    // Audio & Haptic feedback
    playScanBeep();
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(80);
      } catch {
        // ignore vibrate errors
      }
    }

    // Give visual confirmation for 250ms then trigger onScan & close
    setTimeout(async () => {
      await stopScanner();
      onScan(cleanCode);
      onClose();
    }, 250);
  }, [scannedSuccess, onScan, onClose, stopScanner]);

  // Start scanner
  const startScanner = useCallback(async (cameraIndex = 0) => {
    setLoading(true);
    setError(null);
    setScannedSuccess(null);

    // 1. Validasi Secure Context (HTTPS atau Localhost)
    if (typeof window !== 'undefined') {
      const isLocalhost =
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname === '::1';

      if (!window.isSecureContext && !isLocalhost) {
        setError(
          'Kamera diblokir browser karena halaman tidak memakai HTTPS. Akses kamera mewajibkan domain ber-SSL (HTTPS) atau localhost.'
        );
        setLoading(false);
        return;
      }
    }

    try {
      await stopScanner();

      // Dynamic import to prevent SSR breakages
      const mod = await import('html5-qrcode');
      const Html5Qrcode = mod.Html5Qrcode;

      // Make sure container exists in DOM
      const container = document.getElementById(scannerContainerId);
      if (!container) {
        setLoading(false);
        return;
      }

      const scanner = new Html5Qrcode(scannerContainerId);
      scannerRef.current = scanner;

      // Get cameras
      let availableCameras: Array<{ id: string; label: string }> = [];
      try {
        availableCameras = await Html5Qrcode.getCameras();
        setCameras(availableCameras);
      } catch (camErr) {
        console.warn('Could not enumerate cameras:', camErr);
      }

      // Scanner options
      const config = {
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minDim = Math.min(viewfinderWidth, viewfinderHeight);
          const boxSize = Math.max(220, Math.floor(minDim * 0.72));
          return {
            width: boxSize,
            height: Math.floor(boxSize * 0.65), // rectangular ratio fits standard 1D barcodes better
          };
        },
        aspectRatio: 1.0,
      };

      // Select camera: environment (belakang) or selected index
      let cameraConfig: any = { facingMode: 'environment' };
      if (availableCameras.length > 0 && availableCameras[cameraIndex]?.id) {
        cameraConfig = availableCameras[cameraIndex].id;
      }

      await scanner.start(
        cameraConfig,
        config,
        (decodedText: string) => {
          handleSuccess(decodedText);
        },
        () => {
          // Frame error (normal during camera stream without barcode)
        }
      );

      setLoading(false);
    } catch (err: any) {
      console.error('Html5Qrcode start error:', err);
      let message = 'Gagal mengakses kamera.';
      const errStr = (err?.message || String(err)).toLowerCase();

      if (errStr.includes('permission') || errStr.includes('notallowederror')) {
        message = 'Izin kamera ditolak. Silakan izinkan akses kamera di ikon gembok / setelan browser Anda.';
      } else if (errStr.includes('notfounderror') || errStr.includes('device')) {
        message = 'Kamera tidak ditemukan di perangkat ini.';
      } else if (errStr.includes('notreadableerror') || errStr.includes('could not start')) {
        message = 'Kamera sedang digunakan oleh aplikasi lain atau tab browser lain.';
      } else if (errStr.includes('secure') || errStr.includes('https')) {
        message = 'Browser memblokir kamera karena belum menggunakan HTTPS.';
      }

      setError(message);
      setLoading(false);
    }
  }, [stopScanner, handleSuccess]);

  // Switch camera between available cameras
  const handleSwitchCamera = () => {
    if (cameras.length <= 1) return;
    const nextIndex = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(nextIndex);
    startScanner(nextIndex);
  };

  // Manual submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleSuccess(manualCode.trim());
  };

  // Effect when modal opens / closes
  useEffect(() => {
    if (isOpen) {
      setScannedSuccess(null);
      setShowManualInput(false);
      setManualCode('');
      // Small delay to allow modal DOM animation to mount #scannerContainerId
      const timer = setTimeout(() => {
        startScanner(0);
      }, 150);
      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [isOpen, startScanner, stopScanner]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-neutral-900 text-white rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-neutral-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Camera size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-wide text-white">{title}</h3>
              <p className="text-[10px] text-neutral-400 font-semibold">{description}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {cameras.length > 1 && (
              <button
                type="button"
                onClick={handleSwitchCamera}
                title="Ganti Kamera"
                className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-all"
              >
                <SwitchCamera size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                stopScanner();
                onClose();
              }}
              className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Viewport Area */}
        <div className="relative w-full aspect-square bg-black flex items-center justify-center overflow-hidden">
          {/* Container for Html5Qrcode video */}
          <div
            id={scannerContainerId}
            className="w-full h-full overflow-hidden [&>video]:w-full [&>video]:h-full [&>video]:object-cover"
          />

          {/* Scanner Overlay Laser & Corners (Visible when camera is active) */}
          {!loading && !error && !scannedSuccess && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
              <div className="relative w-full max-w-[260px] h-[170px] border-2 border-white/30 rounded-2xl flex items-center justify-center">
                {/* 4 Corner Markers */}
                <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-blue-500 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-blue-500 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-blue-500 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-blue-500 rounded-br-lg" />

                {/* Laser animation */}
                <div className="absolute left-2 right-2 h-[2px] bg-red-500 shadow-[0_0_12px_#ef4444] animate-pulse" />
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {loading && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900/90 gap-3 z-10">
              <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
              <p className="text-xs font-bold text-neutral-300">Menghubungkan ke kamera...</p>
            </div>
          )}

          {/* Scanned Success Flash */}
          {scannedSuccess && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-950/80 backdrop-blur-sm gap-2 z-20 animate-fade-in">
              <div className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/50">
                <Check size={28} className="stroke-[3]" />
              </div>
              <p className="text-sm font-black text-white">Barcode Terbaca!</p>
              <p className="text-xs font-mono font-bold text-emerald-300 bg-emerald-900/80 px-3 py-1 rounded-full border border-emerald-500/30">
                {scannedSuccess}
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-neutral-900/95 text-center gap-3 z-20">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <AlertTriangle size={24} />
              </div>
              <h4 className="text-sm font-bold text-white">Kamera Belum Bisa Diakses</h4>
              <p className="text-xs text-neutral-400 max-w-xs leading-relaxed">{error}</p>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => startScanner(currentCameraIndex)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <RefreshCw size={13} /> Coba Lagi
                </button>
                {allowManualInput && (
                  <button
                    type="button"
                    onClick={() => setShowManualInput(true)}
                    className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <Keyboard size={13} /> Input Manual
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer / Controls */}
        <div className="p-4 bg-neutral-900 border-t border-white/10 flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-[11px] text-neutral-400">
            <span className="flex items-center gap-1.5">
              <Volume2 size={13} className="text-emerald-400" />
              Nada dering aktif saat ter-scan
            </span>
            {allowManualInput && !showManualInput && (
              <button
                type="button"
                onClick={() => setShowManualInput(true)}
                className="text-blue-400 hover:text-blue-300 font-bold underline underline-offset-2"
              >
                Ketik Barcode
              </button>
            )}
          </div>

          {/* Fallback Manual Input */}
          {showManualInput && (
            <form onSubmit={handleManualSubmit} className="flex gap-2 mt-1 animate-slide-up">
              <input
                type="text"
                autoFocus
                placeholder="Ketik angka barcode atau SKU..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="flex-1 bg-neutral-800 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-neutral-500 outline-none focus:border-blue-500 transition-all"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
              >
                Gunakan
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
