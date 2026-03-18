import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import MobileNav from '@/components/MobileNav';
import { Toaster } from 'react-hot-toast';
import FCMManager from '@/components/FCMManager';
import CustomerChatWidget from '@/components/CustomerChatWidget';
import AuthBootstrap from '@/components/AuthBootstrap';

declare global {
  interface Window {
    XLSX: typeof import('xlsx');
  }
}
export {};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export const metadata: Metadata = {
  title: 'ATAYATOKO2 - Sembako Grosir & Ecer',
  description:
    'Lengkap • Hemat • Terpercaya. Belanja sembako grosir & ecer online atau langsung di toko.',
  keywords: 'sembako, grosir, ecer, kediri, toko sembako, ATAYATOKO2',
  authors: [{ name: 'ATAYATOKO2 Team' }],
  manifest: '/site.webmanifest',
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

      <body className="antialiased overflow-x-hidden">
        <Toaster position="top-center" />
        <AuthBootstrap />
        <FCMManager />
        <CustomerChatWidget />
        {children}
        <MobileNav />
        <Script src="/xlsx.full.min.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
