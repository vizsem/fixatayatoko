'use client';

import { Product } from '@/lib/types';
import { Search, ShoppingBag, Plus, ImageIcon } from 'lucide-react';
import Image from 'next/image';

interface ProductSearchProps {
  searchTerm: string;
  onSearchChange: (val: string) => void;
  products: Product[];
  onAddToCart: (p: Product) => void;
  channel: string;
}

export const ProductSearchList = ({ searchTerm, onSearchChange, products, onAddToCart, channel }: ProductSearchProps) => {
  return (
    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-gray-50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Cari SKU atau Nama..."
            className="w-full bg-gray-50 pl-10 pr-4 py-3 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 opacity-30">
            <ShoppingBag size={48} />
            <p className="text-[10px] font-black uppercase mt-2">Tidak ada produk</p>
          </div>
        ) : (
          products.map((p) => {
            const price = channel === 'SHOPEE' ? p.priceShopee : channel === 'TIKTOK' ? p.priceTiktok : p.priceEcer;
            return (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all group">
                <div className="w-12 h-12 bg-gray-50 rounded-xl relative overflow-hidden shrink-0 border border-gray-100">
                  {p.imageUrl ? (
                    <Image src={p.imageUrl} fill alt={p.name} className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-200">
                      <ImageIcon size={18} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[8px] font-black text-blue-500 uppercase tracking-tighter italic">#{p.sku}</p>
                  <h4 className="text-[11px] font-black text-gray-800 line-clamp-1 uppercase leading-none">{p.name}</h4>
                  <p className="text-[10px] font-black text-emerald-600 mt-1">Rp{(price || 0).toLocaleString()}</p>
                </div>
                <button
                  onClick={() => onAddToCart(p)}
                  className="p-2.5 bg-black text-white rounded-xl shadow-md active:scale-90 transition-all"
                >
                  <Plus size={16} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
