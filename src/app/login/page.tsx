'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
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

type View = 'login' | 'register' | 'phone' | 'otp';

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

  /* =======================
     reCAPTCHA (PHONE LOGIN)
  ======================== */
  useEffect(() => {
    if (view === 'phone' && typeof window !== 'undefined') {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(
          auth,
          'recaptcha-container',
          { size: 'invisible' }
        );
      }
    }
  }, [view]);

  /* =======================
     HANDLE GOOGLE REDIRECT
     (WAJIB 1X DI FRONTEND)
  ======================== */
  useEffect(() => {
    const handleRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          await initializeUserProfile(result.user);
        }
      } catch (err) {
        console.error(err);
        setError('Login Google gagal atau dibatalkan');
      } finally {
        setLoading(false);
      }
    };
    handleRedirect();
  }, []);

  /* =======================
     ADMIN SESSION COOKIE
  ======================== */
  const setAdminSession = async (user: any) => {
    try {
      const token = await user.getIdToken();
      await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
    } catch {
      console.error('Gagal sinkronisasi sesi admin');
    }
  };

  /* =======================
     INIT USER PROFILE
  ======================== */
  const initializeUserProfile = async (user: any, displayName?: string) => {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      const usersSnap = await getDocs(collection(db, 'users'));
      const isFirstUser = usersSnap.empty;

      const userData = {
        uid: user.uid,
        name: displayName || user.displayName || 'Pelanggan',
        email: user.email || '',
        whatsapp: user.phoneNumber || '',
        avatar: user.photoURL || '',
        role: isFirstUser ? 'admin' : 'customer',
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
      const data = snap.data();
      if (data?.role === 'admin') {
        await setAdminSession(user);
        router.push('/admin');
      } else {
        router.push('/profil');
      }
    }
  };

  /* =======================
     AUTH HANDLERS
  ======================== */
  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithRedirect(auth, provider);
    } catch {
      setError('Gagal memulai login Google');
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
      const phone = phoneNumber.startsWith('0')
        ? `+62${phoneNumber.slice(1)}`
        : phoneNumber;

      const result = await signInWithPhoneNumber(
        auth,
        phone,
        window.recaptchaVerifier
      );

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

  /* =======================
     UI (TIDAK DIUBAH)
  ======================== */
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans">
      <div className="bg-white p-7 rounded-2xl shadow-sm border border-gray-100 max-w-md w-full">

        <div className="text-center mb-8">
          <Store className="mx-auto text-green-600 mb-2" size={38} />
          <h1 className="text-2xl font-black text-green-600 tracking-tighter uppercase">
            ATAYAMARKET
          </h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            Portal Akun Pelanggan
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-xs font-bold p-3 mb-4 rounded-xl text-center">
            {error}
          </div>
        )}

        {view === 'login' && (
          <>
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full border py-3 mb-5 rounded-xl font-bold text-xs"
            >
              Login Google
            </button>

            <form onSubmit={handleLogin} className="space-y-3">
              <input
                type="email"
                placeholder="Email"
                className="w-full p-3 rounded-xl"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                className="w-full p-3 rounded-xl"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <button className="w-full bg-green-600 text-white py-3 rounded-xl">
                {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Masuk'}
              </button>
            </form>
          </>
        )}

        <div id="recaptcha-container" />
      </div>
    </div>
  );
}
