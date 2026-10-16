import { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase';

const BASE_URL = 'https://atayatoko.aty0.com';

export const revalidate = 3600; // Cache sitemap selama 1 jam di server/CDN

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // 1. Halaman Statis Utama
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/semua-kategori`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/semua-produk`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/promo`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/tentang`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/kontak`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/kebijakan-privasi`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/syarat-ketentuan`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  // 2. Halaman Kategori Dinamis dari Supabase
  let categoryRoutes: MetadataRoute.Sitemap = [];
  try {
    const { data: categories, error } = await supabase
      .from('categories')
      .select('id, name, slug, updated_at')
      .limit(100);

    if (categories && !error && categories.length > 0) {
      categoryRoutes = categories.map((cat: any) => {
        const slug = cat.slug || cat.id || cat.name?.toLowerCase().replace(/\s+/g, '-');
        return {
          url: `${BASE_URL}/kategori/${slug}`,
          lastModified: cat.updated_at ? new Date(cat.updated_at) : now,
          changeFrequency: 'weekly',
          priority: 0.7,
        };
      });
    }
  } catch (err) {
    console.error('[Sitemap] Gagal mengambil data kategori:', err);
  }

  // 3. Halaman Produk Dinamis dari Supabase (Hanya yang is_active = true)
  let productRoutes: MetadataRoute.Sitemap = [];
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('id, updated_at, created_at, raw_data')
      .eq('is_active', true)
      .limit(5000);

    if (products && !error && products.length > 0) {
      productRoutes = products
        .filter((prod: any) => {
          const raw = prod.raw_data || {};
          return raw.isActive !== false && raw.status !== 'ARCHIVED' && raw.Status !== 1;
        })
        .map((prod: any) => {
          const raw = prod.raw_data || {};
          const lastMod = prod.updated_at
            ? new Date(prod.updated_at)
            : prod.created_at
              ? new Date(prod.created_at)
              : now;
          const imageUrl = prod.image_url || raw.imageUrl || raw.Link_Foto || raw.image || null;
          const fullImageUrl = imageUrl
            ? imageUrl.startsWith('http')
              ? imageUrl
              : `${BASE_URL}${imageUrl}`
            : null;
          const productName = prod.name || raw.name || raw.Nama || 'Produk';
          return {
            url: `${BASE_URL}/produk/${prod.id}`,
            lastModified: lastMod,
            changeFrequency: 'daily' as const,
            priority: 0.8,
            ...(fullImageUrl ? {
              images: [fullImageUrl],
            } : {}),
          };
        });
    }
  } catch (err) {
    console.error('[Sitemap] Gagal mengambil data produk:', err);
  }

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
