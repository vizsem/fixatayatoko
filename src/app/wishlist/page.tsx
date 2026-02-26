'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, ArrowLeft, Trash2, ShoppingCart, Loader2 } from 'lucide-react';
import { collection, getDocs, query, where, documentId, limit, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Product } from '@/lib/types';
import notify from '@/lib/notify';


export default function WishlistPage() {
  const [wishlistProducts, setWishlistProducts] = useState<Product[]>([]);
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const localWishlist = localStorage.getItem('atayatoko-wishlist');
        const wishlistIds = localWishlist ? JSON.parse(localWishlist) : [];

        // 1. Ambil Produk Wishlist
        if (wishlistIds.length > 0) {
          const qWishlist = query(
            collection(db, 'products'),
            where(documentId(), 'in', wishlistIds.slice(0, 30))
          );
          const wishlistSnap = await getDocs(qWishlist);
          const products = wishlistSnap.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data.name || 'Produk Tanpa Nama',
              price: Number(data.price) || 0,
              image: data.image && data.image !== "" ? data.image : "/logo-atayatoko.png",
              category: data.category || 'Ecer/Grosir',
              unit: data.unit || 'pcs'
            } as Product;
          });
          setWishlistProducts(products);
        }

        // 2. Ambil Rekomendasi Produk
        const qRec = query(
          collection(db, 'products'),
          where('isActive', '==', true),
          orderBy('name', 'asc'),
          limit(20)
        );
        const recSnap = await getDocs(qRec);
        const allRecs = recSnap.docs
          .map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data.name || 'Produk Tanpa Nama',
              price: Number(data.price) || 0,
              image: data.image && data.image !== "" ? data.image : "/logo-atayatoko.png",
              category: data.category || 'Ecer/Grosir',
              unit: data.unit || 'pcs'
            } as Product;
          })
          .filter(p => !wishlistIds.includes(p.id))
          .slice(0, 10);

        setRecommendedProducts(allRecs);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleAddToCart = (product: Product) => {
    const cart = localStorage.getItem('atayatoko-cart');
    const cartItems = cart ? JSON.parse(cart) : [];
    const existingItem = cartItems.find((item: Product & { quantity: number }) => item.id === product.id);

    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      cartItems.push({ ...product, quantity: 1 });
    }

    localStorage.setItem('atayatoko-cart', JSON.stringify(cartItems));
    window.dispatchEvent(new Event('cart-updated'));
    notify.user.success(`Berhasil ditambah ke keranjang!`);
  };

  const handleRemove = (id: string) => {
    const wishlist = JSON.parse(localStorage.getItem('atayatoko-wishlist') || '[]');
    const updated = wishlist.filter((pid: string) => pid !== id);
    localStorage.setItem('atayatoko-wishlist', JSON.stringify(updated));
    setWishlistProducts(prev => prev.filter(p => p.id !== id));
    window.dispatchEvent(new Event('wishlist-updated'));
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <Loader2 className="animate-spin text-green-600 mb-2" size={32} />
      <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Menyiapkan Favorit Anda...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="bg-gray-100 p-2 rounded-full hover:bg-green-100 text-gray-600 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-sm font-black text-gray-800 uppercase tracking-tighter">Wishlist Saya</h1>
          </div>
          <Image src="/logo-atayatoko.png" alt="Logo" width={100} height={24} className="h-6 w-auto" />
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <section className="mb-12">
          {wishlistProducts.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border-2 border-dashed border-gray-200">
              <Heart size={40} className="mx-auto text-gray-200 mb-3" />
              <p className="text-xs font-black text-gray-400 uppercase">Belum Ada Favorit</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {wishlistProducts.map(product => (
                <ProductCard key={product.id} product={product} onRemove={() => handleRemove(product.id)} onAdd={() => handleAddToCart(product)} isWishlist />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center gap-2 mb-6">
            <div className="bg-yellow-100 p-2 rounded-xl text-yellow-600">
              <Heart size={18} fill="currentColor" />
            </div>
            <div>
              <h2 className="text-sm font-black text-gray-800 uppercase tracking-tight">Rekomendasi Untukmu</h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase">Mungkin Anda juga butuh ini</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {recommendedProducts.map(product => (
              <ProductCard key={product.id} product={product} onAdd={() => handleAddToCart(product)} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function ProductCard({
  product,
  onRemove,
  onAdd,
  isWishlist
}: {
  product: Product;
  onRemove?: () => void;
  onAdd: (p: Product) => void;
  isWishlist?: boolean;
}) {
  // Validasi Gambar: Jika kosong atau null, gunakan logo default
  const imgFallback = product.image && product.image !== "" ? product.image : "/logo-atayatoko.png";

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
      <div className="relative">
        <Link href={`/produk/${product.id}`} className="block relative aspect-square">
          <Image
            src={imgFallback}
            alt={product.name || 'Produk'}
            fill
            className="object-cover"
          />
        </Link>
        {isWishlist && (
          <button onClick={onRemove} className="absolute top-2 right-2 bg-white/90 p-2 rounded-xl text-red-500 shadow-sm transition-colors hover:bg-red-500 hover:text-white">
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <h3 className="text-[11px] font-black text-gray-800 uppercase leading-tight line-clamp-2 mb-1">
          {product.name || 'Produk Tanpa Nama'}
        </h3>
        <p className="text-green-600 font-black text-sm mb-3">
          Rp{(Number(product.price) || 0).toLocaleString('id-ID')}
        </p>
        <button
          onClick={() => onAdd(product)}
          className="mt-auto w-full bg-gray-50 hover:bg-green-600 hover:text-white text-green-600 py-2 rounded-xl text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1 border border-transparent hover:border-green-600"
        >
          <ShoppingCart size={12} /> + Keranjang
        </button>
      </div>
    </div>
  );
}
