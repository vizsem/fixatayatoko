// src/app/profil/register/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import Link from 'next/link';
import { User, Lock, Mail, MapPin, Phone } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    address: ''
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Buat akun Firebase
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;
      
      // Simpan data pengguna ke Firestore
      await setDoc(doc(db, 'users', user.uid), {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        role: 'user', // Default role user
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString()
      });
      
      toast.success('Registrasi berhasil! Silakan login.');
      router.push('/profil/login');
    } catch (error: any) {
      console.error('Register error:', error);
      let message = 'Gagal registrasi';
      if (error.code === 'auth/email-already-in-use') {
        message = 'Email sudah terdaftar';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Email tidak valid';
      } else if (error.code === 'auth/weak-password') {
        message = 'Password minimal 6 karakter';
      }
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <img src="/logo-atayatoko.png" alt="ATAYATOKO" className="h-12 w-auto" />
          </div>
          <h1 className="text-2xl font-bold text-black">Daftar Akun Baru</h1>
          <p className="text-gray-600 mt-2">Buat akun untuk belanja lebih mudah</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Nama Lengkap
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
                placeholder="Masukkan nama lengkap"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
                placeholder="Masukkan email"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="password"
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
                placeholder="Minimal 6 karakter"
                minLength={6}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Nomor HP
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="tel"
                name="phone"
                required
                value={formData.phone}
                onChange={handleChange}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
                placeholder="081234567890"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Alamat
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <textarea
                name="address"
                required
                value={formData.address}
                onChange={handleChange}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
                placeholder="Masukkan alamat lengkap"
                rows={3}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 font-medium disabled:bg-gray-400"
          >
            {loading ? 'Sedang mendaftar...' : 'Daftar'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            Sudah punya akun?{' '}
            <Link href="/profil/login" className="text-green-600 hover:text-green-700 font-medium">
              Login di sini
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}