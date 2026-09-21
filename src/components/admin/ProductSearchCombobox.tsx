'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown, Check, X, Loader2 } from 'lucide-react';
import { getProducts } from '@/lib/actions/product.actions';

export interface ProductOption {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  category?: string;
  unit?: string;
  units?: { code: string; contains: number; price?: number; label?: string }[];
  purchasePrice?: number;
  priceEcer?: number;
  stock?: number;
  isActive?: boolean;
}

interface ProductSearchComboboxProps {
  value: string;
  onChange: (productId: string, product?: ProductOption) => void;
  products?: ProductOption[];
  placeholder?: string;
  className?: string;
}

export default function ProductSearchCombobox({
  value,
  onChange,
  products = [],
  placeholder = 'Pilih / Cari Produk...',
  className = '',
}: ProductSearchComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [serverResults, setServerResults] = useState<ProductOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  // Server search debounce when user types
  useEffect(() => {
    const term = searchTerm.trim();
    if (!term || term.length < 2) {
      setServerResults([]);
      return;
    }

    let active = true;
    setIsSearching(true);
    const handler = setTimeout(async () => {
      try {
        const results = await getProducts({
          search: term,
          isActive: true,
          limit: 30,
        });
        if (active) {
          // Strictly ensure only active products are included
          const activeOnly = (results as unknown as ProductOption[]).filter(
            (p) => p.isActive !== false
          );
          setServerResults(activeOnly);
        }
      } catch (err) {
        console.error('Failed to search products:', err);
      } finally {
        if (active) setIsSearching(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(handler);
    };
  }, [searchTerm]);

  // Merge and deduplicate products: always strictly filter active products
  const combinedProducts = useMemo(() => {
    const map = new Map<string, ProductOption>();
    // Add local products (only active ones)
    products.forEach((p) => {
      if (p.isActive !== false) {
        map.set(p.id, p);
      }
    });
    // Add server results (only active ones)
    serverResults.forEach((p) => {
      if (p.isActive !== false) {
        map.set(p.id, p);
      }
    });
    return Array.from(map.values());
  }, [products, serverResults]);

  // Filter products by search term locally
  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return combinedProducts;

    const tokens = term.split(/\s+/).filter(Boolean);
    return combinedProducts.filter((p) => {
      const name = (p.name || '').toLowerCase();
      const sku = (p.sku || '').toLowerCase();
      const barcode = (p.barcode || '').toLowerCase();
      const category = (p.category || '').toLowerCase();

      return tokens.every(
        (t) =>
          name.includes(t) ||
          sku.includes(t) ||
          barcode.includes(t) ||
          category.includes(t)
      );
    });
  }, [combinedProducts, searchTerm]);

  // Find currently selected product
  const selectedProduct = useMemo(() => {
    if (!value) return null;
    return combinedProducts.find((p) => p.id === value) || null;
  }, [combinedProducts, value]);

  const handleSelect = (product: ProductOption) => {
    onChange(product.id, product);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 hover:bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer flex items-center justify-between gap-1 transition-all"
      >
        <div className="flex-1 truncate">
          {selectedProduct ? (
            <span className="font-semibold text-gray-800">{selectedProduct.name}</span>
          ) : (
            <span className="text-gray-400">{placeholder}</span>
          )}
        </div>
        <div className="flex items-center gap-1 text-gray-400 flex-shrink-0">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 hover:text-red-500 rounded transition-colors"
              title="Hapus pilihan"
            >
              <X size={12} />
            </button>
          )}
          <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden min-w-[280px]">
          {/* Search Bar */}
          <div className="p-2 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <Search size={14} className="text-gray-400 ml-1 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nama, SKU, atau barcode..."
              className="w-full bg-transparent text-xs text-gray-800 placeholder-gray-400 focus:outline-none"
            />
            {isSearching && <Loader2 size={12} className="animate-spin text-emerald-600 flex-shrink-0" />}
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="p-0.5 text-gray-400 hover:text-gray-600"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* List Options */}
          <div className="max-h-56 overflow-y-auto divide-y divide-gray-50">
            {filteredProducts.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-400">
                {isSearching ? 'Mencari ke database...' : 'Produk aktif tidak ditemukan'}
              </div>
            ) : (
              filteredProducts.slice(0, 100).map((p) => {
                const isSelected = p.id === value;
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelect(p)}
                    className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between gap-2 hover:bg-emerald-50 transition-colors ${
                      isSelected ? 'bg-emerald-50/70 font-bold text-emerald-900' : 'text-gray-700'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs font-semibold text-gray-800">{p.name}</p>
                      <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                        {p.barcode && <span className="font-mono bg-gray-100 px-1 py-0.2 rounded">{p.barcode}</span>}
                        {p.purchasePrice !== undefined && Number(p.purchasePrice) > 0 && (
                          <span className="text-emerald-600 font-medium">
                            Modal: Rp{Number(p.purchasePrice).toLocaleString('id-ID')}
                          </span>
                        )}
                        {p.stock !== undefined && (
                          <span>Stok: {p.stock}</span>
                        )}
                      </div>
                    </div>
                    {isSelected && <Check size={14} className="text-emerald-600 flex-shrink-0" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
