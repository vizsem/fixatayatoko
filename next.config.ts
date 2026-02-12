import type { NextConfig } from "next";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  disable: process.env.NODE_ENV === "development" || process.env.DISABLE_PWA === "true",
  register: true,
  skipWaiting: true,
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

export default withPWA(nextConfig);