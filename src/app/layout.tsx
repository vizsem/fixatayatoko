import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

/* =========================
   GLOBAL TYPE (SheetJS)
========================= */
declare global {
  interface Window {
    XLSX: any;
  }
}
export {}; // ⬅️ WAJIB agar declare global valid di module

/* =========================
   FONTS
========================= */
const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

/* =========================
   METADATA BISNIS
========================= */
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

/* =========================
   ROOT LAYOUT
========================= */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <head>
        {/* ✅ FIX GOOGLE LOGIN (COOP) */}
        <meta httpEquiv="Cross-Origin-Opener-Policy" content="same-origin-allow-popups" />
        <meta httpEquiv="Cross-Origin-Embedder-Policy" content="unsafe-none" />
      </head>

      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}

        {/* 
          ✅ SheetJS XLSX
          - Client only
          - Tidak bikin hydration error
          - File di /public/xlsx.full.min.js
        */}
        <Script
          src="/xlsx.full.min.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
