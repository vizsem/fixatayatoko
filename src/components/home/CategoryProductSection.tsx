'use client';

import Link from 'next/link';
import { Package, ArrowRight } from 'lucide-react';
import { Product, Category } from '@/lib/types';
import { ProductCard } from '@/components/home/ProductCard';

interface CategoryProductSectionProps {
  category: Category;
  products: Product[];
  getDiscountedPrice: (p: Product) => { price: number; hasPromo: boolean; promoName: string | null };
  wishlist: string[];
  onWishlistToggle: (id: string) => void;
  onAddToCart: (p: Product) => void;
}

export default function CategoryProductSection({
  category,
  products,
  getDiscountedPrice,
  wishlist,
  onWishlistToggle,
  onAddToCart,
}: CategoryProductSectionProps) {
  if (!products || products.length === 0) return null;

  return (
    <section className="mb-8 px-4" aria-labelledby={`cat-heading-${category.id}`}>
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-green-100 text-green-600">
            <Package size={18} />
          </div>
          <h2 id={`cat-heading-${category.id}`} className="text-sm font-black text-gray-800 tracking-tighter">
            {category.name}
          </h2>
        </div>
        <Link 
          href={`/kategori/${category.slug}`} 
          className="text-xs font-bold text-gray-400 hover:text-green-600 transition-colors flex items-center gap-1"
        >
          SEMUA <ArrowRight size={12} className="inline" />
        </Link>
      </div>
      <div className="flex overflow-x-auto gap-4 scrollbar-hide pb-2 snap-x">
        {products.slice(0, 10).map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            promoInfo={getDiscountedPrice(p)}
            isWish={wishlist.includes(p.id)}
            onWishlistToggle={onWishlistToggle}
            onAddToCart={onAddToCart}
          />
        ))}
      </div>
    </section>
  );
}
