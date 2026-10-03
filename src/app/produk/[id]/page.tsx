import ProductDetailClient, { Product, RelatedProduct, PromoProduct, Review } from './ProductDetailClient';
import { Metadata } from 'next';
import Script from 'next/script';
import { supabase } from '@/lib/supabase';

type PageProps = {
  params: Promise<{ id: string }>;
};

const BASE_URL = 'https://atayatoko.aty0.com';

/**
 * Tanggal dalam format YYYY-MM-DD, N hari dari sekarang.
 * Diletakkan di module scope agar `Date.now()` tidak dipanggil saat render.
 */
function isoDateInDays(daysAhead: number): string {
  return new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
}

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
  let promoProducts: PromoProduct[] = [];
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

      // Fetch active products for recommendations and promo items
      const { data: allActiveData } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .limit(60);

      const isValidActive = (p: any) => {
        if (!p || p.id === id) return false;
        const r = p.raw_data || {};
        if (p.is_active === false || r.isActive === false) return false;
        if (r.status === 'ARCHIVED' || r.Status === 'ARCHIVED') return false;
        return true;
      };

      const validList = (allActiveData || []).filter(isValidActive);

      // A. Related Products (Prioritize same category, fallback to other active products)
      const targetCategoryLower = cleanCategory.toLowerCase();
      const sameCategory = validList.filter(
        (p: any) =>
          cleanCategory !== 'Umum' &&
          (p.category || p.raw_data?.category || '').toLowerCase() === targetCategoryLower
      );
      const sameCategoryIds = new Set(sameCategory.map((p: any) => p.id));
      const otherCategory = validList.filter((p: any) => !sameCategoryIds.has(p.id));

      const combinedRelated = [...sameCategory, ...otherCategory].slice(0, 10);
      relatedProducts = combinedRelated.map((d: any) => {
        const rRaw = d.raw_data || {};
        return {
          id: d.id,
          name: d.name || rRaw.name || rRaw.Nama || 'Produk',
          price: Number(d.price ?? rRaw.price ?? rRaw.Ecer ?? 0),
          wholesalePrice: Number(rRaw.wholesalePrice ?? rRaw.Grosir ?? rRaw.Harga_Grosir ?? 0),
          minWholesale: Number(rRaw.minWholesale ?? rRaw.Min_Grosir ?? 1),
          unit: d.unit || rRaw.unit || rRaw.Satuan || 'PCS',
          category: d.category || rRaw.category || rRaw.Kategori || 'Umum',
          image: d.image_url || rRaw.imageUrl || rRaw.Link_Foto || rRaw.image || '/logo-atayatoko.png',
          stock: Number(d.stock ?? rRaw.stock ?? rRaw.Stok ?? 0),
        };
      });

      // B. Promo Products (Products with wholesale discount or promo deals)
      const promoCandidates = validList
        .filter((p: any) => {
          const r = p.raw_data || {};
          const normalPrice = Number(p.price ?? r.price ?? r.Ecer ?? 0);
          const grosir = Number(r.wholesalePrice ?? r.Grosir ?? r.Harga_Grosir ?? 0);
          return grosir > 0 && grosir < normalPrice;
        })
        .slice(0, 8);

      promoProducts = promoCandidates.map((d: any) => {
        const r = d.raw_data || {};
        const normalPrice = Number(d.price ?? r.price ?? r.Ecer ?? 0);
        const grosir = Number(r.wholesalePrice ?? r.Grosir ?? r.Harga_Grosir ?? 0);
        const discountVal = normalPrice - grosir;
        const discountPercent = normalPrice > 0 ? Math.round((discountVal / normalPrice) * 100) : 0;
        return {
          id: d.id,
          name: d.name || r.name || r.Nama || 'Produk Promo',
          price: grosir,
          originalPrice: normalPrice,
          wholesalePrice: grosir,
          minWholesale: Number(r.minWholesale ?? r.Min_Grosir ?? 1),
          unit: d.unit || r.unit || r.Satuan || 'PCS',
          category: d.category || r.category || r.Kategori || 'Umum',
          image: d.image_url || r.imageUrl || r.Link_Foto || r.image || '/logo-atayatoko.png',
          stock: Number(d.stock ?? r.stock ?? r.Stok ?? 0),
          promoBadge: discountPercent > 0 ? `Hemat ${discountPercent}%` : 'Grosir Spesial',
          discountPercent,
        };
      });
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
          priceValidUntil: isoDateInDays(60),
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
        initialProduct={product ? JSON.parse(JSON.stringify(product)) : null}
        initialRelatedProducts={JSON.parse(JSON.stringify(relatedProducts))}
        initialPromoProducts={JSON.parse(JSON.stringify(promoProducts))}
        initialReviews={JSON.parse(JSON.stringify(reviews))}
      />
    </>
  );
}
