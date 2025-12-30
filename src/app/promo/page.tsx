// src/app/promo/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function PromoPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Promo Spesial Minggu Ini</h1>
          <p className="text-xl text-gray-600">Nikmati diskon besar untuk produk pilihan!</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-600 text-2xl">🔥</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Diskon 50% Beras Premium</h3>
            <p className="text-gray-600 mb-4">Beli 5kg, dapat 10kg! Hanya minggu ini.</p>
            <Link href="/semua-kategori" className="inline-block bg-red-600 text-white px-4 py-2 rounded">
              Beli Sekarang
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-green-600 text-2xl">🎁</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Kupon Gratis Ongkir</h3>
            <p className="text-gray-600 mb-4">Untuk pembelian minimal Rp100.000.</p>
            <Link href="/cart" className="inline-block bg-green-600 text-white px-4 py-2 rounded">
              Klaim Kupon
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-blue-600 text-2xl">🎉</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Buy 2 Get 1 Free</h3>
            <p className="text-gray-600 mb-4">Untuk semua produk snack & kue.</p>
            <Link href="/semua-kategori" className="inline-block bg-blue-600 text-white px-4 py-2 rounded">
              Lihat Produk
            </Link>
          </div>
        </div>

        <div className="mt-12 p-6 bg-yellow-50 rounded-lg">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Syarat & Ketentuan</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-700">
            <li>Promo berlaku selama stok masih tersedia</li>
            <li>Tidak bisa digabungkan dengan promo lain</li>
            <li>Gratis ongkir hanya berlaku di wilayah Kediri</li>
            <li>Kupon tidak bisa ditukarkan dengan uang tunai</li>
          </ul>
        </div>
      </div>
    </div>
  );
}