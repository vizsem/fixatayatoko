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
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';

import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { Store, Phone, Eye, EyeOff, Chrome, Loader2, ArrowLeft, SendHorizontal, Mail } from 'lucide-react';

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

  // 1. Menangani Hasil Redirect Google (Wajib untuk Vercel/Produksi)
  useEffect(() => {
    const checkRedirect = async () => {
      console.log("LOG: Mengecek hasil redirect Google...");
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          console.log("LOG: Berhasil login Google:", result.user.email);
          setLoading(true);
          await initializeUserProfile(result.user);
        }
      } catch (err: any) {
        console.error("LOG: Error Redirect:", err);
        setError(`Gagal login Google: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    checkRedirect();
  }, []);

  // 2. reCAPTCHA Setup
  useEffect(() => {
    if (view === 'phone' && typeof window !== 'undefined' && !window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      });
    }
  }, [view]);

  // 3. Fungsi Inisialisasi User & Role (DENGAN DEBUG LOG)
  const initializeUserProfile = async (user: any, displayName?: string) => {
    console.log("LOG 1: Memulai initializeUserProfile");
    try {
      const userRef = doc(db, 'users', user.uid);
      console.log("LOG 2: Mencoba ambil data Firestore...");
      const userSnap = await getDoc(userRef);
      console.log("LOG 3: Data diambil. Exists:", userSnap.exists());

      if (!userSnap.exists()) {
        console.log("LOG 4a: User baru, mengecek koleksi users...");
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const isFirstUser = usersSnapshot.empty;

        const userData = {
          name: displayName || user.displayName || 'Pelanggan',
          email: user.email || '',
          whatsapp: user.phoneNumber || '',
          avatar: user.photoURL || '',
          role: isFirstUser ? 'admin' : 'user',
          createdAt: new Date().toISOString(),
        };

        console.log("LOG 5a: Menyimpan user ke Firestore...");
        await setDoc(userRef, userData);
        
        if (userData.role === 'admin') {
          console.log("LOG 6a: Redirect ke Admin");
          await setAdminSession(user);
          router.push('/admin');
        } else {
          console.log("LOG 6a: Redirect ke Profil");
          router.push('/profil');
        }
      } else {
        const userData = userSnap.data();
        console.log("LOG 4b: User lama. Role:", userData?.role);
        if (userData?.role === 'admin') {
          await setAdminSession(user);
          router.push('/admin');
        } else {
          router.push('/profil');
        }
      }
    } catch (err: any) {
      console.error("LOG ERROR:", err);
      setError(`Macet di database: ${err.message}`);
    }
  };

  const setAdminSession = async (user: any) => {
    try {
      const token = await user.getIdToken();
      await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
    } catch (e) {
      console.error("Gagal set session:", e);
    }
  };

  // ----- HANDLERS -----
  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithRedirect(auth, provider);
    } catch (err) {
      setError('Gagal memulai login Google.');
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
      setError('Gagal daftar. Gunakan email lain.');
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const formattedPhone = phoneNumber.startsWith('0') ? `+62${phoneNumber.slice(1)}` : `+62${phoneNumber}`;
      const result = await signInWithPhoneNumber(auth, formattedPhone, window.recaptchaVerifier);
      setConfirmationResult(result);
      setView('otp');
    } catch {
      setError('Gagal kirim OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await confirmationResult.confirm(otp);
      await initializeUserProfile(res.user);
    } catch {
      setError('OTP salah');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100">
        
        <div className="text-center mb-8">
          <div className="bg-green-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Store className="text-green-600" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">ATAYATOKO</h1>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 mb-6 rounded text-sm">
            {error}
          </div>
        )}

        {/* --- VIEW: LOGIN --- */}
        {view === 'login' && (
          <div className="space-y-4">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 border border-gray-300 py-2.5 rounded-xl hover:bg-gray-50 transition-all font-medium text-gray-700"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Chrome size={20} className="text-blue-500" />}
              Lanjutkan dengan Google
            </button>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink mx-4 text-gray-400 text-xs uppercase">Atau Email</span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>

            <form onSubmit={handleLogin} className="space-y-3">
              <input type="email" placeholder="Email" required className="w-full border border-gray-300 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-green-500" value={email} onChange={(e) => setEmail(e.target.value)} />
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} placeholder="Password" required className="w-full border border-gray-300 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-green-500" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" className="absolute right-3 top-3 text-gray-400" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <button disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all">
                {loading && <Loader2 className="animate-spin" size={20} />} Masuk
              </button>
            </form>

            <div className="flex justify-between items-center pt-4 text-sm">
              <button onClick={() => setView('register')} className="text-green-600 font-semibold hover:underline">Daftar Akun</button>
              <button onClick={() => setView('phone')} className="flex items-center gap-1 text-gray-500 hover:text-green-600"><Phone size={14} /> WhatsApp</button>
            </div>
          </div>
        )}

        {/* --- VIEW: REGISTER --- */}
        {view === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3">
            <input placeholder="Nama Lengkap" required className="w-full border border-gray-300 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-green-500" value={name} onChange={(e) => setName(e.target.value)} />
            <input type="email" placeholder="Email" required className="w-full border border-gray-300 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-green-500" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input type="password" placeholder="Password (Min 6 Karakter)" required className="w-full border border-gray-300 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-green-500" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button disabled={loading} className="w-full bg-green-600 text-white py-2.5 rounded-xl font-bold flex items-center justify-center">
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Buat Akun Sekarang'}
            </button>
            <button type="button" onClick={() => setView('login')} className="w-full flex items-center justify-center gap-2 text-gray-500 text-sm mt-2">
              <ArrowLeft size={16} /> Kembali ke Login
            </button>
          </form>
        )}

        {/* --- VIEW: PHONE --- */}
        {view === 'phone' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden px-3 focus-within:ring-2 focus-within:ring-green-500">
              <span className="text-gray-500 font-medium">+62</span>
              <input placeholder="8xxxxxxxxxx" required className="w-full p-2.5 outline-none" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
            </div>
            <button disabled={loading} className="w-full bg-green-600 text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2">
              {loading ? <Loader2 className="animate-spin" size={20} /> : <><SendHorizontal size={18} /> Kirim OTP WhatsApp</>}
            </button>
            <button type="button" onClick={() => setView('login')} className="w-full text-gray-500 text-sm">Kembali</button>
          </form>
        )}

        {/* --- VIEW: OTP --- */}
        {view === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <p className="text-center text-sm text-gray-500 italic">Masukkan kode 6 digit dari WhatsApp Anda</p>
            <input placeholder="000000" required className="w-full border border-gray-300 p-2.5 rounded-xl text-center text-2xl tracking-widest outline-none focus:ring-2 focus:ring-green-500" value={otp} onChange={(e) => setOtp(e.target.value)} />
            <button disabled={loading} className="w-full bg-green-600 text-white py-2.5 rounded-xl font-bold">
              {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Verifikasi & Masuk'}
            </button>
            <button type="button" onClick={() => setView('phone')} className="w-full text-gray-500 text-sm">Ganti Nomor</button>
          </form>
        )}

        <div id="recaptcha-container"></div>
      </div>
    </div>
  );
}