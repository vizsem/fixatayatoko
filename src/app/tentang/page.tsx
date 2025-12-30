// src/app/tentang/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function TentangPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Tentang ATAYATOKO</h1>
          <p className="text-xl text-gray-600">Satu toko untuk semua kebutuhan sembako Anda</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Sejarah Kami</h2>
            <p className="text-gray-600 mb-4">
              ATAYATOKO didirikan pada tahun 2023 oleh Ibu Siti, seorang ibu rumah tangga yang ingin membantu keluarga lain mendapatkan sembako berkualitas dengan harga terjangkau.
            </p>
            <p className="text-gray-600 mb-4">
              Dengan pengalaman bertahun-tahun di dunia perdagangan sembako, kami memahami kebutuhan konsumen dan berkomitmen untuk menyediakan:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 mb-6">
              <li>Harga ecer terjangkau</li>
              <li>Harga grosir super hemat</li>
              <li>Stok lengkap & selalu update</li>
              <li>Pelayanan ramah & cepat</li>
            </ul>
            <p className="text-gray-600">
              Kami percaya bahwa belanja sembako seharusnya mudah, hemat, dan menyenangkan.
            </p>
          </div>

          <div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <img src="/logo-atayatoko.png" alt="ATAYATOKO" className="h-20 w-auto mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Visi</h3>
              <p className="text-gray-600 mb-4">
                Menjadi toko sembako terpercaya di Indonesia dengan layanan terbaik dan harga paling kompetitif.
              </p>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Misi</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li>Menyediakan produk berkualitas dengan harga terjangkau</li>
                <li>Meningkatkan kenyamanan belanja konsumen</li>
                <li>Mendukung UMKM lokal dengan kerjasama pasokan</li>
                <li>Memberikan pelayanan prima kepada pelanggan</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Tim Kami</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-20 h-20 bg-gray-200 rounded-full mx-auto mb-3"></div>
                <h3 className="font-bold text-gray-900">Ibu Siti</h3>
                <p className="text-gray-600">Founder & CEO</p>
              </div>
              <div className="text-center">
                <div className="w-20 h-20 bg-gray-200 rounded-full mx-auto mb-3"></div>
                <h3 className="font-bold text-gray-900">Pak Budi</h3>
                <p className="text-gray-600">Manager Operasional</p>
              </div>
              <div className="text-center">
                <div className="w-20 h-20 bg-gray-200 rounded-full mx-auto mb-3"></div>
                <h3 className="font-bold text-gray-900">Bu Rina</h3>
                <p className="text-gray-600">Customer Service</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 p-6 bg-green-50 rounded-lg">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Hubungi Kami</h2>
          <p className="text-gray-600 mb-4">
            Punya pertanyaan atau ingin bekerja sama? Silakan hubungi kami!
          </p>
          <div className="space-y-2 text-gray-700">
            <p>📍 Jl. Pandan 98, Semen, Kediri</p>
            <p>📱 WhatsApp: 0858-5316-1174</p>
            <p>✉️ info@atayatoko.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}