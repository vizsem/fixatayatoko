import { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import CategoryContent from './CategoryContent';

const BASE_URL = 'https://atayatoko.aty0.com';

type PageProps = {
  params: Promise<{ slug: string }>;
};

// ─── Helper: ambil nama kategori dari Supabase ───────────────────────────────
async function fetchCategoryName(slug: string): Promise<string> {
  try {
    const { data } = await supabase
      .from('products')
      .select('category')
      .eq('is_active', true)
      .limit(20);

    if (data && data.length > 0) {
      // Cari produk yang kategorinya cocok dengan slug
      const match = data.find((d: any) => {
        const cat = String(d.category || '');
        const generatedSlug = cat
          .toLowerCase()
          .replace(/&/g, 'dan')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        return generatedSlug === slug || cat.toLowerCase() === slug;
      });
      if (match) return match.category;
    }
  } catch {
    // fallback
  }
  return slug.replace(/-/g, ' ');
}

// ─── 1. SEO Metadata per-kategori ───────────────────────────────────────────
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const categoryName = await fetchCategoryName(slug);

  const title = `${categoryName} Grosir Murah Kediri | ATAYATOKO`;
  const description = `Beli ${categoryName} grosir murah di ATAYATOKO Kediri. Tersedia partai besar & eceran, gratis ongkir Kediri Kota. Stok lengkap & harga terbaik.`;
  const canonicalUrl = `${BASE_URL}/kategori/${slug}`;

  return {
    title,
    description,
    keywords: `${categoryName} kediri, grosir ${categoryName} kediri, beli ${categoryName} murah, distributor ${categoryName} kediri, ATAYATOKO`,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'ATAYATOKO Sembako Kediri',
      locale: 'id_ID',
      type: 'website',
      images: [
        {
          url: `${BASE_URL}/logo-atayatoko.png`,
          width: 800,
          height: 600,
          alt: `${categoryName} - ATAYATOKO Kediri`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${BASE_URL}/logo-atayatoko.png`],
    },
  };
}

// ─── 2. Server Component ─────────────────────────────────────────────────────
export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const categoryName = await fetchCategoryName(slug);
  const canonicalUrl = `${BASE_URL}/kategori/${slug}`;

  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': canonicalUrl,
    name: `${categoryName} Grosir Murah - ATAYATOKO Kediri`,
    description: `Daftar produk ${categoryName} grosir murah di ATAYATOKO Kediri`,
    url: canonicalUrl,
    publisher: {
      '@type': 'Organization',
      '@id': `${BASE_URL}/#organization`,
      name: 'ATAYATOKO Sembako Kediri',
    },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Beranda', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Semua Kategori', item: `${BASE_URL}/semua-kategori` },
      { '@type': 'ListItem', position: 3, name: categoryName, item: canonicalUrl },
    ],
  };

  return (
    <>
      {/* JSON-LD — native <script> per Next.js recommendation */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(collectionSchema).replace(/</g, '\\u003c'),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema).replace(/</g, '\\u003c'),
        }}
      />
      <CategoryContent slug={slug} />
    </>
  );
}
