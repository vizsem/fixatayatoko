import ProductDetailClient, { Product, RelatedProduct, Review } from './ProductDetailClient';
import { Metadata } from 'next';
import Script from 'next/script';
import { supabase } from '@/lib/supabase';

type PageProps = {
  params: Promise<{ id: string }>;
};

const BASE_URL = 'https://atayatoko.aty0.com';

// 1. Generate Metadata for SEO & Social Media
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;

  try {
    const { data: prod } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!prod) {
      return {
        title: 'Produk Tidak Ditemukan | ATAYATOKO Kediri',
        robots: { index: false, follow: false },
      };
    }

    const raw = prod.raw_data || {};
    const productName = prod.name || raw.name || raw.Nama || 'Produk Sembako';
    const productPrice = Number(prod.price ?? raw.price ?? raw.Ecer ?? 0);
    const productDesc =
      prod.description ||
      raw.description ||
      raw.Deskripsi ||
      `Beli ${productName} murah berkualitas di ATAYATOKO Kediri. Siap kirim partai besar & eceran gratis ongkir wilayah Kediri Kota.`;
    const productImage = prod.image_url || raw.imageUrl || raw.Link_Foto || raw.image || '/logo-atayatoko.png';
    const fullImageUrl = productImage.startsWith('http') ? productImage : `${BASE_URL}${productImage}`;
    const productUrl = `${BASE_URL}/produk/${id}`;
    const categoryName = prod.category || raw.category || raw.Kategori || 'Sembako';

    return {
      title: `${productName} - Harga Grosir & Eceran | ATAYATOKO`,
      description: productDesc.substring(0, 160),
      keywords: `${productName}, beli ${productName} kediri, harga ${productName}, grosir ${categoryName} kediri, ATAYATOKO`,
      alternates: {
        canonical: productUrl,
      },
      openGraph: {
        title: `${productName} - ATAYATOKO Kediri`,
        description: productDesc.substring(0, 160),
        url: productUrl,
        siteName: 'ATAYATOKO Sembako Kediri',
        images: [
          {
            url: fullImageUrl,
            width: 800,
            height: 800,
            alt: productName,
          },
        ],
        type: 'website',
        locale: 'id_ID',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${productName} - ATAYATOKO Kediri`,
        description: productDesc.substring(0, 160),
        images: [fullImageUrl],
      },
      other: {
        'product:price:amount': String(productPrice),
        'product:price:currency': 'IDR',
        'product:availability': (Number(prod.stock ?? raw.stock ?? 0) > 0) ? 'in stock' : 'out of stock',
      },
    };
  } catch (error) {
    console.error('Error generating metadata:', error);
    return { title: 'ATAYATOKO - Belanja Sembako Hemat Kediri' };
  }
}

// 2. Server Component
export default async function ProductDetailPage({ params }: PageProps) {
  const { id } = await params;

  let product: Product | null = null;
  let relatedProducts: RelatedProduct[] = [];
  const reviews: Review[] = [];

  try {
    const { data: prod } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (prod) {
      const raw = prod.raw_data || {};
      const stock = Number(prod.stock ?? raw.stock ?? raw.Stok ?? 0);
      const price = Number(prod.price ?? raw.price ?? raw.Ecer ?? 0);
      const rawWholesale = Number(raw.wholesalePrice ?? raw.Grosir ?? raw.Harga_Grosir ?? 0);
      const wholesalePrice = rawWholesale > 0 && rawWholesale < price ? rawWholesale : 0;
      const categoryName = prod.category || raw.category || raw.Kategori || 'Umum';
      const cleanCategory = categoryName.toLowerCase() === 'semua' ? 'Umum' : categoryName;

      product = {
        id: prod.id,
        name: prod.name || raw.name || raw.Nama || 'Produk',
        price,
        wholesalePrice,
        minWholesale: Number(raw.minWholesale ?? raw.Min_Grosir ?? raw.Min_Stok_Grosir ?? 12),
        stock,
        unit: prod.unit || raw.unit || raw.Satuan || 'pcs',
        category: cleanCategory,
        image: prod.image_url || raw.imageUrl || raw.Link_Foto || raw.image || '/logo-atayatoko.png',
        description: prod.description || raw.description || raw.Deskripsi || '',
        units: raw.units || [],
      };

      // Fetch Related Products (hanya yang aktif)
      let relatedQuery = supabase
        .from('products')
        .select('*')
        .neq('id', id)
        .eq('is_active', true)
        .limit(8);

      if (cleanCategory !== 'Umum') {
        relatedQuery = relatedQuery.eq('category', cleanCategory);
      }

      const { data: relatedData } = await relatedQuery;

      if (relatedData && relatedData.length > 0) {
        relatedProducts = relatedData
          .filter((d: any) => {
            const rRaw = d.raw_data || {};
            return (
              d.is_active !== false &&
              rRaw.isActive !== false &&
              rRaw.status !== 'ARCHIVED' &&
              rRaw.Status !== 1
            );
          })
          .map((d: any) => {
            const rRaw = d.raw_data || {};
            return {
              id: d.id,
              name: d.name || rRaw.name || rRaw.Nama || 'Produk',
              price: Number(d.price ?? rRaw.price ?? rRaw.Ecer ?? 0),
              image: d.image_url || rRaw.imageUrl || rRaw.Link_Foto || rRaw.image || '/logo-atayatoko.png',
            };
          });
      }
    }
  } catch (error) {
    console.error('Error fetching product data:', error);
  }

  // Schema.org Structured Data (JSON-LD) for Google Rich Snippets
  const fullImageUrl = product?.image?.startsWith('http')
    ? product.image
    : `${BASE_URL}${product?.image || '/logo-atayatoko.png'}`;

  const productSchema = product
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        image: [fullImageUrl],
        description:
          product.description ||
          `Beli ${product.name} murah berkualitas di ATAYATOKO Kediri. Grosir & Eceran.`,
        sku: product.id,
        brand: {
          '@type': 'Brand',
          name: 'ATAYATOKO',
        },
        offers: {
          '@type': 'Offer',
          url: `${BASE_URL}/produk/${product.id}`,
          priceCurrency: 'IDR',
          price: product.price,
          priceValidUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          itemCondition: 'https://schema.org/NewCondition',
          availability:
            product.stock > 0
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
          seller: {
            '@type': 'Organization',
            name: 'ATAYATOKO Sembako Kediri',
          },
        },
      }
    : null;

  const breadcrumbSchema = product
    ? {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Beranda',
            item: BASE_URL,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Katalog',
            item: `${BASE_URL}/semua-kategori`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: product.name,
            item: `${BASE_URL}/produk/${product.id}`,
          },
        ],
      }
    : null;

  return (
    <>
      {product && productSchema && (
        <Script
          id={`product-jsonld-${product.id}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
        />
      )}
      {product && breadcrumbSchema && (
        <Script
          id={`breadcrumb-jsonld-${product.id}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        />
      )}
      <ProductDetailClient
        initialProduct={product}
        initialRelatedProducts={relatedProducts}
        initialReviews={reviews}
      />
    </>
  );
}
