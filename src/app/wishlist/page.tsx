// src/app/wishlist/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, Store, Package, ArrowLeft } from 'lucide-react';
import { PRODUCTS, getWishlist, removeFromWishlist, type Product } from '@/lib/products';

export default function WishlistPage() {
  const [wishlistProducts, setWishlistProducts] = useState<Product[]>([]);

  useEffect(() => {
    const wishlist = getWishlist();
    const products = PRODUCTS.filter(p => wishlist.includes(p.id));
    setWishlistProducts(products);
  }, []);

  const handleRemove = (id: number) => {
    removeFromWishlist(id);
    setWishlistProducts(prev => prev.filter(p => p.id !== id));
  };

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
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Daftar Wishlist</h1>

        {wishlistProducts.length === 0 ? (
          <div className="text-center py-12">
            <Heart size={64} className="mx-auto text-gray-400 mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Wishlist Kosong</h2>
            <p className="text-gray-600 mb-6">Belum ada produk yang Anda sukai.</p>
            <Link
              href="/"
              className="inline-block bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
            >
              Jelajahi Produk
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {wishlistProducts.map((product) => (
              <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="relative">
                  <Link href={`/produk/${product.id}`}>
                    <img src={product.image.trim()} alt={product.name} className="w-full h-48 object-cover" />
                  </Link>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleRemove(product.id);
                    }}
                    className="absolute top-2 right-2 bg-white p-1 rounded-full shadow"
                  >
                    <Heart size={16} className="text-red-500 fill-red-500" />
                  </button>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-1">{product.name}</h3>
                  <p className="text-green-600 font-bold">Rp{product.price.toLocaleString('id-ID')}</p>
                  <button
                    onClick={() => handleRemove(product.id)}
                    className="mt-2 text-xs text-red-500 hover:text-red-700"
                  >
                    Hapus dari Wishlist
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}