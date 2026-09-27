'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, ArrowLeft, Trash2, ShoppingCart, Loader2, Sparkles } from 'lucide-react';
import { Product } from '@/lib/types';
import notify from '@/lib/notify';
import { supabase } from '@/lib/supabase';

import { collection, db, documentId, getDocs, limit, orderBy, query, where } from '@/lib/firebase';

export default function WishlistPage() {
  const [wishlistProducts, setWishlistProducts] = useState<Product[]>([]);
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const localWishlist = localStorage.getItem('atayatoko-wishlist');
        const wishlistIds = localWishlist ? JSON.parse(localWishlist) : [];

        if (wishlistIds.length > 0) {
          const qWishlist = query(collection(db, 'products'), where(documentId(), 'in', wishlistIds.slice(0, 30)));
          const wishlistSnap = await getDocs(qWishlist);
          setWishlistProducts(wishlistSnap.docs.map(d => {
            const data = d.data();
            return { id: d.id, name: data.name || 'Produk', price: Number(data.price) || 0, image: data.image || '/logo-atayatoko.png', category: data.category || 'Umum', unit: data.unit || 'pcs' } as Product;
          }));
        }

        const qRec = query(collection(db, 'products'), where('isActive', '==', true), orderBy('name', 'asc'), limit(20));
        const recSnap = await getDocs(qRec);
        const wishlistIdsSet = new Set(JSON.parse(localStorage.getItem('atayatoko-wishlist') || '[]'));
        setRecommendedProducts(
          recSnap.docs
            .map(d => { const data = d.data(); return { id: d.id, name: data.name || 'Produk', price: Number(data.price) || 0, image: data.image || '/logo-atayatoko.png', category: data.category || 'Umum', unit: data.unit || 'pcs' } as Product; })
            .filter(p => !wishlistIdsSet.has(p.id))
            .slice(0, 10)
        );
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
    const existing = cartItems.find((i: Product & { quantity: number }) => i.id === product.id);
    if (existing) existing.quantity += 1;
    else cartItems.push({ ...product, quantity: 1 });
    localStorage.setItem('atayatoko-cart', JSON.stringify(cartItems));
    window.dispatchEvent(new Event('cart-updated'));
    notify.user.success('Berhasil ditambah ke keranjang!');
  };

  const handleRemove = (id: string) => {
    const wishlist = JSON.parse(localStorage.getItem('atayatoko-wishlist') || '[]');
    localStorage.setItem('atayatoko-wishlist', JSON.stringify(wishlist.filter((pid: string) => pid !== id)));
    setWishlistProducts(prev => prev.filter(p => p.id !== id));
    window.dispatchEvent(new Event('wishlist-updated'));
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC]">
      <Loader2 className="animate-spin text-emerald-600 mb-3" size={32} />
      <p className="text-sm font-medium text-slate-500">Menyiapkan favorit Anda...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md sticky top-0 z-50 border-b border-slate-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all text-slate-700">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-base font-black text-slate-900">Wishlist Saya</h1>
              <p className="text-xs text-slate-500 font-medium">{wishlistProducts.length} produk favorit</p>
            </div>
          </div>
          <img src="/logo-atayatoko.png" alt="Logo Atayatoko" className="h-7 w-auto" />
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Wishlist Section */}
        <section className="mb-10">
          {wishlistProducts.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200">
              <Heart size={48} className="mx-auto text-slate-200 mb-3" />
              <p className="text-base font-bold text-slate-500 mb-1">Belum Ada Favorit</p>
              <p className="text-sm text-slate-400 mb-5">Tambahkan produk ke wishlist dari halaman produk</p>
              <Link href="/" className="inline-flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-2xl text-sm font-bold hover:bg-emerald-700 transition-colors">
                Jelajahi Produk
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {wishlistProducts.map(product => (
                <WishlistCard key={product.id} product={product} onRemove={() => handleRemove(product.id)} onAdd={() => handleAddToCart(product)} />
              ))}
            </div>
          )}
        </section>

        {/* Recommendations Section */}
        {recommendedProducts.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 bg-amber-50 rounded-xl text-amber-500">
                <Sparkles size={18} />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900">Rekomendasi Untukmu</h2>
                <p className="text-xs text-slate-500 font-medium">Mungkin Anda juga butuh ini</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {recommendedProducts.map(product => (
                <WishlistCard key={product.id} product={product} onAdd={() => handleAddToCart(product)} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function WishlistCard({ product, onRemove, onAdd, isWishlist }: {
  product: Product;
  onRemove?: () => void;
  onAdd: (p: Product) => void;
  isWishlist?: boolean;
}) {
  const imgSrc = product.image && product.image !== '' ? product.image : '/logo-atayatoko.png';

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col hover:shadow-md transition-all group">
      <div className="relative">
        <Link href={`/produk/${product.id}`} className="block aspect-square overflow-hidden">
          <img
            src={imgSrc}
            alt={product.name || 'Produk'}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </Link>
        {isWishlist && (
          <button
            onClick={onRemove}
            className="absolute top-2.5 right-2.5 bg-white/90 backdrop-blur p-2 rounded-xl text-red-500 shadow-sm hover:bg-red-500 hover:text-white transition-all active:scale-90"
            title="Hapus dari Wishlist"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <div className="p-3.5 flex-1 flex flex-col">
        <Link href={`/produk/${product.id}`}>
          <h3 className="text-xs font-bold text-slate-800 leading-snug line-clamp-2 mb-1.5 group-hover:text-emerald-600 transition-colors">
            {product.name || 'Produk Tanpa Nama'}
          </h3>
        </Link>
        <p className="text-sm font-black text-emerald-600 mb-3">
          Rp{(Number(product.price) || 0).toLocaleString('id-ID')}
        </p>
        <button
          onClick={() => onAdd(product)}
          className="mt-auto w-full bg-slate-50 hover:bg-emerald-600 hover:text-white text-emerald-600 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-slate-200 hover:border-emerald-600"
        >
          <ShoppingCart size={13} /> + Keranjang
        </button>
      </div>
    </div>
  );
}
