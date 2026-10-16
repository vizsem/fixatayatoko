import { Inter } from 'next/font/google';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import MobileNav from '@/components/MobileNav';
import { Toaster } from 'react-hot-toast';
import AuthBootstrap from '@/components/AuthBootstrap';
import BuyerHeaderActions from '@/components/BuyerHeaderActions';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CartProvider } from '@/lib/context/CartContext';
import ChatWidgets from '@/components/ChatWidgets';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

// XLSX is dynamically imported via @/lib/xlsx-utils — no global window.XLSX needed.

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://atayatoko.aty0.com'),
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

        {/* ✅ Preconnect & DNS-Prefetch for Fast LCP Image Delivery */}
        <link rel="preconnect" href="https://wsrv.nl" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://wsrv.nl" />
        <link rel="preconnect" href="https://p16-oec-sg.ibyteimg.com" />
        <link rel="dns-prefetch" href="https://p16-oec-sg.ibyteimg.com" />
        <link rel="preconnect" href="https://arti-assets.sgp1.cdn.digitaloceanspaces.com" />
        <link rel="dns-prefetch" href="https://arti-assets.sgp1.cdn.digitaloceanspaces.com" />
      </head>

      <body className={`${inter.className} antialiased overflow-x-hidden min-h-[100dvh] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]`}>
        {/* JSON-LD Structured Data — native <script> per Next.js recommendation */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": ["LocalBusiness", "Store"],
                  "@id": "https://atayatoko.aty0.com/#organization",
                  "name": "ATAYATOKO Sembako Kediri",
                  "alternateName": "Ataya Toko",
                  "image": "https://atayatoko.aty0.com/logo-atayatoko.png",
                  "logo": "https://atayatoko.aty0.com/logo-atayatoko.png",
                  "description": "Pusat belanja grosir sembako Kediri paling murah dan terlengkap. Jual beras, minyak, gula, snack partai besar dan eceran. Gratis ongkir Kediri Kota.",
                  "url": "https://atayatoko.aty0.com",
                  "telephone": "+6282234567890",
                  "priceRange": "Rp5.000 - Rp500.000",
                  "currenciesAccepted": "IDR",
                  "paymentAccepted": "Cash, Transfer Bank, QRIS",
                  "address": {
                    "@type": "PostalAddress",
                    "streetAddress": "Kediri",
                    "addressLocality": "Kediri",
                    "addressRegion": "Jawa Timur",
                    "postalCode": "64100",
                    "addressCountry": "ID"
                  },
                  "geo": {
                    "@type": "GeoCoordinates",
                    "latitude": -7.8166,
                    "longitude": 112.0108
                  },
                  "openingHoursSpecification": [
                    {
                      "@type": "OpeningHoursSpecification",
                      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
                      "opens": "07:00",
                      "closes": "21:00"
                    },
                    {
                      "@type": "OpeningHoursSpecification",
                      "dayOfWeek": "Sunday",
                      "opens": "08:00",
                      "closes": "17:00"
                    }
                  ],
                  "hasOfferCatalog": {
                    "@type": "OfferCatalog",
                    "name": "Katalog Sembako Grosir ATAYATOKO",
                    "itemListElement": [
                      { "@type": "OfferCatalog", "name": "Sembako & Kebutuhan Pokok" },
                      { "@type": "OfferCatalog", "name": "Snack & Makanan Ringan" },
                      { "@type": "OfferCatalog", "name": "Bumbu & Bahan Masakan" },
                      { "@type": "OfferCatalog", "name": "Produk Rumah Tangga" }
                    ]
                  },
                  "areaServed": {
                    "@type": "City",
                    "name": "Kediri"
                  },
                  "sameAs": [
                    "https://atayatoko.aty0.com"
                  ]
                },
                {
                  "@type": "WebSite",
                  "@id": "https://atayatoko.aty0.com/#website",
                  "url": "https://atayatoko.aty0.com",
                  "name": "ATAYATOKO Sembako Kediri",
                  "description": "Pusat grosir sembako Kediri termurah",
                  "publisher": { "@id": "https://atayatoko.aty0.com/#organization" },
                  "potentialAction": {
                    "@type": "SearchAction",
                    "target": {
                      "@type": "EntryPoint",
                      "urlTemplate": "https://atayatoko.aty0.com/search?q={search_term_string}"
                    },
                    "query-input": "required name=search_term_string"
                  }
                }
              ]
            }).replace(/</g, '\\u003c')
          }}
        />
        <ErrorBoundary>
          <CartProvider>
            <Toaster position="top-center" />
            <AuthBootstrap />
            <ChatWidgets />
            <div className="hidden md:flex fixed top-4 right-4 z-[120] bg-white/80 backdrop-blur-xl border border-gray-100 shadow-lg rounded-full px-2 py-1">
              <BuyerHeaderActions />
            </div>
            {children}
            <MobileNav />
          </CartProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
