'use client';
import Link from 'next/link';
import { Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white p-8 rounded-2xl shadow border border-gray-200 max-w-md text-center">
        <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
          <Search className="text-gray-600" size={24} />
        </div>
        <h1 className="text-xl font-bold text-black">Halaman tidak ditemukan</h1>
        <p className="text-sm text-gray-500 mt-2">Periksa kembali URL atau kembali ke beranda</p>
        <Link
          href="/"
          className="inline-block mt-6 px-4 py-2 rounded-xl bg-black text-white text-xs font-black tracking-widest"
        >
          Ke Beranda
        </Link>
      </div>
    </div>
  );
}
