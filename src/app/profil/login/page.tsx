'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';

import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Loader2, Chrome, Mail, Lock, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { requestForToken } from '@/lib/fcm';
import { Toaster } from 'react-hot-toast';
import notify from '@/lib/notify';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  // Proteksi: Jika sudah login, jangan boleh ke halaman ini, lempar ke profil
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push('/profil');
      }
    });
    return () => unsubscribe();
  }, [router]);

  // --- LOGIN GOOGLE (Paling Stabil) ---
  const handleGoogleLogin = async () => {
    if (loading) return;
    setLoading(true);
    const provider = new GoogleAuthProvider();
    
    try {
      // Menggunakan Popup agar tidak terputus oleh sistem redirect Vercel/Browser
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Sinkronisasi ke Firestore
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          name: user.displayName,
          email: user.email,
          role: 'customer', // Default role
          points: 0,
          createdAt: serverTimestamp(),
        });
      } else {
        // Jika admin, set cookie untuk middleware
        const userData = userSnap.data();
        if (userData.role === 'admin' || userData.role === 'cashier') {
          document.cookie = `admin-token=true; path=/; max-age=${60 * 60 * 24 * 7}`;
        }
      }

      await requestForToken();
      // Berhasil, pindah ke profil
      router.push('/profil');
      
    } catch (error: unknown) {
      console.error("Google Login Error:", error);
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan';
      notify.user.error("Gagal Login Google: " + message);
    } finally {
      setLoading(false);
    }
  };

  // --- LOGIN EMAIL & PASSWORD ---
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || loading) return;
    
    setLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const user = result.user;

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

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
      notify.user.error("Email/Password salah!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 font-sans">
      <Toaster position="top-right" />
      <div className="w-full max-w-md bg-white rounded-[2.5rem] p-8 md:p-12 shadow-2xl shadow-slate-200 border border-slate-100 transition-all">
        
        <div className="text-center mb-10">
          <div className="inline-flex p-4 bg-green-50 rounded-3xl text-green-600 mb-4">
            <Lock size={32} />
          </div>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900">
            Masuk <span className="text-green-600 text-4xl">.</span>
          </h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">
            Akses Akun Ataya Toko
          </p>
        </div>

        {/* TOMBOL GOOGLE */}
        <button 
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-4 py-4 bg-white border-2 border-slate-100 rounded-2xl hover:border-green-500 hover:bg-green-50/50 transition-all active:scale-95 group mb-8"
        >
          {loading ? (
            <Loader2 className="animate-spin text-green-600" size={20} />
          ) : (
            <>
              <Chrome size={20} className="text-slate-400 group-hover:text-green-600 transition-colors" />
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-700">Lanjut dengan Google</span>
            </>
          )}
        </button>

        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
          <div className="relative flex justify-center text-[9px] font-black uppercase">
            <span className="bg-white px-4 text-slate-300 italic">Atau gunakan email</span>
          </div>
        </div>

        {/* FORM LOGIN EMAIL */}
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div className="relative group">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-green-500 transition-colors" size={18} />
            <input 
              type="email" 
              placeholder="ALAMAT EMAIL..." 
              required
              autoComplete="email"
              className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl text-[11px] font-bold uppercase outline-none border-2 border-transparent focus:border-green-500 focus:bg-white transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-green-500 transition-colors" size={18} />
            <input 
              type="password" 
              placeholder="KATA SANDI..." 
              required
              autoComplete="current-password"
              className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl text-[11px] font-bold uppercase outline-none border-2 border-transparent focus:border-green-500 focus:bg-white transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-black active:scale-95 transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-200"
          >
            Masuk Ke Profil <ArrowRight size={16} />
          </button>
        </form>

        <p className="text-center mt-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Belum punya akun? <Link href="/profil/register" className="text-green-600 hover:underline">Daftar Disini</Link>
        </p>
      </div>
    </div>
  );
}
