'use client';

import { Product } from '@/lib/types';
import { Search, ShoppingBag, Plus, ImageIcon, X } from 'lucide-react';

interface ProductSearchProps {
  searchTerm: string;
  onSearchChange: (val: string) => void;
  products: Product[];
  onAddToCart: (p: Product) => void;
  channel: string;
}

export const ProductSearchList = ({
  searchTerm,
  onSearchChange,
  products,
  onAddToCart,
  channel,
}: ProductSearchProps) => {
  const hasQuery = searchTerm.trim().length > 0;

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs flex flex-col overflow-hidden">
      <div className="p-3.5 md:p-4 border-b border-slate-100">
        <label htmlFor="mkt-product-search" className="text-xs font-bold text-slate-700 block mb-2">
          Cari &amp; Tambah Produk
        </label>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            id="mkt-product-search"
            type="text"
            placeholder="Ketik nama produk atau SKU..."
            className="w-full bg-slate-50 border border-slate-200/80 pl-10 pr-9 py-2.5 rounded-xl text-xs md:text-sm font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:bg-white focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {hasQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              title="Hapus pencarian"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="overflow-y-auto max-h-[320px] lg:max-h-[360px] p-3 space-y-1.5">
        {!hasQuery ? (
          <div className="py-6 px-4 text-center">
            <p className="text-xs font-medium text-slate-400">
              Ketik nama barang atau SKU di atas untuk menambahkan ke keranjang.
            </p>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400">
            <ShoppingBag size={36} className="text-slate-300 mb-2" />
            <p className="text-xs font-semibold text-slate-500">Produk tidak ditemukan</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Coba kata kunci lain.</p>
          </div>
        ) : (
          products.map((p) => {
            const price =
              channel === 'SHOPEE'
                ? p.priceShopee || p.price || p.priceEcer || 0
                : channel === 'TIKTOK'
                ? p.priceTiktok || p.price || p.priceEcer || 0
                : p.priceEcer || p.price || 0;
            const thumb = p.imageUrl || (p as any).image || '';

            return (
              <div
                key={p.id}
                onClick={() => onAddToCart(p)}
                className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-200/80 transition-all cursor-pointer group"
              >
                <div className="w-11 h-11 bg-slate-100 rounded-xl relative overflow-hidden shrink-0 border border-slate-200/60">
                  {thumb ? (
                    <img src={thumb} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <ImageIcon size={18} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {p.sku && (
                    <p className="text-[11px] font-mono font-semibold text-blue-600 truncate">
                      {p.sku}
                    </p>
                  )}
                  <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{p.name}</h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-extrabold tabular-nums text-emerald-600">
                      Rp {(price || 0).toLocaleString('id-ID')}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium tabular-nums">
                      · Stok: {p.stock || 0} {p.unit || 'PCS'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddToCart(p);
                  }}
                  className="p-2.5 bg-slate-900 hover:bg-orange-600 text-white rounded-xl shadow-xs active:scale-90 transition-all shrink-0"
                  aria-label={`Tambah ${p.name}`}
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
