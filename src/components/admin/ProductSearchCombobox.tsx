'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown, Check, X, Loader2, Layers, CornerDownRight, Package, AlertCircle } from 'lucide-react';
import { getProducts } from '@/lib/actions/product.actions';
import toast from 'react-hot-toast';

export interface ProductOption {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  category?: string;
  unit?: string;
  units?: { code: string; contains: number; price?: number; label?: string; barcode?: string }[];
  purchasePrice?: number;
  priceEcer?: number;
  stock?: number;
  isActive?: boolean;
  parentId?: string;
  isParentOnly?: boolean;
  raw_data?: any;
}

interface ProductSearchComboboxProps {
  value: string;
  onChange: (productId: string, product?: ProductOption) => void;
  products?: ProductOption[];
  placeholder?: string;
  className?: string;
}

/**
 * Mengambil 3 kata terakhir untuk varian anak (misal: "STRAWBERRY TPK 115ML")
 * Jika kata <= 3, kembalikan nama utuh.
 */
function getVariantShortName(fullName: string): string {
  if (!fullName) return '';
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 3) return fullName;
  return words.slice(-3).join(' ');
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

  // Map of children by parentId and quick lookup
  const { parentChildMap, productById } = useMemo(() => {
    const pcMap = new Map<string, ProductOption[]>();
    const pMap = new Map<string, ProductOption>();
    combinedProducts.forEach((p) => {
      pMap.set(p.id, p);
      const pid = p.parentId?.trim();
      if (pid) {
        const arr = pcMap.get(pid) || [];
        arr.push(p);
        pcMap.set(pid, arr);
      }
    });
    return { parentChildMap: pcMap, productById: pMap };
  }, [combinedProducts]);

  // Filter products by search term locally & organize hierarchical relationships
  const { topLevelProducts, childrenByParentInView } = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const tokens = term ? term.split(/\s+/).filter(Boolean) : [];

    const matches = (p: ProductOption) => {
      if (!tokens.length) return true;
      const name = (p.name || '').toLowerCase();
      const sku = (p.sku || '').toLowerCase();
      const barcode = (p.barcode || '').toLowerCase();
      const category = (p.category || '').toLowerCase();
      const unitBarcodes = Array.isArray(p.units)
        ? p.units.map((u: any) => (u.barcode || '').toLowerCase()).filter(Boolean)
        : [];

      return tokens.every(
        (t) =>
          name.includes(t) ||
          sku.includes(t) ||
          barcode.includes(t) ||
          category.includes(t) ||
          unitBarcodes.some((ub: string) => ub.includes(t))
      );
    };

    // Filter all matching products
    const matchedProducts = combinedProducts.filter(matches);
    const matchedIds = new Set(matchedProducts.map((p) => p.id));

    // Also include parents of any matched children so the hierarchy is visible
    matchedProducts.forEach((p) => {
      if (p.parentId && productById.has(p.parentId)) {
        matchedIds.add(p.parentId);
      }
    });

    const viewProducts = combinedProducts.filter((p) => matchedIds.has(p.id));

    // Separate top-level (parents & standalone products) vs children
    const topLevel: ProductOption[] = [];
    const childrenViewMap = new Map<string, ProductOption[]>();

    viewProducts.forEach((p) => {
      const pid = p.parentId?.trim();
      if (pid && matchedIds.has(pid)) {
        // Child has its parent present in the view -> nest it under parent
        const arr = childrenViewMap.get(pid) || [];
        arr.push(p);
        childrenViewMap.set(pid, arr);
      } else {
        // Either a parent, standalone product, or orphan child without parent in view
        topLevel.push(p);
      }
    });

    return { topLevelProducts: topLevel, childrenByParentInView: childrenViewMap };
  }, [combinedProducts, searchTerm, productById]);

  // Find currently selected product
  const selectedProduct = useMemo(() => {
    if (!value) return null;
    return combinedProducts.find((p) => p.id === value) || null;
  }, [combinedProducts, value]);

  const handleSelect = (product: ProductOption) => {
    if (product.isParentOnly) {
      toast('Produk ini adalah Induk Pengelompokan. Silakan pilih salah satu variannya di bawah.', {
        icon: 'ℹ️',
      });
      return;
    }
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
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          {selectedProduct ? (
            <>
              <span title={selectedProduct.name} className="font-semibold text-gray-800 truncate">
                {selectedProduct.name}
              </span>
              {selectedProduct.parentId && (
                <span className="text-[9px] font-black uppercase bg-violet-50 text-violet-700 border border-violet-200 px-1 py-0.2 rounded shrink-0">
                  Varian
                </span>
              )}
            </>
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
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 overflow-hidden w-full min-w-[340px] sm:min-w-[480px] md:min-w-[560px] max-w-2xl ring-1 ring-black/5">
          {/* Search Bar */}
          <div className="p-2 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <Search size={14} className="text-gray-400 ml-1 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nama barang, varian, SKU, barcode..."
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
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
            {topLevelProducts.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-400">
                {isSearching ? 'Mencari ke database...' : 'Produk aktif tidak ditemukan'}
              </div>
            ) : (
              topLevelProducts.slice(0, 100).map((p) => {
                const isSelected = p.id === value;
                const children = childrenByParentInView.get(p.id) || parentChildMap.get(p.id) || [];
                const hasVariants = children.length > 0;
                const isParentGroup = Boolean(p.isParentOnly || hasVariants);

                return (
                  <div key={p.id} className="transition-colors">
                    {/* Parent Header / Standalone Item */}
                    <div
                      onClick={() => handleSelect(p)}
                      className={`px-3 py-2.5 text-xs flex items-center justify-between gap-2.5 transition-colors ${
                        p.isParentOnly
                          ? 'bg-violet-50/50 cursor-default border-b border-violet-100/60'
                          : isSelected
                          ? 'bg-emerald-50/70 font-bold text-emerald-900 cursor-pointer'
                          : 'hover:bg-emerald-50 text-gray-700 cursor-pointer'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          {isParentGroup && (
                            <span className="p-1 bg-violet-100 text-violet-700 rounded-md shrink-0 mt-0.5">
                              <Layers size={12} />
                            </span>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <p
                                title={p.name}
                                className={`text-xs leading-snug break-words ${isParentGroup ? 'font-black text-slate-900' : 'font-semibold text-gray-800'}`}
                              >
                                {p.name}
                              </p>
                              {p.isParentOnly ? (
                                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 border border-violet-200 shrink-0">
                                  Induk (Non-Order)
                                </span>
                              ) : hasVariants ? (
                                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-100 shrink-0">
                                  Induk ({children.length} Varian)
                                </span>
                              ) : p.parentId ? (
                                <span className="text-[9px] font-bold text-violet-700 bg-violet-50 px-1 py-0.5 rounded shrink-0">
                                  ↳ Varian: {productById.get(p.parentId)?.name || p.parentId}
                                </span>
                              ) : null}
                            </div>

                            {/* Sub info */}
                            <div className="flex items-center gap-2 text-xs text-gray-400 mt-1 flex-wrap">
                              {p.sku && <span className="font-mono text-[10px] text-gray-500">#{p.sku}</span>}
                              {p.barcode && <span className="font-mono bg-gray-100 text-[10px] px-1 py-0.5 rounded">{p.barcode}</span>}
                              {!p.isParentOnly && p.purchasePrice !== undefined && Number(p.purchasePrice) > 0 && (
                                <span className="text-emerald-600 font-medium">
                                  Modal: Rp{Number(p.purchasePrice).toLocaleString('id-ID')}
                                </span>
                              )}
                              {!p.isParentOnly && p.stock !== undefined && (
                                <span>Stok: <strong className="text-gray-700">{p.stock}</strong></span>
                              )}
                              {p.isParentOnly && (
                                <span className="text-violet-600 font-semibold text-[10px]">
                                  Pilih salah satu varian di bawah:
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right action indicator */}
                      <div>
                        {isSelected && <Check size={14} className="text-emerald-600 flex-shrink-0" />}
                      </div>
                    </div>

                    {/* Nested Children Variants */}
                    {hasVariants && (
                      <div className="bg-slate-50/50 border-l-2 border-violet-300 ml-4 my-1 space-y-0.5">
                        {children.map((child) => {
                          const isChildSelected = child.id === value;
                          const shortName = getVariantShortName(child.name);
                          return (
                            <div
                              key={child.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelect(child);
                              }}
                              className={`pl-4 pr-3 py-2 text-xs cursor-pointer flex items-center justify-between gap-2.5 transition-colors ${
                                isChildSelected
                                  ? 'bg-emerald-100/70 font-bold text-emerald-950'
                                  : 'hover:bg-emerald-50/90 text-gray-700'
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start gap-2">
                                  <CornerDownRight size={12} className="text-violet-500 shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 flex-wrap">
                                      <span
                                        title={child.name}
                                        className="font-bold text-xs text-gray-900 leading-snug break-words"
                                      >
                                        {shortName}
                                      </span>
                                      {child.sku && (
                                        <span className="font-mono text-[9px] text-gray-400 shrink-0">
                                          #{child.sku}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-1 flex-wrap">
                                      {child.barcode && (
                                        <span className="font-mono bg-white border border-gray-200 text-[10px] px-1 py-0.5 rounded">
                                          {child.barcode}
                                        </span>
                                      )}
                                      {child.purchasePrice !== undefined && Number(child.purchasePrice) > 0 && (
                                        <span className="text-emerald-700 font-semibold">
                                          Modal: Rp{Number(child.purchasePrice).toLocaleString('id-ID')}
                                        </span>
                                      )}
                                      {child.stock !== undefined && (
                                        <span>Stok: <strong className="text-gray-700">{child.stock}</strong> {child.unit || 'PCS'}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              {isChildSelected ? (
                                <Check size={14} className="text-emerald-600 flex-shrink-0" />
                              ) : (
                                <span className="text-[10px] font-bold text-violet-600 bg-violet-50 hover:bg-violet-100 px-2 py-1 rounded border border-violet-200 shrink-0">
                                  Pilih
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
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
