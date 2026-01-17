'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { 
  RecaptchaVerifier,
  signInWithPhoneNumber,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs
} from 'firebase/firestore';
import { Store, Phone, Eye, EyeOff, Loader2 } from 'lucide-react';

declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}

type View = 'login' | 'register' | 'forgot-password' | 'phone' | 'otp';

export default function LoginProfilePage() {
  const router = useRouter();
  const [view, setView] = useState<View>('login');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 1. reCAPTCHA Setup
  useEffect(() => {
    if (view === 'phone' && typeof window !== 'undefined') {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible'
        });
      }
    }
  }, [view]);

  // 2. Sinkronisasi Sesi Admin (Cookie)
  const setAdminSession = async (user: any) => {
    try {
      const token = await user.getIdToken();
      await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
    } catch (err) {
      console.error("Gagal sinkronisasi sesi admin");
    }
  };

  // 3. Inisialisasi Profil User & Redirect
  const initializeUserProfile = async (user: any, displayName?: string) => {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const isFirstUser = usersSnapshot.empty;

      const userData = {
        uid: user.uid,
        name: displayName || user.displayName || 'Pelanggan',
        email: user.email || '',
        whatsapp: user.phoneNumber || '',
        avatar: user.photoURL || '',
        role: isFirstUser ? 'admin' : 'user',
        points: 0, 
        createdAt: new Date().toISOString(),
        addresses: [],
        orders: [],
        wishlist: []
      };

      await setDoc(userRef, userData);

      if (userData.role === 'admin') {
        await setAdminSession(user);
        router.push('/admin');
      } else {
        router.push('/profil');
      }
    } else {
      const userData = userSnap.data();
      if (userData?.role === 'admin') {
        await setAdminSession(user);
        router.push('/admin');
      } else {
        router.push('/profil');
      }
    }
  };

  // --- Handlers ---
  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      await initializeUserProfile(result.user);
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError('Gagal login Google. Periksa koneksi atau pengaturan Firebase.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await signInWithEmailAndPassword(auth, email, password);
      await initializeUserProfile(res.user);
    } catch {
      setError('Email atau password salah');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await createUserWithEmailAndPassword(auth, email, password);
      await initializeUserProfile(res.user, name);
    } catch {
      setError('Pendaftaran gagal. Gunakan email lain.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const formattedPhone = phoneNumber.startsWith('0') ? `+62${phoneNumber.slice(1)}` : phoneNumber;
      const result = await signInWithPhoneNumber(auth, formattedPhone, window.recaptchaVerifier);
      setConfirmationResult(result);
      setView('otp');
    } catch {
      setError('Gagal kirim OTP. Nomor tidak valid.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await confirmationResult.confirm(otp);
      await initializeUserProfile(result.user);
    } catch {
      setError('Kode OTP salah');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans text-normal">
      <div className="bg-white p-7 rounded-2xl shadow-sm border border-gray-100 max-w-md w-full">
        
        {/* Header */}
        <div className="text-center mb-8">
          <Store className="mx-auto text-green-600 mb-2" size={38} />
          <h1 className="text-2xl font-black text-green-600 tracking-tighter uppercase">ATAYAMARKET</h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Portal Akun Pelanggan</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-xs font-bold p-3 mb-4 rounded-xl text-center border border-red-100 uppercase">
            {error}
          </div>
        )}

        {view === 'login' && (
          <>
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full border border-gray-200 py-3 mb-5 rounded-xl flex items-center justify-center gap-3 hover:bg-gray-50 transition-all font-bold text-gray-700 text-xs uppercase tracking-widest"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Login Google
            </button>

            <form onSubmit={handleLogin} className="space-y-3">
              <input
                type="email"
                placeholder="Email"
                className="w-full bg-gray-50 border-none p-3.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-600/20"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  className="w-full bg-gray-50 border-none p-3.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-600/20"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-4 top-3.5 text-gray-400"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <button disabled={loading} className="w-full bg-green-600 text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-green-100 transition-transform active:scale-95">
                {loading ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Masuk Ke Akun'}
              </button>
            </form>

            <div className="flex justify-between mt-6">
              <button onClick={() => setView('register')} className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-green-600">Daftar Akun</button>
              <button onClick={() => setView('phone')} className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-green-600 flex items-center gap-1">
                <Phone size={12} /> Login WhatsApp
              </button>
            </div>
          </>
        )}

        {view === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3">
            <input placeholder="Nama Lengkap" className="w-full bg-gray-50 border-none p-3.5 rounded-xl text-sm outline-none" value={name} onChange={(e) => setName(e.target.value)} required />
            <input type="email" placeholder="Email" className="w-full bg-gray-50 border-none p-3.5 rounded-xl text-sm outline-none" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input type="password" placeholder="Password" className="w-full bg-gray-50 border-none p-3.5 rounded-xl text-sm outline-none" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button disabled={loading} className="w-full bg-green-600 text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-widest">
              {loading ? 'Proses...' : 'Daftar Sekarang'}
            </button>
            <button type="button" onClick={() => setView('login')} className="w-full text-[10px] font-black mt-4 text-gray-400 uppercase tracking-widest text-center">Batal & Kembali</button>
          </form>
        )}

        {view === 'phone' && (
          <form onSubmit={handleSendOtp} className="space-y-4 text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Masukkan Nomor WhatsApp</p>
            <input placeholder="08xxxxxxxx" className="w-full bg-gray-50 border-none p-4 rounded-xl text-center text-lg font-bold tracking-widest outline-none" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} required />
            <button disabled={loading} className="w-full bg-green-600 text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-widest">
              {loading ? 'Mengirim...' : 'Kirim Kode OTP'}
            </button>
            <button type="button" onClick={() => setView('login')} className="w-full text-[10px] font-black text-gray-400 uppercase tracking-widest">Kembali</button>
          </form>
        )}

        {view === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4 text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Verifikasi Kode</p>
            <input placeholder="000000" className="w-full bg-gray-50 border-none p-4 rounded-xl text-center text-2xl font-black tracking-[0.5em] outline-none" value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} required />
            <button disabled={loading} className="w-full bg-green-600 text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-widest">
              {loading ? 'Verifikasi...' : 'Verifikasi'}
            </button>
          </form>
        )}

        <div id="recaptcha-container"></div>
      </div>
    </div>
  );
}