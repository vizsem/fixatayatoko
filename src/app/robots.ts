import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://atayatoko.aty0.com';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/admin/*',
          '/cashier',
          '/cashier/*',
          '/api/',
          '/api/*',
          '/chat',
          '/chat/*',
          '/cart',
          '/transaksi',
          '/wishlist',
          '/profil/login',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
