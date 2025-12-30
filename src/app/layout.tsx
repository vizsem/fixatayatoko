// src/app/layout.tsx

// 👇 1. Deklarasi global untuk XLSX (SheetJS) — hanya di sisi client
declare global {
  interface Window {
    XLSX: any;
  }
}

import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// 👇 2. Sesuaikan metadata dengan bisnis Anda
export const metadata: Metadata = {
  title: 'ATAYATOKO2 - Sembako Grosir & Ecer',
  description: 'Lengkap • Hemat • Terpercaya. Belanja sembako grosir & ecer online atau langsung di toko.',
  keywords: 'sembako, grosir, ecer, kediri, toko sembako, ATAYATOKO2',
  authors: [{ name: 'ATAYATOKO2 Team' }],
  openGraph: {
    title: 'ATAYATOKO2 - Sembako Grosir & Ecer',
    description: 'Lengkap • Hemat • Terpercaya',
    url: 'https://atayatoko2.vercel.app', // ganti dengan domain Anda nanti
    siteName: 'ATAYATOKO2',
    locale: 'id_ID',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id"> {/* 👈 ganti ke "id" untuk Indonesia */}
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        {/* 
          ✅ Script XLSX hanya jalan di browser.
          File `xlsx.full.min.js` harus ada di `public/xlsx.full.min.js`
        */}
        <script src="/xlsx.full.min.js" />
      </body>
    </html>
  );
}