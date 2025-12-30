// src/app/kategori/[slug]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Store, Package, Star } from 'lucide-react';
import { getProductsByCategory, getCategoryBySlug, type PRODUCTS } from '@/lib/products';
import { Product } from '@/lib/types';

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
    </div>
  );
};

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  
  const [category, setCategory] = useState<{ name: string; slug: string } | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const cat = getCategoryBySlug(slug);
    if (!cat) {
      router.push('/');
      return;
    }
    setCategory(cat);
    setProducts(getProductsByCategory(cat.name));
  }, [slug, router]);

  if (!category) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Memuat...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Mini */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-2">
            <Store className="text-green-600" size={28} />
            <div>
              <h1 className="text-xl font-bold text-green-600">ATAYATOKO</h1>
              <p className="text-xs text-gray-600">Ecer & Grosir</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <Link href="/" className="text-green-600 hover:text-green-700">&larr; Kembali ke Beranda</Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">Kategori: {category.name}</h1>
          <p className="text-gray-600">
            Temukan semua produk {category.name.toLowerCase()} dengan harga ecer & grosir.
          </p>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-12">
            <Package size={64} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">Tidak ada produk dalam kategori ini saat ini.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {products.map((product) => (
              <div key={product.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden">
                <Link href={`/produk/${product.id}`}>
                  <img 
                    src={product.image?.trim() || '/placeholder.png'} 
                    alt={product.name} 
                    className="w-full h-64 object-cover" 
                  />
                </Link>
                <div className="p-6">
                  <div className="flex items-center mb-2">
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                      {product.category}
                    </span>
                  </div>
                  <Link href={`/produk/${product.id}`}>
                    <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{product.name}</h3>
                  </Link>
                  <p className="text-sm text-gray-600 mb-2">{product.unit}</p>
                  <div className="flex items-center justify-between mt-4">
                    <div>
                      <span className="text-xl font-bold text-gray-900">
                        Rp{product.price.toLocaleString('id-ID')}
                      </span>
                      {(product as any).originalPrice > product.price && (
  <span className="text-gray-500 line-through ml-2 text-sm">
    Rp{(product as any).originalPrice.toLocaleString('id-ID')}
  </span>
)}
                    </div>
                    <Link
                      href={`/produk/${product.id}`}
                      className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700"
                    >
                      Lihat
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}