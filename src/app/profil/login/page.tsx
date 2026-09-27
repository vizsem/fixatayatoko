'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Chrome, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { requestForToken } from '@/lib/fcm';
import { Toaster } from 'react-hot-toast';
import notify from '@/lib/notify';
import { supabase } from '@/lib/supabase';

import { sbGetDoc, sbUpsertDoc } from '@/lib/supabase-helpers';
import { GoogleAuthProvider, auth, db, doc, getDoc, onAuthStateChanged, setDoc, signInWithEmailAndPassword, signInWithPopup } from '@/lib/firebase';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && !user.isAnonymous) router.push('/profil');
    });
    return () => unsubscribe();
  }, [router]);

  const handleGoogleLogin = async () => {
    if (loading) return;
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result?.user;
      if (!user) return;
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await sbGetDoc('users', result.user.uid);
      if (!userSnap.exists()) {
        await sbUpsertDoc('users', result.user.uid, { uid: user.uid, name: user.displayName, email: user.email, role: 'customer', points: 0, createdAt: new Date().toISOString() });
      } else {
        const userData = userSnap.data();
        if (userData.role === 'admin' || userData.role === 'cashier') {
          document.cookie = `admin-token=true; path=/; max-age=${60 * 60 * 24 * 7}`;
        }
      }
      await requestForToken();
      router.push('/profil');
    } catch (error: unknown) {
      console.error('Google Login Error:', error);
      notify.user.error('Gagal login dengan Google. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || loading) return;
    setLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const userRef = doc(db, 'users', result.user.uid);
      const userSnap = await sbGetDoc('users', result.user.uid);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.role === 'admin' || userData.role === 'cashier') {
          document.cookie = `admin-token=true; path=/; max-age=${60 * 60 * 24 * 7}`;
        }
      }
      await requestForToken();
      router.push('/profil');
    } catch (error: unknown) {
      console.error(error);
      notify.user.error('Email atau password salah. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-4 relative overflow-hidden">
      <Toaster position="top-right" />
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-emerald-200/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-24 h-80 w-80 rounded-full bg-sky-200/20 blur-3xl" />

      <div className="w-full max-w-md bg-white/85 backdrop-blur-xl rounded-3xl p-8 shadow-xl shadow-slate-200/60 border border-slate-100/80">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <img src="/logo-atayatoko.png" alt="Atayatoko" className="h-10 w-auto mx-auto mb-5 object-contain" />
          <h1 className="text-2xl font-black text-slate-900 mb-1">Masuk ke Akun</h1>
          <p className="text-sm text-slate-500 font-medium">Akses akun Ataya Toko Anda</p>
        </div>

        {/* Google Button */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-3.5 bg-white border-2 border-slate-200 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50/50 transition-all active:scale-95 group mb-6 shadow-sm"
        >
          {loading ? (
            <Loader2 className="animate-spin text-emerald-600" size={20} />
          ) : (
            <>
              <Chrome size={20} className="text-slate-400 group-hover:text-emerald-600 transition-colors" />
              <span className="text-sm font-bold text-slate-700 group-hover:text-emerald-700">Lanjut dengan Google</span>
            </>
          )}
        </button>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-100" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-4 text-xs font-medium text-slate-400">atau dengan email</span>
          </div>
        </div>

        {/* Email Form */}
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div className="relative group">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={18} />
            <input
              type="email"
              placeholder="Alamat email"
              required
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              className="w-full pl-12 pr-4 py-3.5 bg-slate-50 rounded-2xl text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none border-2 border-transparent focus:border-emerald-500 focus:bg-white transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={18} />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Kata sandi"
              required
              autoComplete="current-password"
              className="w-full pl-12 pr-12 py-3.5 bg-slate-50 rounded-2xl text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none border-2 border-transparent focus:border-emerald-500 focus:bg-white transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl text-sm font-black hover:bg-black active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <>Masuk <ArrowRight size={16} /></>}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-slate-500 font-medium">
          Belum punya akun?{' '}
          <Link href="/profil/register" className="text-emerald-600 font-bold hover:underline">
            Daftar sekarang
          </Link>
        </p>
      </div>
    </div>
  );
}
