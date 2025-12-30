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

import { Store, Phone, Eye, EyeOff } from 'lucide-react';

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

  // ===== reCAPTCHA =====
  useEffect(() => {
    let verifier: any;

    if (view === 'phone' && typeof window !== 'undefined') {
      if (!window.recaptchaVerifier) {
        verifier = new RecaptchaVerifier(
          auth,
          'recaptcha-container',
          { size: 'invisible' }
        );
        window.recaptchaVerifier = verifier;
      }
    }

    return () => {
      if (verifier) {
        verifier.clear();
        window.recaptchaVerifier = null;
      }
    };
  }, [view]);

  // 🔐 SET COOKIE ADMIN
  const setAdminSession = async (user: any) => {
    const token = await user.getIdToken();

    await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
  };

  // 🔁 INIT USER & REDIRECT
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
        orders: [],
        wishlist: []
      };

      await setDoc(userRef, userData);

      if (isFirstUser) {
        await setAdminSession(user); // ✅ ADMIN COOKIE
        router.push('/admin');
      } else {
        router.push('/profil');
      }
    } else {
      const userData = userSnap.data();

      if (userData?.role === 'admin') {
        await setAdminSession(user); // ✅ ADMIN COOKIE
        router.push('/admin');
      } else {
        router.push('/profil');
      }
    }
  };

  // ===== EMAIL LOGIN =====
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await initializeUserProfile(userCredential.user);
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
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await initializeUserProfile(userCredential.user, name);
    } catch {
      setError('Gagal membuat akun');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendPasswordResetEmail(auth, email);
    alert('Link reset dikirim ke email');
    setView('login');
  };

  // ===== WHATSAPP OTP =====
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const appVerifier = window.recaptchaVerifier;
      const formattedPhone = phoneNumber.startsWith('0')
        ? `+62${phoneNumber.slice(1)}`
        : `+62${phoneNumber}`;

      const result = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      setConfirmationResult(result);
      setView('otp');
    } catch {
      setError('Gagal mengirim OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCredential = await confirmationResult.confirm(otp);
      await initializeUserProfile(userCredential.user);
    } catch {
      setError('OTP salah');
    } finally {
      setLoading(false);
    }
  };

  // ===== GOOGLE =====
  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await initializeUserProfile(result.user);
    } catch {
      setError('Login Google gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-6 rounded-lg shadow max-w-md w-full">
        <div className="text-center mb-6">
          <Store className="mx-auto text-green-600" size={32} />
          <h1 className="text-xl font-bold text-green-600">ATAYATOKO</h1>
        </div>

        {error && (
          <div className="bg-red-100 text-red-700 p-2 mb-3 rounded">
            {error}
          </div>
        )}

        {view === 'login' && (
          <>
            <button
              onClick={handleGoogleLogin}
              className="w-full border py-2 mb-3 rounded"
            >
              Login dengan Google
            </button>

            <form onSubmit={handleLogin}>
              <input
                type="email"
                placeholder="Email"
                className="w-full mb-2 border p-2 rounded"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <div className="relative mb-2">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  className="w-full border p-2 rounded pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-2 top-2"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <button className="w-full bg-green-600 text-white py-2 rounded">
                Masuk
              </button>
            </form>

            <button onClick={() => setView('register')} className="text-sm mt-3">
              Daftar akun
            </button>
          </>
        )}

        {view === 'register' && (
          <form onSubmit={handleRegister}>
            <input
              placeholder="Nama"
              className="w-full border p-2 mb-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              placeholder="Email"
              className="w-full border p-2 mb-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password"
              className="w-full border p-2 mb-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button className="w-full bg-green-600 text-white py-2 rounded">
              Daftar
            </button>
          </form>
        )}

        {view === 'phone' && (
          <form onSubmit={handleSendOtp}>
            <input
              placeholder="08xxxxxxxx"
              className="w-full border p-2 mb-2"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
            <button className="w-full bg-green-600 text-white py-2 rounded">
              Kirim OTP
            </button>
          </form>
        )}

        {view === 'otp' && (
          <form onSubmit={handleVerifyOtp}>
            <input
              placeholder="Kode OTP"
              className="w-full border p-2 mb-2 text-center"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />
            <button className="w-full bg-green-600 text-white py-2 rounded">
              Verifikasi
            </button>
          </form>
        )}

        <div id="recaptcha-container"></div>
      </div>
    </div>
  );
}
