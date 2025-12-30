// src/app/produk/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Package, Truck, RotateCcw, Store, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getProductById } from '@/lib/products';

interface Product {
  id?: string;
  name: string;
  price: number;
  wholesalePrice: number;
  minWholesaleQty?: number;
  category: string;
  unit: string;
  image?: string;
  description?: string;
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string; // ✅ JADI STRING
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!id) {
      router.push('/');
      return;
    }

    const found = getProductById(id);
    if (!found) {
      router.push('/');
      return;
    }
    setProduct(found);
  }, [id, router]);

  const addToCart = () => {
    if (!product) return;

    const newProduct = { ...product, quantity };

    const savedCart = localStorage.getItem('atayatoko-cart');
    let cart: any[] = [];
    
    if (savedCart) {
      try {
        cart = JSON.parse(savedCart);
      } catch (e) {
        cart = [];
      }
    }

    const existingIndex = cart.findIndex((item: any) => item.id === product.id);
    if (existingIndex >= 0) {
      cart[existingIndex].quantity += quantity;
    } else {
      cart.push(newProduct);
    }

    localStorage.setItem('atayatoko-cart', JSON.stringify(cart));
    alert(`${quantity} ${product.name} ditambahkan ke keranjang!`);
  };

  // Tentukan harga yang ditampilkan
  const displayPrice = product?.minWholesaleQty && quantity >= product.minWholesaleQty 
    ? product.wholesalePrice 
    : product?.price;

  const isWholesale = product?.minWholesaleQty && quantity >= product.minWholesaleQty;

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Produk tidak ditemukan.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Mini */}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Gambar Produk */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <img
              src={product.image?.trim() || '/placeholder.png'}
              alt={product.name}
              className="w-full h-auto object-cover"
            />
          </div>

          {/* Detail Produk */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded mb-3 inline-block">
              {product.category}
            </span>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h1>
            <p className="text-gray-600 mb-4">{product.unit}</p>

            {/* Harga */}
            <div className="mb-6">
              <div className="flex items-center">
                <span className="text-2xl font-bold text-gray-900">
                  Rp{displayPrice?.toLocaleString('id-ID')}
                </span>
                {isWholesale && (
                  <span className="text-gray-500 line-through ml-3">
                    Rp{product.price.toLocaleString('id-ID')}
                  </span>
                )}
              </div>
              
              {product.minWholesaleQty && (
                <p className="text-sm text-gray-600 mt-2">
                  {isWholesale 
                    ? `✅ Harga grosir (min. ${product.minWholesaleQty} ${product.unit})` 
                    : `ℹ️ Beli ${product.minWholesaleQty} ${product.unit} atau lebih untuk harga grosir: Rp${product.wholesalePrice.toLocaleString('id-ID')}`}
                </p>
              )}
            </div>

            {/* Deskripsi */}
            {product.description && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-2">Deskripsi</h3>
                <p className="text-gray-600">{product.description}</p>
              </div>
            )}

            {/* Jumlah & Tombol */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Jumlah
              </label>
              <div className="flex items-center border border-gray-300 rounded w-32 text-black">
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="px-3 py-1 text-lg"
                >
                  −
                </button>
                <span className="flex-1 text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity(q => q + 1)}
                  className="px-3 py-1 text-lg"
                >
                  +
                </button>
              </div>
            </div>

            <button
              onClick={addToCart}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors"
            >
              <Package size={20} />
              <span>Tambah ke Keranjang</span>
            </button>

            {/* Fitur */}
            <div className="mt-6 space-y-3 text-sm text-gray-600">
              <div className="flex items-start">
                <Truck className="text-green-600 mt-0.5 mr-2" size={16} />
                <span>Gratis ongkir untuk belanja minim Rp100.000</span>
              </div>
              <div className="flex items-start">
                <RotateCcw className="text-green-600 mt-0.5 mr-2" size={16} />
                <span>Garansi stok lengkap setiap hari</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}