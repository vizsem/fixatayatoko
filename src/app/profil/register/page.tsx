// src/app/profil/register/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Lock, Mail, MapPin, Phone, Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

import { sbUpsertDoc } from '@/lib/supabase-helpers';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ name: '', email: '', password: '', phone: '', address: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: { data: { full_name: formData.name } },
      });
      if (error) throw error;
      const uid = data.user?.id;
      if (uid) {
        await sbUpsertDoc('users', uid, {
          name: formData.name, email: formData.email, phone: formData.phone,
          address: formData.address, role: 'user', points: 0,
          createdAt: new Date().toISOString(), lastActive: new Date().toISOString()
        });
      }
      toast.success('Registrasi berhasil! Silakan masuk.');
      router.push('/profil/login');
    } catch (error: any) {
      console.error('Register error:', error);
      const msg = error?.message || '';
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        toast.error('Email sudah terdaftar. Gunakan email lain.');
      } else if (msg.includes('invalid')) {
        toast.error('Format email tidak valid.');
      } else if (msg.includes('password')) {
        toast.error('Password minimal 6 karakter.');
      } else {
        toast.error('Gagal mendaftar. Coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { name: 'name',     label: 'Nama Lengkap', type: 'text',     icon: User,    placeholder: 'Nama lengkap Anda',      autocomplete: 'name' },
    { name: 'email',    label: 'Email',         type: 'email',    icon: Mail,    placeholder: 'email@contoh.com',        autocomplete: 'email' },
    { name: 'phone',    label: 'Nomor HP',      type: 'tel',      icon: Phone,   placeholder: '08123456789',            autocomplete: 'tel' },
  ] as const;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-4 relative overflow-hidden">
      <Toaster position="top-right" />
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-emerald-200/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-24 h-80 w-80 rounded-full bg-sky-200/20 blur-3xl" />

      <div className="w-full max-w-md bg-white/85 backdrop-blur-xl rounded-3xl p-8 shadow-xl shadow-slate-200/60 border border-slate-100/80">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <img src="/logo-atayatoko.png" alt="Atayatoko" className="h-10 w-auto mx-auto mb-5 object-contain" />
          <h1 className="text-2xl font-black text-slate-900 mb-1">Buat Akun Baru</h1>
          <p className="text-sm text-slate-500 font-medium">Daftar untuk belanja lebih mudah dan cepat</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map(field => {
            const Icon = field.icon;
            return (
              <div key={field.name}>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">{field.label}</label>
                <div className="relative group">
                  <Icon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={18} />
                  <input
                    type={field.type}
                    name={field.name}
                    required
                    value={formData[field.name]}
                    onChange={handleChange}
                    autoComplete={field.autocomplete}
                    placeholder={field.placeholder}
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 rounded-2xl text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none border-2 border-transparent focus:border-emerald-500 focus:bg-white transition-all"
                  />
                </div>
              </div>
            );
          })}

          {/* Password Field */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Password</label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={18} />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                required
                minLength={6}
                value={formData.password}
                onChange={handleChange}
                autoComplete="new-password"
                placeholder="Minimal 6 karakter"
                className="w-full pl-12 pr-12 py-3.5 bg-slate-50 rounded-2xl text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none border-2 border-transparent focus:border-emerald-500 focus:bg-white transition-all"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Address Field */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Alamat</label>
            <div className="relative group">
              <MapPin className="absolute left-4 top-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={18} />
              <textarea
                name="address"
                required
                value={formData.address}
                onChange={handleChange}
                placeholder="Jl. Contoh No. 1, Kelurahan, Kota"
                rows={3}
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 rounded-2xl text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none border-2 border-transparent focus:border-emerald-500 focus:bg-white transition-all resize-none leading-relaxed"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-emerald-600 text-white rounded-2xl text-sm font-black hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <>Daftar Sekarang <ArrowRight size={16} /></>}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-slate-500 font-medium">
          Sudah punya akun?{' '}
          <Link href="/profil/login" className="text-emerald-600 font-bold hover:underline">
            Masuk di sini
          </Link>
        </p>
      </div>
    </div>
  );
}
