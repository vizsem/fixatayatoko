import { adminDb } from '@/lib/firebaseAdmin';
import ProductDetailClient, { Product, RelatedProduct, Review } from './ProductDetailClient';
import { Metadata } from 'next';

type PageProps = {
  params: Promise<{ id: string }>;
};

// 1. Generate Metadata for SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  
  if (!adminDb || typeof adminDb.collection !== 'function') {
    return { title: 'Produk Tidak Ditemukan' };
  }

  try {
    const docSnap = await adminDb.collection('products').doc(id).get();
    if (!docSnap.exists) {
      return { title: 'Produk Tidak Ditemukan - ATAYATOKO' };
    }

    const data = docSnap.data();
    const productName = data?.Nama || data?.name || 'Produk';
    const productDesc = data?.Deskripsi || data?.description || 'Beli produk ini di ATAYATOKO dengan harga terbaik.';
    const productImage = data?.Link_Foto || data?.image || '/logo-atayatoko.png';

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
  
  // Default values
  let product: Product | null = null;
  let relatedProducts: RelatedProduct[] = [];
  let reviews: Review[] = [];

  if (adminDb && typeof adminDb.collection === 'function') {
    try {
      // Parallel Data Fetching
      const [productSnap, settingsSnap, reviewsSnap] = await Promise.all([
        adminDb.collection('products').doc(id).get(),
        adminDb.collection('settings').doc('system').get(),
        adminDb.collection('products').doc(id).collection('reviews').orderBy('createdAt', 'desc').get()
      ]);

      const displayWarehouseId = settingsSnap.exists ? settingsSnap.data()?.displayWarehouseId : null;

      if (productSnap.exists) {
        const data = productSnap.data()!;
        
        let stock = Number(data.Stok || data.stock) || 0;
        if (displayWarehouseId && data.stockByWarehouse) {
          stock = Number(data.stockByWarehouse[displayWarehouseId] || 0);
        } else if (displayWarehouseId && !data.stockByWarehouse) {
          stock = 0;
        }

        product = {
          id: productSnap.id,
          name: data.Nama || data.name || "Produk",
          price: Number(data.Ecer || data.price) || 0,
          wholesalePrice: Number(data.Grosir || data.wholesalePrice) || 0,
          minWholesale: Number(data.Min_Stok_Grosir || data.Min_Grosir || data.minWholesale) || 12,
          stock: stock,
          unit: data.Satuan || data.unit || 'pcs',
          category: data.Kategori || data.category || 'Umum',
          image: data.Link_Foto || data.image || '/logo-atayatoko.png',
          description: data.Deskripsi || data.description || "",
          units: data.units || [] // Add units field
        };

        // Fetch Related Products
        const relatedSnap = await adminDb.collection('products')
          .where('Kategori', '==', product.category)
          .limit(8)
          .get();

        relatedProducts = relatedSnap.docs
          .map(d => {
            const rData = d.data();
            return { 
              id: d.id,
              name: rData.Nama || rData.name || "Produk",
              price: Number(rData.Ecer || rData.price) || 0,
              image: rData.Link_Foto || rData.image || '/logo-atayatoko.png',
              isActive: typeof rData.isActive === 'boolean' ? rData.isActive : (Number(rData.Status ?? 1) !== 0)
            };
          })
          .filter(p => p.id !== id && p.isActive)
          .map(({ isActive, ...rest }) => rest);
        
        // Map Reviews
        reviews = reviewsSnap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                userId: data.userId,
                userName: data.userName,
                rating: data.rating,
                comment: data.comment,
                createdAt: data.createdAt ? { seconds: data.createdAt._seconds } : null
            } as Review;
        });
      }
    } catch (error) {
      console.error('Error fetching product data:', error);
    }
  }

  return (
    <ProductDetailClient 
      initialProduct={product}
      initialRelatedProducts={relatedProducts}
      initialReviews={reviews}
    />
  );
}
