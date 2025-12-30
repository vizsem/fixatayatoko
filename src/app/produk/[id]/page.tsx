// src/app/produk/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Package, Truck, RotateCcw, Store, ArrowLeft, Heart, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { addToWishlist, getWishlist } from '@/lib/wishlist';
import { addToCart } from '@/lib/cart';

// ✅ Tipe produk lokal
type Product = {
  id: string;
  name: string;
  price: number;
  wholesalePrice?: number;
  purchasePrice?: number;
  stock: number;
  category: string;
  unit: string;
  barcode?: string;
  image: string;
  description?: string;
  rating?: number;
  originalPrice?: number;
};

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params?.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [inWishlist, setInWishlist] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!productId) {
        router.push('/404');
        return;
      }

      try {
        const docRef = doc(db, 'products', productId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProduct({
            id: docSnap.id,
            name: data.name || 'Produk Tanpa Nama',
            price: data.price || 0,
            wholesalePrice: data.wholesalePrice,
            purchasePrice: data.purchasePrice,
            stock: data.stock || 0,
            category: data.category || 'Lainnya',
            unit: data.unit || 'pcs',
            barcode: data.barcode,
            image: data.image || '/logo-atayatoko.png',
            description: data.description,
            rating: data.rating,
            originalPrice: data.originalPrice
          });

          // Cek apakah di wishlist
          const wishlist = getWishlist();
          setInWishlist(wishlist.includes(productId));
        } else {
          router.push('/404');
        }
      } catch (error) {
        console.error('Gagal memuat produk:', error);
        router.push('/404');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId, router]);

  const handleAddToCart = () => {
    if (product) {
      addToCart(product);
      alert('Produk ditambahkan ke keranjang!');
    }
  };

  const handleToggleWishlist = () => {
    if (!product) return;
    
    if (inWishlist) {
      // ❌ Hapus dari wishlist (opsional, jika Anda punya fungsi)
      const wishlist = getWishlist().filter(id => id !== product.id);
      localStorage.setItem('atayatoko-wishlist', JSON.stringify(wishlist));
    } else {
      addToWishlist(product.id);
    }
    
    setInWishlist(!inWishlist);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!product) {
    return null;
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
        <Link href="/" className="text-green-600 hover:text-green-800 mb-6 inline-block">
          ← Kembali ke Beranda
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Gambar Produk */}
          <div className="bg-white p-6 rounded-lg shadow">
            <img 
              src={product.image} 
              alt={product.name} 
              className="w-full h-96 object-cover rounded"
            />
          </div>

          {/* Detail Produk */}
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-start mb-4">
              <h1 className="text-3xl font-bold text-black">{product.name}</h1>
              <button
                onClick={handleToggleWishlist}
                className="p-2 text-gray-500 hover:text-red-500"
              >
                <Heart 
                  size={24} 
                  className={inWishlist ? 'fill-red-500 text-red-500' : ''}
                />
              </button>
            </div>

            <p className="text-gray-600 mb-4">{product.category} • {product.unit}</p>

            {product.description && (
              <p className="text-gray-700 mb-6">{product.description}</p>
            )}

            {/* Harga */}
            <div className="mb-6">
              {product.originalPrice && product.originalPrice > product.price && (
                <p className="text-gray-500 line-through">
                  Rp{product.originalPrice.toLocaleString('id-ID')}
                </p>
              )}
              <p className="text-2xl font-bold text-green-600">
                Rp{product.price.toLocaleString('id-ID')} <span className="text-base font-normal">/ ecer</span>
              </p>
              {product.wholesalePrice && (
                <p className="text-gray-700">
                  Grosir: Rp{product.wholesalePrice.toLocaleString('id-ID')}
                </p>
              )}
            </div>

            {/* Stok & Barcode */}
            <div className="mb-6">
              <div className="flex items-center gap-4">
                <span className={`px-2 py-1 rounded ${
                  product.stock > 10 ? 'bg-green-100 text-green-800' : 
                  product.stock > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                }`}>
                  {product.stock > 0 ? `${product.stock} tersedia` : 'Habis'}
                </span>
                {product.barcode && (
                  <span className="text-sm text-gray-500">#{product.barcode}</span>
                )}
              </div>
            </div>

            {/* Aksi */}
            <div className="flex gap-4">
              <button
                onClick={handleAddToCart}
                disabled={product.stock <= 0}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-green-700 disabled:bg-gray-400"
              >
                <ShoppingCart size={20} />
                {product.stock > 0 ? 'Tambah ke Keranjang' : 'Stok Habis'}
              </button>
            </div>

            {/* Fitur */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <Truck className="text-green-600" size={24} />
                  <div>
                    <h3 className="font-medium">Antar ke Rumah</h3>
                    <p className="text-sm text-gray-600">Minimal belanja Rp100.000</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Package className="text-green-600" size={24} />
                  <div>
                    <h3 className="font-medium">Ecer & Grosir</h3>
                    <p className="text-sm text-gray-600">Beli satuan pun hemat!</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <RotateCcw className="text-green-600" size={24} />
                  <div>
                    <h3 className="font-medium">Garansi Stok</h3>
                    <p className="text-sm text-gray-600">Stok selalu tersedia</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}