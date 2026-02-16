import type { NextConfig } from "next";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  disable: process.env.NODE_ENV === "development" || process.env.DISABLE_PWA === "true",
  register: true,
  skipWaiting: true,
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
        handler: "NetworkFirst",
        options: {
          cacheName: "firestore-api",
          networkTimeoutSeconds: 10,
          cacheableResponse: { statuses: [0, 200] },
          expiration: { maxEntries: 50, maxAgeSeconds: 300 }
        }
      },
      {
        urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "firebase-storage",
          cacheableResponse: { statuses: [0, 200] },
          expiration: { maxEntries: 100, maxAgeSeconds: 86400 }
        }
      },
      {
        urlPattern: ({ request }: { request: Request }) => request.destination === "image",
        handler: "CacheFirst",
        options: {
          cacheName: "images",
          expiration: { maxEntries: 200, maxAgeSeconds: 604800 }
        }
      },
      {
        urlPattern: ({ request }: { request: Request }) => request.destination === "script" || request.destination === "style",
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "assets"
        }
      }
    ]
  }
});

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'wsrv.nl',
      },
      {
        protocol: 'https',
        hostname: '**.digitaloceanspaces.com', // ✅ Tambahkan ini untuk domain Reny Swalayan
      },
      {
        protocol: 'https',
        hostname: '**.panensquare.com',
      },
      {
        protocol: 'https',
        hostname: '**.alfagift.id',
      },
      {
        protocol: 'https',
        hostname: 'images.tokopedia.net',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: '**.shopee.co.id',
      },
      {
        protocol: 'https',
        hostname: '**.susercontent.com',
      },
    ],
  },
};

export default withBundleAnalyzer(withPWA(nextConfig));