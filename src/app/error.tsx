'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import notify from '@/lib/notify';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    notify.user.error('Terjadi kesalahan');
  }, [error]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <Toaster position="top-right" />
      <div className="bg-white p-8 rounded-2xl shadow border border-gray-200 max-w-md text-center">
        <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
          <AlertTriangle className="text-orange-600" size={24} />
        </div>
        <h1 className="text-xl font-bold text-black">Terjadi kesalahan</h1>
        <p className="text-sm text-gray-500 mt-2">Silakan coba lagi atau kembali ke beranda</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-xl bg-black text-white text-xs font-black tracking-widest"
          >
            Coba Lagi
          </button>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 rounded-xl bg-gray-100 text-black text-xs font-black tracking-widest"
          >
            Ke Beranda
          </button>
        </div>
      </div>
    </div>
  );
}
