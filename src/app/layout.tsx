import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import MobileNav from '@/components/MobileNav';
import { Toaster } from 'react-hot-toast';
import FCMManager from '@/components/FCMManager';
import CustomerChatWidget from '@/components/CustomerChatWidget';
import AuthBootstrap from '@/components/AuthBootstrap';
import BuyerHeaderActions from '@/components/BuyerHeaderActions';

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
  title: 'Grosir Sembako Kediri Termurah & Terlengkap | ATAYATOKO',
  description: 'Pusat belanja grosir sembako Kediri paling murah. Jual beras, minyak goreng, gula, snack partai besar & eceran. Gratis ongkir Kediri Kota.',
  keywords: 'grosir sembako kediri, sembako murah kediri, distributor sembako kediri, agen sembako kediri, toko sembako kediri, grosir minyak goreng kediri, grosir beras kediri, grosir snack kediri, grosir rokok kediri, agen snack kediri, grosir gula kediri, grosir minuman kediri, ATAYATOKO, atayamarket',
  authors: [{ name: 'ATAYATOKO Team' }],
  manifest: '/site.webmanifest',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: 'Grosir Sembako Kediri Termurah | ATAYATOKO',
    description: 'Pusat belanja grosir sembako Kediri paling murah. Jual partai besar & eceran. Gratis ongkir Kediri Kota.',
    url: 'https://atayatoko.aty0.com',
    siteName: 'ATAYATOKO Sembako Kediri',
    locale: 'id_ID',
    type: 'website',
    images: [
      {
        url: '/logo-atayatoko.png',
        width: 800,
        height: 600,
        alt: 'Grosir Sembako Kediri - ATAYATOKO',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Grosir Sembako Kediri Termurah | ATAYATOKO',
    description: 'Pusat belanja grosir sembako Kediri paling murah. Gratis ongkir Kediri Kota.',
    images: ['/logo-atayatoko.png'],
  },
  alternates: {
    canonical: 'https://atayatoko.aty0.com',
  }
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
        <div className="hidden md:flex fixed top-4 right-4 z-[120] bg-white/80 backdrop-blur-xl border border-gray-100 shadow-lg rounded-full px-2 py-1">
          <BuyerHeaderActions />
        </div>
        {children}
        <MobileNav />
        <Script src="/xlsx.full.min.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
