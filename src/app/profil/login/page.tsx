'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { 
  RecaptchaVerifier,
  signInWithPhoneNumber,
  GoogleAuthProvider,
  signInWithRedirect, // Diganti dari Popup untuk stabilitas COOP
  getRedirectResult,  // Untuk menangkap hasil login setelah redirect
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';

import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { Store, Phone, Eye, EyeOff, Mail, Chrome, Loader2 } from 'lucide-react';

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

  // 1. Menangani Hasil Redirect Google (PENTING untuk Vercel)
  useEffect(() => {
    const checkRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          setLoading(true);
          await initializeUserProfile(result.user);
        }
      } catch (err: any) {
        console.error("Error Redirect:", err);
        if (err.code === 'auth/account-exists-with-different-credential') {
          setError('Email sudah terdaftar dengan metode login lain.');
        } else {
          setError('Gagal login dengan Google. Pastikan domain sudah diizinkan.');
        }
      } finally {
        setLoading(false);
      }
    };
    checkRedirect();
  }, []);

  // 2. reCAPTCHA Setup
  useEffect(() => {
    let verifier: any;
    if (view === 'phone' && typeof window !== 'undefined') {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
        });
      }
    }
    return () => {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    };
  }, [view]);

  const setAdminSession = async (user: any) => {
    const token = await user.getIdToken();
    await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
  };

  const initializeUserProfile = async (user: any, displayName?: string) => {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const isFirstUser = usersSnapshot.empty;

      const userData = {
        name: displayName || user.displayName || 'Pelanggan',
        email: user.email || '',
        whatsapp: user.phoneNumber || '',
        avatar: user.photoURL || '',
        role: isFirstUser ? 'admin' : 'user',
        createdAt: new Date().toISOString(),
        addresses: [],
      };

      await setDoc(userRef, userData);
      if (isFirstUser || userData.role === 'admin') {
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

  // Login Google dengan Redirect (Solusi COOP)
  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithRedirect(auth, provider);
    } catch (err) {
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
    } catch (err: any) {
      setError('Email atau password salah');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100">
        <div className="text-center mb-8">
          <div className="bg-green-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Store className="text-green-600" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">ATAYATOKO</h1>
          <p className="text-gray-500 text-sm mt-1">Masuk untuk mulai belanja</p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 mb-6 rounded text-sm flex items-center gap-2">
            <span>{error}</span>
          </div>
        )}

        {view === 'login' && (
          <div className="space-y-4">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 border border-gray-300 py-2.5 rounded-xl hover:bg-gray-50 transition-all font-medium text-gray-700"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Chrome size={20} className="text-blue-500" />}
              Google
            </button>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink mx-4 text-gray-400 text-xs uppercase">Atau Email</span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>

            <form onSubmit={handleLogin} className="space-y-3">
              <input
                type="email"
                placeholder="Email"
                required
                className="w-full border border-gray-300 p-2.5 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  required
                  className="w-full border border-gray-300 p-2.5 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-3 top-3 text-gray-400"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <button 
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-bold shadow-lg shadow-green-100 transition-all flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="animate-spin" size={20} />}
                Masuk ke Akun
              </button>
            </form>

            <div className="flex justify-between items-center pt-4 text-sm">
              <button onClick={() => setView('register')} className="text-green-600 font-semibold hover:underline">Daftar Akun Baru</button>
              <button onClick={() => setView('phone')} className="flex items-center gap-1 text-gray-500 hover:text-green-600 transition-colors">
                <Phone size={14} /> WhatsApp OTP
              </button>
            </div>
          </div>
        )}

        {/* View Register & Phone disingkat, tambahkan styling serupa di atas */}
        
        <div id="recaptcha-container"></div>
      </div>
    </div>
  );
}