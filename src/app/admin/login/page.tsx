'use client';

import { useState, FormEvent, Suspense } from 'react';
import { signIn } from '@/lib/supabaseAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import notify from '@/lib/notify';
import { Lock, Mail, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';
import { Toaster } from 'react-hot-toast';

function AdminLoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/admin';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      notify.error('Email dan kata sandi wajib diisi');
      return;
    }

    setLoading(true);
    const toastId = notify.loading('Sedang masuk ke sistem...');

    try {
      const { data, error } = await signIn(email, password);

      if (error) {
        notify.error(error.message || 'Gagal masuk. Periksa email dan password Anda.', { id: toastId });
        setLoading(false);
        return;
      }

      // Check role from app_metadata
      const role = data?.user?.app_metadata?.role;
      if (!role || !['admin', 'cashier', 'employee'].includes(role)) {
        notify.error('Akses ditolak. Anda tidak memiliki izin admin.', { id: toastId });
        setLoading(false);
        return;
      }

      notify.success('Berhasil masuk!', { id: toastId });
      router.push(callbackUrl);
      router.refresh();
    } catch (err: any) {
      console.error(err);
      notify.error(err.message || 'Terjadi kesalahan sistem', { id: toastId });
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-8 backdrop-blur-xl">
      <div className="text-center mb-8">
        <div className="inline-flex p-3 bg-emerald-500/10 text-emerald-400 rounded-xl mb-3 border border-emerald-500/20">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">GUDANG ATAYA ERP</h1>
        <p className="text-sm text-slate-400 mt-1">Masuk ke Portal Manajemen & Gudang</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Email Pengguna
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@gudangataya.com"
              required
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Kata Sandi
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-6 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Memproses...</span>
            </>
          ) : (
            <>
              <span>Masuk Sistem</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-slate-800/80 text-center">
        <p className="text-xs text-slate-500">
          Arsitektur Database Supabase PostgreSQL
        </p>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 text-slate-100">
      <Toaster position="top-right" />
      <Suspense fallback={<div className="text-slate-400 text-sm">Memuat...</div>}>
        <AdminLoginForm />
      </Suspense>
    </div>
  );
}

