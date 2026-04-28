'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Heart, Sparkles } from 'lucide-react';
import { Product } from '@/lib/types';

interface ProductCardProps {
  product: Product;
  promoInfo: { price: number; hasPromo: boolean; promoName: string | null };
  isWish: boolean;
  onWishlistToggle: (id: string) => void;
  onAddToCart: (product: Product) => void;
}

export const ProductCard = ({ 
  product, 
  promoInfo, 
  isWish, 
  onWishlistToggle, 
  onAddToCart 
}: ProductCardProps) => {
  const isOut = product.stock <= 0;
  const baseUnit = (product.unit || 'PCS').toString().toUpperCase();
  const baseDiscount = Math.max(0, Number(product.price || 0) - Number(promoInfo.price || 0));

  const unitList = (() => {
    const src = (product.units || []).map((u) => ({
      code: (u.code || '').toString().toUpperCase(),
      contains: Math.max(1, Math.floor(Number(u.contains || 1))),
      price: typeof u.price === 'number' ? Number(u.price) : undefined,
    })).filter((u) => u.code);
    const list = src.some((u) => u.code === baseUnit) ? src : [{ code: baseUnit, contains: 1 }, ...src];
    const uniq = new Map<string, { code: string; contains: number; price?: number }>();
    list.forEach((u) => {
      if (!uniq.has(u.code)) uniq.set(u.code, u);
    });
    const deduped = Array.from(uniq.values());
    deduped.sort((a, b) => {
      if (a.code === baseUnit && b.code !== baseUnit) return -1;
      if (b.code === baseUnit && a.code !== baseUnit) return 1;
      return a.contains - b.contains;
    });
    return deduped;
  })();

  const unitPrice = (u: { code: string; contains: number; price?: number }) => {
    const baseUnitPrice = Number(u.price ?? (Number(product.price || 0) * Number(u.contains || 1)));
    const discounted = promoInfo.hasPromo ? Math.max(0, baseUnitPrice - (baseDiscount * Number(u.contains || 1))) : baseUnitPrice;
    return Math.round(discounted);
  };

  return (
    <div className="min-w-[165px] md:min-w-[210px] bg-white rounded-2xl border border-gray-100 overflow-hidden snap-start shadow-sm hover:shadow-md transition-shadow flex flex-col relative group">
      <button 
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onWishlistToggle(product.id);
        }}
        className="absolute top-2 right-2 z-30 p-2 bg-white/90 backdrop-blur-md rounded-full shadow-md active:scale-75 transition-all cursor-pointer"
      >
        <Heart size={14} className={isWish ? "fill-red-500 text-red-500" : "text-gray-400"} />
      </button>

      <Link href={`/produk/${product.id}`} className="relative aspect-square bg-gray-50 overflow-hidden block z-10">
        <Image 
          src={product.image || '/logo-atayatoko.png'} 
          alt={product.name} 
          fill 
          className={`object-cover transition-transform duration-500 group-hover:scale-110 ${isOut ? 'grayscale opacity-50' : ''}`} 
          sizes="(max-width: 768px) 165px, 210px"
          placeholder="blur"
          blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkqAcAAIUAgUW0RjgAAAAASUVORK5CYII="
        />
        {isOut && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
            <span className="bg-white text-black text-[9px] font-black px-3 py-1 rounded-full uppercase">Habis</span>
          </div>
        )}
        {promoInfo.hasPromo && !isOut && (
          <div className="absolute top-2 left-2 z-10 bg-gradient-to-r from-orange-600 to-red-600 text-white text-[8px] font-black px-2 py-1 rounded uppercase animate-pulse shadow-lg flex items-center gap-1">
            <Sparkles size={10} /> Promo
          </div>
        )}
      </Link>

      <div className="p-3 flex flex-col flex-1 relative z-20">
        <Link href={`/produk/${product.id}`} className="block">
          <h3 className="text-[10px] md:text-xs font-black text-gray-800 line-clamp-2 uppercase leading-tight hover:text-green-600 transition-colors">{product.name}</h3>
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <p className="text-[8px] font-bold text-gray-400 uppercase">{product.category}</p>
          <p className={`text-[8px] font-black uppercase ${isOut ? 'text-rose-600' : 'text-emerald-600'}`}>
            {isOut ? 'Habis' : `Stok ${product.stock}`}
          </p>
        </div>

        <Link href={`/produk/${product.id}`} className="flex flex-col mb-3 block cursor-pointer">
          <div className="flex items-baseline gap-1">
            <span className="text-[15px] font-black text-green-600">Rp{Number(promoInfo.price || 0).toLocaleString('id-ID')}</span>
            <span className="text-[9px] font-black text-gray-400">/{baseUnit}</span>
          </div>
          
          <div className="mt-2 flex flex-wrap gap-1.5">
            {unitList.filter(u => u.code !== baseUnit).slice(0, 4).map((u) => (
              <span
                key={u.code}
                className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-100 px-2 py-1 rounded-full text-[8px] font-black uppercase text-gray-700"
                title={`${u.code}${u.contains > 1 ? ` (isi ${u.contains})` : ''} • Rp${unitPrice(u).toLocaleString('id-ID')}`}
              >
                <span className="text-gray-900">{u.code}</span>
                {u.contains > 1 && <span className="text-gray-400">×{u.contains}</span>}
                <span className="text-gray-900 not-italic">Rp{unitPrice(u).toLocaleString('id-ID')}</span>
              </span>
            ))}
            {unitList.filter(u => u.code !== baseUnit).length > 4 && (
              <span
                className="inline-flex items-center bg-white border border-gray-200 px-2 py-1 rounded-full text-[8px] font-black uppercase text-gray-500"
                title={unitList.filter(u => u.code !== baseUnit).slice(4).map((u) => `${u.code}${u.contains > 1 ? ` (isi ${u.contains})` : ''}: Rp${unitPrice(u).toLocaleString('id-ID')}`).join(' | ')}
              >
                +{unitList.filter(u => u.code !== baseUnit).length - 4}
              </span>
            )}
          </div>

          {(() => {
            const wPrice = Number(product.wholesalePrice || 0);
            const wQty = Number(product.minWholesale || 0);
            
            if (wQty > 1) {
              return (
                <div className="mt-2 pt-2 border-t border-dashed border-gray-100 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-blue-500 uppercase block leading-none mb-1 tracking-widest">Target Grosir</span>
                    <span className="text-[10px] font-black text-blue-600 uppercase leading-none flex items-center gap-1">
                      Min. {wQty} {baseUnit}
                    </span>
                  </div>
                  <span className="text-blue-700 text-[11px] font-black not-italic bg-blue-50 px-2 py-1 rounded-lg">
                    {wPrice > 0 ? `Rp${wPrice.toLocaleString('id-ID')}` : 'Tanya Admin'}
                  </span>
                </div>
              );
            }
            return null;
          })()}
        </Link>

        <button 
          onClick={(e) => { 
            e.preventDefault(); 
            e.stopPropagation(); 
            onAddToCart(product); 
          }} 
          disabled={isOut} 
          className={`mt-auto w-full py-2.5 text-[9px] font-black rounded-xl uppercase shadow-sm transition-all relative z-30 ${isOut ? 'bg-gray-100 text-gray-400' : 'bg-gray-900 text-white active:bg-green-600 active:scale-95'}`}
        >
          {isOut ? 'Stok Habis' : '+ Keranjang'}
        </button>
      </div>
    </div>
  );
};
