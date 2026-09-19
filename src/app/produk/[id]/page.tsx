import ProductDetailClient, { Product, RelatedProduct, Review } from './ProductDetailClient';
import { Metadata } from 'next';
import { supabase } from '@/lib/supabase';

type PageProps = {
  params: Promise<{ id: string }>;
};

// 1. Generate Metadata for SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;

  try {
    const { data: prod } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!prod) {
      return { title: 'Produk Tidak Ditemukan - ATAYATOKO' };
    }

    const raw = prod.raw_data || {};
    const productName = prod.name || raw.name || raw.Nama || 'Produk';
    const productDesc = prod.description || raw.description || raw.Deskripsi || 'Beli produk ini di ATAYATOKO dengan harga terbaik.';
    const productImage = prod.image_url || raw.imageUrl || raw.Link_Foto || raw.image || '/logo-atayatoko.png';

    return {
      title: `${productName} - Jual Murah ATAYATOKO`,
      description: productDesc.substring(0, 160),
      openGraph: {
        title: productName,
        description: productDesc.substring(0, 160),
        images: [productImage],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: productName,
        description: productDesc.substring(0, 160),
        images: [productImage],
      },
    };
  } catch (error) {
    console.error('Error generating metadata:', error);
    return { title: 'ATAYATOKO - Belanja Hemat' };
  }
}

// 2. Server Component
export default async function ProductDetailPage({ params }: PageProps) {
  const { id } = await params;

  let product: Product | null = null;
  let relatedProducts: RelatedProduct[] = [];
  let reviews: Review[] = [];

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

  return (
    <ProductDetailClient
      initialProduct={product}
      initialRelatedProducts={relatedProducts}
      initialReviews={reviews}
    />
  );
}

