import type { NextConfig } from "next";

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

export default nextConfig;