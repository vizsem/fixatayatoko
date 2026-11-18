'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { Package, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Product, Category } from '@/lib/types';
import { ProductCard } from '@/components/home/ProductCard';
import { formatProductName } from '@/lib/format';

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
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!products || products.length === 0) return null;

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -320 : 320;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <section className="mb-8 px-4" aria-labelledby={`cat-heading-${category.id}`}>
      {/* Header Kategori: Proporsional & Elegan di Mobile & Desktop */}
      <div className="flex justify-between items-center mb-3.5 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shrink-0 text-sm shadow-2xs">
            {category.icon && category.icon.length <= 4 ? (
              <span>{category.icon}</span>
            ) : (
              <Package size={17} className="text-emerald-600" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 id={`cat-heading-${category.id}`} className="text-sm sm:text-base font-black text-gray-900 tracking-tight truncate">
                {formatProductName(category.name)}
              </h2>
              <span className="hidden sm:inline-flex text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full shrink-0">
                {products.length} Produk
              </span>
            </div>
          </div>
        </div>

        {/* Tombol Lihat Semua: Pill Button Elegan dengan Touch Target Ramah Mobile */}
        <Link 
          href={`/kategori/${category.slug}`} 
          aria-label={`Lihat semua produk kategori ${category.name}`}
          className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100/90 text-emerald-700 hover:text-emerald-800 text-xs font-bold transition-all duration-200 active:scale-95 border border-emerald-200/60 shadow-2xs shrink-0"
        >
          <span>Lihat Semua</span>
          <ArrowRight size={13} className="text-emerald-600 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* Carousel Container dengan Tombol Navigasi Desktop */}
      <div className="relative group/carousel">
        {/* Tombol Navigasi Desktop Kiri */}
        <button
          type="button"
          onClick={() => scroll('left')}
          aria-label="Scroll ke kiri"
          className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/95 border border-gray-200 shadow-md text-gray-700 hover:text-emerald-600 hover:border-emerald-300 items-center justify-center transition-all opacity-0 group-hover/carousel:opacity-100 active:scale-90"
        >
          <ChevronLeft size={18} />
        </button>

        {/* Daftar Produk Horizontal */}
        <div
          ref={scrollRef}
          className="flex overflow-x-auto gap-3.5 sm:gap-4 scrollbar-hide pb-2 snap-x scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0"
        >
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

        {/* Tombol Navigasi Desktop Kanan */}
        <button
          type="button"
          onClick={() => scroll('right')}
          aria-label="Scroll ke kanan"
          className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/95 border border-gray-200 shadow-md text-gray-700 hover:text-emerald-600 hover:border-emerald-300 items-center justify-center transition-all opacity-0 group-hover/carousel:opacity-100 active:scale-90"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </section>
  );
}
