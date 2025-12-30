// 👇 1. Deklarasi global untuk XLSX (SheetJS)
declare global {
  interface Window {
    XLSX: any;
  }
}

import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// 👇 2. Metadata bisnis
export const metadata: Metadata = {
  title: 'ATAYATOKO2 - Sembako Grosir & Ecer',
  description:
    'Lengkap • Hemat • Terpercaya. Belanja sembako grosir & ecer online atau langsung di toko.',
  keywords: 'sembako, grosir, ecer, kediri, toko sembako, ATAYATOKO2',
  authors: [{ name: 'ATAYATOKO2 Team' }],
  openGraph: {
    title: 'ATAYATOKO2 - Sembako Grosir & Ecer',
    description: 'Lengkap • Hemat • Terpercaya',
    url: 'https://atayatoko2.vercel.app',
    siteName: 'ATAYATOKO2',
    locale: 'id_ID',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}

        {/* 
          ✅ XLSX hanya jalan di client
          ✅ Tidak mengganggu hydration
          File harus ada di: public/xlsx.full.min.js
        */}
        <Script
          src="/xlsx.full.min.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
