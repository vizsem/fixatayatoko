// src/app/wishlist/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, Store, Package, ArrowLeft, Trash2 } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Tipe produk lokal
type Product = {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
  unit: string;
};

export default function WishlistPage() {
  const [wishlistProducts, setWishlistProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWishlistProducts = async () => {
      try {
        // Ambil wishlist dari localStorage
        const wishlist = localStorage.getItem('atayatoko-wishlist');
        const wishlistIds = wishlist ? JSON.parse(wishlist) : [];
        
        if (wishlistIds.length === 0) {
          setWishlistProducts([]);
          setLoading(false);
          return;
        }

        // Ambil produk dari Firestore berdasarkan ID di wishlist
        const productsSnapshot = await getDocs(collection(db, 'products'));
        const wishlistProducts = productsSnapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          .filter((product: any) => wishlistIds.includes(product.id))
          .map((product: any) => ({
            id: product.id,
            name: product.name || 'Produk Tanpa Nama',
            price: product.price || 0,
            image: product.image || '/logo-atayatoko.png',
            category: product.category || 'Lainnya',
            unit: product.unit || 'pcs'
          })) as Product[];

        setWishlistProducts(wishlistProducts);
      } catch (error) {
        console.error('Gagal memuat wishlist:', error);
        setWishlistProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchWishlistProducts();
  }, []);

  const handleRemove = (id: string) => {
    // Hapus dari localStorage
    const wishlist = localStorage.getItem('atayatoko-wishlist');
    if (wishlist) {
      const wishlistIds = JSON.parse(wishlist);
      const updatedWishlist = wishlistIds.filter((productId: string) => productId !== id);
      localStorage.setItem('atayatoko-wishlist', JSON.stringify(updatedWishlist));
    }
    
    // Hapus dari state
    setWishlistProducts(prev => prev.filter(p => p.id !== id));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-black">Memuat wishlist...</p>
        </div>
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
            {/* ✅ GUNAKAN LOGO BARU */}
            <img 
              src="/logo-atayatoko.png" 
              alt="ATAYATOKO" 
              className="h-7 w-auto"
            />
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
                    <img 
                      src={product.image} 
                      alt={product.name} 
                      className="w-full h-48 object-cover"
                    />
                  </Link>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleRemove(product.id);
                    }}
                    className="absolute top-2 right-2 bg-white p-1.5 rounded-full shadow-md hover:bg-red-50"
                    title="Hapus dari wishlist"
                  >
                    <Trash2 size={14} className="text-red-500" />
                  </button>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{product.name}</h3>
                  <p className="text-sm text-gray-600 mb-2">{product.unit} • {product.category}</p>
                  <p className="text-green-600 font-bold text-lg">
                    Rp{product.price.toLocaleString('id-ID')}
                  </p>
                  <Link
                    href={`/produk/${product.id}`}
                    className="mt-2 inline-block text-xs text-green-600 hover:text-green-800"
                  >
                    Lihat Detail →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}