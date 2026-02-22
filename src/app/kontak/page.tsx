// src/app/kontak/page.tsx
'use client';

import { useState } from 'react';
import { Store, Phone, Mail, MapPin, MessageCircle, Send } from 'lucide-react';
import Link from 'next/link';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    whatsapp: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulasi pengiriman (Anda bisa ganti dengan API nanti)
    setTimeout(() => {
      console.log('Form dikirim:', formData);
      setSubmitSuccess(true);
      setFormData({ name: '', email: '', whatsapp: '', message: '' });
      setIsSubmitting(false);
      
      // Reset pesan sukses setelah 5 detik
      setTimeout(() => setSubmitSuccess(false), 5000);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Mini */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-2">
            <Store className="text-green-600" size={28} />
            <div>
              <h1 className="text-xl font-bold text-green-600">ATAYATOKO</h1>
              <p className="text-xs text-gray-600">Ecer & Grosir</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <Link href="/" className="text-green-600 hover:text-green-700">&larr; Kembali ke Beranda</Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">Hubungi Kami</h1>
          <p className="text-gray-600">
            Punya pertanyaan? Kirim pesan, atau hubungi kami langsung via WhatsApp!
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Form Kontak */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Kirim Pesan</h2>
            
            {submitSuccess && (
              <div className="mb-6 p-3 bg-green-50 text-green-700 rounded-lg">
                ✅ Pesan Anda berhasil terkirim! Tim ATAYATOKO akan segera menghubungi Anda.
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Lengkap *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Masukkan nama Anda"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="email@contoh.com"
                  />
                </div>
                <div>
                  <label htmlFor="whatsapp" className="block text-sm font-medium text-gray-700 mb-1">
                    WhatsApp *
                  </label>
                  <input
                    type="tel"
                    id="whatsapp"
                    name="whatsapp"
                    value={formData.whatsapp}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="081234567890"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                  Pesan *
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Tulis pesan Anda di sini..."
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Send size={20} className="animate-pulse" />
                    <span>Mengirim...</span>
                  </>
                ) : (
                  <>
                    <MessageCircle size={20} />
                    <span>Kirim Pesan</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Info Kontak */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Informasi Kontak</h2>
            
            <div className="space-y-5">
              <div className="flex items-start">
                <MapPin className="text-green-600 mt-1 mr-3" size={20} />
                <div>
                  <h3 className="font-semibold text-gray-900">Alamat</h3>
                  <p className="text-gray-600">Jl. Pandan 98, Semen, Kediri</p>
                </div>
              </div>

              <div className="flex items-start">
                <Phone className="text-green-600 mt-1 mr-3" size={20} />
                <div>
                  <h3 className="font-semibold text-gray-900">Telepon</h3>
                  <p className="text-gray-600">0858-5316-1174</p>
                </div>
              </div>

              <div className="flex items-start">
                <Mail className="text-green-600 mt-1 mr-3" size={20} />
                <div>
                  <h3 className="font-semibold text-gray-900">Email</h3>
                  <p className="text-gray-600">info@atayatoko.com</p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h3 className="font-semibold text-gray-900 mb-3">Jam Operasional</h3>
                <p className="text-gray-600">Senin - Minggu: 08.00 - 20.00 WIB</p>
              </div>

              <div className="pt-4">
                <a
                  href="https://wa.me/6285853161174"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                  <MessageCircle size={20} className="mr-2" />
                  Chat via WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}