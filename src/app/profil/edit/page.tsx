// src/app/profil/edit/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  updateDoc 
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { User, Mail, Phone, MapPin } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function EditProfilePage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '', // ✅ No WhatsApp
    address: ''
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push('/profil/login');
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setFormData({
            name: data.name || '',
            email: data.email || '',
            phone: data.whatsapp || data.phone || '', // ✅ Ambil dari field whatsapp/phone
            address: data.address || ''
          });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        toast.error('Gagal memuat data profil');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');
      
      await updateDoc(doc(db, 'users', user.uid), {
        name: formData.name.trim(),
        email: formData.email.trim(),
        whatsapp: formData.phone.trim(), // ✅ Simpan ke field 'whatsapp'
        address: formData.address.trim(),
        updatedAt: new Date().toISOString()
      });
      
      toast.success('Profil berhasil diperbarui!');
      router.push('/profil');
    } catch (error) {
      console.error('Update error:', error);
      toast.error('Gagal memperbarui profil');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-black">Memuat data profil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* ✅ TOMBOL KEMBALI KE BERANDA */}
        <div className="mb-6">
          <Link 
            href="/" 
            className="inline-flex items-center text-green-600 hover:text-green-700"
          >
            ← Kembali ke Beranda
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-black mb-6">Edit Profil</h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
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
                  placeholder="Contoh: Agus Santoso"
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
                  placeholder="contoh@email.com"
                />
              </div>
            </div>

            {/* ✅ TAMBAH INPUT NO WHATSAPP */}
            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Nomor WhatsApp
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
                  value={formData.address}
                  onChange={handleChange}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
                  rows={4}
                  placeholder="Jl. Merdeka No. 123, Kediri"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => router.push('/profil')}
                className="flex-1 bg-gray-200 text-black py-2 rounded-lg hover:bg-gray-300"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
              >
                {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

import Link from 'next/link';