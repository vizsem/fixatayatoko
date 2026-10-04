'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, RefreshCw, CheckCircle, Clock, Wifi, WifiOff, AlertCircle, Copy } from 'lucide-react';
import toast from 'react-hot-toast';

type QrisModalProps = {
  total: number;
  referenceNo: string; // unique POS tx reference, e.g. "POS-20261004-xxx"
  description?: string;
  onPaid: () => void;   // called when payment confirmed
  onClose: () => void;
  autoDetect?: boolean; // true = polling mode, false = manual confirm
};

type QrisState =
  | { phase: 'loading' }
  | { phase: 'ready'; qrContent: string; expiresAt: string; briRef: string }
  | { phase: 'paid'; briRef: string }
  | { phase: 'expired' }
  | { phase: 'error'; message: string };

const POLL_INTERVAL_MS = 4000; // poll every 4 seconds
const QR_VALIDITY_MINUTES = 15;

function QrCodeSvg({ value }: { value: string }) {
  // Encode as a 2D QR via Google Charts API (no npm dep needed)
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&ecc=M&data=${encodeURIComponent(value)}`;
  return (
    <img
      src={url}
      alt="QR Code QRIS"
      className="w-64 h-64 mx-auto rounded-2xl shadow-lg border-4 border-white object-contain bg-white"
      draggable={false}
    />
  );
}

function CountdownBar({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(0);
  const total = QR_VALIDITY_MINUTES * 60;

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
  const urgent = remaining < 60;

  return (
    <div className="space-y-1.5 px-2">
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${urgent ? 'bg-red-400 animate-pulse' : 'bg-emerald-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className={`text-center text-xs font-bold ${urgent ? 'text-red-500' : 'text-gray-400'}`}>
        {remaining === 0 ? 'QR Kadaluarsa' : `Berlaku ${mins}:${String(secs).padStart(2, '0')}`}
      </p>
    </div>
  );
}

export default function QrisPaymentModal({
  total,
  referenceNo,
  description,
  onPaid,
  onClose,
  autoDetect = true,
}: QrisModalProps) {
  const [state, setState] = useState<QrisState>({ phase: 'loading' });
  const [autoMode, setAutoMode] = useState(autoDetect);
  const [pollCount, setPollCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const paidRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const checkStatus = useCallback(async (briRef: string) => {
    if (paidRef.current) return;
    try {
      const res = await fetch(`/api/payments/bri/qris/status?referenceNo=${encodeURIComponent(briRef)}`);
      const data = await res.json();
      if (data.paid) {
        paidRef.current = true;
        stopPolling();
        setState({ phase: 'paid', briRef });
        toast.success('✅ Pembayaran QRIS dikonfirmasi!', { duration: 4000 });
        setTimeout(onPaid, 1500);
      }
      setPollCount((c) => c + 1);
    } catch {
      // silent – keep polling
    }
  }, [stopPolling, onPaid]);

  const generateQr = useCallback(async () => {
    setState({ phase: 'loading' });
    paidRef.current = false;
    stopPolling();
    try {
      const res = await fetch('/api/payments/bri/qris/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenceNo, amount: total, description }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setState({ phase: 'error', message: data.error || 'Gagal generate QR' });
        return;
      }
      setState({
        phase: 'ready',
        qrContent: data.qrContent,
        expiresAt: data.expiresAt,
        briRef: data.referenceNo,
      });
    } catch (e: any) {
      setState({ phase: 'error', message: e?.message || 'Network error' });
    }
  }, [referenceNo, total, description, stopPolling]);

  // Auto-generate on mount
  useEffect(() => {
    generateQr();
    return () => stopPolling();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start/stop polling when autoMode or QR state changes
  useEffect(() => {
    if (state.phase !== 'ready') { stopPolling(); return; }
    if (!autoMode) { stopPolling(); return; }
    const { briRef } = state;
    pollRef.current = setInterval(() => checkStatus(briRef), POLL_INTERVAL_MS);
    return stopPolling;
  }, [state, autoMode, checkStatus, stopPolling]);

  // Expire check
  useEffect(() => {
    if (state.phase !== 'ready') return;
    const { expiresAt } = state;
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) { setState({ phase: 'expired' }); return; }
    const t = setTimeout(() => setState({ phase: 'expired' }), ms);
    return () => clearTimeout(t);
  }, [state]);

  const copyQr = () => {
    if (state.phase !== 'ready') return;
    navigator.clipboard.writeText(state.qrContent).then(() => toast.success('QR string disalin'));
  };

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-xs rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
              <span className="text-lg">🏦</span>
            </div>
            <div>
              <p className="text-sm font-black text-gray-800 uppercase tracking-tight">QRIS Dinamis</p>
              <p className="text-[10px] text-gray-400 font-medium">BRI SNAP · MPM Dinamis</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Amount */}
        <div className="px-5 pb-3 text-center">
          <p className="text-2xl font-black text-gray-900">Rp{total.toLocaleString('id-ID')}</p>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{referenceNo}</p>
        </div>

        {/* QR Area */}
        <div className="px-5 pb-4">
          {state.phase === 'loading' && (
            <div className="w-64 h-64 mx-auto rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-xs font-bold text-gray-400">Membuat QR Code...</p>
            </div>
          )}

          {state.phase === 'ready' && (
            <div className="space-y-3">
              <div className="relative">
                <QrCodeSvg value={state.qrContent} />
                {autoMode && (
                  <div className="absolute top-2 right-2 bg-blue-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    AUTO
                  </div>
                )}
              </div>
              <CountdownBar expiresAt={state.expiresAt} />
              {autoMode && (
                <p className="text-center text-[11px] text-gray-400">
                  Mengecek status... ({pollCount}x)
                </p>
              )}
            </div>
          )}

          {state.phase === 'paid' && (
            <div className="w-64 h-64 mx-auto rounded-2xl bg-green-50 border-2 border-green-200 flex flex-col items-center justify-center gap-3">
              <CheckCircle className="text-green-500" size={52} />
              <p className="text-sm font-black text-green-700">PEMBAYARAN DITERIMA</p>
              <p className="text-xs text-green-500 text-center">Memproses transaksi...</p>
            </div>
          )}

          {state.phase === 'expired' && (
            <div className="w-64 h-64 mx-auto rounded-2xl bg-orange-50 border-2 border-dashed border-orange-200 flex flex-col items-center justify-center gap-3">
              <Clock className="text-orange-400" size={40} />
              <p className="text-sm font-black text-orange-600">QR Kadaluarsa</p>
              <button
                onClick={generateQr}
                className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white text-xs font-black rounded-xl hover:bg-orange-600 transition-colors"
              >
                <RefreshCw size={12} /> Buat Ulang
              </button>
            </div>
          )}

          {state.phase === 'error' && (
            <div className="w-64 h-64 mx-auto rounded-2xl bg-red-50 border-2 border-dashed border-red-200 flex flex-col items-center justify-center gap-3 p-4">
              <AlertCircle className="text-red-400" size={36} />
              <p className="text-xs font-bold text-red-600 text-center">{state.message}</p>
              <button
                onClick={generateQr}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-500 text-white text-xs font-black rounded-xl hover:bg-red-600 transition-colors"
              >
                <RefreshCw size={12} /> Coba Lagi
              </button>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="px-5 pb-5 space-y-2.5">
          {/* Auto/Manual Toggle */}
          {state.phase === 'ready' && (
            <div className="flex items-center justify-between bg-gray-50 rounded-2xl px-3 py-2.5">
              <div className="flex items-center gap-2">
                {autoMode ? (
                  <Wifi size={14} className="text-blue-500" />
                ) : (
                  <WifiOff size={14} className="text-gray-400" />
                )}
                <span className="text-xs font-bold text-gray-600">
                  {autoMode ? 'Deteksi Otomatis' : 'Konfirmasi Manual'}
                </span>
              </div>
              <button
                onClick={() => setAutoMode((v) => !v)}
                className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${autoMode ? 'bg-blue-500' : 'bg-gray-300'}`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${autoMode ? 'translate-x-5' : 'translate-x-0.5'}`}
                />
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            {state.phase === 'ready' && (
              <button
                onClick={copyQr}
                className="flex items-center justify-center gap-1.5 py-2.5 bg-gray-100 text-gray-600 text-xs font-black rounded-xl hover:bg-gray-200 transition-colors"
              >
                <Copy size={12} /> Salin QR
              </button>
            )}
            {state.phase === 'ready' && (
              <button
                onClick={generateQr}
                className="flex items-center justify-center gap-1.5 py-2.5 bg-gray-100 text-gray-600 text-xs font-black rounded-xl hover:bg-gray-200 transition-colors"
              >
                <RefreshCw size={12} /> Refresh
              </button>
            )}
          </div>

          {/* Manual confirm button (non-auto mode) */}
          {state.phase === 'ready' && !autoMode && (
            <button
              onClick={() => {
                paidRef.current = true;
                setState({ phase: 'paid', briRef: state.briRef });
                toast.success('✅ Pembayaran dikonfirmasi manual');
                setTimeout(onPaid, 1000);
              }}
              className="w-full py-3 bg-green-600 text-white text-sm font-black rounded-2xl hover:bg-green-700 transition-all uppercase tracking-wide shadow-lg shadow-green-200"
            >
              ✓ Konfirmasi Sudah Bayar
            </button>
          )}

          {/* Cancel */}
          {state.phase !== 'paid' && (
            <button
              onClick={onClose}
              className="w-full py-2 text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors"
            >
              Batalkan Pembayaran QRIS
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
