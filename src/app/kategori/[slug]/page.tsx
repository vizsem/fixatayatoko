// src/app/kategori/[slug]/page.tsx
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Store, Package, Star } from 'lucide-react';
import { 
  collection, 
  getDocs, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ArrowLeft } from 'lucide-react';

// ✅ Tipe Product lokal — sesuai dengan Firestore dan cart.ts
type Product = {
  id: string;
  name: string;
  price: number;
  wholesalePrice?: number;
  category: string;
  unit: string;
  image: string;
  barcode?: string;
  rating?: number;
  originalPrice?: number;
};

type Category = {
  id: string;
  name: string;
  slug: string;
};

const StarRating = ({ rating }: { rating: number }) => {
  return (
    <div className="flex items-center">
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          size={16}
          className={i < Math.floor(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
        />
      ))}
      <span className="ml-1 text-sm text-gray-600">{rating}</span>
    </div>
  );
};

function CategoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = searchParams.get('slug');
  
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState<Category | null>(null);

  useEffect(() => {
    const fetchCategoryData = async () => {
      if (!slug) {
        router.push('/');
        return;
      }

      try {
        // Ambil kategori dari Firestore
        const categoriesSnap = await getDocs(collection(db, 'categories'));
        const catList = categoriesSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Category[];

        const foundCategory = catList.find(c => c.slug === slug);
        if (!foundCategory) {
          router.push('/404');
          return;
        }

        // Ambil produk berdasarkan kategori
        const q = query(
          collection(db, 'products'),
          where('category', '==', foundCategory.name)
        );
        const productsSnap = await getDocs(q);
        const productList = productsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Product[];

        setCategory(foundCategory);
        setProducts(productList);
      } catch (error) {
        console.error('Gagal memuat kategori:', error);
        router.push('/404');
      } finally {
        setLoading(false);
      }
    };

    fetchCategoryData();
  }, [slug, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-2">
            <Link href="/" className="text-gray-600 hover:text-green-600">
              <ArrowLeft size={20} />
            </Link>
            <Store className="text-green-600" size={28} />
            <div>
              <h1 className="text-xl font-bold text-green-600">ATAYATOKO</h1>
              <p className="text-xs text-gray-600">Ecer & Grosir</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {category ? (
          <>
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900">{category.name}</h1>
              <Link 
                href="/" 
                className="text-green-600 hover:text-green-800 text-sm"
              >
                ← Kembali ke Beranda
              </Link>
            </div>

            {products.length === 0 ? (
              <div className="text-center py-12">
                <Package className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-gray-600">Tidak ada produk di kategori ini.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {products.map((product) => (
                  <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                    <Link href={`/produk/${product.id}`} className="block">
                      <img 
                        src={product.image || '/logo-atayatoko.png'} 
                        alt={product.name} 
                        className="w-full h-48 object-cover"
                      />
                    </Link>
                    <div className="p-4">
                      <Link href={`/produk/${product.id}`}>
                        <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{product.name}</h3>
                      </Link>
                      <p className="text-sm text-gray-600 mb-2">{product.unit}</p>
                      
                      {/* ✅ Tampilkan rating jika ada */}
                      {product.rating !== undefined && product.rating > 0 && (
                        <StarRating rating={product.rating} />
                      )}
                      
                      <div className="flex items-center justify-between mt-3">
                        <div>
                          <span className="text-lg font-bold text-green-600">
                            Rp{product.price.toLocaleString('id-ID')}
                          </span>
                        </div>
                        {product.barcode && (
                          <span className="text-xs text-gray-500">#{product.barcode}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <h2 className="text-xl text-gray-900">Kategori tidak ditemukan</h2>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CategoryPage() {
  return (
    <Suspense fallback={<div className="p-6">Memuat kategori...</div>}>
      <CategoryContent />
    </Suspense>
  );
}